# Cloud report: `rules-no-hit-directional`

Branch `claude/rules-no-hit-directional-gates-422nho`. Started from `f5d5485696ddf0a963dc6321ad47753adbfe9885`,
merged `origin/main` = `b133de7af0cf3aaedee98735c8d5f8ec98f779e3` (no conflict) as `fee0683844`.

**The two gates are in, as data, and everything except the derived-rule table is regenerated and committed.**
The rules, maze and ER producers refuse on the committed table until it is re-recorded on CI (10 rows, listed
below). No stop of the brief fired.

| commit | what |
|---|---|
| `53fde526b4` | the table, its reader and test, the producer wiring, the ER door census's measure of the new reader, the doc note |
| `fbd16bd1a2` | the probe's `--chest` mode and its unit rows (item 5) |
| `800c9bde30` | regeneration through the producers |
| `c35bc65029` | the pins the split moves |

## What Robert / the planner has to do

1. **Re-record the derived-rule table on CI** by `REGEN_RECIPE`. These 10 rows block (each names a region or
   exit the compiled document no longer holds; all 10 are `True_`):

   | row key | atlas endpoint |
   |---|---|
   | `level_21\|level_21 -> level_22` | `level_21/out_teleporter_80_160` |
   | `level_22\|level_22 -> level_21` | `level_22/out_teleporter_96_0` |
   | `level_22\|level_22 -> level_25` | `level_22/out_teleporter_0_128` |
   | `level_22\|level_22 -> level_29__r2c2` | `level_22/out_teleporter_192_64` |
   | `level_22\|level_22 -> level_30__r0c4` | `level_22/out_teleporter_96_192` |
   | `level_25\|@Level 025 - Chest` | `level_25` / `Level 025 - Chest` |
   | `level_25\|level_25 -> level_22` | `level_25/out_teleporter_144_32` |
   | `level_25\|level_25 -> level_26__r2c4` | `level_25/out_teleporter_0_96` |
   | `level_25\|level_25 -> level_28__r0c6` | `level_25/out_teleporter_96_128` |
   | `level_28__r0c6\|level_28__r0c6 -> level_25` | `level_28/out_teleporter_96_0` |

   The table's two L27 rows do not block: L27 is not split. The first refusal the producers print is
   `derived-rule table: level_21|level_21 -> level_22 names no element of the compiled document`.
2. **Expect the table to lose rows, which is a verdict move** (the recipe says that owes a designer review). A local
   `probe-seedling-derived-rules.mjs --levels=level_22,level_25` (scratch output, nothing committed) gave: 6 rows,
   all `agrees`, all `compare: equal`, `overridable: false` (class `walk-in from another member`), `TABLE: 0 rows`.
   The maze-derived rule for `level_22__r8c0 → level_22__r0c6` is `Or(Ghost Spear, Progressive Shield, Progressive
   Sword)`, equal to the composed one, so the maze derivation agrees with the gate. I did not run the whole-game
   derivation; `seedling-derived-rules-expected.json` will need its counts re-recorded with the table.
3. **The re-examination note** stands in three places: the table's `$comment` and `reexamine` fields, the reader's
   header, and `docs/json/developer/procgen/maze.md`.
4. **L25's chest** (item 5, below) is a real finding about a `True` rule. Nothing was changed for it.

## The table and the rule

`frontend/modules/flashPanel/seedlingNoHitDirectionalGates.json`, read by
`frontend/modules/flashPanel/seedlingNoHitDirectionalGates.js`. Both open with the ruling, verbatim, say it is a
per-room table for now and to be re-examined, and name the general rule the previous slice suggested (a band is
passable where the room offers a waiting spot off the ray at the far end of every flight).

| level | band (flyers; the tiles come from `wallFlyerBands`) | blocked | arms | NOT FOUND witnesses | arm witnesses | free-direction witnesses |
|---|---|---|---|---|---|---|
| 22 | `wallflyer@48,112`, `wallflyer@144,112` (row 7, columns 3 to 9) | `N` (south to north) | `hasSword`, `hasSpear`, `hasShield` | `l22-25-29-none`, `l22-25-21-none`, `l22-30-21-none`, `l22-30-29-none` | `l22-25-29-sword`, `-spear`, `-shield` | `l22-21-25-none`, `l22-21-30-none`, `l22-29-25-none`, `l22-29-30-none` |
| 25 | `wallflyer@48,48`, `wallflyer@64,48` (columns 3 and 4, rows 3 to 5) | `E` (west to east) | the same | `l25-26-22-none` | `l25-26-22-sword`, `-spear`, `-shield` | `l25-22-26-none`, `l25-28-26-none` |

The reader refuses, by name:
- a witness id missing from the plans file (each `notFound` id under `notFound`, each arm and free id under `plans`);
- a witness of another level, of the wrong arm (`none` for a control, the arm's own item for an arm), or one that does
  not cross the band the way the gate says (its landing tile and target door tile are read from the map);
- a flyer the level does not hold, a direction that does not cross the flyers' flight, an arm with no witness, a
  witness for an arm the gate does not offer, a row for a level the set lacks.

The producer (`playthroughNoHitGatesFor`, in `rawBaseGridFor`) stamps each band tile that is open floor with
`dirs[blocked] = anyOf(arms)`, the analyzer's gate on moving that way on the tile (the waterfall's kind). A band tile
that is a door, or is not open floor, is refused. Only L22's lower band is named; its upper band (row 5) does not
separate the room and is not charged.

What AP_1 became (every other element of the two rooms and every door into them is `True`, as before):

| room | sub-regions | priced crossing | rule |
|---|---|---|---|
| L22 | `level_22__r0c6` (L21 and L29 doors), `level_22__r8c0` (L25 and L30 doors) | `r8c0 -> r0c6` | `Or(Progressive Sword, Ghost Spear, Progressive Shield)` |
| L25 | `level_25__r2c7` (L22 and L28 doors, the chest), `level_25__r3c2` (L26 door) | `r3c2 -> r2c7` | the same |
| L27 | `level_27`, one region | none | unchanged |

`r0c6 -> r8c0` and `r2c7 -> r3c2` are `True`. No gate beyond the two witnessed directions exists; a unit row holds the
table's `notFound` witnesses equal to the plans file's no-item NOT FOUND rows, and L27 ungated.

One reading note: the Dark Shield is `Progressive Shield ×2`, so it is covered by the `Progressive Shield` arm.

## Regeneration

Done with the 10 blocking rows taken out of a scratch copy of the table, which was put back before every commit. All
10 rows are `True_` and the composed rules on the renamed elements are `True_`, so the committed files are what the
producers write once the table is re-keyed (guard 2 would refuse any other table).

| step | result |
|---|---|
| `make-seedling-playthrough-rules.mjs` | atlas `seedling-b06ae22d` → `seedling-296d76b0` (file md5 `29a294f1c81c27dcae64176b6fb37699`); AP_1 md5 `0ce672299756a8e11c2d112dd41cc80b`; `composed ≠ table: 0` |
| `make-seedling-subregion-partition.mjs` | 56 regions with sub-regions, each checked against its atlas |
| world package, by its recipe | `check-worldgen-package-freshness.py seedling_playthrough`: `PASS … byte for byte` |
| seed 1 (`minimal-spoilers`) | `.archipelago` md5 `dc93f582790beb79c3c7e118518c0044` |
| `make-seedling-playthrough-maze.mjs` | written; `--check` OK on the scratch table |
| `make-seedling-er-preset.mjs` | seed 1, 50 placements, 48 exits moved, draws 1, 0 unbeatable, 89 sphere states; `--check` OK on the scratch table |
| surveys through 4.2 | route-only 29/29 steps SOLVE; full 39/39 steps SOLVE |
| `census-seedling-campaign.mjs --write-frontier` | only the `sources` AP_1 md5 moves; `--check-frontier` 17 pass, 0 fail |
| atlas index, `entrance-step.js` usage line | the atlas id |

**Seed-1 sphere diff.** 90 entries before and after. One entry differs, sphere 2.3, and only in
`new_accessible_regions`: `level_22`, `level_25` → `level_22__r0c6`, `level_22__r8c0`, `level_25__r2c7`,
`level_25__r3c2`. No location, item or event moved sphere. The seed is beatable (the ER build and the maze's sphere
log both complete).

**`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`.** 264 regions, 89 spheres, 921 legs (841
door legs and 80 link legs). No real location is newly unreachable: the only `UNREACHABLE-AS-LEG` rows are
`level_84__r0c0` and `level_84__r3c0`, pockets the route never enters, as before. In the two rooms: the chest's legs
have `blocks 1`, `r8c0`'s L25 door `blocks 3`, every other leg `blocks 0`.

## Pins re-recorded

- atlas id and md5: `levelSetExporter.test.js`, `vanillaOverlay.test.js`, `seedlingAtlasDoorCensus.test.js`.
- counts: `seedlingAtlasArm.test.js` 262 → 264 regions; the atlas door census 54 / 201 / 305 → 56 / 205 / 309
  (regions with a subgraph, sub-regions, internal exits); `levelSetExporter.test.js` the same.
- `fixtures/divergence-door-leg-keys.json` by its own recipe, 854 → 841 keys. Moved keys: L22's 16 one-region door
  legs became 8 within-side legs (`level_22__r0c6` from the L21 and L29 arrivals to their two doors, `level_22__r8c0`
  from the L25 and L30 arrivals to theirs); L25's 12 became 7 (`level_25__r2c7` from the L22 and L28 arrivals to the
  two doors and the chest, `level_25__r3c2` from the L26 arrival to its door). The cross-side pairs are link legs now.
- `seedlingDivergenceLegs.test.js`: the goal-event leg ids shift with them (−13 from id 284 on); no leg gained or lost
  a goal event.
- `seedlingPlaythroughLogicalLinks.test.js`: a ruleless internal row was legitimate in three shapes; the free
  direction of a directional no-hit gate is the fourth, read off the table.
- `census-seedling-er-doorways.mjs`: the new reader gets its own domain (the gated rooms' links and landings: 14
  rows, 0 stairs), so the stairs-exposed list is unchanged. The ER door census test passes unchanged.

## Item 5: L25's chest, on the game

`probe-seedling-wallflyer-nohit.mjs --chest` (new mode; keys from a waypoint walk on the model, the wasm game
judges). All 9 checks pass.

| case | what the player does | the game |
|---|---|---|
| `l25-22-chest-east` | from L22's door, walks to the tile east of the chest, holds left + down 45 ticks | stops at (114.4, 108.7); never in the chest's cell or under it; 0 hits |
| `l25-22-chest-above` | from L22's door, walks to the tile above the chest, holds down 35 ticks | stops at (101.3, 92.7); never in the chest's cell or under it; 0 hits |
| `l25-28-chest-below` | from L28's door (which lands under the chest), waits 70 ticks, holds up | walks up through the chest's cell (13 observations inside it): it opened |

So the previous report's note holds on the game. The chest at tile (6,6) fills the mouth of the corridor to L28's
door (column 6, rows 7 and 8; (7,7) is a wall). `Chest.as:63` opens it only from the line under its bottom edge,
which is reached only from L28's door. Until it has been opened, a player who came in by L22's or L26's door:

- cannot open the chest (`Level 025 - Chest` is `True` from `level_25__r2c7`);
- cannot reach L28's door (`level_25__r2c7 -> level_28__r0c6` is `True`).

The chest goes for good once opened (its persistence tag), and every chest is removed once all seal parts are held
(`checkBySeal`). I did not test those two states and did not change any rule.

## Gates

Box: 4 CPUs, cloud container. Dev server `scripts/serve-nocache.py 8000`.

- **The witness probe, full run**: 20 plans, 60 checks, `ALL CHECKS PASSED`.
- **The probe, `--chest`**: 3 cases, 9 checks, `ALL CHECKS PASSED`.
- **Bounded vitest, 152 files** (every non-slow test that reads the atlas, AP_1, seed 1, the maze, `seedling_er`,
  the partition, the derived table, the frontier or the leg keys, by a guarded `rg -a -l` list, plus the named
  files: the wallflyer bands, the probe's test, the ER door census, both obstacle-event tests, `boxLock`, the
  no-tracked-pointers guard, `checkProcgenHelp`, `lintGateLabels`, the constants census test, and the new
  `seedlingNoHitDirectionalGates.test.js`), 2658 tests:
  - **on the scratch table**: 2 tests red, both the table's freshness, red by design:
    `derivedRuleTableFresh.test.js` (payloadMd5 `5d1691de…` → `fc39b99a…`) and `seedlingAtlasDerivation.test.js`'s
    E5 row (it runs the rules `--check`). The last run of the whole list had one more red, the ER door census; I
    fixed it and re-ran that file alone (9 pass).
  - **on the committed table (the branch as pushed)**: 6 files red, all on the same refusal
    (`level_21|level_21 -> level_22 names no element of the compiled document`) or the staleness:
    `derivedRuleTableFresh.test.js`, `seedlingAtlasDerivation.test.js` (E5), `mazeInputOutputSplit.test.js`,
    `seedlingErMode.test.js`, `seedlingErSource.test.js` (the file fails to load),
    `regionAtlasLevelWorld.test.js` (the maze `--check` row). 2623 tests pass.
- **`census-seedling-constants.mjs --write`**: 0 file change; its test passes.
- **`generate-procgen-reference.mjs`** then `--check`: `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE`.
- **`check-procgen-help.mjs --only=probe-seedling-wallflyer-nohit.mjs`**: `ALL PASS`.
- **Producer `--check`s**, `ci-producer-checks.mjs --jobs=3` on the scratch table: `98 run | 0 red | 1 skipped`.
  Run directly on the scratch table: the rules `--check` refuses only on the stale table (the payload md5 above);
  the maze, ER and partition `--check`s are OK. On the committed table: the rules, maze and ER `--check`s refuse on
  the first blocking row; the partition `--check` is OK.
- **Generate dirt**: `frontend/presets/preset_files.json` reverted (a trailing-newline change only).
- No submodule pointer moved. Nothing under `worlds/seedling/`, `vendor/seedling` or `.github/` was touched.

**Not run:**
- the slow, train and calib tiers. Three of their files read the atlas or the maze
  (`deriveLevelWorldLogic.slow/.train/.calib.test.js`); the slow one did not finish inside a 110 s box here.
- the whole-game derived-rules probe (the planner's CI step), `npm test` browser batches, the unfiltered vitest.
- the bootstrap printed `pip headless: FAILED`; it reached `READY` and nothing I ran needed it.

## Notes

- Intermediate commits are not green one by one: the reader's test reads the regenerated AP_1 of the third commit.
- The probe's `--chest` cases take a hit from L25's Bob if the player stands still long (the `below` case: 1 hit at
  tick 146, after the chest opened). Hits are printed there, not checked; it is not a no-hit question.
- `doorOf` in the producer reads link entities directly (`LINK_TAGS`, `attrs.to`, `attrs.playerx`). The ER census
  scans by reader function name and found this function through its `buildLevelWorld` call; the domain I gave it
  covers both reads.
