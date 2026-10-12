# Seedling HAMMER-PHASE — slice P2: the press kill's walk previews, plan-preserving

Slice `seedling-hammer-p2` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-12):
*"Press-kill speed, part 2"*. One sibling switch beside P1's, **ON**: `pressKillCost.STRIKE_SCAN_COST`. OFF is the
control (`SEEDLING_STRIKE_SCAN_COST=0`, `withStrikeScanCost(false, fn)`), with P1's `PRESS_KILL_COST` held ON. It is a
cost change, not a behaviour change, so it ships ON with no flip.

| | |
|---|---|
| Start SHA | **`11e113e2fe`** (= `origin/main` at the fetch = D's merge, the brief's floor) |
| Head | the commit carrying this report. W0+D1 `6595d8a` (evidence), D2 `7ac44e6` (code, gate rows, A/B evidence), D3 ``088c3d3`` (records), then this report |
| Branch | `claude/seedling-hammer-p2-ngn2qv` (the harness names it; the brief's `seedling-hammer-p2`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9579` (`SEEDLING_PORT=9579`), PID 809, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS** (the preview levers measured and refused on numbers; two exact levers found beside them) **· D2 PASS** (byte-identical; staging A 1.30×) **· D3 PASS** |

## The one thing to know first

**The press kill's previews cannot be cached exactly from the solver, and what P2 ships is beside them.**
- `previewWalk` is still about half of staging A. Its cost is the chaser forecast stepping 15 bodies (31 % of A) and
  the player's stepper (12 %), inside walks that mostly stall (400 ticks into a wall).
- A cross-tick memo needs the state the stepper and the four forecasts bind. Measured: the same `run.state` and target
  two ticks apart previewed to a different length 104 times. That key is levelRun's to provide.
- P2 takes the two exact levers left in `deriveStrike`: the strike line carried across derivations (97 % hit) and the
  scan restricted to cells within reach of the body (99.85 % of its cell checks skipped). Staging A goes **162.0 →
  124.6 s** (median of 3) with the same refusal, ticks, keys and message. Every gate row is byte-identical.
- The big lever left is a **behaviour** call: cut a refuge candidate's preview once it is longer than the best found.
  It kept A's answer at ~−34 % in a scratch run, but it skips calls that can throw and changes the progress counts.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-p2-ngn2qv origin/main` | `11e113e2fe` (≥ D's merge) |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Five submodules were `-` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, textAdventureEngine): `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9579 bash scripts/procgen/identity-block.sh .` (venv) | non-`#` md5 **`77080c2ed34820619273d5d9d6fcdaa9`**: maze `57e07d21`, acceptance **`933c14f7`** (D's W0 had `76602ae8`: moved by wave 13, not here), c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`, generated set OK (`identity-w0.txt`) |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `712f0ead`, **all exit 0**; reference ALL 7 + 5 MATCH |
| tapeRunner pairs | inside the bounded run, `status\tfullName` sorted | **611**, `75a3c41f0c91f6e71953e82d8259dc60` (= P1, D) |
| surface / constants / entities / profile | each `--check` | GREEN **278** · PASS **5,808** · PASS **558** · PASS **138** (both files) (`censuses-w0.txt`) |
| roster | `fixtures/tapes/index.json` | **277** |
| bounded vitest BEFORE | 30 files: every test naming `previewWalk`, `deriveRefuge`, `deriveStrike`, `execKillByPress`, `walkableCells` or `PRESS_KILL_COST` (`rg -a`), plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress`, `tapeRunner`. `hammerEscapeGenerated.slow` is the slow tier's and was not run | **1372 / 1372** |

### Today's staging A

P1's `view-solve.mjs --view=frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json
--goal=collect:880,816 --stop-tick=1`: **REFUSED** (the ladder exhausted on `chaser:bob@736,752`, detour deadline),
**3,113 ticks**, keys `af47d35d`, message `b02571c9`. These are P1's values: wave 13 did not move A.

**Three runs:** 162.0 / 164.4 / 160.5 s, median **162.0 s**. These are D2's OFF runs. They ran at the head with the
switch OFF, which is the base code path. P1 measured 152.0 s on its own box.

**The profile** (`node --cpu-prof`, base code, 178.8 s under the profiler beside two other jobs; `prof-w0.txt`,
`split-w0.txt`):

| inclusive | share | | by caller / self | share |
|---|---|---|---|---|
| `execKillByPress` | 87.6 % | | `previewWalk` under `deriveRefuge` | **27.6 %** |
| `previewWalk` | **50.9 %** | | `previewWalk` under `deriveStrike` | **23.2 %** |
| `deriveStrike` (`nextNow`) | 50.1 % | | `clearOfHammersAt` under `deriveRefuge` | 4.1 % |
| `deriveRefuge` (`refugeNow` ← `noStrikeMove`) | 35.8 % | | self: chaser forecast `step` (levelRun:7876) | 13.0 % |
| chaser forecast `step` (inside `previewWalk`) | 30.9 % | | self: GC | 11.2 % |
| `strikeLineBlocked` → `collideLineSolid` | 13.1 % | | self: `deriveStrike` (the scan) | 9.4 % |
| player preview stepper (levelRun:16899) | 12.3 % | | self: `previewWalk` | 6.7 % |

## D1 — the levers, measured before chosen (PASS)

**The instrument.** In a scratch worktree, every press-kill preview was logged, then a probe for the stepper memo and
the line repeats was run (`d1-probes.md`, `d1-preview-log.json.gz`, `pwan.py`). Totals: 21,212 previews over 1,329
ticks, 105.9 s; 3.71 M samples.

| lever | predicted (share of A) | measured | hit rate on A | built |
|---|---|---|---|---|
| **cross-tick memo for a standing player** | ≤ 91 % of `previewWalk` (97 of 106 s were repeats of an earlier (state, target)) | **not exact from the solver**: 104 of those repeats previewed to a different length. Its key would be levelRun's closure (`damage`, `frozenTimer`, the live bag, every forecast's bodies, camera, shake) | (91 % repeat by `run.state`; exact rate unknowable from here) | **no** |
| one-entry stepper memo (a stuck walk's fixed point) | ≤ the stepper's 12 % | **0 hits of 3,709,203** steps: pinned on a wall, `vy` cycles and drifts (`d1-stuck-state-diff.txt`) | 0 % | no |
| sharing one preview between strike and refuge on a tick | ~0 | **1** shared (target, state) in 1,329 ticks | 0.005 % | no |
| the refuge's 12 cells' common prefix | ≤ ~1 % | mean shared key prefix **1.08 ticks** of ~104 (66 pairs; 6 of 12 boot candidates stall) (`d1-refuge-prefix.txt`) | — | no |
| the strike's walks across candidate ticks | — | **already built**: U4b D3's `walks` map, one preview per cell per derivation | — | (exists) |
| **the strike line across derivations** | −13 % (`collideLineSolid` 23.5 s) | `collideLineSolid` **23.5 → 1.3 s** | **74,131 / 76,633** (96.7 %) | **yes** |
| **the scan's reach box** | ≤ −9 % (the scan's self time) | `deriveStrike` inclusive 89.5 → 51.0 s with the line; its self time drops out of the top rows (< 2.4 s) | **808.9 M of 810.1 M** cell checks skipped (99.85 %) | **yes** |
| the refuge's best-ETA cut | −30 % (the refuge's previews 49.3 s; 2,118,794 of its 2,145,515 samples come after the best ETA so far) | scratch: **117.0 s** against 177.8 s for the base run beside it (both on a loaded box), the same refusal, keys and message | — | **no: a behaviour change** (below) |

**Why the ETA cut is not exact.** A cut preview skips every stepper and forecast call past the cut. A death in the
stepper (`deathRefusal`), a forecast's own refusal (`chaserForecast`'s shake band) or a lethal pit the full preview
would have raised there is not raised. D1's progress emitter (`progressPreview`) also counts fewer preview states. The
stalls behind it are real geometry: the refuge's 12 nearest clear cells include cells behind walls, and the walk
presses into the wall for 400 ticks, every tick.

## D2 — the change, byte-identical, ships ON (PASS)

**Where.** `pressKillCost.js` gains the sibling switch (`STRIKE_SCAN_COST`, `STRIKE_SCAN_COST_COUNTS`,
`withStrikeScanCost`) and the scan's row index (`cellRowsOf`, `cellsInBox`). They go through the import door
(`solverView.js`) into `solverBot.js` (`deriveStrike`, `strikeLineBlocked`, `lineOnce`, new `carriedLineBook` and
`strikeScanBox`). `lineOnce` is exported for the test. **Not touched:** `previewWalk` (fidelity wave 14's MOVINGWAIT
calls it, and nothing here sits in it), `deriveRefuge`, `levelRun.js`, `levelWorld.js`, `planSwordDash` /
`evaluateAt`, `strikePolicy.js`, `runLatchedWait` / `runHold`, `createRunForStaging`, `ghostSpinnerPress.js` and the
kill rung's weapon gate.

**Why a sibling switch, not P1's.** OFF is P1's head, byte for byte, so the A/B isolates P2. A mutant or a bisection can
then hold P1 ON while it moves P2. P2 works with P1 OFF too: `lineOnce` takes a null per-derivation map.

**The exactness arguments** (beside each in the code):
- **The carried line.** `run.collideLineSolid` truncates its four coordinates first. It then walks them against
  `world.solidBoxesForMover(normalizeLiveOpts(liveSolidOpts()))`, which is `run.liveGeometryOpts()`. The book is keyed
  by the world by identity (a tile write re-wraps it, `visitWorld`), the bag by value through `snapshotValue` (P1's
  copy rule), and each line by its four truncated integers.
  - It is resolved lazily at the first line a derivation reaches. That is where the base calls `collideLineSolid`,
    which reads the same bag.
  - On a noclip run `liveGeometryOpts` refuses by name: no book, every line asked.
  - The blocker object is shared; its one reader asks only whether there is one.
- **The reach box.** `opportunityAt`'s first test is `distanceRectPoint(cell, mine) > reach`. It is a pure read,
  decided before anything is counted, spent or cached, and both arms of `distanceRectPoint` are at least the axis gap.
  - So only cells inside `mine` grown by `reach + 1` can pass, and they are asked in the list's own order, through a
    row index over `walkableCells`' row-major list. A list that is not row-major gets no index and is scanned whole.
  - The ETA floor's `unreachable` count is every cell's (the sorted floors, binary search), as the base loop counts it.
  - A non-finite body rect falls back to the whole list, where the base's `assertRect` throws as before.
- **Count points.** No `progress*` call is inside either lever: `previewWalk` and its `progressPreview` are untouched,
  and no search is skipped. `solveProgress.test.js` is green ON (W0 set, D3 set).

### The A/B (ON vs `SEEDLING_STRIKE_SCAN_COST=0`, P1 ON both)

| row | ON | OFF | equal |
|---|---|---|---|
| staging A × 3 | REFUSED, 3,113 t, keys `af47d35d`, message `b02571c9` | the same | **yes**, 1 distinct answer in 6 runs |
| leg 378 × 3 | refused at the bomb hold (wave 13; brief's expectation), resMd5 `49f6f3b8`, errMd5 `c5ff5e3c`, 167.2 s to refusal | the same, 162.7 s | **yes** |
| leg 381 × 3 | refused at the bomb hold (`hold stance (wandlock@176,80)`, `bombpusher@112,128`), resMd5 `879f1b18`, errMd5 `c1be8451`, 176.9 s | the same, 188.0 s | **yes** |
| leg 384 × 3 | SOLVED 859 t, keys `1d700d96`, plan `fbbe9577` (= P1) | the same | **yes** |
| leg 396 × 3 | SOLVED 494 t, keys `8bc59cfa`, plan `766ae746` (= P1) | the same | **yes** |
| leg 400 × 3 | SOLVED 270 t, keys `3adc7396`, plan `b83f54ad` (= P1) | the same | **yes** |
| L18 sweep (`sweep-seedling-l18-residues.mjs --json`, 45 residues) | 45/45, lengths `462 509 447 …` (= P1's) | the same | **yes**, every row field but the wall-clock `seconds` |
| C2's L18 ghost sweep (`ghost-sweep.mjs`) | 45/45, 336 t at 43 residues, 390 (r5), 340 (r6) | the same | **yes** (`seconds` aside) |
| C2's ghost stagings (`stage-ghost.mjs`, r9-solve-18, r8-solve-18) | SOLVED 336, 4 landings each | the same | **yes** (`seconds` aside) |
| `solve-seedling-r9-campaign --check` | all checks green, rc 0 | the same | **yes** |
| P1's counts on staging A | `hammerSkipped` 655,820,993, `lineHit` 232,636, `lineMiss` 76,633, `cellsHit` 2,643 … | identical | **yes**: the same `opportunityAt` calls |
| identity block (at the D3 tree) | non-`#` md5 `77080c2e`, the six producers exit 0, reference ALL 7 + 5 MATCH | `77080c2e` once its generated-set row was re-run alone (`OK`): the two blocks ran in parallel and OFF's row hit ON's box lock | **yes**, row for row (= W0) |
| bounded vitest | 39 files, 1655 / 1655, tapeRunner 611 `75a3c41f` | — | — |

"plan" is the md5 of the whole `res.plan` with every `ms` / `*Ms` key stripped; "resMd5" is the same over a refused
result. The legs come from `seedling-divergence-legs.mjs` (843 legs, ids unchanged from P1/D) on the page's delivered
set (`probe-seedling-divergence-sweep.mjs --host=http://localhost:9579 --mode=inv --ids=400 --dump=…`), solved by D's
arrival path (`leg-ab.mjs`, from `d1-leg.mjs`, the leg's sphere inventory).

### The mutants (copy → edit → measure → restore, md5 checked after each; scratch worktree)

Gate: the 9 P2 rows of `pressKillCost.test.js` (`-t P2`). Outputs in `mutants/`.

| # | mutant | predicted | measured |
|---|---|---|---|
| K1 | the book's bag key stored by reference (no copy) — **the aliasing mutant** | red | **red**: "a bag changed IN PLACE" and the uncacheable row |
| K2 | the book ignores the bag (world only) | red | **red**: the in-place and new-value rows |
| K3 | the book ignores the world | red | **red**: the new-world row |
| K4 | the line key drops `toY` | red where two lines share three integers | **red**: the L40 derivation row |
| B1 | `unreachable` counted on the box's cells only | red where a scan refuses | **red**: the L40 derivation row (its refused derivations print `unreachable`) |
| B2 | the box shrunk (`reach − 4`) | red | **red**: the L40 row and the r9-solve-18 solve |
| B3 | the pad at `reach` | (the edge) | **green**: on the integer lattice the edge is `reach` itself. `reach + 1` ships, a pixel over the measured edge |
| B5 | the pad at `reach − 1` | red | **red**: the L40 row and the r9-solve-18 solve |
| B4 | the box's cells returned in reverse order | red | **red**: the index row, the L40 row and the solve |
| B6 | the floor test dropped inside the box | red | **red**: the L40 row and the solve |

(A first B4 edit was a no-op, my mistake; it was replaced and its output not kept.) No mutant is blind.

### The timings

Three interleaved rounds (ON/OFF order alternating per round), one process at a time on the 4-core box, no other jobs
(`timings.sh`, `timings.jsonl`). Load average at each start: 1.05–1.93, median 1.40.

| workload | OFF (P1) median / min | ON (P1 + P2) median / min | OFF ÷ ON (medians) |
|---|---|---|---|
| staging A | 162.0 / 160.5 s | **124.6 / 119.5 s** | **1.30×** |
| leg 378 (to refusal) | 162.7 / 150.9 s | 167.2 / 157.7 s | 0.97 |
| leg 381 (to refusal) | 188.0 / 171.2 s | 176.9 / 170.8 s | 1.06 |
| leg 384 | 107.8 / 98.4 s | 107.2 / 106.2 s | 1.01 |
| leg 396 | 40.5 / 40.0 s | 42.6 / 41.0 s | 0.95 |
| leg 400 | 14.5 / 12.9 s | 16.4 / 16.3 s | 0.89 |

**The legs cannot move.** On all five, every P1 and P2 counter reads 0 in both modes: none of them reaches the press
kill now. 378 and 381 refuse at the bomb hold first. 384 / 396 / 400 never meet a spinner press. Their spread is the
box's (P1 saw 0.95–1.02).

**P2's profile on A** (134.9 s under the profiler; `prof-p2.txt`, `split-p2.txt`): `previewWalk` 68.1 % (refuge
36.8 %, strike 31.1 %), chaser forecast `step` 41.3 %, player stepper 16.1 %, `deriveStrike` 37.7 % (was 50.1 %),
`collideLineSolid` 1.0 % (was 13.1 %).

## D3 — records (PASS)

- `seedling-bot-log.md` § *Seedling hammer-phase P2 — the press kill's walk previews* (after D's).
- `seedling-bot.md`: a paragraph after P1's (*The strike scan's cost, with no plan moved*).
- Surface `--write`, the four new rows classified, then `--check`: **GREEN 282** (was 278). `STRIKE_SCAN_COST` and
  `STRIKE_SCAN_COST_COUNTS` are `seedling`/constant; `cellRowsOf` and `cellsInBox` are `seedling`/function.
- Constants: `--profile-rows` (138 rows, no change), `--write`, then `--check`: **PASS 5,829** (was 5,808; +21, all
  `pressKillCost.js`, structural by the file default).
- Entities 558 / profile 138: PASS.
- The reference regenerated (`generate-procgen-reference.mjs`, the README's word count and the docs index), then
  `--check`: **ALL 7 + 5 MATCH**. `generate-docs-index.mjs` was current (164 docs).
- Bounded vitest AFTER: **1655 / 1655**, 39 files = W0's 30 (now 1381 tests: + the 9 P2 rows) + `boxLock`, `seedlingConstantsCensus`, `procgenDocs/generated`, `procgenDocs/docLinks`, `procgenDocs/docsRender`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`, `checkProcgenHelp`; tapeRunner 611 `75a3c41f` (`vitest-after.txt`).
- New gate rows (9, in `pressKillCost.test.js`): the switch; the row index against a whole-list filter (2,400 boxes) and
  its refusals; the carried book (carried, in-place bag, new bag, new world, uncacheable bag, noclip); the L40
  derivations ON vs OFF (the kill-start strike with continuation, the bounded refusal, a body across the level;
  explicit 90 s timeout); r9-solve-18 at residue 5 solved both ways (explicit 180 s timeout).

## Deltas (base → head)

| | before | after |
|---|---|---|
| identity block | `77080c2e` | **`77080c2e`**, row for row (ON and OFF) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, exit 0 | **identical**, exit 0 |
| reference | ALL 7 + 5 MATCH | ALL 7 + 5 MATCH (regenerated for the new docs) |
| tapeRunner pairs | 611, `75a3c41f` | **611, `75a3c41f`** |
| bounded vitest | 30 files, 1372 / 1372 | 39 files, 1655 / 1655 |
| surface | GREEN 278 | **GREEN 282** |
| constants | PASS 5,808 | **PASS 5,829** |
| entities / profile | 558 / 138 | 558 / 138 |
| roster | 277 | 277 (no tape recorded or moved) |
| staging A | 162.0 s (P1's head; P1 measured 152.0 s) | **124.6 s** (median of 3) |

## What the brief got wrong (measured)

1. **"A cross-tick cache needs that whole bound state as its key."** True, and that state is not reachable from the
   solver. The same `run.state` and target previewed to different lengths 104 times. The key is levelRun's closure:
   damage, frozen timer, the live bag, and every forecast subsystem's bodies, camera and shake.
2. **"The strike's walk previews across its candidate ticks within one derivation, like P1's line-once lever."** That
   is already built: U4b D3's `walks` map previews each cell once per derivation.
3. **"Sharing a preview across the refuge's 12 cells (a common prefix)."** The mean shared key prefix is 1.08 ticks of
   ~104, and the forecasts are stateful closures that cannot be forked.
4. **"`previewWalk` is 54 % of staging A after P1."** It is 50.9 % at this base. Its own cost is mostly levelRun's
   chaser forecast (31 % of A) and 400-tick stalled walks (two thirds of the samples), not repeated work a key can name.
5. **"P1's five L40 legs (… 378 and 381 now refuse at the bomb hold)."** Yes, and more: none of the five reaches the
   press kill at this base (every counter 0), so the leg rows are identity checks only; they cannot speed up.
6. **The identity block's standing md5 moved** from P1/D's `3a48647f` to `77080c2e` at the base (the acceptance row,
   `76602ae8` → `933c14f7`): wave 13's, not named in the brief.
7. The bootstrap's `READY` leaves five submodules uninitialised (P1 and D said the same). The delivered-set dump needs
   `--host=http://localhost:<port>`: it does not read `SEEDLING_PORT` (defaults to 8000).

## Residue

- **For fidelity / levelRun, with numbers.** On staging A after P2, `previewWalk` is 68 %. Inside it:
  - the chaser forecast's `step` (`chaserForecastNow`, 15 bodies, `move`/`sweep`/`blocked` and `shieldBumpTouches`)
    is 41.3 % inclusive;
  - the player's preview stepper is 16.1 %.
  - A cross-tick preview key would need levelRun to expose (or hash) what `previewStepper` and the four forecasts bind.
    That is levelRun's surface, not this slice's.
- **The behaviour lever, for the user.** Cut a refuge candidate's preview once it passes the best ETA found
  (`stopWhen`).
  - Scratch: same answer on A, ~−34 %; 99 % of the refuge's samples are past the cut.
  - Exact only where nothing past the cut would throw. It changes `progressPreview`'s preview-state counts.
  - A geometric pre-filter for cells behind walls (the stalls) is the same kind of decision.
- **Staging A's 3,113 ticks are unchanged.** D measured the kill landing there (six landings, `spinner@880,848` dies
  at t3100) and the refusal coming on the chaser `bob@736,752`, with ~1,500 ticks of refuge waits between landings.
  P2 makes each waiting tick cheaper (1.3×). Fewer waits is the hammer arc's question.
- `STRIKE_SCAN_COST_COUNTS` is a module global like P1's counts: two solves in one process sum into it, and the tests
  reset it.

## CI for the planner (dispatch returns 403 from the cloud)

- **JavaScript Unit Tests** on `claude/seedling-hammer-p2-ngn2qv` at the head. The suite number comes from CI (⚖ 52):
  `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`.
- Optional, for the page: `seedling-divergence-sweep.yml` on the branch, `-f mode=inv -f producer=solver
  -f keys="<the five keys>"`. Expect base's verdicts and `ms`: none of the five reaches the press kill.

## Evidence (`seedling-hammer-p2-evidence/`)

- Scripts: `view-solve.mjs` (P1's, plus P1's and P2's counts), `leg-ab.mjs` (D's `d1-leg.mjs` plus plan and refusal
  md5s and the counts), `timings.sh`, `d2-gates.sh`, `mutants/mt.sh` + `mutant.sh`, `profsum.py`, `split.py`,
  `pwan.py`, `stallprobe2.mjs`, `prefix.mjs`, `bodies.mjs`.
- Data: `timings.jsonl`, the D2 gate outputs (`d2-*-{on,off}.txt`), `mutants/mut-*.txt`, the profiles
  (`prof-w0.txt`, `prof-p2.txt`, `split-*.txt`), the D1 probe outputs (`d1-*`), `identity-{w0,on,off}.txt`,
  `censuses-w0.txt`, `vitest-after.txt`.
