# Seedling HAMMER-PHASE SXC — leg 371's hammer-period census with the split shake exact

Slice `seedling-hammer-shake-exact-census` (Opus, cloud, MEASURE ONLY). Planner: `seedling-hammer-phase-planning-2`.
⚖ User, 2026-10-25: *"Exact for split"*; this slice is the 371 census that SHAKEEXACT's report (§ *Handed to the hammer
arc*) handed over. Evidence: [`seedling-hammer-shake-exact-census-evidence/`](seedling-hammer-shake-exact-census-evidence/).

## 1. Where this ran

| | |
|---|---|
| start SHA | **`1e17f44738`** (`origin/main` at the fetch: fidelity wave 31) |
| `shakeExactSplit` | **ON** by default (`contactFidelity.js:1379`), env `SEEDLING_SHAKE_EXACT_SPLIT=0\|1` (`:1724-1725`). The brief's env name is right |
| `PRESS_KILL_BOMBS` | ON by default; env `SEEDLING_PRESS_KILL_BOMBS=0` (`pressKillCost.js:314`, not `contactFidelity.js`) |
| branch | `claude/seedling-hammer-shake-exact-census-3fcgpt`. This is the session's designated branch, not the brief's `seedling-hammer-shake-exact-census`. Nothing went to `main` |
| commits | the tools commit `2e9ed4925`, then this report with its evidence (the head) |
| box | 4 cores, node v22.22.0. `session_bootstrap.sh --seedling` reached `READY`. It left six submodules uninitialised again; I initialised them, and no gitlink moved |

## 2. The answer

**371's phases solving, of 45:**

| arm | `shakeExactSplit` | `PRESS_KILL_BOMBS` | phases solving | band answers in the period |
|---|---|---|---|---|
| **A** (shipped) | ON | ON | **30** | **0** |
| B | OFF (band) | ON | **30** | 1 (5243, the walk's gate) |
| **C** | ON | OFF | **33** | **0** |
| D | OFF (band) | OFF | **22** | 12 (3 escaped throws + 9 "nowhere to be" with banded refuges) |

- **What happened to the band phases:**
  - **A vs B.** B's one band phase (5243) becomes the hold's own named refusal: *"the hold stands still for up to 131
    tick(s) … inside bombpusher@112,128's 256 px reach"*. The work is the same (641). Nothing else moves: 44 of 45 seams
    are byte-identical.
  - **C vs D.** **11 of D's 12 band phases become SOLVES.** The three escaped `probeCorridor` throws (5252–5254) and
    eight of the nine banded "nowhere" phases (5226, 5257, 5258, 5266–5270) all solve. The ninth (5249) becomes the
    break stance's EXHAUSTED. D's two extra pass-level band rows (5245, 5246) become `EXHAUSTED@walk`.
- **Does a split-run band throw survive? No.** With the key ON (A and C), **zero** band-text errors are *constructed*
  on any of the 55 seams, caught or not. I counted them with an `Error` wrapper installed before import (§ 4). Not one
  is a death-reboot settle either: C's two death seams (5255, 5256) are refused by the REBOOT guard before any settle
  band is read.
- **The one thing to know first:** with the shake exact, **`PRESS_KILL_BOMBS` no longer pays on 371**. ON solves 30
  and OFF solves 33. Every phase the bombs flip "won" in PKB (22 → 30) was a route around the band. Exact, the
  bombs-OFF arm solves all 30 of A's phases plus 5257, 5258 and 5266. That is a licence question for the planner (§ 7).

## 3. The request (page vs cut)

- **The page capture** (`probe-seedling-divergence-sweep.mjs --legs=<fresh seedling-divergence-legs.mjs> --mode=inv
  --producer=solver --page=seedling_bot_ap_p4g --page-legs=1 --ids=371 --capture-requests=…`, port 8000):
  - id 371 still carries the key `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`, and id
    368 carries `… <- in_L41_0_160 -> …`;
  - the page arrived at seam **5229** and **solved 1,915 t** (both passes ok, `hold, kill, walk`);
  - the row ended **`timeout`**, with 1,575 of 1,915 ticks drained at 90.3 s (§ 6;
    `page/capture-row-371.jsonl`);
  - the 530 KB request stays in the scratchpad.
- **BX's cut** (`fixtures/hammer-bx-371/leg371-l40-request.json.gz`, captured at seam 5242): field by field, only
  `staging.seam.time` and `source` differ (the cut carries the L40 atlas only).
- **On 5 seams at arm A** (5229, 5242, 5243, 5251, 5266), the two requests give the same ok, work, answer hash and
  per-pass hashes (`page-vs-cut.txt`). So the census below ran on the cut.

## 4. The census

**The method:**
- `tools/sxc-solve.mjs` is FF's `ff-solve.mjs` (one captured request, replayed the worker's way, `atSeamTime`).
  It adds the switch read-back, `PRESS_KILL_BOMBS_COUNTS`, and a **band-construction census**: `globalThis.Error` is
  wrapped before the solver is imported, and it counts every error whose text matches `Game\.shake|jiggle|shake band`,
  keeping its construction stack.
- `SXC_NO_WRAP=1` turns the wrapper off. On 5 seams across all four arms the result is identical with and without it
  (ok, work, answer, per-pass answers, guard counters; `nowrap-control.txt`).
- `tools/census.sh` (FF's) runs one fresh node process per seam and writes one file per seam, 4 at a time. Switches are
  set by env only.
- The deadline is a deterministic work budget (`passShouldStop`: *"NO CLOCK"*), so parallelism cannot move an answer.
- Seams 5226–5280 (one period plus a 10-seam overlap); 4 × 55 runs.
- The class is `<dashless pass> | <full pass>`, each written as `<what>@<the deepest verb of the refusal's chain>`
  (`tools/sxc-phases.py`).
- **Not used:** `run.shakeExactCounts`. It is a run getter, and nothing on `solveAnytime`'s return reaches it. The only
  band instrument on the solve path is `PRESS_KILL_GUARD_COUNTS.shakeRefused`, plus my construction count.

**Per arm** (`census-{A,B,C,D}.txt`, `rows-*.tsv`, raw rows `census-*.jsonl.gz`). Every arm's overlap is **10 / 10
identical** (answer and work).

**A — shipped (exact ON, bombs ON): 30 / 45**

| class | n |
|---|---|
| SOLVE (dashless) | 23 |
| SOLVE (full pass only) | 7 |
| EXHAUSTED@hold \| HOLD-WAIT@hold | 5 |
| EXHAUSTED@break \| EXHAUSTED@break | 5 |
| NO-STEP-OUT@kill (HAMMER_SAFETY, "there is no step out") | 2 |
| NOWHERE@kill (bomb-refused refuges, **no** band suffix) | 2 |
| HOLD-WAIT@hold \| EXHAUSTED@hold (5243) | 1 |

Counters: `shakeRefused` **0**, `rebootRefused` 0, band errors constructed **0**, `refugeRefused` (bombs) 1,054.

**B — band ON, bombs ON (= pre-wave-31): 30 / 45.** It is A's table with 5243's class changed to `SHAKE-BAND@walk |
EXHAUSTED@hold`. Counters: `shakeRefused` 0; 1 band error constructed, at 5243. **Stack** (construction, top frames):
`onScreenAt (levelRun.js:8654) ← chaserForecast step (:8828) ← swordTickAt (solverBot.js:7897) ← dangerNow (:7815) ←
refuseDanger (:23802) ← walkToUnder (:27250) ← walkToRun ← walkTo ← walkToUnder ← …`. This is PKB's and BX's site 1
(the walk's gate), byte for byte as they reported.

**C — exact ON, bombs OFF: 33 / 45**

| class | n |
|---|---|
| SOLVE (dashless) | 25 |
| SOLVE (full pass only) | 8 |
| NO-STEP-OUT@kill \| HOLD-WAIT@hold | 3 |
| EXHAUSTED@break \| EXHAUSTED@break | 3 |
| EXHAUSTED@walk \| HOLD-WAIT@hold | 2 |
| NO-STEP-OUT@kill \| NO-STEP-OUT@kill | 2 |
| EXHAUSTED@hold \| DEADLINE@walk (5243) | 1 |
| DEATH@kill (REBOOT guard, 5255) | 1 |

Counters: `shakeRefused` **0**, `rebootRefused` 3 (5255: 2, 5256: 1), band errors constructed **0**.

**D — band ON, bombs OFF: 22 / 45**

| class | n |
|---|---|
| SOLVE (dashless) | 21 |
| SOLVE (full pass only) | 1 |
| NOWHERE+PKSG@kill (both passes) | 9 |
| SHAKE-BAND@walk (both passes; 5252–5254) | 3 |
| NO-STEP-OUT@kill \| HOLD-WAIT@hold | 3 |
| NOWHERE+PKSG@kill \| HOLD-WAIT@hold (5245, 5246) | 2 |
| NO-STEP-OUT@kill \| NO-STEP-OUT@kill | 2 |
| EXHAUSTED@break | 2 |
| EXHAUSTED@hold \| DEADLINE@walk | 1 |
| DEATH@kill | 1 |

Counters: `shakeRefused` **648** over 11 seams; band errors constructed **674** over 14 seams; `rebootRefused` 3.

The band seams in D:
- **3 escaped throws, 5252–5254.** Stack: `onScreenAt (levelRun.js:8654) ← step (:8828) ← previewWalk (solverBot.js:6758)
  ← probeCorridor (:24409) ← walkToUnder (:27561) ← walkToRun ← walkTo ← walkToUnder …`. This is BX's site 2.
- **9 answers** that read the kill's *"no reachable cell in level 40 is clear … The room has nowhere to be. (PRESS_KILL_SHAKE_GUARD …"*:
  5226, 5249, 5257, 5258, 5266–5270. They are built by `fail ← execKillByPressOnce (:17277) ← execKillByPress (:16876)
  ← execute`. Today's text carries the `PRESS_KILL_SHAKE_GUARD` suffix, so LB's ask that it *"say the band hid them"*
  has landed since PKB.
- **5245 and 5246:** the same suffix on the dashless pass only. The answer kept is the full pass's HOLD-WAIT.

## 5. Transitions (seam by seam, `transitions-{AB,CD,AC,BD}.txt`)

**B → A (the band removed, bombs ON):**
- 1 seam moves. 5243 goes from `SHAKE-BAND@walk | EXHAUSTED@hold` to `HOLD-WAIT@hold | EXHAUSTED@hold`, with the same
  work (641). The band throw becomes another named refusal, not a solve.
- 0 non-band seams move, and 44 / 45 are byte-identical.

**D → C (the band removed, bombs OFF):** 14 seams move, and every one of them is a band seam in D.

| D class | C class | seams |
|---|---|---|
| SHAKE-BAND@walk (escaped) | **SOLVE** | 5252, 5253 (dashless 1,840 t), 5254 (full 1,757 t) |
| NOWHERE+PKSG@kill | **SOLVE** | 5257, 5258 (dashless 1,867 t), 5226, 5266–5270 (full pass; 1,565–1,608 t) |
| NOWHERE+PKSG@kill | EXHAUSTED@break | 5249 |
| NOWHERE+PKSG \| HOLD-WAIT | EXHAUSTED@walk \| HOLD-WAIT | 5245, 5246 |

- Non-band seams moved: **0**. The 31 non-band seams, including both death seams and the deadline seam, are identical.
- **5266**, the brief's first data point: C's dashless pass refuses at the paced bomb-pusher hold, at **work 98**. That
  matches `hammerRefugeBandText.test.js`'s ON sibling. The full pass then **solves** (1,608 t, work 252), so 5266 is a
  solve phase in C.

**A → C (bombs flipped OFF, exact ON):**
- Gained: **5257, 5258, 5266**. They are A's `EXHAUSTED@break` ×2 and its bomb-refused `NOWHERE` at 5266, and they
  become solves.
- Lost: **none** (all 30 of A's solves stay solves). The plans differ, though; their work and answer move.
- Other class moves:
  - 5244, 5247, 5248: `EXHAUSTED@hold` → `NO-STEP-OUT@kill`;
  - 5245, 5246: `EXHAUSTED@hold` → `EXHAUSTED@walk`;
  - 5255: `EXHAUSTED@break` → the REBOOT guard's death;
  - 5265: `NOWHERE` → `EXHAUSTED@break`;
  - 5243: the dashless pass's HOLD-WAIT → EXHAUSTED, and the full pass's EXHAUSTED → its deadline.
- **B → D** is PKB's P1 transition reversed (30 → 22), class for class.

## 6. The page (`page/rows.txt`, `page/sweep-{1,2,3}.jsonl`)

`--ids=368,371 --page-legs=1`, three sweeps at the defaults, nothing else on the box:

| sweep | leg | seam (phase) | end | plan | drained | ms | message |
|---|---|---|---|---|---|---|---|
| 1 | 368 | 5283 | **done** | 1,558 t (full; dashless refused) | 1,559 / 1,558 | 72,037 | — |
| 1 | 371 | 5278 (13) | **timeout** | 1,915 t (dashless) | 1,900 / 1,915 | 90,102 | — |
| 2 | 368 | 5273 | **done** | 1,558 t | 1,559 / 1,558 | 71,090 | — |
| 2 | 371 | 5275 (10) | **timeout** | 1,915 t (both passes ok) | **1,915 / 1,915**, last row = `expectedEnd` | 90,186 | — |
| 3 | 368 | 5275 | **done** | 1,558 t | 1,559 / 1,558 | 72,269 | — |
| 3 | 371 | 5283 (18) | **done** | 1,888 t (dashless) | 1,889 / 1,888 | 83,371 | — |
| capture | 371 | 5229 (9) | **timeout** | 1,915 t | 1,575 / 1,915 | 90,315 | — |

- **The page agrees with node phase by phase.** In census A, phases 9, 10 and 13 solve at 1,915 t and phase 18 at
  1,888 t, exactly the page's plans.
- No row failed and none mentions the band.
- **The `timeout` rows are the harness's leg budget, not the solver.** The probe's `--leg-budget-ms` defaults to
  90,000 ms. A 1,915-tick plan starts playing about 57 s into the leg (`tapes[].at`), after the boot, the arrival latch
  and the solve, so it cannot finish by 90 s. Sweep 2 played every tick to the expected end and still timed out. The
  1,888-tick plan finished in 83 s.
- PKB's P2 page row at 5278 read `done` with a 1,915-t plan. Today the same plan length times out. I did not measure
  why, so it is residue (§ 9).

## 7. What this means for the hammer arc's band work

On 371 at split stagings, the band now reaches the solver in only two ways: through `split:false` tapes (where
`shakeExactSplit` keeps the band, `unsplit`) and through SHAKEEXACT's kept cases (`noClock`, `acrossLoad`,
`rebootSettle`, `bandAlready`). **None of those occurred on any of the 55 seams** with the key ON.

| catch | where it fires today (371) | verdict |
|---|---|---|
| **PKB's refuge catch** (`deriveRefuge`, `shakeRefused`) | A 0 · B 0 · C 0 · D 648 | Dormant on split runs. It is reachable only with the band ON, i.e. `split:false` / kept-case stagings (the committed `hammerRefugeCut` / `hammerPressBombs` witnesses are split:false and keep exercising it) |
| **BX's executor band** (`EXECUTOR_SHAKE_BAND`, not landed; sites: the walk gate, `probeCorridor`, and the paced-hold third site) | 0 band errors constructed at any site in A or C | Its 371 motivation is gone. BX's best treatment (C, wait) solved 2 of D's 3 probe phases, and the exact shake solves all 3. What would still feed it is a `split:false` or reboot-settle staging. ⇒ Shelve it, or keep it as a guard for those cases only (the planner's call) |
| **LB/GF `PRESS_KILL_SHAKE_GUARD`** (`isShakeBandThrow` at the press kill's two sites) | 0 in A, B, C; only D | The same as PKB's catch: reachable only for `split:false` / kept cases |
| **LB/GF `PRESS_KILL_REBOOT_GUARD`** | 3 in C and D (5255, 5256); 0 in A and B | Shake-independent, and live wherever the bombs are OFF. The settle band it might meet after a death was never constructed: the guard refuses the death first |

**The new question:** the shipped `PRESS_KILL_BOMBS` (ON) now costs 371 three phases against OFF (30 vs 33).
- C's three extra solves (5257, 5258, 5266) are planned with the press kill's waits blind to the lobber's bombs.
- The live model run still simulates the bombs (`bombPusherLive` and `bombBlastBody` are among the page's contact keys),
  so a plan that a bomb hits would have been refused. But a game check needs a page with the bombs OFF, and the page
  reads no env.
- ⇒ The planner may want a measured re-ask on PKB's flip, now that SHAKEEXACT has removed the band it was routing
  around: an L40 radius at `PRESS_KILL_BOMBS=0`, and a page A/B through a branch default.

## 8. What the brief got wrong (measured)

1. **"With `PRESS_KILL_BOMBS=0` … 9 'nowhere to be' phases with banded refuges"**: true by answer. By pass there are
   **11**: 5245 and 5246 carry the PKSG "nowhere" on the dashless pass, and the full pass's HOLD-WAIT is kept as the
   answer.
2. **"At 5266 with bombs OFF … the dashless pass refuses later at the paced bomb-pusher hold (work 98)"**: confirmed,
   but the **full pass solves** (1,608 t). 5266 is a solve phase at C, not a refusal.
3. **"`PRESS_KILL_GUARD_COUNTS.shakeRefused` and any band counters"**: there is no other band counter on the solve
   path. `run.shakeExactCounts` is a run getter that `solveAnytime` does not expose. I added a construction count in the
   tool instead (proved inert by `nowrap-control.txt`).
4. **"Find the switch's exact env name in `contactFidelity.js`"**: it is `SEEDLING_SHAKE_EXACT_SPLIT`, as the brief
   says. `PRESS_KILL_BOMBS`'s env lives in `pressKillCost.js`.
5. **The page's seam**: the capture arrived at 5229, not PKB's 5257 or BX's 5242. The sweeps arrived at 5273–5283.
6. **Branch:** the designated branch is `claude/seedling-hammer-shake-exact-census-3fcgpt`.
7. **The probe needs `--legs=`**: the brief's command omits it. I generated the list fresh with
   `seedling-divergence-legs.mjs`; ids 368 and 371 still carry their keys.
8. **"The kill's text still reads 'no reachable cell … is clear'"** (PKB § 9.2, carried in the hammer arc): today's
   text carries the `(PRESS_KILL_SHAKE_GUARD …)` suffix when the band hid the refuges.

## 9. Residue

1. **The page's `timeout` on 1,915-t plans** (2 of 3 sweeps, plus the capture). It comes from the leg budget's wall
   clock and is not a solver answer. PKB's page row at 5278 was `done` with the same plan length. Whether the page has
   got slower (boot 21 s, arrival latch ~4 s, solve 14–20 s) is unmeasured.
2. **C's three extra solves are not game-checked** (§ 7). That needs a page run with the bombs OFF, which means a
   branch default, outside a measure-only slice.
3. **The kept cases are not exercised on 371** (no split:false tape, no shaken death settle, no load inside the
   search). This census cannot say whether those cases still escape. SHAKEEXACT's `bombblast-l40-bw-idle --split` (102
   band ticks after a reboot) is the staging that would.
4. **Hygiene:**
   - no file under `frontend/modules/` edited, no switch default changed, no tape, pin, AS3, wasm, gitlink or rules
     edit;
   - no `pytest`, no unfiltered vitest, no `standing-values --write`, no stash, no force-push, nothing pushed to `main`;
   - the dev server (port 8000) was started by me and killed by its PID;
   - the large captures (the page request, the per-seam dirs) stay in the scratchpad.
