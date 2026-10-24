# Seedling fidelity BOBSOLDIER: the BobSoldier, a chaser with a spinning sword, and a corpse that keeps swinging

**Slice:** `seedling-fidelity-bobsoldier`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-3`), wave 8 (model coverage).

| | |
|---|---|
| Started from | **`0f952e9a9e`** (`fidelity-harvest/wave7`: main `9e1361f7c5` + CHECKPOINTS + LINEFLIP) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/bobsoldier-spinning-sword-810qta` (there is no local `seedling-fidelity-bobsoldier` branch; the harness branch IS the slice branch) |
| Commits | D1+D2 `ae99f30` · D3 `66d7c13` · help-gate fix `c2580f9` · D3 tests + bot.md `8b1c6bb` · log + reference `af79da5` · entity witness `ffb1b10` · this report |
| Dev servers | `serve-nocache.py 9450` (this tree), `9451` (a pristine BEFORE worktree `/home/user/wt-base` @ `0f952e9a9e`, `node_modules` and submodules symlinked) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS** (with a measured residue: the kill arm's dwell and the decision gate, below) |

## The one thing to know first

**A killed BobSoldier keeps swinging.** `BobSoldier.update` runs `super.update()` and then its own tail with **no `destroy` test**. So the corpse keeps chasing and its sword keeps hitting through `Mobile.death`'s eleven-tick fade. The game confirms it: the witness `bobsoldier-corpse` kills the body at t150, and the corpse's blade hits the player at t155. The sword also has no enemy i-frame gate, so a struck body still cuts.

Everything ships ON behind two new `contactFidelity` switches: W4 `bobSoldierLive` and W5 `chaserPointExact`. All six producer `--check`s and all 533 old tapeRunner rows are byte-identical. No re-record was needed.

## W0 (at `0f952e9a9e`, before any edit, in the pristine worktree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9451 bash scripts/procgen/identity-block.sh .` in `/home/user/wt-base` | maze `246dfbce…`, acceptance `608693d2…`, c3 `043e1944…`, c6 `f85e7722…`, c4 `4aa74add…`, ENEMY `d59f0c97…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `01210c82…`/`07ce222a…`/`30a1e3e7…`, level pre/post s1 `e28c1e5d…`/`c4841acb…`; reference `4 … DIFFER` (this container's uninitialised substrate submodules). Log md5 `a1eae3cc…` |
| generated set | the block's row, re-run with the primary venv active (a worktree has no `.venv`) | `OK` |
| six producers | the block's loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1` + `r9-campaign a569eeec`, **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, sorted `(fullName, status)` | **533**, md5 **`71bda323e8c6a709fecbfd0734ebf945`**, 0 non-pass |
| surface / constants / entities | the three `--check`s | GREEN 208 / PASS 5,327 literals / PASS 518 leaves (`entitiesMd5 d10864a0…`) |
| profile | `PROFILE` | 138 keys, `d06ae110…` |
| roster | `fixtures/tapes/index.json` | 238 |
| bounded vitest BEFORE | 50 files: the brief's list plus every `grep -a` hit for what I touch (`arrowTrap`, `bossTotemFight`, `botDriverV2`, `chasers`, `combat`, `dangerMap`, `encounters`, `enemyDamage`, `entityRecords` (+agreement), `fidelityF1`/`F1b`/`F4`/`L14`/`Proximity`, `iceTurret`, `levelRun`, `levelWorld`, `moverSolids`, `r4Swim`, `r5Totem`, `shieldBossFight`, `solverBot`, `solverPrefix`, `spinner`, `bobBoss`) | **50 files / 2,742 tests, all green** |

## D1: the transcription and the bridge (PASS)

**`bobSoldier.js`** transcribes `Enemies/BobSoldier.as`'s tail:
- `swordSpinningBeginCheck(d:int)`: the `int` parameter truncates `d`, so the spin begins at d < 33. The reset timer counts down only inside that range with the sword at rest.
- `swordSpinningBegin`: the 60-update reset, and `(spin + 2π) % 2π`.
- `swordSpinningStep`: π/10 a tick. After a full turn, `FP.angle_difference` to the player's `-atan2` angle within one step stops it, and the blade SNAPS to that angle.
- `swordHitting`: every tick, spinning or not, `collideLine("Player", …)` from 8 to 16 px off the body, at force `3 * damage`. It reuses `crusher.collideLineSolid` (W1's exact samples).
- At rest the blade points DOWN (`swordSpin[0] = 3π/2`) until the first spin.

**The bridge.** `CHASERS.bobsoldier` (+ `MODELLED_ENEMY_CLASSES.BobSoldier`, module `chasers.js`, gated by W4 via `liveSwitch`):
- the chase is `chaseImpulse` (Bob's eleven lines, `moveSpeed` 0.8, `runRange` 80, no target offset);
- `freezesOnGameFreeze: true`, `chasesWhileDying: true`, `dieAnim: null` (`Enemy.startDeath` sets `destroy` at the blow);
- `solidsMover: 'enemy'`: `Mobile`'s base list. The ctor pushes nothing, so no "Enemy" — siblings and static "Enemy" bodies do not stop it.

**`levelRun`** steps the sword in all three paths: live (below the chase), pit descent, and destroyed (fade). Each is behind the freeze return and billed through `applyPlayerHit` (`source: 'sword'`, the dark suit retaliates into it). `chasersNow` reports `swordSpin` / `swordSpinning` / `swordSpinResetTimer` on a sword class only.

**The L40 IceTurret refusal re-derived.** The first run with the class bridged threw on three committed tapes (`prox-l40-turret-contact`, `prox-l40-turret-volley`, `r4-iceturret-bobs`). `assertChaserSolidsBound`'s flip-blindness assumed every bridged tag carries "Enemy". Now `chaserStaticEnemyBoxesNow` carries the turret's `solid` latch, and `enemyBoxStopsChaser` asks per mover. The refusal requires only "Solid".

**W5 `chaserPointExact`.** The L30 capture's body velocity drifted by an ulp from t38 (game `vx 0.7884788477227912`, model `…911`). `chasers.js` spelled `Point.length` as `Math.hypot` and `Point.normalize(t)` as `(x / m) * t`. The runtime is `sqrt(x*x + y*y)` and `x * (t / m)` (`playerPhysicsV1.pointNormalize`, R9 12e⁗'s finding for the player). With W5 both captures are bit-exact on the player AND the body at every tick.

**Witnesses** (authored by `plan-seedling-bobsoldier.mjs`, recorded on the game with `check-seedling-bot-differential --record --only=…`, p4f, headless, port 9450):

| tape | what the model predicted before recording | game |
|---|---|---|
| `bobsoldier-sword` (L30, stand at (104,120), no item, 127 t) | spin begins t49, blade hits t80 and t107 | "ALL CHECKS PASSED (recording mode)"; the model reproduces the recording (tapeRunner) |
| `bobsoldier-kill` (+ sword, 157 t) | presses land t68/t99/t137, kill billed t138, removal 11 later, one sword hit t100 | reproduced; game `hits` 1 = model |
| `bobsoldier-corpse` (third press held 19 t, 169 t) | kill t150, the CORPSE's blade at t155 | reproduced; game `hits` 2, `hits_timer` 5 = model |

**`probe-seedling-bobsoldier-mobiles.mjs`** (new; box-guarded, behind `isEntryPoint`, on `boxLock`'s `guarded` list) compares the body itself. Every run has clock shift [0] and position, velocity, `hits` and `hits_timer` with **worst |Δ| 0**:
- sword: 128 comparisons;
- kill: 149;
- corpse: 161;
- step-52 walk: 194.

⚠ `botMobiles` carries no `swordSpin`, so the angle/phase is witnessed by what it does (the hit ticks), not read.

**TERRAIN's captures** (`fixtures/contact-witness/308`, `309`): BEFORE they left the game at t67/t66. AFTER, both replay at **0 px**, player and body, all 69 ticks.

**Mutants** (predicted, then made by copy → edit → restore; md5s restored `bobSoldier.js fad9935a…`, `chasers.js f02d6b74…`, `levelRun.js 489fa150…`, `dangerMap.js 06c80316…`):

| mutant | predicted | measured |
|---|---|---|
| M1 spin rate π/10 → π/9 | 308/309 red; my tapes red at their hit ticks | 308/309 red at t64/t66. **My three tapes: unchanged** — every blade hit on them is a RESTING blade that the stop snapped onto the player, so the rate cannot move it. Only TERRAIN's captures discriminate the rate. |
| M2 the `int` truncation dropped | red somewhere | 308/309 red at t67/t66; my tapes unchanged |
| M3 the corpse's sword removed | invisible to sword/kill; red on corpse | **corpse red at t155** (game recording); sword/kill unchanged; 308/309 unchanged |
| M4 `chasesWhileDying` false | body v during the fade | kill: body red t139 (Δ0.53); corpse: body red t151, player red t155 |
| M5 W5 OFF | ulp drift | kill: body red t141 (**Δ0.80**); corpse t151 (Δ0.79). The `pushed` test (`|v| > 0.8`) flips on a 1-ulp length, so this is not bounded by an ulp |

## D2: the kill (PASS)

- `KILL_ARM_POLICY.BobSoldier` → `modelled`. The row's old reason, *"a shield state nobody has transcribed"*, names a state `BobSoldier.as` does not have.
- `CORPSE_COUNTING.BobSoldier` is `fade` with `chaserTag 'bobsoldier'`, so `removalTicksAfterHit` = 11.
- `KILL_SIDE_WRITES.BobSoldier` is `none` (`removed()` is an empty override).
- `chasers.deathTicks('bobsoldier')` = 0, and `removalTicksAfterHit` now accepts 0 for a `fade` row.
- The kill and the corpse are witnessed on the game (D1's table, `bobsoldier-kill` and `bobsoldier-corpse`).

**TERRAIN's L30 legs re-served live** (`probe-seedling-contact-divergence.mjs`, this head on 9450 vs the pristine worktree on 9451). The leg ids at this base are TERRAIN's + 1: TERRAIN's 309 is id 310 here, and 308 is 309.

| leg | goal, arrival | BEFORE (game) | AFTER (game) |
|---|---|---|---|
| 310 | L30 → L28, (224,80) | **left at t131** | **done, on plan** |
| 312 | L30 → L31, (224,80) | left at t131 | **done, on plan** |
| 316 | L30 → L31, (240,80) | left at t144 | **done, on plan** |
| 309 | Torchpickup, (176,48) | left at t95, then refused | refused by name (kill arm dwell) |
| 313 | Torchpickup, (224,80) | done after leaving at t1 | refused by name (`the combat ladder is EXHAUSTED … chaser:bobsoldier@48,80 (the sword …)`) |
| 317 | Torchpickup, (240,80) | left at t147, refused | refused by name |
| the other 18 L28/L30 legs | — | done | done |

**6 plays left their plans before; 0 after.** The Torchpickup item (64,64) stands beside the body (56,88), and the solver now declines it by name.

## D3: the solver (PASS, with residue)

- **The forecast** (`chaserForecastNow`) steps the sword on its clone and reports `sword: {lines}` per tick on a sword body. A fading corpse's lines ride BESIDE the projection as the array property `swordsOnCorpses`, because the kill arm reads a body's absence from the projection as its death.
- **`dangerMap.chaserDanger`:**
  - a sword is not the body's contact: the i-frame skip removes only the body term, and a destroyed BobSoldier keeps the sword term;
  - in TRANSIT the forecast's lines are tested against the sample's own box, which is the pre-move player `swordHitting` tests, and the body is priced bare;
  - the WAIT arm and the live bodies keep `threatPad` 16.
- `solverView` exports `chaserHasSword` and `collideLineSolid` (surface 208 → 210, both classified).
- **D3 mutants:** (a) the i-frame skip swallowing the sword → only the i-frame row red; (b) the corpse-lines loop removed → only the corpse row red. Both were predicted.

**Game witnesses:**
- **A walk past one:** legs 310/312/316 (above) cross L30 past the live, chasing BobSoldier and play on plan.
- **A kill:** `bobsoldier-kill` / `bobsoldier-corpse` (scripted presses, recorded on the game).
- ⚠ No SOLVER-authored kill of a BobSoldier was played. The solver's own kill arm refuses the one place it tried (residue 1).

### The survey rows this moves (`survey-seedling-route.mjs --through=end --only=50,52,61,82,84,132`, both trees)

| step | room, goal | BEFORE | AFTER |
|---|---|---|---|
| 50 | L30 Torchpickup + stairs | REFUSED (keylock loop at `bosslock@64,32`) | REFUSED, the same text |
| **52** | L30 → L22 (teleporter@64,0), boot (224,80) | **SOLVED 204** | **REFUSED**: *"the danger map forbids (71.77,50.12) — chaser:bobsoldier@48,80 (inside leash 80 (d=4.7), box grown 0.8 px/tick x 0 + pad 16). Slice 2 has NO DODGE POLICY"* |
| 61, 82 | L40 | REFUSED (shove / collect) | the same |
| 84, 132 | L40 | SOLVED 70 / 172 | SOLVED 70 / 172 |

⛔ **Step 52's BEFORE "SOLVED" was false, measured on the game.** I replayed its 204-tick walk on the AFTER model: a sword hit at t152, body contacts at t172 and t192, and the player **dies** in L30. I then played the same walk on the game through the body probe. Over 194 sampled ticks the game's player follows the AFTER model exactly (clock shift [0]), death included, and the body is bit-exact. So 3/6 → 2/6 is a false SOLVED becoming an honest named refusal.

### The ENEMY census (identity block, the only moved identity row)

`d59f0c97…` → `e86372da…`, one row (`bobsoldier`):
- `stepper` no → **yes**;
- the chamber arm SOLVED 155 → **REFUSED** (the live body walks onto the chamber route; U7's puncher row moved the same way);
- the corridor arm is REFUSED both before and after.

Both outputs are in the evidence directory.

## For the JS arc: pins, fields and words

**Pins red at my head: none.** `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `jsRuntimeWalker`, `jsRuntimeSolver`, `wasmArrival` and `jsRuntimeDeclarations` (read-only) ran at the head: **6 files / 99 tests green**.

**New optional fields** (nothing removed, no signature moved):
- `run.chasers` rows carry `swordSpin`, `swordSpinning`, `swordSpinResetTimer` (BobSoldier only);
- `chaserForecast().step()` bodies may carry `sword: {lines}`, and the returned ARRAY may carry `swordsOnCorpses`;
- `playerHits` rows may carry `source: 'sword'`;
- `contactFidelity` gains `bobSoldierLive` and `chaserPointExact`.

No new `SolverRefusal.obstacle.kind`.

**What to wire:**
- the divergence sweep's next dispatch re-measures L28/L30/L40;
- CANCROSS's `solverStamp` moves (`levelRun.js`, `chasers.js`, `dangerMap.js` changed), so derived rules read STALE until re-derived.

## Deltas

**New files:**
- `frontend/modules/seedlingDemo/bobSoldier.js` and `bobSoldier.test.js` (17 rows);
- `scripts/procgen/plan-seedling-bobsoldier.mjs` (`--check`: 15 PASS) and `probe-seedling-bobsoldier-mobiles.mjs`;
- tapes + expectations `bobsoldier-sword`, `bobsoldier-kill`, `bobsoldier-corpse`;
- the evidence directory `CC/docs/cloud-reports/seedling-fidelity-bobsoldier-evidence/` (probe outputs, the live-sweep rows, the survey rows, both ENEMY census outputs).

**Changed:**
- `chasers.js` (the row, `liveSwitch`, W5 arithmetic, `chasesWhileDying`, null die anim);
- `combat.js` (stepped family + `CONTACT_STEPPED_SWITCH`);
- `spinner.js` (roster row);
- `enemyDamage.js` (policy, corpse, side write, `removalTicksAfterHit` 0);
- `contactFidelity.js` (W4, W5);
- `levelRun.js` (sword stepping, per-mover enemy boxes, the turret latch, the IceTurret derivation, the forecast);
- `dangerMap.js`, `solverView.js`, `r8Acceptance.js` (scope + 7 exposure rows), `levelWorld.js` (a comment).

**Records:**
- surface GREEN **210**; constants PASS **5,364** (35 rows classified, `--profile-rows` + `--write`); entities PASS **520** (`0655b315…`, the witness re-measured);
- roster **241**; tape index regenerated; `boxLock` guarded list +1; `check-procgen-help --only=<each>` ALL PASS;
- `seedling-bot.md` (a BobSoldier paragraph, the captures sentence), `seedling-bot-log.md` (entry + four trap candidates);
- reference: instruments + docs index regenerated.

**Pins moved and re-pinned** (each named in its test):
- roster counts 238 → 241 (`tapeEnvelope`, `observationTolerance` ×2, `dialogueAutoAdvance` ×2);
- `entityRecords` md5;
- `spinner` roster;
- `r8Acceptance` scope / CHASERS keys / partition / exposed set 62 → 69 and its synthetic mirror (+ L30);
- `campaignChain` touching rooms (+ `r9-solve-31`, `r9-solve-30`);
- `r4Swim` "every tag carries Enemy" → "every tag carries Solid";
- `chasers` loop/closed form (a null anim);
- `contactFidelity` (308/309 → W4, defaults row, a W5 row).

## What the brief got wrong (measured)

1. **"Bob's chase block"**: the chase is Bob's, but the gate is not. `BobSoldier.update` has no `destroy || "die"` return, so the corpse chases and swings. A Bob-shaped transcription passes two of the three witnesses and fails `bobsoldier-corpse`.
2. **"`hits_timer` 14 — its sword"** (TERRAIN): that `hits_timer` is the BobSoldier's own i-frame from the player's earlier press, not the sword's. The sword has no i-frame gate at all.
3. **`KILL_ARM_POLICY.BobSoldier`'s "shield state nobody has transcribed"**: there is no shield in `BobSoldier.as`.
4. **The rooms**: L28's BobSoldier never touched a played leg (all six L28 legs were "done" both before and after). Every mover measured here is L30's. L40's BobSoldier (`bobsoldier@880,832`) was not driven by any witness. The L40 sweep legs were not re-served, and the L40 survey steps did not move.
5. **"Placed L28, L30, L40 … a chaser"**: true, and the bridge then broke the IceTurret refusal in L40, which assumed every chaser carries "Enemy". It was caught by the entity witness's CONTROL (three L40 tapes threw), not by a unit row.
6. **The exposure prediction**: this slice predicted zero new exposed tapes. The R8 guard found four (`r9-solve-30/31/32`, `swim-u5-bobboss-encounter`), all outside the leash for their whole L30 span (closest 110.8 px). They are byte-inert by geometry.
7. **"The probe pattern … angle/phase per tick"**: `botMobiles` has no sword angle, so the phase is not readable from the game.

## Residue

1. **The chaser kill arm's dwell (Torchpickup legs 309/317, node-reproduced from TERRAIN's capture 308).**
   - The preview says the walk reaches stance (88,56) in 145 ticks and the body dies at t168, so the dwell bound is 53.
   - The DRIVE reaches the stance at t92 and runs t93–145. The body stalls against the room's wall at ~(77,74) with `hits` 2 and the bound expires.
   - The preview's arrival tick is 53 ticks later than the drive's, a preview/drive gap in the kill arm's derivation, not in the body model (the body is bit-exact on the game).
   - That derivation is not this slice's region.
2. **The decision gate's pad on a live BobSoldier** (survey step 52, leg 313): `refuseDanger` → `dangerNow` prices the live body with `threatPad` 16, as U7's wall 3 did for the puncher. The live body carries its sword state, so an exact live pricing is possible, but it changes the goal loop's gate (another slice's region) and needs a game witness of the relaxation.
3. **Update order in mixed rooms:** `stepChasersNow` steps bridged chasers in reversed census order. The game updates by class (`Game.as:2276-2301`: puncher, then BobSoldier, then Bob). This only matters where bodies can block each other: L40, where the BobSoldier is 600 px from the others.
4. **L28** (BobSoldier + two drills): the drills are not live there (`drillLive` admits one-drill rooms only), so they are static "Enemy" boxes, which the BobSoldier's base solids pass through. No leg reaches it.
5. **The sword angle** is not exposed by `botMobiles`; a wasm-side readout would let the probe compare the phase directly.
6. **The reference** reads 8 DIFFER under `--check` in this container, and 4 in the pristine one. The extra four are mine (instruments, docs index, README, architecture) and are regenerated. The base's four (registry, capabilities, substrate docs) come from the uninitialised substrate submodules and are deliberately NOT regenerated here.

## Byte-inertia

| row | W0 (`0f952e9a9e`) | AFTER (head, W4+W5 ON) |
|---|---|---|
| maze / acceptance / c3 / c6 / c4 | as above | **identical** |
| ENEMY census | `d59f0c97…` | **`e86372da…`** (the bobsoldier row, explained above) |
| guard / AREA / killgate s2,s5,s9 / level pre,post s1 | as above | **identical** |
| generated set | OK | **OK** |
| six producers | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec`, exit 0 | **identical, all exit 0** |
| tapeRunner | 533, `71bda323…` | 539 (`afdd14c9…`); **all 533 old rows identical**, +6 (2 per witness) |
| tapeRunner with W4+W5 OFF | — | 533 old rows identical; only the three new witnesses fail (they need the body). OFF is the BEFORE model |
| bounded vitest | 50 / 2,742 | **51 / 2,774** green (+ `bobSoldier.test.js`) |
| `fixtures/**` | — | the three witness tapes + expectations, `index.json`; no committed tape or expectation moved |

⚠ The D3 mutants were made while the AFTER identity block and the entity witness were running:
- `dangerMap.js` is outside the tape-replay closure, so the witness could not see them.
- The identity block's rows all match W0 except the ENEMY census, which was re-run separately on both trees and reproduces `e86372da…`.
- That ordering is the slice's fourth trap candidate.

No AS3, wasm, gitlink or rules edit; no `standing-values --write`, `pytest` or unfiltered vitest.

## Rows to BANK

- W4 `bobSoldierLive` ON, W5 `chaserPointExact` ON; no producer moved, so no licence was needed.
- tapeRunner **539 `afdd14c96a0b89044d70d835b8ed3a69`**; roster **241**; surface GREEN **210**; constants PASS **5,364**; entities PASS **520** (`0655b315237cb63d79053e0b23eaf3fa`); profile unchanged (138, `d06ae110…`).
- producers `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec` (unmoved); ENEMY census `e86372da9906acfe394d9171b30e1206`.
- R8 exposed set **69** (+ `r9-solve-30/31/32`, `swim-u5-bobboss-encounter`, `bobsoldier-sword/-kill/-corpse`).
- Game witnesses: `bobsoldier-sword`, `bobsoldier-kill`, `bobsoldier-corpse` (body bit-exact); TERRAIN 308/309 at 0 px.
