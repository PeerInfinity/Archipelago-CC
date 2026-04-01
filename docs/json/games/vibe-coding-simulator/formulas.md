# Vibe Coding Simulator — Formulas and Configuration

Reference for the simulation's probability formulas and tuning constants.

## Hidden Completeness Model

Each feature has three hidden completeness values, each ranging from 0.0 to 1.0:

- **docCompleteness** — quality of the planning document
- **codeCompleteness** — quality of the implementation (bounded by docCompleteness)
- **testCompleteness** — quality of the tests (bounded by docCompleteness)

The doc completeness acts as a ceiling for code and test completeness. You can't implement better than you planned.

## Task Outcome Formulas

### Write Doc

```
if random() < docSuccessRate (50%):
    docCompleteness = clamp(docBaseQuality + pendingQuality + docSuccessBonus)
                    = clamp(0.5 + pendingQuality + 0.5)
else:
    docCompleteness = clamp(uniform(docPartialMin, docPartialMax) + pendingQuality)
                    = clamp(uniform(0.25, 0.75) + pendingQuality)
```

### Evaluate Doc

Uses the [universal outcome formula](#universal-outcome-formula) with `ceiling = 1.0`.

### Implement / Write Tests (first time)

```
ceiling = docCompleteness
if random() < firstImplExactMatchRate (25%):
    value = min(1.0, ceiling + pendingQuality * qualityBonusFirstImplScale)
          = min(1.0, ceiling + pendingQuality * 0.5)
else:
    value = clamp(uniform(firstImplPartialMin, firstImplPartialMax) * ceiling
                  + pendingQuality * ceiling)
          = clamp(uniform(0.25, 0.75) * ceiling + pendingQuality * ceiling)
```

### Implement / Write Tests (re-implementation)

Uses the [universal outcome formula](#universal-outcome-formula) with `ceiling = docCompleteness`.

### Merge Conflict Resolve

Takes `max(currentCode, branchCode)` as the starting point, then applies the [universal outcome formula](#universal-outcome-formula) with `ceiling = docCompleteness`.

### Investigation Doc Reevaluation

Implement and Write Tests tasks have a `investigationDocRevalRate` (25%) chance of also improving the doc completeness via the universal outcome formula (without quality bonus).

## Universal Outcome Formula

The core formula used by Evaluate Doc, re-implementations, and merge conflicts. Takes a current value, a ceiling, and an optional quality bonus from task events.

```
roll = random()
cRel = current / ceiling    (how close we are to ceiling, 0-1)

if roll < outcomeReduceRate (25%):
    REDUCE — lose up to outcomeMaxLossFraction (50%) of current value
    result = max(0, current - random() * 0.5 * current + qualityBonus * 0.3)

else if roll < outcomeReduceRate + outcomeNothingRate (50%):
    NOTHING — only quality bonus applies
    result = min(ceiling, current + qualityBonus * 0.5)

else if roll < 0.5 + (1 - cRel) / 2:
    IMPROVE — gain up to outcomeMaxGainFraction (50%) of gap to ceiling
    result = min(ceiling, current + random() * 0.5 * gap + qualityBonus * 0.3)

else:
    JUMP — jump straight to ceiling
    (probability increases as current approaches ceiling)

result = clamp(result, 0, 1.0)
```

The "jump to ceiling" branch has dynamic probability: when `current` is far from `ceiling`, the improve branch absorbs most of the remaining probability. As `current` approaches `ceiling`, the jump branch becomes more likely.

### Quality Bonus Multipliers

| Branch | Multiplier | Config Key |
|--------|-----------|------------|
| Reduce | 0.3 | `qualityBonusReduceScale` |
| Nothing | 0.5 | `qualityBonusNothingScale` |
| Improve | 0.3 | `qualityBonusImproveScale` |
| First impl exact match | 0.5 | `qualityBonusFirstImplScale` |

## Reported Success

The agent's self-report at task completion uses `pendingQuality >= 0` as its assessment, filtered through `_rollReportedSuccess`:

```
if actuallyComplete:
    return true
else:
    return random() >= reportAccuracyRate (50%)
```

So if things actually went well, the agent always reports success. If things went badly, the agent has a 50% chance of falsely reporting success.

On accept, `reportedSuccess` is overwritten based on actual feature completeness (whether the value reached its ceiling).

## Cross-Feature Side Effects

When code is implemented or a merge conflict is resolved:

```
if random() < sideEffectRate (25%):
    if random() < sideEffectUpstreamWeight (75%) and has upstream features:
        target = random upstream feature
    else:
        target = random other feature
    target.codeCompleteness += uniform(-sideEffectMaxChange, +sideEffectMaxChange)
                             = uniform(-0.25, +0.25)
```

Side effects are hidden and not bounded by doc completeness.

## Test Workflow Results

```
ownResult = min(code, test) / max(code, test)
chainResult = ownResult * product(upstreamResults)
testPercent = round(chainResult * 100)
```

Features without code or tests return null. Upstream features' failures propagate downstream.

## Manual Review Event Generation

When a manual review starts, issue events are pre-generated for each of doc, code, and tests:

```
for each category in [doc, code, tests]:
    potentialCount = ceil((1 - completeness) * 10)
    if potentialCount == 0: skip
    for i in 0..potentialCount:
        if i > 0 and random() >= 0.5: skip    // first guaranteed, rest 50%
        minute = floor(random() * totalDuration)
        add event(minute, category, description)
```

Events are sorted by minute and revealed progressively as the review advances. Each event has a category-specific description drawn from a pool of 10 descriptions per category. As events are revealed, the feature's `manualReviewIssues` counters are incremented.

## Configuration Reference

All values are defined in `SimulationConfig` and can be overridden.

### Time and Resources

| Config Key | Default | Description |
|------------|---------|-------------|
| `timeScale` | 60.0 | Simulated minutes per real second (at 1x speed) |
| `dailyCredits` | 1920.0 | Credits per day (32 hours of agent time) |
| `dayDuration` | 1440 | Simulated minutes per day |
| `creditRate` | 1.0 | Credits consumed per simulated minute per task |
| `dailyReviewBudget` | 480 | Review minutes per day (8 hours) |
| `reviewSpeedMultiplier` | 2.0 | Review bar speed relative to task speed |

### Task Duration

| Config Key | Default | Description |
|------------|---------|-------------|
| `baseTaskDuration` | 10.0 | Base minutes per subtask |
| `durationLogSigma` | 0.6 | Log-normal variance for subtask duration |
| `depsNotMetMultiplier` | 2.0 | Duration multiplier when dependencies unmet |
| `mergeTaskDurationScale` | 0.5 | Duration scale for merge/retest subtasks |
| `manualTestDuration` | 30.0 | Duration of manual review (30 minutes) |
| `testWorkflowDuration` | 10.0 | Duration of automated test workflow |

### Events

| Config Key | Default | Description |
|------------|---------|-------------|
| `eventProbability` | 0.08 | Chance of a random event per minute |
| `eventPositiveWeight` | 0.6 | Fraction of events that are positive |
| `eventQualityDelta` | 0.05 | Quality change per random event |
| `outcomeEventQualityRange` | 0.15 | Max magnitude of outcome event delta |

### Outcome Formula

| Config Key | Default | Description |
|------------|---------|-------------|
| `outcomeReduceRate` | 0.25 | Probability of reduce branch |
| `outcomeNothingRate` | 0.25 | Probability of nothing branch |
| `outcomeMaxLossFraction` | 0.5 | Max fraction of current value lost |
| `outcomeMaxGainFraction` | 0.5 | Max fraction of gap gained |
| `qualityBonusReduceScale` | 0.3 | Quality bonus multiplier in reduce branch |
| `qualityBonusNothingScale` | 0.5 | Quality bonus multiplier in nothing branch |
| `qualityBonusImproveScale` | 0.3 | Quality bonus multiplier in improve branch |
| `qualityBonusFirstImplScale` | 0.5 | Quality bonus multiplier for first impl exact match |

### Doc Writing

| Config Key | Default | Description |
|------------|---------|-------------|
| `docSuccessRate` | 0.5 | Chance of full doc success |
| `docPartialMin` | 0.25 | Minimum partial doc completeness |
| `docPartialMax` | 0.75 | Maximum partial doc completeness |
| `docBaseQuality` | 0.5 | Base quality before events |
| `docSuccessBonus` | 0.5 | Added to base quality on success roll |

### First Implementation

| Config Key | Default | Description |
|------------|---------|-------------|
| `firstImplExactMatchRate` | 0.25 | Chance of hitting the ceiling |
| `firstImplPartialMin` | 0.25 | Minimum partial fraction |
| `firstImplPartialMax` | 0.75 | Maximum partial fraction |

### Other Probabilities

| Config Key | Default | Description |
|------------|---------|-------------|
| `investigationDocRevalRate` | 0.25 | Chance of free doc reevaluation during impl/tests |
| `reportAccuracyRate` | 0.5 | Chance of accurately reporting failure |
| `sideEffectRate` | 0.25 | Chance of cross-feature side effect |
| `sideEffectMaxChange` | 0.25 | Max side effect magnitude |
| `sideEffectUpstreamWeight` | 0.75 | Chance side effect targets upstream (vs random) |
| `regressionCatchRate` | 0.6 | If regression exists, chance agent catches it |
