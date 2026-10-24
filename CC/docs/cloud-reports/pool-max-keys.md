# `pool-max-keys` — `__max_*` limits written into `itempool_counts`

Cloud Opus build slice, 2026-10-02. Brief from `solver-derived-logic-planning`; defect found by
`unplaced-pool-starting` (its report §4 Q1).

- **Branch:** `claude/pool-max-keys-wbuojx` (the harness-designated branch; the brief's local name `pool-max-keys`
  was not used). Base `origin/main` = `4111a6824f` (as required).
- **Commits:** `4dd40884` (the fix + re-exported presets + regenerated worlds), `6cec5bb3` (regression test),
  `37b57d98` (docs). This report is the last commit on top of them.
- **Option chosen under the ruling: (c)**, the fix at the source. The new home already existed (see §2), so no new
  schema field was needed.

## 1. Readers measured (before building)

`rg -a "__max_" --glob '!frontend/presets/**'` over the whole repo, `frontend/modules/shared` included
(initialised at its pin `4e5a1e75`):

| reader | what it did with the keys | after the move |
|---|---|---|
| `exporter/games/base/world_data.py:77–83` `get_itempool_counts` | **the writer**: copied `world.difficulty_requirements.{progressive_bottle,boss_heart_container,heart_piece}_limit` into the pool as `__max_*` | no longer writes them (a comment there names the real home) |
| `frontend/modules/stateManager/stateManager.js:451–461` `initializeInventoryForTest` | copied them into `gameStateModule.difficultyRequirements`, but only when a test passes `excludedItems` | reads `this.rules.world[playerId].difficulty_requirements` (same three keys, same truthiness guard) |
| `frontend/modules/stateManager/stateManagerWorker.js:1119` | skipped `__`-prefixed pool keys | guard kept as a harmless defence; only its comment changed |
| `world_generator/_template_init.py:913–944` → generated `ITEMPOOL_COUNTS` | passed the keys through verbatim (`worlds/alttp_worldgen/__init__.py:120–122`, `worlds/alttp_vanilla_worldgen/__init__.py:122–124`); `create_items` then skipped them (`item_name not in item_table`). `_template_rules.py:263` also added them to `obtainable_items`, which was inert | nothing to change in world_generator: it never interpreted them. Both committed `_worldgen` worlds regenerated; the diff is exactly those 3 lines each |
| `frontend/modules/shared/**` (rule engine, snapshotInterface, game logic) | **no reader.** Rule helpers read `world.difficulty_requirements.*` from the world attributes (`snapshotInterface.js:481–490` merges `world[p]` into the world object), never from the pool | unchanged; no submodule bump needed |
| `apworldEditor/regionContent.js:873` `unplacedPoolItems`, `rulesUtils.js` `validateRules` | the **victims**: listed / flagged the keys as items | now see real items only; no code change |
| `docs/json/developer/reference/{state-snapshots,alttp-specific-data}.md` | documented the markers | updated |
| `scripts/vanilla-alttp/{vanilla_rules,AP_14089154938208861744_rules}.json` | historical analysis snapshots, read by no script (`rg` for `itempool_counts`/`_rules.json` in `scripts/vanilla-alttp/*.py`: 0 hits) | left as historical data |

`gameStateModule.difficultyRequirements` (the reader's target) feeds `snapshot.difficultyRequirements`
(`statePersistence.js:190`) → `snapshotInterface.getDifficultyRequirements` (`:820`), whose only mention elsewhere is a
commented-out example (`timerLogic.js:682`). So the reader has no live logic consumer, and its value is unchanged.

**Why the move is safe.** The pool keys were a *second copy*. In all 12 committed presets that carried them, each
`__max_X` equals `world[p].difficulty_requirements.X_limit` (measured: 12/12 OK, 0 mismatches). The exporter writes
`difficulty_requirements` as a world attribute for every ALttP world, including the `_worldgen` worlds
(`self.difficulty_requirements = types.SimpleNamespace(...)`). Nothing reads the pool copy that cannot read the world
copy, so every risk the ruling names for (a) is absent: no `shared` change, no ALttP logic reader, and every preset
is re-recordable in the cloud (≈8 s per seed).

## 2. The change

- `exporter/games/base/world_data.py`: drop the three `itempool_counts['__max_*'] = …` writes. The limits stay where
  they already were, `world[p].difficulty_requirements`. A new `game_info[p].pool_limits` field would have been a
  third copy of the same three numbers, so none was added and `rules.schema.json` is unchanged.
- `stateManager.initializeInventoryForTest`: reads the limits from `rules.world[playerId].difficulty_requirements`.
  This also works on old documents that still carry `__max_*`, because those have `world[p]` too.
- 12 presets re-exported, 2 generated worlds regenerated (§3), docs updated.

## 3. Presets moved: 12, all re-exported (not hand-edited)

`rg -a -l "__max_" frontend/presets` → 12 files, now 0:
`alttp/AP_{14089154938208861744,01043188731678011336,84719271504320872445}` (seeds 1–3),
`alttp_vanilla`, `alttp_worldgen`, `alttp_vanilla_worldgen` (seed 1), and
`multiworld/AP_{…}` seeds 1–3, each `_rules.json` and `_P2_rules.json`.

Method: first strip the three keys textually and save that as the *expected* file (12/12 parse and are JSON-equal to
HEAD minus the keys). Then re-export with the fixed exporter, using `Generate.py` alttp seeds 1–3, the WorldGen and
Vanilla WorldGen templates, the multiworld roster from `generate_all_templates.sh` (AHIT, ALttP, Adventure, Short Hike)
for seeds 1–3, and `scripts/vanilla-alttp/generate_incremental_yamls.py` + `generate_vanilla_alttp.py --seed 1`.
**Every regenerated `_rules.json` is byte-identical (`cmp`) to the expected file: 12/12.** Sphere logs were unchanged.
Regeneration also churned `.archipelago`, `.apadvn` and some `_Spoiler.txt` files (playthrough-path nondeterminism,
present with the old exporter too) and `preset_files.json`; all reverted. The final diff is the 12 `_rules.json` files
only, 48 deletions / 12 insertions (the trailing comma moves).

Hash sweep: no committed file pins a sha1/sha256 of any of the 12 files. The file list is unchanged, so no derived
roster changes.

## 4. Gates

| gate | result |
|---|---|
| world_generator → Generate.py round trip, `alttp_worldgen` and `alttp_vanilla_worldgen` seed 1 | regenerated world differs from the committed one **only** by the 3 `ITEMPOOL_COUNTS` lines; Generate.py on the regenerated world gives a `_rules.json` byte-identical to the committed (stripped) preset; sphere log unchanged |
| spoiler tests `--port=8190`: alttp seeds 1, 2, 3; alttp_vanilla; alttp_worldgen; alttp_vanilla_worldgen | **6/6 passed** |
| spoiler tests multiworld seeds 1, 2, 3 (default player 1 = AHIT) | **3/3 passed** |
| spoiler tests multiworld seeds 1, 2, 3 `--player=2` (the ALttP slot) | **3/3 red, baseline**: re-run with the HEAD~ `_P2_rules.json` and HEAD~ `stateManager.js` gives the *identical* failure (seed 1 sphere 12.8, 9 locations, GT Bottom/Teleport Room; seed 2 sphere 17.9, 4 locations; seed 3 sphere 14.7, 5 locations, GT Compass Room). Pre-existing, not this slice's; not investigated further |
| `test-substrates --batch=apworld` | **139/140**; the one red is `apworld-build-downloads-a-loadable-apworld` (pyodide CDN, the named cloud baseline) |
| pytest `test_rules_json_writer_agreement`, `test_world_generator_apworld`, `test_export_player_slicing`, `test_loop_costs_export_roundtrip` | **20 passed, 307 subtests**; tree clean after |
| bounded vitest: new `poolLimits.test.js` + `frontend/modules/apworldEditor/` | 29 files, **989 passed** |
| bounded vitest: every `*.test.js` mentioning `validateRules` / `unplacedPoolItems` / `initializeInventoryForTest` / `itempool_counts` | 16 files, **732 passed** (the 17th, `atlasMazeBot.slow.test.js`, is a slow-tier file the default config excludes) |
| the readout | over the 219 committed `_rules.json`, `unplacedPoolItems` `__max_*` rows: HEAD~ **36 rows / 456 units in 12 docs** → **0**. The brief's "497" was not reproduced; this count is per (doc, player, key) row at HEAD~ |

Python `get_itempool_counts` has no direct unit test; the exporter mutant below covers it end to end.

## 5. Mutants

- **Exporter:** `world_data.py` restored to HEAD~, then alttp seed 1 re-exported. The `_rules.json` regains
  `"__max_boss_heart_container": 10, "__max_heart_piece": 24, "__max_progressive_bottle": 4` (+4/−1). Restored afterwards.
- **Reader:** `stateManager.js` restored to HEAD~ with the new preset. `difficultyRequirements` comes back `{}` instead
  of `{bottle 4, boss hearts 10, pieces 24}`, and `poolLimits.test.js` fails (1 failed / 1 passed). Restored afterwards.

## 6. Left as is / for the planner

- `stateManagerWorker.js:1119` still skips `__`-prefixed pool keys. It is dead for exported docs, but cheap protection
  against hand-written docs.
- The multiworld `--player=2` spoiler reds (§4) are pre-existing and unrelated to this change. They may be worth a
  slice: the ALttP slot of the multiworld presets fails in Ganon's Tower on all three seeds.
