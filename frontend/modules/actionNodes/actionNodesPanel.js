/**
 * actionNodesPanel — the substrate's own small panel (design §10 slice 2): the node the player is at.
 *
 * Shows the node's name, kind, time (the XP-adjusted price), performances this loop, requirements and results, why it
 * cannot be performed when it cannot, and its exits (a forward exit opens once the node is cleared this loop; a move
 * back to a node reached this loop is always open). One button:
 *   - OUTSIDE Loop mode, **Act** performs at once (the runtime charges the shared pool);
 *   - IN Loop mode, **Queue act** appends an `act` entry to the Loops queue — only when the queue ends at this node
 *     (moves are planned in the Region Graph or the Loops panel; slice 3 adds the routed click).
 * Outside Loop mode an open exit is a button that moves there.
 *
 * AN-TIME-2: the loop's number and clock (a timed world), the node's window, the amounts in the world's pool name, and
 * **Completed before**: every node first performed in an earlier loop, each tagged "loop N" (⚖ Robert's Q6, minimal
 * form). In Loop mode, "Queue act" on an early node queues its `wait` first.
 *
 * The content is a pure function (`actionNodesPanelModel`) of the runtime's snapshot and the node, so it is tested
 * without a DOM.
 */

import eventBus from '../../app/core/eventBus.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { getGameStateSingleton } from '../gameState/singleton.js';
import { xpAdjustedCost } from '../resourceChannels/resourceChannelsLibrary.js';
import { LEDGER_CHANGED_EVENT } from '../resourceChannels/resourceLedger.js';
import { getActionNodesRuntime, ACTION_NODES_STATE_EVENT, RUNTIME_REFUSALS } from './actionNodesRuntime.js';
import { ACT_ACTION } from './actionGraphCompiler.js';
import { WAIT_ACTION } from '../shared/procgen/loopCustomActions.js';
import { formatClock, poolAmountOf } from './actionModel.js';
import { windowText } from './nodeCard.js';
import { waitParamsOf } from './nodeClickAction.js';

export const ACTION_NODES_PANEL_COMPONENT_TYPE = 'actionNodesPanel';
export const ACTION_NODES_LOAD_REGION_EVENT = 'actionNodes:loadRegion';
const MODULE = 'actionNodes';

const amountsText = (named) => {
    const parts = Object.values(named ?? {}).map((v) => `${v.name} ${v.amount > 0 ? '+' : ''}${v.amount}`);
    return parts.length ? parts.join(', ') : '–';
};

const minimumsText = (named) => {
    const parts = Object.values(named ?? {}).map((v) => `${v.name} ≥ ${v.amount}`);
    return parts.length ? parts.join(', ') : '–';
};

/**
 * The panel's content as data.
 * @param {{payload: object|null, runtime: object, loopMode: boolean, price?: number}} input
 */
export function actionNodesPanelModel({ payload, runtime, loopMode, price = null }) {
    if (!payload || !runtime?.isLoaded?.()) return { empty: true, text: 'No ActionNodes node is loaded.' };
    const nodeId = payload.node_id;
    const node = runtime.node(nodeId);
    if (!node) return { empty: true, text: `'${nodeId}' is not a node of the loaded world.` };
    const i = runtime.nodeIndex(nodeId);
    const count = runtime.counts[i] ?? 0;
    const why = node.kind === 'start' ? null : runtime.whyNotAct(nodeId);
    const cleared = runtime.isCleared(nodeId);
    const results = [];
    const r = amountsText(payload.results?.stats);
    const s = amountsText(payload.results?.resources);
    if (r !== '–') results.push(r);
    if (s !== '–') results.push(s);
    if (payload.results?.mana) results.push(`+${poolAmountOf(runtime.model, payload.results.mana)}`);
    const needs = [minimumsText(payload.requires?.stats), minimumsText(payload.requires?.resources)].filter((t) => t !== '–');
    return {
        empty: false,
        nodeId,
        name: node.name,
        kind: node.kind,
        time: node.time,
        price: price ?? node.time,
        count,
        limit: node.limit,
        needs: needs.length ? needs.join(', ') : '–',
        gives: results.length ? results.join(', ') : '–',
        location: node.location,
        checked: !!node.location && (runtime.checked.has(node.location) || runtime.sentChecks.has(node.location)),
        status: node.kind === 'start' ? 'start' : (why ? 'blocked' : 'ready'),
        whyNot: why?.text ?? null,
        canAct: node.kind !== 'start' && !why,
        actLabel: loopMode ? 'Queue act' : 'Act',
        cleared,
        exits: node.exits.map((e) => ({ ...e, open: !runtime.whyNotLeave(nodeId, { exitName: e.name }) })),
        // AN-TIME-2
        priceText: poolAmountOf(runtime.model, price ?? node.time),
        loopText: loopTextOf(runtime),
        window: runtime.model.windowed && node.kind !== 'start' ? windowText(runtime.model, payload.window) : null,
        completedBefore: runtime.completedBefore().map((c) => ({ ...c, text: `${c.name} · loop ${c.loop}` })),
    };
}

/** "Loop 2 · 11:00" (the clock only in a timed world). */
export function loopTextOf(runtime) {
    const m = runtime.model;
    const clock = m?.clock || m?.windowed ? ` · ${formatClock(m, runtime.clock)}` : '';
    return `Loop ${runtime.loopNumber}${clock}`;
}

function el(tag, attrs = {}, text = null) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== null) e.textContent = text;
    return e;
}

export class ActionNodesPanel {
    constructor(container) {
        this.container = container;
        this.payload = null;
        this.message = null;
        this.root = el('div', { class: 'action-nodes-panel', 'data-testid': 'action-nodes-panel' });
        this.root.style.cssText = 'padding:8px;font-size:13px;overflow:auto;height:100%;box-sizing:border-box;';
        this.container.element.appendChild(this.root);
        this._unsubs = [];
        const sub = (ev, fn) => {
            try {
                const off = eventBus.subscribe(ev, fn, MODULE);
                if (typeof off === 'function') this._unsubs.push(off);
            } catch { /* unknown in this module set */ }
        };
        sub(ACTION_NODES_LOAD_REGION_EVENT, (data) => {
            this.payload = data?.world ?? null;
            this.message = null;
            this.render();
        });
        for (const ev of [ACTION_NODES_STATE_EVENT, LEDGER_CHANGED_EVENT, 'gameState:manaChanged', 'gameState:loopModeChanged']) {
            sub(ev, () => this.render());
        }
        this.container.on?.('destroy', () => this.destroy());
        this.render();
    }

    getRootElement() {
        return this.root;
    }

    _gs() {
        try { return getGameStateSingleton(); } catch { return null; }
    }

    render() {
        const runtime = getActionNodesRuntime();
        const gs = this._gs();
        const loopMode = gs?.isLoopModeActive === true;
        const nodeId = this.payload?.node_id;
        let price = null;
        const node = nodeId ? runtime.node(nodeId) : null;
        if (node) {
            try { price = xpAdjustedCost(node.time, nodeId); } catch { price = node.time; }
        }
        const m = actionNodesPanelModel({ payload: this.payload, runtime, loopMode, price });
        this.root.replaceChildren();
        if (m.empty) {
            this.root.appendChild(el('div', { class: 'an-empty' }, m.text));
            return;
        }
        const loopLine = el('div', { class: 'an-loop', 'data-testid': 'an-loop' }, m.loopText);
        loopLine.style.cssText = 'opacity:0.75;font-size:11px;';
        this.root.appendChild(loopLine);
        const head = el('div', { class: 'an-title', 'data-status': m.status });
        head.style.cssText = 'font-weight:bold;font-size:15px;margin-bottom:4px;';
        head.textContent = `${m.name}${m.kind === 'start' ? '' : `   ${m.count}/${m.limit}`}`;
        this.root.appendChild(head);
        const line = (cls, text) => this.root.appendChild(el('div', { class: cls }, text));
        if (m.kind !== 'start') {
            if (m.window) line('an-window', m.window);
            line('an-time', `${m.priceText}${m.price !== m.time ? ` (base ${m.time})` : ''}`);
            line('an-needs', `needs  ${m.needs}`);
            line('an-gives', `gives  ${m.gives}`);
        }
        if (m.location) line('an-location', `${m.kind === 'goal' ? 'goal' : 'check'}: ${m.location}${m.checked ? ' ✓' : ''}`);
        if (m.whyNot) {
            const w = el('div', { class: 'an-why-not' }, m.whyNot);
            w.style.color = '#e0a060';
            this.root.appendChild(w);
        }
        if (m.kind !== 'start') {
            const btn = el('button', { class: 'an-act button', 'data-testid': 'an-act' }, m.actLabel);
            btn.disabled = !m.canAct;
            btn.style.margin = '6px 0';
            btn.addEventListener('click', () => this._onAct(m.nodeId, m.name));
            this.root.appendChild(btn);
        }
        if (this.message) {
            const msg = el('div', { class: 'an-message' }, this.message);
            msg.style.opacity = '0.8';
            this.root.appendChild(msg);
        }
        if (m.exits.length) {
            this.root.appendChild(el('div', { class: 'an-exits-title' },
                m.cleared || m.exits.every((e) => e.reverse) ? 'Exits (open):' : 'Exits (forward ones open after the action):'));
            for (const exit of m.exits) {
                const b = el('button', { class: 'an-exit button', 'data-exit': exit.name }, `${exit.reverse ? '←' : '→'} ${exit.target}`);
                b.disabled = !exit.open || this._gs()?.isLoopModeActive === true;
                b.style.margin = '2px';
                b.addEventListener('click', () => this._onExit(m.nodeId, exit));
                this.root.appendChild(b);
            }
        }
        // AN-TIME-2 (⚖ Q6, minimal form): the nodes first performed in an earlier loop, each tagged "loop N".
        const box = el('div', { class: 'an-completed-before', 'data-testid': 'an-completed-before' });
        box.style.cssText = 'border-top:1px solid #444;margin-top:6px;padding-top:4px;';
        box.appendChild(el('div', { class: 'an-completed-before-title' }, `Completed before (${m.completedBefore.length})`));
        if (!m.completedBefore.length) box.appendChild(el('div', { class: 'an-completed-before-none' }, 'nothing yet'));
        for (const c of m.completedBefore) {
            box.appendChild(el('div', { class: 'an-completed-before-entry', 'data-node': c.nodeId, 'data-loop': String(c.loop) }, c.text));
        }
        this.root.appendChild(box);
    }

    _onAct(nodeId, name) {
        const gs = this._gs();
        const runtime = getActionNodesRuntime();
        if (gs?.isLoopModeActive) {
            const r = queueAct(gs, nodeId, name, { runtime, queue: this._queue() });
            this.message = r.ok ? `Queued: ${name}` : r.text;
        } else {
            const r = runtime.actNow(nodeId);
            this.message = r.completed ? null : (r.text ?? 'not performed');
        }
        this.render();
    }

    _queue() {
        try {
            return centralRegistry.getPublicFunction?.('loops', 'getLoopState')?.()?.getActionQueue?.() ?? [];
        } catch {
            return [];
        }
    }

    _onExit(nodeId, exit) {
        const why = getActionNodesRuntime().whyNotLeave(nodeId, { exitName: exit.name, destination: exit.target });
        if (why) {
            this.message = why.text;
            this.render();
            return;
        }
        getModuleDispatcherOrNull()?.publish?.('user:regionMove', {
            sourceRegion: nodeId,
            targetRegion: exit.target,
            exitName: exit.name,
        }, { initialTarget: 'bottom' });
    }

    destroy() {
        for (const off of this._unsubs) {
            try { off(); } catch { /* ignore */ }
        }
        this._unsubs = [];
    }
}

/**
 * Append an `act` entry for `nodeId` to the Loops queue — only when the queue ends at that node (the entry runs
 * where it is queued). `{ok}` or `{ok: false, code, text}`.
 */
export function queueAct(gs, nodeId, label, { runtime = null, queue = [] } = {}) {
    const path = gs?.getPath?.() ?? gs?.path ?? [];
    let end = null;
    for (let i = path.length - 1; i >= 0; i--) {
        if (path[i].type === 'regionMove') { end = path[i].destinationRegion; break; }
    }
    end = end ?? gs?.getCurrentRegion?.() ?? null;
    if (end !== nodeId) {
        return {
            ok: false, code: RUNTIME_REFUSALS.queueElsewhere,
            text: `The queue ends in ${end ?? 'no region'}, not here: queue a move to this node first.`,
        };
    }
    // AN-TIME-2: early at the queue's end → its `wait` first (the start gate refuses an early act).
    const wait = runtime?.isLoaded?.() ? (runtime.nodeStates({ queue }).states?.[nodeId]?.wait ?? 0) : 0;
    if (wait > 0) gs.addCustomAction(WAIT_ACTION, waitParamsOf(runtime, nodeId, wait));
    gs.addCustomAction(ACT_ACTION, { nodeId, label, regionName: nodeId });
    return wait > 0 ? { ok: true, wait } : { ok: true };
}

let _dispatcher = null;
export function setActionNodesDispatcher(d) { _dispatcher = d ?? null; }
function getModuleDispatcherOrNull() { return _dispatcher; }
