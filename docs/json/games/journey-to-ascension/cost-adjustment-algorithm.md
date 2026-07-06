# JTA Cost Adjustment & Auto Queue Algorithms

This document describes two algorithms that simulate JTA gameplay for different purposes:

1. **Cost Adjuster** (`jtaCostGenerator.js`) — Offline: adjusts task costs at seed generation time so a randomized seed is completable.
2. **Auto Queue** (`jtaQueueBuilder.js` + `simulator.js`) — Real-time: generates optimal action queues during play.

Both share the same underlying game formulas, but differ significantly in scope, strategy sophistication, and what they model.

---

## Part 1: Cost Adjustment Algorithm

### Purpose

Journey to Ascension is an incremental/idle game where progression through zones requires accumulated energy from skill levels and perks. When perk placements are randomized by Archipelago, the original game's cost values may produce unplayable results — a critical perk might be placed on an impossibly expensive task, or the progression order might require the player to reach a high zone with none of the usual perks.

The cost adjustment algorithm modifies `costMult` and `xpMult` values on tasks so the randomized seed is completable within a target difficulty level (`resetsPerSphere`).

### Key Concepts

#### Energy and Resets

The player starts each run with `maxEnergy` (initially 100). Completing tasks costs energy. When energy runs out, the player does an **energy reset**: skills and perks persist, items are lost, and the player starts a new run. Over many resets, skill levels grow (from XP), making tasks cheaper to complete.

A **reset** is the fundamental unit of play time. `resetsPerSphere` controls difficulty: lower values mean the player can reach each perk faster (easier), higher values mean more grinding. A minimum of 2 resets is enforced regardless of the setting.

#### Zone Traversal

To reach a task in zone Z, the player must complete all mandatory and travel tasks in zones 0 through Z. This is the **zone traversal cost** — it's cumulative and grows exponentially with zone number because task base costs scale as `baseCost * costMult * 2.2^zoneId`.

#### Zone Access Rules (APWorld)

The APWorld enforces count-based zone access restrictions so that the sphere log reflects roughly zone-ordered progression:

- Zone Z requires `max(0, Z - free_zones + 1 - starting_perks)` total unique perks
- `free_zones` (default 1): how many zones require zero perks before the ramp begins
- `starting_perks` (default 0): number of perks granted at start (actually precollected)
- `starting_perk_list`: optional explicit list of starting perks (overrides count)

This uses `state.has_from_list_unique(all_perks, player, count)` — any perks count, not specific ones. The result is that the sphere log shows perk tasks roughly in zone order rather than all in sphere 0.

#### Sphere Log

The sphere log records the order in which Archipelago placed items. Each entry shows:
- **`sphere_locations`**: locations (tasks) the player must complete
- **`new_inventory_details.base_items`**: items (perks) the player receives

In multiworld games, tasks completed and perks received are independent:
- A JTA task might give an item for **another player** (not a JTA perk)
- A JTA perk might arrive from **another player's game**
- The player must still complete tasks in sphere log order
- Perks arrive in sphere log order regardless of source

### Algorithm Overview

```
Input:
  - Game data JSON (randomized perk placements)
  - Sphere log JSONL
  - resetsPerSphere (target difficulty, minimum 2)
  - Player number (for multiworld)

Output:
  - Adjusted game data JSON (modified costMult and xpMult values)
  - Adjustment log (perk task adjustments)
  - Mandatory log (zone traversal and XP boost adjustments)

For each step in the sphere log (in order):
  1. For each task the player must complete:
     a. Check if zone traversal is the bottleneck (test with free task)
     b. If bottlenecked:
        i.   Adjust mandatory task costs (zone traversal adjustment)
        ii.  If still bottlenecked, boost XP on all tasks in path
        iii. If still bottlenecked after both, mark as bottleneck
     c. If not bottlenecked, binary search for costMult -> target resets
  2. Grant perks received (from own tasks or other players)
  3. Simulate resetsPerSphere resets of play (advance skill levels via XP grinding)
```

### Detailed Mechanics

#### Step 1a: Bottleneck Detection

Before adjusting a task, the algorithm tests whether the **zone itself** is the bottleneck:

1. Set the target task's costMult to 0.01 (nearly free)
2. Estimate resets needed to reach and complete the task
3. If `minResets <= targetResets`: zone is reachable — proceed with perk task adjustment
4. If `minResets > targetResets`: zone traversal is the bottleneck — apply zone adjustments

#### Step 1b-i: Zone Traversal Adjustment

When zone traversal is the bottleneck, the algorithm reduces mandatory task costs along the path:

1. Collect all mandatory/travel tasks in zones 0..targetZoneId
2. Binary search (log-scale) for the **maximum** multiplier M in [0.0001, 1.0] such that the zone becomes reachable in `targetResets` resets
3. Apply `costMult = origCostMult * M` to all mandatory tasks
4. These reductions persist for future steps (later tasks benefit from cheaper traversal)

The search finds the **least reduction** needed — if M=0.3, mandatory costs are reduced to 30% of original, not more.

#### Step 1b-ii: XP Boost Adjustment

If zone traversal adjustment alone isn't enough (zone still unreachable), the algorithm boosts XP rates:

1. Collect all tasks in zones 0..targetZoneId
2. Binary search (log-scale) for the **minimum** multiplier M in [1.0, 10000.0] such that the zone becomes reachable in `targetResets` resets
3. Apply `xpMult = origXpMult * M` to all tasks
4. These boosts persist for future steps (later tasks benefit from faster skill growth)

XP boosting accelerates skill level growth, which reduces task costs through the progress multiplier. This is the second lever when cost reduction alone can't make a zone reachable.

#### Step 1c: Perk Task Cost Adjustment

For tasks where the zone is reachable, the algorithm binary-searches for a costMult that produces approximately `targetResets` resets:

1. **Too easy (< targetResets)**: search between `[currentCost, currentCost * 1000]`
2. **Very hard (>= 200 resets)**: search between `[0.01, currentCost]`
3. **In range**: estimate `newCost = currentCost * (target / actual)`, then search `[estimate/2, estimate*2]`

Each binary search uses log-scale iteration (25 iterations) for convergence across large costMult ranges.

#### XP Grinding in Simulation

After zone traversal on each run, the simulated player spends remaining energy on **Normal tasks** for XP grinding:

- Grinds from the highest reached zone down (higher zones give exponentially more XP)
- Each Normal task completed applies XP to its associated skills
- This happens both in `simulateRun()` (state advancement) and `estimateResetsForTask()` (reset estimation)

This models a basic play strategy where the player doesn't just traverse zones but also grinds for skill levels, significantly improving accuracy for higher zones.

#### Log-Scale Binary Search

All binary searches use logarithmic scale (`Math.log`/`Math.exp`) rather than arithmetic midpoints. This is essential because costMult values span many orders of magnitude (e.g., 0.01 to 600000). With arithmetic search, the first midpoint of [0.01, 600000] would be 300000 — far from the true answer. With log-scale, the first midpoint is ~77, converging much faster.

#### Reset Estimation

`estimateResetsForTask(task, zoneId, state, ctx)` simulates:

```
for each reset (0..maxResets):
  energy = state.maxEnergy
  for each zone 0..targetZoneId:
    for each mandatory/travel task in zone:
      cost = calcTaskEnergyCost(task, zone, state)
      if cost > energy: can't reach zone, break
      energy -= cost
      apply XP to state
  if reached target zone:
    if target is mandatory: already completed, return reset count
    if target is normal: check if remaining energy >= target cost
  grind remaining energy on Normal tasks (highest zone first)
  do energy reset (skills persist, energy refills)
```

#### State Advancement Between Steps

After each sphere step, the algorithm simulates `resetsPerSphere` resets of play. Each reset:
1. Simulates a full run (zones 0 through highest reachable)
2. Completes mandatory tasks, applies XP
3. Grinds remaining energy on Normal tasks for additional XP
4. Does an energy reset (Energetic Memory may increase maxEnergy)

This advances the simulation state so that later steps have realistic skill levels.

#### Data Sync

The algorithm works with two parallel representations of game data:
- **adjustedData**: the JSON clone used for output
- **ctx**: the simulation context created by `loadGameDataFromJson()`

These are separate object trees. After all adjustments, a sync step copies `costMult` and `xpMult` from ctx tasks back to adjustedData tasks so the output JSON reflects all changes.

### Adjustment Levers (in order of application)

| Lever | What it adjusts | When applied | Search direction |
|-------|----------------|--------------|-----------------|
| Zone traversal | `costMult` on mandatory/travel tasks in zones 0..Z | Zone unreachable after target resets | Maximum M (least reduction) |
| XP boost | `xpMult` on all tasks in zones 0..Z | Zone still unreachable after cost reduction | Minimum M (least boost) |
| Perk task cost | `costMult` on the target perk task | Zone reachable, task too easy or hard | Closest to target resets |

All adjustments persist across sphere steps — later tasks benefit from earlier zone cost reductions and XP boosts.

### What the Cost Adjuster Does NOT Model

The current implementation uses a **base strategy** — the simulated player completes mandatory tasks and grinds Normal tasks for XP, but uses no advanced play techniques:

| Feature | Status | Impact |
|---------|--------|--------|
| Mandatory/travel task completion | Modeled | Core progression |
| Skill level growth (XP) | Modeled | Primary power source |
| XP grinding on Normal tasks | Modeled | Accelerates skill growth |
| Perk skill modifiers | Modeled | Discrete power jumps |
| Energy perks (EnergySpell, MinorTimeCompression, etc.) | Modeled | Energy efficiency |
| Energetic Memory (maxEnergy growth) | Modeled | Gradual energy increase |
| Item collection and consumption | **Not modeled** | Items provide energy + skill bonuses |
| Push/collect strategy alternation | **Not modeled** | Optimizes item usage |
| Artifact usage (ScrollOfHaste, etc.) | **Not modeled** | Speed boosts for expensive tasks |
| Boss tasks and hidden tasks | **Not modeled** | Boss-gated tasks have huge base costs |
| Prestige mechanics | **Not modeled** | Late-game power multipliers |
| Major Time Compression, Unified Theory | **Partially** | Special perk effects |

### Known Limitations

#### No Feedback Loop

Each task's costMult is adjusted independently. Adjusting one mandatory task's cost changes the zone traversal budget for all subsequent tasks, but the algorithm doesn't revisit earlier adjustments. A multi-pass approach could improve accuracy.

#### XP Boost Compounding

XP boosts from earlier sphere steps compound with later ones. If zone 8 needed a 5x XP boost and zone 12 later needs a 20x boost, tasks in zones 0-8 end up with 100x XP. This is correct for making the seed completable but may feel unnatural to the player.

---

## Part 2: Auto Queue Algorithm

### Purpose

The auto queue generates a concrete list of actions (a queue) for one energy run, based on the player's current game state and a configurable strategy level. It runs in real-time during play — each time the player starts the queue or does an energy reset, the queue is regenerated from the live game state.

### When It Runs

The auto queue regenerates (`_regenerateStrategyQueue()`) at these points:
- **Start**: When the player clicks Start (before execution begins)
- **Energy reset**: When the game-over overlay is dismissed and a new run begins (`onBeforeReset` callback)
- **Queue exhausted**: When all queued entries complete and the loadout repeats
- **Loadout switch**: When the active loadout changes (manual or via sequencing)
- **Step**: When the player clicks Step with no existing snapshot

Each regeneration reads the current `lastSimState` (converted from the live game's detailed state) and produces a fresh queue.

### Strategy Levels

The auto queue uses composable strategy levels, where each level enables all behaviors of the levels below it:

```
baseline         → mandatory zone traversal + perk tasks + XP grinding
itemCollection   → baseline + collect & immediately use items
pushCollect      → itemCollection + push/collect alternation
grindPushCollect → (not yet implemented)
artifactUsage    → (not yet implemented)
```

The user selects the strategy level in the settings panel. The default is `pushCollect`.

### Algorithm: Baseline

The simplest strategy. Produces a queue that traverses zones, completes perk tasks, and grinds XP with remaining energy.

```
Input: simState (current game state), maxEnergy
Output: QueueEntry[]

1. Pass 1 (energy estimation):
   a. Get reachable zones: walk zones 0..N, subtracting mandatory task costs
   b. Find the highest zone where all mandatory tasks can be completed
   c. Queue perk tasks that are affordable (total energy to reach + task cost ≤ energy)
   d. Queue boss tasks that are affordable
   e. Record remaining energy after all zone traversal and tasks

2. Plan XP grinding with remaining energy:
   a. Get all Normal tasks from reachable zones (grindable tasks)
   b. Score by total XP / total energy cost (XP/energy efficiency)
   c. Select tasks in efficiency order, 1 loop each, until budget exhausted
   d. Include the first task that exceeds budget (we'll drain into it)
   e. Group selected grind tasks by zone

3. Pass 2 (final queue with interleaved grind):
   a. Re-traverse zones, interleaving grind tasks into each zone
   b. Within each zone: grind tasks first, then mandatory non-travel, then travel (last, leaves zone)
```

#### Task Priority Order

Within each zone traversal pass, tasks are queued in this priority:

1. **Perk tasks** — sorted by total energy needed (cheapest first). Navigate to the zone, then complete the task.
2. **Energy items** (if item collection enabled) — item-dropping tasks sorted by item energy value / total cost.
3. **Skill boost items** (if item collection enabled) — tasks that drop items with skill modifiers.
4. **Boss tasks** — affordable boss tasks in reachable zones.
5. **Remaining zone traversal** — mandatory tasks in zones not yet traversed.

### Algorithm: Item Collection

Builds on baseline by also queuing item-dropping tasks along the route and optionally consuming stockpiled items at the start of the run.

```
Input: simState, consumeItems (boolean)
Output: QueueEntry[]

1. If consumeItems:
   a. Add "Use All Items" entries for each stockpiled energy item
   b. Add "Use All Items" entries for each stockpiled skill boost item
   c. Effective energy = maxEnergy + item energy value

2. Run the same two-pass zone progression as baseline, but:
   a. Pass through collectItems=true to priority 2 and 3 (energy items, skill boost items)
   b. Use effectiveEnergy as the budget (accounts for consumed items)
```

### Algorithm: Push/Collect

Builds on item collection by alternating between two run types:

- **Collect run** (`consumeItems=false`): Traverse zones and pick up items, but don't consume stockpiled items. Items accumulate across collect runs (halved on energy reset with UnderstandingTheReset perk).
- **Push run** (`consumeItems=true`): Consume all stockpiled items at the start for a big energy + skill boost, then traverse further than a collect run could.

#### Decision Logic (`wouldAutoPush`)

Each regeneration decides push vs collect:

```
itemEnergy = total energy value of all held items
If itemEnergy == 0: collect (nothing to push with)

totalCostToNextNewZone = sum of mandatory costs for zones 0..(highestZone + 1)
itemsCouldReachNewZone = (maxEnergy + itemEnergy) >= totalCostToNextNewZone * 0.9
itemsAreRipe = itemEnergy >= maxEnergy * 0.2

If itemsCouldReachNewZone OR itemsAreRipe: push
Else: collect
```

This mirrors the decision logic in `simulator.js:simulateRun()`, keeping the auto queue behavior consistent with what the simulator predicts.

### XP Grinding Task Selection

The `planXpGrindingByZone` function selects grinding tasks to fill the remaining energy budget:

```
1. Get all Normal tasks from zones 0..maxReachableZone (grindable tasks)
2. For each task, compute: totalXpPerEnergy = (xpPerRep * maxReps) / fullCost
3. Sort by totalXpPerEnergy descending (most efficient first)
4. Select tasks in order, 1 loop each:
   - Each task can only be performed once per reset (1 loop)
   - Include the first task that exceeds remaining budget (drain into it)
5. Group selected tasks by zone ID (for interleaving into zone traversal)
```

### Zone Entry Construction

Each zone's queue entries are assembled by `addZoneEntries`:

```
For zone Z:
  1. Extra entries (grind tasks assigned to this zone)
  2. Mandatory non-travel tasks
  3. Travel task (last — completing it leaves the zone)
```

### Integration with Executor

The auto queue produces a flat `QueueEntry[]` array. The executor (`jtaQueueExecutor.js`) processes entries sequentially:

1. For each entry, send a command to the iframe (`jta:clickTask`, `jta:clickItem`, `jta:doPrestige`)
2. Poll for task completion via `jta:requestTaskStatus` (500ms interval)
3. Track loops completed per entry; advance when all loops done
4. When queue is exhausted, start drain strategy (pick energy-draining tasks to trigger reset faster)
5. On energy reset: call `onBeforeReset` → regenerate strategy queue → create new snapshot → restart

### Drain Strategy

When the queue is exhausted but energy remains:

| Strategy | Behavior |
|----------|----------|
| `mostDraining` | Pick tasks with highest energy drain per tick |
| `highestXp` | Pick tasks with highest XP per energy |
| `specificTask` | Repeat a user-chosen task |

The drain strategy runs outside the snapshot — it sends `jta:clickTask` directly and polls for completion, then picks the next drain task.

---

## Part 3: Comparison

### When Each Runs

| | Cost Adjuster | Auto Queue |
|---|---|---|
| **When** | Seed generation (offline) | During play (real-time, each reset) |
| **Input** | Sphere log + game data JSON | Live game state from iframe |
| **Output** | Adjusted costMult/xpMult values | Flat queue of actions to execute |
| **Purpose** | Set difficulty: make seed completable | Play optimally: use available energy efficiently |

### State Model

| | Cost Adjuster | Auto Queue |
|---|---|---|
| **Initial state** | Fresh game (no skills, no perks, 100 energy) | Current live game state |
| **State progression** | Simulates entire game from start through all sphere steps | Snapshot of one moment in time |
| **Perks** | Granted in sphere log order | Whatever the player actually has |
| **Skill levels** | Simulated from cumulative XP | Read from live game |
| **Items** | Not tracked | Read from live game (items map) |

### Simulation Fidelity

The auto queue's simulator (`simulator.js`) models substantially more game mechanics than the cost adjuster's internal simulation. This is by design — the cost adjuster deliberately uses a minimal strategy so that costs are set conservatively.

| Feature | Cost Adjuster | Auto Queue |
|---------|:---:|:---:|
| Mandatory/travel task completion | Yes | Yes |
| Skill level growth (XP) | Yes | Yes (via predictions) |
| XP grinding on Normal tasks | Yes (highest zone down) | Yes (XP/energy efficiency sorted) |
| Perk skill modifiers | Yes | Yes |
| Energy perks (EnergySpell, etc.) | Yes | Yes |
| Energetic Memory (maxEnergy growth) | Yes | Yes |
| **Item collection** | No | Yes (itemCollection level) |
| **Item consumption (push/collect)** | No | Yes (pushCollect level) |
| **Scroll of Haste** | No | Yes (in simulator.js) |
| **Skill boost items** | No | Yes (priority 3 in queue) |
| **Boss tasks** | No | Yes (priority 4 in queue) |
| **Bottleneck skill analysis** | No | Yes (getBottleneckSkills) |
| **Prestige mechanics** | No | No |
| **Major Time Compression** | Partial | Yes |
| **Unified Theory of Magic** | No | Yes |

### Strategy Sophistication

**Cost Adjuster**: Uses a fixed minimal strategy. The simulated player:
1. Traverses zones (mandatory tasks)
2. Grinds remaining energy on Normal tasks (highest zone first)
3. Resets

There are no decisions — the player always does the same thing. This produces conservative cost values because it assumes the player uses no optimization.

**Auto Queue**: Uses configurable strategy levels with real decision-making:
1. **Baseline**: Same as cost adjuster + priority-based task ordering (perks first, then bosses)
2. **Item Collection**: Also picks up energy items and skill boost items along the route
3. **Push/Collect**: Decides each run whether to consume stockpiled items based on whether they could help reach a new zone

The auto queue also uses the live game's detailed state for grind task selection, considering:
- Bottleneck skills (skills needed for the next unreachable zone, weighted by distance)
- Skill deficit (under-leveled skills get priority)
- Item bonuses from task drops (items that boost bottleneck skills scored 2x)
- XP/energy efficiency (most efficient tasks selected first)

### Search vs Decision

The two algorithms use fundamentally different approaches:

**Cost Adjuster** uses **binary search**: Given a target reset count, search for the costMult value that produces that count. The answer is a number (the adjusted cost).

**Auto Queue** uses **priority-based greedy selection**: Given current state and energy budget, greedily select the most valuable actions until energy runs out. The answer is a sequence of actions.

### Shared Formulas

Both algorithms use the same underlying game math, but from different codebases:

| Formula | Cost Adjuster (`jtaCostGenerator.js`) | Auto Queue (`simulator.js`) |
|---------|---|---|
| Task base cost | `calcTaskBaseCost(task, zoneId, ctx)` | `calcTaskCost(task, zoneId)` |
| Progress multiplier | `calcProgressMult(task, zoneId, state, ctx)` | `calcProgressPerTick(task, zoneId, state)` |
| Energy drain | `calcDrainPerTick(task, zoneId, state, ctx)` | `calcEnergyDrainPerTick(task, zoneId, state)` |
| Task energy cost | `calcTaskEnergyCost(task, zoneId, state, ctx)` | `calcTaskEnergyCost(task, zoneId, state)` |
| XP per rep | `calcTaskXp(task, zoneId, state, ctx)` | `calcTaskXp(task, zoneId, state)` |
| XP to level | `calcXpNeeded(level, skillType, ctx)` | `calcXpNeeded(level, skillType)` |
| Zone mandatory cost | `calcZoneMandatoryCost(zoneId, state, ctx)` | `calcZoneMandatoryEnergyCost(zoneId, state)` |

The cost adjuster's versions are parameterized with a `ctx` object (from `loadGameDataFromJson`) so they work with arbitrary game data JSON. The auto queue's versions use the hardcoded `gameData.js` constants directly.

### The Gap Between Them

The cost adjuster assumes a weaker player than what the auto queue can achieve. This gap is intentional — it means the auto queue's optimizations give the player breathing room:

```
Cost adjuster assumes:     Traverse zones → grind Normal tasks → reset
Auto queue actually does:  Traverse zones → collect items → push with items → grind bottleneck skills → drain
```

If the cost adjuster were to model the auto queue's full strategy, costs would be higher (harder seeds). The planned strategy factor system (see `CC/docs/plans/partial/jta-strategy-and-apworld-plan.md` Part 3 — partially implemented) would bridge this gap by letting the cost adjuster layer in the same factors the auto queue uses.

---

## Shared Game Formulas

### Energy Cost Formula

```
baseCost = BASE_COST (10) * costMult * exponent^zoneId
  where exponent = 2.2 (normal tasks) or 4 (boss tasks)

ticks = ceil(baseCost / progressMultiplier)

drainPerTick = 1
  * 0.2  (if single-tick and has Minor Time Compression)
  * 0.8  (if has High Altitude Climbing)
  * 0.95^(highestZone - zoneId)  (if has Reflections on the Journey)
  * 1.05^zoneId  (zone scaling)

energyCost = ticks * drainPerTick * maxReps
```

### Progress Multiplier

```
progressMult = 1.0
  * geometricMean(1.01^skillLevel for each task skill)
  * product((1 + perkSkillModifier) for each perk and matching skill)
  * 1.05^zoneId  (zone speedup)
```

This captures the two main sources of player power: **skill levels** (grow continuously from XP) and **perk skill modifiers** (discrete bonuses from acquiring perks).

### XP Formula

```
xpPerRep = BASE_COST * costMult * exponent^zoneId * 8 * xpMult
  * 1.5  (if has Writing perk)
  * 1.25^zoneId  (zone scaling)

xpNeeded(level) = 1.02^level * 10 * skillXpMult
```

Skills level up when accumulated XP exceeds `xpNeeded`. Higher-zone tasks give more XP (exponentially), so reaching higher zones accelerates skill growth.

---

## CLI Usage

```bash
node scripts/jta/cost-adjust.js \
  --gamedata <randomized_gamedata.json> \
  --spherelog <sphere_log.jsonl> \
  --output <costs.json> \
  --resets-per-sphere 5 \
  --player 1 \
  --verbose
```

## APWorld Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `goal_zone` | Range 1-27 | 15 | Which zone the player must reach to win |
| `free_zones` | Range 1-15 | 1 | Zones at start requiring zero perks |
| `starting_perks` | Range 0-15 | 0 | Number of perks granted at start |
| `starting_perk_list` | ItemSet | empty | Specific starting perks (overrides count) |
| `resets_per_sphere` | Range 1-20 | 5 | Target resets between perk tasks |
| `costgen_*` | Toggle | on | Strategy factors (future use) |
| `automation_*` | Toggle | on | Automation unlocks (future use) |

## Files

| File | Purpose |
|------|---------|
| `frontend/modules/jta-randomizer/jtaCostGenerator.js` | Cost adjustment: `parseSphereLog()`, `adjustCosts()` |
| `frontend/modules/jta-randomizer/jtaGameDataLoader.js` | Converts JSON → simulator-compatible data format |
| `frontend/modules/jta-randomizer/simulator.js` | Full game simulator: formulas, zone progression, run simulation |
| `frontend/modules/jtaActionQueue/jtaQueueBuilder.js` | Auto queue: `buildQueueForStrategy()`, strategy levels |
| `frontend/modules/jtaActionQueue/jtaQueueExecutor.js` | Queue executor: drives actions via eventBus, polls completion |
| `frontend/modules/jtaActionQueue/jtaEnergyDrainStrategy.js` | Drain task selection when queue exhausted |
| `frontend/modules/jtaActionQueue/index.js` | Module entry: `_regenerateStrategyQueue()`, loadout management |
| `scripts/jta/cost-adjust.js` | Node.js CLI wrapper for cost adjustment |
| `worlds/jta/__init__.py` | APWorld: seed generation, perk placement, slot data |
| `worlds/jta/Options.py` | APWorld options (goal_zone, free_zones, starting_perks, etc.) |
| `worlds/jta/Rules.py` | Count-based zone access rules |
| `worlds/jta/Items.py` | Item definitions, filler for starting perks |
| `worlds/jta/game_data.py` | Game data helpers (perk lists, zone lists) |
