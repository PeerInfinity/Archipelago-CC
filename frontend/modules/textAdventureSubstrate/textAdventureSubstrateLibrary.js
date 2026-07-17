/**
 * Text Adventure substrate library — registry entry composing
 * adapter primitives. The text-adventure substrate reuses the
 * tile-grid generator / placer / extractor / serializer / deserializer
 * verbatim — its sidecar shape is identical to the maze's. The
 * difference is in the panel: instead of rendering tiles and walls,
 * it renders a textual description of the region with clickable
 * exits (compass-direction labelled) and locations.
 *
 * See docs/json/developer/procgen/text-adventure.md.
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
import { getPanelInstance } from './index.js';

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'text_adventure',
    panelComponentType: 'textAdventureSubstratePanel',
    loadRegionEvent: 'textAdventure:loadRegion',
    // colored_doors_and_keys deliberately omitted: the panel renders
    // location names and compass-direction exits but has no visual
    // representation for doors. Items in the inventory are still
    // visible globally; the substrate just can't realize colored
    // doors as in-world obstacles.
    supportedFeatures: Object.freeze([
        'logic_gate',
        'nesw_exits',
        'region_topology_from_source',
        'arbitrary_ap_locations',
        'arbitrary_location_rules',
        'arbitrary_exit_rules',
    ]),
    deserializeWorld: tileGridDeserializer,

    // Runtime — playback. Returns the live panel's controller (own
    // setInterval clock + walkTo queue) so the bot can drive
    // text-adventure regions one click per tick. null when no panel
    // is mounted.
    getPlaybackController: () => getPanelInstance()?.getPlaybackController?.() ?? null,

    // Loop-mode capabilities — mirrors the wrapper entry (same id,
    // whichever registers first wins): manual yes, custom queues no.
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove', 'locationCheck', 'explore']),
        manual: true,
        customQueues: false,
    }),

    // Cross-substrate sharing: participates in the shared-mana channel
    // (both TA mana legs charge through the resourceChannels helpers).
    sharing: Object.freeze({
        mana: Object.freeze({}),
    }),

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
