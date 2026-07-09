/**
 * The Pass-B forward balancing pass, driving the fork's own simulation.
 * Design: CC/docs/plans/jta-balance-pass-plan.md (§4); supersedes the earlier
 * non-converging draft, whose failure analysis lives in that plan's §1.1.
 *
 * Walk a total order over EVERY v1 task (buildWalkOrder: the post-fill sphere
 * log's buckets + a seeded within-bucket shuffle with playability repair) and,
 * one entry at a time:
 *
 *   1. RELEASE — add the task to the fork's `setCostedTaskIds` allowlist.
 *      Uncosted tasks are unrunnable and excluded from free-completion paths,
 *      so automation can never outrun the walk: that is the confinement lever
 *      (`setAutomationEndZone` is NOT one — it kills automation permanently).
 *   2. ASSIGN AT FIRST START — when the sim first begins the task,
 *      `setTaskFirstStartCallback` fires synchronously BEFORE the starting
 *      tick reads the cost, and we solve `cost_multiplier` there by bisection
 *      on `estimateResetsToComplete` against decision-time remaining energy
 *      (the estimator's own documented contract — no budget normalization).
 *      Milestone entries target the REMAINING step budget
 *      (`resetsPerStep − resets elapsed since the last milestone`), so the
 *      constant milestone-to-milestone gap survives whatever the step's other
 *      tasks consumed; non-milestones use the Loops-style fraction rule (a
 *      small category fraction of decision-time energy), because reps reset
 *      every run and everything costed is replayed every run — connective
 *      tissue must stay cheap or the replay tax swamps the pacing.
 *   3. ADVANCE — the sim plays under `baselineMods()` in NORMAL ticking until
 *      the entry's task completes. Instant mode is deliberately OFF:
 *      `completeTaskInstantly` is affordability-blind (it completes all reps
 *      in the starting tick and just bills the energy), and the profile's
 *      all-skipped=Best-Task fallback makes that the common case under
 *      confinement. Under normal ticking Best-Task is instead the faithful
 *      catch-up grind real play has. Measured: ~38 ms/run vs instant's ~22 —
 *      the fidelity is nearly free (plan §1.1 amendment).
 *   4. GRANT — whatever the sphere log says arrived at that entry (perk items
 *      via `grantPerk`, AP-authoritative order), then release the next entry.
 *
 * First-touch by construction: a task is solved exactly once, at its first
 * start, and never revisited — the legacy solver's retroactive levers cannot
 * exist here. v1 is REPORT-ONLY: measured gaps are returned for verification,
 * never fed back into later solves.
 *
 * ENV-AGNOSTIC like balanceCore.js: the caller hands in `env` ({ sim, game,
 * zones, win }) from headlessGameEnv.js, so one implementation serves the
 * Pass-B Web Worker, the Node verify script, and Phase 4 verification. Runs
 * against a throwaway GAMESTATE (`initializeHeadless`) with `localStorage`
 * stubbed, so it cannot touch the player's save.
 */

import {
    DEFAULT_CATEGORY_FRACTIONS,
    MIN_COST_MULTIPLIER,
    solveCostMultiplier,
} from './balanceCore.js';
import { buildWalkOrder, toSeedInt } from './orderBuilder.js';
import { baselineMods } from './automationProfile.js';

// The constant pacing knob (ruling: resetsPerStep IS the knob; curve-matching
// abandoned). Default 5 per the 2026-07-08 ruling. Non-milestone entries use
// the Loops-style category-fraction rule instead (see solveEntry /
// DEFAULT_CATEGORY_FRACTIONS in balanceCore.js).
export const DEFAULT_RESETS_PER_STEP = 5;

// Ceiling on resets spent waiting for one entry. A stalled entry is recorded
// and skipped so the walk always terminates with a report, never hangs.
const DEFAULT_MAX_RESETS_PER_ENTRY = 60;
const DEFAULT_MAX_TICKS_PER_RUN = 200000;
// Matches driver.mjs: with no progress for this many ticks the run is treated
// as ended (nobody drives the end-of-content overlay headlessly).
const DEFAULT_MAX_IDLE_TICKS = 50;

/** Advance one tick, mirroring driver.mjs's hard-won run-end discipline. */
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
        // serializes the whole gamestate on every completion.
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
 * @param {object} o.apLocations    taskId -> AP location name (payload-native)
 * @param {string[]} o.perkItemNames
 * @param {object|Map} o.gateCounts taskId -> access-rule perk count (0 = free)
 * @param {string|number} o.seed    world seed (seed_name); drives the shuffle
 * @param {object} [o.options]      { resetsPerStep, categoryFractions,
 *                                    perkCountSentinel, maxResetsPerEntry,
 *                                    modOverrides, onProgress }
 * @returns {Promise<{patches, report}>}
 */
export async function runBalancePass({
    env, sphereLog, playerId, apLocations, perkItemNames, gateCounts, seed, options = {},
}) {
    const { sim, game, zones, win } = env;
    const {
        resetsPerStep = DEFAULT_RESETS_PER_STEP,
        categoryFractions = DEFAULT_CATEGORY_FRACTIONS,
        perkCountSentinel = null,
        maxResetsPerEntry = DEFAULT_MAX_RESETS_PER_ENTRY,
        thresholdClampMargin = 0.5,
        modOverrides = {},
        onProgress = null,
    } = options;
    const perks = new Set(perkItemNames);

    // --- The walk order --------------------------------------------------
    // Field sentinels ("none") come from a default-constructed definition —
    // ItemType.Count isn't re-exported by the zones module.
    const defDefaults = new zones.TaskDefinition({});
    const taskMeta = new Map();
    for (const def of zones.TASK_LOOKUP.values()) {
        taskMeta.set(def.id, {
            type: def.type,
            zone: def.zone_id,
            unlocksTask: def.unlocks_task >= 0 ? def.unlocks_task : null,
            item: def.item !== defDefaults.item ? def.item : null,
            useItem: def.use_item !== defDefaults.use_item ? def.use_item : null,
        });
    }
    const { entries, report: orderReport } = buildWalkOrder({
        sphereLog, playerId, apLocations, perkItemNames, taskMeta, gateCounts,
        seed: toSeedInt(seed),
    });
    if (!entries.length) {
        throw new Error('runBalancePass: empty walk order — no jta locations resolved. '
            + 'Is apLocations populated and the sphere log for the right player?');
    }
    for (const entry of entries) {
        entry.milestone = entry.items.some((n) => perks.has(n));
    }
    if (!entries.some((e) => e.milestone)) {
        throw new Error('runBalancePass: no perk milestones in the walk — '
            + 'is Pass A emitting access rules? A degenerate single-sphere log cannot pace anything.');
    }

    // --- Engine setup -----------------------------------------------------
    // The fork's render loop runs on a timer and would tick against the
    // stubbed DOM; pause before AND after (reset/prestige paths restart it).
    win.pauseGameLoop();
    win.initializeHeadless();
    // NORMAL ticking — never instant mode here (see module header / plan §1.1).
    win.setInstantMode(false);
    const mods = { ...baselineMods(), ...modOverrides };
    for (const [name, value] of Object.entries(mods)) {
        if (!sim.setMod(name, value)) throw new Error(`setMod(${name}) failed`);
    }
    game.GAMESTATE.automation_skip_blocked = true;
    sim.autoFillAllPriorities();
    sim.setAutomationMode(sim.AutomationMode.All);

    // Pristine multipliers, captured BEFORE any solving: the bisection's
    // estimateAt probes mutate the shared static definitions, so "restore
    // vanilla" must read this snapshot, never def.cost_multiplier (reading the
    // def after a saturated bisection "restored" 1e6 — measured bug).
    const vanillaCm = new Map();
    for (const def of zones.TASK_LOOKUP.values()) vanillaCm.set(def.id, def.cost_multiplier);

    // Grants are AP-authoritative: suppress every perk task's local grant so
    // the only perks the solved game sees are the ones the walk hands over, in
    // log order.
    if (perkCountSentinel != null) {
        const suppress = [];
        for (const def of zones.TASK_LOOKUP.values()) {
            if (def.perk !== perkCountSentinel) suppress.push({ id: def.id, perk: perkCountSentinel });
        }
        if (suppress.length) win.applyTaskPatches(suppress);
    }

    // --- Walk state ---------------------------------------------------------
    let run = 1;
    const tick = makeStepper(env, () => { run++; });

    const released = new Set();
    const pendingEntry = new Map();     // taskId -> entry index awaiting first-start solve
    const entryReports = entries.map((e) => ({
        taskId: e.taskId,
        location: e.location,
        bucket: e.bucket,
        milestone: e.milestone,
        synthesized: e.synthesized,
        target: null,
        costMultiplier: null,
        estimate: null,
        releasedRun: null,
        solvedRun: null,
        completedRun: null,
        stalled: false,
        clamp: null,                    // 'skillless' | 'floor' | 'saturated' | null
    }));
    let frontier = -1;
    let milestoneBaseRun = 1;           // run at which the previous milestone completed
    const milestoneGaps = [];
    const patches = [];
    let saturated = 0;
    let skillless = 0;
    let floorClamped = 0;
    let thresholdClamped = 0;

    const release = (k) => {
        frontier = k;
        const entry = entries[k];
        released.add(entry.taskId);
        win.setCostedTaskIds(released);
        pendingEntry.set(entry.taskId, k);
        entryReports[k].releasedRun = run;
    };

    // 2. ASSIGN. The normal path is the first-start callback: it fires
    // synchronously inside the sim, before the starting tick reads the cost;
    // decision-time current_energy is the budget the estimator sees (rulings
    // 6+7). It fires again on every later run's fresh start — the pendingEntry
    // map dedupes to exactly one solve per task. The boss-gate boundary path
    // (below) reuses the same solve.
    const solveEntry = (taskId, k, via) => {
        pendingEntry.delete(taskId);
        const rep = entryReports[k];
        const entry = entries[k];
        const meta = taskMeta.get(taskId);
        rep.solvedRun = run;
        rep.solvedVia = via;

        if (!entry.milestone) {
            // Non-milestone: Loops-style fraction rule. Bisect to the est>=1
            // boundary — its LO bracket is "just affordable with decision-time
            // energy" — and scale it down by the category fraction. Reps reset
            // every run, so everything already costed is REPLAYED every run:
            // connective tissue must stay cheap or the replay tax swamps the
            // milestone pacing (measured: est-target-1 here made reaching a
            // zone-3 frontier cost dozens of runs). Cost is linear in the
            // multiplier, so lo × f costs ≈ f of the current budget.
            const fraction = categoryFractions[meta?.type] ?? 0.25;
            rep.target = fraction;
            const probe = solveCostMultiplier(env, taskId, 1, { cap: 2 });
            if (probe.skillless) {
                rep.costMultiplier = vanillaCm.get(taskId);
                rep.estimate = 0;
                rep.clamp = 'skillless';
                skillless++;
                return;
            }
            const base = probe.lo ?? MIN_COST_MULTIPLIER;
            let cm = Math.max(MIN_COST_MULTIPLIER, base * fraction);
            win.applyTaskPatches([{ id: taskId, cost_multiplier: cm }]);
            const clamp = clampToThresholdEngagement(taskId, cm);
            if (clamp.clamped) {
                cm = clamp.cm;
                rep.clamp = 'threshold';
                rep.unengaged = Boolean(clamp.floored);
                thresholdClamped++;
            } else if (cm === MIN_COST_MULTIPLIER) {
                rep.clamp = 'floor';
                floorClamped++;
            }
            rep.costMultiplier = cm;
            rep.estimate = 0;
            patches.push({ id: taskId, cost_multiplier: cm });
            return;
        }

        // Milestone: estimator inversion against the REMAINING step budget,
        // so the constant milestone-to-milestone gap survives whatever the
        // step's other tasks consumed.
        const target = Math.max(1, resetsPerStep - (run - milestoneBaseRun));
        rep.target = target;
        const solved = solveCostMultiplier(env, taskId, target, { cap: target + 1 });
        rep.costMultiplier = solved.costMultiplier;
        rep.estimate = solved.estimate;
        if (solved.skillless) {
            // Cost cannot move a skill-less task; it stays vanilla.
            rep.clamp = 'skillless';
            skillless++;
            return;
        }
        if (solved.saturated) {
            // Even MAX cost can't make it take `target` resets (deep-game
            // skill levels can trivialize any cost) — leave it at its
            // PRISTINE vanilla multiplier (see vanillaCm) and say so.
            rep.clamp = 'saturated';
            saturated++;
            win.applyTaskPatches([{ id: taskId, cost_multiplier: vanillaCm.get(taskId) }]);
            rep.costMultiplier = vanillaCm.get(taskId);
            return;
        }
        let cm = solved.costMultiplier;
        const clamp = clampToThresholdEngagement(taskId, cm);
        if (clamp.clamped) {
            cm = clamp.cm;
            rep.costMultiplier = cm;
            rep.clamp = 'threshold';
            rep.unengaged = Boolean(clamp.floored);
            thresholdClamped++;
        } else if (cm === MIN_COST_MULTIPLIER && target > 0) {
            rep.clamp = 'floor';
            floorClamped++;
        }
        patches.push({ id: taskId, cost_multiplier: cm });
    };

    // Engagement clamp: a cost automation refuses to RUN is as unfinishable as
    // a saturated one. The threshold mods judge tasks by more than
    // affordability — notably `threshold_other` defaults to the LEVEL metric
    // (cost / expected_levels vs 1% of max energy), and grant suppression
    // (perk -> Count) RECATEGORIZES former perk tasks into "other", in the
    // solver and in real AP play alike — so every solved cost is clamped down
    // to the largest multiplier the thresholds still engage with. Self-guarding
    // when thresholds are off (isThresholdSkipped is then always false).
    const clampToThresholdEngagement = (taskId, cm) => {
        const def = zones.TASK_LOOKUP.get(taskId);
        const skippedAt = (x) => {
            win.applyTaskPatches([{ id: taskId, cost_multiplier: x }]);
            return sim.isThresholdSkipped(new zones.Task(def));
        };
        if (!skippedAt(cm)) return { cm, clamped: false };
        let lo = MIN_COST_MULTIPLIER;
        let hi = cm;
        if (skippedAt(lo)) return { cm: lo, clamped: true, floored: true };
        while ((hi - lo) / hi > 0.01) {
            const mid = Math.sqrt(lo * hi);
            if (skippedAt(mid)) hi = mid; else lo = mid;
        }
        // Margin below the exact boundary: the LEVEL metric's ratio drifts
        // AGAINST the task as skills grow (higher levels need more XP, so
        // expected_levels shrink while the cost stays fixed) — a zero-margin
        // clamp flips back to skipped before the sim's next pass through the
        // task's zone (measured). Keep a real safety factor.
        const cm2 = Math.max(MIN_COST_MULTIPLIER, lo * thresholdClampMargin);
        skippedAt(cm2);   // leave the def patched at the final value
        return { cm: cm2, clamped: true };
    };

    win.setTaskFirstStartCallback((info) => {
        const k = pendingEntry.get(info.id);
        if (k != null) solveEntry(info.id, k, 'first-start');
    });

    // 4. GRANT + advance the frontier when the frontier entry completes.
    // Replayed completions of earlier entries (reps reset every run) fire this
    // too and are deliberately ignored: only the frontier moves the walk.
    // Advance past the frontier entry: hand over its logged grants (perk items
    // via grantPerk, AP-authoritative order) and release the next entry.
    // `completed` is false for an UNENGAGED skip — the grants still flow (the
    // walk's economy needs what the log says arrives) but no gap is recorded.
    const advanceFrontier = (completed) => {
        const entry = entries[frontier];
        const rep = entryReports[frontier];
        if (completed) rep.completedRun = run;
        for (const item of entry.items) {
            if (perks.has(item)) win.grantPerk(item);
        }
        if (entry.milestone) {
            if (completed) {
                rep.gap = run - milestoneBaseRun;
                milestoneGaps.push(rep.gap);
            }
            milestoneBaseRun = run;
        }
        if (frontier + 1 < entries.length) release(frontier + 1);
        else frontier = entries.length;
    };

    win.setTaskCompletionCallback((info) => {
        if (frontier >= entries.length || info.id !== entries[frontier].taskId) return;
        advanceFrontier(true);
    });

    // --- 3. ADVANCE ---------------------------------------------------------
    release(0);
    let lastProgressFrontier = -1;
    while (frontier < entries.length) {
        const rep = entryReports[frontier];
        if (run - rep.releasedRun > maxResetsPerEntry) {
            // Stalled: record, drop the pending solve if it never started, and
            // move on so the pass always terminates with a report.
            rep.stalled = true;
            {
                // Diagnostics: why is this entry stuck? Evaluated on a fresh
                // throwaway Task at the stall boundary (full pool, zone 0).
                const def = zones.TASK_LOOKUP.get(entries[frontier].taskId);
                const t = def ? new zones.Task(def) : null;
                const prioZones = [];
                for (const [z, ids] of game.GAMESTATE.automation_prios) {
                    if (ids.includes(entries[frontier].taskId)) prioZones.push(z);
                }
                rep.stallDiag = def ? {
                    defZone: def.zone_id,
                    costMultiplier: def.cost_multiplier,
                    hidden: def.hidden_by_default,
                    unlocked: game.GAMESTATE.unlocked_tasks.includes(def.id),
                    inPrioZones: prioZones,
                    simHighestZone: game.GAMESTATE.highest_zone,
                    energy: Math.round(game.GAMESTATE.current_energy),
                    disabled: sim.isTaskDisabledWithoutBeingFinished(t),
                    bossGate: sim.isTaskDisabledDueToTooStrongBoss(t),
                    thresholdSkipped: sim.isThresholdSkipped(t),
                } : { missingDef: true };
            }
            pendingEntry.delete(entries[frontier].taskId);
            if (frontier + 1 < entries.length) release(frontier + 1);
            else break;
            continue;
        }
        const wasReset = tick();
        if (wasReset) {
            // Boundary fallback: first-start is the organic assignment path,
            // but a frontier can be unable (or unmotivated) to START at its
            // PRE-SOLVE vanilla cost, so first-start never fires and never
            // assigns the cost that would fix it. Two measured cases: a Boss
            // whose vanilla cost trips the disparity gate (DISABLED, and
            // Best-Task only considers threshold-skipped tasks), and a
            // threshold-skipped task in an already-passed zone (automation
            // replays the zone, takes Travel onward, and the all-skipped
            // fallback never fires because deeper zones always offer work).
            // So: a frontier still pending after a FULL run since release
            // gets solved at the run boundary — full pool, zone 0 — and
            // then engages the economy like any other costed task.
            const pendingId = entries[frontier]?.taskId;
            if (pendingId != null && pendingEntry.has(pendingId)
                    && run - entryReports[frontier].releasedRun >= 2) {
                solveEntry(pendingId, frontier, 'boundary');
            }
            // UNENGAGED: the engagement clamp floored — the threshold's LEVEL
            // metric rejects this task at ANY cost (the ratio is nearly
            // cost-invariant, and it drifts against the task as skills grow).
            // Automation will never run it — in the solver and, under the same
            // profile, in real play — so waiting would only stall the walk.
            // Leave it allowlisted at MIN (it may complete opportunistically),
            // hand its grants over, and move on. Reported as `unengaged`.
            if (frontier < entries.length && entryReports[frontier].unengaged
                    && entryReports[frontier].completedRun == null) {
                advanceFrontier(false);
            }
        }
        if (wasReset && onProgress && frontier !== lastProgressFrontier) {
            lastProgressFrontier = frontier;
            onProgress({ entry: frontier, total: entries.length, run });
            // Yield so a worker stays responsive and can post progress.
            await Promise.resolve();
        }
    }

    win.setTaskFirstStartCallback(null);
    win.setTaskCompletionCallback(null);
    win.setCostedTaskIds(null);
    // Prestige/reset paths can restart the render loop; leave it stopped so a
    // Node caller can exit and a worker isn't ticking a stubbed DOM.
    win.pauseGameLoop();

    return {
        patches,
        report: {
            order: orderReport,
            entries: entryReports,
            entryCount: entries.length,
            milestoneCount: entries.filter((e) => e.milestone).length,
            milestoneGaps,
            resetsPerStep,
            costedTaskCount: patches.length,
            skillless,
            saturated,
            floorClamped,
            thresholdClamped,
            stalledEntries: entryReports.filter((r) => r.stalled).length,
            unengaged: entryReports.filter((r) => r.unengaged && r.completedRun == null).length,
            neverStarted: entryReports.filter((r) => r.solvedRun == null && !r.stalled).length,
            totalResets: run - 1,
        },
    };
}
