# Seedling fidelity L40BUTTON — the stance's hypothesis had no rocks, and the button it named was never in the way

| | |
|---|---|
| Session | `seedling-fidelity-l40button` (planner `seedling-fidelity-planning-6`, wave 12, model coverage) |
| Start SHA | `dd6ae2e379` (main after wave 11 + the L37 fallrock patch + the JS contact hook + C1-ON and its bank; not rebased) |
| Head | the last commit on the branch (this report is the last commit) |
| Harness branch | `claude/seedling-l40-button-route-491l6g` |
| Commits | D2 `b0858a9` · D1 `5998067` · D3 `099e289` · reference `765d3b2` · this report |
| Verdicts | **W0 PASS · D1 PASS (the brief's premise is overturned) · D2 PASS (`STANCE_ROCKS` ships OFF; the flip is the user's) · D3 PASS with a hand-over (two game witnesses at 0 px, recorded `noDamage`; the damage-on walk is game-refuted by an unmodelled bomb)** |

**The one thing to know first.** Group 2 (`button@480,384` / `wandlock@448,432`) is not on this route at all. From both
north arrivals the part needs only L40's NW cluster — `buttonroom@272,208` (t0) → the three `breakablerock`s
{22,23,24} → `buttonroom@160,128` (t1) — the order `r5-l40-part0` recorded on the game. The solver refused because its
stance hypothesis discharged locks and shield bosses but never rocks, so the buttonroom's stance read as unreachable and
the prerequisite sweep listed the room's group-2 wall instead. With `STANCE_ROCKS` ON both legs solve (1,543 t /
1,597 t), and the game reproduces the plans at 0 px **with damage off**. With damage on the game refutes them:
`bombpusher@112,128` lobs a `Bomb` at the player while it waits on `buttonroom@272,208` for the locks' 101-tick fade.
The model has no `BombPusher` emitter. That is the next wall for these legs, and it is a separate work order.

## W0 — bank at base (`dd6ae2e379`)

Measured in a detached worktree of `dd6ae2e379` (submodules and `node_modules` symlinked to the primary tree's; served on
port 9632).

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9632 bash scripts/procgen/identity-block.sh .` (worktree, venv activated) | log md5 `946ef8e63d7cf239ea5601dda5a6c58e`: maze `57e07d21`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set `OK` |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| reference | in the block | 4 DIFFER — environmental (the worktree's symlinked substrate submodules: `registry.js`, `capabilities.js` and their two regions) |
| surface / constants / entities / profile | the four `--check`s | **GREEN 265** · **PASS 5,623** · **PASS 535** · **PASS 138** (both JSONs) |
| roster | `fixtures/tapes/index.json` | **274** |
| bounded vitest BEFORE | 71 files (below), `--reporter=json`, md5 over sorted `status\tfullName` | **71 files / 2,749 tests, all green**, md5 `a59ff16cf94d35ddd5a7377f7fafa5f5` |
| tapeRunner | `tapeRunner.test.js` alone, same md5 | **605** rows, `70c1a2d1baa27a2df4102e381914b303`, 0 non-pass |

The bounded set is the brief's standing list (`r8Acceptance`, the four roster pins, `ropeSword`, `shoveWeighParity`,
`watchGenOverlay`, `watchOverlays`, `r5Shaft`, `fidelityArrival`/`Axe`/`KillLock`/`Ladder2`/`Crusher`/`StaticSword`/
`DarkTrap`, `ghostSword`, `bobSoldier`, `solverReachPit`, `arrowTrap`, `oneSpelling`, `enemyDamage`, `dangerMap`,
`contactFidelity`, `decisionTrace`, `entityBlocks`, `solverDeadline`, `seedlingCanCross`, `campaignChain`,
`jsRuntimeDeclarations`, `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, plus
`fidelityWand`, `spearPush`, `seedlingProfile`, `seedlingEntityWitness`, `seedlingProfileWitness`) and every `rg -a` hit
in a non-slow test for `stanceHypothesis|bagWithDischarged|stanceReaches|PREREQUISITES WERE|REACHABLE stance|
resolveHoldStrategy|deriveBreakStance|breakablerock|brokenRocks|r5-l40|L40_`: `blockRoute`, `botDriverV2`, `breakVerb`,
`breakableRocks`, `crusher`, `fidelityClearTag`, `fidelityL12Keyline`, `fidelityReturn`, `fidelityStance`,
`fidelityStepOff`, `iceTurret`, `jsRuntimeArrivalOnDoor`, `jsRuntimeSolver`, `jsRuntimeVerbs`, `jsRuntimeWalker`,
`levelRun`, `levelSetValidator`, `levelWorld`, `obstacleEventStaging`, `procgenCollectPath`, `procgenDoorElements`,
`procgenNestedOpeners`, `procgenPalette`, `procgenSeedlingElementsCertify`, `r5Feather`, `r5Totem`, `solverBot`,
`tapeFormat`, `seedlingDivergenceLegs`, `surveyFamily`, `surveyRoute`. AFTER adds `fidelityL40Button` (new). The docs/
help/roster rows a new script and tape reach (`docLinks`, `docsRender`, `procgenDocs/generated`, `checkProcgenHelp`,
`procgenHelpBaseline`, `rosterCategories`) were run as a second set (below).

## D1 — what reaches `Totem Part 64,144` from the north (PASS; the premise is overturned)

**The refusal, reproduced.** Locally on p4f (`probe-seedling-divergence-sweep.mjs --ids=378,381 --mode=inv
--producer=solver`) and in node (survey step 124's staging re-pointed at each arrival), both legs refuse with the
sweep-4 text, rung by rung: the collect has no corridor → the part's group-1 locks select `hold` → `buttonroom@160,128`
has one stance cell, unreachable from (936,104) / (856,24) → the prerequisite sweep lists `wandlock@448,432` and
`wandlock@512,480` (group 2: *"publishes only while a Solid sits on button@480,384 … NO block can reach it"*),
`wandlock@800,400` (group 5), `bosslock@480,352` and `pushableblock@576,560`. Nothing in that list is the cluster.

**The floods** (`probe-seedling-l40button.mjs`, new; the planner's `plannerObstacleAt` on the 8 px lattice, volumes
off — the R5 floods' arm). Both arrivals are one component; the counts are identical from each:

| arm | cells | reaches |
|---|---|---|
| nothing opened | 728 | `buttonroom@272,208` |
| group 0 | 760 | `buttonroom@272,208` |
| group 0 + the three rocks | 776 | + `buttonroom@160,128` |
| groups 0+1, no rocks | 952 | + `totempart@64,144` |
| groups 0+1 + rocks | 968 | both buttonrooms and the part |

`button@480,384` and `wandlock@448,432` are in no arm's reach. So **the wandlock route is not the intended one; it is not a
route at all from here.** The intended order is the cluster's own: latch t0 (`buttonroom@272,208` self-latches,
`room -1`), break the rocks (they are the door to `buttonroom@160,128`), latch t1, collect. That is exactly what the R5
tape `r5-l40-part0` drove on the game from a boot inside the cluster (`noDamage`).

**The cause.** `stanceHypothesis` (the set a stance derivation discharges once its direct plan fails) enumerated
`world.activators` and `world.shieldBosses` only. Group 0's wandlocks were in it (their opener latches, so `hold` is
durable); the three rocks were not, though `break` is a selected, registered, durable verb. With the probe's OFF/ON rows:
OFF the hypothesis at leg 378's arrival is `wandlock@176,80, @208,128, @208,144, @208,160, @176,208, @480,560,
bosslock@480,352`; ON it adds `breakablerock@160,144, @176,128, @176,144`.

**The frontier's door order** is not the gap for these legs: the collect's own ladder picks the part's group-1 lock first
and resolves it correctly to `buttonroom@160,128`. (Step 124 from the SOUTH arrival is a door-order case; see the census.)

## D2 — rocks join the stance hypothesis, behind `STANCE_ROCKS` (PASS; OFF by default)

`solverBot.STANCE_ROCKS` (OFF; `SEEDLING_STANCE_ROCKS=1`, `withStanceRocks(true, …)`). The browser has no `process` and
takes the code default.

- **`rockHypothesis`** (appended to `stanceHypothesis` under the switch): every `solids` row with a `rockId`, not broken,
  not in `blocked`, whose `OBSTACLE_STRATEGIES` row is the registered `break`, and that the run's swing can break — the
  same two guards `resolveBreakStrategy` asks first: the primary is the sword (or a modelled ghost swing that
  `ghostSwingRefusal` passes), and `rockBreaksUnder(rockType, inventory)`. A rock the run cannot break stays a wall.
- **`bagWithDischarged`**: a `rock` entry is discharged in the bag's own `brokenRocks` (what a real break writes); only
  rock entries add the key, so a hypothesis without one returns the bag it always did. `stanceReaches` exempts a
  discharged rock's `proximity-hazard` like a discharged lock's.
- **`deriveSwingStance`** (two follow-ons, both MEASURED on the first ON solves, not reasoned to):
  1. a rock is never in its own swing stance's hypothesis (the first ON solve derived (168,136) — the rock's far side —
     for `breakablerock@176,128`, and the walk hit STANCE_REENTRY at t1188);
  2. under the switch every candidate is asked DIRECTLY before any is asked under the hypothesis — with the two
     neighbours hypothesised, (168,136) was still "reachable" through `breakablerock@176,144`, and the loop took it
     before trying the near-side cells directly.
- `stanceHypothesisProbe` — a read-only export for the test and the probe.

Nothing in `solveSegment`, `twoPassSolve`, `PendingDeclaration` or `createRunForStaging` changed. No new
`SolverRefusal.obstacle.kind`, no new staging/result field. No shared table row was added or reworded.

**Measured ON** (node, survey step 124's staging re-pointed): leg 378 **SOLVED 1,543 t** (`brave` iceturret@472,400,
`kill` puncher@816,128, `hold` t0, `break` rock@176,128, `hold` t1, collect); leg 381 **SOLVED 1,597 t** (`brave`, `hold`,
`kill` spinner@192,128, `break`, `hold`, collect). Model replays: 0 hits; `{40,7}` t1088/t993 < the rocks t1231–1253 /
t1252–1305 < `{40,1}` t1263/t1313. From the cluster's own boot (272,224): OFF refuses with the legs' sentence; ON
solves in 451 t (11 s). Each arrival solve costs ~16–20 min on this box, mostly chaser previews of L40's bobs
(profiled: `previewWalk` → `chaserStep` → `collidesSolid`) — SOLVECOST's region, noted not touched.

**Mutants** (predicted first; made by copy + restore, `cmp` clean after; `fidelityL40Button` D2 rows):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | drop the `rockHypothesis` append | the hypothesis row and the cluster-boot row red | ✔ exactly those 2 red |
| M2 | drop the self-exclusion filter | green (the direct-first pass finds the near-side stance first) | ✔ green — on every measured case the self-exclusion is a guard, not load-bearing |
| M3 | drop the direct-first pass | the cluster-boot row red (far-side stance) | ✔ exactly that row red |

## D3 — witnesses and the census (PASS, with a hand-over)

**Game witnesses** (p4f, headless, port 9631; `plan-seedling-l40button-witness.mjs` authors them from the ON solver,
`withStanceRocks` for its own solves only; staged as the survey stages: `r8-solve-11`'s block re-pointed at the arrival,
items `canSwim, hasFire, hasShield, hasTorch`, keys [0, 1, 2]):

| tape | leg | obs | `--record` | check mode |
|---|---|---|---|---|
| `l40button-l41-part0` | 378 (from L41, (928,96)) | 1,544 | *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE"* — ALL CHECKS PASSED | live game matches the committed oracle stream |
| `l40button-l42-part0` | 381 (from L42, (848,16)) | 1,598 | same | same |

The game collects the part in both (`hasTotemPart` and the pickup's dead frames agree). `tapeRunner` holds both at 0 px
(`JS stream matches the real game recording, exactly`).

**⛔ They are recorded with `noDamage: true`, and that is a finding, not a convenience.** The first recordings (damage on,
the same inputs) were refused by the differential: *"THE RECORDING IS VALID AND THE MODEL IS REFUTED"* at leg 381 t1065
(dx −3.46) and leg 378 t1154 (dx −3.40). Measured on the game (a one-off `botMobiles()` dump around the tick):

- the player stands on `buttonroom@272,208` (280.7,215.3) with no input, waiting out group 0's 101-tick fade;
- a `Bomb` row (16×16, vy 2.11, `angle += 15`) closes on it; at t1064 `hits` 0 → 1, `hits_timer` 20, vx −3.71, and the
  stream parts the next tick (decaying westward knockback);
- the source is `bombpusher@112,128` (`Enemies/BombPusher.as`: `activeOffScreen`, `maxDistance` 256 — the player is
  157 px away; `Projectiles/Bomb.as`: aimed at the player's position at launch, 30 updates, then
  `new Explosion(x, y, hitables, 24)`);
- L40's bobs are NOT the cause: `probe-seedling-chaser-mobiles.mjs --class=Bob` agrees on 12,960 comparisons up to t1071
  and drifts only after the player moves.

The model steps no `BombPusher` emitter (`combat.js` describes the lobber; `levelRun`'s `applyExplosion` serves the boss
shots only), so model and solver see a quiet room. `Player.hit` returns at its first line under `Bot.noDamage`
(knockback included), so the `noDamage` recording isolates the ROUTE. Sweep-3's leg 381 *"diverged not-exact at
t=1065"* is this same bomb (the same tick). The damage-on tapes and game streams, and the Bob probe log, are in
`CC/docs/cloud-reports/seedling-fidelity-l40button-evidence/`.

**The sweep legs (before → after, by key):**

| leg (sweep-4 id) | key | before (sweep-4) | after, switch OFF | after, switch ON (predicted from the node solve and the game recordings) |
|---|---|---|---|---|
| 378 | `… <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` | REFUSED (no reachable stance; names `wandlock@448,432`) | = (reproduced locally on p4f) | SOLVED by the solver; the wasm play then **diverges not-exact at ≈t1154** (the bomb) |
| 381 | `… <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | REFUSED (same) | = | SOLVED; **diverges not-exact at ≈t1065** (the bomb) |

So the switch moves both legs from a solver refusal to the bomb, which is the honest next wall.

**The survey's L40 steps** (CI 38107331670 → local ON, `SEEDLING_STANCE_ROCKS=1 survey-seedling-route.mjs --through=end
--route=full --only=78,124,126,139 --timeout=5400`): **no row moves.**

| step | boot | CI | ON |
|---|---|---|---|
| 78 | L40 (480,896) — south | REFUSED VERB-APPLY (`shove` on `pushableblockfire@576,576`) | = (same text) |
| 124 | L40 (480,896) — south | REFUSED STANCE-REENTRY (`hold` of `wandlock@448,432`) | = (same text) |
| 126 | L40 (928,96) | SOLVED 70 t | = 70 t |
| 139 | L40 (480,896) | SOLVED 172 t | = 172 t |

Step 124 is the same goal from the L39 side and is a DIFFERENT gap (residue below).

### The CI dispatches the planner should run

The sweep's solver runs in the page, which has no `process.env`, so an ON measurement needs a branch whose default is ON:
my head plus

```diff
-export const STANCE_ROCKS = { enabled: globalThis.process?.env?.SEEDLING_STANCE_ROCKS === '1' };
+export const STANCE_ROCKS = { enabled: globalThis.process?.env?.SEEDLING_STANCE_ROCKS !== '0' };
```

in `frontend/modules/seedlingDemo/solverBot.js`, and the one default pin in `fidelityL40Button.test.js`
(`STANCE_ROCKS ships OFF` → ON). Then:

- sweep ON: `gh workflow run seedling-divergence-sweep.yml -R PeerInfinity/Archipelago-CC --ref <flip-branch>
  -f producer=solver -f mode=inv -f ids=378,381` — expected: both legs leave the refusal and diverge not-exact at the
  bomb (≈t1154 / ≈t1065). (Leg ids are at this head's derivation, 843 legs, = sweep-4's; the keys are above.)
- sweep OFF control: the same on `claude/seedling-l40-button-route-491l6g` — expected: the sweep-4 refusals, unchanged.
- survey (optional; nothing moves): `gh workflow run seedling-survey.yml -R PeerInfinity/Archipelago-CC --ref <flip-branch>
  -f route=full -f through=end -f only=78,124,126,139 -f base_run=38107331670`.
- the tier calibration (see Records): a full-tier differential run to re-measure `CI_TIER_CALIBRATION.sharded`.

## Byte-inertia (the switch OFF)

| row | result |
|---|---|
| identity block AFTER (`099e289` tree) | every value row = W0 (maze, acceptance, c3/c6/c4, ENEMY, guard, AREA, killgate s2/s5/s9, pre/post-sword); log md5 `c4c451d2cf21b6e0ddf0ae164fbbe4b9`. Its generated-set row was refused because my recording held the box lock; re-run alone: `OK` |
| six producer `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0 (= W0) |
| tapeRunner AFTER | **609** rows, md5 `e876e527a9431be58c3a4d43d2c69686`, 0 non-pass: the 605 W0 rows byte-identical + 4 (two per new witness) |
| bounded AFTER | **72 files / 2,757 tests, all green**, md5 `84b66c37b613d851e51e7e7c81193217`. Against BEFORE: + the 6 `fidelityL40Button` rows, + 2 manifest rows (the new tapes), and the two roster-count names 274 → 276. Every other row identical |
| survey L40 steps | ON = CI on every row (above); OFF is the unchanged code path |
| committed tapes | none move (tapeRunner) |

## Switch ON: everything measured, for the licence

| row | result |
|---|---|
| bounded set + tapeRunner ON (`SEEDLING_STANCE_ROCKS=1`, 73 files, 3,366 tests) | red ONLY on `fidelityL40Button`'s default pin (`STANCE_ROCKS ships OFF`); every other row = OFF |
| identity block + six producer `--check`s ON (`SEEDLING_STANCE_ROCKS=1 … identity-block.sh .` at `765d3b2`) | every value row = OFF's (generated set `OK`); `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0; reference ALL 7 + 5 MATCH; log md5 `3a48647f548c821267c3e60cf0ddc496` |
| survey movers ON | none (78, 124, 126, 139 measured) |
| sweep movers ON (predicted) | legs 378, 381: refusal → solved, then a not-exact divergence at the bomb |
| committed tapes | none move |

## Records

| row | result |
|---|---|
| surface | `census-seedling-solver-surface --write`: site counts only (no new symbol row) → **GREEN 265** |
| constants | **PASS 5,623** (no new literal) |
| entities / profile | **PASS 535** · **PASS 138** (both) |
| roster | **274 → 276** (`l40button-l41-part0`, `l40button-l42-part0`); `generate-tape-index.mjs --check` OK |
| pins (by name) | `tapeEnvelope` 276; `observationTolerance` 276 and swapped 276 (measured); `dialogueAutoAdvance` 276 / 275; `tapeIndexManifest` (derived, green); `R8_D2_SHIELD.pressExposure.reachingAdded` + `l40button-l42-part0` (its walk kills `spinner@192,128`) |
| reference | regenerated: **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH**; `check-procgen-docs` ALL CHECKS PASSED. ⚠ My first regenerations flip-flopped because a background `check-procgen-help --in-place` was restoring the generated files under them; regenerated again once it exited |
| `check-procgen-help --in-place` | both new scripts PASS (HELP ok, IMPORT ok) |
| `boxLock` | no new box-taking instrument (the probe and the author are node-only; the one-off game dump was a scratch script) |
| second set | `docLinks`, `docsRender`, `procgenDocs/generated`, `checkProcgenHelp`, `procgenHelpBaseline` green; `rosterCategories` red on the composite row only (below) |
| bot doc / log | `seedling-bot.md` (the rock-hypothesis paragraph); `seedling-bot-log.md` L40BUTTON entry with trap candidates |
| CI (`JavaScript Unit Tests`) | `765d3b2`: run **38163917658**, unfiltered **19,714 / 19,716**; the 2 reds are both roster-growth BANK rows: `rosterCategories` composite (mechanic 214 → 216, `standing-values --write` is the planner's) and `fullTierEstimate` *"reproduces run 34734861224 (10 shards) … within 5 %"* → 6.04 % (green at base; its docblock: *"a roster that drifted far from the calibration's reds this row too"*). The slow battery printed no summary (the tool says "step cancelled?"; not investigated). This report commit is docs-only |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no force-push |
| cleanup | the generated-set run's untracked `scripts/procgen/.rl-*`/`.atlas-*` and `worlds/*_worldgen/` removed, never committed. The base worktree `../Archipelago-CC-w0` was removed after the comparisons and its server (port 9632) stopped by PID; the dev server on 9631 (PID 606) is left up |

## Deltas

- `solverBot.js`: `STANCE_ROCKS` / `withStanceRocks`, `rockHypothesis`, `stanceHypothesisProbe`; `stanceHypothesis`,
  `bagWithDischarged`, `stanceReaches`' exempt set and `deriveSwingStance` touched, each a no-op OFF.
- New instruments: `probe-seedling-l40button.mjs` (D1), `plan-seedling-l40button-witness.mjs` (D3 author).
- New test `fidelityL40Button.test.js` (6 rows). New tapes + expectations: the two witnesses.
- `r8Acceptance.js`: one `reachingAdded` row.
- Evidence: `CC/docs/cloud-reports/seedling-fidelity-l40button-evidence/` (two damage-on tapes, their game streams, the
  Bob probe log).

## What the brief got wrong (measured)

1. *"Its prerequisite `wandlock@448,432` (group t=2) …"* — not a prerequisite of this goal from these arrivals. It is in no
   flood arm's reach or way; the refusal listed it because the sweep had nothing else to list.
2. *"Which Solid can sit on `button@480,384`"* — moot for legs 378/381. (For the record: R5/R7 measured that the
   IceTurret's corpse can, bumped by two fire presses, and `pushableblockfire@480,480` can reach `button@768,400` once it
   does — `L40_CORPSE`, `L40_ARRIVAL_BREAK.supersededBy`. That chain belongs to the SOUTH arrival, below.)
3. *"Likely wave 11's WAND_VERB (ON) exposed the wandlock route"* — the wandlocks were already in the hypothesis through
   `hold`; the missing piece was the rocks. WAND only changed which wall the refusal names first.
4. *"Sweep-3 … 381 diverged not-exact at t=1065"* — that divergence was the bomb, not the route: it is the same tick at
   which the damage-on recording of this slice's plan leaves the model.

## Hand-overs and residue

- **BombPusher's Bomb (new model-coverage work order; enemy projectile + danger pricing).** `bombpusher@112,128` lobs a
  deterministic `Bomb` (`shotTimeMax` 15 between shots, a 5-frame "shoot" anim, aimed at the player at launch, 30
  updates, `Explosion` r 24 at removal, `hitables` Player/Enemy/ShieldBoss). The model has an `Explosion` arm
  (`applyExplosion`) but no emitter. The solver then needs to price standing within 256 px of a lobber (the 101-tick
  lock fade on `buttonroom@272,208` is the measured case). Evidence: the two `bomb-refuted-*` pairs. Region: whoever
  owns enemy projectiles / the danger map (LEASH is chasers only; nothing here belongs to the hammer arc).
- **Step 124 / step 78 (the SOUTH arrival, (480,896)).** Same goal from L39. Its frontier picks group 2's `hold` first
  (STANCE_REENTRY: the button's stance is behind its own lock). The model's floods say links 1–3 (chest, tree burn,
  `buttonroom@880,768`) plus `bosslock@480,352` — whose key the step's staging holds — reach the north half and the NW
  cluster without group 2. That is L12KEYLINE's "the frontier tries the next door", extended to a STANCE_REENTRY refusal,
  plus a long chain; not widened into this slice.
- **Solver cost:** each north-arrival solve is ~16–20 min here (chaser previews of L40's bobs) — SOLVECOST's region. On
  CI the survey's per-step timeout is 1,500 s by default; a sweep page bound may need the same headroom.
- **Nothing for the hammer arc. The JS arc wires nothing:** no contract, field or obstacle kind changed; the browser
  solver reads the switch's code default, so a flip reaches it with no wiring.

## Rows to BANK

- `STANCE_ROCKS` OFF; tapes `l40button-l41-part0`, `l40button-l42-part0` (+ expectations); roster **276**; tapeRunner
  **609** (`e876e527`); `fidelityL40Button` 6 rows; `R8_D2_SHIELD.reachingAdded` + `l40button-l42-part0`.
- `rosterCategories` composite: mechanic **214 → 216** (`standing-values --write`).
- `fullTierEstimate` / `CI_TIER_CALIBRATION.sharded`: 6.04 % at 276 tapes — re-calibrate from a full-tier CI run.
- Surface GREEN 265 (site counts), constants 5,623, entities 535, profile 138.
- Licence question for the user: flip `STANCE_ROCKS`. Measured movers: no committed tape, no producer digest (identity block ON = OFF), no survey row; the bounded set ON is red only on the one default pin. Predicted sweep movers: legs 378
  and 381 (to the bomb).
