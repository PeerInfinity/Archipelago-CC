# Seedling fidelity CORPSEBUMP2 — a bumped corpse is read where it is pressed (`corpseBumpRestRead`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-fidelity-corpsebump2` (planner `seedling-fidelity-planning-17`, wave 36), cloud |
| Start SHA | `b646d32d95b4ebd636a70f05886957deffbf724a` (main; 105 ON of 116 keys) |
| Head | D1 code `b478ca69`; records `b9ca22be`; the live-defaults skip `1184e72f`; docs `22ca5624`; this report and the evidence are the last commit |
| Branch | `claude/seedling-fidelity-wave-36-sz1y7h` (the harness's; the brief's `seedling-fidelity-corpsebump2` name was not used) |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-corpsebump2-evidence/` (tools in `tools/`, the latch arms in `table/`) |
| Port | 9767 (head), 9768 (the base worktree's identity block) |

## 2. The answer first

**The two reads do not disagree.** `execCorpseWeigh`'s rest read (`tileOf(turret())`) and `runFire`'s positive control
(`from = floor(now.x/16), floor(now.y/16)`) are the same rule: the corpse's ENTITY tile, from the same `run.entities('turrets')`
row. **The corpse moved between them.**

| tick | what | corpse (entity) |
|---|---|---|
| t1068 | bump 1, `runFire` from the stance (488,440) | (487.5,424) → glides north |
| t1182 | `execCorpseWeigh` reads it at rest: **(30,25)**, y 408 (a true rest, the two-cycle 408 ↔ 407.5) | (487.5,408) |
| t1182 | the walk to bump 2's stance (488,424) starts: its first tick is **`up+primary`**, with **Fire selected** | |
| t1182–t1208 | that press is a Fire press; the corpse glides on, across into (30,24) during the walk | (487.5,399) at t1208 |
| t1208 | `runFire(bumps: [{to: (30,24)}])`: *"iceturret@472,400 is ALREADY on (30,24)"* | |

Where the press comes from: the walk is `walkTo` → `drive` with the walk's strike policy (`strikePolicyFor`). That policy
gates on the INVENTORY's sword (`hasSword || hasGhostSword`), not on the selected slot. `execCorpseWeigh` equips Fire
before bump 1 and restores the blade only after the last press, so every walk between presses runs with Fire selected.
A policy press is then `useItem(Main.primary)` = a Fire press (stack in `w0-trace.txt`: `advanceNamingRefusals` ←
`drive` (botDriverV2.js:5694) ← `walkToUnder` ← `execCorpseWeigh`).

**The game's truth** (p4g, headless, 0 px, the solver's own 1400 ticks, `corpsebump2-walk-press`): after bump 1 the corpse
rests on (30,25), not on the presser. The walk's X press carries it to (30,24) = `button@480,384`, and it stays. The game
equals the model on every one of the 1400 ticks: player, blocks, chasers, the turret and corpse, and hits (none).

**Why no `perTick`:** `runFire` refuses through `fail()` → `BotDriverV2Error`, which carries no fields. `execCorpseWeigh`
did not catch it, and `l40LatchSolve` returns it as the answer, so the refusal had no ticks.

**D1 (`corpseBumpRestRead`, OFF, byte-identical OFF):** one rest rule (`waitRest`, factored out of the press's wait,
the same rule and messages), asked in one more place: at the stance, after the walk.
- A walk Fire press younger than its bump window (`FIRE_WINDOW.lastHitTick` + 1) is stood out.
- A corpse that is gliding (`turretsSettled` false) or off the rest cycle it was read on is waited to rest, counted in
  `corpse.walkBumps`, and the loop re-reads its tile.
- So the bump the walk made is not made again. A corpse carried past the presser refuses by name (the existing
  post-loop check), and an unmoved corpse costs no tick.
- A refusal inside `runFire` carries `perTick` (an optional field on the error object).

**The measured effect, the hand-over arm** (CPAIR-3 + `LATCH_WEIGH_FIRST` + `orbitFreeAim` + `strategyBoundDistinct`,
`turretSnapPricing` OFF): OFF the solve refuses at bump 2 (`BotDriverV2Error`, perTick 0). ON, `wandlock@448,432` opens at
t1301 and the chain runs on, hitless, to the 4-strategy bound at `pushableblock@576,560` (t3564) — LWEIGH's item 3.

**The one thing to know first:** nothing in the corpse model was wrong. The executor holds Fire across a walk whose
strike policy presses X, and the game moves the corpse on that press. ON the executor reads the corpse where it is
instead of where it was. The policy's gate (inventory, not the selected slot) is hammer's: § 9.

## 3. W0

| row | result |
|---|---|
| base | `git checkout` at `b646d32d95`; the designated branch was already at it |
| bootstrap | `session_bootstrap.sh --seedling` → READY; node v22.23.4 |
| reproduce (LWEIGH's arm: CPAIR-3 + LWF + ICEST + OPP + `orbitFreeAim` + SBD) | **not at the defaults**: since W35's `turretSnapPricing` the chain refuses earlier, at t879 (`kill (iceturret@472,400)`: no hitless side). With `turretSnapPricing` OFF it reproduces exactly (`table/`). ICEST and OPP are not needed: CPAIR-3 + LWF + `orbitFreeAim` + SBD + snap OFF reproduces it (perTick 0, `BotDriverV2Error`) |
| the reads | an env-gated scratch trace (`w0-trace.txt`; removed before D1) of the corpse at loop start, each iteration, after the walk, before `runFire` and at rest; then a stack on every walk press with Fire selected (`levelRun.advance`, scratch). Both reads are `floor(entity/16)`: `execCorpseWeigh` read (30,25) at t1182, `runFire` read (30,24) at t1208 |
| the game | `probe-seedling-l40latch.mjs --only=corpsebump2-walk-press --record` at :9767: **ALL CHECKS PASSED**, 1400 ticks at 0 px, hits equal (`probe-record.txt`); an earlier scratch run of the same tape (`tools/witness.mjs`, `witness-on-1400.txt`): 1397 ticks, 0 differ |
| identity block, pristine base worktree vs the head (`identity-base.txt`, `identity-head.txt`) | **every md5 row equal**, and equal to LWEIGH's published values: maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`; the six producer `--check`s exit 0 (r8-battery `7486f32e`, d2-chain `93f75467`, l18 `88e33db7`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `be9c19c8`). At the head: generated set OK, reference ALL 7 MODULES AND 5 REGIONS MATCH. The base worktree's two non-md5 rows are worktree artefacts (no `.venv` for the generated set; the symlinked submodules' reference row, as LWEIGH saw) |

## 4. D1 — the change, the witness, the mutants

**The code** (`solverBot.execCorpseWeigh` only; `contactFidelity.js` gets the key, appended at the end of the defaults):
- `waitRest(after)`: the press's rest loop, unchanged in rule and wording, as a closure. OFF calls it exactly where the
  inline loop was.
- ON, after the stance walk and its settle: stand out a walk press younger than its bump window; then `moved =
  !turretsSettled || |Δx| > 0.5 || |Δy| > 0.5` against the corpse as it was read; if moved, `waitRest`, record
  `{before, from, pressTick, rest}` in `walkBumps`, and re-enter the loop without counting a press (at most `k` such walks,
  else refused by name).
- ON, `runFire`'s `BotDriverV2Error` gets `perTick` if it has none, and is rethrown (same class, same message).
- The record: `corpse.walkBumps` (optional, only when non-empty).

**The first cut was wrong, and measured so:** it treated ANY walk Fire press as a move and waited the rest floor (72+
ticks). On hammer-2's solved arms the walk to bump 2 ALSO presses X with Fire selected, out of the corpse's reach, and
that cut cost them 74 and 72 ticks (L+CP3+TA 4142 → 4216, + `orbitFreeAim` 4108 → 4180, still hitless). The shipped rule
asks whether the corpse moved; those arms are then key for key OFF's (perTick md5 `e236428a…` / `c600e6e2…` in both
arms, `table/md5-*.txt`), and that is a slow row.

**The witness** (`fixtures/l40latch-witness/corpsebump2-walk-press.json`, a third entry of `L40LATCH_WITNESSES`, so the
existing `probe-seedling-l40latch.mjs` plays it; no new instrument). The tape is the solver's own first 1400 ticks under
the arm with the key ON (`fidelityL40Latch.corpseBump2WalkPressTape`), and the switches are the arm's contact keys
(`CORPSEBUMP2_SWITCHES`). The checks: never hit, and the corpse rests (30,26) → (30,25) → (30,24) and stays. OFF (the
four keys false) the model also reproduces the game at 0 px: every one of the four is solver-only.

**Rows:**

| file | row |
|---|---|
| `fidelityCorpseBump2.test.js` (fast, ~3 s) | ships OFF; the witness registered under the arm's keys; the recording's checks; the model at 0 px ON and OFF, hitless; the model's Fire presses before the lock opens are exactly bump 1 (t1068) and the walk's own (t1182), the corpse's tiles (30,26)@t1006 → (30,25)@t1089 → (30,24)@t1207, `wandlock@448,432` open at t1301 |
| `fidelityCorpseBump2.slow.test.js` (~8 min) | OFF: `BotDriverV2Error` *"ALREADY on (30,24)"*, `perTick` undefined (55 s); ON: the 4-strategy bound at `pushableblock@576,560`, and the solver's first 1400 ticks and equips equal the committed fixture's (73 s); ON = OFF key for key on the solved L+CP3+TA arm (4142; 313 s, two solves) |

`contactFidelity.test.js`' defaults pin gains `corpseBumpRestRead: false`.

**Mutants** (`tools/mutants.py`; predicted first in `mutants-pred.txt`; each applied, the fast file and the named slow
rows run, the file restored byte for byte, md5 `c736a03d…` checked; `mutants.txt`):

| mutant | predicted | measured |
|---|---|---|
| M1 drop the re-read | the ON chain row red | **red** (`ALREADY on`) |
| M2 any walk press counts as a move (the first cut) | the "unmoved" row red, the ON chain row green | **as predicted** |
| M3 no stand-out of a young walk press | survivor (the measured press is 26 ticks before the stance) | survivor — named |
| M4 no `perTick` on `runFire`'s refusal | survivor (no ON row reaches a `runFire` refusal) | survivor — named |
| M5 refuse the first walk bump | the ON chain row red | **red** |

M3 and M4 have no committed workload that reaches them: no measured walk presses inside the window, and with D1 ON no
measured arm reaches a `runFire` refusal. The arm is still shipped: a press in the window would otherwise be read
before its bumps land, and a refusal with ticks is what the brief asks for.

## 5. D2 — hammer-2's table (the latch staging, `l40LatchBoot`, every contact key at its default unless named)

LWF = `LATCH_WEIGH_FIRST`, CP3 = `CHOOSER_PAIR` size 3, TA = `TURRET_APPROACH`. Before = OFF (`corpseBumpRestRead`),
after = ON. Every row is hitless on a fresh replay of its ticks (`HITS []`).

| arm | before (OFF) | after (ON) |
|---|---|---|
| none | `hold stance (wandlock@448,432)` → `bob@736,800`, t271 | = |
| LWF | `weigh stance (wandlock@448,432)` → `bob@736,800`, t271 | = |
| CP3 | `hold stance` → `bob@736,800`, t271 | = |
| TA | `hold stance` → `bob@736,800`, t271 | = |
| LWF + CP3 | `weigh stance` → `iceturret@472,400`'s snapped hull (472.0,441.8), t577 | = |
| LWF + TA | `weigh -> approach staging (488,579)` → `bobsoldier@880,832`'s sword, t0 | = |
| CP3 + TA | `hold stance` → `bob@736,800`, t271 | = |
| **LWF + CP3 + TA** | **SOLVED 4142** | **SOLVED 4142, key for key** |
| LWF + CP3 + `orbitFreeAim` | `weigh stance` → the snapped hull (471.8,441.5), t658 | = |
| LWF + CP3 + TA + `orbitFreeAim` | SOLVED 4108 | SOLVED 4108, key for key |
| LWF + CP3 + `orbitFreeAim` + SBD, **snap OFF** (the hand-over arm) | `BotDriverV2Error` *"weigh (corpse bump 2): ALREADY on (30,24)"*, perTick 0 | **lock open t1301; the 4-strategy bound at `pushableblock@576,560`, t3564** |
| LWF + CP3 + TA + `orbitFreeAim` + SBD, snap OFF | SOLVED 4108 | SOLVED 4108 |

hammer-2's *"solves at t4108 even under A5"* is the `orbitFreeAim` arm here; with every contact key at its default the
arm solves at **4142** (the slow row of `hammerTurretApproach.slow.test.js`). Neither moves with D1. The ON rows of the
eight non-weigh arms ran under D1's first cut; none reaches `execCorpseWeigh` (all refuse before the turret dies), so the
rule change cannot touch them, and they equal OFF.

**Hammer pins that move: none.** `hammerLatchWeigh.slow`, `hammerTurretApproach.slow` and `hammerIceTurretStatic.slow`
are in the bounded set ON (§ 6).

## 6. D3 — flip readiness

The bounded set (`bounded-files.txt`, 125 files; ⚖ 52, by path): the brief's list, every `hammer*` test including
`.slow`, every test that `grep -a`s `execCorpseWeigh`, `deriveCorpseWeigh`, `corpseBumpWeigh`, `runFire`,
`L40LATCH_WITNESSES` or `fidelityL40Latch`, `solverEncounter.test.js` (it stages `apReportBosses`, which has no test of
its own), and the surface/constants tests: 126 files, 116 fast and 10 `.slow`. The fast runs below are the 115 files
that exist at the base; the 116th, `fidelityCorpseBump2.test.js`, was run on its own: **5/5 OFF and ON**.

| run | result |
|---|---|
| BEFORE, the base worktree, fast (115 files) | **2532/2532** |
| BEFORE, the base worktree, slow (9 files) | **19/19** |
| AFTER OFF, fast | 2527/2532 at `b478ca69`: **5 red, all records**: `seedlingSolverSurface.test.js` (i), (vi), (vii) ×2 (the new `entities('turretsSettled')`, `progress('primaryWeapon')`, `CONTACT_FIDELITY` and `FIRE_WINDOW` sites) and `entityBlocks.test.js` (`turretsSettled`' solver readers). Fixed in `b9ca22be` (`census-seedling-solver-surface --write`, 365 rows GREEN; `FAMILY_BLOCKS.turretsSettled.solverReads += solverBot` and the surface doc's table); both files then **66/66** OFF and ON |
| AFTER ON (`SEEDLING_CORPSE_BUMP_REST_READ=1`), fast | 2526/2532 at `b478ca69`: the same 5 records, plus `contactFidelity.test.js` *"the shipped defaults: all three ON"*, a row that compares the LIVE object with the defaults and skips under every key's env name. The new name was added to its skip list (`1184e72f`); the file is then **61 + 1 skipped** OFF and ON. **No behaviour row moved** |
| AFTER OFF, slow (10 files) | **22/22** (the base's 19 + this slice's 3) |
| AFTER ON, slow (10 files) | **22/22**, incl. `hammerLatchWeigh.slow`, `hammerTurretApproach.slow`, `hammerIceTurretStatic.slow`, `fidelityL40Latch.slow`, `fidelityL40Bk2.slow` |
| **CI `JavaScript Unit Tests` at the last code head `1184e72f`** (run 41230652940) | slow battery **354/354**; unfiltered **24985/24987**, the 2 red = `jsRuntimeTape.test.js`' two `NO_TAPE_CHAIN` rows (shard 3's log), nothing else. Later commits are docs and evidence only |
| the six @ci-box `--check`s, ON (`six-on.txt`) | **all exit 0, every md5 equal to OFF's** (r8-battery `7486f32e`, d2-chain `93f75467`, l18 `88e33db7`, tail `35456fbc`, r9-l3 `6cd35fe1`, r9-campaign `be9c19c8`) |
| `ci-producer-checks.mjs --jobs=3`, ON (`producer-on.txt`) | **97 run, 0 red, 1 skipped** (`plan-seedling-r7-ends-meet`, a browser arm CI runs), 0 known-red |
| `census-seedling-solver-surface --check` | RED on site counts → `--write` → **GREEN, 365 rows** |
| `census-seedling-constants --check` | **PASS** (7038 literals, 0 new) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (README word counts, docs index, instruments) → **ALL CHECKS PASSED** |
| `generate-docs-index --check` | OK (192 docs) |
| `derive-seedling-tick0 --check` | ALL CHECKS PASSED |
| `jsRuntimeTape.test.js` (js's; not in the set, measured because the brief warns of it) | **2 red at the head, 10/10 at the base**: `NO_TAPE_CHAIN` (*"the no-tape chain … is the one measured on the pre-Phase-B core"*, *"a tape LOADED but never started …"*). The new key moves the chain even OFF, as the brief predicts until js's train 3. Not re-pinned |

**Every red, listed:** the 5 record rows and the live-defaults row above (fixed, records only), and `jsRuntimeTape`'s 2
`NO_TAPE_CHAIN` rows (js's, named, not re-pinned). **A flip of `corpseBumpRestRead` moves no behaviour row, no producer
digest and no tape** in this set. It owes the `contactFidelity.test.js` defaults pin (`corpseBumpRestRead: true`) and the
`NO_TAPE_CHAIN` re-pin (js). **Flip-ready: yes, on these measurements. At the defaults it moves nothing measured**
(§ 7); its value is that the corpse weigh's chain runs on under the arms that reach it.

## 7. Movers, and the dispatches the planner should run

| workload | ON vs OFF |
|---|---|
| route survey, L40's steps 67, 95, 97, 136, 149 (`--through=end --route=full --only=…`, local) | **identical rows** once timing fields are stripped (67, 95 REFUSED; 97 SOLVED 70; 136, 149 SOLVED 172) — `survey-l40-*.txt` |
| the latch staging × 12 arms | 1 mover, the hand-over arm (§ 5) |

At the defaults no measured workload reaches the re-read: `orbitFreeAim` is OFF, and `turretSnapPricing` (ON) refuses the
chain before the kill. The re-read fires only where a walk between presses actually moves the corpse.

**Dispatches (the planner's; cloud sessions get 403):**
1. `seedling-survey.yml` on `claude/seedling-fidelity-wave-36-sz1y7h`, `--through=end --route=full`, A/B: the default arm,
   and the same with `SEEDLING_CORPSE_BUMP_REST_READ=1` (or the workflow's contact-fidelity input with every default-ON key
   plus `corpseBumpRestRead`). Expect 203 SOLVED / 37 REFUSED in both, no row moved.
2. `seedling-divergence-sweep.yml` on the branch, the L40 keyed sweep ×2 per arm with `capture_requests`:
   `keys=<the L40 leg keys at this base, derived with seedling-divergence-legs.mjs>`,
   `contact_fidelity=<the 105 default-ON keys>` vs `<the 105 + corpseBumpRestRead>`. ⚠ The input turns every unlisted key
   OFF, so each arm must list all 105. Expect no leg to move; a `crossed`↔`done` swap is run noise unless the ×2 repeat agrees.
3. `seedling-probe.yml battery=standard` on the branch (the key is OFF; the probes are byte-inertia only). Grade
   `probe-seedling-wasm-logical-links` B,R (2 FAIL) as KNOWN RED; `probe-seedling-encounter-ticks` is INFO only.

## 8. The JS arc's pins, and what it must wire

- **No `run.*` field renamed or reshaped**; no levelRun edit. The player skin is untouched.
- **New optional fields** (ON only): `perTick` on a `BotDriverV2Error` thrown by `runFire` from inside `execCorpseWeigh`
  (the error class and message are unchanged); `corpse.walkBumps` on the weigh record.
- **`jsRuntimeTape` `NO_TAPE_CHAIN`**: a new key moves it until js's train 3 lands — measured: **2 rows red at the head, green at the base** (§ 6). Name only; the JS arc re-pins with train 3.
- `SEEDLING_CORPSE_BUMP_REST_READ` is a new env read; `solverEnvChannel.js` does not exist at this base, so no
  `SOLVER_ENV_NAMES` line was owed. When CPWIT lands it needs one.

## 9. Hand-overs

- **To the hammer arc (`strikePolicyFor`, not edited):** the walk's strike policy is built when the INVENTORY holds a
  sword (`hasSword || hasGhostSword`), whatever the selected slot. Any executor that walks with Fire (or another
  non-blade) selected can get X presses the policy believes are sword strikes or dashes, and the game runs them as that
  item. Here that is a Fire bump. The measured cases: the corpse weigh's walks between presses (both latch arms that reach
  bump 2 press X on that walk). D1 makes `execCorpseWeigh` read the result rather than prevent the press. Whether the
  policy should be gated on `primaryWeapon` (a walk with Fire selected strikes nothing) is the policy owner's question.
- **To the strategy bound (LWEIGH's item 3, unchanged):** ON, the hand-over arm now reaches the 4-strategy bound at
  `pushableblock@576,560` (the four distinct orders `shove`, `weigh(448,432)`, `hold(480,560)`, `weigh(800,400)`).
  hammer's `FIFTH_ORDER` (present at this base, OFF) is the lever there.
- **To the planner:** the L40 latch arm needs `turretSnapPricing` OFF to reach this code at all, so the slice's
  workload exists only under a measurement arm. Flipping D1 is safe (§ 6), but at the defaults it moves nothing measured.

## 10. Deltas, what the brief got wrong (measured), residue

- *"`execCorpseWeigh`'s rest read says 'not yet at the presser', while `runFire`'s entity tile says 'ALREADY on
  (30,24)'"*: true, but it is not a disagreement between two rules. It is one rule asked 26 ticks apart, with a Fire press
  in between.
- *"with `orbitFreeAim` ON + `CHOOSER_PAIR` size 3"*: at this base that is not enough. It also needs `LATCH_WEIGH_FIRST`
  (the brief's D2 includes it) and `turretSnapPricing` OFF (W35's flip moved the chain's refusal to t658/t879, before the
  kill). `strategyBoundDistinct` is in LWEIGH's arm; ICEST and OPP are not needed.
- *"hammer-2: with `TURRET_APPROACH` ON the latch staging solves at t4108"*: 4108 is with `orbitFreeAim` ON; at the
  defaults it is 4142.
- *"Find why the refusal has no `perTick`"*: `BotDriverV2Error` has no fields and no one between `runFire` and
  `l40LatchSolve` adds them.
- **Residue:** M3/M4 survivors (§ 4). The slow file costs ~8 min of the slow battery (the ON = OFF row is two ~150 s
  solves). No tape, fixture pin or producer digest moved (the new witness is a new fixture outside `tapes/`).
- **Byte-inertia (OFF):** the identity block is equal at the base and the head; the producers' `--check`s exit 0.

## 11. Rows to BANK

- the witness `corpsebump2-walk-press` (1400 t, 0 px, hitless), `probe-seedling-l40latch.mjs --only=corpsebump2-walk-press`;
- `fidelityCorpseBump2.test.js` (5) and `fidelityCorpseBump2.slow.test.js` (3);
- the D2 table (§ 5) as hammer-2's before/after.
