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

The **PlaybackController** contract is substrate-neutral: `play(rateHz?)`, `stop()`, `step()`, `instant()`, `reset()`, `setRate(rateHz)`, `walkTo(target)` where target is `{ kind: 'location'|'exit'|'tile', name?, region?, x?, y? }`, and optional `replayActions(actions, { onComplete, departureExitId, instant })` for replaying a recorded visit — the substrate replays the interior actions, then crosses `departureExitId` itself (recordings exclude the departing move), draining in one frame when `instant` is set. See [Loop Recording and Block Modes](./loop-recording.md). Every method returns `void` or `Promise<void>`; the bot's dispatch is fire-and-forget and progress comes back through the normal dispatcher events (`user:locationCheck`, `user:regionMove`). Iframe-backed substrates implement the controller as a host-side proxy that forwards commands to an in-iframe bridge — the wrapper's proxy publishes `textAdventureSubstrateWrapper:control` events; bounce's publishes on `bounce:playbackControl` and the in-game bot driver plays real physics from input synthesis.

### Loop mode

| Field | Type | Meaning |
|-------|------|---------|
| `loopSupport` | object | Declares which loops-panel affordances this substrate's regions get. **Absent ⇒ no loop-mode affordances** (AP-native regions without a substrate are unaffected — loops drives those itself). |
| `loopSupport.queueActions` | string[] | Which loop-queue action types can be authored for a region: `'regionMove'`, `'locationCheck'`, `'explore'`. |
| `loopSupport.manual` | boolean | The region can be played by hand in loop mode. |
| `loopSupport.record` | boolean | The Record block mode is offered (requires `playback` — no replay, no point recording). Gates the Record radio and set-all-Record control, and is the capability the default block mode (Record since M4) clamps against — a substrate without it falls back to Manual. **Declaring `record` + `playback` also opts the substrate into the strict loop-mode action gate and the live-play drain** (M3b; enforcement is staged with block-mode integration — see [loop-recording.md](./loop-recording.md#the-loop-mode-interaction-rules-as-built-m3b)). |
| `loopSupport.playback` | boolean | Record-mode captures can be replayed: through the substrate's `replayActions` for fine-grained substrates, or by the loops generic executor over the block interior for coarse-only ones. |
| `loopSupport.instant` | boolean | A Playback (or **Bot**, M6) block can drain in one burst. Fine-grained: `replayActions` with `instant: true`; coarse-only: the generic executor honors the per-block flag. Gates the per-block Instant toggle — except for **summary** substrates, whose Playback is inherently instant, so they declare the capability (for the focus-suppression seam) but show no checkbox. For a **Bot** block the checkbox appears only where the solver honors it (`loopState.regionBotHonorsInstant`: the `walkTo` solver on a fine substrate — jta; summary bots and maze delegation do not — see [loop-recording.md](./loop-recording.md#block-modes)). |
| `loopSupport.summaryRecording` | boolean | The substrate follows the **summary** capture contract (M5): Record captures the visit's *net result* (duration in drain seconds, performed checks, explicitly-costed actions, departure exit) rather than a replayable action stream, and Playback applies that envelope instantly — no replay, the game does not participate. Declared by runner and bounce; mutually exclusive in practice with `takeLastRecording` (a real recorder wins if both appear). Also switches the substrate's regions to the **time-priced** economy: a per-second drain during parked live play, with per-action costs only where the `loop_costs` data names one explicitly. See [loop-recording.md](./loop-recording.md#summary-substrates-m5-2026-07-23). |
| `loopSupport.customQueues` | boolean | The legacy custom-queue dropdown (manually attach a saved queue as a `customQueue` action). Distinct from `record`/`playback`, which are block-mode-driven. |
| `loopSupport.requiresLoopMode` | boolean | The substrate's regions are **not supported outside loop mode**: it is a loop game whose native economy already restarts from the beginning on depletion, so its energy↔pool sync and reset propagation are always-on by contract. Loops refuses a user-initiated loop-mode disable while such a world is loaded (the preset auto-disable is exempt). Declared by jta; omsi and future loop-game substrates adopt it. See [loop-recording.md](./loop-recording.md#requiresloopmode--loop-game-substrates). |
| `loopSupport.executeVia` | `'solver'` (optional) | Declares that the region's actions can be executed by **the loops solver** — the loops queue drives the substrate's PlaybackController (`walkTo`) and parks until the resulting event arrives. The one trigger is a **Bot**-mode block (M6); absent ⇒ generic timer execution. Declared by bounce, runner, and jta. (Renamed from `'playbackBot'` in M6; unrelated to the `playbackBot` *module*, which is the sphere-log auto-player panel.) |
| `takeLastRecording` | `() → SavedQueue \| null` (top-level entry field) | Pull-and-clear the substrate recorder's stashed visit capture. Loops (the **sole persister**) pulls it only when a Record-mode block completes through its expected exit; wrong exits / mana-outs / resets are discarded by simply never pulling. Only **fine-grained** substrates supply this — see the capture contract below. Its presence is also what discriminates fine-grained from the other two categories; the panel's recording-exists indicator and the Playback-enabled check follow the same split (fine-grained ⇒ ask the store for a playable recording; summary ⇒ ask the store for a bound summary; coarse-only ⇒ ask the block interior). |

**The capture contract** (settled 2026-07-22; implemented M3b): supply a recorder (`takeLastRecording`) only if the substrate has *sub-queue-grade* actions — actions finer than a loop-queue entry, like the maze's per-tile moves. Such a recorder captures the whole visit as one interleaved stream (coarse actions included) and loops projects the queue-grade subset into the block interior; a fine-grained substrate also owns its **live-play drain** natively (the maze charges per tile during parked live play, gated on loops' `livePlayRegion()` public function). A **coarse-only** substrate (every action is a queue-grade `regionMove`/`locationCheck`/`explore`/custom verb — the text adventure) gets Record/Playback *and* the live-play charging from loops itself — no recorder and no saved *actions*; the block's own queue entries are the recording. (Since M4 a coarse substrate does get an **actions-less** saved entry holding its queue annotations — economy metadata only, never playable.) The presence of `takeLastRecording` **is** the discriminator between fine-grained and the rest — there is no separate declaration for those two. Never both channels at once.

M5 (2026-07-23, user-directed) added a **third** category for substrates whose play is real-time and whose action stream is not worth replaying (runner, bounce): they declare `loopSupport.summaryRecording`, capture the visit's net RESULT, and have Playback apply it instantly. That one *is* an explicit declaration, and `loopState._captureShapeFor()` is the single resolver every branch site goes through so no category can inherit another's behavior by omission. Full rationale and flows: [Loop Recording and Block Modes](./loop-recording.md).

### Cross-substrate sharing

The optional `sharing` field declares which resource-channel categories the substrate participates in (the cross-game consumable-pool plan's layer R; validated at `register()` time — unknown categories or malformed shapes throw). The host side lives in `frontend/modules/resourceChannels/`: a shared charge/XP/loop-reset helper library for in-process legs, an id-keyed channel-event router (`substrate:resourceDelta` / `substrate:resourceBonus` / `substrate:resourceReset`) for iframe bridges, and the `crossSubstrate:itemGranted` grant-notification bus. The router **rejects** channel events from substrate ids without a matching declaration, so participation is always declared, never implied.

| Field | Type | Meaning |
|-------|------|---------|
| `sharing.mana` | object (optional) | The substrate participates in the continuous shared-mana channel (drain/refill/bonus/reset against the host loop-mode pool). |
| `sharing.mana.loopActionDelegation` | boolean (optional) | The loops queue delegates action execution + per-step charging for this substrate's `manaEnabled` regions to the substrate's own walker instead of the queue's flat tick-progress model. |
| `sharing.items` | object (optional) | The substrate offers discrete shareable consumables, namespaced `<substrateId>/<type>`. Carries the type list as **exactly one of** a static `types: string[]` or a `getTypes(): string[]` provider. Grant routing (`grantItem`) validates against it. |

### Build-time — procedural substrates

Implemented by `maze` and `text_adventure` (both via the shared `adapterPrimitives.js` tile-grid implementations):

| Field | Meaning |
|-------|---------|
| `generateRegionCore` | Generate a region's core geometry/world from driver input. |
| `placeFromItems` | Place items/obstacles into the world (grid-growth-era placement path). |
| `placeFromRules` | Place logic gates, items, and locations to satisfy the region's access rules. |
| `extractPathsAndObstacles` | Extract the access rules the generated geometry actually enforces (verification: authored vs. realised). |
| `applyContentModules` | Optional post-build pass for content modules (maze uses it for hazards); the engine calls it at both build sites when declared, and substrates without it skip the pass. |

### Build-time — content sources (zone-based substrates)

A **content source** supplies pre-existing region descriptors to a layout driver *by ordinal* — its Nth planned cell becomes its Nth entry — rather than growing region geometry from the rng stream. The shuffled-spiral driver resolves one per planned cell through a single seam (`resolveSpiralContentSource` in `procgenPipelineEngine.js`); a content source instantiates without drawing rng (content slots consume none — the byte-identity discipline), and everything else falls through to the rng-consuming procedural build path.

Today's content sources are the zone-based substrates (`jta`, `bounce`, `runner`), whose registry adapter exposes:

| Field | Meaning |
|-------|---------|
| `zoneCount` | **Pool size** — how many discrete entries exist. Layout drivers (currently `arrangeShuffledSpiral`) refuse to allocate more regions than this to the source, and the quota-vs-pool check keys on it. |
| `extractZoneRules(zoneIdx, ctx)` | **Instantiate** — the single per-ordinal content channel: produces the entry's locations, per-side exit rules/paths, obstacle defs, and `playable_payload` fragment in one call. jta folds its `{ jtaZone: zoneIdx }` sidecar ordinal into this channel's payload (region-library C1 absorbed the former standalone `synthesizeZonePayload` hook — `jtaZone` stays the first payload key); bounce/runner emit their winnable geometry's locations and rules. |
| `victoryItem` | Name of the item the source's entry table places as the goal. Emission paths use it as the completion-condition item when the scenario pool contributes no `is_victory` item — without it the AP world would have no goal and be "beaten" at sphere 0. Bounce, runner, and jta declare one (`'Victory'`). |

**Content-source residency in the stepped pipeline.** A content source that also feeds a *document* into the pipeline (jta's synthetic dataset; a loaded region library) declares `emitsSpiralContent: true` and names the config field its document rides under with `spiralContentConfigKey` (default `datasetDoc`). The stepped spiral's ② content step materialises that document onto the envelope, restamps it on hand-edit, and clears downstream on a real id change — see [The Stepped Pipeline](./stepped-pipeline.md#spiral-mode--four-steps). A content source with no such document (a vanilla-table jta world) leaves ② a byte-identical no-op.

**The "zone" reframing (region-library audit, 2026-07-13).** "Zone" historically conflated two orthogonal things: an *interface* ("no tile-procedural hooks → give this region fictional `exit_<side>` geometry"; `assembleZoneRegion`) and a *content model* (a finite ordered pool, Nth region = zone N, each used once). Only jta is genuinely pre-built-by-reference (indices into one stateful game build — excluded from the region library by nature); bounce/runner *generate* their "zones" (`extractZoneRules` / `generateZoneForSpecs`), payload-by-value and self-contained. The interface half (synthetic exits, location replacement, exit reconnection via `stitchGrid` + `wallOffUnusedExits`) is already substrate-agnostic and is **not** what distinguishes a content source; the two irreducible differences a reuse design must handle are **access-rule realisation** (a procedural substrate makes geometry match a rule via `placeFromRules`; fixed content must annotate/negotiate) and **exit-geometry decoupling** (a synthetic or `sidePortals`-relabelled exit moves freely; a maze exit is a real hole in a real wall). The region library (`docs/json/developer/procgen/…`, plan `CC/docs/plans/region-library-plan.md`) is the first content source that is *data, not code*.

**Out of scope (the eventual direction, not built).** Unifying the ordinal-driven `extractZoneRules` (substrate decides) with the spec-driven `generateZoneForSpecs` (engine decides) into one spec-driven content contract, and running jta on the sphere-growth driver, are the natural next steps once a second data-backed content source exists. They are deliberately deferred.

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
| Loop queue actions | move, check, explore | move, check (`executeVia: 'solver'`) | move, check (`executeVia: 'solver'`) | move, check, explore | move | move (`executeVia: 'solver'`) |
| Manual loop play | yes | yes | yes | yes | yes | yes |
| Record / Playback | **yes** (fine-grained recorder) | **yes** (summary, M5) | **yes** (summary, M5) | **yes** (coarse-only) | no | **yes** (fine-grained, M4) |
| Instant | **yes** | no (summary: inherently instant) | no (summary: inherently instant) | **yes** | no | **yes** |
| Bot (solver, M6) | **yes** (delegation) | **yes** (`walkTo`) | **yes** (`walkTo`) | no | no | **yes** (`walkTo`, honors Instant) |
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
5. If the substrate participates in generation, implement the build-time group that fits: procedural hooks for grown geometry, or the content-source group (`zoneCount` + `extractZoneRules`) for a fixed ordered pool.
6. If regions should be playable in loop mode or by the playback bot, declare `loopSupport` and implement `getPlaybackController`.
7. If the substrate shares resources or consumables across substrates (loop-mode mana, cross-game item grants), declare `sharing` and build on the `resourceChannels` helpers instead of bespoke gameState plumbing.

## Related documentation

- [Architecture](./architecture.md) — where the registry sits in the overall flow
- [Module System](../guides/module-system.md) — module registration and panels
- [Loop Recording and Block Modes](./loop-recording.md) — the block-mode system, recording flows, and the coarse/fine capture contract
- [Loops feature](../../features/loops.md) — what `loopSupport` gates from the user side
