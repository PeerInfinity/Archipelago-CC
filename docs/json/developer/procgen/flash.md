# Flash Substrate

The flash substrate (`frontend/modules/flashSubstrate/`, id `flash`) hosts recompiled Flash games — SWF → C → WASM via SWFRecomp-CC — in a same-origin iframe as procgen regions. The module ships a placeholder game page, so it is testable independently of any real recompiled game; its real significance is as the **shared iframe-substrate machinery** other substrates build on.

## The `__swfBridge` contract

The game page owns `window.__swfBridge.configure` / `pollItems` (the game side of the contract); the host-injected `bridge.js` completes the iframeAdapter handshake, configures the game from the region payload, applies received items via `pollItems`, and dispatches `user:locationCheck` when the game's ActionScript cooperatively calls `__swfBridge.sendLocation`. The host module (`index.js`) brokers `flash:loadRegion` activation and brings the panel forward.

## Per-game entries (one panel, many ids)

`createFlashSubstrateEntry` (`flashSubstrateLibrary.js`) is a factory: each Flash game can register its **own substrate id** with its own `supportedFeatures`, while every entry resolves to the same panel component and `flash:loadRegion` event. The module itself registers only the generic `flash` entry (a region whose game is identified purely by the payload's `gameId`). The factory also supplies the runtime plumbing — the exits-Map `deserializeWorld`/`serializeWorld` round-trip and a null playback stub — which is exactly what **bounce** builds its entry on top of, overriding the panel identity and adding build-time hooks ([Bounce Substrate](./bounce.md)).

The `iframeId` field on flash-family entries closes an init race: procgenPlayer re-publishes the active region's load event when that iframe announces `appReady`, covering both the initial load-before-subscribe window and iframe reloads.

## Capabilities

Flash regions are opaque minigames by default: `arbitrary_ap_locations` only, no build-time generation hooks (procgen just records `gameId` + params in the sidecar), no playback controller, and loop support of queueable `regionMove` plus manual play. Full contract: [Substrate Registry Reference](./substrate-registry.md).

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Bounce Substrate](./bounce.md) (the flagship consumer of this machinery)
