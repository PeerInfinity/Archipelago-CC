/**
 * `flash_seedling` — the region-atlas play-time substrate (projection 3;
 * CC/docs/plans/region-atlas-plan.md, Phase 4).
 *
 * A region of this substrate is a REAL Seedling level, marked out in the
 * region atlas and compiled into `preset_sidecars` by
 * `procgenPipeline/regionAtlasCompiler.js`. Walking through one of the game's
 * own level transitions crosses the AP region boundary; arriving in a region
 * teleports the player to the marked entrance spawn.
 *
 * Two things make this entry different from the generic `flash` one, and both
 * are deliberate:
 *
 *   - **It renders in the flashPanel panel, not flashSubstratePanel.** The
 *     game is driven by flashPanel's shipped `WasmBridgeAdapter` — teleports,
 *     item writes, progressive/fusion expansion and location checks are all
 *     Stage-1-verified there. Building a second AP<->game translation inside
 *     flashSubstrate's in-iframe bridge would be a second implementation of a
 *     solved problem (ruling 2, 2026-07-27), and it speaks the wrong dialect
 *     anyway: the SWFRecomp wasm shim exposes `game.configure(json)` +
 *     `queueItems`, not the substrate bridge's `__swfBridge.configure(obj)` +
 *     `pollItems`.
 *   - **It owns its load event.** The bounce precedent: a per-game entry with
 *     its own panel gets its own `loadRegion` event, so the shared flash
 *     bridge never sees regions it cannot render.
 *
 * Everything else — the exits-Map `deserializeWorld`/`serializeWorld` round
 * trip, the null playback stub, the loop-mode declaration — comes from
 * `createFlashSubstrateEntry`, unchanged.
 *
 * Payload shape (emitted by regionAtlasCompiler, consumed by
 * `seedlingRegionBinding.js`):
 *
 *   {
 *     gameId: 'seedling',
 *     atlas_ref: '<atlas_id>',        // content-hashed: a restamp invalidates
 *     atlas_region: '<region_id>',
 *     atlas_sub_region?: '<sub_region>',
 *     level: <int>,                   // the Seedling level this region IS
 *     tile_size: <int>,
 *     exits: [{
 *       exit_id, kind, side?, exit_tiles, entrance_tile,
 *       entrance_spawn: {x, y},       // where an ARRIVAL through this exit lands
 *       exitName,                     // === the AP exit's `name` (required)
 *       targetRegion, targetExitId,
 *       target_level, target_spawn,   // where a CROSSING through it goes
 *     }],
 *   }
 */

import { substrateRegistry } from '../shared/procgen/substrateRegistry.js';
import { createFlashSubstrateEntry } from '../flashSubstrate/flashSubstrateLibrary.js';

export const FLASH_SEEDLING_SUBSTRATE_ID = 'flash_seedling';
export const FLASH_SEEDLING_PANEL_COMPONENT_TYPE = 'flashPanel';
export const FLASH_SEEDLING_LOAD_REGION_EVENT = 'flashSeedling:loadRegion';

const base = createFlashSubstrateEntry({
    id: FLASH_SEEDLING_SUBSTRATE_ID,
    label: 'Seedling (region atlas)',
    // v1 keeps the flash family's default (`arbitrary_ap_locations`). An atlas
    // region has real NESW boundary exits and intrinsic frontier rules, but
    // nothing consumes them at build time until Phase 6 teaches sphere growth
    // to place pre-built regions — declaring the features before then would be
    // a vacuous capability claim.
});
// The flashPanel embed is a plain <iframe>, not an iframeAdapter-managed one:
// it never announces `iframe:appReady`, so the factory's default iframeId
// (the shared flash panel's) would only ever mis-fire. Drop it rather than
// leave a claim nothing honours.
const { iframeId: _unusedIframeId, ...runtime } = base;

export const substrateRegistryEntry = Object.freeze({
    ...runtime,
    panelComponentType: FLASH_SEEDLING_PANEL_COMPONENT_TYPE,
    loadRegionEvent: FLASH_SEEDLING_LOAD_REGION_EVENT,
});

// Side-effect on import — the standing convention (see
// docs/json/developer/procgen/substrate-registry.md): headless callers get a
// populated registry from the import alone, and the module's own register()
// hook repeats it idempotently in the live app.
if (!substrateRegistry.has(substrateRegistryEntry.id)) {
    substrateRegistry.register(substrateRegistryEntry);
}
