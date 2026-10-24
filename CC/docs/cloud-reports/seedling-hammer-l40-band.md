# Seedling HAMMER-PHASE LB — the L40 chest band + HX

Slice `seedling-hammer-l40-band` (Opus, cloud), planner `seedling-hammer-phase-planning-2`. ⚖ The user (2026-10-18)
picked the L40 timeout band and HX in the replan, and asked: *"If there are solves that are blocked by timeouts, could
we simply increase the timeout? Also, we were working on tools for profiling where the time is spent."*

| | |
|---|---|
| Start SHA | **`008215fa`** (= `origin/main` at the fetch: fidelity wave 19's harvest; `bombBlastBody` present) |
| Head | the commit carrying this report. Before it: W0 `f9536fa4`, D1 `f5ff82c9`, D2 `470b797b`, the censuses `ad69d9b6`, D4 `9ccae0fa` |
| Branch | `claude/seedling-hammer-l40-band-svzuw1` (the harness's; the brief's `seedling-hammer-l40-band`). Nothing went to `main` |
| Dev server | `serve-nocache.py 9602` (`SEEDLING_PORT=9602`), PID 995, killed by PID at the end |
| Verdicts | **W0 PASS · D1 PASS** (measured; no lever in the hammer region turns either leg into a solve) **· D2 PASS** (two switches, OFF, with a mover the brief did not expect: see D2) **· D3 PASS as the hand-over table** (nothing built) **· D4 PASS** |

## The one thing to know first

**No timeout and no budget solves these two legs. The chest is behind CW's guard.** With the work budget removed,
414 ends at 11,908 units on a named EXHAUSTED refusal (avoid: *"A\* goal tile (55,51) … is not walkable:
danger:bobsoldier@880,832"*). 397 ends at **156 units with or without a budget**, on the press kill's own
HAMMER_SAFETY corner. Across 21 seam times in each arm, no seam solves. The band's `timeout` ↔ `failed` swap is two
clocks measuring different parts of one solve:
- the **wall** is ~70 % the press kill's per-tick strike derivation, which asks almost no work units;
- the **work budget** (640) is spent afterwards by DETOUR's via set.

A leg whose press kill runs for about 90 s lands on either side of the harness's leg budget from run to run.

## W0 — the base (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B … origin/main` | `008215fa`; `bombBlastBody` at `contactFidelity.js:703` (OFF), `chaserSpinnerWalls` `:535` (OFF) |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY`, node v22.22.0. Six submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine): `git submodule update --init` each |
| inputs | `git show origin/hammer-lb-input:…` (`a98c8b652a`) | `input/requests-414.jsonl` (414's two requests: 640 and 2560 units), `input/rows-397-414-400s.jsonl` |
| defaults | `w0/defaults.txt` | the shipped switches and `CONTACT_FIDELITY`; `SOLVER_BUDGET_WORK` 640, `SOLVER_UPGRADE_WINDOW_WORK` 85, `SOLVE_BACKSTOP_MS` 300000, `DETOUR_RUNG` {2, 300, 500}, `GHOST_KILL_RUNG` ON, `strikeIframeLapse` ON, `ESCAPE_CROSS_PASS_CACHE` OFF |
| identity block | `SEEDLING_PORT=9602 bash scripts/procgen/identity-block.sh .` (venv) | maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `f0bec576`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639` / `7d4cb820` / `49e23d85`, levels `e28c1e5d` / `fb1a59e5`, generated set OK; value rows md5 `9de09558` (`w0/identity-w0.txt`) |
| six `--check`s | the block's loop | battery `405d9c4b` · d2-chain `b76f6483` · l18 `465a8b46` · tail `35456fbc` · r9-l3 `6cd35fe1` · r9-campaign `3d41b9fb`, all exit 0 |
| reference | the block | ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH |
| tapeRunner pairs | `status\tfullName`, sorted (`seedling-hammer-heartbeat-evidence/tools/pairs.py`) | **621 `fceca579`**, 0 non-pass |
| surface / constants / entities / profile / roster | each `--check`, at a pristine worktree of the base | GREEN **314** · PASS **6,041** · PASS 566 · PASS 138 · **282** |
| bounded vitest BEFORE | 20 files at a pristine worktree of the base (`w0/vitest-files-w0.txt`: `solverBot*`, `hammer*` not `.slow`, `twoPassSolve*`, `solveProgress*`, `lintGateLabels`), `--maxWorkers=2` | **348 / 348** |

⚠ The identity block ran in the primary tree, and its later rows started after my first (OFF-inert) edit to
`solverBot.js` was on disk. The D2 AFTER rows (OFF and ON) equal these, so nothing rides on it.

## D1 — where the work goes (PASS, measure only)

### The instruments

- **`tools/lb-prof.mjs`**: one captured or rebuilt request, replayed as the worker does (`solveAnytime`), with a
  recording progress hook. It reports:
  - each segment's final `budget.asks` (the work units by site: Σ asks = `shouldStop` = units);
  - the wall between hook calls by the site that opened the gap (HB's method);
  - the deadline asks by the active frame (`--frames`);
  - each segment's tree `rejectionKinds` and `lastWhy`;
  - optionally an in-process CPU profile (`--cpu`: inclusive and self shares);
  - `--budget=` / `--seam=` change only the REQUEST (diagnostics).
- **`tools/mk397.mjs`**: there is no page capture for 397, so I rebuilt its request from 414's (same page sweep,
  delivered set, items and save), re-staged at 397's arrival (40, 480, 896 from L39) and seam 5129, with the `live`
  digest the model computes. **Check:** it reproduces fidelity's captured 397 answer at 5129 exactly (`5a55f5b8`,
  156 units). ⚠ It keeps 414's `rng.seed`.
- **The census:** `replay-seedling-solve-request.mjs --seam-time-sweep=-10..10` (the census tool), one process per
  seam time.

### The profile at the captured seams (`d1/`, `p*.json`)

| leg, arm, budget | answer | units by site | wall | where the wall is |
|---|---|---|---|---|
| 414, defaults, 640 | deadline (`668f4ca7`), 643 | dashless 642: **`detour` 543**, `walk` 98, `crusher-fork` 1; full 1 (`walk`) | 47 s (113 s profiled) | `execKillByPress` **71 %**: `deriveStrike` 54 % (its `previewWalk` 51 %), `deriveRefuge` 13 %; GC 23 % self |
| 414, defaults, no budget | **EXHAUSTED (`de56da9c`), 11,908** | per pass: `detour` 3,480, `crusher-fork` 2,376, `walk` 98; **both passes identical** | 236 s | — |
| 414, walls+blast, 640 | deadline (`668f4ca7`), 643 | `detour` 569, `walk` 72, `crusher-fork` 1 | 100 s | — |
| 414, walls+blast, no budget | **EXHAUSTED (`3946a36f`), 10,416**, on `bobsoldier@880,832` | per pass: `detour` 3,480, `crusher-fork` 1,656, `walk` 72 | 353 s | — |
| 397, defaults, 640 | HAMMER_SAFETY (`5a55f5b8`), 156 | per pass: `walk` 78 | 213 s (189 s profiled) | `execKillByPress` **74 %**: `deriveStrike` 57 % (`previewWalk` 51 %), `deriveRefuge` 14 %; GC 24 % |
| 397, both arms, no budget | **the same answer, 156** | — | 282–308 s | — |

All walls were taken on a 4-core box at load 6–13, so they are relative only. In order:
- **Which rung consumes the units.** On 414 the press kill on `spinner@880,848` (climb 1, kill rung, press arm)
  runs 2,132 ticks (1,482 with the walls) and asks almost no units: the `walk` asks are the walk's own. When it
  exits, the next climb's ladder refuses AVOID (CW's guard covers the goal tile), BAIT and KILL, and then:
  - DETOUR builds its via set: one fine `detour` ask per lattice cell, 3,480 cells, a planned leg each;
  - the forced-hit rung asks `crusher-fork` 2,376 times (1,656 with the walls).

  At 640 the budget runs out inside DETOUR's via set, and the full pass gets 1 unit.
- **Which rung consumes the wall.** The press kill: no strike is derivable on most of its ticks, so it takes a refuge
  tick and **re-derives every tick**. That is 9,839 previews over 2,132 ticks on 414, and 13,572 over 1,987 on 397,
  about 4.6 and 6.8 a tick, with each `deriveStrike` previewing up to 40 candidate cells.
- **Repeated work a cache could share.**
  1. The full pass repeats the dashless pass unit for unit, whenever its search never reaches a dash: 414 5,954 + 5,954,
     397 78 + 78 and the same 1,987-tick press kill twice. That doubles every leg's wall. It is the JS arc's pass loop
     (`solveAnytime`) and XF's cross-pass territory, not mine.
  2. The press kill's per-tick re-derivation previews the same cells from a state one tick on. That is not exact
     across ticks, so it is no cache, and changing it would move plans.
- **The tree's kinds.** Every kind is named except one `other` on 414's base solve: the `narrow` rung's *"the corridor
  walked with the pre-lapse strike admissions is dangerous too"* (`LAPSE_NARROW_RETRY`). The `danger` rule reads
  `probes? dangerous`, not `is dangerous`. That is for PR (below).

### The budget diagnostic (clock (c), never committed)

Raising `budgetWork` in the request (node only) solves **neither leg in either arm**:
- 414 needs 5,954 units a pass (5,208 with the walls) to finish its search, and the search then refuses EXHAUSTED on
  the guard;
- 397 never touches the budget (156 units).

So there is no evidence here for a ruling on clock (c). Clock (b), `SOLVE_BACKSTOP_MS` 300 s, is not what ends these
rows either.

### The seam census (`d1/census/`, `d2/census/`)

Each row is one fresh process: `replay-seedling-solve-request.mjs --seam-time-sweep=-10..10 --jobs=1`. 414 runs
around its captured seam (5131), and 397 around its rebuilt one (5129). The arms are set by env (walls+blast:
`SEEDLING_CHASER_SPINNER_WALLS=1 SEEDLING_BOMB_BLAST_BODY=1`; guards: both `SEEDLING_PRESS_KILL_*_GUARD=1`). The class
is read off the answer's own words (`tools/cls.py`, `tools/census-md.py`). Files: `d1/census/` (OFF) and
`d2/census/` (ON).

**Leg 414** (seam times 5121–5141; class, work units):

| seam | defaults, OFF | defaults, guards ON | walls+blast, OFF | walls+blast, guards ON |
|---|---|---|---|---|
| 5121 | deadline, 643 | deadline, 643 | deadline, 643 | deadline, 643 |
| 5122 | deadline, 643 | deadline, 643 | deadline, 643 | deadline, 643 |
| 5123 | shake-throw(live run), 130 | shake-throw(live run), 130 | shake-throw(forecast), 140 | shake-throw(forecast), 140 |
| 5124 | deadline, 643 | deadline, 643 | refused: HAMMER_SAFETY, 160 | refused: death (REBOOT guard), 118 |
| 5125 | deadline, 643 | deadline, 643 | refused: HAMMER_SAFETY, 134 | refused: HAMMER_SAFETY, 134 |
| 5126 | deadline, 643 | refused: death (REBOOT guard), 104 | deadline, 643 | refused: death (REBOOT guard), 110 |
| 5127 | shake-throw(forecast), 142 | shake-throw(forecast), 142 | deadline, 643 | deadline, 643 |
| 5128 | strike bound, 641 | refused: death (REBOOT guard), 118 | deadline, 643 | deadline, 643 |
| 5129 | refused: HAMMER_SAFETY, 158 | refused: death (REBOOT guard), 118 | deadline, 643 | deadline, 643 |
| 5130 | shake-throw(forecast), 254 | refused: death (REBOOT guard), 118 | deadline, 643 | deadline, 643 |
| 5131 | deadline, 643 | refused: death (REBOOT guard), 118 | deadline, 643 | deadline, 643 |
| 5132 | swing-throw, 308 | refused: death (REBOOT guard), 118 | deadline, 643 | deadline, 643 |
| 5133 | deadline, 643 | refused: death (REBOOT guard), 118 | deadline, 643 | refused: death (REBOOT guard), 118 |
| 5134 | swing-throw, 308 | refused: death (REBOOT guard), 118 | refused: HAMMER_SAFETY, 158 | refused: death (REBOOT guard), 118 |
| 5135 | shake-throw(forecast), 154 | shake-throw(forecast), 154 | shake-throw(forecast), 152 | shake-throw(forecast), 152 |
| 5136 | deadline, 643 | refused: death (REBOOT guard), 136 | deadline, 643 | refused: death (REBOOT guard), 136 |
| 5137 | deadline, 643 | refused: death (REBOOT guard), 138 | deadline, 643 | refused: death (REBOOT guard), 138 |
| 5138 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 |
| 5139 | shake-throw(forecast), 200 | refused: death (REBOOT guard), 90 | refused: HAMMER_SAFETY, 130 | refused: death (REBOOT guard), 88 |
| 5140 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 |
| 5141 | deadline, 643 | refused: death (REBOOT guard), 94 | deadline, 643 | refused: death (REBOOT guard), 96 |

- defaults, OFF (21): deadline 10, shake-throw(forecast) 4, refused: HAMMER_SAFETY 3, swing-throw 2, shake-throw(live run) 1, strike bound 1, median 286 s a seam (loaded box)
- defaults, guards ON (21): refused: death (REBOOT guard) 12, deadline 4, shake-throw(forecast) 2, refused: HAMMER_SAFETY 2, shake-throw(live run) 1, median 126 s a seam (loaded box)
- walls+blast, OFF (21): deadline 13, refused: HAMMER_SAFETY 6, shake-throw(forecast) 2, median 244 s a seam (loaded box)
- walls+blast, guards ON (21): deadline 8, refused: death (REBOOT guard) 8, refused: HAMMER_SAFETY 3, shake-throw(forecast) 2, median 131 s a seam (loaded box)

**Leg 397** (seam times 5119–5139; class, work units):

| seam | defaults, OFF | defaults, guards ON | walls+blast, OFF | walls+blast, guards ON |
|---|---|---|---|---|
| 5119 | shake-throw(forecast), 162 | refused: death (REBOOT guard), 114 | shake-throw(forecast), 162 | refused: death (REBOOT guard), 114 |
| 5120 | deadline, 643 | refused: death (REBOOT guard), 114 | deadline, 643 | refused: death (REBOOT guard), 114 |
| 5121 | deadline, 643 | refused: death (REBOOT guard), 114 | deadline, 643 | refused: death (REBOOT guard), 114 |
| 5122 | deadline, 643 | refused: death (REBOOT guard), 142 | deadline, 643 | refused: death (REBOOT guard), 142 |
| 5123 | refused: HAMMER_SAFETY, 190 | refused: death (REBOOT guard), 132 | refused: HAMMER_SAFETY, 170 | refused: death (REBOOT guard), 130 |
| 5124 | refused: HAMMER_SAFETY, 236 | refused: death (REBOOT guard), 114 | deadline, 643 | refused: death (REBOOT guard), 114 |
| 5125 | refused: HAMMER_SAFETY, 308 | refused: death (REBOOT guard), 114 | refused: HAMMER_SAFETY, 308 | refused: death (REBOOT guard), 114 |
| 5126 | deadline, 643 | refused: death (REBOOT guard), 114 | deadline, 643 | refused: death (REBOOT guard), 114 |
| 5127 | refused: HAMMER_SAFETY, 156 | refused: death (REBOOT guard), 114 | refused: HAMMER_SAFETY, 156 | refused: death (REBOOT guard), 114 |
| 5128 | refused: HAMMER_SAFETY, 236 | refused: death (REBOOT guard), 114 | deadline, 643 | refused: death (REBOOT guard), 114 |
| 5129 | refused: HAMMER_SAFETY, 156 | refused: death (REBOOT guard), 114 | refused: HAMMER_SAFETY, 156 | refused: death (REBOOT guard), 114 |
| 5130 | refused: HAMMER_SAFETY, 156 | refused: death (REBOOT guard), 114 | refused: HAMMER_SAFETY, 156 | refused: death (REBOOT guard), 114 |
| 5131 | deadline, 643 | refused: death (REBOOT guard), 114 | shake-throw(live run), 380 | refused: death (REBOOT guard), 114 |
| 5132 | shake-throw(forecast), 216 | refused: death (REBOOT guard), 114 | refused: HAMMER_SAFETY, 294 | refused: death (REBOOT guard), 114 |
| 5133 | shake-throw(live run), 242 | refused: death (REBOOT guard), 114 | shake-throw(live run), 242 | refused: death (REBOOT guard), 114 |
| 5134 | refused: HAMMER_SAFETY, 358 | refused: death (REBOOT guard), 114 | refused: HAMMER_SAFETY, 358 | refused: death (REBOOT guard), 114 |
| 5135 | deadline, 643 | refused: death (REBOOT guard), 116 | deadline, 643 | refused: death (REBOOT guard), 116 |
| 5136 | shake-throw(live run), 242 | refused: death (REBOOT guard), 114 | shake-throw(live run), 242 | refused: death (REBOOT guard), 114 |
| 5137 | deadline, 643 | refused: death (REBOOT guard), 114 | deadline, 643 | refused: death (REBOOT guard), 114 |
| 5138 | deadline, 643 | refused: death (REBOOT guard), 114 | deadline, 643 | refused: death (REBOOT guard), 114 |
| 5139 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 | refused: HAMMER_SAFETY, 72 |

- defaults, OFF (21): refused: HAMMER_SAFETY 9, deadline 8, shake-throw(forecast) 2, shake-throw(live run) 2, median 277 s a seam (loaded box)
- defaults, guards ON (21): refused: death (REBOOT guard) 20, refused: HAMMER_SAFETY 1, median 127 s a seam (loaded box)
- walls+blast, OFF (21): deadline 9, refused: HAMMER_SAFETY 8, shake-throw(live run) 3, shake-throw(forecast) 1, median 393 s a seam (loaded box)
- walls+blast, guards ON (21): refused: death (REBOOT guard) 20, refused: HAMMER_SAFETY 1, median 169 s a seam (loaded box)

**Reading it.**
- **No seam time solves in any of the 168 rows** (2 legs × 4 arms × 21 seams).
- **OFF** (D1's question), both legs land on the same handful of classes in both arms:
  - deadline;
  - the press kill's HAMMER_SAFETY corner;
  - the forecast's shake throw (HO1's) at 414 5127 / 5130 / 5135 / 5139 and 397 5119 / 5132 (defaults), 5119 (walls+blast);
  - `levelRun`'s live band throw (not HO1's: a live run is never caught);
  - at 414's defaults only: two swing-through-Solid throws and one strike-bound throw.
- **ON** (D2's movers):
  - every forecast or live band throw that comes after a death becomes the reboot refusal, at that death;
  - so do most deadline and HAMMER_SAFETY rows, because the press kill on these legs almost always crosses a death:
    397 refuses at a death at 20 of 21 seams in both arms, and 414 at 12 / 8.
  - What is left is named.
- **Four throws survive ON**, all before any death, each at OFF's exact units:
  - 414 5127 (defaults) and 5123 (walls+blast) throw from the walk's own corridor probe (`walkToUnder` →
    `probeCorridor` → `previewWalk`), after the kill returns (`d2/stack-414-5127-guards.txt`,
    `stack-414-5123-wb-guards.txt`);
  - 414 5135 (both arms) throws from the press kill's REFUGE preview (`refugeNow` → `deriveRefuge` → `previewWalk`,
    `d2/stack-414-5135-guards.txt`; the walls+blast row has the same work, 152, untraced);
  - 414 5123 (defaults) is the live run's throw.

  The refuge preview is HO1's shape inside the press kill, but the HO1 fixture never meets the band there (a scan of
  every tick after both deaths: 0), and the only state that does is the 1 MB page request at seam 5135. So I did not
  build that catch without a gate row: hand-over 5b.
- **The wall.** With the guards ON, the median wall a seam drops by about half, on the loaded box:
  - 414: 286 → 126 s (defaults), 244 → 131 s (walls+blast);
  - 397: 277 → 127 s and 393 → 169 s.

  This is the reboot refusal ending the press kill at its first death instead of re-running it. It is the only
  measured lever here on the band's timeouts, and it buys refusals, not solves.

### HO1 and HO2 re-measured on the base (`ho/`)

| | arm | result |
|---|---|---|
| HO1 (`cw-solve.mjs --view=boot-414.json --goal=collect:880,816 --ghost=1`) | defaults | **THREW at t2439**, the same throw (`execKillByPress` → `deriveStrike` → `walkTo` → `previewWalk` → `onScreenAt`), deaths 1202 / 2395, 6 hits: fidelity's row, unchanged |
| HO2 (the same, `SEEDLING_CHASER_SPINNER_WALLS=1 SEEDLING_BOMB_BLAST_BODY=1`) | walls+blast | **THREW `STRIKE_BOUND_EXHAUSTED`** at the 11,418-tick bound, 29 strikes, 10 landings, **9 deaths** (1202, 2397, 3592, 4787, 5982, 7177, 8372, 9567, 10762), 27 hits: fidelity's row with `bombBlastBody` ON too |
| On the page requests | both | the forecast's shake throw on 414 at 5127 / 5130 / 5135 / 5139 (defaults) and 5123 / 5135 (walls+blast), on 397 at 5119 / 5132 (defaults) and 5119 (walls+blast); `levelRun`'s LIVE band throw (not HO1's: the live run, `levelRun: whether … at tick 1569`) on 414 at 5123 (defaults) |

**The D1 STOP question.** No lever in the hammer region turns either leg into a solve: the guard is the wall (CW),
and the work budget is not binding (397) or ends in a named refusal (414). HO1 and HO2 do remove throws, and HX is
mandated, so D2 ran.

## D2 — HX, behind OFF switches (PASS)

**`pressKillGuards.js`: two switches, both OFF** (`PRESS_KILL_SHAKE_GUARD` / `PRESS_KILL_REBOOT_GUARD`; env
`SEEDLING_PRESS_KILL_SHAKE_GUARD=1` / `SEEDLING_PRESS_KILL_REBOOT_GUARD=1`; `withPressKillShakeGuard` /
`withPressKillRebootGuard`). They are separate because the mechanisms are separate and each needs its own A/B.

- **HO1, the shake-band throw: refuse the candidate, and so wait the band out.** In `deriveStrike`'s `walkTo` (the
  press kill's strike preview, caller side), the chaser forecast's band throw, and only that throw
  (`isShakeBandThrow`: a plain `Error` beginning with the forecast's own words, never the live run's
  `levelRun: whether …`), refuses that candidate cell. The rejection row reads *"the preview cannot be asked inside
  the camera's shake band: whether bob bob@736,752 is on screen depends on where inside `Game.shake`'s jiggle the
  camera landed, and the jiggle's value is not modelled (PRESS_KILL_SHAKE_GUARD: …)"*. Its walk reads as truncated,
  so the bounded pass, the measured-ETA pass and the admission's continuation all skip it. With no strike, the kill
  does what it does at any strikeless tick: a refuge tick, then derive again. So "refuse" and "wait the band out"
  are one mechanism, and I picked it for that reason: no new wait loop, and no tick count to guess. **Measured on
  HO1's repro: THREW t2439 → REFUSED t5672 on `bobsoldier@880,832`.** That is G1's pre-`rebootShake` answer, after 4
  deaths, 14 hits, and the kill landing at t5659. The candidate's kind is **`unmodelled`**: `progressKind` reads
  "not modelled" with no mapping change.
- **HO2, the schedule across a reboot: refuse at the first death.** In `execKillByPressOnce`'s loop, a new
  `playerDeaths` row after an `advance` refuses the kill on that tick. It throws `SolverRefusal` with
  `obstacle {kind: 'danger', id: <the killer>}` and the kill's `perTick` (the executor's convention), with the words
  *"the player died at t1202 (chaser bob@736,752) while pressing spinner@880,848, after 1 landing(s) — a death
  reboots the room: … (PRESS_KILL_REBOOT_GUARD: the kill is refused at the first reboot, not re-run to its bound)"*.
  The kind is **`danger`**. **Measured: walls+blast THREW at the 11,418-t bound → REFUSED t1202.** Defaults: the
  same, t1202.
- **OFF reads nothing.** The catch rethrows when OFF, and the ledger is read only when ON. No budget, deadline site,
  `shouldStop`, work unit or default is touched. `pressEscapeOnce`'s reach calls neither function, so XF's
  cross-pass escape key needs no new input.

### ON vs OFF

| measure | OFF | ON (both switches) |
|---|---|---|
| L18 / L40 / L6 / L3 (`tools/d2-matrix.mjs`: `solveProgress.test.js`'s four solves, never-tripping deadline, fine checkpoints) | L18 `230dc0ff` 445 t `shouldStop` 165 asks [{walk 13, hammer-escape 37}, {14, 37}, {18, 37, sword-dash 9}] · L40 `3addc379` 679 t 167 [{walk 61, kill-chaser 97, sword-dash 9}] · L6 `341a2e63` 294 t 15 · L3 `c4625729` 245 t 16 | **identical, line for line**; guard counters 0 / 0 |
| identity block, six producer `--check`s, reference | = W0 | **= W0** (`d2/identity-on.txt`, every row) |
| tapeRunner pairs | 621 `fceca579` | **621 `fceca579`** |
| bounded set (W0's 20 + the gate) | 353 | **351 passed, 2 red** (`d2/vitest-on.txt`): the two rows below; the gate's "ship OFF" row is skipped under the env |
| the full tier's hammer rows (`hammerDashShape.slow`, `hammerEscapeGenerated.slow`) | 2 / 2 | **2 / 2** |
| CI `JavaScript Unit Tests` at `470b797b` (OFF) | **21,176 / 21,177**, slow battery 254 / 254 (run 39208419566). The one red is `procgenDocs/generated.test.js` *"`--check` exits 0"*: my `seedling-bot.md` paragraph moved the docs index's word counts, which D4's regeneration re-records (the next run is the planner's to read) | — |

**The movers, by name.** Expected: throws → named refusals. Also found:
- **The reboot guard alone moves two committed L40 witness rows.** Each is a refusal whose press kill crosses a death,
  and each now refuses at that death:
  - `hammerGhostKillRung.test.js` (G1's ghost kill, staging A): the prefix, **2195 → 1216**;
  - `hammerStrikeEtaFloor.test.js` (SF's floor witness): **1629 → 778**.

  The shake guard alone moves neither (`d2/vitest-movers-*.txt`). Both were refusals before and are refusals now.
  What a flip must still answer is whether, anywhere in the sweep, a kill that survives a death goes on to a SOLVE.
  HO1 ON at the defaults is such a kill: it survives four deaths and kills, then stops on the guard. Here that
  changes nothing, but elsewhere it could.
- In the census (below): DEADLINE / HAMMER_SAFETY rows that pass a death inside the kill become the reboot refusal
  at that death. That is earlier, named, and a refusal either way.

### The gate (`hammerPressKillGuards.test.js`, 5 rows; fixture `fixtures/hammer-lb-hx/`)

The fixture is 414's atlas boot plus the base's own keys to t2439, recorded tick by tick from the HO1 solve.
1. **Ship OFF**: both switches and both `_DEFAULT`s.
2. **`isShakeBandThrow`** names the forecast's throw. It does not match the live run's throw, a `TypeError` with the
   same words, or a string.
3. **HO1 at t2439**, preconditions asserted (deaths [1202, 2395], the target's timer 0):
   - OFF: `deriveStrike(run, 'spinner@880,848', ∅, 0)` throws the forecast's band throw;
   - ON: `cell` is null, ≥ 1 rejection names the band, each classifies `unmodelled`, and the admission's continuation
     returns the strike (664,680), press t3276 (pinned);
   - the run is untouched. 3.4 s.
4. **HO2 OFF**: `solveSegment` from the boot with `advance` capped at t1300. The kill passes the t1202 death and meets
   the cap.
5. **HO2 ON**: the same solve is refused at t1202 with `SolverRefusal`, `{danger, bob@736,752}`, `perTick` 1,202, the
   words, kind `danger`. Rows 4 and 5 take ~83 s each under load and are bounded at 600 s.

**Mutants** (`tools/mutants.py`, run in a scratch worktree, never the live tree; restored by md5 `9b131231`;
`d2/mutants.txt`):

| mutant | predicted | measured |
|---|---|---|
| M1 the shake catch ignores its switch | row 3 (OFF no longer throws) | row 3 red |
| M2 the band's walk is not marked truncated | row 3 (the continuation takes a band cell) | row 3 red |
| M3 the reboot guard ignores its switch | row 4 | row 4 red |
| M4 the reboot guard's `>` becomes `>=` (refuses on any tick) | row 5 | row 5 red |

**The kinds for PR** (`solveProgress.js` not edited): HO1's row → `unmodelled`, HO2's refusal → `danger`, both
measured through `progressKind`. **No mapping is needed for my sentences.** The base's one `other` (above) needs
one, to `danger`.

## D3 — the band's lever: the hand-over table (no build)

D1 named no lever in the hammer region that changes an answer. The table:

| # | blocker | owner | evidence | measured effect of fixing it |
|---|---|---|---|---|
| 1 | **The chest's guard.** `bobsoldier@880,832` covers the chest stance's tile; the chaser arm has no stance for a body that never approaches (CW item 1(c)) | fidelity (the chaser arm / an approach-and-strike stance) | 414 unbounded: EXHAUSTED, *"A\* goal tile (55,51) … not walkable: danger:bobsoldier@880,832"*; HO1 ON: REFUSED t5672 on the bobsoldier; CW's override reaches it and stops | The precondition for any solve on these legs. No measured effect until it exists |
| 2 | **CW's joint 3-body chooser** (CW item 1) | hammer | CW's `d1-scratch-chooser.diff`: the set {bobsoldier, `bob@736,752`, `bob@736,800`}; alone it moved "no target" to "no stance" with the same hits | **Not the blocker yet.** D1 shows the guard first (1). Sized from CW's scratch diff: one function in `climbLadderUnder`'s chooser, growing the hypothesis by one live body until a corridor exists, plus its gate. Worth a switch only after (1) |
| 3 | **DETOUR's spend on an unwalkable goal tile.** Its via set asks 3,480 fine `detour` units while every candidate's tail ends on the covered tile | fidelity (DETOUR, L14) | 414: 543 of 640 units at the budget; 3,480 a pass unbounded | If DETOUR and the forced-hit rung (2,376) refused by name when the goal tile itself is covered, 414's pass would drop to ~98 units: deadline rows become named EXHAUSTED refusals inside 640 (still no solve). DETOUR alone: 5,954 → 2,474, still above 640 |
| 4 | **The anytime full pass repeats the dashless pass** when the search never reaches a dash | JS arc (`solveAnytime`) / XF | 414 5,954 + 5,954; 397 78 + 78, the same 1,987-tick press kill twice | Up to half of each leg's wall: 397's profile 189 s → ~95 s. Moves `timeout` rows toward their deterministic answer under the 90 s harness; solves nothing |
| 5 | **The forecast's band throw from the walk's own corridor probe** (`walkToUnder` → `probeCorridor` → `previewWalk`), after the kill returns: HO1's catch does not reach it | the walker / `probeCorridor`'s owner (the planner names it) | 414 seam 5127 (defaults) and 5123 (walls+blast), unchanged with both guards ON (`d2/stack-414-5127-guards.txt`) | One throw → a named refusal per such seam. The same refuse-the-candidate shape fits (refuse the corridor, wait the band) |
| 5b | **The forecast's band throw from the press kill's REFUGE preview** (`refugeNow` → `deriveRefuge` → `previewWalk`): HO1's shape one call over | hammer (RE's `deriveRefuge`; the same switch would fit) | 414 seam 5135, both arms, unchanged ON (`d2/stack-414-5135-guards.txt`). The HO1 fixture never meets it: 0 of the ticks after both deaths | One throw → a refuge candidate refused (skip it; if every refuge is refused, the kill's *"nowhere to be"* refusal must say the band hid them). Needs a gate state from the page request at seam 5135 (1 MB) first: not built ungated |
| 6 | **The live run's own band throw** (`levelRun: whether bob@736,800 is on screen at tick 1569`), 414 seam 5123 (defaults) | fidelity (`levelRun`) | census, both modes | One throw. Not catchable in a preview, by design |
| 7 | **The swing through a Solid** (`levelRun: the swing at (727.7, 680.2) … collideLine("Solid")`), 414 seams 5132 / 5134 (defaults) | fidelity (already handed over by L40CONTACT) | census | Two throws, at the defaults only |
| 8 | **Clock (c)** | the user | no budget solves either leg | No ruling is supported by this evidence |
| 9 | `narrow`'s *"… is dangerous too"* classifies `other` | PR (`solveProgress.js`) | `d1/p414-i0-def-other.json` | One `other` → `danger` |

## D4 — records (PASS)

- **`seedling-bot-log.md`**: § *Seedling hammer-phase LB — the L40 chest band + HX*.
- **`seedling-bot.md`**: the switches' as-built paragraph, beside BW's and RE's.
- **Surface / constants / entities / profile**:
  - the surface census RED after D2 (three new `playerDeaths` reads, one `ticksCompleted` read, `pressKillGuards.js`
    in the closure) → `--write` → **GREEN 314**;
  - constants PASS **6,041** (no new literal); entities 566; profile 138; roster 282.
- **Reference**: `generate-procgen-reference.mjs` (the docs index's word counts and `README.md`'s region), then
  `--check` **ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`:
  current (187 docs, no change).
- **Bounded vitest AFTER** (`d4/vitest-files-after.txt`: W0's 20, the gate, `seedlingSolverSurface`,
  `seedlingConstantsCensus`, `tapeIndexManifest`; `--maxWorkers=3`): **24 files, 698 / 698**.
- **Not run**, by the brief: no `standing-values --write`, no `pytest`, no unfiltered local vitest (⚖ 52). No
  `git stash`, rebase or force-push; nothing to `main`.

| | before (W0) | after (head, OFF) |
|---|---|---|
| identity block (value rows) | `9de09558` | = W0 (the AFTER is the ON run, `d2/identity-on.txt`; OFF moves nothing by construction) |
| six `--check`s, reference | as W0 | = |
| tapeRunner pairs | 621 `fceca579` | 621 `fceca579` (ON) |
| surface / constants / entities / profile / roster | 314 / 6,041 / 566 / 138 / 282 | 314 (re-recorded) / 6,041 / 566 / 138 / 282 |
| bounded vitest | 20 files, 348 / 348 | 24 files, 698 / 698 |

## The user's question, answered plainly

**Would a longer timeout or a bigger budget unblock these solves? No.** I measured both directly.
- **The work budget.** Raised to unlimited in node, 414 finishes its search at 5,954 units a pass and refuses by name
  (*"the combat ladder is EXHAUSTED"*: the chest's tile is inside `bobsoldier@880,832`'s live volume). 397 refuses
  at 156 units whatever the budget: the press kill walks into a corner where every key set meets a hammer or a body.
- **The timeout.** Sweep `39196052141` already ran these legs at a 400 s leg budget. 414 came back "failed" on the
  work budget, not on time, and 397's page ran out of memory. Each solve's wall here is 47–308 s under load, about 70 %
  of it the press kill re-deriving its strike on every tick. A longer timeout turns a `timeout` row into the
  `failed` / refusal row it would have been.
- **No seam time solves**, in 21 per leg per arm.

What blocks the chest is the guard, not time. The profiling tools are now three:
- `lb-prof.mjs`: work units by site, wall by site, the frame, the CPU profile;
- the census;
- HB's heartbeat.

They answer "where does the time go" and "where do the units go" separately. Those are different places.

## What the brief got wrong (measured)

1. **"414 … ran out of 640, then 2560 work units": "work-unit bound, not wall-clock bound."** True of the row, but not
   of the solve. Unbounded, it needs 5,954 units a pass and then refuses by name; the held retry's 2,560 could never
   have been enough, and more would only reach the refusal.
2. **"Raising [the work budgets] is … a full A/B"** presumes raising could solve. Measured: it cannot, on either leg.
3. **"HO1 … refuse the candidate by name, or wait the band out."** These are one mechanism: refusing the candidate
   leaves the kill strikeless, and a strikeless tick is a refuge tick that derives again.
4. **"Expected: some throws → named refusals; anything else is a finding."** The reboot guard also moves two committed
   witness rows (G1, SF) and census rows that crossed a death. All are refusals both ways.
5. **HO1's throw is not the only band throw.** The walk's own corridor probe meets the same band after the kill
   (hand-over 5), and `levelRun`'s live run has its own (hand-over 6).
6. **"397 (no capture: rebuild its request …)"**: the rebuild from 414's request is exact. It reproduces fidelity's
   captured 397 answer at seam 5129 (`5a55f5b8`, 156).
7. **The bootstrap left six submodules uninitialised** after `READY` (as for fidelity and HB).

## Residue

1. **The flip is the user's.** Measured: both switches ON move no identity row, producer, tapeRunner pair, slow hammer
   row or progress solve. The reboot guard moves two L40 witness rows. Before any flip:
   - the CI divergence sweep A/B on the L40 legs (OFF vs `SEEDLING_PRESS_KILL_SHAKE_GUARD=1` /
     `SEEDLING_PRESS_KILL_REBOOT_GUARD=1`), mainly to answer whether any death-crossing kill elsewhere ends in a solve;
   - then a re-pin of `hammerGhostKillRung` / `hammerStrikeEtaFloor`'s ON rows and of the gate's "ship OFF" row.
2. **For the planner, for PR:** `narrow`'s *"is dangerous too"* → `danger` (hand-over 9). My sentences need no
   mapping.
3. **The hand-over table (D3)**: items 1, 3, 6 and 7 are fidelity's, 4 is the JS arc's / XF's, 5 is the planner's
   to assign, 5b is the hammer arc's next HX step (it needs its fixture first), and 2 waits on 1.
4. **Measured under load.** The box ran 4–8 solves at once (load 6–13 on 4 cores), so every wall here is relative.
   The units, answers, digests and ticks are box-independent.
5. **Tree hygiene.** The scratch worktrees (`scratchpad/base`, `scratchpad/mut`) are removed by name; the server is
   killed by PID. The six submodules initialised in W0 stay at their recorded gitlinks (no gitlink moved).
6. **CI dispatches** (from the cloud `workflow_dispatch` is 403):
   - `JavaScript Unit Tests` runs on push: `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`;
   - `seedling-divergence-sweep.yml`, `mode=inv`, `producer=solver`, `keys="level_40__r23c29 <- in_L39_144_0 ->
     location:Level 040 - Chest|level_40__r23c29 <- in_L43_176_464 -> location:Level 040 - Chest"`, once at the
     defaults and once with the two guards ON. The workflow has no env input for them, so a one-line scratch commit
     flipping both `enabled` defaults is the way.

## Rows to BANK

- `pressKillGuards.PRESS_KILL_SHAKE_GUARD` / `PRESS_KILL_REBOOT_GUARD` (both OFF); `SEEDLING_PRESS_KILL_SHAKE_GUARD`,
  `SEEDLING_PRESS_KILL_REBOOT_GUARD`; gate `hammerPressKillGuards.test.js` (5 rows); fixture `fixtures/hammer-lb-hx/`.
- Surface **314** (re-recorded, GREEN); constants **6,041**; entities 566; profile 138; roster **282**; tapeRunner
  pairs **621 `fceca579`**; identity value rows `9de09558` (= OFF = ON); r9-campaign `3d41b9fb`.
- D1's numbers: 414 unbounded 5,954 units a pass (walls+blast 5,208), EXHAUSTED; 397 156 units at any budget; 414
  @640 = `detour` 543 / `walk` 98 / `crusher-fork` 1.
