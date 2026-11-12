# Seedling hammer-phase: SPEAR-ARM, a strike policy for a spear-only slot (connected L22 wallflyer band)

Slice `seedling-hammer-spear-arm` (cloud, Opus, measure first). Evidence: `seedling-hammer-spear-arm-evidence/`
beside this file.

## 1. SHAs

- Start: `origin/main` = `a3a5b8182e` (`train: content-r4 0f817667ad`), then `git merge origin/hammer-connected-l22`
  = `66046d4d48`. That was a fast-forward because the branch already contains main, so the base is `66046d4d48`.
- Branch `claude/seedling-spear-arm-strike-dzwhie`:
  - `43fa4154` the switch, the policy and the replay evidence;
  - `92c46483` the pins, the solver-surface row and the census;
  - then the commit that carries this report (the head).
- Planner follow-ups: none arrived during the slice.

## 2. The answer

**Switch: `SPEAR_ARM` (`SEEDLING_SPEAR_ARM=1`), OFF.** ON, a run that holds a spear and no blade gets the walk's strike
policy with the **thrust's** geometry, and the segment's walk selects the spear slot first.

**#49 does not solve. ON moves it to the next named wall.** OFF, the walk dies in a loop and the solve ends in a
400-tick stall (work 33). ON, the policy exists, the walk thrusts, and the combat ladder ends in an honest refusal:
*"the combat ladder is EXHAUSTED … enemy:wallflyer@128,80"* (work 503).

**Read this first.** The spear arm against **wallflyers** is not reachable from the walk's strike policy for **any**
weapon:
- `run.entities('strikeBodies')` lists chasers only. Wallflyers are not in it, so no policy (sword included) can aim
  at one.
- The corridor forecast (`levelRun.corridorBodyForecastNow`) says in its own docblock that it does not carry *"a
  sword press landing on a flyer"*.

Both are levelRun / fidelity surfaces. I also ran a throwaway experiment that put wallflyers into `strikeBodies`
(§3). The spear then aims at them 36 times and **still dies 9 times**. So the strike surface alone does not cross
the band either.

**The line exists in the model.** The game witness `l22-25-29-spear` (the rules slice's model-search plan: 193 ticks,
2 presses), played after #49's own prefix with the spear slot selected, crosses to L29 at **t171 with 0 hits and 0
deaths**. With Fire left selected, the same keys take 3 hits and a death. What the hammer still owes is a **search
rung** that finds such a line (§9). An opportunistic strike does not.

**Seed-1 reach: 0 legs.** The route takes the Sword at sphere 0.1 and the Ghost Spear at 7.8, so all 274 spear-holding
seed-1 legs also hold a sword (§7). The switch's reach is connected rooms and other seeds, like #49's room f6.

## 3. The reproduction (measured)

**Harness.** `replays/replay.mjs` is CONNECTED-L22's harness with its worktree path made an env (`WT`). On top of
that, its re-check now folds the plan's own `equipsAt` (the original dropped them).

**#49 as captured, OFF:**
- refusal, 627 chars, work 33;
- byte-identical to CONNECTED-L22's `r49_as-captured.json` (the same message length and work).

**The model, step 1 (cited, not edited).** `levelRun`'s thrust (`applyThrust`, the `family: 'wallflyer'` arm):

| | Ghost Spear | Sword |
|---|---|---|
| rect | `presses.spearHitRect`: `SPEAR_LENGTH` 32 × `SPEAR_THICK` 5 from `spearOrigin` | 16 × 32 |
| reach / line gates | none under `CONTACT_FIDELITY.spearGameTest` (ON) | reach 16, line of sight |
| tests | T+1, T+3, T+5 (`SPEAR_HIT_TICKS`) | T+1 … T+5 |
| damage / force | `spearDamage` 2, `spearForce` 7 (`Player.as:144-145`, `genericHit(v[i], "Spear", …)` at `:989`) | 1 / 5 |
| re-press | swallowed while `spearing` is up (`set spearing`'s `!spearing && _s`, `Player.as:812-823`), so the spacing is `SPEAR_ANIM_TICKS` 5 | `slashTimer` 20, then a dash arm |

On a wallflyer (`wallFlyer.hitWallFlyer`; `hitsMax` 3, i-frame 30, `knockback` is `v = -v`):
- one thrust lands 2 hits and reverses the flyer;
- a second thrust kills it (staged, fidelity W6);
- the sword needs 3 swings.

**The model is complete for the press. Nothing was STOPPED at a fidelity hand-over for the press itself.**

**Where the walk goes ON.** I added temporary prints, kept as
`trace/temporary-instrumentation-and-wf-strike-experiment.patch` and reverted:
- the policy is built 6 times, with 1 equip (slot 1 = the spear; Fire was in slot 0);
- it aims and thrusts **5 times, every one at `bob@96,144`**, the only strike body;
- the wallflyers kill the player 4 times, as OFF does;
- the walk ends at (80.9, 134.5), beside the bob, so the re-plan's ladder engages and refuses there.

**The experiment** (`EXP_WF_STRIKE`, in that patch, never committed): wallflyers are added to `strikeBodies` and the
shadow check is waived. Results:
- 36 aims and 36 thrusts, 28 of them at wallflyers;
- many thrusts hit a flyer resting in its wall, where nothing lands;
- **9 deaths**, and the same stall refusal (work 33).

## 4. Design and change; OFF identity

**Design** (stated before building):
- `strikePolicyFor`'s one gate `if (!hasSword) return null` becomes `return spearStrikePolicyFor(run, …)`.
- That function returns null unless all of these hold:
  - the switch is ON;
  - no Sword or Ghost Sword is held;
  - a spear is held and has a slot (`run.progress('inventorySlots')`);
  - **the selected slot is the spear's** (a press is `useItem(Main.primary)`);
  - the room has strike bodies;
  - no dash plan was asked for.
- It then builds the **same** `createStrikePolicy` with a new `geometry` option (`spearArm.spearStrikeGeometry()`):
  - `rect`: `spearHitRect`;
  - `touches`: `pressRectTouches` (the game rect's inclusive edges);
  - `reach`: `Infinity` under `spearGameTest`, else `SLASH_REACH`, the model's own rule;
  - `period`: `SPEAR_ANIM_TICKS`.
- `allowDash` is false. The i-frame lapse is not asked, because the lapse arithmetic assumes a test on every tick of
  the sword's window.
- All of it is derived from the press model. No level, coordinate or body is named.
- **Rungs it enables:**
  - the walk's opportunistic strike on every `drive`/`previewWalk` that is handed `strikePolicyFor`;
  - the ladder rungs gated on `strikePolicyFor(...) !== null` (the `narrow` rung now runs for a spear holder).
- **Rungs it does NOT enable:**
  - the dash swing (a thrust has no dash arm; a geometry policy with `allowDash` throws by name);
  - the kill rung's chaser arm (`deriveKillByChaser`, still *"this run holds no sword"*).
- **Equip:** `spearArmEquip()` sits inside the segment's `walkTo`. It does one `equip(spearSlot)` before a walk in a
  room with strike bodies, when the switch is ON and the selected slot is not already the spear. That is a
  `Main.primary` write and costs no tick. It rides `solverEquips` → `plan.equipsAt` like every verb's equip.

**Files:**
- `spearArm.js` (new, a solver-family file): the switch, `withSpearArm`, the counts, `spearArmSlot`, the geometry.
- `strikePolicy.js`: an optional `geometry` threaded through `strikeCandidates`, `vetoedInRect` and
  `createStrikePolicy`. Also the swallow guard in place of the would-dash guard, for a geometry policy only. The sword
  path is unchanged when `geometry` is null.
- `solverBot.js`: one import, one changed line in `strikePolicyFor`, `spearStrikePolicyFor` (new), and
  `spearArmEquip` plus its one call in `walkTo`.
- `solverView.js`: `SPEAR_ANIM_TICKS` added to the door.
- `solverEnvChannel.js`: `SEEDLING_SPEAR_ARM`.

**Thread:** the solve worker's (`solverBot`). No page main-thread mapper reads it, so `pageSolverEnvSwitchOn` is not
needed.

**OFF identity:** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gave:
- base (`66046d4d48`): `391322d681b7aa0229d94b3f6906d024`
- change OFF: `391322d681b7aa0229d94b3f6906d024`
- change ON: `391322d681b7aa0229d94b3f6906d024` (the acceptance batch holds no bladeless spear leg)

## 5. Rows and bounded vitest

**Replays.** `replays/r{49,50,44}_{as-captured,sword}_spear-arm-{off,on}.json`; md5 is over the result without `ms`.

| row | OFF | ON |
|---|---|---|
| #49 as captured | refusal, stall, work 33, 627 chars | refusal, **ladder EXHAUSTED on `wallflyer@128,80`**, work 503 |
| #49 + `hasSword` (control) | solves 229 t, work 92 | **identical** (md5 `ebed776c58`) |
| #50 as captured (from (88.2,99.2)) | refusal, stall, work 31 | refusal, stall, work 31 (other stall coordinates, 662 chars) |
| #50 + `hasSword` (control) | refusal, work 200 | **identical** (md5 `bef4531f3e`) |
| #44 (L22 → L25, spear held) | solves 240 t, 2 wallflyer hits, 0 deaths | solves **238 t**: spear equipped at t0, thrusts at t161/181/201, the same 2 hits, 0 deaths |
| #44 + `hasSword` (control) | solves 113 t | **identical** (md5 `fe3b88e3df`) |

**Seed-1 spear leg OFF vs ON.** None exists (§7). The brief's row could not be taken, and #44 stands in for it as
the spear-holding leg that moves.

**`canCross` rows** (pinned in `hammerSpearArm.test.js`), L22 from L25's door → L29, `dashMode none`:

| inventory | OFF | ON |
|---|---|---|
| spear | cannot, stall | cannot, ladder EXHAUSTED (wallflyer); 6 policies, 0 equips |
| fire, spear | cannot, stall | cannot; 1 equip |
| spear, sword | cannot | identical |

**Witness replays** (`replays/witness-*.txt`). The plans come from
`origin/land/rules-no-hit-2:scripts/procgen/seedling-wallflyer-nohit-plans.json`; each is played after #49's prefix.

| plan | slot selected | result |
|---|---|---|
| `l22-25-29-spear` | spear | **crossed to L29 at t171, 0 hits** |
| `l22-25-29-spear` | Fire | 3 hits, 1 death |
| `-sword` / `-shield` | (controls; this slot holds neither item) | not crossed |

**Vitest, bounded by path (no unfiltered run):**
1. `hammerSpearArm.test.js` (new, 9 tests), `solverEnvChannel.test.js`, `hammerWalkDeathRefused.test.js`,
   `seedlingCanCross.test.js`, `hammerStrikeSlot.test.js`: **5 files, 44 tests green.** The first draft's sword-control
   row compared whole results and failed on the wall-clock `ms` field alone. It now strips `ms`.
2. Every non-slow test importing `strikePolicy.js`: `fidelityBulbPlacement`, `fidelityCeremony126`,
   `fidelityCeremonyExact`, `fidelityFrozenPress`, `fidelityL74Leg624`, `fidelityLapseCost`, `fidelityStatueTalk` and
   `hammerSpearArm`: **8 files, 82 tests green.**
3. `scripts/procgen/seedlingSolverSurface.test.js`: **36 green.**
4. ⚠ **One unfiltered vitest run started by mistake** (an empty file list from a glob that matched nothing). It was
   stopped within seconds via TaskStop. No stray process was left and the tree was unchanged. No number from it is
   used anywhere.

**Generators:**
- `census-seedling-solver-surface.mjs --write`: `spearArm.js` joins the family, and the new `SPEAR_ANIM_TICKS` row is
  classified seedling/constant. `--check` is GREEN, 373 rows.
- `generate-procgen-reference.mjs` and `generate-docs-index.mjs`: both current, no change.
- No docs under `docs/json/developer/procgen/` were edited, so no procgenDocs pin is owed.

## 6. Page play / game witness

**None.** The brief asks for a p4g witness of the ON plan *if it solves*, and #49 ON does not.

The relevant game evidence already exists: the rules slice's `l22-25-29-spear` is game-judged, and this slice shows
the model agrees with it from the connected staging (§5, t171, 0 hits).

## 7. Census

**Method.** `seedling-divergence-legs.mjs --out=` at this head lists 936 legs. Filtering on `sphere.inventory`
(Ghost Spear held, Progressive Sword not held) leaves **0 legs**. 274 legs hold the Ghost Spear, and all of them also
hold the Sword. First sphere holding each:

| item | first sphere | position in collection order |
|---|---|---|
| Progressive Sword | 0.1 | 0 |
| Progressive Shield | 3.6 | 16 |
| Ghost Spear | 7.8 | 56 |

Detail: `census/`.

**So on seed 1 the switch can move no divergence-sweep leg.** `spearStrikePolicyFor` is reached only without a blade.
A sword holder's policy, equips and answers are byte-identical, as the sword controls above show.

**Its reach is the connected and randomised case.** A slot that finds the spear before any sword, like room f6's
Sprout, whose swords sit at L38/L42 past L22. Any room with chasers is affected there, not just L22.

## 8. What the brief got wrong (measured)

- *"neither the walk's opportunistic strike nor any kill rung exists for a spear-only slot"*: true. But the premise
  that adding one would cross L22 is not. Two walls stand behind it:
  - the walk's strike surface (`strikeBodies`) carries no wallflyer for any weapon;
  - with that surface widened (the experiment), an opportunistic thrust still dies 9 times.
- *"With `hasSword` the same request SOLVES (229 t, rung avoid, 1 hit)"*: it solves **on the full (dash) pass only**.
  The sword's dashless pass refuses with the same death loop (work 33). So the sword's crossing is the dash rung's,
  not the walk strike's. A spear has no dash arm, so there is no spear analogue to that rung. `jsRuntimeSolver`
  skips the spear's full pass by name (*"sword-dash is not available here: the run holds no sword"*).
- *"Find a spear-holding seed-1 leg … whose staging holds Ghost Spear without Sword"*: there is none (§7).
- *"If the model lacks the spear's effect, STOP"*: the model has the press's effect on a wallflyer (§3). What it lacks
  is the walk-side surfaces (§9). Those surfaces are fidelity's, and so is the hand-over.

## 9. Residue / hand-overs

- **Fidelity (levelRun surfaces; not edited here):**
  - `strikeBodies` omits wallflyers. `levelRun.js` `strikeBodiesNow` builds only from `chaserStateFor`, while the
    press census has a wallflyer row (`family: 'wallflyer'`) since TERRAIN W2.
  - `corridorBodyForecastNow` does not step a press landing on a flyer.
  - Until both exist, no walk can aim at a wallflyer and no preview can certify one.
  - Row: the experiment patch in `trace/` (36 aims, 9 deaths, #49 still the stall).
- **Hammer (planner):** a **band-crossing search rung**.
  - The rules slice's `probe-seedling-wallflyer-nohit.mjs` found `l22-25-29-spear` with a 7511-node weighted search
    over macro-4 key actions (`primary` offered when a body is near).
  - The model crosses on that plan from #49's staging (t171, 0 hits).
  - A solver rung of that shape, with forks from the run, a bounded budget, and a refusal on the first hit (NO-HIT),
    is what would make #49 solvable. That holds with or without this switch: its presses need the spear selected,
    which this switch's equip and slot rule already provide.
  - The kill rung's chaser arm (`deriveKillByChaser`) is still sword-only. A spear arm there is a separate item.
- **This switch** is a prerequisite piece and a reach for chaser rooms. It is not the L22 fix. It ships OFF; landing
  needs the user's SHA-bound OK (planner).
- **Process:**
  - Temporary prints in `botDriverV2.js`/`solverBot.js`/`levelRun.js`/`jsRuntimeSolver.js` were reverted and are kept
    only as the evidence patch. The `.orig` file `patch` left was removed.
  - One accidental unfiltered vitest start, stopped (§5).
  - Nothing under `flashPanel/`, `worlds/`, AS3, wasm or gitlinks was touched. No `pytest`, no sweep, no whole-game
    walk.
