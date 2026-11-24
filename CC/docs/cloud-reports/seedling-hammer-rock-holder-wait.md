# Seedling hammer phase: slice ROCK-HOLDER-WAIT (`seedling-hammer-rock-holder-wait`)

Planner: `seedling-hammer-phase-planning-5`. ⚖ The user's ruling (2026-11-12): *"Witness, then slice (Recommended)"*.
This slice is the ruling's build half: the SOLVER side of "a fallen rock resting on a button holds it".

## 1. Start SHA, head, branch

- Base: `origin/claude/seedling-fidelity-wave-41-i399y5` @ `4216e79cb9a0a3474c4be0dcf76cb8d33fac4571` (fidelity
  ROCKBUTTON's report head). It is **not** on `main` (`merge-base --is-ancestor` false at launch), so the slice is
  stacked on fidelity's branch, as the brief said.
- Branch: `claude/seedling-hammer-rock-holder-wait-6io8sx`.
- Commits: `0bc0e573` (the switch, the rows, the hand-over re-pin) → `87833306` (the solver-surface row, evidence) →
  this report (the head).

## 2. The answer first

**Status: BLOCKED at the room's NEXT wall. The wait is built, and the game confirms it. The leg still does not solve.**

- **The switch:** `RESTING_HOLDER` in `solverBot.js`. `SEEDLING_RESTING_HOLDER=1` turns it on, and the name is in
  `SOLVER_ENV_NAMES`. `withRestingHolder(enabled, fn)` is for rows. It lands **OFF**. OFF is byte-identical: the
  acceptance md5 is `391322d681b7aa0229d94b3f6906d024`, the same as the base.
- **ON, with fidelity's `fallRockHoldsButton` ON:** the solver no longer refuses at `button@112,240`.
  - It waits out the lock's fade in place (t0–t101). The lock writes {28,2} at t101 in the model and t102 on the game.
  - It then walks through `grasslock@176,208` with 0 hits.
  - **Page play:** I played the solver's own keys on a fresh p4g page. They match the model at 0 px over 240 ticks, with
    0 hits.
- **L28 solved / hitless: NO.** Past the lock, the solver plans `kill (bobsoldier@264,168)` on its way to the L30 door.
  The kill's dwell at (215.6,199.6) is struck by the soldier's sword at t361. The GAME takes the same hit on the same
  tick: 0 px over 381 ticks, `firstHitT` 361 on both sides. So the model is right, and the solver's kill stance is
  wrong. That is a kill-stance / danger question (`dangerMap.js` and the kill verb), outside this slice's boundaries.
- **The one thing to know first:** the wait is not the last wall on this leg. The bobsoldier north of the lock is. It
  is the same soldier ROCK-HOLDER's §9 flagged ("the solver kills on the way to the door"). Its kill-by-press dwell is
  hit on the game too, so the next slice is a kill-stance one, not a fidelity one.

## 3. The reproduction

`solveSegment` with goal `reach-exit (304,16)`. Boot staging (128,288), giving state (136,296), with {28,0} and {28,1}
cleared and the Sword held. This is fidelity's `bootRun([0, 1])`.

| `fallRockHoldsButton` | `RESTING_HOLDER` | outcome |
|---|---|---|
| OFF | OFF | `SolverRefusal` `{proximity-hazard, button@112,240}`: "no REACHABLE stance inside button@112,240 … NO block in this room can reach it" (t0) |
| ON | OFF | the same refusal, word for word (t0). This is fidelity's §7. |
| OFF | ON | the same refusal (t0): the model reads the button up, so no holder is found |
| ON | ON | waits t0–t101; lock write t101; below y 200 at t205; min y 183.31; then `BotDriverV2Error` "kill (bobsoldier@264,168) by press: the dwell was HIT at tick 74" at t361; 1 hit (`sword`, `bobsoldier@264,168`) |

A side finding: staging {28,2} as well (`cleared: [0,1,2]`) does **not** pre-open the lock in the model. The run is
identical to the [0,1] run, the wait included. So the lock can only be opened in play.

## 4. Design and change; OFF identity

**Design (stated before the build).**
- The weigh refinement is where the solver decides how a non-latching lock gets opened. The lock is in
  `KILL_LOCK_TAGS`, and its group's pressers all republish, so `refineStrategy` answers `weigh`.
- Every weigh asks one source function, `deriveWeighSource`. That function already has two "the holder is already
  there" answers:
  - `parked`: a pushable block already on the presser. `resolveWeighStrategy`'s dwell arm turns it into "no shove, no
    stance, wait out the fade".
  - `corpse`: a turret corpse.
- A resting rock is the same shape. So the change is a **third holder**, `resting`, read in `deriveWeighSource` and
  answered by a dwell arm beside `parked`'s.
- The decision runs in `solverBot`, in the solve **worker**, not on the page's main thread (the mapper). So the plain env
  read plus `solverEnvChannel` suffices. YETI-TALK's `pageSolverEnvSwitchOn` pattern is not needed.

**The change** (`solverBot.js`, all behind `RESTING_HOLDER.enabled`):
- **`restingHolderOn(run, onto)`.** It finds the presser on the `onto` tile. It returns a holder only when BOTH of these
  hold:
  1. A resting Solid of the run's `liveGeometryOpts().fallenRocks` bag overlaps the presser's rect. That bag is the
     per-visit family whose members never move once landed: `fallrock`, `fallrocklarge` and a set `moonrock`.
  2. The live model reads the presser `down` (`run.activatorsNow`) while the player's own box is off it.

  The second clause makes the MODEL the judge. Where fidelity's key does not count the rock, the solver does not wait
  on a fade the replay would never run. The function uses no level id and no Seedling constant.
- **`deriveWeighSource`:** when there is no plan and nothing is parked, it asks for the resting holder before the corpse
  source, and returns `{…, resting}`.
- **`resolveWeighStrategy`:** a new dwell arm for `resting`. It sets `dwellOnly`, has no stance, and uses the same
  `deriveHold` fade bound and `until` as the parked arm. `runDwell`'s refusal for a lock that is already shut stays
  armed.
- **Guard (iii) (`stanceHypothesis`) and the L40BK2 chain (`chainWeighHypothesis`):** both count `resting` as a holder,
  so the lock enters the stance hypothesis as a durable `weigh`.
- **`execWeigh`'s dwell record:** carries `resting` when it is set.
- **Probes and switch helpers:** `restingHolderProbe(run, at)` (read-only), plus `RESTING_HOLDER`,
  `RESTING_HOLDER_DEFAULT` and `withRestingHolder`.
- **`solverEnvChannel.js`:** `SEEDLING_RESTING_HOLDER` is added to `SOLVER_ENV_NAMES` in sorted position.
- **`scripts/procgen/seedling-solver-surface.json`:** one new row, `run:activatorsNow`, classified `seedling` /
  `live-state` with its why. `census-seedling-solver-surface.mjs --write`, then `--check`, is GREEN at 372 rows.

**OFF identity.** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:

| arm | md5 |
|---|---|
| base `4216e79c` | `391322d681b7aa0229d94b3f6906d024` |
| this branch, OFF | `391322d681b7aa0229d94b3f6906d024` |
| `SEEDLING_RESTING_HOLDER=1` | `391322d681b7aa0229d94b3f6906d024` |
| `SEEDLING_RESTING_HOLDER=1 SEEDLING_FALL_ROCK_HOLDS_BUTTON=1` | `391322d681b7aa0229d94b3f6906d024` |

The other checks:
- `generate-procgen-reference.mjs --check`: "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE".
- `generate-docs-index.mjs --check`: current, so there was nothing to regenerate.
- No docs under `docs/json/developer/procgen/` were edited, so I owed no link-census pin.

## 5. Rows and bounded vitest runs; fidelity's re-pinned row

`frontend/modules/seedlingDemo/hammerRockHolderWait.test.js` has 6 rows:
1. It ships OFF, and its env name is in `SOLVER_ENV_NAMES`. The row is skipped when the env sets it.
2. **The holder read.** `[0,1]` with the rock counted → `{solid: fallrock@112,240, presser: button@112,240, tile 7,15}`.
   `[0,1]` with the rock not counted → null. `[]` → null on both arms.
3. **Guard (iii):** `grasslock@176,208` is a `weigh` entry of the stance hypothesis only with both switches ON.
4. **The refusal stands** when the solver switch is OFF (either rock arm), and also with it ON but the rock not
   counted: `{proximity-hazard, button@112,240}` at t0.
5. **ON + ON:**
   - lock writes `[[grasslock@176,208, 101, false]]`;
   - y is 296 for the first 101 ticks (the wait);
   - below y 200 at t205; min y 183.313;
   - hits `[[361, sword, bobsoldier@264,168]]`; the error names the kill dwell. This is the next wall, pinned.
6. **No Solid on the presser** (the rock overhead, `[]`): ON equals OFF, byte for byte. The message is "kill
   (bobsoldier@264,168) stance: the re-planned corridor failed too", at t1277, with lock writes
   121/127/786/792 (the hold the player walks off). Both rock arms are checked.

**Mutants.** I predicted each red first. Each was made by an in-place edit, then restored and checked with `cmp`
against a saved copy.

| mutant | predicted red | actual |
|---|---|---|
| M1: no `down` clause in `restingHolderOn` | holder read, guard (iii), the refusal row | exactly those 3 |
| M2: guard (iii)'s `!derived.resting` dropped | guard (iii) | **survived**: the L40BK2 chain (`weighHypothesisChain`, default ON) re-admits the lock through its own `resting` clause |
| M2′: both guard-(iii) sites dropped (guard + chain) | guard (iii) | exactly that row |
| M3: no `resting` dwell arm | the ON+ON solve, the re-pinned hand-over | exactly those 2 |
| M4: the env name dropped from `SOLVER_ENV_NAMES` | the ships-OFF row (it `toContain`s the name) | exactly that row |

**fidelity's hand-over pin, re-pinned** (`fidelityRockButton.test.js`; fidelity signs):
- **Old:** `HAND-OVER: ON, the solver still refuses the L30 door from (136,296) at the button's stance`. It expected a
  `SolverRefusal` `{proximity-hazard, button@112,240}`.
- **New:** `HAND-OVER (re-pinned): ON, the solver refuses at the button's stance with RESTING_HOLDER OFF, waits ON`.
  - With `RESTING_HOLDER` OFF: the same refusal.
  - With it ON: the obstacle is no longer the button, and the lock writes `[[grasslock@176,208, 101, false]]`.
  - The docblock names the change. The import gains `withRestingHolder`.

**Bounded vitest.** 25 files (`evidence/vitest-bounded-files.txt`): every non-slow/train/calib test naming `dwellOnly`,
`weighHypothesisChain`, `stanceHypothesisProbe`, `corpseBumpWeigh`, `holdStanceProbe` or `fallRockHoldsButton`, plus the
surface gate, `solverEnvChannel`, `boxLock` and mine.

| arm | result |
|---|---|
| OFF | **408/408** |
| `SEEDLING_RESTING_HOLDER=1` | 407 passed, 1 skipped (the ships-OFF row) |

Nothing moves ON. No unfiltered local vitest was run. The suite number for this head comes from CI:
`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`.

## 6. Page play

`evidence/play-wait-prefix.mjs` builds the tape in WALK-L53-PAGE's pattern, adapted:
1. The solver's OWN keys are captured from `run.advance` during `solveSegment`, with both switches ON.
2. `buildStagedTape` builds the tape over the same staging.
3. The model's samples come from `rockButtonModelSamples`, ON.
4. The tape is played on a FRESH `seedling_bot_ap_p4g` page (headless logic-only channel, the box lock taken), and
   `compareRockButton` compares the two (player at 0 px, level, hits, L28 flags).

| tape | ticks | game vs model | game hits | lock {28,2} | min y |
|---|---|---|---|---|---|
| the wait + the crossing (`--cut=240`) | 240 | **0 diverging** | **0** | game t102 / model t101 (+1, the readout convention) | 183.31 both |
| the whole plan to the hit (`--cut=361 --idle=20`) | 381 | **0 diverging** | 1, `firstHitT` **361**, model 361 | t102 / t101 | 183.31 |

So the game confirms both halves. The solver's wait and crossing are hitless on the game. The bobsoldier's hit on the
kill dwell is the game's own, not a model artifact. The raw outputs are `evidence/play-wait-prefix.{json,out.txt}` and
`evidence/play-wait-full361.{json,out.txt}`. The second run prints `CHECK FAILED` because of that hit, which was
expected.

## 7. Census

- **Which seed-1 divergence-sweep legs can the switch move: NONE.**
  - I regenerated the leg list (`seedling-divergence-legs.mjs`, 934 legs, `evidence/census-l28-legs.txt`). L28 has 8
    legs, and none stages {28,1}, so no leg boots with the rock landed.
  - The two rope-cut legs (from L25 and L26) end at the cut's own location, so the rock lands only after the leg's goal.
  - `level_28__r1c18`'s arrival is (288,16), beside the L30 door, so it never meets the lock.
  - `level_28__r11c4` boots at (128,288), the witness's own boot, but its goal is the south exit `out_teleporter_128_304`,
    which is not behind the lock.
  - The acceptance md5 is unchanged with both switches ON.
- **Other resting-Solid-on-presser shapes: none in the shipped atlas.** I used fidelity's atlas census
  (`seedling-fidelity-rockbutton-evidence/census-rock-solids.out.txt`): 116 levels, 11 rock entities, exactly ONE
  rock-on-activator overlap, L28 `fallrock@112,240` on `button@112,240`.
  - No `fallrocklarge` (L32, L82) and no `moonrock` (L0) rests on a presser.
  - The other resting Solids already have their own arms: a parked pushable is `parked`, and a turret corpse is
    `corpse`.
  - The legs this switch would move are whole-game walks, like seed 2's `level_28__r1c18 -> level_30__r2c10` from
    (136,296), which reaches the lock after the rope was cut earlier in the run.

## 8. What the brief got wrong (measured)

1. **"ON (+ `fallRockHoldsButton` ON) = the L28 leg from (136,296) SOLVES through the open grass lock (hitless)."**
   - It passes the lock hitless.
   - It does not solve. The solver's next order, `kill (bobsoldier@264,168)` by press, is hit at t361, on the game as
     well as in the model. The lock was not the leg's only wall.
2. **"The wait it plans (until the gated tile opens, then the corridor)."**
   - The wait is taken where the frontier raises the weigh, which is **at t0, at the arrival**. It is not taken at the
     lock.
   - The solver idles 101 ticks at (136,296), then walks. Hammer's game tape walks first and reaches the lock about 16
     ticks before it opens.
   - Both are correct on the game. The solver's plan is about 85 ticks slower than it needs to be.
3. **"The page play: a `rockbutton-l28-walk`-style staged tape."** That tape is hammer's hand-steered walk, not the
   solver's plan. I played the solver's OWN captured keys instead, which is the claim this slice makes.
4. **A row for "a presser with no Solid on it still asks its stance/weigh ON":** with the rock overhead the solver asks
   the HOLD (the player stands on the button). It does not refuse. It ends 1277 ticks later at the bobsoldier's kill
   stance. Row 6 pins ON == OFF on that outcome.

## 9. Residue

- **The next wall (for the planner):** `kill (bobsoldier@264,168)` by press on L28, north of the lock.
  - The dwell stance (215.6,199.6) is "outside every danger the map can name", yet the soldier's sword hits it at t361
    on the game.
  - This is a kill-stance / `dangerMap` question. Both are out of this slice's boundaries.
  - The witness is `evidence/play-wait-full361.json`: its tape is the solver's exact keys, and the game agrees at 0 px.
- **`stancePrerequisite`** (arm (a), the activator as a stance's prerequisite) still reads `plan || corpse` and does not
  read `resting`. No row reaches it here: the L28 lock is a frontier obstacle, not a stance prerequisite. A room where a
  resting-held lock gates a STANCE would still see it as unwaited. It is left alone because it is unwitnessed.
- **`latchWeighFirst`'s `taken` test** reads `!plan && !parked && corpse`, and `resting` short-circuits before the corpse
  source. That is consistent, because a held presser needs no corpse. It is not measured with turrets present.
- **Where the wait is taken** (§8.2): at the arrival, not at the lock. A later slice could walk first and then dwell.
- **Sweep / survey dispatches for the planner:** none are needed to land OFF. To measure ON:
  - `seedling-survey.yml` with `SEEDLING_RESTING_HOLDER=1` plus `SEEDLING_FALL_ROCK_HOLDS_BUTTON=1`. Expect 0 movers:
    seed 1's route survey has no L28 step (fidelity §3).
  - A keyed sweep on the 8 L28 legs. Expect 0 movers (§7).
- **Tidy-up:**
  - The dev server I started (PID 2280) was killed by PID.
  - The seed-2 preset was never generated or committed.
  - Scratch files (repro scripts, the legs jsonl) live only in the session scratchpad.
  - No `git stash`, no push to `main`, no force-push.
- **Planner follow-ups:** none arrived during the session.
