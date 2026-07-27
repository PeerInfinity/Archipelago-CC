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

`arrivedFrom` is consumed **host-side** here — flashSubstrate's own bridge drops it — which is what makes "arrive at the exit you came through" work. With no arrivedFrom (the synthesized `Menu → start-region` hop, or a move whose source region is outside the warehouse) the region's first declared exit stands in; that is an info line, not a warning.

No `SubstrateInactiveOverlay` in v1: the flashPanel panel predates the overlay and is not procgen-only (it still serves the Stage-1 direct-client presets), so wiring the overlay would mean teaching it a panel that is legitimately active with no procgen substrate at all. Deliberately skipped rather than half-wired.

Gate: `scripts/procgen/verify-seedling-atlas-play.mjs` (skips when the wasm artifact is absent).

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Bounce Substrate](./bounce.md) (the flagship consumer of this machinery)
