# `jta-prestige-pool`: `jta_prestige_test`'s pool is now a round-trip fixed point

Cloud build slice, 2026-10-01/02. Base `origin/main` @ `267f561776`. Branch **`claude/fix-jta-prestige-pool-roundtrip-jujp05`**
(the harness's designated branch; the brief's `jta-prestige-pool` name was not used). Commits: `15fa5ff6` (generator +
preset), `c17147e8` (reader), then this report.

## 1. The lost step and the fix

**Where the information was lost.** `scripts/test/generate-jta-locations-test-preset.mjs` set
`rules.starting_items` *after* `engine.buildRulesJson`. It also registered the item def by hand. The compile's one
starting-item path (`procgenPipelineEngine.js:7169–7175`) therefore never saw the starting perk. That path keeps the
item in `starting_items` **and pools it**, because the exporter's `itempool_counts` is precollected + placed. The
preset's pool was missing the copy, and the round trip re-exported it.

**The fix (the brief's preferred option).** The starting perk now goes **into** `buildRulesJson` as `startingItems`
(`generate-jta-locations-test-preset.mjs:188`), with a `sourceItems` def for it. The hand registration block is
deleted.
- **Why this option:** `buildRulesJson` already supports it cleanly. `startingItems` plus `sourceItems` is exactly how
  `sphereSteps.js:480–488` and `topDownSteps.js:125–133` feed starting items that are placed nowhere. With one path,
  keep, pool and backfill cannot drift apart again.
- **The def** keeps the old fields (`classification` from the item lib, `groups: ['Everything']`). Its id follows the
  existing convention for items placed nowhere: `999 − i` (ids from 999 downward stay clear of the compiled pool's
  upward numbering). The old hand-made id was `max+1 = 5`.

**What moved.** Only `frontend/presets/jta_prestige_test/AP_14089154938208861744/AP_14089154938208861744_rules.json`:
- `itempool_counts['1']` gains `"Energetic Memory": 1`.
- The `Energetic Memory` id changes from 5 to 999.
- The embedded sphere log's sphere 0 `new_inventory_details` now holds `Energetic Memory: 1` (in both `base_items` and
  `resolved_items`). This is a second piece of information the old post-compile patch lost: the compile's sphere log is
  seeded with its starting items, which matches the exporter's precollected sphere 0.

**The other four presets** (`jta_locations_test`, `jta_randomized_test`, `jta_dataset_test`, `jta_schedule_test`)
regenerated **byte-identical** (`git status` clean for them, and a `--out` regeneration `cmp`s equal to the committed
copy for all five). Only the generator's `jta_prestige_test` carries `startInventory`, so it is the only one of its 5
outputs with starting items.

**Other writers of `starting_items`** (`rg -a` over `scripts` and `frontend/modules`, `*.js`/`*.mjs`): none sets it
after `buildRulesJson` except this generator.
- `check-regenerate-region-control.mjs:289` mutates an in-memory copy and writes nothing.
- `apworldEditor/rulesDocOps.js` contains editor ops.
- `rulesJsonBuilder.js` and `apcalcGeneratorEngine.js` are their own builders, not `buildRulesJson`.
- Candidate follow-up, not fixed: `apcalcGeneratorEngine.js:995–1037` writes `itempool_counts` without the starting
  buttons, which is the same contract gap. It is the in-browser APCalc generator, with no committed presets and no
  `buildRulesJson`, so it falls outside this brief.

## 2. Second fix, which the re-record forced: `unplacedPoolItems` (the contract reader)

After the re-record, `apworldEditor/regionContent.test.js` went red on 2 rows: `the cascade … jta_prestige_test
region_0_0 / region_1_0 → free zone 2`.
- The failing assertion was `unplacedPoolItems(doc) === []`, which got `[{item:'Energetic Memory', pool:1, placed:0,
  unplaced:1}]`.
- This is the reader bug the `topdown-apcalc-fill` report §6 flagged. `unplacedPoolItems` ignored `starting_items`, so
  under the exporter's contract every starting item counted as "placed nowhere".
- Fix, at `regionContent.js:866`: unplaced = pool − starting copies − placements, where positive. The return shape is
  unchanged, and `pool` stays the raw count.
- The test's cascade invariant now reads pool = starting + placed + non-filler unplaced.
- A new unit row pins the subtraction (`A` 3 pooled, 1 starting, 1 placed ⇒ 1 unplaced; a starting-only `S` ⇒ absent;
  `T` 2 pooled, 1 starting ⇒ 1).
- Side effect: the Placements tab stops listing exporter-sourced starting items (for example, the apcalc sources' and
  procgen_topdown AP_4–6's starting buttons) as unplaced.

I treated this as settled by the brief's contract rather than as a design choice. Flag it if you disagree (§5).

## 3. Gates

**Round trip (fixed point).** world_generator (`--canonical-seed 1`) → `Generate.py` with a scratch
`--player_files_path`/`--outputpath` and `< /dev/null`. The world was copied into `worlds/` only for the run, then the
world dir and the export dir were removed and `preset_files.json` was reverted. The tree was clean after each run.

| | seed 2 | seed 3 | seed 1 |
|---|---|---|---|
| **before** (`267f5617` preset) | `Filling … 15 items.` → `Done.`; export pool has `Energetic Memory: 1`, preset none → **DIFFERS** | same → **DIFFERS** | — |
| **after** (`15fa5ff6` preset) | `Filling … 15 items.` → `Done.`; pools **EQUAL** | `… 15 items.` → `Done.`; **EQUAL** | `… 0 items.` (canonical) → `Done.`; **EQUAL** |

The after-pool is `{Energetic Memory: 1, How to Read: 1, How to Write: 1, JtA Filler: 12, Victory: 1}` on both sides.

**Other gates:**
- `node scripts/procgen/check-jta-locations-roundtrip.mjs`: **ALL CHECKS PASSED**, 27 PASS / 0 FAIL, exit 0.
- **Spoiler test** (`npm test -- --port=8170 --mode=test-spoilers --game=jta_prestige_test --seed=1`; seed 1 =
  `AP_14089154938208861744`, sphere log embedded): **1/1 PASSED**. It logs 1 console error, a 404. The untouched
  `jta_locations_test` logs the same 1, so it is baseline.
- **In-app `jta-prestige-perk-regrant`**, the test that loads this preset (`--mode=test-substrates --test=…`):
  **PASSED**. It logs 6 console errors (2 `ERR_CERT_AUTHORITY_INVALID` and 4 404s). The sibling
  `jta-location-check-and-perk-grant`, on an untouched preset, logs the identical 6. This needed
  `frontend/modules/journey-to-ascension` **initialised at its pinned `d20196ce7e`**, which was not checked out in the
  container.
- **In-app `--batch=apworld`**, the in-browser caller of `unplacedPoolItems` (`apworldEditorTests.js:11500`): **139/140**.
  - The one red, `apworld-build-downloads-a-loadable-apworld`, is environmental: `Failed to fetch dynamically imported
    module: https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs`, because the browser's CDN fetch fails the
    proxy cert.
  - That test loads `procgen_maze`, which this change does not touch.
  - On a clean `origin/main` worktree the same row also fails, without recording a condition.
- **Bounded vitest:**
  - `regionContent.test.js` + `recordedZoneConfig.test.js` (both enumerate the 5 JtA fixtures): **95/95** after; 2
    failed before the reader fix.
  - The 40 other non-slow test files that read committed presets (`rg -a -l "preset_files\.json|frontend/presets"`
    over `*.test.*`): **36/40 files, 779/781 tests**. All 4 red files are baseline:
    - `flashPanel/seedlingAtlasArm`, `seedlingGeneratedArm` and `mapDocumentPath` fail with ENOENT on
      `flashPanel/wasm/builds.json`, because the wasm submodule is not initialised here.
    - `scripts/procgen/standingValues.test.js` fails its "kill deadline" row identically on a clean `origin/main`
      worktree.
  - The suite number comes from CI after merge (⚖ ruling 52).
- **Derived rosters:** `jta_prestige_test` is named only by the generator, `test-helpers.js`, the in-app tests, the two
  vitest files above, `preset_files.json` (unchanged: same folder, same file list) and
  `scripts/release/preserved-dev-presets.txt` (a name list, unchanged).
- **pytest:** not run. No Python changed, and the Python side was exercised by the Generate.py round trips.

## 4. Mutants

- **Generator fix reverted.** Running the `267f5617` generator with `--out` reproduces all five presets
  **byte-identical to the previously committed ones**, and the old `jta_prestige_test` is the one whose round trip
  DIFFERS (§3 "before"). The fix is therefore the only cause of the preset diff, and reverting it brings the defect
  back.
- **Reader fix reverted** (the intermediate state between the two commits): the 2 cascade rows go red with
  `unplacedPoolItems` listing `Energetic Memory`.

## 5. Question left for the user

None blocking. One decision to confirm: I changed `unplacedPoolItems` (the Placements tab's "pool items placed
nowhere") to subtract starting copies, following the exporter's precollected + placed contract. The previous slice
had left it as a noted follow-up. If the tab should instead show starting copies as their own line, that is a UI
follow-up on top of this change.

**Final SHA:** the commit adding this report, on `claude/fix-jta-prestige-pool-roundtrip-jujp05`.
