/**
 * Substrate registry entries for Flash games as a procgen substrate
 * (multi-runtime: SWFRecomp WASM / Ruffle / native Flash — the runtime is
 * chosen by the game page, not this module. See
 * NewDocs/plans/procedural-generation/flash-substrate-converged.md and
 * flash-substrate-unification.md).
 *
 * Mode 1: opaque fixed minigame. A region = one Flash game instance; the
 * region's AP locations = the game's in-game objectives. The game's own
 * ActionScript cooperatively calls the `__swfBridge` JS contract
 * (sendLocation on objective complete; pollItems to apply received items)
 * via ExternalInterface — proven on both SWFRecomp and Ruffle. Mode 2
 * (procgen-rendered content, AVM2-gated) adds build-time hooks later.
 *
 * Shape 1 (per-game registry entry, shared panel): each Flash game is its
 * OWN substrate registry entry — its own `id` + `label` +
 * `supportedFeatures` — but every entry shares ONE
 * `panelComponentType: 'flashSubstratePanel'` and ONE
 * `loadRegionEvent: 'flash:loadRegion'`. This works with no framework
 * change: the warehouse stores each region's `loadRegionEvent` from its
 * entry, so N distinct flash ids all publish the same event to the one
 * shared panel/bridge; the bridge keys behavior on the region payload
 * (gameId / ap_locations), not on the substrate id. `createFlashSubstrateEntry`
 * is the factory; per-game entries differ only in id/label/features.
 *
 * v1 scope: minimal supportedFeatures (arbitrary_ap_locations only — a
 * minigame region is opaque), no build-time procgen hooks, playback
 * deferred (getPlaybackController returns null). The sidecar carries a
 * per-region gameId + optional params and the location<->objective map.
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';

// Shared across every flash game entry — the whole point of Shape 1 is
// that all per-game ids resolve to the SAME panel + load event, so the
// one panel/bridge serves them all.
export const FLASH_PANEL_COMPONENT_TYPE = 'flashSubstratePanel';
export const FLASH_LOAD_REGION_EVENT = 'flash:loadRegion';

// procgenPlayer passes the sidecar entry's `playable_payload` (not the
// whole sidecar) to deserializeWorld. Expected payload shape for a flash
// region (Mode 1):
//   {
//     gameId: <string>,          // which game to load (page picks runtime)
//     params?: { ... },          // optional per-region difficulty/variant
//     ap_items?: { ap_item_name: flash_name },
//     ap_locations?: { flash_name: ap_location_name },
//     flashCapabilities?: {      // integration axis (Option B, see plan).
//       locations?: 'cooperative',  //   how the game reports locations
//       items?: 'pull',             //   how the game receives items
//     },                         //   omitted == cooperative + pull (back-compat)
//     exits: [...],              // region-graph exits
//   }
//
// flashCapabilities declares HOW a game integrates (which bridge styles it
// uses) — consumed only by the in-iframe bridge, so it rides this payload
// rather than the registry entry (no main-window code reads it). Open-bag
// vocabulary, formalized as each style lands. See bridge.js for the
// authoritative defaults + gating.
//
// ap_locations maps an in-game objective (flash_name) to an AP *location
// name* — the frontend stateManager is name-keyed (its user:locationCheck
// handler reads eventData.locationName). The id-based form in the
// SWFRecomp-CC plan was for a live AP server over websocket; the substrate
// talks to stateManager instead.
//
// Exits are converted from the on-disk array form into a Map keyed by
// exitName — same shape mazeRoom/JtA deserializers use — because
// procgenPlayer.handleRegionMove calls sourceWorld.exits.has(exitName)
// when resolving the targetExitId for a region transition. Leaving exits
// as an array breaks that lookup with "exits.has is not a function".
function deserializeWorld(payload) {
    const p = payload ?? {};
    const exitsArray = Array.isArray(p.exits) ? p.exits : [];
    const exitsMap = new Map();
    for (const e of exitsArray) {
        const key = e?.exitName ?? e?.exit_id;
        if (key) exitsMap.set(key, e);
    }
    return { ...p, exits: exitsMap };
}

// Inverse of deserializeWorld for write-to-disk. buildPresetSidecars
// invokes this on every region during preset emission; only the
// runtime-Map exits field needs special handling — everything else
// round-trips as-is.
function serializeWorld(world) {
    const w = world ?? {};
    const exitsArray = w.exits instanceof Map
        ? [...w.exits.values()]
        : (Array.isArray(w.exits) ? w.exits : []);
    return { ...w, exits: exitsArray };
}

/**
 * Build a Flash substrate registry entry. Per-game entries differ only in
 * identity (id/label) and capabilities (supportedFeatures); the shared
 * runtime fields (panel, load event, de/serialize, playback) are baked in
 * here so every flash game routes through the one panel/bridge.
 *
 * @param {object} opts
 * @param {string}   opts.id               unique substrate id (e.g. 'flash', 'flash_seedling')
 * @param {string}  [opts.label]           display name (defaults to id)
 * @param {string[]}[opts.supportedFeatures] procgen-pipeline features (default: arbitrary_ap_locations)
 * @param {string}  [opts.iframeId]        the iframeAdapter id of the panel's iframe
 *   (default: 'flashSubstrate' — the shared flash panel's). procgenPlayer uses
 *   this to re-publish the active region's loadRegion when THIS iframe
 *   announces appReady, closing the race where the initial loadRegion fires
 *   before the iframe's bridge has subscribed (and covering iframe reloads).
 * @returns {object} a frozen substrate registry entry
 */
export function createFlashSubstrateEntry({
    id,
    label,
    supportedFeatures = ['arbitrary_ap_locations'],
    iframeId = 'flashSubstrate',
} = {}) {
    if (!id || typeof id !== 'string') {
        throw new Error('createFlashSubstrateEntry: id must be a non-empty string');
    }
    return Object.freeze({
        // Identity (per-game)
        id,
        label: label ?? id,
        // v1: opaque minigame — only arbitrary AP locations by default. No
        // NESW exits, no source-derived topology, no logic gates. A game
        // may declare a richer set; extended as features are added.
        supportedFeatures: Object.freeze([...supportedFeatures]),

        // Shared runtime (every flash game resolves to the SAME panel +
        // load event — this is what makes Shape 1 a single panel/bridge).
        panelComponentType: FLASH_PANEL_COMPONENT_TYPE,
        loadRegionEvent: FLASH_LOAD_REGION_EVENT,
        iframeId,
        deserializeWorld,
        serializeWorld,

        // Playback bot integration is deferred (Mode 1 / v1). Until then
        // getPlaybackController returns null and the bot no-ops on flash
        // regions. When it lands, drive the logic-only / stub backend
        // headless so the test harness never needs WebGPU.
        getPlaybackController: () => null,

        // Build-time hooks (generateRegionCore / placeFromItems / etc.)
        // are omitted in Mode 1 — procgen does not generate the game's
        // internal content; it just records gameId + params in the
        // sidecar. Mode 2 (AVM2-gated) adds them.
    });
}

// The default generic 'flash' entry — a region whose game is identified
// purely by the payload's gameId, with no game-specific capability
// declaration. Per-game entries (e.g. 'flash_seedling') are registered
// alongside it via createFlashSubstrateEntry.
export const substrateRegistryEntry = createFlashSubstrateEntry({
    id: 'flash',
    label: 'Flash',
});

// Side-effect on import: register the default substrate so the procgen
// pipeline can resolve it without booting the panel module. Same pattern
// as mazeRoom / textAdventureSubstrate / jtaSubstrateWrapper libraries —
// idempotent because index.js's host hook also calls register() in the
// live app.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
