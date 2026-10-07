# Seedling HAMMER-PHASE — slice A: the hit-aware forecast + the space-time escape kernel

Slice `seedling-hammer-a` (Opus, cloud), planner `seedling-hammer-phase-planning`.

| | |
|---|---|
| Start SHA | `994e3fac52` (main with wave 8) |
| Head | the commit carrying this report (code head `dad83cc`) |
| Harness branch | `claude/seedling-hammer-a-265hb4` |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (STOP at the movers list, flag OFF in head) · D3 PASS (measured; the brief's attribution refined)** |

**The one thing to know first.** With `HAMMER_ESCAPE` on, L18 solves at **all 45 hammer residues** (base: 35), with
zero hits and **49 ticks shorter on average**. Two live-refusal residues were game-witnessed at 0 px. The flag is OFF
in head and byte-identical off. Turning it on moves the L18 producers and every generated-level row that certifies
a spinner kill; the list is below, for the user to license.

## W0 — bank at base

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9480 bash scripts/procgen/identity-block.sh .` in a pristine detached worktree at `994e3fac52` (all submodules but the wasm one; the venv of the primary) | log md5 `10f1ef606cd41c4de762229f2d90eb5e` |
| six `--check`s | in the block | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec`, all exit 0 |
| other rows | in the block | maze `246dfbce…`, acceptance `608693d2…`, pairs c3 `043e1944…` c6 `f85e7722…` c4 `4aa74add…`, ENEMY census `25417923…`, guard/AREA unchanged, killgate s2 `01210c82…` s5 `07ce222a…` s9 `30a1e3e7…`, level pre-sword `e28c1e5d…` post-sword `fb1a59e5…`. `generated set` exit 1 in the worktree (no wasm checkout there, environmental); OK in the primary tree (the first, mixed W0 run) |
| surface / constants / entities / profile | each `--check` | **GREEN 219** · **PASS 5,403 literals** · **PASS 528** · **PASS 138** (both) |
| roster | `fixtures/tapes/index.json` | **248** |
| bounded vitest BEFORE | 51 files (below), base worktree | **51 files / 2,400 tests, all green**; tapeRunner **553** pairs, md5 `a227814c8cb7d0fd4c1c442a4677da41` (`status\tfullName`, sorted) |

⚠ My first identity block (primary tree) ran while D1/D2 edits landed mid-run, so it is not a pristine BEFORE; its
rows equal the worktree's where both ran. The worktree block is the BEFORE.

The 51 files: the brief's standing set (`fidelityF1c`, `solverSpinnerKill`, `spinnerClockPairing`, `spinner`,
`levelRun`, `solverBot`, `mover`, `moverRooms`, `twoPassSolve`, `solverDeadline`, `dangerMap`, `r8Acceptance`,
`tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`, `tapeIndexManifest`, `ropeSword`, `shoveWeighParity`,
`watchGenOverlay`, `watchOverlays`, `r5Shaft`, `fidelityArrival`, `fidelityAxe`, `contactFidelity`, `decisionTrace`,
`entityBlocks`, `seedlingCanCross`, `campaignChain`, `jsRuntimeDeclarations`, `boxLock`, `lintGateLabels`,
`seedlingSolverSurface`, `seedlingConstantsCensus`), plus `tapeRunner`, `presses`, `combatVerbs`, `fixtures/tiers`,
and every `rg -a` hit for `clearOfHammersAt|discClearanceAt|slashPressForecast|swordWindowStep|spinnerPressHits|
witness-bases|r9-solve-18|DEADLINE_SITES|HAMMER_PHASE_RUNG|spinnerForecast`: `fidelityF6`, `fidelityF7`,
`fidelityLadder2`, `fidelityReturn`, `jsRuntimeSolver`, `jsRuntimeSolverShouldStop`, `playthroughAcceptance`,
`procgenCountableClock`, `procgenPostSword`, `procgenRoam`, `procgenScratchPersistence`, `r4Swim`, `rerecordCampaign`,
`watchManual`. AFTER adds `hammerEscape` (new).

### The 45-residue sweep at base (`scripts/procgen/sweep-seedling-l18-residues.mjs`)

New instrument, pure node: `--residues=`, `--twice` (each row solved twice and compared), `--escape`, `--full`,
`--json=`. One line per residue: verdict, length, wall time, key digest, escapes/stalls, hits. Every solve is replayed
on a fresh run, and one that takes a hit or does not cross reads `SOLVE-BUT-HIT`.

**Confirmed, exactly:** 35/45 solve; `HAMMER_SAFETY` at **4 5 6 8 15 18 19 20 21 22**; every length equals the
planner's table (`482 482 455 455 R R R 511 R 425 445 447 461 458 459 R 453 453 R R R R R 412 415 461 490 433 439 537
488 464 484 484 484 484 520 508 505 514 519 510 510 496 482`). Every row was the same on the second solve. Slow rows
on this box: 8 (7.5 s), 9 (8.9), 10 (11.4), 41 (17.0), 42 (16.9); the rest 0.3–3.0 s.

### Residue 15, classified: a DASH, out of the live arm

Instrumented with a temporary per-tick print (reverted):

- t170: aim; **t171: the strike's press** (cell (136,88), `pressAt` 171). `slashPresses` records direction **0
  (RIGHT)** while the body is down-left at (122,101), so the swing reaches nothing: **no hit test rows at all** for
  `spinner@112,48`.
- t172–177: a new strike (136,104)@199 is derived, and the walk heads down.
- t177: the LIVE in-reach arm aims (`down`); **t178: press, 7 ticks after t171, inside the 20-tick `slashTimer`**, so
  `slashSet` makes it a **DASH** (force 2, direction DOWN). `trainIsSafeHere`'s train preview never steps the dash
  impulse, and the player is shoved toward the body (vy 2.90).
- **t179**: every key set lands on the body's rect or the line at (136.32,96.68), so the refusal is "There is no
  step out."

Class: **live in-reach arm, a re-press inside the slash timer (a dash) the train preview does not model**. It is not
the rebound class, and no landing is named because none happened. (The t171 whiff is the first cause.) With
`HAMMER_ESCAPE` ON, `pressEscape` previews the press with the dash's own impulse (`previewStepper`'s `dashImpulse`),
and residue 15 solves (449 t; game witness below).

## D1 — the hit-aware forecast (PASS)

**`run.spinnerForecastWithPress(n, {pressAt, direction, id, positions})`** (`levelRun.js`, beside `spinnerForecast`,
whose memo is untouched). It deep-copies the live bodies and steps them under `spinnerForecast`'s own
`ctxNow`/`ctxAfter` split. In each row's advance it then applies the tests the run would:

- the press is `combatVerbs.slashPressForecast(slashInfo, {tick, ticksAhead})`, the run's own ageing, so a re-press
  inside `slashTimer` is a **dash** (the dash's 24 × 20.8 rect, reach 24) and a `gated`/`swallowed` press opens no
  window;
- the tests are `presses.swordWindowStep` over the run's **own window in flight**, with the press replacing it as
  `advance` does (`swordWindowReplace` above the step, `swordWindowSchedule` below);
- each test is `applyThrust`'s spinner arm, transcribed in order: `rectsOverlap(slashRect(from, dir, scale), body)`,
  `distanceRectPoint ≤ slashReachFor(scale)`, `collideLineSolid(from → body point)` (the run THROWS there; the forecast
  reports it and applies nothing), then `hitSpinner(sp, {force: SWORD_FORCE, from, damage, t: 'Sword', frozen})`.

The player's point per test tick is an INPUT (`getSlashRect()` reads x/y every test). It returns `rows`, per-row
`bodies` (`{id, hits, hitsTimer, destroy}`), `tests` (the `spinnerPressHits` shape, plus `own`), `outcome`,
`impulse`, `landing` (the first landed test **of this press** on `id`, or null) with `why`, `lineBlocked`, and
`unmodelled` (a carried shield's bump, named). Index convention as `spinnerForecast`: a hit at tick T is in row
T − n's `bodies` and moves the rects from the next row.

**Witness** (`scripts/procgen/witness-seedling-press-forecast.mjs`, model vs model, exact). The forecast is taken at
the aim tick with the walk's own points; its rows (every rect, `JSON.stringify`) and body state must equal the run's
from the aim tick to the next landing; its tests must equal the run's `spinnerPressHits` for the train; its landing
must be the landing.

| set | walks | landings | rows | tests | result |
|---|---|---|---|---|---|
| the sweep's solving residues (base) | 35 | 210 | 15,755 | 658 | **35/35 exact** |
| every committed tape that lands a spinner press (`--tapes`, all 250 replayed) | 9 | 49 | 5,770 | 148 | **9/9** (8 exact; `r1-dark-shield-spinner` SCOPE: the shield's bump at the aim tick is the named unmodelled source, and taken at the press tick the walk is exact) |

The tapes: `f1c-l18-lock-removal`, `f1c-l18-phase42`, `r1-dark-shield-spinner`, `r8-d2`, `r8-l18-spinner-press`,
`r8-solve-18`, `r9-solve-18`, and this slice's `hammer-a-l18-escape15`/`-escape21`.

**Mutants** (predicted, copy → edit → measure → restore, md5-checked):
- m1, the knockback dropped (`vx`/`vy` kept from before the hit): predicted every walk red; **9/9 walks red** (the 7
  tapes + residues 40 and 9). Restored `7724cc85…`.
- m3, `landing` from ANY landed test (the defect the sweep found, below): the in-flight row in `hammerEscape.test.js`
  red. Restored `c541b2b8…`.

**Found by D2, fixed in D1's method:** the forecast took a landed test of a press ALREADY IN FLIGHT (the run's own
window) as the hypothetical press's landing. Every D1 witness was exact, because the witness always aims at the
landing's own press. The solver exposed it: at residue 35 an escape searched from the earlier press's landing asked
for points it had never previewed ("no player position for the hit test at tick 283"). Tests now carry `own`.

## D2 — the escape kernel and `HAMMER_ESCAPE` (PASS; STOP at the movers)

### The kernel (`frontend/modules/seedlingDemo/spaceTimeReach.js`)

- A node is a real stepped player state at a forecast index. Successors are `step(state, keys)` for the nine key sets
  (four facings, the stand, four diagonals: everything `applyInput` can do, in `stepToward`'s tie-break order;
  `HOLD_FIRST_KEY_SETS` puts the stand first), kept iff `safe(next, i + 1)`. A certificate is the parent chain's keys
  and states, so it is **tick-exact by construction**; dedup only loses alternatives.
- Dedup: `keyOf` (a parameter; default `coarseKey(8)` = the 8 px cell × the sign of each velocity axis) per index.
- **survive** mode: depth first in key order, and when that is exhausted, **breadth first** over the same range,
  keeping per key the state an optional `rank` scores highest (ties: the first reached). A negative only when both
  are exhausted, and it says both ran. **earliest** mode: breadth first, the first index at which the goal holds (B's
  question).
- Budget in WORK UNITS: `maxExpansions`, and `shouldStop()` asked every `SPACE_TIME_CHECK_EVERY` (250) expansions,
  as `mover.js` asks its own; `null` by default (the exact search). Negatives name their bound: `start`, `exhausted`,
  `horizon`, `expansions`, `deadline`. No clock, no Map-insertion accident (the iteration order is the key-set order
  and the layer order; every sweep row was the same twice).

⛔ **Measured, not designed in:** the brief's starting key (8 px × sign × tick) is not enough in depth-first order. At
L18's kill landing (t147 of the committed walk), stand-first depth first was **EXHAUSTED after 187 expansions** while
the breadth-first set reached the horizon. Breadth first with the stand first was exhausted too (claims follow the
first-reached lineage). Finer keys work at a price (2 px: 103k expansions). What fixed it at 8 px was the
**rank-kept layer** (`discClearanceAt`, the refuge's own preference score): ok at H45 in 2,792 expansions.

### Cost on L18 (`scripts/procgen/measure-seedling-escape-kernel.mjs`, the committed walk's 6 landings)

The first escape is survive mode, stand first, ranked. The whole set is the earliest mode with a goal nothing
satisfies (every layer expanded). ms are this box's, loaded.

| key | H | first escape: expansions (ms) | whole reachable set: expansions (ms) |
|---|---|---|---|
| 8 px | 45 | 45 at 5 of 6 landings (1.7–6.1 ms); t147 (the kill) 2,792 (121) | 4,385 – 8,053 (183 – 398) |
| 8 px | 75 | 75 (2.4–4.0 ms); t147: 7,692 (328) | 14,526 – 41,463 (582 – 1,850) |
| 8 px | 90 | 90 (3–4 ms); t147: 11,252 (451) | 19,915 – 67,327 (822 – 3,076) |
| 4 px | 45 | 45 (1.4–1.9 ms); t147: 21,518 (945) | 22,924 – 41,743 (1,000 – 1,982) |
| 4 px | 75 | 75 (2.4–4.6 ms); t147: 90,587 (4,258) | 85,940 – 203,519 (3,709 – 9,325) |
| 4 px | 90 | 90 (2.8–5.1 ms); t147: 137,684 (6,258) | 131,985 – 314,204 (5,618 – 15,168) |

Per successor (one `previewStepper` step plus the prune), the table implies ≈ 5 µs (e.g. 18,356 expansions × 9
successors in 817 ms), under the brief's 10 µs per step. The escape runs at **8 px,
H75**. `maxExpansions` is **50,000** (the largest whole set measured at that key and horizon is 41,463). A search cut
by the budget or the deadline is **no claim** (the press is taken as with the switch off). Only an exhausted search
refuses.

### The escape horizon, derived

`HAMMER_ESCAPE_BOUNDS.horizon = SPINNER.hitsTimerMax + SPINNER.hammerPeriod` = 30 + 45 = 75. The landing opens the
body's i-frame, and no press can land until it ends. The next strike's approach is then guarded by the HAMMER-PHASE
rung, which previews one hammer period. So wherever the certificate is left, the state has a verified continuation at
least as long as the span the rung looks at.

### The use (`solverBot.js`, flag `HAMMER_ESCAPE`, OFF)

- `pressEscape(run, {state, at, keys, pressAt, id})`:
  1. previews the approach keys, the press (with the dash's impulse when `slashSet` dashes) and the train standing,
     with the run's own stepper;
  2. takes the hit-aware forecast over those points and asks `clearOfHammersAt` of every previewed tick up to the
     landing;
  3. runs the kernel from the landing state (8 px, H75, stand first, ranked);
  4. re-takes the forecast with the certificate's own points, since later tests in the train are re-aimed from
     wherever the escape puts the player, and re-verifies the path against it. Failing that, it retries with the
     whole train stood.
- **Admission** in `deriveStrike` (both passes; approximate, from the walk's preview, its `held` re-stepped) and **at
  the live arm's aim** (exact: the run's state, the aim key, the press). The certificate followed is the aim's.
- **The follow**: the train stands until the landing (the forecast's test points are those). From the landing the
  certificate drives every tick on which the loop has **no strike**, instead of the refuge walk nothing previews.
  This covers the refuge-wait class (residues 4–6) by REPLACING the un-previewed refuge walk with certified keys,
  while the escape lasts.
- `follow` (the span driven outright whatever the loop finds) is **0**, measured: driving the certificate through the
  whole i-frame (`follow` = 30) also solved 45/45 but at **+75 t a solve** over base. With 0 it is **−49 t**. The
  safety comes from the admission (every strike has a way out of its landing), not from holding still.
- A certificate `safeStep` overrides ends. A landing that did not happen when certified ends it.
- Records: the press record carries `escapes` (`{t, pressAt, landing, outcome, ticks, moves, expansions}`);
  `deriveStrike` carries `escaped` (flag ON only).

### The sweep with the flag ON (final code, `--escape --twice`)

**45/45 solve; every solve replayed with 0 hits; every row the same twice.** (Base 35/45.)

| residue | base | ON | | residue | base | ON | | residue | base | ON |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 482 | 462 | | 15 | **R** | 449 | | 30 | 488 | 363 |
| 1 | 482 | 509 | | 16 | 453 | 445 | | 31 | 464 | 363 |
| 2 | 455 | 447 | | 17 | 453 | 492 | | 32 | 484 | 363 |
| 3 | 455 | 491 | | 18 | **R** | 445 | | 33 | 484 | 363 |
| 4 | **R** | 491 | | 19 | **R** | 445 | | 34 | 484 | 363 |
| 5 | **R** | 515 | | 20 | **R** | 445 | | 35 | 484 | 363 |
| 6 | **R** | 447 | | 21 | **R** | 445 | | 36 | 520 | 363 |
| 7 | 511 | 418 | | 22 | **R** | 445 | | 37 | 508 | 508 |
| 8 | **R** | 514 | | 23 | 412 | 446 | | 38 | 505 | 363 |
| 9 | 425 | 440 | | 24 | 415 | 446 | | 39 | 514 | 495 |
| 10 | 445 | 444 | | 25 | 461 | 446 | | 40 | 519 | 518 |
| 11 | 447 | 439 | | 26 | 490 | 456 | | 41 | 510 | 500 |
| 12 | 461 | 440 | | 27 | 433 | 456 | | 42 | 510 | 503 |
| 13 | 458 | 374 | | 28 | 439 | 379 | | 43 | 496 | 372 |
| 14 | 459 | 364 | | 29 | 537 | 364 | | 44 | 482 | 346 |

Over the 35 residues both solve, the mean change is **−49 t** (ON mean 434 t over all 45). Wall time per solve
0.8–5 s on a loaded box; the base's slow rows (8, 9, 10, 41, 42 at 7–17 s, the F1c rung's stall search) are ~1 s ON.

### Game witnesses (p4f, headless, `SEEDLING_PORT=9470`)

`scripts/procgen/plan-seedling-hammer-a-escape.mjs` (`--check`) solves the committed staging, frozen at this base
(`fixtures/witness-bases/r9-solve-18.hammer-a.json`), at a residue with the switch ON (and asserts the switch-OFF solve
refuses).

| tape | residue (live `seam.time`) | ticks | escapes (moving ticks) | record | game re-play | model | game hits | crossing (game = model) | kill / lock |
|---|---|---|---|---|---|---|---|---|---|
| `hammer-a-l18-escape21` | 21 (11496) | 445 | 6 (0/0/0/0/**38**/0) | ALL PASS, `save.time` 10407 = model | live = oracle | **0 px**, 446 obs | 0 | t445 | kills t172, t296; lock open t308; `{18,0}@408` |
| `hammer-a-l18-escape15` | 15 (11490) | 449 | 6 (0/1/0/0/0/0) | ALL PASS, `save.time` 10405 = model | live = oracle | **0 px**, 450 obs | 0 | t449 | kills t172, t300; lock open t312; `{18,0}@412` |

Residue 21's t262 escape (the landing the base refusal names) is a 38-tick moving path found breadth first (9,340
expansions). Residue 15 is the dash class.

**Mutant m2 (the kernel's prune off, `safe: () => true`)**. Predicted: the witness solves change or refuse, and the
sweep reds. Measured: both witness-solve rows in `hammerEscape.test.js` red (21 re-plans to a 442 t walk, 15 refuses
`HAMMER_SAFETY`), and the sweep reads **32/45** (refusing 0 1 9–15 26 27 43 44). Restored `dc2ed231…`.

⚠ A first pair of witnesses (21 and 6, recorded under `follow` = 30) was re-planned away. At that design every
residue-21 certificate was the hold, so its tape was byte-identical with the prune off: a witness that could not see
the mutant. Both re-recorded witnesses see it.

### Movers with the flag ON (measured, not landed): the list for the licence

Against the pristine base block (`10f1ef60…`), the flag-ON block (`SEEDLING_HAMMER_ESCAPE=1`, `18f266ce…`):

| row | base | ON | what moved |
|---|---|---|---|
| acceptance batch | `608693d2` | `76602ae8` | post-sword seed 13's skeleton re-plans 711 → 703 t (its sword-evidence WITH arm 730 → 715 t); a Progressive Shield WITHOUT arm 205 → 223 t. Every verdict unchanged. ⚠ `identity-block.sh`'s header says this row "holds NO spinner traffic at all"; it does now |
| empty pairs c3 / c6 | `043e1944` / `f85e7722` | `c7857047` / `42ed34d2` | generated levels' certify solves (the press kill) |
| carved pairs c4 | `4aa74add` | `b9d2185d` | the same |
| ENEMY census default | `25417923` | `0d3262f6` | the same (the spinner rows) |
| killgate s2 / s5 / s9 | `01210c82` / `07ce222a` / `30a1e3e7` | `006b0639` / `7d4cb820` / `49e23d85` | the same |
| `solve-seedling-r8-l18 --check` | `33d20889` exit 0 | `835256bf` exit 1 | `r8-solve-18` 520 → 363 t, 0 hits, 0 spinner contacts, `{18,0}` at 305 |
| `solve-seedling-r8-d2-chain --check` | `8e7a43be` exit 0 | `04dcbf23` exit 1 | the `r8-d2` headline re-plans 1,826 → 1,669 t (its L18 part 520 → 363; it no longer equals the promoted `r8-solve-18`, whose own producer moves above) |
| `solve-seedling-r9-campaign --check` | `a569eeec` exit 0 | `4cdcbacb` exit 1 | `r9-solve-18` (window 19, residue 40) 519 → **518** t; downstream, `r9-solve-19`'s declared `seam.time` 10479 → 10478 and the chain's sum |
| `plan-seedling-f1c-l18-phase --check` | `01ec5f9f` exit 0 | exit 1 | the F1c witness's solve at residue 42 needs no stall any more (503 t) |
| r8-battery, r8-tail, r9-l3 `--check` | — | unchanged | |
| the other 37 producer/planner `--check`s | — | unchanged (OFF = ON digest) | |
| committed tape replays | — | none can move | a replay never consults the solver |

Re-measured alone in the primary tree (the block's own command), unmoved: `generated set` (OK off, OK on; in the
blocks it read exit 1 in the wasm-less worktree and was refused by the box lock in the ON run) and
`plan-seedling-r7-ends-meet --check` (exit 0 off and on, the same digest, with a server on :8000, which its browser
leg hardcodes). Pre-existing and not this slice's:
`plan-seedling-ladder2-witness --check` reads DRIFT on `ladder2-l104-beam` at the pristine base too.

**STOP here**, as briefed. The user licenses the re-records with these movers. The flag is OFF in head.

## D3 — the live 40–42 gap (measured; no change)

`scripts/procgen/measure-seedling-l18-live-gap.mjs` runs the worker's own path, read-only: `jsRuntimeSolver
.solveAnytime` on a `wasmArrival.arrivalSolveRequest` (scratch persistence), at the shipped budget
(`SOLVER_BUDGET_WORK` 640, `SOLVER_UPGRADE_WINDOW_WORK` 85), at an unreachable budget (the units each pass NEEDS),
and with no budget.

| residue | shipped budget → plan | dashless pass | full (dash) pass | units the full pass NEEDS | no budget → plan |
|---|---|---|---|---|---|
| 40 | **540 t** (dashless) | 540 t, 21 u | refusal at 65 u, ⏱ `walk` / **window** | 66 (87 total) | 519 t (full) |
| 41 | **532 t** (dashless) | 532 t, 21 u | refusal at 66 u, ⏱ `sword-dash` / **window** | 105 (126 total) | 510 t (full) |
| 42 | **532 t** (dashless) | 532 t, 21 u | refusal at 66 u, ⏱ `sword-dash` / **window** | 105 (126 total) | 510 t (full) |

**Confirmed that the live lengths are the work budget; refuted that it is the F1c rung's search being cut.** 540/532
/532 is exactly the DASHLESS pass's plan, shipped because the 85-unit UPGRADE WINDOW cuts the full pass (`sword-dash`,
or `walk` at r40). That pass would make the 519/510/510 dash walk. The window misses it by 2 units at r40 and by 41 at
r41/42. The F1c rung does not fire at residue 40 at all (the committed walk is stall-free).

## What B should reuse, and change

- **Reuse:** `spinnerForecastWithPress` as B's body model for a hypothetical press, exact against the run, with a
  dash's rect, the run's window in flight and `own`. And the kernel's contract: real stepped states, a parameter key,
  a rank-kept breadth-first layer, the earliest mode, budget in expansions, named negatives.
- **Change:** B's search is (state, tick, fight state). A press is a SUCCESSOR, and its child's forecast is
  `spinnerForecastWithPress` from that node, so the forecast becomes a function of the path. Memoise per (press tick,
  facing, the points of the train), and note that dedup must then include the bodies' hits and timers. With one
  forecast per press node, the cost table says 8 px is the affordable key: a whole set at H75 is 15k–41k expansions,
  0.6–1.9 s here.
- **Change:** A's follow rule is a stop-gap with a measured price. The i-frame was safe to spend walking (−49 t vs the
  hold), so B should plan the next strike's approach inside the escape (earliest mode with the next strike's
  (cell, tick) set as the goal) rather than hand it to `stepToward` + the rung.
- **Keep from A:** the admission (no press without a certified way out of its own landing) and the re-aim check of
  later train tests from the escape's own points.
- **Feed B the residue-15 facts:** a strike press that swings RIGHT at a body down-left (t171) points at the aim key
  not setting `state.direction`; and the live arm's re-press is a dash. Both are press-model facts B's successor
  generator must use (D1's `outcome` reports the dash).

## The JS arc (`seedling-js-planning-3`): pins and wiring

- **No JS-arc file edited.** Their pins that move with the flag OFF: **none**. `jsRuntimeSolver`,
  `jsRuntimeSolverShouldStop` and `jsRuntimeDeclarations` are green before and after.
- **The new deadline site `hammer-escape`** is appended to `DEADLINE_SITES` (`solverDeadline`'s exact-list pin
  updated). It is asked only with `HAMMER_ESCAPE` on: every `SPACE_TIME_CHECK_EVERY` = 250 kernel expansions,
  whenever a deadline is active (coarse, like `axe-dodge`; not behind `fineCheckpoints`). A trip is no claim, never a
  refusal.
- **If the flag turns on, the JS arc must re-calibrate.** The escape search spends work units (one per 250
  expansions; a whole-set search at H75 is up to ~165 units), and the press kill's walks change. Their calibration
  pins (`jsRuntimeSolverCalibration.slow`, the L18 rows) are the candidates.

## Deltas

- New: `spaceTimeReach.js`; `levelRun.spinnerForecastWithPress`; in `solverBot`, `HAMMER_ESCAPE`,
  `withHammerEscape`, `HAMMER_ESCAPE_BOUNDS`, `pressEscape`/`strikeEscape`/`escapeHeld`, the `hammer-escape` site,
  and `clearOfHammersAt`/`discClearanceAt` exported (the one predicate, for instruments); `hammerEscape.test.js`.
- Tapes (roster 248 → 250): `hammer-a-l18-escape21`, `hammer-a-l18-escape15` + their game expectations; the frozen
  base `witness-bases/r9-solve-18.hammer-a.json`.
- Instruments: `sweep-seedling-l18-residues`, `witness-seedling-press-forecast`, `measure-seedling-escape-kernel`,
  `plan-seedling-hammer-a-escape`, `measure-seedling-l18-live-gap` (each `--help` prints and drives nothing; the import
  door holds).
- Pins: roster 248 → 250 (`tapeEnvelope`, `observationTolerance` ×2, `dialogueAutoAdvance`), `solverDeadline`'s
  site list. Surface GREEN 219 → 220 (`run:spinnerForecastWithPress`, classified seedling/forecast). Constants 5,403
  → 5,414 (structural). Entities 528, profile 138: unchanged.
- Records: `seedling-bot-log.md` § *Seedling hammer-phase A …*; `seedling-bot.md`'s press-kill paragraph; reference
  regenerated (instruments, docs index).
- `git config extensions.worktreeConfig true` was set on the primary clone (new-worktree.sh requires it).

## What the brief got wrong (measured)

1. *"15: … UNCLASSIFIED"* — it is a **dash**: the live arm re-pressed 7 ticks after a strike press that swung the
   wrong way, and the train preview does not step a dash.
2. *"the live 540/532/532 is the work budget cutting the F1c rung's search"* — the budget, yes, but the **upgrade
   window cutting the DASH pass**; 540/532/532 is the dashless plan, and the rung is not involved at residue 40.
3. *"dedup on a COARSE key (start with 8 px cell × per-axis velocity sign × tick)"* — not enough on its own: in
   depth-first order (and in breadth-first order without a rank) it declared L18's kill landing inescapable. The
   rank-kept layer makes 8 px work.
4. *"the nine movement sets + stand"* — the controller has eight movement sets + the stand = **nine** key sets.
5. *"the escape … for one escape horizon … The executor, after the landing, FOLLOWS the escape certificate"* —
   following it outright through the i-frame costs 75 t a solve. Following it only until the next strike can be
   derived (the brief's own alternative) costs nothing and saves 49 t.
6. The identity block's header: the acceptance batch "holds NO spinner traffic at all". With the flag ON it moves
   (post-sword seed 13).

## Residue

- The t171 strike press facing RIGHT at a body down-left (residue 15): a press-facing question for the fidelity arc
  or B.
- The escape's admission in `deriveStrike` starts from the walk's PREVIEW, not the executor's actual approach
  (`stepToward` deviates). The aim-time check is exact, and it is the one followed.
- `ladder2-l104-beam`'s planner DRIFT is pre-existing at base.

## Byte-inertia (flag OFF)

| row | base (worktree, `994e3fac52`) | head OFF |
|---|---|---|
| identity block | `10f1ef60…` | `75622c70…`: **every row identical**; the only textual difference is `generated set` (exit 1 in the wasm-less worktree; `OK` here, as at the first W0 run in this tree). Reference: 4 environmental DIFFER rows on both sides |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 a569eeec` | **identical**, all exit 0 |
| the sweep, OFF | 35/45, the table above | **identical** (every length) |
| 41 other producer/planner `--check`s | — | OFF digests = ON digests except the movers above |
| bounded vitest | 51 files / 2,400 | **52 files / 2,419, all green** (+ `hammerEscape`, 13 rows; + 6 per-tape roster rows of the two witnesses) |
| tapeRunner pairs | 553, `a227814c…` | **557**, `f22d60bd…`: the base's 553 unchanged + the two witnesses' four rows |

## Rows to BANK

- `sweep-seedling-l18-residues`: OFF 35/45 (the table); `--escape` 45/45, 0 hits.
- `witness-seedling-press-forecast --tapes --residues=0-44`: 9/9 + 35/35 exact (1 SCOPE, named).
- `plan-seedling-hammer-a-escape --check`: exit 0, md5 `29891f04`.
- Roster 250; surface GREEN 220; constants PASS 5,414; entities 528; profile 138.
- The game witnesses `hammer-a-l18-escape21` / `-escape15`: recorded, re-played, model 0 px.
