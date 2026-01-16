/**
 * Journey to Ascension - Game Simulator
 * Simulates game progression to estimate resets needed per zone
 */

import {
    ZONES, PERKS, PerkType, SkillType, TaskType,
    SKILL_XP_MULT, SKILL_NAMES, getMandatoryTasks,
    ENERGY_ITEMS, ItemType
} from './gameData.js';

// Game constants from simulation.ts
const BASE_COST = 10;
const ZONE_COST_EXPONENT = 2.2;
const ZONE_SPEEDUP_BASE = 1.05;
const SKILL_LEVEL_EXPONENT = 1.01;
const SKILL_XP_EXPONENT = 1.02;
const TICK_RATE_MS = 66.6;
const STARTING_ENERGY = 100;
const ENERGETIC_MEMORY_MULT = 0.1;
const REFLECTIONS_BASE = 0.95;
const MAJOR_TIME_COMPRESSION_EFFECT = 2.0;

/**
 * Calculate the base cost of a task
 */
export function calcTaskCost(task, zoneId) {
    return BASE_COST * task.costMult * Math.pow(ZONE_COST_EXPONENT, zoneId);
}

/**
 * Calculate progress per tick (determines how many ticks to complete)
 */
export function calcProgressPerTick(task, zoneId, state) {
    let mult = 1.0;

    // Skill level bonus (geometric mean for multi-skill tasks)
    let skillMult = 1.0;
    for (const skill of task.skills) {
        const level = state.skillLevels[skill] || 0;
        skillMult *= Math.pow(SKILL_LEVEL_EXPONENT, level);
    }
    mult *= Math.pow(skillMult, 1 / task.skills.length);

    // Perk bonuses
    for (const skill of task.skills) {
        for (const perkId of state.perks) {
            const perk = PERKS[perkId];
            if (perk && perk.skillModifiers[skill]) {
                mult *= (1 + perk.skillModifiers[skill]);
            }
        }
    }

    // Zone speedup
    mult *= Math.pow(ZONE_SPEEDUP_BASE, zoneId);

    // Major Time Compression - doubles speed for non-single-tick tasks
    // (but also doubles energy cost, so net effect on energy is neutral for multi-tick)
    if (state.perks.has(PerkType.MajorTimeCompression)) {
        mult *= MAJOR_TIME_COMPRESSION_EFFECT;
    }

    // Unified Theory of Magic - 2% per zone fully completed
    if (state.perks.has(PerkType.UnifiedTheoryOfMagic)) {
        mult *= Math.pow(1.02, state.highestZoneFullyCompleted + 1);
    }

    // Power bonus (for Combat/Fortitude)
    const powerSkills = [SkillType.Combat, SkillType.Fortitude];
    if (task.skills.some(s => powerSkills.includes(s))) {
        mult *= (1 + state.power / 100);
    }

    // Attunement bonus (for Druid/Magic/Study)
    const attunementSkills = [SkillType.Druid, SkillType.Magic, SkillType.Study];
    if (state.perks.has(PerkType.Attunement) && task.skills.some(s => attunementSkills.includes(s))) {
        mult *= (1 + state.attunement / 1000);
    }

    return mult;
}

/**
 * Calculate ticks needed to complete a task
 */
export function calcTaskTicks(task, zoneId, state) {
    const cost = calcTaskCost(task, zoneId);
    const progress = calcProgressPerTick(task, zoneId, state);
    return Math.ceil(cost / progress);
}

/**
 * Check if a task completes in a single tick
 */
export function isSingleTick(task, zoneId, state) {
    const cost = calcTaskCost(task, zoneId);
    const progress = calcProgressPerTick(task, zoneId, state);
    return progress >= cost;
}

/**
 * Calculate energy drain per tick for a task
 */
export function calcEnergyDrainPerTick(task, zoneId, state, singleTick) {
    let drain = 1;

    // Minor Time Compression - single tick tasks cost 80% less energy
    if (singleTick && state.perks.has(PerkType.MinorTimeCompression)) {
        drain *= 0.2;
    }

    // High Altitude Climbing - 20% energy reduction
    if (state.perks.has(PerkType.HighAltitudeClimbing)) {
        drain *= 0.8;
    }

    // Reflections on the Journey - reduce drain based on zone difference
    if (state.perks.has(PerkType.ReflectionsOnTheJourney)) {
        const zoneDiff = state.highestZone - zoneId;
        if (zoneDiff > 0) {
            drain *= Math.pow(REFLECTIONS_BASE, zoneDiff);
        }
    }

    // Zone scaling - later zones cost more energy per tick
    drain *= Math.pow(ZONE_SPEEDUP_BASE, zoneId);

    // Major Time Compression - increases drain for multi-tick tasks
    if (!singleTick && state.perks.has(PerkType.MajorTimeCompression)) {
        drain *= MAJOR_TIME_COMPRESSION_EFFECT;
    }

    return drain;
}

/**
 * Calculate energy cost for a single rep of a task
 */
export function calcTaskEnergyCostSingleRep(task, zoneId, state) {
    const singleTick = isSingleTick(task, zoneId, state);
    const ticks = calcTaskTicks(task, zoneId, state);
    const drainPerTick = calcEnergyDrainPerTick(task, zoneId, state, singleTick);
    return ticks * drainPerTick;
}

/**
 * Calculate total energy cost for a task (all reps)
 */
export function calcTaskEnergyCost(task, zoneId, state) {
    const singleRep = calcTaskEnergyCostSingleRep(task, zoneId, state);

    // If MajorTimeCompression and single-tick, all reps complete in one tick
    const singleTick = isSingleTick(task, zoneId, state);
    if (singleTick && state.perks.has(PerkType.MajorTimeCompression)) {
        // Just one tick for all reps
        const drainPerTick = calcEnergyDrainPerTick(task, zoneId, state, singleTick);
        return drainPerTick;
    }

    // Otherwise, multiply by reps
    return singleRep * task.maxReps;
}

/**
 * Calculate XP needed for next skill level
 */
export function calcXpNeeded(level, skillType) {
    const skillMult = SKILL_XP_MULT[skillType] || 1;
    return Math.pow(SKILL_XP_EXPONENT, level) * 10 * skillMult;
}

/**
 * Calculate XP gained from completing a task (one rep)
 */
export function calcTaskXp(task, zoneId, state) {
    const progress = calcProgressPerTick(task, zoneId, state);
    const XP_MULT = 8;
    let xp = progress * XP_MULT * task.xpMult;

    // Writing perk - 50% more XP
    if (state.perks.has(PerkType.Writing)) {
        xp *= 1.5;
    }

    // Zone scaling
    xp *= Math.pow(1.25, zoneId);

    return xp;
}

/**
 * Calculate energy cost for completing mandatory tasks in a zone (all reps)
 * All reps are required to unlock the Travel task to the next zone
 */
export function calcZoneMandatoryEnergyCost(zoneId, state) {
    const zone = ZONES[zoneId];
    if (!zone) return Infinity;

    const mandatoryTasks = getMandatoryTasks(zone);
    let totalEnergy = 0;

    for (const task of mandatoryTasks) {
        totalEnergy += calcTaskEnergyCost(task, zoneId, state);
    }

    return totalEnergy;
}

/**
 * Get all farmable tasks across completed zones
 * Returns tasks sorted by XP efficiency (per single rep)
 */
function getFarmableTasks(highestZone, state) {
    const tasks = [];
    for (let z = 0; z <= highestZone && z < ZONES.length; z++) {
        const zone = ZONES[z];
        for (const task of zone.tasks) {
            if (task.type === TaskType.Normal && !task.hidden) {
                const singleRepCost = calcTaskEnergyCostSingleRep(task, z, state);
                const xpPerRep = calcTaskXp(task, z, state);
                tasks.push({
                    task,
                    zoneId: z,
                    singleRepCost,
                    xpPerEnergy: xpPerRep / singleRepCost,
                    xpPerRep,
                });
            }
        }
    }
    // Sort by XP per energy (best first)
    tasks.sort((a, b) => b.xpPerEnergy - a.xpPerEnergy);
    return tasks;
}

/**
 * Apply XP gain from completing a task
 * @param reps - number of full task completions (each completion = maxReps of the task)
 * @param actualReps - if set, use this for XP calculation instead of task.maxReps
 */
function applyTaskXp(task, zoneId, state, reps = 1, actualReps = null) {
    const xpPerRep = calcTaskXp(task, zoneId, state);
    const repsPerCompletion = actualReps !== null ? actualReps : task.maxReps;
    for (const skill of task.skills) {
        state.skillLevels[skill] = (state.skillLevels[skill] || 0);
        const currentLevel = state.skillLevels[skill];
        const xpGained = xpPerRep * repsPerCompletion * reps;
        const xpNeeded = calcXpNeeded(currentLevel, skill);
        const levelsGained = Math.floor(xpGained / xpNeeded);
        state.skillLevels[skill] += Math.max(1, levelsGained);
    }
}

/**
 * Simulate a single run (until energy runs out or game complete)
 * Strategy: Use items for energy, push zones, collect more items
 * Returns the highest zone reached and updated state
 */
export function simulateRun(state, options = {}) {
    const {
        maxZone = ZONES.length - 1,
        collectItems = true,
        farmXp = true,
        verbose = false
    } = options;

    let energy = state.maxEnergy;
    let currentZone = 0;
    let lastCompletedZone = state.highestZone;
    const runLog = [];

    // Consume any held items for bonus energy at start
    const itemEnergy = consumeItemsForEnergy(state);
    if (itemEnergy > 0) {
        energy += itemEnergy;
        if (verbose) {
            runLog.push(`Consumed items for +${itemEnergy.toFixed(1)} energy, total: ${energy.toFixed(1)}`);
        }
    }

    // Phase 1: Push through zones as far as we can
    while (currentZone <= maxZone && energy > 0) {
        const zone = ZONES[currentZone];
        const mandatoryCost = calcZoneMandatoryEnergyCost(currentZone, state);

        if (verbose) {
            runLog.push(`Zone ${currentZone} (${zone.name}): mandatory cost = ${mandatoryCost.toFixed(1)}, energy = ${energy.toFixed(1)}`);
        }

        // Check if we can afford mandatory tasks
        if (mandatoryCost > energy) {
            if (verbose) {
                runLog.push(`  Cannot afford zone ${currentZone}`);
            }
            break;
        }

        // Complete mandatory tasks
        energy -= mandatoryCost;

        // Gain XP from mandatory tasks (all reps)
        const mandatoryTasks = getMandatoryTasks(zone);
        for (const task of mandatoryTasks) {
            applyTaskXp(task, currentZone, state); // All reps for XP
            // Collect items from mandatory tasks
            if (task.item !== null) {
                addItems(state, task.item, task.maxReps);
            }
        }

        // Collect perks from mandatory tasks
        for (const task of mandatoryTasks) {
            if (task.perk !== null) {
                state.perks.add(task.perk);
            }
        }

        // Collect items from optional item tasks
        if (collectItems) {
            for (const task of zone.tasks) {
                if (task.item !== null && task.type !== 1 && task.type !== 2) { // Not Travel or Mandatory
                    const itemCost = calcTaskEnergyCost(task, currentZone, state);
                    // Do it if we can afford it and it's an energy item (profitable investment)
                    const energyGain = ENERGY_ITEMS[task.item];
                    if (energyGain !== undefined && itemCost <= energy) {
                        energy -= itemCost;
                        addItems(state, task.item, task.maxReps);
                        applyTaskXp(task, currentZone, state);
                        // Immediately consume for energy
                        const gained = consumeItemsForEnergy(state);
                        energy += gained;
                        if (verbose) {
                            runLog.push(`  ${task.name}: -${itemCost.toFixed(1)} +${gained.toFixed(1)} energy`);
                        }
                    }
                }
            }
        }

        // Track highest zone
        if (currentZone > state.highestZone) {
            state.highestZone = currentZone;
        }
        lastCompletedZone = currentZone;

        // Move to next zone
        currentZone++;
    }

    // Phase 2: Farm XP in completed zones with remaining energy
    // We farm individual reps (not full task completions)
    if (farmXp && energy > 0 && lastCompletedZone >= 0) {
        const farmableTasks = getFarmableTasks(lastCompletedZone, state);

        while (energy > 1 && farmableTasks.length > 0) {
            // Find most efficient task we can afford (by single rep cost)
            let farmed = false;
            for (const farmTask of farmableTasks) {
                const singleRepCost = calcTaskEnergyCostSingleRep(farmTask.task, farmTask.zoneId, state);
                if (singleRepCost <= energy) {
                    // How many individual reps can we do?
                    const reps = Math.floor(energy / singleRepCost);
                    if (reps > 0) {
                        energy -= reps * singleRepCost;
                        applyTaskXp(farmTask.task, farmTask.zoneId, state, 1, reps);
                        if (verbose) {
                            runLog.push(`  Farmed ${farmTask.task.name} x${reps} reps: -${(reps * singleRepCost).toFixed(1)} energy`);
                        }
                        farmed = true;
                        break; // Re-evaluate best task after XP gain
                    }
                }
            }
            if (!farmed) break; // No affordable tasks
        }
    }

    return {
        highestZoneReached: lastCompletedZone,
        remainingEnergy: energy,
        state,
        runLog,
    };
}

/**
 * Simulate energy reset
 */
export function doEnergyReset(state) {
    // Energetic Memory - gain max energy based on zone reached
    if (state.perks.has(PerkType.EnergeticMemory)) {
        const gain = (state.highestZone + 1) * ENERGETIC_MEMORY_MULT;
        state.maxEnergy += gain;
    }

    // Energy spell gives +50 max energy (one time)
    if (state.perks.has(PerkType.EnergySpell) && !state.energySpellApplied) {
        state.maxEnergy += 50;
        state.energySpellApplied = true;
    }

    // Items persist at 50% across resets
    halveItems(state);

    // Update highest zone fully completed if applicable
    // (simplified - assume we completed all zones we reached)
    state.highestZoneFullyCompleted = Math.max(
        state.highestZoneFullyCompleted,
        state.highestZone - 1
    );

    return state;
}

/**
 * Create initial game state
 */
export function createInitialState() {
    return {
        maxEnergy: STARTING_ENERGY,
        skillLevels: {},
        perks: new Set(),
        power: 0,
        attunement: 0,
        highestZone: -1,
        highestZoneFullyCompleted: -1,
        energySpellApplied: false,
        items: new Map(), // ItemType -> count
    };
}

/**
 * Add items to state
 */
function addItems(state, itemType, count) {
    const current = state.items.get(itemType) || 0;
    state.items.set(itemType, current + count);
}

/**
 * Consume all food-type items for energy
 * Returns energy gained
 */
function consumeItemsForEnergy(state) {
    let energyGained = 0;
    for (const [itemType, count] of state.items) {
        const energyPerItem = ENERGY_ITEMS[itemType];
        if (energyPerItem !== undefined && count > 0) {
            energyGained += energyPerItem * count;
            state.items.set(itemType, 0);
        }
    }
    return energyGained;
}

/**
 * Halve all items (on energy reset)
 */
function halveItems(state) {
    for (const [itemType, count] of state.items) {
        state.items.set(itemType, Math.ceil(count / 2));
    }
}

/**
 * Simulate full game until target zone is reached
 * Returns number of resets needed and final state
 */
export function simulateUntilZone(targetZone, options = {}) {
    const { maxResets = 500, verbose = false } = options;

    let state = createInitialState();
    const milestones = new Map(); // zone -> { reset, firstReached }
    let totalResets = 0;

    for (let reset = 0; reset < maxResets; reset++) {
        const runResult = simulateRun(state, { maxZone: targetZone, verbose });

        // Record first time reaching each zone
        for (let z = 0; z <= runResult.highestZoneReached; z++) {
            if (!milestones.has(z)) {
                milestones.set(z, { reset, zoneId: z });
            }
        }

        // Check if we reached target
        if (runResult.highestZoneReached >= targetZone) {
            totalResets = reset + 1;
            break;
        }

        // Do energy reset
        state = doEnergyReset(state);
        totalResets = reset + 1;

        if (verbose) {
            console.log(`Reset ${reset + 1}: Reached zone ${runResult.highestZoneReached}, maxEnergy now ${state.maxEnergy.toFixed(1)}`);
        }
    }

    return {
        totalResets,
        reachedTarget: milestones.has(targetZone),
        milestones: Array.from(milestones.values()).sort((a, b) => a.zoneId - b.zoneId),
        finalState: state,
    };
}

/**
 * Run baseline simulation and report results
 */
export function runBaselineSimulation(maxZone = 15) {
    console.log(`\n=== Journey to Ascension Baseline Simulation ===`);
    console.log(`Simulating original game progression up to zone ${maxZone}\n`);

    const result = simulateUntilZone(maxZone, { verbose: false });

    console.log(`Total resets to reach zone ${maxZone}: ${result.totalResets}`);
    console.log(`\nMilestones (first reset to reach each zone):`);
    console.log(`${'Zone'.padEnd(6)} ${'Name'.padEnd(25)} ${'Reset'.padEnd(8)} ${'Cumulative'}`);
    console.log('-'.repeat(55));

    for (const milestone of result.milestones) {
        const zone = ZONES[milestone.zoneId];
        console.log(
            `${milestone.zoneId.toString().padEnd(6)} ` +
            `${zone.name.padEnd(25)} ` +
            `${milestone.reset.toString().padEnd(8)} ` +
            `${milestone.reset + 1}`
        );
    }

    console.log(`\nFinal state:`);
    console.log(`  Max Energy: ${result.finalState.maxEnergy.toFixed(1)}`);
    console.log(`  Perks: ${result.finalState.perks.size}`);
    console.log(`  Highest Zone: ${result.finalState.highestZone}`);

    // Show skill levels
    console.log(`  Skill Levels:`);
    for (let i = 0; i < SKILL_NAMES.length; i++) {
        const level = result.finalState.skillLevels[i] || 0;
        if (level > 0) {
            console.log(`    ${SKILL_NAMES[i]}: ${level}`);
        }
    }

    return result;
}

// Re-export ZONES for convenience
export { ZONES } from './gameData.js';

// If running directly with Node.js
if (typeof process !== 'undefined' && process.argv[1]?.includes('simulator')) {
    runBaselineSimulation(15);
}
