# Debugging Spoiler Tests for Basic Games

This guide explains how to debug failing spoiler tests for games that don't have a custom exporter or JavaScript helper functions. These games rely entirely on the generic export infrastructure.

## When to Use This Guide

Use this guide when:
- A game uses only `GenericGameExportHandler` (no custom `exporter/games/<game>.py` file)
- No JavaScript helpers exist in `frontend/modules/shared/gameLogic/<game>/`
- The game isn't listed in `frontend/modules/shared/gameLogic/gameLogicRegistry.js`
- Spoiler tests are failing despite the game having "simple" rules

## Important Gotchas

Before debugging, be aware of these common pitfalls:

- **Path in Generate.py**: Use `"Templates/GameName.yaml"` NOT `"Players/Templates/GameName.yaml"` - the latter will fail
- **Name formats differ**: Template files use title case with spaces (`A Link to the Past.yaml`), but preset directories use lowercase identifiers (`alttp`)
- **Seed 1 always produces**: Output ID `AP_14089154938208861744` - useful for consistent testing
- **Don't modify**: Original Archipelago world files in `worlds/` - fix issues in the exporter instead

## Understanding the Test Failure

### Step 1: Run the Spoiler Test

The easiest way to test a single game:

```bash
source .venv/bin/activate
python scripts/test/test-all-templates.py --include-list "GameName.yaml"
```

This runs both generation and spoiler testing. For more control, run steps separately:

```bash
# Generate only
python Generate.py --weights_file_path "Templates/GameName.yaml" --multi 1 --seed 1

# Test only
npm test -- --mode=test-spoilers --game=gamename --seed=1
```

### Step 2: Analyze the Results

```bash
npm run test:analyze
cat playwright-analysis.txt
```

The analysis shows which sphere failed and what locations were affected.

## Common Failure Patterns

### Pattern 1: Unknown Helper Function

**Symptom:**
```
[ruleEngine] [evaluateHelper] Helper function not found: can_do_something
```

**What it means:** The Python game code uses a helper function that wasn't exported to `rules.json`. This happens when:
- The helper is too complex for automatic export (has loops, closures, etc.)
- The helper wasn't discovered during rule analysis
- The helper definition export failed silently

**How to investigate:**

1. Find the helper in Python:
   ```bash
   grep -r "def can_do_something" worlds/gamename/
   ```

2. Check if it's in the exported rules:
   ```bash
   grep "can_do_something" frontend/presets/gamename/AP_*_rules.json
   ```

3. Look at the helper's complexity - does it have loops, closures, or dynamic logic?

**Solutions (in order of preference):**

1. **Check if it should have been exported** - If it's a simple helper, there may be a bug in the analyzer. Check for recent changes to `exporter/analyzer.py`.

2. **Create a minimal custom exporter** - Add the helper to a whitelist:
   ```python
   # exporter/games/gamename.py
   from .generic import GenericGameExportHandler

   class GameNameExportHandler(GenericGameExportHandler):
       GAME_NAME = 'GameName'
       AUTO_EXPORT_DISCOVERED_HELPERS = True
       HELPERS_TO_EXPORT_WHITELIST = {'can_do_something'}
   ```

3. **Add JavaScript implementation** - If the helper is truly too complex:
   - Create `frontend/modules/shared/gameLogic/gamename/helpers.js`
   - Register in `gameLogicRegistry.js`
   - See `CC/helper-export-guide.md` for details

### Pattern 2: Locations Accessible Too Early

**Symptom:**
```
Locations accessible in STATE but NOT in LOG: ["Location Name"]
```

**What it means:** The frontend thinks a location is reachable before the Python spoiler log says it should be. The rule is being evaluated as `true` when it should be `false`.

**How to investigate:**

1. Find the location's rule in the exported JSON:
   ```bash
   grep -A 5 '"Location Name"' frontend/presets/gamename/AP_*_rules.json
   ```

2. Check what items/conditions the rule requires

3. Look at what items the player has at that sphere in the sphere log:
   ```bash
   cat frontend/presets/gamename/AP_*_sphere_log.jsonl | head -20
   ```

**Common causes:**

- **Missing count check** - Rule requires 5 of an item but count wasn't exported
- **Setting not exported** - Rule depends on a setting value that's missing
- **Rule simplified incorrectly** - Complex rule was flattened wrong

### Pattern 3: Locations Not Accessible When They Should Be

**Symptom:**
```
Locations in LOG but NOT accessible in STATE: ["Location Name"]
```

**What it means:** The frontend thinks a location is unreachable when Python says it should be accessible. The rule is evaluating as `false` when it should be `true`.

**How to investigate:**

1. Check the rule structure in the JSON (same as above)
2. Verify item names match exactly between Python and frontend
3. Check for case sensitivity issues in item/location names

**Common causes:**

- **Item name mismatch** - Python uses "Sword" but JSON has "sword"
- **Missing item in starting inventory** - Precollected items not exported
- **Region connection missing** - Location is in an unreachable region

### Pattern 4: Rule Export Error

**Symptom:**
```
Error evaluating rule for location "X": Cannot read property 'type' of undefined
```

**What it means:** The rule structure in JSON is malformed or incomplete.

**How to investigate:**

1. Look at the raw rule in the JSON file
2. Check for `null` or missing fields
3. Look for truncated or incomplete rule structures

**Solution:** This usually indicates a bug in `exporter/analyzer.py`. Check for:
- Unhandled AST node types
- Edge cases in rule conversion
- Silent failures during export

## Debugging Workflow

### 1. Isolate the Problem

Run with a specific seed and check which sphere fails first:

```bash
npm test -- --mode=test-spoilers --game=gamename --seed=1
```

### 2. Examine the Rules JSON

Look at the exported rules for the failing location:

```bash
# Find the rules file
ls frontend/presets/gamename/

# Search for the location
grep -B 2 -A 10 '"Failing Location Name"' frontend/presets/gamename/AP_*_rules.json
```

### 3. Compare with Python Source

Find the original rule in Python:

```bash
grep -r "Failing Location Name" worlds/gamename/
```

Then look at how that location's access rule is defined in `Rules.py`.

### 4. Check the Sphere Log

See what items are available at each sphere:

```bash
# View the sphere log
cat frontend/presets/gamename/AP_*_sphere_log.jsonl | python -m json.tool
```

### 5. Enable Verbose Logging

Run tests with headed mode and check browser console:

```bash
npm run test:headed -- --mode=test-spoilers --game=gamename --seed=1
```

The browser console shows detailed rule evaluation logs.

**Tip:** For frontend debugging, adding `console.log` statements directly is often easier than configuring the logging system in `frontend/settings.json`.

## When to Escalate

Some issues require changes to core infrastructure:

| Issue Type | Where to Fix |
|------------|--------------|
| Rule not exported correctly | `exporter/analyzer.py` |
| Helper not discovered | `exporter/analyzer.py` |
| Rule evaluates wrong | `frontend/modules/shared/ruleEngine.js` |
| Item/location name mismatch | `exporter/games/generic.py` |
| Missing settings | Game-specific exporter (create one) |

## Quick Reference

### Files to Check

| File | Purpose |
|------|---------|
| `frontend/presets/<game>/AP_<SEED_ID>/AP_<SEED_ID>_rules.json` | Exported rules |
| `frontend/presets/<game>/AP_<SEED_ID>/AP_<SEED_ID>_sphere_log.jsonl` | Expected progression |
| `worlds/<game>/Rules.py` | Original Python rules |
| `worlds/<game>/Options.py` | Game settings |
| `exporter/analyzer.py` | Rule analysis/export |
| `frontend/modules/shared/ruleEngine.js` | Rule evaluation |
| `scripts/data/world-mapping.json` | World/game/yaml name mapping |
| `frontend/schema/rules.schema.json` | Rules JSON schema |

### Useful Commands

```bash
# Test a single game (recommended - runs generate + test)
python scripts/test/test-all-templates.py --include-list "GameName.yaml"

# Test with post-processing
python scripts/test/test-all-templates.py --include-list "GameName.yaml" -p

# Test multiple seeds
python scripts/test/test-all-templates.py --include-list "GameName.yaml" --seed-range 1-10

# Generate only
python Generate.py --weights_file_path "Templates/GameName.yaml" --multi 1 --seed 1

# Spoiler test only
npm test -- --mode=test-spoilers --game=gamename --seed=1

# Analyze results
npm run test:analyze && cat playwright-analysis.txt

# Configure spoiler settings
python scripts/setup/update_host_settings.py minimal-spoilers
python scripts/setup/update_host_settings.py full-spoilers

# Search for helper in Python
grep -r "def helper_name" worlds/gamename/

# Search in exported rules
grep "helper_name" frontend/presets/gamename/AP_*/AP_*_rules.json

# View sphere log
cat frontend/presets/gamename/AP_*/AP_*_sphere_log.jsonl
```

## See Also

- `CC/game-debugging-CC.md` - Full debugging guide including custom exporters
- `CC/helper-export-guide.md` - Guide for exporting helpers to eliminate JavaScript
- `CC/cloud-setup.md` - Environment setup instructions
