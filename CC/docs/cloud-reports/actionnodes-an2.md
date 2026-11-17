# ActionNodes AN-2 — the runtime, the `act` verb, the ledger (as built)

Slice AN-2 of the ActionNodes substrate (content sets arc), session `actionnodes-an2` (Opus 5.5), 2026-11-16.
Branch `actionnodes-an2` on origin/main `b7b8822633`. Design: the substrate design's §10 Slice 2 (§2 loop mode and
mana, §3 the `act` verb, §5 cross-substrate items and the panel, §8 region XP), AN-1's as-built and its "Next slice's
line", and the 2026-11-15 rulings (low-mana start allowed; logic derived; the verb is "act"; each item's
starting-mana boost configurable, default 10; the example keeps 0). Developer pages: `action-nodes.md` § The runtime,
`loop-recording.md` § The start gate, `substrate-registry.md` (Loop mode and Cross-substrate sharing rows).

The world now plays in the browser, in and out of Loop mode, through the Loops panel and the substrate's own panel.
The Resources panel is in this slice; it did not move to slice 3.

## The runtime and the `act` verb

| File | What |
|---|---|
| `frontend/modules/actionNodes/actionNodesRuntime.js` | The loaded world. `runtimeModelOf(block, payloads)` builds a model in `buildActionModel`'s shape from `action_nodes[p]` and the node payloads, so "can this node be performed" is AN-1's `actionModel.whyNot` (one rule for the search, the bot and the runtime). Keeps per-loop counts, the checks it sent and the nodes it published as discovered. `gate`, `perform`, `actNow`, `onActionCompleted`, `onSnapshot`, `onLoopReset`, `onItemGranted`, `snapshot`. No DOM; every effect goes through an injected `env`. |
| `frontend/modules/actionNodes/index.js` | The module: registers the entry and the panel, wires the runtime to `stateManager:rawJsonDataLoaded`, `stateManager:snapshotUpdated`, both reset events, `loop:actionCompleted` and `crossSubstrate:itemGranted`. Public functions `getRuntimeSnapshot`, `getRuntime`. In `modules.json` and the bundled boot. |
| `frontend/modules/actionNodes/actionNodesPanel.js` | The substrate's own panel (component `actionNodesPanel`): the node the player is at: name, n/limit, XP-adjusted price, needs, gives, its check, why it cannot be performed, one button, and its exits (open once the node is cleared). Content from a pure `actionNodesPanelModel`. |
| `frontend/modules/shared/procgen/loopCustomActions.js` (submodule) | The table keyed by a `customAction`'s `actionName`: `explore` (move cost × `DEFAULT_EXPLORE_MULTIPLIER`, `loop:exploreCompleted` through the dispatcher, "Explore R": exactly as before) and `act` (the region's `actions.act`, `loop:actionCompleted` on the event bus, labelled by the node's name from `params.label`). A stated `regions[r].actions[<name>]` wins for any row; no committed world states `actions.explore`. |

**The verb.** A queue entry `{type: 'customAction', actionName: 'act', params: {nodeId, label}, sourceRegion}`. Every
site that treated every custom action as an explore now reads the table: `loopState._calculateActionCost` (cost data
loaded), `_applyActionEffects` (completion), `actionQueueManager.getActionQueue` (which entries run), `loopUI` (row
label, current-action name, cost estimate), `loopBlockBuilder` (stats line), `shared/queueAnalysis.js` (Loop Stats).
The explore-repeat check now also requires `actionName === 'explore'`. `queueAction` passes `params` through. The
no-cost-data branch and the summary branch are unchanged (an `act` never reaches either in an ActionNodes world).

**The start gate.** `loopSupport.actionGate(action) → {ok, reason, code}`, asked by the generic executor in
`_processFrame` when the current entry's progress is 0. ActionNodes refuses an `act` whose node is not reached, whose
limit is used up, whose requirement is unmet or whose result would take a resource below 0 (`whyNot` with
`ignoreMana`), an `act` queued in another region than the node it names (`wrong-region`), and a `regionMove` out of a
node not cleared this loop (`not-cleared`, "Do Chores is not cleared this loop (1/2): its exits open after the
action"). A refusal calls `stopProcessing`, records `loopState.lastActionRefusal` (index, actionName, region, label,
reason, code, substrate; public function `loops.getLastActionRefusal`), publishes `loops:actionRefused`, and the Loops
panel's state banner says "Loop queue stopped — <entry> in <region> was refused: <reason>". The entry is not
skipped. A gate that throws refuses, naming the throw. A loop reset and a rules load clear the record. Mana is not
part of the gate (⚖ Q1): an `act` started short drains what is left, as every Loops action does.

**Authored costs and `xpGainScale`.** The entry declares `loopSupport.authoredCosts`; the `shared` cost class
`authored` (below) copies each node's compiled entry. `costDataManager.getRegionActionCost(region, name)` and
`getRegionXpGainScale(region)` (default 1). The scale is applied where region XP is awarded: `loopState.addRegionXP`
(the generic timer and `_spendMana`) and `resourceChannels.chargeMana`. At 1 the amount is passed unchanged, so no
world without the field earns differently.

**Outside Loop mode.** The panel's **Act** calls `runtime.actNow`: it charges the shared pool the XP-adjusted price
(`chargeMana`, region XP to the node), performs, and at zero fires the loop-reset teleport. Short of mana, what is left
is spent, the action does not complete, and the loop resets. An open exit is a button that moves there
(`user:regionMove`). **In Loop mode** the button is **Queue act**: it appends an `act` entry when the queue ends at
the node, else says to queue a move there first (routed clicks are slice 3).

**One performance** (`perform`): the results go to the ledger (all or nothing), `results.mana` to the pool
(`gainMana`). The first time a node is cleared, its exits are published as discovered (`loop:exploreCompleted` with
`discoveredExits`, dispatcher, `fromLoop` as the caller's); discovery is never reset. A check or goal node sends its
location once (`user:locationCheck`), skipped when the snapshot already lists it checked.

## The ledger and both resets

`frontend/modules/resourceChannels/resourceLedger.js`: one `ResourceLedger` (`getResourceLedger()` in
`resourceChannelsLibrary.js`), configured by its owner for the loaded world. `getStat`, `getResource`, `snapshot()`,
`apply(delta, {source})` (all or nothing; refuses `stat-would-go-down`, `resource-below-zero`, `unknown-stat`,
`unknown-resource`, `not-an-integer`, `ledger-not-configured`), `resetRun(totals)` (every value to 0 plus the
totals), `setBoosts` (display). Every change publishes `resourceChannels:ledgerChanged`.

- **Boosts (A4).** The runtime reads the inventory from each `stateManager:snapshotUpdated`. A boost's count rising
  applies the difference to the ledger AT ONCE, and its `mana` with `gainMana`. The first snapshot after a load is
  the baseline (held items are already in the loop's start), so nothing is gained twice.
- **Both resets.** `gameState:loopReset` (the substrate reset, including outside Loop mode) and `loopState:loopReset`
  (Loops' own, also fired by a rules load) each start a new loop: counts to zero with the start cleared,
  `resetRun(held boost totals)`.
- **Cross-substrate grants.** The resources are also declared under `sharing.items`, so
  `grantItem({to: 'action_nodes', itemType: 'gold'})` lands in the ledger.

## The per-item starting mana

`gameState.setPerItemManaTable(table, defaultMana)` (`state.js`): with a table, the item term of `maxMana` is
Σ count × (the item's row, else `defaultMana`); with `null`, it is `items × manaPerItem`, exactly as before. The table
is set by the runtime on load from `action_nodes[p].boosts[*].mana` with `mana_per_item_default` (10), and cleared
when a world without a block loads. `reset()` does not touch it (it belongs to the loaded world);
`includePerItemMaxMana` still governs the whole item term. In the example both boosts state 0, so its starting mana is
100 whatever is held; a boost with no stated `mana` gives 10 (tested on a copy of the block).

**The non-ActionNodes pin:** `gameState/state.test.js` "⛔ PIN: with no table (every non-ActionNodes world) maxMana is
the flat count × manaPerItem, unchanged", plus "every row at the default agrees with the flat term exactly".

## The panels

- **Resources** (`resourceChannels/resourcesPanel.js`, component `resourcesPanel`, title "Resources", category Loop
  Mode Modules): the mana line (current / starting), and for each substrate of the loaded world (procgenPlayer's
  warehouse) that declares a sharing category: its categories, the ledger's stats and resources when it owns the
  ledger, and the boosts in effect ("Pocket Money: 1 held: Gold +5"). Content from a pure `resourcesPanelModel`.
  Other games' item counts are not shown (they live in those games; a report event per bridge is later work).
- **Action Nodes** (`actionNodes/actionNodesPanel.js`), above.

## Registry and the `shared` submodule

The entry (`actionNodesLibrary.js`) now declares:

- `loopSupport: {queueActions: ['regionMove', 'act'], manual: false, authoredCosts: true, actionGate}`.
- `sharing: {mana: {}, items: {getTypes}, stats: {getTypes}, resources: {getTypes}}`, each list from the loaded world.

Submodule commit **`71b77deb8a9a4b2f3f6954ba863f5b71f2c2277c`** on `PeerInfinity/archipelago-shared` `main`
(pushed `56bf362..71b77de`; `merge-base --is-ancestor 71b77de origin/main` → yes):
`procgen/substrateRegistry.js` (categories `stats`, `resources`; `SHARING_TYPE_LIST_CATEGORIES`, one validator for the
three type-list categories), `procgen/loopCostGenerator.js` (`REGION_CLASS.AUTHORED`, tested first;
`writeCostsByClass` copies an authored region's entries and locations from `authoredBlock`, default `inputBlock`),
`procgen/loopCustomActions.js` (new), `queueAnalysis.js`, and their tests. Gitlink bump in its own outer commit
`1b2589cbd3` ("gitlink: frontend/modules/shared 56bf362 → 71b77de"). The Loops panel's Generate Costs passes the
loaded block as `authoredBlock` (`loopsCostDebugger/costPlanner.js`, `loopUI.js`).

Capability chart: L2 words `act` ("performing each node's action"); two new rows, **L12** "The host keeps its
per-loop stats" and **L13** "… resources" (ActionNodes ✓ "its list comes from the loaded world's own data", every
other substrate ✗). L8 ("play outside loop mode") and L9 (mana) are now ✓ for ActionNodes; L6 (Bot block) stays ✗
until slice 3.

## Byte-equality

- **No committed world moves.** `authored` is the first rule of `classifyRegion` and only `loopSupport.authoredCosts`
  reaches it; no other substrate declares it. `check-loop-costs-one-model.mjs`: ALL PASS, 5 documents byte-identical
  between the pipeline's block producer and the panel's planner. `loopCostGenerator.test.js` adds the AUTHORED rows
  (verbatim pass-through, nothing written with no authored block, the coarse region beside it priced as before).
- **`xpGainScale`** at its default multiplies by exactly 1, and the code passes the amount unchanged then.
- `action-nodes-compile.mjs --check`: the committed preset is untouched (no file under `frontend/presets/` changed).
- **The `train_only` dispatch** at the code tip `2d820c2e3f`: run 43916943582, all three train shards success.
- **The maze engine closure** (`seedlingDerivedRuleTable.js --print-engine-closure`): 43 files at the tip (sha256
  prefix `a458a51c3cb725ba`; AN-1 measured 43 at its base); the intersection of the closure with every file this slice
  changed (outer and `shared`) is empty, so the closure is identical at base and tip.

## In-app rows

`frontend/modules/tests/testCases/actionNodesTests.js`, category **ActionNodes**, in batch `fast` (no `testBatches.js`
entry; `fast` takes the category). Each row loads `presets/action_nodes_example/AP_1` itself, empties the queue
(`clearQueue`), runs at instant speed, reads every number from the preset, and puts the flags back (loop mode off).

| id | What it pins |
|---|---|
| `an-load-and-act-once` | the act entry is in the queue under the node's name; one performance; its result in the ledger; the pool paid the authored price |
| `an-refused-action-stops-queue` | a move out of a node at 1/limit, and an act with an unmet requirement: each stops the queue at that entry, names it and the reason, spends nothing, skips nothing |
| `an-results-reach-ledger` | a repeatable earner then a node that spends and makes: every ledger resource is the sum of the results |
| `an-loop-reset-restores-boosts` | earns the check whose item is a boost, then both reset flows: ledger = base + boost, counts zero, pool = starting mana = 100 + the boost's `mana` |
| `an-check-once-action-repeats` | the route to a check run twice: the check is sent once, the act entries stay, every act is performed again in loop 2 |
| `an-explore-unchanged` | an explore entry on a node: move × multiplier, passes the gate, completes as an explore, performs no node |

PASSED lines (TT run 43916939268 at `2d820c2e3f`, both boots):

```
fast batch:                [PROGRESS 86/107] an-load-and-act-once PASSED 0.2s
                           [PROGRESS 87/107] an-refused-action-stops-queue PASSED 0.4s
                           [PROGRESS 88/107] an-results-reach-ledger PASSED 0.3s
                           [PROGRESS 89/107] an-loop-reset-restores-boosts PASSED 0.5s
                           [PROGRESS 90/107] an-check-once-action-repeats PASSED 0.6s
                           [PROGRESS 91/107] an-explore-unchanged PASSED 0.3s
fast batch (bundled boot): the same six rows PASSED, 0.2–0.6s
```

## Test paths

New: `frontend/modules/actionNodes/actionNodesRuntime.test.js` (20), `actionNodesPanel.test.js` (5),
`frontend/modules/loops/actVerb.test.js` (10), `frontend/modules/resourceChannels/resourceLedger.test.js` (7),
`frontend/modules/shared/procgen/loopCustomActions.test.js` (6). Extended: `shared/procgen/loopCostGenerator.test.js`
(+3), `shared/procgen/substrateRegistry.test.js` (+2), `gameState/state.test.js` (+5). Moved, with the reason in the
file: `procgenCore/substrateCapabilities.test.js` (PLAN_IDS gains L12, L13), `procgenDocs/docLinks.test.js` and
`docsRender.test.js` (census 429 → 434: `doc` 323 → 326, `same-doc` 40 → 42).

Bounded vitest, local: `loops/`, `resourceChannels/`, `actionNodes/`, the four `shared` files, `procgenDocs/`,
`procgenCore/`, `quickLaunch/`, `gameState/`, `loopStats/`, `frontend/app`: 151 files, all pass after the census move;
`tests/`, `scripts/build`: 26 files pass. `generate-procgen-reference.mjs --check`: ALL 7 GENERATED MODULES AND 5
MARKDOWN REGIONS MATCH (0 findings after the registry rows were documented). `check-sidecar-fields.mjs`: ALL PASS,
2264 entries over 10 substrates. `generate-docs-index.mjs --check` (Quick Launch): current. `check-procgen-docs.mjs`
was not run locally: it takes the box, which another session's probe held throughout.

## CI at the code tip `2d820c2e3f`

| Run | Result |
|---|---|
| `unittests` push 43916926957 | success (ubuntu 3.13 hosting, 3.11.2) |
| `JavaScript Unit Tests` push 43916926869 | success: suite `vitest (unfiltered)` 28208 passed, 0 skipped, 0 failed; slow battery 437/437; headless procgen gates, producer `--checks` and every browser gate shard success |
| `train_only` 43916943582 | success, train shards 1–3 |
| TT 43916939268 | success: fast 260.5 s of 600 (43%), fast bundled 262.2 s (44%), playback-bot 72.5 s (12%), seedling-js-solver 196.7 s (33%), apworld 160.1 s (27%), seedling-js 214.8 s (36%), seedling-wasm 137.3 s (23%); all HEADROOM OK; the six ActionNodes rows PASSED on both boots |

Gitlinks in the slice: 1 (`frontend/modules/shared` → `71b77de`, an ancestor of archipelago-shared `origin/main`).
The commit carrying this report is docs-only; the runs at the final tip are quoted in the report back.

## What the code overturned

1. **The compiled world has forward exits only, so its goal cannot be reached by play.** The compiler writes one exit
   per `after` edge (start → 4 nodes; do-chores → buy-bread, bribe; train → boulder; bribe → locker; boulder → goal;
   five nodes have no exit at all). The search, the planner and the design (A10, "backtracking is free") treat
   movement as free between reached nodes, but the Loops queue, procgenPlayer and the Region Graph move only over
   exits, so in the browser one loop is one forward path from the start and the goal's witness (Do Chores ×2 →
   Train → Read the Notice → Buy Bread → Eat Bread → Boulder → Leave) is not walkable. Not fixed here: the fix is the
   compiler's and regenerates the committed preset, which this slice must not change (⚖ planner: its own small
   slice after AN-2 and PL-2 land, with the preset's switch to pack ids). Every in-app row is a forward route.

   **Recommended exit shape: a return exit from every node to the start**, named apart from the forward exits
   (`<node> -> start (return)`, or an exit `kind: 'return'` in the payload), `moveCost` 0 (the node's region already
   moves for 0), rule `True`, and **open whatever the node's state** — the start gate exempts it. Why:
   - *To the start, not to the predecessor.* Every node reached this loop is reachable from the start by forward
     exits through nodes already cleared (that is what "reached" means), so start + forward edges already give the
     search's free movement with one extra exit per node. Return-to-predecessor needs one per `after` edge and makes a
     route back as long as the node's depth (Guard's Locker → Train: 4 hops instead of 2), and every hop is a queue
     entry the player reads.
   - *Ungated.* The gate refuses a move out of a node not cleared this loop. Applied to the return exit, a player who
     walks into a node they cannot perform (Eat Bread with no bread) would be stuck until the loop ends. The gate
     must keep refusing the FORWARD exits only.
   - *Logic unchanged.* Exit rules are already "the target is reached"; a return to the start is always `True`, and
     the derived location rules do not change.

   **Against the user's ruling** (2026-11-16, verbatim: "once a node becomes reachable in a loop, it stays reachable
   for the rest of the loop, and moving between nodes is free. Reachability resets when the loop resets."):
   - *Connectivity: yes, exactly.* A node is reached when every member of one of its `after` sets is cleared, and each
     such member is itself reached, recursively down to the start. So every reached node has a forward route from the
     start through cleared nodes. With an ungated return exit from every node to the start, every reached node is
     reachable from every other, every hop at `moveCost` 0 (the start's own move is free by rule). Reached-ness only
     grows within a loop (counts only rise) and resets with the loop's counts, as ruled.
   - *What AN-2 built that assumes otherwise: the gate's move condition.* `runtime.whyNotLeave` (the
     `regionMove` arm of `gate`) refuses a move whose SOURCE is not cleared. The ruling's condition is that the
     TARGET is reached. The two agree on the example today (every `after` set has one member), but differ on a
     multi-member or multi-set graph: (a) out of an uncleared X, a forward exit to Y with `after: [[X], [Z]]` and Z
     cleared is refused although Y is reached (the player can still get there via the start, one hop longer); (b) out
     of a cleared A, a forward exit to Y with `after: [[A, B]]` and B uncleared is ALLOWED although Y is not reached,
     so the player can stand in a node they cannot act in. **AN-1b should change the move gate to "the target is
     reached (or is the start)"**, with return exits passing by the same rule (the start is always reached). That
     touches `whyNotLeave`, the panel's exit buttons ("open once the node is cleared", `actionNodesPanelModel.exits`)
     and the in-app row `an-refused-action-stops-queue` part (a), which pins the `not-cleared` code. A move out of
     Do Chores at 1/2 is still refused under the new rule (its targets are not reached yet), with a target-named
     reason.
   - *Nothing else assumes forward-only movement.* The ledger, the boosts, both resets, the `act` gate (it already
     asks `isReached` for the node itself), the check-once rule and discovery do not depend on how the player moves.
2. **`loopSupport.manual` is false, not true (design §2 table).** Loops' default block mode is Record, which falls
   back to Manual where a substrate cannot record and Manual parks the queue for live play. In Loop mode the panel
   QUEUES an `act` (every performance is a queue entry), so a park would wait forever. With `manual: false` the
   default clamps to Playback and the generic executor runs the entries. A live-play `act` (charged by Loops'
   observer) would be the way to offer Manual later.
3. **`executeVia: 'solver'` and `botActsAtOnce` are not declared.** Both need the playback controller (slice 3); AN-1's
   rule (declare no capability without code behind it) applies.
4. **The `act` completion goes on the event bus, not the dispatcher.** The design said "through the dispatcher". No
   module in the dispatcher chain needs it, and the event bus is synchronous, so the runtime has applied the results
   before the next entry's start gate asks; a dispatcher hop would add an ordering question for no receiver.
5. **The discovery event also explores.** `loop:exploreCompleted` with `discoveredExits` (the design's choice) is also
   discovery's explore: it reveals one random undiscovered location or exit of the node besides the listed exits.
   Harmless here (the node's own things), and named so nobody is surprised.
6. **A Loops reset does not teleport.** A queue re-runs from its first entry, so a route must start with the
   `Menu -> start` hop (the rows do); `clearQueue()` is the call that teleports.
7. **Item mana now has a per-world table in `gameState`, not a `manaPerItem: 0` switch** (the design's §2 note was
   superseded by the default-10 ruling; AN-1 wrote the table into the block). An item with no row adds
   `mana_per_item_default`, which includes the `Victory` event item; it arrives only at the goal.

## Next slice's line

AN-3 (click-to-play and the live bot) consumes: `runtime.gate` / `whyNotAct` / `whyNotLeave` and `snapshot()` for the
node card's states; `queueAct` and the `act` entry shape (`params: {nodeId, label}`) for `queueRegionAction`;
`runtime.actNow` for a click outside Loop mode; `ACTION_NODES_STATE_EVENT` and `resourceChannels:ledgerChanged` to
redraw. It declares `getPlaybackController` (`perform` = `actNow` outside Loop mode), `executeVia`, `botActsAtOnce`
and `loopBot.planLoop`. Before the bot can reach the goal in the browser, the compiler's return exits (overturn 1)
must land and the preset regenerate.
