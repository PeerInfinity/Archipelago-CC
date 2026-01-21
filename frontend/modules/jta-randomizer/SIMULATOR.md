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
- **Items**: Food items provide energy; all items persist at 50% across resets

### Artifacts
Special items with powerful effects:
- **Scroll of Haste**: Next task is 5x faster (reduces energy cost by 80%)
- **Magic Ring**: Next task gives 3x XP
- **Dreamcatcher**: Duplicates all items found this reset

Artifacts are obtained from specific tasks (e.g., "Scribe Scroll of Haste" in Zone 7) and persist at 50% across resets like other items.

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
- **Boss tasks**: High-cost optional challenges that unlock hidden tasks
- **Hidden tasks**: Unlocked by defeating the corresponding boss

**Zone cost scaling**: `2.2^zoneId` multiplier on all task costs

### Boss Mechanics
Each boss, when defeated, unlocks a hidden task in the same zone:
| Zone | Boss | Unlocks | Boss costMult |
|------|------|---------|---------------|
| 2 | Goblin Warlord | Save the Village | 1300 |
| 3 | Angry Ent | Gather Magical Roots | 12000 |
| 4 | Goblin Chieftain | Wipe Out Goblins | 10000 |
| 5 | Bandits | Loot Bandit Camp | 10000 |
| 7 | Corrupt Mayor | Purge Corrupt Bureaucracy | 10000 |
| 8 | Werewolf | Gather Shed Fur from Lair | 20000 |
| 10 | Kraken | Explore Kraken's Lair | 15000 |
| 11 | Horde of Lizardfolk | Steal Their Oracle Bones | 150000 |
| 12 | Giant Sandworm | Learn to Dance the Worm | 600000 |
| 13 | Sleepy Djinn | Find More Lamps | 2000000 |
| 15 | The Weaver of Dreams | Contain the Dream | 100000000 |

**Note**: Boss costs are extremely high. The cheapest boss (Goblin Warlord) costs ~63,000 energy at game start, making bosses late-game content that requires massive energy accumulation through the EnergeticMemory perk.

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
- Use Scroll of Haste for expensive perks (>30% of energy)
- Complete if affordable

#### Priority 2: Collect Items (collect runs only)
- Find all item-granting tasks in reachable zones
- Sort by net energy value
- Collect if affordable

#### Priority 2.5: Defeat Bosses
- Find all undefeated bosses in reachable zones
- Use Scroll of Haste for expensive bosses (>50% of energy)
- Defeating a boss unlocks its corresponding hidden task
- Boss items (often artifacts) are collected

#### Priority 3: Advance Zones
- Complete mandatory tasks for all reachable zones
- This naturally progresses through zones as skills improve

#### Priority 4: Farm Skills
- Identify bottleneck skills for future zones
- Farm tasks that train those skills efficiently
- Fall back to best XP/energy tasks if no bottlenecks

### Immediate Item Consumption (Push Runs)
On push runs, energy items are consumed immediately when acquired, not just at the start:
- After completing mandatory tasks in a zone
- After completing perk tasks
- After defeating bosses
This allows items gained mid-run to extend the run further.

### Bottleneck Detection

The simulator looks ahead at ALL remaining zones with exponential weight decay:

```
Weight = 100 / (zoneDistance ^ 1.5)
```

| Zone Distance | Weight |
|---------------|--------|
| 1 | 100.0 |
| 2 | 35.4 |
| 3 | 19.2 |
| 4 | 12.5 |
| 5 | 8.9 |
| 10 | 3.2 |

This gives strong priority to immediately needed skills while still considering long-term needs.

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

Typical baseline results (simulation to Zone 8):

| Zone | Name | Reset | Delta | Notes |
|------|------|-------|-------|-------|
| 0 | The Village | 2 | 2 | Initial zone |
| 1 | The Village Watch | 24 | 22 | Study/Charisma bottleneck |
| 2 | The Raid | 74 | 50 | Combat bottleneck |
| 3 | The Wilderness | 164 | 90 | Search/Subterfuge/Survival needed |
| 4 | The Cave System | 212 | 48 | Magic introduced |
| 5 | The Road to the City | 288 | 76 | Multi-skill requirements |
| 6 | The City Outskirts | 328 | 40 | Combat/Fortitude needed |
| 7 | The City | 446 | 118 | Scroll of Haste available |
| 8 | The Forest | 678 | 232 | Druid introduced (20x XP mult) |

**Note**: Bosses are not defeated in early/mid game due to extremely high costs. The first boss (Goblin Warlord) requires ~63,000 energy at start, while starting energy is only 100.

## Limitations

1. **No automation**: The Amulet's automation feature isn't simulated
2. **No prestige/ascension**: The Ascension skill and prestige mechanics aren't fully modeled
3. **Deterministic**: No randomization in task selection or outcomes
4. **Item skill modifiers not applied**: Non-energy items provide skill bonuses when consumed in the real game, but the simulator doesn't apply these bonuses
5. **Magic Ring XP bonus not used**: The simulator tracks Magic Rings but doesn't currently use them for XP optimization

## Features Modeled

1. **Artifacts**: Scroll of Haste (5x speed), Magic Ring (3x XP - tracked but not used), Dreamcatcher (item duplication)
2. **Boss tasks**: All bosses can be attempted; defeating them unlocks hidden tasks
3. **Hidden tasks**: Unlocked hidden tasks become available for grinding
4. **Immediate item use**: Push runs consume items as they're acquired
5. **Unlimited look-ahead**: Bottleneck detection considers all remaining zones

## Usage

```javascript
import { simulateUntilZone, runBaselineSimulation } from './simulator.js';

// Run simulation to zone 10
const result = simulateUntilZone(10, { maxResets: 1000 });
console.log(result.taskMilestones);

// Run full baseline report
runBaselineSimulation(15);
```
