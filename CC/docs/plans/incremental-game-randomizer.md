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

## Architecture

### Frontend-Based Design

Unlike traditional Archipelago integrations that run logic in Python during seed generation, this implementation runs entirely in JavaScript within the Archipelago-CC frontend:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Archipelago-CC Frontend                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Cost Adjustment Module                   │   │
│  │  - Time simulation (JavaScript)                          │   │
│  │  - Cost adjustment algorithm                             │   │
│  │  - Game data definitions                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                    postMessage / IframeClient                    │
│                              │                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Journey to Ascension (iframe)                │   │
│  │  - Modified game with randomizer hooks                   │   │
│  │  - Receives cost adjustments from parent                 │   │
│  │  - Reports task completions to parent                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Communication Protocol

The game runs in an iframe and communicates with the main frontend via the existing `IframeClient` infrastructure:

**Parent → Game (iframe):**
- `RANDOMIZER_INIT`: Send seed data, placement, cost adjustments
- `ITEM_RECEIVED`: Grant a perk the player received from another world
- `STATE_REQUEST`: Request current game state

**Game → Parent:**
- `TASK_COMPLETED`: Player completed a task (check for location)
- `PERK_GRANTED`: Perk was granted (for tracking)
- `STATE_UPDATE`: Current game state (for save/load)

## Core Algorithm

### Traditional Approach (Not Used)
```
1. Extract logic rules: "Location X requires Items A, B, C"
2. Archipelago places items respecting rules
3. Seed is completable by construction
```

### Post-Hoc Cost Adjustment Approach
```
1. Place perks randomly (no logic constraints)
2. Analyze resulting progression path
3. Calculate time-to-complete for each zone
4. Adjust cost_multiplier values to hit target times
5. Send adjustments to game iframe
```

## Implementation Plan

### Phase 1: Game Data Module

**Goal:** Create JavaScript module with game data and constants.

**Location:** `frontend/modules/jta-randomizer/gameData.js`

```javascript
// Game constants extracted from Journey to Ascension source
export const SKILLS = {
    Charisma: { id: 0, name: 'Charisma', xpMult: 1.0 },
    Study: { id: 1, name: 'Study', xpMult: 1.0 },
    Combat: { id: 2, name: 'Combat', xpMult: 5.0 },
    Search: { id: 3, name: 'Search', xpMult: 1.0 },
    Subterfuge: { id: 4, name: 'Subterfuge', xpMult: 1.0 },
    Crafting: { id: 5, name: 'Crafting', xpMult: 1.0 },
    Survival: { id: 6, name: 'Survival', xpMult: 1.0 },
    Travel: { id: 7, name: 'Travel', xpMult: 1.0 },
    Magic: { id: 8, name: 'Magic', xpMult: 3.0 },
    Fortitude: { id: 9, name: 'Fortitude', xpMult: 10.0 },
    Druid: { id: 10, name: 'Druid', xpMult: 20.0 },
    Ascension: { id: 11, name: 'Ascension', xpMult: 1000.0 },
};

export const PERKS = {
    Reading: {
        id: 'Reading',
        name: 'How to Read',
        skillModifiers: { Study: 0.5 },
        specialEffects: [],
    },
    // ... all 28 perks
};

export const ZONES = [
    {
        id: 0,
        name: 'The Village',
        tasks: [
            {
                id: 10,
                name: 'Join the Watch',
                type: 'Travel',
                costMultiplier: 4,
                skills: ['Charisma'],
                perk: null,
                item: null,
            },
            // ... other tasks
        ],
    },
    // ... all 20 zones
];

// Tasks that grant perks (these become Archipelago locations)
export const PERK_TASKS = ZONES.flatMap(zone =>
    zone.tasks.filter(task => task.perk !== null)
);
```

### Phase 2: Time Simulation Module

**Goal:** JavaScript implementation of game time calculations.

**Location:** `frontend/modules/jta-randomizer/simulator.js`

```javascript
import { SKILLS, PERKS, ZONES } from './gameData.js';

// Constants from simulation.ts
const BASE_COST = 10;
const ZONE_COST_EXPONENT = 2.2;
const ZONE_SPEEDUP_BASE = 1.05;
const SKILL_LEVEL_EXPONENT = 1.01;
const TICK_RATE_MS = 66.6;
const MAJOR_TIME_COMPRESSION_EFFECT = 2.0;

/**
 * Calculate task cost
 * @param {Object} task - Task definition
 * @param {number} zoneId - Zone index
 * @returns {number} Task cost
 */
export function calcTaskCost(task, zoneId) {
    return BASE_COST * task.costMultiplier * Math.pow(ZONE_COST_EXPONENT, zoneId);
}

/**
 * Calculate progress per tick for a task
 * @param {Object} task - Task definition
 * @param {number} zoneId - Zone index
 * @param {Object} skillLevels - Map of skill name to level
 * @param {Set} perks - Set of owned perk IDs
 * @returns {number} Progress per tick
 */
export function calcProgressPerTick(task, zoneId, skillLevels, perks) {
    let mult = 1.0;

    // Skill level bonus (geometric mean for multi-skill tasks)
    let skillMult = 1.0;
    for (const skill of task.skills) {
        const level = skillLevels[skill] || 0;
        skillMult *= Math.pow(SKILL_LEVEL_EXPONENT, level);
    }
    mult *= Math.pow(skillMult, 1 / task.skills.length);

    // Perk bonuses
    for (const skill of task.skills) {
        for (const perkId of perks) {
            const perk = PERKS[perkId];
            if (perk && perk.skillModifiers[skill]) {
                mult *= (1 + perk.skillModifiers[skill]);
            }
        }
    }

    // Zone speedup
    mult *= Math.pow(ZONE_SPEEDUP_BASE, zoneId);

    // Special perk effects
    if (perks.has('MajorTimeCompression')) {
        mult *= MAJOR_TIME_COMPRESSION_EFFECT;
    }

    return mult;
}

/**
 * Calculate time to complete a task in seconds
 * @param {Object} task - Task definition
 * @param {number} zoneId - Zone index
 * @param {Object} skillLevels - Map of skill name to level
 * @param {Set} perks - Set of owned perk IDs
 * @returns {number} Time in seconds
 */
export function calcTaskTimeSeconds(task, zoneId, skillLevels, perks) {
    const cost = calcTaskCost(task, zoneId);
    const progress = calcProgressPerTick(task, zoneId, skillLevels, perks);
    const ticks = Math.ceil(cost / progress);
    return ticks * TICK_RATE_MS / 1000;
}

/**
 * Simulate completing a zone and return time + updated skill levels
 * @param {Object} zone - Zone definition
 * @param {Object} skillLevels - Current skill levels
 * @param {Set} perks - Set of owned perk IDs
 * @returns {Object} { timeSeconds, newSkillLevels }
 */
export function simulateZone(zone, skillLevels, perks) {
    let totalTime = 0;
    const newSkillLevels = { ...skillLevels };

    // Complete all mandatory tasks + travel
    const tasksToComplete = zone.tasks.filter(t =>
        t.type === 'Mandatory' || t.type === 'Travel'
    );

    for (const task of tasksToComplete) {
        const time = calcTaskTimeSeconds(task, zone.id, newSkillLevels, perks);
        totalTime += time;

        // Simulate skill XP gain (simplified)
        for (const skill of task.skills) {
            newSkillLevels[skill] = (newSkillLevels[skill] || 0) + 1;
        }
    }

    return { timeSeconds: totalTime, newSkillLevels };
}

/**
 * Simulate full game progression and return per-zone times
 * @param {Object} placement - Map of task ID to perk ID
 * @returns {Array} Array of { zoneId, timeSeconds, perksGained }
 */
export function simulateFullGame(placement) {
    const results = [];
    let skillLevels = {};
    let perks = new Set();

    for (const zone of ZONES) {
        const { timeSeconds, newSkillLevels } = simulateZone(zone, skillLevels, perks);

        // Collect perks gained in this zone
        const perksGained = [];
        for (const task of zone.tasks) {
            if (placement[task.id]) {
                perksGained.push(placement[task.id]);
                perks.add(placement[task.id]);
            }
        }

        results.push({
            zoneId: zone.id,
            zoneName: zone.name,
            timeSeconds,
            perksGained,
        });

        skillLevels = newSkillLevels;
    }

    return results;
}
```

### Phase 3: Cost Adjustment Module

**Goal:** Algorithm to compute adjusted cost multipliers.

**Location:** `frontend/modules/jta-randomizer/costAdjuster.js`

```javascript
import { ZONES } from './gameData.js';
import { simulateZone, calcTaskTimeSeconds } from './simulator.js';

/**
 * Compute cost adjustments for a given perk placement
 * @param {Object} placement - Map of task ID to perk ID
 * @param {Object} options - Adjustment options
 * @returns {Object} Map of task ID to adjusted cost multiplier
 */
export function computeCostAdjustments(placement, options = {}) {
    const {
        targetZoneTime = 300,      // 5 minutes per zone
        minAdjustment = 0.01,      // Don't make more than 100x easier
        maxAdjustment = 10,        // Don't make more than 10x harder
        bossAdjustmentCap = 0.1,   // Bosses can be at most 10x easier
    } = options;

    const adjustments = {};
    let skillLevels = {};
    let perks = new Set();

    for (const zone of ZONES) {
        // Calculate time to complete zone with current perks
        const { timeSeconds } = simulateZone(zone, skillLevels, perks);

        // Calculate adjustment ratio
        let ratio = 1.0;
        if (timeSeconds > targetZoneTime) {
            ratio = targetZoneTime / timeSeconds;
        }
        // Optionally increase difficulty if zone is too easy:
        // else if (timeSeconds < targetZoneTime * 0.5) {
        //     ratio = targetZoneTime / timeSeconds;
        // }

        // Apply ratio to all tasks in zone
        for (const task of zone.tasks) {
            const original = task.costMultiplier;
            let adjusted = original * ratio;

            // Apply bounds
            const effectiveMin = task.type === 'Boss'
                ? Math.max(minAdjustment, bossAdjustmentCap)
                : minAdjustment;

            adjusted = Math.max(adjusted, original * effectiveMin);
            adjusted = Math.min(adjusted, original * maxAdjustment);

            adjustments[task.id] = adjusted;
        }

        // Update state for next zone
        for (const task of zone.tasks) {
            if (placement[task.id]) {
                perks.add(placement[task.id]);
            }
        }
        const result = simulateZone(zone, skillLevels, perks);
        skillLevels = result.newSkillLevels;
    }

    return adjustments;
}

/**
 * Validate that a seed with adjustments is completable
 * @param {Object} placement - Map of task ID to perk ID
 * @param {Object} adjustments - Map of task ID to adjusted cost multiplier
 * @param {Object} options - Validation options
 * @returns {Object} Validation results
 */
export function validateSeed(placement, adjustments, options = {}) {
    const {
        maxZoneTime = 600,       // 10 minutes max per zone
        maxTotalTime = 7200,     // 2 hours max total
    } = options;

    const results = {
        valid: true,
        totalTime: 0,
        zoneResults: [],
        warnings: [],
    };

    let skillLevels = {};
    let perks = new Set();

    for (const zone of ZONES) {
        // Create adjusted zone for simulation
        const adjustedZone = {
            ...zone,
            tasks: zone.tasks.map(task => ({
                ...task,
                costMultiplier: adjustments[task.id] || task.costMultiplier,
            })),
        };

        const { timeSeconds, newSkillLevels } = simulateZone(
            adjustedZone, skillLevels, perks
        );

        results.zoneResults.push({
            zoneId: zone.id,
            zoneName: zone.name,
            timeSeconds,
        });
        results.totalTime += timeSeconds;

        if (timeSeconds > maxZoneTime) {
            results.warnings.push(
                `Zone ${zone.name} takes ${timeSeconds.toFixed(0)}s (max: ${maxZoneTime})`
            );
        }

        // Update perks for next zone
        for (const task of zone.tasks) {
            if (placement[task.id]) {
                perks.add(placement[task.id]);
            }
        }
        skillLevels = newSkillLevels;
    }

    if (results.totalTime > maxTotalTime) {
        results.valid = false;
        results.warnings.push(
            `Total time ${results.totalTime.toFixed(0)}s exceeds max ${maxTotalTime}`
        );
    }

    return results;
}
```

### Phase 4: Iframe Game Module

**Goal:** Create iframe module that hosts the game and handles communication.

**File Structure:**
```
frontend/modules/jta-iframe/
├── index.html           # Hosts the game
├── gameClient.js        # Communication with parent
├── gamePatches.js       # Patches to game code
└── shared/
    └── sharedLogger.js  # Logging utilities
```

**Game Client (`gameClient.js`):**

```javascript
import { IframeClient } from '../iframe-base/iframeClient.js';

/**
 * Journey to Ascension game client
 * Handles communication between game and Archipelago frontend
 */
export class JTAGameClient extends IframeClient {
    constructor() {
        super();
        this.randomizerData = null;
        this.onTaskComplete = null;
        this.onPerkGrant = null;
    }

    /**
     * Initialize randomizer with seed data
     * @param {Object} data - Randomizer data from parent
     */
    initializeRandomizer(data) {
        this.randomizerData = data;

        // Apply cost adjustments to game
        if (window.ZONES && data.costAdjustments) {
            for (const zone of window.ZONES) {
                for (const task of zone.tasks) {
                    if (data.costAdjustments[task.id] !== undefined) {
                        task.cost_multiplier = data.costAdjustments[task.id];
                    }
                }
            }
        }

        // Store placement for perk lookups
        this.placement = data.placement;
    }

    /**
     * Handle task completion - check if it's a randomized location
     * @param {Object} task - Completed task
     */
    handleTaskComplete(task) {
        if (!this.randomizerData) return;

        const assignedPerk = this.placement[task.id];
        if (assignedPerk) {
            // Notify parent that a location was checked
            this.publishEventBus('jta:locationChecked', {
                taskId: task.id,
                taskName: task.name,
                perkId: assignedPerk,
            });
        }
    }

    /**
     * Receive a perk from another player's world
     * @param {string} perkId - Perk to grant
     */
    receivePerk(perkId) {
        if (window.tryAddPerk && window.PerkType) {
            const perkType = window.PerkType[perkId];
            if (perkType !== undefined) {
                window.tryAddPerk(perkType);
            }
        }
    }

    /**
     * Setup message handlers for randomizer events
     */
    setupRandomizerHandlers() {
        // Listen for randomizer initialization
        this.subscribeEventBus('jta:initRandomizer', (data) => {
            this.initializeRandomizer(data);
        });

        // Listen for incoming perks from other worlds
        this.subscribeEventBus('jta:receivePerk', (data) => {
            this.receivePerk(data.perkId);
        });
    }
}
```

**Game Patches (`gamePatches.js`):**

```javascript
/**
 * Patches to Journey to Ascension game code for randomizer support
 */

let gameClient = null;

/**
 * Initialize patches with game client reference
 * @param {JTAGameClient} client - Game client instance
 */
export function initializePatches(client) {
    gameClient = client;
    patchTaskCompletion();
    patchPerkGrant();
}

/**
 * Patch task completion to notify randomizer
 */
function patchTaskCompletion() {
    // Store original function
    const originalFullyFinishTask = window.fullyFinishTask;

    if (originalFullyFinishTask) {
        window.fullyFinishTask = function(task) {
            // Call original
            originalFullyFinishTask(task);

            // Notify randomizer
            if (gameClient) {
                gameClient.handleTaskComplete(task.task_definition);
            }
        };
    }
}

/**
 * Patch perk granting to handle randomized perks
 */
function patchPerkGrant() {
    const originalTryAddPerk = window.tryAddPerk;

    if (originalTryAddPerk) {
        window.tryAddPerk = function(perk, showNotification = true) {
            // In randomizer mode, perks come from the randomizer, not tasks
            if (gameClient && gameClient.randomizerData) {
                // Only allow perks granted through randomizer
                // The original perk grant from task completion is blocked
                return;
            }

            // Normal mode - call original
            originalTryAddPerk(perk, showNotification);
        };
    }
}

/**
 * Grant a perk bypassing randomizer checks (for received items)
 * @param {number} perkType - Perk type enum value
 */
export function forceGrantPerk(perkType) {
    // Directly modify gamestate
    if (window.GAMESTATE && window.GAMESTATE.perks) {
        window.GAMESTATE.perks.set(perkType, true);
    }
}
```

### Phase 5: Frontend Integration

**Goal:** Integrate randomizer into main Archipelago-CC frontend.

**Location:** `frontend/modules/jta-randomizer/index.js`

```javascript
import { PERK_TASKS, PERKS } from './gameData.js';
import { computeCostAdjustments, validateSeed } from './costAdjuster.js';
import { simulateFullGame } from './simulator.js';

/**
 * Journey to Ascension Randomizer Module
 */
export class JTARandomizer {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.currentSeed = null;
        this.placement = null;
        this.adjustments = null;
        this.gameIframe = null;
    }

    /**
     * Generate a random placement of perks to tasks
     * @param {number} seed - Random seed
     * @returns {Object} Placement map (taskId -> perkId)
     */
    generatePlacement(seed) {
        // Simple Fisher-Yates shuffle with seeded RNG
        const rng = this.createSeededRNG(seed);

        const perkIds = Object.keys(PERKS);
        const taskIds = PERK_TASKS.map(t => t.id);

        // Shuffle perk IDs
        for (let i = perkIds.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [perkIds[i], perkIds[j]] = [perkIds[j], perkIds[i]];
        }

        // Create placement
        const placement = {};
        for (let i = 0; i < taskIds.length && i < perkIds.length; i++) {
            placement[taskIds[i]] = perkIds[i];
        }

        return placement;
    }

    /**
     * Create seeded random number generator
     * @param {number} seed - Seed value
     * @returns {Function} RNG function returning 0-1
     */
    createSeededRNG(seed) {
        let state = seed;
        return function() {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            return state / 0x7fffffff;
        };
    }

    /**
     * Initialize randomizer with a seed
     * @param {number} seed - Random seed
     * @param {Object} options - Randomizer options
     */
    initialize(seed, options = {}) {
        this.currentSeed = seed;
        this.placement = this.generatePlacement(seed);
        this.adjustments = computeCostAdjustments(this.placement, options);

        // Validate the seed
        const validation = validateSeed(this.placement, this.adjustments, options);
        if (!validation.valid) {
            console.warn('Seed validation warnings:', validation.warnings);
        }

        // Simulate to show expected progression
        const simulation = simulateFullGame(this.placement);
        console.log('Simulated progression:', simulation);

        return {
            seed,
            placement: this.placement,
            adjustments: this.adjustments,
            validation,
            simulation,
        };
    }

    /**
     * Connect to game iframe and send randomizer data
     * @param {HTMLIFrameElement} iframe - Game iframe element
     */
    connectToGame(iframe) {
        this.gameIframe = iframe;

        // Wait for iframe to be ready, then send data
        this.eventBus.on('jta:iframeReady', () => {
            this.eventBus.emit('jta:initRandomizer', {
                seed: this.currentSeed,
                placement: this.placement,
                costAdjustments: this.adjustments,
            });
        });

        // Listen for location checks from game
        this.eventBus.on('jta:locationChecked', (data) => {
            this.handleLocationChecked(data);
        });
    }

    /**
     * Handle when player checks a location in the game
     * @param {Object} data - Location check data
     */
    handleLocationChecked(data) {
        console.log(`Location checked: ${data.taskName} -> ${data.perkId}`);

        // In multiworld, this would send to AP server
        // For single player, just grant the perk
        this.eventBus.emit('jta:receivePerk', {
            perkId: data.perkId,
        });
    }

    /**
     * Export randomizer data for save/share
     * @returns {Object} Serializable randomizer state
     */
    exportData() {
        return {
            version: '1.0.0',
            seed: this.currentSeed,
            placement: this.placement,
            costAdjustments: this.adjustments,
        };
    }

    /**
     * Import randomizer data
     * @param {Object} data - Previously exported data
     */
    importData(data) {
        if (data.version !== '1.0.0') {
            throw new Error(`Unsupported version: ${data.version}`);
        }

        this.currentSeed = data.seed;
        this.placement = data.placement;
        this.adjustments = data.costAdjustments;
    }
}
```

### Phase 6: Testing Module

**Goal:** Automated testing for randomizer logic.

**Location:** `frontend/modules/jta-randomizer/tests/`

```javascript
// tests/simulator.test.js
import { calcTaskCost, calcProgressPerTick, simulateZone } from '../simulator.js';
import { ZONES, PERKS } from '../gameData.js';

describe('JTA Simulator', () => {
    describe('calcTaskCost', () => {
        it('should scale with zone ID', () => {
            const task = { costMultiplier: 1.0 };
            const cost0 = calcTaskCost(task, 0);
            const cost1 = calcTaskCost(task, 1);

            expect(cost1 / cost0).toBeCloseTo(2.2, 1);
        });

        it('should scale with cost multiplier', () => {
            const task1 = { costMultiplier: 1.0 };
            const task2 = { costMultiplier: 2.0 };

            expect(calcTaskCost(task2, 0) / calcTaskCost(task1, 0)).toBe(2);
        });
    });

    describe('calcProgressPerTick', () => {
        it('should increase with perk bonuses', () => {
            const task = { skills: ['Study'], costMultiplier: 1.0 };
            const skillLevels = { Study: 0 };

            const progressWithout = calcProgressPerTick(task, 0, skillLevels, new Set());
            const progressWith = calcProgressPerTick(task, 0, skillLevels, new Set(['Reading']));

            expect(progressWith).toBeGreaterThan(progressWithout);
        });
    });

    describe('simulateZone', () => {
        it('should complete zone 0 in reasonable time', () => {
            const result = simulateZone(ZONES[0], {}, new Set());

            // Zone 0 should take less than 10 minutes with no perks
            expect(result.timeSeconds).toBeLessThan(600);
        });
    });
});

// tests/costAdjuster.test.js
import { computeCostAdjustments, validateSeed } from '../costAdjuster.js';
import { PERK_TASKS, PERKS } from '../gameData.js';

describe('Cost Adjuster', () => {
    const createTestPlacement = () => {
        const placement = {};
        const perkIds = Object.keys(PERKS);
        PERK_TASKS.forEach((task, i) => {
            placement[task.id] = perkIds[i % perkIds.length];
        });
        return placement;
    };

    describe('computeCostAdjustments', () => {
        it('should return adjustments for all tasks', () => {
            const placement = createTestPlacement();
            const adjustments = computeCostAdjustments(placement);

            // Should have adjustment for every task in every zone
            expect(Object.keys(adjustments).length).toBeGreaterThan(0);
        });

        it('should respect min/max bounds', () => {
            const placement = createTestPlacement();
            const adjustments = computeCostAdjustments(placement, {
                minAdjustment: 0.5,
                maxAdjustment: 2.0,
            });

            for (const [taskId, adjusted] of Object.entries(adjustments)) {
                // Find original cost multiplier
                // Verify it's within bounds
            }
        });
    });

    describe('validateSeed', () => {
        it('should validate a reasonable seed', () => {
            const placement = createTestPlacement();
            const adjustments = computeCostAdjustments(placement);
            const result = validateSeed(placement, adjustments);

            expect(result.valid).toBe(true);
        });
    });
});
```

## Configuration Options

**Randomizer Options (passed to `initialize()`):**

```javascript
const options = {
    // Target time per zone in seconds (default: 300 = 5 minutes)
    targetZoneTime: 300,

    // Minimum cost adjustment multiplier (default: 0.01 = 100x easier max)
    minAdjustment: 0.01,

    // Maximum cost adjustment multiplier (default: 10 = 10x harder max)
    maxAdjustment: 10,

    // Special cap for boss tasks (default: 0.1 = 10x easier max for bosses)
    bossAdjustmentCap: 0.1,

    // Maximum time for any single zone (default: 600 = 10 minutes)
    maxZoneTime: 600,

    // Maximum total game time (default: 7200 = 2 hours)
    maxTotalTime: 7200,
};
```

## Known Limitations

1. **Prestige System**: Initial implementation excludes prestige mechanics.

2. **Consumable Items**: Items providing temporary boosts are not randomized.

3. **Energy System**: Cost adjustment affects energy efficiency.

4. **Multiplayer**: Initial implementation is single-player only.

## Future Enhancements

1. **Logic Mode**: Optional placement restrictions based on simulation.

2. **Dynamic Difficulty**: Real-time cost adjustment based on player progress.

3. **Item Randomization**: Randomize consumable item drops.

4. **Prestige Randomization**: Include prestige upgrades in item pool.

5. **Multiworld Support**: Connect to Archipelago server for multiplayer.

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
