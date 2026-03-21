# JTA Strategy System & APWorld Plan

## Overview

This plan covers two interconnected systems:

1. **APWorld (`worlds/jta/`)** — An Archipelago world for Journey to Ascension that randomizes perk placement and uses post-hoc cost adjustment to make the resulting seed completable.

2. **Composable Strategy System** — A refactor of the current fixed-strategy queue builder into a layered system where individual strategy factors can be toggled on/off. These factors are Archipelago options because they affect cost generation: the cost generator assumes the player will use the enabled strategies, so enabling more factors produces harder (higher-cost) seeds.

### Relationship to Other Plans

- **incremental-game-randomizer.md** — High-level architecture for JTA randomization. This plan implements the APWorld and cost adjustment pieces.
- **jta-queue-ui-plan.md** — UI features for the action queue. This plan refactors the queue builder logic that feeds into that UI.

---

## Part 1: APWorld Design

### Game Mapping

| Archipelago Concept | JTA Equivalent | Notes |
|---|---|---|
| **Locations** | Perk-granting tasks (in zones before goal zone) | Tasks with `perk !== null` |
| **Items** | Perks | Permanent progression upgrades |
| **Regions** | Zones | Linear chain: zone 0 → zone 1 → ... → goal zone |
| **Victory** | Reach the goal zone | Configurable, default zone 15 |

### Dynamic Scope

The number of items and locations depends on the `goal_zone` setting. Only perks that appear on tasks in zones 0 through `goal_zone - 1` are included. Tasks in the goal zone and beyond are not randomized.

Approximate counts (will vary by goal zone):
- Zone 0-14 (default goal=15): ~25-30 perk locations
- Zone 0-26 (goal=27, full game): ~40 perk locations

Hidden tasks (unlocked by defeating bosses) that grant perks are included as locations, but only if they're in zones before the goal zone. Their boss unlock prerequisite is preserved as an access rule.

### Options

```python
class GoalZone(Range):
    """Which zone the player must reach to win."""
    display_name = "Goal Zone"
    range_start = 1
    range_end = 27  # 27 = all zones completed
    default = 15

class GameDataFile(FreeText):
    """Path to an alternative base game data JSON file.
    If empty (default), uses the built-in jta_game_data.json.
    Path is relative to the Archipelago root directory."""
    display_name = "Game Data File"
    default = ""

class ResetsPerSphere(Range):
    """Target number of energy resets the player must grind before their
    stats are high enough to reach the next perk unlock.
    Higher values = harder seeds (more grinding required between spheres).
    Lower values = easier seeds (less grinding needed).
    Affects cost generation: tasks are costed so that the player needs
    approximately this many resets of XP grinding before progressing."""
    display_name = "Resets Per Sphere"
    range_start = 1
    range_end = 20
    default = 5

# --- Strategy Factors (Cost Generation) ---
# These factors control what the cost generator assumes the player will do
# during its simulation. They affect seed difficulty by changing the assumed
# play strength, which determines task costs.
# Enabling more factors → cost generator assumes stronger play → higher costs.
# These are SEPARATE from the automation unlocks below, which control what
# the player can actually do during gameplay.

class CostGenItemCollection(DefaultOnToggle):
    """Cost generator assumes the player collects items during runs
    and uses them for energy/skill boosts.
    When disabled, costs are set as if the player ignores item-dropping tasks."""
    display_name = "Cost Gen: Item Collection"

class CostGenPushCollect(DefaultOnToggle):
    """Cost generator assumes the player alternates between collection runs
    (save items) and push runs (consume all items at start, plus any items
    collected during the push run).
    Requires Item Collection to be enabled."""
    display_name = "Cost Gen: Push/Collect Alternation"

class CostGenGrindWithPushCollect(DefaultOnToggle):
    """Cost generator assumes the player applies push/collect alternation
    to XP grinding runs, not just progression runs.
    Requires Push/Collect Alternation."""
    display_name = "Cost Gen: Grind with Push/Collect"

class CostGenArtifacts(DefaultOnToggle):
    """Cost generator assumes the player uses artifacts strategically:
    - ScrollOfHaste on expensive perk/boss tasks
    - MagicRing on high-XP grinding tasks
    - BottledLightning on boss tasks
    When disabled, costs are set as if the player ignores artifacts."""
    display_name = "Cost Gen: Artifact Usage"

# --- Automation Unlocks ---
# Controls which automation features the frontend makes available.
# Default: all unlocked. Disabling makes the game more manual/harder.

class AutomationAutoQueue(DefaultOnToggle):
    """Allow the queue to auto-generate from strategy.
    When disabled, the player must manually build every queue."""
    display_name = "Automation: Auto Queue"

class AutomationAutoReset(DefaultOnToggle):
    """Allow automatic energy reset (prestige) when energy is depleted.
    When disabled, the player must manually trigger resets."""
    display_name = "Automation: Auto Reset"

class AutomationDrainStrategy(DefaultOnToggle):
    """Allow automatic task selection when the queue is exhausted but energy remains.
    When disabled, energy is wasted if the queue finishes early."""
    display_name = "Automation: Drain Strategy"

class AutomationLoadoutSequencing(DefaultOnToggle):
    """Allow loadouts to automatically chain (run loadout A 3 times, then loadout B).
    When disabled, the player must manually switch loadouts."""
    display_name = "Automation: Loadout Sequencing"
```

### Regions and Access Rules

Zones form a linear chain. Each zone is a region:

```
Zone 0 (The Village)
  → Zone 1 (The Village Watch)
    → Zone 2 (The Raid)
      → Zone 3 (The Wilderness)
        → ...
          → Zone N-1
            → Zone N (goal zone, victory)
```

Access rules are simple:
- Zone 0: always accessible
- Zone N (N > 0): requires zone N-1 to be accessible

No perk-based access rules on zones. The cost generator handles making zone progression energy-viable given the perks the player has at each point.

Boss-gated hidden tasks have an additional rule:
- Hidden task location: requires the corresponding boss task to be completable (same zone accessible)

### Locations

Each perk-granting task in zones 0 through `goal_zone - 1` becomes a location:

```python
# Example locations (zone 0):
"Learn How to Read"       # task 13, zone 0, grants a perk
# Example locations (zone 1):
"Learn How to Write"      # task 27, zone 1, grants a perk
# Example locations (zone 2):
"Rescue Villager"         # task 34, zone 2, grants a perk
"Save the Village"        # task 37, zone 2, hidden (boss-gated), grants a perk
# etc.
```

Location names use the task name directly. Region assignment matches the zone.

### Items

Each perk becomes an Archipelago item:

```python
# Example items:
"How to Read"             # PerkType.Reading
"How to Write"            # PerkType.Writing
"Villager Gratitude"      # PerkType.VillagerGratitude
"Mysterious Amulet"       # PerkType.Amulet
# etc.
```

Item names use the perk's display name from `PERKS[perkType].name`.

All perk items are classified as `progression` since any perk can contribute to reaching the goal zone (via skill modifiers, energy bonuses, time compression, etc.).

### Victory Condition

The `completion_condition` checks whether the player has reached the goal zone. In practice, this is reported by the frontend when the game reaches that zone.

### Game Data JSON

The APWorld includes a static JSON file (`worlds/jta/jta_game_data.json`) containing the complete, unmodified game data from JTA v0.5.0. This file mirrors the structure of `gameData.js`, using the same numeric IDs and field names so the frontend can directly replace the game's internal data with it. An alternative base data file can be specified via the `game_data_file` option.

The JSON file contains:
- **skills** — Skill type IDs, names, XP multipliers
- **perks** — Perk type IDs, names, skill modifiers, special effects
- **items** — Item type IDs, names, energy values, skill modifiers, artifact flags
- **zones** — Zone IDs, names, and complete task arrays (each task has id, name, type, costMult, skills, xpMult, maxReps, perk, item, hidden)
- **prestige** — Prestige unlock types, repeatable types, constants
- **constants** — Game formula constants (HASTE_MULT, ZONE_COST_EXPONENT, etc.)
- **bossUnlocks** — Boss task ID → hidden task ID mapping

Format uses numeric IDs matching the game's enums:
```json
{
    "version": "0.5.0",
    "skills": [
        { "id": 0, "name": "Charisma", "xpMult": 1 },
        { "id": 1, "name": "Study", "xpMult": 1 },
        { "id": 2, "name": "Combat", "xpMult": 5 }
    ],
    "perks": {
        "0": { "name": "How to Read", "skillModifiers": { "1": 0.5 }, "special": null },
        "1": { "name": "How to Write", "skillModifiers": {}, "special": "xp_bonus_50" }
    },
    "items": {
        "0": { "name": "Food", "energy": 5, "skillModifiers": {} },
        "7": { "name": "ScrollOfHaste", "energy": null, "skillModifiers": {}, "artifact": true }
    },
    "zones": [
        {
            "id": 0, "name": "The Village",
            "tasks": [
                { "id": 10, "name": "Join the Watch", "type": 1, "costMult": 4,
                  "skills": [0], "xpMult": 1, "maxReps": 1, "perk": null, "item": null },
                { "id": 13, "name": "Learn How to Read", "type": 0, "costMult": 8,
                  "skills": [1], "xpMult": 0.5, "maxReps": 1, "perk": 0, "item": null }
            ]
        }
    ],
    "bossUnlocks": { "36": 37, "57": 58 },
    "constants": {
        "baseCost": 10, "zoneCostExponent": 2.2, "bossCostExponent": 4,
        "zoneSpeedupBase": 1.05, "skillLevelExponent": 1.01, "skillXpExponent": 1.02,
        "startingEnergy": 100, "hasteMult": 5, "magicRingMult": 5,
        "bottledLightningMult": 2
    }
}
```

### Seed Output Pipeline

Seed generation produces three files in a pipeline:

```
1. jta_game_data.json (default, in worlds/jta/; overridable via game_data_file option)
   │  Original unmodified game data
   │
   ├──► APWorld randomization (generate_output)
   │
2. AP_[SEED_ID]_gamedata.json (in preset dir)
   │  Randomized game data (perk placements shuffled, etc.)
   │
   ├──► Cost adjustment tool (JS, via Node.js CLI or frontend)
   │
3. AP_[SEED_ID]_costs.json (in preset dir)
      Cost-adjusted game data (costMult/xpMult values modified)
```

**File 1: Original game data** (`worlds/jta/jta_game_data.json` or custom path via `game_data_file`)
- Default file is static, checked into git
- Complete JTA v0.5.0 game data in JSON format
- Source of truth; extracted once from `gameData.js`
- Can be overridden with the `game_data_file` option to use alternative base data

**File 2: Randomized game data** (`AP_[SEED_ID]_gamedata.json`)
- Output by `JTAWorld.generate_output()` during seed generation
- Same format as the original, but with modifications applied:
  - Perk assignments shuffled (task.perk values changed)
  - Future: item drops shuffled, task names/costs changed, etc.
- Written alongside `_rules.json` and `_sphere_log.jsonl` in the preset directory

**File 3: Cost-adjusted game data** (`AP_[SEED_ID]_costs.json`)
- Output by the cost adjustment tool (see Part 2)
- Same format as file 2, but with costMult and xpMult values adjusted
- This is the final file the frontend loads and applies to the game

**Slot data** (`fill_slot_data`) continues to include `perkPlacements` for backward compatibility and for the Archipelago server to track item placements. It also includes all options (goalZone, resetsPerSphere, costGenFactors, automation):

```json
{
    "game": "Journey to Ascension",
    "version": "0.5.0",
    "goalZone": 15,
    "resetsPerSphere": 5,
    "costGenFactors": { "itemCollection": true, ... },
    "automation": { "autoQueue": true, ... },
    "perkPlacements": { "13": "High Altitude Climbing", "27": "Attunement", ... }
}
```

---

## Part 2: Cost Adjustment

### Purpose

Since JTA has no traditional access rules (zone access is energy/stat-gated, not item-gated), the cost generator makes the randomized perk placement actually work. It adjusts `costMult` values so that:

1. Tasks in earlier spheres are completable with the stats available at that point
2. The pacing matches the `resetsPerSphere` setting
3. The enabled strategy factors are accounted for (more factors → player is stronger → costs can be higher)

### Algorithm

```
Input:
  - Randomized perk placements (from Archipelago fill)
  - Goal zone
  - Resets per sphere (target number of grinding resets)
  - Enabled cost generation strategy factors

Output:
  - Adjusted costMult per task (may go up or down)
  - Adjusted xpMult per task (when boosting XP is better than lowering cost)

Process:
  1. Determine sphere ordering from the fill
     (which perks are placed at which locations, in which zones)
  2. Initialize simulation state (fresh game)
  3. For each sphere tier (group of zones at the same depth):
     a. Determine which perks the player has (from previous spheres)
     b. Simulate `resetsPerSphere` resets of play using the enabled strategy factors
     c. After simulation, calculate expected player stats
     d. For each task the player must complete to reach the perk task
        (mandatory tasks, travel tasks, AND the perk task itself):
        - If the simulator completes the task BEFORE the target number
          of resets, INCREASE costMult to match the target pacing
        - If the simulator CANNOT complete the task within the target
          resets, DECREASE costMult to make it achievable
        - If a prerequisite task is the bottleneck (player is stuck on
          a mandatory/travel task before reaching the perk task),
          adjust that prerequisite's cost rather than only the perk task
        - In some cases, boosting xpMult on an earlier task (to accelerate
          skill leveling) is better than lowering costMult on the blocking
          task — the algorithm should consider both approaches
     e. Apply newly acquired perks to simulation state
  4. Output adjusted costMult and xpMult values for all affected tasks
```

### Where Cost Adjustment Runs

**Decision: JavaScript (via Node.js CLI and frontend)**

The simulator formulas (~2000 lines) already exist in `simulator.js`. Rather than duplicating them in Python, the cost adjustment tool is implemented in JavaScript and can be run two ways:

1. **Node.js CLI** — For batch processing and automated testing. Reads the randomized game data JSON + sphere log, runs the cost adjustment algorithm using the existing simulator, and outputs the cost-adjusted game data JSON.

2. **Frontend** — For interactive use. The user loads a seed, runs cost adjustment in the browser, and the adjusted game data is applied to the live game.

Both share the same core cost adjustment code. The CLI tool uses Node.js directly (or Playwright if browser APIs are needed). The frontend runs the same code in the browser context.

### CLI Tool

```
node scripts/jta/cost-adjust.js \
    --gamedata frontend/presets/jta/AP_[SEED_ID]/AP_[SEED_ID]_gamedata.json \
    --spherelog frontend/presets/jta/AP_[SEED_ID]/AP_[SEED_ID]_sphere_log.jsonl \
    --output frontend/presets/jta/AP_[SEED_ID]/AP_[SEED_ID]_costs.json \
    --resets-per-sphere 5 \
    --factors itemCollection,pushCollect,xpGrinding,grindWithPushCollect,artifacts
```

The CLI tool:
1. Loads the randomized game data JSON and sphere log
2. Initializes the simulator with fresh game state
3. Walks the sphere log in order, applying the cost adjustment algorithm
4. Writes the cost-adjusted game data JSON to the output path

### Frontend Tool

The frontend cost adjustment tool is triggered when a JTA seed is loaded:
1. Load the randomized game data JSON from the preset directory
2. Apply the game data to the JTA iframe via `jta:patchTaskDefs`
3. Run cost adjustment using the simulator
4. Write the cost-adjusted game data JSON
5. Re-apply the adjusted game data to the iframe

The frontend also provides a manual "Run Cost Adjustment" button for re-running with different settings.

---

## Part 3: Composable Strategy System

### Current State

The queue builder (`jtaQueueBuilder.js`) has 4 fixed strategies:
- `AUTO` — decides between push/collect based on item stockpile
- `PUSH` — consume all items, then progress + grind
- `COLLECT` — save items, progress + grind
- `GRIND_XP` — focus on XP farming

Each strategy generates a complete queue from scratch. There's no way to selectively enable/disable behaviors.

### New Architecture

Replace fixed strategies with a composable factor system. The base behavior is the simplest possible queue (direct sphere progression), and each factor layers additional sophistication.

```
┌─────────────────────────────────────────────────────────┐
│  Strategy Config (from AP seed)                         │
│  { factors: { itemCollection, pushCollect, ... } }      │
│  { sphereLog: [ { zone, taskId, perkType }, ... ] }     │
└──────────────────────┬──────────────────────────────────┘
                       │
                       v
┌─────────────────────────────────────────────────────────┐
│  Queue Builder                                          │
│                                                         │
│  1. Base: buildSphereProgressionQueue()                  │
│     → mandatory + travel + perk task for next sphere     │
│                                                         │
│  2. +itemCollection: addItemCollectionTasks()            │
│     → insert item-dropping tasks along the route         │
│                                                         │
│  3. +pushCollect: wrapWithPushCollectPattern()           │
│     → split into collect runs and push runs              │
│                                                         │
│  4. +xpGrinding: addGrindingTasks()                     │
│     → append grinding when can't reach next sphere       │
│                                                         │
│  5. +grindWithPushCollect: applyPushCollectToGrinding()  │
│     → alternate collect/push during grinding phase       │
│                                                         │
│  6. +artifacts: insertArtifactUsage()                    │
│     → add artifact consumption at optimal points         │
└─────────────────────────────────────────────────────────┘
```

### Factor Details

#### Base: Direct Sphere Progression (always active)

Given the sphere log and current game state, queue exactly the tasks needed to reach the next unchecked perk location:

1. Look up the next perk location in the sphere log that hasn't been checked
2. Determine which zone it's in
3. Queue: mandatory tasks in zone 0 → travel task in zone 0 → mandatory tasks in zone 1 → travel task in zone 1 → ... → mandatory tasks in zone N → perk task
4. On energy reset, the player returns to zone 0 and must traverse all zones again (though zones with trivially low costs can be fast-forwarded through)

This is the minimal viable queue. Without any factors, the player grinds stats purely by repeating this sequence across energy resets until they're strong enough.

#### Factor: Item Collection

When enabled, the queue builder also queues item-dropping tasks that are along the route (in zones being traversed). Items are used immediately upon collection (consume energy items for energy, consume skill-boost items for stat bonuses).

This makes runs more efficient because:
- Energy items extend the run
- Skill-boost items accelerate task completion

#### Factor: Push/Collect Alternation

When enabled, runs alternate between two modes:

**Collect run:**
- Do NOT consume any items at start
- Queue the same progression tasks, collecting items along the way
- Items accumulate across collect runs (halved on energy reset with UnderstandingTheReset perk)

**Push run:**
- Consume ALL stockpiled items at the start of the run
- This gives a large energy and stat boost
- Also consume any items collected during the push run immediately
- Use the boosted state to push further than a collect run could

The queue builder tracks a `runMode` flag that alternates. The loadout system handles this via sequencing: loadout A (collect) × N → loadout B (push) × 1.

Decision logic for when to push (mirrors `simulateRun`):
- Push when items could help reach a new zone (items + energy >= 90% of cost to next new zone)
- Push when items are "ripe" (item energy >= 20% of max energy)
- Otherwise collect

#### Factor: Grind with Push/Collect

When enabled AND push/collect is active, the push/collect alternation pattern applies to grinding phases too:
- Collect runs: grind + collect items
- Push runs: consume items + grind with boosted stats

This is more efficient for XP grinding because:
- Skill-boost items multiply XP gains
- Energy items allow longer grinding sessions

#### Factor: Artifact Usage

When enabled, the queue builder inserts artifact consumption at strategic points:

| Artifact | Strategy |
|---|---|
| ScrollOfHaste | Use before the most expensive task in the queue (typically perk or boss tasks). 5x speed = 5x energy savings. |
| MagicRing | Use before the highest-XP grinding task. 5x XP multiplier. |
| BottledLightning | Use before boss tasks. 2x speed on bosses. |
| Dreamcatcher | Use strategically (implementation TBD based on exact effect). |

### Sphere Log Integration

The queue builder needs to know the intended progression order. This comes from the sphere log generated during seed creation.

The sphere log is an ordered list of perk locations:
```json
[
    { "sphere": 0, "taskId": 13, "zoneId": 0, "perkType": 5 },
    { "sphere": 0, "taskId": 27, "zoneId": 1, "perkType": 0 },
    { "sphere": 1, "taskId": 34, "zoneId": 2, "perkType": 11 },
    { "sphere": 1, "taskId": 43, "zoneId": 3, "perkType": 7 },
    ...
]
```

The queue builder tracks which sphere entries have been completed (perk received) and targets the next uncompleted entry.

### Refactoring Plan

The current `jtaQueueBuilder.js` functions map to the new system:

| Current | New |
|---|---|
| `buildPushQueue()` | Base + itemCollection + pushCollect(push mode) + xpGrinding + artifacts |
| `buildCollectQueue()` | Base + itemCollection + pushCollect(collect mode) + xpGrinding |
| `buildGrindXpQueue()` | Base + xpGrinding |
| `buildAutoQueue()` | Replaced by factor composition |
| `planZoneProgression()` | Refactored into base + factor layers |
| `planXpGrinding()` | Becomes the xpGrinding factor |
| `wouldAutoPush()` | Becomes part of pushCollect factor decision logic |

The `StrategyType` enum is replaced by a `StrategyConfig` object:
```javascript
// Old:
{ type: StrategyType.AUTO }

// New:
{
    sphereLog: [...],
    currentSphereIndex: 0,
    factors: {
        itemCollection: true,
        pushCollect: true,
        xpGrinding: true,
        grindWithPushCollect: true,
        artifacts: true,
    }
}
```

### Loadout Generation

Strategy-backed loadouts are generated based on the factor configuration:

**Without push/collect:**
- Single loadout: `[Progression]` — runs base + enabled factors, infinite repeat

**With push/collect:**
- Two loadouts: `[Collect]` × N, `[Push]` × 1, chained in sequence
- N is determined dynamically (default 3 collect runs per push, adjustable)

**With grind + push/collect for grinding:**
- Four loadouts: `[Collect-Progress]`, `[Push-Progress]`, `[Collect-Grind]`, `[Push-Grind]`
- Sequencing: collect-progress × N → push-progress × 1, then if grinding needed: collect-grind × N → push-grind × 1

---

## Part 4: Implementation Plan

### Phase 1: APWorld Skeleton — DONE

Created the basic world package with options, regions, locations, items, and victory condition.

**Files created:**
```
worlds/jta/
    __init__.py      — JTAWorld class
    Items.py         — Perk items from game_data
    Locations.py     — Perk-granting task locations from game_data
    Regions.py       — Zone regions, linear chain
    Rules.py         — Zone access (linear), boss-gated hidden tasks
    Options.py       — All options defined above
    game_data.py     — Static game data (zones, tasks, perks) extracted from gameData.js
```

**Validated:** Seed generation works with `python Generate.py --weights_file_path "Templates/Journey to Ascension.yaml" --multi 1 --seed 1`. Perk placements are randomized. Slot data includes perkPlacements, options, and all configuration.

### Phase 1b: Game Data JSON Pipeline

Add the full game data JSON file and the `generate_output()` method that writes randomized game data.

**Step 1: Create `jta_game_data.json`**
- Extract complete game data from `gameData.js` into JSON format
- Include all zones (with all tasks), skills, perks, items, prestige, constants, boss unlocks
- Use numeric IDs matching the game's enums (same format as JS)
- File location: `worlds/jta/jta_game_data.json`

**Step 2: Add `generate_output()` to JTAWorld**
- Load base game data from `game_data_file` option (if set) or built-in `jta_game_data.json`
- Apply randomized perk placements (modify task.perk values according to the fill)
- Write modified game data to `AP_[SEED_ID]_gamedata.json` in the preset directory
- The existing exporter pipeline handles rules.json and sphere_log.jsonl separately

**Step 3: Frontend game data loading** ✅
- `jtaGameDataLoader.js`: `loadGameDataFromJson()` converts JSON → simulator-compatible format, `buildTaskPatches()` generates iframe patch arrays, `loadGameDataFromUrl()` fetches and loads
- `jtaGameClient.js`: Added `jta:replaceGameData` event that applies complete zones data to the live game via TASK_LOOKUP
- Loader output verified against hardcoded gameData.js (1491 assertions, all pass)

**Validation:** Generate a seed. Verify `AP_[SEED_ID]_gamedata.json` is created alongside `_rules.json`. Load in frontend and verify the game runs with the patched data.

### Phase 2: Cost Adjustment Tool (JavaScript)

Implement the cost adjustment algorithm in JavaScript, usable from both Node.js CLI and frontend.

**Step 1: Core cost adjustment module** ✅
- `jtaCostGenerator.js`: `parseSphereLog()` extracts ordered steps (handles multiworld), `adjustCosts()` walks steps and binary-searches costMult per task
- Re-implements key simulator formulas (calcTaskCost, calcProgressMult, calcTaskXp, etc.) parameterized with game data context from `jtaGameDataLoader.js`
- Handles multiworld: tasks completed and perks received are independent events from the sphere log
- Pure function: game data + sphere log + options → adjusted game data + log
- Known v1 limitations: doesn't adjust mandatory task costs (only perk tasks), simplified perk effects (no items/artifacts/prestige), high-zone tasks may hit reset cap when zone traversal is the bottleneck

**Step 2: Node.js CLI wrapper** ✅
- `scripts/jta/cost-adjust.js`: reads gamedata JSON + sphere log, runs cost adjustment, writes output
- Options: `--resets-per-sphere`, `--player`, `--verbose`
- Produces summary with per-task adjustment details

**Step 3: Frontend integration**
- Add "Run Cost Adjustment" button to JTA Game Data panel
- Loads randomized game data from preset directory
- Runs cost adjustment in browser
- Writes cost-adjusted game data JSON
- Applies adjusted data to the live game

**Validation:** Run CLI tool on a generated seed. Verify the output costs JSON has modified costMult values. Load in frontend and verify the game is completable with the adjusted costs.

### Phase 3: Strategy Factor Refactor

Refactor `jtaQueueBuilder.js` from fixed strategies to composable factors.

1. Add `buildSphereProgressionQueue(simState, sphereLog, sphereIndex)` — base behavior
2. Refactor item collection, push/collect, artifacts as layered functions
3. Replace `StrategyType` with `StrategyConfig` containing factor flags
4. Update `generateStrategyLoadouts()` to generate loadouts based on factor config
5. Update `index.js` to read factor config from seed data instead of hardcoded strategies

**Validation:** Existing queue functionality works with all factors enabled (equivalent to current AUTO behavior). Disabling all factors produces minimal sphere-progression-only queues.

### Phase 4: Frontend Integration

Wire the APWorld seed data into the existing frontend systems.

1. Load cost-adjusted game data JSON from preset directory
2. Apply complete game data to JTA iframe via `jta:patchTaskDefs`
3. Configure queue builder with strategy factors from seed
4. Intercept perk grants → report location checks to Archipelago
5. Receive items from Archipelago → grant perks via `jta:patchGameState`

### Future Phases

- **Item randomization** — Shuffle consumable item drops across tasks
- **Prestige randomization** — Include prestige unlocks in the item pool
- **Re-theming** — Change task/skill/zone names for alternate themes
- **Python cost generator** — Port simulator to Python for deterministic seeds (if needed)
- **Additional strategy factors** — Prestige-aware strategies, zone-skipping, etc.
- **Difficulty presets** — Named combinations of options (Easy/Normal/Hard/Expert)

---

## Appendix: Game Data Reference

### Zones (27 total)

| ID | Name | Notable Tasks |
|---|---|---|
| 0 | The Village | Reading perk, Food items |
| 1 | The Village Watch | Writing perk, Arrow items |
| 2 | The Raid | VillagerGratitude perk, Boss: Goblin Warlord → VillageHero |
| 3 | The Wilderness | Amulet perk, EnergySpell perk |
| 4 | The Cave System | ExperiencedTraveler perk, UndergroundConnection perk |
| 5 | The Road to the City | MinorTimeCompression perk |
| 6 | City Outskirts | HighAltitudeClimbing perk |
| 7 | The City | Attunement perk, Boss-gated perks |
| 8 | The Forest | GoblinScourge perk |
| 9 | The Magician | SunkenTreasure perk, LostTemple perk |
| 10 | The Ocean | WalkWithoutRhythm perk |
| 11 | The Island | ReflectionsOnTheJourney perk |
| 12 | The Desert | PurgedBureaucracy perk, DeepSeaDiving perk |
| 13 | The Oasis | EnergeticMemory perk, TheWorm perk |
| 14 | The Ritual | TowerOfBabel perk, Awakening perk |
| 15 | The Dream | MajorTimeCompression perk, HideInPlainSight perk, DreamPrism perk |
| 16 | The Metropolis | DragonKillingPlan perk, UnifiedTheoryOfMagic perk |
| 17 | The Foothills | Headmaster perk |
| 18 | Dragon's Lair | DragonSlayer perk |
| 19 | Place of Power | UnderstandingTheReset perk, OvercameFearOfSkydiving perk |
| 20 | The Sky | DestroyedTheRing perk, GazedBeyondTheVeil perk |
| 21 | The Volcano | UndergroundForge perk, UnderstandingLeviathan perk |
| 22 | The Underworld | PurgedDemonicInfluences perk, DefiedTheGods perk |
| 23 | The Depths | SurvivedTheVoid perk |
| 24 | The Deep Deep | CommunedWithDamnedSouls perk |
| 25 | The Void | DivinePower perk |
| 26 | Return | (endgame) |

### Perks with Special Effects

These perks have gameplay effects beyond skill modifiers, making them particularly impactful when randomized:

| Perk | Effect | Impact |
|---|---|---|
| Amulet | Enables automation | Major QoL |
| EnergySpell | +50 max energy | Direct power increase |
| MinorTimeCompression | 0.2x energy drain on single-tick tasks | Significant efficiency |
| HighAltitudeClimbing | 0.8x energy drain | Always-on efficiency |
| Attunement | Enables attunement multiplier | Scaling power |
| ReflectionsOnTheJourney | Reduced drain in earlier zones | Farming efficiency |
| MajorTimeCompression | 1.5x progress, 1.5x drain | Net efficiency for multi-tick |
| EnergeticMemory | Zone-based energy bonus | Exploration incentive |
| UnifiedTheoryOfMagic | Scaling bonus from zone completion | Late-game power |
| UnderstandingTheReset | Items halved on reset instead of lost | Item retention |
| GazedBeyondTheVeil | 2x XP | Major XP boost |
| Writing | 1.5x XP | Significant XP boost |
