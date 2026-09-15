# flashPanel

Embeds a Flash game with an injected Archipelago bridge (flash-ap-api's
`BridgeGeneric.as`) and wires it to the frontend event bus: in-game pickups
dispatch `user:locationCheck`, the stateManager inventory drives item writes
into the game, and the game config's teleport block powers the
region/location teleport UI.

This is the direct client layer (Seedling Stage 1) — distinct from
`flashSubstrate`, the procgen-substrate lineage. Both stay (the
SWFRecomp task-split plan's decision).

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
  "wasm": "seedling_bot_ap_p4d/game.html"
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

⚠⚠ **AND THE SEED-1 `seedling` PRESET'S BLOCK IS PROVISIONAL, NOT SETTLED**
(⚖ user, 2026-08-30, via R9 session 12). Nothing on the PYTHON side emits it:
`Generate.py` and the world writers know nothing about `flash_panel`, so the
block survives only because nobody has regenerated that preset since it was
typed in — and the next regeneration silently drops it, taking the panel's
whole wiring with it. ⇒ treat it as a placeholder for a producer that does not
exist yet: **when the randomizer becomes official, the PRODUCING side declares
this block**, the way `regionAtlasCompiler` already does for `seedling_atlas`.
Until then a preset regeneration is a two-step, and the second step is manual.
⛔ Do not build anything that assumes the block is durable.

⛓ The ONE code path that emits a `flash_panel` block today is
`procgenPipeline/regionAtlasCompiler.js:161` — `FLASH_PANEL_WIRING.seedling`,
the compiler's own wiring table. It is the only CODE source of the presets'
wiring; every other block in `frontend/presets/` was written by hand.

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

### The reset's boot position — and why its `source` row exists

`seedlingRandomizerWiring`'s reset prefers **`SeedlingRegionBinding.lastSpawn` /
`lastLevel`**: `Main.playerPositionX/Y` and `level`, the constructor's OWN
arguments, which the binding already consumes off every declared report
(`seedlingRegionBinding.js:333-334`). Preferring them takes the half-tile
correction off the happy path entirely, and `lastLevel` is what ARMS the
wrong-room guard. ⛔ **Read, never written** — this wiring does not touch the
binding's state, so the dependency is one-directional and a parked binding
cannot be corrupted by a reset.

⚠ **THE FALLBACK IS SILENT, WHICH IS WHY THE `source` ROW IS NOT DECORATION.**
When the binding has seen nothing — it drops every report while PARKED, and a
preset with no sidecars may never have gone active — the position is derived
from the ROSTER instead, less the map document's own `tile_size / 2`. That is
correct arithmetic on an entity position rather than the argument that produced
it, and downstream the two answers are indistinguishable: same shape, same
fields, no error. So the reset reports **which one answered** —
*"the binding's last declared playerPosition"* or *"the roster, less the map's
half-tile (N)"* — and that row is the only thing standing between a guard armed
off a declared level and a guard armed off a computation nobody checked.

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
fields are the authority. (`check-seedling-bot-differential.mjs` already knew
this; it keeps a separate `PAGE_BASE` for exactly that reason.)

### Build capabilities — the BUILD-SIDE half of feature detection

⚖ **USER, 2026-08-29: every frontend feature detects from the loaded preset's
DATA whether it applies. There is no opt-in flag anywhere in this panel.** A
feature that needs ActionScript the running build may or may not carry needs a
second datum, and that one belongs to the build: each `builds.json` entry
declares a `capabilities` array.

```json
{ "name": "seedling_bot_ap_p4d", "capabilities": ["apitem"], "js": … }
```

- **Mandatory, and `[]` is a real answer.** An entry with no `capabilities`
  field says *nothing*; one with `[]` says *"measured, this build has none"*.
  Collapsing them would make a manifest that predates the field look like a
  build that lost a feature, and the panel would silently stop offering it.
- **The vocabulary is declared ONCE, in the consumer** —
  `seedlingRandomizerEligibility.js`'s `WASM_BUILD_CAPABILITIES`.
  `check-seedling-wasm-pins.mjs` **imports** it rather than spelling a second
  copy, and refuses any name outside it: a typo (`apitm`) is not a name the
  consumer looks for, so it would mean exactly what absence means.
- **Looked up by the DIRECTORY the preset names**, never by a literal here:
  `flash_panel.wasm` is `"<build>/game.html"`, so the panel fetches
  `wasm/builds.json` and finds the entry whose `name` is that directory.

`apitem` is the only capability so far: the build carries `Pickups/APItem.as`
and the `<apitem>` line in `Game.as`'s XML loop, so a delivered level set's AP
placement becomes a real pickup instead of an element the XML loop ignores.
`seedlingRandomizerEligibility.js` is the whole predicate — four facts, and it
names the first one that is false (plan §17.1, §17.5).

### The pin policy

> **A build is in the submodule iff a TRACKED file of this repo names it.**

The number that qualify is the gate's, not this table's — run
`node scripts/procgen/check-seedling-wasm-pins.mjs` and it prints the count off
four independent views.

| build | named by |
|---|---|
| `seedling_bot_ap_p4d` | **EVERY DEFAULT, since EDITOR INTEGRATION slice P2** (⚖ user, 2026-08-30). The three seedling presets' `flash_panel.wasm` (moved by slice P1, because the panel's randomizer wiring detects eligibility from a build's own `capabilities`); `seedlingDemo/watchWasm.js`'s `WASM_PAGE` and `check-seedling-wasm-pages.mjs`'s `BUILD` literal, which are ONE fact spelled twice on purpose (that gate asserts the watch iframe's src against its own literal — importing it would be a fixed point); the `SEEDLING_PAGE` **default** of `check-seedling-bot-differential.mjs`, of `check-seedling-{generated-set,save-stamp,vanilla-manifest}.mjs`, of `probe-seedling-level-set-transport.mjs` and of ~35 more `scripts/procgen/{probe,plan,solve,run,derive,rerecord}-seedling-*.mjs`; the ARTIFACT and iframe-src literals of `check-seedling-{wasm-bridge,atlas-play}.mjs`, which follow the PRESET rather than a default of their own; `check-seedling-ap-placement.mjs`'s `SEEDLING_PAGE` default (since SEEDLING HEADLESS WEBGPU slice R2, 2026-09-12 — it was the `apitem` control's, on p4c) and its M1 rows; and the two TESTS that assert a name (`watchWasm.test.js`, `regionAtlasCompiler.test.js`). ⛓ **The only CODE source of the presets' wiring is `procgenPipeline/regionAtlasCompiler.js:161`** (`FLASH_PANEL_WIRING.seedling`) — every other preset block is hand-added, see the ⚠ below. **57 tracked files, 77 lines** (`:!*.md`); 61 / 85 counting `.md` — `git grep -ln`/`git grep -n`, the same population as p4c's first pair. RE-MEASURED 2026-08-30 at `d25a45b84`. ⚠ This cell said **6 / 6** dated 2026-08-29 and was already wrong by the time slice P2 cut its branch — `git grep` answered **9 / 18** at `511b271af`, one day and one merge later. A count is a measurement of a TREE STATE and it goes wrong by sitting still, so a cell like this is only as good as the SHA beside it. ⛓ The ONLY build declaring `apitem`, and since slice P4 it declares `arm` beside it (`capabilities: ["arm","apitem"]`) |

⛓⛓⛓ **p4b AND p4c RETIRED ON 2026-09-12 (SEEDLING HEADLESS WEBGPU slice R2),
AND THE CONTROLS WENT WITH THEM — ⚖ ruled by the user.** Until that day two
builds were pinned as NEGATIVE CONTROLS rather than by use: `p4b` (no `arm`)
for the two dead-frame corrections `check-seedling-wasm-ship.mjs` CLAIM 6 and
`r5Acceptance.js`'s `preSwapCorrection`, held by a deliberate path in this
table and gated by pins row (g); and `p4c` (no `apitem`) for
`check-seedling-ap-placement.mjs`'s H7 ABSENT/PRESENT pair and P1-e's
`panel-control-p4c` arm, held by that file's `SEEDLING_PAGE` default and gated
by row (f). The ruling: *"I'm not aware of any reason to care whether the code
behaves correctly with the old wasm builds. I think it just needs to behave
correctly with the new build."* → *"Yes, let's add the retirement slice to the
plan. And let's still keep seedling_original."*

⇒ the host supports ONE bot build — the manifest's `default`, p4d — plus the
`demo`, `seedling_original`, which is not a test control. Each absent-capability
branch was proved DEAD on the shipped build by a mutant before it was deleted,
the two corrections were folded to p4d's value (the dead-frame constants
re-measured on p4d), rows (f) and (g) and the (h2) exemption left the pins gate,
and `check-seedling-ap-placement.mjs` now asks its question of the build that
ships: the rewritten AP tile holds an `APItem`. ⛔ **The cost, stated once:** a
host regression in an absent-capability branch is undetectable from here on —
by design, because no shipped build reaches one. The as-built is
the headless arc's plan §10.

The history below is kept as history: every "p4b" and "p4c" in it is a reading
taken ON those builds while they were pinned.

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
(`check-seedling-bot-differential.mjs --win --only=<the 20 r8-* tapes>`,
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
the R9 kickoff §19.11.

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
`scripts/procgen/check-seedling-wasm-bridge.mjs` uses exactly those flags. It
now SKIPs only when the submodule is not checked out. Under WSLg, Chrome floods
`Invalid Texture "bitmap_tex"` WebGPU errors (adapter texture-array cap vs
Seedling's 284 bitmaps) — cosmetic, absent on real GPUs. There is no
`SharedArrayBuffer` and no pthread use, so Pages needs no COOP/COEP headers.
