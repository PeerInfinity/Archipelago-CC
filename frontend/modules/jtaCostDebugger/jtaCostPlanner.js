/**
 * JTA Cost Planner - Simulated playthrough cost generation
 *
 * Constructs cost data (costMult/xpMult) by simulating a playthrough step by step,
 * generating one action queue per step. Costs are assigned the first time a task
 * appears in the queue, based on what the simulated player can afford.
 *
 * Algorithm per step:
 *   1. Build an action queue: zone traversal (mandatory/travel) → target task → XP grinding
 *   2. Walk the queue; for the first uncosted task:
 *      - Regular tasks: set costMult so energy cost = remaining energy (1st attempt)
 *      - Perk/Boss tasks: set costMult so it takes N attempts (configurable)
 *   3. Simulate the queue (energy drain, XP gain)
 *   4. Reset and repeat until all sphere tasks are completed
 *
 * Modeled after the Loops CostPlanner pattern: simulated playthrough with
 * step-by-step reporting.
 */

import { loadGameDataFromJson } from '../jta-randomizer/jtaGameDataLoader.js';
import { parseSphereLog } from '../jta-randomizer/jtaCostGenerator.js';

// ============================================================================
// Simulation Helpers (mirror jtaCostGenerator's internal functions)
// ============================================================================

function createSimState(ctx) {
    return {
        maxEnergy: ctx.STARTING_ENERGY,
        skillLevels: {},
        skillXp: {},
        perks: new Set(),
        highestZone: -1,
        highestZoneFullyCompleted: -1,
        currentZone: 0,
        // Items/prestige not tracked in cost planning (first playthrough)
        skillSpeedModifiers: {},
        power: 0,
        attunement: 0,
        bottledLightnings: 0,
        prestigeUnlocks: new Set(),
        prestigeRepeatables: new Map(),
    };
}

function cloneState(state) {
    return {
        maxEnergy: state.maxEnergy,
        skillLevels: { ...state.skillLevels },
        skillXp: { ...state.skillXp },
        perks: new Set(state.perks),
        highestZone: state.highestZone,
        highestZoneFullyCompleted: state.highestZoneFullyCompleted,
        currentZone: state.currentZone,
        skillSpeedModifiers: { ...state.skillSpeedModifiers },
        power: state.power,
        attunement: state.attunement,
        bottledLightnings: state.bottledLightnings,
        prestigeUnlocks: new Set(state.prestigeUnlocks),
        prestigeRepeatables: new Map(state.prestigeRepeatables),
    };
}

function snapshotState(state) {
    return {
        maxEnergy: state.maxEnergy,
        skillLevels: { ...state.skillLevels },
        skillXp: { ...state.skillXp },
        perks: [...state.perks],
        highestZone: state.highestZone,
        currentZone: state.currentZone,
    };
}

// --- Energy/Cost Calculations ---

function calcTaskBaseCost(task, zoneId, ctx) {
    const exp = task.type === ctx.TaskType.Boss
        ? ctx.BOSS_COST_EXPONENT
        : ctx.ZONE_COST_EXPONENT;
    return ctx.BASE_COST * task.costMult * Math.pow(exp, zoneId);
}

function calcProgressMult(task, zoneId, state, ctx) {
    let mult = 1.0;

    // Skill level bonus (geometric mean for multi-skill tasks)
    let skillMult = 1.0;
    for (const skill of task.skills) {
        const level = state.skillLevels[skill] || 0;
        skillMult *= Math.pow(ctx.SKILL_LEVEL_EXPONENT, level);
    }
    if (task.skills.length > 0) {
        mult *= Math.pow(skillMult, 1 / task.skills.length);
    }

    // Perk skill modifiers
    for (const perkId of state.perks) {
        const perk = ctx.PERKS[perkId];
        if (!perk) continue;
        for (const skill of task.skills) {
            const mod = perk.skillModifiers[skill];
            if (mod) mult *= (1 + mod);
        }
    }

    // Zone speedup
    mult *= Math.pow(ctx.ZONE_SPEEDUP_BASE, zoneId);

    return mult;
}

function calcTicks(task, zoneId, state, ctx) {
    const cost = calcTaskBaseCost(task, zoneId, ctx);
    const progress = calcProgressMult(task, zoneId, state, ctx);
    return Math.ceil(cost / progress);
}

function isSingleTick(task, zoneId, state, ctx) {
    return calcTicks(task, zoneId, state, ctx) <= 1;
}

function calcDrainPerTick(task, zoneId, state, ctx) {
    const singleTick = isSingleTick(task, zoneId, state, ctx);
    let drain = 1;

    if (singleTick && state.perks.has(ctx.PerkType.MinorTimeCompression)) {
        drain *= 0.2;
    }
    if (state.perks.has(ctx.PerkType.HighAltitudeClimbing)) {
        drain *= 0.8;
    }
    if (state.perks.has(ctx.PerkType.ReflectionsOnTheJourney)) {
        const zoneDiff = Math.max(0, state.highestZone - zoneId);
        drain *= Math.pow(0.95, zoneDiff);
    }
    drain *= Math.pow(ctx.ZONE_SPEEDUP_BASE, zoneId);

    return drain;
}

function calcTaskEnergyCost(task, zoneId, state, ctx) {
    const ticks = calcTicks(task, zoneId, state, ctx);
    const drain = calcDrainPerTick(task, zoneId, state, ctx);
    return ticks * drain * task.maxReps;
}

function getMandatoryTasks(zone, ctx) {
    return zone.tasks.filter(t =>
        t.type === ctx.TaskType.Mandatory || t.type === ctx.TaskType.Travel
    );
}

function getNormalTasks(zone, ctx) {
    return zone.tasks.filter(t => t.type === ctx.TaskType.Normal);
}

// --- XP Calculations ---

function calcTaskXp(task, zoneId, state, ctx) {
    const cost = calcTaskBaseCost(task, zoneId, ctx);
    let xp = cost * 8 * task.xpMult;
    if (state.perks.has(ctx.PerkType.Writing)) xp *= 1.5;
    xp *= Math.pow(1.25, zoneId);
    return xp;
}

function calcXpNeeded(level, skillType, ctx) {
    const skillMult = ctx.SKILL_XP_MULT[skillType] || 1;
    return Math.pow(ctx.SKILL_XP_EXPONENT, level) * 10 * skillMult;
}

function applyTaskXp(task, zoneId, state, ctx) {
    const xpPerRep = calcTaskXp(task, zoneId, state, ctx);
    const totalXp = xpPerRep * task.maxReps;

    for (const skill of task.skills) {
        if (state.skillLevels[skill] === undefined) {
            state.skillLevels[skill] = 0;
            state.skillXp[skill] = 0;
        }
        state.skillXp[skill] += totalXp;
        let needed = calcXpNeeded(state.skillLevels[skill], skill, ctx);
        while (state.skillXp[skill] >= needed) {
            state.skillXp[skill] -= needed;
            state.skillLevels[skill]++;
            needed = calcXpNeeded(state.skillLevels[skill], skill, ctx);
        }
    }
}

// --- State Management ---

function grantPerk(state, perkType, ctx) {
    if (perkType === null || perkType === undefined || state.perks.has(perkType)) return;
    if (perkType === ctx.PerkType.EnergySpell) {
        state.maxEnergy += 50;
    }
    state.perks.add(perkType);
}

function doReset(state, ctx) {
    if (state.perks.has(ctx.PerkType.EnergeticMemory)) {
        state.maxEnergy += (state.currentZone + 1) * 0.1;
    }
    state.highestZoneFullyCompleted = Math.max(
        state.highestZoneFullyCompleted,
        state.highestZone - 1
    );
    state.currentZone = 0;
}

// ============================================================================
// Cost Solving
// ============================================================================

/**
 * Solve for costMult that makes a task cost exactly `targetEnergy`.
 *
 * energyCost = ceil(BASE_COST * costMult * exp^zone / progress) * drainPerTick * maxReps
 *
 * We solve approximately then verify with ceil.
 */
function solveCostMultForEnergy(task, zoneId, targetEnergy, state, ctx, margin = 0.95) {
    const exp = task.type === ctx.TaskType.Boss
        ? ctx.BOSS_COST_EXPONENT
        : ctx.ZONE_COST_EXPONENT;
    const progress = calcProgressMult(task, zoneId, state, ctx);
    const drain = calcDrainPerTick(task, zoneId, state, ctx);
    const maxReps = task.maxReps;

    if (drain <= 0 || maxReps <= 0) return 0.01;

    // Target: ceil(BASE_COST * costMult * exp^zone / progress) * drain * maxReps = targetEnergy * margin
    // Approximate (ignoring ceil):
    // costMult = (targetEnergy * margin * progress) / (BASE_COST * exp^zone * drain * maxReps)
    const expPow = Math.pow(exp, zoneId);
    const approxCostMult = (targetEnergy * margin * progress) / (ctx.BASE_COST * expPow * drain * maxReps);

    // Verify and adjust for ceil
    const savedCost = task.costMult;
    task.costMult = approxCostMult;
    let actualCost = calcTaskEnergyCost(task, zoneId, state, ctx);

    // Binary refine if needed (3 iterations)
    let lo = approxCostMult * 0.5;
    let hi = approxCostMult * 2.0;
    const target = targetEnergy * margin;

    for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        task.costMult = mid;
        actualCost = calcTaskEnergyCost(task, zoneId, state, ctx);
        if (actualCost > target) {
            hi = mid;
        } else {
            lo = mid;
        }
    }

    // Use `lo` (last verified-affordable value), not the midpoint.
    // The ceil() in tick calculation makes cost a step function, so
    // (lo+hi)/2 can land on the wrong side of a step boundary.
    const result = Math.max(0.01, lo);
    task.costMult = savedCost;
    return result;
}

/**
 * Solve for costMult that makes a task require exactly `targetAttempts` attempts.
 *
 * Uses binary search with actual simulation: for each candidate costMult, runs
 * the same queue-walking logic as the main planner loop — including trial-costing
 * of new tasks encountered during attempts — to count how many attempts it
 * actually takes.
 *
 * @param {Map} assignedCosts - Already-assigned costs (from prior steps)
 * @param {object} settings - Planner settings (energyMargin, attempt counts)
 */
function solveCostMultForAttempts(task, zoneId, targetAttempts, remainingEnergyAtTask, state, ctx, assignedCosts, settings) {
    if (targetAttempts <= 1) {
        return solveCostMultForEnergy(task, zoneId, remainingEnergyAtTask, state, ctx);
    }

    const savedCost = task.costMult;

    // Binary search on log scale for costMult.
    // The attempt count is discrete (integer), so an exact match may not exist
    // (e.g., attempts may jump from 4 to 6, skipping 5). We track the best
    // candidate: the highest costMult where attempts <= targetAttempts.
    // This gives maximum difficulty while ensuring completability within target.
    let logLo = Math.log(0.01);
    let logHi = Math.log(100000);
    let bestCost = null;
    let bestAttempts = 0;

    for (let iter = 0; iter < 30; iter++) {
        const logMid = (logLo + logHi) / 2;
        const candidateCost = Math.exp(logMid);
        task.costMult = candidateCost;

        const attempts = simulateActualAttempts(task, zoneId, state, ctx, assignedCosts, targetAttempts + 10, settings);

        if (attempts <= targetAttempts) {
            // Completable within target — track highest costMult that works
            if (bestCost === null || candidateCost > bestCost) {
                bestCost = candidateCost;
                bestAttempts = attempts;
            }
            logLo = logMid; // Try higher cost
        } else {
            logHi = logMid; // Too hard, lower cost
        }
    }

    task.costMult = savedCost;
    return Math.max(0.01, bestCost ?? 0.01);
}

/**
 * Simulate actual attempts using the same logic as the main planner loop.
 *
 * Mirrors the main loop exactly:
 * - Each attempt builds an action queue and walks it
 * - The first uncosted task (other than the target) gets trial-costed
 *   using solveCostMultForEnergy, just as the main loop would
 * - Trial costs persist across attempts within this simulation
 * - Costed tasks: check affordability, deduct energy, apply XP
 * - Unaffordable tasks: break
 * - Reset between attempts
 *
 * All trial costMult modifications are restored before returning.
 *
 * Returns the 1-based attempt number on which the task is completed.
 * (1 = first try, 5 = fifth try, maxAttempts+1 = never completed)
 */
function simulateActualAttempts(task, zoneId, state, ctx, assignedCosts, maxAttempts, settings) {
    const sim = cloneState(state);
    const margin = settings?.energyMargin ?? 0.95;

    // Track trial costs assigned during simulation (separate from real assignedCosts)
    const trialCosts = new Map();
    // Save original costMults for tasks we modify, so we can restore them
    const savedCostMults = new Map();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Build queue using both real and trial costs for the isCosted check
        const effectiveCosts = new Map([...assignedCosts, ...trialCosts]);
        const queue = buildActionQueue(task, zoneId, sim, ctx, effectiveCosts);
        let energy = sim.maxEnergy;
        let completed = false;
        let firstNewCosted = false;

        for (const entry of queue) {
            const isTarget = entry.task.name === task.name;
            const isCosted = effectiveCosts.has(entry.task.name) || isTarget;

            if (!isCosted) {
                if (!firstNewCosted) {
                    // Trial-cost this task as the main loop would (1-attempt tasks only)
                    firstNewCosted = true;
                    const taskAttempts = getTargetAttempts(entry.task, ctx, settings || {});
                    if (taskAttempts <= 1) {
                        if (!savedCostMults.has(entry.task.name)) {
                            savedCostMults.set(entry.task.name, entry.task.costMult);
                        }
                        const trialCostMult = solveCostMultForEnergy(
                            entry.task, entry.zoneId, energy, sim, ctx, margin
                        );
                        entry.task.costMult = trialCostMult;
                        trialCosts.set(entry.task.name, { costMult: trialCostMult });
                        // Fall through to execute it
                    } else {
                        // Multi-attempt task encountered during simulation — skip to avoid recursion
                        continue;
                    }
                } else {
                    continue;
                }
            }

            const energyCost = calcTaskEnergyCost(entry.task, entry.zoneId, sim, ctx);
            if (energyCost > energy) {
                break;
            }

            energy -= energyCost;
            applyTaskXp(entry.task, entry.zoneId, sim, ctx);

            if (entry.zoneId > sim.highestZone) sim.highestZone = entry.zoneId;
            sim.currentZone = entry.zoneId;

            if (isTarget) {
                completed = true;
            }
        }

        if (completed) {
            // Restore all modified costMults
            for (const [name, origCost] of savedCostMults) {
                const taskInfo = findTaskByName(name, ctx);
                if (taskInfo) taskInfo.task.costMult = origCost;
            }
            return attempt;
        }

        doReset(sim, ctx);
    }

    // Restore all modified costMults
    for (const [name, origCost] of savedCostMults) {
        const taskInfo = findTaskByName(name, ctx);
        if (taskInfo) taskInfo.task.costMult = origCost;
    }
    return maxAttempts + 1;
}

/**
 * Find a task by name across all zones.
 */
function findTaskByName(name, ctx) {
    for (const zone of ctx.ZONES) {
        for (const task of zone.tasks) {
            if (task.name === name) return { task, zoneId: zone.id };
        }
    }
    return null;
}

// ============================================================================
// Action Queue Generation (simplified strategy for cost planning)
// ============================================================================

/**
 * Build an action queue for reaching and completing a target task.
 * Queue: zone traversal (zones before targetZone) → target task → XP grinding.
 * The player starts in zone 0, so no traversal is needed for zone 0 tasks.
 * Mandatory/travel tasks in a zone are required to LEAVE that zone for the next one.
 */
function buildActionQueue(targetTask, targetZoneId, state, ctx, assignedCosts) {
    const queue = [];

    // Zone traversal: mandatory/travel tasks for zones BEFORE targetZoneId
    // (completing these lets the player travel through to the target zone)
    // Sort order within each zone:
    //   1. Costed mandatory tasks (known costs deducted first for accurate energy calc)
    //   2. Uncosted mandatory tasks (will be costed based on remaining energy)
    //   3. Travel task (last — requires all mandatory tasks complete)
    // The game allows mandatory tasks in any order, so this reordering is valid.
    for (let z = 0; z < targetZoneId && z < ctx.ZONES.length; z++) {
        const zone = ctx.ZONES[z];
        const tasks = getMandatoryTasks(zone, ctx).slice().sort((a, b) => {
            const aIsTravel = a.type === ctx.TaskType.Travel;
            const bIsTravel = b.type === ctx.TaskType.Travel;
            // Travel tasks always last
            if (aIsTravel !== bIsTravel) return aIsTravel ? 1 : -1;
            // Among non-travel: costed tasks before uncosted
            const aCosted = assignedCosts.has(a.name) ? 0 : 1;
            const bCosted = assignedCosts.has(b.name) ? 0 : 1;
            return aCosted - bCosted;
        });
        for (const task of tasks) {
            queue.push({
                task,
                zoneId: z,
                zoneName: zone.name,
                type: 'traversal',
                isCosted: assignedCosts.has(task.name),
            });
        }
    }

    // Target task
    queue.push({
        task: targetTask,
        zoneId: targetZoneId,
        zoneName: ctx.ZONES[targetZoneId]?.name || `Zone ${targetZoneId}`,
        type: getTaskCategory(targetTask, ctx),
        isCosted: assignedCosts.has(targetTask.name),
    });

    // XP grinding: normal tasks in reachable zones (highest zone first for better XP)
    for (let z = targetZoneId; z >= 0; z--) {
        const zone = ctx.ZONES[z];
        for (const task of getNormalTasks(zone, ctx)) {
            if (task.name === targetTask.name) continue;
            queue.push({
                task,
                zoneId: z,
                zoneName: zone.name,
                type: 'grinding',
                isCosted: assignedCosts.has(task.name),
            });
        }
    }

    return queue;
}

function getTaskCategory(task, ctx) {
    if (task.perk !== null && task.perk !== undefined) return 'perk';
    if (task.type === ctx.TaskType.Boss) return 'boss';
    if (task.type === ctx.TaskType.Mandatory || task.type === ctx.TaskType.Travel) return 'traversal';
    return 'normal';
}

function getTargetAttempts(task, ctx, settings) {
    const category = getTaskCategory(task, ctx);
    if (category === 'perk') return settings.perkAttempts;
    if (category === 'boss') return settings.bossAttempts;
    return settings.normalAttempts;
}

// ============================================================================
// Main Planner
// ============================================================================

/**
 * Default settings for the JTA Cost Planner.
 */
export const DEFAULT_SETTINGS = {
    normalAttempts: 1,     // Regular tasks completable on 1st try
    perkAttempts: 5,       // Perk tasks completable on 5th try
    bossAttempts: 5,       // Boss tasks completable on 5th try
    playerNumber: 1,
    energyMargin: 0.95,    // Leave 5% margin on energy calculations
};

/**
 * JTA Cost Planner
 *
 * Plans cost generation via simulated playthrough, producing detailed
 * step-by-step reports like the Loops CostPlanner.
 */
export class JTACostPlanner {
    constructor() {
        this._steps = [];
        this._costData = null;
        this._settings = { ...DEFAULT_SETTINGS };
        this._lastPlanResult = null;
        this._verificationResults = null;
    }

    getPlannedSteps() { return this._steps; }
    getCostData() { return this._costData; }
    getSettings() { return { ...this._settings }; }
    getLastPlanResult() { return this._lastPlanResult; }
    getVerificationResults() { return this._verificationResults; }

    updateSettings(newSettings) {
        Object.assign(this._settings, newSettings);
    }

    /**
     * Plan all costs from game data + sphere log.
     *
     * @param {object} gameDataJson - Raw game data JSON
     * @param {string} sphereLogContent - JSONL sphere log content
     * @param {object} [settingsOverride] - Override default settings
     * @returns {{ costData: object, steps: Array, adjustedData: object }}
     */
    planCosts(gameDataJson, sphereLogContent, settingsOverride = {}) {
        const settings = { ...this._settings, ...settingsOverride };

        // Parse inputs
        const steps = parseSphereLog(sphereLogContent, settings.playerNumber);
        const adjustedData = JSON.parse(JSON.stringify(gameDataJson));
        const ctx = loadGameDataFromJson(adjustedData);

        // Build lookups
        const taskByName = new Map();
        for (const zone of ctx.ZONES) {
            for (const task of zone.tasks) {
                taskByName.set(task.name, { task, zoneId: zone.id });
            }
        }
        const perkNameToId = new Map();
        for (const [idStr, perk] of Object.entries(ctx.PERKS)) {
            perkNameToId.set(perk.name, parseInt(idStr));
        }

        // Initialize simulation
        const state = createSimState(ctx);
        const assignedCosts = new Map(); // taskName → { costMult, xpMult, assignedOnStep }
        const plannedSteps = [];
        let globalStepIndex = 0;

        // Process each sphere
        for (const sphereStep of steps) {
            const sphereIndex = sphereStep.sphereIndex;

            // Tasks to complete this sphere
            const tasksToComplete = [];
            for (const locName of sphereStep.locationsChecked) {
                if (locName === 'Reach Goal Zone') continue;
                const info = taskByName.get(locName);
                if (info) tasksToComplete.push({ name: locName, ...info });
            }

            // Process each task in the sphere
            for (const targetInfo of tasksToComplete) {
                const { task: sphereTarget, zoneId: sphereTargetZoneId, name: sphereTargetName } = targetInfo;
                let sphereTargetCompleted = false;
                const maxSteps = 200; // safety limit
                let safetyCounter = 0;

                while (!sphereTargetCompleted && safetyCounter++ < maxSteps) {
                    // Build queue for the sphere target
                    const queue = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);

                    // Find the first uncosted task — this becomes the "focus" of the next step(s)
                    let focusEntry = null;
                    for (const entry of queue) {
                        if (!assignedCosts.has(entry.task.name)) {
                            focusEntry = entry;
                            break;
                        }
                    }

                    if (!focusEntry) {
                        // All tasks costed but sphere target not completed — shouldn't happen
                        break;
                    }

                    const focusTask = focusEntry.task;
                    const focusZoneId = focusEntry.zoneId;
                    const focusZoneName = focusEntry.zoneName;
                    const focusCategory = getTaskCategory(focusTask, ctx);
                    const focusAttempts = getTargetAttempts(focusTask, ctx, settings);

                    // Simulate the queue up to the focus task to get accurate energy
                    // and state (with XP from preceding tasks applied).
                    // This ensures the solver sees the same state execution will see.
                    const stateBeforeCost = cloneState(state);
                    const stateAtFocus = cloneState(state);
                    let energyAtFocus = state.maxEnergy;
                    for (const entry of queue) {
                        if (entry.task.name === focusTask.name) break;
                        if (assignedCosts.has(entry.task.name)) {
                            const cost = calcTaskEnergyCost(entry.task, entry.zoneId, stateAtFocus, ctx);
                            if (cost <= energyAtFocus) {
                                energyAtFocus -= cost;
                                applyTaskXp(entry.task, entry.zoneId, stateAtFocus, ctx);
                                if (entry.zoneId > stateAtFocus.highestZone) stateAtFocus.highestZone = entry.zoneId;
                                stateAtFocus.currentZone = entry.zoneId;
                            } else {
                                energyAtFocus = 0;
                                break;
                            }
                        }
                    }

                    // If the focus task is unreachable (preceding costed tasks consume
                    // all energy), don't cost it yet. Run a grinding step to gain XP —
                    // skills will reduce preceding costs on the next reset.
                    if (energyAtFocus <= 0) {
                        const stateBefore = snapshotState(state);
                        const stepQueue = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);

                        let energy = state.maxEnergy;
                        const queueResults = [];

                        for (const entry of stepQueue) {
                            const { task, zoneId, zoneName, type } = entry;
                            if (!assignedCosts.has(task.name)) {
                                queueResults.push({
                                    taskName: task.name, zoneName, zoneId, type,
                                    status: 'uncosted_skipped',
                                    energyBefore: energy, energyCost: 0, energyAfter: energy,
                                });
                                continue;
                            }
                            const energyCost = calcTaskEnergyCost(task, zoneId, state, ctx);
                            if (energyCost > energy) {
                                queueResults.push({
                                    taskName: task.name, zoneName, zoneId, type,
                                    status: 'cannot_afford',
                                    energyBefore: energy, energyCost, energyAfter: energy,
                                });
                                break;
                            }
                            energy -= energyCost;
                            applyTaskXp(task, zoneId, state, ctx);
                            if (zoneId > state.highestZone) state.highestZone = zoneId;
                            state.currentZone = zoneId;
                            queueResults.push({
                                taskName: task.name, zoneName, zoneId, type,
                                status: 'completed',
                                energyBefore: energy + energyCost, energyCost, energyAfter: energy,
                            });
                        }

                        plannedSteps.push({
                            stepIndex: globalStepIndex,
                            sphereIndex,
                            targetTask: focusTask.name,
                            targetZone: focusZoneName,
                            targetZoneId: focusZoneId,
                            targetCategory: focusCategory,
                            targetAttempts: focusAttempts,
                            attemptNumber: 0,
                            targetCompleted: false,
                            costAssignment: null,
                            queue: queueResults,
                            stateBefore,
                            stateAfter: snapshotState(state),
                            energyBudget: state.maxEnergy,
                            energyUsed: state.maxEnergy - energy,
                            energyRemaining: energy,
                            notes: [`Focus "${focusTask.name}" unreachable (0 energy at position), grinding for XP`],
                        });

                        globalStepIndex++;
                        doReset(state, ctx);
                        continue; // back to while loop — try again with improved skills
                    }

                    // Assign cost to the focus task
                    // Use stateAtFocus for 1-attempt tasks (matches execution state)
                    // Use stateBeforeCost for multi-attempt tasks (simulation re-walks full queue)
                    let newCostMult;
                    if (focusAttempts <= 1) {
                        newCostMult = solveCostMultForEnergy(
                            focusTask, focusZoneId, energyAtFocus, stateAtFocus, ctx, settings.energyMargin
                        );
                    } else {
                        newCostMult = solveCostMultForAttempts(
                            focusTask, focusZoneId, focusAttempts, energyAtFocus,
                            stateBeforeCost, ctx, assignedCosts, settings
                        );
                    }

                    focusTask.costMult = newCostMult;
                    assignedCosts.set(focusTask.name, {
                        costMult: newCostMult,
                        xpMult: focusTask.xpMult,
                        assignedOnStep: globalStepIndex,
                        category: focusCategory,
                        targetAttempts: focusAttempts,
                        energyAtAssignment: energyAtFocus,
                        zoneId: focusZoneId,
                    });

                    const costAssignment = {
                        taskName: focusTask.name,
                        zoneName: focusZoneName,
                        zoneId: focusZoneId,
                        category: focusCategory,
                        costMult: newCostMult,
                        xpMult: focusTask.xpMult,
                        targetAttempts: focusAttempts,
                        energyAvailable: energyAtFocus,
                        formula: focusAttempts <= 1
                            ? `costMult solved for energyCost = ${(energyAtFocus * settings.energyMargin).toFixed(1)} (${(settings.energyMargin * 100).toFixed(0)}% of ${energyAtFocus.toFixed(1)} remaining)`
                            : `costMult solved for ${focusAttempts} attempts (binary search with actual simulation)`,
                    };

                    // Run attempts for the focus task
                    let focusCompleted = false;
                    for (let attempt = 1; attempt <= focusAttempts + 20 && !focusCompleted; attempt++) {
                        const stateBefore = snapshotState(state);
                        const stepQueue = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);

                        let energy = state.maxEnergy;
                        const queueResults = [];

                        for (const entry of stepQueue) {
                            const { task, zoneId, zoneName, type } = entry;

                            if (!assignedCosts.has(task.name)) {
                                // Uncosted task — skip (will be its own focus later)
                                queueResults.push({
                                    taskName: task.name, zoneName, zoneId, type,
                                    status: 'uncosted_skipped',
                                    energyBefore: energy, energyCost: 0, energyAfter: energy,
                                });
                                continue;
                            }

                            const energyCost = calcTaskEnergyCost(task, zoneId, state, ctx);
                            if (energyCost > energy) {
                                queueResults.push({
                                    taskName: task.name, zoneName, zoneId, type,
                                    status: 'cannot_afford',
                                    energyBefore: energy, energyCost, energyAfter: energy,
                                });
                                break;
                            }

                            energy -= energyCost;
                            applyTaskXp(task, zoneId, state, ctx);

                            if (zoneId > state.highestZone) state.highestZone = zoneId;
                            state.currentZone = zoneId;

                            queueResults.push({
                                taskName: task.name, zoneName, zoneId, type,
                                status: 'completed',
                                energyBefore: energy + energyCost, energyCost, energyAfter: energy,
                                xpGained: calcTaskXp(task, zoneId, state, ctx) * task.maxReps,
                            });

                            if (task.name === focusTask.name) {
                                focusCompleted = true;
                            }
                            if (task.name === sphereTargetName) {
                                sphereTargetCompleted = true;
                            }
                        }

                        const stateAfter = snapshotState(state);

                        plannedSteps.push({
                            stepIndex: globalStepIndex,
                            sphereIndex,
                            targetTask: focusTask.name,
                            targetZone: focusZoneName,
                            targetZoneId: focusZoneId,
                            targetCategory: focusCategory,
                            targetAttempts: focusAttempts,
                            attemptNumber: attempt,
                            targetCompleted: focusCompleted,
                            costAssignment: attempt === 1 ? costAssignment : null,
                            queue: queueResults,
                            stateBefore,
                            stateAfter,
                            energyBudget: state.maxEnergy,
                            energyUsed: state.maxEnergy - energy,
                            energyRemaining: energy,
                            notes: buildStepNotes(
                                attempt === 1 ? costAssignment : null,
                                focusCompleted, attempt, focusAttempts, focusTask.name
                            ),
                        });

                        globalStepIndex++;

                        if (!focusCompleted) {
                            doReset(state, ctx);
                        }
                    }
                }
            }

            // Grant perks received this sphere
            for (const perkName of sphereStep.perksReceived) {
                const perkId = perkNameToId.get(perkName);
                if (perkId !== undefined) {
                    grantPerk(state, perkId, ctx);
                }
            }
        }

        // Build cost data output (matching the format expected by the game)
        const costData = buildCostOutput(adjustedData, assignedCosts, ctx);

        // Sync assigned costs back to adjustedData
        for (const [taskName, costInfo] of assignedCosts) {
            const info = taskByName.get(taskName);
            if (!info) continue;
            info.task.costMult = costInfo.costMult;
            info.task.xpMult = costInfo.xpMult;
        }
        // Also sync to adjustedData zones
        for (let z = 0; z < ctx.ZONES.length && z < adjustedData.zones.length; z++) {
            for (let t = 0; t < ctx.ZONES[z].tasks.length && t < adjustedData.zones[z].tasks.length; t++) {
                adjustedData.zones[z].tasks[t].costMult = ctx.ZONES[z].tasks[t].costMult;
                adjustedData.zones[z].tasks[t].xpMult = ctx.ZONES[z].tasks[t].xpMult;
            }
        }

        this._steps = plannedSteps;
        this._costData = costData;

        const result = { costData, steps: plannedSteps, adjustedData, assignedCosts };
        this._lastPlanResult = result;
        this._verificationResults = null;
        return result;
    }

    /**
     * Verify planned costs by re-running the simulation with all costs pre-assigned.
     *
     * Instead of solving for costs, applies the previously assigned costMults
     * and runs the same step-by-step simulation. Compares actual attempt counts
     * and energy usage against the plan.
     *
     * @param {object} gameDataJson - Same game data used for planning
     * @param {string} sphereLogContent - Same sphere log used for planning
     * @param {Map|object} plannedCosts - assignedCosts from planCosts result
     * @param {object} [settingsOverride] - Override settings
     * @returns {{ verifySteps: Array, comparison: Array }}
     */
    verifyCosts(gameDataJson, sphereLogContent, plannedCosts, settingsOverride = {}) {
        const settings = { ...this._settings, ...settingsOverride };

        const steps = parseSphereLog(sphereLogContent, settings.playerNumber);
        const adjustedData = JSON.parse(JSON.stringify(gameDataJson));
        const ctx = loadGameDataFromJson(adjustedData);

        // Build lookups
        const taskByName = new Map();
        for (const zone of ctx.ZONES) {
            for (const task of zone.tasks) {
                taskByName.set(task.name, { task, zoneId: zone.id });
            }
        }
        const perkNameToId = new Map();
        for (const [idStr, perk] of Object.entries(ctx.PERKS)) {
            perkNameToId.set(perk.name, parseInt(idStr));
        }

        // Convert plannedCosts to Map if needed, and pre-apply all costs
        const costsMap = plannedCosts instanceof Map ? plannedCosts : new Map(Object.entries(plannedCosts));
        for (const [taskName, costInfo] of costsMap) {
            const info = taskByName.get(taskName);
            if (info) {
                info.task.costMult = costInfo.costMult;
                if (costInfo.xpMult !== undefined) info.task.xpMult = costInfo.xpMult;
            }
        }

        // All tasks are pre-costed — assignedCosts starts fully populated
        const assignedCosts = new Map(costsMap);

        const state = createSimState(ctx);
        const verifySteps = [];
        let globalStepIndex = 0;

        // Track actual attempts per task: how many resets before first completion
        const taskFirstCompleted = new Map(); // taskName → stepIndex when first completed
        const taskAttemptCounts = new Map();  // taskName → number of steps where task was attempted

        for (const sphereStep of steps) {
            const sphereIndex = sphereStep.sphereIndex;

            const tasksToComplete = [];
            for (const locName of sphereStep.locationsChecked) {
                if (locName === 'Reach Goal Zone') continue;
                const info = taskByName.get(locName);
                if (info) tasksToComplete.push({ name: locName, ...info });
            }

            for (const targetInfo of tasksToComplete) {
                const { task: sphereTarget, zoneId: sphereTargetZoneId, name: sphereTargetName } = targetInfo;
                let sphereTargetCompleted = false;
                const maxSteps = 200;
                let safetyCounter = 0;

                while (!sphereTargetCompleted && safetyCounter++ < maxSteps) {
                    const queue = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);

                    let energy = state.maxEnergy;
                    const queueResults = [];
                    let failedTask = null;
                    const tasksAttemptedThisStep = new Set();
                    const tasksCompletedThisStep = new Set();

                    for (const entry of queue) {
                        const { task, zoneId, zoneName, type } = entry;

                        // Track that this task was attempted (appeared in queue and was reachable)
                        tasksAttemptedThisStep.add(task.name);

                        const energyCost = calcTaskEnergyCost(task, zoneId, state, ctx);
                        if (energyCost > energy) {
                            queueResults.push({
                                taskName: task.name, zoneName, zoneId, type,
                                status: 'cannot_afford',
                                energyBefore: energy, energyCost, energyAfter: energy,
                            });
                            failedTask = task.name;
                            break;
                        }

                        energy -= energyCost;
                        applyTaskXp(task, zoneId, state, ctx);

                        if (zoneId > state.highestZone) state.highestZone = zoneId;
                        state.currentZone = zoneId;

                        queueResults.push({
                            taskName: task.name, zoneName, zoneId, type,
                            status: 'completed',
                            energyBefore: energy + energyCost, energyCost, energyAfter: energy,
                        });

                        tasksCompletedThisStep.add(task.name);

                        if (task.name === sphereTargetName) {
                            sphereTargetCompleted = true;
                        }
                    }

                    // Count attempts for tasks that were attempted this step
                    // but haven't been completed yet (or were just completed for the first time)
                    for (const name of tasksAttemptedThisStep) {
                        if (!taskFirstCompleted.has(name)) {
                            taskAttemptCounts.set(name, (taskAttemptCounts.get(name) || 0) + 1);
                            if (tasksCompletedThisStep.has(name)) {
                                taskFirstCompleted.set(name, globalStepIndex);
                            }
                        }
                    }

                    const focusName = failedTask || sphereTargetName;

                    verifySteps.push({
                        stepIndex: globalStepIndex,
                        sphereIndex,
                        targetTask: focusName,
                        targetCompleted: sphereTargetCompleted || !failedTask,
                        queue: queueResults,
                        energyBudget: state.maxEnergy,
                        energyUsed: state.maxEnergy - energy,
                        energyRemaining: energy,
                    });

                    globalStepIndex++;

                    if (!sphereTargetCompleted) {
                        doReset(state, ctx);
                    }
                }
            }

            // Grant perks
            for (const perkName of sphereStep.perksReceived) {
                const perkId = perkNameToId.get(perkName);
                if (perkId !== undefined) {
                    grantPerk(state, perkId, ctx);
                }
            }
        }

        // Build comparison: planned vs actual attempt counts
        const comparison = [];
        for (const [taskName, costInfo] of costsMap) {
            const plannedAttempts = costInfo.targetAttempts || 1;
            const actual = taskAttemptCounts.get(taskName) || 0;
            const delta = actual - plannedAttempts;
            comparison.push({
                taskName,
                category: costInfo.category || 'unknown',
                zoneId: costInfo.zoneId,
                costMult: costInfo.costMult,
                plannedAttempts,
                actualAttempts: actual,
                delta,
                match: delta === 0,
            });
        }

        const results = { verifySteps, comparison, taskAttemptCounts };
        this._verificationResults = results;
        return results;
    }

    /**
     * Step-by-step verification: re-run the simulation with pre-assigned costs,
     * annotating each planned step with verification data (actual energy costs,
     * actual state, deltas). Results are added to the planned steps in-place.
     *
     * @param {object} gameDataJson - Same game data used for planning
     * @param {string} sphereLogContent - Same sphere log used for planning
     * @returns {{ annotatedSteps: Array, summary: object }}
     */
    stepVerify(gameDataJson, sphereLogContent) {
        if (!this._lastPlanResult) {
            throw new Error('No plan to verify. Run planCosts first.');
        }

        const plannedSteps = this._lastPlanResult.steps;
        const costsMap = this._lastPlanResult.assignedCosts;
        const settings = this._settings;

        // Set up fresh simulation with all costs pre-assigned
        const adjustedData = JSON.parse(JSON.stringify(gameDataJson));
        const ctx = loadGameDataFromJson(adjustedData);

        const taskByName = new Map();
        for (const zone of ctx.ZONES) {
            for (const task of zone.tasks) {
                taskByName.set(task.name, { task, zoneId: zone.id });
            }
        }
        const perkNameToId = new Map();
        for (const [idStr, perk] of Object.entries(ctx.PERKS)) {
            perkNameToId.set(perk.name, parseInt(idStr));
        }

        // Pre-apply all costs
        for (const [taskName, costInfo] of costsMap) {
            const info = taskByName.get(taskName);
            if (info) {
                info.task.costMult = costInfo.costMult;
                if (costInfo.xpMult !== undefined) info.task.xpMult = costInfo.xpMult;
            }
        }

        const assignedCosts = new Map(costsMap);
        const state = createSimState(ctx);
        const steps = parseSphereLog(sphereLogContent, settings.playerNumber);

        // Walk through sphere steps, executing queues and tracking per-step results
        let verifyStepIndex = 0;
        const stepVerifyData = []; // one entry per verify step

        for (const sphereStep of steps) {
            const tasksToComplete = [];
            for (const locName of sphereStep.locationsChecked) {
                if (locName === 'Reach Goal Zone') continue;
                const info = taskByName.get(locName);
                if (info) tasksToComplete.push({ name: locName, ...info });
            }

            for (const targetInfo of tasksToComplete) {
                const { task: sphereTarget, zoneId: sphereTargetZoneId, name: sphereTargetName } = targetInfo;
                let sphereTargetCompleted = false;
                let safetyCounter = 0;

                while (!sphereTargetCompleted && safetyCounter++ < 300) {
                    const queue = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);
                    const stateBefore = snapshotState(state);

                    let energy = state.maxEnergy;
                    const queueResults = [];
                    let failedTask = null;

                    for (const entry of queue) {
                        const { task, zoneId, zoneName, type } = entry;

                        const energyCost = calcTaskEnergyCost(task, zoneId, state, ctx);
                        if (energyCost > energy) {
                            queueResults.push({
                                taskName: task.name, zoneName, zoneId, type,
                                status: 'cannot_afford',
                                energyBefore: energy, energyCost, energyAfter: energy,
                            });
                            failedTask = task.name;
                            break;
                        }

                        energy -= energyCost;
                        applyTaskXp(task, zoneId, state, ctx);
                        if (zoneId > state.highestZone) state.highestZone = zoneId;
                        state.currentZone = zoneId;

                        queueResults.push({
                            taskName: task.name, zoneName, zoneId, type,
                            status: 'completed',
                            energyBefore: energy + energyCost, energyCost, energyAfter: energy,
                        });

                        if (task.name === sphereTargetName) {
                            sphereTargetCompleted = true;
                        }
                    }

                    stepVerifyData.push({
                        verifyStepIndex,
                        sphereIndex: sphereStep.sphereIndex,
                        focusTask: failedTask || sphereTargetName,
                        completed: !failedTask,
                        queue: queueResults,
                        stateBefore,
                        stateAfter: snapshotState(state),
                        energyBudget: state.maxEnergy,
                        energyUsed: state.maxEnergy - energy,
                        energyRemaining: energy,
                    });

                    verifyStepIndex++;

                    if (!sphereTargetCompleted) {
                        doReset(state, ctx);
                    }
                }
            }

            // Grant perks
            for (const perkName of sphereStep.perksReceived) {
                const perkId = perkNameToId.get(perkName);
                if (perkId !== undefined) {
                    grantPerk(state, perkId, ctx);
                }
            }
        }

        // Match verify steps to planned steps and annotate
        // Both walk the same sphere log in the same order, so we can match by index
        // within each focus task's attempt sequence.
        const annotatedSteps = plannedSteps.map((planned, i) => {
            const verify = stepVerifyData[i] || null;
            if (!verify) {
                return { ...planned, verification: null };
            }

            // Compare queue entries: match by task name, compare energy costs
            const queueComparison = [];
            const plannedQueue = planned.queue || [];
            const verifyQueue = verify.queue || [];

            // Build verify queue lookup by task name
            const verifyByTask = new Map();
            for (const vq of verifyQueue) {
                verifyByTask.set(vq.taskName, vq);
            }

            for (const pq of plannedQueue) {
                const vq = verifyByTask.get(pq.taskName);
                queueComparison.push({
                    taskName: pq.taskName,
                    planned: {
                        status: pq.status,
                        energyCost: pq.energyCost,
                        energyBefore: pq.energyBefore,
                        energyAfter: pq.energyAfter,
                    },
                    actual: vq ? {
                        status: vq.status,
                        energyCost: vq.energyCost,
                        energyBefore: vq.energyBefore,
                        energyAfter: vq.energyAfter,
                    } : null,
                    delta: vq ? (vq.energyCost || 0) - (pq.energyCost || 0) : null,
                    statusMatch: vq ? vq.status === pq.status : false,
                });
            }

            return {
                ...planned,
                verification: {
                    verifyStepIndex: verify.verifyStepIndex,
                    focusTask: verify.focusTask,
                    completed: verify.completed,
                    energyBudget: verify.energyBudget,
                    energyUsed: verify.energyUsed,
                    energyRemaining: verify.energyRemaining,
                    stateBefore: verify.stateBefore,
                    stateAfter: verify.stateAfter,
                    queueComparison,
                    energyDelta: verify.energyRemaining - planned.energyRemaining,
                    focusMatch: verify.focusTask === planned.targetTask,
                    completedMatch: verify.completed === planned.targetCompleted,
                },
            };
        });

        // Summary
        const totalSteps = annotatedSteps.length;
        const matched = annotatedSteps.filter(s => s.verification?.completedMatch && s.verification?.focusMatch).length;
        const energyMismatches = annotatedSteps.filter(s =>
            s.verification && Math.abs(s.verification.energyDelta) > 1
        ).length;

        const summary = {
            totalPlannedSteps: totalSteps,
            totalVerifySteps: stepVerifyData.length,
            stepsMatched: matched,
            stepsMismatched: totalSteps - matched,
            energyMismatches,
        };

        // Store for UI access
        this._stepVerifyResults = { annotatedSteps, summary };
        return { annotatedSteps, summary };
    }

    getStepVerifyResults() { return this._stepVerifyResults; }

    reset() {
        this._steps = [];
        this._costData = null;
        this._lastPlanResult = null;
        this._verificationResults = null;
        this._stepVerifyResults = null;
    }
}

// ============================================================================
// Helpers
// ============================================================================

function buildStepNotes(costAssignment, targetCompleted, attemptNumber, targetAttempts, targetName) {
    const notes = [];
    if (costAssignment) {
        const { taskName, category, costMult, targetAttempts: ta } = costAssignment;
        notes.push(`Assigned cost to "${taskName}" (${category}): costMult=${costMult.toFixed(4)}, target=${ta} attempt(s)`);
    }
    if (targetCompleted) {
        notes.push(`Target "${targetName}" completed on attempt ${attemptNumber}`);
    } else {
        notes.push(`Target "${targetName}" not completed (attempt ${attemptNumber}/${targetAttempts}), will reset`);
    }
    return notes;
}

function buildCostOutput(adjustedData, assignedCosts, ctx) {
    const taskCosts = {};
    for (const [taskName, info] of assignedCosts) {
        taskCosts[taskName] = {
            costMult: info.costMult,
            xpMult: info.xpMult,
            category: info.category,
            zoneId: info.zoneId,
            targetAttempts: info.targetAttempts,
            assignedOnStep: info.assignedOnStep,
        };
    }

    return {
        version: '1.0',
        generatedAt: new Date().toISOString(),
        generatedFrom: 'jtaCostDebugger',
        settings: { ...DEFAULT_SETTINGS },
        taskCosts,
        adjustedData,
    };
}
