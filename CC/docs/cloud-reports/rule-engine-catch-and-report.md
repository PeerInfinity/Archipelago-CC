# Report: `rule-engine-catch-and-report`

Local Opus slice, coordinated by `seedling-js-planning-14`. ⚖ The user, 2026-10-31: "Catch + report". Both rule formats
catch their errors and log at `error`. `evaluateRule` reports each error through an optional context hook. The
text-adventure wrapper uses the hook. Every other caller gets the AST path's result.

- Worktree `Archipelago-CC-wt-rule-engine-catch-and-report`, outer branch `rule-engine-catch-and-report`.
- Base: origin/main `16d1b67084`, which is after train 2 (`ruleErrorMarker.js` present).
- Shared submodule: branch `rule-engine-catch-and-report`, commit `733945b` on top of `daee222` (shared main).

## Design

**Engine** (`frontend/modules/shared/ruleEngine/core.js`, the only `ruleEngine` change):

- The Rule Builder path (`rule.rule && !rule.type`) now wraps its `evaluateRuleBuilderRule(...)` call in the same
  try/catch as the AST path's `handler(...)`. A throw logs `[evaluateRule] Error during evaluation:` at `error` and
  answers `undefined`. The SMBool and nested-rule post-processing stays outside the try on both paths, as before.
- Both catches go through one `reportRuleError(error, rule, context, depth, isValidContext)` call.
  - It logs the same payload as before, `{ruleType, rule, error, contextType, isSnapshot}`, plus `ruleName` (the Rule
    Builder name, or `undefined` for an AST node).
  - It then calls `context.onRuleError?.({ error, rule, ruleType, ruleName, depth })`.
  - The hook is called once per caught error, at the innermost node that threw. A parent sees only `undefined` from
    that child, so the parent does not report the same error again.
  - A hook that throws is logged (`onRuleError hook threw`) and swallowed.
- With no hook, both formats behave exactly as the AST path always has.

**Where the hook lives: on the CONTEXT** (`context.onRuleError`), and callers pass it in as a context variable:
`createSnapshotInterface(snapshot, staticData, { onRuleError })`. This is the place every nested evaluation reaches:

- handlers pass `context` down;
- a bound comprehension context (`createBoundContext`) spreads it;
- the fake-pearl wrapper spreads it;
- `createSnapshotInterface` spreads its `contextVariables` onto `finalSnapshotInterface`, the object helper bodies are
  evaluated with (`snapshotInterface.js:943`);
- the location and entrance sub-contexts (`:746`, `:804`) are re-created from `...contextVariables`.

`localScope` would not reach far enough. Helper bodies start a fresh `helperScope`, and comprehensions re-enter at
depth+1 without it (`astCollections.js:274`, `:282`).

⚠ Assigning the hook after creation (`ctx.onRuleError = …`) misses the location sub-context. Mutant W-M2 below
measures that.

**Wrapper** (`textAdventureSubstrateWrapper/roomAccessibility.js`):

- `createContext(snapshot, staticData, { onRuleError })`. The hook collects the errors caught while one link's rule
  is evaluated.
- If any error was caught, or the call still threw (an evaluator without catch-and-report), the link is PASSABLE and
  `ruleErrors[kind][id]` holds the first message. This holds for AST and Rule Builder rules, top-level or nested.
- `console.error` stays once per throwing link per pass. Unknown state is unchanged: `known: false`, everything shut,
  no rule errors.
- ⚠ Any caught error under a link's rule makes the link passable. That includes an error in an `or` branch whose
  other branch is true or false. This follows the ruling ("ANY throwing rule stays passable and marked").

## Files

| Repo | File | Change |
|---|---|---|
| shared `733945b` | `ruleEngine/core.js` | Rule Builder try/catch, `reportRuleError`, the hook |
| shared `733945b` | `ruleEngine/ruleErrorHook.test.js` | new, 10 rows |
| outer `bb8fc157f5` | `frontend/modules/shared` | gitlink `daee222 → 733945b` (separate commit) |
| outer `c0ef47853e` | `textAdventureSubstrateWrapper/roomAccessibility.js` (+ `.test.js`, 6 real-engine rows) | the hook |
| outer `c0ef47853e` | `docs/json/developer/procgen/concepts.md` (+ regenerated `README.md`, `docsIndex.js`) | one sentence: where the error is now heard |

No worker change, no other `ruleEngine` change, no single-game code.

## Pins and mutants

All are bounded vitest runs. Each mutant was measured by editing the file in place, running the two pin files, then
restoring the file.

| Pin | Fails under |
|---|---|
| engine: AST throw → `undefined`, one error log, one hook call (`ruleType`, depth 0) | E-M0 |
| engine: Rule Builder throw → the same (`ruleName: 'List'`) | E-M0 (the throw escapes) |
| engine: no hook → `undefined`, nothing escapes (both formats) | E-M0 (Rule Builder row) |
| engine: a throwing hook → nothing escapes, `undefined`, the hook's throw is logged (both formats) | E-M0, **E-M1** |
| engine nested: Rule Builder→AST→Rule Builder (`ASTRule`/`and`), helper body, entrance rule, location sub-context (`CanReachLocation`) | E-M0; E-M2 (2 of 4) |
| engine nested: reported at its own depth (`[1]`) | E-M0, **E-M2** |
| wrapper (real engine): AST throw → passable and marked | E-M0, **W-M1** |
| wrapper: Rule Builder throw → passable and marked | **W-M1** |
| wrapper: nested entrance rule, helper body → passable and marked | W-M1, E-M2 (entrance) |
| wrapper: nested location sub-context → passable and marked | W-M1, **W-M2** |
| wrapper: a false rule → shut, no `ruleErrors` | (guard row; passes under every mutant) |
| wrapper: one `error` line per throwing link per pass | W-M1 |

Mutants:

- **E-M0**: the old `core.js` (shared `daee222`). **10 of 25 fail.**
- **E-M1**: the hook called without its try. **2 fail.**
- **E-M2**: the hook is called only at depth 0. **4 fail.**
- **W-M1**: the old `roomAccessibility.js` (origin/main), with the new engine. **4 fail.** AST, Rule Builder and
  nested rules all read shut and unmarked.
- **W-M2**: the hook assigned after creation instead of passed as a context variable. **1 fails**: the location
  sub-context row. This row was added after a first version of W-M2 survived. The entrance row does not re-create
  the interface; `EntranceAccessRule` evaluates on the same context.

Final run: 28/28 across the two files.

**Bounded consumer suites** (52 files, run together):

- shared: `ruleEngine.test.js`, `ruleEngine/*.test.js`, `shared/*.test.js`, `shared/procgen/*.test.js`;
- `stateManager/**/*.test.js`;
- `textAdventureSubstrateWrapper/*.test.js`;
- `spoilerTest`, `pathAnalyzer`, `commonUI`, `exits`, `regions`, `locations`, `regionGraph` tests;
- every other test file that imports `ruleEngine`, `snapshotInterface` or `evaluateRule`: `flashPanel` seedling
  wiring/doorGate/hostWorld, `mazeRoom` (autopather, extractLogic, visualizer, tileSpike countedRules/derive*),
  `omsiUnlockPool`, `walkOrder`, `ruleWithOwned`, `topDownSourceCarry`, `timer/checkOrder`.

Result: **879/879 tests passed. 51/52 files passed.** The one red file, `flashPanel/seedlingRandomizerWiring.test.js`,
fails at load with `ENOENT …/flashPanel/wasm/builds.json`. That is the known state of a worktree made without
`--with-wasm`; it is not a test result. CI's JSUT covers it.

Also run: `procgenDocs/` 8 files, 494/494, after the docs regeneration.

**`check-concept-trial-play.mjs`** against this tree's server (`:8140`, the working tree with every change). See
§ Concept trial for the rate.

## Callers that saw an escape before

Before, a Rule Builder throw escaped `evaluateRule` unless an AST node above it caught it. Now the innermost Rule
Builder frame catches it and answers `undefined`.

⚠ This is not always `undefined` at the top. `Or(throws, true)` is now `true`, and `And(throws, false)` is now
`false` (`ruleBuilderEvaluator.js:370-428`); before, both threw.

**Callers with no behaviour change:**

- They already caught the throw and returned false/unknown: `exitUI` (except :908), `regions/index.js:216`,
  `loopBlockBuilder`, `regionGraph/graphDataManager`, `playbackBotPanel:334`, `playbackBotUI:1447`,
  `workerSpoilerTest:522`, `pathAnalyzerLogic:622`, `commonUI:395`.
- They are only ever reached with AST nodes: `helperUI:396`, `tileStep:65`, `regionUI:1212` (no context).

**Callers with a behaviour change:**

| Caller | Before (a Rule Builder throw) | Now |
|---|---|---|
| **worker BFS** `stateManager/core/reachabilityEngine.js:425` (`runBFSPass`, no try) | escaped `computeReachableRegions` → worker `handleMessage` catch → `workerError`; `loadRules` never confirmed (see below) | `Boolean(undefined)` is false: the exit is untraversable, and the error is only logged |
| `reachabilityEngine.js:634` `isLocationAccessible` | catch → `false` | raw `undefined` (callers test truthiness; the worker's `checkLocation`/query replies now send `undefined` instead of `false`) |
| helper bodies, `core/ruleEvaluator.js:86/101` and `snapshotInterface.js:943` | escaped to the enclosing frame | `undefined` → **falls through to the game's JS helper**. This is the same path a throwing AST helper body has always taken. |
| `pathAnalyzerLogic.js:365` | escaped; the whole worker `analyzePathToRegion` replied with an error | that transition is filtered out as inaccessible; the analysis completes |
| `spoilerTest/comparisonEngine.js:182` | escaped to the `eventProcessor.js:771` catch; the sphere failed | `=== true` is false. A `missingFromState` mismatch is reported if the log expects that location. **If the log does not expect it, the test passes silently.** |
| `spoilerTest/analysisReporter.js:165` | its catch read a block-scoped variable → ReferenceError (a latent bug) | the diagnostics finish |
| `locations/locationUI.js` renders (:840…1217) | the whole render aborted (eventBus handler error) | the render completes; the location shows as failing |
| `locationUI.js:1584` | "Error evaluating rule locally" | shows "Rule evaluates to: FALSE" |
| `exits/exitUI.js:908` | catch → red "locked" | grey "Rule Eval Unknown" |
| `regions/regionBlockBuilder.js:533/559/717/981` | catch → `false` | `undefined`. ⚠ `classList.toggle('accessible', undefined)` acts as a plain toggle (:673, :829, :1121), so the `li` can carry **both** `accessible` and `inaccessible`. The text still says Locked. |
| `spoilerChecklistUI.js:851` | the row render aborted | completes |
| `regionGraph/graphInteractionManager.js:413` | unhandled rejection; the bulk check stopped | that location is skipped; the rest are checked |
| `flashPanel/seedlingDoorGate.js:157` | escaped to `seedlingRegionBinding.js:391` → `DOOR_GATE_ERROR_DEFAULT` (open) with the real message | `:158` throws `notBoolean` into the same catch. **The verdict is the same (open), but the message is generic.** |
| `flashSubstrate/bridge.js:357` (via `procgen/library.js:242`) | the catch at :363 skipped `setGateStates` entirely, so every gate kept its old state | that gate is closed and the rest update |
| `textAdventureCompositeMap.js:45`, `procgen/forwardSimulator.js:86`, `procgen/library.js:254/257`, the maze `isObstacleCleared` evaluators | escaped to their render/step callers | closed or locked, or listed as undecided |
| `loopsCostDebugger/documentStateManager.js:85` (`loadFromJSON`) | "Could not read that working copy" | loads; the exit is closed |
| `textAdventureSubstrateWrapper/roomAccessibility.js` | passable and marked (its own catch) | passable and marked (the hook) |

⚠ Only `roomAccessibility` installs the hook. Every other changed row now hears the failure only through the engine's
`error` log line.

**js-14's two follow-up questions, measured.** Two throwaway node scans loaded every committed preset (224
`*_rules.json`, every player) into the real `StateManager` with the new core. Each was evaluated with an empty inventory
and again with the full item pool. A copy of concept_trial with the `List` rule on its guarded exit served as a positive
control, and both scans detected it.

1. **The spoiler comparison's silent pass is LATENT, not current.**
   - Mechanism: `comparisonEngine.js:182` builds the state's set of accessible locations, per sphere, from parent
     reachable AND `evaluateRule(...) === true`, and diffs it against the sphere log's accessible set. An erroring rule
     now yields `undefined`, so the location is left out of the state set.
   - That matches the log at every sphere where the log does not list the location yet. It is caught
     (`missingFromState`) at the first sphere that lists it. So a false pass needs a location the log never lists as
     accessible, or `allow_regressive_accessibility_mismatches`. Before, the throw failed the sphere.
   - Today: **0 of 224 presets have any caught rule error**, and none fails to load. The scan did not walk the
     intermediate sphere inventories, only empty and full.
2. **The regionBlockBuilder double class is reachable from committed presets TODAY, without any throw.**
   - `isTraversable` (:553, :736) and `locAccessible` (:994) become `undefined` whenever a rule in a reachable region
     is *undetermined*, and `toggle('accessible', undefined)` then acts as a plain toggle.
   - Scan, evaluating through `createSnapshotInterface` (the UI's path): **18 of 224 presets** have exit or location
     rules in reachable regions that evaluate to `undefined`, with **0 throws**. The largest:
     - `zillion` 147 (empty and full inventory);
     - `smz3` 25 (both);
     - `alttp_worldgen` / `alttp_vanilla_worldgen` 25 at full inventory (`Desert Palace - Boss`…);
     - the alttp multiworlds 5 each;
     - `procgen_topdown` AP_7/AP_8 5 each.
   - So it predates this slice. A throwing rule is just one more way in.
   - The scan approximates the panel's interface: it uses a location context for location rules. The panel's own
     count could differ.

Two follow-ups for js-14, both outside this slice:

- `regionBlockBuilder`'s double class.
- The spoiler comparison's silent pass when the log does not expect the location.

## loadRules measurement (measured; the worker is not changed)

Throwaway Playwright probe, `?game=concept_trial&seed=1`. A context-level route rewrites the served
`AP_1_rules.json` (`region_2_2` exit `exit`'s `access_rule` → `{rule:'List', args:{value:5}}`). The committed preset
is untouched. The route was hit 3 times (main thread and worker).

**BEFORE** (shared `daee222`'s `core.js` swapped in):

- Console: `[stateManagerWorker onmessage] Error processing command: loadRules TypeError: listValue.map is not a
  function`, then `[StateManagerProxy] General worker error (from new handler): {type: workerError, command:
  loadRules …}`.
- Stack: `evaluateRuleBuilderRule` ← `core.js` ← `StateManager.evaluateRule [as evaluateRuleFromEngine]` ←
  `runBFSPass` (`reachabilityEngine.js:425`) ← `computeReachableRegions` (`:260`) ← `processStartingItems`
  (`initialization.js:577`) ← `loadFromJSON` (`:96`) ← `handleMessage` (`stateManagerWorker.js:562`).
- After 30 s: `getStaticData()` is `undefined`, the current region is `null`, and no text adventure is rendered. **The
  page does not boot.** There was no `pageerror`.

**AFTER** (this branch):

- **The page boots.** 4 regions are loaded and the player is in `region_2_2`.
- The worker logs `[ruleEngine] [evaluateRule] Error during evaluation: {ruleType: undefined, ruleName: List, …}` once
  per evaluation: ~13–23 at boot, more on each recompute.
- The worker's snapshot has `region_2_3: unreachable` (the exit counts as false).
- The wrapper renders the exit `tae-link-accessible tae-link-rule-error`, with the tooltip `Access rule error (left
  passable): listValue.map is not a function`. It logs `[tasw-bridge] access rule threw in room "region_2_2", exit
  "exit" — left passable: …` about 10–20 times (once per pass).
- **Clicking the exit moves the player into `region_2_3`**, with the guardian's passed prose. The text adventure
  passes the player through while the worker still reports `region_2_3` unreachable. This is the user's passable
  policy meeting a worker that is not told about the error. I recorded it and did not change it.

## Concept trial

`check-concept-trial-play.mjs --host=http://localhost:8140` (this tree), serial.

- **First loop, 7/10.** Runs 2–7 failed one check each, the same one: Phase A0 `timeout waiting for: the
  late-snapshot page renders exit before its snapshot`. Those runs overlapped a CPU-heavy job of mine (the procgen
  reference regeneration plus the 494-test `procgenDocs` vitest). Runs 1 and 8–10, with nothing else running, passed.
- **Second loop, 5/10**, with nothing of mine running. The failures were again A0, in a run of consecutive runs
  (4–8). The box load was ~9–11 on 8 cores, all from other sessions.
- **Control, interleaved A/B, 8 runs each, same server, same minutes.** A is this branch. B is the base versions of
  `core.js` (shared `daee222`) and `roomAccessibility.js` (`16d1b67084`), swapped into the working tree between runs.
  Load was 12–19.
  - A: **2/8**.
  - B: **1/8**.
  - Every failure in both arms is the same A0 timeout.
- **Reading:** the A0 failure is load-bound and hits the base equally. It is not this change. That also follows from
  the code: A0 holds the snapshot back, so `roomAccessibility` returns `known: false` before `createContext`, and none
  of the changed code runs. The quiet-box runs, 4/4 (loop 1, runs 1 and 8–10), all passed.
- **Total: 12 of 20 runs passed**, and A0 is the only failing check.
- The exact failing text is the same in both arms: `FAIL: fatal: timeout waiting for: the late-snapshot page renders
  exit before its snapshot`. Arm A had 6 failures, arm B had 7. **So A0 is load-flaky on base main too.** A rate on a quiet box is still owed if js-14
  wants one; I could not get a quiet box this session.

## WORKER ERROR INVESTIGATION (no code; a worker fix is a separate slice and needs the user's word)

### 1. Trace: why a `loadRules` throw is fatal

1. `stateManagerWorker.js:1728` `onmessage` enqueues the command. `processQueue` (`:305`) runs `executeCommand` →
   `handleMessage`.
2. `handleMessage` `case 'loadRules'` (`:543`) awaits `stateManagerInstance.loadFromJSON(rulesData, playerId)`
   (`:562`). That goes through `stateManager.js:344` to `core/initialization.js` `loadFromJSON`.
3. `loadFromJSON` runs these steps in order, none with a try:
   1. `validateJSONData`;
   2. `loadPlayerData` (regions, locations, index building);
   3. `initializeGameLogic`;
   4. the inventory;
   5. `loadShops`;
   6. `processStartingItems` (`:96`), which runs **`computeReachableRegions` at `:577`** (or `batchUpdateManager.js:171`
      when there are starting items);
   7. `initializeVirtualItems`;
   8. `buildIndirectConnections` + `computeReachableRegions` again (`:106-107`).
4. `computeReachableRegions` (`reachabilityEngine.js:204`) has only `try/finally` (`:219/:336`), which resets
   `_computing`. `runBFSPass` (`:364`) evaluates each exit's rule at **`:425` with no try**.
5. **Before the fix:** a Rule Builder throw goes straight up to `handleMessage`'s catch (`:1683`). That catch logs
   `Error processing command: loadRules …` and posts `{type: 'workerError', command, errorMessage, errorStack, …}` with
   **no `queryId`**, because `loadRules` is sent fire-and-forget (`stateManagerProxy.js:1428`).
6. **After the fix:** the rule-evaluation throw is gone (step 4 answers `undefined` → false). The same chain still
   carries every throw from steps 3.1–3.8 and from `getSnapshot` / `getStaticGameData` (`:563-566`).

**Why it is fatal:**

- **What the worker is left with.**
  - `rules`, `regions`, the inventory and the logic module are set.
  - Reachability is partial: `knownReachableRegions` was being built, and `cacheValid` is false.
  - The trailing steps never ran: the event reset, the second `computeReachableRegions`, the settings default.
  - **No `rulesLoadedConfirmation` is posted.**
- **What the main thread is left with.** The proxy's `workerError` case (`stateManagerProxy.js:642`):
  - logs `General worker error`;
  - publishes `stateManager:workerError`;
  - rejects nothing, because there is no `queryId` to reject.
- **Nothing in the app subscribes to `stateManager:workerError`.** It is only registered as a publisher
  (`stateManager/index.js:156`).
- `initialLoadPromise` (`stateManagerProxy.js:228`) has only a resolver. It resolves on `rulesLoadedConfirmation`
  (`:526`) and is never rejected. So `ensureReady()` waits forever, `staticDataIsSet` stays false, and every module
  gated on readiness never starts.
- So the page does not fail; it **hangs**. The only trace is two console lines.

### 2. Inventory: what can still make `loadRules` fail after the engine fix

Measured with the same probe on this branch (served `AP_1_rules.json` mutated by a route, concept_trial).

| # | Class | Repro (mutation) | Measured outcome |
|---|---|---|---|
| C1 | malformed JSON | the body is `{"regions": {` | ⚠ Fails on the **main thread** before the worker: `[init] Error loading rulesConfig from file: …AP_1_rules.json SyntaxError: Expected property name…` (`app/mode/modeDataLoader.js:739`). Then the alphabetical-preset fallback (`:651-670`) **boots a different game** (Adventure: `Overworld`, `YellowCastle`…) with no visible notice. |
| C2 | a missing helper | the exit rule is `{type:'helper', name:'no_such_helper'}` | Boots. The exit is shut (undetermined → false). **No error and no warning logged.** Silent. |
| C3 | a throwing exported helper body | `helpers['1'].boom.body = List`; the exit rule is `helper boom` | Boots (caught now). The worker shuts the exit. The wrapper marks it passable plus the error tooltip: the hook reached the helper body in the browser. |
| C4 | an unknown rule kind | `{type:'no_such_kind'}` | Boots. The exit is shut. `warn Unknown rule type` per evaluation (~30). |
| C5 | structural: `exits` not iterable | `region_2_2.exits = 5` | **Fatal**: `loadRules TypeError: region.exits is not iterable` (`reachabilityEngine.js:242` / `:470`), plus the same in `apworldEditor`'s `rawJsonDataLoaded` handler (a `pageerror`). The page does not boot. |
| C6 | an exit to a missing region | `connected_region = 'nowhere'` | Boots. The exit is shut. Nothing logged. |
| C7 | no regions for the player | `delete regions['1']` | Boots **empty**: 0 regions, current region `Menu`, no text adventure. Nothing logged. |
| C8 | a location rule throws | every `region_2_2` location rule is `List` | Boots (caught). |
| C9 | structural: a `null` exit entry | `exits.push(null)` | **Fatal**: `loadRules TypeError: Cannot read properties of null (reading 'connected_region')`, also in `apworldEditor`. The page does not boot. |
| C10 | a region without an `exits` key | `delete region_2_2.exits` | Boots. The room has no exits. Nothing logged. |

Classes not reproduced here, read from the code:

- A JS game-helper that throws: `snapshotInterface`/`ruleEvaluator` `getHelperFunctions(game)[name](…)` is called from
  inside a handler, so the AST catch already catches it.
- A throw in `getSnapshot` / `getStaticGameData` (`stateManagerWorker.js:563-566`): fatal by the same chain.
- A throw in the depth-0 SMBool post-processing (`core.js`, outside both trys): fatal if it happens inside BFS;
  needs a malformed `state.smbm`.
- `validateJSONData`: throws a named `Error`, which is fatal by the same chain.

So, after the fix: rule-evaluation errors (C2–C4, C8) no longer kill the load. **Structural data errors (C5, C9, and
any throw in index building) still hang the page.** C1 and C7 "succeed" into the wrong thing.

### 3. What "specific" could mean

| Class | What the worker could name |
|---|---|
| rule error (now caught) | game, player, the **rule's location** (the exit `from → to`, location name, or helper name), the rule node (`ruleName`/`ruleType`), the message. `runBFSPass` knows `fromRegion` and `exit.name`, and the hook gives the node: a worker hook set in `_createSelfSnapshotInterface`'s context variables would carry all of it. |
| structural (C5, C9) | game, player, **the phase** (`loadPlayerData` / `processStartingItems` / `computeReachableRegions`) and, where the loop has it, the region/exit being processed; the message. Today only the message and stack survive. |
| validation | already a named `Error`; it only needs to be shown. |
| malformed JSON (C1) | the file path and the parse position; this belongs to the main thread, not the worker. |
| silent defaults (C2, C6, C7, C10) | could be warnings: "helper X not found (exit A→B)", "exit A→B targets unknown region", "player 1 has no regions". |

How it could reach the user:

- **Worker → main.** Keep `workerError`, but give it `phase` and `where` fields. For `loadRules`, also post a
  **`rulesLoadFailed`** (with `loadSeq`) so the proxy can reject `initialLoadPromise` / mark the load failed instead
  of waiting forever.
- **Page.** Something must subscribe: show a banner or modal (`stateManager:error` is registered and unused too) with
  the game, the phase and the message. Today the console is the only surface.
- **Degraded or stop.**
  - A rule error can degrade: the load completes, and a per-load list of rule errors (exit/location → message) is sent
    with `rulesLoadedConfirmation`, so a panel can list it and the wrapper's marker has a worker-side twin.
  - A structural error should **stop with a named error**. Continuing on half-built regions/indices would give wrong
    reachability silently, which is worse than a clear stop.

### 4. Options

**A. Named load failure (the minimum).**

- Files:
  - `stateManagerWorker.js`: the `loadRules` case wraps `loadFromJSON`; on a throw it posts `rulesLoadFailed {loadSeq,
    game, player, phase, message, stack}`.
  - `core/initialization.js`: a `phase` marker set before each step, read by the catch.
  - `stateManagerProxy.js`: rejects or flags `initialLoadPromise` and publishes `stateManager:loadFailed`.
  - One page-level subscriber (a banner in `app/` or the init flow).
- Risk to the core: low. The success path is untouched; this only adds a failure path. The care point is the reload
  case: `isPotentialStaleSnapshot` and `staticDataIsSet` must be restored so a later good load still works.
- Size: about 80–120 lines plus tests.
- Pins:
  - a worker unit test: C5 and C9 fixtures post `rulesLoadFailed` with the phase;
  - a proxy test: `ensureReady` rejects or settles;
  - a browser row: a broken served rules file shows the named error, and the page does not hang.
  - Mutant: the old catch (only `workerError`) → the pins fail.

**B. A + rule-error report (degraded boot with a list).**

- Files: A's files, plus:
  - `_createSelfSnapshotInterface` (`stateManager.js` / `statePersistence.js`) passes an `onRuleError` context
    variable that records `{exit|location, node, message}` per load;
  - `runBFSPass` / `isLocationAccessible` supply the where;
  - `rulesLoadedConfirmation` carries `ruleErrors`;
  - one consumer, e.g. a console summary plus a marker in the Exits/Locations panels.
- Risk: medium. It touches the BFS hot path: a context variable per exit evaluation. That needs a bench check
  (`ruleEngine.bench.js`) and must not change reachability results. The spoiler/regression suite is the guard.
- Size: about 200–300 lines.
- Pins: A's, plus:
  - a worker test: a throwing exit rule → the load completes, `ruleErrors` names the exit and node, reachability is
    unchanged versus no-hook;
  - TT regression green.

**C. Validate before loading.**

- A schema/shape pass over `rulesData` (`frontend/schema/rules.schema.json` exists) before `loadFromJSON`. It names
  C5, C9 and C7 as data errors with JSON paths.
- Files: the worker `loadRules` case plus a validator module.
- Risk: low to the core, but the schema must match every committed preset. A false reject would turn a bootable game
  into a stop, which is the dangerous direction. It should start as warn-only.
- Size: medium. Pins: every committed preset validates clean, and the C5/C7/C9 fixtures are named.

**Recommendation: A first, as its own slice.** It turns "page hangs, two console lines" into "named stop: game,
player, phase, message" for every remaining fatal class, with no change to the success path. B is the natural next
step if the user wants the worker to mirror the wrapper's marker. C is worth it later as a warn-only lint, mostly for
the silent classes (C2, C6, C7, C10). Separately, C1's silent fallback to another game is a main-thread
(`modeDataLoader`) question, not a worker one.

## CI

At outer `c0ef47853e` (branch `rule-engine-catch-and-report`):

- JSUT run `41214610458`: **success** (every shard, the slow vitest, the browser gate shards, producer checks).
- unittests run `41214610476`: success. The Python jobs were skipped by its "Python tests needed?" gate (no Python
  change).
- **Fresh TT** run `41214661046` (`workflow_dispatch`): **success on attempt 2.**
  - Attempt 1: every substrate batch was green. One job was red, *Test ALTTP Spoiler & Frontend Regression*.
    - The unbundled leg passed 59/59.
    - The `--bundled` leg failed 2 rows, both `STUCK`:
      - `test_settings_colorblind_mode_toggle` ("Colorblind symbol not found in Menu region");
      - `test_json_panel_import_from_text` ("Failed to update colorblind regions setting to true"), which follows from
        the first.
    - A `QuotaExceededError` saving `archipelagoToolSuite_modeData_test-regression` to localStorage appears in both
      legs.
  - Main's TT at the base `16d1b67084` (run `41212705192`) was green.
  - `gh run rerun --failed` → the regression job passed.
  - A local `npm test -- --mode=test-regression --bundled` at this tip: **59/59**.
  - So it reads as a flake: 1 red out of 2 CI attempts plus 1 local run. The colorblind rows read the Regions panel's
    symbols, not rule results. I did not chase it further. js-14 may want its rate from `test-substrates-repeat`.
  - Job ids: attempt 1, red: `124576571009`. Attempt 2, green: `124579951685`.
- TT runs `--mode=test-regression` (unbundled and bundled) and the substrate batches, so the spoiler regression mode is
  covered.

**At the merged tip `f7a0fca7f2`.** Main moved to `b646d32d95` (tile-mechanisms-m1) during the slice, so I merged it
in. The only conflicts were the two generated procgen files: I took main's versions and regenerated them.
`procgenDocs` was 494/494 after that; the pins plus `mazeRoom/tileSpike` were 242/242.

- **Fresh TT** `41218859854`: **success**, first attempt.
- unittests `41218860955`: success.
- JSUT `41218860997`: **success**. After that, shared `main` was fast-forwarded `daee222 → 733945b`, and `merge-base --is-ancestor 733945b origin/main` gave rc=0.

The outer diff against `origin/main` is 7 files. `frontend/modules/shared` (`daee222 → 733945b`) is the only 160000
row.

**State manager vs wrapper on a throwing exit.** They DISAGREE: the tracker/worker reports `region_2_3` unreachable (the
exit is false), while the text adventure shows the link passable and marked, and a click moves the player through. This
is the user's chosen design. The wrapper policy is the 10-30 ruling, and the worker was left as-is by the 10-31
ruling.

## STOPPED / for js-14

- Nothing STOPPED.
- **Landing.** Shared follows a linear direct-to-main pattern (`git log origin/HEAD`: one commit after another on
  `main`). The plan, on js-14's GO:
  1. DONE: shared `main` fast-forwarded `daee222 → 733945b` after JSUT `41218860997` went green.
  2. DONE: `merge-base --is-ancestor 733945b origin/main` gave rc=0.
  3. DONE: the outer tip `f7a0fca7f2` rode TRAIN 4, which landed as main `c14dc07626`. This report update is a
     docs-only commit on top of it.
  The gitlink is the only 160000 row in the outer diff.
- Follow-ups noted above:
  - `regionBlockBuilder`'s `toggle(…, undefined)` double class;
  - the spoiler comparison's silent pass;
  - the generic message in `seedlingDoorGate`;
  - the worker/wrapper disagreement on a throwing exit (passable in the text adventure, unreachable in the worker),
    which belongs with the worker slice.
