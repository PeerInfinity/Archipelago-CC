# AN-TIME-2: time in the ActionNodes app (as-built)

Session `actionnodes-time2` (Opus), 2026-11-25, for planner `concept-library-content-planning-5`. Branch `an-time2`, base
`origin/an-time1` `a4cfc24a69`.

Commits:
- `44945665dd`: the shared gitlink bump;
- `2d62731252`: the code, the rows and the docs;
- this report;
- the one merge of main (§ 9).

The design is `actionnodes-time-design` § 4, § 5 (minimal part) and § 8 (its AN-TIME-2 row).

**Robert's rulings** (2026-11-25, collected before 03:56:16Z by liaison-5):
- *"Yes to Q1, Q2 and Q3"* and *"Yes to Q4 and Q5"*.
- Q6/Q7: *"…just a list of which things have been done in at least one previous loop … I also want to have a way to
  indicate, on the action node, whether it has been completed before."*
- *"A 'loop N' / 'day N' tag"*: tagged, not grey.

**The planner's rulings in this slice:**
- the submodule gate cleared for the `wait` row: land it myself, parent `71b77de`;
- the knowledge-gap addendum (relayed from AN-TIME-1): a new `event_kind` value and its policy row are licensed as a
  second allowed addition, next to `pool`.

## 1. What changed

| Where | Change |
|---|---|
| `shared` `ecdda89` (submodule; gitlink `71b77de → ecdda89`, 3 files) | `procgen/loopCustomActions.js` gains a `wait` row:<br>• `statesOwnCost`: the price is `params.units`, and no region price is read;<br>• `xpDiscount: false`;<br>• it completes with `loop:actionCompleted`.<br>New helpers: `waitUnitsOf`, `customActionXpDiscounts`; `customActionDefaultCost(action)`. `queueAnalysis.js` skips the XP discount for a wait. `explore` and `act` price as before. The test file: 3 rows, +2 tests. |
| `actionNodes/actionNodesRuntime.js` | `runtimeModelOf` reads `window`, `requires.knowledge`, `results.learns` and the block's `clock`, `knowledge` and `pool`.<br>The runtime keeps:<br>• `clock`: prices plus waits, 0 at each loop;<br>• `known`: the learned set, kept across loops;<br>• `loopNumber` and `completedLoops`.<br>The gate refuses `too-late`, `knowledge` and `too-early`, and lets `wait` through. `onActionCompleted` handles `wait`. `perform` collects the knowledge event (`env.collectEvent`). `actNow` pays the wait.<br>Also `clockLine`, `poolName/poolUnit/formatAmount`, `completedBefore()` and `completedBeforeLoopOf()`.<br>**The loop's pool is `loop.mana`** (§ 6). |
| `actionNodes/actionGraphCompiler.js` | Knowledge event locations get `event_kind: 'substrate_state'` (`KNOWLEDGE_EVENT_KIND`). The block's `pool` is written only when present. |
| `actionNodes/actionGraph.js` | The graph field `pool: {name, unit?}`, with the refusal `bad-pool`. |
| `actionNodes/actionModel.js` | `pool` on the model. New: `poolNameOf`, `poolWordOf`, `poolAmountOf`, `unitAmountOf`, `applyWait`. `whyNot` and `waitNote` read the pool name. |
| `actionNodes/nodeStates.js` | `wait` on each state (a windowed world only). The mana check counts the wait. `notEnoughOf(model)`. `queueEndState` applies `wait` entries and stops at an early act (`too-early`). |
| `actionNodes/nodePerformPlan.js`, `nodeClickAction.js` | The plan carries `waits` and `wait`, and its text says *waits 3 h (opens 12:00), then …*. The click queues a `wait` entry before an early `act`. New: `waitParamsOf`. |
| `actionNodes/actionLoopBot.js`, `actionNodesLibrary.js` | `routeOfPlan` writes a `wait` before each early act, with the live prices. `planLiveLoop` plans with the runtime's known flags and continues with `clock` and `known`.<br>The entry: `queueActions` gains `wait`; new `loopSupport.pool()` and `loopSupport.clockLine(mana)`. |
| `actionNodes/nodeCard.js`, `nodeCardOverlay.js` | The window line, the click text, *completed before · loop N*, and a too-late card's window line marked. The price and *gives* read the pool name. |
| `actionNodes/actionNodesPanel.js` | *Loop N · HH:MM*, the window line, the pool-name amounts, the **Completed before** list, and **Queue act** queuing a wait first. |
| `actionNodes/historyStore.js` (new), `index.js` | The per-world localStorage store under `actionNodesHistory_v1_` (declared in `moduleInfo.storage`).<br>The env gains `collectEvent` (`stateManagerProxy.checkLocation(name, true, true)`) and `historyStore`. |
| `actionNodes/actionPlanner.js` | The reasoning lines read the pool name. |
| `resourceChannels/poolName.js` (new), `resourcesPanel.js` | The pool's name comes from the loaded world's entries; when the warehouse names none, it asks every entry, and a hook answers only for its own world. The Time line; `describeGives` reads the pool. |
| `loops/loopState.js`, `loops/loopUI.js` | No XP discount for a wait, and its no-cost-data price is its own. The Loops panel's 7 pool strings read the pool name. |
| `stateManager/core/eventKinds.js`, `rules.schema.json` | The `substrate_state` policy row and the schema enum value; the schema's `action_nodes[p].pool`. |
| `tests/testCases/actionNodesTests.js`, the substrates config | 3 rows (§ 7). |
| `actionNodes/actionTimeRuntime.test.js` (new) | 30 pins (§ 2–6). |
| Docs | `action-nodes.md`: a sub-section *Time in the app (AN-TIME-2)*, the registry and No-explore lines. `substrate-registry.md`: two Entry-contract rows. The regenerated reference. |

## 2. The knowledge gap: the fix and its pin

**The defect.** A `Knows: <flag>` event location's rule is the node's perform rule. The state manager auto-collects an
event once its rule holds, so the app held the flag as soon as the teaching node was reachable, before the player had
done anything.

**The fix.**
- Enum value **`substrate_state`**, with a policy row in `stateManager/core/eventKinds.js`:
  `substrate_state: {autoCollect: false, playerCheckable: false, why: 'state a substrate runtime keeps (an ActionNodes
  knowledge flag …): learned by PERFORMING the node, so the runtime collects it on the action, never on reach'}`.
  `game_state` was not used: `procgenCore/eventRoute.js` routes `game_state` events.
- The compiler writes `event_kind` only on knowledge event locations. A world without knowledge writes none, so no
  committed preset carries it (`eventKinds.test.js`'s census of committed presets is unchanged and green).
- The runtime keeps its own learned set, filled by `perform`, and collects each new flag's event with a forced local
  check.
- A snapshot that holds the event item adds the flag to the set (a reload, or `/sync`: statePersistence 2b re-adds a
  kind it never auto-collects).
- I did not use `setAutoCollectEventsConfig`.

**The pin** (`actionTimeRuntime.test.js`, the REAL `StateManager` in node, over the compiled visits fixture):

| Step | What is checked |
|---|---|
| Before perform | Visit A's event location is accessible, yet NOT checked and `Knows: Paper A` = 0. The gate refuses Visit D with exactly *needs to know Paper A*. |
| After perform | The location is checked, the item is 1, and the gate passes. |
| After a /sync (index 0, `rederiveIdlessLocations`) | Still 1. |
| A fresh runtime fed that snapshot | It knows `read-a`. |
| **Mutation:** the same world with no `event_kind` | The item is 1 before any perform: the gap. |

The planner also asked that `jsonSchemaCheck` stay green: `procgenCore/jsonSchemaCheck.test.js` is green in the bounded
run, and `eventKinds.test.js` holds the enum equal to the policy rows.

## 3. The wait

- **The `wait` row** is in `shared` `ecdda89`:
  - the entry states its length (`params.units`);
  - no region price is read, with or without cost data;
  - `xpDiscount: false`, read by `loops/loopState.js`, `loops/loopUI.js` and `shared/queueAnalysis.js`;
  - it completes like `act`.
- **Queued by:**
  - the click: `planPerform` returns `waits` per performance;
  - **Queue act** in the panel;
  - the bot: `routeOfPlan`, a wait of the exact length before an early act, priced with the same live prices the plan used.
- **The start gate refuses a bare early act** (`too-early`, *Watch the Ferry Come In opens at 12:00: queue a wait first
  (3 h)*). So a wait is always visible in the queue, and `queueEndState` stops there too.
- **Outside Loop mode**, `actNow` charges the wait with the price.
- **Pins:**
  - gate early → wait → the clock moves → the act passes, ending at 13:00;
  - `actNow` charges 3 + 1 and the clock equals the pool spent;
  - `performNode` queues `[wait {units: 3, label: 'Wait 3 h (opens 12:00)'}, act]`;
  - `queueEndState` with and without the wait;
  - the bot's harbour route: every entry passes the live gate and the goal is performed. Its **mutation**, the same route
    with its waits removed, is refused `too-early` at the first early act.

## 4. The labels, against the § 4 table

All 24 strings read the pool name. With no `pool` each text is exactly the old one: every existing test and row is green
unchanged, and a dedicated pin compares the no-pool texts.

| § 4 row | Now |
|---|---|
| `whyNot` `no mana left…`, `short by N mana` | `no ${word} left…`, `short by ${poolAmountOf}` (*short by 3 h (waits 3 h, opens 12:00)*) |
| `nodeStates` `not enough mana` | `notEnoughOf(model)` (*not enough time*). The constant `NOT_ENOUGH_MANA` stays for the old callers. |
| `nodeCard` `Mana +N`, `N mana` | `${poolName} +N`, `poolAmountOf` (*1 h*) |
| `actionNodesPanel` `+N mana`, `N mana (base M)` | `+${poolAmountOf}`, `${poolAmountOf} (base M)` |
| `nodePerformPlan` (via `whyNot`) | via `whyNot` |
| `actionPlanner` (7 lines) | `poolAmountOf` and `poolWordOf` |
| `resourcesPanel` `+N mana`, `Mana: c / m` | `poolAmount(n, pool)`; `${name}: c / m (starting)`, or with a clock *Time: 11:00 · 6 h left · the day ends 17:00* |
| `loopUI` `Mana:` label, `… of N mana`, the 5 tooltips and pause texts | `data-pool-label`, `data-pool-title` (applied in `renderLoopPanel`), and `poolWord()` / `poolAmount()` |

- **Where the name comes from.** The graph field `pool: {name, unit?}`, compiled to `action_nodes[p].pool` only when
  present, defaults to "Mana". No code holds a "Time" literal; only the fixtures' test copies do.
- **`loopSupport`, not `sharing.mana`:** the registry (`shared/procgen/substrateRegistry.js`) rejects unknown
  `sharing.mana` fields, and a second shared change was not worth it. `loopSupport` is the Loops-facing declaration in
  any case.

## 5. The history and how it is kept

- **What is kept.** `completedLoops`: node id → the loop it was FIRST performed in. Loop 1 is the load's.
- **What counts as a new loop.** A reset counts only when something was done in the loop (`_progressed`). Measured:
  `loops.resetForNewRules` publishes `loopState:loopReset` on every world load, so counting every reset would have
  started each world at loop 2.
- **Where it shows.**
  - The card shows *completed before · loop N* (italic, blue; not grey) for a node first performed in an earlier loop.
  - The panel lists the set, each entry *Name · loop N*.
- **Saving was a small change, so it is built.**
  - Per world under `actionNodesHistory_v1_<graph_id>:<seed>:<slot>`, declared in `moduleInfo.storage` (the storage
    pins are green).
  - Stored: `{version: 1, loop, progressed, completed}`.
  - A reload resumes the numbering: the next loop if the saved one had progress.
  - A storage that throws keeps the set in memory, and the write failure is reported.
- **Not built:** the actions of the first or latest completing loop (AN-TIME-3).

## 6. A defect my own rows found: the app never applied `loop.mana`

- **What.** The app's pool starts at gameState's `defaultMaxMana` (100) plus the substrates' bonuses. Nothing applied
  the graph's `loop.mana`.
- **Why nothing showed.** Both committed worlds (the example, and the omsi town on `an-omsi3`) set exactly 100, so the
  two agreed by coincidence.
- **How it showed.** The harbour fixture (`loop.mana` 8) played a 100-hour day: `Mana: 100 / 100` instead of
  *Time: 09:00 · 8 h left · the day ends 17:00*.
- **The fix.** The runtime sets its substrate max-mana bonus to `loop.mana − defaultMaxMana` at a loop's start, refills
  the pool when that bonus moved, and resets it to 0 on unload. Every 100 world sets a bonus of 0, so nothing changes.
  Pinned: harbour max = 8, and the example's bonus = 0.
- **Who needs it.** AN-TIME-4's first timed preset depends on it.

## 7. The in-app rows

| Row | Batch | What it covers |
|---|---|---|
| `an-time-window-and-wait` | `fast` (category ActionNodes) | The harbour fixture, compiled in the page, with the copy's `pool: Time/h`:<br>• the window line on 4 cards, and the early card's click text;<br>• the Time line at 09:00;<br>• two walks make the landlady too late: the card, the click (refused, blocked) and the live start gate (`too-late`) all say so;<br>• a click on the ferry queues the route, `Wait 3 h (opens 12:00)` and the act;<br>• it runs: the clock is 4, **pure (`queueEndState`) == live**, the pool paid 4 with no discount, and the Time line reads *13:00 · 4 h left · the day ends 17:00*. |
| `an-time-knowledge-gate` | `fast` | The visits fixture:<br>• the app does NOT hold `Knows: Paper A`, and the gate refuses Visit D by name (so does the card);<br>• clicks on A then D queue both, and they run with no refusal;<br>• the app holds both flags, and the runtime knows `read-a` and `read-d`;<br>• the next loop's gate passes from the start. |
| `an-time-completed-before` | `fast` | • Loop 1: no mark, even right after the performance;<br>• loop 2: the walk card shows *completed before · loop 1* and no other card is marked;<br>• the panel lists the set (**pure == live** against `runtime.completedBefore()`);<br>• one saved key under the prefix. |

- **Setup.** Every row loads its fixture in memory (`files:jsonLoaded`, the editor's path; a blob URL left the world
  without its `loop_costs`), clears its world's history first and last, and sets its own queue and speed (`freshQueue`).
- **Local runs on the box (port 8130):**
  - the 3 rows: 3/3 PASSED (2.3 s, 1.1 s, 0.9 s);
  - every enabled `an-*` row plus `an-bot-plays-to-goal`: **17/17 PASSED**, so no existing row changed status.
- **CI:**
  - headroom before → after (`check-batch-headroom`; the base is AN-TIME-1's TT `45547686456`; the warn fraction is 0.7):
    `fast` 318.2 s → 323.4 s of 600 s (53% → 54%); `fast` bundled 323.9 s → 335.4 s (54% → 56%); `playback-bot` 185.1 s
    (31%; no bot row moved);
  - repeat ×8 (`test-substrates-repeat.yml`): `an-time-window-and-wait` **8/8** (`45682505603`),
    `an-time-knowledge-gate` **8/8** (`45682510272`), `an-time-completed-before` **8/8** (`45682515706`).

## 8. Byte identity

- `node scripts/procgen/action-nodes-compile.mjs --check`: `action_nodes_example/AP_1` is **byte-identical**
  (sha256 `315e9af975cbd5bf…`).
- **The omsi town** is not on main yet. I compiled `origin/an-omsi3` `147225bec3`'s graph with this branch's compiler,
  using its recipe (`--seed 3`, `graph_path` `frontend/modules/actionNodes/graphs/omsi-first-town.json`, as recorded).
  `cmp` with that branch's preset: **byte-identical** (sha256 `deadccdd0c135a4e…` both). It is re-proved after the
  merge of main (§ 9).
- Why: `pool` and `event_kind` are written only when the graph has a pool or knowledge.

## 9. Gates

- **Gitlinks:** 1. `frontend/modules/shared` `71b77de → ecdda89`, 3 files only, an ancestor of shared `origin/main`
  (measured). None of the 3 is in the maze engine closure.
- **Closure ∩ diff = ∅:** `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure` (43 files) against
  the 29 changed paths.
- **Bounded vitest** (ruling 52): `actionNodes/`, `loops/`, `resourceChannels/`, `stateManager/core/eventKinds`,
  `storagePanel/`, shared `loopCustomActions` and `queueAnalysis`, `procgenDocs/`, `checkSidecarFields`, `tests/`,
  `jsonSchemaCheck`.
  - **68 files, 1745 tests green**, after fixing the docs pin below.
  - **The docs pin it owed:** `procgenDocs/generated.test.js`'s *registry findings* list went red on the two new
    `loopSupport` fields. They are now documented as two Entry-contract rows. Their cross-reference is plain prose, so
    the docs link census (453) does not move.
- **Checks:** `generate-procgen-reference --check`: ALL MATCH. `check-procgen-docs`: ALL CHECKS PASSED.
  `check-sidecar-fields`: ALL PASS (0 issues).
- **CI at `2d62731252`** (the code tip, before this report and the merge), all success:
  - ut `45682326447`;
  - JSUT `45682326353`: suite 30184 passed / 0 failed, slow 468/468;
  - TT `45682496442`: every batch, both boots;
  - feature-checks `45682500783`;
  - the three repeat runs above.
- **CI at the final tip** (after the one merge of main): appended in § 11.

## 10. Not in this slice

- The actions of the first or latest completing loop, and the loop timeline (§ 5's full form): AN-TIME-3.
- The first timed preset: AN-TIME-4. It relies on § 6.
- `needs.solved` (a flag from outside) still has only the model's `applyKnowledge` hook.
- **A transient on the Time line.** The `ends` time is `now + left`, and the clock moves when an action completes while
  the pool drains during it. So while an action runs, the line's `ends` reads early, then snaps back.

## Screenshots

`actionnodes-time2-shots/cards-time-line-completed-before.png`: the real `renderNodeCard`, `nodeCardModel` and
`resourcesPanelModel`, run by the app's runtime singleton on the harbour copy (`page.html`, served from the worktree). It
shows:
- windowed cards at 09:00, the early ferry with its click text;
- after two walks, the landlady too late with its window line marked;
- the Resources Time line *Time: 11:00 · 6 h left · the day ends 17:00*;
- in loop 2, the walk tagged *completed before · loop 1*.

## 11. The one merge: main 16acf42ce6 (train 219)

The merge commit is `96ed2622e0`: `origin/main` 16acf42ce6 merged once into `an-time2` 72e73ccaeb. `an-time1` had no
merge of its own: `an-time2` contains it, and the two land as one entry.

**Conflicts.** Each resolution keeps both sides, and none changes this slice's logic:

| File | How it was resolved |
|---|---|
| `frontend/modules/tests/testCases/actionNodesTests.js` | AN-TIME-2's `windowAndWait`, `knowledgeGate` and `completedBeforeRow`, then AN-OMSI-3's § 15 (`omsiTownRow`, `omsiTownBotPlaysToGoal`). Diffed against the theirs side, the one line the resolution dropped is the `nodeCard.js` import this side extends; diffed against ours, the lines it dropped are main's own auto-merged `readPreset`/`loadExample` edits. The `ROWS` list auto-merged with both sets. |
| `frontend/test-configs/playwright_tests_config-substrates.json` | The three `an-time-*` rows, then `an-omsi-town-load-and-act`. |
| `docs/json/developer/procgen/README.md` | Regenerated with `generate-procgen-reference.mjs`, never hand-edited. |
| `frontend/modules/procgenDocs/generated/docsIndex.js` | Regenerated with `generate-procgen-reference.mjs`, never hand-edited. |

`action-nodes.md` merged without a conflict.

**Gates at the merge tip:**
- `generate-procgen-reference --check`: all 7 modules and 5 regions match.
- `check-procgen-docs`: all passed.
- `action-nodes-compile --check`: OK for both committed presets.
  - `action_nodes_example`: sha256 315e9af975cbd5bf….
  - `action_nodes_omsi_town`: AP_3, deadccdd0c135a4e…. Also proven by the recipe (`omsi-first-town.json --seed 3`, then `cmp`).
  - `git diff origin/main..tip -- frontend/presets` is empty.
- `ci-producer-checks`: 100 run, 0 red, 1 skipped.
- `check-sidecar-fields`: rc 0.
- Bounded vitest (actionNodes, procgenDocs, shared `loopCustomActions`, `stateManager/core`, resourceChannels, loops*,
  `derivedRuleTableFresh`): 74 files, 1669 tests green.
- The doc-link census is 453 at main and 453 at the tip: the pin file is unchanged and green.
- engineMd5 is 74ae60f5, unchanged; `derivedRuleTableFresh` is green. Closure ∩ diff = ∅ (closure 43 files, diff 42).
- Gitlinks against main: exactly one, `frontend/modules/shared` 71b77de→ecdda89. ecdda89 is an ancestor of
  archipelago-shared `origin/main`.

**CI at 96ed2622e0:**
- ut 45867091560: success.
- JSUT 45867091306: success. The suite is 1451/30338 (0 failed); the slow tier is 42/470.
- feature-checks 45867228700: success.
- TT 45867224708: success on attempt 2.
  - Attempt 1 failed one row, `test_region_graph_sub_region_merged` (row 10/143, the Region Graph `+` badge
    hit-square; `fast` unbundled only).
  - That row is groups-c's known badge layout race; it failed bundled at train 215. This diff touches no regionGraph
    file.
  - Its rate at this tip is **7/8** (repeat 45871205912).
  - The failed job was re-run and passed; the row PASSED 1.5 s on the re-run.

**Headroom at 96ed2622e0, against the median of 3 main samples (TT 45865560624 at 16acf42ce6, 45763431625 and
45763428973 at 0defd21f75):**

| Batch | Main median | Tip |
|---|---|---|
| fast | 324.3 s (54%) | 328.7 s (55%); 329.8 s (55%) on the re-run |
| fast-bundled | 339.6 s (57%) | 319.1 s (53%) |
| playback-bot | 201.0 s (33%) | 227.1 s (38%) |

- The playback-bot batch holds no row of this slice; its spread on main is 199–213 s.
- The new rows in `fast` (unbundled / bundled / re-run):
  - `an-time-window-and-wait`: 0.8 / 0.7 / 0.7 s.
  - `an-time-knowledge-gate`: 0.6 / 0.6 / 0.6 s.
  - `an-time-completed-before`: 0.4 / 0.5 / 0.5 s.
- No batch passes its warn fraction (0.7).

This section is report-only, so JSUT is dispatched at its commit (§ 12 is not written; the id is in the REPORT BACK).
