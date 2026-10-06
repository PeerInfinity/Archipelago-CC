# Seedling fidelity TERRAIN: the 18 "terrain" divergences are contact knockbacks — two wallflyer rules and a live drill

**Slice:** `seedling-fidelity-terrain`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-3`), wave 6 (the first model-coverage wave).

⚖ **The user** (2026-10-05): *"The first priority is to expand the model to include everything in the game."* A FULL FIX slice (measure + fix); re-records are not pre-licensed.

| | |
|---|---|
| Started from | `origin/main` @ **`88a7e4daa4`** (≥ `9527592ac4`, wave 5 merged) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-terrain-divergence-1uwxze` (the harness branch IS the slice branch; no local `seedling-fidelity-terrain`) |
| Commits | D1 `4101746` · D2 `33f7cde` · D3 `7d9e7fc` · records + this report |
| Dev servers | `serve-nocache.py 9400` (this tree), `9401` (the pristine BEFORE worktree `/home/user/wt-base` @ `88a7e4d`), `9402` (an all-switches-ON copy, `/home/user/wt-on`, measurement only) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS for W2 + W3 (ship ON) · D3 STOP for W1 (two movers, licence needed)** |

## The one thing to know first

**These rows are not terrain, and they are not collision resolution. Every reproduced row is a contact knockback.** At the divergence tick itself, one side's `hits` goes 0 → 1 and the other side's doesn't. Three different bodies cause them:

| body | rows | what was wrong | rule |
|---|---|---|---|
| **WallFlyer** (L22, L25, L27) | 5 | the model's trigger ray truncated every sampled point (W1); the player's sword never reached a wallflyer in the model (W2) | W1 `collideLinePointsExact`, W2 `wallFlyerSwordHits` |
| **Drill** (L88) | 4 | the model had no drill at all (a `mover`, billed nowhere) | W3 `drillLive` |
| **BobSoldier** (L30) | 2 | unmodelled (a chaser with a spinning-sword `collideLine` attack) | residue |
| nothing within 40 px (L71) | 1 | the spinning axe (no Mobile row) | residue, AXE's region |
| none: the arrival frame (L74) | 1 | the game holds the player at t1, the model at t2 | residue, ARRIVAL's region |

**W2 and W3 ship ON.** At the shipped defaults, the identity block, all six producer `--check`s, the tape roster and 47 bounded test files are byte-identical to W0. **W1 stays OFF**: it alone moves the `r9-campaign` producer (`r9-solve-18` 510 → 519 t) and two unit pins. It is stopped for a licence. On the game at the shipped defaults, **7 of the 9 table legs that left their plans now play on plan**: 243, 251, 269, 283, 659, 661 and 666. #264 still leaves (it needs W1), and #663 is a named refusal.

## W0 (at `88a7e4d`, before any edit, in the pristine worktree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9401 bash scripts/procgen/identity-block.sh .` in `/home/user/wt-base` (`git worktree add --detach … 88a7e4daa4`; `node_modules` and the eight submodules SYMLINKED to this checkout's, which are at the same gitlinks) | log md5 **`2a0db7c4ce602f0a4489569593eac2f9`**; every row in the AFTER table below |
| six `--check`s | the block's producer loop | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1` + `r9-campaign 56bb3724`, **all exit 0** |
| reference | the block's last row | `4 GENERATED MODULE(S)/REGION(S) DIFFER` at BOTH trees (the BEFORE worktree's own; quoted, not chased) |
| tapeRunner | inside the bounded vitest | **511/511**, sorted `(fullName, status)` md5 **`c50a18ce044426768bce014c1f8d8c68`** |
| surface / entities | `census-seedling-solver-surface.mjs --check` / `witness-seedling-entities.mjs --check` | **GREEN 198** / **PASS 518** (both trees) |
| constants | `census-seedling-constants.mjs --check` | PASS (5,027 literals) |
| roster | `fixtures/tapes/index.json` | **227** |
| bounded vitest BEFORE | 32 files (the brief's list: `r8Acceptance`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `ropeSword`, `shoveWeighParity`, `watchGenOverlay`, `watchOverlays`, `r5Shaft`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `tapeRunner`; plus every `grep -a` hit for what I touch: `bossTotemFight`, `crusher`, `levelRun`, `presses`, `r5Totem`, `shieldBossFight`, `solverSpinnerKill`, `spinner`, `wallFlyer`, `chasers`, `combat`) | **32 files / 1,864 tests, all green**, md5 `09868808…` |

⚠ `bobBossFight.test.js` does not exist; the BobBoss's `collideLine` call site is covered through `tapeRunner`'s BobBoss tapes.

## D1 — the instrument (PASS)

**`probe-seedling-contact-divergence.mjs`** (new; headless p4f, box lock, `boxLock`'s `guarded` list) serves sweep legs exactly as `probe-seedling-divergence-sweep.mjs` does: the sphere's grants, a host jump, then `engine.walkTo`. Meanwhile **`seedlingContactLab.js`** (in-page; it wraps the JS arc's `seedlingDivergenceLab.js`, read-only) runs a MessageChannel loop between the game's frames. Each turn reads `botMobiles()` + `botStatus()` and keeps the FIRST sample of each game tick. That gives:
- the player's x, y, vx, vy, hits, hits_timer;
- every body's class, position, velocity and enemy `hits_timer`.

The model's run for the settled plan is rebuilt from the request (the lab's own `modelRows` recipe) and read after every tick, including the chasers and wallflyers.

`--capture=<dir>` writes a leg's solve request, its room records (Maps and Sets tagged), the plan and every sampled tick. **`replay-seedling-contact-capture.mjs`** (new, node, no box) rebuilds the model's run from a capture and compares the player tick by tick. Before any rule existed, it reproduced the browser model's rows exactly up to each divergence. That is what makes the captures committable game witnesses.

**Sampling coverage:** 21/22, 50/51, 54/55, 63/63, 68/69, 82/83, 106/107, 144/144 ticks. The sampler misses at most the last tick.

**Measured (17 legs re-served on p4f; ≥ 4 table rows reproduced, 13 of them):**

| leg | room · goal | first differing tick · fields | the body | game side at that tick |
|---|---|---|---|---|
| 243 | L22 → L21 from (16,128) | **t52** x, y, vx, vy, **hits** | `wallflyer@64,80` at (83,88) | the game's flyer is still in its i-frame (`hits_timer` 24): the player struck it at t46 |
| 251 | L22 → L21 from (96,176) | **t60** y, vy, **hits** | `wallflyer@64,80` | same: the model bills a contact the game's i-frame refuses |
| 264 | L25 → L26 from (128,32) | **t80** x, y, vx, vy, **hits** | `wallflyer@48,48` | the model's flyer is 4 px BEHIND (launched t75 vs the game's t74) |
| 269 | L25 → L28 from (16,96) | **t55** x, y, vx, vy, **hits** | `wallflyer@48,48` | the game's flyer was struck at t51 (`hits_timer` 30, `v` reversed); the model's flew on and hit |
| 283 | L27 → L26 from (160,32) | **t19** x, y, vx, vy, **hits** | `wallflyer@192,48` | the model's flyer is 4 px AHEAD (launched t12 vs the game's t13) |
| 659 / 661 | L88 → L87 from (96,288) | **t48** y, vy, **hits** | `Drill` at (104,168) | the drill hopped (120,184) → (104,168) on t47; the model has no drill |
| 663 | L88 → L12 from (32,16) | **t104** y, vy, **hits** | `Drill` at (136,136) | same family |
| 666 | L88 → L12 from (192,16) | **t53** y, vy, **hits** | `Drill` | same family |
| 309 | L30 → L28 from (224,80) | **t66** x, y, vx, vy, **hits** | `BobSoldier` at (50.8,92.6), `hits_timer` 14 | an unmodelled BobSoldier's sword |
| 308 | L30 Torchpickup from (176,48) | **t67** | `BobSoldier` | same |
| 576 | L71 → L75 from (224,288) | **t141** x, vx, **hits** | no Mobile within 40 px | the spinning axe (`spinningaxe@256,144`; not a Mobile) |
| 589 | L74 Darkshield from (288,128) | **t1** y, vy (no hits) | none | the game holds the player still at t1 and moves −2.15 at t2; the model moves at t1 and holds at t2. A frozen frame one tick apart, on a button, at the arrival |

**Not reproduced at this base:**
- L16 174/184: the solver now refuses them, as the brief's "not reproduced" note said.
- L88 660: crosses.
- L30 305: done.
- L30 312/316 (Torchpickup t2/t4): the divergence is in the post-pickup CONTINUATION. The capture pairs plays to solves by order, so it compared the wrong play. That is an instrument limit, recorded as residue.

## D2 — the rules (PASS)

All three live in `contactFidelity.js`. They are read at CALL time, so `SEEDLING_CONTACT_FIDELITY=all|none|<keys>` (node only) or `withContactFidelity({…}, fn)` (tests) sets them without an edit.

**W1 — `collideLinePointsExact` (`crusher.collideLineSolid`).**
- The AS3: `World.collideLine(type, fromX:int, fromY:int, toX:int, toY:int, …)` casts only the four end points. It then steps `x:Number`, `y:Number` and calls `collidePoint(type, pX:Number, pY:Number)` → `Entity.collidePoint(…, pX:Number, pY:Number)` (`World.as:389,411,434`).
- The model truncated every sampled point. Against a solid with integer bounds the two agree for every non-negative point. Against the player's fractional box they do not.
- A horizontally launched flyer's `vy = −4·sin(π) = −4.9e−16` makes its ray's `toY` cast to y − 1. So the game's ray falls from y to y − 1 across 160 px, while the model's sits at y − 1 from its first step.
- L27: the player's box bottom is 55.65 and the game's ray is at y ≈ 55.8 → the game launches on t13, the model on t12. L25 is the mirror (x), and launches a tick late.
- ⚠ `crusher.js`'s docblock said *"`collidePoint`'s own `int` truncation is what quantises them"*. The source says otherwise.

**W2 — `wallFlyerSwordHits` (`levelRun` press arm + `presses.pressRespondersIn` passes `family`).**
- A wallflyer is `type = "Enemy"` and in `Player.hitables`. The slash reaches it through `genericHit`'s `e is Enemy` arm: `Enemy.hit(5, Point(x, y), d, "Sword")` → `hits += d`, `hitsTimer = 30`, and `WallFlyer.knockback`, which is `v = −v`.
- The model's press census synthesized live responders for the bridged chasers ONLY. A swing at a wallflyer therefore reached nothing: not even `KILL_ARM_POLICY.WallFlyer`'s `refused`. It was a silent zero.
- Flag ON: `chaserPressBodiesNow` adds the room's wallflyers (`family: 'wallflyer'`). The arm runs `slash()`'s reach gate and `collideLine("Solid")` line of sight (a WallFlyer is not a `Flyer`, so it gets no waiver), then `wallFlyer.hitWallFlyer`.
- A KILL is refused by name, as the dark suit's retaliation already was.

**W3 — `drillLive` (new `drill.js`, `levelRun.stepDrillsNow` in the wallflyers' slot).**
- `Drill.as`, transcribed:
  - the `Game.freezeObjects` return above `super.update`;
  - `Enemy.update`'s off-screen gate, then `Mobile.death`'s fade, `hitUpdate` and `hitPlayer` (a 10×10 box, origin 5, `p.hit(this, 3, …, 1)`);
  - the hop: sit, `d ≤ 48`, line of sight, ±16 per axis toward the player, each axis tested against `solids`;
  - the anims: drill [5, 20] → undrill [4, 20] → sit; hit [2, 20, loop]; die [6, 10] → `destroy`;
  - `Enemy.hit` with the empty knockback.
- The contact goes through `applyPlayerHit`. The dark suit retaliates into it.
- A KILL is **staged**: "die", then `destroy`, then the 0.1-per-tick fade and removal. The kill-lock ledger is computed (`killLockLedger`) and a kill that opens a lock is refused.
- Admitted only in a room whose ONE census enemy is one drill (L88), so `Drill.solids`' `"Enemy"` term meets nothing. L28 (two drills + a BobSoldier) and L91 (a drill + three bobs) are unchanged.
- ⚠ The first cut REFUSED the kill. Played ON on the game, that made the solver decline L88 #659/#661, whose plans strike the drill three times. Staging it made both play on plan.

**The witnesses** (`fixtures/contact-witness/`, 13 captures, the leg's own room only, ~840 KB) and **`contactFidelity.test.js`** (46 rows):

| | W1 alone | W2 alone | W3 alone | all three | shipped (W2+W3) |
|---|---|---|---|---|---|
| 243, 251, 269 (struck flyers) | t52 / t60 / t55 | **0 px** | — | **0 px** | **0 px** |
| 264, 283 (the ray) | **0 px** | t80 / t19 | — | **0 px** | t80 / t19 |
| 659, 661, 663, 666 (L88) | t48 / t48 / t104 / t53 | — | **0 px** | **0 px** | **0 px** |
| 308, 309, 576, 589 (residue) | — | — | — | t67 / t66 / t141 / t1 | same |

The `—` cells were not separately pinned; the test pins "every switch EXCEPT its own leaves it at the named tick".

**Mutants** (predicted first; copy → edit → replay → restore; md5 `drill.js d8402f57…`, `levelRun.js 1508a3fe…` restored):

| mutant | predicted | measured |
|---|---|---|
| each switch OFF with the other two ON (in the test) | its own rows return at their ticks, nothing else | exactly that (the 9 `except its own` rows) |
| M-a: drill `contactForce` 3 → 2 | the 4 L88 rows red at their contact tick, the rest unchanged | **4** (t48, t48, t104, t53; Δ 1 px a tick), the rest PASS |
| M-b: the W2 arm's reach gate removed | no witness changes (every swing on these legs is in reach) | **0**: ⚠ the gate is exercised by NO witness, a coverage hole |

## D3 — witnesses + movers (W2 + W3 PASS, ship ON; W1 STOP)

**Movers with ALL THREE ON** (`SEEDLING_CONTACT_FIDELITY=all`):

| Row | OFF (= W0) | all ON | movers |
|---|---|---|---|
| tapeRunner, the full roster in node | 511, `c50a18ce…` | **511 green, `c50a18ce…`** | **none** |
| `solve-seedling-r8-battery --check` | `405d9c4b…` exit 0 | **`405d9c4b…`**, all checks green | none |
| `r8-d2-chain` / `r8-l18` / `r8-tail` / `r9-l3` | `8e7a43be` `33d20889` `35456fbc` `6cd35fe1` | **identical**, all green | none |
| `r9-campaign --check` | `56bb3724` exit 0 | **exit 1, `5aa27ba3…`**: 5 failures | **`r9-solve-18` 510 → 519 t** (DRIFT, artifact and trace); the chain sum 10923 → 10932; `r9-solve-19`'s declared `seam.time` 10470 vs 10479. **W1 alone** gives the identical log (`5aa27ba3…`); at the shipped defaults (W2 + W3) it is `56bb3724` exit 0 |
| bounded vitest (the 32 + 14 more: `encounters`, `entityRecords`, `fidelityStepOff`, `gameClock`, `turretSolver`, `seedlingBossLockCensus`, `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `jsRuntimeWalker`, `jsRuntimeSolver`, `wasmArrival`, `solverBot`, `enemyDamage`, `playerDamage`) | green | **two red, both W1's** | see below |

**W1's three movers (the licence request):**
0. **The `r9-campaign` producer:** `r9-solve-18` (L18, a spinner room) re-plans **510 → 519 t**, so the chain sum moves 10923 → 10932 and `r9-solve-19`'s declared `seam.time` must follow (10470 → 10479). This is a re-record of `r9-solve-18` (and its successor's seam), which needs a licence.
1. `solverSpinnerKill.test.js` *"F2 — a lock-less spinner on the walk, post-sword (5,5): … SOLVES in 241 t by a press kill"* → **221 t**. A spinner's own `collideLine("Player", …)` ray (`spinner.js:667`) goes through the same function.
2. `seedlingCanCross.test.js` *"cannot: L22 from L25 toward L29, bare — EXHAUSTED on a static wallflyer"*. The verdict is still `cannot`, but the cause becomes a re-planned corridor stall (`obstacle: null`, "waypoint 0 (88,88): not reached within 400 ticks"). Measured per switch: only W1 moves it.

Pins 1 and 2 are values the model computes about itself. Mover 0 is a committed producer artifact. The licence would cover: flip `collideLinePointsExact`, re-record `r9-solve-18` (+ `r9-solve-19`'s seam), and re-pin 1 and 2; witnesses #264 and #283 then reproduce at the default. ⚠ None of the three movers has been played on the game, so whether 519 t or 221 t is the game's number is not measured. Replaying the committed `r9-solve-18` tape stays green under W1 (tapeRunner is unmoved): the tape still plays, and only the solver's re-plan differs.

**W2 + W3 alone** move nothing: the same 47-file / 2,340-test set is green at the shipped defaults, tapeRunner `c50a18ce…`, and the identity block (below). **So they ship ON** (`7d9e7fc`).

**The game, at the shipped defaults** (this tree, port 9400, p4f, the production engine; `probe-seedling-contact-divergence.mjs`):

| leg | BEFORE (switches OFF = the sweep) | AFTER (W2 + W3 ON) |
|---|---|---|
| 243 L22 → L21 | left at t52 | **done, on plan** (112 t) |
| 251 L22 → L21 | left at t60 | **crossed, on plan** (116 t) |
| 269 L25 → L28 | left at t55 | **done, on plan** (106 t) |
| 283 L27 → L26 | left at t19 | **done, on plan** (126 t; the new plan does not meet the W1 tick) |
| 264 L25 → L26 | left at t80 | left at t80 (needs W1; with all three ON on `wt-on`: **done, on plan**, 182 t) |
| 659 L88 → L87 | left at t48 | **done, on plan** (476 t; it kills the drill) |
| 661 L88 → L87 #2 | left at t48 | **crossed, on plan** (379 t) |
| 666 L88 → L12 | left at t53 | **crossed, on plan** (213 t) |
| 660 L88 → L12 | crossed | crossed (4 t) |
| 663 L88 → L12 | left at t104 | **refused by name**: *"the re-planned corridor failed too — … waypoint 0 (136,152): not reached within 400 ticks; stalled at (155.8,124.9)"* (a planning gap beside a live drill; no divergence) |

## The survey/sweep rows this moves (before → after, by leg)

- **The sweep's §1 table:**
  - wallflyer: 4 of 5 move from *left the plan* → *on plan* at the shipped defaults (5 of 5 with W1);
  - drill: 3 of 4 → on plan, and 1 → named refusal;
  - BobSoldier (L30 ×2+), L71, L74: unchanged.
- The L16 rows (174, 184) were not reproduced: they are refusals at this base, before any change.
- **Σ unserved:** the one row on an unserved edge (L74 Darkshield, 8 locations) is NOT moved. It is the ARRIVAL family's (a frozen frame at a button), not a contact.
- The `--through=end` route survey was **not re-run** (budget). These rooms' legs are where it could move.

## For the JS arc: pins, fields and words

**Pins red at my head: none.** `jsRuntimeArrivalOnDoor`, `wasmArrivalComposite`, `jsRuntimeWalker`, `jsRuntimeSolver`, `wasmArrival` and `jsRuntimeDeclarations` were run at the head with the shipped defaults, and all are green.

**New optional fields** (nothing removed, no signature moved):
- `run.drills` → `{bodies, events}` (events `hop`, `contact`, `struck`, `killed`);
- `run.wallFlyers.events` gains `kind: 'struck'`;
- `chaserPressHits` rows can carry `tag: 'wallflyer' | 'drill'`;
- `pressRespondersIn` responders may carry `family`.

**New refusal text** (no new `obstacle.kind`): a wallflyer sword KILL (*"… KILLS wallflyer@… Refused by name (seedling-fidelity-terrain W2)"*) and a drill kill that opens a kill lock (W3).

**What to wire:**
- the sweep's next dispatch at this head re-measures these rooms;
- the divergence lab's `serveLeg` pairs plays to solves by order, which mis-pairs a continuation (L30 #312/#316). The capture inherited that.

**CANCROSS's `solverStamp` moves** (`levelRun.js` changed), so derived rules read STALE until re-derived. That is the intended behaviour.

## Deltas

- New: `frontend/modules/seedlingDemo/contactFidelity.js`, `drill.js`, `contactFidelity.test.js`, `fixtures/contact-witness/` (13 captures).
- New instruments: `scripts/procgen/probe-seedling-contact-divergence.mjs`, `seedlingContactLab.js`, `replay-seedling-contact-capture.mjs`.
- `crusher.js` (W1, one line pair), `levelRun.js` (W2 arm, W3 family: state, step, contact skip, press arm, kill staging, `drills` getter), `presses.js` (`family` passed through).
- `boxLock.test.js` (the new probe on `guarded`).
- The constants census: 39 drill literals classified, `--profile-rows` + `--write`, PASS 5,036.
- Docs: `seedling-bot.md` (the switches paragraph) and `seedling-bot-log.md` (the TERRAIN entry, four trap candidates). The regenerated reference: `architecture.md`, `generated/instruments.js`, `generated/docsIndex.js`.

## What the brief got wrong (measured)

1. **"suspect collision/corner resolution (a slide along a wall, a nudge around a corner, a sub-pixel solid edge)"** — the brief did say "measure, don't assume", and the measurement found no collision term at all. Every reproduced row's first differing field includes `hits` (L74 aside, which has no hit and no body). The player's sweep (`Player.moveX/moveY`) is transcribed faithfully; I re-read it against the AS3.
2. **"terrain id at t−1 is 4, 5, 8, 10 or 16"** — irrelevant: the terrain id is the floor the knockback happened over.
3. **The table's per-row notes:**
   - L88 *"v (0,+0.59) down(+primary)"*: the primary was the player striking the drill, which matters for W3's i-frame;
   - L27 *"terrain 0"*: the cause is a wallflyer launched a tick early by a ray-truncation bug;
   - L30 *"terrain 8"*: the cause is a BobSoldier's sword.
4. **"L71 … not reproduced: plan choice"** — it reproduced exactly at t141 with a hit and no Mobile within 40 px (the axe).
5. **The region boundary** ("TERRAIN: `playerPhysicsV2.js` / the collision resolution") — no line of `playerPhysicsV2.js` changed. The fixes are in the bodies' models (wallflyer press arm, a new drill family) and in FlashPunk's `collideLine` transcription (`crusher.js`). None of those is another wave-6 slice's listed region. The two residue rows that are someone else's (L71: AXE; L74: ARRIVAL) are named, not touched.

## Residue

- **BobSoldier** (L30 #308/#309, L28's bare rows, the L30 Torchpickup family): a chaser (`moveSpeed` 0.8, Bob's chase block) with a spinning sword. Its `collideLine("Player", …)` from 8 to 16 px off the body hits at force 3, and `swordSpin` is a state machine (`swordSpinRate` π/10, the 60-tick reset). It is deterministic, and its ray needs W1. A slice the size of U7's puncher.
- **L71** t141 (AXE's), **L74** t1 (ARRIVAL's: the arrival's frozen frame one tick apart on `button@288,128`; the Σ-unserved row).
- **L88 #663**: a corridor stall beside the live drill (a solver gap).
- **L28 / L91 drills**: not live (other enemies share the room).
- **The capture's play pairing** (L30 #312/#316): see *For the JS arc*.
- **M-b's hole**: no witness exercises W2's reach gate or line-of-sight gate.
- **A wallflyer KILL** is refused by name: its die anim's ledger consequence is not staged.
- The drill is not yet an `entityRecords` record (its constants live in `drill.js`'s `DRILL`, which is census-classified).

## Byte-inertia

**AFTER identity block at the shipped defaults** (`SEEDLING_PORT=9400 bash scripts/procgen/identity-block.sh .`), against W0:

| row | W0 (`88a7e4d`) | AFTER, shipped defaults |
|---|---|---|
| maze byte-identity | `246dfbce…` | **identical** |
| acceptance batch | `608693d2…` | **identical** |
| empty pairs c3 / c6 | `05c5ef94…` / `e88baf9d…` | **identical** |
| carved pairs c4 | `f8cba3a8…` | **identical** |
| ENEMY census | `68466067…` | **identical** |
| guard census | `a6d18d49…` | **identical** |
| AREA census | `02b22525…` | **identical** |
| killgate s2 / s5 / s9 | `01210c82…` / `07ce222a…` / `30a1e3e7…` | **identical** |
| level pre-/post-sword s1 | `e28c1e5d…` / `c4841acb…` | **identical** |
| generated set | `OK` | **`OK`** |
| six producers | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724`, all exit 0 | **identical**, all exit 0 |
| reference row | `4 … DIFFER` | `4 … DIFFER` (both; the head's own `generate-procgen-reference --check` reads ALL MATCH after regeneration) |

**The whole log is byte-identical:** md5 `2a0db7c4ce602f0a4489569593eac2f9` at both ends (`diff` empty). ⚠ The two mutants were made (and restored) while this block ran. A mutant can only have made a row differ, and none does.

An all-OFF AFTER run (`idblock-after.log`, the D2 code) was **byte-identical to W0 on every row**. Its `generated set` row collided with my game probe holding the box; re-run alone, it read `OK`.

## Rows to BANK

- tapeRunner 511 `c50a18ce044426768bce014c1f8d8c68` (unmoved); roster 227 (unmoved); surface GREEN 198; entities PASS 518; constants PASS 5,036.
- producers `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 56bb3724` (unmoved at the shipped defaults; with W1 ON `r9-campaign` reads `5aa27ba3…` exit 1).
- `contactFidelity.test.js` 46 rows; bounded set at the head 47 files / 2,340 tests green.
- Instruments +3 (`probe-seedling-contact-divergence.mjs`, `replay-seedling-contact-capture.mjs`, `seedlingContactLab.js`); `check-procgen-help --in-place` ALL PASS on both `.mjs`.
