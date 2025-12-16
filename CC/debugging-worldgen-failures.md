# Debugging World Generator Failures

This guide explains how to debug failures in the world generator test pipeline.

## Overview

The world generator creates standalone Archipelago worlds from `rules.json` files. The test pipeline validates these generated worlds work correctly. There are two main failure points:

1. **Test Gen failures**: The generated `_worldgen` world fails when trying to generate a seed
2. **Test Spoiler failures**: The generated world produces a seed, but the spoiler test fails

## Test Gen Failures

These occur when `python Generate.py` fails for the `_worldgen` world.

### Common Error Types

#### NameError: Helper function not defined

```
NameError: name '_gameworldgen_helper_function' is not defined
```

**Cause**: A helper function referenced in the generated rules was not exported to the generated world.

**Debugging steps**:
1. Find the helper function in the original world's `Rules.py`:
   ```bash
   grep -n "def helper_function" worlds/<game>/Rules.py
   ```

2. Check if the helper is being discovered by the world generator:
   ```bash
   python -c "
   import json
   with open('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
       data = json.load(f)
   helpers = data.get('helpers', {})
   print('Exported helpers:', list(helpers.keys()))
   "
   ```

3. Check the generated `_worldgen` world's `__init__.py`:
   ```bash
   grep -n "def _gameworldgen_helper" worlds/<game>_worldgen/__init__.py
   ```

**Fix**: Either:
- Add the helper to `HELPERS_TO_EXPORT_WHITELIST` in the exporter
- Implement the helper in the world generator's code generation (`world_generator/templates.py`)

#### FillError: Not enough locations for items

```
raise FillError("Not enough locations for items")
```

**Cause**: Item pool size doesn't match available locations.

**Debugging steps**:
1. Compare item pool sizes:
   ```bash
   # Check original world's item pool
   grep -n "ITEMPOOL_COUNTS" worlds/<game>/__init__.py

   # Check generated world's item pool
   grep -n "ITEMPOOL_COUNTS" worlds/<game>_worldgen/__init__.py
   ```

2. Check for locked placements not being accounted for:
   ```bash
   grep -n "LOCKED_PLACEMENTS" worlds/<game>_worldgen/__init__.py
   ```

3. Check if events are being properly excluded from the item pool

**Fix**: Usually requires fixing the extraction logic in `world_generator/extractors.py` or the template generation in `world_generator/templates.py`.

#### KeyError: Missing data

```
KeyError: ''
KeyError: 'Location Name'
KeyError: True
```

**Cause**: A lookup table is missing an entry, or there's a type mismatch.

**Debugging steps**:
1. Search for the key in the generated world:
   ```bash
   grep -n "KeyError key value" worlds/<game>_worldgen/__init__.py
   ```

2. Check the rules.json for unexpected values:
   ```bash
   python -c "
   import json
   with open('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
       print(json.dumps(json.load(f), indent=2)[:5000])
   "
   ```

**Fix**: Add missing data to the extraction or handle edge cases in code generation.

#### TypeError/AttributeError: Type mismatches

```
TypeError: function() missing 1 required positional argument
AttributeError: 'bool' object has no attribute 'value'
```

**Cause**: Generated code has wrong types or function signatures.

**Debugging steps**:
1. Find the problematic code in the generated world:
   ```bash
   grep -n "function_name\|\.value" worlds/<game>_worldgen/__init__.py
   ```

2. Compare with the original world's implementation

**Fix**: Fix the code generation in `world_generator/rule_codegen.py` or `world_generator/templates.py`.

### Test Commands

```bash
# Activate virtual environment
source .venv/bin/activate

# Generate the worldgen world
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --phase generate-test-worlds

# Regenerate templates to include the worldgen world
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --phase regenerate-templates

# Try to generate a seed (this is where Test Gen fails)
python Generate.py --weights_file_path "Templates/Game Name WorldGen.yaml" --multi 1 --seed 1
```

---

## Test Spoiler Failures

These occur when the `_worldgen` world generates a seed successfully, but the spoiler test fails.

**Cause**: The generated rules don't match the original world's logic - locations that should be accessible aren't, or vice versa.

### Debugging Steps

1. Run the spoiler test and analyze the failure:
   ```bash
   npm test -- --mode=test-spoilers --game=presets/<game>_worldgen/AP_14089154938208861744 --seed=1
   npm run test:analyze
   cat playwright-analysis.txt
   ```

2. Compare sphere logs:
   ```bash
   # Original world sphere log
   head -50 frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl

   # WorldGen world sphere log
   head -50 frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl
   ```

3. Check if specific rules differ:
   ```bash
   # Search for a specific location's rule
   python -c "
   import json
   with open('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
       data = json.load(f)
   regions = data.get('regions', {}).get('1', {})
   for region_name, region in regions.items():
       for loc in region.get('locations', []):
           if 'Location Name' in loc.get('name', ''):
               print(json.dumps(loc, indent=2))
   "
   ```

4. Enable frontend logging to see rule evaluation:
   ```bash
   # Edit frontend/settings.json
   # Set "logLevel": "debug"
   ```

### Common Causes

1. **Missing helper functions**: A helper referenced in rules isn't implemented
2. **Different rule evaluation**: The generated Python differs from the JavaScript evaluation
3. **State method differences**: Methods like `has_all`, `has_any` behave differently
4. **Item group handling**: Item groups aren't resolved the same way

### Test Commands

```bash
# Run the full test
python scripts/test/test-world-generator.py --include-list "Game Name WorldGen.yaml" --phase test

# Or run just the spoiler test
npm test -- --mode=test-spoilers --game=presets/<game>_worldgen/AP_14089154938208861744 --seed=1
```

---

## Reference Files

| File | Purpose |
|------|---------|
| `world_generator/extractors.py` | Extracts data from rules.json |
| `world_generator/templates.py` | Generates Python world code |
| `world_generator/rule_codegen.py` | Converts rules to Python code |
| `rule_builder/cc_format.py` | Parses CC format rules |
| `scripts/test/test-world-generator.py` | Test script |
| `scripts/output/world-generator/test-results-canonical.json` | Canonical mode results |
| `scripts/output/world-generator/test-results-random.json` | Random mode results |

## See Also

- `CC/adding-game-support.md` - Adding new game support to the world generator
- `CC/implementing-new-rule-types.md` - Adding support for new rule types
