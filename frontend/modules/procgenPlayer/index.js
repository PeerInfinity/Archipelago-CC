/**
 * procgenPlayer — coordinator that routes procgen-emitted regions to
 * their substrate panels. Headless (no UI panel). See
 * NewDocs/plans/procedural-generation/procgen-player.md for the full
 * design.
 *
 * Two responsibilities:
 *   1. On files:jsonLoaded, recognize procgen-shaped rules.json
 *      (presence of preset_sidecars), build a warehouse of
 *      deserialized regions via the substrate registry, and publish
 *      <substrate>:loadRegion for the start region so the substrate's
 *      panel comes up rendering it.
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
let unsubFilesLoaded = null;
let unsubRulesLoaded = null;
let warehouse = null;
// The synthesized initial transition is deferred until
// stateManager:rulesLoaded fires — see handleFilesJsonLoaded /
// handleRulesLoaded for why.
let pendingStartTransition = null;

function publishLoadRegion(regionId, arrivedFrom) {
    if (!warehouse || !eventBus?.publish) return false;
    const entry = warehouse.get(regionId);
    if (!entry || !entry.loadRegionEvent) return false;
    eventBus.publish(entry.loadRegionEvent, {
        region_id: regionId,
        world: entry.world,
        arrivedFrom,
    });
    return true;
}

function handleFilesJsonLoaded(data) {
    const rulesJson = data?.jsonData;
    if (!rulesJson) return;
    const playerId = data?.selectedPlayerId ?? '1';
    const built = buildWarehouse(rulesJson, playerId, substrateRegistry, { logger });
    if (!built) {
        // Not a procgen rules.json — drop any prior warehouse so a
        // stale one can't accidentally answer a later regionMove.
        warehouse = null;
        pendingStartTransition = null;
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
        // arrivedFrom is opaque to the procgen player — just thread
        // the user:regionMove's exitName through. v1 maze ignores it
        // (single entrance per region); v2 substrates will use it to
        // pick which entrance to spawn the player at.
        const arrivedFrom = data?.exitName ? { exit_id: data.exitName } : null;
        publishLoadRegion(target, arrivedFrom);
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
        unsubFilesLoaded = eventBus.subscribe('files:jsonLoaded', handleFilesJsonLoaded);
        unsubRulesLoaded = eventBus.subscribe('stateManager:rulesLoaded', handleRulesLoaded);
    }

    return () => {
        if (unsubFilesLoaded) { unsubFilesLoaded(); unsubFilesLoaded = null; }
        if (unsubRulesLoaded) { unsubRulesLoaded(); unsubRulesLoaded = null; }
        warehouse = null;
        pendingStartTransition = null;
        eventBus = null;
        dispatcher = null;
        logger = null;
    };
}

// Test-only — reset module-scope state between cases.
export function _testOnly_resetModuleState() {
    if (unsubFilesLoaded) { unsubFilesLoaded(); unsubFilesLoaded = null; }
    if (unsubRulesLoaded) { unsubRulesLoaded(); unsubRulesLoaded = null; }
    warehouse = null;
    pendingStartTransition = null;
    eventBus = null;
    dispatcher = null;
    logger = null;
}

export function _testOnly_getWarehouse() {
    return warehouse;
}
