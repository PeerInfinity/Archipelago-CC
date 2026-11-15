# Seedling hammer-phase SPINNER-CORNER: leg 871's corner is a corpse, not a rebound

Slice `seedling-hammer-spinner-corner` (Opus, cloud). Planner `seedling-hammer-phase-planning-6`/`-7`. ⚖ Approved by the
user 2026-11-12 ("871 spinner-press corner"). Landing it needs the user's SHA-bound OK through the planner.

## 1. SHAs

| | |
|---|---|
| Start (base) | `a3a5b8182e` (origin/main, `train: content-r4 0f817667ad`) |
| Code commit | `875ef7b316` (the switch, both sites, the env name) |
| Rows commit | `fc2f3dd1a7` (5 default rows, 3 train rows, fixture, tools, regenerated surface) |
| Head | the report commit on top of `fc2f3dd1a7` (this file, evidence) |
| Branch | `claude/seedling-spinner-corner-tj7e4k` |

No planner follow-up arrived while I worked, so I followed the brief alone.

## 2. The answer first

**Switch: `HAMMER_BODY_GATE`** (`SEEDLING_HAMMER_BODY_GATE=1`, `withHammerBodyGate`; in `SOLVER_ENV_NAMES`). It ships OFF.
The acceptance md5 is the same OFF and ON: `391322d681b7aa0229d94b3f6906d024`, equal to the base.

**With the switch ON, leg 871 solves hitless, and the game agrees.** At its base id 878, the leg is
`level_40__r48c54 <- in_L39_144_0 ~> level_40__r26c13 -> location:L40 flag 12: wandlock@480,560 cleared`. I ran it under
the train row's set (dashless, uncapped, `withL40Flip(false)`).

- OFF: refused at work 885, as today.
- ON: solved at work 2932, 1114 ticks, plan sha `b833d3f60baa`. A fresh run matches the plan's expected row on every
  tick, with 0 hits and 0 deaths. Flags `40:12` and `40:0` are earned.
- p4g played the plan for all 1114 of 1114 ticks with **no player hit**. The wall-ON model matched the game at 0 px.

**The one thing to know first: the brief's mechanism is wrong for 871.** The press that "LANDED at t719" was the
spinner's **killing** third hit, and a killing hit applies no knockback. The body parked there with `destroy` set and a
30-tick i-frame. The corner came from the player's own move: an opportunistic (OPP) press at t722 on `bob@736,800`
fell inside the double-tap window and **dashed** the player at 2.55 px/tick onto the corpse. At t724, all 9 key sets
were blocked by that corpse's **body** only, never by its line.

The run never charges for that body. `levelRun`'s contact check is `!sp.destroy && sp.hitsTimer <= 0`, which matches
`HAMMER_BILLING.body.gate`. The guard (`clearOfHammersAt`) prices every rect, so it refused a step that the run would
not have charged for.

**The 397 seams do not move.** 5241 and 5242 are the brief's actual class: a knockback rebound. There, OPP's press on
`bobsoldier@880,832` also lands on `spinner@816,848`, and nothing certifies that landing. At the shipped defaults the
escape search can make no claim for that press (§ 9.1). I built an arm for it, measured that it moved nothing, and
removed it.

## 3. The reproduction (measured)

Tool: `evidence/tools/corner.mjs`. It runs `solveSegment` on an observed run, and `OPP_PRESS_FALLBACK` rewinds onto a
fresh run, so the observed run stays at the first branch's refusal. The table is the first branch, OFF, under the train
row's set (`evidence/leg871-corner-off.txt`). Each row is the state after that tick's keys.

| t | keys | player y, vy | `spinner@880,848` | what happens |
|---|---|---|---|---|
| 717 | – | 791.70, 0 | rect y 805.17, hits 2, i-frame 0 | moving 1 px/tick north |
| 718 | down | 792.50, 0.80 | 804.17 | the kill's aim |
| 719 | **primary** | 793.05, 0.55 | 803.17 | the kill's press; `spinnerPressHits` landed at t719, **hits 3 = `hitsMax`** |
| 720 | – | 793.35, 0.30 | **802.17, hits 3, i-frame 30, `destroy` true** | parked from here on: no knockback |
| 721 | – | 793.40 | 802.17 | OPP decision: aim at `bob@736,800` |
| 722 | down | 794.20, 0.80 | 802.17 | the OPP aim key |
| 723 | **primary** | 796.75, **2.55** | 802.17 | OPP's press falls within 20 ticks of t719's press, so it **dashes** |
| 724 | – | 799.05, 2.30 | 802.17 | box bottom 802.05, 0.12 px above the corpse's rect |

At the t724 corner, each key set was stepped once and tested against forecast row 1 (`safeStep`'s test):

| keys | lands at | blocked by |
|---|---|---|
| stand / up / down / left / right / 4 diagonals | y 800.30 – 801.10 | **body** only, for all 9 (the line at gameTime 5959 points down-left and misses every box) |

The table's other measurements:

- **The 13 px hammer line, t719–t724.** It runs from the body's centre (743.31, 806.17) toward (740.17, 819.78) →
  (732.79, 813.81). It never meets the player's box (`lineHitsBox` false on every row).
- **The knockback vector.** None. `hitSpinner` sets `destroy` on the third hit and returns before `knockbackSpinner`,
  and the rect stays at (739.31, 802.17) from t720 on.
- **Other bodies near.** `bob@736,752` is dying (hits 3) at d 7–14 px, and `bob@736,800` (hits 1 → 2) is at d about 20
  px. Neither appears in the guard's test.

**Why the first ON cut was not enough** (`evidence/leg871-corner-on.txt`, and the third default row). With only the body
gated, `safeStep` kept standing at t724 and t725. The dash's slide put the box over the corpse's centre at t726. Every
line from that centre then meets the box, and every key set was blocked (`bodyline`). On those ticks the kill had no aim:
no strike and no refuge, only the escape certificate's stand (`late`) from the t718 aim, taken before OPP's dash.
`stepToward` returns early when there is no aim, so the only guard left was the one-tick test.

**One 397 seam.** Leg 393 at the base, key `level_40__r26c13 <- in_L39_144_0 -> location:Level 040 - Chest`. The
captured request is BOBIFRAME's, with pre-R-A5 key `… r23c29 …`. At seam 5241, shipped defaults, dashless
(`evidence/seam5241-corner-off.txt`):

| t | keys | player x | `spinner@816,848` rect x, hits, i-frame | |
|---|---|---|---|---|
| 1355–1356 | right | 866 – 867 | 884 – 885, 1, 0 | OPP: aim t1355, press t1356 at **`bobsoldier@880,832`** |
| 1357 | **primary** | 868.28 | 886.24 | OPP's press |
| 1360–1361 | – / left | 872.03 | 888.23 → 887.23, **hits 2, i-frame 30** | the swing also lands on the spinner (t1360). Its knockback pushes it east into the wall |
| 1362 → 1367 | – – – – left left | 871.98 → 868.73 | **888.23 → 873.58** (−3.4, −3.2, −2.9, −2.7, −2.5 px/tick) | the rebound. The player stood for 4 ticks |
| 1367 | | | 873.58 | all 9 sets blocked: 4 by the body, 5 by body+line. OFF refusal: `HAMMER_SAFETY`, "7 tick(s) after the press … LANDED at t1360" |

Seam 5225 is a different corner. It forms on the approach at t654, no landing is involved, and the rung reports "NO
PHASE admits a step". `spinner@816,848` there has hits 0 but moves 3–5 px/tick. I did not measure the cause; see § 9.

## 4. Design, change, OFF identity

**The design, stated before the code.** The brief offered three levers. All three assume a rebound, and 871 has none.
The smallest correct change is to make the guard charge for what the run charges for, and then still look for a step
out on a tick with no aim. That covers both the corpse and the dash's momentum. It reads the run's own bodies and
forecast, and uses no level id, coordinate or Seedling constant.

`solverBot.js`: new functions plus three one-line call sites, nothing renamed or reformatted. One name was added to
`solverEnvChannel.js`.

- `HAMMER_BODY_GATE {enabled}`, `HAMMER_BODY_GATE_COUNTS {asked, cleared, held}`, `withHammerBodyGate`.
- `hammerBodyBilled(run, row, i)` decides which of forecast row `i`'s rects charge their body: those that are not
  `destroy` and whose live `hitsTimer` minus `i + 1` is ≤ 0 (`stepSpinner` takes one off per update). It returns null on
  a preview's view (no `advance`) or when the row does not hold exactly the live bodies. Every estimate charges as early
  as the run does or earlier: a body the forecast destroys, sinks or re-hits stays charged.
- `clearOfBilledHammersAt(run, box, forecast, i)` is `clearOfHammersAt` with that gate. The line is always tested.
- `landsClearOfBilledHammers` is `safeStep`'s landing test under the gate. **Call site 1**: the executor's `safeStep`
  call. A fight's in-flight test (`landsClearInFlight`) is unchanged.
- **Call site 2**: `stepToward`'s survival search uses the gated test when the switch is ON.
- `holdStepOut(run, intended)`: on a press-kill tick with no aim, it keeps the intended key (a stand, or the escape
  certificate's key) when that key survives `STEP_LOOKAHEAD` ticks under the gated test. Otherwise it returns
  `stepToward` aimed at the player's own position, the phase stall's "safe holding step". **Call site 3**: right after
  the executor's `stepToward`, only when `!aim` and no approach certificate drives.
- **Thread**: all three run inside `solveSegment`, which is the page's **solve worker**. No main-thread mapper reads
  the switch. `?seedlingSolverEnv=SEEDLING_HAMMER_BODY_GATE=1` reaches it.

| OFF identity | Value |
|---|---|
| Acceptance md5 at base `a3a5b8182e` | `391322d681b7aa0229d94b3f6906d024` |
| Acceptance md5 at `875ef7b316`, OFF | `391322d681b7aa0229d94b3f6906d024` |
| Acceptance md5 at `875ef7b316`, `SEEDLING_HAMMER_BODY_GATE=1` | `391322d681b7aa0229d94b3f6906d024` |

## 5. Rows and bounded vitest runs

| File (tier) | Rows | Result |
|---|---|---|
| `hammerBodyGate.test.js` (default) | the switch (OFF, env name, wrapper restores on throw); `hammerBodyBilled` (corpse, i-frame by row, view → null, row of other bodies → null). On the branch tape at t724 (`fixtures/hammer-spinner-corner/leg871-branch724.json.gz`, 724 keys, from `evidence/tools/branch724.mjs`): the last landing has hits = `hitsMax`, the body is `destroy` with i-frame `hitsTimerMax`, OFF blocks 9/9 by body only, and OFF's gated test equals `clearOfHammersAt`. ON clears 9/9. ON, standing 2 more ticks: at t726 all 9 sets meet the line, which is why `holdStepOut` exists | **5 / 5**, 1.0 s |
| `hammerBodyGate.train.test.js` (train) | 871 OFF refused at work 885 (message: the burn stance ladder EXHAUSTED). 871 ON `{ok, work 2932, 1114 t, sha b833d3f60baa, 0 row mismatches, 0 hits, 0 deaths}` with `40:12`. **Control** 872 (`… <- in_L43_176_464 …`, same room and goal, press kills on the same spinners): OFF = ON, `{work 3823, 2385 t, sha 0c51cdb94854, 0 hits}` | **3 / 3**, 244 s (`evidence/vitest-hammerBodyGate-train.txt`) |
| Bounded neighbours: `hammerSlashRect`, `hammerFightFallback`, `hammerOppPressFallback`, `fidelityF1c`, `hammerSpinnerPress`, `hammerBodyGate`, `solverEnvChannel` | `safeStep`'s and the rung's own pins, OFF | **67 / 67**, 7 files (`evidence/vitest-bounded.txt`) |

Producers: `census-seedling-solver-surface.mjs --write` (372 rows; `seedling-solver-surface.json` line shifts only) then
`--check` GREEN. `generate-procgen-reference.mjs --check` reported all 7 modules and 5 regions matching, and
`generate-docs-index.mjs --check` reported the index current. No doc under `docs/json/developer/procgen/` was edited, so
no link-census pin is owed.

Not run, per the rules: unfiltered local vitest, `pytest`, `standing-values --write`. The suite number is CI's at the
pushed SHA. The new train file has no row in `scripts/test/train-shard-costs.json`. It runs anyway, on the lightest shard
with a warning. Its local cost is about 245 s.

## 6. Game witness (p4g)

I built the ON plan as a damage-on staged tape (`evidence/tools/leg871-tape.mjs`, wallsflip's recipe;
`evidence/leg871-on.tape.json`). I replayed it in the model on the request's records and on the delivered set (both
hitless, `40:12`). I then played it with `scripts/procgen/probe-seedling-bobiframe.mjs` on `seedling_bot_ap_p4g`, headless
logic-only, delivered set `seedling-ap-record-01b432a9`. The tape sat in the probe's witness directory only for the run;
it is untracked and was moved out afterwards. Log: `evidence/leg871-on-game.log`.

| | Value |
|---|---|
| Ticks sampled on the game | **1114 / 1114** |
| Game player hits | **none** |
| Wall-ON model vs game | **0 px**: player, 12,662 bob comparisons (with hits / `hits_timer`), 5,175 spinner comparisons, first partings `[null, null, null]` |
| Wall-OFF model | first bob parting t543 (0.177 px, `bob@736,752`), the BOBIFRAME / wallsflip wall, with no player parting |

## 7. Census

**The 30 captured page requests under `fixtures/`** (`evidence/census-fixtures-cap2560.tsv`, `evidence/tools/census.mjs`).
Each request's first request ran its dashless pass at the shipped defaults, OFF then ON, capped at 2560 work units.

- **OFF = ON on all 30**: verdict, work, ticks and plan sha are all equal.
- **None refuses "no step out"** in that pass, OFF or ON.
- The gate was asked on 8 of the 30: seven L40 spinner-room requests (2280 or 3578 asks each, the 376 bomb room among
  them) and L18's leg 223 (4183). It **cleared nothing** (`cleared` 0) and re-chose no hold.
- 871's request **solves** at these defaults (work 973, 1437 t). The lost solve exists only under the train row's set,
  as DYING-BODY-WAIT found.

**Leg 393 (BOBIFRAME's 397)** by its captured request at 10 arrival clocks, using the worker's anytime dispatch at the
shipped defaults (`evidence/seam397-off-on.tsv`, `evidence/tools/seam397.mjs`):

| Seams | OFF | ON |
|---|---|---|
| 5216, 5218, 5222, 5224, 5226, 5247, 5258 | refused: the anytime deadline (work 644 > `budgetWork` 640) | same |
| 5225 | `HAMMER_SAFETY` no step out at (741.44, 685.29), work 112 | same (cleared 0) |
| 5241, 5242 | `HAMMER_SAFETY` no step out at (868.73, 855.83), 7 t after the t1360 landing, work 340 | still refused, now at (867.94, 850.52) / (867.34, 850.39), 10 t after (cleared 536 / 722) |

In the clean / refused / hit counts: OFF is 0 clean, 10 refused, 0 hit-taking, and ON is the same. ON only moves 5241 and
5242's corner 3 ticks later. While the spinner's i-frame runs, its body is no longer the wall, but the rebound's line
still is.

**Which sweep legs the change can move, and why.** It can move only a press kill in a spinner room whose refusal is
`safeStep`'s, and only where every blocked set is blocked by a body the run would not charge. That means a corpse in its
11-tick fade, or a body inside the 30-tick i-frame after a landing. The other way it can act is when a no-aim tick's
stand does not survive the lookahead. By key, the measured movers are:

- **878** (871's key) under the train row's set: refused → solved hitless.
- **879** (872's key): unchanged.
- **393**: the corner moves 3 ticks later and is still refused.

Nothing else moves in the 30-request census at the defaults. I did not run a page sweep (no whole-game walk was asked).

## 8. What the brief got wrong (measured)

1. **"`kill (spinner@880,848) by press` LANDS at t719 and 5 ticks later the corner … the landing's knockback is
   player-coupled."** The t719 landing is the third hit of `hitsMax` 3. `hitSpinner` sets `destroy` and returns without
   `knockbackSpinner`, and the body is parked from t720. There is no rebound. The corner is OPP's t722–723 press dashing
   the player (vy 0.8 → 2.55) onto the corpse's 7×7 rect. All 9 sets were blocked by the **body**, which the run does
   not charge (§ 3).
2. **The refusal's own sentence caused the error.** `hammerPhaseRefusal` appends *"a landing's knockback is
   player-coupled …"* whenever any landing on that body falls within `HAMMER_PHASE_RUNG.horizon` ticks, including a
   killing landing that has no knockback. That is how DYING-BODY-WAIT's hand-over, and then this brief, named a rebound.
   The text belongs to the hammer; see § 9.3.
3. **"Price the landing's knockback into the stance / plan the step out before the press / press later or earlier."**
   None of these applies to 871. The press was certified and clean, and the next press was OPP's. For 5241/5242 the
   landing is a rebound, but it comes from **OPP's press on a chaser**, not the kill's own press. The kill's stance
   choice never sees it.
4. **"Leg 397 seams 5225/5241/5242 refuse … with `chaserSpinnerWalls` ON."** The walls are now the shipped default.
   5225 refuses before any landing, on the approach (§ 3). At this base, 7 of BOBIFRAME's 10 census seams no longer
   produce a plan at all: the anytime budget runs out, in both arms.

## 9. Residue and hand-overs

**To the hammer arc (planner):**

1. **OPP's uncertified spinner landings (393 at 5241/5242).** `oppStrikeLandsClear` prices the aim's and the press's own
   landings. `HAMMER_ESCAPE` certifies the kill's presses (`aimAdmitted`) and never OPP's. I built `OPP_PRESS_ESCAPE`:
   at the drive, withhold an OPP aim whose press lands on a spinner when `pressEscape` claims no way out. I measured it,
   then removed it before committing because it **moved nothing**:
   - At the shipped defaults, `pressEscape` answers *no claim* for every spinner ("the forecast names shield bump
     (`shieldBumpNow`) as unmodelled") at t1355–1358, so it withheld 0. That was 165,414 asks at seam 5241 before I
     limited the check to bodies in the press's reach, and 620 after.
   - With `PRESS_ESCAPE_EXACT=1` alone, the answer is the same.
   - With `FORECAST_SHIELD_BUMP=1` as well, the solve takes another path and runs out of budget (work 644) before t1355,
     in both arms.

   So this class needs the escape's shield claim at the defaults, which belongs to fidelity / ESCAPE-EXACT, and then an
   OPP admission that asks it.
2. **OPP's press may dash.** OPP prices its press's landing tick but not the dash's momentum afterwards (871, t723–t726).
   `HAMMER_BODY_GATE`'s `holdStepOut` handled it here because the body in the way was a corpse. Against a live body the
   same slide would still corner the player. A rule like `oppDefers`, for OPP's own press, is the natural next step.
3. **`hammerPhaseRefusal`'s sentence** should name the rebound only for a landing that knocked back: one with hits below
   `hitsMax`, or a body without `destroy`. This is a wording change and moves no verdict.
4. **Seam 5225**: a corner on the approach, with the spinner at hits 0 moving 3–5 px/tick, and the rung finds "NO PHASE
   admits a step". I did not measure what moves the body (a shield bump is my unverified guess).
5. **Landing `HAMMER_BODY_GATE`.** It is OFF and byte-identical, has one measured mover (878 under the train set) and a
   game witness. At the shipped defaults it moves nothing in the census.

**To fidelity (sign / correct, your files):** none of the model was touched. The gate reads the run's own `HAMMER_BILLING`
body gate (`levelRun` `!sp.destroy && sp.hitsTimer <= 0`). If that gate is ever wrong, this switch is wrong with it.

**Residue:** the train-shard cost row for `hammerBodyGate.train.test.js` (about 245 s locally) is for whoever owns
`train-shard-costs.json`. The evidence tools write nothing tracked. The probe's temporary tape was moved to
`evidence/leg871-on.tape.json`, and the server I started (port 9871) was stopped by its PID.
