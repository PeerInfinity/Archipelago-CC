# AN-MYST-1: the ActionNodes ↔ mystery page bridge, without the goal wiring (as-built)

Session `actionnodes-mystery-bridge` (Opus), 2026-11-26/27, for planner `concept-library-content-planning-6`. Branch
`an-myst1` on main `4f0be2e6a2` (trains 226 mystery-substrate and 229 AN-TIME-4 + mystery-play). Code commit
`1ec9b28267`, screenshot `6e16c0e55b`, the re-init fix `8b200fe7bb` (§ 8b), then this report (report-only).

## 1. Robert's rulings, in order

- 2026-11-26, at launch: *"This may require further discussion."* (none of: the page's `questionSolved` or the goal
  node checks the goal; the page only; the goal node only). The slice was briefed to stop before the goal wiring.
- 2026-11-26, the goal itself (session `an-mystery-goal-discussion`): *"Page questions only (Recommended)"*. Every page
  question is a location that only the page's `questionSolved` checks, the final question (`q.who`) is the goal, there
  is no goal node, and the rules come from the case's own logic (*"Full: papers + requires (Recommended)"*).
- Whether this slice takes that goal, first answer: *"Fold into AN-MYST-1"*. Then, **replacing it**: *"Goal as its own
  slice (Recommended)"*. So AN-MYST-1 is the plumbing, and the world-side goal is AN-MYST-2 (§ 9; not licensed yet).

So the goal behaviour built here is an **interim**, not the decision. It is marked everywhere as
*"superseded by Robert's 2026-11-26 ruling (page questions are the locations, q.who the goal); the world-side goal is
AN-MYST-2"*.

## 2. The mystery owners' answers, quoted

**mystery-planning** (uds `718286.sock`; it has since handed the page to `mystery-template-forms`):
- Host module: *"I cannot confirm the host module … What the page needs is only this: whoever frames it answers
  mystery:requestState {story, version} with mystery:state {story, version, game, connected, papers, solved, loop?}, or
  mystery:refused."* On `loop`: *"the page takes `loop` as the day number (1 on the first day) … Send it in every state
  of a loop world, not only when it changes."*
- Version read: *"Yes, (a), and compare with visits.json, not rules.json … A visit case has no rules.json by design:
  the page reads its version from <case>/visits.json when the case has visits, else from <case>/rules.json. So your pin
  test should take whichever of the two files the case has."*
- The gate: *"If your host publishes a mystery:state in reply to a questionSolved it has ignored, the two will answer
  each other without end … If your host stays silent on the gated questionSolved (logs it, publishes no state for it),
  the page re-sends once per state it receives for other reasons … That is harmless."* And: *"the page marks the
  question solved in its own save whether or not the host ever lists it."*

**mystery-planning-archipelago** (uds `718387.sock`, the host's builder):
- *"Q1 yes, the slot-level block is the right host for your world; Q2 nothing else of mine is in flight in
  mysteryArchipelago/. Read the code at a28357c67e, not main: 225 changes the three files you name."*
- *"`mysteryBlockOf` returns null unless story is a string AND `locations` AND `items` are both objects. An empty
  `locations: {}` passes."* *"`solved` in the state is derived from `checkedLocations` through `locations`."*
- *"⚠ Robert's standing ruling is no single-game code: key the gate on DATA in the block … not on the game being
  ActionNodes."* This turned the goal-gate choice (§ 6).

**Planner (content-6)**, phase B: the base moved the game pin to `35bb7fe935` (train 229's mystery-play), so the
brief's `c37eaf43730f` / `7448fbeb1c` lines were superseded: *"Build on this pin … slot_data.mystery.version =
f778f1b06ee9, read from the export at the pinned submodule."* I read `0660f56a69` (the Playback Bot controller,
`getLivePlay`) and `7c50d3d73d`: no collision. The controller acts only on mystery REGIONS, and an AN world has none.

## 3. The fields

**The graph** (`frontend/modules/actionNodes/graphs/same-monday.json`), a new optional top-level field:

```json
"mystery": {
  "story": "same-monday", "version": "f778f1b06ee9", "case": "cases/miniatures/same-monday",
  "goal": { "node": "question", "question": "q.who" },
  "papers": { "paper-office": "office", "paper-inn": "inn", "paper-watch": "watch", "paper-pilot": "pilot", "paper-chandler": "chandler" }
}
```

`actionGraph.js` `validateMysteryLink` refuses a bad link by name (`bad-mystery`): the strings must be non-empty, `goal.node`
must be the goal node, the `papers` keys must be boons, and no paper may be mapped twice. The model and the logic never
read the block. No format addition beyond it.

**The world** (`actionGraphCompiler.js` `mysterySlotDataOf`), only for a graph with the link:

```json
"slot_data": { "mystery": {
  "story": "same-monday", "version": "f778f1b06ee9", "case": "cases/miniatures/same-monday", "goal": "q.who",
  "locations": {},
  "items": { "The harbour office": "office", "At the Ship inn": "inn", "The night watchman": "watch",
             "The pilot": "pilot", "At the chandler's": "chandler" } } }
```

This is the spec's shape, with `locations` empty (§ 6). The item names come from the graph's boons, so no story id is in code.

## 4. The host wiring (`frontend/modules/mysteryArchipelago/`)

- **Which host.** The slot-level block. `mysteryBlockOf` parses it, `MysteryPanelUI.syncToWorld` frames
  `./modules/mystery-clue-game/index.html?case=cases/miniatures/same-monday`, and `MysteryArchipelagoLogic` answers. Nothing
  new: the world simply carries the block.
- **`papers`.** These already came from the inventory by `items` (`mysteryStateOf`). A received paper item is held on the page.
- **`loop`.** There is a new optional dep, `getLoopNumber`, wired in `index.js` to `loopNumberNow()`: the ActionNodes
  runtime's `loopNumber` while it holds a world (through `actionNodes:getRuntime`), else null. `mysteryStateOf` adds `loop`
  only for an int ≥ 1, so any other world's state is byte-identical to before. `LOOP_NUMBER_EVENTS`
  (`actionNodes:stateChanged`) re-sends it, and its intent is declared beside `LIVE_PLAY_EVENTS`. A loop reset after a loop
  with progress numbers the next loop, and the page is told `loop: 2`.

## 5. The version read (the pair)

The game is the submodule `frontend/modules/mystery-clue-game`, pinned on main at `35bb7fe935`. Its
`cases/miniatures/same-monday/visits.json` has version `f778f1b06ee9` (it now also carries `questions[].ways` and
`goal.ways`). The world's `version` lives in the graph as data. `mysteryPin.test.js` reads, for each committed preset
with a mystery block, `<case>/visits.json` when the case has one (else `rules.json`, as before), and holds story, case,
version, goal and the paper set equal at the pin. **This is the pair guard:** moving the gitlink past a change to the case
without re-recording the preset goes red. I checked this by setting the preset's version back to `c37eaf43730f`: the row
went red, naming both values. No gitlink moves in this slice. In the running app the page asks with the version it reads
from the same file, and the in-app row checks that it equals the world's.

## 6. The goal gate (⚑ PENDING, superseded)

**Choice: `locations: {}`, with no host branch.** The compiler writes an empty question map
(`MYSTERY_QUESTION_LOCATIONS_PENDING`, carrying the marker). A `mystery:questionSolved` then maps to no location, and the
host's existing path drops it **silently**: a log line, no `user:locationCheck`, no `mystery:state` in reply, so there is no
echo loop with the page. The goal stays the goal node's to check. Why this choice:
- It is keyed on data, as the no-single-game-code ruling asks, not on "this world is ActionNodes".
- It leaves `solved` empty, so the page is never told a question is solved by a node.
- Leaving `locations` out entirely would make the block unparseable (no frame at all).

My first plan, a host branch for "AN worlds" with `locations` filled, was dropped for those reasons, and the planner
approved the revision. The `goal` field is written as specced; the host does not read it today.

**Pins:**
- vitest `mysteryActionNodesBridge.test.js`, on the committed preset's own slot_data: questionSolved → zero dispatches,
  zero publishes; goal unchecked; the goal location checked (as its node does) → `solved` still lacks `q.who`.
- vitest `actionMysteryLink.test.js`: the empty map is pinned with the marker, and the goal location holds Victory, locked.
- in-app `an-mystery-goal-pending` (§ 8).

**The later ruling is a compiler change plus a re-record** (AN-MYST-2, § 9). The page's own save marks the question solved
regardless (mystery-planning).

## 7. The preset re-record

`action_nodes_same_monday/AP_1` was re-recorded by its recorded recipe: `node scripts/procgen/action-nodes-compile.mjs
frontend/modules/actionNodes/graphs/same-monday.json -o frontend/presets/action_nodes_same_monday/AP_1/AP_1_rules.json
--seed 1` (attempt 1). The diff is +17/−1, the `world["1"].slot_data` block alone. Everything else is byte-identical
(sha256 prefix `cfa5c8c0cd23` → `30280ff275f3`). `action-nodes-compile --check`: all 3 committed AN presets match;
`action_nodes_example` and `action_nodes_omsi_town` are untouched. The spoiler test (`--game=action_nodes_same_monday
--seed=1`) PASSED, and its sourceName was `./presets/action_nodes_same_monday/AP_1/AP_1_rules.json`, not the default.

## 8. Proofs

**In-app rows** (local, port 8130, `test-substrates --test=…`, both PASSED, 0 refused):
- `an-mystery-bridge-papers-loop` (category ActionNodes → batch **fast**, 1.3 s locally). The real page is framed at
  `case=cases/miniatures/same-monday`. It asks with the world's story and version, and the first state is `loop: 1` with no
  papers. One visit (*Look over the harbour office*, which holds the paper `inn`) runs through the Loops queue, and the
  state then holds `inn`. After a loop reset the state carries `loop: 2` (runtime `loopNumber` 2), and the paper is still
  held. Every state carried an integer loop.
- `an-mystery-goal-pending` (category Playback Bot → batch **playback-bot**, 2.6 s locally). With the stand-in page, the
  host received `questionSolved {story: "same-monday", questionId: "q.who"}`. It brought zero `mystery:state` back (after a
  400 ms quiet window), checked nothing, and the goal stayed unchecked. The Playback Bot then played the world (finished,
  3 loops), the goal was checked by its node, the page was sent the papers, and `solved` still lacked `q.who`.
- ⚠ Deviation from "two fast rows": the goal-pending row needs the bot to perform the goal node, so it belongs in the
  Playback Bot batch. Only one row is added to fast.

**Screenshot** `actionnodes-mystery-bridge-shots/1-same-monday-page-holds-papers.png` (`shots.mjs`): The Same Monday after
two visits, with the Mystery Game panel framing the real page on Day 1, showing *A paper has come: At the Ship inn* and *At
the chandler's*. Its last `mystery:state` was `{story: "same-monday", version: "f778f1b06ee9", connected: true, papers:
["chandler", "inn"], solved: [], loop: 1}`. ⚠ The page starts only on a connected state, and an ActionNodes world cannot be
hosted on a server (it has no Python world). So for this picture alone, `shots.mjs` answers the client's
`getConnectionInfo` as connected; the papers, loop and version are the host's real answers. The story paragraph and the
answer names are blurred (no story text in this repo).

**Gates** (at `1ec9b28267`; the screenshot commit adds only the PNG and its script, and the fix `8b200fe7bb` touches only
`mysteryArchipelago/` + its vitest, re-gated by CI in § 10):
- `ci-producer-checks`: 100 run, 0 red.
- `check-sidecar-fields`: ALL PASS, 2462 entries.
- `generate-procgen-reference --check`: all 7 modules and 5 regions match, after a regen of `docsIndex.js` and the README
  row byte counts.
- `check-procgen-docs`: ALL CHECKS PASSED.
- `action-nodes-compile --check`: 3/3.
- Gitlinks 0. Closure ∩ diff = ∅ (engineMd5 `74ae60f5`, 42 files).
- Bounded vitest:
  - `actionNodes/` (non-slow): 15 files, 239 tests.
  - `mysteryArchipelago/`: all green.
  - `procgenDocs/`: 8 files, 498 tests. The docs census was bumped 456 → 459: one same-doc link and two doc links, from the
    new `### The mystery link` section and the `loop` bullet in mystery.md.
  - Two `scripts/procgen` Seedling suites were red in a bounded run and are not this diff: `probeSeedlingErRetarget` and
    `seedlingSolverSurface` need `flashPanel/wasm` (worktree made without `--with-wasm`), and `mazeInputOutputSplit` passes
    alone (load).

**Roster delta** (base `4f0be2e6a2` → tip):
- Substrates rows 476 → 478 enabled: ActionNodes 18 → 19, Playback Bot 13 → 14.
- New vitest files: `actionMysteryLink.test.js` (8) and `mysteryActionNodesBridge.test.js` (7, one of them the re-init pin).
- `mysteryPin.test.js` gains 1 test.
- Docs links 456 → 459.
- preset_files.json, sidecar census and schema count unchanged: no new preset, no new region.

## 8b. A defect my row exposed: two bridges after a re-enable (fixed, `8b200fe7bb`)

- **What.** Closing the Mystery Game tab disables `mysteryArchipelago` (moduleLayoutSync). `enableModule` then runs the
  module's `initialize` again (`app/initialization` → `initializeSingleModule`, every time). `initialize` built a new
  `MysteryArchipelagoLogic` and never unsubscribed the old one, so after a close and reopen **two bridges** answered every
  page request: each `mystery:state` and `mystery:refused` reached the page twice.
- **How it hid.** On main the first mystery row in the fast batch is `mystery-bridge-round-trip`, the only row that counts
  refusals. The rows after it (`mystery-real-page-handshake`, `mystery-region-office-and-street`) already ran on doubled
  bridges but assert nothing that sees it.
- **How it surfaced.** `an-mystery-bridge-papers-loop` (fast, position 126) opens and closes the panel before round-trip
  (143). TT `46064844454` at `6e16c0e55b` went red on fast and fast-bundled: *"the refusals are named"*, expected
  `other-version,other-story`, got `other-version,other-version,other-story,other-story`. Main at the base was green twice
  (`46064239216`, `46059018202`).
- **Repro** (local, port 8130):
  - CI rows 126..143 → red;
  - the same rows without mine → green;
  - the bare pair (mine, round-trip) → green (a row in between is needed);
  - mine + `quick-launch-button-opens-panel-never-in-layout` + round-trip → red.
- **Fix** (its own commit, mysteryArchipelago only): the logic keeps its unsubscribe handles; `dispose()` drops them, and
  `initialize()` calls it first; `index.js` disposes the old bridge before building a new one. vitest pins one subscriber
  per event after a double initialize and after a re-init. Locally, rows 126..143 plus the other mystery rows and
  `an-mystery-goal-pending` are 21/21 green. `mystery-playback-bot-plays-the-case` and `-loop-mode` stay green.
- **Owners told before the push.** mystery-planning: *"No: nothing from mystery-planning touches Archipelago-CC's
  mysteryArchipelagoLogic.js or index.js, now or ever … receiving each state once instead of twice needs nothing from the
  page, which treats every state as the whole sets."* mystery-planning-archipelago (the host's builder) had ended; its
  socket was gone.

## 9. AN-MYST-2 design notes (the world-side goal; not licensed yet)

As sketched for the planner on 2026-11-26, updated for the export now at the pin:
1. **Graph format.** The `mystery` block keeps the case link and gains `questions: {<question id>: {name}}` and `goal:
   <question id>`. The `name` is the location name; the export has no question text. It does not hand-write rules. The
   graph loses its `kind: "goal"` node, and the validator accepts "no goal node iff a mystery block names a goal question".
2. **Compiler.**
   - One location per declared question, in a non-node region: a new **"Case"** region, reached from Menu by a true rule,
     so the Regions panel shows it apart from the visits.
   - Rule = OR over the export's ways of AND(`has(<paper item>)` for each paper via `items`, and `solved(<q>)` for each
     `requires`).
   - The goal question holds Victory, locked, with `completion_condition` item_check Victory as today.
   - **`requires` → another question:** the builder has no "location checked" rule kind, and a new kind breaks the
     inventory evaluators. So each question also places a locked event, **item `Solved: <q>`**, collected only on its check
     (like AN-TIME-2's KNOWLEDGE `event_kind`), and `requires` becomes `has("Solved: <q>")`.
   - Non-goal questions in a multi-question case need fillers or locked events: a pool decision for that case. The Same
     Monday has none.
   - A6: the goal location must be in the sphere log. The question rules are item-only, so they sit outside the one-loop
     node search.
   - `slot_data.mystery.locations = {<name>: <question id>}` for every question.
   - A test pins world rules == the export mapped through `items`.
3. **Host.** No change for the goal. `handleQuestionSolved` already dispatches `user:locationCheck` (`reportedByGame:
   true`), after which `solved` lists the question, so there is no echo. Drop `MYSTERY_QUESTION_LOCATIONS_PENDING`.
4. **The goalIndex sites** that assume the goal is a node: `actionModel.js:110`, `actionNodesRuntime.js:151`,
   `actionPlanner.js:216/407/416` and `actionLiveSim.js:79`. They need a "goal = a location" path. The planner stops once
   some goal way's papers are held. `action-nodes-play.mjs` checks each question whose rule holds, as the page would. The
   runtime and panel must not treat a missing goal node as an error. This is the largest piece.
5. **The reader** takes both shapes. The pin's `visits.json` (`f778f1b06ee9`) has `questions: [{id: "q.who", ways: [{papers:
   ["inn", "office", "watch"], requires: []}]}]`, `goal: {question, papers (flat, kept), ways}`, with sorted arrays. An
   older flat `goal.papers` becomes ways with `requires: []`. A version move is a pin move plus a re-record (§ 5's guard).
   Don't use the regenerated `same-monday-typed` twin.
6. **Rows.** Every row that plays The Same Monday to Victory (`an-same-monday-clock` does not; `an-mystery-goal-pending`
   does, and becomes the goal's positive row) must go through the page, or a `questionSolved`, once the node is gone. That
   is a roster change to an existing row. The Playback Bot hook (asking the page's solver after each papers change) and the
   Feature Check walk are separate, page-side work first (`mystery-template-forms`).
7. **Re-record.** The goal node goes, so the region count drops by one and ids are re-allocated by sorted name (the
   question's location name is unchanged).

## 10. CI

**At the code tip `8b200fe7bb`** (after it, this report alone):

| Check | Run | Result |
|---|---|---|
| ut (`unittests`) | 46070653838 | success |
| JSUT | 46070653784 | success |
| TT (all on-push batches) | 46070653368 | success |
| feature-checks (`test-substrates-manual`, `batch=feature-checks`) | 46070656413 | success |
| `an-mystery-bridge-papers-loop` ×8 | 46070659107 | **Rate: 8/8 passed** |
| `an-mystery-goal-pending` ×8 | 46070661928 | **Rate: 8/8 passed** |

**TT batches at the tip vs main at the base** (TT `46064239216`, `4f0be2e6a2`):

| Batch | Rows at base → tip | All passed | Headroom at base → tip |
|---|---|---|---|
| fast | 145 → 146 (+`an-mystery-bridge-papers-loop`) | yes | 56% → **55%** |
| fast (bundled boot) | 145 → 146 | yes | 56% → **54%** (under the 60% line) |
| playback-bot | 21 → 22 (+`an-mystery-goal-pending`) | yes | 38% → 35% |
| seedling-js | 45 → 45 | yes | 49% → 47% |
| seedling-js-solver | 12 → 12 | yes | 33% → 31% |
| seedling-wasm | 15 → 15 | yes | 33% → 35% |
| apworld | 142 → 142 | yes | 34% → 31% |

**The fast headroom against the median of 3 main samples.** Main TT runs `46064239216`, `46059018202` and `46048477276`
read fast 56 / 56 / 53% (median **56%**) and fast-bundled 56 / 57 / 56% (median **56%**). The tip reads fast 55% and
bundled 54%, inside main's spread. The one added fast row takes 0.6 s in CI and 1.3–1.9 s locally. No existing row changed
status: every row passed at the base and at the tip. The only change was `mystery-bridge-round-trip`, red at the
intermediate tip `6e16c0e55b` (TT `46064844454`, § 8b) and green again after the fix.

**Earlier tip `6e16c0e55b`** (for the record): ut `46064744870` ✓, JSUT `46064744869` ✓, TT `46064844454` ✗ (fast and
fast-bundled: round-trip only), fc `46064847757` ✓, repeats `46064850766` and `46064853968` ✓.

**At the report tip:** the report-only commit gets JSUT and ut on push; JSUT is dispatched there too (the planner records
the ids).
