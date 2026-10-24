# Seedling fidelity ROPESTANCE — the `rope` verb and the PULL rung cut with the Spear and with Fire

| | |
|---|---|
| Session | `seedling-fidelity-ropestance` (planner `seedling-fidelity-planning-10`, wave 23) |
| Start SHA | `eaf8cc4597` (js's `rope-land` = main 83861d68fa + the ROPE verb and its flip) |
| Code head | `8ebd13d4ca` (the report is the commit after it) |
| Harness branch | `claude/rope-stance-spear-fire-igcc2k` (the brief's `seedling-fidelity-ropestance` is this branch; nothing pushed elsewhere) |
| Port | 9710 (the pristine base worktree's own server: 9711) |
| Verdicts | **W0 PASS (no run gap) · D1 PASS (5 game witnesses, 0 px) · D2 PASS behind `ropeCutAnyWeapon` (OFF) · D3 PASS behind the same switch · a measured model gap handed over (L28's drills), with a named interim** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-ropestance-evidence/` |

## The one thing to know first

**A swordless run now cuts a rope with the Spear or with Fire. That holds for the `rope` verb (a clear-tag on the rope's
tag) and for the PULL rung (the lanes' silencer). Both are behind a new switch, `CONTACT_FIDELITY.ropeCutAnyWeapon`,
which is OFF.** With the sword selected nothing changes, switch either way; a test pins that ON and OFF plan the same
ticks. The local route survey's seven rope-level steps are byte-identical OFF vs ON, so the switch looks inert on AP_1.
The CI survey and the keyed sweep A/B below are what licence a flip.

One finding came out of it that is not mine to fix: **the model never steps L28's drills.** `levelRun.drillStateFor`
admits a drill only in a room whose only census enemy it is, and L28 holds two drills and a bobsoldier. On the game, the
spear plan from the L25 side was hit at t59 by `drill@128,96`. The model saw no hit. The rope stances avoid that hop
through a named interim (below); the modelling is a hand-over.

## W0 — the base (PASS)

**Does the run already cut a rope with each weapon? Yes, all three.** The stand is
`evidence/w0-run-cuts.mjs` → `w0-run-cuts.txt`. It boots at every walkable cell near `rope@32,16` (L16) and `rope@160,64`
(L28), with the Spear alone (each facing whose `spearRect` overlaps the rope) and with Fire alone (each cell `auditFire`
reaches it from). It presses once and reads `ropePulls`:
- The Spear's thrust cuts through `applyThrust`'s `RopeStart` arm. There is no reach gate for the spear: the code reads
  `if (weapon === 'sword')`.
- Fire cuts through `applyFire`'s `FIRE_ARM_POLICY.RopeStart` arm.
- Each cut publishes the group: L16 latches `0`, L28 latches `1`.

So nothing in the run needed modelling. The gap was the solver's alone, at `resolveRopeStrategy`'s weapon gate and at
the PULL rung's `weapon !== 'sword'` arm.

| row | result |
|---|---|
| identity block (`identity-block.sh`, pristine base worktree, `evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate s2/s5/s9 `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`; producers battery `405d9c4b`, d2-chain `b76f6483`, l18 `465a8b46`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `0dd65640`, all exit 0; reference: 4 DIFFER (environmental: registry, capabilities, the two substrate charts). `generated set`: the driver stage exited 1 in the worktree (environmental, below) |
| surface / constants / entities / profile | GREEN 338 → (head) 342 after `--write` · PASS 6,856 · PASS 566 · PASS 138 (both) |
| tapeRunner pairs (`tapeRunner.test.js` rows, sorted `status\tfile > name`) | 636 rows, md5 `56c18c64cbd7e5595b0e4903bbc65477`, 0 non-pass |
| bounded vitest BEFORE (`evidence/vitest-files.txt`, 131 listed; 129 run, since the default config excludes the two `.slow` files) | 4,553 tests: **4,547 passed, 6 skipped, 0 failed** (`evidence/rows-before.txt`) |

Gaps in the brief's list, measured:
- `apReportBosses` has no test file. Its readers are `solverEncounter` and `fidelityEncounters2`, both in the set.
- `oneSpelling`, `boxLock` and `lintGateLabels` live in `scripts/procgen/`.

The bounded set adds every test that greps for what I touched: `runSpear`, `execRope`, `resolveRopeStrategy`,
`execPull`, `deriveSwingStance`, `ropePulls`, `CONTACT_FIDELITY_KEYS`, `pullStanceAdmit`, `solverView`, `ropeCutVerb`, the
three rope ids, `LATER_LANE_PROBES`, `roomHasLaneSilencer`, the surface and constants census tests, and the help and
argv tests.

## D2 — the verb (PASS, behind `ropeCutAnyWeapon`, OFF)

**The game.** `RopeStart` is in `Player.hitables` (`:99`), and `genericHit` calls `(e as RopeStart).hit()` with no `t`
(`:1095-1097`). Each weapon has its own filter in front:
- **Sword** (`slash()`, `:912-917`): `distanceRectPoint <= slash width`. The line test is waived for `type == "Rope"`.
  This is the existing path, unchanged.
- **Spear** (`spear()`, `:~960-989`): `collideRectInto` with the facing 32x5 rect, then `genericHit` for every entity.
  There is **no reach gate and no line test** (the brief expected LOS to matter; it does not).
- **Fire** (`fire()`, `:~1026-1032`): the 32x32 rect, then `distanceRects(…) > sprFire.width/2 → continue`. That is the
  16 px radius cut, with the transcribed `originY` quirk.

**The change (`solverBot.js`; the sword path is byte-identical).**

`resolveRopeStrategy`: OFF, or with the SWORD selected, it is what it was. Otherwise it calls `resolveRopeCut`:
- **`ropeCutWeapons`** picks the weapon. The selected Spear or Fire comes first. Then each held cutting weapon by slot
  (sword, fire, spear), selected by `equip` for its press, with the old slot restored after. That is the `burn` verb's
  rule: a later walk's strike policy presses `primary`. A sword slot is not offered while `hasGhostSword` is up, because
  `weaponForPress` would swing the ghost sword.
- **The fire stances** (`ropeFireStance`). The candidates are `burnStanceCandidates` over the window around the rope.
  `ropeFireReach` (`auditFire`) must say the rope is reached and no other responder acts or refuses. A centre that misses
  is offered the burn verb's lean (`burnLeanKey` / `previewLean`).
- **The spear stances** (`ropeSpearStance`). Tile centres within 3 tiles of the rope's box qualify with the first facing
  whose thrust cuts the rope, and nothing non-inert, both from the cell and from where `faceTowards`' tap leaves the
  player. That tap is previewed by `previewFaceTap`, which applies `faceTowards`' own `plannerObstacleAt` test.
  - Measured: from L16's (80,48) a tap north lands at y 47.1, in lethal Water, and `runSpear` threw on it before the
    preview had this test.
- **Admission and ranking.** Every stance is out of every danger volume (`pullStanceAdmit`) and passes the drill interim.
  `rankRopeStances` ranks them: first the ones a plan with the static danger volumes forbidden reaches, then any
  `stanceReaches` answer. It returns up to 3.
- **The executor walks the ranked list** (`execRopeCut`, through `ctx.walkTo`). A walk refused with no tick spent tries
  the next stance; that is the turret spear kill's rule.
  - Measured: L16's nearest fire stance from the L15 arrival, (24,40), sits in `bob@16,16`'s leash beside
    `sandtrap@32,32`. The walk there exhausts the ladder. The second stance, (88,40), cuts.
- **The acts are the existing executors.** Fire goes through `runFire`'s `rope` target (wait `FIRE_WINDOW.endTick`).
  The spear goes through a **new `runSpear` `rope` target** in `botDriverV2.js`: the positive control (the rope exists and
  is not pulled), a 2-tick wait, and the effect check on `pulledRopes`. The bridge, block and rock arms are untouched. A
  sword selected by `equip` runs `execPull`.
- **The post-condition is unchanged:** `execRope` asserts the run's `ropePulls` row.

**Measured (node, switch ON, `fidelityRopeStance.test.js`):**

| boot | bag | answer |
|---|---|---|
| L16 L15 arrival | Spear | SOLVED 29 t, stance (40,56) N, press t26, cut t27, 0 hits |
| L16 L15 arrival | Fire | SOLVED 169 t, (24,40) refused at no tick, (88,40) press t158, cut t162, 0 hits |
| L16 L15 arrival | Wand selected + Spear | SOLVED 29 t, equips `[{t26, slot 1}, {t29, slot 0}]` |
| L16 L15 arrival | Wand alone | `cannot-act`: "no slot holds a Sword, Fire or Spear" |
| L28 L25 arrival | Fire | SOLVED 89 t, (152,56), cut t82, 0 hits |
| L28 L25 arrival | Spear | **REFUSED** by name: the drill interim (every spear stance is in `drill@128,96`'s trigger) |
| any | Sword | ON = OFF, tick for tick |

## D1 — the cuts on the game (PASS; recorded, p4g, 0 px)

The witnesses are recorded by `probe-seedling-rope-stance.mjs --record` into `fixtures/ropestance-witness/`. Each one is
the solver's own plan with both switches ON, played on a fresh p4g page (headless, the logic-only channel). In every
witness the game reproduces the model at **0 px on every sampled tick**, with **no hit**, and the rope's flag is held
from the model's pull + 1:

| witness | plan | game |
|---|---|---|
| `ropestance-l16-spear` | L16 from the L15 arrival, the Spear alone: thrust N from (40,56), 29 t | {16,0} at t28 |
| `ropestance-l16-fire` | same, Fire alone: (88,40), press t158, 169 t | {16,0} at t163 |
| `ropestance-l28-fire` | L28 from the L25 arrival, Fire alone: (152,56), 89 t | {28,0} and {28,1} at t83 |
| `ropestance-l28-spear-east` | a stand east of the rope (240,72), the Spear alone: face W, thrust, 8 t | {28,0} and {28,1} at t7 |
| `ropestance-l28-wand-spear-east` | same stand, the Wand selected and the Spear held: equip slot 1, thrust, restore | {28,0} and {28,1} at t7 |

`fidelityRopeStance.test.js` replays all five against the model. The plan must equal the recorded inputs and equips,
the model must match the game at 0 px, and the flag must land at pull + 1. Before this slice the only Fire cut on the
game was rules-2's hand tape `l28-fire` (`rules-rope-events`), which had no model comparison.

**Why L28's spear witness is from the east stand.** The first recording used the solver's plan from the L25 arrival
(stance (136,72), facing E). The game hit the player at **t59** at (129.3,72.0). The model had 0 hits and was 2.5 px
away, and the cut never landed on the game. Positions were identical until that tick.
- The source is `drill@128,96`. Its census says L28 holds `drill@80,96`, `drill@128,96` and `bobsoldier@264,168`.
  `levelRun.drillStateFor` builds a drill state only when `enemies.length === 1 && enemies[0].tag === 'drill'`, so in
  L28 neither drill ever moves in the model.
- A stance-only interim moved the plan to (184,88). Its walk was hit at the same tick, at (129.5,81.4).

From the L25 side every spear stance needs player y 62-80 on the plateau, inside the drill's 48 px `runRange`. So the
model cannot certify that cut until the drills are stepped, and the solver now refuses it by name.

## The drill interim (named, behind `ropeCutAnyWeapon`)

`unsteppedDrills(run)` mirrors `drillStateFor`'s admission rule. In a room holding a drill that rule does not step:
- A rope stance must not be in that drill's trigger (within `runRange` of its body centre, with a clear "Solid" line,
  `run.collideLineSolid`).
- The corridor the solver plans to the stance (`planWaypoints`, sampled every 2 px) must not be either, with **2 px slack
  for a planned corridor** (`ROPE_DRILL_PLAN_SLACK`). Measured: the L28 fire walk plans through (136,56), exactly 48.0 px
  from the drill's centre, and the game played it with no hop. The spear walk passed about 24 px from it and was hit.
- A refusal names the drills ("within the 48 px run range of an UNSTEPPED drill ([drill@80,96, drill@128,96]) …").

This is planner-side avoidance, allowed only as an interim. **The modelling is queued** (see the hand-overs).

## D3 — the PULL rung (PASS, behind the same switch)

With the switch ON and no sword selected, the rung changes in three ways:
- It asks `resolveRopeCut` for the silencer rope.
- It walks the ranked approach, with the rope in `pullingRopes` so the walk cannot recurse through it.
- It cuts through `execRopeCut` and keeps the rung's own post-condition: the silencer's group **latched** on the live
  run. A miss refuses by name.

It writes the same rung row with the weapon named. The later-lane probe is asked for any run that holds a cutting weapon:
the gate was `primaryWeapon === 'sword'`, and is now `|| (ON && ropeCutWeapons(run).length > 0)`. OFF, and with the
sword selected either way, the rung is unchanged.

Measured, L16 from the L15 arrival to `reach-pit (12,3) → L17`:
- Fire alone, OFF: REFUSED, the ladder exhausted.
- Fire alone, ON: SOLVED 445 t. The rung cuts with fire from (88,40) at t158, all three traps are silenced, the walk
  reaches L17, 1 hit. The sword baseline also takes 1 hit.
- Spear alone, ON: the rung passes the lanes, then the walk refuses later on the far side's chasers (`bob@192,80`,
  `bob@176,16`, no sword to fight them). That is a different wall.

The goal `reach-exit stairsup@352,80` without a sword refuses before any lane, OFF and ON alike, at the block-route
search (`pushableblock@256,80`, `MAX_ROUTE_ORDERS`). That is not this slice's region.

## Mutants (predicted, then made by copy + restore; all red as predicted)

| | mutant | predicted | measured |
|---|---|---|---|
| m1 | `ropeCutWeapons` → `[]` | every ON SOLVED row `cannot-act` | 5 red: the refusal where a solve was expected |
| m2 | the approach loop rethrows the first refused walk | L16 fire from the L15 arrival reds (the ladder's EXHAUSTED at (24,40)) | 1 red, as predicted |
| m3 | `SPEAR_ROPE_WAIT_TICKS` 2 → 0 | the spear rows red ("STILL its full span after 0 tick(s)") | red |
| m4 | `unsteppedDrills` → `[]` | the L28-spear-from-L25 refusal reds (it SOLVES) | red |

## The survey and sweep rows this moves (before → after) and the dispatches to confirm

**Locally, the switch is inert on the route survey's rope-level steps.** Every changed path needs a `RopeStart` in the
room: the verb's resolver keys on a rope solid, and the rung on `roomHasLaneSilencer`, which only L16 has. So I ran
`survey-seedling-route.mjs --through=end --route=full --only=20,22,33,73,103,144,164` (every L16/L39 step of the local
derivation; it has no L28 step) OFF then ON. All seven rows are identical except `ms` (`evidence/survey-rope-steps.tsv`):
20 SOLVED 124, 22 REFUSED (the L17-side lane, correct per ⚖ 2026-10-21), 33 SOLVED 655, 73/103/144/164 REFUSED. AP_1's
bag has the sword at every rope. No survey or sweep row is known to move.

Please run, on this branch:
1. **Survey, full:** `seedling-survey.yml` with `through=end route=full` (no `only=`), once with the default switches and
   once with `contact_fidelity=` set to the 40 defaults + `ropeCutAnyWeapon` (or `SEEDLING_ROPE_CUT_ANY_WEAPON=1` if the
   workflow takes env). Compare by (level, goal, boot) against **39496129402**, and for L15/L16 against **39536565185** /
   **39536562627**. Expect 0 movers.
2. **Keyed sweep, ×2:** `seedling-divergence-sweep.yml` with `keys=<every L16, L28 and L39 leg key>` (re-derive:
   `node scripts/procgen/seedling-divergence-legs.mjs --out=legs.jsonl --presets=seedling_playthrough --blocks`, then
   filter levels 16/28/39), `capture_requests=true`. Run it with `contact_fidelity=` set to the 40 defaults (ARM A) and
   to the 40 defaults + `ropeCutAnyWeapon` (ARM B), twice each.
   - ⚠ An unlisted key is turned OFF, so the ON arm must list all 40. Read the `contactFidelity` stamp the run actually
     used from its plan.
   - Expected: no row moves. The leg bags hold the sword at those levels, and rules-2's 20 `rules-block-path` legs at
     L15/16 in **39623239529** refuse on solver grounds unrelated to the weapon. A `crossed` ↔ `done` swap is noise.
3. **The probe:** `seedling-probe.yml` running `probe-seedling-rope-stance.mjs` (the five witnesses, headless
   logic-only). It should print ALL CHECKS PASSED, as it does here on 9710.

If 1 and 2 show no movers, the flip licence is the bounded set's ON reds below and nothing else.

## Bounded vitest — AFTER (default) and with the switch ON

- **AFTER (default, OFF)**, 130 files, 4,572 tests: equal to BEFORE plus the new file (18 passed), with three
  exceptions.
  - (a) Six vendor/seedling-gated rows skipped in the base worktree (its `vendor/seedling` was not checked out there)
    and pass at head. That is environmental.
  - (b) `contactFidelityHook`'s per-switch row for `ropeCutAnyWeapon` is new and passes.
  - (c) `boxLock.test.js > takes conditionally exactly where …` went red on the new probe. Fixed by declaring
    `probe-seedling-rope-stance.mjs` in the guarded takers (the take is inside `main()`): 26/26.
  - Rows: `evidence/rows-after.txt`.
- **ON** (`SEEDLING_ROPE_CUT_ANY_WEAPON=1`, the whole bounded set): **4 red, every one a pin on the old default**, the
  list a flip must re-pin (`evidence/rows-on.txt`):
  1. `contactFidelity.test.js > the shipped defaults: all three ON`: the defaults table.
  2. `dashShape.test.js > … the defaults add no field`: the request stamps an off-default switch. At a real flip the
     default moves and nothing is stamped.
  3. `fidelityRope.test.js > the Spear alone: cannot-act, naming the sword swing`: **a control that assumed the old
     behaviour.** ON, the Spear alone solves. A flip re-pins it (or moves it under `OFF(...)`).
  4. `fidelityRopeStance.test.js > is OFF by default`.
  - No tape, producer `--check` or other pin moved. tapeRunner pairs at head: 636, md5 `56c18c64…`, the same as W0.

## Byte-inertia (OFF)

- **Identity at head equals W0 on every md5 row** and on all six producer `--check`s (exit 0).
  `evidence/identity-head.txt`; the diff against `identity-w0.txt` is only the two environmental rows below.
  - `generated set`: both trees failed to measure it here. The base's driver stage exited 1 in the worktree, and the
    head's run lost the box lock to the concurrent base run. CI's own run is the measurement.
  - Reference: the head's `--check` DIFFERs on 8. Four are mine: the instruments index and the docs index (the new
    probe, the bot-log words), regenerated and committed. Four are environmental (registry, capabilities, the two
    substrate charts), the same four the base DIFFERs on, and are not committed.
- surface census `--write`: one new row, `import:DRILL` (classified `seedling` / constant), GREEN 342. Constants
  PASS 6,856, entities 566, profile 138.
- No committed tape and no producer digest moved. The new fixtures are witness fixtures, not tapes, so the roster and
  `index.json` are unchanged.

## CI at the code head

`JavaScript Unit Tests` run **39705341797** @ `8ebd13d4ca`: **success**. Suite (unfiltered, quoted from CI per ⚖ 52):
21,989 passed, 0 skipped, 0 failed; the slow battery passed 263 of 263 (`ci-vitest-summary.mjs`). The report commit is
docs-only.

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched.
  The `rope` order and record gain optional fields, all ON only: `weapon`, `slot`, `approach`, `dir`/`facing`, `at`/
  `lean`, `restoredSlot`, `pulledBy`. A swordless cut records `equips` in the plan (the tape's `equips`), which the
  wasm delivery already carries for the `burn` verb.
- `clearTagVerbOf('solid:rope')` is unchanged. A swordless bag stops answering `cannot-act` and solves; the JS mapping
  needs no edit.
- `botDriverV2.runSpear` is now **exported** and has a fourth target, `rope: {x, y}`. Its three existing targets are
  byte-identical. The walker functions (`drive`/`chooseHeld`/`hasArrived`/`driveStepHeld`) are untouched, so no
  `producer:walker` sweep row can move.
- `solverView.js` re-exports `DRILL`.
- **No `run.*` field renamed or reshaped**, so the skin renderer is unaffected. The run state is untouched: no new
  per-visit map and no digest question.

## Hand-overs

- **The drill model: L28's drills are not stepped.** This is `levelRun.drillStateFor`'s admission rule
  (`enemies.length === 1`), which is not my region.
  - Witness: the recorded failing run above (stance (136,72); game hit at t59, (129.34,72.02), model (131.85,72.03), 0
    hits). Re-run it with `probe-seedling-rope-stance.mjs` after pointing `ropestance-l28-spear`'s boot back at
    `FROM_L25`.
  - The fix is to step every drill in a room alongside its other enemies, behind a switch, with the drill states
    already in the digest.
  - When that lands, delete `unsteppedDrills` / `ropeStanceAdmit`'s extra term / the corridor check (all are no-ops
    once the drills step) and re-record the L28 spear from the L25 side.
- **Nothing for the hammer arc.** I edited one gate the brief lists as theirs. It is the PULL rung's later-lane probe
  (`primaryWeapon === 'sword'`), widened ON only, inside my region (the PULL rung's stance). None of their functions
  were touched.
- **Nothing for rules-2.** Their rules already take a rope cut as `Sword | Spear | Fire`. The solver now agrees, except
  for the L28 spear from the L25 side, which refuses until the drill is modelled.

## What the brief got wrong (measured)

- "Spear … NO LOS waiver … LOS matters": `spear()` has **no line test at all** (and no reach gate). The thrust's rect
  alone decides, through walls.
- "a seed that reaches L16 … or L28 holding Spear or Fire and no Sword is refused where logic expects the cut": that is
  true for L16 and for L28's Fire. **L28's Spear from the L25 side stays refused**, for a different, measured reason: the
  unstepped drill.
- The ROPE report says rules-2's `probe-seedling-rope-events.mjs` witnessed a Fire cut on L28. It did, but as a hand
  tape with flags only and no model comparison, and it is not on this base. This slice's five witnesses are the first
  model-compared spear and fire cuts.

## Residue

- The L16 Fire plan from the L15 arrival costs about 17 s of wall time: the refused (24,40) walk's ladder search runs
  before (88,40) is tried. Under a tight `leg_budget_ms` a sweep leg could time out where the answer exists. Ranking by a
  danger-aware corridor probe (the ladder's `probeCorridor` is a `solveSegment` closure) would avoid that.
- `fidelityRopeStance.test.js` takes about 100 s, mostly two 30 s Fire rows. If CI's default tier objects, those two rows
  belong in `*.slow`.
- Equipping for the press lands on the press tick. The `wand-spear` witness shows the game honours it.

## Rows to BANK

- W0: the run cuts with all three weapons (`evidence/w0-run-cuts.txt`). The gap was the solver's alone.
- D1: five p4g witnesses at 0 px (`fixtures/ropestance-witness/`).
- Trap: a "modelled class" is not a modelled ROOM. A drill steps only alone (`drillStateFor`).
- Trap: a stance `stanceReaches` plans can still be a walk the ladder refuses. Hand the executor a ranked list.
- Trap: a spear stance's face tap can nudge into lethal terrain. Preview it with the executor's own test.
- Commits: D2 `eeb9237272`, D3 `b5544556de`, D1 + interim `6bdd7c530d`, surface `2d4d3473e9`, records `bac28dd4be`,
  boxLock `8ebd13d4ca`.
