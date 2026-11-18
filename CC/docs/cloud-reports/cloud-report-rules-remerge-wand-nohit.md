# Cloud report: `rules-remerge-wand-nohit`

Branch `claude/rules-remerge-wand-nohit-1r2pa4`. Ruling: Robert (direct, 2026-11-16), *"Cloud re-merge ×2"*. Planner: `seedling-rules-planning-8`.

This is a MECHANICAL re-merge of `claude/rules-nohit-wand-crosscheck-2tul2m` onto main. It adds no new logic.

## Base

| | |
|---|---|
| SOURCE `git rev-parse HEAD` after `checkout -B` | `bec074307d33f8a56677a95f09ef4ceaaadd6d2c` |
| `git rev-parse origin/main` | `756d28a19659beb5ff4e9ea07e53ad48e50df68a` (train: rules-l99-killlock, carries L99's sided kill-lock) |
| merge base of the two | `75e45c964d` |
| wasm / `vendor/seedling` | `9968c7dd` / `ccdf1897`, unchanged; `session_bootstrap.sh --seedling` printed READY, "seedling wasm builds: OK (4 dirs)" |

Commits on top of the source:

| commit | what |
|---|---|
| `54c69092` | merge `origin/main`. Generated files take main's side; the three test pins keep both slices' comments |
| `40c33a09` | the producers, in recipe order, plus the re-recorded pins |
| `8e38a860` | the derived-rule table (inputs only), measured locally |
| `f1771436` | campaign frontier `sources` md5, patched by hand |
| `baeb7be1` | `git mv` of the source report into `CC/docs/cloud-reports/`, plus this slice's evidence |
| (this commit) | this report |

## Answer table

| question | answer |
|---|---|
| Rows that move against main | **Exactly the branch's movers, and nothing else.** AP_1: `level_22__r8c0 -> level_22__r0c6` gains `Has(Wand)`. `seedling_er`: the same single row. Maze: the same row, plus `level_22__r0c6`'s `atlas_gate_0` (its `clear_rule` gains Wand, its name gains `OR Wand`). Every other leaf that moves is an `atlas_ref` or `atlas_id`. **No STOP** |
| Seed-1 sphere log and spoiler | **byte-identical to main.** `_sphere_log.jsonl` `efaa1921…` = main; `_Spoiler.txt` `39ca6d69…` = main |
| Seed-1 `_rules.json` | one leaf: that row's `item_names[3] = Wand`, plus the atlas refs and ids |
| `seedling_er` layout | **unchanged.** Same 50 placements, 48 exits moved, accepted on draw 1, 90 sphere states. The draw does not move |
| Producer `--check`s | all green: rules rc 0 (after the table), partition, maze, er-preset, sphere-order (unchanged `4a9b7e80`), worldgen freshness PASS, `generate-procgen-reference` ALL MATCH |
| Derived-rule table | **inputs only**: `payloadMd5` 4b4fd1b6 → `e1758771f9de70a1eef3476a65359f70`, `measuredAt` → `40c33a09f7`. 108 rows in 51 regions, 6 excluded, certifier 1 / 16 / 0; every pinned count matches. `engineMd5` `bec369878feb67081187edca62baa951` (42 files), unchanged |
| Campaign frontier | only `sources` failed (14 pass, 1 fail). AP_1 md5 patched by hand, 858fa745 → `738b441e`; now 15 pass, 0 fail. `--write-frontier` was not run |
| Cross-check `--check --quick` at the regen tip | **PASS**: 4 crossings agree, 3 INFO. **Wall 198.2 s** (real 3m18.3s). Same crossings and same verdicts as at the source tip (159.4 s then); see §3 |
| Bounded vitest | 6 touched files: **93/93 passed**. Wider sweep: **121 files, 2132/2132 passed** (6m13s) |
| Survey step 35 (L22 → L29) | **No change** to what the leg holds or requires. Its derive-only route is identical to main's. **I do not expect step 35 to move because of this slice** (§4) |

This slice has no game-witness question. The Wand's GAME YES is the source branch's witness: `l22-25-21-wand`, 0 hits, levels [22, 21], t340, with its control at 2 hits. See the moved report, §1. It was not re-run here, because nothing it reads changed in the merge.

## 1. The merge (`54c69092`)

- **Conflicts:**
  - Generated (taken from main, then regenerated): the four atlases, `atlas_files.json`, `instruments.js`, `architecture.md`'s
    counts region, AP_1, `seedling_er`, the maze, the seed-1 `_rules.json` and `.archipelago`, and the three `worlds/seedling_playthrough/_worldgen_*.json`.
  - `Rules.py` auto-merged. I set it back to main's side before regenerating, and the producer rewrote it.
- **Hand-written (both sides kept):** `levelSetExporter.test.js`, `vanillaOverlay.test.js` and `seedlingAtlasDoorCensus.test.js`. In
  each, main's L99 comment and the branch's Wand comment both stay, and a `⛓ rules-remerge-wand-nohit` line names both slices.
- **`make-seedling-playthrough-rules.mjs` imports:** no conflict.

## 2. Re-records (`40c33a09`, `8e38a860`, `f1771436`)

| step | result (main → merged) |
|---|---|
| `make-seedling-playthrough-rules.mjs` | atlas `seedling-2ac275e8` → `seedling-77a4c0ea` (md5 28dc5dc7 → `5f47a836c0a0843d13547b1cbeb7093f`); AP_1 858fa745 → `738b441e` |
| `make-seedling-subregion-partition.mjs` | 411078c6 → 3ff0eedc (the atlas id) |
| `make-seedling-playthrough-maze.mjs` | 68731263 → b50baf1a; `--check` byte-identical |
| `make-seedling-er-preset.mjs` | aa6c0885 → 635176aa; `--check` matches a fresh build |
| `make-seedling-sphere-order.mjs` | unchanged (4a9b7e80), as expected |
| world_generator recipe (`--apply-name-substitutions --canonical-seed 1`) | `Rules.py`: `HasAny('Progressive Sword', 'Ghost Spear', 'Progressive Shield', 'Wand')` on that entrance; 3 sidecars; freshness PASS |
| `Generate.py` seed 1 (minimal-spoilers) | `_rules.json` 58b2d639 → 9fbe066c, `.archipelago` 2c209272 → 6c252589; sphere log and spoiler unchanged; `preset_files.json` reverted (only its trailing newline had moved) |
| `atlas_files.json` | seedling-playthrough → `seedling-77a4c0ea` (an index with no writer, as in the source report) |
| `generate-procgen-reference.mjs` | architecture.md / instruments.js back to the counts the merged tree emits |

**Pins** (each value read from a producer's output):

| pin | main | merged |
|---|---|---|
| `seedlingAtlasDoorCensus.test.js` atlasId | `seedling-2ac275e8` | `seedling-77a4c0ea` |
| `levelSetExporter.test.js` committed.atlas_id | `seedling-2ac275e8` | `seedling-77a4c0ea` |
| `vanillaOverlay.test.js` atlas md5 | `28dc5dc7…` | `5f47a836c0a0843d13547b1cbeb7093f` |
| internal-exit count | unchanged | no pin moved (the Wand widens one row's rule; no exit moves) |

**Derived-rule table:** `GITHUB_SHA=40c33a09f7… node scripts/procgen/probe-seedling-derived-rules.mjs --shards=2`, wall 1m24.6s.
- The probe's `FAIL: the derived-rule table differs` is the expected staleness before the copy.
- Against the committed table, only `inputs.payloadMd5` and `measuredAt` differ.
- `seedlingDerivedRuleTable.js --print-engine-closure` prints `engineMd5 bec369878feb67081187edca62baa951 (42 files)`.
- The planner re-runs it on CI (REGEN_RECIPE). A CI copy should differ in `measuredAt` only.

## 3. The no-hit cross-check at the regen tip

`node scripts/procgen/derive-seedling-wallflyer-nohit.mjs --check --quick` (log: `rules-remerge-wand-nohit-evidence/out/crosscheck-quick.txt`):

```
AGREE L22 [21,29] -> [25,30] (S): table free, derived free (LINE with no item) (19515629 lanes, 15 configs, 137535 ms)
AGREE L22 [25,30] -> [21,29] (N): table gated [hasSword, hasSpear, hasShield, hasWand], derived gated (NO LINE with no item) (223520 lanes, 2 configs, 1606 ms)
  AGREE arm hasSword / hasSpear / hasShield / hasWand (witness l22-25-21-wand) … LINE
  INFO derived arm darkshield gives a LINE; the table does not offer it
AGREE L25 [22] -> [26] (W): table free, derived free (144307 lanes, 3 configs, 832 ms)
AGREE L25 [26] -> [22] (E): table gated [hasSword, hasSpear, hasShield], derived gated (370556 lanes, 2 configs, 1852 ms)
  INFO darkshield; INFO wand (named unwitnessed: a game witness of l25-26-22-wand …)
L27: sides [[26,28]]; table gates none
PASS: the gate table agrees with the derivation on every wallflyer crossing (4 crossings, 3 info) — wall 198.2 s
real 3m18.322s
```

- **Did the post-flip main change the crossings it agrees on? No.**
  - The same 4 crossings are found, with the same directions and the same arms.
  - The lane counts and configs are identical to the source report's (19515629/15, 223520/2, 144307/3, 370556/2).
  - The same 3 INFO lines appear.
- **Why nothing moved.** The tool's 35-file import closure differs from the merge base only in `contactFidelity.js`. That file gains
  one new switch, `wallFlyerCorpseGone: false` (OFF), and the derivation does not read it. The `WALLFLYER_KILL_ARM` flip is in
  `solverBot.js`, which is outside the closure.
- **The wall time is longer:** 198.2 s here, against 159.4 s at the source tip. The box was not fully idle: a few short git and node
  commands ran during the first L22 crossing.

**The §4 CI YAML block** (in the moved report) needs no refresh. Every path it lists exists at the merged tip.
`actions/checkout@v6.0.2` and `actions/setup-node@v6.4.0` are the versions the repo's workflows use. `--check` and `--quick` are
unchanged. It stays a block in the report; `.github/` is not edited.

## 4. Survey step 35 (L22 → L29) against the merged tip

`node scripts/procgen/survey-seedling-route.mjs --derive-only --through=end --route=full --out=<scratch>` ran at the merged tip, and
again with main's AP_1, atlas, partition and `atlas_files.json` checked out. Logs: `out/survey-derive-only.txt` and `.main.txt`.
**The two route derivations are line-for-line identical** (the diff is one trailing blank line).

```
LEG 3.3  Level 029 - Boss Key 1  (+Green Key)
  items held entering: {Progressive Sword, Seal, L0 flag 1: …, L16 flag 0: …, L18 flag 0: …, Red Key, L19 flag 1: …, Progressive Shield}
  levels: L25 → L22 → L29
  regions: level_25__r2c7 > level_22__r8c0 > level_22__r0c6 > level_29__r2c2
  FORCED rooms (no route avoids them): level_22__r8c0, level_22__r0c6
LEG 10.1  Level 043 - Wand  (+Wand)
```

- **What the leg holds does not change.** It enters with Progressive Sword and Progressive Shield, and no Wand, which comes at leg
  10.1. That already satisfied the old `Or`. Adding a Wand arm the route does not hold changes neither what the leg REQUIRES nor which
  leg crosses L22.
- **I do not expect step 35 to move because of this slice.** No solverBot, levelRun or `CONTACT_FIDELITY` file is touched here.
- **What can move step 35 is on main already:** `WALLFLYER_KILL_ARM` ON, and the `wallFlyerCorpseGone` key, still OFF (see
  `seedling-hammer-wallflyer-gaps.md`). Both are untouched here, and neither reads the AP rule.

## 5. Tests

- **Touched files** (`npx vitest run` with the paths named one by one):
  - the merge's three: `levelSetExporter.test.js`, `vanillaOverlay.test.js`, `seedlingAtlasDoorCensus.test.js`;
  - the branch's own: `seedlingNoHitDirectionalGates.test.js`, `deriveSeedlingWallflyerNohit.test.js`, `probeSeedlingWallflyerNohit.test.js`.
  - Result: **6 files, 93 tests passed** (22.9 s).
- **Wider bounded sweep:**
  - The list: `grep -rlas` over `frontend/modules` and `scripts`, default-tier `*.test.js` only. The patterns were AP_1, the atlas,
    the frontier, the derived rules, `seedling_er`, the maze, the gate table and the no-hit tools.
  - It found 121 files, guarded with `[ -n "$LIST" ]` and a count check (> 50). The list is in `out/vitest-sweep-files.txt`.
  - Result: **121 passed, 2132 tests passed**, 6m13s.
- **Not run:** the slow, train and calib tiers, and no unfiltered vitest.

## 6. For the planner

- **Dispatch:**
  - `probe-seedling-derived-rules.mjs` (REGEN_RECIPE). Expect `measuredAt` to be the only difference.
  - `probe-seedling-wallflyer-nohit.mjs`, all plans.
  - `probe-seedling-whole-game-certify.mjs` with `--arms=new`, and again with `--source=er`. Neither was re-run here; the source got
    1 / 16 / 0 for both.
  - The train tier (`train_only`).
- **Whichever re-merge lands second** (this one or the L73 move + Fire guard) is re-merged again by the planner. The movers to check
  then are §1's single L22 row in the three presets.
- **Housekeeping:**
  - No dev server was started, and `core.hooksPath` was not set.
  - `session_bootstrap.sh` left `requirements.txt` and `worlds/zillion/requirements.txt` modified in the working tree. They were not
    committed.
  - No submodule pointer moved. `worlds/seedling/`, `vendor/seedling` and `.github/` were not touched.
