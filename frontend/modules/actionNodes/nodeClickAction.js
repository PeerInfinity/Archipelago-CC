/**
 * actionNodes/nodeClickAction — **THE CLICK (`actionNodes.act`, perform ONCE) AND THE "PERFORM ALL REMAINING" BUTTON'S
 * EFFECT** (slice AN-3b).
 *
 * ⚖ Robert 2026-11-17T21:35:22Z: the default click performs ONCE; a separate button on a repeatable node performs all
 * remaining; no right click.
 *
 * `performNode(deps, nodeId, {times, panelId})` is the one effect behind both:
 *   1. the plan (`nodePerformPlan.planPerform`) over the runtime's model, the live state, the Loops queue (Loop mode
 *      only), the live prices, discovery, and where the queue ends (Loop mode) or the player stands;
 *   2. a refusal → nothing changes, the refusal is returned (and kept as `lastPerformResult`) by name;
 *   3. IN Loop mode it QUEUES: each hop as a `user:regionMove` under the planning source `actionNodes-plan-<panelId>`
 *      (`loops/loopModeExemptions.js` classifies it as planning, as `regionView-path-*` is: the path appends it and the
 *      strict gate lets it through), then one `act` entry per performance (`gameState.addCustomAction`);
 *      OUTSIDE Loop mode it does what that queue would do, AT ONCE: the same moves, then `runtime.actNow` per
 *      performance (which charges the shared pool), stopping at the first that does not complete.
 *
 * The click action is registered with the click-actions registry (`regionView/clickActions.js`) only while an
 * ActionNodes world is loaded (`syncClickAction`), and unregistered on unload; a stored `true` survives as "(not
 * loaded)" in the strip. It runs at the default panel order (300), after the built-in route (100) and checks (200):
 * when "extend path" is also on, that route runs first and this one starts from where it ended.
 */

import { registerClickAction, unregisterClickAction, getClickAction } from '../regionView/clickActions.js';
import { ACT_ACTION } from './actionGraphCompiler.js';
import { WAIT_ACTION } from '../shared/procgen/loopCustomActions.js';
import { formatClock } from './actionModel.js';
import { planPerform, queueEndRegion } from './nodePerformPlan.js';

export const ACT_CLICK_ID = 'actionNodes.act';
export const ACT_CLICK_OWNER = 'actionNodes';

/** The `source` prefix of the moves this module queues in Loop mode (`loops/loopModeExemptions.js` plans on it). */
export const PLAN_SOURCE_PREFIX = 'actionNodes-plan';

/** The `source` of a move queued from `panelId` ('regionGraph', 'regionMap', 'nodeCard'). */
export function planSourceFor(panelId) {
    return `${PLAN_SOURCE_PREFIX}-${panelId ?? 'unknown'}`;
}

let _last = null;

/** The last `performNode` answer (tests and the console read it). */
export function lastPerformResult() {
    return _last;
}

/**
 * Perform (or queue) node `nodeId` once or every remaining time.
 * @param {object} deps
 * @param {object} deps.runtime                       the ActionNodes runtime
 * @param {() => object|null} deps.gameState
 * @param {() => object|null} [deps.loopState]        `getActionQueue()`
 * @param {(id: string) => boolean} [deps.isDiscovered]
 * @param {object|null} deps.dispatcher               publishes `user:regionMove`
 * @param {(r: object) => void} [deps.onResult]       told every answer (index.js logs a refusal)
 * @param {string} nodeId
 * @param {{times?: 1|'remaining', panelId?: string}} [opts]
 * @returns {object} the plan's answer plus what was done: `{ok, ..., loopMode, queued?, performed?}`
 */
export function performNode(deps, nodeId, { times = 1, panelId = 'unknown' } = {}) {
    const { runtime, dispatcher } = deps;
    const gs = deps.gameState?.() ?? null;
    const loopMode = gs?.isLoopModeActive === true;
    const done = (r) => {
        _last = { ...r, nodeId, times, panelId, loopMode };
        try { deps.onResult?.(_last); } catch { /* a listener must not break the click */ }
        return _last;
    };
    if (!runtime?.isLoaded?.()) return done({ ok: false, code: 'no-world', text: 'no ActionNodes world is loaded' });
    const queue = loopMode ? (deps.loopState?.()?.getActionQueue?.() ?? []) : [];
    const here = gs?.getCurrentRegion?.() ?? null;
    const at = loopMode ? queueEndRegion(gs?.getPath?.() ?? [], here) : here;
    const plan = planPerform(runtime.model, {
        live: runtime.liveViewState(),
        queue,
        costs: runtime.liveCosts(),
        isDiscovered: deps.isDiscovered ?? (() => true),
        at,
        startRegions: gs?.startRegions ?? [],
        unit: runtime.poolUnit?.() ?? '',
    }, nodeId, { times });
    if (!plan.ok) return done(plan);
    const source = planSourceFor(panelId);
    for (const hop of plan.hops) {
        dispatcher?.publish?.('user:regionMove', {
            sourceRegion: hop.from, targetRegion: hop.to, exitName: hop.exit, source,
        }, { initialTarget: 'bottom' });
    }
    const label = runtime.node(nodeId)?.name ?? nodeId;
    if (loopMode) {
        let queued = 0;
        let waited = 0;
        for (let k = 0; k < plan.acts; k++) {
            // AN-TIME-2: an early performance is preceded by its `wait` entry (the start gate refuses an early act).
            const w = plan.waits?.[k] ?? 0;
            if (w > 0) {
                const params = waitParamsOf(runtime, nodeId, w);
                if (gs.addCustomAction(WAIT_ACTION, params) === false) break;
                waited += w;
            }
            if (gs.addCustomAction(ACT_ACTION, { nodeId, label, regionName: nodeId }) === false) break;
            queued += 1;
        }
        if (queued < plan.acts) {
            return done({ ...plan, ok: false, code: 'queue-refused', text: `the queue refused the act after ${queued}`, queued });
        }
        return done({ ...plan, queued, waited });
    }
    let performed = 0;
    let stop = null;
    for (let k = 0; k < plan.acts; k++) {
        const r = runtime.actNow(nodeId);
        if (!r.completed) { stop = r; break; }
        performed += 1;
    }
    if (stop) return done({ ...plan, ok: false, code: stop.code ?? 'not-performed', text: stop.text ?? 'not performed', performed });
    return done({ ...plan, performed });
}

/**
 * A `wait` entry's params before node `nodeId`: its length, the node, and the queue row's text
 * ("Wait 1 h (opens 12:00)").
 */
export function waitParamsOf(runtime, nodeId, units) {
    const node = runtime.node(nodeId);
    const opens = node && Number.isFinite(node.from) ? ` (opens ${formatClock(runtime.model, node.from)})` : '';
    const amount = runtime.formatAmount ? runtime.formatAmount(units) : String(units);
    return { nodeId, units, regionName: nodeId, label: `Wait ${amount}${opens}` };
}

/**
 * The click action's descriptor. `deps` minus `dispatcher` (the clicking panel's handles bring theirs: `h.dispatcher`).
 */
export function actClickActionDescriptor(deps) {
    return {
        id: ACT_CLICK_ID,
        owner: ACT_CLICK_OWNER,
        label: 'Perform the node\'s action once (ActionNodes: in Loop mode it queues the route and the act)',
        summary: 'perform once',
        target: 'region',
        kind: 'toggle',
        run: (h, ctx) => performNode({ ...deps, dispatcher: h?.dispatcher ?? deps.dispatcher ?? null,
            gameState: deps.gameState ?? (() => h?.gameState ?? null) }, ctx.regionName, { times: 1, panelId: ctx.panelId }),
    };
}

/**
 * Register the click action while an ActionNodes world is loaded, unregister it otherwise. Idempotent.
 * @returns {boolean} whether it is registered now
 */
export function syncClickAction(deps) {
    const loaded = deps.runtime?.isLoaded?.() === true;
    const held = getClickAction(ACT_CLICK_ID);
    if (loaded && !held) registerClickAction(actClickActionDescriptor(deps));
    else if (!loaded && held) unregisterClickAction(ACT_CLICK_ID);
    return loaded;
}
