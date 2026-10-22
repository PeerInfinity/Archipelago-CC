# Seedling fidelity BOSSKILLS — the King of Fire and the Tentacled Beast, modelled and fought

Session `seedling-fidelity-bosskills` (cloud), planner `seedling-fidelity-planning-9`, wave 20.

| | |
|---|---|
| Start SHA | `934f99422b` (not rebased) |
| Head | the commit that adds this report (docs only), on ``8aa85f68` (CI 39522820314 green)` |
| Harness branch | `claude/tentacle-beast-king-fire-sdji9j` |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (STOP for the flip: the escape digest, named below) · D3 PASS · D4 PASS (no mover OFF; ON moves only the two boss rows)** |

## The one thing to know first

**Both fights now run in the model, tick for tick with the game, and the solver wins both. Both switches ship OFF.**
`CONTACT_FIDELITY.kingOfFireFight` (L82) and `CONTACT_FIDELITY.tentacleBeastFight` (L57) are byte-inert OFF. ON, route
survey steps 203 and 224 SOLVE L82 (1363 t, {82,1} and {82,0} earned, exit to L96). The Tentacled Beast's placements
are gameplay `Math.random()` draws, and the model steps them on the runtime LFSR. Nine game witnesses hold at 0 px,
including the generator's state on every L57 tick. The solver opens the mouth and walks into L58 under any declared seed
with `split: true`.

Two things block a flip, and neither is in my region:
1. **`stateDigestParts` does not cover the King of Fire's body or the L82 arena rock** (`lavaBossFights`,
   `lavaArenaRocks`). The escape's reach reads both through `liveSolidOpts.lavaBosses` / `fallenRocksNow`. Under the
   brief's rule that is a STOP for flipping `kingOfFireFight` until the hammer arc's digest covers them. I found it at
   the end of the session, after D2 was committed: the D2 model and solver stand, the flip does not.
2. **The route survey stages L57 unsplit** (`r8-solve-11`'s block, `rng.split: false`), so step 125 ON refuses by name on
   the stream's premise. The campaign segments already declare `split: true` (⚖ 68). A window that boots at the L57
   arrival with its latched seed satisfies the premise, and that wiring belongs to the JS arc / staging.

## W0 — the base (PASS)

| row | result |
|---|---|
| identity block (`SEEDLING_PORT=9702 bash scripts/procgen/identity-block.sh .`) | log md5 `91cac85c`; every row = bank except **`solve-seedling-r9-campaign --check` exit 1 AT THE BASE** (r9-solve-32's trace drifts) and the reference row's environmental DIFFERs |
| surface / constants / entities / profile | GREEN 321 · PASS 6,102 · PASS 566 · PASS 138 (both) |
| roster | 289 (`index.json` md5 `2c68bd81…`) |
| tapeRunner pairs | 635, `e164838673a48b38ce187093c363edb2`, 0 non-pass |
| bounded vitest (76 files, `w0/vitest-files.txt`) | 2,096 / 2,097: the one red is `boxLock.test` naming this session's new probe before it was registered (fixed in D1) |
| slow `fidelityL32ArenaPrefix` | 5 / 5 |

Evidence: `seedling-fidelity-bosskills-evidence/w0/`.

## D1 — both fights on the game (PASS)

Instrument: `scripts/procgen/probe-seedling-bosskills.mjs`. It plays one tape on a fresh p4g page (headless,
logic-only channel, box lock), keeps the last poll per tick, and drops the tape's final tick. For L57 samples it also
records the tentacle rows `[x, y, anim, index, alpha]` and the generator's state (`--record --name --dir`, `--witness`).

**The King of Fire (L82; `Enemies/LavaBoss.as` @ccdf189776).**
- **Arrivals.** The body stands at the ctor point (x+48, y+40) = (160, 88). `playerPosition` (152,176) is the
  **respawn** the ctor writes (`:57-60`), not every arrival: a pit arrival lands where it falls.
- **The cycle.** 99 updates, measured: sit 19 (20 on the wake), smash 16, smashback 16, armsup 22, sweep 10, sweepback
  16. Two LavaRunners spawn at the end of the smash (±34, +32), and the five-ball fan (speed 1, from y+32) leaves at the
  end of the sweep with `Game.shake = 15` (`:246`).
- **The reflect window.** A sword reverses a ball at ×2 (`LavaBall.hit`). That ball opens a 120-update window on the body
  ("hit", no count, no attack). The first non-ball hit inside it counts and re-arms 120 ("hitplayer"). Three counts is
  `startDeath`: the report {82,0} at once, then "die" (43), then the fade (`alpha -= 0.01`; the setter clamps at 0) and
  the removal.
- **Runners.** Airborne they are not collidable but are still reached by `collideRectInto` / `collideRect` (inclusive,
  `collidable` ignored). When the suit kills one on lava, it lives on (`swim()` replays over `die`).
- **Death.** An idle player dies to the runners (three deaths in 900 t) and respawns at (152,176).
- **L82's arena rock** (`Game.as` `bossrock`): its arm frame, 180 dead frames (`Player.update` ages `slashTimer` and the
  i-frames through them), then the release frame.
- **Revisit with {82,0} cleared:** no body; the walk reaches L96 at t365 (game = model, `d1/revisit-82.*`).

**The Tentacled Beast (L57; `Enemies/TentacleBeast.as`, `Enemies/Tentacle.as`, `Puzzlements/Whirlpool.as`).**
- **Wake.** Within 48 px, unless falling from the ceiling. "rise" is 46 updates with `Game.shake = 5` on each
  (`:89-92`); spawning starts when the anim clears.
- **Placements.** Three runs at `rng.seed` 1 place every tentacle identically; seeds 2 and 3 differ. The generator's
  state shows the build's one draw (the ctor's `coins`), then 5 draws on the first spawn (whirlpool x, y; tentacle x, y;
  coins), 3 per later spawn, and 2 per rejected try. `rng.js` reproduces the first tentacles (104,138) / (61,142) /
  (176,131). **The brief's premise *"fighting tentacles on a fixed tape is not possible"* is refuted**: with a declared
  seed and `split: true` the fight is reproducible.
- **Sit / hit windows.** Each tentacle lives rise 16, sit 37 (the only hittable span: `canHit = currentAnim == "sit"`),
  hit 16, hitting 4 (the swipe, a 66x8 rect on its facing side, force 2, damage 1), then sink 13. One sword hit
  kills; its cut fades over 100 updates, and only then does `maxTentacles` fall and `maxWhirlpools` rise.
- **Facing.** `xpos < FP.width / 2` with the LEVEL's width (`Game.as:2065`). Seed 3's tentacle at x 81 swipes right on
  the game.
- **Whirlpools.** A `Whirlpool` is an `Entity`, not a `Mobile`, so `botMobiles` never lists one. The generator's state is
  the witness of its draws. The loop's `cont` is never reset, so one rejected try burns the rest of the 101 tries.
- **Death.** Seeds 2 and 3 die idle; the room rebuilds and the generator runs on (no re-seed).
- **Mouth teleporter.** At the end of "dying" (61) a Teleporter appears at (x−8, y−8) = (96,64), to
  `tentacle_beast_mouth` (L58 at 56,96). The dead body stays a `pixelmask` Solid.
- **Revisit with {57,0} cleared:** built dead with the mouth standing; into L58 at t162 (game = model, `d1/revisit-57.*`).

Evidence: `d1/` (tapes + gz outputs), `tools/` (scratch batch runner and comparators).

## D2 — the King of Fire, model + solver (PASS; STOP for the flip)

**Change.** `lavaBoss.js` (new) transcribes the body (cycle, gate, death, fade), `LavaBall` (fan, reflection, the
Explosion at `updateLists`), the runner's jump and the arena rock. `levelRun` steps them in the game's frame order behind
the switch, in its own functions: `stepLavaBossNow`, `stepLavaBallsNow`, `lavaBossSlashNow`, `drainLavaBossNow`,
`renderLavaBossNow` and `stepLavaArenaRockNow`. The runners are bridged chasers (instance `runRange` 1000,
`activeOffScreen`, airborne free mover). A death respawns at (152,176), and the room is rebuilt with the rock fallen.
- **The damage gate, including `hitByDarkStuff`:** `lavaBossHit` is the gate verbatim. `hitByDarkStuff` is unreachable:
  nothing in the game delivers a "Shield" or "Suit" hit to a LavaBoss, so those types throw by name rather than being
  modelled as reachable.
- **The `levelRun.js:2474` wand throw is fixed.** A WandShot flies through the body (its own solids list), so the
  assertion skips a LavaBoss while a fight is stepped, and `stepWandShotsNow` passes the fight's body as removed.
- **Solver.** `OBSTACLE_STRATEGIES['solid:lavaboss'] = 'lavaboss'` and `STRATEGY_EXECUTORS.lavaboss = execLavaBoss`
  (route 2, Shieldspire's pattern). `lavaBossPolicy.js` reflects the middle ball, strikes in the window and kills runners.
  Its variants are played on `ctx.fork`, and the first that kills without a death is committed. The resolver refuses by
  name when the switch is off, the bag lacks the sword or the Dark Suit, or the body is gone.

**Witnesses** (`fixtures/lavaboss-witness/`, p4g, 0 px on every tick for the player, the body's anim / index / hits /
i-frames / alpha, every ball and every runner):

| witness | ticks | what it pins |
|---|---|---|
| kof-idle | 900 | the cycle, three deaths, the respawn |
| kof-reflect | 260 | a reflection and the window |
| kof-policy-kill | 897 | {82,0} at t724, removal at t867 |
| kof-death-respawn | 1264 | a death, the respawn, a second fight, an airborne kill, the undead runner |
| kof-solve-203 | 1363 | the solver's own step-203 walk: the kill, the rock, the exit to L96 |

`fidelityKingOfFire.test.js`: 19 tests. Mutants (predicted first, copy + restore): **M1** the gate counts outside the
window → killed. **M2** an airborne runner out of the swing → killed (kof-death-respawn t916). **M3** the rock's dead
frames age nothing → killed. **M4** the Explosion drain does not re-read `next` → killed (kof-solve-203 t150). **M5** no
undead on lava → killed (kof-death-respawn t913).

**Survey** (local, `survey-seedling-route.mjs --through=end --route=full`):

| step (L82) | base / OFF | ON |
|---|---|---|
| 203 | REFUSED "No strategy row" → now refuses naming the switch | **SOLVED 1363 t** (hits 2, deaths 0, {82,1} + {82,0}, end L96) |
| 224 | REFUSED (goal `skip`) → goal `clear-tag`, refuses naming the switch | **SOLVED 1363 t** |
| 202 / 204 / 223 / 225 | SOLVED | unchanged |

**⛔ STOP for the flip (the brief's digest rule).** The body and the rock are run state the escape reads.
`stateDigestParts` (`levelRun.js`, not my region) does not list `lavaBossFights` or `lavaArenaRocks`. Hand-over to the
hammer-phase arc: add both to the `visit` part before `kingOfFireFight` is turned on anywhere `ESCAPE_CROSS_PASS_CACHE`
runs.

## D3 — the Tentacled Beast, model + solver (PASS)

**The RNG decision.** The draws are modelled, not avoided (⚖ *"model the game"*). `TentacleDrawStream` is `SeedlingRng`
on the window's declared seed, with the build's one draw taken at construction and each spawn's draws in AS3 order (the
`Owl` precedent, `finalBossRng.js`). The stream's premises are refused by name (`tentacleStreamRefusal`): a declared
seed, `split: true` (unsplit, the build's `Rng.cos()` per Tile and every sound pick land on the gameplay stream), and
this room the only one built since the reseed. A death's rebuild carries the stream on and pays the ctor's `coins` draw
again. The cosmetic RNG is not modelled (⚖).

**Change.** `tentacleBeast.js` (new) holds the beast, tentacle and whirlpool transcriptions. `levelRun` steps them behind
the switch in its own functions: `tentacleFightFor`, `stepTentacleRuntimeNow`, `stepTentacleBeastNow`,
`tentacleSlashNow`, `drainTentacleBeastNow` and `bankTentacleReport`. The view adds `streamRefusal`. The mouth is a
runtime teleporter in the run's world (`levelWorld.withRuntimeTeleporters`). Rows added: `camera.SHAKE_WRITERS.tentacleRise` and
`solverView` exports `tentacleRect` / `tentacleSwipeRect`. `seamPosture.js:47-48`'s row now says the draws are modelled
behind the switch (only its keys are read). Solver: `'solid:tentaclebeast' → 'tentaclebeast'`
(`resolveTentacleBeastStrategy`, `execTentacleBeast`, `tentacleBeastPolicy.js`: wake it, strike each sitting tentacle
from a spot outside every swipe band about to fire, keep clear of whirlpools). Because the beast lives in
`world.pixelmasks`, the clear-tag executor binds a `tentaclebeast@` goal there; no other class takes that branch.

**Witnesses** (`fixtures/tentaclebeast-witness/`, p4g; 0 px on every tick for the player, the level, the hits, the
beast's anim, every tentacle's x / y / anim / frame / alpha, **and the generator's state**):

| witness | ticks | what it pins |
|---|---|---|
| tb-idle-s1 | 600 | seed 1: wake, spawns, whirlpool draws, a swipe hit |
| tb-death-s3 | 600 | seed 3: the right-facing swipe at x 81, the death, the rebuild, the stream running on |
| tb-policy-s2 | 908 | seed 2: the policy's eight kills, one swipe taken, "dying", the mouth |
| tb-solve-s2 | 1047 | `solveSegment` clear-tag {57,0} (earned t787) + reach-exit (96,64): the walk into L58 |

The model also equals the five D1 idle runs (seeds 1×3, 2, 3) and two more policy runs (seed 3; seed 1 through the mouth,
2766 t) at 0 px. `fidelityTentacleBeast.test.js`: 17 tests. Mutants: **T1** facing from the 160-wide screen → killed
(tb-death-s3, plus the solver row's tick count, which the prediction did not name). **T2** a rebuild re-seeds → killed
(tb-death-s3). **T3** the cut's wrap restarts the anim → killed (tb-policy-s2, tb-solve-s2). **T4** the whirlpool loop's
`cont` reset per try → killed (all four witnesses and the solver row).

**Solver beyond the witnesses** (node, ON, boot L57 split): seed 1 SOLVED 2765 t, seed 3 1512 t, seed 418414780
(the survey staging's seed) 2060 t, all with 0 deaths and ending in L58. OFF → `cannot-act` naming the switch;
unsplit → `cannot-act` naming `split: true`.

## D4 — movers (PASS)

**Survey, ON vs OFF per switch** (local; `--only=` the steps; rows in `survey/d4-*.json`):

| steps | OFF | `tentacleBeastFight` ON | `kingOfFireFight` ON |
|---|---|---|---|
| 93, 124 (L56) | SOLVED 262 | = | = |
| 94 (L57, visit 1) | NO-EDGE (atlas has no `out_tentaclebeast_80_48`) | = | = |
| 125 (L57, visit 2) | base: goal `skip` ("no strategy row") → now `clear-tag`, `cannot-act` naming the switch | `cannot-act`: the stream needs `split: true` (staging) | = OFF |
| 95, 126 (L58) | NO-ARRIVAL (same atlas gap) | = | = |
| 190, 221 (L71) | REFUSED (placed `lavarunner@64,224` press) | = (byte-identical) | = (byte-identical) |
| 194, 202, 223 (L71) | SOLVED 327 / 193 / 171 | = | = |
| 202–204, 223–225 (L71/L82/L96) | 203/224 REFUSED (switch) | = OFF, field for field | 203/224 **SOLVED 1363** |

**Keyed sweep legs** (local `probe-seedling-divergence-sweep.mjs --mode=inv --capture-requests=true`, OFF = defaults,
ON = the 36 default-ON keys + both switches):

| leg | key | OFF | ON |
|---|---|---|---|
| 505 / 507 | L57 → `exit:out_tentaclebeast_80_48` (from the L56 pit / from L58) | failed: *"no live teleporter resolved for the exit"* | = (the page's exit resolution reads the atlas, which has no mouth edge) |
| 506 / 508 | L57 → location *Tentacled Beast* | unresolved: the harness's vanilla arm does not bind the boss-kill location | = |
| **664** | L82 ← L71 pit → `exit:out_teleporter_144_0` | failed: refused, naming `kingOfFireFight` | **done**: the page's own solver plans `lavaboss` + `walk` (1079 t, both passes ok), the game plays it, **0 divergences, 0 hits**, ends in L96 |
| **666** | L82 ← L96 → `exit:out_teleporter_144_0` | failed: *"the model refused to build level 82 … it BUILDS IT FALLEN"* (the arena rock's cleared tag) | **done**: `walk` 289 t, 0 divergences, 0 hits, L96 (ON builds the rock fallen, `lavaArenaRockOf`) |
| 665 / 667 | L82 → location *King of Fire* | unresolved (vanilla arm, as 506) | = |

**Movers: exactly 664 and 666, both ON and both toward the game.** 664 is the King of Fire's solve witnessed on the real
wasm page under the JS runtime's own solver: the brief's *"game witness of the solve"*, from a second producer. The
beast's legs cannot move until the page resolves the mouth exit, and the harness's `rngSplitAtArrival.echo` is false on
every leg, so the beast's verb would refuse on its stream premise there too (hand-over, JS arc). Evidence:
`d4/sweep-legs8-{off,on}.*`.

### The CI dispatches the planner should run

I cannot dispatch (403). These are the exact dispatches:

1. **Keyed sweep A/B** — `seedling-divergence-sweep.yml` on `claude/tentacle-beast-king-fire-sdji9j`, `mode=inv
   producer=solver capture_requests=true`, `keys=level_57 <- in_pit_L56_6_10 -> exit:out_tentaclebeast_80_48|level_57 <- in_pit_L56_6_10 -> location:Level 057 - Tentacled Beast|level_57 <- in_L58_48_112 -> exit:out_tentaclebeast_80_48|level_57 <- in_L58_48_112 -> location:Level 057 - Tentacled Beast|level_82 <- in_pit_L71_10_17 -> exit:out_teleporter_144_0|level_82 <- in_pit_L71_10_17 -> location:Level 082 - King of Fire|level_82 <- in_L96_32_64 -> exit:out_teleporter_144_0|level_82 <- in_L96_32_64 -> location:Level 082 - King of Fire`, run twice:
   - A: `contact_fidelity=` empty (the defaults);
   - B: `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,apReportBosses,guardApproachStance,coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight,kingOfFireFight,tentacleBeastFight`.
   Expected: as the local table above.
2. **Survey OFF** — `seedling-survey.yml` on this branch, `through=end route=full` (or `only=93,94,95,124,125,126,190,194,202,203,204,221,223,224,225 route=full through=end base_run=<main's latest>`). Expected: every verdict = main's. Steps 203 / 224 / 125 change only their refusal text (they now name the switch).
3. **Survey ON** — the workflow has no `contact_fidelity` input, so ON needs a flip branch (one line per switch in
   `contactFidelity.js`). Expected for `kingOfFireFight`: 203 / 224 SOLVED 1363. Expected for `tentacleBeastFight`: 125
   refuses on `split: true` until staging changes.

## The JS arc's wiring (pins + what it must wire)

- **Switches:** `CONTACT_FIDELITY.kingOfFireFight` and `.tentacleBeastFight` (both OFF), env
  `SEEDLING_KING_OF_FIRE_FIGHT=1` / `SEEDLING_TENTACLE_BEAST_FIGHT=1`; the settings / `?contactFidelity=` keys are derived.
- **Families:** `run.entities('lavaBossFight')`, `run.entities('tentacleBeastFight')` (with `streamRefusal`); ledgers
  `lavaBossEvents` / `tentacleBeastEvents`.
- **What it must wire for the beast:** the window that fights L57 must be staged `rng: {seed, split: true}`, booting in
  L57 (the campaign's latched seed is fine). The survey's `r8-solve-11` block is `split: false`. No new
  `SolverRefusal.obstacle.kind`: refusals are `solid` / `clear-tag` with tag `lavaboss` / `tentaclebeast`.
- **No contract or signature changed** (`solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`).
- No JS-arc pin moves OFF.

## Handed over

- **Hammer-phase arc:** `stateDigestParts` must cover `lavaBossFights` and `lavaArenaRocks` before `kingOfFireFight`
  flips (the STOP above). The beast feeds no geometry the reach reads: its pixelmask is static and the mouth arrives
  as a new world object, which the digest's world memo already keys.
- **Hammer arc / forecasts:** boss-spawned runners use `runRange` 1000; a forecast that assumes the placed leash (80)
  is wrong for them. The placed `lavarunner` (L71) has the same suit-on-lava undead quirk; it is not modelled for
  placed runners (L71's 190 / 221 refusals are about its press, untouched here).
- **Rules / survey:** the atlas has no `out_tentaclebeast_80_48` edge, so 94 / 95 / 125 / 126 stay NO-EDGE /
  NO-ARRIVAL even ON. The model builds the mouth at runtime (`withRuntimeTeleporters`), but the survey's edge table reads
  the atlas.
- **JS arc / staging:** L57 staged unsplit (above).
- **L32's arena rock** (Bob): its dead frames do not age `slashTimer` the way L82's do. That is not my region; it is
  named because L82 measured the mechanism.
- **Pixelmask line of sight:** a swing whose line crosses the beast's mask box refuses by name. The game samples the
  mask, and the model's line walks boxes. The policy never draws such a line (tentacles stand below the body).

## Deltas (files)

New: `lavaBoss.js`, `lavaBossPolicy.js`, `tentacleBeast.js`, `tentacleBeastPolicy.js`, `fidelityKingOfFire.test.js`,
`fidelityTentacleBeast.test.js`, `fixtures/lavaboss-witness/` (5), `fixtures/tentaclebeast-witness/` (4),
`scripts/procgen/probe-seedling-bosskills.mjs`. Changed (rows added, own functions): `levelRun.js`, `levelWorld.js`,
`chasers.js` (instance `runRange`), `camera.js` (two shake writers), `contactFidelity.js` (two rows + env),
`playerPhysicsV2.js` (the `lavaBosses` bag key), `solverBot.js` (two strategy rows, two verbs, the clear-tag pixelmask
bind), `solverView.js` (two exports), `r8Acceptance.js` (two derivations, a dropped key, a batch site), `seamPosture.js`
(one row's text), `entityBlocks.js` (two `FAMILY_BLOCKS` rows), tests `r8Acceptance` / `contactFidelity` / `boxLock` /
`levelRun` C3 (their pins, two witness rows). Censuses: solver surface
(GREEN 324), constants (PASS 6,421; fields rows classified per table), instruments index. Docs: `seedling-bot-log.md`,
`seedling-constants.md` region, `seedling-solver-surface.md` family table, `architecture.md` region (D2), docs index.

## What the brief got wrong (measured)

1. *"playerPosition (152,176)"* as the arrival: it is the **respawn** the ctor writes. A pit arrival lands where it
   falls (the survey's step 203 arrival is at (168,280)).
2. *"damage gate incl. hitByDarkStuff"*: unreachable for a LavaBoss. No source in the game hits it with "Shield" or
   "Suit"; the model throws by name on those types.
3. The existing note that tentacles *cannot be fought on a fixed tape* is refuted: placements are identical per declared
   seed with `split: true` (D1), and the model reproduces them and the generator's state tick for tick.
4. *"revisits with slots cleared"* for L82: the cleared body is simply gone (no "dead" arm), and nothing else in the
   room differs.

5. Not the brief's but mine: **the D2 commit left three test files red** that my bounded list did not hold:
   `seedlingConstantsCensus` (the new tables' literals unclassified: `--check` passes them, the test does not),
   `entityBlocks` (`FAMILY_BLOCKS` row per family) and `levelRun` C3 (the pinned family list). CI at `41b41c6d` named the
   last two; the first I found locally. All three are fixed (`41b41c6d`, `8aa85f68`), and the AFTER list now includes
   them.

## Residue

- The survey's L57 staging (unsplit) and the atlas's missing mouth edge keep 125 from SOLVING in the survey. Both are
  outside my region; the in-node solve with a split staging is the evidence.
- The whirlpool's pull is checked only through the player's position. In no witness does a live whirlpool reach the
  player (the policy keeps 26 px away), so the pull's arithmetic and the drown refusal have no game witness yet.
- A seed for which variant 0 takes a hit (seeds 2, 4, 5 in node) still wins without a death. The clear-tag path passes
  no `fork`, so it plays variant 0 only.

## Byte-inertia

OFF: the identity block at D2's head and at D3's head equals W0's on every row except the reference row (the base's
environmental DIFFERs, restored after each regeneration). The red `r9-campaign --check` is the base's own. tapeRunner
pairs 635 `e1648386` at both heads. The survey rows OFF keep every verdict; only 125 / 203 / 224's refusal text moves
(they now name the switch). Bounded vitest AFTER (`d4/vitest-files-after.txt`: W0's 76 files + the two fidelity suites, 77 after dedup): **2,126 / 2,126**, sorted `status\tfile > name` md5 `7c6efd0b12557fe1bffa762a924f1f14`.

## Rows to BANK

- identity OFF = W0 (both heads); tapeRunner pairs 635 `e164838673a48b38ce187093c363edb2`.
- surface GREEN 324 · constants PASS 6,421 · entities 566 · profile 138 · roster 289 (no tape added; witnesses are
  fixtures, not tapes).
- witnesses: lavaboss 5 (900 / 260 / 897 / 1264 / 1363 t), tentaclebeast 4 (600 / 600 / 908 / 1047 t), all 0 px.
- survey ON `kingOfFireFight`: 203 / 224 SOLVED 1363 t.
- bounded AFTER 2,126 / 2,126 (`7c6efd0b`).
- CI (`JavaScript Unit Tests`): at `41b41c6d` (D3) run 39521229245 read **21,459 / 21,463**. The four reds were all this
  branch's: `entityBlocks` ×2, `levelRun` C3 ×2 counted as one file, and `generated` (docs index). At `8aa85f68`, run
  39522820314: **21,465 / 21,465**, slow battery 259 / 259. This report's own commit is docs-only.

Not run: `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or
force-push; no AS3, wasm, gitlink or rules edit; no committed tape or producer digest moved.
