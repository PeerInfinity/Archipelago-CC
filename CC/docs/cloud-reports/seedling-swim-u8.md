# Seedling swim U8: the biome defaults fold (⚖ Q13)

**Slice:** `seedling-swim-u8`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §15.7).

| | |
|---|---|
| Started from | `origin/main` @ `f4a4a288e3` (one commit past the brief's expected `4081ecc742`: *"chore(bank): the seven identity rows U4b moved, re-recorded at 4081ecc742"*) |
| Harness branch | `claude/biome-defaults-fold-ijvguh` (the harness pins this branch, not `seedling-swim-u8`) |
| Commits | D1 `ee1a9b8` · D2 `773d2e3` · D3 `bde3ce9` · this report (the last commit) |
| Parallel siblings | U5, U6 and U7 (the solver). No solver or simulation file was touched: no `solverBot.js`, `chasers.js`, `dangerMap.js` or `levelRun.js`. |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduces U4b's head table and the standing bank. The yield sweeps and the vitest BEFORE are banked. |
| D1 | **PASS** | `defaultElementsFor` folds the opt-in heads in, by item. Pre-sword is unchanged. `arena` names `w=2;h=3` and `roam` stays bare, both measured. `DEFAULT_CENSUS_BIOMES` names five biomes. Mutant (a) reds the two pin rows by name. |
| D2 | **PASS, with a null re-record** | **No shipped preset moves.** The four generated presets are byte-identical: three build on the gen-room default biome, `pre-sword`, and the swim one names `watergate`. Eleven identity rows move, each explained. The acceptance batch threw under five biomes and is fixed. Four browser subjects were re-picked by their own rules, and every gate is green. |
| D3 | **PASS** | The elements catalogue gains a DEFAULT-IN column and the three later biomes. Updated: flash.md (a new section), seedling-bot.md, architecture.md, the glossary and the log. The reference and the docs index are regenerated. |

**The one thing to know first.** ⚖ Q13's *"the shipped generated presets are re-recorded ONCE"* has nothing to re-record. `seedling_generated_room`, `_leaf` and `_host` carry `generation.biome: 'pre-sword'` with `elements: ''`. That is `GEN_ROOM_DEFAULTS.biome`. The brief's fold adds nothing pre-sword: every folded head is item-gated, and `roam` joins with the sword. `seedling_generated_swim` names `watergate` explicitly. So no committed world draws a folded head, and a pipeline room shows the fold only when someone sets its biome past `pre-sword`. If the intent was for shipped worlds to carry the new heads, that is a preset or biome decision this slice did not make. Second, the census's wall clock grew about 5.6× on the moved rows (residue).

## W0: the banked rows (clean tree `f4a4a28`)

| Row | Result |
|---|---|
| identity block (`SEEDLING_PORT=8890`) | maze `246dfbce…` · acceptance `d02ed4c0…` · c3 `d43a8c97…` · c6 `62b5475f…` · c4 `556eb1ee…` · ENEMY `fdff69ee…` · guard `a6d18d49…` · AREA `06b14d5d…` · killgate s2/s5/s9 `1b4eab8e…`/`b018ab2b…`/`999e1900…` · level pre/post s1 `e28c1e5d…`/`0076f26f…` · generated set OK. **All equal U4b's head table.** |
| six r8/r9 `--check`s | `410f27c0` `b470c14d` `17be7d70` `9a6a3192` `6cd35fe1` `2823a811`, all exit 0 |
| reference `--check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| nine preset `--check`s | `spiral` `sphere` `generated` `generated-leaf` `generated-host` `generated-swim` `atlas-host` `atlas-location` `concept-trial`: 9 × `OK … matches a fresh build` |
| sidecar census | `ALL PASS — 1422 entries over 8 substrates` |
| `check-seedling-generated-set --seeds=1-6` | OK, `procgen-roundtrip-6-c75feb6f`, reachability 6/6 |
| `census-seedling-elements` / `-doors-elements` | `a6d18d49…` / `6ae8d5dc…` |
| 15 md5s (14 shipped `seedling*` + `concept_trial`) | see the byte-inertia block |
| bounded vitest (the brief's six paths, pristine worktree) | **17 files / 453 tests**, green |

**The default draw's yield today** (`sweep-yield-table.mjs --substrate=seedling --kinds=empty,branchy,bushy,loopy,open,rooms,winding --sizes=10x10,14x14 --seeds=1-12 --count=3 --tries=4 --k=3 --anchortries=1 --cellbudget=120 --palette=<biome>`, no `--elements=`, placed/certified of 168):

| biome | placed / certified | per head (drawn · placed · certified) | wall |
|---|---|---|---|
| pre-sword | **80 / 70** | guard 56·4·3 · blockpocket 70·43·34 · chamber 42·33·33 | 51 + 38 s (2 shards) |
| post-sword | **95 / 64** | guard 42·3·2 · killgate 56·42·16 · blockpocket 28·17·13 · chamber 42·33·33 | 98 + 65 s |
| post-shield / post-swim / post-feather | **95 / 64** each | identical totals to post-sword (the same four-head list, the boot moves nothing here) | ~3 min each |

0 timeouts, 0 throws, 0 harness failures in any of the five.

## D1: the fold

| biome | default heads (appended in this order) | yield prior per head (placed/certified of 168, its own sweep) |
|---|---|---|
| pre-sword | `guard;len=2\|3\|4`, `blockpocket`, `chamber;w=2;h=3` (**unchanged**) | W0 above |
| post-sword | + `killgate` (2nd), then `arena;w=2;h=3`, `rockgate`, `shortcut`, `roam`, `corridorbody` | arena;w=2;h=3 **47/25** (bare 25/12, measured here) · rockgate 146/136 (S1) · shortcut 87/87 · roam 10/10 (U4b; `roam;w=2;h=3` **11/2**, measured here) · corridorbody 144/93 (U4b) |
| post-shield | + `shieldgate` | 114/104 |
| post-swim | + `watergate`, `watershortcut` | 146/146 · 87/87 |
| post-feather | + `waterfallgate` (all 13 heads) | 14/14 (T2; 0/12 on the default skeleton, R-m) |

- **Where it lives.** `procgenSeedling.BIOME_DEFAULT_FOLD` is the table. A load-time assert refuses a row naming a head whose `needs` is not its row's item. A default never spends draws on a head the seam refuses for free.
- **The draw weights: equal. Recommended and shipped.** The `+` list's one `rng.pick` is uniform. A draw chooses what to try, and a yield measures what landed. Weighting by yield would starve the heads whose yield still has to be measured. There is also no weight mechanism in the codec.
- **`waterfallgate`: included and measured.** ⚖ Q13 folds the opt-in heads. The measurement (D2) is 0 of 14 placed on the one post-feather seed that drew it, which is the 0/12 the brief warned of. It is a graded drop, and the level ships element-less. R-m stays open.
- **`roam` joins with the sword, not pre-sword**, though it declares no `needs`. The brief's design keeps the pre-sword list byte-identical, and that is what keeps the three pre-sword shipped presets unmoved. Mutant (b) measures the alternative.
- **`corridorbody`: the draw, never `require`** (⚖ Q29). `meetsRequire: false` is untouched. `headsNeeding` is `['killgate','arena','rockgate']` / `['shieldgate']` / `['watergate']` / `['waterfallgate']`, all unchanged, and a row pins them.
- **`DEFAULT_CENSUS_BIOMES`** = `['pre-sword','post-sword','post-shield','post-swim','post-feather']`, still a named list, not `BIOME_NAMES`.
- **Wall clock: not predicted before the run, as the brief asked.** I predicted the yields and the movers, not the time. The measured cost is in D2.
- **Unit rows** (pinned by NAME, no count in a title):
  - `procgenDoorElements`: all five biomes' literal spellings, each biome's added heads by name, `arena`'s params named and `roam`'s absent, and the fold table's `needs` law with `headsNeeding` unmoved.
  - `procgenCorridorBody`: in the post-sword draw, never pre-sword, never `require`.
  - `watchGenerate`, `procgenWaterGate`, `procgenWaterfallGate`: the census default.
- **Re-picked rows** (the post-sword pick moved their subjects), each by its own rule:
  - `procgenPostSword` "seed 38" → **13**. Re-scanned 1..40 through the shipped default: 6 draw `killgate`, 3 certify (13, 25, 33), and all 3 keep 6 over 3 families with a `sword` clear.
  - `seedlingGenCapacity` "drawn seed 29" → **31 with `killgate` named**. No post-sword default draw in 1..60 meets the whole rule, because the tag-spending draws re-roll at 29 already. The row's subject is the re-roll mechanism, so it now names its head, and in 1..40 only seed 31 qualifies.
- **The generated reference:** the catalogue's post-sword `defaultElements` changed, and two `urlGrammar` line numbers shifted (my comment in `watchGenerate.js`).
- **Mutant (a)** (`if (false && …)` on the fold's push; one build, copied and restored, md5 `4a59f321…` before and after). Predicted: exactly the two pin rows red. Measured: **2 red**, `procgenDoorElements` *"the BIOME DEFAULT spec, all five biomes…"* and `procgenCorridorBody` *"joins the post-sword default DRAW…"*, and nothing else. The fold-table row stays green, because it reads the table, not the draw.

## D2: the re-record, measured first

### The identity rows, before → after (head `773d2e3`; every after-md5 reproduced by a second, timed run)

| row | before (`f4a4a28`) | after | why |
|---|---|---|---|
| maze | `246dfbce…` | identical | |
| **acceptance batch** | `d02ed4c0…` | **`6bbc0273…`** | It **threw first** (`PHASES[biome] is not iterable`, so the identity row hashed empty output, `d41d8cd9…`). Fixed in D2: the three later boots walk the naturals. Then post-sword moves: the one *"requires Progressive Sword"* level moves from seed 1 to seed 13. Three biome sections are added: post-shield has 2 × *requires Progressive Sword*; post-swim has 2 × *requires Progressive Shield*; post-feather has 1 shield and 1 sword, plus seed 2 SKIPPED (SATURATED) by name. |
| **c3** | `d43a8c97…` | **`659d2437…`** | 5 biomes instead of 2, plus the post-sword pick |
| **c6** | `62b5475f…` | **`6abcc3d6…`** | same |
| **c4** | `556eb1ee…` | **`fcc6d836…`** | same |
| ENEMY census | `fdff69ee…` | identical | It builds its own chambers and never calls the seam (predicted). |
| guard census | `a6d18d49…` | identical | explicit `guard` (predicted) |
| **AREA census** | `06b14d5d…` | **`02b22525…`** | Post-sword rows only (406 diff lines, 0 pre-sword). Its own biome list is pre/post-sword, not the census default. |
| **killgate s2** | `1b4eab8e…` | **`997ab4a8…`** | The DEFAULT arm moves: `chamber` placed+certified → `roam` not placed. |
| **killgate s5** | `b018ab2b…` | **`4614c86c…`** | DEFAULT: `killgate` DROPPED → `blockpocket` placed+certified |
| **killgate s9** | `999e1900…` | **`dc17ad46…`** | DEFAULT: `blockpocket` → `rockgate`, both placed+certified |
| level pre-sword s1 | `e28c1e5d…` | identical | |
| **level post-sword s1** | `0076f26f…` | **`c4841acb…`** | It drew a certified `killgate` (410→444 t) and now draws `chamber;w=2;h=3` (113→131 t). Level sha `0b41dd5d…` → `987de781…`. |
| generated set | OK | OK | pre-sword (predicted) |
| six `--check`s | as W0, exit 0 | **identical**, exit 0 | |
| reference `--check` | ALL MATCH | ALL MATCH (regenerated in D1 and D3) | |

`census-seedling-elements` `a6d18d49…` and `census-seedling-doors-elements` `6ae8d5dc…` are unmoved (explicit heads). Every mover is a measurement row. The standing values are the coordinator's, and `standing-values --write` was not run.

### The yield after (same command as W0)

| biome | before | after | aborts | seed → head (1..12) |
|---|---|---|---|---|
| pre-sword | 80 / 70 | **80 / 70**, per-cell **byte-identical** (timings stripped, 168/168) | 0 | unchanged |
| post-sword | 95 / 64 | **106 / 85** | 1 harness-failed (`winding` 10x10 s7, `corridorbody`) | chamber, roam, shortcut, arena, blockpocket, chamber, corridorbody, killgate, rockgate, blockpocket, chamber, guard |
| post-shield | 95 / 64 | **104 / 82** | 1 TIMEOUT (`rooms` 14x14 s6, arena) | chamber, corridorbody, roam, rockgate, blockpocket, arena, shieldgate, killgate, shortcut, blockpocket, chamber, guard |
| post-swim | 95 / 64 | **54 / 50** | 1 TIMEOUT (`rooms` 14x14 s6, arena) | arena, shieldgate, shieldgate, shortcut, chamber, arena, watershortcut, blockpocket, roam, blockpocket, arena, guard |
| post-feather | 95 / 64 | **66 / 58** | 0 | arena, watergate, shieldgate, roam, chamber, rockgate, waterfallgate, blockpocket, corridorbody, chamber, arena, guard |

Per head after (drawn · placed · certified):
- **post-sword:** arena 14·6·1 · blockpocket 28·23·22 · chamber 42·31·31 · corridorbody 13·11·7 · guard 14·3·2 · killgate 14·11·2 · roam 14·0·0 · rockgate 14·12·11 · shortcut 14·9·9.
- **post-feather:** watergate 14·13·13 · waterfallgate 14·0·0 · rockgate 14·12·12 · corridorbody 14·12·5 · shieldgate 14·6·6 · arena 28·0·0 · roam 14·0·0 · chamber 28·18·18 · blockpocket 14·2·2 · guard 14·3·2.

**What the brief's priors did not see: the draw depends only on the seed.** The pick happens before the room is built, so all 14 kind×size cells of a seed draw the same head. Each column above is therefore 12 draws, not 168. Post-swim's drop (95/64 → 54/50) is three seeds on `arena`, one on `roam` and none on `watergate`; it is not a rate. Post-sword and post-shield rose (+21 and +18 certified). The per-head yields that predict a long-run rate are the explicit sweeps in the D1 table.

**The harness-failed post-sword cell is a raw throw.** It is `levelRun`'s line-of-sight `Error`: *"the swing at (40.59, 27.05) reaches spinner@16,32's rect but `collideLine("Solid", …)` finds tile:Stone … `Player.slash`'s line-of-sight gate REFUSES that hit … Re-aim the stance."* It escapes the solver's kill path as a raw `Error`, not a graded refusal. It also fires on `arena;w=2;h=3` at `branchy` 10x10 s10 and `winding` 14x14 s6. The fold makes it reachable from a DEFAULT post-sword draw. It is U5–U7's region and was not touched.

### The generated set and the four presets

- **The generated set:** `check-seedling-generated-set --seeds=1-6` is OK in the identity block (pre-sword).
- **The brief's prediction failed: no generated room moved.** The brief predicted *"the 6 generated rooms move"*.
- **The four presets, regenerated by the producer** (`--state=generated|generated-leaf|generated-host|generated-swim`, no `--check`). All four wrote byte-identical files, and the tree stayed clean:

| preset | `generation` | before | after |
|---|---|---|---|
| `seedling_generated_room` | `{biome: pre-sword, elements: ''}` | `28efab18…` | **identical** |
| `seedling_generated_leaf` | `{biome: pre-sword, elements: ''}` | `f7db7bed…` | **identical** |
| `seedling_generated_host` | `{biome: pre-sword, elements: ''}` | `edebfa1f…` | **identical** |
| `seedling_generated_swim` | `{biome: post-swim, elements: watergate, require: canSwim}` | `b6f77113…` | **identical** |

- **The nine `--check`s** are OK and identical to W0. **The sidecar census** reads `ALL PASS — 1422 entries`, the same count. **Enrolment:** nothing enrolled or moved. `preset_files.json`, `preserved-dev-presets.txt`, the producer's `PRESETS`, `SHIPPED_PRESETS`, the boxLock list and the instruments count (294) are unchanged.
- **The pins:**
  - `SHIPPED_PRESETS` carries **no md5s.** The brief's *"presetDefs.js SHIPPED_PRESETS md5s"* do not exist. The pins are the producer's `--check` (a fresh build compared byte for byte).
- **Mutant (b):** `roam` folded into pre-sword as well (one build, copied and restored, md5 `4a59f321…`).
  - **Predicted:** `generated`, `generated-leaf` and `generated-host` read DRIFT by name, and `generated-swim` OK.
  - **Measured:** only `generated` reads `ERROR: … differs from a fresh build of SEEDLING_GENERATED_ROOM_STATE`. Leaf and host stay OK, because their rooms' pick lands on the same head from 4 members as from 3. A stale pin shows only where the draw moves.
- **The play gates** (`--host=http://localhost:8890`): room ALL CHECKS PASSED (30) · leaf (37) · host (33) · swim (25).

### What else the fold moved (all fixed in D2, each re-picked by its own rule)

| subject | before | after | gate |
|---|---|---|---|
| `check-seedling-editor-generate` CARRIER | seed 29 | **13**. Re-scanned 1..72, step 1: 13 (365 t), 25 (455), 33 (465) qualify, all `sword`. 8, 22, 32, 44 and 65 draw `killgate` but do not certify. | ALL CHECKS PASSED (224) |
| …its 5R subject (default ≠ `none`) | seed 3 | **9**. A dropped head rebuilds `none`'s room byte for byte (measured 1..20); seed 9 draws `rockgate`, which places. | same |
| …its 10b (absent ≠ `none`) | seed 2 (shared with 10a) | **its own subject, seed 5** (`blockpocket` places). 10a keeps seed 2. | same |
| `check-seedling-wasm-ship` GEN_SEED | 38 (now `arena`, refused) | **25**: the shortest certified-`killgate` tape of 13/25/33, 381 t | ALL PASS. GENERATE agrees per tick (382 observations), game 381 = certification 381. |
| `demos.js` `density-block` | seed 2 (now `roam`) | **6** (`chamber;w=2;h=3`) | the full demo gate: its only red was the editor-generate CLI (fixed above). `--only=density-block` passes. |

## D3: records

- **The elements catalogue's DEFAULT-IN column.** `scripts/procgen/reference/catalogue.mjs` gives each head `defaultIn`, read off `defaultElementsFor` per `GENERATE_BIOMES` entry. `reference.html` shows it on every head, and `generated.test.js` pins it by name. The catalogue also gains the three later biomes as rows. `check-procgen-reference` is ALL CHECKS PASSED (21).
- **`flash.md` § *The element defaults by biome (swim U8, ⚖ Q13)*:** the table by biome, the draw rule, why no committed room moved, and the yield before → after. The G9 capacity bullet notes the slow census re-ran green.
- **The other docs:** `seedling-bot.md` gets the biome-defaults paragraph (it has no generated-rooms section, so it went under § The procgen level generator). `architecture.md` §2, the glossary `element-head` entry and the `urlParams.js` comment get the folded lists.
- **The comments:** `elementSpec.js`'s *"IN NO BIOME DEFAULT"* comments and `procgenPalette.js`'s *"not in DEFAULT_CENSUS_BIOMES"* comments now say what is true (D1).
- **The log:** `seedling-bot-log.md` § *Seedling substrate U8-swim — the biome defaults fold*, after § U4b-swim.
- **Regenerated:** `generate-procgen-reference.mjs` (ALL 7 + 5 MATCH) and `scripts/quicklaunch/generate-docs-index.mjs` (no change there). The link census moves 324 → 325 (`doc` 249 → 250) for the one new link, with ledger lines in `docLinks.test.js` and `docsRender.test.js`.
- **Bounded vitest AFTER:**
  - The brief's six paths: **17 / 453**, green, identical to BEFORE.
  - The reach set of the two changed modules (106 non-slow files) + `procgenDocs` + the touched files: **115 files / 3398 tests, 1 red** after the link pins. The red is `standingValues.test.js` *"a gate that sleeps past the deadline is KILLED"*, which is red at the pristine base too (measured in the W0 worktree) and was U4b's residue.
  - The two slow reach files (`seedlingGenCapacity.slow`, `presetDefs.generate.slow`, `--config vitest.slow.config.js`): **2 / 28**, green, 604 s.

## What the brief got wrong (measured)

1. **"Predict which of the four move."** None move: three are `pre-sword` at the gen-room default, and the fold adds nothing pre-sword. ⚖ Q13's *"re-recorded ONCE"* is a null re-record.
2. **"The 6 generated rooms move — 6/6 still REACHABLE."** `check-seedling-generated-set` defaults to `--biome=pre-sword`, so it does not move.
3. **"`SHIPPED_PRESETS` md5s `:382`."** `SHIPPED_PRESETS` carries no md5. The pin is the producer's `--check`.
4. **"`seedling-bot.md` § the elements catalogue / § generated rooms."** Neither section exists. The elements catalogue is the generated reference (`catalogue.js` → `reference.html`). Generated rooms are `flash.md`'s.
5. **The yield priors as a per-cell rate.** The default's pick depends only on the seed, so a 168-cell sweep is 12 draws per biome. Post-swim fell to 54/50 on which heads seeds 1–12 drew.
6. **"Mutant (b): one pin left stale ⇒ the preset `--check` reds by name."** No pin moved, so there was nothing stale to leave. The mutant that exercises it (pre-sword moved) reds only the preset whose draw lands differently: 1 of 3.
7. **The census's readers.** `DEFAULT_CENSUS_BIOMES` feeding the acceptance batch was not a pure list move. The batch's `PHASES` is per biome and threw on the three new ones. The identity block's `2>/dev/null` turned that into an md5 of empty output (`d41d8cd9…`), not a red row.
8. **The start SHA** was one bank commit past `4081ecc742`. **The branch** is the harness's `claude/…`.

## Residue

- **R-m (the feather).** `waterfallgate` is in the post-feather default and places 0 of 14 there. The default skeleton seats no fall. It is a graded drop, not an error.
- **The CI wall clock.** Measured on this 4-core box, sequential, one row at a time:

  | row | before | after |
  |---|---|---|
  | acceptance | 17.7 s | 83.3 s |
  | c3 | 14.3 s | 183.8 s |
  | c6 | 23.3 s | 219.2 s |
  | c4 | 52.4 s | 147.3 s |
  | AREA | 0.8 s | 1.1 s |
  | killgate s2/s5/s9 | 1.6–1.7 s each | 1.3–1.6 s each |
  | level post s1 | 1.8 s | 0.6 s |
  | **total** | **≈115 s** | **≈640 s (≈5.6×)** |

  The pairs dumps carry most of it: five biomes instead of two, and the later lists draw the body heads, whose kill solves are the expensive ones. In CI these are headless identity arms under `ci-gates.mjs` (20-minute step timeout). At the recorded 0.11–0.23 runner/box ratio, +525 box-seconds is roughly +60–120 runner-seconds. `ci-arm-costs.json` will re-price them on the next `--write-costs`. **No CI run was observed here.**
- **The raw `levelRun` line-of-sight throw from a DEFAULT draw.** It hits post-sword `winding` 10x10 s7 (`corridorbody`), and `arena;w=2;h=3` at `branchy` 10x10 s10 and `winding` 14x14 s6. A caller that generates such a default level gets an uncaught `Error`, not a graded refusal. It is the solver's (U5–U7). The sweep records it as HARNESS-FAILED.
- **`roam` in the default places 0 of 14 per seed it drew,** in every sword biome. It is a 10/168 head on its own sweep, and its draws are mostly graded drops.
- **The acceptance batch's carrier obligation reads 0 of 3** at W0 and after. It is pre-existing: the carrier seeds were measured for retired kill *templates*. It is unchanged by this slice.
- **Not run:** `npm test` in-app modes (the substrates roster). No in-app test was in the import reach of the two changed modules (`PAGES (watch*) (0)`).

## Byte-inertia

| artifact | W0 `f4a4a28` | head |
|---|---|---|
| 15 md5s | `f8ae9918` seedling/AP_14089… · `2e3f74e1` atlas · `431fa72d` atlas_host · `279c9bb6` atlas_location · `5a208332` atlas_maze · `fa6a786d` atlas_sphere · `edebfa1f` generated_host · `f7db7bed` generated_leaf · `28efab18` generated_room · `b6f77113` generated_swim · `c4845373` playthrough/AP_1 · `a4ea094e` playthrough/AP_14089… · `443e3ca2` sphere_room · `cb8e5384` spiral_room · `ee80fe1a` concept_trial | **all 15 identical** (`diff` empty). The 10 the brief called non-generated, the 4 generated and `concept_trial`. |
| `concept_trial` | `ee80fe1a…`, `--check` OK | untouched, `--check` OK |
| six r8/r9 `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | identical, exit 0 |
| campaign census | — | exit 0, `⇒ NO CHAIN ROOM MOVES` |
| `fixtures/**` | — | `git diff f4a4a28` over every tracked fixture path = **0 lines** |
| presets tree | — | `git diff f4a4a28 -- frontend/presets` = 0 files |

No AS3, wasm, gitlink, tape, `campaign-frontier.json`, `standing-values --write`, `pytest` or unfiltered vitest was touched or run. No solver or simulation file was touched.
