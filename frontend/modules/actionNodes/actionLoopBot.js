/**
 * actionNodes/actionLoopBot — **THE LIVE BOT'S LOOP PLAN** (design §7; slice AN-3a). The registry entry's
 * `loopBot.planLoop(context)`: when every region of the loaded world is an ActionNodes node, the Playback Bot's loop
 * runner (`playbackBot/loopModeRunner.js`) asks this for the whole loop instead of its sphere-log target.
 *
 *   1. The model: the runtime's (`runtimeModelOf`), made planner-shaped (`plannerModelOf`: the block's settings, the
 *      check nodes, boons uncapped — the live inventory is what it is).
 *   2. The plan: `actionPlanner.planLoop` with the LIVE items, checks and region XP, from the loop's start state with
 *      the live pool (`maxMana`) — the goal as soon as reachable, else the most new checks, else the most region XP
 *      (⚖ A17). Its reasoning lines come back with it.
 *   3. The route: the Loops path. `Menu → start`, then for each performance the free hops from where the player is
 *      (a shortest path over exits whose TARGET is reached at that point of the plan — the multi-entry rule, so the
 *      start gate never refuses a hop; AN-1b's `hopsBetween` shape), then the `act` entry. An act that would start
 *      before its window opens is preceded by a `wait` entry of the exact length (AN-TIME-2: the start gate refuses an
 *      early act, so the bot never leaves a wait to the gate). An `attempt` (a node
 *      started without the mana to finish, ⚖ Q1) is the last act: it drains the pool as region XP and ends the loop.
 *
 * Pure apart from what `context` hands in: no registry, no DOM, no I/O.
 */

import { formatClock, formatMana, isReached, loopStartState, perform, waitOf } from './actionModel.js';
import { PLAN_KINDS, livePrices, planLoop } from './actionPlanner.js';
import { ACT_ACTION } from './actionGraphCompiler.js';
import { WAIT_ACTION } from '../shared/procgen/loopCustomActions.js';

/** The runtime model with what the planner reads: settings, the check nodes, uncapped boons. */
export function plannerModelOf(model) {
    if (!model) throw new Error('actionLoopBot: no model');
    return Object.freeze({
        ...model,
        graph: { ...model.graph, settings: model.block?.settings ?? model.graph?.settings ?? {} },
        checkIndices: model.nodes.flatMap((n, i) => (n.kind === 'check' ? [i] : [])),
        boons: model.boons.map((b) => ({ ...b, count: Number.POSITIVE_INFINITY })),
    });
}

/**
 * The hops from node `from` to node `to` over exits whose target is reached in `state`, shortest first; null when
 * none. (Every exit of a node reached this loop leads somewhere its gate opens: AN-3a's multi-entry rule.)
 * @returns {Array<{from: string, to: string, exit: string}>|null}
 */
export function hopsBetween(model, state, from, to) {
    if (from === to) return [];
    const prev = new Map([[from, null]]);
    const queue = [from];
    while (queue.length) {
        const at = queue.shift();
        const node = model.nodes[model.nodeIx.get(at)];
        for (const e of node?.exits ?? []) {
            const ti = model.nodeIx.get(e.target);
            if (ti === undefined || prev.has(e.target) || !isReached(model, state, ti)) continue;
            prev.set(e.target, { from: at, to: e.target, exit: e.name });
            if (e.target === to) {
                const hops = [];
                for (let h = prev.get(to); h; h = prev.get(h.from)) hops.unshift(h);
                return hops;
            }
            queue.push(e.target);
        }
    }
    return null;
}

/**
 * A plan (node ids, plus an optional attempt) as Loops queue entries (the gameState path shape `setPath` takes).
 * @param {object} model - planner-shaped
 * @param {object} start - the loop's start state
 * @param {string[]} plan
 * @param {string|null} attempt
 * @param {{startRegion: string, from?: string|null, costs?: number[], unit?: string}} opts - the loop's start region
 *   (the world's `Menu`); `from`: a node the player stands on mid-loop (AN-3b's continuation): the route starts there,
 *   with no `Menu → start` hop; `costs`: the live prices the plan was made with (the clock follows them); `unit`: the
 *   pool's unit for a wait's label
 * @returns {object[]}
 */
export function routeOfPlan(model, start, plan, attempt, { startRegion, from = null, costs, unit = '' }) {
    const startNode = model.nodes[model.startIndex].id;
    const instances = new Map();
    const path = [];
    const move = (from, to, exit) => {
        const n = (instances.get(to) ?? 0) + 1;
        instances.set(to, n);
        path.push({ type: 'regionMove', sourceRegion: from, destinationRegion: to, exitUsed: exit, instanceNumber: n });
    };
    const act = (id) => {
        const node = model.nodes[model.nodeIx.get(id)];
        path.push({
            type: 'customAction', actionName: ACT_ACTION,
            params: { nodeId: id, label: node.name, regionName: id },
            sourceRegion: id, instanceNumber: instances.get(id) ?? 1,
        });
    };
    const fromNode = from && model.nodeIx.has(from) ? from : null;
    if (!fromNode && startRegion && startRegion !== startNode) move(startRegion, startNode, `${startRegion} -> ${startNode}`);
    let at = fromNode ?? startNode;
    let state = start;
    const wait = (id, units) => {
        const node = model.nodes[model.nodeIx.get(id)];
        const amount = unit ? `${formatMana(units)} ${unit}` : formatMana(units);
        path.push({
            type: 'customAction', actionName: WAIT_ACTION,
            params: { nodeId: id, units, regionName: id, label: `Wait ${amount} (opens ${formatClock(model, node.from)})` },
            sourceRegion: id, instanceNumber: instances.get(id) ?? 1,
        });
    };
    const visit = (id) => {
        const hops = hopsBetween(model, state, at, id);
        if (!hops) throw new Error(`actionLoopBot: no open route from '${at}' to '${id}'`);
        for (const h of hops) move(h.from, h.to, h.exit);
        at = id;
        const w = waitOf(model, state, model.nodeIx.get(id));
        if (w > 0) wait(id, w);
        act(id);
    };
    for (const id of plan) {
        visit(id);
        state = perform(model, state, model.nodeIx.get(id), { costs });
    }
    if (attempt) visit(attempt);
    return path;
}

/**
 * Plan one live loop.
 * @param {object} context
 * @param {object} context.model           the runtime model (`runtime.model`)
 * @param {object} [context.inventory]     item name → count held
 * @param {string[]} [context.checkedLocations]
 * @param {(nodeId: string) => number} [context.regionXp]   raw region XP of a node
 * @param {number} [context.maxMana]       the loop's pool (default: the model's start mana with the items)
 * @param {string} context.startRegion
 * @param {{region: string, mana: number, state: object}} [context.continueFrom]  AN-3b: plan the REST of the running
 *   loop — from `state` (the runtime's live counts, stats and resources) with `mana` left, routed from `region` (the
 *   node the player stands on; no `Menu → start` hop). The Playback Bot's runner asks this when the state diverged
 *   from the loop's plan (an item arrived during it).
 * @returns {{kind: string, path: object[], reason: string, lines: string[], key: string, plan: string[],
 *   attempt: string|null, earns: string[]}}
 */
export function planLiveLoop({ model: runtimeModel, inventory = {}, checkedLocations = [], regionXp = () => 0,
    maxMana, startRegion, continueFrom = null, known = [], unit = '' }) {
    const model = plannerModelOf(runtimeModel);
    // AN-TIME-2: the knowledge the runtime has learned rides in the item vector after the boons (`itemVectorOf`).
    const knownSet = new Set(known);
    const items = {
        ...Object.fromEntries(model.boons.map((b) => [b.id, Math.max(0, inventory[b.name] ?? 0)])),
        ...Object.fromEntries((model.knowledge ?? []).map((f) => [f.id, knownSet.has(f.id) ? 1 : 0])),
    };
    const checkedSet = new Set(checkedLocations);
    const checked = model.nodes.filter((n) => n.location && checkedSet.has(n.location)).map((n) => n.id);
    const xp = Object.fromEntries(model.nodes.map((n) => [n.id, Number(regionXp(n.id)) || 0]));
    let start = loopStartState(model, items);
    if (Number.isFinite(maxMana)) start.mana = maxMana;
    if (continueFrom?.state) {
        const st = continueFrom.state;
        start = { counts: st.counts.slice(), stats: st.stats.slice(), resources: st.resources.slice(),
            mana: Number(continueFrom.mana) || 0, spent: 0, clock: st.clock ?? 0, known: (st.known ?? start.known ?? []).slice() };
    }
    const p = planLoop(model, { items, checked, xp, start });
    const kind = p.kind;
    if (kind === PLAN_KINDS.DONE) return { ...p, kind, path: [], reason: 'the goal is done', key: 'done', lines: p.lines };
    const path = routeOfPlan(model, start, p.plan, p.attempt, {
        startRegion, from: continueFrom?.region ?? null, costs: livePrices(model, xp), unit,
    });
    const reason = p.lines[0] ?? kind;
    return { ...p, kind, path, reason, key: `${kind}:${p.earns.join('+') || p.attempt || p.plan.join('>')}`, lines: p.lines, prices: livePrices(model, xp) };
}
