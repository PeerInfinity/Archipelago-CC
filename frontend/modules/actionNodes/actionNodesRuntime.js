/**
 * actionNodes/actionNodesRuntime — **THE RUNTIME OF A LOADED ACTIONNODES WORLD** (design §2, §3, §5; slice AN-2).
 *
 * What it owns, per loop: how many times each node has been performed (`counts`), and through the host ledger
 * (`resourceChannels/resourceLedger.js`) the stats and resources. What persists across loops: the checks it has sent
 * and the nodes whose exits it has published as discovered (A2), both cleared only by a world load.
 *
 *   - **The start gate** (`gate(action)`, the registry entry's `loopSupport.actionGate`): an `act` entry may start
 *     when its node is reached this loop, its limit is not used up and every requirement is met. A `regionMove`
 *     (⚖ Robert 2026-11-16T17:41:55Z: "once a node becomes reachable in a loop, it stays reachable for the rest of the
 *     loop, and moving between nodes is free. Reachability resets when the loop resets"): ⛓ THE MULTI-ENTRY RULE
 *     (planner ruling, AN-3a): EVERY exit, forward or reverse, is open iff its TARGET is reached this loop (the start,
 *     or a node one of whose `after` sets is fully cleared). On a one-member set that is "the source is cleared"
 *     (AN-1b's forward rule); on `after: [[A, B]]` both A→N and B→N stay shut until A and B are cleared; on
 *     `after: [[A], [B]]` both open once either is. A move that names no exit of the node keeps "the source is
 *     cleared". So a multi-hop move between reached nodes (the Region
 *     Graph's path queueing) is never refused, and costs 0 (every node's `moveCost`). Mana is never part of it (⚖ Q1:
 *     a node may be started short of mana; Loops drains what is left).
 *   - **One performance** (`perform(nodeId)`): the results go to the ledger, `results.mana` to the pool
 *     (`gainMana`); the first time a node is cleared its forward exits are REVEALED (`env.revealExits`, the discovery
 *     module's `revealExits`: each exit, its target and the target's contents, and the target's move back — no random
 *     pick, ⚖ D6, AN-1b; until AN-1b this was a `loop:exploreCompleted`, which also ran explore's random pick); a check
 *     or goal node not yet checked sends its location once (A15: later loops repeat the action without it).
 *   - **In Loop mode** Loops runs the `act` entries (cost `loop_costs[p].regions[<node>].actions.act`) and publishes
 *     `loop:actionCompleted`; the runtime performs on it. **Outside Loop mode** `actNow(nodeId)` charges the same
 *     shared pool itself (`chargeMana`, the XP-adjusted price) and, at zero, fires the loop-reset teleport.
 *   - **Boosts (A4)**: an Archipelago item named in `action_nodes[p].boosts` adds its stats and resources to the
 *     ledger at once when received and again at the start of every loop; its `mana` is the per-item starting mana
 *     (the gameState table, set on load in place of the flat +10) and is also gained at once when received.
 *   - **Both resets** (`gameState:loopReset`, `loopState:loopReset`) and a world load start a new loop: counts to
 *     zero, the ledger to its base plus the held boosts.
 *
 * The node data come from the compiled world: `action_nodes[p]` (the block) and each node's `playable_payload`.
 * The model has the shape `actionModel.buildActionModel` returns, so its pure rules (`whyNot`, `isReached`,
 * `isCleared`) are the ones the compiler's search and the bot use: ONE definition of "can this node be performed".
 *
 * No DOM. Every effect goes through the injected `env` (index.js wires the app's; the tests a fake).
 */

import { whyNot, isCleared, isReached } from './actionModel.js';
import { nodeStates, viewStateOf } from './nodeStates.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { strictQueueRefusal } from '../loops/strictQueueActions.js';
import { ACTION_NODES_SUBSTRATE_ID, ACT_ACTION } from './actionGraphCompiler.js';

export const ACTION_NODES_STATE_EVENT = 'actionNodes:stateChanged';

export const RUNTIME_REFUSALS = Object.freeze({
    noWorld: 'no-world',
    unknownNode: 'unknown-node',
    wrongRegion: 'wrong-region',
    notCleared: 'not-cleared',
    targetNotReached: 'target-not-reached',
    queueElsewhere: 'queue-ends-elsewhere',
});

const amountPairs = (named, ix) => Object.entries(named ?? {})
    .filter(([id]) => ix.has(id))
    .map(([id, v]) => [ix.get(id), typeof v === 'number' ? v : v?.amount ?? 0]);

/**
 * The runtime model of a compiled world, in `buildActionModel`'s shape, from `action_nodes[p]` and the per-node
 * payloads. Throws when the block or a payload is unusable.
 * @param {object} block - `action_nodes[p]`
 * @param {object} payloads - node id → `playable_payload`
 */
export function runtimeModelOf(block, payloads) {
    if (!block || typeof block !== 'object') throw new Error('action_nodes: no block for this player');
    const statIds = Object.keys(block.stats ?? {});
    const resourceIds = Object.keys(block.resources ?? {});
    const nodeIds = Object.keys(payloads ?? {});
    if (!nodeIds.includes(block.start)) throw new Error(`action_nodes: the start node '${block.start}' has no payload`);
    const statIx = new Map(statIds.map((id, i) => [id, i]));
    const resIx = new Map(resourceIds.map((id, i) => [id, i]));
    const nodeIx = new Map(nodeIds.map((id, i) => [id, i]));
    const nodes = nodeIds.map((id) => {
        const p = payloads[id];
        return Object.freeze({
            id,
            name: p.name ?? id,
            kind: p.kind,
            time: p.time ?? 0,
            limit: p.limit ?? 1,
            reqStats: amountPairs(p.requires?.stats, statIx),
            reqRes: amountPairs(p.requires?.resources, resIx),
            addStats: amountPairs(p.results?.stats, statIx),
            addRes: amountPairs(p.results?.resources, resIx),
            addMana: p.results?.mana ?? 0,
            after: (p.after ?? []).map((set) => set.map((ref) => nodeIx.get(ref)).filter((i) => i !== undefined)),
            location: typeof p.location === 'string' && p.location ? p.location : null,
            exits: (p.exits ?? []).map((e) => ({
                name: e.exitName ?? e.exit_id, target: e.targetRegion ?? e.exit_id, reverse: e.reverse === true,
            })),
        });
    });
    const boons = Object.entries(block.boosts ?? {}).map(([item, b]) => Object.freeze({
        id: b.boon_id ?? item,
        name: item,
        mana: typeof b.mana === 'number' ? b.mana : (block.mana_per_item_default ?? 0),
        stats: amountPairs(b.stats, statIx),
        resources: amountPairs(b.resources, resIx),
        gives: { stats: { ...(b.stats ?? {}) }, resources: { ...(b.resources ?? {}) }, mana: b.mana },
    }));
    return Object.freeze({
        graph: { stats: block.stats ?? {}, resources: block.resources ?? {} },
        block,
        statIds, resourceIds, nodeIds,
        statIx, resIx, nodeIx,
        nodes, boons,
        startIndex: nodeIx.get(block.start),
        goalIndex: nodes.findIndex((n) => n.kind === 'goal'),
        loopMana: block.loop?.mana ?? 0,
    });
}

/** The per-item starting-mana table of a block: item name → mana. */
export function perItemManaTableOf(block) {
    return Object.fromEntries(Object.entries(block?.boosts ?? {})
        .map(([item, b]) => [item, typeof b.mana === 'number' ? b.mana : block.mana_per_item_default]));
}

export class ActionNodesRuntime {
    /**
     * @param {object} env
     * @param {(event: string, data: object) => void} env.publish            event bus publish
     * @param {(event: string, data: object, opts?: object) => void} env.dispatch   dispatcher publish
     * @param {(regionName: string, exitNames: string[]) => void} [env.revealExits] discovery's reveal (no random pick)
     * @param {() => object|null} env.gameState                            the gameState singleton
     * @param {() => object} env.ledger                                     the host ledger
     * @param {(args: object) => {depleted: boolean}} env.chargeMana
     * @param {(args: object) => void} env.gainMana
     * @param {(base: number, region: string) => number} env.xpAdjustedCost
     * @param {() => void} env.fireReset                                    the loop-reset teleport
     * @param {(level: string, msg: string) => void} [env.log]
     */
    constructor(env = {}) {
        this.env = env;
        this.unload();
    }

    setEnv(env) {
        this.env = { ...this.env, ...env };
    }

    _log(level, msg) {
        try { this.env.log?.(level, msg); } catch { /* ignore */ }
    }

    // ── World ────────────────────────────────────────────────────────────

    /** Forget the world (a world without an `action_nodes` block was loaded). */
    unload() {
        const hadWorld = !!this.model;
        this.model = null;
        this.payloads = null;
        this.playerId = null;
        this.counts = [];
        this.held = new Map();
        this.applied = null;
        this.sentChecks = new Set();
        this.discovered = new Set();
        this.checked = new Set();
        if (hadWorld) {
            try { this.env.ledger?.()?.clear(); } catch { /* ignore */ }
            try { this.env.gameState?.()?.setPerItemManaTable?.(null); } catch { /* ignore */ }
            this._changed('unload');
        }
    }

    /**
     * Load a rules document. Returns true when it is an ActionNodes world for `playerId` (and the runtime now holds
     * it), false otherwise (and the runtime holds nothing).
     */
    loadWorld(rulesJson, playerId = '1') {
        const p = String(playerId);
        const block = rulesJson?.action_nodes?.[p];
        if (!block) {
            this.unload();
            return false;
        }
        const payloads = {};
        for (const [region, side] of Object.entries(rulesJson?.preset_sidecars?.[p] ?? {})) {
            if (side?.substrate === ACTION_NODES_SUBSTRATE_ID && side.playable_payload) payloads[region] = side.playable_payload;
        }
        this.unload();
        this.model = runtimeModelOf(block, payloads);
        this.payloads = Object.freeze(payloads);
        this.playerId = p;
        const ledger = this.env.ledger?.();
        ledger?.configure({
            owner: ACTION_NODES_SUBSTRATE_ID,
            label: block.name ?? 'Action Nodes',
            stats: block.stats ?? {},
            resources: block.resources ?? {},
        });
        this.env.gameState?.()?.setPerItemManaTable?.(perItemManaTableOf(block), block.mana_per_item_default);
        this._startLoop('load');
        return true;
    }

    isLoaded() {
        return this.model !== null;
    }

    statIds() { return this.model ? [...this.model.statIds] : []; }

    resourceIds() { return this.model ? [...this.model.resourceIds] : []; }

    // ── Loops, boosts ────────────────────────────────────────────────────

    /** Counts to zero (the start cleared), the ledger to its base plus every held boost. */
    _startLoop(source) {
        if (!this.model) return;
        this.counts = this.model.nodes.map(() => 0);
        this.counts[this.model.startIndex] = this.model.nodes[this.model.startIndex].limit;
        const totals = { stats: {}, resources: {} };
        for (const b of this.model.boons) {
            const k = this.held.get(b.name) ?? 0;
            if (!k) continue;
            for (const [s, n] of b.stats) totals.stats[this.model.statIds[s]] = (totals.stats[this.model.statIds[s]] ?? 0) + n * k;
            for (const [r, n] of b.resources) totals.resources[this.model.resourceIds[r]] = (totals.resources[this.model.resourceIds[r]] ?? 0) + n * k;
        }
        const ledger = this.env.ledger?.();
        ledger?.resetRun(totals, { source });
        if (this.applied !== null) this.applied = new Map(this.held);
        this._publishBoosts();
        this._changed(source);
    }

    /** A loop reset (either flow). */
    onLoopReset(source = 'reset') {
        this._startLoop(source);
    }

    /**
     * A state snapshot: the inventory (boosts) and the checked locations. The FIRST snapshot after a load is the
     * baseline (its boosts are in the loop's start already: the starting mana includes them, so nothing is gained);
     * after it, a rise in a boost's count applies the difference AT ONCE (A4), mana included.
     */
    onSnapshot(snapshot) {
        if (!this.model || !snapshot) return;
        for (const loc of snapshot.checkedLocations ?? []) this.checked.add(loc);
        const held = new Map();
        for (const b of this.model.boons) {
            const n = snapshot.inventory?.[b.name] ?? 0;
            if (n > 0) held.set(b.name, n);
        }
        this.held = held;
        if (this.applied === null) {
            this.applied = new Map(held);
            this._startLoop('baseline');
            return;
        }
        const delta = { stats: {}, resources: {} };
        let mana = 0;
        let any = false;
        for (const b of this.model.boons) {
            const d = (held.get(b.name) ?? 0) - (this.applied.get(b.name) ?? 0);
            if (d <= 0) continue;
            any = true;
            for (const [s, n] of b.stats) delta.stats[this.model.statIds[s]] = (delta.stats[this.model.statIds[s]] ?? 0) + n * d;
            for (const [r, n] of b.resources) delta.resources[this.model.resourceIds[r]] = (delta.resources[this.model.resourceIds[r]] ?? 0) + n * d;
            mana += b.mana * d;
        }
        this.applied = new Map(held);
        if (!any) return;
        const res = this.env.ledger?.()?.apply(delta, { source: 'boost' });
        if (res && !res.ok) this._log('warn', `[actionNodes] a boost could not be applied: ${res.text}`);
        if (mana > 0) this.env.gainMana?.({ substrateId: ACTION_NODES_SUBSTRATE_ID, amount: mana });
        this._publishBoosts();
        this._changed('boost');
    }

    _publishBoosts() {
        const ledger = this.env.ledger?.();
        if (!ledger || !this.model) return;
        ledger.setBoosts(this.model.boons.map((b) => ({ item: b.name, held: this.held.get(b.name) ?? 0, gives: b.gives })));
    }

    /** A cross-substrate grant of one of this world's resources (`crossSubstrate:itemGranted` to action_nodes). */
    onItemGranted({ to, itemType, count = 1 } = {}) {
        if (!this.model || to !== ACTION_NODES_SUBSTRATE_ID) return;
        if (!this.model.resIx.has(itemType)) return;
        const res = this.env.ledger?.()?.apply({ resources: { [itemType]: count } }, { source: 'grant' });
        if (res && !res.ok) this._log('warn', `[actionNodes] grant refused: ${res.text}`);
        this._changed('grant');
    }

    // ── The model's view of the live state ───────────────────────────────

    /** The live loop state, in actionModel's LoopState shape (mana not modelled: the pool is gameState's). */
    liveState() {
        const ledger = this.env.ledger?.();
        return {
            counts: this.counts.slice(),
            stats: this.model.statIds.map((id) => ledger?.getStat(id) ?? 0),
            resources: this.model.resourceIds.map((id) => ledger?.getResource(id) ?? 0),
            mana: Number.POSITIVE_INFINITY,
            spent: 0,
        };
    }

    /** The live prices of every node: its `time` after the region-XP discount (the env's `xpAdjustedCost`). */
    liveCosts() {
        if (!this.model) return [];
        return this.model.nodes.map((n) => (this.env.xpAdjustedCost ? this.env.xpAdjustedCost(n.time, n.id) : n.time));
    }

    /** The live state with the shared pool's mana (Infinity when no pool is readable). */
    liveViewState() {
        const mana = this.env.gameState?.()?.getCurrentMana?.();
        return { ...this.liveState(), mana: typeof mana === 'number' ? mana : Number.POSITIVE_INFINITY };
    }

    /**
     * Every node's visual state (`nodeStates.js`, design §4): for the END of `queue` while it is being planned, for
     * the live state while it runs (`running`).
     * @param {{running?: boolean, queue?: object[], isDiscovered?: (id: string) => boolean}} [opts]
     * @returns {{states: object, basis: string, stoppedAt: object|null}}
     */
    nodeStates({ running = false, queue = [], isDiscovered } = {}) {
        if (!this.model) return { states: {}, basis: 'live', stoppedAt: null };
        const costs = this.liveCosts();
        const view = viewStateOf(this.model, this.liveViewState(), { running, queue, costs });
        return { states: nodeStates(this.model, view.state, { costs, isDiscovered }), basis: view.basis, stoppedAt: view.stoppedAt };
    }

    nodeIndex(nodeId) {
        return this.model?.nodeIx.get(nodeId);
    }

    node(nodeId) {
        const i = this.nodeIndex(nodeId);
        return i === undefined ? null : this.model.nodes[i];
    }

    /** Why node `nodeId` cannot be performed now, or null. Mana is not considered. */
    whyNotAct(nodeId) {
        if (!this.model) return { code: RUNTIME_REFUSALS.noWorld, text: 'no ActionNodes world is loaded' };
        const i = this.nodeIndex(nodeId);
        if (i === undefined) return { code: RUNTIME_REFUSALS.unknownNode, text: `'${nodeId}' is not a node of this world` };
        return whyNot(this.model, this.liveState(), i, { ignoreMana: true });
    }

    isCleared(nodeId) {
        const i = this.nodeIndex(nodeId);
        return i !== undefined && isCleared(this.model, this.liveState(), i);
    }

    isReached(nodeId) {
        const i = this.nodeIndex(nodeId);
        return i !== undefined && isReached(this.model, this.liveState(), i);
    }

    /** The exit of `nodeId` a move uses: by exit name, else by its destination; null when neither names one. */
    exitOf(nodeId, { exitName = null, destination = null } = {}) {
        const n = this.node(nodeId);
        if (!n) return null;
        return (exitName && n.exits.find((e) => e.name === exitName))
            ?? (destination && n.exits.find((e) => e.target === destination))
            ?? null;
    }

    /**
     * Whether a move out of `nodeId` is allowed, or the refusal. ⛓ The multi-entry rule (AN-3a): an exit of the node,
     * forward or reverse, is open iff its TARGET is reached this loop. A move that names no exit of the node is open
     * when `nodeId` is cleared this loop (A1: its exits open on the action).
     *
     * A forward exit refused while its own source is not cleared says so (`not-cleared`, with the count): on a
     * one-member `after` set that is the whole reason. Refused with the source cleared (a multi-member set), it names
     * the members still to clear (`target-not-reached`).
     * @param {string} nodeId
     * @param {{exitName?: string|null, destination?: string|null}} [move]
     */
    whyNotLeave(nodeId, move = {}) {
        const n = this.node(nodeId);
        if (!n) return null; // not a node of this world: not ours to refuse
        const exit = this.exitOf(nodeId, move);
        const i = this.nodeIndex(nodeId);
        const notCleared = () => ({
            code: RUNTIME_REFUSALS.notCleared,
            text: `${n.name} is not cleared this loop (${this.counts[i]}/${n.limit}): its exits open after the action`,
        });
        if (!exit) return this.isCleared(nodeId) ? null : notCleared();
        if (this.isReached(exit.target)) return null;
        const t = this.node(exit.target);
        if (exit.reverse) {
            return {
                code: RUNTIME_REFUSALS.targetNotReached,
                text: `${t?.name ?? exit.target} is not reached this loop: a move back opens to a node reached this loop`,
            };
        }
        if (!this.isCleared(nodeId)) return notCleared();
        return {
            code: RUNTIME_REFUSALS.targetNotReached,
            text: `${t?.name ?? exit.target} is not reached this loop: ${this.unclearedAfterText(exit.target)}`,
        };
    }

    /** "still to clear: A (0/1), B (1/2)" for the `after` set of `nodeId` closest to cleared. */
    unclearedAfterText(nodeId) {
        const t = this.node(nodeId);
        if (!t?.after?.length) return 'it has no way in';
        const missing = t.after.map((set) => set.filter((m) => this.counts[m] < this.model.nodes[m].limit));
        const best = missing.reduce((a, b) => (b.length < a.length ? b : a));
        return `still to clear: ${best.map((m) => `${this.model.nodes[m].name} (${this.counts[m]}/${this.model.nodes[m].limit})`).join(', ')}`;
    }

    // ── The start gate (loopSupport.actionGate) ──────────────────────────

    /**
     * May this Loops queue entry start? `{ok: true}` or `{ok: false, reason, code}`.
     * @param {object} action - a queue entry
     */
    gate(action) {
        if (!this.model) return { ok: true };
        if (action?.type === 'customAction' && action.actionName === ACT_ACTION) {
            const nodeId = action.params?.nodeId ?? action.sourceRegion;
            if (nodeId !== action.sourceRegion) {
                return {
                    ok: false, code: RUNTIME_REFUSALS.wrongRegion,
                    reason: `the entry names node '${nodeId}' but is queued in '${action.sourceRegion}'`,
                };
            }
            const why = this.whyNotAct(nodeId);
            return why ? { ok: false, reason: why.text, code: why.code } : { ok: true };
        }
        if (action?.type === 'customAction') {
            // ⚖ D6 (Robert 2026-11-16T19:59:48Z): no explore — or any other custom action — in ActionNodes. The entry's
            // own `queueActions` is the list (`strictQueueActions`); refused by name, as at queue time.
            const entry = substrateRegistry.get(ACTION_NODES_SUBSTRATE_ID);
            const refusal = strictQueueRefusal(entry?.loopSupport ?? { strictQueueActions: true, queueActions: [ACT_ACTION] },
                action.actionName, { substrateLabel: entry?.label ?? 'Action Nodes', region: action.sourceRegion });
            if (refusal) return refusal;
        }
        if (action?.type === 'regionMove') {
            const why = this.whyNotLeave(action.sourceRegion, { exitName: action.exitUsed, destination: action.destinationRegion });
            return why ? { ok: false, reason: why.text, code: why.code } : { ok: true };
        }
        return { ok: true };
    }

    // ── Performing ───────────────────────────────────────────────────────

    /**
     * Perform node `nodeId` once: results, discovery on the first clear, the check once. The caller has paid.
     * @returns {{ok: true, cleared: boolean, checkSent: string|null} | {ok: false, code: string, text: string}}
     */
    perform(nodeId, { fromLoop = false } = {}) {
        const why = this.whyNotAct(nodeId);
        if (why) {
            this._log('warn', `[actionNodes] ${nodeId}: not performed — ${why.text}`);
            return { ok: false, ...why };
        }
        const i = this.nodeIndex(nodeId);
        const node = this.model.nodes[i];
        const delta = { stats: {}, resources: {} };
        for (const [s, n] of node.addStats) delta.stats[this.model.statIds[s]] = n;
        for (const [r, n] of node.addRes) delta.resources[this.model.resourceIds[r]] = n;
        const applied = this.env.ledger?.()?.apply(delta, { source: `act:${nodeId}` });
        if (applied && !applied.ok) {
            this._log('warn', `[actionNodes] ${nodeId}: the ledger refused the results — ${applied.text}`);
            return { ok: false, code: applied.code, text: applied.text };
        }
        this.counts[i] += 1;
        if (node.addMana > 0) this.env.gainMana?.({ substrateId: ACTION_NODES_SUBSTRATE_ID, amount: node.addMana });
        const cleared = this.counts[i] >= node.limit;
        const forward = node.exits.filter((e) => !e.reverse);
        if (cleared && !this.discovered.has(nodeId) && forward.length) {
            this.discovered.add(nodeId);
            try {
                this.env.revealExits?.(nodeId, forward.map((e) => e.name));
            } catch (e) {
                this._log('warn', `[actionNodes] ${nodeId}: revealing its exits failed — ${e?.message ?? e}`);
            }
        }
        let checkSent = null;
        if (node.location && !this.sentChecks.has(node.location) && !this.checked.has(node.location)) {
            this.sentChecks.add(node.location);
            checkSent = node.location;
            this.env.dispatch?.('user:locationCheck', { locationName: node.location, regionName: nodeId, fromLoop }, { initialTarget: 'bottom' });
        }
        this._changed(`act:${nodeId}`);
        return { ok: true, cleared, checkSent };
    }

    /** Loops' `loop:actionCompleted`: the queue paid for and ran one `act`. */
    onActionCompleted({ actionName, regionName, params } = {}) {
        if (!this.model || actionName !== ACT_ACTION) return null;
        return this.perform(params?.nodeId ?? regionName, { fromLoop: true });
    }

    /**
     * Outside Loop mode: perform at once, charging the shared pool here (design §2). Short of mana, the node is
     * started anyway (⚖ Q1): what is left is spent (region XP), the action does not complete, and the loop resets.
     * @returns {{ok: boolean, completed: boolean, code?: string, text?: string, price?: number}}
     */
    actNow(nodeId) {
        const why = this.whyNotAct(nodeId);
        if (why) return { ok: false, completed: false, ...why };
        const node = this.node(nodeId);
        const gs = this.env.gameState?.();
        const price = this.env.xpAdjustedCost ? this.env.xpAdjustedCost(node.time, nodeId) : node.time;
        const have = gs?.getCurrentMana?.() ?? Number.POSITIVE_INFINITY;
        if (have + 1e-9 < price) {
            if (have > 0) this.env.chargeMana?.({ substrateId: ACTION_NODES_SUBSTRATE_ID, amount: have, regionId: nodeId });
            this.env.fireReset?.();
            return { ok: false, completed: false, code: 'mana', text: `short of mana: ${node.name} costs ${price}, ${have} left — the loop ends`, price };
        }
        const charged = price > 0
            ? this.env.chargeMana?.({ substrateId: ACTION_NODES_SUBSTRATE_ID, amount: price, regionId: nodeId })
            : { depleted: false };
        const result = this.perform(nodeId, { fromLoop: false });
        // results.mana lands before the depletion check: a node that refills the pool does not end the loop
        const empty = (gs?.getCurrentMana?.() ?? 1) <= 0 && !gs?.noManaDepletionReset;
        if (charged?.depleted && empty) this.env.fireReset?.();
        return { ...result, completed: result.ok, price };
    }

    // ── Reporting ────────────────────────────────────────────────────────

    /** The state the panel and the tests read. */
    snapshot() {
        if (!this.model) return { loaded: false };
        const ledger = this.env.ledger?.();
        return {
            loaded: true,
            graphId: this.model.block.graph_id,
            name: this.model.block.name,
            playerId: this.playerId,
            nodes: this.model.nodes.map((n, i) => ({
                id: n.id, name: n.name, kind: n.kind, time: n.time, limit: n.limit, count: this.counts[i],
                cleared: isCleared(this.model, this.liveState(), i), reached: isReached(this.model, this.liveState(), i),
                location: n.location,
            })),
            ledger: ledger?.snapshot?.() ?? null,
            held: Object.fromEntries(this.held),
            sentChecks: [...this.sentChecks],
            discovered: [...this.discovered],
        };
    }

    _changed(source) {
        try { this.env.publish?.(ACTION_NODES_STATE_EVENT, { source, loaded: this.isLoaded() }); } catch { /* ignore */ }
    }
}

let _runtime = null;

/** The app's one runtime (created on first use; index.js injects the env). */
export function getActionNodesRuntime() {
    if (!_runtime) _runtime = new ActionNodesRuntime();
    return _runtime;
}
