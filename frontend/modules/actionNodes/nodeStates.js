/**
 * actionNodes/nodeStates — **THE VISUAL STATE OF EVERY NODE** (design §4 "The visual states"; slice AN-3a).
 *
 * One pure function over the node data (a model in `actionModel`'s shape: the runtime's `runtimeModelOf`, or
 * `buildActionModel`) and one loop state. Each node is exactly one of:
 *
 * | state          | meaning                                                                                       |
 * |----------------|-----------------------------------------------------------------------------------------------|
 * | `undiscovered` | the discovery module has not discovered its region: the card shows the discovery placeholder |
 * | `not-reached`  | no `after` set is cleared this loop                                                           |
 * | `done`         | its limit is used up this loop (the start, cleared from the beginning, is always `done`)      |
 * | `blocked`      | reached, performances left, a requirement unmet — `unmet` names it. Short ONLY of mana:       |
 * |                | `blocked` with "not enough mana" (it can still be queued, ⚖ Q1)                               |
 * | `ready`        | reached, performances left, every requirement met, the mana covers it                         |
 *
 * Precedence is the table's order: discovery first (an undiscovered node reveals nothing, not even "not reached"),
 * then reach, then the limit, then requirements, then mana.
 *
 * ⛓ WHICH STATE (design §4): while a queue is being PLANNED the states are computed for the END of the queue
 * (`queueEndState`), so each click shows what the next click can do; while it RUNS they follow the live state.
 * `viewStateOf` makes that choice.
 *
 * Pure: no registry, no DOM, no I/O.
 */

import { applyWait, formatClock, isReached, perform, poolWordOf, priceOf, waitOf, whyNot } from './actionModel.js';

/** Every state, in precedence order. */
export const NODE_STATES = Object.freeze({
    UNDISCOVERED: 'undiscovered',
    NOT_REACHED: 'not-reached',
    DONE: 'done',
    BLOCKED: 'blocked',
    READY: 'ready',
});

/** The `unmet.code` of a node short only of mana, and its text (design §4: "not enough mana"). */
export const NOT_ENOUGH_MANA = Object.freeze({ code: 'mana', text: 'not enough mana' });

/** The same, in the world's pool name (AN-TIME-2: "not enough time"); exactly `NOT_ENOUGH_MANA` with no `pool`. */
export function notEnoughOf(model) {
    return { code: NOT_ENOUGH_MANA.code, text: `not enough ${poolWordOf(model)}` };
}

const EPSILON = 1e-9;

/**
 * The state of node `i`.
 * @param {object} model - actionModel's shape
 * @param {object} state - a LoopState: `{counts, stats, resources, mana}` (mana may be Infinity: not modelled)
 * @param {number} i
 * @param {object} [opts]
 * @param {number[]} [opts.costs]               live prices by node index (default: each node's `time`)
 * @param {(nodeId: string) => boolean} [opts.isDiscovered]   default: every node is
 * @returns {{state: string, unmet: null | {code: string, text: string}, count: number, limit: number, price: number,
 *   wait?: number}} `wait` (AN-TIME-2, a windowed world only): how long a performance from `state` would wait first
 */
export function nodeStateOf(model, state, i, { costs, isDiscovered = () => true } = {}) {
    const node = model.nodes[i];
    const base = { count: state.counts[i] ?? 0, limit: node.limit, price: priceOf(model, i, costs) };
    if (model.windowed) base.wait = waitOf(model, state, i);
    const out = (s, unmet = null) => ({ ...base, state: s, unmet });
    if (!isDiscovered(node.id)) return out(NODE_STATES.UNDISCOVERED);
    if (i === model.startIndex) return out(NODE_STATES.DONE);
    if (!isReached(model, state, i)) return out(NODE_STATES.NOT_REACHED);
    if (base.count >= node.limit) return out(NODE_STATES.DONE);
    const why = whyNot(model, state, i, { costs, ignoreMana: true });
    if (why) return out(NODE_STATES.BLOCKED, { code: why.code, text: why.text });
    if (state.mana <= EPSILON || state.mana + EPSILON < base.price + (base.wait ?? 0)) return out(NODE_STATES.BLOCKED, notEnoughOf(model));
    return out(NODE_STATES.READY);
}

/**
 * The state of every node, keyed by node id.
 * @returns {Object<string, ReturnType<typeof nodeStateOf>>}
 */
export function nodeStates(model, state, opts = {}) {
    return Object.fromEntries(model.nodes.map((n, i) => [n.id, nodeStateOf(model, state, i, opts)]));
}

/**
 * The loop state at the END of a queue: every not-yet-completed `act` entry applied, in order, from `start`. A move
 * changes nothing (free, A10). A `wait` entry (AN-TIME-2) moves the clock and pays the pool; an `act` that would
 * still start before its window opens stops the walk as the start gate does (`too-early`). The walk stops where the queue would stop: at an act the start gate refuses (not
 * reached, limit, a requirement) — Loops stops the queue there — or at one the mana cannot finish (⚖ Q1: started
 * short, it does not complete and the loop ends).
 *
 * @param {object} model
 * @param {object} start - the live LoopState (its `mana` the pool's)
 * @param {Array<object>} entries - Loops queue entries (`{type, actionName, sourceRegion, params, completed}`)
 * @param {object} [opts]
 * @param {number[]} [opts.costs]
 * @param {string} [opts.actName='act']
 * @returns {{state: object, applied: number, stoppedAt: null | {nodeId: string, code: string, text: string}}}
 */
export function queueEndState(model, start, entries, { costs, actName = 'act', waitName = 'wait' } = {}) {
    let state = start;
    let applied = 0;
    for (const e of entries ?? []) {
        if (e?.completed || e?.type !== 'customAction') continue;
        if (e.actionName === waitName) {
            state = applyWait(model, state, e.params?.units);
            continue;
        }
        if (e.actionName !== actName) continue;
        const nodeId = e.params?.nodeId ?? e.sourceRegion;
        const i = model.nodeIx.get(nodeId);
        if (i === undefined) continue;
        const why = whyNot(model, state, i, { costs, ignoreMana: !Number.isFinite(state.mana) });
        if (why) return { state, applied, stoppedAt: { nodeId, code: why.code, text: why.text } };
        if (waitOf(model, state, i) > 0) {
            const text = `opens at ${formatClock(model, model.nodes[i].from)}: queue a wait first`;
            return { state, applied, stoppedAt: { nodeId, code: 'too-early', text } };
        }
        state = perform(model, state, i, { costs });
        applied += 1;
    }
    return { state, applied, stoppedAt: null };
}

/**
 * The state the card shows (design §4): the live state while the queue runs, else the end of the queue.
 * @param {object} model
 * @param {object} live - the live LoopState
 * @param {object} [opts]
 * @param {boolean} [opts.running]   the Loops queue is being processed (not paused, not idle)
 * @param {Array<object>} [opts.queue]
 * @param {number[]} [opts.costs]
 * @returns {{state: object, basis: 'live' | 'queue-end', stoppedAt: object|null}}
 */
export function viewStateOf(model, live, { running = false, queue = [], costs } = {}) {
    if (running) return { state: live, basis: 'live', stoppedAt: null };
    const end = queueEndState(model, live, queue, { costs });
    return { state: end.state, basis: end.applied ? 'queue-end' : 'live', stoppedAt: end.stoppedAt };
}
