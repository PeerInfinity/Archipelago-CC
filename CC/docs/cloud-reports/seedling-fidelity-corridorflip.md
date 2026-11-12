# Seedling fidelity CORRIDORFLIP: readying `corridorBodyPricing` for its flip, measured

Session `seedling-fidelity-corridorflip` (Opus build, cloud). Planner `seedling-fidelity-planning-19`, wave 42.
Evidence: `seedling-fidelity-corridorflip-evidence/`, beside this file.

| | |
|---|---|
| Start SHA | `a3a5b8182e` (origin/main, `train: content-r4 0f817667ad`; 123 default-ON keys of 134, measured) |
| Head | the commit carrying this report. Code heads: `7c3d5f86` D2 · `f0638187` D1 (the flip) · `decb479a` docs |
| Harness branch | `claude/seedling-fidelity-wave-42-aa98bv` |
| Verdicts | **W0 PASS** · **D1 PASS: measured. NOT licensed: the default is ON on this branch only, in commit `f0638187`, which the planner can drop** · **D2 PASS: `corridorForecastMemo` built, OFF, exact. The kill arms (b) are hammer's: STOP and handed over** |

## The one thing to know first

**The flip loses no hitless solve.** What it loses is hit-taking solves, and each becomes a by-name ladder refusal.
Every refusal names a wallflyer or a drill that no rung can remove. The hits those plans took are real on the game
(p4g): re-witnessed here at survey step 35 (t84) and step 84 (t48, t110). The flip's gains are also game-true on p4g:

- survey step 119 goes REFUSED → SOLVED, 192 t, 0 hits;
- step 41 drops two deaths;
- step 193 drops a lavarunner hit.

**The wave-17 solve-cost debt (a) is not a page DEADLINE at this base.** The page's deadline is a deterministic
WORK budget (640 units, window 85). Under it, all 56 WallFlyer/Drill-room legs answer exactly as they do unbudgeted.
What remains is wall time: about 9×, which D2 roughly halves on the L22 legs. What stands between this switch and a
clean flip is (b), hammer's: no kill arm for a wallflyer or a drill.

## W0: the base and the debts (PASS)

| row | command | result |
|---|---|---|
| checkout / bootstrap | `git checkout -B <harness> a3a5b8182e`; `session_bootstrap.sh --seedling` | `READY`, node v22.23.4; server PID 622 on 9788 |
| switch count | `CONTACT_FIDELITY_DEFAULTS` in node | 134 keys, **123 ON** (OFF: arrivalButtonArm, unbilledDamageGate, partialDodgeReprobe, corridorBodyPricing, arrowLaneCrossing, axePricedCrossing, walkerBeamTowers, orbitFreeAim, strategyBoundDistinct, forecastShieldBump, spinnerRemoveRead) |
| identity block | `SEEDLING_PORT=9788 bash scripts/procgen/identity-block.sh .` (`evidence/w0/identity-base-off.txt`) | maze `57e07d21`, **acceptance `391322d6`**, c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated OK |
| six `--check`s | the same block | battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `be9c19c8`, all exit 0 |
| surface / constants | `census-seedling-solver-surface.mjs --check`, `census-seedling-constants.mjs --check` | GREEN 372 · PASS |
| bounded vitest BEFORE | 152 files (`evidence/vitest/bounded-files.txt`): the brief's standing list plus every test naming `corridorBody*`, `previewWalk`, wallflyer, drill, puncher, `contactHitsTimer`, `chaserDanger`/`chaserForecast`, `CONTACT_FIDELITY_KEYS` or the surface/constants; run at `7c3d5f86` (D2 OFF ⇒ the base's behaviour) | **3,872 passed / 0 failed** |
| roster | 293 committed tapes (ROCKBUTTON's list) | 293 replay, 0 errors |

**The debts at this base:**

| debt (wave-17 CI read) | status at `a3a5b8182e` | evidence |
|---|---|---|
| **(a) solve cost: 4 legs done → DEADLINE** | **Not a deadline here.** The page solves under `SOLVER_BUDGET_WORK` 640 with the 85-unit upgrade window. These are WORK units (`passShouldStop`), with no clock. All 56 legs in WallFlyer/Drill rooms (L22, L25, L27, L28, L88, L91) plus the L12/L30 unbilled keys were re-solved in node, both arms, budgeted and unbudgeted. **Every ON answer under 640/85 equals the unbudgeted ON answer.** The cost is wall time: 25 s → 219 s over the 56 (single legs 0.3–1.5 s → 1.5–33 s, on a loaded 4-core box). The page's real wall bound is the sweep harness's 90 s per leg | `evidence/legs/census-*-budget640.jsonl`, `memo-budget.txt` |
| **(b) no kill arm: honest refusals at a wallflyer/drill** | **Still open; hammer's.** Survey step 35: the KILL rung's chooser picks `bob@96,144` (*"no presser in level 22 arms a trap…"*, *"bob@96,144 is not a body this run steps"*). Survey step 84 and legs L88←L12 ×2: *"the danger on this corridor is not a body this run can watch die"*. DRILLKILL (`drillKillFirst`) and the timed pass kill drills only for L28's rope cut, not on the ladder | §D1 refusal texts |
| **(c) Puncher forecasting (with `unbilledDamageGate` ON)** | **Not a blocker for this key.** `chaserForecastNow` already times the punch (U10's `punch` rows; RULESREF `punchGateTimed`). At the defaults, sweep 43136081951's L12 bosslock UNBILLED-HIT legs (127, 128, 160, 161, 171, 172) are game hits the model **never bills** (`billed=[-]`). That is a model divergence the corridor key cannot see, and it moves with the gate, not with this key. Node cannot stage their key state (`keylock cannot act`, both arms). No Puncher arm was built: there is no measured need from this key | sweep summary; `evidence/legs/census-*.jsonl` (L12/L30 rows identical) |
| **L22 death loop** (hammer CONNECTED-L22) | **Reproduced.** Capture #49 (Ghost Spear + Fire, no Sword). OFF: a stall *"after grazing 85 solid(s)"*, work 33. ON: *"the combat ladder is EXHAUSTED … chaser:wallflyer@48,112 (forecast along the walk)"*, work 3 | `evidence/l22/r49-corridor-{off,on}.json` |

## D2: the forecast's cost (`corridorForecastMemo`, OFF; PASS)

**Measurement first.** `node --cpu-prof` on an ON solve of `level_22 <- in_L29_0_224 -> exit:out_teleporter_0_128`
(32 s ON vs 1.1 s OFF):

- 62 % of the solve is the forecast's `step`, 55 % of it inside `stepWallFlyer`;
- 71 % sits under `corridorDashRescue → planSwordDash → evaluateAt → previewFor`;
- the self time is `solidCandidates`, `assertNormalizedLiveOpts`, `collideLineSolid`, `nearestTileScanIndexed` and
  `collidesSolid`.

A resting wallflyer asks `decideMotion`'s four wall probes, its tile and its trigger ray on every previewed tick, at
the same position, against a context that is frozen for the forecast's life.

**The change** (`contactFidelity.corridorForecastMemo`, appended last, OFF; `SEEDLING_CORRIDOR_FORECAST_MEMO`, listed
in `SOLVER_ENV_NAMES`):
- `levelRun.corridorForecastCtx`: ON, it wraps the frozen `spinnerCtx()`. `collides(rect)` is memoised by
  size → x → y in nested maps, with no string key per read. `tileTypeAt(x, y)` is memoised by point. A `fork()` shares
  the cache, because it shares the frozen context.
- `levelRun.corridorLineHits`: `crusher.collideLineSolid` with an exact bounding-box reject. Every point that function
  samples lies in the truncated endpoints' box: the major axis steps from the start and stops before the end, and the
  minor axis moves monotonically by a fraction. So a box missing that closed box cannot be hit.
- `wallFlyer.stepWallFlyer` gains an optional `ctx.lineHits` (default `collideLineSolid`). Only the forecast passes it.
  The live stepper is unchanged.
- The drills' "Enemy" half (other drills, chasers) and every drill line test are NOT memoised: they move.
- No new per-visit state: the maps are per forecast, not per visit. `stateDigest` is untouched.

**Measured:**

| row | result |
|---|---|
| the L22 leg above | 32 s → **14.4 s**, plan identical (JSON equal, `ms` aside) |
| 56-leg census, ON vs ON+memo | **answers identical on all 56**. The census ran on a box shared with vitest, so wall times are noisy: L22 legs 33→16, 14→7, 17→10, 10→5 s; the L88/L91 drill legs did not improve (14.6 → 16.2 s etc.): the drill path is not memoised |
| acceptance md5 | `391322d6` OFF, corridor ON, corridor ON + memo |
| `fidelityCorridorBody.test.js` (3 new rows) | ships OFF, last, env-named · ON = OFF row for row along the step-47 and step-114 walks · ON = OFF on whole solves (steps 53, 45) |

**Mutants** (predicted, then made by copy and restore):

| mutant | predicted | measured |
|---|---|---|
| m1: the ray reject shrinks the box by 4 px | the row-for-row test reds | that one red; the whole-solve row stayed green (blind to it) |
| m2: the memo key drops `x` | the row-for-row test and the whole-solve row red | both red |

**Re-pins (a new last key):** the nine key-order tails (`fidelityCeremony126`, `DrillWater`, `Fencepost`, `FireBreak`,
`FireSpinner`, `FrozenPress`, `L39Phantom`, `RockFire`, `RockGone`), ROCKBUTTON's last-key row (now "the keys after it
are `[corridorForecastMemo]`"), and the `contactFidelity` defaults row. 11 files / 150 tests green, plus
`contactFidelity` + `fidelityCorridorBody` 73 / 73. Surface `--write` (line moves only) → GREEN 372; constants
`--write` → PASS.

⚠ **What D2 does not do.** Most of the remaining ON cost is structural: `planSwordDash` previews every dash window with
the forecast stepped along each one. That is the dash chain's search, not this region's. A cheaper certificate there
is the next lever if the planner wants one.

## D1: the flip, measured (PASS: measured; NOT licensed)

Commit `f0638187` sets `corridorBodyPricing: true` and its two defaults pins: `contactFidelity.test.js`, and the
`fidelityCorridorBody` row now reads "OFF: … (the default is ON on this branch)". It is one commit, so the planner can
drop it or harvest it alone.

### The route survey (local, `--through=end --route=full`, 244 steps)

OFF **215 SOLVED / 29 REFUSED** → ON **214 / 30**. Five rows move, matched by level, goal and boot. They are
wave-17's five again (47 → 35, 53 → 41, 114 → 84, 100 → 119, 170 → 193). `evidence/survey/survey-{off,on}.jsonl`.

| step | level / goal (boot) | OFF | ON | hits OFF → ON | lost solve? | game-true? (p4g, headless, clock shift [0]) |
|---|---|---|---|---|---|---|
| 35 | L22 → L29 (192,64) from (16,128), Sword | SOLVED 201 t | **REFUSED**: ladder EXHAUSTED at `wallflyer@48,112`; the KILL rung chose `bob@96,144` | 1 (t84 `wallflyer@64,80`) → — | **yes**, a hit-taking solve | OFF plan = the committed wave-17 witness `survey-step-47` byte for byte; re-played on p4g: **hits 0→1 at t84** |
| 84 | L88 → L87 (32,0) from (96,288) | SOLVED 476 t | **REFUSED**: ladder EXHAUSTED at `drill@128,160` (*"not a body this run can watch die"*) | 2 (t48, t110 `drill@128,160`) → — | **yes**, a hit-taking solve | p4g: **hits at t48 and t110** |
| 41 | L22 → L21 (96,0) from (96,176) | SOLVED 406 t | SOLVED **126 t** | 6 hits, **2 deaths** → **0** | no (gain) | ON plan on p4g: **hits 0** through 126 t, ends in L21 |
| 119 | L88 → L12 (96,304) from (32,16) | REFUSED (ladder: the drill as a static box) | **SOLVED 192 t** | — → **0** | no (**gain**) | ON plan on p4g: **hits 0**, ends in L12 at t192 |
| 193 | L77 → L76 (0,32) from (96,288) | SOLVED 475 t | SOLVED **491 t** | 1 (t17 `lavarunner@112,256`) → **0** | no (gain) | ON plan on p4g: **hits 0**; `lavarunner` at 0 px (90 comparisons) |

Survey wall time ON: step 35 0.7 → 36.4 s, 84 1.2 → 14.3 s, 41 0.6 → 12.4 s. The survey solves unbudgeted. The
witnesses are in `evidence/witness/` (walk tape + the game's `[t, level, hits, hits_timer, x, y]`).

### The sweep legs in node (56 legs; the sweep row's inventory over the JS runtime's arrival, `ANYTIME_PASSES`)

Keys from sweep 43136081951 (full, default, 2026-11-12, at `3197027d43`); legs re-derived at this base with
`seedling-divergence-legs.mjs`. **18 of 56 move.** Every row below is identical budgeted (640/85) and unbudgeted.

| leg key | OFF | ON | hits OFF → ON | lost solve? |
|---|---|---|---|---|
| `level_27 <- in_L28_128_304 -> exit:out_teleporter_32_0` | done 126 t | **REFUSED** (ladder at a wallflyer) | 1 (t16 `wallflyer@192,48`) → — | **yes**, hit-taking |
| `level_88 <- in_L12_304_0 -> exit:out_teleporter_32_0` | done 476 t | **REFUSED** (drill) | 2 → — | **yes**, hit-taking (= survey 84's walk) |
| `level_88 <- in_L12_304_0 -> exit:out_teleporter_192_0` | done 379 t | **REFUSED** (drill) | 2 (t48, t114) → — | **yes**, hit-taking |
| `level_88 <- in_L87_272_304 -> exit:out_teleporter_96_304` | REFUSED | **done 192 t** | — → 0 | gain |
| `level_88 <- in_L87_432_304 -> exit:out_teleporter_96_304` | done 213 t | done 142 t | 1 → **0** | — |
| `level_22 <- in_L25_144_32 -> exit:out_teleporter_192_64` | done 229 t | done 207 t | 1 (t58 `wallflyer@128,80`) → **0** | — |
| `level_25 <- in_L22_0_128 -> exit:out_teleporter_0_96` | done 182 t | done 156 t | 1 → **0** | — |
| `level_25 <- in_L26_144_32 -> location:Level 025 - Chest` | done 128 t | done 110 t | 1 → **0** | — |
| 10 hitless legs (L22 ×5, L25 ×3, L27, L28) | done | done, **+2 to +25 t** | 0 → 0 | — (longer, still hitless; most now solve on the full pass after the dashless pass refuses) |
| `level_91 <- …` ×2 | REFUSED (drill, static box) | REFUSED (drill, forecast contact) | — | — (wording only) |

`evidence/legs/movers.txt`. **No hitless leg becomes hit-taking.** The six L12/L30 keylock keys answer identically in
both arms: node cannot stage the page's key state.

### The rest of the battery, ON

| row | result |
|---|---|
| acceptance (`batch-seedling-acceptance.mjs \| md5sum`) | **`391322d681b7aa0229d94b3f6906d024`**, OFF and ON (+ memo) |
| identity block ON (the page at `f0638187`, default ON) | every value row = W0 **except ENEMY `87e86da9` → `0854dc2f`**: the `drill` corridor-chamber row solves in 171 t instead of 155 (it walks round the drill; still SOLVED), so the chamber summary reads 14 of 23 at the control's tick count instead of 15 — wave 17's own ENEMY mover (`evidence/w0/enemy-census-off-vs-on.diff`) |
| six producer `--check`s ON | **unchanged**: battery `7486f32e`, d2-chain `93f75467`, l18 `88e33db7`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `be9c19c8`, all exit 0 |
| 293 committed tapes, stream md5 (`run-seedling-tape.mjs`, both env arms) | **identical ON vs OFF**, and equal to ROCKBUTTON's published streams (`evidence/tapes/`) |
| bounded vitest ON (156 files: W0's 152 + `dashOnlyWindow`, `dashShape`, `jsRuntimeSolverShouldStop`, `jsRuntimeTape`) | **3,912 passed / 20 failed in 10 files** (OFF 3,872 / 0 on the first 152; the 4 added files are green ON). Every red is listed in §"The bounded reds ON" |
| slow/train files touching these rooms or the bounded hits, ON, one at a time | **all green**: `deriveLevelWorldLogic.slow` 2/2, `fidelityL32ArenaPrefix.slow` 5/5, `strategySwitchTable.slow` 4/4, `hammerNewLocks.train` 1/1 (`evidence/vitest/heavy-on.txt`). No `.slow.`/`.train.` file holds a solve in a WallFlyer/Drill room (grep for those levels and classes) |
| L4 dash margin (84 vs 85) | **held**: `jsRuntimeSolverShouldStop`, `dashOnlyWindow`, `dashShape`, `jsRuntimeTape` green ON |

### The bounded reds ON (20 in 10 files; `evidence/vitest/bounded-on.txt`)

None is a default-arm hitless solve turned hit-taking. They fall in four groups. Each needs a re-pin with the flip,
and **none is re-pinned here** (the flip is not licensed).

| file (rows) | what moves | class | owner to sign |
|---|---|---|---|
| `fidelityUnbilledGate` (3: step 47 OFF solves with the hit; ON refused as UNBILLED; the prefix row) | step 47 (= survey 35) is refused by the ladder before the gate can see the hit | **known wave-17** row: the three gate rows pin the pricing OFF (their witness is a walk the gate refuses) | fidelity |
| `fidelityLapseCost` (1: leg 265 solves with or without the rung) | the captured L22 request refuses ON | **known wave-17**: pin the pricing OFF or re-pin the answer | fidelity |
| `seedlingCanCross` (1: L22 from L25 toward L29, bare) | still `cannot`; the cause names the wallflyer, not a stall | **known wave-17** wording | fidelity |
| `fidelityTimedPass` (3: the defaults row's prerequisite object; "null with `corridorBodyPricing` OFF unless `drillPass`"; the OFF Fire row's obstacle) | the first two assumed the key's default OFF (a **stub** of the old default); the third: ON, the walk dodges the drill, so the refusal's obstacle no longer carries `drill` | control / stub | fidelity |
| `fidelityDrillKill` (5: the ON Fire row's obstacle; four "OFF (byte-identical)" rows from L25/L26) | the OFF rows hold `drillKillFirst`/`drillTimedPass` OFF but leave this key at its default: the L28 rope walk now dodges the drills. From L25 with the Spear it ends at (154.18, 57.78) and **the thrust misses the rope** (`runSpear`'s post-condition, a `BotDriverV2Error`; DRILL's report measured this exact point in wave 26). From L26 the Sword plans 72 t, not 77 | **control** (non-default arms). At the defaults (kill first + timed pass ON) the L28 rope legs do not move (census) | fidelity; ⚠ the miss is a walker post-condition on a non-default arm (information for the JS arc) |
| `fidelityDrill` (1: D3, the stance (136,72) walked and the cut refused at t59) | the same rope walk; ON it dodges and the thrust misses | control (wave 26 measured it) | fidelity |
| `arrivalCompositesLegs` (2: L88 residue a/b) | still declines BY NAME on `drill@128,160`; the words are now the forecast contact (`chaser:drill@128,160 (the drill's contact …)`) instead of `enemy:drill@128,160 (a stepped drill …` | wording | **JS arc** (composites probe pins) |
| `hammerDrillExitPass` (2: OFF 718/719 refuse EXHAUSTED; leg 704 ON = OFF) | L91 / L88 refusals change wording or source under the forecast | wording / control | **hammer** |
| `fidelityL100Lattice` (1: OFF the 16 px stance walk stalls) and `hammerDashCert` (1: step 216 with the fine walk OFF) | both pin `fineStanceWalk` **OFF** (a non-default control). ON, that arm leaves the 16 px stall for `bait → kill (jellyfish@88,144) by press`, and the kill's dwell is HIT at t193 (`BotDriverV2Error`): the chaser forecast's `contactHitsTimer` changes the ladder's pick. The default arm (fine walk ON, survey step 223) does not move | control. ⚠ A kill-by-press dwell hit is hammer's region | fidelity (L100Lattice), **hammer** (DashCert) |

## Report table: every mover

| mover | OFF | ON | hits | lost solve? | game-true? | owner |
|---|---|---|---|---|---|---|
| survey 35 (L22→L29, Sword) | SOLVED 201 t | REFUSED by name | 1 → — | **yes** (hit-taking) | OFF hit real (p4g t84) | hammer: wallflyer kill arm / chooser |
| survey 84 (L88→L87) | SOLVED 476 t | REFUSED by name | 2 → — | **yes** (hit-taking) | OFF hits real (p4g t48, t110) | hammer: drill kill arm on the ladder |
| survey 41 (L22→L21) | SOLVED 406 t, 2 deaths | SOLVED 126 t | 6 → 0 | no | ON hitless on p4g | fidelity |
| survey 119 (L88→L12) | REFUSED | SOLVED 192 t | — → 0 | no (gain) | ON hitless on p4g | fidelity |
| survey 193 (L77→L76) | SOLVED 475 t | SOLVED 491 t | 1 → 0 | no | ON hitless on p4g | fidelity |
| leg L27←L28 → (32,0) | done 126 t | REFUSED | 1 → — | **yes** (hit-taking) | model (sweep row to confirm) | hammer |
| leg L88←L12 → (32,0) | done 476 t | REFUSED | 2 → — | **yes** (hit-taking) | = survey 84 | hammer |
| leg L88←L12 → (192,0) | done 379 t | REFUSED | 2 → — | **yes** (hit-taking) | model | hammer |
| leg L88←L87_272 | REFUSED | done 192 t | — → 0 | gain | = survey 119's room | fidelity |
| legs L88←L87_432, L22←L25 (192,64), L25←L22, L25 chest | done | done, shorter | 1 → 0 each | no | model | fidelity |
| 10 hitless legs | done | done, +2–25 t | 0 → 0 | no | model | fidelity |
| bounded reds (20 rows, 10 files) | green | red | — | none on a default arm | — | §above |

## Dispatches for the planner (⚖ sweep economy: one per arm)

Branch `claude/seedling-fidelity-wave-42-aa98bv` at the report's head.
1. **Survey A/B** (`seedling-survey.yml`). On this branch the default is ON, so the ON arm is the branch as is:
   `through=end route=full`. The OFF arm is main `a3a5b8182e` (or the newest main survey at the same rules). Cheaper:
   `only=35,41,84,119,193 through=end route=full`. Expected: as the survey table.
2. **Sweep A/B** (`seedling-divergence-sweep.yml`, `mode=inv producer=solver`, `shards=10`):
   - `keys=` the 57 legs in WallFlyer/Drill rooms + L77, `evidence/dispatch/keys-narrow.txt` (3.2 KB). The 210-key
     variant with the Puncher rooms (`keys.txt`, 13.5 KB) only matters for the chaser-timer arm (`contactHitsTimer`).
     I measured no Puncher-room mover in node. Run the wide one only if the planner wants that arm covered on the page.
   - arm OFF: `contact_fidelity=` `evidence/dispatch/contact-off-arm.txt` (the base's 123 default-ON keys, so
     `corridorBodyPricing` and the memo are OFF);
   - arm ON: `contact_fidelity=` `evidence/dispatch/contact-on-arm.txt` (the same + `corridorBodyPricing,corridorForecastMemo`);
   - `capture_requests=true` only on the 15 keys in `keys-capture.txt` (L27←L28, L88←L12, L88←L87, L22←L29): the ones
     a node replay would decide;
   - `leg_budget_ms` default (90 s); watch the `timeout` column.
3. `seedling-probe.yml battery=standard` on this branch (the default is ON here).
4. `unittests_frontend.yml -f train_only=true` on this branch. The train tier holds the solver/hammer/fidelity pins.
   Locally I ran only the four files in the battery table; the other seven train files of the bounded grep (`fidelityL40Bk2`, `hammerChooserPair`, `hammerEscapeExact`, `hammerLatchWeigh`, `hammerPitWest`, `hammerTurretApproach`, and the L40 hammer pins) are L40/L18 rooms with no wallflyer or drill: only the chaser-timer arm can reach them.

## The JS arc's pins and wiring

- No signature or contract changes. One new `CONTACT_FIDELITY` key (`corridorForecastMemo`): the flashPanel setting,
  `?contactFidelity=` and the worker stamp derive it from `CONTACT_FIDELITY_KEYS`. One new `SOLVER_ENV_NAMES` row.
- `stepWallFlyer`'s new OPTIONAL `ctx.lineHits` is absent everywhere but the forecast. The live step and the room-body
  skin (`seedlingRoomBodySkin.js` has its own `stepWallFlyer`) are untouched.
- No new `SolverRefusal.obstacle.kind`. The walker (`botDriverV2`) is untouched: no `producer:walker` row can move.

## Handed to the hammer arc

- **(b) A wallflyer kill arm and a drill kill arm on the ladder's KILL rung.** These are the only cause of the flip's
  lost solves: survey 35 and 84; legs L27←L28 and L88←L12 ×2. Each OFF plan takes hits, game-confirmed for 35 and 84
  on p4g. At step 35 the chooser picks `bob@96,144`, a body the forecast does not name. The corridor's hit is
  `wallflyer@48,112`.
- **The spear arm at L22 (CONNECTED-L22's residue).** ON, the connected #49 refuses honestly, but it still refuses.
- **Cost:** `planSwordDash`'s per-window previews carry most of the remaining ON wall time (§D2).

## What the brief got wrong (measured)

1. *"Acceptance batch md5 on main: `abb206c88de25e7ba1874510d493ce85`"* (the W36 paragraph): at `a3a5b8182e` it is
   **`391322d6…`**, the value the D1 paragraph quotes as standing.
2. *(a) "4 legs went done → DEADLINE (`shouldStop` at the walk site, 9–12 s)"*: the page's `shouldStop` is a WORK
   count, not seconds. At this base no WallFlyer/Drill leg's answer changes under the 640/85 budget.
3. *(c) "the corridor pricing did not forecast the Puncher"*: the Puncher is a chaser. Its punch is forecast and priced
   (U10, RULESREF). The L12 bosslock damage at the defaults is unbilled by the model itself. It is not a pricing gap
   of this key.
4. *"123 default-ON keys of 134 (count `: true,` in `contactFidelity.js`)"*: the count is right, but the grep reads
   124. One `: true,` sits in a comment; count the object (`CONTACT_FIDELITY_DEFAULTS`) instead.

## Residue

- The drill half of the forecast is not memoised (its "Enemy" test reads moving bodies). The L88/L91 legs keep their ON
  wall time.
- The game witnesses here are evidence files, not committed fixtures. No tape was added: roster unchanged at 293.
- `fidelityCorridorBody`'s whole-solve memo row is blind to m1 (the row-for-row row catches it).
- Wave-17's residue stands: no knockback after a contact in the forecast, no dark-suit retaliation, no ghost-sword swing.

## Byte-inertia

- D2 OFF: the memo is not built; `stepWallFlyer` receives `lineHits: undefined`, so it uses its default. Acceptance
  `391322d6` and bounded vitest 3,872 / 0 at `7c3d5f86`.
- D1 ON: acceptance unchanged, all 293 tape streams unchanged, identity block = OFF except the ENEMY census's drill chamber row.

## Rows to BANK

- survey OFF 215 / 29, ON 214 / 30 (−35, −84, +119; 41 → 126 t clean; 193 → 491 t clean)
- the 56-leg node census: 18 movers, 3 hit-taking solves lost, 1 refusal gained, 0 hitless → hit
- acceptance `391322d6` in every arm; 293 tape streams identical
- surface GREEN 372, constants PASS (with the new key)

Not run: `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or force-push.
