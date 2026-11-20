# js-env-and-rung-reasons: solver switches reach the JS frame, and refusals show every rung's reason

## Summary for Robert

Two small changes, both within your rulings of 2026-11-20. Nothing about the solver, the model, a survey or a default changed. Part 1 only carries a URL parameter, and Part 3 only changes what is displayed.

1. **"Pass them to JS too."** The Flash panel now copies the app page's `?seedlingSolverEnv=` into the JS runtime frame's URL, unchanged. Both runtimes now honour the same switches. If the app URL has no such parameter, the JS page's URL is exactly what it was before. A test runs the real solve worker at the URL the JS frame builds and confirms that it reads `SEEDLING_TALK_CLEAR_GOAL=0`.
2. **"Show the full reasons."** When a solve runs out of budget, the bot's failure now includes the whole refusal: the first line is unchanged and every `  rung: why` line follows it. Before, it was cut after the first line. That full text reaches the Playback Bot's status and the walk's `[MEASURE end]` line. The measure line still prints as one line, because each newline is written as the escape `\n`. The whole-game walk's summary still parses it and lists every rung. One parser regex needed a fix for multi-line text.

No RE2 saved-position work is in this slice, as you ruled ("Leave it for now").

## Part 1: `?seedlingSolverEnv=` → the JS runtime frame

**What already worked.** The wasm runtime runs its solves in the *host* page's solve worker. `jsRuntimeSolveService`'s default worker builds its URL from `globalThis.location.search`, so the app URL's parameter already reached it. The JS runtime runs its solves in the worker of its *own frame*: `jsRuntimePage.js:266` builds that worker's URL from the frame's own `location.search`. The panel built the frame's URL (`flashPanelUI.js`, the `runtime 'js'` branch, `this.wasmPath = JS_RUNTIME_PAGE + …`) without the parameter.

**The change.**
- New `frontend/modules/flashPanel/seedlingSolverEnvCarry.js` exports `solverEnvPageParam(search)`. It takes the host query and returns `seedlingSolverEnv=<value, URI-encoded>`, or `''` when the host has no such parameter or an empty/blank one. Blank counts as absent because `solveWorkerUrl` already treats it that way. The value is carried **verbatim** and is never parsed here. A malformed spec is therefore refused by name in the JS frame's worker, exactly as in the wasm page's worker.
- `flashPanelUI.js` adds one entry to the JS page's query list: `solverEnvPageParam(globalThis.location?.search)`. The list is `.filter(Boolean)`, so an empty result leaves the URL byte-identical.

**Proof** (`flashPanelSolverEnvCarry.test.js`, 5 rows):
- The helper: a present value round-trips verbatim (4 specs, including a comma value and an unknown name), and an absent or blank value returns `''` (6 inputs).
- The panel's real init flow (`_initializeAdapter` on a bare panel, as in `flashPanelInitEpoch.test.js`):
  - With no `location`, with a query that lacks the parameter, and with a blank parameter, the result is the same URL, and it contains no `seedlingSolverEnv`.
  - With the parameter set, the URL carries exactly the host's value, and every other query entry is unchanged.
- The real worker: from the panel's JS page URL, the test builds the worker URL as `jsRuntimePage.js` does (`solveWorkerUrl(…, frame search)`). It then runs the real `jsRuntimeSolveWorker.js` entry in node `worker_threads` with an empty env. The shim reports `SOLVER_ENV_APPLIED = 'SEEDLING_TALK_CLEAR_GOAL=0'`, and `process.env` holds exactly `{SEEDLING_TALK_CLEAR_GOAL: '0'}`. That switch ships ON, so `=0` is a real override. With no parameter, the frame's worker URL is the same object as today's.
- Mutants:
  - The panel does not add the parameter: **2 red**.
  - The helper emits the parameter when the host has none: **3 red**.

## Part 3: the full per-rung reasons

**Where the reasons were cut.** I traced the path a refusal takes to the bot's status:
- solve answer
- → `seedlingWasmPlayback` (`fail(why)`)
- → `seedlingPlaybackController` (`the wasm playback failed: …`)
- → `playback:walkFailed`
- → `PlaybackBotUI.onWalkFailed` (`error: <region>: the bot cannot walk to … — <reason>`)

On the JS runtime's path, the walker's `FAILED` settle → the controller's `the JS runtime's walk failed: …` → the same bot handler.

The plain decline passes `res.message` whole (`the solver declined … (<kind>): ${res?.message}`). **The one first-line cut was `wasmPlayback.expiryFailure`**, the named failure used when a solve runs out of its work budget. Both of its branches used `String(refusal.message).split('\n')[0]`. In the deterministic-budget design, a ladder refusal from one pass beside a pass cut at the budget ends up in exactly that branch.

**The change.** `expiryFailure` keeps line 1 byte-identical to before, then appends the refusal's remaining lines after a newline. The existing rows, which pin the exact one-line texts, still pass unchanged.

**The `[MEASURE end]` line.**
- It is now built by a pure `frontend/modules/tests/walkMeasureLine.js` (`measureLine`, `measureEndExtra`).
- The sampler loads it with its other dynamic imports, so an inert run still loads nothing new.
- For a one-line status, the format is byte-identical to before, and a test row pins that.
- **Newline escaping:** every free-text field (`botHead`, `botRegion`, `lastRegionEvent`, `status`, `why`) is written as a JSON string. A newline therefore appears on the line as the two characters `\n`, never as a line break, and `parseMeasureFields` JSON-parses it back to the full text. I kept JSON's `\n` rather than a `⏎` marker because the parser already round-trips it.

**Consumers of the status string** (`grep -a`). Each one matches a prefix, matches line 1, or reads the whole text, and line 1 is unchanged:
- `tutorials/content/steps/procgen.js` `botCannotFinish`: `startsWith('error')` and `unchangedFor(…)` on the whole text.
- `tests/testCases/tutorialTests.js`:
  - the skip probe: `startsWith('error')`
  - the step's `failed` filter: `/Playback Bot says "error/`
  - the walk-ended log line: quotes the whole text
  - the sampler: JSON-escaped, as above
- `scripts/procgen/walk-seedling-whole-game.mjs` `summarize`:
  - `status?.startsWith('error')` is fine.
  - **The stall test `/has said .* for \d+ s/` needed a fix.** After JSON-parsing, a multi-line quoted status contains real newlines, which `.` does not cross, so a stall would have been misreported as `failed …`. It is now `[\s\S]*`. The JS walker's `walking instead` note already carried a whole multi-line decline, so this case is real.
- Tutorial `done` checks: `startsWith('Sphere log loaded')`, `startsWith('finished')`, and `=== 'stopped'`. None of these are refusal states.
- In-app rows (`playbackBotTests.js`, `seedlingJsRuntimeTests.js`, `seedlingAtlasMazeTests.js`, `cloudberryLoopModeTests.js`): `startsWith('finished')` and `/^(error|blocked)/`.
- The JS page's own one-line label (`jsRuntimeWalker.describe`): one line by design (`(+N more line(s))`). It is not the bot's status, and I left it as it is.

**Proof:**
- `walkMeasureLine.test.js` checks the chain end to end. A refusal with 3 rung lines goes through `expiryFailure`, the controller's prefix, the real `PlaybackBotUI.onWalkFailed` and its `getStatus()`, then the `[MEASURE end]` line (with `botCannotFinish`'s `why` quoting the status), then `summarize`. The status, the measure line and the summary's cause each contain all 3 rungs. The measure line has no raw line break, and `summarize` still gives entry 5/48 and `transport wasm`.
- One row was added to `jsRuntimeSolverAnytime.test.js`: both branches keep line 1 and carry the 3 rungs.
- One row was added to `walkSeedlingWholeGame.test.js`: a stall on a multi-line status is still a stall, and its cause carries all 3 rungs.
- Mutants:
  - m1, `expiryFailure` keeps the first line only (today's code): **2 red**.
  - m2, the measure line writes the status's first line only: **2 red**.
  - m3, the measure line writes the status unescaped: **2 red**.
  - m4, the stall regex goes back to `.*`: **1 red**.

## Gates

- **Worktree:** `/home/robert/CC/Archipelago-CC-wt-js-env-and-rung-reasons` (created with `new-worktree.sh js-env-and-rung-reasons --with-wasm`), branch `js-env-and-rung-reasons`.
- **Base:** `git merge-base HEAD origin/main` = `11ca7efeca6fe33b74e6645ee2e4bcf67dbc8117`. At packet time, `git merge origin/main` reported "Already up to date", so the gate SHA is the tip.
- **Bounded vitest (⚖ 52):** every test that imports a touched file (`grep -a -l` on `flashPanelUI|seedlingSolverEnvCarry|wasmPlayback|tutorialTests|walkMeasureLine|walk-seedling-whole-game`), plus `moduleImportOrder.test.js`, `bundledTestCases.test.js` and `solverEnvChannel.test.js`. Result: **30 files, 691 tests, all passed**.
- **Acceptance:** `batch-seedling-acceptance.mjs | md5sum` = `391322d681b7aa0229d94b3f6906d024` (unchanged).
- **Engine closure:** `seedlingDerivedRuleTable.js --print-engine-closure` (43 lines) ∩ diff = ∅.
- **Gitlinks and presets:** 0 gitlinks, 0 presets.
- CI at the tip `e249375fcb`. Every run below has headSha `e249375fcb`, and all passed on the first attempt:
  - **JSUT** push run **44818913916**: success. Suite (`ci-vitest-summary.mjs`): vitest (unfiltered) **29219 passed**, 0 skipped, 0 failed, in 1386 files; slow battery 438 passed.
    - Compared with the base's run 44800813211 at `11ca7efeca` (29209 tests, 1384 files): **+F = 0, +T = 10**, +2 files (`flashPanelSolverEnvCarry.test.js` 5, `walkMeasureLine.test.js` 3, plus 1 row each in `jsRuntimeSolverAnytime.test.js` and `walkSeedlingWholeGame.test.js`).
  - **unittests** push run **44818914178**: success.
  - **TT** dispatch (`test-templates.yml`, all jobs) **44818937488**: success.
    - ALTTP spoiler & regression: success.
    - Every on-push substrate batch passed, with no row moved:

      | Batch | Rows | Span | Headroom |
      |---|---|---|---|
      | fast | 126/126 | 291.1 s | 49% |
      | fast (bundled boot) | 126/126 | 294.9 s | 49% |
      | **seedling-js** | **39/39** | 219.0 s | 36% |
      | **seedling-js-solver** | **12/12** | 196.5 s | 33% |
      | **seedling-wasm** | **12/12** | 225.3 s | 38% |
      | playback-bot | 16/16 | — | — |
      | apworld | 142/142 | — | — |
  - **tutorials-seedling** (`test-substrates-manual.yml`) **44818941553**: success, 4/4, 382.5 s (64%). The rows were `tutorial-walk-seedling-recompile`, `tutorial-walk-seedling-bot`, `tutorial-walk-seedling-multiworld` and `tutorial-walk-seedling-bot-js`.
    - ⚠ The walk instrument is inert in CI (no `TEST_MEASURE_*` is set), so this run printed **no** `[MEASURE]` line. It proves that the inert path is unchanged.
- **The active instrument, local** (worktree server on :8130): `walk-seedling-whole-game.mjs --budget-s=150 --stall-s=90 --port=8130`.
  - The refactored sampler printed `[MEASURE tick]` lines every 15 s and one `[MEASURE end]` line. The format was byte-for-byte the shape of the fixtures, and `summarize` parsed them: `4/48, stop: entry 5 "Level 017 - Chest" in level_36, cause: budget: the step's wait ran out`.
  - That stop is the expected one for a 150 s budget, not a refusal. **A live multi-rung refusal was not reproduced**. The node chain row above is the evidence for that case.
