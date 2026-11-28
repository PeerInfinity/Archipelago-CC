# Cloud report: `rules-l25-wand-arm`

The witnessed Wand arm is now wired into L25's west→east no-hit gate, as data: the gate-table arm plus its hand plan and
control, the same shape as L22. **DONE. No stop fired.**

- Branch `claude/l25-wand-arm-nohit-gate-l5rzhs`, from `origin/main` = `c1b250e6380746f579b509132868c0d7818de560`.
- Witness source: `origin/claude/wand-l25-west-east-nohit-bj2bsw` @a8921e5b89 (slice `rules-l25-wand-witness`, GAME YES).
  Its plan and tape are copied into `CC/docs/cloud-reports/rules-l25-wand-arm-evidence/from-witness/`. The branch is not
  merged.
- Evidence: `CC/docs/cloud-reports/rules-l25-wand-arm-evidence/` (its `README.md` maps every file).

## Answer table

| question | verdict | evidence |
|---|---|---|
| L25 W→E with the Wand alone, 0 hits (the arm wired here) | **GAME YES**, re-played at the tip by the tracked probe: levels [25, 22], `maxHits` 0, respawns 0, 201 obs, set `seedling-vanilla-record-23510f80` | `runs/probe-wand.log` (`--only=l25-26-22-wand,l22-25-21-wand`: `ALL CHECKS PASSED`) |
| Its control (same keys, `primary` dropped, no item) | **GAME NO**: levels [25], `maxHits` 2, respawns 1 | same log, row `l25-26-22-none (control of l25-26-22-wand)` |
| L22 N Wand plan beside it (unchanged) | GAME YES, 0 hits; its control 2 hits | same log |
| Movers | **exactly the one row** `level_25__r3c2 -> level_25__r2c7` gains `Wand`, × 4 presets (+ the maze's own obstacle projection of that row) | §1 |
| Seed-1 sphere move | **none**: `_sphere_log.jsonl` and `_Spoiler.txt` byte-identical | `runs/seed1-cmp.txt` |
| Certifier | **1 / 16 / 0 (OPEN_L63 only)**, vanilla and `--source=er --arms=new`; ER matches its expected file | §3 |
| Derived-rule table | re-derived by recipe: **99 / 47 / 6, every row and exclusion byte-identical**; only `inputs.payloadMd5` and `measuredAt` move; `composedDisagrees` 0; **no verdict move** | §2 |
| engineMd5 | `74ae60f575531492ed9eaec1839e1fe3` at base and at tip (42 files); diff ∩ closure = ∅ | §3 |
| `derive-seedling-wallflyer-nohit.mjs --check` | **PASS**, with `AGREE arm hasWand: table offers it (witness l25-26-22-wand), derived LINE` | §4 |
| `regen-seedling.mjs --check` | **10/10 OK** | `runs/regen-check.log` |

## 1. What changed (data, no level literal in code)

Commit `642a7a85` makes these changes:
- **Plans file** `scripts/procgen/seedling-wallflyer-nohit-plans.json`:
  - Adds `plans["l25-26-22-wand"]` and `controls["l25-26-22-wand"]` verbatim from the witness's `plan-l25-26-22-wand.json`.
  - The file is written in the probe's own `--write` shape: compact JSON, keys sorted (`probe-seedling-wallflyer-nohit.mjs:400-401`). A round trip of the base file is byte-identical, so only the two entries are new.
- **Gate table** `frontend/modules/flashPanel/seedlingNoHitDirectionalGates.json`:
  - L25 `arms` gains `hasWand`, and `witness.arms.hasWand` = `l25-26-22-wand`.
  - `unwitnessed` becomes `[]`.
  - The `reexamine` sentence is rewritten. It now names the Wand as an arm of L22 N and of L25 E, each with its witness and ruling, and notes that the waiting-spot rule is necessary but not sufficient where chasers share the room.
- **Reader test** `seedlingNoHitDirectionalGates.test.js`:
  - The L25 expectation is flipped. Both Wand gates are now checked on hand witnesses, each with a control that is the plan's own keys minus `primary`.
  - The unwitnessed refusal mutants now run on an **in-memory fixture**: L25 E's Wand as it stood before its witness. A new test checks that this fixture is accepted, so each mutant is red for its own edit.
  - One extra mutant: the committed table with the entry put back is refused (`hasWand is named unwitnessed but the gate offers it`).
- **Headers:**
  - `seedlingNoHitDirectionalGates.js` (the `unwitnessed` bullet).
  - `probe-seedling-wallflyer-nohit.mjs` (the Wand-row paragraph).
  - `derive-seedling-wallflyer-nohit.mjs:12` (L25's derived YES is a row-3 line the game refuses; the witness is a row-5 line).

### Movers, per preset (Python key walk, base vs tip; `runs/keywalk.txt`)

| preset | ADD | DEL | CHG (not atlas id) | atlas-id CHG |
|---|---|---|---|---|
| `seedling_playthrough/AP_1` | 0 | 0 | 1: `/regions/1/level_25__r3c2/exits[0]/access_rule/children` gains `Has(Wand)` | 308 (`b856f0fc→4586de3a`) |
| `seedling_er/AP_1` | 0 | 0 | 1: the same path, the same change | 309 (308 + 1 `cff09cce→f1b56424`) |
| `seedling_playthrough_maze/AP_1` | 0 | 0 | 3: the same `regions` path; and `/preset_sidecars/1/level_25__r2c7/playable_payload/obstacleLib/atlas_gate_0/clear_rule/children` (+ `Has(Wand)`) with its `name` `"(… OR Progressive Shield)"` → `"(… OR Progressive Shield OR Wand)"` | 1 (`94cd96dd→5e6b4205`) |
| seed-1 `seedling_playthrough/AP_14089154938208861744` | 0 | 0 | 1: `/regions/1/level_25__r3c2/exits[0]/access_rule/args/item_names` gains `"Wand"` (`HasAny`) | 307 |

- The maze's `atlas_gate_0` is that same row's gate projected onto the maze cell. It is not a second row.
- `worlds/seedling_playthrough/Rules.py` changes one line: `HasAny('Progressive Sword', 'Ghost Spear', 'Progressive Shield')` → `HasAny(…, 'Wand')`.
- `_worldgen_rules.json`, `_worldgen_sidecars.json`, `_worldgen_region_atlas.json`, the playthrough atlas and the partition move with the same row and atlas id. The seed-1 `.archipelago` is regenerated.
- **ER draw kept:** the ER key walk shows no exit or region change beyond the row. The certifier's ER arm passes against its expected file.
- **Sphere log diff, verbatim:** none. `cmp` says `_sphere_log.jsonl byte-identical` and `_Spoiler.txt byte-identical`.

## 2. The derived-rule table (designer's binding terms 1–2)

- `refresh-seedling-derived-rules.mjs --check` after pass 1 said: `STALE — the maze world payloads moved (payloadMd5 e705ea93… → 2cd0114b…)`.
- I re-derived it by recipe: `GITHUB_SHA=6436c7827f node scripts/procgen/probe-seedling-derived-rules.mjs --shards=2`, at the pass-1 commit (`runs/derived-rules-probe.log`).
  - Probe output: `CERT: 1 problems / 16 accepted / 0 threw`, `TABLE: 99 rows in 47 regions; 6 exact elements excluded`, and `PASS: every pinned count matches scripts/procgen/seedling-derived-rules-expected.json`.
  - Its only FAIL was "the table differs from the committed one", which is the staleness itself.
- **Table before/after** (key walk, `runs/keywalk.txt`):
  - `CHG /inputs/payloadMd5 e705ea936f2ccf407f1046a4e5d11439 → 2cd0114b24fbbc77f6377a7311ae4202`
  - `CHG /measuredAt 6a41ae2e08 → 6436c7827f`
  - Nothing else: **rows, counts and exclusions are byte-identical**. `inputs.engineMd5` and `witnessMd5` are unchanged.
- **No L25 row verdict moves.** The table's only L25-named row, `level_28__r0c6 -> level_25__r2c7`, is unchanged. The W→E row is not a table row.
- **`seedling-derived-rules-expected.json` is NOT re-pinned.** No pinned count drifted (the probe's own PASS line). Rows/regions/exclusions stay 99/47/6. `composedDisagrees` is 0: the rules producer's `--check` holds it at zero (`seedlingDerivedRuleTable.js:16`), and `regen-seedling --check`'s `rules` step is `OK`.
- After the copy, pass 2 ran (`regen-seedling --write`). No product moved, and seed 1 is `byte-identical to before`. `refresh … --check`: `OK: the committed derived-rule table is fresh and on count`.

## 3. Certifier and engine closure

- Vanilla: `ARM new: 1 problems … / 16 accepted / 0 threw`. The one problem is `level_63__r6c9 → level_63__r0c1` (OPEN_L63). `ALL CHECKS PASSED` (`runs/cert-vanilla.log`).
- ER (`--source=er --arms=new`): `1 problems / 16 accepted / 0 threw`. `PASS: the ER arm matches scripts/procgen/seedling-er-whole-game-certify-expected.json (1 / 16 / 0)` (`runs/cert-er.log`).
- engineMd5, from `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure` in this clone, which has its submodules initialised (not `git archive`):
  - Base (the tree stashed back to `c1b250e638`): `engineMd5 74ae60f575531492ed9eaec1839e1fe3 (42 files)`.
  - Tip: the same (`runs/engine-closure-tip.txt`).
  - `git diff --name-only c1b250e638..HEAD` ∩ the closure's 42 files = ∅.

## 4. `--check` lines

- `node scripts/procgen/derive-seedling-wallflyer-nohit.mjs --check` (`runs/derive-check.log`, wall 560.8 s):
  - `AGREE L25 [26] -> [22] (E): table gated [hasSword, hasSpear, hasShield, hasWand], derived gated (NO LINE with no item)`
  - `AGREE arm hasWand: table offers it (witness l25-26-22-wand), derived LINE (16 ms)`
  - `INFO L25 [26] -> [22] (E): derived arm darkshield gives a LINE; the table does not offer it (no witness arm of the table names it)`, unchanged from base.
  - `PASS: the gate table agrees with the derivation on every wallflyer crossing (4 crossings, 2 info)`.
  - The train-tier test runs this same `--check`. Its expectations do not move.
- `node scripts/procgen/regen-seedling.mjs --check`: **10/10 OK**. `census OK: 2 SKIP row(s)` is its usual output.
- `node scripts/procgen/make-seedling-vanilla-overlay.mjs --check`: `OK: … seedling-vanilla-overlay.json matches a fresh build`.

## 5. Pins re-recorded, each with its reason

| pin | from → to | reason |
|---|---|---|
| `frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json` | `payloadMd5` e705ea93 → 2cd0114b, `measuredAt` → 6436c7827f | the maze AP_1 payload moved (one row); re-derived by REGEN_RECIPE, rows identical |
| `frontend/modules/seedlingDemo/fixtures/campaign-frontier.json` `sources` AP_1 md5 | 51023885 → 40974657 | the only census FAIL; set by hand as in earlier re-records (never `--write-frontier`) |
| `frontend/modules/flashPanel/atlases/atlas_files.json` | `seedling-b856f0fc` → `seedling-4586de3a` | the playthrough atlas restamped |
| `levelSetExporter.test.js`, `seedlingAtlasDoorCensus.test.js` (atlas id), `watchSetIdentity.js` (comment) | b856f0fc → 4586de3a | same |
| `vanillaOverlay.test.js` playthrough-atlas md5 | 5c3dd651 → d4bd2a66 | same restamp; the overlay fixture `--check`s byte-identical |
| `seedlingMountKeyLevelSet.test.js` | `seedling_er/AP_1` 16a2f41d → b62c786e (`seedlingJsSave_a6224a718b1af484`); `seedling_playthrough/AP_1` b980a716 → d304b514 (`…_907e2968f2372ef9`); seed-1 70771818 → 74e5f4ee (`…_70157f26a5cd3b5b`) | the three moved presets, measured with the module's own `seedlingMountKey` (re-record noted in its header) |

- `seedlingDivergenceLegs.test.js` passed with no change, so its fixture did not move.

## 6. Bounded vitest

- The list is `runs/vitest-list.txt`: 205 explicit paths, every one a file (never a derived empty list). It is the union of:
  - every `*.test.js` that reads the gate table, its reader, the plans file, the probe or the derivation (`seedlingNoHitDirectionalGates.test.js`, `probeSeedlingWallflyerNohit.test.js`, `deriveSeedlingWallflyerNohit.test.js`, `seedlingPlaythroughLogicalLinks.test.js`, `boxLock.test.js`, `trainShardPlan.test.js`);
  - every test reading one of the four moved presets, the playthrough atlas, the partition, the sphere order, `atlas_files.json`, the campaign frontier, the derived-rule table or `seedling-derived-rules-expected.json` (`derivedRuleTableFresh`, `derivedRuleOverride`, `refreshSeedlingDerivedRules`, `derivedRulesProbe`, `regenSeedling`, …);
  - plus `seedlingMountKeyLevelSet.test.js`, `seedlingDivergenceLegs.test.js`, `deriveLevelWorldLogic.test.js` and `atlasIndex.test.js`.
- `.train` and `.calib` files are excluded; the train tier is the planner's dispatch.
- **Default tier**, 199 files (`runs/vitest-default-first-run.txt`):
  - First run: 197 passed, 2 failed (4 tests: the three mount-key rows and the atlas md5, all pins of §5).
  - After the re-record, those 2 files plus the reader test were re-run: 3 files, 36 tests, all passed.
- **Slow tier** (`-c vitest.slow.config.js`): `deriveLevelWorldLogic.slow.test.js` and `sphereZeroCredit.slow.test.js`, 2 files / 3 tests passed (`runs/vitest-slow.txt`).
  - Its skip list names no L25 row.
  - The other four `.slow` files the grep caught (omsi, presetDefs, seedlingGen ×2) read no Seedling playthrough preset and were not run.
- No unfiltered vitest was run.

## 7. Notes

- ⚑ `docs/json/developer/procgen/maze.md:451` still says the two gates are each `Sword | Spear | Shield` and that "the Wand is unwitnessed". That has been stale since L22's Wand landed. I left it alone because it is outside this slice's licence.
- ⚑ `level_25__r2c7 -> level_28__r0c6 True_`: L25's chest opens only from below, so no arm reaches the L28 door from the east side. This is the witness report's § 1.4 question, untouched here.
- CI: no dispatch. Every run was in this container. A dev server was started on 8000 for the probe and then stopped by its PID.
- Nothing moved in `worlds/seedling/`, `vendor/seedling`, `.github/` or any submodule pointer. No solver, levelRun, `CONTACT_FIDELITY`, level data or engine-closure file moved.
