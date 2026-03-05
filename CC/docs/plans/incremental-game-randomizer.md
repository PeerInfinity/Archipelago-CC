# Incremental Game Randomizer: Post-Hoc Cost Adjustment

## Overview

This document describes an approach to randomize incremental/idle games for Archipelago using **post-hoc cost adjustment** rather than traditional logic extraction. Instead of constraining item placement with access rules, we allow unrestricted placement and then adjust game parameters to make the resulting seed completable.

## Target Game: Journey to Ascension

**Repository:** https://github.com/meneth/journey-to-ascension/
**Game version:** v0.5.0

Journey to Ascension is a TypeScript incremental game with clean, deterministic math that makes it ideal for this approach.

### Game Structure

| Component | Count | Description |
|-----------|-------|-------------|
| Zones | 27 | Linear progression through areas (0-26) |
| Skills | 10 | Stats that level up and affect task speed (+ 2 removed placeholders) |
| Perks | ~41 | Permanent upgrades from completing tasks |
| Items | ~40 | Consumables providing temporary boosts |
| Tasks | 239 | Actions within zones (some grant perks/items) |
| Prestige | 2 layers | Permanent unlocks + repeatable bonuses |

### Archipelago Mapping

| Archipelago | Journey to Ascension |
|-------------|---------------------|
| **Locations** | Tasks that grant perks |
| **Items** | Perks |
| **Regions** | Zones |
| **Victory** | Complete final zone or reach prestige |

## Architecture

### Implemented System

```
+-----------------------------------------------------------------+
|                    Archipelago-CC Frontend                        |
|                                                                  |
|  +---------------------------+  +----------------------------+   |
|  |   jta-randomizer/         |  |   jtaGameDataPanel/        |   |
|  |   gameData.js             |  |   index.js                 |   |
|  |   simulator.js            |  |   jtaGameDataPanelUI.js    |   |
|  |   jtaSimComparison.js     |  |   (Simulator Comparison UI)|   |
|  |   jta-instant-mode-       |  +----------------------------+   |
|  |     wrapper.js            |                                   |
|  +---------------------------+                                   |
|                |                                                 |
|           eventBus + postMessage (IframeClient)                  |
|                |                                                 |
|  +---------------------------+                                   |
|  |   jta-remote/ (iframe)    |                                   |
|  |   index-iframe.html       |                                   |
|  |   jtaGameClient.js        |                                   |
|  |   game-bundle/ (14 files) | <-- Local patched build of JTA   |
|  +---------------------------+                                   |
+-----------------------------------------------------------------+
```

### Key Files

| File | Purpose | Status |
|------|---------|--------|
| `frontend/modules/jta-randomizer/gameData.js` | Game data: zones 0-26, skills, perks, items, prestige types, boss unlocks | Done (v0.5.0) |
| `frontend/modules/jta-randomizer/simulator.js` | Full game simulation: formulas, energy resets, zone progression | Done (v0.5.0) |
| `frontend/modules/jta-randomizer/jta-instant-mode-wrapper.js` | Instant-mode task completion for fast simulation | Done (v0.5.0) |
| `frontend/modules/jta-randomizer/jtaSimComparison.js` | Converts live game state to simulator format, runs formula comparisons | Done |
| `frontend/modules/jta-remote/index-iframe.html` | Iframe host for JTA game with pre-bundle hooks | Done |
| `frontend/modules/jta-remote/jtaGameClient.js` | Iframe-side client: state read/write, task def patching | Done |
| `frontend/modules/jta-remote/game-bundle/` | Local patched build of JTA (exposes ZONES, TASK_LOOKUP, resetTasks) | Done |
| `frontend/modules/jtaGameDataPanel/index.js` | Module registration for JTA Game Data panel | Done |
| `frontend/modules/jtaGameDataPanel/jtaGameDataPanelUI.js` | UI: connection status, game state, event log, save editor, simulator comparison | Done |
| `journey-to-ascension/game.ts` | Patched game entry point (window.ZONES, TASK_LOOKUP, resetTasks; DOMContentLoaded fix) | Done (source, gitignored) |

## Communication Protocol

### Events: Parent -> Game (iframe)

| Event | Purpose | Payload |
|-------|---------|---------|
| `jta:requestState` | Request summary state snapshot | `{}` |
| `jta:requestDetailedState` | Request full state for simulator comparison | `{}` |
| `jta:requestGameDefs` | Request zone/task definition data | `{}` |
| `jta:patchGameState` | Mutate runtime state | Partial state object (see below) |
| `jta:patchTaskDefs` | Mutate task definitions | `{ patches: [...], resetTasks? }` |
| `jta:exportSave` | Export localStorage save | `{}` |
| `jta:importSave` | Import save and reload | `{ saveJson }` |

### Events: Game (iframe) -> Parent

| Event | Purpose | Payload |
|-------|---------|---------|
| `jta:stateSnapshot` | Summary state response | `{ state, timestamp }` |
| `jta:detailedStateSnapshot` | Full state for comparison | `{ state, timestamp }` |
| `jta:gameDefsSnapshot` | Zone/task definitions | `{ zones, timestamp }` |
| `jta:gameStatePatched` | Confirm state patch applied | `{ changes, timestamp }` |
| `jta:taskDefsPatched` | Confirm task defs patched | `{ patched, notFound, timestamp }` |
| `jta:saveExported` | Save data | `{ saveJson, timestamp }` |
| `jta:zoneChanged` | Player changed zones | `{ previousZone, currentZone, highestZone }` |
| `jta:energyReset` | Player performed energy reset | `{ resetCount }` |
| `jta:prestige` | Player prestiged | `{ prestigeCount }` |
| `jta:perkChanged` | Perk count changed | `{ perkCount }` |

## Write Access

### Runtime State Patching (`jta:patchGameState`)

Accepts a partial state object. Only provided fields are modified:

```javascript
eventBus.publish('jta:patchGameState', {
    currentEnergy: 500,
    maxEnergy: 200,
    currentZone: 3,
    highestZone: 5,
    highestZoneFullyCompleted: 4,
    skills: { 1: { level: 50, xp: 0 } },  // skillType -> data
    perks: [0, 1, 7, 23],                   // replaces entire perk set
    items: { 7: 3, 8: 1 },                  // itemType -> count
    power: 100,
    attunement: 50,
    prestigeUnlocks: [0, 1],                 // replaces unlock set
    prestigeRepeatables: { 0: 3 },           // type -> level
    queuedScrollsOfHaste: 2,
    resetTasks: true,                        // rebuild current zone tasks
});
```

### Task Definition Patching (`jta:patchTaskDefs`)

Mutates task definitions by ID. Changes propagate immediately (perks/items read at completion time, skills read each tick):

```javascript
eventBus.publish('jta:patchTaskDefs', {
    patches: [
        { id: 13, perk: 5 },                    // Change which perk task 13 grants
        { id: 14, item: 8, maxReps: 20 },       // Change item drop and rep count
        { id: 20, skills: [0, 3], costMult: 2 }, // Change skill requirements and cost
    ],
    resetTasks: true,  // default: true; rebuilds current zone tasks
});
```

This works because:
- `window.TASK_LOOKUP` (exposed by our patched game.ts) maps task ID -> TaskDefinition
- TaskDefinition fields are plain mutable properties (no freezing/sealing)
- The game reads `task.task_definition.perk` at completion time, `.item` at rep completion, `.skills` each tick
- `resetTasks()` creates new Task objects from the (now-mutated) ZONES data

## Simulator Comparison

The JTA Game Data panel includes a "Simulator Comparison" section that:

1. Requests detailed game state from the iframe (`jta:requestDetailedState`)
2. Converts it to simulator format via `gameStateToSimState()` in `jtaSimComparison.js`
3. Runs simulator formulas for each task in the current zone
4. Displays a table with: task cost, progress/tick, ticks, energy drain/tick, energy/rep, XP/rep
5. Supports auto-refresh on zone change

This validates that our simulator formulas match the real game's behavior.

## Implemented Formulas (v0.5.0)

### Task Cost
```
cost = 10 * cost_multiplier * (exponent ^ zone_id)
exponent = 4 for Boss tasks, 2.2 for all others
```

### Progress Per Tick
```
progress = skill_mult * perk_mult * attunement * prestige * zone_speedup * compression * special

skill_mult = (product(1.01 ^ skill_level for each skill)) ^ (1/num_skills)
perk_mult = product(1 + perk.skillModifiers[skill]) for each skill, each owned perk
attunement = (1 + attunement_value / 1000) -- applied once even for multi-skill tasks (anti-stacking)
prestige = GottaGoFast(1.1 ^ level) * MandatorySchmandatory(1 + level * 0.2) for mandatory/travel/prestige
zone_speedup = 1.05 ^ zone_id
compression = 1.5 if MajorTimeCompression perk owned
special = UnifiedTheory((1 + 0.02) ^ (highestZoneFullyCompleted + 1))
```

### Energy Drain Per Tick
```
drain = 1.0
if single_tick && MasteryOfTime prestige: return 0
if single_tick && MinorTimeCompression: drain *= 0.2
if HighAltitudeClimbing: drain *= 0.8
if ReflectionsOnTheJourney: drain *= base ^ (highestZone - zoneId)
  base = 0.9 with LookInTheMirror prestige, else 0.95
drain *= 1.05 ^ zone_id
if !single_tick && MajorTimeCompression: drain *= 1.5
```

### XP Per Rep
```
xp = progress_per_tick * 8 * task.xp_mult * ticks_per_rep
if Writing perk: xp *= 1.5
if GazedBeyondTheVeil perk: xp *= 2
xp *= 1.25 ^ zone_id
if MagicRing active: xp *= 5
```

### Skill Level Up
```
xp_needed = 1.02 ^ level * 10 * skill_xp_mult
```

### Item Retention on Energy Reset
```
Without UnderstandingTheReset perk: all items -> 0
With UnderstandingTheReset: items -> ceil(count / 2)
With CompulsiveNotetaking prestige: NOTE_ITEMS guaranteed >= 2
  NOTE_ITEMS = [ScrollOfHaste, Book, CraftingRecipe, DivineNotes, GriffinQuill]
```

## Local Game Build

The JTA game source is in `journey-to-ascension/` (gitignored). We maintain a patched `game.ts` that exposes `ZONES`, `TASK_LOOKUP`, and `resetTasks` on `window`, and fixes `DOMContentLoaded` timing for dynamic imports.

The compiled output is copied to `frontend/modules/jta-remote/game-bundle/` (14 JS files, tracked in git). The iframe loads the local build instead of the remote GitHub Pages version, so our patches take effect.

To rebuild after changes to the game source:
```bash
cd journey-to-ascension
npx tsc
cp build/*.js ../frontend/modules/jta-remote/game-bundle/
rm -f ../frontend/modules/jta-remote/game-bundle/eslint.config.js
```

## Next Steps

### Cost Adjustment Module (Not Yet Implemented)

The core randomizer algorithm that:
1. Generates random perk-to-task placements
2. Runs the simulator to check if the placement is beatable
3. Adjusts `cost_multiplier` values to hit target zone completion times
4. Validates the adjusted seed is completable within time bounds

### Randomizer Integration (Not Yet Implemented)

- Perk placement randomization with seeded RNG
- Task definition patching to apply randomized placements to the live game
- Interception of perk granting (task completion grants randomized perk, not original)
- Location check reporting for Archipelago multiworld

### Future Enhancements

1. **Item Randomization**: Randomize consumable item drops across tasks
2. **Prestige Randomization**: Include prestige upgrades in the item pool
3. **Dynamic Difficulty**: Real-time cost adjustment based on player progress
4. **Multiworld Support**: Connect to Archipelago server for multiplayer
