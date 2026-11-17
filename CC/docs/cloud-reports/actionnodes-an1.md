# ActionNodes AN-1 — the headless core (as built)

Slice AN-1 of the ActionNodes substrate (content sets arc), session `actionnodes-an1` (Opus 5.5), 2026-11-15.
Branch `actionnodes-an1`, rebased onto origin/main `ca966accde`. Design: the `actionnodes-design` session's
substrate design (§10 Slice 1), the ActionNodes rulings A1–A17, the Z.7 provenance shape, and the 2026-11-15
rulings on the design's questions (low-mana start allowed; logic derived by exact one-loop search; the verb is
`act`; each item's starting-mana boost configurable, default 10). The developer page is
`docs/json/developer/procgen/action-nodes.md`.

Nothing is playable in the browser yet: that is slices 2 and 3.

## What was built

| File | What |
|---|---|
| `frontend/modules/actionNodes/actionGraph.js` | The `action-graph` document and `validateActionGraph` / `assertActionGraph`. Every refusal named (`ACTION_GRAPH_REFUSALS`); monotonicity enforced by shape; the v1-excluded forms refused by their own names; Z.7 provenance checked for presence and form; `resolvedBoostOf` (the one place the mana default is applied). |
| `actionModel.js` | One loop as a count vector: `loopStartState`, `whyNot` (named refusal codes: `loop-over`, `not-reached`, `limit`, `stat`, `resource`, `mana`), `perform`, `applyBoost` (A4: at once), `describePlan`. |
| `actionSearch.js` | `enumerateLoop` (exhaustive BFS, fewest-performance plans), `itemCombinations`, `minimalCombinations`, `deriveActionLogic`; state and combination budgets refuse by name. |
| `actionGraphCompiler.js` | `compileActionGraph` → `{rules, report}`; `actionNodesBlockOf`; `placementsFromRules`. |
| `actionPlanner.js` | `planLoop` (A17 with reasoning lines), `orderForMana`, `livePrices`, `manaShortfall`, `playToGoal`. |
| `actionNodesLibrary.js` | The registry entry (data half). |
| `graphs/example-village.json` | The example graph, with its provenance block. |
| `scripts/procgen/action-nodes-compile.mjs` | Compile CLI; with no graph it compiles the example to the committed preset; `--check` is a byte-identity gate. |
| `scripts/procgen/action-nodes-play.mjs` | The headless bot: plays a compiled world to its goal, prints every loop with its reasoning, at the graph's XP scale and at 0. |
| `frontend/presets/action_nodes_example/AP_1/AP_1_rules.json` | The committed preset; `preset_files.json` row with `"seed": 1`. |

Edited: `rules.schema.json` (top-level `action_nodes` per-player key; `actions` and `xpGainScale` on a `loop_costs`
region entry), `procgenCore/apIdNamespaces.js` (row `action-nodes`, base 40000000 for both spaces),
`procgenCore/substrateLibraries.js`, `procgenCore/substrateCapabilities.js` (L6 no longer universal; see below),
`scripts/procgen/reference/docsIndex.mjs` (the reading order), `substrate-registry.md` (hand-kept annotation row),
the regenerated reference modules and markdown regions, and four tests that pin rosters (below).

Not touched: any generator file, the maze engine's import closure (`--print-engine-closure` identical at base and
tip, 43 lines), every submodule.

## The graph format as built

The design's §1 format, plus:

- **`kind: "action-graph"`** at the top (the design names the kind; its example omitted the field). Required.
- **`provenance`** (Z.7): `sources` (each `{type, …}` with that type's fields), `default`, optional per-entry `src`
  on a node or boon.
- **`filler`** (optional): the boon id that fills check locations the boons do not. A pool larger than the check
  count is `item-pool-overflow`; smaller with no filler is `item-pool-short`.
- **`gives.mana`** on a boon is the per-item starting-mana boost; absent → `DEFAULT_MANA_PER_ITEM` (10).
- `settings` defaults: `xpGainScale: 1`, `xpEffect: "cost"`.

The start node: `kind: start`, `time: 0`, no `requires`/`results`/`after`. It is CLEARED from the beginning and is
never performed (its exits are open in every loop, as the design's start gate says).

### The example graph

```json
{
  "kind": "action-graph", "schema_version": 1, "graph_id": "example-village", "name": "The Village",
  "provenance": {
    "sources": {
      "actionnodes-design": { "type": "model", "model": "claude-fable-5-2", "date": "2026-11-15",
        "session": "actionnodes-design",
        "approved": { "by": "Robert", "date": "2026-11-15", "ruling": "A14: accepted for initial testing, details adjustable" } },
      "do-chores-change": { "type": "model", "model": "claude-fable-5-2", "date": "2026-11-15",
        "session": "actionnodes-design", "note": "Do Chores made repeatable (5 mana, Gold +3, limit 2); …" },
      "an1-boost-mana": { "type": "model", "model": "claude-opus-5-5", "date": "2026-11-15",
        "session": "actionnodes-an1", "note": "… AN-1 set `gives.mana: 0` explicitly …" }
    },
    "default": "actionnodes-design"
  },
  "loop": { "mana": 100 },
  "stats": { "strength": { "name": "Strength" }, "knowledge": { "name": "Knowledge" } },
  "resources": { "gold": { "name": "Gold" }, "bread": { "name": "Bread" } },
  "boons": {
    "strength-boost": { "name": "Strength Boost", "count": 1, "gives": { "stats": { "strength": 1 }, "mana": 0 }, "src": "an1-boost-mana" },
    "pocket-money":   { "name": "Pocket Money",   "count": 1, "gives": { "resources": { "gold": 5 }, "mana": 0 }, "src": "an1-boost-mana" }
  },
  "start": "start",
  "settings": { "xpGainScale": 1, "xpEffect": "cost" },
  "nodes": { "…": "the design's §9 ten nodes, unchanged; do-chores carries src do-chores-change" }
}
```

Its numbers are *use the table as written* (Z8): hand-made content, nothing reassigns them.

## The derived rules and the sphere log (the committed preset)

`action-nodes-compile.mjs` output:

```
graph example-village: 4 item combinations, at most 64 states each
  check Guard's Locker: True
        witness {}: Do Chores ×2 → Bribe the Guard → Guard's Locker (55 mana left)
  check Move the Boulder: True
        witness {}: Train → Move the Boulder (40 mana left)
  goal  Leave the Village: Has(Strength Boost)
        witness {"Strength Boost":1}: Do Chores ×2 → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village (5 mana left)
  sphere 0: 2 open — Guard's Locker, Move the Boulder
  sphere 1: 1 open — Leave the Village
  A6: every check earnable, sphere log reaches the goal
OK: frontend/presets/action_nodes_example/AP_1/AP_1_rules.json is byte-identical to the compiled graph
```

Every exit rule is `True`. Placement (seed 1): Move the Boulder → Strength Boost (progression), Guard's Locker →
Pocket Money (useful: no derived rule names it). Ids: locations and items from 40000000, by sorted name.

The embedded sphere log (`generateSphereLog`; it lists ADVANCEMENT pickups only, so the Locker's useful item is not
a pick):

```
{"type":"metadata","seed":1,…}
{"sphere_index":"0", "new_accessible_locations":["Guard's Locker","Move the Boulder"], "sphere_locations":[]}
{"sphere_index":"0.1","base_items":{"Strength Boost":1},"new_accessible_locations":["Leave the Village"],"sphere_locations":["Move the Boulder"]}
{"sphere_index":"1.1","base_items":{"Victory":1},"sphere_locations":["Leave the Village"]}
```

## The A6 proof

`procgen_metadata[1].action_logic.a6`: `every_check_earnable: true`, `sphere_log_reaches_goal: true`,
`sphere_log_advancement_picks: ["Move the Boulder", "Leave the Village"]`, and the per-sphere open counts walked over
the derived logic itself (all locations, so the useful-item check is counted): sphere 0 has 2 open, sphere 1 has 1.
Refusals by name: `check-never-earnable`, `node-never-reached`, `goal-not-in-logic`, `fill-failed` (tested).

## The bot's reasoning (`action-nodes-play.mjs`, the committed preset)

```
=== xpGainScale 1 ===
Loop 1 [checks]: Do Chores → Do Chores → Bribe the Guard → Guard's Locker → Train → Buy Bread → Eat Bread → Move the Boulder → Read the Notice → attempt Leave the Village
  checks: Guard's Locker, Move the Boulder; received: Pocket Money, Strength Boost
  | Chose: Do Chores ×2 → Bribe the Guard → Guard's Locker, earning Guard's Locker (55 mana left).
  |   Move the Boulder: short by 5 mana after Guard's Locker (alone: Train → Move the Boulder, 40 mana left).
  | (replan) Chose: Train → Buy Bread → Eat Bread → Move the Boulder, earning Move the Boulder (20 mana left).
  | (replan) No check can be earned this loop. Closest: Leave the Village, short by 30 mana (Read the Notice → Leave the Village).
  | (replan) Spending it for region XP: Read the Notice, then attempting Leave the Village with 10 mana.
Loop 2 [goal]: Do Chores → Do Chores → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village
  checks: Leave the Village; received: nothing
  | Goal reachable: Leave the Village via Do Chores ×2 → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village (8 performances, 5 mana left).
xpGainScale 1: goal in 2 loop(s)
xpGainScale 0: goal in 2 loop(s)
```

The design's "loops-to-goal at scale 1 and 0" question: 2 and 2. Region XP does not matter on this graph; it gives
no evidence for lowering the scale. `actionPlanner.test.js` also plays every other placement of the boons to the
goal.

## The per-item mana field

- **Where it lives:** the graph's `boons.<id>.gives.mana` (default `DEFAULT_MANA_PER_ITEM` = 10, the constant the
  global setting uses), compiled into `action_nodes[p].boosts.<item name>.mana`, every row stated, plus
  `action_nodes[p].mana_per_item_default: 10`.
- **Beside the global setting:** today `gameState` adds a flat `manaPerItem` (10) per received item when
  `includePerItemMaxMana` is on (`gameState/state.js` `_recomputeMaxMana`). The `action_nodes` block's description
  (schema) and `actionNodesBlockOf` state the contract for slice 2: while an ActionNodes world is loaded the
  runtime takes each received item's mana from `boosts` INSTEAD of the flat term, so with every row at the default
  the two agree exactly. Nothing changes for other substrates; no gameState code changed in this slice.

## Roster enrolment (a new committed preset)

| What | Result |
|---|---|
| Every non-slow vitest file naming `frontend/presets`, `preset_files` or the presets root (212 files) | 201 passed. 9 file-level and 1 test failures are `ENOENT …/flashPanel/wasm/builds.json`: this worktree has no wasm submodule checkout (created without `--with-wasm`), not this slice. 1 real one, fixed: `exitSides.test.js` T1 requires a side-less exit to carry NO `side` key, so the compiler writes none (it wrote `side: null`). |
| The slow tier's preset files (`locationCapacity.slow`, `presetDefs.generate.slow`, `atlasMazeBot.slow`, `sphereZeroCredit.slow`, `omsiTestPresetProducers.slow`, two Seedling gen slow rows) | 7 files, 102 tests passed. |
| `check-sidecar-fields.mjs` | ALL PASS, 2264 entries over 10 substrates (`action_nodes` 10), 0 issues. |
| `check-canonical-placements.mjs`, `census-soft-locks.mjs`, `check-worldgen-package-sidecars.mjs`, `ruleKindCensus.js` | pass / exit 0 (ruleKind: 227 preset files, no unhandled kinds). |
| `pytest test/general/test_schema_validation.py test/test_register_preset_seed_field.py` | 12 passed, 466 subtests (every preset against the schema). No tree dirt. |
| `generate-procgen-reference.mjs --check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH. |
| `check-procgen-docs.mjs` | ALL CHECKS PASSED. |
| `action-nodes-compile.mjs --check` | byte-identical. |
| **Found by CI at the first push (`761167d041`)**: the headless gate `procgen-help` (`check-procgen-help.mjs`) | both new CLIs did their work at module scope, so a bare import compiled/played. Fixed: the body is a `main()` behind the direct-run guard; `--in-place --only=` PASS for both (HELP ok, IMPORT ok). |
| **Found by CI**: `quickLaunch/generated.test.js` | a new procgen doc enrols in the Quick Launch help index too. Regenerated (`scripts/quicklaunch/generate-docs-index.mjs`); `quickLaunch/` + `procgenDocs/` 15 files, 609 tests pass. |

Tests the slice moved, each with its reason in the file: `jsonSchemaCheck.test.js` (the region entry's property
list gains `actions`, `xpGainScale`), `sidecarFieldsRegistry.test.js` (the sides law gains a fourth DERIVED
population: entries with no realiser hook, whose regions a standalone compiler writes), `substrateCapabilities.test.js`
(L6 follows the declaration instead of "every entry ✓"), `docLinks.test.js` / `docsRender.test.js` (census
421 → 428: the new page's index row, its 5 links out, the registry row to it).

## The spoiler run

`npm test -- --port=8150 --wait-for-box=1800 --mode=test-spoilers --game=action_nodes_example --seed=1` (box lock
free; server on 8150 from the worktree, stopped by PID after): `test_spoiler_full_run PASSED 2.6s`, 1 passed. It
loaded `./presets/action_nodes_example/AP_1/AP_1_rules.json` (stateManager's `sourceName`), and compared the
preset's own embedded log: `testLogPath: …/AP_1_rules.json#sphere_log`, `totalEvents: 3, processedEvents: 3,
errorCount: 0`.

## Test paths

`frontend/modules/actionNodes/actionGraph.test.js`, `actionSearch.test.js`, `actionGraphCompiler.test.js`,
`actionPlanner.test.js` (49 tests). Plus the moved rows above.

## What the code overturned

1. **The default-10 ruling breaks the example's puzzle.** With +10 starting mana per item, holding the Strength
   Boost gives 110, and Train → Read the Notice → Move the Boulder → Leave the Village costs exactly 110: the goal no
   longer needs the bread (measured). The example states `gives.mana: 0` on both boons (the ruling makes the value
   configurable), recorded under its own provenance source `an1-boost-mana`. Then every number in the design's §9
   table holds. One line to revert if the user prefers the default in the example; the preset regenerates.
2. **Items received mid-loop change "no loop earns both checks".** A4 applies a boost at once, so with Pocket Money
   behind the Locker the bot earns the Locker, gets 5 gold, buys and eats the bread and earns the Boulder in the
   same loop. The design's wrong-turn property holds with no items (tested); the bot replans after every item.
3. **States per combination: 64, not 65.** The start node is cleared from the beginning and never performed, so
   there is no "Start performed" state.
4. **The forward simulator's sphere log lists advancement pickups only**, so the design's "two spheres: the two
   checks, then the goal" appears in the log as Boulder then goal; the per-sphere open counts are computed from the
   derived logic instead.
5. **Exit rules are "the node this exit leads to is reached"**, not "the source is clearable": the same for
   single-member `after` sets, exact for multi-member ones.
6. **The registry entry declares no `loopSupport`, `sharing`, playback controller, `layoutGraph` or
   `rulesJsonBlocks`.** Each is a capability claim with no code behind it in this slice (`sharing.stats/resources`
   is not even a category the validator knows). So the capability chart's L6 ("A Bot block can play it") is no
   longer universal: ActionNodes is its one ✗ until slice 3. Slice 2 declares `loopSupport`/`sharing`; slice 3 the
   Bot and controller.
7. **A planner defect the tests found:** the search keeps one path per state, so a "least short" plan could be
   ordered to run dry before Eat Bread. `orderForMana` reorders a plan's performances (affordable, best net mana
   first; target last), and ties in shortfall prefer the plan that runs furthest.

## Next slice's line

AN-2 (runtime, the `act` verb with its start gate, the ledger and Resources panel, `xpGainScale`): it consumes
`action_nodes[p]` (including `boosts[*].mana` in place of the flat per-item term) and `loop_costs[p].regions[*].actions.act`,
and declares `loopSupport` / `sharing` on the entry; the shared-submodule `sharing` categories and the `authored`
cost class are its. The pack-layer slice re-merges after this lands (the doc-link census will collide).
