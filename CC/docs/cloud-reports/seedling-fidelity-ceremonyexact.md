# Seedling fidelity CEREMONYEXACT (wave 37c) — `ceremonyPressForecast` made exact: one tick, stepped

Session `seedling-fidelity-ceremonyexact` (planner `seedling-fidelity-planning-18`, wave 37c; ⚖ the user's GO 2026-11-05).

- **Start SHA:** `028da05be1` (= `origin/fidelity-flip/w37b`; 125 keys, **113 ON**). **Head:** the last commit of the harness
  branch **`claude/seedling-fidelity-wave-37c-dneth3`** (the brief's `seedling-fidelity-ceremonyexact` branch name was not
  used: the harness pushes to its own branch). Port 9774.
- No new key. `ceremonyPressForecast` stays **OFF**; its ON behaviour is now exact. Nothing renamed, no new env read.

| D | Verdict |
|---|---|
| W0 | **DONE.** Every stand-down CEREMONY126's bound made on L40 legs 368/371 and the L40 kill rung is **bound-only** (19 / 18 / 84; the exact forecast refuses none of them). Survey 125/141/183/221/236 censused: the only exact refusals are L64's and L79's, at their own collect pickups |
| D1 | **PASS** (OFF, byte-identical). `ceremonyGuard` asks a one-tick stepped forecast with the held sets the policy is about to send. Key ON: legs 368/371, the `fidelityL100Fix` row and the L40 kill rung are **key-for-key the OFF plans**; step 125 stays SOLVED 150 t. Game witnesses: `ceremony126-lost` still 0 px; NEW `ceremonyexact-kept` (p4g, 0 px) |
| D2 | **READY to flip, no pin moves.** Key ON as the shipped default (flip tree): bounded fast set 109/111 files, the 2 reds are the two default-value rows a flip re-pins (`contactFidelity` defaults, CEREMONY126's "D1 ships OFF"); `solveProgress*` / `fidelityWandHold` / `fidelityL100Fix` / `hammerAxisStrikes` / `dashShape` / `dashOnlyWindow` / `jsRuntimeSolverShouldStop` all green; identity block + six producer `--check`s = OFF on every row; full local survey moves **only step 125**. No hammer pin to list |

## 1. W0 — the trace (no code; measured at the base's behaviour)

**Method.** A temporary census arm (uncommitted, removed before D1's commit) made `ceremonyGuard` return CEREMONY126's
bound verdict — so the run follows the base's ON trajectory exactly (it reproduced 1605 / 1672 / 675 t) — while also
asking the exact forecast at every refusal: for a press with the keys the arm sends, for an aim with each of the four
facing keys then the press alone. Solves as the tests pin them (`withStrikeEtaFloor(false)`; `fidelityWandHold`'s
staging; `solveProgress`'s `stagingOf('r5-l40-part5')`).

| solve | bound arm (base ON) | stand-downs (aim / press / planned) | exact would refuse | first stand-down | first that CHANGES the keys |
|---|---|---|---|---|---|
| leg 368 (`…in_L41_0_160 -> …Totem Part 64,144`) | 1605 t (OFF 1601) | 19 (18 / 0 / 1) | **0** | t1581 aim at (89.89,136.87), v(−2.95,0), gap 7.89 ≤ bound 12.16 (2 ticks) | **t1586 planned dash press** `left+primary` at (78.89,136.87), v(−1.70,0), gap 4.13 ≤ bound 4.83 |
| leg 371 (`…in_L42_240_336 -> …`) | 1672 t (OFF 1667) | 18 (17 / 0 / 1) | **0** | t1649 aim at (88.55,136.80), v(−3.50,0), gap 6.55 ≤ 13.26 | **t1654 planned dash press** at (78.80,136.80), gap 4.20 ≤ 4.58 |
| `fidelityL100Fix` (371 + `fineSwingStance`) | 1672 t (OFF 1667) | 18, same rows as 371 | **0** | as 371 | as 371 |
| L40 kill rung (`r5-l40-part5`, collect (160,640)) | 675 t (OFF 679) | 84 (84 / 0 / 0) | **0** | t471 aim at (184.70,666.20), v(0,−1.25), gap 8.20 ≤ 8.76 | **t491 aim** at (184.70,642.50), v(0,−1.05), gap 6.70 ≤ 8.36; OFF aims `left` here and presses at t492 |

The pickup in every row is the nearest touchable one, by position the goal's own totem part. **The game's next tick would
not overlap it:** the stepped box after each refused tick (and after both ticks of each refused aim, every facing) is
clear of every touchable pickup rect. Game evidence for the two L40 legs: the committed p4g witnesses
`wandhold-l41-368-paced` / `wandhold-l42-371-paced` ARE the OFF plans (key for key), so the game played exactly these
presses (t1586 / t1654, 4.13 / 4.20 px from the part) at 0 px on every sampled tick, and its pickup freeze comes only
after the tape's cut — no ceremony started on either thrust's tick.

**Survey census** (steps 125, 141, 183, 221, 236; the same census arm; 141 stand-downs, every one inside the bound; an
aim counts as exact-refused if ANY of its four facings would be):

| step | bound stand-downs | exact would refuse |
|---|---|---|
| 125 L64 Ghostspear | 8 (t36–t44) | 5: aims t40–t42 for some facings (ceremony on the aim's PRESS tick, `at: 2`), **t43 the planned press (`at: 1`, the thrust's tick: the lost press)**, t44 (box already in, `at: 0`) |
| 141 L67 | 25 (t634–t692) | **0** — all bound-only (this was the −8 t) |
| 183 L79 Darksuit | 26 (t16–t41) | 18: facing-2 aims and the planned press at t40 (`darksuit@40,152`, `at: 1`); the t20 / t22 planned presses are bound-only (this was the +5 t) |
| 221 L106 | 58 (t109–t170) | **0** (this was the +27 t) |
| 236 L115 The Seed | 24 (t99–t123) | 18 aims, some facings only (this was the +1 t; ON exact the row equals OFF) |

## 2. D1 — the exact forecast (same key, still OFF)

**Change** (`levelRun.js`, `strikePolicy.js`; commits `e3766be6`, `55ae417e`):
- `levelRun.ceremonyStepNow(heldSeq)` — a PURE READ. `heldSeq` is one held set per tick from this boundary. The box
  overlapping a touchable pickup NOW ⇒ `{at: 0}` (the ceremony starts on the first tick); else each held set is stepped
  with the run's OWN stepper (`previewStepperNow`, the body of `previewStepper` moved verbatim into a const), a rising
  `primary` pricing its dash impulse as `advance` does (`slashPressForecast` on `slashInfo`, the facing the tick starts
  with), and the box after step k overlapping a pickup ⇒ `{at: k+1, tag, x, y}`. `pickupUnderfoot` takes an optional
  position (default null = today's). A death the stepper refuses → null.
- `freezeForecastNow` (key ON, `pickupGap` non-null) carries it as a **non-enumerable** `ceremonyStep`: the forecast's
  enumerable shape, its JSON, a structured clone and every `toEqual` are CEREMONY126's.
- `ceremonyGuard(state, freeze, aheadTicks, { held } = {})` — **name and 3-argument shape kept**: without `held` (or
  without `ceremonyStep`) it is CEREMONY126's bound, unchanged; null when OFF. With `held`: a gap beyond
  `ceremonyReach(v, n)` (sound n-tick reach; n = 1 is `oneTickTravelBound`) is not stepped; otherwise it refuses only when
  `ceremonyStep(held)` names a ceremony (`{…, exact: true, startsAt, pickup}`). New exports `ceremonyExact`,
  `ceremonyReach`, `CEREMONY_EXACT_COUNTS {stepped, cleared}`.
- The policy's three sites ask with the keys they send: the press half `[{primary}]`; the planned press
  `[walkHeld + primary]`; the aim, once its pick is known, `[{aim key}, {primary}]` (with the exact forecast the early
  aim-site bound check is skipped; the refusal row carries `target`).

**Witnesses** (p4g headless, port 9774, `probe-seedling-ceremony126.mjs`; `fixtures/ceremony126-witness/`):
- `ceremony126-lost` (input 43): re-played, **151/151 ticks at 0 px** (unchanged). The exact forecast names it: at the
  boundary before input 43, `ceremonyStep([walk + primary])` = `{at: 1, ghostspear@72,24}`.
- **NEW `ceremonyexact-kept`** — the lost witness's tape with its press one input EARLIER (42): the bound refused it
  (gap 1.16 ≤ 4.45), the exact forecast does not (the box after input 42 is clear of the rect; the ceremony starts on 44,
  not on the thrust's tick 43). The model AUTHORS it (no `FROZEN_TICK_PRESS`) and **the game equals the model of the tape
  WITH the press, 151/151 ticks at 0 px**, ceremony obs 45..73, finishing in L62. ⚠ As CEREMONY126's lost witness, L64
  has no hittable body, so what it shows is "the game and the model agree on a press the model authored next to the
  pickup"; that the thrust LANDS is shown on L40, where the committed witnesses above played the bound-refused t1586 /
  t1654 dash presses at 0 px.

**Test** `fidelityCeremonyExact.test.js` (10): `ceremonyReach`; the 3-argument / no-`ceremonyStep` arms are the bound;
the exact arm refuses only on a named ceremony and does not step beyond reach; the policy asks the aim with its key then
the press, and drops the aim / the press half on a named ceremony; OFF shape (no `pickupGap`, no `ceremonyStep`) vs ON
(enumerable shape unchanged, `ceremonyStep` non-enumerable); L64 inputs 40/41/42 bound-refused & exact-clear, 43 exact
`at: 1`; DIGESTREAD (asking the step moves no digest, no tick, no state); the kept witness vs the model.

**Mutants** (predicted, then copy + restore):

| mutant | predicted | measured |
|---|---|---|
| M1 `ceremonyStepNow` steps nothing (only the "now" overlap) | 2 red (the L64 43 row, the purity row) | 2 red ✓ |
| M2 `ceremonyGuard` ignores `held` (always the bound) | ≥ 3 red | 4 red ✓ (exact arm, aim-asks, drop, L64 rows) |
| M4 `ceremonyStep` enumerable | 1 red (the shape row) | 1 red ✓ |

⚠ No unit row exercises the dash-impulse arm of the step (L64's presses are plain swings); its guard is the L40 legs
(their t1586 / t1654 stand-downs are planned DASH presses, exact-clear, and the ON plans equal the game-witnessed OFF
plans).

## 3. Movers — the survey/sweep rows this moves (key ON vs OFF)

**Local full survey** (`survey-seedling-route.mjs --through=end --route=full`, 236 steps, at `e3766be6` = D1's code):
**OFF 204 SOLVED / 32 REFUSED** (= the brief's base); **ON 205 / 31**. The ONLY row that differs (JSON rows compared with
timing fields stripped): **step 125 L64 Ghostspear REFUSED `FROZEN_TICK_PRESS` t43 → SOLVED 150 t, 3 decisions, 0
re-plans, 0 hits.**

| step | OFF | CEREMONY126's bound ON | exact ON |
|---|---|---|---|
| 125 L64 Ghostspear | REFUSED `FROZEN_TICK_PRESS` | SOLVED 150 | **SOLVED 150** |
| 141 L67 | 957 | 949 | **957** |
| 183 L79 Darksuit | 97 | 102 | **97** |
| 221 L106 | 185 | 212 | **185** |
| 236 L115 | 173 | 174 | **173** |

(At this base `ceremonyWalkHandoff` is ON, so 183 is SOLVED in every arm; CEREMONY126's "183 REFUSED" OFF row predates
the W37b flip.)

**Bounded solver rows** (W0's solves): leg 368 1601, leg 371 1667, the L100FIX row 1667, the L40 kill rung 679 — exact ON
= OFF, `perTick` key for key.

**CI dispatches for the planner** (branch `claude/seedling-fidelity-wave-37c-dneth3`, at the head):
- Survey A/B: `seedling-survey.yml` `through=end`, `route=full`, at the defaults, and once with
  `SEEDLING_CEREMONY_PRESS_FORECAST=1` (or `only=125,141,183,221,236`). Expected: only step 125 moves.
- Full sweep ×2 per arm: `seedling-divergence-sweep.yml`, `contact_fidelity` = the file
  `CC/docs/cloud-reports/seedling-fidelity-ceremonyexact-evidence/contact-fidelity-off.txt` (the 113 default-ON keys,
  comma-joined, built from `CONTACT_FIDELITY_DEFAULTS` at the head) and `…-on.txt` (the same + `ceremonyPressForecast`).
- Keyed, with `capture_requests` (keys derived at this base, `seedling-divergence-legs.mjs --presets=seedling_playthrough
  --blocks`, 930 legs; ⚠ leg ids moved: the brief's 368/371 are **371/376** here):
  `keys=level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144|level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144|level_40__r23c29 <- in_L39_144_0 -> location:Level 040 - Totem Part 160,640|level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Totem Part 160,640|level_64 <- in_L62_112_64 -> location:Level 064 - Ghostspear|level_64 <- in_L62_112_64 -> exit:out_teleporter_32_96|level_79__r8c4 <- in_L78_32_0 -> location:Level 079 - Darksuit|level_79__r8c4 <- in_L78_32_0 -> exit:out_teleporter_64_224`
- Probes: `seedling-probe.yml battery=standard` at the branch, both arms (not run locally).

## 4. D2 — flip readiness (key ON as the shipped default, in a flip worktree)

| gate | OFF (head) | ON (default flipped) |
|---|---|---|
| bounded fast vitest, 111 files (the brief's list + every `grep -a` hit for `ceremonyGuard` / `pickupGap` / `freezeForecast(Now)` / `CEREMONY_PRESS_COUNTS` / `strikeDecideOpts` / `pickupUnderfoot` / `ceremonyPressForecast` / `SEEDLING_CEREMONY` + `dashShape`, `dashOnlyWindow`, `jsRuntimeSolverShouldStop`, `levelRunDigestRead`, `placedTalk`, `solverEnvChannel`, the census tests) | **111/111, 2517/2517** | **109/111, 2515/2517.** Reds: `contactFidelity.test.js` "the shipped defaults" and `fidelityCeremony126.test.js` "D1 ships OFF" — the two rows a flip re-pins. **Nothing else**: `solveProgress` (58), `solveProgressHeartbeat`, `solveProgressTap`, `fidelityWandHold` (10), `fidelityL100Fix`, `hammerAxisStrikes`, `dashShape`, `dashOnlyWindow`, `jsRuntimeSolverShouldStop`, `fidelityFrozenPress` green |
| slow/train (brief's: `fidelityCorpseBump2`, `fidelityL32ArenaPrefix` slow; `fidelityL40Bk2` train) | slow 2/2 files (8), train 1/1 | green (in the row below) |
| every seedlingDemo `.slow.` (18) / `.train.` (11) file | — | **slow 17/18 files, 115/115 tests; train 11/11, 35/35.** The one slow file red in the flip worktree, `seedlingGenKeyGateColours.slow` (`registerBackend: duplicate id 'empty'`), is a worktree artifact (its symlinked `frontend/modules/shared` loads a second registry copy); in the main checkout with the key ON it is 6/6 green. Hammer's train pins (`hammerGhostKillRung`, `hammerChooserPair`, `hammerLatchWeigh`, `hammerIceTurretStatic`, …) and `fidelityL40Bk2`/`fidelityL40Latch` green |
| identity block (`identity-block.sh`, 13 rows + the six producer `--check`s) | maze `57e07d21`, acceptance **`abb206c8`**, c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`; producers `7486f32e` · `93f75467` · `88e33db7` · `35456fbc` · `6cd35fe1` · `be9c19c8`, all exit 0 | **identical on every row** |
| `ci-producer-checks.mjs --jobs=3` | — | **97 run / 0 red / 1 skipped** (`plan-seedling-r7-ends-meet`, a browser arm in CI; `evidence/producers-flip-on.txt`) |
| acceptance batch md5 | `abb206c88de25e7ba1874510d493ce85` (= main's) | identical |
| solver surface / constants census | `--write` then `--check`: GREEN 371 rows / PASS 7072 (the `SLASH_DASH_FORCE` site; `previewStepper`'s literals re-targeted to `previewStepperNow` in `seedling-constants-fields.csv`, classifications unchanged) | — |
| `generate-procgen-reference --check` | ALL 7 MODULES AND 5 REGIONS MATCH | — |
| `seedlingDerivedRuleTable.js --print-engine-closure` ∩ diff | ∅ (43 closure files; none of `levelRun.js`, `strikePolicy.js`, `contactFidelity.js`, `fidelityCeremony126.js`) | — |

**What the flip owes** (no tape, no producer digest, no hammer pin): flip the default in `contactFidelity.js`; re-pin
`contactFidelity.test.js`'s defaults row and `fidelityCeremony126.test.js`'s "D1 ships OFF" row; `fidelityFrozenPress`'s
W37B ordering row is unaffected (green ON).

## 5. Boundaries, hand-overs, JS arc

- **hammer-3:** `ceremonyGuard`'s name, 3-argument call shape, its null-when-OFF and its bound for a 3-argument caller
  are unchanged — **OPP-FREEZE inherits the bound** unless it passes `{ held }` (one held set per tick it will send), which
  is the exact arm. `pickupGap` is unchanged and still optional. The new `ceremonyStep` is non-enumerable on the forecast.
  No hammer pin moves (the `solveProgress` L40 kill-rung rows CEREMONY126 listed are GREEN with the key ON).
- **JS arc:** no contract change; `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging` untouched.
  `run.previewStepper()` returns the same closure (its body now lives in `previewStepperNow`). No `run.*` field renamed or
  reshaped (the skin reads none of this). No `producer:walker` row expected to move (the walker is unchanged; the strike
  policy's ON decisions equal OFF's on every bounded row).
- No new per-visit run map (`ceremonyStepNow` computes on read; DIGESTREAD row in `fidelityCeremonyExact.test.js`).
- Not touched: the three `FROZEN_TICK_PRESS` throws, `REFUSAL_BY_NAME`, `runChest`, any AS3/wasm/gitlink/rules, any
  committed tape or producer digest, any hammer-owned function.

## 6. What the brief got wrong (measured)

- "CONTACT_FIDELITY at your base: 110 ON of 122 … fineStanceWalk (⚖ HELD)" is stale: the base has **125 keys, 113 ON**
  (`fineStanceWalk`, `previewBeamTowerDrift`, `ceremonyWalkHandoff` ON), as the brief says elsewhere.
- Legs "368 / 371" are **371 / 376** at this base's derivation (matched by key).
- CEREMONY126's table has step 183 REFUSED OFF; at this base (`ceremonyWalkHandoff` ON) it is SOLVED 97 OFF, and the bound
  moved it to 102 — a fifth bound-only mover the brief's list omits.

## 7. Residue

- Outside the forecast, as outside `pickupGap`: runtime pickups (the Bob Boss's Fire, the dark sword), a hit's knockback on
  the stepped tick, and the planned arm under `holdOneAxis` (the drive filters the keys after `decide`; the step asks with
  the unfiltered walk keys). `previewStepper` snapshots `inputBlocked` at `frozenTimer > 0` before the next tick's
  `freezeStep`; the FROZENPRESS guard stands down first whenever the next tick is refused, so the remaining window is a
  `frozenTimer` of exactly 1. None of these occurs on a bounded row.
- `scripts/procgen/standingValues.test.js` "a gate that sleeps past the deadline is KILLED" is red in this container at
  the base too (process-group kill) — not this slice.
- The identity block's "generated set" row needs a Python with the headless requirements in a worktree; not measured.

## 8. CI and commits

Commits: `e3766be6` D1 · `55ae417e` D1 (`previewStepperNow`) · `561ba5a5` census records · `20096dd2` log, reference,
evidence · then this report (docs only; it triggers no `JavaScript Unit Tests` run). **CI `JavaScript Unit Tests` at
`20096dd21` (run 42122985997): success — suite: vitest (unfiltered) 25651 passed / 0 failed; slow battery 372 / 0.**
No `.train.` file of mine (the ON train tier above was run locally, 11/11).

## 9. Rows to BANK

- `ceremonyPressForecast` ON (exact): survey step 125 L64 REFUSED → SOLVED 150 t 0 hits; every other survey row = OFF.
- L40 legs 368/371 (keys above), the L100FIX row and the L40 kill rung: ON = OFF key for key (1601 / 1667 / 1667 / 679).
- Game witness `ceremonyexact-kept` (p4g, 151/151 at 0 px).
