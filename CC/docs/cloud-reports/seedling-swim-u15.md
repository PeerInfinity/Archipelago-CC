# Seedling swim U15: the turret is transcribed, the solver dodges its spit, and the campaign chain walks all 30 route steps

**Slice:** `seedling-swim-u15`, an Opus build slice run in the cloud (⚖ Q47, 2026-10-02: *"Yes, one slice"*). It was licensed to:
- transcribe `Turret` + `TurretSpit` as a simulation family, witnessed on the game first;
- let the solver price the spit;
- resume the campaign chain from route step 27 through L31, L30 and L32's encounter, or stop at the next unmodelled event.

| | |
|---|---|
| Started from | `origin/main` @ `1beafce6fc` |
| Head | this report's commit, on top of D4 `baa004f` |
| Harness branch | `claude/turret-spitfire-chain-pji829` (the harness pins it, not `seedling-swim-u15`) |
| Commits | D1 `98cc332` · D2 `f5d5061` · D3 `2a30842` · D4 `baa004f` · this report |
| Dev server | `scripts/serve-nocache.py 8960`, `SEEDLING_PORT=8960`, build `seedling_bot_ap_p4e`, headless logic-only |
| Siblings | R2 and the JS arc's S0. I edited none of R2's regions (`camera.js`, `levelWorld.js`, `watchManual`, its `levelRun` regions), and none of `solveSegment`'s entry, the `:9516` refusal or `createRunForStaging`. `levelRun.js`'s edits are a new family block (state, `stepSpitsNow`, `stepShootersNow`, `stepShootersThroughFreeze`, `spitForecastNow`, the `shooters`/`spitEvents` folds) plus their slots: two `advance` lines, two per-visit resets, one transition drop and one line after a pickup's ceremony starts. |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced. U14's refutation re-emitted from a scratch producer copy and recorded headless: t196 (108.424, 149.268) against the model's (109.05, 151.70), `hits` 1 vs 0, no Green Key. |
| D1 | **PASS, witnessed first** | `turret.js` + `levelRun`'s spit and turret slots. The game confirmed the AS3 reading to the bit: 625 per-tick comparisons of turret angle/animation and spit position/velocity against the prediction, **worst \|Δ\| 0**, the spit hit at the predicted **t80** and the shield block at the predicted **t77**. Mutant: 1 red / 431 at t80, as predicted. tapeRunner 431/431. |
| D2 | **PASS** | `run.spitForecast()` + `dangerMap.spitDanger` + a conditional **DODGE** rung. Route step 27 refuses AVOID by the spit's name, stalls one tick at walk-offset 183, and solves in 379 t with no spit landing. Mutant (the pricing off): 3 red / 4 as predicted; U14's walk and its t196 hit reappear. |
| D3 | **PASS: the chain reaches the route's end** | Steps 27–30 (`r9-solve-29`, `-31`, `-30`, `-32`) all recorded on the game and reproduced by the model, clocks exact, zero hits. One producer gap was found and fixed on the way (an encounter's slot equip was dropped from the replay and the tape). |
| D4 | **PASS** | `earns` + `fire@L32`; frontier **covered 30, `complete: true`**, 4/0; campaign `--check` `f2873fcb → 975e2f48`, the other five identical; census **30/30, 11,035 t, NO CHAIN ROOM MOVES**; the whole-chain differential (below). |

**The one thing to know first.** The chain now walks **all 30 route steps** of the 2.2 route, from the true start to the Bob Boss's pit (**30 windows, 11,035 ticks**), each window recorded on the game and reproduced by the model. But **the JS continuation does not**: a resumed window's `equips` are not applied (`tapeRunner`'s resume path skips the window's staging by design, and nothing hands the equips over the way the census and the page hand over timed clears). So `?tapes=r9-campaign` on the JS side, and the census's whole-chain row, never equip the Fire at window 30's t840: the continuation ends in L32 (72.1, 34.1), where every per-window run falls to L30 at t976. The census still reads NO CHAIN ROOM MOVES, because it asserts the boundaries, not the end. It needs an `equips` hand-over beside `addTimedClears` (see Residue).

## W0: the banked rows (at `1beafce`)

| Row | Result |
|---|---|
| `identity-block.sh .` (`SEEDLING_PORT=8960`) | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `3910ee23…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…`. **Every row equals the bank.** |
| generated set | ⚠ the block's row printed a box-lock refusal: my scratch producer held the lock. Re-run alone with `SEEDLING_PORT=8960`: **OK**. |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 f2873fcb`, all exit 0 (= the bank) |
| reference | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH (I kept every new file out of the tree until this ran: U14's scratch-copy contamination) |
| U14's refutation, reproduced | Scratch producer copy (step 27 appended, run from the scratchpad with absolute imports). The 26 committed segments re-emitted **byte-identically**; `r9-solve-29` at 383 t. `--record --only=r9-solve-29`: *"tick 196 differs: expected (x=108.42416035523557, y=149.2682929719388, level=29), got (x=109.05000000000003, y=151.7000000000001, level=29)"*; *"hits … game 1, model: 0"*; *"hasKey … game: [true,false,…], model: [true,true,…]"*; *"192 dead = 150 modelled … + 42 residue … OUT OF BAND"*; *"save.time … game 16101, model 16099"*. Identical to U14's readout. The scratch tape, trace and recording are in the session scratchpad only. |
| the same walk, predicted by `turret.js` alone (before any model step) | `turret@80,176` plays at t70 (entered range at t30, + 40), t124, t178; spit `#3` spawns at t184 and **hits on the t196 update**. U14's attribution confirmed. |
| bounded vitest BEFORE (21 files) | **1,294 / 1,295.** The one red is `rosterCategories`' banked composite row (*"expected 31 to be 35"*), the coordinator's `standing-values`. |
| quoted from the bank | tape index 185 · tapeRunner 427 (measured: 431 after D1's +4) · surface 189 · constants 4,730 · profile 138 · entities 474 (472 witnessed) · R8 `exposed` 37 · census 26/26 9,054 t · frontier 4/0 |

## D1: the Turret family (`98cc332`)

### The order and the mechanism, as read (`Enemies/Turret.as`, `Projectiles/TurretSpit.as`, `Enemy.as`, `Mobile.as`, `Spritemap.as`, `World.as`, `Entity.onScreen`, `FP.angle_difference`, `Player.as`'s shield entity)

- **Order.** `loadlevel` adds turrets at `Game.as:2272`, after the Player (`:2227`) and just before `iceturret` (`:2273`); `addUpdate` prepends, so the turrets update **after the ice turrets and before the player**, the last placed first. A spit is added at run time by `endAnim`, so it is prepended at the end of the frame and updates **first** on every later frame (the blasts' slot).
- **The aim and the clock** (below `if (Game.freezeObjects || destroy || "die") return`): `var d:int = FP.distance(...)` **truncates**, then `d <= 64`. In range and not mid-shot, `angle += angle_difference(-atan2(dy, dx), angle·π/180)·180/π / 10`; `shootTimer` counts down, and at 0 re-arms 40 and plays `"startshot"` (gated on `hitsTimer <= 0`). Out of range, and on **every tick of either shot animation**, `shootTimer = 40`. `shootTimer` is seeded 0.
- **The animation clock.** Both shot animations are two frames at rate 10, and `FP.elapsed` is pinned at 0.0333, so each wraps on its **7th** update (0.333 × 3 = 0.999 misses `>= 1`). `Spritemap.update` runs in `World.update`'s slot right after the entity, outside the freeze gate. ⇒ **a play at T spawns at T+6, the spit first moves at T+7, the turret idles at T+14, the next play is T+54** (`TURRET_CADENCE`, simulated). In range from a room's first frame, the first play is tick one; walking into range at E, the play is E+40.
- **The spit.** `Mobile` with `f = 0` and `solids = []`: friction's zeroing tests still run (an axis under 0.05 is zeroed for good), then 1 px sub-steps, then `collideTypesInto(["Player","Tree","Solid","Shield"])`. A Player contact is `hit(null, v.length, Point(x, y))`; any contact removes the spit. Then `if (!onScreen(12)) remove`. The `"Enemy"` switch arm is dead (not in `hitables`).
- **`"Shield"` is the player's own shield entity** (`Player.addShield`, `type = "Shield"`), boxed by `Player.render` on the facing side (`bobBossFight.playerShieldRect`, the previous frame's render). A spit that meets it first dies with no hit.
- **The damage path.** `e = null`, so no dark-suit retaliation (R1's table): `applyPlayerHit({ source: 'spit', force: v.length, retaliate: null })`.
- **The turret's own damage** is refused, not modelled: a press reaching a turret is refused by the press audit (`KILL_ARM_POLICY.Turret`), so `hitsTimer` stays 0. Its 16x16 body contact is the census scan's, unchanged.
- ⚠ **The spit's ctor plays `"Turret Shoot"` with `intInd = -1`**: one `Rng.cos()` index draw per spawn (the cosmetic stream under `rng.split`). The model transports the streams and simulates no draw.

### The witnesses (`plan-seedling-u15-turret.mjs`, `--check`), recorded on the game BEFORE the family was wired

Staged from route step 27's latch (`r9-solve-22`'s measured L29 arrival, the header of the scratch `r9-solve-29`), at (44,220): 56.9 px from `turret@80,176`'s centre, out of the other two's range. The first stance, (40,200), put `tree@32,160`'s corner on the line of fire: the prediction showed spit #2 dying on it at t69, and the stance moved before anything was recorded.

| tape | arm | prediction (`turret.js` beside the model's player) | the game | the model after D1 |
|---|---|---|---|---|
| `u15-turret-spit` | `left` tapped at t0 (shield WEST), stand to t100 | plays t1 (angle −14.07°), t55 (−140.07°); spawns t7, t61; #1 dies on cover at t32; **#2 HITS at t80** | hits 1; the old model is refuted at **t80** (39.67 vs 42.30) | all 101 observations, hits 1 |
| `u15-turret-shield` | `right` tapped (shield EAST) | the same plays; **#2 dies on the SHIELD at t77** | hits 0 | all 101 observations, hits 0 |

`probe-seedling-u15-turret-mobiles.mjs` reads the game's `botMobiles()` (every `Turret`'s `angle`, `anim`, `anim_index`; every `TurretSpit`'s x, y, vx, vy) on every tick:
- against the **prediction**, before the model step: 284 + 341 comparisons, **worst \|Δ\| 0**, 0 disagreements;
- against the **model**, after it: 347 + 344 comparisons, **worst \|Δ\| 0** (the whole tape, through the knockback).

The differential over the two (`--only=`, no record): **53 PASS / 0 FAIL / 37 SKIP**, `hits` 1 = 1 and 0 = 0, the clocks exact.

**Mutant** (predicted first: the roster empty ⇒ `u15-turret-spit` reds at t80, nothing else). **Measured: 1 red / 431, "tick 80 differs: expected (x=39.67…), got (x=42.30…)".** The restored `levelRun.js` is `cmp`-identical.

**Parity.**
- tapeRunner **431/431** (427 + the witnesses' 4); every old row passes.
- The committed tapes that enter a turret room (L29/59/62/65): `r2-walk-4-spear`, `r2-walk-full`, `r3-walk-4-spear`, `r3-walk-full`, `r4-walk-4-approach`, `r4-walk-5-spear`, `r4-walk-6-health`, `r4-walk-full`, `r5-bosskey-leg`, all `noDamage`, and `r9-solve-22`, which ends on its L29 arrival (no L29 frame runs). Under `noDamage` the spits DO spawn and fly and are removed, and `Player.hit` returns at its first line: unobservable in a stream. An undecidable cull under a shake band is refused by name only when `noDamage` is off.
- The identity block at D1 (a worktree at `98cc332`): every row identical; the five `--check`s and the campaign `--check` (`f2873fcb`) identical.

**Census rows.** Entity records `turret` + `turretSpit` (md5 `143e37e6 → f1a4c74f`); the `shooters` entity family (the run fold, `entityBlocks`, the surface doc's table) and the `spitEvents` ledger; constants 4,730 → 4,834; surface GREEN 189 (`runObject` 186, 57 simulation files); the R8 live-bag batch `+stepSpitsNow`.

## D2: the solver prices the spit (`f5d5061`)

- **The forecast.** `levelRun.spitForecastNow` (`run.spitForecast()`) steps clones of the room's turrets and spits with `turret.js` against the PREVIEWED player, in `advance`'s order, with the blast-cover query and the shield box. It leaves out the cull (a spit flies on: forbids more) and the hit (a preview takes no knockback).
- **The danger map.** `dangerMap.spitDanger`, ingredient (g): TRANSIT reads the sample's own forecast spits; WAIT sweeps the live spits along their velocity for the horizon. `TRANSIT_INGREDIENTS.spits` is the second player-coupled, at-ETA row (the chasers' shape; `dangerMap.test` names it as the design change).
- **The ladder.** ⛔ A spit is the walk's own timing, not a static volume, so **AVOID is refused by name** when every reason is a TurretSpit. Measured: before that, AVOID on L29 chose a corridor that stalled 400 ticks pressing `up` into `tree@32,160`, and its truncated preview "probed clean". The new conditional rung **DODGE** (`ESCALATION_LADDER`: avoid → dodge → pull → time → bait → kill): `previewWalk`'s new `stall: {at, ticks}` searches walk-offsets back from the hit (step 4) and stalls of 1..30 ticks; the whole walk must probe clean; it drives to the stall's end and re-plans. At most 12 stalls a segment.
- **Unit rows** (`turretSolver.test.js`, 4): WAIT names a live spit (`turret@80,176#2` at t70); TRANSIT prices only the forecast's spits; step 27 from its own staging refuses AVOID, DODGEs **`turret@80,176#3`** (the spit that hit U14's walk) with a 1-tick stall at walk-offset 183, and solves in **379 t**: keys {0, 1}, the L31 arrival, no `hit` in `spitEvents`.
- **Mutant** (predicted first: the ingredient out of `dangerAt` ⇒ the WAIT row's `dangerAt` line and both solve rows red, 3/4). **Measured: 3 red / 4.** The solve reverts to U14's walk; the model takes `turret@80,176#3` at **t196** (knockback north 2.67, as on the game), then refuses at the button skirt 46 ticks later. Restored, `cmp`-identical.

## D3: the chain resumed (`2a30842`)

U13's step 27–30 declarations restored verbatim (`ee34b23`); the producer emits headless. The 26 committed segments re-emit byte-identically (every latch reused from its cache key).

| # | segment | route step | rooms | survey (U13) | solved | game (`--record --only=` the four) |
|---|---|---|---|---|---|---|
| 27 | `r9-solve-29` | 27 | L29 → L31 (the Green Key) | 383 | **379** | 380 obs; 190 dead = 150 pickup + 40; clock 16095 = 16095; hits 0; `hasKey` [T,T] |
| 28 | `r9-solve-31` | 28 | L31 → L30 | 336 | **336** | 337 obs; clock 16451 = 16451 |
| 29 | `r9-solve-30` | 29 | L30 → L32 | 210 | **210** | 211 obs; clock 16681 = 16681 |
| 30 | `r9-solve-32` | 30 | L32's Bob Boss → the pit to L30 | 1,056 | **1,056** | 1,057 obs; 364 dead = 174 rock + 150 pickup + 40; clock 18081 = 18081; the Fire, `primary` 1 |

`--record`: **ALL CHECKS PASSED, 101 PASS / 0 FAIL / 37 SKIP**, and *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"* on all four. The producer's own latch drive found each of 27, 28 and 29 a calm arrival on the game.

**The producer gap step 30 found.** The first emit read *"FAIL: r9-solve-32: a TERMINAL segment crosses only its encounter's pit … [] · ends in L32"*, while `solveSegment` alone, from the same boot, fell to L30 at t976. An encounter equips its item's slot one tick after the flag (`out.equips`, the Fire's at t840); the producer's two-pass REPLAY and its emitted tape both dropped the solver's equips, so the replay never fired, never burned the tree and never fell. The survey has carried them since U5. The producer now does too (replay, tape, provisional latch), and under `--check` a committed tape's equips are its own (the latch carries none), not the boot's. Every committed segment's equips are empty, so no committed byte moved.

**U5's staged `swim-u5-bobboss-encounter` against the chain's `r9-solve-32`.** Both boot at L32 (72,120) and run 1,056 ticks. Their staging differs: the chain carries 24 more cleared flags, its own seam clock, `rock_set` true, `grass_cut` 523 and a different RNG. **They agree:** the held keys are identical on all 1,056 ticks (the raw `inputs` encodings differ, the decoded sets do not), both equip slot 1 at t840, both fall to L30 at t976, and the game's two recorded streams are identical at all 1,057 observations.

## D4: the declaration, CI and records (`baa004f`)

- **`earns`**: the whole-chain differential read *"EARNED but not declared: fire@L32"*; added. The goal ledger now stands at 5/41 for the chain. ⚠ **The Green Key is held and not credited**: the game's `hasKey[1]` goes 0 → 1 in `r9-solve-29`, but `bosskey@112,64` carries no tag and nothing else in L29 is cleared, so the `key` row's placement witness (`GOAL_PLACEMENT_WITNESS.key`) finds no clear in its level. L19's key is credited only because the ShieldBoss clears {19,0}/{19,1} in the same window.
- **`clears`**: none of the four declares a timed `at` clear; `stagedClearFindings` reads no new row.
- **Ends-meet**: `endsAt` is derived; the producer's arithmetic reads 11,035 = the segments' sum, and the free oracle passes at all three new boundaries (*"r9-solve-31 declares seam.time 16074 — 15525 + 190 − LOAD_FADE_FRAMES + 379"*, `-30` 16430, `-32` 16660).
- **The frontier** needed a through-2.2 survey on disk: `survey-seedling-route.mjs --through=2.2 --out=… --only=27,28,29,30 --timeout=1500` → *"4/4 route steps SOLVE today"* (379, 336, 210, 1056). `--write-frontier` → **covered 30, `lastArrival` {step 30, L30, r9-solve-32}, `complete: true`**: *"the chain walks all 30 route steps … there is no next room on this route"*. `--check-frontier`: **4 pass / 0 fail**.
- **The census** (`--no-write`): chain **30 of 30 stepped, 29 boundaries admitted, 11,035 ticks**, NO CHAIN ROOM MOVES; tail 3/3, 1,828 t. ⚠ Its whole-chain row ends "L32 (72,104)": that is the resumed run's `worldCtor`, and the resumed run never left L32 (see the headline).
- **The six `--check`s**: battery `410f27c0` · d2-chain `7cba9530` · l18 `cef8048e` · tail `9a6a3192` · r9-l3 `6cd35fe1`, identical; **r9-campaign `f2873fcb → 975e2f48`**, exit 0, "all checks green".
- **Tick-0 blocks** (`derive-seedling-tick0.mjs --only=` the four): each a calm zero-tick latch, clock delta **21** on all four. Tape index 187 → **191** (`generate-tape-index.mjs`).
- **tapeRunner: 439** (431 + the four segments' 8); every old row passes.
- **The whole-chain differential** (all 30 names + the two witnesses), before the `earns` fix: 932 PASS / **1 FAIL** (the `fire@L32` row above) / 61 SKIP. At the head: **934 PASS / 0 FAIL / 61 SKIP, ALL CHECKS PASSED**; the chain rows are 104 PASS / 4 SKIP (the headline-less UNASKABLE rows and the goal-ledger report 5/41); the new seams `r9-solve-22 → -29`, `-29 → -31`, `-31 → -30` and `-30 → -32` are each *"GREEN over the whole signature — 46 signature rows compared"*.

**Records.**
- `seedling-bot-log.md` § *Seedling substrate U15-swim — the turret; the chain to the route's end*, with four trap candidates.
- `seedling-bot.md`: a turret paragraph after the moonrock's, the ladder now reads AVOID → DODGE → PULL → …, and the campaign passage (30 windows, 11,035 ticks, `complete`).
- The generated `campaign-chain` region reads *"ROUTE COMPLETE"*. Reference: `generate-procgen-reference.mjs` → ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED.
- Surface `--check` GREEN **191** rows (`run.spitForecast`, `turret.js#TURRET_SPIT` classified). Constants `--profile-rows` → `--write` → `--check` PASS, **4,840** literals.
- The entity witness, re-run over the D1 head in a worktree (`--write --jobs=3`, 4,064 s, 132 fast-tier tapes): **500** number leaves (472 + 28). `turret`: 8 move (`ctor.dx/dy`, `shootTimerMax`, `angleSpeedDivisor`, both shot animations' `frames` and `rate`), 11 corpus-blind; `turretSpit`: 2 move (`hitbox.originX`, `speed`), 7 corpus-blind. (D4's commit message says "turret 12 move"; it is 8.)

**Roster pins**, each moved by my tapes:

| pin | move | moved by |
|---|---|---|
| `tapeEnvelope` | 185 → 187 → 191 | the witnesses, then the segments |
| `observationTolerance` ×2 (names, `tally.swapped`) | 185 → 187 → 191 | the same |
| `dialogueAutoAdvance` | 185/184 → 187/186 → 191/190, all inert | the same |
| `tapeIndexManifest` / `tapes/index.json` | 185 → 191 | the same |
| `producerSegments` | 32 → 36 and 35 → 39 | the segments |
| `fixtures/tiers` | campaign 35 → 39, mechanic `roster − 60` | the segments |
| `rerecordCampaign` | the licence list gains the four cascade successors | the segments |
| `campaignChain.test` | boot levels gain 29, 30, 31, 32 | the segments |
| `gameClock.test` | the ceremony list gains `r9-solve-29` (the Green Key) | the segments |
| `playthroughAcceptance` | the tail arrives in L30; `earns` + `fire@L32` | the segments |
| `levelRun.test` | the entity-family list + `shooters` (witness `u15-turret-spit`); ledger kinds 31 → 32 + `spitEvents` | D1 |
| `entityBlocks` + the surface doc's family table | `shooters` (`stationary`, `emitter`; read by `dangerMap`) | D1, D2 |
| `entityRecords.test` | md5 → `f1a4c74f`, module list + `turret.js` | D1 |
| `dangerMap.test` | `TRANSIT_INGREDIENTS` + `spits` | D2 |
| `r8Acceptance` / its test | the ladder + `dodge` (conditional); the live-bag batch + `stepSpitsNow`, `spitForecastNow` | D1, D2 |
| R8 `exposed` | unchanged at **37**: L29–L32 hold no bridged chaser (`campaignBridgeCoverageFindings` green) | — |
| `lintGateLabels`, `seedlingAtlasDoorCensus` | green, no title moved | — |

**Bounded vitest AFTER** (35 files: BEFORE's 21 plus `turret`, `turretSolver`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `iceTurret`, `iceTurretBlast`, `moonrock`, `ropeSword`, `seedlingAtlasDoorCensus`, `tapeFormat`, `bobBossFight`, `solverBotLethalPit`, `combatVerbs`): **1,968 / 1,969**. The one red is `rosterCategories`' banked composite row (*"expected 31 to be 39"*), owed to the coordinator's `standing-values --write` (⛔ not run; ⚖ 52).

## What the brief got wrong (measured)

1. **"A spit hit goes through `applyPlayerHit` with `retaliate: null`"** is right, but the brief's model of the spit omitted **the shield**. `"Shield"` in `TurretSpit.hitables` is the player's own shield entity, placed by `render` on the facing side, so a player facing the turret takes no spit at all (`u15-turret-shield`). The prediction and the model both need the previous frame's shield box.
2. **"Predict the shot tick(s)"** at a stance chosen by range alone: the first stance put a tree's corner on the line of fire. A projectile's hitables include cover, so the witness had to be predicted against the world before it was recorded.
3. **"Let the solver price the spit (the danger map / the forecast), so the L29 walk avoids or survives it."** Pricing alone did not solve it. AVOID routes around static volumes and accepted a corridor that stalled 400 ticks against a tree (its truncated preview probed clean). The walk needed a new rung, DODGE, and an AVOID refusal for spit-only danger. It is a stall in time, not a route around space: no corridor in L29 stays out of `turret@80,176`'s and `turret@128,192`'s ranges.
4. **"U14's producer already knows `reach-pit` and `encounter`."** It knew the goal shapes, but its replay and tape dropped the encounter's slot equip (`out.equips`), so step 30's replay never burned the tree. The survey carried equips since U5; the producer did not.
5. **"`earns` (the Green Key, Fire, …)".** Only `fire@L32` is credited. The Green Key is held, but the ledger's placement witness for a key asks for a clear in its level, and L29's bosskey writes none.
6. **"Expect step 30's encounter to need its own work."** It is U5's walk exactly: the same keys on every tick, and the same game stream.
7. **Not anticipated:** the JS continuation does not hand a later window's `equips` over, so the first chain whose window equips anything (window 30) breaks there on the JS side (headline).

## Residue

- **The JS continuation's equips hand-over.** `tapeRunner`'s resume path skips a window's staging by design, and `equips` (a per-tape input) rides with it. The census and the page hand over timed clears (`run.addTimedClears`, rebased by the window offset) but not equips, so `?tapes=r9-campaign` and the census's whole-chain row never equip the Fire at window 30's t840. I did not change it: it sits beside the resume/staging path the JS arc's S0 owns. The game side has not been asked (the wasm continuation is the coordinator's run).
- **The Green Key is not credited** by the goal ledger (the placement witness; D4). A ledger question, not a walk question.
- **The turret's own damage is refused**, not modelled: no route here swings at one. A route that must kill a turret needs `KILL_ARM_POLICY.Turret` and the "die" animation.
- **Under a shake band** a spit whose cull is undecidable is refused by name (damage on). No committed or new tape reaches it.
- **The DODGE rung** searches stalls only; a spit that no stall clears refuses by name (`DODGE_RUNG`). The forecast leaves the cull out (it can only forbid more).
- **`combat.js`'s `turret` row** still describes the turret as a volume; it was left byte-identical because the ENEMY census reads it.
- **`rosterCategories`' composite row** is red until the coordinator banks `standing-values` (31 vs 39).
- **The full tier on CI** has not run on the witnesses or the four segments (the coordinator's dispatch).
- **Scratch** (session scratchpad, not committed): the scratch producer copy and its emits, U14's refuted `r9-solve-29` tape/recording, the dodge exploration (`dodge.mjs`: stalls of 3–8 ticks at several offsets also clear the walk), the probes' JSON, every run log. No scratch file was ever in `scripts/procgen/` while a reference check ran.
- The latch and tick-0 caches live in this container's `/mnt/c/playwright`; the through-2.2 survey files are local (`NewDocs/`, gitignored).

## Byte-inertia

| Artifact | W0 (`1beafce`) | head |
|---|---|---|
| maze / acceptance / c3 / c6 / c4 / ENEMY / guard / AREA | `246dfbce` `e417212b` `348c1e9c` `e3f101be` `b11d9564` `3910ee23` `a6d18d49` `02b22525` | **identical** |
| killgate s2/s5/s9 · level pre/post s1 · generated set | `63d34807` `fb207b8e` `bfbdfb38` · `e28c1e5d` / `c4841acb` · OK | **identical** (generated set OK) |
| five `--check`s (battery, d2-chain, l18, tail, r9-l3) | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1` | **identical** |
| r9-campaign `--check` | `f2873fcb` | **`975e2f48`** (licensed) |
| reference `--check` | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH |
| campaign census | NO MOVES, 26/26, 9,054 t | NO MOVES, **30/30, 11,035 t** |
| `--check-frontier` | 4/0, covered 26 | **4/0, covered 30, complete** |
| whole-chain differential (30 + 2 witnesses) | — | **934 PASS / 0 FAIL / 61 SKIP, ALL CHECKS PASSED**; the chain rows 104 PASS / 4 SKIP; *"the EARNED set is exactly what the chain declares — 5 earned: bosskey0@L19, chest@L11, fire@L32, shield@L20, sword@L10"*; *"endsAt 11035 vs the segments' 11035"*; every new seam *"GREEN over the whole signature — 46 signature rows compared"* |
| tapeRunner | 427 | **439** |
| surface / constants | 189 / 4,730 | **191 / 4,840** |
| profile / entity-witness number leaves | 138 / 472 | 138 / **500** (+28: `turret` 19, `turretSpit` 9) |
| `fixtures/**` vs main | — | new: `u15-turret-spit`/`-shield` (tape + expectation), `r9-solve-29`/`-31`/`-30`/`-32` (tape + trace + expectation); moved: `tapes/index.json`, `campaign-frontier.json`. Nothing else. |

None of the following was touched or run: AS3, wasm, gitlinks, biome defaults, `standing-values --write`, `pytest`, unfiltered vitest, R2's regions, `solveSegment`'s entry, the `:9516` refusal, `createRunForStaging`. Every committed tape other than the new ones is byte-identical to main.
