# seedling-dash-shape — the cheaper dash search, behind three OFF switches

Slice DB of the HAMMER-PHASE planner (`seedling-hammer-phase-planning`), cloud, Opus. ⚖ The user (2026-10-16):
*"Build the best shape, OFF"*. This slice builds the three SOLVER pieces of DS's verdict in `solverBot.js`, every one
OFF. The window piece is js-6's (`jsRuntimeSolver.passShouldStop`). No default moved, nothing was re-recorded, and no
file of js-6's or fidelity's was touched. Evidence: [`seedling-dash-shape-evidence/`](./seedling-dash-shape-evidence/).
Log: `seedling-bot-log.md` § *Seedling DB — the cheaper dash search, OFF*.

| | |
|---|---|
| Start SHA | `dab1994e58` (`origin/main` at checkout, = the brief's floor; `evidence/w0/sha.txt`) |
| Head | the commit carrying this report. Before it: D1 `f0b5df33`, D2 `8f60780d`, D3 `1f18b250` |
| Branch | `claude/seedling-dash-shape-y88jnb` (the harness names it; the brief's `seedling-dash-shape`). Nothing went to `main` |
| Verdict | **W0 PASS · D1 PASS · D2 PASS · D3 PASS.** The built switches reproduce DS's lab exactly, in ticks and units, on every row |

## The one thing to know first

**No switch reaches the page today, and none of the three will reach it until js-6 builds a request stamp for them.**
- The browser has no `process`, so `SEEDLING_DASH_*` never applies there. Measured in Chromium against this tree: all
  three read `false` whatever the URL says.
- The worker takes only three switch sets off a request: `killLockBodies`, `contactFidelity` and
  `axeDodgeAskPerPreview`. Measured on the committed 478:0 fixture: a request carrying `dashLegPrecheck`, `dashShape`,
  `DASH_LEG_PRECHECK` or `SEEDLING_DASH_LEG_PRECHECK` solves byte-identically to one without (work 642), while the env
  in node gives 49.
- **What js-6's stamp needs** (the `axeDodgeAskHook.js` pattern): one off-default field, e.g.
  `dashShape: {legPrecheck, noSwingPrefix, keepPartial}`. The page / sweep sets it, and the worker runs the solve
  inside `withDashLegPrecheck(…, () => withDashNoSwingPrefix(…, () => withDashKeepPartial(…, solve)))`. Every answer
  is stamped with what the instance read. The `with…` functions exist and restore on a throw. Nothing was built in
  js-6's files.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B <branch> origin/main` → `dab1994e58` |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`, node v22.22.0. **Six** submodules were `-` after `READY` (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); each `git submodule update --init`. Server `serve-nocache.py 9590` (PID 894, killed at the end) |
| on the base? | **CORRIDOR (`corridorBodyPricing`) is NOT on the base** (0 hits). **js-6's window slice is NOT** (`passShouldStop` unchanged; no `upgrade_window_work`). SPINNINGAXE (`partialDodgeReprobe`, OFF) and L40CONTACT (`chaserSpinnerWalls`, OFF) ARE, since DS |
| defaults | budget 640, window 85, backstop 300 s, fine checkpoints ON, passes `dashless` (`none`, stop `all`) → `full` (`all`, `adds: sword-dash`, stop `window`). `PREVIEW_AGREEMENT_BOUND` 195, `DEFAULT_DASH_MODE` `all`, `HAMMER_ESCAPE` ON, `HAMMER_APPROACH` / `HAMMER_FIGHT` OFF, `PRESS_KILL_DONE_ON_WALK` ON, `STRIKE_ETA_FLOOR` OFF, `STRIKE_PREVIEW_CAP` 16, `SWORD_GATE_TIMED` ON, `AXE_DODGE_ASK_PER_PREVIEW` ON (`evidence/w0/defaults.txt`) |
| identity block | `SEEDLING_PORT=9590 identity-block.sh .` (`evidence/w0/identity.txt`): **equal to DS's W0 row for row**. Maze `57e07d21`, acceptance `933c14f7`, c3 `4937da80`, c6 `430573e9`, c4 `b9d2185d`, ENEMY `36b59445`, guard `a6d18d49`, AREA `02b22525`, killgate `006b0639 / 7d4cb820 / 49e23d85`, levels `e28c1e5d / fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c`, all exit 0 |
| tapeRunner pairs | sorted `status\tfullName`, `\n`-joined: **611**, `75a3c41f0c91f6e71953e82d8259dc60` |
| surface / constants / entities / profile / roster | GREEN **307** · PASS **5,988** · PASS **566** · PASS **138** · **277** (`evidence/w0/censuses.txt`) |
| bounded vitest BEFORE | 19 files: every non-slow test `rg -a` finds naming `planSwordDash`, `dashPrefixesFor`, `PREVIEW_AGREEMENT_BOUND`, `swordDash` or `sword-dash`, plus `fidelityDash`, `solverDeadline`, `jsRuntimeSolverAnytime`, `jsRuntimeSolverShouldStop`, `solverBot*`, and `tapeRunner` for the pairs: **1356 / 1356** |
| DS's battery at this base | DS's own `lab.diff` + runner on the 617 requests (captures re-downloaded: 834 legs, 870 requests): today 110,216 t / 34,936 u; window 0 87,704 t / 77,780 u; `cheap2` 107,927 / 32,901 at 85 and 87,429 / 59,015 at 0. **Equal to DS on every tick and unit.** Only the walls moved (this box ran at load ~7, DS's at 3–5; `evidence/w0/battery-w0.txt`) |

**What moved since DS:** in the solver, only SPINNINGAXE D2's partial re-probe (OFF) and L40CONTACT's `levelRun` arm
(OFF). Neither moves a tick or a unit of the population.

## D1 — three switches, OFF (PASS)

**The names (final; no rename since the brief):** all in `solverBot.js`, beside `DASH_CHAIN_PREFIXES`.

| switch | env (node only) | test helper | what ON does |
|---|---|---|---|
| `DASH_LEG_PRECHECK` (+ `DASH_LEG_PRECHECK_MARGIN` = 40, and `dashLegPrecheck(legs)`) | `SEEDLING_DASH_LEG_PRECHECK=1` | `withDashLegPrecheck` | `planSwordDash` refuses a corridor whose UNDASHED longest leg is > 195 + 40 = 235, before any preview. `why` opens `DASH_LEG_PRECHECK: the UNDASHED walk's longest leg is N tick(s), past PREVIEW_AGREEMENT_BOUND 195 + DASH_LEG_PRECHECK_MARGIN 40 = 235 …`, and `scanned` is 0 |
| `DASH_NO_SWING_PREFIX` | `SEEDLING_DASH_NO_SWING_PREFIX=1` | `withDashNoSwingPrefix` | `dashPrefixesFor('all')` drops `[0]`, for the sword and the ghost sword (derived sets, `length > 1`); `full` / `none` unchanged |
| `DASH_KEEP_PARTIAL` | `SEEDLING_DASH_KEEP_PARTIAL=1` | `withDashKeepPartial` | a `sword-dash` trip returns the plan of the windows already accepted, with `kept: 'deadline'`. None accepted → `deadline` refusal as before |

- **The `sword-dash` progress site and its deadline kind are untouched.** js-6's window counts exactly those asks.
- **The pre-check reads the baseline the scan already previews**, so it costs no preview and no ask. It sits AFTER the
  stall refusal, so a stalled corridor keeps its old reason. DS's lab asked it first; ticks and units are the same
  either way (D2).
- **The keep is a refactor of the final return into `planOf(kept)`.** OFF and untripped, the result is byte-identical
  (a gate row compares JSON). The in-flight start tick's candidates are not kept.
- **`solverView.js`: not touched.** It is the solver's door to SIMULATION symbols, and the switches import none.
- **OFF is byte-inert** (`evidence/d1/`): the identity block at D1 equals W0 row for row, all six `--check`s included.
  tapeRunner pairs are 611 `75a3c41f`.
- **Page reach:** none, measured (*the one thing to know first*; `evidence/d1/page-reach.txt`).

**Gate rows: `hammerDashShape.test.js`, 17 rows, ~2 s.** Named `hammer*` because this is a hammer-phase slice, so the
arc's bounded set (`hammer*`) picks it up. Every solve row carries an explicit timeout (60 s; the whole-solve row 120 s).
- ships OFF (each, `skipIf` its env is set); `with…` sets, restores, and restores on a throw (each).
- the margin: 40 over 195, `dashLegPrecheck` at 235 → null, 236 → the named refusal; OFF always null.
- (i) on a REAL corridor: request 478:0 of sweep `38845773709`, committed as `fixtures/dash-shape/sweep-478-l52.json`
  (its staging, `live`, goal and the records of L52 and L56: 7.8 KB). A waypoint at (148,116) walks an undashed leg of
  exactly **235**, at (148,115) exactly **236**. The row measures them first.
  - ON at 235 scans exactly as OFF (JSON equal).
  - ON at 236: `plan: null`, `scanned: 0`, the named `why`, and its only deadline ask is the entry.
- (i) the whole solve of 478:0 (budget 640, window 0, as DS replayed it): the same solution ON and OFF, ON's work lower
  (642 → 49 measured), and OFF's full pass cut by the budget at `sword-dash`.
- (ii) `all` lacks `[0]` and keeps the rest (sword and ghost); `full` / `none` unchanged; OFF is `DASH_CHAIN_PREFIXES`
  itself. On the L0 corridor no candidate is swing-only, and `prefixes` reads 3.
- (iii) on `r9-solve-0`'s first corridor (L0; its committed trace: 7 windows, 64 previews, 237 → 145 t), with a
  counting deadline handed to `planSwordDash` directly:
  - a trip inside the 3rd window's start tick, after one of its candidates certified: ON ships exactly the first 2
    windows, at the 2nd accepted candidate's ticks; OFF drops all;
  - a trip before any acceptance still refuses;
  - an untripped ON scan is OFF byte for byte;
  - a deadline that trips `kill-chaser` first (L14's stance rung, asked inside the same deadline) and never
    `sword-dash` leaves the scan whole and the schedule kept as OFF.

**Mutants (`evidence/d1/mutants-rows.txt`): 9 applied, 9 caught.**

| mutant | caught by |
|---|---|
| K = 41 / K = 39 | the margin row + the 235/236 corridor row |
| `<` for `<=` (236 → 235 boundary) | the same two |
| the pre-check reading the DASHED walk (per candidate) | the 236 corridor row (`scanned` 2, not 0) |
| `[0]` dropped from every mode (`full` `.slice(1)`) | the (ii) set row. The literal "filter `length > 1` in every mode" is an equivalent mutant: `full` has no `[0]` |
| keep on a non-`sword-dash` trip (the latch, not the ask) | the `kill-chaser`-first row |
| keep a window not yet certified (the asked pattern) | the k-windows row |
| keep the in-flight certified best | the k-windows row |
| keep with zero windows | the before-acceptance row |

## D2 — measured ON, alone and together (PASS)

### The replay battery

DS's 617 requests, built switches, `db-run.mjs` (`replayOnce`'s dispatch). The dash-only window is DS's, in a scratch lab
only (`evidence/tools/lab.diff`, `LAB_DASH_WINDOW`), never committed. Box: 4 cores, jobs 3, load 6–8 (identity and
producer runs alongside). Table: `evidence/d2/battery.txt`. Today = OFF@85, window 0 = OFF@0.

| row | win | ticks | % of w0's savings | better / **worse** vs today | Δ units | Δ node wall | worst Δ | = DS? |
|---|---|---|---|---|---|---|---|---|
| OFF (today) | 85 | 110,216 | 0 | — | 0 | 0 | — | = |
| OFF (window 0) | 0 | 87,704 | 100 | 170 / 0 | +42,844 | +584 s | +38.1 s | = |
| (i) leg pre-check | 85 | 110,216 | 0 | 0 / 0 | −228 | +0.5 s | +1.6 s | = |
| (i) leg pre-check | 0 | 87,704 | 100 (identical) | 170 / 0 | **+32,387** (−10,457 vs w0) | +312 s | +21.8 s | = |
| (ii) no `[0]` | 85 | 107,927 | 10.2 | 25 / 0 | −1,807 | +12 s | +3.5 s | = |
| (ii) no `[0]` | 0 | 87,429 | 101.2 | 173 / 0 | +34,536 | +525 s | +40.1 s | = |
| (iii) keep | 85 | 110,216 | 0 | 0 / 0 | 0 | +14 s | +2.0 s | (new) |
| (iii) keep | 0 | 87,704 | 100 | 170 / 0 | +42,844 | +601 s | +38.1 s | (new) |
| `cheap2` = (i)+(ii) | 85 | 107,927 | 10.2 | 25 / 0 | −2,035 | −16 s | +3.2 s | = |
| `cheap2` | 0 | 87,429 | 101.2 | 173 / 0 | +24,079 | +245 s | +17.7 s | = |
| all three | 85 / 0 | = `cheap2` | | | | | | (new) |
| lab dash-only window 85 alone | 85 | 104,133 | 27.0 | 64 / 0 | +17,084 | +210 s | +8.1 s | (new) |
| lab dash window 85 + keep | 85 | 94,359 | 70.4 | 165 / 0 | +16,773 | +191 s | +8.8 s | = DS `dw85keep` |
| **all three + lab dash window 85** | 85 | **92,741** | **77.6** | **166 / 0** | **+12,345** | +94 s | +7.3 s | = DS's combined row |

- **Every DS row reproduces in ticks and units, to the unit.** The walls differ: this box's load was 6–8 against DS's 3–5.
  The units are deterministic and the walls are one loaded box's.
- **(iii) alone does nothing at today's window**: the window trips every site, so a kept schedule meets the next
  `walk` ask and the segment refuses as before. At window 0 there is no window. Its effect exists only with the
  dash-only window: 27.0 % → 70.4 % of window 0's ticks.
- **(iii) through a direct deadline** (`evidence/d2/keep-direct.txt`, L0 corridor, 237 → 145 t untripped). A trip
  after 5 / 10 / 20 / 30+ asks keeps 1 / 2 / 4 / 6 windows: 217 / 199 / 179 / 153 t. OFF ships 237 t at every trip.

**Timings** (`evidence/d2/timing.txt`). Three interleaved rounds, jobs 1, load 0.9–2.0, on the six heaviest window-0
requests (L40 from L39: 384–394) plus 108:0 and 298:0. Σ solve s, median / min:

| config | Σ median / min | e.g. 387:0 | 108:0 |
|---|---|---|---|
| today (OFF@85) | 14.7 / 13.4 s | 1087 t, 1.75 s | 561 t, 0.77 s |
| all three + dash window 85 | 18.6 / 15.2 s | 1087 t, 4.27 s | **328 t**, 1.11 s |
| `cheap2` @ window 0 | 18.6 / 16.0 s | 1087 t, 3.62 s | 328 t, 1.30 s |
| OFF @ window 0 | 138.8 / 128.2 s | 1087 t, 28.63 s | 328 t, 1.52 s |

The pre-check takes window 0's L40 pits from ~28 s to ~4 s for the same ticks.

### In place: every committed producer and identity row, each switch ON

Scratch worktree at the D1 tree; each switch by its env. The identity block ran OFF in the same worktree as the
control: there the `generated set` row needed the primary's venv and the reference row read "4 differ" at OFF too, so
neither is a switch effect. Then all 61 `plan-seedling-*.mjs --check`s OFF / (i) / (ii), and the dd-walkkill producer
with (iii) (`evidence/d2/plans.txt`, `identity-*.txt`, `movers/`). **Nothing was re-recorded.**

| switch | identity rows that move (before → after md5) | what moves under them |
|---|---|---|
| (i) leg pre-check | `r9-campaign --check` `6b1bf15c` → `e900dde2` | **one trace sidecar, `r9-solve-12`** (its walk at t1897, baseline 556). No tape, no SOLVE gained or lost |
| (ii) no `[0]` | ENEMY census `36b59445` → `50056d39`; battery `405d9c4b` → `da331da7`; d2-chain `b76f6483` → `f4e974de`; l18 `465a8b46` → `446c1126`; campaign `6b1bf15c` → `29a51038` | **one tape re-plans: `r9-solve-16` 655 → 646 t (−9)**. The campaign sum goes 10,825 → 10,816, and `r9-solve-18`'s seam-time oracle follows (declared 9912, derived 9903). Traces: `r8-solve-11` (battery); `r8-d2`, `r8-d2-19`, `r8-d2-20` (d2-chain); `r8-solve-18` (l18); campaign: `r8-solve-10`, `r9-solve-0/0-v3/2/3/11/12/13/13-v2/14/15/16/18/19/20/21/22/29/30/31/32`. `plan-seedling-pushblock-witness` (already red at the base) replays 346 → 345 observations. No SOLVE gained or lost |
| (iii) keep | **none** (all rows equal the OFF control) | nothing: no committed solve trips `sword-dash` (the one producer with a deadline, `hammer-dd-walkkill`, trips only `kill-chaser`; its `--check` ON is green) |

**The other 61 producers:** ON equals OFF byte for byte under (i) and (ii), except `pushblock-witness` above.
- **12 are red at OFF, and red identically at the pristine base `dab1994e58`** (`evidence/d2/base-reds.txt`):
  axe-witness, bobsoldier2, f1-l5-open-lock, l30keylock, ladder2-witness, pushblock-witness, r9-l0-sword-dash,
  r9-l6-sword-dash-hit, stance-witness and u10-puncher-dwell (DRIFT); `l40button-witness` (throws in
  `lobberHoldRefusal`); `r7-ends-meet` (throws in `latchOf`).
- The two throwers fail before any check, so they cannot witness either switch. The two sword-dash producers are
  drift-red at the base, so their ON output equals their OFF output but their `--check` cannot go green either way.

### The flip table, per switch

| flip | re-records | sweep legs (divergence-sweep keys whose ticks move at window 85) | gate rows to re-pin |
|---|---|---|---|
| (i) `DASH_LEG_PRECHECK` | the `r9-solve-12` trace (campaign producer). No tape | **none** (ticks move on 0 keys; units on 16) | `hammerDashShape` "ships OFF" |
| (ii) `DASH_NO_SWING_PREFIX` | tape `r9-solve-16` (−9 t) and `r9-solve-18`'s seam; the 26 traces above; ENEMY census; the 5 identity md5s; `pushblock-witness` (red at base) | **25 keys**, all shorter: `12:0 20:0 166:0 257:0 283:0 288:0 312:0 344:0 374:0 421:0 429:0 437:0 441:0 443:0 494:0 512:0 516:0 547:0 552:0 553:0 580:0 610:0 679:0 680:0 800:0` | ⚖ ruling 45(b)'s rows that read `dashPrefixesFor('all')`; `hammerDashShape` "ships OFF". A re-record is a ⚖ 40 checkpoint event |
| (iii) `DASH_KEEP_PARTIAL` | nothing in place | none alone. With js-6's dash window: **166 keys** shorter, none worse (`evidence/d2/sweep-keys.txt`) | `hammerDashShape` "ships OFF"; js-6's own window pins (`jsRuntimeSolverAnytime` / `ShouldStop`, `jsRuntimeSolverCalibration.slow`, `flashPanelSolverBudgetSettings`, the `seedling-dash-window` feature check) |

**Dispatches for the planner** (cloud CI returns 403):
- after js-6's stamp lands and on a scratch branch with the flips, `seedling-divergence-sweep.yml` (`capture_requests=true`,
  `shards=10`, plus js-6's `upgrade_window_work`) compared by key against run **38845773709**. Expected keys: the table
  above;
- `test-substrates-manual.yml` with `batch=feature-checks` (`seedling-dash-window`, once the window flips);
- the suite number at the pushed head: `node scripts/procgen/ci-vitest-summary.mjs <sha> --wait`.

## D3 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling DB — the cheaper dash search, OFF` |
| as-built | `seedling-bot.md`: *The cheaper dash search* (after the SF paragraph) |
| surface / constants | `--check` GREEN **307** · PASS **5,988**, 0 drift; no `--write` or `--profile-rows` needed: neither census tracks the new exports or the 40 (the surface census is the door to the simulation; the constants census counts simulation literals) |
| entities / profile / roster | PASS 566 · PASS 138 · 277 (`evidence/d3/censuses-after.txt`) |
| reference | `generate-procgen-reference.mjs` then `--check`: **ALL 7 + 5 MATCH**. `scripts/quicklaunch/generate-docs-index.mjs`: 176 docs |
| bounded vitest AFTER | the W0 set + `hammerDashShape` + `boxLock`, `seedlingConstantsCensus`, `procgenDocs/generated`, `docLinks`, `docsRender`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`, `checkProcgenHelp`: **29 files, 1647 / 1647**; tapeRunner pairs 611 `75a3c41f` |
| not run | pytest, unfiltered vitest (⚖ 52), `standing-values --write`, any re-record, any CI dispatch |

## The deltas

| | W0 | head |
|---|---|---|
| identity block / six `--check`s | DS's | = (switches OFF) |
| tapeRunner pairs | 611 `75a3c41f` | 611 `75a3c41f` |
| surface / constants / entities / profile / roster | 307 / 5,988 / 566 / 138 / 277 | = |
| bounded vitest | 19 files, 1356 / 1356 | 29 files, 1647 / 1647 |
| code | — | `solverBot.js` (+118 −21: the three switches, the margin, `dashLegPrecheck`, the pre-check, the keep, `planOf`), `hammerDashShape.test.js`, `fixtures/dash-shape/sweep-478-l52.json` |

## What the brief got wrong (measured)

1. *"`CC/docs/cloud-reports/seedling-dash-economics.md` and its evidence"* are not on `main`. They are only on
   `claude/seedling-dash-economics-9383bx` (`77904659`), and were read from there.
2. *"(ii) is expected to re-plan committed tapes (§42.7 counts 205 dashes on 16 tapes)."* It re-plans **one**,
   `r9-solve-16` (−9 t). The rest of its reach is trace text (`scanned`, the per-kind counts), 26 sidecars.
3. *"(i) is expected to move a few sidecars' trace text."* It moves **one** (`r9-solve-12`), and no tape.
4. *"A trip at any OTHER site still drops the schedule ON."* Inside `planSwordDash` only `sword-dash` is ever asked:
   `certify` is `probeSamples` without `walkCheck`. So another site's trip cannot happen during the scan. The row
   therefore latches another site (`kill-chaser`) BEFORE the scan inside the same deadline. There the scan runs whole,
   which is what the mutant breaks.
5. *"Constants `--profile-rows` first if a literal lands, e.g. 40."* The constants census does not count `solverBot.js`
   literals: 5,988 before and after, GREEN without `--write`.
6. *"Wire each switch through `solverView.js` only if the import closure needs it."* It does not: the door carries
   simulation symbols, and the switches import none.
7. DS's L26 corridor (298:0, leg 234) is not a usable boundary fixture. On a run built from its staging the same
   corridor measures 224, and that shaft tops out at 229. L52 (478:0) gives exact 235 / 236 legs at integer waypoints.

## Residue

1. **Page reach is js-6's.** No stamp exists for solver switches (*the one thing to know first* names the shape).
2. **The keep's mark stops at `planSwordDash`.** The result carries `kept: 'deadline'`, but `walkTo`'s trace row
   (`swordDash`) copies named fields only, so a kept partial plan reads `planned: true` there. The segment's own
   `deadline` report still says `sword-dash` tripped. Adding the key to the row is in `walkTo`, outside this slice's
   region.
3. **K = 40 is calibrated on one population, not proved.** It does not change the 617's ticks, and a proof would bound
   the largest saving one window can make on one leg.
4. **12 `plan-seedling-*` `--check`s are red at the base** (above). Two throw before any check
   (`l40button-witness`, `r7-ends-meet`), and both sword-dash producers are drift-red. No CI job runs them, so their
   reds predate this slice.
5. **The generated-set row was not measured ON**: the scratch worktree lacked the venv (its OFF control, with the venv,
   was OK). The reference "4 differ" in that worktree is an artifact: it reads the same at OFF there, and ALL MATCH in
   the primary tree.
6. **Walls are one box's**: load 6–8 in the battery, 0.9–2.0 in the timing rounds. Units are the measure.
7. **Tree hygiene.** The scratch worktrees (`ip`, `base`, `/home/user/dash-dev` and its branch `db-dev`) and the lab
   copies (`lab`, `dslab`) were removed by name. The server (PID 894) was killed by PID. The captures stay in
   `/tmp/claude-0/caps` (not in the tree).
