# ActionNodes AN-1b — two-way edges, the move gate, no explore, discovery, the preset on pack ids (as built)

Slice AN-1b of the ActionNodes substrate (content sets arc), session `actionnodes-an1b` (Opus 5.5), 2026-11-16/17.
Branch `actionnodes-an1b` on AN-2's frozen tip `origin/actionnodes-an2` `48b7d39c30` (not on main yet: TRAIN 137).
Rulings it takes in (Robert, 2026-11-16, verbatim in the content-sets plan): 17:41:55Z movement ("once a node becomes
reachable in a loop, it stays reachable for the rest of the loop, and moving between nodes is free. Reachability
resets when the loop resets"), 19:59:48Z discovery + explore (D1–D6), 21:09:12Z no visible links back to start, and
the planner's two rulings under it (two-way edges; the discovery fixes fold into this slice). Also PL-2's "next slice's
line" (the preset on pack ids, the fill rules onto the registry entry).

The preset regenerated ONCE (part 6). Merged with AN-2's landed main `ddf3630b24` (train 137) once, at
`42b1bdd46c` — the FINAL tip. Against that main: 41 files, +1873/−235 (the same diff as base → code tip). Gitlinks moved: 0.

## The parts as built

### 1. Two-way edges (the compiler) — `71fc9b9d13`

- `actionNodes/actionGraphCompiler.js`: `nodeExitsOf(graph, id)` — for each `after` edge A→B the gated forward exit
  `A -> B` (rule: some one-loop plan reaches B, as before) and an UNGATED reverse exit `B -> A` (rule `True`), the
  payload row of a reverse exit carrying `reverse: true`. No return-to-start exit and no exit into `Menu`: the start is
  the existing `Menu -> start` hop.
- The derived logic does not change meaning: every location and forward-exit rule is the exact one-loop answer already
  (the search assumes free movement), so a region reachable through a reverse exit gains no location and no exit. The
  A6 proof re-ran in the compiler (sphere log reaches the goal; the `action_logic` report is byte-identical), and the
  spoiler test passes on the regenerated preset (below).
- **`assume_bidirectional_exits` is set, to FALSE** (`exporter[p]`, was `{}`). The world LISTS its back-exits, so it
  states none may be assumed. `true` would let readers construct a back-exit for every listed exit — `start -> Menu`
  included, which does not exist: the Regions panel (`regionBlockBuilder.addEntrances`) would mark the Menu entrance
  two-way and the pathfinder (`shared/pathfinder.js`) would add the edge. With `false` the panel derives each pair from
  the listed reverse exit (`returnExit`), which is exactly the data. Absent would hand it to auto-detection.
- Pins: `actionGraphCompiler.test.js` (two exits per `after` edge, each reverse ungated with its payload row, no exit
  back to Menu; the flag); **`regionGraph/actionNodesTwoWayEdges.test.js`** runs the Region Graph's own
  `GraphDataManager.buildGraphFromRegions` over the compiled example: edges = `after` edges + the one-way
  `Menu → start`, every node edge one merged two-way pair, oriented forward.

### 2. The move gate (runtime) — `feac7536b9`

- `actionNodesRuntime.whyNotLeave(nodeId, {exitName, destination})` (the `regionMove` arm of `gate`, which now passes
  the entry's `exitUsed` / `destinationRegion`): a FORWARD exit opens when its source is cleared this loop (code
  `not-cleared`, as before); a REVERSE exit is open when its target is reached this loop (new code
  `target-not-reached`). A multi-hop move between reached nodes is never refused, and costs 0 (`moveCost` 0 on every
  node). Reachability is the per-loop counts, so it resets with the loop (pinned).
- The panel's exit buttons ask the same gate per exit (`actionNodesPanelModel`); a move back is drawn `←`.
- Pins: `actionNodesRuntime.test.js` (forward refused until cleared; a reverse move open at once, by name and by
  destination; every reverse exit of every reached node open after clearing all an empty-handed loop can; a hand-made
  multi-set copy refused `target-not-reached`; a reset closes a cleared node's forward exit again);
  `actionNodesPanel.test.js`.

### 3. No explore in ActionNodes — `8f4edb4a93`

- The explore BUTTON was already hidden: `loopBlockBuilder._supportsQueueAction` draws none for a region whose entry
  lists no `explore`. What was missing was enforcement of every other path (an undiscovered exit or location click
  queues an explore through `gameState.addCustomAction`; a script; a replayed queue).
- New opt-in **`loopSupport.strictQueueActions`** (`loops/strictQueueActions.js`, `strictQueueRefusal`): with it, a
  custom action the entry's `queueActions` does not hold is refused, code `action-not-offered`, naming the substrate,
  the node and the verbs offered.
  - **At queue time:** `gameState.setCustomActionGuard(fn)` (public function `gameState.setCustomActionGuard`), installed
    by the loops module (`loopState.customActionRefusal`). `addCustomAction` / `insertCustomActionAt` append nothing,
    return `false` and record `gameState.lastQueueRefusal`. A guard that throws refuses, naming the throw. With no
    guard, everything is appended as before.
  - **By the gate:** `actionNodesRuntime.gate` refuses any custom action but `act`, through the same function and the
    entry's own list.
- **Other substrates unchanged, pinned:** `strictQueueActions.test.js` — over every registered entry
  (`REGISTRY_LIBRARIES`), exactly one declares the opt-in (`action_nodes`), and every other entry's explore is
  unrefused by the rule. Why an opt-in and not "enforce `queueActions` everywhere": jta and cloudberry also list no
  explore, and enforcing would change them.

### 4. Discovery — `387c80fccb`

The addendum's four seams, re-measured on `48b7d39c30`:

- (a) `discovery/worldDiscoveryMode.js`: `ACTION_NODES_OVERRIDES` = `LOOP_MODE_OVERRIDES` + `autoDiscoverLocations:
  true`; `readWorldDiscoveryMode` returns `'actionNodes'` for `{enabled: true, bundle: 'actionNodes'}`;
  `resolveDiscoveryOverrides` forces it with Loop mode ON and OFF. Every other row of the table is pinned unchanged.
- (b) `discovery/revealCore.js` (pure) + the public **`discovery.revealExits(regionName, exitNames)`**: each named exit,
  its target region, the target's locations, and the target's exit straight back (the pair's other half: both ends
  known, so it hides nothing). No random pick.
- (c) `actionNodesRuntime.perform`: a node's first clear calls `env.revealExits(node, forward exit names)` in place of
  the `loop:exploreCompleted` dispatch (the dispatcher sender is dropped from `actionNodes/index.js`), so the random
  pick is gone (D6).
- (d) `compileActionGraph` writes `discovery_mode[p] = {enabled: true, bundle: 'actionNodes'}`;
  `rules.schema.json` gains `bundle` (enum `actionNodes`) with its producer and consumer.
- **The trap, handled and pinned.** `settingsChangeSteps(prev, next)` (pure, `worldDiscoveryMode.js`) adds a
  `cascadeLocations` step when `autoDiscoverLocations` turns true under the `onExitDiscovered` trigger;
  `handleSettingsChanged` re-runs the cascade's location step on it. Pin (`worldDiscoveryMode.test.js`): applying each
  bundle key by key in `OVERRIDE_KEYS` order from the defaults gives `cascade@regionDiscoveryTrigger` then
  `cascadeLocations@autoDiscoverLocations` for the actionNodes bundle, `cascade` only for Loop mode's, nothing for
  walk-to-reveal.
- **The start's neighbourhood** (`revealStartNeighbourhood`, run by the module after discovery starts afresh under the
  bundle, at `stateManager:rulesLoaded` and `rawJsonDataLoaded`): every region a start region leads to (here the start
  node) has all its exits revealed as in (b). Entering or leaving the bundle also starts discovery afresh.
- A reverse exit is revealed with its node, so it never shows as `???` and never changes the visible exit count.
- **D5:** the simplest, as ruled — a never-completed node's forward exits are `???` edges to `???` nodes at their
  layout position (what the Region Graph already draws). No direction-only stub.
- **D4 pinned:** `revealCore.test.js` scans every non-test module under `frontend/modules` (submodules included) for a
  `publish('loop:reset'` — none.
- Outside Loop mode, a click on an exit the player already knows is a move under the bundle (as for an `'on'` world).

### 5. The preset on pack ids; the fill rules on the entry — `870e564dfd`

- `compileActionGraph(graph, {…, exists})`: given pack ids, `provenance[p]` records `exists` and NOT the graph's own
  block (Z.7: a world looks its sources up through its packs); without, a graph no pack holds keeps its block.
  `action-nodes-compile.mjs` gains `--exists id,id` (an unknown pack refused, exit 2) and its no-argument recipe names
  `DEFAULT_EXISTS = ['example-village']` (exported with `DEFAULT_GRAPH` / `DEFAULT_OUT`; the compiler test compiles with
  exactly that recipe).
- `contentPacks/provenance.test.js`: the set-aside for the example world is dropped; the "no world carries a pack's
  provenance" row now reads every committed `rules.json` whole, and passes.
- `SUBSTRATE_FILL_RULES` is gone from `procgenCore/fillRules.js`: the ActionNodes list is the registry entry's
  `fillRules`; `fillRulesOf(entry)` reads the entry, else none. Pinned in `fillRules.test.js` (the entry's list, every
  rule built) and `packResolver.test.js`.
- Not done, as ruled: `graphs/example-village.json` stays a source; the preset is not compiled from the pack. PL-2's pin
  (the pack resolves deep-equal to the JSON; the compiled world equals the preset apart from `provenance`) still holds.

### 6. The preset, regenerated once — `1453db77b8`

`node scripts/procgen/action-nodes-compile.mjs` (no arguments); `--check` byte-identical at the tip. What moved against
`48b7d39c30`, measured key by key:

| Top-level key | Change | Why |
|---|---|---|
| `regions` | 10 → 19 exits: the 9 reverse exits (rule `True`); every forward exit and every location (rule, item) unchanged | part 1 |
| `preset_sidecars` | the reverse exit rows (`reverse: true`) on 9 of 10 nodes (the start has no predecessor); nothing else | part 1 |
| `exporter` | `{}` → `{"1": {"assume_bidirectional_exits": false}}` | part 1 |
| `discovery_mode` | new: `{"1": {"enabled": true, "bundle": "actionNodes"}}` | part 4 |
| `provenance` | `graph_provenance` → `exists: ["example-village"]` | part 5 |

Unchanged: `sphere_log`, `procgen_metadata` (the A6 report), `loop_costs`, `action_nodes`, `items`, the fill.

## The discovery sets the row asserts

`an-discovery-sets` derives each expected set from the preset (`expectedSets(rules, payloads, revealed)`) and compares
regions, exits (`region|exit`) and locations exactly. On the example:

| When | Regions | Exits discovered | Locations |
|---|---|---|---|
| at load | Menu, start, its 4 neighbours (do-chores, train, read-the-notice, eat-bread) | `Menu -> start`; start's 4 forward exits; each neighbour's exit back to start | none (no neighbour carries one) |
| after Train's first clear | + move-the-boulder | + `train -> move-the-boulder`, `move-the-boulder -> train` | Move the Boulder |
| after a loop reset (both flows) | unchanged | unchanged | unchanged |
| Loop mode off | unchanged (the bundle still forced: discovery on, locations with their region) | unchanged | unchanged |

Never discovered while their node is uncompleted: a neighbour's forward exits (D3: `do-chores -> buy-bread`,
`do-chores -> bribe-the-guard` stay `???` edges to `???` nodes).

## In-app rows (category ActionNodes, batch `fast`)

| id | What it pins |
|---|---|
| `an-refused-action-stops-queue` | (a) REWRITTEN: loop 1 earns the item the goal's rule names, at the check the fill put it in (read from `action_logic.placements`); loop 2 plays the goal's own A6 witness as a route that moves BACK between performances (every hop a forward or reverse exit, `hopsBetween`): no refusal, the goal performed and its location checked. (b) unchanged (an act with an unmet requirement) |
| `an-explore-refused` | replaces `an-explore-unchanged`: an explore refused at queue time (returns false, nothing appended, `lastQueueRefusal` `action-not-offered`), a stray explore entry refused by the start gate by name, the act before it ran, no explore button in the node's expanded Loops block |
| `an-discovery-sets` | the table above |
| `an-two-way-move` | a move back to the start costs 0 (`_calculateActionCost`) and is not refused; the forward exit of an uncleared repeatable node is refused by name (`not-cleared`, `(1/2)`); the pool paid the one act only |

Local, the worktree's server on port 8130 (`npm test -- --mode=test-substrates --port=8130 --test=<the eight an-* rows>`):

```
[PROGRESS 1/8] an-load-and-act-once PASSED 0.6s
[PROGRESS 2/8] an-refused-action-stops-queue PASSED 1.5s
[PROGRESS 3/8] an-results-reach-ledger PASSED 0.5s
[PROGRESS 4/8] an-loop-reset-restores-boosts PASSED 0.7s
[PROGRESS 5/8] an-check-once-action-repeats PASSED 0.7s
[PROGRESS 8/8] an-two-way-move PASSED 0.4s
[PROGRESS 1/2] an-explore-refused PASSED 0.7s        (re-run after the public-function fix below)
[PROGRESS 2/2] an-discovery-sets PASSED 0.6s
```

CI PASSED lines: in the CI section.

## Gates

| Gate | Result |
|---|---|
| bounded vitest: `actionNodes`, `discovery`, `regionView`, `regionGraph`, `loops`, `contentPacks`, `procgenCore`, `procgenDocs`, `packStructure`, `gameState`, `tests`, `tutorials.test.js`, `apworldEditor/documentKeys.test.js`, `stateManager/core/eventKinds.test.js` | 148 files, 4066 tests, all pass |
| the schema test `test/general/test_schema_validation.py` | 5 passed, 466 subtests (no tree dirt) |
| `action-nodes-compile.mjs --check` | OK, byte-identical |
| `check-sidecar-fields.mjs` | ALL PASS — 2264 entries over 10 substrates |
| `check-loop-costs-one-model.mjs` | ALL PASS — 5 documents byte-identical |
| `generate-procgen-reference.mjs --check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH (0 findings after the two registry rows) |
| `check-procgen-docs.mjs` | ALL CHECKS PASSED (the box was free) |
| `scripts/quicklaunch/generate-docs-index.mjs --check` | current |
| spoiler test, `--game=action_nodes_example --seed=1` | PASSED; the log's `sourceName: ./presets/action_nodes_example/AP_1/AP_1_rules.json`; `detailedResults` `totalEvents 3, processedEvents 3, errorCount 0` |
| maze engine closure (`seedlingDerivedRuleTable.js --print-engine-closure`) | 43 lines, sha256 prefix `a458a51c3cb725ba` — the value AN-2 measured; the closure ∩ the 40 changed files = ∅, so it is identical at base and tip |
| byte-equality, committed presets | the only file under `frontend/presets/` the slice changes is `action_nodes_example/AP_1/AP_1_rules.json` |
| byte-equality, generated presets | a scratch probe generated every `SHIPPED_PRESETS` entry headless (`prepareRunFromState` → `runPresetHeadless`) in this tree and in an export of `48b7d39c30` (submodules copied): 25 presets, md5 of `rulesJson` identical; 1 heavy preset skipped on both sides |

Census: 435 → 437 (`doc` 327 → 329: the registry's `fillRules` row → concepts.md, its `strictQueueActions` row →
action-nodes.md § No explore), reasons in `docLinks.test.js` and `docsRender.test.js`.

## Test paths

New: `frontend/modules/regionGraph/actionNodesTwoWayEdges.test.js`, `frontend/modules/discovery/revealCore.test.js`,
`frontend/modules/loops/strictQueueActions.test.js`. Extended: `actionNodes/actionGraphCompiler.test.js`,
`actionNodesRuntime.test.js`, `actionNodesPanel.test.js`, `discovery/worldDiscoveryMode.test.js`,
`procgenCore/fillRules.test.js`, `packStructure/packResolver.test.js`, `contentPacks/provenance.test.js` (set-aside
dropped), `procgenDocs/docLinks.test.js`, `docsRender.test.js` (census). In-app:
`frontend/modules/tests/testCases/actionNodesTests.js` + `frontend/test-configs/playwright_tests_config-substrates.json`.

Docs: `docs/json/developer/procgen/action-nodes.md` (§ The compiler, § The runtime, new § No explore and § Discovery,
§ The scripts, § The registry entry), `substrate-registry.md` (`fillRules`, `loopSupport.strictQueueActions` rows),
`concepts.md` (the fill rules); regenerated README, docsIndex, registry/capabilities/instruments,
`features/procgen-substrates.md`.

## What the code overturned

1. **D1 did not hold at AN-2** (the addendum said it did). Discovery's start regions are the document's `start_regions`
   = `[Menu]`, so `DiscoveryState.initialize` discovered Menu and `Menu -> start`; the `onExitDiscovered` cascade then
   discovered the start NODE as a region but none of its exits — the start's four exits were `???`. Fixed by the
   bundle's `revealStartNeighbourhood` (the in-app row's "at load" exits set pins it).
2. **"A reverse exit is always open, since its target was reached by construction"** holds only for a node reached
   through a one-member `after` set. Built as "open when its target is reached this loop" (code
   `target-not-reached`): identical on the example (every set has one member), and on a multi-set graph it keeps the
   ruling's "stays reachable" true instead of letting a reverse exit lead into an unreached node. The forward rule
   stays "source cleared", as briefed — AN-2's case (b) (a forward exit into a multi-member set's node not yet reached)
   is still open; it needs a multi-member graph to matter.
3. **The explore control was already hidden** (the block builder draws no explore for an entry that lists none); the
   undeclared paths were the gap. Enforcing `queueActions` for everyone would have changed jta and cloudberry (they
   list no explore either), so the enforcement is an opt-in field, not the existing declaration.
4. **The example's start neighbours carry no location**, so D2's "show all their contents" is observable at load only
   as "discovered, named, with their exits counted"; the trap fix is pinned by the pure key-by-key test, and the row
   pins the location step on the first clear (Move the Boulder).
5. **`revealExits` reveals the pair's other half generically** (the target's exit straight back), rather than
   ActionNodes-specific "reverse" knowledge in the discovery module: the module stays substrate-blind, and a
   multi-predecessor node's other moves back appear only when their own end is revealed.
6. **Two in-app rows first failed on `tc.centralRegistry`**, which is not set on the test controller here (AN-2's
   refusal row reads it with a fallback, so it never noticed): the rows import `centralRegistry` and the discovery
   module's `getDiscoverySettings` directly, and ask Loops' own `_lookupSubstrateId` for the node's substrate.

## CI

### At the merged tip `42b1bdd46c` (FINAL: main `ddf3630b24` merged once)

The merge conflicted only in the two generated files (`docs/json/developer/procgen/README.md`,
`procgenDocs/generated/docsIndex.js`): taken from main, then regenerated (`generate-procgen-reference.mjs`, `--check`
clean). Census re-measured: `procgenDocs/` 8 files / 495 tests pass with no count moved (docs 437, `doc` 329). The
slice's bounded vitest (actionNodes, discovery, strictQueueActions, the Region Graph pin, procgenCore, gameState): 90
files / 2442 tests pass. `action-nodes-compile.mjs --check`, `check-sidecar-fields.mjs`,
`check-loop-costs-one-model.mjs` exit 0; `check-procgen-docs.mjs`: ALL CHECKS PASSED.

| Run | Result |
|---|---|
| `unittests` push 44163812114 | success |
| `JavaScript Unit Tests` push 44163812084 | success (18 jobs success, 2 skipped: the train shards and the already-green guard): suite `vitest (unfiltered)` 28423 passed, 0 skipped, 0 failed (1323 files); slow battery 437/437 |
| `train_only` 44163832968 | success, Train-tier shards 1–3 |
| TT 44163838273 | success, every batch HEADROOM OK: fast 265.0 s of 600 (44%), fast bundled 271.2 s (45%), playback-bot 67.1 s (11%), seedling-wasm 166.5 s (28%), apworld 184.8 s (31%), seedling-js 220.3 s (37%), seedling-js-solver 190.7 s (32%) |
| feature-checks 44163842635 | success: 66.4 s of 600 (11%) |

The eight ActionNodes rows in TT, PASSED on both boots (fast shown):

```
[PROGRESS 86/109] an-load-and-act-once PASSED 0.4s
[PROGRESS 87/109] an-refused-action-stops-queue PASSED 1.1s
[PROGRESS 88/109] an-results-reach-ledger PASSED 0.3s
[PROGRESS 89/109] an-loop-reset-restores-boosts PASSED 0.6s
[PROGRESS 90/109] an-check-once-action-repeats PASSED 0.6s
[PROGRESS 91/109] an-explore-refused PASSED 0.4s
[PROGRESS 92/109] an-discovery-sets PASSED 0.4s
[PROGRESS 93/109] an-two-way-move PASSED 0.3s
```

Gitlinks against main: 0. This report commit is docs-only on top of `42b1bdd46c`; its push's JSUT is quoted below
if the path filter skips it.

### At the code tip `09fc99f608` (before the main merge)

| Run | Result |
|---|---|
| `unittests` push 44005122693 | success |
| `JavaScript Unit Tests` push 44005122793 | success: suite `vitest (unfiltered)` 28381 passed, 0 skipped, 0 failed (1320 files); slow battery 437/437 |
| `train_only` 44005129919 | success, Train-tier shards 1–3 |
| TT 44005133166 | success, every batch HEADROOM OK: fast 261.7 s of 600 (44%), fast bundled 268.2 s (45%), playback-bot 67.9 s (11%), seedling-wasm 180.3 s (30%), apworld 174.5 s (29%), seedling-js 214.8 s (36%), seedling-js-solver 196.6 s (33%) |
| feature-checks 44005136679 | success: 10 rows, 68.2 s of 600 (11%) |

The eight ActionNodes rows in TT, the same on both boots (fast and fast bundled):

```
[PROGRESS 86/109] an-load-and-act-once PASSED 0.3s
[PROGRESS 87/109] an-refused-action-stops-queue PASSED 1.1s
[PROGRESS 88/109] an-results-reach-ledger PASSED 0.3s
[PROGRESS 89/109] an-loop-reset-restores-boosts PASSED 0.5s
[PROGRESS 90/109] an-check-once-action-repeats PASSED 0.6s
[PROGRESS 91/109] an-explore-refused PASSED 0.3s
[PROGRESS 92/109] an-discovery-sets PASSED 0.4s
[PROGRESS 93/109] an-two-way-move PASSED 0.3s
```

Gitlinks in the slice: 0.

## Next slice's line

AN-3 (click-to-play + the live bot) consumes: `runtime.whyNotLeave(node, {exitName, destination})` and the
`reverse` payload rows for the node card's exits; `runtime.gate` (`action-not-offered` for anything but `act`);
discovery's `revealExits` and the actionNodes bundle for the card's visible / never-completed states (D3). A bot route
from a plan must insert the hops between performances (the rows' `hopsBetween` is the shape: shortest path over
forward and reverse exits); every such hop between reached nodes is free and never refused. Open, small: the forward
move rule for a multi-member `after` set (AN-2's case (b)).
