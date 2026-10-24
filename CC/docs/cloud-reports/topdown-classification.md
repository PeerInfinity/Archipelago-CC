# topdown-classification — cloud report (2026-10-01)

**Branch:** `claude/topdown-classification-fix-u2buh5` (the harness's designated branch), cut from `origin/main` at
`8ded9c53fb` (includes the starting-items pool fix). Work commits:

| commit | what |
|---|---|
| `8b5920f1` | (a) fix: source classification + placed-item fields carried verbatim, plus a unit test |
| `4e7a7513` | (a) re-record procgen_topdown AP_1–12 |
| `40a77617` | (b) fix: a derived placement is advancement for every progression flavour, plus a unit test |
| `26a5236a` | (b) re-record omsi_randomized_test and omsi_scaled_test |

The report is the last commit. **No `shared` change was needed:** the lost step for (b) is in the outer repo. Nothing
was left for the user to decide (§4).

## 1. (a) Classification lost in the top-down compile

**Measured first.** I compared each committed `procgen_topdown` preset against its source:

| preset | item defs whose `classification` differs | placements whose `advancement/type` differs |
|---|---|---|
| AP_1–3, AP_10–12 (adventure) | 7 each (`Freeincarnate`, `Slow *`, `Left Difficulty Switch` filler→progression; `Yellow Key`, `Chalice` progression_skip_balancing→progression) | 24 |
| AP_4–6 (apcalc) | 1 each (`Junk` filler→progression) | 80, 73, 77 |
| AP_7–9 (alttp) | 36 each (`Bombs (3)`, `Rupees (*)`, `Arrows (10)`, `Piece of Heart` useful→progression, maps and compasses, …) | 249 |

**The lost step** was `frontend/modules/procgenPipeline/procgenPipelineEngine.js` `compileRegionGraph` → `compileLocation`
(and `compileEventLocation`):
- It minted each item as `itemLib[item]?.classification ?? 'progression'`. The top-down callers pass no `itemLib`, so
  every source item became `progression`.
- It derived each placement as `{advancement: classification === 'progression', type: classification}`.

Both `sourceItems` (the source defs) and `sourceLocations` (the source's own placements) were already passed in.
A check showed every compiled location keeps its source location's name and item: 25/25, 161/161 and 268/268 on AP_1,
AP_4, AP_9 and AP_10.

**The fix:**
- `itemClassification` (`procgenPipelineEngine.js:2799`): an item the source defines takes the source def's
  `classification` verbatim. A synthetic library item keeps the library's classification, else `progression`, as before.
  Both `compileLocation` and `compileEventLocation` use it.
- `compileLocation` (`:2777–2783`): when the source places the same item at the same location, the placement takes the
  source's `advancement` and `type` verbatim. That is AP's own `Item.advancement` and the game's item type, e.g.
  `"None"` or ALTTP's `SmallKey`. Otherwise the placement is derived as before. With the classification now verbatim,
  that derivation also matches AP for any source item.

After the fix, all 12 presets have 0 classification diffs and 0 placement diffs against their source, compared per
location. On AP_7–9 that includes ALTTP's per-instance `Boss Heart Container` (`progression` def, `advancement: false`
placements).

**Presets changed (re-recorded with the recorded producer, `generated_commands.sh` procgen_topdown block):**
- All 12 changed. `preset_files.json` was rewritten byte-identical.
- A scratch regeneration is `cmp`-identical to the in-place one.
- Keys moved:
  - `regions`: the placement fields.
  - `items`: the classification.
  - `sphere_log`: AP_1–6 and AP_10–12 only.
- Filler items are no longer collected as advancement, so **each compiled sphere log's entry count now equals the
  source world's own sphere log**. Every location is still reached, and the sphere counts are unchanged.

| preset | sphere_log entries before → after | source log lines |
|---|---|---|
| AP_1–3, 10–12 | 27 → 11 | 11 |
| AP_4 / 5 / 6 | 163 / 149 / 157 → 104 / 97 / 101 | 104 / 97 / 101 |

AP_7–9 move only `regions` and `items`. They still carry no sphere log, per the ruling, and are no worse.

**Other drivers do not move.** With (a) and (b) both in place, these regenerate byte-identical:
- `make-seedling-spiral-room-preset.mjs --check` for all 9 states, all `OK`
- `generate-jta-locations-test-preset.mjs` (5 presets)
- procgen_maze AP_1–3
- omsi region_split, schedule and substrate

**Derived rosters:** `rg -a procgen_topdown` outside `frontend/presets` finds about 30 readers. Every vitest file among
them is in the bounded run (§5). The in-app spoiler runs are in §3.

## 2. (b) The omsi `isAdvancement` gap

- **AP's rule:** `BaseClasses.Item.advancement` is `ItemClassification.progression in self.classification`, and
  `progression_skip_balancing = 0b01001`, so it **is** advancement. The exporter writes exactly that `advancement` on
  placements (`exporter/exporter.py:2074`).
- **Where `advancement: false` came from:** neither the exporter nor a hand-written file. In the omsi presets every
  Supply Step placement had `type: 'progression_skip_balancing'` and `advancement: false`, which is exactly what
  `compileLocation`'s derived branch produces from `itemLib` classification `progression_skip_balancing`
  (`omsiSubstrateWrapperLibrary.js:423`).
- **The lost step:** `procgenPipelineEngine.js` `compileLocation`, the `classification === 'progression'` comparison.
  `forwardSimulator.js:247` `isAdvancement` reads `advancement` correctly and was not changed, so **no `shared` commit
  was needed**.
- **The fix:** `isProgressionClassification` (`procgenPipelineEngine.js:2809`, used at `:2783`). It returns true for
  any `progression*` flag, including a combined `progression|useful`. The exporter's string forms all begin with
  `progression` (`handler.py:1186`).
- **Other presets:** a sweep of every committed preset for `advancement: false` on a `progression*`-classified item finds
  34 files. 31 are AP's own exports (per-instance classification), plus procgen_topdown AP_7–9, which now carry ALTTP's
  per-instance placements verbatim. Only the two omsi presets came from the compile.

**Presets changed (regenerated by their writers; a `--out-dir` scratch run is `cmp`-identical):**
- `omsi_randomized_test`:
  - `regions`: 90 Supply Steps now have `advancement` true.
  - `sphere_log`: reaches **91/91** locations, was 1 (entries 2→93, 90 spheres).
  - `loop_costs`: `stampLoopCosts` computes it from the embedded sphere log, so the two maze regions are now priced
    16 and 21 instead of falling to the unreached default 50.
- `omsi_scaled_test`: the same shape, with 18 Supply Steps; reaches **19/19**, was 1 (entries 2→21).

⚠ The cloud checkout had not initialized the `frontend/modules/omsi-loops` submodule, and the omsi writers need its
`data/unlockTable.json`. I initialized it at its pinned commit (`a636e9a`, unchanged).

## 3. Spoiler tests (`npm test -- --port=8150 --mode=test-spoilers --game=<dir> --seed=N`)

"Before" means the presets at `8ded9c53`, checked out temporarily and restored afterwards.

| preset | before | after |
|---|---|---|
| procgen_topdown AP_1, 2, 3, 10, 11, 12 | 26/26 PASS each | **10/10 PASS** each |
| procgen_topdown AP_4 / 5 / 6 | 162/162, 148/148, 156/156 PASS | **103/103, 96/96, 100/100 PASS** |
| procgen_topdown AP_7 / 8 / 9 | FAIL: `AP_7_sphere_log.jsonl: 404` (no log, by ruling) | the same FAIL, unchanged |
| omsi_randomized_test | 1/1 PASS | **92/92 PASS** |
| omsi_scaled_test | 1/1 PASS | **20/20 PASS** |

Every passing run logs 1 console error, both before and after, so that error is baseline.

In-app `test-substrates --test=omsi-unlock-*` (the 7 rows that load the two omsi presets): **7/7 PASS**. The "STUCK"
warnings in that log are the tests' designed `settle window (expected timeout)` polls.

## 4. Generation round trip (AP_1–6, AP_10–12)

**Method:**
- `world_generator` into a scratch world, with `--canonical-seed 1`.
- The world was copied into `worlds/` only for the run and removed afterwards.
- `Generate.py --player_files_path <scratch> --outputpath <scratch>`, with `< /dev/null`.
- After each run, the exported preset was moved to scratch and `preset_files.json` reverted. The tree was checked clean.

**Seeds 2 and 3:** all 18 runs gave `Done. Enjoy.`, with real Fill:
- `Filling the multiworld with 24 items` on AP_1–3 and AP_10–12.
- 80, 73 and 77 items on AP_4, 5 and 6.

**Fixed-point check:** the exporter's re-exported `items[*].classification` equals the compiled one in all 18 runs
(**0 diffs, 0 missing**). Seed 1 on AP_1 and AP_4 is also 0 diffs, including placement `advancement`.

**One thing noted, not changed.** At seeds 2 and 3 the re-exported placement `advancement` differs per item name, for
example `Freeincarnate`. Measured by location, it equals the compiled location's canonical value: 25/25 on AP_1 and
161/161 on AP_4. The cause is the exporter's `canonical_placement_advancements` override (`exporter/exporter.py:2075`).
It stamps the canonical location's `advancement` onto whatever item Fill put there. This is pre-existing, applies to
every worldgen world at seeds other than 1, and is outside this slice. It is a candidate follow-up: arguably the
exporter loses the item's own `advancement` there.

I made no design choice beyond the brief. The `advancement` written is the source's own value, verbatim. Where there is
no source placement, it is AP's own rule applied to the verbatim classification. These two agree on every non-ALTTP
source, and on ALTTP the verbatim per-instance value wins.

## 5. Mutants, vitest

**Mutants:**
- **(a):** with the base engine restored, the 12 recorded commands regenerate the **old committed AP_1–12
  byte-for-byte**, and the new unit test fails (1 failed / 213).
- **(b):** with the `=== 'progression'` comparison restored, the regenerated `omsi_randomized_test` is **byte-identical
  to the old committed file**, and the new unit test fails (1 failed / 214).
- The engine was restored from the fixed copy after each mutant.

**Bounded vitest** (no unfiltered run, per ruling 52):
- 40 files, **1082/1082**. The set is:
  - every `*.test.js` mentioning `procgen_topdown`, `compileRegionGraph(`, `buildRulesJson(`, `sourceLocationsOf`,
    `topDownFromRulesJson`, `generate-topdown`, `skip_balancing`, `omsi_randomized`, `omsi_scaled` or `advancement`;
  - all of `omsiSubstrateWrapper/*.test.js`;
  - `procgenPipeline/topDown*.test.js`.
- `procgenPipelineEngine.test.js` alone: 215/215, with 2 new tests (`:2140`, `:2167`).
- Slow tier (`vitest.slow.config.js`), 6 files, **94/94**: `sphereGrowth`, `topDownBounce`, `braidSphereBot`,
  `sphereAtlas`, `sphereBatched`, `sphereLibrary`.
- `node scripts/procgen/check-topdown-steps.mjs`: ALL PASS.
- No existing pin encoded the old classification, so no test was changed by design.

**Not run:**
- `test-substrates --batch=apworld`: the hub's item writer was not touched.
- `pytest`: no Python was touched.
- A Generate.py round trip of the two omsi presets: not in the brief's round-trip list.
