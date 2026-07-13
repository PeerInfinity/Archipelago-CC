# Substrate Registry Reference

The substrate registry (`frontend/modules/shared/procgen/substrateRegistry.js`) is the dispatch hub between the procgen pipeline, the runtime player, and the substrates. Substrates register an **entry** describing their capabilities; the pipeline and player look entries up by `id` and never import substrate modules directly. This document is the reference for that entry contract, compiled from the registry and the five registered entries.

## Registry mechanics

The registry is a singleton with a small API: `register(entry)`, `get(id)`, `has(id)`, `getAll()`, and a test-only `clear()`. `register` throws on a missing/duplicate `id`, so call sites guard with `has()` first.

Registration happens in two places, deliberately redundant and idempotent:

- **Side-effect on library import.** Most `*Library.js` files self-register their entry behind a `has()` guard, so headless callers (the `scripts/procgen/` CLIs, tests) get a populated registry just by importing the library — no panel or eventBus wiring required.
- **Host module hook.** The substrate's `index.js` also registers during the module `register()`/`initialize()` phase in the live app.

Same-id coexistence is first-wins: `textAdventureSubstrate` and `textAdventureSubstrateWrapper` both define id `text_adventure`; whichever module loads first owns the id and the other no-ops via the `has()` guard. In the default module config the direct-panel `textAdventureSubstrate` is disabled, so the wrapper wins.

Entry factories exist for families of similar substrates: `createFlashSubstrateEntry` (`flashSubstrateLibrary.js`) builds an entry per Flash game, and `createBounceSubstrateEntry` (`bounceDemoLibrary.js`) builds on top of it, overriding the panel identity and adding bounce's build-time hooks.

## Entry contract

All fields below are observed in the registered entries; every group after Identity is optional — the consumers check for required slots at dispatch time, so a substrate can be runtime-only (jta, flash) or supply build-time adapters without a panel.

### Identity

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique substrate id (`maze`, `bounce`, `text_adventure`, `flash`, `jta`). Used in sidecar entries, quota flags, and every dispatch. |
| `label` | string | Display name for UI surfaces (e.g. the panel-status overlay). |

### Runtime

| Field | Type | Meaning |
|-------|------|---------|
| `panelComponentType` | string | Golden Layout component type of the panel that renders this substrate's regions. |
| `loadRegionEvent` | string | eventBus event the panel subscribes to; procgenPlayer publishes it with the deserialized world when the player enters one of this substrate's regions. |
| `iframeId` | string | Iframe-hosted entries (flash family, jta): the iframeAdapter id of the panel's iframe. procgenPlayer re-publishes the active region's load event when this iframe announces `appReady`, closing the race where the initial load fires before the iframe's bridge has subscribed (and covering reloads). |
| `supportedFeatures` | string[] | Shared-library feature ids the substrate can realise (e.g. `logic_gate`, `nesw_exits`, `arbitrary_ap_locations`, `region_topology_from_source`). Drivers use this to decide what a substrate's regions may contain. |
| `deserializeWorld` | `(playable_payload) → world` | Called by procgenPlayer per region when building the warehouse. **Shape requirement:** the returned world's `exits` must be a `Map` keyed by exit name — `procgenPlayer.handleRegionMove` calls `world.exits.has(exitName)`; an array breaks region transitions. |
| `serializeWorld` | `(world, …) → sidecar payload` | Inverse of `deserializeWorld`, used when emitting `preset_sidecars` (and, for procedural substrates, at the end of region generation). Converts runtime shapes (the exits `Map`) back to plain JSON. |

### Playback

| Field | Type | Meaning |
|-------|------|---------|
| `getPlaybackController` | `() → PlaybackController \| null` | Resolved by the playback bot (and by the loops `customQueue` action) for the current region's substrate. Returning `null` means "no panel mounted / playback unsupported" and the caller no-ops. |

The **PlaybackController** contract is substrate-neutral: `play(rateHz?)`, `stop()`, `step()`, `instant()`, `reset()`, `setRate(rateHz)`, `walkTo(target)` where target is `{ kind: 'location'|'exit'|'tile', name?, region?, x?, y? }`, and optional `replayActions(actions, { onComplete })` for substrate-native saved-queue replay. Every method returns `void` or `Promise<void>`; the bot's dispatch is fire-and-forget and progress comes back through the normal dispatcher events (`user:locationCheck`, `user:regionMove`). Iframe-backed substrates implement the controller as a host-side proxy that forwards commands to an in-iframe bridge — the wrapper's proxy publishes `textAdventureSubstrateWrapper:control` events; bounce's publishes on `bounce:playbackControl` and the in-game bot driver plays real physics from input synthesis.

### Loop mode

| Field | Type | Meaning |
|-------|------|---------|
| `loopSupport` | object | Declares which loops-panel affordances this substrate's regions get. **Absent ⇒ no loop-mode affordances** (AP-native regions without a substrate are unaffected — loops drives those itself). |
| `loopSupport.queueActions` | string[] | Which loop-queue action types can be authored for a region: `'regionMove'`, `'locationCheck'`, `'explore'`. |
| `loopSupport.manual` | boolean | The region can be played by hand in loop mode. |
| `loopSupport.customQueues` | boolean | Saved substrate-native action queues can be recorded and replayed. |
| `loopSupport.executeVia` | `'playbackBot'` (optional) | Makes the loops queue execute the region's actions by driving the substrate's PlaybackController (`walkTo`); the queue parks until the resulting event arrives, then charges the action's `loop_costs` value. Absent ⇒ generic timer execution. Used by bounce and jta. |

### Build-time — procedural substrates

Implemented by `maze` and `text_adventure` (both via the shared `adapterPrimitives.js` tile-grid implementations):

| Field | Meaning |
|-------|---------|
| `generateRegionCore` | Generate a region's core geometry/world from driver input. |
| `placeFromItems` | Place items/obstacles into the world (grid-growth-era placement path). |
| `placeFromRules` | Place logic gates, items, and locations to satisfy the region's access rules. |
| `extractPathsAndObstacles` | Extract the access rules the generated geometry actually enforces (verification: authored vs. realised). |
| `applyContentModules` | Optional post-build pass for content modules (maze uses it for hazards); the engine calls it at both build sites when declared, and substrates without it skip the pass. |

### Build-time — zone-based substrates

For substrates whose content is a fixed, ordered set of pre-authored zones rather than grown geometry (`jta`, `bounce`):

| Field | Meaning |
|-------|---------|
| `zoneCount` | How many discrete zones exist. Layout drivers (currently `arrangeShuffledSpiral`) refuse to allocate more regions than this to the substrate. |
| `extractZoneRules(zoneIdx, ctx)` | The single per-zone content channel: produces the zone's locations, per-side exit rules/paths, obstacle defs, and `playable_payload` fragment in one call. jta folds its `{ jtaZone: zoneIdx }` sidecar ordinal into this channel's payload (region-library C1 absorbed the former standalone `synthesizeZonePayload` hook — `jtaZone` stays the first payload key); bounce/runner emit their winnable geometry's locations and rules. |
| `victoryItem` | Name of the item the substrate's zone table places as the goal. Emission paths use it as the completion-condition item when the scenario pool contributes no `is_victory` item — without it the AP world would have no goal and be "beaten" at sphere 0. Bounce, runner, and jta declare one (`'Victory'`). |

### Build-time — driver-facing adapter hooks (bounce)

The sphere-growth driver and the Procgen Pipeline panel read a further set of optional hooks so the generic engine never names a substrate directly. Today only bounce implements them; they are listed here so readers recognize them in the entry, with the semantics documented at their consumers in `procgenPipelineEngine.js` / `sphereConfigHooks.js`:

- **Requirement-targeted zone generation:** `generateZoneForSpecs` / `generateZoneForSpecsGen`, `buildZoneSpecs`, `gateableItems` (null ⇒ full vocabulary; non-geometry gate terms become bridge-evaluated locks).
- **Gate-structure vetoes and hints:** `canHostExitGates`, `canHostExitGatesBraid`, `exitGateVeto`, `backPortalGated`, `hostsSurplusExitsNatively`, `gateHostingHint`.
- **Region contract:** `buildRegionContract` — called by the engine's generic dispatcher; the panel's "Edit ▸" flow and the verify scripts consume the result.
- **Pipeline panel integration:** `defaultProcgenParams`, `prepareSphereGrowth`, `buildRegionParams`, `renderProcgenParams` (per-substrate parameter defaults/controls).
- **Placement vocabulary:** `driftItems` (items a driver may attach to a surplus arrowless exit when granted free), `libraryItems`, `libraryObstacles` (merged with the shared defaults by consumers).

## Capability matrix

| Capability | `maze` | `bounce` | `runner` | `text_adventure` (wrapper) | `flash` | `jta` |
|---|---|---|---|---|---|---|
| Panel / load event | `mazeRoomPanel` / `maze:loadRegion` | `bounceDemoPanel` / `bounce:loadRegion` | `runnerDemoPanel` / `runner:loadRegion` | `textAdventureSubstrateWrapperPanel` / `textAdventure:loadRegion` | shared flash panel / `flash:loadRegion` | `jtaSubstrateWrapperPanel` / `jta:loadRegion` |
| Playback controller | live panel's controller | host proxy → in-game bot driver | host proxy → in-game bot driver | host proxy → iframe bridge | none (`null`) | host proxy → iframe bridge |
| Loop queue actions | move, check, explore | move, check (`executeVia: 'playbackBot'`) | move, check (`executeVia: 'playbackBot'`) | move, check, explore | move | move (`executeVia: 'playbackBot'`) |
| Manual loop play | yes | yes | yes | yes | yes | yes |
| Custom queues | **yes** | no | no | no | no | no |
| Procedural build hooks | yes (+ hazards via `applyContentModules`) | no | no | yes (shared tile-grid primitives) | no | no |
| Zone-based | no | yes (`zoneCount` from zone table, `extractZoneRules`, `victoryItem`) | yes (lazy zone table, `extractZoneRules`, `victoryItem`) | no | no | yes (`zoneCount: 30`, `extractZoneRules`, `victoryItem`) |
| Sphere-growth adapter hooks | no | **yes** | **yes** | no | no | no |

Entry sources: `mazeRoomLibrary.js`, `bounceDemoLibrary.js`, `runnerDemoLibrary.js`, `textAdventureSubstrateWrapperLibrary.js`, `flashSubstrateLibrary.js`, `jtaSubstrateWrapperLibrary.js`.

## Adding a substrate

The minimal checklist, derived from the smallest existing entry (jta):

1. **Write the entry** in a `<module>Library.js`: identity, `panelComponentType`, `loadRegionEvent`, `supportedFeatures`, `deserializeWorld`/`serializeWorld` (remember the exits-`Map` requirement), and whichever optional groups apply. Freeze it and self-register behind a `has()` guard so headless imports work.
2. **Register from the module** — call `substrateRegistry.register(entry)` (guarded) in the module's `register()`/`initialize()` hook as well.
3. **Wire the panel**: register the `panelComponentType` with the layout system and subscribe the panel to `loadRegionEvent`. (See the panel-integration steps in the module-system guide.)
4. **Enable the module** in `frontend/module-configs/modules.json` (and any mode variants that should include it — `frontend/modes.json` maps launch modes to config files).
5. If the substrate participates in generation, implement the build-time group that fits: procedural hooks for grown geometry, or `zoneCount` + a payload synthesizer for a fixed zone set.
6. If regions should be playable in loop mode or by the playback bot, declare `loopSupport` and implement `getPlaybackController`.

## Related documentation

- [Architecture](./architecture.md) — where the registry sits in the overall flow
- [Module System](../guides/module-system.md) — module registration and panels
- [Loops feature](../../features/loops.md) — what `loopSupport` gates from the user side
