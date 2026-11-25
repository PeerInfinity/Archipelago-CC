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
 *   5a. every knowledge flag it requires is known (held from an earlier loop, or learned earlier this loop);
 *   5b. its time window (AN-TIME-1): the clock — time SPENT this loop, waits included — is at most `until`, after
 *       any wait: a node started before `from` first waits until `from`, and the wait is paid from the pool;
 *   6. the mana left covers its time (plus any wait) (⚖ user 2026-11-15 Q1: a node MAY be started with too little mana, but then it
 *      does not complete; the logic and the bot count an action as done only when it completes).
 *
 * The start node is cleared from the beginning and is never performed: its exits are open in every loop.
 *
 * `costs` (optional) replaces each node's `time` with a live price, so the bot can plan with region-XP discounts.
 * The logic never passes it: XP only lowers prices, so ignoring it is the safe direction (design §2).
 *
 * ⛓ THE CLOCK. `state.clock` is the time spent this loop: every price paid plus every wait. Items never touch it, so
 * a window means the same hour in every loop whatever is held (design §1, ⚖ Q1). Region XP lowers a price, so a
 * discounted performance also advances the clock less: an early arrival then just waits longer (measured sound,
 * design §2 row 5). The logic prices at the full `time`.
 *
 * ⛓ KNOWLEDGE. `state.known` is a 0/1 per flag (`model.knowledge`): the flags held at the loop's start (from earlier
 * loops — they ride in the item vector after the boons, see `itemVectorOf`) plus every flag a node performed this
 * loop teaches. A model built by the runtime may carry no `knowledge`, `from`, `until`, `reqKnow` or `learns`: every
 * read below defaults them (no flags, an always-open window), so an older model behaves exactly as before.
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
    const knowledgeIds = Object.keys(graph.knowledge ?? {});
    const knowIx = new Map(knowledgeIds.map((id, i) => [id, i]));
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
            from: n.window?.from ?? -Infinity,
            until: n.window?.until ?? Infinity,
            reqKnow: (n.requires?.knowledge ?? []).map((k) => knowIx.get(k)),
            learns: (n.results?.learns ?? []).map((k) => knowIx.get(k)),
        });
    });
    const knowledge = knowledgeIds.map((id) => Object.freeze({
        id,
        name: graph.knowledge[id].name,
        learners: nodes.flatMap((node, i) => (node.learns.includes(knowIx.get(id)) ? [i] : [])),
    }));
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
        knowledgeIds, knowIx, knowledge,
        windowed: nodes.some((n) => n.from > -Infinity || n.until < Infinity),
        clock: graph.clock ? { ...graph.clock } : null,
        pool: graph.pool ? { ...graph.pool } : null,
        startIndex,
        goalIndex: nodes.findIndex((n) => n.kind === 'goal'),
        checkIndices: nodes.flatMap((n, i) => (n.kind === 'check' ? [i] : [])),
        loopMana: graph.loop.mana,
    });
}

/** The knowledge flags of a model (none for a model that has no `knowledge`). */
const flagsOf = (model) => model.knowledge ?? [];

/**
 * What is held, as ONE vector: the boon counts (by `model.boons` order), then a 0/1 per knowledge flag (by
 * `model.knowledge` order). The logic's item combinations have this shape, so a flag known from an earlier loop is
 * one more dimension of the lattice. Accepts an object `{boonId: n, knowledgeId: 1}` or an array in that order; with
 * no knowledge the vector is exactly the boon counts it always was.
 * @returns {number[]}
 */
export function itemVectorOf(model, items = {}) {
    const flags = flagsOf(model);
    if (Array.isArray(items)) return [...model.boons.map((_, i) => items[i] ?? 0), ...flags.map((_, k) => (items[model.boons.length + k] ? 1 : 0))];
    return [
        ...model.boons.map((b) => Math.min(b.count, Math.max(0, items[b.id] ?? 0))),
        ...flags.map((f) => (items[f.id] ? 1 : 0)),
    ];
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
    const known = held.slice(model.boons.length);
    return { counts, mana, stats, resources, spent: 0, clock: 0, known };
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

/** How long node `i` would wait from `state` before it may start (0 inside or past its window). */
export function waitOf(model, state, i) {
    const from = model.nodes[i].from ?? -Infinity;
    return Math.max(0, from - (state.clock ?? 0));
}

/** The pool's name when a world names none (design §4). */
export const DEFAULT_POOL_NAME = 'Mana';

/** The pool's display name: the world's `pool.name` (AN-TIME-2), else "Mana". */
export function poolNameOf(model) {
    return model?.pool?.name || DEFAULT_POOL_NAME;
}

/** The pool's name inside a sentence ("mana", "time"). */
export function poolWordOf(model) {
    return poolNameOf(model).toLowerCase();
}

/**
 * An amount of the pool in a sentence: "2 h" when the world names a unit, else "2 mana" / "2 time" (the name). With
 * no `pool` this is exactly the old "<n> mana".
 */
export function poolAmountOf(model, n) {
    const unit = model?.pool?.unit;
    return unit ? `${formatMana(n)} ${unit}` : `${formatMana(n)} ${poolWordOf(model)}`;
}

/** A length of time with the pool's unit when it has one ("2 h"), else the bare number ("2"). */
export function unitAmountOf(model, n) {
    const unit = model?.pool?.unit;
    return unit ? `${formatMana(n)} ${unit}` : formatMana(n);
}

/** Is flag `k` known in `state`? */
const knows = (state, k) => (state.known?.[k] ?? 0) > 0;

/**
 * A time on the graph's clock: `HH:MM` when the graph declares `clock`, else `t=<units>`. Pure display.
 * @param {object} model
 * @param {number} units  time spent this loop
 */
export function formatClock(model, units) {
    const c = model.clock;
    if (!c) return `t=${formatMana(units)}`;
    const [h, m] = c.start.split(':').map(Number);
    const total = Math.round(h * 60 + m + units * c.minutesPerUnit);
    const day = ((total % 1440) + 1440) % 1440;
    return `${String(Math.floor(day / 60)).padStart(2, '0')}:${String(day % 60).padStart(2, '0')}`;
}

/**
 * Why node `i` cannot be performed from `state`, or null when it can.
 * @returns {null | {code: string, text: string, short?: number}}
 */
export function whyNot(model, state, i, { costs, ignoreMana = false } = {}) {
    const node = model.nodes[i];
    if (i === model.startIndex) return { code: 'start', text: 'the start is not an action' };
    if (!ignoreMana && state.mana <= EPSILON) return { code: 'loop-over', text: `no ${poolWordOf(model)} left: the loop is over` };
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
    for (const k of node.reqKnow ?? []) {
        if (!knows(state, k)) return { code: 'knowledge', text: `needs to know ${model.knowledge[k].name}` };
    }
    const wait = waitOf(model, state, i);
    const until = node.until ?? Infinity;
    if ((state.clock ?? 0) + wait > until + EPSILON) {
        return { code: 'too-late', text: `too late: after ${formatClock(model, until)} (it is ${formatClock(model, state.clock ?? 0)})` };
    }
    const price = priceOf(model, i, costs) + wait;
    if (!ignoreMana && state.mana + EPSILON < price) {
        const waits = wait > 0 ? ` (waits ${unitAmountOf(model, wait)}, opens ${formatClock(model, node.from)})` : '';
        return { code: 'mana', text: `short by ${poolAmountOf(model, price - state.mana)}${waits}`, short: price - state.mana };
    }
    return null;
}

/**
 * The wait a node that CAN be performed would take first, as a line ("waits 2 (opens 12:00)"), or null. Not a
 * refusal: an early node is performable; it waits (⚖ Q2).
 */
export function waitNote(model, state, i) {
    const wait = waitOf(model, state, i);
    return wait > 0 ? `waits ${unitAmountOf(model, wait)} (opens ${formatClock(model, model.nodes[i].from)})` : null;
}

/** Perform node `i` once. The caller has checked `whyNot` is null. Returns a new state. */
export function perform(model, state, i, { costs } = {}) {
    const node = model.nodes[i];
    const price = priceOf(model, i, costs);
    const wait = waitOf(model, state, i);
    const counts = state.counts.slice();
    counts[i] += 1;
    const stats = state.stats.slice();
    const resources = state.resources.slice();
    for (const [s, n] of node.addStats) stats[s] += n;
    for (const [r, n] of node.addRes) resources[r] += n;
    const known = (state.known ?? []).slice();
    for (const k of node.learns ?? []) known[k] = 1;
    return {
        counts, mana: state.mana - price - wait + node.addMana, stats, resources, spent: state.spent + price,
        clock: (state.clock ?? 0) + wait + price, known,
    };
}

/**
 * A wait of `units` (AN-TIME-2: a Loops `wait` entry): the clock moves on and the pool pays it. Nothing else changes.
 * No region-XP discount: an hour waited is an hour.
 */
export function applyWait(model, state, units) {
    const u = Math.max(0, Number(units) || 0);
    return {
        ...state, counts: state.counts.slice(), mana: state.mana - u, clock: (state.clock ?? 0) + u,
        known: (state.known ?? []).slice(),
    };
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
    return {
        ...state, stats, resources, counts: state.counts.slice(), mana: state.mana + boon.mana * copies,
        known: (state.known ?? []).slice(),
    };
}

/**
 * A knowledge flag learned DURING a loop from outside the graph (a caller's own source). Within the graph a flag is
 * learned by performing a node (`perform`); this is the same change for any other channel.
 */
export function applyKnowledge(model, state, k) {
    const known = (state.known ?? flagsOf(model).map(() => 0)).slice();
    known[k] = 1;
    return { ...state, counts: state.counts.slice(), known };
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
 * @property {number} clock        time spent this loop: every price paid plus every wait (`spent` + the waits)
 * @property {number[]} known      0/1 per knowledge flag: held at the loop's start or learned during it
 */
