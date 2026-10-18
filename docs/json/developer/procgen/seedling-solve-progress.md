# The Seedling Solver's Progress Stream

What the Seedling solver reports while it solves: one hook, called at fixed points in the search, and a snapshot that holds a tree of the solver's goals and rungs, a tile map of the states it previewed, and its work counts. The solver half lives in `frontend/modules/seedlingDemo/solveProgress.js`. The worker → page transport and the `flashPanel` display belong to the JS arc and are built against this page. `scripts/procgen/probe-seedling-solve-progress.mjs` prints the stream of a real solve in node.

⚖ The user (2026-10-11), on the progress display: *"Both, plus extras"*: a tree with attempts, successes and rejection tallies on each node; a tile map with a count and an earliest-arrival tick per tile; and a work-budget meter. All three come over one channel and are shown live. (The rate was about once a second until 2026-10-17; it is now the setting `flashPanel.seedlingSolveProgressIntervalMs`, §7.)

## 1. The hook

| | |
|---|---|
| Install | `withSolveProgress(onProgress, fn, {pass?})` runs `fn` with the hook active. Nested installs restore the outer one, the same way `withSolveDeadline` works. `solveSegment({…, onProgress})` installs it for one segment. |
| Signature | `onProgress(site, peek)`. `site` is the name of the point that called. `peek()` builds a snapshot and returns it (or `null` before the first segment starts). |
| When it is called | Only at fixed points in the search: every deadline site (`DEADLINE_SITES`, coarse and fine, whether or not a deadline is installed) and the count points in §3, the heartbeat among them (§3.1). It is never called on a timer, and the solver never reads a clock. |
| Throttling | The caller throttles. The JS worker reads its own clock in the hook, and at most once per `progressIntervalMs` (the panel's setting `flashPanel.seedlingSolveProgressIntervalMs`: 1000, 250, 100 or 50 ms, default 100) it calls `peek()` and posts `{type: 'solve-progress', id, snapshot, final}` (§7). The interval is a ceiling: the hook runs only at the solver's own sites, so a long stretch between two sites posts nothing. |
| Cost | With no hook installed, each count point is one null check (`activeProgress !== null`). With a hook installed, the counts are kept, and `peek()` does the materialising. |
| Observation only | Every count is read from a value the solver had already computed. Nothing is read back. A hook that throws is ignored. With and without the hook, every plan, trace, record and verdict is byte-identical (§6). |
| Off unless subscribed | Nothing goes into the request stamp, and no committed artifact changes. |

A snapshot is a copy. It is plain JSON (structured-clone safe), built fresh on each `peek()`, so mutating it does not touch the solver or the next snapshot.

Where the JS arc installs it: `solveAnytime` runs one `solveSegment` per pass, synchronously. So `withSolveProgress(hook, () => solveAnytime(…))` in the worker covers every pass. Alternatively, `solveFromTape` can hand `onProgress` to `solveSegment`. Each `solveSegment` under the install is one **segment** (§2). `segment.index` counts them from 0, so a caller that knows its pass order can map the index to a pass name, or install with `{pass}` around each pass.

## 2. The snapshot (`v: 2`)

```
{ v: 2,
  seq,
  segment: { name, index, level, pass?, outcome },
  tree:    { key, role, label, attempts, successes, rejections: { <reason>: n }, rejectionKinds: { <kind>: n },
             active, children: [ … ] },
  tiles:   { level, tile: 16, cols, rows, cells: [ [col, row, reached, firstTick], … ] } | null,
  budget:  { asks: { <site>: n }, work: { <unit>: n } },
  lastWhy: { why, kind, key, name } | null,
  heartbeat?: { at, count } }
```

`heartbeat` is present once the install has beaten at least once (§3.1). It is an optional field added under `v: 1`: a reader that does not know it loses nothing. `v: 2` (hammer-phase RK, the first Tier C slice) adds `rejectionKinds` on every node and `lastWhy`; every v1 field is the same bytes (§5, §6). Hammer-phase RK2 adds, within `v: 2`, the kind `precondition` and `lastWhy.name` (§5, "v2 additions (RK2)").

### `seq`

How many times this install has called `onProgress`, counting the call in progress. It counts across segments and never resets within one install, so it strictly rises from one hook call to the next. Two `peek()`s inside the same call return the same `seq`. The page uses it to order snapshots and drop duplicates (the JS arc's request). It is a count of hook calls, not a clock.

### `segment`

| Field | Meaning |
|---|---|
| `name` | the tape name the segment solves (`solveSegment`'s `name`) |
| `index` | which top-level `solveSegment` under this install, from 0. Each anytime pass is one segment, and so is each pass of `twoPassSolve`. A segment nested inside another solve is a `segment` node in the tree, not a new index |
| `level` | the level the run stands on now: the run's level after the last driven tick, or the boot level before the first one |
| `pass` | present only when the installer passed `{pass}` |
| `outcome` | `running`, `solved`, `refused` (a `SolverRefusal`), or `threw` (any other error, a `PendingDeclaration` included) |

A new top-level segment starts a fresh tree, tile map and budget.

### `tree`

Nodes are keyed by **role**, not by call. Repeating a derivation at the same place in the tree updates the same node. `key` is the path of role keys from the root (`segment/goal#0/walk/climb/rung:kill/arm:chaser`), so it is stable across snapshots and unique in the tree.

| Field | Meaning |
|---|---|
| `role` | `segment`, `goal`, `walk`, `verb`, `climb`, `rung`, `arm` or `search` (§3) |
| `label` | the role's name: the goal's kind and target, the verb, the rung, the arm or the search phase. Aggregated nodes carry no per-call detail |
| `attempts` | the times the role was entered at this place |
| `successes` | the times it returned (a walk arrived, a rung produced a corridor or changed the world, a search found its certificate) |
| `rejections` | `{reason: count}`, the times it refused or threw, keyed as below |
| `rejectionKinds` | `{kind: count}`, the same rejections by **kind** (below). Each rejection has exactly one kind, so on every node the two sum to the same count. `v: 2` |
| `active` | the node is on the path the solver is working on now |
| `children` | in the order they were first entered |

`attempts − successes − Σ rejections` is the count still open (an active node) or **passed over**: a rung that was asked and did not apply (the PULL rung in a room with no lane silencer) writes no row, so it has neither a success nor a rejection.

**Rejection reasons** use the words the solver already wrote; no text is invented. In order:
1. an error's `code` (`HAMMER_SAFETY`, `STRIKE_BOUND_EXHAUSTED`) or a search's `bound` (`exhausted`, `deadline`, `expansions`, `horizon`, `start`);
2. a named code that the sentence leads with or puts in parentheses (`STANCE_REENTRY —`, `(LIGHT_REENTRY)`);
3. otherwise the sentence that decides. The walk's own label (`solverBot(<tape>) … : `) is dropped. The text is cut at the first ` — `, `: `, `; `, ` (`, `. ` or line break, every number becomes `#`, and it is capped at 96 characters.

Rule 3 is why the same reason met at two positions counts as one key: `breakablerock@#,# cannot be broken by this run`.

**Rejection kinds** (`v: 2`, `solveProgress.progressKind`). The key is a *reason*: two refusals of the same class at two different sentences are two keys, and the cut drops the sentence's tail. The kind is a *class*, from a closed list (`REFUSAL_KINDS`), each named with a word the solver already uses for it. It is read from the same payload as the key (the error, the refused rung's row, or the search result), but on the **verbatim** sentence, never on the cut key: a refusal raised after a deadline trip carries the solver's `deadlineClause` (`⏱ DEADLINE: …`) at its end, past every separator the key cuts at. The first rule that matches decides:

| Kind | From the solver's fields | From the verbatim sentence |
|---|---|---|
| `deadline` | a search's `bound: 'deadline'` | `⏱ DEADLINE`, `anytime deadline`, `caller's deadline`, `at the deadline` (checked right after `pending`, so a refusal after a trip is the deadline's) |
| `pending` | a `PendingDeclaration`, a refusal's `pending`, `levelRun`'s `undeclaredKillLock` (the two-pass loop's by-design first pass) | — |
| `danger` | `code: HAMMER_SAFETY`; `obstacle.kind: 'danger'` (the ARROWLANE and AXETIMING refusals); search bounds `start`, `window`, `death`, `approach`, `train` | `probes dangerous` / `probes DANGEROUS`, `was HIT`, `HIT at dwell`, `danger map forbids`, `UNBILLED DAMAGE`, `fires a spit before` (RK2) |
| `bound` | `code: STRIKE_BOUND_EXHAUSTED`; search bounds `expansions`, `horizon` | `UPPER BOUND`, `maxPerSegment`, `bound`; RK2: `bounded at` (the opener chain's `NESTED_OPENER_DEPTH`), `strategies for one goal` and `cleared … obstacle(s) and` (both `MAX_STRATEGIES_PER_GOAL`) |
| `exhausted` | search bound `exhausted`; a `clear-tag` refusal's `unresolved`, unless its words are a state gate's (`precondition`) | `no walkable` / `admissible` / `stance` / `stall` / `side` / `state` / `kill` / `strike` / `forced hit` / `corridor` / `path` / `cell` (RK2; `NO` too), `NO LIVE BODY`, `found nothing`, `none of`, `plans no corridor`, `left no corridor`, `every input from here is hit`, `EXHAUSTED` (*no REACHABLE stance* counts: one word may sit between `no` and the noun); RK2: `removed every body it could`, `would be the first one again` (`LIGHT_REENTRY`) |
| `does-not-apply` | search bounds `body`, `dying`, `line`, `no-landing`; `clear-tag` reasons `wrong-level`, `cross-room-presser` | the QUESTION is the wrong one for the target: `question` (*"That is a KILL question"*), `STATIC census body`, `` `speed 0` ``, `is not a live body`, `is not a body` (RK2), `is dying`, `holds no`, `has no … tile`, `is not a presser`, `does not hold`, `resolves to NOTHING` |
| `precondition` (RK2) | `clear-tag` reasons `prerequisite`, `cannot-act`; an `unresolved` whose verbatim why carries one of these words | a **state gate**: the action is the right one, but the run or the world is not in the state it needs, whatever the search does: `the door cannot open in this state:` (the approach resolver's stable lead-in; never its predicate clauses), `only for a player holding`, `this run holds no` / `holds none` / `does not hold`, `with this run's bag`, `cannot be pushed` / `burned` / `opened` / `broken` / `struck by this run`, `the inventory has no … slot`, `has no weapon`, `holds no sword`, `holds NOTHING`, `is a SUB-ORDER`, `reachable only once`, `needs … discharged`, `plans from parks` (a crusher still charging), `until that solid is gone`, `does not act from inside a solid` |
| `already-true` | — | `already true`, `is ALREADY` |
| `unmodelled` | `obstacle.kind` `unmodelled-*` / `unbilled-*`; search bound `unmodelled`; `clear-tag` reason `no-verb` | `unmodelled`, `not modelled`, `does not model`, `unpriced`, `does not price`, `no strategy row`, `NOT REGISTERED`, `executor is registered`, `executor does not run`; RK2: `UNMODELLED`, `NOT registered`, `this run does not step`, `no choreography` (the crusher ordering search), `nothing computed the consequence` (the kill-lock ledgers) |
| `diverged` | `clear-tag` reason `not-written` | the run did not do what the plan said: `diverge`, `and the RUN rests`, `does not ARRIVE`, `does not land`, `never played` / `came to rest` / `armed` / `touched` / `ended` / `opened`, `still standing`, `still shut`, `is not open by`, `disagree`, `crossed to` / `from level`, `crossed a door`, `left level`, `press still down`, `is not dead` / `dying`, `still counted`, `is not in reach`; RK2, the executors: `never comes to rest`, `came` / `comes to rest at`, `the walk rests` / `settled at`, `does not settle`, `still frozen after`, `still open after`, `ticks without the`, `ticks of the … and no`, `is not complete`, `added nothing`, `as route step … requires`, `before the thrust`, `ticks after the thrust`, `left the player facing` / `at`, `did not fire` |
| `error` | any other thrown error that is not a refusal (a `SolverBotError` with no code, a module's own error, a `TypeError`) | — |
| `other` | the residue: a refusal or row that no rule recognises | — |

The field rules come first (the deadline's sentence second), then the sentence's rules in the table's order. The search bounds (`BOUND_KINDS`) and the `clear-tag` reasons (`CLEAR_TAG_KINDS`) are read out of the solver's source by a gate row, so a bound or reason added later without a kind fails it. No rung or verb name enters a rule: a rung's refusals are classified by their own words, so a rung that exists only behind a fidelity switch (`axeTimingRung`, `arrowLaneCrossing`, `sealDoorApproach`'s `approach`) classifies the same ON or OFF. OFF, it is just absent. On the committed solves (L18's hammer room, L40's kill rung, L6's climb, L3's walk) every rejection has a kind and none is `other` (§6). Over the solver's whole source the rules are a census, not a proof. RK counted 75 of `solverBot.js`'s 365 refusal and rejection sites whose fixed words no rule named (on each site's first ~200 source characters), beside 41 wrappers whose sentence is another's (`${what}: ${why}`, `why = detour.why`), whose kind is the inner sentence's. RK2 reads each site's whole sentence (its literals joined) and names the families: 4 sites are left, and each is named in the RK2 report — one soft-lock (no kind is honest for it), one `planSwordDash` row that never reaches the tree, and two whose words match at run time but not in a static head (`as route step ${i + 1} requires`).

⚠ **Not every kind the investigation listed reaches the tree.** `not-faster`, `leg-bound`, `stalled`, `crossing`, `shake-room`, `unpriced-hit` and the window `danger` are `planSwordDash`'s per-window rows (`row.kind`). A window rejected inside a dash plan is not a rejection of a tree node, and `planSwordDash` has no count point (§3). The deadline's `window` and `budget` are the JS arc's `limit.first`, which the tap knows and the solver does not. The solver sees only that its caller's `shouldStop` said yes, so its kind is `deadline`, and the first site that tripped is in the verbatim sentence (*first at `walk`*).

### `lastWhy`

The segment's **last** rejection, `{why, kind, key, name}`, or `null` before the first one (`v: 2`; `name` is RK2's, added after the other three, which keep their names and order).

| Field | Meaning |
|---|---|
| `why` | the rejection's sentence, **verbatim**: an error's `message`, a refused row's or a search's `why` (a search with no `why` gives its `bound`). Nothing is cut, masked or capped |
| `kind` | its kind (above) |
| `key` | the node it landed on: a refused rung's node, a search's leaf, or, for an error, the **deepest** frame it was thrown under |
| `name` | for a **thrown** rejection, the error's class as the error names itself (`SolverRefusal`, `PendingDeclaration`, `SolverBotError`, `Error`, `TypeError`, …), read off the error object, never its message; `null` for a refused rung's row or a search leaf, which are not errors. It keeps the class beside the kind: a thrown non-refusal whose words match a rule (the planner's *"no walkable tile path"*, an `Error`) takes that rule's kind, and `name` says it was an `Error` |

It is one object per segment, overwritten at each rejection, never a list, so the snapshot does not grow with the solve. An error that unwinds through several frames is one rejection. It keeps the deepest node, but its words are re-read at each frame, because they can grow on the way out: inside a segment that installed its own `shouldStop`, `withSolveDeadline` appends the deadline clause to a refusal raised after a trip.

### `tiles`

The map holds the **previewed player states** of the level the solver previewed in most recently. `null` until the first preview.

| Field | Meaning |
|---|---|
| `level` | the level these cells are in. A segment keeps one map per level, and the snapshot carries the most recent one |
| `tile` | 16 (px), the A* tile |
| `cols`, `rows` | the level's size in tiles (`world.width`, `world.height`) |
| `cells` | `[col, row, reached, firstTick]`, sorted by row then column, only for tiles reached at least once. `col = floor(x / 16)`, `row = floor(y / 16)` of the player's point |
| `reached` | how many previewed states fell in the tile, summed over every preview so far |
| `firstTick` | the earliest **run tick** (`ticksCompleted`, the clock dead frames advance too) of any previewed state in the tile. It can only fall |

**Why the previewed state.** It is the solver's search unit everywhere. Every corridor is certified by previewing it (`previewWalk`), and so is every dodge stall, detour candidate and dash window. The press kill's escape and approach searches step real states too (`spaceTimeReach`). Both are already computed with an absolute tick: `previewWalk`'s samples carry `{x, y, tick}`, and `spaceTimeReach`'s index `i` is the player at the top of tick `ticksCompleted + i`. So the count costs no simulation. The other two candidates were weaker. A `spaceTimeReach` expansion alone would leave plain walks blank, because only the hammer searches use it. The driven ticks are the plan, not the search.

### `budget`

| Field | Meaning |
|---|---|
| `asks` | `{site: n}`: how many times each deadline site's ask point was reached, coarse and fine, with or without a deadline. ⚠ The three hammer sites (`hammer-escape`, `-approach`, `-fight`) and `time` are asked from inside a search, which is handed a `shouldStop` only when a deadline is installed. Without one, they never appear here |
| `work.shouldStop` | the calls made to the caller's `shouldStop`. **This is the JS arc's work unit** (`jsRuntimeSolver.createWorkClock` ticks once per call), so under the page's budgeted pass it is the work spent by this segment. 0 with no deadline installed |
| `work.ticks` | ticks the segment drove (`advance` calls, including any a rewind later discarded) |
| `work.previews`, `work.previewStates` | `previewWalk` calls, and the samples they returned (the tile map's input) |
| `work.searchStates` | states the space-time searches kept (`spaceTimeReach`'s `nodes`), the tile map's other input |
| `work.expansions` | the space-time searches' expansions (`spaceTimeReach`'s, and `deriveFight`'s own queue) |
| `work.waypointsPlanned`, `work.replans`, `work.dashesPressed` | the segment's own counters, the same numbers its result reports |

`budget.limit` is not written by the solver: the budget belongs to the caller (`budgetWork`, `upgradeWindowWork` in `solveAnytime`). A page that wants a meter adds `limit: {shouldStop: budgetWork}` to the snapshot it posts.

## 3. The count points

| Role / site | Where (`solverBot.js` unless named) | What one count is |
|---|---|---|
| `segment` | `solveSegment` → `solveProgress.progressSegment` | one `solveSegment` call |
| `goal` | `solveSegmentUnder`, the goal loop | one goal of the list, keyed `goal#<index>`. A goal stays open until the next one starts or the segment ends |
| `walk` | `walkTo` (a wrapper around `walkToUnder`) | one walk to an aim. Stance walks nest under the verb, rung or arm that asked for them |
| `verb` | `walkToUnder`, the frontier branch | one frontier strategy applied (`verb:shove`, `verb:kill`, …): its stance walk and its executor |
| `climb` | `climbLadder` (a wrapper around `climbLadderUnder`) | one climb of the combat ladder |
| `rung` | `climbLadderUnder`: a marker at each rung's start, and `rowFor` | one rung asked. The rejection is the refusal the next rung's row carries (`refused.why`), or the climb's last `considered` reason when it exhausts |
| `arm` | `rowFor`'s `extra.arm` (`light`, `static-sword`, `press`, `chaser`); `execKill` (the frontier kill's `press` and `chaser` arms, counted at the caller) | one arm tried |
| `search` | `pressEscapeOnce`'s `traced` (`escape-<phase>`); `deriveApproach` (`approach`); `deriveFight`'s `done` (`fight`) | one space-time search. Its `bound` is the rejection |
| `preview` | `previewWalk`'s return | one walk preview (the tiles) |
| `heartbeat` | `previewWalk`'s `combatBefore`; `deriveKillByChaser`'s `scoreAll` (§3.1) | every `HEARTBEAT_EVERY[at]`-th pass of a long loop. Emit-only: not an ask, not a work unit |
| a deadline site | `deadlineReached`, `fineDeadlineReached`, and the `walk` check every `WALK_CHECK_TICKS` driven ticks | one ask point reached |
| `done` | `progressSegment` | the segment's last call, after its outcome is known |

Under C2 and the fidelity waves, no count point sits inside `spinnerFightForecast`, `spinnerForecastWithPress`, `deriveStrike`, `execKillByPress`, `execClearTag`, `pendingEarnedClears` or `planSwordDash`. Their callers count them.

### 3.1 The heartbeat (hammer-phase HB)

The sites above are where the solver's work changes shape, and some of its loops run long between two of them. On L40's kill rung (`r5-l40-part5` toward the totem part at (160,640)) the investigation measured 211 hook calls and 86 % of the solve in gaps over 100 ms, so a tap that posts at most once per interval had nothing to post on. The heartbeat is a count point inside those loops: `progressHeartbeat(at)` counts one pass of loop `at`, and every `HEARTBEAT_EVERY[at]`-th pass calls the hook with site `heartbeat`. The tap reads its own clock on that call and posts if its interval is due. A hook that ignores the site (or posts only at its interval) needs no change.

| `at` | Where | `HEARTBEAT_EVERY` | Why that N |
|---|---|---|---|
| `preview-sample` | `solverBot.js`: `previewWalk`'s `combatBefore`: its transit, stall and dwell loops each call it once a sample | 512 | a sample is ~45 µs on the 4-core cloud box (L40: 15,970 samples in ~0.7 s of preview) and ~3.5× that on the box the investigation measured: 512 samples are ~23 ms here and ~80 ms there, ~10 Hz |
| `kill-stance` | `solverBot.js`: `deriveKillByChaser`'s `scoreAll`, after each candidate's `planWaypointsOrNull` | 1 | one candidate's plan is ~130 ms here and ~450 ms there (L40 plans 20) |
| `plan-pull` | `botDriverV2.js`: `planWaypoints`' string-pull, before each `controllerPathClear` ask | 8 | an ask is ~3.3 ms here (881 over the L40 solve, ~73 % of each kill-rung gap): every 8th is ~26 ms here and ~90 ms on the investigation's box |

What it is not:
- ⛔ not a deadline site. It asks no `shouldStop`, is never counted in `budget.asks` or `budget.work`, and the solver reads nothing it writes. The JS arc's work units (the 640 / 85 budgets, the 300 s backstop) are the same with it as without.
- ⛔ not a clock. The count decides when it calls; only the hook reads a clock.
- With no hook installed, each site is one null check (`activeProgress !== null`) with a literal key.

`snapshot.heartbeat` is `{at, count}`: the loop that beat last, and how many beats this install has emitted.

⚠ **The planner's string-pull.** On L40, ~70 % of each kill-rung gap is one call to `botDriverV2.planWaypoints`, in its string-pull (`controllerPathClear`, 881 calls over the solve). One call cannot be split from the solver's side, so the two solver sites alone take the gap share only from ~80 % to ~63 % on the cloud box. The `plan-pull` beat inside that loop (added at HB's harvest; `planWaypoints` is shared, and the page's walker calls it with no hook, so it is one null check there) takes it to ~4–15 %. `solveProgressHeartbeat.test.js` pins `planWaypoints`' plan byte-identical hooked and unhooked. The report is `CC/docs/cloud-reports/seedling-hammer-heartbeat.md`.

## 4. A worked example

L18's hammer room is `r9-solve-18`'s staging, with the hammers phased to residue 21 (`hammerEscape.test.js`'s witness `hammer-a-l18-escape21`), solved toward the exit at (176,112). It runs under a deadline that never trips, with the fine checkpoints on (the page's budgeted pass):

```
node scripts/procgen/probe-seedling-solve-progress.mjs --tape=r9-solve-18 --goal=exit:176,112 --residue=21 \
    --deadline=never --every=200 --out=l18.jsonl
r9-solve-18 L18 hook=peek deadline=never run 1/1: 8278 ms — SOLVED 445 t (3 pass(es))
  answer 230dc0ff7300b9741e5559abc26ef70f · hook calls 1441 · snapshots 8 · final 1960 bytes · peek ms median 0.098 max 4.479
```

The solve takes three passes. Pass 1 discovers the kill lock and pass 2 measures it, so the third segment (`index: 2`) solves in 445 ticks, the witness tape's own length. Its final snapshot, with the cells cut to six (shown as v1 emitted it; v2 adds `"rejectionKinds"` beside each `"rejections"`, here `{}` everywhere but the last leaf's `{ "exhausted": 1 }`, and `"lastWhy"`: that leaf's verbatim *"depth first (deepest 35) and then breadth first: no state reachable from index 31 survives to index 37 …"*, kind `exhausted`):

```json
{ "v": 1,
  "seq": 1441,
  "segment": { "name": "r9-solve-18", "index": 2, "level": 19, "outcome": "solved" },
  "tree": { "key": "segment", "role": "segment", "label": "r9-solve-18", "attempts": 1, "successes": 1,
    "rejections": {}, "active": false, "children": [
    { "key": "segment/goal#0", "role": "goal", "label": "reach-exit (176,112)", "attempts": 1, "successes": 1,
      "rejections": {}, "active": false, "children": [
      { "key": "segment/goal#0/walk", "role": "walk", "label": "walk", "attempts": 1, "successes": 1,
        "rejections": {}, "active": false, "children": [
        { "key": "segment/goal#0/walk/search:escape-free", "role": "search", "label": "escape-free",
          "attempts": 1, "successes": 1, "rejections": {}, "active": false, "children": [] },
        { "key": "segment/goal#0/walk/verb:kill", "role": "verb", "label": "kill", "attempts": 1, "successes": 1,
          "rejections": {}, "active": false, "children": [
          { "key": "segment/goal#0/walk/verb:kill/arm:press", "role": "arm", "label": "press", "attempts": 1,
            "successes": 1, "rejections": {}, "active": false, "children": [
            { "key": "segment/goal#0/walk/verb:kill/arm:press/search:escape-free", "role": "search",
              "label": "escape-free", "attempts": 14, "successes": 13, "rejections": { "exhausted": 1 },
              "active": false, "children": [] } ] } ] } ] } ] } ] },
  "tiles": { "level": 18, "tile": 16, "cols": 12, "rows": 9,
    "cells": [ [6,1,13,135], [7,1,19,135], [1,2,14,1], [2,2,19,55], [3,2,12,55], [6,2,455,122] ] },
  "budget": {
    "asks": { "walk": 18, "hammer-escape": 37, "sword-dash": 9 },
    "work": { "shouldStop": 64, "ticks": 445, "previews": 411, "previewStates": 26472, "searchStates": 18362,
      "expansions": 10444, "waypointsPlanned": 1, "replans": 0, "dashesPressed": 6 } } }
```

How to read it:
- The walk met the spinner on its frontier. The frontier's admission ran one escape search (the `search` directly under `walk`), and the `kill` verb's press arm then ran 14 more. One of those was `exhausted`, and the strike went ahead uncertified (hammer-phase A3's preference).
- `shouldStop` 64 = 18 + 37 + 9, the three sites' asks. That is the work this segment spent in the page's unit.
- The map has 39 cells. Tile (6,2) was previewed 455 times, first at tick 122.

The same snapshot with `--deadline=none` differs only in its budget: no `hammer-escape` asks, and `shouldStop` 0. The answer digest is the same both ways.

A longer climb, for the tree's ladder shape: `r5-l40-part5`'s staging toward the totem part at (160,640) solves in 675 ticks. Its tree is `goal#0 → walk → climb → rung:avoid · rung:pull · rung:time · rung:bait · rung:kill → arm:chaser → walk`. Four rungs reject or pass over with the ladder's own words (*"the danger-forbidden corridor STILL probes dangerous at"*, *"no stance within puncher@#,#'s leash"*, …), and the kill rung's chaser arm succeeds.

## 5. What changed from the draft (v0)

| v0 | v1 | Why |
|---|---|---|
| `segment: {name, level, pass?}` | `+ index`, `+ outcome` | a solve is several segments (anytime passes, two-pass discovery), and `pass` is not the solver's to know. `index` lets the caller name the pass, and `outcome` tells the last snapshot from a stalled stream |
| `tree.key` | a path of role keys | unique in the tree and stable across snapshots, so a panel can diff two snapshots by key |
| roles segment → goal → rung → arm/strike-cycle | `+ walk`, `+ verb`, `+ climb`, `+ search`; no `strike-cycle` | the rungs belong to a climb, and climbs to a walk; frontier verbs are not rungs. The strike cycles live inside `execKillByPress` (C2's), so they are counted as the searches the kill makes |
| `tiles: {…}` | `| null`, and per level | there is nothing to show before the first preview, and a segment can cross a level |
| `budget.limit?` | not written by the solver | the budget is the caller's (`budgetWork`) |
| `budget.work` | named units, plus `shouldStop` | `shouldStop` is the JS arc's work unit, measured where it is spent |

### v1 → v2 (hammer-phase RK, 2026-10-18)

| Field | v1 | v2 | Why |
|---|---|---|---|
| `v` | 1 | **2** | the first Tier C field; later Tier C slices add fields to v2 without changing `v` again |
| `tree.*.rejectionKinds` | — | `{kind: n}` beside `rejections` | the reason key splits one class of refusal into one key per sentence and cuts away the tail. The kind gives the class, from a closed list read on the verbatim sentence |
| `lastWhy` | — | `{why, kind, key} \| null` | the verbatim sentence the key cuts down. One per segment, overwritten, so the snapshot stays bounded |
| `tree.*.rejections` and every other v1 field | | **unchanged, byte for byte** | pinned: the v1 projection of every segment's final snapshot (no `v`, no `lastWhy`, no `rejectionKinds`) has the md5 measured with the v1 emitter, on L18, L40, L6 and L3 (§6) |
| the S3 tap stamps (§7: `budget.spent`, `budget.limit`, `budget.wallBySite`, `budget.rate`, `request`, `best`, `progressAttempt`) | | **unchanged at v2** | they are the tap's, written on the posted copy; v2 does not touch the tap, the worker or the service |

No consumer gates on `v`: the view, the tap, the worker and the service read fields by name, so a v2 snapshot shows in the v1 view with the new fields ignored. The view half (kind tallies on each node, the last `why` line) is the JS arc's slice.

### v2 additions (hammer-phase RK2, 2026-10-18)

Additive within `v: 2` (`v` stays 2: no consumer gates on it, and a reader that does not know a field or a kind loses nothing).

| Field | before | now | Why |
|---|---|---|---|
| `REFUSAL_KINDS` | 11 kinds | `+ precondition`, after `does-not-apply` (`other` stays last) | a STATE GATE (the L113 door's 0-of-16 seals, the Witch's WAND, a key or a weapon the bag lacks, an opener not yet discharged) is not a search that ran out (`exhausted`) and not the wrong question (`does-not-apply`). `prerequisite` is the solver's word for one of them only (an opener to discharge first), so the kind takes the closest word for all of them, `precondition` (the solver's crusher module writes it as a field: `precondition: 'run.crushersParked'`) |
| `clear-tag` `unresolved` | `exhausted` | `exhausted`, or `precondition` when its verbatim why carries a state gate's words | `unresolved` is the resolver's generic outcome; the door's refusal reaches the tree wrapped in it |
| `clear-tag` `prerequisite`, `cannot-act` | `does-not-apply` | `precondition` | both are state gates by their own field |
| `lastWhy` | `{why, kind, key}` | `{why, kind, key, name}` | the thrown class beside the kind (`null` for a row or a search). `why`, `kind` and `key` are unchanged |
| the sentence rules | 75 static sites unnamed (RK's count) | 4 (RK2's fuller read: 42 → 4) | the families in the table above, each marked RK2 |
| every v1 field; RK's kind totals on the committed solves | | **unchanged** | the v1 projection md5s and the per-solve kind totals are RK's pins, unmoved. One pinned kind moved, by design: the real `sealDoorApproach`-ON row (L113's door), `exhausted` → `precondition` |

## 6. Pins

`frontend/modules/seedlingDemo/solveProgressHeartbeat.test.js` covers the heartbeat (§3.1): `previewWalk`'s output is byte-identical with a hook and without, on solverBot.test.js's L6 room; on L18 and L40 the answer digest and the `shouldStop` count are equal with no hook and under the real tap at 1000, 100, 50 and 0 ms; `budget.asks` holds deadline sites only and sums to the unhooked `shouldStop` count; L40 beats at least 40 times; with no hook the heartbeat never runs; and every call site is one null check with a literal key. Its three mutants are named in its header.

`frontend/modules/seedlingDemo/solveProgress.test.js` covers:
- byte-identity with and without a hook (a peeking hook and a silent one) on the L18 hammer room, an L40 climb and a plain walk;
- that roles are stable keys, that `tiles` counts never fall, and that `firstTick` never rises across a stream;
- that a snapshot survives `structuredClone`, and that mutating it leaves the next snapshot unchanged.
- **`v: 2` (hammer-phase RK).** On L18 and L40 under a deadline that never trips, the answer digest is equal hooked and unhooked, and the `shouldStop` totals (165, 167) and each segment's `budget.asks` are the values the v1 emitter gave. Unhooked, no kind is looked up (`kindEntered()` does not move). On L18, L40, L6 and L3, the v1 projection of every segment's final snapshot has the md5 the v1 emitter gave. Every node's kinds sum to its rejections, none is `other`, and each solve's kind totals are pinned (L18 `pending` 10 + `exhausted` 3, L40 `danger`/`bound`/`exhausted` 1 each, L6 `exhausted`/`bound` 1 each, L3 none; ≥ 15 rejections in ≥ 4 kinds). `lastWhy` is the thrown error's `message` on L18's refused first pass (`pending`, under the press arm), and a row of the solve's own trace on L40 and L6. It is always one `{why, kind, key}` object whose key is a node of its tree. `progressKind` reads a deadline clause at a sentence's end (the cut key cannot). Every search bound and `clear-tag` reason in the source has a kind. The three fidelity switches' rungs classify the same ON and OFF, never as `other`. `solverBot.js` never calls the lookup, and the lookup reads no deadline or clock. Its four mutants are named in its header.
- **v2 additions (hammer-phase RK2).** The real `sealDoorApproach`-ON refusal (L113's 0-seal door, clear-tag `unresolved`) is `precondition`, and its `lastWhy.name` is `SolverRefusal`. `lastWhy.name` per segment: L18 `Error` (`levelRun`'s undeclared kill lock), `PendingDeclaration`, `null` (the escape search's leaf); L40 and L6 `null` (a rung's row); L3 has no rejection. `lastWhy` keeps RK's three keys first, in order. A row per family reads one real sentence out of `solverBot.js` (its literals joined, each `${…}` filled) and pins its kind, so a reworded site turns red instead of falling to `other`. `prerequisite` and `cannot-act` are `precondition`; `unresolved` is `precondition` only by the door's lead-in (with any predicate clause after it), and the resolver's generic outcomes stay `exhausted`. Each family's sentence has the same kind under every rung name the solver writes, and the lookup reads no `.rung`. `progressErrorName` reads the error object, never its message. Its three mutants are named in the RK2 header.

`scripts/procgen/probe-seedling-solve-progress.mjs --compare` checks byte-identity for any staging. `--hook=tap` solves under the JS worker's own tap and prints its posts and the time spent inside it.

The JS half (§7):
- `jsRuntimeSolveProgress.test.js` runs real solves through the real worker. With and without a subscriber the request is byte-identical, and so is the plan (the session's keys and the end digest). With no subscriber, no `solve-progress` message is posted. Posts are at most one per the envelope's `progressIntervalMs` plus the final one, and the final snapshot meters the attempt's whole `work`. At 100 ms and at 1000 ms the request, the plan, the end digest and each attempt's `work` (its `shouldStop` total) are identical; only the envelope differs. A stale solve's message never reaches a listener, and the envelope carries the fastest interval any listener asked.
- `solveProgressTap.test.js` covers the throttle on a fake clock at every listed interval, the clamp to the list, `peek()` only for a post, the meter's sum across segments, and the window stamp.
- `flashPanel/seedlingSolveProgressView.test.js` covers the view's incremental rendering over a recording DOM: one render per frame, no render while hidden (and a catch-up when shown), a canvas resize only on a size change with only changed cells painted, and the tree's rows diffed. It also covers Tier A (§7): the asks by site and the work counters, the active path and its climb depth, the rung reasons shown inline only on an active climb, and tile recency, which survives a redraw and starts over with a new segment or solve. And it covers what the view draws from `v: 2` (§7): the kind chips in `REFUSAL_KINDS`' order with an unknown kind after them, the refusals by kind counted once on a tree where a sum over every node gives more, the last why clamped from 900+ characters, every why written as text, and a v1 stream drawn byte for byte as before (the md5 of its DOM, measured before the change).
- `flashPanel/seedlingSolveProgress.test.js` uses D1's real streams to cover ordering, the stale drop, the segment reset, collapse and the cap, the tiles, and the rule that `close()` unsubscribes.

## 7. The JS half: the worker, the service and the panel

The JS arc's half carries the stream from the solve worker to the flashPanel and shows it there.

| Piece | File | What it does |
|---|---|---|
| The ask | `jsRuntimeSolveService.js` | `subscribeProgress(listener, {intervalMs})` returns the unsubscribe. While a listener exists, each solve started puts `progress: true` on the solve message's **envelope**, and beside it `progressIntervalMs`: the fastest interval any listener asked (a number, or a function read at that start), clamped to the list. The request itself is unchanged, so the plan is too. |
| The tap | `solveProgressTap.js`, installed by `jsRuntimeSolveWorker.js` | Only when the envelope asks: `withSolveProgress(tap.hook, () => solveAnytime(…))`. It reads the worker's clock and posts at most once per `progressIntervalMs` (`progressIntervalMs()` clamps the envelope's value to `SOLVE_PROGRESS_INTERVALS_MS`; absent means the default, 100 ms). It calls `peek()` only for a post, once at each segment's `done` (to bank that segment's work), and once after the solve for the **final** snapshot, which is posted just before `result`. |
| The stamps | the tap, on the posted copy | `budget.spent = {shouldStop}`: the attempt's work units, summed over its segments (each segment's `shouldStop` is banked at its `done`). `budget.limit = {shouldStop: budgetWork, window?}`. `window` is present only while it bounds the pass that is running (the `full` pass with a plan in hand). `segment.pass` is the anytime pass that is running. |
| Wall by site (S3) | the tap, on the posted copy | `budget.wallBySite = {'<from>→<to>': ms}`. Each hook call charges the gap since the previous call to the pair of sites it spans. The first gap starts at `start` (the tap is built just before the solve), and `finish()` charges the last one to `end`. It is summed over the **attempt**, like `budget.spent`: the tap does not `peek()` between posts, so it cannot tell segments apart. Every call is charged, posted or not, so the sum is the attempt's wall ms so far. It is read from the tap's own clock, and the heartbeat's site (`heartbeat`) is charged like any other, without touching `budget.asks`. |
| Rate and ETA (S3) | the tap, on the posted copy | `budget.rate = {unitsPerSec, toWindowMs?, toLimitMs?}`. `unitsPerSec` is `budget.spent.shouldStop` over the attempt's wall clock. `toWindowMs` and `toLimitMs` are the ms left at that rate to `budget.limit.window` and to `budget.limit.shouldStop` (0 once passed). Each is present only when its limit is. No ETA while nothing has been spent, and no `rate` at all at 0 ms. It is a wall-clock projection on this machine, never a budget: the budgets stay in work units. |
| The plan in hand (S3) | the tap, from `onPass` | `best = {ok, ticks, pass}`: the best answer so far (`solveAnytime`'s `best`, not the pass's own answer). `ticks` is the plan's length, or null for a refusal. It is absent until a pass has landed, and a skipped pass does not change it. |
| The request (S3) | the worker (`requestIdentity`), posted by the tap | `request = {name, level, seamTime, goal, passes, budgetWork, windowAt, switches, attempt?}`, on the solve's **first** post only. `level` is the staging's boot level, `seamTime` is `staging.seam.time` (null when absent), and `switches` holds those of the five off-default stamps (`killLockBodies`, `contactFidelity`, `axeDodgeAskPerPreview`, `dashShape`, `dashOnlyWindow`; `SOLVE_PROGRESS_SWITCH_KEYS`) that the request carries. An empty `switches` means the defaults. The fields are read from the request the worker received, and nothing is written back. |
| The retry label (S3) | the service, on the envelope | `progressAttempt = {retry, budgets}` beside `progressIntervalMs`, only while a listener exists. The worker puts it into `request.attempt`, with `label` (`640 → 2560`, `attemptLabel`). Nothing tells the service that a start is a retry, so it **recognises** one: the same `staging` and `solverGoal` objects and the same `perTick` length as the start before, asked at a larger `budgetWork`. The wasm playback's held retry (`retrySolve`) spreads the request it asked before, so it matches. Anything else is `retry: 0`. The request is unchanged (`jsRuntimeSolveProgress.test.js`). |
| The routing | the service | `listener({solveId, snapshot, final})` is called only for the solve in flight. A message from a cancelled, superseded or answered solve is dropped and counted in `stats.progressDropped`. |
| The view | `flashPanel/seedlingSolveProgress.js` (the model), `seedlingSolveProgressView.js` (the DOM) | The setting is `moduleSettings.flashPanel.seedlingSolveProgressView`: `off`, `auto` (the default) or `always`. The panel's **Solve Progress** button cycles it. A value stored when it was a boolean reads `true` as `always` and `false` as `off`. In `auto` and `always` the view subscribes to the JS page's service and to each wasm engine's service, and re-resolves them every second. `off` unsubscribes from all of them. The rate is a second setting, `moduleSettings.flashPanel.seedlingSolveProgressIntervalMs` (1000, 250, 100 or 50 ms; default 100), which the view passes to each service it subscribes to. It applies from the next solve and covers both runtimes, since the wasm engines use the same worker service. |

The Tier B stamps (S3) are optional fields under `v: 1`: each is read from the tap's clock or from what the worker already holds, so a reader that does not know them loses nothing. The view does not draw them yet.

The meter reconciles two clocks. `budget.work.shouldStop` counts per segment, but the page's work clock counts per attempt, across every pass. So the meter shows `budget.spent` (the attempt's sum) against `budget.limit`, and marks the window when one is set. The tree and the tiles reset with each new `segment.index`. The final snapshot's `budget.spent.shouldStop` equals the attempt's `work` in its result (`jsRuntimeSolveProgress.test.js`).

The view drops a note of an older solve than the one it shows, and, within a solve, a `seq` older than or equal to the last (a repeated final is the exception). A finished subtree is collapsed until the viewer opens it, and the list is capped at `SOLVE_PROGRESS_TREE_CAP` rows. The tile map is one canvas, shaded on a log scale of the count, and hovering over a tile names its count and earliest tick. The header shows *last update N s ago*, because the solver reports only at its own sites: a quiet stretch shows as quiet.

**Incremental rendering** (⚖ the user, 2026-10-17; the faster rates depend on it). A note updates the view's state, and its show/hide lifecycle, at once. The drawing happens at most once per animation frame, so the notes that arrive within one frame are drawn once, as the newest state. A hidden view draws nothing, and draws the newest state when it is shown again. The canvas is resized only when the room's size changes, because a resize clears it, and only the cells whose colour changed are painted, one `fillStyle` per colour. The tree keeps its row elements and writes a row only when its text, colour, tooltip or key changed. `view.stats` counts the notes, renders, coalesced and hidden-skipped notes, resizes, cells painted and rows written.

**What else the view shows (Tier A, 2026-10-17).** These read only what a v1 snapshot already carries; the snapshot, the tap, the worker and the request are unchanged.
- **Asks by site.** Under the meter, the segment's `budget.asks`, the most asked site first, and their sum. Under a deadline the asks are the work units. The sum equals the segment's `work.shouldStop` at its end, and runs one ahead of it while an ask is in progress (D1's three streams).
- **The work counters.** The segment's other `budget.work` counters, in §2's order. `shouldStop` stays with the meter. A unit the view does not know is shown by its own name.
- **The active path.** One line above the tree: the active node at each step from the goal down, and the **climb depth**, which is how many `climb` nodes are on that path. A climb inside a kill rung's stance walk is depth 2. When nothing is active, the line says so (`finished` once the final note has arrived).
- **Rung reasons inline.** A rung whose parent is an active climb, and that has rejections, shows them in its row (`4× … · 1× …`, the most frequent first). Every row keeps them in its tooltip too.
- **Tile recency.** A cell whose count rose since the map was last drawn is painted in a second, gold palette, shaded by how much it rose. So the map shows where the search is now, on top of where it has been in total. The rise is the difference between two drawn snapshots of the same solve, segment and level. Redrawing the same snapshot keeps it, and a new segment or solve starts from nothing. The line under the map counts the cells that rose, and hovering over a tile names its rise.

**What the view shows from `v: 2` (2026-10-18).** It reads hammer-phase RK's two fields. A v1 snapshot has neither, so it draws exactly what it drew before.
- **Kind chips.** Each tree row shows its `rejectionKinds` as small chips (`danger 1`), between its counts and its inline reasons. They come in `REFUSAL_KINDS`' order (the view imports the list), and a kind not in the list still shows, after the listed ones, by name. A row with no rejections has no chips. The reason keys stay in the tooltip.
- **Refusals by kind.** One line under the active path: the segment's refusals by kind, **each counted once**. It is not a sum over every node, because a thrown error is tallied on every frame it unwinds through (L18's `levelRun` refusal sits on five nodes), and a climb that unwinds also tallies its rung and arm. Each node counts, per kind, only what its children do not already hold. That counts every rung-row refusal and search bound (no child holds them) and each error once, at the deepest node it was tallied on. It can undercount only where a frame's own refusal has the same kind as refusals its children took and survived.
- **The last why.** Under that line: `last why: ‹kind› at ‹key›: ‹why›`, clamped to one line of 200 characters with an ellipsis. The tooltip holds the whole sentence, and a click opens or closes it. `lastWhy: null` draws no line. Fields the line does not name are ignored. Every why, key and kind is written as text, never parsed as HTML.

**What the open view costs** (`probe-seedling-solve-progress.mjs --hook=tap`, node, 2026-10-11, on an 8-core box at load average ~14). The time spent inside the tap (its clock reads, peeks and one `structuredClone` per post) was 0.15–0.21% of the L18 hammer solve (23–43 posts and 26–46 peeks over 22–43 s) and 0.02–0.04% of the L40 climb (37–43 posts over 102–123 s), in two runs each. The answer digests matched the no-hook runs. The solver's own counting under an installed hook is D1's measurement. A wall-clock A/B on that box is noise: the same L18 solve with no hook took 19.9 s in one run and 45.2 s in another.

**Auto-show** (⚖ the user, 2026-10-15). In `auto` the view stays subscribed while it is hidden. The progress ask rides the solve's envelope, so a listener added mid-solve would only hear the next solve. A solve's first note shows the view, and its final note hides it at once. Hiding is not closing: the view keeps listening, so the next solve is asked too. `always` keeps the view open and never hides it. The view mirrors its lifecycle on its element as `data-*` attributes (`mode`, `visible`, `listening`, `shows`, `hides`, `shown-at`, `hidden-at`, `final`, `outcome`). Because `auto` is the default, every panel solve now carries `progress: true`. The request and the plan are unchanged (`seedlingSolveProgressModes.test.js` runs the L6 solve in all three modes). The panel can stage that solve itself: the bus event `flashPanel:stageSolveDemo` (`{demo: 'l6-enemy-room'}`, `seedlingSolveDemo.js`) teleports the JS runtime page into L6 at the game's return spawn from L5 and walks the solver to the stairs. The feature check `seedling-solve-progress-auto-show` uses it.

⚠ **A solve already running when the view opens does not report.** Its worker is busy until it answers, so it cannot be told to start. The view starts reporting from the next solve. A view closed during a solve drops the rest of that solve's stream at the service.
