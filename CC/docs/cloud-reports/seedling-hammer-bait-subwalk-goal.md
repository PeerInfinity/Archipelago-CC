# Seedling hammer-phase — BAIT-SUBWALK-GOAL: a sub-walk that reaches the parent goal's level (ER c3 next wall)

Slice `seedling-hammer-bait-subwalk-goal` (Opus, cloud). Planner: `seedling-hammer-phase-planning-7`/`-8`. No follow-up
arrived during the slice, so only the brief was followed. ⚖ User approval of the slice: 2026-11-12 (the hammer replan).
Landing still needs the user's own SHA-bound OK.

## 1. SHAs

- Start (base): `7361882ca100651392f5d38de48a7b6ad21ef837` (`origin/claude/seedling-bait-removed-replan-b7m8di`)
- Branch: `claude/seedling-bait-subwalk-goal-lhmup9`
- Head: the commit that carries this report (code head before it: `8ee58e2e`)

## 2. The answer first

**Switch `SUBWALK_ANCESTOR_CROSSING`** (`SEEDLING_SUBWALK_ANCESTOR_CROSSING=1`, `withSubwalkAncestorCrossing(enabled,
fn)`), OFF by default. It is read on the **worker thread** (the solve, `solverBot.js`). No main-thread mapper reads it.
On this witness it is reachable only with `CHASER_PASS` and `BAIT_TARGET_GONE` ON, because without them the leg stops
before the outer bait's stance walk.

- **Witness 1 (ER c3, L40 (320,592) → reach-pit (14,27)->L43, Sword only, both switches ON):** OFF refuses in L43
  (unchanged). ON **SOLVES in 768 t with 0 hits** and ends on the ground in L43 at (72,328). It replays hitless on the
  run and on the tape stepper.
- **Game witness PASS** on wasm `seedling_bot_ap_p4g`: 769 obs, maxHits 0, levels [40,43], respawns 0, final (72,328)
  L43. This is the same end point as the model.
- **ER survey steps 50 and 60** (`CHASER_PASS` + `BAIT_TARGET_GONE`, `--timeout=600`): OFF REFUSED, ON **SOLVED 768 t,
  0 hits** (both steps).
- **OFF identity:** acceptance md5 base `391322d681b7aa0229d94b3f6906d024` = head `391322d681b7aa0229d94b3f6906d024`.

**The one thing to know first:** the defect is not specific to baits. Any walk with no `crossTo` that crosses into
another level makes `drive` throw *"crossed … without being asked to"*. The walk's catch counts that throw as a
refuted corridor and re-plans in the new level, aiming at a point in the room it left. Here the crossing was the goal's
own pit, which the goal's plan extras (`allowPit`) let every sub-walk route over. So the fix is (b), done generally:
a level change that satisfies an enclosing crossing walk ends every walk below it. Candidate (a) was not built.

## 3. The reproduction (measured at the base, before any change)

Driver (scratch): `hammerErGapsLegs.solveCase('c3-l40-pit')` under `withChaserPass(true)` + `withBaitTargetGone(true)`.
That is the same call as the bait-removed train row.

| switches | verdict | ticks / time |
|---|---|---|
| CHASER_PASS + BAIT_TARGET_GONE | REFUSED: *"reach-pit (14,27)->L43 -> bait (bob@208,448) stance: the re-planned corridor failed too — … stance waypoint 0 (40,424): not reached within 400 ticks; stalled at (66.57,380.99) … in level 43, aiming at (40,424), after grazing 315 solid(s) …"* | 155.6 s |

The replayed `perTick` has one transition, `{t: 688, from_level: 40, to_level: 43}`, and 0 hits. The inner bait counts
gone as before (`{bob@224,496, chosenAt 442, arrivedAt 664}`).

**The walk stack at t688** was read from the new switch's row, which is pushed at that exact tick:

- the walk that crossed: `reach-pit (14,27)->L43 -> bait (bob@208,448) stance`. This is the OUTER bait's stance walk,
  an ordinary walk with no `crossTo`. Its target was (40,424) in L40.
- its nearest enclosing crossing walk, one frame up: the goal walk `reach-pit (14,27)->L43`, with `crossTo = {level 43,
  pit (14,27), arrival (64,320)}`. Its target level is 43.
- the player stood at (72,245) in L43 at the transition. That is the start of the fall-from-ceiling, so a pit's
  landing is not its control arrival at the transition tick. For that reason the identity for a pit is its level (§4).

The sequence: the inner bait ended at t664 (body gone). The outer bait's stance walk then re-planned from (232,424)
at the pit's edge, and its corridor crossed the goal's own pit tile (exempt under `allowPit`). `drive` (no `crossTo`)
threw *"the run crossed from level 40 to 43 at tick 688 without being asked to"*. `walkToUnder`'s catch took that as
the first refuted corridor and re-planned in L43 toward (40,424). The second drive stalled for 400 ticks, and the
walk refused because two corridors had been refuted.

## 4. Design and change

The measurement chose **(b), generalised**: a walk whose drive crossed into the level an ENCLOSING crossing walk names
hands that walk the crossing. (a) would only cover a bait whose body is gone before the re-plan. It would not cover
the actual mechanism, which is any stance walk (bait, kill, chaser, frontier) crossing the goal's exempt pit.

`solverBot.js` gets one new block beside `BAIT_TARGET_GONE` plus two call sites. `solverEnvChannel.js` gets one name.

- `SUBWALK_ANCESTOR_CROSSING = { enabled }`, `SUBWALK_ANCESTOR_CROSSING_DEFAULT = false`,
  `SUBWALK_ANCESTOR_CROSSING_COUNTS = { handed, unmatched }`, and `withSubwalkAncestorCrossing`.
- `withCrossingFrame(frames, opts, fn)`: ON, a walk with `crossTo` runs as a frame on a per-solve stack. It catches
  only its own `AncestorCrossing` and returns that transition as its own crossing. OFF, it is `fn()`.
- `subwalkAncestorCrossing(run, perTick, frames, ownCrossTo, what)` is called in `walkToUnder`'s `BotDriverV2Error`
  catch, before anything else. ON, it acts when the run's last transition is on this tick
  (`tr.t === perTick.length`) and the run is in `tr.to_level`. It then looks for the nearest enclosing frame (never
  the walk's own frame, which `drive` already asked) whose `crossTo.level` is that level. For a door, the run must
  also stand on the frame's arrival. For a pit, a fall to the pit's level is enough, because every pit of a level
  falls to the same level (`fallDestination`). If a frame matches, the function records `handed` and throws
  `AncestorCrossing` to it. If none matches, it records `unmatched` and the walk goes on as OFF (a refuted corridor).
- Call sites: `walkToRun` wraps its body in `withCrossingFrame(subwalkCrossFrames, opts, …)`. The catch line in
  `walkToUnder` is the other one. `subwalkCrossFrames` is declared beside `walkToUnder`.
- The frames between the crossing and the goal walk unwind as they do after any throw. The progress nodes close
  through `progressRun`'s catch, and the bait's `baitingBodies` through its `finally`. The goal executor then coasts
  the transport and writes its record as usual (`reach-pit`, `to: 43`, `t: 688`).

Nothing in the logic reads a level id, a coordinate or an enemy class. The pit-identity rule is weaker than `drive`'s
own (`drive` checks the tile under the player). The record's `to` level and the landing are the same either way.
A sub-walk that fell through a DIFFERENT pit of the same level would be accepted. No survey step does that (§7).

OFF identity: `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum` gives base
`391322d681b7aa0229d94b3f6906d024` and head `391322d681b7aa0229d94b3f6906d024`, measured after every code commit.
Witness 1 OFF at the head gives the same refusal text as the base, in 159.7 s.

## 5. Rows and bounded vitest runs

- `frontend/modules/seedlingDemo/hammerBaitSubwalkGoal.test.js` (default tier): **3 passed**.
  - the switch is OFF by default, named in `SOLVER_ENV_NAMES`, and the wrapper restores it;
  - a bait stance walk that never changes level (the generated bait gate, `empty` 10x10, pre-sword, seed 1) solves
    ON with the same tape and records as OFF, with no `handed` or `unmatched` row;
  - **the control**: the check runs on a stub run. These crossings are left to the walk and give no throw: one into
    a level no enclosing walk names, one into the right level by another door, one not on this tick, one with no
    enclosing walk, and one into the walk's own frame. The nearest matching frame (a pit, two frames up) gets the
    `AncestorCrossing`. OFF asks nothing. This is a stub because no natural control exists (§7: 0 unmatched in 1254
    step solves).
- `frontend/modules/seedlingDemo/hammerBaitSubwalkGoal.train.test.js` (train tier, `vitest.train.config.js`): **2
  passed, 470 s**.
  - OFF: the L43 refusal text (`… in level 43, aiming at (40,424)`), the replayed `perTick` lands in L43 at t688, 0
    hits;
  - ON: SOLVED 768 t; `handed` = `[{t 688, 40→43, sub "… -> bait (bob@208,448) stance", ancestor the reach-pit walk,
    depth 1}]`, `unmatched` empty; replayed on the run (0 hits, L43, one transition at t688) and on the tape stepper
    (`replaySolved`: `playerHits` [], last tick in L43).
- `hammerBaitRemoved.test.js` 2 passed and `solverEnvChannel.test.js` 11 passed (run with the default-tier file: 16).
- The bait-removed train row (`hammerBaitRemoved.train.test.js`, third test) still pins the OFF refusal. It runs under
  this switch's default (OFF), so it is unchanged.
- Regenerated: `census-seedling-solver-surface.mjs --write` (two site rows moved: solverBot 131→132 and 744→748), then
  `--check` GREEN with 372 rows. `generate-procgen-reference.mjs`: no change, `--check` ALL MATCH.
  `generate-docs-index.mjs`: no change, `--check` OK. `census-seedling-constants.mjs --check`: PASS (0 new, 0 moved).
  No docs edit under `docs/json/developer/procgen/`, so no procgenDocs pins are owed.
- No train-shard cost row was added for the new train file (470 s locally). As with the bait-removed train file, it
  takes the lightest shard and the job warns.

## 6. Game witness

A scratch copy of `probe-seedling-er-landings.mjs` (the tracked probe is unchanged) solves `c3-l40-pit` with the
solver instead of its hand waypoints, as the probe already does for c1. It ran with
`SEEDLING_CHASER_PASS=1 SEEDLING_BAIT_TARGET_GONE=1 SEEDLING_SUBWALK_ANCESTOR_CROSSING=1`. Setup: dev server
`scripts/serve-nocache.py 8000`, wasm `seedling_bot_ap_p4g`, delivered set `seedling-vanilla-record-5aeefc3c`,
headless logic-only, under the box lock:

```
ROW {"tape":"c3-l40-pit",…,"observations":769,"boot":{"level":40,"x":320,"y":592},"held":{"items":["hasSword"],"keys":[]},
     "planVerbs":["pass(puncher@128,624)","bait(bob@192,480)","kill(bob@192,480)","walk","walk"],
     "levels":[40,43],"wrote":[],"maxHits":0,"seals":0,"respawns":0,"final":{"t":768,"x":72,"y":328,"level":43}}
PASS: c3-l40-pit: the game ran the tape to its end on the delivered set — 769 obs
PASS: c3-l40-pit: Sword only: from L19's stairs the player passes the puncher, kills the corridor Bobs and falls to L43, without dying
ALL CHECKS PASSED
```

## 7. Census

**The switch acts only when a walk without its own `crossTo` crosses levels while an enclosing walk has one.** Every
other solve pushes frames and nothing else. To measure that, the four full route surveys below were run ON with a
temporary, uncommitted log line on the two rows (`handed`, `unmatched`). The line was removed before the next commit.

| survey (`--through=end --timeout=600`, switch ON) | steps | SOLVED | `handed` | `unmatched` |
|---|---|---|---|---|
| vanilla (`seedling_playthrough`), defaults | 244 | 219 | 0 | 0 |
| vanilla, `CHASER_PASS` + `BAIT_TARGET_GONE` | 244 | 219 | 0 | 0 |
| `seedling_er`, defaults | 383 | 338 | 0 | 0 |
| `seedling_er`, `CHASER_PASS` + `BAIT_TARGET_GONE` | 383 | 342 | **2** (steps 50, 60: L40 → L43 at t688) | 0 |

The defaults rows equal the bait-removed report's OFF counts (219/244, 338/383). With no row, a step's solve is the
OFF solve.

- **ER steps 50 and 60 OFF vs ON** (`SEEDLING_CHASER_PASS=1;SEEDLING_BAIT_TARGET_GONE=1`, `--only=50,60`): OFF
  REFUSED in 151.3 s and 151.3 s, with the L43 text from §3. ON SOLVED 768 t, 5 decisions, 0 re-plans, 0 hits, in
  151.3 s and 151.7 s. At defaults, both steps stop earlier (*"combat ladder is EXHAUSTED … puncher@128,624"*), so the
  switch does not reach them.
- **Why `unmatched` is empty (inferred from the code, not traced per step):** a sub-walk's planner treats every live
  door as an obstacle. The only exemptions are the goal walk's own exit (`allowTeleporter`, passed per walk) and the
  goal's own pit (`goalPlanExtra.allowPit`, which is set for the whole goal). So the
  only crossing a sub-walk can make is into the goal's own level. Because of this the control row is a stub (§5).
- **Seed-1 divergence-sweep legs:** I rebuilt the leg list at this base (`seedling-divergence-legs.mjs`, 936 legs:
  723 exit, 213 location). The switch can move only an exit leg. In practice that is a **pit** leg (59 legs), because
  a door leg's sub-walks route around its door. The ER witness's pit (14,27) is not a sweep leg. The sweep's L40 pit
  legs are a different pit cluster in region `level_40__r26c13`, e.g. `level_40__r26c13 <- in_L39_144_0 ->
  exit:out_pit_4_20` and `level_40__r26c13 <- in_L43_176_464 -> exit:out_pit_14_21`. I scanned every tracked
  `.jsonl` (the committed sweep evidence included) for the OFF signature: a goal `->LN`, a ` -> … stance` sub-walk,
  and a refusal `in level N`. There are **0 rows**. *"without being asked to"* appears only in the static census
  files of `seedling-hammer-progress-residue-evidence`, not in any sweep row. **Expected movement on the seed-1
  sweep: none measured.** The pit legs are the switch's possible reach. No browser sweep was run.

## 8. What the brief got wrong (measured)

- *"keeps aiming at (40,424) IN L43 for 400 ticks"*: correct, but this is the SECOND corridor. The first drive's
  crossing at t688 threw *"crossed … without being asked to"*. The walk's catch counted that as one refuted
  corridor, and the 400-tick stall is the re-plan from inside L43. The stall is a symptom. The cause is that an
  unasked crossing is treated as a refuted corridor.
- Candidate (a), *"the outer bait checks its body before its stance walk RE-PLANS"*, was not built. It would end
  this witness too, since `bob@208,448` was gone at t625, before the re-plan at t664. But it covers only a bait. The
  defect is any sub-walk crossing the goal's own exempt pit. (b), generalised to "an enclosing crossing walk", covers
  both.
- *"(b) a sub-walk that crosses into the parent goal's target level"*: the matching walk is the nearest ENCLOSING
  walk with `crossTo`, at any depth. In this witness it is depth 1. A pit's identity cannot be the arrival position,
  because at the transition tick the player is at (72,245), not the control arrival (64,320).

## 9. Residue / hand-overs

1. **Pit identity** is the fall's level, not the tile (§4). If a future witness shows a sub-walk falling through a
   different pit of the goal's level that should not count, the frame needs `drive`'s tile test. That would need the
   pre-advance position, which only `drive` (`botDriverV2.js`, not this slice's) holds.
2. **A train-shard cost row** for `hammerBaitSubwalkGoal.train.test.js` (470 s locally) is the CI owner's call.
3. **The 59 sweep pit legs** are this switch's possible reach. A browser sweep with
   `SEEDLING_SUBWALK_ANCESTOR_CROSSING=1` (and `CHASER_PASS`/`BAIT_TARGET_GONE`) over those keys would settle it.
   That is the planner's call.
4. Landing is three switches deep for this witness (`CHASER_PASS`, `BAIT_TARGET_GONE`, `SUBWALK_ANCESTOR_CROSSING`).
   The re-merge order is the planner's.
