/**
 * ⛓ ROUTE CHOOSER — **WHICH LOCATION NEXT**, by what the route there costs. One pure function every planner that
 * moves the PLAYER through a list of targets can plug in: the Playback Bot's walk loop (its `sphere-cheapest` and
 * `reachable-cheapest` target sources), and the offline route measure (`scripts/procgen/measure-bot-route-orders.mjs`)
 * that priced the orderings before the bot used one.
 *
 * ⚖ The user, 2026-10-20: *"Is there a way we could have the playback bot consider doing the fractional spheres in a
 * different order that reduces backtracking, or reduces the total number of region transitions in the path?"* The
 * sphere log's fractional order is alphabetical inside an AP sphere (`exporter/sphere_logger.py`): every row of one
 * integer sphere was reachable before any of them was collected, so taking them in another order is still a legal
 * playthrough. The chooser decides that order; it never decides how a leg is walked.
 *
 * THE COST. A candidate's route is priced by the caller (`ctx.cost(candidate)`), because only the caller has the
 * graph: `{hops, restart, pocket}` — the region transitions the route crosses, whether it begins with the built-in
 * RESTART move (`restartRoute.planRoute`'s `kind`), and whether it ENDS in a pocket no walk leaves (so a Restart is
 * owed later) — or null when there is no route. Its restarts are `restart + pocket`; the score is
 * `hops + restarts × restartPenalty`, lower wins. `restartPenalty = Infinity` (the default) compares the restarts
 * first and the hops after.
 *
 * THE GOAL GOES LAST. A candidate marked `goal` (it holds the completion condition's item) ranks behind every other:
 * taking it ends the game, and the cheapest-first order would otherwise take it as soon as it is near.
 *
 * THE TIES. `progression-first` (the default) puts a candidate whose `progression` is true before one whose is not —
 * an item that opens something before one that does not — and otherwise keeps the listed order, so with equal costs
 * the sphere log's own order decides. `listed` keeps the listed order only.
 *
 * ⛓ PLUG-IN POINT — the extras are written against this signature: LOOKAHEAD (`lookaheadCost`, bot-route-chooser-2b)
 * is a cost that walks k candidates ahead, and GRAB-ON-THE-WAY (`grabOnTheWay`, bot-route-chooser-2a) is a step over
 * the chosen candidate and the candidate list — neither changes how `rankCandidates` orders.
 */

/** The default penalty, in hops, a Restart adds to a route's score (`scripts/procgen/measure-bot-route-orders.mjs`). */
export const DEFAULT_RESTART_PENALTY = Infinity;

export const TIE_BREAKS = Object.freeze({ progressionFirst: 'progression-first', listed: 'listed' });

/**
 * The Restarts a priced route costs: one to take it, and one owed for a pocket it ends in — or, for a LOOKAHEAD
 * sequence's price (`lookaheadCost`), its own `restarts` count.
 */
export function routeRestarts(price) {
    if (Number.isFinite(price?.restarts)) return price.restarts;
    return (price?.restart ? 1 : 0) + (price?.pocket ? 1 : 0);
}

/** The score of one priced route (`{hops, restart, pocket}`); Infinity for no route, or with an infinite penalty. */
export function routeScore(price, restartPenalty = DEFAULT_RESTART_PENALTY) {
    if (!price || !Number.isFinite(price.hops)) return Infinity;
    const restarts = routeRestarts(price);
    return restarts === 0 ? price.hops : price.hops + restarts * restartPenalty;
}

/**
 * Every candidate that has a route, cheapest first. A candidate `ctx.cost` answers null for is left out.
 *
 * @param {Array<object>} candidates in their listed order (the sphere log's, for a sphere source)
 * @param {object} ctx
 * @param {(c: object) => ({hops: number, restart: boolean, pocket?: boolean}|null)} ctx.cost the caller's route price
 * @param {number} [ctx.restartPenalty=DEFAULT_RESTART_PENALTY]
 * @param {string} [ctx.tieBreak='progression-first']
 * @returns {Array<{candidate: object, price: object, score: number}>}
 */
export function rankCandidates(candidates, ctx = {}) {
    const { cost, restartPenalty = DEFAULT_RESTART_PENALTY, tieBreak = TIE_BREAKS.progressionFirst } = ctx;
    if (!Array.isArray(candidates) || typeof cost !== 'function') return [];
    const lexical = !Number.isFinite(restartPenalty);
    const priced = [];
    candidates.forEach((candidate, listed) => {
        const price = cost(candidate);
        if (!price || !Number.isFinite(price.hops)) return;
        const score = lexical ? price.hops : routeScore(price, restartPenalty);
        priced.push({ candidate, price, score, restarts: routeRestarts(price), listed });
    });
    const progressionFirst = tieBreak === TIE_BREAKS.progressionFirst;
    const flag = (c, key) => (c?.[key] === true ? 0 : 1);
    priced.sort((a, b) => {
        const goal = (1 - flag(a.candidate, 'goal')) - (1 - flag(b.candidate, 'goal'));
        if (goal !== 0) return goal;
        if (lexical && a.restarts !== b.restarts) return a.restarts - b.restarts;
        if (a.score !== b.score) return a.score - b.score;
        // a LOOKAHEAD tie (equal sequence totals) goes to the nearer first step: greedy's own pick when nothing differs
        if (Number.isFinite(a.price.lead) && Number.isFinite(b.price.lead) && a.price.lead !== b.price.lead) {
            return a.price.lead - b.price.lead;
        }
        if (progressionFirst) {
            const p = flag(a.candidate, 'progression') - flag(b.candidate, 'progression');
            if (p !== 0) return p;
        }
        return a.listed - b.listed;
    });
    return priced.map(({ candidate, price, score }) => ({ candidate, price, score }));
}

/** The cheapest candidate (`rankCandidates`' first), or null when none has a route. */
export function chooseNext(candidates, ctx = {}) {
    return rankCandidates(candidates, ctx)[0]?.candidate ?? null;
}

/**
 * ⛓ GRAB-ON-THE-WAY (slice `bot-route-chooser-2a`) — a candidate the chosen `target`'s route passes AT NO EXTRA COST,
 * taken first; else `target`. A candidate is on the way when going there and then on to `target` costs no more hops
 * and no more Restarts than going to `target` directly (zero detour): `ctx.costVia(c)` prices `here → c → target` as
 * `{hops, restarts}` (null = no such route), and it lies strictly BEFORE the target (fewer hops from here — a row in
 * the target's own region gains nothing by going first). Of several, the NEAREST (`ctx.cost(c)`'s hops, its Restart first; ties
 * progression-first, then listed). The goal and `target` itself are never grabbed.
 *
 * Applied once per choice: after the grab is checked, the caller chooses again from where it now stands — the same
 * replay the offline twin (`scripts/procgen/routeOrders.js`, `+grab`) prices.
 *
 * @param {object} target `chooseNext`'s pick
 * @param {Array<object>} candidates the rows that may be grabbed, in their listed order
 * @param {object} ctx
 * @param {(c: object) => ({hops: number, restart: boolean, pocket?: boolean}|null)} ctx.cost the route price from here
 * @param {(c: object) => ({hops: number, restarts: number}|null)} ctx.costVia the price of here → c → target
 * @param {string} [ctx.tieBreak='progression-first']
 * @returns {object} the candidate to walk to now
 */
export function grabOnTheWay(target, candidates, ctx = {}) {
    const { cost, costVia, tieBreak = TIE_BREAKS.progressionFirst } = ctx;
    if (!target || !Array.isArray(candidates) || typeof cost !== 'function' || typeof costVia !== 'function') return target;
    const base = cost(target);
    if (!base || !Number.isFinite(base.hops)) return target;
    const baseRestarts = routeRestarts(base);
    const onTheWay = candidates.filter((c) => {
        if (c === target || c?.goal === true) return false;
        const own = cost(c);
        if (!own || !(own.hops < base.hops)) return false;   // strictly before the target: a row beside it gains nothing
        const via = costVia(c);
        return !!via && Number.isFinite(via.hops) && via.hops <= base.hops && via.restarts <= baseRestarts;
    });
    if (onTheWay.length === 0) return target;
    const near = (c) => {
        const p = cost(c);
        return p && { hops: p.hops, restart: p.restart };
    };
    return rankCandidates(onTheWay, { cost: near, tieBreak })[0]?.candidate ?? target;
}

/** The default lookahead: the sequences priced are `depth` targets long, and each step past the first tries `beam`. */
export const DEFAULT_LOOKAHEAD = Object.freeze({ depth: 2, beam: 6 });

/**
 * ⛓ LOOKAHEAD (slice `bot-route-chooser-2b`) — a COST for `rankCandidates` / `chooseNext` that prices a candidate by
 * the cheapest SEQUENCE of `depth` targets starting with it, not by its own route alone. Greedy (depth 1) takes the
 * nearest row even when it strands the walk far from the rest; measured offline on bakingadventure seed
 * 01043188731678011336, greedy `reachable-cheapest` walks 27 region transitions where the listed order walks 23.
 *
 * A sequence's price is `{hops, restarts}` summed over its steps (Restarts still dominate under an infinite penalty:
 * `routeRestarts` reads the count), with `lead` = the first step's hops, so equal totals go to the nearer first step,
 * and `restart` / `pocket` = the first step's own flags. The chooser stays state-blind: the caller's `next(candidate,
 * state)` takes one step — the state after walking to the candidate and collecting its item — and answers the
 * candidates open there and their route price from there, or null when nothing is left (the sequence ends early, at
 * no further cost).
 *
 * BOUNDS (why it stays cheap): the steps past the first try only the `beam` cheapest-by-own-price candidates (default
 * 6), so a choice prices N + N·beam·… routes, not N^depth; depth 2 is the default (`depth: 3` is measured offline,
 * not shipped). The goal row is never a middle step while another row is open (it ends the game). A sequence whose
 * next state has open rows but no route to any is DEAD and priced null (dropped); `chooseLookahead` falls back to the
 * plain ranking when every candidate is dead. Caching per (region, inventory) is the caller's, inside `next`.
 *
 * @param {(c: object) => ({hops: number, restart: boolean, pocket?: boolean}|null)} cost the first step's price
 * @param {object} ctx
 * @param {(c: object, state: any) => ({state: any, candidates: Array<object>, cost: Function}|null)} ctx.next
 * @param {number} [ctx.depth=2]
 * @param {number} [ctx.beam=6]
 * @param {number} [ctx.restartPenalty]
 * @param {string} [ctx.tieBreak]
 * @returns {(c: object) => ({hops: number, restarts: number, lead: number, restart: boolean, pocket: boolean}|null)}
 */
export function lookaheadCost(cost, ctx = {}) {
    const { next, depth = DEFAULT_LOOKAHEAD.depth, beam = DEFAULT_LOOKAHEAD.beam,
        restartPenalty = DEFAULT_RESTART_PENALTY, tieBreak = TIE_BREAKS.progressionFirst } = ctx;
    const lexical = !Number.isFinite(restartPenalty);
    const better = (a, b) => {
        if (!b) return true;
        if (lexical && a.restarts !== b.restarts) return a.restarts < b.restarts;
        const sa = lexical ? a.hops : a.hops + a.restarts * restartPenalty;
        const sb = lexical ? b.hops : b.hops + b.restarts * restartPenalty;
        return sa < sb;
    };
    // the cheapest continuation of `left` more steps after taking `c` (reached in `state`); null = dead
    const tail = (c, state, left) => {
        if (left <= 0 || typeof next !== 'function') return { hops: 0, restarts: 0 };
        const step = next(c, state);
        const open = step?.candidates ?? [];
        if (open.length === 0) return { hops: 0, restarts: 0 };
        const pool = open.some((x) => x?.goal !== true) ? open.filter((x) => x?.goal !== true) : open;
        const ranked = rankCandidates(pool, { cost: step.cost, restartPenalty, tieBreak }).slice(0, Math.max(1, beam));
        let best = null;
        for (const r of ranked) {
            const rest = tail(r.candidate, step.state, left - 1);
            if (!rest) continue;
            const total = { hops: r.price.hops + rest.hops, restarts: routeRestarts(r.price) + rest.restarts };
            if (better(total, best)) best = total;
        }
        return best;
    };
    return (c) => {
        const first = cost(c);
        if (!first || !Number.isFinite(first.hops)) return null;
        const rest = tail(c, undefined, depth - 1);
        if (!rest) return null;
        return { hops: first.hops + rest.hops, restarts: routeRestarts(first) + rest.restarts, lead: first.hops,
            restart: !!first.restart, pocket: !!first.pocket };
    };
}

/**
 * The lookahead's ranking (`lookaheadCost` over `rankCandidates`), falling back to the plain ranking by `cost` when
 * every candidate's sequences are dead — the walk then fails or recovers exactly as greedy would.
 */
export function rankLookahead(candidates, cost, ctx = {}) {
    const ranked = rankCandidates(candidates, { ...ctx, cost: lookaheadCost(cost, ctx) });
    return ranked.length > 0 ? ranked : rankCandidates(candidates, { ...ctx, cost });
}
