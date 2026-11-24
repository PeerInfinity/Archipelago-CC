# SEEDLING HAMMER-PHASE — slice KILL880 (L40 spinner@880,848 hitless-kill search)

Session `seedling-hammer-kill880` (Opus, cloud). Planner: `seedling-hammer-phase-planning-14`. ⚖ The user approved the slice on
2026-11-23 (*"880 hitless-kill search"*). Measure first, switch-guarded OFF. Landing needs the user's SHA-bound OK through the planner.
Evidence: `CC/docs/cloud-reports/seedling-hammer-kill880-evidence/`.

## 1. SHAs

| | |
|---|---|
| Start (base) | `origin/hammer-stack-face1-meter` @ `dbf18d461fdd5881020e26b96d49856acfdd4add` (main `5aaad790eb` TRAIN 202 + FACE1 + SPINNER880, both OFF) |
| Step 1 (measure) | `f770e740` — the reproduction, the arrival-wait sweep, the refused line, the mid-line hold search, the tools |
| Steps 2–3 (change + rows) | `f7374478` — `PRESS_KILL_HOLD` (OFF), the two test files, the fixture, the regenerated solver surface, the train-shard cost row |
| Step 4 | `893fb4cd` (45-offset sweep, the 2560 retry, the p4g game witness), `72532cd6` (the P1 census, more 2560 offsets) |
| Head | the commit carrying this report (`Cloud-Status: final`) |
| Branch | `claude/kill880-hitless-search-o3k0yh` |

`origin/main` moved while I worked (`5aaad790` → `363564bf`, 9 commits: the lab watch library and the region map). Neither the
stack nor fidelity W56 landed, and none of the 9 touches the solver (`solverBot.js`, `solverEnvChannel.js`, the model files), so no
merge was owed and nothing needed re-measuring. No planner follow-up arrived (`ReadNotifications` empty).

## 2. The answer first

**Switch: `PRESS_KILL_HOLD`** (`SEEDLING_PRESS_KILL_HOLD=1`, `withPressKillHold(enabled, fn)`). It runs in the solve **worker's**
thread (and in node). No main-thread mapper reads it.

**Class (a).** A hitless line exists in the model from 19:1's t0 state, and the ladder misses it. The differing choice is
**the wait at the kill's own stand, not the approach and not an arrival wait**:
- the press kill stands still t545–635 after its first press;
- then it walks down the one-tile shaft from t636 toward its target, `spinner@880,848`, which the press knocked back down;
- the other patrolling body, `spinner@816,848`, is coming up the same shaft, and the walk meets its hammer at t654.

Hold the stand longer, and the patrol brings the body to the player.

| P1 19:1 | OFF | ON |
|---|---|---|
| request budget (640), offsets −2 / 0 / +1 | HARD `HAMMER_SAFETY`, work 112, 268–298 s | soft 640 cut, work 644, 104–126 s (the page then runs its held retry) |
| held retry (2560), offsets −2 / 0 / +1 | HARD, work 112 (no budget is reached) | **SOLVED, 1642 / 1642 / 1663 t, work 1657 / 1657 / 1614, 0 hits, 0 deaths** |
| no budget, dashless pass | HARD | **SOLVED, 1722 / 1722 / 1738 t, 0 hits**, every one on the first hold (45 ticks) |
| the other 42 offsets | unchanged (41 soft cuts, +5 solves): same answers both arms | |

- **Game witness (p4g, fresh page):** the ON plan, solved on the fresh page's staging (1722 t), played **1722 / 1722 ticks, 0 hits**.
  The end matches the model to the last digit, and all **171 sampled ticks agree at offset 0** (§ 6).
- **OFF identity:** acceptance md5 `391322d681b7aa0229d94b3f6906d024` at the base, at the head OFF, and at the head ON.
- **P1 census (147 captured requests):** 146 / 147 answers identical ON vs OFF. The one mover is 19:1, HARD → soft cut.
- **Survey `--through=end`:** 224 SOLVED / 26 REFUSED both ways. **0 verdicts moved and no step gained a hit.** Two refused L40
  steps reached the switch, and their refusal now names the hold, which was hit on its first idle (§ 5).

**The one thing to know first:** the HAMMER-PHASE rung already searches holds, but only near the corner it previews
(walk-offsets `c − 1 … 0`, holds 1 … 44). Here the rung first sees the corner at t652, 16 ticks into the walk out of the stand
and two ticks before the corner. Its stall does not clear it, and at t654 there is **no offset left to hold at ("0 tried")**. The
hold that works is at the stand the walk left, and it lasts a whole hammer period. An arrival idle does not help: idles of 1–20
ticks all refuse at the identical corner, (741.44,685.29). So FACE1's `GOAL_START_WAIT` (an idle where the goal began) cannot
reach this case. Only the re-stamped arrival clock (+5, one phase) changes the outcome.

## 3. The reproduction (measured)

**Tools** (`tools/`):
- `seam.mjs`: FACE1's tool, unchanged. It solves the captured request through the worker's dispatch at a re-stamped arrival
  clock, optionally after an arrival idle (`--wait`), and replays a solved plan on a fresh run to count its hits.
- `line.mjs`: one dashless pass with a never-true deadline hook (fine checkpoints asked). It prints the line, the bodies and the
  hits every N ticks. `--grab` recovers a `SolverBotError`'s line. Such an error carries no `perTick`, so the tool watches,
  in its own process only, every array that is pushed key sets, and keeps the one whose replay ends where the refusal says.
- `bodies.mjs`: every spinner body, unfiltered, along a line.
- `mid.mjs`: the mid-line arm of the search. It cuts a line at tick T, idles W ticks, then solves the goal again from there.
- `census.mjs` and `cmp.mjs`: SPINNER880's tools, with the arm switch changed to `PRESS_KILL_HOLD`.
- `sweep-cmp.mjs`, `retry.sh`, `sweep.sh`.
- `legwitness.mjs` and `samples.mjs`: FACE1's p4g witness tools. `samples.mjs` reads this slice's fixture.

**Reproduced at the base** (`repro/base-d{0,-2,1}.json`):

| offset | verdict | work | answer |
|---|---|---|---|
| 0 | HARD | 112 | `8ef0debe2bb9` |
| −2 | HARD | 112 | `8ef0debe2bb9` |
| +1 | HARD | 112 | `9d91691740df` |

These are SPINNER880's answers, byte for byte, and the page's for 0. The +5 arrival solves dashless (1284 t, work 641, 0 hits,
`repro/base-d5.json`).

**The refused line** (`search/line-d0.txt`, `search/keys-d0-refused.json`; −2 and +1 are the same shape, `line-d-2.txt`,
`line-d1.txt`). The kill rung is entered at t0.
- The walk to the shaft top: the player waits at (728.3,679.6).
- The spinners patrol a loop through the corridor and up the one-tile shaft at x ≈ 744.
- The press lands on `spinner@880,848` at t530. That body arrives first, is knocked back, and goes down the shaft again.
- t545–635: the player stands at (744.2,664.2), while `spinner@816,848` climbs toward it (y 765 → 691).
- t636–653: the kill walks `down` toward its target, into 816's hammer. At t654 every key set lands on the line:
  *"There is no step out … the HAMMER-PHASE rung first saw this corner at t652, and from t654 NO PHASE admits a step: no hold of
  1..44 tick(s) at any walk-offset -1..0 (0 tried)"*.

Key runs of the refused lines (`search/`):

| offset | press | stand | walk down | corner |
|---|---|---|---|---|
| −2 | t530 | t545–635 | t636–653 | t654 |
| 0 | t530 | t545–635 | t636–653 | t654 |
| +1 | t530 | t544–635 | t636–652 | t653 |

**The search** (bounded, measure only):

| arm | what was tried | result |
|---|---|---|
| arrival wait (`search/wait-d0.jsonl`) | idle W ticks at the arrival, then the request, W = 1 … 20 (stopped there to free cores) | **20/20 HARD at the identical corner (741.44,685.29)**: the patrol and the stand are invariant to the arrival delay |
| hold at the kill's start (`mid-d0-527.jsonl`) | the refused line to t527, idle W = 50 … 400 | every idle is **hit** (the arriving body reaches the standing player) |
| hold in the stand (`mid-d0-630.jsonl`) | the refused line to t630, idle W, the goal solved again | W 0, 50: refused, the ladder EXHAUSTED on `bobsoldier@880,832` · **W 100: SOLVED 1526 t total, 0 hits, 0 deaths** · **W 150: SOLVED 2003 t, 0 hits** · W 200, 250, 300: the idle is hit |
| hold at the stand's end, the kill redone (the switch, `on/line-d{0,-2,1}-on.txt`) | rewind to t636, idle 45 · 90 · 135 · 180, the press kill re-admitted and redone | **the first hold (45) kills hitless at all three HARD offsets**, and the segment then solves (1722 / 1722 / 1738 t, 0 hits) |

The first hitless line found is the refused line's own first 636 ticks, then 45 idle ticks, then the redone kill and the rest
of the goal: 1722 t, 0 hits, 0 deaths (`on/keys-d0-on.json`). Class **(a)**: the ladder's stand is right, and so are the approach
and the stance (the line keeps them). What differs is that the ladder leaves the stand on its own schedule, walking into a body
the patrol is bringing, instead of letting the patrol bring it.

## 4. Design and change; OFF identity

**`PRESS_KILL_HOLD`** (`solverBot.js`, beside `execKillByPress`). New functions plus one call site in `execKillByPress`, no
reformatting:
- `execKillByPressHold(run, perTick, resolved, ctx, dispatch)` wraps the kill's own dispatch (the OPP or fight fallback chain,
  unchanged). It acts only on a `SolverBotError` coded **`HAMMER_SAFETY`** that comes out **after** every fallback already inside
  the kill, in a segment that can rewind (`ctx.rewind`), with no deadline tripped.
- `lastStandEnd(keys, from)` finds the kill's last stand on its own keys: the last no-key tick in `[kill start, refusal)`, plus 1.
  If the kill never stood, or the refusal is on the stand itself, nothing is asked.
- For each `k` = 1 … `maxPeriods` (4):
  1. rewind to the stand's end;
  2. idle `k × HAMMER_PHASE_RUNG.horizon` ticks with no keys;
  3. admit the kill again on the held run (`derivePressKill` from the admission's own inputs, as the existing fallbacks do) and
     redo it.

  An idle tick that is hit, dies or crosses a door ends the search (a longer idle contains it). A redo that refuses, or kills with
  any player hit since the rewind (`playerHitsSince` on the replayed run), is undone. The first hitless kill is kept and noted on
  the rewind (`how: 'press-kill-hold'`).
- All refused: the original refusal is thrown, with its words unchanged plus one sentence naming the holds and their outcomes.
- The idles are **whole hammer periods** (the rung's own derived horizon), so the hammer's phase when the walk restarts is the
  phase the stand ended on. Only the patrol has moved. No level, coordinate, entity id or Seedling constant is read.
- Instrument: `PRESS_KILL_HOLD_COUNTS.rows` (`{t, stand, refusedAt, tries: [{wait, verdict, why}], verdict}`).

Other edits:
- `solverEnvChannel.SOLVER_ENV_NAMES` gains `SEEDLING_PRESS_KILL_HOLD`.
- `seedling-solver-surface.json` is regenerated (374 rows; one constant's site count, 5 → 6).
- `train-shard-costs.json` gains the train file's local row (258 s).

**How it relates to FACE1's `GOAL_START_WAIT`:** it is a different mechanism, not a parallel copy of it, so I did not extend
GOAL_START_WAIT. They differ on every axis:

| | GOAL_START_WAIT | PRESS_KILL_HOLD |
|---|---|---|
| trigger | a clear-tag goal's EXHAUSTED ladder | a press kill's `HAMMER_SAFETY` |
| rewind point | the goal's first tick | the kill's last stand |
| what is asked again | the whole goal | the kill |

GOAL_START_WAIT cannot reach this case: the goal is a contact goal, and arrival idles do not move the corner (§3).

**Acceptance md5** (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):

| run | md5 |
|---|---|
| base `dbf18d46` | `391322d681b7aa0229d94b3f6906d024` |
| head, OFF | `391322d681b7aa0229d94b3f6906d024` |
| head, ON | `391322d681b7aa0229d94b3f6906d024` |

## 5. Rows and bounded vitest; ON vs OFF measurements

**Rows:**

| file | tier | rows | result | what it pins |
|---|---|---|---|---|
| `frontend/modules/seedlingDemo/pressKillHold.test.js` | fast | 4 | 4/4 passed | ships OFF and is in the env table; the idles are whole periods; `withPressKillHold` restores (also on a throw); `lastStandEnd`'s cases |
| `frontend/modules/seedlingDemo/hammerKill880StandHold.train.test.js` | train | 2 | 2/2 passed, 258 s (OFF 119 s, ON 135 s) | the captured request (fixture `fixtures/hammer-kill880/P1-19-1-request.json.gz`), dashless pass. OFF at its own budget: refused `HAMMER_SAFETY` "There is no step out", no hold asked. ON at 2560: solved; the kept redo held a whole number of periods at the stand; the plan re-driven on a fresh run takes 0 hits and 0 deaths, 0 row mismatches |

Other bounded runs:
- `solverEnvChannel.test.js`: 11/11.
- `scripts/test/trainShardPlan.test.js`: 21/21.

Regenerated, each `--check` green: `census-seedling-solver-surface.mjs` (374 rows), `generate-procgen-reference.mjs`,
`generate-docs-index.mjs`. No docs edit under `docs/json/developer/procgen/`, so no link-census pins are owed.

**19:1 at all 45 arrival offsets, request budget 640** (`on/sweep19-on.jsonl`, `on/sweep19-cmp.txt`). The OFF arm is SPINNER880's
`sweep19.jsonl` at main + PREVIEW_METER, both OFF. I re-measured three of its offsets on this head OFF and got the same answers.

| move | offsets | detail |
|---|---|---|
| cut → cut, same answer | 41 | `668f4ca7aff6` both arms |
| SOLVED → SOLVED, same answer | 1 | +5: 1284 t, work 641, 0 hits |
| **HARD → soft cut** | 3 | −2, 0, +1: work 112 → 644, node wall 268–298 s → 104–126 s |

No offset solves at 640 ON that did not OFF: the hold plus the redo costs 789 / 756 work units on the dashless pass, over 640.

**19:1 at the held retry (2560)** (`on/on-d0-2560.json`, `retry/retry-{on,off}.jsonl`):

| offsets | arm | result |
|---|---|---|
| −2, 0, +1 | ON | **solved hitless**: 1642, 1642, 1663 t (the full pass); work 1657, 1657, 1614; 196–218 s node |
| −2, 0, +1 | OFF | HARD at work 112 whatever the budget, so the retry cannot help |
| −22, −11, +11, +22 (cut at 640) | both | solve at 2560 with identical answers: 1022, 1360, 1153, 1127 t, 0 hits |

**P1 census, 147 captured requests** (`census/census.jsonl`, `census/census-compare.txt`):
- OFF reproduces the page's own answer on 146 / 146. 26:11's page answer is the backstop's cancel.
- ON vs OFF: **146 / 147 identical answers**. The one mover is 19:1, HARD (work 112) → soft cut (work 644).
- 26:11 is the same 640 cut in both arms (`432ec5f5b196`).
- Total node wall: 1,647 s OFF, 1,448 s ON. The difference is mostly 19:1 itself: 268 s → 123 s.

**Survey `--through=end`** (`survey/`; the survey solves without a budget, so the switch CAN reach a survey step whose press kill
refuses `HAMMER_SAFETY`), `survey/end-{off,on}.{json.gz,log}`, `survey/diff-on.txt`:
- 224 SOLVED / 26 REFUSED both ways. **No step changed its verdict or its ticks, and no step gained a hit.**
- 2 REFUSED steps reached the switch. Each one's refusal text gained the hold's sentence, and nothing else changed. In both, the
  first 45-tick idle at the kill's stand was hit, so the search stopped and the original refusal stands:
  - step 96, `L40 flag 12: wandlock@480,560 cleared + Level 040 - Boss Key 2` (stand t2748);
  - step 149, `L40 flag 7: wandlock@208,128 cleared + Level 040 - Totem Part 64,144` (stand t1610).

## 6. Page play / game witness (p4g, fresh page)

`tools/legwitness.mjs` (FACE1's, unchanged) ran headless and logic-only on `seedling_bot_ap_p4g`, with the delivered set,
under the box lock. I started `serve-nocache.py` on 8000 for it and stopped it by PID afterwards. The fresh page builds its slot
array from the held items, so the plan is solved on that staging.
- `--solve` with `PRESS_KILL_HOLD=1`, dashless: **1722 t, work 789**.
- The same staging OFF refuses: work 56, the `HAMMER_SAFETY` "no step out" text (`game/p1-19-1-off-solve.log`).

| | model | game |
|---|---|---|
| ticks | 1722 | **finished 1722 / 1722** |
| hits | 0 | **0** |
| end | (887.0863670247373, 824.3809776189489) | **(887.0863670247373, 824.3809776189489)** |
| flags earned (not staged) | — | 40:13, 40:16 (cleared on the way; not in the staging's persistence) |
| samples | | **171 sampled ticks, 0 diverging at offset 0** (offsets −1 / +1: 81 / 83 diverge) |

Files: `game/p1-19-1-on-{plan.json,solve.log,play.log,samples.txt}`, `game/p1-19-1-on.{game,tape}.json`,
`game/p1-19-1-off-solve.log`.

## 7. Census: which seed-1 divergence-sweep legs the change can move, and why

**The reach condition.** All four must hold:
1. a **press kill** refuses `HAMMER_SAFETY`;
2. it does so after its own OPP and fight fallbacks;
3. it is in a segment with a rewind (`forkRun`: every `solveFromTape` solve, so the page, the sweep, captured requests and the
   survey);
4. no deadline has tripped, and the kill stood at least once before the walk that refused.

Every other solve never enters the new code, and its bytes are OFF's (acceptance ON = OFF).

**Measured, by key:**
- **Moves: `Level 040 - Chest`** (P1 19:1, the 880 arrivals of `apitem (880,816) contact`).
  - At the 640 pass, HARD → soft cut, so the page runs its held 2560 retry, which now solves hitless (1642–1663 t).
  - Of P1's 147 captured requests, it is the only one whose answer is a press-kill `HAMMER_SAFETY` refusal, and the only mover.
- **Reached, verdict unchanged (survey):** two refused survey steps, by key:
  - `L40 flag 12: wandlock@480,560 cleared + Level 040 - Boss Key 2` (step 96);
  - `L40 flag 7: wandlock@208,128 cleared + Level 040 - Totem Part 64,144` (step 149).

  The hold's first idle is hit in both, so each refusal is the OFF one plus one sentence.
- **Reached in the P1 census, answer unchanged:** none found. P1's other 25 legs (146 requests, among them `Level 040 - Boss Key 2` 26:x,
  `Level 025 - Chest`, `Level 029 - Boss Key 1`, `Level 030 - Torchpickup`) give identical answers ON. Any `HAMMER_SAFETY`
  inside them is either absent or caught before the press kill's own dispatch returns.
- **Can move elsewhere:** any sweep leg whose OFF answer is a press-kill "There is no step out" refusal after a stand. I did not
  run the divergence sweep (the brief: no full sweeps).
  - The L40 legs by key that SPINNER880 named (`level_40__… flag12-L39`, `chest-L39`) solve OFF per the L40-PAIR evidence, so they
    are not refusals the switch answers.
  - I have no measured list of the sweep's other press-kill `HAMMER_SAFETY` legs on this base. Collecting that list (the
    sweep's refusal texts by key) is the planner's first re-check before any flip.

## 8. What the brief got wrong (measured)

- *"nobody searched for a different approach from 19:1's t0 state"*: the approach is not what differs. The hitless line keeps the
  ladder's approach, stance and first press. What differs is how long the kill holds its stand before walking out of it (§3).
- *"one phase 4 ticks later solves, so the approach choice is suspect"*: the +5 solve is real, but it does not come from a
  different approach. The bodies' patrol positions over t0…t520 are the same at every arrival offset (the clock only turns the
  hammer). At +5 the kill's walk out of the stand happens to meet the climbing body at a clear phase.
- The class question resolved as (a) without a game witness of a refusal: the model admits a hitless line, so (b) and (c) are
  moot, and the p4g witness of the newly solved plan agrees with the model on every sample.
- The brief's "wait before the approach" is the FACE1 shape. Measured: arrival idles of 1–20 ticks refuse at the identical corner.

## 9. Residue and hand-overs

- **Budget:** at the request's own 640 the hold plus the redo does not fit (dashless 789 / 756 work). ON turns the HARD refusal
  into a soft cut, and only the page's held 2560 retry solves it.
  - That retry takes 196–218 s node here (contended 4-core box), under the page's 300 s backstop but not by a wide margin.
  - With SPINNER880's `PREVIEW_METER` ON as well, the retry's work count rises. I did not measure the two switches together.
    That is the planner's before a flip of either.
- **Before any flip:**
  - the divergence-sweep legs by key, ON vs OFF, especially the other press-kill `HAMMER_SAFETY` legs (§7);
  - the page path end to end (the held retry under the backstop);
  - the pair with `PREVIEW_METER`.
- **No fidelity hand-over.** Nothing shows the model is wrong: the p4g witness agrees on all 171 samples, at offset 0.
- **Not tried:** holds shorter than a period, and stands earlier than the last one. Whole periods at the last stand were the first
  derivation, and they solved every HARD offset on the first try. A refusal whose corner is not one tick out of a stand still
  refuses, by name, with the holds tallied.
