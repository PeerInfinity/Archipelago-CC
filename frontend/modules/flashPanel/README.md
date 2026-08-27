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
  "wasm": "seedling_bot_ap_p4c/game.html"
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
GitHub Pages site could not boot the game at all: `watch.html` HEAD-probes the
build's `game.html` and printed *"… is missing"* to every visitor, because
nothing published the bytes. The move itself changed no path — `WASM_DIR`,
`WASM_PAGE`, the presets' `flash_panel.wasm` and every script's `PAGE_NAME`
were untouched; `actions/checkout` with `submodules: recursive` (which the
deploy and CI already pass) puts the files where those paths point.

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

**ONE qualifies today**, and the number is the gate's, not this table's — run
`node scripts/procgen/check-seedling-wasm-pins.mjs` and it prints the count off
four independent views.

| build | named by |
|---|---|
| `seedling_bot_ap_p4c` | **every default**: `seedlingDemo/watchWasm.js` (`WASM_PAGE`) and `watchEditor.js`, the three seedling presets' `flash_panel.wasm`, `procgenPipeline/regionAtlasCompiler.js`, `check-seedling-wasm-pages.mjs`'s `BUILD` literal, the `SEEDLING_PAGE` **default** of `verify-seedling-bot-differential.mjs`, of `check-seedling-{generated-set,save-stamp,vanilla-manifest}.mjs`, of `probe-seedling-level-set-transport.mjs` and of ~35 more `scripts/procgen/{probe,plan,solve,run,derive,rerecord}-seedling-*.mjs`, three verify rows, and the two TESTS that assert the name (`watchWasm.test.js`, `regionAtlasCompiler.test.js`). **53 tracked files, 69 lines** — derived with `git grep -ln <name> -- ':!*.md'`, never typed |
| `seedling_bot_ap_p4b` | ⛔ **nothing names it as a DEFAULT any more, and this table cell is the only thing holding its pin: `wasm/seedling_bot_ap_p4b/game.html`.** That path is written here DELIBERATELY, and saying so is the point — see below. ⛓ **R9 slice 12h: it is no longer a mere placeholder — p4b is the ONLY tracked build WITHOUT the `arm` capability, and two live corrections key on its absence** |

⛔⛔ **p4b's PIN IS HELD BY ONE LINE OF PROSE, ON PURPOSE, AND IT IS THE ONLY
MANUFACTURED REFERENCE IN THIS REPOSITORY.** When slice 12g′ flipped the
defaults it expected p4b to stay pinned "for free" through the two lines of
`docs/json/developer/procgen/seedling-bot.md` that record which build §43's
and §45's measurements ran against. **Measured: the gate does not see them.**
Its reference scan reads five SPELLINGS — a `wasm/<name>/` path, a quoted
`PAGE_NAME`, a `SEEDLING_PAGE` default, a preset's `flash_panel.wasm`, and
split literals — and backticked prose is none of them. So the choice was to
retire p4b immediately or to write a path the gate can see. The path above is
that second choice, taken with its cost named: **~34 MB of tracked artifact
held by one table cell.**

⛔⛔⛔ **THE SCHEDULED RETIREMENT IS CANCELLED, AND THE REASON IS MEASURED.**
This cell used to read *"RETIRE IT AT SLICE 12h's CLOSE"*. Slice 12h looked and
found that **p4b is the ONLY tracked build without the `arm` capability** — the
whitelist admits exactly two directories, `p4b` and `p4c`, so on a fresh
checkout there is no third build to stand in for it. Two live corrections are
keyed on that capability's ABSENCE and are therefore proved only by p4b:

- `check-seedling-wasm-ship.mjs`'s CLAIM 6 — `armsAfterSwap ? 0 :
  BOOT_PRESWAP_FRAMES` (R9 12g′, `12934b870`);
- `r5Acceptance.js`'s `preSwapCorrection` — the six R5 dead-frame rows the
  first `--tier=full` run since the flip caught (R9 12h).

A capability-keyed correction is proved only by the arm that LACKS the
capability. Retiring p4b would delete the negative control for both of them on
the same day the second one was written, and would also make 12g′'s own
discriminator — *"p4b refused at arm frame 31 and p4c passed at arm frame 31"* —
unreproducible. **So p4b stays pinned, and its ~34 MB is no longer the price of
a placeholder: it is the price of a control.**

⇒ The pin retires when the LAST consumer of `arm == null` does, not on a date.
⚠ Do not "tidy" the path out of this cell: the gate will red on the next commit,
correctly, saying p4b is tracked and unnamed.

⛓ **p4b → p4c ON 2026-08-26 (R9 slice 12g′, ⚖ ruling 58's (F)).** One
behavioural difference and it is an ARM TIME, not a game rule: `botStart` used
to set `armed = true; tick = 0` beside the world swap it requested, and
`FP.world = x` only writes `FP._goto` — the swap lands one `Engine.update()`
later — so the first `Bot.update` ran against the OUTGOING world and, whenever
that world's fade had already ended, recorded t=0 off a player about to be
discarded. p4c arms on the first frame where `FP.world` IS the instance
`botStart` constructed. Measured on the real page: p4b REFUSES the world-swap
gate 3/3 at 1.0 s of pre-boot idle and p4c PASSES 7/7 across 0/1.0/2.0 s, with
the observation stream **0/146 differing from p4b's own winning drive**.

⚠ **THIS TABLE WAS STALE FOR A DAY, AND THAT IS THE ARGUMENT FOR THE GATE.**
It said *"Three qualify today"* and listed `seedling_bot_ap_phase3` after that
build had already retired (the wasm-hygiene slice, 2026-08-19: its own probe's
arms 6 and 7b FAIL on it and pass on p4b). The whitelist, `builds.json` and
`git ls-files` had all moved; only the prose had not, because prose is the one
view nothing reads back. ⇒ **believe the gate's count, not this table's**, and
when they disagree the table is the bug.

⛓ **`seedling_bot_ap` was retired on 2026-08-19, and the retirement was
EARNED rather than assumed.** It was the R8 bot build every one of those
paths named. `seedling_bot_ap_p4b`'s bridge surface is a strict superset of
its verbs (`botForgeSaveStamp`, `botLevelSet`, `botLoadLevels` on top of the
eight), so the question was only whether it is the same GAME — and the gate
that pinned the old build answered it: the R8 tape sweep
(`verify-seedling-bot-differential.mjs --win --only=<the 20 r8-* tapes>`,
comparing against `seedling_bot_ap`'s **own** oracle recordings) read
**534 PASS / 0 FAIL / 67 SKIP, ALL CHECKS PASSED** on both builds, run back
to back with nothing edited in between. All 602 check lines agree in order and
in text but for 13, and every one of those 13 is a free-running clock
(`game_time`, `hits_timer`) whose control arm — the *same* build re-run —
moved at least as far. ⛔ No expectation, tape or battery byte moved. The
directory stays on developers' disks, untracked, reachable as
`SEEDLING_PAGE=seedling_bot_ap`.

A default *is* a pin — the environment variable is only an override, and the
`_phase3` probe's own header makes the build identity load-bearing (it asserts
the older build fails arms 2–6, which is the whole claim).
`scripts/procgen/check-seedling-wasm-pins.mjs` gates the agreement between the
tracked-reference set, the submodule's whitelist `.gitignore`, what git tracks
there, and `builds.json`; it runs in `.github/workflows/seedling-wasm.yml`. Its
reference scan enumerates **four** spellings, because all four occur here: the
literal `wasm/<name>` path, a preset's `"wasm": "<name>/game.html"`, a
`process.env.SEEDLING_PAGE || '<name>'` default, and a bare
`PAGE_NAME = '<name>'` constant — the last added by the retirement slice, which
found 23 files naming a build in a spelling the scan could not see.

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
`CURRENT_STATUS.md`, and the concrete one-shot recipe for the bot build is in
`NewDocs/plans/seedling-bot-r9-kickoff.md` §19.11.

⛔ **A REBUILD ON A CHANGED TOOLCHAIN NEEDS A CONTROL BUILD FIRST** (R9 slice 9b,
2026-08-22). `build_wasm_avm2.sh`'s `.o` cache keys on MTIME, mxmlc is not
reproducible, and SWFModernRuntime moves independently — so a rebuilt artifact
differs from its predecessor for reasons that have nothing to do with the AS3
change you are making, and a behavioural move has nowhere to be attributed.
Rebuild at the **unchanged** AS3 with `FRESH=1` first, install it, and run the
whole measurement on it: any move there is a TOOLCHAIN finding and a stop. Only
then edit and rebuild. Measured cost: 17 min for the control, 22 for the edit —
against not knowing which of the two caused a move. (Memory
`feedback_stale_object_cache_poisons_the_build` is the older, sharper half: a
stale cache links fine and kills the renderer on boot.)

Headless note: the wasm page needs WebGPU, which comes up headless on
`--enable-unsafe-webgpu --ignore-gpu-blocklist --enable-unsafe-swiftshader
--use-angle=swiftshader` at software-rendering speed —
`scripts/procgen/verify-seedling-wasm-bridge.mjs` uses exactly those flags. It
now SKIPs only when the submodule is not checked out. Under WSLg, Chrome floods
`Invalid Texture "bitmap_tex"` WebGPU errors (adapter texture-array cap vs
Seedling's 284 bitmaps) — cosmetic, absent on real GPUs. There is no
`SharedArrayBuffer` and no pthread use, so Pages needs no COOP/COEP headers.
