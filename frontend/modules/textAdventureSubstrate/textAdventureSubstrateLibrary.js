/**
 * Text Adventure substrate library — registry entry composing
 * adapter primitives. The text-adventure substrate reuses the
 * tile-grid generator / placer / extractor / serializer / deserializer
 * verbatim — its sidecar shape is identical to the maze's. The
 * difference is in the panel: instead of rendering tiles and walls,
 * it renders a textual description of the region with clickable
 * exits (compass-direction labelled) and locations.
 *
 * See NewDocs/plans/procedural-generation/text-adventure-substrate.md
 * §"Text Adventure substrate" for the design.
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
    id: 'text_adventure',
    panelComponentType: 'textAdventureSubstratePanel',
    loadRegionEvent: 'textAdventure:loadRegion',
    supportedFeatures: Object.freeze([
        'logic_gate',
        'door_color',
        'key_color',
    ]),
    deserializeWorld: tileGridDeserializer,

    // Build-time adapters — same as maze. The text panel reads from
    // the same world shape and ignores the tile-grid fields it
    // doesn't render.
    generateRegionCore: spatialCore,
    placeFromItems: itemBasedPlacer,
    placeFromRules: ruleGatePlacer,
    extractPathsAndObstacles: tileGridPathExtractor,
    serializeWorld: tileGridSerializer,
});

// Side-effect on import: register the substrate so the procgen
// pipeline driver can dispatch via the registry. Idempotent — same
// pattern as mazeRoomLibrary.js. See text-adventure-substrate.md
// §"Driver dispatch via the registry" for the rationale.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
