/**
 * The §2 balancing pass: a Loops-style forward walk over the post-fill sphere
 * log that assigns each JtA task a `cost_multiplier`, so that each perk
 * milestone lands roughly the number of energy resets after the previous one
 * that the vanilla game would have taken.
 *
 * ENV-AGNOSTIC. Like CC/scripts/jta-stats/driver.mjs, this module never imports
 * the game: the caller hands it an `env` ({ sim, zones, win }) built by
 * headlessGameEnv.js. That lets one implementation serve the Pass-B Web Worker,
 * the Node stats harness, and Phase 4 verification.
 *
 * ── Why a forward pass ────────────────────────────────────────────────────
 * The legacy solver searched globally and revisited assignments, which let
 * traversal costs and xpMult compounding feed back on each other. Walking
 * forward and assigning each task a cost the FIRST time the progression
 * reaches it ("first-touch") removes both levers by construction: nothing
 * already assigned is ever revisited. Between steps the state is advanced by
 * the fork's own simulation in instant mode, so the numbers the next
 * assignment sees are emergent reality, not a model's projection.
 *
 * ── The assignment rule ───────────────────────────────────────────────────
 * Loops charges "half your current mana", which is affordable by construction.
 * JtA inverts that: a task should NOT be completable now, but within N resets.
 * `estimateResetsToComplete` is the fork's own metric for exactly that, and
 * `calcTaskCost` is linear in `cost_multiplier`, so the estimate is monotone
 * non-decreasing in cost and a bisection inverts it.
 *
 * The estimate assumes a DEDICATED grind, though, while real automation works
 * a priority queue, so it is a biased predictor of the resets actually taken.
 *
 * !! `calibration-standalone-z14.json` was built to correct that bias and DOES
 * NOT SUPPORT THE WEIGHT. Its samples are not independent (1487 samples from
 * only 118 tasks — a task that lingers contributes one sample per run); it
 * measures the wrong conditional (the balancer assigns ONCE, at first touch, and
 * the per-task table is non-monotone on n = 46/12/7/11/10/5/11/16); and it is
 * observational, not interventional — cost is vanilla throughout, never
 * manipulated, so it cannot answer "what happens if I SET the cost". Its upper
 * half moves with the build's automation defaults and with `auto_prestige`.
 * See derive-calibration.mjs's header and SUMMARY.md Round 7.
 *
 * RULED 2026-07-08, superseding the position-indexed anchor-curve replay: aim
 * for a CONSTANT number of resets between milestones (`resetsPerStep`), and
 * MEASURE the real gaps by replaying the forward pass rather than predicting
 * them from a static curve. `invertCalibration` and `targetGapForMilestone`
 * survive only to seed the first guess.
 */

// TaskType (zones.ts). Duplicated as an integer map because the fork exposes
// the enum only through the build's module namespace, which callers may not
// have handy when they only want to name a weight.
export const TASK_TYPE = Object.freeze({
    Normal: 0, Travel: 1, Mandatory: 2, Prestige: 3, Boss: 4,
});

/**
 * Intra-step split (plan Q6). A step's reset budget is shared among its tasks
 * by category: the perk milestone that ENDS the step carries the full budget
 * (it is the event the anchor curve actually measures), and the rest are
 * scaled relative to it. Bosses are meant to bite; ordinary tasks are filler
 * between milestones. These are the old cost planner's per-category attempt
 * targets, surviving as weights.
 */
export const DEFAULT_CATEGORY_WEIGHTS = Object.freeze({
    [TASK_TYPE.Normal]: 0.75,
    [TASK_TYPE.Travel]: 1.0,
    [TASK_TYPE.Mandatory]: 1.0,
    [TASK_TYPE.Prestige]: 1.0,
    [TASK_TYPE.Boss]: 1.5,
});

/**
 * Non-milestone cost rule (the Loops "half your current mana" analog): a
 * non-milestone task's total remaining energy cost is aimed at this FRACTION
 * of decision-time energy. Reps reset every energy reset, so every
 * previously-costed task is REPLAYED every run — connective tissue
 * (Travel/Mandatory, plus most Normal tasks) must therefore stay cheap or the
 * replay tax swamps the milestone pacing entirely: pricing each at even ~one
 * run's grind made reaching a zone-3 frontier cost dozens of runs (measured —
 * the first converging-run failure). Milestones alone carry the reset budget.
 * Bosses bite hardest while staying below the boss-disparity gate (< 1×
 * current energy keeps them startable).
 */
export const DEFAULT_CATEGORY_FRACTIONS = Object.freeze({
    [TASK_TYPE.Normal]: 0.25,
    [TASK_TYPE.Travel]: 0.10,
    [TASK_TYPE.Mandatory]: 0.10,
    [TASK_TYPE.Prestige]: 0.10,
    [TASK_TYPE.Boss]: 0.5,
});

// Bisection bounds on cost_multiplier. Vanilla multipliers span roughly 1..100;
// the window is deliberately wide so the search brackets rather than saturates.
export const MIN_COST_MULTIPLIER = 0.05;
export const MAX_COST_MULTIPLIER = 1e6;

// `estimateResetsToComplete(task, cap)` returns cap + 1 for "not within cap".
export const ESTIMATOR_CAP = 200;

/**
 * Invert the calibration curve: given a target number of ACTUAL resets, return
 * the estimator value to aim the cost bisection at.
 *
 * `curve` is the isotonic (non-decreasing) fit emitted by derive-calibration.mjs:
 * [{ estimate, actualP50 }, …]. Returns { estimate, clamped } where `clamped` is
 * 'floor' | 'plateau' | null.
 */
export function invertCalibration(curve, targetResets) {
    if (!Array.isArray(curve) || curve.length === 0) throw new Error('invertCalibration: empty curve');
    const first = curve[0];
    const last = curve[curve.length - 1];
    if (targetResets <= first.actualP50) return { estimate: first.estimate, clamped: 'floor' };
    if (targetResets >= last.actualP50) {
        // The isotonic fit pools its terminal violators into one flat block, so
        // every estimate from the start of that block predicts the same number
        // of resets. Aim at the CHEAPEST of them: anything beyond is a larger
        // cost_multiplier bought for no pacing at all.
        const plateauStart = curve.find((p) => p.actualP50 >= last.actualP50) ?? last;
        return { estimate: plateauStart.estimate, clamped: 'plateau' };
    }

    for (let i = 1; i < curve.length; i++) {
        const lo = curve[i - 1];
        const hi = curve[i];
        if (targetResets > hi.actualP50) continue;
        const span = hi.actualP50 - lo.actualP50;
        // Flat segments (the isotonic fit pools violators) carry no information
        // about where inside them the target sits; take the cheapest estimate
        // that reaches it.
        if (span <= 0) return { estimate: lo.estimate, clamped: null };
        const t = (targetResets - lo.actualP50) / span;
        return { estimate: lo.estimate + t * (hi.estimate - lo.estimate), clamped: null };
    }
    /* istanbul ignore next — the loop above always returns for in-window targets */
    return { estimate: last.estimate, clamped: 'plateau' };
}

/**
 * Position-indexed replay of the vanilla pacing curve (plan Q6 ruling A): the
 * k-th milestone's target gap is read off the anchor curve at the same relative
 * position, with seeded jitter matching local variance. Preserves the trend
 * (early quick, late grindy) rather than just the distribution.
 *
 * `rng` is a function returning [0,1) — the caller supplies a seeded one so a
 * given seed always produces the same world.
 */
export function targetGapForMilestone(anchorCurve, index, milestoneCount, { rng, jitter = 0 } = {}) {
    if (!anchorCurve.length) throw new Error('targetGapForMilestone: empty anchor curve');
    if (milestoneCount <= 1) return anchorCurve[0];
    // Map this milestone's position onto the anchor curve's position.
    const pos = (index / (milestoneCount - 1)) * (anchorCurve.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(anchorCurve.length - 1, lo + 1);
    const base = anchorCurve[lo] + (pos - lo) * (anchorCurve[hi] - anchorCurve[lo]);
    if (!jitter || !rng) return base;
    // Symmetric multiplicative jitter, never negative.
    return Math.max(0, base * (1 + (rng() * 2 - 1) * jitter));
}

/**
 * Flatten a sphere log into the ordered list of location checks, the way Loops'
 * costGenerator._extractLocationEntries does.
 *
 * AP writes one `state_update` per progression pickup once the sphere's
 * frontier is open, so the entries are already a total order over the
 * player's progression. Returns [{ location, items: string[], sphereIndex }].
 */
export function extractLocationEntries(sphereLog, playerId) {
    const out = [];
    for (const entry of sphereLog) {
        if (entry?.type !== 'state_update') continue;
        const pd = entry.player_data?.[playerId] ?? entry.player_data?.[String(playerId)];
        if (!pd) continue;
        const locations = pd.sphere_locations ?? [];
        if (!locations.length) continue;
        const items = Object.keys(pd.new_inventory_details?.base_items ?? {});
        // AP attributes a sphere's items to the sphere, not to a specific
        // location. Fractional sub-spheres carry exactly one location each, so
        // the attribution is unambiguous there; when several share a sphere the
        // items ride the last one, matching costGenerator's convention.
        for (let i = 0; i < locations.length; i++) {
            out.push({
                location: locations[i],
                items: i === locations.length - 1 ? items : [],
                sphereIndex: entry.sphere_index,
            });
        }
    }
    return out;
}

/**
 * Group the ordered location entries into STEPS. A step ends at each perk
 * milestone (inclusive) — the event the anchor curve measures. Locations after
 * the final milestone form a trailing step with no milestone.
 *
 * `apLocations` maps AP location name -> jta task id (the inverse of the
 * per-region `ap_locations` sidecar). Locations belonging to other players or
 * to non-jta regions are skipped: a multiworld sphere log contains them, and
 * they neither cost anything here nor advance JtA.
 */
export function buildPlan(locationEntries, { apLocations, perkItemNames }) {
    const perks = new Set(perkItemNames);
    const steps = [];
    let current = { tasks: [], milestone: null, grants: [] };
    for (const entry of locationEntries) {
        const taskId = apLocations[entry.location];
        if (taskId == null) continue;
        const perkItem = entry.items.find((n) => perks.has(n));
        current.tasks.push(taskId);
        for (const item of entry.items) current.grants.push(item);
        if (perkItem) {
            current.milestone = taskId;
            current.milestonePerk = perkItem;
            steps.push(current);
            current = { tasks: [], milestone: null, grants: [] };
        }
    }
    if (current.tasks.length) steps.push(current);
    return steps;
}

/**
 * Smallest `cost_multiplier` in [MIN, MAX] whose estimate is >= targetEstimate,
 * i.e. the boundary of the target region. Mutates the task definition through
 * the fork's own patch hook so every live Task sees it, then leaves it at the
 * solved value.
 *
 * `estimateResetsToComplete` is monotone non-decreasing in cost_multiplier
 * (cost is linear in it, and the estimate is monotone in cost), so a plain
 * bisection is exact up to `tolerance` in multiplier space.
 *
 * Returns { costMultiplier, estimate, skillless, lo } — skill-less tasks
 * always estimate 0 regardless of cost (simulation.ts short-circuits on
 * `def.skills.length == 0`), so they are left at their vanilla multiplier.
 * `lo` is the under-target bracket: the largest probed multiplier whose
 * estimate is still BELOW the target — for target 1, "just affordable with
 * decision-time energy", which is what the non-milestone fraction rule
 * scales down (cost is linear in the multiplier, so lo × f costs ≈ f of the
 * current budget). Absent when even MIN_COST_MULTIPLIER meets the target.
 */
export function solveCostMultiplier(env, taskId, targetEstimate, { tolerance = 0.01, cap = ESTIMATOR_CAP } = {}) {
    const { sim, zones, win } = env;
    const def = zones.TASK_LOOKUP.get(taskId);
    if (!def) throw new Error(`solveCostMultiplier: unknown task ${taskId}`);
    if (!def.skills?.length) {
        return { costMultiplier: def.cost_multiplier, estimate: 0, skillless: true };
    }

    const estimateAt = (cm) => {
        win.applyTaskPatches([{ id: taskId, cost_multiplier: cm }]);
        return sim.estimateResetsToComplete(new zones.Task(def), cap);
    };

    const target = Math.max(0, Math.round(targetEstimate));
    if (estimateAt(MIN_COST_MULTIPLIER) >= target) {
        // Even the cheapest cost already meets (or exceeds) the target: the
        // task's skills are too weak for cost to help. Leave it cheap.
        return { costMultiplier: MIN_COST_MULTIPLIER, estimate: estimateAt(MIN_COST_MULTIPLIER), skillless: false };
    }
    let lo = MIN_COST_MULTIPLIER;   // estimate < target
    let hi = MAX_COST_MULTIPLIER;
    if (estimateAt(hi) < target) {
        return { costMultiplier: hi, estimate: estimateAt(hi), skillless: false, saturated: true, lo: hi };
    }
    while ((hi - lo) / hi > tolerance) {
        const mid = Math.sqrt(lo * hi);   // geometric midpoint: cost spans decades
        if (estimateAt(mid) >= target) hi = mid; else lo = mid;
    }
    return { costMultiplier: hi, estimate: estimateAt(hi), skillless: false, lo };
}
