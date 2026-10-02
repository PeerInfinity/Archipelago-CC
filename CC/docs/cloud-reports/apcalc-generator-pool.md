# `apcalc-generator-pool`: the in-browser APCalc generator now pools its starting buttons

Cloud slice, 2026-10-02. Base `origin/main` @ `d47baf6f6f` (contains `d47baf6f6f`). Harness-designated branch:
**`claude/apcalc-generator-pool-starting-items-bfdhzs`** (the brief's `apcalc-generator-pool` branch name was not
used; the harness pushes only to its own branch). Fix commit `87cb1f71`; this report is the last commit.

**Outcome: FIXED.** The change is one narrow fix in one function (`exportRulesJson`). Its only producer-side caller is
the generator panel, and no committed preset comes from it.

## 1. Diagnosis

- `frontend/modules/apcalcGenerator/apcalcGeneratorEngine.js:889–896` builds `poolCounts` from the **placed** items
  only (each node's `node.item`). The starting buttons (`startingButtons`, built at `:840–842` from the layer-0
  sphere-0 nodes' values) are separate.
- `:995` (before the fix) copied `poolCounts` straight into `itempool_counts`, with events and Victory added. That
  left out the starting buttons. They did reach `starting_items` (`:999–1002`) and `items[].max_count` (`:972`
  already used placed + starting). So within one document, `max_count` and the pool disagreed.
- The contract is in `exporter/games/base/world_data.py:51`: `get_itempool_counts` = precollected + placed. On the
  other side, `world_generator/_template_init.py:899–944` builds `ITEMPOOL_COUNTS` = `itempool_counts −
  _always_placed − starting_items`. world_generator therefore subtracted starting copies that had never been in the
  pool, and the pool came up short of the locations by the starting buttons that also appear in the placed set.
  Starting buttons with no placed copy clamp at 0 and are dropped.
- This is where the information was lost, so this is where the fix goes. It follows the same pattern as the procgen
  compile fix (`8ded9c53fb`).

## 2. Measurement: before and after

Driver: the engine run headless in Node (`generate()` → `exportRulesJson()`), the same way
`rulesJsonWriters.test.js` drives it. Each round trip: `python -m world_generator <doc> -o <scratch> --game-name
"APCalc GenPool" --force --canonical-seed 1`. The world was copied into `worlds/` only for the run. `Generate.py` ran
with a scratch `--player_files_path`/`--outputpath` and `< /dev/null`. After each run the world dir and the
auto-created `frontend/presets/apcalcgenpool_tmp/` were removed and `preset_files.json` was reverted. `git status`
was checked clean after every run (only the intended source edit). The `zilliandomizer` ModuleNotFoundError in the
logs is unrelated world-loading noise and appears in every run.

Two configs: **A** = the `rulesJsonWriters.test.js` config (seed 1, 3 spheres, 20 locations, 5 starting buttons)
and **B** = the panel's `DEFAULT_PARAMS` (seed 42, 8 spheres, 68 locations).

| doc | Generate seed 2 | Generate seed 3 | seed 1 (canonical) |
|---|---|---|---|
| A before | `Filling … 19 items` → `FillError: Unable to fill all locations. Unfilled locations(1)` | same, 19 → FillError | — |
| A after | `Filling … 20 items` → `Done. Enjoy.` | 20 → `Done.` | `… 0 items` → `Done.` |
| B before | `Filling … 66 items` → `FillError … Unfilled locations(2)` | 66 → FillError (2) | — |
| B after | `Filling … 68 items` → `Done.` | 68 → `Done.` | — |

**Fixed-point check** (the exporter's re-exported `itempool_counts`/`starting_items` against the generator's):

- A after vs exports at seeds 1, 2 and 3: pool **EQUAL**, starting **EQUAL** (all three).
- B after vs exports at seeds 2 and 3: pool **EQUAL**, starting **EQUAL**.
- A before vs the seed-2 export: **DIFFERS** `{Button: 1/2/7/8: (none, 1), Button: 3: (1, 2)}`. These are exactly
  the 5 starting buttons.

## 3. The change

`apcalcGeneratorEngine.js` `exportRulesJson`: after `itemPoolCounts = { ...poolCounts }`, add each
`startingButtons[label]` count to `itemPoolCounts[buttonItemName(label)]`, with a comment citing the contract (+9
lines). Nothing else moves: regions, items, `max_count`, `starting_items` and slot_data are byte-for-byte as before.
Only the button entries of `itempool_counts` gain the starting copies.

New test: `frontend/modules/apcalcGenerator/apcalcGeneratorEngine.test.js` (2 rows, configs A and B). It pins
non-event pool = placed + starting, world_generator's view (pool − starting) = the location count, and
`max_count ≥ pool`.

## 4. Consumers checked (`rg -a "itempool_counts"`, `rg -a "apcalcGenerator"`)

- **The panel itself** (`apcalcGeneratorUI.js:303`) only stores, downloads, or loads the document. It does not read
  the pool.
- **Loading the output into the app** goes through stateManager `initialization.js:201` (`sm.itempoolCounts`). That
  pool is only used for the test-mode base inventory (`stateManagerWorker.js:1083`, `stateManager.js:438`). It now
  matches every exporter-produced preset, the committed `apcalc` presets included. Before the fix, that inventory
  was missing the starting copies.
- **APWorld editor** (`regionContent.js:854–900` `unplacedPoolItems`, `rulesDocOps.js`) already assumes the
  exporter contract and subtracts `starting_items`. Before the fix, it would have shown 0 or a negative for each
  starting button. It is now consistent.
- **No committed preset** comes from this generator, and no committed file is regenerated. Byte-neutral apart from
  the two intended files.
- `storageCensus.test.js` names `apcalcGenerator_params` only as a localStorage key, so it is unaffected.

## 5. Gates

- Bounded vitest: `npx vitest run frontend/modules/apcalcGenerator/apcalcGeneratorEngine.test.js
  frontend/modules/presets/rulesJsonWriters.test.js` → **2 files, 6/6 passed**. `rulesJsonWriters.test.js` is the
  only other test that calls `exportRulesJson`/`generate`, and it pins the writer's bytes, not counts, so it needed no
  update. No test pinned the old counts.
- **Mutant:** I replaced the engine with the `HEAD`(pre-fix) version. The new test went **2/2 red** (`expected {…}
  to deeply equal {…}` on the pool), and the doc-B round trip (made with that mutant engine) went back to
  `FillError … Unfilled locations(2)` at seeds 2 and 3. The fixed engine was restored afterwards.
- The suite number comes from CI after merge (⚖ ruling 52). pytest was not run: no Python changed.
- No spoiler test: this generator has no committed preset to run one against.

## 6. Risk assessment

Low. The edit is confined to `exportRulesJson`'s pool assembly, which has one product caller (the panel) and one
test caller. It changes only the `itempool_counts` button entries, and in the direction every downstream reader
already expects.
