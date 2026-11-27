/**
 * actionNodes/nodePerformPlan — **WHAT A CLICK (OR THE "PERFORM ALL REMAINING" BUTTON) WOULD DO** (slice AN-3b).
 *
 * ⚖ Robert 2026-11-17T21:35:22Z: "I want to add a separate button on the repeatable nodes to perform all remaining.
 * The default click action should be to perform once. I don't want to add a right click action."
 *
 * One pure function, `planPerform(model, input, nodeId, {times})`, used by both:
 *   - the click action `actionNodes.act` (`times: 1`), and
 *   - the card's "perform all remaining" button (`times: 'remaining'`).
 *
 * The plan is computed for the END of the Loops queue (`nodeStates.queueEndState`, the state the cards show while a
 * queue is planned); outside Loop mode the queue is empty, so that is the live state. It is:
 *   1. the node's state there (`nodeStates.nodeStateOf`): anything but `ready` is REFUSED BY NAME, with the unmet
 *      requirement (`blocked`), the members still to clear (`not-reached`), the count (`done`), or "not discovered"
 *      (`undiscovered`, which names nothing about the node). A queue that already stops early is refused too: more
 *      entries after its stop would never run.
 *   2. the route: the free hops from where the queue ends (or the player stands) to the node, over exits whose TARGET
 *      is reached at the queue's end (`actionLoopBot.hopsBetween`, AN-3a's R8: the multi-entry rule, so the start gate
 *      never refuses one). From the loop start (`Menu`, not a node) the first hop is `Menu → start`.
 *   3. the performances: `1`, or every one left (`limit − count`), CAPPED by what the end state allows — each
 *      performance must pass `whyNot` WITH mana (the pool after the ones before it, the XP-discounted price) and every
 *      requirement. The cap is reported (`capped: {by, text}`), never silent.
 *
 * ⛓ The wait (AN-TIME-2, E2). A performance that would start before its window opens waits first: the plan says how
 * long (`waits[k]` per performance, `wait` their sum — in practice only the first can wait) and the click queues a
 * `wait` entry before that `act` (outside Loop mode `actNow` pays it). The mana check counts the wait.
 *
 * ⛔ Mana. A node short ONLY of mana is `blocked` ("not enough mana") and is refused: a click never starts a
 * performance it cannot finish (⚖ Q1 lets the panel's own "Queue act" do that deliberately: it drains the pool into
 * region XP and ends the loop).
 *
 * Pure: no registry, no DOM, no I/O.
 */

import { formatClock, formatMana, perform, waitOf, whyNot } from './actionModel.js';
import { hopsBetween } from './actionLoopBot.js';
import { NODE_STATES, nodeStateOf, queueEndState } from './nodeStates.js';

/** The refusal codes `planPerform` adds to the node states' own. */
export const PERFORM_REFUSALS = Object.freeze({
    noWorld: 'no-world',
    unknownNode: 'unknown-node',
    start: 'start',
    undiscovered: 'undiscovered',
    notReached: 'not-reached',
    done: 'done',
    blocked: 'blocked',
    queueStops: 'queue-stops',
    noRoute: 'no-route',
});

/** "still to clear: A (0/1), B (1/2)" for the `after` set of node `i` closest to cleared, in `state`. */
export function unclearedAfterTextOf(model, state, i) {
    const t = model.nodes[i];
    if (!t?.after?.length) return 'it has no way in';
    const missing = t.after.map((set) => set.filter((m) => state.counts[m] < model.nodes[m].limit));
    const best = missing.reduce((a, b) => (b.length < a.length ? b : a));
    return `still to clear: ${best.map((m) => `${model.nodes[m].name} (${state.counts[m]}/${model.nodes[m].limit})`).join(', ')}`;
}

/**
 * Where a queue ends: the destination of its last `regionMove`, else `fallback` (the player's region).
 * @param {object[]} path - gameState path entries
 */
export function queueEndRegion(path, fallback = null) {
    for (let k = (path?.length ?? 0) - 1; k >= 0; k--) {
        if (path[k]?.type === 'regionMove') return path[k].destinationRegion;
    }
    return fallback;
}

/**
 * The plan of performing node `nodeId` once, or every remaining time.
 * @param {object} model - the runtime model (`actionModel`'s shape)
 * @param {object} input
 * @param {object} input.live            the live LoopState, its `mana` the pool's (Infinity: not modelled)
 * @param {object[]} [input.queue]       the Loops queue (`[]` outside Loop mode)
 * @param {number[]} [input.costs]       live prices by node index
 * @param {(id: string) => boolean} [input.isDiscovered]
 * @param {string|null} input.at         where the queue ends (Loop mode) or the player stands
 * @param {string[]} [input.startRegions] the loop start regions (`Menu`): a hop from one goes to the start node
 * @param {string} [input.unit]          the pool's unit for the texts ("h"; default none)
 * @param {string} nodeId
 * @param {{times?: 1 | 'remaining'}} [opts]
 * @returns {{ok: false, code: string, text: string, state?: string}
 *   | {ok: true, nodeId: string, name: string, hops: Array<{from: string, to: string, exit: string}>, acts: number,
 *      wanted: number, capped: null | {by: string, text: string}, text: string}}
 */
export function planPerform(model, input, nodeId, { times = 1 } = {}) {
    if (!model) return { ok: false, code: PERFORM_REFUSALS.noWorld, text: 'no ActionNodes world is loaded' };
    const i = model.nodeIx.get(nodeId);
    if (i === undefined) return { ok: false, code: PERFORM_REFUSALS.unknownNode, text: `'${nodeId}' is not a node of this world` };
    const node = model.nodes[i];
    const { live, queue = [], costs, isDiscovered = () => true, at = null, startRegions = [], unit = '' } = input ?? {};
    const amount = (n) => (unit ? `${formatMana(n)} ${unit}` : formatMana(n));
    const end = queueEndState(model, live, queue, { costs });
    if (end.stoppedAt) {
        const stop = model.nodes[model.nodeIx.get(end.stoppedAt.nodeId)]?.name ?? end.stoppedAt.nodeId;
        return {
            ok: false, code: PERFORM_REFUSALS.queueStops,
            text: `the queue already stops at ${stop} (${end.stoppedAt.text}): nothing after it would run`,
        };
    }
    const state = end.state;
    const st = nodeStateOf(model, state, i, { costs, isDiscovered });
    const refuse = (code, text) => ({ ok: false, code, text, state: st.state });
    if (st.state === NODE_STATES.UNDISCOVERED) return refuse(PERFORM_REFUSALS.undiscovered, 'this node is not discovered yet');
    if (i === model.startIndex) return refuse(PERFORM_REFUSALS.start, `${node.name} is the start: it has no action`);
    if (st.state === NODE_STATES.NOT_REACHED) {
        return refuse(PERFORM_REFUSALS.notReached, `${node.name} is not reached this loop: ${unclearedAfterTextOf(model, state, i)}`);
    }
    if (st.state === NODE_STATES.DONE) return refuse(PERFORM_REFUSALS.done, `${node.name} is done this loop (${st.count}/${st.limit})`);
    if (st.state === NODE_STATES.BLOCKED) return refuse(PERFORM_REFUSALS.blocked, `${node.name}: ${st.unmet?.text ?? 'blocked'}`);

    // The route, from where the queue ends.
    const startNode = model.nodes[model.startIndex].id;
    const hops = [];
    let from = at;
    if (from !== nodeId && !model.nodeIx.has(from)) {
        if (from === null || !startRegions.includes(from)) {
            return refuse(PERFORM_REFUSALS.noRoute, `no route to ${node.name}: the queue ends in ${from ?? 'no region'}, not on a node`);
        }
        hops.push({ from, to: startNode, exit: `${from} -> ${startNode}` });
        from = startNode;
    }
    const rest = hopsBetween(model, state, from, nodeId);
    if (!rest) return refuse(PERFORM_REFUSALS.noRoute, `no open route from ${from} to ${node.name}`);
    hops.push(...rest);

    // The performances, capped by what the end state allows.
    const wanted = times === 'remaining' ? Math.max(0, node.limit - st.count) : 1;
    let s = state;
    let acts = 0;
    let capped = null;
    const waits = [];
    while (acts < wanted) {
        const why = whyNot(model, s, i, { costs, ignoreMana: !Number.isFinite(s.mana) });
        if (why) {
            capped = { by: why.code, text: why.text };
            break;
        }
        waits.push(waitOf(model, s, i));
        s = perform(model, s, i, { costs });
        acts += 1;
    }
    const wait = waits.reduce((a, b) => a + b, 0);
    const route = hops.length ? `${hops.length} hop(s), then ` : '';
    const waitText = wait > 0 ? `waits ${amount(wait)} (opens ${formatClock(model, node.from)}), then ` : '';
    const text = capped
        ? `${route}${waitText}${node.name} ×${acts} of the ${wanted} left (stopped: ${capped.text})`
        : `${route}${waitText}${node.name} ×${acts}`;
    return { ok: true, nodeId, name: node.name, hops, acts, wanted, capped, text, waits, wait };
}
