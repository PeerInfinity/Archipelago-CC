# Seedling HAMMER-PHASE — slice P1: the L40 press-kill cost, plan-preserving

Slice `seedling-hammer-p1` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-11):
*"Please run them in the order you would recommend."* One switch, **ON**: `pressKillCost.PRESS_KILL_COST`. OFF is the
control (`SEEDLING_PRESS_KILL_COST=0`, `withPressKillCost(false, fn)`). It is a cost change, not a behaviour change,
so it ships ON with no flip.

| | |
|---|---|
| Start SHA | **`db221dc093`** (= `origin/main` at the fetch, wave 12's bank; `levelWorld.js` carries `SOLID_GRID` ×5) |
| Head | the commit carrying this report. Code: D2 `2a06bee` (the caches) + `726fc56` (gate rows, counts, fixture); D3 `df39c67` (records), `f8df46b` (`--profile-rows`), `0e50477` (the test's explicit ON); the report last |
| Branch | `claude/seedling-press-kill-cost-3hyoes` (the harness names it; the brief's `seedling-hammer-p1`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9575` (`SEEDLING_PORT=9575`), PID 815, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS (the brief's split is stale; the levers measured on the workload that still has it) · D2 PASS (byte-identical; 4.27× on the press-kill workload, the five legs unchanged) · D3 PASS** |

## The one thing to know first

**Wave 12 already fixed the five L40 legs, and the press kill was never their cost after it.** In node, through C1's
own arrival path, all five now SOLVE at base: 158 / 202 / 108 / 37 / 12 s, where C1 measured > 900 / > 900 / 761 / 195 /
61 s. Their profiles are `planSwordDash` 70–77 % (fidelity's region). The press kill runs in only one of them (381), at
4.9 %.

The press-kill-bound workload still exists: C1's own profiled staging A, the 95.7 % in the brief. It is the L40 south
door → chest (880,816), now survey step 78, and C1's two switches are ON. At base it is 90.7 % inside
`execKillByPress`: 3,113 ticks of refuge waits on `spinner@880,848`. P1's four caches take it from **648.7 s to
152.0 s** (median of 3; 4.27×), with the same refusal, the same 3,113 ticks and the same keys md5. Every plan,
trace, record and verdict measured is byte-identical ON vs OFF.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-press-kill-cost-3hyoes origin/main` | `db221dc093`; `grep -ac SOLID_GRID frontend/modules/seedlingDemo/levelWorld.js` = 5 |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules were `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine): `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9575 bash scripts/procgen/identity-block.sh .` | non-`#` md5 **`3a48647f548c821267c3e60cf0ddc496`** = C2's W0, row for row: maze `57e07d21`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, **all exit 0**; reference ALL 7 + 5 MATCH |
| tapeRunner pairs | inside the bounded run, `status\tfullName` sorted | **611**, `75a3c41f0c91f6e71953e82d8259dc60` |
| surface / constants / entities / profile | each `--check` | GREEN **268** · PASS **5,684** · PASS **535** · PASS **138** (both files) |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 16 files: every test naming `deriveStrike`, `execKillByPress`, `spinnerForecast`, `spinnerFightForecast`, `spinnerForecastWithPress`, `nextNow` or `stepSpinners` (`rg -a`), plus `solverBot`, `hammer*`, `solverSpinnerKill*`, `tapeRunner`, `solveProgress` | **1161 / 1161** |

### Today's timings (node, C1's arrival path, 15-minute cap, one at a time)

The legs were re-generated (`seedling-divergence-legs.mjs`, 843 legs). Their ids shifted **+2** since sweep-3: 376 →
378, 379 → 381, 382 → 384, 394 → 396, 398 → 400 (the keys match). The page's delivered set came from
`probe-seedling-divergence-sweep.mjs --mode=inv --ids=400 --dump=…`. The solve path is C1's `inv-leg.mjs` (evidence)
with the sweep rows' four items (torch, fire, shield, sword).

| leg (sweep-3 id) | key | C1 (OFF) | today, base |
|---|---|---|---|
| 378 (376) | `level_40__r0c53 <- in_L41_0_160 -> location:Level 040 - Totem Part 64,144` | > 900 s | **158.5 s, SOLVED 1540 t** (break, kill, walk) |
| 381 (379) | `level_40__r0c53 <- in_L42_240_336 -> location:Level 040 - Totem Part 64,144` | > 900 s | **202.0 s, SOLVED 1592 t** (hold, kill, walk) |
| 384 (382) | `level_40__r23c29 <- in_L39_144_0 -> exit:out_pit_4_20` | 761 s, 859 t | **108.0 s**, 859 t |
| 396 (394) | `… -> location:Level 040 - Totem Part 160,640` | 195 s, 494 t | **37.4 s**, 494 t |
| 400 (398) | `level_40__r23c29 <- in_L43_176_464 -> exit:out_teleporter_480_912` | 61 s, 270 t | **12.5 s**, 270 t |

Load 1.3–2.0 on 4 cores. The page itself solved leg 400 in 3.8 s (417 t, dashless; its staging carries the granted
flags, which node's does not).

### Today's profile

`node --cpu-prof`, inclusive and self per function (`profsum.py`, `split.py`).

**The slowest leg, 381 (191 s under the profiler):**
- `planSwordDash` 70.9 % (`evaluateAt` → `previewWalk` → the preview stepper);
- `execKillByPress` **4.9 %** (`deriveStrike` 3.9 %, `deriveRefuge` 1.0 %);
- self time: GC 19.6 %, `levelRun` step 11.6 %, `previewWalk` 9.8 %, `strikePolicy.strikeCandidates` 6.4 %, and the
  `levelWorld` rows (`solidCandidates` 4.8 %, `collidesSolid` 4.1 %, `liveRectOf` 3.0 %, `assertNormalizedLiveOpts`
  2.4 %, `nearestTileScanIndexed` 1.9 %).

378, 384 and 396 profile the same way (`planSwordDash` 69.6 / 76.5 / 69.2 %), and `execKillByPress` does not run in
them at all: 378's kill is a chaser's. So the brief's split (95.7 % in the press kill) is not any leg's today.

**C1's staging A.** Survey step 78's boot view (`survey-seedling-route.mjs --through=end --route=full --only=78`
writes `.cache/seedling-survey/through-end/views/step-78-boot.json`; it is r8-solve-11's block at L40 (480,896)), goal
`collect:880,816`, through C1's `view-solve.mjs`. It took 665 s under the profiler (wall-clock stop at 480 s, tripped
at the next site, t3113):

| inclusive | share | | by caller | share |
|---|---|---|---|---|
| `execKillByPress` | **90.7 %** | | `spinnerForecast` under `deriveStrike` | 18.0 % |
| `deriveStrike` (`nextNow`) | 50.2 % | | `clearOfHammersAt` under `deriveRefuge` | 16.2 % |
| `deriveRefuge` (`refugeNow` ← `noStrikeMove`) | 39.6 % | | `walkableCells` under `deriveStrike` | 12.6 % |
| `walkableCells` | 24.4 % | | `walkableCells` under `deriveRefuge` | 11.8 % |
| `spinnerForecast` → `stepSpinners` | 18.2 % | | `strikeLineBlocked` under `deriveStrike` | 10.8 % |
| `clearOfHammersAt` → `hammerHitsPlayer` | 16.3 % | | `previewWalk` under `deriveRefuge` / `deriveStrike` | 6.4 / 5.6 % |

Self time: `plannerObstacleAt` 13.2 %, `collideLineSolid` (crusher.js) 10.8 %, GC 9.1 %, `coerceTerrainState` 6.7 %,
`solidCandidates` 6.6 %.

## D1 — the levers, predicted then measured (PASS)

Each prediction is the lever's share of A's BEFORE profile; each measurement is the same rows in the ON profile
(165.7 s), as a share of the BEFORE 665 s.

| lever | brief's candidate | exact condition | predicted | measured |
|---|---|---|---|---|
| **`walkableCells` memo, per run** | "recomputed for an unchanged world?" — yes, twice a tick | the world by identity, and `solverPlanOpts` by value (live bag, keys, contacts, inventory, `noHazards`, the planner constants), a deep copy. Moving chasers are not among its inputs (the danger volumes in `avoidVolumesAt` are the static census's) | −24.4 % | **−24.3 %** (162.1 → 0.3 s); 40/48 hits on leg 381 |
| **the forecast shifted one row** | "forecast reuse across ticks" | the last tick's memo (same roster object, level, world, `ticks − 1`), not the world's first tick, the live bodies field-for-field equal to its row-0 state, and `spinnerCtx().inputs` (the normalised live bag, the open bridges, the freeze) equal to the copy its rows ≥ 1 were stepped under. A press that lands, a knockback, a death, a moved block or an opened lock is a miss | −18 % | **−17.8 %** (119.5 → 1.3 s); 332/350 shifted on 381 |
| **the hammer line's reach bound** | "walls in `reflectAxis`" — the walls were not the cost after wave 12; the refuge's hammer test was | a box wholly outside the spinner's square of half-side `hammerLength + 3` skips `hammerHitsPlayer`. Every point the line tests lies strictly inside `L + 2` (end points `trunc`ed, < 1 px; samples between them; each sample tested at itself or `trunc`ed, < 1 px). Only where the call could not throw | −14 % | **−15.3 %** (107.5 → 5.8 s); 3.03 M of 3.06 M tests skipped on 381 |
| **the strike line once per derivation** | (found in the profile) | one `run.collideLineSolid` per (cell, forecast rect) per `deriveStrike`: the train window slides one row per candidate tick, and nothing advances the run inside a derivation | ≤ −9 % (5/6 of 10.8 %) | **−7.5 %** (71.6 → 21.7 s); 75 % hits on 381 |
| the strike scan's horizon | "scans ticks a bound rules out?" | `opportunityAt` already filters by reach before the train and the line: `clearOfHammersAt` under `deriveStrike` is 0.9 s of 665 | ~0 | not built |

Not built: `previewWalk` (54 % of A after P1: the refuge previews 12 cells a tick, the strike its walks). It
starts from the player's own position, which moves each tick, and its stepper binds live state. A cross-tick cache
would need that whole state as a key. It is the next lever, and it is not cheap.

## D2 — the change, byte-identical, ships ON (PASS)

`frontend/modules/seedlingDemo/pressKillCost.js` (the switch, `PRESS_KILL_COST_COUNTS`, `sameValue`, `snapshotValue`,
`UNCACHEABLE`), wired through the solver's import door (`solverView.js`) into `solverBot.js`
(`walkableCells`, `clearOfHammersAt`, `strikeLineBlocked`/`lineOnce`) and directly into `levelRun.js`
(`spinnerForecast`'s shift, `spinnerCtx().inputs`, `spinnerForecastPrev`). C2's per-weapon press is untouched. The
progress emitter's count points (`progressStatesFor` in `spaceTimeReach`, `progressTick` per tick) are outside every
cache: no search is skipped or doubled. `solveProgress.test.js` is green in both sets.

⚠ **A stored key is a COPY.** `levelRun.pulledRopeIdsNow()` returns the run's own rope map, so a key holding a
reference would compare equal to the very map that moved. `snapshotValue` deep-copies; a value it cannot copy (a class
instance, a getter, a function) makes the key `UNCACHEABLE`, never stored.

### The A/B (ON vs `SEEDLING_PRESS_KILL_COST=0`)

| row | ON | OFF | equal |
|---|---|---|---|
| leg 378 × 3 rounds | SOLVED 1540 t, keys `16c105a1`, plan `766740ba` | the same | **yes**, 1 distinct answer in 6 runs |
| leg 381 × 3 | SOLVED 1592 t, keys `89198518`, plan `8d8e892d` | the same | **yes** |
| leg 384 × 3 | SOLVED 859 t, keys `1d700d96`, plan `fbbe9577` | the same | **yes** |
| leg 396 × 3 | SOLVED 494 t, keys `8bc59cfa`, plan `766ae746` | the same | **yes** |
| leg 400 × 3 | SOLVED 270 t, keys `3adc7396`, plan `b83f54ad` | the same | **yes** |
| staging A × 3 (`--stop-tick=1`) | REFUSED (detour deadline), 3,113 t, keys `af47d35d`, message md5 `b02571c9` | the same | **yes** |
| L18 sweep (`sweep-seedling-l18-residues.mjs`, 45 residues) | 45/45, lengths `1c019765` | 45/45, the same | **yes**, every row (verdict, length, digest, escapes, fellBack) |
| `solve-seedling-r9-campaign --check` | `712f0ead` exit 0 | `712f0ead` exit 0 | **yes** (= base) |
| identity block (at `0e50477`, no edit in flight) | non-`#` md5 `3a48647f`, the six producers exit 0, reference ALL 7 + 5 MATCH | `3a48647f`, the same | **yes**, row for row (= W0) |
| bounded vitest (25 files) | 1436 / 1436 | 1435 / 1436 at first: the one red was `pressKillCost.test.js` reading a hit count from a call it had not forced ON. Fixed (every ON call is `withPressKillCost(true, …)`); the file is 9/9 under both env values | **yes** (tapeRunner 611 `75a3c41f` both) |

"plan" is the md5 of the whole `res.plan` with every `ms` / `*Ms` key stripped (those are the only fields that vary
run to run: `solveMs`, `replayMs`, `passes[].ms`). It includes the trace and the records. Staging A's stop is
tick-based (`shouldStop: run.ticksCompleted >= 1`), so its output does not depend on wall-clock.

### The mutants (copy → edit → measure → restore, md5 checked after each)

Gate: `pressKillCost.test.js` (9 rows) unless named.

| # | mutant | predicted | measured |
|---|---|---|---|
| W1 | `walkableCells` key stored as the opts object (no copy) | red: the contact set mutated in place reads stale | **red** (the in-place contact row) |
| W2 | `walkableCells` key ignores opts | red | **red** (same row) |
| W3 | `walkableCells` ignores the world | red on the world-swap row | first cut of the row **blind** (the two worlds' opts differed, so a miss happened anyway); the row was re-cut so only the world moves → **red** |
| H1 | bound `L − 3` / `L − 2` / `L − 1` | red | **red** at all three (the bound row and the L40 derivation row) |
| H1′ | bound `L` | (the edge) | **green**: on the 4 × 45 × 105² grid, `L` is still exact (the end point is never sampled). `L + 3` ships: 3 px over the measured edge |
| F1 | forecast shift without the state clause | red | **red**: `r9-solve-18` 422 rows diverge, plus the residue-5 solve |
| F2 | forecast shift without the ctx clause | red where a block moves | **red**: `r5-press-glide` 168 rows, `r5-shaft` 673 (scratch run) |
| F3 | forecast key stored as the ctx inputs object (no copy) | blind unless an aliased family changes in place in a spinner room | **blind**. No spinner room holds one (the aliasing family is ropes). The copy rule's own row (`a stored key is a COPY`) is red if `snapshotValue` aliases |
| F4 | forecast shift without the `ticks − 1` and first-tick clauses | equivalent | **green, equivalent by construction**. `advance` hands over `spinnerForecastMemo`, which is non-null only if asked on that very tick, and a first tick changes `world` |
| L1 | strike line keyed by the cell only | red where two rects of one cell answer differently | **red** on the L40 continuation derivation row and on staging A (REFUSED in 3.7 s, message md5 `96a178da`); **blind** on the L18 sweep (45/45 equal) |

### The timings

Three interleaved rounds (ON/OFF order alternating per round), one process at a time on the 4-core box, with no
other jobs. Load average at each start: 0.47–2.02, median 1.34.

| workload | OFF median / min | ON median / min | OFF ÷ ON (medians) |
|---|---|---|---|
| staging A | 648.7 / 645.1 s | **152.0 / 150.4 s** | **4.27×** |
| leg 378 | 146.4 / 142.2 s | 151.9 / 148.9 s | 0.96 |
| leg 381 | 177.0 / 175.8 s | 173.1 / 172.3 s | 1.02 |
| leg 384 | 107.0 / 103.3 s | 111.7 / 102.0 s | 0.96 |
| leg 396 | 35.8 / 31.6 s | 35.6 / 32.7 s | 1.00 |
| leg 400 | 15.0 / 12.3 s | 15.9 / 13.6 s | 0.95 |

The legs move within the box's noise. On 378 and 400 the caches barely run (10 and 2 forecast cuts, nothing else),
so ON cannot cost them anything measurable. On 381 the press kill is 4.9 % of the solve, so its ceiling is about 5 %.
Also measured under parallel load: the L18 sweep's summed solve time went 136.8 → 96.9 s (ON and OFF running side
by side).

## D3 — records (PASS)

- `seedling-bot-log.md` § *Seedling hammer-phase P1 — the L40 press-kill cost*.
- `seedling-bot.md`: a paragraph after C2's.
- Surface `--write` then `--check`: **GREEN 273** (was 268). The five `pressKillCost.js` imports came through the door
  and were classified `seedling`.
- Constants: `--profile-rows`, then `--write`, then `--check`: **PASS 5,710** (was 5,684; +26, all `pressKillCost.js`,
  structural by a file default).
- Entities 535 / profile 138: PASS.
- The reference regenerated: **ALL 7 + 5 MATCH**. `generate-docs-index.mjs` was current (164 docs).
- Bounded vitest AFTER: **1436 / 1436**, 25 files = W0's 16 + `pressKillCost` + `boxLock`, `seedlingConstantsCensus`,
  `procgenDocs/generated`, `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`,
  `entityBlocks`, `seedlingSolverSurface`. The two rows that run a full solve or derivation carry explicit timeouts
  (120 s and 60 s).
- New: `pressKillCost.js`, `pressKillCost.test.js` (9 rows), `fixtures/hammer-p1-l40-south-boot.json` (staging A's
  boot view). `walkableCells` and `deriveStrike` are exported for the test.

## Deltas (base → head)

| | before | after |
|---|---|---|
| identity block | `3a48647f` | **`3a48647f`**, row for row (ON and OFF) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0 | **identical**, exit 0 |
| reference | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH (regenerated for the new docs) |
| tapeRunner pairs | 611, `75a3c41f` | **611, `75a3c41f`** |
| bounded vitest | 16 files, 1161 / 1161 | 25 files, 1436 / 1436 |
| surface | GREEN 268 | **GREEN 273** |
| constants | PASS 5,684 | **PASS 5,710** |
| entities / profile | 535 / 138 | 535 / 138 |
| roster | 277 | 277 (no tape recorded or moved) |
| staging A | 648.7 s | **152.0 s** (median of 3) |

## What the brief got wrong (measured)

1. **"L40 legs time out on the page and in node"** is C1's. At `db221dc` all five SOLVE in node in 12–202 s, with
   C1's ticks wherever C1 had a solve. Wave 12's broad phase did it.
2. **"95.7 % inside `execKillByPress`"** was staging A's, not any leg's. Today the legs are `planSwordDash` 70–77 %,
   and the press kill is 4.9 % of 381 and absent from the other four. A is still 90.7 % press kill, so the levers were
   chosen and measured on A.
3. **"78.9 % in `deriveStrike`, re-derived per tick"** — re-derived, yes. But `deriveRefuge` was the other 40 %:
   every tick with no strike also takes a refuge, and both ask `walkableCells`.
4. **"68.9 % in `spinnerForecast` → `reflectAxis` → `collides`"** — after `SOLID_GRID`, the forecast is 18 %. The
   wall collisions are no longer worth a per-world answer. The refuge's hammer LINE (16 %) was.
5. **"Its candidates: … the strike scan's horizon"** — the horizon costs nothing. `opportunityAt` filters by reach
   before the train and the line.
6. The sweep-3 leg ids are stale: today's list puts them at +2.
7. The bootstrap's `READY` leaves five submodules uninitialised (the reference row needs them). SOLVECOST said the same.

## Residue

- **For fidelity (`levelWorld`), with numbers.** On the legs the cost is `planSwordDash`'s previews.
  - On 381 the `levelWorld` self rows are `solidCandidates` 4.8 %, `collidesSolid` 4.1 %, `liveRectOf` 3.0 %,
    `assertNormalizedLiveOpts` 2.4 %, `nearestTileScanIndexed` 1.9 % (≈ 16 %), beside GC 19.6 %.
  - SOLVECOST's residue lever (share the accepted prefix across `evaluateAt` candidates) is the one that addresses
    this.
  - On A after P1, `run.collideLineSolid` costs 21.5 s of 165 s. Of that, `levelWorld.solidBoxesForMover` is 10.7 s:
    it rebuilds the box list on every line, and a per-tick list would serve every line of a derivation. That is in
    `levelRun`'s query and `levelWorld`, not hammer code: not touched.
- **The next hammer lever: `previewWalk` in the press kill** (54 % of A after P1). The refuge previews 12 cells every
  tick from wherever the player is.
  - A standing player re-previews the same walks. A cache would need the stepper's whole bound state as its key.
  - Alternatively, the refuge could stop re-deriving while a previous refuge's window still holds. That changes
    which cell is chosen, so it is a behaviour change, not P1's.
- **A's kill never lands**: 3,113 ticks of refuge waits on `spinner@880,848`, then the next rung. P1 makes that 4×
  cheaper and leaves the "why" untouched (the hammer arc's next question, not a cost).
- F3 is blind (no spinner room has an aliased family that changes in place). F4 is equivalent by construction.
- `PRESS_KILL_COST_COUNTS` is a module global: two solves in one process sum into it, and the tests reset it.

## CI for the planner (dispatch returns 403 from the cloud)

- **JavaScript Unit Tests** on `claude/seedling-press-kill-cost-3hyoes` at the head. The suite number comes from CI
  (⚖ 52): `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`.
- Optional, for the page: `seedling-divergence-sweep.yml` on the branch, `-f mode=inv -f producer=solver
  -f keys="<the five keys above>"`. Expect the same verdicts as base; the page's `ms` should not move (the press kill
  is ≤ 5 % of these legs).

## Evidence (`seedling-hammer-p1-evidence/`)

Scripts: `inv-leg.mjs` (C1's, plus the keys / plan md5s and the counts), `view-solve.mjs` (C1's, plus the tick stop
and the md5s), `timings.sh`, `l40cost.sh`, `fcast-diff.mjs`, `derive-once.mjs`, `mutant.sh`, `profsum.py`, `split.py`.

Data: `timings.jsonl`, `l40-w0.jsonl`, the profile summaries (`prof-*.txt`), the L18 sweeps ON / OFF, the identity
blocks (W0 / ON / OFF), `censuses-w0.txt`.
