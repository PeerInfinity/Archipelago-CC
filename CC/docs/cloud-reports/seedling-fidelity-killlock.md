# Seedling fidelity KILLLOCK — kill-lock rooms whose bodies the run did not track (+ L98's turret kill)

Slice `seedling-fidelity-killlock`, planner `seedling-fidelity-planning-3`, wave 8 (model coverage). Cloud, Opus.

| | |
|---|---|
| Start | `0f952e9a9e` (the wave-7 harvest: main `9e1361f7c5` + CHECKPOINTS + LINEFLIP); not rebased |
| Harness branch | `claude/killlock-body-tracking-8lamdw` |
| Head | see the last commit on the branch (this report is committed last) |
| Verdicts | **D1 PASS · D2 PASS (L60 west, the L98 bodies witnessed; L98 end to end, L60 east, L71, L99 named residue) · D3 PASS (10 → 14 of 35 with the switches ON)** |
| Byte-inertness | every switch ships **OFF**. OFF: identity block, six producer `--check`s and the 533 tapeRunner pairs are identical to the base. ON: **no committed tape's replay moves** (tapeRunner md5 identical), no producer `--check` moves; **one identity row moves: ENEMY census default** (below) |

## The one thing to know first

**The rooms never held spinners.** The refusal said *"level N tracks NO live spinner bodies"*, and that was the only
arm that asked for a live body. A `tset = -1` lock opens when `Game.totalEnemies() == 0` (`Puzzlements/Lock.as:111`,
`Game.as:1855-1882`). L60 counts two **jellyfish**, L71 five **lavarunners**, L99 three, and L98 three jellyfish plus
an **IceTurret**. The model stepped none of them. Five switches (`killLockBodies.js`, all OFF) now step those bodies,
kill them, and ledger the turret's corpse.

With every switch ON, the game agrees with the model on three recorded arms, at 0 px and tick for tick. The arms
cover both jellyfish rooms and the turret kill. On the turret arm the game **corrected the model**: the dark shield's
bump hits an IceTurret, which no model code did (K5).

**The user's call:** turn the switches ON, or some of them. ON moves no committed tape and no producer digest. It moves survey rows (the D3 table) and **one identity row, ENEMY
census default** (`d59f0c97` → `e7f4264c`):
- the `jellyfish` corridor arm goes REFUSED → **SOLVED 172 t**;
- `lavarunner`'s chamber arm goes 155 → 231 t (its corridor stays REFUSED);
- totals: CORRIDOR 5 → 6 solved, CHAMBER-at-control 17 → 16.

Per the DASHFLIP/LINEFLIP precedent this is **listed and stopped**, not acted on.

## W0 (at `0f952e9a9e`, a clean worktree of the base, its own server on 9441)

| row | command | BEFORE | AFTER (head, switches OFF) |
|---|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 | — |
| identity block | `SEEDLING_PORT=… bash scripts/procgen/identity-block.sh .` (venv) | log md5 `610dccf57c7282807b3bcd47db7db4a7` | `f1a48369d29ad3763d3afceb1ef2271f` — **every digest row identical**; the only differing line is the reference row (4 → 8, see below) |
| six `--check`s | in the block | `405d9c4b` · `8e7a43be` · `33d20889` · `35456fbc` · `6cd35fe1` · `a569eeec`, all exit 0 | identical, all exit 0 |
| kind pairs / censuses / levels | in the block | c3 `043e1944` · c6 `f85e7722` · c4 `4aa74add` · ENEMY `d59f0c97` · guard `a6d18d49` · AREA `02b22525` · killgate `01210c82`/`07ce222a`/`30a1e3e7` · levels `e28c1e5d`/`c4841acb` · generated set `OK` | identical |
| reference | `generate-procgen-reference.mjs --check` | 4 differ (registry, capabilities and their two regions) | after this slice's regeneration: **the same 4**. They need the non-Seedling submodules, which this checkout does not hold; the harvest regenerates them |
| surface / constants / entities / profile | each `--check` | GREEN 208 · PASS 5,327 · PASS 518 · PASS 138 | **GREEN 209** · **PASS 5,335** · **PASS 526** · PASS 138 (all `--write`n; rows below) |
| identity block ON | `SEEDLING_KILLLOCK_BODIES=all … identity-block.sh .` | — | log md5 `29b8afd108be2ec1ed2cc239f78f809d`: **only ENEMY census default moves** (`d59f0c97` → `e7f4264c`); every kind-pair/census/level row, the generated set and all six producer `--check`s are identical to OFF |
| roster | `fixtures/tapes/index.json` | md5 `df76e166414b685b23113394374e9989` | unchanged (no roster tape added) |
| tapeRunner | `(fullName, status)` sorted | 533, md5 `71bda323e8c6a709fecbfd0734ebf945` | 533, `71bda323…`; **ON: 533, `71bda323…`** |
| bounded vitest | the set below | **45 files / 1,887 tests green** | **47 files / 1,907 green** (+ `fidelityKillLock` 14, `seedlingEntityWitness` 5, `boxLock` +1 row) |

**The bounded set (46 listed).**
- The brief's list: `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`,
  `tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`,
  `fidelityArrival`, `fidelityAxe`, `contactFidelity`, `decisionTrace`, `entityBlocks`, `solverDeadline`,
  `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`,
  `seedlingSolverSurface`, `seedlingConstantsCensus`.
- Every `rg -a` hit for a function or field this slice touches (`bridgedChaserTags`, `isBridgedChaser`,
  `KILL_ARM_POLICY`, `MODELLED_KILL_ARMS`, `CHASERS`, `chaseImpulse`, `chaserStep`, `CORPSE_COUNTING`,
  `KILL_SIDE_WRITES`, `resolveKillStrategy`, `deriveKillByChaser`, `armIsModelled`, `strikePolicy`, `solverView`,
  `execKill`, `resolveObstacleStrategy`, `countedBodiesLeft`, `chaserKillLockOpens`, `strikeBodies`, `'chasers'`):
  `arrowTrap`, `botDriverV2`, `chasers`, `dangerMap`, `enemyDamage`, `entityRecords.agreement`, `fidelityF1`,
  `fidelityF1b`, `fidelityF4`, `fidelityProximity`, `iceTurret`, `l60Kill`, `levelRun`, `placedTalk`, `procgenRoam`,
  `procgenWeigh`, `r4Swim`, `r5Acceptance`, `shieldBossFight`, `solverBot`, `solverPrefix`, `twoPassSolve`.

## D1 — measure (PASS)

**What each room counts** (`Game.totalEnemies()` sums `classCount` over 25 classes; `Lock.checkEnemies` arms the lock
when the sum is 0):

| room | lock | bodies counted | stepped BEFORE? | why the work order saw none |
|---|---|---|---|---|
| L60 | `lock@128,80` | `jellyfish@120,112`, `jellyfish@56,64` | no: `CHASERS.jellyfish` is transcribed, but there is no `MODELLED_ENEMY_CLASSES` row | the press arm reads `spinnerBodies`, which is empty; the ceiling arm needs arrow traps (0) |
| L71 | `lock@112,192` | 5 × `lavarunner` | no transcription | the same |
| L98 | `lock@112,112` (the stairs) | 3 × `jellyfish` + `iceturret@104,24` | the turret is stepped (PROXIMITY); the jellyfish are not | refused earlier, on the chest's 1 px sliver (PROXIMITY residue 2) |
| L99 | `lock@80,96` | 3 × `lavarunner` | no | as L60 |
| L18 | `lock@144,112` | 2 × `spinner` | yes | — **already SOLVED** at the base (steps 27 and 38: 2 and 3 passes) |

**The game's truth for one room.** Before this slice the repo had a game recording of L60's kill
(`r5-l60-kill`), but its lock clear was a declared row. This slice's `killlock-l60-west` (D2) is a game recording in
which the model computes the clear. Its tick is the run's own removal ledger (t262, run clock) plus the `Lock`'s fade,
declared at 362, and the game crosses to L61 on the tick the model does (t483, 0 px).

**The IceTurret, read from the AS3.** `death()` consumes the first `destroy` (the corpse), so a kill alone never
moves `classCount(IceTurret)`. The corpse leaves only when a fatal tile destroys it. L98's turret centre (120,40) is
tile (7,2), **Water**, and `dieInWater = hits >= hitsMax` flips the update after the kill. So a sword kill drowns the
corpse, and `Mobile.death`'s fade removes it 11 ticks after the corpse forms (game: corpse t39, removed t50).

## D2 — the model and solver (PASS, behind five switches, all OFF)

**`killLockBodies.js`** (the `contactFidelity.js` pattern: `SEEDLING_KILLLOCK_BODIES=all|none|<keys>` in node, and
`withKillLockBodies` in a test; the browser has no hook):

| switch | what it does |
|---|---|
| K1 `jellyfishLive` | `bridgedChaserTags`/`isBridgedChaser` include `jellyfish`; the chaser terrain switch reads `ENEMY_CLASSES.jellyfish.terrain` (survives water and lava, never falls); `KILL_ARM_POLICY.Jellyfish.policy` is a getter → `modelled` |
| K2 `lavaRunnerLive` | a new `CHASERS.lavarunner` row (Bob's chase; `freezeSkipsUpdate`, since the whole update returns under `Game.freezeObjects`; `speedByTerrain` 1 on water or lava, 1.5 otherwise, chosen after the move for the next tick; `hitsMax` 2; a 9-frame die at rate 15); `CORPSE_COUNTING` and `KILL_SIDE_WRITES` rows |
| K3 `chaserKillArm` | `resolveKillStrategy` gains `arm: 'chaser'`, asked **after** the ceiling refuses (so every room the ceiling solves keeps its arm); `execKillByChaser` (below) |
| K4 `turretRemovalLedger` | a turret corpse's removal runs the kill-lock ledger (`assertChaserRemovalIsDeclared`, with removed turrets counted gone); `countedBodiesLeft` drops a removed corpse; `killIceTurretInPlace` |
| K5 `darkShieldIceTurret` | `Player.shieldBump`'s dark arm reaches an `IceTurret`: `hit(5, p, 0.5, "Shield")` behind the body's `hitsTimer <= 0` (damage, i-frame, the `hitByDarkStuff` latch). The plain shield's `knockback` is IceTurret's empty override, so it does nothing |

`MODELLED_KILL_ARMS` is frozen at import, so its two consumers (`levelRun`'s `enemyClassModelled`,
`strikePolicy.armIsModelled`) now ask `killArmModelled(as3)`, which answers at call time and is
`MODELLED_KILL_ARMS.includes` while everything is OFF. A fix found by the census: with K1/K2 ON, the census contact
scan tested a switch-bridged chaser's stale `.oel` placement (`contactPricing` still says `mover`), so steps 169 and
191 threw. A switch-bridged chaser in a stepped room is now skipped there, because `stepChasersNow` bills it live.

**`execKillByChaser`, per body (nearest first).**
- **The stance.**
  - If the player stands outside every live ice turret's range (128, truncated) and the body is inside its leash,
    the player stays where it is.
  - Otherwise `deriveKillByChaser` gives the stance, with a fallback to "here" when the body is in leash.
  - The walk to the stance is the loop's `walkTo`, re-derived (at most 3 times) only when the walk did not arrive.
- **The guarded dwell.** The one strike policy decides every tick. When it does not press and the nearest live body
  is within 18 px:
  - **with a shield**, step toward it: the bump keeps it off the box through the lapse of its i-frame, and leaves the
    player facing it for the press;
  - **without one**, step away in the last 8 ticks of its i-frame.

  A turret's range is a keep-out for a dwell that began outside it. Any hit refuses by name.
- **The end.** After the kills, the fades are waited out. A counted live turret is killed in place (K4; first, if
  the player already stands in its range). Then comes the ceiling arm's tail: the `chaserKillLockOpens` ledger plus
  `opensOnTick` is a model-sourced `PendingDeclaration`. The measuring pass stands until **both** clocks pass the
  clear tick, because the run clock led the tape by 35 on L60 and `twoPassSolve` refuses a declaration beyond the
  measured tape.

**Why the guard is needed (measured).** `Enemy.update` runs `hitUpdate(); hitPlayer();`, and the enemy updates
before the player. So the tick a struck body's i-frame lapses is a contact tick if it overlaps. A Bob (0.5 px/tick)
is still clear when its i-frame lapses. A jellyfish (0.8) is already back, and in water the player (0.45) cannot
outrun one.

**Game witnesses** (p4f headless, port 9440, `probe-seedling-killlock.mjs --record`; one `botMobiles()` sample per
game tick; `fixtures/killlock-witness/`; replayed by `fidelityKillLock.test.js`):

| arm | what | player | bodies |
|---|---|---|---|
| `killlock-l60-west` | step 112's staged boot: kill both jellyfish, the lock opens, cross to L61 | 484 obs, **0 px**; the crossing on t483 | removals t119 and t244, game = model; `hits`/`hitsTimer` equal at all 244 (tick, class) rows |
| `killlock-l98-jellies` | step 200's boot: the three jellyfish from the south, out of the turret's range, no hit | 331 obs, **0 px** | removals t222, t278, t330; 661 rows equal |
| `killlock-l98-turret` | step 200's staging booted at (112,12), the water pocket above the turret | 82 obs, **0 px** | hits 0 → 0.5 → 2.5 → 3 (dark shield, sword through the latch, dark shield), corpse t39, **removed t50**; 132 rows equal |

The sample clock is calibrated on the arms' moving ticks (shift 0). The first turret recording disagreed by a tick
(removal 50 vs 51), and the per-tick `hits` read made the dark shield visible. That reading is why K5 exists.

**Mutants** (predicted first, made by copy and restored, `cmp` verified):

| mutant | predicted | measured |
|---|---|---|
| M1: K5's block disabled | the turret arm red (its damage rows and removal t51 ≠ t50); the others green | **2 red** (the turret arm's damage and removal rows), 12 green ✓ |
| M2: a switch-bridged chaser's terrain set back to Bob's (dies in water) | L60 red | **6 red: all three arms** (the L98 jellyfish cross Water too). The prediction was a subset |

## D3 — census (PASS)

The 35 `--through=end` survey steps in levels holding a jellyfish, lavarunner or ice turret, run OFF (= the base)
and ON:

| step | level | OFF | ON |
|---|---|---|---|
| 112 | L60 | REFUSED *"no weapon — tracks NO live spinner bodies"* | **SOLVED 483 t** |
| 144 | L60 | REFUSED (the same) | **SOLVED 523 t** |
| 179 | L60 | REFUSED (the same) | **SOLVED 523 t** |
| 118, 152, 183 | L60 (east arrivals) | REFUSED (the same) | REFUSED by name: `jellyfish@56,64` is **pinned** on `lock@128,80`'s west face; its chase line to the player is blocked and a chaser does not path-find |
| 159, 190 | L71 | REFUSED (the same) | REFUSED: `lavarunner@64,224` is still in the world after the dwell's bound |
| 201 | L99 | REFUSED (the same) | REFUSED: no stance derives (the lavarunners sit on a lava island ~90 px off, out of their 80 px leash; every stance preview *"did not settle"*) |
| 191 | L80 | REFUSED: combat ladder exhausted | **SOLVED 666 t** (1 hit) |
| 66 | L45 | SOLVED 414 t | SOLVED 386 t |
| 168 | L78 | SOLVED 390 t | SOLVED 392 t |
| 169 | L77 | SOLVED 446 t | SOLVED 480 t (1 hit) |
| 160, 161, 162, 206, 207 | L75, L74, L75, L104, L105 | REFUSED: ladder exhausted | REFUSED, the same obstacle; the danger point moves by ≤ 1.6 px where a stepped body moved |
| 200 | L98 | REFUSED: the chest's sliver | unchanged (the chest is first on the route) |
| the other 16 | — | — | identical |

**10 → 14 of 35 solved.** The kill-lock family on the route is 9 rows (L60 ×6, L71 ×2, L99). **3 of them now
solve**; the other 6 refuse on a true name.

**The sweep.** The legs for these rooms (`seedling-divergence-legs.mjs`, 808 legs) are:
- 488 (L60 west → L61, blocks 16) and 487;
- 710 and 713 (L98 → L99 stairs, blocks 5);
- 716 and 717 (L99);
- 562–582 (L71).

The sweep and the bare pass run the production solve worker. The switches have no browser hook by design, so a
re-run there measures the OFF model by construction. The survey rows above are the node-side answer to the same
legs.

## The JS arc's pins and what it must wire

- **No signature or contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and
  `createRunForStaging` are untouched.
- New OPTIONAL fields on a resolved kill strategy: `arm: 'chaser'` and `contacts`. A new record shape is
  `{kind: 'kill', arm: 'chaser', phases: [{phase: 'chaser-kill' | 'turret-kill', …}]}`. No new
  `SolverRefusal.obstacle.kind`: they are `kill-lock`.
- **To wire:** `KILLLOCK_BODIES` (exported through `solverView.js`) must be settable in the worker and page when the
  user licenses a flip. Today they read the defaults.
- **To extend when K1/K2 flip:** `r8Acceptance`'s `R8_ENEMY_BRIDGE` scope. `assertBridgeRosterMatchesScope` asserts
  the derived roster equals the declared one, and ON adds `jellyfish` and `lavarunner`.
- Pins that moved: `r8Acceptance` "a transcribed class with no roster row is NOT bridged" now lists `lavarunner` in
  `CHASERS`; `boxLock`'s guarded list gains `probe-seedling-killlock.mjs`.

## Deltas

| artifact | delta |
|---|---|
| `seedling-solver-surface.json` | 208 → 209 rows: + `KILLLOCK_BODIES` (import, seedling/constant), + `killArmModelled` (import, seedling/function), − `MODELLED_KILL_ARMS` (its last family importer now asks `killArmModelled`), and line moves |
| constants census | 5,327 → 5,335 literals (8 new: the LavaRunner row and the executors' constants); 4 new `fields` rows (LavaRunner die frames/rate, `swimSpeed`, `normalSpeed`) |
| entity witnesses | 518 → 526 leaves. `chasers.lavarunner.*` (8) were measured with `--only` over today's 180-tape fast tier: **corpus-blind**, 0 moved and 0 threw at both magnitudes. The full `--write` was killed at its time limit. Rows are stated over the file's 139 tapes, all inside the 180; `partialRemeasure` says so |
| reference | `instruments.js` (+ the probe), `docsIndex.js`, and their two regions |
| docs | `seedling-bot.md` (the as-built paragraph after contact fidelity), `seedling-bot-log.md` (the entry + 2 trap candidates) |

## What the brief got wrong (measured)

1. **"L18: kill with no weapon cell/tick."** L18 **solves at the base**: steps 27 and 38, its spinners and the
   F1c/F5 press arm.
2. **"L60 ×5".** The survey on this base names **6** L60 rows (112, 118, 144, 152, 179, 183).
3. **"L98's stairs … count `classCount(IceTurret)` — the turret must DIE".** The lock counts `totalEnemies()`:
   **three jellyfish and the turret**. A turret's death alone does not move the count (`death()` makes a corpse).
   L98's turret moves it because it stands **on Water** and drowns.
4. **"IceTurret's kill arm: check `KILL_ARM_POLICY`".** It was already `modelled`. The missing piece was the
   **dark shield's** hit on it (K5), which the game showed. Without it the model was a tick late on the kill and the
   removal.
5. **"tracks NO live spinner bodies"** is not about spinners. These rooms have none; the press arm was simply the
   only live-body arm asked.
6. **The sweep "after"** cannot be measured ON without the JS arc wiring the switches into the worker (see above).

## Residue

1. **L98 end to end.** The jellyfish die from the south and the turret dies from the pocket above it. Both halves
   are witnessed. The walk between them crosses both spinning axes' sweeps (`spinningaxe@96,64` and `@128,64`, blades
   overlapping below the turret), and the ladder's axe rungs exhaust. The turret's below-stance is 20.6 px from both
   hubs and is filtered out by name. This belongs to AXE/LADDER.
2. **L60's east arrivals** (118/152/183): `jellyfish@56,64` pins on the lock's west face. No east-side cell reaches
   it with the sword (16 px). The game would do the same; the route arrives from the west.
3. **L71 / L99 lavarunners.** They are bridged (K2) but not witnessed on the game, and the kill arm does not solve
   these rooms. The lavarunners stay on their lava islands out of leash, and `deriveKillByChaser`'s previews
   *"did not settle"*. K2 does solve L80 step 191 and re-plans L77 step 169, but that is unwitnessed: **flip K2 only
   with a lavarunner witness**.
4. **`deriveKillByChaser`'s bound goes negative** when its forecast's own strikes kill the body during the approach
   (−180 on L60). The executor clamps it locally. The shared derivation is the combat ladder's, and is left alone.
5. **The witness probe's fast-tier CONTROL** reports one expectation divergence (`r5-l60-kill`) at the base and at
   head alike. It is pre-existing and was not investigated.
6. `check-procgen-help.mjs` ran on a throwaway worktree at HEAD while this slice was uncommitted (25 failed, base
   state, under heavy box load). `probe-seedling-killlock.mjs --help` prints and exits 0, and nothing runs on import.

## Rows to BANK

- `fidelityKillLock.test.js`: 14 rows (the switches OFF = BEFORE; three witnesses × player/damage/removal; L60's
  crossing; L98's 0 → 0.5 → 2.5 → 3 and the 11-tick drown).
- `probe-seedling-killlock.mjs` (default, node): **ALL CHECKS PASSED** (16 rows).
- The D3 table above (OFF/ON), `--through=end --only=<the 35>`.
- tapeRunner ON = OFF: 533 pairs, `71bda323e8c6a709fecbfd0734ebf945`.
- Identity block ON: the ENEMY census default row is the one licence-gated mover (`e7f4264c00bfb15d7bad2ec70a24e8ca`
  ON vs `d59f0c971d6d42e23fdc2c5ae08e9117` OFF).
