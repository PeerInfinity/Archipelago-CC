# Seedling hammer WALLFLYER-DRILL-KILL: kill arms for a wallflyer and a drill on the combat ladder

Session `seedling-hammer-wallflyer-drill-kill` (Opus, cloud). Planner `seedling-hammer-phase-planning-8`. ⚖ The user
approved the slice on 2026-11-14 (the hammer replan): *"…,Wallflyer + drill kill arms"*.
Evidence: `seedling-hammer-wallflyer-drill-kill-evidence/`, beside this file.

## 1. SHAs

| | |
|---|---|
| Start | `4c3afd9b32` (`origin/hammer-harvest-wave2`) + `git merge origin/fidelity-flip/corridor` (tip `5d40e8ce`) = merge `285b9584` (clean, no conflict) |
| Head | the commit carrying this report. Code: `d6cd5178` arms · `02438c6f` rows + fixtures · `a39ab4c3` surface regen |
| Branch | `claude/seedling-wallflyer-drill-kill-c623c0` |

## 2. The answer first

**Two switches, both OFF:** `WALLFLYER_KILL_ARM` (`SEEDLING_WALLFLYER_KILL_ARM=1`) and `DRILL_KILL_ARM`
(`SEEDLING_DRILL_KILL_ARM=1`), with `withWallFlyerKillArm` / `withDrillKillArm`. **Both arms were built. Each one
alone solves its family's lost solves.**

With the corridor flip ON, all **four lost solves** become **hitless SOLVED** when the arms are ON:

| lost solve | flip ON today | arms ON | game (p4g) |
|---|---|---|---|
| survey step 35, L22 → L29 | REFUSED, EXHAUSTED at `wallflyer@48,112` | **SOLVED 539 t, 0 hits** (two wallflyers killed) | **0 hits**, crosses at t539 |
| survey step 84, L88 → L87 | REFUSED, EXHAUSTED at `drill@128,160` | **SOLVED 354 t, 0 hits** (drill killed) | **0 hits**, crosses at t354 |
| leg `level_27 <- in_L28_128_304 -> exit:out_teleporter_32_0` | REFUSED, `wallflyer@192,48` | **done 203 t, 0 hits** | model only |
| leg `level_88 <- in_L12_304_0 -> exit:out_teleporter_32_0` | REFUSED, drill | **done 354 t, 0 hits** | = step 84's plan (same 354 t) |
| leg `level_88 <- in_L12_304_0 -> exit:out_teleporter_192_0` | REFUSED, drill | **done 344 t, 0 hits** | model only |

**The census** covers all 53 seed-1 sweep legs in the six rooms that hold a wallflyer or a drill, plus 3 keylock
controls: **3 move** (the three lost legs above), **53 are identical**, and **0 hitless legs become hit-taking**.

**The full route survey** (250 steps): 219/31 → **221/29**. Only steps 35 and 84 move, and 247 rows are
identical. The 3 hit-taking solves (steps 24, 202 and 220) are the same in both arms.

**Acceptance md5** `391322d681b7aa0229d94b3f6906d024`: OFF and ON alike, equal to base main `39e8a29f7f`.

**The one thing to know first:** neither arm needed a levelRun edit. The model already steps a press on a wallflyer
(`hitWallFlyer`, `wallFlyerKill` ON) and on a drill (DRILLKILL). The arms do not put flyers into `strikeBodies` or
the corridor forecast. Instead, each one **plays its kill on a fork** of the solve and replays it on the live run
key for key, as `orbitKillChaser` does. The arms read one surface that is new to the solver: `run.wallFlyers`, an
existing getter. It is now a classified row in the solver-surface table (§9 has the hand-over).

## 3. The reproduction (measured, at `285b9584`, flip ON)

| what | command | result |
|---|---|---|
| survey 35, 84 | `survey-seedling-route.mjs --through=end --route=full --only=35,84` | both **REFUSED**, as the brief says. **35**: *"EXHAUSTED … chaser:wallflyer@48,112 …"*, and the KILL rung's chooser picks `bob@96,144` (*"no presser in level 22 arms a trap…"*, *"bob@96,144 is not a body this run steps"*). **84**: *"EXHAUSTED … chaser:drill@128,160"*, KILL *"not a body this run can watch die"*, BAIT *"this room's live roster is [empty]"*. 14.1 s / 11.5 s (`repro/survey-35-84-base.jsonl`) |
| the 3 legs by KEY | `drivers/legs3.sh` (CORRIDORFLIP's `inv-leg.mjs` with `--key=`, over sweep 43136081951's `legs.jsonl` / `rows.jsonl` / `delivered-set.json`, downloaded from the run's artifacts) | all 3 **REFUSED** at the bodies the brief names (`repro/legs-flip-arms-absent.jsonl`). With the flip OFF (`SEEDLING_CORRIDOR_BODY_PRICING=0`) they are CORRIDORFLIP's hit-taking plans: 126 t (t16 wallflyer), 476 t (t48, t110 drill), 379 t (t48, t114) (`repro/legs-flip-off.jsonl`) |

**What a hitless line needs:**

- **Wallflyer.** L22 is a 13×13-tile room. Its route north crosses two horizontal lanes, y=120 and y=88, and each
  lane has a resting flyer at both ends. A flyer's ray (`decideMotion` away from its wall, `attackRange` 160) covers
  its whole lane, so every crossing launches it at 4 px/t. Three facts open a kill:
  - a flyer at REST launches only on its ray;
  - a struck flyer is knocked back by `v = -v`, which moves a resting one nowhere;
  - `hitPlayer` needs the boxes to overlap.

  So the kill is: strike it where it rests, from a stance OFF its ray. Measured from the step-35 boot
  (`drivers/flyer-try.mjs`): walk to (56,138) under `wallflyer@48,112`, face up, and press whenever its `hitsTimer`
  is out. That gives three presses at t35/t66/t97, "killed" at t97, "destroyed" at t111, "removed" at t122,
  **0 player hits**.
- **Drill.** L88's only shaft north from the arrival runs past `drill@128,160`. DRILLKILL's executor
  (`drillKillStances` / `execDrillKill`: pre-stance at `runRange`, creep, fight, removal) already kills one hitless,
  but it ran only ahead of L28's rope cut. What "watch die" lacked was an arm on the ladder that asks for that kill.
  The run does observe the death: `drillBodies` loses the body.

## 4. Design and change

**Design** (stated before the build): at the KILL rung's fall-through, after every existing arm has refused and
before NARROW/DETOUR, `bodyFamilyKillOnLadder` reads the probe's `hit.sources`. It acts only on a source that is a
**live** body of an enabled family: a wallflyer in `run.wallFlyers` (not dying), or a drill in `drillBodies`. It is
generic by family, with no level, coordinate or Seedling constant.

| family | stances | the kill (played on a FORK) |
|---|---|---|
| wallflyer | a ring round the resting body: radii 16/18/14 px × 8 compass points, keeping free player boxes on plannable floor, nearest planned walk first | walk along the planner's waypoints, settle, face-tap, then press whenever `hitsTimer ≤ 1` and the slash is ready. Then wait out "die" and the fade. A launch (`v ≠ 0`) refuses the stance: that stance is in the ray, and the fork says so; we write no ray test of our own |
| drill | `drillKillStances` (DRILLKILL's) | `execDrillKill` (DRILLKILL's), its walk the fork's own |

- A fork is refused at the first player hit or death, a crossing, more than 2 unanswered presses, or the bound.
- The first clean fork is **replayed on the live run** key for key, with its slot selections at the same index. The
  replay must remove the body with no hit, or it `fail`s by name.
- A refusal spends no tick. It appends `body-family arm: …` to the KILL rung's why, and the ladder goes on as before.
- The weapon is `drillKillWeapon`'s: the primary sword or spear, else a held one's slot. Fire kills neither body, and
  that case is refused by name.
- Forks per asking: at most 8.

**Change** (`solverBot.js`, local): new functions beside DRILLKILL (`WALLFLYER_KILL_ARM`, `DRILL_KILL_ARM`,
`BODY_FAMILY_KILL`, `BODY_FAMILY_KILL_COUNTS`, `forkWalkTo`, `forkStep`, `wallFlyerKillStances`, `playWallFlyerKill`,
`playDrillKill`, `bodyFamilyKillOnLadder`). There is **one call site**: an `if` before the KILL rung's
`rowFor('kill', refused)`. `solverEnvChannel.js`: two `SOLVER_ENV_NAMES` rows. **Thread:** the solve worker / node
(`solverBot`). No main-thread mapper reads the switches, so `pageSolverEnvSwitchOn` is not needed.

**OFF identity:**
- OFF, the call site's guard is false: no function runs, no fork is made, and no word changes.
- Acceptance md5 (`node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`):
  - base main `39e8a29f7f`: `391322d681b7aa0229d94b3f6906d024` (the brief's value; CORRIDORFLIP measured the same with
    the flip ON);
  - head OFF: **`391322d681b7aa0229d94b3f6906d024`**;
  - head ON (both arms): **`391322d681b7aa0229d94b3f6906d024`**.

## 5. Rows and bounded vitest

`hammerWallFlyerDrillKill.test.js` (default tier, **6/6**, 14 s). The witness is the L27 leg, staged as the step-35
boot view moved to the leg's arrival (`fixtures/wallflyer-drill-kill/l27-from-l28-boot.json`).
- the switches ship OFF, env-named, and are in the channel; the wrappers restore;
- the flip is ON at this base (the witness needs it);
- **OFF:** EXHAUSTED at `wallflyer@192,48`, arm asked 0 times;
- **ON:** one wallflyer kill (1 fork), 0 hits, 0 deaths, L26, **203 t**, the flyer removed;
- **ON with only the drill arm:** the refusal is word for word the OFF one, asked 0 times. The two families are
  independent.

`hammerWallFlyerDrillKill.train.test.js` (train tier, **4/4**, 72 s; `npx vitest run --config vitest.train.config.js
<file>`):
- step 35 OFF EXHAUSTED at `wallflyer@48,112`; ON the kills are `[wallflyer@48,112 ×1 fork, wallflyer@64,80 ×1 fork]`,
  0 hits, L29, **539 t**;
- step 84 OFF EXHAUSTED at `drill@128,160`; ON (the drill arm alone) `[drill@128,160 ×1 fork]`, 0 hits, L87, **354 t**.

**Mutants** (predicted, then made by copy and restore; the source restored byte-equal, checked with `cmp`):

| mutant | predicted | measured |
|---|---|---|
| m2: the wallflyer press ignores the body's i-frames (`hitsTimer` gate dropped) | the ON row reds (presses unanswered, every fork refused) | **exactly that row** red, 5 green |
| m3: the call site ignores both switches | the OFF row and the drill-only row red | **exactly those 2** red, 4 green |

**Bounded vitest** (14 files, by path): `solverEnvChannel`, `seedlingDivergenceSolverEnv`, `seedlingSolverSurface`,
`seedlingConstantsCensus`, `hammerWallFlyerDrillKill`, `fidelityDrillKill`, `fidelityTimedPass`, `hammerDrillExitPass`,
`fidelityCorridorBody`, `contactFidelity`, `fidelityDrill`, `seedlingCanCross`, `hammerSpearArm`, `fidelityWallFlyer`.
Result: **274 passed / 1 failed**.

The one red is `hammerSpearArm` › *"OFF: a spear-only run walks strike-free into the death loop's stall"*, and **it
is red at the merged base `285b9584` too** (measured: the base's `solverBot.js`/`solverEnvChannel.js` swapped in, the
same row red, then restored). It is SPEAR-ARM's L22 row against the corridor flip: L22 now refuses by the ladder
instead of stalling, CORRIDORFLIP's wave-17 class. It is not this slice's; the planner's re-merge re-pins it.

**Generated:**
- `census-seedling-solver-surface.mjs --write`: 374 rows. +1 row `run:wallFlyers`, classified `seedling` /
  `live-state` with its why; the rest are line moves. `--check` is GREEN.
- `census-seedling-constants.mjs --check`: PASS.
- `generate-procgen-reference.mjs`: *ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH*, no diff.
- `generate-docs-index.mjs`: current, no diff.
- No docs edit under `docs/json/developer/procgen/`, so the procgenDocs pins are not owed.

## 6. Game witness (p4g)

`probe-seedling-chaser-mobiles.mjs --class=Bob --file=<walk> --player-hits --frames`, headless logic-only, its own dev
server on port 9790, both arms ON:

| plan | clock | game hits | crossing | end |
|---|---|---|---|---|
| survey step 35 ON (539 t) | shift `[0]` | **0** through t539 | L22 → **L29 at t539** | (24,232) = the model's |
| survey step 84 ON (354 t) | shift `[0]` | **0** through t354 | L88 → **L87 at t354** | (280,296) = the model's |

Step 35's Bob comparison: 129 comparisons, worst |Δ| 0. Step 84's Bob row "FAILs" with 0 comparisons because L88
has no Bob; CORRIDORFLIP's own 84 log reads the same. The witness is the player's `hits` and the crossing.

Files: `witness/walk-step-{35,84}-arms-on.json` (the walk tapes), `game-*-arms-on.log`,
`game-*-arms-on-rows.json` (`[t, level, hits, hits_timer, x, y]`, first frame per tick).

## 7. Census: seed-1 divergence-sweep legs the change can move

The rooms that hold a wallflyer or a drill (`seedling-map.json`) are wallflyer L22 (4), L25 (2), L27 (1) and drill
L28 (2), L88 (1), L91 (1). Of sweep 43136081951's 934 legs, **53** are in those rooms, and all 53 are in the census.
Three L12/L30 keylock keys were added as controls (CORRIDORFLIP's 56). Each leg was solved in node the way the page's
solver producer asks it (`ANYTIME_PASSES`, the sweep row's inventory), arms OFF vs ON
(`census/census-arms-{off,on}.jsonl`).

| | arms OFF (= today, flip ON) | arms ON |
|---|---|---|
| solved | 47 | **50** |
| refused | 9 | **6** |
| hit-taking solves | 0 | **0** |
| movers | — | **3**: the three lost legs, REFUSED → hitless (§2). The other **53 are identical** in outcome, ticks, end, verbs and hits |

**Why only these can move:** the arm is asked only at a KILL rung that has fallen through, and only for a hit source
that is a live wallflyer or drill. No other room steps either family.

**The 6 that stay refused:**
- **L91 ×2** (`level_91 <- in_L89_208_0 -> exit:out_teleporter_240_48`, `level_91 <- in_L92_32_144 ->
  exit:out_teleporter_16_144`): **the next named walls.** Both were refused before as well; this is no lost solve.
  - *"drill@64,80: no stance — north: (72,40) is not plannable floor | south … | west … | east: the walk wakes
    drill@64,80 at (45.3,125.3)"*: DRILLKILL's pre-stance geometry, `runRange` out on one axis, does not fit this room.
  - *"(120,88): the player was HIT waiting out the death at run tick 209 (source chaser bob@128,64)"*: the drill dies,
    but a bob reaches the player during the death wait.
- **L28 ×1** (a rope-boot refusal), **L12 ×2** and **L30 ×1** (keylock, *"cannot act … with this run's bag"*): the
  arm is not asked.

**Page budget:** the three movers under `BUDGET=640 WINDOW=85` answer exactly as unbudgeted (203 / 354 / 344 t, both
passes solving; `inv-leg.mjs` env). Unbudgeted wall time ON was 4.1 / 14.0 / 11.6 s
(`repro/legs-arms-on.jsonl`), against 3.5 / 14.3 / 11.2 s for today's refusals (`repro/legs-flip-arms-absent.jsonl`):
the arm's first fork kills, and DETOUR's previews are not asked.

### The full route survey, arms OFF vs ON

`survey-seedling-route.mjs --through=end --route=full`, both arms concurrently at `a39ab4c3`
(`survey/survey-arms-{off,on}.jsonl`). It has **250 rows**: CORRIDORFLIP quoted 244 at its base, and this base
carries hammer wave 2.

| | arms OFF (= today, flip ON) | arms ON |
|---|---|---|
| SOLVED / REFUSED | 219 / 31 | **221 / 29** |
| hit-taking solves | 3 (steps 24 L16, 202 L82, 220 L82) | the same 3, identical |
| movers | — | **step 35** REFUSED → SOLVED 539 t, 0 hits, 0 deaths, L29 · **step 84** REFUSED → SOLVED 354 t, 0 hits, 0 deaths, L87 |
| wording only | — | **step 87** (L91, `drill@64,80`): still REFUSED, its text gains one line, the arm's *"(120,88): the player was HIT waiting out the death … (source chaser bob@128,64)"* (§7's L91 wall) |
| identical | — | **247 of 250** rows: verdict, ticks, hits, deaths, end level and refusal text |

## 8. What the brief got wrong (measured)

1. *"The model DOES step a press on a wallflyer … Those two levelRun surfaces are FIDELITY's"*. This is right, but
   neither surface is needed for a kill arm. A fork-certified kill (the orbit arm's shape) uses the model's own
   press/hit rules through `run.advance`, so the arms are built with **no** levelRun edit and no hand-over blocking
   them. The only new read is the existing `run.wallFlyers` getter.
2. *"the KILL rung picks `bob@96,144`"* (step 35). This is right, and at the merged base the chaser arm DOES kill
   `bob@96,144` once the flyer is gone. ON, the ladder's first KILL is that chaser dwell (6 t), and the two wallflyer
   kills follow on later climbs. So "the chooser picked the wrong body" was not the wall. The wall was that no arm
   could remove the flyer the probe named.
3. *"Acceptance … main 39e8a29f7f: `391322d6…`"* is confirmed. It is unchanged at the merged base and in both arms.

## 9. Residue and hand-overs

- **Hand-over to fidelity (surface, not blocking):**
  - The arm reads `run.wallFlyers` (a debug/witness getter returning copies of the bodies and events). A folded
    entity family **`wallFlyerBodies`**, like `drillBodies`, would put the read on the census's family list.
    Suggested row: `ENTITY_FAMILY_NAMES += 'wallFlyerBodies'` (live, not dying: `{id, x, y, vx, vy, hits, hitsTimer,
    dieAnim, destroy, removed}`). The arm would then read `run.entities('wallFlyerBodies')`; behaviour is unchanged.
  - CORRIDORFLIP §9's surfaces (flyers in `strikeBodies`, a flyer press in `corridorBodyForecastNow`) would let the
    WALK strike a flyer in passing. The arms do not need them.
- **No deadline site:** the arm's forks are not a `DEADLINE_SITES` entry, because that list is pinned by about 10
  test files. They are bounded by `BODY_FAMILY_KILL.maxForks` (8) × the per-fork bounds instead: walk 300 + fight 160
  + removal 80 + settles. If the page's fine deadline should gate them, a `body-family-fork` site is a one-line
  addition plus those pins.
- **L91's walls** (§7): a drill stance search that is not axis-bound, and a death wait that is priced against the
  room's chasers.
- **Witnesses:** the L27 and L88 → (192,0) legs are model-only; no p4g witness was taken, since their staging is the
  sweep's inventory arrival. The survey steps are game-witnessed.
- **Fixtures:** three 0-tick boot views under `fixtures/wallflyer-drill-kill/`. No tape was added.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52), and any whole-game walk.
  No `git stash`, rebase or force-push. The dev server this slice started (port 9790) was stopped by PID.
- **No follow-up** from the planner arrived during the slice.
