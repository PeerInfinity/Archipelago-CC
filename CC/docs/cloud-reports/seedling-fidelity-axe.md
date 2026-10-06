# SEEDLING FIDELITY — AXE: the combat ladder crosses a spinning axe by its phase

Session `seedling-fidelity-axe` (cloud), planner `seedling-fidelity-planning-3`, wave 6 (model coverage).

| | |
|---|---|
| start SHA | `88a7e4daa` (origin/main at checkout, a descendant of `9527592ac4`) |
| head | the commit that adds this report |
| harness branch | `claude/spinning-axe-ladder-t25gjb` |
| commits | D1 `5f9e317` · D2 `920bd3d` · D3 `218bf66` · this report |
| verdicts | **D1 PASS · D2 PASS (6 of the 10 survey steps; the other 4 are named residue) · D3 PASS** |

## The one thing to know first

The axe was not refused because a rung was missing. It was refused because the danger map priced it as the **disc** it
sweeps, at every tick. The blade is a single line whose angle depends only on the visit's tick count, and the game
confirms that clock exactly (six arms, offset 0). With that pricing, a crossing that turns **with** the blade outruns
it. One that turns **against** it is caught at every phase. That is why some corridors also had to be **bent**, not
only stalled. L61 is a pit room whose floor is narrow strips, and its shortest corridor turns against axe A.

## W0 (at `88a7e4d`, `SEEDLING_PORT=9370`)

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9370 bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`5bf108151ad7a075428d0ff20f15240e`** — the same md5 FRONTIER2 banked at `f90c4ee` |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724`, **all exit 0** |
| reference | the block's last row | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / entities / profile | the four `--check`s, in a detached worktree at `88a7e4d` | **GREEN 198** · **4,977 PASS** · **PASS 518** · **PASS 138** (both JSONs) |
| roster | `fixtures/tapes/index.json` `tapes` | **227** |
| tapeRunner pairs | `tapeRunner.test.js`, sorted `fullName\tstatus\n` | **511/511 passed**, md5 `0ce826422e03bda48b1733c7bd18a08f` |
| bounded vitest BEFORE | 30 files (below), in the base worktree | **30 files / 1,243 tests, all green** |

⚠ The identity block was started before my first edit landed. The only edits made while it ran were additive (new
exports in `hazards.js`, and a `dangerMap` branch that nothing could reach until the `dangerAt` call site changed).
The call site was changed only after the block finished. Its md5 equals FRONTIER2's banked one.

The 30 files are the brief's set plus every test that a `grep -a` for a touched function or field hits:
`r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `ropeSword`,
`shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`, `decisionTrace`, `entityBlocks`, `solverDeadline`,
`seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `hazards`,
`dangerMap`, `fidelityL14`, `jsRuntimeSolverShouldStop`, `crusher`, `r5SwimCloseout`, `turretSolver`, `solverBot`,
`levelRun`, `seedlingWasmPlayback`, `seedlingSolverSurface`, `seedlingConstantsCensus`.

## D1 — measure (PASS)

**The AS3** (`vendor/seedling` at `f8d9bc1`, read-only):
- `Puzzlements/SpinningAxe.as`:
  - `sprSpinningAxe.angle += spinRate` each `update()`. The counter is the entity's own, from 0 at the ctor, so it is
    not `Game.time`.
  - `a = -angle/180·π`.
  - The blade test is `collideLine("Player", x, y, x + 32·cos a, y + 32·sin a)`. If that misses,
    `collideRect("Player", x − 6, y − 6, 12, 12)` at the hub.
  - A hit is `p.hit(null, 5, …, 1)`: force 5, damage 1.
  - The hub collider is `setHitbox(8, 8, 4, 4)`, `type = "Solid"`.
- `Game.as`: the axe is added at `:2358`, after the Player at `:2250`. `World.addUpdate` prepends, so **the axe
  updates first and tests the player's pre-move box**. `World.update` runs inside `Game.update`'s `blackCover <= 0`
  gate.
- `Entity.collideRect` is inclusive (`:263-264`), so any contact with the 8×8 hub is inside the 12×12 test.
- `Entity.collidePoint` compares Numbers (`:294-295`), with no truncation of the sample.

**The model before.**
- `levelRun` bills **no** axe contact. Contrary to the brief, only the footprint and the census volume were
  transcribed, not the behaviour.
- `dangerMap.hazardDanger` priced `hazardVolume('spinningaxe')`: the 12×12 hub as a rect, plus a 32 px disc tested
  at the **box centre** (`volumeHitsBox`), at every tick, in both modes.

**The clock, on the game** (`scripts/procgen/probe-seedling-axe-phase.mjs`, p4f headless, oracle
`seedling-fidelity-axe-evidence/axe-phase-oracle.json`).

Each arm boots the survey's staging beside one axe and holds no key. The game's stream leaves the model's (which bills
no axe contact) on the frame the knockback moves the player. The model predicts that frame for each offset K as the
first f with `axeHitsPlayer(axe, f − V + K, box(obs f − 1))`.

| arm | axe (rate) | stood | V | game's first knock | K that fits |
|---|---|---|---|---|---|
| l61-a-south | `@64,144` (5) | (72,172) | 0 | f53 | **0** only |
| l61-a-north | `@64,144` (5) | (72,132) | 0 | f17 | **0** only |
| l61-b-south | `@160,80` (7) | (168,108) | 0 | f38 | **0** only |
| l61-door (from L60) | `@64,144` (5) | (63.3,168) | 10 | f57 | **0** only |
| l61-door-east (from L63) | `@160,80` (7) | (183.5,109.8) | 10 | f53 | **0** only |
| l101-west | `@80,224` (−5) | (68,232) | 0 | f34 | **0** only |

**Six of six on K = 0, and no other offset fits them all.** Frame f tests the box of observation f − 1 at update
f − V, where V is the arrival observation: 0 for a boot, the transition's `t` for a door.

Two first-cut arms looked like failures, and the measurements say why:
- **The truncation.** Using `crusher.collideLineSolid`, the west-door arm fitted K = +1 and the east one K = 0. The
  west-door player stands at x 63.3, so its box edges are fractional, and `collideLineSolid` truncates each sample
  before comparing. The game does not, and with the untruncated sample K = 0 fits both doors.
- **Arms inside a wall.** Three arms around axe B (`b-east/b-north/b-west`) booted inside the walls of its 3×3-tile
  pocket. They could not be knocked: `b-north`/`b-west` read `hits 1` with no movement. The probe now asserts a
  clear standing box. ⚠ `botStatus.hits` is the **final** health, not a hit count: the L101 arm was visibly knocked
  and reads `hits 0` at t160.

**Why each rung refused, step 128 (L61 → L62), at `88a7e4d`.** The same shape held on all ten steps except where
noted:

| rung | its refusal |
|---|---|
| AVOID | re-planned round the danger map's rects (the 12×12 hub only), and *"the danger-forbidden corridor STILL probes dangerous at (44.9,168.0) — hazard:spinningaxe@64,144 (… disc: the 32 px arm, swept)"* |
| DODGE | absent: not every reason was a `TurretSpit` |
| PULL | absent: no lane silencer in the room |
| TIME | *"the aim is 187 px away and `mover.MOVER_RANGE` … 48 px as an UPPER BOUND"* (it is 182–298 px on the ten steps) |
| BAIT | *"NO LIVE BODY's removal admits a corridor … [hazard:spinningaxe@64,144] … roster is [empty]"* |
| KILL | *"the danger on this corridor is not a body this run can watch die"* |
| DETOUR | absent: chaser-only |

Step 175 (L75) differs: its probe named the axe **and** `enemy:grenade@72,168`, and AVOID had no corridor.

**The change.**
- `hazards.js` gains `SPINNING_AXE`, `axeLine`, `axeHitsPlayer` (the blade, then the inclusive hub) and
  `collideLinePlayer` (`World.collideLine` against one box, with the sample left a Number).
- `axeCanReach` (the doorstep test) arrived with D2.
- `hazards.test.js` pins the six game frames as rows, the untruncated sample, and the inclusive hub.

**Mutant M1** (`axeHitsPlayer` on the truncating `collideLineSolid`): I predicted 1 red (the door row) and measured
**2**. The door row went red, and so did the truncation row, which also calls the default test, so my prediction missed
that detail. Made by copy and restore, md5 restored to `345b1a9e…`.

## D2 — the crossing (PASS for 6 of 10; the rest named)

**Pricing.** `dangerMap.hazardDanger(run, box, tick, mode)`:
- In **TRANSIT** it asks `axeHitsPlayer` at update `tick − V + AXE_UPDATE_OFFSET` (0). A preview sample tagged `tick`
  carries the pre-move box, which is exactly the box the axe tests.
- V comes from `axeVisitClock(run)`: the last transition's `t`, or 0. It is refused (and the disc kept) when:
  - the last transition arrives elsewhere;
  - a death (`run.ledger('playerDeaths')`) or an ending reboot lands at or after V;
  - any `run.deadFrameSpans` entry lands at or after V.
- A **WAIT** query keeps the disc.
- The source carries `arm` (`blade`/`hub`) and
  `axe {cx, cy, rate, period, updates}`.

**The ladder.** DODGE gains an **AXE arm**, conditional on every reason being an axe. The spit arm is untouched
(byte-identical for spit climbs). It does three things:
1. **Stall at the doorstep.** It takes the last sample before the hit whose box no hit axe can reach at any angle
   (`axeCanReach`). Without that, the stall offsets sat inside the reach, and every stall long enough to wait out the
   blade was hit by it: 0 of 10 solved. It then tries `offsets` walk-offsets back from there, stalls of 1 … period − 1
   ticks, each certified by the probe's own predicate.
2. **Screen the long stalls.** Once the player is at rest, a longer stall is the same walk later. One preview at
   `rest` (12) ticks prices every longer stall against the room's axes by arithmetic, and only a passing stall is
   previewed for real. The witnesses' `--check` stays byte-identical, and the bare pass gives the same 73 answers;
   total cost went from 461 s to 291 s.
3. **Bend the corridor when the planner's has no stall.** It calls `deriveChaserDetour` (via cells, shortest first,
   the `detour` deadline site) with a certifier that admits a corridor that is clean, or clean after an axe stall
   (`detourOffsets` 2, `detourPreviews` 60).

Then it drives the stall and returns **the rest of that corridor**, from the waypoint the preview stood on. A re-plan
would hand back the planner's shortest corridor, which is the one that was the problem.

`AXE_DODGE_RUNG = {step 4, offsets 8, detourOffsets 2, detourPreviews 60, rest 12, maxPerSegment 12}`. A new site,
`axe-dodge`, joins `DEADLINE_SITES` and is asked before each stall preview.

**Measured on the way.**
- Exact pricing plus the stall alone solved 2 of 10 (132, 178).
- The doorstep made no further difference by itself on L61. Its strips force the corridor past axe A's west side,
  against the blade's turn.
- A "round the reach" AVOID (forbid the reach square) never planned on L61 (a pit room). I removed it, and the survey
  results were identical without it.
- With the bent corridor, 6 of 10.

**Mutants** (predicted first, made by copy and restore; md5 restored `92a14db1…` / `8293011a…`):

| mutant | predicted | measured |
|---|---|---|
| M2 `AXE_UPDATE_OFFSET = 1` | 3 red: the offset row, the frame-53 row, the step-128 plan row | **3 red**, those three |
| M3 no doorstep (offsets start at the hit) | 1 red: the step-128 plan row | **1 red**, that row |

## D3 — witnesses and census (PASS)

**Game witnesses.** `scripts/procgen/plan-seedling-axe-witness.mjs` writes the solver's own plans, staged as the survey
stages them (`r8-solve-11`'s block re-pointed, with the route's keys and items). It also has a `--check`. The tapes were
recorded on p4f with `check-seedling-bot-differential --record --only=…`:

| tape | step | mechanism | ticks | game vs model | old disc entered | blade/hub contacts |
|---|---|---|---|---|---|---|
| `axe-l61-reach-l62` | 128 | 26 t stall at walk-offset 13, on a corridor bent through (120,152) | 284 | **0 px**, 285 rows | 47 obs, closest centre 16.4 px | 0 |
| `axe-l61-reach-l63` | 160 | 34 t stall at offset 23, bent through (40,168) (120,168) | 296 | **0 px**, 297 rows | 56 obs (A), 13 (B) | 0 |
| `axe-l48-reach-l49` | 78 | no stall, bent through (120,280) (136,264) | 368 | **0 px**, 369 rows | 61 obs, closest 15.4 px | 0 |
| `axe-l71-reach-l76` | 178 | **no rung**: the exact pricing alone certifies the planner's corridor | 327 | **0 px**, 328 rows | 2 obs, closest 31.8 px | 0 |

The game's own `hits` and `hits_timer` are 0 on all four. The model bills no axe contact, so a blade that reached the
player would have shown as a knockback divergence.

**The survey's 10 axe steps** (`survey-seedling-route.mjs --through=end --only=…`, before at `88a7e4d`, after at head):

| step | room | before | after |
|---|---|---|---|
| 78 | L48 → L49 | LADDER (axe) | **SOLVED 368 t, 0 hits** |
| 128 | L61 → L62 | LADDER (axe) | **SOLVED 284 t** |
| 132 | L61 → L60 | LADDER (axe) | **SOLVED 303 t** |
| 160 | L61 → L63 | LADDER (axe) | **SOLVED 296 t** |
| 166 | L61 → L60 (from L63) | LADDER (axe) | LADDER (axe B, `@160,80`) |
| 175 | L75 → L74 | LADDER (axe + grenade) | LADDER (**grenade alone**) — not this slice |
| 178 | L71 → L76 | LADDER (axe) | **SOLVED 327 t** |
| 195 | L61 → L63 | LADDER (axe) | **SOLVED 296 t** |
| 197 | L61 → L60 (from L63) | LADDER (axe) | LADDER (axe B) |
| 218 | L101 → L102 | LADDER (axe) | LADDER (axe `@80,224`) |

The other nine steps in axe rooms (87, 117, 174, 177, 186, 205, 207, 224, 229) are **identical** before and after.

**The sweep's axe-room legs** (bare pass: `seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`, 799
legs. Its 73 legs in the nine axe rooms went through `seedling-divergence-bare.mjs --jobs=4`. The `--dump` is from
one leg of `probe-seedling-divergence-sweep.mjs --mode=bare` on :9370):

- before (base worktree): 33 solved / 40 refused, **16 on an axe**;
- after: **40 solved / 33 refused, 8 on an axe**.

| leg | room | goal | before | after | ms after |
|---|---|---|---|---|---|
| 469 | L54 | `r27c8 → L52` | axe | axe (*"the danger map forbids (136,456)"*: a static forbid at the goal) | 58 |
| 492 | L61 | `r0c7 → L62` | axe | **solved 448 t** | 22,718 |
| 493 | L61 | `r0c7 → L63` | axe | **solved 462 t** | 15,219 |
| 494 | L61 | `r0c7 → L60` | axe | **solved 330 t** | 741 |
| 496 | L61 | `r0c7 → L63` | axe | **solved 165 t** | 147 |
| 497 | L61 | `r0c7 → L60` | axe | axe (B) | 18,867 |
| 498 | L61 | `r0c7 → L62` | axe | axe (B) | 16,917 |
| 564 | L71 | `r0c6 → L75` | axe | axe | 64,803 |
| 565 | L71 | `r0c6 → L80` | axe | axe | 38,271 |
| 567 | L71 | `Level 071 - Chest` | axe | axe | 42,933 |
| 569 | L71 | `r0c6 → L80` | axe | **solved 415 t** | 656 |
| 570 | L71 | `r0c6 → L72` | axe | **solved 390 t** | 2,243 |
| 578 | L71 | `r0c6 → L72` | axe | **solved 235 t** | 943 |
| 593 | L75 | `→ L74` | axe | **grenade** | 253 |
| 717 | L101 | `r4c2 → L102` | axe | axe | 25,260 |
| 731 | L103 | `→ L102` | axe | axe | 31,350 |

⚠ This is the **bare** pass (no inventory) in node. The brief's Σ31 is the live inventory sweep (CI), which this
session did not re-run. The legs the J2 walker crossed include L61 `→ L60`; leg 494 now solves.

## The JS arc: what it must wire, and the pins that moved

- `DEADLINE_SITES` gains `'axe-dodge'`, after `'detour'`. The worker's `shouldStop` sees one more site name. The
  generic rows of `jsRuntimeSolverShouldStop.test.js` are green, and the `solverDeadline` pin is updated here.
- A danger source of kind `hazard` may now carry `arm` and `axe {cx, cy, rate, period, updates}` (optional fields).
- A DODGE trace row may carry `axe`, `previews`, `vias`, and `stall: null` (a bent corridor with no stall).
- No `solveSegment` / `twoPassSolve` / `PendingDeclaration` / `createRunForStaging` contract change, and no new
  `SolverRefusal.obstacle.kind`.
- Roster **227 → 231**. The pins `tapeEnvelope`, `observationTolerance` (names and `swapped`) and
  `dialogueAutoAdvance` are updated with the four names.
- ⏱ **Cost.** A refused axe climb is now expensive in the bare pass: up to ~65 s per leg, where it was ≤ 2 s. A solved
  one costs up to ~23 s (it was refused in ~0.1–2 s). Live, the `axe-dodge` and `detour` sites bound it under the
  worker's deadline.

## Deltas

| row | before | after |
|---|---|---|
| identity block (md5) | `5bf10815…` | `438f1902…` at `218bf66`. **One measured row moved: `ENEMY census default`** `68466067…` → `cdff409e…`. The reference row read *"2 DIFFER"* because `instruments.js` counts only TRACKED scripts, and the witness planner became tracked in D3. Regenerated with this report, `--check` reads MATCH |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724` | **identical** |
| reference | MATCH | MATCH (regenerated: `instruments.js`, `docsIndex.js`, and the `architecture.md` / `README.md` regions) |
| surface | GREEN 198 | **GREEN 200**: + `run:deadFrameSpans` (physics / event-ledger), + `run:endingReboots` (seedling / event-ledger), site counts |
| constants / entities / profile | 4,977 · 518 · 138 | 4,977 · 518 · 138 |
| roster | 227 | **231** |
| tapeRunner pairs | 511, `0ce82642…` | **519**, `8e1a5c2d…`. The diff is the 8 added rows of the 4 new tapes; every existing pair is unchanged |
| bounded vitest | 30 files / 1,243 | **32 files / 1,784 green** (the 30, plus `fidelityAxe` and `tapeRunner`) |

**`ENEMY census default` moved, and the move is the change working.** `census-seedling-enemies.mjs` stages each class
in a synthetic CHAMBER and a CORRIDOR. The chamber's `spinningaxe` row goes **REFUSED → SOLVED 155**, the control's
own tick count: the axe was never on the route, and the disc had made it an obstacle. The corridor arm still refuses.
The CHAMBER summary goes 21/3/2 → 22/2/2. This is an instrument row, not a committed tape or a producer `--check`.
It is for the user to re-bank.

## What the brief got wrong (measured)

1. *"`SpinningAxe` is a TRANSCRIBED class (footprint + behaviour)."* Only the footprint and the census volume are.
   `levelRun` bills no axe contact. The model is silent on a hit, which is why a 0 px recording is the witness.
2. *"The gap is the solver's crossing, or the danger map's pricing."* It was **both**. Pricing alone solved 2 of 10.
   The crossing needed a stall at the doorstep **and** a bent corridor, because the side you pass the hub on is a
   property of the motion (with or against the blade), not of a distance.
3. The census volume's `exactness: 'exact'` disc is tested at the box **centre** against r = 32. A box whose centre
   is 32–35 px away can still be reached by the blade, so the disc under-covers at its rim. It is still what a WAIT
   query uses (residue 4).
4. Step 175 (L75) was not an axe step in the end. With the axe priced exactly, its first danger is `grenade@72,168`
   alone.
5. The J2 walker's L61 crossing `out_teleporter_0_160` corresponds to the `r0c7 → L60` legs. Leg 494 solves now. The
   survey's 166/197 reach the same door from the **L63** side, under axe B, which the walker did not show.

## Residue

1. **L61 166/197 (west under axe B, rate 7).** The only east–west strip runs 16 px under B's hub. Walking west turns
   against the blade: it meets the player every ~33 ticks, and the strip crossing takes ~43. All stalls failed
   (6,324 previews before the screen), and the detour bound ran out. This looks like a **dash** question, not a stall:
   the open question is `planSwordDash` inside the AXE arm.
2. **L101 218 / leg 717, L103 731, L71 r0c6 564/565/567.** These are still refused on an axe after the stall search and
   60 detour candidates. They were not diagnosed further in this session.
3. **L54 469.** *"the danger map forbids (136,456)"* is a static forbid near the goal teleporter (128,464), next to
   the hub. That is a different site from the ladder (the hub rect, or the WAIT disc, at the goal).
4. **The WAIT disc** under-covers at its rim (above). Changing it moves WAIT stances in axe rooms, so it would need a
   measured mover list.
5. **`crusher.collideLineSolid` truncates the sample**, and the game does not (D1). It is shared by the crusher and the
   **spinner hammer**. A player at a fractional x can be hit a frame earlier or later than the hammer pricing says.
   I left it unchanged, because fixing it could move committed spinner tapes (L18 and others). It needs the
   flag-and-measure treatment.
6. **The model bills no axe contact.** A walk that is hit diverges from the game silently in position. Transcribing
   `hitPlayer` (force 5, its knockback point) into `levelRun` is the remaining model half.
7. **Cost**, above: a refused axe climb can take ~65 s with no deadline. The CPU profile I attempted captured only the
   bare pass's parent process, so the cost is measured but not attributed.
8. `check-procgen-help` was not run in full. The two new scripts were checked by hand: `--help` exits 0, and a bare
   import runs nothing.

## Byte-inertia

- Every producer `--check` is identical, no committed tape or expectation moved, and every existing tapeRunner pair
  is identical.
- The pricing change reaches only a TRANSIT query in a room with a `spinningaxe`, and the AXE arm only a climb in
  which every reason is an axe. Spit DODGE climbs are untouched.
- The one moved identity row is the enemy census's synthetic axe chamber (above).

## Rows to BANK

- `ENEMY census default` → `cdff409e419bb21137bcf2c27d2c1b89` (chamber `spinningaxe` SOLVED 155)
- roster **231**; tapeRunner pairs **519**, md5 `8e1a5c2dce3b6093df40070a50132923`
- surface **GREEN 200**
- `plan-seedling-axe-witness.mjs --check` 4/4 byte-identical; `probe-seedling-axe-phase.mjs` 6/6 arms, K = 0
- survey axe steps **6/10 SOLVE** (78, 128, 132, 160, 178, 195); bare axe-room legs **40/73 solved, 8 axe-refused**
