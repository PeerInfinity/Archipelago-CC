# Testing Guide: Single Game Implementation

This guide explains how to test that your frontend JavaScript implementation correctly simulates game logic, matching the authoritative Python implementation from the main Archipelago project.

## Testing Philosophy

The core principle is **progression equivalence**. The JavaScript `StateManager` and `RuleEngine` must unlock locations in the same order (or "spheres") as the original Python game generator given the same world seed and settings.

## The Data Flow: From Python Generation to JavaScript Validation

```
┌──────────────────┐   1. Generates   ┌────────────────────────┐
│ Generate.py      ├───────────────►│   Spoiler Log & Rules  │
│ (Python Backend) │                  │ (..._spheres_log.jsonl)│
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

-   **Source of Truth:** The game generation process, orchestrated by `Generate.py`, is the source of truth. When run with a spoiler level of 2 or higher, it produces a detailed log of the game's logical progression.
-   **Spoiler Log (`_spheres_log.jsonl`):** This file is the ground truth for testing. It contains a sequence of "spheres," where each sphere lists the locations that become accessible after collecting all the items from the previous spheres.

### Stage 2: The Exporter

-   During the same `Generate.py` run, the custom exporter is triggered.
-   **`exporter.py`**: Orchestrates the process of parsing the game's rules, regions, and items.
-   **`analyzer.py`**: Uses Python's `ast` module to convert the game's logic into standardized JSON rule tree format.

### Stage 3: JSON Data Files

The generation and export process creates two critical JSON files for each seed:

1.  **`..._rules.json`**: A complete dump of the game's logic, including all region data, location rules, item definitions, and game settings. This is the logic that will be **under test**. The structure of this file follows the schema defined in `frontend/schema/rules.schema.json`.
2.  **`..._spheres_log.jsonl`**: The list of progression spheres, which serves as the **expected result**.

### Stage 4: Frontend Test Execution

The **Test Spoilers** panel in the web client validates the implementation:

-   **Loading:** The test loads the `_rules.json` file into the `StateManager` worker, then loads the corresponding `_spheres_log.jsonl` file.
-   **Execution & Validation:** When you click "Run Full Test," it simulates a full playthrough sphere by sphere:
    1.  Starts with an empty inventory
    2.  Gets the list of accessible locations from the frontend `StateManager`
    3.  Compares this list against the locations in the current sphere from the spoiler log
    4.  "Checks" all locations from the current sphere, adding their items to inventory
    5.  Repeats until all spheres are checked or a mismatch is found

### Stage 5: Results

-   **Pass/Fail:** Each sphere comparison is displayed in the UI (green = match, red = mismatch)
-   **Mismatch Details:** Failures provide detailed reports showing which locations were accessible in the frontend but not in the log, and vice-versa

## Testing Your Game Implementation

### Prerequisites

**⚠️ IMPORTANT:** First complete the development environment setup in `../getting-started.md`, including:
- Setting up a Python virtual environment (`.venv`)
- Installing required dependencies (`pip install -r requirements.txt`)
- Configuring your local development server

### Step-by-Step Process

1. **Choose Your Game:** Select a game to test (e.g., "A Hat in Time"). Note:
   - Template file name (e.g., "A Hat in Time.yaml")
   - Python directory (e.g., "worlds/ahit")

2. **Create Game-Specific Exporter (if needed):**

   In `exporter/games/`, create a new file for your game if it doesn't exist (e.g., `exporter/games/ahit.py`).

   **Recommended Approach:** Inherit from `GenericGameExportHandler`:

   ```python
   """A Hat in Time game-specific export handler."""

   from typing import Dict, Any
   from .generic import GenericGameExportHandler
   import logging

   logger = logging.getLogger(__name__)

   class AHitGameExportHandler(GenericGameExportHandler):
       GAME_NAME = 'A Hat in Time'

       # That's it! GenericGameExportHandler provides:
       # - Automatic item data discovery
       # - Intelligent rule analysis with pattern matching
       # - Recognition of common helper patterns (has_*, can_*, etc.)
       # - Working defaults that reduce boilerplate

       # Only override methods when you need custom behavior:
       # def expand_rule(self, rule):
       #     # Custom rule handling here
       #     return super().expand_rule(rule)
   ```

   **Handler Discovery:** Your handler will be automatically discovered and registered when the module loads, as long as:
   - The class inherits from `BaseGameExportHandler` or `GenericGameExportHandler`
   - The class has a `GAME_NAME` attribute matching the game's name exactly

   **When to use BaseGameExportHandler directly:** Only inherit from `BaseGameExportHandler` if you need complete control over all export methods and don't want the intelligent defaults from `GenericGameExportHandler`. See `exporter/games/base.py` and `exporter/games/generic.py` for details.

3. **Generate Test Data:** Run Generate.py for your chosen game:
   ```bash
   # Activate your virtual environment first
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   
   # Run the generation command
   python Generate.py --weights_file_path "Templates/A Hat in Time.yaml" --multi 1 --seed 1 > generate_output.txt
   ```
   
   **Understanding Seeds and Output:**
   - Using `--seed 1` always produces the same output filename: `AP_14089154938208861744`
   - Output directory: `frontend/presets/ahit/` (same abbreviation as Python directory)
   - Generated files: All prefixed with `AP_14089154938208861744` if the generator seed was set to 1
   
   **Check for Export Errors:** Examine `generate_output.txt` for error messages. If errors exist, fix issues in your `exporter/games/[game].py` file.
   
   This creates files in `frontend/presets/[game]/AP_[seed]/`:
   - `AP_[seed]_rules.json` (the logic under test)
   - `AP_[seed]_spheres_log.jsonl` (the expected progression)

4. **Run the Test:** Execute the spoiler validation using the new parameter format:
   
   ```bash
   # Test with game and seed parameters (recommended)
   npm test --mode=test-spoilers --game=ahit --seed=1
   
   # Alternative test variants with new format
   npm run test:headed --mode=test-spoilers --game=ahit --seed=1  # Visible browser
   npm run test:debug --mode=test-spoilers --game=ahit --seed=1   # Debug mode
   npm run test:ui --mode=test-spoilers --game=ahit --seed=1      # Playwright UI
   ```

   **Parameter Explanation:**
   - `--mode=test-spoilers`: Specifies the test mode for spoiler validation
   - `--game=ahit`: Specifies the game directory (matches the preset directory name)
   - `--seed=1`: Specifies the seed number (defaults to 1 if not specified)
   
   **Legacy Format (still supported):**
   ```bash
   # Using RULES_OVERRIDE (older method, still works)
   RULES_OVERRIDE=./presets/ahit/AP_14089154938208861744/AP_14089154938208861744_rules.json npm test
   ```

   **Important:** With the legacy format, the path to the rules file should be relative to the `frontend` directory, not the project root.
   
   **Result Analysis:** This will generate the file `playwright-report.json` with the full test results. After testing, you can also run `npm run test:analyze` to generate a summary of this data saved to `playwright-analysis.txt`.

## Understanding Test Results

**Success:** The JavaScript implementation matches the Python logic perfectly.

**Failures:** Mismatches indicate areas where the JavaScript `RuleEngine` needs improvement:
- **Unknown rule types:** Missing support for game-specific rule types
- **Region reachability issues:** Incorrect logic for determining accessible areas
- **Helper function gaps:** Missing game-specific logic implementations

## Common Issues and Solutions

### Data Issues: Missing or Corrupt JSON Data

**⚠️ CRITICAL:** If you notice missing or corrupt data in the generated JSON files, your **first priority** is to fix the exporter to export the correct data. **Do not attempt to work around data issues in the frontend.** Instead:

1. **Stop all frontend work immediately**
2. **Fix the exporter** (`exporter/games/[game].py`) to correctly parse and export the data
3. **Regenerate the JSON files** using the fixed exporter:
   ```bash
   python Generate.py --weights_file_path "Templates/[Game].yaml" --multi 1 --seed 1
   ```
4. **Verify the fix** by checking the newly generated JSON files contain the correct data
5. **Only then resume frontend work** with the corrected data

**Why this matters:** The JSON files are the source of truth for the frontend. Working around bad data in the frontend creates fragile code that will break with different seeds or game configurations. Always fix data problems at the source.

### Issue: Unknown Rule Types
```
[ruleEngine] [evaluateRule] Unknown rule type: capability
```
**Solution:** Implement support for the rule type in the JavaScript `RuleEngine`.

### Issue: Location Accessibility Mismatches
```
> Locations accessible in STATE but NOT in LOG: Collect 15 Seashells
```
**Solution:** Check the corresponding rule in `worlds/[game]/Rules.py`:
```python
add_rule(multiworld.get_location("Collect 15 Seashells", player),
    lambda state: state.has("Seashell", player, 15))
```
This indicates the location requires 15 Seashells before being accessible.

## Implementing Fixes

When tests fail, create game-specific helper functions:

1. **Create Game Directory:** In `frontend/modules/shared/gameLogic/`, create a subdirectory for your game based on the "generic" subdirectory

2. **Implement Helpers:** Base your JavaScript implementations on the Python functions found in `worlds/[game]/`:
   - **`Rules.py`**: Contains main location access rules
   - **`Regions.py`**: Defines region connections  
   - **`Items.py`**: Item definitions and properties
   - **`Options.py`**: Game-specific settings affecting logic

3. **Test Iteratively:** Re-run tests after each fix until all mismatches are resolved

## Debugging Workflow

1. **Identify Root Cause**: Look for the specific location name in mismatch details
2. **Find Python Rule**: Search for the location in `worlds/[game]/Rules.py`
3. **Understand Requirements**: Examine the `add_rule()` call to understand needed items/conditions
4. **Test Incrementally**: Make one fix at a time and re-run tests

**Interactive Debugging:**
- Use `npm run test:headed --mode=test-spoilers --game=[yourgame]` to see the test in a visible browser
- Check browser console for detailed rule evaluation logs
- Use the "Regions" panel to manually verify accessibility logic

## Advanced Debugging Patterns

### Pattern 1: Multiple Location Failures → Variable Resolution Issue

If many locations fail simultaneously that require different counts of the same item:

**Root Cause**: Lambda default parameters with variable references aren't being resolved.
```python
lambda state, min_feathers=min_feathers: state.has("Golden Feather", player, min_feathers)
```

**Solution**: Implement variable resolution in the analyzer to access function `__defaults__`.

### Pattern 2: Single Location with Count Requirements → Rule Engine Bug

If one specific location fails that requires a certain quantity:

**Root Cause**: Rule engine not properly handling count fields in `item_check` rules.
```json
{"type": "item_check", "item": "Seashell", "count": {"type": "constant", "value": 15}}
```

**Solution**: Enhance JavaScript rule engine to check `rule.count` in `item_check` cases.

### Pattern 3: Progressive Test Improvement

Good debugging shows progressive sphere advancement:
1. **Initial**: Fails at Sphere 1.1 with 8 locations (major issue)
2. **After fix**: Fails at Sphere 1.2 with 1 location (minor issue)  
3. **After final fix**: All 37 spheres pass (success)

## Recognizing Systemic vs Game-Specific Issues

**🔧 Systemic Issues (Fix in Core Code)**
- Multiple games affected by the same pattern
- Fundamental rule types (`item_check`, `count_check`, `and`, `or`)
- Variable resolution (lambda default parameters)
- Count handling (item quantity requirements)

**🎮 Game-Specific Issues (Fix in Game Exporter)**  
- Unknown helper functions (`can_fly`, `has_sword`)
- Custom rule types unique to one game
- Special item interactions or requirements
- Only one game shows the issue

## Common Anti-Patterns to Avoid

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

This systematic approach ensures the JavaScript client faithfully replicates the authoritative Python game logic for accurate progression tracking.