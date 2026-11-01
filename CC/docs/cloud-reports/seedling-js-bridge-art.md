# Cloud report: `seedling-js-bridge-art` (the JS page draws bridges from the pack, open or closed as the run says)

- **Base:** `origin/main` @ `efbeb3350102066d649d17ab562d79cde67bb2f8`. It holds the rope slice
  (`CC/docs/cloud-reports/seedling-js-rope-art.md`; `jsRuntimePage.js` claims `ROPE_OBJECT_TAGS` in `drawnObjects`).
- **Branch:** `claude/seedling-js-bridge-art-xfy37l`. The harness pinned this branch; there is no `seedling-js-bridge-art`
  push. I did not push main.
- **Code commit:** `65f35e55`. This report is the last commit.
- ⚖ The decision: Robert, 2026-11-01 (Decision 3, "Launch follow-up (Recommended)").

## The gap (re-verified)

- Tile 29's object solid is at `levelWorld.js:4741-4747` (tag `tile:Bridge`, `bridgeId: '${tx},${ty}'`). No JS-page
  `drawnObjects` set claimed it, so `roomOps` painted its stand-in `fillRect` (`#6b4a2a`, alpha 0.85, layer
  `-rect.bottom`) over the tile pass's picture.
- The tile pass drew `seedling:tile/bridge` with `rule: () => ({ anim: 'closed' })` (`seedlingSkinRenderer.js:203` on
  the base), so it was always closed.
- The run's per-visit state is `bridgeStates` (`levelRun.js:1549`; `bridgeId → {pressTick, walkableAt, centre}`,
  set at `:6792-6807`, cleared by `freshVisitState` `:4911` from `enterWorld` `:5532` and dropped at `:1462`). The
  public getter `run.openBridges` (`:19913`) holds only the walkable ids. The gate is at `:5028-5053`:
  `observation = ticksCompleted + 1 >= walkableAt = pressTick + 60`.
- Bridge rooms in the vanilla map (built from the atlas): L61 `11,13|10,13`, L63 `2,9`, L66 `7,9`, L93 `7,13`.

## AS3 citations (`vendor/seedling` @ `ccdf189776471fa57be8c0568c6e881a2d5acc18`, `src/Scenery/Tile.as`)

- `:75-77`: `closedBridge = [0, 1]`, `openingBridge = [1, 2, 3, 4, 5, 6]`, `openBridge = [7..18]`.
- `:78-79`: `bridgeOpeningTimerMax = 60`, and the timer starts at that value.
- `:344-349` CLOSED (`timer >= 60`): `closedBridge[Game.worldFrame(2, loops = 2)]`, type Solid.
- `:350-356` OPENING (`0 < timer < 60`): `timer--` runs first, then the frame is
  `openingBridge[int((1 - timer / 60) * 6)]` with `blend = BlendMode.INVERT`, type Solid. **Which frame it starts on:**
  the frame comes from the timer, not from the world clock. The first render after the hit shows `openingBridge[0]`
  (frame 1). The timer only goes down, so the opening plays **once**. ⚠ On the last opening render the timer is 0 and
  the index is 6, one past the array. `openingBridge[6]` is `undefined`, and `Spritemap.frame:int` turns that into 0,
  so that render shows frame 0, inverted.
- `:357-362` OPEN (`timer <= 0`): `openBridge[Game.worldFrame(12, loops = 2)]`, type Tile. **It is not timed from the
  opening:** it is on the WORLD clock (`Game.as:1962-1965` `worldFrame` = `int((time % (timePerFrame·loops)) /
  (timePerFrame·loops / n))`). It does not start on frame 7, and it **does not hold its last frame**: it loops, in step
  with every other open bridge.
- **Frame rate:** both looping anims share `worldFrame`'s clock: 2 loops over the anim's length, the pack's
  `clock: 'world'`, `loops: 2`. The opening has no frame rate of its own. It moves one timer step per render.
- `:363-364`: the main draw, then `blend = NORMAL`.
- `:366-377`: the night copy onto `nightBmp`. Its alpha is `sin-pulse · 0.1`, but it is `1` while opening (`:370-373`),
  and it is drawn NORMAL because `:364` already reset the blend.
- `Game.as:274-275`: `sprBridge = Spritemap(OpenBridge.png, 16, 16)`. The pack's `seedling:tile/bridge` (19 frames,
  `closed` [0,1] and `open` [7..18], `clock: 'world'`, 2 loops) agrees, and pin A checks it.

## How the renderer reads the open state (read-only; no `levelRun` / jsRuntimeCore edit)

`seedlingBridgeSkin.bridgeSkinView(run)` returns `{ level, look(bridgeId) }`. It reads only public getters, as the rope's
`ropeSkinView` does:

- **OPEN ⇔ `run.openBridges.has(id)`**: the run's own crossing gate. The picture is open on exactly the ticks the run
  lets the player through.
- **OPENING:** the run exposes no `pressTick`, so the view takes it from the press ledger. `run.presses` rows carry
  `{t, fired, level, hits: [{as3: 'Tile', id}]}` (`levelRun.js:7827-7833`, getter `:20697`), and the first press per
  id wins, as `bridges.has(id)` does at `:6800`. The ledger is filtered to this level and this visit:
  `t >= portalVisitTick(run)`, the last transition into the level or death in it, which is when `enterWorld` rebuilds
  the bridges. The gate opens at `ticksCompleted = openAt = t + 60 − 1`. The view shows timer `openAt − 1 − c` at
  `c = run.ticksCompleted`, so the last state before open is the timer-0 render (frame 0). The opening starts on the
  hit's own display (`c > fired`).
  - ⚠ **One-tick fencepost.** The model's 60 ticks from press to walkable is one tick shorter than the AS3's
    `hit + 59 renders + 1`. The view anchors on the gate, so the two earliest timers (58 and 57) are not shown. Both
    are `openingBridge[0]` = frame 1, the same as the timer that follows them, so no picture is lost. The tape shows
    the full sequence `[1, 2, 3, 4, 5, 6, 0]`.
- **CLOSED** otherwise, and whenever `run.openBridges === null`: that is noclip, or nothing has been speared this
  visit, and it wins over anything in the ledger.

`roomOps` gains a `bridgeLook` option. Each tile-29 entry carries its `bridgeId`. A `{anim: 'open'}` look reads the
`open` anim at the tick through the same per-call frame path as every animated tile. A `{opening: frame}` look emits
that sheet frame with `blend: 'difference'` and `tint: '=#ffffff'`. That is the solids skin's Lock spelling of INVERT
(`seedlingSolidsSkin.js:391`, `:460`). The op is also marked `bridgeOpening` and `still: false`, and is cached per
frame in its own `byOpening` map, so it can never collide with a closed op of the same frame. `nightOps` copies a
`bridgeOpening` op at alpha 1 with no blend and no tint. `blend` is added to the tile layer's `LIVE_FIELDS`
signature; no older op carries one.

## Files and why

| File | Why |
|---|---|
| `frontend/modules/seedlingDemo/seedlingBridgeSkin.js` | New. Holds `BRIDGE_TILE_KEY`, `BRIDGE_OBJECT_TAGS`, `BRIDGE_FRAMES`, `openingFrame` (`:353` plus the overflow), `bridgeLook` (the schedule) and `bridgeSkinView(run)` (the page's read-only adapter). |
| `frontend/modules/seedlingDemo/seedlingSkinRenderer.js` | `roomOps({ bridgeLook })`. Bridge tile entries carry `bridgeId`. The opening op gets INVERT and `bridgeOpening`. `blend` is in `LIVE_FIELDS`. Without `bridgeLook`, nothing changes. |
| `frontend/modules/seedlingDemo/seedlingNightSkin.js` | The opening's night copy (`:370-373`, `:364`) is alpha 1, NORMAL, no silhouette. Its `TILE_NIGHT` comment is updated. |
| `frontend/modules/seedlingDemo/jsRuntimePage.js` | Builds `bridgeSkinView(runtime.run)` and passes its `look` as `bridgeLook`. `drawnObjects` claims `tile:Bridge` only while `art.has(BRIDGE_TILE_KEY)`; with no pack or no key, the rect stays. Adds a new readout `__seedlingJsGraphics.bridges` = `{ drawn, tiles: [{id, state, frame, pack}], standIns }`. |
| `frontend/modules/seedlingDemo/watchArt.js` | The lab delegates: `FAMILY_OBJECT_TAGS.bridge` is `BRIDGE_OBJECT_TAGS` and `BRIDGE_TILE_KEY` is re-exported from the bridge skin, so there is one spelling. The lab passes no `bridgeLook`, so its output is byte-identical (see the lab section below). |
| `frontend/modules/seedlingDemo/seedlingBridgeArt.test.js` | New: pins A–G (below). |
| `frontend/modules/tests/testCases/seedlingJsRuntimeTests.js`, `frontend/test-configs/playwright_tests_config-substrates.json` | New in-app row `seedling-js-runtime-graphics-bridge` (category `Seedling JS runtime`, so the `seedling-js` batch). It follows the rope row's pattern at `Game(66, 128, 144)`. |

I made no `vendor/seedling`, wasm, solver, `levelRun`, jsRuntimeCore, pack or manifest edit. I wrote no single-game
test code: the row and the pins use the existing Seedling harness only.

## Pins and their mutants

I applied every mutant below, ran it, and restored it. Each one went red. A count is the number of red tests in
`seedlingBridgeArt.test.js`.

| Pin | Mutant → result |
|---|---|
| A. By hand: the frame lists; the pack's `closed`/`open` anims (`clock: 'world'`, 2 loops, 19 frames); `openingFrame` 58/45/30/10/1 → 1/2/4/6/6, and 0 → **0** (the overflow); INVERT = `INVERT_SILHOUETTE` | M3 the overflow maps to 6 instead of 0 → **3 red** |
| B. The schedule on L66's real press row (`t 5`, `fired 6`): `null` through c = 6; opening from c = 7 (timer 56, frame 1), falling by 1 to timer 0 (frame 0) at c = 63; `open` is the gate's alone | M4 `open` taken from the ledger (`c >= t + 60`) instead of the gate → **2 red**; M10 the opening starts at the press instead of the hit → **1 red** |
| C. The render: no `bridgeLook` → the `closed` anim at the tick, no blend (the lab's path); `{anim: 'open'}` → `frameAt('open', tick)` at every tick, more than two distinct frames (it loops); `{opening: f}` → sheet frame f, `difference` + silhouette, `still: false`, only for the id asked; lab constants === bridge-skin constants | M1 the renderer ignores `bridgeLook` → **4 red**; M2 the open anim held on frame 18 → **2 red**; M6 the opening not inverted → **2 red** |
| D. No pack → the `tile:Bridge` stand-in `fillRect` (`#6b4a2a`) is there; with art, claiming `BRIDGE_OBJECT_TAGS` drops exactly that one op. An earlier visit's press (a transition or death into L66 after it), another level, or `openBridges === null` → closed | M5 the visit filter dropped → **1 red** |
| E. **Real tape `fixtures/tapes/rulesref-l66-door.json`** (L66 spear bridge (7,9), one thrust at tape tick 5; ledger row `t 5`, `fired 6`; the gate holds `7,9` from `ticksCompleted` 64; the tape leaves to L70 at 230). Per tick: closed (the `closed` anim frame, not inverted) through c = 6; opening frames `openingFrame(63 − c)`, inverted, c = 7..63, and the distinct frames in order are `[1,2,3,4,5,6,0]`; from c = 64 `gate` is true and the frame is `frameAt('open', c)`, not inverted | M1, M4, M10 above all fail here as well |
| E. ⛔ Render only: on that tape, the stream (`ticks`, `transitions`), `stateDigest()`, `presses`, `transitions` and `playerDeaths` are byte-identical whether the view plus `roomOps` run every tick or never | (no mutant: nothing in this slice writes the run) |
| F. Night copy (L63, a night room with bridge (2,9)): the opening op's copy has no `alpha` field (= 1), no blend, no tint, and frame 3; the closed copies stay ≤ 0.1 | M7 the copy keeps the INVERT → **1 red** |
| G. `jsRuntimePage.js` parses (`node --check`, run inside the test), and it has the wiring: view, `bridgesDrawn`, the claim, `bridgeLook` | M8 the claim made without `bridgesDrawn` (rect gone with no key) → **1 red**; M9 the page passes `bridgeLook: null` → **1 red** |
| **In-app row `seedling-js-runtime-graphics-bridge`:** L66's bridge `7,9` is `closed` with frame ∈ {0,1} from the `seedling` pack, `drawn: true`, **0 stand-ins**, no failed sheet, no console error. Run: `npm test -- --mode=test-substrates --batch=seedling-js --test=seedling-js-runtime-graphics-bridge` → **PASSED 2.1 s** | The page stops claiming `tile:Bridge` → **FAILED**, "no stand-in rect is painted over it: expected 0, got 1" |

## Digests (render only): before = after

- **`jsRuntimeTape.test.js`** is green on the final tree, with `NO_TAPE_CHAIN = { chain: '0852da9e5639860e8b2d4ccbeda5',
  rows: 224 }` unchanged (`toEqual`). `jsRuntimeDeclarations.test.js` and `jsRuntimeGameSpeed.test.js` are green too.
- **Tape digests before = after.** I computed sha256 over `ticks + transitions + stateDigest()`, with the base tree
  stashed and then with this slice:

  | tape | before | after |
  |---|---|---|
  | `tapes/rulesref-l66-door.json` | `4bb2c44f11ccfd61` | `4bb2c44f11ccfd61` |
  | `tapes/f7-l16-reentry.json` | `79263a15715d7fb6` | `79263a15715d7fb6` |
  | `rope-witness/rope-l28-cut.json` | `05083d38ea442b2c` | `05083d38ea442b2c` |

- **"The set digests":** the rope slice found no row by that name in the tree, and neither did I. Every digest row I
  could find (above) is unchanged.
- The run is only ever read: `bridgeSkinView` reads getters that copy (`presses` maps a fresh array, `openBridges` is
  a fresh Set), and pin E shows the run is identical with it called every tick.

## The lab's identity

- The lab never passes `bridgeLook`, so `roomOps` takes the unchanged `closed` path for every bridge. `watchArt` only
  re-points two constants at the same values (`'seedling:tile/bridge'`, `Set(['tile:Bridge'])`). Pin C asserts they
  are the same objects.
- `watchArt.test.js` (the lab goldens), `watchBridge.test.js` and `seedlingSkinRenderer.test.js` (its goldens and the
  stale-layer pin) pass **unchanged**. No golden was re-recorded.
- **Lab shard:** see "What I ran" below.

## What I ran

- **Bounded vitest** on the final tree, 17 files, **436/436 passed**: `seedlingBridgeArt`, `seedlingSolidsRope`,
  `bridges`, `jsRuntimeDeclarations`, `jsRuntimeTape`, `seedlingSkinRenderer`, `seedlingNightSkin`, `seedlingSkinCensus`,
  `seedlingSolidsSkin`, `seedlingPuzzleSkin`, `seedlingTrapSkin`, `seedlingPortalSkin`, `seedlingRoomBodySkin`,
  `seedlingHazardSkin`, `watchArt`, `watchBridge`, `jsRuntimeGameSpeed`. I ran no unfiltered vitest (ruling 52). The
  suite number should come from CI at the pushed SHA.
- `node scripts/procgen/generate-procgen-reference.mjs --check` → **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS
  MATCH THE CODE**. Nothing it cites needed a regen.
- In-app: the new row alone → PASSED. Its mutant → FAILED (above).
- **`seedling-js` batch** (whole): PENDING — still running when this was first committed; the result follows in the next commit of this report.
- **Lab shard** (`check-seedling-lab-art.mjs`): PENDING — run after the batch (one browser at a time); the result follows.

## Stopped / not done

- Nothing was STOPPED. The run's open state was reachable read-only, so no `levelRun` edit was needed.
- **Pinned in node, not the browser:** the opening and open looks. The in-app row boots L66 closed, because a spear
  needs a held weapon and an attack input on the page. The rope row has the same limit.
- **Bounded assumption, not measured on the game:** where the opening starts within the one-tick fencepost (see "How
  the renderer reads the open state"). The only cost is that the first two timer steps are not shown, and they show
  the same frame as the step after them.
- `pip install` failed in `session_bootstrap.sh` (`ModuleUpdate.py` asked for interactive input: `EOFError`). This
  slice needs no Python, and the bootstrap's other steps reported OK.
