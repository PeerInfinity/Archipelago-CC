# Seedling hammer-phase HB: the solver heartbeat (`seedling-hammer-heartbeat`)

| | |
|---|---|
| start | `f77dbd6bb934e8a2063c9d7ea09a973f23e375e7` (`origin/main`) |
| head | the commit that adds this report (the branch's last); code head `d7f3af4`, records `5fd91c6` |
| branch | `claude/seedling-hammer-heartbeat-rozl0p` (the session's designated branch; the brief named `seedling-hammer-heartbeat`) |
| evidence | `CC/docs/cloud-reports/seedling-hammer-heartbeat-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `d4/`, `tools/`) |

**Verdicts.** W0 PASS · D1 PASS (the gap named, and it is not where the brief looked) · D2 PASS in region + **STOP** on
one named line in `botDriverV2.js` · D3 PARTIAL (L40 80 % → 54–74 %; the named line takes it to 4–15 %) · D4 PASS.

**The one thing to know first.** L40's silent stretches are the planner's string-pull, `botDriverV2.planWaypoints` →
`controllerPathClear`: ~73 % of every kill-rung gap. It is not `previewWalk` (~14 %), the chaser forecast (~1.5 %) or
`planSwordDash` (0 %). The solver can beat only around that call, not inside it. One emit line in its inner loop
(`botDriverV2.js:1345`) closes the gap, and that file is outside this slice's region.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-heartbeat-rozl0p origin/main` → `f77dbd6bb9` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`. Six submodules were `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each. Node v22.22.0. Server `serve-nocache.py 9594`, PID 830 |
| defaults | `w0/defaults.txt`. Every `solverBot` switch as `main` ships it (`DASH_KEEP_PARTIAL` / `DASH_LEG_PRECHECK` OFF, `HAMMER_ESCAPE` ON, `STRIKE_ETA_FLOOR` OFF, …). `SOLVE_PROGRESS_INTERVAL_MS` is **1000**: the JS arc's 100 ms default (S2) has not landed |
| identity block | `SEEDLING_PORT=9594 identity-block.sh .` (`w0/identity-w0.txt`): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK. Equal to WC's W0 row for row |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c`, all exit 0 (= WC's W0) |
| reference | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass (`w0/taperunner-pairs-w0.txt`; WC had 611, so tapes were added since) |
| surface / constants / entities / profile / roster | GREEN **312** · **6,001** · 566 · 138 · **280** (`w0/censuses-w0.txt`; WC had 296 · 5,882 · 566 · 138 · 277) |
| bounded vitest BEFORE | 19 files (`solveProgress*`, `jsRuntimeSolveProgress`, `solveProgressTap`, `solverBot*`, `hammer*`, `lintGateLabels`; `w0/vitest-files-w0.txt`): **279 / 279** in 324 s |

**The investigation's rows, re-measured** with the real tap at 100 ms, under a deadline that never trips with the fine
checkpoints on (`tools/hbprobe.mjs`, `w0/l40-100.json`, `w0/l18-100.json`):

| solve | hook calls | gap share > 100 ms | post-gap median | digest | `shouldStop` | wall |
|---|---|---|---|---|---|---|
| L18 (`r9-solve-18`, residue 21 → exit (176,112)) | **1,441** (= the investigation) | 3.6 % (it measured 9.6 %) | 106 ms | **`230dc0ff`** (=) | **165** (=) | 4.6 s |
| L40 (`r5-l40-part5` → collect (160,640)) | **211** (=) | **82 %** (it measured 86 %) | 199 ms (it measured 667) | **`3addc379`** (=) | **167** (=) | 6.3 s (it measured 22 s) |

This box is ~3.5× faster than the investigation's, so fewer of the gaps cross 100 ms. The counts, digests and
`shouldStop` are box-independent and equal. The L40 gaps over 100 ms: 21 `kill-chaser → kill-chaser|preview`, 2
`walk → walk`, and one each `goal → walk`, `walk → preview`, `rung → preview` and `rung → rung`.

## D1 — the gap, named (PASS, measure only)

Method (`tools/d1prof.mjs`): one L40 solve under a recording hook and an in-process `node:inspector` CPU profile at
200 µs. The profile's clock and the hook's timestamps are both `hrtime`; the profile started 42 ms before the solve.
Every sample inside a hook gap over 100 ms is attributed to that gap. The sampled time inside the gaps equals the gaps'
wall time (4,317 vs 4,314 ms). Profile: `d1/l40.cpuprofile.gz`. Shares (inclusive, two runs: `d1/l40-gaps.json`,
`d1/l40-gaps-planner.json`):

| gap kind (count) | ms | where the time is |
|---|---|---|
| **`kill-chaser` ask → next `preview`** (21) | 3,363–4,875 | **`planWaypoints` 70–75 %, of which `controllerPathClear` (the string-pull) 71–73 %**; `previewWalk` 13–15 %; `planTilePath` (the A\* itself) 1.5–1.9 %; `isWalkableTile` 1.4–1.8 %; `chaserStep` 1.3–1.7 %; `chaserForecastNow` ~0 %; `planSwordDash` 0 % |
| `walk → walk` (2) | 288–481 | `planWaypoints` 87–90 % (`controllerPathClear` 84–88 %) |
| `goal → walk` (1) | 165–207 | `planWaypoints` 76–82 % (`controllerPathClear` 70–80 %) |
| `rung → preview` (1) | 195–299 | `planWaypoints` 62–73 %, `previewWalk` 17–26 % |
| `rung → rung` (1) | 137–150 | `isWalkableTile` 80 % (`nearestGoalNode`'s goal search) |

Self time inside the kill-rung gaps: `plannerObstacleAt` 36 %, `coerceTerrainState` 22 %, the garbage collector 14 %.

What one kill-rung gap is: one stance candidate of `deriveKillByChaser`'s `scoreAll`. Its fine `kill-chaser` ask, then
`planWaypointsOrNull` (the A\* is ~40 expansions, but the string-pull asks `controllerPathClear` from the farthest point
inward: 881 calls over the solve, ~3.3 ms each here), then one `previewWalk` with the ceiling's dwell. Over the whole
solve (`d1/scratch-counters.diff`, a scratch tree): 27 `planWaypoints` calls, 27 `planTilePath` calls, 1,078 A\*
expansions, 881 string-pull `controllerPathClear` calls.

Over the whole L40 solve (not only the gaps): `planWaypoints` 57 %, `deriveKillByChaser` 60 %, `previewWalk` 13 %,
`dangerDuringTransit` 8 %, `chaserStep` 1.6 %, **`planSwordDash` 0.5 %**. On L18 at this speed no gap passed 100 ms
under the profiler (`d1/l18-gaps.json`).

## D2 — the heartbeat (PASS in region; STOP on one named line)

**The emit** (`solveProgress.js`): `progressHeartbeat(at)` counts one pass of loop `at`. Every
`HEARTBEAT_EVERY[at]`-th pass calls `emit(p, 'heartbeat')`, the hook with site `heartbeat` (added to
`PROGRESS_POINTS`). It never calls `progressSite`, so the heartbeat is never in `budget.asks`. It does not call
`shouldStop` or write `budget.work`, and nothing reads it back. Outside a segment it counts nothing (the other count
points' rule). The counters live on the install, preallocated at `installOf`. `heartbeatEntered()` is a
process-wide entry count for the gate's "unhooked, it never runs" row.

**The sites** (`solverBot.js`, each `if (activeProgress !== null) progressHeartbeat('<literal>');`):

| `at` | site | N | why N |
|---|---|---|---|
| `preview-sample` | `previewWalk`'s `combatBefore`: the one line in its body, and the closure its transit, stall and dwell loops each call once a sample | **512** | L40 previews 15,970 samples in ~0.7 s here (~45 µs a sample). 512 samples are ~23 ms here and ~80 ms on the investigation's 3.5× slower box: about 10 Hz there, inside the preview share of each gap |
| `kill-stance` | `deriveKillByChaser`'s `scoreAll`, right after each candidate's `planWaypointsOrNull` | **1** | one candidate's plan is ~130 ms here and ~450 ms there; L40 plans 20 |

L40 emits 51 beats (31 `preview-sample` + 20 `kill-stance`, `d2/l40-beats.json`), and L18 emits 152. Nothing in
`planSwordDash` (D1: 0 %), and nothing in `levelRun.js` (the forecast is ~1.5 %, so no fidelity OK is needed).

**Why `combatBefore` rather than one of the loops.** `previewWalk` has three sample loops: the stall, the transit and
the standing tail (the kill rung's dwell is the tail). One line in any single loop would miss the other two.
`combatBefore` is the one function all three call once a sample. ⚠ The STRIKELAPSE ceremony tail breaks before it on
its last sample. That is one uncounted sample, and the output does not change.

**The schema.** `snapshot.heartbeat = {at, count}` is present once the install has beaten: the loop that beat last, and
the install's beat count. It is optional and additive, so it stays **`v: 1`**. A v1 reader (the view reads `segment`
and `seq`) loses nothing, and `v: 2` stays reserved for Tier C. Documented in `seedling-solve-progress.md` §2, §3, §3.1
and §6.

**The tap needs no change** (re-read): `createProgressTap.hook(site, peek)` posts at any site once its interval is due,
and only `done` is special-cased. Measured: under the real tap at 100 ms, L40's posts went from 32 to 34–39 and L18's
were unchanged.

**Gate rows** (`solveProgressHeartbeat.test.js`, 4 rows, ~60 s):
1. `previewWalk`'s output is byte-identical with a hook (and an open segment) and without, on `solverBot.test.js`'s
   committed L6 room (two bobs, the strike policy, the corridor east, a 1,536-tick tail). The hooked walk beats exactly
   ⌊samples / 512⌋ times.
2. L18 and 3. L40, under a deadline that never trips: the answer digest and the caller's `shouldStop` count are equal
   with no hook and under the real tap at 1000, 100, 50 and 0 ms. Every hook site is a progress point or a deadline
   site. At 0 ms, every segment's final `budget.asks` holds deadline sites only and Σ asks equals the unhooked
   `shouldStop` count. `snapshot.heartbeat.count` equals the hook's own count of heartbeats. L40 beats ≥ 40 times.
   With no hook, `heartbeatEntered()` does not move.
4. Static: every `progressHeartbeat(` in `solverBot.js` is a guarded call with a literal key, the keys are exactly
   `HEARTBEAT_EVERY`'s, and `DEADLINE_SITES` does not hold `heartbeat`.

**Mutants** (`d2/mutants.txt`, run with `tools/mutants.py` in a scratch tree, each reverted):

| mutant | caught by |
|---|---|
| h1: the kill-stance heartbeat also calls `activeDeadline?.shouldStop('kill-chaser')` | row 3 (`shouldStop` 167 → 187) and row 4 |
| h2: the heartbeat goes through `progressSite('heartbeat')`, a deadline site | rows 2 and 3 (`budget.asks` holds `heartbeat`) |
| h3: the preview heartbeat moves the preview's `tick` by one per beat (a counter the plan reads) | row 1 (preview bytes), row 3 (digest) and row 4. L18's digest does not move for it, which is why row 1 exists |

The existing `solveProgress.test.js` byte-identity rows (L18, L6, L3; peeking, silent and throwing hooks) now run with
the heartbeat live and stay green.

**⛔ STOP — the named line (for the planner, and whoever owns `botDriverV2.js`).** The gap is inside one call that the
solver makes, so no solver-side heartbeat can split it. The line that does:

```js
// botDriverV2.js, planWaypoints' string-pull, before line 1345 (`if (controllerPathClear(level, points[anchor], points[j], …`)
if (activeProgress !== null) progressHeartbeat('plan-pull');
```

It would also need `import { activeProgress, progressHeartbeat } from './solveProgress.js'` (that module imports
nothing, so there is no cycle) and `'plan-pull': 8` in `HEARTBEAT_EVERY`. The scratch diff is
`d2/d2-stop-botDriverV2.scratch.diff`. Measured in a scratch tree (D3's `stop` arm): L40's gap share 80 % → **4–15 %**,
the post-gap median 112–117 ms at a 100 ms interval, and the digest and `shouldStop` unchanged. `planWaypoints` is
called by every walk, so its owner should get the same byte-identity row (`planWaypoints` hooked and unhooked) as
`previewWalk` got. Not edited here.

## D3 — before / after (PARTIAL)

Six arms, three interleaved rounds each, real tap at 100 ms, load 2.0–2.9 on 4 cores (`d3/rounds2.jsonl`,
`d3/summary2.txt`; a first three-round pass is `d3/rounds1.jsonl`). `base` is `f77dbd6`, `after` is this slice, and
`stop` is this slice plus the named `botDriverV2` line (scratch).

| solve, arm | hook calls | gap share > 100 ms | post-gap median | digest | `shouldStop` | wall (median of 3, s) |
|---|---|---|---|---|---|---|
| L40 base | 211 | 79.7 / 80.8 / 81.2 % | 169–184 ms | `3addc379` | 167 | 6.0 (unhooked 6.2) |
| L40 **after** | 262 | **56.5 / 67.2 / 69.0 %** | 163–229 ms | `3addc379` | 167 | 6.2 (unhooked 5.9) |
| L40 stop (scratch) | 372 | 4.0 / 14.3 / 14.5 % | 112–117 ms | `3addc379` | 167 | 6.4 (unhooked 5.7) |
| L18 base | 1,441 | 0 % | 103–104 ms | `230dc0ff` | 165 | 4.3 (unhooked 4.3) |
| L18 **after** | 1,593 | 0 % | 102–104 ms | `230dc0ff` | 165 | 4.5 (unhooked 4.3) |
| L18 stop (scratch) | 1,593 | 0 % | 102–103 ms | `230dc0ff` | 165 | 4.0 (unhooked 3.9) |

On the committed head (`d3/head-100.jsonl`, one run): L40 262 calls, **54 %**, post-gap median 140 ms. L18 1,593 calls,
0 %.

- **Target "well under 86 %": partly met.** 54–74 % here. What is left is the planner's string-pull, one
  `planWaypoints` call of ~110 ms per candidate on this box (~450 ms on the investigation's). Each one still crosses
  100 ms. On a 3.5× slower box the in-region heartbeat buys less, because every planner chunk is over the line there.
  The `stop` arm shows what the named line buys: 4–15 %.
- **Wall overhead: not resolvable.** Hooked and unhooked medians are within ±0.5 s in every arm, and the box's own
  spread between rounds of one arm is ±15 % (e.g. L40 after-100: 5.3 / 6.2 / 7.3 s). The heartbeat adds 51 (L40) and
  152 (L18) hook calls to 211 and 1,441.
- **The observation holds:** one digest and one `shouldStop` count per solve across all 36 runs and every arm.

## D4 — records (PASS)

| row | result |
|---|---|
| bot log | `seedling-bot-log.md` → `### Seedling hammer-phase HB — the solver heartbeat` |
| schema | `seedling-solve-progress.md`: §1 (when it is called), §2 (`heartbeat?`, `v: 1` kept), §3 (the row), §3.1 (the heartbeat, its N, where it does not reach), §6 (the pins) |
| surface / constants | `--check` GREEN **312** · **6,001**, 0 new / 0 moved (`solverBot.js`'s two lines add no surface row or literal the census counts), so no `--write` was needed |
| reference | `generate-procgen-reference.mjs` rewrote `README.md`'s word count and `procgenDocs/generated/docsIndex.js`, then `--check`: ALL 7 + 5 MATCH. `scripts/quicklaunch/generate-docs-index.mjs`: 176 docs |
| identity block AFTER | `d4/identity-d4.txt` at `5fd91c6`'s code (the D2 head): **byte-equal to W0**, every row, the six `--check`s exit 0 with the same md5s, reference MATCH |
| tapeRunner pairs AFTER | **617 `8f27f975`**, 0 non-pass (= W0) |
| censuses AFTER | GREEN 312 · 6,001 · 566 · 138 · 280 (= W0) |
| bounded vitest AFTER | 27 files: the W0 set, plus `solveProgressHeartbeat`, `procgenDocs/generated`, `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `tapeIndexManifest` (`lintGateLabels` was already in the W0 set) (`d4/vitest-files-d4.txt`): **776 / 776** in 385 s |

## What the brief got wrong (measured)

1. **The candidates.** The brief named `previewWalk`'s sample loop, the chaser forecast and `planSwordDash`. In the
   L40 gaps they are ~14 %, ~1.5 % and 0 %. The gap is `botDriverV2.planWaypoints`' string-pull (~73 %), which the
   brief did not list.
2. **"Fidelity's L40 profile said 70–77 % planSwordDash."** That does not hold at this base and these defaults:
   `planSwordDash` is 0.5 % of the whole L40 solve. That profile was presumably taken under other switches or another
   leg. It was not re-derived here.
3. **"Each such gap moves 1 `shouldStop` and 1 preview of ~650–800 states."** It also holds one `planWaypointsOrNull`,
   and that call is most of the gap's time. A heartbeat in `previewWalk`'s loop can split only the preview's ~14 %.
4. **The rate default.** The brief takes S2's 100 ms default as given. On `main` at the base the tap's default is still
   1,000 ms (`SOLVE_PROGRESS_INTERVAL_MS`). Every measurement here passes 100 ms explicitly.
5. **"Only `planSwordDash` … `previewWalk`'s body … ONE emit-only line inside its sample loop."** `previewWalk` has
   three sample loops. The one line went into `combatBefore`, which all three call once a sample (D2).
6. **The investigation's numbers are box-dependent** (22 s vs 6.3 s for L40). The counts, digests and `shouldStop`
   reproduce exactly. The gap shares do not, and should be quoted with the box.

## Residue

1. **The named line** (`botDriverV2.js:1345`, `'plan-pull'`, N = 8). Owner's OK first, with a `planWaypoints`
   byte-identity row. Until then, L40's kill rung stays silent for ~110 ms (here) to ~450 ms (the investigation's
   box) per stance candidate.
2. **The string-pull's cost is itself the lever.** 881 `controllerPathClear` calls, farthest point first, with
   `plannerObstacleAt` (36 % self) and `coerceTerrainState` (22 % self) dominating. That is ~57 % of the whole L40
   solve. A cheaper string-pull would shorten the solve as well as the gaps. It is the planner's question, not this
   slice's.
3. **The `rung → rung` gap** (~140 ms here, 80 % `isWalkableTile` in `nearestGoalNode`) is also inside `botDriverV2.js`.
4. **The JS arc:** no tap change is needed. The view may want to show `snapshot.heartbeat.at` ("planning stance
   candidates" vs "previewing") once the line in (1) lands. That would be js-6's successor's call.
5. Scratch worktrees `…/scratchpad/wt`, `…/scratchpad/wt2` (git worktrees of `f77dbd6`, outside the repo) are removed
   at the end of the session by name.
