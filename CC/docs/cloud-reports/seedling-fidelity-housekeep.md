# Seedling fidelity HOUSEKEEP — wave 19 (model coverage)

**Verdict: W0 PASS · D1 PASS · D2 PASS · D3 PASS (switch OFF; a flip needs a licence and two re-pins, below).**

| | |
|---|---|
| Start SHA | **`4667f7e353`** (= main, DIGEST on main) |
| Head | the commit carrying this report. Before it: D1 `6a93c028`, D2 `a98e4f78`, records `2adbc26b`, D3 `302ac203` |
| Branch | `claude/seedling-fidelity-housekeep-i7w438` (the harness's name; the brief said `seedling-fidelity-housekeep`). Nothing went to `main` |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-housekeep-evidence/` (`w0/`, `d1/`, `d12/`, `d3/{off,on}/`, `tools/`) |

## The one thing to know first

**Of the brief's two measured "plain `Error`" sites, one is not a plain `Error`.** ROCKMOVE's orphan button throws a
`BotDriverV2Error` (`runHold`'s `fail`). So does `findExit`'s teleporter on a pit (survey 113 and 191). A census by
class name would have missed both. Measured at the base, the survey's 45 refused steps and the sweep baseline's 851
legs reach exactly **three** non-refusal throws: the frozen-tick press, the pit teleporter, and the orphan presser
(under ROCKMOVE's remove arm only). All three now leave `solveSegment` as a `SolverRefusal`, with the same words.

They become refusals **only at the outermost `solveSegment`**, never inside the ladder. The frozen-tick press throws
mid-`advance`, after the tick has started mutating the run. A rung that caught it as a refusal would go on from a
half-stepped run. So inside the solve every throw stays the object it was. A solve that did not throw is
byte-identical; one that threw now ends REFUSED.

## W0 — the base (PASS)

Battery `tools/battery.sh` (sequential, primary tree, port 9694).

| row | result |
|---|---|
| base | `git checkout -B claude/seedling-fidelity-housekeep-i7w438 4667f7e353` (`w0/sha-w0.txt`). Bootstrap `READY`, Node v22.22.0 |
| identity block | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK (`w0/identity-w0.txt`) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`, all exit 0 |
| tapeRunner pairs | **617 `8f27f975`**, 0 non-pass |
| surface / constants / entities / profile / roster | GREEN **312** · **6,028** · PASS **566** · PASS **138** · **280** |
| bounded vitest BEFORE | the brief's list + `seedlingSolverSurface`, `seedlingConstantsCensus`, `botDriverV2`, `levelWorld`, `twoPassSolve`, `fallRockButton`, `fidelityStepOff`, `seedlingObstacleEvents`, `presses`, `fidelityDarkTrap2`, `magicalLock`, `fidelityF6` (the grep hits): 76 files, **2239 / 2239** (`w0/vitest-files.txt`) |
| reference `--check` | "4 DIFFER" at W0. **Not stale**: six submodules were uninitialised after `READY` (DIGEST saw the same). After `git submodule update --init` of the six, the reference reads ALL 7 + 5 MATCH at base |

## D1 — plain throws → `SolverRefusal`, by name (PASS)

**The census, by code.** `tools/census-throws.mjs` (`@babel/parser`):
- the import closure of `solverBot.js` + `twoPassSolve.js`: 93 modules;
- every named function, with the names it calls; reachability from `solveSegment` / `twoPassSolve` by name (an
  over-approximation): 1,570 functions reachable;
- **196 reachable plain-`Error` throw sites** (162 in `levelRun.js`).

`tools/classify-throws.mjs` classifies each by its own words plus six named overrides. The table is
`d1/census-table.md`:

| class | n | meaning | what happens |
|---|---|---|---|
| (a) converted | 3 | `levelRun`'s press on a frozen tick | `code: 'FROZEN_TICK_PRESS'` → `SolverRefusal` |
| (a) model gap | 128 | the model's own named refusal of a state it does not transcribe (combos, nested freezes, an untranscribed NPC, …) | **kept**: no survey step or sweep leg reaches one at this base. Converting one is a one-line `code` at its site plus a `REFUSAL_BY_NAME.codes` row, on its first measurement |
| (b) argument contract | 36 | a caller handed a wrong argument | stays `Error` |
| (b) the tape's contract | 9 | "the tape equips / presses / holds …" — the solver writes its own tapes, so a hit is its bug | stays `Error` |
| (b) invariant | 20 | internal consistency (did not converge, passes disagree, a press inside a window the solver's own cadence derives) | stays `Error` |

The two non-plain sites (`BotDriverV2Error`) are outside this census. They were found by measurement: the survey's
refused steps re-run with each error's class recorded (`d1/survey-refused-{before,after}.jsonl`).

**The change** (`solverBot.js`, `levelRun.js`):
- `REFUSAL_BY_NAME` (`{codes, kinds}`), `nameRefusal`, `nameRefusalByCode`, `advanceNamingRefusals`, `refusingByName`.
- The model sets a `code` on three throws: `runFrozenTick`'s fire window, `runFrozenTick`'s weapon press, and
  `advance`'s `primary` press under `frozenTimer`. `levelRun` stays free of solver vocabulary.
- The solver names each throw where it first sees it:
  - the segment view's `advance` (one line in `viewOf`);
  - `findExitNamed` (the `reach-exit` goal's door);
  - `execHold`'s `orphanPresserNamed` (it re-reads `runHold`'s own test on the same world).
  The error gains `obstacle` and `refusalByName`. So every progress frame it unwinds through reads the obstacle's kind.
- `refusingByName` wraps `solveSegmentUnder` inside the deadline and the progress segment. At depth 1 only, a named
  error leaves as `new SolverRefusal(message, {obstacle})`, with `cause` (the original) and `byName {name, code}`.
- The (b) sites in the solver's own code (`assertTransitSamplesCarryEtas`, five throws) gain a comment saying why
  they stay errors. ⚠ The brief asked for that comment at **every** (b) site. The other 60 sit in `levelRun.js` (a
  shared file) and in hammer's functions, and each message already states its contract. The classification lives in
  the committed table instead, so the harvest merges textually.

**New `obstacle.kind`s (for the JS arc to wire):**

| kind | site | `progressKind` (RK class) | how |
|---|---|---|---|
| `unmodelled-frozen-press` (+ `code`) | `levelRun.runFrozenTick` ×2, `levelRun.advance` ×1 | `unmodelled` | by field (`/^unmodelled/`) |
| `unmodelled-pit-teleporter` (+ `id`, `tile`) | `botDriverV2.findExit` via `solverBot.findExitNamed` | `unmodelled` | by field |
| `orphan-presser` (+ `id`) | `botDriverV2.runHold` via `solverBot.orphanPresserNamed` | `does-not-apply` | by its words: the appended sentence "the hold resolves to NOTHING in this level" |

None lands in `other` or `error`. `orphan-presser` needs **no** `solveProgress.js` change. Optionally, hammer may map
`obstacle.kind === 'orphan-presser'` → `does-not-apply` by field, so that it does not lean on the words.

**Witness / test** — `fidelityHousekeep.test.js`, 6 rows, all on the committed atlas:
- sweep leg 631 (L74 booted on the L73 door's button);
- survey step 113 (L43's door to L37);
- ROCKMOVE leg 311 (L29 with the fallrock removed, the button kept).

Each row checks the class, the obstacle, the `cause`, that the words are kept, and `progressKind` on both the
refusal and the cause. Under the progress hook: outcome `refused`, `lastWhy {kind: 'unmodelled', name:
'SolverRefusal'}`, and **no node tallies `error` or `other`**. A nested `solveSegment` (fired from a `walk` site)
does not convert.

**Mutants** (predicted first, made by copy + restore, `/tmp` originals):

| mutant | predicted | measured |
|---|---|---|
| M1 the depth guard removed | the nested row red | 1 red |
| M2 `advanceNamingRefusals` does not name | the progress-tally row red (inner frames read `error`) | 1 red |
| M3 the sword press's `code` dropped | every row using leg 631 red | 3 red (631, progress, nested) |
| M4 the orphan never named | the orphan row red | 1 red |

**Rows this moves (before → after):**

| row | before | after |
|---|---|---|
| survey 113 (L43) | REFUSED, `BotDriverV2Error` | REFUSED, `SolverRefusal` `unmodelled-pit-teleporter`, words identical |
| survey 122 (L64) | REFUSED, `Error` (frozen press in a pickup ceremony) | REFUSED, `SolverRefusal` `unmodelled-frozen-press`, words identical |
| survey 191 (L100) | REFUSED, `BotDriverV2Error` | REFUSED, `SolverRefusal` `unmodelled-pit-teleporter`, words identical |
| other 42 refused survey steps | — | identical (verdict, class, words) |
| sweep leg 631 (L74 L73-arrival → L73 door) | failed "(refusal): levelRun: a sword press at tick 0 … FROZEN tick" | same words; the worker's answer now carries `obstacle` (`jsRuntimeSolver.settleSolve` forwards it) |
| ROCKMOVE 311 / 313 / 634 (remove arm, not on main) | THREW (`BotDriverV2Error`) | REFUSED `orphan-presser` (`d1/solver-legs-after.jsonl`) |

⚠ Neither instrument shows a THREW column. The survey writes `REFUSED` for any throw, and the sweep writes
`(refusal)`. So on CI the visible deltas are the sweep row's new `obstacle` and the RK kinds. The JS arc's wiring is
what makes them readable.

**RK totals that shift `error` → X** (hammer): only the solves above. Survey 113/191 and sweep 631: `error` →
`unmodelled`. ROCKMOVE's orphan arm: `error` → `does-not-apply`. `solveProgress.test.js` is green BEFORE and AFTER
(the L18/L40/L6/L3 pins do not move: no committed solve throws). `seedlingCanCross.classifyError`: these solves move
from `model-refused` to `cannot` (`kind: 'refusal'`, with the obstacle). Its tests stay green.

**CI dispatches for the planner:**
- `seedling-survey.yml` on `claude/seedling-fidelity-housekeep-i7w438`: `through=end route=full only=113,122,191
  base_run=39153361080`. Expect the three rows unchanged in verdict and words.
- `seedling-divergence-sweep.yml` on the same branch, `keys=` leg 631's key (`level_74 <- in_L73_64_0 ->
  exit:out_teleporter_288_144`). Expect `failed`, same words, `obstacle.kind unmodelled-frozen-press` on the answer.

## D2 — the lightpole label (PASS)

- `PERSISTENCE_RESPONSE.lightpole`: `'cosmetic'` → **`'light'`**. The comment now names the readers:
  `levelRun.stepDarkTrapsNow` (`darkTrapLight`, ON), `solverBot.deriveLightPole` and the rules' `poleKillsOf`.
- **No behaviour change, by code.** Every reader of the value:
  - `persistenceEffect` gives `effect: null` for both values (its `why` is console-only in the rules generator);
  - `clearedAwayByTag` reads only `despawn` and `lock-despawn`;
  - `fidelityArrival` reads `arm`;
  - `buildLevelWorld` reads `appear`, `silence` and falsy.
  No committed artifact carries the string (`rg`: only `seedlingObstacleEvents.test.js`, which injects its own table).
- `deriveLightPole`'s docblock gains the sub-order sentence. With no Spear, the Spear is the sub-order. A cross-room
  `ButtonRoom` writes the pole's tag from its own level (`ButtonRoom.as:93`): that is the rules' darktrap event, which
  the solver discharges as a `clear-tag` goal in the **presser's** room (`execCrossRoomPress`). The light arm never
  authors it; a pole lit that way is the arm's `wait` branch on the next build.
- Stale lines fixed: `presses.js`'s LightPole comment and `seedling-bot.md`'s DarkTrap paragraph. The paragraph
  also said `darkTrapLight` "OFF"; it has been ON since wave 11.
- ⚠ Left for their owners, stale but not mine to edit:
  - `flashPanel/seedlingObstacleEvents.js:364-365` (JS arc): "the model's `PERSISTENCE_RESPONSE` says `'cosmetic'`";
  - `scripts/procgen/plan-seedling-r4-route.mjs:140` (INTERIMS): "census entry is `cosmetic`".

## D3 — the walker's beam-tower blindness (PASS, OFF)

**What the brief got wrong (measured).** The `beamTowers` family in `livePerVisitOpts` alone moves nothing.
- The walker's planner is `planWaypoints` → `plannerObstacleAt`. On the named-key path, that function forwards eight
  families only: `beamTowers` is in `R8_NORMALIZE_LIVE_BATCH.plannerDropsSixFamilies.dropped`.
- The solver sees the drift only because it passes `liveBag: run.liveGeometryOpts()`.
- So the switch does two things (both one-liners, clear of `planWaypoints` / `controllerPathClear`):
  - `livePerVisitOpts` carries `beamTowers` = the run's drifted rects (`walkerBeamTowersOf`: `null` under noclip, or
    with no tower in the room);
  - `plannerObstacleAt`'s named-key normalise forwards it.
- `CONTACT_FIDELITY.walkerBeamTowers` is **OFF**, with `SEEDLING_WALKER_BEAM_TOWERS=0|1`, and is settable through the
  sweep's `contact_fidelity` input. The `livePerVisitOpts(` site count `r8Acceptance` pins is unchanged (5).

**Witness / test** — `fidelityHousekeepWalker.test.js`, 4 rows: L105 booted at (208,64), idle. By t7,
`beamtower@48,40` has risen 1.2 px (y 30.83 against 32). The planner's node test at (48,28) is blocked ON and free
OFF. At boot both arms agree. OFF, a bag that carries the family still changes nothing.

**Mutants:**

| mutant | predicted | measured |
|---|---|---|
| M5 the bag omits the family ON | rows 2, 3 | rows 2, 3 |
| M6 the planner does not forward | row 3 | row 3 |
| M7 the planner forwards without the switch | row 4 | row 4 |

**Movers, measured ON vs OFF (model only):**
- **The walker** (`tools/d3-walker-legs.mjs`): the real `createRuntimeWalker` loop driven in node, for every sweep leg
  whose room (`landed.level`) holds a BeamTower. Of **18 legs**, **1 moves**: **782** (L105 ← L106,
  `exit:out_teleporter_224_64`). OFF, the walk ends on the model's shake-band refusal (`flyer@192,16` on-screen,
  uncertain) at t179. ON, its plan diverges at t40 and it crosses to L104 at t479. The other 17 are byte-identical,
  778 and 787 (the flip's flakes) included. ⚠ This is model only: which arm the game agrees with is the keyed sweep
  below.
- **The survey:** in a room without a tower the family is `null` either arm, so only steps 194, 195, 196, 200 and 201
  can move. All five are identical ON vs OFF (verdict, ticks, words; `d3/survey-d3-{off,on}.json.gz`).
- **Licence run ON** (`d3/on/`): identity block and six `--check`s identical; tapeRunner 617 `8f27f975`. The bounded
  set plus the 12 files that stage `livePerVisitOpts` / `plannerObstacleAt` (89 files, 2609 rows): **2 red**, both
  pins of the OFF default, to re-pin on a flip:
  1. `contactFidelity.test.js` "the shipped defaults" — `walkerBeamTowers: false`;
  2. `r8Acceptance.test.js` "derives the planner's forwarded/dropped halves by driving it with sentinels" — ON,
     `beamTowers` moves from `dropped` to `forwarded`.
  The 12 extras OFF: 344 / 344.

**CI dispatches for the planner** (`seedling-divergence-sweep.yml`, branch `claude/seedling-fidelity-housekeep-i7w438`,
`producer=walker`, `keys=` the 18 legs below), once with `contact_fidelity=` (defaults) and once with
`contact_fidelity=` the default ON keys plus `walkerBeamTowers`. Then a ×2 keyed repeat of any leg that moves (782
expected):
`773 778 782 788 791 774 789 790 771 775 779 786 772 776 780 787 777 781` — e.g. 782 = `level_105 <- in_L106_256_0 ->
exit:out_teleporter_224_64`, 787 = `level_107__r0c2 <- in_L102_224_96 -> exit:out_teleporter_304_176`. The full keys
are in `d3/walker-legs.json` (`key`). The JS arc's review of the walker change is owed (the walker exception).

## Hand-overs

- **Hammer:** SP's `planWaypoints` memo. With `walkerBeamTowers` ON, `plannerObstacleAt` reads a time-varying family
  from the walker's opts, so the memo key must cover `beamTowers` (or the switch must stay OFF under the memo).
  Inert OFF.
- **Hammer:** `progressKind` may map `orphan-presser` → `does-not-apply` by field (optional; it already lands there by
  its words).
- **Hammer (pre-existing, found here):** a failing vitest assertion on a `SolverRefusal` / run object OOMs in V8's
  regexp compiler while it pretty-prints the object. Compare `.name`, not `toBeInstanceOf` on the object.
- No D touched a hammer function. `previewPressApproach`'s, `deriveFight`'s and `spaceTimeReach`'s throws are (b)
  invariants and are left alone.
- **No run state was added**, so `stateDigest` is untouched.

## Deltas and byte-inertia

- Every tape, every producer `--check` (`405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 3d41b9fb`), tapeRunner 617
  `8f27f975` and the identity block are **unchanged** after D1, D2 and D3 (`d12/`, `d3/off/`).
- Records:
  - solver-surface `--write` (312 rows: site counts; `botDriverV2` now reads `run.liveGeometryOpts` and
    `CONTACT_FIDELITY`);
  - constants `--write` (6,028 literals, moved lines);
  - the reference regenerated (docs index word counts; ALL 7 + 5 MATCH);
  - the `seedling-bot-log.md` entry, with 4 trap candidates.
- No tape index or roster change (no tape added).
- No AS3, wasm, gitlink, rules or `pytest`; no unfiltered local vitest; no `standing-values --write`.
- Bounded AFTER (OFF): 2265 / 2265 after the census writes (the `seedlingSolverSurface` / `seedlingConstantsCensus`
  reds before the writes were the stale tables).
- CI `JavaScript Unit Tests` at `302ac203`: 21002 / 21003. The one red is the reference generator's own `--check` test
  (the docs index went stale from D2's `seedling-bot.md` edit), fixed by this head's regenerate. Read CI at this head.

## What the brief got wrong (measured)

1. "Plain `Error`" for the orphan button: it is a `BotDriverV2Error`. The pit teleporter, which the brief does not
   name, is one too.
2. "Give the walker the family" in `livePerVisitOpts`: inert alone. `plannerObstacleAt` drops it (D3).
3. "Walker rows 778/787": the sweep baseline `39153416627` holds **no** `producer:walker` rows (all 851 are `solver`).
   The walker rows come from a `producer=walker` dispatch.
4. The brief describes a sweep row's `level` as the leg's room. It is where the leg **ended**; the room is
   `landed.level`.

## Residue

- 128 (a)-class model refusals stay plain `Error`s until first measured. The table names each, including ones in the
  BOMBBLAST (`drainBombBlastsNow` ×3) and WATCHERTALK (`stepWatchersNow` ×1) regions.
- The orphan presser should not be a `hold` obstacle at all; ROCKMOVE's fix removes the button with the rock.
- Leg 631's frozen-tick press is a planner can't-do: the walker's strike press is not scheduled around a freeze. It is
  a refusal now, not modelled.
- The survey runs that recorded each error's class used a scratch copy of `survey-seedling-route.mjs` (deleted).
  Its one change: line 1405 `refusal = e.message` → `` refusal = `[[${e.name}|${e.obstacle?.kind}|${e.code}]] ` + e.message ``.

## Rows to BANK

- `fidelityHousekeep.test.js` (6) and `fidelityHousekeepWalker.test.js` (4).
- The bounded set AFTER: 2265.
- Licence list ON: 2609 with 2 named reds.
- tapeRunner 617 `8f27f975`.
