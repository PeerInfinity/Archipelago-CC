/**
 * Maze substrate library — registry entry plus a place for any future
 * maze-substrate-specific library data (sprite hints, tile-specific
 * config, etc.).
 *
 * Cross-substrate item / obstacle definitions still live in
 * shared/procgen/library.js (logic_gate, colored keys/doors, etc.)
 * because any substrate could implement them. This file holds only
 * what is genuinely maze-specific.
 *
 * The registry entry composes its build-time adapter slots from
 * shared/procgen/adapterPrimitives.js. The maze "owns" most of the
 * primitive implementations (they live in mazeRoomEngine.js) but the
 * registry entry stays substrate-neutral in shape so any substrate
 * sharing tile-grid semantics can compose the same way.
 *
 * See NewDocs/plans/procedural-generation/procgen-player.md §"Substrate
 * registry" for the runtime fields, and text-adventure-substrate.md
 * §"Substrate registry entry, expanded" for the build-time slots.
 */

import {
    spatialCore,
    itemBasedPlacer,
    ruleGatePlacer,
    tileGridPathExtractor,
    tileGridSerializer,
    tileGridDeserializer,
} from '../shared/procgen/adapterPrimitives.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'maze',
    panelComponentType: 'mazeRoomPanel',
    loadRegionEvent: 'maze:loadRegion',
    supportedFeatures: Object.freeze([
        'logic_gate',
        'colored_doors_and_keys',
        'nesw_exits',
        'region_topology_from_source',
        'arbitrary_ap_locations',
        'arbitrary_location_rules',
        'arbitrary_exit_rules',
    ]),
    deserializeWorld: tileGridDeserializer,

    // Build-time adapters
    generateRegionCore: spatialCore,
    placeFromItems: itemBasedPlacer,
    placeFromRules: ruleGatePlacer,
    extractPathsAndObstacles: tileGridPathExtractor,
    serializeWorld: tileGridSerializer,
});

// Side-effect on import: register the maze substrate so any caller
// that imports this library can immediately dispatch via the registry.
// Idempotent — production also calls register() via mazeRoom/index.js's
// host hook, and tests that want a fresh registry call substrateRegistry
// .clear() in beforeEach. Putting registration here (rather than in
// procgenPipelineEngine.js) avoids a circular import between the
// pipeline engine and the maze library.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
