# Region Map: the set map keeps the start room at (0,0) (report)

Session `region-map-origin`, branch `region-map-origin`, base `c0cf42327d9876aea2d2e666139d753089df05fd` (origin/main, train 118:
the Region Map panel). Planner archipelago-cc-23; reviewer and landing-queue owner seedling-js-planning-20; lab owner
seedling-lab-planning-5.

⚖ **Licence (user, 2026-11-14/15, via archipelago-cc-23).** *"At some point I'll also want to change the existing code to keep (0,0) as
the center, rather than renormalizing."* Then, asked whether to re-record the position checks as a one-off exception to the maze-lab
rule ("each step must leave both labs' existing checks unchanged"): *"Yes, I approve the re record and the launch."* That licenses
re-recording rows that assert layout position VALUES only. Every row about drawn pixels, rects, link shapes, picks or a census size
had to stay byte-identical, and did.

## What landed

| Commit | Step |
|---|---|
| `f04a17a0ac` | the pixel/door instrument `scripts/dev/set-map-frame-dump.mjs` + the BEFORE dumps (`origin-dumps/before/`) |
| `4a8471b1be` | the change, the four test edits, the doc + its regenerated index |
| `8a98d19c76` | merge of origin/main `3757b3f421` (train tile-calib-split); conflicts only in the generated docs word counts, regenerated |
| this commit | this report |

- 0 gitlinks. `git diff --name-only origin/main..HEAD` = the 20 files above plus this report. Nothing under `frontend/presets/`,
  any `atlases/`, `apworlds/` or `worlds/`.
- Closure ∩ diff = ∅: none of `setMapLayout.js`, `regionLayout.js`, `seedlingSetMap.js`, `mazeSetMap.js`, `setEditorView.js`,
  `watchSetEditor.js` is in the js-gate closure list. `seedlingDerivedRuleTable.js --print-engine-closure` at `8a98d19c76` is
  byte-identical to base (43 lines, sha256 `a458a51c…9202b`).

## What changed

`frontend/modules/procgenCore/setMapLayout.js`:
- `canonicalLayout` (`:110`) returns `layoutRegions`' signed cells unchanged (`:134`). The start room is exactly (0,0). The JSDoc
  `@returns` and the wrapper comment say so.
- `cellBounds(positions)` (`:144`, module-private, so no export list moves) gives `{minX, minY, maxX, maxY}`.
- `layoutCensus` (`:163`): `cols`/`rows` = `max − min + 1` (`:194`).
- `frameOf` (`:207`): the canvas size comes from the extent (`:213`), and cell `i` sits at `margin + (gx − minX)·(cell+gap)`
  (`:216`). An empty layout still gets a 1×1 canvas, as before.
- The provider's sticky cache needed no change: it holds what `canonicalLayout` returns.

Comment and doc only: `procgenCore/regionLayout.js` header (the coordinate contract no longer says `canonicalLayout` min-shifts);
`docs/json/developer/procgen/region-layout.md` (the contract bullet and the wrapper paragraph) and the regenerated word counts
(`procgen/README.md`, `procgenDocs/generated/docsIndex.js`).

## Consumer census

`grep -a` for `canonicalLayout|layoutCensus|frameOf|\.gx\b|\.gy\b` over `frontend/modules` and `scripts` hits 56 files. Most `.gx`
hits are other systems' own grids and never touch this module: the procgen pipeline engine, the composite map renderer, the APWorld
editor's separate `regionLayout.js`, `regionGraph/`, the maze lab's walk, and Seedling physics/NPC tests. The `frameOf` hits in
`seedlingJsRuntimeTests.js`, `mazeLab*.js`, `seedlingNpcSkin.test.js`, `solveProgress.js` and the load-in-js / lab-hosting checks are
different local functions with the same name. The actual consumers of this module's positions:

| Consumer | Reads | Effect |
|---|---|---|
| `setMapLayout.createSetMapProvider` | `canonicalLayout`, `frameOf`, `layoutCensus`, `moved` (prev vs new by index) | frames/shapes/picks identical; `state().positions` signed |
| `seedlingDemo/seedlingSetMap.js` | re-exports `canonicalLayout`, `frameOf`, `layoutCensus`; `createSetMap` | as the provider |
| `mazeRoom/mazeSetMap.js` | `createMazeSetMap` over the provider | as the provider |
| `procgenCore/setEditorView.js` | `overviewMap.frame/shapes/roomAt/linkAt/markerAt/state` | draws canvas px only; `map()` readout carries signed `positions` |
| `seedlingDemo/watchSetEditor.js` | builds `createSetMap` for the mount | none |
| `mazeRoom/mazeLabView.js` | builds `createMazeSetMap`; `setUi.map()` only as a "map shown?" truthiness test | none |
| `seedlingDemo/seedlingDoorDirection.js` | `edgeOf`, `OPPOSITE` only (no position) | door directions identical (dumped) |
| `flashPanel/seedlingCompositeMap.js` | `dirOfExit` only | none |
| `scripts/procgen/check-seedling-editor-e3.mjs` | page `positions` vs node's `canonicalLayout` | both sides signed: 35/35, no expectation moved |
| `scripts/procgen/check-maze-world-map.mjs` | page `positions` vs node's; `frameOf(page positions)` | 33/33, no expectation moved |
| `tutorials/content/checks/seedlingSetMap.js` (`seedling-map-check`) | `set.map.cells` / `links` only (canvas px) | untouched (lab-5's file); cells identical |
| `regionMap/` | `regionLayoutResolve` → `layoutRegions` (never `canonicalLayout`) | untouched; vitest + 4 in-app rows green |

⛔ js-20 edit 1: **nothing that feeds a generator, exporter, sidecar, preset, atlas or derived rule reads these positions.** Outside
the files above, `canonicalLayout` appears in no file under `frontend/`, `scripts/`, `worlds/`, `exporter/` or `world_generator/`.

**Persistence.** Positions live only in the provider's closure (`last`). `setMapLayout.js`, `seedlingSetMap.js` and `mazeSetMap.js`
have no `localStorage`, `sessionStorage` or IndexedDB use, and `setEditorView.js`'s RE-LAYOUT line says "none are stored". A cache
built before the change cannot be reloaded after it.

## Pixel identity

`node scripts/dev/set-map-frame-dump.mjs <dir>` writes, for 9 fixtures, the door directions (every map link's `dir` + sizes), the
`layoutCensus`, `frameOf` at zooms 0.5/1/2 (size, every cell rect + still), `mapLinkShapes` for selected null/0/last, and the
provider's own frame, shapes, 200 picks (room, link, door marker) and `state()` minus `positions` (rule, moved, census, links)
through a second record and a RE-LAYOUT. The fixtures are: the editor's vanilla 116, the bare vanilla 116, `seedling_generated_chestdoor`,
the demo maze pack bare / ring / chain+closing-connect / chain+reorder, and generated maze libraries from `procgen_maze/AP_3` and
`procgen_topdown/AP_4`.

- BEFORE at base, committed: `CC/docs/region-map/origin-dumps/before/` (`index.json` holds each file's sha256). The dump is
  deterministic: two BEFORE runs gave identical output under `diff -r`.
- AFTER at `4a8471b1be` and again after the merge: **`diff -r` empty, byte-identical, all 9.** That includes `moved` on the
  reorder fixture (3), where a prev-vs-new comparison by index could have changed. It did not.
- The lift pin carries a second, independent proof (below): the old digests, which hash frames at three zooms, shapes for four
  selections and 400 picks per zoom, still match once only the positions are translated back.

## Re-recorded rows (every one; totals unchanged)

| File | Row | Old → new | Why it is a position value |
|---|---|---|---|
| `seedlingDemo/seedlingSetMapLift.test.js` | "the editor's vanilla 116 …: the same digest as before the move" | `f86747bf307d0724cabc510d3ac307991cd334af335ed3903462b8be7b03e752` → `5e88a5c71e288ef28231db054366f997276352073e41a6607faab44dad3fe418` | the digest hashes `pos` and every `state*.positions`; the vanilla start room moved from old cell (6,7) to (0,0) (min is now −6, −7) |
| same | "a generated set …: the same digest" | `9a7978b2…91be` → **unchanged** | its start room already was the top-left (0,0) |
| same | **new row** "translated back to the old min-0 frame, both digests are the pre-change ones" | asserts `f86747bf…` and `9a7978b2…` | the proof that ONLY positions moved |
| `seedlingDemo/seedlingEditorE3.test.js` | "same set → same layout, and every room has its own cell" | `min gx = 0`, `min gy = 0` → `a[start] = {gx:0, gy:0}` and `min gx < 0` | direct position assertion |
| `procgenCore/regionLayout.test.js` | D1 "equals the pre-move function on 400 random index graphs" | `wrapper == oracle` → `wrapper == oracle translated by oracle[start]`, `wrapper[start] = (0,0)`, and a non-vacuity count (some graphs' start was not the old top-left) | the wrapper's contract was "min-shifted"; the oracle is kept verbatim |
| `procgenCore/setMapLayout.test.js` | **new row** "signed positions …: the start room is (0,0), and the frame and census are translation-invariant" | (added) | pins `[[0,0],[-1,0],[0,-1]]`, `frameOf`/`layoutCensus` equal for a translated copy, cols/rows 2×2 |

The mutant check: with the min-shift put back, the three re-recorded rows go red and the min-shifted proof row stays green.

**Lab checks (their expectations were NOT re-recorded):** both compare the page to node's own `canonicalLayout`, so both sides moved
together. Measured with matching row names before and after:

| Check | BEFORE (base) | AFTER (`4a8471b1be`) | AFTER (merge `8a98d19c76`) | Detail text that moved |
|---|---|---|---|---|
| `check-seedling-editor-e3.mjs` | 35/35 | 35/35 | 35/35 | "the small set is laid out as node lays it out" and "4 RE-LAYOUT …": `[[1,0],[2,0],[1,1],[0,0]]` → `[[0,0],[1,0],[0,1],[-1,0]]`. Row 1's census is identical (`cols 17, rows 14`, …) |
| `check-maze-world-map.mjs` | 33/33 | 33/33 | 33/33 | "…with its RING overlay": `[[1,0],[2,0],[3,0],[0,0]]` → `[[0,0],[1,0],[2,0],[-1,0]]` |
| `check-maze-lab.mjs` (the maze lab's 316) | 316/316 | (run invalidated, below) | 316/316 | none (only ports and ms) |

⚠ Process note: I merged origin/main into the tree while my own `check-maze-lab` AFTER run was serving it (16:07:13 vs its 16:07:05
start). The pre-commit hook caught it. I killed that run by PID and re-ran it at the merge commit. The maze-world-map AFTER run
finished at 16:07:04, before the merge, on a clean `4a8471b1be`.

## Signed-value readouts (what now shows negatives)

- `setEditorView` handle `map()` → `positions` (`[gx, gy]` per room), published as **`window.__editorEdit.set.map.positions`**
  (`seedlingDemo/watchViewer.js:9464`) and **`window.__mazeLab.set.map.positions`** (`mazeRoom/mazeLabView.js:3486`).
  `census`, `frame`, `cells`, `links`, `rule`, `moved` and `picked` are unchanged.
- `createSetMapProvider().state()` → `positions` (the same values; the lift pin and both lab checks read it).
- `canonicalLayout` itself (both the `setMapLayout` and `seedlingSetMap` exports).
- `layoutCensus` was never a position readout: its cols/rows are extents and did not change.

## What still min-shifts, and why it stays

- `procgenPipeline/procgenPipelineEngine.js:4123`: the generator's spiral auto-grid offsets every cell non-negative. That is the
  stored `grid_cell` DATA in generated presets. The plan keeps it non-negative, and changing it is a preset regen, a separate
  question for the user. The Region Map's resolver already subtracts the start region's stored cell.
- `regionMap/regionMapFrames.js` and `regionLayout.js` compute bounding boxes (group placement, frame edges). Neither shifts
  positions, so neither is a renormalisation.

## Gates

- Bounded vitest (⚖ 52), every test importing `setMapLayout`/`seedlingSetMap`/`mazeSetMap`/`regionLayout`/`setEditorView`/
  `watchSetEditor` plus `regionMap/` (22 files):
  - BEFORE: 798/798.
  - AFTER, with `procgenDocs/` (30 files): 1294/1294.
  - At the merge: 1295/1295.
- `check-procgen-docs.mjs`: ALL CHECKS PASSED. `generate-procgen-reference.mjs` regenerated the word counts only;
  `generate-docs-index.mjs --check` (quickLaunch) is current.
- In-app at the merge `8a98d19c76`, port 8147:
  - `--batch=fast`: 101/101 PASSED, including the Region Map smoke row `region-map-classic-world`.
  - `--test=region-map-classic-world,region-map-seedling-paints,region-map-follow-player,region-map-discovery`: 4/4.
- CI (JSUT/unittests push runs, TT, `feature-checks`, `playback-bot` at this report's tip): quoted in the packet to
  seedling-js-planning-20, because this commit is the tip they run at.

## Merge order (js-20 edit 4)

lab-5's `seedling-source-sync` (train 120) was not on origin/main at `3757b3f421`. If it lands first, this branch merges origin/main
again and re-dispatches `feature-checks` and `playback-bot` at that merge tip. I did not edit
`tutorials/content/checks/seedlingSetMap.js`.
