# atlas-sphere-rerecord — parser fix + `seedling_atlas_sphere` re-record (2026-11-17)

Branch `atlas-sphere-rerecord`, base `4e0eab7215` (origin/main at launch; unmoved at packet time).
Licence: Robert, 2026-11-17, "Fix parser + re-record, one slice", widened once to a fifth file by
ruling (a) "Own small fixture for that row" when the re-record turned one reader red, and to a sixth by
"Read the goal from the preset" when CI at the tip turned a second one red (both below).

## Cause

The committed preset (`frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json`, md5
`86a292c7ff450b2e3940b1374f146fd4`) had gone stale against its recipe (the README's
`dump-sphere-growth.js --quota atlas:seedling=10 …`) in two steps:

- **(A) 7379b019dc** (2026-10-10), *"an exit tile is a dead end — no target is reachable only over
  another exit"*: re-carved region_5_5's maze. Its Ghost Spear location moved from cell 2_4 to 3_4 (same
  sphere 1), and the region's `longestShortestPath` went from 19 to 15.
- **(B) a6139f91a8** (2026-10-11): the goal item `victory` became `Victory` (13 places, plus an
  `itemLib.Victory` row in region_6_7's payload).

The recipe could not re-record it, because since **264e3e0d0a** (2026-10-18) the CLI pre-check
`checkSubstrateIds` exempted `library:` source ids but not `atlas:` ones. The recipe therefore exited 1
with `'atlas:seedling' is not a registered substrate`, though the engine accepts that id
(`isAtlasSourceId`, `regionAtlasPool.js`). Before this slice the round-trip check read 68 PASS / 1 FAIL,
the FAIL being its byte-identity row.

## The fix

- `scripts/procgen/registerPipelineSubstrates.js:86`:
  `if (isLibrarySourceId(id) || isAtlasSourceId(id)) return;` (import at :37, doc comment :76).
- `scripts/procgen/cliFlags.test.js:156`: a new row. `atlas:seedling` passes on the sphere layout and
  the grid layout, and a plain unknown id beside it still refuses BY NAME. The existing refusal row is
  unchanged and green. 30/30.

## The re-record

Recipe re-run: rc 0, md5 `86a292c7ff450b2e3940b1374f146fd4` → `f576e942c6516e28eb13f50ff51e285d`. The
58-line diff (+34/-24) is exactly (A) + (B), with nothing else:
region_5_5's tile grid, its Ghost Spear cell, its `longestShortestPath`, and every `victory` → `Victory`.

`node scripts/procgen/check-atlas-sphere-roundtrip.mjs` (venv): **68 PASS / 1 FAIL before → 69 PASS /
0 FAIL after**, "ALL CHECKS PASSED".

## The readers

| Reader | Result on the re-recorded preset |
|---|---|
| vitest (default tier): `compositeMapDocument`, `procgenPipelineUI`, `seedlingSetPatches`, `seedlingReturnToMenu`, `cliFlags` | 163/163 |
| vitest (slow tier): `atlasMazeBot.slow.test.js` | 21/21 at base → **20/21** after the re-record → **22/22** with the fixture (below) |
| in-app `seedling-atlas-sphere-placed-region` (`--test`) | PASSED. Its 6 `not_accessible` log lines are identical at base. |
| `check-preset-panel-click.mjs --host=…` | ALL CHECKS PASSED (sphere: 19 regions, 8 locations, 35 exits) |
| `seedling-divergence-legs.mjs:626` | lists the preset name in `PRESETS`; pins no value from it (not run: a sweep) |

One reader DID hard-code `victory`, and this table missed it: it lists only the sphere file's
`placed-region` row, not its sibling `seedling-atlas-sphere-bot-completion` (below). A sweep of every
file naming the preset found no other hard-coded `victory` or `region_5_5__loc_1__2_4`.

## The one red, and ruling (a)

`atlasMazeBot.slow.test.js`'s positive control, *"routes AROUND a crossing that excludeOtherExits
severs"*, discovers a region whose exits join only over another crossing. In the old world its one
subject was region_5_5 exit_1↔exit_2, which is exactly the region (A) re-carved. (A) is the generator
change that makes that shape impossible ("no target is reachable only over another exit"), so no
regenerated maze will supply one again. A static probe over every other committed atlas and
`procgen_maze` preset found none either.

Per the ruling, the row moved into its own describe on an inline two-region fixture
(`severedFixtureDoc()`, `atlasMazeBot.slow.test.js:635`, describe :677). Region A is a corridor whose
west and east exits join only through its mid exit; region B is an open room paired with all three. The
row's assertions are unchanged. A whole-world `traverseEverything` stands in for the playthrough's
crossings, with one new row pinning that it leaves nothing uncrossed. The sphere describe keeps its
other 20 rows on the preset.

Measured on the fixture:

- **Found and routed:** the control finds A west→east and routes A.west → B → (B.north) → A.mid → walk
  to A.east, then crosses it.
- **It bites:** opening A's walls (no severing) turns it red with its original message, 21/22.

## The second red, and the goal-item ruling

CI at the first tip (490b5dff66) failed TT: one row, 100/101, in both the fast and the fast (bundled)
batch, while every other job passed. The row was `seedling-atlas-sphere-bot-completion`:
*"the bot is holding the victory item: expected true, got false"*. The bot drained its queue and
finished with no unreachable-target error, but `seedlingAtlasMazeTests.js` read `inventory.victory`,
and (B) renamed the item. Ruled: read the goal off the preset instead of spelling it.
`sphereWorldBotCompletion` now takes `game_info["1"].completion_condition.item` from the preset it
loaded (and fails if that is missing). Measured locally on the re-recorded preset:

- **With the fix:** the row passes (44.4 s).
- **Without it:** it fails with CI's exact message.

## Closure

- No file touched is in the js gate closure.
- engineMd5 `bec369878feb67081187edca62baa951` (42 files), unchanged at base.
- 0 gitlinks.

## Note, not fixed here

`check-atlas-sphere-roundtrip.mjs` is `@ci-box`: it needs this tree's Python venv and `Generate.py`.
No CI gate regenerates this preset, which is how it drifted a month unseen.
