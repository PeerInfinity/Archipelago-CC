# topdown-apcalc-fill — cloud report (2026-10-01)

**Branch:** `claude/topdown-apcalc-fill-verify-f8q13a` (the harness's designated branch; it is a fast-forward of
`topdown-apcalc-fill`). `topdown-apcalc-fill` was at `2d6fb08298` on `3ab7a713fb` = `origin/main`, so no rebase was
needed. The final SHA is the commit that carries this report (`git log -1 origin/claude/topdown-apcalc-fill-verify-f8q13a`).
The work commits are `2d6fb08298` (the WIP compile fix, unchanged), `2a819f4` (the hub's grant fix + two pins), and `63e4692`
(the AP_4–6 re-record).

## Verdict

The WIP fix is **correct** and stays as it was. It was **partial**: the apworld hub's grant writer (`withGrants`) is the
same lost step on a second path, and a pipeline-vs-hub parity test caught that path (see §3). That writer is fixed too.
AP_4–6 are re-recorded. Fill passes on all three.

## 1. The lost step, and the contract as read in code

**The contract** is that `itempool_counts` = precollected + placed, and world_generator's pool = `itempool_counts −
starting_items − locked events`.
- Exporter: `exporter/games/base/world_data.py:51` `get_itempool_counts`. It counts `multiworld.precollected_items`
  (`:64–66`), then every filled location's item (`:73–75`).
- world_generator reads the exporter's two fields verbatim, in `world_generator/extractors.py:1343` (`extract_itempool_counts`,
  `:590`) and `:1347` (`extract_starting_items`, `:616`, one count per list entry).
- The template inverts the exporter. `world_generator/_template_init.py:899–944` builds `ITEMPOOL_COUNTS` as
  `count − locked_event_counts − starting_items`. The canonical branch subtracts at `:923`, the no-canonical branch at
  `:942`. The starting items are precollected separately (`_push_starting_items`, `:1276`).

**The lost step** was in `frontend/modules/procgenPipeline/procgenPipelineEngine.js` `buildRulesJson`. It pooled one
item per *placed* location (`compiled.itempool_counts`, `:7114`) and then wrote `starting_items` (`:7138–7141`) without
pooling them. world_generator then subtracted starting items that were never in the pool. The apcalc sources pool
84/77/81 = 80/73/77 locations + 4 starting buttons. The compile pooled 80/73/77, so world_generator was left with 76/70/74.

**The fix** is at `procgenPipelineEngine.js:7133–7144` (`2d6fb08298`). Each kept starting item is also pooled (`+1`).

**The same lost step, second writer:** `frontend/modules/apworldEditor/rulesDocOps.js:2940` `withGrants` (the initialise
op and `set-region-sidecar`'s `grants`). It wrote a def and a `starting_items` entry per granted library item, but no
pool count. It now adds one pool count each (`:2945–2947`).

**End-to-end proof of the contract.** I ran each compiled preset through world_generator → Generate.py at seed 1, then
compared the exporter's re-exported `itempool_counts` with the compiled one:

| preset | before (committed) | after (fixed) |
|---|---|---|
| AP_4 | differs: `Button: 6/7/8/9` each +1 on export | **identical** |
| AP_5 | differs: `Button: 3/5/9` +1, `Button: 4` None→1 | **identical** |
| AP_6 | differs: `Button: 0` None→1, `Button: 1/5/6` +1 | **identical** |

After the fix, the compile is a fixed point of the round trip. Before it, it was not. The fixed AP_4–6 button pools also
equal the apcalc source's button pools exactly (25/25 each).

## 2. Presets affected and re-recorded

- **AP_4, AP_5, AP_6** were re-recorded with the recorded commands (`scripts/utils/generated_commands.sh:537–542`,
  `generate-topdown-preset.js` + `register-preset.py --move --force`). `preset_files.json` was rewritten byte-identical.
  Only `itempool_counts` moves. Non-event pool: AP_4 80→84, AP_5 73→77, AP_6 77→81. The embedded `sphere_log` is
  unchanged.
- **AP_1–3 and AP_7–12** were regenerated into scratch with their recorded commands. All 9 are **byte-identical** to the
  committed files. AP_7–9 were not worked on (dropped) and are not made worse; they carry no `starting_items`.
- **procgen_maze AP_1–3** carry `starting_items: []`, so the changed branch never runs (it is guarded by
  `startingItems.length > 0`).
- **Derived rosters:** `rg -a` for `procgen_topdown/AP_[456]`, `AP_[456]_rules` and their seeds outside `frontend/presets`
  finds these readers:
  - `apworldEditorTests.js:9989/10473/11841`
  - `regionRegenerate.test.js:324`
  - `librarySourcePicker.test.js:143`
  - `check-regenerate-region-control.mjs` (a comment)
  - `generated_commands.sh`

  All of those runs are green (§5).

## 3. Generate.py before/after (scratch round trip)

`python -m world_generator <rules> -o /tmp/rt/<tag>/w/<x> --game-name "<X> WorldGen" --force --canonical-seed 1`.
The world was copied into `worlds/` only for the run and removed afterwards. The player yaml was in a scratch
`--player_files_path`, with `< /dev/null`. `preset_files.json` was reverted after every run, and the auto-created
`frontend/presets/<x>/` was removed.

⚠ **Seed 1 never exercises Fill under `--canonical-seed 1`.** It logs `Filling the multiworld with 0 items.`, because
the canonical placements are used, so it reports `Done.` even before the fix. Seeds 2 and 3 run real Fill:

| preset | before, seeds 2 & 3 | after, seeds 2 & 3 (and 1) |
|---|---|---|
| AP_4 | `Filling the multiworld with 76 items.` → `Fill.FillError: No more spots to place 72 items. Remaining locations are invalid.` | `Filling … 80 items.` → `Done. Enjoy.` |
| AP_5 | `… 70 items.` → `Fill.FillError: No more spots to place 66 items. …` | `… 73 items.` → `Done.` |
| AP_6 | `… 74 items.` → `Fill.FillError: No more spots to place 70 items. …` | `… 77 items.` → `Done.` |

Seed 1 gives `Done.` both before and after, for all three.

## 4. The mutant

I reverted the two pooling lines in `buildRulesJson` and regenerated AP_4–6 with the recorded producer. The output was
**byte-identical to the previously committed AP_4/5/6**, so the fix is the only cause of the preset diff. The mutant's
AP_4 round trip at seed 2 failed again with `Fill.FillError: No more spots to place 72 items.` The engine was restored
from git afterwards.

## 5. Gates

**Spoiler tests** (`npm test -- --port=8140 --mode=test-spoilers --game=procgen_topdown --seed=N`):
- AP_4 **162/162**, AP_5 **148/148**, AP_6 **156/156**, all PASSED. The counts are unchanged from before, as expected:
  the sphere log is generated from starting items and placements, not the pool.
- Each run logs 1 console error. The untouched AP_1 (26/26 green) logs the same 1, so it is baseline.

**In-app `test-substrates --batch=apworld`:** 139/140. The one failure is `apworld-build-downloads-a-loadable-apworld`
(`Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs`). It is
**environmental**. As a control, I checked out the base `3ab7a71` versions of the engine, `rulesDocOps.js` and AP_4–6,
and that row alone failed identically. The tree was restored from HEAD afterwards. `curl` reaches the CDN through the
proxy (200); headless Chromium does not.

**Bounded vitest** (no unfiltered run, per ruling 52):
- 42 files, **1251/1251**. This set is every test file mentioning `startingItems`, `procgen_topdown` or `AP_[456]_rules`,
  plus all of `frontend/modules/apworldEditor/*.test.js` (`withGrants` feeds two ops).
- 8 more files that call `buildRulesJson(`, **307/307**: `zoneIntegration`, `substrateConfigRecord`,
  `buildRulesJsonLoopCosts`, `gridCodec`, `procgenPipelineEngine`, `regionGeometry`, `spiralLibrary`,
  `spiralSteps.dataset`.
- Slow tier (`--config vitest.slow.config.js`), the two slow files that pass `startingItems`: `braidSphereBot.slow`
  and `sphereGrowth.slow`, **38/38**.
- `node scripts/procgen/check-topdown-steps.mjs`: ALL PASS.

**Tests updated by design (the old pins):**
- `slotInitialise.test.js` "the deep diff …" and `regionGenerationFlow.test.js` "ONE op writes the entry AND the
  grants — nothing else". Each now names `itempool_counts` in the changed set and asserts the pool delta is exactly
  `+1` per granted name.
- No test pinned the AP_4–6 pool counts.
- The WIP alone failed `slotInitialise.test.js:828` (the pipeline vs hub audit row). The pipeline pooled `Springs`
  and the hub did not, and that is how the second writer was found.

**pytest:** not run. No Python was touched, and the Python side was exercised by the Generate.py round trips. The tree
was checked clean after every Generate.py run.

## 6. Other presets measured (report only)

Every committed preset with `procgen_metadata` (36 files) was checked for `starting_items`.
- Only **procgen_topdown AP_4–6** (4 each) and **`jta_prestige_test`** (1: `Energetic Memory`) carry any.
- `jta_prestige_test` sets `starting_items` *after* `buildRulesJson`
  (`scripts/test/generate-jta-locations-test-preset.mjs:205`), so it is a different step. Its pool equals its locations
  (15/15), so Fill passes: the round trip gave `Done.` at seed 1 and at seed 2 with `Filling … 15 items`.
- It is **not** a round-trip fixed point: the exporter re-exports `Energetic Memory: 1` where the preset has none. I did
  not fix it. Fixing it would mean adding the pool entry in that generator and re-recording, which is outside this slice.

**Contract readers that do not subtract starting items (noted, not changed):**
- `frontend/modules/apworldEditor/regionContent.js:860` `unplacedPoolItems` (the Placements tab's "pool items placed
  nowhere") is `pool − canonical placements` and ignores `starting_items`. It now lists AP_4–6's 4 starting buttons as
  unplaced.
- It already did the same on every exporter-sourced document with starting items, such as the apcalc sources
  themselves. That makes it a pre-existing reader bug against the exporter's contract, and a candidate follow-up.
- The hub's manual `set-starting-count` op edits the starting list independently of `pool_count` by design, so I left
  it alone.
