# Flash Substrate

The flash substrate (`frontend/modules/flashSubstrate/`, id `flash`) hosts recompiled Flash games — SWF → C → WASM via SWFRecomp-CC — in a same-origin iframe as procgen regions. The module ships a placeholder game page, so it is testable independently of any real recompiled game; its real significance is as the **shared iframe-substrate machinery** other substrates build on.

## The `__swfBridge` contract

The game page owns `window.__swfBridge.configure` / `pollItems` (the game side of the contract); the host-injected `bridge.js` completes the iframeAdapter handshake, configures the game from the region payload, applies received items via `pollItems`, and dispatches `user:locationCheck` when the game's ActionScript cooperatively calls `__swfBridge.sendLocation`. The host module (`index.js`) brokers `flash:loadRegion` activation and brings the panel forward.

## Per-game entries (one panel, many ids)

`createFlashSubstrateEntry` (`flashSubstrateLibrary.js`) is a factory: each Flash game can register its **own substrate id** with its own `supportedFeatures`, while every entry resolves to the same panel component and `flash:loadRegion` event. The module itself registers only the generic `flash` entry (a region whose game is identified purely by the payload's `gameId`). The factory also supplies the runtime plumbing — the exits-Map `deserializeWorld`/`serializeWorld` round-trip and a null playback stub — which is exactly what **bounce** builds its entry on top of, overriding the panel identity and adding build-time hooks ([Bounce Substrate](./bounce.md)).

The `iframeId` field on flash-family entries closes an init race: procgenPlayer re-publishes the active region's load event when that iframe announces `appReady`, covering both the initial load-before-subscribe window and iframe reloads.

## Capabilities

Flash regions are opaque minigames by default: `arbitrary_ap_locations` only, no build-time generation hooks (procgen just records `gameId` + params in the sidecar), no playback controller, and loop support of queueable `regionMove` plus manual play. Full contract: [Substrate Registry Reference](./substrate-registry.md).

## `flash_seedling` — a real game's map as procgen regions

`flash_seedling` (`frontend/modules/flashPanel/flashSeedlingLibrary.js`) is the region atlas's play-time substrate: a region is a **real Seedling level**, marked out in the atlas and compiled into `preset_sidecars` by `procgenPipeline/regionAtlasCompiler.js` (plan: `CC/docs/plans/region-atlas-plan.md`, Phase 4). It is built on `createFlashSubstrateEntry` but differs from every other flash-family entry in two ways, both deliberate:

- **It renders in `flashPanel`, not `flashSubstratePanel`,** and therefore owns its own `flashSeedling:loadRegion` event (the bounce precedent). The game is driven by flashPanel's shipped `WasmBridgeAdapter` — teleports, item writes, progressive/fusion expansion, location checks. Building a second AP↔game translation inside flashSubstrate's in-iframe bridge would duplicate solved work, and the dialects differ anyway: the SWFRecomp wasm shim speaks `game.configure(json)` + `queueItems`, the substrate bridge speaks `__swfBridge.configure(obj)` + `pollItems`.
- **It declares no `iframeId`.** flashPanel's embed is a plain `<iframe>` that never announces `iframe:appReady`, so procgenPlayer's re-publish race-closer has nothing to fire on. The equivalent is handled inside the glue instead (below).

### The host-side glue

`seedlingRegionBinding.js` is a pure state machine (region load + property reports in, effects out); `seedlingRegionGlue.js` applies the effects. Detection is **level-granular**: an atlas region binds to a whole level, so a boundary crossing is the game's own `Main.level` change, tie-broken on the reported spawn coordinates when two exits of one region reach the same level. Sub-level physical boundaries (live player x/y against a marked tile line) are deferred — they need BridgeGeneric changes, re-injection and a wasm rebuild. Logical sub-regions are unaffected: they carry rules and are never physically triggered, so every sub-region of a region shares its level.

The signals are three `Main` statics declared in `games/seedling.json` — `playerPositionX`, `playerPositionY`, `level`, in that order, so a `new Game(level, x, y)` reports its tie-break coordinates before the level change. They ride the **one** configure at boot: `BridgeGeneric.doConfigure` refuses a second configure for the life of a game instance, so widening the set later needs a page reload.

Three behaviours are worth knowing before touching this:

| | |
|---|---|
| **Teleport echo** | The glue's own arrival teleport changes `level`, and that report is indistinguishable from the player walking through a door. An arrival is marked in flight and its matching report swallowed, clearing on match or after 15 s. A teleport to the level the game is *already* on arms nothing — arming would eat the next real crossing. |
| **First-read baseline** | BridgeGeneric reports the whole declared set at boot, so the first `level` report is where the game already is, not a crossing. It doubles as the "game is alive" signal that releases an arrival queued while the wasm page was still waiting on its own ▶ Start gesture (which can take minutes). |
| **Unmapped levels** | The starter atlas covers 3 of Seedling's 116 levels, by design. A level change the current region has no exit to **warns loudly** on both the console and the panel log and does *not* move the AP region. A silent no-op would read as a complete map; a crash would make a partial atlas unusable. |
| **The park** | While ANOTHER substrate owns the region, the game keeps running — flashPanel has no inactive overlay, deliberately (below) — so the binding is PARKED instead: the glue subscribes `procgen:activeSubstrateChanged` and every property report is dropped, position included, no crossing published, no warn, no echo armed, and an in-flight echo cleared. An arrival that lands meanwhile (procgenPlayer publishes the target's `loadRegion` **before** the broadcast, so the return leg always does) is queued on the same slot the not-yet-booted case uses and released exactly once. Default is ACTIVE, so a preset that never broadcasts is unaffected. |

`arrivedFrom` is consumed **host-side** here — flashSubstrate's own bridge drops it — which is what makes "arrive at the exit you came through" work. With no arrivedFrom (the synthesized `Menu → start-region` hop, or a move whose source region is outside the warehouse) the region's first declared exit stands in; that is an info line, not a warning.

No `SubstrateInactiveOverlay` in v1: the flashPanel panel predates the overlay and is not procgen-only (it still serves the Stage-1 direct-client presets), so wiring the overlay would mean teaching it a panel that is legitimately active with no procgen substrate at all. Deliberately skipped rather than half-wired. That ruling stands — what changed is the BINDING, not the panel: parking is about which reports may be read as AP movement, and `flashPanelUI.js` is untouched.

### Crossing OUT of this substrate — `external`

A world can wire a Seedling room's door to a room another substrate plays. The compiled exit says so: `external: true` plus `target_substrate`, with **`target_level` and `target_spawn` null**.

Both halves are load-bearing. The null is not tidiness — before it, the compiler copied the target region's `map_ref` into `target_level`, and a maze region's `map_ref` is its *library entry index*. So a Seedling room with both a same-substrate and a cross-substrate door carried two exits claiming the same `target_level`, and `resolveCrossingExit`'s two-candidate tie-break could send an ordinary walk home through the maze door. Nulling it drops the exit from that filter by construction (`null !== 0`) with no change to the host.

The field is **present-or-absent**, never `external: false`: every committed flash sidecar is byte-pinned, and a boolean on every exit would move all of them. `report.external_exits` counts the crossings off the emitted sidecars.

An external door is **host-driven**. Seedling's only transition primitive is a one-way jump to a declared point, so a world link out of Seedling is authored `one_way: true` and the return leg is a second link from the other side; the game itself learns nothing about worlds. Today the host recognises such a door in the payload and parks while the other substrate plays — what it cannot yet do is notice the *departure* at the moment it happens, because the game's `level` report has already moved by the time the swap lands and carries no door identity. That is M1's work, and it is the only piece missing.

Gate: `scripts/procgen/verify-seedling-atlas-play.mjs` (skips when the wasm artifact is absent).

The same atlas also compiles to a **maze**-flavoured preset (`seedling_atlas_maze`) — the same geometry and the same computed item gating, playable with no wasm artifact, which is why the in-app suite can test that one and not this one. The two are separate presets — but *never merged* was always the narrower claim than it sounded. What holds is **one sidecar per AP region**: the player's warehouse has one slot per region and dispatches that region's load event by the sidecar's own substrate id, so two sidecars for one region would ask two substrates to own it. What does NOT hold, since the editor-integration arc, is one substrate per preset. An atlas region may name its own `substrate`, `compileRegionAtlas` dispatches the sidecar builder per region on it, and a single preset may therefore carry real flash rooms beside maze ones. The flavour is only what a region that names nothing falls back to. See [Maze Substrate](./maze.md#a-real-games-map-as-maze-regions).

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Bounce Substrate](./bounce.md) (the flagship consumer of this machinery)
