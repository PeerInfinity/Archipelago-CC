# Seedling fidelity CORPSEBUMP — a block's glide and a turret corpse's slide see the stepped bodies (`blockSweepBodies`), and an ice turret's corpse is a weigh's holder (`corpseBumpWeigh`) — both OFF

| | |
|---|---|
| Session | `seedling-fidelity-corpsebump` (planner `seedling-fidelity-planning-12`, wave 29) |
| Start SHA | `e8d85de8d1` (`fidelity-harvest/firepush` = main `f9342f25b8` + FIREPUSH, its three keys OFF) |
| Code head | `b2c11d58` (CI: see *Byte-inertia*); this report and its evidence are the commits after it |
| Harness branch | `claude/seedling-corpse-bump-cpcyle` (nothing pushed elsewhere) |
| Port | 9728 (main tree), 9729 (the head worktree the sweeps served), 8000 (W0 worktree; the probe battery) |
| Verdicts | **W0 PASS · D1 PASS (p4g, 0 px) behind `blockSweepBodies` (OFF) · D2 PASS behind `corpseBumpWeigh` (OFF) · D3 PASS (p4g, 0 px over 462 ticks) · Movers: STOP for a licence (0 verdict movers measured)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-corpsebump-evidence/` |

## The one thing to know first

**The solver now builds L40's t2 holder itself, and the game agrees at 0 px. But only the Ghost Sword makes the kill
hitless.** With `corpseBumpWeigh` ON, starting inside the turret's pocket, the solver kills `iceturret@472,400`, bumps its
corpse north twice onto `button@480,384` {t 2}, waits out the fade, and walks west through the opened `wandlock@448,432`
into the pit. The model refuses the same plan with the **Sword alone**, and the mechanism explains why. The turret starts
its next shot on the very tick its 30-tick i-frame runs out. The Sword needs a third landing, which comes after that shot
fires, and the game's shield protects only while the player is MOVING. The Ghost Sword (damage 2) kills in two landings,
before the shot. The AP rule `level_40__r23c29 -> level_40__r32c36` is `Fire AND (Ghost Spear | Sword)`, so it admits a
Sword-only player who must tank one blast. **That is a ruling for the user** (the shape of the 2026-10-21 arrow-trap ruling;
see *What the brief got wrong*).

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git checkout -B claude/seedling-corpse-bump-cpcyle e8d85de8d1` (a fast-forward of the harness branch); `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9728 bash scripts/procgen/identity-block.sh .` at a PRISTINE worktree of `e8d85de8d1` (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `481b7a1c`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5` |
| generated set | `check-seedling-generated-set.mjs` in the W0 worktree, venv active, a server on 8000 (`evidence/identity-w0-generated.txt`) | `OK` |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | 4 DIFFER: the known box artifact (no `bulletml-dodge` checkout) |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **347** · PASS **6,911** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` (`evidence/tape-runner-pairs-w0.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** (= FIREPUSH's) |
| bounded vitest BEFORE | 125 files (`evidence/vitest-files.txt`: FIREPUSH's 123, the brief's list, and every test naming `enemiesUnseenByBlockSweep`, `wedgeVisible`, `pushableCtx`, `fire.bumps`, `killIceTurretInPlace`, `resolveWeighStrategy`, `deriveWeigh`, `L40_CORPSE`, `enemyRoom`, `turretRectsNow`, `chaserRectsNow`, `CONTACT_FIDELITY_KEYS`), in the W0 worktree | **4,298 / 4,299**; the one red is environmental (`seedlingAtlasArm`, no `bulletml-dodge`) |
| `fidelityL32ArenaPrefix.slow` | `vitest -c vitest.slow.config.js` | 5 / 5 |

**The game, read (W0).**
- `PushableBlock`/`PushableBlockFire`: `solids.push("Enemy", "Player")` (`PushableBlock.as:28`, `PushableBlockFire.as:31`) on top
  of `Mobile.solids = ["Solid","Tree","Rock","Rope","ShieldBoss"]` (`Mobile.as:17`). `moveX`/`moveY` stop on the first hit.
- `IceTurret.death()`, on the first `destroy`: `setHitbox(16,16,8,8)`, "dead", `solids.push("Enemy","Player")` (`:135-151`).
  `update()` sets `type = "Solid"` once the player is off it (`:92-95`). `bump(p, t)` acts only on a corpse, for "Fire" or
  "Pulse": one tile away from `p` per `atan2` band (`:172-203`).
- `Bob`, `BobSoldier`, `Puncher`, `Bulb` and `Flyer` are all `type = "Enemy"` (`Enemy.as:58`).
- A `BombPusher` is `type = "Solid"`, static, and immortal (`hit` is empty).
- Update order (`Game.loadlevel` adds, `addUpdate` prepends):
  - the blocks (`:2382-2384`) update BEFORE every chaser (`:2276-2301`) and the ice turret (`:2296`);
  - the turret updates before `bob`, `bobsoldier`, `flyer` and `bulb`, but AFTER `puncher` (`:2301`).
- `Shield.as`: *"It protects you when moving."*

## D1 — the glide sees the bodies (PASS, behind `blockSweepBodies`, OFF)

`contactFidelity.js`: `blockSweepBodies` (OFF; `SEEDLING_BLOCK_SWEEP_BODIES=0|1`). ON:
- **`levelRun.pushableCtx`** also asks `blockSweepBodiesNow('block')` (after the spinners, before the player):
  - every live bridged chaser, where the previous tick left it (none under `noclip`/`noDamage`, where `stepChasersNow`
    does not run);
  - every unremoved ice turret, alive or a corpse. A live turret is `"Enemy"`, which `collidesSolid`'s turret arm (the
    PLAYER's list) rightly skips.
- **The corpse's slide** (`stepIceTurretsNow`'s `blockedAt`) stops on the spinners (this tick's: they update first) and on
  the chasers added before the turret. A `Puncher` updates before the turret, a position this model steps later, so the
  slide refuses by name when it comes within 4 px (`CORPSE_PUNCHER_PAD`). OFF keeps the old throw on any chaser.
- **`run.blockSweepBodyIds(mover)`** (NEW run method): the census ids each sweep consults. This includes the BombPusher,
  a static Solid both sweeps already meet. `enemiesUnseenByBlockSweep(enemies, { seenIds })` (a new optional argument)
  narrows `runFire`'s two enemy-room refusals:
  - the `moves` arm uses the block's set;
  - the `bumps` arm uses the corpse's set (the spinners are seen).

**Witness** `corpsebump-l4-bob-wedge` (p4g headless, logic-only; `probe-seedling-corpse-bump.mjs`,
`evidence/probe-record.txt`). L4 from `r8-solve-4`'s boot: down 40, right 40, idle 60, shoving `pushableblock@32,64` east
while `bob@64,64` is alive.
- **The game stops the block at x 48.5 against the Bob.** ON, the model reproduces the player, the block and the Bob at
  0 px on all 140 sampled ticks.
- OFF, the model glides the block through the Bob and parts at **t79** (block 48.5 vs 49).

**Tests** (`fidelityCorpseBump.test.js`, D1 rows):
- the switch ships OFF;
- the tape is the module's;
- the game's end state;
- ON 0 px;
- OFF parts at t79;
- L40's block sweep, OFF: five classes unseen (IceTurret, Bob, BombPusher, BobSoldier, Puncher). ON: none;
- the corpse sweep ON;
- a `noDamage` run sees no chaser by id.

## D2 — the corpse is a weigh's holder (PASS, behind `corpseBumpWeigh`, OFF)

`contactFidelity.js`: `corpseBumpWeigh` (OFF; `SEEDLING_CORPSE_BUMP_WEIGH=0|1`). It needs `blockSweepBodies` and
`fireLiveTurretReach` ON; with either OFF it gives a named reject.

**The derivation.**
- **`solverBot.deriveCorpseWeigh(run, onto, blocked)`.** A turret whose corpse ENTITY tile shares an axis with the presser
  is a holder (that is the tile `runFire`'s bump arm compares). It gets `k` presses, each from the tile centre one tile
  BEHIND the corpse.
- Every press is audited by `auditFire` against a corpse at that cell, with the live-rect join, and must reach that turret
  alone.
- Every cell the corpse enters must be free of Solids (the corpse's own box is excluded) and not water, lava or a pit.
- The first press's stance must plan from where the player stands (see *the survey* below).
- **`deriveWeighSource`** = `deriveWeigh`, then this second source, only where no block reaches and none is parked. Its
  callers are all three of `deriveWeigh`'s solver callers:
  - `resolveWeighStrategy` (a new corpse arm, before the hold fallback);
  - `stancePrerequisite` (arm (a): the bag is the discharged hypothesis; the corpse's own cell is NOT added, a named bound);
  - guard (iii) in `stanceHypothesis`.
  - `deriveWeigh` itself is not edited (FIREMOVE's).

**The executor.** `execWeigh` → **`execCorpseWeigh`**:
1. A wait for the live turret's 8 px snap (at most 2 ticks).
2. **`killForCorpse`.**
   - The blade: the Ghost Sword first, else the Sword.
   - The player walks to the side facing the push.
   - Each start delay 0 … 100 is tried on a FORK (`ctx.fork`, the crusher's try-before-commit). A try is `d` still
     ticks, then `killIceTurretInPlace` with the new `corpseOnly` option (no drown wait, no spear arm), then a stand until
     no blast is in flight. The volley a "startshot" began before the death still spawns: measured, 5 ticks after.
   - The first hitless try is replayed on the live run key for key. No fork, or no hitless delay ⇒ refused by name.
3. **The bumps** (`runFire`'s bump arm). Each press is followed by a wait for the corpse to rest: the position two AND
   four ticks back, exactly, and at least 72 ticks. The glide's 0.5 px a tick equals the corpse's two-cycle, so "moved
   ≤ 0.5 px" is no rest test. The next stance is read off where the corpse rests: one press from (488,440.45) carried it
   past (30,25) on to (30,24). The presses follow the corpse, at most `k`.
4. **The fade** (`runDwell`, armed as the block arm's).
5. **The shake**: a stand until the camera is exact again, at most 120 ticks.

**The danger map** (the same key). `darkTrapsHarmless` adds dead or removed ice turrets, so a corpse is no longer priced
at its placement. The bump stance (488,424) was refused as *"a static Enemy body at its placement"*.
`entityBlocks.FAMILY_BLOCKS.turrets.solverReads += dangerMap` (and the surface doc's table).

**Record:** a `weigh` record with `corpse: {turret, kill: {…, delay, side, corpseOnly}, presses: [{stance, to, pressTick,
rest}], restoredSlot, shakeWait}` (NEW optional fields).

## D3 — the solver's own t2 holder on L40 (PASS; p4g headless, 0 px)

`corpsebump-l40-t2-holder`. The boot is `prox-l40-turret-volley`'s committed header (the survey's `r8-solve-11` staging
re-pointed at L40 (480,456), inside the pocket), with ONE declared change, `seam.items.hasGhostSword` (see the kill
finding). Goal: `reach-pit` (24,27), west of `wandlock@448,432`, whose only corridor from the pocket is that lock.
- **OFF:** refused *"hold stance (wandlock@448,432): the combat ladder is EXHAUSTED"*: the hold's stance is the button,
  behind the live turret.
- **ON:** SOLVED in 462 ticks:
  - the kill from the up side (delay 5);
  - bumps from (488,440) and (488,424), resting on (30,25) then (30,24);
  - the fade, then the pit, then L43.

| check (`evidence/probe-record.txt`) | result |
|---|---|
| the model (switches ON) replays the tape to its end | PASS |
| the game reproduces the model at 0 px: the player, every block, every chaser, the turret/corpse, **every tick** | **PASS, all 462** |
| the game's corpse rests on `button@480,384` {t 2} and stays while L40 lasts | PASS (from **t215**) |
| the game's player leaves L40 by the pit west of the t2 lock | PASS (L43 at (232, 326.1)) |
| OFF (all five keys off), reported | parts at t174 (corpse y 407 vs 408: `fireLiveTurretReach`) |

**Tests** (D2/D3 rows):
- OFF's refusal;
- ON's plan (records, kill side, presses, rests);
- the recorded tape is the solver's plan, input for input;
- ON 0 px;
- the corpse on t2 from t215 and the end in L43;
- `corpseBumpWeigh` is solver-only (OFF, the rest ON, the model still replays at 0 px);
- with `blockSweepBodies` OFF the corpse source is not raised;
- **Sword alone ⇒ "no start delay 0 … 100 kills … without a hit"**;
- the danger map (a dead turret is priced OFF, not ON).

## Mutants (predicted first; copy + edit + run + restore; `evidence/mutants.txt`)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | `pushableCtx`'s body arm null | L4 ON 0 px red | exactly that |
| m2 | `blockSweepBodyIds` without chasers | the two "ON consults" rows + D2 plan + recorded plan | exactly those 4 |
| m3 | `deriveWeighSource` never raises the corpse | D2 plan + recorded plan | those **+ the Sword-only row**. My prediction was wrong: without the source the refusal is the hold's, not the kill's |
| m4 | dangerMap's dead-turret skip removed | D2 plan + recorded plan + danger-map row | exactly those 3 |
| m5 | the Sword before the Ghost Sword | D2 plan + recorded plan | exactly those |
| m6 | the corpse read at rest after 1 tick (`CORPSE_GLIDE_MIN` → 1) | D2 plan + recorded plan | **only the recorded plan**. The period-2 test alone carries this case; the 72-tick floor changes ticks, not the outcome |
| m7 | the corpse slide's body stop removed (D1) | — | **0 red: no witness has a body in a corpse's slide** (residue) |

## The movers: before → after, and the dispatches to confirm

**Route survey, full** (local, `survey-seedling-route.mjs --through=end --route=full`, both arms with FIREPUSH's three ON;
arm B adds the two CORPSEBUMP keys; `evidence/survey-full-{A,B2}.tsv`). 239 rows. A: SOLVED 185 / REFUSED 53 /
TIMEOUT 1. B: SOLVED 186 / REFUSED 53.
- **One row differs: step 148 (L69), TIMEOUT → SOLVED 826 t.** L69 holds none of these bodies. Alone in arm A it SOLVES
  826 t in 103 s, near its child timeout. This is FIREPUSH's same noise row.
- ⚠ **The first B arm (at `4854eee7`) moved step 93 (L40, Totem Part 64,144) for the worse.** The corpse weigh was raised
  for `wandlock@448,432` from OUTSIDE the pocket. Its walk to the kill stance met the same lock and re-raised the weigh
  until `MAX_STRATEGIES_PER_GOAL`. The fix (`b9ddca8a`): the first press's stance must plan from the player's position.
  After it, steps 67 and 93 refuse byte-identically to arm A.

**Keyed sweep** (local, `probe-seedling-divergence-sweep.mjs --mode=inv`, ×2):
- arm A = the 62 defaults + FIREPUSH's three (`evidence/arm-A.txt`); arm B = A + `blockSweepBodies,corpseBumpWeigh`
  (`evidence/arm-B.txt`);
- 104 legs derived at the head (`evidence/corpsebump-leg-keys.txt`): every leg in L4, L16, L22, L25, L40, L65 and L98,
  the rooms with an ice turret, or with a Bob and a pushable;
- the rows are in `sweep-{A1,B1,A2,B2}.jsonl`.

| run | done | failed | timeout |
|---|---|---|---|
| A1 | 88 | 14 | 2 |
| A2 | 89 | 14 | 1 |
| B1 | 88 | 14 | 2 |
| B2 | 88 | 16 | 0 |

**A1 = B1 on every leg's verdict.** Two failure texts differ only by seam tick or bob id (legs 387, 371). Two legs move
in B2 alone (`evidence/sweep-summary.txt`):
- **368** `level_40__r0c53 <- in_L41_0_160 -> Totem Part 64,144`: timeout / done / timeout / failed (spinner danger).
- **404** `level_40__r23c29 <- in_L43_176_464 -> Chest`: timeout ×3 / failed (chaser bob@736,752). This is FIREPUSH's
  same noise leg.

Both were decided on B2's captured request replayed in node under each arm (`replay-seedling-solve-request.mjs --id=…`,
`SEEDLING_CONTACT_FIDELITY=` the arm). **Each answers A = B byte-identically** (`4fec21f8e7f9`, `1642561bb0df`), so both
are run noise. **0 key-driven verdict movers.** ⚠ A1 ran while the head worktree moved from `4854eee7` to `b9ddca8a`
(the arm-A keys are OFF, so its code was byte-identical either way). B1, A2 and B2 ran wholly at `b9ddca8a`.

**Probes standard ON:** the standard battery (`seedling-probe-batteries.json`: 11 probes), served from the head worktree on 8000 with the five
literals (FIREPUSH's three + CORPSEBUMP's two) flipped in a scratch edit and then restored: **11/11 ALL CHECKS PASSED**
(`evidence/probe-battery-standard-on.txt`), `arrival-composites` included.

**Bounded vitest, ON** (the same flip; 126 files; `evidence/rows-on.txt`): 4,320 tests, 12 red:
1. `seedlingAtlasArm`: environmental, as at W0.
2. `seedlingSolverSurface (i)`: that worktree was at `b9ddca8a`, before the re-seal `b2c11d58`. Stale, not a mover.
3. The "ships OFF" rows: `contactFidelity` defaults, `fidelityCorpseBump` ×2, `fidelityFirePush`. A flip re-pins them.
4. `iceTurret.test.js > … the corpse HOLDS button@480,384`: FIREPUSH's known control on the game-refuted reach model
   (`fireLiveTurretReach`).
5. **`botDriverV2.test.js > R7 slice 6c: shove … L4's door`, 5 rows** (the door opens, the lean span, the release, the
   pit refusal, the second consumer). **This is `blockSweepBodies`' real mover.**
   - These rows hold `button@16,64` for only 8 ticks and then shove `pushableblock@32,64` east past a still-living
     `bob@64,64`.
   - ON, the Bob stops the block (*"never committed to (4,4)"*). That is exactly what the game does in the L4 witness.
   - So these rows are controls on the game-refuted model, and a flip owes them a re-pin. Either the hold outlasts the
     arrows' kill of the Bob (the solver's own L4 plan holds 108 ticks, and survey step 4 is unchanged ON), or the rows
     assert the stall.

**Please run, on this branch** (head after this report):
1. **Survey full:** `seedling-survey.yml` with `through=end route=full`. Arm A: `contact_fidelity=` the contents of
   `evidence/arm-A.txt`. Arm B: `evidence/arm-B.txt`. Compare against 39496129402 by (level, goal, boot). Expected: arm A
   = arm B except timeouts; L40 steps 67 and 93 unchanged.
2. **Keyed sweep ×2:** `seedling-divergence-sweep.yml` with `keys=` the 104 keys of `evidence/corpsebump-leg-keys.txt`
   (`|`-separated), `capture_requests=true`, arms A/B as above. Expected: 0 verdicts move by key.
3. **Probes:** `seedling-probe.yml battery=standard` with arm B's keys ON. Then a `seedling-probe.yml` run of
   `probe-seedling-corpse-bump.mjs` (both witnesses at 0 px expected).

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched.
  No new `SolverRefusal.obstacle.kind`.
- **New run method:** `run.blockSweepBodyIds(mover)` (`null` with the key OFF). No `run.*` field is renamed or reshaped.
  `run.shake` and `run.cameraNow` gain a solver reader (the surface census lists them).
- **New optional record fields:** `weigh.corpse` (above). New optional argument: `enemiesUnseenByBlockSweep(…, { seenIds })`.
- **The walker:** `runFire` (not one of the four walker functions) narrows its two refusals behind the key. The sweep's
  `producer:walker` rows were not run; `runFire` moves only with the key ON.

## Hand-overs

- **Hammer arc: none.** None of its functions were edited. I added `killIceTurretInPlace`'s `corpseOnly` option (KILLLOCK
  K4's function, not on the hammer list); with it, the spear arm is skipped. No escape-read state was added.
- **To the planner / FIREMOVE:**
  - the corpse source is `deriveWeighSource`. FIREMOVE's fire-family lift in `deriveWeigh` composes ahead of it: a fire
    block that reaches wins, and the corpse is asked only after;
  - the Boss Key 2 chain still needs FIREMOVE's Fire route for t5. `deriveCorpseWeigh` refuses (30,26)→(48,25) by name:
    "shares neither axis" — a corpse is not t5's holder.
- **To the user (a ruling):** a Sword-only L40 holder needs the player to tank one ice-turret blast. Should the logic
  expect it (rules: `Fire AND (Ghost Spear | Sword)`), or should the solver tank it by name?

## Deltas

- `contactFidelity.js` (+test): the two keys and their env lines.
- `levelRun.js`:
  - `blockSweepBodiesNow`;
  - the `pushableCtx` arm;
  - the corpse slide's ON arm (`CORPSE_PUNCHER_PAD`);
  - `run.blockSweepBodyIds`.
- `spinner.js`: `enemiesUnseenByBlockSweep`'s `seenIds`.
- `botDriverV2.js`: `runFire`'s two narrowings.
- `solverBot.js`:
  - `deriveCorpseWeigh`, `deriveWeighSource` and its three callers;
  - `resolveWeighStrategy`'s corpse arm;
  - `execCorpseWeigh`, `killForCorpse`, `corpseKillSide`;
  - the `CORPSE_*` bounds;
  - `killIceTurretInPlace`'s `corpseOnly`.
- `dangerMap.js`: `darkTrapsHarmless` + dead turrets. `entityBlocks.js` and the surface doc.
- New files:
  - `fidelityCorpseBump.js` (+test);
  - `probe-seedling-corpse-bump.mjs` (box-lock roster row in `boxLock.test.js`);
  - `fixtures/corpsebump-witness/` (2).
- Censuses: surface **350 GREEN** (3 rows classified), constants **6,914** PASS, entities 566, profile 138, roster 289.
- Docs: `seedling-bot.md` paragraph, the bot-log entry, the instruments + docs index (the four environmental regions left
  as at W0).

## What the brief got wrong (measured)

- **"kill the turret, then bump its corpse … (the corpse as a Solid-on-button source)":** the kill is the hard half. No
  Sword kill of `iceturret@472,400` standing in its range is hitless: the model shows it over 72 hand timings and 101 fork
  delays, and the mechanism is above. The shield the brief's staging assumes (*"A faced shield stops the volleys"*,
  KILLLOCK K4's docblock) protects only while moving. That docblock is wrong for a standing kill: `killIceTurretInPlace`
  on L40 is hit on its tick 52.
- **"its witness bumps from (488,424)":** true for the second press of `r5-l40-part5`'s geometry. But one press from
  (488,440.45) can carry the corpse two tiles, so a holder plan cannot be a fixed tile list.
- **"Bob in the block sweep":** every chaser class is in it now. The ice turret had to be too: a live one is `"Enemy"`,
  which the old sweep skipped, so `runFire` also refused L40 on `IceTurret`, and on `BombPusher` until its static Solid was
  counted. The corpse needed its own update-order row for the Puncher.

## Residue

- The corpse slide's body stop (D1) is unwitnessed (m7).
- One straight line only: a corner, e.g. t5's (30,26)→(48,25), is refused by name.
- A corpse parked on its presser is not a wall in the stance hypothesis's bag.
- The Sword-only kill refuses (the user's ruling, above).
- The puncher arm of the corpse slide is a named refusal, not a model.
- `CORPSE_GLIDE_MIN` (72) is a floor the measured case does not need (m6).

## Byte-inertia (OFF)

- **Identity at head (`b2c11d58`, a worktree) equals W0** on every md5 row and all six producer `--check`s
  (`evidence/identity-after.txt`; a row diff against `identity-w0.txt`: IDENTICAL). Generated set OK. The reference has
  the same 4 environmental DIFFERs.
- **Bounded vitest AFTER** (defaults, 126 files = W0's 125 + `fidelityCorpseBump.test.js`; `evidence/rows-after.txt`):
  **4,319 / 4,320**, the one red the environmental `seedlingAtlasArm`, as at W0.
- tapeRunner pairs 635, `88fc7df4…` (= W0). Roster 289. `fidelityL32ArenaPrefix.slow` 5/5 (W0).
- Censuses at head: surface 350 GREEN, constants 6,914 PASS, entities 566, profile 138.
- **CI `JavaScript Unit Tests`:**
  - at `b9ddca8a` (run 40117820269): 22,618 / 22,619. The one red was `seedlingSolverSurface (i)`: the surface json went
    stale behind that commit's own solver change. `b2c11d58` re-seals it (36/36 locally), but a json-only push matches
    no path in the workflow's filter, so no run exists there.
  - this report's commit also touches `docs/` (the bot-log mover rows), so it runs CI at the final head; read that run
    first.
- No committed tape, producer `--check`, or identity row moves, ON or OFF. **ON**, the bounded set moves 5
  `botDriverV2.test.js` L4 shove rows, plus the "ships OFF" rows and FIREPUSH's `iceTurret` control (above).

## Rows to BANK

- **W0:**
  - the glide's solids list and the update order (blocks before every chaser and the turret; the Puncher before the
    turret);
  - the shield guards only while moving.
- **D1:** the L4 witness at 0 px (OFF parts at t79); mutants m1/m2/m7.
- **D2/D3:**
  - the L40 holder at 0 px over 462 ticks, the corpse on t2 from t215;
  - the Sword-only refusal and its mechanism;
  - mutants m3-m6.
- **Trap candidates** (in the bot-log entry):
  - one update order is not the whole order;
  - a glide's speed equal to a two-cycle's step defeats "moved ≤ 0.5 px";
  - one press can carry a corpse two tiles.
