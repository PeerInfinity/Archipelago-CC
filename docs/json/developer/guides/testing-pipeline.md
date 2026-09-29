# Developer Guide: Testing Pipeline

This project contains a comprehensive testing pipeline designed to validate that the frontend JavaScript implementation of the game logic correctly simulates a full playthrough, behaving identically to the authoritative Python implementation from the main Archipelago project. Understanding this data flow is essential for debugging rules, fixing test failures, and ensuring the accuracy of the web client.

## Testing Philosophy

The core principle is **progression equivalence**. The JavaScript `StateManager` and `RuleEngine` must unlock locations in the same order (or "spheres") as the original Python game generator given the same world seed and settings. The entire pipeline is built to automate this comparison.

## The Data Flow: From Python Generation to JavaScript Validation

The testing process involves several stages, moving data from the original game generation process to the frontend for validation.

```
┌──────────────────┐   1. Generates   ┌────────────────────────┐
│ Generate.py      ├───────────────►│   Spoiler Log & Rules  │
│ (Python Backend) │                  │ (..._sphere_log.jsonl) │
└──────────────────┘                  │ (..._rules.json)       │
                                      └───────────┬────────────┘
                                                  │ 2. Consumes
                                                  ▼
┌──────────────────┐   4. Validates   ┌────────────────────────┐
│  Test Results    │◄───────────────┤  Frontend TestSpoilers │
│     (UI)         │                  │    (testSpoilerUI.js)  │
└──────────────────┘                  └────────────────────────┘
```

### Stage 1: Python Source & Spoiler Log Generation

-   **Source of Truth:** The game generation process, orchestrated by `Generate.py`, is the source of truth. When run with a spoiler level of 2 or higher (`--spoiler 2`), it produces a detailed log of the game's logical progression.
-   **Spoiler Log (`_sphere_log.jsonl`):** This file is the ground truth for our testing. It contains a sequence of "spheres," where each sphere lists the locations that become accessible after collecting all the items from the previous spheres.

### Stage 2: The Exporter (`exporter/`)

-   During the same `Generate.py` run, our custom exporter is triggered.
-   **`exporter.py`**: This script orchestrates the process of parsing the game's rules, regions, and items.
-   **`analyzer.py`**: This uses Python's `ast` module to convert the game's logic into our standardized JSON rule tree format.

### Stage 3: JSON Data Files

The generation and export process creates two critical JSON files for each seed:

1.  **`..._rules.json`**: A complete dump of the entire game's logic, including all region data, location rules, item definitions, and game settings, translated into the JSON format that our frontend understands. This is the logic that will be **under test**. The structure of this file follows the schema defined in `frontend/schema/rules.schema.json`.
2.  **`..._sphere_log.jsonl`**: The list of progression spheres, which serves as the **expected result**. Each sphere contains the set of locations that should become accessible at that stage.

### Stage 4: Frontend Test Execution (`frontend/modules/spoilerTest/`)

The **Spoiler Test** panel in the web client is the user interface for this pipeline.

-   **Loading:** The test automatically loads the `_rules.json` file into the `StateManager` worker, configuring it with the specific logic for that seed. It then loads the corresponding `_sphere_log.jsonl` file.
-   **Execution & Validation:** When you click "Run Full Test," the `testSpoilerUI.js` module simulates a full playthrough sphere by sphere:
    1.  It starts with an empty inventory.
    2.  It gets the list of accessible locations from the frontend `StateManager`.
    3.  It compares this list against the locations in Sphere 0 from the spoiler log. Any mismatch is reported as a failure.
    4.  It commands the `StateManager` to "check" all locations from the current sphere, which adds all of their items to the inventory.
    5.  After the state updates, it again gets the list of accessible locations.
    6.  It compares this new list against the locations in the next sphere from the spoiler log.
    7.  This process repeats until all spheres have been checked or a mismatch is found.

### Stage 5: Results

-   **Pass/Fail:** The result of each sphere comparison is displayed in the UI. A green entry indicates a match, while a red entry indicates a mismatch.
-   **Mismatch Details:** In case of a failure, the UI provides a detailed report showing which locations were accessible in the frontend but not in the log, and vice-versa. Location names in the report are clickable links for easier debugging in the "Regions" panel.

## Running Automated Tests with Playwright

The entire pipeline can be run automatically from the command line using Playwright, which is the primary method for ensuring code quality.

-   **Test Mode:** Running `npm test` launches the web client with URL parameters. You can specify `--mode`, `--game`, `--seed`, and `--rules` parameters to customize the test configuration.
-   **Another server / a worktree:** the port is not hardcoded anywhere in the harness. `npm test -- --port=8123 …` (or `TEST_PORT=8123` in the environment) points the whole run — the page URL, Playwright's web-server probe, the health check, and the Python drivers' own server — at `localhost:8123`. The single source is `scripts/test/testServer.js` (Python: `test_utils.test_port()`); a git worktree serving itself on its own port therefore tests ITSELF, not whatever the primary tree's server happens to serve.
-   **The bundled boot:** `npm test -- --bundled …` drives the bundled frontend (`frontend/dist/bundle.js`, selected by `?bundled=true` — what a deployed site serves first) instead of the ES modules. It runs `npm run build` first, under the box lock, so the page loads this tree's code (`--no-build` reuses the bundle on disk). The two boots differ in order — bundled pre-imports every module and test case, so test discovery is instant — and a defect can live in one only (trap 1426: the bundled boot started two test loops at once). The results file records `flavour: "bundled" | "unbundled"` (a run recorded before the stamp is unbundled: the harness could not drive the other), the lock is named `npm test <mode> bundled…`, and `compare-runs.js` refuses to diff runs of different flavours (exit 2, naming both) and never picks the other flavour as a baseline; `--list` shows it (`[test-regression --bundled]`). The bundled test cases are a second, hand-kept list (`frontend/init-bundled.js` must import every file in `TEST_CASE_FILES`, `frontend/modules/tests/testDiscovery.js`); `npm run build` warns on drift and `frontend/modules/tests/bundledTestCases.test.js` fails on it. CI runs the regression mode on both boots: `.github/workflows/test-templates.yml` has a `--bundled` step right after the unbundled one.
-   **Test batches in CI:** `npm test -- --mode=test-substrates --batch=<name>` runs one named subset of the substrate roster (whole categories, `frontend/modules/tests/testBatches.js`; the results file is stamped `batch`, and `compare-runs.js` never diffs across batches). CI splits the substrates mode along those batches: `.github/workflows/test-templates.yml` runs `--batch=fast` and then `--batch=apworld` on push and pull request, as two steps of one job so each in-app run gets the 600 s page budget to itself (`fast` is the default batch — every category no other batch claims, so a new category runs there unclassified; `apworld` claims the `apworldEditor` category, which was over half of `fast`'s rows and time), and the `bot-walks` batch (the real-time omsi bot walks, minutes each by design) runs only on demand, in `.github/workflows/test-substrates-bot-walks.yml` (`workflow_dispatch` only, by the user's ruling of 2026-09-27; its `batch` input can run any batch). Before the split the whole roster ran in one step and outlived the job's 30-minute cap on every main run from 2026-09-11. Both workflows upload `test-results/` under `if: always()`, so a run cancelled at its cap still keeps the evidence of the steps that passed.
-   **The box lock:** `npm test` shares one machine with every other browser run and measurement, so `scripts/test/run-tests.js` takes the box lock (`scripts/procgen/boxLock.js`, `.cache/seedling-box/lock.json` under the home directory) before Playwright starts: kind `browser`, named `npm test <mode>[ bundled][ batch=<b>][ test=<ids>]`, freezing the head of the tree the runner lives in (a worktree freezes its own). The take is an atomic create (the entry is `link`ed into place), so of several takers that see the box free at once exactly one holds it. If another process holds the box the run refuses by name and exits 1 without spawning anything; `npm test -- --wait-for-box=<sec> …` queues instead. A run started under a holder that exported its token (a wrapper that took the box, or the Python drivers under `gates.mjs`) passes through rather than taking it twice. A killed run forwards the signal to Playwright and releases the box only once Playwright has exited; a run killed while still queued simply exits, and so does a queued run whose parent is killed (killing `npm` leaves `node run-tests.js` behind, reparented; it notices and stops queuing rather than taking the box later). If the lock directory cannot be written (a CI runner with an unwritable cache) the run proceeds without the lock and says so. Each in-app results file records `frozen` (the head and tracked-change digest the run froze) and `treeMoved` (whether the tree moved by the end), and `compare-runs.js` prints a warning for a moved-tree run. The complementary guard is the pre-commit hook in `scripts/git-hooks/` (`git config --worktree core.hooksPath scripts/git-hooks`), which refuses a commit under another process's lock on the same tree (only the same tree: a lock freezes one tree, and a commit in another worktree cannot move it — so the old courtesy of reading the lock before every commit is retired wherever the hook is installed, and survives only in a clone without `core.hooksPath`); `scripts/dev/new-worktree.sh` sets both the worktree and the hook up, and then runs the [getting-started guide](../getting-started.md#working-in-a-git-worktree)'s steps 3 and 4 inside it (the templates in `Players/Templates` and a `host.yaml` with the `full-spoilers` export settings), so the `Generate.py` roundtrip gates run in the worktree too; the Python comes from the primary tree's venv, activated rather than copied.
-   **Auto-Execution:** In "test" mode, the application automatically loads a predefined test configuration (`playwright_tests_config.json`).
-   **Window Property Bridge:** Upon completion, the in-browser test writes a summary of the results to `window.__playwrightTestResults__`.
-   **Validation:** The Playwright script (`test_json/e2e/app.spec.js`) waits for the `window.__playwrightTestsComplete__` flag, reads the results, and asserts that all tests passed, reporting the final outcome to the command line.
-   **What the log carries, and where the rest is:** the spec writes the whole results payload (every row's conditions, logs and timestamps, stamped `mode`/`batch`/`testIds`/`flavour`, then `frozen`/`treeMoved` by `run-tests.js`) to `test-results/in-app-tests/test-results-<timestamp>.json`, and prints an `IN-APP RESULTS` summary in its place (`scripts/test/inAppSummary.js`): one `STATUS id duration` line per row (flagging a row that logged at error/warn level), the totals, the page's console-error count and every uncaught exception (`BROWSER PAGE ERROR (uncaught)` lines — before 2026-09-27 these never reached the log), and the path of that file. Until 2026-09-27 the spec printed the whole payload instead — 1–3 MB per CI run, where the GitHub log viewer cut the step off mid-dump and lost its verdict. `npm run test:analyze` follows the `Test results saved to:` line to that file (and still reads an older report's inline payload).
-   **A test file that fails to import fails the run:** test discovery (`frontend/modules/tests/testDiscovery.js`) imports every file in `TEST_CASE_FILES`; a file that throws (a syntax error, a missing export, an import-order TDZ) registers none of its rows, so the roster simply lacks them and every row-level check stays green. Until 2026-09-27 that was only a `[TestDiscovery] Failed to import <file>` BROWSER LOG line on a green run. Discovery now records each failure; the results carry `importFailures` (`[{ file, error }]`) and `summary.importFailureCount`; the `IN-APP RESULTS` summary prints `test files: N failed to import` and a `TEST FILE(S) FAILED TO IMPORT` block names each file and its error; `app.spec.js` fails the run on any; `compare-runs.js` lists them (`· N test file(s) FAILED TO IMPORT`) and treats a new one as a new failure (exit 1); `npm run test:analyze` prints a `[FAIL]` line for each. **Bundled**, there is no per-file import to fail: a syntax error in a test file fails `npm run build` (so `npm test -- --bundled` stops before a page loads), and a file that throws at evaluation aborts the whole bundle — the page never boots (`[Loader] Failed to load application: <error>` in the log) and the run fails on `Timeout waiting for tests to start`. Red either way, but the file is named only by the error text.
-   **A subscriber that throws fails the run (zero tolerance, since 2026-09-29):** the event bus (`frontend/app/core/eventBus.js`) catches a subscriber's throw and logs `Error in event handler for <event> (module: <m>):` — so the row that caused it can pass, and until CI1 the only trace of a thrown handler on a green run was one BROWSER LOG line among thousands, which each slice counted by hand. `app.spec.js` now counts those lines and fails the run on any (plan §48, the user's ruling). The phrase is imported, never typed: `frontend/app/core/eventBusMessages.js` exports `HANDLER_ERROR_PHRASE`, the bus builds its line from it, and the spec, `scripts/test/inAppSummary.js` and the one in-app row that watches for it all import it, so a reworded catch cannot make the gate go silently green. Only `error`-type console lines count (a row that merely names the phrase does not trip it), and the bus keeps its own tally (`eventBus.handlerErrorCount`): if the page counted more than the log carried (a logger level or keyword filter swallowed the line) the run fails on that too. The runner is sequential and prints `[PROGRESS i/n] <id>` as each row FINISHES, so the ledger attributes every line to the row whose marker follows it; a line with no marker after it is reported as NO ROW (the boot, the runner's end, or a row cut off). The `IN-APP RESULTS` summary always prints `handler errors (subscribers that threw inside the event bus): <logged> in the log, <n> counted by the page's event bus` (a 0 is printed, so it is checkable), and a red gate adds an `IN-APP HANDLER ERRORS` block naming each row, its count and its first line; neither ever repeats the phrase itself, so `grep -c "Error in event handler for"` over a log still counts only the page's lines. The assertion comes after the row and roster checks, so a failing row still reports first. The results file carries `pageDiagnostics: { consoleErrors, pageErrors, handlerErrors: { logged, pageCount, rows } }`. `consoleErrors` and uncaught `pageErrors` stay counted, not gated: their CI baseline is not zero (at `279d75d451`: `fast` ≈ 288 console errors / 187 uncaught, `apworld` ≈ 166 / 0, regression 2 / 0, bundled regression 1 / 0, `bot-walks` ≈ 45 console errors), while the handler phrase was 0 in every in-app step of the last three main runs and the last two `bot-walks` dispatches.
-   **A flake's rate, from CI (the repeat job):** `.github/workflows/test-substrates-repeat.yml` runs one row (`test`, a row id — or a comma-separated few) or one batch (`batch`) N times over, sequentially, on one runner — **`workflow_dispatch` only**, never on push (the per-push browser shards are at their bound; plan §48). Dispatch it from any branch: `gh workflow run test-substrates-repeat.yml -R PeerInfinity/Archipelago-CC -r <branch> -f test=<row id> -f repeat=8` (or `-f batch=apworld -f repeat=3`; also `-f mode=test-regression`, `-f bundled=true`). `repeat` is 1–20 (20 × the slowest batch fits the job's 180-minute cap); giving both `test` and `batch` is refused before any setup, and so is giving neither in `test-substrates` (its whole roster outruns the 600 s in-app budget — hence the batches); `test-regression` with neither runs its whole roster (~51 s on CI). Each run's results file is moved to `repeat/run-<i>.json` as soon as it exits (so the spec's 30-file pruning can never reach it), with `run-<i>.log` and `run-<i>.meta.json` (exit code, wall seconds) beside it; the directory is uploaded as the `repeat-runs` artifact. `scripts/test/summarize-repeat-runs.js` writes the run page's summary: **its first line is the rate** (`Rate: k/N passed`), then one row per run — PASS/FAIL (exit 0 **and** a results file), wall time, the row's own time (or rows passed/total for a batch), handler errors, why it was not green (the first failed condition, a runner stop, rows never run, handler errors, or no results file), and any line the row logged naming its `target` or what it `hooked` — then the rows that failed in any run. **The job is green when it RAN N times, not when N passed**: a rate is information, not a verdict, so read the first line. Compare two arms (a control and a fix) only when both came from this job — the same runner population. A new workflow file is not dispatchable until GitHub has registered it (`gh workflow run` answers HTTP 404); on a branch that is done with a temporary branch-only `push:` trigger, reverted in the next commit (ci-batches C1 did the same for `test-substrates-bot-walks.yml`).
-   **The import-order guard (vitest):** `frontend/modules/tests/moduleImportOrder.test.js` covers the shape behind the TDZ above for every module. It derives its file set from the tree — every non-test `.js` under `frontend/modules/<module>/` whose static imports (parsed with `es-module-lexer`, so multi-line and `../index.js` imports count) resolve to that module's own `index.js` — and imports each file first and second in a fresh **native** Node process (vitest's module runner does not model the TDZ: the read gives `undefined` and nothing throws). A module that imports its own index closes a cycle; it is harmless until the index reads one of that file's exports at evaluation, and then bites only when the file is imported first — which test discovery does in any mode that disables the module (P9: `quickLaunchTests.js` in `test-spoilers`). The fixture under `frontend/modules/tests/importOrderFixture/` is a live cycle the probe must see throw — the guard's positive control. It runs in the default vitest tier (`npm run test:unit`) and so in CI's `JavaScript Unit Tests` job. A new module that needs a global at evaluation fails there naming it; the shim (`IMPORT_ORDER_SHIM`) holds only `window` and `location`.
-   **The in-app budget, and why nothing is retried:** the in-app runner races the whole roster against one wall-clock budget (`AUTO_START_TIMEOUT_MS` in `frontend/modules/tests/testLogic.js`); when it expires the page publishes its results at once and the spec prints `IN-APP RUN DID NOT FINISH ITS ROSTER` and fails. `TEST_AUTO_START_TIMEOUT_MS=<ms> npm test …` shrinks the budget for one run (passed to the page as `?autoStartTimeoutMs=`; `run-tests.js` refuses anything but a positive integer), so that path can be driven in minutes. Playwright never retries (`playwright.config.js` `retries: 0`, on CI too): the whole in-app roster is ONE Playwright test, so a retry re-ran every row against the same budget. Until 2026-09-27 CI retried twice, and three ten-minute attempts outran the 30-minute job cap on every full-roster substrates run; ⚠ `gh run view --log` cut that step's log off inside the first attempt's results dump, which read as a 17-minute hang — the full job log (`gh api repos/<owner>/<repo>/actions/jobs/<job-id>/logs`) showed all three attempts. To re-run a red row, run it alone: `--test=<id>`.

This end-to-end pipeline ensures a high degree of confidence that the frontend client is a faithful and accurate implementation of Archipelago's game progression logic.

### Multiclient Testing

The project includes end-to-end multiclient tests that verify client-server communication and location check synchronization between multiple clients.

**Test Configurations:**

The multiclient tests (`test_json/e2e/multiclient.spec.js`) support two configurations:

1. **Multi-Client Test (Default)**: Tests both clients simultaneously
   - Client 1: Sends location checks via automatic timer
   - Client 2: Receives location checks from the server
   - Verifies that both clients stay synchronized
   - Run with: `npx playwright test test_json/e2e/multiclient.spec.js`

2. **Single-Client Test**: Tests only one client
   - Useful for debugging client connection and timer functionality
   - Run with: `ENABLE_SINGLE_CLIENT=true npx playwright test test_json/e2e/multiclient.spec.js`

**Running Multiclient Tests:**

```bash
# Run multi-client test (default)
npx playwright test test_json/e2e/multiclient.spec.js

# Run multi-client test in headed mode (visible browser)
npx playwright test test_json/e2e/multiclient.spec.js --headed

# Run single-client test
ENABLE_SINGLE_CLIENT=true npx playwright test test_json/e2e/multiclient.spec.js

# Run single-client test in headed mode
ENABLE_SINGLE_CLIENT=true npx playwright test test_json/e2e/multiclient.spec.js --headed

# Run specific test by name
npx playwright test test_json/e2e/multiclient.spec.js -g "multiclient timer test"
```

**What the Tests Verify:**

- **Server Connection**: Both clients successfully connect to the Archipelago server
- **Auto-Connect**: URL parameters (`autoConnect=true`, `server`, `playerName`) work correctly
- **Location Checks**: Client 1 sends location checks that are received by the server
- **Synchronization**: Client 2 receives all location checks sent by Client 1
- **Inventory Updates**: Both clients maintain synchronized inventory state
- **Server Management**: Tests automatically start and stop a local Archipelago server

**Test Architecture:**

- Tests use URL parameters to configure clients: `?mode=test-multiclient-client1&autoConnect=true&server=ws://localhost:38281&playerName=Player1`
- Each test mode loads a specific test configuration (`playwright_tests_config-client1.json` or `playwright_tests_config-client2.json`)
- The tests automatically handle server lifecycle (start before test, stop after test)
- Results are saved to `test_results/multiclient/` with detailed logs and summaries

**Prerequisites:**

- A development server running on `localhost:8000` (start with `python -m http.server 8000`; another port via `TEST_PORT`, see above)
- The `MultiServer.py` script must be accessible in the project root
- An Archipelago seed file in `frontend/presets/adventure/AP_14089154938208861744/`

## Automated Testing Across All Templates

For testing multiple games efficiently, use the automated testing script that handles the complete pipeline for all templates:

### Quick Start with Automation

**⚠️ IMPORTANT: Prerequisites Required**

```bash
# 1. Activate your virtual environment (REQUIRED)
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 2. Start the development server (REQUIRED - in another terminal)
python -m http.server 8000

# 3. Run the automation script
# Test all templates in the default Templates directory
python scripts/test/test-all-templates.py

# Test templates from a custom directory
python scripts/test/test-all-templates.py --templates-dir /path/to/templates

# Custom output file location
python scripts/test/test-all-templates.py --output-file custom-results.json

# Customize which files to skip (default skips non-game templates)
python scripts/test/test-all-templates.py --skip-list "Archipelago.yaml" "Universal Tracker.yaml"

# Test all files (including non-games) by providing an empty skip list
python scripts/test/test-all-templates.py --skip-list

# Test only specific templates (include list overrides skip list)
python scripts/test/test-all-templates.py --include-list "Adventure.yaml" "A Short Hike.yaml"

# Test a single template
python scripts/test/test-all-templates.py --include-list "Adventure.yaml"

# NEW: Partial execution modes
# Only run generation (export) step, skip spoiler tests
python scripts/test/test-all-templates.py --export-only

# Only run spoiler tests, skip generation (requires existing rules files)
python scripts/test/test-all-templates.py --test-only

# Start processing from a specific template file (alphabetically ordered)
python scripts/test/test-all-templates.py --start-from "Adventure.yaml"
```

**Prerequisites:**
- **Virtual Environment**: The script will detect and warn if not activated. Generation may freeze without proper dependencies.
- **HTTP Server**: Required for spoiler tests (not needed for `--export-only`). The script will exit with a clear error if not running on `localhost:8000`.
- **Playwright Setup**: If running spoiler tests, ensure you've installed Playwright browsers: `npx playwright install chromium` (see `../getting-started.md` for details).

### New Execution Modes

The script now supports partial execution and resumption options for more flexible testing workflows:

**`--export-only`**: Only runs the generation (export) step, skipping all spoiler tests
- **Use case**: Quickly generate rules files for multiple games without running time-consuming tests
- **No HTTP server required**: Can run without the development server
- **Fast bulk processing**: Ideal for generating data files for later analysis

**`--test-only`**: Only runs spoiler tests, skipping the generation step
- **Use case**: Re-test games after fixing JavaScript rule engine issues without regenerating data
- **Requires existing files**: Rules and sphere log files must already exist from a previous run
- **Efficient debugging**: Test logic fixes without waiting for generation

**`--start-from`**: Begin processing from a specific template file, skipping all files before it alphabetically
- **Use case**: Resume testing after interruption or start from a specific game
- **Alphabetical ordering**: Files are processed in sorted order, so you can predict the sequence
- **Recovery**: Perfect for continuing long test runs that were interrupted

The automation script (`scripts/test/test-all-templates.py`) provides:

- **Complete Pipeline Automation**: Runs Generate.py, spoiler tests, and analysis for each template
- **Partial Execution Modes**: Use `--export-only` or `--test-only` to run specific pipeline stages
- **Resume from Point**: Use `--start-from` to continue processing from a specific template file  
- **Comprehensive Metrics**: Captures error/warning counts, sphere progression, and pass/fail status
- **Smart Filtering**: Automatically skips non-game templates by default, with options for custom skip/include lists
- **Targeted Testing**: Use `--include-list` to test only specific templates, perfect for retesting after fixes
- **Incremental Updates**: Results saved after each template to prevent data loss
- **Detailed JSON Output**: Structured results with timestamps and diagnostic information
- **Progress Tracking**: Real-time feedback and summary statistics

**Output Location**: Results are saved to `scripts/output/spoiler-minimal/test-results.json` (or the appropriate subdirectory based on test type) with complete metrics for each game including:
- Generation success/failure with error and warning counts
- Spoiler test results with sphere progression details  
- First error/warning lines for quick debugging
- Execution timestamps and performance data

This automated approach is ideal for regression testing, validating multiple games simultaneously, or generating comprehensive test reports across the entire game catalog.

### Test Results Visualization

After running the automation script, generate a visual chart of the test results:

```bash
# Generate all charts (processes all test types and generates summary)
python scripts/docs/generate-test-chart.py

# Generate a single chart for a specific test type (all three options required)
python scripts/docs/generate-test-chart.py \
    --input-file scripts/output/spoiler-minimal/test-results.json \
    --output-file docs/json/developer/guides/test-results-minimal.md \
    --test-type minimal
```

The chart generation script (`scripts/docs/generate-test-chart.py`) creates comprehensive markdown tables showing:

- **Game Name**: Human-readable game names
- **Test Result**: Pass/fail status with visual indicators (✅ ❌ ❓)
- **Generation Errors**: Count of errors during world generation
- **Sphere Reached**: How far the test progressed before completion/failure
- **Max Spheres**: Total logical spheres available in the game
- **Progress**: Visual progress indicators with percentages

**📊 [View Current Test Results](../test-results/test-results-summary.md)** - Live status of all template tests

The generated chart includes summary statistics, color-coded progress indicators, and detailed notes explaining each metric. This provides an at-a-glance overview of the health of all game templates and helps identify which games may need attention.

## Running the Complete Testing Pipeline (Manual Process)

To test a new game implementation, follow these steps:

### Prerequisites

**⚠️ IMPORTANT: Complete Development Environment Setup First**

Before following these testing instructions, you must first set up your development environment by following the steps in `../getting-started.md`. This includes:

- Setting up a Python virtual environment (`.venv`)
- Installing required dependencies (`pip install -r requirements.txt`)
- Configuring your local development server

If you skip the getting-started setup, you may encounter dependency errors or other issues during the testing process.

### Testing-Specific Prerequisites

1. **Clear Players Directory:** Ensure the main `Players/` directory contains no `.yaml` files. This prevents Archipelago from treating them as additional players in multiworld generation. The `Players/Templates/` subdirectory should contain all template files.

2. **Generate Template Files:** If not already done, generate template files:
   ```bash
   python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
   ```

3. **Configure Settings:** In `host.yaml`, verify the appropriate testing settings are enabled. Use the `scripts/setup/update_host_settings.py` script for easy configuration:

   **For minimal spoiler testing** (basic sphere validation):
   ```bash
   python scripts/setup/update_host_settings.py minimal-spoilers
   ```

   **For full spoiler testing** (includes all location tracking):
   ```bash
   python scripts/setup/update_host_settings.py full-spoilers
   ```

   **For normal operation** (disable testing features):
   ```bash
   python scripts/setup/update_host_settings.py normal
   ```

4. **Understand Spoiler Levels:** The `sphere_log.jsonl` file is only generated when spoiler level is 2 or higher. Since the default is level 3, sphere logs are generated by default. Command line options:
   - `--spoiler 0` (NONE): No spoiler files generated
   - `--spoiler 1` (BASIC): Only Spoiler.txt without playthrough or paths
   - `--spoiler 2` (PLAYTHROUGH): Spoiler.txt with playthrough + sphere_log.jsonl
   - `--spoiler 3` (FULL): Spoiler.txt with playthrough and paths + sphere_log.jsonl

### Step-by-Step Process

1. **Choose Your Game:** Select a game to test (e.g., "A Hat in Time"). Find the corresponding:
   - Template file name (e.g., "A Hat in Time.yaml")
   - Python directory (e.g., "worlds/ahit")

2. **Create Game-Specific Exporter (if needed):** In `exporter/games/`, create a new file for your game if it doesn't exist. The exporter uses a tiered structure:
   - `exporter/games/base/generic.py` - Base generic handler (use as template)
   - `exporter/games/official/` - Official Archipelago games (e.g., `ahit.py`)
   - `exporter/games/unofficial/` - Unofficial/community games

   Create your game handler in the appropriate subdirectory based on whether it's an official or unofficial world.

3. **Generate Test Data:** Run Generate.py for your chosen game:
   ```bash
   # Activate your virtual environment first
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   
   # Then run the generation command
   python Generate.py --weights_file_path "Templates/A Hat in Time.yaml" --multi 1 --seed 1 > generate_output.txt
   ```
   
   **Understanding Seeds and Output Filenames:**
   
   When you specify `--seed 1`, the output filename will always be predictable and consistent: `AP_14089154938208861744`. This makes automation and testing easier because you know exactly what files will be generated.
   
   The output directory structure follows this pattern:
   - **Template file:** `Templates/A Hat in Time.yaml`
   - **Output directory:** `frontend/presets/ahit/` (based on world_directory mapping)
   - **Generated files:** All prefixed with `AP_14089154938208861744`
   
   Examples of the directory naming convention:
   - `"A Hat in Time.yaml"` → `ahit/`
   - `"A Short Hike.yaml"` → `shorthike/`  
   - `"Adventure.yaml"` → `adventure/`
   
   **Note:** Directory names are determined by the `world_directory` field in `scripts/data/world-mapping.json`, not by converting spaces to underscores.
   
   **Important:** Use `"Templates/[GameName].yaml"` as the path, **not** `"Players/Templates/[GameName].yaml"`. The `--weights_file_path` is relative to the `player_files_path` setting in `host.yaml` (which defaults to "Players"), so the full path becomes `Players/Templates/[GameName].yaml` automatically.
   
   **Check for Export Errors:** Examine `generate_output.txt` for error messages or parsing failures. If errors exist:
   - Fix game-specific issues in your game's exporter file (e.g., `exporter/games/official/[game].py`)
   - Fix general exporter bugs in the main exporter code
   
   This creates files in `frontend/presets/[game]/AP_[seed]/`:
   - `AP_[seed].archipelago`
   - `AP_[seed]_rules.json` (the logic under test)
   - `AP_[seed]_sphere_log.jsonl` (the expected progression)
   - `AP_[seed]_Spoiler.txt`

4. **Run the Test:** Execute the spoiler validation using URL parameters to specify your test configuration.

   **Note:** If this is your first time running tests, make sure you've completed the test setup in `../getting-started.md` including `npm install` and `npx playwright install chromium`.

   **Basic Usage:**
   ```bash
   # Test with game parameter (recommended, seed defaults to 1)
   npm test --mode=test-spoilers --game=ahit
   
   # Test with specific seed (if different from default)
   npm test --mode=test-spoilers --game=ahit --seed=5
   
   # Test with specific rules file (alternative)
   npm test --rules=./presets/ahit/AP_14089154938208861744/AP_14089154938208861744_rules.json
   ```
   
   **Available Test Variants:**
   ```bash
   # Basic test (seed defaults to 1)
   npm test --mode=test-spoilers --game=alttp
   
   # With visible browser (useful for debugging)
   npm run test:headed --mode=test-spoilers --game=alttp
   
   # With debug mode
   npm run test:debug --mode=test-spoilers --game=alttp
   
   # With Playwright UI
   npm run test:ui --mode=test-spoilers --game=alttp
   
   # Test with specific seed (if different from default)
   npm test --mode=test-spoilers --game=adventure --seed=5
   ```
   
   **Parameter Methods Explained:**
   
   There are two ways to specify test parameters:
   
   1. **URL Parameters (Recommended):**
      - `npm test --mode=test-spoilers --game=ahit`
      - Parameters become URL query strings in the test browser
      - Clean and intuitive command-line interface
   
   2. **Environment Variables (Legacy):**
      - `RULES_OVERRIDE=./presets/ahit/AP_14089154938208861744/AP_14089154938208861744_rules.json npm test`
      - Direct file path specification
      - Still supported but less convenient
   
   **Advantages of URL Parameter Approach:**
   - No need to modify configuration files for temporary testing
   - Easy to test multiple rule sets without file conflicts
   - Cleaner git history (no configuration file changes)
   - Command-line friendly for automation and scripting
   - Preserves original modes.json configuration
   
   **Alternative Method (not recommended):** You can also configure the test by editing `frontend/modes.json`, but using the URL parameter is preferred:
   ```json
   "test-spoilers": {
     "rulesConfig": {
       "path": "./presets/a_hat_in_time/AP_14089154938208861744/AP_14089154938208861744_rules.json",
       "enabled": true
     },
     "testsConfig": {
       "path": "./playwright_tests_config-spoilers.json",
       "enabled": true
     }
   }
   ```
   
   **Result Analysis:** After testing, run `npm run test:analyze` to generate a comprehensive, easier-to-read analysis saved to `playwright-analysis.txt` (it reads the in-app results from the file the run saved in `test-results/in-app-tests/`).
   
   **Available Parameters:**
   - `--mode`: Specifies the test mode (e.g., `test`, `test-spoilers`, `test-full`, `test-regression`)
   - `--game`: Specifies the game to test (e.g., `alttp`, `adventure`, `a_hat_in_time`)
   - `--seed`: Specifies the seed number for testing (defaults to 1 if not specified)
   - `--rules`: Path to the rules JSON file to use for testing
   
   This analysis includes:
   - Structured test failure details with clear error messages
   - Performance metrics and timing information
   - Organized error logs grouped by category
   - Specific mismatch details for failed spoiler tests

### Understanding Test Results

**Success:** If the JavaScript implementation matches the Python logic perfectly, the test passes with no mismatches.

**Failures:** Mismatches indicate areas where the JavaScript `RuleEngine` needs improvement:
- **Unknown rule types:** Missing support for game-specific rule types (e.g., "capability" rules)
- **Region reachability issues:** Incorrect logic for determining accessible areas
- **Helper function gaps:** Missing game-specific logic implementations

### Common Issues and Solutions

#### Issue: Unknown Rule Types
```
[ruleEngine] [evaluateRule] Unknown rule type: capability
```
**Solution:** Implement support for the rule type in the JavaScript `RuleEngine`.

#### Issue: Region Reachability Mismatches
```
REGION MISMATCH: Regions accessible in LOG but NOT in STATE: Badge Seller, Mafia Town Area
```
**Solution:** Check region access rules and implement missing helper functions.

#### Issue: Location Accessibility Mismatches
```
> Locations accessible in STATE (and unchecked) but NOT in LOG: Collect 15 Seashells
```
**Solution:** The JavaScript rule engine is making a location accessible that shouldn't be at this sphere. Check the corresponding rule in `worlds/[game]/Rules.py`. For example, "Collect 15 Seashells" might have a rule like:
```python
add_rule(multiworld.get_location("Collect 15 Seashells", player),
    lambda state: state.has("Seashell", player, 15))
```
This indicates the location requires collecting 15 Seashells before being accessible.

#### Issue: Players Directory Conflicts
If Generate.py picks up the wrong game, ensure no `.yaml` files exist in the main `Players/` directory.

### Implementing Fixes

When tests fail, create game-specific helper functions:

1. **Create Game Directory:** In `frontend/modules/shared/gameLogic/`, create a subdirectory for your game (e.g., `a_hat_in_time/`) based on the contents of the "generic" subdirectory

2. **Implement Helpers:** Base your JavaScript implementations on the Python functions found in `worlds/[game]/` directory. Key files to examine:
   - **`worlds/[game]/Rules.py`**: Contains the main location access rules and helper function calls
   - **`worlds/[game]/Regions.py`**: Defines region connections and exit rules  
   - **`worlds/[game]/Items.py`**: Item definitions and properties
   - **`worlds/[game]/Options.py`**: Game-specific settings that affect rule logic
   
   Look for `add_rule()` calls in `Rules.py` that reference your failing location name. The spoiler test will report missing helper functions or logic mismatches.

3. **Test Iteratively:** Re-run `npm test --mode=test-spoilers --game=[yourgame]` after each fix until all mismatches are resolved

### Debugging Tips

**Recommended Debugging Workflow:**
1. **Run Analysis**: Always run `npm run test:analyze` after a failed test for cleaner error reporting
2. **Identify Root Cause**: Look for the specific location name in the mismatch details
3. **Find Python Rule**: Search for the location name in `worlds/[game]/Rules.py` using grep or your editor
4. **Understand Requirements**: Examine the `add_rule()` call to understand what items/conditions are needed
5. **Check Item Names**: Verify that item names in the Python rules match those in your JavaScript implementation
6. **Test Incrementally**: Make one fix at a time and re-run tests to isolate issues

**Interactive Debugging:**
- Use `npm run test:headed --mode=test-spoilers --game=[yourgame]` to see the test running in a visible browser
- Check browser console for detailed rule evaluation logs
- Use the "Regions" panel to manually verify accessibility logic
- Compare failing locations between the spoiler log and current state output

**Example Debugging Session:**
```bash
# 1. Run test and get failure
npm test --mode=test-spoilers --game=a_short_hike

# 2. Generate readable analysis
npm run test:analyze

# 3. Examine the analysis file
cat playwright-analysis.txt

# 4. Look up the failing location rule
grep -n "Collect 15 Seashells" worlds/shorthike/Rules.py

# 5. Implement fix in exporter and retry
```

### Advanced Debugging Patterns

**Pattern 1: Multiple Location Failures → Variable Resolution Issue**

If you see many locations failing simultaneously that should require different counts of the same item:
```
> Locations accessible in STATE but NOT in LOG: Secret Island Peak, Lighthouse Golden Chest, North Cliff Golden Chest...
```

**Root Cause**: Lambda default parameters with variable references aren't being resolved.
```python
# Python uses closure variables
lambda state, min_feathers=min_feathers: state.has("Golden Feather", player, min_feathers)
```

**Solution**: Implement variable resolution in the analyzer to access function `__defaults__`.

**Pattern 2: Single Location with Count Requirements → Rule Engine Bug**

If one specific location fails that should require a certain quantity:
```
> Locations accessible in STATE but NOT in LOG: Collect 15 Seashells
```

**Root Cause**: Rule engine not properly handling count fields in `item_check` rules.
```json
// Generated rule has count field
{"type": "item_check", "item": "Seashell", "count": {"type": "constant", "value": 15}}
```

**Solution**: Enhance JavaScript rule engine to check `rule.count` in `item_check` cases.

**Pattern 3: Progressive Test Improvement**

Good debugging shows **progressive sphere advancement**:
1. **Initial**: Fails at Sphere 1.1 with 8 locations (major issue)
2. **After fix**: Fails at Sphere 1.2 with 1 location (minor issue)  
3. **After final fix**: All 37 spheres pass (success)

This indicates you're systematically resolving issues from major to minor.

**Pattern 4: Systematic Issue Classification**

| Error Type | Typical Cause | Fix Location |
|------------|---------------|--------------|
| 8+ locations failing | Variable resolution | `exporter/analyzer.py` |
| 1-2 locations failing | Rule engine logic | `frontend/modules/shared/ruleEngine.js` |
| Helper function errors | Missing game helpers | `exporter/games/{official,unofficial}/[game].py` |
| Region mismatches | Area access logic | Game-specific helpers |

### Common Anti-Patterns to Avoid

**❌ Location-Specific Hardcoding**
```python
# Don't do this
if location_name == "Secret Island Peak":
    return {"type": "item_check", "item": "Golden Feather", "count": 5}
```

**✅ General Pattern Recognition**
```python
# Do this instead - resolve variables generically
if rule.count and rule.count.type == 'name':
    resolved_value = self.resolve_variable(rule.count.name)
    if resolved_value is not None:
        rule.count = {'type': 'constant', 'value': resolved_value}
```

**❌ Game-Specific Rule Engine Changes**
Don't modify the rule engine for specific games - make it handle patterns generically.

**✅ Universal Rule Engine Enhancements**
```javascript
// Enhance item_check to handle count universally
if (rule.count !== undefined) {
  // Use count-based checking for any game
  result = currentCount >= requiredCount;
}
```

### Recognizing Systemic vs Game-Specific Issues

**🔧 Systemic Issues (Fix in Core Code)**
- **Multiple games affected**: If the same pattern fails across different games
- **Fundamental rule types**: Issues with `item_check`, `count_check`, `and`, `or` logic
- **Variable resolution**: Lambda default parameters not being resolved
- **Count handling**: Any item quantity requirement failures

**🎮 Game-Specific Issues (Fix in Game Exporter)**  
- **Unknown helper functions**: `can_fly`, `has_sword`, `can_melt_things`
- **Custom rule types**: Game-specific logic patterns
- **Unique mechanics**: Special item interactions or requirements
- **Single game failures**: Only one game shows the issue

**💡 Key Insight**: Our A Short Hike debugging revealed **two systemic issues** that benefit all games:
1. **Variable resolution in analyzer** - helps any game using lambda defaults
2. **Count support in rule engine** - fixes item quantity checks universally

This systematic approach ensures the JavaScript client faithfully replicates the authoritative Python game logic for accurate progression tracking.