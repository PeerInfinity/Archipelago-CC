# Region map: a level-art painter threw `world.obstacles.get is not a function`

Branch `region-map-painter-throws`, cut at `d05f789087` (`git merge-base HEAD origin/main` at launch:
`d05f789087aa90d1b5e5871890992be8cd9fb096`). The fix is `58105d8f76`. Before the packet, origin/main
`102dcbeb169dc3d039419f64e9538aede92ee270` (train 227, the Region Graph stack) was merged in (`697067132e`), and one line of the
test followed it (`5c4f406022`): main's `SUBSTRATE_LIBRARIES` gained `mysteryArchipelago/mysterySubstrateLibrary.js`, so the
sweep imports it too. The gated tip is **`5c4f4060223ba709cefa0ffd6f7d597ed4c49ed6`**. This report and its pictures are a
docs-only commit after it.

## The ruling

Session 84c8ab35 (archipelago-cc-23), **2026-11-26T21:00:02.464Z**. The planner asked *"Should I start a small session to
find the cause and fix it?"* and the user answered **"Yes, find and fix it (Recommended)"**. js-23's review (GO WITH 2
SHARPENINGS): `mazeRoomEngine.js` and the other maze closure files are read-only, and the count is quoted from the TT fast
job logs at the tip, on both boots.

## The cause

`regionMap/regionMapModel.js` `buildRegionMapModel` gave each cell's painter the sidecar's `playable_payload` exactly as it is
stored in rules.json. A maze world is stored with `obstacles` and `items` as `[key, id]` lists. The maze painter
(`mazeRoom/mazeCompositeMap.js`, declared as `compositeMap.drawRegion` by `mazeRoomLibrary.js`) reads them as Maps, which is
what its contract says. The pipeline's Map tab meets that contract: `procgenPipeline/compositeMapDocument.js` passes every
payload through the substrate's own `deserializeWorld` (`procgenCore/deserializeRefusal.js` `deserializeOrRefuse`). The Region
Map skipped that step. So every maze cell drew its floor and walls, then threw at the first `world.obstacles.get(key)`
(`mazeCompositeMap.js:288`). `regionMapCellDraw.drawCellArt` caught the throw, logged `regionMap: a painter threw`, and kept
what had been drawn. The Region Graph's map look builds the same model (`regionGraph/mapLookLayer.js`), so it threw too.

The painter was the right one: `compositeMapPainterFor` resolves `render_hint ?? substrate`, and these regions are
`substrate: 'maze'`. Their Seedling names (BlackCastle, CreditsRoom, …) come from `procgen_topdown`, which lays maze levels
on the Seedling-named overworld.

**The rows.** All 2,199 warnings in a TT fast job come from 7 Region Map rows, all on `procgen_topdown/AP_1` (9 maze
regions). Counts from main's bundled job 140129610294, attributed by `[PROGRESS]` line:

| row | warnings |
|---|---:|
| `region-map-zoom-pinch-links` | 112 |
| `region-map-clicks-generated` | 356 |
| `region-map-click-default` | 382 |
| `region-map-click-master-off` | 368 |
| `region-map-click-location-check` | 107 |
| `region-map-go-to-equals-canvas-click` | 818 |
| `region-map-click-settings-independent` | 56 |
| **total** | **2,199** |

**A second case with the same cause.** Text-adventure cells did not throw, but they were drawn wrong. A room's exit gates are
stored in `exitGates`, and `deserializeWorld` moves them onto the exits as `access_rule`. Without that step, the painter drew
every gated exit open (green). The fix now draws them closed (red), which is what the pipeline's Map tab already showed.
That's 17 cells in 7 presets, `procgen_topdown/AP_10–12` among them. No TT row looks at those cells.

## What the user saw

Partial cells: the floor and walls, plus the overlay's location squares. A level's exits, doors, items, obstacles and keys
were all missing. Before and after shots, from `scripts/dev/shot-region-map-painter-throws.mjs` on `procgen_topdown/AP_1`,
1600 × 1000:

- `painter-throws-shots/before-region-map-BlackCastle.png` → `after-region-map-BlackCastle.png`
- `painter-throws-shots/before-region-map-CreditsRoom.png` → `after-region-map-CreditsRoom.png`
- `painter-throws-shots/before-region-map-fit.png` → `after-region-map-fit.png` (Fit all)
- `painter-throws-shots/before-region-graph-map-look.png` → `after-region-graph-map-look.png` (Region Graph,
  `nodeLook = map`, `subRegionView = merged`, 9 cells)

`*-measure.json` has the warnings counted in the app for each view. Before: Fit all 95, BlackCastle 49, CreditsRoom 5, the
Region Graph map look 54. After: 0 in every view. No page errors in either run.

## The fix

All of it is in `regionMap/regionMapModel.js`. After a cell's extent is read, the model runs the cell's payload through the
substrate's own `deserializeWorld`, using `deserializeOrRefuse`, the same function `compositeMapDocument` uses. If a substrate
declares no deserializer, its payload is passed through unchanged. If the deserializer refuses a payload, the model adds it to
a new `model.refused` list (`{region_id, key, substrate, sentence}`) and the cell draws the generic box. The committed corpus
has 0 refusals. The data hooks (`regionExtent`, `locationTiles`, `remoteLocationTiles`) and the link code still read the
sidecar payload, as before.

Why the fix belongs here and not in the painter: the painter's contract is a deserialized world, and the Map tab already meets
it. Making the painter accept both shapes would be a second way to read a maze payload, and it would have to be in
`mazeCompositeMap.js`. Also, the Region Map would still hand every other substrate's painter the wrong shape: the text-adventure
case above is one example.

These are not changed: the painter selection (`compositeMapPainterFor`), every painter, `regionMapCellDraw.js`, the painter API
that `groupBadgeLayer` and `mapLookLayer` read, and the try/catch in `drawCellArt` (it stays as it was; nothing new catches
anything). Nothing under `mazeRoom/`, `procgenCore/`, `shared/procgen/` or `regionGraph/` changed. The closure check
(closure ∩ diff = ∅) passes, and the engine MD5 is `9c8140bf0972d27eccde90ce1ea5a0dc` at both base and tip.

**Seedling cells are byte-inert.** Every painter call over every committed preset was recorded on a recording canvas, before
and after the fix: the 353 `flash_seedling` and 7 `flash_seedling_gen` cells have identical op logs. Their `deserializeWorld`
only rewrites `exits`, and the cell's region object carries `exits: []` (step-1 residue), so the painter never reads the
payload's exits.

## The sweep

`regionMap/regionMapPainterHydration.test.js` covers:

- **The failing shape, reproduced.** A maze sidecar from the frozen fixture, with `obstacles` as a list, makes the maze
  painter throw `obstacles.get is not a function`.
- **Fixed.** Through `buildRegionMapModel`, every maze cell paints without throwing, its world has Map `obstacles` and
  `items`, and `refused` is `[]`. Every gated text-adventure exit draws `COLORS.exitBlocked`, read off `fillRect` and not
  text, because a locked location uses the same red.
- **Sweep.** Every painter runs over every committed preset's regions that it claims (`git ls-files frontend/presets`). The
  test asserts that the maze painter was reached and that there are 0 throws. It imports every library in
  `SUBSTRATE_LIBRARIES` and holds the import list equal to it, so a new substrate cannot drop out of the sweep.
- **Frozen fixtures:** `regionMap/fixtures/painter-throws-maze.frozen.json` and `painter-throws-topdown-mixed.frozen.json`
  are verbatim copies of `procgen_maze/AP_1` and `procgen_topdown/AP_11`. The sweep pins no digest and no count.

Measured: before the fix, **1,197 throws, all from the maze painter, in 24 presets**. After: **0**. No other painter threw,
either before or after. Negative control: with base `regionMapModel.js`, the test fails 4 of 6. With the fix, it passes 6 of 6.

## Gates

- Bounded vitest: `npx vitest run frontend/modules/regionMap/ frontend/modules/regionGraph/ frontend/modules/mazeRoom/
  --maxWorkers=3`. Result: 132/133 files and 2,872/2,873 tests. The one failure was
  `mazeRoom/tileSpike/sphereOrderLevels.test.js` L12, at 85.6 s, while another session's vitest was sharing the box. Run alone,
  that file passed 35/35. It imports nothing in this diff. The only test files that import `regionMapModel.js` are under
  `regionMap/` and `regionGraph/`, so the run covered them.
  At the merge, the same three paths: 135/135 files, 2,914/2,914 tests.
- Closure ∩ diff = ∅ (`seedlingDerivedRuleTable.js --print-engine-closure`, 42 files, against `git diff --name-only
  origin/main HEAD`). 0 gitlinks in the diff. `engineMd5` is `74ae60f575531492ed9eaec1839e1fe3` at origin/main `102dcbeb16`
  and at the tip. Main moved it from `9c8140bf…` (the base's); this diff does not.

**CI at the exact tip `5c4f4060223ba709cefa0ffd6f7d597ed4c49ed6`** (every run's headSha):

| run | id | result |
|---|---|---|
| JavaScript Unit Tests | 46030597106 | green, 1460 files / 30533 tests vs main `102dcbeb16` 1459 / 30527: **+1 F / +6 T**; slow 42/470 both |
| unittests | 46030597228 | green |
| TT (`test-templates.yml`) | 46030592911 | green, every job |
| `-f batch=tutorials-tracker` | 46030596703 | green; `tutorial-walk-tracker-region-map` PASSED |

**`a painter threw`, TT fast job, `grep -a -c`:**

| | ES boot | bundled boot |
|---|---:|---:|
| main `102dcbeb16`, push run 46028782625 | 2,199 (job 140607622398) | 2,206 (job 140606927351) |
| main `102dcbeb16`, train dispatch 45947931052 | 2,171 (job 140340917841) | 2,199 (job 140336824312) |
| **tip `5c4f406022`, run 46030592911** | **0** (job 140614038191, green) | **0** (job 140613084010, green) |

Both tip jobs have 0 FAILED rows; `test_region_graph_sub_region_merged` PASSED on both boots, and every Region Map / Region
Graph row passed.

**Headroom** (fast batch, of 600 s): tip ES 323.7 s, bundled 325.1 s. Main at `102dcbeb16`: ES 326.8 / 343.8 s, bundled
333.8 / 337.8 s (the two completed samples; a third was still running). The tip is under every main sample on both boots.

**Visible change beyond the throws.** 17 `text_adventure` cells in 7 presets (`procgen_topdown/AP_10–12` among them) now
draw their gated exits closed (red), as the pipeline's Map tab does. No other painter's output changed: the Seedling op logs
are identical.

## Other warnings seen

None in scope. Before the merge, the tip's bundled job was red twice on `test_region_graph_sub_region_merged`'s badge hit
test, the condition main's bundled job 140129610294 (`754b1909bb`) also failed on. Train 227 fixed it: green on both boots at
the merge.
