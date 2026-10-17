# The Seedling Solver's Progress Stream

What the Seedling solver reports while it solves: one hook, called at fixed points in the search, and a snapshot that holds a tree of the solver's goals and rungs, a tile map of the states it previewed, and its work counts. The solver half lives in `frontend/modules/seedlingDemo/solveProgress.js`. The worker → page transport and the `flashPanel` display belong to the JS arc and are built against this page. `scripts/procgen/probe-seedling-solve-progress.mjs` prints the stream of a real solve in node.

⚖ The user (2026-10-11), on the progress display: *"Both, plus extras"*: a tree with attempts, successes and rejection tallies on each node; a tile map with a count and an earliest-arrival tick per tile; and a work-budget meter. All three come over one channel and are shown live, about once a second.

## 1. The hook

| | |
|---|---|
| Install | `withSolveProgress(onProgress, fn, {pass?})` runs `fn` with the hook active. Nested installs restore the outer one, the same way `withSolveDeadline` works. `solveSegment({…, onProgress})` installs it for one segment. |
| Signature | `onProgress(site, peek)`. `site` is the name of the point that called. `peek()` builds a snapshot and returns it (or `null` before the first segment starts). |
| When it is called | Only at fixed points in the search: every deadline site (`DEADLINE_SITES`, coarse and fine, whether or not a deadline is installed) and the count points in §3, the heartbeat among them (§3.1). It is never called on a timer, and the solver never reads a clock. |
| Throttling | The caller throttles. The JS worker reads its own clock in the hook, and at most once a second it calls `peek()` and posts `{type: 'solve-progress', id, snapshot, final}` (§7). |
| Cost | With no hook installed, each count point is one null check (`activeProgress !== null`). With a hook installed, the counts are kept, and `peek()` does the materialising. |
| Observation only | Every count is read from a value the solver had already computed. Nothing is read back. A hook that throws is ignored. With and without the hook, every plan, trace, record and verdict is byte-identical (§6). |
| Off unless subscribed | Nothing goes into the request stamp, and no committed artifact changes. |

A snapshot is a copy. It is plain JSON (structured-clone safe), built fresh on each `peek()`, so mutating it does not touch the solver or the next snapshot.

Where the JS arc installs it: `solveAnytime` runs one `solveSegment` per pass, synchronously. So `withSolveProgress(hook, () => solveAnytime(…))` in the worker covers every pass. Alternatively, `solveFromTape` can hand `onProgress` to `solveSegment`. Each `solveSegment` under the install is one **segment** (§2). `segment.index` counts them from 0, so a caller that knows its pass order can map the index to a pass name, or install with `{pass}` around each pass.

## 2. The snapshot (`v: 1`)

```
{ v: 1,
  seq,
  segment: { name, index, level, pass?, outcome },
  tree:    { key, role, label, attempts, successes, rejections: { <reason>: n }, active, children: [ … ] },
  tiles:   { level, tile: 16, cols, rows, cells: [ [col, row, reached, firstTick], … ] } | null,
  budget:  { asks: { <site>: n }, work: { <unit>: n } },
  heartbeat?: { at, count } }
```

`heartbeat` is present once the install has beaten at least once (§3.1). It is an optional field added under `v: 1`: a reader that does not know it loses nothing, so it does not take `v: 2` (which is reserved for the plan's Tier C fields).

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
| `active` | the node is on the path the solver is working on now |
| `children` | in the order they were first entered |

`attempts − successes − Σ rejections` is the count still open (an active node) or **passed over**: a rung that was asked and did not apply (the PULL rung in a room with no lane silencer) writes no row, so it has neither a success nor a rejection.

**Rejection reasons** use the words the solver already wrote; no text is invented. In order:
1. an error's `code` (`HAMMER_SAFETY`, `STRIKE_BOUND_EXHAUSTED`) or a search's `bound` (`exhausted`, `deadline`, `expansions`, `horizon`, `start`);
2. a named code that the sentence leads with or puts in parentheses (`STANCE_REENTRY —`, `(LIGHT_REENTRY)`);
3. otherwise the sentence that decides. The walk's own label (`solverBot(<tape>) … : `) is dropped. The text is cut at the first ` — `, `: `, `; `, ` (`, `. ` or line break, every number becomes `#`, and it is capped at 96 characters.

Rule 3 is why the same reason met at two positions counts as one key: `breakablerock@#,# cannot be broken by this run`.

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

The solve takes three passes. Pass 1 discovers the kill lock and pass 2 measures it, so the third segment (`index: 2`) solves in 445 ticks, the witness tape's own length. Its final snapshot, with the cells cut to six:

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

## 6. Pins

`frontend/modules/seedlingDemo/solveProgressHeartbeat.test.js` covers the heartbeat (§3.1): `previewWalk`'s output is byte-identical with a hook and without, on solverBot.test.js's L6 room; on L18 and L40 the answer digest and the `shouldStop` count are equal with no hook and under the real tap at 1000, 100, 50 and 0 ms; `budget.asks` holds deadline sites only and sums to the unhooked `shouldStop` count; L40 beats at least 40 times; with no hook the heartbeat never runs; and every call site is one null check with a literal key. Its three mutants are named in its header.

`frontend/modules/seedlingDemo/solveProgress.test.js` covers:
- byte-identity with and without a hook (a peeking hook and a silent one) on the L18 hammer room, an L40 climb and a plain walk;
- that roles are stable keys, that `tiles` counts never fall, and that `firstTick` never rises across a stream;
- that a snapshot survives `structuredClone`, and that mutating it leaves the next snapshot unchanged.

`scripts/procgen/probe-seedling-solve-progress.mjs --compare` checks byte-identity for any staging. `--hook=tap` solves under the JS worker's own tap and prints its posts and the time spent inside it.

The JS half (§7):
- `jsRuntimeSolveProgress.test.js` runs real solves through the real worker. With and without a subscriber the request is byte-identical, and so is the plan (the session's keys and the end digest). With no subscriber, no `solve-progress` message is posted. Posts are at most one a second plus the final one, and the final snapshot meters the attempt's whole `work`. A stale solve's message never reaches a listener.
- `solveProgressTap.test.js` covers the throttle on a fake clock, `peek()` only for a post, the meter's sum across segments, and the window stamp.
- `flashPanel/seedlingSolveProgress.test.js` uses D1's real streams to cover ordering, the stale drop, the segment reset, collapse and the cap, the tiles, and the rule that `close()` unsubscribes.

## 7. The JS half: the worker, the service and the panel

The JS arc's half carries the stream from the solve worker to the flashPanel and shows it there.

| Piece | File | What it does |
|---|---|---|
| The ask | `jsRuntimeSolveService.js` | `subscribeProgress(listener)` returns the unsubscribe. While a listener exists, each solve started puts `progress: true` on the solve message's **envelope**. The request itself is unchanged, so the plan is too. |
| The tap | `solveProgressTap.js`, installed by `jsRuntimeSolveWorker.js` | Only when the envelope asks: `withSolveProgress(tap.hook, () => solveAnytime(…))`. It reads the worker's clock and posts at most once a second. It calls `peek()` only for a post, once at each segment's `done` (to bank that segment's work), and once after the solve for the **final** snapshot, which is posted just before `result`. |
| The stamps | the tap, on the posted copy | `budget.spent = {shouldStop}`: the attempt's work units, summed over its segments (each segment's `shouldStop` is banked at its `done`). `budget.limit = {shouldStop: budgetWork, window?}`. `window` is present only while it bounds the pass that is running (the `full` pass with a plan in hand). `segment.pass` is the anytime pass that is running. |
| The routing | the service | `listener({solveId, snapshot, final})` is called only for the solve in flight. A message from a cancelled, superseded or answered solve is dropped and counted in `stats.progressDropped`. |
| The view | `flashPanel/seedlingSolveProgress.js` (the model), `seedlingSolveProgressView.js` (the DOM) | The setting is `moduleSettings.flashPanel.seedlingSolveProgressView`: `off`, `auto` (the default) or `always`. The panel's **Solve Progress** button cycles it. A value stored when it was a boolean reads `true` as `always` and `false` as `off`. In `auto` and `always` the view subscribes to the JS page's service and to each wasm engine's service, and re-resolves them every second. `off` unsubscribes from all of them. |

The meter reconciles two clocks. `budget.work.shouldStop` counts per segment, but the page's work clock counts per attempt, across every pass. So the meter shows `budget.spent` (the attempt's sum) against `budget.limit`, and marks the window when one is set. The tree and the tiles reset with each new `segment.index`. The final snapshot's `budget.spent.shouldStop` equals the attempt's `work` in its result (`jsRuntimeSolveProgress.test.js`).

The view drops a note of an older solve than the one it shows, and, within a solve, a `seq` older than or equal to the last (a repeated final is the exception). A finished subtree is collapsed until the viewer opens it, and the list is capped at `SOLVE_PROGRESS_TREE_CAP` rows. The tile map is one canvas, shaded on a log scale of the count, and hovering over a tile names its count and earliest tick. The header shows *last update N s ago*, because the solver reports only at its own sites: a quiet stretch shows as quiet.

**What the open view costs** (`probe-seedling-solve-progress.mjs --hook=tap`, node, 2026-10-11, on an 8-core box at load average ~14). The time spent inside the tap (its clock reads, peeks and one `structuredClone` per post) was 0.15–0.21% of the L18 hammer solve (23–43 posts and 26–46 peeks over 22–43 s) and 0.02–0.04% of the L40 climb (37–43 posts over 102–123 s), in two runs each. The answer digests matched the no-hook runs. The solver's own counting under an installed hook is D1's measurement. A wall-clock A/B on that box is noise: the same L18 solve with no hook took 19.9 s in one run and 45.2 s in another.

**Auto-show** (⚖ the user, 2026-10-15). In `auto` the view stays subscribed while it is hidden. The progress ask rides the solve's envelope, so a listener added mid-solve would only hear the next solve. A solve's first note shows the view, and its final note hides it at once. Hiding is not closing: the view keeps listening, so the next solve is asked too. `always` keeps the view open and never hides it. The view mirrors its lifecycle on its element as `data-*` attributes (`mode`, `visible`, `listening`, `shows`, `hides`, `shown-at`, `hidden-at`, `final`, `outcome`). Because `auto` is the default, every panel solve now carries `progress: true`. The request and the plan are unchanged (`seedlingSolveProgressModes.test.js` runs the L6 solve in all three modes). The panel can stage that solve itself: the bus event `flashPanel:stageSolveDemo` (`{demo: 'l6-enemy-room'}`, `seedlingSolveDemo.js`) teleports the JS runtime page into L6 at the game's return spawn from L5 and walks the solver to the stairs. The feature check `seedling-solve-progress-auto-show` uses it.

⚠ **A solve already running when the view opens does not report.** Its worker is busy until it answers, so it cannot be told to start. The view starts reporting from the next solve. A view closed during a solve drops the rest of that solve's stream at the service.
