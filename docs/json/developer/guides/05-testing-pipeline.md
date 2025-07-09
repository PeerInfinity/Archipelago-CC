# Developer Guide: Testing Pipeline

This project contains a comprehensive testing pipeline designed to validate that the frontend JavaScript implementation of the game logic behaves identically to the authoritative Python implementation from the main Archipelago project. Understanding this data flow is essential for debugging rules, fixing test failures, and ensuring the accuracy of the web client.

## Testing Philosophy

The core principle is **behavioral equivalence**. The JavaScript `RuleEngine` and `StateManager` must produce the same accessibility results as their Python counterparts given the same set of items and game settings. The entire pipeline is built to automate this comparison.

## The Data Flow: From Python to JavaScript

The testing process involves several stages, moving data from the original source code to the frontend for validation.

```
┌─────────────────┐   1. Parses   ┌──────────────────┐   2. Converts   ┌────────────────────────┐
│ Python Test     ├──────────────►│ Python Game Logic├──────────────► │  JSON Test Definitions │
│ (TestVanilla.py)│               │   (Rules.py)     │                │ (testLightWorld_tests.json)│
└─────────────────┘               └──────────────────┘                └────────────┬───────────┘
                                                                                   │ 3. Consumes
                                                                                   ▼
┌─────────────────┐   5. Validates   ┌──────────────────┐  4. Evaluates   ┌────────────────────────┐
│  Test Results   │◄───────────────┤  Frontend Tests  ├────────────────►│   JSON Game Rules      │
│     (UI)        │                │   (TestCaseUI)   │                 │   (vanilla_rules.json) │
└─────────────────┘                └──────────────────┘                 └────────────────────────┘
```

### Stage 1: Python Source & Tests (`worlds/alttp/test/vanilla/`)

- **Source of Truth:** The original game logic is defined in Python files like `worlds/alttp/Rules.py` and `worlds/alttp/StateHelpers.py`.
- **Test Cases:** The tests that verify this logic are also written in Python (e.g., `worlds/alttp/test/vanilla/TestLightWorld.py`). A typical test asserts that a specific location is or is not accessible given a certain collection of items.

  ```python
  # From a Python test file
  self.run_location_tests([
    # Location, Expected Access, Required Items, Excluded Items
    ["King's Tomb", True, ["Pegasus Boots", "Titans Mitts", "Book of Mudora"]],
    ["Sahasrahla", False, ["Green Pendant"], ["Talk to Sahasrahla"]],
  ])
  ```

### Stage 2: The Exporter (`exporter/`)

When a Python test like `TestLightWorld.py` is run, it doesn't just execute the tests in Python. It has been hooked to also trigger our custom exporter.

- **`exporter.py`**: This script orchestrates the export process.
- **`analyzer.py`**: This is the core translation engine. It uses Python's `ast` module to parse the `lambda` functions in `Rules.py` and converts them into our standardized JSON rule tree format.
- **`export_test_data()`**: This specific function within the exporter reads the test definitions (like the list passed to `run_location_tests`) and converts them into a JSON format.

### Stage 3: JSON Data Files (`frontend/tests/vanilla/`)

The exporter generates two critical JSON files for each test set:

1.  **`vanilla_rules.json`**: A complete dump of the entire game's logic, including all region data, location rules, item definitions, and game settings, all translated into the JSON format that our frontend understands.
2.  **`testLightWorld_tests.json`**: The list of test cases converted into JSON. Each entry contains the location name, the expected boolean result, and the lists of required and excluded items.

### Stage 4: Frontend Test Execution (`frontend/modules/testCases/`)

The **Test Cases** panel in the web client is the user interface for this pipeline.

- **`testCaseUI.js`**: Manages the UI, allowing you to select and run test sets.
- **Loading:** When you select a test set (e.g., "Light World"), the UI loads the corresponding `vanilla_rules.json` and `testLightWorld_tests.json` files. The rules are sent to the `StateManager` worker to configure its logic.
- **Execution:** When you click "Run" for a specific test, the `TestCaseUI` sends a command to the `StateManager` worker with the test parameters (location name, required items, excluded items).
- **Evaluation:** The `StateManager` worker sets up a temporary inventory based on the test parameters and uses its `RuleEngine` to evaluate the accessibility of the target location against the loaded rules. It returns the boolean result to the UI.

### Stage 5: Validation and Results

The `TestCaseUI` receives the boolean result from the worker and compares it to the `expectedResult` from the `_tests.json` file.

- **Pass/Fail:** The result (`✓ PASS` or `❌ FAIL`) is displayed in the UI.
- **Required Item Validation (CICO):** For tests that are expected to pass, the UI runs a further validation loop. It removes each "required" item one by one and re-runs the check, asserting that the location now becomes _inaccessible_. This confirms that every listed item is truly required.
- **State Comparison:** For even deeper validation, the Python tests now also generate a detailed log (`_tests_log.jsonl`) of the game state at each step. The `TestCaseUI` reads this log and compares the frontend's state snapshot against the Python log at each corresponding step, flagging any mismatches in inventory or location accessibility.

## Running Automated Tests with Playwright

The entire pipeline can be run automatically from the command line using Playwright.

- **Test Mode:** Running `npm test` launches the web client with the `?mode=test` URL parameter.
- **Auto-Execution:** In "test" mode, the application automatically loads a predefined test configuration (`playwright_tests_config.json`) and runs the entire in-browser test suite.
- **`localStorage` Bridge:** Upon completion, the in-browser tests write a summary of the results to `localStorage`.
- **Validation:** The Playwright script (`tests/e2e/app.spec.js`) waits for this `localStorage` flag, reads the results, and asserts that all tests passed, reporting the final outcome to the command line.

This end-to-end pipeline ensures a high degree of confidence that the frontend client is a faithful and accurate implementation of Archipelago's game logic.
