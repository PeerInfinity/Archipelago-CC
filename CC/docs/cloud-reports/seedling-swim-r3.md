# Seedling swim R3: player death inside the model, the game's way — pit · drown · lava · the BobBoss reboot

**Slice:** `seedling-swim-r3`, an Opus build slice run in the cloud for the swim arc (plan §18.15). ⚖ User ruling 2026-10-01: *"player death in the JS model should work the way the real game does it"*, a death inside the BobBoss fight included.

| | |
|---|---|
| Started from | `origin/main` @ `9a0b031c83` (the coordinator merge over R1 + U13 + J2; R1's merge is in it) |
| Head | this report's commit, on top of `76eb12a` |
| Harness branch | `claude/bobboss-death-reboot-4s6o9z` (the harness pins it, not `seedling-swim-r3`) |
| Commits | D1 `e385f2b` · D2 `c1cf35c` · D3 `a14ab3a` · D4 `76eb12a` (records) · this report |
| Dev server | `scripts/serve-nocache.py 8940` (`SEEDLING_PORT=8940`, build `seedling_bot_ap_p4e`) |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduced at `9a0b031`. The campaign `--check` is `f30369a4` (U13 moved it; R1's report quotes `46990775`). Bounded vitest 14 files / 829. |
| D1 | **PASS, witness first** | A pit in a room with no `control` block is `die()`. `r3-pit-death` (L4): edge t38, respawn on observation 57 at (72,40). The game matched the prediction on every tick. Mutant: 2 rows red at t57 by the old pit refusal. |
| D2 | **PASS, witness first** | Two corrections to the unwitnessed spiral: the latch tick does not spin, and `drown()`'s `dying` skips the move, so the player stands still. Lava's `hit(null,0,null,0)` opens an i-frame and adds shake. `r3-drown`: still from observation 84 to 103, respawn on 104. `r3-lava`: steering lost from t9, respawn on 39. Mutants: 4 red ("DROWNED"), and 1 red at t10. |
| D3 | **PASS, witness first** | A death in the fight reboots the fight. The rock is built fallen, its first live frame re-adds the boss, and the respawn is the rock's own `playerPosition` write, (72,104). `r3-bobboss-death`: death on observation 148, respawn (80,112), and the dialogue holds the player. Mutants: t148 red, and t161 red (I predicted t160). |
| D4 | **PASS** | tapeRunner 415/415, so all 407 older rows hold. The identity block's whole output is byte-identical to W0 (md5 `51342fa4…`, six `--check`s included). The differential over the four witnesses reads 95 PASS / 0 FAIL. Records, reference ALL 7 + 5 MATCH, constants PASS 4,670, surface GREEN 189. Bounded vitest 24 files: 1,331 pass and 1 fails, the expected JS-arc row. |

**The one thing to know first.** `run.advance` no longer throws a death. All four deaths reboot inside the model, through the same end-of-tick path a hit death takes. So `jsRuntimeCore`'s `DEATH_REFUSALS` can never match from the page's tick. Its pit row in `jsRuntimeCore.test.js` is red at this head **by design**: the run itself died on t138 and respawned at (136,40), the point the page used to compute. I did not edit that arc's file or its test. The catch and that row are theirs to retire.

## W0: the banked rows (at `9a0b031`, the clean tree, before any edit)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=8940 bash scripts/procgen/identity-block.sh .` | maze `246dfbce…` · acceptance `e417212b…` · c3 `348c1e9c…` · c6 `e3f101be…` · c4 `b11d9564…` · ENEMY `3910ee23…` · guard `a6d18d49…` · AREA `02b22525…` · killgate s2/s5/s9 `63d34807…`/`fb207b8e…`/`bfbdfb38…` · level pre/post s1 `e28c1e5d…`/`c4841acb…` · generated set OK · reference ALL 7 + 5 MATCH. Whole output md5 **`51342fa47ab417e1cf80131f8652ce30`** |
| six `--check`s | the block's producer loop | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1` **`f30369a4`**, all exit 0 (the campaign row is U13's) |
| surface / constants / profile / entities | the four `--check`s | GREEN 189 / PASS 4,660 / 138 keys (both tiers) / 461 leaves |
| tape index / tapeRunner | `fixtures/tapes` / vitest | 175 tapes / 407 rows |
| roster pins | the four suites | `dialogueAutoAdvance` 175 (inert 174), `tapeEnvelope` 175, `observationTolerance` 175 ×2 (`names`, `swapped`); R8 `exposedAdded` unchanged by this slice |
| bounded vitest BEFORE | the brief's paths, plus `jsRuntimeCore` | **14 files / 829 tests**, exit 0 (playerPhysicsV1/V2, levelRun, contactPairV2, playerDamage, tapeRunner, bobBoss, deadFrameBand, the surface/constants/profile/entity tests, lintGateLabels, jsRuntimeCore) |

## The witnesses (`plan-seedling-r3-death.mjs`, with `--check`)

The keys are a fixed schedule. All four tapes were emitted while the model still refused each death by name: the planner's first run printed 12 FAILs, one old refusal per tape. They were recorded headless on the game in one sweep (`--record --only=…`) before any model line moved.

The recording run read *"the JS model runs this tape — <the old refusal>"* for all four. For the pit it also read *"game accepted input throughout"*: the game cut input for the fall, and the differential had no cause to account for it (see D1).

## D1: the pit (`e385f2b`)

**The AS3 order as read.** `Player.update` runs `… if (!dying) super.update(); sprites(); hitUpdate(); checkFallingInPit();`. `checkFallingInPit` cuts input, lerps the player toward the tile centre (÷10), spins the graphic and fades alpha by 0.05. At alpha ≤ 0 it takes `Game.fallthroughLevel > -1` (transport) or `die()`. So the pit death is called after this tick's move: the step stands. A hit death is the opposite (no physics on its tick).

**The step.** `step` returns `death: {source: 'pit', id: 'pit@x,y'}` where it used to throw. `levelRun` turns `next.death` into `pendingDeath` right after the step, and the existing reboot takes it at end of tick.

- `fallDestination` is unchanged. It is the planner's "is this pit transport?" query (solverBot's `lethalFloorOf` and its `reach-pit` refusal).
- A preview step that reaches a death throws the old words (`deathRefusal`), so every planner caller is unchanged.
- The freeze-clearing frame refuses a death by name, as it refuses a transition.
- The differential now counts a pit death as a cause of `saw_input_refused` (*"1 pit death(s) modelled"*).

| `r3-pit-death`: L4 (`Dungeon1/2.oel`), boot (64,32), `noDamage`, `down` ×30, `right` ×8, still to t100 | prediction (AS3 + the pre-step model up to its throw) | game | model after D1 |
|---|---|---|---|
| the pit edge | t38 (`pit@80,64`), alpha 0.95 | t38 (81.839, 76.466) | same |
| the fall | 20 subtractions; lerp toward (88,72) | t56 (87.327, 72.755) | same, to the bit |
| `die()` / swap | at the end of t57; observation 57 is the respawn | **observation 57 = (72, 40)**, no transition | `playerDeaths` `[pit@57 → (72,40)]`, no transition |
| first post-respawn ticks | at rest at (72,40) | t58–t100 (72,40) | same |

- **Mutant** (predicted first: `r3-pit-death`'s 2 rows red at t57 by the old pit refusal, every other row green): the arm disabled with `&& false`, one build, restored md5-identical (`90f60c9e…`). **Measured: exactly that.** 2 red, both *"the player fell into a pit in level 4, which has NO control block …"*, and the 407 older rows green.
- **Parity:** tapeRunner 409/409 (the old 407 + the witness's 2). `contactPairV2` is green, so the shared reboot path did not move the hit death.

## D2: drowning and lava (`c1cf35c`)

**The AS3 order as read** (`Player.as:1431-1485`, called above `super.update()`):

```
checkDrowning():  if (drowning) drown();
                  else { v = 1 water && !canSwim | 2 lava && !hasDarkSuit;
                         if (v > 0) { if (v == 2) hit(null, 0, null, 0);
                                      if (drownTimer <= 0) drownTimer = 10;
                                      else if (--drownTimer <= 0) { drownTimer = 0; drowning = true; } } }
drown():          drownTimer = (drownTimer - 0.5 + 10) % 10; v = spiral; dying = true;
                  if (drownTimer <= 0) die();
```

Three consequences. The model had the first two wrong, and the planner's avoidance meant nothing had witnessed them:

1. **The latch tick does not spin.** It is `if/else`. The model spun on the latch tick and so died one tick early (its old refusal fired at t103; the game died at t104).
2. **The spiral does not move the player.** `drown()` sets `dying`, and `if (!dying) super.update()` skips friction, input and the move. `dying` is never cleared on a `Player`. The model moved the player along the spiral's `v` (its old docblock said the thrash *"is then subject to friction and the sweeps like any other velocity"*).
3. **Lava's `hit(null, 0, null, 0)` is not a no-op.** It deals 0 damage with no point, but inside `Player.hit`'s gate it writes `hitsTimer = 20` and `Game.shake += 5`. Because it runs above `super.update()`, that same tick's `input()` does not steer.

**The step.**

- `step` decides `dying` from the incoming `drown.drowning`. A dying tick runs `drownStep` and skips `stepV1` entirely, so the position stands and `v` is the spiral. The swim replay reads the spiral `v` (AS3 reads `v` after `drown()` wrote it). The twentieth spin returns `death: {source: 'drown'|'lava'}`.
- Lava is a run callback: `stepOpts.lavaHit` → `applyPlayerHit({source: 'lava', force: 0, damage: 0, from: null, retaliate: null})`, returning `!canSteer(damage)` for this tick's sweep. Under `noDamage`, `Player.hit` returns at its first line and no row is written, as for a static body. Only the run's own step passes the callback, so a preview models no lava hit.
- `acting` is `NO_KEYS` while dying (`input()` never runs, so a press is lost).
- `drowningHazardKind` is factored out of `checkDrowning`. The unit row `THROWS rather than modelling the death` is rewritten as the game's order: latch without a spin, twenty still spins, `death.source === 'lava'`, and `deathRefusal` still says "DROWNED".

| `r3-drown`: L47, boot (208,136), no conch, `noDamage`, `right` ×80, still to t140 | prediction | game | model after D2 |
|---|---|---|---|
| first water tick (`drownTimer` 10) | t74 | (305.025, 144) | same |
| latch | t84 | (311.15, 144) | same |
| spiral | t85–t103 still at t84's point | **(311.15, 144) from 84 to 103** | same |
| `die()` / respawn | observation 104 at (216,144) | **(216,144) on 104** | `[drown@104 → (216,144)]` |

| `r3-lava`: L96 (`Dungeon7/11.oel`), boot (32,64) on its teleporter, `noDamage` FALSE, `left` ×30, still to t70 | prediction | game | model after D2 |
|---|---|---|---|
| the lava hit | t9: no damage, `hitsTimer` 20, shake 5, no steering | t9 30.05, t10 29.60 (friction only, −0.5 a tick), then still | `playerHits` `[lava@9: hits 0, shake 5]`; stream identical |
| latch / spiral | t19 / t20–t38 | still at 29.60 | same |
| `die()` / respawn | observation 39 at (40,72) | **(40,72) on 39** | `[lava@39 → (40,72)]` |

The t9 x is the same with or without the hit (30.05). The lava speed cap and friction coincide on that one tick, so the i-frame's first visible tick is t10.

- **Mutant (a)** (predicted first: 4 red, `r3-drown` and `r3-lava` ×2 rows each, all by "DROWNED"): the death arm throws `deathRefusal`, restored md5-identical (`f90ba5bd…`). **Measured: 4 red / 409 green.** The refusals were *"DROWNED in level 47 at (311.1499999999999, 144)"* and *"… level 96 at (29.600000000000005, 72)"*.
- **Mutant (b)** (predicted first: 1 red, `r3-lava` at tick 10, x 28.9 against the game's 29.6): the callback not passed, restored md5-identical (`9c7a7275…`). **Measured: exactly that:** *"tick 10 differs: expected (x=29.600000000000005 …), got (x=28.900000000000006 …)"*. The stepping-face row stays green because it compares the model to itself.
- **Parity:** tapeRunner 413/413. `r5-swim-drown` (seven water ticks, `drownTimer` 4) is unchanged.

**The budget.** It is per `Player`, not per run. The 11-tick budget never resets off-hazard within one `Player`, but every new `Game` builds a new `Player` (`drownTimer = 0`): a respawn, a teleporter or a fall. `arriveAt` already resets it, and the game agrees, since its final `drownTimer` reads 0 after the respawn.

## D3: the BobBoss death reboot (`a14ab3a`)

**The AS3 order as read** (`Scenery/FallRockLarge.as`, `Enemies/BobBoss.as`):

- `fall()` → `Game.setPersistence(tag, false)`, a static. A new `Game` in L32 therefore builds the rock with `!checkPersistence(tag)`: `y = fallTo`, `type = "Solid"`, `_active = true`, and **`cameraTimer = 0`**.
- `update()`'s `else` arm, on the rock's first live frame (entities do not update under the load's `blackCover`): `if (cameraTimer == 0) { if (bossRock && thirdBoss) { FP.world.add(new BobBoss(72, 72)); playerPosition = new Point(72, 104); } freezeObjects = false; resetCamera(); cameraTimer = -1; }`.
  - The boss is added at that frame's `updateLists` and steps from the next one.
  - Its ctor queues a fresh `BobBossNPC` (form 0's dialogue again) and removes itself if `Player.hasFire`.
- **The same arm runs on the ORIGINAL release frame**, so `playerPosition` (and `Main.playerPositionX/Y`) become (72,104) the moment the fight starts. A death in the fight therefore respawns inside the arena, not at the room's entry (72,120).

**The step.**

- `bobRocksFallen` (per run) records the fall on the arm frame.
- `bobArenaNow` builds the arena fallen in such a level (`armed`, `landed`, `spawnOnFirstFrame`), so the rock is Solid through `fallenRocksNow`.
- The first live tick queues `pending = {form: 0}` (nothing under `hasFire`), sets `worldCtor = ARENA.respawn` and writes a `rock-fallen-at-build` ledger row.
- The release frame of the first fall writes `worldCtor = ARENA.respawn` too.
- U5's refusal is gone. A BobBoss death is the ordinary hit death.
- No new constant: `ARENA.respawn` (72,104) already existed in `bobBoss.js`.

| `r3-bobboss-death`: U5's boot/seam (`hits_max` 1)/save/rng/clears, `up` ×10, six page presses, still, `left` 160–200 | prediction | game | model after D3 |
|---|---|---|---|
| the death | the model's own blade hit, observation 148 | jump on observation 148 | `[bobBoss@148 (bobboss#0:sword0) → (80,112)]` |
| the respawn | (80,112): the rock's `playerPosition`, not (80,128) | **(80,112)** | same |
| the rebuilt fight | the rock's first live tick queues the boss; the next adds it and opens form 0's dialogue | the player stays at (80,112) through `left` 160–200 | `rock-fallen-at-build` (advance 149), `boss-added` + `dialogue-open` (advance 150); held by the dialogue |
| `worldCtor` at the end | (72,104) | — | (72,104) |

**RNG: no STOP.** The re-constructed boss draws only `Enemy`'s ctor pair: `coins` (`Math.random`) and `fallSpinSpeed` (`FP.choose`). Neither stream is read by anything modelled outside L112 (below). `BobBoss` and `BobSoldier` have no other draw site; form 2's re-seed is arithmetic (R1).

- **Mutant (a)** (predicted first: 1 red at t148, (80,128) against (80,112)): the release-frame write removed, restored md5-identical (`6a4eb642…`). **Measured: exactly that**, *"tick 148 differs: expected (x=80, y=112), got (x=80, y=128)"*.
- **Mutant (b)** (predicted first: 1 red at **t160**, the `left` moving a player no dialogue holds): the first-frame re-add removed. **Measured: 1 red at t161**, *"expected (x=80, y=112), got (x=79.2, y=112)"*. My prediction was one tick early: the `left` starts at held index 160, which is observation 161.
- **Parity:** tapeRunner 415/415. `swim-u5-bobboss-encounter`, `r1-dark-shield-bobboss` and the three `r5-bobboss-*` are unchanged; the new release-frame `worldCtor` write does not move them.

## The respawn's RNG draw (and whether the hit death was missing it)

- **The draw exists.** A new `Player` runs `fallSpinSpeed:int = 8 * FP.choose(-1, 1)` (`Player.as:344`). `FP.choose` → `FP.rand` → FlashPunk's Lehmer generator (`_seed * 16807 % 2147483647`), not `Math.random`.
- **Nothing modelled reads that generator.** Its only readers are graphic angles and scales: `Player`/`Enemy.fallSpinSpeed`, `RockFall`'s `angleRate` and `scaleX`, `HealthPickup`'s scale. `spinner.js`'s `SPINNER_CTOR_RNG` already records that the model consumes neither stream. The new `Game`'s `Tile`/`Enemy` ctors draw `Math.random`, which the model reads only in L112's Owl schedule.
- **So the hit death was not missing a draw**, and neither is any teleporter or fall: every world construction pays the same unread draws.
- **The one room where it would matter is L112.** Its build draws `OWL_LEVEL_BUILD_SITES` on the seeded stream `owlStream` counts. A death there with the stream open is now **refused by name** (D4). No committed tape dies there: the roster scan finds deaths in only the four witnesses and `r6-contact-pair-live`/`-heart`.

## D4: parity and the JS arc

| Row | W0 | head |
|---|---|---|
| tapeRunner | 407 | **415** (+8: four witnesses × 2); every old row passes |
| `r6-contact-pair-*` | green | **green, byte-identical** (the shared reboot path did not move the hit death) |
| identity block | md5 `51342fa4…` | **`51342fa4…`**: every row, the six `--check`s and the reference identical |
| differential (live game, non-record) over the four witnesses | — | **95 PASS / 0 FAIL / 37 SKIP**, *"ALL CHECKS PASSED"* (log md5 `7c50e2bf…`) |

⚠ The head identity block started at `a14ab3a`. The D4 records commit (`76eb12a`) landed while it ran; that commit adds the L112 refusal and some docs. The refusal fires only on a death in L112, which no generator path reaches, and the block's reference row (run last) reads ALL MATCH.

**The JS arc's `DEATH_REFUSALS`** (`jsRuntimeCore.js:100-103`, not edited):

| kind | pattern | can it still match from the page's tick? | the death now |
|---|---|---|---|
| `pit` | `/fell into a pit in level -?\d+, which has NO control block/` | **No.** `run.advance` reboots the pit death itself. The text is still built by `fallDestination` / `deathRefusal`, but only for planner queries and previews, never for `session.step` | `death.source 'pit'`: reboot into the world's ctor args at end of tick (`playerDeaths`) |
| `drown` | `/DROWNED in level -?\d+/` | **No**, for the same reason, water and lava alike | `'drown'` / `'lava'`: still spiral, `die()` on the twentieth spin, reboot |

`jsRuntimeCore.test.js` at head: 11 pass and 1 fails, *"a pit with NO control block is a death: the page respawns …"* (`out.death` is `undefined`). A probe of that test, copied and restored, found the run's own `playerDeaths` `[pit@138 (pit@64,80) → (136,40)]`, `halted` null and `deaths` (the page's) 0. The model now does what the catch did, at the same point. ⚠ One difference the arc should know: the page respawned at the session's `arrival`, while the model respawns at the world's ctor args. These differ after a BobBoss fight began, (72,104) against (72,120).

## Surface, constants, profile and entity deltas

| Row | W0 | head | movers |
|---|---|---|---|
| solver surface | GREEN 189 | **GREEN 189** | no new run member: the deaths ride `playerDeaths` (new `source` values `pit`/`drown`/`lava`), the lava hit rides `playerHits` (`source: 'lava'`), the arena rides `bobBossEvents` (`rock-fallen-at-build`) |
| constants census | PASS 4,660 | **PASS 4,670** | D1 4,664; D2 4,669 (six reviewed targets retargeted to moved hashes: the `acting` gate, `drowningHazardKind`'s three kinds, the feather sign, the `directionFace` default); D3 4,670; D4 re-written over comment moves |
| profile | 138 keys | **138 keys**, both tiers `--check` PASS | no new key, so no witness tier is owed |
| entities | 461 | **461** | no new leaf |
| tape index | 175 | **179** | the four witnesses |
| roster pins | 175 (inert 174), 175, 175 ×2 | **179 (inert 178), 179, 179 ×2** | moved by name in each test's comment: `r3-pit-death` (D1), `r3-drown` + `r3-lava` (D2), `r3-bobboss-death` (D3). R8 `exposedAdded` and `lint-gate-labels` needed no move (their suites are green unedited) |
| reference | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** | instruments 306 (+ the planner); docs index follows the log; `check-procgen-docs` ALL CHECKS PASSED |
| `check-procgen-help` | not measured at base | 18 FAILED | `plan-seedling-r3-death.mjs` is IMPORT SIDE EFFECT, the same shape as its eight sibling planners in the list |
| bounded vitest AFTER | 14 / 829 | **24 files: 1,331 pass, 1 fail** (the `jsRuntimeCore` pit row above) | the W0 set plus `dialogueAutoAdvance`, `tapeEnvelope`, `observationTolerance`, `r8Acceptance`, `tapeIndexManifest`, `solverEncounter`, `r5Chain`, `solverBotLethalPit`, `solverReachPit`, `r5Swim` |

## What the brief got wrong (measured)

1. **"`drown()` spins via `v` until the timer reaches 0, then `die()`."** True in the AS3, but the model built on that reading moved the player along the spin. `drown()` also sets `dying`, which skips `super.update()`, so nothing spends that `v`. The game holds the player still for all twenty ticks (`r3-drown`, observations 84–103).
2. **"The never-reset 11-tick budget is per RUN."** It is per `Player`, and a `Player` lasts one world: a respawn, a teleporter or a fall each builds a new one with `drownTimer = 0`. "Never reset off-hazard" holds within one world visit.
3. **"The respawn consumes RNG … if not, that is a latent hit-death bug too."** It consumes FlashPunk's Lehmer generator, which nothing modelled reads; the model reads no stream outside L112. So it is not a latent bug. The only room where it would matter is L112, now refused by name.
4. **"If the boss's re-construction draws RNG the model cannot reproduce, STOP."** It draws only the unread `Enemy` ctor pair, so there was no STOP.
5. **"`playerPosition` is THIS world's ctor args."** Not for L32. `FallRockLarge`'s `cameraTimer == 0` arm rewrites it to (72,104) mid-world, on the original release frame and on the rebuilt rock's first frame. Without that write, a BobBoss death respawns at (80,128), under the fallen rock (mutant (a)).
6. **The code map's line numbers** had moved with J2/U13. For example, `pendingDeath` is set at `levelRun.js:8628`, not `:8543`; the reboot is at `:15743`; U5's refusal was at `:11194`. Every site was re-found by name.
7. **The differential** needed a fifth cause for `saw_input_refused`: a pit death cuts input exactly as a transport does. The brief did not list it.
8. **My own prediction, D3 mutant (b):** t160 predicted, t161 measured (held index against observation index).

## Residue

- **The hand-off.** `jsRuntimeCore.test.js`'s pit row stays red until the JS arc retires its catch, and the arc should know about the arrival-vs-ctor difference. ⛔ Not edited here.
- **Unwitnessed arms** (each written from the AS3, none recorded):
  - re-entering L32 after the Fire (`BobBoss`'s ctor removes itself, so the arena adds no boss);
  - the rebuilt rock pushing an overlapping player (`p.y = …` in the rock's `activate` arm; the respawn (80,112) does not overlap, so it is not modelled);
  - an enemy hit landing during the spiral (`hit` is not gated by `dying`; a second `die()` would rebuild the same world);
  - a teleporter firing during the spiral.
- **Lava under `noDamage`** writes no `contactsSuppressed` row, by choice (byte-inertness of the ledgers on `noDamage` tapes). A **preview** models no lava hit and refuses a death.
- **The differential's "never started drowning" row** reads the game's final `drownTimer`, which a death resets. On `r3-drown` and `r3-lava` it PASSes for the wrong reason: the respawn erased the evidence. It is a trap candidate, logged.
- **J0(a)'s census re-run** (38 drown / 17 pit / 1–2 lava runs) was not repeated. Its file is not in the repo, and the census belongs to the JS arc.
- **The witnesses' CI rate** is unmeasured (one recording each). `standing-values.json` was not rewritten.
- **Scratch instruments** (session scratchpad, not committed): `sim.mjs`, `d1.mjs`, `d2.mjs`, `d3.mjs`, `d3b.mjs` (the post-death ledger), `pits.mjs`/`lava.mjs`/`l4.mjs` (the room scans), `owldeaths.mjs` (the roster death scan), `pins.py`.

## Byte-inertia

| Artifact | W0 (`9a0b031`) | head |
|---|---|---|
| maze / acceptance / c3 / c6 / c4 / ENEMY / guard / AREA | `246dfbce` `e417212b` `348c1e9c` `e3f101be` `b11d9564` `3910ee23` `a6d18d49` `02b22525` | **identical** |
| killgate s2/s5/s9 · level pre/post s1 | `63d34807` `fb207b8e` `bfbdfb38` · `e28c1e5d` `c4841acb` | **identical** |
| generated set | OK | **OK** |
| six `--check`s | `410f27c0 7cba9530 cef8048e 9a6a3192 6cd35fe1 f30369a4`, exit 0 | **identical**, exit 0 |
| reference `--check` | ALL 7 + 5 MATCH | **ALL 7 + 5 MATCH** |
| identity block output md5 | `51342fa47ab417e1cf80131f8652ce30` | **`51342fa47ab417e1cf80131f8652ce30`** |
| tapeRunner | 407 | **415**: the old 407 identical, plus the four witnesses |
| `fixtures/**` | — | the four witnesses (tape + expectation each) and `tapes/index.json` only; `campaign-frontier.json` untouched |

None of the following was touched or run: AS3, wasm, gitlinks, any committed tape or expectation other than the four new witnesses, biome defaults, `campaign-frontier.json`, `standing-values --write`, `pytest`, unfiltered vitest. Also untouched: `jsRuntimeCore.js` (and its test), `botDriverV2`'s `drive`/`planTilePath`, and the planner's lethal-floor avoidance (its `fallDestination` query and `lethalFloorOf` are unchanged; a preview that reaches a death refuses with the same words as before).
