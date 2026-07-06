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

export const moduleInfo = {
    name: 'procgenPlayer',
    description: 'Coordinator that routes procgen-emitted regions to their substrate panels.',
    requires: ['gameState'],
};

let eventBus = null;
let dispatcher = null;
let logger = null;
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

function publishLoadRegion(regionId, arrivedFrom) {
    if (!warehouse || !eventBus?.publish) return false;
    const entry = warehouse.get(regionId);
    if (!entry || !entry.loadRegionEvent) return false;
    eventBus.publish(entry.loadRegionEvent, {
        region_id: regionId,
        world: entry.world,
        arrivedFrom,
    });
    publishActiveSubstrateChanged(regionId);
    return true;
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
    // Cache the resolved start so substrate-driven loop resets can
    // teleport the player to the first real region (skipping the
    // synthetic Menu wrapper, which has no playable payload).
    resolvedStartRegion = pendingStartTransition?.region ?? null;
}

function handleRulesLoaded() {
    if (!pendingStartTransition || !dispatcher?.publish) return;
    // Synthesize a user:regionMove for the "Menu -> first real
    // region" transition. This keeps gameState's path +
    // currentRegion in sync with what the maze is rendering, and
    // collapses initial-load + subsequent-transition into a single
    // code path — this module's own handleRegionMove does the
    // actual loadRegion publish when the event circulates back
    // through the dispatcher chain.
    dispatcher.publish('user:regionMove', {
        sourceRegion: pendingStartTransition.sourceRegion,
        targetRegion: pendingStartTransition.region,
        exitName: pendingStartTransition.exitName,
    }, { initialTarget: 'bottom' });
    pendingStartTransition = null;
}

function handleRegionMove(data) {
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
        const arrivedFrom = arrivedExitId ? { exit_id: arrivedExitId } : null;
        publishLoadRegion(target, arrivedFrom);
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
                return {
                    substrate: entry.substrate,
                    label: registryEntry?.label ?? entry.substrate ?? null,
                    manaEnabled: entry.world?.manaEnabled === true,
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
    }
}

export function initialize(moduleId, priorityIndex, initializationApi) {
    eventBus = initializationApi.getEventBus();
    dispatcher = initializationApi.getDispatcher();
    logger = initializationApi.getLogger?.() ?? null;

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
        activeSubstrate = null;
        eventBus = null;
        dispatcher = null;
        logger = null;
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
    activeSubstrate = null;
    eventBus = null;
    dispatcher = null;
    logger = null;
}

export function _testOnly_getWarehouse() {
    return warehouse;
}
