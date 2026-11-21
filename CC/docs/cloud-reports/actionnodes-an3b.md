# ActionNodes AN-3b: the click (perform once), the "perform all remaining" button, and AN-3a's two limits (as built)

Slice AN-3b of the ActionNodes substrate (content sets arc). Session `actionnodes-an3b` (Opus 5.5), 2026-11-20.
- Branch: `actionnodes-an3b` on `origin/main` `d358d50e02`, which carries CA-S2 and CA-S3.
- Planner: `concept-library-content-planning-3`.
- Click-actions owner: `archipelago-cc-23`.

Rulings it builds on:
- **Robert, 2026-11-17T21:35:22Z:** "I want to add a separate button on the repeatable nodes to perform all remaining.
  The default click action should be to perform once. I don't want to add a right click action."
- **The 2026-11-18 replan:** AN-3a's two limits are folded in.
- **The planner's rulings in this slice:**
  - 2026-11-20: overlay card click → runClickActions.
  - 2026-11-20: ruling C on the Instant overshoot.

## The parts as built

### 1. The click: `actionNodes.act`, performing ONCE (`8c1fd4a052`)

**The plan** is in `actionNodes/nodePerformPlan.js` (pure). `planPerform(model, input, nodeId, {times})` computes it
for the END of the Loops queue (`nodeStates.queueEndState`, the state the cards show while a queue is planned). Outside
Loop mode the queue is empty, so that is the live state. It has three steps:
1. **The node's state there.** Anything but `ready` is refused by name. A queue that already stops early is refused
   too, because nothing after its stop would run.
2. **The route.** It takes the free hops from where the queue ends (`actionLoopBot.hopsBetween`, AN-3a's R8). From
   `Menu`, which is not a node, the first hop is `Menu → start`.
3. **The performances.** These are `1`, or (for the button) every one left, capped (see part 2).

**The effect** is `actionNodes/nodeClickAction.js` `performNode(deps, nodeId, {times, panelId})`, the one effect
behind the click and the button.
- In Loop mode it QUEUES:
  - each hop as a `user:regionMove` under the planning source `actionNodes-plan-<panelId>`;
  - then one `act` entry per performance, through `gameState.addCustomAction`.
- Outside Loop mode it dispatches the same moves, then calls `runtime.actNow` per performance (the pool pays). It stops
  at the first performance that does not complete.
- Every answer is kept as `lastPerformResult()` (public function `actionNodes.getLastPerformResult`). A refusal is
  logged to the console.

**The click action:** `{ id: 'actionNodes.act', owner: 'actionNodes', target: 'region', kind: 'toggle', label,
summary: 'perform once', run }`.
- It has no `order`, so it runs at 300, after the built-in route and checks.
- `syncClickAction` registers it after every rules load that holds an ActionNodes world, and unregisters it otherwise.
  A stored `true` survives as "(not loaded)".
- Both the Region Graph's and the Region Map's strips run it. Each panel's settings decide whether it is on; it is
  off by default, like every panel-owned action.

**The planning prefix:** `loops/loopModeExemptions.js` gains `actionNodes-plan`. This is the one edit there; its pin
is in `loopModeExemptions.test.js` and reads the module's own constant.

**The overlay card click → runClickActions (planner ruling 2026-11-20, archipelago-cc-23's option 1).**
- The gap: the card covers the node, whose cytoscape node is shrunk to 60×45 behind a 120 px card.
  `regionGraph/nodeOverlayManager.js` handled a click on the card body by publishing `regionGraph:nodeSelected`
  ALONE, so the "On click" strip never ran for an overlaid node.
- This was a long-standing gap. The card-body click never ran the old 7-box handlers either.
- The fix is one listener: the card-body click now calls `this.ui.interactionManager.handleRegionNodeClick(cyNode)`.
  That publishes `nodeSelected` (same `{nodeId, data}`, once) and then runs the panel's click actions. A `BUTTON`
  target is still the card's own.

cc-23's conditions:
- **(a) and (c), vitest:** `regionGraph/nodeOverlayClick.test.js`, 4 tests.
  - The payload is unchanged and published once, and the strip runs once.
  - It is pinned for both overlay kinds by name. The listener is the manager's, not the provider's, so the two rows
    exercise the same code.
  - A button target runs nothing.
  - With the master switch off, no action runs and `nodeSelected` is still published once.
- **(b), measured with a REAL mouse** (Playwright `page.mouse.click`, a scratch probe on the example preset, counting
  `regionGraph:nodeSelected` and wrapping `path.route`'s `run`):

  | tree | card centre | card corner (+4 px) |
  |---|---|---|
  | base `d358d50e02` | nodeSelected 1, strip runs **0** | nodeSelected 1, strip runs **0** |
  | tip | nodeSelected 1, strip runs **1** | nodeSelected 1, strip runs **1** |

  The forwarded mousedown does NOT turn the click into a cytoscape tap as well; there is no double run.
- **(d):** D0 is byte-identical (below). `test_node_selection` and `test_region_graph_node_picker` PASSED.
- **(e):** this section. CA-S4 moves the line to `regionView:regionClicked` with the rest.

### 2. The "perform all remaining" button (`6b96784366`)

**`actionNodes/nodeCard.js`.** A node whose limit is greater than 1 gets ONE button, "Perform all remaining", in the
reserved `.an-card__actions[data-slot="perform-all-remaining"]`.
- It stops its own `mousedown` and `click`, so it is never a node click and publishes no `nodeSelected`. It calls the
  provider's `onPerformAll(nodeId)`.
- A node with limit 1, and the start, keep the empty, hidden slot.
- The answer (queued, performed, capped, or the refusal by name) becomes the card's `.an-card__message` line. It stays
  until the next answer for that node, or until a world switch.

**`actionNodes/nodeCardOverlay.js`:** `onPerformAll = performNode(times: 'remaining', panelId: 'nodeCard')`.

**The cap rule.** The wanted count is the performances left at the queue's end (`limit − count`). Each one must pass
`whyNot` WITH mana: the pool left after the ones before it, at the live, XP-discounted price, plus every requirement.
- **When the mana runs short,** it queues (or, outside Loop mode, performs) as many as the pool finishes. It says so,
  e.g. `1 hop(s), then Do Chores ×1 of the 2 left (stopped: short by 4 mana)`, and `capped: {by: 'mana', text}`.
- A requirement that runs out is capped the same way, with its own text.
- **Not ready** (blocked, done, not reached, undiscovered): refused by name, exactly as the click is.

### 3. Limit (a): the cards on a reopened Region Graph panel (`e5d6cef7aa`)

**The cause.** The overlay API's pending slot serves only the FIRST panel created after a registration. A panel that
was closed and reopened took nothing, so it showed no card until the next world load.

**Why `regionGraph` had to change.** There was no panel-mount event to re-register on. I grepped for one: the Region
Graph and `panelManager` publish none on desktop. So the fix needs one additive `regionGraph` change, kept minimal like
AN-3a's `unregisterNodeOverlayProvider`:
- **`regionGraph/index.js`:** `registerPanelInstance` (called by the panel's constructor) also publishes
  `regionGraph:panelMounted` (`{panelCount}`), a registered publisher. The pending slot, `nodeOverlayManager.js` and
  every other provider (vibeCodingSim's) are unchanged.
- **`actionNodes/nodeCardOverlay.js`:** on that event, while the card is registered, it calls
  `registerNodeOverlayProvider(provider)` again, which reaches every panel, the new one included. It does nothing while
  another world is loaded. Pinned in vitest (`nodeCard.test.js`).

**Control.** With `regionGraph/index.js` at the previous commit, `an-cards-after-reopen` is
`STUCK … (0 of 10)`. At the tip it PASSED.

### 4. Limit (b): the live bot replans mid-loop (`d0d86f890f`)

**The trigger is the state DIVERGING from the plan:** an item arrived during the loop. A check's own item is applied
at once (A4), and it is the one thing the plan cannot foresee. The alternative was to replan at every completed
performance. Without new information that would only repeat the plan, because the planner is deterministic and its
answer for the state is the rest of the plan. So I chose divergence.

**Where it is checked: at the queue's end.**
- Loops can take appended entries after `loopState:queueCompleted` and resume with no reset: `resumeProcessing`
  continues from `currentActionIndex` once the queue is longer.
- Cutting a running queue short mid-flight would need surgery inside Loops, which is not this slice's.
- An earlier item never invalidates the remaining entries, because boosts only add. The start gate re-checks every
  entry anyway.

**`playbackBot/loopModeRunner.js`.** A substrate plan's queue completes, and the runner waits for the worker's
snapshot flush (the last act's item arrives a moment after its check). Then it replans if both hold:
- the snapshot's inventory rose since the plan;
- mana is left.

The replan:
- asks `planLoop({..., continueFrom: {region, mana}})` for the REST of the loop;
- appends that route to the queue with `appendContinuation`, whose instance numbers continue the path's own;
- calls `resumeProcessing()`, with no reset and no refill.

Its lines are logged as `loop N (replan): …`, and `getReplanCount()` counts the replans. If nothing was received, or
no mana is left, the loop ends exactly as before. A non-substrate world never replans; this is pinned, and AN-3a's
"planNextLoop as before" pin still holds.

**`actionNodes`.** `planLiveLoop` and `routeOfPlan` take `continueFrom`. It holds the live counts, stats and resources
from the runtime (the registry entry adds `rt.liveState()`), routed from the player's node, with no `Menu → start` hop.
`actionLiveSim.playLiveToGoal` plays the same continuation.

**The loop count.**

| Path | Before (AN-3a) | After |
|---|---|---|
| pure planner (`playToGoal`) | 2 | 2 |
| headless live path (`playLiveToGoal`) | 3 | **2** — pinned exactly; loop 1's lines equal the pure planner's verbatim |
| in-app, Instant (`an-bot-plays-to-goal`) | 3 | **1** — see the known gap |

**Known gap: Instant overshoots (⚖ planner ruling C).** The in-app rows run the queue at Instant (`freshQueue` sets
`instantMode`). `loops/loopState.js` `_advanceActionProgress` (from line 3458) completes an action in ONE frame,
whatever the mana: `deductMana` clamps the pool to 0, and `_processFrame` calls `_maybeCompleteCurrentAction` BEFORE
`_maybeResetForOOM` (lines 1563 and 1567).

So the replan's last entry COMPLETES and checks the goal in loop 1. That entry is the ⚖ Q1 attempt: Leave the Village,
costing 40 with 10 mana left, which should drain into region XP and end the loop.

AN-3a never met this, because its live path planned no attempt. `loops/loopState.js` is not edited here: an Instant
fix changes every substrate's Loop-mode rows, so the planner gives it its own Loops slice.

`an-bot-plays-to-goal` asserts:
- the replan happened;
- its reasoning is in the log;
- the goal is reached in ≤ the pure planner's loop count;
- the Q1 attempt is named in the log.

The headless 2 = 2 is the exact pin.

**Sample reasoning logs.**

Headless (`node scripts/procgen/action-nodes-play.mjs --live-only`):
```
Loop 1 [checks]: 34 queue entries (2 mid-loop replan(s)); acts Do Chores → Do Chores → Bribe the Guard → Guard's Locker → Train → Buy Bread → Eat Bread → Move the Boulder → Read the Notice → attempt leave-the-village
  checks: Guard's Locker, Move the Boulder; received: Pocket Money, Strength Boost; mana left 0
  | Chose: Do Chores ×2 → Bribe the Guard → Guard's Locker, earning Guard's Locker (55 mana left).
  |   Move the Boulder: short by 5 mana after Guard's Locker (alone: Train → Move the Boulder, 40 mana left).
  | (replan) Chose: Train → Buy Bread → Eat Bread → Move the Boulder, earning Move the Boulder (20 mana left).
  | (replan) No check can be earned this loop. Closest: Leave the Village, short by 30 mana (Read the Notice → Leave the Village).
  | (replan) Spending it for region XP: Read the Notice, then attempting Leave the Village with 10 mana.
Loop 2 [goal]: 24 queue entries; acts Do Chores → Do Chores → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village
  checks: Leave the Village; received: Victory; mana left 5
  | Goal reachable: Leave the Village via Do Chores ×2 → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village (8 performances, 5 mana left).
live bot path: goal in 2 loop(s)
```

In-app (`an-bot-plays-to-goal`, the bot's `getLog()` with logReasoning on):
```
loop 1: Chose: Do Chores ×2 → Bribe the Guard → Guard's Locker, earning Guard's Locker (55 mana left).
loop 1:   Move the Boulder: short by 5 mana after Guard's Locker (alone: Train → Move the Boulder, 40 mana left).
loop 1: Chose: Do Chores ×2 → Bribe the Guard → Guard's Locker, earning Guard's Locker (55 mana left). (action 1 of 7, mana 100 left)
loop 1 (replan): Chose: Train → Buy Bread → Eat Bread → Move the Boulder, earning Move the Boulder (20 mana left).
loop 1: Chose: Train → Buy Bread → Eat Bread → Move the Boulder, earning Move the Boulder (20 mana left). (replanned mid-loop) (action 8 of 24, mana 55 left)
loop 1 (replan): No check can be earned this loop. Closest: Leave the Village, short by 30 mana (Read the Notice → Leave the Village).
loop 1 (replan): Spending it for region XP: Read the Notice, then attempting Leave the Village with 10 mana.
loop 1: No check can be earned this loop. Closest: Leave the Village, short by 30 mana (Read the Notice → Leave the Village). (replanned mid-loop) (action 25 of 33, mana 20 left)
loop 2: The goal is done.
finished — 1 loop
pure planner: goal in 2 loop(s); headless live: 2; in-app (Instant): 1
```

## The click's behaviour table

The node's state is read at the END of the Loops queue (Loop mode) or live (Loop mode off).

| Node | Loop mode on | Loop mode off |
|---|---|---|
| `ready`, the queue ends on it | queues one `act` | performs once at once (`actNow`; the pool pays) |
| `ready`, the queue ends elsewhere ("unreached") | queues the free hops to it, then one `act` | the same moves, then performs once |
| `blocked` (a requirement) | refused by name: `Eat Bread: needs Bread 1 (has 0)`; nothing queued | the same |
| `blocked`, short only of mana | refused: `<name>: not enough mana` (a click never starts what it cannot finish; the node panel's **Queue act** still can, ⚖ Q1) | the same |
| `done` at the queue's end | refused: `Do Chores is done this loop (2/2)` | the same |
| `not-reached` | refused, naming what is still to clear: `… is not reached this loop: still to clear: Do Chores (0/2)` | the same |
| `undiscovered` | refused: `this node is not discovered yet` (it names nothing about the node) | the same |
| the start | refused: `Start is the start: it has no action` | the same |

## In-app rows

| id | category / batch | What it pins |
|---|---|---|
| `an-click-performs-once` | ActionNodes / `fast` | The strip runs only `actionNodes.act`. **Region Graph** (a card-body click): a ready node away from the queue's end → nodeSelected once, the route, ONE act, nothing performed yet; again → no hop, one more act; a blocked node → refused by name with the unmet requirement, queue unchanged; at its limit → refused (`done`); the queue runs, no refusal, performed twice. **Region Map** (`clickAt`, its own settings): the route and ONE act, `panelId` `regionMap`. **Loop mode off**: performed at once, the pool paid the price, the player on the node |
| `an-perform-all-button` | ActionNodes / `fast` | The button exactly on shown nodes with limit > 1. Its click is no node click. It queues the route + `limit` acts and the card says so. Pressed again: refused (`done`). The queue runs. Capped by mana: with the pool covering `limit − 1`, it queues `limit − 1` and names the cap |
| `an-cards-after-reopen` | ActionNodes / `fast` | Close the Region Graph panel (no graph, no card), open a new one: a card per node, no duplicate, no world reload |
| `an-bot-plays-to-goal` (updated) | Playback Bot / `playback-bot` | Ruling C: the replan happened and its reasoning is logged, the goal in ≤ the pure count, the Q1 attempt named |

`an-node-card`'s "no button" line now reads "no button on a limit-1 card". Its check node has limit 1.

Local run on this worktree's server (port 8130), at `d0d86f890f`:
```
[PROGRESS 1/19] test_node_selection PASSED 1.2s
[PROGRESS 2/19] test_region_graph_node_picker PASSED 0.8s
[PROGRESS 3/19] test_region_graph_click_default PASSED 10.8s
[PROGRESS 4/19] test_region_graph_click_master_off PASSED 1.7s
[PROGRESS 5/19] test_region_graph_click_location_check PASSED 0.5s
[PROGRESS 6/19] an-load-and-act-once PASSED 0.7s
[PROGRESS 7/19] an-refused-action-stops-queue PASSED 1.8s
[PROGRESS 8/19] an-results-reach-ledger PASSED 0.5s
[PROGRESS 9/19] an-loop-reset-restores-boosts PASSED 0.9s
[PROGRESS 10/19] an-check-once-action-repeats PASSED 1.0s
[PROGRESS 11/19] an-explore-refused PASSED 0.5s
[PROGRESS 12/19] an-discovery-sets PASSED 0.6s
[PROGRESS 13/19] an-two-way-move PASSED 0.6s
[PROGRESS 14/19] an-node-states PASSED 0.6s
[PROGRESS 15/19] an-node-card PASSED 4.9s
[PROGRESS 16/19] an-click-performs-once PASSED 1.1s
[PROGRESS 17/19] an-perform-all-button PASSED 0.8s
[PROGRESS 18/19] an-cards-after-reopen PASSED 0.9s
[PROGRESS 19/19] an-bot-plays-to-goal PASSED 1.3s
```
The rows' CI PASSED lines are quoted in the REPORT BACK; a record cannot name the runs of its own commit.

## Gates

| Gate | Result |
|---|---|
| bounded vitest: `actionNodes`, `playbackBot`, `regionGraph`, `regionView`, `loops`, `discovery`, `procgenDocs` | all pass (the last run per area: actionNodes + playbackBot 18 files / 373 tests; regionGraph + regionView + loops + actionNodes 57 / 1077; procgenDocs 8 / 497) |
| `action-nodes-compile.mjs --check` | OK, byte-identical |
| `check-sidecar-fields.mjs` | ALL PASS: 2296 entries over 10 substrates, 0 issues |
| `generate-procgen-reference.mjs --check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH (after regenerating the README index and `docsIndex.js`) |
| `check-procgen-docs.mjs` | ALL CHECKS PASSED |
| quickLaunch `generate-docs-index.mjs --check` | current |
| headless `action-nodes-play.mjs` | exit 0: pure planner 2 loops (XP scale 1 and 0); live path 2 loops, nothing refused |
| maze engine closure (`scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`) | 43 lines, sha256 prefix `a458a51c3cb725ba` (AN-3a's value at its base); closure ∩ the changed files = ∅, so it is identical at base and tip |
| byte-equality, committed presets | `git diff --name-only d358d50e02 HEAD -- frontend/presets` is empty; no generator or compiler change |
| gitlinks | 0 changed |
| D0 (`scripts/dev/region-graph-class-snapshot.mjs`, 3 presets × S1–S7, default config) | BEFORE (the modified files checked out at `d358d50e02`, same server) vs AFTER at the tip: `diff -r` **byte-identical** (22 files) |

Census: 446 → 448 (`same-doc` 43 → 45). The new links are action-nodes.md's opening paragraph → its own § The node
states and the node card and § The bot planner. The reasons are in `docLinks.test.js` and `docsRender.test.js`.

## Test paths

New:
- `frontend/modules/actionNodes/nodePerformPlan.test.js` (18)
- `actionNodes/nodeClickAction.test.js` (9)
- `regionGraph/nodeOverlayClick.test.js` (4)

Extended:
- `actionNodes/nodeCard.test.js`: the button, the message, the remount
- `actionNodes/actionLoopBot.test.js`: live = pure = 2 exactly; `continueFrom`
- `playbackBot/loopModeRunner.test.js`: the replan, no replan without divergence or mana, non-substrate unchanged,
  `appendContinuation`
- `loops/loopModeExemptions.test.js`
- `procgenDocs/docLinks.test.js` and `docsRender.test.js` (census)

In-app: `frontend/modules/tests/testCases/actionNodesTests.js` (+3 rows, 1 updated) and
`frontend/test-configs/playwright_tests_config-substrates.json`.

## Files

Code:
- `actionNodes/{nodePerformPlan,nodeClickAction}.js` (new)
- `actionNodes/{index,nodeCard,nodeCardOverlay,actionLoopBot,actionLiveSim,actionNodesLibrary}.js`
- `playbackBot/loopModeRunner.js`
- `loops/loopModeExemptions.js`: the one prefix
- `regionGraph/nodeOverlayManager.js`: the one listener, by ruling
- `regionGraph/index.js`: the additive event
- `scripts/procgen/action-nodes-play.mjs`

Docs:
- `action-nodes.md`: the opening, the reopen fix, § The click (with the behaviour table), the button and its cap rule,
  the mid-loop replan
- `playback-and-debugging.md`
- `substrate-registry.md`: `loopBot` `continueFrom`
- regenerated README and `docsIndex.js`

Not touched: `regionView/clickActions*.js`, `graphInteractionManager.js`, `layoutControlsManager.js`,
`regionGraphUI.js`, `regionMap/`, `loops/loopState.js`; CA-S4's `regions/`, `flashPanel/`, `discovery/`, `apcalc/`
and `vibeCodingSim/`; the `shared` submodule.

## What the code overturned

1. **"On a node, the click…" assumed a card click reaches the click actions.** It did not: the overlay's body click
   only published `nodeSelected`. I stopped and reported. Ruling (cc-23 option 1, the planner relayed it): the one
   listener in `nodeOverlayManager.js`, under cc-23's pins.
2. **"Prefer a fix inside ActionNodes (re-register on the panel's mount event)."** No mount event existed. The fix
   is an additive `regionGraph:panelMounted` in `regionGraph/index.js`; ActionNodes re-registers on it.
3. **After `clearQueue` the player already stands on the start node.** A click's route from there is one hop, not
   `Menu → start → node`. The planner handles both; the in-app rows derive the expected route from where the player
   stands.
4. **Instant completes an action started short of mana** (`loops/loopState.js` `_advanceActionProgress`;
   completion runs before `_maybeResetForOOM`). It surfaced once the replan put a ⚖ Q1 attempt in the live queue.
   Ruling C: a known gap, for its own Loops slice.
5. **`gameState` has no mana setter.** The row sets the pool with `deductMana`.

## The merge and CI

**CI at the pre-merge tip `9aea8d2de4`, all success:**
- unittests: 44779855768.
- JSUT (dispatch): 44779906032. Suite 29214 passed / 0 failed over 1383 files; slow 438/438.
- `train_only`: 44779901116, 3/3 shards.
- TT: 44779911026. Headroom OK for every batch:

  | Batch | Span |
  |---|---|
  | fast | 313.0 s = 52% |
  | fast bundled | 307.5 s = 51% |
  | playback-bot | 91.7 s = 15% |
  | seedling-js | 36% |
  | seedling-js-solver | 31% |
  | seedling-wasm | 23% |
  | apworld | 30% |

  `an-node-card`, `an-click-performs-once`, `an-perform-all-button`, `an-cards-after-reopen`, `test_node_selection`
  and `test_region_graph_node_picker` PASSED on both boots; `an-bot-plays-to-goal` PASSED in playback-bot.
- feature-checks: 44779915213, 69.9 s (12%).

**The merge.** Main moved to `7729ecd104` (lab-set-seedling-identity). It was merged ONCE, as `8ac5c03b4e`.
- Only the generated docs index conflicted (the procgen `README.md` and `procgenDocs/generated/docsIndex.js`). I took
  main's side and regenerated.
- The substrates config auto-merged.

Gates re-run at the merge, all green:
- bounded vitest over the seven areas: 73 files, 1817 tests;
- `action-nodes-compile.mjs --check`: byte-identical;
- `check-sidecar-fields.mjs`: ALL PASS (2296);
- `generate-procgen-reference.mjs --check`: all match;
- `check-procgen-docs.mjs`: ALL CHECKS PASSED;
- the quickLaunch docs index: current;
- `action-nodes-play.mjs`: pure 2, live 2;
- the closure: 43 lines, `a458a51c3cb725ba`; closure ∩ the diff against main = ∅;
- presets against main: none changed; gitlinks: 0.

CI at the final tip (this record's own commit) is quoted in the REPORT BACK.

## Next slice's line

The Loops Instant fix is (A), for the planner to plan: under Instant, an action whose cost exceeds the pool drains it
into region XP, does not complete, and the OOM reset fires, as at normal speed. After it, `an-bot-plays-to-goal` can
assert the exact pure count (2). CA-S4 moves the overlay card click (now `handleRegionNodeClick`) to
`regionView:regionClicked` with the other listeners.
