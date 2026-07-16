# flashPanel

Embeds a Flash game with an injected Archipelago bridge (flash-ap-api's
`BridgeGeneric.as`) and wires it to the frontend event bus: in-game pickups
dispatch `user:locationCheck`, the stateManager inventory drives item writes
into the game, and the game config's teleport block powers the
region/location teleport UI.

This is the direct client layer (Seedling Stage 1) — distinct from
`flashSubstrate`, the procgen-substrate lineage. Both stay; see
`NewDocs/plans/seedling-swfrecomp-task-split.md`.

## Two transports

| | real Flash (`swf`) | wasm iframe (`wasm`) |
|---|---|---|
| Embed | `<object>` tag (`_embedSwf`) | same-origin `<iframe>` (`_embedWasmIframe`) |
| Player | NPAPI Flash (Basilisk + Clean Flash) or Ruffle | SWFRecomp-recompiled page (WebGPU + wasm) |
| Callbacks | methods on the `<object>` element | `contentWindow.__swfBridge.game.<cb>()` |
| Item writes | Flash polls host-window `getItemQueue` | host pushes via `__swfBridge.queueItems` (WasmBridgeAdapter push loop) |
| State events | host-window `stateChanged` global | `__swfBridge.onStateChanged` override |
| Start | plays on load | user must click the page's ▶ Start button (user-gesture requirement for WebGPU/audio) |

The AS3 bridge is the same injected `BridgeGeneric` in both, so mapping,
progressive/fusion expansion, echo suppression, and startup suppression are
shared (`FlashBridgeAdapter`; `WasmBridgeAdapter` subclasses it with the
inverted plumbing).

## Wiring

A world's preset `rules.json` carries a `flash_panel` section:

```json
"flash_panel": {
  "config": "seedling.json",
  "swf": "seedling_injected.swf",
  "wasm": "seedling_teleport_ap/game.html"
}
```

`config` resolves under `games/`, `swf` under `swf/`, `wasm` under `wasm/`.
Either transport key may be omitted. `componentState` overrides
(`configPath`/`swfPath`/`wasmPath`) win over rules.json.

Transport choice: `moduleSettings.flashPanel.runtime` — `auto` (default:
wasm when a `wasm` page is wired, real Flash otherwise), `flash`, `wasm`.

Note: preset rules.json files are generated artifacts — the `flash_panel`
section is a hand-added block (currently on the seed-1 seedling preset and
robotkitty_tilemap) that a regeneration would drop; re-add it after
regenerating.

## Wasm artifacts (not committed)

`wasm/` is gitignored (the Seedling page is ~31 MB of wasm). Stage the
Seedling teleport build from SWFRecomp-CC's delivered example:

```sh
mkdir -p frontend/modules/flashPanel/wasm
cp -r ~/CC/SWFRecomp-CC/docs2/examples/avm2/seedling_teleport_ap \
      frontend/modules/flashPanel/wasm/
```

Regeneration steps (inject → build → deploy) live in the SWFRecomp avm2
suite's `CURRENT_STATUS.md`. Durable hosting (submodule / Pages / CI build)
is a Stage-2 decision — this manual copy is the interim arrangement.

Headless note: the wasm page needs WebGPU, which headless Chromium lacks —
`scripts/procgen/verify-seedling-wasm-bridge.mjs` runs headed (WSLg/X
DISPLAY) and skips when the artifact is absent. Under WSLg, Chrome floods
`Invalid Texture "bitmap_tex"` WebGPU errors (adapter texture-array cap vs
Seedling's 284 bitmaps) — cosmetic, absent on real GPUs.
