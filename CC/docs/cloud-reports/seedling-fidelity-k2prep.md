# Seedling fidelity K2PREP: K2's licence list, green both ways — and the L75 refutation was a lava chain, not the shake band

| | |
|---|---|
| Session | `seedling-fidelity-k2prep` (wave 11, planner `seedling-fidelity-planning-5`) |
| Start SHA | `99cdf5ce23` (main after wave 10 `d978c76322` + the rules arc's F3) |
| Harness branch | `claude/seedling-k2-lavarunner-bridge-qm44bl` |
| Commits | D1 `1f3d665` · D2 `f6ed543` + `9bfb5f9` (the move into the simulation) · D3 `bed07c5` · D4 docs/evidence `21ffc39` · this report |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS · D4 PASS** — K2 (`KILLLOCK_BODIES.lavaRunnerLive`) still ships OFF, byte-identical; every row the wave-10 harvest saw red is green with K2 OFF and ON |

**The one thing to know first.** The LADDER2 L75 chain witness's K2-ON refutation (161 → 125) was never the shake band.
The game's `LavaChain.reach` hits `"Enemy"` too (`LavaChain.as:76-93`): at t47 the chain's arm hits `lavarunner@104,64`
(`hits 1`, a 5 px/t shove) with the player 24 px away, and the live model had never stepped a chain. With that arm
stepped (`levelRun.stepLavaChainsNow`), K2 ON reproduces the whole 388-row walk at 0 px. The shake band is a different
row's — the GRENADE arms' — and a replay now reads the game's recorded camera on the band's uncertain ticks.

## W0 — bank

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0, python 3.13.16; dev server `serve-nocache.py 9560` |
| identity block (base) | quoted from the bank (`standing-values.json` @ `0b7a2e25`; my base adds only the rules arc's F3, which reaches no seedling producer) and re-measured at my head with K2 OFF (below): every row = the bank | maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated `OK` |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, all exit 0 |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json` in a worktree at `99cdf5ce23`; md5 over sorted `status\tfullName` | **589** pairs, all pass, `73d9d6457056ce0d2ff757edb4d0892a` |
| bounded vitest BEFORE, K2 OFF | the brief's standing set + `fidelityLavaRunner`, `killLockBodiesHook`, `levelRun`, `r4Swim`, `arrivalCompositesLegs`, surface + constants (40 files) | **40 files, 1,552 / 1,552 pass** |
| bounded vitest BEFORE, K2 ON | the same, `SEEDLING_KILLLOCK_BODIES=all` | **10 red**: r8Acceptance ×3, fidelityLadder2 ×2, arrowTrap, enemyDamage, solverBot A3, fidelityKillLock ×2 (below) |

## D1 — the bridge scope (PASS)

**Measurement.** With K2 ON the derived roster (`bridgedChaserTags()`) gains `lavarunner`; the declaration did not. The
lavarunner rooms (atlas, derived) are **L71–L75, L77, L78, L80, L99**. Re-deriving `r8Acceptance`'s exposure from disk
(every committed tape that retires `noDamage`, its recorded stream's levels): exactly **one** tape becomes EXPOSED —
**`axe-l71-reach-l76`** (L71, 327 of its 328 ticks, five lavarunners). Its position stream is unchanged with the
lavarunners stepped (`first divergence -1` both ways), and tapeRunner is byte-identical ON (589 pairs, below). Exposed
83 → 84. Identity: the acceptance batch (`76602ae8`) does **not** move; the ENEMY census does (D4).

**Change.** `R8_ENEMY_BRIDGE.pendingSwitchScope.lavarunner = {switch: 'lavaRunnerLive', exposedAdded: [axe-l71-reach-l76]}`,
typed before the guard ran; `declaredBridgedClasses()` / `declaredExposedRows()` join it to the declaration exactly while
the switch is ON, and `assertBridgeRosterMatchesScope`, `assertBridgeExposureIsMeasured`,
`campaignBridgeCoverageFindings` and both test seams read them. At the flip the harvest folds the row into
`bridgedClasses`/`exposedAdded` (wave 8's precedent) and deletes `pendingSwitchScope`. The roster rows ask both switch
states explicitly (`withKillLockBodies`).

**Mutant (in the suite).** The lavarunner rooms joined with the K2-OFF declaration → *"Undeclared and exposed:
axe-l71-reach-l76"*, as predicted.

## D2 — the L75 witness, measured on the game (PASS)

**Measurement 1 — the chain walk.** `probe-seedling-chaser-mobiles.mjs --class=LavaRunner` on
`ladder2-l75-chain-tape.json`, K2 ON, before any change: the player clock does not calibrate (the walk diverges), and the
first body disagreement is **t47**: game `lavarunner@104,64` `hits 1 / hits_timer 29`, v (−3.93, −0.71); model 0/0. The
player stood at (72, 44.5). `LavaChain.as:21` — `hitables = ["Player", "Enemy"]`; `reach()` calls
`(hit as Enemy).hit(force 5, (x, y), damage 1, "LavaChain")` on the first `"Enemy"` touching the 48x4 arm. The live run
never stepped a chain (only `dangerMap` prices one, for the solver, against the player).

**Change 1.** `levelRun.stepLavaChainsNow` (above the placed grenades: chains are added at `Game.as:2359`, after every
enemy, and `addUpdate` prepends): each chain's anim is `stepLavaChain` at `clock.now()`; while the arm is out it lands
`enemyHit(c, {d 1, f 5, t "LavaChain"})` + `Enemy.knockback` from the chain's entity point on the first touching
stepped chaser (`.oel` order reversed — `collideRect`'s type list). Refusals by name: a census non-chaser `"Enemy"` on
the same arm (cross-family `collideRect` order not transcribed; no chain room has one — measured, every chain rect
against every census body in L72/75/78/99), and an anim made unknown by a skipped `Game.time` (it re-derives at the next
`Game.time % 90 < 1.5` trigger, which replays `extend` from frame 0). **Every chain room holds only lavarunners as
chasers, so with K2 OFF the step returns at its first test.** `run.lavaChainEnemyHits` records each arm that met a body.

⚠ That import made the surface census red (27 rows): `levelRun` importing `hazards.js` pulled it into the simulation
closure and sent `dangerMap`, `encounters` and `solverBot` around the `solverView.js` door. The chain's primitives
(`TIME_PER_FRAME`, `worldFrame`, `spritemapPlay/Update`, `LAVA_CHAIN`, `lavaChainRect`, `rectTouchesBox`,
`createLavaChainState`, `stepLavaChain`) moved **verbatim** into a simulation module, `lavaChain.js`; `hazards.js` stays a
family file, imports them through the door and re-exports them, so no consumer changed (and `encounters.js` was not
touched). The door's `FP_ELAPSED_CLAMPED` row retired (its only reader moved).

**Witness 1.** K2 ON: player exact on **all 388 rows**, **743** lavarunner comparisons, worst |Δ| **0**
(`fixtures/chaser-witness/k2prep-l75-chain-lavarunner.json`). The evidence row is pinned both ways:
`ladder2-l75-chain` — K2 OFF refuted at **t161** (unchanged), K2 ON **no refutation** (−1, 388 rows). Reason: the
lavarunners stepped AND the chain's Enemy arm.

**Measurement 2 — the shake band.** The band refusal the harvest saw (*"whether lavarunner@104,64 is on screen at tick
155 …"*) is `fidelityLadder2`'s **grenade-arm** row (`l2-grenade-l75`, the blast's shake at t155) — and, once that arm
reads a camera, the `l2-grenade-l75-armed-clear` arm (band open from t1). Recorded the game's camera
(`botStatus().camera`, `FP.camera` after `view()`): it equals the model's exact camera on every exact tick from t1, and
lies inside the model's band on 155–159 (shake 4, 3, 2, 1, 0). The boot sample (t0) and the sample at a level re-arm
(t187) read (0, 108) where the settled camera is (0, 80) — they are polled before the load's first `view()`.

**Change 2 (a replay mechanism, not a jiggle model).** `createTapeStepper(tape, { cameraWitness })` — an `opts` field
like `run`, absent on every existing call — hands the run `fn(tick) → {x, y} | null`; `run.witnessCamera(fn)`;
`onScreenNow` reads it **only** where the band is uncertain, and **checks** it on every tick it is asked: equal to the
model's exact camera, or inside the band, else a refusal by name; a load's first tick is never asked (`camFresh`). The
solver, `chaserForecastNow` and every planner never pass one, so `'uncertain'` stays a planning refusal (⚖ never model the
cosmetic RNG). `run.cameraNow` reads the camera back. The chaser probe gains `--camera` (it now runs the game first,
then the model reading the game's camera).

**Witness 2.** Both grenade arms, K2 ON with the game's camera: player exact on 201 rows, **402** comparisons each, worst
|Δ| **0** (`k2prep-l75-grenade-lavarunner`, `k2prep-l75-grenade-armed-clear-lavarunner`). Without the witness the band
refuses at t155 (asserted); a witness moved 50 px off the band, or misaligned by a tick, refuses by name (asserted).

**Mutants (predicted first, copy + restore).** M1 chain Enemy arm removed → K2 ON chain row **125** and the chain witness
red at t47 (as predicted); K2 OFF green. M2 the witness ignored on uncertain → the band refusal at **t155** (as
predicted), in both grenade rows; K2 OFF green. Restored (`grep -c MUTANT` = 0).

## D3 — the controls (PASS)

`run.progress is not a function` in solverBot A3 **is K2's**: a modelled lavarunner sends `resolveKillStrategy`'s press
arm to `derivePressKill`, which asks the stub run for its weapon (measured: icetrap/sandtrap/cactus subjects return the
three refusals ON and OFF; lavarunner throws ON). The control is **`IceTrap`** in `arrowTrap`, `enemyDamage` and A3:
`canHit = false` in the game (`IceTrap.as:32`), so it is refused by the game itself — no bridge, kill arm or model
coverage can flip it (unlike Flyer/Drill/Turret/SandTrap/Bulb, each a mover or a static-sword-arm candidate, and Cactus,
which no level places and which has no combat row for A3). `LavaRunner` is asked under its switch both ways.
`fidelityStance` L8 was green here both ways (the harvest's timeout was load, not K2). `fidelityKillLock`'s defaults
roster is asked AT the defaults, so only its `{...KILLLOCK_BODIES} == DEFAULTS` guard reads the environment (by design).

## D4 — the licence list (PASS) — the COMPLETE K2-ON mover list

| row | K2 OFF (shipped) | K2 ON (`SEEDLING_KILLLOCK_BODIES=all`) | K2 ON by a source flip (`lavaRunnerLive: true`) |
|---|---|---|---|
| bounded vitest (64 files: the brief's set + every `rg -a` hit for what I touched — `stepLavaChain`, `lavaChainRect`, `LAVA_CHAIN`, `witnessCamera`, `cameraWitness`, `cameraNow`, `onScreenUnderShake`, `createTapeStepper`, the bridge asserts, `KILLLOCK_BODIES`, the chaser probe — + `hazards`, `crusher`, `placedGrenade`, `checkProcgenHelp`, `reachClosure`, `headlessChromium`, `gateRoster`, `rowInputKey`, `producerSegments`) | **2,353 / 2,353** | 2,352 + **1** red: `fidelityKillLock` "the process runs at the defaults" (by design) | 2,350 + **3** red — the flip's own pins: `fidelityKillLock` defaults ×2, `fidelityLavaRunner` "K2 still ships OFF" |
| tapeRunner | 589, `73d9d645` (= base) | 589, **`73d9d645`** | (the same modules) |
| identity block | log md5 `cc4834a7…`; every row = the bank | log md5 `b9e57d87…`: **one row moves — ENEMY census `30bcc49c` → `6e5d7787`**; acceptance `76602ae8` and every other row unchanged | — |
| six producer `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, exit 0 | **identical**, exit 0 | — |
| surface census | GREEN, 242 rows (9 new door rows classified) | — | — |
| constants census | `--check` PASS, 5,576 literals (`lavaChain.js` joins the simulation: 8 reviewed selectors) | — | — |
| CI `JavaScript Unit Tests` @ `21ffc39` (the last code head; this report adds docs only) | run **38089503853 success**: vitest (unfiltered) **19,464 / 19,464**, slow battery **253 / 253** | — | — |
| reference `--check` | the 3 rows this slice moved regenerated; the 4 substrate rows differ in this checkout only (submodules absent), as STATICLADDER saw | — | — |

**The ENEMY census mover:** one row — the `lavarunner` chamber's CONTROL solve **155 → 228 t** (the body now chases), and
the summary line *"16 → 15 of 23 CHAMBER rows solve at the control's own tick count"*. The chain arm is not involved (a
synthetic chamber holds no chain).

**Survey — the 14 steps in lavarunner levels**, run locally (`survey-seedling-route.mjs --through=end --route=full
--only=…`; `evidence/survey-k2-levels-{off,on}.json`). K2 OFF: every step's verdict, ticks and refusal = CI
**38075646127**. K2 ON:

| step | level | before (OFF = CI) | after (K2 ON) |
|---|---|---|---|
| 158 | L71 | REFUSED: *"kill work order has no weapon … NO live spinner bodies"* | REFUSED, re-worded: *"chaser kill (lavarunner@64,224) by press: still in the world after the whole 144-tick bound … its chase line is blocked by tile:Dark Stone"* |
| 159 | L75 | REFUSED (ladder: spinningaxe) | REFUSED, re-worded: the bait arm's live roster is `[lavarunner@8,112, lavarunner@104,64]` (was `[empty]`) |
| 160 | L74 | REFUSED (ladder: bulb) | REFUSED, re-worded: live roster `[lavarunner@24,56, lavarunner@208,96]` |
| **161** | L75 | SOLVED 387 t | **SOLVED 364 t** |
| 162 | L71 | SOLVED 327 | identical |
| 164 | L77 | REFUSED (VERB-MISSING, lavatrap) | identical |
| 165 | L78 | REFUSED (VERB-MISSING, lavatrap) | identical |
| **167** | L78 | SOLVED 390 t | **SOLVED 392 t** |
| **168** | L77 | SOLVED 446 t | **SOLVED 480 t** |
| 170 | L71 | SOLVED 193 | identical |
| 189 | L71 | REFUSED (no weapon) | REFUSED, re-worded as 158 |
| **190** | L80 | REFUSED (ladder: lavarunner@0,96 static) | **SOLVED 666 t** (game-exact: STATICLADDER D3's witness) |
| 191 | L71 | SOLVED 171 | identical |
| 200 | L99 | REFUSED (no weapon) | REFUSED, re-worded: *"the count is still waiting on [3 lavarunners] and no stance derives"* |

**Attribution:** K2 ON with the chain's Enemy arm disabled (M1) gives the same rows for every chain-room step (159, 161,
165, 167, 200) — every survey mover is K2's own; the chain arm moves only the witness.

**Sweep legs** (sweep-3 at the wave-9 head; legs re-derived with `seedling-divergence-legs.mjs --presets=seedling_playthrough
--blocks`): 48 legs sit in lavarunner levels and are the K2-ON candidates — L71 595–615, L72 616–619, L73 620–621, L74
622–627, L75 628–631, L77 636–639, L78 640–641, L80 645–647, L99 749–750. Not measured (page-driven); STATICLADDER
predicted 617 and 622 to move.

## The CI dispatches for the planner (I cannot dispatch)

1. **K2 OFF byte-identity, this branch:** `seedling-survey.yml`, ref `claude/seedling-k2-lavarunner-bridge-qm44bl`,
   `through=end`, `route=full`, `only=158,159,160,161,162,164,165,167,168,170,189,190,191,200`, `base_run=38075646127` →
   every row = 38075646127.
2. **K2 ON** (after the licence, on the harvest branch with `lavaRunnerLive: true` — the workflows carry no switch
   input): the same dispatch → the table above (161 364, 167 392, 168 480, 190 SOLVED 666; 158/159/160/189/200
   re-worded; the rest identical).
3. **The sweep, K2 ON** (same branch): `seedling-divergence-sweep.yml` `ids=595,…,615,616,…,631,636,…,641,645,646,647,749,750`
   (the 48 above) — predicted movers.
4. **The witnesses on CI** (K2 ON branch): `seedling-probe.yml` `probes=probe-seedling-chaser-mobiles.mjs`,
   `args=--class=LavaRunner --camera --witness=k2prep-l75-chain-lavarunner` (and `…-grenade-lavarunner`,
   `…-grenade-armed-clear-lavarunner`) → PASS, worst 0. ⚠ The probe's model side needs K2 ON in the job.

## For the JS arc

No JS-arc file was edited, and none of its pins moves with K2 OFF. New, optional, for it to wire if it wants them: the
`createTapeStepper` opts field **`cameraWitness`** (replays of game recordings only — never the solver), and the run
members **`witnessCamera(fn)`**, **`cameraNow`**, **`lavaChainEnemyHits`**. The JS runtime gets the chain's Enemy arm
automatically under K2 (it steps `levelRun`). No new `SolverRefusal` kind, no `solveSegment`/`twoPassSolve`/
`createRunForStaging` change. `jsRuntimeDeclarations` green both ways.

## For the hammer arc

Nothing.

## What the brief got wrong (measured)

1. *"`fidelityLadder2.test.js` ×2 — the L75 chain witness … the model's shake BAND refuses"*: the band refusal is the
   **grenade-arm** row (`l2-grenade-l75`, t155), not the chain witness; the chain row's 161 → 125 is
   `LavaChain.reach`'s `"Enemy"` arm, unmodelled.
2. *"the witness carries the game's per-tick bodies"*: `ladder2-l75-chain-game.json` carries the player only
   (`t, x, y, level`); the bodies and the camera had to be recorded (three new fixtures).
3. *"Pin the evidence row's new refutation tick"*: with the chain arm there is none — K2 ON reproduces all 388 rows.
4. *"9 rows red"*: measured **10** with K2 ON by the environment (`fidelityKillLock` ×2 unlisted; `fidelityStance` L8
   green both ways — its timeout was load, not K2); by a source flip, 3 (all default pins).
5. *"check whether K2 is their cause"* (A3): it is.
6. *"K2-ON movers … survey rows only (190; 158/160/189/200 re-worded)"*: incomplete — **159** re-worded, **161, 167, 168**
   tick changes (L75/L77/L78 steps STATICLADDER never ran), and the **ENEMY census** moves (one row).

## Residue (ranked)

1. **The chain's `"Player"` arm is not billed in the live run** (only the solver's danger map prices it). Any replay
   where a chain hits the player diverges; no committed tape does. Pre-existing; the same `stepLavaChainsNow` is where it
   would go (it would move K2-OFF behaviour, so a licence question).
2. **`Crusher` and `Pulser` also hit `"Enemy"`** (`hitables` include it). Unmeasured against stepped chasers.
3. **158/189**: `lavarunner@64,224` stalls behind Dark Stone (the chaser kill arm's straight line); **200**: no stance
   inside the leash; **159**: the spinning axe; **160**: the bulb (BULB's); **164/165**: lavatrap VERB-MISSING.
4. The bot's t0 / re-arm camera sample predates the load's `view()` — a property of the instrument, named in the probe.

## Byte-inertia (K2 OFF, the shipped default)

tapeRunner 589 = base `73d9d645`; identity block = the bank on every row; six `--check`s identical; the 14 survey steps
= CI 38075646127; bounded vitest 2,353 / 2,353. The chain step returns at its first test in every room without a
stepped chaser beside a chain, and every chain room's only chasers are K2's.

## Rows to BANK

- tapeRunner **589** pairs, `73d9d6457056ce0d2ff757edb4d0892a` (base = head, K2 OFF = ON).
- identity OFF = the bank; identity ON: ENEMY `6e5d7787dd17e301d9865805786968d4` (the licence's one identity mover).
- surface census 242 rows GREEN; constants census 5,576 literals PASS.
- Fixtures: `fixtures/chaser-witness/k2prep-l75-chain-lavarunner`, `k2prep-l75-grenade-lavarunner`,
  `k2prep-l75-grenade-armed-clear-lavarunner` (not roster tapes; replayed by `fidelityLavaRunner` / `fidelityLadder2`).
- Licence questions for the user: **flip K2** with the movers above (survey 158/159/160/161/167/168/189/190/200, the
  ENEMY census row, 3 default pins, `pendingSwitchScope` folded in); separately, whether to bill the chain's Player arm.
