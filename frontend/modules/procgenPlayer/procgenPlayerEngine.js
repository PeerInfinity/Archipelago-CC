/**
 * Procgen player engine — pure helpers for the procgen player module.
 * Headless: no DOM, no eventBus, no module wiring. The thin
 * subscribe-and-route layer lives in index.js.
 *
 * See docs/json/developer/procgen/architecture.md §"Runtime: playing
 * a generated world" for the architecture this implements.
 */

import { startRegionsOf } from '../procgenCore/rulesGraph.js';

/**
 * In-memory store of deserialized regions for the currently-loaded
 * procgen world. Built from rules.json's `preset_sidecars` block.
 *
 * Each entry is { substrate, world, loadRegionEvent } — substrate id
 * for routing decisions, world for the load event payload, and the
 * substrate's eventBus event name so the caller doesn't need to
 * re-look-up the registry to publish.
 */
export class WorldWarehouse {
    constructor() {
        this.regions = new Map();
        this.playerId = null;
    }

    has(regionId) { return this.regions.has(regionId); }
    get(regionId) { return this.regions.get(regionId); }
    keys() { return [...this.regions.keys()]; }
    size() { return this.regions.size; }
    isEmpty() { return this.regions.size === 0; }
    clear() { this.regions.clear(); this.playerId = null; }
}

/**
 * Build a warehouse from a rules.json payload. Returns null when the
 * payload doesn't contain a `preset_sidecars` block for the requested
 * player — i.e. it isn't a procgen-emitted rules.json and the procgen
 * player should stay out of the way.
 *
 * Skips (with a warning) sidecar entries whose substrate isn't in the
 * registry or whose registry entry is missing `deserializeWorld`.
 * That's a defensive log rather than an error so a partial warehouse
 * can still drive the regions whose substrates are wired up.
 */
export function buildWarehouse(rulesJson, playerId, registry, opts = {}) {
    const logger = opts.logger ?? console;
    const sidecars = rulesJson?.preset_sidecars?.[playerId];
    if (!sidecars || typeof sidecars !== 'object') return null;

    // Dataset carriage resolution (jta-synthetic-data-plan §4.1, ruling 4:
    // single-carrier + refs). One region's payload carries the full
    // `jta_dataset` document; every dataset region carries a
    // `jta_dataset_ref {dataset_id, schema_version}`. Regions load in
    // arbitrary order, but the warehouse holds every payload at rules
    // load — so resolve refs here and hand the bridge the full document
    // with ANY region's world.
    const datasetsById = new Map();
    for (const entry of Object.values(sidecars)) {
        const doc = entry?.playable_payload?.jta_dataset;
        if (doc?.dataset_id) datasetsById.set(doc.dataset_id, doc);
    }

    const warehouse = new WorldWarehouse();
    warehouse.playerId = playerId;
    for (const [regionId, entry] of Object.entries(sidecars)) {
        const adapter = registry.get(entry.substrate);
        if (!adapter) {
            logger.warn?.(`procgenPlayer: unknown substrate '${entry.substrate}' for region ${regionId}; skipping`);
            continue;
        }
        if (typeof adapter.deserializeWorld !== 'function') {
            logger.warn?.(`procgenPlayer: substrate '${entry.substrate}' has no deserializeWorld; skipping ${regionId}`);
            continue;
        }
        let payload = entry.playable_payload;
        const ref = payload?.jta_dataset_ref;
        if (ref && !payload.jta_dataset) {
            const doc = datasetsById.get(ref.dataset_id);
            if (doc) {
                payload = { ...payload, jta_dataset: doc };
            } else {
                logger.warn?.(`procgenPlayer: region ${regionId} references dataset `
                    + `'${ref.dataset_id}' but no sidecar carries it`);
            }
        }
        warehouse.regions.set(regionId, {
            substrate: entry.substrate,
            world: adapter.deserializeWorld(payload),
            loadRegionEvent: adapter.loadRegionEvent,
        });
    }
    return warehouse;
}

/**
 * Identify how to transition into the procgen world on initial load.
 *
 * Returns the structured shape needed to synthesize a
 * `user:regionMove` event that leaves gameState in a consistent
 * state:
 *
 *   { region, sourceRegion, exitName }
 *
 * `region` is the warehoused region to actually load. `sourceRegion`
 * is the AP-side declared start (e.g. 'Menu') — null when the start
 * region has its own sidecar directly and there's no indirection.
 * `exitName` is the exit the transition uses, or null.
 *
 * Walks `start_regions[playerId]` (handling both array and object
 * `{default: [...]}` shapes per AP convention). If the named start
 * region has its own sidecar it's the answer directly. Otherwise
 * it's a synthetic AP region (e.g. 'Menu') and we follow its first
 * matching exit's connected_region into the warehouse.
 *
 * Returns null when no warehoused region can be reached from the
 * declared start.
 */
export function findStartRegion(rulesJson, playerId, warehouse) {
    // ⛓ Both start_regions shapes, through the ONE reader (procgenCore/rulesGraph).
    const [startName] = startRegionsOf(rulesJson, playerId).default;
    if (!startName) return null;
    if (warehouse.has(startName)) {
        return { region: startName, sourceRegion: null, exitName: null };
    }

    const regionDef = rulesJson?.regions?.[playerId]?.[startName];
    for (const exit of regionDef?.exits ?? []) {
        if (exit?.connected_region && warehouse.has(exit.connected_region)) {
            return {
                region: exit.connected_region,
                sourceRegion: startName,
                exitName: exit.name ?? null,
            };
        }
    }
    return null;
}
