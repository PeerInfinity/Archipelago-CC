# Developer Guide

This guide covers the technical details of the Archipelago JSON Rules system.

## Rule Export System

### Overview
The system extracts rules from Archipelago's Python codebase and converts them to a JSON format that can be evaluated in JavaScript.

### Components

#### Rule Parser (`worlds/generic/RuleParser/`)
- `__init__.py`: Main export functionality
- `analyzer.py`: Analyzes Python rule functions
- `exporter.py`: Converts rules to JSON format
- `games/`: Game-specific helper functions

#### Rule Engine (`frontend/assets/ruleEngine.js`)
- Evaluates converted rules in JavaScript
- Manages inventory state
- Provides debugging tools

### JSON Format

Rules are exported in a structured format:
```json
{
  "locations": {
    "1": {  // Player number
      "Location Name": {
        "name": "Location Name",
        "region": "Region Name",
        "access_rule": {
          "type": "and|or|item_check|...",
          "conditions": [...]
        },
        "path_rules": {...}
      }
    }
  },
  "items": {...},
  "item_groups": {...},
  "progression_mapping": {...}
}
```

## Test Runner

### Running Tests
1. Configure test execution in VS Code:
   ```json
   {
       "name": "Python: TestLightWorld",
       "type": "debugpy",
       "request": "launch",
       "module": "pytest",
       "args": [
           "worlds/alttp/test/vanilla/TestLightWorld.py::TestLightWorld",
           "-v",
           "--capture=tee-sys",
           "-o", "log_cli=true",
           ">", "pytest_output.txt"
       ],
       "console": "integratedTerminal"
   }
   ```

2. Run the test to generate JSON files:
   - `test_output_rules.json`: Converted rules
   - `test_cases.json`: Test cases

3. Start a local server:
   ```bash
   python -m http.server 8000
   ```

4. Open test runner:
   ```
   http://localhost:8000/frontend/test_runner.html
   ```

### Test Results
Results are saved to `test_results.json` with:
- Overall pass/fail counts
- Detailed results per test case
- Debug logs for failed tests

## Creating New Interfaces

The exported JSON format can be used to create new web interfaces:

1. Load the JSON:
   ```javascript
   const response = await fetch('rules.json');
   const rulesData = await response.json();
   ```

2. Create an inventory:
   ```javascript
   const inventory = new Inventory(items, excludeItems, progressionMapping);
   ```

3. Evaluate rules:
   ```javascript
   const isAccessible = evaluateRule(location.access_rule, inventory);
   ```

See the Archipidle-json implementation for a complete example.

## Integration with Archipelago

The rule export is integrated with Archipelago's generation process:
```python
# In generation code
export_game_rules(multiworld, output_dir, "rules")
```

This creates:
- rules.json: Contains all location access rules
- (Future) Additional game-specific data