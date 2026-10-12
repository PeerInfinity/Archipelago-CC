# Seedling fidelity BOMBPUSHER: the lobber is a live emitter, and a hold inside its reach is a hit by construction

| | |
|---|---|
| Session | `seedling-fidelity-bombpusher` (planner `seedling-fidelity-planning-6`, wave 13, model coverage) |
| Start SHA | `db221dc093` (main after wave 12; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-bombpusher-fidelity-pu0sgy` |
| Commits | D1 `30be848` · D2 `a54fd1b` · D3 `1fd5124` · fixes `b6c019d`, `46552e4` · records `d50a8cd`, `3845d11` · this report |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (`CONTACT_FIDELITY.bombPusherLive` ships OFF; the flip is the user's) · D3 PASS as a refusal by name. No bomb-free plan exists with today's verbs; the hand-over below says what would make one.** |

**The one thing to know first.** The model now carries the BombPusher, its Bomb and the Explosion, and it reproduces
both damage-on L40BUTTON walks **at 0 px through every bomb hit and the death**, every bomb to the bit. The solver
cannot dodge it. A bomb is aimed at the player and lands at most 8.5 px past the aim, inside the 15 px blast, so a
player who **stands still** within 256 px is always hit. Both of the hold's waits stand still by contract, and no verb
waits while moving. ON, legs 378/381 now refuse **by name** at `buttonroom@272,208`'s 131-tick hold, and the refusal
names the exact blast the game landed.

This is **not a forced hit**: on every measured walk, a moving player was never hit (below). The hit is avoidable by a
*moving wait*, a verb that does not exist. That verb is the next work order, and it is not FORCEDHIT's damage policy.

## W0: the bank at base (`db221dc093`)

Measured in a detached worktree of `db221dc093` (submodules and `node_modules` symlinked; served on port 9642).

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9642 bash scripts/procgen/identity-block.sh .` (venv activated) | log md5 `f3380c57f73853e6bfa0daa9a89baaa3`: maze `57e07d21`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set `OK` |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| reference | in the block | 4 DIFFER: environmental (the worktree's symlinked submodules, as L40BUTTON measured) |
| bounded vitest BEFORE | 78 files (below), `--reporter=json`, md5 over sorted `status\tfullName` | **78 files / 3,107 tests, all green**, md5 `0bfe9689ae2a7b1639743e84adfa93d1` (the brief's 56-file list: 2,420 tests, `9fe55f76…`; + the 22 files my grep added: 687 tests) |
| tapeRunner | its rows inside that run | **611** rows, md5 `75a3c41f0c91f6e71953e82d8259dc60`, 0 non-pass |

**The bounded set** is the brief's standing list plus `combat`, `contactFidelityHook`, `fidelityBulb`,
`fidelityDarkTrap2`, `hammerFightFallback`, `levelRun`, `levelWorld`, `presses`, `turretSolver`, `turret`, `hazards`,
`tapeRunner`, `checkProcgenHelp`, `procgenHelpBaseline`, `docLinks`, `seedlingProfile`, `seedlingEntityWitness`,
`seedlingProfileWitness`. It also includes every non-slow test that `rg -a` hits for what I touched:
`ENTITY_FAMILY_NAMES|LEDGER_KIND_NAMES|CONTACT_FIDELITY_KEYS|CONTACT_FIDELITY_DEFAULTS|bombpusher|BombPusher|static-lobber`
and `spitForecast|spitDanger|execHold|dangerWhileWaiting|dangerAt\(|bossBlasts|FAMILY_RULES|familyOf|solverView|CEREMONY_DEAD_FRAMES|runLatchedWait|'hold'`.
That adds `deadFrameBand`, `fidelityBobSoldier2`, `fidelityF6`, `fidelityFrontier3`, `fidelityProximity`,
`jsRuntimeSolveService`, `jsRuntimeSolver`, `jsRuntimeSolverShouldStop`, `procgenCollectPath`, `procgenNestedOpeners`,
`procgenPalette`, `procgenSeedlingAreas`, `procgenSeedlingElementsCertify`, `procgenWeigh`, `r5SwimCloseout`,
`sealCeremony`, `solverBot`, `solverPrefix`, `tapeFormat`, `totemFight`, `watchWasm` and `surveyFamily`. AFTER adds
the two new files (`bombPusher`, `fidelityBombPusher`).

## D1: the lobber, measured on the game (PASS)

`probe-seedling-bombpusher.mjs` (new) plays a tape on p4f and reads each sampled tick from `botMobiles()`/`botStatus()`:
the lobber's anim, every `Bomb` row, and the player (position, hits, camera). It then joins them against the model.
`--game-only` skips the model; `--reuse` re-joins a recorded run without a browser; `--record` writes a witness.
I ran it on both L40BUTTON `bomb-refuted-*` tapes. The two runs sampled 1,594 and 1,543 ticks.

| quantity | measured | AS3 |
|---|---|---|
| when it shoots | `shotTime == 0` and the player is within `FP.distance` 256 (a `Number`, not truncated). The lobber updates BEFORE the player, so it reads the previous tick: L42 t818 is at 255.52 and the play lands on t819; t817 was at 256.44 | `BombPusher.as:39-48`; `Game.as:2299` adds it after the Player (`:2250`) and `addUpdate` prepends |
| off-screen | never camera-gated (`activeOffScreen`); no `Game.freezeObjects` test anywhere in the class | `:34`, `Enemy.as:64` |
| the shoot anim | 5 frames at rate 5 × `FP.elapsed` 0.0333 = 7 updates, then 6, 6, 6, 6. The wrap, which also adds the Bomb, is the play + 30 (t819 → t849) | `:29`, `Spritemap.as:69-101` |
| the clock | the wrap sets `shotTime` 15; 15 decrements, then the test. The next play is the wrap + 16, so one bomb every **46** ticks (t819, 865, 911 …) | `:20,46,56` |
| the aim | `Point(p.x, p.y)` at the wrap: the previous tick's player (t849's bomb `v` = (t848 player − (136,152)) / 30, bit-exact) | `:57-60`, `Bomb.as:100-101` |
| the flight | `v.normalize(v.length / 30)`, `f = 0`, `solids = []`. Friction's `< 0.05` zeroing applies: L42's t941 launch with vy 0.0024 flew flat at y 152. 30 updates land exactly on the aim (t879's row = the aim to the bit); the 31st moves one step more, then `remove` | `Bomb.as:100-121`, `Mobile.as:73-117` |
| the Explosion | added in `removed()`, i.e. the SAME `updateLists()` (the remove loop, then the add loop), so it tests the player's END-of-tick origin. Radius `int(24 × 0.65)` = **15** (`radius` is an `int` field). The prefilter square, then `FP.distance(origin, origin) <= 15`. Player: `hit(null, 4, Point(x, y), 1)` | `Explosion.as:22,26-66`, `World.as:900-926` |
| the hits | L42: t1064 (blast (285,217), player (280.74,215.30): vx −3.714, vy 0, which is `knockback`'s `\|centre.y\| > 0.5` gate), t1156; the spinner's hammer kills at t1221. L41: t1153, t1291; the third bomb kills at t1337 (`hitsMax` 3) | `Player.as:1374-1401,1493-1513` |
| `"Enemy"`/`"ShieldBoss"` arm | `Enemy.hit(4, Point, 1)` on a body whose origin is within 15 px. No measured blast reached a body on these walks. The lobber itself is `type = "Solid"`, outside every list | `Explosion.as:62-65` |

Evidence: the L40BUTTON evidence tapes, plus the two recorded witnesses below (the game's rows).

## D2: the model, behind `CONTACT_FIDELITY.bombPusherLive` (PASS; OFF by default)

- **`bombPusher.js`** (new): `BOMB_PUSHER`/`BOMB` records, `createBombPusher`/`stepBombPusher` (the update and its
  Spritemap), `createBomb`/`stepBomb` (`pointNormalize`/`pointLength` from `playerPhysicsV1`, which is the one
  spelling), and `BOMB_PUSHER_CADENCE` (simulated, not divided).
- **`levelRun.js`**:
  - `stepBombsNow` runs first (run-time-added and prepended, in the spits' slot). `stepBombPushersNow` runs before the
    ice turrets: its only reader is the player's previous point. `stepBombsThroughFreeze` runs a pickup's phase A.
  - `drainBombBlastsNow` runs in the `updateLists()` block after `pendingBlasts` and bills through `applyPlayerHit`.
    An Explosion whose disc reaches a stepped chaser or a spinner, or whose square meets a static `"Enemy"` box,
    **refuses by name** (the `"Enemy"` arm is not staged).
  - New entity families `bombPushers`/`bombs` (getters too) and the ledger kind `bombEvents`. `bombForecastNow` is D3's.
- **The switch**: `contactFidelity.js` gets one appended row. The flashPanel setting is derived from
  `CONTACT_FIDELITY_KEYS`, so the JS arc wires nothing.

**Witnesses** (`fixtures/bomb-witness/`, written by `probe-seedling-bombpusher.mjs --record` from the game rows, p4f, port 9641):

| witness | leg | samples | ON | OFF |
|---|---|---|---|---|
| `bombpusher-l42-part0-damage` | 381 | 1,219 (t1..t1221) | 0 px on the player, every Bomb (x, y, vx, vy) and the lobber's anim through two bomb hits and the hammer's kill | leaves the game at t1065 (the tick after the hit) |
| `bombpusher-l41-part0-damage` | 378 | 1,315 (t1..t1337) | the same, through three bomb hits (the third kills) | leaves at t1154 |

⚖ The replay reads the game's camera on the shake band's uncertain ticks (`cameraWitness`; the cosmetic RNG is never
modelled). Without it the model refuses by name one tick after the first hit: the hit's `Game.shake += 5` leaves
`bob@272,112`'s on-screen state uncertain. Each witness ends at the respawn. There `witnessCamera` reports the game's
camera (777,0) / (800,22) against the model's exact (776,0) / (800,24): **the death reboot's camera**, outside this
slice (residue).

**Mutants** (predicted first; copy + restore, `cmp` clean):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | radius 15.6 (no `int`) | only the constants row red (the measured blasts sit 2.5–4.6 px from the origin) | ✔ 1 red |
| M2 | drop friction's zeroing | the friction row + L42's ON witness red | ✔ 2 red |
| M3 | `shotTimeMax` 16 | the constant, cadence and both ON witness rows red | ✔ 4 red |

## D3: the price and the refusal (PASS, as a refusal by name)

- **`dangerMap.spitDanger`** tests a blast against any box, the game's way (square, then the origin disc). In TRANSIT
  it uses the walk's own forecast: `levelRun.bombForecastNow` rides `run.spitForecast()`. Each blast is returned on the
  sample whose box is the end-of-tick player. In a WAIT it uses `lobberWaitDanger`, which steps the room's lobber and
  bombs (copies, `bombPusher.js`) against a player standing at the box. Not in a no-walk transit.
- **`solverBot.lobberHoldRefusal`** asks that WAIT before `execHold` stands (on the presser or in `runLatchedWait`).
  A dwell that prices as a hit refuses with `obstacle {kind: 'danger', id: 'bombpusher@112,128'}`. That kind already
  exists, so **no new `SolverRefusal.obstacle.kind`**. `surveyFamily.FAMILY_RULES` gains the `BOMB` row (appended).
- **The measurement that decides "refuse" rather than "re-plan".** I replayed with the key ON, scanning every blast's
  `hitPlayer` (computed under `noDamage` too). That covered the two L40BUTTON plans and `r5-l40-part0`. **Every
  would-be hit is a standing player**, 0–9 px from the aim:

  | walk | would-hit blasts | where | moved since the launch |
  |---|---|---|---|
  | `l40button-l42-part0` (19 blasts) | t1064, t1156, t1386 | the t0 hold (280.7,215.3); a stance at (248.4,182.9); the t1 hold (168.5,135.4) | 0.0, 0.8, 0.0 px |
  | `l40button-l41-part0` (16 blasts) | t1153, t1291, t1337 | the t0 hold; the t1 hold, twice | 0.0, 8.9, 0.0 px |
  | `r5-l40-part0` (18 blasts) | t62, t108, t338, t384 | the t0 hold twice, the t1 hold twice | 0.0 px each |

  Every blast that landed while the player was walking missed. The hit is therefore avoidable by **moving during the
  wait**. Both the latched presser's fade and the swing stances allow that in principle, but `runHold` fails "MOVED"
  by contract and `runLatchedWait` stands still. So no plan through today's verbs is bomb-free, and **none is a forced
  hit either**.
- **Measured ON** (node, the L40BUTTON staging, `SEEDLING_CONTACT_FIDELITY=<defaults>,bombPusherLive`). Both legs
  refuse in about 3 min:
  - leg 378: *"-> hold: the hold stands still for up to 131 tick(s) at (280.08,216.23), inside bombpusher@112,128's 256 px reach — a Bomb's Explosion at (284,218) 47 tick(s) into the wait …"*
  - leg 381: *"… at (280.74,215.30) … (285,217) 57 tick(s) into the wait …"*

  These are the game's blasts: (284,218) at hold tick 48, (285,217) at 58. With the model live but unpriced, both legs
  failed `BotDriverV2Error` *"hold tick 48 of 131 MOVED"* / *"tick 58"*. That was the knockback, unnamed.

**Mutants** (predicted first):

| # | mutant | predicted | measured |
|---|---|---|---|
| M4 | drop the `lobberHoldRefusal` call | the hold row red (the drive fails "MOVED") | ✔ 1 red |
| M5 | the WAIT arm returns nothing | the 101-tick wait row and the hold row red | ✔ 2 red |
| M6 | drop the lobber from a turret room's composed forecast | the forecast row red | ✗ **survived**: L40 has no turret, so `spitForecastNow` returns the lobber forecast directly and the composed branch is unreachable. No room holds both, so the composition is now a **refusal by name** |
| M6b | the turret-less room returns no lobber forecast | the forecast row red | ✔ 1 red |

**Also found in D3 (a D2 bug, fixed in `1fd5124`).** The `"Enemy"` guard read chasers the run does not step. Under
`noDamage`/`noclip`, `stepChasersNow` returns at its first line, so `bob@304,144` sat at its placement while the game's
bob was at (337,200). The ON replay of the committed `noDamage` plans `l40button-l42-part0`/`-l41-part0` refused at
t972/t1061. The guard now asks `stepChasersNow`'s own gate.

## The survey and sweep rows this moves (before → after, by step / leg key)

**Survey** (CI run 38168138687 → local, key ON:
`SEEDLING_CONTACT_FIDELITY=<defaults>,bombPusherLive node scripts/procgen/survey-seedling-route.mjs --through=end --route=full --only=78,124,126,139 --timeout=5400`).
These are L40's four steps, matched on (level, goal, boot). **No row moves.**

| step | CI | ON |
|---|---|---|
| 78 | REFUSED VERB-APPLY (`shove` `pushableblockfire@576,576`) | = (same refusal text) |
| 124 | REFUSED STANCE-REENTRY (`hold` of `wandlock@448,432`) | = |
| 126 | SOLVED 70 t | = 70 t |
| 139 | SOLVED 172 t | = 172 t |

**Sweep** (leg ids at this head = sweep-4's; L40's legs are 376–415). Predicted from the node solves and the routes:

| leg | key | before (default, `STANCE_ROCKS` ON at main) | after (`bombPusherLive` ON) |
|---|---|---|---|
| 378 | `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` | solved; the wasm play diverges not-exact at ≈t1154 (L40BUTTON's prediction; the bomb) | **REFUSED**, family `BOMB` (the hold) |
| 381 | `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | solved; diverges not-exact at ≈t1065 | **REFUSED**, family `BOMB` |
| 376, 377, 379, 380, 382–415 | the north exits, and every south-arrival goal (≥ 400 px from the lobber) | — | predicted unchanged |

### The CI dispatches the planner should run

```
gh workflow run seedling-divergence-sweep.yml -R PeerInfinity/Archipelago-CC --ref claude/seedling-bombpusher-fidelity-pu0sgy \
  -f producer=solver -f mode=inv -f ids=376,377,378,379,380,381,382,383,384,385,386,387,388,389,390,391,392,393,394,395,396,397,398,399,400,401,402,403,404,405,406,407,408,409,410,411,412,413,414,415 \
  -f contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,bombPusherLive
```
Expected: 378 and 381 REFUSED (`BOMB`); every other L40 leg as in the control. The control is the same run with
`contact_fidelity` empty. Expected there: 378/381 diverge not-exact at the bomb (≈t1154/≈t1065), unchanged from main.
Optional (nothing moves locally):
`gh workflow run seedling-survey.yml … --ref <branch> -f route=full -f through=end -f only=78,124,126,139 -f base_run=38168138687`.
The survey needs an ON default to measure ON in the page (the browser has no `process.env`).

## Byte-inertia (the switch OFF)

| row | result |
|---|---|
| identity block AFTER (head, OFF) | log md5 `cc2794cdc1fc04e469a245f736c09cd4` (at `46552e4`, `SEEDLING_PORT=9641 bash scripts/procgen/identity-block.sh .`): **every value row = W0** (maze `57e07d21`, acceptance `76602ae8`, c3/c6/c4, ENEMY, guard, AREA, killgate s2/s5/s9, pre/post-sword, generated set `OK`). Its reference row read 8 DIFFER before the reference was regenerated (`d50a8cd`); after, the same 4 environmental DIFFER as W0 |
| six producer `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 (= W0) |
| tapeRunner AFTER | **611** rows, md5 `75a3c41f0c91f6e71953e82d8259dc60`, 0 non-pass, which is **W0 byte for byte** (no committed tape moves; no new tape) |
| bounded AFTER (OFF) | **80 files / 3,130 tests, all green**, md5 `0854cf0bfa2cc3e316e056c1228507e2`. Against BEFORE: + 8 `bombPusher`, + 12 `fidelityBombPusher`, + 1 `contactFidelityHook` row (the new key's setting), + 2 `levelRun` staged witness rows. The `levelRun` name pins, `entityBlocks`' family rows, `contactFidelity`'s default pin and `boxLock`'s conditional-taker list were extended by name (below). Every other row is identical |
| survey L40 steps | ON = CI on every row; OFF is the unchanged code path |

## Switch ON: everything measured, for the licence

| row | result |
|---|---|
| bounded set ON (`SEEDLING_CONTACT_FIDELITY=<defaults>,bombPusherLive`, 80 files) | **1 red**: `fidelityL40Button` *"from the cluster's own boot: OFF refuses …, ON latches t0, breaks, latches t1, collects"*, because the cluster plan now refuses at the hold (D3; the behaviour the flip buys). 15 rows skip under the env var (14 `contactFidelity` witness rows, 1 `fidelityLeash` default pin) |
| the default flipped IN CODE (copy + restore), the five files that skip or pin it | **3 red**: `fidelityBombPusher` *"bombPusherLive ships OFF"*, `contactFidelity` *"the shipped defaults"* (both default pins) and the same `fidelityL40Button` row; the 14 contact witness rows stay green |
| identity block + six `--check`s ON | **byte-identical to OFF**: log md5 `cc2794cdc1fc04e469a245f736c09cd4` (`SEEDLING_CONTACT_FIDELITY=<defaults>,bombPusherLive`), every value row and the six `--check`s = W0 |
| survey movers ON | none (78, 124, 126, 139) |
| sweep movers ON (predicted) | legs 378, 381: from a not-exact divergence at the bomb to a named refusal (`BOMB`) |
| committed tapes | none move |

So a flip owes three re-pins. One is a behaviour re-pin: the cluster-boot row's ON arm becomes the D3 refusal.

## Records

| row | result |
|---|---|
| surface | `census-seedling-solver-surface --write`: **GREEN 271**. New rows `import:BOMB` (constant), `import:stepBomb`/`stepBombPusher` (stepper), classified by hand; the families/ledger folds; the doc's entity-blocks section by hand (`bombPushers`, `bombs`; `explode` and `proximity` move to *Modelled*) |
| constants | **PASS 5,782** (`bombPusher.js`'s literals and one `levelRun` splice classified; `--profile-rows` regenerated, see deltas) |
| entities / profile | entities **PASS 558** (`ENTITY_RECORD_MODULES` names `bombPusher.js`; its 23 leaves measured with `--only` over the 211-tape fast tier and merged as `partialRemeasure.bombpusher`: 21 corpus-blind; `shotTimeMax`/`anims.shoot.frames` threw at +1 ULP, the `turret.anims.startshot.frames` shape; `entitiesMd5` 322c896f → 74dbffa2) · profile **PASS 138** (both) |
| roster | **unchanged** (no new tape; the witnesses are `fixtures/bomb-witness/`, not roster tapes) |
| pins (by name) | `levelRun.test` ENTITY_FAMILY_NAMES + `bombPushers`, `bombs`; LEDGER kinds 35 → 36 (`bombEvents`); `entityBlocks.FAMILY_BLOCKS` + 2 rows; `contactFidelity.test` defaults + `bombPusherLive: false`; `boxLock.test` conditional takers + `probe-seedling-bombpusher.mjs` |
| reference / help | `generate-procgen-reference.mjs` regenerated at `d50a8cd` (instruments 426, the docs index); `--check` leaves only the 4 environmental rows (`registry.js`, `capabilities.js` and their two regions: this box's substrate submodules are not checked out; left as committed), the same 4 as W0. `checkProcgenHelp`/`procgenHelpBaseline` green (the probe passes the HELP and IMPORT doors) |
| `boxLock` | the new probe takes the box (`browser`) in its game arm only; named in `boxLock.test` |
| bot doc / log | `seedling-bot.md` (the BombPusher paragraph); `seedling-bot-log.md` BOMBPUSHER entry with trap candidates |
| CI (`JavaScript Unit Tests`) | `46552e4`: run **38181863990**, unfiltered **19,840 / 19,844**. The 4 reds were records this slice owed: `procgenDocs/generated` ×2 (the reference with the new probe) and `entityRecords` ×2 (the roster and the dump md5). Fixed in `d50a8cd`. At `d50a8cd`: run **38183479779**, **19,841 / 19,844**. The 3 reds were all `seedlingEntityWitness` (the 23 new record leaves had no row); fixed in `3845d11` (`--check` PASS, the file 5/5 locally). ⚠ **No JSUT run exists at `3845d11` or at this report's commit.** The workflow's path filter did not fire on `scripts/procgen/seedling-entity-witnesses.json` (only `unittests`, run 38185106776, ran), and this commit is docs-only. I pushed no empty commit to kick CI. The planner's harvest run is the first JSUT to include `3845d11`. The slow battery printed no summary on either run |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no force-push |

## Deltas

- New: `bombPusher.js`, `bombPusher.test.js` (8), `fidelityBombPusher.test.js` (12), `fixtures/bomb-witness/` (2),
  `scripts/procgen/probe-seedling-bombpusher.mjs`.
- `contactFidelity.js`: one appended key, `bombPusherLive: false`.
- `levelRun.js`: the bomb state, `stepBombsNow`/`stepBombPushersNow`/`stepBombsThroughFreeze`/`drainBombBlastsNow`/
  `bombForecastNow` (my functions), and one line at each of their call sites. `spitForecastNow`: the lobber forecast
  for a turret-less room, and a refusal for a turret+lobber room. Families `bombPushers`/`bombs`, ledger `bombEvents`.
  Each is inert OFF.
- `dangerMap.js`: `spitDanger` (a `mode` arg, default `'wait'`), `bombBlastHits`, `lobberWaitDanger`.
  `solverView.js`: one re-export row. `solverBot.js`: `lobberHoldRefusal` and its one call in `execHold`.
- `surveyFamily.js`: one appended `BOMB` row. `entityBlocks.js`: two appended `FAMILY_BLOCKS` rows.
- `entityRecords.js`: `ENTITY_RECORD_MODULES` + `bombPusher.js` (the dump md5 pin 322c896f → 74dbffa2 in its test);
  `seedling-entity-witnesses.json` + 23 rows (`partialRemeasure.bombpusher`). The reference is regenerated (instruments 426,
  the docs index); `seedling-bot.md` and `seedling-bot-log.md` are updated.
- Shared tables: no row reordered or reworded. `OBSTACLE_STRATEGIES`, `DEADLINE_SITES`, `KNOWN_STRATEGY_VERBS` and
  `KILL_ARM_POLICY` are untouched.
- **Nothing in the hammer arc's or the JS arc's functions.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and
  `createRunForStaging` are unchanged. There is no new staging/result field and no new obstacle kind.

## What the brief got wrong (measured)

1. *"Explosion … radius 24"*: the hit radius is **15**. `Explosion.radius` is an `int`, so `radius *= 0.65` truncates.
   The same AS3 builds `BossTotemShot`'s blast (`BossTotemShot.as:71`, `new Explosion(…, 24, 1)`), and
   `bossTotemFight.BOSS_TOTEM_SHOT.explosionHitRadius` carries **15.6** (residue, not mine).
2. *"leg 378 at t1154"*: the game's hit is **t1153** (`hits` 0 → 1). t1154 is the first diverged position.
3. *"the 101-tick fade wait"*: the hold the solver plans is a **131-tick** bound (the latch + the fade + slack).
   The blasts land 47 / 57 ticks into it.
4. *"Explosion also hits Enemy/ShieldBoss — model it if any L40 body is in range"*: on the damage-on walks **no** blast
   reached a body. The only apparent one was the D2 guard reading an unstepped placement under `noDamage`. The arm is
   a refusal by name, not modelled.
5. *"read `seedling-bot-log.md`'s latest entries (wave 12: … L40BUTTON …)"*: at `db221dc093` the log has CROSSROOM,
   LEASH and SOLVECOST, but **no L40BUTTON entry** (`grep -a -n -i l40button` hits nothing). `seedling-bot.md` has
   its paragraph.

## Hand-overs and residue

- **A moving wait (new work order; not FORCEDHIT's damage policy).** A latched presser's fade, a swing stance's
  settle and a keylock's line could be waited out while pacing. Each measured hit is on a player that moved ≤ 9 px in
  the 31 ticks after the launch; every blast that landed on a walking player missed. The verb would need its own
  preview (the D3 forecast already prices a moving dwell sample by sample) and a cert. The executors' "a hold that
  moved is a failure" contract (`botDriverV2.runHold`, `solverBot.runLatchedWait`) is what it would relax.
  **FORCEDHIT:** this is NOT a forced-hit candidate. A bomb-free plan exists in principle; the verb does not.
- **The death reboot's camera** (both witnesses stop there): after `restartLevel()` the game's camera is (777,0) /
  (800,22) and the model's exact one is (776,0) / (800,24). Whoever owns the death reboot / camera.
- **`BOSS_TOTEM_SHOT.explosionHitRadius` 15.6 → 15** and the Explosion's `_x:int, _y:int` truncation of
  `x + v.x` (`BossTotemShot.as:71`): the totem-shot model (unowned in this wave). A fix may move L43 boss tapes; it
  needs a measurement first.
- **The `"Enemy"` arm of a bomb's blast** (`Enemy.hit(4, …)`): refused by name, unreached on the measured walks.
- **Nothing for the hammer arc. The JS arc wires nothing:** the flashPanel setting is derived from
  `CONTACT_FIDELITY_KEYS` (`contactFidelityHook` green with the new key), and the browser reads the code default.

## Rows to BANK

- `CONTACT_FIDELITY.bombPusherLive` OFF; witnesses `fixtures/bomb-witness/bombpusher-l4{1,2}-part0-damage.json`;
  `bombPusher` 8 rows, `fidelityBombPusher` 12 rows; roster unchanged; tapeRunner 611 `75a3c41f` (= W0).
- Surface GREEN 271, constants 5,782, entities 558 (`entitiesMd5` 74dbffa2), profile 138.
- Licence question for the user: flip `bombPusherLive`. Measured movers: no committed tape; the identity block ON
  = OFF = W0 (no row, no producer digest moves); survey none. The bounded set ON is red only on `fidelityL40Button`'s cluster-boot row (+ the two
  default pins in code). Predicted sweep movers: legs 378, 381, from a divergence at the bomb to a named `BOMB`
  refusal.
