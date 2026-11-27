# AN-TIME-1 — time windows, a clock and knowledge in the ActionNodes headless core (as-built)

Session `actionnodes-time-design` (Opus), 2026-11-25, for planner `concept-library-content-planning-5`. Branch
`an-time1`, base `origin/main` `73c96473f5`. Code commit `8c909c4332`; this report is the commit after it. The design is
the AN-TIME-D session's own (`actionnodes-time-design`, in the planning notes).

**Robert's rulings** (2026-11-25, collected before 03:56:16Z by liaison-5), verbatim where they bear on this slice:
- *"Yes to Q1, Q2 and Q3 (Recommended)"*:
  - a window counts from the time spent this loop;
  - an early arrival waits and pays the time;
  - starting before the window closes is enough.
- *"Yes to Q4 and Q5 (Recommended)"*:
  - an item may add time at the end, never move the start;
  - a timed world has no region XP.
- *"Yes to Q8 and Q9 (Recommended)"*, then *"Bring them forward (Recommended)"*: knowledge gates move into the build,
  compiled as event items.

## What changed

| File | Change |
|---|---|
| `actionNodes/actionGraph.js` | The format. Node `window: {from?, until?}`; graph `clock: {start, minutesPerUnit}` and `knowledge: {<id>: {name}}`; `requires.knowledge`, `results.learns`. New refusals: `bad-window`, `window-on-start`, `bad-clock`, `unsupported-earlier-start` (a boost part `earlier`/`clock`/`start`), `unknown-knowledge`, `knowledge-never-learned`. A knowledge id may not be a boon id; each flag's event-item name is claimed like any item name. `isTimedGraph`, `hasWindows`, `TIMED_GRAPH_SETTINGS` (`{xpEffect: 'none'}`), `knowledgeItemNameOf`, `knowledgeLocationNameOf`. |
| `actionNodes/actionModel.js` | `state.clock` (time spent: prices + waits) and `state.known` (0/1 per flag). `whyNot` adds `knowledge` and `too-late` between the resource checks and mana, and adds any wait to the price. `waitOf`, `waitNote`, `formatClock`, `applyKnowledge`. `itemVectorOf` is boons then flags. Every new field read defaults, so a runtime-built model (no windows, no knowledge) behaves as before. |
| `actionNodes/actionSearch.js` | A windowed graph is walked layer by layer, keeping the earliest clock (then the most mana) per count vector. A windowless graph takes the old walk untouched. `itemCombinations` adds a 0/1 dimension per flag; `logicDimensionsOf`, `logicItemNamesOf`; `combinationByName` names flags by their event item. |
| `actionNodes/actionGraphCompiler.js` | Event locations `<node> (learns <flag>)`: no id, locked, the node's perform rule. They hold the event item `Knows: <flag>`, which is in the items table (`id: null`, `event`, `Event`) and `itempool_counts`, the shape alttp's events have. `closeKnowledge` makes the fill's and the sphere report's in-logic test close over events. `progressionOf(logic, model)` leaves out event dimensions. The payload gains `window`, `requires.knowledge`, `results.learns`; the block gains `clock`, `knowledge`; `action_logic.knowledge` reports each event. Each is written only when present. |
| `actionNodes/actionPlanner.js` | A `learn` loop (`PLAN_KINDS.LEARN`): no check this loop, but needed knowledge can be learned. The cone keeps the nodes that teach a needed, unknown flag. `manaShortfall` / `affordablePrefix` / `orderForMana` add waits. The `orderForMana` defect is fixed: the target is now checked after a reorder, falling back to the BFS order. Reasoning lines name waits (windowed graphs only). `playToGoal` keeps learned flags across loops. |
| `actionNodes/actionNodesLibrary.js` | `window` sidecar field; `requires.knowledge` and `results.learns` in the schema. `apLocationNamesOf` also names a node's event locations, so the sidecar cross-check agrees with the region's locations. |
| `frontend/schema/rules.schema.json` | `action_nodes[p].clock` and `.knowledge` (the block is `additionalProperties: false`). |
| `actionNodes/fixtures/harbour-morning.json` | An original timed toy: 7 nodes, `clock` 09:00 at 60 min a unit, a day of 8, windows on 5 nodes, an item that adds an hour. |
| `actionNodes/fixtures/visits-day.json` | The STRUCTURE of the mystery miniature's visits under neutral names (Visit A–E, Paper A–E): costs 1/1/2/1/1, one same-day `after`, three knowledge gates, a day of 3. The goal stands for the question. |
| `actionNodes/actionTime.test.js`, `actionTimeLogic.slow.test.js` | The pins (§4). |
| `docs/json/developer/procgen/action-nodes.md` (+ the regenerated `README.md`, `substrate-registry.md`, `procgenDocs/generated/{registry,docsIndex}.js`) | A section "Time windows, the clock and knowledge", and the table, validator, model, search and planner lines. Its cross-references are plain prose, so the docs link census is not moved. |

## 1. What the mystery owner said (quoted, for the format)

`mystery-planning` (uds `718286.sock`), on The Same Monday as built:

- **Q1** *"every paper is (a): a visit's own result … 'Read' means read to its end … Reading is … free … for the logic
  you can treat it as 'visit X has been made on some day'."* So each visit `learns` its own flag. A gate
  `needs.read: [X]` becomes `requires.knowledge: [read-X]`.
- **Q2** *"A question is solved only on the page … `needs.solved` … is used by no case … A flag set from outside is the
  right shape."* Not built. `applyKnowledge` is the model's hook for a flag from outside the graph; giving it a logic
  source is AN-TIME-2's or later.
- **Q3** *"From any time, the same day included"*: what the model does (a flag learned earlier this loop counts).
- **Q4** *"Until they answer, neutral names are the safe course."* The fixture uses neutral names and the case's
  structure only.

## 2. Byte identity

- `node scripts/procgen/action-nodes-compile.mjs --check`: `action_nodes_example/AP_1` is **byte-identical**.
- The omsi town preset is not on main yet; it is on `an-omsi2`, `775449f1b3`. Its graph and preset were copied from
  that commit and compiled with this branch's compiler by its recipe (`--seed 3`, `graph_path` as recorded). The result
  was **byte-identical** (`cmp`). It is re-proved after the one merge of AN-OMSI-2's landed main (§7).
- Why: every new key is written only when the graph has it. `itemVectorOf` and `itemCombinations` produce the old
  vectors with no knowledge. A windowless graph takes the old walk (`model.windowed` false). Reasoning lines add a wait
  note only on a windowed graph.

## 3. Measured on the fixtures

| | harbour-morning | visits-day |
|---|---|---|
| item combinations (logic dimensions) | 8 (3 boons) | 64 (1 boon + 5 flags) |
| rules | the Ledger `Has(Harbour Pass)`; every other target `True` | the answer `Has(Knows: Paper C)`; every visit `True`: A and B fit the answer's day, but C needs B the same day and takes 2, so 1 + 1 + 2 > 3 |
| `playToGoal` | 1 loop; its first line: *"… Watch the Ferry Come In waits 2 (opens 12:00)."* | 4 loops (A·B·D, E, B·C, the answer). The bot takes the most new checks per loop (A17). The case's own shortest play is 2 days; the bot is not shortest-first, by the A17 ruling |

The order trap (four nodes in `actionTime.test.js`): `w` (opens at 2, pays 5 back) and `z` (2 long) both before `t`
(closes at 3). The walk finds `z → w → t`. With the plain counts key it keeps the first path to `{w, z}`, which is
`w → z` at clock 5, and loses `t`. `orderForMana` would put `w` first for its mana; it now keeps `z → w → t`.

## 4. Pins and their mutations

`actionTimeLogic.slow.test.js` (slow tier, ~6 s): 400 random valid graphs, 5–7 nodes, windows on about half, two
knowledge flags, two boons. The generator's own row checks that over 100 graphs have a `from` and over 100 require
knowledge.

| Row | Claim | Result | Its mutation |
|---|---|---|---|
| 1 | the REAL search is upward-closed in boons + knowledge (exact == minimal sets) | 0 of 400 broken | 3a: the time-LEFT reading (reference) → **47** of 400 non-monotone (asserted > 10); 3b: an item starting the clock earlier → **17** (asserted > 10) |
| 2 | the REAL search equals a full-state reference (key counts\|clock\|mana\|known) | 0 of 400 differ | 3c: the real search with the plain counts key (`windowed: false`) → **5** of 1,000 differ (asserted > 0; AN-TIME-D measured 5 too) |
| 4 | the relevance cone's least shortfall equals the whole walk's (250 graphs × combinations × targets) | 0 differ | 3d: "no wait" (an early start refused), reference E1 → **232** (graph, combination, target) cases where the cone loses a target the whole walk finds (asserted > 0). Also by hand: deleting the cone's new knowledge line turns row 4 red |

Of the 400 graphs, 279 have a node with `from` > 0 and 324 require knowledge (the generator's row asserts > 100 each).
Counts measured by running the file's own bodies with a printing `expect`.

`actionTime.test.js` (default tier, 28 tests):
- every new refusal by name;
- the timed default and that explicit settings win;
- the clock, the wait, the start-decides rule and the texts (*"too late: after 10:00 (it is 11:00)"*, *"short by 2 mana
  (waits 3, opens 12:00)"*, *"needs to know Paper A"*);
- a bare runtime-shaped model unchanged;
- the order trap and its mutation; `orderForMana`; the `learn` kind;
- the event locations and items, the payload and block keys;
- both fixtures schema-valid, with their payloads matching the declared sidecar fields and the carrier;
- the fill never places an event; the sphere log collects events; both fixtures play to the goal.

## 5. Gates (local, at `8c909c4332`)

- Bounded vitest: `frontend/modules/actionNodes/` default 13 files / 194 tests pass. The slow tier passes:
  `actionTimeLogic.slow` 8/8 and `actionNodesTownScale.slow` 11/11.
- `frontend/modules/procgenDocs/` + `scripts/procgen/checkSidecarFields.test.js`: 9 files / 505 tests pass. The link
  census is unmoved, because the doc's new cross-references are prose.
- The wider bounded set (discovery, packStructure, playbackBot, apworldEditor, resourceChannels, contentPacks, procgenCore,
  loops, procgenPipeline, `scripts/procgen`): 8,454 pass, 2 fail + 1 suite, all outside this diff.
  - `mazeInputOutputSplit` was a timeout under parallel load; 9/9 alone.
  - The `regionIntroduced` hook was a timeout; 16/16 alone.
  - `probeSeedlingErRetarget` needs `flashPanel/wasm/builds.json`, which this worktree lacks (no `--with-wasm`).
- `generate-procgen-reference.mjs --check`: all 7 modules and 5 regions match (regenerated: `registry.js`,
  `docsIndex.js`, two README/registry regions). `check-procgen-docs.mjs`: ALL CHECKS PASSED.
- `check-sidecar-fields.mjs`: ALL PASS, 2433 entries over 10 substrates.
- Gitlinks in the diff: 0.
- Maze engine closure (`seedlingDerivedRuleTable.js --print-engine-closure`): 43 lines, sha256 prefix
  `a3565f4e6866438e`; closure ∩ diff = ∅.

## 6. CI at `8c909c4332` (the code commit; all success)

| Workflow | Run | Result |
|---|---|---|
| unittests (push) | 45547574450 | success: Python 3.11 ubuntu-24.04, hosting 3.13 |
| JavaScript Unit Tests (push) | 45547574155 | success. `ci-vitest-summary`: suite **30152/0** (3 shards: 10296 + 10362 + 9494), slow battery **468/0**. Producer --checks, headless procgen gates and every browser gate shard: success. Train tier skipped: no `*.train` file was added |
| Test ALTTP Spoiler & Frontend Regression (dispatch) | 45547686456 | success. HEADROOM OK: fast 318.2 s (53%), fast bundled 323.9 s (54%), playback-bot 192.8 s (32%). The an-* rows 13/13 PASSED on both boots; the playback-bot an-* row 1/1. The apworld, seedling-wasm, seedling-js and seedling-js-solver batches: success |
| Substrate tests — manual batches, `feature-checks` (dispatch) | 45547689297 | success, HEADROOM OK 74.3 s (12%) |

## 7. The merge of AN-OMSI-2's landed main

(pending the planner's main SHA)

## Not in this slice, for AN-TIME-2

- **The runtime knows neither windows nor knowledge yet.** `runtimeModelOf` reads neither, and the gate does not
  check them. In the app, a stateManager event location is collected as soon as its rule holds. So a `Knows:` event
  would be HELD by the app's inventory before the player performs the node. The runtime must keep its own learned set
  (from `perform`) for its gate, and leave the event items to the logic.
- **The wait in the Loops queue** (a `wait` verb priced by params, with no region-XP discount); the clock in the node
  card and the Resources panel; the pool-name labels (the design's 24 strings).
- **The "completed before" marker and the minimal history** (Robert's Q6 ruling).
- `needs.solved` (a flag from outside) has a model hook (`applyKnowledge`) and no logic source.
