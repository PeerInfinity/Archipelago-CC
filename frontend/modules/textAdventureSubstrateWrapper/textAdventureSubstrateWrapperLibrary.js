/**
 * Substrate registry entry for the wrapper. Mirrors the existing
 * textAdventureSubstrate's entry (same `id`, same build-time hooks,
 * same loadRegionEvent) but points the panelComponentType at the
 * wrapper's iframe panel.
 *
 * Coexistence: the deprecated textAdventureSubstrate and this wrapper
 * register the same id 'text_adventure'. Whichever module loads first
 * wins; the loser no-ops via the substrateRegistry.has() guard in
 * register(). The old module loads first, so enabling BOTH silently
 * hands it the id — and with it a loopSupport that has no
 * record/playback/instant. Every mode config that needs a text
 * adventure should enable this wrapper and leave textAdventureSubstrate
 * disabled; that is already true everywhere except ?mode=textadventure
 * (see textAdventureSubstrate/index.js for what still blocks it).
 */

import {
    spatialCore,
    itemBasedPlacer,
    ruleGatePlacer,
    tileGridPathExtractor,
    tileGridSerializer,
    tileGridDeserializer,
} from '../shared/procgen/adapterPrimitives.js';
import { getPlaybackProxy } from './index.js';

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'text_adventure',
    label: 'Text Adventure',
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

    // Returns the host-side PlaybackProxy when initialize() has run.
    // The proxy publishes textAdventureSubstrateWrapper:control events
    // that the in-iframe playbackBridge subscribes to. Null before
    // initialize() runs (registry callers already handle null).
    getPlaybackController: () => getPlaybackProxy(),

    // Runtime — recording: NONE. The text adventure is the reference
    // COARSE-ONLY substrate (M3b capture contract): it supplies no
    // takeLastRecording, loops owns coarse capture during Record blocks,
    // and Playback runs the block's own interior through the generic
    // executor. Only fine-grained substrates (maze) supply a recorder.

    // Loop-mode capabilities. custom queues stays NO — the customQueue
    // DROPDOWN would duplicate what the loops queue already expresses
    // (user decision, 2026-06-12). Record/Playback are block-mode-driven
    // and gated on the DECLARED record/playback fields (not on
    // customQueues), so the dropdown is untouched. Both are real via the
    // loops-owned coarse path: Record = parked live play + host-side
    // capture into the block interior; Playback = the generic executor
    // over that interior. Declaring record+playback also opts this
    // substrate into the strict loop-mode action gate (M3b).
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove', 'locationCheck', 'explore']),
        manual: true,
        customQueues: false,
        record: true,
        playback: true,
        // instant (M3): a Playback block can drain in one burst — the
        // loops generic executor honors the per-block Instant flag when
        // running the block interior (M3b: no substrate replay involved).
        instant: true,
    }),

    // Cross-substrate sharing: participates in the shared-mana channel
    // (both TA mana legs charge through the resourceChannels helpers).
    sharing: Object.freeze({
        mana: Object.freeze({}),
    }),

    // Build-time adapters — same as existing. These run host-side
    // during procgen seed generation.
    generateRegionCore: spatialCore,
    placeFromItems: itemBasedPlacer,
    placeFromRules: ruleGatePlacer,
    extractPathsAndObstacles: tileGridPathExtractor,
    serializeWorld: tileGridSerializer,
});
