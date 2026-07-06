/**
 * Substrate registry entry for JtA as a loop-mode substrate.
 *
 * v1 scope: each Archipelago region = one JtA zone. The procgen
 * region graph drives transitions; jta:loadRegion tells the panel
 * which zone to render. v1 does not surface AP location checks
 * inside regions and does not contribute build-time procgen hooks —
 * the sidecar carries the per-region `jtaZone` mapping and the
 * substrate just renders the corresponding zone.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

// Host-side PlaybackProxy, injected by index.js's initialize() once the
// eventBus exists (setter injection rather than importing index.js so
// this library stays headless-import-safe — Node unit tests import it
// without the panel/gameState graph). Null until then; registry callers
// treat null as "no controller available" and no-op.
let _playbackProxy = null;
export function setPlaybackProxy(proxy) { _playbackProxy = proxy; }

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'jta',
    label: 'JtA',
    panelComponentType: 'jtaSubstrateWrapperPanel',
    loadRegionEvent: 'jta:loadRegion',

    // The panel's iframe announces this id (jtaSubstrateWrapperPanel
    // appends ?iframeId=jtaSubstrateWrapper to the iframe src).
    // procgenPlayer re-publishes the active region's loadRegionEvent
    // when this iframe reports appReady, so a page/panel reload while
    // standing in a jta region re-delivers jta:loadRegion to the
    // freshly booted bridge (same catch-up the flash family uses).
    iframeId: 'jtaSubstrateWrapper',

    // Completion-condition item emission paths use this when a jta
    // world's scenario pool contributes no is_victory item; without it
    // an emitted world has no goal and is "beaten" at sphere 0. Same
    // name bounce and runner declare (VICTORY_ITEM_NAME).
    victoryItem: 'Victory',

    // v1: no AP location checks inside regions, no logic gates, no
    // spatial topology. The supported-feature set is intentionally
    // minimal — extended in later phases as features are added.
    supportedFeatures: Object.freeze([
        'region_topology_from_source',
    ]),

    // procgenPlayer passes the sidecar entry's `playable_payload` (not
    // the whole sidecar) to this function. The bridge then reads
    // `world.jtaZone` directly. Expected payload shape for a jta
    // region:
    //   { jtaZone: <number>, exits: [...], ... }
    //
    // Exits are converted from the on-disk array form into a Map
    // keyed by exitName — same shape mazeRoom's deserializer uses —
    // because procgenPlayer.handleRegionMove calls
    // sourceWorld.exits.has(exitName) when resolving the targetExitId
    // for a region transition. Leaving exits as an array breaks that
    // lookup with "exits.has is not a function".
    deserializeWorld: (payload) => {
        const p = payload ?? {};
        const exitsArray = Array.isArray(p.exits) ? p.exits : [];
        const exitsMap = new Map();
        for (const e of exitsArray) {
            const key = e?.exitName ?? e?.exit_id;
            if (key) exitsMap.set(key, e);
        }
        return { ...p, exits: exitsMap };
    },

    // Inverse of deserializeWorld for write-to-disk. buildPresetSidecars
    // invokes this on every region during preset emission; without it
    // jta regions emitted by a procgen layout driver (e.g.
    // arrangeShuffledSpiral) would fail at sidecar build time. Only
    // the runtime-Map exits field needs special handling — everything
    // else round-trips as-is.
    serializeWorld: (world) => {
        const w = world ?? {};
        const exitsArray = w.exits instanceof Map
            ? [...w.exits.values()]
            : (Array.isArray(w.exits) ? w.exits : []);
        return { ...w, exits: exitsArray };
    },

    // Host-side proxy publishing jta:playbackControl events that the
    // in-iframe bridge executes (play/stop → resume/pause the game
    // clock, step → stepTick, instant → setInstantMode, reset →
    // doEnergyReset, walkTo(exit) → drive mandatory+travel tasks then
    // take the requested exit). Null before index.js initializes.
    getPlaybackController: () => _playbackProxy,

    // Loop-mode capabilities. executeVia makes the loops queue drive
    // regionMove actions through the PlaybackController's walkTo (the
    // queue parks until the resulting user:regionMove arrives) instead
    // of the generic progress timer. Custom queues are wanted
    // eventually but jta has no queue recording yet — flip
    // customQueues when that lands. No locations / explore in v1
    // regions, so regionMove is the only queueable action.
    loopSupport: Object.freeze({
        queueActions: Object.freeze(['regionMove']),
        manual: true,
        customQueues: false,
        executeVia: 'playbackBot',
    }),

    // Build-time hooks (generateRegionCore / placeFromItems / etc.)
    // are omitted in v1 — procgen does not generate JtA-specific
    // region content; it just records `jtaZone` in the sidecar.
    //
    // --- Zone-based substrate metadata ---
    //
    // Layout drivers that map grid positions to ordered "zones"
    // (currently arrangeShuffledSpiral) read these two fields:
    //   - zoneCount: how many discrete zones this substrate exposes.
    //     Drivers refuse to allocate more than this many regions to
    //     the substrate.
    //   - synthesizeZonePayload(zoneIdx): returns a playable_payload
    //     fragment for the Nth zone. The driver merges this with the
    //     layout's own fields (exits, etc.) before stamping the
    //     sidecar.
    //
    // Total zone count is owned by the JtA build in the
    // frontend/modules/journey-to-ascension submodule (build/zones.js
    // — the copy the panel actually loads). Kept in sync by hand; if
    // it drifts the runtime warns on loadZone and refuses the bad
    // index. 30 as of Fork 1.6.
    zoneCount: 30,
    synthesizeZonePayload: (zoneIdx) => ({ jtaZone: zoneIdx }),
});

// Side-effect on import: register the JtA substrate so the procgen
// pipeline can resolve it without booting the panel module. Same
// pattern as mazeRoom/textAdventureSubstrate libraries — idempotent
// because index.js's host hook also calls register() in the live app.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
