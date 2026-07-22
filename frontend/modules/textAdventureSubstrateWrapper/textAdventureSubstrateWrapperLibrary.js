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
import { getPlaybackProxy } from './index.js';
import { takeLastTextAdventureRecording } from './recorder.js';

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

    // Runtime — recording (M2 loops sole-persister protocol). Pull-and-
    // clear the last finalized visit recording; loops persists it only on
    // a successful Record-mode completion.
    takeLastRecording: () => takeLastTextAdventureRecording(),

    // Loop-mode capabilities. custom queues stays NO — the customQueue
    // DROPDOWN would duplicate what the loops queue already expresses
    // (user decision, 2026-06-12). M2's Record/Playback is a separate,
    // block-mode-driven path gated on the DECLARED record/playback fields
    // (not on customQueues), so the dropdown is untouched. Playback is
    // real: the wrapper drives replayActions over the recorded command
    // list; Record requires Playback, so both are true.
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove', 'locationCheck', 'explore']),
        manual: true,
        customQueues: false,
        record: true,
        playback: true,
        // instant (M3): the wrapper can drain its replay list in one frame
        // (replayActions with instant:true). Enables the per-block Instant
        // toggle for Playback blocks in this substrate.
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
