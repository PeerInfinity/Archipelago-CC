/**
 * procgenPlayer — coordinator that routes procgen-emitted regions to
 * their substrate panels. Headless (no UI panel). See
 * docs/json/developer/procgen/architecture.md §"Runtime: playing a
 * generated world".
 *
 * Two responsibilities:
 *   1. On stateManager:rawJsonDataLoaded, recognize procgen-shaped
 *      rules.json (presence of preset_sidecars), build a warehouse
 *      of deserialized regions via the substrate registry, and
 *      publish <substrate>:loadRegion for the start region so the
 *      substrate's panel comes up rendering it.
 *      We listen to rawJsonDataLoaded rather than files:jsonLoaded
 *      because the former covers BOTH load paths: the Presets-panel
 *      flow (where files:jsonLoaded fires and stateManager re-emits
 *      rawJsonDataLoaded), and the URL-load init flow (?game=... ;
 *      stateManager loads rules during postInitialize and publishes
 *      rawJsonDataLoaded directly, never publishing files:jsonLoaded).
 *   2. As a dispatcher receiver for user:regionMove, look up the
 *      target region in the warehouse and publish the corresponding
 *      <substrate>:loadRegion before forwarding the event up the
 *      chain. The forward is what lets gameState (and any future
 *      interceptor like a re-enabled MetaGame) keep processing the
 *      transition normally.
 *
 * Inventory and gameplay state continue to live where they belong
 * (stateManager + gameState + the substrate panel's own state). The
 * procgen player itself owns only the multi-region world warehouse.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { buildWarehouse, findStartRegion } from './procgenPlayerEngine.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { SKIP_MENU_DEFAULT, skipsStart } from '../menuPanel/menuPanelEngine.js';

export const moduleInfo = {
    name: 'procgenPlayer',
    description: 'Coordinator that routes procgen-emitted regions to their substrate panels.',
    requires: ['gameState'],
};

let eventBus = null;
let dispatcher = null;
let logger = null;
let gateSubstrateAction = null;
// menuPanel.isSkipMenuEnabled — read at rules-load time, not cached as a
// boolean, so the checkbox's value at the moment of the load is what counts.
let getSkipMenuEnabled = null;
// The loaded document and player, kept for that rule at rules-load time.
let startDoc = null;
let startPlayerId = null;
let unsubRawJsonLoaded = null;
let unsubRulesLoaded = null;
let unsubIframeAppReady = null;
let warehouse = null;
// The synthesized initial transition is deferred until
// stateManager:rulesLoaded fires — see handleFilesJsonLoaded /
// handleRulesLoaded for why.
let pendingStartTransition = null;
// Resolved start region — the warehoused region findStartRegion picked
// (e.g. the first real region after a synthetic 'Menu'). Cached here
// so substrate-driven loop resets can teleport directly to it.
let resolvedStartRegion = null;
// The start HOP itself (`findStartRegion`'s `{region, sourceRegion,
// exitName}`), kept past the load: `retakeStartHop` re-publishes it, and a
// move along it is marked `startHop` on the substrate's loadRegion.
let startHop = null;
// Last-broadcast active substrate. Cached so late-mounted substrate
// panels can query getActiveSubstrate() at mount time — the eventBus
// has no replay semantics for late subscribers.
let activeSubstrate = null;

function buildActiveSubstratePayload(regionId) {
    if (!warehouse || !regionId) return null;
    const entry = warehouse.get(regionId);
    if (!entry) return null;
    const registryEntry = entry.substrate ? substrateRegistry.get(entry.substrate) : null;
    if (!registryEntry || !registryEntry.panelComponentType) return null;
    return {
        substrate: entry.substrate,
        componentType: registryEntry.panelComponentType,
        label: registryEntry.label ?? entry.substrate,
        regionId,
    };
}

function publishActiveSubstrateChanged(regionId) {
    const payload = buildActiveSubstratePayload(regionId);
    activeSubstrate = payload;
    if (eventBus?.publish) {
        eventBus.publish('procgen:activeSubstrateChanged', payload);
    }
}

function publishLoadRegion(regionId, arrivedFrom, marks = null) {
    if (!warehouse || !eventBus?.publish) return false;
    const entry = warehouse.get(regionId);
    if (!entry || !entry.loadRegionEvent) return false;
    eventBus.publish(entry.loadRegionEvent, {
        region_id: regionId,
        world: entry.world,
        arrivedFrom,
        // ⛓ ADDITIVE (`startHop`, `restart`): see handleRegionMove.
        ...(marks ?? {}),
    });
    publishActiveSubstrateChanged(regionId);
    return true;
}

/**
 * The "skip the menu" setting, owned by `menuPanel`. Defaults to the schema
 * default when that module is not loaded — which is this module's pre-M1
 * behaviour (always hop), so a module set without menuPanel is unchanged.
 */
function isSkipMenuEnabled() {
    const fn = getSkipMenuEnabled
        ?? centralRegistry?.getPublicFunction?.('menuPanel', 'isSkipMenuEnabled');
    if (typeof fn !== 'function') return SKIP_MENU_DEFAULT;
    try {
        return fn() === true;
    } catch {
        return SKIP_MENU_DEFAULT;
    }
}

function handleRawJsonLoaded(data) {
    const rulesJson = data?.rawJsonData;
    if (!rulesJson) return;
    const playerId = data?.selectedPlayerInfo?.playerId ?? '1';
    const built = buildWarehouse(rulesJson, playerId, substrateRegistry, { logger });
    if (!built) {
        // Not a procgen rules.json — drop any prior warehouse so a
        // stale one can't accidentally answer a later regionMove.
        warehouse = null;
        pendingStartTransition = null;
        resolvedStartRegion = null;
        startHop = null;
        activeSubstrate = null;
        if (eventBus?.publish) {
            eventBus.publish('procgen:activeSubstrateChanged', null);
        }
        return;
    }
    warehouse = built;

    // Stash the initial transition. We can't publish user:regionMove
    // yet because stateManager is still processing the rules.json
    // asynchronously — once it finishes it fires
    // stateManager:rulesLoaded, and gameState responds by calling
    // reset() (clearing path, resetting currentRegion to the declared
    // start). A regionMove published before that reset lands would
    // be wiped out. Defer until handleRulesLoaded runs.
    pendingStartTransition = findStartRegion(rulesJson, playerId, warehouse);
    startHop = pendingStartTransition;
    startDoc = rulesJson;
    startPlayerId = playerId;
    // Cache the resolved start so substrate-driven loop resets can
    // teleport the player to the first real region (skipping the
    // synthetic Menu wrapper, which has no playable payload).
    resolvedStartRegion = pendingStartTransition?.region ?? null;
}

function handleRulesLoaded() {
    if (!pendingStartTransition || !dispatcher?.publish) return;
    // "Skip the menu" — ONE setting, TWO publishers. This module owns the hop
    // for a warehoused world; `menuPanel` owns it for every other world and
    // owns the SETTING. Absent menuPanel (a module set without it, a test
    // harness) the answer is the schema default, which is this module's
    // historical unconditional behaviour.
    // ⛓ M2 — a hop OUT of the declared start (`sourceRegion` set: the start is
    // not warehoused) takes `menuPanelEngine.skipsStart`, the ONE rule both
    // publishers read — the setting (through menuPanel's `isSkipMenuEnabled`,
    // as before) AND exactly one exit. A start
    // with several exits is never skipped (menuPanel raises itself). A start
    // that is itself warehoused (`sourceRegion` null) is not left at all — the
    // publish only loads its payload — and keeps the setting alone.
    const skip = pendingStartTransition.sourceRegion
        ? skipsStart(startDoc, startPlayerId, pendingStartTransition.sourceRegion, isSkipMenuEnabled())
        : isSkipMenuEnabled();
    if (!skip) {
        // The player plays the start region. Drop the pending hop —
        // `resolvedStartRegion` deliberately SURVIVES, because loop resets
        // teleport to it whether or not the initial hop was taken.
        pendingStartTransition = null;
        logger?.info?.('[procgenPlayer] the start hop is not taken (skip off, or the start has more than one exit); leaving the player at the declared start');
        return;
    }
    // Synthesize a user:regionMove for the "Menu -> first real
    // region" transition. This keeps gameState's path +
    // currentRegion in sync with what the maze is rendering, and
    // collapses initial-load + subsequent-transition into a single
    // code path — this module's own handleRegionMove does the
    // actual loadRegion publish when the event circulates back
    // through the dispatcher chain.
    // source marks this as a synthesized system placement — exempt from
    // the loop-mode action gate and from the loop-mode path-append
    // retirement (loops/loopModeExemptions.js), so the initial hop
    // behaves identically whether or not loop mode auto-enabled first.
    publishStartHop(pendingStartTransition);
    pendingStartTransition = null;
}

/** The synthesized start hop's `source` (loop-mode exempt — see above). */
export const START_HOP_SOURCE = 'procgenPlayer-start';

/**
 * ⛓ THE ONE PUBLISH OF THE START HOP — the load's (above) and a Restart's
 * (`retakeStartHop`), so the two cannot drift: same source, same exit, same
 * dispatcher shape. `restart: true` is the only addition a Restart makes.
 */
function publishStartHop(hop, { restart = false } = {}) {
    dispatcher.publish('user:regionMove', {
        sourceRegion: hop.sourceRegion,
        targetRegion: hop.region,
        exitName: hop.exitName,
        source: START_HOP_SOURCE,
        ...(restart ? { restart: true } : {}),
    }, { initialTarget: 'bottom' });
}

/**
 * ⛓⛓ **RESTART RE-TAKES THE START HOP** (the Menu panel's Restart on a world
 * whose start region is a substrate that asks for it — today Seedling's two
 * entries, decided by flashPanel, which owns those ids). The Menu panel's
 * Restart lands the player on the DECLARED start (M2, unchanged); where the
 * load would have skipped that start — the ONE rule, `skipsStart`: the setting
 * AND exactly one exit — this takes the same hop the load took, so a Restart
 * ends where a new game begins.
 *
 * Refused BY NAME, never guessed: no warehouse; a start that is itself
 * warehoused (nothing to hop out of); the player not at the declared start
 * (the reset has not landed); the load would not have skipped it.
 *
 * @returns {{taken: boolean, why: string|null, region: string|null}}
 */
export function retakeStartHop() {
    const refuse = (why) => ({ taken: false, why, region: startHop?.region ?? null });
    if (!warehouse || !startHop) return refuse('no procgen start hop is loaded');
    if (!startHop.sourceRegion) return refuse('the start region is itself warehoused — there is no hop to re-take');
    if (!dispatcher?.publish) return refuse('no dispatcher');
    const here = centralRegistry?.getPublicFunction?.('gameState', 'getCurrentRegion')?.() ?? null;
    if (here !== startHop.sourceRegion) {
        return refuse(`the player is at "${here}", not the declared start "${startHop.sourceRegion}"`);
    }
    if (!skipsStart(startDoc, startPlayerId, startHop.sourceRegion, isSkipMenuEnabled())) {
        return refuse('the load does not skip this start (skip off, or more than one exit) — the player stays on the menu');
    }
    publishStartHop(startHop, { restart: true });
    return { taken: true, why: null, region: startHop.region };
}

function handleRegionMove(data) {
    // M3b strict loop-mode action gate. Blocked performed moves are
    // swallowed whole — no substrate loadRegion, no propagation down
    // the chain (gameState never moves the player) — and loops
    // publishes the blocked-click feedback. Queue execution
    // (fromLoop), reset teleports (fromReset), planning sources, and
    // substrates that haven't adopted the block-mode system yet all
    // pass (the exemption matrix lives in loops' evaluateActionGate).
    if (gateSubstrateAction
        && !gateSubstrateAction({ kind: 'move', regionName: data?.sourceRegion ?? null, data })) {
        // warn (not info): a silently-swallowed move is painful to
        // debug, and blocked moves are user-click-bounded.
        logger?.warn?.('[procgenPlayer] user:regionMove blocked by the loop-mode action gate', data);
        return;
    }
    const target = data?.targetRegion;
    if (target && warehouse?.has(target)) {
        // arrivedFrom carries the exit_id IN THE TARGET region that
        // the player arrived at. The dispatcher event's `exitName` is
        // the SOURCE region's exit; resolve to the target's via the
        // source exit's `targetExitId`. Falls back to the source
        // exitName when the source exit doesn't carry the link (e.g.
        // pre-bidirectional sidecars or initial-load synthesized
        // events).
        let arrivedExitId = data?.exitName ?? null;
        const sourceEntry = data?.sourceRegion ? warehouse.get(data.sourceRegion) : null;
        const sourceWorld = sourceEntry?.world;
        if (sourceWorld?.exits && data?.exitName && sourceWorld.exits.has(data.exitName)) {
            const srcExit = sourceWorld.exits.get(data.exitName);
            if (srcExit?.targetExitId) arrivedExitId = srcExit.targetExitId;
        }
        // ⛓ `source_region` rides along (additive — every consumer reads
        // `exit_id` as before): a world whose exits carry no `targetExitId`
        // (the shuffled spiral never links reverse exits) leaves `exit_id` as
        // the SOURCE region's own exit name, which names nothing in the target.
        // The source region is then the only fact that says which of the
        // target's exits the player came through — the one leading back.
        const arrivedFrom = arrivedExitId
            ? { exit_id: arrivedExitId, ...(data?.sourceRegion ? { source_region: data.sourceRegion } : {}) }
            : null;
        // ⛓ `startHop`: this move is the declared start → the resolved start
        // (the load's hop, a Restart's re-take, or the Menu panel's own exit
        // button with skip off) — the arrival a NEW GAME makes, which a
        // substrate may place differently from an ordinary door. `restart`:
        // a Restart re-took it. A start that is itself warehoused has no hop to
        // re-take (`sourceRegion` null), so there the RESET's move into it is
        // the start arrival: `restart` AND `fromReset` (the loop-reset fallback,
        // `flashPanel`'s `handleLoopReset`).
        const isStartHop = target === startHop?.region && (startHop.sourceRegion
            ? data?.sourceRegion === startHop.sourceRegion
            : data?.restart === true && data?.fromReset === true);
        publishLoadRegion(target, arrivedFrom, isStartHop
            ? { startHop: true, ...(data?.restart === true ? { restart: true } : {}) } : null);
    } else if (warehouse) {
        // Target is a region the warehouse doesn't own (e.g. AP-native
        // Menu, or a non-procgen region). No substrate panel is "the
        // right one" — broadcast null so already-mounted substrate
        // panels switch to their no-active-substrate overlay.
        publishActiveSubstrateChanged(null);
    }
    if (dispatcher?.publishToNextModule) {
        dispatcher.publishToNextModule('procgenPlayer', 'user:regionMove', data, { direction: 'up' });
    }
}

export function register(registrationApi) {
    registrationApi.registerDispatcherReceiver(
        'procgenPlayer',
        'user:regionMove',
        handleRegionMove,
        { direction: 'up', condition: 'unconditional', timing: 'immediate' }
    );

    // On initial load we synthesize a user:regionMove ourselves to
    // carry gameState through the Menu -> first real region transition.
    if (typeof registrationApi.registerDispatcherSender === 'function') {
        registrationApi.registerDispatcherSender('user:regionMove', 'bottom', 'first');
    }

    // Broadcast event for substrate panels: which substrate owns the
    // current region, or null if no procgen warehouse is loaded /
    // current region has no substrate. Late subscribers can query
    // getActiveSubstrate() since the eventBus does not replay.
    if (typeof registrationApi.registerEventBusPublisher === 'function') {
        registrationApi.registerEventBusPublisher('procgen:activeSubstrateChanged');
    }

    // Resolved start region — substrates use this for loop-mode
    // teleport-to-start so they target the first warehoused region
    // instead of the synthetic Menu wrapper (which has no payload).
    if (typeof registrationApi.registerPublicFunction === 'function') {
        registrationApi.registerPublicFunction(
            'procgenPlayer',
            'getResolvedStartRegion',
            () => resolvedStartRegion,
        );

        // ⛓ A Restart's re-take of the load's start hop (see retakeStartHop).
        registrationApi.registerPublicFunction('procgenPlayer', 'retakeStartHop', retakeStartHop);

        // Lightweight per-region metadata lookup. Used by the loops
        // module to decide whether to delegate a queue action to the
        // substrate panel (Phase 6: substrate-handled completion).
        // Returns null for regions absent from the warehouse — i.e.
        // synthetic Menu wrappers or non-procgen rules.
        registrationApi.registerPublicFunction(
            'procgenPlayer',
            'getRegionInfo',
            (regionName) => {
                if (!warehouse || !regionName) return null;
                const entry = warehouse.get(regionName);
                if (!entry) return null;
                const registryEntry = entry.substrate
                    ? substrateRegistry.get(entry.substrate)
                    : null;
                const rate = entry.world?.timeDrainPerSecond;
                return {
                    substrate: entry.substrate,
                    label: registryEntry?.label ?? entry.substrate ?? null,
                    manaEnabled: entry.world?.manaEnabled === true,
                    // ⛓ bulletml N5: the drain rate the payload names (Noiz2sa's
                    // priced regions), for the runtime cost planner's write-by-class
                    ...(typeof rate === 'number' && Number.isFinite(rate) && rate > 0
                        ? { timeDrainPerSecond: rate } : {}),
                };
            },
        );

        // Last-broadcast value of procgen:activeSubstrateChanged.
        // Lets late-mounting substrate panels initialize their overlay
        // state without waiting for the next regionMove.
        registrationApi.registerPublicFunction(
            'procgenPlayer',
            'getActiveSubstrate',
            () => activeSubstrate,
        );

        // The live world warehouse, or null when none is loaded. Exposed so
        // headless post-load passes (jtaBalance Pass-B) can read each region's
        // deserialized `world` (ap_locations) and extend its `task_patches`
        // in place — the same object the bridge applies on loadRegion.
        registrationApi.registerPublicFunction(
            'procgenPlayer',
            'getWarehouse',
            () => warehouse,
        );
    }
}

export function initialize(moduleId, priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();
    logger = initializationApi.getLogger?.() ?? null;

    // M3b strict action gate: loops' gate predicate, consulted at the
    // top of handleRegionMove. This module receives user:regionMove
    // BEFORE loops (higher load priority) and is the first receiver
    // with side effects (the substrate loadRegion publish), so the
    // gate must be applied here — a loops-side receiver would fire
    // after the substrate already switched regions. Loops is
    // initialized before this module (lower load priority), so the
    // function is available; absent (loops disabled / test harness)
    // means no gating.
    gateSubstrateAction = initializationApi.getModuleFunction?.('loops', 'gateSubstrateAction') ?? null;

    // menuPanel is a LOWER load priority than this module (it must see the
    // rules-load events after we do), but every module's register() runs before
    // any initialize(), and menuPanel registers this public function there — so
    // the lookup resolves here.
    getSkipMenuEnabled = initializationApi.getModuleFunction?.('menuPanel', 'isSkipMenuEnabled') ?? null;

    // Register as publisher for every substrate's loadRegion event.
    // The substrate registry is populated by all substrates' register()
    // hooks, which run before any module's initialize().
    if (eventBus?.registerPublisher) {
        for (const entry of substrateRegistry.getAll()) {
            if (entry.loadRegionEvent) {
                eventBus.registerPublisher(entry.loadRegionEvent);
            }
        }
    }

    if (eventBus?.subscribe) {
        unsubRawJsonLoaded = eventBus.subscribe('stateManager:rawJsonDataLoaded', handleRawJsonLoaded);
        unsubRulesLoaded = eventBus.subscribe('stateManager:rulesLoaded', handleRulesLoaded);
        // Iframe-hosted substrates can miss the active region's
        // loadRegion: their bridge subscribes only after the iframe
        // page loads + handshakes, which can land AFTER the initial
        // Menu -> start-region transition published it. When an iframe
        // announces ready and it IS the active substrate's iframe
        // (registry entries opt in by declaring `iframeId`), re-publish
        // the current region so the late bridge configures itself.
        // Also covers iframe reloads. Substrates without an iframeId
        // field (maze, textAdventure) are unaffected.
        unsubIframeAppReady = eventBus.subscribe('iframe:appReady', (data) => {
            if (!activeSubstrate?.regionId || !data?.iframeId) return;
            const entry = substrateRegistry.get(activeSubstrate.substrate);
            if (!entry?.iframeId || entry.iframeId !== data.iframeId) return;
            publishLoadRegion(activeSubstrate.regionId, null);
        });
    }

    return () => {
        if (unsubRawJsonLoaded) { unsubRawJsonLoaded(); unsubRawJsonLoaded = null; }
        if (unsubRulesLoaded) { unsubRulesLoaded(); unsubRulesLoaded = null; }
        if (unsubIframeAppReady) { unsubIframeAppReady(); unsubIframeAppReady = null; }
        warehouse = null;
        pendingStartTransition = null;
        resolvedStartRegion = null;
        startHop = null;
        activeSubstrate = null;
        eventBus = null;
        dispatcher = null;
        logger = null;
        gateSubstrateAction = null;
        getSkipMenuEnabled = null;
    };
}

// Test-only — reset module-scope state between cases.
export function _testOnly_resetModuleState() {
    if (unsubRawJsonLoaded) { unsubRawJsonLoaded(); unsubRawJsonLoaded = null; }
    if (unsubRulesLoaded) { unsubRulesLoaded(); unsubRulesLoaded = null; }
    if (unsubIframeAppReady) { unsubIframeAppReady(); unsubIframeAppReady = null; }
    warehouse = null;
    pendingStartTransition = null;
    resolvedStartRegion = null;
    startHop = null;
    activeSubstrate = null;
    eventBus = null;
    dispatcher = null;
    logger = null;
    getSkipMenuEnabled = null;
    startDoc = null;
    startPlayerId = null;
}

export function _testOnly_getWarehouse() {
    return warehouse;
}
