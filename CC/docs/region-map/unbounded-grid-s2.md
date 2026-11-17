# Unbounded grid S2: `Grid` gets an origin and an unbounded kind (report)

Session `unbounded-grid-s2`, branch `unbounded-grid-s2`, worktree `Archipelago-CC-wt-unbounded-grid-s2`, cut `--with-wasm`.
- **Base:** `e4ce4854e5bfe1dc787d59e84ee7de2fbbdcf85c` (train 134, which includes S1). `git merge-base HEAD origin/main` printed
  exactly that SHA, and origin/main had not moved when the gates ran, so no merge was needed.
- **People:** planner archipelago-cc-23; reviewer and landing-queue owner seedling-js-planning-20; lab owner
  seedling-lab-planning-6; generator owner tile-primitives-design-7.

⚖ **Rulings (user, 2026-11-15/16, via archipelago-cc-23).**
- *"If possible, I want to remove the requirement for the top left to be (0,0) in all of this code. If possible, I also want
  to remove the restriction to a fixed size box during generation."*
- *"Rather than deleting the existing code entirely, we can keep the bounding box as a setting for generation, and instead
  just change the default to unlimited."*
- 2026-11-16: the survey's recommendations were accepted, including Q1: signed storage, with the start room at (0,0).

S2 changes **no generated output, no preset and no pixel**. Every generation is still bounded and min-0. Turning
unbounded generation on is S3's job.

⚖ **design-7's word on the API (2026-11-16), quoted:**
- *"the S2 Grid API (a–g) is OK from the tile side. Go ahead with procgenPipelineEngine.js."*
- *"null = unbounded is fine. Making resize-on-unbounded throw is the right call. (g), anchoring at (0,0), is a good
  catch."*

design-7 had checked the closure itself at the base. None of the 42 closure files imports `procgenPipelineEngine`,
`compositeMapDocument` or `cellExtent`, and none mentions `grid_dims`, `gridDims` or `grid_origin`.

## What changed

**`procgenPipeline/procgenPipelineEngine.js`, `Grid` (`:280`)**
- `new Grid({width, height, minX = 0, minY = 0})` is a **bounded** box, `[minX, minX + width) × [minY, minY + height)`.
  - Without `minX`/`minY` it is exactly the Grid every driver builds today.
  - Its own fields are `width, height, minX, minY, cells, teleporters`: today's fields plus the origin. `minX`/`minY`
    are the spelling S1's readers (`gridOriginOf`) already use.
  - A non-integer origin throws.
- `new Grid(null)` is **unbounded**:
  - `isInBounds` (`:330`) is true for every integer cell, so `neighborCell` never returns null and `openSides` lists
    every unbuilt side.
  - `width`/`height`/`minX`/`minY` are own getters, derived from the placed cells through `procgenCore/cellExtent`
    (`_extent`, `:323`, reads the cell KEYS).
  - An **empty unbounded grid is 0×0 at (0,0)**. That is a defined value, not a refusal, and no loop iterates or
    divides by NaN.
- **Why `null` and not `{unbounded: true}`:** survey §5 already spells the engine-side setting as "a `gridDims` of null =
  unbounded". The drivers' existing `new Grid(gridDims)` calls (growMaze, layoutTopDown, the spiral realiser,
  growSpheres ×2) therefore take S3's `null` with no new branch at the call site.
- `grid.bounded` (`:318`) says which kind a Grid is. It is a prototype getter over a module-private `WeakSet`
  (`UNBOUNDED_GRIDS`, `:278`), so a bounded Grid carries no extra field.
- `resize` (`:349`) takes `{width, height, minX = this.minX, minY = this.minY}` and is **grow-only on each side**: the
  new box must contain the old one.
  - To grow on the negative side, lower `minX` and raise `width` by the same amount.
  - Cells and teleporters are never re-keyed; they keep their signed coordinates.
  - Today's caller (sphere-append, `{width, height}` only) keeps the origin and gets today's error text byte for byte.
  - On an unbounded grid `resize` throws. There is no box to grow, and a silent no-op would hide an S3 caller that
    believes it set a cap.
- `serializeGrid` (`:603`) writes `width, height`, then `minX, minY` **only when the origin is not (0,0)**, then
  `teleporters, cells`. An unbounded grid writes `unbounded: true` and no size.
  - `deserializeGrid` (`:627`) reads all three shapes. A grid serialised before S2 reads as min (0,0).
- `findDisconnectedCell` (`:655`) and `findDisconnectedCellFromOccupied` (`:690`, whose `dims` may now carry
  `minX/minY`) scan from the origin, and their empty-grid "centre" is `min + ⌊size/2⌋`.
  - For min 0 these are the same cells in the same order.
  - On an empty unbounded grid the answer is (0,0), the Q1 start cell.
  - Which window an unbounded grid should search is S3's question.
- **Sphere-tree rebuild** (`:5387`):
  - The box is anchored at the slot's `grid_origin`, else (0,0), spans `grid_dims` from there, and is widened to every
    node cell on either side, with the floor of 5 as before.
  - Without `grid_origin` this is `width = max(grid_dims, gx + 1)`, exactly as before.
  - The start fallback (`:5450`) and the envelope `dims` (`:5524`, which carries an origin only when it is not (0,0))
    follow the box.
- **`buildRulesJson`** (`:8211`) writes `grid_dims` and `grid_origin` from `recordedGridBox`. `grid_origin` is placed
  right after `grid_dims`, and only when it is set.

**`procgenCore/cellExtent.js` `recordedGridBox` (`:90`, new):** the one writer rule.
- `grid_dims` is the cells' box **widened to include (0,0)**: `max − min + 1` with the min clamped at 0.
- `grid_origin` is that box's top-left, and only when it is negative on either axis.
- No cell gives 0×0 with no origin.
- ⛓ **Measured, not taken from the brief.** The brief said `grid_dims = max − min + 1`. Literally applied, that would
  CHANGE committed output: S1 measured 26 of 55 slots with a min above 0, and `seedling_atlas_sphere` AP_1's cells span
  (4..7, 4..10). Its recorded 8×11 would become 4×7.
  - S1's readers anchor `grid_dims` at (0,0) when no `grid_origin` is declared (`drawnBox`, `sidecarIssues`), so a box
    written without an origin MUST start at (0,0).
  - With every cell ≥ 0 the rule gives `max + 1`, which is byte-identical.
  - design-7 agreed and asked for the proof (below).

**`apworldEditor/slotInitialise.js`:** the module-private `cellExtent` (`max + 1`) is gone. `gridRecordOf` (`:537`)
calls `recordedGridBox`, and the op's `procgen_metadata` spreads it (`:633`).

**`procgenPipeline/compositeMapDocument.js`:** S1's bridge is deleted. `gridForBox(box)` (`:188`) is
`new Grid({width, height, minX, minY})`, and `OriginGrid` is gone. Nothing that reads `grid.minX` / `gridOriginOf`
changed. `regionLayout.js` (lab-6's) calls `gridForBox` unchanged and was not edited.

**`frontend/schema/rules.schema.json` (`:399`):**
- The new optional `procgen_metadata[p].grid_origin` is `{gx, gy}` integers, with `additionalProperties: false`.
- The `grid_dims` description now states the widened-to-(0,0) rule; it used to cite stale line numbers.
- Readers of `grid_origin`, all landed in S1:
  - `compositeMapDocument.mapBoundsFor` (`:156`);
  - `sidecarIssues` `GRID_CELL_OUTSIDE` (`:523`);
  - since S2, the sphere-tree rebuild (`:5387`).

**`tests/testCases/apworldEditorTests.js` `m2EmptyCells` (`:9033`):** the in-app helper S1 left for S2 now scans from
`grid.minX/minY`. That is the same cells in the same order for every committed document.

**Docs:** in `docs/json/modules/apworldEditor.md`, one sentence under *Signed cells* says the bridge is gone, and the
Initialise op's `grid_dims` text now states the writer rule. No procgen doc changed. `procgenDocs/` vitest was run anyway
and is green.

## The survey's and S1's "deferred to S2" rows

| row | disposition |
|---|---|
| engine `Grid` constructor / `isInBounds` / `resize` / `placeRegion` / `relocateRegions` / `neighborCell` / `openSides` | **done**. The last four follow `isInBounds` |
| engine `serializeGrid` / `deserializeGrid` | **done**. The origin is written only when it is not (0,0); `unbounded: true` |
| engine `findDisconnectedCell` (`:589` at base) / `findDisconnectedCellFromOccupied` (`:622` at base) | **done**: scan from the origin |
| engine sphere-tree rebuild (`:5302-5308` at base) | **done**: extent + origin |
| engine `buildRulesJson` `grid_dims` (`:8108-8125` at base) | **done**: `recordedGridBox`, plus `grid_origin` only when negative |
| `slotInitialise.cellExtent` (`:535-545` at base) | **done**: repointed to the shared module |
| `compositeMapDocument` bridge (`OriginGrid`, `gridForBox`) | **done**: deleted / `new Grid(box)` |
| schema `grid_origin` | **done** |
| `apworldEditorTests.js` `m2EmptyCells` | **done** |
| other `0..width` loops | **none left on a region-cell Grid.** `grep -a` finds `regionAtlasMazeProjection.js` (a region's TILE grid) and the S1 dump's canvas-pixel scan, neither a cell box |
| every class-(c) driver row; `presetRun` / `sphereSteps.gridSizeFor` / CLI / panel; teleport window; grow stop rule; editor move rule | **S3**, as scoped. No driver builds `Grid(null)` or an offset grid yet |

## Byte-identity proofs (base `e4ce4854e5` → tip)

**Generation.** The regenerate-and-`cmp` harness (scratch, not committed) derives its roster at run time: every tracked
`*rules.json` that contains `"grid_dims"`. That is **47 documents**. Each one is regenerated by its own recipe into a
scratch dir and `cmp`'d, or checked by its producer's own `--check`.

| documents | recipe | base | tip |
|---|---|---|---|
| `procgen_topdown` AP_1–12 | `generate-topdown-preset.js`, the `generated_commands.sh` lines, `--out` to scratch | IDENTICAL ×12 | IDENTICAL ×12 |
| `procgen_maze` AP_1–3 | `generate-procgen-rules.js`, the same | IDENTICAL ×3 | IDENTICAL ×3 |
| `jta_{dataset,locations,prestige,randomized,schedule}_test` | `generate-jta-locations-test-preset.mjs --out` | IDENTICAL ×5 | IDENTICAL ×5 |
| `seedling_spiral_room`, `seedling_sphere_room`, `seedling_generated_{room,leaf,host,swim,chestdoor}`, `seedling_atlas_{host,location}`, `concept_trial`, `meta_trial` | `make-seedling-spiral-room-preset.mjs --state=X --check` | CHECK-GREEN ×11 | CHECK-GREEN ×11 |
| `worlds/{cloudberry_sphere,cloudberry_double_jump,cloudberry_hero_physics,cloudberry_maze_mix,procgen_maze}_worldgen/_worldgen_rules.json` | `check-worldgen-package-freshness.py` | CHECK-GREEN ×5 | CHECK-GREEN ×5 |
| `seedling_atlas_sphere` AP_1 | `check-atlas-sphere-roundtrip.mjs`'s `dump-sphere-growth` arguments, built through `resolveConfig` + `build()` | DIFF | DIFF, **fresh output md5 `f576e942…` = base's**: `grid_dims` 8×11, no `grid_origin` |
| cloudberry presets ×4, `multiworld` ×3, `localRulesOverlay` fixtures ×2, S1's signed fixture | Cloudberry WebGL browser + Python Generate.py writing into `frontend/presets` / hand-made | NOT REPRODUCIBLE here | NOT REPRODUCIBLE; committed bytes unchanged |

Notes on the table:
- The cross-checks `check-procgen-maze-recipe.mjs` and `check-jta-dataset-pipeline-preset.mjs` were rc 0 at both base
  and tip. The tree was unchanged across both runs (measured).
- **`seedling_atlas_sphere` is stale at base,** independently of S2:
  - its CLI recipe is refused (`'atlas:seedling' is not a registered substrate`);
  - a fresh build differs in about 58 lines (`victory` → `Victory`, and one location rename).

  The base and tip regenerations are byte-identical. With its (4,4) start, it is the document the widened-to-(0,0)
  rule exists for.
- **Of the 47, 32 go through `buildRulesJson` directly, and all 32 are reproduced at the tip.**
- **None of them is produced by `slotInitialise`,** which is driven only from the editor. Its writer is covered by the
  shared `recordedGridBox` rows below and by the bounded `slotInitialise*` tests.

**Producers and dumps:**
- `ci-producer-checks.mjs`: 99 run, 0 red, 1 skipped (`plan-seedling-r7-ends-meet`, wasm in Chromium, a standing CI
  arm). That includes `regenerate-procgen-topdown-presets --check`.
  - At base the battery printed one `TREE-MOVED` row. The cause was this session's own two new test files, created
    mid-run, not a producer.
- `dump-{topdown,sphere,maze}-byteidentity.mjs` and `check-spiral-byteidentity.mjs` outputs: `cmp` equal base → tip
  (md5 `41ef4847`, `5497f9d6`, `ecb7add3`, `425c74f4`).
- `presetDefs.generate.slow.test.js`: 27 passed at both base and tip.
- The engine snapshot files are untouched (no `__snapshots__` in the diff).

**Document and pixel identity:** `node scripts/dev/unbounded-grid-s1-dump.mjs` at the tip is byte-identical to the same
dump at base. Against S1's committed `unbounded-grid-s1-dumps/before/`, the ONLY differences are S1's own 3 items:
- `index.json` count 58 → 59;
- the hash line of `test/data/unbounded-grid/procgen_maze_AP_3_signed_rules.json`;
- that document's per-doc file.

**Seedling (js-20 edit 1):**
- No Seedling recipe needs `frontend/modules/flashPanel/wasm` or `vendor/seedling`; the traced reads touch only
  `flashPanel/atlases/seedling*.json`.
- At the tip:
  - derived table `seedling-playthrough-derived-rules.json` md5 **`5f1770b7aaa1ca072bd6ddfcb7bcabd1`**;
  - `batch-seedling-acceptance.mjs | md5sum` **`391322d681b7aa0229d94b3f6906d024`**;
  - `--print-engine-closure` engineMd5 **`bec369878feb67081187edca62baa951`** (42 files), equal to the base.
- Closure ∩ `git diff --name-only e4ce4854e5..HEAD` = ∅, against both `closure.txt` and the printed closure.

**No committed artifact moves:**
- `git diff --name-only e4ce4854e5..HEAD` shows nothing under `frontend/presets/`, `worlds/`, `apworlds/` and no atlas.
- The schema is the one non-code, non-doc, non-test file.
- 0 gitlinks.

**Python round trip (js-20 edit 3, measured only):**
- `world_generator/generator.py:383-388` writes the slot's whole `procgen_metadata` block with `json.dumps`.
- `exporter/games/base/handler.py` `_inject_worldgen_procgen_metadata` re-injects the whole block under the player.
- A scratch test on `test_loop_costs_export_roundtrip.py`'s fake-package helper put `grid_origin {gx:-2, gy:0}` through
  the handler. It came back equal, in key order. **`grid_origin` survives the round trip**, so there is no S3/S4
  precondition here.
- `test/general/test_schema_validation.py`, `test_python_tests_needed.py`, `test_rules_export_format_fallback.py` and
  `test_loop_costs_export_roundtrip.py`: 30 passed, 480 subtests.

## The new rows: `procgenPipeline/procgenPipelineEngine.grid.test.js` (17)

| group | rows |
|---|---|
| origin grids | today's own fields and (0,0) when the origin is omitted; a bad origin or size throws; `isInBounds` on all four edges; place/store signed + out-of-box refusal; neighbours stop at the box; `resize` grows to the negative side, keeps cells and teleporters, refuses a cut on either side, accepts a lower `minX` with enough width, and keeps today's message for the origin-keeping shrink; `findDisconnectedCell` scans from the origin; serialise carries `minX/minY` only when not (0,0) and round-trips byte for byte |
| unbounded grids | empty = 0×0 at (0,0) and `findDisconnectedCell` → (0,0); every integer cell in bounds, never-null neighbours; the extent tracks place / move / remove; `resize` refuses; serialise as `{unbounded: true}` round-trips |
| back compat | `test/data/unbounded-grid/grid_growth_3x2_seed5_serialized.json`, **written by `serializeGrid` at the base**, has no origin, deserialises to a min-0 Grid and re-serialises byte for byte; the same grid grown at the tip serialises to exactly that file |
| the writer | `recordedGridBox`: empty; min 0; min above 0 (the (4,4) case) = `max + 1`, no origin; negative on one or both axes → origin. `buildRulesJson` of a grown 3×2 grid translated so its start is at (0,0), on a `Grid(null)`: `grid_dims` 3×2, `grid_origin` = the shift, placed right after `grid_dims`, and the document otherwise EQUALS the untranslated one once `grid_cell` is shifted back |

The S1 row titled "the bridge grid carries its own" was renamed to say it is the engine Grid; its assertions are
unchanged.

## Gates (local)

| gate | base `e4ce4854e5` | tip |
|---|---|---|
| bounded vitest `--maxWorkers=3`: every test importing a touched source (`grep -a -l`), the engine/compositeMap/cellExtent/renderer/slotInitialise/rulesDocOps/regionLayout/sidecarIssues tests, `regionMap/`, the schema tests | 78 files, 2161 passed | 79 files, 2178 passed (= 2161 + 17 new) |
| `procgenDocs/` + `bindingContract` | — | 9 files, 624 passed |
| `presetDefs.generate.slow.test.js` | 27 passed | 27 passed |
| `ci-producer-checks.mjs` | 99 run, all rc 0 | 99 run, 0 red |
| regenerate-and-`cmp` (47 docs) | 36 reproduced, 1 stale, 10 not reproducible | every verdict the same |
| `check-region-step-editing.mjs` | — | ALL OK |
| `check-topdown-steps-ui.mjs` (:8141) | — | ALL CHECKS PASSED |
| `check-procgen-presets.mjs` (:8141, Cloudberry site fetched) | — | 191 passed |
| in-app Region Map rows by `--test`, `--wait-for-box` | — | 4/4 PASSED |

The CI run ids (JSUT, `unittests`, `train_only`, TT read job by job with fast-batch headroom, `apworld`,
`feature-checks`) are taken at the exact tip that carries this report. They go in the packet and the report-back,
because a commit cannot quote runs made at itself.

## The `Grid` API as S3 will use it

- **Ask for unbounded generation** by passing `null` where a driver passes `gridDims` today: `new Grid(null)`. Every
  driver already builds its grid as `new Grid(gridDims)`.
  - The driver must then pick its start cell itself. Today it picks the box centre from `gridDims.width/2`, which
    has no meaning for null; under Q1 the start is (0,0).
  - It must also stop relying on out-of-box neighbours. `neighborCell` never returns null and `openSides` is every
    unbuilt side, so grid growth's frontier never empties (survey Q5).
- **A cap** is a bounded box, `new Grid({width, height, minX, minY})`. Per-axis caps (one axis capped, the other not) are
  not representable yet. That is S3's call, and it needs either a new box kind or a cap check in the driver.
- **Growing a capped box** to the negative side is `grid.resize({width: w + k, height, minX: grid.minX - k})`. An
  unbounded grid refuses `resize`.
- **`findDisconnectedCell` on an unbounded grid** scans only the placed cells' extent, which with a gap ≥ 2 is often
  empty and returns null. S3's teleport-target window (survey: extent ± (gap + 1)) replaces that scan.
- **Where `grid_origin` appears:** `procgen_metadata[p].grid_origin = {gx, gy}`, right after `grid_dims`. It is written
  by `buildRulesJson` and the editor's Initialise only when the cells' box (widened to (0,0)) starts below 0, so a world
  whose start room is at (0,0) and grows north or west gets it. It is read by `mapBoundsFor`, `GRID_CELL_OUTSIDE` and
  the sphere-tree rebuild, and the Python world_generator/exporter round trip carries it.
- `serializeGrid` transports the origin (`minX/minY`) and the kind (`unbounded: true`) between pipeline steps, so the
  stepped sphere pipeline's envelope keeps them.

presets: none; four marks: none (closure no, presets none, gitlink no, Seedling legs none; the 3 md5s do not move).
