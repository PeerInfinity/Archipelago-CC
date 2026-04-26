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

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'maze',
    panelComponentType: 'mazeRoomPanel',
    loadRegionEvent: 'maze:loadRegion',
    supportedFeatures: Object.freeze([
        'logic_gate',
        'door_color',
        'key_color',
    ]),
    deserializeWorld: tileGridDeserializer,

    // Build-time adapters
    generateRegionCore: spatialCore,
    placeFromItems: itemBasedPlacer,
    placeFromRules: ruleGatePlacer,
    extractPathsAndObstacles: tileGridPathExtractor,
    serializeWorld: tileGridSerializer,
});
