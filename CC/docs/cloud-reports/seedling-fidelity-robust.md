# Seedling fidelity ROBUST: bounds as fields, the one-idle-tick fragility, the non-monotone Conch (cloud report)

**Slice:** `seedling-fidelity-robust`, an Opus build slice run in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-2`, wave 4).

⚖ **The user** (2026-10-03): *"I want … the solver to be able to handle either state … and to have a way to know which
state it's in. I don't want it to have to clear the save, and I don't want it to have to exit and reenter the room in
order to solve it."*

| | |
|---|---|
| Started from | `origin/fidelity-harvest/wave3` @ **`b116c69fe57f5ad807e710f5231a208002932407`** |
| Harness branch | **`claude/seedling-fidelity-robust-azhvnf`**. Every push went here; nothing was pushed to `main` |
| Commits | D1 `7ff12f4` · D2+D3 `140d5f5` · records `71d8ff0` (log + reference) · this report (the head) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS · D3 PASS** |

## The one thing to know first

**D2 and D3 were the same bug.** The corridor probe reports only the corridor's FIRST danger, and the PULL rung
(`deriveLaneSilencer`) asked only that danger whether it had an off switch.
- On L16, one tick of a bob's phase (D2), or a swim-straightened corridor (D3), put a non-lane danger first.
- PULL was then never offered, and the ladder exhausted. Yet the room's lanes were on the same corridor, and silencing
  them is what solves it.

The fix: when the first danger has no silencer, the PULL rung probes the same corridor on past it for a lane that has
one. It is gated to L16's shape: a sword in the primary slot, and a silencer in the room, which is L16 alone in the
atlas. **No committed solve moved.** The Conch's non-monotone verdict was a search-order artifact, not a property of
the room.

## W0 (at `b116c69`, primary tree, `SEEDLING_PORT=9300`)

| row | command | result |
|---|---|---|
| identity block | `bash scripts/procgen/identity-block.sh .` (venv active) | log md5 **`aa46950b5958b32136111155250dd253`**, which is the banked value |
| six `--check`s | the block's producer loop | `405d9c4b…` · `8e7a43be…` · `33d20889…` · `35456fbc…` · `6cd35fe1…` · `b29b589b…`, **all exit 0** (the banked six) |
| reference | in the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| surface / constants / profile / entities | `--check` each | **GREEN 195** · **PASS 4,966** · **PASS 138** (both JSONs) · **PASS 518**. Surface json `9a7cdc1e1bd35ba13352786dc6ba1703` (it moved from CANCROSS's `9fed4227…` within wave 3, before this slice) |
| roster | `fixtures/tapes/index.json` | **210** |
| bounded vitest BEFORE | `solverBot`, `solverBotLethalPit`, `solverDeadline`, `seedlingCanCross`, `fidelityL14`, `shoveWeighParity`, `watchGenOverlay`, `decisionTrace`, `entityBlocks`, `jsRuntimeDeclarations` (read-only), `boxLock`, `lintGateLabels`, `seedlingSolverSurface`, `seedlingConstantsCensus`, `tapeRunner`, `procgenWeigh` | **16 files / 808 tests, all green** |
| tapeRunner | (fullName, status) pairs, sorted, `name\tstatus\n` | **477/477**, md5 `5bdf547cd654e69b2cf239e1549ef0f5` (= CANCROSS's bank) |

## D1: bounds as fields (PASS, `7ff12f4`)

**Measured first.** At the base, two bounds reached `canCross.classifyError` only as words:
- the block-route search's bound: `SolverRefusal` had no field for it;
- the DETOUR rung's bound: the failed row was `rowFor('detour', killRefused)` with no extras, and the refusal's
  `considered` carried only `why`.

**The change** (`solverBot.js`):
- `SolverRefusal` takes an optional `bound` (default `null`). Both block-route throws set it through
  `blockRouteBound(route, row, goal)`:
  `{name: 'MAX_ROUTE_EXPANSIONS' | 'MAX_ROUTE_ORDERS' | 'deadline', site: 'block-route', goal: 'press' | 'clear-path', block, limit, expansions}`.
- `deriveChaserDetour`'s failure returns `bound`:
  - `null` when the open set ran dry;
  - otherwise `{name: 'DETOUR_RUNG', hit: ['maxPreviews'|'maxPlanned'…], previews, maxPreviews, planned, maxPlanned, maxVias, unasked}`;
  - its two deadline returns carry `{name: 'deadline', site: 'detour'}`.
- The ladder's failed `detour` trace row carries `previews`, `planned` and `bound`. The refusal's last `considered` row
  (`option: 'detour'`) carries `bound`.
- `SolverRefusal`'s message words are untouched. `PendingDeclaration` inherits the optional field and its constructor
  is unchanged.

**The classifier** (`seedlingCanCross.js`, CANCROSS's module):
- `ROUTE_BOUND_RE` and `DETOUR_BOUND_RE` are deleted. `e.bound` is read, then the `detour` rows' `bound`.
- Every arm is now `basis: 'field'`.
- `deriveMinimalSets` rows carry `cause`.

**Measured on real calls:**

| call | cause |
|---|---|
| L16 → L18 `{x:352,y:80}` from L15, {conch} | `{kind:'bound', basis:'field', bound:'MAX_ROUTE_ORDERS', limit:8, expansions:804, site:'block-route'}` |
| L16 → L17 from L15, ∅ | `{kind:'bound', basis:'field', bound:'DETOUR_RUNG', hit:['maxPlanned'], previews:159, maxPreviews:300, planned:500, maxPlanned:500, unasked:850}`, 411 consults |

**Unit rows** (`seedlingCanCross.test.js`, 14 → 15):
- the DETOUR row now feeds the classifier a row whose `why` matches nothing, and its `bound` field decides;
- `bound: null` with the full words is `cannot`;
- a new block-route row: a bound field with no words gives `undecided`, and the old words with no field give `cannot`;
- the derive row asserts `cause.basis === 'field'`.

**Mutants** (each predicted, then made by copy + restore; restored md5-identical):

| mutant | predicted | measured |
|---|---|---|
| classifier `e.bound` arm off | the block-route row + the derive row (∅/{conch} fall to `cannot`) | **2 red / 15** |
| DETOUR reader reads `c.bundle` | the DETOUR row | **1 red / 15** |
| `blockRouteBound` returns `null` | the derive row (the real L16 call) | **1 red / 15** |
| `deriveChaserDetour`'s `bound` always `null` | the DETOUR row | **1 red / 15** |

W0's vitest list on D1: **809/809** (+1 new row). tapeRunner pairs **byte-identical** (`5bdf547c…`).

## D2: one idle tick (PASS, `140d5f5`)

**Measured** (scratch mirror of the modules, `/tmp/…/sp/tick.mjs`). The plan is built from the door from L15, with
the Sword, toward `stairsup` → L17, `dashMode: 'none'`.
- Tick 0: **can**, 206 t, `0c36d853aa`, PULL.
- Tick 1: **EXHAUSTED** at (55.2, 118.0), `chaser:bob@48,96` (d = 5.4), after 14.9 s.

The first climb is instrumented as follows:

| | at | corridor | first danger |
|---|---|---|---|
| tick 0 | (40, 72) | `[[56,120],[88,120],[88,56],[120,56],[120,72]]` | **`arrowLane:arrowtrap@96,32`** at t154 → `deriveLaneSilencer` → **PULL** |
| tick 1 | (40, 72) | **the same corridor** | **`chaser:bob@48,96`** at t43 → no silencer → PULL absent → AVOID, TIME, BAIT, KILL and DETOUR refuse (DETOUR bound: 500/500 legs) |

- **The same corridor and the same forecast, one tick apart.** The bob chases toward the player's dip to (56,120), and
  the strike policy knocks it back. On the tick-0 preview its rect clears the player box by sub-pixel margins. On the
  tick-1 preview it reaches the box at t43.
- The arrow lane is further along **both** corridors, and PULL silences it either way. The ladder simply never asked
  about it at tick 1.

**Solver or real?** It is the solver's:
- **Model:** the tick-0 plan, prefixed with 1, 2, 3, 5 or 10 idle ticks, lands on L17 with 0 hits and 0 deaths.
- **Game:** the tick-0 plan started one idle tick late (`robust-l16-sword-late1`, 207 t) was recorded on headless
  p4f:
  - **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 208 observations, 1 transition(s)"**;
  - game `hits` 0 = the model's, `hits_timer` 0, every key edge seen, 40 fade frames.
  - So the game, from the tick-1 state, has a 0-hit route.
  - The tape was removed after measuring (it is a measurement, not a witness). It and its expectation are committed as
    evidence under `CC/docs/cloud-reports/seedling-fidelity-robust-evidence/` (tape `0ebceb29…`, expectation
    `55d646a7…`), outside `fixtures/`.

**The fix** is in the PULL rung (rung 1½, `climbLadder`). When `deriveLaneSilencer(hit)` is null, it probes the same
`corridor`:
- with the sources met so far excepted (`dangerExcept` ∪ each hit's sources), and the same `axisAligned`;
- up to `LATER_LANE_PROBES = 4` further dangers;
- for a lane whose silencer exists.

Two gates make it inert where it cannot help:
1. `run.progress('primaryWeapon') === 'sword'`. The pull is a sword swing, so a swordless climb keeps its exact words
   and rows. A swordless L16 refusal therefore does not gain a `pull:` line.
2. `roomHasLaneSilencer(run)`: an armed trap whose group has a silencing rope. In the atlas only L16 qualifies (ropes
   exist in L16, L28 and L39; only L16 has traps).

- **Why not a new rung after KILL:** the ladder's order is ruled data (`R8_STRATEGY_EXECUTORS.ladder` plus
  `assertEscalationIsOrdered`), and a PULL after KILL is an escalation "down" the ladder.
- **Why not "ask every danger" unconditionally:** that would offer PULL in climbs where a committed solve escalated
  past it. The gates make "no committed solve moves" true by construction, and the identity block confirms it.

**After** (`canCross(… idle: n)`, every row 0 hits, its witness replayed and `agrees`):

| idle | 0 | 1 | 2 | 3 | 5 | 8 | 13 | 21 | 34 |
|---|---|---|---|---|---|---|---|---|---|
| ticks (incl. prefix) | 206 `0c36d853aa` | 220 `1059d26ccf` | 221 | 222 | 203 | 206 | 206 | 234 | 238 |

**Witness:** `robust-l16-sword-idle1`, which is `canCross({level 16, exit 17, arrival {from 15}, inventory [sword],
idle: 1})`, 220 t.
- `--record --only=robust-l16-sword-idle1`: **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 221 observations, 1
  transition(s)"**, hits 0, ALL CHECKS PASSED.
- A second, non-record replay: **"live game matches the committed oracle stream"**, ALL CHECKS PASSED.
- The unit row asserts the committed tape IS the oracle's witness, byte for byte. The CLI
  (`--idle=1 --name=… --witness=…`) writes a `cmp`-identical file.

**`canCross` gained `idle`** (an OPTIONAL request field, default 0):
- n empty ticks are advanced before the solve and passed as `solveSegment`'s `prefix`. `prefix` itself is unchanged
  (the JS arc's).
- The request echoes `idle` only when it is > 0, so every existing result and witness is byte-identical (the CANCROSS
  witness row is green).
- The CLI flag is `--idle=`.

**The arrival-tick convention.** The live worker solves at the arrival tick (`wasmArrival.js`: *"the arrival IS the
boot"*). For L16 it is no longer load-bearing: every idle count above solves. It stays the documented default.

## D3: the Conch (PASS, `140d5f5`)

**Measured** (L16 → `stairsup@352,80`, door from L15, `none`):
- {sword}: can, 878 t, `b9fc18ae79`, PULL. The first danger is `arrowLane:arrowtrap@96,32` at t154 on
  `[[56,120],[88,120],[88,56],[248,40],[248,88]]`.
- {sword, conch}: the corridor is **`[[248,40],[248,88]]`**, a straight line across the water. Its first danger is
  **`enemy:sandtrap@48,32`** at t21, (63.2, 48.8). The sub-goal is the weigh stance for `lock@320,112`.
  - AVOID: *"no walkable tile path … from tile (2,4) to (15,5) … different connected components"*. With the lanes and
    the trap both forbidden, there is no corridor.
  - TIME, BAIT and KILL refuse. DETOUR is absent (not chaser-only). **EXHAUSTED.**

**Which brief hypothesis held:** neither "planner preference" nor "the corridor probe asking only the shortest" was
the cause on its own. The planner does prefer the swim line, but the failing part is the **PULL rung reading only the
first danger**: the D2 mechanism, reached through a different first danger.

**After** (the same fix, no D3-specific code):
- {sword, conch} is **can, 797 t, `d6505110c3`, 0 hits**. Traced:
  - climb 1: the hit is the sandtrap; the later-lane probe finds `arrowtrap@96,32` → `rope@32,16`;
  - the stance walk's nested climb 2 hits the sandtrap → AVOID;
  - `execPull` at t65 from (71.1, 40.6), then the weighed route to the stairs.
- {sword} is unmoved: 878 t, `b9fc18ae79`, PULL (unit row).
- **Monotonicity sweep:** {sword} and {sword, conch}, each plus one of shield, darkshield, fire, wand, feather, spear,
  darksuit or torch. **All 18 are `can`, with 0 hits.** {sword, conch, shield} is 788 t. This ran in the scratch mirror,
  whose `solverBot.js` equals the committed one except for one comment.
- `deriveMinimalSets` over {sword, conch}: ∅ and {conch} are `undecided` (`MAX_ROUTE_ORDERS`, a field now), {sword}
  `can`, **{sword, conch} `can`**, so `nonMonotone: []`. Minimal is {sword}, still `unprovedBelow` ∅.

**Witness:** `robust-l16-l18-sword-conch`, 797 t.
- `--record`: **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 798 observations, 1 transition(s)"**, hits 0.
- Replay: **"live game matches the committed oracle stream"**.
- The unit row is byte-for-byte, and the CLI output is `cmp`-identical.

**Mutants** (predicted, copy + restore, md5-identical):

| mutant | predicted | measured |
|---|---|---|
| the later-lane block off (`false &&`) | 4 red: the idle-1 witness, the idle sweep, the conch witness, and the derive row | **4 red / 21** |
| `LATER_LANE_PROBES = 1` | only the bound row (both rooms meet their lane SECOND) | **1 red / 21** |

## The JS arc's pins that move

**None.**
- No `jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js`, worker or `prefix`-admission file changed.
- `jsRuntimeSolverAnytime` and `jsRuntimeSolveService` (run read-only) are green.
- **The `canCross` solver stamp moves** (by design: it hashes `solverBot.js`): it is now
  **`3178a6e81678d9969d755f7dd7b0d01f`** (91 files). A derivation stamped before this slice is STALE.
- `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` keep their signatures and contracts.
  New optional fields:
  - `SolverRefusal.bound`;
  - the failed `deriveChaserDetour` result's `bound`;
  - the `considered` detour row's `bound`;
  - the failed detour trace row's `previews`/`planned`/`bound`;
  - `canCross`'s `idle` and `request.idle`;
  - `deriveMinimalSets` rows' `cause`.

## Deltas

| row | W0 | head |
|---|---|---|
| identity log | `aa46950b…` | **`aa46950b5958b32136111155250dd253`**, byte-identical to W0 (empty `diff`), re-run at the committed head `71d8ff0` |
| six `--check`s | `405d9c4b 8e7a43be 33d20889 35456fbc 6cd35fe1 b29b589b`, exit 0 | identical, all exit 0 |
| tapeRunner | 477/477 `5bdf547c…` | **481/481**: the 477 old pairs byte-identical, plus 4 new (`fixture differential` and `incremental stepping face` for each new tape); all 481 `e658d7c6e4c7ec82c0211c65a8135057` |
| roster | 210 | **212** (`robust-l16-sword-idle1`, `robust-l16-l18-sword-conch`) |
| R8_ENEMY_BRIDGE exposed | 48 declared, 49 on disk: **red at the base**, measured by copy + restore (*"Undeclared and exposed: cancross-l16-sword-none"*, 1 red / 93) | **51 = 51** (+ `cancross-l16-sword-none`, which CANCROSS left undeclared, + the two new) |
| surface | GREEN 195 `9a7cdc1e…` | GREEN 195 `3a3cbc0dbceb512ff719f5912e0ab973` after `--write`: site counts only, 5 rows (`run:progress`, `run:world`, `world:arrowTraps`, `world:solids`, `import:arrowTrap.js#arrowTrapFires`). No new surface |
| constants / profile / entities | PASS 4,966 / 138 / 518 | unchanged (`--write` is a no-op) |
| bounded vitest | 16 files / 808 green | **37 files / 1,863, 1,862 green**. The one red is `rosterCategories:175`, **pre-existing**: with the base `index.json` restored and the two tapes moved aside (copy + restore, md5-identical) it reads *"expected 149 to be 150"*, and with them *"149 to be 152"*. It is the composite bank row, which needs `standing-values --write` (forbidden here) |
| instruments index | 343 | 344 files (the regenerated index; `can-cross-seedling.mjs` gained `--idle`) |

The AFTER set is the W0 list plus `seedlingRobust`, `r8Acceptance`, `fidelityF7`, `ropeSword`,
`jsRuntimeSolverAnytime`, `jsRuntimeSolveService`, `tapeEnvelope`, `observationTolerance`, `dialogueAutoAdvance`,
`rosterCategories`, `tapeIndexManifest`, `argvHelp`, `fixtures/tiers`, and the first 20 `procgenDocs/*.test.js`.

**Files:**
- `solverBot.js`, `seedlingCanCross.js` (+ its test), new `seedlingRobust.test.js`;
- `r8Acceptance.js` (+ its test);
- three roster pins;
- two tapes, two expectations, `index.json`;
- `can-cross-seedling.mjs`;
- `seedling-solver-surface.json`;
- the bot log and the regenerated reference.

## What the brief got wrong (measured)

1. **"D2 … a forecast that treats waking bobs as worse than the game does; a corridor timing."** It was neither.
   - The forecast is the run's own, and the game agrees with the model on the late-started plan.
   - The corridor is the same one at both ticks.
   - What flipped was **which danger came first** on that corridor, and the PULL rung's existence hung on that.
2. **"D3 … planner preference? the corridor probe asking only the shortest?"** Same mechanism as D2. The swim line is
   the planner's preference, but it only mattered because PULL was keyed on the first danger. **D2 and D3 are one
   bug**, and one fix closes both.
3. **"Only the Conch flips it" (CANCROSS) reads as a property of the Conch.** Gaining an item changed the corridor
   ordering, not what the room allows. With the fix, {sword, conch} + each of eight items all solve.
4. **CANCROSS's "No solver … file changed" left a pin behind.** `R8_ENEMY_BRIDGE` did not declare
   `cancross-l16-sword-none`, and `r8Acceptance.test.js` was red at the base: *"Undeclared and exposed:
   cancross-l16-sword-none"*. It was not in CANCROSS's vitest set. Declared here.
5. **"`canCross` matches the solver's fixed words … two bounds."** True. Both are fields now, and no refusal's words
   changed.

## Residue

| # | item | owner |
|---|---|---|
| 1 | `rosterCategories:175` composite bank row (149 vs 152), pre-existing (149 vs 150 at base); needs `standing-values --write` | coordinator |
| 2 | Two new tapes owe the full tier a CI drive (`check-seedling-full-tier-owed`) | CI |
| 3 | **A trace row merged on its tick hides the rung that acted.** {sword, conch}'s PULL is decided at tick 0 and its row merges with the nested stance walk's AVOID row, so `canCross`'s `plan.rungs` reads `['avoid']` for a solve that pulled (`execPull` at t65). `rungs` is a summary of rows, not of `records`. Not changed here | fidelity / CANCROSS's module |
| 4 | The later-lane probe is L16-only by the atlas, not by name. A future room with a rope-silenced lane gets it automatically, gated the same way | — |
| 5 | Other rooms' one-tick fragility was not surveyed. Only L16 was swept over idle counts. A survey (`canCross --idle=1` over every captured arrival) is cheap and would say whether the convention is load-bearing anywhere else | fidelity |
| 6 | CANCROSS residue #1 (L16 `all` plan refuted at t104) is untouched (DASH's region) | DASH |

## Byte-inertia

- **No committed solve moved.** The six producer `--check`s are byte-identical to W0, every other identity row is
  unmoved, and the 477 old tapeRunner pairs are byte-identical.
- **No committed tape or expectation changed.** Two were added. `campaign-frontier.json` is untouched.
- **The refusal words are unchanged.** D1 adds fields only. The swordless L16 climb's words are unchanged by
  construction (the sword gate).
- No AS3, wasm, gitlink or rules edit. No `standing-values --write`, no `pytest`, no unfiltered vitest. No new
  box-taking instrument (the CLI drives no browser).

## Rows to BANK

- **Identity:** log **`aa46950b5958b32136111155250dd253`**, byte-identical to W0 (empty `diff`), re-run at the committed head `71d8ff0`. Six `--check`s **`405d9c4bb37a0ab00fb0ef9a99194783` `8e7a43be0509882d753f54155ef284c2`
  `33d20889ebd8c72452ce7262bce9505b` `35456fbc07e7151ddbc4c2a1fd00c789` `6cd35fe1414af6bf5beb7605f235cb8e`
  `b29b589b26e6ad996c2a328d16b52c90`**, all exit 0, unmoved.
- **tapeRunner 481/481**: all pairs `e658d7c6e4c7ec82c0211c65a8135057`; the 477 old ones `5bdf547cd654e69b2cf239e1549ef0f5`.
  **Roster 212.**
- **New fixtures:**
  - `robust-l16-sword-idle1`: tape `fe9708d392e680d7cc41883cc57bbe74`, expectation `bdce157df6568e4cb56288046183c522`;
  - `robust-l16-l18-sword-conch`: tape `f12b0d95d6a9d83c234a777a6de25320`, expectation `8acc3798051c657d82fea4fe0706d336`;
  - `fixtures/tapes/index.json` `aaa2fc892071296757dbe077576ea371`.
- **Surface** GREEN 195 (`3a3cbc0dbceb512ff719f5912e0ab973`) · **constants** PASS 4,966 · **profile** 138 · **entities** 518.
- **R8_ENEMY_BRIDGE**: 51 exposed.
- **canCross stamp** `3178a6e81678d9969d755f7dd7b0d01f`.
- **New API:**
  - `SolverRefusal.bound`;
  - `LATER_LANE_PROBES = 4`;
  - `canCross({…, idle})` and `--idle=`;
  - `deriveMinimalSets` rows' `cause`.

