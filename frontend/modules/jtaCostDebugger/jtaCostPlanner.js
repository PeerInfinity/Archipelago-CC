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
 * Solve for costMult (and optionally xpMult) that makes a task require
 * exactly `targetAttempts` attempts.
 *
 * Phase 1: Binary search costMult alone.
 * Phase 2: If no costMult gives exactly targetAttempts (discrete jump),
 *          fix costMult at the boundary and binary search an xpMult
 *          multiplier on all tasks in zones 0..zoneId to fine-tune
 *          the XP gain rate.
 *
 * @param {Map} assignedCosts - Already-assigned costs (from prior steps)
 * @param {object} settings - Planner settings (energyMargin, attempt counts)
 * @returns {{ costMult: number, xpAdjustments: Array|null }}
 */
function solveCostMultForAttempts(task, zoneId, targetAttempts, remainingEnergyAtTask, state, ctx, assignedCosts, settings) {
    if (targetAttempts <= 1) {
        return { costMult: solveCostMultForEnergy(task, zoneId, remainingEnergyAtTask, state, ctx), xpAdjustments: null };
    }

    const savedCost = task.costMult;

    // Phase 1: Binary search costMult alone.
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
            if (bestCost === null || candidateCost > bestCost) {
                bestCost = candidateCost;
                bestAttempts = attempts;
            }
            logLo = logMid;
        } else {
            logHi = logMid;
        }
    }

    const finalCostMult = Math.max(0.01, bestCost ?? 0.01);

    // If costMult alone gives the exact target, or xpMult adjustment is disabled, done
    if (bestAttempts === targetAttempts || !settings?.adjustXpMult) {
        task.costMult = savedCost;
        return { costMult: finalCostMult, xpAdjustments: null };
    }

    // Phase 2: costMult alone can't produce exactly targetAttempts
    // (bestAttempts < targetAttempts due to discrete attempt count jumps).
    // Strategy: keep the phase 1 bestCost and REDUCE xpMult on uncosted
    // grinding tasks to slow XP gain, increasing the attempt count.
    // Less XP → slower skill improvement → cost stays high longer → more attempts.
    task.costMult = finalCostMult;

    // Collect tasks whose xpMult we'll adjust.
    // Only adjust tasks that haven't been costed yet — already-assigned tasks
    // have finalized xpMult values that shouldn't be modified retroactively.
    const xpTasks = [];
    for (let z = 0; z <= zoneId && z < ctx.ZONES.length; z++) {
        for (const t of ctx.ZONES[z].tasks) {
            if (t.name !== task.name && !assignedCosts.has(t.name)) {
                xpTasks.push({ task: t, origXpMult: t.xpMult });
            }
        }
    }

    if (xpTasks.length === 0) {
        task.costMult = savedCost;
        return { costMult: finalCostMult, xpAdjustments: null };
    }

    // Binary search for xpMult multiplier M (0 < M < 1) that reduces XP
    // just enough to increase attempt count to targetAttempts.
    // We want the HIGHEST M (least reduction) where attempts >= targetAttempts.
    let xpLogLo = Math.log(0.0001);
    let xpLogHi = Math.log(1.0);
    let bestXpMult = null;

    for (let iter = 0; iter < 30; iter++) {
        const logMid = (xpLogLo + xpLogHi) / 2;
        const mid = Math.exp(logMid);
        for (const entry of xpTasks) {
            entry.task.xpMult = entry.origXpMult * mid;
        }

        const attempts = simulateActualAttempts(task, zoneId, state, ctx, assignedCosts, targetAttempts + 10, settings);

        if (attempts >= targetAttempts) {
            // Enough attempts — track highest M (least reduction)
            bestXpMult = mid;
            xpLogLo = logMid; // try less reduction
        } else {
            // Too few attempts — need more reduction
            xpLogHi = logMid;
        }
    }

    if (bestXpMult === null) {
        // Even extreme reduction doesn't help — fall back to phase 1
        for (const entry of xpTasks) {
            entry.task.xpMult = entry.origXpMult;
        }
        task.costMult = savedCost;
        return { costMult: finalCostMult, xpAdjustments: null };
    }

    // Build xpAdjustments list, but RESTORE xpMult on task objects.
    // The adjustments are applied during the focus task's attempt execution
    // (in the caller) and restored afterward to avoid cascading effects.
    const xpAdjustments = [];
    for (const entry of xpTasks) {
        const newXpMult = entry.origXpMult * bestXpMult;
        if (Math.abs(newXpMult - entry.origXpMult) > 0.0001) {
            xpAdjustments.push({
                taskName: entry.task.name,
                origXpMult: entry.origXpMult,
                newXpMult,
                multiplier: bestXpMult,
            });
        }
        entry.task.xpMult = entry.origXpMult; // always restore
    }

    task.costMult = savedCost;
    return {
        costMult: finalCostMult,
        xpAdjustments: xpAdjustments.length > 0 ? xpAdjustments : null,
    };
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
        const { queue } = buildActionQueue(task, zoneId, sim, ctx, effectiveCosts);
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

    // XP grinding: select tasks by XP/energy efficiency to fill the energy budget.
    // Placed BEFORE the target task so the player grinds first, then attempts the
    // target with whatever energy remains.
    //
    // Calculate remaining energy after traversal to determine grinding budget.
    let grindBudget = state.maxEnergy;
    for (const entry of queue) {
        if (assignedCosts.has(entry.task.name)) {
            grindBudget -= calcTaskEnergyCost(entry.task, entry.zoneId, state, ctx);
        }
    }

    // Collect grinding candidates from all reachable zones, compute XP efficiency.
    // Only include tasks that already have costs assigned — uncosted tasks should
    // wait to become the focus and get their cost assigned properly.
    const grindCandidates = [];
    for (let z = targetZoneId; z >= 0; z--) {
        const zone = ctx.ZONES[z];
        for (const task of getNormalTasks(zone, ctx)) {
            if (task.name === targetTask.name) continue;
            if (task.type === ctx.TaskType.Boss) continue;
            if (!assignedCosts.has(task.name)) continue;
            const cost = calcTaskEnergyCost(task, z, state, ctx);
            if (cost <= 0) continue;
            const xp = calcTaskXp(task, z, state, ctx) * task.maxReps;
            const skills = task.skills.map(s => ctx.SKILL_NAMES?.[s] || `S${s}`);
            grindCandidates.push({
                task, zoneId: z, zoneName: zone.name,
                cost, xp, xpPerEnergy: xp / cost, skills,
            });
        }
    }

    // Sort by XP/energy efficiency (best first)
    grindCandidates.sort((a, b) => b.xpPerEnergy - a.xpPerEnergy);

    // Fill the grinding budget with the most efficient tasks
    let grindRemaining = grindBudget;
    const selectedGrind = [];
    for (const gc of grindCandidates) {
        if (grindRemaining <= 0) break;
        queue.push({
            task: gc.task,
            zoneId: gc.zoneId,
            zoneName: gc.zoneName,
            type: 'grinding',
            isCosted: assignedCosts.has(gc.task.name),
        });
        selectedGrind.push(gc);
        grindRemaining -= gc.cost;
        // Include the first task that exceeds the budget (player runs out during it)
    }

    // Build grinding plan report
    const grindPlan = {
        budget: grindBudget,
        candidatesConsidered: grindCandidates.length,
        tasksSelected: selectedGrind.length,
        tasks: grindCandidates.map(gc => ({
            taskName: gc.task.name,
            zoneName: gc.zoneName,
            zoneId: gc.zoneId,
            cost: gc.cost,
            xp: gc.xp,
            xpPerEnergy: gc.xpPerEnergy,
            skills: gc.skills,
            selected: selectedGrind.includes(gc),
        })),
    };

    // Target task (after grinding — attempt with whatever energy remains)
    queue.push({
        task: targetTask,
        zoneId: targetZoneId,
        zoneName: ctx.ZONES[targetZoneId]?.name || `Zone ${targetZoneId}`,
        type: getTaskCategory(targetTask, ctx),
        isCosted: assignedCosts.has(targetTask.name),
    });

    return { queue, grindPlan };
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
    if (category === 'traversal') return settings.traversalAttempts ?? settings.normalAttempts;
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
    traversalAttempts: 5,  // Traversal (mandatory/travel) tasks
    playerNumber: 1,
    energyMargin: 0.90,    // Leave 10% margin on energy calculations
    normalCostScale: 0.5,  // Scale normal task costs down after solving
    traversalCostScale: 0.5, // Scale traversal task costs down after solving
    adjustXpMult: false,   // Whether to adjust xpMult on grinding tasks to hit exact attempt counts
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
                    const { queue } = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);

                    // Find the focus task. Priority:
                    // 1. First uncosted traversal/mandatory task (needed to reach target)
                    // 2. Any uncosted Normal task in reachable zones (cost these before
                    //    perk/boss tasks so they're available as grinding tasks)
                    // 3. First uncosted non-Normal task (perk/boss/travel in target zone)
                    let focusEntry = null;
                    let firstUncostedNonNormal = null;

                    for (const entry of queue) {
                        if (assignedCosts.has(entry.task.name)) continue;

                        const cat = getTaskCategory(entry.task, ctx);
                        if (cat === 'traversal') {
                            // Traversal tasks always take priority — needed to progress
                            focusEntry = entry;
                            break;
                        }
                        if (cat === 'normal') {
                            // Normal task — cost it before perk/boss tasks
                            focusEntry = entry;
                            break;
                        }
                        // Non-normal, non-traversal (perk/boss) — remember it but
                        // check for uncosted Normal tasks first
                        if (!firstUncostedNonNormal) {
                            firstUncostedNonNormal = entry;
                        }
                    }

                    // If no traversal or normal tasks need costing, check for uncosted
                    // Normal tasks in reachable zones (they might not be in the queue
                    // because the queue only includes grinding tasks that fit the budget).
                    // A zone is reachable if all its preceding traversal tasks are costed
                    // AND affordable with current energy.
                    if (!focusEntry && firstUncostedNonNormal) {
                        for (let z = 0; z <= sphereTargetZoneId && z < ctx.ZONES.length; z++) {
                            // Check if zone z is reachable: all traversal in zones before z must be costed
                            let zoneReachable = true;
                            for (let pz = 0; pz < z; pz++) {
                                const pzone = ctx.ZONES[pz];
                                for (const t of getMandatoryTasks(pzone, ctx)) {
                                    if (!assignedCosts.has(t.name)) {
                                        zoneReachable = false;
                                        break;
                                    }
                                }
                                if (!zoneReachable) break;
                            }
                            if (!zoneReachable) break; // can't reach this or any later zone

                            const zone = ctx.ZONES[z];
                            for (const task of getNormalTasks(zone, ctx)) {
                                if (!assignedCosts.has(task.name) && task.name !== sphereTarget.name) {
                                    focusEntry = {
                                        task, zoneId: z, zoneName: zone.name,
                                        type: 'normal', isCosted: false,
                                    };
                                    break;
                                }
                            }
                            if (focusEntry) break;
                        }
                    }

                    // If still no Normal tasks to cost, use the perk/boss task
                    if (!focusEntry) {
                        focusEntry = firstUncostedNonNormal;
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
                        const { queue: stepQueue } = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);

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
                            sphereTargetTask: sphereTargetName,
                            sphereTargetZoneId: sphereTargetZoneId,
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
                    let xpAdjustments = null;
                    if (focusAttempts <= 1) {
                        const result = solveCostMultForAttempts(
                            focusTask, focusZoneId, focusAttempts, energyAtFocus,
                            stateAtFocus, ctx, assignedCosts, settings
                        );
                        newCostMult = result.costMult;
                    } else {
                        const result = solveCostMultForAttempts(
                            focusTask, focusZoneId, focusAttempts, energyAtFocus,
                            stateBeforeCost, ctx, assignedCosts, settings
                        );
                        newCostMult = result.costMult;
                        xpAdjustments = result.xpAdjustments;
                    }

                    // Scale down costs by category to leave more energy for
                    // subsequent tasks in the queue
                    const costScale =
                        focusCategory === 'traversal' ? (settings.traversalCostScale ?? 1) :
                        focusCategory === 'normal' ? (settings.normalCostScale ?? 1) : 1;
                    if (costScale < 1) {
                        newCostMult = Math.max(0.01, newCostMult * costScale);
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

                    // xpAdjustments are recorded in the report but NOT persisted to task
                    // objects — they only affect the binary search simulation for this
                    // focus task, not future steps.

                    let formula;
                    if (focusAttempts <= 1) {
                        formula = `costMult solved for energyCost = ${(energyAtFocus * settings.energyMargin).toFixed(1)} (${(settings.energyMargin * 100).toFixed(0)}% of ${energyAtFocus.toFixed(1)} remaining)`;
                    } else if (xpAdjustments) {
                        formula = `costMult=${newCostMult.toFixed(4)} + xpMult adjusted on ${xpAdjustments.length} tasks (x${xpAdjustments[0]?.multiplier.toFixed(4)}) for ${focusAttempts} attempts`;
                    } else {
                        formula = `costMult solved for ${focusAttempts} attempts (binary search with actual simulation)`;
                    }

                    const costAssignment = {
                        taskName: focusTask.name,
                        zoneName: focusZoneName,
                        zoneId: focusZoneId,
                        category: focusCategory,
                        costMult: newCostMult,
                        xpMult: focusTask.xpMult,
                        targetAttempts: focusAttempts,
                        energyAvailable: energyAtFocus,
                        formula,
                        xpAdjustments,
                    };

                    // Apply xpMult adjustments during the focus task's attempts
                    // (restored after the attempts loop completes)
                    if (xpAdjustments) {
                        for (const adj of xpAdjustments) {
                            const info = taskByName.get(adj.taskName);
                            if (info) info.task.xpMult = adj.newXpMult;
                        }
                    }

                    // Run attempts for the focus task
                    let focusCompleted = false;
                    for (let attempt = 1; attempt <= focusAttempts + 20 && !focusCompleted; attempt++) {
                        const stateBefore = snapshotState(state);
                        const { queue: stepQueue, grindPlan: stepGrindPlan } = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);

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
                            sphereTargetTask: sphereTargetName,
                            sphereTargetZoneId: sphereTargetZoneId,
                            targetTask: focusTask.name,
                            targetZone: focusZoneName,
                            targetZoneId: focusZoneId,
                            targetCategory: focusCategory,
                            targetAttempts: focusAttempts,
                            attemptNumber: attempt,
                            targetCompleted: focusCompleted,
                            costAssignment: attempt === 1 ? costAssignment : null,
                            grindPlan: attempt === 1 ? stepGrindPlan : null,
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

                    // Restore xpMult adjustments after focus task attempts complete
                    if (xpAdjustments) {
                        for (const adj of xpAdjustments) {
                            const info = taskByName.get(adj.taskName);
                            if (info) info.task.xpMult = adj.origXpMult;
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
        // Delegate to stepVerify and derive per-task comparison from annotated steps
        const { annotatedSteps } = this.stepVerify(gameDataJson, sphereLogContent);
        const costsMap = plannedCosts instanceof Map ? plannedCosts : new Map(Object.entries(plannedCosts));

        // Count planned and actual (verify) attempts per task from the annotated steps
        const plannedAttemptCounts = new Map(); // from plan step data
        const verifyAttemptCounts = new Map();  // from verify completion status
        for (const step of annotatedSteps) {
            const taskName = step.targetTask;
            const attemptNum = step.attemptNumber || 0;
            if (attemptNum > 0) {
                // Planned: highest attempt number the planner generated
                plannedAttemptCounts.set(taskName, Math.max(
                    plannedAttemptCounts.get(taskName) || 0, attemptNum
                ));
            }
            // Verify: count steps where the verify says the task wasn't completed
            const v = step.verification;
            if (v) {
                const prev = verifyAttemptCounts.get(taskName) || 0;
                verifyAttemptCounts.set(taskName, prev + 1);
            }
        }

        // Build comparison: planned attempts (from plan) vs verify attempts
        const comparison = [];
        for (const [taskName, costInfo] of costsMap) {
            const plannedAttempts = plannedAttemptCounts.get(taskName) || (costInfo.targetAttempts || 1);
            const actual = verifyAttemptCounts.get(taskName) || 0;
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

        const results = { verifySteps: annotatedSteps, comparison, plannedAttemptCounts, verifyAttemptCounts };
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
        const stepVerifyData = []; // one entry per planned step

        // Walk through the PLANNED steps directly. Each step tells us
        // exactly what the focus task was — no need to guess.
        let lastSphereIndex = null;
        const steps = parseSphereLog(sphereLogContent, settings.playerNumber);
        const perkNameToIdForGrant = new Map(Object.entries(ctx.PERKS).map(
            ([idStr, p]) => [p.name, parseInt(idStr)]
        ));

        // Build a sphere perk grant schedule from the sphere log
        const spherePerks = new Map(); // sphereIndex → perkNames[]
        for (const sphereStep of steps) {
            spherePerks.set(sphereStep.sphereIndex, sphereStep.perksReceived || []);
        }

        for (const planned of plannedSteps) {
            // Grant perks when we transition to a new sphere
            if (lastSphereIndex !== null && planned.sphereIndex !== lastSphereIndex) {
                const perksToGrant = spherePerks.get(lastSphereIndex) || [];
                for (const perkName of perksToGrant) {
                    const perkId = perkNameToIdForGrant.get(perkName);
                    if (perkId !== undefined) grantPerk(state, perkId, ctx);
                }
            }
            lastSphereIndex = planned.sphereIndex;

            const focusName = planned.targetTask;

            // Use the SPHERE target (not the focus task) to build the queue,
            // so it includes the correct traversal + grinding + target structure
            const sphereTargetInfo = taskByName.get(planned.sphereTargetTask || focusName);
            if (!sphereTargetInfo) {
                stepVerifyData.push(null);
                continue;
            }
            const sphereTarget = sphereTargetInfo.task;
            const sphereTargetZoneId = planned.sphereTargetZoneId ?? sphereTargetInfo.zoneId;

            const { queue: stepQueue } = buildActionQueue(sphereTarget, sphereTargetZoneId, state, ctx, assignedCosts);
            const stateBefore = snapshotState(state);

            // Determine the cost scale for the focus task — the verify should
            // check affordability at the same fraction the planner used
            const focusInfo = taskByName.get(focusName);
            const focusCat = focusInfo ? getTaskCategory(focusInfo.task, ctx) : 'normal';
            const focusCostScale =
                focusCat === 'traversal' ? (settings.traversalCostScale ?? 1) :
                focusCat === 'normal' ? (settings.normalCostScale ?? 1) : 1;

            let energy = state.maxEnergy;
            const queueResults = [];
            let focusCompleted = false;

            for (const entry of stepQueue) {
                const { task, zoneId, zoneName, type } = entry;

                const energyCost = calcTaskEnergyCost(task, zoneId, state, ctx);

                // For the focus task, check affordability against the scaled energy
                // budget (matching the planner's cost scale). For other tasks, check
                // against the full remaining energy.
                const isFocus = task.name === focusName;
                const budget = isFocus ? energy * focusCostScale : energy;

                if (energyCost > budget) {
                    queueResults.push({
                        taskName: task.name, zoneName, zoneId, type,
                        status: 'cannot_afford',
                        energyBefore: energy, energyCost, energyAfter: energy,
                    });
                    if (isFocus) break; // focus task can't afford within budget — count as failed attempt
                    break; // preceding task can't afford — queue stops
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

                if (isFocus) focusCompleted = true;
            }

            stepVerifyData.push({
                verifyStepIndex: stepVerifyData.length,
                sphereIndex: planned.sphereIndex,
                focusTask: focusName,
                completed: focusCompleted,
                queue: queueResults,
                stateBefore,
                stateAfter: snapshotState(state),
                energyBudget: state.maxEnergy,
                energyUsed: state.maxEnergy - energy,
                energyRemaining: energy,
            });

            if (!focusCompleted) {
                doReset(state, ctx);
            }
        }

        // Grant perks for the last sphere
        if (lastSphereIndex !== null) {
            const perksToGrant = spherePerks.get(lastSphereIndex) || [];
            for (const perkName of perksToGrant) {
                const perkId = perkNameToIdForGrant.get(perkName);
                if (perkId !== undefined) grantPerk(state, perkId, ctx);
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
