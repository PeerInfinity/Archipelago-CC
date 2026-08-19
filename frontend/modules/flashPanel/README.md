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
section is a hand-added block (on the seed-1 seedling preset and
robotkitty_tilemap) that a regeneration would drop; re-add it after
regenerating. The `seedling_atlas` preset is the exception: its block is
**compiled** by `regionAtlasCompiler`, so regenerating it preserves the wiring.

The module is enabled in the default module config (as of the region-atlas
Phase-4 work) as well as in `modules-flash.json`. It stays idle — status "no
game configured" — until the loaded rules carry a `flash_panel` section, so
presets without one are unaffected.

## Region-atlas play mode (`flash_seedling`)

Beyond the direct-client role above, this module hosts the region atlas's
play-time substrate: atlas regions are real Seedling levels, and the game's own
level transitions drive procgen region moves.

| File | Role |
|---|---|
| `flashSeedlingLibrary.js` | the `flash_seedling` registry entry (flashPanel component, own `flashSeedling:loadRegion`) |
| `seedlingRegionBinding.js` | the pure state machine — arrival spawn, crossing resolution, echo suppression, boot baseline, unmapped-level policy |
| `seedlingRegionGlue.js` | applies its effects: teleports through the adapter's invocation queue, crossings as `user:regionMove` |
| `atlases/` | the authored atlases + the extracted level map |

`FlashBridgeAdapter.onStateReport` is the seam: a raw `(property, value)` hook
fired at the TOP of `_onStateChanged`, above the echo and first-read
suppressions (which exist for AP *location* detection and would swallow the
position/level reports this consumer needs).

Architecture, traps and the ruling history: `docs/json/developer/procgen/flash.md`
and `CC/docs/plans/region-atlas-plan.md`.

## Wasm artifacts — the `seedling-wasm` submodule

`wasm/` **is** the git submodule
[`PeerInfinity/seedling-wasm`](https://github.com/PeerInfinity/seedling-wasm)
(Unlicense, public), mounted at exactly the path every loader already used. It
was a hand-copied gitignored directory until 2026-08-19, which is why the live
GitHub Pages site could not boot the game at all: `watch.html` HEAD-probes
`wasm/seedling_bot_ap/game.html` and printed *"… is missing"* to every visitor,
because nothing published the bytes. Nothing about the placement changed a
single path — `WASM_DIR`, `WASM_PAGE`, the presets' `flash_panel.wasm` and
every script's `PAGE_NAME` are untouched; `actions/checkout` with
`submodules: recursive` (which the deploy and CI already pass) now puts the
files where those paths point.

```sh
git submodule update --init frontend/modules/flashPanel/wasm
```

Each build directory carries **four files and no more** — `game.html`,
`swf_bridge_avm2.js`, and the `<name>.js` / `<name>.wasm` that `game.html`
names in its own `<script src>`. That is measured, not assumed: a copy stripped
to those four boots headless on swiftshader, registers
`{wireCheck, configure, readState}` and makes zero failed requests, identically
to a control arm on the unstripped copy. `test.swf`, `test_info.json`,
`.demo_type` and `index.html` are gone (nothing tracked reads them, and
`index.html` was a redirect to `../../../demo.html`, an SWFRecomp-CC path that
never existed in this repo).

⛔ **A build's payload filename is not always its directory name.**
`seedling_bot_ap_phase3/` carries `seedling_bot_ap.{js,wasm}` — the directory
was renamed, the build was not. The submodule's `builds.json` `js`/`wasm`
fields are the authority. (`verify-seedling-bot-differential.mjs` already knew
this; it keeps a separate `PAGE_BASE` for exactly that reason.)

### The pin policy

> **A build is in the submodule iff a TRACKED file of this repo names it.**

Four qualify today:

| build | named by |
|---|---|
| `seedling_bot_ap` | `seedlingDemo/watchViewer.js` (`WASM_PAGE`) + ~24 `scripts/procgen/{probe,plan,solve,run,verify}-seedling-*.mjs` |
| `seedling_teleport_ap` | the three seedling presets' `flash_panel.wasm`, `procgenPipeline/regionAtlasCompiler.js`, two verify rows |
| `seedling_bot_ap_p4b` | the `SEEDLING_PAGE` **default** of `check-seedling-{generated-set,save-stamp,vanilla-manifest}.mjs` |
| `seedling_bot_ap_phase3` | the `SEEDLING_PAGE` **default** of `probe-seedling-level-set-transport.mjs` |

A default *is* a pin — the environment variable is only an override, and that
probe's own header makes the build identity load-bearing (it asserts the older
build fails arms 2–6, which is the whole claim). `scripts/procgen/check-seedling-wasm-pins.mjs`
gates the agreement between the tracked-reference set, the submodule's
whitelist `.gitignore`, what git tracks there, and `builds.json`; it runs in
`.github/workflows/seedling-wasm.yml`. Its reference scan enumerates all three
spellings that occur here — the literal `wasm/<name>` path, a preset's
`"wasm": "<name>/game.html"`, and a `PAGE_NAME = process.env.SEEDLING_PAGE || '<name>'`
default.

Historical builds (`seedling_bot_ap_3b`, `_m0`, `_mut`, `_p4`) are **not**
pinned and are not in the submodule. They stay on a developer's disk in that
same directory, untracked — the submodule's `.gitignore` is a whitelist, so git
never sees them — and stay reachable as `SEEDLING_PAGE=seedling_bot_ap_3b`.

### Adding or retiring a build

Add: copy the four files in, add `!/<name>/` to the submodule's `.gitignore`,
add its `builds.json` entry, commit **inside** the submodule, then bump the
pointer in a separate outer commit. Retire: delete the whitelist line and the
manifest entry, once nothing tracked here names it. Either way
`check-seedling-wasm-pins.mjs` reds until all four views agree.

Builds come from SWFRecomp-CC (`docs2/examples/avm2/<name>/`); the regeneration
steps (inject → build → deploy) live in the SWFRecomp avm2 suite's
`CURRENT_STATUS.md`.

Headless note: the wasm page needs WebGPU, which comes up headless on
`--enable-unsafe-webgpu --ignore-gpu-blocklist --enable-unsafe-swiftshader
--use-angle=swiftshader` at software-rendering speed —
`scripts/procgen/verify-seedling-wasm-bridge.mjs` uses exactly those flags. It
now SKIPs only when the submodule is not checked out. Under WSLg, Chrome floods
`Invalid Texture "bitmap_tex"` WebGPU errors (adapter texture-array cap vs
Seedling's 284 bitmaps) — cosmetic, absent on real GPUs. There is no
`SharedArrayBuffer` and no pthread use, so Pages needs no COOP/COEP headers.
