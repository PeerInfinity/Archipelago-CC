# Substrate Registry Reference

`frontend/modules/shared/procgen/substrateRegistry.js` is the dispatch hub between the pipeline, the runtime player and the substrates: each registers an **entry**, and consumers look entries up by `id` instead of importing substrate modules. This is the reference for that entry contract — field by field, a capability matrix GENERATED from the eight entries, and a checklist for adding one.

## Registry mechanics

The registry is a singleton with a small API: `register(entry)`, `get(id)`, `has(id)`, `getAll()`, and a test-only `clear()`. `register` throws on a missing/duplicate `id`, so call sites guard with `has()` first.

Registration happens in two places, deliberately redundant and idempotent:

- **Side-effect on library import.** Most `*Library.js` files self-register their entry behind a `has()` guard, so headless callers (the `scripts/procgen/` CLIs, tests) get a populated registry just by importing the library — no panel or eventBus wiring required.
- **Host module hook.** The substrate's `index.js` also registers during the module `register()`/`initialize()` phase in the live app.

That first bullet is load-bearing, not merely convenient — see [Gotchas](./gotchas.md#substrate-libraries-register-on-import--headless-scripts-depend-on-it). `text_adventure` had two implementations until 2026-07-26, when the direct-panel `textAdventureSubstrate` was deleted; the surviving wrapper's `loopSupport` (with `record`/`playback`/`instant`) is pinned by `textAdventureSubstrateWrapperLibrary.test.js`.

Entry factories exist for families of similar substrates: `createFlashSubstrateEntry` (`flashSubstrateLibrary.js`) builds an entry per Flash game, and `createBounceSubstrateEntry` (`bounceDemoLibrary.js`) builds on top of it, overriding the panel identity and adding bounce's build-time hooks. `flash_seedling` (`flashPanel/flashSeedlingLibrary.js`, 2026-07-27) is the third: same factory, but it renders in the **flashPanel** panel with its own `flashSeedling:loadRegion` event and drops the inherited `iframeId` — see [Flash Substrate](./flash.md#flash_seedling--a-real-games-map-as-procgen-regions).

## Entry contract

All fields below are observed in the registered entries; every group after Identity is optional — the consumers check for required slots at dispatch time, so a substrate can be runtime-only (jta, omsi, flash) or supply build-time adapters without a panel.

### Identity

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | Unique substrate id (`maze`, `bounce`, `runner`, `text_adventure`, `flash`, `jta`, `omsi`). Used in sidecar entries, quota flags, and every dispatch. |
| `label` | string | Display name for UI surfaces (e.g. the panel-status overlay). |

### Runtime

| Field | Type | Meaning |
|-------|------|---------|
| `panelComponentType` | string | Golden Layout component type of the panel that renders this substrate's regions. |
| `loadRegionEvent` | string | eventBus event the panel subscribes to; procgenPlayer publishes it with the deserialized world when the player enters one of this substrate's regions. |
| `iframeId` | string | Iframe-hosted entries (flash family, jta, omsi): the iframeAdapter id of the panel's iframe. procgenPlayer re-publishes the active region's load event when this iframe announces `appReady`, closing the race where the initial load fires before the iframe's bridge has subscribed (and covering reloads). |
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
| `loopSupport.instant` | boolean | A Playback (or **Bot**, M6) block can drain in one burst. Fine-grained: `replayActions` with `instant: true`; coarse-only: the generic executor honors the per-block flag. Gates the per-block Instant toggle — except for **summary** substrates, whose Playback is inherently instant, so they declare the capability (for the focus-suppression seam) but show no checkbox. For a **Bot** block the checkbox appears only where the solver honors it (`loopState.regionBotHonorsInstant`: the `walkTo` solver on a fine substrate — jta and, since 2026-07-25, omsi; summary bots and maze delegation do not — see [loop-recording.md](./loop-recording.md#block-modes)). ⚠ Because that predicate is `instant && executeVia === 'solver' && fine`, a substrate already declaring the other two lights up **both** checkboxes the moment it declares this one: the Bot entry point must be wired in the same commit, or the Bot box is a vacuous control. |
| `loopSupport.summaryRecording` | boolean | The substrate follows the **summary** capture contract (M5): Record captures the visit's *net result* (duration in drain seconds, performed checks, explicitly-costed actions, departure exit) rather than a replayable action stream, and Playback applies that envelope instantly — no replay, the game does not participate. Declared by runner and bounce; mutually exclusive in practice with `takeLastRecording` (a real recorder wins if both appear). Also switches the substrate's regions to the **time-priced** economy: a per-second drain during parked live play, with per-action costs only where the `loop_costs` data names one explicitly. See [loop-recording.md](./loop-recording.md#summary-substrates-m5-2026-07-23). |
| `loopSupport.customQueues` | boolean | The legacy custom-queue dropdown (manually attach a saved queue as a `customQueue` action). Distinct from `record`/`playback`, which are block-mode-driven. |
| `loopSupport.requiresLoopMode` | boolean | The substrate's regions are **not supported outside loop mode**: it is a loop game whose native economy already restarts from the beginning on depletion, so its energy↔pool sync and reset propagation are always-on by contract. Loops refuses a user-initiated loop-mode disable while such a world is loaded (the preset auto-disable is exempt). Declared by **jta and omsi**; future loop-game substrates adopt it as their arcs land. See [loop-recording.md](./loop-recording.md#requiresloopmode--loop-game-substrates). |
| `loopSupport.executeVia` | `'solver'` (optional) | Declares that the region's actions can be executed by **the loops solver** — the loops queue drives the substrate's PlaybackController (`walkTo`) and parks until the resulting event arrives. The one trigger is a **Bot**-mode block (M6); absent ⇒ generic timer execution. Declared by bounce, runner, jta, and omsi. (Renamed from `'playbackBot'` in M6; unrelated to the `playbackBot` *module*, which is the sphere-log auto-player panel.) |
| `takeLastRecording` | `() → SavedQueue \| null` (top-level entry field) | Pull-and-clear the substrate recorder's stashed visit capture. Loops (the **sole persister**) pulls it only when a Record-mode block completes through its expected exit; wrong exits / mana-outs / resets are discarded by simply never pulling. Only **fine-grained** substrates supply this — maze, jta and omsi; see the capture contract below. Its presence is also what discriminates fine-grained from the other two categories, which is why a substrate must declare it **together with** `record`/`playback` rather than later, when the capture that fills it lands: declaring the capabilities alone classifies the substrate coarse, and loops would then charge `loop_costs` on top of a natively-charging substrate's own economy (the omsi arc D slice 1 correction). An empty pull persists nothing, so shipping the slot early is inert. the panel's recording-exists indicator and the Playback-enabled check follow the same split (fine-grained ⇒ ask the store for a playable recording; summary ⇒ ask the store for a bound summary; coarse-only ⇒ ask the block interior). |

**The capture contract** (settled 2026-07-22; implemented M3b): supply a recorder (`takeLastRecording`) only if the substrate has *sub-queue-grade* actions — actions finer than a loop-queue entry, like the maze's per-tile moves. Such a recorder captures the whole visit — as one interleaved stream (coarse actions included) for maze and jta, or as the region's authored plan for omsi, whose genre makes a performed log redundant — and loops projects the queue-grade subset into the block interior; a fine-grained substrate also owns its **live-play drain** natively (the maze charges per tile during parked live play, gated on loops' `livePlayRegion()` public function). A **coarse-only** substrate (every action is a queue-grade `regionMove`/`locationCheck`/`explore`/custom verb — the text adventure) gets Record/Playback *and* the live-play charging from loops itself — no recorder and no saved *actions*; the block's own queue entries are the recording. (Since M4 a coarse substrate does get an **actions-less** saved entry holding its queue annotations — economy metadata only, never playable.) The presence of `takeLastRecording` **is** the discriminator between fine-grained and the rest — there is no separate declaration for those two. Never both channels at once.

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

Today's content sources are the zone-based substrates (`jta`, `bounce`, `runner`, `omsi`), whose registry adapter exposes:

| Field | Meaning |
|-------|---------|
| `zoneCount` | **Pool size** — how many discrete entries exist. Layout drivers (currently `arrangeShuffledSpiral`) refuse to allocate more regions than this to the source, and the quota-vs-pool check keys on it. |
| `extractZoneRules(zoneIdx, ctx)` | **Instantiate** — the single per-ordinal content channel: produces the entry's locations, per-side exit rules/paths, obstacle defs, and `playable_payload` fragment in one call. jta folds its `{ jtaZone: zoneIdx }` sidecar ordinal into this channel's payload (region-library C1 absorbed the former standalone `synthesizeZonePayload` hook — `jtaZone` stays the first payload key); bounce/runner emit their winnable geometry's locations and rules. |
| `victoryItem` | Name of the item the source's entry table places as the goal. Emission paths use it as the completion-condition item when the scenario pool contributes no `is_victory` item — without it the AP world would have no goal and be "beaten" at sphere 0. Bounce, runner, and jta declare one (`'Victory'`). |

**Content-source residency in the stepped pipeline.** A content source that also feeds a *document* into the pipeline (jta's synthetic dataset; a loaded region library) declares `emitsSpiralContent: true` and names the config field its document rides under with `spiralContentConfigKey` (default `datasetDoc`). The stepped spiral's ② content step materialises that document onto the envelope, restamps it on hand-edit, and clears downstream on a real id change — see [The Stepped Pipeline](./stepped-pipeline.md#spiral-mode--four-steps). A content source with no such document (a vanilla-table jta world) leaves ② a byte-identical no-op.

**The "zone" reframing (region-library audit, 2026-07-13).** "Zone" historically conflated two orthogonal things: an *interface* ("no tile-procedural hooks → give this region fictional `exit_<side>` geometry"; `assembleZoneRegion`) and a *content model* (a finite ordered pool, Nth region = zone N, each used once). Only jta is genuinely pre-built-by-reference (indices into one stateful game build — excluded from the region library by nature); bounce/runner *generate* their "zones" (`extractZoneRules` / `generateZoneForSpecs`), payload-by-value and self-contained. The interface half (synthetic exits, location replacement, exit reconnection via `stitchGrid` + `wallOffUnusedExits`) is already substrate-agnostic and is **not** what distinguishes a content source; the two irreducible differences a reuse design must handle are **access-rule realisation** (a procedural substrate makes geometry match a rule via `placeFromRules`; fixed content must annotate/negotiate) and **exit-geometry decoupling** (a synthetic or `sidePortals`-relabelled exit moves freely; a maze exit is a real hole in a real wall). The region library (`docs/json/developer/procgen/…`, plan `CC/docs/plans/region-library-plan.md`) is the first content source that is *data, not code*.

**Out of scope (the eventual direction, not built).** Unifying the ordinal-driven `extractZoneRules` (substrate decides) with the spec-driven `generateZoneForSpecs` (engine decides) into one spec-driven content contract, and running jta on the sphere-growth driver, are the natural next steps once a second data-backed content source exists. They are deliberately deferred.

### Build-time — driver-facing adapter hooks (bounce and runner)

The sphere-growth driver and the Procgen Pipeline panel read a further set of optional hooks so the generic engine never names a substrate directly. **Bounce and runner both implement them** — runner carries 15 of the 18, all but `canHostExitGatesBraid`, `driftItems` and `prepareSphereGrowth` — and the generated matrix below is the authority on which entry carries which. (This sentence said *"today only bounce implements them"* until 2026-08-18, when generating the matrix from the entries showed otherwise; the hand-kept matrix it replaced said the same thing on its "Sphere-growth adapter hooks" row.) The semantics are documented at their consumers in `procgenPipelineEngine.js` / `sphereConfigHooks.js`:

- **Requirement-targeted zone generation:** `generateZoneForSpecs` / `generateZoneForSpecsGen`, `buildZoneSpecs`, `gateableItems` (null ⇒ full vocabulary; non-geometry gate terms become bridge-evaluated locks).
- **Gate-structure vetoes and hints:** `canHostExitGates`, `canHostExitGatesBraid`, `exitGateVeto`, `backPortalGated`, `hostsSurplusExitsNatively`, `gateHostingHint`.
- **Region contract:** `buildRegionContract` — called by the engine's generic dispatcher; the panel's "Edit ▸" flow and the verify scripts consume the result.
- **Pipeline panel integration:** `defaultProcgenParams`, `prepareSphereGrowth`, `buildRegionParams`, `renderProcgenParams` (per-substrate parameter defaults/controls).
- **Placement vocabulary:** `driftItems` (items a driver may attach to a surplus arrowless exit when granted free), `libraryItems`, `libraryObstacles` (merged with the shared defaults by consumers).

## Capability matrix

⛔⛔ **THE TABLE BELOW IS GENERATED FROM THE REGISTRY AND CHECKED IN.** It is not a human's selection of interesting capabilities any more: it is one column per entry `substrateRegistry.getAll()` returns and one row per field an entry actually carries, written by `scripts/procgen/generate-procgen-reference.mjs` and gated by

```
node scripts/procgen/generate-procgen-reference.mjs --check   # regenerate = no diff
```

Everything outside the two markers — including the hand-kept annotations below — is prose the generator never touches. The same data, with every full value rather than a shortened cell, is on the [reference page](https://peerinfinity.github.io/Archipelago-CC/modules/procgenDocs/reference.html#section-registry).

<!-- GENERATED:substrate-capability-matrix BEGIN — by scripts/procgen/generate-procgen-reference.mjs; do not edit; regenerate -->

**8 registered entries · 60 fields · 9 groups · 8 findings.** One column per entry the registry returns, one row per field an entry CARRIES — `substrateRegistry.getAll()` for the columns and `Object.keys(entry)` for the rows, so a field a substrate grows appears here without anybody editing a table.

Column order: the registry is a Map, so `getAll()` is INSERTION order; the generator imports the libraries in the order declared in `scripts/procgen/reference/registry.mjs` — the table at the end of this region prints it — and each entry lands when the library that registers it is imported.

Cell values: a cell in the markdown region is SHORT: a function is `fn`, a boolean is yes/no, an array of at most 3 short values is the list and any longer one is its count, an object is its key set or its key count. The reference page prints the full value.

Groups are this document's own § headings, matched to a field by the section that documents it.

**Identity**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `id` | maze | flash | bounce | runner | text_adventure | flash_seedling | jta | omsi |
| `label` | Maze | Flash | Bounce Demo | Runner Demo | Text Adventure | Seedling (region atlas) | JtA | Idle Loops |

**Runtime**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `deserializeWorld` | fn | fn | fn | fn | fn | fn | fn | fn |
| `iframeId` | — | flashSubstrate | bounceDemo | runnerDemo | — | — | jtaSubstrateWrapper | omsiSubstrateWrapper |
| `loadRegionEvent` | maze:loadRegion | flash:loadRegion | bounce:loadRegion | runner:loadRegion | textAdventure:loadRegion | flashSeedling:loadRegion | jta:loadRegion | omsi:loadRegion |
| `panelComponentType` | mazeRoomPanel | flashSubstratePanel | bounceDemoPanel | runnerDemoPanel | textAdventureSubstrateWrapperPanel | flashPanel | jtaSubstrateWrapperPanel | omsiSubstrateWrapperPanel |
| `serializeWorld` | fn | fn | fn | fn | fn | fn | fn | fn |
| `supportedFeatures` | 7 items | arbitrary_ap_locations | arbitrary_ap_locations, bounce_abilities | arbitrary_ap_locations, runner_abilities | 6 items | arbitrary_ap_locations | 2 items | 2 items |

**Playback**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `getPlaybackController` | fn | fn | fn | fn | fn | fn | fn | fn |

**Loop mode**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `loopSupport` | 6 keys | {customQueues, manual, queueActions} | 8 keys | 8 keys | 6 keys | {customQueues, manual, queueActions} | 8 keys | 8 keys |
| `loopSupport.customQueues` | yes | no | no | no | no | no | no | no |
| `loopSupport.executeVia` | — | — | solver | solver | — | — | solver | solver |
| `loopSupport.instant` | yes | — | yes | yes | yes | — | yes | yes |
| `loopSupport.manual` | yes | yes | yes | yes | yes | yes | yes | yes |
| `loopSupport.playback` | yes | — | yes | yes | yes | — | yes | yes |
| `loopSupport.queueActions` | regionMove, locationCheck, explore | regionMove | regionMove, locationCheck | regionMove, locationCheck | regionMove, locationCheck, explore | regionMove | regionMove | regionMove |
| `loopSupport.record` | yes | — | yes | yes | yes | — | yes | yes |
| `loopSupport.requiresLoopMode` | — | — | — | — | — | — | yes | yes |
| `loopSupport.summaryRecording` | — | — | yes | yes | — | — | — | — |
| `takeLastRecording` | fn | — | — | — | — | — | fn | fn |

**Cross-substrate sharing**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `sharing` | {mana} | — | — | — | {mana} | — | {items, mana} | {items, mana} |
| `sharing.items` | — | — | — | — | — | — | {getTypes} | {types} |
| `sharing.mana` | {loopActionDelegation} | — | — | — | {} | — | {} | {} |
| `sharing.mana.loopActionDelegation` | yes | — | — | — | — | — | — | — |

**Build-time — procedural substrates**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `applyContentModules` | fn | — | — | — | — | — | — | — |
| `extractPathsAndObstacles` | fn | — | — | — | fn | — | — | — |
| `generateRegionCore` | fn | — | — | — | fn | — | — | — |
| `placeFromItems` | fn | — | — | — | fn | — | — | — |
| `placeFromRules` | fn | — | — | — | fn | — | — | — |

**Build-time — content sources (zone-based substrates)**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `emitsSpiralContent` | — | — | — | — | — | — | yes | — |
| `extractZoneRules` | — | — | fn | fn | — | — | fn | fn |
| `spiralContentConfigKey` | — | — | — | — | — | — | datasetDoc | — |
| `victoryItem` | — | — | Victory | Victory | — | — | Victory | Victory |
| `zoneCount` | — | — | 5 | 6 | — | — | 30 | 1 |

**Build-time — driver-facing adapter hooks (bounce and runner)**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `backPortalGated` | — | — | fn | fn | — | — | — | — |
| `buildRegionContract` | — | — | fn | fn | — | — | — | — |
| `buildRegionParams` | — | — | fn | fn | — | — | — | — |
| `buildZoneSpecs` | — | — | fn | fn | — | — | — | — |
| `canHostExitGates` | — | — | fn | fn | — | — | — | — |
| `canHostExitGatesBraid` | — | — | fn | — | — | — | — | — |
| `defaultProcgenParams` | — | — | 10 keys | 8 keys | — | — | — | — |
| `driftItems` | — | — | Left arrow, Right arrow | — | — | — | — | — |
| `exitGateVeto` | — | — | fn | fn | — | — | — | — |
| `gateHostingHint` | — | — | fn | fn | — | — | — | — |
| `gateableItems` | — | — | null | 5 items | — | — | — | — |
| `generateZoneForSpecs` | — | — | fn | fn | — | — | — | — |
| `generateZoneForSpecsGen` | — | — | fn | fn | — | — | — | — |
| `hostsSurplusExitsNatively` | — | — | fn | fn | — | — | — | — |
| `libraryItems` | — | — | 7 keys | 6 keys | — | — | 48 keys | {Victory} |
| `libraryObstacles` | — | — | 6 keys | 5 keys | — | — | — | — |
| `prepareSphereGrowth` | — | — | fn | — | — | — | — | — |
| `renderProcgenParams` | — | — | fn | fn | — | — | — | — |

**Not documented in the registry reference**

| Field | `maze` | `flash` | `bounce` | `runner` | `text_adventure` | `flash_seedling` | `jta` | `omsi` |
|---|---|---|---|---|---|---|---|---|
| `applyPipelineConfig` | — | — | — | — | — | — | fn | fn |
| `captureLibraryEntry` | fn | — | fn | fn | — | — | — | — |
| `getSpiralContent` | — | — | — | — | — | — | fn | — |
| `instantiateAtlasEntryForSpecs` | fn | — | — | — | — | — | — | — |
| `instantiateLibraryEntry` | fn | — | fn | fn | — | — | — | — |
| `instantiateLibraryEntryForSpecs` | fn | — | fn | fn | — | — | — | — |
| `onContentEdit` | — | — | — | — | — | — | fn | — |
| `validateLibraryEntry` | fn | — | fn | fn | — | — | — | — |

**Which library registered which entry** — entries self-register on library import, and this is the order the generator imports them in.

| Library | Registers | Loads headless |
|---|---|---|
| `frontend/modules/mazeRoom/mazeRoomLibrary.js` | `maze` | yes |
| `frontend/modules/bounceDemo/bounceDemoLibrary.js` | `flash`, `bounce` | yes |
| `frontend/modules/runnerDemo/runnerDemoLibrary.js` | `runner` | yes |
| `frontend/modules/textAdventureSubstrateWrapper/textAdventureSubstrateWrapperLibrary.js` | `text_adventure` | yes |
| `frontend/modules/flashSubstrate/flashSubstrateLibrary.js` | — (nothing new) | yes |
| `frontend/modules/flashPanel/flashSeedlingLibrary.js` | `flash_seedling` | yes |
| `frontend/modules/jtaSubstrateWrapper/jtaSubstrateWrapperLibrary.js` | `jta` | yes |
| `frontend/modules/omsiSubstrateWrapper/omsiSubstrateWrapperLibrary.js` | `omsi` | yes |

**8 findings — where an ENTRY and this document disagree.** ⛔ Printed, never fixed: the generator does not edit the code or the prose it reads.

| Field | What |
|---|---|
| `applyPipelineConfig` | `applyPipelineConfig` is carried by [jta, omsi] and `docs/json/developer/procgen/substrate-registry.md` § *Entry contract* does not name it. It IS named in [stepped-pipeline.md] — so the field is documented, one door down from the reference a reader of an ENTRY would open. ⛔ Reported, not fixed: the generator never edits the code or the prose it reads. |
| `captureLibraryEntry` | `captureLibraryEntry` is carried by [maze, bounce, runner] and `docs/json/developer/procgen/substrate-registry.md` § *Entry contract* does not name it. No procgen doc names it at all. ⛔ Reported, not fixed: the generator never edits the code or the prose it reads. |
| `getSpiralContent` | `getSpiralContent` is carried by [jta] and `docs/json/developer/procgen/substrate-registry.md` § *Entry contract* does not name it. No procgen doc names it at all. ⛔ Reported, not fixed: the generator never edits the code or the prose it reads. |
| `instantiateAtlasEntryForSpecs` | `instantiateAtlasEntryForSpecs` is carried by [maze] and `docs/json/developer/procgen/substrate-registry.md` § *Entry contract* does not name it. No procgen doc names it at all. ⛔ Reported, not fixed: the generator never edits the code or the prose it reads. |
| `instantiateLibraryEntry` | `instantiateLibraryEntry` is carried by [maze, bounce, runner] and `docs/json/developer/procgen/substrate-registry.md` § *Entry contract* does not name it. No procgen doc names it at all. ⛔ Reported, not fixed: the generator never edits the code or the prose it reads. |
| `instantiateLibraryEntryForSpecs` | `instantiateLibraryEntryForSpecs` is carried by [maze, bounce, runner] and `docs/json/developer/procgen/substrate-registry.md` § *Entry contract* does not name it. No procgen doc names it at all. ⛔ Reported, not fixed: the generator never edits the code or the prose it reads. |
| `onContentEdit` | `onContentEdit` is carried by [jta] and `docs/json/developer/procgen/substrate-registry.md` § *Entry contract* does not name it. It IS named in [stepped-pipeline.md] — so the field is documented, one door down from the reference a reader of an ENTRY would open. ⛔ Reported, not fixed: the generator never edits the code or the prose it reads. |
| `validateLibraryEntry` | `validateLibraryEntry` is carried by [maze, bounce, runner] and `docs/json/developer/procgen/substrate-registry.md` § *Entry contract* does not name it. No procgen doc names it at all. ⛔ Reported, not fixed: the generator never edits the code or the prose it reads. |

<!-- GENERATED:substrate-capability-matrix END -->

### Hand-kept — the annotations the code does not carry

⛔ **These are NOT fields, which is why they are outside the region.** A field says `getPlaybackController` is a function; whether that function returns *the live panel's own controller* or *a host-side proxy to an in-game bot driver* is a reading of the code that no `Object.keys()` produces. The generated matrix says what each substrate DECLARES; this table says what those declarations MEAN, and a regeneration cannot eat it.

| Substrate | What the declarations mean |
|---|---|
| `maze` | Playback controller is the **live panel's own** — no proxy, no bridge. Fine-grained recorder (`takeLastRecording`), so it owns its live-play drain natively (per tile, gated on loops' `livePlayRegion()`). Bot mode works by **delegation** rather than by driving `walkTo`. Its procedural build hooks include hazards, applied through `applyContentModules`. |
| `bounce` | Playback controller is a **host-side proxy** publishing `bounce:playbackControl`; the in-game bot driver plays real physics from input synthesis. Record/Playback is the **summary** contract (M5) — the capture is the visit's net result, Playback applies it instantly, and because summary Playback is inherently instant the substrate declares `instant` for the focus-suppression seam but shows no checkbox. `zoneCount` comes from its zone table. The sphere-growth adapter hooks (the `generateZoneForSpecs` / gate-veto / pipeline-panel families) are bounce's alone. |
| `runner` | Same **summary** story as bounce (M5), same host-proxy → in-game bot driver, and its `zoneCount` comes from a **lazy** zone table. |
| `text_adventure` | The surviving wrapper (the direct-panel `textAdventureSubstrate` was deleted 2026-07-26); its `loopSupport` is pinned by `textAdventureSubstrateWrapperLibrary.test.js`. Playback controller is a host proxy → iframe bridge, publishing `textAdventureSubstrateWrapper:control`. **Coarse-only** capture: no recorder and no saved actions — the block's own queue entries *are* the recording (since M4 with an actions-less saved entry for the economy metadata). Its build hooks are the shared `adapterPrimitives.js` tile-grid implementations. |
| `flash` | `getPlaybackController` exists and returns **`null`** — the field's presence is not playback support. Built by `createFlashSubstrateEntry`, one entry per Flash game. |
| `flash_seedling` | The same factory as `flash` (2026-07-27), and since P3b it has **its own column** rather than inheriting flash's: it renders in the **flashPanel** panel with its own `flashSeedling:loadRegion` event and drops the inherited `iframeId`. What the matrix cannot show is the host-side glue that turns the game's own level changes into region moves — see [Flash Substrate](./flash.md#flash_seedling--a-real-games-map-as-procgen-regions). |
| `jta` | Fine-grained recorder since M4; the Bot honours Instant (`walkTo` on a fine substrate). Genuinely pre-built-by-reference — indices into one stateful game build — which is why it is excluded from the region library by nature. |
| `omsi` | Fine-grained since arc D, and **the recording is a plan**: the capture is the region's authored plan rather than a performed log, because the genre makes a performed log redundant. Bot mode is arc D2 — the solver engages the **fork's own planner**. No Instant: the fork has no fast-step surface. `zoneCount` is the region-split count or the town count. |


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
