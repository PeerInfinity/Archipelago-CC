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
 * Get all tasks available for farming/grinding in a zone
 * Excludes Travel tasks (only done when ready to advance)
 */
function getGrindableTasks(zoneId, state) {
    const zone = ZONES[zoneId];
    if (!zone) return [];

    const tasks = [];
    for (const task of zone.tasks) {
        // Skip Travel tasks (only do these when advancing to next zone)
        if (task.type === TaskType.Travel) continue;
        // Skip hidden tasks
        if (task.hidden) continue;

        const singleRepCost = calcTaskEnergyCostSingleRep(task, zoneId, state);
        const xpPerRep = calcTaskXp(task, zoneId, state);
        const hasPerk = task.perk !== null && !state.perks.has(task.perk);
        const hasEnergyItem = task.item !== null && ENERGY_ITEMS[task.item] !== undefined;

        tasks.push({
            task,
            zoneId,
            singleRepCost,
            fullCost: calcTaskEnergyCost(task, zoneId, state),
            xpPerRep,
            xpPerEnergy: xpPerRep / singleRepCost,
            hasPerk,
            hasEnergyItem,
            energyPerItem: hasEnergyItem ? ENERGY_ITEMS[task.item] : 0,
        });
    }
    return tasks;
}

/**
 * Calculate total energy value of held items
 */
function calcItemEnergy(state) {
    let total = 0;
    for (const [itemType, count] of state.items) {
        const energyPerItem = ENERGY_ITEMS[itemType];
        if (energyPerItem !== undefined) {
            total += energyPerItem * count;
        }
    }
    return total;
}

/**
 * Simulate a single run (until energy runs out or game complete)
 * Strategy: Farm XP and unlock perks first, only push zones when efficient
 *
 * Run types:
 * - "collect": Gather items but don't consume them (save for push run)
 * - "push": Consume all items at start for maximum energy
 * - "auto": Decide based on whether items would help reach a new zone
 *
 * Returns the highest zone reached and updated state
 */
export function simulateRun(state, options = {}) {
    const {
        maxZone = ZONES.length - 1,
        verbose = false,
        runType = "auto" // "collect", "push", or "auto"
    } = options;

    let energy = state.maxEnergy;
    const runLog = [];

    // Start from zone 0 (we always start each run from the beginning)
    let currentZone = 0;

    // Determine if this should be a push run
    const itemEnergy = calcItemEnergy(state);
    const nextZoneCost = state.highestZone >= 0
        ? calcZoneMandatoryEnergyCost(state.highestZone + 1, state)
        : calcZoneMandatoryEnergyCost(0, state);

    // For "auto" mode, decide based on item accumulation:
    // - If items could help reach a new zone, push
    // - Otherwise, alternate: collect until items are "ripe" (accumulated enough to be worth using)
    // Items decay 50% per reset, so optimal is to push when items would give significant boost
    const itemsCouldReachNewZone = energy + itemEnergy >= nextZoneCost * 0.9;
    // Push when items have accumulated to give at least 40% extra energy
    const itemsAreRipe = itemEnergy >= energy * 0.4;
    const shouldPush = runType === "push" ||
        (runType === "auto" && itemEnergy > 0 && (itemsCouldReachNewZone || itemsAreRipe));

    if (shouldPush && itemEnergy > 0) {
        const consumed = consumeItemsForEnergy(state);
        energy += consumed;
        if (verbose) {
            runLog.push(`PUSH RUN: Consumed items for +${consumed.toFixed(1)} energy, total: ${energy.toFixed(1)}`);
        }
    } else if (verbose && itemEnergy > 0) {
        runLog.push(`COLLECT RUN: Saving ${itemEnergy.toFixed(0)} energy worth of items`);
    }

    // Main loop: make decisions about what to do with our energy
    while (energy > 0 && currentZone <= maxZone) {
        const zone = ZONES[currentZone];
        const grindableTasks = getGrindableTasks(currentZone, state);

        // Calculate cost to complete this zone and advance
        const mandatoryCost = calcZoneMandatoryEnergyCost(currentZone, state);
        const canAdvance = mandatoryCost <= energy;

        // Check if we should advance to next zone
        // Advance if: we can afford it AND have at least 20% spare energy for farming
        const shouldAdvance = canAdvance && (
            currentZone <= state.highestZone || // Already cleared this zone before
            energy >= mandatoryCost * 1.2 // Have some energy to spare for next zone
        );

        if (shouldAdvance) {
            if (verbose) {
                runLog.push(`Zone ${currentZone} (${zone.name}): advancing (cost=${mandatoryCost.toFixed(1)}, energy=${energy.toFixed(1)})`);
            }

            // Complete mandatory tasks
            energy -= mandatoryCost;
            const mandatoryTasks = getMandatoryTasks(zone);
            for (const task of mandatoryTasks) {
                applyTaskXp(task, currentZone, state);
                if (task.item !== null) {
                    addItems(state, task.item, task.maxReps);
                }
                if (task.perk !== null) {
                    state.perks.add(task.perk);
                    if (verbose) {
                        runLog.push(`  Unlocked perk: ${task.perk}`);
                    }
                }
            }

            // Also collect energy items while passing through (they're worth it)
            for (const gt of grindableTasks) {
                if (gt.hasEnergyItem && gt.fullCost <= energy) {
                    energy -= gt.fullCost;
                    applyTaskXp(gt.task, currentZone, state);
                    addItems(state, gt.task.item, gt.task.maxReps);
                    if (verbose) {
                        runLog.push(`  Collecting ${gt.task.name}`);
                    }
                }
            }

            // On push runs, consume items immediately for more energy
            // On collect runs, save items for later
            if (shouldPush) {
                const newItemEnergy = consumeItemsForEnergy(state);
                if (newItemEnergy > 0) {
                    energy += newItemEnergy;
                    if (verbose) {
                        runLog.push(`  +${newItemEnergy.toFixed(0)} energy from items`);
                    }
                }
            }

            // Track highest zone
            if (currentZone > state.highestZone) {
                state.highestZone = currentZone;
            }

            currentZone++;
            continue;
        }

        // Otherwise, farm in current zone
        // Priority: 1) Perks we don't have, 2) Energy items, 3) Best XP/energy

        let didSomething = false;

        // First, try to unlock perks
        for (const gt of grindableTasks) {
            if (gt.hasPerk && gt.fullCost <= energy) {
                energy -= gt.fullCost;
                applyTaskXp(gt.task, currentZone, state);
                state.perks.add(gt.task.perk);
                if (gt.task.item !== null) {
                    addItems(state, gt.task.item, gt.task.maxReps);
                }
                if (verbose) {
                    runLog.push(`  ${gt.task.name}: unlocked perk (cost=${gt.fullCost.toFixed(1)})`);
                }
                didSomething = true;
                break;
            }
        }

        if (!didSomething) {
            // Second, do energy item tasks
            for (const gt of grindableTasks) {
                if (gt.hasEnergyItem && gt.fullCost <= energy) {
                    energy -= gt.fullCost;
                    applyTaskXp(gt.task, currentZone, state);
                    addItems(state, gt.task.item, gt.task.maxReps);
                    // On push runs, consume immediately; on collect runs, save items
                    if (shouldPush) {
                        const gained = consumeItemsForEnergy(state);
                        energy += gained;
                        if (verbose) {
                            runLog.push(`  ${gt.task.name}: -${gt.fullCost.toFixed(1)} +${gained.toFixed(1)} energy`);
                        }
                    } else {
                        if (verbose) {
                            runLog.push(`  ${gt.task.name}: collected (saving items)`);
                        }
                    }
                    didSomething = true;
                    break;
                }
            }
        }

        if (!didSomething) {
            // Third, farm best XP task (single reps)
            const sortedByXp = [...grindableTasks].sort((a, b) => b.xpPerEnergy - a.xpPerEnergy);
            for (const gt of sortedByXp) {
                if (gt.singleRepCost <= energy) {
                    const reps = Math.min(
                        Math.floor(energy / gt.singleRepCost),
                        gt.task.maxReps * 3 // Cap farming to avoid infinite loops
                    );
                    if (reps > 0) {
                        energy -= reps * gt.singleRepCost;
                        applyTaskXp(gt.task, currentZone, state, 1, reps);
                        if (verbose) {
                            runLog.push(`  ${gt.task.name} x${reps}: -${(reps * gt.singleRepCost).toFixed(1)} energy`);
                        }
                        didSomething = true;
                        break;
                    }
                }
            }
        }

        if (!didSomething) {
            // Can't do anything useful in this zone, try to advance anyway if possible
            if (canAdvance) {
                if (verbose) {
                    runLog.push(`Zone ${currentZone}: nothing to farm, advancing`);
                }
                energy -= mandatoryCost;
                const mandatoryTasks = getMandatoryTasks(zone);
                for (const task of mandatoryTasks) {
                    applyTaskXp(task, currentZone, state);
                    if (task.item !== null) {
                        addItems(state, task.item, task.maxReps);
                    }
                    if (task.perk !== null) {
                        state.perks.add(task.perk);
                    }
                }
                const newItemEnergy = consumeItemsForEnergy(state);
                energy += newItemEnergy;
                if (currentZone > state.highestZone) {
                    state.highestZone = currentZone;
                }
                currentZone++;
            } else {
                // Can't afford to advance and nothing to do - end run
                if (verbose) {
                    runLog.push(`Zone ${currentZone}: stuck (need ${mandatoryCost.toFixed(1)}, have ${energy.toFixed(1)})`);
                }
                break;
            }
        }
    }

    return {
        highestZoneReached: state.highestZone,
        remainingEnergy: energy,
        state,
        runLog,
        isPushRun: shouldPush,
        itemsHeld: calcItemEnergy(state),
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
