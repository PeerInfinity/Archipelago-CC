/**
 * surveyShards — **THE ROUTE SURVEY, SPLIT ACROSS RUNNERS AND PUT BACK
 * TOGETHER EXACTLY** (rules arc, slice `rules-survey-ci`; ⚖ user 2026-10-06:
 * CPU-heavy work runs in CI, off the box).
 *
 * `survey-seedling-route.mjs --through=<b> --route=<m>` is one parent that
 * solves its steps one child at a time; at `--timeout=1500` the two routes
 * ran for hours on the box. It already composes `--only=<ids>` with
 * `--out=<file>` (a missing `--out` file merges onto nothing), so a SHARD is
 * that command with its own step list, and nothing in the survey moved. This
 * module is the two pure halves around it:
 *
 *   PLAN   `partitionSteps` — a price-balanced partition (longest first, onto
 *          the least-loaded shard). The price is the survey's OWN `ms`, read
 *          off a prior survey of the same route by STEP IDENTITY
 *          (`stepCosts`), never a hand-typed table. Without one every step
 *          costs the same and the partition is a deal, which it says
 *          (`costSource`).
 *   MERGE  `mergeShards` — the shards' rows assembled into `survey.json`
 *          EXACTLY as the unsharded run writes it (`{generator, route, rows}`,
 *          rows in route order), so `census-seedling-campaign.mjs
 *          --check-frontier` reads it unchanged. ⛔ It REFUSES BY NAME a step
 *          that is missing, duplicated, not on the route, or carried by a
 *          shard whose route is another derivation (another mode, bound or
 *          SHA) — a shard that died must not read as a shorter, greener survey.
 *
 *   COMPARE `compareSurveys` — two surveys of one route, verdict by verdict
 *          (SOLVED / REFUSED / TIMEOUT / …, plus the refusal family). The
 *          box-vs-runner equivalence table is this function's output. ⚠ The
 *          solver's budget is WALL-CLOCK, so a TIMEOUT disagreement is a fact
 *          about two machines, never a model gap; `ms` is reported, not
 *          compared.
 */

/** A step's identity: room, arrival and goals (the survey's own `identityOf`). */
export function stepIdentity(s) {
    return `L${s.level}@${s.arrival?.x},${s.arrival?.y}:`
        + (s.goals ?? []).map((g) => `${g.kind}(${JSON.stringify(g.exit ?? g.placement ?? g.pit)})`).join('+');
}

/**
 * Each route step's price, from a PRIOR survey's rows (`ms`), matched by
 * identity rather than step number — a route that grew a leg renumbers every
 * later step, and a number-keyed price would land on the wrong room.
 *
 * @param {Array} steps the route's steps (`route.json` `steps`)
 * @param {?{route: {steps: Array}, rows: Array}} prior a survey.json, or null
 * @returns {{costs: Map<string, number>, known: number, source: string}}
 *   costs keyed by step id (as a string); an unpriced step gets the MEDIAN of
 *   the priced ones (1 when none are) — named in `source`
 */
export function stepCosts(steps, prior) {
    const priced = new Map();
    if (prior?.route?.steps && Array.isArray(prior.rows)) {
        const idOf = new Map(prior.route.steps.map((s) => [String(s.step), stepIdentity(s)]));
        for (const r of prior.rows) {
            const id = idOf.get(String(r.step));
            if (id !== undefined && Number.isFinite(r.ms)) priced.set(id, r.ms);
        }
    }
    const raw = steps.map((s) => priced.get(stepIdentity(s)));
    const known = raw.filter((v) => v !== undefined).sort((a, b) => a - b);
    const fill = known.length ? known[Math.floor((known.length - 1) / 2)] : 1;
    const costs = new Map(steps.map((s, i) => [String(s.step), raw[i] ?? fill]));
    const source = !known.length
        ? 'uniform (no prior survey priced any step)'
        : `prior survey ms (${known.length}/${steps.length} steps priced; the rest at the median ${fill} ms)`;
    return { costs, known: known.length, source };
}

/**
 * Longest-processing-time first: steps by price descending (ties: lower step
 * first), each onto the least-loaded shard (ties: the lower shard). Never more
 * shards than steps; each shard's steps come back in route order.
 *
 * @param {Array<string|number>} ids step ids, in route order
 * @param {number} n shards asked for
 * @param {Map<string, number>} costs price per id (as a string)
 * @returns {Array<{shard: number, steps: string[], cost: number}>}
 */
export function partitionSteps(ids, n, costs) {
    if (!Number.isInteger(n) || n < 1) throw new Error(`partitionSteps: shards must be a positive integer, got ${n}`);
    const order = new Map(ids.map((id, i) => [String(id), i]));
    if (order.size !== ids.length) throw new Error('partitionSteps: the step list repeats an id');
    const k = Math.min(n, ids.length);
    const shards = Array.from({ length: k }, (_, i) => ({ shard: i + 1, steps: [], cost: 0 }));
    const byPrice = [...order.keys()].sort((a, b) => (costs.get(b) ?? 0) - (costs.get(a) ?? 0) || order.get(a) - order.get(b));
    for (const id of byPrice) {
        let best = shards[0];
        for (const s of shards) if (s.cost < best.cost) best = s;
        best.steps.push(id);
        best.cost += costs.get(id) ?? 0;
    }
    for (const s of shards) s.steps.sort((a, b) => order.get(a) - order.get(b));
    return shards;
}

/** The first top-level key two route documents disagree on (null when equal). */
function routeDifference(a, b) {
    if (JSON.stringify(a) === JSON.stringify(b)) return null;
    const keys = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])];
    const hit = keys.find((k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]));
    return hit ?? '(key order)';
}

/**
 * The shards' rows, assembled into the survey the unsharded run would write.
 *
 * @param {object} route the plan's `route.json` (the derivation every shard must share)
 * @param {Array<{name: string, survey: {route: object, rows: Array}}>} shards
 * @param {{base?: ?{route: object, rows: Array}, partial?: boolean}} [opts]
 *   `base`: a prior merged survey of the SAME route whose rows fill the steps
 *   no shard ran (the `only` re-run); `partial`: accept missing steps
 * @returns {{survey?: object, refusals: string[], missing: string[]}}
 *   `survey` is set only when `refusals` is empty
 */
export function mergeShards(route, shards, { base = null, partial = false } = {}) {
    const refusals = [];
    const ids = route.steps.map((s) => String(s.step));
    const onRoute = new Set(ids);
    const mode = `${route.routeMode?.mode ?? '(no mode)'} through ${route.routeMode?.through ?? '(no bound)'}`;
    const from = new Map();
    const rows = new Map();
    for (const { name, survey } of shards) {
        const diff = routeDifference(route, survey?.route);
        if (diff !== null) {
            refusals.push(`FOREIGN-ROUTE: shard ${name} carries another derivation (first difference: '${diff}'; `
                + `its route is ${survey?.route?.routeMode?.mode ?? '(no mode)'} through `
                + `${survey?.route?.routeMode?.through ?? '(no bound)'}, the plan's is ${mode})`);
            continue;
        }
        for (const r of survey.rows ?? []) {
            const id = String(r.step);
            if (!onRoute.has(id)) { refusals.push(`UNKNOWN-STEP: shard ${name} carries step ${id}, which is not on the route`); continue; }
            if (from.has(id)) { refusals.push(`DUPLICATE-STEP: step ${id} is carried by shard ${from.get(id)} and shard ${name}`); continue; }
            from.set(id, name);
            rows.set(id, r);
        }
    }
    if (base) {
        const diff = routeDifference(route, base.route);
        if (diff !== null) refusals.push(`FOREIGN-ROUTE: the base survey carries another derivation (first difference: '${diff}')`);
        else for (const r of base.rows ?? []) if (onRoute.has(String(r.step)) && !rows.has(String(r.step))) rows.set(String(r.step), r);
    }
    const missing = ids.filter((id) => !rows.has(id));
    if (missing.length && !partial) refusals.push(`MISSING-STEP: ${missing.length} of ${ids.length} route step(s) have no row: ${missing.join(',')}`);
    if (refusals.length) return { refusals, missing };
    return {
        refusals,
        missing,
        survey: { generator: route.generator, route, rows: ids.filter((id) => rows.has(id)).map((id) => rows.get(id)) },
    };
}

/**
 * Two surveys of ONE route, verdict by verdict.
 *
 * @returns {{rows: Array<{step, level, a, b, familyA, familyB, msA, msB, agree}>,
 *            disagreements: number, refusals: string[]}}
 */
export function compareSurveys(a, b) {
    const diff = routeDifference(a.route, b.route);
    if (diff !== null) return { rows: [], disagreements: 0, refusals: [`FOREIGN-ROUTE: the two surveys are different derivations (first difference: '${diff}')`] };
    const byA = new Map(a.rows.map((r) => [String(r.step), r]));
    const byB = new Map(b.rows.map((r) => [String(r.step), r]));
    const rows = a.route.steps.map((s) => {
        const ra = byA.get(String(s.step));
        const rb = byB.get(String(s.step));
        const va = ra?.verdict ?? 'ABSENT';
        const vb = rb?.verdict ?? 'ABSENT';
        const fa = ra?.family ?? null;
        const fb = rb?.family ?? null;
        return { step: s.step, level: s.level, a: va, b: vb, familyA: fa, familyB: fb,
            msA: ra?.ms ?? null, msB: rb?.ms ?? null, agree: va === vb && fa === fb };
    });
    return { rows, disagreements: rows.filter((r) => !r.agree).length, refusals: [] };
}
