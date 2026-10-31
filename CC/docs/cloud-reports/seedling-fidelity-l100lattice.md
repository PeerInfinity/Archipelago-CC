# Seedling fidelity L100LATTICE — a walk to an 8 px stance plans on the 8 px lattice (`fineStanceWalk`, OFF)

| | |
|---|---|
| Session | `seedling-fidelity-l100lattice` (planner `seedling-fidelity-planning-17`, wave 36) |
| Start SHA | `b646d32d95b4ebd636a70f05886957deffbf724a` (= main, 105 ON of 116) |
| Head | the last commit on the branch (this report is committed last) |
| Branch | `claude/seedling-fidelity-l100-lattice-4h9hax` (the harness's branch; the brief's `seedling-fidelity-l100lattice` is that branch) |
| Servers | `serve-nocache.py 9765` (this tree) · `9767` (scratch worktree `wt-flip`: this head with `fineStanceWalk: true`, never committed — the probes ON) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (the leg SOLVES, game-witnessed) · D3 PASS (flip-ready, every red listed)** |
| Key | `CONTACT_FIDELITY.fineStanceWalk`, appended at the END of the defaults; ships **OFF**, byte-identical OFF; `SEEDLING_FINE_STANCE_WALK=0|1`. 105 ON / 12 OFF of 117 |

**The one thing to know first.** With the key ON, the L100 → L101 leg is **SOLVED** (731 t). The brief expected it to stop on
the jellyfish press dwell; it does not. The break-stance walk now plans on the 8 px lattice. Its first corridor takes one hit
(`jellyfish@80,112` at t125), which knocks the player into the pool. The re-plan reaches (124,140), the rock breaks, and the
exit is taken. The game agrees at every sampled tick (p4g, 0 px; it bills the same hit at t125 and is in L101 at t731). The hit
is *unbilled*. That is legal at the defaults (`unbilledDamageGate` OFF), but the gate ON refuses the leg as UNBILLED DAMAGE. The
cause is the whole-dash certificate: it passed the first corridor as clean, and the drive was hit (handed to hammer, below).
⚠ **Step ids moved at this base**: the L100 step is survey **step 216** (219 at W35's base) and sweep **leg 914** (907).

## W0 (base `b646d32d95`)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.23.4 |
| reproduce | `node evidence/tools/seg219.mjs evidence/step-216-boot.json` (OFF) | REFUSED: *"… -> break stance (breakablerock@128,144): the re-planned corridor failed too — … waypoint 1 (124,140): not reached within 400 ticks; stalled at (110.99…,140.57…) v=(0.45,0) in level 100, aiming at (124,140), after grazing 393 solid(s): cliffside0 at (112,128) …"*. Walk path at t0 `(40,88) (56,40) (72,40) (88,136) (104,136) (124,140)`, re-plan at t603 `(104,136) (124,140)`. = WATERFALL D2, byte for byte |
| survey full, OFF | `survey-seedling-route.mjs --through=end --route=full --timeout=1500` in a base worktree | **201 SOLVED / 36 REFUSED of 237 steps** (`evidence/survey-full-off.log`). The route has 237 steps at this base (240 at W35's) |
| identity block, head at default (= OFF inertia row) | `SEEDLING_PORT=9765 bash scripts/procgen/identity-block.sh .` | file md5 `86336514839e6e6dfd1ef757de9482df` (`evidence/identity-head-off.txt`). Rows: maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK. Producers: battery `7486f32e`, d2-chain `93f75467`, l18 `88e33db7`, tail `35456fbc`, r9-l3 `6cd35fe1`, campaign `be9c19c8`, all exit 0. Each row equals WATERFALL's published value. Reference at that moment: "2 DIFFER", my docs words; regenerated, now "ALL 7 … MATCH" |
| roster | `fixtures/tapes/index.json` | 293, unchanged (the witnesses are in `fixtures/l100lattice-witness/`, not the roster) |

**Census 1: who walks to a stance an 8 px arm found, and on which lattice.** Every producer below returns a stance whose
existence was answered on `FINE_LATTICE`. At the base, every walk to such a stance is the frontier's `walkTo(goal,
plan.resolved.stance)`, planned with `solverPlanOpts(run, contacts)`, the run's **16 px** lattice. The 8 px lattice is reached
only when the 16 px plan THROWS (FRONTIER3's retry, after `identifyAndSelect` refuses) or re-enters its own order
(STANCE_REENTRY's axis-aligned fine walk).

| producer | where | stance from 8 px when |
|---|---|---|
| `fineSwingStance` (L100FIX) | `deriveSwingStance` → `break` / `pull` | every fresh 8 px cell (no 16 px ring cell names it) |
| `fineWandStance` (L12DOORS D3) | `resolveWandStrategy` | `stanceReaches` (16 px) refused, `fineWandStanceReaches` answered |
| `fineFrontierFlood` (RULESREF D3) | `deriveKeylockStance` | every 16 px cell failed; an 8 px key-line cell planned |
| bridge stance | `resolveBridgeStrategy` | the 16 px `planWaypoints` threw, the 8 px one did not |
| pole thrust | `resolvePoleThrustStrategy` | likewise |
| light pole | `deriveLightPole` | `stanceReaches` refused, the 8 px plan answered |

**Census 2: the "nearest node + appended target" fallback** (`evidence/w0-fallback-census.txt`, `.jsonl`). Instrument:
`evidence/tools/census-patch.py` on a scratch worktree's `botDriverV2.js`, never committed. It writes one row per
`planWaypoints` call whose goal node `nearestGoalNode` substituted, and asks whether the last kept segment passes the smoother's
own `controllerPathClear`. Full OFF survey, 237 steps:
- **364 substitutions, all on the 16 px lattice.**
- **355 have the target OFF the level** (an exit aim past the edge). Their last segment "fails" by construction; the walk
  transitions before reaching it. This is the fallback working as designed.
- **9 have the target IN the level**: 7 with a clear last segment, and **2 that cross a solid, both L100's (124,140)**
  (the walk and its re-plan). `nearestGoalNode`'s docblock says the appended segment is "one the smoother already checks". It is
  checked, but the fallback (`next = anchor + 1`) keeps it when the check fails. Measured: once in the whole route.

## D1: the key (PASS)

**Choice: plan on `FINE_LATTICE`, by mark, not "an unchecked last segment counts as no plan".** The measured argument:
- The census. The "no plan" predicate would fire on 357 calls, 355 of them exits that must keep working, so it needs an exit
  carve-out to touch the one real case. The mark touches only walks whose stance an 8 px arm answered.
- Work. A marked walk costs one 8 px `planWaypoints` ask in place of the 16 px one. Every other walk asks nothing new.
  `planWaypoints` (and hammer's SP memo on it) is untouched; the key is read inside the call.

**Change** (`solverBot.js`; `contactFidelity.js` + its env lines):
- `FINE_STANCES` (a module `WeakSet`) and `fineStance(c)`: returns `{x, y}`, and adds it to the set when the key is ON. It is
  an identity mark, so no record, trace or sidecar that carries the stance changes shape. The six producers above build their
  8 px-answered stance through it. The wand, bridge and pole sites gained a local `coarse` / `viaFine` / `reached.fine`, so
  only an 8 px answer is marked.
- `walkToUnder`: before the 16 px plan, `fineStanceWalkPlan` plans a marked aim on `FINE_LATTICE` (the attempt's own contacts
  and `goalPlanExtra`). It is skipped for an axis-aligned walk, a run already on the fine pitch, and `fineLattice: false`. A
  throw returns null, and the 16 px plan runs exactly as before. The walk row carries `lattice: 8` (FRONTIER3's key), and
  `fineLatticeWalks` gets a `FINE_STANCE …` row.
- **D1b, measured: an aim OFF the 8 px node grid is walked axis-aligned** (`manhattan`, and the walk's `axisAligned`).
  STANCE_REENTRY already does this, for its L48 reason: a diagonal bang-bang approach to a half-tile point cycles. The first
  cut planned a free corridor. ON, survey steps 172/200 (L12, `fineWandStance`'s (40,888); x 40 is on no 8 px node) got
  shorter (1301 → 1066 t, 1825 → 1416 t; both game-witnessed at 0 px, `evidence/superseded/`). But the whole-chain dash
  certificate on that corridor (`spinnerDashWhole`, hammer DASH's region) took **~60 s / ~105 s** of the solve against ~2 s
  (CPU profile: 38.6 of 40.3 s inclusive in `spinnerDashWhole` → `previewWalk`). The solver also runs in the page, so D1b
  narrows the rule. An axis-aligned walk asks no dash, and 172/200 now walk their OFF keys **byte for byte**. L100's (124,140)
  and L66's (76,84) are node centres and are unchanged.
- OFF: `fineStanceWalkPlan` returns null on its first test, and `fineStance` returns the same `{x, y}` unmarked.

**Mutants** (predicted first; copy + restore of `solverBot.js`; gate `fidelityL100Lattice.test.js`):

| # | mutant | predicted | measured |
|---|---|---|---|
| M1 | the swing arm returns an unmarked stance | the ON step-216 row red | **1 red**: that row |
| M2 | the walk ignores the mark (every walk fine-first) | the L89 control red | **2 red**: the L89 control, and the step-216 row (its exit walk changes too) |
| M3 | the fine-first walk not flagged `fine` | the step-216 row red (its `lattice: 8`) | **1 red**: that row |
| M4 | the axis rule off (`axis = false`) | the two L12 rows red | **2 red**: exactly those (and 56 s / 107 s each) |

Gate `fidelityL100Lattice.test.js`: 9 rows, green.
- ships OFF.
- OFF: the 16 px stall.
- ON: step 216, key for key the witness.
- Witness replays: step 216 and step 168, each 0 px with hits and level.
- ON: step 168, key for key its witness.
- The L89 control (W35's step-89 witness): same keys ON.
- Steps 172/200: ON keys = OFF keys.

## D2: the L100 leg (PASS)

- **Refusal before → after** (survey step 216, local, both arms):
  - OFF: *`solverBot(survey-step-216) reach-exit (288,96)->L101 -> break stance (breakablerock@128,144): the re-planned corridor failed too — … waypoint 1 (124,140): not reached within 400 ticks; stalled at (110.99…,140.57…) … cliffside0 at (112,128) …`*
  - ON: **`SOLVED 731 ticks, 3 decision(s), 1 re-plan(s), 1 hit(s)`**.
- The walk, ON:
  - t0: the break order; the stance walk plans `FINE_STANCE` (6 waypoints, the WATERFALL 8 px corridor), dashed and
    "certified whole".
  - t125: `jellyfish@80,112` hits the player (a trade: the swing lands too). The knockback drops the player into the waterfall
    column, carried to the pool by t~150.
  - t~160–479: the Feather climb back up to (108,28) stalls. 400 ticks on one waypoint is the walk's bound.
  - t479: re-plan from (107.2,67.8), on 8 px: `(116,36) (124,140)`. It arrives, and the rock breaks from (124.9,155.4).
  - t650: the exit walk (8 px), `(148,148) (296,104)` → L101 at t731.
- **The jellyfish press dwell (hammer's) is not met.** No kill of `jellyfish@88,144` is ordered on this path.
- **Game witness** (`fixtures/l100lattice-witness/step216-on.json`): the survey's own ON walk tape, from step 216's boot, run on
  p4g headless, `probe-seedling-chaser-mobiles --class=Jellyfish --player-hits --frames`, port 9765.
  - The sample clock fits at shift [0].
  - Jellyfish: 1103 comparisons, worst |Δ| 0.
  - Player (x,y): **0 px at all 728 sampled ticks** (`evidence/tools/cmp216.mjs`, `evidence/witness-step216-on.txt`).
  - The game's `hits` steps at **t125**, the model bills `jellyfish@80,112` at t125, and the game is in **L101 at t731**.
- **With `unbilledDamageGate` ON** (not the default): *"solverBot(l100): UNBILLED DAMAGE — the segment reached its 1 goal(s),
  but its drive took 1 hit(s) no plan billed [t124 (run t125, L100) chaser:jellyfish@80,112] …"*. The hit is a preview≠drive
  gap in the dashed walk's certificate. See *Handed over*.

## D3: flip readiness (PASS; every red listed)

Bounded set: **106 files** (`evidence/bounded-set-files.txt`). That is the brief's list (`apReportBosses` has no test file of
that name at this base; `fidelityApBosses` is in), plus every `grep -a` hit for
`fineSwingStance|FINE_LATTICE|solverPlanOpts|planWaypoints|fineLatticeWalks|fineWandStance|fineFrontierFlood|fineStanceWalk|FINE_STANCES`,
`fidelityRulesref`, `fidelityL40Bk2`/`Bk2b`, `fidelityL12Doors`, `fidelityStance`, `fidelityLightPole`, `stringPullFast`, the
L4 trio (`dashOnlyWindow`, `dashShape`, `jsRuntimeSolverShouldStop`), and the surface/constants tests.

| row | command | result |
|---|---|---|
| bounded set, defaults (this tree) | `npx vitest run <106 files>` | **106 / 106, 2,684 / 2,684** (`evidence/vitest-defaults.txt`) |
| bounded set, key ON (`wt-flip`: the default flipped, not the env, so no off-default stamp) | same | **101 / 106 files, 2,683 / 2,688 (1 skipped)**, 4 red (`evidence/vitest-on.txt`), all listed below. The fifth file, `seedlingWasmPlayback.test.js`, fails to LOAD in the worktree (`registerBackend: duplicate id 'empty'`: the symlinked `shared` submodule is imported under two paths, WATERFALL's W0 note); it is green in this tree |
| L4 dash margin | `dashOnlyWindow`, `dashShape`, `jsRuntimeSolverShouldStop`, ON | **green**. L4 has no 8 px-answered stance, so no walk changes and no work is added |
| work pins `solveProgress`, `solverDeadline` | ON | **green**: no hammer work pin moved |
| six @ci-box `--check`s, ON | `evidence/six-checks-on.txt` | all six **identical** to OFF (battery `7486f32e`, d2-chain `93f75467`, l18 `88e33db7`, tail `35456fbc`, r9-l3 `6cd35fe1`, campaign `be9c19c8`), exit 0 |
| `ci-producer-checks.mjs --jobs=3`, ON | `evidence/producers-on.txt` | **97 run, 2 red**, 1 skipped by design (`plan-seedling-r7-ends-meet`, browser arm). Both reds are listed below; both producers are green OFF in this tree |
| probes standard, ON | `wt-flip` on :9767, each probe as `seedling-probe.yml` runs it | see *Probes* below |

**Every red ON, i.e. what a flip owes:**
1. `contactFidelity.test.js` "the shipped defaults": the pin a flip owes by construction (`fineStanceWalk: true`).
2. `fidelityL100Lattice.test.js` "ships OFF": likewise.
3. `fidelityL100.test.js` "ON: the solver's plan from the sliver IS the committed game witness" + producer
   `plan-seedling-l100-witness --check` (DRIFT): the roster tape **`l100-sliver-rock`** moves **185 → 267 t**. Its break walk
   now plans on 8 px and breaks sooner (t97 → t59), but the exit walk's dash windows differ and it ends later. Both arms are
   hitless and in L101. **The ON plan is game-witnessed** (`evidence/sliver-walk-on.json`, p4g: model = game at all 268 ticks,
   0 px, Jellyfish 1068 comparisons at 0, 0 hits, L101 at t267, `evidence/witness-sliver-on.txt`). It needs a re-record
   licence.
4. `fidelityRulesref.test.js` "both ON: the committed witness, byte for byte" + producer `plan-seedling-rulesref-witness
   --check` (DRIFT): the roster tape **`rulesref-l66-door`** moves **230 → 241 t**. Its ON keys are **identical** to step 168's
   ON plan, which is game-witnessed (`fixtures/l100lattice-witness/step168-on.json`, 0 px, hitless, L70 at t241); the two
   stagings differ only in `persistence`. It needs a re-record licence.
5. **jsRuntimeTape `NO_TAPE_CHAIN`** (not in the bounded set; measured separately): 2 rows red at this head, at the
   defaults, and 10/10 green at the base. Any new key moves it, as the brief predicts. **Not re-pinned**: js's train 3 re-pins
   the chain.

No STUB or CONTROL assumed the old default: `grep -a fineStanceWalk` finds only this slice's files.

## The survey / sweep / probe rows this moves, and the dispatches to confirm them

**Route survey, full, local, both arms** (`evidence/survey-on-vs-off.txt`; ON in a worktree at this head with
`SEEDLING_FINE_STANCE_WALK=1`): **201 → 202 SOLVED** (36 → 35 REFUSED). Two movers. Every other row's verdict, ticks, hits and
refusal text are equal.

| step | level | OFF | ON |
|---|---|---|---|
| 216 | L100 → L101 | REFUSED: the 16 px break-stance walk stalls on `cliffside0@112,128` | **SOLVED 731 t, 1 re-plan, 1 hit** (game-witnessed, D2) |
| 168 | L66 → L70 | SOLVED 230 t | **SOLVED 241 t**, 0 hits. `fineFrontierFlood`'s keylock stance (76,84) is walked on 8 px (two `FINE_STANCE` walks, t64 and t160); game-witnessed 0 px, L70 at t241 |

(The D1a survey, before the axis rule, also moved 172 and 200; it is kept at `evidence/superseded/`.)

**Dispatches for the planner** (cloud cannot dispatch):
1. **Survey A/B**: `seedling-survey.yml` on `claude/seedling-fidelity-l100-lattice-4h9hax`, `through=end route=full`. Run it
   once at the head, and once on a scratch commit that flips `fineStanceWalk: true` in `contactFidelity.js` (the workflow has
   no `contact_fidelity` input). Expected: steps 216 and 168 only. Cheap variant: `-f route=full -f only=168,216`.
2. **Divergence sweep ×2 per arm**: `seedling-divergence-sweep.yml` on the branch, the full leg list.
   - OFF arm: `contact_fidelity` empty.
   - ON arm: `contact_fidelity` = the 105 default-ON keys + `fineStanceWalk`, the exact string in
     `evidence/sweep-on-arm.contact_fidelity.txt`. ⚠ An unlisted key turns OFF.
   - Keyed variant: `keys=` the 87 legs of L100 / L66 / L12 derived at this base (`evidence/sweep-keys-l100-l66-l12.pipe.txt`;
     ids in `.txt`; 919 legs) with `capture_requests=true`.
   - Expected movers: **leg 914** (`level_100__r4c10 <- in_L99_48_96 ~> level_100__r2c3 -> exit:out_teleporter_288_96`, step
     216's) failed → done, and L66's door leg. L12 legs should not move (D1b).
   - Note the sweep's `leg_budget_ms`: leg 914 ON solves in ~3.5–5.5 s locally.
3. **Probes standard**: `seedling-probe.yml -f battery=standard` on the scratch flip commit, and at the head as the control.

**Probes standard, key ON (local):** PROBES_PLACEHOLDER

## The JS arc

- No new staging/result field, and no new `SolverRefusal.obstacle.kind`. `fineLatticeWalks` (an existing optional result
  field) gains `FINE_STANCE …` rows ON. Nothing to wire.
- `NO_TAPE_CHAIN` (jsRuntimeTape) moves with the new key (2 rows): js re-pins with train 3.
- No `run.*` field renamed or reshaped (`seedlingSkinRenderer` green in the bounded set).
- The walker (`botDriverV2.drive` and friends) is untouched. No `producer:walker` row is expected to move.

## Handed over

- **Hammer (DASH / `dashSpinnerForecast`, `spinnerDashWhole`)**:
  - (a) Step 216's first fine corridor is "certified whole" and its drive is hit by `jellyfish@80,112` at t125 (game-witnessed).
    With `unbilledDamageGate` ON that is UNBILLED DAMAGE. Measurement: `SEEDLING_FINE_STANCE_WALK=1
    SEEDLING_UNBILLED_DAMAGE_GATE=1 node evidence/tools/seg219.mjs evidence/step-216-boot.json`.
  - (b) The whole-chain certificate's cost on a long fine corridor: ~60 s / ~105 s on L12 steps 172/200 with D1b removed
    (mutant M4 reproduces it). Not on the shipped path, but any future rule that frees long walks onto 8 px meets it.
- **The jellyfish dwell** (L100 Gap 2): still hammer's, and not on step 216's ON path.

## Deltas

- `solverBot.js`: `FINE_STANCES`, `fineStance`, `fineStanceWalkPlan`. Three lines at the walk's plan site, and one-line
  stance changes at the six producers. OFF: no branch taken.
- `contactFidelity.js`: + `fineStanceWalk` (OFF, at the end) and its env lines. 105 ON / 12 OFF of 117.
- New: `fidelityL100Lattice.test.js`; `fixtures/l100lattice-witness/{step216-on,step168-on}.json` (game witnesses),
  `{step172,step200}-boot.json` (boots for the L12 rows).
- Pins: `contactFidelity.test.js` (+1 OFF row).
- Surface census `--write`: **GREEN 365** (+2 rows: `run:state`, `run:world` and the `CONTACT_FIDELITY` import counts in
  `solverBot.js`). Constants census **PASS 7,038** (0 new).
- Docs: the `seedling-bot.md` paragraph, the `seedling-bot-log.md` entry, and the reference regenerated (`docsIndex.js`,
  `README.md`): "ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH".

## What the brief got wrong (measured)

- **"expect L100→L101 to stay refused there [the jellyfish press dwell]"**: it SOLVES (731 t, one unbilled hit, game-witnessed).
  The 8 px corridor never orders the press kill of `jellyfish@88,144`.
- **"survey step 219" / "leg 907"**: at this base the L100 step is **216** and its leg is **914**. The route lost 3 steps
  (237 vs 240), and the leg derivation has 919 legs.
- **"Census … the appended segment is ever collision-checked"**: it IS checked (`controllerPathClear` in the string-pull), but
  the fallback keeps it when the check fails. Over the whole route this happens in-level only at L100 (2 calls). The other
  355 failing calls are exit aims past the level edge, by design.
- **"FINE_LATTICE planning is pricier"**: the plan itself costs about the same. The price is downstream: on a long free fine
  corridor the whole-chain dash certificate dominates (~50×), hence D1b.

## Residue

- Step 216 solves with one unbilled hit (hammer, above).
- `l100-sliver-rock` and `rulesref-l66-door` re-records wait on a flip licence; both ON plans are game-witnessed.
- `seedlingWasmPlayback.test.js` cannot load in a symlinked worktree (environment, not code).

## CI (push, `JavaScript Unit Tests`)

CI_PLACEHOLDER

## Byte-inertia

OFF is byte-identical:
- `fineStanceWalkPlan` returns null on its first test, and `fineStance` returns `{x, y}` unmarked.
- Identity block at the head (default OFF): every row equals WATERFALL's published value, with the six producer digests
  unchanged.
- Bounded set at the defaults: 106/106. Both re-record producers are green OFF.
- The full survey OFF is the base's: the OFF survey ran in a worktree at `b646d32d95` itself.

## Rows to BANK

- Roster **293** (unchanged). Surface census **365**. Constants **7,038**.
- Game witnesses `fixtures/l100lattice-witness/`: `step216-on` (731 t, 0 px over 728 ticks, the hit at t125, L101),
  `step168-on` (241 t, 0 px over 238, 0 hits, L70).
- Survey ON (local): 202/35; step 216 SOLVED 731 t; step 168 241 t.

## Trap candidates

- A stance found on a finer lattice is not reachable on the coarser one just because the coarser plan does not throw.
  `nearestGoalNode` substitutes a node up to two cells away, and the string-pull's fallback keeps the target as an unchecked
  last segment.
- A free fine corridor can cost ~50× an axis-aligned one, because the whole-chain dash certificate previews every tick of a
  long walk. Measure solve time, not only ticks, when moving walks onto 8 px.
- `git checkout <sha> -- frontend` in a worktree whose submodules are symlinks replaces the links with empty directories.
  Re-link before running anything there.
