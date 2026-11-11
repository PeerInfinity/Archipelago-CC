# Cloud report: `rules-no-hit-remerge`

Branch `claude/rules-no-hit-remerge-o62ihu`. Started from the gates' work head
`c35bc65029eb` (`c35bc65029`), merged `origin/main` = `cf4d9a68746b6734aaa48c188b9f403689a98453` as `9437eea70b`.

**The directional no-hit gates are on today's main, with no new rule and no stop fired.** Everything except the
derived-rule table is regenerated and committed. The table is untouched: its 10 split-room rows still block the
rules, maze and ER producers until the planner re-records it on CI.

| commit | what |
|---|---|
| `9437eea70b` | the merge and its conflict resolutions |
| `f9a4cde16d` | regeneration through the producers |
| `4bb43c5362` | the divergence legs' goal-event ids |

## What the planner has to do

1. **Re-record the derived-rule table on CI** by `REGEN_RECIPE`. The same 10 rows block as on the old base (the
   first refusal is `derived-rule table: level_21|level_21 -> level_22 names no element of the compiled document`).
   A local run of the probe gives the table CI should produce: **116 → 108 rows**, 53 → 51 regions, 6 exclusions
   unchanged, every surviving row identical, `payloadMd5` `38db6f15…` → `a78de215…`, `engineMd5` unchanged.
2. **Re-record `seedling-derived-rules-expected.json`** in the same packet: 13 counts drift (item 3 below).
3. **This is a verdict move** (rows leave the table), so the recipe's designer review applies. Items 1 to 5 below
   are that review's inputs.
4. **Sequencing with R-A5** (item 5): do not land both without a second regeneration.

## The merge

Conflicts were exactly the planner's list. Resolved as briefed:

| file | resolution |
|---|---|
| `README.md`, `architecture.md` (generated regions), `docsIndex.js`, `instruments.js` | main's side, then `generate-procgen-reference.mjs` |
| `maze.md` | both: the no-hit bullet with its re-examine note, and main's longer L16 ↔ L17 bullet (it contains the gates side's older text of that bullet) |
| `census-seedling-er-doorways.mjs` | both reader domains (`doorwaysBesideLanding` and `playthroughNoHitGatesFor`) |
| `boxLock.test.js` | both roster rows, in both lists |
| `seedlingDivergenceLegs.test.js`, `campaign-frontier.json`, seed 1's `.archipelago`, `_worldgen_rules.json` | main's side, then re-recorded by recipe |

Git merged the atlas, AP_1, the partition, the maze, `seedling_er`, seed 1's rules and sphere log, and the leg-key
fixture without conflict. Each of those was then regenerated, and each came back byte for byte what the merge wrote.

## Regeneration

Done on a scratch table (the 10 blocking rows removed, found by running the rules producer until it stopped
refusing). The committed table was never staged. As a second check I put the probe's own locally regenerated
108-row table in place: the rules producer then reports `108 element(s) overridden`, `composed ≠ table: 0`, no
STALE warning, and every producer again writes the committed bytes.

| step | result |
|---|---|
| `make-seedling-playthrough-rules.mjs` | atlas `seedling-296d76b0`, md5 `29a294f1c81c27dcae64176b6fb37699` (the gates head's own; main did not move the atlas). AP_1 md5 `3a8f224d834a0e010d04c0781d5820c2` (main `b0e6a2be…`, gates head `0ce67229…`) |
| `make-seedling-subregion-partition.mjs` | 56 regions with sub-regions, each checked against its atlas |
| world package, by its recipe | `PASS: seedling_playthrough regenerates byte for byte`; only `_worldgen_rules.json` moved |
| seed 1 (`minimal-spoilers`) | `.archipelago` md5 `6765521a3788ac2c0e5fa68d005a823f`; rules and sphere log unchanged from the merge |
| `make-seedling-playthrough-maze.mjs` | md5 `9b3aa2e920bd5b8b6a6d7b1a1d0394a2`, unchanged from the merge |
| `make-seedling-er-preset.mjs` | seed 1, 50 placements, 48 exits moved, draws 1, 0 unbeatable, 89 sphere states; unchanged from the merge |
| surveys through 4.2 | route-only 29/29 steps SOLVE; full 39/39 steps SOLVE |
| `census-seedling-campaign.mjs --write-frontier` | only the `sources` AP_1 md5 moves |
| divergence door-leg keys | the merged fixture equals a fresh emission (841 keys); nothing to re-record |
| `seedlingDivergenceLegs.test.js` | goal-event leg ids: main's row (leg 220 leaves `flag:L16:0`) composed with the gates' shift (−8 from 260, −13 from 284) |
| `census-seedling-er-doorways.mjs` | `UNMEASURED readers: none`; `Q5: ZERO unclassified`; `doorwaysBesideLanding` 9 rows (3 stairs), `playthroughNoHitGatesFor` 14 rows (0 stairs). Its test passes unchanged |

## The designer's five items

### 1. The maze certifier, vanilla and ER

`probe-seedling-whole-game-certify.mjs --arms=new` and `--source=er --arms=new`, on the branch and on main as control
(local, 2 shards).

| run | problems / accepted / threw | lines |
|---|---|---|
| main, vanilla | 1 / 16 / 0 | 753 |
| branch, vanilla | 1 / 16 / 0 | 757 |
| main, ER | 1 / 16 / 0 | 754 |
| branch, ER | 1 / 16 / 0, `PASS: the ER arm matches … (1 / 16 / 0)` | 758 |

**No new problem row.** The one problem is the standing `level_63__r6c9 → level_63__r0c1` (explained,
path-vs-edge) in all four. The accepted sets are identical. The line diff is the same in both worlds: 13 lines go,
17 arrive.

Gone (all `[[]]`, that is free): `level_21->level_22<@1,5`, `level_22->level_21`, `level_22->level_25`,
`level_22->level_29__r2c2`, `level_22->level_30__r0c4`, `level_25->level_22`, `level_25->level_26__r2c4`,
`level_25->level_28__r0c6`, `level_25@Level 025 - Chest`, `level_26__r2c4->level_25`, `level_28__r0c6->level_25`,
`level_29__r2c2->level_22`, `level_30__r0c4->level_22`.

New:

| line | derived |
|---|---|
| `level_22__r8c0>level_22__r0c6` | `[["Ghost Spear"],["Progressive Shield"],["Progressive Sword"]]` |
| `level_25__r3c2>level_25__r2c7` | the same |
| `level_22__r0c6>level_22__r8c0`, `level_25__r2c7>level_25__r3c2` | `[[]]` |
| `level_21->level_22__r0c6<@1,5`, `level_22__r0c6->level_21`, `level_22__r0c6->level_29__r2c2`, `level_22__r8c0->level_25__r2c7<@1,8`, `level_22__r8c0->level_30__r0c4<@1,8`, `level_25__r2c7->level_22__r8c0`, `level_25__r2c7->level_28__r0c6`, `level_25__r2c7@Level 025 - Chest`, `level_25__r3c2->level_26__r2c4<@1,6`, `level_26__r2c4->level_25__r3c2`, `level_28__r0c6->level_25__r2c7`, `level_29__r2c2->level_22__r0c6`, `level_30__r0c4->level_22__r8c0` | `[[]]` |

**Does the maze world read the band `dirs`? Yes.** The maze producer takes the same grid
(`playthroughGridFor`, `make-seedling-playthrough-maze.mjs:568`), and the level-world compile turns each cell's
`dirs[dir]` into an entry gate: `levelWorldEntryGates`, `frontend/modules/procgenPipeline/regionAtlasMazeProjection.js:1238-1239`
(`u.dirs?.[dir]` for the tile left, `v.dirs?.[dir]` for the tile entered), called at `:1859`. The committed maze
preset shows it: `level_22__r0c6`'s payload holds `entry_gates` with `dir: "N"` on the band tiles and `level_25__r2c7`'s
with `dir: "E"`, both on `atlas_gate_0` = `Or(Progressive Sword, Ghost Spear, Progressive Shield)`.

So the agreement is not an echo of the atlas rule and not an independent physics finding either. The certifier
walks the maze world, and the maze world's gate is the producer's `dirs` stamp. The two crossings are `echoed: false`
in the probe (echoes stay at 21) because the composed AP rule is not copied into a payload; the gate reaches the
maze through the grid. The maze agrees because it is the same table read twice, which is what the gates slice
said ("the maze grid is the same grid").

### 2. The derived rows lost

`probe-seedling-derived-rules.mjs`, local, scratch output, on main (control: `ALL CHECKS PASSED`, table matches the
committed one, every pinned count matches) and on the branch. Table 116 → 108: 10 keys leave, 2 arrive.

| old key (in the table) | new element | composed AP rule | derived | label now | region class now | in the table |
|---|---|---|---|---|---|---|
| `level_21\|level_21 -> level_22` | `level_21\|level_21 -> level_22__r0c6` | `True_`, unchanged | `True_` | derived, agrees, equal | overridable | **yes** (re-keyed) |
| `level_28__r0c6\|level_28__r0c6 -> level_25` | `level_28__r0c6\|level_28__r0c6 -> level_25__r2c7` | `True_`, unchanged | `True_` | derived, agrees, equal | overridable | **yes** (re-keyed) |
| `level_22\|level_22 -> level_21` | `level_22__r0c6\|level_22__r0c6 -> level_21` | `True_`, unchanged | `True_` | derived, agrees, equal | walk-in | no |
| `level_22\|level_22 -> level_29__r2c2` | `level_22__r0c6\|… -> level_29__r2c2` | `True_`, unchanged | `True_` | derived, agrees, equal | walk-in | no |
| `level_22\|level_22 -> level_25` | `level_22__r8c0\|… -> level_25__r2c7` | `True_`, unchanged | `True_` | derived, agrees, equal | walk-in | no |
| `level_22\|level_22 -> level_30__r0c4` | `level_22__r8c0\|… -> level_30__r0c4` | `True_`, unchanged | `True_` | derived, agrees, equal | walk-in | no |
| `level_25\|@Level 025 - Chest` | `level_25__r2c7\|@Level 025 - Chest` | `True_`, unchanged | `True_` | derived, agrees, equal | walk-in | no |
| `level_25\|level_25 -> level_22` | `level_25__r2c7\|… -> level_22__r8c0` | `True_`, unchanged | `True_` | derived, agrees, equal | walk-in | no |
| `level_25\|level_25 -> level_28__r0c6` | `level_25__r2c7\|… -> level_28__r0c6` | `True_`, unchanged | `True_` | derived, agrees, equal | walk-in | no |
| `level_25\|level_25 -> level_26__r2c4` | `level_25__r3c2\|… -> level_26__r2c4` | `True_`, unchanged | `True_` | derived, agrees, equal | walk-in | no |

So the net loss is **8 rows, all for one reason: walk-in** (`walk-in from another member`, `overridable: false`).
None is partial, echoed or unpriced. Every one keeps its composed rule (`True_`) and its derived rule equals it.
Only the override is lost, not agreement.

- **Echoes: 21 → 21** (`copied` identical, the element set identical).
- **Unpriced: 302 → 302** (the list identical).
- Certifier triple 1 / 16 / 0 both sides. No row common to both runs changed in any field.

### 3. Each drifted count, by its rows

13 counts drift from `seedling-derived-rules-expected.json`. Every one is L22 or L25.

| count | before → after | rows or regions |
|---|---|---|
| `labels.pair.derived` | 203 → 207 | + `level_22__r0c6\|>level_22__r8c0`, `level_22__r8c0\|>level_22__r0c6`, `level_25__r2c7\|>level_25__r3c2`, `level_25__r3c2\|>level_25__r2c7` |
| `arrivals.regionsPriced` | 200 → 202 | − `level_22`, `level_25`; + `level_22__r0c6` (entrance), `level_22__r8c0` (landing 1,8), `level_25__r2c7` (entrance), `level_25__r3c2` (landing 1,6) |
| `arrivals.arrivalNodes` | 234 → 236 | the same regions, one arrival each |
| `arrivals.regionsPerArrivalCount.1` | 168 → 170 | the same regions |
| `routeA.classes.walk-in from another member` | 96 → 100 | + the four sub-regions |
| `routeA.classes.overridable` | 62 → 60 | − `level_22`, `level_25` |
| `routeA.overridableElements` | 145 → 137 | − the 8 elements of the two rooms: `level_22\|level_22 -> level_21`, `-> level_25`, `-> level_29__r2c2`, `-> level_30__r0c4`; `level_25\|@Level 025 - Chest`, `level_25 -> level_22`, `-> level_26__r2c4`, `-> level_28__r0c6` |
| `routeA.overridableEchoFree` | 136 → 128 | the same 8 |
| `routeA.overridableExact` | 122 → 114 | the same 8 |
| `routeA.regionsWithAnEchoFreeOverride` | 60 → 58 | − `level_22`, `level_25` |
| `routeA.regionsWithAnExactOverride` | 54 → 52 | − `level_22`, `level_25` |
| `table.rows` | 116 → 108 | the same 8 (the two re-keyed rows of item 2 stay) |
| `table.regions` | 53 → 51 | − `level_22`, `level_25` |

Not drifted: `elements` 405 (12 exits and 1 location renamed one for one; the 4 new rows are pairs, not elements),
every `labels.exit` and `labels.location` count, `w0`, `echoes`, `unpriced`, `sharedBinding`, `certifier`.
Row totals: 753 → 757 (13 gone, 17 new).

### 4. The seed-1 sphere log, as a rename map

90 entries before (main) and after. One entry differs, sphere 2.3, only in `new_accessible_regions`:

| old region | new regions |
|---|---|
| `level_22` | `level_22__r0c6`, `level_22__r8c0` |
| `level_25` | `level_25__r2c7`, `level_25__r3c2` |

**No location, item or event moves sphere.** All four sub-regions open in the sphere their room opened in.

`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`: 921 legs; the only `UNREACHABLE-AS-LEG`
rows are `level_84__r0c0` and `level_84__r3c0`, as on main. No location is newly unreachable.

**The route survey sees the rename; the frontier does not.**
- `route.json` (the survey's cache, not committed) names the sub-regions. Full route: leg 9 walks
  `level_22__r0c6 → level_22__r8c0 → level_25__r2c7`, and leg 10 walks back
  `level_25__r2c7 → level_22__r8c0 → level_22__r0c6`, which is the priced direction. Route-only: leg 4 passes
  `level_22__r0c6`. Step counts are unchanged (29 and 39) and every step solves.
- `campaign-frontier.json` names no L22 or L25 region. Its only change is the AP_1 md5 under `sources`.

### 5. Sequencing with R-A5

`origin/tile-rules-automation-r-a5` (`51021fae93`, merge base with main `2301163914`) also moves the atlas, AP_1,
the partition, the maze, `seedling_er`, seed 1, the world package, the leg keys and
`seedling-derived-rules-expected.json`. I did not merge it. A read-only trial merge of it into this branch
(`git merge-tree`, nothing written) conflicts in 23 files: the generated docs, the atlas, the partition, AP_1, the
maze, `seedling_er`, seed 1, the world package, the leg keys, the expected file, and five pin tests
(`seedlingAtlasArm`, `levelSetExporter`, `vanillaOverlay`, `seedlingAtlasDoorCensus`, `seedlingDivergenceLegs`).
R-A5's branch is also behind today's main, so part of that is main's own movement. Whichever lands second must
regenerate through the producers again and take a fresh table and expected file from CI. The two table re-records
cannot be combined by hand.

## Gates

Box: 4 CPUs, cloud container. Dev server `scripts/serve-nocache.py 8000`.

- **The witness probe, full run**: 20 plans, 60 checks, `ALL CHECKS PASSED`.
- **Bounded vitest, 178 files, 3500 tests.** The list is a guarded `rg -a -l` over the non-slow tests that read
  the atlas, AP_1, seed 1, the maze, `seedling_er`, the partition, the derived table, the frontier or the leg keys,
  plus the named files (the directional gates, the wallflyer bands, the probe's test, the ER door census, both
  obstacle-event tests, `boxLock`, the no-tracked-pointers guard, `checkProcgenHelp`, `lintGateLabels`, the
  constants census test).
  - **On the locally regenerated table: 178 files pass, 3500 tests pass.**
  - **On the committed table (the branch as pushed): 6 files red, 5 tests plus one file that fails to load;
    3465 pass, 30 skipped.** All are the table's refusal or its staleness, red by design:
    `derivedRuleTableFresh.test.js` (payloadMd5 `38db6f15…` → `a78de215…`), `seedlingAtlasDerivation.test.js`
    (E5), `regionAtlasLevelWorld.test.js` (the maze `--check` row), `mazeInputOutputSplit.test.js`,
    `seedlingErMode.test.js` (2 rows), `seedlingErSource.test.js` (fails to load).
- **`census-seedling-constants.mjs --write`**: 0 file change; its test passes.
- **`generate-procgen-reference.mjs --check`**: `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- **Producer `--check`s**, `ci-producer-checks.mjs --jobs=3` on the regenerated table: `98 run | 0 red | 1 skipped | 0 known-red`.
  On the committed table: the rules, maze and ER `--check`s refuse on the first blocking row; the partition
  `--check` is OK.
- **`check-worldgen-package-freshness.py seedling_playthrough`**: PASS.
- **Generate dirt**: `frontend/presets/preset_files.json` reverted (one line).
- No submodule pointer moved. Nothing under `worlds/seedling/`, `vendor/seedling` or `.github/` was touched.

**Not run:** the slow, train and calib vitest tiers; `npm test` browser batches; the unfiltered vitest; the
probe's `--chest` mode (no rule reads it); the derived-rules probe and the certifier on CI (local runs only, 2
shards, so the table's `measuredAt` is empty in my scratch copy).

## Notes

- The merge commit alone is not green: the world package's rules, the frontier and the leg ids are fixed by the
  two commits after it.
- The bootstrap reached `READY`.
