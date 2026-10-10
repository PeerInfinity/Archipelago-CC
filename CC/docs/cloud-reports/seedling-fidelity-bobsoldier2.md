# Seedling fidelity BOBSOLDIER2: the kill arm walked a walk nobody forecast

**Slice:** `seedling-fidelity-bobsoldier2`, an Opus build slice run in the cloud for the model-fidelity arc (planner `seedling-fidelity-planning-5`), wave 10 (model coverage).

| | |
|---|---|
| Started from | **`3e0ff8b80f`** (main after the hammer arc's B2) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-bobsoldier-bait-dwell-yyivvw` (there is no local `seedling-fidelity-bobsoldier2` branch; the harness branch IS the slice branch) |
| Commits | D1+D2 `973341d` · D3 `cc6d8c2` · roster records `b285ce4` · records `fb74d06` · reference + this report (last) |
| Dev servers | `serve-nocache.py 9520` (this tree), `9521` (a pristine BEFORE worktree `/home/user/wt-base` @ `3e0ff8b80f`, `node_modules` and submodules symlinked) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (both switches OFF; flip = STOP for licence, movers below) · D3 PASS** |

## The one thing to know first

**The model and the forecast were both right; the executor walked a different walk.** `deriveKillByChaser` prices
a stance by previewing an UNDASHED walk to it (`planWaypoints` + `previewWalk`, the strike policy, no dash plan) and
derives the dwell's bound from that preview. The ladder then walked to the stance with `walkTo`, which asks
`planSwordDash` for every corridor. On L30 the dashed walk arrives 53 ticks early, with the BobSoldier on one hit
instead of two, and the 53-tick bound runs out with the body alive. The game agrees (body bit-exact). Two switches
fix step 50 (and live B's L30 stop): walk the stance as forecast, and time the corpse's blade at the next walk's
gate. Both ship OFF. ON, they move exactly one producer digest (`solve-seedling-r9-campaign`, one trace sidecar, no
tape byte): the user licenses the flip.

## W0 (at `3e0ff8b80f`, before any edit, in the pristine worktree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9521 bash scripts/procgen/identity-block.sh .` in `/home/user/wt-base` (venv active) | maze `246dfbce…`, acceptance `76602ae8…`, c3 `4937da80…`, c6 `430573e9…`, c4 `b9d2185d…`, ENEMY `30bcc49c…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `006b0639…`/`7d4cb820…`/`49e23d85…`, level pre/post s1 `e28c1e5d…`/`fb1a59e5…`, generated set OK; reference "4 DIFFER" (this container's uninitialised substrate submodules, as the BOBSOLDIER report found). Full log: `seedling-fidelity-bobsoldier2-evidence/w0-identity-3e0ff8b80f.txt` |
| six producers | the block's loop | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1` + r9-campaign `13b8d51f`, **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, rows `(fullName, status)` sorted, `name\tstatus\n` joined, md5 | **575**, md5 **`fbe5fc605470431789b76760698b9564`**, 0 non-pass |
| surface / constants / entities / profile | the four `--check`s | GREEN 227 / PASS 5,443 literals / PASS 528 leaves / PASS 138 keys |
| roster | `fixtures/tapes/index.json` | 259 |
| bounded vitest BEFORE | 57 files: the brief's list plus every `grep -a` hit for what I touch (`chaserDanger`, `dangerAt`, `deriveKillByChaser`, `DEADLINE_SITES`, `forkRun`, `execBait`, `kill-chaser`, `walkTo`, `dangerDuringTransit`): `bobSoldier botDriverV2 dangerMap fidelityAxe fidelityClearTag fidelityCrusher fidelityFrontier3 fidelityLadder2 fidelityStepOff hammerApproach hammerEscape hammerFight jsRuntime{ArrivalOnDoor,Atlas,Core,Declarations,GeneratedSolver,SolveService,Solver,SolverShouldStop,VanillaDelivery,Verbs,Walker} levelRun procgenCollectPath r5SwimCloseout solverBot solverDeadline solverPrefix turretSolver wasmWalkTape watchOverlays r8Acceptance tapeEnvelope observationTolerance dialogueAutoAdvance tapeIndexManifest ropeSword shoveWeighParity watchGenOverlay r5Shaft fidelityArrival fidelityKillLock ghostSword solverReachPit arrowTrap enemyDamage contactFidelity decisionTrace entityBlocks seedlingCanCross campaignChain` + `oneSpelling boxLock lintGateLabels seedlingConstantsCensus seedlingSolverSurface` | **57 files / 1,967 tests, all green** |

## D1: the measurement on the game (PASS)

**The staging.** Survey step 50 (`--through=end --route=full`): `r8-solve-11`'s committed block re-pointed at
L30 (176,48), save keys [0, 1], the shield, and the five clears the route has earned (`{0,1} {19,1} {12,4} {12,5}
{31,0}`); goals [collect Torchpickup (64,64), reach-exit stairsup@224,160 → L32]. Rebuilt by
`plan-seedling-bobsoldier2.mjs` byte-equal to the survey's own boot view.

**The forecast vs the drive, per tick** (node, both sides of the same solve; `t` from the kill arm's decision):

| | the forecast (`deriveKillByChaser`'s preview of (88,56)) | the drive (`walkTo` → stance, then `runDwell`) |
|---|---|---|
| the walk | down-left to y≈103, west along it, north up x≈87.9: no `primary` in transit | the same waypoints, `primary` pressed every ~8 ticks: `planSwordDash`'s schedule, ≈2.2 px/tick against ≈1.2 |
| first hit on the body | t85 (a strike in passing) | t~67 |
| arrival at the stance | **t145**, body at (77.09,82.84) **h2** | **t92**, body at (70.39,86.65) **h1** |
| the dwell | the body climbs to ~(79.6,73.7); the press at t166 kills, gone at **t168** | the body climbs to ~(78.2,71.4); h2 at t~127; at **t145** alive at (78.95,72.84) **h2** |
| bound | `(168 − 145) + HOLD_SLACK` = 53 | 53 ticks from t92: ran out at t145 |

**Where they part, and why:** at tick 1, by the dash. The forecast priced a dashless walk, and the dwell's bound is
measured from the forecast's own arrival. The drive is a different walk: `walkTo` plans `planSwordDash` per corridor.
It arrives 53 ticks earlier, before the second strike, so the body still needs more than the bound.

**The game agrees with the model.** The keys the base solver drove up to the refusal (145 t) are the tape
`bobsoldier2-l30-dash-stance` (captured by a recording `Object.create(run)` view of every run the solve makes; no
debug hook ships). Played on p4f, headless, port 9520:
- `check-seedling-bot-differential --record --only=bobsoldier2-l30-dash-stance`: *"THE MODEL REPRODUCES THE RECORDING
  IT JUST MADE"*, 146 observations; tapeRunner's pair is green.
- `probe-seedling-bobsoldier-mobiles --tape=bobsoldier2-l30-dash-stance`: clock shift [0]; the BobSoldier's position,
  velocity, `hits`, `hits_timer` at every sampled tick, **146 comparisons, worst |Δ| 0**. The body is alive on 2 hits
  at the end of the bound on the game too.

So neither the model nor the forecast is wrong about the game: the executor walked a walk nobody forecast.

## D2: the fix (PASS — both switches OFF; flipping them is the licence)

**D2a `KILL_STANCE_AS_FORECAST`** (`solverBot.js`, env `SEEDLING_KILL_STANCE_AS_FORECAST=1`,
`withKillStanceAsForecast`): the chaser kill arm's stance walk is `walkTo(…, {undashed: true})`. The new `walkTo`
option makes `dash = null` for that walk, so the strike policy is the preview's own. Step 50: arrival t145, kill t167:
the drive IS the forecast.

**D2b `SWORD_GATE_TIMED`** (env `SEEDLING_SWORD_GATE_TIMED=1`, `withSwordGateTimed`). Measured as the next wall:
with D2a alone, the walk after the kill refused at its own gate, *"the danger map forbids (87.86,58.05) —
chaser:bobsoldier@48,80 (inside leash 80 (d=15.8), box grown 0.8 px/tick x 0 + pad 16)"*. That was against the
CORPSE, whose blade the stance's own forecast had shown clear of that box for the 21 dwell ticks after the kill.
With the switch, a WALK's decision gate (`refuseDanger` before the plan, and the walk row's `saw`) hands
`chaserDanger` the chaser forecast stepped one tick against the player standing at the box (`swordTickAt`: the walk's
own first transit sample, post-step bodies against the pre-move player). A sworded body is priced by that tick's sword
lines and its bare body instead of `threatPad` 16. Every other body keeps the pad. The gate before an EXECUTOR
(`refuseDanger` after a stance walk) and the bait stance scan keep the pad: what follows them is a multi-tick verb,
not a probed walk. The option is `chaserDanger`'s new opt-in `swordTick`, asked only at horizon 0.

**Each alone still refuses; both solve.** Rows in `fidelityBobSoldier2.test.js`:

| switches | step 50 |
|---|---|
| both OFF (default) | REFUSED: the dwell (the survey's text) |
| D2a only | REFUSED: the gate's pad 16 against the corpse |
| D2b only | REFUSED: the dwell |
| **both ON** | **SOLVED 460 t**: the dwell kills in 22 of its 53-tick bound, 0 hits, the Torchpickup, stairs → L32 |

**Game witness of the AFTER.** `bobsoldier2-l30-torch` (the solver's own plan, both ON, authored by
`plan-seedling-bobsoldier2.mjs`, `--check` byte-identical):
- recorded on p4f: *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 461 observations, 1 transition(s)"*;
  `save.time` game 9237 = model 9237; 190 fade frames skipped;
- the body probe: the BobSoldier **bit-exact, 178 comparisons, worst |Δ| 0** (alive and through the kill).
- ⚠ The probe's player-clock calibration reads one sample off at t225, the apitem's ceremony (dead frames). Every
  other sample fits shift 0, and the differential (dead-frame aware) matches all 461 observations. This is the
  probe's first-sample-per-tick rule, not the model (trap candidate 3).

**Mutants** (predicted, made by copy → edit → restore; `solverBot.js` restored to `413b3318…`, `dangerMap.js` to `45dfa7d1…`):

| mutant | predicted | measured |
|---|---|---|
| M2 `undashed` ignored in `walkTo` | "both ON" and "D2a alone" red | exactly those two red, 13 green |
| M3 the gate ignores `swordTick` | "both ON" and the D2b unit row red; D2a-alone unchanged | exactly those two red |

## D3: the CRUSHER_BAIT fork hygiene (PASS)

**(b) the latent defect, failing test first.** `solveSegment`'s `fork` keyed the equips by `t`
(`run.ticksCompleted`, the RUN clock) and replayed them at the perTick INDEX. `replayOntoFork` (exported) applies each
equip when the FORK's own run clock reaches its `t`, before the next advance, which is where the live run applied it.
It fails by name on a clock it never lands on, and applies an equip made after the last driven tick, which the first
cut dropped. Rows in `fidelityForkHygiene.test.js`: a stub run with 174 dead frames at advance 3 and equips at clocks
2, 180, 184; the fork's equip log equals the live one. **Mutant M1** (the index keying restored): the two rows red
(predicted).

*No production row hits it today:* the equip-bearing fork is only `execBait`'s (L42), whose solve makes no equip.
Proved byte-inert by survey step 85's walk view: md5 `30d243ae…` (1294 t) and dashless `6ee4638e…` (1566 t), equal
to the base. The six producers and the identity block are unchanged too (below).

**(a) the budget: an OPT-IN FINE site.** The new `DEADLINE_SITES` row `crusher-fork` is appended and is FINE: it is
asked only under `fineCheckpoints`, before each fork try and every `WALK_CHECK_TICKS` advances of the replay. A trip
refuses the bait verb by name (*"deadline … at the `crusher-fork` site after N fork tr(y|ies)"*); `e.deadline.first`
is `crusher-fork`. **The existing sequences are unchanged, measured** (`solveSegment` on the CRUSHER witness's L42
staging, `shouldStop` logging every ask, both trees):

| `fineCheckpoints` | dash | base asks (md5) | head asks (md5) |
|---|---|---|---|
| false | all | 185 sword-dash (`6dce7c77…`) | **identical** (`6dce7c77…`) |
| false | none | 0 | **0** |
| true | all | 268 (`c44e3a91…`) | 379 = the base's 268 + 111 `crusher-fork`; without them `c44e3a91…` |
| true | none | 98 (`fce9643d…`) | 193 = 98 + 95 `crusher-fork`; without them `fce9643d…` |

**Mutant M4** (the per-try ask made coarse, `deadlineReached`): the coarse-sequence row red (predicted).

## The survey/sweep rows this moves (before → after)

**Survey** (`survey-seedling-route.mjs --through=end --route=full --only=50,52,61,82,84,85,131`; base, head OFF, head
with both switches ON; rows in the evidence dir `sv-{base,off,on}.json`):

| step | room | base | head OFF | head ON |
|---|---|---|---|---|
| **50** | L30 Torchpickup + stairs, boot (176,48) | REFUSED (the dwell) | REFUSED (same text) | **SOLVED 460** |
| 52 | L30 → L22, pit boot (224,80) | REFUSED (pad 16, d=4.7) | REFUSED (same text) | REFUSED, now *"the BobSoldier's 8x8 body, bare, one forecast tick on"* (a real contact; left named, as the user ruled) |
| 61, 82 | L40 | REFUSED | same | same |
| 84, 131 | L40 | SOLVED 70 / 172 | same | same |
| 85 | L42 crusher | SOLVED 1294 | same (walk md5 = base) | same |

**Live sweep** (`probe-seedling-divergence-sweep.mjs --producer=solver --ids=321,327,333,339`; the production wasm
`seedling_playthrough` page, p4f, headless; the browser takes the switches' DEFAULTS, so for the ON column both defaults
were flipped in the working tree for the run only and restored (`solverBot.js` md5 `413b3318…` before and after):

| leg | arrival | base `inv` | ON `inv` | base `bare` | ON `bare` |
|---|---|---|---|---|---|
| 321 | (16,128), from L28 | done (87 t) | done (87 t) | done (107 t, detour) | done (107 t) |
| **327** | (176,48), from L31 — **live B's L30 stop** | **failed: the dwell** | **done, 191 t (kill, walk), no divergence** | failed: EXHAUSTED (no sword) | same |
| 333 | (224,80), pit | failed: EXHAUSTED (the chaser arm: no stance) | same | failed (no sword) | same |
| 339 | (240,80), pit | failed: EXHAUSTED (the chaser arm: no stance) | same | failed (no sword) | same |

The `bare` legs hold no sword (`before.has` is empty), so the press arm cannot run there. 333/339's arm refuses in
its stance scan: 14 cells in leash, 7 reachable with a corridor onward, 7 refused by the forecast (*"still standing
after the whole 115-tick ceiling"*, *"the WAIT is dangerous at tick 220"* …). That is a different wall (residue 2).

**Dispatches for the planner to confirm** (I cannot dispatch):
1. `seedling-survey.yml` on branch `claude/seedling-bobsoldier-bait-dwell-yyivvw`, inputs `through=end`,
   `route=full`, `only=50,52,85`: expect 50 REFUSED / 52 REFUSED / 85 SOLVED 1294 with the default switches. The CI
   survey takes the defaults, so step 50's SOLVED 460 shows only after the flip (or a dispatch that sets
   `SEEDLING_KILL_STANCE_AS_FORECAST=1 SEEDLING_SWORD_GATE_TIMED=1` in the job env, if the workflow passes env).
2. The JS arc's divergence sweep (solver producer, `--mode=inv`) after the flip: expect leg 327 failed → done; 333/339
   unchanged.

## Movers with the switches ON (the licence list)

| row | both ON | D2a only | D2b only |
|---|---|---|---|
| `solve-seedling-r8-battery` / `-r8-d2-chain` / `-r8-l18` / `-r8-tail` / `-r9-l3` | unmoved, exit 0 | — | — |
| **`solve-seedling-r9-campaign --check`** | **`cae77076…` exit 1** | **`cae77076…` exit 1** | `13b8d51f…` exit 0 (= base) |
| every other solver-authoring `plan-seedling-*.mjs --check` (45 scripts; `r7-ends-meet` drives a browser and was not run) | unmoved (three were red identically at base, OFF and ON — see residue 5) | — | — |
| the generator rows (acceptance, pairs c3/c6/c4, ENEMY/guard/AREA censuses, killgate s2/s5/s9, levels s1) | see "Byte-inertia" | | |

**The single mover:** `r9-solve-12`'s TRACE sidecar (`fixtures/traces/r9-solve-12.trace.json`; diff in the evidence
dir). The L12 puncher kill's stance walk is undashed under D2a, so the walk row loses the dash planner's three
rejection rows (*"no dash window certified faster than the undashed 842 tick(s)"*). The planner had found no window,
so the walk, the tape and its byte count are identical (`r9-solve-12 is byte-identical … 24244 bytes`). No tape byte,
no game re-record. A flip is: set the two defaults to ON, re-author `r9-solve-12.trace.json`
(`solve-seedling-r9-campaign.mjs` without `--check`, which needs the box for the latch), and re-pin the switch rows in
`fidelityBobSoldier2.test.js` ("both are OFF by default").

## For the JS arc: pins, fields and words

- **No signature or contract moved.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`
  are untouched. `walkTo`'s new option `undashed` is internal. `dangerAt`/`chaserDanger` gain an OPTIONAL `swordTick`.
- **New exports** (`solverBot.js`): `KILL_STANCE_AS_FORECAST`, `withKillStanceAsForecast`, `SWORD_GATE_TIMED`,
  `withSwordGateTimed`, `swordTickAt`, `replayOntoFork`. **New `DEADLINE_SITES` row:** `crusher-fork`, FINE
  (opt-in). The worker's work budget sees no new ask unless it passes `fineCheckpoints: true`, and then it sees the
  fork's cost for the first time (L42 dashless: 95 asks, ~1 per 42 advances). No new `SolverRefusal.obstacle.kind`.
- **What to wire:** the worker's `forkRun` gets the fixed replay for free, through `solveSegment`. If the worker
  calibrates a budget under `fineCheckpoints`, it re-calibrates for `crusher-fork`. In the browser the two switches
  take their defaults (OFF) until the flip.
- `jsRuntimeDeclarations` and the other JS-arc files in the bounded set are green at the head (below).

## Handed to the hammer arc

Nothing of its code. **Its five tests that pinned `DEADLINE_SITES`' tail** (`hammerEscape`, `hammerApproach`,
`hammerFight`, `fidelityLadder2`, `solverDeadline`) were re-pinned to ask their own rows' order from where those
rows start, because `crusher-fork` is now appended after them. If the hammer arc's B3 appends a site, the harvest
unions the list: `crusher-fork` then `hammer-…`, or the reverse, whichever merges later.

## What the brief got wrong (measured)

1. **"The stance comes from `deriveBaitStance`."** Step 50's stance is `deriveKillByChaser`'s (the kill rung's chaser
   arm). `deriveBaitStance` is the BAIT rung's (lure across a kill region), and L30 has no kill region. The refusal's
   own words ("a `modelled` press target … 2 stance(s) qualified out of 28 reachable") are the chaser arm's.
2. **"The forecast and the execution disagree: find which one is wrong vs the GAME."** Neither is wrong about the
   game: the body is bit-exact and the forecast's own walk is reproduced tick for tick when driven (D2a). The
   disagreement is in WHICH walk is driven: the forecast is dashless, the drive dashes.
3. **"the refusal from the dwell executor in `botDriverV2.js`"**: true, but the dwell executor was not at fault.
   `runDwell` read the right condition. The bound it was handed came from a walk that did not happen.
4. **The live B stop and step 50 are one fix but two walls.** Lifting the dwell exposed the gate's pad against the
   corpse, the next wall one tick later. The brief named only the first.
5. **"L42 dashless: 5 forks, 3991 fork advances."** My measurement on the CRUSHER witness's own staging (`solveSegment`,
   dashless) is 95 `crusher-fork` asks at one per 42 advances, i.e. the fork count and advances depend on the staging
   (the brief's is the JS arc's node run of the survey step). Not contradicted, just not reproduced on the same input.

## Residue

1. **Step 52** (L30 pit boot → L22) stays REFUSED: the gate's timed reading is the bare body at d=4.7, a real contact.
   Left named, per the user's earlier ruling.
2. **Legs 333/339** (L30 pit arrivals, inv): the chaser arm's stance scan finds no stance whose WAIT is clear and
   whose body arrives inside the ceiling. A stance-scan question, not the dwell.
3. **KILLLOCK's chaser kill** (`killLockChaserKill`, `deriveKillByChaser` + `ctx.walkTo`) walks its stance with the
   dash too. It survives because its bound is `max(hunt.ticks, chaserKillCeiling)` and it is guarded. Not changed here
   (it would move KILLLOCK's rows); `KILL_STANCE_AS_FORECAST` could cover it in a later slice.
4. **The body probe's calibration** is not dead-frame aware (the t225 apitem ceremony on `bobsoldier2-l30-torch`).
5. **Three plan scripts are red at the base** (`plan-seedling-ladder2-witness`, `-r9-l0-sword-dash`,
   `-r9-l6-sword-dash-hit`, *"⛔ DRIFT"*). Their logs are byte-identical at base, head OFF and head ON (`fae9cd64`,
   `e06b988e`, `57fbc418`). They are pre-existing, not this slice's, and not fixed here.
6. **The composite roster row** (`rosterCategories` "the LIVE row …"): 199 ≠ 201. The planner's `standing-values`
   quote is at 259 tapes; the roster is now 261. It turns green on the planner's next full-tier re-quote.
7. **The reference** reads 4 DIFFER (registry, capabilities and the two substrate regions), the base's own, from the
   container's uninitialised substrate submodules. I regenerated only mine (instruments, docs index, architecture,
   README).

## Byte-inertia (head, switches at their defaults = OFF)

| row | W0 | AFTER |
|---|---|---|
| maze … level post-sword s1 (13 rows) + generated set | as W0 | **identical, row for row** (`after-identity-defaults.txt`) |
| six producers | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, exit 0 | **identical, all exit 0** |
| tapeRunner | 575, `fbe5fc60…` | 579 (`375daa70…`); **all 575 old rows identical**, +4 (2 per witness), 0 non-pass |
| surface / constants / entities / profile | GREEN 227 / PASS 5,443 / PASS 528 / PASS 138 | GREEN 227 (`--write`: counts only) / PASS 5,443 / PASS 528 / PASS 138 |
| bounded vitest | 57 / 1,967 | **60 / 2,002**: + `fidelityBobSoldier2`, `fidelityForkHygiene`, `rosterCategories`; all green but `rosterCategories`' LIVE row (residue 6) |
| `fixtures/**` | — | two new tapes + expectations, `index.json`; no committed tape, expectation or trace moved |

**With both switches ON**, the same 13 generator rows are identical to W0 too (`generator-rows-both-on.txt`):
the generator's certify solves never reach a chaser stance walk or a sworded gate that moves. The ON producer and
plan-script sweeps are `producers-both-on.txt` and `plans-both-on.txt`. The reference reads 6 DIFFER at the AFTER block's
run (the base's 4 plus docs index/README, made stale by the log entry). Regenerated in the last commit: 4, the base's
own.

No AS3, wasm, gitlink or rules edit; no `standing-values --write`, `pytest` or unfiltered vitest.

## Rows to BANK

- `KILL_STANCE_AS_FORECAST` OFF, `SWORD_GATE_TIMED` OFF (the flip is the user's: one mover, the `r9-solve-12` trace).
- `DEADLINE_SITES` + `crusher-fork` (FINE); `replayOntoFork` (the run clock).
- tapeRunner **579 `375daa70243b7f6b1596856814b04c36`**; roster **261**; surface GREEN **227**; constants PASS **5,443**;
  entities PASS **528**; profile PASS **138**; R8 exposed set **80** (+ `bobsoldier2-l30-dash-stance`, `-torch`, L30).
- Producers unmoved at the defaults: `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`.
- Game witnesses: `bobsoldier2-l30-dash-stance` (D1, body bit-exact 146/146), `bobsoldier2-l30-torch` (D2, model = game
  461/461, body bit-exact 178/178).
- CI: `JavaScript Unit Tests` at the last head: read after the push of this commit; see the follow-up line below.
