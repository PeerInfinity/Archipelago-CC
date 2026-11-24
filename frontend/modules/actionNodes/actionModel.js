/**
 * actionNodes/actionModel — **THE PURE MODEL OF ONE LOOP** over a validated graph (`actionGraph.js`).
 *
 * A loop starts from the base amounts plus every boost held (A4), and stats, resources and the node counts all reset
 * with it (A2). Movement is free (A10), so the whole state of a loop is **how many times each node has been
 * performed**: mana, stats and resources follow from those counts. A `LoopState` carries the counts and the three
 * derived values so that a step is O(parts), not O(nodes).
 *
 * The rules a step obeys, in the order a refusal names them (`whyNot`):
 *   1. the loop is still running: mana above 0 (at 0 the loop resets);
 *   2. the node is reached: it is the start, or every node of one of its `after` sets is CLEARED this loop
 *      (performed `limit` times — A16: exits open after the Nth performance);
 *   3. its limit is not used up this loop;
 *   4. every stat and resource minimum is met;
 *   5. no resource would go below 0;
 *   6. the mana left covers its time (⚖ user 2026-11-15 Q1: a node MAY be started with too little mana, but then it
 *      does not complete; the logic and the bot count an action as done only when it completes).
 *
 * The start node is cleared from the beginning and is never performed: its exits are open in every loop.
 *
 * `costs` (optional) replaces each node's `time` with a live price, so the bot can plan with region-XP discounts.
 * The logic never passes it: XP only lowers prices, so ignoring it is the safe direction (design §2).
 *
 * Pure: no registry, no DOM, no I/O.
 */

import { assertActionGraph, resolvedBoostOf } from './actionGraph.js';

/** Mana comparisons tolerate float dust from discounted prices. */
const EPSILON = 1e-9;

/**
 * Index a graph for search. Throws `ActionGraphError` when the graph is not valid.
 * @param {object} graph - an `action-graph` document
 */
export function buildActionModel(graph) {
    assertActionGraph(graph);
    const statIds = Object.keys(graph.stats);
    const resourceIds = Object.keys(graph.resources);
    const nodeIds = Object.keys(graph.nodes);
    const boonIds = Object.keys(graph.boons);
    const statIx = new Map(statIds.map((id, i) => [id, i]));
    const resIx = new Map(resourceIds.map((id, i) => [id, i]));
    const nodeIx = new Map(nodeIds.map((id, i) => [id, i]));
    const pairs = (amounts, ix) => Object.entries(amounts ?? {}).map(([id, n]) => [ix.get(id), n]);

    const nodes = nodeIds.map((id) => {
        const n = graph.nodes[id];
        return Object.freeze({
            id,
            name: n.name,
            kind: n.kind,
            time: n.time,
            limit: n.limit,
            reqStats: pairs(n.requires?.stats, statIx),
            reqRes: pairs(n.requires?.resources, resIx),
            addStats: pairs(n.results?.stats, statIx),
            addRes: pairs(n.results?.resources, resIx),
            addMana: n.results?.mana ?? 0,
            after: (n.after ?? []).map((set) => set.map((ref) => nodeIx.get(ref))),
        });
    });
    const boons = boonIds.map((id) => {
        const b = graph.boons[id];
        const boost = resolvedBoostOf(b);
        return Object.freeze({
            id,
            name: b.name,
            count: b.count,
            mana: boost.mana,
            stats: pairs(boost.stats, statIx),
            resources: pairs(boost.resources, resIx),
        });
    });
    const startIndex = nodeIx.get(graph.start);
    return Object.freeze({
        graph,
        statIds, resourceIds, nodeIds, boonIds,
        statIx, resIx, nodeIx,
        nodes, boons,
        startIndex,
        goalIndex: nodes.findIndex((n) => n.kind === 'goal'),
        checkIndices: nodes.flatMap((n, i) => (n.kind === 'check' ? [i] : [])),
        loopMana: graph.loop.mana,
    });
}

/**
 * Items held, as boon counts by boon id. Accepts an object `{boonId: n}` or an array indexed like `model.boons`.
 * @returns {number[]}
 */
export function itemVectorOf(model, items = {}) {
    if (Array.isArray(items)) return model.boons.map((_, i) => items[i] ?? 0);
    return model.boons.map((b) => Math.min(b.count, Math.max(0, items[b.id] ?? 0)));
}

/**
 * The state a loop starts in, with `items` held.
 * @param {object} model
 * @param {object|number[]} [items] - `{boonId: count}` or a boon-count vector
 * @returns {LoopState}
 */
export function loopStartState(model, items = {}) {
    const held = itemVectorOf(model, items);
    const stats = model.statIds.map(() => 0);
    const resources = model.resourceIds.map(() => 0);
    let mana = model.loopMana;
    model.boons.forEach((b, i) => {
        const k = held[i];
        if (!k) return;
        mana += b.mana * k;
        for (const [s, n] of b.stats) stats[s] += n * k;
        for (const [r, n] of b.resources) resources[r] += n * k;
    });
    const counts = model.nodes.map(() => 0);
    counts[model.startIndex] = model.nodes[model.startIndex].limit;
    return { counts, mana, stats, resources, spent: 0 };
}

/** Is node `i` cleared this loop (performed `limit` times)? The start always is. */
export function isCleared(model, state, i) {
    return state.counts[i] >= model.nodes[i].limit;
}

/** Is node `i` reached this loop? */
export function isReached(model, state, i) {
    if (i === model.startIndex) return true;
    return model.nodes[i].after.some((set) => set.every((m) => isCleared(model, state, m)));
}

/** The price of one performance of node `i`. */
export function priceOf(model, i, costs) {
    return costs?.[i] ?? model.nodes[i].time;
}

/**
 * Why node `i` cannot be performed from `state`, or null when it can.
 * @returns {null | {code: string, text: string, short?: number}}
 */
export function whyNot(model, state, i, { costs, ignoreMana = false } = {}) {
    const node = model.nodes[i];
    if (i === model.startIndex) return { code: 'start', text: 'the start is not an action' };
    if (!ignoreMana && state.mana <= EPSILON) return { code: 'loop-over', text: 'no mana left: the loop is over' };
    if (!isReached(model, state, i)) return { code: 'not-reached', text: 'not reached this loop' };
    if (state.counts[i] >= node.limit) return { code: 'limit', text: `done ${node.limit}/${node.limit} this loop` };
    for (const [s, n] of node.reqStats) {
        if (state.stats[s] < n) {
            return { code: 'stat', text: `needs ${model.graph.stats[model.statIds[s]].name} ${n} (has ${state.stats[s]})` };
        }
    }
    for (const [r, n] of node.reqRes) {
        if (state.resources[r] < n) {
            return { code: 'resource', text: `needs ${model.graph.resources[model.resourceIds[r]].name} ${n} (has ${state.resources[r]})` };
        }
    }
    for (const [r, n] of node.addRes) {
        if (state.resources[r] + n < 0) {
            return { code: 'resource', text: `would leave ${model.graph.resources[model.resourceIds[r]].name} below 0` };
        }
    }
    const price = priceOf(model, i, costs);
    if (!ignoreMana && state.mana + EPSILON < price) {
        return { code: 'mana', text: `short by ${formatMana(price - state.mana)} mana`, short: price - state.mana };
    }
    return null;
}

/** Perform node `i` once. The caller has checked `whyNot` is null. Returns a new state. */
export function perform(model, state, i, { costs } = {}) {
    const node = model.nodes[i];
    const price = priceOf(model, i, costs);
    const counts = state.counts.slice();
    counts[i] += 1;
    const stats = state.stats.slice();
    const resources = state.resources.slice();
    for (const [s, n] of node.addStats) stats[s] += n;
    for (const [r, n] of node.addRes) resources[r] += n;
    return { counts, mana: state.mana - price + node.addMana, stats, resources, spent: state.spent + price };
}

/**
 * A boost received DURING a loop (A4: "taking effect immediately"): boon `b` adds its stats, resources and mana to
 * the state once. The next loop's start state includes it anyway (`loopStartState`).
 */
export function applyBoost(model, state, b, copies = 1) {
    const boon = model.boons[b];
    const stats = state.stats.slice();
    const resources = state.resources.slice();
    for (const [s, n] of boon.stats) stats[s] += n * copies;
    for (const [r, n] of boon.resources) resources[r] += n * copies;
    return { ...state, stats, resources, counts: state.counts.slice(), mana: state.mana + boon.mana * copies };
}

/** The visited-set key of a state: its counts (everything else follows from them and the items). */
export function stateKey(state) {
    return state.counts.join(',');
}

/** Mana for a reasoning line: whole numbers stay whole, discounted prices keep one decimal. */
export function formatMana(m) {
    const r = Math.round(m * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** A plan (node indices) as "Do Chores ×2 → Bribe the Guard → …". */
export function describePlan(model, plan) {
    const parts = [];
    for (const i of plan) {
        const name = model.nodes[i].name;
        const last = parts[parts.length - 1];
        if (last && last.name === name) last.n += 1;
        else parts.push({ name, n: 1 });
    }
    return parts.length ? parts.map((p) => (p.n > 1 ? `${p.name} ×${p.n}` : p.name)).join(' → ') : '(nothing)';
}

/**
 * @typedef {object} LoopState
 * @property {number[]} counts     performances this loop, by node index (the start counts as cleared)
 * @property {number} mana         mana left
 * @property {number[]} stats      by stat index
 * @property {number[]} resources  by resource index
 * @property {number} spent        mana spent this loop (the region XP it earns, before any scale)
 */
