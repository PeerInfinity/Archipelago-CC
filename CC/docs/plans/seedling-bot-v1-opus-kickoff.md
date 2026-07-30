# Region atlas Phase 8 — real-game bot, Stage v1 (Opus kickoff)

Written 2026-07-30 (Fable design session). Parent plan:
`CC/docs/plans/region-atlas-plan.md` §Phase 8 "Real-game surface". Memory
topic: `project_tilemap_region_arcs.md`. This doc is the implementation brief
for the FIRST rung of the real-game bot ladder: **v1 — collision disabled,
move to targets**, JS-first, then in the Seedling source, verified by
differential tapes against the recompiled game.

Recon-verified against: Archipelago-CC HEAD `e8b0ba949`, seedling fork
`stage1-teleport-build` @ `22d4362` / `bot` branch, and the on-disk toolchain
(2026-07-30). **Re-verify any anchor that smells stale before building on it
— recon first.**

> **Implementation-session recon COMPLETE 2026-07-30** (Archipelago-CC HEAD
> `355460f50`). All three flagged ⚠ items are resolved, one unflagged risk was
> cleared, and **two substantive corrections** were made to this document —
> both applied inline below and summarised with evidence in §8. Read §8 before
> trusting any physics description you remember from the first draft.

## 0. Mission in one paragraph

Land the load-bearing contracts of the whole bot ladder — the **input tape
format**, the **compiled-in AS3 tape bot** with its own ExternalInterface
control surface, the **JS engine seed** (`frontend/modules/seedlingDemo/`),
and the **differential-tape harness** (committed oracle recordings + a
staleness verify script) — and prove them at the v1 rung: the real recompiled
Seedling, with collision disabled by a bot-build flag, replays a tape and
lands where the JS transcription says it lands, tick for tick. The recompiled
game is the SOLE oracle for real-game claims; the JS side is the iteration
surface, never a load-bearing stratum.

## 1. Settled rulings — do NOT re-litigate

- **Maze-surface slice is COMPLETE** (2026-07-28). This slice is the
  real-game surface. Seedling-only; RWK postponed indefinitely.
- **Route (b)**: the bot is compiled into the Seedling source and recompiled
  (user-accepted leaning 2026-07-29; Stage 1 proved the toolchain). Route (a)
  more-injected-ActionScript is the recorded alternative; overturning needs
  new evidence, not taste.
- **Per-stage JS-first** (user, 2026-07-30): each ladder rung (v1 movement →
  v2 collision/pathing → v3 item-gated terrain → v4 puzzles → v5 enemies)
  lands in JavaScript first, then in the actual Seedling code. Differential
  tapes (same tape through JS and wasm, compare positions/level transitions)
  verify each JS stage as it lands. The full JS-port SUBSTRATE is a separate
  later arc.
- **`Mobile.solids` resolved**: base list
  `["Solid","Tree","Rock","Rope","ShieldBoss"]` IS the player-traversal
  truth; entity overrides matter only at the v5 rung.
- **Rulings taken 2026-07-30 (this design session, user):**
  1. **JS home = a new frontend module `frontend/modules/seedlingDemo/`**
     (runnerDemo precedent: pure engine core + vitest beside it). No panel,
     no substrate registration, therefore NO `__BUNDLED_MODULES__` entry yet.
  2. **Oracle recordings are COMMITTED fixtures.** The wasm artifact is
     machine-local forever (no CI build exists in either repo), so the
     recorded observation streams (small JSON) are committed and vitest
     checks JS-vs-recorded-oracle on every CI run. The local verify script's
     job is the staleness gate: "the recording still matches the live wasm"
     (SKIPs exit-0 without the artifact).
  3. **Separate wasm page `seedling_bot_ap/`** beside `seedling_teleport_ap/`.
     Existing Phase-4 presets/verifiers keep their proven artifact untouched.
     Superseding the teleport page is a later, deliberate swap.
  4. **This kickoff is v1 ONLY.** v2 (collision/pathing) gets its own kickoff
     fed by v1's lessons.

## 2. Verified recon facts + anchors

All seedling paths relative to `~/CC/seedling` (fork `PeerInfinity/Seedling`,
upstream `ConnorUllmann/Seedling`, MIT). Branches: `main` (pristine ==
upstream), `stage1-teleport-build` (checked out: WhirlPool.png case symlink +
Main.as skip-splash — the tree the shipped wasm builds match), `bot`
(pristine main + the case fix only, pushed).

### 2.1 Input — how the game reads keys

- **No named controls.** `Input.define` is used once in the whole tree and
  only by FlashPunk's debug Console. Seedling passes **raw keycodes** via
  `Player.as:58-59`:
  `keys = [Key.RIGHT(39), Key.UP(38), Key.LEFT(37), Key.DOWN(40), Key.X(88)
  primary, Key.C(67) secondary, Key.X(88) talk, Key.V(86) inventory,
  Key.I(73) inventory-alt]`.
- **Three read modes, all used**: movement = `Input.check` (held,
  `Player.as:1492-1519`); item use = `Input.pressed` (down edge,
  `Player.as:1525-1531`); **dialogue/NPC/seal = `Input.released`** (full
  down-then-up: `NPCs/NPC.as:191`, `SealController.as:95`,
  `Enemies/FinalBoss.as:97`). The tape vocabulary must express hold-SPANS —
  a span of length 1 yields a press edge on tick N and a release edge on
  tick N+1, covering all three modes.
- **FlashPunk `Input` state is unreachable directly**: `_key`/`_press`/
  `_release` are `private static` (`net/flashpunk/utils/Input.as:284-290`),
  no public setter exists. **The zero-patch synthesis path**: `Input.enable()`
  registers its listeners on `FP.stage` (`Input.as:180-181`), so
  `FP.stage.dispatchEvent(new KeyboardEvent(KEY_DOWN/KEY_UP, true, false, 0,
  keyCode))` drives input exactly like hardware. `onKeyDown` reads only
  `e.keyCode` (+`shiftKey`), and the `_key[code]` guards (`Input.as:230,243`)
  make repeated KEY_DOWN idempotent — a hold is just "dispatch DOWN once,
  dispatch UP when the span ends".
- ✅ **VERIFIED IN THE RECOMPILED RUNTIME (2026-07-30)** — this is the
  assumption the whole slice rests on, and it holds. `flash.events.KeyboardEvent`
  is a real builtin class with a `keyCode` getter/setter
  (`SWFModernRuntime/src/avm2/avm2_events.c:1765-1771`), `dispatchEvent` is
  implemented (`ed_dispatch_event`, `:692`) and funnels into
  `avm2_dispatch_event`. The **hardware** path lands on the SAME sink:
  `input_deliver` (`IN_KEY_DOWN`) → `input_handle_key` → `dispatch_key` →
  `avm2_keyboard_event_new` → `avm2_dispatch_event`
  (`avm2_display.c:11332-11343, 11392`). A synthesized dispatch is therefore
  not merely "like" hardware, it is the same call. Two harmless deltas:
  hardware targets `g_stage_focus ?? ctx->stage` (ours targets stage directly,
  so FlashPunk's stage listener fires AT_TARGET instead of BUBBLING — its
  handler never reads `eventPhase`), and ours skips the runtime-internal
  `g_key_down_map`/`keys_down_phys_add` bookkeeping, which nothing in
  Seedling or FlashPunk's `Input` reads.
- **Hook point: top of `Main.update()` (`src/Main.as:61-63`), before
  `super.update()`** — strictly before `World.update()` → `Player.input()`
  and before `Engine.onEnterFrame` calls `Input.update()`
  (`net/flashpunk/Engine.as:173`) which clears the edge queues. Injected
  events are live for exactly one frame and self-clear.
- **Never synthesize M(77), R(82), ESC(27)**: `Game.update` reads them
  BEFORE entities (`Game.as:793-801`) and several branches call
  `Input.clear()` or rebuild the world (`Game.as:796, 1274-1284`).
  `Key.W(87)` opens a URL (`Player.as:1533`) — also never.
- `receiveInput` can silently eat a tape: written false at
  `Player.as:722` (pit fall), `Game.as:888/944/953` (cutscenes), `:929`
  (restore), `Enemies/BobBoss.as:199,227`, `Puzzlements/ShieldLock.as:37,49`.
  v1 (level 0, noclip, no combat) avoids these, but the bot should surface
  `receiveInput == false` in its status rather than stall silently.

### 2.2 Tick loop + determinism

- Frame order (`Engine.as:155-180`): compute `FP.elapsed` → `update()`
  (→ `Main.update` → `Game.update` → `World.update` → entities) →
  `Input.update()` (clears edges) → `render()`.
- `Main.as:27` `FPS = 60`, `Main.as:36` `super(160, 160, FPS)`; Engine
  `fixed` defaults **false** (`Engine.as:35`) → variable-timestep
  `ENTER_FRAME` branch. **But `FP.elapsed` appears in ZERO lines of game
  code** (grep-verified; only Tween/Spritemap/Emitter — animation/particles).
  All Player/Mobile physics and timers are per-frame constants: **one update
  call == one fixed physics step. A tick-indexed tape is deterministic for
  movement.** Never index a tape by wall-clock.
- **RNG caveat (v5 concern, not v1)**: `Math.random()` in 47 game-code
  sites — screen shake, dust, rain (cosmetic; camera only) but also
  enemy/seal logic (`Game.as:682`). Pure-movement tapes are deterministic;
  combat tapes are not.
- **Room-load dead ticks**: `Game.as:813` `if (blackCover <= 0)
  super.update()`; `blackCover` starts 1, steps 0.05/frame (`Game.as:518-519`)
  → ~20 ticks of no entity updates after every `new Game(...)`. Deterministic
  and frame-counted, but a tape must account for it. World swaps land at
  END of tick (`Engine.checkWorld`, `Engine.as:242-252, :77`). v1 stays in
  one level; this matters from v2 on — record it, don't model it yet.
- **Live position is `player.x/.y` ONLY.** `Main.playerPositionX/Y` and
  `Main.level` are static accessors over the Flash save file
  (`SharedObject.getLocal("shrumsave")`, `Main.as:44, 189-194`), written at
  SPAWN time only (`Game.as:526-529, 555-562`, constructor `:620-624`).
  There is no per-frame write. The bot must record `player.x/.y` itself.
- ✅ **SharedObject persistence — RESOLVED 2026-07-30, and the worry inverts.**
  The recompiled runtime does not model persistence AT ALL:
  `flash.net.SharedObject` is an in-process, per-name cache (`g_so_cache`,
  `SWFModernRuntime/src/avm2/avm2_amf.c:1907-1929`) whose header comment says
  persistence to a `.sol` file is not modeled, and `so_flush` (`:2003`) is a
  no-op that just returns `"flushed"` so callers see success. Nothing reaches
  browser storage. **Every page load therefore starts from an empty
  `shrumsave` — reproducibility is free**, and no neutralization, fresh-context
  dance, or reset command is needed for correctness.
  - `Main.level` stays well-defined regardless: `Game`'s constructor assigns
    `level = _level` (`Game.as:620`), whose instance setter routes to
    `Main.level` → `SAVE_FILE.data.level`. Before any write the getter returns
    **-1**, a clean sentinel, never NaN (`Main.as:193`).
  - `Main.startSave()` (`Main.as:225`) normalizes every save field through
    `x = x` getter/setter round-trips, so an empty save boots to all-false
    items — exactly the v1 state we want.
  - ⚠ If a `botReset` is ever wanted anyway, do NOT call `Main.clearSave()`:
    it calls `begin()`, which adds another `MedalPopup` child on every
    invocation (`Main.as:56`). Reconstruct `FP.world = new Game(0, 80, 128)`
    directly instead.

### 2.3 Movement physics (what JS v1 must transcribe)

Continuous pixel physics, NOT grid-based. Per tick, `Mobile.mobileUpdate()`
(`src/Mobile.as:31-45`, gated by `!Game.freezeObjects`):
`friction()` → `input()` → `moveX(v.x)` → `moveY(v.y)`.

- `friction()` (`Mobile.as:73-84`): `v.normalize(max(v.length - f, 0))`,
  then snap any component `< 0.05` to 0. **Vector-length friction: diagonals
  run √2 faster** than axis-aligned (both axes saturate independently). A JS
  port that damps per-axis diverges immediately.
  - `Point.normalize` and `Point.length` are exactly specified in the
    recompiled runtime, in doubles, so transcribe them literally
    (`avm2_globals.c:888-909`): `length = sqrt(x*x + y*y)`; normalize is
    `if (length !== 0 && !isNaN(length)) { norm = thickness/length;
    x *= norm; y *= norm; }`. Note the zero/NaN guard means
    `normalize(0)` on a moving point yields exactly `(0, 0)`.
- `input()` (`Player.as:1479-1537`): early-return if `!receiveInput ||
  frozenTimer > 0 || fallFromCeiling`; `accel = moveSpeed` (`:1489`); four
  independent if-blocks (`:1492-1519`), no else-chains.
  - ⛔ **CORRECTED 2026-07-30 — the original claim here was WRONG.** The
    first draft said "one held frame saturates the axis — velocity is
    effectively binary per axis". It is not. The guard is
    `if (v.x < moveSpeed) v.x += accel` — a *threshold test followed by a
    full-magnitude add*, i.e. **overshoot, not a clamp**. Velocity exceeds
    `moveSpeed` on most ticks and settles into a limit cycle, not a constant.
    Holding RIGHT from rest on level-0 ground (`dMS = 0.8`, `f = 0.25`)
    numerically yields:
    ```
    t=0 v.x=0.80   t=1 v.x=1.35   t=2 v.x=1.10
    t=3 v.x=0.85   t=4 v.x=1.40   t=5 v.x=1.15
    t=6 v.x=0.90   t=7 v.x=1.45   t=8 v.x=1.20   t=9 v.x=0.95
    ```
    A ~3-tick cycle whose envelope drifts upward. **A JS transcription
    written to the old description diverges on tick 1.** Transcribe the
    branch verbatim; do not "clean up" the guard into a clamp.
- `moveX/moveY`: 1-px-at-a-time swept collision, X fully resolved before Y.
  **v1 noclip bypasses exactly this** — the sweeps are the v2 rung.
  - ⛔ **CORRECTED 2026-07-30: `Player` OVERRIDES both movers**
    (`Player.as:1687` / `:1717`). Patching `Mobile.moveX/moveY` — as §3.2
    originally suggested — would not affect the player at all. The overrides
    carry a dead shield branch (`c_s` is unconditionally `null`; the real
    `collideTypes` call is commented out), so the live condition reduces to
    `!c` and noclip means "skip the `collideTypes` call, always `x += d`".
  - The per-iteration step is `d = min(1, abs(rel) - i) * FP.sign(rel)`
    with `FP.sign` = `value < 0 ? -1 : (value > 0 ? 1 : 0)` (`FP.as:142`),
    and `Entity.x/.y` are **`Number`** (`Entity.as:27,32`), so sub-pixel
    remainders persist. Because velocity exceeds 1 on most ticks (above),
    a typical tick performs TWO adds, not one. Mirror the loop in JS rather
    than using the closed form `x += rel`: the totals are algebraically
    identical and a 60-tick check found no float divergence, but keeping the
    loop shape costs nothing and makes the v2 collision rung a smaller diff.
- Constants (`Player.as:76-89`): `dMS = 0.8` walk, `dMSstair = 0.4`,
  `dMSwater = 0.45`, sliding 1 / friction 0.025, waterfall 0.8;
  `Mobile.as:14-16` `DEFAULT_FRICTION = 0.25`, `WATER_FRICTION = 0.5`.
  Speed selected per terrain state (`Player.as:516-537, 690-716`) — in v1
  (noclip, level 0 open ground) the walk constant dominates, but transcribe
  the selection structure, not just the number.
  - ⚠ **Sharpened 2026-07-30 — noclip does NOT bypass terrain speed.**
    `getState()` (`Player.as:656-668`) runs every tick from `Player.update`,
    reads the nearest `Tile` under `(x, y + checkOffsetY)`, and assigns
    `state`; `moveSpeed = moveSpeeds[state]` (`:522`) then selects among
    `dMS` / `dMSstair 0.4` / `dMSwater 0.45` / `dMSwater/2`. Collision is
    what noclip removes; **terrain typing is independent of collision and
    still applies.** A v1 tape that wanders onto a water or stairs tile
    changes speed mid-run, and the JS side would need the real level-0
    tilemap to match.
    **Consequence for slice 1**: give the JS engine a pluggable
    `terrainStateAt(x, y)` seam stubbed to `0` for v1, and keep fixture
    tapes on plain ground. Do NOT hardcode `0.8` — with the seam in place,
    the differential *catches* a tape that violates the ground-only
    assumption (JS says 0.8, the game says 0.45) instead of the assumption
    hiding inside a constant. The `state` setter also has side effects
    (pit/water entry, `Music.playSound`), a second reason to stay on ground.
- `Player.update()` order (`Player.as:458-563`): state/shield/drown checks →
  friction+speed selection → attacks → `prev = (x,y)` → `super.update()`
  (input + moves happen HERE, `:554`) → sprites/hit/pit → hard clamp to
  world bounds (`:560-561`). The clamp is part of v1 physics — transcribe it.
  - Concretely (2026-07-30): the clamp is
    `x = min(max(x, originX), FP.width + originX - width)` and likewise for
    y. `setHitbox(4, 5, 2, 2)` (`Player.as:295, 414` — `normalHitbox =
    Rectangle(2, 2, 4, 5)`) gives `width=4, height=5, originX=originY=2`, and
    `FP.width = FP.height = 160` (`Main.as:36`), so v1's bounds are
    **x ∈ [2, 158], y ∈ [2, 157]**.
- Numeric types: AS3 `Number` == IEEE-754 double == JS number; the
  recompiled C runtime also runs doubles. **Expect EXACT equality in the
  differential; treat an epsilon as a defect to investigate, not a tolerance
  to configure.** If a genuine representation mismatch is proven (e.g. a
  float coercion in SWFRecomp's runtime), document it in the tape-format doc
  with the evidence, then bound it.

### 2.4 The toolchain, end to end (P1 — the canonical pipeline)

An AS3 edit pays ALL of this (~15 min mxmlc+SWFRecomp + an effectively cold
multi-minute emcc pass + copy). **Design consequence: the AS3 bot is a
generic, data-driven tape interpreter compiled in ONCE per rung; all
iteration lives in tapes + JS.**

1. **Source prep** (already on branches): WhirlPool.png case symlink
   (committed on both `stage1-teleport-build` and needed on `bot`) +
   skip-splash boot (`Main.as` → `Game.menu = false; FP.world = new
   Game(0, 80, 128)`; commit `22d4362`) — **cherry-pick `22d4362` onto
   `bot`** (unattended boot is impossible without it: the injected ORIGINAL
   waits on the Newgrounds preloader click; that's why the teleport build
   exists).
2. **AS3 → SWF**: `~/CC/seedling_teleport_build/build_teleport.sh` — mxmlc
   from `~/CC/flex-sdk` (`-target-player=11.1`, the only playerglobal
   present), links `~/projects/Seedling/src/NewgroundsAPI.swc`. Model a
   sibling `~/CC/seedling_bot_build/` dir on it (build script + output SWF).
3. **AP bridge injection (SWF/bytecode level)**: canonical in
   `~/CC/flash-ap-api` — `inject.py <in.swf> <out.swf>` splices
   BridgeGeneric's DoABC before the first ShowFrame (bridge itself changes
   NOTHING in this slice). `BridgeGeneric.as` stays untouched — see §2.5.
4. **SWF → C**: `cd <recompiled dir with config.toml + test.swf>` then
   `~/CC/SWFRecomp-CC/SWFRecomp/build/run-SWFRecomp.sh config.toml` (the
   wrapper's `ulimit -v` matters — raw SWFRecomp can `bad_alloc` the WSL2
   VM). Regenerates ~165 MB of C; `abc0_methods.c` alone is 15 MB.
5. **C → wasm**:
   `SWFRecomp/scripts/build_wasm_avm2.sh seedling_bot_ap <recompiled dir>`.
   ⚠ the `.o` cache keys on MTIME, not flags — `FRESH=1` after any define
   or struct-layout change. Exports include `_avm2_ei_dispatch` (the EI
   inbound dispatcher the shim ccalls).
6. **Deploy**: `deploy_wasm_avm2.sh seedling_bot_ap <recompiled dir>` →
   `~/CC/SWFRecomp-CC/docs2/examples/avm2/seedling_bot_ap/` (self-contained
   page: game.html from `wasm_wrappers/swf_bridge_game_page.html`, the .js,
   the ~31 MB .wasm, `swf_bridge_avm2.js`, test.swf).
7. **Stage into the frontend** (manual, gitignored):
   `cp -r ~/CC/SWFRecomp-CC/docs2/examples/avm2/seedling_bot_ap
   frontend/modules/flashPanel/wasm/` (`.gitignore:339-342` covers
   `flashPanel/wasm/`).

Regen recipe pointer: SWFRecomp avm2 suite `CURRENT_STATUS.md` ("inject.py →
build_wasm_avm2.sh → deploy_wasm_avm2.sh"). The existing teleport artifacts'
lineage is md5-verified: `~/CC/seedling_teleport_build/Seedling_teleport.swf`
(mxmlc) → `~/CC/seedling_ap_build/Seedling_teleport_ap.swf` (inject) →
`docs2/examples/avm2/seedling_teleport_ap/` (deploy) → `flashPanel/wasm/`
(cp). Leave all of those untouched.

### 2.5 The bridge/EI surface — why the Phase-4 fence is NOT in play

`swf_bridge_avm2.js` (committed copy at
`frontend/modules/flashPanel/wasm/seedling_teleport_ap/swf_bridge_avm2.js`;
the deploy script ships it into every page):

- **game → host**: `stateChanged(p, v)` (monitored properties),
  `getItemQueue()` (drain-on-read, polled every frame by BridgeGeneric).
- **host → game**: ANY `ExternalInterface.addCallback(name, fn)` the AS3
  makes is auto-wrapped by the shim's `__registerCallback` as
  `__swfBridge.game.<name>(arg)` (string in / string out through
  `avm2_ei_dispatch`). Call only between frames (any JS task/timer is fine).
- `queueItems(...)` carries property writes, path writes and INVOCATIONS,
  drained by BridgeGeneric's per-frame poll.

**Therefore the bot registers its OWN callbacks**
(`botLoadTape`/`botStart`/`botStatus`/`botDrain`/`botReset`) and never
touches `BridgeGeneric.doConfigure`, `games/seedling.json`'s
`state_properties`, or the one-configure-per-instance fence. No bridge
recompile, no `flash-ap-api` change, no configure widening. (If a later rung
ever DOES widen `state_properties`: the list rides the one configure at boot,
so a page reload — which a new build is by definition — picks it up; the
fence only forbids reconfiguring a live instance.)

### 2.6 Frontend wiring facts (for the verify script)

- `flashPanelUI.js:23` `WASM_DIR = './modules/flashPanel/wasm/'`; a preset's
  `flash_panel` block selects the page (`wasm: 'seedling_teleport_ap/game.html'`).
  `regionAtlasCompiler.js:92` hardcodes that value for `seedling_atlas` —
  **do not change it in this slice**; the bot page is driven directly by the
  verify script, not via a preset.
- The v1 differential runner does NOT need the full frontend: serve the repo
  (dev server :8000, check before starting — `ss -ltn | grep ":8000"`), load
  `frontend/modules/flashPanel/wasm/seedling_bot_ap/game.html` same-origin,
  click the page's start button (user gesture powers WebGPU+audio), then
  drive `__swfBridge.game.bot*`.
  Precedent: `scripts/procgen/verify-seedling-wasm-bridge.mjs`.
  - ⛔ **CORRECTED 2026-07-30: run HEADLESS.** The first draft said the
    precedent is headed because "headless Chromium lacks WebGPU". That is
    stale — both `verify-seedling-wasm-bridge.mjs:58-65` and
    `verify-seedling-atlas-play.mjs:75-81` launch headless with
    `--enable-unsafe-webgpu --ignore-gpu-blocklist --enable-unsafe-swiftshader
    --use-angle=swiftshader --no-sandbox`, and both document WebGPU coming up
    on swiftshader. The differential runner can be fully unattended.
  - Boot sequence, verified against the shipped `game.html`: load the page,
    wait for `window.__runtimeReady`, then Playwright-`click('#btn-start')`.
    The page gates on a real user gesture (`__swfBridgeStart()` must be called
    from one) and a Playwright click supplies it; the page also focuses the
    canvas on click so key input works.
- SKIP pattern (established, deliberate): existence-check the artifact,
  `console.log('SKIP: ...')`, `process.exit(0)` —
  `verify-seedling-atlas-play.mjs:30-52` is the template.

## 3. Design, concretely

### 3.1 The tape contract (the load-bearing artifact)

One schema, consumed by BOTH the AS3 bot and the JS engine. Committed doc +
fixtures under `frontend/modules/seedlingDemo/`. Sketch (implementer owns
the final shape; keep these properties):

```json
{
  "tape_version": 1,
  "game": "seedling",
  "boot": { "level": 0, "x": 80, "y": 128 },
  "noclip": true,
  "inputs": [
    { "key": "right", "from": 0, "to": 45 },
    { "key": "down",  "from": 20, "to": 45 },
    { "key": "primary", "from": 60, "to": 61 }
  ]
}
```

- **Tick-indexed hold-spans**, `from` inclusive / `to` exclusive, tick 0 =
  the first tick the bot is armed (after `botStart`, post-boot-baseline).
  Spans express all three read modes (check/pressed/released).
- **Symbolic key names** with ONE canonical name→keycode table (right:39,
  up:38, left:37, down:40, primary:88, secondary:67, inventory:86,
  inventory2:73) stated in the schema and asserted by both consumers —
  an unknown name is a loud error on both sides, never a skipped input.
  M/R/Esc/W are not in the vocabulary at all.
- **Observation stream** (the differential's currency), recorded by each
  side per tick: `{ "ticks": [{ "t": 0, "x": 80, "y": 128, "level": 0 },
  ...], "transitions": [] }` (transitions empty in v1; the field exists so
  the format doesn't churn at v2). Positions are `player.x/.y` (see §2.2).
- **Oracle recordings** are these streams as produced by the wasm build,
  committed beside their tapes (`fixtures/` in the module). Small JSON —
  a 600-tick run is a few KB.

### 3.2 AS3 side (`bot` branch)

- Cherry-pick `22d4362` (skip-splash) onto `bot` first.
- **`src/Bot.as`** (new): a static, data-driven tape interpreter.
  - Hooked from the top of `Main.update()` before `super.update()`
    (`Main.as:61-63`) — one added line in Main (plus construction/reference
    so mxmlc links the class).
  - Per armed tick: dispatch `KeyboardEvent` DOWN/UP at `FP.stage` per the
    span schedule (DOWN once at span start, UP at span end — the `_key`
    guards make repeats harmless anyway); record
    `{t, player.x, player.y, Main.level}` into a growing buffer; advance the
    tick counter ONLY when entities actually updated (mirror the
    `blackCover <= 0` gate so dead frames don't consume tape — assert
    against `Game`'s cover state rather than guessing).
    - Both gate flags are directly readable (verified 2026-07-30):
      `Game.blackCover` is a `public var` (`Game.as:518`) and
      `Game.freezeObjects` is a `public static var` (`Game.as:511`). **Gate
      the tick counter on `blackCover <= 0 && !Game.freezeObjects`** — see
      §7 Q2, which this answers from source.
  - Status surface: current tick, armed/finished/error, and
    `receiveInput == false` detection (status, not stall — the
    silent-watcher lesson).
  - EI callbacks (registered in Bot's init):
    `botLoadTape(json) -> "ok"|"error:..."`, `botStart() -> "ok"`,
    `botStatus() -> json`, `botDrain() -> json` (drains the observation
    buffer; chunk if EI strings need it), `botReset() -> "ok"`.
- **Noclip patch**: a `Bot.noclip` static consulted in **`Player.moveX` /
  `Player.moveY` (`Player.as:1687` / `:1717`)** — ⛔ **CORRECTED 2026-07-30:
  NOT `Mobile.moveX/moveY`, which `Player` overrides**; patching the base
  class alone is a silent no-op for the player. Keep the loop and skip only
  the `collideTypes` call (`if (Bot.noclip || !c) x += d;`) rather than
  collapsing to `x += _xrel` — same result, same code shape as the JS side,
  and v2 then only has to re-arm the condition. Default false — a shipped bot
  build with the flag off plays identically to the teleport build. Set from
  the tape header at `botLoadTape`.
- Build: `~/CC/seedling_bot_build/` (dir modeled on
  `seedling_teleport_build/`: build script, then inject → recompile →
  build_wasm → deploy as `seedling_bot_ap`). Keep the script in the build
  dir like its precedent; the fork carries only source.
- Push `bot` branch when green (push-by-default applies; branches we own).

### 3.3 JS side (`frontend/modules/seedlingDemo/`)

runnerDemo is the structural precedent (pure core + `*.test.js` +
`*.slow.test.js`, no UI). v1 files, roughly:

- `tapeFormat.js` — parse/validate/normalize tapes + the key table + the
  observation-stream shape. Loud errors, no silent defaults.
- `playerPhysicsV1.js` — the v1 transcription: per-tick
  `friction → input → integrate` exactly as §2.3 (vector friction via the
  literal `Point.normalize` form + 0.05 snap, the **overshooting**
  `if (v < moveSpeed) v += accel` guard — NOT a clamp, see §2.3's
  correction — `moveSpeed` selected through a pluggable `terrainStateAt()`
  seam stubbed to state `0`, the `min(1, abs(rel)-i)*sign(rel)` mover loop,
  and the `x ∈ [2,158] / y ∈ [2,157]` clamp). No collision (that IS v1).
  Keep the code shaped like the AS3 it transcribes — v2 will extend it with
  the sweeps.
- `tapeRunner.js` — run a tape through the physics, emit the observation
  stream.
- `botDriverV1.js` — targets → tape synthesis (move-to-target with noclip:
  axis-aligned + diagonal segments; overshoot-aware since velocity
  saturates instantly but friction decays over ticks).
- `fixtures/` — committed tapes + committed oracle recordings.
- Tests: `seedlingDemo` vitest — format round-trip; physics unit cases
  (diagonal √2, friction snap, saturation); **the differential leg: every
  committed tape's JS stream equals its committed oracle recording
  EXACTLY**; botDriver reaches its targets within the same run.

### 3.4 The differential harness

- **CI leg (vitest, always runs)**: JS-vs-committed-recording, exact.
- **Staleness gate (local, SKIPs without artifact)**:
  `scripts/procgen/verify-seedling-bot-differential.mjs` — boots the
  `seedling_bot_ap` page (§2.6), replays every committed tape via
  `botLoadTape`/`botStart`, drains observations, asserts byte-equality with
  the committed recordings, then runs one live bot-driver task (targets in
  level 0, tape synthesized by `botDriverV1`, final position asserted from
  the GAME's drained observations — the game's word, not the driver's).
- **Recording regeneration**: a `--record` mode on the same script (writes
  fixtures; the default mode never writes). Regen requires the artifact —
  same regime as every atlas `--check` regen.

## 4. Slices (commit each separately to main; JS-first inside the arc)

1. **Tape contract + JS module seed** — `seedlingDemo` module: format,
   physics v1, tapeRunner, botDriver, unit tests + hand-authored tapes with
   EXPECTED streams computed by the JS engine (clearly labeled as
   provisional until slice 3 replaces expectations with oracle recordings).
   Vitest green.
2. **AS3 bot + bot build** — cherry-pick, `Bot.as`, noclip patch, build
   dir, full pipeline run, page boots, `__swfBridge.game.bot*` callbacks
   answer, one manual tape replays visibly. (This slice pays the expensive
   round trips — batch the AS3 iteration.)
3. **Record + reconcile** — record oracle streams for the fixture tapes,
   commit recordings, make the JS differential leg green against them.
   **Expect the physics-fidelity iteration to happen HERE, in JS** — that's
   the point of the whole arrangement. Investigate any non-exactness before
   tolerating it (§2.3).
4. **The verify script** — `verify-seedling-bot-differential.mjs` (replay +
   staleness + live bot-driver task + `--record`), SKIP pattern, wired into
   the same "run it when the artifact exists" convention as its siblings.
5. **Docs + memory** — procgen doc (new `seedling-bot.md` or a § in
   `flash.md`, implementer's call), plan-doc Phase 8 checkbox + as-built
   notes, memory topic update. Move this kickoff
   NewDocs→`CC/docs/plans/` per convention when implementation starts.

## 5. Witness gates — what "v1 done" means

Hard gates (intended-solution-first: witness completion is the gate):

- **G1 (CI, vitest)**: every committed tape's JS stream == its committed
  oracle recording, exactly; botDriver's synthesized tape reaches all its
  targets in the JS engine.
- **G2 (local, verify script)**: live wasm replay of every committed tape ==
  the committed recordings (staleness); the live bot-driver task ends at its
  targets per the game's own drained observations. SKIPs without artifact.
- **Independent stratum**: the recordings COME FROM the real game — the JS
  side never generates its own oracle. The one shared assumption left is the
  tape format itself; the G2 live replay closes that loop.
- **Mutation checks (run once, record in the commit message)**: perturb
  `DEFAULT_FRICTION` in JS → G1 red; damp per-axis instead of vector → G1
  red; drop the world clamp → a clamp-exercising fixture red.
- **Quantitative pins**: tick counts per fixture tape (a bot that teleports
  satisfies every positional assertion).

Baselines at kickoff (2026-07-28 measurements, re-measure fresh): vitest
**3790/3790**; slow tier **364/364** (~23 min); `test-substrates
--batch=fast` **61/61**. No in-app suite leg in v1 (deliberate — the wasm is
uncommittable, and the maze surface already covers the committed-repo bot
story); the suite deltas here are vitest-only.

## 6. Discipline + traps

- Commit directly to `main` in Archipelago-CC, one slice per commit; push
  when gates green. Seedling work goes on the fork's `bot` branch (push by
  default). NEVER `git add -A` while a background job runs.
- The kickoff's anchors were recon-verified 2026-07-30 but **recon-first
  still applies** — especially: SharedObject persistence (§2.2 ⚠), whether
  the deploy template's page needs anything for a second Seedling page to
  coexist (port/paths), and the exact blackCover accessor visibility for the
  bot's dead-frame gate.
- Toolchain traps (all hit before, all real): `FRESH=1` after define/layout
  changes (mtime-keyed .o cache); `run-SWFRecomp.sh` wrapper or risk a WSL2
  VM crash; `SWFRECOMP_COMPILE_TIMEOUT=900+` for `abc0_methods.c`; mxmlc
  strips `trace()` without `-omit-trace-statements=false`; the WhirlPool
  symlink must exist on `bot` (it does — the case-fix commit); WSLg WebGPU
  error flood is cosmetic; the page needs a user-gesture start click;
  same-origin serving is mandatory (host reaches into
  `contentWindow.__swfBridge`).
- Bridge no-ops silently without the page shim — absence of bridge output
  is NOT a failure signal; assert positives before any negative
  (silent-watcher doctrine).
- Do not touch: `BridgeGeneric.as`/flash-ap-api (nothing here needs it),
  `games/seedling.json`, `regionAtlasCompiler.js`'s `flash_panel` block,
  the `seedling_teleport_ap` artifacts, fork `main`.

## 7. Open implementation questions (ask the user only if blocking)

- ✅ **Q1 `botDrain` chunking — ANSWERED 2026-07-30: not needed.** The shim
  marshals through `Module.ccall("avm2_ei_dispatch", "string", ["string",
  "string", "number"], …)` (`swf_bridge_avm2.js:66-80`), which copies via the
  heap and imposes no practical length cap. Start unchunked.
  ⚠ **But the wrapper normalizes an empty result to `null`**
  (`return r === "" ? null : r;`, with the comment that no bridge callback
  legitimately returns `""`). **No bot callback may ever return the empty
  string** — an empty observation buffer must drain as `"[]"` or a JSON
  envelope, never `""`, or the host silently reads `null`.
- ✅ **Q2 tick counter vs `Game.freezeObjects` — ANSWERED from source
  2026-07-30: yes, gate on it.** `freezeObjects` is a `public static var`
  (`Game.as:511`) and gates the entire `friction(); input(); moveX(); moveY();`
  block inside `Mobile.mobileUpdate` (`Mobile.as:33-40`). A frozen tick
  therefore produces no movement at all, which is the same reason
  `blackCover` must suppress tick advance — a tape tick consumed while frozen
  desyncs the differential. Gate on both, and surface both in `botStatus`.
  (v1 shouldn't hit it: every writer is a cutscene, boss, seal, FireWand
  pickup, FallRock or Help NPC.)
- Fixture roster: 3–5 tapes is plenty for v1 (straight run, diagonal,
  friction-stop, the limit-cycle flip, a clamp touch). More is v2's problem.

## 8. Implementation-session recon — findings (2026-07-30)

Recon run before slice 1, against Archipelago-CC HEAD `355460f50`, seedling
fork `~/CC/seedling` (branches as documented: `main` pristine,
`stage1-teleport-build` @ `22d4362` checked out, `bot` @ `af88666`), and the
SWFModernRuntime sources. Corrections are applied inline above; this section
is the evidence trail and the "what changed" summary.

### 8.1 The two corrections that change code

1. **`Player` overrides `moveX`/`moveY`** — §3.2's suggested patch site
   (`Mobile.moveX/moveY`) is a no-op for the player. Fixed in §2.3 and §3.2.
2. **`input()` overshoots rather than clamps** — velocity is NOT binary per
   axis; it runs a ~3-tick limit cycle reaching ~1.45 against a `moveSpeed`
   of 0.8. A transcription written to the original description diverges on
   tick 1. Fixed in §2.3, with the numeric trace.

### 8.2 The three flagged ⚠ items, all resolved

- **SharedObject persistence** — resolved, inverted: no persistence is
  modeled, so runs are reproducible for free (§2.2).
- **Second-page coexistence** — no conflict. The deploy output is
  self-contained and name-namespaced (`seedling_bot_ap.js` / `.wasm` inside
  its own directory; `game.html` references its own bundle by name), so a
  sibling of `seedling_teleport_ap/` just works. Verified against the staged
  teleport page.
- **`blackCover` accessor visibility** — `public var` (`Game.as:518`), and
  `Game.freezeObjects` is a `public static var` (`:511`). Both readable;
  gate on both (§7 Q2).

### 8.3 An unflagged risk, cleared

The entire "zero-patch input synthesis" design assumed
`stage.dispatchEvent(new KeyboardEvent(...))` works in the **recompiled**
runtime — not in Flash Player, where the AS3 was written. It does, and it
reaches the identical sink the hardware path uses. Evidence in §2.1. Had this
failed, the fallback would have been a source-level `Input` injection API on
the fork (cheap, since we control it) — recorded here so a future rung that
hits an unimplemented runtime surface knows the escape hatch exists.

### 8.4 Smaller findings folded in above

- Verify scripts run **headless** with swiftshader flags; §2.6's "must be
  headed" was stale.
- Boot is `__runtimeReady` → click `#btn-start`.
- EI strings are uncapped, but `""` → `null` is a live trap (§7 Q1).
- `getState()`/`moveSpeed` terrain typing survives noclip — hence the
  `terrainStateAt()` seam (§2.3).
- Toolchain paths in §2.4 all exist (`seedling_teleport_build`,
  `seedling_ap_build`, `flash-ap-api`, `flex-sdk` with playerglobal 11.1 only,
  `run-SWFRecomp.sh`, `build_wasm_avm2.sh`, `deploy_wasm_avm2.sh`); only
  `~/CC/seedling_bot_build/` is absent, which is slice 2's job to create.
- A suspected float hazard — summing the mover loop's per-iteration adds vs
  the closed form `x += rel` — was tested over 60 ticks and did **not**
  materialize (exactly equal). The loop is still recommended, on code-shape
  grounds only; the doc no longer implies exactness depends on it.

### 8.5 Baseline, re-measured fresh

`npm run test:unit` → **155 files, 3790/3790 passed, 34.8s, exit 0**
(2026-07-30). Matches §5's stated baseline exactly, so the deltas quoted
there remain valid. Slow tier and `test-substrates --batch=fast` were not
re-run (v1 adds no legs to either).
