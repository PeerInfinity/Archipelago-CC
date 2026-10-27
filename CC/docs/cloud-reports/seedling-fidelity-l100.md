# Seedling fidelity L100 — the rock door's swing stance is half a tile off the grid (`fineSwingStance`, OFF)

Wave 33, planner `seedling-fidelity-planning-15`. Session `seedling-fidelity-l100`.

- **Start:** main `6f5916203e` (92 default-ON keys, as the brief says).
- **Head:** see the last section (the report is the last commit).
- **Harness branch:** `claude/seedling-l100-stance-z9e6cq`.
- **Evidence:** `seedling-fidelity-l100-evidence/` (the probe tools are in `tools/`).
- **Ports:** 9754 (this tree), 9755 (the pristine base worktree), 9756 (the scratch worktree with the key flipped ON).

| D | verdict | switch | what changed |
|---|---|---|---|
| W0 | **PASS** | — | Grid drawn. The two rect cells are on the rock's FAR side. The near side is an 8 px sliver the 16 px ring cannot name. The mask collision is already pixel-exact. |
| D1 stance | **PASS** | `fineSwingStance` (OFF) | The break/pull stance is asked on the 8 px lattice once every 16 px cell fails. Game witness `l100-sliver-rock` (p4g, 0 px, 0 hits, L101). |
| D2 rest of the leg | **STOP** (named; hand-overs) | — | Two gaps, both game-witnessed at 0 px: the waterfall's top is not a corridor (planner edge model), and four jellyfish hold the column (chaser kill rung, hammer arc). |
| Movers | **STOP** with the list | — | Full survey: 1 mover (step 219, REFUSED → REFUSED, new text). Identity block equal OFF. Bounded set ON: only the defaults pin. |

## W0 — the base and the grid

| row | command | result |
|---|---|---|
| base | `git checkout -B … 6f5916203e`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `identity-block.sh .` in a detached worktree of the base, venv active, its own server (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`. File md5 **`590b0b88`** |
| six `--check`s | in the block | battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `be9c19c8`, **all exit 0** at the base |
| reference | in the block | 4 DIFFER: registry/capabilities and their two regions (the known box artifact) |
| surface / constants / entities / profile | each `--check` (at my D1 tree) | surface RED +3 sites (mine, re-written below) · constants PASS **6,969** · entities PASS **566** · profile PASS **138** |
| roster | `fixtures/tapes/index.json` | **290** tapes |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` at the base (`tape-runner-pairs-w0.txt`) | **637**, md5 **`9318088a`** |
| bounded vitest BEFORE | the brief's list + every test naming a function I touch (`breakVerb`, `fidelityRope*`, `fidelityStance`, `fidelityRulesref`, `fidelityClearTag`, `fidelityFrontier3`, `solverBot`, `blockRoute`, `levelWorld`, `presses`, `contactFidelityHook`, …; `vitest-files.txt`, 93 paths, 90 files run) at the base | **2,456 / 2,456** (`vitest-before.txt`) |

**The leg, reproduced locally.** Leg 907 at this base (`level_100__r4c10 <- in_L99_48_96 ~> level_100__r2c3 -> exit:out_teleporter_288_96`)
is survey **step 219** here (214 at 7266baa10d). `survey-seedling-route.mjs --through=end --route=full --only=219` refuses in
3.7 s with the brief's text: *"no REACHABLE stance for a swing at breakablerock@128,144 in level 100 — 2 cell(s) put the
slash rect on the rock and none plans a corridor from (40,104); 8 more were beyond SLASH_REACH (16 px)"*. The solver is
deterministic on this request, so I replayed the survey's own staging (`step-219-boot.json`) in node instead of a
captured sweep request.

**The grid** (`w0-grid.txt`, `tools/l100-w0-probe.mjs`: the planner's `plannerObstacleAt` at 16 px and 8 px, the tile
names, every pixelmask with its mask):

- The rock (x 128–143, y 144–159) sits in a solid wall column x 128–143 (y 84–175). It is the room's only door between
  the arrival's side (x < 128) and the exit's side (`teleporter@288,96`).
- `pixelmask:*` Solids in L100: twelve `CliffSide`s. Five `CliffSideMaskR` at x 48–64 and seven **`CliffSideMaskL`** at
  x 112, y 48–159 (`cliffside0@112,48 … @112,144`). The L mask is opaque in x 0–7 of its 16 px cell. So the column
  x 112–119 is wall, and **x 120–127 is an 8 px walkable sliver** between the masks and the wall/rock.
- **The two rect cells are (152,136) and (152,152), on the rock's far side.** They are in the exit's component, so no
  corridor reaches them from (40,104). That is the "none plans a corridor".
- **The near side's 16 px cells are all centre x 120.** A 4x5 box there (x 118–121) meets the mask's opaque half. So
  every ring cell on the near side is "an obstacle" before reach is even asked (`(120,120)`, `(120,136)`, `(120,152)`:
  `OBST pixelmask`). The cells at x 104 plan, but are 24 px from the rect (beyond `SLASH_REACH`).
- On the 8 px lattice the sliver has nodes at x 124: `(124,132)`, `(124,140)`, `(124,148)`, `(124,156)` all plan from
  the arrival (via (60,44) and (124,44), across the top of the masks). Each is within 4–13 px of the rock.
- **The planner's mask collision is the game's.** `plannerBlockerAt` runs `maskHitsBox(p.mask, …)` on the node's
  player box (`levelWorld.js` "THE PLANNER USES THE REAL MASK"), the same test as `collidesSolid`. The 8 px map shows the
  L mask's exact half. The coverage queue's Q5 premise ("the planner's tile grid says solid") does not hold here. The
  gap is the stance **lattice**.

**Witness question: can the player reach a cell from which the game's slash breaks the rock?** Yes, from inside the
sliver. That is D1's witness (`Player.slash`, `Player.as:917`: the 16 px-wide rect from x 124 covers x 124–140; the
`collideLine` test is waived for a `Solid` target).

## D1 — the stance (`fineSwingStance`, OFF) — PASS

**The change** (`solverBot.js`, `contactFidelity.js`):
- `breakStanceCandidates(run, rock, opts, pitch = DEFAULT_LATTICE)`: the ring spans the same pixel window at any pitch
  (`span = round(2·DEFAULT_LATTICE / pitch)`: ±2 at 16 px, ±4 at 8 px). At the default pitch it is the loop it always
  was.
- `deriveSwingStance` (the shared stance of `break` and `pull`): **ON**, once every 16 px candidate has failed (directly
  and under the hypothesis), the candidates at `FINE_LATTICE` are asked in the world as it is, each planned with
  `planWaypoints(…, { lattice: FINE_LATTICE })`. The first that plans is the stance (`discharged: []`); `admit` still
  applies. This is `deriveKeylockStance`'s RULESREF arm, for a swing. OFF: the refusal is thrown exactly as before.
- `CONTACT_FIDELITY.fineSwingStance: false` (`SEEDLING_FINE_SWING_STANCE=0|1`), appended after `punchGateTimed`.

**Witness (p4g, headless).** `l100-sliver-rock` is the survey's step-219 staging (`r8-solve-11`'s block, the route's
keys and seam items), **booted inside the sliver at (124,60)**. It is the solver's own plan with the key ON. Why the
boot is moved: the arrival's own approach meets D2's two gaps first. This tape isolates the stance, the walk down x 124
past every `CliffSideMaskL` (the brief's `cliffside0@112,96` included), the break, and the rest of the leg.
- Plan: 185 t. Rock broken at t84 from (124,141.15). Door, `teleporter@288,96` → L101 (296,248) at t185. 0 hits.
- `check-seedling-bot-differential --record --only=l100-sliver-rock`, then the same without `--record`: **ALL CHECKS
  PASSED** (`differential-record.txt`, `differential-check.txt`). Game == committed oracle. `save.time` 8812 = 8812.
  `hits` 0 = 0. 186 observations, 1 transition, and the model reproduces the recording it just made.
- Producer `scripts/procgen/plan-seedling-l100-witness.mjs`: `--from-view=<step-219 boot view>` writes the tape. `--check`
  re-derives it from the committed tape's header (byte-identical) and asserts the mechanism: L101, the rock broken from
  inside the sliver, no hit.
- `fidelityL100.test.js` (3 rows): OFF from the sliver refuses with the survey's text. ON from the sliver, the plan IS
  the committed tape key for key, and breaks the rock from x 124 with 0 hits into L101. ON from the survey's own
  arrival, the swing-stance refusal is gone (OFF still has it).
- Roster **290 → 291**, pinned by name: tape index, `dialogueAutoAdvance`, `observationTolerance` (count and swapped,
  measured), `tapeEnvelope`. `r8Acceptance`: the tape retires `noDamage` in bridged rooms (L100's four jellyfish and the
  flyer, L101's arrival). So `R8_ENEMY_BRIDGE.exposedAdded` gains its row (levels [100, 101], 185 t), the synthetic
  bridged set gains 100/101 (the mirror rule), and the measured exposure goes 93 → 94. 94/94.

**Mutants** (predicted first, made by copy + restore, `fidelityL100.test.js`):

| mutant | predicted | measured |
|---|---|---|
| M1: the fine candidates planned on the 16 px lattice (`solverPlanOpts(run, contacts)`) | rows 2 and 3 red | **row 2 red; rows 1 and 3 green.** My prediction was wrong on row 3: from the arrival (40,104) the 16 px planner DOES reach (124,140). Only a walk that STARTS off the grid (in the sliver) needs the 8 px plan. Row 2 kills the mutant. |
| M2: the switch guard removed (`if (true)`) | rows 1 and 3 red | **rows 1 and 3 red**, row 2 green |

## D2 — the rest of the leg — STOP (named)

ON, from the real arrival (40,104), the leg now plans its stance (124,140) via (60,44) → (124,44). It then refuses in
the chaser kill rung: *"break stance (breakablerock@128,144) -> kill (jellyfish@88,144) by press: the dwell was HIT at
tick 193 (hits 0 -> 1)"*. Two gaps stand between the arrival and the sliver. Both are witnessed on the game.

**Gap 1: the waterfall's top is not a corridor (the planner's edge model; NOT mine to edit).**
- L100's tiles x 80–111 are a waterfall (rows 2–7) over a pool (rows 8–10), with a water row on top (row 1).
  `Player.as:1557`: `if (onWaterfall && (!hasFeather || v.y >= 0)) v.y += waterfallAcceleration` (0.8/tick). This run
  holds the Feather, so only a RISING player is not pushed. The model has this (`playerPhysicsV2.js:1512`).
- The planner's corridor crosses at y 44, flat. Every flat or banded crossing I scripted is carried down into the
  column (model: hit at t89–t121). With the jellyfish removed in memory (`NOJELLY`, atlas copy), the solver's own walk
  to (124,140) stalls at (110.8,140) against `cliffside0@112,128`: it was carried to the pool.
- **The crossing that exists:** swim UP the waterfall into the row-1 pool, along it to the wall at x 110, then
  down-right. Model, jellyfish removed: at (122.3,47.4) at t151, inside the sliver's top.
- **Game witness** (`probe-seedling-chaser-mobiles --class=Jellyfish --player-hits`, p4g, `l100-w0-straight.json` /
  `l100-w0-swim.json`, jellyfish present): the planner's straight crossing (114 sampled ticks) and the swim-up route
  (150 sampled ticks). The player position equals the model's at every sampled tick (clock shift [0]). All four
  jellyfish equal the model's (456 / 600 comparisons, **worst |Δ| 0**, 0 disagreements). `w0-jellyfish-contacts.txt`.
- **Hand-over:** a waterfall tile is floor only upward. `planWaypoints` / the A* edge model would need to price the push
  (or route through the pool on top), and both are read-only to this arc (hammer SP memoises `planWaypoints`). Queued as
  a model gap for the planner to route.

**Gap 2: four jellyfish hold the column (the chaser kill rung; the hammer arc).**
- `Jellyfish.as`: chase within 160 px with no line test (`collideLine` is commented out), 0.8 px/tick, 12x12 body,
  `hitsMax` 3. All four converge at x ≈ 86 at the player's y. Every approach meets one. Game: `jellyfish@80,112` bills
  the hit at **t89** on the straight crossing, and `jellyfish@80,16` at **t126** on the swim, at the model's ticks.
  Each tape's 0.5-hit rows are the shield bumps before them.
- The solver's kill rung (`deriveKillByChaser` + the strike policy's dwell) kills two jellyfish, then its dwell on
  `jellyfish@88,144` is hit at run t308. The jellyfish dies on the same tick it bills the contact (`retaliation`
  `killed: true`). The dwell's preview had seen no hit. **Handed to the hammer arc** (the strike policy, the dwell, the
  chooser): the measurement is the ON refusal above, reproducible with
  `SEEDLING_FINE_SWING_STANCE=1 node tools/l100-seg-probe.mjs step-219-boot.json`.
- The jellyfish cannot follow into the sliver (12 px body, 8 px gap). Once the player is in it, they are no danger, and
  the witness shows the rest of the leg hitless.

**The rules' other arm (Ghost Spear).** Rules-2 says `r2c3 → r4c10 = Or(Progressive Sword, Ghost Spear)`. In AS3 a spear
thrust breaks the rock (`genericHit` → `BreakableRock.hit`, any weapon type). The 32x5 rect ignores the mask, and
`useItem` has no water guard. Model: a thrust from the pool at (110.7,152) facing E breaks the rock (t139). But the pool
does not reach the door past the mask (x 112–119 is opaque down to y 159, and row 10 is wall). So the sliver is owed
either way, and the spear arm needs the same crossing. The solver's `break` is sword-only. A spear arm would be a new
verb, not this leg's key.

**Is the 8 px crossing of `cliffside0@112,96` game-true?** Yes. `l100-sliver-rock` walks x 124 from y 60 to y 141 past
every L mask, at 0 px against the game.

**A refusal is CORRECT only if the game agrees no stance exists.** It does not agree: the stance exists, and D1 is the
model of it. The leg's remaining refusal is the jellyfish (a fight the game also demands) and the waterfall (a corridor
the planner mis-prices). Neither is an item gate.

## The survey / sweep / probe rows this moves (key ON), and the dispatches to confirm them

- **Route survey, full, local, both arms** (`survey-full-off.rows.txt`, `survey-full-on.rows.txt`; 240 steps at this
  base): **201/240 SOLVED on both.** ONE mover:

  | step | level | OFF | ON |
  |---|---|---|---|
  | 219 | L100 → L101 | REFUSED: *no REACHABLE stance for a swing at breakablerock@128,144 …* | REFUSED: *… break stance (breakablerock@128,144) -> kill (jellyfish@88,144) by press: the dwell was HIT at tick 193* |

- **Bounded vitest, key ON** (`SEEDLING_FINE_SWING_STANCE=1`, the same 91 files): **2,460 / 2,461**. The one red is
  `contactFidelity.test.js` "the shipped defaults", the pin a flip owes by construction. No behaviour row moves.
- **Standard probe battery, key ON** (a scratch worktree with the default flipped, port 9756): **11/11 ALL CHECKS PASSED**. That includes `wasm-arrival-composites` (95 PASS rows) and logical-links B,R (25) (`probe-battery-standard-on.txt`).
- **Not measured here (CI, cloud has no dispatch):**
  1. Survey A/B: `seedling-survey.yml` on this branch, `--through=end --route=full`, at the defaults and on a scratch
     commit flipping `fineSwingStance` (or `-f only=219` for the one mover). Expected: step 219's text only.
  2. Divergence sweep A/B ×2: `seedling-divergence-sweep.yml` on this branch, `keys=` the 387 keys in
     `seedling-fidelity-l100-evidence/sweep-keys-mask-and-swing.pipe.txt`. Those are the legs whose level holds a
     `pixelmask:*` Solid (22 levels: 0, 12, 28, 37, 47, 57, 62, 66, 83, 87, 88, 89, 91, 92, 93, 94, 95, 99, 100, 111,
     112, 115) or a swing-verb target (`breakablerock`/`breakablerockghost`/`rope`: 0, 3, 15, 16, 28, 30, 39, 40, 41,
     53, 73, 92, 100, 101), derived at this base. Run it once with `contact_fidelity=` the 92 default-ON keys +
     `fineSwingStance` (`contact-fidelity-on-arm.txt`) and once at the defaults; then ×2. If the 24.7 KB key list is too
     long for the input, a full sweep A/B (906 legs) is the same question. Expected: leg 907 (match by KEY) moves its
     refusal text; nothing else.
  3. `seedling-probe.yml battery=standard` on a scratch commit flipping the default (expected as measured above).
  4. **Standing value owed:** `rosterCategories.test.js` "the LIVE row carries one part per derived category" reds on
     CI at this head (`expected 230 to be 231`). The roster's `mechanic` tier gained `l100-sliver-rock`, and the row is a
     standing value. Re-bank it from a `seedling-full-tier` run quoted with `record-standing-value.mjs` (as `d245f885`
     did for RULESREF's tape). I did not write standing values (brief).

## The JS arc's pins and wiring

No JS-arc file is touched. No `solveSegment`/`twoPassSolve`/`createRunForStaging` contract changes, no new
`SolverRefusal.obstacle.kind`, and no new staging/result field. With the key ON, the page's solver gets the 8 px stance
like any other caller. Nothing to wire.

## Handed over

- **Hammer arc:** the L100 jellyfish dwell (Gap 2 above). The chaser kill rung's dwell on `jellyfish@88,144` is hit at
  t308, on the tick that jellyfish dies (contact billed and retaliation kill on one tick). The derivation's preview saw
  no hit. Reproduce: `SEEDLING_FINE_SWING_STANCE=1 node CC/docs/cloud-reports/seedling-fidelity-l100-evidence/tools/l100-seg-probe.mjs <step-219-boot.json>`.
- **Planner (to route):** the waterfall push in the corridor planner (Gap 1). `planWaypoints` prices a waterfall tile as
  floor in every direction. With the Feather, only rising is free (`Player.as:1557`).
- **Queued, not modelled:** a `break` arm for the spear (the rules' Ghost Spear half). The game breaks the rock with any
  weapon's `genericHit`, and the spear's 32x5 rect reaches through a mask.

## Deltas

- `contactFidelity.js`: + `fineSwingStance` (OFF) and its env line. 92 ON / 9 OFF.
- `solverBot.js`: `breakStanceCandidates` takes a pitch; `deriveSwingStance` gains the 8 px arm (behind the key).
- New: `fidelityL100.test.js`, `plan-seedling-l100-witness.mjs`, tape + expectation `l100-sliver-rock`.
- Pins: `contactFidelity.test.js` (the defaults), `dialogueAutoAdvance`, `observationTolerance`, `tapeEnvelope`,
  `r8Acceptance.js` / `.test.js` (the exposure row, the mirror, 93 → 94), tape index.
- Surface census `--write`: GREEN **357** rows (`run:state` +1, `run:world` +1, `CONTACT_FIDELITY` +1: the new arm's
  `planWaypoints(run.world, run.state, …)` and its flag read). Constants census PASS (6,969 literals, 0 new). Entities
  566, profile 138: PASS.
- Reference regenerated: instruments 489 → 490 (the producer, cited by the log), docsIndex (the log entry's words). The
  registry/capabilities box artifact was left as committed.
- `seedling-bot-log.md`: the L100 entry.

## What the brief got wrong (measured)

- **"PIXELMASK COLLISION in the planner … the game's mask is passable where the planner's tile grid says solid" (Q5) does
  not hold for L100.** The planner already tests the real mask at the node's box (`plannerBlockerAt` → `maskHitsBox`).
  The refusal is about which CELLS the stance search asks. On the 8 px map the mask's opaque half and the 8 px sliver are
  both exactly right.
- **"2 cell(s) put the slash rect on the rock and none plans a corridor"** read as if the near cells were blocked by
  something. They are the far side's two cells, in the exit's component. The near side's cells are never candidates (all
  `OBST pixelmask` at centre x 120).
- **"the 8 px flood's crossing of `cliffside0@112,96`"**: the flood does not cross the mask. It walks the 8 px sliver
  beside it (x 120–127), which is game-true.
- The leg's id at this base is **907**, and its survey step is **219** (not 214).
- Sweep row "907 needs no pole": correct. Nothing here touches L101's pole.

## Residue

- Step 219 / leg 907 still refuses ON (the jellyfish dwell). The leg needs Gap 1 (the waterfall corridor) and Gap 2 (the
  jellyfish) before it can solve.
- `rosterCategories` standing value (CI red at this head; owed a re-bank, above).
- M1's survivor (row 3) is explained, not killed: the arrival's walk plans at 16 px.

## Byte-inertia

OFF is byte-identical:
- The identity block's rows are equal BEFORE and AFTER (file md5 **`590b0b88`** on both; all six producer `--check`s exit
  0 with the same digests).
- The full survey OFF = the base's behaviour (only step 219 differs ON, and its OFF text is the base's).
- tapeRunner pairs: 637 `9318088a` → **639 `c2260ed7`**. The only difference is the new tape's two rows, both passing
  (`tape-runner-pairs-after.txt`).
- Bounded set AFTER at the defaults (`vitest-after.txt`): 2,459 / 2,461 before the `r8Acceptance` declaration. The two
  reds were the undeclared exposure. They are 94/94 after commit `15eae04c`.
- The only committed artifacts that move are additive: the witness tape and its expectation, the tape index, the roster
  pins (+1 by name), the exposure row, the surface census (+3 sites), the reference, the docs.

## Rows to BANK

- Roster **291** tapes (+`l100-sliver-rock`). Surface census **357** rows. R8 exposure **94**.
- The game witnesses: `l100-sliver-rock` (186 obs, 0 px, 0 hits), and the two jellyfish approach probes (0 px, 0
  disagreements; `w0-jellyfish-contacts.txt`).
- The survey's ON expectation: 201/240, step 219's text only.
- **CI at my last code head `a79a14fc`** (run 40559694167): suite **23,693 / 23,694**, slow battery 271/271. The ONE red is
  `scripts/procgen/rosterCategories.test.js > the COMPOSITE checkpoint row > the LIVE row carries one part per derived
  category` (*expected 230 to be 231*). That is the owed standing-value re-bank (the roster +1), and nothing else. The
  `r8Acceptance` pair that was red at `bf7dd33e` is green.
