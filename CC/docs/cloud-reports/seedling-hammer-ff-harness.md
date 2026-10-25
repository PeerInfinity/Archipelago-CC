# Seedling HAMMER-PHASE FF-HARNESS — `solveFromTape`'s recorder follows a rewound run

Slice `seedling-hammer-ff-harness` (Opus, cloud), planner `seedling-hammer-phase-planning-2`. ⚖ User approval of
2026-10-25 (*"Queue FF-HARNESS (Recommended)"*). It fixes the harness defect FF found
([`seedling-hammer-fight-fallback-shadow.md`](seedling-hammer-fight-fallback-shadow.md), branch
`claude/hammer-fight-fallback-shadow-u2ypme` @ `b2a640421f`). No solver logic changed and no switch was flipped.
Evidence is in [`seedling-hammer-ff-harness-evidence/`](seedling-hammer-ff-harness-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | **`af699d39c1`** (`origin/main` at the fetch). It is 11 commits past FF's `cfc681a566`, and none of them touch `seedlingDemo/` (test harness, Ruffle, docs) |
| commits | `44b06f48` W0 · `b6b62195` I · `0c5da7fe` rows · `dd14ca1c` D (gates, log, hand-over) · `0556c4fb` D (procgen docs index regenerated) · this report (the head) |
| branch | `claude/seedling-ff-harness-recorder-8647m7`, the session's designated branch (not the brief's `seedling-hammer-ff-harness`). Nothing went to `main` |
| box | 4 cores, node v22.22.0, dev server `serve-nocache.py 9601` (to be killed by PID at the end) |

## 2. The answer

| leg 371, seams 5226–5280 (one hammer period of 45 + a 10-seam overlap) | phases solving of 45 | divergences |
|---|---|---|
| OFF (the default), base and after the fix | 30 | 0 — **byte-identical** (every field of all 55 results but wall time: work, answer sha, `expected` sha, `equipItems` sha) |
| ON, base (`af699d39`) | 31 | 4: 5251, 5264, 5265, 5266 (= FF's, seam for seam) |
| **ON, after the fix** | **34** | **1: 5251** |
| ON, after the fix + a scratch `solverBot.withSolveDeadline` carry (§ 6.3, NOT applied) | 35 | 0 — FF's prediction |

- **The fix works where the harness can see the rewind.** 5264, 5265 and 5266 are now plans: 1775 t, the same answer sha
  at all three, and `expected` is 1776 rows.
- **5251 still diverges, and it is not the harness's to fix.**
  - Its dashless pass now solves (1795 t, its `liveRun` followed).
  - Its full pass also rewinds at t1112 and solves (1753 t), but that pass's window deadline trips (`sword-dash`).
  - `solverBot.withSolveDeadline` then returns `{ ...out, deadline }`, and the spread drops B3's non-enumerable
    `liveRun`. The harness is handed a rewound result with no `liveRun` and reads the shadow: *"returned 1753 … the
    shadow advanced 1260"*.
  - This is the brief's STOP case: *"if the honest fix needs `solveSegment` to expose more than it does"*. So it is a
    hand-over (§ 11), measured in scratch only.
- **The movers:**
  - OFF: none, on 371's 55 seams and on the 54-request radius.
  - ON: only 371's three rewind seams, which go from a divergence to a solve. No radius request moves, base vs fix,
    either arm.
- **Cost:** the medians of 3 alternating runs on 3 seams are ×0.990, ×0.950 and ×1.035. That is noise: the units and
  answers are identical.

## 3. W0 — the baselines (`af699d39`, pristine)

| row | result |
|---|---|
| bootstrap | `session_bootstrap.sh --seedling` → `READY`; six submodules were `-` after it (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine), each `git submodule update --init`. No gitlink moved |
| identity block | `SEEDLING_PORT=9601 bash scripts/procgen/identity-block.sh .` → `w0/identity.log`, EXIT 0. The **generated-set** row is an environment miss, the same in every run here: *"/root/CC/venv/bin/python has playwright 1.56.0, the pin is 1.63.0"*. The other rows: maze `57e07d21…`, acceptance `cf54cdf7…`, c3 `31dc4572…`, c6 `40d0a4c4…`, c4 `7e1497c4…`, the six producer `--check`s exit 0, reference MATCH |
| `ci-producer-checks --jobs=4` | **93 run, 0 red, 1 skipped, 0 known-red** (`w0/producers.txt`) |
| bounded vitest (⚖ 52) | the 60 test files naming `jsRuntimeSolver` / `solveFromTape` / `solveAnytime` / `watchSolve` / `hammerFightFallback` / `liveRun` (`w0/bounded.txt`): 56 default-tier files **1430 / 1430**, 4 slow files (`vitest.slow.config.js`) **12 / 12** |
| the page capture | `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page=seedling_bot_ap_p4g --page-legs=1 --ids=371 --capture-requests=…`: one request, the page's seam **5264**, the default's refusal *"kill (spinner@192,128) by press … at (246.39,154.67) … There is no step out."* (FF's 5264 row, word for word) |
| 371's census | FF's `ff-solve.mjs` (plus `DEVJ` and the plan's `expected` / equips fields), one fresh process per seam (`census.sh`). OFF 30 / 45, ON 31 / 45 + 4 divergences, **identical to FF's census files seam for seam** (seam, phase, ok, work, answer sha) |

## 4. I — the fix (`jsRuntimeSolver.js`, `b6b62195`)

The diff is +90 / −28 lines in one function and a new helper. FF § 6.2's three steps:
1. **`recordingRun(run, {skip, expected})`.** The shadow's recording Proxy is factored out unchanged, and every fork is
   now recorded by the same function:
   - `solveFromTape` hands `solveSegment` a `forkRun` that wraps each `forkRunFor` run in it, with `skip =
     perTick.length`;
   - a fork's rows are the ones past the prefix it replays from boot, so its row index is the shadow's;
   - a fork's equips at advance count `n ≥ skip` land at `n − skip`, the shadow's `expected.length − 1`. The PLAY's
     prefix equips are made inside `forkRunFor`'s own proxy, so the recorder never sees them, as the shadow's does not;
   - each fork's recording sits in a `WeakMap` keyed by the run it returned. `replayOntoFork` returns that same object,
     so `liveRun === fork`.
2. **After the solve:**
   - `liveRec = out.liveRun === undefined ? shadowRec : forkRecs.get(out.liveRun)`;
   - the length check, `equipsAt` and `equipItems` read `liveRec`;
   - `expected` is `[shadow row 0, ...fork rows]`. The first row is the shadow's because both runs are the handed-over
     state. This also keeps a hold at the tape's end, which the fork steps inside its first segment advance, out of
     row 0;
   - a `liveRun` that is none of the harness's forks throws `ShadowDivergence` by name;
   - the length-mismatch message now names which run advanced (`shadow` / `rewound run`). The shadow's wording is
     unchanged.
3. **The trailing equip's idle tick** runs on `out.liveRun ?? run`.

**With no `liveRun`** the shadow's recorder is byte-for-byte the old one: same rows, same equip index, same array
returned. Every fork now goes through one more Proxy layer. Measured: OFF byte-identical (§ 2), and the cost is noise.

**The latent admission-arm case (FF residue 1)** is covered by construction:
- `resolveKillStrategy` (~14871) and the kill rung (~25085) adopt a fresh fork with `rewind.to(t)` and do not undo it;
- `solveSegment` sets `liveRun` to whatever `rewoundInner` is at the end, so the harness reads the recording of whichever
  fork the segment ended on;
- no measured seam has an admission rewind followed by a solve on that fork: 5249 and 5256's admission rows solved or
  were undone. So the case is covered by the same lookup, not by its own row.

**Stale `equipsAt` / `equipItems` (FF residue 2)** are fixed by the same switch, because they are read off `liveRec`.

The docblock (⛓⛓ FF-HARNESS, citing ⛓ FF) names B3's `liveRun` contract, and the module header's step 3 now says *"the
advances of the run the segment ENDED on"*.

## 5. The rows and the mutant (`hammerFightFallback.test.js`, `0c5da7fe`)

**`FF-HARNESS — the tape solver's recorder follows a rewound run`.** The setup:
- `solveFromTape` on B3's fixture `r9-solve-18` at residue 4, with `HAMMER_ESCAPE` off;
- the tape's kill-lock clear is at **323**, the tick the ON two-pass loop measures (removal 223 + the fade's 100). The
  fixture's own 355 is for its committed seam, and with it the tape solve raises `PendingDeclaration`;
- the prefix is empty.

The row asserts:
- OFF: the `HAMMER_SAFETY` refusal;
- ON: exactly one fallback row, `{t: 0, how: 'rewind', refused: HAMMER_SAFETY, refusedAt: 266, verdict: 'solved'}` (the
  trace sink), so the row cannot pass on an unrewound solve;
- the plan is 349 ticks, and `expected.length − 1 === solution.length`;
- `expected` equals a fresh replay of the plan, row for row (350 rows);
- `equipsAt.size === 0`.

**Mutant ff-m1** (step 2 dropped: `liveRec = shadowRec`): the row fails with ***"ShadowDivergence: the solve returned
349 key set(s) but the shadow advanced 266 time(s)"***, FF's defect exactly. Restored, and it is listed in the file's
mutation list.

**`equipsAt` across a rewind: no reachable fixture equips across one.**
- The r9 fixture's plan has no equips.
- Every rescued 371 plan (5264, 5265, 5266, and 5251 under the scratch carry) has `equips: []`.
- The admission fixtures go through `procgenOracle.solve`, not the tape solver.

So no row was written for it. The code path is the same lookup as `expected`'s.

## 6. The radius, by mover class

### 6.1 371's census (§ 2)
- **ON:**
  - 3 seams move from DIVERGE to SOLVE: 5264, 5265 and 5266 (work 159 → 337, answer `c61eeefe66b4`). Each pass row is
    `SOLVE 1775t | refusal …hold` (the full pass refuses at the paced hold, so the dashless plan is the answer).
  - 5251 stays a divergence, moved from the dashless pass to the full pass: work 162 → 408, `SOLVE 1795t | DIVERGE
    1753/1260`. Its class is the `withSolveDeadline` spread (§ 2, § 11).
  - Nothing else moves.
- **OFF:** byte-identical (`after/census-off.txt` = `w0/census-off.txt`; raw JSON equal but `ms`).
- **Classification against FF's prediction (35 / 0):** −1 solve and +1 divergence, both at 5251, both the deadline spread.
  The scratch carry (`--import` a loader hook that swaps in a patched `solverBot.js` copy) gives 35 / 0
  (`after/census-on-sbx.txt`), and 5251 then answers 1753 t.

### 6.2 L40 and the spinner rooms
- **The capture:** fresh, at this tree. 42 L40 legs give 47 requests, and L18 220/221, L39 363–365 and L92 720/721 give 7.
- **The arms:** each request at its own seam, in 4 arms: base OFF, base ON, fix OFF, fix ON (`DEVJ` swaps in the base
  module).
- **Result: 54 / 54 identical in every arm** (all fields but `ms` and the `ffOn` stamp), and **0 fallback rows ran**
  (`radius/radius.txt`).
- **Why no mover:** this page put 371's request at seam **5262**, a phase that solves without the fallback. FF's capture
  had it at 5265. The radius therefore shows the fix is inert where no rewind runs, and the census is what exercises it.

### 6.3 The bounded set, the producer roster and the identity block, after the fix
| | defaults (OFF) | `SEEDLING_HAMMER_FIGHT_FALLBACK=1` |
|---|---|---|
| bounded vitest | **1431 / 1431** (W0's 1430 + the new row) | 1425 / 1431. **6 reds, all in `hammerFightFallback.test.js`**: each asserts the OFF default (`HAMMER_FIGHT_FALLBACK.enabled === false`, or an OFF arm computed from the default), which the env flips. The new row's red is its own OFF arm (*"expected null to be an instance of SolverBotError"*). A switch reading, not the fix |
| slow battery (4 files) | **12 / 12** | 12 / 12 |
| producers | **93 run, 0 red** | 93 run, **1 red**: `plan-seedling-hammer-a-escape` (*"with the switch OFF this staging REFUSES HAMMER_SAFETY — it solved"*: its OFF arm reads the env). It fails the same ON with the **base** `jsRuntimeSolver` swapped in (a loader hook), so it is not the fix |
| identity block | **= W0, byte for byte** | 4 rows move: acceptance `3a787897…`, c3 `72aa40fb…`, c6 `49d4608a…`, c4 `c3de4066…`. All four give **the same md5s with the base `jsRuntimeSolver`** swapped in: they are the switch's moves (procgen's own fallback), not the fix's |

## 7. D — the gates

| gate | result |
|---|---|
| bounded vitest by path (⚖ 52) + the new row | 1431 / 1431, slow 12 / 12 (§ 6.3) |
| `ci-producer-checks --jobs=4` | 0 red (§ 6.3) |
| identity block | = W0 (`d/identity-off.log`) |
| `census-seedling-solver-surface --check` | GREEN, 352 rows (no `--write`: no surface line moved) |
| `census-seedling-constants --check` | PASS (6936 literals, 0 new / 0 vanished, 10 moved = green drift) |
| `check-procgen-reference` | ALL CHECKS PASSED. ⚠ It went red at `dd14ca1c`: the log entry changed the procgen docs index. `generate-procgen-reference.mjs` regenerated it at `0556c4fb` |
| `generate-docs-index --check` | OK |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `seedling-bot-log.md` | `### Seedling hammer-phase FF-HARNESS — the tape solver's recorder follows a rewound run` |
| **CI JSUT** | run `40225715353` at `0556c4fb` — PENDING at this commit; the next commit records it |

## 8. What the planner's harvest A/B should expect

With the switch OFF: **no movers**. The OFF path is byte-identical by measurement (371's 55 seams in every field, 54
radius requests, the identity block, the producers, the bounded set). With no `liveRun` the recorder is the old one.
`liveRun` is set only by `rewind.to`, which only `HAMMER_FIGHT_FALLBACK` (rewind mode) calls. Any OFF mover in a sweep or
survey is not this slice's.

## 9. Is a `HAMMER_FIGHT_FALLBACK` flip worth its own slice now?

**Not yet: land the `withSolveDeadline` carry first.**
- **What the switch would gain on 371** (the one leg where it acts): 30 → 34 of 45 phases now, or 35 with the carry.
  These are 4 rewind rescues and 1 admission solve (5249).
- **Where it acts at all:** on the spinner route its fallback rows run only on 371 (FF's 53 of 54 requests with none,
  and 0 of 54 in this capture).
- **What it would risk without the carry:** a rewind that solves inside a pass whose deadline trips still reads as a
  page bug (`ShadowDivergence`), and that ends the anytime loop (5251). That is the "can only add solves" promise broken
  again, more narrowly than before.
- **The page cannot see an env switch** (BW residue 6). So a flip's real measure is a default flip with the probe, TT and
  the sweep / survey A/B, which a cloud session cannot dispatch.

The value is small and concentrated on one leg. With the carry it is +5 phases there and nothing anywhere else measured.
A flip slice would be cheap but its gain is narrow, and it is the planner's call after the carry.

## 10. What the brief got wrong (measured)

1. **"FF predicts 35 of 45 with 0 divergences once the harness follows `liveRun`":** the harness alone gives **34 / 1**.
   The 35th phase also needs `solveSegment`'s deadline wrapper to carry `liveRun` (FF did not see it, because at
   5251 the dashless divergence ended the anytime loop before the full pass ran).
2. **"With `SEEDLING_HAMMER_FIGHT_FALLBACK=1`, leg 371 has these four diverging seams":** true at this base too (no
   `seedlingDemo/` change since `cfc681a566`). The start SHA is `af699d39`, not `cfc681a566`.
3. **The fixture row "the one `hammerFightFallback.test.js` already rewinds and solves":** that row runs `twoPassSolve`.
   A tape solve of the same staging needs the kill-lock clear at the measured 323 (the fixture's 355 belongs to its own
   seam, and with it the tape solve throws `PendingDeclaration`).
4. **"`solveSegment` marks a rewound result with a non-enumerable `liveRun`":** only when no deadline tripped. Under a
   tripped `shouldStop` the result is re-spread by `withSolveDeadline`, and the mark is lost.
5. Branch: the designated branch is `claude/seedling-ff-harness-recorder-8647m7`, not `seedling-hammer-ff-harness`.
6. The bootstrap again left six submodules uninitialised after `READY`.

## 11. Residue

1. **HAND-OVER — `solverBot.withSolveDeadline` drops `liveRun` (~22248 at `af699d39`).**
   - **The defect:** `return deadline.first === null ? out : { ...out, deadline: … }`. A rewound segment whose deadline
     tripped loses B3's contract for every caller that reads it (`solveFromTape` here). `watchSolve.solveForPage`
     passes no `shouldStop`, so it is unaffected.
   - **A 4-line carry** (`handover/withSolveDeadline-carry.diff`): `Object.defineProperty(kept, 'liveRun', …)` when
     `out.liveRun` is set.
   - **Measured in scratch only:** 371 ON goes 34 → 35 of 45 and 1 → 0 divergences. It is inert with the switch OFF,
     because `liveRun` is never set then.
   - **Owner:** the hammer arc (B3's contract). It is a `solverBot.js` edit, out of this slice.
   - **The row it needs:** a budgeted `solveFromTape` / `solveAnytime` on a rewound fixture whose deadline trips. None
     was found cheaply; 371's 5251 full pass is the measured case.
2. **`equipsAt` across a rewind** has no reachable fixture (§ 5). The path is the same lookup as `expected`'s.
3. **The admission arms' latent case** is covered by the lookup but not exercised by a solving row (§ 4).
4. **The radius capture missed the rewind phases** (seam 5262). A future radius should pin the 371 request's seam
   (`--seam=`) at a rewind phase or re-use the census.
5. **The generated-set identity row** is an environment miss here (venv playwright 1.56 vs pin 1.63). It is the same in
   every run, so BEFORE vs AFTER is still a valid comparison.
6. **Not run here (cloud 403 on `workflow_dispatch`):** the probes, TT and the sweep / survey A/B, which are the
   planner's.
7. **Tree hygiene:**
   - no `solverBot.js`, `levelRun.js`, `dangerMap.js`, `botDriverV*.js`, `pressKillGuards.js`, `flashPanel/*`, AS3,
     wasm, gitlink or rules edit;
   - the scratch `solverBot.js` copy and the loader hooks live in the session scratchpad only;
   - no `pytest`, no `standing-values --write`, no unfiltered local vitest, no stash, no force-push, nothing pushed to
     `main`;
   - the page captures (the 371 request, 530 KB, and the radius's) stay in the scratchpad;
   - the dev server is killed by PID at the end.
