# Seedling fidelity BOSSFORK — the King of Fire and the Tentacled Beast, wired to the solver and the survey

Session `seedling-fidelity-bossfork` (cloud), planner `seedling-fidelity-planning-9`, wave 22.

| | |
|---|---|
| Start SHA | `2408fc5a6e` (main, not rebased) |
| Head | the commit that adds this report (docs only, under `CC/`, so it does not trigger the JS suite), on `4be48a0e` |
| Harness branch | `claude/seedling-boss-fork-ee5shl` |
| Verdicts | **W0 PASS · D1 PASS (+ D1b) · D2 PASS · D3 PASS · D4 PASS (measured; not in my region)** |

## The one thing to know first

**ON, both bosses now solve from the sweep's own requests, and every new answer is witnessed on p4g.** The clear-tag
arm now hands the boss executors the segment's existing fork. Leg 665 (King of Fire) goes from refused (variant 0 dies
at spent 691) to SOLVED 870 t. A stand-in for 667 goes from refused (spent 707) to SOLVED 865 t. Both answers were
played on the game and hold at 0 px. Three Tentacled Beast mouth bugs are fixed:
- a reach-exit asked while the beast is "dying" now waits for the mouth;
- a cleared L57 builds its mouth at the build;
- the route survey answers the mouth from the model's cleared build.

OFF everything is byte-identical: the full route survey equals the base on all 250 rows, and the identity digests and
tapeRunner pairs are unchanged. **The remaining blocker for L57 in the survey is staging:** the survey stages L57
unsplit. With L57 staged split, steps 90 and 121 SOLVE 2060 t.

## W0 — the base (PASS)

Measured at a detached worktree of `2408fc5a6e` (`node_modules` symlinked; the venv activated for the identity block).

| row | base | after (`083dadb4`; code unchanged after it) |
|---|---|---|
| identity digests (maze … level post-sword s1, six producer `--check`s) | all equal (`w0/identity-base-venv.log`) | **all equal** |
| identity `generated set` | the box-lock text (my AFTER run held the box when this row ran) | OK |
| identity `reference --check` | 4 regions DIFFER (environmental: registry/capabilities/two substrate regions) | 6, then **4 after the docs-index regeneration** (`4be48a0e`) |
| solver surface | GREEN 338 | **GREEN 340** (two rows classified: `TENTACLE_BEAST_ANIMS`, `animTicks`) |
| constants | PASS 6,847 (worktree: AS3 absent, the column not compared) | **PASS 6,851** (`--write`, 0 drift) |
| entities / profile | PASS 566 / 138 + 138 | = |
| roster | 289 | 289 (no tape added; witnesses are fixtures) |
| tapeRunner pairs | 635 `e164838673a48b38ce187093c363edb2` 0 non-pass | **=** |
| bounded vitest (84 files, `w0/vitest-files.txt`) | 2,178 / 2,184 + 6 skipped, 0 failed. 4 files did not load in the worktree (no wasm `builds.json`) | **2,321 / 2,322**: the one red is `seedlingAtlasArm.test.js` > `seedling_atlas_location is a FUNCTION…`, *"Cannot find module '../bulletml-dodge/src/game/tracks.js'"*. The `bulletml-dodge` submodule is not checked out in this container, so the red is environmental and outside my diff. |

## D1 — the fork reaches the boss executors (PASS)

**Measurement (the brief's premise, corrected).** The frontier arm already passes `fork` (`solverBot.js`, the
`walkTo` ladder's executor call, `fork, rewind`). The four arms that did not pass it are:
- the clear-tag general arm (`clearTagExecutor(verb)(…)`, where both boss clear-tags go);
- the placement-blocker arm (`STRATEGY_EXECUTORS[strategy](run, perTick, resolvedBlocker, …)`);
- the cross-room press;
- the Lights arm.

**Change.** `fork` is added to the clear-tag general arm and the placement-blocker arm. The fork closure,
`replayOntoFork` and `replayToTick` are not touched. The other two arms have no fork reader (`hold`/`press`/`lights`).

**Who reads `ctx.fork`:** `execBait` (only through `frontierExecutor`, so this does not reach it), `execLavaBoss` and
`execTentacleBeast`. **OFF:** both boss resolvers return `held: false`, and their executors throw before reading
`ctx.fork`, so nothing moves.

| request (node, `replay-seedling-solve-request.mjs` / `solveAnytime`) | base | D1 |
|---|---|---|
| **665** (leg 664's captured request, goal → clear-tag {82,0}, the JS arc's mapping) | REFUSED: variant `{standY 168}` *"the player died at spent 691"* | **SOLVED 870 t**; tried [691 ✗, 923 ✗, 844 ✓], variant 2 `{standY 160, strike 20}`, 0 deaths; 1 answer over seam times −5..5 |
| **667 stand-in** (the same request with the arena rock {82,1} cleared; no ON 667 capture exists) | REFUSED (spent 707) | **SOLVED 865 t**; tried [707 ✗, 938 ✗, 853 ✓] |
| 667 as BOSSKILLS captured it ({82,0} cleared) | already-clear 0 t | = |
| L57 sequence (clear-tag + reach-exit), seeds 1–8 | SOLVED (2765/1047/1512/2450/2260/1364/955/1069 t) | **identical walks**; `tried` now records the fork's one winning play of variant 0 |
| JS arc's legs 505/506 (run 39659335148, captured) | SOLVED 3124 / 2924 t | = |

**Witnesses** (p4g, headless, `probe-seedling-bosskills.mjs --record`):

| witness | ticks | what it pins |
|---|---|---|
| `kof-fork-665` | 868 sampled of 870 | the solver's 665 answer: {82,0} earned t726, 0 hits |
| `kof-fork-667` | 856 sampled of 865 | the 667 stand-in's answer |

Both hold at 0 px in the model: `fidelityKingOfFire.test.js`, per tick: the player, the body, every ball and runner.

**Tests added:**
- `fidelityKingOfFire.test.js` `bossfork D1` × 2 legs. With a fork the record is the measured `tried` list and the
  walk equals the witness's tape. 665 differs only at t0/t2, where the segment also holds `primary`; 667 equals it
  exactly. Without a fork, variant 0's refusal comes back.
- The witness roster pin is now seven.

**Mutant** (predicted, copy + restore): drop `fork` from the clear-tag arm → the ON row reds with the variant-0 refusal
(spent 691), and the no-fork row passes. **Killed as predicted.**

### D1b — a reach-exit at the mouth while the beast is dying (PASS; found by measuring 505)

**What I found.** Leg 505's second request (run 39659335148, `wasm-continue-exit-57`, prefix 2866 t) is a bare
`reach-exit (96,64)`. The page asked it at t2866, two ticks after the report (t2864), while the beast was in its
61-update "dying". The mouth did not exist yet, so the solver refused: *"level 57 has no teleporter at (96,64)"* (page
and node agree). The leg still ended `done` because the page resumed its first plan.

**Change.** `awaitTentacleMouth` (`solverBot.js`, ON only) idles before a reach-exit at the mouth's cell while the fight
is dying with no mouth. It is bounded by the anim, and it refuses by name on a crossing, a hit or the bound.
`solverView` re-exports `TENTACLE_BEAST_ANIMS` and `animTicks` (the surface rule: the door).

**Measurement.** The request now SOLVES 258 t. It equals the first plan's tail (t2866–3124) tick for tick, and the
sweep already played that tail on the game.

**Test.** From `tb-solve-s2`'s t789 (report t787, "dying"), the reach-exit's walk is the witness's own tape (1047 t).

**Mutant:** drop the call → the row reds with the old refusal. **Killed as predicted.**

## D2 — a cleared L57 builds with the mouth (PASS)

**Change** (`levelRun.js`, ON only). `tentacleMouthAtBuild` asks `tentacleFightFor(level)` at the boot's build and in
`enterWorld` (after `freshVisitState`), and only when the room's beast tag is cleared. A live beast's stream still
opens on the first step's ask. **No new per-visit map:** the mouth arrives as a new `world` object, which the digest's
world memo already keys. `DIGEST_EXEMPT` and `stateDigestParts` are untouched.

**Witnesses:**
- **The revisit, re-run on p4g:** `bosskills-evidence/d1/revisit-57.json` again reaches L58 at t162, and the model ON
  matches all 163 ticks. `run.world` at the build: before D2 `[]`; after D2 `["96,64->L58(tentacle_beast_mouth)"]`.
- **New: `tb-enter-cleared`** (p4g, 121 t). L58 → the L57 door with {57,0} cleared lands the player ON the mouth at
  (104,72), and **the game keeps them in L57 for all 120 ticks.**
  - Before D2 the model built the mouth one step late, after the arrival's latch, and **walked the player back into L58
    at t3**. That was a real fidelity bug, not only F2's "the world lacks the mouth".
  - The witness test skips the generator check for a beast BUILT dead: it has no stream and owes no draws, so the model
    claims no generator state.

**Mutants:**
- M-D2a: drop the boot call → the "at the build" row reds.
- M-D2b: drop the `enterWorld` call → `tb-enter-cleared` reds at t3 (L58 (64,104) vs the game's L57 (104,72)).

Both were killed as predicted.

## D3 — the survey's `hopEdge` (PASS)

**Change** (`survey-seedling-route.mjs`, ON only). As LIGHTS did for L69, `out_tentaclebeast_80_48` is answered from a
run built on L57 with the beast's tag cleared (D2): the mouth Teleporter (96,64) → L58 (56,96), `death: true`. The
crossing pushes `clear-tag` on the beast's tag before the `reach-exit`, unless the visit already clears it; this is the
JS runtime's own `FIGHT_EXITS` shape. OFF the loop breaks at once and nothing is built.

**Full survey, local** (`--through=end --route=full`, 250 steps at this base):

| | SOLVED | REFUSED | NO-EDGE | NO-ARRIVAL |
|---|---|---|---|---|
| base `2408fc5a6e` OFF | 189 | 55 | 3 | 3 |
| head OFF | 189 | 55 | 3 | 3 (**every row equal to base**: verdict, ticks, refusal text) |
| head ON (`tentacleBeastFight` + `kingOfFireFight`) | 191 | 57 | 1 | 1 |

**Rows that move ON** (step ids at this base; match by level + goal):

| step | level, visit | OFF | ON |
|---|---|---|---|
| 90 | L57 v1 (route crosses the mouth) | NO-EDGE | REFUSED: the tentacle stream needs `rng: {split: true}` (the survey stages L57 from `r8-solve-11`, unsplit) |
| 121 | L57 v2 (the report leg) | NO-EDGE | REFUSED (same premise) |
| 91 / 122 | L58 | NO-ARRIVAL | REFUSED: L58's own `teleporter@80,16` is DEACTIVATED (tag 1) by the staging, a different blocker |
| 199 / 220 | L82 | REFUSED | **SOLVED 1363 t**: BOSSKILLS' 203/224; frontier path, unchanged by D1 |

With L57 staged `split: true` (a scratch edit, not committed: `d3/on-split.log`), **90 and 121 SOLVE 2060 t, 0 hits**.

## D4 — where the ~110 s of 505/506 goes (PASS: measured, and it is not the solver)

From run 39659335148 (ON, `leg_budget_ms` 240000):

| leg | leg ms | ticks played | solve ms (page) | node replay |
|---|---|---|---|---|
| 506 | 101,603 | 2,925 | 433 | 0.8 s |
| 505 | 111,237 | 3,124 (interrupted at 2,866 and resumed) | 768 | 1.1 s |

The runner plays 28.8 ticks/s (`RUNNER-MEDIAN`), so 2,925 / 28.8 ≈ 101.6 s and 3,124 / 28.8 ≈ 108 s. **The cost is the
page playing a ~3,000-tick fight, not the search.** A leg budget must exceed roughly ticks / 28.8 s plus boot. That is
the JS arc's runner; nothing in my region would shorten it except a shorter fight policy. I did not tune any budget.

## Survey / sweep rows this moves, and the dispatches to run

I cannot dispatch (403). The exact dispatches:

1. **Survey OFF:** `seedling-survey.yml` on `claude/seedling-boss-fork-ee5shl`, `through=end route=full`.
   **Expected:** every row = main's (local: 250/250 equal to base).
2. **Survey ON:** a one-line scratch branch off this branch with `tentacleBeastFight: true` and `kingOfFireFight: true`
   in `contactFidelity.js`, `through=end route=full`. **Expected:** 191 / 57 / 1 / 1. The movers are as in the table
   above: L57 90/121 → REFUSED (split premise), L58 91/122 → REFUSED (L58 teleporter tag 1), L82 199/220 → SOLVED 1363.
3. **Keyed sweep ×2**, run each arm twice: `seedling-divergence-sweep.yml` on `claude/seedling-boss-fork-ee5shl`,
   `mode=inv producer=solver capture_requests=true leg_budget_ms=240000`.
   - **keys:** `level_57 <- in_pit_L56_6_10 -> exit:out_tentaclebeast_80_48|level_57 <- in_pit_L56_6_10 -> location:Level 057 - Tentacled Beast|level_57 <- in_L58_48_112 -> exit:out_tentaclebeast_80_48|level_57 <- in_L58_48_112 -> location:Level 057 - Tentacled Beast|level_82 <- in_pit_L71_10_17 -> exit:out_teleporter_144_0|level_82 <- in_pit_L71_10_17 -> location:Level 082 - King of Fire|level_82 <- in_L96_32_64 -> exit:out_teleporter_144_0|level_82 <- in_L96_32_64 -> location:Level 082 - King of Fire`
   - **A** (`contact_fidelity`, the 36 default-ON keys at this base + the two switches): `collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,strikeIframeLapse,fallRockPostFall,forecastSpeedByTerrain,buttonFallReleaseStep,waypointSlide,lavaChainPlayerHit,ceremonyShove,flyerLive,beamTowerDrift,beamTowerBeamHit,spinningAxePlayerHit,sealDoorApproach,axeTimingRung,axeGateTransit,statueTalkRange,watcherTalkVerb,apReportBosses,guardApproachStance,coveredGoalRefusal,shakeBandMoot,spinnerSwingLineOfSight,kingOfFireFight,tentacleBeastFight`
   - **B:** the same list without `,kingOfFireFight,tentacleBeastFight`. ⚠ If main has gained default-ON keys by the
     time this runs (the `igneousLava` flip), add them to both arms: an unlisted key is OFF.
   - **Expected A:** 665 **done** (was refused on variant 0). 667 done if its arrival leaves {82,0} uncleared (the
     stand-in), or already-clear. 505/506 done as in 39659335148; 505's continue request now SOLVES instead of
     refusing, so its history has no `interrupted`. 664/666 done (BOSSKILLS). 507/508 unknown: no ON capture exists,
     and the L58 arrival lands on the mouth's cell.
   - **Expected B:** = the control run 39660696002 (665/667/506/508 unresolved: the vanilla arm; 664/666/505/507
     failed).

## The JS arc's pins and what it must wire

- **No contract or signature change:** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`.
  No new `SolverRefusal.obstacle.kind`; D1b's refusals carry `{goal}`.
- **No JS-arc pin moved** (`jsRuntimeBossWiring`, `seedlingVanillaArmMap` green).
- **The JS wiring's note *"a cleared beast … the model builds it only when the fight is first asked"* is now false
  ON:** the cleared build holds the mouth. Its plain-door mapping for a cleared L57 can read the model's mouth instead.
- **Staging (still the JS arc's or the survey's):**
  - the survey's L57 block must be `split: true` for 90/121 to solve;
  - the sweep's `rngSplitAtArrival.echo` is false on every L57 leg (BOSSKILLS' hand-over stands).
- The page's continue request after a clear-tag no longer needs special handling for the mouth (D1b).

## Handed over

- **Hammer arc:** nothing is in its region. The fork, `replayOntoFork` and the digest are untouched. `solveSegment`'s
  `forkRun` docblock still lists "two readers" (`bait`, the fight fallback); the boss executors have read `ctx.fork`
  since BOSSKILLS. The doc is stale, not the contract.
- **Rules:** the sidecar's `target_spawn` for `in_tentacle_beast_mouth_L57_56_96` is (48,96). The game's Teleporter
  puts the player at `playerx/playery` (56,96), which BOSSKILLS D1 measured: L58 at (64,104) = (56,96) + 8. The survey
  uses the model's (56,96).
- **Survey staging:** L58's `teleporter@80,16` (tag 1) is deactivated by the staged persistence, so 91/122 refuse on
  that once they have an arrival. It is a separate blocker from the mouth.

## Deltas (files)

**Code:**
- `solverBot.js`: `fork` in two arms; `awaitTentacleMouth` and its call.
- `solverView.js`: two re-exports.
- `levelRun.js`: `tentacleMouthAtBuild` and two calls.
- `survey-seedling-route.mjs`: `TENTACLE_MOUTH_EDGES`, `tentacleMouthEdgeOf`, `tentacleMouthEdge`,
  `tentacleMouthFightGoal`, the `hopEdge` arm, and the crossing's fight goal.

**Tests:**
- `fidelityKingOfFire.test.js`: the roster pin → 7, and the `bossfork D1` rows.
- `fidelityTentacleBeast.test.js`: the roster pin → 5, the dead-build generator skip, `bossfork D2` and `bossfork D1b`.

**Fixtures:** `lavaboss-witness/kof-fork-665.json`, `kof-fork-667.json`; `tentaclebeast-witness/tb-enter-cleared.json`.

**Censuses:** solver surface (`--write`, two rows classified), constants (`--write`).

**Docs:** `seedling-bot-log.md` entry; the docs index (`docsIndex.js`, the README region).

## What the brief got wrong (measured)

1. *"the frontier arm calls it with `{maxTicksPerTarget, economies, dashMode, what, before, walkTo, goal, equip, rewind}`
   (≈ :24685)"* as the arm that kills him. That call is the **placement-blocker** arm, and it lacked `fork`. The
   frontier arm (the `walkTo` ladder) already passed `fork, rewind`, which is why the frontier kills him. The
   `{walkTo, goal, what, refuse}` call (≈ :24276) is the **Lights** arm, not the boss clear-tag. The boss clear-tag is
   the general `clearTagExecutor(verb)(…)` call.
2. *"505/506 need ~111 s / ~102 s"* reads as solve cost. It is play time: the solves take 433 / 768 ms on the page and
   about 1 s in node. The rest is ~3,000 ticks at 28.8 ticks/s.
3. F2 said a cleared L57 *lacks the mouth until the fight is first asked*. That is true, and the effect was larger than
   that: an arrival from L58 lands on the mouth's cell and bounced back to L58. The game does not bounce.
4. Not the brief's: the D3 edge alone did not make 90/121 reachable. The route crosses the mouth on visit 1 without a
   kill goal, so the crossing needed the fight added (`tentacleMouthFightGoal`).

## Residue

- **667 has no ON capture.** Its witness is a stand-in built from 664's request ({82,1} cleared).
- **No ON capture exists for 507/508** (arrival from L58 onto the live beast's mouth cell).
- **The tentacle policy commits a variant that takes a hit.** It only rejects deaths on the fork; leg 505/506's plan
  takes one swipe at t1257 (`tentacle#47`). The game and the model agree on that hit, and the sweep flags it as
  UNBILLED. Preferring a hitless variant on the fork is a policy choice I did not make.
- **L57 in the survey still refuses** on its unsplit staging, and L58 on its tag-1 teleporter (both outside my
  region).

## Byte-inertia

**OFF:**
- every identity digest and producer `--check` is equal at base and at `083dadb4`;
- tapeRunner pairs are equal (635 `e1648386…`);
- the full route survey is equal on all 250 rows;
- the bounded vitest is green except the environmental `bulletml-dodge` red.

Every code change is gated by `CONTACT_FIDELITY.tentacleBeastFight` / `kingOfFireFight`, or is unreachable OFF (the boss
executors throw before reading `ctx.fork`). No committed tape or producer digest moved.

## Rows to BANK

- identity OFF = base (all digests above, `after/identity-after.log`); tapeRunner pairs 635 `e164838673a48b38ce187093c363edb2`.
- surface GREEN 340 · constants PASS 6,851 · entities 566 · profile 138 · roster 289.
- witnesses: lavaboss 7 (+ `kof-fork-665` 870 t, `kof-fork-667` 865 t); tentaclebeast 5 (+ `tb-enter-cleared` 121 t); all 0 px.
- survey local: OFF 189/55/3/3 = base; ON (both switches) 191/57/1/1.
- node: leg 665 SOLVED 870 t; leg 505 request 1 SOLVED 258 t (= request 0's tail).
- CI (`JavaScript Unit Tests`) at `4be48a0e`, run 39671333564: 21,786 / 21,786, slow 261 / 261.

## CI at the last code head

`node scripts/procgen/ci-vitest-summary.mjs 4be48a0e`, run **39671333564**: all four jobs succeeded.
- **suite: vitest (unfiltered) 21,786 / 21,786** (0 skipped, 0 failed), across shards 7,509 / 7,417 / 6,860.
- **slow battery 261 / 261**.

Earlier heads' runs were cancelled by the next push.

Not run: `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or
force-push; no AS3, wasm, gitlink or rules edit.
