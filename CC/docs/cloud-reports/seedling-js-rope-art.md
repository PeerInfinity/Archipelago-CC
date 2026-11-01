# Cloud report: `seedling-js-rope-art` (the JS page draws RopeStart from the pack's rope sprite)

- **Base:** `origin/main` @ `c14dc07626777816bc4da915e6f9821cdce3be22`. It already had `seedling:puzzlement/rope` in
  `frontend/packs/seedling/art/manifest.json:3505` and `frontend/packs/seedling/art/sheets/RopePulley.png`.
- **Branch:** `claude/seedling-js-rope-art-n3dlxd`. The harness pinned this branch; there was no `seedling-js-rope-art`
  push. Main was not pushed.
- **Code commit:** `cc4ceabc`. This report is the last commit.

## The gap (found)

`jsRuntimePage.paintSkinned` builds `roomOps(…, { drawnObjects })` from the HAZARD / PUZZLE / SOLIDS / NPC / MACHINE /
BOSS / room-body tag sets. None of them held `rope`, so the rope's object solid (`levelWorld.js:5867-5896`, tag
`rope`, `ropeId`, `span`) was painted as `roomOps`' stand-in `fillRect` over its whole span. The census agreed with
that: `seedlingSkinCensus.js` had `['rope', '-', 'none', 'a setting or effect, not a body']`. The lab already drew the
rope in `watchArt.staticRopeOps`, and its header said "the JS page paints its stand-in too".

## AS3 citations (`vendor/seedling/src/Puzzlements/RopeStart.as`, read at the pinned submodule)

- `:14-15`: `Spritemap(imgRope, 16, 16)` over `RopePulley.png`.
- `:22-24`: `super(_x + Tile.w/2, _y + Tile.h/2, sprRope, _t)`, `sprRope.centerOO()`, `xend = _xend + Tile.w/2`.
- `:26-27`: `setHitbox(_xend - _x + 16, 16, 8, 8)` then `layer = -(y - originY + height/2)`, which is `-(_y + 8)`. It
  is set once.
- `:40-49`: `hit()`, which runs only `if (!activate)`. It shrinks the hitbox to one cell and does not remove the rope.
- `:51-67` `render()` UNCUT (`!activate`): frame 1 at `x + i` for `i = 0; i < xend - x; i += sprRope.width`, then
  frame 0 (the pulley) at `x`, then frame 2 (the handle) at `xend`.
- `:68-76` CUT: frame 0 at `x`, frame 3 at `xend`.
- `:31-38` `check()`: a cleared tag calls `hit()` at the build, so the rope is cut from the first frame.

**The cut state in the JS model:** `activators.ropePublish` (`activators.js:417-462`) is the group publish and does
not hold the cut. The cut is held in two places:
- the world solid's `bootPulled` (`levelWorld.js:5896`, F7: the cleared tag at the build);
- the run's per-visit `pulledRopes` (`levelRun.js:1688-1695` `pulledRopeIdsNow`, getter `:19947`). The `hit()` arm
  fills it (`:6416-6463`) and so does `bootPulledRopes` (`:1873`).

The page reads `bootPulled || pulledRopes.has(ropeId)`.

## Files and why

| File | Why |
|---|---|
| `frontend/modules/seedlingDemo/seedlingSolidsSkin.js` | This is the skin ButtonRoom and Button use. It now adds `ROPE_KEY`, `ROPE_FRAMES`, `ROPE_OBJECT_TAGS`, `ropeCells` (the cells of `render()`), `ropeOps` (the ops, each with its cell rect as fallback, `null` when the stack lacks the key) and `ropeSkinView(run)` (the page's adapter, read-only). `RopeStart` is added to `SOLIDS_COVERAGE.drawn`. |
| `frontend/modules/seedlingDemo/jsRuntimePage.js` | The rope ops are appended to `solidSprites`, so they are Y-sorted with the room and show in the `__seedlingJsGraphics.solids` readout, which gains `ropes: n`. `drawnObjects` claims `rope` only while `ropeSprites !== null`. With no stack (no `drawnObjects`) or the key withheld, the old rect stays. |
| `frontend/modules/seedlingDemo/watchArt.js` | `staticRopeOps` now delegates to `ropeOps`, so `render()` is written in one place. The lab only decides `cut` from its sample. Its output is byte-identical: the lab goldens pass unchanged and the lab-art browser shard is green. I removed two imports this left unused. |
| `frontend/modules/seedlingDemo/seedlingSkinCensus.js` | The `rope` row moves from `none` to `RopeStart` / `drawn`. |
| `frontend/modules/seedlingDemo/seedlingSolidsRope.test.js` | New: the unit, render and page pins (below). |
| `frontend/modules/tests/testCases/seedlingJsRuntimeTests.js`, `frontend/test-configs/playwright_tests_config-substrates.json` | New in-app row `seedling-js-runtime-graphics-rope` (category `Seedling JS runtime`, so the `seedling-js` batch). It is the G8 solids row's pattern at `Game(16, 112, 48)`. |

I made no pack, manifest, `vendor/seedling`, wasm, solver, `levelRun` or jsRuntimeCore edit.

## Pins and their mutants

Every mutant below was applied, run, and restored. Each one went red.

| Pin | Mutant → result |
|---|---|
| A. `ropeCells` by hand: uncut `[1,1,1,0,2]` at x 40/56/72, 40, 88; cut `[0,3]` | M1 `i <= xend - x` (one cell too many) → **3 red**. M5 no pulley → **4 red**. |
| A. Every vanilla rope room (L16, L28, L39) built uncut: the ops equal the cells computed by hand from the `.oel` entity and node, with layer `-(_y + 8)`. L16 = `1@32,16 1@48,16 1@64,16 0@32,16 2@80,16` | (M1 and M5 above) |
| B. The L28 cut witness tape (`fixtures/rope-witness/rope-l28-cut.json`): uncut until the run banks its `ropePulls` row, then `0@160,64 3@192,64` from that very tick | M2 the page's cut ignores `run.pulledRopes` → **1 red**. M4 the cut handle stays frame 2 → **3 red**. |
| B. F7 L16 re-entry (`f7-l16-reentry`, `{16,0}` cleared): cut from the first tick (`bootPulled`) | (M4 above) |
| C. No key, or no stack, → `ropeOps` is `null`. `roomOps` without art keeps the rope's span rect `fillRect(…, 32, 16, 64, 16)`, and claiming `ROPE_OBJECT_TAGS` drops exactly that one rect | M3 the `art.has(ROPE_KEY)` check is dropped → **1 red**. |
| D. The census: `rope` is `RopeStart` / `drawn`. The `none` rows are exactly the other nine, unchanged, and `remaining` is empty, so only the rope moved | M6 row reverted to `none` → **2 red**. M7 `RopeStart` dropped from `SOLIDS_COVERAGE` → **2 red** (`seedlingSkinCensus.test.js` too). |
| F. `jsRuntimePage.js` parses (`node --check`) and has the wiring | Mutant: `const rv` redeclared (the real bug I first shipped locally, see below) → **1 red**. |
| In-app row `seedling-js-runtime-graphics-rope`: L16's rope is `1,1,1,0,2` from the `seedling` pack, no failed sheet, no console error. Run: `npm test -- --mode=test-substrates --batch=seedling-js --test=seedling-js-runtime-graphics-rope` → **PASSED 1.9 s** | The page stops appending the rope ops → **FAILED, STUCK** ("its rope is drawn" never true). |

## Digests (render only): before = after

- `jsRuntimeTape.test.js` is green with `NO_TAPE_CHAIN = { chain: '0852da9e5639860e8b2d4ccbeda5', rows: 224 }`
  unchanged (`toEqual`).
- Pin E: on both real tapes (the L28 cut and the F7 L16 re-entry), the run's per-tick stream, its `ropePulls` and its
  `stateDigest()` are identical whether `ropeSkinView` + `ropeOps` are called every tick or never.
- `jsRuntimeDeclarations.test.js` is green.
- "The set digests": I found no row by that name in the tree. The digest rows I could find (above) are unchanged.
- No code under `levelRun` or `levelWorld` was touched. `ropeSkinView` reads `run.pulledRopes` / `world.objectSolids`
  and writes nothing.

## What I ran

- Bounded vitest on the final tree, 14 files, **313/313 passed**: `seedlingSolidsRope`, `seedlingSolidsSkin`,
  `watchArt`, `seedlingSkinCensus`, `jsRuntimeTape`, `seedlingSkinRenderer`, `seedlingPuzzleSkin`, `seedlingTrapSkin`,
  `seedlingPortalSkin`, `fidelityRope`, `jsRuntimeDeclarations`, `jsRuntimeGameSpeed`, `seedlingFadeOnce`,
  `seedlingFadeOncePerCrossing`. No unfiltered vitest was run.
- **Lab shard:** `node scripts/procgen/check-seedling-lab-art.mjs --host=http://localhost:8000` → **ALL CHECKS PASSED**
  (147 PASS lines). This includes the rope rooms L16, L28 and L39 (`rope` readout 5 at L16, no stand-in).
- `node scripts/procgen/generate-procgen-reference.mjs --check` → ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH.
  Nothing it cites was touched in a way that needed a regen.
- **Page probe:** Playwright on `jsRuntime.html?graphics=seedling` at `Game(16, 112, 48)` gave `ropes: 1`, ops
  `1,1,1,0,2` all from `seedling`, and no page errors. The screenshot shows the pulley, span and handle in L16's
  top-left.

⚠ **Caught by the browser, not the unit tests:** my first wiring named its view `rv`, which `paintSkinned` already
declares at `:697` (the room-body view). That is a module-level SyntaxError that blanks the whole page. Every vitest
file I had run was green, because none of them imports `jsRuntimePage.js`; they only read it as text. Pin F (`node
--check`) and the in-app row now cover it.

## The bridge-object finding (unchanged)

- **What draws it:** tile 29's object solid (`levelWorld.js:4741-4747`: tag `tile:Bridge`, `bridgeId`). No JS-page
  `drawnObjects` set claims `tile:Bridge`, so `roomOps` paints the build-time stand-in rect (`rectPalette` `bridgeId`
  `#6b4a2a`) over the tile pass's own bridge picture. The tile pass already draws `seedling:tile/bridge`
  (`seedlingSkinRenderer.js:203`, `rule: () => ({ anim: 'closed' })`).
- **The pack has the art:** `seedling:tile/bridge` (`OpenBridge` sheet, 19 frames) with both anims, `closed` [0,1] and
  `open` [7..18] (2 loops each, `Game.as:275`, `Tile.as:75-77,347`).
- **Why I did not change it:** claiming `tile:Bridge` on the page would be one row, as the lab's
  `FAMILY_OBJECT_TAGS.bridge` is. But it would not be the same wiring as the rope:
  - the page's picture would then be the tile's `closed` anim always;
  - nothing feeds the run's `openBridges` (`levelRun.js:1532`) to the tile rule, and `roomOps`' object solids come
    from the build world, so a speared bridge would draw closed while it is walkable. The lab documents the same
    limit ("a speared bridge is drawn CLOSED").
- **Recommendation for a follow-up slice:** the tile rule reads `openBridges` (closed → the `open` anim from
  `pressTick`), and then the page claims `tile:Bridge`.

## Stopped / not done

- Nothing STOPPED.
- The cut look is pinned in node on real tapes, not in the browser. The in-app row only boots L16 uncut, because a
  cut needs a sword input on the page.
