/**
 * seedlingDemo/spaceTimeReach — ⛓⛓⛓ SEEDLING HAMMER-PHASE A (D2): A FORWARD REACHABLE-SET SEARCH OVER
 * (EXACT PLAYER STATE, ABSOLUTE TICK).
 *
 * ⚖ The user (2026-10-07): *"fighting an enemy with a swinging hammer means that the target position we want to
 * reach to attack from changes over time, and so there are multiple (position, time) targets to choose from, and so
 * it would be helpful for the movement planning to take that into account."* The press kill's movement was
 * TIME-BLIND: `deriveStrike` checks one straight walk per cell, the fight is driven greedily (`stepToward`, four ticks
 * deep) and repaired (`hammerPhaseRung`, `safeStep`). This module is the search those three approximate, and design B
 * (the whole fight as one space-time search) is built on it; slice A uses it for one question — the ESCAPE after a
 * landing.
 *
 * ── WHAT IT IS ─────────────────────────────────────────────────────────
 *
 * A node is a REAL simulated player state at a forecast index: the successors of `(state, i)` are
 * `step(state, keys)` at `i + 1` for each key set, in a FIXED order, kept iff `safe(next, i + 1)`. So every kept
 * state is one the controller really reaches — store the parent and the keys, and any path it returns is tick-exact
 * by construction. What makes it tractable is the DEDUP: two states at the same index with the same COARSE key
 * (default: the 8 px cell × the sign of each velocity axis) are one node, the first one reached wins, and the rest
 * are dropped. ⚠ Dedup only LOSES ALTERNATIVES — it can turn a solvable search into a negative, never a wrong
 * certificate into a right-looking one. The key is a parameter so a caller can buy completeness with cells.
 *
 * ⛔ THE INDEX CONVENTION IS THE CALLER'S, AND IT IS ONE CONVENTION: `safe(state, i)` is asked of the state the
 * search holds at index i. The press kill passes the run's own (`levelRun.spinnerForecast`'s row i is the bodies
 * the advance at `ticksCompleted + i` bills against the player's box at the TOP of that tick, `solverBot
 * .clearOfHammersAt`), so index i's state is the player at the top of tick `ticksCompleted + i`.
 *
 * ── TWO MODES ──────────────────────────────────────────────────────────
 *
 *  - `survive`: the first path of `horizon` safe steps, or the first state `goal` accepts. DEPTH FIRST, the keys
 *    tried in the given order at every depth (so `[stand, …]` first is "hold unless forced") — and when that is
 *    exhausted, BREADTH FIRST over the same index range before a negative is returned. ⛔ The second pass is not
 *    a nicety: depth first claims coarse keys along its first deep path, and a claim made by a doomed state blocks
 *    every later state with the same key at that index. Measured on L18 (the kill landing at t147 of the committed
 *    walk, 8 px key, horizon 45): stand-first depth first was EXHAUSTED after 187 expansions while the breadth-first
 *    set reached the horizon, and the exact key found a path in 207. A negative is returned only when both passes
 *    are exhausted, and its words say both ran.
 *  - `earliest` (breadth first, one layer per tick): the first index at which some state satisfies `goal`, and of
 *    the states that do at that index the first in layer order. B's question ("which (position, tick) target is
 *    reachable first") is this mode.
 *
 * ── BUDGET ─────────────────────────────────────────────────────────────
 *
 * Counted in WORK UNITS — node expansions — never in time. `shouldStop()` (a callback the caller owns; `null` by
 * default, which is the exact search) is asked every `checkEvery` expansions, as `mover.findEarliestArrival` asks
 * its own; a trip ends the search with a NEGATIVE whose bound is `deadline`. `maxExpansions` is the same kind of
 * bound with a number. ⛔ Nothing here reads a clock, and the answer depends on nothing but the inputs.
 */

const freeze = (keys) => Object.freeze(new Set(keys));

/**
 * ⛓ THE CONTROLLER'S KEY SETS — the four facings, the stand and the four diagonals: everything `applyInput` can do
 * with the movement keys (each axis read on its own), in `solverBot.stepToward`'s tie-break order. Frozen; a caller
 * hands its own list to change the order.
 */
export const SPACE_TIME_KEY_SETS = Object.freeze([
    freeze(['right']), freeze(['up']), freeze(['left']), freeze(['down']),
    freeze([]),
    freeze(['right', 'up']), freeze(['left', 'up']), freeze(['left', 'down']), freeze(['right', 'down']),
]);

/** The same nine with the stand FIRST: "hold unless forced", the escape's order. */
export const HOLD_FIRST_KEY_SETS = Object.freeze([SPACE_TIME_KEY_SETS[4],
    ...SPACE_TIME_KEY_SETS.filter((_, i) => i !== 4)]);

/** Expansions between two asks of `shouldStop` — `mover.DEFAULT_CHECK_EVERY`'s value, for the same reason. */
export const SPACE_TIME_CHECK_EVERY = 250;

/**
 * The default coarse key: the `cell` px cell of the player's point and the sign of each velocity axis.
 *
 * @param {number} cell  px
 * @returns {(state: object) => string}
 */
export function coarseKey(cell = 8) {
    if (!(cell > 0)) throw new Error(`spaceTimeReach.coarseKey: cell ${cell} is not a positive size`);
    return (s) => `${Math.floor(s.x / cell)},${Math.floor(s.y / cell)},${Math.sign(s.vx ?? 0)},`
        + `${Math.sign(s.vy ?? 0)}`;
}

/**
 * ── THE SEARCH ─────────────────────────────────────────────────────────
 *
 * @param {object} o
 * @param {object} o.start  the player state at `startIndex` (stepped by copy; never mutated)
 * @param {number} [o.startIndex]  its forecast index (default 0)
 * @param {Function} o.step  `(state, keys) => nextState` — the run's `previewStepper()`
 * @param {Function} o.safe  `(state, index) => boolean` — the prune
 * @param {number} o.horizon  ticks searched past `startIndex`
 * @param {?Function} [o.goal]  `(state, index) => boolean`
 * @param {'survive'|'earliest'} [o.mode]
 * @param {ReadonlyArray<Set>} [o.keySets]
 * @param {Function} [o.keyOf]  the dedup key, `coarseKey(8)` by default
 * @param {?Function} [o.rank]  `(state, index) => number` — in a breadth-first layer, of two states with one key the
 *   HIGHER rank is kept (ties: the first reached). `null`: the first reached, always.
 * @param {number} [o.maxExpansions]
 * @param {?Function} [o.shouldStop]  `() => boolean`
 * @param {number} [o.checkEvery]
 * @returns {{ok: true, keys: Set[], states: object[], endIndex: number, reached: string, expansions: number,
 *   nodes: number} | {ok: false, bound: string, why: string, expansions: number, nodes: number,
 *   deepest: number}}  `keys[k]` is held at index `startIndex + k`; `states[k]` is the state at that index
 *   (`states[0]` = `start`). `reached` is `horizon` or `goal`.
 */
export function spaceTimeReach({
    start, startIndex = 0, step, safe, horizon, goal = null, mode = 'survive',
    keySets = SPACE_TIME_KEY_SETS, keyOf = coarseKey(8), rank = null, maxExpansions = Infinity,
    shouldStop = null, checkEvery = SPACE_TIME_CHECK_EVERY,
}) {
    if (typeof step !== 'function' || typeof safe !== 'function') {
        throw new Error('spaceTimeReach: `step` and `safe` are required functions');
    }
    if (!Number.isInteger(horizon) || horizon < 0) {
        throw new Error(`spaceTimeReach: horizon ${horizon} is not a whole number of ticks`);
    }
    if (mode !== 'survive' && mode !== 'earliest') {
        throw new Error(`spaceTimeReach: mode "${mode}" is neither 'survive' nor 'earliest'`);
    }
    if (mode === 'earliest' && typeof goal !== 'function') {
        throw new Error('spaceTimeReach: the earliest mode answers "when is the goal first reached" — it needs a goal');
    }
    if (shouldStop !== null && typeof shouldStop !== 'function') {
        throw new Error('spaceTimeReach: shouldStop must be a function () => boolean or null');
    }
    const last = startIndex + horizon;
    let expansions = 0;
    let nodes = 1;
    let deepest = startIndex;
    const negative = (bound, why) => ({ ok: false, bound, why, expansions, nodes, deepest });
    const budget = () => {
        if (expansions >= maxExpansions) {
            return negative('expansions', `the search spent its ${maxExpansions} expansion(s) (maxExpansions)`);
        }
        if (shouldStop !== null && expansions > 0 && expansions % checkEvery === 0 && shouldStop()) {
            return negative('deadline', `the caller's deadline (\`shouldStop\`) was reached after ${expansions} `
                + `expansion(s), asked every ${checkEvery}`);
        }
        return null;
    };
    /** Walk a node's parent chain back to the start: the certificate. */
    const certificate = (node, reached) => {
        const keys = [];
        const states = [];
        for (let n = node; n !== null; n = n.parent) {
            states.push(n.state);
            if (n.keys !== null) keys.push(n.keys);
        }
        keys.reverse();
        states.reverse();
        return { ok: true, keys, states, endIndex: node.index, reached, expansions, nodes };
    };
    if (!safe(start, startIndex)) {
        return negative('start', `the start state at index ${startIndex} is not safe`);
    }
    const root = { state: start, index: startIndex, keys: null, parent: null };
    if (goal && goal(start, startIndex)) return certificate(root, 'goal');
    if (horizon === 0) return certificate(root, 'horizon');
    /** `seen[i]` — the coarse keys already holding a node at index i. */
    const seen = new Map();
    const claim = (index, state) => {
        let at = seen.get(index);
        if (!at) { at = new Set(); seen.set(index, at); }
        const k = keyOf(state);
        if (at.has(k)) return false;
        at.add(k);
        return true;
    };
    claim(startIndex, start);
    const children = (node) => {
        const out = [];
        for (const keys of keySets) {
            const next = step({ ...node.state }, keys);
            const i = node.index + 1;
            if (!safe(next, i)) continue;
            if (!claim(i, next)) continue;
            nodes += 1;
            out.push({ state: next, index: i, keys, parent: node });
        }
        return out;
    };
    let searched = 'breadth first';
    if (mode === 'survive') {
        // ⛓ An explicit stack, children pushed in REVERSE so the first key set is popped first.
        const stack = [root];
        while (stack.length > 0) {
            const stop = budget();
            if (stop) return stop;
            const node = stack.pop();
            expansions += 1;
            const kids = children(node);
            for (const kid of kids) {
                if (kid.index > deepest) deepest = kid.index;
                if (goal && goal(kid.state, kid.index)) return certificate(kid, 'goal');
                if (kid.index >= last) return certificate(kid, 'horizon');
            }
            for (let j = kids.length - 1; j >= 0; j -= 1) stack.push(kids[j]);
        }
        // ⛓ the breadth-first pass over the same range (see the mode's paragraph); its claims are per layer
        searched = `depth first (deepest ${deepest}) and then breadth first`;
    }
    /**
     * ⛓ THE LAYER KEEPS THE BEST OF EACH KEY, NOT THE FIRST: a claim is the layer's own (`seen` is not consulted),
     * and a later state with the same key REPLACES the claimant when `rank` scores it higher. The replaced state
     * was never expanded (a layer is built before it is expanded), so nothing it found is lost but itself.
     */
    const layerOf = (parents) => {
        const best = new Map();
        for (const node of parents) {
            const stop = budget();
            if (stop) return stop;
            expansions += 1;
            for (const keys of keySets) {
                const next = step({ ...node.state }, keys);
                const i = node.index + 1;
                if (!safe(next, i)) continue;
                const kid = { state: next, index: i, keys, parent: node };
                const k = keyOf(next);
                const was = best.get(k);
                if (was === undefined) {
                    nodes += 1;
                    best.set(k, rank === null ? kid : { ...kid, score: rank(next, i) });
                } else if (rank !== null) {
                    const score = rank(next, i);
                    if (score > was.score) best.set(k, { ...kid, score });
                }
            }
        }
        return [...best.values()];
    };
    let layer = [root];
    for (let i = startIndex; i < last; i += 1) {
        const next = layerOf(layer);
        if (!Array.isArray(next)) return next;
        if (next.length === 0) {
            return negative('exhausted', `${searched}: no state reachable from index ${startIndex} survives to index `
                + `${i + 1} (the dedup on the coarse key may have dropped an alternative)`);
        }
        if (i + 1 > deepest) deepest = i + 1;
        const hit = goal ? next.find((n) => goal(n.state, n.index)) : undefined;
        if (hit) return certificate(hit, 'goal');
        layer = next;
    }
    if (mode === 'survive') {
        // the end state is the best-ranked of the last layer (ties: the first reached)
        let end = layer[0];
        if (rank !== null) for (const nd of layer) if (nd.score > end.score) end = nd;
        return certificate(end, 'horizon');
    }
    return negative('horizon', `no state satisfies the goal by index ${last}`);
}
