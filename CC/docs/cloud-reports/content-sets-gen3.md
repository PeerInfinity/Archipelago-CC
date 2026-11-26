# Content sets GEN-3: the generator places `needs` tile kinds

Branch `content-gen3`, based on `origin/main` `5ab77cf981`. The design is GEN-D's (§ 2.2, § 2.4, § 2.5, § 4 GEN-3).
The brief is the planner's GEN-3 prompt.

⚖ Rulings in force:
- Robert, 2026-11-24: "GEN-3, needs tiles (Recommended)".
- GEN-1's rulings (Q1 to Q8), unchanged.
- Planner, 2026-11-24, on this slice's STOP (§ 6.1): take **A**. Law (d) stays strict and local, as designed. The
  `s5-swim-pool` pool becomes the "rejected by (d)" pin, and the "accepted" pin moves to a fixture pocket room.

## Commits

| # | SHA | What |
|---|---|---|
| 1/3 | `d15b1ea216` | `mazeTileKindsGen.js`: `needs` joins the passes (`TILE_KIND_PASS_LAWS`, a data table); qualify by `needsRealisationRefusal` per region; the equivalence (`equivalentRule`); law (d) (`arrivalTiles`, `strands-arrival`); the serializer's copy gets its own `obstacles` Map. The fixture pack `wet`. The unit pins (`mazeTileKindsGen.test.js`) |
| 2/3 | `f4b46ee5f5` | `procgenPipeline/needsTileKindsWorld.slow.test.js`: the world proof, with play and draw |
| 3/3 | this commit | Docs: `maze.md` § Region biomes; the regenerated README index and `docsIndex`. This report and its screenshot |

## 1. What was built

### 1.1 The qualify change

- `TILE_KIND_PASS_LAWS` is the set of passes the generator places, as data. Each row gives:
  - `lowers`: whether the law is checked at all;
  - `rules`: how law (b) compares (`byte-equal` or `equivalent`);
  - `fromArrivals`: whether law (d) applies;
  - `qualify(kind, world)`: an optional per-world refusal.

  The rows are `walkable` `{lowers: false}`, `blocked` `{bytes, no arrivals}` and `needs` `{equivalent, arrivals,
  qualify: needsRealisationRefusal}`. `GENERATED_TILE_KIND_PASSES` is its keys, so GEN-4 adds one row.
- `generatedTileKinds` now carries the terrain's own fields, so a needs kind is `{kind, pass: 'needs', needs}`.
- **Per region, not per world.** `needsRealisationRefusal` reads the world's item library, and that library is per
  region: the engine hands the goal cell a different one (`procgenPipelineEngine.js:4600`). So the region core filters
  the plan's kinds against **its own** world (`realisableTileKinds`).
  - A region that can realise none of the kinds gets a plan with no kinds and places nothing.
  - The refusal by name is unchanged: it fires only when the world's "what exists" packs offer no kind at all.

### 1.2 The equivalence (law b for `needs`)

`equivalentRule` puts a rule in a normal form using only boolean identities:
- `And` and `Or` are flattened into themselves (associativity);
- `True_` is dropped from an `And` (the unit), and an empty `And` is `True_`;
- children are de-duplicated (idempotence) and sorted by their JSON (commutativity);
- a one-child `And` or `Or` becomes its child.

So `And(Has Swim, Has Swim)` is `Has Swim`. The design names "flatten `And`, remove duplicates". Sorting is added
because the pool and the gate it duplicates can sit in either order along a path with a third gate. `blocked` keeps
byte-equality.

**The shipped rules stay the pre-placement ones.** The serializer never re-extracts: the region's `extracted_rules`
were computed before placement (GEN-D § 1.3). This is pinned on the pocket room: the payload loads back through the
ownership check, and its re-derived rules are equivalent to the plain room's.

### 1.3 Law (d)

- **`arrivalTiles(world)`** gives the cells where a player can land other than the entrance:
  - in a world that links reverse exits (any `targetExitId`): every linked exit. Its reverse lands on it, which is
    `resolveMazeArrival`'s first arm.
  - in a world that links none (the spiral): every exit with a `targetRegion`, the `source_region` arm. This is the
    conservative side: a spiral run stamped `arrival: 'zone'` later lands on the entrance instead.
  - in a room already marked `arrival: 'zone'`: none.

  The entrance is left out, because law (b) already measures it.
- **The check.** For a pass with `fromArrivals`, the baseline also compiles the room from each arrival tile (a
  shallow copy with `entrance` set to that tile). With the kind lowered, each one must still compare equal in the
  pass's form. Otherwise the refusal is `strands-arrival`.
- **Built for GEN-4 to reuse.** A `one-way` row with `fromArrivals: true` gets the same check with no new code.
- **The baseline computes only what the plan's passes need.** A walkable or blocked plan pays nothing for (d) or the
  equivalence.

### 1.4 One latent bug fixed on the way

GEN-1's serializer copy shared the world's `obstacles` Map. A needs lowering calls `setObstacle` and a lift calls
`clearObstacle`, so the placement would have written gates into the world being serialized. The copy now gets its own
Map. `lowerTileKind` already replaces `obstacleLib` copy-on-write. This is pinned: the world's obstacles are unchanged
after a placing serialize. A rejected cell is now undone with `liftTileKind`, which removes the gate as well as
restoring floor, instead of `setTile(FLOOR)`.

## 2. The pins (`mazeTileKindsGen.test.js`, GEN-3 rows)

The fixture **pocket room** (6×3) is built in the test:
- the entrance is at (0,1) on a corridor running east;
- a Swim gate at (2,1) guards the pocket (3..5,1), which ends in a location (Victory at (5,1)) and has no exit;
- the free location Progressive Sword is at (1,0), reached only through (1,1);
- a linked exit at (0,0) is an arrival tile.

| Pin | Result |
|---|---|
| `wet`'s pool (needs swim, `generate: true`) qualifies, carrying `needs`. `ground`'s pool (`generate: false`) is still out | ✅ |
| `realisableTileKinds` drops the pool from a world with no Progressive Swim in its item library. The region core records only the realisable kinds | ✅ |
| The passes set is data: `TILE_KIND_PASS_LAWS`' keys are `GENERATED_TILE_KIND_PASSES`, and the needs and blocked rows say what they compare | ✅ |
| `equivalentRule`: `And(Swim, Swim)` is `Swim`; nesting, order, duplicates and `True_` in an `And` do not count; a different requirement stays different | ✅ |
| `arrivalTiles`: `region_2_3` gives `[(0,1)]` (its other exit is on the entrance); `arrival: 'zone'` gives none; the pocket gives `[(0,0)]` | ✅ |
| ✅ **ACCEPTED:** the pool at (4,1), on the approach inside the Swim gate's pocket. It is not vacuous: the raw compile carries `And(Swim, Swim)`, so byte-equality alone would refuse it | ✅ null |
| ⛔ **REJECTED by (b):** a pool at (1,1) adds Swim to the free Sword location | ✅ `changes-rules` |
| ⛔ **REJECTED by (d), on real data:** `s5-swim-pool`, meta_trial `region_2_3` (3,2). (b) alone accepts it (an empty arrival list gives null) | ✅ `strands-arrival` |
| `placeTileKinds` + the serializer on the pocket: every pool lands on (3,1) or (4,1), never (1,1); the payload carries `{pass: 'needs', needs: 'swim'}` and the owned gate; the world's own obstacles are untouched; it loads back with its kinds and re-derives equivalent rules | ✅ |

**Mutations** (each run, then reverted):
- **(d) off** (`needs.fromArrivals: false`): 2 red. The s5 pin (it is accepted) and the data-row pin.
- **The equivalence off** (`needs.rules: bytes`): 4 red. The pocket-accepted pin, the serializer pin, the s5 pin
  (byte-equality now refuses it first, as `changes-rules`) and the data-row pin.

## 3. The world proof (`procgenPipeline/needsTileKindsWorld.slow.test.js`)

- **The world:** `CONCEPT_TRIAL_STATE` with the fixture `wet` named under "what exists", and the maze biome
  `scattered`, beside its control (the same state, no biome).
- **The logic:** `rules.json` minus `preset_sidecars` and the recorded setting keys is the control's, string for
  string, and so are the run's `stats`. The sphere log and the spoiler are written from `rules.json`, so they are
  unchanged by construction (GEN-D § 2.5).
- **Each maze room** equals the control's payload once its pools and their owned gates are taken out. Each pool is
  `{kind: 'wet:terrain/pool', pass: 'needs', needs: 'swim'}`, and its gate's rule is `Has(Progressive Swim)`. Each
  room loads back with its kinds through the registry. Re-derived from the entrance and from every arrival tile, its
  rules are equivalent to the control's.
- **Placed:** 2 pools, both in `region_1_3`, at (1,5) and (4,5). `region_2_3` gets none: (d) refuses every cell there
  (§ 6.1).
- **Play and draw** (PASS-2's existing paths), for each placed pool:
  - `step` from a floor neighbour is `null` without Progressive Swim, and lands on the pool with it;
  - `whyBlocked` names the gate or the item;
  - the autopather's `findPath` gives `null` without Swim and a path with it;
  - the panel's `drawWorld` + `drawMazeTileKinds` reports the kind `as: 'base'` and paints its marker base, and so
    does the composite cell.

## 4. The screenshot

`CC/docs/cloud-reports/content-sets-gen3-shots/pool-beside-swim-gate-lab.png`:
- it is `lab.html` with the pocket room loaded through the page's own LOAD box;
- the pool was placed by `tileKindsSerializer` from a plan (`seedKey` 3, cap 1, the first key whose pool lands on
  (3,1)), so it sits right beside the Swim gate;
- both cells are outlined as gated.

No pack in the lab's stack declares `wet:terrain/pool`, so the pool draws as TILE-1's placeholder (the magenta tile
labelled "we"). That is the designed fallback ("a draw never throws"). The script ran under the box lock and is not
committed.

## 5. Gates (local)

All runs are on the slice's tree, before the merge.

| Instrument | Result |
|---|---|
| `--print-engine-closure` | `74ae60f575531492ed9eaec1839e1fe3`, 42 files, unchanged; closure ∩ diff = ∅ |
| `refresh-seedling-derived-rules.mjs --check` | fresh and on count |
| `ci-producer-checks.mjs --jobs=4` | 99 run, 0 red, 1 skipped (its named exclusion) |
| `check-sidecar-fields` | ALL PASS: 2,424 entries, 0 issues; rule agreement 0 FAIL |
| `generate-procgen-reference --check` | ALL MATCH, after regenerating the README index and `docsIndex` (word counts) |
| `check-procgen-docs`, `check-maze-lab` (browser, box lock, each with its own server on this tree) | ALL CHECKS PASSED / ALL CHECKS PASSED |
| Bounded vitest: `mazeRoom/mazeTile*`, `mazeRegionBiomes`, `mazeRoomLibrary`, `procgenPipeline`, `packStructure`, `packConcepts`, `contentPacks`, `procgenDocs` (the doc-link pins included) | 85 files, 2,276 passed |
| Slow tier: `scatteredBiomeWorld.slow.test.js` (GEN-1), `needsTileKindsWorld.slow.test.js` | 9 passed |
| Committed presets moved | **none** |
| Gitlinks changed | 0 |

No markdown link was added, so the doc-link census does not move.

### 5.1 CI at the code tip `0e19b35234` (all success)

| Run | Id | Result |
|---|---|---|
| `unittests` (push) | 45445189141 | success |
| JSUT (push) | 45445188701 | success; suite 30,061 passed / 0 failed; slow battery 447 passed |
| TT (dispatch) | 45445280898 | success; HEADROOM OK on every batch: fast 57%, fast bundled 56%, seedling-js 48%, seedling-wasm 40%, apworld 36%, seedling-js-solver 34%, playback-bot 21% |
| feature-checks (manual batch) | 45445288026 | success |
| `train_only` (dispatch) | 45445292160 | success, 3/3 train shards |

### 5.2 The merge of main (`7bdde43ea9`, main `73c96473f5`: GEN-2 in train 208, LAB-BIOME + AN-OMSI-1 in 209)

- Merged ONCE. The only conflicts were the generated `procgen/README.md` and `docsIndex.js`. Both were resolved by
  regenerating; `generate-procgen-reference --check` gives ALL MATCH.
- **One pin moved, a merge interaction:** GEN-2's `mazeFurniturePack.test.js` required the furniture pack's passes to
  equal *every* generated pass. GEN-3 added `needs`, and the furniture pack has no `needs` kind (adding one is out of
  scope). The pin now names the two halves the demo shows, `walkable` and `blocked`. Its per-entry check ("each pass
  is one the generator places") is unchanged.
- **`tile_kinds_demo` is unmoved:**
  - `make-seedling-spiral-room-preset.mjs --state=tile-kinds-demo --check` gives OK (a fresh build matches);
  - md5 `99b1c64f6ca07712533155b438619edc`, GEN-2's own figure;
  - `tileKindsDemoWorld.test.js` (the byte pin) passes.
- **LAB-BIOME's census pin** `mazeConvertedLoad.test.js` passes.
- **The rest, after the merge:**
  - the closure is still `74ae60f5…` (42 files), and closure ∩ diff = ∅ (the diff against main is 11 files + this pin);
  - no preset differs from main, and 0 gitlinks changed;
  - the bounded vitest (`mazeRoom` without `tileSpike`, `procgenPipeline`, `packStructure`, `procgenDocs`): 157
    files, 4,288 tests, the one red above fixed and re-run green;
  - the slow tier: 9 passed;
  - `check-sidecar-fields`: ALL PASS (2,433 entries, 0 issues; rule agreement 0 FAIL);
  - `check-procgen-docs` and `check-maze-lab`: ALL CHECKS PASSED.
- CI at the final tip: in the report back.

## 6. What the code overturned

1. **§ 2.4(5) and § 4 GEN-3's proof: "the pool beside the Swim gate (`s5`) is accepted" is wrong against the data.**
   - Why: in `region_2_3` the Swim gate `water_gate_0` stands **on** exit `exit` (0,1), which is linked
     (`targetExitId`; `region_1_3`'s exit back is `True_`). So (0,1) is an arrival tile.
   - Extracted from there, before the pool, the Swim pickup and exit `region_2_2` are both `True_`. With the pool at
     (3,2), both become `Has(Progressive Swim)`.
   - Every floor cell of that room is on the arrival's only corridor, so no pool fits there under (d).
   - Locally this is a real strand. Globally `region_1_3` is a leaf reached only through that gate, but a local law
     cannot see that.
   - ⚖ The planner ruled A (keep (d) strict and local; GEN-4 inherits it). The pins moved as § 2 shows.
2. **The yield of `needs` in today's worlds is small.** Measured over the 4 committed maze rooms whose item library
   holds Progressive Swim (`concept_trial` and `meta_trial`, `region_2_3` and `region_1_3` each):
   - 102 free cells, of which 102 pass (b) and 92 pass (b)+(d);
   - every one of the 92 is in a leaf `region_1_3`, on floor that no target's path crosses.

   So the generator will rarely put a pool beside a gate in today's worlds. That is a product fact, not a defect.
3. **The item library is per region** (the goal cell's differs), so the qualify check runs per region (§ 1.1), not
   once per world.
4. **GEN-1's serializer copy shared `obstacles`** (§ 1.4). It was latent while kinds only wrote tiles.

## 7. Next slice's line

GEN-4, `one-way`: add the `one-way` row to `TILE_KIND_PASS_LAWS` (`fromArrivals: true`, and `rules` as GEN-D says:
byte-equal). Law (d) and `arrivalTiles` are already in place. A demo preset that shows a pool needs a world whose Swim
gate guards a pocket with no exit (none of today's committed worlds has one); that would be its own slice.
