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

---

## Next Steps

### 1. Shared Action Queue Module

A game-agnostic action queue system that works with JTA, Idle Loops, and future games. Separates common queue logic from game-specific logic. Can be used as a wrapper to add an action queue to games that don't have one.

For JTA, this bypasses the game's built-in task automation system, providing explicit control over all actions including task execution, item usage, and artifact usage.

#### Architecture

```
+-----------------------------------------------------------------+
|  Shared Queue Core (game-agnostic)                               |
|  frontend/modules/shared/actionQueue/                            |
|                                                                  |
|  queueState.js        Queue data structures, manipulation ops    |
|  queueEngine.js       Execution loop: process current[], advance |
|  loadouts.js          Multiple saved queues, auto-advance        |
|  queuePanelUI.js      Shared UI: queue list, controls, loadouts  |
|  actionsPanelUI.js    Shared UI: clickable action button grid    |
+-----------------------------------------------------------------+
         |                              |
   Game-Specific Adapters         Game-Specific Adapters
         |                              |
+------------------+          +--------------------+
| JTA Adapter      |          | Idle Loops Adapter |
| jtaActions.js    |          | (future)           |
| jtaExecutor.js   |          |                    |
| jtaQueuePanel/   |          | loopsQueuePanel/   |
+------------------+          +--------------------+
```

#### Queue Data Structures

**Queue entry:**
```javascript
{
    actionType,    // Game-specific string ('task', 'useItem', 'useArtifact', etc.)
    actionId,      // Game-specific identifier (task ID, item type, etc.)
    loops,         // Number of times to perform this action
    disabled,      // Skip this entry when executing
    entryId,       // Unique ID for drag-and-drop / stable identity
}
```

**Queue state (shared):**
```javascript
{
    current: [],       // Actions being executed this run
    next: [],          // Queued actions for next run
    currentPos: 0,     // Index in current[] being executed
    addAmount: 1,      // How many loops to add per click (1, 5, 10, custom)
}
```

**Queue operations (shared):**
- Add action (at bottom, at top, or at specific position)
- Remove action
- Reorder (move up/down, drag-and-drop)
- Adjust loop count (+/-, split)
- Disable/enable individual entries
- Clear queue
- Undo last change

#### Loadout System

Multiple saved queues with auto-advance, enabling multi-reset strategies.

**Use case:** Farm items for N resets, then push with items for 1 reset:
1. Loadout A: "Farm Items" - grind early zones, collect consumables
2. Loadout B: "Push Zone" - use items + attempt highest zone

**Data structure:**
```javascript
{
    loadouts: [
        { name: "Farm Items", actions: [...] },
        { name: "Push Zone", actions: [...] },
    ],
    activeLoadout: 0,
    autoAdvance: true,       // Switch to next loadout on queue completion
    loopCounts: [3, 1],      // Run each loadout N times before advancing
}
```

**Loadout operations:** Save, Load, Rename, Delete, Reorder

#### Queue Panel UI (shared)

Two-section display following the Idle Loops pattern:

1. **Current Actions** - Actions executing in this run
   - Progress bar per action
   - Completed / total loop counter
   - Highlight on currently executing action

2. **Next Actions** - Queued for next run
   - Ordered list with drag-and-drop reordering
   - Per-entry: action icon, name, loop count, control buttons
   - Controls: +loops, -loops, split, disable, move up/down, remove
   - Amount selector: 1 / 5 / 10 / custom

3. **Queue Controls** - Start, pause, clear, loadout management

#### Actions Panel UI (shared)

Clickable buttons for every available action, organized by category. All buttons are always enabled (validity is not tracked here). Clicking adds the action to the queue with the current add-amount.

Game adapters provide the action list and categories.

#### Energy Drain / Run Completion

In JTA, energy resets happen automatically when energy runs out - they are not a deliberate action. The queue needs strategies for what to do when queued actions finish but energy remains:

**Energy drain strategies (configurable per loadout):**
- **Most energy-draining tasks** - Run tasks with highest energy drain per tick to trigger reset quickly
- **Highest XP tasks** - Run tasks that give the most XP to maximize skill leveling before reset
- **Specific task** - Repeat a user-chosen task

Note: There is no idle energy drain in JTA. Energy only depletes while tasks are being performed, so a task must always be running to eventually trigger a reset.

#### JTA-Specific Adapter

**Action types for JTA:**

| Action Type | Description | Notes |
|-------------|-------------|-------|
| `task` | Perform a task in a zone | Core action. Travel tasks auto-navigate to next zone. |
| `useItem` | Use a consumable item | ScrollOfHaste, Book, MagicRing, etc. |
| `useArtifact` | Use an artifact | When available |
| `prestige` | Trigger prestige | When available |

Note: There is no "move to zone" action. Zone progression is forward-only via Travel tasks. Once you leave a zone, you cannot return until the next energy reset returns you to zone 0.

**Actions panel categories for JTA:**
- Tasks grouped by zone, with collapsible zone headers
- Items section
- Artifacts section
- Special actions (prestige, zone navigation)

**JTA executor (`jtaExecutor.js`):**
- Sends commands to the JTA iframe via eventBus
- Listens for game events (zone change, energy reset, perk change, task completion)
- On energy reset: loads next[] into current[], applies energy drain strategy if needed

#### Idle Loops Reference

The Idle Loops codebase (`omsi-loops/`) has an existing queue system to study:
- `omsi-loops/actions.js` - Queue state (`current[]`, `next[]`, zone spans)
- `omsi-loops/actionList.js` - Action definitions with stats, skills, town assignments
- `omsi-loops/views/main.view.js` - D3.js queue rendering with drag-and-drop
- `omsi-loops/driver.js` - Queue manipulation (add, remove, reorder, split, disable)
- `omsi-loops/saving.js` - 16-slot loadout system with save/load/rename

Key patterns to adopt:
- Two-list display: current (executing) + next (queued)
- Per-action loop counts with +/- buttons
- Zone-based action grouping
- Drag-and-drop reordering
- Loadout save/load/rename
- "Keep current list" vs "load next list" on reset

### 2. Game Configuration System

All game data is defined in a JSON configuration file. The Archipelago randomizer assembles randomized data into a JSON file with the same format. The JTA wrapper replaces all internal game data with this configuration.

#### Configuration Format

A JSON file that describes all game data, including data that will be kept static and data that may be randomized:

```javascript
{
    "version": "0.5.0",
    "meta": {
        "gameName": "Journey to Ascension",
        "theme": "fantasy-ascension"      // Optional re-theming identifier
    },

    // All names are configurable for re-theming
    "skills": [
        { "id": 0, "name": "Strength", "xpMult": 1.0 },
        { "id": 1, "name": "Dexterity", "xpMult": 1.0 },
        // ...
    ],

    "perks": [
        { "id": 0, "name": "HighAltitudeClimbing", "skillModifiers": { ... } },
        // ...
    ],

    "items": [
        { "id": 0, "name": "ScrollOfHaste", "effect": "...", "duration": 60 },
        // ...
    ],

    "zones": [
        {
            "id": 0,
            "name": "The Foothills",
            "tasks": [
                {
                    "id": 0,
                    "name": "Gather Herbs",
                    "type": "normal",
                    "skills": [0, 1],
                    "costMult": 1.0,
                    "xpMult": 1.0,
                    "maxReps": 10,
                    "perk": null,
                    "item": null
                },
                // ...
            ]
        },
        // ...
    ],

    "prestige": { /* prestige unlock and repeatable definitions */ },

    // Randomization settings
    "randomization": {
        "perkPlacement": true,       // Shuffle which tasks grant which perks
        "itemPlacement": false,      // Shuffle item drops
        "withinSphereOrder": true,   // Randomize order within each sphere
        "taskNames": false,          // Randomize task names (for re-theming)
        "skillNames": false,         // Randomize skill names (for re-theming)
    }
}
```

#### Re-theming Support

Everything is changeable: task names, skill names, zone names, perk names. An example alternate configuration could re-theme JTA based on an existing Archipelago game (e.g., re-theme zones as Zelda dungeons, skills as Zelda items, etc.).

#### Data Flow

```
1. Static config JSON (original game data)
   |
   v
2. Archipelago randomizer (perk placement, cost adjustment)
   |
   v
3. Randomized config JSON (same format, shuffled placements + adjusted values)
   |
   v
4. JTA wrapper receives config via frontend
   |
   v
5. jta:patchTaskDefs replaces all internal game data
```

### 3. Cost Generation Algorithm

Uses the same approach as the Loops game cost generator (`frontend/modules/loops/costGenerator.js`). The Archipelago spoiler log determines the intended progression order. Costs are calculated exactly from the known formulas - no guessing or iterative adjustment needed.

#### Core Approach

1. Archipelago generates a spoiler log with sphere-ordered location checks
2. The cost generator plays through the sphere log in order
3. For each task that needs to be completable, calculate the exact `cost_multiplier` (and potentially `xp_mult`) that makes it achievable within the target number of resets

#### Algorithm

```
Input:
  - Sphere log (ordered list of location checks)
  - Game configuration (task definitions, formulas)
  - Settings:
    - resetsPerSphere: how many resets between first being able to complete
      one sphere's tasks and the next sphere's tasks
    - enabledStrategies: which strategies the cost-setting playthrough may use

Output:
  - Adjusted cost_multiplier per task
  - Adjusted xp_mult per task (if needed for skill grinding sufficiency)

Algorithm:
  1. Initialize simulation state (fresh game, no perks, no items)
  2. For each fractional sphere in the spoiler log:
     a. Determine which perks are now available (from previous spheres)
     b. Determine which stats need to be grindable to complete the target tasks
     c. Simulate `resetsPerSphere` resets of grinding with enabled strategies
     d. After grinding, calculate the player's expected stats
     e. For each target task in this sphere:
        - Calculate progress_per_tick from the expected stats (known formula)
        - Calculate energy_drain_per_tick (known formula)
        - Calculate available energy budget per reset
        - Solve for cost_multiplier:
            cost = ticks_per_rep * progress_per_tick
            ticks_per_rep = cost / progress_per_tick
            energy_per_rep = ticks_per_rep * drain_per_tick
            Set cost_multiplier so energy_per_rep fits within budget
        - Check if completing the task produces enough XP for skill progression
        - If not, adjust xp_mult so that grinding this task levels the
          relevant skills sufficiently
     f. Apply granted perks to simulation state
     g. Optionally randomize order within the sphere
  3. Output adjusted configuration
```

#### Key Insight: Exact Calculation

Since all formulas are known and deterministic, we can solve for the exact `cost_multiplier` that makes a task completable within a budget:

```
Given:
  progress_per_tick = f(skill_levels, perks, zone, prestige)  -- known
  drain_per_tick = g(perks, prestige, zone)                   -- known
  energy_budget = max_energy * resets_available               -- configured

Want: task completable within energy_budget

  ticks_needed = cost / progress_per_tick
  energy_needed = ticks_needed * drain_per_tick
  energy_needed <= energy_budget

  cost / progress_per_tick * drain_per_tick <= energy_budget
  cost <= energy_budget * progress_per_tick / drain_per_tick

  cost = 10 * cost_multiplier * (exponent ^ zone_id)
  cost_multiplier <= energy_budget * progress_per_tick / drain_per_tick / (10 * exponent ^ zone_id)
```

Similarly, for XP sufficiency:
```
  xp_per_rep = progress_per_tick * 8 * xp_mult * ticks_per_rep * perk_mults * (1.25 ^ zone_id)
  xp_needed = sum of xp_to_level for target skill levels
  reps_available = energy_budget / energy_per_rep

  Solve: xp_per_rep * reps_available >= xp_needed
  If not achievable with current xp_mult, increase xp_mult
```

#### Configurable Strategies

The cost generator has settings for which strategies are enabled during the cost-setting playthrough. This affects what the "expected stats" look like after N resets:

| Strategy | Description | Effect on Cost |
|----------|-------------|----------------|
| Item farming | Farm items in early zones before pushing | Higher stats, lower costs needed |
| Prestige usage | Use prestige bonuses | Higher multipliers, lower costs |
| Optimal task order | Always do highest XP task first | More efficient leveling |
| Conservative | Only basic grinding, no items | Higher costs needed (easier seeds) |

Disabling strategies produces seeds that require less optimization from the player.

#### Comparison with Loops Cost Generator

The Loops cost generator (`frontend/modules/loops/costGenerator.js`) uses a similar sphere-log-driven approach:
- Processes each location in sphere order
- Assigns costs based on current resource budget (`currentMana / 2`)
- Runs actual game mechanics for validation
- Resets between entries

For JTA, the key differences:
- Resources are energy + skill levels instead of mana + XP
- Costs can be calculated exactly from formulas instead of using budget fractions
- Multiple values may need adjustment (cost_multiplier + xp_mult) not just one cost
- Energy resets and item retention add complexity to budget calculation

### 4. Randomizer Integration

Connects the randomizer to the live game via the existing write access infrastructure.

#### Flow

```
1. Player starts new game with seed
2. Randomizer loads the configuration JSON (with randomized placements + adjusted costs)
3. Apply via jta:patchTaskDefs (remap perks, items, costs, xp_mults)
4. Intercept task completions:
   - Task grants randomized perk (not original)
   - Report location check to Archipelago
5. Receive items from Archipelago:
   - Grant received perks via jta:patchGameState
```

#### Adapting the Queue During Play

One queue configuration won't complete the whole game. As stats change and perks are unlocked, the queue must adapt. Approaches:

- **Per-sphere queues:** Loadouts correspond to spheres. When a sphere's tasks are completable, switch to that sphere's loadout.
- **Reactive adjustment:** The queue engine monitors game state and adjusts the queue (add new tasks that are now efficient, remove tasks that are no longer useful).
- **Manual + assisted:** Player manages queues manually, but the system suggests changes based on current stats and available perks.

#### New Events (Randomizer <-> Game)

| Event | Purpose |
|-------|---------|
| `jta:taskCompleted` | Game reports task completion (for location checks) |
| `jta:grantPerk` | Randomizer grants a perk to the player |
| `jta:seedApplied` | Confirm seed patches are active |

### Future Enhancements

1. **Item Randomization**: Randomize consumable item drops across tasks
2. **Prestige Randomization**: Include prestige upgrades in the item pool
3. **Dynamic Difficulty**: Real-time cost adjustment based on player progress
4. **Multiworld Support**: Connect to Archipelago server for multiplayer
5. **Idle Loops Integration**: Apply the same randomizer approach to Idle Loops, reusing the shared queue module
6. **Re-themed Seeds**: Alternate configurations that re-theme JTA as other games
