# Seedling fidelity STRIKELAPSE: the lapse's two survey losses were a ceremony nobody priced and a dying body priced as alive

Slice `seedling-fidelity-strikelapse` (Opus, cloud), planner `seedling-fidelity-planning-7`, WAVE 15 (model coverage).

| | |
|---|---|
| Start SHA | **`926cc2a86f`** (main: wave 14 plus its four-switch flip; not rebased) |
| Head | the commit carrying this report (code `04ed60c` D1, `a5b550c` D2, `9943848` D3; `78c1917` D4; records `e5e2f5f`) |
| Branch | `claude/seedling-strikelapse-fidelity-kwnan2` (the harness's branch). Nothing went to `main` |
| Dev server | `serve-nocache.py 9660` (`SEEDLING_PORT=9660`), PID 601, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (step 50 SOLVED ON 413 t, game-witnessed) · D2 PASS with a STOP inside (step 62 SOLVED ON 748 t, game-witnessed; the remaining ~400-t walker limit cycle is handed over) · D3 PASS (local survey ON: 170 SOLVED, none lost; sweep 624 done) · D4 PASS (flip package held, measured)** |

## The one thing to know first

**Neither refusal was where its text pointed. Both came from the lapse doing its job: a walk's own presses now kill
bodies before the probe meets them.** That moved two costs downstream, and nothing priced them.

- **Step 50.** The probe stopped calling the kill arm, because the walk's strikes kill the BobSoldier. But the walk that
  is actually driven is the faster dashed one, and it leaves the body alive beside the pickup. The collect's approach
  and its ceremony were unpriced.
- **Step 62.** The chaser forecast projected a dying jellyfish as a live contact.

Both are fixed behind the switch. With the lapse ON, the route survey solves **170** steps (it was 169 OFF) and loses
none. Three new ON plans are confirmed on the game. **The flip package is held as a measured patch.** Its only red
outside FLIP14's list is the hammer arc's `fidelityF1c` residue (40 → 12), which FLIP14 had already predicted.

## W0: the base (PASS)

The changes are OFF-gated by construction, so W0 was measured at head with the default OFF, then checked against
FLIP14's bank and the BEFORE run at base.

| row | command | result |
|---|---|---|
| base | `git checkout -B … 926cc2a86f` | `926cc2a86f`; bootstrap `READY`, node v22.22.0; five non-wasm submodules uninitialised again (`git submodule update --init` each, needed for the reference row) |
| identity block | `SEEDLING_PORT=9660 bash scripts/procgen/identity-block.sh .` at head, default OFF | Every row equals FLIP14's W0 bank (`77080c2e…`): maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY **`afdc6d1a`**, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated OK. Reference: 4 differ when the five submodules are uninitialised; with them initialised, **ALL 7 + 5 MATCH** (an environment row, not this change) |
| six `--check`s | in the block | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign **`712f0ead`**, all exit 0 |
| tapeRunner pairs | sorted `status\tfullName` of `tapeRunner.test.js` | **611**, `86af85259c2ab3a51b1f0ebb409743f4`: base, head and flip candidate alike |
| surface / constants | `census-seedling-solver-surface --check`, `census-seedling-constants --check` | surface **286** rows GREEN (+2 import rows, classified: `deathTicks`, `removalTicksAfterHit` through the door); constants PASS |
| roster | `fixtures/tapes/index.json` | **277**, unchanged: the three new witness tapes live in the evidence dir, not the roster |
| bounded vitest BEFORE | 103 files at a base worktree: the brief's standing list, `fidelityL30KeyLock`/`fidelityDash`/`seedlingRobust`/`spearPush`/`fallRock`/`fidelityCrossRoom`/`levelWorld`/`solverBot`/`chasers`/`twoPassSolve`/`fidelityF1c`/`tapeRunner`, surface + constants, and every non-slow test naming `strikeIframeLapse`, `standKeys`/`standFor`, `previewWalk`, `chaserForecast`, `CONTACT_FIDELITY`, `withContactFidelity`, `KEYLOCK_WAIT_PRICED` or `ceremony` (`rg -al`) | **4,017 / 4,017**, md5 `e5fdfa55…` |
| bounded vitest AFTER | the same + `fidelityStrikeLapse.test.js` | **4,023 / 4,023**: BEFORE plus exactly the 6 new rows (`evidence/w0/`) |

## D1: step 50 (PASS)

**Measurement.** Reproduced in 5 s with `SEEDLING_STRIKE_IFRAME_LAPSE=1` (`survey … --only=50,62`). The solve, step by
step:

- OFF, the corridor probe from (184,56) meets the BobSoldier's blade at the collect stance (72.0,56.4). AVOID, TIME and
  BAIT refuse, the kill arm runs, and the plan takes **460 t**.
- ON, the same undashed probe is **clean**. Its own presses land on the lapsing i-frame and kill `bobsoldier@48,80` at
  t165 (measured with `dashMode: none`: the walk kills it, and the collect gate then refuses on the corpse's 16 px pad).
- The default drive is the **dashed** walk (106 t). It is certified on its transit samples only, and it leaves the body
  alive on 1 hit, 22 px off the stance.
- `execCollect`'s 8-tick approach walks into the body. The torch ceremony freezes it adjacent, and after the ceremony
  the exit walk's timed gate refuses at (71.04,67.07) with "its sword is timed". So the refusal text names the gate
  that caught the problem, not its cause.

**The game showed the ceremony needs its own question.** The first fix, pricing the approach as a tail, produced a
422-t plan that collects beside the live body. Played on p4f (`probe-seedling-chaser-mobiles --class=BobSoldier`), it
diverged inside the ceremony:

- the game's body read v (358.8, 663.4) one tick into the freeze, where the model's steps read (4.2, 8.2);
- the body left the freeze at (91.8, 282.0), not the model's (91.8, 197.7).

The cause is in the AS3. `Player.shieldBump` has no freeze gate (`Player.as`: `addShield(); shieldBump();` above
`freezeStep()`), and the player's `v` is frozen non-zero. So a touching body is shoved on **every** frame of the
ceremony's lump, and the model spends that lump without stepping it (`levelRun`'s
`assertNoCeremonyBesideLiveChaser` says so). The plan has to avoid it, not rely on it. Evidence:
`d1/probe-bobsoldier-pre-ceremony-arm.log`.

**Change (`solverBot.js`, all behind `CONTACT_FIDELITY.strikeIframeLapse`):**

- **`collectStandWalk`.** The collect's approach is the stance walk's priced tail, using `KEYLOCK_WAIT_PRICED`'s `stand`.
  So the probe, the ladder's AVOID/DETOUR and every dash candidate are previewed with it.
  - The tail's keys lean onto the pickup and answer `null` on the sample where the player's box meets the pickup's box.
    `previewWalk` ends the tail there and marks that sample `ceremony`.
  - Its length is a bound: the straight line at `WALK_SPEED`, plus `HOLD_SLACK`.
- **`probeSamples`' ceremony arm (`ceremonyBesideLiveBody`).** At the ceremony sample, three things refuse:
  - a live body inside its pad (the untimed WAIT question, `chaserDanger` at horizon 0);
  - an i-framed body;
  - a corpse still in the room.

  Corpses come from `createCorpseClock`. The forecast drops a corpse at the blow, while the run keeps it for
  `removalTicksAfterHit` more ticks. The fencepost is `<=`, measured: a kill on sample t140 with removal 11 still meets
  the ceremony at t151.
- **The collect executor gate** asks the timed walk-gate question, because the approach after it was probed.
- `deathTicks` and `removalTicksAfterHit` reach `solverBot` through `solverView.js` (the door rule; surface re-censused).
- **OFF is byte-identical by construction.** Every new path is gated by the switch and the collect strategy, or needs a
  `ceremony` sample that only that tail produces.

**Result ON: SOLVED 413 t** (≤ 460), 0 hits, into L32. The walk's own presses kill the body at t143, it is removed at
t154, and the ceremony starts at ~t157. There is no kill-arm record.

**Game witness.** On p4f (headless, port 9660), `check-seedling-bot-differential --record --only=strikelapse-l30-torch`
gave **"THE MODEL REPRODUCES THE RECORDING IT JUST MADE — 414 observations"** and ALL CHECKS PASSED. The BobSoldier probe
was bit-exact: 154 comparisons, worst Δ 0. The probe's player-clock line FAILs on this tape, and it fails identically
on the committed, game-witnessed OFF tape `bobsoldier2-l30-torch`, so that is the probe's ceremony limitation. Tape,
recording and logs are in `evidence/d1/`. They are not in the roster.

**Mutants** (predicted, then made by copy + restore, each red only where predicted):

| mutant | predicted | measured |
|---|---|---|
| M1: no ceremony arm | the run's DYING-ceremony throw | ON row red |
| M2: `<` for `<=` in the corpse clock | the same throw | ON row red |
| M4: no collect tail | the reach-exit refusal | ON row red |

## D2: step 62 (PASS, with the walker residue handed over)

**Measurement.** ON, the first corridor probe from (120,296) flags `jellyfish@224,176` at (217.0,184.9), "inside leash
160 (d=7.1)". OFF it is clean (386 t, dashed). Where the ON danger comes from (`previewWalk` on the same 8 waypoints):

- The walk's own lapse-admitted press (t204, reading 4) kills the jellyfish (hits 3).
- The forecast's projection carries `hits` and `hitsTimer` but **drops the kill's `dyingAt`**.
- So `plannerContactFree` never reads `Enemy.hitPlayer`'s `currentAnim != "die"` gate, and the transit arm prices the
  dying body as a live contact from t238.
- The ladder climbs to the chaser kill arm (stance (200,216)). The corridor re-planned from there limit-cycles at
  waypoint (120,72) and refuses ("not reached within 400 ticks").

**The stall is a symptom, not the cause.**

**Change (`levelRun.js`, inside the chaser forecast's `step()` projection only; the lapse ON only).** A body in its
death (a forecast kill's `dyingAt`, or a clone of a live `dying` body; a Bulb keeps its own phase rows) is projected
`dying`. That is the live stepper's own reading (`chaserContactNow`'s `dieAnim`). OFF the projection is unchanged.

**Result ON: SOLVED 748 t** (386 OFF). The probe is now clean. The dash planner refuses because the **undashed corridor
stalls** in its own preview: it limit-cycles about 400 t at the intermediate waypoint (120,72). The terrain is sliding:
|v| ≈ 1.5 px/tick, friction 0.02, and `drive` needs "within tolerance AND stopped". The drive does the same, is refuted,
re-plans from (121.3,72.6) and crosses in 30 t.

**The same fix newly solves step 147** (L63 → L65, also a jellyfish): REFUSED → **504 t**.

**Game witnesses.** `differential --record`:

- `strikelapse-l45-jelly` (748 t): the model reproduces **749 observations**;
- `strikelapse-l63-147` (504 t): the model reproduces **505 observations**.

Both are in `evidence/d2/` and `evidence/d3/`.

**Mutant M3** (predicted: the D2 ON row red): dropping the projection reds exactly that row.

**STOP inside D2: the ~400-t limit cycle is the walker's.** It lives in `botDriverV2.drive`/`chooseHeld`/`hasArrived`.
`driveStepHeld` is also the JS arc's walker (`jsRuntimeWalker`), and it is lapse-independent: the lapse only routes the
walk there. The hand-over:

- an intermediate waypoint on sliding terrain should be passable without stopping, or the planner should avoid it;
- measured at L45 t420–t770 (ON plan): x oscillates 117.3–122.9 and y 70.2–73.9 around (120,72);
- reproduce with `evidence/d2/step-62-boot.json` and goal `reach-exit (112,0)`.

Fixing it would bring step 62 back toward ~350 t.

## D3: the survey and the sweep, ON (PASS)

**Survey.** Local, `SEEDLING_STRIKE_IFRAME_LAPSE=1 node scripts/procgen/survey-seedling-route.mjs --through=end
--route=full` at `a5b550c`. Compared with CI run 38310171450 (the base, OFF) by (level, goals, boot):
`evidence/d3/survey-movers-on-vs-ci-base.json`.

| | SOLVED | REFUSED | NO-EDGE | NO-ARRIVAL | TIMEOUT |
|---|---|---|---|---|---|
| CI base (OFF) | 169 | 51 | 1 | 1 | 0 |
| local ON | **170** | 49 | 1 | 1 | 1 (step 156) |

Step 156 (L12 → L83) read TIMEOUT on a box at load average 11 (4 cores, with the identity block, the bounded vitest
and a sweep running). Solo, ON and OFF, it REFUSES with the CI text byte for byte (~100 s against the child's 120 s).
**No solved step is lost.**

| step | level | goal | before (CI OFF) | after (ON) |
|---|---|---|---|---|
| **50** | L30 | Torchpickup; → L32 | SOLVED 460 | **SOLVED 413** (FLIP14 ON: REFUSED) |
| **62** | L45 | → L46 | SOLVED 386 | **SOLVED 748** (FLIP14 ON: REFUSED) |
| **147** | L63 | → L65 | REFUSED (ladder exhausted, `jellyfish@160…`) | **SOLVED 504** |
| 16, 24, 35 | L14 | → L15 | 98 | 103 |
| 69 | L14 | → L15 | 103 | 117 |
| 71 | L14 | → L13 | 66 | 55 |
| 18 | L16 | → L17 | 117 | 124 |
| 19 | L17 | Chest | 122 | 132 |
| 26, 37 | L16 | → L18 | 688 | 655 |
| 52 | L30 | → L22 | 347 | 320 |
| 74, 80 | L12 | → L37 | 921 | 953 |
| 135 | L12 | → L37 | 925 | 957 |
| 104 | L60 | → L61 | 483 | 530 |
| 145, 180 | L60 | → L61 | 523 | 497 |
| 148 | L65 | → L68 | 539 | 546 |
| 163 | L75 | → L71 | 434 | 366 |
| 170 | L77 | → L76 | 480 | 475 |
| 192 | L80 | Chest; → L71 | 672 | 633 |
| 207 | L104 | → L105 | 268 | 261 |
| 208 | L105 | → L106 | 264 | 300 |
| 57, 110, 153, 182, 184, 201 | — | — | REFUSED | REFUSED (text changed) |

The length movers are FLIP14's list, with the same values where the bases agree. Steps 163 and 192 read different
"before" values on this base than on FLIP14's: 434/672 here against 364/666 there.

**Sweep (local, browser, p4f).** Run with `probe-seedling-divergence-sweep --mode=inv --producer=solver` on the five
L74 keys, ON = every default-ON key plus `strikeIframeLapse`:

| leg (by key) | OFF (default) | ON |
|---|---|---|
| 624 `level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144` | failed (danger map, `lavarunner@208,96`) | **done**, 0 room hits |
| 622 `level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0` | done | done |
| 626 `level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield` | done | done |
| 628 `level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144` | failed (skirt, no x-sequence) | failed (skirt stance, corridor re-plan; text moves) |
| 629 `level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield` | done | done |

**Dispatches for the planner** (cloud sessions get 403). All are on ref `claude/seedling-strikelapse-fidelity-kwnan2`:

1. **`seedling-survey.yml`** with the defaults (`--through=end --route=full`), with the lapse ON. The workflow has no
   contact input, so: `git apply CC/docs/cloud-reports/seedling-fidelity-strikelapse-evidence/flip-candidate.patch` on
   a scratch branch from this head, or a one-line measurement commit setting `strikeIframeLapse: true` in
   `contactFidelity.js`. Expect the D3 table: SOLVED 170, steps 50/62/147 = 413/748/504, and step 156 REFUSED (CI's
   ~70 s fits its timeout).
2. The same, **unmodified** (lapse OFF). Expect CI 38310171450 row for row: the change is OFF-inert.
3. **`seedling-divergence-sweep.yml`** `mode=inv`, `producer=solver`, `shards=1`,
   `keys=level_74 <- in_L73_64_0 -> exit:out_teleporter_16_144|level_73__r0c4 <- in_L74_288_144 -> exit:out_teleporter_64_0|level_74 <- in_L73_64_0 -> location:Level 074 - Darkshield|level_74 <- in_L75_64_0 -> exit:out_teleporter_288_144|level_74 <- in_L75_64_0 -> location:Level 074 - Darkshield`,
   twice: once with `contact_fidelity=collideLinePointsExact,wallFlyerSwordHits,drillLive,bobSoldierLive,wallFlyerKill,wallFlyerShieldBump,darkTrapLight,spearingWindow,fallBurnsPress,bulbLive,baitForecast,forcedHits,bombPusherLive,totemShotBlastInt,rebootShake,fallRockPostFall,forecastSpeedByTerrain,strikeIframeLapse`
   (this is "all" minus `movingWait`; `all` would also turn `movingWait` on) and once with it empty. Expect the table
   above.
4. **The full sweep** (`ids=` empty) with the same ON `contact_fidelity`, against the default. The lapse's whole sweep
   footprint at this head is not measured here.
5. The **full tier** and **`seedling-probe.yml battery=standard`** on a scratch branch with `flip-candidate.patch`
   applied. Plus that branch's push CI: the unfiltered vitest with the flip, which FLIP14 needed (it found 9 rows CI
   alone caught).

## D4: the flip package (PASS, HELD; the default stays OFF)

**Measured at head `9943848` in a scratch worktree.** The steps:

1. The default `strikeIframeLapse: true`.
2. FLIP14's strike re-pins (`git diff cb73ec83a7 0168ce8` over its 14 test files), applied with `git apply --3way`. Two
   conflicts (`contactFidelity.test.js`, `fidelityL74Leg624.test.js`: the four-flip had rewritten those default pins)
   were resolved to "all ship ON".
3. FLIP14's held campaign patch (`d2-candidate.patch`, md5 `b2d3401c`, applied clean).

**Re-measured, not copied:**

- `solve-seedling-r9-campaign --check` with the lapse ON at this head, **before** the patch: **`dce96321`** exit 1
  (FLIP14's licensed digest). So this slice's D1/D2 do not move the campaign beyond FLIP14's measurement.
- **With** the patch: **`6b1bf15c` exit 0**, FLIP14's candidate digest.
- The bounded set with the flip, 126 files (W0's 104 plus the 36 test files naming a moved tape): **4,557 passed, 1
  failed**. The one red is `fidelityF1c` "the committed window IS at the chain's residue", 12 ≠ 40, the hammer arc's pin
  as FLIP14 predicted. With `CHAIN_RESIDUE` 40 → 12, `fidelityF1c` is 13/13.
- tapeRunner pairs: 611, `86af8525`.
- Identity on the flip tree:
  - ENEMY `afdc6d1a` → **`36b59445`**;
  - r9-campaign → **`6b1bf15c` exit 0**;
  - every other row unchanged; generated set OK.
  - The reference must be regenerated at landing.

**Committed:** `seedling-fidelity-strikelapse-evidence/flip-candidate.patch` (md5 `5fbe0e27f4ff848d13b7112c20f1da2b`;
40 files; `git apply --check` clean at this head). The mover list is `evidence/d4/flip-movers.md`, with the file list,
the identity output and the campaign logs.

**Landing it.**

1. `git apply` the patch.
2. Fill `<the licence>` in `contactFidelity.js`.
3. Regenerate the reference.
4. Run the identity block.

The hammer arc may prefer to land `fidelityF1c` and the `playthroughWalk` row itself; both are in the patch.

## The JS arc's pins and what it must wire

- **No signature or contract change.** `solveSegment`, `twoPassSolve`, `PendingDeclaration` and `createRunForStaging`
  are untouched. No new staging or result field, and no new `SolverRefusal.obstacle.kind`.
- **One shared function it consumes changed, ON only:** the chaser forecast's `step()` projection gains `dying: true`
  for a body in its death. A consumer that reads `dying` on forecast bodies (`plannerContactFree` does, through
  `dangerMap`) now sees it with the lapse ON. With it OFF the projection is byte-identical.
- **Wiring:** none. With the flip, the page's contact setting already derives its default from
  `CONTACT_FIDELITY_DEFAULTS` (FLIP14's note).
- **The walker limit cycle** (D2's STOP) is in `driveStepHeld`/`chooseHeld`, the function the JS runtime walks with. It
  is the arc's to weigh if a fix lands there.

## Handed to the hammer arc

- **`fidelityF1c` `CHAIN_RESIDUE` 40 → 12** and **`playthroughWalk` {18,0} `removedAt` 306**: in `flip-candidate.patch`,
  moved only by the campaign re-record.
- **12b′ ×4 and `solverDeadline`**: FLIP14's values. This slice's D1/D2 do not move them (green in the flip run).
- C4b (the chooser census on leg 624 with the lapse ON): leg 624 now plays **done** ON at this head (D3's sweep). None
  of the arc's functions were edited.

## Deltas (base → head)

- **Code:**
  - `solverBot.js`: `collectStandWalk`, `ceremonyBesideLiveBody`, `createCorpseClock` (exported for the test), the
    `previewWalk` tail's `null` end, `probeSamples`' ceremony arm, the collect gate's timed question, the
    `walkTo(stance)` call, and the door imports;
  - `levelRun.js`: the forecast projection's `dying`;
  - `solverView.js`: two re-exports.
- **Tests:** `fidelityStrikeLapse.test.js` (6 rows).
- **Records:**
  - `seedling-solver-surface.json` (286, +2 classified);
  - the `seedling-bot-log.md` STRIKELAPSE entry with trap candidates;
  - the `seedling-bot.md` as-built paragraph;
  - the reference (`docsIndex.js`, the procgen README word count): ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS
    PASSED; `procgenDocs` 493/493.
- **Evidence:** `seedling-fidelity-strikelapse-evidence/` (`w0`, `d1`, `d2`, `d3`, `d4`, `flip-candidate.patch`).
- **Shared tables:** `CONTACT_FIDELITY`, `OBSTACLE_STRATEGIES`, `DEADLINE_SITES`, `KNOWN_STRATEGY_VERBS`,
  `KILL_ARM_POLICY` and `FAMILY_RULES` are untouched.
- **No tape, expectation, trace, index or roster change is committed** (the flip's are inside the held patch).

## What the brief got wrong (measured)

1. *"Step 50: the danger map forbids … `chaser:bobsoldier@48,80` (its sword is timed)"*, read as the gate admitting a
   press whose consequence the walk prices as a timed sword. That is not the mechanism. The press is admitted on the
   **probe's** walk and kills the body there. The danger is a body left alive by the **driven** (dashed) walk, reached
   only through the unpriced collect approach and ceremony. The danger map's sword arm is correct; the fix is in the
   collect's pricing.
2. *"Step 62: a walk STALL, not a combat refusal."* The stall is real, but it sits downstream of a combat refusal. The
   dying jellyfish was priced as live, which sent the solve onto the kill-arm route that stalls. The stall itself
   (ice, intermediate waypoint) survives the fix as a ~400-t cost.
3. *"`fidelityBobSoldier2` D2 rows refuse at every ON setting."* True before this slice. At this head, D2 "both ON" with
   the lapse ON solves (413 t, `fidelityStrikeLapse.test.js`). The FLIP14 OFF controls stay as controls.
4. Not in the brief: **the game shoves a touching body on every frame of a pickup ceremony** (`Player.shieldBump` has
   no freeze gate). This is a game quirk the model cannot step, so plans must not start a ceremony beside a body.
5. The bootstrap's `READY` again left five non-wasm submodules uninitialised. The reference row reads "4 differ" until
   they are initialised.

## Residue

1. **The walker limit cycle on sliding terrain at an intermediate waypoint** (step 62 ON, L45 (120,72), ~400 t). It is
   the walker's (`drive`/`chooseHeld`), shared with the JS arc. Handed over above.
2. **The flip itself is held:** `flip-candidate.patch` and the user's licence. Not measured: CI's unfiltered vitest with
   the flip, the full tier and `seedling-probe.yml` with it (dispatch 5), and the full sweep (dispatch 4).
3. **Step 62 at 748 t is a length regression against OFF's 386.**
4. **Every plan the lapse moves is unwitnessed** except steps 50, 62, 147 and leg 624: the other length movers in D3's
   table, and FLIP14's OFF controls, whose ON plans are named in their rows.
5. The forecast's `spent` (the strike policy's "in its death" flag) still reads only a live `c.dying`, not a forecast
   kill's `dyingAt`. Not measured to bite. If it does, it shows as a preview/drive key parting on a body the preview
   killed.

## Byte-inertia (OFF)

What did not move at head with the default OFF:

- every identity row;
- the six `--check`s;
- tapeRunner (611, `86af8525`);
- the roster (277);
- every committed tape;
- the bounded set: 4,017 rows identical, plus 6 new.

The surface moved by two import rows. CI at `9943848` is green: **795 files / 20,199 passed / 0 failed / 0 skipped**,
slow battery **253 / 253** (run 38320731425). The final head's run is read in the closing message.

## Rows to BANK

- **Code:** `collectStandWalk`, `ceremonyBesideLiveBody`, `createCorpseClock` (solverBot), the forecast projection's
  `dying` (levelRun). All are `strikeIframeLapse` ON only.
- **Survey ON (local):** SOLVED **170**; 50 → **413**, 62 → **748**, 147 → **504**.
- **Sweep ON:** 624/622/626/629 done, 628 refused.
- **Game witnesses** (p4f, `differential --record`, the model reproduces the recording):
  - `strikelapse-l30-torch` (413 t, 414 obs; BobSoldier 154 comparisons, Δ 0);
  - `strikelapse-l45-jelly` (748 t, 749 obs);
  - `strikelapse-l63-147` (504 t, 505 obs).
  - All in `evidence/`, not the roster.
- **The flip candidate:** `flip-candidate.patch` `5fbe0e27`, with ENEMY **`36b59445`**, r9-campaign **`6b1bf15c`** exit
  0 and `fidelityF1c` 40 → 12.
- **Identity OFF:** unchanged. Bounded BEFORE 103 / 4,017 `e5fdfa55`; AFTER 104 / 4,023. tapeRunner 611 `86af8525`.
  Surface 286.
- **Mutants:** M1–M4, each red exactly where predicted.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, no rebase, no
  force-push.
