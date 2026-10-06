# SEEDLING FIDELITY — LADDER2: the combat ladder vs a placed grenade, a lava chain and a beam tower

Session `seedling-fidelity-ladder2` (cloud), planner `seedling-fidelity-planning-3`, wave 8 (model coverage).

| | |
|---|---|
| start SHA | `0f952e9a9e` (the WAVE-7 harvest, `fidelity-harvest/wave7`) |
| head | the commit that adds this report |
| harness branch | `claude/ladder2-combat-hazards-su7x98` |
| commits | D1 `46675bd` · D2 `071b343` · D2 fix `ad015eb` · D3 `181142f` · records fix `5964ef9` · this report |
| verdicts | **D1 PASS · D2 PASS (6 of the 7 target rows; the 7th is named residue) · D3 PARTIAL: grenade and beam witnessed; the chain has game evidence but no committed witness (STOP, named)** |

## The one thing to know first

Neither the grenade nor the chain nor the beam was missing a rung. Each was priced wrong:
- **The grenade has no contact.** `Grenade.update` never calls `super.update()`. Its only damage is one 20 px blast, 154
  updates after the player first comes within 32 px. The model priced it as a static contact and **threw** on its box.
- **The chain and the beam have exact clocks.** The chain's is `Game.time % 90`. The beam runs its own Spritemap at an
  **int** fps, and its side **turns** by `rate`.

Priced exactly, five of the seven target steps solve on pricing plus a stall. The game also corrected me once: the
beam ends at the **level's** edge, not at the 160 px screen.

## W0 (at `0f952e9a9e`, `SEEDLING_PORT=9460`)

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9460 bash scripts/procgen/identity-block.sh .` (venv active) | six `--check`s `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec`, **all exit 0**; ENEMY census `d59f0c97…` (the banked wave-6 value); log md5 **`610dccf5…`** (the `generated set` row re-run alone: my D1 probe held the box lock when the block reached it. Re-run: `OK`) |
| reference | the block's last row | **4 DIFFER** — `registry.js`, `capabilities.js` and two capability regions. In this box the five substrate submodules are uninitialised (`--seedling` bootstrap). `instruments`/`docsIndex` MATCH |
| surface / constants / entities / profile | the four `--check`s (surface + constants in a detached base worktree) | **GREEN 208** · **PASS 5,327 literals** · **PASS 518** · **PASS 138** (both) |
| roster | `fixtures/tapes/index.json` | **238** |
| bounded vitest BEFORE | 48 files (below), base worktree | **48 files / 2,554 tests, all green**; tapeRunner **534** pairs, md5 `5f76a855…` (`status\tfile\tfullName`, sorted) |

The 48: the brief's standing set (`r8Acceptance` and the roster pins included), AXE's set, and every `grep -a` hit for
a function or field I touch: `hazardDanger|staticEnemyDanger|dangerVolumes|dangerDuringTransit|dangerAt(|contactPricing|
CONTACT_STEPPED|stepContactsNow|previewWalk|DEADLINE_SITES|hazardVolume|grenade|lavachain|beamtower|BeamTower|LavaChain|
Grenade`. That adds `bossTotemFight`, `botDriverV2`, `combat`, `crusher`, `dangerMap`, `encounters`, `enemyDamage`,
`finalBossFight`, `finalBossRng`, `hazards`, `jsRuntimeSolver`, `levelRun`, `levelWorld`, `presses`, `shieldBossFight`,
`solverBot`, `solverBotLethalPit`, `turretSolver`, `fidelityProximity`, `seedlingFootprints`.

## D1 — measure on the game (PASS)

**The AS3** (`vendor/seedling` `f8d9bc1`). All three are added **after** the Player (`Game.as:2297/2298/2359` vs
`:2250`), so each updates first and tests the **pre-move** box.

- **`Enemies/Grenade.as`** (`new Grenade(x, y)`: `_active = false`, `_exTime = 60`):
  - It is born 48 px above its cell.
  - It arms when the player's entity point is within 32 px of `(x, endY)`, then falls at `v.y += 0.1`. ⛔ The falling
    branch sets `collidable = false`, and `Entity.collide` returns null for a non-collidable entity, so **the fall
    passes through walls**.
  - At rest it bounces `v.y = -v.y + 1`, counts 60, and plays `"explode"` (12 fps × 8 frames).
  - The callback is the blast: `FP.distance(x, endY, p.x, p.y) <= 20` → `p.hit(null, 2, (x, endY), 1)`.
- **`Puzzlements/LavaChain.as`**: `if (!Game.worldFrame(60, 2)) play("extend")`, and `reach()` runs while the anim is
  `extend`/`hit`. The arm is a 4 × 48 rect off the 16 × 16 body. ⛔ `levelWorld`'s row says *"Damages ENEMIES only"*;
  `:86-91` also hits the Player.
- **`Puzzlements/BeamTower.as`**:
  - `const animSpeed:int = 10 * speed`, an **int** (speed 0.25 → 2 fps).
  - The beam is up on each side's second frame.
  - `animEnd` on `sit` turns the side: `direction = (direction + rate + 4) % 4`.
  - `getLine` ends at `FP.width`/`FP.height`, which `loadlevel` sets to the **level's** size (`Game.as:2065`).
  - The bob `y += 0.3·sin(worldFrame(100, 2)…)` is applied after the fire test.

**The game, `probe-seedling-ladder2-phase.mjs`** (p4f headless, box lock). The oracle is
`seedling-fidelity-ladder2-evidence/ladder2-phase-oracle.json`: **13 arms, 64 PASS, K = 0 for every class.**

| arm | class | stood | game's knock | model K = 0 |
|---|---|---|---|---|
| l2-grenade-l59-walled | grenade (fall column is a wall) | (120,132) | f155 | f155 |
| l2-grenade-l63-walled | grenade (fall column is a wall) | (120,136) | f155 | f155 |
| l2-grenade-l75 | grenade | (80,188) | f155 | f155 |
| l2-grenade-l75-armed-clear | grenade, armed at 26 px | (80,202) | **never** | never |
| l2-chain-l79 / l72 / l75-c / l75-a | chain | in the arm | f34 (×4) | f34 |
| l2-beam-l104 | beam, rate 1, right | (120,56) | f5 | f5 |
| l2-beam-l104-up | beam, rate 1, **its 2nd side (up)** | (24,30) | f19 | f19 |
| l2-beam-l103-west | beam, speed 0.25, left | (168,248) | f79 | f79 |
| l2-beam-l103-mid | beam, rate 2, **its 2nd side (left)** | (108,200) | f86 | f86 |
| l2-beam-l103-east | beam, rate 2, right **past x 160** | (200,199) | f8 | f8 |

With D2's stepped grenade, the game never leaves the model on L59 and L75 (`modelDivergence −1`, 201 rows): the
blast's knockback is reproduced to the bit. L63 leaves it at f190, from a second, non-grenade hit (the game ends at
`hits 2`).

**What the measurement had to get past:**
- **L76's chain** read 120 frames off-phase. It is not the chain. L76's floor is tile 31, Igneous-to-Lava, and it
  crumbles under a standing player: a death and 20 dead frames every 46 live ticks (polled: `dead_frames` 20 → 40 → 60
  … at t46, 92, 138). That moves `Game.time` against the tape. The model reads tile 31 as plain floor
  (`levelWorld.js:369`). I dropped those arms.
- **L78's grenade arm** was knocked at f86 by something else. I dropped it.
- **L99's arm** stood in a wall. I dropped it.

**Why each rung refused, at the base** (`survey-seedling-route.mjs --through=end`; the brief's step numbers have moved,
since the route is now 221 steps):

| step | room | first danger | AVOID | DODGE | TIME / BAIT / KILL |
|---|---|---|---|---|---|
| 137, 139 | L59 | `enemy:grenade@112,112` *"a static "Enemy" body … priced "mover""* | the danger-forbidden corridor still probes it / no component | absent (not spits) | 215 px > 48 / *"roster is [empty]"* / *"not a body this run can watch die"* |
| 160 | L75 | `enemy:grenade@72,168` | same | absent | same |
| 162 | L75 | `hazard:lavachain@96,32` (the volume) | no corridor (the volumes cut the room) | absent | same |
| 164 | L76 | `hazard:lavachain@128,64` (the volume) | same | absent | same |
| 205 | L103 | `hazard:beamtower@144,200` (the volume) | same | absent | same |
| 206 | L104 | `hazard:beamtower@16,56` (the volume) | same | absent | same |

**Mutants** (predicted, then made by copy and restore; md5 `07ddb546…` and `86c554c1…` restored):

| mutant | predicted | measured |
|---|---|---|
| M1: the fall tests solids | 2 red (the fuse row, the 0 px row) | **2 red**, those two |
| M2: `beamAnimSpeed` not truncated | 1 red (the int-fps row) | **1 red** |
| M3: the chain's `loops` 1 | 1 red (the `% 90` row) | **1 red** |

## D2 — pricing and crossing (PASS, 6 of 7 targets)

- **The grenade is a stepped body.**
  - `combat.contactPricing('grenade')` is `stepped` with pricer `stepPlacedGrenadesNow`, so the census scan no longer
    throws.
  - `levelRun.stepPlacedGrenadesNow` (before the player, with the pre-move point) steps `placedGrenade.js`. It bills
    the blast through `applyPlayerHit` (`retaliate: null`) and logs `placedGrenadeEvents`.
  - `run.placedGrenades` and `run.grenadeForecast()` expose it.
- **The grenade's danger.** `dangerMap.grenadeDanger` is a new ingredient (g).
  - In TRANSIT it reads the **walk's own forecast**: `previewWalk` steps `run.grenadeForecast()` per sample, as it
    does the spits.
  - Without a forecast, no blast lands before `updates + 1 + fuse`. That is exact-safe, and too loose for long walks:
    step 137 refused under it, which is why the forecast exists.
  - The grenade leaves `staticEnemyDanger` and `dangerVolumes`.
- **Chain and beam.** `dangerMap.phaseHazardHit` prices each at update `tick − V` (`axeVisitClock`, whose refusals
  are the right ones) with `Game.time = run.gameTime + (tick − ticksCompleted − 1)`.
  - Timelines are memoised per (level, id, V, `Game.time` at V).
  - The test is inclusive (`Entity.collideRect`).
  - WAIT, and a refused clock, keep the volume. A beam with no `Game.time` widens by the bob.
- **The PHASE arm** (DODGE, rung 1⅓): conditional on every reason being a chain or beam.
  - It is AXE's search: the doorstep (`phaseHazardCanReach`, the union of every phase's rects), stalls of 1 … 89, the
    rest screen, and the bent-corridor fallback. It uses `PHASE_DODGE_RUNG = {...AXE_DODGE_RUNG, period: 90}` and
    the new site `phase-dodge`, appended. The AXE arm is untouched.
  - **`partial`**: when no clean stall exists, the arm keeps one that clears the phase hazards and leaves the walk's
    next danger (not a phase source, past the last phase reach) to the next probe.
  - Measured: 1,110 of step 162's stalls cleared the chains and then met `spinningaxe@80,144`.
- **The fix the game forced** (`ad015eb`): the beam ends at the level edge, and `createBeamTower` requires the level
  size. The first cut ended it at 160, and the step-205 plan priced under it was knocked at t112 (x 200). The knock is
  x-only, which is `beamtower@144,200`'s point.

**The survey** (the 24 route steps in the 13 rooms holding these classes, before at the base → after at head):

| step | room | before | after |
|---|---|---|---|
| 137 | L59 | LADDER `enemy:grenade` | **SOLVED 143 t** |
| 139 | L59 | LADDER `enemy:grenade` | **SOLVED 131 t** |
| 160 | L75 | LADDER `enemy:grenade` | LADDER `hazard:spinningaxe@80,144` (the axe's; AXE's arm refuses it) |
| 162 | L75 | LADDER `hazard:lavachain` | **SOLVED 387 t** (PHASE partial 34 t, then past the axe) |
| 164 | L76 | LADDER `hazard:lavachain` | **SOLVED 519 t** (no rung: the exact pricing alone) |
| 205 | L103 | LADDER `hazard:beamtower@144,200` | LADDER `hazard:beamtower@208,248`, the exact beam (832 previews, no stall or bend) |
| 206 | L104 | LADDER `hazard:beamtower` | **SOLVED 278 t** (PHASE partial 15 t) |
| 111 119 143 153 178 184 (L59), 168 170 (L78/L76) | | SOLVED | identical ticks |
| 146 150 166 167 181 201 207 211 212 | | REFUSED (other families) | identical refusals |

**Mutant M4** (the forecast ignored, `blasts` forced null): measured on the survey rather than a test row. Before the
forecast existed, step 137 read *"no earlier than its update 155 … at update 164"* and refused. The same pricing
without the forecast is that run.

## D3 — witnesses and census (PARTIAL)

**Game witnesses.** `plan-seedling-ladder2-witness.mjs` (+ `--check`, byte-identical) produces the solver's plans,
staged as the survey stages them. They were recorded on p4f with `check-seedling-bot-differential --record --only=…`.
The default compare reads **53 PASS / 0 FAIL**, and the game's `hits` 0 = the model's.

| tape | step | mechanism | ticks | game vs model |
|---|---|---|---|---|
| `ladder2-l59-grenade` | 137 | arms `grenade@112,112` (update 68) and leaves before its blast; no rung | 144 | **0 px**, 144 rows |
| `ladder2-l104-beam` | 206 | PHASE stall 15 t at offset 88 (partial), 56 obs inside the old volume, 0 beam contacts | 279 | **0 px**, 279 rows |

**Refuted on the game, kept as evidence and not committed as fixtures** (`LADDER2_REFUTED`, `--refuted`):
- **`ladder2-l75-chain` (step 162).** The game equals the model at **0 px through t160**, past all three chains and
  the stall. At t161 `LavaRunner` #2, at (52.8,127) directly above the player (`botMobiles`), knocks it south, and the
  model steps no LavaRunner. The tape and the game stream are in the evidence dir, and `fidelityLadder2` pins the
  divergence at 161.
- **`ladder2-l103-beam` (step 205).** The plan of the 160 px beam; the game's beam knocked it (above).
- **`ladder2-l76-chain` (step 164).** Diverges at t39 with 180 dead frames: the crumbling Igneous floor.

So the **chain has no committed witness**. Its game evidence is D1's four arms (f34, K = 0) and L75's recording to t160.
Every route crossing of a chain I could find also crosses a class the model does not step: L75's LavaRunners, or
L76's floor. L72's and L79's planned crossings route around their chains, so they witness nothing.

**The sweep's legs** (bare pass: `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks` gives 808 legs.
The 74 in the 13 rooms went through `seedling-divergence-bare.mjs --jobs=2`, before in the base worktree and after at
head, with a `--dump` from one leg of `probe-seedling-divergence-sweep.mjs --mode=bare` on :9460):

- before: **46 solved**; refusals: grenade 7, beamtower 5, lavachain 4, darktrap 8, axe 1, lavarunner 1, jellyfish 1,
  crusher 1;
- after: **58 solved**; grenade 0, beamtower 1, lavachain 1, axe 2, darktrap 8, the rest unchanged;
- no solved leg was lost, and no solved leg's ticks moved.

| leg | room | before | after |
|---|---|---|---|
| 471 476 477 478 479 483 | L59 | grenade | **solved** 295–317 t |
| 595 | L75 → L74 | grenade | axe (`spinningaxe@80,144`) |
| 598 | L75 → L71 | lavachain | **solved 393 t** |
| 600, 601 | L76 | lavachain | **solved 672 / 721 t** |
| 737 | L104 → L103 | beamtower | **solved 365 t** |
| 741 | L105 → L104 | beamtower | **solved 385 t** |
| 747 | L107 → L102 | beamtower | **solved 387 t** |
| 734 | L104 → L105 | beamtower | refused: the partial stall's continuation walks into `jellyfish@72,40`, a `mover` the run does not step, and `levelRun` throws by name |
| 585 | L72 → L71 | lavachain | lavachain (exact, after the PHASE search) |
| 730 | L103 → L104 | beamtower | beamtower (the exact beam, as step 205) |

⚠ This is the bare pass in node. The live inventory sweep (CI, the brief's Σ12) was not re-run.

## The JS arc: what it must wire, and the pins that moved

- `DEADLINE_SITES` gains **`'phase-dodge'`**, appended after `'walk'`. It is coarse (always asked) like `axe-dodge`, and
  asked only on a climb whose every reason is a chain or beam. The worker's `shouldStop` sees one more site name.
- `dangerDuringTransit` gains an optional 7th parameter **`grenades`** (`dangerAt` opts `grenades`), and a preview sample
  may carry `grenades` (the blasts its update fired). This is no contract change for `solveSegment` / `twoPassSolve` /
  `PendingDeclaration` / `createRunForStaging`, and there is no new `SolverRefusal.obstacle.kind`.
- New danger-source fields: `arm: 'chain'|'beam'|'blast'`, `phase {tag, updates, v, rect}`,
  `grenade {cx, endY, armed, updates, blastAt}`. A DODGE row may carry `phase` and `partial`.
- New run members: `placedGrenades`, `placedGrenadeEvents`, `grenadeForecast()` (and `gameTime` is now read by
  `dangerMap`).
- Roster **238 → 240** (`tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, with names).
- `r8Acceptance`: the stepped partition is 6 families with `grenade`; green, with no new enemy-exposure finding on the
  two tapes.

## Deltas

| row | before | after |
|---|---|---|
| identity block | `610dccf5…` (W0) | first AFTER (D2): two rows moved. The six `--check`s were identical. **`ENEMY census default` `d59f0c97…` → `6dba712c…`**: one row, the synthetic `grenade` CORRIDOR goes **REFUSED → SOLVED 138** (`CORRIDOR arm` 17/5/1 → 16/6/1). Reference 4 → 8 DIFFER, which was the new tracked scripts; regenerated, back to the same 4 environmental rows. The FINAL block (at `5964ef9`) is in *Rows to BANK* |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec` | **identical** |
| surface | GREEN 208 | **GREEN 216** (+ `run:gameTime`, `run:placedGrenades`, `run:grenadeForecast`, `placedGrenade.js` ×4, `r6AnimClock.js#FP_ELAPSED_CLAMPED`; all through `solverView.js`) |
| constants | PASS 5,327 | **PASS 5,359** (`placedGrenade.js`: 32 rule, 0.1 physics, 60 rule, 0.05 ×2 physics, the rest structural) |
| entities / profile | 518 · 138 | 518 · 138 |
| roster | 238 | **240** |
| tapeRunner pairs | 534, `5f76a855…` | **538**, `2997c25b…`. The diff is the 4 rows of the 2 new tapes, and every existing pair is unchanged |
| bounded vitest | 48 files / 2,554 | **49 files / 2,572** (+ `fidelityLadder2`) — final run in *Rows to BANK* |

## What the brief got wrong (measured)

1. *"Grenade = a `mover` (`combat.contactPricing('grenade')` refuses it)."* It has no contact at all. The `mover`
   verdict was the error, and it made `levelRun` throw on a box the game never tests.
2. *"LavaChain = transcribed avoid volume (I31: arms on the `worldFrame` phase)."* The phase is right. The volume
   widened the 4 px arm to 16 px and priced every phase, and `levelWorld` said it hurts enemies only. It hurts the
   player.
3. *"BeamTower = transcribed (beams on the `worldFrame` phase)."* The beam's firing is its own Spritemap; only the bob
   rides `Game.time`. The census volume also missed the int fps, the turning side (a rate-1 tower sweeps all four
   sides; rate 2 alternates), and that the beam ends at the level edge.
4. Step numbers: the route is now 221 steps. The ladder rows are **137/139 (L59), 160 (L75 grenade), 162 (L75 chain),
   164 (L76 chain), 205 (L103), 206 (L104)**, not 152/154/175/177/179/220/221.
5. *"step 175 (L75): its first danger is `grenade@72,168` alone."* Priced exactly, the grenade is no danger to that
   corridor, and its next danger is the L75 axe (now step 160).

## Residue

1. **Step 205 / leg 730 (L103).** The exact beam of `beamtower@208,248` (speed 0.25, one side, left) still cuts the
   corridor, and 832 previews plus 41 bent corridors did not clear it. Not diagnosed further.
2. **Step 160 / leg 595 (L75 → L74), leg 733 (L103).** The axe's (AXE's arm).
3. **Leg 585 (L72).** An exact chain hit after the PHASE search.
4. **Leg 734 (L104 → L105).** The partial stall's continuation walks into an unstepped `jellyfish`, and `levelRun`
   throws by name.
5. **A committed chain witness.** It needs the LavaRunner stepped (L75) or tile 31 modelled (L76).
6. **Tile 31, Igneous-to-Lava (L76)**, crumbles under a standing player (the `Tile.as:390` counter, in `render()`).
   The model reads it as floor. That is TERRAIN's region.
7. **The census volumes** still under-cover a turning tower (only its start side) and over-cover a chain (16 px). WAIT
   pricing still uses them. Fixing them moves WAIT stances in those rooms and needs a mover list.
8. **A grenade's removal** does not reach the room's roster (`classCount(Grenade)`); no model consumer counts one out
   today.
9. `check-procgen-help` was not run in full. Both new scripts were checked by hand: `--help` exits 0, and a bare
   import runs nothing.

## Byte-inertia

- Every producer `--check` is identical, no committed tape or expectation moved, and every existing tapeRunner pair
  is identical. The stepped grenade replays all 238 old tapes unchanged: none walks inside a blast.
- The pricing reaches only TRANSIT queries in rooms with a chain, a beam or a grenade, and the PHASE arm only climbs
  whose every reason is one. AXE's and the spit's arms are untouched.
- The one moved identity row is the enemy census's synthetic grenade corridor (above). It is an instrument row, for
  the user to re-bank.

## Rows to BANK

- `ENEMY census default` → `6dba712cbc4c766a186eefa08fd8096f` (corridor `grenade` SOLVED 138)
- roster **240**; tapeRunner pairs **538**, md5 `2997c25bfb5d8b64d2021b898ed39dc4` (`status\tfile\tfullName`)
- surface **GREEN 216**; constants **PASS 5,359**
- `probe-seedling-ladder2-phase.mjs` 13 arms, K = 0 ×3; `plan-seedling-ladder2-witness.mjs --check` 2/2 byte-identical
- survey LADDER rows in these rooms **7 → 2** (137, 139, 162, 164, 206 solve; 160 → axe; 205 stays); bare legs
  **46 → 58 / 74 solved**
- FINAL identity block and bounded vitest at head: FINAL_ROWS
