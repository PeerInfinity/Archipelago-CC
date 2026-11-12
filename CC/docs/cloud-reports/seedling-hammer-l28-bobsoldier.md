# Seedling hammer phase: slice L28-BOBSOLDIER (`seedling-hammer-l28-bobsoldier`)

Planner: `seedling-hammer-phase-planning-6`. ⚖ The user approved the slice on 2026-11-12 (the hammer replan: *"L28
bobsoldier kill stance, …"*). Landing it needs the user's own SHA-bound OK (the planner asks).

## 1. Start SHA, head, branch

- Base: `origin/claude/seedling-hammer-rock-holder-wait-6io8sx` @ `a8b459e1b4ad4b38e4b240b8c45e2bb283ea9ce9`. Its base is
  fidelity's ROCKBUTTON branch `claude/seedling-fidelity-wave-41-i399y5` @ `4216e79cb9`, which is not on `main`.
- Branch: `claude/seedling-l28-bobsoldier-kill-4us6qr`.
- Commits:
  - `c3c27f3a`: the switch.
  - `ea5e2300`: the rows, the env order, the surface census, page play and L53 evidence.
  - `addef44a`: the census evidence.
  - This report is the head.
- Evidence: `CC/docs/cloud-reports/seedling-hammer-l28-bobsoldier-evidence/`.

## 2. The answer first

**Status: SOLVED.** The switch is `KILL_STANCE_SIGHT` (`SEEDLING_KILL_STANCE_SIGHT=1`, `withKillStanceSight`). It ships
**OFF**, and its name is in `SOLVER_ENV_NAMES`.

- **ON, with ROCK-HOLDER-WAIT's `RESTING_HOLDER` and `fallRockHoldsButton`:** seed 2's L28 leg (`level_28__r1c18 ->
  level_30__r2c10`, from (136,296), {28,0}+{28,1} cleared) **solves hitless**.
  - It reaches L30 at **t448** with **0 hits**.
  - The kill stance moves from (216,200) to **(280,200)**, and `bobsoldier@264,168` dies on the walk there.
- **On the game:** the solver's own 448 keys, played on a fresh p4g page, give **0 hits** and **0 diverging samples**.
  The game ends on level 30.
- **OFF identity:** the acceptance md5 is `391322d681b7aa0229d94b3f6906d024` on the base, OFF, and ON (alone and with
  both rock switches).
- **The one thing to know first: the blade does not reach the stance. The preview mispriced the swing.**
  - The run's sword arm refuses a chaser whose line from the player meets a Solid (`pixelMaskSightLines`).
  - `previewWalk`, which `deriveKillByChaser` prices each stance with, does not ask that line. DASHCERT added the line
    only inside whole-chain dash certificates.
  - So the stance scan landed the t328 press on its first test. The run refused three tests on a `dungeonspire` mask
    and landed the fourth.
  - The body's i-frame clock ran 3 ticks apart between the two. The strike policy's re-approach then stepped the player
    into the resting blade.
  - ON, the scan asks the same line, so the stance it prices is the fight the dwell drives.
- **It is not BobSoldier-specific:** it acts on any chaser the scan prices. On the L53 kill-lock legs (jellyfish), ON
  changes 9002's plan from 959 to 750 ticks, still hitless (§5, §7).

## 3. The reproduction (measured)

`solveSegment`, goal `reach-exit (304,16)`, boot (128,288) → state (136,296), Sword held, {28,0}+{28,1} cleared
(ROCK-HOLDER-WAIT's `bootRun([0,1])`). Both rock switches ON. Node, 0.5 s.

**OFF:** `BotDriverV2Error` *"kill (bobsoldier@264,168) by press: the dwell was HIT at tick 74"*, at t361, with 1 hit
(`sword`, `bobsoldier@264,168`). This is the base report's number, reproduced.

**The derivation path** (instrumented in scratch, then removed):
1. The frontier's weigh dwell ends at t101. The corridor then probes dangerous, and the combat ladder climbs to the
   KILL rung's **chaser arm**.
2. `interceptOrder` picks `bobsoldier@264,168`, and `deriveKillByChaser` is asked at t101 from (136,296).
3. **1 stance qualified out of 18 reachable of 25 in leash:** (216,200). The arm's own words: *"walks there in 186
   tick(s) and stands: bobsoldier@264,168 dies at tick 290, and NO body reaches the player at any tick of either
   half"*.
4. The bound is 134 ticks (the death at preview tick 290, minus the 186-tick walk, plus 30 slack). `walkTo` → (216,200),
   arriving at t287 exactly as previewed. `runDwell` then starts.

**Preview vs live**, tick by tick:
- **t287–t327:** the bodies, the blade angle and the keys are identical between the preview (`walk.samples`) and the
  live run.
- **t328:** the strike policy presses `right` then `primary`, the same on both sides.
- **The swing's tests, t329–t333** (`run.chaserPressHits`):

  | test | t | reach (px) | run | preview |
  |---|---|---|---|---|
  | 1 | 329 | 13.75 | refused: *`collideLine("Solid")` meets dungeonspire at (224, 192)* | **landed** (rect + reach only) |
  | 2 | 330 | 13.19 | refused (same) | — |
  | 3 | 331 | 12.85 | refused (same) | — |
  | 4 | 332 | 12.54 | **landed** (hits 1, hitsTimer 30) | — |

- **The two i-frame clocks then run 3 ticks apart** (preview `hitsTimer` 10 vs run 13 at t350).
- **t355–t358:** the policy's next press is decided off different clocks.
  - The preview presses `right` at t355 and lands hit 2 at t361.
  - The run presses `up` at t358, which moves the player 1.6 px north (y 199.61 → 197.96). That puts it on the resting
    blade's line, (225.8,191.0)→(219.9,196.5), which points at the player.
  - The run is hit at **t361**, in its dwell's tick 74.
- **The blade lines were in the preview:** each sample's chaser carries `sword.lines`. The danger map was not the gap;
  the swing's landing tick was.

## 4. Design and change; OFF identity

**Design.**
- The defect is DASHCERT's (fidelity L100LATTICE hand-over (a)), one caller over. DASHCERT's docblock says *"Every other
  preview is untouched"*. The chaser arm's stance scan is the other preview where a mispriced swing decides a stance.
- So the fix is option (a) of the brief: the scan prices the stance the run will fight. Option (b) (pass without the
  kill) is not built, because ON solves with the kill.
- The decision runs in `solverBot`, in the solve **worker**. The plain env read plus `solverEnvChannel` suffices;
  `pageSolverEnvSwitchOn` is not needed.

**The change** (`solverBot.js`, three local hunks):
1. A new block after DASHCERT's `dashCertSightDepth`:
   - `KILL_STANCE_SIGHT` (with `counts {asks, refused}`), `KILL_STANCE_SIGHT_DEFAULT = false` and `withKillStanceSight`.
   - A depth counter, and `killStanceSighted(fn)`. OFF, this is `fn()` and nothing is counted.
2. In `previewWalk`'s sword arm, beside DASHCERT's test: when the scan depth is > 0 (and DASHCERT's is 0), ask
   `dashCertLineBlocked` (the run's `collideLineSolid`, masks included).
   - The run arm's waivers apply: a Flyer, a ghost swing (`gate.hasGhostSword`), and the key OFF.
   - On a refused swing: `counts.refused += 1`; `continue`.
3. In `deriveKillByChaser`, the per-candidate `previewWalk` call is wrapped in `killStanceSighted`.

Elsewhere:
- `solverEnvChannel.js`: `SEEDLING_KILL_STANCE_SIGHT` is added in sorted position.
- `scripts/procgen/seedling-solver-surface.json`: re-written by `census-seedling-solver-surface.mjs --write`. It is a
  site count (`CONTACT_FIDELITY` 193 → 194 sites), not a new row. `--check` is GREEN at 372 rows.

**No single-game constant:** the line is the run's own query, and no level id or coordinate appears in the logic.

**OFF identity.** `node scripts/procgen/batch-seedling-acceptance.mjs 2>/dev/null | md5sum`:

| arm | md5 |
|---|---|
| base `a8b459e1b4` (measured here, the base file restored into the tree for the run) | `391322d681b7aa0229d94b3f6906d024` |
| this branch, OFF | `391322d681b7aa0229d94b3f6906d024` |
| `SEEDLING_KILL_STANCE_SIGHT=1` | `391322d681b7aa0229d94b3f6906d024` |
| `…=1 SEEDLING_RESTING_HOLDER=1 SEEDLING_FALL_ROCK_HOLDS_BUTTON=1` | `391322d681b7aa0229d94b3f6906d024` |

The other checks:
- `generate-procgen-reference.mjs --check`: "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE".
- `generate-docs-index.mjs --check`: current.
- No docs under `docs/json/developer/procgen/` were edited, so no link-census pin is owed.

## 5. Rows and bounded vitest runs

`frontend/modules/seedlingDemo/hammerKillStanceSight.test.js` has 4 rows. All of them use the L28 witness, with both
rock switches ON.

1. **Ships OFF:** its env name is in `SOLVER_ENV_NAMES`, and `with…` restores. The row is skipped when the env sets it.
2. **OFF:** hits `[[361, sword, bobsoldier@264,168]]`, t361, *"…by press: the dwell was HIT at tick 74"*, and the
   counts are 0/0.
3. **ON:** no error, 0 hits, t448, last record `{reach-exit, to 30, t 448}`. The kill record is `{arm: chaser, target:
   bobsoldier@264,168, stance (280,200), clears [it]}`. The counts are `{asks 34, refused 8}`.
4. **Control (the rock overhead, `cleared: []`):** the scan asks the line (`{34, 8}`), but ON equals OFF **key for key**:
   the same message (*"…stance: the re-planned corridor failed too"*), t1277, and the same hits.

**Mutants.** Each red was predicted first. Each mutant was an in-place edit, then restored and `cmp`-checked against a
saved copy.

| mutant | predicted red | actual |
|---|---|---|
| M1: the call site unwrapped (no `killStanceSighted`) | the ON row, the control row (the counts) | exactly those 2 |
| M2: the line test disabled (`false && …`) | the ON row, the control row | exactly those 2 |

**Bounded vitest.** 32 files (`evidence/vitest-bounded-files.txt`). They are every non-slow/train/calib test naming
`DASH_CERT_SIGHT`, `deriveKillByChaser`, `CHASER_STAGED_HUNT`, `killedOnWalk`, the kill-stance switches,
`chaserOrbitKill`, `withRestingHolder` or `fallRockHoldsButton`. Also included: `solverEnvChannel`, the surface gate,
the procgen docs pins, and mine.

| arm | result |
|---|---|
| OFF | **575/575** |
| `SEEDLING_KILL_STANCE_SIGHT=1` | 570 passed, 1 skipped (the ships-OFF row), **4 failed**. Every failure is a pin of a plan the switch moves: |
| | `hammerRockHolderWait` ON+ON: the t361 wall it pins is gone (the leg now solves; that is this slice) |
| | `hammerL53Killlock` 9001: the arm's tried stances differ (`(120,168)` vs `(136,168)`); the plan sha is unchanged |
| | `hammerL53Killlock` 9001 @ budget 960: 3 refused tries before the kill instead of 4 |
| | `hammerL53Killlock` 9002: it solves in 750 ticks, not 959 (still hitless) |

No unfiltered local vitest was run. The suite number for this head comes from CI
(`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`).

**L53 under the switch** (`evidence/l53-under-sight.{mjs,out.txt}`: L53-KILLLOCK's captured legs, the dashless pass,
each plan replayed on a fresh run). `KILLLOCK_CHASER_REWIND` × `KILL_STANCE_SIGHT`:

| leg | rewind | sight OFF | sight ON |
|---|---|---|---|
| 482 | either | solved 5 t, 0 hits | the same (no scan) |
| 9001 | OFF | dwell hit at dwell tick 145 | the same message (272 asks, 20 refused) |
| 9001 | ON | solved 768 t `c4360b3cadd1`, 0 hits | **the same plan** `c4360b3cadd1`, 0 hits |
| 9002 | OFF | bound runs out | the same message |
| 9002 | ON | solved 959 t `eccbf63f23e1`, 0 hits | solved **750 t** `078a89cab1d1`, 0 hits, 0 deaths, L54 |

## 6. Page play (the game)

`evidence/play-l28-solved.mjs` is ROCK-HOLDER-WAIT's `play-wait-prefix.mjs` (WALK-L53-PAGE's pattern) with
`--sight`. The steps:
1. Capture the solver's OWN keys from `run.advance`.
2. Build the tape with `buildStagedTape` over the same staging.
3. Take the model samples from `rockButtonModelSamples`.
4. Play the tape on a FRESH `seedling_bot_ap_p4g` page (headless logic-only channel, box lock taken).
5. Compare the two with `compareRockButton`.

| arm | ticks | game vs model | game hits | lock {28,2} | end |
|---|---|---|---|---|---|
| **ON** (`--sight=1`, the whole solve) | 448 | **0 diverging** | **0** | game t102 / model t101 | **L30** (24,136); min y 22.15 both |
| OFF (`--sight=0 --idle=20`) | 381 | 0 diverging | 1, `firstHitT` **361**, model 361 | t102 / t101 | — (`CHECK FAILED`, as expected) |

Raw: `evidence/play-l28-solved.{json,out.txt}`, `evidence/play-l28-off.{json,out.txt}`. The dev server I started (PID
2928) was killed by PID.

## 7. Census: the seed-1 divergence-sweep legs the change can move

- **The BobSoldier levels:** the atlas holds BobSoldiers in L28, L30 and L40 only, one each.
- **The legs on those levels:** I regenerated the leg list with `seedling-divergence-legs.mjs`; it has 934 legs, 82 of
  them on these levels (`evidence/census-bobsoldier-legs.keys.txt`, id / level / kind / key).
- **What the full answer needs:** the sweep's bare pass needs the browser sweep's `--dump`, so I ran an **approximate**
  node A/B instead (`evidence/census-bobsoldier-legs.{mjs,out.jsonl}`).
- **The approximation:** each exit leg is booted at its resolved arrival with the route's tools (sword / shield / swim
  / light / fire) and its level's own route flags. Keys, other levels' flags and the seam readback are not staged. Each
  leg is solved to its teleporter/stair OFF and ON.

| exit legs (52) | OFF = ON | scan asks ON |
|---|---|---|
| 23 teleporter/stair legs solved | 23 / 23 (same keys sha, same hits) | **0** |
| 1 boot refused by the approximation (`level_28__r0c6 <- in_L26_144_208 -> …`: *"rope … boots PULLED"*) | — | — |
| 28 pit exits (L30 `out_pit_3_34`, L40 `out_pit_*`) not mapped (a pit is not a `reach-exit` goal here) | — | — |

- **Result: none of the mapped seed-1 legs on the BobSoldier levels enters the chaser arm's stance scan.** So none has a
  press-kill on a BobSoldier through this arm, and the switch moves none of them.
- **Why the witness is different:** seed 2's leg is a whole-game shape. The rock was cut earlier in the run, so it rests
  on the button. The legs in the list never boot that way (ROCK-HOLDER-WAIT §7: no L28 leg stages {28,1}).
- **Not covered by this census:**
  - the 30 **location** legs on these levels, including L40's `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 ->
    location:Level 040 - Boss Key 2`, where `bobsoldier@880,832` sits;
  - the 28 pit legs.
- **The switch is not BobSoldier-specific.** Any leg whose chaser arm prices a stance where a swing meets a Solid can
  move, as L53's jellyfish legs do (§5). The acceptance roster does not move.
- **Dispatches to measure ON at scale** (for the planner; none are needed to land OFF):
  - `seedling-survey.yml` with `SEEDLING_KILL_STANCE_SIGHT=1`;
  - a keyed sweep of the 82 legs above;
  - the L53 legs 9001/9002.

## 8. What the brief got wrong (measured)

1. **"The solver chose a stance a BobSoldier's blade reaches", and "the generic gap: a press-kill stance whose dwell
   overlaps a … chaser's attack box at its swing tick".**
   - The stance does not overlap the blade. The player stood at (217.27,199.61) for 70 dwell ticks unhit.
   - The hit came after the strike policy stepped 1.6 px north at t358 into the resting blade.
   - The plan did not see it because the preview and the run disagree on when the t328 swing lands (§3). The cause is a
     missing line-of-sight test in the preview.
   - The blade's reach and the danger map are both right: the preview carries `sword.lines`, and dangerMap prices them.
2. **"This is a kill-stance / `dangerMap` question"** (the base report's §9, carried into the brief). It is a
   `previewWalk` fidelity question, and it sits in `solverBot.js`, so no fidelity hand-over is needed.
3. **"(a) a stance the blade does not reach, or (b) pass without the kill."** (a) is the answer, reached by pricing the
   swing the way the run does. With that, the scan finds 5 qualifying stances (34 asks, 8 swings refused) and picks
   (280,200), where the soldier dies on the walk. (b) was not needed.
4. **"Generate seed 2 locally."** It was not needed: ROCK-HOLDER-WAIT's atlas staging reproduces the leg exactly. No preset
   was generated or committed.
5. **"The dwell at (215.6,199.6)"**: the scored stance is the lattice cell (216,200), and the walk arrives within
   tolerance at (215.57,199.61).

## 9. Residue / hand-overs

- **Re-pins owed at a flip:** under `SEEDLING_KILL_STANCE_SIGHT=1`, 4 rows of other slices fail because they pin plans
  this switch moves (§5).
  - `hammerRockHolderWait` row 5: its t361 wall is the one this slice removes.
  - `hammerL53Killlock` 9001 / 9001@960 / 9002: the tries and the plan sha move, and the outcome stays solved and
    hitless.
  - These are not edited here (OFF is green). Re-pinning them is the planner's call at a flip.
- **The L53 9002 ON plan** (750 t) is replayed hitless in the model only. It has no page play.
- **The same line is still missing elsewhere:**
  - in every other `previewWalk` caller (the corridor probe, the bait/detour scans, `holdStandWalk`, …);
  - in the strike policy's own `decide`, which schedules presses without the line.
  - Each of these is a preview that can price a swing the run refuses. None is witnessed here; DASHCERT and this switch
    are the two measured callers. A general "every preview asks the line" switch is the next step if a witness turns up.
- **The census is approximate** (§7). The location and pit legs of L28/30/40, and the whole roster ON, are survey or
  sweep dispatches.
- **Planner follow-ups:** none arrived during the session.
- **Tidy-up:**
  - The dev server I started (PID 2928) was killed by PID.
  - The scratch instrumentation in `solverBot.js` was removed before the first commit (`git diff` checked; 0
    `__DBG`).
  - The scratch files (repro scripts, the legs jsonl) live only in the session scratchpad.
  - No `git stash`, no push to `main`, no force-push, no `pytest`, and no `standing-values --write`.
