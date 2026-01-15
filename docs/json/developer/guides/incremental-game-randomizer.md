# Incremental Game Randomizer: Post-Hoc Cost Adjustment

## Overview

This document describes an approach to randomize incremental/idle games for Archipelago using **post-hoc cost adjustment** rather than traditional logic extraction. Instead of constraining item placement with access rules, we allow unrestricted placement and then adjust game parameters to make the resulting seed completable.

## Target Game: Journey to Ascension

**Repository:** https://github.com/meneth/journey-to-ascension/

Journey to Ascension is a TypeScript incremental game with clean, deterministic math that makes it ideal for this approach.

### Game Structure

| Component | Count | Description |
|-----------|-------|-------------|
| Zones | 20 | Linear progression through areas |
| Skills | 12 | Stats that level up and affect task speed |
| Perks | 28 | Permanent upgrades from completing tasks |
| Items | 31 | Consumables providing temporary boosts |
| Tasks | ~180 | Actions within zones (some grant perks) |

### Archipelago Mapping

| Archipelago | Journey to Ascension |
|-------------|---------------------|
| **Locations** | Tasks that grant perks (28) |
| **Items** | Perks (28) |
| **Regions** | Zones (20) |
| **Victory** | Complete final zone or reach prestige |

## Core Algorithm

### Traditional Approach (Not Used)
```
1. Extract logic rules: "Location X requires Items A, B, C"
2. Archipelago places items respecting rules
3. Seed is completable by construction
```

### Post-Hoc Cost Adjustment Approach
```
1. Archipelago places perks randomly (no logic)
2. Analyze resulting progression path
3. Calculate time-to-complete for each zone
4. Adjust cost_multiplier values to hit target times
5. Export adjusted parameters with seed
```

## Implementation Plan

### Phase 1: Data Extraction

**Goal:** Extract game data into JSON format for analysis.

**Tasks:**
1. Parse `zones.ts` to extract all tasks with:
   - Task ID, name, zone
   - `cost_multiplier`
   - Required skills
   - Granted perk (if any)
   - Granted item (if any)
   - Task type (Normal, Mandatory, Travel, Boss)

2. Parse `perks.ts` to extract all perks with:
   - Perk ID, name
   - Skill modifiers (skill → bonus multiplier)
   - Special effects (time compression, energy reduction, etc.)

3. Parse `skills.ts` to extract skill definitions:
   - Skill ID, name
   - XP multiplier

**Output:** `journey_to_ascension_data.json`

```json
{
  "zones": [
    {
      "id": 0,
      "name": "The Village",
      "tasks": [
        {
          "id": 10,
          "name": "Join the Watch",
          "type": "Travel",
          "cost_multiplier": 4,
          "skills": ["Charisma"],
          "perk": null,
          "item": null
        },
        {
          "id": 13,
          "name": "Learn How to Read",
          "cost_multiplier": 8,
          "skills": ["Study"],
          "perk": "Reading",
          "item": null
        }
      ]
    }
  ],
  "perks": [
    {
      "id": "Reading",
      "name": "How to Read",
      "skill_modifiers": {"Study": 0.5},
      "special_effects": []
    }
  ],
  "skills": [
    {"id": "Study", "name": "Study", "xp_mult": 1.0}
  ]
}
```

### Phase 2: Time Simulation

**Goal:** Build a simulator that calculates time to complete any zone given a set of perks.

**Core Formula (from `simulation.ts`):**

```python
def calc_task_cost(task, zone_id):
    BASE_COST = 10
    ZONE_EXPONENT = 2.2
    return BASE_COST * task.cost_multiplier * (ZONE_EXPONENT ** zone_id)

def calc_progress_per_tick(task, zone_id, skill_levels, perks, items_used):
    mult = 1.0

    # Skill level bonus (geometric mean for multi-skill tasks)
    skill_mult = 1.0
    for skill in task.skills:
        skill_mult *= (1.01 ** skill_levels[skill])
    mult *= skill_mult ** (1 / len(task.skills))

    # Perk bonuses
    for skill in task.skills:
        for perk in perks:
            mult *= (1 + perk.skill_modifiers.get(skill, 0))

    # Zone speedup
    ZONE_SPEEDUP = 1.05
    mult *= ZONE_SPEEDUP ** zone_id

    # Special perk effects
    if "MajorTimeCompression" in perks:
        mult *= 2.0  # MAJOR_TIME_COMPRESSION_EFFECT

    # Item bonuses (temporary)
    for skill in task.skills:
        for item, count in items_used.items():
            mult *= (1 + item.skill_modifiers.get(skill, 0) * count)

    return mult

def calc_task_ticks(task, zone_id, skill_levels, perks, items_used):
    cost = calc_task_cost(task, zone_id)
    progress = calc_progress_per_tick(task, zone_id, skill_levels, perks, items_used)
    return math.ceil(cost / progress)

def calc_task_time_seconds(task, zone_id, skill_levels, perks, items_used):
    TICK_RATE_MS = 66.6
    ticks = calc_task_ticks(task, zone_id, skill_levels, perks, items_used)
    return ticks * TICK_RATE_MS / 1000
```

**Simulator Features:**
- Calculate time for a single task
- Calculate time for an entire zone (all mandatory + travel tasks)
- Simulate skill XP gain and leveling during zone completion
- Track cumulative time across zones

**Output:** Python module `jta_simulator.py`

### Phase 3: Cost Adjustment Algorithm

**Goal:** Given a random perk placement, compute adjusted `cost_multiplier` values.

**Algorithm:**

```python
def adjust_costs(seed_placement, target_zone_time=300):
    """
    seed_placement: dict mapping task_id -> perk_id (which perk is at which location)
    target_zone_time: target seconds per zone (tunable difficulty)

    Returns: dict mapping task_id -> adjusted_cost_multiplier
    """
    adjustments = {}
    current_perks = set()
    skill_levels = {skill: 0 for skill in SKILLS}

    for zone in ZONES:
        # Determine which perks player will have after this zone
        zone_perks = [seed_placement[t.id] for t in zone.perk_tasks]

        # Calculate time to complete zone with current perks
        zone_time = simulate_zone_time(zone, skill_levels, current_perks)

        # Calculate adjustment ratio
        if zone_time > target_zone_time:
            ratio = target_zone_time / zone_time
        else:
            ratio = 1.0  # Don't make it harder (optional: could increase)

        # Apply ratio to all tasks in zone
        for task in zone.tasks:
            original = task.cost_multiplier
            adjusted = original * ratio

            # Clamp to reasonable bounds
            adjusted = max(adjusted, original * 0.01)  # No more than 100x easier
            adjusted = min(adjusted, original * 10)    # No more than 10x harder

            adjustments[task.id] = adjusted

        # Update state for next zone
        current_perks.update(zone_perks)
        skill_levels = simulate_skill_gains(zone, skill_levels, current_perks)

    return adjustments
```

**Tunable Parameters:**
- `target_zone_time`: How long each zone should take (default: 300 seconds)
- `min_adjustment`: Minimum multiplier (prevent trivializing, default: 0.01)
- `max_adjustment`: Maximum multiplier (prevent impossibility, default: 10)
- `boss_adjustment_cap`: Special cap for boss tasks (default: 0.1)

### Phase 4: Archipelago World Integration

**Goal:** Create an Archipelago world that generates seeds and exports adjusted parameters.

**File Structure:**
```
worlds/journey_to_ascension/
├── __init__.py          # Main world class
├── Items.py             # Perk definitions as AP items
├── Locations.py         # Perk-granting tasks as AP locations
├── Regions.py           # Zones as AP regions
├── Options.py           # Player options (difficulty, etc.)
├── Rules.py             # Empty (no logic restrictions)
├── Simulator.py         # Time simulation module
├── CostAdjuster.py      # Cost adjustment algorithm
└── data/
    └── game_data.json   # Extracted game data
```

**World Class:**

```python
class JourneyToAscensionWorld(World):
    game = "Journey to Ascension"

    option_definitions = {
        "target_zone_time": Range(60, 600, 300),
        "difficulty_variance": Range(0, 100, 20),  # % variance allowed
    }

    def create_regions(self):
        # Create Menu -> Zone 0 -> Zone 1 -> ... -> Zone 19 -> Victory
        for i, zone in enumerate(ZONES):
            region = Region(zone.name, self.player, self.multiworld)
            for task in zone.perk_tasks:
                region.locations.append(
                    JTALocation(self.player, task.name, task.id, region)
                )
            self.multiworld.regions.append(region)

    def create_items(self):
        for perk in PERKS:
            item = JTAItem(perk.name, ItemClassification.progression, perk.id, self.player)
            self.multiworld.itempool.append(item)

    def set_rules(self):
        # No rules! All locations accessible from start
        pass

    def generate_output(self, output_directory):
        # After fill, compute cost adjustments
        placement = {loc.address: loc.item.code for loc in self.multiworld.get_locations(self.player)}
        adjustments = adjust_costs(placement, self.options.target_zone_time.value)

        # Export to JSON
        output = {
            "seed": self.multiworld.seed,
            "placement": placement,
            "cost_adjustments": adjustments,
        }

        filename = f"AP_{self.multiworld.seed}_jta.json"
        with open(os.path.join(output_directory, filename), 'w') as f:
            json.dump(output, f, indent=2)
```

### Phase 5: Game Client/Mod

**Goal:** Modify the game to load randomizer data and apply adjustments.

**Approach Options:**

**Option A: Game Mod (Preferred)**
- Create a mod/patch that loads `AP_SEED_jta.json` at game start
- Override `cost_multiplier` values from the JSON
- Display "which perk is at which task" in the UI
- Send/receive items via Archipelago connection

**Option B: Standalone Tracker**
- Don't modify the game at all
- Create external tracker showing "go do Task X to get Perk Y"
- Player manually marks items as collected
- Less integrated but simpler to implement

**Mod Implementation (TypeScript):**

```typescript
// randomizer.ts - loaded before game start

interface RandomizerData {
    seed: number;
    placement: Record<number, string>;  // task_id -> perk_name
    cost_adjustments: Record<number, number>;  // task_id -> new_cost_mult
}

let randomizerData: RandomizerData | null = null;

export function loadRandomizerData(data: RandomizerData) {
    randomizerData = data;
    applyAdjustments();
}

function applyAdjustments() {
    if (!randomizerData) return;

    for (const zone of ZONES) {
        for (const task of zone.tasks) {
            if (randomizerData.cost_adjustments[task.id]) {
                task.cost_multiplier = randomizerData.cost_adjustments[task.id];
            }
        }
    }
}

// Hook into task completion to grant randomized perk
export function onTaskComplete(task: TaskDefinition) {
    if (!randomizerData) return;

    const assignedPerk = randomizerData.placement[task.id];
    if (assignedPerk) {
        // Grant the randomized perk instead of the original
        const perkType = PerkType[assignedPerk as keyof typeof PerkType];
        tryAddPerk(perkType);

        // Send to Archipelago server
        sendItemToServer(assignedPerk);
    }
}
```

### Phase 6: Testing & Validation

**Goal:** Verify seeds are completable and balanced.

**Test Suite:**

1. **Simulation Accuracy Tests**
   - Compare simulator predictions against actual game runs
   - Acceptable error margin: ±20%

2. **Seed Completability Tests**
   - Generate 100 random seeds
   - Simulate each to verify completion time < threshold
   - Target: 100% completable

3. **Balance Tests**
   - Verify no zone takes >2x target time
   - Verify no zone takes <0.5x target time (too easy)
   - Check that boss tasks remain challenging

4. **Edge Case Tests**
   - All perks in last zone (worst case)
   - All perks in first zone (best case)
   - Specific perk combinations that could break balance

**Validation Script:**

```python
def validate_seed(seed_data):
    results = {
        "completable": True,
        "total_time": 0,
        "zone_times": [],
        "warnings": [],
    }

    for zone in ZONES:
        zone_time = simulate_zone(zone, seed_data)
        results["zone_times"].append(zone_time)
        results["total_time"] += zone_time

        if zone_time > MAX_ZONE_TIME:
            results["warnings"].append(f"Zone {zone.name} takes {zone_time}s (max: {MAX_ZONE_TIME})")

        if zone_time < MIN_ZONE_TIME:
            results["warnings"].append(f"Zone {zone.name} too easy: {zone_time}s")

    if results["total_time"] > MAX_TOTAL_TIME:
        results["completable"] = False

    return results
```

## Timeline and Milestones

| Phase | Description | Deliverables |
|-------|-------------|--------------|
| 1 | Data Extraction | `game_data.json` |
| 2 | Time Simulation | `jta_simulator.py` with tests |
| 3 | Cost Adjustment | `adjust_costs()` function |
| 4 | AP World | Working world generating seeds |
| 5 | Game Client | Mod loading randomizer data |
| 6 | Testing | Validation suite, 100 tested seeds |

## Configuration Options

**Player-Facing Options (in YAML):**

```yaml
Journey to Ascension:
  # Target time per zone in seconds
  target_zone_time:
    300  # 5 minutes per zone

  # Allow variance in zone times (%)
  difficulty_variance:
    20  # Zones can be 80%-120% of target

  # Special handling for boss tasks
  boss_difficulty:
    normal  # normal, easier, harder

  # Include prestige perks in randomization
  include_prestige:
    false  # Start without prestige perks randomized
```

## Known Limitations

1. **Prestige System**: Initial implementation excludes prestige mechanics. Future work could randomize prestige unlocks.

2. **Consumable Items**: Items that provide temporary boosts are not randomized. Could add as future enhancement.

3. **Energy System**: Cost adjustment affects energy efficiency. May need additional energy tuning for edge cases.

4. **Multiplayer**: Initial implementation is single-player only. Multiworld would require additional synchronization.

## Future Enhancements

1. **Logic Mode**: Add optional "logic mode" that restricts placement based on simulated progression (hybrid approach).

2. **Dynamic Difficulty**: Adjust costs in real-time based on player performance.

3. **Item Randomization**: Randomize which tasks grant which consumable items.

4. **Prestige Randomization**: Include prestige upgrades in the item pool.

5. **Race Mode**: Optimized settings for competitive play.

## Appendix: Key Game Formulas

### Task Cost
```
cost = 10 × cost_multiplier × (2.2 ^ zone_id)
```

### Progress Per Tick
```
progress = skill_mult × perk_mult × zone_speedup × special_effects

skill_mult = (∏(1.01 ^ skill_level)) ^ (1/num_skills)
perk_mult = ∏(1 + perk_bonus) for each relevant perk
zone_speedup = 1.05 ^ zone_id
```

### Task Time
```
ticks = ceil(cost / progress)
time_seconds = ticks × 0.0666  # 66.6ms per tick
```

### Skill XP Gain
```
xp = progress × 8 × task.xp_mult × zone_scaling × perk_bonuses
zone_scaling = 1.25 ^ zone_id
```

### Skill Level Up
```
xp_needed = (1.02 ^ level) × 10 × skill.xp_mult
```
