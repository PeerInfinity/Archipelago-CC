# Seedling HAMMER-PHASE — slice WC: carry the strike's walk previews across refuge ticks

Slice `seedling-hammer-wc` (Opus, cloud), planner `seedling-hammer-phase-planning`. ⚖ The user (2026-10-15): *"Walk-cache
lever first"*. **Verdict: STOP at D1.** No walk cache, exact or approximate, can bring the L18 sweep ON under 1.15× OFF,
because at this base the walk previews are not where floor ON's L18 cost is. No switch was added, no code changed, and
nothing was re-recorded.

| | |
|---|---|
| Start SHA | **`11e8b7473f`** (= `origin/main` at the fetch; ≥ the brief's floor) |
| Head | the commit carrying this report. Before it: W0 + D1 evidence `e83169a`, flip table + D4 `99fc0f8bc5` |
| Branch | `claude/seedling-strike-walk-cache-5wg5li` (the harness names it; the brief's `seedling-hammer-wc`). Nothing went to `main` |
| Defaults at the base | `REFUGE_ETA_CUT` **ON**, `PRESS_KILL_DONE_ON_WALK` **ON**, `CONTACT_FIDELITY.strikeIframeLapse` **ON** (`7a20beb2fd` is in), `STRIKE_ETA_FLOOR` **OFF**, `STRIKE_PREVIEW_CAP` 16, `HAMMER_ESCAPE` ON, `HAMMER_ESCAPE_FALLBACK` ON, `HAMMER_APPROACH` / `HAMMER_FIGHT` OFF, `PRESS_KILL_COST` / `STRIKE_SCAN_COST` ON, `PRESS_KILL_BOMBS` OFF, `GHOST_SPINNER_PRESS` / `GHOST_KILL_RUNG` ON. Fidelity's wave 17 has **not** landed (no `beamTowerDrift` / `spinningAxePlayerHit` / `chaserSpinnerWalls` / `corridorBodyPricing` in `contactFidelity.js`). Full list: `evidence/w0/defaults.txt` |
| Verdict | **W0 PASS · D1 STOP (measured; the reason below) · D2 / D3 not built · the floor's flip table re-stated at this base (measure-only) · D4 PASS (records only)** |

## The one thing to know first

**On L18, floor ON's whole extra cost is the escape admission inside `deriveStrike`, not the walk previews.** Profiled
over the full 45-residue sweep at the base (`node --cpu-prof`, `evidence/d1/d1-profiles.txt`):

| L18 sweep, base | OFF | ON | ON − OFF |
|---|---|---|---|
| whole process (profile s) | 158.8 | 206.5 | **+47.7** |
| `strikeEscape` (inside `deriveStrike`) | 56.5 | 106.8 | **+50.3** |
| `walkTo` (`deriveStrike`'s walk previews: `previewWalk` + the transit danger loop) | 16.7 | 19.9 | +3.2 |
| … of which `previewWalk` / `dangerDuringTransit` | 11.2 / 5.6 | 12.5 / 7.7 | |
| `aimAdmitted` (the escape at the aim) | 24.2 | 10.8 | −13.4 |

- `walkTo` is **9.6 %** of the ON process. Removing it *entirely* would leave the sweep at ~1.28× OFF.
- The exact reuse rules cover **45 %** of ON's previewed samples. A hit still has to ask the danger map at its new
  ticks: the verdict differs in 67 % of repeated walks. So a hit saves only `previewWalk`'s 5.0 µs a sample. The
  estimate is **1.38×** OFF (base walls 151.9 s ON, 107.1 s OFF, 1.42×).
- ON makes **15.1** escape calls a derivation where OFF makes **5.5** (80,595 over 5,322 derivations, against 55,791
  over 10,086). The measured ETA lets more reachable candidates through to the escape test.
- **The lever that could reach the target is the escape, not the walk.** On L18 ON, 56 % of `strikeEscape` calls repeat
  a (body, cell, absolute press tick) the same kill already asked, and 99.7 % of those get the same answer. 38 % also
  repeat the player state, and 100 % of those get the same answer. Reusing them would save an estimated 15–23 % of the
  ON sweep (1.09–1.21× OFF). The key is not proven exact (it reads the spinners and the hammer's phase). It belongs to
  `pressEscape`, so it is a separate decision for the user (residue 1).

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B <branch> origin/main` → `11e8b7473f` (`evidence/w0/sha.txt`) |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`, node v22.22.0. **Six** submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); `git submodule update --init` each. Server `serve-nocache.py 9588` (PID 944) |
| identity block | `SEEDLING_PORT=9588 identity-block.sh .` at the pristine base (`evidence/w0/identity-w0.txt`). Maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK, reference **ALL 7 + 5 MATCH**: equal to SF2's W0. **Two rows moved since SF2**, both through the lapse flip: ENEMY census `afdc6d1a` → **`36b59445`**, and `r9-campaign --check` `712f0ead` → **`6b1bf15c`** |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c`, all exit 0 (the last moved, above) |
| tapeRunner pairs | **611 `a970aa03`**, 0 non-pass (SF2: 611 `75a3c41f`; the lapse flip `19aaa5c` edited `tapeRunner.test.js` and its fixtures) |
| surface / constants / entities / profile / roster | GREEN **296** · **5,882** · **566** · **138** · **277** (`evidence/w0/censuses-w0.txt`) |
| bounded vitest BEFORE | 25 files: every non-slow test naming `deriveStrike` / `previewWalk` / `minTicksBetween` / `STRIKE_ETA_FLOOR` / `STRIKE_PREVIEW_CAP` / `strikeScanBox`, plus `solverBot*`, `hammer*`, `solverSpinnerKill*`, `pressKillCost`, `solveProgress*`, `jsRuntimeSolveProgress` (`evidence/w0/vitest-files.txt`), at the pristine base: **527 / 527** in 341 s |

**SF2's census rows and end-to-end answers at this base** (norm-md5, `evidence/w0/outs/`; one run each, PAR 3,
loads 2.5–5.2, so the walls are exploratory):

| workload | OFF now (SF2) | ON now (SF2's ON at the cap) | wall OFF / ON s |
|---|---|---|---|
| staging A, sword | `82834f24` (`7c279226`): REFUSED t3113 on `bob@736,752`; only the refusal's danger point moved (743.6,818.8) → (743.6,805.6) | `7d8e280e` (`1bcc53a2`): REFUSED **t1753** on **`bob@736,752`** (SF2: `bobsoldier@880,832`) | 147.7 / 75.2 |
| staging A, ghost | `fcac3f47` (`b3b38f55`): REFUSED t2195, its danger point moved | `57c7a4e7` (`3549733c`): REFUSED t1629, its danger point moved | 111.7 / 61.0 |
| leg 397, ghost | `b90f7720` (`4720caab`): refuses on **`bobsoldier@880,832`** (SF2: `bob@736,752`) | `c39a0c86` (`1e7c2fee`): refuses on `bob@736,752`, text moved | 148.6 / 125.3 |
| leg 414, ghost | `314c6324` (`489a9482`): refuses on `bob@736,800` | `e3616f52` (`cc715263`): refuses on `bob@736,752`, its danger point moved | 154.7 / 123.9 |
| L18 sweep (45) | `de6f6e4e` (`864ab175`): **45 SOLVE, Σ 19,545, every length = SF2's**; only the header's committed `seam.time` moved (9940 → 9912, `r9-solve-18` re-recorded by the flip) | `bae5c6de` (`7efe7059`): **45 SOLVE, Σ 19,558, every length = SF2's**; the same header | **107.1 / 151.9 (1.42×)** |
| C2's ghost staging (45) | `1ca7eed5` (= SF2) | `0a9504dc` (= SF2) | 82.4 / 88.2 |
| `r9-campaign --check` | `3d1b1014` (`4199d181`): exit 0, the chain **10,825 t** (SF2 10,931; the flip's re-record), `r9-solve-18` **440 t** | `bb4e07dc` (`1e390e5a`): exit 1, `r9-solve-18` **440 → 390 t**, Σ **10,775** | 46.9 / 55.5 |
| `r8-l18 --check` | `dfda7600` (= SF2), exit 0 | `cc1f3610` (= SF2), exit 1 | 2.4 / 3.9 |
| `r8-d2-chain --check` | `8afbe7e2` (= SF2), exit 0 | `25720cae` (= SF2), exit 1 | 3.8 / 5.8 |
| killgate s2 / s5 / s9 `md5(rows)` | `660869bc / 504396f1 / a63cbb18` (= SF2) | `4926635b / 69f421d4 / 02445c34` (= SF2) | 3.6 / 7.7 · 6.9 / 3.9 · 8.0 / 4.2 |

## D1 — where the cost is, and what is reusable (STOP)

**The lab** (`evidence/tools/make-lab-wc.py`, then `lab2.diff` / `lab3.diff`). It was applied to scratch worktrees at
the base, never to the tracked tree. It records, per `deriveStrike` call:
- the walk previews by source: the bounded pass (`strike:pass`), the walk loop (`strike:walk`) and the continuation
  (`strike:cont`);
- their samples and wall time, `strikeEscape`'s time, and the refuge's and every other caller's previews;
- for every strike-sourced preview, **the reuse bound**: whether an earlier preview **in the same kill**, to the same
  cell and under the same stepper inputs, already walked the new start state. The start state is hashed whole, with
  its symbol keys (the preview's damage). The stepper inputs are the step options minus the world, the world by
  identity, the i-frame and damage at the start, the level's pulls and the whole `CONTACT_FIDELITY` object.
- A match at step 0 is a **repeat**, one at step k > 0 a **suffix**, and the new walk entering an earlier walk's state
  part-way is a **join** (lab 2). Each match is **validated** against the new walk's own samples (x, y, held, waypoint,
  truncation).

**Proof the lab is inert:** all 24 workload × mode answers equal the pristine base's, byte for byte after the
wall-clock fields are stripped. The lab's wall clock carries its hashing, so its seconds are shares, not timings; the
profiles above are the timings.

**Per workload** (lab 1, `evidence/d1/d1-table.md`; every record in `d1-lab-records.tar.gz`):

| workload | floor | derivations / kills | same player state, consecutive | previews · samples a derivation | executor · `deriveStrike` · `walkTo` · `strikeEscape` (lab s) | exact-reusable | trajectory matched | entities equal too |
|---|---|---|---|---|---|---|---|---|
| staging A, sword | OFF | 1,329 / 2 | 91 % | 4.1 · 1,176 | 238.6 · 220.6 · 97.1 · 0.1 | 0 % | 92.1 % | 73.7 % |
| | ON | 99 / 2 | 89 % | 17.4 · 3,074 | 43.4 · 40.8 · 19.0 · 0.0 | 0 % | 92.0 % | 92.0 % |
| staging A, ghost | OFF | 1,085 / 3 | 93 % | 3.9 · 1,197 | 189.1 · 176.1 · 82.6 · 0.0 | 0 % | 93.9 % | 78.9 % |
| | ON | 112 / 2 | 92 % | 16.2 · 2,877 | 43.5 · 40.3 · 18.2 · 0.0 | 0 % | 92.4 % | 92.4 % |
| leg 397, ghost | OFF | 1,154 / 3 | 75 % | 3.8 · 948 | 163.0 · 146.8 · 65.5 · 0.0 | 0 % | 75.7 % | 75.7 % |
| | ON | 276 / 3 | 95 % | 17.2 · 3,340 | 126.6 · 121.0 · 54.4 · 0.0 | 0 % | 94.6 % | 94.6 % |
| leg 414, ghost | OFF | 1,256 / 3 | 69 % | 3.7 · 937 | 181.6 · 162.6 · 72.6 · 0.0 | 0 % | 71.2 % | 71.2 % |
| | ON | 266 / 3 | 92 % | 17.1 · 3,327 | 126.1 · 120.9 · 55.8 · 0.0 | 0 % | 94.6 % | 94.6 % |
| **L18 sweep (45)** | OFF | 10,086 / 136 | 66 % | 4.0 · 206 | 131.2 · 96.2 · 34.9 · 48.9 | 70.3 % | 70.3 % | 70.3 % |
| | **ON** | 5,322 / 136 | 46 % | 7.7 · 467 | 185.2 · 158.3 · **44.2** · **100.0** | **39.8 %** (+5.4 % join) | 39.8 % | 39.8 % |
| C2's ghost staging (45) | OFF | 4,596 / 136 | 60 % | 3.2 · 67 | 82.8 · 69.2 · 7.3 · 57.2 | 51.1 % | 51.1 % | 51.1 % |
| | ON | 4,860 / 136 | 54 % | 7.2 · 398 | 114.2 · 103.9 · 36.7 · 58.8 | 48.0 % (+5.7 % join) | 48.0 % | 48.0 % |
| `r9-campaign --check` | OFF / ON | 318 / 4 · 129 / 4 | 58 / 47 % | 4.7 · 293 / 7.6 · 485 | 4.5 · 4.0 · 1.9 · 1.5 / 11.0 · 8.2 · 1.3 · 6.4 | 58.6 / 29.4 % | = | = |
| `r8-l18` / `r8-d2-chain --check` | OFF / ON | 135 / 4 · 120 / 4 (each) | 54 / 41 % | 3.5 · 130 / 6.5 · 398 | ~2.1 · 1.6 · 0.5 · 0.9 / ~4.4 · 3.7 · 1.2 · 2.1 | 50.6 / 31.1 % | = | = |
| killgate s2 / s5 / s9 | OFF / ON | ~180 / 10 each | 50–55 % | ≤ 3.5 · ≤ 151 | ≤ 6.5 s each; `walkTo` ≤ 0.5 s | 0–2.9 % | = | = |

**The bounded pass's previews are the ON workload's walk previews.** ON, 85–95 % of a derivation's previews come
from the pass (`strike:pass`), against the walk loop OFF. The continuation previews almost nothing (≤ 18 previews a
workload), and the refuge previews are cheap: 13–16 k previews of 1–5 samples each on the L40 stagings, 1–3 lab s,
and **none** on L18. The refuge is not the cost, so nothing would pass through `deriveRefuge` / `refugeNow`.

**What changes between consecutive derivations** (the same kill, Δt 1 in 80–99 % of pairs):
- **The player state**: identical in 46–95 % of consecutive pairs (above). The player stands in a refuge or at the
  stance.
- **The stepper's inputs**: identical in every consecutive pair but one kind on L18, C2's staging and the campaign
  (lab 2, by component). The world is re-wrapped once per residue (134 of 3,566 pairs on L18 ON). On staging A OFF,
  the i-frame / damage changes in 25 of 1,319 pairs (4 with `steerBlocked`).
- **The tick**: always +1 or more. Every sample's tick moves with it.
- **The bodies**: the spinners move every tick; a press hit lands between 0.3–4.5 % of pairs on the L40 stagings and
  45–54 % on L18 / C2's staging. The chasers (`bob`, `bobsoldier`) on the L40 stagings move too: their forecast rects
  differ between matched walks in 0–26 % of the matched samples (the last two columns).
- **The danger map** is asked at absolute ticks (the hammer's phase is `gameTimeAt`), so it changes by construction.

**The exact rules** (each validated against the new walk; `INVALID` 0 over every workload once the suffix rule
carries its condition):

| rule | what it reuses | its exact condition | L18 ON samples saved | where it applies |
|---|---|---|---|---|
| **R1 repeat** | a walk's trajectory (x, y, held, waypoint, truncation), its ticks shifted | the same cell and tolerance, the same player state (every field and symbol key), the same stepper inputs, **and no entity forecast in the room** (arrow, chaser, spit and grenade forecasts all `null`: the samples then carry nothing that depends on anything else) | 987,693 (39.7 %) | entity-free rooms: L18, C2's staging, the campaign, the r8 producers. **0 % on staging A and the L40 legs**, whose chaser forecast is live |
| **R2 suffix** | the earlier walk's samples from step k | the new start equals the earlier walk's pre-step state k, as R1, **and the earlier walk was not truncated `stalled`** | 3,018 | measured: the 18 invalid matches (staging A sword OFF) are every one a suffix of a walk cut at the 400-tick `DEFAULT_MAX_TICKS_PER_TARGET`. The new walk has its whole budget again, so it walks k ticks further (`evidence/d1/d1-invalid-suffix.txt`). With the condition: 0 invalid |
| **R3 join** | the samples after the new walk enters an earlier walk's state | as R2, from the joining step on (the steps before it are walked) | 134,037 (5.4 %) | lab 2; 0 invalid |
| **S stepper memo** | `stepV2`'s transitions only (`previewWalk` still computes every forecast and sample, so entity rooms qualify) | a full-state + held + stepper-inputs key on the first step, then chained on the step's own result object | ≤ the stepper's share of R1–R3 | it would wrap `run.previewStepper()` through a run proxy, with `previewWalk`'s body untouched. Measured shares inside `previewWalk`: L18 ~85 % stepper; **staging A only 21 % OFF / 16 % ON** (the chaser forecast `chaserForecastNow().step` is 29.2 of 45.0 s OFF, 8.4 of 11.4 s ON) |

None of them can keep a hit's **danger verdict**. `dangerDuringTransit` is asked at each sample's absolute tick. Lab 3
compared the verdict of every repeated walk with the earlier one: they differ in **8,850 of 13,215** repeats on L18
ON, 1,465 of 1,570 on staging A ON, 3,842 of 4,270 on leg 414 ON, and 1,930 of 4,856 on staging A OFF. So under every
exact rule a hit re-asks the danger map over the reused samples and saves `previewWalk`'s share alone.

**The STOP estimate** (the brief's test: L18 ON + the cache ÷ OFF ≤ ~1.15× end to end):

| assumption | saved (s, ON profile) | L18 ON + cache ÷ OFF |
|---|---|---|
| R1 + R2 + R3 (1,124,748 samples, 45.2 %) at the **measured** 5.0 µs a sample (`previewWalk` 12.48 s / 2,487,105 samples) | 5.6 | **1.38×** |
| the same samples at the brief's 18 µs a sample | 20.2 | 1.28× |
| `walkTo` removed **entirely** (no exact rule does this) | 19.9 | 1.28× |
| the approximate rule below | 8.9 | 1.36× |

The ratios apply the profile's shares to the base walls (151.9 s ON, 107.1 s OFF, 1.42×). Every row is over 1.15×:
**STOP.** The measured per-sample cost at this base is 5.0 µs (`previewWalk`) and 8.0 µs (`walkTo` with the danger
loop), not SF2's ~18 µs.

**The best exact rule** is R1 + R2 (with its `stalled` condition) + R3 in entity-free rooms, scoped to one kill. It
saves ~2.7 % of the L18 sweep ON.

**The approximate rule, not built.** Cache the whole `walkTo` answer (`{walk, eta, unsafe}`) on the cell, the player
state and the stepper inputs, ignoring the tick and the entities.
- **It would save** the matched share of `walkTo`: ~8.9 s of L18 ON's 206.5 (4.3 %, 1.36×). On staging A ON it would
  save up to 92 % of `walkTo` (~11 of 54 s).
- **It would change answers.** The danger verdict it carries over is wrong in 67 % of L18 repeats and 93 % of staging A
  repeats (above). The chaser rects differ in up to 26 % of matched samples OFF. A wrong verdict admits or drops a
  strike, so trajectories, refusals and tapes would move.

**Work units.** A walk preview charges `progressPreview` (`previews` +1, `previewStates` + the samples, and the tile
reach at each sample's tick). It calls no `shouldStop`. A hit would have to replay `progressPreview` with the rebuilt
samples, which is cheap and exact. The escape search charges `shouldStop` (`deadlineReached('hammer-escape')`) and its
`onNode` states, so any escape cache would have to replay both, and a deadline trip mid-search is an answer.

**Scope, had it been built.** One kill (`execKillByPressOnce`), dropped with the kill: every bound above is measured
in that scope (matches across kills were not measured). A fork, rewind or `replayOntoFork` builds a new run, and its
`execKillByPressOnce` opens a new scope.

## D2 / D3 — not built (STOP)

`STRIKE_WALK_CACHE` was not added. No gate rows, mutants or timing rounds were run for a cache that does not exist.

### The floor's flip table at this base, with the lapse ON (measure-only; nothing re-recorded)

A flip of `STRIKE_ETA_FLOOR_DEFAULT` to `true` (with `STRIKE_PREVIEW_CAP` = 16) would re-record or re-pin all of this
at `11e8b7473f`. Measured at the pristine base with `SEEDLING_STRIKE_ETA_FLOOR=1` (`evidence/flip/`). **Nothing was
touched.**

| kind | what | ON at this base | against SF2 (lapse OFF) |
|---|---|---|---|
| committed tapes + traces (producers) | `r8-solve-18` (`solve-seedling-r8-l18`) | 363 → 467 t (`3c81acbe`, exit 1) | = |
| | `r8-d2` (`solve-seedling-r8-d2-chain`) | 1,669 → 1,773 t (`f5490519`, exit 1) | = |
| | `r9-solve-18` (`solve-seedling-r9-campaign`), and `r9-solve-19`'s declared seam.time | **440 → 390 t**; the chain Σ 10,825 → **10,775** (`a38549e5`, exit 1) | SF2: 518 → 476, Σ 10,931 → 10,889 (`8475fa2a`). The lapse flip re-recorded the campaign, so the numbers moved and the mover did not |
| witness producers whose `--check` fails ON on a premise | `f1c-l18-phase`, `hammer-a-escape` (×2), `hammer-b1-approach`, `hammer-b2-fight`, `hammer-g1-ghostkill` | outputs `934d9871`, `65742bdc`, `866666cd`, `2cd6b74f`, `5acf8d97` | **byte-identical to SF2's ON outputs**: the same premises fail the same way (SF2's premise table stands: f1c never stalls; a-escape solves with the escape off; b1 / b2's OFF-length premise reads 476; g1 refuses before the second body) |
| | `hammer-bw-bombstand` | ON `d7d6b54c`, 3 checks fail (its ON run: "1663 executed; no refusal") | ⚠ **its `--check` already fails at the base with the floor OFF** (`6f844bd4`, the same 3 checks: the t1157 stand premise, its ON run stopping at t1339 on #11's Explosion, DRIFT). With `SEEDLING_STRIKE_IFRAME_LAPSE=0` it passes (`50f2d601`, = SF's OFF). **The lapse flip broke this producer and did not re-pin it** (residue 3). The floor's own effect on it cannot be read until it is re-pinned |
| witness TAPES that drift ON | `f1c-l18-phase42`, `hammer-a-l18-escape15`, `-escape21`, `hammer-g1-l40-ghostkill` | drift | = |
| identity rows | acceptance batch; empty pairs c3, c6; carved pairs c4; killgate s2, s5, s9 | `9fbd9304`; `c4a58671`, `5d06a8b0`; `1c5127cd`; `7c15ed57 / 47116405 / 4d3bbf17` | **= SF2's ON** |
| gate rows (the 25-file set ON: **22 failed in 12 files**, `evidence/flip/vitest-on.txt`) | `hammerApproach` (1), `hammerEscape` (2), `hammerFight` (1), `hammerFightFallback` (2), `hammerGhostKillRung` (1), `hammerGhostSpinner` (2), `hammerPressBombs` (1), `pressKillCost` (1), `procgenScratchPersistence` (3), `solveProgress` (3), `solverBot` (1), `solverSpinnerKill` (4) | 504 passed, 1 skipped ("ships OFF") | **the same 22 rows, by name** (`evidence/flip/on-fails.txt`) |
| not moved | ENEMY census (`36b59445`), maze, guard, AREA, levels, generated set (OK, ON in the primary tree), `r8-battery`, `r8-tail`, `r9-l3`; the game witness `hammer-sf-l40-strikefloor` (its `--check` byte-identical ON; only its "ships OFF" row reads the env) | | = |

**The workloads ON** are in W0's table. Staging A sword now refuses at t1753 on **`bob@736,752`**, where SF2's cap
refused on `bobsoldier@880,832` (one of SF2's residues closes). L18 keeps its 45 SOLVEs, Σ 19,545 → 19,558.

**The delta against SF2's table:** `r9-solve-18`'s numbers (440 → 390, Σ −50, where SF2 had 518 → 476, Σ −42), and
the bw producer, red at the base for a reason that is not the floor. Every other row, output and gate row is SF2's.

**The six premises:** unchanged from SF2's table (`seedling-hammer-sf2.md`, D3). The bw row now needs a lapse-ON re-pin
before its floor-ON premise can be read. **Page legs:** as SF2. The page cannot see the switch, so a flip needs a scratch
branch with `STRIKE_ETA_FLOOR_DEFAULT` true, `seedling-divergence-sweep.yml` (`mode=inv`, `producer=solver`,
`page=seedling_bot_ap_p4f`, `shards=10`), compared by key against a `main` run of the same inputs.

## D4 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling hammer-phase WC — the strike's walk cache` (W0, D1's measurement, the STOP, two lessons) |
| `seedling-bot.md` | SF's `STRIKE_ETA_FLOOR` paragraph gains *Where ON's cost is* after SF2's budget |
| surface / constants | no code moved: `--check` only, GREEN **296** · **5,882**, 0 new (`evidence/d4/censuses-after.txt`); no `--write` or `--profile-rows` needed |
| entities / profile / roster | PASS **566** · PASS **138** · **277** |
| reference | `generate-procgen-reference.mjs` (the procgen README's word count moved), then `--check`: **ALL 7 + 5 MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`: 176 docs, unchanged |
| bounded vitest AFTER | the W0 set + `boxLock`, `seedlingConstantsCensus`, `procgenDocs/{generated, docLinks, docsRender}`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`, `checkProcgenHelp`: **34 files, 801 / 801** (`evidence/d4/vitest-after.txt`) |
| not run | `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). No `git stash`, rebase or force-push; nothing to `main`; no AS3, wasm, gitlink or rules edit; no default flipped; no code edited (`previewWalk`, `deriveRefuge` / `refugeNow`, the chaser-arm seam, the climb ladder, `chooseBodyToRemove` and fidelity's files untouched) |

**CI for the planner** (dispatch returns 403 from the cloud). `JavaScript Unit Tests` at the head, read with
`node scripts/procgen/ci-vitest-summary.mjs <head> --wait`. No code moved, so no divergence sweep is needed.

## The deltas

| measure | SF2 (lapse OFF) | this base (lapse ON) | head |
|---|---|---|---|
| identity block | SF2's W0 | ENEMY `36b59445`, `r9-campaign --check` `6b1bf15c`; every other row = | = base (docs only) |
| tapeRunner pairs | 611 `75a3c41f` | 611 `a970aa03` | = base |
| surface / constants / entities / profile / roster | 296 / 5,882 / 566 / 138 / 277 | = | = |
| L18 sweep ON ÷ OFF | 1.44× (SF2's D3 medians) | 1.42× (one run each, W0) | no cache: — |
| L18 lengths OFF / ON | Σ 19,545 / 19,558 | = (every residue) | = |
| `r9-solve-18` OFF → ON | 518 → 476 t | **440 → 390 t** | — |

## What the brief got wrong (measured)

1. **The branch.** The harness names it `claude/seedling-strike-walk-cache-5wg5li`.
2. **"The cost ON is previews ∝ samples, ~18 µs a sample on L18. Most of it is the executor re-deriving on every refuge
   tick."**
   - On L18 at this base the extra cost of ON is the escape admission: `strikeEscape` +50.3 s of a +47.7 s
     process delta. The walk previews add +3.2 s.
   - `previewWalk` costs 5.0 µs a sample, and `walkTo` with its danger loop 8.0 µs.
   - SF2's 1.15× target was on the scan inside derivations. End to end, the escape dominates.
3. **"The walks of consecutive ticks barely change."** True of their trajectories: 40–95 % of the samples repeat a
   walk the same kill already took. Not true of their answers: the danger verdict differs in 67 % of L18 repeats. A
   walk the cache could reuse exactly saves only its stepping.
4. **"`deriveRefuge` / `refugeNow` … re-derive on every refuge tick."**
   - The executor does re-derive every tick (Δt 1 in 80–99 % of consecutive derivations).
   - But the refuge's own previews are cheap: none on L18, and 1–5 samples each on the L40 stagings.
   - The cost of the re-derivations on L18 is their escape admissions.
5. **"Re-bank SF and SF2's census rows; the lapse moved them."** Partly. L18's 45 lengths, C2's staging, killgate and
   the r8 producers are unchanged in both modes. Staging A, the L40 legs and the campaign moved, both modes (W0).
6. **The bootstrap left six submodules uninitialised** after `READY` (as SF and SF2 found).
7. **"Re-state the flip table with the lapse ON" assumed a green base.** One of the six producers
   (`hammer-bw-bombstand`) is red at the base before the floor is touched (residue 3).

## Residue

1. **For the user: the escape admission is the lever, as a separate decision.**
   - On L18 ON, 56 % of `strikeEscape` calls (45 % of its time) repeat a (body, cell, absolute press tick) the kill
     already asked, and 99.7 % of them get the same answer.
   - 38 % (29 % of its time) also repeat the player state, and 100 % of those get the same answer.
   - On C2's ghost staging ON: 62 % repeat (100 % the same answer); 46 % with the same state (100 %).
   - At `strikeEscape`'s 51.7 % share of the L18 ON profile, reusing the same-state repeats would save ~15 % (≈ 1.21×
     OFF), and every key repeat ~23 % (≈ 1.09×).
   - **Not proven exact.** `pressEscapeOnce` previews the approach from the run's state at the new tick, so the
     approach positions at absolute ticks shift when the walk has length. It reads the hit-aware spinner forecast and
     the hammer's phase at absolute ticks. Its search charges `shouldStop` and progress nodes.
   - An exact form would key the search (its landing state, absolute landing tick and horizon) and validate the
     forecast rows it reads by value. It would also have to replay the work units: every `shouldStop` ask and every
     `onNode`. That is `pressEscape`'s region (hammer-phase A), not this slice's.
2. **Where the walk previews do dominate, they are not exactly keyable.**
   - On staging A, `walkTo` is 43 % of the process OFF and 23 % ON (profile). On the L40 legs it is ~40 % of the kill
     OFF and ~44 % ON (lab shares).
   - Its biggest part is the chaser forecast (`chaserForecastNow().step`). Its inputs live in `levelRun`'s closure:
     the chasers, the camera, the shake, the boss target and the inventory.
   - An exact walk cache there would need `levelRun` to expose a digest of what its forecasts read. That is
     fidelity's file, and wave 17 is changing these forecasts.
   - The stepper memo (S) would save ≤ 8 % OFF / ≤ 3 % ON on staging A.
3. **A hand-over: `plan-seedling-hammer-bw-bombstand --check` is red on `main` at its defaults** (the floor OFF).
   - 3 checks fail: *"OFF (MOVING_WAIT ON): the press kill's stand takes bombpusher@112,128#7 on t1157's ledger row
     — []"*, the ON run (*"1339 executed"*, the run stopped on #11's Explosion reaching `spinner@192,160`), and DRIFT
     of `hammer-bw-l42-381-bombstand`.
   - With `SEEDLING_STRIKE_IFRAME_LAPSE=0` the same command passes, byte-equal to SF's OFF output (`50f2d601`). So the
     lapse flip moved it, and its re-pin list (the DD witness only) missed it.
   - `hammerPressBombs.test.js` stays green at the base. The producer is not in CI, which is why nothing caught it.
   - Not touched here: it is the BW witness's, the lapse flip's to re-pin.
4. **`aimAdmitted` is cheaper ON (10.8 s vs 24.2 s on L18).** That is not a lever, only the reason why ON's escape
   delta is bigger than its process delta.
5. **Tree hygiene.**
   - The scratch worktrees (`base`, `lab`, `lab2`, `lab3`) are removed by name.
   - The server (PID 944) is killed by PID.
   - The tracked tree carries only this report, its evidence and the D4 records.
