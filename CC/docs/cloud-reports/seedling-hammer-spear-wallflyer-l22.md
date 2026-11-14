# Seedling hammer-phase: SPEAR + WALLFLYER KILL on connected L22 (`seedling-hammer-spear-wallflyer-l22`)

Slice `seedling-hammer-spear-wallflyer-l22` (cloud, Opus, measure first). Planner `seedling-hammer-phase-planning-8`. ⚖ The
user approved the slice on 2026-11-14 (the hammer replan): *"…,Spear + wallflyer kill (L22),…"*.
Evidence: `seedling-hammer-spear-wallflyer-l22-evidence/` beside this file (its `README.txt` names every file).

## 1. SHAs

| | |
|---|---|
| Start | `origin/hammer-stack-trio` @ `71adf001dd` (main `80650ed1b6` TRAIN 105 + the hammer stack) |
| Branch | `claude/seedling-spear-wallflyer-l22-nh7jcc` |
| Commits | `9fb06904` the rows (`hammerSpearWallFlyerL22.test.js`) and evidence · then the commit that carries this report (the head) |
| Planner follow-ups | none arrived during the slice |

## 2. The answer first

**No new switch, and no solver code change.** The wall is not in the solver. It is in the danger map, which is
fidelity's file, so this slice hands it over with rows (§9).

**#49 (spear only) does not solve with any switch combination.** With `WALLFLYER_KILL_ARM` ON (either `SPEAR_ARM`
setting), the arm **does kill a wallflyer with the spear**: `wallflyer@48,112`, 85 t, 2 forks, 2 thrusts, 0 hits. The
next climb of the ladder then refuses on **the same id, now a corpse**:

> *"EXHAUSTED … danger at (62.7,128.5) — enemy:wallflyer@48,112 (a static "Enemy" body at its placement …)"*

**The one thing to know first.** `dangerMap.staticEnemyDanger` still prices a wallflyer at its `.oel` placement after
the run has removed it. The spinners already have this exclusion (`spinnersTheRunSteps`, U6), and so do the drills
(`liveDrill?.removed`). Wallflyers have none. The body-family arm asks only for a *live* flyer, so it is not asked
again, and the ladder EXHAUSTS on a body that is no longer in the room. It is trap 157's dead half, one class over.

**With that exclusion (a throwaway experiment, never committed):**

| row | result |
|---|---|
| #49, the wallflyer arm ON (± `SPEAR_ARM`) | **SOLVED 379 t, 0 hits, 0 deaths, onto L29.** Both lane flyers (`@48,112`, `@64,80`) are killed with the spear; the rungs are bait and detour |
| **game witness (p4g) of both plans** | **0 game hits through t379, crosses to L29 at t379**, end (24,232) = the model's; Bob comparison worst \|Δ\| 0 |
| acceptance md5 (switches OFF) | unchanged |
| vanilla survey step 35 (sword) | byte-identical |

The geometry question is answered too: the arm's kill **works with the thrust**. One ring stance loses a fork to the
5 px line (§3), and that is all.

## 3. The reproduction (measured)

**Harness.** SPEAR-ARM's `replay.mjs` (unchanged) and `counts.mjs`, which adds `BODY_FAMILY_KILL_COUNTS` and
`SPEAR_ARM_COUNTS`. The request is CONNECTED-L22's `captures/cap_conn_L22_49.json`. Staging: L22 boot (16,128),
items Fire + Ghost Spear, `inventory_slots` [1,3], primary 0 (Fire), no blade. Every row was re-run at least twice
and the answers were identical. The kill-rung traces come from temporary `DBG_KR` prints
(`patches/temporary-instrumentation.patch`, reverted).

**#49 at the base (`r49/r49_exp0_*`):**

| SPEAR_ARM | WALLFLYER_KILL_ARM | verdict | work | arm asked | kills (id, at, ticks, forks) | refusal names |
|---|---|---|---|---|---|---|
| OFF | OFF | REFUSED | 3 | 0 | — | `enemy:wallflyer@48,112` (live), 1829 chars |
| ON | OFF | REFUSED | 4 | 0 | — (4 policies, 1 equip) | the same, 2102 chars |
| OFF | ON | REFUSED | 81 | 1 | `wallflyer@48,112`, t0, 85 t, 2 | `enemy:wallflyer@48,112` — **the corpse**, at (64.6,127.9) |
| ON | ON | REFUSED | 81 | 1 | the same | the corpse, at (62.7,128.5) (6 policies, 1 equip) |

No row takes a hit or a death. Each ends in an honest refusal, because the corridor flip is ON at this base (the
brief's premise, confirmed).

**The kill-rung trace** (ON/ON):
- `t0`: sources `[wallflyer@48,112 enemy]` at (24.0,136.0). The arm kills it.
- `t85`: sources `[wallflyer@48,112 enemy]` at the stance (45.0,130.2). The arm returns null: the id is not a live
  flyer, because `liveWallFlyer` filters on `removed`, `destroy` and `dieAnim`. The ladder's remaining rungs refuse
  in turn. KILL picks `bob@96,144`, and its chaser arm says *"this run holds no sword"*.

**The spear's thrust against the arm's ring (the brief's question):**

| fork | stance | result | why |
|---|---|---|---|
| 1 | (43,133), r18 | **3 thrusts, 0 landed**: the stance is refused | Computed with `presses.spearHitRect` and `pressRectTouches`: **no facing** of the 32×5 thrust from (43,133) touches the flyer's box [49,63)×[113,127). The sword's 16×32 rect does touch it (facing right or up). The ring is centred on the body, and a diagonal ring point is off the thrust's 5 px lines |
| 2 | (45,131), r16 | **OK**: thrusts at fork ticks 28 and 59, killed with `spearDamage` 2 × 2 against `hitsMax` 3 | Facing up, the thrust's rect [44.5,49.5]×[101,133] touches the box's left edge (inclusive) |

`drillKillWeapon` picks the spear's slot itself, so **`SPEAR_ARM` is not needed for the kill**. With `SPEAR_ARM` OFF,
the arm selects slot 1 at fork tick 28 and restores slot 0 after the removal (`equipsAt` [[28,1],[85,0]]). With it ON,
the walk has already equipped the spear at t0.

**The same wall elsewhere** (`other-captures/`, `cancross/`):

| row | both arms OFF | both arms ON | ON + the experiment |
|---|---|---|---|
| `canCross` L22 from L25's door → L29, `['spear']` / `['fire','spear']` | EXHAUSTED, `@48,112` | the **same kill** (t0, 85 t, 2 forks) and **the same corpse refusal** | **can**: 379 t, rungs bait + detour, L29, 0 hits; kills `@48,112`, `@64,80` |
| #44 (L22 → L25) | EXHAUSTED, `@64,80` | kills `@64,80` (154 t, 3 forks), then *"the danger map forbids (80.49,78.28) — enemy:wallflyer@64,80 (a static …)"*, the corpse | **SOLVED 306 t, 0 hits, L25**; kills `@64,80` and `@48,112` |
| #50 (from (88.2,99.2)) | EXHAUSTED, `chaser:@64,80`, work 642 | kills `@64,80` (80 t, 7 forks), then EXHAUSTED on its corpse | SOLVED 253 t, **2 hits** (`@48,112` at t31, t63), 0 deaths: a hit-taking solve, the next named wall |
| #49 + `hasSword` (control) | REFUSED (both passes out of budget) | dashless kills `@144,112` and `@128,80`, then refuses at t400 on **`@128,80`'s corpse**; the full pass runs out of budget | **SOLVED 482 t, 0 hits, L29** |

So the corpse wall is **not spear-specific**: the sword control in #49's staging meets it too. SPEAR-ARM's "#49 +
sword solves 229 t" was measured before the corridor flip; at this base it refuses.

## 4. Design and change; OFF identity

**Design (stated before any build).** The smallest generic missing piece is a **danger-map exclusion**, the drills'
`liveDrill?.removed` arm one class over:

> in `staticEnemyDanger`, skip an `Enemy` placement whose wallflyer the run steps (`run.wallFlyers.bodies`, same id)
> and has `removed`

- It is generic by class and names no level, coordinate or Seedling constant.
- It reads only the run's own roster. A flyer in its "die" fade is still priced, which is conservative.
- That file is fidelity's (`dangerMap.js`), so by the boundary it is **not built here**. It is handed over (§9), with
  the experiment patch as the exact proposed hunk (`patches/experiment-dangermap-removed-wallflyer.patch`, 1 line,
  env-gated, never committed).

**What was ruled out as the missing piece:**

| candidate | why it is not the wall |
|---|---|
| The brief's "the arm's stance ring / press timing taking the held weapon's geometry" | The ring costs the spear one fork on #49 (§3) and the kill lands on the next stance. A weapon-shaped ring would only be an efficiency item |
| A solver-side filter of the danger sources | A solver-side filter would be a second pricing of the static ingredient outside the danger map, the "two cost models" trap. The solver's `exemptions` are planner volumes (`proximity-hazard:…`), not danger sources |

**Change committed:** `hammerSpearWallFlyerL22.test.js` (rows only, §5). No solver, levelRun or channel file is
touched.

**Thread:** none (no switch).

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gave:
- base `71adf001dd`: **`391322d681b7aa0229d94b3f6906d024`** (the brief's value)
- head: the same, since the head changes no runtime file
- with the experiment patch applied (switches OFF), for the hand-over: **`391322d681b7aa0229d94b3f6906d024`**

## 5. Rows and bounded vitest

**`hammerSpearWallFlyerL22.test.js`** (new, default tier, 4 tests, about 2 s). It is a fixture-free `canCross` ask
that reproduces #49's kill exactly:

| row | what it pins |
|---|---|
| 1 | the wrappers restore both switches |
| 2 | OFF: EXHAUSTED on `enemy:wallflyer@48,112`; the arm is asked 0 times |
| 3 | the wallflyer arm ON: kills `[[wallflyer@48,112, 'wallflyer', 0, 85, 2]]`; asked once; the refusal names the corpse's placement; `SPEAR_ARM_COUNTS` all 0 |
| 4 | both ON: the same kill and wall; spear policies > 0 |

**Mutant** (predicted, then made by applying the experiment patch with `EXP_WF_GONE=1`, and restored with `cmp`):
- predicted: rows 3 and 4 go red (the leg then solves), rows 1 and 2 stay green;
- measured: **exactly those 2 red, 2 green.**

The file's docblock says this is by design: when fidelity lands the exclusion, these rows flip to the solved row.

**Bounded vitest (by path):**
- the six files `hammerSpearWallFlyerL22`, `hammerSpearArm`, `hammerWallFlyerDrillKill`, `solverEnvChannel`,
  `seedlingCanCross` and `scripts/procgen/seedlingSolverSurface`: **6 files, 82 tests green**;
- before any change, `hammerSpearArm` + `hammerWallFlyerDrillKill` alone: 14/14 green. The `hammerSpearArm` OFF row
  that WALLFLYER-DRILL-KILL saw red is re-pinned at this base.

**Generators:**

| command | result |
|---|---|
| `census-seedling-solver-surface.mjs --check` | GREEN, 375 rows ("same") |
| `generate-procgen-reference.mjs` | current, no diff |
| `generate-docs-index.mjs` | current, no diff |

No `docs/json/developer/procgen/` edit was made, so no procgenDocs pin is owed.

**Step-35 row (sword held):** `survey-seedling-route.mjs --through=end --route=full --only=35`, `WALLFLYER_KILL_ARM`
ON. It **SOLVED 539 t, 0 hits** at the base. The experiment's rows are md5-identical (`0706aa39e2…`), with kills at
t134 (`chaser:@48,112`) and t311 (`chaser:@64,80`). The corpse never meets that line, because the sword's stances
end away from the dead placement.

## 6. Game witness (p4g)

The experiment's #49 plans were witnessed as walk tapes on the request's own staging (`drivers/tape49.mjs`). First the
model replays the TAPE itself: crossed at index 378, 0 hits, (24,232).

The game run: `probe-seedling-chaser-mobiles.mjs --class=Bob --player-hits --frames`, headless logic-only, its own dev
server on port 9791, stopped by PID.

| plan | equips | presses | game hits | crossing | end |
|---|---|---|---|---|---|
| both arms ON (379 t) | spear at t0 | t28, 59, 144, 175, 202 | **0** through t379 | L22 → **L29 at t379** | (24,232) = the model's |
| wallflyer arm only (379 t) | [28→1, 85→0, 144→1, 201→0] | t28, 59, 144, 175 | **0** | **L29 at t379** | (24,232) |

Both: sample clock shift `[0]`, Bob worst |Δ| 0 over 379 comparisons. Files: `witness/walk-r49-*.json`,
`game-r49-*.log`, `game-r49-*-rows.json` (`[t, level, hits, hits_timer, x, y]`).

This witnesses the **plan**, which the model finds only under the experiment. The committed solver refuses #49 (§3).

## 7. Census

**This slice's change moves no leg and no request:** it changes no runtime file.

**Seed 1 has no spear-without-sword leg.** SPEAR-ARM §7 measured this: 0 of 936 legs; all 274 spear-holding legs
also hold the Sword. Its argument has not changed at this base.

**The hand-over's reach** (what the danger-map exclusion would move):

| where | measured result |
|---|---|
| seed-1, switches OFF | nothing. Acceptance md5 is identical with the patch, and no OFF path removes a wallflyer (the walk's `strikeBodies` carries none, SPEAR-ARM §3) |
| seed-1, `WALLFLYER_KILL_ARM` ON | survey step 35 is byte-identical. WALLFLYER-DRILL-KILL's 56-leg census lists none of its 6 refusals as a wallflyer corpse (L91 ×2 drill, L28 rope boot, L12 ×2 and L30 keylock). The other wallflyer legs' solved lines were **not re-measured** under the patch (§9) |
| connected | **#49** and the `canCross` L22 / L25 → L29 row (spear, ± Fire) go REFUSED → hitless SOLVED 379 t (game-witnessed). **#44** goes REFUSED → SOLVED 306 t, 0 hits. **#49 + sword** goes REFUSED → SOLVED 482 t, 0 hits. **#50** goes REFUSED → SOLVED with 2 hits (a NO-HIT question, not this wall) |
| other seeds | any slot that kills a resting wallflyer from a stance whose next corridor crosses the corpse's placement |

## 8. What the brief got wrong (measured)

1. *"Does the wallflyer arm's kill work with the spear's thrust geometry?"* **Yes.** Two thrusts kill a flyer, and the
   ring's diagonal stance costs one fork (§3). The thrust's geometry is not the wall.
2. *"…design the smallest generic missing piece (e.g. the arm's stance ring/press timing taking the held weapon's
   geometry)"*: that is not what is missing. What is missing is the danger map forgetting a removed wallflyer, and
   that is a fidelity file. So the slice stops at rows and a hand-over and builds no switch.
3. *"#49 (spear only) with `SEEDLING_SPEAR_ARM=1`, … both"*: `SPEAR_ARM` does not take part in the kill, because
   `drillKillWeapon` selects the spear slot itself. ON it adds the walk's thrusts: one extra press (t202) and 519
   policy builds under the experiment, with the same 379 t plan.
4. *"the sword-held step 35 row byte-identical"*: confirmed, and also under the hand-over's patch. But the connected
   sword control (#49 + `hasSword`) does **not** solve at this base (budget) and meets the same corpse wall with the
   arm ON (§3). The wall is not spear-specific.

## 9. Residue and hand-overs

- **Hand-over to fidelity (`dangerMap.js`):** add an exclusion to `staticEnemyDanger` for a wallflyer the run steps
  and has removed.
  - **Suggested shape:** a `CONTACT_FIDELITY` switch (for example `wallFlyerCorpseGone`), OFF by default, which skips
    the placement when `run.wallFlyers.bodies` holds the same id with `removed`. That is the drills' `removed` arm.
  - **Exact hunk:** `patches/experiment-dangermap-removed-wallflyer.patch`.
  - **Rows:**
    - `hammerSpearWallFlyerL22.test.js` rows 3 and 4 flip to "can, 379 t, 0 hits";
    - #49 game-witnessed at 0 hits (§6);
    - #44 306 t, 0 hits;
    - #49 + sword 482 t, 0 hits;
    - acceptance md5 unchanged;
    - step 35 identical.
  - **Still to measure:** the 53 seed-1 wallflyer/drill-room legs with the arm ON, which were not re-run here.
- **Hand-over to the hammer (planner):**
  - **#50's hit-taking line** under the patch: 2 hits from `@48,112` at t31 and t63. That is the next named wall.
  - **The third flyer.** The arm's 8 forks at `wallflyer@128,80` all refuse *"HIT at fork tick 24 … on the walk to
    (119,88)"*: every stance's walk crosses the flyer's own lane. #49 crosses by the detour rung instead.
  - **An optional efficiency item:** a weapon-shaped stance ring, which would spare the spear's lost fork.
- **Process:**
  - The temporary prints (`solverBot.js`) and the experiment (`dangerMap.js`) were applied only for their runs and
    restored with `cp`; `cmp` checked the restores. Both are kept as patches.
  - One early trace looked like nondeterminism. It was the `sword` variant's dashless pass, re-run and attributed
    (§3, last row).
  - The dev server (port 9791) was stopped by PID: the wrapper first, then the python child.
  - No `git stash`, `pytest`, unfiltered vitest, `standing-values --write`, whole-game walk or force-push was used.
    Nothing under `flashPanel/`, `worlds/`, AS3, wasm or gitlinks was touched.
