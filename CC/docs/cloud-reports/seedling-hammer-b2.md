# Seedling HAMMER-PHASE — slice B2: the whole spinner FIGHT as one space-time search

Slice `seedling-hammer-b2` (Opus, cloud), planner `seedling-hammer-phase-planning`.

⚖ **The user** (2026-10-09), shown B1's result: **"Merge OFF, then B2"** — *"plan the whole fight as one search,
surviving to the last kill, with each press a step and the bodies' hit state in the search."*

| | |
|---|---|
| Start SHA | `8479a459ef72c9c2bf8809f9c773af6010d81009` (main; contains B1: `5aa4265`…`72fc42d` + the bank) |
| Head | the commit carrying this report (code `8bdf7ad`, `6cee36f`; witness `a2fc5f7`; records `0a59586`) |
| Harness branch | `claude/seedling-hammer-b2-2ymbgu` (the brief's `seedling-hammer-b2`; the harness names the branch). Nothing went to `main` |
| Dev server | `serve-nocache.py 9530` (`SEEDLING_PORT=9530`); a base worktree `/home/user/Archipelago-CC-wt-b2-base` on 9531 (W0 at the base, then the OFF/ON identity blocks at `a2fc5f7`); a scratch worktree `/home/user/wt-b2-dbg` (the mutants, the traces) |
| Verdicts | **W0 PASS · D1 PASS · D2 STOP at 5 (cost: the generation capacity rows do not finish with the flag ON); every other D2 item measured, the movers listed · D3 PASS** |

## The one thing to know first

**The fight search does what B1 could not, and it is NOT cheap enough to turn on for generation.**
- On L18 it solves 45/45 with no hit at a mean of **362.1 t** (B1 367.6, A4 434.3). Every one of B1's seven solved →
  refused records **solves** with it on, by the fight itself.
- Across every generated row measured (acceptance, c3, c6, c4, ENEMY, killgate s2/s5/s9, the capacity killgate
  draws, and B1's approach-path records), **no record that solves off refuses on**; 0 of 3,810 records.
- But a generated killgate draw (`seedlingGenCapacity`'s seed 57: 268 s off) had not finished after
  50 minutes on: 898 kill searches at ~1.6 s each, 46 of them cut at the 100,000
  budget. The capacity rows (`seedlingGenCapacity` and its slow census) are the brief's STOP: their cost table is
  below; the search was not shrunk to fit.
- Two defects in the FOLLOW were found by measuring and fixed: `safeStep`'s plain forecast refuses a stand that a
  landing in flight makes safe, and a certificate planned on one run was adopted by another whose `Game.time` was 150
  frames ahead.

The flag is OFF in head and OFF is byte-identical (the identity block at the head equals the base row for row).

## W0 — at the base `8479a459e` (PASS)

| row | command | result |
|---|---|---|
| base | `git fetch origin main && git checkout -B claude/seedling-hammer-b2-2ymbgu origin/main` | `8479a459e`; `git log --oneline -30 \| grep -a hammer-b1` lists B1's five commits |
| bootstrap | `bash scripts/cloud/session_bootstrap.sh --seedling` | `READY` (node v22.22.0). `bulletml-dodge` at its pin `7423ee86` |
| identity block | `SEEDLING_PORT=9531 bash scripts/procgen/identity-block.sh .` in the base worktree | log md5 `891eca0709923ebc31e2d8408e5c10d1`. maze `246dfbce`, acceptance `76602ae8`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, **ENEMY `30bcc49c`** (B1 quoted `0d3262f6`: main moved it after B1, at the wave-9 harvest; `standing-values.json` carries `30bcc49c`), guard `a6d18d49`, AREA `02b22525`, killgate `006b0639`/`7d4cb820`/`49e23d85`, levels `e28c1e5d`/`fb1a59e5`. `generated set` cannot run in the worktree (no venv there); reference 4 DIFFER (environmental, as A/B1 saw) |
| six `--check`s | in the block | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`, all exit 0 (= B1's) |
| surface / constants / entities / profile | each `--check` | GREEN 225 · PASS 5,432 · PASS 528 · PASS 138 (main's, after the wave-9 harvest) |
| roster | `fixtures/tapes/index.json` | 258 |
| bounded vitest BEFORE | B1's 72 files by name (B1's report lists them) | 3,149 tests: 3,138 pass, 1 fail (`procgenDocs/generated`, the worktree), `seedlingGenCapacity` does not load in the worktree (`bulletml-dodge`'s built `tracks.js`) — B1's two environmental rows. tapeRunner **573**, md5 `77b8c6bf6c7e8cce574c66078f7896a0` |
| ENEMY's chamber spinner | the census's own row | `THREW:Error` at the base: *"level 900 holds live spinners AND a DIALOGUED ceremony (torch)"* — the corridor arm solves (226 t). Pre-existing, not the hammer arc's |

**The monotonicity instrument, committed** (`scripts/procgen/check-seedling-hammer-monotonicity.mjs`, `--help`
door; `hammerMonotonicityHook.js` + `hammerMonotonicityLoader.js`):
- CAPTURE: the row's OWN script (the identity block's command, unchanged) runs in a child under `node --import` of the
  hook, which rewrites `procgenOracle.solve` into a forwarder **in that process's module graph only** and appends every
  solve whose level record holds a spinner (record, staging, goals, budget, verdict). The child's stdout md5 is printed:
  on the OFF path it equals the identity block's row every time (killgate s2 `006b0639` … c4 `b9d2185d`), so the hook
  is inert.
- RE-SOLVE: each record is solved again by `procgenOracle.solve` under every mode named (`off`, `fight`, `approach`);
  the path's own mode must reproduce the captured verdict and ticks (replay mismatches: 0 in every run). A record
  SOLVED off and not SOLVED under another mode is ⛔ and the exit is 1.
- Rows: the identity block's spinner rows, plus the capacity rows (`dump-seedling-gen-capacity.mjs`, new: the
  `seedlingGenCapacity` census as a dump, because a vitest file runs under its own loader).

**B1's seven, reproduced** (`--path=approach --modes=off,approach`): c4 `23b7302d` (= B1's ON digest) — winding
post-sword s4 SOLVED 625 t → REFUSED, winding post-shield s6 (×2) 419, branchy (×2) 508, bushy 625, loopy (×2) 700;
c3 and c6 — s22 (×3) 367, s32 400. Exactly B1's table.

## D1 — `HAMMER_FIGHT` (PASS; `8bdf7ad`, `6cee36f`)

### The forecast as a function of the path — `levelRun.spinnerFightForecast`

`spinnerForecastWithPress` decomposed into a per-tick cursor: the live bodies deep-copied, `stepSpinners` under the
same `ctxNow`/`ctxAfter` split, and per tick the run's own order — the window's due tests (`swordWindowStep`, each
one `forecastSwordTest`), then a press of the player's at that tick (`slashPressForecast` aged from the slash state
the LAST press left, `swordWindowReplace` + `swordWindowSchedule`). Many presses along one path; a re-press inside 20
ticks is a dash. A tick with a test due reads the player's point (and throws without one); a quiet window reads none,
so a cursor is SHARED by every path through it, and a press FORKS it (`fork(row)`, the state after that row).
- The sword test is lifted out of `spinnerForecastWithPress` (`forecastSwordTest`), one spelling for both — OFF
  byte-identical (the identity block, the six `--check`s, the 45-row sweep with the escape on).
- Unit row: one press through the cursor IS `spinnerForecastWithPress` — every row, body and test (L18 r40, a press
  at +20); a fork replays the same rows.

### The search — `solverBot.deriveFight`

- **Node** = (exact player state, absolute tick, the cursor, my last press). The bodies' fight state (hits,
  `hitsTimer`, dying, the slash state) is the cursor's.
- **Dedup key** = `coarseKey(8)` (the cell × velocity signs) + every body's (hits, dying, i-frame RUNNING OR NOT) + the
  press window's bucket (within the train / within the dash window / after). Two states with different hit histories
  never merge. Of two states with one key at one index the better-ordered is kept (A's rank-kept layer, best-first).
- **Successors** = the nine key sets, and — where `pressReadyAt` holds for a live body of the order (the executor's
  one predicate, asked through `previewViewAt` of the node's own rows) — the press as the executor drives it: the aim
  key, `primary`, then stand until the window's last test (the train stood: its points are fixed, so the fork is exact).
  The child carries the forked cursor. A press that opens no window, swings through a Solid or lands on no body of the
  order is no successor.
- **Prune** = the escape's: `clearOfHammersAt` on the node's own rows, the lethal floor, a previewed death. With a
  shield carried, a tick whose moving shield box (`shieldBumpTouches`, the live gate and box, either `slashing`)
  touches a body on its row or the row before is pruned: the bump is FORBIDDEN rather than modelled, so the plain
  cursor stays exact on every path the search keeps.
- **Goal** = every body of the order dead (dying or gone) AND the escape's survive kernel (`spaceTimeReach`, stand
  first, ranked, its own budget) finds `HAMMER_ESCAPE_BOUNDS.horizon` = 75 ticks past that node on its cursor.
  Checked when the node is popped. Cost = ticks.
- **Order** = A* with weight 2: `f = tick + 2 × h`, ties by hits owed, then insertion. `h` is admissible: per body still
  owing hits, the first landing is no sooner than max(2 (aim + press), its i-frame, the gap to slash reach ÷ (the
  player's top speed + the body's floor speed)), each later landing ≥ `hitsTimerMax` after it, then the tail. (The
  distance term is admissible while the body moves at its floor speed; right after a knockback it is not — the
  weighted order is a heuristic either way, and what it can cost is a longer fight than the earliest, never a wrong
  one: every certificate is a path of real stepped states.)
- **Determinism**: the key-set order, an insertion counter as the last tie-break, no clock. Every sweep row the same
  twice.

### The bounds, derived and measured (`HAMMER_FIGHT_BOUNDS` / `HAMMER_FIGHT_MEASURED`)

| bound | value | derivation / measurement (L18 45 residues unless named) |
|---|---|---|
| `order`, `weight` | A*, 2 | `progress` (hits owed first): r40 459 t. `stage` (hits owed, then tick — B1's greedy with backtracking): 375 / 375 / 780 t at r40/0/29, the first two after a budget cut. A* (weight 1): r40 367 t for 132,958 expansions (and with this dedup not the earliest: weight 1.5 found 214 vs its 221). Weight 1.5: mean 363.8 t, median 37,976, max 63,627 (and r24 refused before the follow fix below). **Weight 2: mean 362.1 t, median 29,718, max 54,079** |
| `iframe` | `hitsTimerMax + 1` (running or not) | bucket 8: mean 380.7 t, median 18,249; exact timer: 374.3 t, median 23,479, max 138,877; running-or-not: 362.1 t, median 29,718 |
| `cell` | 8 px | 4 px: 375.7 t at median 108,782 (≈6×); the key is not the lever (B1's finding again) |
| `keepBest` | on | first-reached dedup: weight 2 mean ≈387 t on a 9-residue subset vs ≈381 kept-best (same bucket 8) |
| `tail` | 75 = `HAMMER_ESCAPE_BOUNDS.horizon` | the brief's post-kill window; mutant m2 below |
| `horizon` | the hits owed × `strikeHorizon(run)` | the executor's own bound per landing |
| `maxExpansions` | 100,000 | above every search that ended on its own: largest find 63,029 (c4), L18 54,079, largest exhausted 2,716. **Budget cuts: 0** on L18 and every identity row; **46 in the seed-57 killgate draw** (D2.5) |
| deadline | `hammer-fight` (appended to `DEADLINE_SITES`) | asked every 250 pops while a deadline is active; a trip is no claim |
| latch | a negative stands until the next landing | a cut or exhausted search from a state with the same fight state would search the same space again |

### The follow, and the two defects measuring found

The executor holds the certificate's key on every tick it describes — across the order's plans (the loop waits on
plan 1's body while the certificate may kill body 2 first), aims, presses and trains included — and every negative
hands the tick to the switch-off path. `derivePressKill`'s admission asks it first (a certificate is the kill's first
strike, adopted while it describes the run).
1. **`safeStep` refused a stand the landing makes safe.** Its landing test reads `run.spinnerForecast`, which holds no
   test it has not seen: on a train tick before a landing it moved the body INTO the stood player where the landing
   knocks it away (L18 r24, weight 1.5: *"There is no step out"* at t168, inside the train of a certified press). On a
   certificate tick it now asks `landsClearInFlight`: the same index-1 question of the hit-aware forecast over my window
   in flight, points supplied (`spinnerForecastWithPress`, no new press). OFF untouched.
2. **A certificate planned on one run was adopted by another.** c3 empty seed 22 (`spinner@16,32`): the admission's
   search ran on a run whose `Game.time` was 150 behind the executing run's at the same tick; the player and the
   bodies were byte-equal, so `sameState` adopted it, and every hammer phase it had priced was 15 of 45 off. `safeStep`
   swapped a stand six ticks after the kill and the old path refused (`SOLVED 219 → REFUSED`, four records, the
   monotonicity row c3 exited 1 — the brief's STOP condition, fixed, then every row re-run). The certificate now
   carries `clocks[k]` (`gameTimeAt(k)` at the search); a tick whose `gameTimeAt(0)` differs is LEFT and re-planned.
   ⚠ B1's `approachHeld` has the same latent hole (it compares only the state) — residue.

Records: the press record carries `fights` (per search: `t, caller, ok, bound, goal, end, expansions, nodes,
inReach, presses, landed, tails, tailCuts, deepest, byOwed`) and `fightsLeft`, flag ON only.

## D2 — measured (Box: 4 cores, loaded by 2–6 jobs throughout; every ON/OFF pair below ran back to back or in the same run)

### 1. B1's seven — PASS: every one SOLVES with the flag ON, by the fight itself

On the final code (`--records=<B1's approach-path capture> --modes=off,fight,approach`):

| record | OFF | APPROACH (B1) | FIGHT |
|---|---|---|---|
| c4 winding post-sword s4 (the 10th certify solve) | 625 | REFUSED | **430** |
| c4 winding post-shield s6 (= post-swim) | 419 | REFUSED | **399** |
| c4 branchy post-shield s6 (= post-swim) | 508 | REFUSED | **436** |
| c4 bushy post-shield s8 | 625 | REFUSED | **636** |
| c4 loopy post-shield s6 (= post-swim) | 700 | REFUSED | **413** |
| c3/c6 empty post-shield s22 (= post-swim/feather) | 367 | REFUSED | **343** |
| c3/c6 empty post-shield s32 | 400 | REFUSED | **380** |

Six of the seven are post-SHIELD rooms. Before the no-bump prune the fight made **no claim** in all six (the forecast
names a carried shield's bump as unmodelled) and they "solved" only by falling back to the OFF path — measured, then
designed out.

### 2. Monotonicity — PASS on every row measured (capacity: partial, see 5)

Each row's own script captured on the OFF path and on the FIGHT path; every spinner record re-solved off and on.

| row | OFF path: stdout md5 (= identity), records, solved off/on, refused→solved, solved→refused | FIGHT path: stdout md5 (= ON identity), records, … |
|---|---|---|
| killgate s2 | `006b0639`, 9, 9/9, 0, **0** | `0997b5f0`, 9, 9/9, 0, **0** |
| killgate s5 | `7d4cb820`, 9, 9/9, 0, **0** | `c0917134`, 9, 9/9, 0, **0** |
| killgate s9 | `49e23d85`, 9, 9/9, 0, **0** | `168ceec1`, 9, 9/9, 0, **0** |
| ENEMY | `30bcc49c`, 2, 2/2, 0, **0** | `b3fb45d3`, 2, 2/2, 0, **0** |
| acceptance | `76602ae8`, 23, 19/21, 2, **0** | `98e36e51`, 21, 13/19, 6, **0** |
| empty pairs c3 | `4937da80`, 102, 100/102, 2, **0** | `a3a10568`, 100, 99/100, 1, **0** |
| empty pairs c6 | `430573e9`, 170, 160/162, 2, **0** | `52316dfb`, 168, 156/160, 4, **0** |
| carved pairs c4 | `b9d2185d`, 138, 116/131, 15, **0** | `ef6e5024`, 142, 111/136, 25, **0** |
| capacity killgate (seeds 53, 57) | `7ca5e0b9`, 885, 873/881, 8, **0** | capture STOPPED after 1 h 57 min; the 1,651 records it had captured (vs 885 for the whole OFF row): 1,578/1,645, 67, **0** |
| capacity census pre/post (seeds 1–60) | not run (STOP, 5) | not run |
| B1's approach path c4 / c3 / c6 | 130 / 84 / 138: fight 122/84/132 solved vs off 91/83/128, **0** fight solved→refused | |

### 3. L18 sweep — PASS

`node scripts/procgen/sweep-seedling-l18-residues.mjs --fight --twice`: **45/45, 0 hits, every row the same twice, 0
certificates left**; every fight found at the kill's admission (one search per solve), median 29,718 expansions, max
54,079; median wall 6.4 s a solve (loaded; 3.5 s at the bucket-8 key).

| r | A4 | B1 | B2 | | r | A4 | B1 | B2 | | r | A4 | B1 | B2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 | 462 | 377 | 349 | | 15 | 449 | 366 | 362 | | 30 | 363 | 358 | 389 |
| 1 | 509 | 376 | 349 | | 16 | 445 | 366 | 362 | | 31 | 363 | 377 | 389 |
| 2 | 447 | 377 | 349 | | 17 | 492 | 366 | 349 | | 32 | 363 | 357 | 375 |
| 3 | 491 | 352 | 349 | | 18 | 445 | 360 | 395 | | 33 | 363 | 360 | 368 |
| 4 | 491 | 371 | 349 | | 19 | 445 | 363 | 411 | | 34 | 363 | 353 | 372 |
| 5 | 515 | 357 | 373 | | 20 | 445 | 375 | 368 | | 35 | 363 | 363 | 363 |
| 6 | 447 | 371 | 351 | | 21 | 445 | 363 | 403 | | 36 | 363 | 356 | 353 |
| 7 | 418 | 376 | 364 | | 22 | 445 | 398 | 362 | | 37 | 508 | 362 | 347 |
| 8 | 514 | 373 | 361 | | 23 | 446 | 365 | 366 | | 38 | 363 | 362 | 366 |
| 9 | 440 | 409 | 350 | | 24 | 446 | 374 | 373 | | 39 | 495 | 362 | 350 |
| 10 | 444 | 370 | 351 | | 25 | 446 | 363 | 365 | | 40 | 518 | 362 | 342 |
| 11 | 439 | 366 | 342 | | 26 | 456 | 367 | 351 | | 41 | 500 | 381 | 344 |
| 12 | 440 | 346 | 345 | | 27 | 456 | 354 | 391 | | 42 | 503 | 367 | 349 |
| 13 | 374 | 346 | 346 | | 28 | 379 | 362 | 385 | | 43 | 372 | 374 | 349 |
| 14 | 364 | 367 | 349 | | 29 | 364 | 406 | 368 | | 44 | 346 | 364 | 349 |

Mean **362.1 t** (A4 434.3, B1 367.6). Longer than B1 at 15 residues (18–21, 27–33 most), shorter at 28. The weight-2
order trades the earliest fight for search cost; at weight 1.5 the mean is 363.8 at 1.3× the expansions.

### 4. Spinner rooms, stagings, L40 — measured

| room (post-sword, `procgenOracle.solve`) | OFF | B1 ON | **B2 ON** | fight search |
|---|---|---|---|---|
| census chamber (5,5) | 269 | 213 | **214** | 11,580 exp |
| **(2,2)** | **515** | 141 | **188** | 6,382 |
| (7,6) | 210 | 180 | **198** | 1,009 |
| (3,6) | 160 | 165 | **186** | 1,070 |
| (2,7) | 264 | 153 | **186** | 8,905 |
| corridor | 193 | 269 | **223** | 20,262 |

(3,6) and the corridor are longer: the fight minimises the kill and its tail, not the walk to the goal after it.
- ENEMY census: the chamber spinner `THREW` (as at the base); the corridor spinner 226 → **256** t; `spinner@nub`
  351 → **308** t.
- Stagings, solved fresh ON: `r8-solve-18` 363 → **353** t (0 hits, 0 spinner contacts, `{18,0}@327`);
  `r9-solve-18` 518 → **342** t (0 hits; the chain 10,931 → 10,755; `r9-solve-19`'s declared clock 10478 → 10302).
- **L40** (5 spinners; survey step 82's boot view re-pointed at the L42 door (848,16), `--dash=none`, goal
  `collect:64,144`; `probe-seedling-solve-sites.mjs`; the view needed `survey-seedling-route.mjs --through=end
  --only=82` first, a fresh container has no survey cache): OFF **SOLVED 1,799 t in 62.0 s** (the `walk` site, 27 s
  in one stretch at t1277); ON **SOLVED 1,747 t in 18.2 s** — seven fight searches, 2.8 s in `hammer-fight`. On the
  big multi-body room the fight is CHEAPER than the switch-off path (whose `deriveStrike` re-derivations were the
  crusher report's 53 s).

### 5. Cost — ⛔ STOP: the capacity rows

| set | OFF | ON | note |
|---|---|---|---|
| L18 sweep, 45 first solves | median 3.3 s (A4) | median 6.4 s | loaded |
| row captures (the identity rows, wall) | killgate 2.8 / 6.6 / 8.0 s; ENEMY 7.3; acceptance 67.6; c3 146.4; c6 191.3; c4 160.6 | 10.8 / 7.1 / 4.9; 7.6; 62.4; **77.8**; **127.8**; 180.7 | same runs, loaded 2–6. c3/c6 are FASTER on (the switch-off path's per-tick `deriveStrike`), c4 +12 % (B1: +55 %) |
| re-solving the same records (search cost per certify solve) | c4 77 s / 138; c3 136 / 102; c6 158 / 170; capacity killgate **579 s / 885** | 98; 65; 99; **1,276 s** | the killgate rooms: +0.8 s a solve (one fight search) |
| **capacity killgate draw, seed 57** (`kg` trace: `generateGenRoom` + `placeGenItems(30)`) | 268 s, 51 re-rolls (grown) | **did not finish in 3,000 s**: 898 kill searches (852 found — median 12,411 expansions, max 92,909; **46 cut at 100,000**), **2,308 s in the search** | still re-rolling when the timeout stopped it |
| capacity killgate capture (seeds 53 + 57) | 521 s | **> 1 h 57 min**, stopped (1,651 spinner records captured, vs 885 for the whole OFF row) | |
| `seedlingGenCapacity.test.js` (fast) | passes (in the AFTER set) | **does not finish** (the ON unit run hit its 7,000 s cap inside it) | |
| `seedlingGenCapacity.slow` | B1: 502 s ON-approach, 466 s OFF (post-sword) | **not measured** | its post-sword census draws killgates; with one draw > 3,000 s it cannot stay inside 900 s |

Why: every executed kill is now a search (median ~12,000 expansions in these 10×10 rooms, ~1.6 s loaded) and a cut
one is 100,000 (~10 s); the capacity rows certify hundreds of kills per draw, and a draw whose kill gate certifies
keeps its tag and re-rolls (A3's mechanism) — on, the fight certifies MORE kills (refused → solved 8 of 885 here), so
the draws re-roll more. **The search was not shrunk to fit.** Levers for the planner (none landed): a generation-time
budget well below 100,000 (cuts are no claim, so the OFF path then runs), a latch across the certify solves of one
draw, or the fight only where the switch-off path refuses.

### 6. Movers with the flag ON (measured, not landed) — the list for a licence

| row | OFF | ON |
|---|---|---|
| acceptance | `76602ae8` | `98e36e51f67c4628f9ec90d4b2c87947` |
| empty pairs c3 / c6 | `4937da80` / `430573e9` | `a3a10568c4cda1fc380cb77957a73498` / `52316dfbb904adaca307983de02f5026` |
| carved pairs c4 | `b9d2185d` | `ef6e5024e49c93b04781cdea353f0512` |
| ENEMY census | `30bcc49c` | `b3fb45d304bb9630385bb2a546450c9c` |
| killgate s2 / s5 / s9 | `006b0639` / `7d4cb820` / `49e23d85` | `0997b5f02cf850bb3dd66fa68b0a4014` / `c091713482ccf4c6f4aae0cefc457fbd` / `168ceec120adbd15bc1eb83301a9be73` |
| maze, guard, AREA, levels pre/post s1 | — | unmoved |
| `solve-seedling-r8-l18 --check` | `465a8b46` exit 0 | `d31b7773` **exit 1**: `r8-solve-18` 363 → 353 t |
| `solve-seedling-r8-d2-chain --check` | `b76f6483` exit 0 | `5d20d712` **exit 1** (the headline's L18 part) |
| `solve-seedling-r9-campaign --check` | `13b8d51f` exit 0 | `12fd49a0` **exit 1**: `r9-solve-18` 518 → 342 t, the chain 10,931 → 10,755, `r9-solve-19`'s declared clock 10478 → 10302 and every window's boot after it |
| battery / tail / r9-l3 `--check` | — | unmoved |
| `plan-seedling-f1c-l18-phase --check` | `01ec5f9f` | `f1a07bb0` |
| `plan-seedling-hammer-a-escape --check` | `29891f04` | `8fcdea3a` |
| `plan-seedling-hammer-b1-approach --check` | `78925b77` | `78450c8e` (its approach solve is the fight's with both on) |
| the other 42 planner `--check`s (incl. `plan-seedling-hammer-b2-fight`, which toggles its own switch) | — | OFF = ON digest. `plan-seedling-r7-ends-meet` not run (its browser leg hardcodes :8000) |
| committed tape replays | — | none can move (a replay never consults the solver) |
| **unit rows (the 72-file set + `hammerFight`, ON)** | — | **25 rows in 12 files**: `fidelityF1c` 5, `solverSpinnerKill` 6 (the table in 4), `procgenScratchPersistence` 3, `hammerApproach` 2, `hammerEscape` 2 (their witnesses' solves are the fight's now), `hammerFight` 2 (its OFF-default rows), `procgenCorridorBody` 1, `procgenCountableClock` 1, `procgenPostSword` 1, `procgenRoam` 1, `watchGenOverlay` 1; and **`seedlingGenCapacity.test.js` does not finish** (5) |
| the JS arc's live L18 plan | 518 / 500 / 503 t (full) | 373 / 371 / 381 t (DASHLESS ships), see below |

**STOP here, as briefed.** The flag is OFF in head. A flip needs the licence for the list above AND a decision on 5.

### 7. The game witness — PASS (`a2fc5f7`)

A generated level (900) is no roster tape (none of the 258 is), so the room is L18's, as B1's:
`plan-seedling-hammer-b2-fight.mjs` (`--check` exit 0) solves `r9-solve-18`'s staging frozen at A's base
(`witness-bases/r9-solve-18.hammer-a.json`) at residue 40 with the switch on.

| tape | ticks | the fight | record | game re-play | model | game hits | crossing / clear |
|---|---|---|---|---|---|---|---|
| `hammer-b2-l18-fight40` | **342** (OFF 518; B1's witness 362) | one certificate at the admission (21,243 expansions, goal +207), six landings t55/114/166/168/203/205, 0 left | `--record`: ALL CHECKS PASSED | **23 PASS / 0 FAIL**, *"live game matches the committed oracle stream"*, `save.time` 10278 = model | **0 px** (`hammerFight.test.js`) | 0 | t342; `{18,0}@317` model-sourced |

Tape md5 `1b5d70cfc2bb77cf2464a02855feb6cb`, expectation `96c06c547d61a9b58cf5d11860937a57`. The NAME was grepped
across the test tree: roster 258 → **259** (`tapeEnvelope`, `observationTolerance` ×2, `dialogueAutoAdvance` ×2), and
the name unions `watchManual`'s kill-lock set and `r8Acceptance`'s L18 roster.

### 8. Mutants (predicted first; copy + restore in `/home/user/wt-b2-dbg`, `solverBot.js` md5 `61e868a5…` at both ends of the sweeps and record runs, `dc3acd71…` (the final code, the door import) at both ends of m2's unit run)

| mutant | predicted | measured |
|---|---|---|
| m1, the bodies' fight state dropped from the dedup key | no hit and no certificate left (every node keeps its own cursor, so a certificate stays exact); fewer nodes and other lengths; maybe a lost fight | **safety as predicted**: L18 45/45, 0 hits, 0 left. **Wrong on the cost**: MORE expansions (median 34,985 vs 29,718), mean 373.0 t (362.1); c4 solved 124 → **120**. Merging hit histories keeps one branch per key and discards the others' futures. No unit row is red: the key is a search-quality bound, caught by the measurement, not by a row |
| m2, the goal's post-kill window dropped (`tail` 0) | a B1-style corner after the last kill where bodies outlive the order (the fade, other bodies) | **exactly**: L18 **43/45** (r16, r19 refuse *"There is no step out"*), c6 one record SOLVED 238 → REFUSED, c4 solved 124 → 106. Unit rows (re-run on the final code, `dc3acd71` → mutant → `dc3acd71`): exactly two red — the certificate row (its tail) and the witness-solve row |

## D3 — records (PASS; `0a59586`)

| row | result |
|---|---|
| `seedling-bot-log.md` | `### Seedling hammer-phase B2 — the fight as one search` (the design, the two follow defects, the measurements, the movers, the cost STOP, two trap candidates) |
| `seedling-bot.md` | the press-kill paragraph gains `HAMMER_FIGHT` |
| surface | RED at head (site counts; a family file importing `bobBossFight.js` past the door) → the import goes through `solverView.js`; `--write`; two rows classified (`run:spinnerFightForecast` seedling/forecast, `import:shieldBumpTouches` seedling/geometry-query) → **GREEN 227** |
| constants / entities / profile | `--write` → **PASS 5,443** · PASS 528 · PASS 138 |
| reference | regenerated (four new instruments, the docs index): `--check` ALL 7 + 5 MATCH; `check-procgen-docs` ALL CHECKS PASSED |
| bounded vitest AFTER (flag OFF) | the 72 files + `hammerFight` = **73 files, 3,171 tests, 3,170 pass**; the one red was `boxLock`'s eight-taker race under a load of ~7, which passes alone (26/26). tapeRunner **575**, md5 `8635ad896d8032a29e22ad409ebd1838` (573 + the witness's 2) |
| `lintGateLabels` | 14/14 |
| the sweep | gains `--fight` and `--fight-bounds=<json>` |

## The JS arc's readings (nothing of theirs edited)

| reading | OFF (head) | ON |
|---|---|---|
| `jsRuntimeSolverCalibration.slow` | 5/5 | 5/5 (it does not see it) |
| `measure-seedling-l18-live-gap.mjs`, residues 40/41/42 at the shipped budget | **518 / 500 / 503 t (full)**, work 59/57/57 | **373 / 371 / 381 t, the DASHLESS pass**: that pass alone spends 114/139/137 units (the window is 85), so the full pass gets 1 unit, ⏱ `walk` / window |
| …unbudgeted (`count`) | the same | full 342 / 344 / 349 t, work 236/286/282 |

The fight's searches spend one unit per 250 expansions (~120 a solve on L18). If the flag ever turns on the JS arc
must re-calibrate (`SOLVER_UPGRADE_WINDOW_WORK`), or the live solve ships its dashless pass — still shorter than
today's.

## What a flip would need

1. The user's licence for the movers in D2.6 (re-records of `r8-solve-18`, `r8-d2`, the `r9` campaign chain from
   window 19, the three planners' tapes, the generated rows, 25 unit pins).
2. A decision on the generation cost (D2.5) — a lever measured on the capacity rows before any flip.
3. The JS arc's re-calibration for the fight's work units.

## Deltas

| row | base | head |
|---|---|---|
| code | — | `levelRun`: `spinnerFightForecast`, `forecastSwordTest` (lifted out). `solverBot`: `HAMMER_FIGHT`, `withHammerFight`, `HAMMER_FIGHT_BOUNDS`/`_MEASURED`/`_TRACE`, `deriveFight` (exported), `fightHeld`, `fightStrike`, `landsClearInFlight`, `safeStep`'s landing test a parameter, the follow in `execKillByPress`, the admission in `derivePressKill`, the `hammer-fight` site. `spaceTimeReach`: `bestFirstQueue`. `solverView`: `shieldBumpTouches` |
| byte-inertia (flag OFF) | — | identity block at `a2fc5f7` = base on every row; six `--check`s = base; the sweep 45/45 = A4's table (`--twice`) |
| tests | — | `hammerFight.test.js` (9 rows); the `DEADLINE_SITES` pins (`solverDeadline`, `hammerEscape`, `hammerApproach`, `fidelityLadder2`); the roster pins |
| tapes | 258 | **259** (`hammer-b2-l18-fight40` + expectation; index) |
| instruments | — | `check-seedling-hammer-monotonicity.mjs` (+ its hook and loader), `dump-seedling-gen-capacity.mjs`, `plan-seedling-hammer-b2-fight.mjs`; the sweep's `--fight`, `--fight-bounds` |
| surface | GREEN 225 | GREEN 227 |
| constants | 5,432 | 5,443 |
| bounded vitest | 72 / 3,149 | 73 / 3,171 |

## What the brief got wrong (measured)

1. **"best-first on (tick + an admissible lower bound)"**: admissible A* is 133k expansions (24 s) at L18 r40 and,
   with a coarse dedup, not even the earliest (weight 1.5 found an earlier goal). Weight 2 is what fits; it is a
   heuristic and is called one.
2. **"Dedup key = … (hits, i-frame bucket)"**: the best i-frame bucket measured is the coarsest (running or not);
   finer buckets made the fights LONGER (380.7 t at 8 ticks, 374.3 exact, 362.1 running-or-not).
3. **"Prune = the escape's predicate"** is not enough where the player carries a shield: the forecast cannot carry
   the bump, and six of B1's seven are post-shield rooms. Without the no-bump prune the fight made no claim in all six.
4. **"the executor FOLLOWS it (still under `safeStep`)"**: `safeStep`'s plain forecast refuses the certificate's own
   train (a landing in flight). It needed the in-flight variant.
5. **"from the run's state when the kill starts"**: the admission is not always asked of the executing run; a
   certificate equal in state and bodies can carry another run's clock.
6. **"Node = (… the press window in flight / `lastPressAt`)"**: with the train stood, no node holds a window in flight
   (the press macro absorbs it); `lastPressAt` matters only as the dash bucket.
7. **"A GAME witness: one of B1's seven records' rooms"**: no generated level is a roster tape; the witness is L18's.
8. **"`seedlingGenCapacity.slow` (must stay comfortably inside 900 s)"**: not reachable — one killgate draw alone did
   not finish in 3,000 s ON.
9. B1's ENEMY digest `0d3262f6` is not this base's: main moved ENEMY to `30bcc49c` at the wave-9 harvest.

## Residue

| # | item | owner |
|---|---|---|
| 0 | I removed a running re-solve's temp directory by a glob cleanup (`rm -rf /tmp/b2-mono-*`); recovered by re-creating the two shard directories from their argv before they wrote, and the instrument now removes its own (no data lost) | — |
| 1 | **The generation cost** (D2.5): the capacity rows do not finish ON. Levers listed there, none measured | planner / B3 |
| 2 | The capacity census rows (pre/post, seeds 1–60) were not captured for monotonicity (STOP) | with 1 |
| 3 | B1's `approachHeld` compares the state only, not the clock (the same hole as D1's defect 2) | B1's code, if B1 is ever flipped |
| 4 | (3,6), the corridor and the ENEMY corridor spinner are longer ON: the fight optimises the kill + tail, not the walk to the goal after it | a later design |
| 5 | The JS arc's live gap reopens ON (the dashless pass ships) | JS arc, if flipped |
| 6 | ENEMY's chamber spinner `THREW` at the base (*"live spinners AND a DIALOGUED ceremony"*) — pre-existing | fidelity arc |
| 7 | `boxLock`'s eight-taker race failed once under a load of ~7 (passes alone) | — |

## Byte-inertia

- **Not touched:** AS3, wasm, any gitlink, rules, the JS arc's files, `chooseBodyToRemove`, the ghost-sword press
  model, the crusher bait.
- **No committed tape moved**; the only tape changes are the new witness's.
- **No producer `--check` digest moved** with the flag OFF (identity block at `a2fc5f7`; the later door import is the
  same binding).
- **Not run:** `standing-values --write`, `pytest`, the unfiltered local vitest (⚖ 52). `git stash` was not used.
- **Kills:** by PID only (the chain, three profiles); no pattern kill.
- **Mutants and traces:** in `/home/user/wt-b2-dbg`, copy + restore, md5 `61e868a5…` / `dc3acd71…` at both ends.
- **Scratch only, never committed:** `/tmp/claude-0/sp` (`dbg*.mjs`, `rooms.mjs`, `kg*.mjs`, `sum.js`, sweeps' JSON),
  `/tmp/claude-0/mono*` (captures and re-solves), the two worktrees.

## Rows to BANK

- **Nothing moved with the flag OFF**: the base rows are re-confirmed at head (acceptance `76602ae8`, c3 `4937da80`,
  c6 `430573e9`, c4 `b9d2185d`, ENEMY `30bcc49c`, killgate `006b0639`/`7d4cb820`/`49e23d85`, producers
  `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 13b8d51f`).
- **New:** roster **259**; `plan-seedling-hammer-b2-fight --check` exit 0; the sweep `--fight` 45/45, 0 hits, mean
  362.1 t; surface GREEN 227; constants 5,443; entities 528; profile 138; tapeRunner 575 `8635ad89…`.
- **For a licence (ON, not banked):** the movers table in D2.6.

