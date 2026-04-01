# Vibe Coding Simulator — Mechanics

Detailed documentation of the simulation engine mechanics.

## Time Model

The simulation tracks time in simulated minutes. Real time is scaled by `timeScale` (default 60x) and the current speed multiplier (1x/2x/5x/10x). Each frame, the engine advances by `dtReal * timeScale * speedMultiplier / 60` simulated minutes.

Credits refresh every 24 simulated hours. Review budget (8 hours) also resets daily.

## Task Lifecycle

```
Created → RUNNING → PENDING_REVIEW → COMPLETED (accepted)
                  → PENDING_REVIEW → CANCELLED (rejected)
                  → CANCELLED (cancelled by player)
```

### Task Types and Subtasks

Each task type has a fixed sequence of subtask phases:

| Task Type | Subtasks |
|-----------|----------|
| Implement | investigating → reading code → planning → implementing → testing |
| Write Doc / Evaluate Doc / Write Tests | investigating → reading code → writing |
| Merge Conflict Resolve | investigating → resolving conflict → testing |

Each subtask has a randomized duration: `baseTaskDuration * durationMult * exp(gauss(0, durationLogSigma))`, with a minimum of 1 minute. Merge/retest subtasks use `mergeTaskDurationScale` (0.5x) of the base duration. When a feature's dependencies aren't met, `depsNotMetMultiplier` (2x) applies.

### Task Execution

Tasks advance minute by minute. Each simulated minute:

1. Credits are consumed at `creditRate` per minute
2. The fractional minute accumulator advances by `dt`
3. When a full minute elapses:
   - Skip-testing is checked (if flagged, jumps to end)
   - A random quality event may occur (see Events below)
4. When `elapsedMinutes >= totalDuration`:
   - The agent rolls to catch negative events (see Agent Rewind below)
   - If no rewind, the task finishes

### Task Completion

On finishing, the task enters `PENDING_REVIEW` status (or `COMPLETED` if auto-accept is on). The agent provides a self-report of success or failure, which may be inaccurate — see [Formulas](formulas.md#reported-success).

When accepted, the task's results are applied to the feature's hidden completeness values. When rejected, the work is discarded.

## Event System

### Random Quality Events

Each simulated minute, each running task has an `eventProbability` (8%) chance of a random event. Events are positive with `eventPositiveWeight` (60%) probability, negative otherwise. Each event carries a quality delta of `eventQualityDelta` (0.05), positive or negative.

Events accumulate into `pendingQuality` on the task, which influences the outcome formulas when the task is accepted.

### Outcome Events

At task creation, a single "outcome" event is pre-rolled and placed at a random minute in the timeline. This represents the overall trajectory of the work. The quality delta is drawn from `uniform(-outcomeEventQualityRange, +outcomeEventQualityRange)` (default range: 0.15). It's positive if the delta is >= 0, negative otherwise.

Outcome events use distinct descriptions (e.g., "Key insight led to clean solution" vs. "Fundamental approach has a flaw") and appear as bold italic text in the review log.

### Event Types

| Type | Description | Color | Quality Impact |
|------|-------------|-------|----------------|
| `quality` | Random per-minute event | Green/Red | +/- 0.05 |
| `outcome` | Pre-rolled task outcome | Green/Red | +/- 0.00 to 0.15 |
| `step` | Subtask transition | White | None |
| `rewind` | Rewind marker | White | None |

## Review and Supervision

### Review Mechanics

Expanding a task card starts the review process. The review progress bar advances at `reviewSpeedMultiplier` (2x) the task's speed, but cannot pass the task's current progress.

As the review bar passes event positions on the timeline:
- Event markers appear on the progress bar (green or red dots)
- Event descriptions appear in the expanded log
- The "First Issue" rewind button becomes enabled when a negative event is revealed

When review reaches 100%, a summary line appears describing the overall quality in vague terms (e.g., "Work looks excellent — significant improvement expected").

Both task review and manual testing consume the daily review budget (8 hours). Only one review can be active at a time — starting a new review cancels the current one.

### Review Bar Visibility

The review progress bar is visible on collapsed task cards when any review progress has been made. Event markers on the main progress bar only appear up to the reviewed position, even when collapsed.

## Rewind

### Player Rewind

Three rewind options are available for running, pending review, and completed tasks:

- **First Issue** — rewinds to the start of the step containing the earliest negative event
- **One Step** — rewinds to the start of the previous step
- **Start** — rewinds to minute 0

Rewinding:
1. Removes all quality and outcome events after the rewind point (step events are preserved)
2. If the outcome event was removed, re-rolls it at a random position in the remaining timeline
3. Recalculates `pendingQuality` from surviving events
4. Resets elapsed time and review progress to the rewind point
5. Adds a neutral "rewind" event to the log
6. If the task was in `PENDING_REVIEW`, reverts it to `RUNNING`

The task then replays from the rewind point, generating fresh random events.

### Agent Rewind

At task completion, the engine rolls `sideEffectRate` (25%) chance of a regression, then `regressionCatchRate` (60%) chance the agent notices it. If both succeed and there are negative events on the timeline, the agent rewinds to the earliest negative event — identical to the player pressing "First Issue."

## Merge Conflicts

When multiple running tasks of the same type target the same feature, a merge conflict entry is created. The merge conflict tracks all source task IDs and waits until all source tasks finish.

If a new task is started for the same feature/type while a merge conflict exists (even if the merge resolve is already in progress or completed but not accepted), the existing merge is reset to pending and the new task is added to its sources.

To resolve a merge conflict, the player clicks "Resolve," which starts a merge resolve task (with shorter subtask durations). The resolve task takes the higher of the current code completeness and branch completeness, then applies the universal outcome formula.

## Manual Testing

Manual testing is a separate mechanic from task review. It requires the feature to have both code and tests, and uses the review budget.

Manual test results follow a progressive reveal pattern:

1. **First test** — reports "incomplete" (something isn't at 100%) or "pass" (all three at 100%)
2. **Second test** (if first was "incomplete") — reveals which area needs work: "doc", "code", or "tests"

A feature's dependencies are considered met when it passes a manual test. The win condition is all features passing manual testing.

## Test Workflow

The test workflow runs automated tests across all features. It takes `testWorkflowDuration` simulated minutes and produces a pass percentage for each feature that has both code and tests.

The test result formula: `min(code, test) / max(code, test)`, chained with upstream features' results. Features without code or tests show no result.

## Cross-Feature Side Effects

When code is implemented or a merge conflict is resolved, there's a `sideEffectRate` (25%) chance of a side effect on another feature. With `sideEffectUpstreamWeight` (75%) probability, the affected feature is an upstream dependency; otherwise, it's random. The side effect changes the target's code completeness by up to `sideEffectMaxChange` (0.25) in either direction.

Side effects are hidden — they aren't logged or reported to the player.
