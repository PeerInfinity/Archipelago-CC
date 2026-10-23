# Seedling fidelity TIMEDPASS — the solver walks past a hopping drill it cannot kill (`drillTimedPass`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-timedpass` (planner `seedling-fidelity-planning-11`, wave 27) |
| Start SHA | `a1457afd33` (= `fidelity-harvest/drillkill`: main `ba57be9a3d` + DRILLKILL + its flip, `drillKillFirst` ON) |
| Code head | `bfa277a0` (the reference); code `5f73d9a9` (the report and the regenerated docs index are the commits after it) |
| Harness branch | `claude/seedling-timedpass-drill-dkc4e7` (nothing pushed elsewhere) |
| Port | 9721 (and 8000 for the probe battery, whose probes default to it — the same tree) |
| Verdicts | **W0 PASS · D1 PASS (2 p4g witnesses, 0 px — after a MODEL FIX they forced) · D2 PASS behind `drillTimedPass` (OFF) · Movers: STOP for a licence (the list is below)** |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-timedpass-evidence/` |

## The one thing to know first

**Fire alone from L26 now SOLVES (key ON): a searched, fork-certified, hit-free walk past both drills to (152,56), then the
cut — 132 ticks, 0 hits, and the game agrees at 0 px.** But the drill pass is not a timing window: `hitPlayer` is geometric
on every tick, and a pass is a 2 px POSITION band at each 15-tick hop, so it is SEARCHED on the run's own drill forecast, not
scripted. And the witnesses found a second, bigger gap that every L28 rope cut with a live drill near it meets: the rope
drops `fallrock@112,240`, whose 181-frame frozen span the model stepped as the rock alone — on the game the drills' anims run
through the freeze (each comes out in "sit"), the camera pans to the rock and back, and the release frame lets the drills
hop. Modelled behind the same key. **Consequence:** after the Fire cut the drill under the stance hops onto it in the pull's
own tick, and its contact lands when the camera returns — 2 ticks after the L26 goal (1 after L25's). The goal is hit-free;
the walk that follows it starts next to a drill (Residue).

| L28 rope cut (`clear-tag {28,0}`, `rope@160,64`), `solveSegment` with `forkRun` | OFF (= DRILLKILL ON) | ON |
|---|---|---|
| **Fire alone from L26** (24,104) | REFUSED (`drill@80,96` hop, t31; "FIRE CANNOT …") | **SOLVED 132 t, 0 hits** — pass 121 t to (152,56) past both drills, certified; (152,88) and (152,72) have no pass |
| Fire alone from L25 (96,24) | SOLVED 89 t | **SOLVED 70 t, 0 hits** — its walk wakes `drill@128,96`, so it plans a pass too (59 t, certified): **a plan mover** |
| Sword / Spear from L25 / L26, Fire + Spear from L26 | the kill (DRILLKILL) | **tick-identical** — the kill stays first, no pass |

## W0 — the base, and the drill's window (PASS)

**The base.** `git checkout -B … a1457afd33` (the harness branch fast-forwarded to it); `session_bootstrap.sh --seedling` →
`READY`, node v22.22.0; server PID kept, port 9721.

| row | command | result |
|---|---|---|
| identity block | `SEEDLING_PORT=9721 bash scripts/procgen/identity-block.sh .` (`evidence/identity-w0.txt`) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `ebb9e743`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK — **= DRILLKILL's W0 on every row** |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `0dd65640`, all exit 0 |
| reference | in the block | 4 DIFFER — the known box artifact (no `bulletml-dodge` checkout) |
| surface / constants / entities / profile | each `--check` (`evidence/censuses-w0.txt`) | GREEN **345** · PASS **6,899** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **289** tapes |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` (`evidence/tape-runner-pairs.txt`) | **635**, md5 **`88fc7df4dd05d11dfd84ebbea675cc8e`** |
| bounded vitest BEFORE | 93 files (`evidence/vitest-files.txt` holds the AFTER set, 96: these 93 + `fidelityTimedPass`, `camera`, `moonrock`. The 93: DRILLKILL's 90 + every test naming `corridorBodyForecast`, `execDrillKillsFirst`, `drillKills`, `DRILL_KILL`, `drillKillFirst`, `CONTACT_FIDELITY_KEYS`, `corridorBodyPricing` + `fidelityForkHygiene`, `jsRuntimeSolverForkRun`, `fidelityTentacleBeast`) | **3,134 tests, 5 red — all at the base** (`evidence/rows-before.txt`): the re-pins DRILLKILL's own report lists as owed by its flip (`fidelityDrill` ×2, `fidelityRope` ×2, `seedlingRoomBodySkin`'s L88 golden). Not mine; the planner's flip re-pin. |

**The window (`Drill.as`, `Enemy.as`; witnessed on p4g, `drillkill-l28-fire-l26`).**
- **The hop.** From "sit" only: one tile (±16) on each axis on which the player is more than `Tile.w/2` (8) away, toward a
  player within `runRange` (48) on a clear "Solid" line, into a cell its `solids` (`Mobile.solids` = Solid, Tree, Rock,
  **Rope**, ShieldBoss, + "Enemy") leave free. Then "drill" (5 frames at rate 20) → `endAnim` → "undrill" (4) → "sit". **On
  the game the cycle is 15 ticks** (hops at t15, t30, t45: "drill" 7, "undrill" 7, the "sit" check on the 15th) — **not 27**.
- **The contact.** `Enemy.update` → `hitPlayer()` runs inside `super.update()`, ABOVE the hop, on EVERY tick the drill is
  on screen, not destroyed, not "die", and `hitsTimer <= 0`: `collide("Player", x, y)` — the 10x10 box (origin 5,5) against
  the player's 4x5 (origin 2,2), read where the previous tick left the player (the drills update first). In x the boxes
  overlap iff `|dx| < 7`; in y iff `-8 < py - dy < 7`. There is NO timing window in the contact itself.
- **So a pass is a POSITION band at each hop**, not "enter after a landing, leave before the next check": at the check, a
  player 8 < |d| ≤ 9 on the axis is jumped over (the drill lands 7-8 px past — the game's 8.05 → 7.95 in DRILLKILL's Fire
  witness), a player 7 ≤ |d| ≤ 8 is not hopped at on that axis and not touched, and a player who then walks away gains ~2 px
  a cycle (1.2 px a tick against 16 per 15). A drill 16 px off on an axis lands ON the player.
- **The model** (`drill.js`, DRILL's transcription, 0 px on the game since DRILL/DRILLKILL) steps all of this; DRILL made the
  room's drills stepped (`drillMixedRooms`) and the contact exact. W0 found nothing to fix in `drill.js` itself — the gap the
  pass needed was the SEARCH (a waypoint walk cannot hold a 2 px band), and the gap the witnesses found was elsewhere (D1).

## D2 — the move (PASS, behind `drillTimedPass`, OFF) — committed first, `2815f9ab`

`contactFidelity.js`: a new key **`drillTimedPass`** (OFF; `SEEDLING_DRILL_TIMED_PASS=0|1`). `solverBot.js`, beside
DRILLKILL (its functions untouched but for one branch):

- **The hook.** `execDrillKillsFirst`'s "no weapon kills a drill" branch (`if (!kw)`), which broke out to let the cut refuse,
  now calls **`execDrillTimedPass`** when the key is ON — same trigger as the kill (the planned walk to the cut's stance wakes
  a live stepped drill), so **the kill stays first** whenever the run holds a sword or spear (⚖ "fight the drills first").
- **`searchDrillTimedPass`** — a beam search, tick by tick, over the nine key sets, on the run's own forecast: the player by
  `run.previewStepper()` (the drive's stepper), every drill by **`run.corridorBodyForecast({drillPass: true})`** — the CORRIDOR
  forecast (`stepDrill`/`stepDrillGraphic` on clones, the camera and its shake band stepped with them), asked with
  `corridorBodyPricing` OFF through a new opt-in, and given **`fork()`** (an independent copy, for branching) and
  **`drills()`**. A state is dropped on a forecast contact, a sample the shake band leaves `uncertain` (⚖ never model the
  cosmetic RNG: plan away from it), a fall, a crossing, water or lava. 400 states a tick (300 finds it; 200 does not),
  deduplicated per tick (0.5 px, velocity, every drill's position/anim/sprite), kept **two per (8 px cell, drill
  configuration)** so that waiting survives rushing (a pure greedy beam dies by t30), ranked by the floor distance to the
  stance (`isWalkableTile`, the drills' cells admitted). The goal: `hasArrived` at the stance with **14 contact-free standing
  ticks** (the fire cut needs 11 from arrival to its end at L26). Stops: no nearer in 100 ticks; 45 ticks (three hop cycles)
  after the first arrival with no stand that holds; 400 ticks; 250,000 states; the solver's fine deadline (`drill-pass` site).
- **One search per stance, in the cut's own order** (`resolved.approach`). Measured: a joint beam over all three stances,
  aimed at the nearest, chases the drills into a configuration the farther stance cannot stand in — (152,56)'s pass, found
  alone at t121, is lost.
- **`certifyDrillTimedPass`** — the found keys on a FORK of the segment (`ctx.fork`, `replayOntoFork`; the clear-tag passes
  `fork` to `execDrillKillsFirst` only with the key ON), then **the cut itself** (`execRopeCutOnce` narrowed to that stance,
  `equip` → `f.equipNow`), then idle until the write lands (the clear-tag's `waitForWrite`: the rope's row + 1), all against
  the fork's own `playerHits` and `ropePulls`. Only a certified pass is played. Without a fork (no `forkRun`) the found pass
  is played as found (`certified: false`); every production `solveSegment` call passes `forkRun`.
- **`execDrillTimedPass`** plays it on the run (any hit or crossing refuses by name, `obstacle: {kind: 'drill', id}`), and
  returns `{verb: 'drill-pass', drills, stance, ticks, expanded, certified, skipped}`. **`execClearTag`** carries it as
  **`drillPass`** on the `rope` clear-tag's record (beside `drillKills`, which keeps its shape) and hands the verb the order
  with that stance FIRST (`verbResolved`), so `execRopeCut` finds the player arrived and presses.
- A run with no pass refuses by name, every stance's reason listed (`obstacle: {kind: 'drill', id}`, the first woken drill).

**Cost.** Fire from L26: 25,318 states for (152,56) after 30,125 + 35,655 for the two stances with no pass — **~10-14 s** of
search (profile: the player stepper's collision is most of it). Fire from L25: 2,256 states, ~0.4 s. Nothing else reaches it.

**Tests.** `fidelityTimedPass.test.js` (23 rows): the switch; W0 on the game (the 15-tick cycle, the 8.05/7.95 band); the
forecast (null unless asked; `fork()` independent; agrees with the run tick by tick); the ON matrix (Fire L26 solved and
certified, without a fork the same plan; Fire L25's pass; every Sword/Spear/Fire+Spear plan tick-identical to OFF); the OFF
refusal; D1's replays.

## D1 — the game witnesses (PASS after a model fix; p4g, headless logic-only, 0 px) — `20725df6`

`scripts/procgen/probe-seedling-timed-pass.mjs --record` → `fixtures/timedpass-witness/` (the box lock; boxLock roster row
added). Each witness is the solver's plan with the key ON (`twoPassSolve`, its `forkRun`), played on a fresh p4g page and
compared every tick through DRILLKILL's fold (`compareDrillKillWitness`: the player x/y/level/hits, every drill's x/y/anim/
`hits`/`hitsTimer`, the bobsoldier).

| witness | plan | game |
|---|---|---|
| `timedpass-l28-fire-l26` | the pass to (152,56) past `drill@80,96` and `drill@128,96` (121 t), the fire cut (pull t125), 132 t + idle tail | 136 ticks; **hit-free through the cut**; 0 px |
| `timedpass-l28-fire-l25` | the pass past `drill@128,96` (59 t), the cut (pull t63), 70 t + tail | 68 ticks; hit-free through the cut; 0 px |

**The first recording FAILED (`evidence/probe-record-first.txt`), and that was the finding.** On the game, `drill@128,96`,
parked at (152,72) under the stance, was at (152,56) — ON the stance — in the tick after the pull, still playing "drill"
(no "sit": not a hop by `Drill.update`'s own clock), and the other drill's anim had jumped "drill" → "sit"; the player was hit
at t134 (L26) / t72 (L25). The model kept both where the live tick left them. Diagnosed on raw game reads (`botStatus` +
`botMobiles` every poll): `dead_frames` jumps 20 → 201 at that tick, and the camera to (47,125). **L28's rope publishes its
group (t=1) to `fallrock@112,240`**, whose `fall()` sets `Game.freezeObjects` for its whole span — 181 dead frames inside one
tape tick. Without the fire press the drill stays parked and hops on its own cycle (control: the same tape minus the press).
The model resolved that span (`levelRun.dropRock`) stepping the rock alone. What the game does in it:

1. `Drill.update` returns at its first line under the freeze, but **`World.update` runs each entity's GRAPHIC outside that
   gate** — so every drill's "drill"/"undrill" plays on through `endAnim` to "sit".
2. **`Game.cameraTarget`** is the landing's centre on every falling frame (`FallRock.as:66`): the camera pans to the rock and
   holds; `Game.shake = 30` on the landing (`:88`), decayed by the release.
3. **The release frame is live below the rock** (it is added last and updates first): `Game.resetCamera()` (`:96`), then the
   drills update unfrozen — off-screen now (the camera is at the rock), so no contact (`Enemy.update`'s `onScreen` return),
   but `Drill.update` runs its hop BELOW `super.update()`, so a drill in "sit" HOPS — onto the stance.
4. The camera returns over ~7 ticks; the contact lands the tick the drill is back on screen.

**The fix** (`levelRun.js`, behind `drillTimedPass`): `fallRockFrozenFrame` per frame of `dropRock`'s span — `view()` FIRST
(the camera reads the previous frame's target: the release frame's camera still stands at the rock), then the rock's
`cameraTarget` (`stepFallRock` given the screen) and landing shake, then the drills' graphic (`stepDrillGraphicsFrozen`), or
on the release frame `Game.resetCamera()` and one live `stepDrillsNow()`; `dropRocksTogether` steps the drills' graphic too.
`camera.SHAKE_WRITERS` gains **`fallRockLanding`** (`=`, 30). With it both witnesses reproduce at 0 px (camera y matches the
game's 125, 110, 97, 85, 74, 64, 55, 47 tick for tick; x is a shake band, as the game's jiggle is). **OFF it is byte-
identical**; a test row pins that OFF the model misses the hop (`t 126 drill@128,96: game (152, 56) model (152, 72)`).

**What it means for the pass.** The goal (the cut and its write) is hit-free on the game; the contact lands 2 ticks after the
L26 goal ends (1 after L25's). The forecast does not know the ceremony; the certificate (the run itself) does — and it holds,
because the contact falls after the write. See Residue for the walk that follows.

## Mutants (predicted first; copy + edit + run + restore; all red)

| | mutant | predicted | measured |
|---|---|---|---|
| p1 | `execDrillTimedPass` not called | the Fire L26/L25 ON rows red | as predicted, 3 red |
| p2 | the search's tail 0 | Fire L26's pass found at an earlier arrival; the fork's cut is hit; the certificate refuses it | as predicted — all three stances found (107/115/107 t), each hit on the fork by `drill@128,96`; 3 red |
| p3 | the forecast's `fork()` shares its drill map | the fork row red; the pass not found or not certified | 4 red (the L25 row too) |
| p4 | no certificate, tail 0 | Fire L26 HIT on the run, refused by name | **NOT as predicted**: the pass (to (152,88), 107 t) is hit-free and the CUT is hit — and the segment still SOLVES, 118 t with 1 hit. The clear-tag does not refuse a hit taken during the fire cut; the stand and the certificate are the only guard. 4 red on the 0-hit asserts |
| d1a | the frozen span steps no drill graphic | both 0-px replays red | as predicted, 2 red |
| d1b | the span's camera stepped AFTER the rock's target write | both 0-px replays red (a contact a tick early) | as predicted, 2 red |

## The movers (ON) — before → after, and the dispatches to confirm

**Route survey, full (local, `survey-seedling-route.mjs --through=end --route=full --out=…`, `SEEDLING_DRILL_TIMED_PASS=0`
vs `=1`):** 239 rows, **SOLVED 186 / REFUSED 53 in both; 0 rows differ** by (level, goals, boot) on verdict, refusal,
ticks and replay hits (`ms` stripped; `evidence/survey-full-{off,on}.txt`). The full route has no L28 step; its rooms with a
`FallRock` (L16, L37, L39, L74 — where D1's frozen-span change reaches) are unchanged.

**Keyed sweep (local, `probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --keys=<the 8 L28 legs>`; arm A =
the 50 defaults, arm B = the 50 + `drillTimedPass`, `evidence/sweep-arm-{A,B}.txt`), ×2 (`evidence/sweep-*.jsonl`,
`sweep-summary.txt`):**

| leg (key) | A1 | B1 | A2 | B2 |
|---|---|---|---|---|
| 289, 290, 292, 295, 296 (L28 exits) | done | done | done | done |
| 293 `level_28__r0c6 <- in_L26_144_208 -> exit:out_teleporter_96_0` | done 58 t | done 58 t | **crossed** 58 t | done 58 t |
| 291 `… <- in_L25_96_128 -> location:L28 flag 0: rope@160,64 cleared` | done 170 t (rope+walk) | done 170 t | done 170 t | done 170 t |
| 294 `… <- in_L26_144_208 -> location:L28 flag 0: rope@160,64 cleared` | done 303 t | done 303 t | done 303 t | done 303 t |

Room hits on the game: 0 in every arm. **0 verdict movers, 0 plan movers**; 293's one `crossed` is in the CONTROL arm (the
known crossed↔done run noise). Every L28 leg's sphere inventory holds the Sword, so the sweep runs the KILL path and never
reaches the pass — the pass's own movers are the D2 matrix (Fire L26: REFUSED → SOLVED 132 t; Fire L25: 89 → 70 t).

**Probes standard, ON (local; the literal flipped in a scratch edit, restored; port 8000 = this tree):** **11/11 ALL CHECKS PASSED, 0 FAIL rows**
(`evidence/probe-battery-standard-on.txt`): logical-links B,R (25), vanilla-map (23), **arrival-composites (95)**,
midroom-replan D (10), restart-route W,J (18), restart-warp W,J (28), adopt (51), obstacle-events W,J (22),
generated-playback (35), loop-restart (30), seal-delivery A (6). The first probe ran with the literal flipped in this tree (its
vanilla-map run was stopped and is the file's empty second header); the other ten from a scratch worktree at `a42f3696` with the literal flipped there and port 8000 serving it (so this tree stayed
clean) — the same code.

**Bounded vitest, ON (the literal flipped in a scratch worktree at `5f73d9a9`; 96 files):** 3,206 tests, **12 red**
(`evidence/rows-on.txt`) = the base's 5 + **7 that a flip owes**:
1. `contactFidelity.test.js > the shipped defaults: all three ON` — the defaults table.
2. `fidelityTimedPass.test.js > is OFF by default` — its own pin.
3. `fidelityDrillKill.test.js > ON: Fire from L26 is still REFUSED on drill@80,96` — **it SOLVES** (the slice's point).
4. `fidelityDrillKill.test.js > ON: Fire from L25 plans what OFF plans` — the L25 mover (89 → 70 t).
5. `fidelityDrill.test.js > D3 … ON: Fire from the L25 arrival plans what OFF plans` — the same mover.
6. `fidelityRopeStance.test.js > D2 … L28 from the L25 arrival, Fire: (152,56), cut t82` — the same mover (cut t63 ON).
7. `fidelityRopeStance.test.js > D1 … ropestance-l28-fire: the solver plans the recorded tape today, and the model is the game
   on every tick` — **its first assert (the plan) only**: the recorded 89-t game witness itself still replays at **0 px**
   with the key ON (checked separately: all five ROPESTANCE witnesses and all three ROPE witnesses, `rope-l28-cut`
   included, compare clean ON — D1's frozen-span change moves no recorded witness).

No committed tape, no producer `--check`, no identity row moves (ON or OFF): the identity block at head equals W0 on every
md5 row and all six `--check`s (`evidence/identity-after.txt`).

**Please run, on this branch** (arm A = `formatContactFidelity(CONTACT_FIDELITY_DEFAULTS)` at the head, the 50 keys of
`evidence/sweep-arm-A.txt`; arm B = A + `drillTimedPass`, `evidence/sweep-arm-B.txt`):
1. **Survey full**: `seedling-survey.yml through=end route=full`, `contact_fidelity=` arm A and arm B. Compare by (level,
   goal, boot) against each other and against **39496129402**. Expected: 0 movers.
2. **Keyed sweep ×2, L28**: `seedling-divergence-sweep.yml keys=<the 8 keys of evidence/timedpass-leg-keys.txt, '|'-joined>
   capture_requests=true`, arm A and arm B, each twice. Expected: as the table above.
3. **Keyed sweep, the FallRock rooms** (D1's reach: L28, L29, L32, L37, L39, L43, L74, L82 — **66 legs**,
   `evidence/fallrock-room-leg-keys.txt`): the same dispatch, arm A vs arm B, ×2. Not run locally — this is where a moved
   camera or a drill's freeze-time anim could show beyond L28 (only L28 holds drills; the camera pan reaches any
   `onScreen`-gated body in those rooms).
4. **Probes**: the workflow `seedling-probe.yml` takes no `contact_fidelity`, so key ON needs a scratch branch with the
   literal flipped: `battery=standard` there; and `probes=probe-seedling-timed-pass.mjs` on this branch (2 witnesses; it
   plans and replays with the key ON itself).

## What the JS arc must wire / pins that move

- **No contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched. **New optional
  record field** on a `rope` clear-tag's record: **`drillPass`** (`{verb: 'drill-pass', drills, stance, ticks, expanded,
  certified, skipped}`), beside DRILLKILL's `drillKills` (unchanged; it no longer carries a pass). The pass's refusal reuses
  DRILLKILL's `SolverRefusal.obstacle.kind` **`'drill'`** (`{kind: 'drill', id}`); no new kind.
- **`run.corridorBodyForecast(opts)`** takes an optional `{drillPass: true}` (null without it while `corridorBodyPricing` is
  OFF, as before); the forecast object gains **`fork()`** and **`drills()`** (additive).
- **Run state the skin reads** (`seedlingSkinRenderer.js`): with the key ON, a `FallRock`'s frozen span now advances
  `run.drills.bodies[].anim`/`sprite` frame by frame and moves `run.cameraNow` (the pan and its shake band) — reached only in
  a room with both a falling rock and a live drill (L28) or a camera-gated skin read across a rock's span. No field renamed.
- **The walker** (`botDriverV2.*`) is untouched — no `producer:walker` sweep row can move. `driveStepHeld` and `hasArrived`
  are CALLED by nothing new (the pass uses the player preview, not the walker).
- **The worker's deadline:** the pass consults the fine `drill-pass` site every 25 search ticks; a page solve of Fire-alone
  L28 spends ~10-14 s there (Residue).

## Handed to the hammer arc

Nothing. None of its functions were edited: `planWaypoints` (not called by the pass — the field is `isWalkableTile`'s),
the escape, `stateDigest*`, the fork closure / `replayOntoFork` (the pass CALLS `ctx.fork`, the closure the clear-tag already
hands its verbs), the rewind. No new run state: the pass's search state lives in the forecast clones; the D1 fix writes the
existing `drillStates`, `cam`/`camBand`, `shake`, `bossCameraTarget` (no new per-visit map, no `DIGEST_EXEMPT` row).

## Deltas

- `contactFidelity.js`: `drillTimedPass` (OFF), `SEEDLING_DRILL_TIMED_PASS`.
- `solverBot.js`: `DRILL_TIMED_PASS`, `DRILL_PASS_KEYS`, `drillPassDistance`, `drillPassStateRefused`,
  `drillPassRowsRefused`, `searchDrillTimedPass`, `certifyDrillTimedPass`, `execDrillTimedPass`; one branch in
  `execDrillKillsFirst` (`if (!kw)`); `execClearTag`'s DRILLKILL call site (`fork` handed with the key ON; `drillPass` split
  off; `verbResolved`).
- `levelRun.js`: `corridorBodyForecastNow({drillPass})` and `corridorBodyForecastFrom` (the former body over a state
  object, + `fork()`, `drills()`; the accessor forwards `opts`); `stepDrillGraphicsFrozen`, `fallRockFrozenFrame`, the two
  span loops (`dropRock`, `dropRocksTogether`) behind the key.
- `camera.js`: `SHAKE_WRITERS.fallRockLanding` (derived `BOSS_CLASS_SHAKE_WRITERS` follows; `shakeWritersHere` unchanged).
- New: `fidelityTimedPass.js` (+ `.test.js`, 23 rows), `scripts/procgen/probe-seedling-timed-pass.mjs` (boxLock roster
  row), `fixtures/timedpass-witness/` (2). Censuses: surface 345 (re-written; its read counts), constants 6,902 (the `30`
  classified). The bot log; the regenerated reference (the instruments and docs-index regions; the four environmental
  substrate regions left as they are).

## What the brief got wrong (measured)

- **"hops one tile per 27 ticks (15 "drill" + 12 "undrill")"** — 15 ticks on the game: "drill" 7, "undrill" 7, the "sit"
  check on the 15th (`drillkill-l28-fire-l26`: hops at t15, t30, t45). 27 is the frame count at 60 fps.
- **"on which ticks of the cycle can a drill damage a player"; "Is a pass a pure timing window (enter right after a landing,
  leave before the next sit check)?"** — No. `hitPlayer` is geometric on every tick (box against box, the drill updating
  first); a drill's anim does not gate it. The only window is a 2 px POSITION band at each hop.
- **"the drill hopping THROUGH a standing player WITHOUT a contact (`hitPlayer` timing)"** — not timing: the player stood
  8.05 px off when the drill checked, so it landed 7.95 px past, outside the 7 px overlap.
- **"leave before the next sit check" / a pass ending at the stance** — the stance is not where the danger ends: the rope cut
  drops L28's `FallRock`, whose frozen span brings every awake drill out in "sit" and hopping (D1). The brief's model of the
  room had no ceremony in it; the game's does.
- **"(in the combat ladder beside DRILLKILL's kill row, or a corridor rung …)"** — neither as such: the pass is searched on the
  CORRIDOR forecast (asked with a new opt-in, `corridorBodyPricing` stays OFF) and hooked where DRILLKILL gives up.

## Residue

- **The walk after the Fire cut refuses.** Measured (`solveSegment`, Fire alone, the key ON, goals `[cut, reach-exit]`):
  from both arrivals, to both L28 doors, the exit walk refuses at its first gate — *"the danger map forbids (151.87,55.81) —
  enemy:drill@128,96 … (152,56)"*: the drill the ceremony released sits on the stance. OFF the same run refused at the cut;
  ON it gets one goal further. Leaving L28 with Fire alone needs the pass extended to a `reach-exit` walk (the same search,
  goal = the crossing) — a queued row. (⚖ 2026-10-20: the menu return to the start region remains.) No route or sweep leg
  asks it today (every L28 leg holds the Sword).
- **The forecast does not model the ceremony** (the search's stand is the forecast's; the certificate is the run's and catches
  it). A search that must stand THROUGH a rock's span would want `fork()`'s forecast to step it too.
- **Other freezes with a live drill near**: a pickup's freeze (`Pickup.as`), the moonrock, the seal ceremony run each
  entity's graphic through `Game.freezeObjects` the same way; only the `FallRock` span is modelled here. L28 and L91 are the
  stepped-drill rooms; neither holds those. Named, not measured.
- **Cost**: ~10-14 s of search for Fire from L26 (two stances exhausted first). The beam needs ≥ 300 states a tick there.
- **The clear-tag does not refuse a hit taken during the cut** (mutant p4: SOLVED with 1 hit). Not the pass's to change; named
  for the arc that owns `execClearTag`'s post-conditions.
- The pass runs for the `rope` verb only (DRILLKILL's hook); L91's drill legs (DRILL's residue) are exits, untouched.

## Byte-inertia (OFF)

- **Identity at head (`5f73d9a9`) equals W0 on every md5 row and all six producer `--check`s** (exit 0); the reference
  differs by the environmental four plus my two (the instruments index's new probe, the constants doc's words), which the
  docs commit regenerates.
- tapeRunner pairs 635 `88fc7df4…` (= W0; and = W0 with the key ON); roster 289; surface GREEN 345; constants PASS 6,902;
  entities PASS 566; profile PASS 138.
- **Bounded vitest AFTER (default, 96 files): 3,206 tests, the same 5 base reds, nothing else** (`evidence/rows-after.txt`)
  = BEFORE's 3,134 + `fidelityTimedPass` (23) + the two files added for `camera.js`'s reach (`camera` 34, `moonrock` 14;
  `fallRock` was already in the set) + `contactFidelityHook`'s per-key row for the new key (1), nothing removed.

## CI

`JavaScript Unit Tests` at `20725df6` (run 39988175996): **failure**, 16 red in the unfiltered suite (22,300 passed),
slow battery green (265/265). That head predates the census update (`5f73d9a9`: the solver surface and constants census
were RED drift there) and the reference regeneration (`bfa277a0`: the instruments index lacked the new probe); the base's
5 owed re-pins are in it too. The run at `bfa277a0` was superseded by the evidence push. **The run at this report's head is
quoted in the session's closing message** (`node scripts/procgen/ci-vitest-summary.mjs <head>`); expected red there: the
base's 5 (`fidelityDrill` ×2, `fidelityRope` ×2, `seedlingRoomBodySkin`) and nothing of this slice's.

## Rows to BANK

- W0: an awake drill hops every 15 ticks on the game; `hitPlayer` is geometric on every tick; the jump-over band is
  8 < |d| ≤ 9 (lands 7-8 px past). `Mobile.solids` includes "Rope".
- D1: a `FallRock`'s frozen span runs every entity's graphic (drills come out in "sit"), pans the camera to the rock and back
  (`view()` reads the previous frame's target), and its release frame runs the drills live — two p4g witnesses at 0 px
  (`fixtures/timedpass-witness/`); mutants p1-p4, d1a, d1b.
- D2: Fire alone from L26 SOLVES (132 t, 0 hits) behind `drillTimedPass`; Fire from L25 89 → 70 t; Sword/Spear unchanged.
- Trap candidates (bot-log): a frozen span is not a stopped clock (graphics run through it); a ceremony's camera is gameplay
  where an enemy is `onScreen`-gated; read the contact before calling a pass a timing window.
- Commits: D2 `2815f9ab`, D1 `20725df6`, censuses `5f73d9a9`, docs/evidence `a42f3696`, the reference, this report.
