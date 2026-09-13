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
 * adventure enables this wrapper and leaves textAdventureSubstrate
 * disabled; as of 2026-07-26 that is true of ALL of them, so nothing
 * reaches the deprecated entry any more.
 */

import {
    generateTextAdventureRoom,
    placeTextAdventureItems,
    placeTextAdventureRules,
    extractTextAdventureRules,
    serializeTextAdventureRoom,
    deserializeTextAdventureRoom,
    TEXT_ADVENTURE_SIDECAR_FIELDS,
    TEXT_ADVENTURE_EXIT_SIDES,
    textAdventureApLocationNames,
} from './textAdventureRoom.js';
import { REGION_GEOMETRY } from '../procgenCore/regionGeometry.js';
import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { getPlaybackProxy } from './index.js';
import { drawTextAdventureCompositeRegion } from './textAdventureCompositeMap.js';
import { textAdventureRegionRoundTrip } from './textAdventureRegionRoundTrip.js';
import { envelopeExitNames } from '../procgenCore/sidecarFields.js';

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
    // a `world` object — the text adventure's own ROOM (⛓ G2a,
    // `textAdventureRoom.js`): its sided exits, their gates and its
    // locations. The bridge still builds the rooms it renders from
    // staticData.regions.
    deserializeWorld: deserializeTextAdventureRoom,

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

    /**
     * ⛓⛓ APWORLD EDITOR HUB H3 — **THE COMPOSITE-MAP DECLARATION** (⚖ user:
     * map rendering is declared per substrate, never hardcoded). The painter
     * that used to be `procgenPipelineUI.js`'s `hint === 'text_adventure'`
     * branch; see `textAdventureCompositeMap.js` and the maze's twin in
     * `mazeRoom/mazeRoomLibrary.js`. DATA, so this library stays
     * node-importable.
     */
    compositeMap: Object.freeze({ drawRegion: drawTextAdventureCompositeRegion }),

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

    // ⛓⛓ PRESET SIDECARS G2a (Route P, ⚖ user 2026-09-13) — the build-time
    // adapters are the text adventure's OWN (`textAdventureRoom.js`): a room
    // of exits on their SIDES and locations, every rule AUTHORED, no tiles and
    // no rng draw. They run host-side during procgen seed generation, on every
    // driver's procedural branch (top-down, sphere, spiral, grid-growth).
    regionGeometry: REGION_GEOMETRY.SIDES,
    generateRegionCore: generateTextAdventureRoom,
    placeFromItems: placeTextAdventureItems,
    placeFromRules: placeTextAdventureRules,
    extractPathsAndObstacles: extractTextAdventureRules,
    serializeWorld: serializeTextAdventureRoom,
    // ⛓⛓ PRESET SIDECARS G2a — the payload is the text adventure's OWN
    // (`textAdventureRoom.js`): its declaration, its AP location names, and
    // what else it keys by a side (nothing: `keys: []`, the identity relabel).
    // Until G2a all three were the maze's.
    sidecarFields: TEXT_ADVENTURE_SIDECAR_FIELDS,
    apLocationNamesOf: textAdventureApLocationNames,
    exitSides: TEXT_ADVENTURE_EXIT_SIDES,
    // ⛓⛓ PRESET SIDECARS G2b-1 — the document ⇄ room round trip the hub's
    // `Re-derive rules ▸` needs (`textAdventureRegionRoundTrip.js`). ⛔ Edit ▸
    // also needs a `roomEditor`, which this entry does not declare: that door
    // stays disabled by name.
    regionRoundTrip: textAdventureRegionRoundTrip,
    apExitNamesOf: envelopeExitNames,
});

// Side-effect on import: register the substrate, matching mazeRoomLibrary.js,
// bounceDemoLibrary.js and runnerDemoLibrary.js — "substrate libraries register
// their adapters on import" is the house contract the headless procgen scripts
// rely on (scripts/procgen/*.js, scripts/utils/generate-topdown-preset.js,
// procgenPipelineEngine.test.js). Those are a SEPARATE BOOT CONTEXT from the
// app: nothing calls this module's register() there, so without this block the
// scripts would build worlds with no text_adventure substrate registered —
// silently, since a missing substrate is a skipped region, not an error.
//
// This library was the only substrate library lacking it, which went unnoticed
// while the deprecated textAdventureSubstrate's own side effect covered those
// scripts. Idempotent: index.js's register() is guarded by the same has() check.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
