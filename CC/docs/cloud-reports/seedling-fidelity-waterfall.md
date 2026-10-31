# Seedling fidelity WATERFALL — the corridor planner prices the waterfall's push (`waterfallPushPricing`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-waterfall` (planner `seedling-fidelity-planning-16`, wave 35) |
| Start SHA | `9dadbdfc4b` (= main, 102 ON of 113) |
| Head | see the last commit on the branch (this report is committed last) |
| Branch | `claude/seedling-fidelity-waterfall-nbwkm1` (the harness's branch; the brief's `seedling-fidelity-waterfall` is that branch) |
| Servers | `serve-nocache.py 9765` (this tree) · `9766` (a scratch worktree of `ab2049cc` with `waterfallPushPricing` flipped ON, never committed: the probe battery ON) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS on the corridor, STOP on the leg (hand-over) · D3 PASS (flip-ready list below)** |
| Key | `CONTACT_FIDELITY.waterfallPushPricing`, appended at the END of the defaults; ships **OFF**, byte-identical OFF; `SEEDLING_WATERFALL_PUSH_PRICING=0|1` |

**The one thing to know first.** ON, L100's 8 px corridor takes the swim-up crossing (game-witnessed at 0 px), and survey step
89 (L89) gets shorter (639 → 291 t). Step 219 (L100 → L101) still refuses, but **not** on the jellyfish dwell any more. The
break-stance walk is planned on the run's **16 px** lattice. At 16 px the sliver x 120–127 has no node, so the plan aims at the
nearest 16 px node in the pool and then adds the target as a final segment through `cliffside0@112,128`. The walk stalls there.
Whether the walk to an 8 px stance should plan on the 8 px lattice is a question for the swing-stance code. The waterfall edge
model does not decide it.

## W0 (base `9dadbdfc4b`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9765 bash scripts/procgen/identity-block.sh .` | file md5 **`590b0b88`**, the base's published value. Rows: maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK. Producers: battery `7486f32e`, d2-chain `93f75467`, l18 `88e33db7`, tail `35456fbc`, r9-l3 `6cd35fe1`, campaign `be9c19c8`, all exit 0. Reference: "4 DIFFER" (the box's registry/capabilities artifact). ⚠ This run straddled D1's edit: the maze/acceptance rows ran on the base and the producers on D1 at the default (OFF). So this one file is W0 **and** the OFF inertia row (`evidence/identity.txt`) |
| survey full, OFF | `survey-seedling-route.mjs --through=end --route=full --timeout=1500` (at `ab2049cc`, the default) | **203 SOLVED / 37 REFUSED** = CI `40811598699` (203/37) |
| waterfall census | `evidence/tools/census.mjs` (every level's `waterfallTiles` through `buildLevelWorld`) | **201 armed tiles in 20 levels**: L0 (2), 46 (10), 52 (7), 54 (11), 56 (3), 57 (8), 59 (28), 60 (12), 63 (6), 65 (6), 66 (4), 87 (5), 89 (10), 91 (1), 93 (28), 94 (27), 95 (14), 98 (3), 100 (12), 115 (4). Most are one to three rows deep; L100's x 80–111 column is six (`evidence/w0-waterfall-census.txt`) |
| survey steps in those levels | the OFF survey's rows | 61 of 240 steps (list in `evidence/survey-on-vs-off.txt`'s run; L0 ×13, L59 ×7, L95 ×8, L60 ×6, …) |
| bounded set BEFORE | the 100 files (the set less `fidelityWaterfall`) in a base worktree at `9dadbdfc4b` (node_modules and submodules symlinked) | **99 / 100 files, 2,515 / 2,515 tests**. The one file is `mazeRoomUI.test.js`, which fails to LOAD in the worktree (`registerBackend: duplicate id 'empty'`: the symlinked `shared` submodule is imported under two paths). It is green in this tree (`evidence/vitest-before.txt`) |
| roster | `fixtures/tapes/index.json` | 293, unchanged (the witnesses are in `fixtures/waterfall-witness/`, not the roster) |

**The L100 carry, reproduced** (step 219's boot, jellyfish removed in memory, `evidence/tools/carry*.mjs`): held RIGHT from
(72.5,44) the player enters the waterfall at t7 and is at (110,173), the pool's floor, by t~60. RIGHT+UP with the Feather rises
into the row-1 pool to (109.8,18.4). The planner's own 8 px corridor before D1 was `(44,92) (60,44) (124,44) (124,140)`: the
flat crossing. Driven with the solver's walk, the swim-up corridor (D1's) reaches (124,140) at t277.

**The carry table** (the model's physics, L100's column, from rest; `evidence/w0-carry-table.txt`):

| held | Feather | 4 px of waterfall | 8 px | 16 px |
|---|---|---|---|---|
| right | either | 6 t, **11.4 px down** | 17 t, **63.6 px down** | 32 t, 127.2 px down |
| right+down | either | 6 t, 17.7 px down | 17 t, 78.8 px down | 29 t, 128.1 px down |
| right+up | yes | 8 t, 4.4 px **up** | 14 t, 8.2 px up | 26 t, 16.4 px up |
| right+up | no | 9 t, 5.3 px down | 21 t, 25.1 px down | 45 t, 96.5 px down |

At the 16 px cell, half a cell (8 px) of flat crossing carries the player four cells down. At the 8 px cell, half a cell (4 px)
carries it 1.4 cells. The push has no friction (v.y grows 0.8 a tick). With the Feather, only a rise is exempt (`v.y < 0`), and
a held rise stays one.

## D1 — the push, priced (PASS)

**Change** (`botDriverV2.js`, key read inside each call):
- `planTilePath`'s step cost: a FLAT step INTO an armed waterfall node costs `1 + 2 × depth`. `depth` counts the walkable nodes
  the push falls through below it: the fall, and with the Feather the climb back. A node with no walkable node under it is
  pinned (a floor stops the push) and costs 1. A flat EXIT costs `2 × depth(from)` unless the half-cell's carry
  (`WATERFALL_EXIT_CARRY_PX = {4: 11.4, 8: 63.6}`, the table above) lands on walkable nodes on the far side. Downward and
  Feather-rising steps cost as before. The featherless climb stays `climbsArmedWaterfall`'s refusal, the one directed rule.
  Integer costs, so the g-score stays an exact sum (the swimmer's quarter-rounding docblock is kept).
- `stringPull`: under the key, a candidate is also refused when `waterfallCarriesLeg` says the controller's two-leg walk has a
  flat or down-diagonal leg (or a featherless rise) sampling an armed waterfall point over an open drop. A point on an unpinned
  waterfall is never kept as a stop (`waterfallNoStop`; the target itself excepted). The fallback steps past such a point. The
  extra test runs after the obstacle test, so SP's point memo sees the same asks in the same order. The memo itself is untouched.
- **A price, not a refusal.** `plansReach` answers existence. Pricing does not change existence, so it stays exact with no edit.
  The test asks 220 L100 cells, ON, and `plansReach` agrees with `planWaypoints` on every one. The R4 lesson still holds:
  refusing waterfall motion cut L0 from 53 nodes to 12.
- The escape cache (XC) and `stateDigest` are untouched. The docblocks say the key is fixed per process.

**Measured, L100 (`evidence/l100-corridors.txt`)**:

| lattice | OFF | ON |
|---|---|---|
| 8 px | `(44,92) (60,44) (124,44) (124,140)`: the flat crossing at y 44 | `(44,92) (60,44) (76,44) (108,28) (116,36) (124,140)`: rise into the row-1 pool with the Feather, leave it down-right |
| 16 px | `(40,88) (56,40) (104,40) (104,136) (124,140)` | `(40,88) (56,40) (72,40) (88,136) (104,136) (124,140)`: down the column, no flat crossing |

**Game witnesses** (p4g headless, `probe-seedling-chaser-mobiles --class=Jellyfish --player-hits --frames`, port 9765; the
player's (x,y) is the game's first frame per tick; `fixtures/waterfall-witness/`):
- `l100-on-route`: the ON 8 px corridor driven by `driveStepHeld`, with the jellyfish present, until 24 ticks after the first
  hit. 176 ticks, 19 of them over the waterfall. **Model = game at every tick, 0 px.** Jellyfish: 704 comparisons, worst |Δ|
  0. The hit is `jellyfish@80,16` at t151, as in the L100 slice's swim witness.
- `l100-exit`: the exit leg, booted in the row-1 pool at (108,28): (116,36), then down the sliver to (124,140). 117 ticks,
  0 hits, model = game at 0 px, jellyfish 468 comparisons at 0.
- `l89-step89-on`: survey step 89's ON plan (see Movers). 292 ticks; the game reaches L87 at t291; model = game, 0 px.
- Control: the comparator fed the wrong tape (`l100-w0-straight`'s model against `l100-on-route`'s game) reads 120 px.

**Mutants** (predicted first; made by copy + restore of `botDriverV2.js`):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | drop the no-stop step-past in the fallback | the ON 8 px row red | ON 8 px, ON 16 px, witness key-for-key: **3 red** |
| M2 | surcharge always 0 | the ON row red | ON 8 px, 16 px, witness: **3 red**; and the step-89 row red |
| M3 | the pull lets flat legs through | the ON row red | ON 8 px + witness: **2 red** |
| M4 | exits always free | the ON row red | **survived**. L100's tie-break already picks the row-36 exit. Added the row "an EXIT is priced by where its half-cell carry lands" (from (108,60): ON exits at (13,4)→(14,4), M4 at (13,5)→(14,5) over the mask). Re-run: **1 red** |
| M1' | drop BOTH no-stop uses, against the step-89 row | step-89 red | **survived**. L89's fix is the A* price, not the stop rule (M2 kills it) |

Gate: `fidelityWaterfall.test.js`, 9 rows, all green.

## D2 — the L100 leg (PASS on the corridor; STOP on the leg, handed over)

- With the key ON, `planWaypoints` on the 8 px lattice takes the swim-up crossing (D1's table). The model walk of it reaches
  the stance (124,140) when the jellyfish are removed. With them present, `jellyfish@80,16` hits at t151 on both the model and
  the game.
- **The leg does not use it.** The break stance (124,140) comes from the 8 px arm (`fineSwingStance`). `solveSegment` then walks
  to it with `solverPlanOpts(run, contacts)`, the run's 16 px lattice. At 16 px no node fits the sliver. So
  `nearestGoalNode` picks the pool node (104,136), and `planWaypoints` appends (124,140) as a final segment through
  `cliffside0@112,128`. The 8 px retry (`FRONTIER3`) runs only when the 16 px plan *throws*, and this one does not.
- Refusal, step 219, **before → after** (survey, local, both arms):
  - OFF: *`… -> break stance (breakablerock@128,144) -> kill (jellyfish@88,144) by press: the dwell was HIT at tick 193 (hits 0 -> 1, deaths 0 -> 0). …`*
  - ON: *`… -> break stance (breakablerock@128,144): the re-planned corridor failed too — … waypoint 1 (124,140): not reached within 400 ticks; stalled at (110.99,140.58) v=(0.45,0) in level 100, aiming at (124,140), after grazing 393 solid(s): cliffside0 at (112,128) …`*
  - Both are refusals; the step stays REFUSED. The OFF walk was also carried to the pool (its 16 px corridor crosses flat at
    y 40). It met the jellyfish dwell first. The ON walk descends the column, which is the true motion, and stalls on the mask.
- **Hand-over (not WATERFALL's region):** a walk to a stance found on `FINE_LATTICE` should plan on `FINE_LATTICE`. Either the
  walk asks the 8 px lattice when its goal came from the 8 px arm, or the 16 px plan counts as "no plan" when its last segment
  was never node-checked. That is `solverBot`'s walk / the L100 swing-stance code (L100FIX's), and possibly the JS arc's
  `solveSegment` path. Measurement: `SEEDLING_WATERFALL_PUSH_PRICING=1 node evidence/tools/seg.mjs CC/docs/cloud-reports/seedling-fidelity-l100-evidence/step-219-boot.json`
  prints the refusal with the walk's 16 px path `(40,88) (56,40) (72,40) (88,136) (104,136) (124,140)` in its second trace row. After that, the jellyfish (hammer's dwell,
  the L100 slice's Gap 2) is the next gate.

## D3 — flip readiness (PASS; every red listed)

Bounded set: 101 files (`evidence/bounded-set-files.txt`). That is the brief's list plus every `grep -a` hit for
`planWaypoints|climbsArmedWaterfall|waterfallTiles|stepCost|planTilePath|plansReach|WATER_STEP_COST`, the surface/constants
tests, `fidelityL100`, `fidelityL100Fix`, `stringPullFast` and `fidelityWaterfall`. Plus the slow pair.

| row | command | result |
|---|---|---|
| bounded set, defaults | `npx vitest run <101 files>` | **101 / 101, 2,698 / 2,698** |
| bounded set, key ON | `SEEDLING_WATERFALL_PUSH_PRICING=1 npx vitest run <101 files>` | **100 / 101, 2,697 / 2,698**. The one red: `contactFidelity.test.js` "the shipped defaults", the pin a flip owes by construction |
| slow pair (`fidelityL32ArenaPrefix`, `fidelityL40Bk2`) | `vitest.slow.config.js`, defaults / ON | 2/2, 6/6 / 2/2, 6/6 |
| L4 dash margin | `dashOnlyWindow`, `dashShape`, `jsRuntimeSolverShouldStop` in the flipped worktree | **46 / 46**. L4 has no waterfall, so the model returns null and adds no work. Under the env override (not a flip) `dashOnlyWindow` ×2 and `dashShape` ×1 red, because an off-default switch stamps `contactFidelity` into the request. That is env-only and does not happen at a flipped default |
| six @ci-box `--check`s, key ON | `evidence/six-checks-on.txt` | all six **identical digests** to the base, exit 0 |
| `ci-producer-checks.mjs --jobs=3`, key ON | `evidence/producers-on.txt` | **97 run, 0 red**, 1 skipped by design (`plan-seedling-r7-ends-meet`, browser arm) |
| probes standard, key ON | the flipped worktree on :9766, each probe as `seedling-probe.yml` runs it | **10 / 11 ALL CHECKS PASSED**; logical-links B,R 23 PASS / 2 FAIL, and the **OFF control** (this tree, :9765) shows the **same 2 FAILs** (see below) |
| work pins (`solveProgress`, `solverDeadline`) | in the bounded set, ON | green: no work pin moved for hammer to sign |

**Flip owes:** `contactFidelity.test.js` "the shipped defaults" (`waterfallPushPricing: true`), and the docs line. No STUB or
CONTROL assumed the old default (`grep -a waterfallPushPricing` = this slice's files only).

## The survey / sweep / probe rows this moves (key ON), and the dispatches to confirm them

**Route survey, full, local, both arms** (`evidence/survey-on-vs-off.txt`): 203/37 on both. Two movers. Every other row's
verdict, ticks and refusal text are equal.

| step | level | OFF | ON |
|---|---|---|---|
| 89 | L89 → L87 | SOLVED 639 t, 1 re-plan | **SOLVED 291 t, 0 re-plans** (game-witnessed). OFF's first corridor kept a stop at (232,104), on L89's waterfall tile (14,6). The walk cannot stop there; it stalled 468 t and re-planned. ON, the A* price sends the corridor straight down the column (`(232,40) → (232,152)`) |
| 219 | L100 → L101 | REFUSED: the jellyfish dwell hit at t193 | REFUSED: the 16 px break-stance walk stalls on `cliffside0@112,128` (D2) |

**Step 87** (L89 `collect-placement` toward (168,88), the Feather): **untouched**. Both arms give the identical 914-character
refusal: *"no corridor for goal collect-placement … Obstacle: pickup:feather …"*. It is an existence refusal (different
components), and a price cannot change existence.

**Dispatches for the planner** (cloud cannot dispatch):
1. **Survey A/B**: `seedling-survey.yml` on `claude/seedling-fidelity-waterfall-nbwkm1`, `through=end route=full`, once at
   the head and once on a scratch commit that flips `waterfallPushPricing: true` in `contactFidelity.js`. The workflow has no
   `contact_fidelity` input. Expected: steps 89 and 219 only. A cheap variant: `-f route=full -f only=89,219 -f
   base_run=40811598699`.
2. **Divergence sweep ×2 per arm**: `seedling-divergence-sweep.yml` on the branch, the full leg list. OFF arm:
   `contact_fidelity` empty. ON arm: `contact_fidelity` = the 102 default-ON keys plus `waterfallPushPricing`, the exact string
   in `evidence/sweep-on-arm.contact_fidelity.txt`. ⚠ An unlisted key turns OFF. If a full ×2 is too costly, the keyed variant
   is `keys=` the 198 legs in the 20 waterfall levels (`evidence/sweep-keys-waterfall-levels.pipe.txt`, derived at this base,
   919 legs) with `capture_requests=true`. Expected movers: L89's leg toward L87 (step 89's) and L100's leg 907.
3. **Probes standard**: `seedling-probe.yml -f battery=standard` on the scratch flip commit (and at the head as the control).
   The local ON run is below.

**Probes standard, key ON (local, `evidence/probes-on.txt`):** vanilla-map 23, **arrival-composites 95**, midroom-replan D
10, restart-route W,J 18, restart-warp W,J 28, adopt 51, obstacle-events W,J 22, generated-playback 35, loop-restart 30,
seal-delivery 52: all ALL CHECKS PASSED. **logical-links B,R: 23 PASS / 2 FAIL.** Both FAILs are *"every Restart's start-hop
arrival is HELD (≥ 1 expected arrival …)"* with `expectedArrivals: 0`, on B and on R. The OFF control on this tree at the
default (`evidence/probe-logical-links-off-control.txt`) gives the **same two FAILs, with the same payloads**, and B's walk
ends at the same place on both arms (Sphere 6.4, 18/48). That makes it red at the base, in the JS arc's Restart arrival
watch (the base carries `2cc31ced` "arm the arrival watch only behind a stopped walk"). Not this key. Named for the planner/JS
arc.

## The JS arc

- No new staging/result field, no new `SolverRefusal.obstacle.kind`. The solver's request carries the key through the
  existing `contactFidelity` stamp when it is off-default. Nothing to wire.
- A flip changes the corridors the page's solver plans in waterfall rooms (L89's step 89 shorter). No `producer:walker` row is
  in this local measurement; the sweep's walker arm would show any.
- `seedlingSkinRenderer`: no `run.*` field renamed or reshaped (green in the bounded set).

## Handed over

- **The walk lattice for an 8 px stance** (D2): to whoever owns `fineSwingStance`'s walk (L100FIX's region in `solverBot.js`).
- **The jellyfish dwell** (L100 Gap 2): still the hammer arc's, unchanged.
- Hammer: no work pin moved ON (`solveProgress`, `solverDeadline` green). The escape cache and `stateDigest` are untouched.

## Deltas

- `botDriverV2.js`: `waterfallPushModel`, `waterfallStepSurcharge`, `WATERFALL_EXIT_CARRY_PX` (exported), `waterfallNoStop`,
  `waterfallCarriesLeg`; one line in `planTilePath`'s step cost; three lines in `stringPull`. OFF: the model is null and every
  added branch is skipped.
- `contactFidelity.js`: + `waterfallPushPricing` (OFF, at the end) and its env lines. 102 ON / 12 OFF of 114.
- New: `fidelityWaterfall.test.js`, `fixtures/waterfall-witness/{l100-on-route,l100-exit,l89-step89-on}.json`.
- Pins: `contactFidelity.test.js` (the defaults, +1 OFF row).
- Surface census `--write`: +3 sites in `botDriverV2.js` (`world:waterfallTiles`, `CONTACT_FIDELITY`, `TILE_SIZE`,
  `coerceTerrainState` counts), **GREEN 363**. Constants census **PASS 6,999** (0 new).
- Reference: the docs index regenerated for the docs' words (`docsIndex.js`, `README.md`). The box's registry/capabilities
  artifact is left as committed: "4 DIFFER", as at the base.
- `seedling-bot-log.md`: the WATERFALL entry. `seedling-bot.md`: one paragraph.

## What the brief got wrong (measured)

- **"FLAT and DOWNWARD steps are priced as plain floor"**: true. But a downward step is *correct* as floor: the push carries
  the walk the way it is already going. D1 leaves downward steps at cost 1. Only flat (and the string-pull's down-diagonal,
  whose corner geometry the push breaks) is priced.
- **"Expect the leg's refusal to stay on the jellyfish dwell"**: it moves to the 16 px stall (D2). The leg's walk plans on a
  lattice that cannot see the sliver, so it never reaches the 8 px corridor D1 builds.
- **"With the Feather, only rising is free"**: also free is a flat step over a waterfall pinned by a floor under it (no carry
  room). The census shows that most of the game's waterfalls are one to three rows deep.
- **Step 87**: the waterfall pricing does not touch it. It is an existence refusal.

## Residue

- Step 219 / leg 907 still refuses (D2 hand-over, then the jellyfish).
- The identity block straddled the D1 edit (W0 row). Every producer row ran on the OFF code and equals the base's published
  digests.
- The 16 px corridor's "nearest node + appended target" fallback can cross a wall unchecked (the trap below). That is not
  WATERFALL's to change.

## CI (push, `JavaScript Unit Tests`)

- `ab2049cc` (D1), run for that SHA: vitest unfiltered **24,178 passed / 0 failed**; slow battery 273 / 273.
- `0dd87eb8` (the last head with code, test or docs changes), run 40921532084: **24,179 passed / 0 failed**; slow battery
  273 / 273. The report commits after it touch only `CC/docs/`, which the workflow's path filter skips.

## Byte-inertia

OFF is byte-identical:
- `waterfallPushModel` returns null with the key off. Each added branch tests `push === null` first, so OFF executes the base's
  code path.
- Identity block md5 `590b0b88` (the base's), all six producer `--check`s with the base's digests, exit 0.
- The full survey OFF equals CI `40811598699` in counts (203/37). At the defaults the bounded set is 101/101.
- The only committed artifacts that move are additive: the witnesses, the test, the defaults pin row, the surface census
  (+3 sites), the docs and the docs index.

## Rows to BANK

- Roster **293** (unchanged). Surface census **363** rows. Constants **6,999**.
- Game witnesses `fixtures/waterfall-witness/`: `l100-on-route` (176 ticks, 0 px), `l100-exit` (117 ticks, 0 px, 0 hits),
  `l89-step89-on` (292 ticks, 0 px).
- Survey ON (local): 203/37; step 89 291 t.

## Trap candidates

- A waypoint on a waterfall is a stop the walk can never make. `hasArrived` needs a stop, and the push never allows one. A
  planner that prices waterfall tiles as floor emits such stops, and the walk "stalls" with nothing in the way (L89 step 89:
  468 ticks).
- A 16 px route to an 8 px target adds the target after the nearest 16 px node. The smoother's fallback never checks that last
  segment, so it can cross a wall. A stance found on the 8 px lattice needs its walk planned on it.
- Concurrent surveys share one views directory (`.cache/seedling-survey/through-end/views`). To read a step's walk, run that
  step alone.
