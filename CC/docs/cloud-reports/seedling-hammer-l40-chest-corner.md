# SEEDLING HAMMER-PHASE — L40 CHEST SPINNER CORNER (`seedling-hammer-l40-chest-corner`)

Opus slice, cloud, for planner `seedling-hammer-phase-planning-17`. ⚖ Approved by the user on 2026-11-26 (*"… L40 Chest
spinner corner (Recommended) …"*). Measure first, switch-guarded OFF. Landing needs the user's own SHA-bound OK.

## 1. Start, head, branch

| | |
|---|---|
| base | **`de6e6e7fa8`** = `hammer-harvest-f1-refusal` (the LHM flip, LHM ON by default, plus the six OFF switches PKSW/PKRB/DSS/OAC/PSB/HSB/RSB, over main `754b1909bb`). Not landed. ⚠ At this base the LHM flip's 10 JSUT re-pins (fidelityBombPusher, fidelityL40Bk2, fidelityWandHold, hammerRefugeBandText, fidelityL40Button) are not yet applied, so those rows read red here; that is the base's, not this slice's |
| branch | `claude/seedling-l40-chest-corner-enmkda` |
| head | the commit carrying this report (`Cloud-Status: final`); the code tip under it is `ed280e28` |
| commits | `82aa6cab` evidence (steps 1–2) · `3dc38e4a` train row (step 4) · `ed280e28` the switch + unit rows (step 3) · step-5 survey evidence · this report + the page/game evidence |
| box | cloud, 4 cores, 15 GB; `session_bootstrap.sh --seedling` → `READY`; every non-wasm submodule initialised; Node 22 |

## 2. The answer first

- **`PRESS_KILL_HOLD` (PKH, existing, OFF) alone answers the corner, hitless.** The S4 stop request (stand-in:
  re-measure-9 P1 19:2) refuses `8ef0debe2bb9` under the base defaults and under SIX, and **solves under PKH as
  `85c7dc2a524c`: 1642 ticks, 0 hits, 0 deaths, work 1715 of 2560**, by one 45-tick hold at the kill's last stand.
  SIX + PKH gives the same plan. Every other entry-19 request (7) and all 18 L40 fixtures are byte-identical with PKH
  on and off; PKH is never asked on them.
- **The one thing to know first:** the corner is not a bad place, it is a bad moment. The stand (744.2,664.2) is safe.
  The second spinner (`spinner@816,848`, a free bouncer) climbs the one-tile shaft below the stand at t636–680, so the
  walk out of the stand meets it head-on at y≈685 on t654. One hammer period later it has passed above, and the PKH
  plan crosses the very point the refusal names (741.44,685.29) at t698 without a hit.
- **Why 1 in 4:** it is the arrival's phase. Over 17 distinct seam phases of the same arrival (the outcome repeats with
  the 45-tick hammer period), **3 corner** (all 3 solved hitless by PKH), **3 refuse elsewhere** (a `bobsoldier@880,832`
  chaser-stance loop that runs out the 2560 budget; PKH not asked), **11 solve 0-hit** identically under every config.
- **New switch: `PRESS_KILL_HOLD_MODEL_UNDO` (OFF, `SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1`).** PKH's only non-pin
  defect: an idle (or redo) that the run model refuses to price (`levelRun: …`, a plain `Error`) escaped in place of the
  press kill's own refusal. ON, such a throw ends PKH's search like a hit idle, so the original refusal stands plus
  PKH's sentence. It removes one of PKH's five default-tier re-pins (procgenPostSword). Inert unless PKH is ON.
- **Verdict: PKH + PKH_MODEL_UNDO is flip-ready as a pair**, pending the pins in §7 (4 fight-fallback rows whose
  refusal witness PKH now solves, 2 train OFF rows) and the planner's whole-game measure. No step, leg, fixture or
  request measured here gains a hit or loses a solve.

## 3. The reproduction (measured)

Every request solved node-side as the worker does (`solveAnytime`, the request's own budget and passes; `tools/rc.mjs`,
`tools/solve.mjs`). D = base defaults, SIX = the six OFF switches, DP = D + PKH, SP = SIX + PKH.

**Every entry-19 press-kill request on file** (`measure/requests/`):

| request | budget | D | SIX | DP | SP |
|---|---|---|---|---|---|
| re-measure-9 **P1 19:2** (= S4's stop text) | 2560 | **REF `8ef0debe2bb9`** w896 | **REF `8ef0debe2bb9`** w1792 | **`85c7dc2a524c` 1642 t 0 h** w1715 | **`85c7dc2a524c` 1642 t 0 h** w1715 |
| re-measure-9 P1 19:1 | 640 | REF `8007b96643fd` (the corner, then the deadline) | same | same | same |
| re-measure-6 P1 19:1 (`hammer-kill880` fixture) | 640 | REF `8007b96643fd` | same | same | same |
| re-measure-9 F1 19:1 | 640 | REF `668f4ca7aff6` (deadline) | same | same | same |
| re-measure-9 F1 19:2 | 2560 | `1c1e32cb58a8` 1267 t 0 h | same | same | same |
| re-measure-10 P1 19:1 / S1 19:1 | 640 | REF `668f4ca7aff6` (deadline) | same | same | same |
| re-measure-10 P1 19:2 | 2560 | `8e2c3dcc23fd` 1106 t 0 h | same | same | same |
| re-measure-10 S1 19:2 | 2560 | `45b51fb7670b` 1338 t 0 h | same | same | same |

- The PKH row on P1 19:2: `{t:0, stand:636, refusedAt:654, tries:[45:solved]}`. The PKH plan's passes: `full` only
  (the page's held retry sends the full pass alone).
- SIX's work on P1 19:2 doubles (896 → 1792) because RSB asks the refusal again and it refuses identically. Under SP,
  PKH solves first and RSB is not reached.
- 19:1 at 640 is the same corner at P1 (`8007b96643fd`), but PKH is not asked there: the anytime deadline trips first
  (PKH declines under a tripped deadline by design). The page's 2560 retry is where PKH answers.
- **The S4 stand-in is a committed fixture already.** Re-measure-9 P1 19:2 is byte-identical to
  `fixtures/hammer-kill880/P1-19-1-request.json.gz` except `budgetWork` (2560) and `passes` (`[full]`). So re-measure-6
  P1, re-measure-9 P1 and re-measure-11 S4 (same text, same (741.44,685.29), t652/654) drew the same arrival.
  Re-measure-10 S2's text names (739.28,683.81), t650/653: a different arrival into the same corner (capture OFF, not
  on file).
- Re-measure-11 captured no entry-19 request (its captures are 18/32/37/38/39), so there is nothing more on file.

**The corner, tick by tick** (the PKH plan, `measure/p1-19-2-pkh-plan-ticks-626-740.txt`):

| t | player | spinner@816,848 (the bouncer) | spinner@880,848 (the target) |
|---|---|---|---|
| 636 | (744.2,664.2) standing | (743,690) — in the shaft, below the stand, climbing | (742,765) |
| 654 | standing (unheld, the walk is at (741.44,685.29) here and refuses) | (755,677) | (742,776) |
| 678 | standing | (758,660) | (742,790) |
| 681 | walk down starts | (753,656) — level with / above the stand | |
| 699 | (744.2,686.2) — the refusal's height, no hit | (745,647) — above | (746,801) |

**The 18 L40 fixtures by key** (`measure/fixtures-raw.jsonl`): **D = DP and SIX = SP byte for byte on all 18**; PKH is
never asked. (SIX moves legs 371, 376 and 377 off D, as CHASER-STAND measured; 376's D hit `t1248 bomb#9` is gone
under SIX.) The refusing fixtures (853, 855, 871, 872) refuse identically with PKH on.

## 4. Design + change, OFF identity

**No change was needed for the corner itself**: PKH (KILL880's switch, `solverBot.js` `execKillByPressHold`) already
rewinds a `HAMMER_SAFETY` press-kill refusal to the kill's last stand, idles whole hammer periods (1…4 × 45) and redoes
the kill, keeping only a redo with no player hit since the rewind.

**`PRESS_KILL_HOLD_MODEL_UNDO`** (`solverBot.js`, new block + two lines inside `execKillByPressHold`; worker thread):
- MEASURED defect (probe-branch CI and locally, `SEEDLING_PRESS_KILL_HOLD=1`): `procgenPostSword.test.js`'s clockless
  spinner kill-lock re-probe (`time: null`) refuses with *"13 px hammer's union over all 45 phases"*. With PKH on, the
  hold's IDLE stands inside that all-phases disc and `levelRun`'s contact guard throws a plain `Error` (*"levelRun: at
  tick 266 … HAMMER REACH …"*), which escaped from PKH in place of the kill's refusal. PKH's catch re-raises anything
  that is not `SolverBotError`/`SolverRefusal`; the solver's four other retry sites already read `/^levelRun: /` as a
  refusal.
- ON: `advanceHoldIdle(run)` (new) — an idle tick the model refuses ends the search (`verdict: 'idle'`, *"the model
  refused the idle at its tick N"*; a longer idle contains it); `holdRedoModelRefusal(e)` (new) — a redo the model
  refuses is that try's refusal. Both are undone; with nothing solved, the original refusal is thrown plus PKH's one
  sentence. Any other throw (a `TypeError`, a bug) is still re-raised. Counter: `PRESS_KILL_HOLD_MODEL_UNDO_COUNTS.undone`.
- OFF: both re-raise exactly as before. Inert unless PKH is ON (it is only asked inside PKH). No level, coordinate,
  entity id or Seedling constant is read.
- Name in `solverEnvChannel.SOLVER_ENV_NAMES`; `withPressKillHoldModelUndo(enabled, fn)`.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` =
**`391322d681b7aa0229d94b3f6906d024`** at the base `de6e6e7fa8` and at the tip `ed280e28` (the expected main value).
Surface census regenerated: 375 rows (`seedling-solver-surface.json`: the `withSwitch` row's solverBot count 84 → 85),
`--check` GREEN; `generate-procgen-reference.mjs` and `generate-docs-index.mjs` produce no diff.

## 5. Rows + bounded vitest runs

| file | tier | rows | result |
|---|---|---|---|
| `hammerL40ChestCorner.train.test.js` (new) | train | 3 — the fixture sent in the page's retry shape (2560, `[full]`; = 19:2 byte for byte): PKH OFF refuses HAMMER_SAFETY under D and SIX, hold never asked; SIX + PKH solves inside 2560, whole-period hold at the last stand, fresh replay 0 hits 0 deaths, `passes = [full ok]`; seam + 5 (a phase that solves) is the same plan with PKH on and off, hold never asked | **3/3, 431 s** (under a concurrent page sweep). Cost row added to `scripts/test/train-shard-costs.json` (`measuredFrom.local` + `seconds`) |
| `pressKillHoldModelUndo.test.js` (new) | default | 4 — ships OFF / env name carried; `with…` restores (also on a throw); the predicate reads only `levelRun: …` and only ON, counted; the witness (the clockless spinner kill-lock room, rebuilt from the same helpers): OFF the union refusal, PKH alone the escaped `levelRun:` throw, PKH + MU the union refusal plus PKH's sentence | **4/4** |

Bounded runs (paths only, ⚖ ruling 52):
- default env: `pressKillHold`, `pressKillHoldModelUndo`, `procgenPostSword`, `hammerFightFallback`, `solverEnvChannel`,
  `scripts/procgen/seedlingDivergenceSolverEnv` — **6 files, 54/54**; `seedlingSolverSurface` 36/36;
  `trainShardPlan` + `pressKillHold` 25/25.
- `SEEDLING_PRESS_KILL_HOLD=1 SEEDLING_PRESS_KILL_HOLD_MODEL_UNDO=1`: `procgenPostSword`, `pressKillHoldModelUndo`,
  `pressKillHold` — **3 files, 21/21** (procgenPostSword's re-probe green again).
- `SEEDLING_PRESS_KILL_HOLD=1` (the census, §7): `hammerFightFallback` + `procgenPostSword` 23/28 (the 5 known);
  train `hammerPressKillStartWait` + `hammerShovedLookahead` 3/5 (the 2 known).

## 6. Page play / game witness

**p4g fresh-page game witness of 19:2's PKH plan** (`game/witness-19-2-pkh.*`; `tools/reqwitness.mjs`, chaser-stand's,
headless p4g logic-only, fresh page, under the box lock; `SEEDLING_PRESS_KILL_HOLD=1`): solve `ok`, work 1715, 1642 t,
`modelHits {0,0}`; the game **finished 1642/1642 ticks, 0 hits**, ending at L40 (887.5119968556137,824.041101979122),
the model's own end exactly. (OFF there is no plan to play: the request refuses.)

**The 52 L40/L92 keyed legs on the p4g page** (`probe-seedling-divergence-sweep.mjs --mode=inv --page=seedling_bot_ap_p4g
--page-legs=1 --keys=…`, local, one arm after the other; `measure/legs-*.jsonl.gz`, `legs-summary.txt`):

| arm | done | timeout (90 s leg budget) | skipped | failed | legs with room hits | divergences |
|---|---|---|---|---|---|---|
| D | 42 | 5 | 4 | 1 | **0** | 0 |
| D + PKH (`--solver-env=SEEDLING_PRESS_KILL_HOLD=1`) | 42 | 5 | 4 | 1 | **0** | 0 |

- 49 of 52 legs have the same row summary (end, plans, verdicts, ticks). The 3 that move all GAIN a solved plan, with
  0 room hits:
  - `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest`: done both; 2nd plan 1231 t → 1222 t.
  - `level_40__r26c13 <- in_L43_176_464 -> location:Level 040 - Chest`: timeout both; 2nd plan refused → **1684 t solved**.
  - `level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`: timeout
    both; D 3 plans (1364 t, then a cancelled one) → DP 2 plans (1101 t).
- ⚠ **These 3 are not attributable to PKH.** The two arms drew different arrival clocks on 48 of 52 legs (page timing:
  e.g. the L39 Chest leg arrived at 5140 vs 5221), and the first plan of each of those legs is a deadline cut at 640
  in both arms. The sweep shows only that PKH costs no leg a solve or a hit; the per-request attribution is §3 and the
  seam sweep below. The 5 timeouts are the harness's wall budget under a concurrent survey on this box.

**The seam sweep of the stop request** (`measure/seam-sweep*.jsonl`; P1 19:2 with `staging.seam.time` shifted):

| seam shift | D | DP | SP |
|---|---|---|---|
| −45 ≡ 0, +1, −2 (the corner phases) | REF (spinner@880,848, no step out) | **solved 0 h** (1642 t / 1663 t / 1642 t; one 45-tick hold) | solved 0 h (as DP; SP measured at −45 and 0) |
| −20 ≡ +25, −10, −1 | REF (`bobsoldier@880,832` stance loop, the 2560 deadline) | same refusal | same refusal |
| −40, −35, −30, −25, −15, −5, +2, +3, +4 (and their +45 twins) | solved 0 h | identical | identical |

The outcome repeats with the 45-tick hammer period (−45 = 0, −40 = +5, … byte for byte), so the 16 + 8 shifts cover
17 distinct phases: **3 corner, 3 bobsoldier, 11 clean**. That is consistent with the walk's corner stops (1 of 4 FIVE/STACK runs in each of
re-measure-10 (S2) and re-measure-11 (S4)), as far as samples that small go. The arrival seam itself is set by how long
the walk took to get there (re-measure-9/10's four 19:2 seams: 33487 corner, 33953, 34013, 32976 clean).

**Survey `--through=end`** (`survey/`; D, D + PKH, D + PKH + MU): **identical on all 250 steps** in verdict, ticks, hits
and deaths (226 solved / 24 refused; hits only at 24 L16 1 h, 202 L82 2 h, 220 L82 2 h, the same in all three). PKH is
reached at steps **96** and **149** (both L40): it idles one period, the idle ends the search (the survey solves in place
with a rewind but no anytime ladder), and the refusal gains PKH's sentence. PKH and PKH + MU are identical to the byte:
MU is inert on every seed-1 survey step. **No step gains a hit.**

## 7. Census

**Which seed-1 divergence-sweep legs the change can move, and why.** PKH is asked only when a press kill refuses
`HAMMER_SAFETY` in a segment that can rewind with no tripped deadline, i.e. in a spinner room: L18, L39, L40, L92 in the atlas
(CHASER-STAND's census). MU is asked only inside PKH, and only when the run model throws `levelRun: …`; seed-1 tapes
declare the clock, so the clockless spinner throw cannot occur there (survey: 0 differences between PKH and PKH + MU).
- **Can move:** the 52 L40/L92 keys above (measured: none loses a solve or gains a hit; the 3 that moved are arrival
  noise), plus the L18/L39 spinner legs of the full sweep (not run here: no full sweeps).
- **Measured to move:** only requests that reach a HAMMER_SAFETY press-kill refusal at a budget with no tripped deadline:
  re-measure-9 P1 19:2 (refused → solved hitless), the seam phases in §6, survey steps 96/149 (text only).

**Which existing pins move under PKH** (measured, `measure/pins-pkh-*.log`; CI on the probe branch `hammer-probe-pkh-on`
@27747c3158 shows exactly the same five default-tier rows):

| pin | under PKH | with PKH + MU | kind |
|---|---|---|---|
| `hammerFightFallback.test.js` B3 *"a refusal today, OFF …"* | the OFF witness no longer refuses (`off` = null: PKH solves it) | same | refusal → solve; the row must hold PKH off or re-pick its witness |
| `hammerFightFallback.test.js` B3 *"a retry that does not solve is UNDONE …"* | as above | same | same |
| `hammerFightFallback.test.js` FF-HARNESS *"ON: the rewind that solves …"* | as above | same | same |
| `hammerFightFallback.test.js` SDC *"ON, the deadline tripping AFTER …"* | as above | same | same |
| `procgenPostSword.test.js` re-probe *"…with the clock UNDECLARED …"* | still not solved, but the reason is the escaped `levelRun: … HAMMER REACH` | **green** (the union refusal + PKH's sentence) | fixed by MU |
| `hammerPressKillStartWait.train` *"OFF: the page's refusal …"* | still refused; answer `3b4bc4163c9b` → `dc09599d8d62` | not measured (no model throw expected) | refusal text |
| `hammerShovedLookahead.train` *"OFF: refused, no step out …"* (L40 Chest @5225) | the OFF row now solves (`ok` true) | not measured | refusal → solve (PKH's keep rule: no player hit since the rewind) |

Not re-measured here: the rest of the train tier under PKH, and the procgen sweeps. `hammerKill880StandHold.train` (the
dashless witness) and this slice's train row are PKH's own witnesses and stay green ON.

**Verdict: PKH is flip-ready together with PRESS_KILL_HOLD_MODEL_UNDO**, subject to the six re-pins above (4 + 2; the
seventh, procgenPostSword, is absorbed by MU) and the planner's whole-game measure. Without MU, PKH alone is flip-ready
with seven re-pins, one of which pins a model throw as a refusal reason.

## 8. What the brief got wrong (measured)

- *"PKH solved this corner under ALL in re-measure-9"*: right, and it also solves it under the base defaults and under
  SIX at this base (§3). The brief's framing that "the HAMMER-PHASE rung misses a step-out" is not the mechanism: there
  is no step out at that tick in any phase; the answer is to leave the stand later (PKH), which the rung by design does
  not consider (it holds only inside the walk, walk-offsets −1..0).
- The stand-in request is not new evidence beyond KILL880's: re-measure-9 P1 19:2 is the committed `hammer-kill880`
  fixture byte for byte (budget and passes aside), so re-measure-6 P1, re-measure-9 P1 and re-measure-11 S4 are one
  arrival. Re-measure-10 S2 is a second arrival into the same corner (different coordinates).
- *"No FIVE counter fires there except PKRB"*: under SIX the sixth switch (RSB) does fire on 19:2 — it re-asks the
  refusal and doubles the work (896 → 1792) to the same refusal.
- *"The 18 L40 fixtures … for PKH vs not"* and the 52 keys: nothing to re-pin there; the known PKH costs are elsewhere
  (§7), as the brief listed, and all five default-tier ones are reproduced exactly.

## 9. Residue / hand-overs

- **The bobsoldier phases** (3 of 17 phases of the same arrival): after the press kill, `kill (bobsoldier@880,832)
  stance` repeats until the 2560 deadline (`COVERED GOAL` on the aim's tile (55,52) for detour/forced-hit; the orbit arm
  gets 0 forks before the deadline). PKH is not asked. This is a separate solver item (a chaser stance loop / budget),
  measured here only; seams −20/−10/−1 of P1 19:2 are its witnesses (`measure/seam-sweep*.jsonl`).
- **Re-pins for a PKH flip** (§7): the four `hammerFightFallback` rows need a PKH-off hold (the PM pattern in
  `hammerKill880StandHold`) or a new witness; the two train OFF rows move. That is the flip slice's, not this one's.
- **Not run:** a page sweep with PKH + MU (the survey shows MU inert on seed 1; MU is asked only on a clockless
  tape), the full divergence sweep, the whole-game walk (out of brief).
- The local page sweep cannot attribute per-leg moves (arrival clocks differ run to run); a CI keyed sweep with
  `capture_requests` would let a replay attribute them, if the planner wants it.
- Planner follow-ups: none arrived during this session.
