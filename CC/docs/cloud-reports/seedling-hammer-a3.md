# Seedling HAMMER-PHASE — slice A3: the escape as a PREFERENCE (fallback to the pre-escape strike)

Slice `seedling-hammer-a3` (Opus, cloud), planner `seedling-hammer-phase-planning`. Built on A2 (not on `main`);
A2 + A3 merge together, by the planner.

⚖ **The user (2026-10-09):** *"A3 fallback first: if no strike passes the escape check, fall back to today's
behaviour instead of refusing. Every room that solved before still solves, and generation cost should return to
about what it was. Measure the movers, then merge A2+A3 together."*

| | |
|---|---|
| Start SHA | `d2abe079ccdb75372453c08431e92e77ee7b4ac7` (= `origin/hammer-harvest/a2`, A2's tip) |
| Head | the commit carrying this report (code `d7b6748`, records `7d094b2`) |
| Harness branch | `claude/seedling-hammer-a3-escape-fallback-dgyfjn` (the brief's `seedling-hammer-a3`; the harness names the branch). Nothing went to `main` |
| Dev server | `serve-nocache.py 9500` (`SEEDLING_PORT=9500`); a scratch worktree `/home/user/wt-a3` for draft trials (not committed) |
| Verdicts | **W0 PASS (the cause REFUTED as briefed; the real one measured) · D1 PASS · D2 PASS on identity, FAIL on the cost target (STOP: the fallback cannot reach it), one monotonicity exception named · D3 PASS** |

## The one thing to know first

**The escape does not REFUSE the draws that re-roll; it CERTIFIES them.** So the fallback, which only replaces a
refusal, changes nothing measurable, and the generation cost is A2's.

- `seedlingGenCapacity`'s killgate row re-rolls any draw whose kill gate spends a tag (30 locations + the lock's tag
  > 30).
- OFF, the room seats on the draws whose kill-gate certify *refuses* (the gate is dropped, so no tag is spent). Seed 57's
  3 OFF re-rolls are exactly its refused draws k=3, k=5; seed 53's 1 is k=1.
- ON (A2 or A3), every one of those draws certifies (0 refusals in 56 + 51 draws). The gate keeps its tag, and the
  room re-rolls through its whole budget and GROWS (seed 57: 51 re-rolls; seed 53: 48).
- The other cost is search time: in the default-elements slow census the re-roll counts are identical ON and OFF,
  and the whole gap is one draw, **post-sword seed 30's first draw: 254 s ON vs 25 s OFF**.

The lever for both is B's (the escape's budget, or the capacity rule's view of a certified kill gate), not a
fallback.

## W0 — at the base `d2abe07`

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | every step OK; it prints `READY` this time (A2 saw `done`). `bulletml-dodge` checked out at its pin `7423ee86` |
| identity block (default ON) | `SEEDLING_PORT=9500 bash scripts/procgen/identity-block.sh .` | log md5 `b8df6ba9283dd827a1909de5005cd9ef`. **Every row = A2's head ON**: maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `0d3262f6`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, all exit 0 (A2's) |
| surface / constants / entities / profile | each `--check` | GREEN 220 · PASS 5,414 · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` | 250 |
| bounded vitest BEFORE | 71 files (below) | **71 files / 3,121 tests, all green**; tapeRunner **557**, md5 `f22d60bd82dc535130ce595eed4a7182` (= A2) |

⚠ **The 71 files are RECONSTRUCTED, not A2's literal list**: A2's report gives the count and the rule, not the
names. The set is A's 52 (A's 51 + `hammerEscape`), plus every non-slow test file `rg -a` finds naming a re-recorded
tape or a touched name (`r8-solve-18|'r8-d2'|r8-d2-19|r8-d2-20|r9-solve-18|previewOrDeath|lethalFloor|
withHammerEscape|HAMMER_ESCAPE|` the three producers `|` the r9 windows: 18 more, `seedlingGenCapacity` among them),
plus `procgenDocs/generated`. That is 71 files exactly, but 3,121 tests, not A2's 2,979. BEFORE and AFTER both ran
this same list.

### The cause (briefed: "the escape rejects strikes the pre-escape walk survives"), measured

Instrument: each re-roll draw of the killgate row's rule (`rerollSeed(drawn, k)`, post-sword, `elements: killgate`,
10×10), `generateSeedlingLevel` run ON and `SEEDLING_HAMMER_ESCAPE=0`. For each draw it records the kill gate's
certify verdict and words.

| drawn seed | draws | certify REFUSED OFF | certify REFUSED ON | the OFF refusal's words | wall ON / OFF (draws, loaded box) |
|---|---|---|---|---|---|
| 57 | k=0…55 | **k=3, 5, 50** | **none** | `collect (96,48) stance (ladder-routed: no corridor from (24,24) to a stance that can collect torchpickup@…)` | 237 s / 140 s |
| 53 | k=0…50 | **k=1** | **none** | the same sentence | 202 s / 131 s |

OFF's re-roll counts (57: 3, 53: 1) are exactly the first refused draws: a refused gate is dropped, and that draw
seats. **Refuted:** no certify solve on these draws refuses ON. The direction is the opposite one.

**The escape kernel's share of the wall time** is the extra time a spinner certify solve takes ON, measured on
identical records (the D2.4 instrument below):

| set | OFF | ON | ⇒ share of ON |
|---|---|---|---|
| seed 57 draws | 121 s | 208 s | ~42% |
| seed 53 draws | 140 s | 215 s | ~35% |
| c3 | 170 s | 674 s | ~75% |
| c6 | 218 s | 763 s | ~71% |

## D1 — the fallback (PASS; `d7b6748`)

### The design

**`HAMMER_ESCAPE_FALLBACK = { enabled: true }`** (exported). `enabled: false` is A2's behaviour, the mutant.

**`deriveStrike`, both passes:**
- A candidate whose `strikeEscape` is a claimed negative is still dropped from the certified scan, as in A2.
- The first such candidate is kept, with its record snapshotted at that moment. That snapshot is exactly what the
  switch OFF returns: the same `rejected` list, `sighted`, `dwelt` and `continued`.
- The scan goes on through the continuation where A2 would.
- Only if it ends with no certified strike does it return the kept one, marked `escape: 'uncertified'`, `escapeBound`
  and `escapeWhy`.

**`pressEscape`'s claimed negatives name their `bound`:** the kernel's own (`exhausted`, `start`, `horizon`), or
`death`, `line`, `no-landing`, `approach`, `train`. A search cut by its budget or the deadline is still `claim: false`:
"no claim", unchanged.

**`noStrikeMove`** (exported, pure) ranks the moves of a tick with no strike in hand:
1. a certified strike;
2. the certificate in flight;
3. a refuge;
4. the uncertified strike (only with the fallback on);
5. the refusal (*"nowhere to be"*).

Moves 1–3 are A2's three, in A2's order. The walk takes its move from this rank. The tick's derivation and refuge are
memoised per tick (`nextNow`, `refugeNow`), so the work is A2's whoever asks first.

**At the aim**, a claimed negative refuses the press when either:
- a certified strike is held, or
- the strike has lapsed and the rank gives `strike`, `follow` or `refuge`.

A held strike that is itself uncertified is pressed. Otherwise the press is taken as OFF takes it: no certificate
followed, and the press record's `fellBack` lists `{body, t, pressAt, bound, why}`.

**Records:**
- `escapes` (certified presses, A's) and `fellBack` (uncertified presses). Each is added only when non-empty, so no
  record moves where nothing falls back.
- A cycle taken from an uncertified strike carries `escape`/`escapeBound`.
- The sweep prints `fellBack <aim>/<uncertified strikes>` per row, and gains `--no-fallback`.

### The order decision (measured)

**A certified strike is preferred even when it is LATER in tick order than an uncertified one.**

- The brief's own rule ("prefer a certified strike whenever one exists inside the bounds") is not enough on its own.
- **First cut** (`deriveStrike` returns the uncertified strike; the executor walks to any strike it gets) moved the
  residue sweep: r0 462 → **572**, r1 509 → 521, r2 447 → 501, r3 491 → 501.
  - In those 4 rows, 7 uncertified strikes were taken where A2's per-tick re-derivation got NO strike and followed
    the certificate (or took a refuge).
  - The uncertified strike was not "a later certified strike's cost". It displaced A2's i-frame walk.
- **The rank above** puts the certificate in flight and the refuge before the uncertified strike. With it, every row
  is A2's byte for byte (D2.2).
- The cost of the order is therefore zero ticks over everything measured, because the fallback is never reached.

### Rows (`hammerEscape.test.js`, +3)

- the default (ON);
- the rank: every combination, and the thunks are asked only when the rank reaches them (a refuge is a search);
- the switch off is A2: the uncertified strike becomes the refusal it replaced, and nothing above it moves.

## D2 — measured

### 1. Generation cost — **FAIL against the target; STOP** (the fallback cannot reach it)

**The killgate row's 30-item placement** (`placeGenItems(w, 30)` on a fresh `genRoom(seed, KILLGATE_ROOM)`,
post-sword, 1 exit; the row's two other draws are not timed):

| seed | OFF | A2 (fallback off) | **A3 (fallback on)** | A2's report (the row's whole rule) |
|---|---|---|---|---|
| 57 | 3 re-rolls, 15.0 s | 51 + GROWN, 438 s | **51 + GROWN, 338 s** | ON 51 / 315 s; OFF 3 / 7.5 s |
| 53 | 1 re-roll, 7.8 s | 48 + GROWN, 401 s | **48 + GROWN, 404 s** | ON 48 / 291 s; OFF 1 / 3.2 s |

- The re-rolls are identical A2 vs A3. The A2/A3 time differences are box load: four to eight jobs on 4 cores.
- **Target "within ~2× of OFF": not met** (×23 to ×52).
- ⇒ **The fast row stays re-aimed OFF.** A2's re-aim is NOT undone. Its comment now says why (`7d094b2`).

**The slow row** (`seedlingGenCapacity.slow`, the default elements). A local replica of its rule per seed (the
30-seat plus the 31-refusal draw, both timed), post-sword, seeds 1–60:

| | OFF | **A3** |
|---|---|---|
| re-rolls histogram | `{0:29, 1:10, 2:14, 3:3, 4:2, 5:1, 7:1}` | **identical** |
| total (this loaded box) | 1,055 s | 2,136 s |
| seed 30 | 5 re-rolls, 85 s | 5 re-rolls, **1,518 s** |
| any other seed > 2× OFF + 20 s | — | **none** |

- Seed 30's per-draw timing (`generateGenRoom`, post-sword, default elements): its **first draw (seed 30 itself)
  takes 254 s ON vs 25 s OFF**. The other six draws are within a few seconds of OFF.
- **CI @ `7d094b2`** (run `37976973995`, *success*) passed the slow row: post-sword's histogram is the same as above,
  and the post-sword test took **~889 s against its 900 s bound** (log 19:07:46 → 19:22:35; file 914,995 ms for
  both biomes).
- A2's tip timed out on this row at 900 s (run `37711704171`). A3 is byte-identical to A2 on generation, so **this
  green is margin, not a fix. Expect it to flake.**

### 2. L18 — PASS

`node scripts/procgen/sweep-seedling-l18-residues.mjs --twice` at the final code:

- **45/45 solve, 0 hits, every row the same twice, `fellBack 0/0` on all 45.**
- Lengths `462 509 447 491 491 515 447 418 514 440 444 439 440 374 364 449 445 492 445×5 446×3 456 456 379 364
  363×7 508 363 495 518 500 503 372 346`.
- Against **A2's own sweep** (run at `d2abe07` in the worktree): **identical row for row** in verdict, length, key
  digest, stalls (0), escapes (6) and hits (0).
- `--no-fallback`: identical to the head sweep, row for row.

### 3. Committed tapes and producers — PASS (no fallback fires on them)

Every producer `--check` at the final code, in the block's form (`--check 2>&1 | grep -v '^# box lock:' | md5sum`),
`SEEDLING_PORT=9500`:

| producer | md5 | exit |
|---|---|---|
| `r8-battery` | `405d9c4b` | 0 |
| `r8-d2-chain` | `b76f6483` | 0 |
| `r8-l18` | `465a8b46` | 0 |
| `r8-tail` | `35456fbc` | 0 |
| `r9-l3` | `6cd35fe1` | 0 |
| `r9-campaign` | `13b8d51f` | 0 |
| `plan-seedling-f1c-l18-phase` | `01ec5f9f` | 0 |
| `plan-seedling-hammer-a-escape` | `29891f04` | 0 |

- All of these are A2's digests.
- A2's three re-recorded walks (`r8-solve-18` 363, `r8-d2` 1669, `r9-solve-18` 518) reproduce, since their producers'
  `--check`s pass.
- tapeRunner 557 pairs, md5 `f22d60bd…`, identical BEFORE/AFTER.

### 4. Monotonicity — every certify verdict OFF vs ON — **one exception, named**

**Instrument** (`/tmp/…/mono.mjs`, scratch, not committed):
- It wraps the generator's own oracle (`seedlingSeam`'s `wrapOracle`).
- At EVERY certify solve whose record holds a spinner, it re-solves the SAME record OFF, A2 (fallback off) and A3.
- Verdicts are therefore compared on identical inputs, not on generator paths that diverge.

| set | spinner certify solves | OFF→ON solved→refused | refused OFF → solved ON | A2 ≠ A3 |
|---|---|---|---|---|
| killgate draws, seed 57 (k=0…55) | 427 | 0 | 24 (draws 3, 5, 50) | 0 |
| killgate draws, seed 53 (k=0…55) | 451 | 0 | 8 | 0 |
| empty pairs c3 | 102 | 0 | 0 | 0 |
| empty pairs c6 | 170 | 0 | 0 | 0 |
| carved pairs c4 | 139 | **1** | 6 (loopy post-sword s8) | 0 |
| ENEMY census, spinner at all 36 chamber cells + (1,2) + the nub (`--at`, three modes) | 38 rows | 0 | 0 | 0 (A2 output = A3 output, byte for byte) |

Row-level comparisons:
- **Killgate s2/s5/s9:** the printed tables are identical OFF vs ON (only the unrendered `md5(rows)` line differs, as
  A2 found).
- **Acceptance batch:** OFF `608693d2` vs ON `76602ae8`. Every verdict is the same; ticks only (post-sword s13
  711 → 703, sword WITH 730 → 715, shield WITHOUT 205 → 223).

**The exception: `winding post-sword seed 4` (carved pairs c4), attempt record `209c1c23`.**
- OFF: SOLVED in 485 t.
- A2 and A3 both refuse: *"… -> kill: every key set — the plan's own and 5 alternative(s) — lands the player box on a
  body's 7x7 rect or on the 13 px hammer line at that tick's own phase, on the next tick, at (73.28,66.05) in level
  900. There is no step out."*
- This is a `safeStep` corner deep in the kill. The escape's certified choices steer the walk there, and no escape
  negative is involved, so no strike-level fallback can see it.
- The generator reverts that attempt, so the c4 ROW still certifies a level: the different one A2 banked (`SATURATED
  42 attempts → TARGET_REACHED 10`).
- **The user's "every room that solved before still solves" is false at that one attempt.** It would hold only with
  a solve-level retry: on an ON refusal, re-solve the record OFF. That retry lives in the oracle, outside this slice's
  region, and was **not built** (residue 1).

Also seen: `winding post-sword seed 7` (c4) throws `levelRun: the swing … reaches spinner@16,32's rect but
collideLine …` in all three modes. It is pre-existing (OFF's dump row already reads THREW). The fallback does fire
there (admission and aim at t0, bound `exhausted`), and the throw is the same.

### 5. Movers vs A2's banks — none

Every generated identity row at the final code equals A2's bank:

| row | final code |
|---|---|
| acceptance | `76602ae8` |
| c3 | `4937da80` |
| c6 | `430573e9` |
| c4 | `b9d2185d` |
| ENEMY | `0d3262f6` |
| killgate s2 / s5 / s9 | `006b0639` / `7d4cb820` / `49e23d85` |
| generated set | OK |

- OFF at head equals A2's base row for row: c3 `043e1944`, c6 `f85e7722`, c4 `4aa74add`, ENEMY `25417923`, killgate
  `01210c82`/`07ce222a`/`30a1e3e7`, acceptance `608693d2`.
- **No `chore(bank)` commit**: nothing moved. The pre-licence was not used.

### 6. Mutant m4 — the fallback off (A2's requirement)

The mutant: `HAMMER_ESCAPE_FALLBACK = { enabled: false }`, by copy + restore, md5 `53870dbe` at both ends.

- **Unit rows.** Predicted: exactly the "ON by default" row and the rank row red, the switch-off row green. Measured:
  **exactly those** (2 failed, 1 passed).
- **Sweep and generation.** The brief predicted "the generation table returns to A2's numbers / the fast row times
  out". Measured: **the table never left A2's numbers**. The A2 column above IS the mutant, and so is the
  `--no-fallback` sweep (identical to head).
- So the generation and sweep rows cannot see this mutant, because nothing measured falls back. The unit rows are its
  catcher.

## D3 — records (PASS; `7d094b2`)

| row | result |
|---|---|
| `seedling-bot-log.md` | `### Seedling hammer-phase A3 — the escape as a preference` (the cause, the design, the measurements, two trap candidates) |
| `seedling-bot.md` | the press-kill paragraph: `HAMMER_ESCAPE_FALLBACK`, `noStrikeMove`, `fellBack` |
| surface | RED at head: two site counts (`run:ticksCompleted` 70 → 77, `import:spinner.js#SPINNER` 40 → 41, both `solverBot.js`). After `--write`: **GREEN 220**, no new row |
| constants / entities / profile | PASS 5,414 · PASS 528 · PASS 138 (unmoved) |
| reference | regenerated (the sweep's `--no-fallback`, the docs index). `--check`: ALL 7 + 5 MATCH. `check-procgen-docs`: ALL CHECKS PASSED |
| bounded vitest AFTER | **71 files / 3,124 tests, all green** (BEFORE + the 3 A3 rows); tapeRunner 557 `f22d60bd…` identical. Re-run after the docs edits: `procgenDocs/generated`, `lintGateLabels`, `seedlingGenCapacity`, 78/78 |
| A2's escape-OFF re-aims | `seedlingGenCapacity` stays OFF: it cannot pass ON (D2.1), and its comment says why. A2's other re-aims (`procgenCountableClock`, `watchGenOverlay`, the F1c rows) were for a rung's evidence, not cost: untouched |
| CI (unfiltered, read by SHA) | `d7b6748`: 19,152 / **2 failed**, exactly the reference and the surface census (`procgenDocs/generated` "regenerating produces byte-identical files", `seedlingSolverSurface` "(i) every static row's files and site counts match"), both fixed by `7d094b2`. **`7d094b2`: success, 19,154 / 0; slow battery 252 / 0** (run `37976973995`, every job green) |

## The JS arc's readings (nothing edited)

- `jsRuntimeSolverCalibration.slow`: **5/5** (bounded, `vitest.slow.config.js`).
- `measure-seedling-l18-live-gap.mjs`, residues 40–42: shipped **518 / 500 / 503 t (the full pass)**; dashless
  582/555/559; work 59/57/57. That is A2's, exactly.

## Deltas

| row | A2 (`d2abe07`) | A3 head |
|---|---|---|
| code | — | `HAMMER_ESCAPE_FALLBACK`, `noStrikeMove` (exported); `deriveStrike`'s fallback; the aim's fallback; `pressEscape`'s `bound`; records `fellBack`, cycle `escape` |
| sweep | 45/45 | 45/45, identical digests; `--no-fallback`; per-row `fellBack` counts |
| producers / tapes / identity rows | — | all unchanged |
| surface | GREEN 220 | GREEN 220 (two site counts) |
| bounded vitest (the reconstructed 71) | 3,121 | 3,124 |
| generation cost | 57: 51 re-rolls; 53: 48 | unchanged |

## What the brief got wrong (measured)

1. **"Likely cause: … the strike is rejected even where the pre-escape walk would have survived, so the certify solve
   refuses and the draw re-rolls."**
   - Inverted. ON refuses nothing on those draws. OFF refuses (k=3, 5 / k=1), and an OFF refusal is what lets a draw
     seat.
   - The cost is the escape SUCCEEDING (the kill gate's tag survives), plus one slow draw (seed 30's first, 254 s).
2. **"generation cost should return to about what it was"** via the fallback: unreachable by construction. A fallback
   replaces refusals, and there are none.
3. **"return the first strike that passes every PRE-ESCAPE condition (exactly what the switch OFF would have
   returned)"**, done literally in `deriveStrike`, moved the L18 sweep (r0 462 → 572). The executor re-derives every
   tick of the i-frame, and A2's "no strike" there is what selects the certificate-follow and the refuge. The
   uncertified strike has to rank below them.
4. **"no row may be solved OFF and refused ON"**: one attempt is (c4 `winding post-sword s4`, record `209c1c23`), and
   it is not an escape negative, so no strike-level fallback can rescue it.
5. **"the fast row back to the escape ON … if it meets the row's rule"**: it does not (51 re-rolls + a growth).
6. **"the slow row … ~15 min"**: on CI it is ~15 min for BOTH biomes, and post-sword alone is ~889 s against a 900 s
   bound. It passed at `7d094b2` and timed out at A2's tip, with the same code paths.
7. The bootstrap prints `READY` here (A2 recorded `done`).

## Residue

| # | item | owner |
|---|---|---|
| 1 | **A solve-level retry** (an ON refusal re-solved OFF) is the only way to make "every room that solved before still solves" true per attempt (c4 s4, `209c1c23`). It is out of this slice's region (the oracle / solve entry). Cost: one extra solve per ON refusal | planner / user |
| 2 | **The generation cost is A2's.** Re-rolls: a certified kill gate keeps its tag, so the capacity rule re-rolls. Time: the escape's search (35–75% of an ON spinner solve; seed 30's first draw ×10). Both are B's question (a cheaper or budgeted escape), or the capacity rule's | hammer-phase B |
| 3 | **`seedlingGenCapacity.slow` is at its bound on CI** (post-sword ~889 / 900 s at `7d094b2`, a timeout at `d2abe07`). Expect flakes until 2 lands, or re-bound/re-seed the row (a user call: the row is a census) | planner |
| 4 | The bounded set is reconstructed (71 files by rule, 3,121 tests vs A2's 2,979) | — |
| 5 | c3 / c6 / c4 are still not banked as CI-read rows (A2's residue 1): box values unchanged `4937da80` / `430573e9` / `b9d2185d` | coordinator |

## Byte-inertia

- **Not touched:** AS3, wasm, any gitlink (`bulletml-dodge` checked out at its pin locally), rules, the JS arc's files.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52; the suite is CI's, by SHA).
  `git stash` was not used.
- **Scratch only, never committed:** the worktree `/home/user/wt-a3` (a draft with an env-gated stderr trace, used to
  find where the fallback fires); the instruments `draws.mjs`, `mono.mjs`, `one.mjs`, `find.mjs`, `cap.mjs`,
  `draw30.mjs`, `census-mode.mjs`.
- **Mutant:** copy + restore, md5-checked (`solverBot.js` `53870dbe`).
- The c3 and cap53 monotonicity runs loaded the code as committed in `d7b6748` minus the `noStrikeMove` refactor; c4,
  c6, cap57 and every row/producer/sweep listed above loaded the final code. The refactor is equivalent: the sweep,
  every row and every producer re-measured identical after it.

## Rows to BANK

- **Nothing moved**, so there is no new identity, producer or tape value. A2's rows to bank stand as A2 listed them.
- **Box rows re-confirmed at A3's head:**
  - acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `0d3262f6`, killgate
    `006b0639`/`7d4cb820`/`49e23d85`;
  - producers `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, f1c-phase `01ec5f9f`, hammer-a-escape
    `29891f04`;
  - sweep 45/45 (A2's digests); surface GREEN 220; constants 5,414; entities 528; profile 138; roster 250.
- **CI-read rows:**
  - quoted at `7d094b2`: the unfiltered suite 19,154/0 and the slow battery 252/0;
  - c3 / c6 / c4: no CI line yet (as A2).
