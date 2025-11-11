# Game Debugging Guide (Cloud Interface)

This guide explains how to test and debug game implementations when working in the Claude Code cloud interface. This is adapted from the main game debugging guide with cloud-specific considerations.

## Cloud Environment Context

When working in the cloud interface:

- **Isolated Environment**: Each Claude Code instance runs in its own isolated container
- **Parallel Execution**: Multiple instances may be working on different games simultaneously
- **Independent Branches**: Your work is on a dedicated branch (e.g., `claude/task-name-SESSION_ID`)
- **Fresh Setup**: You start with a clean environment that requires initial setup

## Prerequisites

**⚠️ CRITICAL: Complete Setup First**

Before following this debugging guide, you **must** complete the cloud environment setup described in `CC/cloud-setup.md`. This includes:

1. Creating Python virtual environment (`.venv`)
2. Installing Python requirements and game-specific dependencies
3. Generating template YAML files (`Players/Templates/`)
4. Configuring `host.yaml` for testing
5. Installing Node.js dependencies and Playwright browsers

**Setup verification:**
```bash
# Quick check - all should return OK
source .venv/bin/activate
python -c "import websockets; print('Python: OK')"
test -d Players/Templates && echo "Templates: OK"
test -f host.yaml && echo "host.yaml: OK"
test -d node_modules && echo "Node.js: OK"
```

If any checks fail, return to `CC/cloud-setup.md` and complete the setup.

## Testing Philosophy

The core principle is **progression equivalence**. The JavaScript `StateManager` and `RuleEngine` must unlock locations in the same order (or "spheres") as the original Python game generator given the same world seed and settings.

## The Testing Workflow

### Step 1: Understand the Data Flow

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

The Python backend generates "ground truth" data, and the JavaScript frontend must match it exactly.

### Step 2: Choose Your Game

Select a game to work on (e.g., "A Hat in Time"):
- Template file: `Players/Templates/A Hat in Time.yaml`
- Python directory: `worlds/ahit/`
- Frontend preset directory: `frontend/presets/ahit/`

### Step 3: Generate Test Data

**Ensure virtual environment is activated:**
```bash
source .venv/bin/activate
```

**Run Generate.py:**
```bash
python Generate.py --weights_file_path "Templates/A Hat in Time.yaml" --multi 1 --seed 1 > generate_output.txt
```

**Understanding the output:**
- Seed `--seed 1` always produces output ID `AP_14089154938208861744`
- Output directory: `frontend/presets/ahit/AP_14089154938208861744/`
- Generated files:
  - `AP_14089154938208861744_rules.json` (logic to test)
  - `AP_14089154938208861744_spheres_log.jsonl` (expected progression)
  - `AP_14089154938208861744_Spoiler.txt` (human-readable spoiler)
  - `AP_14089154938208861744.archipelago` (multiworld file)

**Check for errors:**
```bash
cat generate_output.txt | grep -i error
```

If errors exist, fix them in the exporter (`exporter/games/[game].py`) before proceeding.

### Step 4: Run Spoiler Tests

**Execute the test:**
```bash
npm test --mode=test-spoilers --game=ahit --seed=1
```

**Alternative test variants:**
```bash
# With visible browser (useful for debugging)
npm run test:headed --mode=test-spoilers --game=ahit --seed=1

# With debug mode
npm run test:debug --mode=test-spoilers --game=ahit --seed=1

# With Playwright UI
npm run test:ui --mode=test-spoilers --game=ahit --seed=1
```

**Analyze results:**
```bash
# Generate human-readable analysis
npm run test:analyze

# View the analysis
cat playwright-analysis.txt
```

### Step 5: Interpret Test Results

**Success:** ✅ All spheres pass - JavaScript matches Python logic perfectly

**Failure Types:**

1. **Exporter Issues** - Data not exported correctly
   ```
   Missing item data, incorrect region connections, malformed rules
   ```
   **Fix:** Update `exporter/games/[game].py`

2. **Helper Issues** - Missing game-specific logic
   ```
   [ruleEngine] [evaluateRule] Unknown helper: can_fly
   ```
   **Fix:** Implement in `frontend/modules/shared/gameLogic/[game]/`

3. **Rule Engine Issues** - Core logic bugs
   ```
   Locations accessible in STATE but NOT in LOG: [location name]
   ```
   **Fix:** Debug rule evaluation in `frontend/modules/shared/ruleEngine.js`

### Step 6: Fix Issues Iteratively

**Workflow:**
1. Identify the root cause (exporter vs helper vs rule engine)
2. Make ONE fix at a time
3. Re-run generation if you fixed the exporter
4. Re-run tests to verify the fix
5. Repeat until all tests pass

**Example debugging session:**
```bash
# Fix exporter issue
vim exporter/games/ahit.py

# Regenerate data
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/A Hat in Time.yaml" --multi 1 --seed 1 > generate_output.txt

# Re-run test
npm test --mode=test-spoilers --game=ahit --seed=1

# Analyze
npm run test:analyze
cat playwright-analysis.txt
```

## Game-Specific Files

### Exporter Handler

Located at: `exporter/games/[game].py`

**Recommended approach:**
```python
"""A Hat in Time game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class AHitGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'A Hat in Time'

    # Inherit all default behavior from GenericGameExportHandler
    # Only override methods when you need custom behavior
```

The `GenericGameExportHandler` provides:
- Automatic item data discovery
- Intelligent rule analysis with pattern matching
- Recognition of common helper patterns (`has_*`, `can_*`, etc.)
- Working defaults that reduce boilerplate

### Frontend Helper Functions

Located at: `frontend/modules/shared/gameLogic/[game]/`

Create this directory based on the `generic/` subdirectory. Implement helpers referenced in the Python world code (`worlds/[game]/Rules.py`).

## Debugging Tips

### Pattern 1: Multiple Location Failures → Variable Resolution

If many locations fail simultaneously that require different counts:

**Root cause:** Lambda default parameters with variable references aren't resolved
```python
lambda state, min_feathers=min_feathers: state.has("Golden Feather", player, min_feathers)
```

**Fix location:** `exporter/analyzer.py` - implement variable resolution

### Pattern 2: Single Location Failures → Rule Engine Logic

If one specific location fails with quantity requirements:

**Root cause:** Rule engine not handling count fields in `item_check` rules
```json
{"type": "item_check", "item": "Seashell", "count": {"type": "constant", "value": 15}}
```

**Fix location:** `frontend/modules/shared/ruleEngine.js` - check `rule.count`

### Pattern 3: Unknown Helper Functions → Missing Implementation

If you see:
```
[ruleEngine] [evaluateHelper] Helper function not found: can_fly
```

**Root cause:** Game-specific helper not implemented in JavaScript

**Fix location:** Create `frontend/modules/shared/gameLogic/[game]/helpers.js`

**Find the Python source:**
```bash
grep -r "def can_fly" worlds/ahit/
```

## Common Anti-Patterns

**❌ Don't hardcode location-specific fixes**
```python
if location_name == "Secret Island Peak":
    return {"type": "item_check", "item": "Golden Feather", "count": 5}
```

**✅ Do implement general pattern recognition**
```python
if rule.count and rule.count.type == 'name':
    resolved_value = self.resolve_variable(rule.count.name)
    if resolved_value is not None:
        rule.count = {'type': 'constant', 'value': resolved_value}
```

## Data Quality Priority

**⚠️ CRITICAL: Fix Data Issues at the Source**

If you notice missing or corrupt data in generated JSON files:

1. **STOP** all frontend work immediately
2. **FIX** the exporter (`exporter/games/[game].py`)
3. **REGENERATE** the JSON files with the fixed exporter
4. **VERIFY** the fix by inspecting the new JSON files
5. **ONLY THEN** resume frontend/testing work

**Never work around bad data in the frontend** - always fix it at the source.

## Cloud-Specific Considerations

### Working Directory

Always run commands from the project root (`/home/user/Archipelago-CC` or similar):
```bash
pwd  # Should show: /home/user/Archipelago-CC
```

### Virtual Environment

**Always activate before Python commands:**
```bash
source .venv/bin/activate
```

The virtual environment is session-local and not committed to git.

### Branch Management

Your work is on a dedicated branch (e.g., `claude/game-ahit-SESSION_ID`):
- Work is automatically committed and pushed by the system
- Don't worry about merging - that happens separately after your work is complete
- Focus on fixing issues and getting tests to pass

### Parallel Work

Multiple Claude Code instances may work on different games simultaneously:
- Each has its own isolated environment and branch
- Your work doesn't interfere with others
- Each instance completes setup independently

### Session Persistence

Remember to commit and push your work regularly:
- The cloud environment is temporary
- Uncommitted changes may be lost if the session ends
- The system typically handles this automatically, but verify important changes are pushed

## Interactive Debugging

For visual debugging, use headed mode:
```bash
npm run test:headed --mode=test-spoilers --game=ahit --seed=1
```

This opens a visible browser where you can:
- See the test running in real-time
- Check browser console for detailed logs
- Use the "Regions" panel to verify accessibility
- Manually inspect state updates

## Test Automation

For regression testing across multiple games:
```bash
# Test all failing games
python scripts/test/test-all-templates.py

# Test specific game
python scripts/test/test-all-templates.py --include-list "A Hat in Time.yaml"

# Continue from specific point
python scripts/test/test-all-templates.py --start-from "Adventure.yaml"
```

## Recognizing Issue Types

**🔧 Systemic Issues (Fix in Core Code)**
- Multiple games affected by same pattern
- Fundamental rule types (`item_check`, `and`, `or`)
- Variable resolution problems
- Count handling for all games

**🎮 Game-Specific Issues (Fix in Game Code)**
- Unknown helper functions unique to one game
- Custom rule types
- Special item interactions
- Only one game shows the issue

## Progress Tracking

Good debugging shows **progressive improvement**:
1. **Initial run**: Fails at Sphere 1.1 with 8 locations (major issue)
2. **After fix 1**: Fails at Sphere 1.2 with 1 location (minor issue)
3. **After fix 2**: All 37 spheres pass (success!)

This indicates systematic resolution from major to minor issues.

## Getting Unstuck

If you're stuck:

1. **Read the Python source**: `worlds/[game]/Rules.py` shows what's expected
2. **Check the JSON**: Inspect `*_rules.json` to verify export is correct
3. **Enable verbose logging**: Check browser console for rule evaluation details
4. **Compare spheres**: Look at `*_spheres_log.jsonl` vs actual accessible locations
5. **Test incrementally**: Fix one issue at a time, verify, then continue

## Additional Resources

For more detailed information:
- **Setup guide**: `CC/cloud-setup.md`
- **System architecture**: `docs/json/developer/architecture.md`
- **Testing pipeline**: `docs/json/developer/guides/testing-pipeline.md`
- **Rule schema**: `frontend/schema/rules.schema.json`
- **Main debugging guide**: `CC/game-debugging.md`

## Summary

The cloud debugging workflow:
1. ✅ Complete setup (`CC/cloud-setup.md`)
2. 🎮 Choose a game to work on
3. 🔧 Generate test data with Python backend
4. 🧪 Run spoiler tests with JavaScript frontend
5. 🐛 Fix issues (exporter → helper → rule engine)
6. 🔄 Iterate until all tests pass
7. ✨ Push your changes (handled automatically)

Focus on getting tests to pass - the cloud system handles branch management and merging.
