# Seedling fidelity LIGHTSARR — the L69 Lights fight after a real arrival

Slice `seedling-fidelity-lightsarr` (Opus, cloud). Planner `seedling-fidelity-planning-9`, wave 21.
Switch: `CONTACT_FIDELITY.lightsBossFight` (still OFF). No new switch.

| | |
|---|---|
| Start SHA | **`98689e2e3c`** (= main 98689e2e3c, as briefed) |
| Head | the commit carrying this report. Before it: D1+D2 `745b846b`, the census-row fix `40dc7f05`, D3 + records ``6de3ab06`` |
| Branch | `claude/lightsarr-lights-arrival-zpv7ou` (the harness's). Nothing went to `main`; nothing was force-pushed |
| Dev servers | `serve-nocache.py 9707` (primary) and `9708` (the pristine base worktree, for W0) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS** (one survey step moves; see D3) |

## The one thing to know first

**The arrival was not the cause: the shield was.**
- The captured requests already run on the live clock (the seam shift −1 is applied before the solve). Leg 608's plan,
  booted on the game at its own staging, bills the sweep's hit at t170, to the bit of the sweep's game row.
- The first model ≠ game tick is **t154**. The moving player's shield (`Player.shieldBump`) shoves a flier that is
  inside its `hits_timer` (`Enemy.knockback(5, p)`), at t154, t157 and t160. The model had no shield arm for a
  LightBoss, and none of the four LIGHTS witnesses held a shield.
- Fixed in the model and in the verb's forecast. Both legs then re-solve in node and **win on the game at 0 px**.

## W0 — the base (PASS)

Measured in a pristine detached worktree of `98689e2e3c`. Its submodules and `node_modules` are symlinked from the
primary (same gitlinks); its server is on 9708. Evidence: `evidence/w0/`.

| row | result |
|---|---|
| identity block | md5 of every row but `generated set` and the reference lines **`890aa5b6`**: maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, level pre/post `e28c1e5d`/`fb1a59e5`, generated set **OK** (re-run with the primary's venv: the worktree has none) |
| producers | battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `0dd65640`: **all exit 0**. The r9-campaign exit 1 that LIGHTS recorded at 934f99422b is gone at this base |
| reference | **4 generated regions DIFFER at the pristine base** (pre-existing; regenerated below) |
| tapeRunner pairs | **635 `e1648386`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN 335 · PASS (6528) · PASS 566 · PASS 138 · **289** |
| bounded vitest BEFORE | **74 files / 2052 green**: the brief's list, plus every test file that names a function I touch. `apReportBosses` is `fidelityApFlip.test.js`. The two `.slow` files are excluded by the default config and run separately |

## D1 — the arrival, witnessed on the game (PASS)

**The captured requests** (run 39626706339, `capture_requests`; arm = the 36 defaults + `lightsBossFight`, read off
each plan's `contactFidelity` stamp):
- `arrivalClock` reads begin 5433, model 5454, live 5453, shift −1.
- `arrivalOnLiveClock` applies that shift to the staging before the solve. The captured request's `staging.seam.time` is
  **5432** (607: 5429), and `shipClock` reads staged 5432 / game 5453.
- So the plan's tick 0 is the live clock. The brief's "5454 vs 5453" is the reading before the shift, not the clock the
  solve ran on.

**Replayed in node.** `replay`-style dispatch (`evidence/tools/solve2tape.mjs`) gives the page's own answers: 608 616 t,
607 604 t. The model's track (`track.mjs`) shows no hit at t170; the player stands at (58.899, 100.011) from t162.

**Played on p4g** (`probe-seedling-lights.mjs --compare`, headless, port 9707). Leg 608's plan from its own staging (boot
L69 (48,128), seam 5432) bills **hits 1 / timer 19 at t170**, at (58.89857113260393, 102.70749889921584). Those are the
sweep's game-row bits exactly, so the boot-staged replay IS the arrival as the sweep's game saw it.

**The first tick where model ≠ game is t154** (positions equal, velocity not):

| t | game flier 0 v | model flier 0 v | flier 0 `hits_timer` | player |
|---|---|---|---|---|
| 153 | (0.88, 1.21) | same | 17 | (66.85, 100.01), walking left |
| **154** | **(−2.92, −2.02)** | (0.90, 1.20) | 16 | (65.50, 100.01) |
| 157 | (−2.69, −2.28) | — | 13 | |
| 160 | (−1.90, −2.96) | — | 10 | (59.45, 100.01) |
| 170 | contact: the player is hit | no contact | 0 | |

- The source is `Player.shieldBump` (`Player.as:1691-1709`): `if (shieldObj && v.length > 0)`, every `Enemy` in the
  shield box is shoved by `o.knockback(shieldForce = 5, Point(x, y))`, whatever its `hitsTimer`.
- `LightBoss` overrides no `knockback`.
- `levelRun.shieldBumpNow` had arms for chasers, spinners, wallflyers, ice turrets and the bob boss, none for the
  fliers.
- Both legs carry `hasShield`. The LIGHTS witnesses booted with the sword only.

**Is it the clock, the intro after a fall-in, or the controller's first update?** None of them:
- The clock: the boot-staged replay at the shifted seam reproduces the game. With the fix, so do 617 ticks of it.
- A real pit fall: `lightsarr-arrival` is booted in L70, walks down into the pit and falls into L69. It drops from the
  ceiling to (56,53), lands, bounces and settles at (56,130.9) about 86 ticks after the crossing, with input ignored.
  Then the intro is paged and a scripted fight runs (48 shots, 26 press hits, 1 shot hit).
  - It reproduces at 0 px for 541 ticks: the first L69 tick is t20 at clock 5493, the intro and the controller's
    first updates included.
  - It reproduces even with the shove mutated out, because its shield never touched a flier. The arrival itself was
    never the fault.
- `--seam-time-sweep` (D3): the fixed solve's answer is a PLAN at every seam time from −3 to +3, for both legs.

## D2 — the model (PASS)

All behind `lightsBossFight` (OFF: `lightsShieldBumpNow` returns before touching anything, and the verb is never
registered).
- **`lightBoss.js`:**
  - `lightBossKnockback(f, force, from)`: `Enemy.knockback` with musl trig and the `!destroy && currentAnim != "die"`
    gate. `lightBossFlierHit`'s knockback now calls it, with the same bits.
  - `lightsShieldBump(fight, {player, rendered, slashing, dark})`: `shieldBumpTouches` (the shared box and gates), then
    the shove.
  - ⛔ The dark shield on a flier whose `hitsTimer <= 0` (`o.hit(5, p, 0.5, "Shield")`) is refused by name. It is
    unwitnessed on a LightBoss.
- **`levelRun.js`:**
  - `lightsShieldBumpNow`, in the LIGHTS region. It is called from `shieldBumpNow` as one added line, after the
    held-shield gate. That is the player's update, after the fight stepped this tick.
  - The box is read off `shieldRenderState` (the previous frame's render); the gate and the point off the live
    `state`.
  - Rows go to `shieldBumpLedger` (family `lightboss`) and to the fight's ledger (`shield-bump`).
- **`lightsVerb.js`:** the forecast steps the same shove at the top of the player's update (`env.shield`). The verb
  refuses `cannot-act` with the dark shield held.
- **`solverView.js`:** one added export line (`lightsShieldBump`).
- **Witnesses** (`fixtures/lights-witness/`, `probe-seedling-lights.mjs --compare --record`; each recorded twice, both
  PASS):
  - `lightsarr-shield`, 617 t: leg 608's original plan. The hits at t170 and t195, the death at t271 and the respawn.
  - `lightsarr-arrival`, 541 t: the real pit fall above.
- **Test:** `fidelityLightsArr.test.js`, 9 green.
  - Both witnesses at 0 px.
  - The t154/157/160 shoves and the t170 bill, at the sweep's bits.
  - The arrival's t20 / clock 5493.
  - CONTROL: the shield witness with `hasShield` taken away fails at `t 154: flier 0`.
  - The shove's arithmetic (musl), the standing and off-box cases, the die-anim gate, and the dark-shield refusal.
- **Mutants**, predicted first, made by copy and restored by copy (`evidence/mutants/`):
  - **M1**, `lightsShieldBump` returns no rows. Predicted: `lightsarr-shield` fails at t154, and the arrival
    witnesses are indifferent. Measured: FAIL at t154 (2187 disagreements); `lightsarr-arrival` and the vacuous pit-fall
    run PASS.
  - **M2**, the box off the live player instead of the previous render. Measured: FAIL at t195 (flier 5, the box after
    the contact shove at t170).

## D3 — movers (PASS, with one survey mover)

**Re-solved in node with the fix** (the captured requests, unchanged), then played on p4g:

| leg | before (run 39626706339) | after: node | after: on the game |
|---|---|---|---|
| 608 `level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights` | 616 t, diverged at t170 (1 hit) | **672 t** | PASS 0 px over 667 sampled ticks; **0 hits**; {69,0} at t671 |
| 607 `… -> exit:out_lightbosscontroller_72_72` | 604 t, diverged at t171 (1 hit) | **680 t** | PASS 0 px over 678 sampled ticks; **0 hits**; {69,0} at t665; ends in **L36** |

**Seam census** (`replay-seedling-solve-request.mjs --seam-time-sweep=-3..3`, `evidence/d3/census-60*.log`):
- 608 gives 7 distinct answers over 5429–5435, and every one is a PLAN.
- 607 gives 7 distinct answers over 5426–5432, every one a PLAN.
- The answer varies with the seam (as LIGHTS' verb does: the fight is phased on `worldFrame`), but it never flips to a
  refusal.

**The LIGHTS witnesses:**
- `fidelityLights.test` (17) is green.
- `fidelityLights.slow.test` re-solves sword and spear key for key (2 green, 45 s).
- Nothing boot-staged moved: none of the four holds a shield.

**The route survey, ON** (local; the brief's `163` is **159** at this base: the rules moved, so steps are matched by
level and goal):

| step | base `98689e2e3c` ON | this branch ON |
|---|---|---|
| 158 L70 reach-pit | SOLVED 105 t | SOLVED 105 t |
| **159 L69** clear-tag {69,0} then reach-exit | SOLVED **559 t, 0 hits**, 18 s | SOLVED **823 t, 1 hit**, 135 s |
| 160 L36 reach-exit | SOLVED 50 t | SOLVED 50 t |

- The survey's staging holds the shield (granted at step 36), so the fight is now the game's fight.
- The kill ends at t806, and **the one hit is at t811, after the fight**. A `LightBossShot` still in flight catches the
  generic reach-exit walk to the Teleporter. The danger map does not see the fight's shots (LIGHTS hand-over 2, the
  hammer arc's region), so this is a planning gap, not a fidelity one: the model bills the hit the game would.
- The verdict stays SOLVED. The 135 s was measured at load ≈ 6 and is below CI's 1500 s per-step bound. ⚠ The local
  default `--timeout` (120 s) reads TIMEOUT under load.
- OFF, no survey row can move: the switch gates every new line.

**The bounded set with `lightsBossFight` ON** (75 files): **4 red, exactly the four flip pins LIGHTS named**:
- the `contactFidelity.test` defaults;
- `enemyDamage.test`'s refused floor;
- `fidelityApFlip`'s Lights room;
- `fidelityLights`' OFF-default row.

None is new. `evidence/after/vitest-after-on-summary.txt`.

## The CI dispatches the planner should run

1. **`seedling-divergence-sweep.yml`**, branch `claude/lightsarr-lights-arrival-zpv7ou`, **×2**, `capture_requests=true`:
   - `keys='level_69 <- in_pit_L70_3_8 -> exit:out_lightbosscontroller_72_72|level_69 <- in_pit_L70_3_8 -> location:Level 069 - Lights'`
   - A: `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,apReportBosses,guardApproachStance,coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight,lightsBossFight` (the 36 default-ON keys + `lightsBossFight`, comma-separated;
     ⚠ the input turns every unlisted key OFF).
   - **Expect:** both legs `done`, `roomHits.max 0`; 607 crosses to L36; 608 reports {69,0}. Before this fix both
     legs diverged at t170/t171.
   - B (control): the same, without `lightsBossFight`. Expect the pre-LIGHTS-wiring refusals, unchanged from main.
2. **`seedling-survey.yml`**: there is **no `contact_fidelity` input** in this workflow, so a CI ON arm needs a branch
   with the default flipped (or a new input, the JS arc's or the planner's call). An OFF run on this branch,
   `--through=end --route=full` with `only=158,159,160` and `base_run=39496129402`, should equal main (inert).
3. Optional: the sweep's `seam_census=-3..3` on the A arm, to confirm the node census on the runner.

## The JS arc's pins, and what it must wire

- **Nothing to wire.** No `run.*` field was renamed or reshaped.
- Added, ON only: `shieldBumpLedger` rows with `family: 'lightboss'` (read through the existing `shieldBumpsNow`), and
  `lightsEvents` rows `what: 'shield-bump'` (inside `run.entities('lightsFight')[0].events`).
- No `SolverRefusal.obstacle.kind`, no staging field.
- The shared arrival clock, `wasmArrival.js`, `createRunForStaging`'s seam and the sweep's staging are untouched and
  **not implicated**.
- A note for the JS arc's script: `replay-seedling-solve-request.mjs --seam-time-sweep` prints a successful PLAN with
  the kind `error` (`r.kind ?? 'error'` in `summarizeCensus`).

## Hand-overs

1. **Hammer arc** (danger map / `stateDigest`): LIGHTS' hand-over 2 now has a measured victim. Survey step 159's
   reach-exit walk after the kill takes a hit at t811 from a shot still in flight. Pricing the fight's shots needs the
   digest to cover `lightsFights`, `lightsExits` and `lightsSpearRepeats` (LIGHTS' list; this slice adds no new run
   state the escape reads: the shove mutates the existing `lightsFights` bodies).
   - An interim inside the verb ("wait out the shots before returning") was not taken. It would move the two LIGHTS
     solve fixtures that the slow test pins, and the planner-side fix belongs where the walk prices danger.
2. **The dark shield on a flier** (`o.hit(5, p, 0.5, "Shield")`): refused by name in the run and as `cannot-act` in the
   verb. To be modelled when witnessed.

## Deltas

- New files: `fidelityLightsArr.test.js`, `fixtures/lights-witness/lightsarr-shield.json` and `lightsarr-arrival.json`.
- Edited:
  - `lightBoss.js`: two exported functions and one import; `lightBossFlierHit`'s knockback calls the first.
  - `levelRun.js`: one import line, one call line in `shieldBumpNow`, and `lightsShieldBumpNow` in the LIGHTS region.
  - `lightsVerb.js`: an import, the forecast line, the `env.shield` field and the dark-shield refusal.
  - `solverView.js`: one export line.
- Censuses:
  - surface `--write` (GREEN 336: `lightsShieldBump` classified seedling/function);
  - constants (`lightsShieldBump` structural row, written by `--profile-rows` and then `--write`; PASS 6531);
  - entities PASS 566 and profile PASS 138, unchanged.
- The reference: `docsIndex.js` / `instruments.js` and their two doc regions regenerated (the new log entry cites a script). The four regions that already differed at W0 (`registry.js`, `capabilities.js`, `substrate-registry.md`, `procgen-substrates.md`) were NOT regenerated: in this container they drop the `noiz2sa` substrate because `frontend/modules/bulletml-dodge` is not checked out by `session_bootstrap.sh --seedling`. That is environmental, not drift; a regeneration here would delete about 1,400 real lines.
- No tape index or roster change (289). No committed tape moved. No producer digest moved (below).

## What the brief got wrong (measured)

- "The arrival clock reads model 5454 vs live 5453". That is the reading BEFORE `arrivalOnLiveClock` applies the shift.
  The captured request is staged at 5432, so tick 0 is live 5453, and the solve ran on the live clock.
- "Suspects the clock phase at a wasm arrival". The cause is the player's shield shoving a flier (t154). The same plan,
  boot-staged, fails identically.
- "The LIGHTS witnesses were boot-staged, never a pit arrival". True, but the gap they left was the inventory (no
  shield), not the arrival.
- The sweep's arrival is itself not a pit fall. It is a held re-arrival at the rules' landing (48,128) after 19 dead
  frames. A true pit fall from L70 drops from the ceiling to (56,53) and bounces for about 86 ticks.
- Survey step "163" is **159** at this base (the rules moved).
- LIGHTS' survey dispatch names a `contact_fidelity` input that `seedling-survey.yml` does not have.
- The brief's bounded list missed `seedlingConstantsCensus.test.js`. My
  first push went red on it (CI 39645021020, a quoted CSV row) and was fixed in `40dc7f05`.

## Residue

- The post-fight shot in the reach-exit walk (hand-over 1).
- The dark shield on a flier (hand-over 2).
- LIGHTS' wand arm (unchanged).

## Byte-inertia (OFF)

- Identity block AFTER: rows md5 **`890aa5b6`** = W0 (`diff` of every row: empty; `generated set` OK on both; every producer exit 0 with the W0 digests). The reference reads the same 4 environmental regions as W0 after the regeneration.
- tapeRunner pairs AFTER: **635 `e1648386`**, the same as W0.
- Bounded vitest AFTER, OFF: **75 files / 2061 green**. That is W0's 74 / 2052 plus `fidelityLightsArr`'s 9. Then
  `seedlingConstantsCensus.test.js` (24) after the fix.
- Censuses: surface GREEN 336, constants PASS, entities PASS 566, profile PASS 138, roster 289.

## CI at the pushed heads

- `745b846b` (D1+D2): run 39645021020, shard 3/3 red with **1 failure**, `seedlingConstantsCensus.test` (v). My
  hand-added `lightsShieldBump` fields row was quoted, where `--profile-rows` writes it bare.
- `40dc7f05` (the fix): a CSV-only commit, so the path filter did not run the JS tests. The test passes locally (24).
- `6de3ab06` (D3 + records): run 39648600893 is **green**: unfiltered 21657 passed / 0 failed (884 files); slow
  battery 261 / 0.
- This report's commit touches only `CC/docs/` (no JS run is expected); `6de3ab06` is the last head with code.

## Rows to BANK

- `lightsarr-shield` 617 t and `lightsarr-arrival` 541 t, game witnesses at 0 px.
- The first model ≠ game tick of legs 607/608 is t154, the shield's shove (flier 0 at `hits_timer` 16).
- Legs re-solved with the fix: 608 672 t and 607 680 t, both 0 hits on the game, 607 in L36.
- Seam census −3..3: a PLAN at every time, for both legs.
- Survey ON step 159: 559 t / 0 hits → 823 t / 1 hit (t811, a post-fight shot).

## Records

- `seedling-bot-log.md` § *Seedling fidelity LIGHTSARR*, with three trap candidates:
  - a witness set with one inventory misses that inventory's arms;
  - the sweep's arrival is not a pit fall;
  - the census summary's `error` label on a PLAN.
- Evidence is in `CC/docs/cloud-reports/seedling-fidelity-lightsarr-evidence/`: `w0/`, `d1/` (the tapes and the game
  frames), `d3/` (the fixed tapes, the census, the survey rows), `after/`, `mutants/`, `tools/`.
