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
let warehouse = null;

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
        return;
    }
    warehouse = built;
    const startRegion = findStartRegion(rulesJson, playerId, warehouse);
    if (startRegion) publishLoadRegion(startRegion, null);
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
    }

    return () => {
        if (unsubFilesLoaded) { unsubFilesLoaded(); unsubFilesLoaded = null; }
        warehouse = null;
        eventBus = null;
        dispatcher = null;
        logger = null;
    };
}

// Test-only — reset module-scope state between cases.
export function _testOnly_resetModuleState() {
    if (unsubFilesLoaded) { unsubFilesLoaded(); unsubFilesLoaded = null; }
    warehouse = null;
    eventBus = null;
    dispatcher = null;
    logger = null;
}

export function _testOnly_getWarehouse() {
    return warehouse;
}
