# Seedling HAMMER-PHASE — slice B1: the strike APPROACH planned in space-time

Slice `seedling-hammer-b1` (Opus, cloud), planner `seedling-hammer-phase-planning`.

⚖ **The user** (2026-10-07): *"the target position we want to reach to attack from changes over time, and so there are
multiple (position, time) targets to choose from"*; (2026-10-09) *"Yes"* to this slice: the approach to the next strike
planned by the space-time search, behind its own flag, measured on the L18 sweep, the spinner census and the (2,2)
chamber.

| | |
|---|---|
| Start SHA | `ddb00afa25` (main; = A2+A3+A4 rebased + the bank) |
| Head | the commit carrying this report (code `64698a1`, witness `0b9ad16`, records `b2214f2`) |
| Harness branch | `claude/seedling-hammer-approach-1en480` (the brief's `seedling-hammer-b1`; the harness names the branch). Nothing went to `main` |
| Dev server | `serve-nocache.py 9520` (`SEEDLING_PORT=9520`); a pristine base worktree `/home/user/Archipelago-CC-wt-b1-base` on 9521 (W0); a scratch worktree `/home/user/wt-b1-mut` at `0b9ad16` (mutants, the experiment) |
| Verdicts | **W0 PASS · D1 PASS · D2 STOP (solved → refused with the flag ON: seven certify records; the flag stays OFF) · D3 PASS** |

## The one thing to know first

**The approach planner works where it was aimed and is NOT safe to turn on.** On L18 it solves 45/45 with no hit at a
mean of **367.6 t** (434.3 t with the escape alone; 40 residues shorter, 5 longer), the census chamber's **(2,2) in
141 t (515)**, and the committed staging's r40 in 362 t (518), witnessed on the game at 0 px. But with the flag ON,
**seven generated certify records that solve OFF refuse ON** ("There is no step out.", 21–35 ticks after a landing),
which is the brief's STOP. The traced cause: a greedy "earliest next strike" can leave the player where the next body
corners them, and nothing plans past the strike. The flag is OFF in head and OFF is byte-identical.

## W0 — at the base `ddb00afa25`

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | every step OK, `done` (node v22.22.0). `bulletml-dodge` checked out at its pin `7423ee86` |
| identity block | `SEEDLING_PORT=9521 bash scripts/procgen/identity-block.sh .` in the base worktree | log md5 `d2fa7f46c7016c675825d6c51ab830a8`. **Every row = the bank (A2–A4)**: maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `0d3262f6`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`. `generated set` hung in the wasm-less worktree (killed by PID; it reads OK in the primary, the OFF block below); reference 4 DIFFER (environmental, as A saw) |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, all exit 0 |
| surface / constants / entities / profile | each `--check` | GREEN 220 · PASS 5,414 · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` | 250 |
| bounded vitest BEFORE | the 71 files (names below) | 3,106 passed / 1 failed / 71 files: the failure (`procgenDocs/generated`) and one file that did not load (`seedlingGenCapacity`: a `bulletml-dodge` path) are the worktree's environment; quoted at the same code, A4's AFTER is 71 / 3,126 green (⚖ ruling 32 A). tapeRunner **557**, md5 `f22d60bd82dc535130ce595eed4a7182` |
| L18 sweep `--twice` | base worktree | **45/45**, every row the same twice, 0 hits; lengths = the brief's table exactly; 160 s for the 45 first solves (median 3.8 s, max 7.3) |
| spinner rows | `solverSpinnerKill.test.js` at base | 8/8: (5,5) 269 · (2,2) 515 · (7,6) 210 · (3,6) 160 · (2,7) 264 · corridor 193 |
| ENEMY census | in the block | `0d3262f6`: the chamber spinner SOLVED 226 t, `spinner@nub` SOLVED 351 t |

**The 71 files, by name this time** (A3/A4 reconstructed them by rule; the rule gives these): A's 51 named in A's
report, `hammerEscape`, `procgenDocs/generated`, and the 18 non-slow files `rg -a` finds for A3's pattern:
`addEquips director fidelityWatcher gameClock placedTalk procgenCorridorBody procgenWeigh seedlingGenCapacity
tapeFormat turretSolver ulpDash watchSolve watchWasm` (seedlingDemo) and `exportSeedlingView producerSegments
provisionalLatch reachClosure walkMoves` (scripts/procgen). AFTER adds `hammerApproach` (72).

## D1 — `HAMMER_APPROACH` (PASS; `64698a1`)

### The planner

`solverBot.deriveApproach(run, {bodyId, lastPressAt, caller})` (exported for the instruments), asked:
- by the executor on a tick with **no strike in hand** (`nextNow`: the approach first; any negative ⇒ `deriveStrike`,
  exactly as OFF), and
- by `derivePressKill`'s admission (its first strike; a negative ⇒ the old admission). The executor adopts the
  admission's certificate when it still describes the run.

**The search:** `spaceTimeReach`, earliest mode, the nine key sets, the run's stepper (`previewOrDeath`), from **the
run's state now**. The prune is the escape's own: `clearOfHammersAt` on the forecast's rows, lethal floor
(`lethalFloorFrom`, lifted out of `pressEscapeOnce`), previewed deaths. Rank within a layer: nearest the body.

**Why the start is the run's state, not the escape certificate's end:** the certificate is followed only on a tick
with no strike (`follow` 0, A's measurement), so the approach — a strike — takes over the tick it is found. Its search
reaches every state the certificate's keys would have (the same prune), so starting from the certificate's end would
only discard the space-time the i-frame walk could spend closer to the next target.

**The goal**, one predicate with the executor (not a second spelling):
- `pressReadyAt(view, state, rect, hitsTimer, lastPressAt)` is the live arm's in-reach test, lifted out:
  - the `SLASH_HIT_TICKS` since my last press;
  - the body's i-frame over;
  - `distanceRectPoint ≤ SLASH_REACH` and the `slashRect` overlap;
  - `trainIsSafeHere` and `!trainLineBlockedHere` for the aim key.

  The executor's arm, F1c's `previewPressApproach` (its `reach` end, before B1 "verbatim in its conditions", a second
  spelling) and the goal all call it. The goal asks it of the PREVIEWED state through `previewViewAt` (F1c's view,
  lifted out), with the body's rect from the forecast row and its i-frame.
- Then, lazily, A's admission of that very press: `pressEscape` from the run's state along the path's own keys (the
  kernel now hands the goal `path()`, additive), the aim key, the press. A claimed negative is not a goal and the
  search goes on; "no claim" admits, as the aim does. Residue 15's fact (the aim key need not set
  `state.direction`) is respected because the escape steps the aim and presses in the stepped direction; a press that
  would swing the wrong way does not land, so it is not a goal.

**The follow:** the strike carries `approach: {at, keys, states, index, window}`. The executor holds the keys tick for
tick (no `stepToward`, no F1c rung), still under `safeStep`, and its own live arm aims and presses on the
certificate's aim tick (it is the same predicate, and the in-reach states before it were refused by the search for
their escape). A certificate whose state is not the run's, or whose aim tick passed unpressed, is dropped and the tick
derives again (`approachesLeft` counts it: **0** on every L18 solve and census room).

**Found by measuring, designed in:**
1. **A press of mine in flight.** `spinnerForecast` holds no hit it has not seen, and the window's tests re-aim from
   the walk's points. Abstaining (my first cut) handed ~50 ticks after every press to `deriveStrike`'s time-blind
   strike. Now the certificate STANDS through the window's last test, and the hazards and the goal's i-frames are the
   hit-aware forecast (`spinnerForecastWithPress`, its own press past the last row) over those stood points. Which
   ticks the window tests is ASKED of the forecast (the points it requests).
   - ⚠ A test due at the search's own tick needs no stood tick but still moves the body. Missing it cost one search
     20 s and 14,167 refused escapes (residue 4, t172).
2. **A dying body** (its fade, or killed by the window in flight) has no strike. Searching for one cost two 50k cuts
   per solve.
3. **Repeated expensive negatives.** Empty pairs c3 took 787 s ON, 665 s of it re-asking a budget-cut search every
   tick of a refuge wait. `APPROACH_LATCHED`: a cut (`expansions`, `deadline`) or a whole-horizon negative (`horizon`)
   stands until my next press. c3: 129 s.
   - ⛔ `exhausted` is NOT latched: latching it moved L18 r19 363 → 461, r22 398 → 436, r34 353 → 359. A later
     state found what the earlier search's dedup dropped, and exhausted searches are cheap (max 1,646 expansions).
     With the final latch, the L18 sweep is row-for-row the pre-latch sweep.

### The bounds, derived and measured (`HAMMER_APPROACH_BOUNDS` / `HAMMER_APPROACH_MEASURED`)

| bound | value | derivation / measurement |
|---|---|---|
| `cell` | 8 px | **measured against 4 and 2 px.** The goal region is a few px wide, and 4 px does find earlier strikes at some searches (the census corridor's t55: 8 px +60, 4 px +33, 2 px +31). But not shorter fights: L18 mean 367.6 t (8 px) vs 369.0 t (4 px), 5 vs 10 residues longer than the escape alone; the six census rooms sum 1,121 vs 1,167 t; 4 px costs 1.7× the time (291 vs 173 s) |
| `horizon` | `strikeHorizon(run)` | `deriveStrike`'s own window for the same question (a body cannot stay away from a cell for longer than a traversal of the room both ways). The latest strike found anywhere: +72 |
| `maxExpansions` | 50,000 | the escape's budget, above every search that ended on its own: the largest find **49,291** and the largest whole-horizon search **49,749** (both carved pairs c4). Cuts (each no claim, latched): c3 8, c6 17, c4 12, acceptance 1; L18, ENEMY and killgate 0 |
| deadline | `hammer-approach` | appended to `DEADLINE_SITES` (no reorder, no reword); asked every 250 expansions while a deadline is active, only with the flag on |

`profile-seedling-hammer-approach.mjs` (new, A4's method) recorded every search:

| set (ON) | searches | found (max expansions) | cut | whole-horizon | wall, of which in the approach |
|---|---|---|---|---|---|
| L18 sweep (45 solves) | 1,518 | 222 (7,707) | 0 | 0 | — (sweep 170 s vs 165 s OFF, same box state) |
| empty pairs c3 | 1,020 | 230 (9,962) | 8 | 0 | 129 s, 51 s |
| empty pairs c6 | 1,769 | 375 (9,962) | 17 | 0 | 215 s, 97 s |
| carved pairs c4 | 1,198 | 270 (49,291) | 12 | 21 | 289 s, 144 s |
| ENEMY census | 33 | 5 (4,811) | 0 | 0 | 7.1 s, 1.4 s |
| killgate s2 / s5 / s9 | 144 each | 27 each (6,013 / 7,754 / 5,568) | 0 | 0 | 8.7 / 12.7 / 4.4 s |
| acceptance batch | 284 | 54 (6,062) | 1 | 0 | 68 s, 6 s |

Most searches are the `dying` answer (no search). The found index: median +31 everywhere (a body's i-frame is 30).

### Determinism

The BFS order is the key-set order and the layer order. The rank breaks ties by first reached. No clock is read.
Every sweep row was the same twice (`--twice`, ON and OFF).

## D2 — measured (STOP at 3)

Box: 4 cores, loaded by 2–4 jobs throughout; every ON/OFF timing below was taken back to back.

### 1. L18 sweep — PASS

`node scripts/procgen/sweep-seedling-l18-residues.mjs --approach --twice`:
- **45/45 solve, 0 hits, every row the same twice**, `left` 0, no stalls. Escapes 6 per solve (5 at r29).
- Searches: 33.7 per solve (≈ 5 find a strike; the rest are the fades' `dying`, and the `window` and `exhausted`
  answers). 374,518 expansions over the 45 solves; the largest find was 7,707.

| r | A4 | ON | | r | A4 | ON | | r | A4 | ON |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 462 | 377 | | 15 | 449 | 366 | | 30 | 363 | 358 |
| 1 | 509 | 376 | | 16 | 445 | 366 | | 31 | 363 | **377** |
| 2 | 447 | 377 | | 17 | 492 | 366 | | 32 | 363 | 357 |
| 3 | 491 | 352 | | 18 | 445 | 360 | | 33 | 363 | 360 |
| 4 | 491 | 371 | | 19 | 445 | 363 | | 34 | 363 | 353 |
| 5 | 515 | 357 | | 20 | 445 | 375 | | 35 | 363 | 363 |
| 6 | 447 | 371 | | 21 | 445 | 363 | | 36 | 363 | 356 |
| 7 | 418 | 376 | | 22 | 445 | 398 | | 37 | 508 | 362 |
| 8 | 514 | 373 | | 23 | 446 | 365 | | 38 | 363 | 362 |
| 9 | 440 | 409 | | 24 | 446 | 374 | | 39 | 495 | 362 |
| 10 | 444 | 370 | | 25 | 446 | 363 | | 40 | 518 | 362 |
| 11 | 439 | 366 | | 26 | 456 | 367 | | 41 | 500 | 381 |
| 12 | 440 | 346 | | 27 | 456 | 354 | | 42 | 503 | 367 |
| 13 | 374 | 346 | | 28 | 379 | 362 | | 43 | 372 | **374** |
| 14 | 364 | **367** | | 29 | 364 | **406** | | 44 | 346 | **364** |

Mean **367.6 t vs 434.3** (−66.8). Longer at 14, 29, 31, 43, 44 (+3 … +42). Wall time: 170 s ON vs 165 s OFF for the 45
first solves (median 3.0 s vs 3.7 s; the slowest ON row 11.7 s).

### 2. Spinner rooms — PASS (the (2,2) target beaten)

`solverSpinnerKill`'s rooms, solved OFF and ON back to back (each certified, three landings, three escapes):

| room | OFF (A2's pins) | ON | landings OFF → ON |
|---|---|---|---|
| (5,5) | 269 | **213** | t79/125/198 → t66/112/145 |
| **(2,2)** | **515** | **141** | t306/390/423 → **t8/64/97** |
| (7,6) | 210 | 180 | t58/98/131 → t50/83/116 |
| (3,6) | 160 | 165 | t39/73/106 → t39/72/105 |
| (2,7) | 264 | 153 | t84/150/191 → t42/75/108 |
| corridor | 193 | 269 | t63/96/141 → t55/117/150 |

- (2,2) is far below its pre-escape 260 t: its first landing comes at t8 instead of t306.
- The corridor's KILL is as long both ways (154 vs 163 ticks); the extra ticks are the walk to the goal from where
  the last strike leaves the player. (3,6)'s +5 is the same kind.
- ENEMY census (spinner rows): the chamber spinner 226 → **302 t** (longer); `spinner@nub` 351 → 289 t.
- The stagings, solved fresh: `r8-solve-18` 363 → **356 t** (0 hits, 0 spinner contacts, `{18,0}@304`);
  `r9-solve-18` 518 → **362 t** (the chain 10,931 → 10,775).

### 3. Generated rows — ⛔ STOP: solved → refused

Each row OFF and ON back to back, outputs kept (`/tmp` scratch), digests as the block:

| row | OFF | ON | wall OFF → ON | what moved |
|---|---|---|---|---|
| acceptance | `76602ae8` | `81819fb0` | 71 → 63 s | post-sword s13 skeleton 703 → 360 t (sword WITH 715 → 381); **post-shield s2 is a different generated level** (hazards water×4 wall pit → water×5 wall; 240 → 164 t); every verdict unchanged |
| empty pairs c3 | `4937da80` | `4adfb3cf` | 160 → 136 s | 19 of 200 rows: 14 the same level with other ticks, 5 a different level (post-shield s2/s22/s32, post-swim s22, post-feather s22); every stop condition unchanged |
| empty pairs c6 | `430573e9` | `9f3db098` | 209 → 208 s | the same 19 seeds, the same split |
| carved pairs c4 | `b9d2185d` | `23b7302d` | 182 → 282 s | 21 of 360 rows: winding post-sword s4 **TARGET_REACHED → SATURATED** (10 → 42 attempts); SATURATED → TARGET_REACHED at branchy post-shield/swim s6, bushy post-shield s8, loopy post-shield/swim s6; the rest ticks or attempts |
| ENEMY | `0d3262f6` | `e2ad7e75` | 7.8 → 6.9 s | above (2.) |
| killgate s2/s5/s9 | `006b0639`/`7d4cb820`/`49e23d85` | `bac0154c`/`847a7f88`/`bbc01d26` | 3.2→8.8 / 7.1→13.0 / 8.5→4.6 s | the printed tables are identical; only the unrendered `md5(rows)` moved |

**Monotonicity, per record** (A3's method, rebuilt as scratch: the generator's own oracle is wrapped through
`seedlingSeam({wrapOracle})` + `generateLevel`, and every certify solve whose record holds a spinner is re-solved OFF
and ON). Over the 34 rows that moved (the ON generator path), **seven records are SOLVED OFF and REFUSED ON**, every
one *"… There is no step out."*:

| row (ON path) | the solve | OFF | ON refusal |
|---|---|---|---|
| c4 winding post-sword s4 | the 10th certify solve (record `6a62069f…`) | SOLVED 625 t | corner at (72.84,68.87), 35 ticks after the press on `spinner@64,80` landed at t126 |
| c4 winding post-shield s6 (= post-swim s6) | the skeleton | SOLVED 419 t | corner after a landing |
| c4 branchy post-shield s6 (= post-swim) | the skeleton | SOLVED 508 t | F1c's rung: from t136 no phase admits a step |
| c4 bushy post-shield s8 | the skeleton | SOLVED 625 t | corner at (102.08,115.83), 21 ticks after a landing at t331 |
| c4 loopy post-shield s6 (= post-swim) | the skeleton | SOLVED 700 t | corner at (85.27,98.21), 28 ticks after a landing at t186 |
| c3/c6 empty post-shield s22 (= post-swim/feather s22) | the skeleton | SOLVED 367 t | corner |
| c3/c6 empty post-shield s32 | the skeleton | SOLVED 400 t | corner |

Refused OFF → solved ON: at least 7 records (three rows' counts were cut off in my log). Unchanged: every other spinner solve of the 34 rows. A refused skeleton is why
those rows build a different level.

**Traced (the first record, solved alone ON):**
- the approach found +51 (t0) and +1 (t123);
- the press at t125 killed `spinner@64,80` at t126, and t127–153 is its fade;
- from t154, the second body: every approach search is `exhausted`, and the space it explores shrinks tick by tick
  (173, 149, 109, 62, 35, 22, 2, 1 expansions): the state is already doomed;
- the switch-OFF path walks into the corner at t161.

**An experiment (scratch, not landed):** on an exhausted search, take no strike, so the rank goes to the follow and
the refuge. It changed none of the five records tried (loopy grew worse). Refuted as a fix. The greedy choices before
the corner decided it.

**Code fact for B2:** `escape` is declared per body plan in `execKillByPress`, so the killing press's certified escape
is dropped when the loop moves on to the next body. In the traced record that is the very window where the corner
forms.

**The slow row** (`seedlingGenCapacity.slow`, both biomes, ON then OFF back to back, the box otherwise quiet): **ON passes, post-sword 502 s, pre-sword 38 s (file 540 s)**; OFF post-sword 466 s, pre-sword 36 s (file 502 s). Comfortably inside the 900 s bound (+8%). The fast `seedlingGenCapacity` file passes ON alone (9/9).

### 4. Movers with the flag ON (measured, not landed) — the list for a licence

Against the OFF block at head (= the base block row for row, below):

| row | OFF | ON |
|---|---|---|
| acceptance | `76602ae8` | `81819fb080db39c2ac3a9791243b99d1` |
| empty pairs c3 / c6 | `4937da80` / `430573e9` | `4adfb3cfdce85ce70ed8df9dc6bfd6a8` / `9f3db098d71e2b9693360bba3a1f0f9a` |
| carved pairs c4 | `b9d2185d` | `23b7302d1d8674064aa794f5c63cba8c` |
| ENEMY census | `0d3262f6` | `e2ad7e75b3e050ec5d4b9f74bc8d0b66` |
| killgate s2 / s5 / s9 | `006b0639` / `7d4cb820` / `49e23d85` | `bac0154c…` / `847a7f88…` / `bbc01d26…` |
| `solve-seedling-r8-l18 --check` | `465a8b46` exit 0 | `e2f3b0fc` **exit 1**: `r8-solve-18` 363 → 356 t |
| `solve-seedling-r8-d2-chain --check` | `b76f6483` exit 0 | `c985f3dd` **exit 1** (the headline's L18 part) |
| `solve-seedling-r9-campaign --check` | `13b8d51f` exit 0 | `31b8077c` **exit 1**: `r9-solve-18` 518 → 362 t, the chain 10,931 → 10,775, `r9-solve-19`'s declared clock 10478 → 10322 and every window's boot after it |
| `plan-seedling-f1c-l18-phase --check` | `01ec5f9f` | `8938c95c` (its solve) |
| `plan-seedling-hammer-a-escape --check` | `29891f04` | `cea7182d` (its solves) |
| the other 40 producer/planner `--check`s | — | OFF = ON digest |
| maze, guard, AREA, levels s1, generated set, battery, tail, r9-l3 | — | unmoved |
| committed tape replays | — | none can move (a replay never consults the solver) |
| **unit rows (bounded set, ON)** | — | **22 rows in 11 files** — `fidelityF1c` 5, `hammerApproach` 2 (its OFF-default rows), `hammerEscape` 2 (the escape-OFF refusals now solve), `procgenCorridorBody` 1 (232 → 205 t), `procgenCountableClock` 1 (REFUSED → SOLVED), `procgenPostSword` 1 (the undeclared-clock throw now SOLVED), `procgenRoam` 1 (a DWELL refusal now certifies), `procgenScratchPersistence` 3 (removal tick 142 → 115), `solverSpinnerKill` 6 (the table in 2.), `watchGenOverlay` 1 (the dropped killgate now certifies); `seedlingGenCapacity`'s fast row died of `STACK_TRACE_ERROR` under load and passes ON alone (9/9). Every unit verdict change is refused → solved |

**STOP here, as briefed.** The flag is OFF in head. The movers list above is what a flip would move. The seven
solved → refused records come first: they say not to flip B1 as it stands.

### 5. The game witness — PASS (`0b9ad16`)

`scripts/procgen/plan-seedling-hammer-b1-approach.mjs` (`--check`):
- It solves `r9-solve-18`'s staging, frozen at A's base (`witness-bases/r9-solve-18.hammer-a.json`: the same staging;
  only the solve-derived clear and the inputs differ from today's tape), at hammer residue 40. That is the sweep's
  r40 row: `seam.time` 9940 → 9895, because the sweep's shift moves a clock already at its residue by one period.
- OFF: 518 t. ON: 362 t.

| tape | ticks | planned strikes (index) | escapes | record | game re-play | model | game hits | crossing / clear |
|---|---|---|---|---|---|---|---|---|
| `hammer-b1-l18-approach40` | **362** (OFF 518) | 6 (29/28/31/15/31/31) | 6 | `--record`: ALL CHECKS PASSED | 23 PASS / 0 FAIL, *"live game matches the committed oracle stream"*, `save.time` 10298 = model | **0 px** (`hammerApproach.test.js`) | 0 | t362; `{18,0}@305` model-sourced |

Tape md5 `5e941a837f08f849144645aa57d3ae66`; expectation committed beside it.

The tape's NAME was grepped across the test tree (LINEFLIP's lesson):
- roster 250 → **251**: `tapeEnvelope`, `observationTolerance` ×2 (the count and the swap tally),
  `dialogueAutoAdvance` ×2 (the count and its complement 249 → 250);
- the name unions: `watchManual`'s kill-lock set, and `r8Acceptance`'s L18 roster (a new row).

### 6. Mutants (predicted first; copy + restore in the scratch worktree, `solverBot.js` md5 `70874fa8…` at both ends)

| mutant | predicted | measured |
|---|---|---|
| m1, the goal's escape admission off (an in-reach state is a goal) | sweep 45/45 and 0 hits (the aim's own escape still guards), lengths moved, certificates left; red: the certificate row (escape null) and "IS the solve" | **exactly that**: 45/45, 0 hits, mean ≈ 377 t, **213 certificates left**; exactly those two rows red |
| m2, the hazard prune off (`safe` accepts every state) | certificates left (`safeStep` swaps), refusals or a hit on the sweep; red: the certificate row and the witness-solve row | **wrong in the mechanism.** The sweep stopped at its time limit after 33 residues: all solve, 0 hits, **0 left**, but mean ≈ 460 t and ~90 s a solve. The goal's own `pressEscape` re-checks the approach path against the hammer (`bound: 'approach'`), so an unsafe path never becomes a goal, and the search spends its budget instead. Red: the ON-solve row and the witness-solve row. The certificate row stays green: the escape is the second guard |

## D3 — records (PASS; `b2214f2`)

| row | result |
|---|---|
| `seedling-bot-log.md` | `### Seedling hammer-phase B1 — the strike approach in space-time` (the design, the measurements, the STOP, two trap candidates) |
| `seedling-bot.md` | the press-kill paragraph: `HAMMER_APPROACH`, `pressReadyAt`, the window, the latch, the bounds, why it stays off |
| surface | RED at head on site counts only (11 rows, all in `solverBot.js`) → `--write` → **GREEN 220**, no new row |
| constants / entities / profile | PASS 5,414 · PASS 528 · PASS 138 (unmoved) |
| reference | regenerated (the two new instruments, the docs index): `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED |
| bounded vitest AFTER | 72 files (the 71 + `hammerApproach`), flag OFF: **3,137 tests**, all green but the surface census and the reference before their D3 regeneration (28 rows; 129/129 after it with `lintGateLabels` and the constants census). tapeRunner **559**, md5 `6895ad04…` (557 + the witness's 2) |
| `lintGateLabels` | green |
| the sweep | gains `--approach` (and every search in `--json`) |

## The JS arc's readings (nothing of theirs edited)

| reading | OFF (head) | ON |
|---|---|---|
| `jsRuntimeSolverCalibration.slow` | 5/5 | 5/5 |
| `measure-seedling-l18-live-gap.mjs`, residues 40/41/42 at the shipped budget | **518 / 500 / 503 t (full)**, work 59/57/57 | **405 / 434 / 406 t (the DASHLESS pass)**: the full pass is cut by the upgrade window, ⏱ first at `hammer-approach` (it needs 65/94/76 window units vs 35/34/34) |
| …unbudgeted (`count`) | the same | full 362 / 381 / 367 t, work 118/157/136 |

- If the flag ever turns on, the JS arc must re-calibrate.
- The approach's searches spend work units (one per 250 expansions), so A2's closed live 40–42 gap reopens: what
  ships is still shorter than today's, but it is not the full plan.
- The new `hammer-approach` site is asked only with the flag on.

## What B2 (the whole fight as one search) should take from this

1. **Search the fight, not the strike.** B1's greedy "earliest certified strike, then the next" is 67 t shorter on L18
   but makes seven generated records unsolvable: a state can be safe for the escape's 75 ticks and still doomed for
   the next body. B2's goal has to include surviving to the kill of the LAST body (or to the lock), with the bodies'
   hit state in the node.
2. **The node's forecast is a function of the path.** The window in flight is the minimal case, and it already needed
   the hit-aware forecast with the stood points. B2's press-as-successor generalises it: memoise per (press tick,
   facing, the train's points), as A said.
3. **Keep `pressReadyAt` as the one predicate** for "a press is possible here". The goal and the executor agreeing by
   construction is what made `left` 0 everywhere.
4. **Budget per search, and latch repeated failures.** Unlatched, re-asking a failing search every tick cost 5×. Dedup
   means a negative is not a proof (the r19 lesson), so latch only the expensive ones.
5. **The cross-body gap:** the escape is per body (dropped when the loop moves on), and a fade is no strike. B2 should
   treat the room's bodies as one fight.
6. **The JS arc's budget:** a search in the walk spends deadline units. B2 must be calibrated against
   `SOLVER_UPGRADE_WINDOW_WORK`, or the live solve ships its dashless pass.

## Deltas

| row | base | head |
|---|---|---|
| code | — | `solverBot.js`: `HAMMER_APPROACH`, `withHammerApproach`, `HAMMER_APPROACH_BOUNDS`/`_MEASURED`/`_TRACE`, `deriveApproach` (exported), `approachHeld`, `APPROACH_LATCHED`; `pressReadyAt` and `previewViewAt` lifted out (the executor's and F1c's in-reach tests now call it); `lethalFloorFrom` lifted out of `pressEscapeOnce`; the escape trace carries `why`; the `hammer-approach` site. `spaceTimeReach.js`: the goal's `path()` |
| byte-inertia (flag OFF) | — | identity block: every row = base (generated set OK in the primary); six `--check`s = base; the sweep: 45/45 rows identical, twice |
| tests | — | `hammerApproach.test.js` (8 rows); the `DEADLINE_SITES` pins (`hammerEscape`, `fidelityLadder2`, `solverDeadline`); the roster pins |
| tapes | 250 | **251** (`hammer-b1-l18-approach40` + expectation; index) |
| instruments | — | `profile-seedling-hammer-approach.mjs`, `plan-seedling-hammer-b1-approach.mjs`; the sweep's `--approach` |
| surface | GREEN 220 | GREEN 220 (site counts) |
| bounded vitest | 71 / 3,126 (A4) | 72 / 3,137 |

## What the brief got wrong (measured)

1. **"a NEGATIVE … the existing path runs, unchanged — the new planner is a preference, like A3's fallback"** does not
   make the flag safe. The planner never refuses, yet seven records solved OFF refuse ON. The approach changes the
   timeline, and the switch-OFF path then inherits a doomed state. "Never a refusal of its own" is not "no new
   refusals".
2. **"hazards = the hit-aware forecast"** with "start = the run's state now": with a press in flight there is no
   path-independent hit-aware forecast. The brief's hazard set is well-defined only once the window's points are
   fixed, which is why the certificate stands through the window.
3. **"measure whether the reach test needs finer — the goal region is a few px wide"**: it does find earlier strikes
   at 4 px, but not shorter fights, at 1.7× the cost. The key is not the lever; the greedy goal is.
4. **"maxExpansions (from the measured distribution, A4's method)"**: unlike the escape's, the approach's distribution
   has cuts (38 across the generated rows). A budget alone was 5× the row's time until the latch.
5. **"`jsRuntimeSolverCalibration.slow` … with the flag ON"**: green (5/5), but it does not see what moved. The live
   path's shipped plan did, at the upgrade window.
6. **"Generated rows … the slow row must stay comfortably inside 900 s"**: it does (502 s ON vs 466 s OFF post-sword); the cost the brief worried about lands on carved pairs c4 instead (+55%).

## Residue

| # | item | owner |
|---|---|---|
| 1 | **The seven solved → refused records** (table in D2.3). B1 must not be flipped as it stands. The fix is B2's: the fight as one search, past the last strike | planner / B2 |
| 2 | The approach's c4 cost (+55% wall, 282 vs 182 s): admission searches to the horizon and cuts in carved rooms | B2 |
| 3 | The live L18 gap reopens with the flag ON (the dashless pass ships) | JS arc, if ever flipped |
| 4 | Corridor and ENEMY chamber are LONGER ON (the end position after the kill) | B2 (the walk after the kill belongs in the fight's goal) |
| 5 | The 71-file set is now recorded by name (above) | — |
| 6 | I used one `pkill -f` pattern kill on my own profile process (it matched only that one); every other kill was by PID | — |

## Byte-inertia

- **Not touched:** AS3, wasm, any gitlink, rules, the JS arc's files.
- **No committed tape moved.** The only tape and expectation changes are the new witness's.
- **No producer `--check` digest moved** with the flag OFF.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). `git stash` was not used.
- **Mutants and the experiment:** in the scratch worktree, copy + restore, md5 `70874fa8cde405a5ca1c2204ced778ec` at
  both ends of each.
- **Scratch only, never committed:**
  - in `/tmp/claude-0/sp`: `one.mjs`, `esc.mjs`, `aim.mjs`, `rooms.mjs`, `cellprobe.mjs`, `mono.mjs`, `stop.mjs`,
    `rows.sh`, `prod.sh`, `slow.sh`, the sweep and profile JSON;
  - the two worktrees.

## Rows to BANK

- **Nothing moved with the flag OFF**, so there is no new identity, producer or campaign tape value. The base rows are
  re-confirmed at head: acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `0d3262f6`, killgate
  `006b0639`/`7d4cb820`/`49e23d85`, producers `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, generated set
  OK.
- **New:**
  - roster **251**; `plan-seedling-hammer-b1-approach --check` exit 0;
  - the sweep: OFF 45/45 (A4's table), `--approach` 45/45, 0 hits, mean 367.6 t;
  - surface GREEN 220; constants 5,414; entities 528; profile 138;
  - tapeRunner 559 `6895ad04…`.
- **For a licence (ON, not banked):** the movers table in D2.4.
