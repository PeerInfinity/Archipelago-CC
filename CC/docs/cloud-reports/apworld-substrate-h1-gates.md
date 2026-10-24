# APWORLD SUBSTRATE CHANGE H1 — cloud gates report

| | |
|---|---|
| Branch measured | `apworld-substrate-h1` @ **`0ee38c1d44`** (local `h1-gates`, 5 commits over main) |
| Control | `origin/main` @ **`279d75d`** (checked out `--detach`, not `checkout -- .`) |
| Report pushed to | `claude/h1-gates-measurement-8pp2k0` (the harness-pinned branch; it carries the H1 commits + this file) |
| Date | 2026-09-29 (UTC ≈ 16:10–16:50) |
| Node | v22.22.2 · Python 3.11.15 |
| Machine | `nproc` = **4**, 15 GiB RAM (13 GiB free at start), no swap |
| Server | `python scripts/serve-nocache.py 8000`; every `npm test` ran with `--port=8000`, one at a time |
| Submodules | `session_bootstrap.sh` initialised only `shared`; I added `omsi-loops`, `textAdventureEngine`, `journey-to-ascension` and `cavernous-ii` before any run, and `vendor/seedling` before the C re-check (see C). **`flashPanel/wasm` was NOT initialised for any run** (no `builds.json`). The submodule pins are identical at the control and the branch (the H1 diff moves no gitlink) |

## A. The read-back row's rate (`apworld-a-region-form-reads-back-the-initialise-bag`, solo)

Command: `npm test -- --mode=test-substrates --test=apworld-a-region-form-reads-back-the-initialise-bag --port=8000`.
The target was read from the results JSON: from the premise condition `(…<target>…)` at both heads, plus the
branch's `hooked in this load's order: …` text. `grep -c 'Error in event handler for'` was 0 in all 52 runs.

**The planned 8 + 8.** Control: **0/8 red**. Every control load hooked `bounce`, so the expected ~3/8 did not
reproduce in these 8. Branch: **0/8 red**, and `runner` registered first in 2 of the 8 loads, yet the row still
hooked `bounce`. Since the control 8 never drew `runner`, I added 12 control runs (`ctlx`) and 24 branch runs
(`brx`) as a supplement:

| head | runs | red | hooked `runner` | hooked `flash_seedling_gen` | hooked `bounce` | `runner` first in registration order |
|---|---|---|---|---|---|---|
| control `279d75d` | 20 | **4/20** | 3 (all red, 30.4 s — Initialise outcome poll STUCK 600/600 in 30 s) | 1 (red in 0.4 s, different failure) | 16 (all pass) | not logged at the control |
| branch `0ee38c1` | 32 | **0/32** | 0 | 0 | 32 (all pass) | **10/32** (always skipped as `heavy`) |

| run | head | result | row duration | npm wall | target hooked | hooked targets in registration order (branch logs it) | failing conditions |
|---|---|---|---|---|---|---|---|
| ctl 1 | `279d75d` | PASS | 1.5 s | 9 s | `bounce` | — |  |
| ctl 2 | `279d75d` | PASS | 1.4 s | 8 s | `bounce` | — |  |
| ctl 3 | `279d75d` | PASS | 1.3 s | 7 s | `bounce` | — |  |
| ctl 4 | `279d75d` | PASS | 1.4 s | 7 s | `bounce` | — |  |
| ctl 5 | `279d75d` | PASS | 1.3 s | 8 s | `bounce` | — |  |
| ctl 6 | `279d75d` | PASS | 1.3 s | 8 s | `bounce` | — |  |
| ctl 7 | `279d75d` | PASS | 1.3 s | 8 s | `bounce` | — |  |
| ctl 8 | `279d75d` | PASS | 1.4 s | 8 s | `bounce` | — |  |

Branch runs 1–8:

| run | head | result | row duration | npm wall | target hooked | hooked targets in registration order (branch logs it) | failing conditions |
|---|---|---|---|---|---|---|---|
| br 1 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| br 2 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| br 3 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| br 4 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| br 5 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| br 6 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| br 7 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| br 8 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |

Supplement, control runs 9–20:

| run | head | result | row duration | npm wall | target hooked | hooked targets in registration order (branch logs it) | failing conditions |
|---|---|---|---|---|---|---|---|
| ctlx 9 | `279d75d` | PASS | 1.4 s | 8 s | `bounce` | — |  |
| ctlx 10 | `279d75d` | PASS | 1.4 s | 8 s | `bounce` | — |  |
| ctlx 11 | `279d75d` | PASS | 1.3 s | 8 s | `bounce` | — |  |
| ctlx 12 | `279d75d` | **FAIL** | 30.4 s | 38 s | `runner` | — | the build succeeded, region read-back test error-free |
| ctlx 13 | `279d75d` | **FAIL** | 30.4 s | 37 s | `runner` | — | the build succeeded, region read-back test error-free |
| ctlx 14 | `279d75d` | **FAIL** | 30.4 s | 38 s | `runner` | — | the build succeeded, region read-back test error-free |
| ctlx 15 | `279d75d` | PASS | 1.3 s | 7 s | `bounce` | — |  |
| ctlx 16 | `279d75d` | PASS | 1.3 s | 8 s | `bounce` | — |  |
| ctlx 17 | `279d75d` | PASS | 1.3 s | 7 s | `bounce` | — |  |
| ctlx 18 | `279d75d` | PASS | 1.4 s | 9 s | `bounce` | — |  |
| ctlx 19 | `279d75d` | **FAIL** | 0.4 s | 7 s | `flash_seedling_gen` | — | ⛓ the hooks control moved the read-back knob (undefined: undefined → undefined) |
| ctlx 20 | `279d75d` | PASS | 1.3 s | 8 s | `bounce` | — |  |

Supplement, branch runs 9–32:

| run | head | result | row duration | npm wall | target hooked | hooked targets in registration order (branch logs it) | failing conditions |
|---|---|---|---|---|---|---|---|
| brx 9 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| brx 10 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 11 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 12 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 13 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 14 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 15 | `0ee38c1` | PASS | 1.2 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 16 | `0ee38c1` | PASS | 1.2 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 17 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 18 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 19 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 20 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 21 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| brx 22 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 23 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| brx 24 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| brx 25 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 26 | `0ee38c1` | PASS | 1.4 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 27 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| brx 28 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| brx 29 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 30 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | bounce, runner, flash_seedling_gen |  |
| brx 31 | `0ee38c1` | PASS | 1.3 s | 8 s | `bounce` | runner, bounce, flash_seedling_gen |  |
| brx 32 | `0ee38c1` | PASS | 1.3 s | 7 s | `bounce` | bounce, runner, flash_seedling_gen |  |

**⚠ A finding the fix does not cover: control run 19.** That load put `flash_seedling_gen` first among the
hooked targets, and the row failed in 0.4 s on `⛓ the hook's control moved the read-back knob (undefined:
undefined → undefined)`, before any build ran. `flash_seedling_gen` declares no `generationCost`, so
`generationCostOf` answers `light` (substratePredicates.js: absent ⇒ LIGHT). That means the branch's
`s2ReadBackTarget` would pick it too in any load that registers it before `bounce`. The branch never drew that
order in 32 loads (the control drew it in 1/20), so how the branch row behaves on such a load is **not measured**.
Whether this failure is environmental is also **not measured**: `flashPanel/wasm` was not initialised here, so
the Seedling hook may draw no controls here and still draw them on a box that has the builds. The one
observation of this failure is control run 19 at `279d75d` (premise names `flash_seedling_gen`).

## B. The two in-app batches at the branch tip

| batch | head | result | wall (npm) | `Error in event handler for` | uncaught page exceptions | notes |
|---|---|---|---|---|---|---|
| `apworld` | `0ee38c1` | **139/139 pass**, 0 not run | 230 s | 0 | 0 (176 console errors) | read-back row passed 1.2 s, hooked `bounce` (order `bounce, runner, flash_seedling_gen`); `apworld-two-slots-initialise-in-turn` (P1b′, now through the Map tab) passed 5.0 s |
| `fast` (1st) | `0ee38c1` | **68/69**, 0 not run | 248 s | 0 | 187 | ✘ `omsi-award-schedule` after 31.3 s: `foreign grant delivered jta/Food x2`, `local re-route sent nothing to jta`, `per-loop index semantics across restart`. Both polls STUCK (75/75 in 15 s) |
| `fast` (2nd, re-run) | `0ee38c1` | **69/69 pass** | 217 s | 0 | 180 | — |
| `fast` (control, for attribution) | `279d75d` | **69/69 pass** | 218 s | 0 | 185 | — |

Neither batch overran the budget (no `IN-APP RUN DID NOT FINISH ITS ROSTER`).

Attributing `omsi-award-schedule`: solo it passed 2/2 at the branch (2.0 s, 2.0 s) and 2/2 at the control
(1.7 s, 2.0 s). The branch's second fast batch passed it. The H1 diff touches no omsi file (13 files:
apworldEditor, procgenCore capabilities, procgenPipeline compositeMapDocument, seedlingDemo tests, the
generated chart, docs, and the test row/config). **Read: a one-off in the batch (1 of 2 branch batches), not
H1's**. That is an attribution, not a root cause, and the row is timing-sensitive under the batch.

The uncaught exceptions are all the same one: `TypeError: Cannot read private member #txtsObj from an object
whose class did not declare it` (`omsi-loops/localization.js:131`, via `actionList.js:320` →
`main.view.js:1001`). About 185 of them appear at the control too, so they predate H1 (they come from the
omsi-loops submodule, possibly environmental).

## C. Bounded vitest at the branch tip

`npx vitest run frontend/modules/apworldEditor frontend/modules/procgenPipeline frontend/modules/procgenCore frontend/modules/seedlingDemo frontend/modules/procgenDocs scripts/procgen`

| | |
|---|---|
| Test files | **2 failed · 325 passed (327)** |
| Tests | **2 failed · 10463 passed · 12 skipped (10477)** |
| Duration | 273.2 s (npm wall 274 s) |
| flashPanel suites | none appeared (none of the named paths hold them) |

Both failures are environmental. I re-ran each file alone at both heads:

| failing test | cause | branch `0ee38c1` alone | control `279d75d` alone |
|---|---|---|---|
| `seedlingDemo/ropeSword.test.js` › D1 … *is MODELLED under both tables* | `ENOENT … vendor/seedling/src/Puzzlements/RopeStart.as`: the bootstrap does not init `vendor/seedling` | after `git submodule update --init vendor/seedling`: **8/8 pass** | 8/8 pass |
| `scripts/procgen/standingValues.test.js` › F1 task 0/0b › *a gate that sleeps past the deadline is KILLED …* | `expect(alive(grandchild)).toBe(false)` gets `true`: the killed grandchild stays as a zombie (`ps` shows `[sleep] <defunct>`), because nothing in this container reaps orphans, so `kill -0` still succeeds | 1 failed · 33 passed | **same** 1 failed · 33 passed |

## D. Docs gates

| gate | head | verdict | PASS / FAIL lines | wall |
|---|---|---|---|---|
| `cd scripts/procgen && node generate-procgen-reference.mjs --check` | `0ee38c1` | `ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE` | 12 / 0 | 3 s |
| `node scripts/procgen/check-procgen-docs.mjs` (drives Chromium) | `0ee38c1` | `ALL CHECKS PASSED` | 158 / 0 | 4 s |

The capability chart (`9e8d011c99`, G8) has no separate check. `procgenDocs/generated/capabilities.js` is written
by `generate-procgen-reference.mjs`, and `--check` covers it: `PASS: capabilities.js is what the code says`,
and `PASS: docs/json/features/procgen-substrates.md § GENERATED:substrate-capability-chart is what the code
says`. (`--check` prints a harmless `Worker is not defined` from stateManagerProxy under Node before its
verdicts.)

## E. Durations and machine

| step | wall |
|---|---|
| `session_bootstrap.sh` | 15 s |
| A: one solo read-back run | 7–9 s passing; 37–38 s when it hooks `runner` |
| A: 52 solo runs total (8+12 control, 8+24 branch) | ≈ 8.5 min |
| B: `apworld` batch | 230 s |
| B: `fast` batch ×2 branch, ×1 control | 248 s, 217 s, 218 s |
| B: `omsi-award-schedule` solo ×4 | 8–9 s each |
| C: bounded vitest | 274 s |
| C: two single-file re-runs × 2 heads | < 1 min total |
| D: reference `--check` / docs check | 3 s / 4 s |

Machine: 4 vCPU, 15 GiB RAM, no swap. The load at the fast-batch failure was 0.29 across 4 CPUs (the runner's own
`machine at failure` line).

Tree hygiene: `git status --short` was empty after every gate. No `output/*.zip` was produced and
`preset_files.json` stayed unchanged. No pytest was run and no product code was edited.

## Verdict

The branch's read-back row is **0/8 red vs the control's 0/8** in the planned runs. The control's 8 all
happened to hook `bounce`. With the supplement it is **0/32 vs 4/20**: 3 control reds hooked `runner` (30.4 s
Initialise overrun, the failure H1 targets) and 1 hooked `flash_seedling_gen`. The branch saw `runner`
registered first in 10/32 loads and skipped it every time. ⚠ `flash_seedling_gen` is `light` by default, so the
branch would still pick it on a load that registers it first (0/32 here). Its 0.4 s knob failure was measured
only at the control, with no wasm builds present. Batches: `apworld` 139/139. `fast` was 68/69 once
(`omsi-award-schedule`, STUCK; it passes solo at both heads and in a second branch batch; not H1's) and 69/69 on
the re-run, versus 69/69 at the control. `Error in event handler for` = 0 everywhere. Vitest (bounded): 10463
pass, 2 fail, both environmental (`vendor/seedling` not checked out; zombie reaping); both files match the
control. Docs: the reference `--check` (7 modules + 5 regions, including the G8 capability chart) and
`check-procgen-docs` (158 PASS) are all green.
