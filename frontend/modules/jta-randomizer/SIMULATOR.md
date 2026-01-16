# Journey to Ascension Simulator

This document explains the logic used by the JtA baseline simulator to model game progression.

## Overview

The simulator models a "smart player" progressing through Journey to Ascension, an incremental game where:
- Players complete tasks to gain skill XP and progress through zones
- Energy depletes as tasks are performed
- When energy runs out, players "reset" and start over with accumulated skill levels
- Progression requires reaching Zone 15 (The Dream)

The simulator's purpose is to establish baseline reset counts for reaching each zone and completing each task, which informs the randomizer's cost adjustment system.

## Game Mechanics Modeled

### Energy System
- **Starting energy**: 100
- **Energy drain**: 1 per tick, modified by perks and zone
- **Energy reset**: When energy hits 0, player resets with skills/perks retained
- **Items**: Food items provide energy; items persist at 50% across resets

### Skills
12 skills with different XP multipliers (higher = slower to level):

| Skill | XP Multiplier |
|-------|---------------|
| Charisma, Study, Search, Subterfuge, Crafting, Survival, Travel | 1x |
| Magic | 3x |
| Combat | 5x |
| Fortitude | 10x |
| Druid | 20x |
| Ascension | 1000x |

**Leveling formula**: `XP needed = 1.02^level * 10 * skillMult`

**Progress bonus**: `1.01^level` speed multiplier per skill level

### Zones
16 zones (0-15), each containing:
- **Mandatory tasks**: Must complete to unlock Travel task
- **Travel task**: Advances to next zone
- **Normal tasks**: Optional (perks, items, XP farming)
- **Boss tasks**: High-cost optional challenges
- **Hidden tasks**: Unlocked by special conditions (not simulated)

**Zone cost scaling**: `2.2^zoneId` multiplier on all task costs

### Tasks
Each task has:
- `costMult`: Base cost multiplier
- `skills`: Array of skills used (affects speed and XP)
- `xpMult`: XP gain multiplier
- `maxReps`: Repetitions needed for completion
- `perk`: Optional perk granted on completion
- `item`: Optional item granted per rep

## Simulation Strategy

### Run Types
The simulator alternates between two run types:

**Collect Run**: Gather items without consuming them
- Used when items wouldn't help reach a new zone
- Items accumulate across resets (50% retention)

**Push Run**: Consume all items at start for maximum energy
- Triggered when items could help reach a new zone
- Or when items exceed 20% of max energy (prevent decay waste)

### Priority System (per run)
Each run, the simulator makes decisions in priority order:

#### Priority 1: Unlock Perks
- Find all perk-granting tasks in reachable zones
- Sort by total energy needed (cheapest first)
- Complete if affordable

#### Priority 2: Collect Items (collect runs only)
- Find all item-granting tasks in reachable zones
- Sort by net energy value
- Collect if affordable

#### Priority 3: Advance Zones
- Complete mandatory tasks for all reachable zones
- This naturally progresses through zones as skills improve

#### Priority 4: Farm Skills
- Identify bottleneck skills for future zones
- Farm tasks that train those skills efficiently
- Fall back to best XP/energy tasks if no bottlenecks

### Bottleneck Detection

The simulator looks ahead 5 zones and identifies skills needed for mandatory tasks:

```
Weight = (6 - zoneDistance)
```

Skills for the next zone get weight 5, two zones ahead get weight 4, etc.

**Task prioritization** considers:
1. **Skill weight**: Skills needed sooner get higher priority
2. **Skill deficit**: Skills below average level get bonus priority
3. **Energy efficiency**: Priority score divided by energy cost

Formula:
```
priorityScore = Σ(weight × √(avgLevel - skillLevel + 1))
priorityPerEnergy = priorityScore / singleRepCost
```

Tasks training multiple bottleneck skills are naturally prioritized.

## Key Formulas

### Task Cost
```javascript
baseCost = BASE_COST × costMult × 2.2^zoneId  // BASE_COST = 10
```

### Progress Per Tick
```javascript
progress = 1.0
  × (1.01^skillLevel)^(1/numSkills)  // Geometric mean for multi-skill
  × perkBonuses
  × 1.05^zoneId  // Zone speedup
  × powerBonus  // For Combat/Fortitude
  × attunementBonus  // For Magic/Druid/Study
```

### Ticks to Complete
```javascript
ticks = ceil(baseCost / progressPerTick)
```

### Energy Cost
```javascript
drainPerTick = 1.0
  × 0.2 (if single-tick and MinorTimeCompression)
  × 0.8 (if HighAltitudeClimbing)
  × 0.95^(highestZone - currentZone) (if ReflectionsOnTheJourney)
  × 1.05^zoneId

energyCost = ticks × drainPerTick × maxReps
```

### XP Gain
```javascript
xpPerRep = progressPerTick × 8 × xpMult × 1.5 (if Writing perk) × 1.25^zoneId
```

### Zone Reachability
A zone is reachable if cumulative mandatory task cost ≤ current energy:
```javascript
reachable = []
remainingEnergy = startingEnergy
for each zone:
    mandatoryCost = Σ(taskEnergyCost for mandatory tasks)
    if mandatoryCost > remainingEnergy:
        break
    reachable.push(zone)
    remainingEnergy -= mandatoryCost
```

## Milestone Tracking

### Zone Milestones
Records the first reset when each zone's mandatory tasks are completed.

### Task Milestones
Records the first reset when each task is completed (by task ID).

Output includes **delta** (resets since previous milestone) to identify:
- Tasks completed together (delta = 0): Typically mandatory tasks for a zone
- Long deltas (100+): Grind periods / bottlenecks
- Mid-progression tasks: Optional perks/items completed when affordable

## Key Perks Affecting Progression

| Perk | Zone | Effect |
|------|------|--------|
| Reading | 0 | +50% Study speed |
| Writing | 1 | +50% XP gain |
| Amulet | 3 | +50% Magic speed, enables automation |
| EnergySpell | 4 | +50 max energy (one time) |
| MinorTimeCompression | 7 | -80% energy for single-tick tasks |
| HighAltitudeClimbing | 8 | -20% energy cost |
| ReflectionsOnTheJourney | 13 | Reduced cost in lower zones |
| EnergeticMemory | 14 | +0.1 max energy per zone per reset |

## Observed Progression

Typical baseline results:

| Zone | Name | Reset | Notes |
|------|------|-------|-------|
| 0 | The Village | 2 | Initial zone |
| 1 | The Village Watch | 36 | Study/Charisma bottleneck |
| 2 | The Raid | 78 | Combat bottleneck |
| 3 | The Wilderness | 150 | Search/Subterfuge/Survival needed |
| 4 | The Cave System | 198 | Magic introduced |
| 5 | The Road to the City | 268 | Multi-skill requirements |
| 6 | The City Outskirts | 312 | Combat/Fortitude needed |
| 7 | The City | 430 | Magic farming begins |
| 8 | The Forest | 652 | Druid introduced (20x XP mult) |
| 9 | The Magician | 672 | Attunement perk available |
| 10 | The Ocean | 872 | Druid/Survival requirements |
| 11+ | Later zones | 1500+ | Druid becomes major bottleneck |

## Limitations

1. **Hidden tasks not modeled**: Boss kills and their hidden task unlocks are skipped
2. **No automation**: The Amulet's automation feature isn't simulated
3. **Simplified item usage**: Items are consumed at run start or not at all
4. **No prestige/ascension**: The Ascension skill and prestige mechanics aren't fully modeled
5. **Deterministic**: No randomization in task selection or outcomes

## Usage

```javascript
import { simulateUntilZone, runBaselineSimulation } from './simulator.js';

// Run simulation to zone 10
const result = simulateUntilZone(10, { maxResets: 1000 });
console.log(result.taskMilestones);

// Run full baseline report
runBaselineSimulation(15);
```
