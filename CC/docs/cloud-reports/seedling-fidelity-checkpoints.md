# Seedling fidelity CHECKPOINTS: finer `shouldStop` checkpoints inside the solver's checkpoint-free phases

**Slice:** `seedling-fidelity-checkpoints`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-3`).

⚖ **The user** (2026-10-05, via the JS arc): add finer `shouldStop` checkpoints inside the solver's checkpoint-free phases, chosen over a room-size weight on the JS side.

| | |
|---|---|
| Started from | `origin/main` @ **`0fdd9f967f`** (main: wave 6's bank `054b63e` plus two F2 fixes) |
| Head | the commit that adds this report (the last one on the branch); the code head is **`bdfed0a`**, the docs head **`95e193f`** |
| Harness branch | `claude/solver-shouldstop-checkpoints-barq85` (`seedling-fidelity-checkpoints` was never created or pushed) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS, with one named exception · D3 PASS · D4 PASS** |
| Commits | `769c4b0` D1 instrument · `bdfed0a` D2 sites + witnesses · `e4ae9ed` D3 instrument additions · `95e193f` D4 log + reference · this report |

## The one thing to know first

**The fine sites are OPT-IN: `solveSegment({ shouldStop, fineCheckpoints: true })`. Do not wire them at today's constants.**

Opted in, the solver also asks `time`, `walk` and `detour` (inside DETOUR's via set). With those asks, the longest stretch without one drops from 2.8–230 s to under 1 s on four of the five legs. On the fifth (L40 leg 363) it drops to ≤ 4.0 s, and every remaining stretch over 1 s is inside a single `planWaypoints` call.

The catch is that the asks also change what a work unit buys:
- Swordless L14, the JS arc's own `SOLVER_BUDGET_WORK` anchor, asks **624** times instead of **492**. At 500, its only plan is cut. Measured with the worker's own `passShouldStop`: the pass is refused, cut at `detour`.
- At the 40-unit window, the dash upgrades on L30 leg 313 and L40 leg 356 are lost (110 → 237 t, 172 → 417 t).

That is why the field defaults to false. Every consult-counting caller hears today's sequence exactly until it opts in: the JS arc's budget, `seedlingCanCross`'s consult budget, and SF's witnesses. The JS arc forwards `fineCheckpoints: true` in the same commit that re-calibrates `SOLVER_BUDGET_WORK` / `SOLVER_UPGRADE_WINDOW_WORK` from D3's tables. ⚠ `solveFromTape` (theirs) does not forward the field yet.

## W0 — bank (at `0fdd9f967f`, before any edit; PASS)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9420 bash scripts/procgen/identity-block.sh .`, primary tree, pristine (my edits copied out and the tracked files restored first) | log md5 **`a0ede89933ae1d5ff43cceebd859a867`**, 33.7 min |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724`, **all exit 0** |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| the other block rows | in the block | maze `246dfbce`, acceptance `608693d2`, empty pairs c3 `05c5ef94` / c6 `e88baf9d`, carved c4 `f8cba3a8`, ENEMY `d59f0c97`, guard `a6d18d49`, AREA `02b22525`, killgate s2 `01210c82` / s5 `07ce222a` / s9 `30a1e3e7`, level pre-sword `e28c1e5d` / post-sword `c4841acb`, generated set OK |
| tapeRunner | inside the bounded vitest: (status, name) pairs, timing stripped, sorted (scratch `pairs.py`) | **533/533**, pairs md5 **`b270b455ecdf29ccebb8ea64db5e4f75`** |
| surface / constants / profile / entities | `census-seedling-solver-surface --check` · `census-seedling-constants --check` · `witness-seedling-profile --check` · `witness-seedling-entities --check` | **GREEN 208** · **PASS 5,040** · **PASS 138** (both JSONs) · **PASS 518** |
| roster | `fixtures/tapes/index.json` `.tapes` | **238** |
| bounded vitest BEFORE | 56 files (below), run by path, `--reporter=verbose` (⚖ 52) | **56 files / 1,717 tests, all green, exit 0** |
| `grep -a` for `shouldStop` / `DEADLINE_SITES` | `git ls-files -z \| xargs -0 grep -alE …` (presets excluded) | 15 files: 6 cloud reports, `flash.md`, `seedling-bot-log.md`, `fidelityAxe.test.js`, `jsRuntimeSolver.js`, `jsRuntimeSolverShouldStop.test.js`, `seedlingCanCross.js`, `solverBot.js`, `solverBot.test.js`, `solverDeadline.test.js` |

**The bounded set (56):**
- the brief's list: `solverDeadline`, `jsRuntimeSolverShouldStop` and `jsRuntimeSolver` (both read only), `solverBot`, `fidelityL14`, `fidelityAxe`, `seedlingRobust` (ROBUST's), `blockRoute`, `seedlingCanCross`, `r8Acceptance`, the roster pins `tapeEnvelope` / `observationTolerance` / `dialogueAutoAdvance`, `tapeRunner`, `decisionTrace`, `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`;
- every non-slow test whose text names a function I touched (`grep -a`: `shouldStop`, `DEADLINE_SITES`, `findEarliestArrival`, `planDash`, `deriveChaserDetour`, `solveSegment`, `probeCorridor`, `TIME_RUNG`, `DETOUR_RUNG`): 42 files, among them `jsRuntimeSolverAnytime`, `twoPassSolve`, `wasmArrivalComposite`, every `fidelity*` and `solver*` file;
- plus `mover*.test.js` and `dangerMap.test.js` (the mover's callers).

## D1 — the profile (PASS)

**The instrument** (`769c4b0`, `scripts/procgen/probe-solver-hook-gaps.mjs`; node, no box, nothing tracked moves):
- Each leg from `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks` (799 legs) is solved through the bare pass's request path: `arrivalSolverGoal` → `arrivalSolveRequest` → one `solveSegment` per `ANYTIME_PASSES` pass, called as `solveFromTape` calls it.
- The hook counts. Each ask records its site and the wall time since the previous ask. The pass start opens the first gap and the pass end closes the last.
- A sampling profiler (2 ms) runs on the main thread, driven from a worker thread through `inspector.Session.connectToMainThread`. The inspector dispatches by interrupt while the solve runs, so even a leg killed at `--timeout` writes what it sampled.
- Every gap over `--gap-ms` is attributed to the inclusive `frontend/modules` frames sampled inside it.
- Flags:
  - `--fine` opts in;
  - `--sword` grants `Main.hasSword`, so the `full` pass runs;
  - `--no-hook` is the inertia control;
  - `--budget` / `--window` wrap the worker's own `passShouldStop`.
- The D3 commit (`e4ae9ed`) added the per-pass plan/trace `hash` and `lastAt[site]`.

**The five stretches, reproduced at the base** (bare, no hook trips; this box; median of 1, profiled):

| leg | room | the dashless pass (base) | asks | longest stretch with no ask | between | what ran in it (inclusive profile share) | share of the pass |
|---|---|---|---|---|---|---|---|
| 64 | L6 (208,32) → L5 | refused, 9,865 ms | 0 | **9,865 ms** | start → end | the **TIME rung**: one `mover.planDash` (`findEarliestArrival` 90 %, `dangerMap.dangerAt` 69 %), 40,000 expansions | 100 % |
| 73 | L8 (96,176) → L7 | refused, 22,539 ms | 6 | **22,354 ms** | `block-route`#5 → `stance-hypothesis` | the **TIME rung** again (`planDash` 85 %) | 99 % |
| 173 | L16 (32,64) → L17 | refused, 37,251 ms | 411 | **18,845 ms** | `detour`#1 → `detour`#2 | **DETOUR's via set**: a `planWaypointsOrNull` to every lattice cell (97 %) | 51 % |
| 363 | L40 (480,896) → L43 #7 | refused, 236,031 ms | 1 | **229,500 ms** | `detour`#1 → end | **DETOUR's via set**, thousands of cells. ⚠ It is DOOMED: the set alone plans past `DETOUR_RUNG.maxPlanned` (500), so the loop's `planned < maxPlanned` test fails at once and the 229 s buy a refusal the bound had already decided | 97 % |
| 356 | L40 (480,896) → L43 | solved 417 t, 2,755 ms | 0 | **2,755 ms** | start → end | **the core walk**, no optional scan: `collidesSolid` 53 %, drive/`advance` ~40 % (every spinner stepped), `probeCorridor` 30 %, `planWaypoints` 29 % | 100 % |

**The same profile on the AXE legs** (the AXE report's slowest refused climbs):

| leg | room | pass | asks | longest stretch | what ran | share |
|---|---|---|---|---|---|---|
| 564 | L71 → L75 | refused, 53,380 ms | 2,463 (`axe-dodge` 2,346, `detour` 117) | **27,783 ms** after `detour`#205 | DETOUR's via set (the AXE arm's bent-corridor search calls `deriveChaserDetour`) | 52 % |
| 717 | L101 → L102 | refused, 25,963 ms | 1,607 | **12,565 ms** after `detour`#569 | DETOUR's via set | 48 % |
| 492 | L61 → L62 | solved 448 t, 23,652 ms | 6,561 (`axe-dodge` 6,416) | **5,103 ms** after `detour`#285 | DETOUR's via set | 22 % |

Two other L40 dashless legs give the same answer: 373 (2,957 ms) and 350 (1,234 ms), each with 0 asks and the core walk at 100 %.

**What D1 says.**
- DETOUR's via set is the long stretch wherever DETOUR runs: L16, L40, and every axe leg.
- `axe-dodge` itself already asks thousands of times, with gaps of milliseconds.
- The TIME rung, which no one named, is the whole of L6 and L8.
- L40's dashless silence is the walk itself, so bounding it needs a CORE site whose trip refuses.
- The stance scan never showed up as a gap. L8's stretch ends at a `stance-hypothesis` ask, but what runs inside it is TIME.

## D2 — the checkpoints (PASS, with one named exception)

**The change** (`bdfed0a`; `solverBot.js`, `mover.js`, `solverDeadline.test.js`).

`solveSegment` gains an optional `fineCheckpoints: boolean` (default `false`; a non-boolean is refused by name). The flag rides on the active deadline, so a nested segment run with no hook inherits it like the hook itself. `fineActive()` / `fineDeadlineReached(site)` answer false, and call nothing, unless a deadline is active AND it opted in.

| site | where it is asked (opted in) | what a trip does | can a trip change an answer? |
|---|---|---|---|
| `time` (**new**) | before the TIME rung's `planDash`, and every `mover.DEFAULT_CHECK_EVERY` (**250**) expansions inside it. `findEarliestArrival` / `planDash` take an optional `shouldStop: () => boolean` + `checkEvery`; `null` asks nothing | entry: the search is not run, and TIME's why is *"deadline — … reached before the TIME rung's search, so it was not run."* Inside: a NEGATIVE, *"… the caller's deadline (`shouldStop`) was reached (deadline after N expansion(s), asked every 250)"*. Either way the ladder **FALLS THROUGH** to BAIT | **Yes**, when TIME was the rung that solved (no committed solve runs the TIME search at all: no trace carries its why) |
| `walk` (**new**, the core) | at each `walkTo` attempt before it plans; between its plan and its danger probe; every `WALK_CHECK_TICKS` (**32**) samples of that probe (`probeCorridor`'s new `walkCheck`, set by `walkTo` alone); and every 32 ticks the segment drives (the segment's `advance` wrapper, counted from the segment's own first tick) | **refuses the segment by name**: a `SolverRefusal` with no obstacle, *"solverBot(name): the caller's anytime deadline (`shouldStop`) was reached at the `walk` site <where> — the segment's own work is bounded there, so the solve stops here instead of overrunning."*, plus the ⏱ clause and `e.deadline` | **Yes**, on any solve. It is the bound on the whole segment's work |
| `detour` (existing, asked at more points) | once per cell of DETOUR's via set, before that cell's `planWaypoints` | the rung refuses with the loop's own trip shape: `{wps: null, bound: {name: 'deadline', site: 'detour'}, why: "… reached while the DETOUR search built its via set, after N leg(s) …"}` | **Yes**, as the existing `detour` trip (L14 swordless) |

`DEADLINE_SITES` = `['sword-dash', 'stance-hypothesis', 'block-route', 'kill-chaser', 'detour', 'axe-dodge', 'time', 'walk']`. The new names are appended and every site is latched as before. New exports: `WALK_CHECK_TICKS` (`solverBot`), `DEFAULT_CHECK_EVERY` (`mover`).

**Why opt-in (measured, not assumed).** My first cut asked the new sites whenever a hook was present. Six rows went red. One was the `DEADLINE_SITES` list pin, which moves either way. The other five were pins on the consult SEQUENCE, not on answers:
- in the JS arc's read-only `jsRuntimeSolverShouldStop.test.js`, *"L4: a 1-unit BUDGET … refuses BY NAME at block-route"*: the first trip became `walk`, because L4's dashless pass now asks `walk` ×9 before its first `block-route`;
- in SF's `solverDeadline.test.js`, four counter rows: the never-trips row (every consult `sword-dash`), the trip-at-k row (k + 1 consults), `r8-solve-4`'s first site (`block-route`), and the detour row's *"after 2 preview(s)"*.

`seedlingCanCross`'s default consult budget would have moved the same way. Opt-in keeps all of them byte-identical: 75/75 on the four touched files, with the JS arc's file unedited.

**The gaps after** (opted in, untripped; bare dashless; no profile; this box):

| leg | before | **after** | asks after | what the longest remaining stretch is |
|---|---|---|---|---|
| 64 L6 | 9,865 ms | **163 ms** | 175 (`time` 160) | a `time` interval (250 expansions) |
| 73 L8 | 22,354 ms | **240 ms** | 170 | a `time` interval |
| 173 L16 | 18,845 ms | **851 ms** | 637 | one via-set `planWaypoints` |
| 356 L40 | 2,755 ms | **972 ms** | 28 | `walkTo`'s corridor `planWaypoints` (a single call) |
| 363 L40 | 229,500 ms | **4,018 ms** | 3,504 | ⚠ single `planWaypoints` calls: the L40 corridor plan (3.6 s, its string-pull `controllerPathClear` ~93 %) and via-set legs to far cells (the margin ladder re-floods per pixel) |
| 564 L71 | 27,783 ms | 1,011 ms | 2,865 | one via-set `planWaypoints` |
| 717 L101 | 12,565 ms | 491 ms | 2,074 | |
| 492 L61 | 5,103 ms | 312 ms | 6,801 | |
| 350 L40 | 1,234 ms | 314 ms | 10 | |

**The bound, stated:** no stretch without an ask longer than **1 s on this box**, outside one call this slice does not split, `botDriverV2.planWaypoints`. On the JS arc's calibration box that is about 2.5–3 s, by L16's ratio (50 s there, 18.8 s here).
- Met on legs 64, 73, 173 and 356 (and 717, 492, 350; leg 564 is 1.011 s, inside one planner call).
- **The exception is L40 leg 363:** ≤ 4.0 s, and every stretch over 1 s is inside a single `planWaypoints`.
- A finer bound needs an ask inside the shared planner (its node-margin ladder and its string-pull). That is not a site the solver owns (residue 1).

**The witnesses** (`solverDeadline.test.js`, +6 rows, 14 in all; each new row ≤ 1.1 s on this box):
1. Opted in, a never-true counter on `r9-solve-2`'s room gives keys and trace byte-identical to no hook, and is asked `walk` at least ⌊ticks/32⌋ times. The opted-out sequence is the opted-in one with the fine asks removed, all `sword-dash`.
2. `fineCheckpoints: 'yes'` → *"fineCheckpoints must be a boolean"*.
3. `walk` at its first ask → refused *"… at the `walk` site before … corridor (attempt 1)"*, ⏱, `e.deadline` = `{first: 'walk', sites: {walk: 1}}`. At its LAST ask → refused mid-drive or mid-probe. Latched: the tripping ask is the last `walk` ask the callback hears.
4. `time` in the mover: an 8 px open-ground search (1,250 expansions, 85 ms). A never-true hook leaves the certificate JSON-identical, asked ⌊1,250/250⌋ = 5 times. A trip at the 2nd ask is a NEGATIVE at exactly 500 expansions, bound *"deadline after 500 expansion(s), asked every 250"*.
5. `time` in a solve: bare L6 from (208,32), the D1 leg.
   - A trip at the entry → TIME's why is *"… before the TIME rung's search, so it was not run"*, the climb goes on to *bait (bob@112,48)*, and `e.deadline` = `{first: 'time', sites: {time: 1}}`. 347 ms against the untripped ~10 s.
   - A trip at the 3rd ask → *"… deadline after 500 expansion(s) …"*.
6. `detour` in its via set: swordless L14 tripping at the 6th `detour` ask (the rung's own + 5 cells) → *"… while the DETOUR search built its via set, after 4 leg(s)"*. Opted out, the same counter still says *"after 2 preview(s)"* (SF2's row).

**Mutants** (copy + restore in a third worktree at `bdfed0a`; predicted first):

| mutant | predicted | measured | restored |
|---|---|---|---|
| M-walk: all four `walk` asks forced `false` | witness rows 1 and 3 red, the other 12 green; leg 356 `--fine` back to 0 asks, ~2.6 s | **2 red / 14** (exactly those); leg 356: **0 asks, 2,649 ms** | md5 `02722d59` = committed |
| M-time: both `time` asks removed | row 5 red (the mover row calls `findEarliestArrival` directly, so it stays green); leg 64 back to ~9 s with 0 `time` asks | **1 red / 14** (row 5); leg 64: 15 asks (all `walk`), max **8,915 ms** | `02722d59` |
| M-via: the via-set `detour` ask removed | row 6 red; leg 173 back to ~19–26 s | **1 red / 14** (row 6); leg 173: max **18,171 ms** | `02722d59` |

## D3 — the new work numbers (PASS)

**How measured.**
- `probe-solver-hook-gaps.mjs --no-profile`, with a never-true hook (no trip): `coarse` = the hook as every caller passes it today, `fine` = the same plus `--fine`.
- 25 legs: the five, the three AXE legs, and 17 more spread over room size (one exit leg per level, sorted by tiles, every 7th). Bare, and again with the sword (`--sword`), so the `full` pass runs.
- The coarse and fine runs of one configuration ran side by side, over the same leg order, on this 4-core box (load 2–6 while the identity block also ran). So the ms are **paired**, not absolute.
- The ask counts are exact (deterministic).

**Hook calls per pass and wall time, before (coarse) → after (fine)**. `fine ms/ask` is the pass's wall time over its fine asks. On every row the outcome and the ticks are the same coarse and fine.

| leg | room | room size (tiles) | kit | pass | outcome | asks (coarse → fine) | ms (coarse → fine) | longest gap ms (coarse → fine) | fine ms/ask |
|---|---|---|---|---|---|---|---|---|---|
| 64 | L6 | 85 | bare | dashless | refused | 0 → **175** | 9,473 → 8,956 | 9,473 → **163** | 51 |
| 64 | L6 | 85 | sword | dashless | refused | 1 → **176** | 9,891 → 9,936 | 9,485 → **385** | 56 |
| 64 | L6 | 85 | sword | full | refused | 48 → **229** | 9,552 → 10,004 | 9,028 → **331** | 44 |
| 73 | L8 | 156 | bare | dashless | refused | 6 → **170** | 12,646 → 12,987 | 12,572 → **240** | 76 |
| 73 | L8 | 156 | sword | dashless | refused | 6 → **170** | 14,386 → 13,442 | 14,284 → **343** | 79 |
| 73 | L8 | 156 | sword | full | refused | 6 → **170** | 13,273 → 14,041 | 13,230 → **326** | 83 |
| 173 | L16 | 225 | bare | dashless | refused | 411 → **637** | 54,481 → 54,566 | 26,070 → **851** | 86 |
| 173 | L16 | 225 | sword | dashless | solved 206 t | 0 → **22** | 1,706 → 1,941 | 1,706 → **384** | 88 |
| 173 | L16 | 225 | sword | full | solved 117 t | 98 → **116** | 4,118 → 3,809 | 571 → **148** | 33 |
| 363 | L40 | 3480 | bare | dashless | refused | 1 → **3,504** | 241,236 → 245,682 | 235,640 → **4,018** | 70 |
| 363 | L40 | 3480 | sword | dashless | solved 985 t | 0 → **60** | 7,543 → 7,928 | 7,543 → **2,989** | 132 |
| 363 | L40 | 3480 | sword | full | unfinished | 1,973 → **2,001** | 921,851 → 921,699 | 5,202 → **3,323** | 461 |
| 356 | L40 | 3480 | bare | dashless | solved 417 t | 0 → **28** | 2,621 → 3,400 | 2,621 → **972** | 121 |
| 356 | L40 | 3480 | sword | dashless | solved 417 t | 0 → **28** | 2,596 → 2,566 | 2,596 → **732** | 92 |
| 356 | L40 | 3480 | sword | full | solved 172 t | 37 → **57** | 6,326 → 6,185 | 1,631 → **858** | 109 |
| 564 | L71 | 400 | bare | dashless | refused | 2,463 → **2,865** | 66,202 → 71,119 | 23,132 → **1,011** | 25 |
| 564 | L71 | 400 | sword | dashless | refused | 2,463 → **2,865** | 51,309 → 50,406 | 20,481 → **717** | 18 |
| 564 | L71 | 400 | sword | full | refused | 2,463 → **2,865** | 18,891 → 19,265 | 8,716 → **227** | 7 |
| 492 | L61 | 225 | bare | dashless | solved 448 t | 6,561 → **6,801** | 19,617 → 19,754 | 4,221 → **312** | 3 |
| 492 | L61 | 225 | sword | dashless | solved 448 t | 6,561 → **6,801** | 14,387 → 15,866 | 3,137 → **244** | 2 |
| 492 | L61 | 225 | sword | full | solved 284 t | 6,714 → **6,949** | 5,651 → 5,996 | 907 → **77** | 1 |
| 717 | L101 | 460 | bare | dashless | refused | 1,607 → **2,074** | 24,162 → 23,051 | 11,414 → **491** | 11 |
| 717 | L101 | 460 | sword | dashless | refused | 1,607 → **2,074** | 16,443 → 17,020 | 7,340 → **317** | 8 |
| 717 | L101 | 460 | sword | full | refused | 1,607 → **2,074** | 6,168 → 5,879 | 2,759 → **108** | 3 |
| 563 | L70 | 25 | bare | dashless | solved 6 t | 0 → **2** | 22 → 25 | 22 → **11** | 12 |
| 563 | L70 | 25 | sword | dashless | solved 6 t | 0 → **2** | 21 → 21 | 21 → **9** | 10 |
| 563 | L70 | 25 | sword | full | solved 4 t | 5 → **7** | 21 → 15 | 8 → **6** | 2 |
| 562 | L68 | 30 | bare | dashless | solved 6 t | 0 → **2** | 25 → 24 | 25 → **10** | 12 |
| 562 | L68 | 30 | sword | dashless | solved 6 t | 0 → **2** | 40 → 22 | 40 → **9** | 11 |
| 562 | L68 | 30 | sword | full | solved 4 t | 5 → **7** | 29 → 21 | 11 → **7** | 3 |
| 39 | L2 | 49 | bare | dashless | solved 7 t | 0 → **2** | 57 → 23 | 57 → **9** | 12 |
| 39 | L2 | 49 | sword | dashless | solved 7 t | 0 → **2** | 23 → 23 | 23 → **9** | 12 |
| 39 | L2 | 49 | sword | full | solved 5 t | 5 → **7** | 26 → 25 | 15 → **13** | 4 |
| 38 | L1 | 72 | bare | dashless | solved 6 t | 0 → **2** | 40 → 25 | 40 → **10** | 12 |
| 38 | L1 | 72 | sword | dashless | solved 6 t | 0 → **2** | 24 → 24 | 24 → **10** | 12 |
| 38 | L1 | 72 | sword | full | solved 4 t | 5 → **7** | 21 → 22 | 11 → **11** | 3 |
| 472 | L56 | 90 | bare | dashless | refused | 0 → **1** | 14 → 15 | 14 → **10** | 15 |
| 472 | L56 | 90 | sword | dashless | refused | 0 → **1** | 14 → 22 | 14 → **15** | 22 |
| 472 | L56 | 90 | sword | full | refused | 0 → **1** | 2 → 4 | 2 → **2** | 4 |
| 621 | L85 | 100 | bare | dashless | solved 7 t | 0 → **2** | 31 → 25 | 31 → **9** | 12 |
| 621 | L85 | 100 | sword | dashless | solved 7 t | 0 → **2** | 30 → 25 | 30 → **9** | 12 |
| 621 | L85 | 100 | sword | full | solved 5 t | 5 → **7** | 22 → 22 | 9 → **7** | 3 |
| 752 | L110 | 110 | bare | dashless | solved 233 t | 0 → **14** | 108 → 85 | 108 → **36** | 6 |
| 752 | L110 | 110 | sword | dashless | solved 233 t | 0 → **14** | 80 → 83 | 80 → **32** | 6 |
| 752 | L110 | 110 | sword | full | solved 161 t | 93 → **105** | 248 → 266 | 31 → **23** | 3 |
| 223 | L20 | 135 | bare | dashless | solved 7 t | 0 → **2** | 50 → 27 | 50 → **10** | 14 |
| 223 | L20 | 135 | sword | dashless | solved 7 t | 0 → **2** | 27 → 27 | 27 → **10** | 14 |
| 223 | L20 | 135 | sword | full | solved 5 t | 5 → **7** | 22 → 28 | 9 → **9** | 4 |
| 708 | L98 | 195 | bare | dashless | refused | 0 → **2** | 47 → 24 | 47 → **10** | 12 |
| 708 | L98 | 195 | sword | dashless | refused | 0 → **2** | 22 → 24 | 22 → **10** | 12 |
| 708 | L98 | 195 | sword | full | refused | 0 → **2** | 9 → 10 | 9 → **7** | 5 |
| 605 | L78 | 200 | bare | dashless | solved 7 t | 0 → **2** | 66 → 32 | 66 → **11** | 16 |
| 605 | L78 | 200 | sword | dashless | solved 7 t | 0 → **2** | 39 → 36 | 39 → **17** | 18 |
| 605 | L78 | 200 | sword | full | solved 5 t | 5 → **7** | 33 → 22 | 19 → **8** | 3 |
| 172 | L16 | 225 | bare | dashless | solved 7 t | 0 → **2** | 58 → 55 | 58 → **33** | 28 |
| 172 | L16 | 225 | sword | dashless | solved 7 t | 0 → **2** | 48 → 72 | 48 → **48** | 36 |
| 172 | L16 | 225 | sword | full | solved 5 t | 5 → **7** | 38 → 66 | 13 → **19** | 9 |
| 747 | L108 | 270 | bare | dashless | solved 7 t | 0 → **2** | 41 → 35 | 41 → **16** | 18 |
| 747 | L108 | 270 | sword | dashless | solved 7 t | 0 → **2** | 34 → 28 | 34 → **10** | 14 |
| 747 | L108 | 270 | sword | full | solved 5 t | 5 → **7** | 49 → 22 | 28 → **6** | 3 |
| 581 | L72 | 360 | bare | dashless | solved 7 t | 0 → **2** | 76 → 51 | 76 → **22** | 26 |
| 581 | L72 | 360 | sword | dashless | solved 7 t | 0 → **2** | 35 → 37 | 35 → **16** | 18 |
| 581 | L72 | 360 | sword | full | solved 5 t | 5 → **7** | 28 → 29 | 13 → **12** | 4 |
| 420 | L45 | 400 | bare | dashless | solved 720 t | 0 → **46** | 495 → 366 | 495 → **265** | 8 |
| 420 | L45 | 400 | sword | dashless | solved 720 t | 0 → **46** | 359 → 374 | 359 → **252** | 8 |
| 420 | L45 | 400 | sword | full | solved 414 t | 1,141 → **1,177** | 6,506 → 6,276 | 351 → **326** | 5 |
| 688 | L95 | 400 | bare | dashless | solved 575 t | 0 → **36** | 710 → 514 | 710 → **416** | 14 |
| 688 | L95 | 400 | sword | dashless | solved 575 t | 0 → **36** | 515 → 499 | 515 → **399** | 14 |
| 688 | L95 | 400 | sword | full | solved 575 t | 2,301 → **2,337** | 16,786 → 16,584 | 365 → **364** | 7 |
| 391 | L43 | 665 | bare | dashless | solved 6 t | 0 → **2** | 58 → 41 | 58 → **20** | 20 |
| 391 | L43 | 665 | sword | dashless | solved 6 t | 0 → **2** | 36 → 42 | 36 → **22** | 21 |
| 391 | L43 | 665 | sword | full | solved 4 t | 5 → **7** | 28 → 29 | 16 → **14** | 4 |
| 350 | L40 | 3480 | bare | dashless | solved 151 t | 0 → **10** | 1,326 → 1,458 | 1,326 → **314** | 146 |
| 350 | L40 | 3480 | sword | dashless | solved 161 t | 0 → **12** | 1,136 → 1,128 | 1,136 → **288** | 94 |
| 350 | L40 | 3480 | sword | full | solved 70 t | 17 → **26** | 2,095 → 1,951 | 653 → **317** | 75 |

L40 leg 363's sword `full` pass (the `unfinished` row) did not finish within the 900 s timeout under either configuration. At the kill it had asked 1,973 times coarse and 2,001 fine, and its longest stretch went 5,202 → 3,323 ms. Its dashless pass solves 985 t with 0 → 60 asks.

**What the unit means now.**
- Opted in, a unit is never more than ~1 s on this box, apart from one `planWaypoints` call (D2's exception).
- It is still not uniform across sites:
  - ~1–8 ms per ask where `axe-dodge` dominates (L61, L101);
  - ~25–90 ms where DETOUR's via set and TIME do;
  - ~90–150 ms for `walk` on L40, where every tick steps the room's spinners.
- So a budget of N units bounds an attempt at roughly N × 1 s in the worst case, and typically N × 10–150 ms.

**The window and the budget each leg needs** (sword arrival, never-true hook; `lastAt` from `e4ae9ed`). These are the numbers `SOLVER_UPGRADE_WINDOW_WORK` / `SOLVER_BUDGET_WORK` are calibrated against:
- "min window" is the attempt-clock unit of the full pass's LAST `sword-dash` ask: the dashless pass's asks plus that ask's index in the full pass. It is an UPPER bound on the window that keeps the full plan, since the plan may be fixed before the last ask.
- "min budget" is the attempt's total asks, both passes, untripped.

| leg | room | dashless (asks c→f, outcome) | full (asks c→f, outcome) | upgrade? | min window: unit of the last `sword-dash` ask (c → f) | min budget: attempt total (c → f) |
|---|---|---|---|---|---|---|
| 164 | L14 | 0 → 7, solved 145 t | 25 → 31, solved 98 t | **yes** (47 t) | 25 → **35** | 25 → **38** |
| 300 | L30 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 301 | L30 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 305 | L30 | 0 → 10, solved 140 t | 13 → 20, solved 57 t | **yes** (83 t) | 13 → **29** | 13 → **30** |
| 309 | L30 | 0 → 16, solved 225 t | 61 → 73, solved 106 t | **yes** (119 t) | 61 → **86** | 61 → **89** |
| 313 | L30 | 0 → 16, solved 237 t | 25 → 37, solved 110 t | **yes** (127 t) | 25 → **50** | 25 → **53** |
| 317 | L30 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 64 | L6 | 1 → 176, refused | 48 → 229, refused | no | 49 → **403** | 49 → **405** |
| 73 | L8 | 6 → 170, refused | 6 → 170, refused | no | — → **—** | 12 → **340** |
| 173 | L16 | 0 → 22, solved 206 t | 98 → 116, solved 117 t | **yes** (89 t) | 98 → **138** | 98 → **138** |
| 356 | L40 | 0 → 28, solved 417 t | 37 → 57, solved 172 t | **yes** (245 t) | 37 → **80** | 37 → **85** |
| 564 | L71 | 2463 → 2865, refused | 2463 → 2865, refused | no | — → **—** | 4,926 → **5,730** |
| 492 | L61 | 6561 → 6801, solved 448 t | 6714 → 6949, solved 284 t | **yes** (164 t) | 13275 → **13743** | 13,275 → **13,750** |
| 717 | L101 | 1607 → 2074, refused | 1607 → 2074, refused | no | — → **—** | 3,214 → **4,148** |
| 563 | L70 | 0 → 2, solved 6 t | 5 → 7, solved 4 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 562 | L68 | 0 → 2, solved 6 t | 5 → 7, solved 4 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 39 | L2 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 38 | L1 | 0 → 2, solved 6 t | 5 → 7, solved 4 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 472 | L56 | 0 → 1, refused | 0 → 1, refused | no | — → **—** | 0 → **2** |
| 621 | L85 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 752 | L110 | 0 → 14, solved 233 t | 93 → 105, solved 161 t | **yes** (72 t) | 93 → **114** | 93 → **119** |
| 223 | L20 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 708 | L98 | 0 → 2, refused | 0 → 2, refused | no | — → **—** | 0 → **4** |
| 605 | L78 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 172 | L16 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 747 | L108 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 581 | L72 | 0 → 2, solved 7 t | 5 → 7, solved 5 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 420 | L45 | 0 → 46, solved 720 t | 1141 → 1177, solved 414 t | **yes** (306 t) | 1141 → **1211** | 1,141 → **1,223** |
| 688 | L95 | 0 → 36, solved 575 t | 2301 → 2337, solved 575 t | no | 2301 → **2356** | 2,301 → **2,373** |
| 391 | L43 | 0 → 2, solved 6 t | 5 → 7, solved 4 t | **yes** (2 t) | 5 → **9** | 5 → **9** |
| 350 | L40 | 0 → 12, solved 161 t | 17 → 26, solved 70 t | **yes** (91 t) | 17 → **36** | 17 → **38** |

Leg 164 here is the sword arrival. **The JS arc's budget anchor is the swordless L14 leg (bare 164):**
- coarse **492** asks (`detour` ×492), solved 173 t, which reproduces their calibration exactly;
- fine **624** asks (`walk` 7, `detour` 617), the same 173 t, longest stretch 333 → 239 ms.

**Under the worker's own deadlines** (`--budget=500 --window=40`, `passShouldStop` wrapped, one work clock per attempt; predicted from the tables above, then measured):

| leg | kit | coarse (today) | fine at today's constants | moved? |
|---|---|---|---|---|
| 164 L14 | **bare** | dashless **solved 173 t** (492 asks) | dashless **refused, cut at `detour`** (501 asks); no `full` pass (no sword) | ⚠ **the leg loses its only plan** |
| 313 L30 | sword | dashless 237 t; full **110 t** (25 asks) | dashless 237 t (16 asks); full 237 t, cut at `sword-dash` | ⚠ **upgrade lost** (110 → 237 t) |
| 356 L40 | sword | dashless 417 t; full **172 t** (37 asks) | dashless 417 t (28 asks); full 417 t, cut at `sword-dash` | ⚠ **upgrade lost** (172 → 417 t) |
| 164 L14 | sword | 145 → **98 t** | 145 → **98 t** | no |
| 305 L30 | sword | 140 → **57 t** | 140 → **57 t** | no |
| 350 L40 | sword | 161 → **70 t** | 161 → **70 t** | no |
| 309 L30 | sword | 225 t (full cut at the window) | 225 t (cut) | no (cut both ways) |
| 173 L16 | sword | 206 t (cut) | 206 t (cut) | no |
| 752 L110 | sword | 233 t (cut) | 233 t (cut) | no |
| 420 L45 | sword | 720 t (cut) | 720 t (cut) | no |

**The numbers for the JS arc** (they own the constants; I edited none):
- **Budget.** Of the dashless passes that ship under today's 500, the largest opted-in count is swordless L14's **624** asks (coarse 492). L40 leg 363's sword dashless pass ships at **60**. The axe legs that ship are already far over budget coarse: L61 6,561 → **6,801**.
- **Window.** On the legs whose full plan upgrades, the last `sword-dash` ask falls at these units:
  - coarse: 5 (one-screen rooms), 13–37 (L30 305/313, L40 350/356, L14-sword), 61–98 (L30 309, L110, L16 173, which today's 40-unit window already cuts), and 1,141 / 13,275 (L45, L61);
  - fine, the same legs: 9, then 29–80, then 86–138, then 1,211 / 13,743.
- Opting in, the window must grow by about the dashless pass's own fine asks: 2 on a one-screen room, 10–46 on the large rooms here.

## D4 — records (PASS)

| Row | Command | Result |
|---|---|---|
| identity block AFTER | `SEEDLING_PORT=9420 bash scripts/procgen/identity-block.sh .`, primary tree at `95e193f` (clean) | log md5 **`a0ede89933ae1d5ff43cceebd859a867`**. **`diff` against W0: empty.** Every row, all six `--check`s (`405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724`, all exit 0) and the reference row (ALL 7 + 5 MATCH) are identical. 34.5 min |
| tapeRunner | bounded vitest AFTER, (status, name) pairs | **533/533, pairs md5 `b270b455…` = W0** (`diff` empty) |
| bounded vitest AFTER | the 56 W0 files (`solverDeadline` among them) | **56 files / 1,723 tests, all green, exit 0** (1,717 + `solverDeadline`'s 6) |
| solver surface | `census-seedling-solver-surface --check` | **GREEN 208**, no drift, so no `--write` |
| constants | `census-seedling-constants --check` | **PASS 5,040**, 0 new / 0 moved literals (the census's closure does not reach the two new constants), so no `--write` |
| profile / entities | `--check` | PASS 138 (both) / PASS 518 |
| roster | `fixtures/tapes/index.json` | **238**, unchanged (no tape added or moved) |
| reference | `generate-procgen-reference.mjs` after the instrument and the log entry | regenerated (instruments 364 → 365, the docs index's word counts); `--check` **ALL 7 + 5 MATCH**; `check-procgen-docs.mjs` **ALL CHECKS PASSED**; `vitest run frontend/modules/procgenDocs` **8 files / 492** |
| `--help` gate | `check-procgen-help.mjs --only=probe-solver-hook-gaps.mjs` | **ALL PASS** (help and import doors) |
| bot log | `seedling-bot-log.md` | `### Seedling fidelity CHECKPOINTS — the solver's long silences, timed, and asked where they run`, after FRONTIER3, with three trap candidates |

**Trap candidates** (in the log, for the catalogue to number):
1. A budget counted in asks bounds only the work between asks. The units were deterministic and right, and still blind to a 230 s stretch.
2. A search whose first phase exceeds its own bound is doomed before it starts (DETOUR's via set on L40).
3. The phase you suspect is not the phase that runs. The stance scan was the candidate; the TIME rung, never named, was the whole of two legs.

## For the JS arc: the wiring list

- **The field:** `solveSegment({ …, shouldStop, fineCheckpoints: true })`, a boolean, default `false`. ⚠ `solveFromTape` (`jsRuntimeSolver.js`, yours) must forward it. Today it passes `shouldStop` only, which is why my instrument calls `solveSegment` the way `solveFromTape` does instead of calling `solveFromTape`.
- **The new site names** (`DEADLINE_SITES` appends them; the existing six keep their order):

  | site | a trip there | lossless? |
  |---|---|---|
  | `time` | the TIME rung's search ends (or is not run) with a `deadline` NEGATIVE; the ladder **falls through** to BAIT | no |
  | `walk` | the segment **refuses by name** (`SolverRefusal`, no obstacle, ⏱ clause, `e.deadline.first === 'walk'` when it was first) | no — it is the whole-solve bound |
  | `detour` (more asks) | as today: the rung refuses, the climb ends EXHAUSTED by name | no |

  `sword-dash` is still the only lossless site, so `passShouldStop`'s window logic (`site === 'sword-dash'`) is untouched. Its budget logic (every site past the budget) now also bounds the core walk, which was the point.
- **Re-calibrate before (or with) the flip**, from D3: the budget anchor goes 492 → 624, and the window must cover the dashless pass's fine asks too. At today's 500/40, opted in, leg 164 bare loses its plan and 313/356 lose their upgrades (D3's last table).
- **Pins that would move when you flip:** your `"L4: a 1-unit BUDGET … refuses BY NAME at block-route"` (the first trip becomes `walk`: L4's dashless pass asks `walk` ×9 before its first `block-route`), and any row that counts work units (`d.work`, `r.plan.work`). Mine (`solverDeadline.test.js`) opts in explicitly where it means to.
- **`seedlingCanCross`** keeps its consult budget as is, and is byte-identical, unless it also opts in.
- **New exports:** `WALK_CHECK_TICKS` (32, `solverBot.js`), `DEFAULT_CHECK_EVERY` (250, `mover.js`); `findEarliestArrival` / `planDash` take `shouldStop` + `checkEvery`.
- **No contract change** to `solveSegment` (one new optional field), `twoPassSolve`, `PendingDeclaration` or `createRunForStaging`. No new `SolverRefusal.obstacle.kind`.

## Deltas

| | W0 (`0fdd9f967f`) | head |
|---|---|---|
| `DEADLINE_SITES` | 6 | **8** (+`time`, `walk`) |
| `solveSegment` options | `shouldStop` | + `fineCheckpoints` (default false) |
| `solverDeadline.test.js` | 8 rows | **14** |
| instruments | 364 | **365** (+`probe-solver-hook-gaps.mjs`) |
| everything with no hook / not opted in | — | byte-identical (D4) |

## What the brief got wrong (measured)

1. **"L40 leg 363: no answer in 7 min."** On this box it answers (a refusal) in 236–241 s. The stretch is DETOUR's via set, 229.5 s after the rung's first ask, and that via set is **doomed**: L40 has thousands of cells and the set alone plans past `maxPlanned` (500), so the candidate loop never runs. A checkpoint bounds it. The work itself is waste (residue 2).
2. **"L40 dashless: 8–13 s with 0 calls."** Here 1.2–3.0 s (legs 350, 356, 373). More to the point, no optional scan runs there at all: it is the core walk (plan, probe, drive). Bounding it needed a CORE site (`walk`) whose trip refuses, not another optional-scan site.
3. **The candidates.**
   - DETOUR's pre-candidate phase: right.
   - "The STANCE SCAN": never measured as a long stretch on any leg here.
   - What the brief did not name: **the TIME rung**, one `mover.planDash` that is 100 % of L6 and 99 % of L8.
4. **"A refused axe climb costs up to ~65 s bare — include it."** The `axe-dodge` site already asks 1,562–6,416 times per pass, with millisecond gaps. The axe legs' long stretches (5–28 s) are DETOUR's via set, which the AXE arm calls for its bent corridor. The via-set ask covers them; `axe-dodge` needed nothing.
5. **"Each new site in `DEADLINE_SITES`, latched like the others", read as always-on.** Asked whenever a hook is present, the new sites move every consult-counting pin (D2: six rows red, one of them the JS arc's read-only L4 row) and `seedlingCanCross`'s budget. They also move the JS arc's live answers at its current constants (D3: L14 swordless loses its plan). They are in `DEADLINE_SITES` and latched, but opt-in.
6. **The absolute times.** This box is faster: L16 18.8 s here vs 50 s, L8 22.4 vs 36 s, L6 9.9 vs 55 s. The ratios are not one factor. The brief's legs may have carried the route's inventory; mine are bare (and `--sword`).
7. (My own, caught before commit.) The first draft of the `walk` docblock said a trip carries `obstacle.kind === 'deadline'`. It carries no obstacle: that would have been a new `obstacle.kind` across the worker boundary, which the contract rules out.

## Residue

1. **`planWaypoints` is atomic.** The bound's one exception: L40 leg 363's corridor plan (3.6 s, its string-pull `controllerPathClear` ~93 %), its via-set legs to far cells (up to 4.0 s; the node-margin ladder re-floods once per pixel of margin), and one 1.01 s leg on L71. A finer bound needs an ask inside `botDriverV2`'s planner, a shared core with its own error contract (a trip there must not read as "no path"). Not in this slice.
2. **DETOUR's doomed via set.** Stopping the via set once `planned >= maxPlanned` gives the same refusal (the loop could not run anyway), but its words change: the via count and the planned count. That is why it is not in this slice. It would take leg 363 from ~4 min to seconds with or without a hook.
3. **The unit is still not uniform** (D3: ~1 ms per `axe-dodge` ask to ~150 ms per `walk` ask on L40). A budget bounds work deterministically, not wall time evenly.
4. **L40 leg 363 with the sword** does not finish its `full` pass in 900 s, coarse or fine. Live, the window and the budget cut it long before that. Opted in, its longest stretch is 3.3 s.
5. **The `time` site's solve witness is an arrival no committed solve makes** (bare L6 from (208,32)). No committed trace runs the TIME search: every committed TIME refusal is the `MOVER_RANGE` arithmetic.
6. **D3's wall times are paired, not absolute** (two configurations side by side, load 2–6). The ask counts are exact.
7. **The JS arc's `flash.md` says a unit is a call "before each optional scan".** Opted in, the core walk asks too. The sentence is theirs to update when they wire the field.

## Byte-inertia

- **No hook** (every committed solve): nothing is asked. The identity log, the six `--check`s, tapeRunner's 533 pairs and the census rows are byte-identical (D4).
- **A hook, not opted in:** the consult sequence is today's exactly. SF's 8 rows and the JS arc's `jsRuntimeSolverShouldStop` are green unedited; `seedlingCanCross` is green.
- **Opted in, untripped:**
  - on `r9-solve-2`'s room the keys and the trace equal no hook's (witness 1);
  - over 25 legs × bare/sword × both passes (`--no-hook` vs `--fine`), **74 finished pass rows** have the same outcome, the same ticks and the same plan/trace (or refusal-message) hash. The other 25 rows are bare `full` passes skipped for want of a sword, and 1 is L40 leg 363's sword `full` pass, unfinished in 900 s both ways;
  - the coarse and fine D3 runs agree on every outcome and tick count.
- **A trip** changes answers exactly as each site's row says (D2's table, witnessed).

## The rows the coordinator must BANK

- identity log (primary tree): **`a0ede89933ae1d5ff43cceebd859a867`**, unchanged from `0fdd9f967f`;
- six `--check`s: **`405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2` `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e` `56bb3724fd0ed3dda184e6e7d6d5d27c`**, all exit 0, unchanged;
- tapeRunner **533**, pairs md5 **`b270b455ecdf29ccebb8ea64db5e4f75`** (this slice's formatter: `(status, test path)` sorted, timing stripped);
- surface **GREEN 208**; constants **PASS 5,040**; profile **138**; entities **518**; tapes **238**; bounded vitest **56 / 1,723**;
- new:
  - `DEADLINE_SITES` 8 (`time`, `walk`);
  - `solveSegment`'s `fineCheckpoints` (default false);
  - `WALK_CHECK_TICKS` 32; `mover.DEFAULT_CHECK_EVERY` 250;
  - `solverDeadline.test.js` 14 rows;
  - instrument `probe-solver-hook-gaps.mjs`;
- for the JS arc: swordless L14 asks **492** (coarse) / **624** (fine); the window/budget tables in D3.
