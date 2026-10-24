# Seedling HAMMER-PHASE — slice XC: the cross-pass escape cache, exact

Slice `seedling-hammer-cross-pass-cache` (Opus, cloud). The planner is `seedling-hammer-phase-planning-2`. ⚖ The user
(2026-10-18, *"I agree with that plan"*): fidelity's `levelRun` state digest first (landed, `4667f7e353`), then this
cache, keyed on it.

**Verdict: W0 PASS · D1 PASS (30 % or more, over the 10 % bar) · D2 PASS · D3 PASS · D4 PASS.** `ESCAPE_CROSS_PASS_CACHE` is built and
stays **OFF**. ON, every answer, tick, plan, `shouldStop` total, `budget.asks` count, progress stream and instrument is
OFF's. On L18's residue sweep it takes the wall to **0.72×** (floor OFF) and **0.71×** (floor ON).

| | |
|---|---|
| Start SHA | **`4667f7e353`** (`origin/main` at the fetch, = DIGEST's merge) |
| Head | the commit carrying this report. Before it: W0 + D1 `89486233`, D2 code `ff0b9686`, D2 evidence `6e382104` / `05a160f5`, docs `fbde19ce`, D3 `24bf47e3`, D4 `eb27bf55` |
| Branch | `claude/seedling-hammer-cross-pass-cache-80og3c` (the harness's name; the brief said `seedling-hammer-cross-pass-cache`). Nothing went to `main` |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-cross-pass-cache-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `d4/`, `tools/`) |

## The one thing to know first

**An exact cache had to replay what the escape DID, not only what it returned.**
- A cache that returns the answer alone keeps every tape byte-identical.
- It would still move the deadline's ask counts (`budget.asks`, `shouldStop`), the progress stream's tiles and
  search leaves, and the `PRESS_KILL_COST_COUNTS` instruments.
- So a miss records its work stream, and a hit replays it in order. A trip at a hit's k-th ask is the one case that
  needs the real search: it re-derives the call silently and stops at that ask.
- Mutant M4 (a hit that skips the ask replay) is caught only by the rows that compare asks. The tapes stay green
  under it.

## W0 — the base (PASS)

`evidence/w0/`, at the untouched base in the primary tree.

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B <branch> origin/main` → `4667f7e353` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`, Node v22.22.0. As EX and DIGEST found, **six** submodules were still `-` after `READY`, so I ran `git submodule update --init` on each by name. Server: `serve-nocache.py 9600` |
| defaults | as EX's: `STRIKE_ETA_FLOOR` OFF (cap 16), `HAMMER_ESCAPE` and its fallback ON, `PRESS_KILL_COST` / `STRIKE_SCAN_COST` / `REFUGE_ETA_CUT` ON, `GHOST_SPINNER_PRESS` / `GHOST_KILL_RUNG` ON, `HAMMER_ESCAPE_BOUNDS` {75, 0, 8, 50,000} (`w0/defaults.txt`) |
| identity block | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set **OK**, reference **ALL 7 + 5 MATCH**: every row equals DIGEST's |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN **312** · **6,028** · PASS **566** · PASS **138** · **280** |
| bounded vitest BEFORE | `solverBot*`, `hammer*` (not `.slow`), `solveProgress*`, `twoPassSolve*`, `levelRunStateDigest*`, `lintGateLabels`. No `pressEscape*` or `spaceTimeReach*` file exists. **21 files, 356 / 356** |

⚠ **Said plainly:** my first identity-block run was spoiled. I edited `solverBot.js` in the primary tree while it
ran, and the acceptance row read `b69c4745`. I reverted the edit, killed that run by PID, and re-ran the whole block
on the clean tree (the table above). The spoiled output is not committed. After that, all code work went into a
scratch worktree until the box was quiet.

## D1 — the share at this base (PASS: 30 % or more, over the 10 % bar)

**The lab.** EX's `make-lab.py` and DIGEST's `make-lab-digest.py` were applied to a SCRATCH worktree, plus
`make-lab-xc.py`, which adds two fields to every `pressEscape` record:
- `dga`, the digest AFTER the call;
- `xg`, the solver-side globals D4 adds.

`tools/d1-xc.py` then models the cache exactly:
- key = (digest, args, EX's globals, `xg`);
- scope = one staging, which is one `twoPassSolve` call;
- a miss is stored only if the digest did not move and no trip happened;
- a hit is a lookup that finds an entry.

The lab is inert: its sweep outputs norm-md5 to **`de6f6e4e` (OFF) / `bae5c6de` (ON)**, the pristine values.

| workload | floor | calls | hits (all cross-pass) | same-pass | false hits | hits' escape s | digest cost (before every call + after every miss) | **net vs pristine wall** |
|---|---|---|---|---|---|---|---|---|
| **L18 sweep (45 residues)** | **OFF (default)** | 56,655 | **37,770 (66.7 %)** | 0 | **0** | 40.1 s (66.8 % of escape) | 8.5 s + 3.3 s | **≈ 28.3 s = 31.8 %** of 89.1 s |
| | ON | 81,525 | **54,350 (66.7 %)** | 0 | **0** | 59.1 s (66.9 %) | 11.8 s + 4.8 s | **≈ 42.6 s = 32.4 %** of 131.3 s |
| staging A, sword (L40) | OFF / ON | 20 / 15 | 0 / 1 (same-pass) | — | 0 | 0.0 s | 0.1 s | −0.1 % (a single-pass solve) |
| L40 kill rung (`r5-l40-part5`) | OFF / ON | **0** | — | — | — | — | — | — |

- **0 false hits** means no hit returned a different answer, ask count or node count from its entry's.
- Every L18 call moved the digest **0** times. The first escape of a solve runs after the walk's own previews have
  built the visit maps, so no entry is lost to a lazy build in these workloads. A constructed tick-0 call does move it
  (D2's lazy-build row).
- The digest's median cost at this base is **0.12 ms** a call, against a 0.54 ms (OFF) / 0.66 ms (ON) median escape.
- The arguments' canonical text is not in the lab. D3 times the real thing.

## D2 — the cache (PASS)

**Where it sits.** `pressEscape` → `pressEscapeScoped` → `pressEscapeOnce` (`solverBot.js`). `pressEscapeOnce` gains
one optional `tap`; `null` is today's code path. `tap` routes three things:
- the `shouldStop` ask;
- the `onNode` source;
- each finished search row, which still goes out through `escapeSearchEmit`, the same function the miss uses.

**The key** (`escapeKeyOf`) is DIGEST's D4, as strings joined:
1. `run.stateDigest()`, per call and before it;
2. `canonicalDigestText([HAMMER_ESCAPE_BOUNDS' four fields, GHOST_SPINNER_PRESS.enabled, PRESS_KILL_COST.enabled,
   'none' | 'live:<fine>', progress 'none' | 'outside' | 'segment'])`;
3. `canonicalDigestText({state, at, keys, pressAt, id, deadline})`, with `state`'s symbol keys included and `keys` in
   order.

`caller` is not stored and not read. `canonicalDigestText` enters solverBot through the import door
(`solverView.js`).

**The scope.** `escapeCrossPassScope()` is created in `twoPassSolve` (only when the switch is ON) and installed by
`withEscapeCrossPassScope` around each pass's SYNCHRONOUS solve.
- It is never installed across the `gameTick` await, so two loops interleaved by their awaits never share a scope.
- It serves only the runs that call's `makeRun` built (`adopt`). A run is found through the segment's
  `Object.create(run)` view (`innerOf`).
- A Proxy over a run is not reached, so it is not served. `jsRuntimeSolver`'s recording Proxy simply misses.

**Why not wider.** The digest leaves the `levelSource` out (it is a function), so two solves over two sources could
share a digest and differ. Nothing may survive into the next worker solve or leg (js-7 condition 4).

**Why not narrower.** The repeats are across passes. Same-pass repeats are 0 at the D4 key on L18.

**What a miss stores** (`escapeRecorder`):
- the work stream, `[SEARCH | ASK | NODE x y i | END k]`, in emit order;
- the search rows, `[phase, r]`;
- the four `…_COUNTS` instruments' deltas;
- a deep copy of the answer, with symbol keys and aliasing kept.

**When a miss is not stored:**
- **a deadline tripped inside it** (js-7 condition 1);
- **the digest moved across it** (a lazy visit build that a hit could not redo);
- **the scope is at its cap** (`maxEntries` 4,096 or `maxNodes` 2 M; L18's largest scope holds 747 entries). At the
  cap a call is a miss, never an eviction, so no answer depends on eviction order (js-7 condition 3).

**After a trip** (`activeDeadline.tripped.size > 0`), nothing is read or stored (`bypassedTripped`).

**What a hit replays** (`escapeReplayed`), in recorded order:
- `ASK` is a real `deadlineReached('hammer-escape')`, so `progressSite`, `progressAsked`, the deadline's `sites` and
  the caller's `shouldStop` all see OFF's sequence;
- `SEARCH` calls `progressStatesFor(run, n)` again (its `tilesOf` side effect included);
- `NODE` feeds `{x, y}, i` to it;
- `END` re-emits the row: the trace row, and `progressSearch` with a fresh shallow copy, so `noteLast`'s identity test
  reads as OFF's;
- then the instruments' deltas are added back.

**If an ask trips during a replay** (`escapeTrippedAt`), the call is re-derived silently:
- a `shouldStop` that answers true at its k-th ask, and asks nothing real;
- no `onNode`, no emits;
- then the tripped search's row is emitted.

That is exactly OFF's return at that ask, its expansions, nodes and deepest included.

**Verify mode** (`verify: true`, `SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1`). Each hit recomputes the call as a miss
and compares four things:
- the answer's canonical text;
- the work stream, element by element with `Object.is`;
- the search rows (ok, bound, why, expansions, nodes, deepest);
- the instruments' deltas.

It counts `verifyMismatches` and keeps the first 16 (`ESCAPE_CROSS_PASS_CACHE_MISMATCHES`). It returns the recomputed
answer.

**Also added:** `withEscapeCrossPassCache`, `ESCAPE_CROSS_PASS_CACHE_COUNTS` (and its reset),
`ESCAPE_CROSS_PASS_CACHE_TRACE` (one record per lookup, with the call's `opts`), and `pressEscape`, now exported for
gate rows and probes.

**The progress shape:** `v` stays 2, no field was added and the schema doc is unchanged (js-7 condition 6).

### The gate rows — `escapeCrossPassCache.test.js`, 17 rows, ~90 s

| row | what it pins |
|---|---|
| default | OFF, verify OFF, `withEscapeCrossPassCache` restores, scopes are fresh |
| **L18 r21, floor OFF** / **floor ON** | under a peeking hook and a never-tripping deadline: the solve's bytes (out, passes, persistence, report), the **whole** progress stream (every peek's snapshot, so v1's projection and v2's `rejectionKinds` / `lastWhy` / `frame` are included), `shouldStop` total, `budget.asks` by site, `PRESS_KILL_COST_COUNTS`: all OFF's. **Hit-count row:** `crossPassHits > 0` and > 50 % of lookups. Also the plain bytes with no hook and no deadline |
| L6, L3 | ON is OFF, 0 lookups |
| **deadline** | the escape site's k-th ask trips (k = 5, 50, 80): OFF's bytes, stream, asks and `shouldStop`. k = 5 trips in pass 1 on a miss: `notStoredTripped` 1, 0 hits. Not vacuous: `tripReplays > 0` (a trip landed on a hit) |
| **verify**, floor OFF / ON | `verified === hits > 0`, 0 mismatches, bytes OFF's |
| **cap** 0 / 1 / 7 | OFF exactly; `stored === cap`, `notStoredCap > 0` |
| **scope** | two solves back to back: two scopes, the second's first lookup is a `miss` on its run 1, and both solves give the same bytes and hits |
| **clocked hazard (spinner)** | L18 at `seam.time` + 0 / + 1, driven to t76, the same press at t77 asked of both in one scope: **the OFF answers differ** (ok vs `exhausted`), ON gives each its own, 2 misses, 2 entries, the escape entered twice |
| **clocked hazard (beam tower)** | L104 (`ladder2-l104-beam`, t100) at two seam times: the escape is entered twice (trace sink), the two digests' `clock` parts differ, 2 lookups, 0 hits, 2 entries |
| **arguments** | the costliest varied-key call on L18's solving pass, re-asked on a run replayed to its tick (digest asserted equal): base, `pressAt + 1`, and the held sets reversed give **three different OFF answers**; ON in one scope gives each its own (3 misses), then the base again is a hit |
| **deadline in the key** | the costliest call (> 250 expansions): (a) stored with no deadline, then the same call under a live one is a MISS and asks what OFF asks (> 0); (b) a trip at its first ask is not stored, and the same call under a live budget is OFF's whole answer; (c) stored under a live budget, the budget trips (the call on an unserved run), and the first call again is OFF's tripped answer read through no entry (`bypassedTripped` 1) |
| **per CALL, not per tick** | a fresh L18 run's tick-0 call builds visit state (the digest moves): not stored. A second fresh run in the scope misses and builds what OFF builds (digest equal after). Once nothing builds, the call is stored and then served |

### Mutants — 9 / 9 caught (`evidence/d2/mutants.txt`, `tools/xc-mutants.py` on a scratch worktree)

| mutant | red rows |
|---|---|
| M1 the key without the digest | both clocked-hazard rows, the deadline row |
| M2 the key without `pressAt` | arguments |
| M2b the held sets' order dropped | arguments |
| M3 the key without the deadline's state | deadline in the key |
| M4 a hit that skips the ask replay | L18 identity (floor OFF), the deadline row |
| M5 a tripped miss stored | the deadline row, deadline in the key |
| M6 a cache that outlives its `twoPassSolve` call | scope, the three cap rows, the deadline row |
| M7 the digest taken per TICK (fidelity-9 condition 3) | per CALL, the deadline row |
| M8 no bypass after a trip | the deadline row, deadline in the key |

The floor-ON identity row does not catch M4: residue 21 with the floor ON asks the escape's site 0 times. The floor-OFF
row and the deadline row do catch it.

### ON is OFF beyond the gate file

| row | result |
|---|---|
| identity block, `SEEDLING_ESCAPE_CROSS_PASS_CACHE=1` | **byte-identical to W0**: every row, the six `--check`s `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb` (all exit 0), ALL 7 + 5 MATCH (`d2/identity-cache-on.txt`) |
| the hammer / solver tier, ON | W0's file set, minus `levelRunStateDigest` and `lintGateLabels`, under the env switch: **19 files, 334 / 334** |
| L18 sweep, L40, staging A, ON | norm-md5 equal to OFF at each floor in every D3 round (below) |

### The shadow gate (js-7 condition 2, fidelity-9 condition 1) — 0 mismatches

Verify mode ON, every process's counts appended at exit (`tools/xc-count-hook.mjs`, `d2/verify-counts.jsonl`):

| workload | lookups | hits verified | mismatches |
|---|---|---|---|
| **L18 sweep, floor OFF** | 56,655 | **37,770** | **0** |
| **L18 sweep, floor ON** | 81,525 | **54,350** | **0** |
| `solve-seedling-r9-campaign --check` | 1,626 | 1,084 | 0 |
| `solve-seedling-r8-l18 --check` | 807 | 538 | 0 |
| `solve-seedling-r8-d2-chain --check` | 807 | 538 | 0 |
| `r8-battery`, `r8-tail`, `r9-l3` `--check` | 0 | 0 | 0 |

All six producers exit 0 under verify, and the two sweeps' norm-md5 are `de6f6e4e` / `bae5c6de`. This re-measures
DIGEST's 0-false-equal claim through the real cache: **94,280 hits recomputed, 0 different**.

### The census

`census-seedling-solver-surface --write` gave 312 → **314 rows**, both new rows classified by hand:
- `run.stateDigest`: `seedling` / `live-state`, as DIGEST suggested;
- the door import `canonicalDigestText`: `seedling` / `function`.

`census-seedling-constants --check`: 6,028, 0 drift.

**The tap's `wallBySite` will move with the cache ON**, because a hit spends almost no time at its site. It is a wall
clock: I did not pin it.

## D3 — measured (PASS)

Three interleaved rounds, each workload in four modes in turn (`evidence/d3/`). The container restarted during the
first attempt; its partial round was discarded and kept as `d3-walls-before-restart-DISCARDED.jsonl`, and all three
rounds re-ran on the new box.

| workload | OFF | cache | floor ON | floor ON + cache | cache ÷, floor OFF | cache ÷, floor ON |
|---|---|---|---|---|---|---|
| **L18 sweep** | 88.9 / 98.8 / 108.8 (**98.8**) | 68.0 / 71.2 / 75.9 (**71.2**) | 132.5 / 139.5 / 146.1 (**139.5**) | 92.7 / 99.0 / 102.9 (**99.0**) | **0.721×** | **0.710×** |
| staging A, sword | 109.6 | 110.3 | 56.5 | 50.6 | 1.006× | 0.896× |
| L40 kill rung (`r5-l40-part5`) | 5.4 | 5.5 | 5.9 | 5.2 | 1.02× | 0.88× |

Medians in bold. The box drifted slower round by round (L18 OFF 88.9 → 108.8 s); interleaving is what keeps the ratios
honest. Staging A and L40 barely ask the escape (20 / 0 calls), so their ratios are noise.

**The floor-flip table, re-stated (L18 medians):**

| | ratio |
|---|---|
| floor ON ÷ floor OFF, no cache | **1.41** |
| floor ON + cache ÷ floor OFF + cache | **1.39** |
| floor ON + cache ÷ floor OFF today (no cache) | **1.00** |

So the cache pays for the floor's extra cost at today's OFF wall, but it does not change the floor's relative price.

**Answers.** Every round's norm-md5 matches across the cache:
- L18: `de6f6e4e` (OFF and cache) / `bae5c6de` (floor ON and floor ON + cache);
- staging A: `82834f24` / `7d8e280e`;
- L40: `answer 3addc379`, 679 ticks, 372 hook calls, in all 12 runs.

The L40 probe's line-level md5 varies by round even OFF, because it prints a wall-dependent "longest gap (before call
N, site)".

## D4 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling hammer-phase XC — the cross-pass escape cache` |
| `seedling-bot.md` | the switch's paragraph, beside the other hammer-phase switches |
| schema doc | unchanged: no progress field moved |
| surface / constants | `--write` (surface: the two rows above), then `--check`: GREEN **314** · **6,028**, 0 drift |
| reference | `generate-procgen-reference.mjs`, then `--check`: **ALL 7 + 5 MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`: 179 docs |
| bounded vitest AFTER | the W0 set, plus `escapeCrossPassCache`, `seedlingSolverSurface`, `seedlingConstantsCensus` and `tapeIndexManifest` (`lintGateLabels` was already in it): **25 files, 716 / 716** |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No AS3, wasm, gitlink or rules edit. No `git stash`, nothing to `main`. `levelRun.js`, `mover.js`, `contactFidelity.js`, `strikePolicy.js`, `botDriverV2.js`, `solveProgress.js`, the tap, `jsRuntimeSolveService.js` and `flashPanel/*` were read, never edited. `execKillByPress` / `deriveStrike` are untouched |

## What the brief got wrong (measured)

1. **The branch.** The harness names it `claude/seedling-hammer-cross-pass-cache-80og3c`.
2. **"`twoPassSolve`'s run" is not the run the escape sees.** `solveSegmentUnder` drives an `Object.create(run)` view
   (`viewOf`). A scope keyed on the `makeRun` object found **0** of 1,626 calls until it walked the prototype chain.
3. **DIGEST's 45 / 53 tick-0 misses do not appear at the D4 key.** In the committed workloads no escape call moves
   the digest: the walk's own previews build the visit maps first. The lazy build is real only for a constructed
   tick-0 call (the per-CALL row), and that is where M7 is caught.
4. **"Same-pass repeats 0.2 %"** (EX's EXACT) is **0** at the D4 key. EX's key held the run object and tick, not the
   digest: a different key, not a contradiction.
5. **A clocked hazard that reaches the escape's search** (fidelity-9 condition 2). As DIGEST found, no committed
   workload asks the escape in a beam-tower or axe room. The constructed L104 call reaches the escape and is keyed and
   stored, but it returns at the forecast's `unmodelled` probe (a carried shield), before any search. The spinner row
   (L18, two seam phases, answers that differ) is the one that reaches the search.
6. **`withSolveDeadline` spreads its report onto a tripped value.** A promise wrapped by it loses `then`. Both my
   driver and the test needed the promise kept from inside the callback. This is not a defect of this slice, but it
   is a trap for anyone measuring tripped `twoPassSolve`s.
7. **"L40" asks no escape** (as EX found), so its D3 row is a control, not a saving.
8. **The bootstrap still leaves six submodules uninitialised after `READY`.**

## Residue

1. **Before any flip** (js-7 condition 5; not this slice). The same full-sweep A/B as SP: a harvest-only branch with
   the cache ON against its parent, capture on, read leg by leg. It should check:
   - every leg's verdict, tape bytes, ticks and `perTick` md5;
   - the progress capture's v1 projection and v2 fields;
   - the deadline's `shouldStop` totals and `budget.asks` by site per leg. A worker solve installs a real clock, so
     trips land on hits: the `tripReplays` path;
   - `ESCAPE_CROSS_PASS_CACHE_COUNTS` per leg, with verify ON in one arm: 0 mismatches over the harvest, and the hit
     count it verified;
   - `wallBySite`, read and not pinned;
   - that no scope's entries exceed the cap (`notStoredCap`), and the peak `maxNodes` under a progress hook. The hook
     makes entries large: every kept node is stored;
   - that `jsRuntimeSolver`'s recording Proxy does not see fewer `stateDigest` reads than the census.
2. **The forecast memo is outside the digest.** A hit does not extend `spinnerForecast`'s one-entry memo where a miss
   would. It is exact either way, and the instruments' end counts measured equal on L18 r21 (`forecastShifted`
   906 / 906). A workload that reuses the memo after a hit could still count differently; the A/B above would show it.
3. **CI.** The push run of `JavaScript Unit Tests` at the head is the suite number (⚖ 52):
   `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`. I did not dispatch anything.
4. **Tree hygiene.**
   - The scratch worktrees (`lab`, `dev`, `mut`) live under the scratchpad and are removed by name at the end.
   - The raw lab records (~40 MB) are not committed; `evidence/tools/` reproduces them.
   - The dev server on :9600 (PID 716) did not survive the container restart.
