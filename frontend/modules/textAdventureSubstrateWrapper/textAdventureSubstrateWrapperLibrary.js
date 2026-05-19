/**
 * Substrate registry entry for the wrapper. Mirrors the existing
 * textAdventureSubstrate's entry (same `id`, same build-time hooks,
 * same loadRegionEvent) but points the panelComponentType at the
 * wrapper's iframe panel.
 *
 * Coexistence: the existing substrate and this wrapper register the
 * same id 'text_adventure'. Whichever module loads first wins; the
 * loser no-ops via the substrateRegistry.has() guard in register().
 * To test the wrapper, disable textAdventureSubstrate in modules.json.
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
    id: 'text_adventure',
    panelComponentType: 'textAdventureSubstrateWrapperPanel',
    loadRegionEvent: 'textAdventure:loadRegion',

    // Mirrors the existing substrate. The wrapper's engine renders
    // location names + clickable exits — no spatial representation
    // for colored_doors_and_keys.
    supportedFeatures: Object.freeze([
        'logic_gate',
        'nesw_exits',
        'region_topology_from_source',
        'arbitrary_ap_locations',
        'arbitrary_location_rules',
        'arbitrary_exit_rules',
    ]),

    // Host-side hook called by procgenPlayer to turn a sidecar into
    // a `world` object. Reused from the host primitives; we don't
    // actually need the tile-grid data in the engine (the bridge
    // ignores it and uses staticData.regions for the full map), but
    // the procgen pipeline still expects deserializeWorld to succeed.
    deserializeWorld: tileGridDeserializer,

    // Phase 2 limitation: the playback bot can't drive iframe-based
    // substrates synchronously. Returning null means the bot no-ops
    // for this substrate. An async-aware refactor of the bot is a
    // separate future project.
    getPlaybackController: () => null,

    // Build-time adapters — same as existing. These run host-side
    // during procgen seed generation.
    generateRegionCore: spatialCore,
    placeFromItems: itemBasedPlacer,
    placeFromRules: ruleGatePlacer,
    extractPathsAndObstacles: tileGridPathExtractor,
    serializeWorld: tileGridSerializer,
});
