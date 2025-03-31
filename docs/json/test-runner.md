# Test Runner Documentation

This document is likely to contain information that is out of date.

The Archipelago JSON Rules system includes automated testing to verify JavaScript rule evaluation matches Python behavior. Tests run automatically using Playwright, with comprehensive debug logging and result analysis.

## Prerequisites

Before running the tests, you need to install Playwright and its browser dependencies:

```bash
pip install playwright
playwright install
```

## Testing Methods

The system offers two testing approaches:

### 1. Automated Testing (Recommended)

Tests run directly from pytest without manual intervention. The process:

1. Runs the Python test case
2. Generates necessary JSON files
3. Starts a local HTTP server
4. Launches a headless browser
5. Executes frontend tests
6. Saves test results
7. Cleans up automatically

Example command:

```bash
pytest worlds/alttp/test/vanilla/TestLightWorld.py::TestLightWorld -v
```

### 2. Web-Based Testing Interface

A user interface for interactively running tests is available:

- View and run individual test cases
- See test results with full details
- Toggle test data loading
- Run all tests with results summary

Start a local server:

```bash
python -m http.server 8000
```

The interface is accessible at:

```
http://localhost:8000/frontend/index.html
```

Then select the "Test Cases" view.

## Test Components

### Automated Test Pipeline

The automated testing pipeline:

1. **Python Test Execution**: Runs test cases and exports JSON data
2. **Browser Automation**: Uses Playwright to load and run frontend tests
3. **State Initialization**: Sets up inventory and game state
4. **Test Case Execution**: Evaluates location accessibility rules
5. **Validation**: Verifies results match expected outcomes
6. **Results Analysis**: Collects and analyzes results

### Test Runner Components

The test system uses these files:

- `automate_frontend_tests.py`: Launches Playwright tests
- `frontend/assets/locationTester.js`: Executes test cases
- `frontend/assets/testLogger.js`: Comprehensive logging
- `frontend/assets/testResultsDisplay.js`: UI for results
- `frontend/assets/testCaseUI.js`: Interactive test UI

### State Management for Tests

Tests use a dedicated state initialization process:

1. Load rules from test data
2. Initialize inventory with required/excluded items
3. Process progressive items
4. Compute region accessibility
5. Evaluate location access rules
6. Validate against expectations

## Generated Files

The testing process generates several files:

1. **Rule Definitions** (`test_output_rules.json`)

   - Exported rules from Python
   - Helper function references
   - Region graph information
   - Item and location data

2. **Test Cases** (`test_cases.json`)

   - Test specifications from Python
   - Location access requirements
   - Required/excluded items

3. **Test Results** (`test_results_automated.json`)

```javascript
{
  "summary": {
    "total": number,
    "passed": number,
    "failed": number,
    "percentage": number
  },
  "results": [{
    "location": string,
    "result": {
      "passed": boolean,
      "message": string,
      "expectedAccess": boolean,
      "requiredItems": string[],
      "excludedItems": string[]
    },
    "debugLog": LogEntry[]
  }]
}
```

4. **Debug Logs** (`debug_logs_automated.json`)

```javascript
{
  "timestamp": string,
  "testResults": TestResult[],
  "summary": {
    "total": number,
    "passed": number,
    "failed": number,
    "percentage": number,
    "failureAnalysis": {
      "byType": Record<string, TestResult[]>,
      "tracePatterns": {
        "helperCalls": string[],
        "failedRules": string[],
        "itemChecks": string[]
      },
      "commonPatterns": {
        "requiredItems": Record<string, number>,
        "locations": Record<string, number>,
        "rules": Record<string, number>
      }
    }
  },
  "ruleTraces": [{
    "timestamp": string,
    "trace": {
      "type": string,
      "rule": Rule,
      "depth": number,
      "result": boolean,
      "startTime": string,
      "endTime": string,
      "children": Trace[]
    }
  }]
}
```

## Debug Logging

The test system provides comprehensive debug logging:

### Rule Evaluation

- Step-by-step rule processing
- Helper function execution
- Inventory state changes
- Rule evaluation results

### Test Execution

- Test case setup
- Rule loading
- Location access checks
- Item management

### Failure Analysis

- Rule evaluation traces
- Inventory state at failure
- Helper execution logs
- Common failure patterns

## Test Case Types

The system tests several types of scenarios:

1. **Basic Accessibility**: Tests if locations are accessible with default items
2. **Item Requirements**: Tests locations that require specific items
3. **Progressive Items**: Tests locations requiring progressive items
4. **Exclusion Tests**: Tests behaviors when specific items are excluded
5. **Region Accessibility**: Tests path discovery through BFS

## Current Testing Status

As of March 1, 2025:

- TestLightWorld cases all pass (100%)
- Helper function implementation is largely complete
- Region traversal and path finding is working
- Progressive item handling works correctly

## Adding New Tests

To add new tests:

1. Create Test Cases in Python

```python
self.run_location_tests([
    ["Location Name", False, []],
    ["Location Name", True, ["Required Item"]],
    ["Location Name", False, [], ["Excluded Item"]]
])
```

2. Run Tests

```bash
pytest path/to/test_file.py -v
```

3. Debug Issues in UI

- Switch to "Test Cases" view
- Run individual tests to see results
- Check "Load Test Data" to ensure using correct data

## Interactive Test Interface

The test interface provides:

- List of all available test cases
- Individual test execution
- "Run All Tests" button
- Test status indicators
- Result summary statistics
- Data source indicator

### Test Result Analysis

Test failures can be analyzed in several ways:

1. Using the UI to examine individual test results
2. Reviewing debug logs for rule evaluation details
3. Looking for patterns in failing locations
4. Examining helper function execution

## Debug Tools

For advanced debugging:

```javascript
// Enable file saving and detailed logging
TestLogger.enableFileSaving = true;
TestLogger.enableDebugLogging = true;

// Configure Playwright
// (in automate_frontend_tests.py)
browser = await playwright.chromium.launch(
  (headless = False), // Set to false to see browser
  (slowMo = 100) // Slow execution for visual debugging
);
```
