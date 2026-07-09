/**
 * The §2 forward pass, driving the fork's own simulation.
 *
 * Walk the post-fill sphere log in order. At each step (a run of location
 * checks ending at a perk milestone):
 *
 *   1. FIRST-TOUCH ASSIGNMENT — every task in the step that has no cost yet
 *      gets one now, by inverting `estimateResetsToComplete` against the step's
 *      target reset budget, corrected through the Phase 3c calibration curve.
 *      Nothing already assigned is ever revisited, which is what removes the
 *      legacy solver's retroactive traversal / xpMult-compounding levers.
 *   2. REAL-SIM ADVANCEMENT — the fork plays forward in instant mode under the
 *      shared automation profile until the milestone task actually completes.
 *      The next step's assignments therefore see emergent state, not a model's
 *      projection, so assignment error cannot accumulate.
 *   3. GRANTS — the walk hands over whatever the sphere log says arrived at
 *      those locations, exactly as the Loops cost generator applies
 *      `itemsReceived`. Perks arrive as AP items (grants are AP-authoritative),
 *      so the perk-tasks' own grants are suppressed first.
 *
 * ══ WORK IN PROGRESS — DOES NOT YET CONVERGE. Nothing imports this. ═══════
 *
 * The primitives in balanceCore.js are verified against the real engine. This
 * advancement loop is not: on a real 15-zone seed most steps stall. The cause
 * is understood and written down here so the next pass starts from it rather
 * than rediscovering it.
 *
 * THE PROBLEM. Loops' cost generator can queue exactly the one location it
 * wants, because the loop engine only does what it is told. JtA's automation is
 * autonomous: left alone it travels ahead and clears whole zones. By the time
 * the walk reaches a task, the sim has already completed it — the measured gap
 * is 0, and worse, `estimateResetsToComplete` returns 0 for a completed task
 * regardless of cost, so the bisection saturates at MAX_COST_MULTIPLIER and
 * would ship a task nobody can finish. (Guarded below: saturated solves fall
 * back to the vanilla multiplier and are counted.)
 *
 * WHAT DOESN'T WORK. `setAutomationEndZone` looks like the lever for holding
 * the sim behind the walk. It is not. `automation_end` gates nothing on an
 * ongoing basis; the only readers are Mastery-of-Time (simulation.ts:957) and
 * two zone-advance branches (simulation.ts:3965, 4322) that switch automation
 * **Off permanently** once `(new_zone + 1) >= automation_end`. So automation
 * finishes zone 0's Travel task, advances, turns itself off, and every
 * subsequent step spins out its whole reset budget doing nothing. Setting the
 * bound to `deepestZone` instead of `deepestZone + 1` is even worse: it kills
 * automation before the first tick.
 *
 * THE SHAPE OF THE FIX. Stop trying to hold the sim back; let it play freely
 * and drive first-touch off the SIM's progression instead of the walk's. Cost a
 * zone's tasks the moment `GAMESTATE.current_zone` first reaches it — targets
 * still come from the walk (`targetByTask`), so the pacing intent is unchanged,
 * but assignment happens with the emergent state the player will actually have,
 * and always before automation can complete anything there (instant mode
 * finishes at most one task per `updateGamestate`). The walk then only supplies
 * targets and grant order; the sim supplies the clock. This is arguably the
 * more faithful model anyway: the player's real completion order IS automation's.
 *
 * Runs against a throwaway `GAMESTATE` created by `initializeHeadless()`, with
 * `localStorage` stubbed, so it cannot touch the player's save.
 */

import {
    DEFAULT_CATEGORY_WEIGHTS,
    ESTIMATOR_CAP,
    buildPlan,
    extractLocationEntries,
    invertCalibration,
    solveCostMultiplier,
    targetGapForMilestone,
} from './balanceCore.js';
import { baselineMods } from './automationProfile.js';

// Ceiling on resets spent waiting for one milestone. A step that blows this is
// recorded as stalled and the walk moves on rather than hanging: a solve that
// silently never terminates is worse than one that reports where it gave up.
const DEFAULT_MAX_RESETS_PER_STEP = 120;
const DEFAULT_MAX_TICKS_PER_RUN = 200000;
// Matches driver.mjs: with no progress for this many ticks the run is treated
// as ended (nobody drives the end-of-content overlay headlessly).
const DEFAULT_MAX_IDLE_TICKS = 50;

/** Advance one tick, mirroring driver.mjs's two hard-won rules. */
function makeStepper(env, onRunBoundary) {
    const { sim, game } = env;
    let idleTicks = 0;
    let lastSig = '';
    let ticksThisRun = 0;

    const progressSig = () => `${game.GAMESTATE.current_zone}|${game.GAMESTATE.current_energy}|`
        + `${game.GAMESTATE.tasks.reduce((a, t) => a + t.reps, 0)}`;

    return function tick() {
        sim.updateGamestate();
        ticksThisRun++;
        // Nobody drains the render-event queue headlessly, and saveGame
        // serializes the whole gamestate on every instant completion.
        game.GAMESTATE.pending_render_events.length = 0;

        if (!game.GAMESTATE.is_in_energy_reset) {
            const sig = progressSig();
            if (sig === lastSig) {
                if (++idleTicks >= DEFAULT_MAX_IDLE_TICKS) game.GAMESTATE.is_in_energy_reset = true;
            } else {
                idleTicks = 0;
                lastSig = sig;
            }
            if (ticksThisRun >= DEFAULT_MAX_TICKS_PER_RUN) game.GAMESTATE.is_in_energy_reset = true;
        }

        if (game.GAMESTATE.is_in_energy_reset) {
            // The auto-prestige-vs-energy-reset branch lives in the rendering
            // layer, so a headless driver has to replicate it.
            const prestiged = sim.maybeAutoPrestige();
            if (!prestiged) sim.doEnergyReset();
            idleTicks = 0;
            lastSig = '';
            ticksThisRun = 0;
            onRunBoundary();
            return true;      // a reset happened
        }
        return false;
    };
}

/**
 * Run the balancing pass.
 *
 * @param {object} o
 * @param {object} o.env            { sim, game, zones, win } from headlessGameEnv
 * @param {Array}  o.sphereLog      parsed sphere-log entries (post-fill)
 * @param {string|number} o.playerId
 * @param {object} o.apLocations    AP location name -> jta task id
 * @param {string[]} o.perkItemNames
 * @param {object} o.calibration    derive-calibration.mjs output
 * @param {number[]} o.anchorCurve  vanilla perk-milestone gaps
 * @param {object} [o.options]      { rng, jitter, resetsPerStep, categoryWeights,
 *                                    perkCountSentinel, maxResetsPerStep, onProgress }
 * @returns {Promise<{patches, report}>}
 */
export async function runBalancePass({
    env, sphereLog, playerId, apLocations, perkItemNames, calibration, anchorCurve, options = {},
}) {
    const { sim, zones, win } = env;
    const {
        rng = null,
        jitter = 0,
        // Manual override (the old apworld's `resets_per_sphere`): when set,
        // every step targets this many resets and the anchor curve is ignored.
        resetsPerStep = null,
        categoryWeights = DEFAULT_CATEGORY_WEIGHTS,
        perkCountSentinel = null,
        maxResetsPerStep = DEFAULT_MAX_RESETS_PER_STEP,
        onProgress = null,
    } = options;

    const entries = extractLocationEntries(sphereLog, playerId);
    const steps = buildPlan(entries, { apLocations, perkItemNames });
    const milestoneSteps = steps.filter((s) => s.milestone != null);
    if (!milestoneSteps.length) {
        throw new Error('runBalancePass: sphere log has no perk milestones — '
            + 'is Pass A emitting access rules? A degenerate single-sphere log cannot be walked.');
    }

    // Each task's target gap, taken from the step it belongs to. Resolved up
    // front so a zone can be costed the moment the walk opens it, before the
    // sim is allowed in.
    const targetByTask = new Map();
    {
        let mi = 0;
        for (const step of steps) {
            const gap = resetsPerStep != null
                ? resetsPerStep
                : targetGapForMilestone(anchorCurve, mi, milestoneSteps.length, { rng, jitter });
            for (const taskId of step.tasks) {
                if (!targetByTask.has(taskId)) targetByTask.set(taskId, gap);
            }
            if (step.milestone != null) mi++;
        }
    }

    // --- Engine setup -----------------------------------------------------
    // The fork's render loop runs on a timer and would tick against the stubbed
    // DOM. driver.mjs pauses it first; so must we.
    win.pauseGameLoop();
    win.initializeHeadless();
    win.setInstantMode(true);
    const mods = { ...baselineMods(), ...(options.modOverrides ?? {}) };
    for (const [name, value] of Object.entries(mods)) {
        if (!sim.setMod(name, value)) throw new Error(`setMod(${name}) failed`);
    }
    env.game.GAMESTATE.automation_skip_blocked = true;
    sim.autoFillAllPriorities();
    sim.setAutomationMode(sim.AutomationMode.All);

    // Grants are AP-authoritative: suppress every perk task's local grant so the
    // only perks the solved game sees are the ones the sphere log hands over, in
    // the log's order. Without this the solver's game races ahead of the walk.
    if (perkCountSentinel != null) {
        const suppress = [];
        for (const def of zones.TASK_LOOKUP.values()) {
            if (def.perk !== perkCountSentinel) suppress.push({ id: def.id, perk: perkCountSentinel });
        }
        if (suppress.length) win.applyTaskPatches(suppress);
    }

    const completed = new Set();
    win.setTaskCompletionCallback((info) => completed.add(info.id));

    let run = 1;
    const tick = makeStepper(env, () => { run++; });

    // --- Walk -------------------------------------------------------------
    const patches = [];
    const costed = new Set();
    const openedZones = new Set();
    const stepReports = [];
    let clampedFloor = 0;
    let clampedPlateau = 0;
    let alreadyComplete = 0;
    let saturated = 0;
    let deepestZone = -1;

    /** Cost every uncosted AP task in `zoneIdx`, each at its own step's target. */
    const costZone = (zoneIdx, milestoneId) => {
        for (const def of zones.TASK_LOOKUP.values()) {
            if (def.zone_id !== zoneIdx) continue;
            if (costed.has(def.id) || !targetByTask.has(def.id)) continue;
            costed.add(def.id);
            const target = targetByTask.get(def.id);
            // The milestone carries the whole step budget — it is the event the
            // anchor curve measures. The rest split it by category.
            const weight = def.id === milestoneId ? 1 : (categoryWeights[def.type] ?? 1);
            const { estimate, clamped } = invertCalibration(calibration.curve, target * weight);
            if (clamped === 'floor') clampedFloor++;
            else if (clamped === 'plateau') clampedPlateau++;
            const solved = solveCostMultiplier(env, def.id, estimate, { cap: ESTIMATOR_CAP });
            if (solved.skillless) continue;
            if (solved.saturated) {
                // The estimator never reached the target even at MAX. Shipping
                // that multiplier would make the task unfinishable. Something is
                // wrong (usually: the sim already completed it, which pins the
                // estimate at 0) — leave the task at its vanilla cost and say so.
                saturated++;
                win.applyTaskPatches([{ id: def.id, cost_multiplier: def.cost_multiplier }]);
                continue;
            }
            patches.push({ id: def.id, cost_multiplier: solved.costMultiplier });
        }
    };

    for (const step of steps) {
        const isMilestoneStep = step.milestone != null;
        const targetGap = targetByTask.get(step.tasks[0]) ?? 0;

        // 1. First-touch assignment, by zone, BEFORE the sim may enter it.
        for (const taskId of step.tasks) {
            const def = zones.TASK_LOOKUP.get(taskId);
            if (!def) continue;
            if (completed.has(taskId) && !costed.has(taskId)) alreadyComplete++;
            if (!openedZones.has(def.zone_id)) {
                openedZones.add(def.zone_id);
                costZone(def.zone_id, step.milestone);
                if (def.zone_id > deepestZone) deepestZone = def.zone_id;
            }
        }
        // BROKEN — see the header. This does not confine automation to the
        // walk's frontier; it makes the sim switch automation off for good on
        // the first zone advance, which is why most steps stall. Left in place,
        // and re-arming the mode each step, only so the failure is reproducible
        // from the verify script while the redesign is written.
        sim.setAutomationEndZone(deepestZone + 1);
        sim.setAutomationMode(sim.AutomationMode.All);
        sim.autoFillAllPriorities();

        // 2. Real-sim advancement, until the milestone actually completes.
        const runAtStepStart = run;
        let stalled = false;
        if (isMilestoneStep) {
            while (!completed.has(step.milestone)) {
                if (run - runAtStepStart >= maxResetsPerStep) { stalled = true; break; }
                tick();
            }
        }
        const measuredGap = run - runAtStepStart;

        // 3. Grants — whatever the log says arrived here, in log order.
        for (const item of step.grants) {
            if (perkItemNames.includes(item)) win.grantPerk(item);
        }

        stepReports.push({
            milestone: step.milestone,
            perk: step.milestonePerk ?? null,
            taskCount: step.tasks.length,
            zone: deepestZone,
            targetGap: Number(targetGap.toFixed(2)),
            measuredGap,
            stalled,
        });
        if (onProgress) {
            onProgress({ step: stepReports.length, total: steps.length });
            // Yield so a worker stays responsive and a host can post progress.
            await Promise.resolve();
        }
    }

    win.setTaskCompletionCallback(null);
    // Prestige/reset paths can restart the render loop; leave it stopped so a
    // Node caller can exit and a worker isn't ticking a stubbed DOM.
    win.pauseGameLoop();

    const measured = stepReports.filter((s) => s.milestone != null).map((s) => s.measuredGap);
    return {
        patches,
        report: {
            steps: stepReports,
            milestoneCount: milestoneSteps.length,
            costedTaskCount: costed.size,
            patchCount: patches.length,
            clampedFloor,
            clampedPlateau,
            alreadyComplete,
            saturated,
            stalledSteps: stepReports.filter((s) => s.stalled).length,
            totalResets: run - 1,
            measuredGaps: measured,
        },
    };
}
