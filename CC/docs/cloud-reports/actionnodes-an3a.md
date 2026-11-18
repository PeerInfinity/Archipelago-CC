# ActionNodes AN-3a — the multi-entry rule, node states, the node card, the live bot (as built)

Slice AN-3a of the ActionNodes substrate (content sets arc), session `actionnodes-an3a` (Opus 5.5), 2026-11-17.
Branch `actionnodes-an3a` on AN-1b's frozen tip `origin/actionnodes-an1b` `e8f7f17152` (queued as TRAIN 143, not on
main yet). Planner: `concept-library-content-planning-3`. The first half of design Slice 3. **No click code**: the click
(perform once) and the "perform all remaining" button are AN-3b, after the click-actions series (CA-S2/CA-S3).

Rulings it builds on: Robert 2026-11-16T17:41:55Z (movement), 19:59:48Z (discovery), 2026-11-17T21:35:22Z (the click:
a separate perform-all button on repeatable nodes, default click = once, no right click); the planner's multi-entry
ruling (REPLAN 2026-11-17); the planner's ruling (a) on the overlay API (below).

## The parts as built

### 0. The multi-entry rule — `043185c963`

EVERY exit, forward or reverse, is open iff its TARGET is reached this loop; a node is reached when it is the start, or
when one of its `after` sets is fully cleared this loop.

- **Runtime** (`actionNodes/actionNodesRuntime.js` `whyNotLeave`): the forward case moved from "source cleared" to
  "target reached" (the reverse case already used it). A forward exit refused while its own source is not cleared keeps
  `not-cleared` with the count (on a one-member set that is the whole reason, so AN-1b's rows and texts are unchanged);
  refused with the source cleared (a multi-member set) it is `target-not-reached`, naming the members still to clear
  (`unclearedAfterText`). A move that names no exit of the node keeps "source cleared".
- **Compiler**: no change was needed. `compileActionGraph` already writes every forward exit A→B with B's reach rule
  (`logic.reach[B]`: "some one-loop plan reaches B"), which IS "the target is reached". On one-member sets that equals
  "source cleared". **The example preset is byte-identical** (`action-nodes-compile.mjs --check` OK at every commit).
- **Pins** (`actionNodes/actionNodesMultiEntry.test.js`, 8 tests): a TEST-ONLY fixture graph (the example with two
  `after` lists re-pointed, never committed as a preset): AND `after: [[Do Chores, Train]]` — both exits shut until both
  are cleared (with Do Chores cleared: Do Chores' exit `target-not-reached` naming Train, Train's `not-cleared`), then
  both open; the reverse exits follow; a reset shuts them. OR `after: [[Do Chores], [Train]]` — clearing either opens
  BOTH exits. The compiler side: every forward exit into the same node carries the same rule (its reach rule).

### 1. The node states — `f77cd108bd`

`actionNodes/nodeStates.js`, one pure function over the node data (the runtime model) and a loop state:

| State | When (in precedence order) |
|---|---|
| `undiscovered` | the discovery module has not discovered its region (the card shows the placeholder) |
| `done` (start) | the start node, cleared from the beginning |
| `not-reached` | no `after` set is cleared this loop |
| `done` | its limit is used up this loop |
| `blocked` | reached, performances left, a requirement unmet — `unmet: {code, text}` names it (`stat`, `resource`, or "would leave X below 0") |
| `blocked` + `not enough mana` | short ONLY of mana (`unmet: {code: 'mana', text: 'not enough mana'}`); a requirement outranks it |
| `ready` | reached, performances left, every requirement met, the pool covers its live (XP-discounted) price |

Each entry also carries `count`, `limit`, `price`. `queueEndState` walks the uncompleted `act` entries of a Loops queue
from the live state (a move changes nothing; it stops where the queue would: a gate refusal or an act the mana cannot
finish); `viewStateOf` picks **the queue's END while it is planned, the live state while it runs**. The runtime gains
`liveCosts()`, `liveViewState()` (the pool's real mana) and `nodeStates({running, queue, isDiscovered})`.

### 2. The node card — `f7e2921c70`

- `actionNodes/nodeCard.js`: `nodeCardModel` (pure), `cardVisibility` (the view model's shown/placeholder/hidden rule
  over the node exits), `renderNodeCard` / `updateNodeCard`, `createNodeCardProvider` (the overlay manager's
  `{create, update}` interface; the view is computed once per refresh, memoised per microtask and keyed on the
  runtime's model so a world switch inside one task cannot serve a stale view).
- The card: name; marks `🏁` (goal), `✓` (its location checked), `used/limit`; the live mana price; `needs`; `gives`
  (mana included); the unmet line marked (`.an-card__unmet`) and its text; the state on `data-state` and the border.
  An undiscovered node shows `???` and nothing else; a node with no way in from a discovered node is not drawn.
- **The reserved slot for AN-3b's "perform all remaining" button**: every card ends with an EMPTY, hidden
  `<div class="an-card__actions" data-slot="perform-all-remaining">` (`PERFORM_ALL_SLOT`), placed after the unmet line.
  AN-3b fills it on a repeatable node (limit > 1) and shows it. No button and no listener exist on the card now (pinned
  in vitest and in-app).
- `actionNodes/nodeCardOverlay.js` (wired in `actionNodes/index.js`): after every rules load, an ActionNodes world →
  `regionGraph.registerNodeOverlayProvider` (once), any other world → `regionGraph.unregisterNodeOverlayProvider`
  (once). Refreshes (one per microtask) on the runtime, the ledger, mana, the path, the Loops queue and its
  processing/pause events, XP, discovery and snapshots.
- **The overlay API, STOP-AND-REPORT → planner ruling (a).** The API could not REMOVE a provider unchanged:
  `NodeOverlayManager.unregisterProvider()` was not reachable from outside; `registerNodeOverlayProvider(null)` leaves
  stale cards; a provider left registered pre-sizes every node of every world to 120×80 and leaves the overlay's arrow
  style on the shared cytoscape instance (not recreated on a rules reload). Ruling (a): ONE additive edit in
  **`regionGraph/index.js`: a public `unregisterNodeOverlayProvider()`** (registered beside
  `registerNodeOverlayProvider`) that clears the pending provider and calls `overlayManager.unregisterProvider()` on
  every panel. `nodeOverlayManager.js` is untouched. Pinned in-app (`an-node-card`, below). CA-S2 also edits
  `regionGraph/index.js` (its settings schema): whichever lands second re-merges that file.
- **Known limit (out of scope, per the planner):** a provider registered before any Region Graph panel exists waits in
  ONE pending slot that the first panel takes; a closed and reopened panel shows no card until the next world load.

### 3. The live bot — `f70b15fe3e`

- **The registry entry declares `loopBot.planLoop(context)`** (`actionNodesLibrary.js` → `actionLoopBot.js`
  `planLiveLoop`): `actionPlanner.planLoop` over the runtime's model made planner-shaped (`plannerModelOf`: the block's
  settings, the check nodes, boons uncapped), with the LIVE inventory, checks, region XP and pool — the goal as soon as
  reachable, else the most new checks, else the most region XP (A17). The plan becomes a Loops path (`routeOfPlan`):
  `Menu → start`, then per performance the free hops from where the player is (`hopsBetween`: a shortest path over
  exits whose TARGET is reached at that point of the plan, so under the multi-entry rule the start gate never refuses
  a hop), then the `act` entry; an `attempt` is the last act (it drains the pool into region XP, ⚖ Q1).
- **The seam** (`playbackBot/substrateLoopPlanner.js`, pure): `substrateLoopPlannerOf(rulesJson, playerId, registry)`
  returns the planner ONLY when every region but the world's declared start regions has a sidecar naming ONE substrate
  whose entry declares `loopBot.planLoop`; else null. `loopModeRunner._runLoop` asks it (`deps.substrateLoopPlanner`,
  wired in `playbackBotPanel.js`) before `planNextLoop`; `_substratePlan` builds the context `{startRegion, maxMana,
  inventory, checkedLocations, regionXp}` (`regionXp` = TOTAL XP: `totalRegionXp`, since gameState keeps only the
  progress inside the level); `done` finishes, `unreachable` waits, a throw is a named wait; the unplayable-substrate
  wait is skipped for it (its entries are its own queue verbs). The rest of the glue is the runner's own.
- **Other worlds untouched, pinned:** `substrateLoopPlanner.test.js` reads EVERY committed preset (227 rules files):
  only `action_nodes*` worlds get a planner, and ActionNodes is the only entry declaring `loopBot`;
  `loopModeRunner.test.js` "with no substrate planner (null) the plan is planNextLoop's, exactly as before" (paths and
  statuses deep-equal to a runner without the dep).
- **Reasoning log:** the planner's lines go to `deps.onReasoning`, prefixed `loop N:`; the bot UI
  (`playbackBotUI.js`) appends them to `getLog()` and prints them to the console behind the new **`logReasoning`**
  setting (checkbox "Log the loop plan's reasoning", localStorage `playbackBot_logReasoning`, declared in
  `playbackBot/index.js` `storage`, OFF by default). The status shows each loop's reason either way.
- **Headless:** `actionNodes/actionLiveSim.js` `playLiveToGoal(rules)` plays the live paths through the REAL runtime:
  every entry through `runtime.gate`, every act charged its live price from a pool, XP earned, the check's item arriving
  as a snapshot. `scripts/procgen/action-nodes-play.mjs` runs it after the pure planner runs (`--live-only` for just
  it); a refused hop or act exits 1.

### A defect the slice's own row found — `6aee54734b`

`an-node-card` first failed with Move the Boulder showing `✓` but `0/1`, `not-reached`, while the pool still held the
spent mana and no reset had happened. Diagnosed in-app: no `stateManager:snapshotUpdated` arrived between the load and
the check, so the check's own snapshot became the runtime's boost BASELINE, and `_startLoop('baseline')` wiped the
loop's counts mid-loop (train 1→0, move-the-boulder 1→0) and swallowed the received item's boost (AN-2 code). Fixed in
`ActionNodesRuntime.onSnapshot`: the baseline restarts the loop only while nothing has been performed; after that, what
is held was received during the loop and applies at once (A4). Pinned in `actionNodesRuntime.test.js` ("a baseline
that arrives AFTER a performance keeps the loop and applies what is held at once"). The other rows never saw it because
a snapshot happened to arrive earlier in their order.

## Sample reasoning logs

Headless (`node scripts/procgen/action-nodes-play.mjs --live-only`):

```
=== live bot path (loopBot.planLoop → the Loops queue → the runtime gate) ===
Loop 1 [checks]: 8 queue entries; acts Do Chores → Do Chores → Bribe the Guard → Guard's Locker
  checks: Guard's Locker; received: Pocket Money; mana left 55
  | Chose: Do Chores ×2 → Bribe the Guard → Guard's Locker, earning Guard's Locker (55 mana left).
  |   Move the Boulder: short by 5 mana after Guard's Locker (alone: Train → Move the Boulder, 40 mana left).
Loop 2 [checks]: 19 queue entries; acts Do Chores → Do Chores → Train → Buy Bread → Eat Bread → Move the Boulder
  checks: Move the Boulder; received: Strength Boost; mana left 55
  | Chose: Do Chores ×2 → Train → Buy Bread → Eat Bread → Move the Boulder, earning Move the Boulder (55 mana left).
Loop 3 [goal]: 24 queue entries; acts Do Chores → Do Chores → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village
  checks: Leave the Village; received: Victory; mana left 5
  | Goal reachable: Leave the Village via Do Chores ×2 → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village (8 performances, 5 mana left).
live bot path: goal in 3 loop(s)
```

In-app (`an-bot-plays-to-goal`, the bot's `getLog()` with logReasoning on):

```
loop 1: Chose: Do Chores ×2 → Bribe the Guard → Guard's Locker, earning Guard's Locker (55 mana left).
loop 1:   Move the Boulder: short by 5 mana after Guard's Locker (alone: Train → Move the Boulder, 40 mana left).
loop 1: Chose: Do Chores ×2 → Bribe the Guard → Guard's Locker, earning Guard's Locker (55 mana left). (action 1 of 7, mana 100 left)
loop 2: Chose: Do Chores ×2 → Train → Buy Bread → Eat Bread → Move the Boulder, earning Move the Boulder (55 mana left).
loop 2: Chose: Do Chores ×2 → Train → Buy Bread → Eat Bread → Move the Boulder, earning Move the Boulder (55 mana left). (action 1 of 18, mana 100 left)
loop 3: Goal reachable: Leave the Village via Do Chores ×2 → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village (8 performances, 5 mana left).
loop 3: Goal reachable: Leave the Village via Do Chores ×2 → Train → Read the Notice → Buy Bread → Eat Bread → Move the Boulder → Leave the Village (8 performances, 5 mana left). (action 1 of 23, mana 100 left)
loop 4: The goal is done.
finished — 3 loops
headless live path: goal in 3 loop(s); in-app: 3
```

(The Loops queue counts one entry fewer than the written path: the runner's `clearQueue` already stands the player on
the loop start's hop.)

## In-app rows — `f85799cebe`

| id | category / batch | What it pins |
|---|---|---|
| `an-node-states` | ActionNodes / `fast` | every node's state, derived from the preset (`expectedStates`), through the app's own card view: at load; at a planned queue's END (basis `queue-end`, live counts untouched, the repeatable node `done`); after the queue ran (basis `live`, the sibling blocked by what the spender spent); after a loop reset (discovery kept, D4) |
| `an-node-card` | ActionNodes / `fast` | the Region Graph open; another world (Adventure) loaded first as the baseline; one card per node; an undiscovered node's card is `???` only; a check node played to its check: name, `1/1`, mana, needs, `✓`, `done`, the empty reserved slot, no button; the goal (revealed by that clear): `🏁`, its needs, `blocked` with the unmet line marked. Then Adventure again: no card, the overlay container empty, every node with the same classes has its original size/shape, no node keeps `has-overlay` or the card's rectangle, every edge's arrows as before |
| `an-bot-plays-to-goal` | Playback Bot / `playback-bot` | Loop mode, logReasoning on, the bot's Play: finished, the goal checked, every loop's reason in the log, the loop count equal to the headless live path's, no queue refusal |

Local, this worktree's server on port 8147 (`npm test -- --mode=test-substrates --port=8147 --test=<the 11 an-* rows>`):

```
[PROGRESS 1/11] an-load-and-act-once PASSED 0.6s
[PROGRESS 2/11] an-refused-action-stops-queue PASSED 1.4s
[PROGRESS 3/11] an-results-reach-ledger PASSED 0.4s
[PROGRESS 4/11] an-loop-reset-restores-boosts PASSED 0.7s
[PROGRESS 5/11] an-check-once-action-repeats PASSED 0.7s
[PROGRESS 6/11] an-explore-refused PASSED 0.4s
[PROGRESS 7/11] an-discovery-sets PASSED 0.5s
[PROGRESS 8/11] an-two-way-move PASSED 0.4s
[PROGRESS 9/11] an-node-states PASSED 0.4s
[PROGRESS 10/11] an-node-card PASSED 4.7s
[PROGRESS 11/11] an-bot-plays-to-goal PASSED 1.5s
```

CI PASSED lines: in the CI section.

## Gates

| Gate | Result |
|---|---|
| bounded vitest: `actionNodes`, `playbackBot`, `regionGraph`, `discovery`, `loops` (+ `loopsCostDebugger` by prefix), `procgenDocs`, `tests`, `gameState`, `regionView` | 72 files, 1858 tests, all pass |
| `action-nodes-compile.mjs --check` | OK, byte-identical (at every commit) |
| `check-sidecar-fields.mjs` | ALL PASS — 2264 entries over 10 substrates |
| `generate-procgen-reference.mjs --check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH (after regenerating for the `loopBot` row; registry 115 fields, 0 findings) |
| `check-procgen-docs.mjs` | ALL CHECKS PASSED (the box was free) |
| `scripts/quicklaunch/generate-docs-index.mjs --check` | current |
| headless `action-nodes-play.mjs` | exit 0: the pure planner reaches the goal in 2 loops (XP scale 1 and 0); the live bot path in 3, nothing refused, reasoning printed |
| maze engine closure (`seedlingDerivedRuleTable.js --print-engine-closure`) | 43 lines, sha256 prefix `a458a51c3cb725ba` — AN-1b's value at the base; closure ∩ the changed files = ∅ |
| byte-equality, committed presets | no file under `frontend/presets/` changes (`git diff --name-only e8f7f17152 -- frontend/presets` empty) |
| byte-equality, generated presets | no generator, pipeline or compiler code changes (the compiler file is untouched), so the 25 generated presets cannot move; not re-probed |

Census: 437 → 440 (`doc` 329 → 332: the registry's `loopBot` row → action-nodes.md § The bot planner, that § ⇄
playback-and-debugging.md § The playback bot), reasons in `docLinks.test.js` and `docsRender.test.js`.

## Test paths

New: `frontend/modules/actionNodes/actionNodesMultiEntry.test.js`, `nodeStates.test.js`, `nodeCard.test.js`,
`actionLoopBot.test.js`; `frontend/modules/playbackBot/substrateLoopPlanner.test.js`. Extended:
`actionNodes/actionNodesRuntime.test.js` (the late baseline), `playbackBot/loopModeRunner.test.js` (the seam, 4 tests),
`procgenDocs/docLinks.test.js`, `docsRender.test.js` (census). In-app: `frontend/modules/tests/testCases/actionNodesTests.js`
(+3 rows) + `frontend/test-configs/playwright_tests_config-substrates.json`.

Code: `actionNodes/{actionNodesRuntime,nodeStates,nodeCard,nodeCardOverlay,actionLoopBot,actionLiveSim,actionNodesLibrary,index}.js`;
`playbackBot/{substrateLoopPlanner,loopModeRunner,playbackBotPanel,playbackBotUI,index}.js`; `regionGraph/index.js` (the
one additive function); `scripts/procgen/action-nodes-play.mjs`. Docs: `action-nodes.md` (§ The runtime, new § The node
states and the node card, § The bot planner, § The scripts, § The registry entry), `playback-and-debugging.md`,
`substrate-registry.md` (`loopBot` row); regenerated README, docsIndex, registry/capabilities/instruments,
`features/procgen-substrates.md`.

Not touched (the click-actions series' files): `graphInteractionManager.js`, `layoutControlsManager.js`,
`regionGraphUI.js`, `regionView/clickActions*.js`, `regionView/regionActions.js`, `regionMap/`,
`loops/loopModeExemptions.js`; `nodeOverlayManager.js`; the `shared` submodule.

## What the code overturned

1. **§ Slice 3 / the brief's part 2 "without editing either file"**: the overlay API had no remove. Stopped and
   reported; planner ruling (a): the one additive `unregisterNodeOverlayProvider()` in `regionGraph/index.js`.
2. **Part 0's compiler half needed no change**: the forward exit's rule was already the target's reach rule.
3. **AN-2's baseline snapshot reset the loop mid-loop** when the first snapshot after a load came with a check (above).
   Fixed in the runtime, pinned.
4. **The live bot takes one loop MORE than the pure headless planner** on the example (3 vs 2): `playToGoal` replans
   mid-loop the moment a check's item arrives (design §7), while the live runner writes ONE plan per loop as the Loops
   queue; the item's boost applies at once (A4), but the queue is not extended. Both reach the goal; the in-app run
   equals the headless LIVE path (3). Replanning mid-loop in the live runner is a possible follow-up, not built.
5. **gameState keeps region XP as progress inside the level** (`{level, xp}`), not the total the planner's
   `levelFromXP` takes: the runner converts (`totalRegionXp`).
6. **`getActionNodesRuntime().model` is not planner-shaped** (no `settings`, no `checkIndices`, boons without `count`):
   `plannerModelOf` adds them rather than changing the runtime model.

## CI

**The merge.** AN-1b landed in TRAIN 143 as main `9c658aba76`; it was merged ONCE into this branch as `8c75ad7ac8`.
Only the two generated files conflicted (`docs/json/developer/procgen/README.md`'s docs index and
`procgenDocs/generated/docsIndex.js`): main's side taken, then regenerated by `generate-procgen-reference.mjs`. Census
re-measured at the merge: 440 (main 437 + this slice's 3), unchanged pins. Gates re-run at the merge, all green:
bounded vitest `actionNodes` + `playbackBot` + `regionGraph` + `procgenDocs` (27 files, 842 tests, including
`generated.test.js`'s `--check`); `action-nodes-compile.mjs --check` byte-identical; `check-sidecar-fields.mjs` ALL
PASS (2264); `generate-procgen-reference.mjs --check` all match; `check-procgen-docs.mjs` ALL CHECKS PASSED; the
quickLaunch docs index current; `action-nodes-play.mjs` exit 0 (pure 2 loops, live 3); maze engine closure 43 lines,
`a458a51c3cb725ba` (identical to the base), closure ∩ the files changed against main = ∅; no file under
`frontend/presets/` differs from main; 0 gitlinks changed against main.

**CI before the merge, at `e8ce23fc25`** (all success): unittests 44186715099; JSUT (push) 44186715094, 28481 passed /
0 failed over 1328 files, slow 437/437; `train_only` 44186731365, 3/3 shards; TT 44186735873, headroom OK for every
batch (fast 268.7 s = 45%, fast bundled 275.8 s = 46%, playback-bot 74.2 s = 12%, seedling-js-solver 31%, apworld 34%,
seedling-wasm 30%, seedling-js 36%), the nine `an-*` fast rows PASSED on both boots and `an-bot-plays-to-goal` PASSED in
playback-bot; feature-checks 44186741183, 71.5 s (12%).

**CI at the final tip** (this report's own commit, on top of the merge): unittests and JSUT on push, `train_only`, TT and
feature-checks dispatched there. Their run ids, the suite number, the headroom lines and the `an-*` PASSED lines are
quoted in the REPORT BACK to the planner and in the project memory's AN-3a line, since a record cannot name the runs of
its own commit.

## Next slice's line

AN-3b (after CA-S2 + CA-S3): the registered click action `actionNodes.act` (perform ONCE; R8 queues the route first; its
own loop-mode planning prefix in `loops/loopModeExemptions.js`) and the "perform all remaining" button in the card's
`.an-card__actions[data-slot="perform-all-remaining"]` on a repeatable node (limit > 1), queueing the route and the
remaining acts. Both read `runtime.nodeStates({queue})` for the queue's end, and the route is `actionLoopBot.hopsBetween`
(reached targets only, never refused). Open: the pending-slot limit of the overlay API; mid-loop replanning in the live
runner.
