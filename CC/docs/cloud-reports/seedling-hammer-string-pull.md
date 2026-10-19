# Seedling hammer-phase SP: the string-pull lever, answer-identical (`seedling-hammer-string-pull`)

| | |
|---|---|
| start | `b3adfad28242620b2ce1e5b83c61709b49894296` (`origin/main`) |
| head | the commit that adds this report (the branch's last); code `6305b1a` (D2) + `b2df180` (the D4 fix), records `314d0b9` |
| branch | `claude/seedling-hammer-string-pull-f1pi92` (the session's designated branch; the brief named `seedling-hammer-string-pull`) |
| evidence | `CC/docs/cloud-reports/seedling-hammer-string-pull-evidence/` (`w0/`, `d1/`, `d2/`, `d3/`, `d4/`, `tools/`) |

**Verdicts.** W0 PASS · D1 PASS (the lever reaches ≥ 1.2×) · D2 PASS (no STOP: the key needs nothing from fidelity's
code) · D3 PASS (L40 `planWaypoints` ~1.84×; L18 cannot move) · D4 PASS.

**The one thing to know first.** Over half of the string-pull's `plannerObstacleAt` queries repeat a point already asked
**in the same `planWaypoints` call**: 51 % on L40 and 72 % over the campaign. A memo keyed `(x, y)` that lives for that
one call is answer-identical by its scope. Nothing advances the run inside a call, so no live family (crushers, beam
towers, pushables, bridges, …) needs to be in the key. `STRING_PULL_FAST` (default **OFF**) takes L40's `planWaypoints`
from 4.7–5.4 s to 2.5–2.9 s and the L40 solve from 6.1–7.3 s to 4.4–4.8 s, with identical digests, `shouldStop`,
`budget.asks` and progress streams. Flipping it ON is the user's call.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-string-pull-f1pi92 origin/main` → `b3adfad282` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`. Six submodules were `-` and were initialised. Node v22.22.0. Server `serve-nocache.py 9597`, PID 754 |
| defaults | `w0/defaults.txt`: every boolean switch as `main` ships it. `DASH_KEEP_PARTIAL` / `DASH_LEG_PRECHECK` are now **ON** (HB's W0 had them OFF), `HAMMER_ESCAPE` ON, `STRIKE_ETA_FLOOR` OFF, `SOLVE_PROGRESS_INTERVAL_MS` **100** (HB: 1000) |
| identity block | `w0/identity-w0.txt`, run in a clean base worktree on its own server (9598): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576` (HB: `36b59445`, the base moved since), guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`. The worktree has no venv, so `generated set` was re-run with the primary's venv: `OK` (`w0/generated-set-w0-venv.txt`) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0. The first five equal HB's; the campaign moved since HB (`6b1bf15c` → `3d41b9fb`) |
| reference | the base worktree reports 4 regions differing (a substrate column the symlinked worktree cannot see). The primary tree at the same code: **ALL 7 + 5 MATCH**. A worktree artifact, not a base defect |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN **312** · **6,002** · 566 · 138 · **280** |
| bounded vitest BEFORE | 20 files (`botDriverV2*`, `solverBot*`, `hammer*`, `solveProgress*`, `jsRuntimeSolveProgress`, `lintGateLabels`; `w0/vitest-files-w0.txt`): **461 / 461** in 466 s |

⚠ A first W0 battery was started on the primary tree and then contaminated by the D2 edit landing during its vitest. It
was killed by PID, and W0 was re-run in a detached worktree at `b3adfad` (`…/scratchpad/base`).

**HB's profile, re-measured** (`node --cpu-prof` at 200 µs, `d1/base-l40-profile.json`, `d1/base-l18-profile.json`):

| solve | wall | digest | `shouldStop` | `planWaypoints` | `controllerPathClear` | `plannerObstacleAt` | `coerceTerrainState` (self) | `planTilePath` |
|---|---|---|---|---|---|---|---|---|
| L40 (`r5-l40-part5` → (160,640)) | 6.3 s | `3addc379` (= HB) | 167 (=) | **54.2 %** | 52.6 % | 51.9 % | 12.7 % | 1.4 % |
| L18 (`r9-solve-18`, residue 21 → (176,112)) | 4.6 s | `230dc0ff` (=) | 165 (=) | **0.1 %** | 0.0 % | 0.2 % | 0.2 % | 0.1 % |

The call counts reproduce HB's exactly on L40: **27 `planWaypoints`, 27 pulls, 881 `controllerPathClear`** (scratch
counters, `d1/l40-census.jsonl`). L18 makes 4 `planWaypoints` calls, 1 pull and 1 `controllerPathClear`.

## D1 — where the string-pull's time goes (PASS, measure only)

Method: a scratch worktree (`d1/scratch-counters.diff`) counts every string-pull `controllerPathClear` and every
`plannerObstacleAt` it makes. Each is keyed exactly: the point, the level, `allowTeleporter` and the `opts` object's
identity, within one `planWaypoints` call and within the whole solve (`tools/d1count.mjs`, `tools/d1preload.mjs`).

**L40, one solve** (`d1/l40-census.jsonl`):

| quantity | value |
|---|---|
| `controllerPathClear` calls (string-pull) | 881: 92 clear, **789 blocked** (farthest-first fails ~9 times an anchor) |
| `plannerObstacleAt` asks from them | **92,035** (104 a call; 59,562 of them inside the 92 clear calls) |
| samples on an axis leg (`prev.y === p.y`: both queries are the SAME point) | 16,471 of 45,879 (36 %) |
| asks that repeat a point **in the same `planWaypoints` call** | **47,073 (51 %)** |
| asks that repeat a point (level, allowTeleporter, opts object, x, y) **in the solve** | 81,440 (88 %) |
| `controllerPathClear` calls repeating (a, b, …) in the same call / in the solve | 65 (7 %) / 651 (74 %) |
| what blocks (first blocked ask) | `solid` 736, `pickup` 53 |
| `opts` objects seen | 7 over 27 calls (callers reuse one object across calls, so a cross-call key on its identity is not a world version) |

Inside one ask: `plannerObstacleAt` builds two boxes, asks `plannerBlockerAt` (the solid grid's candidates and
`liveRectOf` per candidate, plus a terrain probe), then loops **every** pit tile and **every** lethal-terrain tile
(`coerceTerrainState` per tile; 12.7 % self on L40), the avoid volumes and the teleporters. It is ~60 µs an ask here,
with no per-tile early-out.

**Across the corpus** (`d1/producers-census.txt`, the same counters, the share of asks that repeat a point within one
call):

| row | `planWaypoints` calls | pulls | asks | repeat within the call |
|---|---|---|---|---|
| `solve-seedling-r9-campaign --check` | 317 | 170 | 928,507 | **72.0 %** |
| `solve-seedling-r8-battery --check` | 34 | 25 | 16,321 | 59.2 % |
| `solve-seedling-r8-d2-chain --check` | 44 | 33 | 21,517 | 45.6 % |
| `solve-seedling-r8-tail --check` | 16 | 9 | 2,855 | 53.3 % |
| `solve-seedling-r9-l3 --check` / `-r8-l18 --check` | 2 / 4 | 1 / 1 | 2,074 / 1,471 | 54.7 % / 33.6 % |
| killgate census s2 | 419 | 220 | 55,730 | 39.7 % |
| acceptance batch | 6,708 | 3,415 | 1,066,103 | 43.5 % |
| empty pairs c3 / carved pairs c4 | 22,614 / 23,545 | 11,621 / 12,327 | 3.07 M / 6.26 M | 38.8 % / 55.3 % |

(`pw` counts calls that throw in A\* before any pull; `pulls` counts calls that reach the string-pull.)

**Monotonicity** (`d1/monotone.txt`, `tools/d1mono.mjs`): from every anchor, all of `j` asked. On L40 (92 anchors),
killgate s5 (534) and the campaign (498), the clear set is always a prefix, and a binary search returns the farthest-first
anchor at all 1,124. This is not provable. The controller path is a 45° leg plus an axis leg, so a farther point can be
clear while a nearer one is not. It was not used.

**The levers** (estimates against L40's `planWaypoints` = 54 % of the solve, `plannerObstacleAt` ≈ 96 % of it):

| # | lever | answer-identical? | estimate on L40 `planWaypoints` | verdict |
|---|---|---|---|---|
| **L1** | **memo `plannerObstacleAt`'s truthiness keyed `(x, y)`, scoped to ONE `planWaypoints` call** | **yes, by scope** (below) | skips 51 % of asks → **~1.95×** | **taken (D2)** |
| L2 | skip the first query of an axis-leg sample (`prev.y === p.y` ⇒ the same point) | yes (pure query) | 18 % of asks → ~1.2× | subsumed by L1 |
| L3 | memo `controllerPathClear` results within a call | yes | 7 % of calls → < 1.1× | not worth it |
| L4 | memo across calls (solve-wide), keyed on the `opts` identity | **no** as keyed: callers reuse one `opts` object while the run moves (7 objects / 27 calls) | 88 % of asks → ~5× | needs a world version (a run tick or a live-bag epoch: `levelRun`, fidelity's) → **not taken**, named in the residue |
| L5 | binary search over `j` | empirically yes (1,124 / 1,124), **not provable** | ⌈log₂ n⌉ calls an anchor instead of up to n (not measured as time) | **not taken** (the brief's rule) |
| L6 | a cheaper `plannerObstacleAt` (hoist the per-tile `coerceTerrainState` loop over lethal and pit tiles to a grid lookup) | would be, but it is the planner's hottest shared query, outside this region | `coerceTerrainState` alone is 12.7 % of the solve | residue |
| L7 | a tile-coarse reject before the fine walk | only if conservative. A blocked tile does not imply a blocked sample (the box is 4×5 with sub-tile solids, pixelmasks and live rects), so the coarse test can only certify CLEAR, never reject | small: the 789 blocked calls average 41 asks each (32,473 asks in all) | not taken |

L1 alone clears the ≥ 1.2× bar, so D1 does not STOP.

## D2 — `STRING_PULL_FAST` (PASS)

**The lever** (`botDriverV2.js`, region `controllerPathClear` / `planWaypoints` and new helpers beside them):
- `controllerPathClear(level, a, b, allowTeleporter, opts)` is unchanged in signature and answer. Its sampling moved to
  `controllerPathClearBy(blockedAt, a, b)`, the **one** copy of the two-leg geometry. OFF passes
  `(x, y) => plannerObstacleAt(level, x, y, allowTeleporter, opts)`.
- `stringPull(level, points, allowTeleporter, opts, fast, beat)` is the old loop verbatim (farthest-first, the
  `plan-pull` heartbeat once an ask). `fast` picks the query: `stringPullBlockedAt(level, allowTeleporter, opts)`, a
  `Map<x, Map<y, boolean>>` built inside the call and dropped with it.
- `STRING_PULL_FAST = { enabled, audit }`: `enabled` comes from `SEEDLING_STRING_PULL_FAST === '1'` (the browser has no
  `process`, so it gets the default, OFF); `withStringPullFast(on, fn)` restores the previous value. `audit`, when it is a
  function, makes `planWaypoints` run BOTH pulls on the same points and hand `{world, from, to, allowTeleporter, points,
  off, on}` to it. The switch's arm is returned and beats; the other runs silent, so an audited solve beats as an
  unaudited one.
- Nothing else moved: the A\*, `nearestGoalNode`, the margin ladder, `opts.manhattan` and `livePerVisitOpts` are
  untouched. `solverBot.js`, `solveProgress.js`, `levelRun.js` and `mover.js` are untouched.

**The key and its completeness proof.**
1. `plannerObstacleAt(level, x, y, allowTeleporter, opts)` reads only the point, those three bindings, and the state they
   reach: `opts.liveBag` or the legacy eight families (crushers, pushables, open bridges, …; `beamTowers` and every
   other `LIVE_GEOMETRY_KEYS` family through the bag), and `level` (tiles, solids, pits, lethal tiles, avoid volumes,
   teleporters with their `deactivated`).
2. Within one `planWaypoints` call the three bindings are the same references, and the string-pull loop executes only
   `controllerPathClearBy` → `plannerObstacleAt` (read-only: `plannerBlockerAt`, `liveRectOf` and the getters return
   fresh arrays; the lazy `pitTilesOnce` / `lethalTilesOnce` fills are answer-invariant) and the `plan-pull` heartbeat.
   The heartbeat is emit-only (HB's D2: no `shouldStop`, no `budget` write). Its hook is the progress tap, which only
   peeks. **No tick, push, crusher step, bridge opening or beam-tower drift can happen inside the call.**
3. So every time-varying family is constant over the memo's life. It is covered by the memo's **scope**, not by a key
   field, and a family added later is covered the same way. This holds for fidelity-9's list: `crushers` (a snapshot
   that moves per tick), `beamTowers` (drifts per tick under `beamTowerDrift`), `pushables` and `openBridges`. Each
   change happens **between** calls, and the memo of the earlier call is gone by then.
4. Answer-identity: both arms ask the same samples in the same order (one geometry copy). ON answers only a **repeat**
   from the memo, and the first ask of any point is computed, so a throwing query throws at the same ask. The memo
   stores `!!answer` because truthiness is all `controllerPathClear` reads. `Map` keys are SameValueZero, so `-0` and
   `0` share a row; `plannerObstacleAt` reads coordinates only through arithmetic and comparisons, which do not see
   the sign of zero.
5. Nothing from fidelity's code is needed for the key, so there is no STOP.

**Gate rows.** `stringPullFast.test.js`, 13 rows, 58 s:

| row | what it holds |
|---|---|
| contract (2) | default OFF with no audit; `withStringPullFast` restores on sync, async and throw |
| **crusher step** | L42 `crusher@96,144` at x = 96 and then x = 95 (one tick of a leftward charge, 1 px/tick), ONE `opts` whose `crushers` map is mutated in place. (94,190) → (94,112): `[(94,112)]` before, `[(92,116),(94,112)]` after. ON = OFF on both sides, interleaved (OFF, ON, step, ON, OFF), and the step undone gives the first answer again |
| **push mid-leg** | L8 `pushableblock@96,112`, pushed one tile down through the same in-place shape. (92,72) → (116,114): the push drops the `(120,104)` waypoint. ON = OFF both sides; the cached answer does not survive the push |
| corner sample (4) | L1 / L2 / L3 plans whose answer turns on the X-first `(p.x, prev.y)` sample (found by sampling, `tools/m4search.mjs`). OFF bytes pinned, ON equal |
| L40 / L18 / L6 / L3 | the committed solves under a deadline that never trips, hooked: OFF vs ON (audited) digest, `shouldStop`, every segment's final `budget.asks`, the **whole progress stream** (every hook call's site and snapshot, heartbeats included), and 0 audit mismatches. L40's digest pinned `3addc379`, L18's `230dc0ff` |
| L42 crusher witness | `crusherPlan(CRUSHER_WITNESSES[0], true)`, a moving-crusher room solved with the bait: perTick, trace and `waypointsPlanned` OFF = ON, every pull audited |

`check-seedling-string-pull-fast.mjs` (the ≥ 500-call corpus, `d2/corpus-check.txt`, 2 m 40 s). It runs each row in a
child OFF, then ON under the audit preload:

| row | OFF md5 | ON md5 | audited calls | mismatches |
|---|---|---|---|---|
| `solve-seedling-r8-battery --check` | `405d9c4b` | `405d9c4b` | 25 | 0 |
| `solve-seedling-r8-d2-chain --check` | `b76f6483` | `b76f6483` | 33 | 0 |
| `solve-seedling-r8-l18 --check` | `465a8b46` | `465a8b46` | 1 | 0 |
| `solve-seedling-r8-tail --check` | `35456fbc` | `35456fbc` | 9 | 0 |
| `solve-seedling-r9-l3 --check` | `6cd35fe1` | `6cd35fe1` | 1 | 0 |
| `solve-seedling-r9-campaign --check` | `3d41b9fb` | `3d41b9fb` | 170 | 0 |
| killgate s2 / s5 / s9 | `006b0639` / `7d4cb820` / `49e23d85` | the same | 220 / 459 / 357 | 0 |
| **total** | | | **1,275** | **0** |

Every OFF md5 equals W0's identity block. `--full` adds the acceptance batch and the three pair dumps: 46,048 calls,
0 mismatches (`d4/corpus-full.txt`).

**Mutants** (`tools/mutants.py`, `d2/mutants.txt` / `d2/mutants.json`). Each was applied to a scratch tree, run
through `stringPullFast.test.js` and the corpus rows `d2-chain`, killgate s2 and s5, then reverted:

| mutant | caught by |
|---|---|
| m1 memo outlives the call (module-wide, key `(level, x, y)`: no `opts`, no world) | crusher step, push, L6; corpus killgate s2 (53 mismatches), s5 |
| m2 memo per `opts` object (survives the call, so it misses a family moved in place) | crusher step, push (the corpus does not see it: real callers move the world between calls that reuse one `opts`, but never on the queried points of these solves) |
| m3 key missing `y` | crusher step, L40, L6, L3, L42 witness; every corpus row |
| m4 non-conservative skip (the fast arm drops the X-first corner query) | **survived the first pass** (every real solve, and the `--full` corpus, is blind to it). Then caught by the four corner rows, added for it (`d2/m4-rerun.txt`: 4 / 4 red; D4's re-run: the same) |
| m5 search order nearest-first | every vitest row but the contract; every corpus row |
| m6 search order binary | **answers equal everywhere** (0 corpus mismatches, as D1 predicted). Caught only by the L40/L6/L3 progress-stream equality, because it asks fewer times and so beats fewer `plan-pull`s. It is a real difference (the stream), and the brief's rule stands: it is not provably the same anchor |

## D3 — measure (PASS)

`tools/d3.sh`, `d3/rounds.jsonl`. Three interleaved rounds; each arm has one plain run (wall) and one `--cpu-prof` run
(the `planWaypoints` share). Load 1.0–1.6 on 4 cores.

| solve, arm | wall (s), rounds 1/2/3 | `planWaypoints` ms (share) | `plannerObstacleAt` ms | digest | `shouldStop` | ticks |
|---|---|---|---|---|---|---|
| L40 OFF | 6.15 / 7.27 / 6.74 | 4,686 / 5,404 / 5,347 (59 %) | 4,709 / 5,358 / 5,160 | `3addc379` | 167 | 679 |
| L40 **ON** | **4.80 / 4.73 / 4.35** | **2,933 / 2,905 / 2,483 (43–45 %)** | 2,868 / 2,821 / 2,422 | `3addc379` | 167 | 679 |
| L18 OFF | 4.90 / 4.86 / 4.45 | 14 / 10 / 12 (0.2 %) | 15 / 11 / 15 | `230dc0ff` | 165 | 445 |
| L18 ON | 4.68 / 4.73 / 4.89 | 9 / 9 / 10 (0.1–0.2 %) | 12 / 9 / 11 | `230dc0ff` | 165 | 445 |

- **L40 `planWaypoints`: 1.84× by medians** (5,347 → 2,905 ms; 1.6–2.2× per round). The whole solve: 6.74 → 4.73 s,
  **1.42×**. D1's estimate was ~1.95×; the memo's own Map traffic takes the difference.
- **L18 does not move.** Its string-pull is one call of 463 asks; the solve is chaser/hammer previews, not planning.
- **Page check** (`d3/page-*.log`, `d3/test-results-*.json`): the JS runtime's two planner-walk rows,
  `seedling-js-runtime-bot-completes-generated-room` (`jsRuntimeWalker` replans with `planWaypoints`) and
  `seedling-js-runtime-bot-completes-atlas-location`, were run against the base server (9598, the base worktree) and
  the head server (9597): PASSED on both (28.5 s / 28.0 s, 6.0 s / 5.8 s), and `compare-runs.js` reports *"No
  differences in status, roster, or duration"* for each pair. The page takes the default (OFF), so this shows that the
  refactor (`controllerPathClearBy`, `stringPull`) changed nothing it plans.

## D4 — records (PASS)

| row | result |
|---|---|
| ⚠ first D4 run (at `314d0b9`, `d4/first-run/`) | **1 failed / 967**: `solveProgressHeartbeat.test.js`'s static row (*"every call site is one null check with a literal key"*: 3 calls, 2 guarded sites). D2's `if (beat && activeProgress !== null) progressHeartbeat('plan-pull')` broke the exact form HB pins. My D2 vitest ran only the new file, so this was missed until D4. **Fixed in `b2df180`**: `if (beat) { if (activeProgress !== null) progressHeartbeat('plan-pull'); }`. Same behaviour, and the pinned form is back |
| bot log | `seedling-bot-log.md` → `### Seedling hammer-phase SP — the string-pull lever` (and the fix, noted) |
| surface / constants | `--check` GREEN **312** · **6,002**, 0 new / 0 moved. The audit row hands the world object (`world: level`), not `level.level`, which would have been a 14th `world:level` read site (the first `--check` caught it). No `--write` was needed |
| reference | `generate-procgen-reference.mjs` rewrote `README.md`, `architecture.md` (the instrument count 438 → 439: the new `check-` row) and `procgenDocs/generated/{docsIndex,instruments}.js`, then `--check`: **ALL 7 + 5 MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`: 176 docs, no change |
| `check-procgen-help` | the new instrument: `--in-place --only=check-seedling-string-pull-fast.mjs` → **HELP ok · IMPORT ok** (`argvHelp`; the audit preload half installs only when its env var names an output file, so a bare import is inert) |
| identity block AFTER (`d4/identity-d4.txt`, at `b2df180`) | **byte-equal to W0, every row** (the six `--check`s, the 13 md5 rows); `generated set` **OK** (the primary venv); reference MATCH |
| tapeRunner pairs AFTER | **617 `8f27f975`**, 0 non-pass (= W0) |
| censuses AFTER | GREEN 312 · 6,002 · 566 · 138 · 280 (= W0) |
| bounded vitest AFTER (`d4/vitest-d4.txt`) | 28 files: the W0 set + `stringPullFast`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `tapeIndexManifest`, `procgenDocs/{generated,docLinks,docsRender}`, `quickLaunch/generated` (`lintGateLabels` already in W0's): **967 / 967** in 312 s |
| corpus `--full` (`d4/corpus-full.txt`) | **13 rows, 46,048 audited `planWaypoints` calls, 0 mismatches**: the six producers, killgate s2/s5/s9, the acceptance batch (3,415), empty pairs c3 (11,621) / c6 (17,410), carved pairs c4 (12,327). Every OFF md5 = ON md5 = W0's identity row |
| mutants re-run (`d4/mutants/`, against `b2df180`'s text) | m1 ✓ (crusher, push, L6; killgate s2, s5) · m2 ✓ (crusher, push) · m3 ✓ (5 rows; every corpus row) · **m4 ✓ (the four corner rows)** · m5 ✓ (11 rows; every corpus row) · m6: answers equal, caught only by L40/L6/L3's stream |

## What the brief got wrong (measured)

1. **"881 string-pull `controllerPathClear` calls … the string-pull asks from the farthest point back."** True, and
   the asymmetry is the bigger fact: **789 of the 881 end blocked**. The work is in the blocked candidates, and their
   samples overlap.
2. **"How many calls repeat an earlier (level, a, b, allowTeleporter, opts) within one `planWaypoints`, within one
   solve?"** At the call level, few within one call (7 %); 74 % across the solve, but `opts` is one object that the
   caller reuses while the run moves, so the identity key is not a world key. The repeats that are SAFE to memo are
   one level down, at `plannerObstacleAt`: 51 % within one call.
3. **"A memo key covers EVERY TIME-VARYING family."** For this lever the honest key has **no** family in it. The scope
   is one synchronous call, and that is what makes the families constant. The fidelity-9 rows (a crusher step and a
   push mid-leg through one in-place `opts`) are in the gate as asked, and they catch m1 and m2.
4. **"L18 and L40 … wall, `planWaypoints` share."** L18's `planWaypoints` is 0.1–0.2 % of its solve. The lever cannot
   move it, and D3 confirms that.
5. **"Recorded inputs from the committed solves, ≥ 500 calls."** The corpus is captured **live**. The audit seam runs
   both pulls on the real call's own points at the moment of the call, so there is no serialisation fidelity gap (a
   `liveBag` carries a module-private brand and live maps that a recording would have to re-mint). 1,275 calls over
   the six producers and the killgate census, and 46,048 with `--full`.
6. **"The six producers"** also include `solve-seedling-r9-campaign`, whose `--check` md5 moved since HB
   (`6b1bf15c` → `3d41b9fb`, before this slice). Quoted from W0 here, not from HB.
7. **"`controllerPathClear` at `botDriverV2.js:1020`, `planWaypoints` at `:1258` (at `6fe75d9493`)."** At `b3adfad`
   they are the same lines, and the heartbeat is at `:1346`.

## The residue

1. **The default.** `STRING_PULL_FAST` ships OFF. Flipping it is a user ruling. Byte-identity is shown on everything
   measured (13 gate rows, 46,048 audited calls, the identity block). A flip needs no re-record, because nothing
   moves.
2. **A cross-call memo (L4, ~5× on L40's asks)** would need a world version that changes whenever any live family
   does: a run tick, or an epoch on the live bag. That lives in `levelRun.js` (fidelity's). Named, not built.
3. **`plannerObstacleAt` itself (L6).** Every ask loops every pit and lethal-terrain tile with `coerceTerrainState`
   (12.7 % of the L40 solve on its own). A grid lookup would speed up every planner query, the A\* included. It is the
   planner's hottest shared function; owner's call.
4. **Binary search (L5)** is equal on all 1,124 measured anchors. It needs a monotonicity proof, or an
   equivalence-checked fallback, before it can be answer-identical by construction. It also changes the heartbeat count.
5. With the memo ON, `planWaypoints` is still ~44 % of L40, and HB's `plan-pull` heartbeat still beats once an ask.
6. Housekeeping, done: the scratch worktrees `…/scratchpad/wt` (the D1 counters and the mutants) and
   `…/scratchpad/base` (W0) were removed by name (`git worktree remove`), and the two servers (PID 754 on 9597, PID 1461
   on 9598) were killed by PID.
