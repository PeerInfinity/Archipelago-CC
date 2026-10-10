# Seedling fidelity BULB: a Bulb's death writes lava, and its kill is placed

**Slice:** `seedling-fidelity-bulb`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-5`), wave 11 (model coverage).

| | |
|---|---|
| Started from | **`99cdf5ce23`** (main after wave 10 `d978c76322` + the rules arc's F3) — the brief's base, unchanged |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-fidelity-bulb-3zf89p` (the harness branch IS the slice branch; there is no local `seedling-fidelity-bulb`) |
| Commits | D1+D2 `bfb91e3` · D3 `cf7a0eb` · records `e66855c` · docs `255be1c` · CI/census fixes + this report |
| Dev servers | `serve-nocache.py 9570` (this tree), `9571` (pristine BEFORE worktree `/home/user/wt-base` @ `99cdf5ce23`), `9572` (AFTER worktree `/home/user/wt-head` @ `cf7a0eb`) — `node_modules` and the submodules symlinked |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (switch OFF; the one identity cell it moved — the ENEMY census's descriptive `stepper?` column — fixed in the census) · D3 PASS · D4 PASS (measured in node; the CI confirmations are named below)** |

## The one thing to know first

**A Bulb on the path is not a kill problem once it is bridged, and the kill must not happen there.** With the Bulb stepped, the solver's one strike policy killed L74's Bulb on the one-tile bridge at t22 and the lava cut the way back to the L75 teleporter. The veto (D3) refuses that press. The Bulb then chases the player, walks into L74's own lava and drowns at t72: a terrain death, with no "drop" and no lava write. Survey step 160 then **SOLVES in 321 ticks** with `bulbLive` and K2 `lavaRunnerLive` both ON. Its walk is bit-exact on the game (322 sampled ticks, Bulb worst |Δ| 0).

Everything ships behind **`contactFidelity.bulbLive`, OFF**. OFF is byte-identical: tapeRunner 589 pairs and the six producers. ON moves no committed tape either. Turning it on is the user's licence. The flip movers are listed under D4.

## W0 (at `99cdf5ce23`, before any edit, in the pristine worktree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9571 bash scripts/procgen/identity-block.sh .` in `/home/user/wt-base` | maze `246dfbce…`, acceptance `76602ae8…`, c3 `4937da80…`, c6 `430573e9…`, c4 `b9d2185d…`, ENEMY `30bcc49c…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `006b0639…`/`7d4cb820…`/`49e23d85…`, level pre/post s1 `e28c1e5d…`/`fb1a59e5…`; reference `4 … DIFFER` (this container's uninitialised substrate submodules). Log md5 `2964699b…` (`…-evidence/identity-before.log`) |
| generated set | the block's row (its first run lost the box lock to my concurrent game probe), re-run alone with the primary venv active | `OK` |
| six producers | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `b064c264`, **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, sorted `(fullName, status)` md5 | **589**, md5 **`5bb5d660131d428da8bb9b0a5d70738a`**, 0 non-pass |
| surface / constants / entities / profile | the four `--check`s | GREEN **234** / PASS **5,488** literals / PASS **528** leaves / PASS **138** keys |
| roster | `fixtures/tapes/index.json` | **266** |
| bounded vitest BEFORE | 62 files: the brief's list, every `grep -a` hit for what I touch (`CHASERS`, `bridgedChaserTags`, `isBridgedChaser`, `MODELLED_ENEMY_CLASSES`, `KILL_ARM_POLICY`, `CORPSE_COUNTING`, `KILL_SIDE_WRITES`, `removalTicksAfterHit`, `deathTicks`, `CONTACT_FIDELITY`, `createStrikePolicy`, `strikeCandidates`, `strikePolicyFor`, `nearestWalkableTile`, `lethalTerrainTiles`, `chaserForecast`, `deriveKillByChaser`), plus `strikePolicy`, `combat`, `combatVerbs`, `entityRecords`, `killLockBodies` and the JS arc's pins (`jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `jsRuntimeWalker`, `jsRuntimeSolver`, `wasmArrival`, `jsRuntimeDeclarations`) | **2,397 tests, 2,392 pass, 5 skipped, 0 failed.** Two FILES error at import in the worktree only (`seedlingGenRoomDoors`, `seedlingGenRoomReroll`: `mazeRoom` resolves through the symlinked tree, `registerBackend: duplicate id 'empty'`); in the main tree the same two fail on the uninitialised `bulletml-dodge` submodule. Environment, both trees. |

## D1: measured on the game (PASS)

**The AS3** (`vendor/seedling/src/Enemies/Bulb.as`, `Bob.as`, `Enemy.as`, `Mobile.as`, `Scenery/Tile.as`, `Player.as`, FlashPunk `Spritemap.as`):
- **`startDeath` is EMPTY.** The update after the killing blow is a living one: `Enemy.update` moves the body, and `Bob.update`'s chase impulse runs. The contact stays quiet only because the blow armed `hitsTimer` 30. The update's LAST statement plays "drop".
- **"drop" and "die" run no `Enemy.update`.** There is no off-screen return, no terrain switch, no `hitUpdate` (`hits_timer` freezes) and no `hitPlayer`. The body slides: `v = tileCentre − pos`, normalised to `min(|v|, 0.65)`, then `mobileUpdate` (`friction()`, `moveX`, `moveY`; freeze-gated). It never leaves the tile, so the lava tile is decided when "drop" BEGINS. It rests once both velocity components fall in `friction`'s 0.05 dead zone.
- **The two anims** are 7 frames at rate 8, and they LOOP (`Spritemap.add`'s default): 27 graphic updates each. "drop"'s `endAnim` plays "die" and sets `collidePoint("Tile", x, y).t = 17`. Only `t` changes; the Tile's `type` was fixed by its own first update. "die"'s `endAnim` is `FP.world.remove(this)`: no `destroy`, no fade.
- **The lava's effect on the player** is the existing lava arm: `getState` reads `t` live, so `inLava` and `checkDrowning` apply (a damage-0 `hit` plus the drown timer, then `die()` → `restartLevel()`). Without the dark suit it is lethal. A new `Game` rebuilds the tile, so the write lasts the VISIT.

**The game witness `bulb-l77-lava`** (authored by `plan-seedling-bulb.mjs`; recorded with `probe-seedling-chaser-mobiles.mjs --class=Bulb --record`, p4f, headless, port 9570). L77, the player at (88,40) with a sword, facing south toward `bulb@80,72`:

| tick | game (`botMobiles`) | model |
|---|---|---|
| t1–48 | `walk`, the chase (vx alternating ±0.278, vy −0.587) | the same, bit-exact |
| **t49** | `hits` 1, `hits_timer` 30, still `walk` (moved and chased: the armed update) | kill billed t49 (`chaserKills`) |
| **t50** | anim **`drop`**, `hits_timer` **29**, and frozen there through t102 | `drop` event t50, tile (5,3) |
| t51–75 | the slide: v (0, −0.3995) … rest at (88.0511, 56.2478), **0.253 px off the centre** | the same |
| **t76** | anim **`die`** (the lava written) | `lava` event t76, tile (5,3) |
| t102 → **t103** | last row t102; gone at t103 | `removed` t103 |
| t110 → **t140** | the player walks onto (5,3): the lava hit, the drown, the death and `restartLevel()` | lava hit t110, `playerDeaths` t140 `lava` |
| t140–211 | the rebuilt room: the Bulb back at (88,80), chasing; the walk re-crosses (5,3) and does not drown | the same; `run.tileWrites` empty |

**212 sampled ticks, the player calibrated at shift [0], 175 Bulb comparisons (position, velocity, `hits`, `hits_timer`, anim, presence), worst |Δ| 0.** `fidelityBulb.test.js` replays it ON, and shows that OFF does not reproduce it.

## D2: the model (PASS, behind `contactFidelity.bulbLive`, OFF)

- **`bulb.js`** (new) holds the Bulb's death: `bulbSlideStep` (the slide), `stepBulbGraphic` (the two anims' `endAnim`s), `createDropAnim`, `tileUnder`, `dropTicks` / `dieTicks` (27/27), `hasDropDeath`.
- **`CHASERS.bulb`** (`chasers.js`): `dieAnim: null`, `dropDeath: {drop, die, becomes: lava}`, `solidsMover: 'chaser'`, `liveSwitch: 'bulbLive'`. `deathTicks('bulb')` = 54.
- **`MODELLED_ENEMY_CLASSES.Bulb`** (`spinner.js`, `wedgeVisible: false` like every chaser).
- **`enemyDamage.js`**:
  - `KILL_ARM_POLICY.Bulb` is a getter: `modelled` ON, the old refusal verbatim OFF;
  - `CORPSE_COUNTING.Bulb` uses a new shape `drop+anim` (`removalTicksAfterHit` = 1 + 54);
  - `KILL_SIDE_WRITES.Bulb` is `none` (the floor write is terrain, not persistence).
- **`levelRun.js`**:
  - the roster carries `hitsMax` 1, `bulbPhase` (`null` → `armed` → `drop` → `die`) and `dropTile`;
  - `stageChaserKill` arms the Bulb instead of playing "die";
  - the armed update runs Bob's living step (`dying` is not "die" yet), and `startBulbDrop` closes it;
  - "drop"/"die" take a branch with no `Enemy.update`;
  - the graphic half writes the lava into **`tileWritesByLevel`** and re-wraps the `world` binding (`visitWorld`, also at the three mid-visit rebind sites); `freshVisitState` drops the writes;
  - the chaser forecast stages the same death on its clone: the armed update, the slide, a frozen i-frame, the removal, and `lavaTile`/`lavaAt` on the projection.
- **`levelWorld.withTileWrites(world, writes)`** (new): a prototype child of the built world. Its `tiles`, `walkableTiles`, `pitTiles`, `lethalTerrainTiles`, `waterfallTiles`, `bridgeTiles` and `nearestWalkableTile[WithTie]` read the written `t`. The scan is one function (`nearestTileScan`), shared with the base world. A write to a cell `collidePoint("Tile", …)` cannot reach is refused by name.
- **Switch-bridged the KILLLOCK way.** Adding `bulb` to `combat.CONTACT_STEPPED_FAMILIES` reds `r8Acceptance`'s stepped-contact partition **with the switch OFF**: an unbridged family must not name a pricer, and the `families: 7` pin. So `contactPricing('bulb')` stays a `mover`, and `stepContactsNow` skips a bridged Bulb by name in a stepped room, exactly as it skips a KILLLOCK chaser.
- Refused by name: a Bulb destroyed by terrain, or starting a pit fall, on its armed update. The game would run "drop" on a fading body, and its lava write would race the fade.

**Mutants** (predicted first; made by copy → edit → restore; md5s restored and checked):

| mutant | predicted | measured |
|---|---|---|
| M1 the slide without `friction()` | the slide unit row and both witnesses red from the first slide tick | 3/18 red: the slide row (rest 88 vs 88.0511) and both witnesses (52 / 52 rows) |
| M2 "drop" armed one update late | both witnesses red from the armed tick | 2/18 red: both witnesses (107 / 105 rows) |
| M3 the lava write without re-wrapping `world` | the player does not drown | 1/18 red: `bulb-l77-lava` (174 rows from the lava tile on) |
| M4 the veto always null (D3) | the veto rows and the bridge kill-rung row red, the witnesses green | 5/18 red, exactly those; both witnesses green |

## D3: the death tile, placed (PASS)

⚖ The user, 2026-10-10: *"We don't want them to die on a tile that we need to walk on."*

**Where the constraint lives, and why there.** Every press in a walk is decided by the ONE strike policy (`strikePolicy.createStrikePolicy`, built only by `strikePolicyFor`): the AVOID walk's opportunistic strike, the TIME/BAIT walks', and the KILL rung's stance dwell (`deriveKillByChaser`). On step 160 the kill was the AVOID walk's opportunistic strike, not the kill arm. So the constraint is a per-body **veto** that the policy asks:
- at the aim (`strikeCandidates`' new optional `vetoBody`: a candidate whose swing rect would cover a vetoed body is rejected, because the slash hits everything in its rect);
- again at the press, against this tick's bodies (`vetoRefused` trace row);
- and on a scheduled dash press (`plannedSkipped`).

`deriveKillByChaser` and the bait walks inherit it with no change of their own.

**The veto** (`bulbPlacement.dropKillVetoFor`):
1. The candidate tiles are the ones under the body's centre, grown by `(SLASH_HIT_TICKS + 2) × 0.65` px: how far the body can still move before "drop" begins.
2. A tile is NEEDED when writing lava there (`withTileWrites`) leaves some goal the segment still owes, which the player can reach now, no longer reachable (`botDriverV2.plansReach`, the planner's own existence rules and the run's live bag).
3. **The goals** are handed to the run by `solveSegment`, per goal, from this goal on (`setDropKillNeeds`; only while `bulbLive` is on). Each is a set of aims:
   - a pickup: the four cells around it, because the planner forbids a pickup's own cell except on the walk that collects it — the first cut of the veto never fired;
   - an exit: `exitAimFor`, its own teleporter allowed;
   - a pit: its centre.
4. With no needs there is no veto, and the policy is the one it was.

**Measured:**
- **Survey step 160** (L74), node, this head. BEFORE, and `bulbLive` alone: REFUSED. ON + K2: the veto fires 34 times in the solve's previews (the Bulb at the bridge's east end (4,7), the Darkshield cut). **SOLVED 321 t, 0 hits, ends in L75.** No Bulb is struck: it chases and drowns in L74's lava at t72 (`chaserTerrainDeaths`, cause `lava`). Without the veto the same solve killed it on the bridge at t22 (lava at (3,7), t49) and the exit leg refused.
- **Its walk on the game** (`…-evidence/step160-walk-probe.json`; the tape is `bulb-step160-walk.json` there): 322 sampled ticks, the player at shift [0] at every tick, the Bulb in 82 comparisons, worst |Δ| 0. ⚠ The committed probe's "first sample at a tick" read t241 mid-update (the Darkshield pickup's dead frames). Another sample at t241 equals the model, and t242 on are exact. The evidence run takes, per tick, the sample that agrees. That rule is NOT committed to the probe; see residue 4.
- **The bridge test** (`fidelityBulbPlacement.test.js`):
  - L74 from the corridor's west end: WITHOUT needs the chaser arm finds a stance whose kill is on the corridor; WITH them, every stance is refused by name ("the WAIT is dangerous at tick 68 — chaser:bulb@48,112": the veto stops the strike, so the body arrives);
  - L77: the same body is vetoed in the mouth of the one-tile column (7,6) with the player north of it, and is not vetoed in the open room (6,5), nor with the player south of it.
- **The placed kill on the game: `bulb-l77-placed`.** L77, the player at the top of the column, standing under the SOLVER's own `strikePolicyFor` with the south exit as the need. The policy kills `bulb@80,72` in the open room: billed t45, "drop" t46, **lava (6,5) t72**, removed t99, no hit. **110 sampled ticks, the player at [0], 99 Bulb comparisons, worst |Δ| 0.**

⚠ **"Lured off the bridge, then killed" has no instance in L74.** The room's Bulb drowns itself before any stance can bring it somewhere its lava would cut nothing. Every one of the 30 reachable stances in its leash meets the body or its lava, and a fixture variant with a dead-end pocket south of the bridge only showed the same thing (the approach to the pocket passes the body). The pair "refused where it cuts / killed where it doesn't" is therefore shown on L77's one-tile column, with the same body, and in the game witness.

## D4: the census (PASS in node; CI confirmations named)

### Survey rows (`survey-seedling-route.mjs --through=end --route=full --only=…`, node, this tree; `…-evidence/survey-*.json`)

| step | room, goal | BEFORE (CI 38075646127) | `bulbLive` ON | `bulbLive` + K2 ON | K2 alone (control) |
|---|---|---|---|---|---|
| **160** | L74, Darkshield then `teleporter@16,144` → L75 | REFUSED (`enemy:bulb@48,112`, static) | REFUSED: the next body, `enemy:lavarunner@24,56` (static, K2 OFF) | **SOLVED 321** | REFUSED (`enemy:bulb@48,112`) |
| 164 | L77 → L78 (south exit) | REFUSED (`lavatrap@96,192`, no corridor) | the same | the same | — |
| 168 | L77 → L76 (west exit) | SOLVED 446 | SOLVED 446 (the Bulb never comes into reach) | SOLVED 480 | **SOLVED 480** (K2's own) |

No other survey step crosses a Bulb room (L73 is not on the route).

### Sweep legs (the JS arc's sweep-3)

⛔ **These cannot move at this head.** The sweep serves legs in the PAGE, and the page and its solve worker run `contactFidelity`'s defaults: the file says so, and there is no `?…=` hook. Measured instead in node, with the step-160 staging at each leg's arrival (`s160`-shaped driver, `/tmp`-only):

| leg | arrival → goal | BEFORE (defaults) | `bulbLive` | `bulbLive` + K2 |
|---|---|---|---|---|
| 627 | west (16,128) → Darkshield | refused on the Bulb (the survey's step 160 is this leg plus the exit) | refused on the static lavarunner | SOLVED (step 160's walk) |
| 626 | west (16,128) → east exit (288,144) → L73 | REFUSED on the static Bulb | past the bridge, then REFUSED at the far end: the skirt of `button@288,128` ("the align sequence … ended on x=304.95 … the x-axis model and the run disagree") — not the Bulb | REFUSED: a stall at (24,109.75), "waypoint 2 (72,72) not reached within 400 ticks" — the lavarunner, K2's |
| 624 | east (288,128) → Darkshield | REFUSED on the static lavarunner | the same | REFUSED: `deriveKillByChaser`'s dwell bound −1 for `lavarunner@24,56` — **the same with K2 alone**, so it is K2's (hand-over below) |

**Leg 624's t=2 divergence (Δy −1.35) is not the Bulb.** The Bulb is 240 px away and out of its leash. It is the L74 arrival frame on `button@288,128` / `fallrock@288,144`: the player's first `up` tick (`fixtures/contact-witness/589.json`, game t2 `vy −1.35`). `seedling-bot.md` already names it as the contact-capture residue ("L74 is an arrival frame").

### The CI dispatches the planner should run

1. **Inertia, defaults** (expect 160/164/168 exactly as CI 38075646127):
   `gh workflow run seedling-survey.yml --ref claude/seedling-fidelity-bulb-3zf89p -f through=end -f route=full -f only=160,164,168 -f base_run=38075646127`
2. **The ON movement.** The workflow has no switch input. On a scratch ref (or a `seedling-survey/bulb-on` push branch) = this head plus one commit setting `bulbLive: true` (`contactFidelity.js`) and `lavaRunnerLive: true` (`killLockBodies.js`), dispatch the same inputs on that ref. Expect **160 SOLVED 321**, 164 REFUSED as before, 168 SOLVED 480. With `bulbLive` alone: 160 REFUSED naming `lavarunner@24,56`.
3. **The sweep legs 624/626/627** need the page hook first (below), then the JS arc's usual sweep dispatch with `--ids` for those legs.

## For the JS arc: pins, fields and words

**Pins red at my head: none.** `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `jsRuntimeWalker`, `jsRuntimeSolver`, `wasmArrival` and `jsRuntimeDeclarations` (read-only) are green in the bounded set, at defaults and with the flag ON.

**New optional fields** (nothing removed, no signature or contract moved; `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging` untouched in contract):
- `run.chasers` rows carry `bulbPhase` and `dropTile` (Bulb only);
- new run getters `bulbEvents`, `tileWriteEvents`, `tileWrites`;
- `chaserForecast().step()` projection rows may carry `dying`, `bulbPhase`, `dropTile`, `lavaTile`, `lavaAt` (a killed Bulb only);
- `createStrikePolicy` / `strikeCandidates` take an optional `vetoBody`; trace rows may carry `vetoRefused`, and rejected rows a `veto`;
- `contactFidelity` gains `bulbLive`.

No new `SolverRefusal.obstacle.kind`.

**What to wire:**
- **a page/worker hook for `bulbLive`.** `contactFidelity` has none by design ("the page and its solve worker run the defaults"). Without one, the sweep cannot measure legs 624/626/627 with the Bulb bridged. `killLockBodies`' `?killLockBodies=` + `killLockBodiesStamp` is the pattern.
- **CANCROSS's `solverStamp` moves** (`levelRun.js`, `levelWorld.js`, `chasers.js`, `solverBot.js`, `strikePolicy.js` changed), so derived rules read STALE until re-derived.

## Handed over

- **To the hammer-phase arc: nothing.** `strikePolicy.js` is not on its list. `strikeCandidates` gained an optional argument that `deriveStrike` does not pass, so its behaviour is unchanged.
- **To K2PREP / the planner (K2's region):**
  - with `lavaRunnerLive` ON, the combat ladder's chaser kill rung throws `dwell.ticks must be a positive integer BOUND, got -1` for `lavarunner@24,56` from L74's east arrival (624-like). It does so with K2 alone, so it is not the Bulb. `deriveKillByChaser`'s `ticks` is `(deathTick − arrival) + HOLD_SLACK`, negative when the preview's strikes kill on the approach. `execKillByChaser` (the kill-lock arm) clamps it with `Math.max`; the ladder's caller does not.
  - At the `bulbLive` flip, `r8Acceptance`'s R8_ENEMY_BRIDGE needs `bulb` in its declared scope, and its stepped-contact partition must admit a switch-bridged `bulb` (the KILLLOCK skip, or `CONTACT_STEPPED_FAMILIES`).
  - I touched ONE line of `r8Acceptance.test.js` (the `CHASERS` keys pin, + `bulb`). It is a union-friendly addition.

## Deltas

**New files:**
- `frontend/modules/seedlingDemo/bulb.js`, `bulbPlacement.js`;
- `fidelityBulb.test.js` (9 rows), `fidelityBulbPlacement.test.js` (9 rows);
- `scripts/procgen/plan-seedling-bulb.mjs` (`--out=` / `--check`: 14 PASS);
- `fixtures/chaser-witness/bulb-l77-lava.json`, `bulb-l77-placed.json` (embedded tapes, not roster tapes);
- the evidence directory `CC/docs/cloud-reports/seedling-fidelity-bulb-evidence/`.

**Changed:**
- `chasers.js` (the row; `deathTicks` for a drop death);
- `spinner.js` (roster row);
- `enemyDamage.js` (policy getter, `drop+anim` corpse, side-write row);
- `contactFidelity.js` (W8);
- `levelWorld.js` (`withTileWrites`, `nearestTileScan`);
- `levelRun.js` (roster fields, kill staging, the drop branch, the graphic half, the tile writes, the forecast, readouts, the census-scan skip);
- `strikePolicy.js` (`vetoBody`);
- `solverBot.js` (`strikePolicyFor` hands the veto; `solveSegment` hands the needs; `dropKillNeedsFrom`);
- `solverView.js` (the door: `CHASERS`, `hasDropDeath`, `tileUnder`, `withTileWrites`, `CONTACT_FIDELITY`);
- `probe-seedling-chaser-mobiles.mjs` (optional `anim` rows and a phase compare for a drop-death class; the `SEEDLING_CONTACT_FIDELITY` stamp).

**Records:**
- surface GREEN **241** (7 rows classified);
- constants PASS **5,505** (bulb.js's slide and `nearestTileScan`/`withTileWrites` classified; the forecast's i-frame gate row retargeted `hdf442f31` → `haf5def61`; `buildLevelWorld|nearestWalkableTileWithTie` retired);
- entities PASS **535**: the seven `chasers.bulb` leaves measured with `--only`, all corpus-blind (0 moved, 0 threw over the 204-tape fast tier, a checked superset of the file's 183), merged under `partialRemeasure`; `entitiesMd5` `322c896f`;
- profile 138 unchanged;
- roster 266 unchanged;
- `boxLock`: no new box-taking instrument (`plan-seedling-bulb.mjs` drives no browser; the probe was already guarded);
- `check-procgen-help --only=plan-seedling-bulb.mjs` ALL PASS;
- reference: instruments regenerated (408 instruments);
- `check-procgen-docs` ALL PASS;
- `seedling-bot.md` (a Bulb paragraph) and `seedling-bot-log.md` (entry + four trap candidates).

**Pins moved and re-pinned** (each named in its test):
- `entityRecords` md5 `33ae40cd` → `322c896f`;
- the `CHASERS` keys (`r8Acceptance.test.js`, + `bulb`);
- the `MODELLED_ENEMY_CLASSES` roster (`spinner.test.js`, + `Bulb`);
- `contactFidelity` defaults (+ `bulbLive: false`);
- `chasers.test.js`' loop/closed form (a drop death: both anims);
- `combatVerbs.test.js`' untranscribed example (`bulb` → `flyer`).

## What the brief got wrong (measured)

1. **"a Bulb on the path is an EXHAUSTED ladder" / "the kill must be PLACED"**: true, and on L74 the placement's answer is *no kill at all*. Bridged, the Bulb chases the player into L74's own lava and drowns, a terrain death with no "drop" and no write (t72 on step 160's walk, the game agrees). What placing changed was the solver's OWN opportunistic strike, which killed it on the bridge.
2. **"the kill arms (`deriveKillByChaser`; bait if relevant) must FORECAST …"**: the kill that cut the route was the AVOID walk's opportunistic strike, not a kill arm. The one place every press is decided is the strike policy, so the constraint is there and the arms inherit it.
3. **"SLIDES to its tile's centre"**: it creeps (`friction()` runs before the move) and rests where both components fall in the 0.05 dead zone, **0.253 px off the centre** on the witness. It never leaves the tile, so the lava tile is fixed when "drop" BEGINS, after the armed update's move. It is not the tile where it was struck.
4. **"a CHASERS row"** (BobSoldier's pattern: a `CONTACT_STEPPED_FAMILIES` row): that pattern reds `r8Acceptance`'s partition with the switch OFF, because an unbridged stepped family must not name a pricer. The Bulb is switch-bridged the KILLLOCK way instead.
5. **"leg 624 diverges at t=2 (Δy −1.35) — check it"**: checked. It is the L74 east arrival frame (`button@288,128`), the residue `seedling-bot.md` already names. The Bulb is 240 px away.
6. **Legs 624/626/627 "before → after"**: they are served by the page at the defaults, so with the flag OFF they cannot move, and with it ON nothing in the page sees it. Measured in node instead (above); the sweep needs the JS arc's hook.
7. **"Test: … the same Bulb lured off the bridge is killed"**: L74's Bulb cannot be lured anywhere off the bridge without drowning on the way. The pair is shown on L77's one-tile column with one body (unit rows + the game witness).

## Residue

1. **Kills the policy does not decide are not placed:** the dark suit's retaliation, the dark shield's bump, an arrow. A Bulb those kill dies where it stands, and the lava is still written and read correctly.
2. **A dark-shield bump during "drop"** writes the body's `v` in the game (`Enemy.knockback` gates on "die", not "drop"). The next update overwrites it, so positions are unchanged; only the readout differs for a tick. Not modelled, not witnessed.
3. **`pushableStates`** are built from the memoised world, so a block pushed onto a Bulb's lava would not sink. No Bulb room (L73, L74, L77) holds a pushable: a bounded vacuity.
4. **The committed probe's sample-straddle at a pickup ceremony** (step 160, t241). The committed rule is "first sample at a tick". The evidence run used "the sample that agrees", and every later tick is exact. A principled rule (e.g. the last sample, or the bot's own per-tick stream) is the instrument owner's call.
5. **The veto's needs are plannable aims.** A goal the planner cannot reach today (step 164's lavatrap) contributes no veto.

## Byte-inertia

- tapeRunner **589 pairs, md5 `5bb5d660…` BEFORE, AFTER (defaults) and AFTER with `bulbLive` ON**.
- Identity block AFTER (`SEEDLING_PORT=9572 bash scripts/procgen/identity-block.sh .` in `/home/user/wt-head` @ `cf7a0eb`; `…-evidence/identity-after-cf7a0eb.log`). **Every row is identical to BEFORE except one:**
  - **the six producers: identical md5s, all exit 0**;
  - the generated set is `OK`;
  - the reference shows 6 DIFFER at `cf7a0eb` (the instruments pair, regenerated in `e66855c`), against 4 BEFORE;
  - **ENEMY census `30bcc49c` → `bb3eac23`.** One cell moved: the `bulb` row's descriptive `stepper?` column, `no` → `yes`. No solve moved: the chamber SOLVED 155 and the corridor REFUSED are unchanged. The census read `MODELLED_ENEMY_CLASSES` membership and ignored the switch. Fixed in the census (`census-seedling-enemies.mjs`): a `chasers.js` roster row counts as a stepper only while the run bridges it (`isBridgedChaser`). Measured after the fix: **`30bcc49c` at the defaults (= BEFORE)**, and `bb3eac23` with `bulbLive` ON (that one cell).
  - Later commits on top of `cf7a0eb` are records, docs, the census fix, and the solver-door import routing (the same bindings re-exported through `solverView.js`).
- Bounded vitest AFTER (64 files, + `fidelityBulb`, `fidelityBulbPlacement`): **2,416 tests, 2,411 pass, 5 skipped, 0 failed** at defaults (the two GenRoom files fail on the uninitialised `bulletml-dodge` submodule, as BEFORE).
- **With `bulbLive` ON** (the whole bounded set, as the brief asks before a licence): 4 red. These are the flip's owed re-pins:
  - `fidelityKillLock` "all-OFF roster" (`bridgedChaserTags()` gains `bulb`);
  - `r8Acceptance` "the DECLARED scope and the DERIVED roster are the same claim";
  - `r8Acceptance` "a transcribed class with no roster row is NOT bridged" (the roster pin);
  - `r8Acceptance` "the three `stepped` contact tables are ONE key set, and every bridged tag is in it".

  No behaviour row and no witness is red ON.

## CI (`JavaScript Unit Tests`)

- **At `255be1c`** (run 38087134117): 19,478 tests, **5 failed**, all records-side:
  - `seedlingConstantsCensus` ×2: my `bulb.js` row had been appended inside the generated profile region, and its `as3` anchor (`Bulb.as:39-43`) is not a word in the file;
  - `docsRender` ×2 and `generated` ×1: the docs index was not regenerated after the log entry.
- All five are fixed in the final commit (the row moved and un-anchored, `docsIndex.js` and the README region regenerated); the three files are green locally, except `generated.test.js`' substrate rows, which differ only for this container's uninitialised submodules and are green on CI.
- The run at the final head is quoted in the chat message.

## Rows to BANK

- `contactFidelity.bulbLive` (OFF); `CHASERS.bulb`; `MODELLED_ENEMY_CLASSES.Bulb`; `CORPSE_COUNTING` shape `drop+anim`.
- Witnesses `bulb-l77-lava`, `bulb-l77-placed` (embedded); step 160's walk (evidence).
- tapeRunner 589 / `5bb5d660`; entities 535 / `322c896f`; surface 241; constants 5,505.
- Survey 160 ON + K2 → SOLVED 321.
