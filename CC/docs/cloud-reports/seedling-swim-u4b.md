# Seedling swim U4b: the solver's three remaining walls (the refuge window, the step-out, transit safety)

**Slice:** `seedling-swim-u4b`, a cloud fan-out worker for the swim arc (plan `seedling-swim-plan.md` §15).

| | |
|---|---|
| Started from | `origin/main` @ `e048567718` (the brief's expected SHA) |
| Harness branch | `claude/seedling-swim-u4b-walls-bpgcxy` (the harness pins this branch) |
| Commits | D1 `f60a827` · D2 none (STOP) · D3 `a5b429b` · D3b `50702ae` · D4+D5 records and this report (the last commit) |
| Parallel sibling | U4 (the ladder's chaser/static arm, the AVOID rung, `procgenSeedling.js` / `procgenOracle.js` / `sweep-yield-table.mjs`, the survey). None of those were touched here. |

## Headline

| D | Verdict | One line |
|---|---|---|
| W0 | **PASS** | Every banked row reproduces U3's values. |
| D1 | **PASS, as a different shape** | The refuge's window was not the wall. `clearOfHammersAt` priced forecast row `i` at the NEXT tick's hammer phase. Paired at `gameTimeAt(i)`, **(7,6) SOLVES in 213 t**. No moving refuge was built. |
| D2 | **STOP** | A deeper step-out cannot help: at (2,7)'s refusal all ten key sets fail on the first tick. The corner is made by an un-priced dwell. Pricing it solves (2,7) in 266 t but re-routes the committed L18 fight (`r9-campaign --check` exit 1). Nothing shipped. |
| D3 | **PASS (the bound) / STOP (the transit clock)** | Both rooms had a strike later in tick order. The kill admission now continues past the bounded pass, so **(3,6) SOLVES 226 t and the CORRIDOR arm SOLVES 225 t**. The transit clock (`dangerMap.spinnerDanger`) carries the same one-phase offset, but pairing it moves committed L18, so it did not ship. |
| D4 | **PASS, with seven measurement rows moved (explained)** | Census chamber post-sword 11/12 (U3: 9/12), CORRIDOR SOLVES. The corridor body certifies 74 → 93, and *"nowhere to be"* goes 18 → 0. Seven post-sword identity rows moved: each is a spinner gadget that was refused and now certifies. |
| D3b | **PASS (a defect D1 unmasked)** | The kill-lock press arm never asked for the sword. D1 removed the wall that had been refusing for it, and a without-sword arm pressed 278 times. It now refuses by the SUB-ORDER. |
| D5 | **PASS** | Log section, the `seedling-bot.md` sentences, surface table GREEN 185, reference and docs index regenerated, bounded vitest over the reach set green except the one red that is also red at W0. |

**The one thing to know first.** The kill arm's hammer test was **one phase ahead of the run's own contact**. `advance` steps the spinners, bills their contacts at `clock.now()`, and only then ticks. So forecast row `i` swings at `gameTimeAt(i)`, but every solver-side query asked `gameTimeAt(i + 1)`: `clearOfHammersAt`, `safeStep`'s hand clock, and `dangerMap.spinnerDanger`. `spinnerClockPairing.test.js` drives the law over a 27-placement scan. The same-index pairing names the first hammer hit 27/27; the old pairing missed 20 of them (17 by one tick, 3 entirely). D1 fixes the solver's half. **The danger map's half is still one phase ahead.** Pairing it is correct by the same row, but it walks committed L18 (`r8-solve-18`) into the step-out wall (D2). So the next lever is one ruling: a licence to re-record L18, which then admits both the dwell pricing (D2) and the transit pairing.

## W0: the banked rows (clean tree `e048567`, a pristine worktree)

| Row | Result |
|---|---|
| identity block (`SEEDLING_PORT=8850`) | maze `246dfbce…`, acceptance `4330bad7…`, c3 `fa0dc4bb…`, c6 `f5c9ece7…`, c4 `3bacdc9e…`, ENEMY `4ce6c5b3…`, guard `a6d18d49…`, AREA `06b14d5d…`, killgate s2/s5/s9 `1b4eab8e…`/`b018ab2b…`/`65e81dd3…`, level pre/post s1 `e28c1e5d…`/`9219ff91…`. All equal U3's table. |
| generated set | OK (run with the primary venv, since a worktree has none) |
| six r8/r9 `--check`s | `410f27c0` `b470c14d` `17be7d70` `9a6a3192` `6cd35fe1` `2823a811`, all exit 0 |
| campaign census | exit 0, `NO CHAIN ROOM MOVES` |
| solver surface | GREEN 185 |
| reference `--check` | the worktree reads "4 DIFFER" (U3's recorded worktree artifact); the main tree reads ALL MATCH |
| bounded vitest (the brief's five paths) | **5 files / 161 tests**, green |
| twelve positions + CORRIDOR | U3's table exactly. Post-sword 9/12 (154/221/123/142/150/123/123/234/235 t); (7,6), (2,7), (3,6) and CORRIDOR refuse by U3's texts. Pre-sword 6/12 at 218 t. |
| corridor-body sweep post-sword | 168 cells: **135 placed / 74 certified / 59 named**. By text: 18 *"nowhere to be"*, 6 *"no step out"*, 25 ladder EXHAUSTED, 6 *"the danger map forbids"*, 4 other. Harness: 11 TIMEOUT, 9 THREW (all PhysicsV2 pit class). |
| roam yield | pre-sword 10 placed / 8 certified; post-sword 9 / 8 (1 roaming refusal, 3 throws) |

⚠ The sweep ran sharded three ways (the 4-core box). Its 120 s per-cell budget is wall-clock, so two `open` 14x14 cells that certified in U3's serial run timed out here. That is why W0 reads 135/74, not 137/76. D4 ran with identical sharding, so the before/after is like for like.

## D1: the refuge's window was not the wall; the clock was

**Measured first** (instrumented copy, reverted; the tree was clean after):
- At (7,6)'s refusing tick (t 64), **39 walkable cells were clear for the whole 45-tick window**. The brief's premise ("no cell is") does not hold.
- `deriveRefuge` returned null because **all 12 candidate previews STALLED for 400 ticks**, even to a cell 2.3 px away. The player had been **hit** at t 64 (`playerHits`: `spinner-hammer`, `hits 1`, `hitsTimer 19`), and `levelRun.previewStepper` freezes `steerBlocked: !canSteer(damage)` for the whole preview.
- The hit was a live-arm press that `safeStep` had priced clear. At t 62 it asked the box at P(63) against forecast row 1 at `Game.time` **4885**. The run billed that same pair at **4884** (`stepSpinnerContactsNow` runs after `stepSpinners` and before `clock.tick()`).

**The law, driven** (`spinnerClockPairing.test.js`, new):
- A player stands still in the census chamber until the first hammer hit. At every tick, the row predicts the hit with forecast row 0 at `gameTimeAt(0)` and at `gameTimeAt(1)`.
- A scan of every body cell × five stand cells gave 27 placements whose first contact is the hammer. The same-index pairing named the hit tick **27/27**. The old one missed **20** (17 one tick early, 3 never).
- The row pins three of them, one of each shape.

**Shipped:** `clearOfHammersAt` pairs row `i` with `gameTimeAt(i)` (one index). `safeStep`'s one-row forecast keeps its hand-built clock, which now resolves to `gameTimeAt(1)`. The docblock says why and what it cost.

| position (post-sword) | W0 | D1 (predicted → measured) |
|---|---|---|
| (7,6) | REFUSED *"… nowhere to be."* | predicted SOLVES → **SOLVED 213 t**, certified, 1 kill, 3 landings |
| (5,5) | SOLVED 234 | predicted "may move" → **245** (a different first strike; the old one was clear only against the next tick's hammer) |
| (6,6) | SOLVED 235 | → **232** |
| (2,7) (3,6) CORRIDOR | REFUSED | still REFUSED, same classes. Counts and positions shift: (2,7) at (86.53,83.57); 44 → 43; 40 → 41 |
| the other eight | SOLVED | byte-identical |
| pre-sword, all 13 | | byte-identical |

- The six `--check`s are byte-identical.
- **Mutant:** the index back to `i + 1`, one build, copied and restored md5-identical (`4e4122f3…`). Predicted: (7,6)'s text is byte-identical to W0 and two rows go red. Measured: `BYTE-IDENTICAL`, 2 red ((5,5) and (7,6)).
- **No moving refuge was built.** The measurement named no window to widen, and a refuge schedule would have been code for a wall that isn't there.


## D2: the step-out (STOP)

**Measured:**
- At (2,7)'s refusal (t 152, (86.53,83.57)), **all ten key sets** land on the body's rect or the hammer line on the first tick: the plan's own, the five alternatives, the four diagonals and the press. A deeper step-out cannot exist from that state, because every path fails its first tick.
- The corner is made earlier. The strike is (88,88) with the press at +12, so the walk arrives around +5 and then WAITS in the billiard's path. `deriveStrike` prices the transit (`dangerDuringTransit`) and the train (−2 … +6 around the press), but **never the dwell between arrival and the aim tick**. That is trap 154's question (*a wait is priced over its own window*), un-asked.

**Tried** (each one build, restored after):

| variant | (2,7) | the rest of the census | committed L18 |
|---|---|---|---|
| dwell priced (`clearOfHammersAt` over `[eta, i − 2)`) | **SOLVED 266 t**, certified | byte-identical | ⛔ `r9-campaign --check` exit 1: `r9-solve-18` *"There is no step out."* at (137.99,96.15). After a landing the knocked-back body rebounds up x≈128.7 at ~4 px/tick into the walk. |
| + `stepToward` escalates to the diagonals at depth 4 | SOLVED 266 | byte-identical | still exit 1, now at (139.26,94.36) |
| + that escalation at depth 6 | SOLVED 266 | byte-identical | solves, but **394 → 432 t**: the chain moves 5713 → 5751 (a tape move) |
| the escalation alone (no dwell) | REFUSED, text byte-identical to D1 | byte-identical | byte-identical |

**Verdict: STOP.** The fix the measurement names is the dwell. It moves the committed L18 route, and that re-record is not this slice's licence. The escalation alone changes no measured row, so shipping it would be code nothing needs. (2,7) stays the one post-sword census refusal.


## D3: transit safety

**Measured first:** every opportunity, and why its transit failed.

| room | opportunities | where | why the transit failed | under the same-index transit clock |
|---|---|---|---|---|
| (3,6) | 43, from one derivation at t0 0 | four cells: (104,56) +104…+111, (104,40) +116…+126, (104,72)/(88,56)/(120,40)/(120,56)/(88,72) +119…+126 | all 43 on the **HAMMER** arm, at +57, +63 or +71 of the walk | 42 still fail at the same tick; 1 ((88,72) +126) clears |
| CORRIDOR (4,1) | 41, one derivation | all down the far leg: (136,56) +146…+160, (136,88) +151…+165, (136,72) +169…+176, (136,104) +174…+176 | all 41 on the **BODY** arm at +89, (129.7,28.5): the walk meets the billiard at the corner | 41 fail at the same tick |

Neither is a corridor that is unwinnable in this model. In both, the bounded pass spent `STRIKE_CANDIDATES` on a few cells at consecutive ticks, and a strike existed later in tick order. **The wall was the bound.**

**Shipped:**
- `deriveStrike` spells the (cell, tick) test once (`opportunityAt`). It caches one walk per cell, because the preview and its transit verdict never read the tick.
- `{continuation: true}` continues past the bounded pass in tick order to the horizon. It asks the same four conditions, and its budget is counted in **distinct cells previewed** (`STRIKE_CANDIDATES`, 40, named in the refusal: *"The scan then CONTINUED … previewed N more cell(s) (bound 40)"*, only when it previewed any).
- It is asked **only by the kill rung's admission** (`derivePressKill`), once. `execKillByPress` adopts a strike only that continuation found. Its per-tick re-derivations stay the bounded pass.
- Why only there, measured: with the continuation on every derivation, L18's `r8-solve-18` re-plans **485 → 416 t** (a tape move), and every refuge tick would pay a 640-tick scan.

| room | D1 | D3 (predicted → measured) |
|---|---|---|
| (3,6) | REFUSED, 43 opportunities | predicted SOLVES → **SOLVED 226 t**, certified, 3 landings; the continuation found (88,88) at +142 after **1** more cell |
| CORRIDOR (4,1) | REFUSED, 41 | predicted SOLVES → **SOLVED 225 t**, certified, 3 landings; found (120,24) at +399 after **4**, and the live arm pressed as the body came back |
| every other row, both boots | | byte-identical |

- The six `--check`s are byte-identical.
- **Mutant:** `continuation: false`, one build, restored. Predicted: both texts byte-identical to D1. Measured: exactly that.
- **Unit rows:** `solverSpinnerKill.test.js` gains (3,6), the CORRIDOR arm post-sword, and the CORRIDOR arm pre-sword (REFUSED, the kill line the SUB-ORDER). `procgenCorridorBody.test.js`'s refusing position moves `rooms` s2 → s6, because s2 certifies now.

**⛔ The transit clock: STOP.** `dangerMap.spinnerDanger` prices horizon `h` (forecast row `h − 1`) at `gameTimeAt(h)`. That is the same one-phase offset D1 fixed, and the pairing row reds on it (3 of 3 with it unpaired). Paired (`gameTimeAt(h − 1)`), it solves (3,6) on its own. But it moves committed L18 under every configuration measured:

| configuration | d2-chain | l18 | campaign |
|---|---|---|---|
| D1 + transit pairing | `5ba47d19` exit 1 | `0ffa5fac` exit 1: `r8-solve-18` *"There is no step out."* at (140.64,55.73) | `2823a811` ✓ |
| D3 + transit pairing | `4176ab7d` exit 1 | `8e555e80` exit 1 | `2823a811` ✓ |

It is the D2 wall again, so it waits on the same licence. Until then the danger map's transit arm is one phase ahead of the solver's own hammer test. The fact is recorded here, in the log and in `seedling-bot.md`. `dangerMap.js` itself is unchanged: a comment there without the code would describe a fix that isn't there.


## D3b: a defect D1 unmasked, the kill-lock press arm pressing with no sword

The bounded vitest over the reach set (`reach-seedling-change`, 127 non-slow files) found `procgenKillGateDemand`'s seed 14 `--require=hasSword` grading **BOUND-DEPENDENT, not STRONG**. It is red at D1 as well; my D1 bounded set did not include the file.

- **Measured:** the lock-less arm asks `primaryWeapon` before it calls `derivePressKill`, but the kill-lock arm (`execKill`) never did.
  - At W0 the without-sword arm refused only because *"nowhere to be"* fired first.
  - At D1 that wall is gone, so it **planned 278 strikes, landed 0**, and exhausted the 2010-tick bound.
- **Shipped** (`50702ae`): `derivePressKill` refuses by the SUB-ORDER in the lock-less arm's own words when `primary` is not the sword.
- **Ordering, measured twice:**
  - Asked first, `r9-campaign --check` drifted on `r8-solve-5`'s committed **trace**, because L5's kill lock has no live spinner and its trace records *"tracks NO live spinner bodies"*.
  - Asked after that, `solverBot.test`'s A3 row went red, because an un-modelled body must name `KILL_ARM_POLICY` first.
  - So it is asked **last**, just before the first strike derivation.
- **Result:** seed 14 is STRONG again. The census moved 0 rows against D3, the six `--check`s are byte-identical, and the identity block is byte-identical to D3's.
- **Re-pointed, by their own sweeps:**
  - `procgenCountableClock`'s hammer-safety vehicle (4,1) → (1,3). The row's own 31-cell geometry had **12** HAMMER SAFETY cells at W0 (10 *"nowhere to be"*) and **1** at head: (1,3), *"There is no step out."*
  - `procgenRoam`: `winding` 14x14 s12 post-sword now **certifies** (650 t, `[kill, collect]`); the pre-sword half still refuses by name.

## D4: the census, the yield, the witness

**Twelve positions + CORRIDOR** (`solve` exactly as `census-seedling-enemies` and `solverSpinnerKill.test.js` solve them; first lines in the D sections):

| position | post-sword W0 | post-sword head | pre-sword W0 → head |
|---|---|---|---|
| (4,4) (7,2) (2,3) (3,3) (7,7) (5,2) | SOLVED 221/123/142/150/123/123 | unchanged | SOLVED 218 ×6, unchanged |
| (5,5) | SOLVED 234 | **245** (D1) | REFUSED by the SUB-ORDER, unchanged |
| (6,6) | SOLVED 235 | **232** (D1) | same |
| (2,2) | SOLVED 154 | 154 | same |
| (7,6) | REFUSED *"nowhere to be"* | **SOLVED 213** (D1) | same |
| (2,7) | REFUSED *"no step out"* | REFUSED *"no step out"* (the D2 wall; position (86.53,83.57)) | same |
| (3,6) | REFUSED *"no (cell, tick)"* | **SOLVED 226** (D3) | same |
| CORRIDOR (4,1) | REFUSED *"no (cell, tick)"* | **SOLVED 225** (D3) | same |
| **post-sword total** | **9 / 12**, CORRIDOR refused | **11 / 12**, CORRIDOR solves | **6 / 12**, byte-identical |

**Corridor-body sweep, post-sword** (U3's command, sharded identically before and after; D3 head `a5b429b`, which the D3b gate cannot move because every post-sword run holds the sword):

| | W0 | head |
|---|---|---|
| cells | 168 | 168 |
| placed | 135 | **144** |
| certified | 74 | **93** |
| named `the-solver-cannot-cross-the-roaming-body` | 59 | **47** |
| … *"nowhere to be"* | 18 | **0** |
| … *"There is no step out."* | 6 | 10 |
| … ladder EXHAUSTED | 25 | 25 |
| … *"the danger map forbids"* | 6 | 8 |
| … other | 4 | 4 |
| TIMEOUT (120 s) | 11 | 2 |
| THREW `GenerationAborted` | 9 | 15, **all** the PhysicsV2 pit class (swim T2's, U4's region) |

Per kind × size, placed/certified/named at head: empty 12/11/0 · 11/9/1; branchy 11/10/1 · 9/4/5; bushy 12/6/6 · 11/5/6; loopy 8/4/4 · 11/7/3; open 6/4/2 · 7/6/0; rooms 11/8/3 · 12/7/5; winding 12/6/6 · 11/6/5. Twenty cells certify at head that did not at W0: 12 were named refusals, 8 were TIMEOUTs.

**Predicted vs measured.** I predicted the D1 and D3 levers would retire *"nowhere to be"* and would not touch the step-out, the ladder or the danger map's own refusals. Measured: *"nowhere to be"* 18 → 0 and EXHAUSTED unchanged, as predicted. *"No step out"* **rose** 6 → 10: cells that got past the refuge now meet the D2 wall. That rise is the measurement behind D2's STOP.

**Roam yield** (F1b's command, both palettes, W0 and head side by side):
- **pre-sword:** 10 placed / 8 certified at both, per-cell identical.
- **post-sword:** **9 / 8 → 10 / 10**. The one roaming refusal (`winding` 14x14 s12) and one throw (`branchy` 14x14 s12) both certify now.
- The brief's "roam 10/8 unchanged" holds for pre-sword only.

**Witness** (`check-seedling-wasm-element.mjs --elements=corridorbody --biome=post-sword --seed=2 --skeleton=branchy --width=10 --height=10 --areas=0 --host=http://localhost:8850`, headless logic-only):
- The seed was chosen because it is certified at head and refused at D1, so its certification uses the D3 continuation.
- `corridorbody_door` at (4,6), `killLockCell` null, certified in 364 t by `[kill, collect]`.
- **Agrees per tick (365 observations)**, end Δx 0 Δy 0, game 364 = certification 364, **0 FAILURE(S)**.
- `rooms` 10x10 s2 (certified from D1 on, 216 t) was the D1 candidate.

## The identity block (W0 → head)

| row | W0 `e048567` | head `50702ae` | why |
|---|---|---|---|
| maze | `246dfbce…` | identical | |
| **acceptance batch** | `4330bad7…` | **`d02ed4c0…`** | post-sword seed 1: the kill gate that W0 refused (*"no (cell, tick) … 40 opportunit(ies)"*) now certifies. Skeleton 81 → 410 t, final 122 → 444, templates `pit×3 wall×3` → `pit×3 water×1 wall×2`, grade *none established* → **requires Progressive Sword (STRONG)**. |
| **c3** | `fa0dc4bb…` | **`d43a8c97…`** | two post-sword lines: seed 1 (81→122 → 410→444) and seed 17 (83 → 347) |
| **c6** | `f5c9ece7…` | **`62b5475f…`** | the same two seeds |
| **c4** | `3bacdc9e…` | **`556eb1ee…`** | two post-sword lines: rooms s5 (124 → 322), branchy s1 (122→203 → 675, SATURATED) |
| **ENEMY census** | `4ce6c5b3…` | **`fdff69ee…`** | the spinner CORRIDOR arm REFUSED → **SOLVED 257** (`kill, collect`); roll-up 19/3/1 → 18/4/1 |
| guard | `a6d18d49…` | identical | |
| AREA | `06b14d5d…` | identical | |
| killgate s2 / s5 | `1b4eab8e…` / `b018ab2b…` | identical | |
| **killgate s9** | `65e81dd3…` | **`999e1900…`** | empty s9 DROPPED → **SOLVED**; placed kill gates 0 → 1 of 2 |
| level pre-sword s1 | `e28c1e5d…` | identical | |
| **level post-sword s1** | `9219ff91…` | **`0076f26f…`** | the acceptance row's level: it now ships its kill gate. D1 alone moves only the text (40 → 41 considered). |
| generated set | OK | OK | |
| six `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | **identical**, exit 0 | |
| reference `--check` | ALL MATCH (main tree) | ALL 7 + 5 MATCH (main tree, after the regeneration) | |

Every mover is **post-sword**, and each one is a spinner gadget that was refused and now certifies. No pre-sword row moved. This is R9 slice 11's pattern: *"generating a level runs the certify solve"*. They are measurement rows, not committed artifacts, and the standing values are the coordinator's (`standing-values --write` was not run).


## Surface table delta (185 → 185, `--check` GREEN)

No new row. Site counts only: `run:ticksCompleted` 27 → 30 and `import:presses.js#SLASH_HIT_TICKS` 12 → 13 (D3), and `run:progress` 50 → 51 via `primaryWeapon` (D3b). `census-seedling-constants`: no new named constant (the continuation reuses `STRIKE_CANDIDATES`).

## What the brief got wrong (measured)

1. **"(7,6): in a 6×6 chamber no cell is [clear for 45 t]."** 39 were. The refusal was a stalled preview after a hit, and the hit came from a clock pairing one phase ahead. A moving refuge would have been built for a window that was never the wall.
2. **"`stepToward` looks ONE tick ahead."** It looks four (`STEP_LOOKAHEAD`). The refusal *"There is no step out."* is `safeStep`'s. At (2,7) no depth helps, because all ten key sets fail on the first tick. The corner is made by the un-priced dwell.
3. **"If the corridor is unwinnable … STOP."** Neither (3,6) nor the corridor is unwinnable. Both had a strike later in tick order, so the wall was the bounded pass (`STRIKE_CANDIDATES` spent on a few cells at consecutive ticks).
4. **"Byte-inertia: every [identity] row must be identical."** Seven post-sword measurement rows moved, each a spinner gadget that now certifies (table above). The committed routes (six `--check`s, the campaign census, `fixtures/**`) are identical.
5. **"roam 10/8 unchanged."** Pre-sword, yes. Post-sword 9/8 → 10/10.
6. **The trap entries** ("`docs/json/developer/procgen/traps/`, the next number"): no such directory in this clone, and the catalogue that numbers traps (to 973 in code comments) is not here. The candidates are below for the coordinator to number.
7. **The bounded vitest's five paths** are 5 files / 161 tests, and the reach set is 127 non-slow files.

## Trap candidates (for the coordinator to number)

- **The forecast row and the clock row are the same index.** `spinnerForecast[i]` is billed at `gameTimeAt(i)`, because `advance` bills before it ticks. An off-by-one there is right 44 times in 45, and it prints as the wrong wall (*"nowhere to be"*).
- **A wall that fires first can hide a missing precondition.** The kill-lock press arm never asked for the sword; the refuge wall refused for it, until the wall moved.
- **A cell's walk does not depend on the tick.** A bound counted in (cell, tick) pairs can spend itself on one cell forty times.

## Residue

- **One ruling unlocks two fixes:** a licence to re-record L18 (`r8-solve-18` / `r9-solve-18`).
  - D2's dwell pricing solves (2,7) in 266 t.
  - The transit clock pairing (`dangerMap.spinnerDanger` at `gameTimeAt(h − 1)`) is correct by `spinnerClockPairing.test.js`.
  - Both re-route committed L18 into the step-out wall, and with the depth-6 escalation L18 solves in 432 t (chain 5713 → 5751).
  - The continuation on every derivation would re-plan L18 at 416 t (485 today).
- **The transit arm is still one phase ahead** of the solver's hammer test (above).
- **The step-out wall** is now the main press-kill refusal: 10 of the sweep's 47 named refusals, and (1,3) in the countable-clock geometry.
- **`previewStepper` freezes `steerBlocked` for a whole preview.** After a hit every walk preview stalls for 400 ticks. It is a simulation file (`levelRun.js`), so it was not touched. With D1 no planned press should be hit, but the stall is still how a hit would present.
- **The pit-class throws** grew 9 → 15 of 168 (more cells get far enough to meet a pit). That is swim T2's `pit-patch` with no control block, in U4's region.
- **`standingValues.test.js`**, *"a gate that sleeps past the deadline is KILLED"*, is red at W0 as well (the container's process-group kill). It is pre-existing and not touched.
- **Scratch instruments** (session scratchpad): `probe.mjs` (the twelve + CORRIDOR, full texts), `m1*`/`m2`/`m3*` (the instrumented measurements), `sumsweep.mjs`, `scan2.mjs`, and the bank scripts.

## Byte-inertia

| artifact | W0 `e048567` | D1 `f60a827` | D3 `a5b429b` | D3b `50702ae` (head of code) |
|---|---|---|---|---|
| six r8/r9 `--check`s | `410f27c0 b470c14d 17be7d70 9a6a3192 6cd35fe1 2823a811`, exit 0 | identical | identical | identical |
| campaign census | exit 0, NO CHAIN ROOM MOVES | — | identical | identical (content, paths normalised) |
| identity block | as U3 | — | 7 post-sword measurement rows moved (explained above) | identical to D3 |
| generated set | OK | — | — | OK |
| census chamber, pre-sword (13 rows) | 6/12 at 218, CORRIDOR refused | identical | identical | identical |
| `fixtures/**`, presets | — | — | — | `git diff origin/main` = 0 lines |
| solver surface | GREEN 185 | GREEN 185 | GREEN 185 (site counts) | GREEN 185 (site counts) |
| reference `--check` (main tree) | ALL MATCH | — | — | ALL 7 + 5 MATCH after regeneration |
| bounded vitest | 5 files / 161 (the brief's five) | 7/7 touched rows | 6 files / 168 | 134 files (the 127 non-slow reach files + `procgenDocs`) / 3909 tests: 3908 pass, 1 red = `standingValues` (red at W0 too) |

No AS3, wasm, gitlink, tape, biome default, `standing-values --write`, `pytest` or unfiltered vitest was touched or run. None of U4's regions (the chaser/static arm, the AVOID rung, `procgenSeedling.js`, `procgenOracle.js`, `sweep-yield-table.mjs`, the survey) were touched. `dangerMap.js` is unchanged at head.

