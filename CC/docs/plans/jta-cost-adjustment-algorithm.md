# JTA Cost Adjustment Algorithm

## Purpose

Journey to Ascension is an incremental/idle game where progression through zones requires accumulated energy from skill levels and perks. When perk placements are randomized by Archipelago, the original game's cost values may produce unplayable results — a critical perk might be placed on an impossibly expensive task, or the progression order might require the player to reach a high zone with none of the usual perks.

The cost adjustment algorithm modifies `costMult` and `xpMult` values on tasks so the randomized seed is completable within a target difficulty level (`resetsPerSphere`).

## Key Concepts

### Energy and Resets

The player starts each run with `maxEnergy` (initially 100). Completing tasks costs energy. When energy runs out, the player does an **energy reset**: skills and perks persist, items are lost, and the player starts a new run. Over many resets, skill levels grow (from XP), making tasks cheaper to complete.

A **reset** is the fundamental unit of play time. `resetsPerSphere` controls difficulty: lower values mean the player can reach each perk faster (easier), higher values mean more grinding. A minimum of 2 resets is enforced regardless of the setting.

### Zone Traversal

To reach a task in zone Z, the player must complete all mandatory and travel tasks in zones 0 through Z. This is the **zone traversal cost** — it's cumulative and grows exponentially with zone number because task base costs scale as `baseCost * costMult * 2.2^zoneId`.

### Zone Access Rules (APWorld)

The APWorld enforces count-based zone access restrictions so that the sphere log reflects roughly zone-ordered progression:

- Zone Z requires `max(0, Z - free_zones + 1 - starting_perks)` total unique perks
- `free_zones` (default 1): how many zones require zero perks before the ramp begins
- `starting_perks` (default 0): number of perks granted at start (actually precollected)
- `starting_perk_list`: optional explicit list of starting perks (overrides count)

This uses `state.has_from_list_unique(all_perks, player, count)` — any perks count, not specific ones. The result is that the sphere log shows perk tasks roughly in zone order rather than all in sphere 0.

### Sphere Log

The sphere log records the order in which Archipelago placed items. Each entry shows:
- **`sphere_locations`**: locations (tasks) the player must complete
- **`new_inventory_details.base_items`**: items (perks) the player receives

In multiworld games, tasks completed and perks received are independent:
- A JTA task might give an item for **another player** (not a JTA perk)
- A JTA perk might arrive from **another player's game**
- The player must still complete tasks in sphere log order
- Perks arrive in sphere log order regardless of source

## Algorithm Overview

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

## Detailed Mechanics

### Step 1a: Bottleneck Detection

Before adjusting a task, the algorithm tests whether the **zone itself** is the bottleneck:

1. Set the target task's costMult to 0.01 (nearly free)
2. Estimate resets needed to reach and complete the task
3. If `minResets <= targetResets`: zone is reachable — proceed with perk task adjustment
4. If `minResets > targetResets`: zone traversal is the bottleneck — apply zone adjustments

### Step 1b-i: Zone Traversal Adjustment

When zone traversal is the bottleneck, the algorithm reduces mandatory task costs along the path:

1. Collect all mandatory/travel tasks in zones 0..targetZoneId
2. Binary search (log-scale) for the **maximum** multiplier M in [0.0001, 1.0] such that the zone becomes reachable in `targetResets` resets
3. Apply `costMult = origCostMult * M` to all mandatory tasks
4. These reductions persist for future steps (later tasks benefit from cheaper traversal)

The search finds the **least reduction** needed — if M=0.3, mandatory costs are reduced to 30% of original, not more.

### Step 1b-ii: XP Boost Adjustment

If zone traversal adjustment alone isn't enough (zone still unreachable), the algorithm boosts XP rates:

1. Collect all tasks in zones 0..targetZoneId
2. Binary search (log-scale) for the **minimum** multiplier M in [1.0, 10000.0] such that the zone becomes reachable in `targetResets` resets
3. Apply `xpMult = origXpMult * M` to all tasks
4. These boosts persist for future steps (later tasks benefit from faster skill growth)

XP boosting accelerates skill level growth, which reduces task costs through the progress multiplier. This is the second lever when cost reduction alone can't make a zone reachable.

### Step 1c: Perk Task Cost Adjustment

For tasks where the zone is reachable, the algorithm binary-searches for a costMult that produces approximately `targetResets` resets:

1. **Too easy (< targetResets)**: search between `[currentCost, currentCost * 1000]`
2. **Very hard (>= 200 resets)**: search between `[0.01, currentCost]`
3. **In range**: estimate `newCost = currentCost * (target / actual)`, then search `[estimate/2, estimate*2]`

Each binary search uses log-scale iteration (25 iterations) for convergence across large costMult ranges.

### XP Grinding in Simulation

After zone traversal on each run, the simulated player spends remaining energy on **Normal tasks** for XP grinding:

- Grinds from the highest reached zone down (higher zones give exponentially more XP)
- Each Normal task completed applies XP to its associated skills
- This happens both in `simulateRun()` (state advancement) and `estimateResetsForTask()` (reset estimation)

This models a basic play strategy where the player doesn't just traverse zones but also grinds for skill levels, significantly improving accuracy for higher zones.

### Log-Scale Binary Search

All binary searches use logarithmic scale (`Math.log`/`Math.exp`) rather than arithmetic midpoints. This is essential because costMult values span many orders of magnitude (e.g., 0.01 to 600000). With arithmetic search, the first midpoint of [0.01, 600000] would be 300000 — far from the true answer. With log-scale, the first midpoint is ~77, converging much faster.

### Reset Estimation

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

### State Advancement Between Steps

After each sphere step, the algorithm simulates `resetsPerSphere` resets of play. Each reset:
1. Simulates a full run (zones 0 through highest reachable)
2. Completes mandatory tasks, applies XP
3. Grinds remaining energy on Normal tasks for additional XP
4. Does an energy reset (Energetic Memory may increase maxEnergy)

This advances the simulation state so that later steps have realistic skill levels.

### Data Sync

The algorithm works with two parallel representations of game data:
- **adjustedData**: the JSON clone used for output
- **ctx**: the simulation context created by `loadGameDataFromJson()`

These are separate object trees. After all adjustments, a sync step copies `costMult` and `xpMult` from ctx tasks back to adjustedData tasks so the output JSON reflects all changes.

## Adjustment Levers (in order of application)

| Lever | What it adjusts | When applied | Search direction |
|-------|----------------|--------------|-----------------|
| Zone traversal | `costMult` on mandatory/travel tasks in zones 0..Z | Zone unreachable after target resets | Maximum M (least reduction) |
| XP boost | `xpMult` on all tasks in zones 0..Z | Zone still unreachable after cost reduction | Minimum M (least boost) |
| Perk task cost | `costMult` on the target perk task | Zone reachable, task too easy or hard | Closest to target resets |

All adjustments persist across sphere steps — later tasks benefit from earlier zone cost reductions and XP boosts.

## What the Algorithm Does NOT Model

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

Future versions can layer strategy factors (item collection, push/collect, artifacts) to increase costs for players using advanced techniques.

## Known Limitations

### No Feedback Loop

Each task's costMult is adjusted independently. Adjusting one mandatory task's cost changes the zone traversal budget for all subsequent tasks, but the algorithm doesn't revisit earlier adjustments. A multi-pass approach could improve accuracy.

### XP Boost Compounding

XP boosts from earlier sphere steps compound with later ones. If zone 8 needed a 5x XP boost and zone 12 later needs a 20x boost, tasks in zones 0-8 end up with 100x XP. This is correct for making the seed completable but may feel unnatural to the player.

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
| `frontend/modules/jta-randomizer/jtaCostGenerator.js` | Core algorithm: `parseSphereLog()`, `adjustCosts()` |
| `frontend/modules/jta-randomizer/jtaGameDataLoader.js` | Converts JSON -> simulator-compatible data format |
| `scripts/jta/cost-adjust.js` | Node.js CLI wrapper |
| `worlds/jta/__init__.py` | APWorld: seed generation, perk placement, slot data |
| `worlds/jta/Options.py` | APWorld options (goal_zone, free_zones, starting_perks, etc.) |
| `worlds/jta/Rules.py` | Count-based zone access rules |
| `worlds/jta/Items.py` | Item definitions, filler for starting perks |
| `worlds/jta/game_data.py` | Game data helpers (perk lists, zone lists) |
