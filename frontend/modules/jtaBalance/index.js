/**
 * jtaBalance — headless host module (Phase 3e).
 *
 * Wires the Pass-B balance solve into the running app. On
 * `stateManager:rulesLoaded`, if the loaded world is a procgen jta world (any
 * preset_sidecars payload carries `ap_locations`), it:
 *
 *   1. checks `moduleSettings.jtaBalance.enabled` (default ON) — dormant if off;
 *   2. keys a localStorage cache by seed (plus dataset_id for synthetic-dataset
 *      worlds). On a cache HIT it merges the cached cost patches into the
 *      procgenPlayer warehouse and spawns NO worker;
 *   3. on a miss, waits for sphereState to load the sphere log, runs
 *      `runBalancePass` in a Web Worker against the fork's committed build,
 *      caches the resulting cost patches, and merges them. Synthetic-dataset
 *      worlds (Phase 5e) ship their dataset document to the worker, which
 *      loadGameData's it before the walk; identity constants (perk item
 *      names, suppression sentinel) come from the dataset instead of the
 *      vanilla snapshot.
 *
 * MERGE POINT: each jta region's world object in the procgenPlayer warehouse
 * carries a `task_patches` array (grant-suppression `{id, perk}` patches). The
 * bridge applies `world.task_patches` via `window.applyTaskPatches` every time
 * it loads a region (jtaSubstrateWrapper/bridge.js `_applyTaskPatches`, ~L541).
 * We extend that same array with the solved `{id, cost_multiplier}` patches, so
 * the existing bridge path applies costs and grant-suppression together on the
 * next region load. No new bridge channel.
 *
 * KNOWN RACE (documented): a cache-miss solve completes ~seconds after
 * rulesLoaded. If the player is ALREADY inside a jta region when it finishes,
 * the bridge has already applied the pre-solve `task_patches`; the new cost
 * patches take effect only on the NEXT region entry (or after a reload, which
 * hits the cache before the first region loads). There is no clean existing
 * channel to re-apply patches to a live iframe without re-loading the region
 * (which would reset the zone), so this is left as a documented limitation
 * rather than an invented bridge message. The common cases are unaffected: the
 * initial load merges before the (async, postMessage-driven) first region load,
 * and every reload is a cache hit.
 *
 * Completely dormant for non-jta worlds.
 */

import settingsManager from '../../app/core/settingsManager.js';
import { centralRegistry } from '../../app/core/centralRegistry.js';
import { JTA_PERK_ITEM_NAMES } from '../jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js';
import { JTA_PERK_COUNT } from '../jtaSubstrateWrapper/vanillaDataset.js';
import {
    detectJtaWorld,
    extractDataset,
    datasetIdentity,
    extractApLocations,
    extractGateCounts,
    extractPerkHolderTaskIds,
    computeSeedName,
    cacheKey,
    partitionPatchesByRegion,
} from './hostGlue.js';

// --- Module info ------------------------------------------------------------
export const moduleInfo = {
    name: 'jtaBalance',
    description: 'Headless Pass-B balance solve: costs jta AP-location tasks at rules load and patches the warehouse.',
    // Ordered after the modules it reads from: warehouse (procgenPlayer),
    // sphere log (sphereState), rules payload (stateManager).
    requires: ['stateManager', 'procgenPlayer', 'sphereState'],
    // NO componentType — headless, no panel.
};

const ENABLED_SETTING_KEY = 'moduleSettings.jtaBalance.enabled';

let moduleId = 'jtaBalance';
let moduleEventBus = null;
// The last-loaded rules doc, cached from stateManager:rawJsonDataLoaded. The
// getLastRawJsonData() pull is NOT equivalent: it only updates on the
// files:jsonLoaded path, so rules loaded any other way (e.g. the test
// harness's loadRulesFromFile) leave it stale at the app's initial preset —
// procgenPlayer caches from the push event for the same reason.
let lastRulesDoc = null;
let worker = null;
// A jta solve awaiting the sphere log for the current seed, or null.
let pendingSolve = null;
// Guards against spawning a second worker (dataLoaded can fire more than once).
let running = false;

function log(level, message, ...data) {
    if (typeof window !== 'undefined' && window.logger) {
        window.logger[level]?.(moduleId, message, ...data);
    } else {
        (console[level] || console.log)(`[${moduleId}] ${message}`, ...data);
    }
}

// --- Warehouse merge --------------------------------------------------------

/** The live procgenPlayer warehouse, or null when none is loaded. */
function getWarehouse() {
    return centralRegistry.getPublicFunction?.('procgenPlayer', 'getWarehouse')?.() ?? null;
}

/**
 * Extend each jta region's `world.task_patches` with the cost patches whose
 * task id belongs to that region (per the region's own `ap_locations`).
 * Idempotent: any prior cost_multiplier patch for those ids is replaced, while
 * grant-suppression (`perk`) patches are left intact. Returns the number of
 * patches merged, or -1 when no warehouse is available.
 */
function mergePatchesIntoWarehouse(patches) {
    const warehouse = getWarehouse();
    if (!warehouse || typeof warehouse.keys !== 'function') return -1;

    const regionTaskIds = [];
    for (const regionId of warehouse.keys()) {
        const entry = warehouse.get(regionId);
        if (entry?.substrate !== 'jta') continue;
        const apLocations = entry.world?.ap_locations ?? {};
        regionTaskIds.push({
            regionId,
            entry,
            taskIds: new Set(Object.keys(apLocations).map(Number)),
        });
    }
    if (!regionTaskIds.length) return 0;

    const byRegion = partitionPatchesByRegion(
        patches,
        regionTaskIds.map(({ regionId, taskIds }) => ({ regionId, taskIds })),
    );

    let merged = 0;
    for (const { regionId, entry, taskIds } of regionTaskIds) {
        const regionPatches = byRegion.get(regionId) ?? [];
        if (!regionPatches.length) continue;
        const world = entry.world;
        const existing = Array.isArray(world.task_patches) ? world.task_patches : [];
        // Drop any prior cost patch for these ids (idempotent re-merge), keep
        // everything else (notably the grant-suppression `perk` patches).
        const kept = existing.filter(
            (p) => !(taskIds.has(p.id) && Object.prototype.hasOwnProperty.call(p, 'cost_multiplier')),
        );
        world.task_patches = kept.concat(regionPatches);
        merged += regionPatches.length;
    }
    return merged;
}

// --- Sphere log (from sphereState, embedded-first-then-file already resolved) -

/**
 * The raw sphere-log entries sphereState loaded for the current world. Uses the
 * module's `getRawSphereLog` public function (embedded-first-then-file is
 * handled inside sphereState); returns [] when none is available yet.
 */
function getSphereLog() {
    const fn = centralRegistry.getPublicFunction?.('sphereState', 'getRawSphereLog');
    const entries = fn?.();
    return Array.isArray(entries) ? entries : [];
}

// --- Worker orchestration ---------------------------------------------------

function resolveWorkerUrl() {
    // Mirror stateManagerProxy.initializeWorker: in bundled mode import.meta.url
    // points into dist/, so resolve relative to the page; unbundled resolves
    // relative to this module. Either way the worker loads from its source
    // location, where its sibling imports + the fork build resolve.
    const isBundled = import.meta.url.includes('/dist/');
    return isBundled
        ? new URL('./modules/jtaBalance/balanceWorker.js', window.location.href)
        : new URL('./balanceWorker.js', import.meta.url);
}

function triggerSolve(solve) {
    if (running || !solve) return;
    const sphereLog = getSphereLog();
    if (!sphereLog.length) {
        // sphereState hasn't loaded the log yet — wait for sphereState:dataLoaded.
        log('info', 'sphere log not ready; deferring balance solve');
        return;
    }
    running = true;
    log('info', `starting Pass-B balance solve (seed ${solve.seed}, ${Object.keys(solve.apLocations).length} locations`
        + (solve.dataset ? `, dataset ${solve.dataset.dataset_id})` : ')'));

    try {
        worker = new Worker(resolveWorkerUrl(), { type: 'module' });
    } catch (err) {
        log('error', 'failed to spawn balance worker:', err?.message ?? err);
        running = false;
        return;
    }

    const cleanup = () => {
        if (worker) { worker.terminate(); worker = null; }
        running = false;
        pendingSolve = null;
    };

    worker.onmessage = (event) => {
        const msg = event?.data;
        if (!msg) return;
        if (msg.type === 'progress') {
            log('debug', `balance progress: entry ${msg.entry}/${msg.total} (run ${msg.run})`);
            return;
        }
        if (msg.ok) {
            const patches = msg.patches ?? [];
            try {
                localStorage.setItem(solve.key, JSON.stringify(patches));
            } catch (err) {
                log('warn', 'could not cache balance patches:', err?.message ?? err);
            }
            const merged = mergePatchesIntoWarehouse(patches);
            log('info', `balance solve complete: ${patches.length} cost patches, ${merged} merged into warehouse`
                + (merged > 0 ? ' (applies on next jta region entry if already in one)' : ''));
        } else {
            log('warn', `balance solve failed: ${msg.error}`);
        }
        cleanup();
    };

    worker.onerror = (err) => {
        log('error', 'balance worker error:', err?.message ?? err);
        cleanup();
    };

    worker.postMessage({
        apLocations: solve.apLocations,
        gateCounts: solve.gateCounts,
        sphereLog,
        playerId: solve.playerId,
        perkItemNames: solve.identity.perkItemNames,
        perkCountSentinel: solve.identity.perkCountSentinel,
        perkHolderTaskIds: solve.perkHolderTaskIds,
        dataset: solve.dataset ?? null,
        seed: solve.seed,
        options: {},
    });
}

// --- Event handlers ---------------------------------------------------------

async function handleRulesLoaded() {
    // A new world supersedes any in-flight solve for the previous one.
    if (worker) { worker.terminate(); worker = null; }
    running = false;
    pendingSolve = null;

    const enabled = await settingsManager.getSetting(ENABLED_SETTING_KEY, true);
    if (enabled === false) {
        log('debug', 'disabled via moduleSettings.jtaBalance.enabled; dormant');
        return;
    }

    const rulesDoc = lastRulesDoc;
    if (!rulesDoc) return;

    const { isJta, playerId } = detectJtaWorld(rulesDoc);
    if (!isJta) return; // dormant for non-jta worlds

    // Synthetic-dataset carriage (Phase 5e). A ref with no resolvable
    // document means the carriage is broken — the bridge refuses those
    // region loads too; solving vanilla tables against dataset task ids
    // would cache garbage, so stay out.
    const { dataset, ref } = extractDataset(rulesDoc, playerId);
    if (ref && !dataset) {
        log('warn', `world references dataset '${ref.dataset_id}' but no sidecar carries it; skipping balance solve`);
        return;
    }

    const apLocations = extractApLocations(rulesDoc, playerId);
    const gateCounts = extractGateCounts(rulesDoc, playerId, apLocations);
    // Identity constants come from the dataset when the world carries one
    // (Phase 5e): its placed-perk names and its perk count are the AP item
    // surface / suppression sentinel the walk must use — the vanilla
    // constants belong to different tables. Perk HOLDER ids (tasks whose own
    // location holds a perk item) feed the forced perk-category set — the
    // same union the bridge applies in real play (see perkOrigin.js).
    const identity = dataset
        ? datasetIdentity(dataset)
        : { perkItemNames: [...JTA_PERK_ITEM_NAMES], perkCountSentinel: JTA_PERK_COUNT };
    const perkHolderIds = extractPerkHolderTaskIds(
        rulesDoc, playerId, apLocations, identity.perkItemNames);
    const seed = computeSeedName(rulesDoc);
    const key = cacheKey(seed, dataset?.dataset_id ?? null);

    // Cache hit: merge and skip the worker entirely.
    let cached = null;
    try {
        cached = localStorage.getItem(key);
    } catch (err) {
        log('warn', 'could not read balance cache:', err?.message ?? err);
    }
    if (cached) {
        try {
            const patches = JSON.parse(cached);
            const merged = mergePatchesIntoWarehouse(patches);
            log('info', `balance cache hit (seed ${seed}): ${Array.isArray(patches) ? patches.length : 0} patches, ${merged} merged`);
            return;
        } catch (err) {
            log('warn', `balance cache corrupt for seed ${seed}; re-solving:`, err?.message ?? err);
        }
    }

    // Cache miss: solve. Needs the sphere log; trigger now if sphereState
    // already loaded it, else wait for sphereState:dataLoaded.
    pendingSolve = {
        playerId, seed, key, apLocations, gateCounts, dataset,
        identity, perkHolderTaskIds: perkHolderIds,
    };
    triggerSolve(pendingSolve);
}

function handleSphereDataLoaded() {
    if (pendingSolve && !running) triggerSolve(pendingSolve);
}

function handleRawJsonLoaded(data) {
    lastRulesDoc = data?.rawJsonData ?? null;
}

// --- Module lifecycle -------------------------------------------------------

export async function register(registrationApi) {
    // Declare the enabled setting so getSetting resolves its schema default
    // (the schema is the single default source).
    if (typeof registrationApi.registerSettingsSchema === 'function') {
        registrationApi.registerSettingsSchema({
            enabled: {
                type: 'boolean',
                default: true,
                description: 'Run the Pass-B balance solve at rules load for procgen jta worlds.',
            },
        });
    }
}

export async function initialize(mId, priorityIndex, initializationApi) {
    moduleId = mId;
    moduleEventBus = initializationApi.getEventBus();

    if (moduleEventBus) {
        // rawJsonDataLoaded fires BEFORE rulesLoaded (procgenPlayer's
        // deferral relies on the same ordering), so the doc is fresh when
        // the rulesLoaded handler runs.
        moduleEventBus.subscribe('stateManager:rawJsonDataLoaded', handleRawJsonLoaded);
        moduleEventBus.subscribe('stateManager:rulesLoaded', handleRulesLoaded);
        moduleEventBus.subscribe('sphereState:dataLoaded', handleSphereDataLoaded);
    }
    log('info', `initialized (priority ${priorityIndex})`);

    return () => {
        if (worker) { worker.terminate(); worker = null; }
        running = false;
        pendingSolve = null;
        moduleEventBus = null;
    };
}
