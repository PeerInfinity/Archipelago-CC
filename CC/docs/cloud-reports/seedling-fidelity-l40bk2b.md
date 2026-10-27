# Seedling fidelity L40BK2B — L40 Boss Key 2 past the latch: `bobsoldier@880,832` in its notch. The orbit kill steers to a point the player can stand on (`orbitFreeAim`), and the strategy bound counts distinct applications (`strategyBoundDistinct`) — both OFF

| | |
|---|---|
| Session | `seedling-fidelity-l40bk2b` (planner `seedling-fidelity-planning-15`, wave 33), cloud, Opus |
| Start SHA | `6f5916203e` (main, 92 default-ON keys; the designated branch already sat there; not rebased) |
| Code head | `586dc4e4`; docs `469b13dc`; this report and the evidence are the commit after it |
| Harness branch | `claude/seedling-l40bk2b-chain-xll9xi` (nothing pushed elsewhere) |
| Ports | 9751 (this tree), 9752 (a pristine base worktree, W0), 9753 (the ON worktree: both literals flipped, for the probes) |
| Verdicts | **W0 PASS** (both arms measured) · **D1 PASS behind `orbitFreeAim`** (game-witnessed at 0 px, three witnesses) · **D2 PASS behind `strategyBoundDistinct`**, then **STOP**: the next gap, `iceturret@472,400`, is the hammer arc's · **Movers: STOP for a licence** (0 survey rows, 0 sweep verdicts; one bounded mover, L40LATCH's latch orbit, game-witnessed ON) |
| Evidence | `CC/docs/cloud-reports/seedling-fidelity-l40bk2b-evidence/` (instruments under `tools/`) |

## The one thing to know first

**On the OPP arm, the BobSoldier link is fixed, and the chain past it runs into two links that belong to the hammer arc.**
- The OPP arm is hammer's `OPPORTUNISTIC_STRIKE` ON, node only.
- The fix: the orbit kill's aims are projected onto free floor, and the strategy bound counts distinct obstacles.
- With OPP and both keys ON, leg 853 kills `bobsoldier@880,832` hitless, burns the tree, holds the latch, and stops at
  `iceturret@472,400` (the static arm).
- Across the seam census (853/854, ±3), it does so on **4 of 14 seams**: exactly the seams where the press kill killed BOTH
  x≈744 bobs.
- **On the other 10, one or both x≈744 bobs are alive**, and the burn stance's ladder stops with the chooser silent. That is the
  user-queued chooser pair slice (hand-over below, with stagings and ticks).

At the shipped defaults nothing moves: the legs die first in hammer's region, as the brief said.

## W0 — the base, both arms (PASS)

| row | command | result |
|---|---|---|
| base | the designated branch at `6f5916203e`; `session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9752 bash scripts/procgen/identity-block.sh .` in a pristine detached worktree of the base, venv active (`identity-w0.txt`) | maze `57e07d21`, acceptance `cf54cdf7`, c3 `31dc4572`, c6 `40d0a4c4`, c4 `c9bdd11e`, ENEMY `87e86da9`, guard `a6d18d49`, AREA `02b22525`, killgate `7c15ed57`/`47116405`/`4d3bbf17`, levels `e28c1e5d`/`fb1a59e5`, generated set OK |
| six `--check`s | in the block | battery `7486f32e` · d2-chain `93f75467` · l18 `88e33db7` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `be9c19c8`, **all exit 0** |
| reference | in the block | 4 DIFFER (registry/capabilities and their two markdown regions): the container's environmental drift. The same 4 appear in this tree, and they are left as committed |
| surface / constants / entities / profile | each `--check` (`censuses.txt`) | GREEN **357** · PASS **6,969** · PASS **566** · PASS **138** |
| roster | `fixtures/tapes/index.json` | **290** |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` (`tape-runner-pairs-base.txt`) | **637**, md5 **`9318088a8937dcb042aaa107bab99f42`** |
| bounded vitest BEFORE | 188 files (`vitest-files.txt`: the brief's list — no `apReportBosses.test.js` exists — L40LATCH's 131, and every test naming `orbitKillPolicy`/`ORBIT_KILL`/`orbitKillChaser`/`MAX_STRATEGIES_PER_GOAL`/`strategies for one goal`/`chaserOrbitKill`/`CONTACT_FIDELITY_KEYS`, plus the L4 window rows, the surface/constants census tests and the press-kill chaser/guard rows), base worktree, `--maxWorkers=3` (`rows-before.txt`) | **5,918 / 5,930**; 2 red, both the worktree's environmental registry drift (`loopBlockBuilder` capability matrix, `generated` `--check`) |

**The legs.** Re-derived at the base (`seedling-divergence-legs.mjs --presets=seedling_playthrough --blocks`):
- 853 = `level_40__r32c36 <- in_L39_144_0 ~> level_40__r23c29 -> location:Level 040 - Boss Key 2`;
- 854 = the same `<- in_L43_176_464`.

Both were captured on the page at the defaults (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver
--capture-requests`, p4g, seams 5152 / 5155; `w0-sweep.jsonl`; the capture itself is ~2 MB and not committed). They were
replayed in node (`tools/rep.mjs`, the worker's own `solveAnytime` dispatch):

| arm | 853 request 1 | 854 request 1 |
|---|---|---|
| **shipped** (`w0-rep-*-shipped*.txt`) | burn stance: EXHAUSTED on `chaser:bob@736,752`; the chooser names no body (the x≈744 pair) | burn stance: EXHAUSTED on `chaser:bob@736,800`; the chooser silent |
| **OPP ON** (hammer's three code files from `claude/seedling-hammer-opportunistic-strike-z1z8s2` applied to this base in a scratch worktree, `SEEDLING_OPPORTUNISTIC_STRIKE=1`; `w0-rep-*-opp*.txt`) | both x≈744 bobs die in the press kill. The burn stance's ladder then stops on **`bobsoldier@880,832`'s sword**. The chooser names it, the chaser arm finds no stance (7 reachable cells, all outlived or hit), and **the orbit arm fails all 20 candidates**: ccw "not removed inside the 420-tick bound", cw "hit at orbit tick 180 (sword)" | the burn stance on `bobsoldier@880,832`, but with both x≈744 bobs alive: the chooser silent |

Request 0 of both legs stops at the anytime deadline (work 642), the same on every arm.

**Survey step 67** (`s67-*.txt`, node, step 67's boot, goal `chest@880,816`, with forks):
- shipped: dies at t780 in the press kill (hits t660/749/780 by `bob@736,752`);
- OPP: `bob@736,752` dies at t759 and `spinner@880,848` at t771, then the solve refuses at the chest stance on
  `bobsoldier@880,832`, with `bob@736,800` alive at 2/3 hits 47 px off and the chooser silent.

## D1 — the BobSoldier in its notch (PASS behind `orbitFreeAim`, OFF)

**The room** (`tools/map.mjs` on leg 853's state when the orbit arm is first asked: t888, player (744.3,791.7), the BobSoldier
at (888,840)):
- `bobsoldier@880,832` stands in a **one-tile notch** (x 880–896, y 832–848). The notch is the only way into the tree/latch
  pocket (rows y 768–816).
- The notch sits above a **one-tile corridor** (y 848–864, x 736–896), which the **x 736 shaft** feeds from the north.
- The blade rests pointing DOWN at the start (`swordSpin[0] = 3π/2`), across the corridor.

**What the shipped orbit does there** (`tools/orbittrace.mjs`). `orbitKillPolicy` steers straight (`chooseHeld`) at a point on
a circle round the body:
- ccw: the point is in the shaft wall; the player stands pinned at (749.7, 826.2) for the whole 420-tick bound;
- cw: the player reaches the corridor and lands one hit (t150). The policy's i-frame back-off point (34 px along the
  player→body line) is then in the corridor's floor, so the player cannot back off, and the spin stops pointing at it: hit
  at orbit tick 179.

**What does work.** Each aim is moved onto free floor:
- a stand-off kite (hold a radius on the approach line) stalemates: the body wedges in the notch mouth at ~21 px, outside the
  sword's reach (`tools/kite.mjs`);
- the projected orbit kills hitless on **14 of 20** candidates from the corridor, and on **6 of 20** from the hook state
  itself (`tools/porbit.mjs`).

**The change** (`solverBot.orbitFreeAim`, used by `orbitKillPolicy` only with the key ON):
- the aim at (angle, radius) is replaced by the nearest **free** point: the player box at the point and the straight sweep
  from the player to it (1 px steps) clear of Solids under the run's live geometry;
- the search runs `ORBIT_FREE_AIM` = 10° steps out to 180° each side, at radius offsets 0 / +4 / −4 / +8;
- where none is in sight, the aim is the planner's first waypoint toward the body (`planWaypoints`);
- the rest of the policy (spin, blade, i-frames, the one strike policy) is L40LATCH's.

OFF it is byte-identical: `at` is the old lambda.

**The staging.** `fixtures/l40bk2b-witness/corridor-boot.json`:
- survey step 67's boot moved into the corridor west of the notch (player centre (840,856));
- both corridor spinners banked: `spinner@880,848` {40,16} (hammer's press kill) and `spinner@816,848` {40,15}, a billiard that
  starts in the corridor (on leg 853 it had bounced north by the fight);
- the chest, the tree and the BobSoldier stand.

It is the **plain** world. The AP leg's records make `chest@880,816` an `apitem`, which is not Solid: the first witness attempt
built on leg 853's own staging diverged at t29 for exactly that reason (`tools/lsdiff.mjs`, `tools/variant.mjs`), and the probe
page plays the plain world.

**The witnesses** (p4g `seedling_bot_ap_p4g`, headless logic-only, port 9751; `probe-seedling-l40bk2b.mjs --record`):

| witness | the tape | game = model at 0 px | game checks |
|---|---|---|---|
| `l40bk2b-orbit-plain` | the shipped orbit's candidate `r 22 cw far 110°` from the staging (`orbitFreeAim` OFF), to its hit and 30 ticks on | **PASS, 85 / 85**, hits equal on every tick (t55, t75 by the sword) | the blade lands at t55 |
| `l40bk2b-orbit-free` | the **solver's own** ticks for the chest with `orbitFreeAim` ON, cut 6 ticks after the BobSoldier's removal (the walk on enters the chest's proximity hazard, a plain-world artifact) | **PASS, 131 / 131**, no hits | never hit; the BobSoldier killed and removed from **t125**, gone for good |
| `l40bk2b-latch-free` | L40LATCH's latch staging, the solver's own ticks for Boss Key 2 with `orbitFreeAim` ON (see Movers) | **PASS, 351 / 351**, no hits | never hit; the BobSoldier gone from t137 |

OFF, the model parts from the game on 0 ticks for all three (D1 is solver-only). Re-run `--from-fixture`: ALL CHECKS PASSED
(`probe-fixtures.txt`).

**Solver, from the staging** (`fidelityL40Bk2b.test.js`, ~2 s each):
- OFF: *"orbit arm: no orbit kill of bobsoldier@880,832 is hitless (20 fork(s) of 20)"*.
- ON: the orbit arm kills; the solve's ticks equal the recorded tape key for key, and the BobSoldier is removed at t125.

**Rows** (`fidelityL40Bk2b.test.js`, 16; all fast):
- the key ships OFF;
- the projection table;
- the staging banks what it says;
- W0's recording and its model at 0 px (hits t55/t75);
- the plain tape = the shipped orbit's own keys;
- OFF the orbit arm's refusal;
- the free recording and its model at 0 px (ON and OFF);
- ON the solve's ticks = the tape;
- the latch-free recording and its model;
- D2's four rows.

### Mutants (predicted first; copy + edit + run + restore; `tools/mutants.py`, `mutants.txt`)

| | mutant | predicted red | measured |
|---|---|---|---|
| M1 | `orbitFreeAim` returns the raw point | the ON key-for-key row | **exactly that** |
| M2 | the clear test checks only the endpoint box, not the sweep | the ON key-for-key row | **no red** — prediction wrong: the straight sweep is not exercised from the committed staging |
| M3 | the planner fallback replaced by the raw point | none (the body is in sight from the staging) | **no red**, as predicted |
| M4 | the D2 ON branch counts every application | both D2 ON rows | **exactly those 2** |
| M5 | the D2 backstop removed | the backstop row | **exactly that** |

M2 and M3 on leg 853 (OPP arm, node): each changes the plan (t1376 against t1392, work 2124 against 2226) and reaches the same
ice-turret refusal. **The sweep and the planner fallback are what the approach from the x 736 shaft uses, and no committed row
pins them** (residue: an OPP-free staging of that approach).

## D2 — the rest of the chain (PASS behind `strategyBoundDistinct`, OFF; then STOP at the hammer arc's static arm)

**Measured on leg 853, OPP + D1 ON** (`d1-853-oppON.txt`): past the BobSoldier the goal stops on the strategy bound:
*"applied 4 strategies for one goal [shove(pushableblockfire@576,576), hold(wandlock@448,432), burn(burnabletree@872,784),
hold(wandlock@448,432)] and the corridor still does not plan"*.
- The fifth application is the latch's hold of `wandlock@480,560`, at tick 1275 with the player in the pocket at (887.8,824.6).
  It is the goal's fourth DISTINCT obstacle.
- `MAX_STRATEGIES_PER_GOAL`'s own comment says it counts distinct obstacles ("a goal that has cleared four distinct obstacles"),
  and the check counted every application.
- A scratch cap of 8 (`tools/`, not landed) let the chain run on.

**The change:**
- `strategyBoundReached(applied)`: OFF, `applied.length >= 4`, as before;
- ON: `new Set(applied).size >= 4 || applied.length >= STRATEGY_BOUND_TOTAL` (8). The total is the loop's backstop: a goal
  that repeats one application without end still stops;
- the refusal text is unchanged (`solveProgress`'s family table reads it out of the source).

**With OPP, D1 and D2 ON** (`d2-853-oppON.txt`): 853 runs on through the latch and refuses on **`iceturret@472,400`** on the walk
to `wandlock@448,432`'s hold stance. That is a static "Enemy" the kill rung has no arm for: L40LATCH's hand-over 2, the
hammer arc's static arm (`STATIC_SWORD_ARM`, `KILL_ARM_POLICY.Turret`). **STOP.**

## The movers: before → after, and the dispatches to confirm

**Route survey, full** (local, `survey-seedling-route.mjs --through=end --route=full`, two shards per arm; arm A = the 92
defaults, arm B = A + both keys by env; `survey-full-{A,B}.rows.txt`, md5 equal `92f37983…`):
- **240 rows each, SOLVED 201 / REFUSED 39 each, 0 rows differ** (every field but `ms`);
- step 67 dies at t780 in the press kill both ways (the brief's).

The local derivation has 240 steps where CI's baseline `40536691165` has 235: compare by (level, goal, boot).

**The OPP arm** (node, the OPP scratch worktree; `survey-opp*.json`, `seam-*.txt`):

| workload | OPP alone | OPP + both keys |
|---|---|---|
| survey step 67 | chest stance on `bobsoldier@880,832`, `bob@736,800` alive, the chooser silent | **the same** |
| survey step 95 | the same shape | **the same** |
| 853 req 1, seam 5149…5155 | 7 / 7 at the burn stance (x≈744 bobs or the BobSoldier) | **2 / 7 on to `iceturret@472,400`** (d−1, d0); 5 / 7 at the burn stance, each with one or both x≈744 bobs alive |
| 854 req 1, seam 5152…5158 | 7 / 7 at the burn stance on the BobSoldier | **2 / 7 on to `iceturret@472,400`** (d−3, d−2); 5 / 7 with x≈744 bobs alive |

Every seam where both x≈744 bobs died moves on. Every seam where one lived does not, because the chooser is silent there and
the orbit arm is never asked.

**Keyed sweep ×2 per arm** (local, p4g, `--contact-fidelity` arm A (92) / arm B (94); the 52 legs in or into L40, re-derived at
the base and equal to L40LATCH's 52 keys, `l40-leg-keys.txt`; `sweep-{A1,A2,B1,B2}.jsonl`, `sweep-summary.txt`):

| run | done | failed | timeout |
|---|---|---|---|
| A1 | 38 | 11 | 3 |
| A2 | 38 | 11 | 3 |
| B1 | 38 | 10 | 4 |
| B2 | 39 | 11 | 2 |

- Three keys flip: 356 (`<- in_L41_0_160 -> Totem Part 64,144`), 853 and 854. All three flip inside arm A too.
- Each was decided on its captured request replayed in node under each arm (`movers-replay.txt`):
  - B2 356 (seam 6125): SOLVED both, byte for byte;
  - B2 853 (5961), B2 854 (5427), B1 854 (5409): A = B byte for byte.
- **0 verdicts by key, 0 intended movers.**

**Bounded vitest, both keys ON** (env, 189 files; `rows-on.txt`, `rows-after-vs-on.txt`): **6,191 / 6,207**. Against AFTER:
- **one real mover:** `fidelityL40Latch` "candidate 1 … kills bobsoldier@880,832 by t184 and is never hit". With the projection
  the open latch pocket's candidates change: OFF 8 of 20 are hitless, ON 3 of 20 (`latch-candidates-off-on.txt`), and
  candidate 0 kills first, at t137;
- env artifacts (the live set differs from the defaults under env):
  - `contactFidelity` "the shipped defaults: all three ON";
  - `dashOnlyWindow` ×2 and `dashShape` ×1 request-key-list rows: the service stamps a request whose switch set is off-default.

**The L4 margin.** `jsRuntimeSolverShouldStop`, `dashOnlyWindow` and `dashShape`'s window rows all stay **green ON**: neither key
adds work on L4's dashless path.

**Slow suites, both keys ON** (`slow-on.txt`): **7 / 8**. The one red is the predicted mover's slow twin, L40LATCH "both ON: the
solve's refused prefix is the recorded tape".
- The ON latch solve reaches the same x≈744 refusal (`bob@736,800`) over 351 ticks instead of 271, never hit.
- **It is game-witnessed at 0 px** (`l40bk2b-latch-free`), so the flip needs no model-only plan licensed.
- `fidelityL40Bk2.slow` (the pocket chain) and `fidelityL32ArenaPrefix.slow` (5) are green ON.

**Probes standard, both keys ON** (both literals flipped in a worktree at the code head, served on 9753; `probes-on.txt`):
- **11 / 11 ALL CHECKS PASSED**;
- logical-links B ended on its wall-clock budget at Sphere 5.6 (`level_49`, 16/48) on this loaded box. That is not a verdict;
  the CI dispatch places it.

**The fixture probes** (`probe-fixtures.txt`):
- `probe-seedling-l40bk2.mjs --from-fixture`: 0 px over 2,650 / 2,647 ticks at the defaults and ON;
- `probe-seedling-l40latch.mjs --from-fixture`: 160 + 271 ticks, both arms;
- `probe-seedling-l40bk2b.mjs --from-fixture`: all three witnesses.

**Please run, on `claude/seedling-l40bk2b-chain-xll9xi`** (the head after this report):
1. **Survey full:** `seedling-survey.yml` with `through=end route=full`. Arm A: `contact_fidelity=` the 92 keys of
   `evidence/arm-A.txt`; arm B: the 94 of `evidence/arm-B.txt`. Compare against `40536691165` by (level, goal, boot). Expected:
   0 rows move.
2. **Keyed sweep ×2:** `seedling-divergence-sweep.yml` with:
   - `keys=` the 52 keys of `evidence/l40-leg-keys.txt` (`|`-separated);
   - `capture_requests=true`;
   - arms A/B as above;
   - `seam_census=-3..3` on 853/854 and 356.

   Expected: 0 verdicts by key.
3. **Probes:** `seedling-probe.yml battery=standard` with arm B. Then, on the same branch,
   `probe-seedling-l40bk2b.mjs --from-fixture`, `probe-seedling-l40latch.mjs --from-fixture` and
   `probe-seedling-l40bk2.mjs --from-fixture` (0 px expected).
4. **The OPP arm, once OPP has landed:** the same sweep's 853/854 keys with arm B + OPP, `seam_census=-3..3`. Expected: the
   seams where both x≈744 bobs die reach `iceturret@472,400`; the others stop on the chooser pair.

## Hand-overs

- **Hammer arc, the chooser pair** (`chooseBodyToRemove`, `CHOOSER_HIT_SOURCES`; ⛳ hammer-2's ask). With OPP + both keys the
  chain reaches the x≈744 pair again wherever the press kill left one alive. In each case the burn or chest stance's ladder
  stops on `bobsoldier@880,832` (or the bob itself) with *"the danger on this corridor is not a body this run can watch die"*:
  the chooser silent, so neither the chaser nor the orbit arm is asked. Stagings and ticks:
  - **survey step 67** (step 67's boot, goal `chest@880,816`): the refusal at **t771**, player (744.3,795.5), `bob@736,800` at
    2/3 hits 47 px off at (741.7,842.1), `bob@736,752` dead (t759), `spinner@880,848` dead (t771);
  - **leg 853 request 1** (`<- in_L39_144_0`): seam 5149 (d−3) at **t953**, and seam 5153 (d+1) at **t780**, both bobs alive;
  - **leg 854 request 1** (`<- in_L43_176_464`): seam 5154 (d−1) at **t815** (`bob@736,800` alive), seam 5155 (d0) at **t748**
    (both alive);
  - **survey step 95**: the same shape (`bob@736,800` alive).

  A scratch "orbit by hit source" arm (in the kill rung's `!target` branch, not landed; `scr1.txt`) was tried at step 67's
  t771: all 20 forks are hit by `bob@736,800` within 31–44 ticks. The pair is the gate, not the BobSoldier.
- **Hammer arc, the static arm** (L40LATCH's hand-over 2, reached again): `iceturret@472,400` on the walk to `wandlock@448,432`'s
  hold stance (leg 853 seams 5151/5152, 854 seams 5152/5153, OPP + both keys).
- **Hammer-2 review at harvest:** nothing in or beside the press kill. D1 is inside `orbitKillPolicy` (the kill rung's orbit
  arm, L40LATCH's); D2 is the strategy bound in `solveSegmentUnder`.

## What the JS arc must wire / pins that move

- **No contract change:** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are untouched, and there
  is no new `SolverRefusal.obstacle.kind`, record field or trace row.
- **Run state:** none added, renamed or reshaped, so no digest part or `DIGEST_EXEMPT` row is owed. `orbitFreeAim` reads
  `run.state`, `run.world.collidesSolid` and `run.liveGeometryOpts()` (existing getters); the surface census re-sealed read-site
  counts only.
- **The walker:** `botDriverV2` is untouched, so no `producer:walker` row can move.
- **Pins:**
  - the flashPanel settings rows `seedlingContactOrbitFreeAim` and `seedlingContactStrategyBoundDistinct` (derived from
    `CONTACT_FIDELITY_KEYS`, +2 rows in `contactFidelityHook`);
  - `contactFidelity.test.js`'s defaults table gains the two OFF keys;
  - a flip owes `fidelityL40Latch`'s candidate row and its slow both-ON row re-pinned to the ON plan (`l40bk2b-latch-free` is
    that plan's witness).

## Deltas

- `contactFidelity.js` (+ test): `orbitFreeAim`, `strategyBoundDistinct` (both OFF) and their env lines
  (`SEEDLING_ORBIT_FREE_AIM`, `SEEDLING_STRATEGY_BOUND_DISTINCT`).
- `solverBot.js`:
  - D1: `ORBIT_FREE_AIM`, `orbitFreeAim`, and `orbitKillPolicy`'s `at`;
  - D2: `STRATEGY_BOUND_TOTAL`, `strategyBoundReached` and its call site.
- New files:
  - `fidelityL40Bk2b.js` (+ `.test.js`, 16 rows);
  - `probe-seedling-l40bk2b.mjs` (box-lock roster row in `boxLock.test.js`);
  - `fixtures/l40bk2b-witness/`: `corridor-boot.json`, `l40bk2b-orbit-plain.json`, `l40bk2b-orbit-free.json`,
    `l40bk2b-latch-free.json`.
- Censuses: surface 357 GREEN (re-sealed: read sites only), constants 6,969 PASS, entities 566, profile 138, roster 290.
- Docs: the `seedling-bot.md` paragraph, the bot-log entry, the reference's instruments and docs-index rows.

## What the brief got wrong (measured)

- **"Survey `40536691165` … 235 steps".** This base derives 240 survey steps locally (201 / 39); compare by (level, goal, boot).
- **"Your arm: OPP ON … the next blocker on every arm is `bobsoldier@880,832`".** On this base it holds for 853 at its captured
  seam only. 854 at seam 5155 and step 67 also stop on the BobSoldier, but with an x≈744 bob alive. There the chooser is
  silent, and no BobSoldier fix moves them: the pair is the gate.
- **"OPP's step 67 … REFUSED at the chest stance on `bobsoldier@880,832` (t771)".** Reproduced (t771). The cause is the
  surviving `bob@736,800`, not the BobSoldier's sword: an orbit tried there is hit by the bob (`scr1.txt`).
- **The witness staging.** The brief suggested staging after the spinner kill with the chest and tree banked. The BobSoldier is
  met BEFORE the tree (on the burn stance's walk), and the AP leg's chest is an `apitem` the probe page does not stage, so the
  witness is a plain-world corridor boot with both corridor spinners banked.

## Residue

- The OPP arm is measured in node only: OPP is not on main, and the page sweep cannot carry it.
- M2/M3: the orbit's straight-sweep test and planner fallback are exercised on leg 853's shaft approach, but no committed row
  pins them. A staging of that approach without OPP (both x≈744 bobs dead) would.
- The projected orbit is fewer-hitless in the open latch pocket (3 / 20 against 8 / 20). The first hitless one still wins there
  (witnessed), but the margin is thinner.
- The plain-world chest goal from the corridor boot next refuses on the chest's own proximity hazard. That is a staging
  artifact: the AP chest is an `apitem`.

## Byte-inertia (OFF)

- **The identity block at the code head** (this tree, its own server on 9751; `identity-after.txt`) **equals W0 on every md5 row
  and all six producer `--check` md5s and exits.** The reference row reads 8 DIFFER here against W0's 4: the 4 extra were my
  uncommitted docs, since regenerated and committed, and `--check` now shows only the 4 environmental ones.
- **tapeRunner pairs: 637, `9318088a8937dcb042aaa107bab99f42`**, base and head.
- Censuses at the head: as W0. Roster 290.
- **Bounded vitest AFTER** (defaults, 189 files, this tree; `rows-after.txt`, `rows-before-vs-after.txt`): **6,196 / 6,207**.
  - The 1 red is `generated.test.js`'s `--check` row, the environmental drift, also red BEFORE.
  - Against BEFORE, the differences are: my 14 rows (16 at the code head); the 2 derived `contactFidelityHook` settings rows;
    the instruments row renamed by its count (489 → 490).
  - Three files load only in the main tree, not the worktree (`compositeMapRenderer`, `mazeRoomUI`, `sphereSteps`), and
    `loopBlockBuilder`'s matrix is red only in the worktree. All environmental.
- **CI `JavaScript Unit Tests` at `0bf02ee8` (run 40574386217): success, 23,703 passed, 0 failed; slow battery 271 / 271.**
- **CI at the last code/docs head `469b13dc` (run 40593337152): success, 23,705 passed, 0 failed; slow battery 271 / 271.**
  This report's commit changes `CC/docs/` only, which the path filter does not run.
- No committed tape, producer `--check` or identity row moves, ON or OFF. No rules, AS3, wasm or gitlink edit.

## Rows to BANK

- **W0:** at the base both legs refuse in the x≈744 corridor (shipped), and step 67 dies at t780. On the OPP arm, 853 reaches
  the BobSoldier with the chooser naming it; 854 and step 67 reach it with a bob alive.
- **D1:** the notch geometry. The shipped orbit is hit on the game at t55; the projected orbit kills hitless at t125 on p4g at
  0 px; the ON latch chain is witnessed (351 t).
- **D2:** the strategy bound counts distinct applications; leg 853 (OPP) runs on to `iceturret@472,400`.
- **Movers:** 0 survey rows, 0 sweep verdicts, one bounded mover (L40LATCH's latch orbit, witnessed ON), probes 11 / 11 ON.
- **Mutants:** M1/M4/M5 as predicted. M2 survived against the prediction; M3 survived as predicted; both are exercised on leg 853.
- **Trap candidates** (in the bot-log entry):
  - an aim is a place to stand only if the player can stand there;
  - a bound documented in one unit and counted in another;
  - a measurement tree built from `git diff HEAD` loses the slice's code once committed. Measured here: the first OB seam census
    ran without the keys, and was re-run.
- **Commits:**

  | commit | content |
  |---|---|
  | `690d96b0` | D1: `orbitFreeAim`, the module, the probe, two witnesses, the box-lock row |
  | `79cd58d5` | D2: `strategyBoundDistinct`, its rows |
  | `0bf02ee8` | the surface re-sealed (read sites); the instruments reference |
  | `586dc4e4` | D1: the latch chain with the key ON, witnessed — the code head |
  | `469b13dc` | docs: `seedling-bot.md`, the bot-log entry, the reference |
  | evidence + this report | last |
