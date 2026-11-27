# AN-OMSI-1 — the ActionNodes engine fixes a town-sized graph needs (as-built)

Session `an-omsi1` (Opus), 2026-11-24, for planner `concept-library-content-planning-5`. Branch `an-omsi1`, base
`origin/main` `fd65b004a8`. Code commit `b17370c25d`; this report is the commit after it.

**Robert's rulings** (2026-11-24, before 17:22:27Z): Q1–Q7 of the AN-OMSI-D design, all as recommended. Q7: *"Launch
AN-OMSI-1, then replan"*. The town's numbers (Q1–Q5) are ruled; here they are only a **test fixture**.

## What changed

| File | Change |
|---|---|
| `frontend/modules/actionNodes/actionSearch.js` | `enumerateLoop` takes `allowed` (a node mask); absent = every node, as before |
| `frontend/modules/actionNodes/actionPlanner.js` | `relevantNodes` (the relevance cone); `leastShortPlan` (now exported, `{cone}` switch for tests) and `notThisLoop` walk the cone |
| `frontend/modules/actionNodes/actionGraphCompiler.js` | `fillWithRetries`, `fillAttemptSeeds`, `DEFAULT_FILL_ATTEMPTS = 32`, `compileActionGraph({fillAttempts})`; `action_logic.fill` only when a retry was needed; `itemPoolOf`, `assumedFill`, `progressionOf` exported for the pins |
| `scripts/procgen/action-nodes-compile.mjs` | `--fill-attempts N`; prints the attempt when a retry filled the world |
| `frontend/modules/actionNodes/fixtures/omsi-first-town.json` | the omsi first-town graph (20 nodes, 18 checks) as a TEST FIXTURE: not a preset, not under `graphs/` |
| `frontend/modules/actionNodes/actionNodesTownScale.slow.test.js` | the town-scale pins (slow tier) |
| `actionPlanner.test.js`, `actionGraphCompiler.test.js` | default-tier pins (cone equivalence on the example; the attempt-seed stream) |
| `docs/json/developer/procgen/action-nodes.md` | prose: the fill retry, the `fill-failed` wording, the relevance cone. No new link or heading |
| `docs/json/developer/procgen/README.md`, `procgenDocs/generated/docsIndex.js`, `generated/instruments.js` | regenerated (`generate-procgen-reference.mjs`) |

## 1. The planner: the relevance cone

**The problem.** `leastShortPlan` ("short of mana by how much") enumerates one loop with mana ignored. Over the whole
town graph with every item held, that is **911,712 states** against the 200,000 budget, so `action-nodes-play.mjs` and
the bot were refused (`search-budget-exceeded`).

**The change.** This is the smallest sound change the measurement allowed: a mask, not a new search.
`relevantNodes(model, state, target)` keeps:
- the target;
- for each kept node: its `after` members, the producers of each stat it requires that the state does not already
  meet, and the producers of each resource it requires or spends;
- every node whose mana result is at least its price.

Both ignore-mana walks (`leastShortPlan`, and `notThisLoop`'s "needs an item" walk) enumerate only those nodes. The
budget is unchanged.

**Why the answer holds.** Drop a non-cone node's performances from any plan: the plan stays legal and is short by no
more. So:
- the least **shortfall** is always the same;
- when it is **above 0**, the whole answer (plan, shortfall, how far it runs) is the same. A cost-positive dropped node
  can only raise the last step's deficit, or sit after the first step that cannot be paid. The cone's states also come
  in the whole walk's breadth-first order, so ties fall the same way.
- When it is **0**, the whole walk's "runs furthest" tie-break preferred a plan padded with any affordable node. My
  first version's pin caught this: `guards-locker` on the example returned `[1,1,6,7]` against the whole walk's
  `[1,1,6,3,2,7]`, both short 0. The cone returns the unpadded plan. No caller reads that plan: an affordable target is
  earned by the main search, and step 2's line reads only `.short`. The rule's "≥ price" (not "> price") keeps
  zero-net nodes, so the above-0 case stays exact.

**States, before → after** (one ignore-mana walk, the largest over every check and the goal):

| Graph, start | Whole graph (before) | Largest cone walk (after) | Cone nodes |
|---|---|---|---|
| omsi fixture, all 18 items held | **911,712** (refused at 200,000) | **19,164** | 14 of 20 |
| omsi fixture, no items | 40 | 40 | 15 of 20 |
| example, all items | 77 | 35 | 8 of 10 |
| example, no items | 42 | 30 | 8 of 10 |

**Behaviour unchanged, measured.** `playToGoal`'s full JSON result, every reasoning line included, is
**byte-identical** old → new:
- the example (committed preset placements) at XP scale 1 and 0, at the default budget both sides;
- the fixture (seed 3's fill) at XP scale 1 and 0. The old side needed the budget raised to 3,000,000 (71 s); the new
  side runs at the default budget (4.5 s).

The play script: the example reaches the goal in 2 loops at both scales, and the live path in 2. The fixture: 7 loops
at XP scale 1, 8 at 0, live path 7, at the default budget.

## 2. The fill retry

- `fillWithRetries` tries `assumedFill` up to `fillAttempts` times. **Attempt 1 uses the seed itself**, so a graph that
  fills first time compiles to the bytes it did before retries existed. Attempts 2.. take their seeds from a separate
  mulberry32 stream seeded with `seed ^ 0x5bd1e995` (`fillAttemptSeeds`).
- All attempts used up → `fill-failed`, *"N fill attempts failed; the last: …"*.
- A world that needed a retry records `action_logic.fill: {attempt, seed}`; one that did not has no such key.
- **The default, measured** on the fixture:
  - seeds 1–200: attempt 1 fills 120, every seed fills, the worst needs 6 attempts, mean 1.61;
  - an attempt costs one fill (the logic is derived once), so `DEFAULT_FILL_ATTEMPTS = 32` sits far past the worst.
- **Seeds filled, before → after** (fixture, seeds 1–20): **6 → 20**. Attempts per seed:
  `[2,2,1,1,2,2,3,4,3,3,1,1,2,6,3,2,6,1,2,1]`.
- A graph the retry cannot save stays refused. The fixture with Smash Pots, Buy Mana, Fight Monsters and Heal The
  Sick at limit 1 fails on 40 of 40 seeds even at 1,000 attempts each, so it has no fill from its start. The refusal
  pin uses it.

## 3. Byte identity

- `node scripts/procgen/action-nodes-compile.mjs --check`: **OK**, `action_nodes_example/AP_1/AP_1_rules.json` is
  byte-identical. It is also OK with `--fill-attempts 1`.
- `actionGraphCompiler.test.js` "byte-identical (what action-nodes-compile.mjs writes)": green.
- The example's report carries no `fill` key (pinned).
- No committed preset or rules output moved. No `an-*` row's expectation changed.

## 4. Pins and their mutations

`actionNodesTownScale.slow.test.js` (slow tier, 11 tests, ~45 s locally):
- why: the whole-graph walk on the fixture (all items) is refused by the budget;
- the old search order (`cone: false`) is refused on the fixture;
- every target's cone walk is under a quarter of the budget, with no items and with all items;
- the cone answers as the whole graph does wherever the whole graph fits: no items (every target); Wander, Met and
  Secrets Progress (every target, 10,672 states); those plus one Combat and one Magic Training (the goal, 170,944
  states). Same shortfall always; same answer above 0;
- the bot plays the fixture to the goal at the default budget: 7 loops (XP 1), 8 (XP 0);
- attempt 1 IS `assumedFill(seed)` wherever it fills;
- seeds 1–20 all fill with the default attempts, and attempt 1 alone fills exactly 6;
- MUTATION, no retry: 1 attempt fills 6 of 20;
- deterministic: same seed, same attempt and placement;
- the compiled fixture at seed 1 records `fill: {attempt: 2, seed: fillAttemptSeeds(1, 2)[1]}`;
- refused by name after 5 attempts, saying "5 fill attempts failed".

Default tier:
- `actionPlanner.test.js`: the cone against the whole walk on the example, for every item combination × pools
  {full, 30, 5} × every target (equal shortfall; equal answer above 0, with at least one such case); which nodes the
  cone keeps and drops for Leave the Village.
- `actionGraphCompiler.test.js`: `fillAttemptSeeds` (attempt 1 = seed, distinct, deterministic, prefix-stable); no
  `fill` key on the example.

**Mutations, run** (each reverted with `git checkout`):

| Mutation | Result |
|---|---|
| `DEFAULT_FILL_ATTEMPTS = 1` (no retry) | 3 red: the 20-seed floor, determinism (seed 1 does not fill on one attempt), the seed-1 retry record |
| `leastShortPlan` ignores the cone (the old search order) | 1 red: the bot test, refused `search-budget-exceeded` |

## 5. Gates (local)

- Bounded vitest: `frontend/modules/actionNodes` (default tier), `frontend/modules/procgenDocs`, and every outside test
  importing a changed file (`discovery/revealCore`, `packStructure/packResolver`, `playbackBot/substrateLoopPlanner`,
  `procgenCore/sidecarFieldsRegistry`, `regionGraph/actionNodesTwoWayEdges`, `contentPacks/provenance`):
  **26 files, 805 passed**. The slow file alone: **11 passed**. No local unfiltered run (ruling 52).
- `generate-procgen-reference.mjs --check`: all 7 generated modules and 5 markdown regions match.
- `check-procgen-docs.mjs`: all checks passed.
- `check-procgen-help.mjs --doors=all`: ALL PASS, 561 instruments (run at the base, where the CLI edit was still uncommitted, so it was outside that population); re-run at `b17370c25d`: `action-nodes-compile.mjs` HELP ok, IMPORT ok.
- Maze engine closure (`seedlingDerivedRuleTable.js --print-engine-closure`): 43 lines, sha256 prefix
  `a3565f4e6866438e`; **closure ∩ diff = ∅**.
- Gitlinks: 0 (no submodule pointer in the diff).
- pytest not run, so no dirt to revert.

## 6. CI

CI runs at the tip that contains this report: unit tests, JSUT (dispatched, because a report-only push misses its
path filter), test-templates (TT, with headroom; the `an-*` rows on fast and fast-bundled; playback-bot), and
feature-checks. The run ids are in the planner's report back and in memory (`project_actionnodes_substrate`). They
cannot be in the commit they ran on.

## Next

AN-OMSI-2 (the town graph under `graphs/` + a committed preset `action_nodes_omsi_town`, its own preset train), after
the replan Robert asked for (Q7).
