# Seedling HAMMER-PHASE L371 — why L40 leg 371's press kill refuses 4 times in 5 (measure only)

Slice `seedling-hammer-l40-leg371` (Opus, cloud), planner `seedling-hammer-phase-planning-2`. ⚖ User approval of
2026-10-24 (*"Yes, I approve launching all of these"*). Measure first; no solver logic was changed. Evidence is in
[`seedling-hammer-l40-leg371-evidence/`](seedling-hammer-l40-leg371-evidence/).

## 1. Where this ran

| | |
|---|---|
| Start SHA | **`f9342f25b8`** (= `origin/main` at the fetch; `bombBlastBody` ON, both press-kill guards ON, `movingWait` ON) |
| Head | the commit that adds this report. Before it: `5eef47ad` (W0 + M1 + the tools), `f76fd4a6` (M2 + censuses), then the radius / repeat evidence |
| Branch | `claude/seedling-l40-leg371-x7f5um`: the session's designated branch, not the brief's `seedling-hammer-l40-leg371`. It holds this report and its evidence only. Nothing went to `main` |
| **The leg's KEY** | **`level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144`**. At this base its id is still **371**. It is BW's "381" and WANDHOLD's "371" |
| Box | 4 cores, at load 7–15 most of the time, so every wall here is relative. Answers, units and ticks are box-independent (§4.3) |
| Dev server | `serve-nocache.py 8000`, PID 1080, killed by that PID once the last browser run ended |

## 2. The answer

**Cause class: (a) hammer solver logic.** The press kill's **strike dwell is priced against the hammers only, not
against the lobber's bombs.** The kill stands on its strike cell waiting for the press. `bombpusher@112,128`'s bomb is
aimed at that standing player and explodes on it:
- the hit's knock-back corners the player: `HAMMER_SAFETY`, *"every key set … lands … There is no step out"*, corner
  at **t1339**, bomb `#11`;
- or the blast kills the player, and the reboot guard refuses at that death (t1386 `#12`, t1524 `#15`).

**The one switch that decides it: `pressKillCost.PRESS_KILL_BOMBS`** (BW's, OFF since BW; `SEEDLING_PRESS_KILL_BOMBS=1`).
ON, `deriveStrike` skips a strike window whose dwell or train meets a forecast blast (`strikeStandBlast`), and
`deriveRefuge` skips a refuge whose walk or wait does (`refugeBlast`).
- **Alone it removes every press-kill corner on this leg:** 17 of 45 phases went to 0, and 15 of those 17 now SOLVE.
- It **raises the leg from 8 of 45 arrival phases solving to 22 of 45**.
- **Across all 47 captured L40 requests it moves only leg 371.**

This is BW's own case, met again. BW measured exactly this hit on this leg (its "381", t1156 `#7`), built the fix, and
stopped one blocker short: the Explosion's unmodelled "Enemy" arm, which `bombBlastBody` now models (ON since
`f9342f25b8`). `movingWait` (ON) was BW's other precondition. Both preconditions have since shipped, but the switch
itself was never flipped, so BW's licence question is still open.

**Why "4 in 5": the arrival's hammer phase.** The answer is a function of `seam.time mod 45`, where 45 is
`SPINNER.hammerPeriod`. It is not nondeterminism: every seam is byte-stable on a repeat.
- 8 of 45 phases solve (17.8 %); CI's solving seam 5286 is one of them.
- Of the other 37:
  - 19 refuse inside the press kill on `spinner@192,160`: the bomb-on-the-dwell case above;
  - 16 throw the camera's shake band inside the **earlier** press kill on `spinner@192,128`, in its REFUGE preview.
    That is LB's hand-over 5b, which the shake guard does not cover;
  - 2 refuse elsewhere.

**Recommendation (the user's call):** flip `PRESS_KILL_BOMBS` ON (default), in its own slice, with the re-pins the
flip slice measures. Optionally take `STRIKE_ETA_FLOOR` with it (both ON: 30 of 45), as its own A/B. §6 has the
proposal and the cost.

## 3. W0 — the base and the reproductions

| row | result |
|---|---|
| base | `git checkout -B claude/seedling-l40-leg371-x7f5um origin/main` → `f9342f25b8` |
| bootstrap | `session_bootstrap.sh --seedling` → `READY`, node v22.22.0. Six submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each. No gitlink moved |
| switches at the base | `PRESS_KILL_SHAKE_GUARD` / `PRESS_KILL_REBOOT_GUARD` **ON**, `bombBlastBody` **ON**, `movingWait` **ON**, `HAMMER_ESCAPE` ON; `STRIKE_ETA_FLOOR` **OFF**, `PRESS_KILL_BOMBS` **OFF**, `HAMMER_APPROACH` / `HAMMER_FIGHT(_FALLBACK)` OFF |
| leg list | `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks` (928 legs); the key is at id 371 |

**Six page reproductions.** Each was `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver
--page=seedling_bot_ap_p4g --page-legs=1 --ids=371 --capture-requests=…` (`w0/page-reps.tsv`). A seventh sample came
from the L40 capture (§5). **All seven refuse.**

| rep | page seam | wall | the page's answer (the best of the two passes) | the dashless pass, where it differs |
|---|---|---|---|---|
| 1 | 5242 | 18.6 s | EXHAUSTED at `hold stance (wandlock@176,80)`, `bomb:bombpusher@112,128#10` | **`kill (spinner@192,160) by press`: the player died at t1386 (bomb `#12`), `PRESS_KILL_REBOOT_GUARD`** |
| 2 | 5254 | 17.3 s | EXHAUSTED at `break stance (breakablerock@176,128)`, `spinner:spinner@192,160`'s hammer | — |
| 3 | 5218 | 13.3 s | `chaserForecast`: the `Game.shake` band (`bob@320,112`) | — |
| 4 | 5187 | 43.4 s | **`kill (spinner@192,160) by press`: HAMMER_SAFETY, "There is no step out"**, corner at t1339 | — |
| 5 | 5226 | 21.2 s | `chaserForecast`: the `Game.shake` band (`bob@272,112`) | — |
| 6 | 5209 | 29.3 s | EXHAUSTED at `break stance`, `spinner:spinner@192,160` | — |
| 7 (L40 capture) | 5219 | — | `chaserForecast` shake band / EXHAUSTED on `spinner@192,144` | — |

- **The six captured requests differ in nothing but `staging.seam.time`** (a field-by-field diff), so a seam census
  on one request is sound.
- **The page = node, unit for unit, on all six** (`w0/page-vs-node.txt`). For example, 5242 is 547 units
  [dashless 93, full 454] on the page and in node, and 5254 is 249 [124, 125] in both.
- **The repeat at a fixed seam:** 5242 replayed twice in node gives 1 answer (`8b264b17`) and 1 progress trace
  (`06940d1a0ce0`) over 2 runs (`w0/node-repeat-5242.jsonl`).

## 4. M1 — the seam census

### 4.1 Method
- **Instrument:** `tools/l371-solve.mjs`. It replays one captured request in the worker's way (`solveAnytime`, the
  request's own budgets) at `--seam=<t>` (`atSeamTime`: only `seam.time` moves).
- **What it prints:** per pass, the full refusal text, its obstacle and its `progressKind`; the solveProgress v:2
  snapshot at the pass's last `done` (tree `rejectionKinds`, `lastWhy`, `frame`, `asks`); the guards' counters; and the
  answer's sha. The sha is the same formula as `replay-seedling-solve-request.mjs`'s.
- **Driver:** `tools/census.sh`: **one fresh node process per seam**, the switches by env.
- **Classes** are read off the answer's own words (`tools/cls.py`).
- **Range:** 5180–5296, 117 seams. That covers all seven page seams and the CI's solving 5286.

### 4.2 The default arm (`m1/census-default.txt`, all 117 rows)

**It is periodic in the hammer period.**
- Of the 72 pairs (s, s+45) in range, **70 give the identical answer** (class, sha, units).
- The other 2 (5209/5254 and 5219/5264) have the same class and units, and differ only in a coordinate in the text.
- So the answer is a function of `seam.time mod 45`.
- **8 of 45 phases solve**: phases 21 and 36–42, for example seams 5196 / 5241 / **5286** (`090b838e`, 1603 t) and
  5212–5217 / 5257–5262.

One period (5226–5270), by the dashless pass's class:

| class (where) | phases | example | units |
|---|---|---|---|
| **SOLVE** | **8** | 5241: full pass 1603 t; 5258: dashless 1775 t / full 1681 t | 314–641 |
| **HAMMER_SAFETY inside `kill (spinner@192,160) by press`**, corner first seen at t1339 | **17** | 5230 | 177 (88 + 89) |
| **shake-band throw** (`chaserForecast` … `Game.shake`), inside the t1112 press kill's refuge preview | **16** | 5226 | 165 (82 + 83) |
| **reboot refusal inside `kill (spinner@192,160) by press`**: the player died at t1386 (`#12`) or t1524 (`#15`), bomb | **2** | 5242, 5255 | 547, 187 |
| deadline (640 units, the walk to the hold stance) | 1 | 5243 | 642 |
| EXHAUSTED at the break stance (`spinner@192,160`'s hammer) | 1 | 5254 | 249 |

Over all 117 rows: 17 solves, 51 rows where `HAMMER_SAFETY@kill t1339` is the dashless class, 39 shake throws, 5 reboot
refusals, and the rest named refusals. The full pass often has another class: the paced hold's own *"no pacing is
clean (MOVING_WAIT)"* on a bomb, or a corridor EXHAUSTED on a bomb.

### 4.3 Stability
- **Byte-stable on a repeat:** the official tool, `replay-seedling-solve-request.mjs --seam-time-sweep=-16..20
  --jobs=3`, run separately over 5226–5262, gives the same kind, answer sha and work units on **37 of 37** seams
  (`m1/repeat-official.txt`). It names 16 distinct answers: *"VARIES WITH seam.time"*.
- Every census row ran in its own process.
- **Answer to the brief's question:** the 1-in-5 solve is a **seam-time (hammer-phase) effect**. There is no
  nondeterminism at a fixed seam.

### 4.4 The other arms over one period, plus a 10-seam overlap (5226–5280)

| arm (env, alone unless said) | phases solving of 45 | default solves lost | file |
|---|---|---|---|
| default | 8 | — | `census-default.txt` |
| `SEEDLING_PRESS_KILL_BOMBS=1` | **22** | 3 of the 8 phases (5257–5261: deadline / paced hold, after the kill) | `census-pkb.txt`, `transitions-default-pkb.md` |
| `SEEDLING_STRIKE_ETA_FLOOR=1` | 22 | 3 (5257–5259) | `census-sef.txt`, `transitions-default-sef.md` |
| both of the above | **30** | 3 (5257–5259) | `census-both.txt`, `transitions-default-both.md` |
| `SEEDLING_HAMMER_APPROACH=1` | 19 | **7 of 8** | `census-ha.txt`, `transitions-default-ha.md` |

All four arms are periodic in 45 as well (every s / s+45 pair in range equal).

## 5. M2 — the cause

### 5.1 The mechanism, traced
**Tool:** `tools/l371-trace.mjs`, through the solver's own read-only probe `REWIND_PROBE`. Its sink receives the live
inner run before each tape tick and at each press kill's start; nothing the solver reads is written. Files are in `m2/`.

**Seam 5230 (refusing), the dashless pass:**
1. `kill (spinner@192,160) by press` starts at **t1236** (the body has h1). It is after the paced hold, inside the
   walk `hold stance (wandlock@176,80) → break stance (breakablerock@176,128)`.
2. From about t1320 the player stands on the strike cell **(248.39, 104.39)**, waiting for the press.
3. `bombpusher@112,128#11` spawns at t1308, aimed at that standing player. It explodes at **(251, 116) on t1339**, on
   the player: `playerHits` 0 → 1, and a `body-hit` on `bob@272,112` (`bombBlastBody`).
4. The knock-back puts the player at (248.39, 94.18). There, every key set meets a body rect or the hammer line:
   `HAMMER_SAFETY`, with the HAMMER-PHASE rung's *"from t1342 NO PHASE admits a step"*.
5. The **reboot** rows are the same event a bomb later, where the blast kills the player instead (5242: t1386 `#12`).

**The same seam under the two switches that solve it.** Both kill `spinner@192,160` by press at about t1354 (h3) with
**0 player hits**:
- `PRESS_KILL_BOMBS=1`: the dwell moves by under a pixel, to (247.61, 104.21), and `#11` lands at (251, 119), off the
  player. The plan has 1877 ticks.
- `STRIKE_ETA_FLOOR=1`: a different strike cell, (264, 88), where `#11` lands at (268, 117). 1736 / 1890 ticks.

**Seam 5241 (solving):** the full pass kills `spinner@192,128` at about t1247 and never presses `spinner@192,160`. It
walks the part with the body still at h2 (1603 t). The solving phases are the arrivals where the kill on
`spinner@192,160` is not needed, or meets no bomb.

**The shake throws (5226):** the throw is built in `onScreenAt ← previewWalk ← deriveRefuge ← refugeNow ← noStrikeMove
← execKillByPressOnce` (`m2/stack-5226-escaping-throw.txt`), inside the t1112 press kill. At t1246 its target
`spinner@192,128` has just taken its third hit, and bomb `#9` explodes at t1247, shaking the camera.
`PRESS_KILL_SHAKE_GUARD` catches this throw in `deriveStrike` (10 catches on this seam) but not in `deriveRefuge`.
That is LB's hand-over 5b exactly. There is no player hit on this path.

### 5.2 The switch-by-switch table (`m2/switches-table.md`, one fresh process per cell)

Each cell is the answer's class (dashless / full where they differ) and its work units. `=` means identical to the
default (sha and units).

| arm | 5202 | 5210 | 5219 | 5226 | **5230** | **5241 (solves)** | 5242 | 5243 | 5254 | **5258 (solves)** |
|---|---|---|---|---|---|---|---|---|---|---|
| **default** | HS@kill t1339 / paced hold (204) | reboot@kill t1524 `#15` (187) | shake / EXH `spinner@192,144` (298) | shake (165) | **HS@kill t1339 (177)** | **SOLVE 1603 t (315)** | reboot@kill t1386 `#12` / EXH hold `#10` (547) | deadline (642) | EXH@break (249) | **SOLVE 1681 t (314)** |
| reboot guard OFF | = | STRIKE_BOUND@kill / deadline (641) | = | = | = | = | hold refusal / deadline (642) | = | = | = |
| shake guard OFF | = | = | = | = | = | SOLVE 1603 t (307) | shake / EXH hold `#10` (545) | = | = | = |
| `bombBlastBody` OFF | = | `levelRun`: the Explosion of `#11` … t1339 (unmodelled) (175) | = | `levelRun`: `#9` … t1247 (165) | `levelRun`: `#11` at (251,116) t1339 (177) | = | = | = | = | = |
| **`STRIKE_ETA_FLOOR` ON** | = | = | HS@break (165) | = | **SOLVE 1736 t (328)** | SOLVE 1888 t (539) | **SOLVE 1888 t (539)** | = | shake (179) | shake (169) |
| `HAMMER_ESCAPE` OFF | = | = | = | = | = | = | = | = | = | = |
| `movingWait` OFF | refused at the first hold (143) | (143) | (143) | (143) | (143) | **(143)** | (143) | (143) | (143) | **(143)** |
| **`PRESS_KILL_BOMBS` ON** | **SOLVE 1838 t (329)** | EXH@break `#10` (253) | shake (169) | EXH hold `#10` / deadline (642) | **SOLVE 1877 t (561)** | SOLVE 1820 t (450) | deadline / deadline (642) | shake / deadline (641) | = | paced hold `#11` / deadline (641) |
| `HAMMER_APPROACH` ON | SOLVE 1628 t | SOLVE 1610 t | SOLVE 1595 t | paced hold / deadline (642) | paced hold / deadline (642) | shake (217) | shake (217) | shake (215) | SOLVE 1610 t | shake (215) |
| `HAMMER_FIGHT_FALLBACK` ON | HS / paced hold (205) | = | shake / deadline (642) | = | paced hold / **divergence** *"the solve returned 1657 key set(s) but the shadow advanced 1342"* (425) | = | = | = | EXH@break (327) | = |

(HS is `HAMMER_SAFETY`; EXH is EXHAUSTED.)

### 5.3 Reading it, switch by switch
- **The press-kill guards are not the cause.**
  - The reboot guard OFF turns its two rows into another refusal (5210: STRIKE_BOUND; 5242: the hold) and moves
    nothing else.
  - The shake guard OFF moves units, not classes (5241 still solves). At 5242 it lets the band throw escape.
- **`bombBlastBody` is not the cause; it is a precondition.** OFF, every blast-on-a-body row throws the Explosion's
  unmodelled "Enemy" arm (`levelRun`) instead of refusing. That is the wall BW stopped at.
- **`STRIKE_ETA_FLOOR` (the brief's "does the floor make it solve?"): yes, at some seams.**
  - Alone: 22 of 45. It solves 5230 and 5242 by choosing a different strike (a faster measured ETA), not by seeing
    the bomb. So 3 of the t1339 corners and a t1524 death stay, and it loses 3 default solves.
  - With `PRESS_KILL_BOMBS`: 30 of 45.
- **The hammer escape: no effect** (`=` on all ten seams).
- **The chaser / the paced hold's exit state:**
  - `movingWait` OFF refuses every seam at the first hold. It is a precondition, not the cause;
  - the chaser (`bob@272,112`) appears only as a blast's second body.
- **`PRESS_KILL_BOMBS` is the one switch that alone removes the mechanism.**
  - In the period census, no `HAMMER_SAFETY@kill` row is left (17 → 0) and no reboot-at-kill row (2 → 0).
  - What remains is downstream of the kill: the paced hold or the corridor meeting a bomb, the 640-unit budget, and
    the refuge shake band.
- **`HAMMER_APPROACH` and `HAMMER_FIGHT_FALLBACK`** (off-default, not in the brief's list) change trajectories, not the
  mechanism. Approach loses 7 of 8 default solves. Fight-fallback produces a **shadow divergence** at 5230, a finding
  for its owner and not for this leg.

## 6. M3 — the recommendation

**The class is (a), hammer solver logic.** The function is `execKillByPressOnce`'s strike dwell together with
`deriveStrike` / `deriveRefuge`, in `solverBot.js`. The honest fix already exists, and it is measured: BW's
`PRESS_KILL_BOMBS` (`pressKillCost.js`), off since BW.
- It is not (b): the bomb's aim and blast are the model's own, and BW's p4f witness agrees with the game to the bit,
  including a hit like this one.
- It is not (c): the arrival is the page's own, and the page = node unit for unit.
- It is not (d): 15 of the 17 corner phases solve when the dwell sees the bomb. A safe kill exists from those
  arrivals.

**The blast radius.**
- The arm reads nothing in a room with no lobber and no bomb (`bombsInPlay`), and **only one level file holds a
  BombPusher** (`vendor/seedling/assets/levels/Dungeon4/2.oel`, L40).
- **L40, measured:** I captured all 42 L40 legs on the page (one arrival each, 47 solve requests: 29 done, 10 failed,
  3 timeout) and replayed each request in node at its own seam, default vs ON (`radius/`):
  - `PRESS_KILL_BOMBS` ON: **46 of 47 requests are identical**; the one mover is leg 371 itself (refusal → another
    refusal at that arrival, 298 → 169 units);
  - `STRIKE_ETA_FLOOR` ON: 44 of 47; it moves 371 and the two chest legs, 387 and 404, refusal → refusal.
  - Neither loses a solve on any captured request.
- **On 371 across arrivals** (§4.4):
  - `PRESS_KILL_BOMBS` gains 17 phases and loses 3 of the 8 (5257–5261). The losses are AFTER the kill, at the paced
    hold or a deadline, because the ON kill reaches it on another bomb phase. Net +14.
  - The same holds for both ON (+22 net).
- **A flip must re-pin** what BW's gate pins OFF (`hammerPressBombs`, 8 rows, its "ships OFF" row; the
  `hammer-bw-bombstand` witness) and anything else the flip slice's bounded set shows. **I measured none of those**
  (no vitest here, ⚖ 52: the next slice runs them).
- **The page cannot see the env switch** (BW's residue 6). Only a default flip reaches the sweep's worker.

**Next-slice proposal (for the user):**
1. **PKB-FLIP** (hammer, small). Flip `PRESS_KILL_BOMBS` ON by default, the way GF flipped the guards:
   - first run the bounded set naming `pressKillCost` / `hammerPressBombs` / `execKillByPress`, and the producer
     roster, ON;
   - then re-pin the "ships OFF" rows and whatever else moves;
   - then a CI divergence sweep on the L40 keys ×5 (or a seam census on 371) to confirm about 22 of 45 on the page.
   - Expected on the page: 371 solving at about half of all arrivals, against 18 % today.
2. **Optional, alongside:** `STRIKE_ETA_FLOOR`'s own flip is already queued after GF ("STRIKE_ETA_FLOOR after, in its
   own slice"). With both ON this leg is 30 of 45. It is a TAPE MOVE by its own docblock, so it stays its own A/B.
3. **For the shake-band phases** (16 of 45 today; with both ON, 9 of them solve and 1 shake row is left, while the
   rest move to break-stance refusals): LB's hand-over 5b, the refuge preview's
   band catch in `deriveRefuge` (the shake guard's shape, one call over). This leg's request at seam 5226 is the gate
   state LB said 5b was waiting for (`w0/req-r1.jsonl` → `atSeamTime(…, 5226)`; the capture is 530 KB, in the session
   scratchpad, not committed).

## 7. What the brief got wrong (measured)

1. **"refuses at `kill (spinner@192,160) by press` in 4 of 5"** is half the picture.
   - 19 of 45 phases refuse there.
   - 16 of 45 throw the shake band inside an earlier press kill, on `spinner@192,128`, before the kill on
     `spinner@192,160` starts.
   - The page shows the best of two passes, so a press-kill refusal in the dashless pass often appears on the row as
     the full pass's hold or break refusal. Rep 1 is an example: the row reads "EXHAUSTED at the hold", and the
     dashless pass died in the kill.
2. **"It solved once, at seam 5286"** is not a one-off. 5286 solves here too (`090b838e`, 1603 t), as do 5196 and
   5241: the answer repeats every 45 ticks. 8 of 45 phases solve, which fits 1 in 5.
3. **The candidate list missed the deciding switch.** None of the guards, `bombBlastBody`, the escape or the chaser
   decides it. `PRESS_KILL_BOMBS`, which the brief does not name, does. `STRIKE_ETA_FLOOR` does too, at some seams,
   and by another route.
4. **"`spinner@192,160` is the body that bw-bombstand's `#11` blast kills."** At this leg's refusing arrivals, `#11`
   lands on the player (and on `bob@272,112`), not on `spinner@192,160`. The ON solves kill that spinner by press.
5. Leg id: still **371** at this base, so the brief's id was right. The key is in §1.
6. The bootstrap again left six submodules uninitialised after `READY` (as in LB, GS).

## 8. Residue

1. **The licence question: flip `PRESS_KILL_BOMBS`** (BW's question, never answered).
   - Its preconditions (`bombBlastBody`, `movingWait`) are now ON.
   - Measured movers on L40: leg 371 only.
2. **Not measured here:** the bounded vitest set and the producer roster under `PRESS_KILL_BOMBS` ON (the flip
   slice's), and a CI census. The cloud gets 403 on `workflow_dispatch`, and the planning-12 CI samples (runs 583–586
   at `fidelity-harvest/wandhold` `9ad5740d`) were not read here.
3. **`HAMMER_FIGHT_FALLBACK` ON produces a shadow divergence at 5230** (*"returned 1657 key set(s) but the shadow
   advanced 1342"*). It is off-default; this is for its owner.
4. **The 640-unit budget** is the next stop on some ON phases:
   - `PRESS_KILL_BOMBS` ON: 12 of its 23 refusing phases have a pass that ended on the `shouldStop` deadline;
   - both ON: 2 of 15.

   I did not test a bigger budget (clock (c) is the user's).
5. **One arrival per L40 leg** in the radius. A per-leg seam census would bound it tighter. It is cheap, because the
   arm is inert until a bomb meets a press kill.
6. **Tree hygiene:**
   - no runtime file, switch, tape, fixture, pin, gitlink or rules file was edited;
   - switches were set by env in node only;
   - no `pytest`, no `standing-values --write`, no unfiltered vitest, no stash, no force-push, nothing pushed to
     `main`;
   - the dev server was killed by PID;
   - the page captures (about 3.5 MB) stay in the session scratchpad.
