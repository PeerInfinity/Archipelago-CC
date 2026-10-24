# Seedling HAMMER-PHASE — slice SF2: make STRIKE_ETA_FLOOR cheaper before its flip

Slice `seedling-hammer-sf2` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-15):
*"Cheaper first, then flip"*, *"Only the SF follow-up"*. `STRIKE_ETA_FLOOR` stays **OFF**. Nothing was re-recorded.

| | |
|---|---|
| Start SHA | **`f32ec04189`** (= `origin/main` at the fetch: SF merged) |
| Head | the commit carrying this report. Before it: W0 `6cae50b`, D1 `b58cede`, D2 `b5de83f`, D3 `44e46c7`, D4 `8fcc106` |
| Branch | `claude/seedling-hammer-sf2-3g1jfz` (the harness names it; the brief's `seedling-hammer-sf2`). Nothing went to `main` |
| Defaults at the base | `REFUGE_ETA_CUT` **ON**, `PRESS_KILL_DONE_ON_WALK` **ON**, `STRIKE_ETA_FLOOR` **OFF**, `CONTACT_FIDELITY.strikeIframeLapse` **OFF** (the lapse flip had not landed on `main`; every measurement ran at these defaults) |
| Verdict | **W0 PASS · D1 PASS (no STOP) · D2 PASS · D3 DONE (movers listed, nothing re-recorded) · D4 PASS** |

## The one thing to know first

**The cap makes ON a little cheaper, not much cheaper, and the brief's 1.15× target is out of reach.** The built shape
is `STRIKE_PREVIEW_CAP` = 16. Past 16 previews, a cell the bounded pass has not measured is asked OFF's question.
- **No loss.** It loses no strike OFF finds, over 20,640 derivations, at every cap measured.
- **Same trajectories.** 11 of 12 workloads end on SF's shape-a answers end to end.
- **The cost.** The L18 sweep runs **1.44×** OFF, against SF's 1.52×.
- **No cheaper point.** No cap of 1 or more brings the L18 scan inside derivations under 1.15× OFF (1 gives 1.21×).
  Smaller caps are cheaper inside a derivation but *slower* end to end. Staging A runs ~159 s at caps 2, 4 and 8,
  against OFF's 128 s and shape a's 65 s.

The census follows OFF's run, so it does not price a trajectory. The flip's table is SF's with three changes (D3).

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main`; the harness branch already sat at `origin/main` = `f32ec04189` (≥ the brief's floor) |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`, node v22.22.0. **Six** submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each |
| identity block | `SEEDLING_PORT=9587 identity-block.sh .` at the pristine base (`evidence/w0/identity-w0.txt`): **equal to SF's W0 row for row**. Maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `afdc6d1a`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK, reference **ALL 7 + 5 MATCH** |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead`, all exit 0 |
| tapeRunner pairs | **611 `75a3c41f`** |
| surface / constants / entities / profile / roster | GREEN **296** · **5,882** · **566** · **138** · **277** |
| bounded vitest BEFORE | 21 files (`evidence/w0/vitest-files.txt`: every non-slow test naming `deriveStrike` / `minTicksBetween` / `STRIKE_ETA_FLOOR` / `strikeScanBox` / `STRIKE_CANDIDATES`, plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress*`), at a pristine worktree of the base: **412 / 413**. The one red is `jsRuntimeSolveProgress`'s *"at most one post a second"* row (2 posts vs 1) at a load of ~4; alone it gives **5 / 5** |
| SF's census rows | in a pristine worktree of the base, OFF: staging A `7c279226` / `b3b38f55`, 397 `4720caab`, 414 `489a9482`, L18 `864ab175`, the ghost staging `1ca7eed5`, killgate `md5(rows)` `660869bc / 504396f1 / a63cbb18`. **Every one equals SF's.** ON (shape a): staging A `35c9a3be` / `3549733c`, L18 `7efe7059`, the ghost staging `0a9504dc`, killgate `4926635b / 69f421d4 / 02445c34` — **SF's D3 values** (`evidence/w0/census-rows-w0.txt`) |

## D1 — the census of the cheaper shapes (PASS; no STOP)

**The lab** (`evidence/tools/make-lab2.py`, applied to a scratch worktree copy, never the tracked tree).
- It is SF's lab re-cut. Every derivation runs every variant in rotating order, the run follows OFF, and the shadow
  variants' instrument counts are restored.
- Shape b runs only at a continuation (admission) derivation. The (d) composites are built from those records:
  b at the admission, another variant elsewhere.
- **Proof the lab is inert:** every census answer equals the base's (W0 above). The totals of OFF, the floor alone
  and shape a equal SF's exactly: the floor alone loses 470; shape a loses 0, finds 6,373 and previews 271,077.

**The shapes:**
- **(c) the admissible floor past K** (`cf<K>`): past K previews, an unknown cell's pair is admitted by the
  admissible floor alone.
- **(c) stop past K** (`cs<K>`): the pass stops where the (K+1)-th preview would be needed.
- **(c′) OFF's floor past K** (`co<K>`, the shape added): past K previews, an unknown cell's pair is asked OFF's
  question (`minTicksBetween`, then `opportunityAt`, no preview). **Why add it:** the brief's two fallbacks either
  reopen the floor-only trap (the admissible floor) or drop the tail of the pass (stopping). OFF's question has
  neither problem, and K = 0 is OFF pair for pair. Measured: equal on all 10,086 L18 derivations, and end to end on
  killgate s2.
- **(d)**: b at the admission, with a (`d-a`) or the floor alone (`d-floor`) or `co<K>` (`d-co<K>`) elsewhere.
- **(e) bounded previews** (the second shape added; `make-lab3.py`). A pair only asks "does the walk arrive within
  i − 1?", so the preview stops there (`previewWalk`'s existing `stopWhen`, body untouched), and a later pair deepens
  it. **Why:** co1 showed the first previews are the expensive ones (~2.6 ms each).

**Totals over the 12 workloads (20,640 derivations)** (`evidence/d1/d1-census-table.md`; per workload
`d1-census-long.md`; every record in `d1-census-records.tar.gz`):

| variant | earlier · **lost** · found · other (vs OFF) | shape a's finds it loses | previews | scan s, all | L18 scan s (× OFF) | staging A sword (× OFF) | ghost staging (× OFF) |
|---|---|---|---|---|---|---|---|
| OFF | — | — | 76,882 | 409 | 72.9 (1.00×) | 71.8 (1.00×) | 65.4 (1.00×) |
| floor alone | 1,907 · **470** · 9 · 42 | 6,834 | 88,358 | 348 | 50.7 (0.69×) | 69.1 (0.96×) | 46.6 (0.71×) |
| a (SF) | 2,211 · **0** · 6,373 · 90 | 0 | 271,077 | 1370 | 174.5 (2.39×) | 271.3 (3.78×) | 80.3 (1.23×) |
| cf4 | 2,170 · **101** · 28 · 48 | 6,446 | 124,710 | 562 | 86.5 (1.19×) | 117.6 (1.64×) | 63.2 (0.97×) |
| cf8 | 2,211 · **8** · 1,962 · 54 | 4,419 | 171,340 | 829 | 123.3 (1.69×) | 179.9 (2.50×) | 70.3 (1.07×) |
| cf16 | 2,211 · **0** · 5,660 · 90 | 713 | 231,039 | 1178 | 144.6 (1.98×) | 254.0 (3.54×) | 73.3 (1.12×) |
| cs4 | 1,427 · **1,801** · 3 · 57 | 8,171 | 68,059 | 308 | 36.2 (0.50×) | 65.5 (0.91×) | 19.0 (0.29×) |
| cs8 | 2,173 · **67** · 116 · 48 | 6,324 | 134,505 | 639 | 95.8 (1.31×) | 132.0 (1.84×) | 49.0 (0.75×) |
| cs16 | 2,211 · **1** · 4,466 · 91 | 1,908 | 219,987 | 1131 | 142.3 (1.95×) | 253.3 (3.53×) | 74.0 (1.13×) |
| **co2** | 1,188 · **0** · 100 · 36 | 6,273 | 101,856 | 539 | 93.4 (1.28×) | 98.8 (1.38×) | 70.9 (1.08×) |
| **co4** | 1,927 · **0** · 274 · 48 | 6,099 | 126,089 | 649 | 103.4 (1.42×) | 129.7 (1.81×) | 67.5 (1.03×) |
| **co8** | 2,206 · **0** · 2,378 · 63 | 3,995 | 171,354 | 853 | 125.7 (1.72×) | 182.2 (2.54×) | 71.1 (1.09×) |
| **co16** | 2,211 · **0** · 5,694 · 90 | 679 | 231,043 | 1180 | 144.8 (1.99×) | 262.0 (3.65×) | 73.3 (1.12×) |
| d-a | 2,211 · **0** · 6,373 · 90 | 0 | 279,848 | 1384 | 181.4 (2.49×) | 271.5 (3.78×) | 83.9 (1.28×) |
| d-floor | 1,907 · **470** · 9 · 42 | 6,834 | 98,844 | 364 | 57.8 (0.79×) | 69.6 (0.97×) | 50.9 (0.78×) |
| d-co2 / d-co4 / d-co8 / d-co16 | as co2 / co4 / co8 / co16 (**0** lost) | as co | +7–11 k | +13–17 | 1.38 / 1.52 / 1.82 / 2.08× | = co | 1.09 / 1.10 / 1.15 / 1.18× |

**More L18 runs** (`evidence/d1/d1-l18-extra-caps.txt`, two more lab passes on L18 only):
- co0 is OFF: 10,086 / 10,086 the same, 1.00×.
- co1 is **1.21×** (found 9). co12 is 1.89×, co24 2.17×, and co32 2.34× (≡ shape a: 0 of a's finds lost).

**Shape e** (`d1-shape-e-bounded-previews.txt`):
- It equals shape a in every returned field on 10,086 / 10,086 L18 derivations.
- It costs **more**: 159 s against 153 s, with 9.7 M samples previewed against 8.3 M. The cost is not long walks.
  A cell that stays an opportunity is deepened tick after tick, and each deepening re-walks the prefix.

**The "other" column.** Every "later" pick of a capped variant is SF's case: OFF returned its UNCERTIFIED escape
fallback, and the variant found a later strike whose escape is CERTIFIED.

**Reading it:**
- **(c) as the brief framed it loses strikes at small K.**
  - The admissible floor past K loses 101 at 4 and 8 at 8 (the floor-only trap, reopened).
  - Stopping loses 1,801 at 4, 67 at 8 and 1 at 16.
- **(c′) loses 0 at every K** (2, 4, 8, 16, and 1, 12, 24, 32 on L18). Its finds rise with K: 100 → 5,694.
- **(d) is never cheaper than shape a without the floor-only losses.** b at the admission costs ~7–8 s on L18, on top
  of whatever runs on the refuge ticks. Shape a there gives a's losses (0) at more than a's cost. The floor alone
  there gives the floor's 470 losses.
- **The STOP test.** A candidate that loses 0 at under shape a's L18 cost exists: every co2…co24. So no STOP.
- **The 1.15× test.** No K of 1 or more reaches it. The cheapest zero-loss point that does anything is co1 (1.21×,
  9 found); co0 is OFF.

**End to end, the census misleads** (`evidence/d1/d1-e2e-caps.txt`: one run per cap, loads 1–5, exploratory; D3
has the interleaved timing):

| workload | OFF | a | co2 | co4 | co8 | co16 | co24 / co32 |
|---|---|---|---|---|---|---|---|
| L18 sweep | 114 s `864ab175` | 175 s `7efe7059` | 173 s, Σ 20,828 | 158 s, Σ 19,570 | 126 s, Σ 19,485 | 165 s, **= a** | 153 s, **= a** |
| staging A, sword | 128 s | 66 s | 159 s | 159 s | 116 s | 64 s (differs) | 59–61 s, **= a** |
| staging A, ghost | 105 s | 61 s | 117 s | 183 s | 125 s | 55 s, **= a** | 54–55 s, **= a** |
| ghost staging | 89 s | 92 s | 84 s | 72 s | 72 s, = a | 73 s, **= a** | — |
| leg 397 / 414 | 153 / 155 s | 125 / 129 s | 205 / 205 s (= OFF's answer) | 211 / 238 s (= OFF) | **345 / 742 s** | 123 / 158 s, **= a** | — |

A small cap finds fewer of shape a's strikes, so the kill runs longer. The executor re-derives on every refuge tick
of that longer kill. Caps 2, 4 and 8 are slower than OFF on staging A, and on the legs too.

## D2 — the shape chosen: `STRIKE_PREVIEW_CAP` = 16 (PASS)

**Why 16:**
- (c′) is the only family that loses nothing at every cap.
- Below 16 the end-to-end cost is worse, not better (above).
- 16 is the smallest cap that keeps shape a's trajectories: 5 of 6 solve workloads in D1, and 11 of 12 in D3.
- Against shape a, it keeps 5,694 of the 6,373 strikes found where OFF refuses, and it scans 17 % less inside the
  L18 derivations.
- 24 and 32 cost more and buy nothing more measured; 32 is shape a on every derivation.

**What it is** (`solverBot.js`):
- `export const STRIKE_PREVIEW_CAP = 16`, with the why in its docblock.
- `STRIKE_ETA_FLOOR.previewCap` holds it, so a test can set 0 (OFF's pass) or ∞ (SF's).
- `measuredPair` is changed: once `scanned >= previewCap`, an unknown cell's pair is skipped when `i − 1 <
  minTicksBetween(run.state, c)` (counted in `capSkipped`); otherwise it is `opportunityAt`, with no preview.
- `capSkipped` rides a refusal beside `scanned` and `etaSkipped`.
- The SF docblock and `strikeScanBox`'s paragraph say so.
- `previewWalk`'s body, `deriveRefuge` / `refugeNow`, the chaser-arm seam, the climb ladder, `chooseBodyToRemove` and
  fidelity's files are untouched.

**`strikeScanBox` stays consistent.** The floor map is still the live (admissible) floor's, so `unreachable` counts
the live floor's skips. The pairs OFF's floor skips past the cap are not floor skips; they are counted apart
(`capSkipped`), as SF counted the measured skips.

**OFF is byte-inert.** OFF never calls `measuredPair`, and the refusal's new field is behind `measured`. Measured:
- the identity block OFF at the head equals W0 row for row (`evidence/d3/identity-off.txt`);
- all 12 workloads OFF at the head equal the base in three rounds each (D3).

**The gate** (`hammerStrikeEtaFloor.test.js`, 13 → 16 rows):
- *"ships at 16, and the switch reads it"*;
- *"K = 0 is OFF's pass"*: G1's walk at t10, t190, t1450 and t1900, where K = 0 equals OFF's strike or refusal;
- *"the budget is taken"*:
  - at t190, 4 previews keep OFF's strike `(728,680)@497`, and 8, 16 and ∞ give SF's `(744,728)@432`;
  - at t1450, ∞ finds `(712,680)@1913`, while 16 refuses with `scanned` 16 and a `capSkipped` count.

The ticks come from `evidence/d2/d2-probe-cap-g1.jsonl` (`probe-cap.mjs`: G1's walk every 10 ticks, OFF and caps 0 /
2 / 4 / 8 / 16 / ∞, 213 samples). K = 0 equals OFF at all 213 samples. SF's rows stay green.
- The file OFF: **16 / 16**.
- With `SEEDLING_STRIKE_ETA_FLOOR=1`: **15 / 15 + 1 skipped** ("ships OFF", by design).

**Mutants** (in place, restored by md5 `1a356a85` each time; `evidence/d2/M*.txt`):

| mutant | caught by |
|---|---|
| M5 the cap ignored | *K = 0* and *the budget is taken* (2 failed) |
| M6 past the cap, the admissible floor (OFF's floor check dropped) | the same 2 |
| M7 past the cap, refuse every unknown cell | the same 2 + the witness solve (3 failed) |
| M8 off by one (`>` for `>=`) | the same 2 |
| SF's M1 floor-only, re-run | 5 failed (SF's three + the two new rows) |

**The game witness `hammer-sf-l40-strikefloor` is unchanged under the cap, measured:**
- `plan-seedling-hammer-sf-strikefloor.mjs --check` is all green, and the committed tape is **byte-identical**
  (`evidence/d2/d2-witness-check.txt`);
- the gate's *"ON: the solve's executed prefix IS the witness"* passes (89 s).

So nothing was re-derived. The game's equality (1,630 / 1,630, the Spinner rows) holds because the tape is the one
the game played.

## D3 — end to end, ON at the cap: the movers (nothing re-recorded)

**Timings** (`evidence/d3/d3-timings.md`):
- Three rounds, interleaved, per workload. In each round the three modes run side by side: OFF at the head, shape a
  at the base (a pristine worktree, ON), and the cap at the head (ON). The order rotates by round.
- Every wall carries the 1-minute load at its start. The box has 4 cores.
- No file was edited during the rounds.
- Every answer is **byte-stable over the three rounds** in every mode.

| workload | OFF median / min s | shape a median / min (÷ OFF) | **the cap** median / min (÷ OFF) | answer |
|---|---|---|---|---|
| staging A, sword | 129.2 / 121.0 | 72.0 / 64.7 (0.56×) | **62.9 / 53.9 (0.49×)** | the cap ≠ a (below) |
| staging A, ghost | 107.0 / 100.2 | 68.3 / 55.6 (0.64×) | **60.7 / 56.0 (0.57×)** | = a |
| leg 397, ghost | 159.6 / 141.8 | 128.2 / 123.9 (0.80×) | **118.4 / 117.1 (0.74×)** | = a |
| leg 414, ghost | 167.2 / 166.6 | 140.3 / 131.2 (0.84×) | **136.0 / 128.2 (0.81×)** | = a |
| L18 sweep (45) | 110.5 / 102.1 | 167.8 / 158.2 (**1.52×**) | **159.2 / 144.3 (1.44×)** | = a |
| C2's ghost staging (45) | 81.2 / 80.0 | 83.6 / 82.8 (1.03×) | 87.6 / 82.7 (1.08×) | = a |
| `r9-campaign --check` | 52.3 / 49.1 | 53.2 / 50.2 (1.02×) | 50.6 / 49.3 (0.97×) | = a (exit 1) |
| `r8-l18 --check` | 2.2 / 2.1 | 4.1 / 3.7 | 4.0 / 3.7 | = a (exit 1) |
| `r8-d2-chain --check` | 3.8 / 3.6 | 5.2 / 4.8 | 5.6 / 4.9 | = a (exit 1) |
| killgate s2 / s5 / s9 | 3.5 / 7.1 / 8.5 | 7.2 / 3.7 / 5.1 | 7.0 / 3.4 / 4.8 | = a |

Loads ran 0.9–5.4, mostly 3.3–4.9.

**Every mover, before (OFF) → after (the cap ON)** (norm-md5 of the output; `evidence/d3/outs/`):

| workload | OFF | ON at the cap | SOLVE gained / lost, ticks |
|---|---|---|---|
| staging A, sword | `7c279226`: REFUSED t3113 on `bob@736,752`; spinner killed t3100; 6 hits | `1bcc53a2`: REFUSED **t1753** on **`bobsoldier@880,832`**; `spinner@880,848` hit t511 / 1610 / 1654, killed **t1740**; `@816,848` hit t1743; 3 hits. (Shape a: `35c9a3be`, REFUSED t1695 on `bob@736,752`, killed t1682) | none (refused in all three) |
| staging A, ghost | `b3b38f55`: REFUSED t2195; killed t2114 and t2182 | `3549733c` (= a): REFUSED **t1629**; `spinner@880,848` killed **t1616** | none |
| leg 397, ghost | `4720caab` | `1e7c2fee` (= a) | none |
| leg 414, ghost | `489a9482` | `cc715263` (= a) | none |
| L18 sweep | `864ab175`: 45 SOLVE, Σ 19,545 | `7efe7059` (= a): **45 SOLVE**, 24 shorter, 21 longer, Σ **19,558**, every residue's length = a's | none |
| C2's ghost staging | `1ca7eed5`: 45 SOLVE, Σ 15,178 | `0a9504dc` (= a): 45 SOLVE at 328 t, Σ 14,760 | none |
| `r8-l18 --check` | exit 0 | exit 1: `r8-solve-18` **363 → 467 t**, `{18,0}` at 305 → 419, 0 hits | longer |
| `r8-d2-chain --check` | exit 0 | exit 1: the headline 1,669 → **1,773 t**; its prefix row fails at tick 11 | longer |
| `r9-campaign --check` | exit 0 | exit 1: `r9-solve-18` **518 → 476 t**; Σ 10,931 → **10,889**; `r9-solve-19`'s free oracle misses | shorter |
| killgate s2 / s5 / s9 `md5(rows)` | `660869bc / 504396f1 / a63cbb18` | `4926635b / 69f421d4 / 02445c34` (= a) | the printed table is unchanged |

**The identity block ON** (`evidence/d3/identity-on.txt`, against `identity-off.txt` = W0):

| row | OFF (= W0) | ON at the cap | SF's ON |
|---|---|---|---|
| acceptance batch | `933c14f7` | `9fbd9304` | = |
| empty pairs c3 / c6 | `4937da80` / `430573e9` | `c4a58671` / `5d06a8b0` | = |
| **carved pairs c4** | `b9d2185d` | **`1c5127cd`** | **`1efcc4b9`** |
| killgate s2 / s5 / s9 | `006b0639 / 7d4cb820 / 49e23d85` | `7c15ed57 / 47116405 / 4d3bbf17` | = |
| `r8-d2-chain`, `r8-l18`, `r9-campaign --check` | exit 0 | exit 1 (`f5490519`, `3c81acbe`, `8475fa2a`) | = |
| **ENEMY census**, maze, guard, AREA, levels, generated set, `r8-battery`, `r8-tail`, `r9-l3`, reference | as W0 | **=** (do not move) | = |

### The flip's re-record table at the head (for the planner to take to the user)

A flip of `STRIKE_ETA_FLOOR_DEFAULT` to `true`, with `STRIKE_PREVIEW_CAP` = 16, would re-record or re-pin all of
this. **None of it was touched here.**

| kind | what | measured ON |
|---|---|---|
| committed tapes + traces (producers) | `r8-solve-18` (`solve-seedling-r8-l18`) | 363 → 467 t |
| | `r8-d2` (`solve-seedling-r8-d2-chain`) | 1,669 → 1,773 t; `{18,0}` 305 → 419 |
| | `r9-solve-18` (`solve-seedling-r9-campaign`), and `r9-solve-19`'s declared seam.time | 518 → 476 t; Σ 10,931 → 10,889 |
| witness producers whose `--check` fails ON on a premise | `f1c-l18-phase`, `hammer-a-escape` (×2), `hammer-b1-approach`, `hammer-b2-fight`, `hammer-g1-ghostkill`, `hammer-bw-bombstand` | below |
| witness TAPES that drift ON | `f1c-l18-phase42`, `hammer-a-l18-escape15`, `-escape21`, `hammer-g1-l40-ghostkill` (the bw producer stops before its drift check) | |
| identity rows | acceptance batch; empty pairs c3, c6; carved pairs c4; killgate s2, s5, s9 | md5s above |
| gate rows (the bounded set run ON: **22 failed in 12 files**, `evidence/d3/vitest-on.txt`) | `hammerApproach` (1), `hammerEscape` (2), `hammerFight` (1), `hammerFightFallback` (2), `hammerGhostKillRung` (1), `hammerGhostSpinner` (2), `hammerPressBombs` (1), `pressKillCost` (1), `procgenScratchPersistence` (3), `solveProgress` (3), `solverBot` (1), `solverSpinnerKill` (4: F2 515 → 490, 264 → 197, 269 → 238, 210 → 229) | |
| this slice's and SF's own rows | `hammerStrikeEtaFloor`'s "ships OFF" (skipped when the env sets it); the rest say OFF / ON explicitly | |
| not moved | ENEMY census, maze, guard, AREA, levels, generated set, `r8-battery`, `r8-tail`, `r9-l3`; the 83 other `plan-seedling-*` producers (SF's reach census: they never call `deriveStrike`, and the cap changes nothing about who calls it); the game witness `hammer-sf-l40-strikefloor` (byte-identical under the cap) | |

**The delta against SF's table:**

| | SF (shape a) | SF2 (the cap) |
|---|---|---|
| carved pairs c4 ON | `1efcc4b9` | **`1c5127cd`** (moves differently) |
| `hammer-b1-l18-approach40` ON | the tape drifts (ON 654 t) | **byte-identical** (362 t); only the OFF-length premise fails |
| `hammer-b2-l18-fight40` ON | the premise fails | the premise fails; the tape **byte-identical** (342 t) |
| gate rows | 23 in 12 files | **22** in 12 files: `hammerApproach`'s *"it IS the solve: on, the staging solves to the witness's keys"* no longer moves |
| staging A, sword (a workload, not an artifact) | kill t1682, REFUSED t1695 on `bob@736,752` | kill **t1740**, REFUSED **t1753** on `bobsoldier@880,832` |
| movers added | — | none |

**The six premises:** what each asserts, what ON does, and what each would need. None was re-derived.

| producer | the premise | ON at the cap | the re-derivation it needs |
|---|---|---|---|
| `plan-seedling-f1c-l18-phase` (`f1c-l18-phase42`) | *"the solve STALLED for the hammer's phase at least once"* | it never stalls (`[]`): the floor finds a strike without waiting; it solves in 569 t, 0 hits | **a new staging**: a residue where the ON solve still stalls for the phase, or the premise retired if none does |
| `plan-seedling-hammer-a-escape` (`escape15`, `escape21`) | *"with the switch (HAMMER_ESCAPE) OFF this staging REFUSES HAMMER_SAFETY"* | it SOLVES with the escape off; with it on, 6 escapes and 0 hits, 367 t; both tapes drift | **a new staging**: residues where ON-without-escape still refuses HAMMER_SAFETY |
| `plan-seedling-hammer-b1-approach` | *"with the switch (HAMMER_APPROACH) OFF this staging solves to the committed walk's length"* (r9-solve-18's 518) | OFF gives 476 t (the ON floor's own `r9-solve-18`); the ON walk is **unchanged**, byte-identical, 362 t | **a new tick only**: re-pin the OFF length to the re-recorded `r9-solve-18` (476). The witness stays |
| `plan-seedling-hammer-b2-fight` | the same OFF-length premise | the same: OFF 476 t; the fight's tape byte-identical, 342 t | **a new tick only**, as b1 |
| `plan-seedling-hammer-g1-ghostkill` (`hammer-g1-l40-ghostkill`) | *"the ghost press kills spinner@816,848"* (both bodies) | the first body dies at t1616, and the solve refuses at t1629 on `bob@736,752` before it fights `@816,848`; the tape drifts | **a new staging** (one where both bodies are fought before the chaser refuses), or **the premise retired** to one kill. SF's witness already covers the one kill |
| `plan-seedling-hammer-bw-bombstand` | *"OFF (MOVING_WAIT ON): the press kill's stand takes bombpusher@112,128#7 on t1157's ledger row"* | that stand is gone (`[]`); the ON solve stops at t1248 on `#9`'s blast on `bob@272,112` | **a new tick**: find the ledger row where the ON walk's stand takes a bomb, or a new staging if none does |

All six outputs are byte-identical to SF's ON outputs except b1's (`evidence/d3/plans.txt` against SF's
`d3-plans.txt`).

**Page legs.** The page cannot see this switch: `globalThis.process` is absent in the browser, so it reads OFF there,
and no sweep input reaches it. At the default, no page leg moves. To measure a flip, use a scratch branch with
`STRIKE_ETA_FLOOR_DEFAULT` set (the object's `enabled` initialiser set `true`) and dispatch:
- `seedling-divergence-sweep.yml` with `mode=inv`, `producer=solver`, `page=seedling_bot_ap_p4f`, `shards=10`;
- compare by key against a `main` run of the same inputs. The movers expected are the L40 legs whose solves derive
  strikes (397 and 414 with the ghost, as above).

## D4 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling hammer-phase SF2 — a cheaper STRIKE_ETA_FLOOR` (W0, the census, the cap, end to end, two lessons) |
| `seedling-bot.md` | SF's `STRIKE_ETA_FLOOR` paragraph gains *the preview budget* |
| surface | `--write`: **296** rows. The one drift is the `run:state` site count (solverBot.js 426 → 427, the new `minTicksBetween(run.state, c)` read). `--check` GREEN |
| constants | `--check` / `--write`: **5,882**, 0 new; the literal 16 is not a new counted literal, so `--profile-rows` was not needed |
| entities / profile / roster | PASS **566** · PASS **138** · **277** |
| reference | `generate-procgen-reference.mjs`, then `--check`: **ALL 7 + 5 MATCH** (the procgen README's word count moved). `generate-docs-index.mjs`: 176 docs |
| bounded vitest AFTER | the W0 set + `boxLock`, `seedlingConstantsCensus`, `procgenDocs/{generated, docLinks, docsRender}`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`, `checkProcgenHelp`: **30 files, 690 / 690** (`evidence/d4/vitest-after.txt`) |
| full-solve rows | the new rows carry 120 s timeouts; SF's witness solve row keeps its 900 s |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or force-push; nothing to `main`; no AS3, wasm, gitlink or rules edit; the default not flipped |

**CI for the planner** (dispatch returns 403 from the cloud): `JavaScript Unit Tests` at the head, read with
`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`. At OFF no divergence sweep is needed (no page leg can
move); the flip's sweep is named in D3.

## The deltas

| measure | before (base) | after (head, OFF) | ON at the cap |
|---|---|---|---|
| identity block | W0 | **= W0, every row** | 4 identity rows + killgate + 3 producers move (D3) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 712f0ead` | = | `r8-d2-chain` `f5490519`, `r8-l18` `3c81acbe`, `r9-campaign` `8475fa2a` (exit 1) |
| tapeRunner pairs | 611 `75a3c41f` | **611 `75a3c41f`** (`evidence/d4/taperunner-pairs-after.txt`) | — |
| surface / constants / entities / profile / roster | 296 / 5,882 / 566 / 138 / 277 | 296 / 5,882 / 566 / 138 / 277 | — |
| bounded vitest | 412 / 413 (21 files; the 1 red load-sensitive, 5 / 5 alone) | 690 / 690 (30 files) | 393 / 415 + 1 skipped, 22 failed (the flip table) |
| `hammerStrikeEtaFloor` rows | 13 | **16** | 15 + 1 skipped |
| L18 sweep end to end, ON ÷ OFF | 1.52× (shape a) | — | **1.44×** |

## What the brief got wrong (measured)

1. **The branch.** The harness names it `claude/seedling-hammer-sf2-3g1jfz`. It already sat at `origin/main`, so the
   brief's `checkout -B seedling-hammer-sf2` was not needed.
2. **"One of which gives ≤ 1.15× OFF on the L18 sweep's scan time, if any K does."** None does at K ≥ 1. The cheapest
   zero-loss cap is 1, at 1.21× with 9 strikes found; K = 0 is OFF.
3. **The per-derivation census cannot choose K by cost.** It follows OFF's run. End to end, caps 2–8 are slower than
   OFF on staging A and the legs, though cheaper inside every derivation.
4. **(d) as framed is not a cost lever.**
   - b at the admission is cheap (~8 s on L18), but it adds to whatever runs on the refuge ticks.
   - With shape a there, (d) costs more than a. With the floor alone there, it loses the floor's 470.
   - And end to end, the admission's bounded-pass strike is adopted by the executor only when the continuation found
     it (`execKillByPress`'s `seeded.fromContinuation`), so b's extra finds at the admission are mostly not acted on.
5. **The (c) fallbacks the brief named both lose strikes** at the caps that would be cheap: the admissible floor
   loses 101 at 4, and stopping loses 1,801 at 4. The fallback that works (OFF's question) was not among them.
6. **"Re-derive the witness if it moves."** It does not move: `hammer-sf-l40-strikefloor` is byte-identical under the
   cap.
7. **"Re-run SF's census rows … the defaults may have moved them."** They did not. Every row equals SF's, OFF and ON.
8. **The bootstrap left six submodules uninitialised** after `READY` (as SF found).

## Residue

1. **For the user: the flip, at the cap.**
   - It is SF's table minus the b1 witness's tape and one gate row, plus a different carved-pairs c4 digest.
   - The L18 sweep's cost ON is 1.44× OFF, not 1.53×.
   - Six witness premises still need re-deriving (four new stagings or retirements, two re-pinned ticks).
2. **A truly cheaper ON is a different lever.** The cost is previews ∝ samples (~18 µs a sample on L18). Most of it goes on
   the executor re-deriving every refuge tick from scratch, while the walks of consecutive ticks barely change.
   Carrying the walk cache across a derivation's successors would be that lever. It needs a validity rule (the run
   state moved one tick), and it is outside this slice's region. Not attempted.
3. **The staging-A sword answer at the cap** (kill t1740, refused on `bobsoldier@880,832` at t1753) is not shape a's.
   It is a workload, not a committed artifact, and the game was not asked about it. SF's t658 chaser-contact residue
   on this staging is fidelity's.
4. **`jsRuntimeSolveProgress`'s one-post-a-second row is load-sensitive** (failed once in BEFORE at load ~4, 5 / 5
   alone).
5. **Tree hygiene.**
   - The scratch worktrees (`base`, `lab`, `lab2`) were removed by name.
   - The server (PID 906) was killed by PID.
   - Every mutant restored `solverBot.js` by md5 (`1a356a85`).
   - The timing rounds ran with no tree edits.

## Evidence (`seedling-hammer-sf2-evidence/`)

- **tools/**: `make-lab2.py` (the census lab), `make-lab3.py` (shape e), `sf2-run.sh`, `queue.sh`,
  `sf2-census.py`, `sf2-table.py`, `show.py`, `w0-censuses.sh`, `probe-cap.mjs`, `mt2.py` (the D2 mutants),
  `d3-table.py`, `norm.py`. RE's `g1-solve.mjs`, `d1-leg.mjs` and `ghost-sweep.mjs`, and SF's `sink.mjs`, were used
  unchanged. Leg inputs: `seedling-divergence-legs.mjs --out=legs.jsonl` and
  `probe-seedling-divergence-sweep.mjs --host=http://localhost:9587 --mode=inv --ids=400 --dump=dump.json`.
- **w0/**: `identity-w0.txt`, `censuses-w0.txt`, `vitest-files.txt`, `vitest-before.txt`, `vitest-before-rerun.txt`,
  `taperunner-pairs.txt`, `census-rows-w0.txt`, `sha.txt`.
- **d1/**: `d1-census-table.md`, `d1-census-long.md`, `census-summary.jsonl`, `d1-census-records.tar.gz`,
  `d1-l18-extra-caps.txt`, `d1-shape-e-bounded-previews.txt`, `d1-e2e-caps.txt`.
- **d2/**: `d2-probe-cap-g1.jsonl`, `M1`, `M5`–`M8` mutant runs, `d2-gate-off.txt`, `d2-gate-on.txt`,
  `d2-witness-check.txt`.
- **d3/**: `d3-timings.md`, `outs/` (round 1 of each mode), `identity-off.txt`, `identity-on.txt`, `plans.txt`,
  `plans/` (the six producers ON), `vitest-on.txt`, `on-fails.txt`.
- **d4/**: `censuses-after.txt`, `vitest-after.txt`, `vitest-after-files.txt`, `taperunner-pairs-after.txt`.
