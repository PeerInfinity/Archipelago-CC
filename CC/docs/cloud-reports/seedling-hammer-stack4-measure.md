# Seedling hammer-phase: STACK4-MEASURE (PKSW + PKRB + DSS + LHM together, measure only)

Slice `seedling-hammer-stack4-measure` (Opus, cloud). Planner: `seedling-hammer-phase-planning-16`. ⚖ Approved by the user
on 2026-11-25 (*"Stack measure + re-measure-10 (Recommended)"*). This is the **measure** half; the whole-game
re-measure-10 is a separate session. **No solver, bot or model code was changed.** No planner follow-up arrived during the
slice, so none was followed. Evidence: [`seedling-hammer-stack4-measure-evidence/`](seedling-hammer-stack4-measure-evidence/).

## 1. Commits

- **Start:** `d8bd5bb578` (branch `hammer-stack-4sw`, the brief's base: the flip tip `2b24a77e3f` merged with
  PKSW-HITS @612935c444 and LATCHED-HOLD @9de02ebc25).
- **Branch:** `claude/seedling-stack4-measure-57t70r`.
- **Commits:**
  - `32502426`: step 1, identity and the instruments;
  - `2eb2ca2b`: steps 2–3, the L40 fixtures and the A1/P1/F1 requests under five variants;
  - `66c52025`: steps 4–6, the survey, the game and page witnesses, the seam sweep and the census;
  - the report commit (this file) is the head.

## 2. The answer first

- **The one thing to know first:** **all4 ships a hit on re-measure-9's own entry-32 continue request.**
  - The request is F1 32:10 (`cd02c0916e6c` OFF, a refusal).
  - Under all4 it solves 926 t with **1 hit**: `t1799 chaser:bob@272,112`, inside the second press kill
    (`spinner@192,160`).
  - The hit is **PKRB's alone**: PKRB by itself gives the same answer `851256c5b984`, and PKSW is never reached.
  - So **a whole-game walk with all four ON can take a hit at entry 32 at the 640 continue**, before LHM's 32:12 is ever
    asked. The parallel re-measure-10 runs exactly that set.
- ⚠ **Second thing:** `--solver-env` takes **`;`**, not `,`. A comma spec is accepted silently and installs **one**
  variable, `SEEDLING_PRESS_KILL_START_WAIT="1,SEEDLING_…"`, so every switch reads OFF in the page worker. The `SOLVER_ENV:`
  readback echoes it unchanged. Measured with a worker probe (§6, `measure/env-probe-worker.txt`); this session's first
  page run made exactly that mistake and was discarded.
- **Does the stack work together? Mostly yes:**
  - **Leg 371:** LHM recovers PKRB's refusal. all4 gives **1678 t, 0 h**; OFF 1805 t, 0 h; noLHM (= `pksw_mine`) refuses
    on the latched hold, as PKSW-HITS found.
  - **Leg 376:** all4 gives **1599 t, 0 h** (OFF 1614 t, 1 h).
  - **Step 149:** all4 **SOLVED 2128 t, 0 h**. Game: **2128/2128, 0 hits**. The tape is identical to PKSW-HITS's
    `pksw_mine`.
  - **A1:** 32:10 solves 651 t, 0 h; **32:12 / F1 32:12** solve 1889 t, 0 h.
  - **Survey:** only step 149 moves, and **no step gains a hit** (read per step, §5).
  - **Fresh p4g page under all4:** it cleared the 32:12 wall on its arrival (seam 5451): 1889 t, 0 room hits.
- **Recommended landing subset: `LATCHED_HOLD_MOVE` alone** (DSS optional, measured inert without PKSW).
  - It is the only measured subset that **gains no hit anywhere**.
  - It solves the whole-game stop (A1/F1 32:12, 0 h) and the fresh-page arrival.
  - **Hold PKSW and PKRB**: each one alone gains a hit on F1 32:10. PKSW alone gives `t1690 bomb#9`; PKRB gives the
    chaser. Over a 16-seam sweep, all4 still ships 2 hitting seams.
- **The interaction defect** (class **(a)**, with a **(d)** component): §9 item 1.

## 3. The reproduction (measured)

**Inputs.**
- The 18 L40 fixtures: PKSW-HITS's 17 (STEP149's list) plus LATCHED-HOLD's leg 368 (`census/fixtures.txt`).
  Legs 371 and 376 run first.
- Re-measure-8's A1 32:10 and 32:12, and P1 32:10 at seams −20 / 0 / +7 (`7174bc96b9`).
- Re-measure-9's F1 32:12 and F1 32:10 (`30e8f29067`, `F1.stop-requests.jsonl.gz`).
- Each request is solved in node as the worker does (`tools/solve.mjs`). Each hit is owned by the last verb row at or
  before its key (`tools/seg-hook.mjs`, an in-memory loader patch; no repo file is edited).
- `tools/matrix.sh` runs the variants: `tools/variants.sh` holds the five brief variants plus `lhm` and `dssLhm`, added
  after the step-3 reading. Tables: `measure/matrix-stack4.txt` (raw: `matrix-raw.jsonl`).

**The two legs the brief named:**

| key | variant | verdict | hits | reach (pksw / pkrb asked/refused / dss / lhm asked/moves) |
|---|---|---|---|---|
| leg 371 `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | off | 1805 t | 0 | 0 / 0/0 / 0 / 0/0 |
| | **all4** | **1678 t** | **0** | 0 / 44/28 / 2 / **2/2** |
| | noPKRB | 1796 t | 0 | 0 / 0/0 / 3 / 1/1 |
| | noLHM | **REFUSED** (*"the hold stands still for up to 131 tick(s) … inside bombpusher@112,128's 256 px reach"*) | – | 0 / 44/28 / 2 / 0 |
| | noDSS | 1678 t | 0 | 0 / 44/28 / 0 / 2/2 |
| leg 376 (the same key, seam 5271 capture) | off | 1614 t | **1** `t1248 bomb:bombpusher@112,128#9` ← row 1112 kill | 0 / 0/0 / 0 / 0 |
| | **all4** | **1599 t** | **0** | 0 / 40/28 / 3 / 0 |
| | noPKRB | 1614 t | 1 (as OFF) | 0 / 0/0 / 3 / 1 asked, declined |
| | noLHM, noDSS | 1599 t | 0 | PKRB's |

So under all4, PKRB routes leg 371 onto the latched hold, and LHM moves that hold twice (PKRB alone refuses there).

**The requests** (the table shape of `matrix-32-10-pksw-x-switches.txt`):

| request | off | all4 | noPKRB | noLHM | noDSS |
|---|---|---|---|---|---|
| A1 32:10 | refusal `5b043103efee` | **651 t, 0 h** | 797 t, **1 h** `t1690 bomb#9` ← kill@1663 | 651 t, 0 h | 651 t, 0 h |
| A1 32:12 | refusal `599d2ef41b84` | **1889 t, 0 h** (`a404ddf42e41`) | 1889 t, 0 h | refusal `599d2ef41b84` | 1889 t, 0 h |
| P1 32:10 seam −20 | 618 t, **2 h** (#7 t1598, #8 t1644) | **793 t, 0 h** | 618 t, 2 h | 793 t, 0 h | 793 t, 0 h |
| P1 32:10 seam 0 | refusal | 722 t, 0 h | 722 t, 0 h | 722 t, 0 h | 722 t, 0 h |
| P1 32:10 seam +7 | 738 t, **1 h** `#8 t1644` | 719 t, **1 h** (the same bomb) | 741 t, 1 h | 719 t, 1 h | 719 t, 1 h |
| **F1 32:12** (rm9 stop) | refusal `599d2ef41b84` | **1889 t, 0 h** | 1889 t, 0 h | refusal | 1889 t, 0 h |
| **F1 32:10** (rm9 continue) | refusal `cd02c0916e6c` | 926 t, **1 h** `t1799 chaser:bob@272,112` ← kill@1755 | 797 t, **1 h** `t1690 bomb#9` | 926 t, 1 h | 926 t, 1 h |

Extra variants (added for the F1 reading): `pkrbOnly` and `pkrbDss` both give F1 32:10 the same 926 t / 1 h
(`851256c5b984`). `lhm` and `dssLhm` give:
- every 32:10 request as OFF (refusals; the P1 hits are OFF's own);
- A1 / F1 32:12 1889 t, 0 h;
- legs 371 1796 t / 368 1599 t, 0 h;
- leg 376 OFF's 1 h, unchanged.

Two more fixtures move, both hitless in every variant:
- leg 377 (`… -> location:L40 flag 1: wandlock@176,80 cleared`): 1482 t → 1438 t under every PKRB variant;
- leg 368 (`level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144`): 1714 t → 1599 t under every LHM
  variant.

The other 14 fixtures are identical in every variant. PKRB is asked on the Chest leg and on legs 871/872 and changes no
answer; DSS is asked on 356/398 and also changes no answer.

**F1 32:10, the defect** (`measure/f1-32-10-pkrb-*.txt`, `f1-vs-a1-32-10-diff.txt`):
- **The request:** F1 32:10 is A1 32:10's request with **one field** moved, `staging.seam.time` 79143 → 81985 (a
  recursive JSON diff).
- **The rows:** a hold at 1449, then kill `spinner@192,128` from 1534 to 1755 (221 ticks, PKSW not asked), then kill
  `spinner@192,160` from 1755.
- **The hit:** in the second kill's approach to its strike cell (216,152), the player walks left and up from (268,170).
  It stands still at (254.6,163.3) through keys 1793–1796, about 5–7 px from `bob@272,112` at (259,157). It is hit at key
  1797 (`t1799`), then swings at 1798.
- **The passes:**
  - `dashless` solved 926 t with **`modelHits` 1**;
  - `full` refused;
  - `hit-avoid` tried once and was cut at `window`.
  - So the anytime ladder shipped the billed 1-hit plan.
- **Class (a):** the model forecasts the hit (it is billed), and the solver accepts it, because the press kill's approach
  stand is not priced against the chaser.
- **Component (d):** hit-avoid had one try before the window.

**The seam sweep of 32:10** (`measure/sweep-32-10.txt`; 16 seams around P1's capture, F1 = P1 − 97). The outcomes repeat
with a period of 90:

| | hitless solves | solves with hits | refusals |
|---|---|---|---|
| off | 2 | **2** (P1−20: 2 h; P1+7: 1 h) | 12 |
| **all4** | 11 | **2** (F1+0: chaser, **new**; P1+7: OFF's own bomb) | 3 |
| noPKRB | 5 | **9** (bomb#9 ×7, plus OFF's two) | 2 |

## 4. Design + change; OFF identity

- **No behaviour change**, so no switch was added. Everything committed is under the evidence directory: instruments,
  outputs and this report.
- **Identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` (`measure/acceptance-md5.txt`):
  - base OFF: `391322d681b7aa0229d94b3f6906d024`;
  - base **all4**: `391322d681b7aa0229d94b3f6906d024`, **unchanged**.
- **Surface:** `census-seedling-solver-surface.mjs --check` is **GREEN** (375 rows) at the base. No regeneration was owed,
  because no source changed.
- **The instruments** (`tools/`):
  - `solve.mjs` (with `seg-hook` / `seg-reg`): one request in, one line out (verdict, ticks, work, answer, each hit with
    its owner row, deaths, and each switch's reach);
  - `kt-hook` / `kt-reg`: PKSW-HITS' per-tick press-kill log, with the player position added;
  - `matrix.sh`, `variants.sh`, `table.py`, `sweeptable.py`;
  - `sdiff.py`: PKSW-HITS', plus a per-step listing of every step with hits;
  - `reach-preload.mjs`: LATCHED-HOLD's preload pattern, extended to all four switches;
  - `tapewitness.mjs`: PKSW-HITS', with the lock name changed;
  - `env-probe.mjs` / `env-probe-worker.mjs`: §6.

## 5. Rows + bounded vitest runs

- **No rows were added.** This is a measurement slice with nothing new to pin.
- **Bounded run at the base:** `npx vitest run` over `pkswHits.test.js`, `hammerLatchedHoldMove.test.js`,
  `pressKillStartWait.test.js` and `solverEnvChannel.test.js`: 4 files, **29/29**.
- **Not run:** no unfiltered vitest, no pytest, no `standing-values --write`.
- **Survey `--through=end`, all five variants** (`survey/survey-5way.tsv`, `summary.txt`; the JSONs are gzipped beside
  them):
  - **only step 149 moves**: OFF REFUSED; all4 / noPKRB / noLHM **SOLVED 2128 t, 0 h**; noDSS SOLVED 2149 t, **1 h**;
  - **read per step**, the steps with a hit are the same in every variant: 24 (L16) 1 h, 202 (L82) 2 h, 220 (L82) 2 h,
    and 0 deaths on every step;
  - no step gains or loses a hit except 149: OFF has no plan there, and the plan is 0 h under all4.

## 6. Game witness / page play

**Step 149 on the game** (`game/game-s149-all4.json`):
- all4's survey walk view for step 149, played headless logic-only on a fresh `seedling_bot_ap_p4g` page under the box
  lock: **finished 2128 / 2128, hits 0**, end L40 (71.9,144.6).
- The view is **identical in every field** to PKSW-HITS' `s149-walk-pksw_mine` (`game/s149-tape-vs-pksw-mine.txt`).
- LHM is not asked on step 149 (§7).

**LATCHED-HOLD's refusing arrival, under all4.**
- **The captured request** (seam 5448; their `page/p4g-on-requests.jsonl.gz` request i=1), replayed in node: the
  **same refusal `87e2cf38fe85`** under every variant. LHM is asked and declines; nothing else is reached.
- **A fresh page under all4** (`probe-seedling-divergence-sweep --legs=<their legs-crafted.jsonl> --page=seedling_bot_ap_p4g
  --mode=inv --page-legs=1 --leg-budget-ms=900000 --solver-env='…;…'`; `game/p4g-all4-*`) **cleared the wall**:
  - arrival seam 5451;
  - 640 cut at `walk`, then the held 2560 retry **solved 1889 t** (dashless 890 work, full 976, `modelHits` 0/0);
  - played to `done`, **0 room hits** over 2953 samples.
- **Node agrees with the page on that arrival** (`game/p4g-all4-node-replays.txt`): the request solves 1889 t / 0 h
  (`a404ddf42e41`, A1 32:12's answer) under all4 **and under `lhm` alone**, while OFF and noLHM refuse with `599d2ef41b84`.
  So the page's arrival phase varies from run to run (here A1's paced-tick 33, theirs tick 27). LHM clears the A1 phase
  and refuses, without a hit, on the other.
- **The page's `--solver-env` is `;`-separated** (`measure/env-probe-worker.txt`). A module worker that loads the real
  `jsRuntimeSolveWorker.js` first reads all four switches **true** with `;`. With `,` it reads all four **false**, and
  `process.env` holds one bogus variable.
  - This session's first page run used commas. The page then answered with OFF's numbers (dashless 823, full 1738), which
    is how it was caught.
  - That run is discarded and not in the evidence.

## 7. Census: which seed-1 divergence-sweep legs (by key) each switch can move

- **The leg list at this base:** `seedling-divergence-legs.mjs --presets=seedling_playthrough` gives 915 legs, 50 on L40.
  Ids and keys are the same as PKSW-HITS' list (`census/l40-legs-seed1-at-base.txt`).
- **Reach in the survey under all4** (`census/survey-reach-all4.jsonl`; the reach run's verdict, ticks and hits are
  identical to the plain all4 survey on all 250 steps):

| switch | steps reached | levels | moved |
|---|---|---|---|
| PKSW | 96, 149 | L40 | 149 |
| PKRB | 66, 96, 149 | L40 | 149 |
| DSS | 43 steps (4, 10, 28, 29, 31, 36–38, 40, 45, 47, 54, 62, 64, 65, 68, 81, 88, 94, 109, 124, 130, 132, 134, 135, 137, 142, 145, 147, 149, 158, 162, 164, 167, 171, 183, 185, 191, 197, 213, 235, 240, 250) | 27 levels, L4–L115 | 149 only |
| LHM | none | – | – |

- **By key over the committed captures:**
  - Only three of the 18 fixtures carry current-list keys:
    - 380 `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest` (PKRB asked 8, unchanged);
    - 847 `level_40__r4c4 <- in_L41_0_160 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144` (refuses
      identically in every variant);
    - 849 `level_40__r4c4 <- in_L42_240_336 ~> level_40__r0c53 -> location:Level 040 - Totem Part 64,144` (identical).
  - The keys that move are all **old-list** captures of `level_40__r0c53 <- {in_L41_0_160, in_L42_240_336} -> location:Level
    040 - Totem Part 64,144` (legs 368/371/376) and `-> location:L40 flag 1: wandlock@176,80 cleared` (leg 377), plus the
    whole-game requests.
  - **No current seed-1 leg is measured to move.**
- **What a landing's sweeps must watch:**
  - **LHM:** the 50 L40 legs. Only L40 holds a BombPusher, and LHM fires only on a latched presser hold inside its reach.
  - **PKSW / PKRB:** the same 50 L40 legs, especially the press-kill ones.
  - **DSS:** the **whole list**, because it is asked on 27 levels. In this slice's measurements it moves nothing without
    PKSW.
- **The recommended subset:** **`LATCHED_HOLD_MOVE` alone** (optionally with `DASH_STAND_SIGHT`, inert here).
  - It gains no hit on any measured request, fixture, seam or survey step. Every hit it leaves is OFF's own: leg 376's,
    and P1 −20 / +7.
  - It solves A1/F1 32:12 hitless and the fresh-page arrival.
  - **PKSW + PKRB wait** for the strike-approach chaser (§9 item 1) and the strike-stand bomb (§9 item 2).
  - all4's gains are real but carry one shipped hit:
    - gains: step 149 hitless, A1 32:10 hitless, seam −20's 2 h gone, 11 of 16 sweep seams hitless;
    - the cost: F1 32:10, the actual whole-game request at entry 32.

## 8. What the brief got wrong (measured)

- **"Its scratch instruments (`probe1.mjs`, `fxsolve.mjs`, `trace-reg.mjs`) were never committed":** they were.
  `seedling-hammer-pksw-hits-evidence/tools/` holds all three, from commit `50b8ea0b`. This slice reused their patterns
  and committed its own versions anyway.
- **"A fresh p4g page arriving at the same wall with a different spinner phase still refuses":** true of LATCHED-HOLD's
  arrival (seam 5448; still refused under all4). But a fresh page under all4 this session arrived at seam 5451 on A1's
  phase and **cleared** the wall, 0 hits. The arrival phase varies from run to run, and both outcomes occur.
- **"The goal is step 149 SOLVED 0 h under all4, with no step gaining a hit":** met on the survey. But the survey does
  not contain the whole-game request that matters, and **F1 32:10 gains a hit** (refusal → 1 h).
  - That hit belongs to PKRB alone, which PKSW-HITS never measured on F1.
  - PKSW-HITS's A1 32:10 has the same request at another clock (one field, seam +2842).
- **"P1 seam +7 still 1 h (strike-stand half)":** confirmed. It is OFF's own hit, unchanged by any variant.
- **The md5 under all4:** unchanged, as the slices reported for their own switches. Confirmed.

## 9. Residue / hand-overs

1. **The strike-approach chaser stand in a press kill** (F1 32:10, PKRB ON; solver, class (a) with a budget part (d)).
   - **Witness:** re-measure-9's F1 leg 32 request 10, or A1 32:10 at seam +2842, solved with
     `SEEDLING_PRESS_KILL_REFUGE_BOMBS=1`: 926 t, 1 h `t1799 chaser:bob@272,112`. The kill's approach to its strike cell
     stands four ticks beside the chaser.
   - **Control:** A1 32:10 (seam 0) under all4 gives 651 t, 0 h.
   - **The next slice's premise:** price the press kill's strike approach and stand against chasers (PKC covers the
     hammer and landing lines, not this stand), or give hit-avoid a try beyond the window on a billed hit. Either
     must leave PKRB's leg-376/A1 gains intact.
2. **The strike-stand bomb** (P1 32:10 seam +7, `#8 t1644`): PKSW-HITS' §9 item 1, unchanged. It is OFF's own hit and
   is present in every variant.
3. **The `--solver-env` comma hazard.** `parseSolverEnv` accepts `A=1,B=1` as one name with the value `1,B=1`, and
   nothing refuses it.
   - For the solverEnvChannel owner: refuse a value that is not `0`/`1`, or one that contains `=`.
   - **The parallel re-measure-10 must pass a `;`-separated spec.** Its `SOLVER_ENV:` line should show four names, sorted
     (`SEEDLING_DASH_STAND_SIGHT=1;SEEDLING_LATCHED_HOLD_MOVE=1;…`).
4. **For re-measure-10 (all4):** expect entry 32's 640 continue to **solve with a hit** whenever its clock lands on F1's
   phase. Compare its 32:10 answer with `851256c5b984`.
5. **Owed:** nothing to dispatch. No code changed, so no train-tier run is owed by this slice. A landing still needs the
   user's own SHA-bound OK, which the planner asks for.
