# Seedling swim R2: the wallflyer · the census singles · the shake band · a refusal witness for `foldRoundTrip`

**Slice:** `seedling-swim-r2`, an Opus build slice run in the cloud for the swim arc (plan §18.13/§18.22+; ⚖ the un-parked model residue, 2026-10-01; R2 ∥ U15, ⚖ 2026-10-02). I edited none of U15's regions (`turret.js`, the turret block, `dangerMap.js`, the producer, `campaignChain.js`), S0's (`solverBot.js`) or the JS runtime's (`jsRuntime*.js`, `flashPanel/*`).

| | |
|---|---|
| Started from | `origin/main` @ `1beafce6fc` (= the brief's bank SHA) |
| Head | this report's commit, on top of the D5 records commit |
| Harness branch | `claude/seedling-swim-r2-census-ji37wy` (the harness pins it, not `seedling-swim-r2`) |
| Commits | D1 `dbf42e7` · D3(b) `07ed3ed` · D3(c) `ed15a66` · D4 `49381d3` · D5 `530132a` records, `d7186da` (R8 40), `139d5d4` (entity witness) · this report |
| Dev server | `scripts/serve-nocache.py 8970` (`SEEDLING_PORT=8970`, build `seedling_bot_ap_p4e`, headless logic-only); a second on 8971 served the pristine W0 worktree |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced at `1beafce` in a pristine worktree (identity block, six `--check`s). |
| D1 | **PASS, witness first** | `wallFlyer.js` + `levelRun.stepWallFlyersNow`. Two witnesses, each 61/61 on the game, with the body probe 244/244 each (worst 0). The base model reads t8 as 88 against the game's 90.75. Mutant: 2 red at t8. |
| D2 | **STOP** | The jiggle is `shake * Math.random() - shake/2` (`Game.as:1984-1988`): the gameplay LFSR, whose position the model carries only in L112. 28 of 185 committed tapes can shake, and 1 of those 28 declares `rng.split`. |
| D3(a) | **STOP** | L33 (`witchhut.oel`) holds no witch, oracle or NPC. The talk-circle refusal fires only inside the bloody ending's scripted walk, so J0(a)'s L33@621 is not reproducible here. |
| D3(b) | **PASS, witness first** | Two bare teleporters on one tick: the first `.oel` placement wins. `r2-two-teleporters` 61/61 (L113's `(16,0)` beats `(32,0)`; L114's `(64,144)` beats `(80,144)`). The base refuses t14. Mutant: 1 red at t14. |
| D3(c) | **PASS, and a model defect found by its witness** | A terrain death's kill-lock ledger ran at the DESTROY tick; `totalEnemies()` counts the body until its removal, 10 ticks later. The game crosses L5's opened lock on t285, not t275. Fixed. Mutant: `r2Singles` red. |
| D4 | **PASS** | `foldRoundTrip`'s refusal arm has a witness again: a hand drive from `r2-two-teleporters`' staging into L112 refuses on t122 (the Owl's `rng.split`, an R4 item); faithful, `reproduced` and `ok` true. Mutant: that row alone reds. |
| D5 | **PASS** | tapeRunner 435/435 (all 427 W0 rows pass). Identity block: one explained mover (the ENEMY census's `stepped` column for `wallflyer`); the six `--check`s are identical. Surface GREEN 189, constants PASS 4,826, entities 490 leaves (`--check` PASS), profile 138 (unchanged), bounded vitest 24 files / 1,406 green. |

**The one thing to know first.** D3(c) was not a census refusal to model. Its witness refuted the model: the chaser terrain arms (water, lava and the pit) ran the kill-lock ledger when the body was DESTROYED, but `Lock.checkEnemies` reads `totalEnemies()` = `classCount(Bob)`, and a drowned body stays in the world through `Mobile.death`'s eleven 0.1 subtractions. The ledger now runs at the removal. A tape that DECLARES the clear (v9 `at`) cannot see this defect, because its replay rides the declaration. Only the game and a scratch-layer run without the declaration see it. **Press and arrow kills are still ledgered at the kill tick** (`stageChaserKill`), which by the same reading may put the scratch layer's clear early by the die anim plus the fade. That is unmeasured and not changed here (residue).

## W0 (at `1beafce`, a pristine detached worktree, server 8971)

| Row | Result |
|---|---|
| identity block (`SEEDLING_PORT=8971 SEEDLING_PYTHON=<primary venv> bash scripts/procgen/identity-block.sh .`) | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `3910ee23…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK. **Every row equals the bank.** Log md5 `9aa04f47…` |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 f2873fcb`, all exit 0 (= the bank) |
| reference | *"4 differ"* in the symlinked worktree (U10's artifact, as R1 saw); the main tree reads ALL 7 + 5 MATCH at head |
| tapeRunner | **427/427** (worktree) |
| quoted from the bank (consistent with what D1 measured) | surface 189 · constants 4,730 · tape index 185 · roster 185 (inert 184) · R8 exposed 37 · profile 138 · entities 474 (472 number leaves) |

⚠ My first W0 identity run was on the main tree. My D1 edits began while it ran (the half-written `wallFlyer.js` threw on import), and every row from c4 on reads the empty md5 `d41d8cd9…`. It is discarded, not quoted. The worktree re-run above is the W0.

## D1: the wallflyer (`dbf42e7`)

### The order, as read (`Enemies/WallFlyer.as`, `Enemy.as`, `Mobile.as`, `Game.as`)

- `loadlevel` adds the wallflyers at `Game.as:2392`, one line above the spinners (`:2393`), and `addUpdate` prepends. So a spinner updates first, then the wallflyers (last placement first), then the shieldspire, the blocks and the rest, and the Player last. The player box both halves read is where the previous tick left it.
- `check()` (`v = decideMotion(-4)`, into its wall) runs inside the world's **first `Game.update`** (`Game.as:870-878`, `if (!checked)`), not at construction. MEASURED: the body probe's t0 reads `v = 0`; my first cut set `v` at construction and disagreed on t0 only (4 rows).
- `Enemy.update`:
  1. `if (!activeOffScreen && !onScreen()) return` (from `Enemy.update` only);
  2. the terrain switch (water/lava `destroy`, the pit latch);
  3. the pit descent, OR `mobileUpdate` (friction at `f = 0`, then the `moveX`/`moveY` override, which **zeroes both axes** on a collision; `"Player"` is not in `solids`, so the reverse arm is dead), `death()`, and under `!destroy` `hitUpdate()` then `hitPlayer()` → `p.hit(this, 3, Point(x, y), 1)`.
- The tail: `if (destroy || "die") return`, then `vTriggered = decideMotion(+4)` and `FP.world.collideLine("Player", x, y, x + 160·v̂x, y + 160·v̂y)` (`attackRange = FP.screen.width`; `Main.as:36` is `super(160, 160, …)`); a hit sets `v = vTriggered`. `activeOffScreen = |v| > 0`.
- `decideMotion` probes `["Solid","Tree"]`, which agrees with `Mobile.solids` in every wallflyer room (none holds a `Rock`/`Rope`/`ShieldBoss`-typed entity); the run refuses a room where it would not.
- `knockback` is `v = -v` (`WallFlyer.as:200-204`). `startDeath` plays "die"; `endAnim` sets `destroy`.

### The witnesses (`plan-seedling-r2-wallflyer.mjs`, with `--check`)

The keys are a fixed schedule (none). The tapes were emitted, then recorded on the game (`--record --only=`), then probed (`probe-seedling-u9-shield-mobiles.mjs --class=WallFlyer`, extended here), all before the commit. I chose the stance with the step in the working tree (R1 D3's disclosure). The game judged; the step was not tuned to a recording, and its only change after the probe was the `check()` timing above.

| tape | the model's reading | game | body probe |
|---|---|---|---|
| `r2-wallflyer-contact`: L22, boot (80,112) ⇒ (88,120), on the y 120 row of `wallflyer@48,112` (ray east) and `@144,112` (ray west); `noDamage` false; 60 ticks still | both launch on t1; the west one hits the player on t8 (force 3, east); the east one's t13 contact lands in the player's i-frame; each turns DOWN mid-flight off `rock@96,96`'s underside | **61/61 observations**; `hits` 1 = model 1 | **244/244, worst 0** |
| `r2-wallflyer-suit`: the same + the dark suit | the t8 contact retaliates: flyer `hits` 1, `hitsTimer` 30, the latch, `v` reversed; it relaunches east off its own rock on t12 | **61/61** | **244/244, worst 0**; the game's `hit_by_dark_stuff` is true at t8 (compared by hand) |

- **Base** (the pristine model): both tapes run without a refusal and read t8 as x 88 against the game's 90.75. At the base the run does not step the body, so it sees no hit.
- **Mutant** (predicted first: 4 red, 2 rows × 2 tapes, at t8): the stepper returns at once, one build, restored md5-identical (`a7f4b826…`). **Measured: 2 red / 431**, both at t8 (*"expected (x=90.75, …), got (x=88, …)"*). My prediction was wrong on the count: each witness has one stream row that reds; its second row passes.
- **Parity:** tapeRunner 431/431 at D1. The three committed tapes that cross L22 (`r9-solve-21`, `r9-solve-22`, `r1-dark-shield-kill`) stay byte-identical: no flyer reaches their players.

## D2: the shake band — STOP

- **The draw.** `Game.view()`: `if (shake > 0) { FP.camera.x += shake * Math.random() - shake / 2; FP.camera.y += …; shake = max(shake - 1, 0) }` (`Game.as:1984-1988`). Two `Math.random()` per `view()` with `shake > 0`, on the GAMEPLAY generator (the avm2 LFSR `rng.js` transcribes).
- **What the model carries.** The arithmetic, but the stream POSITION only for L112's Owl schedule, and only under `rng: {split: true}` (`finalBossRng.js`, with that room's own build-draw census). `tapeRunner.stagingFromTape`'s docblock: *"the model keeps no LFSR position"*. A point camera elsewhere needs every main-stream draw since the seed, room by room: `Enemy` ctor `coins`, `Tile.addGrass`, `Orb`, per-tick enemy draws, and without the split also `Music`'s sound picks.
- **The numbers** (a scratch scan replaying all 185 committed tapes on the model): **28 can shake** (23 by a landed player hit; 5 more carry a rock-fall row: `r5-l43-wand`, `r5-shaft`, `r5-shaft-control`, `r6-totem-control`, `r6-totem-kill`). **1 of those 28 declares `split: true`** (`r6-owl-control`). 30 of 185 declare the split at all. The census boots declare no seed.
- The census's two band refusals reproduce at head unchanged: L16 from L17's stairs (an arrow hit on t6, `bob@192,80` at t8) and L17 from L16's (t144).

## D3: the census singles

### (a) the X release in a talk circle — STOP

- L33 is `OverWorld/witchhut.oel`: a teleporter, a bed, a dresser, a torch and a lightalpha. **No witch, no oracle, no NPC** in the atlas or the `.oel`.
- The refusal the brief quotes (`levelRun.js`, now about `:14866-14882`) is inside `if (cutsceneWalk)`. That is set only by `finishEndingReboot`'s bloody arm (the seed's `cutscene[1]` reboot), whose room with an oracle is L1.
- My census of L33 (kit, every arrival, with and without the scratch layer) ran 1,000 ticks. J0(a)'s L33@621 is not reproducible without its file. Modelling "the talk it opens" means the Oracle's dialogue and `exitToMenu()` under `cutscene[1]`, a menu exit the tape stream cannot carry. Not attempted.

### (b) two teleporters on one tick (`07ed3ed`)

- **As read.** `Teleporter.update` is `FP.world = new Game(to, playerPos)`, which only records `FP._goto`. Every teleporter that fires writes it, and the last to update wins. `for each (o in xml.objects[0].teleporter)` (`Game.as:2364`) adds them in `.oel` order and `addUpdate` prepends, so **the first placement updates last and wins**.
- **The step.** `playerPhysicsV2.step` resolves a multi-fire among bare teleporters to the lowest `level.teleporters` index (which keeps `.oel` order) and records the losers as `alsoFired`. A stair among them stays refused: the stairs are added in their own loops (`:2362-2363`), and the world does not carry up vs down.
- **Witness** `r2-two-teleporters` (L113, boot (24,24) ⇒ (32,32) across the `(16,0)`/`(32,0)` seam):
  - `up` fires both on t14: arrival **(72,136)**, `(16,0)`'s, not (88,136);
  - `right` ×5 to x 80.75 across L114's `(64,144)`/`(80,144)` seam, then `down`: both fire on t31, arrival **(24,24)**, not (40,24);
  - game **61/61**, 2 transitions; the base refuses t14 by name.
- **Mutant** (predicted first: the last placement wins, 1 red at t14, x 88 vs 72): **measured exactly that**, 1 red / 433; restored md5-identical (`03e26e8c…`).

### (c) a terrain death's kill lock (`ed15a66`)

- **Reproduced** under the census's own setting (`scratchPersistence: false`, the JS runtime's vanilla setting), from L12's stairs with `canSwim`. The player swims at the arrival; the three bobs follow it into the water and drown (t39, t111, t173). The third opens `lock@48,112` (tset −1, `{5,0}`), refused at the base on t173 as an undeclared clear. The same refusal fires on PRESS kills from L5's other two arrivals, so it is the declaration doctrine (a vanilla run does not write a clear the tape does not carry), not a terrain gap.
- **The witness found a defect.** `r2-terrain-killlock` (L5, `canSwim`): the player waits, then presses into the lock and crosses when it opens. The tape declared the clear the scratch layer computed (`at` 273). Recorded on the game: **REFUTED at t274** (game y 108.207, held by the lock; model 109.025), and the game crosses on **t285, not t275**.
- **As read** (`Puzzlements/Lock.as`): `checkEnemies` activates the lock when `totalEnemies()` = 0. `activationStep` fades the alpha 0.01 a tick, and `turnOff` (type `""`, `setPersistence(tag, false)`) runs on the step after it reaches 0. `totalEnemies()` is `classCount(Bob) + …`, which drops only at `FP.world.remove`. A drowned bob reaches that through `Mobile.death`'s eleven 0.1 subtractions, the first on the destroy tick: **t183, not t173**.
- **The fix.** The chaser terrain arms (water/lava, and the pit) set `removalLedger`, and `assertChaserRemovalIsDeclared` runs on the tick `removed` is set. The scratch layer now computes removal 183, `at` 284 (v9 283). Re-emitted with `at` 283 and re-recorded: **321/321**. `gameVisibleTape` withholds the timed row (ruling 23), so the game opens the lock from its own count.
- **The new row** (`r2Singles.test.js`) drives the staging WITHOUT the declaration under the scratch layer: removal 183, declared 283, crossing **t285 = the recording**.
- **Mutant** (predicted first: `r2Singles` red, tapeRunner all green, because the replay rides the declaration): the destroy-tick ledger restored. **Measured exactly that**: `[5,0,173,273]` against `[5,0,183,283]`, 435 green; restored md5-identical (`bd430e3f…`).

## D4: a refusal witness for `foldRoundTrip` (`49381d3`)

- A seeded random hand-drive scan (3 × 500 ticks per committed staging) found these reachable refusals:
  - the `sound`-pin water refusal (L0, L37);
  - mover contacts (`jellyfish@56,64` L60, `lavarunner@24,56` L74);
  - a spinner stance refusal (`spinner@224,112`);
  - the L37 fallrock clear;
  - the shake band (L16);
  - the Owl intro's held primary;
  - the L1 oracle's X release;
  - **L112's `rng.split`** (an R4 item).
- **The witness.** From `r2-two-teleporters`' staging (`rng: {seed: 1, split: false}`): `ArrowDown` 30, `ArrowRight` 35, `ArrowDown` 100 walks out of L113's south door into L112. The drive refuses on **tick 122** (*"the Owl fight in level 112 needs `rng: { split: true }`"*). `foldRoundTrip`: faithful, no mismatches, the replay throws the same message, `reproduced` true, `ok` true. None of D1–D3 touches it. R4 will retire it, and the row will need its next re-aim then.
- **Mutant** (predicted first: `reproduced` with `!==` reds this row only): **measured**: 1 red, 35/36 green; restored md5-identical (`72fcbd87…`).

## The census re-run (`probe-seedling-r2-census.mjs`: every arrival, the kit less the ghost sword, 600 idle + 400 seeded random-key ticks, NO scratch layer; head output `seedling-swim-r2-census.json`, md5 `d6251d49…`)

| level (arrival) | base `1beafce` | head | still refuses? by what |
|---|---|---|---|
| L5 (4 stairs) | t715 | t715 | yes: a PRESS kill opens `{5,0}`, undeclared (the doctrine) |
| L5 (6 teleporter) | t844 | t844 | yes: the same, a press kill |
| L5 (12 stairs) | **t173** | **t183** | yes: the terrain death opens `{5,0}`, now at the REMOVAL (D3c) |
| L16 (15) / (18) | ran | ran | — |
| L16 (17 stairs) | t9 | t9 | yes: the shake band (D2 STOP) |
| L17 (16) | t145 | t145 | yes: the shake band |
| L22 (21) | ran | ran | — |
| L22 (25) | ran | ran (2 retaliations, into flyers) | — |
| L22 (29) | t922 | t922 | yes: L29's turret (U15's) |
| L22 (30) | **t914, wallflyer@144,112** | **ran** (3 retaliations) | — (D1) |
| L25 (22/26/28) | ran | ran | — |
| L27 (26) | t839 | t839 | yes: a suit kill of `puncher@80,168` opens L26's lock (the doctrine) |
| L27 (28) | **t803, wallflyer@192,48** | **t927** | yes: the suit's retaliation would KILL `wallflyer@192,48` (D1's named refusal) |
| L33 (12) | ran | ran | — (D3a) |
| L36 (12) | t733 | t733 | yes: the suit into `sandtrap@80,80` (a static body, R1's residue) |
| L113 (112) | t620 | t620 | yes: the Owl's `rng.split` (R4) |
| L113 (114 ×2, 115 ×2) | ran | ran | — |
| L114 (113, ×2) | **t648 / t708, two teleporters** | **ran** | — (D3b) |

**Base 12/25 ran 1,000 ticks; head 15/25.** Like R1's, this is an upper bound on exposure and not J0(a)'s ticks (its file is not in the repo).

## Surface, constants, profile and entity deltas

| Row | W0 | head | movers |
|---|---|---|---|
| solver surface | GREEN 189 | **GREEN 189** | `runObject` 184 → 185 (`wallFlyers`, a getter), simulation files 56 → 57; `--write` then `--check` |
| constants | PASS 4,730 | **PASS 4,826** | 76 `wallFlyer.js` literals classified by the spinner/moonrock precedents (record values physics/rule magnitudes, the angle table `rule/derivation`, the mask bits `rule/sentinel`, the die anim `cosmetic`); `--profile-rows` → `--write` → `--check` |
| profile | 138 | **138**, both tiers `--check` PASS | no new key, so no profile witness was owed |
| entities | 474 (472 number leaves), md5 `143e37e6` | **490 number leaves, md5 `abbcd286`** | the `wallFlyer` record (18 leaves). Witness `--write --jobs=3`, 4,955 s, fast tier 134 tapes: wallFlyer 5 move (`dy`, `w`, `moveSpeed`, `f`, `contactForce`), 13 corpus-blind. **One older verdict moved by a corpus gain:** `enemyTerrainDestroys.water` corpus-blind → moves (D3c's drownings) |
| tape index / tapeRunner | 185 / 427 | **189 / 435** | the four witnesses |
| roster pins | 185 (inert 184), 185, 185 ×2; R8 37 | **189 (inert 188), 189, 189 ×2; R8 40** | named in each test: `r2-wallflyer-contact`/`-suit` (D1), `r2-two-teleporters` (D3b), `r2-terrain-killlock` (D3c; also the `watchManual` v9 sweep and R8's L5 row) |
| other pins | — | — | `spinner.test` roster + WallFlyer; `r8Acceptance.test` stepped partition 4 → 5 families; `entityRecords` module list + md5; `playerPhysicsV2.test`'s "two teleporters THROW" row re-aimed to the game's choice, plus a stair-among-them refusal row |
| `lint-gate-labels`, `seedlingAtlasDoorCensus` | green | **green**, unedited | |
| reference | ALL MATCH (bank) | **ALL 7 + 5 MATCH**; instruments 310; `check-procgen-docs` ALL CHECKS PASSED | |
| bounded vitest AFTER | — | **24 files / 1,406 green** (tapeRunner, levelRun, wallFlyer, r2Singles, playerPhysicsV2, spinner, combat, r8Acceptance, watchManual, dialogueAutoAdvance, tapeEnvelope, observationTolerance, entityRecords, tapeIndexManifest, playerDamage, contactPairV2, chasers, procgenScratchPersistence, solverEncounter, seedlingProfile, moonrock, camera, lintGateLabels, seedlingAtlasDoorCensus); the first run read 1 red, R8's undeclared `r2-terrain-killlock`, fixed in `d7186da` and re-run green | |

## What the brief got wrong (measured)

1. **D3(c) "model the kill lock's opening from a terrain death."** The model already modelled it (the scratch layer writes it, a vanilla run refuses it by doctrine, and press kills refuse identically). What it had wrong was the TICK: 10 early, at the destroy instead of the removal. Only the game could say so.
2. **D3(a) "L33@621: an X release inside a witch's/oracle's talk circle."** L33 holds no NPC, and the quoted refusal lives only inside the bloody ending's scripted walk.
3. **The wallflyer's census id.** The census's refusal from L30 names `wallflyer@144,112` here (the brief quotes `@48,112`; L22 holds four). The witness uses both row flyers.
4. **`combat.js`'s `offScreen: 'in-flight only'`** is half the story. The TRIGGER runs off screen too (it is below `Enemy.update`'s return), so a resting flyer the camera has lost still launches.
5. **"Bank: tape index 185 … R8 exposed 37"** held at W0. I had to re-measure the identity block in a worktree because my own edits contaminated the first run (above).
6. **My own predictions:** D1's mutant (4 red predicted, 2 measured); the D3(c) witness's first emission (the declared `at` 273 was the model's, refuted by the game).

## Residue

- **The shake band (D2)** stays a band. A point camera needs a per-room census of every gameplay-stream draw since the seed; 1 shaking tape in 28 declares the split.
- **Wallflyer, bounded:**
  - a suit KILL is refused by name; the census reaches one in L27 (from L28);
  - a ceremony beside a flyer in flight, in its i-frame or dying, is refused;
  - `dangerMap` (U15's file, not edited) still prices the class at its `.oel` placement;
  - sword presses, arrows, wand and fire shots at a flyer are unchanged (`enemyDamage`'s `WallFlyer: refused`);
  - `wedgeVisible: false`, so `runFire`'s block-sweep refusal stands in L22/L25.
- **Kill-lock ledger for PRESS and ARROW kills.** `stageChaserKill` still ledgers at the kill tick, while `totalEnemies()` counts the body through its die anim and fade. Committed tapes carry declared clears (`r8-solve-5`'s `at` 427 = the measured removal 326 + 101), so replays are unaffected. The scratch layer's computed clear for a KILL is, by the D3(c) reading, early. Unmeasured; a trap candidate, logged.
- **Two teleporters with a stair among them** stay refused.
- **D4's witness rides an R4 refusal**, so R4's Owl `rng.split` work must re-aim it.
- **The witnesses' CI rate** is unmeasured (one recording each). `standing-values.json` was not rewritten.
- **Scratch instruments** (session scratchpad, not committed): `census.mjs`/`census2.mjs` (the first probes), `shakescan.mjs` (D2's 185-tape scan), `wf.mjs`, `tp.mjs`/`tp2.mjs`, `l5*.mjs`, `map.mjs`, `par.mjs`, `base.mjs` (the base-model streams), `d4.mjs`/`d4scan.mjs` (the hand-drive scan), and every log.

## Byte-inertia

| Artifact | W0 (`1beafce`, pristine worktree) | head (main tree, before this report) |
|---|---|---|
| maze / acceptance / c3 / c6 / c4 | `246dfbce` `e417212b` `348c1e9c` `e3f101be` `b11d9564` | **identical** |
| ENEMY census default | `3910ee23` | **`a20bcbe8`**: one cell, `wallflyer`'s "stepped" column `no → yes` (D1's roster row); its SOLVED/REFUSED verdicts and 155 are unchanged |
| guard / AREA | `a6d18d49` `02b22525` | **identical** |
| killgate s2/s5/s9 · level pre/post s1 · generated set | `63d34807` `fb207b8e` `bfbdfb38` · `e28c1e5d`/`c4841acb` · OK | **identical** |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 f2873fcb`, exit 0 | **identical**, exit 0 |
| reference `--check` | 4 differ (worktree artifact) | **ALL 7 + 5 MATCH** |
| identity log md5 | `9aa04f47…` | `50aedd46…` (the ENEMY row and the reference line differ, both explained) |
| tapeRunner | 427 | **435**: the 427 identical, plus the four witnesses' 8 rows |
| `fixtures/**` | — | new: the four witnesses (tape + expectation each) and `tapes/index.json`; `campaign-frontier.json` untouched |

Untouched or not run: AS3, wasm, gitlinks, any committed tape or expectation, biome defaults, `campaign-frontier.json`, `standing-values --write`, `pytest`, unfiltered vitest. Also untouched: U15's files and regions (`turret.js`, `dangerMap.js`, `campaignChain.js`, the producer), `solverBot.js`, `jsRuntime*.js`, `flashPanel/*`.
