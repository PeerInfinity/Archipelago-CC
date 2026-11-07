# Seedling hammer-phase 376-BOMB — L40 leg 376's bomb phase solved hitless (`BOMB_PHASE_WAIT`, OFF)

## 1. Start, head, branch

| | |
|---|---|
| Session | `seedling-hammer-376-bomb` (planner `seedling-hammer-phase-planning-3`), cloud, Opus. ⚖ queued by the user 2026-11-07 ("Yes, hammer slice (Recommended)" → "Launch it (Recommended)") |
| Start SHA | `6473024aa824efe5c532d24e9f1bccb3942df205` (origin/main, "train: seedling-gen-goal-loot-lift") — the brief's floor `534cf9b6c3` is its parent's parent |
| Head | this report is the last commit on the branch. Code: `1046f5cd` (I), `aac37d61` (D), `004d9615` (I2, the shipped design), `83be8b07` (D2) |
| Branch | `claude/seedling-hammer-376-bomb-0jkuqe` (the harness's designated branch) |
| Switch | `solverBot.BOMB_PHASE_WAIT` **OFF** — `SEEDLING_BOMB_PHASE_WAIT=1`, `?seedlingSolverEnv=SEEDLING_BOMB_PHASE_WAIT=1`, `withBombPhaseWait(true, …)`; in `SOLVER_ENV_NAMES` |
| Evidence | `CC/docs/cloud-reports/seedling-hammer-376-bomb-evidence/` (its README names every file) |
| Scope messages | none arrived mid-run |
| Environment | bootstrap `--seedling` done; node v22.23.4; 4 cores. The container restarted once mid-run (the dev server was gone); nothing committed was lost |

## 2. The answer first

**The one thing to know first: the bomb that decides phase 23 lands on a STOP, not on a walk.** The walk to a rock's break
stance (200,136) rests at t1410, the break presses at t1411 and stands its 20 ticks, and `bombpusher@112,128#13` —
launched at t1400 at the walking player — lands at (207,141) on t1432, 9.4 px from the stance. By the time the next walk
probes (t1430) no input escapes it (the forced-hit rung proves the hit at depth 1). No probe priced a bomb that lands
after a walk stops. The fix prices that stop, on the walk that is driven, and lets TIME wait out the bomb's phase.

| question | answer (measured) |
|---|---|
| Where do the 8450 units go? | **7442 (88%) the forced-hit rung's forks** (`crusher-fork`), 779 the kill rung's chaser arm on `bob@272,112` (which cannot remove a bomb), ~230 the rest. Dashless 2975 (#13 at t1430: forced-hit 2596 units), full 5475 (the forced hit at t1430 is billed, then #17 at the goal on t1612: kill 237, forced-hit 2250, "not proven — over the advance budget") |
| Is the explosion modelled exactly? | **Yes, no model gap found.** `bombPusher.js` is a transcription witnessed on the game to the bit (BW's 1665-tick witness, KNOCKBACK376's 1259 knockback rows). The leg's refusal is the solver's: nothing prices the bombs that land after a walk stops |
| Is there a real hitless plan? | **Yes.** Wait 4 still ticks at (216.1,152.1) on t1390 before walking to the rock; #13 is then aimed elsewhere, and the leg solves 1747 t hitless (0 hits, 0 deaths, row for row on a fresh run) |
| 376 at seams 5243/5333 ON | **SOLVED hitless at the page's first 640** (382 units; OFF trips the 640 and the 2560, and refuses by name uncapped at 8450) |
| The phase census (45 phases, 640) | SOLVED **33 → 37**, hitless **22 → 25**, no solve lost, no hit added; where the arm keeps nothing the plan is OFF's (digests) |
| OFF | byte-identical: the 45-phase census = main row for row (full refusal text), the identity block = the published values, the producer battery green |

## 3. W0 — the phase, measured (main `6473024aa8`)

**The request.** KNOCKBACK376's committed witness `rockgone-leg376-play.json.gz` carries the page's own captured request
(seam 5271, p4g); its `request` field is this slice's fixture (`fixtures/hammer-376-bomb/leg376-l40-request.json.gz`,
1.7 KB). A seam is staged with `atSeamTime`. The leg's answer is a function of `seam mod 45` (the hammer phase): **5243
and 5333 are both phase 23** and answer byte-identically at 640, 2560 and uncapped (`w0/main-s*.row`).

**At main, all 45 phases at 640** (`w0/phase-census-main-640.tsv`): 33 SOLVED (22 hitless; 11 with 1–2 planned bomb
hits), 12 REFUSED:

| phases | class |
|---|---|
| 23, 29, 39, 0 | the deadline (640) — uncapped, the combat ladder EXHAUSTED on a bomb at a stop (23: #13 / #17) |
| 24–28 | the latched hold's MOVING_WAIT: *"no pacing is clean (256 tried)"* (the brief's quoted text, the hold of `wandlock@176,80` at (167.6,135.8)) — a pacing that does not return to the stance bit-exact, or a spinner on it |
| 35 | the press kill on `spinner@192,160`: the player dies to bomb #15 at t1524 |
| 31, 44 | the press kill: "no step out" (spinners, no bomb) |

**Phase 23's chain** (`w0/chain-5333-units.txt`, L40-CENSUS's `chain.mjs` on this fixture): break `breakablerock@176,128`
(t1112), press-kill `spinner@192,128` (t1112) and `spinner@192,160` (t1310), the walk to (200,136) (t1390), then at t1430
the hold stance walk to (168,136) meets #13 → avoid / time / bait / kill / narrow / forced-hit. The tick rows
(`w0/keys-5333-t1385-1430.txt`): the walk rests at t1410, presses at t1411, stands to t1430; #13 spawns at t1400 at
(136,152) and steps 30 updates onto its aim.

**The arm at the climb is too late** (measured, design A): from (199.6,135.6) at t1430 the still wait is hit on tick 1
and every pacing on paced tick 2.

## 4. M — the designs, measured over all 45 phases

| design | phase 23 | 45-phase census (640) | verdict |
|---|---|---|---|
| A — TIME's bomb arm in the ladder only (before forced-hit), re-probing from the climb | refused (blast 2 ticks out) | — | too late: the blast is committed |
| A′ — + a paced hold's tail keeps its first 12 ticks of bombs | refused (the t1390 walk carries no hold tail) | — | the wrong stop |
| B — a 31-tick arrival tail (`BOMB.tMax` + 1) as EVERY walk's own `stand` | SOLVED hitless (923 units with the arm after BAIT/KILL; 375 once moved to sit right after TIME) | SOLVED 33 → 32, hitless 22 → 24, **6 lost** (2–6, 34) | not a superset: a tail the arm cannot clear makes the walk climb where OFF walked |
| C — the walk probes as OFF; only a clean probe asks the tail; a refusal rewinds | SOLVED hitless (371) | SOLVED 33 → 38, hitless 22 → 24, none lost, OFF's keys where nothing kept | **the ON producer battery refused `plan-seedling-l40button-witness`** (L41's arrival): the tail fired where the next verb walks on, and it probed the undashed preview while the drive walks a certified dash (30(c)) |
| **D (shipped)** — only the frontier's break stance names its still ticks; tail = those + 12 with an exact escape test; previewed as driven; a kept wait re-plans with the tail as its stand, undone if the re-planned stop still meets a bomb | **SOLVED hitless (382)** | **SOLVED 33 → 37, hitless 22 → 25, none lost, no hit added**, OFF's keys where nothing kept | the producer `l40button` byte-identical ON |

Scratch measurements behind the design numbers:
- **Escape reach from rest** (`tools/escape.mjs`, the run's preview stepper on L40): `up+left` 1.1 3.1 4.9 6.4 7.7 8.8 9.9
  10.9 11.8 12.5 13.8 **15.0** px at k = 1…12 (`up` 13.9 at 12; `left` pinned at 5.5). The blast disc is 15 px
  (`int(24 × 0.65)`), so 12 ticks is the horizon; `escapeReach` is that table.
- **The break's still ticks**: aim (≤1) + press + `WAIT_AFTER_PRESS_TICKS` 20 = 22.
- **Cost of an ask where nothing is kept**: +22 to +151 work units (phase 15: 362 → 384; phase 34: 375 → 526), never a key.
- **Design C's l40button failure, measured**: at t1179 the undashed tail met `#8` at (203,137), 3.8 px from the stance;
  the game-witnessed OFF drive (damage on, 0 hits over 1666 observations) dashes and arrives elsewhere.

## 5. I — the switch, the rows, the mutants, the radius

**The code** (`solverBot.js` only, plus one line of `solverEnvChannel.js`). Functions and sites touched:
- `BOMB_PHASE_WAIT` / `BOMB_PHASE_WAIT_DEFAULT` / `BOMB_PHASE_WAIT_COUNTS` / `withBombPhaseWait` (beside `PACE`):
  `maxStill` 46 (one bomb period), `paceTicks` 92, `escapeReach` (the table above).
- `bombArrivalTail(run, {crossTo, standTicks})`, `bombsOnlyDanger(d, sample)` (beside `withoutSources`).
- `previewWalk`: an opt-in `standBombsOnly` (a number) stamping dwell samples `bombsOnly` / `escape`; `standTailOpts` maps
  `stand.bombsOnly`; `probeSamples` reads a `bombsOnly` sample through `bombsOnlyDanger`. OFF none of these is passed.
- `solveSegmentUnder`: `bombPhaseWait` (a closure beside `stagedChaserHunt`); the ladder's bomb arm right after TIME
  (`rungGate('time', 'time:bomb-phase')` + `progressRung('time')`, so `strategySwitch.test.js`'s gate=count row holds);
  `climbLadderUnder`'s `bombStandTicks`; `walkToUnder`'s `bombStandTicks`, the per-attempt `stand` reset, `cleanFirst`,
  and the stop's hook after the strike policy; the frontier's break stance call passes `bombStandTicks: 2 + wait`.
- Every new branch is behind `BOMB_PHASE_WAIT.enabled`. No `levelRun.js`, `bombPusher` model, `dangerMap.js`, driver,
  `flashPanel`, `strategySwitch.js`, fidelity or generator file is edited.

**The arm** (`bombPhaseWait`): on the LIVE run, still ticks one at a time up to 46 (the run's own ledger bills any hit —
the wait is the model's), re-probing the same corridor with the tail after each; then, from rest, `planPacedWait`'s
certified cycles (MOVING_WAIT's alphabet), re-probed at each cycle end; anything else is rewound (`rewind.to`). Each
candidate asks `fineDeadlineReached('time')`, so the work clock bounds it.

**Rows** (`hammerBombPhase.test.js` 7 fast; `hammerBombPhase.train.test.js` 3 train):
- the switch (OFF, env, channel name); the bounds (46, `escapeReach` monotone to 15 at k = 12);
- the tail (OFF null; ON 22 + 12 = 34 bombs-only ticks; null without a stand or across a door);
- `bombsOnlyDanger` (bombs only; the escape test on #13's real geometry: k = 2 hit, k = 5 escaped; on the stance a hit
  through k = 12); the `bombsOnly` / `escape` stamps;
- train: OFF 5333 trips at 640 exactly as main (642, `crusher-fork`); ON 5333 and 5243 SOLVED ≤ 640, fresh replay 0
  mismatches / 0 hits / 0 deaths, the kept wait `[1390, still, 4, 216.1, 152.1]`; phase 15 asked, nothing kept, OFF's keys.

**Mutants** (predicted, then copy + restore from the commit; `i/mutants-final.txt`):

| mutant | predicted | measured |
|---|---|---|
| M1′ the frontier passes no `bombStandTicks` | train ON row red | ✓ |
| M2′ `bombsOnlyDanger` returns its input | the two bombs-only fast rows red | ✓ |
| M3′ the stop's hook disabled | train ON row red | ✓ |
| M4′ no rewind after the still arm | the control row red | ✓ (the rewind's own `fail` fires) |
| M5′ no `bombsOnly` stamp | the marker row red | ✓ |
| M6′ every post-stand blast counts | the escape row red | ✓ |

(The first cut's set, `i/mutants.txt`, found one hole — the bombs-only cut was unpinned by the leg rows — and its row was
added.)

**The ON radius, by mover class.** Only L40 holds a BombPusher (`bombArrivalTail` and the arm's every-source-a-bomb test
are null elsewhere), so the radius is L40's legs.
- Leg 376, all 45 phases (`m/plan-digests-final-off-vs-on.txt`): **new solves** 23 (hitless), 29 (hitless), 39
  (hitless), 0 (1 hit); **changed plans, same hits** 37/38 (2 hits, 1876 → 1752 t), 40–43 (hitless, 1880 t → a new
  plan), 17–22 (hitless, a new plan, 564 → 382 units); **a wait kept in a pass the answer did not take, OFF's keys**
  32, 36; **kept, still refused** 24–28 (the hold's pacing, later); **asked, nothing kept, OFF's keys** 2–16, 34, 35
  (work +22…+151);
  **untouched** 1, 30, 31, 33, 44; **still refused** 24–28 (the hold's pacing), 31/44 (spinners), 35 (the press kill's
  bomb death).
- The six producer `--check`s and the identity block's rows do not move ON's way (the identity block runs at the
  defaults; the ON producer battery is 0 red).
- The producer battery ON: 97 run, 0 red (incl. `plan-seedling-l40button-witness`, L41's arrival, byte-identical).
- Not measured here: the other 63 captured L40 requests (the 37 MB capture is not committed and a page re-capture was not
  run in this session) — that is the keyed ON sweep below.

**Game witness.** Not run: the arrival clock cannot be steered on the page (the sweep has no seam control; past runs
cluster at seams ≈5294–5338, where ~12 of 45 phases are ones the arm changes). The sweep in § 7 is the witness: an ON
run of 376 landing on phase 23/29/39/0/36–43 plays a kept wait on the game.

## 6. D — gates

| gate | result |
|---|---|
| bounded vitest by path | `hammerBombPhase.test.js` 7/7, `strategySwitch.test.js` 22/22, `solverEnvChannel.test.js` 11/11 |
| train (local, by path) | `hammerBombPhase.train.test.js` 3/3 (154 s) |
| hammer `.slow` my change reaches (local, by path, defaults) | `hammerBk2Combat`, `hammerDashShape`, `hammerEscapeExact`, `hammerEscapeGenerated`: **4 files, 8/8** (`d/slow-local.txt`) |
| `.train` my change reaches (local, by path, defaults) | `hammerChooserPair`, `hammerGhostKillRung`, `hammerIceTurretStatic`, `hammerLatchWeigh`, `hammerPocketBurn`, `hammerSouthDoor`, `hammerSpinnerPress`, `hammerTurretApproach`, `fidelityL40Bk2`, `fidelityL40Latch`, `hammerBombPhase`: **11 files, 36/36** (`d/train-local.txt`) |
| `ci-producer-checks --jobs=4` defaults | **97 run, 0 red**, 1 skipped (`r7-ends-meet`, the standard browser-arm skip) (`d/producers-off.txt`) |
| `ci-producer-checks --jobs=4` switch ON | **97 run, 0 red**, 1 skipped (`d/producers-on.txt`). The first cut's ON battery was red on `plan-seedling-l40button-witness` (design C, § 4) |
| identity block (`identity-block.sh .`) | maze `57e07d21`, acceptance `abb206c8`, c3 `d356fc8a`, c6 `483c791e`, c4 `e83b066d`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57` / `47116405` / `4d3bbf17`, levels `e28c1e5d` / `fb1a59e5`, generated set OK, the six producer `--check`s exit 0 (`d/identity-head.txt`) — the published values |
| `census-seedling-solver-surface` | `--write` (count drifts on existing rows only, no new row to classify) → `--check` GREEN 371 rows |
| `census-seedling-constants --check` | PASS (7072 literals, 0 new) |
| `generate-procgen-reference` → `check-procgen-reference` | regenerated (word counts) → ALL CHECKS PASSED |
| `generate-docs-index.mjs --check` | OK |
| `contentIdentity`, `entityBlocks`, `boxLock` (+ `boxLockCommit`) — the repo-wide document gates (a fixture naming an entity family) | 4 files, 94/94 |
| `derive-seedling-tick0 --check` | PASS |
| `check-seedling-wasm-ship` (headless) | ALL PASS |
| JSUT (CI) | run **42393675818** at `83be8b07` (the last code head): unfiltered vitest **25803 passed / 0 failed**, slow battery **439/439** (`ci-summary.mjs`). Also `aac37d61` (run 42389951143): 25802 / 0, 439/439 |

## 7. What the harvest A/B should expect, and the ON dispatch

- **OFF: no movers** anywhere (every new branch is behind the switch; measured byte-identical on the 45-phase census, the
  identity block and the producers).
- **ON: L40 only.** Expected on leg 376: `failed` → `done` hitless when its arrival lands on phases 23 / 29 / 39 (seams
  ≡ 23, 29, 39 mod 45 — e.g. 5333, 5294, 5304), `done` with fewer ticks on 17–22 / 36–43; never a new hit. Other L40 legs
  move only where a break stance walk's stop meets a bomb.
- **The ON sweep to dispatch** (`seedling-divergence-sweep.yml` on this branch): `keys=<KNOCKBACK376's l40-keys.txt>`
  (the 64 L40 keys, `|`-separated), `solver_env=SEEDLING_BOMB_PHASE_WAIT=1`, `leg_budget_ms=400000`,
  `capture_requests=true`, ×2 per arm (OFF = the same without `solver_env`); then the full sweep ×2 per arm with the same
  `solver_env`. Plus the train tier (`-f train=true`) and `seedling-probe.yml battery=standard` on the branch.

## 8. What the brief got wrong (measured)

- *"bombpusher@112,128's explosion at the goal"* — the goal's #17 (t1612) is the second refusal of the full pass. The
  phase is decided by #13 at t1432 on the break stance (200,136); the full pass only reaches #17 after billing #13.
- *"the forced-hit rung spending ~2600 units"* — per climb; there are three climbs, **7442 units** in all.
- *"a hold stance outside the 256 px reach / a pacing the MOVING_WAIT search misses"* — the quoted MOVING_WAIT text is
  phases 24–28's hold, a different wall; phase 23's is a stop, and its answer is a 4-tick wait before the walk.
- *"5313/5314 … 5243 and 5333"* — 5313/5314 are phase 3/4 (they solve here with KNOCKBACK's one planned hit, and the arm
  leaves them OFF's plan); 5243 and 5333 are one phase (23).
- The start was `6473024aa8`, newer than the brief's floor `534cf9b6c3`; leg 376's key is unchanged.

## 9. Residue and hand-overs

- **Not built:** phases 24–28 (the latched hold's pacing finds no cycle that returns to the stance bit-exact beside the
  rock, or a spinner meets it) — a MOVING_WAIT question (fidelity's `contactFidelity.movingWait` is the switch; its
  `planPacedWait` lives in `solverBot.js`): a hand-over candidate. Phase 35 (the press kill's standing wait dies to a bomb)
  is `PRESS_KILL_BOMBS`'s question (OFF by the user's ruling). Phases 31/44 are spinner press kills, not bombs.
- **Not measured:** the other 63 L40 captured requests (no capture this session); the game witness (no seam control).
- **For fidelity:** nothing to hand over — no model gap was found.
- **Tooling:** the evidence `tools/` are scratch instruments (one push-hook capture, as L40-CENSUS's `chain.mjs`); never
  loaded by the app.
