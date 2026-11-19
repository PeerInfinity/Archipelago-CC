/**
 * actionNodes/nodeCardOverlay — registers the node card (`nodeCard.js`) on the Region Graph while an ActionNodes world
 * is loaded, and removes it on unload (design §4; slice AN-3a).
 *
 *   - `syncNodeCardOverlay()` after every rules load: an ActionNodes world → `regionGraph.registerNodeOverlayProvider`
 *     (once); any other world → `regionGraph.unregisterNodeOverlayProvider` (once). Other worlds never see the card.
 *   - Refreshes (`regionGraph.refreshNodeOverlays`) on what changes a state: the runtime, the ledger, mana, the queue
 *     (planned or running), discovery, checks, Loop mode.
 *
 * The view: `runtime.nodeStates({running, queue, isDiscovered})` — the END of the Loops queue while it is planned, the
 * live state while it runs (`loopState.isProcessing` and not paused). The queue is read only in Loop mode.
 */

import { createNodeCardProvider } from './nodeCard.js';
import { getActionNodesRuntime, ACTION_NODES_STATE_EVENT } from './actionNodesRuntime.js';
import { LEDGER_CHANGED_EVENT } from '../resourceChannels/resourceLedger.js';

/** What refreshes the cards. */
export const NODE_CARD_REFRESH_EVENTS = Object.freeze([
    ACTION_NODES_STATE_EVENT,
    LEDGER_CHANGED_EVENT,
    'gameState:manaChanged',
    'gameState:pathUpdated',
    'gameState:loopModeChanged',
    'gameState:xpChanged',
    'loopState:queueUpdated',
    'loopState:processingStarted',
    'loopState:processingStopped',
    'loopState:pauseStateChanged',
    'loopState:actionCompleted',
    'discovery:changed',
    'discovery:regionDiscovered',
    'stateManager:snapshotUpdated',
]);

/**
 * The card view of the loaded world, or null.
 * @param {object} deps
 * @param {object} deps.runtime
 * @param {() => object|null} [deps.loopState]   the Loops state (`isProcessing`, `isPaused`, `getActionQueue`)
 * @param {() => boolean} [deps.loopMode]
 * @param {() => {enabled: boolean, isRegionDiscovered: (id: string) => boolean}|null} [deps.discovery]
 */
export function nodeCardView({ runtime, loopState = () => null, loopMode = () => false, discovery = () => null }) {
    if (!runtime?.isLoaded?.()) return null;
    const ls = loopMode() ? loopState() : null;
    const running = !!ls?.isProcessing && !ls?.isPaused;
    const queue = ls?.getActionQueue?.() ?? [];
    const d = discovery();
    const isDiscovered = d?.enabled ? (id) => !!d.isRegionDiscovered(id) : () => true;
    const { states, basis } = runtime.nodeStates({ running, queue, isDiscovered });
    return {
        loaded: true,
        model: runtime.model,
        payloads: runtime.payloads,
        states,
        basis,
        isDiscovered,
        checked: (loc) => runtime.checked.has(loc) || runtime.sentChecks.has(loc),
    };
}

/**
 * Wire the overlay to the app.
 * @param {object} deps
 * @param {(module: string, fn: string) => Function|undefined} deps.getModuleFunction
 * @param {object} deps.eventBus
 * @param {object} deps.viewDeps - `nodeCardView`'s deps minus the runtime
 * @returns {{sync: () => void, provider: object, isRegistered: () => boolean}}
 */
export function wireNodeCardOverlay({ getModuleFunction, eventBus, viewDeps = {} }) {
    const runtime = getActionNodesRuntime();
    const provider = createNodeCardProvider({
        getView: () => nodeCardView({ runtime, ...viewDeps }),
        getStamp: () => runtime.model,
    });
    let registered = false;
    const fn = (name) => {
        try { return getModuleFunction?.('regionGraph', name) ?? null; } catch { return null; }
    };
    const sync = () => {
        if (runtime.isLoaded()) {
            if (!registered) {
                const reg = fn('registerNodeOverlayProvider');
                if (!reg) return;
                reg(provider);
                registered = true;
            } else {
                fn('refreshNodeOverlays')?.();
            }
        } else if (registered) {
            fn('unregisterNodeOverlayProvider')?.();
            registered = false;
        }
    };
    let pending = false;
    const refresh = () => {
        if (!registered || pending) return;
        pending = true;
        queueMicrotask(() => {
            pending = false;
            if (registered) fn('refreshNodeOverlays')?.();
        });
    };
    for (const ev of NODE_CARD_REFRESH_EVENTS) {
        try { eventBus?.subscribe?.(ev, refresh); } catch { /* not in this module set */ }
    }
    return { sync, provider, isRegistered: () => registered };
}
