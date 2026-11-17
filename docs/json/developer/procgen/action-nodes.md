# ActionNodes Substrate

The ActionNodes substrate (id `action_nodes`) is a puzzle played in loops: one region is one node, and a node is one action with a mana cost, stat and resource minimums, results and a limit per loop. Stats and resources reset with every loop; Archipelago items are boosts that apply at once and again at the start of every loop. A world is compiled from a graph document by `compileActionGraph`, with its Archipelago logic derived by an exact one-loop search and the guarantee that every loop not waiting on an item can earn a check proven at compile time. Slice 1 built the headless core: the format, the compiler, the logic, the bot planner and a committed example. Slice 2 made it playable in the browser, in and out of Loop mode: the runtime, the `act` verb with its start gate, the host ledger and the Resources panel ([The runtime](#the-runtime)). Click-to-play in the Region Graph and the live bot are slice 3.

The module is `frontend/modules/actionNodes/`. Nothing in it touches a generator or the maze engine.

## The graph document

One JSON document, kind `action-graph`, schema version 1, validated by `actionGraph.js` (`validateActionGraph`, `assertActionGraph`). Every refusal has a name in `ACTION_GRAPH_REFUSALS`; tests assert the name, never the wording. The field names (`requires`, `results`, `limit`, `after`) are the shared task shape's, so a later pack resolver can produce exactly this document and the compiler does not change.

| Field | Meaning |
|---|---|
| `loop.mana` | A loop's starting pool, before boosts. |
| `stats`, `resources` | `{<id>: {name}}`. Stats only go up; resources go up or down. Both reset with the loop. |
| `boons` | The Archipelago items: `{<id>: {name, count, gives: {stats, resources, mana}}}`. `gives` applies at once when received and at the start of every loop, so a boost resource spent during a loop is back at the next one. |
| `filler` | Optional: the boon id that fills the check locations the boons do not. |
| `start` | The start node's id. |
| `settings` | `xpGainScale` (default 1) and `xpEffect` (default `cost`), written onto every node's `loop_costs` entry. |
| `nodes.<id>` | `name`, `kind` (`start`, `action`, `check`, `use`, `goal`), `time` (mana per performance, 0 allowed), `requires` (`{stats, resources}` minimums), `results` (`{stats, resources, mana}`), `limit` (performances per loop, required on every node), `after` (a list of sets: the node is reached this loop when every node of one set is cleared), optional `position`, optional `src`. |
| `provenance` | The content-sets provenance block: `sources` (each `{type, …}`: `game`, `person`, `model`, `authored` or `derived` with that type's fields), `default`, and a per-entry `src` on a node or boon that differs from the default. |

**The per-item starting-mana boost.** A boon's `gives.mana` is the mana that item adds to every loop's starting pool. When a boon does not state it, it is `DEFAULT_MANA_PER_ITEM` (10), the constant the global "every received item adds mana" setting (`gameState.manaPerItem`, toggled by `includePerItemMaxMana`) uses, so a boon that says nothing behaves as every item does today. `resolvedBoostOf` is the only place the default is applied. The compiled `action_nodes[p].boosts` table states every item's value, and while an ActionNodes world is loaded the runtime takes each received item's mana from that table instead of the global flat term (`gameState.setPerItemManaTable`; [The runtime](#the-runtime)). Other substrates are unchanged.

**What the validator enforces, and why.** No boon amount and no stat result is negative, and every requirement is a minimum. With those, holding more items can never make a plan impossible, which is what lets the logic keep only minimal item combinations ([Gotchas](./gotchas.md#a-minimal-set-search-over-an-item-lattice-assumes-monotonicity-and-the-learning-walk-cannot-check-it)). It also requires exactly one start and one goal, an `after` on every other node, every node reachable through `after` chains, and an item pool that fits the check count. Forms the first version leaves out are refused by name: alternative requirement sets, result timing (`when`), growing limits, `modifies`, maximum requirements.

## The model and the search

`actionModel.js` is one loop. Movement is free, so a loop's whole state is how many times each node has been performed; mana, stats and resources follow from the counts. A node can be performed when, in this order: mana is above 0; the node is reached (the start always is, and is cleared from the beginning); its limit is not used up; every minimum is met; no resource would go below 0; the mana left covers its price. A node may be started with too little mana, but it does not complete, so the logic and the bot count it only when it completes. An item received during a loop applies at once (`applyBoost`).

`actionSearch.js` enumerates every reachable state of one loop breadth-first, so each state's recorded plan has the fewest performances. `deriveActionLogic` runs it once per item combination (each boon from 0 to its `count`) and keeps, per node, the minimal combinations under which some state performs it and some state reaches it. Both searches have budgets (`DEFAULT_STATE_BUDGET`, `DEFAULT_COMBINATION_BUDGET`); past one the search is refused by name (`search-budget-exceeded`, `combination-budget-exceeded`), never cut short. A hand-set intended path is the fallback for graphs too large to search; it is not built.

## The compiler

`compileActionGraph(graph, {playerId, seed, budget, graphPath})` in `actionGraphCompiler.js` returns `{rules, report}`:

- **Regions:** `Menu` → the start node; one region per node, named by its id; one exit per `after` edge, named `<from> -> <to>`.
- **Locations:** a check node's location is named by the node; the goal node's location holds `Victory` (`procgenCore/goalItem.js`), locked, and the completion condition is `item_check Victory`.
- **Rules:** a location's rule is "some one-loop plan performs the node with the items held"; an exit's is "some one-loop plan reaches the node it leads to". Each is the Or over the minimal combinations of And(Has(item, n)); an empty combination is True. An item is progression when any rule names it.
- **Items and fill:** each boon `count` times, then the filler; a seeded assumed fill over the derived rules.
- **Ids:** the `action-nodes` row of `procgenCore/apIdNamespaces.js` (base 40000000), allocated by sorted name.
- **Blocks:** `preset_sidecars[p]` (one per node, below), `action_nodes[p]` (`actionNodesBlockOf`: loop, stats, resources, `boosts` by item name, `mana_per_item_default`, start, goal, `action: 'act'`, settings), `procgen_metadata[p]` (`driver: 'action-graph-compiler'`, the graph id and path, `action_logic`), `provenance[p]` (the graph's provenance block) and `loop_costs[p]`: every node `{moveCost: 0, xpEffect, xpGainScale, actions: {act: <time>}}`. These costs are authored, not generated; `rules.schema.json` declares `actions` and `xpGainScale` on a region entry for them.
- **Sphere log:** `generateSphereLog` over the compiled rules, embedded as `sphere_log`.

**The proof.** In each loop at least one location check can be earned (when the player is not waiting on another world). The compiler refuses by name when a check or the goal has no item combination that earns it (`check-never-earnable`), when a node is never reached (`node-never-reached`), when the sphere log over the derived rules does not reach the goal (`goal-not-in-logic`), or when the fill finds no place for a progression item (`fill-failed`). A check is in logic exactly when a one-loop plan earns it, and the fill guarantees an unchecked in-logic check whenever the game is not waiting, so some loop earns one. `action_logic.a6.spheres` reports how many checks are open at once in each sphere; that is reported, not enforced. Every target also records a witness plan per minimal combination.

**The payload.** `playable_payload` is the node with names resolved: `node_id`, `name`, `kind`, `time`, `limit`, `requires` and `results` as `{<id>: {name, amount}}` (results also `mana`), `after`, `location` (only on a node that carries one), optional `position`, and the envelope's `exits` (each `{exit_id, exitName, targetRegion}`, with no `side`: a node has none). The entry's `sidecarFields` declare every key.

## The runtime

`actionNodesRuntime.js` holds the loaded world; `index.js` wires it to the app and `actionNodesPanel.js` shows the node the player is at. The runtime's model has `buildActionModel`'s shape, built from `action_nodes[p]` and the node payloads (`runtimeModelOf`), so "can this node be performed" is `actionModel.whyNot`, the same rule the search and the bot use.

- **What it keeps.** Per loop: each node's performances. Through the host ledger (`resourceChannels/resourceLedger.js`): the stats and resources. Across loops, until the next world load: the checks it has sent and the nodes whose exits it has published as discovered.
- **The `act` verb.** A Loops queue entry `{type: 'customAction', actionName: 'act', params: {nodeId, label}, sourceRegion}`. The named-action table (`shared/procgen/loopCustomActions.js`) prices it at the node's `loop_costs[p].regions[<node>].actions.act` (then the region-XP discount, as every cost), labels it by the node's name, and on completion publishes `loop:actionCompleted` on the event bus; the runtime then performs the node. An `explore` prices, completes and labels exactly as before.
- **The start gate** (`loopSupport.actionGate`). Before the generic executor starts an entry of an ActionNodes region it asks the runtime. An `act` is refused when its node is not reached this loop, its limit is used up, a requirement is not met, or a result would take a resource below 0; a move out of a node is refused until the node is cleared this loop (the start always is). The refusal stops the queue at that entry and the Loops panel names the entry and the reason ([Loop Recording](./loop-recording.md#the-start-gate)). Mana is not part of the gate: a node started short of mana drains what is left into region XP and the loop ends, as every Loops action does.
- **One performance.** The results go to the ledger (all or nothing), `results.mana` to the pool. The first time a node is cleared, its exits are published as discovered (`loop:exploreCompleted` with `discoveredExits`); discovery is never reset by a loop. A check or goal node sends its location once (`user:locationCheck`); in later loops the action repeats without it.
- **Outside Loop mode** the panel's **Act** performs at once: the runtime charges the shared pool the XP-adjusted price (`chargeMana`), and at zero fires the loop-reset teleport. Short of mana, what is left is spent and the action does not complete. In Loop mode the button is **Queue act**: it appends an `act` entry when the queue ends at the node.
- **Boosts (A4).** An item named in `boosts` adds its stats and resources to the ledger at once when received and again at every loop's start. Its `mana` is that item's starting mana, through the per-item table in `gameState` (an item with no row adds `mana_per_item_default`); a received boost's mana is also gained at once. The first state snapshot after a load is the baseline, so items already held are not gained twice.
- **Both resets.** `gameState:loopReset` and `loopState:loopReset` each start a new loop: counts to zero, the ledger to its base plus every held boost.
- **Cross-substrate items.** The resources are also declared under `sharing.items`, so a grant to `action_nodes/<resource>` lands in the ledger.
- **Costs are authored.** The entry declares `loopSupport.authoredCosts`, the cost class `authored`: the Loops panel's Generate Costs and the pipeline's cost pass copy each node's entry as compiled. `xpGainScale` on a region entry scales the region XP earned there (default 1, so every other world is unchanged).

The Resources panel (`resourceChannels/resourcesPanel.js`) shows the mana line, the ledger's stats and resources, and the boosts in effect, for every substrate of the loaded world that declares a sharing category.

## The bot planner

`actionPlanner.js` `planLoop(model, {items, checked, xp, start})` plans one loop (or the rest of one) with the live items and region-XP prices (`livePrices`, the shared `xpFormulas.js`). Its aim: the goal as soon as it is reachable, with the fewest performances; otherwise the most new checks (ties: most mana left); otherwise the target short of mana by the least, run as far as it goes and ended by attempting the node it cannot afford, which drains the rest into region XP; otherwise, when every target needs an item, the most mana it can spend, and it says it is waiting for an item. Every decision is a line naming the choice and why each unchosen check was not taken, for example *Move the Boulder: short by 5 mana after Guard's Locker*.

`playToGoal(model, {placements, xpGainScale})` plays a compiled world with it: an item arrives the moment its check is performed and the bot plans the rest of the loop again from there.

## The scripts

- `scripts/procgen/action-nodes-compile.mjs [<graph>] [-o out] [--seed N] [--check]` compiles a graph; with no graph it compiles the example to the committed preset, and the check mode is a byte-identity gate.
- `scripts/procgen/action-nodes-play.mjs [<rules.json>]` plays a compiled world to its goal with the planner and prints every loop with its reasoning, at the graph's XP scale and at 0.

## The example

`graphs/example-village.json` is the ten-node village: Start; Do Chores (5 mana, Gold +3, twice); Train; Read the Notice; Eat Bread (a use node, off the start); Buy Bread and Bribe the Guard (after Do Chores); Guard's Locker and Move the Boulder (the two checks); Leave the Village (the goal, Strength 2 and Knowledge 1). Its two boons, Strength Boost and Pocket Money, state `gives.mana: 0`: under the default of 10 the goal would no longer need the bread. Its numbers are hand-made content in the content-sets sense of *use the table as written*: nothing reassigns them, and the compiler reads them exactly as written (the other value of that per-world switch, *assign by playthrough*, belongs to generated worlds and is not built here). It compiles to the committed preset `frontend/presets/action_nodes_example/AP_1/` (4 item combinations, at most 64 states each): both checks `True`, the goal `Has(Strength Boost)`.

## The registry entry

`actionNodesLibrary.js` registers identity, `deserializeWorld` / `serializeWorld` (exits as a `Map`), `sidecarFields`, `apLocationNamesOf`, `apExitNamesOf`, `regionGeometry: sides` and `SIDE_AGNOSTIC_EXIT_SIDES`. It declares no realiser hook, because the compiler writes its regions.

- `loopSupport`: `queueActions: ['regionMove', 'act']`, `actionGate`, `authoredCosts: true`, `manual: false`. Not `manual`: a Manual block parks the queue for live play, and in Loop mode every performance is a queue entry, so a park would wait for nothing. Not `record` / `playback` (the strict action gate's pair: the start gate does that job), and no `executeVia` until the playback controller exists.
- `sharing`: `mana`, `items` (its resources), `stats` and `resources`, each list read from the loaded world.

It declares no playback controller yet (slice 3), so the capability chart shows ✗ for a Bot block.

Unit tests: `frontend/modules/actionNodes/*.test.js`; in the browser, the category "ActionNodes" of the substrates test mode (batch `fast`).

## Related documentation

- [Architecture](./architecture.md) · [Substrate Registry Reference](./substrate-registry.md) · [Loop Recording and Block Modes](./loop-recording.md) · [Gotchas](./gotchas.md)
