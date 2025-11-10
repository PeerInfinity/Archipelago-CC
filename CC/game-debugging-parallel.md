# Testing Guide: Parallel Game Debugging with Claude Code

This guide explains how to work on game debugging tasks in the Archipelago-CC fork using Claude Code's web interface for parallel execution.

## Overview

This is a specialized workflow for debugging multiple Archipelago games in parallel using Claude Code. Each web instance of Claude Code works independently on a different game, fixing exporter issues, helper function issues, and general logic issues.

## Fork Structure

- **Main Archipelago Fork**: Your primary development fork with the JSONExport branch
- **Archipelago-CC Fork**: A separate fork optimized for Claude Code parallel work
  - Main branch contains your working code (not the upstream main)
  - Each game gets its own branch for debugging work
  - A "merge" branch serves as a staging area for changes before syncing back to the main fork

## The Parallelizable Task

Each game needs debugging work in three priority areas:

1. **Priority 1 - Exporter Issues**: Fix data export in `exporter/games/[game].py`
2. **Priority 2 - Helper Issues**: Fix game logic in `frontend/modules/shared/gameLogic/[game]/`
3. **Priority 3 - General Issues**: Fix other logic problems

Each game has dedicated tracking documents:
- `CC/scripts/logs/[game]/remaining-exporter-issues.md`
- `CC/scripts/logs/[game]/solved-exporter-issues.md`
- `CC/scripts/logs/[game]/remaining-helper-issues.md`
- `CC/scripts/logs/[game]/solved-helper-issues.md`
- `CC/scripts/logs/[game]/remaining-general-issues.md`
- `CC/scripts/logs/[game]/solved-general-issues.md`

## Working on a Game (Claude Code Web Instance)

### Starting Your Task

You'll receive a prompt like this:

```
Please read CC/game-debugging-parallel.md.

The next game we want to work on is [GameName].

The command to generate the rules.json file is:
python Generate.py --weights_file_path "Templates/[GameName].yaml" --multi 1 --seed 1 > generate_output.txt

The command to run the spoiler test is:
npm test --mode=test-spoilers --game=[game] --seed=1

These commands need to be run from the archipelago-json directory.

A custom exporter already exists for this game, in exporter/games/[game].py
A custom helper function file already exists for this game, in frontend/modules/shared/gameLogic/[game]/[game]Logic.js
The rules.json file already exists for this game, in frontend/presets/[game]/AP_14089154938208861744/AP_14089154938208861744_rules.json
The sphere log file already exists for this game, in frontend/presets/[game]/AP_14089154938208861744/AP_14089154938208861744_spheres_log.jsonl

As you work on this task, please keep these documents up to date:
CC/scripts/logs/[game]/remaining-exporter-issues.md
CC/scripts/logs/[game]/solved-exporter-issues.md
CC/scripts/logs/[game]/remaining-helper-issues.md
CC/scripts/logs/[game]/solved-helper-issues.md
CC/scripts/logs/[game]/remaining-general-issues.md
CC/scripts/logs/[game]/solved-general-issues.md

Before you begin working, read the documents that list the remaining issues.
Please also read frontend/schema/rules.schema.json

Work on just one issue at a time, or one set of related issues.

Your first priority is to fix the exporter issues. Your second priority is to fix the helper issues. Your third priority is to fix the other issues.

After choosing an issue to work on, run the generation script and spoiler test to confirm that the issue still exists, and then begin working on fixing it.

If the spoiler test passes, then run this command:
python scripts/test-all-templates.py --retest --retest-continue 10 -p

Please make as much progress as you can without supervision.
```

### Workflow

1. **Read the remaining issues documents** to understand what needs fixing
2. **Read the schema** at `frontend/schema/rules.schema.json`
3. **Choose one issue** (or related set) to work on
4. **Verify the issue exists**:
   ```bash
   python Generate.py --weights_file_path "Templates/[GameName].yaml" --multi 1 --seed 1 > generate_output.txt
   npm test --mode=test-spoilers --game=[game] --seed=1
   ```
5. **Fix the issue** following the priorities and guidelines below
6. **Update the tracking documents** as you solve issues
7. **Repeat** until all issues are resolved
8. **Run the extended test** when spoiler test passes:
   ```bash
   python scripts/test-all-templates.py --retest --retest-continue 10 -p
   ```

### Priority Order

**Priority 1: Exporter Issues**
- Fix issues in `exporter/games/[game].py`
- Ensure correct data export to JSON
- Never work around bad data in the frontend
- Always regenerate JSON files after exporter fixes

**Priority 2: Helper Issues**
- Fix issues in `frontend/modules/shared/gameLogic/[game]/[game]Logic.js`
- Implement game-specific logic functions
- Base implementations on Python code in `worlds/[game]/`

**Priority 3: General Issues**
- Fix other logic problems
- May involve core rule engine changes
- Consider whether fixes are game-specific or systemic

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

- **Source of Truth:** The game generation process, orchestrated by `Generate.py`, is the source of truth. When run with a spoiler level of 2 or higher, it produces a detailed log of the game's logical progression.
- **Spoiler Log (`_spheres_log.jsonl`):** This file is the ground truth for testing. It contains a sequence of "spheres," where each sphere lists the locations that become accessible after collecting all the items from the previous spheres.

### Stage 2: The Exporter

- During the same `Generate.py` run, the custom exporter is triggered.
- **`exporter.py`**: Orchestrates the process of parsing the game's rules, regions, and items.
- **`analyzer.py`**: Uses Python's `ast` module to convert the game's logic into standardized JSON rule tree format.

### Stage 3: JSON Data Files

The generation and export process creates two critical JSON files for each seed:

1. **`..._rules.json`**: A complete dump of the game's logic, including all region data, location rules, item definitions, and game settings. This is the logic that will be **under test**. The structure of this file follows the schema defined in `frontend/schema/rules.schema.json`.
2. **`..._spheres_log.jsonl`**: The list of progression spheres, which serves as the **expected result**.

### Stage 4: Frontend Test Execution

The **Test Spoilers** panel in the web client validates the implementation:

- **Loading:** The test loads the `_rules.json` file into the `StateManager` worker, then loads the corresponding `_spheres_log.jsonl` file.
- **Execution & Validation:** When you click "Run Full Test," it simulates a full playthrough sphere by sphere:
  1. Starts with an empty inventory
  2. Gets the list of accessible locations from the frontend `StateManager`
  3. Compares this list against the locations in the current sphere from the spoiler log
  4. "Checks" all locations from the current sphere, adding their items to inventory
  5. Repeats until all spheres are checked or a mismatch is found

### Stage 5: Results

- **Pass/Fail:** Each sphere comparison is displayed in the UI (green = match, red = mismatch)
- **Mismatch Details:** Failures provide detailed reports showing which locations were accessible in the frontend but not in the log, and vice-versa

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

When tests fail, you may need to modify:

1. **The Exporter** (`exporter/games/[game].py`): Fix data export issues
2. **Game Helpers** (`frontend/modules/shared/gameLogic/[game]/`): Implement game-specific logic
3. **Core Systems**: For systemic issues affecting multiple games

Base your JavaScript implementations on the Python functions found in `worlds/[game]/`:
- **`Rules.py`**: Contains main location access rules
- **`Regions.py`**: Defines region connections
- **`Items.py`**: Item definitions and properties
- **`Options.py`**: Game-specific settings affecting logic

## Debugging Workflow

1. **Identify Root Cause**: Look for the specific location name in mismatch details
2. **Find Python Rule**: Search for the location in `worlds/[game]/Rules.py`
3. **Understand Requirements**: Examine the `add_rule()` call to understand needed items/conditions
4. **Fix and Test**: Make one fix at a time and re-run tests
5. **Document**: Update the tracking documents as you solve issues

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
3. **After final fix**: All spheres pass (success)

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

## Tracking Progress

As you work, keep the tracking documents updated:
- Move solved issues from `remaining-*-issues.md` to `solved-*-issues.md`
- Include details about the fix and any relevant code references
- This helps coordinate with other parallel instances and with the main fork

## When You're Done

Once the spoiler test passes and the extended retest succeeds, your work on this game is complete. The tracking documents and your committed changes serve as the record of your progress, which will be reviewed and merged back to the main Archipelago fork through the "merge" branch.

This systematic approach ensures efficient parallel debugging of multiple games while maintaining quality and avoiding conflicts.
