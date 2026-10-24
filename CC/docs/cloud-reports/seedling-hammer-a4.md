# Seedling HAMMER-PHASE — slice A4: a BUDGET for the escape search (profiled first)

Slice `seedling-hammer-a4` (Opus, cloud), planner `seedling-hammer-phase-planning`. Built on A2 + A3 (not on
`main`); A2 + A3 + A4 merge together, by the planner.

⚖ **The user (2026-10-09):** *"Before merging, a small slice that caps the escape search (e.g., fewer expansions;
when it runs out it makes no claim and the press goes ahead as before), then measure that L18 still solves 45/45.
Lands with A2+A3."*

| | |
|---|---|
| Start SHA | `8c34e7c59c2f21af29daa26271d3e144e7733c8c` (A3's tip, `origin/claude/seedling-hammer-a3-escape-fallback-dgyfjn`) |
| Head | the commit carrying this report (code `516299d`, records `b3c971a`) |
| Harness branch | `claude/seedling-hammer-a4-z79plo` (the brief's `seedling-hammer-a4`; the harness names the branch). Nothing went to `main` |
| Dev server | `serve-nocache.py 9510` (`SEEDLING_PORT=9510`). The worker restarted once mid-slice; the server and the sweep were restarted, and nothing on disk was lost |
| Verdicts | **W0 PASS (the profile REFUTES the briefed cause) · D1 PASS (the fix the profile justified; no lower cap) · D2 PASS (L18 45/45 byte-identical; every row and producer identical; cost target met; one mutant prediction wrong, named) · D3 PASS** |

## The one thing to know first

**The generation cost was not the escape's search. It was previewed deaths throwing stack-captured errors.**

- `empty post-sword seed 30`'s first draw took 227 s ON vs 21 s OFF. Only **0.3 s** of it was in `pressEscape`
  (256 calls, each search 75 expansions).
- **187 s** was V8 capturing stacks for **16,216,872 previewed drownings**. They are thrown inside `stepToward`'s
  depth-4 survival tree (under the HAMMER-PHASE rung's stall previews), and `previewOrDeath` (A2) catches and
  discards each one.
- The fix is result-identical: no stack for a previewed death, and each key set asked once.
- The draw now takes **30.0 s ON vs 18.8 s OFF**. `seedlingGenCapacity.slow` post-sword drops from **1,563 s (a
  timeout) to 485 s**; OFF is 504 s.
- The escape's search never reached its 50,000 bound anywhere measured, so **no cap was lowered**: a lower one would
  save time only by un-certifying presses.

## W0 — at the base `8c34e7c`

| row | command | result |
|---|---|---|
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | every step OK, `done` (node v22.22.0). `bulletml-dodge` checked out at its pin `7423ee86` |
| identity block (default ON) | `SEEDLING_PORT=9510 bash scripts/procgen/identity-block.sh .` | log md5 `575df578…`. **Every row = A3's**: maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `0d3262f6`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, all exit 0 |
| surface / constants / entities / profile | each `--check` | GREEN 220 · PASS 5,414 · PASS 528 · PASS 138 |
| roster | `fixtures/tapes/index.json` | 250 |
| bounded vitest BEFORE | A3's 71 files, base code (copy + restore, `solverBot.js` md5 `53870dbe` = A3's) | **71 files / 3,124 tests, all green** (= A3's AFTER); tapeRunner **557**, md5 `f22d60bd82dc535130ce595eed4a7182` |

⚠ **The W0 block is not purely at base.** It ran while the trace hook (inert: sink `null`) and then the D1 edits
landed. maze, acceptance and c3 ran at base + the inert hook; the later rows loaded D1's edits. Every row equals A3's
value, so BEFORE is quoted from A3 (⚖ ruling 32 A: the head then was A3's tip). The block was re-run whole on the
final code (D2.2).

⚠ **The 71 files are reconstructed again** (A3 gave the rule, not the names): A's 52 by name, plus every non-slow
test file `rg -a` finds for A3's name pattern (43 files, 18 of them not already in A's 52), plus
`procgenDocs/generated`. The count is 71 and the BEFORE total is 3,124: A3's AFTER exactly.

### THE PROFILE — where the time goes

**Instrument.** `scripts/procgen/profile-seedling-hammer-escape.mjs` (committed; `--help` prints and drives
nothing) installs `solverBot.HAMMER_ESCAPE_TRACE.sink` and records every `pressEscape` call:
- `caller`: `admission` (`deriveStrike`'s bounded pass under `derivePressKill`), `continuation`, `walk` (the
  executor's per-tick re-derivation) or `aim`;
- the verdict: `ok`, a claimed negative's bound, or `no-claim`;
- the kernel expansions per search: `free`, and `stood` (the retry with the train stood);
- the call's wall ms (previews and forecasts included);
- the run asked on, as an ordinal (repeats within one solve vs across solves).

Where the escape was not the cost, `node --cpu-prof` found what was.

| case (base code, ON) | wall | escape calls | expansions | time in `pressEscape` | where the time is |
|---|---|---|---|---|---|
| **post-sword seed 30, first draw** | **230 s** (OFF 21.2 s) | 256 | 2,700 (max 75) | **0.3 s (0.1%)** | **`PhysicsV2Error` construction 187.6 s (79%)**, under `stepToward` → `survives` → the preview step's `deathRefusal`; `stepV2` itself 32 s |
| killgate 57 k=0…11 + 53 k=0…11 | 94 s | 8,904 | 1,180,613 | 54.0 s (57%) | `aim ok` 60%, `walk ok` 32%, `walk no-landing` 6% |
| empty pairs c3 | 149 s* | 2,081 | 198,167 | 9.5 s (6%) | `walk ok` 74% of the escape |
| empty pairs c6 | 204 s* | 3,237 | 335,198 | 16.2 s (8%) | `walk ok` 76% |
| carved pairs c4 | 175 s* | 3,575 | 266,946 | 15.7 s (9%) | `walk ok` 30%, `aim ok` 22%, `aim exhausted` 17% |
| L18 sweep (45 residues, one pass) | 145 s | 56,655 | 773,586 | 67.2 s (46%) | `walk no-landing` 52% (54,396 cheap calls), `aim ok` 25%, `walk ok` 13% |

\* c3/c6/c4 were profiled with D1's edits already in (they are result-identical, so the calls are the base's).

**The answers.**
1. **Seed 30 (the slow row's outlier).** The escape is not the cost.
   - 16,216,872 previewed deaths over 35,590 `stepToward` calls (~456 each; counted by a scratch counter, restored
     md5 `f519de20`).
   - ~11.6 µs each. A micro-benchmark puts a caught `PhysicsV2Error` at 3.6 µs with the stack on and 0.76 µs with
     `Error.stackTraceLimit = 0`.
   - The escape steers the walk where those previews drown. A2's `previewOrDeath` made the deaths survivable, not
     cheap.
2. **Every escape search ends below its bound.**
   - Largest certified: **20,109** expansions (L18, a `walk` re-derivation at t143). Killgate 16,341; c3/c6 9,920;
     c4 9,745.
   - Largest exhausted: **18,245** (L18, aim).
   - Cut by the budget (`bound: 'expansions'`): **0** in every set. The `no-claim` rows (c3/c6/c4) spent 0 expansions: they
     are the forecast's named unmodelled source, returned before the kernel, not the budget.
3. **Where the escape IS the time (the killgate draws): many medium certified searches, REPEATED ACROSS SOLVES.**
   - On draw 57 k=3: 9 solves of one record, 63 identical calls each.
   - 400 of 567 calls (5,372 of 6,157 ms, **87%**) repeat a (caller, t, pressAt, verdict, expansions) already asked
     in another run.
   - That repetition is the generator's re-solving, outside this region.
   - Few huge searches: no. Many medium ones, each asked again by the next solve.

## D1 — what the profile justified (PASS; `516299d`)

**Result-identical, in the press-kill arm.**

- **`previewOrDeath`** (now exported) steps with `Error.stackTraceLimit = 0` and restores the limit on every exit.
  - A previewed death's verdict and words are unchanged, and nothing reads its stack.
  - A non-death error is a defect: the step is re-run with the stack on, so it throws with its trace (a step is a
    pure function of its arguments).
- **`stepToward` asks each key set once.**
  - `intended` is almost always one of the nine sets listed after it.
  - A repeat scores exactly what its first appearance scored, so under the strict `>` it never displaces it.
  - Dropping it changes no choice and cuts the depth-4 survival tree from 10⁴ to 9⁴ leaves.
- **The cap: `HAMMER_ESCAPE_BOUNDS.maxExpansions` stays 50,000.** The measured distribution is a frozen record
  beside it:

  ```js
  HAMMER_ESCAPE_MEASURED = { largestCertified: 20109, largestExhausted: 18245, wholeSet: 41463, budgetCuts: 0 }
  ```

  Derivation:
  - A breadth-first search that ends at the horizon may need the whole reachable set (A's table: 41,463 at 8 px, H75).
  - So a successful search is bounded by `wholeSet`, not by the largest one measured so far.
  - A cap between 20,109 and 50,000 cuts nothing measured, so it saves nothing.
  - Below 20,109 it turns certified escapes into "no claim", saving time only by dropping the certificate.
  - The brief's alternatives:
    - a per-solve budget: the same trade;
    - lazy certification: `deriveStrike` already certifies only until the first certified candidate;
    - a cache: across runs it is unsound, because the preview stepper reads activators, pulls and the damage state,
      none of which a key over the player state sees. Within one run there is nothing to cache (the repeats are
      across runs).
- **`HAMMER_ESCAPE_TRACE`** (sink `null`: nothing is measured or called), the instrument's door.

**Rows (`hammerEscape.test.js`, +2):**
- the budget bounds the whole set and exceeds every measured search, and the trace sink is off by default;
- `previewOrDeath`: a death is `null` with no stack captured, a defect re-throws with its trace (`brokenStep` in
  `e.stack`), and the limit is restored on every path.

## D2 — measured

### 1. L18 — PASS (the user's acceptance)

`node scripts/procgen/sweep-seedling-l18-residues.mjs --twice` at the final code:
- **45/45 solve, 0 hits, every row the same twice.**
- Lengths `462 509 447 491 491 515 447 418 514 440 444 439 440 374 364 449 445 492 445×5 446×3 456 456 379 364
  363×7 508 363 495 518 500 503 372 346`: A3's table.
- Every row identical to the sweep at A3's code (W0's profile run), with wall time stripped: verdict, length, key
  digest, stalls (0), escapes (6), `fellBack 0/0`, hits (0). md5 of the normalised rows `31804cda`.

### 2. Committed walks and producers — PASS (byte-identical)

AFTER identity block on the final code, `SEEDLING_PORT=9510 bash scripts/procgen/identity-block.sh .`: **every row
identical to W0's** (`diff` of the first 22 lines empty). The reference line read DIFFER there only because the docs
were mid-edit; it reads ALL 7 + 5 MATCH after the regeneration.

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

A2's three re-recorded walks (`r8-solve-18` 363, `r8-d2` 1669, `r9-solve-18` 518) reproduce, since their producers'
`--check`s pass. tapeRunner 557, `f22d60bd…`.

### 3. Generation cost — PASS (target met on the box; CI below)

All on a 4-core box, each comparison back to back and otherwise quiet (load ≈ 1) unless stated.

| row | A3 (base `8c34e7c`) ON | A4 ON | A4 OFF |
|---|---|---|---|
| `seedlingGenCapacity.slow` post-sword (both biomes in one run) | **1,563 s, FAIL: timed out at 900 s** (pre-sword 43 s) | **485 s, PASS** (pre-sword 46 s) | 504 s (pre-sword 37 s) |
| its re-roll histograms | pre `{0:23,1:16,2:9,3:7,4:2,6:1,"10 (grown)":2}`, post `{0:29,1:10,2:14,3:3,4:2,5:1,7:1}` | identical | identical |
| post-sword seed 30, first draw (`generateGenRoom`) | 227–236 s (OFF 21–22 s) | **30.0 s** | 18.8 s |
| empty pairs c3 (the identity row's command) | (A3: 674 s ON / 170 s OFF, loaded box) | 183 s | 179 s |
| killgate draws 57 + 53, k=0…11 | 94 s | 109–111 s | 61 s |

- **Seed 30's first draw: 1.6× OFF**, inside the brief's ~2×.
- The slow row ON is within noise of OFF (485 vs 504 s), so the escape costs that row nothing measurable now.
- The killgate draws are not moved (identical calls and expansions; the wall difference is box noise). There the
  escape is the cost (63 s of 111), as the profile says, and the lever is the generator's repeated solves (residue).

**The profile's cases, before → after:**

| case | before | after |
|---|---|---|
| seed 30 | 230 s, of which 187 s in `PhysicsV2Error` | 30.0 s |
| killgate draws | 94 s, 54 s in the escape | 111 s, 63 s in the escape (unchanged work) |
| c3 | (A3's 674 s loaded) | 183 s, 9.5 s in the escape |

The intermediate step, the death fix alone (before the dedupe): seed 30 47.7 s.

**CI** at `b3c971a`: the slow row's post-sword test took **530 s against 900 s** (A3: ~889 s). See *CI* below.

### 4. Monotonicity — PASS, by construction and by every row

- Both D1 changes are result-identical: no step's outcome, no choice and no certificate changes.
- So no certify verdict can move: the sweep, all eight producers, and every generated identity row (acceptance, c3,
  c6, c4, ENEMY, killgate s2/s5/s9, generated set) are byte-identical to A3.
- **A3's per-record re-solve instrument was scratch and was not rebuilt.** The claim rests on the construction plus
  the byte-identical rows. Any verdict change on a certify record of c3/c6/c4/killgate would have moved those digests.
- **`winding post-sword seed 4` (c4, record `209c1c23`): unchanged.** It is still the attempt A3 named (solved OFF,
  refused ON: *"There is no step out."*). The c4 row is byte-identical, `b9d2185d`, so its attempt sequence is too.
  The cap is not the lever there: no escape negative is involved.

### 5. Movers vs the banks — none

Every generated identity row equals A2's bank (acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`,
ENEMY `0d3262f6`, killgate `006b0639`/`7d4cb820`/`49e23d85`). OFF at head: c3 `043e1944` (= the OFF base). **No
`chore(bank)` commit**: nothing moved, and the pre-licence was not used.

### 6. Mutants (predicted first; copy + restore, `solverBot.js` md5 `855c891c` at both ends of each)

| mutant | predicted | measured |
|---|---|---|
| m1, the death fix removed (`Error.stackTraceLimit = limit`, not 0) | the `previewOrDeath` row red; seed 30 ON back above 150 s | **exactly that row red** (1/18); seed 30 **176.0 s** |
| m2, the key-set dedupe removed (`.filter(() => true)`) | no row red (it is result-identical); seed 30 ≈ 48 s | 18/18 green; seed 30 **66.7 s**. The direction holds; the size is box state (the 47.7 s point was measured hours earlier). Only a timing sees this mutant |
| m3, a cap of 1 (`maxExpansions: 1`) | the budget row red; the L18 sweep loses residues toward OFF's 35/45 | **3 rows red** (the budget row, both game-witness solve rows). **The sweep prediction was WRONG: 45/45, no hit**, but every length moves (`518 479 482 482 482 484 454 538 458 …`) |

**Why m3 still solves 45/45.** A search cut by the budget is no claim, but the press-side negatives that run before
the kernel (`no-landing`, `approach`, `line`, `train`, `death`, from the hit-aware forecast) are still claims. A
cap of 1 therefore keeps the forecast's admission (a press that does not land, or whose approach or train meets the
line, is not taken). It loses the certificates: no follow, longer walks. So "every search cut" is not the switch OFF
(35/45). This was read from `pressEscapeOnce`'s order; no run isolated it further. The cap is load-bearing for the
walks (every length, both witnesses), not for the 45/45.

## D3 — records (PASS; `b3c971a`)

| row | result |
|---|---|
| `seedling-bot-log.md` | `### Seedling hammer-phase A4 — the escape's budget` (the profile, the fix, the measurements, two trap candidates) |
| `seedling-bot.md` | the press-kill paragraph: cheap previewed deaths, each key set once, the budget stays 50,000 (`HAMMER_ESCAPE_MEASURED`), the instrument |
| surface | RED at head: one site count (`run:ticksCompleted` 77 → 78, `solverBot.js`, the trace). After `--write`: **GREEN 220**, no new row |
| constants / entities / profile | PASS 5,414 · PASS 528 · PASS 138 (unmoved) |
| reference | regenerated (the new instrument; the docs index). `--check`: ALL 7 + 5 MATCH. `check-procgen-docs`: ALL CHECKS PASSED |
| bounded vitest AFTER | **71 files / 3,126 tests, all green** (BEFORE + the 2 A4 rows); tapeRunner 557 `f22d60bd…` identical. The touched set re-run after the docs (`procgenDocs/generated`, `lintGateLabels`, `hammerEscape`, `seedlingGenCapacity`, `seedlingSolverSurface`, `seedlingConstantsCensus`): 156/156 |
| `seedlingGenCapacity` (fast) killgate row | **stays re-aimed OFF.** Its failure ON is the capacity rule (a certified kill gate keeps its tag: 51 re-rolls and a growth), not time. D1 is result-identical, so the re-roll count is unchanged and the row still cannot meet its rule ON |

## The JS arc's readings (nothing edited)

- `jsRuntimeSolverCalibration.slow`: **5/5** (bounded, `vitest.slow.config.js`).
- `measure-seedling-l18-live-gap.mjs`, residues 40–42: shipped **518 / 500 / 503 t (full)**, dashless 582/555/559,
  work **59/57/57**. These are A2's and A3's values exactly; neither change is a deadline site, so no unit count
  moves.

## CI

Read by SHA (`node scripts/procgen/ci-summary.mjs b3c971a --wait`): **run `37996806486` at `b3c971a`, success.**
- The unfiltered suite: **19,156 passed / 0 failed** (A3 at `7d094b2`: 19,154 / 0; +2 are A4's rows).
- The slow battery: **252 / 0**.
- `seedlingGenCapacity.slow` (job log): **post-sword 529,945 ms against its 900 s bound** (A3's CI: ~889 s; A2's
  tip timed out). Pre-sword 45,570 ms. The file took 575,517 ms in total. The re-roll histograms are identical to
  A3's.

The slow row is now comfortably inside its bound on CI (A3's residue 3 closes).

## Deltas

| row | A3 (`8c34e7c`) | A4 head |
|---|---|---|
| code | — | `previewOrDeath`: no stack for a death (exported); `stepToward`: each key set once; `HAMMER_ESCAPE_MEASURED`; `HAMMER_ESCAPE_TRACE` and `pressEscape`'s `caller`; `maxExpansions` unchanged |
| instrument | — | `profile-seedling-hammer-escape.mjs` |
| sweep, producers, tapes, identity rows | — | all unchanged |
| seed 30 first draw ON | 227 s | 30.0 s |
| slow row post-sword ON (box) | 1,563 s (timeout) | 485 s |
| surface | GREEN 220 | GREEN 220 (one site count) |
| bounded vitest (the reconstructed 71) | 3,124 | 3,126 |

## What the brief got wrong (measured)

1. **"its real cost is search time … post-sword seed 30's first draw 254 s ON vs 25 s OFF".** That draw spends 0.3 s
   in the escape's search. The cost was 16.2 M previewed deaths, each paying a stack capture. The escape only routes
   the walk to where they happen.
2. **"The escape kernel's share … ~71–75% on c3/c6".** That was ON minus OFF, not the kernel's share. Profiled, the
   escape is 6–8% of a c3/c6 run, and c3 ON is now 183 s against 179 s OFF.
3. **"a per-search `maxExpansions` well below 50,000, derived from … SUCCESSFUL escapes".** Every search measured ends
   below 20,109 expansions and the bound cut none. A cap that saves time must un-certify presses, and the derivation
   that bounds a successful search is the whole reachable set (41,463), which 50,000 already is.
4. **"a cap of 1 ⇒ the L18 sweep loses residues".** It does not: 45/45, longer walks. The forecast-side negatives
   still admit only presses that land with a clear approach and train.
5. **"A2's 71-file set"**: the names are still not recorded anywhere. Reconstructed by rule a second time (count and
   total match A3's).

## Residue

| # | item | owner |
|---|---|---|
| 1 | **The killgate draws' escape cost** (57% of their wall time, ON 111 s vs OFF 61 s): certified searches repeated across the generator's solves of one record (87% repeats on draw 57 k=3). The lever is not a cap. It is either the generator not re-solving an identical prefix, or B's search sharing work across solves with a sound key (the run's whole dynamic state: activators, pulls, damage) | hammer-phase B / generator |
| 2 | **For B, from the profile.** `walk no-landing` is the most frequent call: 54,396 on the L18 sweep, 52% of its escape time, ~0.6 ms each, spent on approach previews and the hit-aware forecast. Only then does the forecast say the press does not land. A cheaper landing test before the full forecast would cut it. And `stepToward`'s survival tree is exhaustive wherever nothing survives four ticks (water). It is now cheap per node, but it is still 9⁴ nodes | hammer-phase B |
| 3 | `seedlingGenCapacity`'s fast killgate row stays OFF (the capacity rule's view of a certified kill gate, A2/A3's reason) | planner / user |
| 4 | A3's per-record monotonicity instrument was scratch and was not rebuilt. A4's claim rests on result-identity and byte-identical rows | — |
| 5 | c3 / c6 / c4 are still not banked as CI-read rows (A2's residue 1) | coordinator |

## Byte-inertia

- **Not touched:** AS3, wasm, any gitlink (`bulletml-dodge` checked out at its pin locally), rules, the JS arc's
  files, `levelRun.js`.
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). `git stash` was not used.
- **Copy + restore, md5-checked:** the BEFORE swap (`solverBot.js` at base `53870dbe`, head `598f5840` restored); the
  scratch death counter (`f519de20` both ends); m1/m2/m3 (`855c891c` both ends).
- **Scratch only, never committed:** `g30.mjs`, `micro.mjs`, `an.py`, the profile JSON and logs, the CPU profile.

## Rows to BANK

- **Nothing moved**, so there is no new identity, producer or tape value. A2's rows stand as A2 listed them.
- **Box rows re-confirmed at A4's head:**
  - acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `0d3262f6`, killgate
    `006b0639`/`7d4cb820`/`49e23d85`;
  - producers `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, f1c-phase `01ec5f9f`, hammer-a-escape
    `29891f04`;
  - sweep 45/45 (A3's digests); surface GREEN 220; constants 5,414; entities 528; profile 138; roster 250.
- **CI-read** at `b3c971a` (run `37996806486`): the unfiltered suite 19,156 / 0; the slow battery 252 / 0;
  `seedlingGenCapacity.slow` post-sword 530 s / 900 s.
- **New, box:** `HAMMER_ESCAPE_MEASURED` (largest certified 20,109; largest exhausted 18,245; budget cuts 0); seed
  30's first draw 30.0 s ON / 18.8 s OFF; `seedlingGenCapacity.slow` post-sword 485 s ON / 504 s OFF (quiet 4-core
  box).
