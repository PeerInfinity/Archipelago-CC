# Unbounded grid S1: the region-cell readers accept signed cells (report)

Session `unbounded-grid-s1`, branch `unbounded-grid-s1`, worktree `Archipelago-CC-wt-unbounded-grid-s1`. Base
`c1927ba3077c7be70f0c7ed3ae112b67dddc86ad` (origin/main, train 127; `git merge-base HEAD origin/main` printed exactly that
SHA). Planner archipelago-cc-23; reviewer and landing-queue owner seedling-js-planning-20; lab owner seedling-lab-planning-5.

⚖ **Rulings (user, 2026-11-15/16, via archipelago-cc-23).** *"If possible, I want to remove the requirement for the top left
to be (0,0) in all of this code."* … *"I want to delay choosing a box size until after all of the data has been generated, for
the places where a fixed box size is still needed."* The survey's recommendations were accepted on 2026-11-16, including
Q1: signed storage, with the start room at (0,0). S1 changes **no generated output and no preset**. It only removes the
*requirement* that the top-left cell is (0,0) from the readers and drawers.

## What landed

| Commit | Step |
|---|---|
| `4c91070e7f` | the instrument `scripts/dev/unbounded-grid-s1-dump.mjs` + the BEFORE dumps (`unbounded-grid-s1-dumps/before/`) |
| `9bd988a839` | the change, the signed fixture, its 12 vitest rows, and 5 shape-only re-records |
| this commit | this report |

- 0 gitlinks.
- `git diff --name-only c1927ba307..HEAD` shows nothing under `frontend/presets/`, `worlds/`, `apworlds/` or
  `frontend/schema/`, and no atlas. The only path matching `atlas` is three dump file NAMES under this report's directory,
  e.g. `…seedling_atlas_host__AP_1__AP_1_rules.json.json`.
- **Closure ∩ diff = ∅.** None of the diffed files is in the js-gate closure list. `seedlingDerivedRuleTable.js
  --print-engine-closure` engineMd5 base = tip: `bec369878feb67081187edca62baa951` (42 files) at both
  `c1927ba307` and `9bd988a839`.
- Untouched: `procgenPipelineEngine.js` (`Grid`, `isInBounds`, `resize`), `buildRulesJson`, the schema, every generator,
  `presetRun`, `sphereSteps`, `slotInitialise`, `rulesDocOps`, lab-5's files (`setEditorView`, `setMapLayout`,
  `seedlingSetMap*`, `watch*`, the E3 gate) and every train 128–130 file.

## What changed

**One shared helper: `frontend/modules/procgenCore/cellExtent.js` (new).**
- `cellExtent(cells)` (`:24`) returns `{minX, minY, maxX, maxY, width, height}` (min/max + 1), or null.
- `isSignedCell` (`:41`): two whole numbers, negatives allowed.
- `drawnBox(extent, declared, origin)` (`:58`): the box a map is drawn in.
- `gridOriginOf(grid)` (`:79`): `grid.minX/minY`, or (0,0) for an engine `Grid`.

It is a new module because the existing copies could not be reused as they stand:
- `slotInitialise.cellExtent` is module-private and computes `max + 1`, which is what `grid_dims` records today. That file is
  S2/S3's, and S2 should repoint it here when `grid_dims` becomes `max − min + 1`.
- `setMapLayout.cellBounds` is module-private in lab-5's file. lab-5 may hoist it onto this module later.

The module header names both.

⛓ **The drawn box always includes the origin cell.** That is the declared `grid_origin` when the document has one, else
(0,0). This was MEASURED, not assumed. At base, **26 of the 55 slots** the dump covers have a lowest cell above 0 on some axis
(`seedling_atlas_sphere` AP_1 starts at (4,4); `procgen_maze` AP_1 at (1,0)), and every map has always drawn them from column 0.
Drawing them from their own min would have moved their pixels. Under Q1 the start room IS (0,0), so the rule costs a signed
world nothing. `regionMapFrames.js:93` already frames the same way (`Math.min(minX, 0)`).

**`procgenPipeline/compositeMapDocument.js`**
- `mapBoundsFor` (`:143`) returns `{minX, minY, width, height, boundsSource}` from `cellExtent` + `drawnBox`.
  - `grid_dims` is anchored at `grid_origin` when declared, else at (0,0).
  - A single usable axis of `grid_dims` still bounds that axis, as before.
  - `boundsSource` keeps its meaning: `'grid_dims'` only when the declared box is larger than the cells + origin.
- `gridForBox(box)` (`:186`) is **the S1 bridge** (below).
- `reconstructResultFromSidecars` builds its grid with `gridForBox` (`:259`). It skips a non-integer cell (`:267`; it used to
  skip only a missing one) and returns `gridOrigin: {gx, gy}` (`:325`).

**`procgenCore/compositeMapRenderer.js`**
- `cellAtPoint` (`:191`) maps canvas column `c` to cell `c + minX` and returns the SIGNED cell. `wx`/`wy` are unchanged.
- `cellOriginPx(grid, regionSize, cell)` (`:207`, new export) gives `((gx − minX)·cellW, (gy − minY)·cellH)`. It is the one
  pixel mapping used by the exit centres of the connection pass (`:382`), the draw loop (`:452`, which iterates
  `minX..minX+width`) and both selection outlines (`:501`, `:509`). Grid lines are canvas-relative and did not need it.

**`procgenPipeline/procgenPipelineUI.js`**
- The composite canvas is sized from `grid.width/height`, which is now the drawn box.
- `dataset.gridMinX/gridMinY` (`:3682`) sit beside `gridW/H`.
- The click goes through `cellAtPoint`, so it is signed. Move Exits' within-cell pixel uses `cellOriginPx` (`:3821`).

**`apworldEditor/`**
- `regionLayout.isGridCell` (`:102`) = `isSignedCell`, so negatives are usable.
- `slotLayout` (`:127`) places cells on `gridForBox(mapBoundsFor(...))`.
- The Map canvas carries `dataset.gridMinX/gridMinY` (`apworldEditorUI.js:4896`).
- `sidecarIssues` `GRID_CELL_OUTSIDE` (`:524-546`):
  - The near edge (a negative cell) is an issue ONLY against a declared `grid_origin`. The box is then `[origin, origin +
    grid_dims)`, and the message says "from (x, y) … + `grid_origin`".
  - Without a declared origin, only the far edge (`≥ grid_dims`) is checked, with the message unchanged byte for byte.
  - There was no negative-cell test to drop: the existing producer only tests the far edge.
- `rulesDocOps` is NOT edited. Its move refusal calls `layout.grid.isInBounds`, which on the bridge grid is the signed box, so
  "a move never grows the map" now holds for a signed layout too. Q6 (extent ± 1) stays S3's.

**Scripts and the in-app mirror**
- `check-region-step-editing.mjs` (`:273`, `:385`) scans `grid.minX ?? 0 … + width`.
- `check-topdown-steps-ui.mjs` (`:290`, `:321`) scans and clicks through `dataset.gridMinX/Y`.
- `tests/testCases/apworldEditorTests.js` `expectedMapFromDocument`: the in-app row's mirror of the map size uses the same
  "extent ∪ (0,0)" rule. The value is identical for every committed document.

**Docs:** `docs/json/modules/apworldEditor.md`, the `GRID_CELL_OUTSIDE` row plus one *Signed cells* paragraph under M2's bounds
text. No procgen doc changed, so no doc-link census or index regeneration was owed. `procgenDocs/` vitest was run anyway and
is green.

## The survey's rows (§1 class b, §4, and the class-(a) rows marked neg = y)

| row | disposition |
|---|---|
| compositeMapDocument 134-155 `mapBoundsFor` | **done** (extent + origin) |
| compositeMapDocument 204-238 `new Grid` / `placeRegion` | **done** via the bridge grid; S2 replaces the bridge |
| compositeMapRenderer 186-193 `cellAtPoint` | **done** (signed) |
| compositeMapRenderer 366 / 433-491 exit px, draw loop, grid lines, selection | **done** (`cellOriginPx`) |
| procgenPipelineUI 3673-3680, 3739, 3817 | **done** |
| apworldEditorUI 4887-4892 | **done** |
| regionLayout 96-98 `isGridCell` | **done** |
| regionLayout 113-129 `slotLayout` | **done** |
| sidecarIssues 516-530 `GRID_CELL_OUTSIDE` | **done** (near edge only against a declared `grid_origin`) |
| presetUI 771 / 2474-2475 / 2563 | **not needed.** 771/2474 print `grid_dims` verbatim; there is no `max + 1` in the file. 2563 is a region's TILE size, not a cell. S2 makes `grid_dims` = `max − min + 1`, and this reader follows it unchanged |
| check-region-step-editing 273-277, 381-386 | **done** |
| check-topdown-steps-ui 289-321 (canvas scan) | **done** |
| check-procgen-presets 124-512 | **not needed**: grid INPUT pins only, with no canvas scan |
| shot-loaded-composite-map 96; preview-region-layout 95-99 | **not needed**: a report readout; already signed-safe |
| regionMapFrames, regionLayoutResolve, layoutControlsManager | **not needed**: already signed |
| setMapLayout 132-135, 185-189 | **not needed**: signed since the origin slice (lab-5's) |
| slotInitialise 535-545 `cellExtent` → `grid_dims` | **deferred to S2**: a writer of `grid_dims`, i.e. generated output |
| engine 5302-5308 sphere-tree rebuild | **deferred to S2** (per the brief) |
| engine `Grid` / `isInBounds` / `resize` / `deserializeGrid` | **deferred to S2** |
| rulesDocOps 2624-2627 move rule | **no edit**: it reads the bridge grid's `isInBounds`, so a move is bounded by the signed box. Q6 (± 1) is S3's |
| every class-(c) generator row | **deferred to S3** |

`apworldEditorTests.js` `m2EmptyCells` (`:9027`) is an in-app helper that scans `0..width`. It is correct for every committed
document and is left for S2, where `Grid` grows its origin.

## ⛓ The bridge left for S2

`compositeMapDocument.gridForBox(box)` returns an engine `Grid` when the box starts at (0,0), which is every committed
document. Otherwise it returns a module-private `OriginGrid extends Grid` with `minX/minY`, whose `isInBounds` tests
`[minX, minX + width) × [minY, minY + height)`. Cells are stored and returned SIGNED, as the document spells them.

**Why not "place into a min-0 `Grid` by subtracting `minX/minY`" (the brief's e.g.):** a shifted grid hands every reader
coordinates that are not the document's. That includes `getRegion` with a clicked cell, the editor's moves (`rulesDocOps`
writes the cell back), and the in-app rows that compare `grid.allRegions()` cells with `grid_cell`. Each would need the shift
undone by hand. With the subclass, only the pixel mapping (`cellOriginPx` / `cellAtPoint`) knows the origin. The origin is
still carried on the result as `result.gridOrigin`, as the brief asked.

**S2's move:** give `Grid` its own optional `minX/minY` with the same spelling, delete `OriginGrid`, and make `gridForBox`
`new Grid(box)`. Nothing that reads `grid.minX` / `gridOriginOf` changes.

**The maze composite map (js-20 edit 9).** `mazeRoom/mazeCompositeMap.js` does NOT read `compositeMapDocument`'s bounds or
result. It is a per-cell painter, and `drawCompositeMap` hands it `geom.offX/offY` in absolute canvas pixels. The
`gridOrigin` bridge therefore never reaches it. Its pixels are still covered: the maze presets (`procgen_maze` AP_1–3,
`cloudberry_maze_mix_worldgen`, `procgen_topdown` ×12 and the rest) are among the 58 dumped documents, and each dump's draw log
is every 2-D call the painters made. They are byte-identical.

## Byte-identity proof

`node scripts/dev/unbounded-grid-s1-dump.mjs <dir>` derives its list. It takes every tracked `*rules.json` that contains
`"grid_cell"`: **58 documents, 55 slots** (50 under `frontend/presets/`, 6 `worlds/*_worldgen`, 2 client fixtures). For each
slot it dumps, as canonical JSON:
- `mapBoundsFor` as the drawn box `{left, top, width, height, boundsSource}`;
- the reconstruction: grid size + origin, cell size + source, stats, refused, and every placed cell;
- every region's pixel rect;
- `drawCompositeMap` on a recording 2-D context, with art on, art off, a region selected and an exit selected (call count +
  sha256 of the full call log);
- `cellAtPoint` at every cell's centre and two corners, plus 6 off-canvas points, with the region picked;
- `slotLayout` (cells, grid size + origin, clash);
- `sidecarIssues`' `GRID_CELL_*` rows.

Results:
- BEFORE was committed at `4c91070e7f` (`unbounded-grid-s1-dumps/before/`, `index.json` sha256
  `6662a6fc…ffcd474`). Two BEFORE runs were identical, so the instrument is deterministic.
- AFTER at `9bd988a839`: `diff -r before after` is **empty**. AFTER was not committed, because it is the same bytes.
- Painted calls covered: 699,429 in the art-on variant alone.

## The signed fixture

`test/data/unbounded-grid/procgen_maze_AP_3_signed_rules.json` is the committed `procgen_maze/AP_3` document with slot 1's
cells translated by (−2, −2):
- The grid-growth start room `region_2_2` is at (0,0).
- The cells span (−2,−1)…(1,2), mixed signs on both axes.
- `grid_dims` 4×5 is kept, and `grid_origin` (−2,−2) is declared: the translated box, in the shape S2 will write.
- Region names are untouched; renaming is S4's.
- It lives in test data, NOT under `frontend/presets/`, so it enrols in no roster.

`frontend/modules/procgenPipeline/compositeMapDocument.signed.test.js`, 12 rows. The twin is the committed preset itself.

| row | asserts |
|---|---|
| cellExtent: min/max + 1 | signed extent; non-cells skipped |
| drawn box | includes (0,0), or the declared origin, and a declared box anchored there |
| gridOriginOf | engine `Grid` = (0,0); bridge grid = its own |
| premise | the fixture IS the twin translated; start at (0,0); mixed signs |
| mapBoundsFor | the same box at the translated origin |
| reconstruct | signed cells on the grid, in the twin's order; `gridOrigin` (−2,−2); same stats |
| **the SAME pixels** | the recording-context call log EQUALS the twin's, with art on, art off, a region selected and an exit selected |
| **the SAME rects + picks** | `cellOriginPx` equal; every pick at 3 points × 20 cells = the twin's pick + (−2,−2), same region (30 hits on regions); off-canvas → null; the start room is under canvas cell (2,2) |
| all-negative layout | with no metadata it still draws (the box widens to (0,0)) |
| editor `slotLayout` | `isGridCell` accepts negatives; 10 cells signed, no clash; the box edges are where the twin's are, translated; `neighborCell` crosses 0 |
| `GRID_CELL_OUTSIDE` | none for the fixture, with its origin, without it, or without metadata |
| declared origin | still bounds the near edge (message names `grid_origin`) and the far edge |

Re-records, all shape only: 5 rows of `compositeMapDocument.test.js › mapBoundsFor` now also expect `minX: 0, minY: 0`. Their
width, height and `boundsSource` values are unchanged.

## Gates

| gate | BEFORE (`c1927ba307`) | AFTER (`9bd988a839`) |
|---|---|---|
| bounded vitest, `--maxWorkers=3`: every test importing a touched file (`grep -a -l`) + `regionMap/` | 36 files, 1342 passed | 37 files, 1354 passed (= 1342 + 12 new) |
| the same + `procgenDocs/` | — | 45 files, 1849 passed |
| procgenCore layering (`bindingContract`) | — | 127 passed |
| `check-region-step-editing.mjs` (pure node, no server) | 14 PASS, ALL OK | 14 PASS, ALL OK |
| `check-procgen-presets.mjs` (dev server :8141, plus `frontend/external/cloudberry`) | 191 passed | 191 passed |
| `check-topdown-steps-ui.mjs` (dev server :8141) | 66 PASS | 66 PASS |
| in-app Region Map rows by `--test`, `--wait-for-box` | — | 4/4 PASSED |
| unbounded-grid-s1 dump (58 docs) | committed | `diff -r` empty |

`check-procgen-presets` needs the Cloudberry site, which is gitignored. Its first BEFORE run failed for that reason alone
(*"no Cloudberry site … run: node scripts/setup/fetch-cloudberry-site.mjs"*). It was fetched and the run repeated before any
edit.

The CI run ids (JSUT + `unittests` push runs, the TT dispatch read job by job with fast-batch headroom, and the `apworld` and
`feature-checks` dispatches) are taken at the exact tip that carries this report. They go in the packet to js-20 and in the
report-back, because a commit cannot quote runs made at itself.

### Pre-merge tip `d53f91c499` and the merge of origin/main `d24a057d99`

All five runs at `d53f91c499` were green:

| run | headSha | result |
|---|---|---|
| JSUT push `43950536676` | `d53f91c499` | success |
| `unittests` push `43950536855` | `d53f91c499` | success |
| TT dispatch `43950552920` | `d53f91c499` | success, all 9 jobs |
| `apworld` dispatch `43950558549` | `d53f91c499` | success |
| `feature-checks` dispatch `43950563900` | `d53f91c499` | success |

The TT run's fast-batch headroom was 257.6 s of 600 s (**43%**). The base TT run `43939045743` at `c1927ba307` measured
268.9 s (45%), so the tip ran 11.3 s faster.

origin/main then moved to `d24a057d99` (train `sdc-addon-u2-apworld`: `worlds/upstream_rules_addon/` and its CI and docs; no file
overlaps this slice). It was merged at `1749eb7b6a` and the gates were re-run there:

- bounded vitest: 32 files, 1201 passed. The list was re-derived as the tests importing a touched source, plus `regionMap/` and
  `compositeMapDocument*`.
- `check-region-step-editing`: ALL OK.
- `check-procgen-presets`: 191 passed.
- `check-topdown-steps-ui` (`--host=http://localhost:8141`): 66 PASS.
- Region Map `--test` rows: 4/4 PASSED.
- engineMd5: `bec369878feb67081187edca62baa951` (42 files), unchanged.
- The dump: all 58 BEFORE documents are byte-identical. The re-run lists one more document, this slice's own signed fixture
  (`test/data/unbounded-grid/…`). The instrument takes every tracked rules doc with a `grid_cell`, and the fixture is tracked
  since `9bd988a839`; the earlier AFTER dump was taken before that.

presets: none; four marks: none (closure no, presets none, gitlink no, Seedling legs none; the 3 md5s do not move).
