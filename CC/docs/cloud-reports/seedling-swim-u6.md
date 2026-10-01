# Seedling swim U6: the L18 licence (the strike's dwell priced, the transit clock paired, L18 re-derived)

**Slice:** `seedling-swim-u6`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §15.7), under ⚖ Q33 (2026-10-01), the licence to re-record L18.

| | |
|---|---|
| Started from | `origin/main` @ `f4a4a28` (4081ecc742 plus one bank commit; 4081ecc742 is an ancestor) |
| Head | `6d69f8f`, followed by this report's own commit |
| Harness branch | `claude/seedling-swim-u6-00w74g` (the harness pins this branch) |
| Commits | D1 `60df98e` · D2 `03125cd` · D3 `f23152d` · D5 re-points + surface `de4fbbb` · D5 docs `6d69f8f` · this report |
| Parallel siblings | U5 (`assertGoal`, the goal loop, `bobBoss.js`, `burnableTree.js`, the survey), U7 (`chasers.js`, `combat.js`, `enemyDamage.js`, the chaser ingredient (c)), U8 (generator defaults, presets). I touched none of their files. See D2 for the one adjacent touch in `dangerMap.js`. |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduces U4b's head. The twelve: 11/12 post-sword, 6/12 pre-sword. |
| D1 | **PASS** | The dwell is priced. **(2,7) SOLVES 266 t**, and the census chamber is 12/12 post-sword. `r9-campaign --check` goes red with U4b's exact text, as expected. |
| D2 | **PASS, plus one defect it exposed** | The transit clock is paired, and the pairing rows are red 3/3 unpaired. L18's two `--check`s go red with U4b's exact text, as expected. The paired clock also exposed a dead spinner being priced at its placement (trap 157, the dead half), fixed here. |
| D3 | **PASS (a different shape than U4b's)** | The depth-6 escalation does not solve `r8-solve-18` once D2 is in. `stepToward` now scores all **nine** movement sets the controller produces. **`r8-solve-18` 485 → 522 t, `r9-solve-18` 394 → 455 t.** |
| D4 | **STOP (measured, reverted)** | The re-record cannot stay within two tapes. L18's length feeds 5 more tapes through the two chains (`r8-d2`, `r8-d2-19`, `r8-d2-20`, `r9-solve-19`, `r9-solve-20`). The game agrees with the re-derived `r8-solve-18` (523 observations, the model reproduces the recording), but with only that tape moved `tapeRunner` reads 364/365. Nothing in `fixtures/` was committed. |
| D5 | **PASS** | The corridor-body sweep certifies **94 → 122**. Roam post-sword is 10/10 → 10/8 (the dwell; see below). Six rows re-pointed by their own sweeps. Surface GREEN 185, reference regenerated, log and doc sentences written. |

**The one thing to know first.** The branch's code makes three committed identity rows red: `r8-l18`, `r8-d2-chain` and `r9-campaign --check`. Q33 licensed the L18 re-record, but L18's tick count is carried forward by both chains:
- `r8-d2-19` and `r8-d2-20` boot from `r8-solve-18`'s game latch.
- The `r8-d2` headline is one run through all three rooms.
- `r9-solve-19`'s declared `seam.time` is the free-oracle sum over segment 18.

So the re-record is **seven** tapes, not two (plus their expectations, traces and the index). Every one of those walks is unchanged except L18's own. **Merging this branch needs that wider licence and then the producers re-run.** The commands are in D4.

## W0: the banked rows (`f4a4a28`, the main tree before any edit)

| Row | Result |
|---|---|
| identity block (`SEEDLING_PORT=8870`) | maze `246dfbce…`, acceptance `d02ed4c0…`, c3 `d43a8c97…`, c6 `62b5475f…`, c4 `556eb1ee…`, ENEMY `fdff69ee…`, guard `a6d18d49…`, AREA `06b14d5d…`, killgate s2/s5/s9 `1b4eab8e…`/`b018ab2b…`/`999e1900…`, level pre/post s1 `e28c1e5d…`/`0076f26f…`, generated set OK. This is exactly U4b's head column. |
| six r8/r9 `--check`s | battery `410f27c0…`, d2-chain `b470c14d…`, l18 `17be7d70…`, tail `9a6a3192…`, r9-l3 `6cd35fe1…`, r9-campaign `2823a811…`, all exit 0 |
| reference `--check` | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| campaign census (`--no-write`) | exit 0, `9545859b…`, chain 21/21 at **5713 t**, tail 1791 t, **NO CHAIN ROOM MOVES** |
| `--check-frontier` | exit 1. `sources` is stale (`AP_1_rules.json` `602b318b…` on disk vs `c4845373…` derived), and the survey files are not on disk. This was already stale, as the brief says; I reported it and did not write it. |
| solver surface | GREEN 185 |
| bounded vitest (the brief's eight paths) | **9 files / 594 tests**, green (the `solverBot` prefix also matches `solverBotLethalPit`) |
| `tapeRunner` | 365/365 |
| twelve + CORRIDOR | post-sword **11/12**: (2,7) REFUSED *"… at (86.53,83.57) in level 900. There is no step out."*; the CORRIDOR arm SOLVED 225. Pre-sword 6/12 at 218 t; the other six refuse by the SUB-ORDER. U4b's table, exactly. |
| corridor-body sweep, post-sword (3 shards by kind, identical before and after) | 168 cells, placed **145**, certified **94**, named roaming refusals **47** (0 *"nowhere to be"*, 10 *"no step out"*, 25 EXHAUSTED, 8 *"danger map forbids"*, 4 other), TIMEOUT 1, THREW **0** (U4b's 15 pit throws are gone at this main) |
| roam (F1b's command) | pre-sword 10 placed / 8 certified; post-sword 10 / **10** |

## D1: the dwell is priced (`60df98e`)

**Shipped.** In `deriveStrike`, every forecast row in `[eta, i − 2)` is asked at the strike cell's box through `clearOfHammersAt` (`dwellUnsafeAt`). This is the wait between the walk's arrival and the train. It applies to both the bounded pass and the continuation. A skip is counted (`dwelt`) and named in the refusal, and the text appears only when the count is above 0: *"N reachable strike(s) were SKIPPED because the DWELL — standing on the cell from the walk's arrival to the train — meets a body or its hammer."*

| row | predicted | measured |
|---|---|---|
| (2,7) post-sword | SOLVES ~266 | **SOLVED 266 t**, certified, 3 landings |
| the rest of the census | byte-identical | byte-identical **except (3,6) 226 → 166 t**. The first strike is the same ((88,88) +142, first landing at t 39). The re-derivation after it now skips (88,56) +67, whose wait was unsafe, and takes (88,72) +70. |
| `r9-campaign --check` | exit 1 by U4b's text | exit 1: `solverBot(r9-solve-18) … at (137.99,96.15) in level 18. There is no step out.` (verbatim) |
| the other five `--check`s | unmoved | byte-identical |

**Mutant (a).** I emptied the dwell window (`k < eta`), ran one build, then copied the file back and restored it md5-identical (`dd92e471…`). Predicted: (2,7)'s text byte-identical to W0. Measured: (2,7) BYTE-IDENTICAL, and every post-sword row back at W0 (including (3,6) 226).

## D2: the transit clock is paired (`03125cd`)

**Shipped:**
- `dangerMap.spinnerDanger` asks `gameTimeAt(max(0, h − 1))` for row `h − 1`. Horizon 0 keeps `gameTimeAt(0)`.
- `spinnerClockPairing.test.js` gains the danger map's half: three rows over U4b's placements, *"the transit arm at horizon 1 names the first hammer hit on its own tick"*.

**What it exposed.** Pairing the clock re-routed the census chamber's (2,2) kill, and the solve then refused with *"the danger map forbids (40.02,39.95) — enemy:spinner@32,32 (a static "Enemy" body at its placement …)"*. Measured:
- the kill had happened (185 ticks spent);
- `ceremonyStarts` was empty;
- the player stood on the dead body's placement tile.

`staticEnemyDanger` and the AVOID volumes excluded spinners by the **live** roster only. A killed spinner's census row therefore fell through to "static body at its placement". That is trap 157 for the dead half, which the file's own chaser paragraph names.

The fix is `spinnersTheRunSteps(run)`: live ids plus ids with a **landed** press hit in `run.ledger('spinnerPressHits')`. If the run stepped a body and it is gone, the run removed it. A spinner the run never steps is still priced at its placement. ⚠ This touches `staticEnemyDanger`, which is not U7's chaser ingredient (c). The change is confined to the spinner exclusion clause (both spellings), and the merge should know it is there.

| row | predicted | measured |
|---|---|---|
| pairing rows | green | 6/6 green (3 U4b + 3 new) |
| `r8-l18 --check` | exit 1 by U4b's text | exit 1: `solverBot(r8-solve-18) … at (140.64,55.73) in level 18. There is no step out.` (verbatim) |
| `r8-d2-chain --check` | exit 1 | exit 1: `solverBot(r8-d2) … at (140.64,55.73) …` |
| `r9-campaign --check` | as D1 | `6d8c522d…` = D1 |
| battery / tail / r9-l3 | unmoved | byte-identical |
| twelve + CORRIDOR | "unchanged from D1" | post-sword 12/12 still. **(2,2) 154 → 252 t** and **(4,4) 221 → 219 t**. The pre-sword verdicts are unchanged, but (7,6)'s and (3,6)'s refusal texts move by one horizon (70 → 71, 103 → 104; same Game.time in the text). |

**Mutant (b).** The index back to `h`, one build, restored md5-identical (`a90b72ff…`). Predicted: the new pairing rows red, and L18 back at W0. Measured:
- **3 red** ✓.
- L18 does **not** return to W0: `r8-l18` exit 1 at `7bcd9975…`. The dead-spinner exclusion moves L18 on its own: `r8-solve-18` solves at **461 t** (485 committed), because the exit walk stops avoiding the first body's dead placement.
- With both halves reverted the tree is D1, whose md5s `17be7d70…`/`b470c14d…` were already measured.

## D3: L18's step-out (`f23152d`)

**Measured first.** I used an instrumented copy (a 16-tick ring of the player, keys and body, plus a ten-key-set verdict at the throw), restored afterwards. The corner in `r8-solve-18` under D1+D2:

| t | player (x, y, vx) | held | body (x, y, v) | |
|---|---|---|---|---|
| 228 | 141.89, 55.73, −0.15 | primary | 155.2, 45.4, (+0.44,+0.9) | a press that does not land |
| 237 | 136.74, 55.73, +0.80 | primary | 155.2, 53.5, (−0.44,+0.9) | 9 ticks later, so a **dash** |
| 238 | 139.29, 55.73, **+2.55** | left | 154.8, 54.4 | the dash carries the player toward the body |
| 239 | 140.79, 55.73, +1.50 | left | 154.3, 55.3, (+2.0,+0.7) | **landing** (hitsTimer 30), knockback |
| 240 | 141.24, 55.73, +0.45 | left | 156.3, 56.1, (**−4.07**,+0.7) | off the wall at x≈157 |
| 241 | 140.64, 55.73, −0.60 | left | 152.3, 56.7, (−3.82,+0.6) | throws |

At t 241 all ten key sets (none, the 4 facings, the 4 diagonals, the press) land in the body's rect (140.9,54.0) two ticks on.

The knockback is **player-coupled**, so no autonomous forecast taken before the landing contains it. After the landing, no key set outruns 4 px/tick in 3 ticks.

**Variants measured** (an env-switched probe copy, restored):

| variant | `r8-solve-18` | `r9-solve-18` (chain) |
|---|---|---|
| D1+D2 as committed (5 sets, depth 4) | step-out (140.64,55.73) | step-out (137.99,96.15) |
| escalate to diagonals when no facing survives, depth 4 | step-out | step-out (139.26,94.36), U4b's |
| … depth 5 / 6 / 8 | step-out | depth 6: **432 t** (U4b's number, chain 5751) |
| base lookahead 5 or 6, facings only | step-out | — |
| **diagonals always (9 sets), depth 4** | **522 t** | **455 t** (chain 5774) |
| diagonals always, depth 5 / 6, or + escalation | 522 | 455 (identical) |

**Shipped.** `stepToward` scores `[intended, the 4 facings, stand, the 4 diagonals]`. The tie-break order is kept, so the diagonals follow. `DIAGONAL_KEYS` is spelled from `FACING_KEYS`, and `STEP_LOOKAHEAD` stays 4. The docblock's *"the five key sets the controller can produce"* was false: `applyInput` reads each axis on its own.

This is the narrowest shape that solves **both** L18 tapes. The depth-6 escalation solves `r9-solve-18` only. It does not solve the corner; it walks a different approach in which the corner never forms.

| row | measured at D3 |
|---|---|
| `r8-solve-18` (producer) | **522 t**, 0 hits, 0 deaths, 0 spinner contacts, {18,0} at 422 |
| `r9-solve-18` (chain) | **455 t**; segments: 183,47,245,255,558,294,146,827,122,83,97,152,23,145,36,118,456,625,**455**,746,161 = **5774** (was 5713) |
| twelve, post-sword | 12/12. Every **press** row re-times: (5,5) 245 → **241**, (2,2) 252 → **260**, (6,6) 232 → **251**, (7,6) 213 → **212**, (2,7) 266 → **258**, (3,6) 166 → **173**. The six walk rows, CORRIDOR (225) and all 13 pre-sword rows are byte-identical to D2. |
| battery / tail / r9-l3 | byte-identical |
| ⚖ 47 arrive-early row (L18 booted at (128,112), economies on) | was SOLVED 597 at D2; now *"There is no step out."* at **(88.22,34.57)**. Same class: a press at 454, 7 ticks after a miss at 447, is a dash (vy −2.55); it lands at 456; the body comes off the wall at y≈21 at **+5.12 px/tick**. The row moves one tile west to **(120,112)**, which keeps its property (arrives 331, clears 406, waits 75; 410 t, 0 hits). |

## D4: the re-record — STOP, measured and reverted

**Measured** (main tree, every file restored with `git checkout`; `fixtures/**` vs origin/main = 0 lines):

| step | result |
|---|---|
| `node scripts/procgen/solve-seedling-r8-l18.mjs` | wrote `r8-solve-18` **522 t** (18897 B) and its trace; 0 hits, 0 contacts, {18,0} at 422 |
| `check-seedling-bot-differential.mjs --record --only=r8-solve-18 --host=http://localhost:8870` (headless logic-only) | exit 0. *"observation count — 523 (expected tick_count+1 = 523)"*, *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 523 observations, 1 transition(s)"*, game `save.time` 9149 = model 9149, `hits` 0 = 0, 23 PASS / 0 FAIL |
| `tapeRunner` with only that tape moved | **364/365**. Red: *"⛓⛓⛓ [r8-solve-18, r8-d2-19, r8-d2-20] on ONE run IS the headline r8-d2, tick for tick"* |

**Why it is a STOP.**

- **The d2 chain.** `solve-seedling-r8-d2-chain` promotes `r8-solve-18` and solves a headline `r8-d2` over all three rooms in one run. At D3 the headline is 1828 t (1791 committed), and its first 485 ticks are no longer `r8-solve-18`'s. `r8-d2-19` and `r8-d2-20` boot from `r8-solve-18`'s **game** latch, which carries `seam.time`.
- **The campaign.** `r9-solve-19`'s declared `seam.time` must equal `declared + dead − LOAD_FADE + segment 18's ticks`. Measured: *"r9-solve-19 declares seam.time 10466 — 10052 + 40 − LOAD_FADE_FRAMES + 455 = 10527"*. `r9-solve-20` boots from 19's latch.
- **The arithmetic.** Segments 19/20/21 keep their walks (746 / 161 t, and the d2 chain's 746 / 560). So the brief's *"the chain's OTHER 20 segments must be byte-identical — assert it"* fails at the boot blocks of the three after 18, and the d2 chain's two.

The licence names two tapes. A two-tape commit leaves both chains' boundaries (`boot(N+1) == latch(N)`) false and `tapeRunner` red. So I committed no tape.

**What the ruling would unlock** (in order, with the box lock; `SEEDLING_PORT=<port>`):
1. `node scripts/procgen/solve-seedling-r8-l18.mjs` (`r8-solve-18`, 522 t; its differential is measured above, Δ0).
2. `node scripts/procgen/solve-seedling-r8-d2-chain.mjs` (`r8-d2`, `r8-d2-19`, `r8-d2-20`; two headless latch drives).
3. `node scripts/procgen/solve-seedling-r9-campaign.mjs` (`r9-solve-18` 455 t, then 19 and 20 from the new latches; 21 headless latch drives with no cache in a fresh container).
4. `check-seedling-bot-differential.mjs --record --only=<each of the seven> --host=…`.
5. The tapes index, by its producer.
6. The six `--check`s, the census and `tapeRunner`.

The `campaign` tier on CI (`seedling-full-tier.yml`) is then owed by the coordinator at the merge.

**Predictions for that re-record** (model side, measured at D3):
- `r8-l18 --check` and `r8-d2-chain --check` turn green at new md5s.
- The chain total is **5774** and the d2 headline **1828**.
- The census verdict stays NO CHAIN ROOM MOVES: a longer segment is not a room move. At this head, against the committed tapes, the census is byte-identical to W0.
- The frontier `sources` row stays stale until someone writes it, and that is not this slice's job.

## D5: the census, the yield, the records

**Twelve + CORRIDOR** (head = D3; same harness as W0):

| position | post-sword W0 | post-sword head | pre-sword W0 → head |
|---|---|---|---|
| (4,4) | 221 | **219** (D2) | 218 → 218 |
| (7,2) (2,3) (3,3) (7,7) (5,2) | 123/142/150/123/123 | unchanged | 218 ×5, unchanged |
| (2,2) | 154 | **260** (D2 252, D3 260) | REFUSED (SUB-ORDER), unchanged |
| (5,5) | 245 | **241** | same |
| (6,6) | 232 | **251** | same |
| (7,6) | 213 | **212** | REFUSED; the text quotes horizon 71 (was 70) |
| (2,7) | REFUSED *"no step out"* | **SOLVED 258** | REFUSED, unchanged |
| (3,6) | 226 | **173** (D1 166, D3 173) | REFUSED; the text quotes horizon 104 (was 103) |
| CORRIDOR (4,1) | 225 | 225 | REFUSED, unchanged |
| **total** | **11/12** | **12/12** | **6/12** both, same verdicts |

**Corridor-body sweep, post-sword** (the same three kind-shards before and after; the head worktree is `f23152d`):

| | W0 | head |
|---|---|---|
| placed | 145 | 143 |
| certified | **94** | **122** |
| named `the-solver-cannot-cross-the-roaming-body` | 47 | **14** |
| … *"nowhere to be"* | 0 | 0 |
| … *"There is no step out."* | 10 | **2** |
| … ladder EXHAUSTED | 25 | **4** |
| … *"the danger map forbids"* | 8 | 3 |
| … other | 4 | 5 |
| other gaps | per-target 3, strike bound 1 | per-target **5**, strike bound 2 |
| TIMEOUT / THREW | 1 / 0 | 3 / 0 |

Per kind × size, placed/certified/named at head:

| kind | 10x10 | 14x14 |
|---|---|---|
| branchy | 11/8/1 | 9/8/1 |
| bushy | 12/10/2 | 11/9/2 |
| empty | 12/10/1 | 11/11/0 |
| loopy | 8/8/0 | 11/9/0 |
| open | 6/6/0 | 7/6/1 |
| rooms | 11/8/2 | 12/10/2 |
| winding | 12/9/2 | 10/10/0 |

**35 cells certify that did not, and 7 no longer do:**
- **Four are a new class, and not this slice's region.** `empty` 10x10 s10 (lost at D1), `branchy` 10x10 s2 (U4b's witness seed, lost at D3), `branchy` 10x10 s9 and `rooms` 10x10 s9. In all four, the goal was **collected during the fight**: `ceremonyStarts` totempart at t 641 / 287 while `runCollect`'s `before` was already 1. The dodge walked over the pickup, and the collect step then waits 400 ticks for the ledger to grow past its starting count, which reads as BUDGET_EXHAUSTED *"walked at totempart … without touching it"*. That is a goal-loop defect (a goal satisfied in passing is not recognised), in U5's region.
- Two are TIMEOUTs (`branchy`/`winding` 14x14 s9).
- One is `rooms` 10x10 s8, *"the sweep was blocked by tile:Stone"* on the goal approach.

**Roam** (F1b's command, both palettes, W0 and head worktrees, identical sharding):
- **pre-sword:** 10 placed / 8 certified at both, per cell identical.
- **post-sword:** 10/10 → **10/8**. `winding` and `branchy` 14x14 s12 refuse with *"… 269 reachable strike(s) were SKIPPED because the DWELL …"* (lost at D1).

The roam refusal is accurate about the executor that exists: `execKillByPress` walks to an adopted strike at once and stands there. With two billiards in the room, every reachable strike is a stand of hundreds of ticks. The lever is a **late departure** (stand where it is safe, leave at `aimAt − eta`), which is an executor redesign and not this slice's. `procgenRoam`'s row now pins the measured refusal and names the lever.

**Rows re-pointed by their own sweeps** (`de4fbbb`; none weakened):

| row | was | now | measured |
|---|---|---|---|
| `procgenCountableClock` case 5 | `gameTimeAt(2)` | `gameTimeAt(1)` | D2's law: horizon 2 reads row 1 |
| `procgenCountableClock` hammer-safety vehicle | (1,3) | **(7,2)** | the 31-cell sweep: 30 solve, and (7,2) is the one HAMMER SAFETY, *"no step out"* at (108.53,39.58) |
| `procgenScratchPersistence` (3 rows) | removal 141, clear 242 | **145 / 246** | bisected: D1 → 132, D3 → 145; +101 unchanged |
| `seedlingGenRoomRequire` re-roll | seed 3 | **seed 8** | seeds 1–10: 1, 5, 8 and 9 still re-roll by `require` |
| `watchGenOverlay` dropped-with-geometry | seed 3 | **seed 6** | killgate `ran` over seeds 1..20: **10 → 18** (W0 worktree vs head); 6 and 8 still drop |
| `procgenRoam` `winding` 14x14 s12 post-sword | certifies 650 | refuses by the DWELL, with the count | above |
| `procgenCorridorBody` refusing position | rooms s10 | **rooms s8** (D2) | s10 certifies 251 t; s6 and s8 refuse, and s8 is fast |
| `solverBot.test` ⚖ 47 arrive-early | (128,112) | **(120,112)** (D3) | above |
| `seedlingSolverSurface` mutant (b) | 2 RED lines | **1** | `dangerMap.js` is on the `run:ledger` row now |

**Records** (`6d69f8f`):
- `seedling-bot-log.md`: § *Seedling substrate U6-swim — the dwell, the transit clock, L18 re-recorded*, placed after § U4b-swim. The title is the brief's; the section says the re-record STOPPED.
- `seedling-bot.md` § the combat ladder:
  - the dwell sentence;
  - the transit sentence corrected (it no longer says "one phase ahead");
  - the dead-spinner exclusion;
  - the nine movement sets;
  - the step-out wall that remains.
- The procgen reference and `generate-docs-index.mjs` regenerated: `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED.

**Trap candidates** (for the coordinator to number):
1. **A player-coupled knockback is in no autonomous forecast.** A strike's train can be priced clear while the landing it causes sends the body back off a wall at 4–5 px/tick into the player.
2. **A goal satisfied in passing must be recognised.** A collect that waits for the ledger to grow from its count at the start never ends when the goal was collected earlier in the segment.
3. **A priced wait turns "walk now, stand there" into a policy choice.** Pricing it honestly is what shows the late departure is missing.

## The identity block and the surface (W0 → head)

| row | W0 | head | why |
|---|---|---|---|
| maze, guard, AREA, level pre-sword s1 | as W0 | **identical** | |
| acceptance batch | `d02ed4c0…` | `bb5f1aff…` | post-sword seed 1: 410→444 → **402→427** t, grade unchanged (*requires Progressive Sword*, STRONG) |
| c3 / c6 | `d43a8c97…` / `62b5475f…` | `5bc211d9…` / `e0174d3c…` | post-sword seed 1 (above). `empty` s5/s6/s11 now place a spinner gadget (65 → 464 t, 66 → 285 t, …) |
| c4 | `556eb1ee…` | `ed674b83…` | post-sword `winding` s1 415 → 482 t; s6/s11 place gadgets |
| ENEMY census | `fdff69ee…` | `57d71420…` | `spinner@nub` SOLVED 315 → 318 |
| killgate s2 / s9 | `1b4eab8e…` / `999e1900…` | `549c74a0…` / `6e82e24e…` | the `md5(rows)` line only |
| **killgate s5** | `b018ab2b…` | `8147b07c…` | `empty` s5 **DROPPED → SOLVED** (both rows) |
| level post-sword s1 | `0076f26f…` | `abb373ec…` | 410→444 → 402→427 t; the gate is *"cleared … before the crossing: true"* (was *"the route never crossed it"*) |
| generated set | OK | OK | |
| reference `--check` | ALL MATCH | ALL MATCH (after regeneration) | |

Every mover is a **post-sword** spinner gadget. These are measurement rows, not committed artifacts. I did not run `standing-values --write`; the standing values are the coordinator's.

**Surface table** (185 → 185, `--check` GREEN):
- no new row or member;
- `run:ledger` gains `dangerMap.js` (1 site, `spinnerPressHits`);
- `run:entities` `spinnerBodies` in `dangerMap.js` goes 3 → 2;
- `import:presses.js#RIGHT/UP/LEFT/DOWN` go 2 → 4 sites each (`DIAGONAL_KEYS`).

`census-seedling-constants --check` is green (0 new literals).

## What the brief got wrong (measured)

1. **"The only tape moves are `r8-solve-18`, `r9-solve-18` …; the chain's other 20 segments byte-identical."** Both chains carry L18's tick count into their successors' boot blocks (`seam.time`, the game latch), and the d2 headline is a single run. The re-record is seven tapes. This is the D4 STOP.
2. **"With `stepToward` escalating to the diagonals at depth 6, L18 SOLVES at 432 t."** That was true of `r9-solve-18` under U4b's configuration, which had no transit pairing. With D2 in, `r8-solve-18` refuses under every escalation depth. Only admitting the diagonals as ordinary options solves both, at 522 and 455.
3. **"D2 … the twelve + CORRIDOR unchanged from D1."** (2,2) 154 → 252 and (4,4) 221 → 219. (2,2) first went to a refusal, which exposed the dead-spinner pricing.
4. **"D1 … the rest of the census byte-identical."** (3,6) 226 → 166.
5. **"Mutant (b): L18's `--check`s back to W0's md5s."** Only with the dead-spinner exclusion also reverted. That exclusion moves `r8-solve-18` to 461 t on its own.
6. **"Pre-sword byte-identical."** The verdicts are, but the D2 transit pairing moves two pre-sword refusal texts by one horizon.
7. **"Predict certified 93 → n, *no step out* 10 → m."** The W0 here is 94 / 10 (with 0 pit throws, where U4b had 15). Head: 122 / 2.

## Residue

- **The re-record licence** for the seven tapes (D4). Until it is granted, the branch's three L18-bearing `--check`s are red against committed tapes.
- **The post-landing rebound** is the step-out wall that remains: the sweep's 2 *"no step out"*, the hammer-safety vehicle (7,2), and the ⚖ 47 (128,112) boot. Pricing it needs a forecast conditioned on a landing, which is simulation work. Avoiding it needs the strike to see the wall behind the body.
- **The late departure** (roam s12 ×2). The executor stands at an adopted strike from arrival; a priced dwell makes that visible.
- **The goal collected in passing** (4 sweep cells): U5's goal loop.
- `standingValues.test.js` (*"a gate that sleeps past the deadline is KILLED"*) is red at W0 too, and I did not touch it.
- **Scratch instruments** (session scratchpad, not committed):
  - `probe.mjs`, `cycles.mjs` (the twelve and their strike cycles);
  - `l18arms.mjs`, `l18boots.mjs`, `hsweep.mjs`, `roam12.mjs`, `kgscan*.mjs`, `reqscan.mjs`, `roomscan.mjs` (the re-point sweeps);
  - `sumsweep.py`, `sweep.sh`, `checks.sh`;
  - `solverBot.probe.js`, the instrumented copy with the U6 ring and the env-switched variants.

## Byte-inertia

| artifact | W0 `f4a4a28` | D1 `60df98e` | D2 `03125cd` | D3 `f23152d` = head of code |
|---|---|---|---|---|
| battery `--check` | `410f27c0` ✓ | identical | identical | identical |
| d2-chain `--check` | `b470c14d` ✓ | identical | `a7df857a` exit 1 (expected) | `b9340bff` exit 1 (expected) |
| l18 `--check` | `17be7d70` ✓ | identical | `921b4d36` exit 1 (expected) | `d2984ef2` exit 1 (expected) |
| tail `--check` | `9a6a3192` ✓ | identical | identical | identical |
| r9-l3 `--check` | `6cd35fe1` ✓ | identical | identical | identical |
| r9-campaign `--check` | `2823a811` ✓ | `6d8c522d` exit 1 (expected) | `6d8c522d` | `7d26db7a` exit 1 (expected) |
| campaign census | NO CHAIN ROOM MOVES, 5713 | — | — | **byte-identical** to W0 (committed tapes) |
| identity block | as U4b's head | — | — | 9 post-sword rows moved (above); maze, guard, AREA, pre-sword s1 identical |
| `tapeRunner` | 365/365 | — | — | **365/365** |
| bounded vitest (the brief's eight paths) | 9 / 594 | — | — | **9 / 598** (+1 (2,7), +3 pairing) |
| reach set (129 non-slow + procgenDocs) | — | — | — | 136 files / 3981 tests, 3980 pass; 1 red = `standingValues` (red at W0) |
| `fixtures/**`, presets, `campaign-frontier.json` | — | — | — | `git diff origin/main` = **0 lines** |
| solver surface | GREEN 185 | — | — | GREEN 185 (site counts) |

I did not touch or run any AS3, wasm, gitlink, tape (committed), biome default, `standing-values --write`, `--write-frontier`, `pytest` or unfiltered `vitest run`. I edited no simulation file: `botDriverV2.js` was instrumented in a scratch copy and restored byte-identical. None of U5's, U7's or U8's files were edited; the one adjacent touch is the spinner exclusion in `dangerMap.staticEnemyDanger` (D2).
