/**
 * Substrate registry entry for SWFRecomp Flash games as a procgen
 * substrate (one substrate, two modes — see
 * NewDocs/plans/procedural-generation/swfrecomp-substrate-converged.md).
 *
 * Mode 1 (this entry): opaque fixed minigame. A region = one recompiled
 * Flash game instance; the region's AP locations = the game's in-game
 * objectives. The game's own ActionScript cooperatively calls the
 * `__swfBridge` JS contract (sendLocation on objective complete;
 * pollItems to apply received items) — confirmed viable on the AVM1
 * ExternalInterface path, so the native `Rando` C builtin is not
 * required. Mode 2 (procgen-rendered content, AVM2-gated) adds the
 * build-time hooks (generateRegionCore / placeFrom* / etc.) later.
 *
 * v1 scope: minimal supportedFeatures (arbitrary_ap_locations only — a
 * minigame region is opaque and exposes no sub-region graph), no
 * build-time procgen hooks, playback deferred (getPlaybackController
 * returns null). The sidecar carries a per-region game id + optional
 * parameters and the location<->objective map; the substrate just
 * renders the corresponding game.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

export const substrateRegistryEntry = Object.freeze({
    // Identity / runtime
    id: 'swfrecomp',
    label: 'Flash (SWFRecomp)',
    panelComponentType: 'swfrecompSubstratePanel',
    loadRegionEvent: 'swfrecomp:loadRegion',

    // v1: opaque minigame — only arbitrary AP locations. No NESW exits,
    // no source-derived topology, no logic gates. Extended in later
    // phases as features are added.
    supportedFeatures: Object.freeze([
        'arbitrary_ap_locations',
    ]),

    // procgenPlayer passes the sidecar entry's `playable_payload` (not
    // the whole sidecar) to this function. Expected payload shape for a
    // swfrecomp region (Mode 1):
    //   {
    //     gameId: <string>,          // which recompiled game to load
    //     params?: { ... },          // optional per-region difficulty/variant
    //     ap_items?: { ap_item_name: flash_name },
    //     ap_locations?: { flash_name: ap_location_name },
    //     exits: [...],              // region-graph exits
    //   }
    //
    // ap_locations maps an in-game objective (flash_name) to an AP
    // *location name* — the frontend stateManager is name-keyed (its
    // user:locationCheck handler reads eventData.locationName). The
    // id-based form in the SWFRecomp-CC plan was for a live AP server
    // over websocket; the substrate talks to stateManager instead.
    //
    // Exits are converted from the on-disk array form into a Map keyed
    // by exitName — same shape mazeRoom/JtA deserializers use — because
    // procgenPlayer.handleRegionMove calls sourceWorld.exits.has(exitName)
    // when resolving the targetExitId for a region transition. Leaving
    // exits as an array breaks that lookup with "exits.has is not a
    // function".
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
    // invokes this on every region during preset emission; only the
    // runtime-Map exits field needs special handling — everything else
    // round-trips as-is.
    serializeWorld: (world) => {
        const w = world ?? {};
        const exitsArray = w.exits instanceof Map
            ? [...w.exits.values()]
            : (Array.isArray(w.exits) ? w.exits : []);
        return { ...w, exits: exitsArray };
    },

    // Playback bot integration is deferred (Mode 1 / v1). Until then the
    // registry's getPlaybackController returns null and the bot no-ops on
    // swfrecomp regions (per the substrate registry contract). When it
    // lands, drive the logic-only / stub backend headless so the test
    // harness never needs WebGPU; the graphics build is for live play.
    getPlaybackController: () => null,

    // Build-time hooks (generateRegionCore / placeFromItems / etc.) are
    // omitted in Mode 1 — procgen does not generate the game's internal
    // content; it just records the per-region gameId + params in the
    // sidecar. Mode 2 (AVM2-gated) adds them.
});

// Side-effect on import: register the substrate so the procgen pipeline
// can resolve it without booting the panel module. Same pattern as
// mazeRoom / textAdventureSubstrate / jtaSubstrateWrapper libraries —
// idempotent because index.js's host hook also calls register() in the
// live app.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
