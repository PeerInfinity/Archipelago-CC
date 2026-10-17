# seedling-dash-flip — the cheaper dash search, flipped ON (built, measured, NOT landed)

Slice DF of the hammer-phase planner (`seedling-hammer-phase-planning`), cloud, Opus. ⚖ The user (2026-10-16):
*"Prepare the flip"*. Three defaults go ON together: DB's `DASH_LEG_PRECHECK` (i) (K = 40) and `DASH_KEEP_PARTIAL`
(iii) in `solverBot.js`, and js-6's `dashOnlyWindow` in `dashOnlyWindowHook.js`. `DASH_NO_SWING_PREFIX` (ii) stays
OFF (⚖ 45(b)). Evidence: [`seedling-dash-flip-evidence/`](./seedling-dash-flip-evidence/). Log:
`seedling-bot-log.md` § *Seedling DF — the cheaper dash search, flipped ON*. Nothing went to `main`.

| | |
|---|---|
| Start SHA | `1153cf0d1e` (`origin/main` at checkout; it carries §5.87, i.e. `dashShape` in `stampHooks`) |
| Head | the commit carrying this report. Before it: W0+D1 `614f6c8c`, D2 `465e5d60`, D3+D4 `a4ec6710` |
| Branch | `claude/seedling-dash-flip-ih4lx5` (the harness named it; the brief's `seedling-dash-flip`) |
| Verdict | **W0 PASS · D1 PASS · D2 STOP (on (i)) · D3 timings PASS, dispatches named · D4 PASS** |

## The one thing to know first

**The leg pre-check (i) makes a committed tape 217 ticks longer.** At the flipped defaults the producer
`plan-seedling-axe-witness` re-plans `axe-l48-reach-l49` from **368 t to 585 t**.
- That corridor's undashed walk has a longest leg of **305 t**. With (i) OFF, the dash scan accepts **eight** windows,
  which bring every leg under 195 and save 218 t (`evidence/d2/axe-corridor.txt`). With (i) ON the scan refuses the
  corridor unscanned: `DASH_LEG_PRECHECK: … longest leg is 305 tick(s), past … = 235`.
- K = 40 came from "the largest saving ONE window made was 98 t". But windows **compound** on the same leg, so a
  per-window margin is not a per-leg bound.
- DB could not see this. `axe-witness` was drift-red at DB's base (fidelity PRODUCERS fixed it since), so its (i)
  move was invisible.
- Only (i) moves it: `SEEDLING_DASH_LEG_PRECHECK=0` alone restores 368 t. Keep-partial and the dash-only window
  each leave the 585 t when turned off alone (`evidence/d2/axe.*.txt`).
- **I did not re-record it**, because that would commit a slower tape. So `plan-seedling-axe-witness --check` and
  `solve-seedling-r9-campaign --check` (the `r9-solve-12` trace, also (i)'s) are **red at this head** until the user
  rules.
- But (i) is not free to drop either. Over the 617 requests it changes **no tick**, while it **halves the L40 pits'
  solve time** (D3).

The user's choice is in *the table for the user* below.

## W0 — the base (PASS)

| row | result |
|---|---|
| base | `git fetch origin main && git checkout -B <branch> origin/main` → `1153cf0d1e`. `dashShape` is in `stampHooks` (`jsRuntimeSolveService.js:73`) |
| bootstrap | `session_bootstrap.sh --seedling`: `READY`, node v22.22.0. Six submodules were `-` after READY (bulletml-dodge, cavernous-ii, journey-to-ascension, omsi-loops, swfRecompilerPanel/browser, textAdventureEngine); each `git submodule update --init`. Server `serve-nocache.py 9592`, PID 699 |
| defaults | `DASH_LEG_PRECHECK` / `DASH_NO_SWING_PREFIX` / `DASH_KEEP_PARTIAL` / `DASH_ONLY_WINDOW` all OFF; K = 40; budget 640, window 85 (`df-run`'s `defaults` field, `evidence/d1/battery.jsonl.gz`) |
| identity block | `SEEDLING_PORT=9592 identity-block.sh .`: **equal to DB's row for row** (maze `57e07d21` … levels `e28c1e5d / fb1a59e5`, generated set OK, reference ALL 7 + 5 MATCH; `evidence/w0/identity.txt`) |
| six `--check`s | `405d9c4b b76f6483 465a8b46 35456fbc 6cd35fe1 6b1bf15c`, all exit 0 |
| tapeRunner pairs | **611**, `75a3c41f0c91f6e71953e82d8259dc60` (= DB) |
| surface / constants / entities / profile / roster | GREEN **308** · PASS **6,000** · PASS 566 · PASS 138 · **277**. DB had 307 / 5,988: both grew with §5.84 / §5.87 |
| 61 producers | **all 61 `plan-seedling-*.mjs --check` exit 0** (HK's claim holds; `evidence/w0/plans.txt`) |
| bounded vitest BEFORE | 22 files: the brief's set plus every test of a file that reads the flipped defaults (`dashShape`, `dashOnlyWindow`, `seedlingWasmPlayback`, `seedlingPlaybackController`, `seedlingSolveDemo`, `jsRuntimeSolveService`, the five `seedlingDivergence*`). **1400 / 1400**. `jsRuntimeSolverCalibration.slow` alone: 5 / 5 |

## D1 — the battery at the three-switch combination, before any flip (PASS)

DB's 617 requests of sweep `38845773709` (captures re-downloaded: 10 shard artifacts). Runner: `df-run.mjs`, i.e.
`replay-seedling-solve-request.mjs`'s `replayOnce` dispatch. Stamps go on a **copy** of each restored request.
Built tree only, no lab code. One fresh process per (request, window), jobs 3, load 4–10 (W0 ran alongside).
- **The base is faithful:** OFF@85 and OFF@0 equal DB's rows on **617 / 617** requests, in ticks and in units.
- **Every ON answer reads** `dashShape {legPrecheck: true, noSwingPrefix: false, keepPartial: true}` and
  `dashOnlyWindow: true`.

| row | ticks | % of window 0's savings | better / **worse** vs today | Δ units | Δ node wall | worst Δ |
|---|---|---|---|---|---|---|
| today (OFF @ 85) | 110,216 | 0 | — | 0 (34,936) | 0 (662 s) | — |
| window 0 (OFF @ 0) | 87,704 | 100 | 170 / 0 | +42,844 | +900 s | +69.1 s (394:0) |
| **ON: (i) + (iii) + `dashOnlyWindow`, @ 85** | **94,359** | **70.4** | **165 / 0** | **+15,158** | +37 s | +9.2 s (418:0) |
| (iii) + `dashOnlyWindow`, no (i), @ 85 | 94,359 | 70.4 | 165 / 0 | +16,773 | (+90 s, a later, loaded run) | — |

- **No request is worse than today.** 99 are longer than window 0 would make them, as expected at a window of 85.
- **The 165 movers are exactly DB's `dw85keep` movers** (165 / 165, none only one side). The full list with
  before → after ticks is in `evidence/d1/battery.txt`. Among them: 108:0 561 → 328, 298:0 295 → 143,
  12:0 253 → 147, 172:0 691 → 415, 409:0 585 → 340.
- **Units:** they move on 210 keys, 198 higher and 12 lower. (i) changes no tick on any key, and saves 1,615 units on
  19 keys (`evidence/d1/battery-nolp.txt`).

## D2 — the flip, the re-pins, the feature check (STOP on (i))

### The flip
| switch | before | after |
|---|---|---|
| `DASH_LEG_PRECHECK` (`solverBot.js`) | `env === '1'` | `env !== '0'`, plus `DASH_LEG_PRECHECK_DEFAULT = true` (G1's shape, as `PRESS_KILL_DONE_ON_WALK`) |
| `DASH_KEEP_PARTIAL` (`solverBot.js`) | `env === '1'` | `env !== '0'`, plus `DASH_KEEP_PARTIAL_DEFAULT = true` |
| `DASH_ONLY_WINDOW` (`dashOnlyWindowHook.js`, js-6's grant) | `env === '1'` | `env !== '0'` (`DASH_ONLY_WINDOW_DEFAULT` still reads it once) |
| `DASH_NO_SWING_PREFIX` | OFF | **OFF, untouched** |

- K = 40 and the `sword-dash` site and kind are unchanged. The only other edit in `solverBot.js` is comments (the
  switches' docblocks, and a ⛔ note on `DASH_LEG_PRECHECK_MARGIN` naming the D2 counter-example).
- `dashShapeHook.DASH_SHAPE_DEFAULTS` follows the switches (it reads them at import): it is now
  `{legPrecheck: true, noSwingPrefix: false, keepPartial: true}`.
- At the defaults a request stays unstamped. An off-default stamp is now `false` for the three flipped switches.

### In place, every committed producer at the new defaults (`evidence/d2/`)
Identity block and all 61 producers, same tree, switches at their defaults:

| row | W0 → flip | cause | re-recorded? |
|---|---|---|---|
| `solve-seedling-r9-campaign --check` | `6b1bf15c` exit 0 → **`e900dde2` exit 1** (= DB's (i) md5) | (i) only: the `r9-solve-12` trace sidecar. `SEEDLING_DASH_LEG_PRECHECK=0` → `6b1bf15c` exit 0 | **no** |
| `plan-seedling-axe-witness` | `ae029113` exit 0 → **`59ae80f2` exit 1** | (i) only: tape `axe-l48-reach-l49` **368 → 585 t**. The tape would go `1c16f5a5` → `89b44746` (the would-be file is `evidence/d2/axe-l48-reach-l49.would-be.json.txt`) | **no** |
| `plan-seedling-l40button-witness` | md5 moves, exit 0 both | only its printed wall seconds (197 s → 15 s, 246 s → 13 s). The plans are identical | n/a |
| `plan-seedling-r7-ends-meet` | md5 moves, exit 0 both | `37 dead` → `38 dead` frames in a browser drive. All switches OFF also reads 38, so it is run-to-run noise | n/a |
| every other identity row, the other five `--check`s, the other 57 producers, censuses | equal | — | — |

**⚖ 40: no fixture moved.** Nothing was re-recorded, so no tape index was regenerated. The md5 of every file that did
change is in `evidence/d2/md5-before-after.txt`.

### Re-pins (each comment names *"⛓ dash flip (the user, 2026-10-16)"*)
| file | rows | how |
|---|---|---|
| `hammerDashShape.test.js` | "ships OFF" ×3 → ships ON / OFF / ON; +1 row pinning the two `_DEFAULT`s | `skipIf(env !== undefined)` kept |
| `dashShape.test.js` | 8 rows | `SHIPPED` / `OFF_DEFAULT`. Each witness now moves its key OFF the shipped shape against the unstamped default (the same 57 → 48 u, 255 → 235 t, and 478:0 witnesses) |
| `dashOnlyWindow.test.js` | 7 rows | default ON; off-default = `false`; L4 at 75: OFF stamped 255 t, default 219 t unstamped (in process and through a real worker) |
| `seedlingWasmPlayback.test.js` | the two knob rows | the off-default knob values are now `off` |
| `jsRuntimeSolverShouldStop.test.js` | the 1-unit and 76 / 75 rows | pinned `withDashOnlyWindow(false)`: they are WINDOW WHOLE PASS's rows |
| `jsRuntimeSolverCalibration.slow.test.js` | L40 at a window of 84 | pinned `withDashOnlyWindow(false)` |
| `solverDeadline.test.js` | "a counter that trips ANYWHERE … plays the `dashMode: none` plan" | pinned `withDashKeepPartial(false)`: it tests the drop-the-schedule arm |
| `fidelityLapseCost.test.js` (found by CI at `a4ec6710`, not by the bounded set) | leg 403 and leg 265 at the page budget | the plan length follows the flip, 776 → **642 t** and 215 → **116 t** (both are D1 movers). The OFF-vs-ON key-for-key equality the rows test still holds (13 / 13) |

### The `seedling-dash-window` feature check (`checks/seedlingSlowSolve.js`, status `ready`)
- **Section 1** sets `seedlingDashOnlyWindow` **off** (session-only), which is the old whole-pass rule. At window 85
  the full pass is cut (*refused*, "upgrade window 85") and the dashless 561 t ships.
- **Section 2** puts it back to **default** (ON). At the same window of 85 the full pass is *solved*: 328 t at 115 u
  (151 for the whole solve). Its dash scan still trips at its 85th dash unit, but it keeps the windows it had
  accepted, and those were all it needed. Window 0 gives the same 328 t, at 238 u.
- The restore step now restores five settings. The substrates config row's `_comment` says the same.
- **Browser walk:** `npm test -- --mode=test-substrates --test=feature-check-seedling-dash-window --port=9592` →
  **`[PROGRESS 1/1] … PASSED 68.8s`**, 1 passed (`evidence/d2/feature-check-walk.txt`, `feature-check-results.json`).
- **For the tutorials planner (`seedling-tutorials-planning`):** this slice cannot message that session, so the
  planner should pass this on. The check no longer opens the window to 0. It now teaches *what the window counts*:
  OFF = the whole pass, default = dash asks only plus keep-partial. Its ids changed: `window-0` → `dash-only`, and
  the section titles. The numbers changed: 202 u / "upgrade window 640" → 115 u / "upgrade window 85".

**Every `plan-seedling-*.mjs --check` passes at the head except `axe-witness`** (above). js-6's flip rule is
therefore not met, deliberately, pending the user.

## D3 — gates and timings

**Dispatches (for js-6; cloud dispatch returns 403):**
1. **The 843-leg A/B:** `seedling-divergence-sweep.yml` on `claude/seedling-dash-flip-ih4lx5` with
   `capture_requests=true`, `shards=10`, compared by key against a `main` run of the same inputs (e.g. `38845773709`'s
   inputs, re-run on current main). Expected movers: D1's 165 keys (`evidence/d1/battery.txt`), all shorter. If the
   user drops (i), the expected movers are the same 165 keys.
2. **`test-substrates-manual.yml`** with `batch=feature-checks`. Locally the dash-window row passes (D2).
3. **CI unit tests:** `node scripts/procgen/ci-vitest-summary.mjs <head> --wait`. The number for `a4ec6710` is
   quoted under D4.

**Timings** (`evidence/d3/timing.txt`). Three interleaved rounds, jobs 1, load 1.33–2.46 (median 1.82), window 85,
node, on DB's heaviest requests. Every config's ticks and units were identical across rounds. Each cell is median /
min:

| key | OFF (today) | ON (the flip) | ON without (i) |
|---|---|---|---|
| 108:0 | 561 t, 87 u, 1.01 / 0.94 s | **328 t**, 151 u, 1.53 / 1.47 s | 328 t, 151 u, 1.60 / 1.45 s |
| 298:0 | 295 t, 87 u, 0.63 / 0.60 s | **143 t**, 108 u, 0.71 / 0.71 s | 143 t, 108 u, 0.75 / 0.72 s |
| 384:0 | 861 t, 87 u, 2.67 / 2.20 s | 861 t, 105 u, 3.08 / 2.27 s | 861 t, 190 u, 7.12 / 6.45 s |
| 385:0 | 913 t, 86 u, 2.60 / 2.54 s | 913 t, 157 u, 3.22 / 3.16 s | 913 t, 242 u, 8.13 / 7.67 s |
| 386:0 | 1025 t, 88 u, 2.40 / 2.32 s | 1025 t, 175 u, 4.16 / 3.70 s | 1025 t, 260 u, 8.46 / 7.90 s |
| 387:0 | 1087 t, 91 u, 2.42 / 2.10 s | 1087 t, 181 u, 4.51 / 4.25 s | 1087 t, 266 u, 10.14 / 10.05 s |
| 388:0 | 844 t, 87 u, 2.35 / 2.32 s | 844 t, 103 u, 2.46 / 2.30 s | 844 t, 188 u, 5.61 / 5.42 s |
| 392:0 | 828 t, 87 u, 3.02 / 2.67 s | 828 t, 101 u, 2.57 / 2.29 s | 828 t, 186 u, 6.25 / 6.01 s |
| 394:0 | 809 t, 87 u, 2.62 / 2.54 s | 809 t, 99 u, 2.15 / 2.09 s | 809 t, 184 u, 6.48 / 6.25 s |
| **Σ median / min** | **19.7 / 18.2 s** | **24.4 / 22.2 s** | **54.5 / 51.9 s** |

## D4 — records (PASS)

| row | result |
|---|---|
| log | `seedling-bot-log.md`: `### Seedling DF — the cheaper dash search, flipped ON` (flip note, D1, the STOP, two lessons) |
| as-built | `seedling-bot.md` DB paragraph: (i) and (iii) ship ON with the window and (ii) OFF, plus D1's numbers and the (i) counter-example. `flash.md`: *Pass deadlines* names the whole-pass rule as the OFF arm; *Dash-only window switch* and *Dash-shape switches* say ON |
| surface / constants / entities / profile | GREEN 308 · PASS 6,000 · PASS 566 · PASS 138, unchanged; no `--write` needed (`evidence/d4/censuses-after.txt`) |
| reference | `generate-procgen-reference.mjs` then `--check`: **ALL 7 + 5 MATCH** (README word count and docs index regenerated). `scripts/quicklaunch/generate-docs-index.mjs`: 176 docs, byte-unchanged |
| bounded vitest AFTER | the W0 set + `boxLock`, `seedlingConstantsCensus`, `procgenDocs/generated`, `docLinks`, `docsRender`, `quickLaunch/generated`, `entityBlocks`, `seedlingSolverSurface`, `checkProcgenHelp`, `tutorials`: **32 files, 1726 / 1726**. tapeRunner pairs 611 `75a3c41f` (= W0). Plus the 9 other tests that read the dash / window paths (`r8Acceptance`, `levelRun`, `iceTurret`, `fidelityBobSoldier2`, `jsRuntimeGeneratedSolver`, `procgenPostSword`, `watchOverlays`, `producerSegments`, `rerecordCampaign`): **448 / 448**. `jsRuntimeSolverCalibration.slow`: 5 / 5 after its re-pin (4 / 5 before it) |
| CI unit tests | see *CI* below |
| not run | pytest, unfiltered local vitest (⚖ 52), `standing-values --write`, any re-record, any dispatch |

**CI unit tests** (`ci-vitest-summary.mjs`):
- at `a4ec6710` (run `38995989389`): unfiltered vitest **20,655 passed, 2 failed** of 20,657. The two are `fidelityLapseCost.test.js`'s leg 403 / leg 265 rows, which pin plan lengths that the flip shortens. They are re-pinned in the report's commit. The slow battery did not run because that step failed first. Locally its one budgeted-solve file (`jsRuntimeSolverCalibration.slow`) is 5 / 5.
- at the report's head: CI_HEAD_PLACEHOLDER

## The table for the user

| | today (main) | **the flip as asked** (i)+(iii)+window | the flip without (i): (iii)+window |
|---|---|---|---|
| play time, the 617 sweep requests | 110,216 t | **94,359 t** (−15,857; 165 legs shorter, 0 longer) | **94,359 t** (identical on every leg) |
| e.g. leg 108 (L12) / 298 (L26) | 561 / 295 t | 328 / 143 t | 328 / 143 t |
| play time, committed tapes in place | — | **`axe-l48-reach-l49` 368 → 585 t (+217)**; nothing else | **nothing moves** (byte-inert in place) |
| solve work, the 617 | 34,936 u | 50,094 u (+43 %) | 51,709 u (+48 %) |
| solve time, the heaviest 9 (Σ median) | 19.7 s | 24.4 s (+24 %) | **54.5 s (+177 %)**: L40 pits 384–394 at 2–4× |
| re-recorded | — | needs: the axe tape (a slower one, on the game: p4f) + the `r9-solve-12` trace. **Not done** | nothing |
| ⚖ rulings touched | — | partly reverses WINDOW WHOLE PASS (chosen) | the same |

The three options, as measured:
1. **Land the flip as asked.** This needs the axe re-record (the user licenses a +217 t witness tape).
2. **Land without (i).** Revert two lines and one gate row. The same ticks everywhere and nothing moves in place, but
   L40's solves cost ~2× more.
3. **Re-derive (i)'s bound before flipping it.** Its bound would have to be on the whole chain's saving per leg, not
   one window's. ⛔ This slice may not change K.

## What the brief got wrong (measured)

1. *"DB measured (i) moves the `r9-solve-12` trace only."* At this base (i) also re-plans `axe-l48-reach-l49`
   368 → 585 t. `axe-witness` was drift-red at DB's base, so DB could not see it.
2. *"(iii) with the window: 166 sweep keys shorter."* 166 was DB's all-three row, which includes (ii). The exact flip
   moves **165**: the `dw85keep` set, 165 / 165.
3. *"`DASH_LEG_PRECHECK_DEFAULT` and `DASH_KEEP_PARTIAL_DEFAULT` go to `true`."* Neither constant existed. They were
   added in G1's shape (`PRESS_KILL_DONE_ON_WALK_DEFAULT`).
4. *"With the dash-only window, leg 108 ships its whole 328 t plan at 85."* It ships 328 t, but as a **kept partial**:
   the full pass still trips `sword-dash` at the window (115 u, `deadline: sword-dash, limit: window`). The kept
   windows happen to be all the corridor needed. The feature check's text says so.
5. *"Every `plan-seedling-*.mjs --check` must pass at your head."* That holds only if a slower tape is re-recorded,
   which is the user's call. Two are red at the head by choice.
6. *The bounded set* (and mine, which was wider) missed `fidelityLapseCost.test.js`: it pins two page-budget solves
   that the flip shortens. CI found it. Any file that pins a page-budget plan length belongs in a flip's set.
7. The census counts moved since DB (surface 307 → 308, constants 5,988 → 6,000). §5.84 / §5.87 moved them, not this
   slice.

## Residue

1. **The user's ruling on (i)** (*the table*). Until then the head's `axe-witness` and `r9-campaign` `--check`s are
   red.
2. **Stale "OFF" text outside the grant** (js-6's, not edited):
   - `flashPanel/seedlingDashOnlyWindowSettings.js:30`: the setting's description, "`default` is the switch's own
     value (off)";
   - `flashPanel/seedlingDashShapeSettings.js:10, 49`: the same for the three dash settings (now ON / OFF / ON);
   - `seedlingDemo/dashShapeHook.js:37`: "OFF in the browser and its worker";
   - `.github/workflows/seedling-divergence-sweep.yml:106, 114`: "at its own default, OFF (today's run)".
   The settings text is user-visible in the panel.
3. **The dispatches in D3** are js-6's to run (the 843-leg A/B and `feature-checks`).
4. **The tutorials planner** needs D2's feature-check note relayed.
5. **Walls are one box's.** D1 ran at load 4–10, D3 at 1.3–2.5. Units and ticks are the measure.
6. **Tree hygiene.** The scratch worktrees `base` and `flip` (under the scratchpad) were removed by name. The server
   (PID 699) died with a container restart, so there was nothing left to kill. The captures stay in `/tmp/claude-0/caps`, not in the tree.
