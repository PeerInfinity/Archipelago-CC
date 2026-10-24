# Seedling swim U1: the solver batch (W0 · R-i `reach-pit` · R-h `skirt` · F2 the lock-less kill · the through-2.2 survey)

**Slice:** `seedling-swim-u1`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §13). It is the first slice to edit the solver family since the engine-prep freeze.

| | |
|---|---|
| Started from | `origin/main` @ `3844942c0cb7882717ac103b3f428f0f6503cd36` (the brief's expected SHA) |
| Harness branch | `claude/seedling-swim-u1-solver-sv78tw` (the harness allows only this branch) |
| Commits | W0 `5e8483d` · D1 `47bcb53` · D2 `eb5a2b9` + fix `8bccdb0` · D3 `97d11cc` · D4 `1d643f7` · D5 `0fd6b93` · this report |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | The gate no longer dies on a solved readout. Row 1 is re-aimed at L71's exhausted climb. Predicted 20/0, measured 20/0. |
| D1 | **PASS** | `reach-pit` works. The L30 → L31 unit row SOLVES in 178 t. The brief's L12 row is a ROOM refusal (shield, then a puncher), not a goal-kind one. |
| D2 | **PASS (verdict + executor) / STOP (step 27)** | `skirt` is selected for exactly L29's and L74's buttons, and it passes L29 unpressed from a boot on the lane. The route's walk cannot enter the lane: it admits one x (126.000) and the walk arrives at 125.9713…. |
| D3 | **PASS** | A live spinner is a removal target, killed by press with no lock. Post-sword, 2 of the 6 refused positions now SOLVE (234 / 235 t). The yield is unchanged at 10/168. |
| D4 | **PASS** | Grant re-keyed to L30@176,48. Predicted **3/7**, measured **3/7**. Step 29 SOLVES (210 t). |
| D5 | **PASS** | Log section, seedling-bot.md paragraph, reference regenerated, surface table GREEN (184), bounded vitest 22 files / 961 tests. |

**The one thing to know first.** Survey step 27 (L29) is blocked by the model's sub-pixel arithmetic, not by the planner. The button's unpressed lane is a single x value, x = 126.000. The model's blocked sweep keeps the fractional remainder, and on one axis every velocity is a multiple of 0.05. The route's walk arrives at x = 125.97137961649308, and no x-input sequence from there lands on 126. `skirt` itself works: from a boot on the lane it skirts in 28 t, takes the key, leaves the rock standing and crosses to L31. Getting the route into the lane needs an approach that preserves an integral x. That is a design question (see *Residue*).

## W0: the banked rows and the gate

**Banked on the clean tree (`3844942c0c`):**

| Row | Result |
|---|---|
| `census-seedling-campaign.mjs` | exit 0, `NO CHAIN ROOM MOVES`, md5 `88fa2333013aaabb84298f0f4fd5d72a` |
| six r8/r9 `--check`s | all exit 0: battery `410f27c0…`, d2-chain `b470c14d…`, l18 `17be7d70…`, tail `9a6a3192…`, r9-l3 `6cd35fe1…`, r9-campaign `2823a811…` |
| identity block (`SEEDLING_PORT=8810`) | every row as F1/F1b's table (maze `246dfbce…` … level post-sword s1 `9219ff91…`, generated set OK, reference ALL MATCH) |
| survey `--derive-only` stdout / `route.json` | `27ff43dbb8e4d4e08c3dc741c5a02bc7` / `1e08f9ad37c505a5ca8360a882cc6b96` |
| survey `--through=2.2 --derive-only` stdout / `through-2.2/route.json` | `1172328c2090c1d43eabe10bce74430a` / `dae52ec7bc2fc6b4a158833911ebcf7e` |
| solver surface `--check` | GREEN, 179 rows |
| bounded vitest BEFORE (the brief's five paths) | 5 files / 281 tests, green |

**The five survey rows, W0 (verbatim first clauses):**
- 24: `solverBot: goals[0]: unknown goal kind "reach-pit". Slice 2 owns 'reach-exit' and 'collect-placement'; …`
- 27: `… -> hold: button@112,128 presses group t=0, which NO responder in level 29 answers …` (T3's text)
- 28: `solverBot(survey-step-28) reach-exit (160,384)->L30 -> keylock: undefined needs a key this run does not hold. …`
- 29: the same keylock text, for `(224,160)->L32`. The grant was keyed to an arrival the route no longer takes.
- 30: `collect-placement (64,128) resolves to NOTHING in level 32 …`

**The gate red on main, reproduced.** Row 1 reads `status=ok` (L16 solves in 625 t). The script then throws `TypeError: Cannot read properties of undefined (reading 'length')` at `:145`.

**Candidate table for row 1** (measured with the page, `watch.html?…&solve=1`):

| Room / boot | Goal | Verdict | First line (abridged) | REFUSED · EXHAUSTED · q>0 · dangerous=0 |
|---|---|---|---|---|
| L8, `r8-solve-11` re-pointed (32,64) | exit:144,32 | refused | `no corridor … A* start tile (2,4) … is not walkable: solid tile:Stone at (40,72)` | ✔ · ✘ · 1 · 0 |
| L8, same | exit:96,192 | refused | the same stone start | ✔ · ✘ · 1 · 0 |
| L8, `r8-solve-8` (own boot) | exit:144,32 | refused | `buildStagedTape: this staging block declares 2 MID-RUN clear(s) … beyond this run's own 7 tick(s)` | ✔ · ✘ · null · null |
| L8, `r8-solve-8` | exit:96,192 | **ok**, 827 t | — | ✘ |
| L16, re-pointed (32,64) | exit:112,64 | **ok**, 111 t | — | ✘ |
| L16, same | exit:16,64 | **ok**, 5 t | — | ✘ |
| L16, same | exit:352,80 | **ok**, 625 t | — | ✘ |
| (c) the danger census | — | `chaserRoomVerdict` refuses **L8 only**, atlas-wide | — | — |
| **L71, `l71-shieldlock-open` (own boot 256,256)** | **exit:304,96** | refused | `… the combat ladder is EXHAUSTED. The corridor passes through danger at (279.8,178.3) — hazard:spinningaxe@256,144 …` | **✔ · ✔ · 5 · 0** |
| L71, same | exit:96,0 | refused | the same climb, at (232.2,154.0) | ✔ · ✔ · 5 · 0 |

The L71 rows came from a Node sweep of `solveForPage` over the committed tapes' own boots × every exit/pickup/chest of the boot level. It covered 130 solves before I stopped it: 98 OK, 28 refused, and 4 EXHAUSTED (three at L71's spinning axe, one at L74's `lavarunner@24,56`). ⚠ L71 is outside the brief's (a)–(c) enumeration, but it meets the brief's own criterion ("any committed room"). `spinningaxe` is a hazard, not the Spinner class, so D3 cannot move the row.

**What shipped** (`5e8483d`):
1. A missing `dangerSources` is a FAIL line that names the field, not a throw. Measured with row 1 pointed back at L16: 5 FAIL + 15 PASS, exit 1, and rows 2–4 all ran.
2. Row 1 is re-aimed at L71 → teleporter@304,96. The docblock no longer names the survey's step 18.

Result: `ALL CHECKS PASSED`, **20 PASS / 0 FAIL** (predicted 20/0). The standing row is the coordinator's; `standing-values --write` was not run.

## D1: `reach-pit` (`47bcb53`)

- **`assertGoal`** takes `{kind: 'reach-pit', pit: {tx, ty, x, y}}`: integer tile, with x and y equal to the tile's rect origin. The unknown-kind refusal lists the three kinds.
- **The executor** sits beside `reach-exit`:
  - the aim is the tile centre;
  - a per-goal bag `goalPlanExtra = {allowPit: {tx, ty}}` rides every plan the goal makes: the corridor, the AVOID rung, the removal hypothesis and the frontier flood. It is `{}` for every other goal kind;
  - `crossTo = {level, pit, arrival: fallDestination(...).ctor}`, and `drive` accepts the edge on the TILE;
  - after the edge the run coasts the transport (`coastThroughTransport`), so the segment ends on the ground;
  - record `{goal: 'reach-pit', to, t, coast}`.
- **The door** gains `fallDestination` (row: seedling / function). `decisionTrace` knows the kind.

**Ticks.** Predicted for L12: ≥ 1184 px Manhattan at ≤ 0.8 px/t, so ~1550 walk ticks + 61 coast. That prediction was never tested, because L12 refuses on the room:
- The corridor from (16,80) crosses `shieldlocknorm@288,704`, and the staged boot holds no shield.
- A scratch run granted the route's own Red Key and Shield (and, separately, the conch). The walk then reaches the keylock stance at `bosslock@416,240`, which is EXHAUSTED on `puncher@416,256`, a static Enemy body. Those are both findings about the room.

**The unit row** is therefore L30's single pit, (3,14), from the committed boot `r3-collect-torch` with the sword granted:

| | predicted | measured |
|---|---|---|
| verdict | SOLVED | **SOLVED** |
| ticks | "~100 to the edge (a rock to break first), then the transport" | **178** = edge at **t=98** + **80**-tick transport |
| end | L31 on the ground | L31 at **(56,552)** = ctor (48,544) + (8,8), `fall` null, 0 re-plans |

The rock `breakablerock@48,224` stands ON the pit tile, and the `break` verb clears it. Pre-sword, the rock refuses by name, so the pit exemption is not a bypass. An absent pit also refuses by name, before any tick.

**Mutant (a), `allowPit` dropped.** Predicted: refuses on `pit` at the tile. Measured: the SOLVES row reds (1 failed / 6 passed). The refusal's frontier names the nearest ENTITY (`pickup:torchpickup`), because pits are terrain, not frontier entities. Its planner sentence names the pit: *"A\* goal tile (3,14) in level 30 … is not walkable: pit Pit (t=6) at tile (3,14)"*. Restored md5-identical.

**Survey `--only=24`:** REFUSED — `solverBot(survey-step-24) reach-pit (36,43)->L21 -> touch: shieldlocknorm@288,704 needs \`Player.hasShield\`, which this run does not hold …`

## D2: `skirt` (`eb5a2b9`, fix `8bccdb0`)

**The shape that shipped** is neither the brief's lean-in-a-lane nor its sub-tile corridor. It is a refinement plus an executor that aligns exactly, for the reason measured below.

- **The predicate.** `refineStrategy` turns `hold` into `skirt` for a frontier `button` when its group's `groupResponders` are all fall-responder rocks and there is at least one (`fallTrapPresser`). Atlas-wide it answers **exactly** `L29 button@112,128 -> [fallrock@112,112]` and `L74 button@288,128 -> [fallrock@288,144]` (unit row). Every other button keeps `hold`, and the chain's holds are byte-identical. `STRATEGY_REFINEMENTS` gains the row, driven in `procgenWeigh.test.js`; `R8_STRATEGY_EXECUTORS` gains its derivation row. That row is the `8bccdb0` fix: D2's own bounded list missed `r8Acceptance`, and the D3 run caught it.
- **The lane numbers.**
  - Press rect: x 116..124, y 133..139. Player box: 4×5 with origin (2,2). Shaft walls: x 112 and 128.
  - The box stays unpressed and inside the shaft only if x+2 ≤ 116 and x−2 ≥ 112, or x−2 ≥ 124 and x+2 ≤ 128. So **x = 114 exactly (west) or 126 exactly (east)**: zero slack.
  - Only the east lane has a wall to lean on from the stance row, because tile (6,9) is open. T3's hug walks used x=114 and x=126, from boots at integer x.
- **Why "lean" failed.** Measured: the stance is reached, then leaning right stalls at **x = 125.97137961649308, vx 1.15** for 70 ticks. There the box is 0.03 px inside the press rect. The model's `sweepAxis` stops a blocked axis at `p` and keeps the fraction.
- **The executor, as shipped:**
  1. ALIGN x on the lane by a bounded BFS (`SKIRT_ALIGN_DEPTH` 16) over `{none, left, right}`, on the transcription's own `applyInput`/`applyFriction`/`sweepAxis`. The sequence is then RUN and compared exactly.
  2. PASS with the vertical key alone (vx = 0, so x stays on the lane), then walk on into the far tile's centre row.
  3. VERIFY every tick with `fallRocksArmedBy` on the live box, and after the pass check that the rock stands and the open/latched sets are unchanged.
  4. The door gains `fallRocksArmedBy`, `groupResponders` and `sweepAxis`.
- **Measured from a boot ON the lane** (spawn (126,152)): **150 t**. The skirt takes 28 t, the key is collected (`keys [1]`), `rockFalls []`, 0 hits, and the run crosses to L31 at t=150.
- **Step 27 — STOP.** Predicted: SOLVED in about 550 t. Measured: REFUSED, by the executor's own name: *"… -> skirt (button@112,128, east lane x=126): no x-input sequence of at most 16 ticks takes the stance state (x=125.97137961649308, vx=0) EXACTLY onto x=126 at rest — the lane admits that one x and the model keeps sub-pixel remainders."*
  - On one axis every velocity is a multiple of 0.05, so 0.97137… can never become .000.
  - Offline, a 1-D search from 125.5 finds an 8-tick answer and from 124.3 a 10-tick one, but none from 125.9713… or 125.123.
  - A 2-D search (diagonal friction changes the fraction) ran out of heap at depth 8 without a hit.
  - The turrets never came into play, so there is no turret finding.
- **Mutant (b)**, predicate always false. Predicted: step 27 refuses with T3's `hold` text, byte-identical. Measured: `BYTE-IDENTICAL to W0`.
- **Mutant (c)**, lane centred (x=120) with the per-tick and post checks dropped. Predicted: the pass presses and the row reds. Measured: both skirt rows red. The press freezes the walk: *"the lane walk did not clear the button's rows within 86 ticks (at y=130.05)"*.
- Both mutants were restored md5-identical.

## D3: the kill without a lock (`97d11cc`)

What changed:
1. **The chooser.** `chooseBodyToRemove` adds the live spinners (`run.entities('spinnerBodies')`, `kind: 'spinner'`, stepped).
2. **BAIT.** A spinner is named a billiard: there is nothing to lure.
3. **KILL**, for a spinner:
   - `derivePressKill` + `execKillByPress` with `lock: null`, the kill-lock arm's own schedule. Its loop runs `until` the body leaves the roster, and it is bounded.
   - A body with a persistence tag must also bank a `run.ledger('spinnerWrites')` row. Otherwise the rung fails by name.
   - With no sword, the kill line names the weapon as a SUB-ORDER.
   - A swing that the run refuses by `Player.slash`'s line-of-sight gate becomes the ladder's refusal, not an escaping `Error`.
4. **The `!target` text** says that a live body without a recorded removal is not a target. §11.4's static arm is unchanged.
5. **Surface:** + `world.spinners`.

**Twelve positions, the census room** (`census-seedling-enemies.mjs --goal=totempart --classes=spinner --at=…`, CHAMBER arm, before → after):

| position | post-sword before | post-sword after | pre-sword before | pre-sword after |
|---|---|---|---|---|
| (4,4) (7,2) (2,3) (3,3) (7,7) (5,2) | SOLVED 221/123/142/150/123/123 | **unchanged** | SOLVED 218 ×6 | unchanged |
| (2,2) | REFUSED (EXHAUSTED) | REFUSED: EXHAUSTED; the kill line is the run's line-of-sight refusal (*"tile:Stone at (32, 29.0…) on the line to its entity point"*) | REFUSED | REFUSED, kill line = the sword |
| **(5,5)** | REFUSED (EXHAUSTED) | **SOLVED 234**, certified, 1 press kill (3 landings, 186 t, `spinnerWrites`) | REFUSED | REFUSED, kill line = the sword |
| **(6,6)** | REFUSED (EXHAUSTED) | **SOLVED 235**, certified, 1 press kill (3 landings, 170 t) | REFUSED | REFUSED, kill line = the sword |
| (7,6) | REFUSED (EXHAUSTED) | REFUSED by the press executor: *"no reachable cell … is clear of every live body's 7x7 rect and of the 13 px hammer line … The room has nowhere to be."* | REFUSED | REFUSED, kill line = the sword |
| (2,7) | REFUSED (EXHAUSTED) | REFUSED by the press executor: *"every key set … lands the player box on a body's 7x7 rect or on the 13 px hammer line … There is no step out."* | REFUSED | REFUSED, kill line = the sword |
| (3,6) | REFUSED (EXHAUSTED) | REFUSED: EXHAUSTED, the press arm *"no (cell, tick) … over the next 640 ticks … transit-safe"* | REFUSED | REFUSED, kill line = the sword |

- **Post-sword.** Predicted 4 of 6 solve, at 250–400 t. Measured **2 of 6**, at 234/235 t (the control is 123).
- **Pre-sword.** Predicted all six REFUSED with the first line unchanged, and so measured. Every pre-sword first line is still *"… the combat ladder is EXHAUSTED …"*. The kill line is now *"spinner@80,80 is a live Spinner whose removal the run OBSERVES … but the run's \`primary\` slot holds NOTHING … The sword is a SUB-ORDER the macro layer owes."*
- **The CORRIDOR arm** (a spinner at (4,1) in a 1-wide L) stays REFUSED on both boots. Its press arm finds no transit-safe strike in 640 t.

**Yield** (F1b's command, per palette; before on the D2 tree, after on D3):

| palette | placed before → after | certified before → after | named refusals |
|---|---|---|---|
| pre-sword | 10 → **10** | 8 → **8** | 2 × `the-solver-cannot-cross-the-roaming-body` → 2 |
| post-sword | 10 → **10** | 8 → **8** | 2 → 2 |

The outputs are identical apart from the wall-clock columns. F2 cannot move this number: 158 of 168 cells per palette are geometry refusals, 123 of them `the-through-room-is-not-on-the-route`. The two certification refusals (`branchy`/`winding` 14x14 s12) still EXHAUST.

**Mutant (d)**, the removal observation always "still standing". Predicted: the bound is spent, and it refuses by name with no `PendingDeclaration`. Measured: the (5,5) row reds with verdict `BUDGET_EXHAUSTED`: *"ran the strike schedule against spinner@80,80 for the whole 2010-tick bound (8 strike(s) planned, 3 landing(s)) and the body is still in the world."* Restored md5-identical.

**Committed tapes meeting a lock-less spinner.** L40 has 5 spinners and L92 has 1, with no `KILL_LOCK_TAGS` lock. L18's two spinners and L39's three sit behind kill-locks. Replaying all 154 committed tapes (0 errors), the tapes that visit L40 or L92 are `r5-feather` (L92), `r5-l40-join(-control)`, `r5-l40-part0(-control)`, `r5-l40-part1`, `r5-l40-part5(-control)` and `r5-l42-part4`. All are replay tapes; no solver producer re-derives them, and the byte-inertia rows are identical.

## D4: the survey re-run (`1d643f7`)

`STAGED_SAVE_GRANTS` is re-keyed to `bootKey(30, 176, 48)`, re-derived from `--through=2.2 --derive-only` (step 29 = L30 (176,48)). It is still one row. Command: `--through=2.2 --only=24,25,26,27,28,29,30 --timeout=180 --out=CC/docs/cloud-reports/seedling-swim-u1-survey.json` (md5 `c44894206c0cab0ed8a89b0fc9871548`).

| step | room | predicted | measured (verbatim head) |
|---|---|---|---|
| 24 | L12 | REFUSED, the shield | REFUSED — `… reach-pit (36,43)->L21 -> touch: shieldlocknorm@288,704 needs \`Player.hasShield\`, which this run does not hold …` |
| 25 | L21 | SOLVED 26 | **SOLVED 26 ticks**, 1 decision, 0 re-plans, 0 hits, 1 pass |
| 26 | L22 | SOLVED | **SOLVED 89 ticks**, 1 decision, 0 re-plans, 0 hits, 1 pass |
| 27 | L29 | REFUSED, D2's stop | REFUSED — `… -> skirt (button@112,128, east lane x=126): no x-input sequence of at most 16 ticks takes the stance state (x=125.97137961649308, vx=0) EXACTLY onto x=126 at rest …` |
| 28 | L31 | unknown (first survey) | REFUSED — `solverBot(survey-step-28) reach-exit (160,384)->L30 -> keylock: undefined needs a key this run does not hold. …` |
| 29 | L30 | SOLVED or a new name | **SOLVED 210 ticks**, 2 decisions, 0 re-plans, 0 hits, 1 pass; `boot.saveGrant = {keys: [1]}` |
| 30 | L32 | REFUSED, macro layer | REFUSED — `collect-placement (64,128) resolves to NOTHING in level 32 …` |

## HEADLINE: 3/7

Default mode is byte-identical: `--derive-only` `27ff43db…` and `route.json` `1e08f9ad…`. The through-2.2 derive (`1172328c…`) and its route (`dae52ec7…`) are unchanged too. No chain growth, no `campaign-frontier.json`, no tape moves.

## The surface table delta (179 → 184 rows, `--check` GREEN)

| row | class / form | why (as written) |
|---|---|---|
| import `fallDestination` (playerPhysicsV2) | seedling / function | Returns {to_level, ctor} for a pit fall: the level's control-block fallthrough level and the tile-snapped ctor position checkFallingInPit hands new Game(), throwing when the level has no control block (a lethal pit), a Seedling pit-transport rule. |
| import `fallRocksArmedBy` (activators) | seedling / function | Returns the FallRocks a player box pressing a Button (or a room=-1 ButtonRoom publishing true) arms, by group, from world.pressers and world.fallRocks: the run's own button press test for the fall-responder lane. |
| import `groupResponders` (activators) | seedling / function | Lists every responder of an Activators group t across the four lanes (activator, pulser, arrowtrap, fallrock), each {id, lane}: what a Seedling button press would reach. |
| import `sweepAxis` (playerPhysicsV1) | physics / function | Moves a position by rel in unit steps (the last one fractional), stopping before the first step the collide test rejects and keeping the sub-pixel remainder: the per-axis collision sweep of the move. |
| world `spinners` | seedling / constant | The level's Spinner roster as built ({id, tag, as3, x, y, persistTag}, a cleared tag omitted), a Seedling entity family; the solver reads persistTag to know whether a removal must bank a spinnerWrites row. |

The folded `entities` / `ledger` / `progress` columns grew by site counts (`spinnerBodies`, `spinnerWrites`, `primaryWeapon`, `latchedGroups`); no new family or kind. `census-seedling-constants --check` PASS (0 new).

## What the brief got wrong (measured)

1. **The branch.** The brief said `git checkout -B seedling-swim-u1`. The harness pins `claude/seedling-swim-u1-solver-sv78tw`, which already sat on `3844942c0c`.
2. **W0 (a): "L8 from the re-pointed boot (32,64)".** (32,64) is stone in L8, so the solve refuses at the A\* start, not on the ladder. From L8's own boot the chain exit solves. The other exit fails at staging (mid-run clears beyond the run's own ticks).
3. **D1's unit row, "L12 from (16,80) to the pit SOLVES".** It cannot, in this model. L12 refuses on the shield lock, and with the route's grants on a puncher at the Red Key's lock. The row moved to L30's pit, the committed room whose pit the solver can reach.
4. **D1 mutant (a), "refuses `pit` at (36,43) by name".** The refusal's named obstacle is the nearest frontier ENTITY, because pits are terrain. The pit is named in the planner's sentence.
5. **D2, "the lane: 8 px split two ways = 4 px per side, the player box 4 px".** The arithmetic is right, and it means **zero** slack: one legal x per side. The brief's two fallback shapes (a 4-px lane held by the mover, or a sub-tile corridor) both need an integral x, and the model's walk does not produce one.
6. **D5, "`seedling-bot.md` … where the goal vocabulary, the obstacle table and the combat ladder are described".** The page described none of the three (`grep` finds them only in the log). They went in as one paragraph after § *The driver*.
7. **D3, "predict how many of the six SOLVE".** I predicted 4. Two of the six cannot get a hammer-safe cell at all ((7,6), (2,7)), one has no transit-safe strike ((3,6)), and one needs a line of sight the schedule cannot ask for ((2,2)).

## Residue

- **The lane entry (R-h, the step-27 blocker).** The route cannot enter a zero-slack lane from a fractional x. Three candidate fixes, each a design question:
  - an approach that keeps x on the 0.05 grid (a pure-axis final approach from an integral x);
  - a 2-D alignment search with a better bound than BFS;
  - a model question for the coordinator: does the GAME keep the sub-pixel remainder on a blocked sweep? The model says it does, and a witness would settle it.
- **The strike schedule has no line-of-sight predicate.** `collideLineSolid` is a `levelRun` closure, not a run member, so `deriveStrike` cannot reject a swing through stone. The run refuses such a hit by name, and D3 turns that into the ladder's refusal. A run member (a simulation-side change) would let the schedule avoid it.
- **`keylock: undefined`.** `resolveKeylockStrategy`'s held-key branch returns without `lock`, so steps 28/29 print `undefined` for the lock's id. It is a one-line text defect, left as is.
- **L31 (step 28)** needs a key at `stairsup@160,384`. The staged grant is one row (step 29), so step 28 refuses. Granting the Green Key there too is the same one-row policy question T3 named.
- **L12 (step 24)** needs the shield staged, then a way past `puncher@416,256` at the Red Key's lock. That is two room findings, not a goal-kind one.
- **F2's yield lever** is geometry, not the solver: 158/168 cells per palette are geometry refusals.
- **Scratch instruments** lived in the session scratchpad: the probe, the candidate sweep, the alignment searches and the tape-level census.

## Byte-inertia

| Artifact | W0 (`3844942c0c`) | after D1 | after D2 (`eb5a2b9`) | after D3 (`97d11cc`) | final (`0fd6b93`) |
|---|---|---|---|---|---|
| identity block (21 rows) | as F1b | — | `diff`-identical | `diff`-identical | `diff`-identical |
| `census-seedling-campaign` | `88fa2333…`, exit 0 | identical | identical | identical | identical |
| six r8/r9 `--check`s | as above, exit 0 | identical | identical | identical | identical |
| survey `--derive-only` / `route.json` | `27ff43db…` / `1e08f9ad…` | identical | identical | identical | identical (measured after D4) |
| through-2.2 derive / route | `1172328c…` / `dae52ec7…` | identical | identical | identical | identical (measured after D4) |
| `fixtures/**` | — | 0 files | 0 files | 0 files | 0 files differ from `origin/main` |
| solver surface | GREEN 179 | GREEN 180 | GREEN 183 | GREEN 184 | GREEN 184 |

The D2 bank was re-run on the exact D2 tree after an earlier run overlapped the first D3 edits. The final column is a full bank (`bank.sh`: campaign census, six `--check`s, both derive md5 pairs, the surface gate and the identity block with `SEEDLING_PORT=8810`) run on `0fd6b93`: every row `diff`-identical to W0. `git diff origin/main -- frontend/modules/seedlingDemo/fixtures campaign-frontier.json` is empty.
