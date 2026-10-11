# Seedling fidelity L30KEYLOCK: the key line was a wait nobody priced

**Slice:** `seedling-fidelity-l30keylock`, an Opus build slice run in the cloud for the model-fidelity arc (planner
`seedling-fidelity-planning-5`), wave 12 (model coverage).

| | |
|---|---|
| Started from | **`26cb831828`** (main with the JS arc's encounter binding) |
| Head | the last commit on the branch (this report is committed last) |
| Harness branch | `claude/seedling-l30-keylock-v0becp` (the harness branch IS the slice branch) |
| Commits | D1+D2 `bc33577` · roster records `3e59a25` · D2 revision (dash certified with the wait) `a6dda35` · **the flip `89a6aed` (separable)** · records `dfc785e` · this report (last) |
| Dev servers | `serve-nocache.py 9620` (this tree), `9621` (a pristine BEFORE worktree `/home/user/wt-base` @ `26cb831828`, `node_modules` and submodules symlinked) |
| Verdicts | **W0 PASS · D1 PASS · D2 PASS (both switches ON by default in `89a6aed`; nothing committed moves; drop that commit to ship them OFF) · D3 PASS** |

## The one thing to know first

**The BobSoldier was never the wall; the WAIT on the key line was.** `execKeylock` stands on `bosslock@64,32`'s key
line for its 60-tick `keyTimer` plus fade (~80 ticks) and checks nothing but the opening. The BobSoldier, beside the
lock, reaches the player inside that wait from both pit landings. From (224,80) the base solver's own walk was hit
twice, and the survey only saw the next gate's refusal. From (240,80) it was hit three times and died. Two switches
fix it: price the wait as the stance walk's tail, so the ladder climbs, and let the chaser arm scan the body's box,
so the kill rung has a stance. Both ON: kill, then the lock, then the crossing, with 0 hits on the game. Steps 52, 78
and 87 go REFUSED → SOLVED, and nothing committed moves.

## W0 (at `26cb831828`, before any edit, in the pristine worktree)

| Row | Command | Result |
|---|---|---|
| identity block | `SEEDLING_PORT=9621 bash scripts/procgen/identity-block.sh .` in `/home/user/wt-base` (venv active) | maze `246dfbce…`, acceptance `76602ae8…`, c3 `4937da80…`, c6 `430573e9…`, c4 `b9d2185d…`, ENEMY `30bcc49c…`, guard `a6d18d49…`, AREA `02b22525…`, killgate s2/s5/s9 `006b0639…`/`7d4cb820…`/`49e23d85…`, level pre/post s1 `e28c1e5d…`/`fb1a59e5…`, generated set OK; reference "4 DIFFER" (this container's uninitialised substrate submodules). Log: `…-evidence/w0-identity-26cb831828.txt` |
| six producers | the block's loop | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, **all exit 0** |
| tapeRunner pairs | `vitest run tapeRunner.test.js --reporter=json`, rows `(fullName, status)` sorted, `name\tstatus\n` joined, md5 | **589**, md5 **`8cb21cd9950584e5bd35e8b3b36490d4`**, 0 non-pass |
| surface / constants | the two `--check`s | GREEN 234 / PASS 5,488 literals |
| entities / profile | not run: both drive a browser, and the box was held by the identity block and the game witnesses for most of the slice. Nothing they read moved (no AS3, wasm or model-of-the-game change). | — |
| roster | `fixtures/tapes/index.json` | 266 |
| bounded vitest BEFORE | 70 files: the brief's list, BOBSOLDIER2's 57, and every `grep -a` hit for what I touch (`deriveKillByChaser`, `previewWalk`, `execKeylock`, `keylock`, `standFor`, `KILL_STANCE_AS_FORECAST`, `resolveKeylockStrategy`, `bosslock@64,32`): + `fidelityBobSoldier2 fidelityForkHygiene fidelityStance activators presses procgenCountableClock procgenPostSword r5Chain solverBotLethalPit seedlingPlaythroughOverlay seedlingSemantics seedlingBossLockCensus surveyFamily` (list: `/tmp` → reproduced from the names here) | **70 files / 2,236 tests, all green** |

## D1: the measurement (PASS)

**The rung-by-rung refusal at step 52** (`--through=end --route=full --only=52`, reproduced locally; staging rebuilt
by `plan-seedling-l30keylock.mjs`, byte-equal to the survey's step-52 boot view on all 12 fields):

| rung | why it refused (base) |
|---|---|
| avoid | *"the danger-forbidden corridor STILL probes dangerous at (71.7,57.4) — chaser:bobsoldier@48,80 (the sword …)"* |
| time | *"the aim is 163 px away and `MOVER_RANGE` … 48 px"* |
| bait | *"17 cell(s) in leash, 0 of them crossing a region"* (L30 has no kill region) |
| kill | ceiling arm: 0 pressers. **Chaser arm:** *"14 cell(s) inside its 80 px leash, 7 of those reachable and with a corridor onward, and 7 of THOSE refused by the forecast [(120,104): still standing after the whole 115-tick ceiling; (120,120): the WAIT is dangerous at tick 220; …]"* |
| detour | **solved**: vias (216,88), a 211-tick undashed walk to the keylock stance (72,56) |

So the climb ended in a certified DETOUR. Then:

- `execKeylock` leaned onto the key line (t133) and stood there.
- `bobsoldier@48,80` landed a **sword hit at t173** and a **body hit at t193**.
- The lock opened at t212 (touch + 79).
- Only then did the next walk's gate refuse: *"the danger map forbids (71.77,50.12) … one forecast tick on"*. That is
  the survey's text.

The survey reported a refusal, but the walk had already been hit twice.

**Why the kill rung had nothing to offer.** `deriveKillByChaser` scans ±8 cells around the PLAYER. From the pit
landing that box holds only the leash's far-east rim (x 104..128, 70–80 px from the body). U10's target-centred
fallback runs only when the box holds no leash cell at all. Step 50's own stance (88,56) and every cell beside the body
were never asked.

**The other pit landing, (240,80):** the base corridor probe is clean (it prices transit only), so no ladder runs. The
player stands on the key line from t~124, takes hits at t151, t175 and t193, and **dies** (respawn at (248,88)). The
refusal reads *"bosslock@64,32 did not open inside its own derived bound of 110 ticks … and the key line was touched"*,
which hides the death.

**The answer to the brief's question:** no. The player cannot reach the key line and open the lock before the chase
reaches them. The lock needs ~80 ticks on the line, and the BobSoldier arrives within ~20–40. It needs a kill first
(or a timed approach that keeps the body away for the whole wait).

**On the game (p4f, headless, port 9620):** `l30keylock-pit224-before` is the base solve's 212 driven keys.
- `check-seedling-bot-differential --record --only=l30keylock-pit224-before`: *"THE MODEL REPRODUCES THE RECORDING IT
  JUST MADE — 213 observations"*. The game's own `hits` is 2 and the model's is 2. `save.time` game 8819 = model 8819.
- `probe-seedling-bobsoldier-mobiles --tape=l30keylock-pit224-before`: clock shift [0]. The BobSoldier's position,
  velocity, `hits` and `hits_timer` match the model at every tick: **212 comparisons, worst |Δ| 0**.

**Not the hammer arc's:** `chooseBodyToRemove` is not involved (the chaser arm reads `interceptOrder`'s head, and the
body is found). Nothing was handed over.

## D2: the fix (PASS — two switches; ON by default in the separable commit `89a6aed`)

**D2a `KEYLOCK_WAIT_PRICED`** (`solverBot.js`; env `SEEDLING_KEYLOCK_WAIT_PRICED=0` turns it off;
`withKeylockWaitPriced`). The frontier's keylock stance walk (`walkTo` on `plan.resolved.stance` when
`plan.strategy === 'keylock'`) carries `stand = {ticks: hold.ticks, keys}` (`keylockStandWalk`). The tail is priced in
four places:
- the walk's own `probeCorridor`;
- the ladder's AVOID re-probe;
- DETOUR's `certify` (whole candidates only; a prefix ends at a via, and nobody waits at a via);
- every `planSwordDash` candidate.

`previewWalk` gains the opt-in `standKeys`. The tail then stands as `execKeylock` stands: it leans on one axis until
the player's box touches the key line, then presses nothing, and the strike policy is disarmed for the tail only.
`planSwordDash` gains the opt-in `stand`. The tail's samples go to `certify` only, so its tick comparisons and legs
read the walk alone. A wait that a body reaches is now a corridor hit, and the combat ladder climbs.

**D2b `KILL_STANCE_TARGET_RESCAN`** (env `SEEDLING_KILL_STANCE_TARGET_RESCAN=0`; `withKillStanceTargetRescan`). When
the player's box scored no stance, `deriveKillByChaser` also scans the TARGET's box (the cells the first box did not
hold), with the same four conditions and the same score. A scan that scored anything is unchanged. The refusal names
the rescan (*"the player's box priced no stance, so the TARGET's box was scanned too (+N reachable cell(s))"*).

**Two cuts that the measurements threw out:**

| cut | what happened | measured |
|---|---|---|
| the tail stood still with strikes armed | it repelled the body that the executor never strikes | (240,80): DETOUR certified a 369-tick corridor; the drive was hit at t286, t307 and t329 and died |
| the stance walk driven undashed (BOBSOLDIER2's "drive the priced walk") | ON, four producers re-derived longer | `r8-d2-19`; `r9-solve-12` 2364 → 2381, `-19` 746 → 767, `-30`, `-31`. Every one was a walk the game had played with 0 hits |

The kept design certifies each dash candidate with the tail instead. With both switches ON it moves no producer.

**The solver, switch by switch** (`fidelityL30KeyLock.test.js`, `plan-seedling-l30keylock.mjs --check`):

| switches | (224,80) = step 52 | (240,80) |
|---|---|---|
| both OFF (base) | REFUSED at the next gate, **walk hit 2×** | REFUSED "did not open", **walk hit 3×, dead** |
| rescan only | SOLVED 347, 0 hits (its corridor probe already climbs) | REFUSED, hit 3×, dead (no climb: the wait is unpriced) |
| wait only | SOLVED 309, 0 hits (a timed detour; the body dies to transit strikes) | REFUSED before a tick: *"keylock stance (bosslock@64,32): the combat ladder is EXHAUSTED"*, 0 hits |
| **both ON** | **SOLVED 347**: kill from (88,120) (dwell 26/57), key line t252, open t331, → L22 | **SOLVED 360**: kill from (88,120) (dwell 31/62), key line t265, open t344, → L22 |

**Mutants** (predicted first, made by copy → edit → restore; `solverBot.js` restored to `836fc824…` each time):

| mutant | predicted red | measured red |
|---|---|---|
| M1: the rescan branch never taken | RESCAN-alone, both-ON ×2, the direct-arm row | **exactly those 4** |
| M2: `standKeys` ignored (the tail stands still, strikes armed) | the `standKeys` unit row and WAIT-alone; "likely" both-ON 240 | the two named; both-ON 240 stayed green (after the kill no body reaches the wait). My hedge was wrong. |
| M3: `planSwordDash` drops the tail from `certify` | WAIT-alone (224's timed detour dashes into the wait) | **exactly that row** |

## D3: witnesses and census (PASS)

**Game witnesses** (both ON, the solver's own plans, authored by `plan-seedling-l30keylock.mjs`, `--check`
byte-identical). Both recorded on p4f.

| tape | recording | the BobSoldier probe |
|---|---|---|
| `l30keylock-pit224` (step 52's landing) | *"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 348 observations, 1 transition(s)"*; `hits` 0 = 0; `save.time` 8974 = 8974 | shift [0]; **202 comparisons, worst \|Δ\| 0** |
| `l30keylock-pit240` (the other pit landing) | 361 observations, 1 transition; 0 = 0; 8987 = 8987 | shift [0]; **218 comparisons, worst \|Δ\| 0** |

In both, the crossing into L22 is at 0 px (the differential compares every observation).

*The live arrival.* The live B's L30 arrival is a pit landing from L32 (the legs `in_pit_L32_14_5` / `_15_5` are
exactly these two points). I could not replay B's own session here: it needs the JS arc's B battery
(`seedling-probe.yml`). Its witness is the planner's dispatch below.

**The route survey, whole `--through=end --route=full`, local, head, OFF vs both ON** (`…-evidence/survey-through-end-{off,both-on}.json`):

| step | room | OFF | both ON | carried by |
|---|---|---|---|---|
| **52** | L30 → L22, pit (224,80) | REFUSED (the gate, d=4.7) | **SOLVED 347**, 0 hits | either switch alone solves it (347 / 309) |
| **78** | L12 → L37 (592,0), past `puncher@416,256` | REFUSED (*"the danger map forbids (445.99,258.00) — chaser:puncher@416,256"*) | **SOLVED 921**, 0 hits | `KEYLOCK_WAIT_PRICED` |
| **87** | the same crossing, a later visit | REFUSED (same) | **SOLVED 921**, 0 hits | `KEYLOCK_WAIT_PRICED` |
| 50 | L30 Torchpickup | SOLVED 460 | SOLVED 460 | — |
| every other step | | | **identical** (verdict, ticks, refusal text) | |

Headline 155 → **158/220**. (CI's run 38075646127 read 157 at `0b7a2e2536`. My local OFF is 155; its step 43 is a
local TIMEOUT. That is CPU, not this slice: step 43 is TIMEOUT in both OFF and ON.) Steps 78/87 are model-only
evidence; their game witness is owed (residue 2).

**Live sweep** (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --ids=172,174,327,333,339`; the
production `seedling_playthrough` page, p4f, headless. The browser takes the DEFAULTS, so before the flip the ON column
was run with both defaults flipped in the tree for the run only, `solverBot.js` md5 `836fc824…` restored after):

| leg | arrival | base | both ON |
|---|---|---|---|
| 172 / 174 | L12 → L37 | crossed 691 / 5 t | same |
| 327 | (176,48), Torchpickup | done 191 t | same |
| **333** | (224,80) pit, Torchpickup | **failed: EXHAUSTED (chaser arm: no stance)** | **done 237 t, 0 divergences** |
| **339** | (240,80) pit, Torchpickup | **failed: EXHAUSTED** | **done 247 t, 0 divergences** |

Legs 334/340 (*"L30 flag 0: bosslock@64,32 cleared"*) stay **unresolved**: the runtime does not execute `clear-tag` yet
(the JS arc's executor). That is why the sweep cannot show the L30 → L22 crossing itself; the survey and the game
witnesses do.

**Dispatches for the planner** (I cannot dispatch):
1. `seedling-survey.yml` on branch `claude/seedling-l30-keylock-v0becp`, inputs `through=end`, `route=full`,
   `only=50,52,78,87`. Expect 50 SOLVED 460, **52 SOLVED 347, 78 and 87 SOLVED 921** (the defaults are ON at the head).
   A full `through=end` run should read 158 + whatever CI's timeouts add.
2. The JS arc's divergence sweep (solver producer, `--mode=inv`) at the head: expect legs **333/339 failed → done**,
   everything else unchanged.
3. The JS arc's live playthrough B (`seedling-probe.yml` battery, logical-links B) at the head: expect B's L30 → L22
   step to clear the keylock (kill from (88,120), then the lock). It may then walk into its next wall. **This is the
   live witness of the L30 → L22 crossing from the live arrival.**

## Movers with the switches ON (the licence list): **none**

| row | both ON |
|---|---|
| identity block (13 generator rows + generated set) | **= W0, row for row** (`…-evidence/identity-both-on.txt`; and again at the flipped defaults, `after-identity-final-defaults-on.txt`) |
| six producers `--check` | **`405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`, all exit 0** (= W0) |
| every `plan-seedling-*.mjs --check` (46 with a `--check`; `r7-ends-meet` drives a browser, not run) | **byte-identical OFF vs ON** (`plans-off.txt` = `plans-both-on.txt`); three red identically in both, pre-existing (residue 4) |
| committed tapes, expectations, traces | none moved (only my 3 new tapes) |
| bounded vitest (71 files) ON by env | red only on this slice's own "OFF by default" pin, re-pinned in the flip commit; at the flipped defaults **71 / 2,251, all green** |

**Why the flip is in the branch.** The brief says flag OFF if anything committed moves. Nothing does, and the bounded
set ran with the switches ON. The flip is `89a6aed` alone (the two `enabled` lines, their docblocks, and the default
pin). **Drop that commit to harvest the slice with both switches OFF;** nothing else depends on it. CI ran the
unfiltered suite at the flipped head (below).

## For the JS arc: pins, fields and words

- **No signature or contract moved.** `solveSegment`, `twoPassSolve`, `PendingDeclaration`, `createRunForStaging`
  are untouched. There is no new `SolverRefusal.obstacle.kind` and no new `DEADLINE_SITES` row. The rescan's cells are
  asked under the existing `kill-chaser` fine site.
- **New exports** (`solverBot.js`): `KILL_STANCE_TARGET_RESCAN`, `withKillStanceTargetRescan`, `KEYLOCK_WAIT_PRICED`,
  `withKeylockWaitPriced`.
- **New OPTIONAL fields:** `previewWalk(…, {standKeys})`, `planSwordDash(…, {stand})`, and `walkTo`/`climbLadder`'s
  internal `stand`.
- **What to wire:** nothing. The browser takes the defaults (ON at the head), so the worker's solve gets both switches
  as soon as the harvest lands. A keylock stance walk's probe and dash scan cost one extra `hold.ticks` (≈110) of
  preview per candidate, only on a keylock frontier order.
- **Pins that move for the JS arc:** none of its files. Its battery's L30 → L22 decline should become a crossing
  (dispatch 3).

## Handed to the hammer arc

Nothing. `chooseBodyToRemove`, the press arms, `deriveStrike`, `spaceTimeReach` and the `fork` closure were read and
not edited. `planSwordDash`/`previewWalk` are not on its list. (If its in-flight C1 touches `previewWalk`'s tail,
`standKeys` is an opt-in that is inert when absent.)

## What the brief got wrong (measured)

1. **"Most likely a kill-first plan … or a keylock stance timed against the chase."** Both are right, and neither
   was reachable until the wait was priced. From (240,80) the base ladder never ran: the corridor probed clean, and
   the death was in the executor's 80-tick wait. The wall was an unpriced WAIT, not a missing strategy.
2. **"Step 52 … a real contact at d=4.7" (BOBSOLDIER2's residue 1, which the user had accepted as an honest
   refusal).** The refusal was honest about the gate, but the walk before it had already been hit twice on the key
   line. The survey prints only the refusal text, so a refused step can hide hits the solve took. I filed this as a
   trap candidate.
3. **"Residue 2 = sweep legs 333/339: the chaser arm's stance scan finds no stance whose WAIT is clear."** The scan
   never asked the cells where the wait IS clear. It was centred on the player, and U10's target-centred fallback
   triggers only on zero leash cells. The rescan finds (88,120).
4. **"`deriveKillByChaser`/the chaser arm's stance scan, the keylock stance search, the ladder's order."** The ladder's
   order needed no change, and the keylock STANCE search was right. What was missing was the stance's WAIT.
5. **"Reproduce live B's decline locally."** Not reproducible here without the JS arc's B battery (cloud sessions
   cannot dispatch). The sweep legs 333/339 and the survey step are the local proxies (dispatch 3).

## Residue

1. **`execKeylock` still has no hit check.** With `KEYLOCK_WAIT_PRICED` its wait is priced before the walk, but a
   wait that goes wrong anyway (an unmodelled body) is still reported as *"did not open"*. A guard (refuse on the first
   hit, as `guardedChaserDwell` does) is the next small slice.
2. **Steps 78/87 (L12 → L37)** are SOLVED by the model only. A game witness of that crossing is owed (the
   `puncher@416,256` beside L12's twin bosslocks, the same shape).
3. **The goal-path keylocks** (a `collect-placement` resolved to `keylock`) go through the goal path's stance walk,
   not the frontier's, and are not priced. No route step reaches one today.
4. **Three plan scripts are red at the base, OFF and ON alike** (`plan-seedling-ladder2-witness` `fae9cd64…`,
   `-r9-l0-sword-dash` `e06b988e…`, `-r9-l6-sword-dash-hit` `57fbc418…`; BOBSOLDIER2's residue 5, unchanged).
5. **The survey hides hits on a refused step** (what-the-brief-got-wrong 2). A `hitsBeforeRefusal` column would show
   them. That is an instrument change for the planner to rule on.
6. **The reference** reads 4 DIFFER here: the base's own registry, capabilities and two substrate regions, from this
   container's uninitialised substrate submodules. I regenerated only my rows.
7. **Entities / profile `--check`s** were not run (box contention). Nothing they read moved.
8. **The composite roster row** (`rosterCategories` "the LIVE row": 206 ≠ 209) turns green on the planner's next
   standing-values re-quote at roster 269.

## Byte-inertia

| row | W0 (`26cb831828`) | AFTER, switches OFF (`3e59a25`) | AFTER, head (flipped ON) |
|---|---|---|---|
| identity block (13 rows + generated set) | as above | **identical** (`after-identity-defaults.txt`) | **identical** (`after-identity-final-defaults-on.txt`) |
| six producers | `405d9c4b … b064c264`, exit 0 | identical | identical |
| tapeRunner | 589, `8cb21cd9…` | 595 (`c3959327…`); **all 589 old rows identical**, +6 (2 per witness), 0 non-pass | **595, `c3959327…`, 0 non-pass** (re-measured at the head, after the AFTER tapes' re-record) |
| surface / constants | GREEN 234 / PASS 5,488 | GREEN 234 (`--write`: 4 count-only rows, `keylockStandWalk`'s reads) / PASS 5,488 | same |
| bounded vitest | 70 / 2,236 | 71 / 2,251, 1 red (r8Acceptance exposure levels, fixed in `3e59a25`) | **71 / 2,251, all green** |
| `fixtures/**` | 266 tapes | 269: + `l30keylock-pit224-before`, `l30keylock-pit224`, `l30keylock-pit240` (+ expectations, index). No committed tape, expectation or trace moved. | same |

No AS3, wasm, gitlink or rules edit. No `standing-values --write`, `pytest` or unfiltered vitest.

## CI

`JavaScript Unit Tests` at `a6dda35` (run 38099735632): 749 files / 19,542 tests, **3 failed**. All three are the
reference not yet regenerated: `procgenDocs/generated.test.js` ×2 (the instruments index lacked
`plan-seedling-l30keylock.mjs`, and the docs regions). They were fixed in `dfc785e`.

At **`dfc785e`** (run 38103313830, the code head; only this report follows it): **749 files / 19,542 tests,
19,541 passed, 1 failed**. The one red is `scripts/procgen/rosterCategories.test.js` "the LIVE row carries one part
per derived category" (206 ≠ 209). The planner's standing-values composite is quoted at the roster before my +3
tapes, and a slice does not write standing-values (residue 8). The flipped defaults moved no other row in the
unfiltered suite. The slow battery printed no summary (the job's earlier step failed).

## Rows to BANK

- `KILL_STANCE_TARGET_RESCAN` **ON**, `KEYLOCK_WAIT_PRICED` **ON** (flip commit `89a6aed`, separable; measured movers:
  none).
- tapeRunner **595 `c3959327767b526c1e56497b6f2fce23`** (at the head, 0 non-pass); roster **269**; R8 exposed set **86** (+ `l30keylock-pit224-before` L30,
  `l30keylock-pit224`/`-pit240` L22+L30); surface GREEN **234**; constants PASS **5,488**.
- Producers unmoved: `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 b064c264`.
- Game witnesses:

  | tape | game check | BobSoldier body |
  |---|---|---|
  | `l30keylock-pit224-before` | game `hits` 2 = model | bit-exact, 212/212 |
  | `l30keylock-pit224` | model = game, 348 obs | bit-exact, 202 |
  | `l30keylock-pit240` | model = game, 361 obs | bit-exact, 218 |

- Survey `--through=end --route=full`: 52, 78, 87 REFUSED → SOLVED (158/220 local). Sweep legs 333/339 failed → done.
