# Seedling fidelity FORCEDHIT: a hit every input takes is billed, not refused

| | |
|---|---|
| Session | `seedling-fidelity-forcedhit` (wave 13, model coverage; planner `seedling-fidelity-planning-6`) |
| Start SHA | **`db221dc093`** (`db221dc09313796e94fd293ae78a12b4173d5c4a`), the brief's base, not rebased |
| Harness branch | `claude/seedling-forced-hit-e5w7qt` (the harness branch IS the slice branch) |
| Commits | D1 `12ddd9d` · D2 `0bdbdeb` · D3 `1f95bd7` · this report (the head) |
| Dev server | `serve-nocache.py 9640` (the head), `9641` (a pristine base worktree for the BEFORE rows) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (behind `CONTACT_FIDELITY.forcedHits`, OFF, byte-identical) · D3 PASS: leg 622 played on the game, 0 px** |

## The one thing to know first

**Leg 622 now solves with the flag ON, and the game agrees with the plan.**
- The rung proves that every input from the L73 arrival takes a hit. The alphabet is 36 held sets: the 8 directions or none, each with or without primary and secondary. The proof steps the run itself, on a fork, and holds at depth 2 after 1,332 fork steps.
- The crossing it then plans is 4 ticks: `up up down+right down+right`. It bills one hit, `lavarunner@72,24` at t2, and crosses to L74.
- On the game (p4f headless) the hit lands at t2. The player's `hits` / `hits_timer` read 1/19 at t2 and 1/18 at t3, and the knockback is visible in the player's position. The model matches all of it at 0 px.
- On the page, with `forcedHits` added to the default switch set, leg 622 is **done in 4 t with no divergence**. The game ends at the expected L74 (296,136).

**No other refusal is a forced-hit case.**
- I measured the other 9 ladder-EXHAUSTED survey steps and legs 624 and 772. On each, standing still is hitless for two ticks, so no hit is imminent and the proof does not hold.
- With the flag ON, the survey moves none of its 222 steps.

**The flip's movers:**
- the switch's own two pins;
- one identity row, by wording only. The acceptance batch's post-shield seed 2 records a procgen EXHAUSTED refusal, and that refusal gains the rung's `forced-hit:` line.

## W0 (at `db221dc093`, measured in a pristine worktree)

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0 |
| identity block | `SEEDLING_PORT=9641 bash scripts/procgen/identity-block.sh .` in the base worktree (`…-evidence/identity-base.txt`) | equal to the bank: maze `57e07d21`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`. The worktree's `generated set` needed the venv, and the head's run (venv active) says `OK`. Reference: 4 DIFFER, the container's substrate rows. |
| six `--check`s | the same run | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0 |
| tapeRunner | `npx vitest run …/tapeRunner.test.js --reporter=json`; md5 over sorted `status\tfullName` | **611** pairs, all pass, **`75a3c41f0c91f6e71953e82d8259dc60`** |
| bounded vitest BEFORE | 61 files (`…-evidence/bounded-files.txt` minus the new test) | **1,853 / 1,853**, md5 `9c7543d0…` |
| surface / constants | `seedlingSolverSurface.test.js` / `census-seedling-constants --check` | green / PASS 5,684 literals |
| roster | `fixtures/tapes/index.json` | unchanged (no roster tape added) |

**The bounded set** (62 files at the head): the brief's list, plus every `rg -a` hit for what I touch:
- the combat ladder's `EXHAUSTED` refusal or `KNOWN_STRATEGY_VERBS`: `decisionTrace`, `fidelityAxe`, `fidelityBurn`, `fidelityL30KeyLock`, `fidelityProximity`, `fidelityStance`, `fidelityWand`, `fidelityWatcher`, `hammerFightFallback`, `procgenPalette`, `procgenRoam`, `procgenWeigh`, `r5SwimCloseout`, `seedlingCanCross`, `solverBot`, `solverSpinnerKill`, `arrivalCompositesLegs`, `surveyFamily`;
- the contact switches: `contactFidelityHook`;
- the JS arc's pins: `jsRuntimeArrivalOnDoor`, `jsRuntimeWalker`, `wasmArrival`, `wasmArrivalComposite`, `solverPrefix`, `jsRuntimeDeclarations` (read-only);
- `fidelityLavaRunner`, `killLockBodiesHook`, the constants census test, and the new `fidelityForcedHit`.

## D1: the outcome, defined before it was coded, and the census (PASS)

All of it is in `forcedHit.js`'s header; the summary:

**(a) The proof (`proveForcedHit`).**
- From the state the ladder was asked in, every input over `FORCED_HIT_ALPHABET` (36 held sets) is stepped on a fork of the segment (`solveSegment`'s `fork`). The model is the oracle, not a forecast or a danger box.
- A prefix that bills a `playerHits` row (or a death) is a leaf. A hitless prefix is extended by one tick.
- The proof **holds at depth d** when no hitless prefix of length d is left. Then no input sequence of any length is hitless, since each has a length-d prefix and every one of those is hit.
- It **fails by name** in four cases:
  - a hitless prefix survives `depthMax` 3;
  - a depth would overrun the budget (2,000 fork steps, or 600,000 run ticks counting each fork's replay of the segment). This is checked before any of that depth is spent;
  - a hitless input leaves the room;
  - the model refuses to step an input (`levelRun` refuses a press on a frozen tick rather than model it).
- Bounds, named: no equip (slot change) is in the alphabet, and the proof is from THIS state; an earlier choice might never have stood here.
- The TIME rung's lag and the strike's turn **do not change the proof**, because it never reads the TIME rung's box or the strike policy's choices: it steps every input. So neither was changed. On 622 the chosen crossing is the unarmed corridor, so the strike's turn is not in the plan.

**(b) The budget.**
- The proof's leaves give `minHits`, the fewest hits any length-d prefix takes (≥ 1). A crossing is admitted only when it bills **exactly** `minHits`, so it is provably least-damage.
- Further limits:
  - `maxHitsPerCrossing` 1;
  - `maxPerSegment` 2;
  - no death;
  - the crossing must leave `hits ≤ hitsMax − 1 − margin` (margin 1).
- **The state the hit leaves is the run's own.** The knockback, the 20-tick i-frame (`PLAYER_DAMAGE.hitsTimerMax`), the shake and the dark-suit retaliation all come from `levelRun.applyPlayerHit`. The chosen keys are replayed on the live run, and its new `playerHits` rows must be the fork's.
- **Which state the solver is in:** `worldHitsOf(run)` reads the per-world `hits` off the ledger: the last hit's `hits` when it landed after the last door or death, else 0. The model's own rule is that a door or a death swaps the `Player`, so it resets `hits` to 0.
- So 622's crossing hands L74 a fresh 0. A crossing that ends in the same room carries its `hits` into every later plan of the segment: the budget check reads `worldHitsOf`.

**(c) The verdict.**
- A trace row `strategy: {verb: 'forced-hit', rung: 'forced-hit', climb, proof, billed, candidate, ticks}`. `forced-hit` joins `KNOWN_STRATEGY_VERBS`.
- The segment's result gains two optional fields: `forcedHits` (one row per billed crossing) and `damage` (`worldHitsOf` at the end).
- A rung that declines writes a row with `proof` and adds `forced-hit: <why>` as the refusal's last line.

**The census** (node, the sweep's inv staging; the survey locally; the flag ON):

| case | key / step | exhaustive search | outcome |
|---|---|---|---|
| leg 622 | `level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0` | **every input hit by t2** (depth 2, 1,332 fork steps, 1,296 leaves, least 1 hit, 0 deadly) | **a hit crossing: billed** |
| leg 624 | `level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144` | not proven: the model refuses `[primary ·]` on the arrival's frozen tick (a button-dropped fallrock). The game's hit is 87 ticks down the corridor (LEASH) | nothing proven |
| leg 772 | `level_104 <- in_L105_224_64 -> exit:out_teleporter_144_128` | not proven: 1,296 hitless two-tick prefixes (standing still among them), and depth 3 would need 46,656 more fork steps | nothing proven (hit not imminent) |
| leg 626 | `level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield` | never reaches the ladder: the model refuses a press on the frozen arrival tick | n/a |
| leg 628 | `level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144` | never reaches the ladder (the skirt stance stall) | n/a |
| leg 629 | `level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield` | solved at the base (`baitForecast` ON) | n/a |
| survey 106, 132, 147, 152, 161, 183, 204, 206, 212 | the 9 ladder-EXHAUSTED steps | not proven, each the same way: 1,296 hitless two-tick prefixes | nothing proven (hit not imminent) |
| the other 42 REFUSED steps | — | never reach the ladder's last rung (verb, item, encounter, stance and walk refusals) | unchanged, refusal head equal to CI |

A hitless prefix is not a hitless crossing. The "nothing proven" rows are undecided by this proof, which only ever proves hits that are imminent (within depth ≤ 2 to 3).

## D2: the rung (PASS; `CONTACT_FIDELITY.forcedHits`, OFF)

**Where it lives.**
- `forcedHit.js` is new: the proof, the crossing, `worldHitsOf`, `FORCED_HITS`, `withForcedHits`, and `FORCED_HIT_TRACE.sink` (a read-only census hook).
- `solverBot.climbLadderUnder` asks the rung as **rung 6**, only after every rung refused, behind the switch, on a segment with a fork and a corridor.
- The crossing (`planForcedCrossing`) tries these candidates:
  - the walk's corridor driven by `botDriverV2.drive` exactly as `walkTo` drives it, armed with the strike policy;
  - the same corridor unarmed;
  - the proof's 12 fewest-hit leaves, each as a prefix of the corridor.
- Each candidate is played on its own fork. The best is the one with the fewest hits, then the shortest. It is replayed on the live run, and the ladder returns `{forced: {transition}}`.
- `walkToUnder` returns that crossing, and `crossTo` now reaches the ladder (an optional parameter).
- The switch is a `CONTACT_FIDELITY` key, so the page, its worker and the sweep's `contact_fidelity=` already set it; the page run below used exactly that. In node it is `SEEDLING_FORCED_HITS=1`.

**Result.**
- Leg 622: OFF refused EXHAUSTED. ON **solves in 4 t** (`verbs: ['forced-hit']`, `up up down+right down+right`), billing `{t: 2, level: 73, source: 'chaser', id: 'lavarunner@72,24', hits: 1}`, end L74 (296,136), 0 deaths.
- In node it takes 2.1 s, against 0.36 s for the refusal: the proof's 1,332 forks.

**Mutants** (predicted first, made by copy + edit + restore; `cmp` restored, `grep -c MUTANT` = 0):

| mutant | predicted | measured |
|---|---|---|
| M1: the proof closes at depth 1 regardless | 3 red (the depth-2 proof, depth 1 "not a proof", the ON solve) | **6 red**: those 3, plus the two budget-refusal rows (their depth-2 refusal is never reached) and the "hits 1 of 3" budget row (a depth-1 proof has no leaves, so the crossing refuses on "every proof leaf dies" instead) |
| M2: the budget ignores the hits already taken | the "hits 1 of 3" row red | exactly that row |
| M3: the live replay's cross-check disabled | green: no row stages a fork/run disagreement | green, a **named gap**. The check guards a contract (`fork` = the live run) that the fork's own replay already asserts. |
| M4: an unmodelled input counted as hitless | the "model refuses" row red | exactly that row |

## D3: on the game, and the census before → after (PASS)

**Game witness (0 px): `forcedhit-l73-622-plan`.**
- `probe-seedling-chaser-mobiles.mjs --class=LavaRunner --player-hits --record`, p4f headless, port 9640.
- It covers the plan's first three ticks; the fourth crosses, and the probe stops at the tape's end, as LEASH's 622 witness did.

| t | game player (x, y) | game `hits`/`hits_timer` | lavarunner (x, y) |
|---|---|---|---|
| 0 | 72, 24 | 0/0 | 80, 32 |
| 1 | 72, 23.2 | 0/0 | 80, 32 |
| 2 | 70.13236663306107, 20.377433657575743 | **1/19** | 79.116…, 31.116… |
| 3 | 68.40268758954751, 17.76335857311749 | 1/18 | 78.232…, 30.232… |

- The probe passes: 4 sampled ticks, clock shift [0], worst |Δ| 0.
- `fidelityForcedHit.test.js` replays the witness and checks, at every sample, the player's position, the model's `damage.hits`/`hitsTimer` against the game's, and the LavaRunner's position, velocity, hits and timer. It also pins the model's one `playerHits` row, t2 `lavarunner@72,24`.

**The crossing on the page:**
- `probe-seedling-divergence-sweep.mjs --ids=622 --mode=inv --producer=solver --contact-fidelity=<the defaults>,forcedHits`.
- Result: `end: done`, 4 t drained, `verbs: ['forced-hit']`, no divergence, end = the expected end (L74 296,136), 0 deaths.
- The game played the hit and the teleport.

**Legs, before → after** (the page, inv mode, solver producer; `…-evidence/page-*.jsonl`):

| leg | defaults | `+forcedHits` |
|---|---|---|
| **622** | failed: ladder EXHAUSTED, `lavarunner@72,24` | **done, 4 t, `forced-hit`** |
| 624 | failed: ladder EXHAUSTED, `lavarunner@208,96` | unchanged (the refusal gains its `forced-hit:` line) |
| 626 | timeout | timeout |
| 628 | timeout | timeout |
| 629 | done, 278 t (bait, kill, walk) | done, 278 t |
| 772 | done, 366 t (detour) | done, 366 t |

On the page ON, 622's `full` pass ended `deadline: walk` after the `dashless` pass had answered. The proof's forks spend the page's work budget, because each fork asks the `crusher-fork` fine site. The answer is the dashless pass's. The full pass's cost is what the budget is for.

**Survey steps, before → after** (CI 38168138687 vs local, `SEEDLING_FORCED_HITS=1`, `--through=end --route=full`):
- **0 of 222 move.** The 171 non-refused steps keep their verdict and ticks (`…-evidence/census-survey-nonrefused-on.json`).
- The 51 REFUSED steps keep their refusal head. The 9 ladder-EXHAUSTED steps' messages gain the `forced-hit:` line (`…-evidence/census-survey-refused-on.json`).

## Byte-inertia (OFF, the shipped default) and the ON mover list

| row | OFF (shipped) | ON (`SEEDLING_FORCED_HITS=1`) |
|---|---|---|
| tapeRunner | 611, `75a3c41f…` (= base) | 611, **`75a3c41f…`** |
| identity block (the head; `…-evidence/identity-head-*.txt`) | every row = the base, the six producer `--check`s included; `generated set` OK; reference 4 DIFFER (= base, the container's substrate rows) | every row = OFF **except the acceptance batch, `76602ae8` → `933c14f7`** (below); the six producer `--check`s equal (`405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0); `generated set` OK; reference 4 DIFFER |
| bounded vitest (62 files) | **1,868 / 1,868** | 1,866 + 1 skipped (the "ships OFF" row skips under the env) + **1 red** |
| surface census | GREEN after `--write` (site counts; `forcedHit.js` joins the family) | — |
| constants census | PASS 5,684, 0 drift | — |

**The ON reds, as a licence list:**
1. `contactFidelity` "the shipped defaults": `forcedHits: false` pinned. This is the flip's own re-pin.
2. `fidelityForcedHit` "ships OFF" (skipped under the env; it reds at a flip). Also a re-pin.
3. **The acceptance batch identity row** `76602ae8` → `933c14f7`.
   - One table cell moves: post-shield seed 2's two-process md5, `9eb7a968…` → `f4cc4e53…`.
   - The cause: the generator's `--json` records a procgen solve refusal (`solverBot(procgen-l900) collect (96,80) stance: the combat ladder is EXHAUSTED …`, `spinner@16,64`) in `trace[3,4].reasonText`, and ON appends `forced-hit: no forced hit is proven from (24.0,24.0): 1296 prefix(es) …`.
   - The verdict, ticks (240 → 205), certification and requirements are all unchanged.
   - This is a re-bank at a flip.

ON moves no committed tape, no producer `--check` digest and no survey step.

## CI dispatches for the planner (I cannot dispatch)

1. **The sweep, ON, no code edit:** `seedling-divergence-sweep.yml`
   - ref `claude/seedling-forced-hit-e5w7qt`, `mode=inv`, `producer=solver`;
   - `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits`;
   - `ids=622,624,626,628,629,772` (the keys are in the table above).
   - Expect **622 done, 4 t, `forced-hit`** and the rest as the defaults.
   - For the whole-sweep mover list, use the same `contact_fidelity` with no `ids`, against a defaults run of the same ref.
2. **The sweep at the defaults (inertia):** the same workflow and ref with `contact_fidelity` empty. Expect it equal to the wave-12 sweep at `db221dc093`.
3. **The survey, OFF inertia:** `seedling-survey.yml`, ref `claude/seedling-forced-hit-e5w7qt`, `through=end`, `route=full`, no `only`. Expect it equal to 38168138687 (222 steps, 169 / 51 / 1 / 1).
   - The survey takes no switch input, so the ON half was measured locally (above). On CI it needs `SEEDLING_FORCED_HITS=1` in the job's env, which is a workflow edit, not mine.
4. **The witness on CI** (if wanted): `seedling-probe.yml`, `probes=probe-seedling-chaser-mobiles.mjs`, `args=--class=LavaRunner --player-hits --witness=forcedhit-l73-622-plan`. Expect PASS, worst 0.

## For the JS arc

- **No JS-arc file was edited.** `jsRuntime*`, `flashPanel/*`, `wasmArrival.js`, `wasmWalkTape.js` and the worker are only imported, by the test. The contracts of `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging` are unchanged.
- **New, and nothing to wire for the switch:** the `CONTACT_FIDELITY` key `forcedHits` rides the generic hook (the page run above set it with `--contact-fidelity`).
- **New optional result fields on `solveSegment`:** `forcedHits` (rows `{tick, what, proof, billed, candidate, ticks, damage}`) and `damage` (`{hits, lastHitAt, id}`).
  - **What to wire:** `jsRuntimeSolver`'s plan carries neither (nor the trace).
  - **The staging has no field for the player's `hits`.** A segment that ends in the same world after a forced hit hands the next segment a run that thinks `hits` is 0 while the game has 1.
  - The JS arc should carry `damage` into the next staging (or refuse a continuation with `damage.hits > 0`). On 622 it does not arise, because the crossing ends at a door.
- **No new `SolverRefusal.obstacle.kind`.** A declined rung keeps the ladder's `dangerObstacleOf(hit)` obstacle.
- **Pins:** the JS arc's pins in the bounded set are green both ways. CANCROSS's `solverStamp` moves (`solverBot.js`, `contactFidelity.js` and `decisionTrace.js` changed), so derived rules read STALE until re-derived.

## For the hammer arc

Nothing handed over. The rung is generic over the ladder's sources, so a spinner can be a forced-hit source too. No spinner case was proven: the survey's spinner steps 152, 161, 183 and 204 are not imminent.

## What the brief got wrong (measured)

1. *"the 30-tick i-frame after a landed hit"*: the player's i-frame is **20** ticks (`PLAYER_DAMAGE.hitsTimerMax`, `Player.as:336`). The game reads 19 on the hit tick and 18 on the next (D3). 30 is the enemies' `hitsTimerMax`.
2. *"how later segments see the reduced health"*: `hits` is per world. A door or a death resets it to 0 (the model's rule, `levelRun`'s damage docblock). The forced crossing on 622 ends at a door, so the next segment starts at 0. Only a continuation in the same world carries `hits`, and the staging has no field for it (above).
3. *"census which other refusals are forced-hit candidates: the 51 REFUSED survey steps"*: only 9 of the 51 are damage (ladder) refusals, and none is a forced-hit case: a hit is not imminent on any of them. 622 is not a survey step.
4. *"the TIME rung's WAIT bound … and the opportunistic strike … may matter once hits are priced"*: neither changes the proof, which steps every input on the run. Neither changes 622's crossing either: the unarmed corridor wins.
5. LEASH's sweep refusal list (622, 624, 772, 626, 628) as candidates: 626 and 628 never reach the ladder, and 772 is solved on the page at this base, as LEASH also found.

## Residue (ranked)

1. **The proof proves only imminent hits.** With 36 held sets, depth 2 is the whole tree (1,332 forks), and depth 3 (47k) fits only when it is pruned. A hit 87 ticks down a corridor (624) is out of its reach. A different proof, such as a coarse space-time reach that is exhaustive on its own grid, would be the next tool.
2. **A fork replays the whole segment** (no `levelRun` snapshot). The proof is budgeted in run ticks (600k), so a proof asked deep in a long segment is refused by its cost. A snapshot would make it cheap.
3. **The model refuses a press on a frozen tick**, so a proof at an arrival with a ceremony (624, 626) is open there.
4. **The staging carries no `hits`** (for the JS arc, above).
5. **No equip in the alphabet.** Selecting another slot is not an input the proof asks.
6. **M3's gap.** The live replay's cross-check has no staging row (it would need a fork that is not the live run).
7. **The page's `full` pass spends its budget in the proof's forks** (622 ON: `deadline: walk` after the dashless answer).

## Deltas

**New:**
- `forcedHit.js`;
- `fidelityForcedHit.test.js` (14 rows);
- fixture `chaser-witness/forcedhit-l73-622-plan.json`;
- the evidence directory `CC/docs/cloud-reports/seedling-fidelity-forcedhit-evidence/`.

**Changed:**
- `solverBot.js`: the import, `forcedHits`, rung 6 in `climbLadderUnder`, its `crossTo` parameter, `walkToUnder`'s call and return, and the result's optional fields;
- `contactFidelity.js`: the `forcedHits` key and `SEEDLING_FORCED_HITS`;
- `contactFidelity.test.js`: the defaults pin, plus `forcedHits: false`;
- `decisionTrace.js`: `forced-hit` in `KNOWN_STRATEGY_VERBS`;
- `seedling-solver-surface.json`: `--write`.

**Records:**
- `seedling-bot-log.md`: the FORCEDHIT entry and three trap candidates;
- `seedling-bot.md`: the forced-hit paragraph;
- the reference: the docs index (the 4 substrate rows left as the base has them);
- `check-procgen-docs`: ALL CHECKS PASSED;
- `boxLock`: no new box-taking instrument;
- roster: unchanged.

## CI (`JavaScript Unit Tests`)

Read at the last head: see the chat message. Earlier pushes' runs are cancelled by design.

## Rows to BANK

- tapeRunner **611** pairs, `75a3c41f0c91f6e71953e82d8259dc60` (base = OFF = ON).
- The identity block at the head OFF = the bank (maze `57e07d21`, acceptance `76602ae8`, …).
- Bounded vitest 1,868 / 1,868 (62 files).
- Constants 5,684 PASS; surface GREEN (268 rows).
- `CONTACT_FIDELITY.forcedHits` (OFF).
- Witness `forcedhit-l73-622-plan`.
- **Licence question for the user: flip `forcedHits`.**
  - 622 is done on the page (4 t, the game's hit billed).
  - The movers are the two pins above and the acceptance-batch row, `76602ae8` → `933c14f7`, wording only.
  - No tape, producer digest or survey step moves.
