# Debugging World Generator Failures

This guide explains how to debug failures in the world generator test pipeline.

## Overview

The world generator creates standalone Archipelago worlds from `rules.json` files. The test pipeline has four sequential stages:

1. **World Generation**: Create the `_worldgen` Python world files from `rules.json`
2. **Seed Generation**: Run `Generate.py` with the `_worldgen` world to produce a seed
3. **Spoiler Test**: Validate the `_worldgen` world's sphere log against its own rules
4. **Cross-Validation**: Validate the **original** world's sphere log against the `_worldgen` rules

Each stage can fail independently. This guide covers debugging each failure type.

---

## Stage 1: World Generation Failures

These occur when the world generator fails to create the `_worldgen` Python world files.

**Symptom**: `test_world.world_generation.success = false` in test results.

### Common Error Types

#### TypeError: Unsupported comparison operators

```
ERROR: Generation failed: '<=' not supported between instances of 'dict' and 'int'
```

**Cause**: The rule code generator encountered a comparison operation with an unsupported operand type (e.g., a dict where a number was expected).

**Debugging steps**:
1. Find rules with comparison operators in the rules.json:
   ```bash
   python -c "
   import json
   with open('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
       data = json.load(f)
   # Search for rules containing comparison operators
   import re
   def find_comparisons(obj, path=''):
       if isinstance(obj, dict):
           if obj.get('op') in ['<', '<=', '>', '>=']:
               print(f'{path}: {obj}')
           for k, v in obj.items():
               find_comparisons(v, f'{path}.{k}')
       elif isinstance(obj, list):
           for i, v in enumerate(obj):
               find_comparisons(v, f'{path}[{i}]')
   find_comparisons(data)
   "
   ```

2. Check the rule code generator for handling of this case:
   ```bash
   grep -n "def.*comparison\|'<='\|'>='" world_generator/rule_codegen.py
   ```

**Fix**: Update `world_generator/rule_codegen.py` to handle the specific operand types correctly.

#### KeyError: Missing data during extraction

```
ERROR: Generation failed: KeyError: 'some_key'
```

**Cause**: The world generator's extractors expected data that wasn't present in the rules.json.

**Debugging steps**:
1. Check what data the extractor is looking for:
   ```bash
   grep -n "some_key" world_generator/extractors.py
   ```

2. Check if the key exists in the rules.json:
   ```bash
   python -c "
   import json
   with open('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
       data = json.load(f)
   print('some_key' in str(data))
   "
   ```

**Fix**: Update `world_generator/extractors.py` to handle missing data gracefully.

#### SyntaxError: Invalid generated Python code

```
ERROR: Generation failed: SyntaxError: ...
```

**Cause**: The template generator produced invalid Python syntax.

**Debugging steps**:
1. Run the world generator manually to see the full error:
   ```bash
   python -c "
   from world_generator.generator import WorldGenerator
   gen = WorldGenerator()
   gen.generate_from_rules('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json', 'worlds/<game>_worldgen')
   "
   ```

2. If a partial world was generated, check the syntax:
   ```bash
   python -m py_compile worlds/<game>_worldgen/__init__.py
   ```

**Fix**: Update `world_generator/templates.py` to generate valid Python code.

### Test Commands

```bash
source .venv/bin/activate

# Run just the world generation phase
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --phase generate-test-worlds --canonical-seed1

# Or run the world generator directly for debugging
python -c "
from world_generator.generator import WorldGenerator
gen = WorldGenerator()
gen.generate_from_rules('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json', 'worlds/<game>_worldgen')
"
```

---

## Stage 2: Seed Generation Failures

These occur when `python Generate.py` fails for the `_worldgen` world. The world files were created successfully, but they can't produce a valid seed.

**Symptom**: `test_world.world_generation.success = true` but `test_world.seed_generation.success = false`.

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
source .venv/bin/activate

# Generate the worldgen world (if not already done)
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --phase generate-test-worlds

# Regenerate templates to include the worldgen world
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --phase regenerate-templates

# Try to generate a seed (this is where Seed Generation fails)
python Generate.py --weights_file_path "Templates/Game Name WorldGen.yaml" --multi 1 --seed 1
```

---

## Stage 3: Spoiler Test Failures

These occur when the `_worldgen` world generates a seed successfully, but its own spoiler test fails.

**Symptom**: `test_world.seed_generation.success = true` but `test_world.spoiler_test.pass_fail != 'pass'`.

**Cause**: The generated rules have internal inconsistencies - the worldgen world's sphere log doesn't validate against its own rules.

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
source .venv/bin/activate

# Run the full test
python scripts/test/test-world-generator.py --include-list "Game Name WorldGen.yaml" --phase test

# Or run just the spoiler test
npm test -- --mode=test-spoilers --game=presets/<game>_worldgen/AP_14089154938208861744 --seed=1
```

---

## Stage 4: Cross-Validation Failures

These occur when the `_worldgen` world passes its own spoiler test, but fails when validated against the **original** world's sphere log.

**Symptom**: `test_world.spoiler_test.pass_fail = 'pass'` but `test_world.cross_validation.pass_fail = 'fail'`.

**Cause**: The worldgen world produces different accessibility logic than the original world. Both worlds work internally, but they disagree about when locations become accessible.

This is the most common failure mode - it indicates the rule translation from Python to the worldgen format has subtle differences.

### Understanding Cross-Validation

The cross-validation test:
1. Takes the **original** game's sphere log (actual item accessibility order from the original Archipelago world)
2. Copies it to the `_worldgen` world's test location
3. Runs the spoiler test using that sphere log against the `_worldgen` world's rules
4. If it fails, the worldgen rules unlock locations at different times than the original

### Debugging Steps

1. **Compare sphere logs** to find where they diverge:
   ```bash
   # View original sphere log
   head -30 frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl

   # View worldgen sphere log
   head -30 frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl

   # Quick diff of location names per sphere (requires jq)
   diff <(cat frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl | jq -r '.location' | sort) \
        <(cat frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl | jq -r '.location' | sort)
   ```

2. **Run the cross-validation test manually** to see the exact failure:
   ```bash
   # First, backup the worldgen sphere log
   cp frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl \
      frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl.bak

   # Copy original sphere log to worldgen location
   cp frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl \
      frontend/presets/<game>_worldgen/AP_14089154938208861744/

   # Run spoiler test
   npm test -- --mode=test-spoilers --game=presets/<game>_worldgen/AP_14089154938208861744 --seed=1
   npm run test:analyze
   cat playwright-analysis.txt

   # Restore worldgen sphere log
   mv frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl.bak \
      frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl
   ```

3. **Identify the first divergent location**:
   ```bash
   python -c "
   import json

   def load_sphere_log(path):
       locations = []
       with open(path) as f:
           for line in f:
               entry = json.loads(line)
               locations.append((entry.get('sphere', 0), entry.get('location', '')))
       return sorted(locations)

   original = load_sphere_log('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl')
   worldgen = load_sphere_log('frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl')

   # Find locations in different spheres
   orig_dict = {loc: sphere for sphere, loc in original}
   wgen_dict = {loc: sphere for sphere, loc in worldgen}

   for loc in orig_dict:
       if loc in wgen_dict and orig_dict[loc] != wgen_dict[loc]:
           print(f'{loc}: original sphere {orig_dict[loc]}, worldgen sphere {wgen_dict[loc]}')
   "
   ```

4. **Check the specific location's rule** in both rules.json files:
   ```bash
   # Compare rules for a specific location
   python -c "
   import json

   def find_location_rule(rules_path, location_name):
       with open(rules_path) as f:
           data = json.load(f)
       regions = data.get('regions', {}).get('1', {})
       for region_name, region in regions.items():
           for loc in region.get('locations', []):
               if loc.get('name') == location_name:
                   return {'region': region_name, 'rule': loc.get('rule')}
       return None

   loc_name = 'LOCATION_NAME_HERE'
   orig = find_location_rule('frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json', loc_name)
   wgen = find_location_rule('frontend/presets/<game>_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json', loc_name)

   print('Original:', json.dumps(orig, indent=2))
   print('WorldGen:', json.dumps(wgen, indent=2))
   "
   ```

### Common Causes

1. **Helper function translation differences**: A helper function's logic was translated differently
2. **Item group handling**: Item groups (e.g., "Progressive Sword") resolved differently
3. **Region connection rules**: Entry requirements for regions differ
4. **State method variations**: Methods like `has_all`, `has_any`, `count` behave subtly differently
5. **Option-dependent rules**: Rules that depend on game options may evaluate differently

### Test Commands

```bash
source .venv/bin/activate

# Run the full worldgen test (includes cross-validation)
python scripts/test/test-world-generator.py --include-list "Game Name.yaml" --canonical-seed1

# Check test results
python -c "
import json
with open('scripts/output/world-generator/test-results-canonical.json') as f:
    data = json.load(f)
result = data['results'].get('Game Name', {})
cv = result.get('test_world', {}).get('cross_validation', {})
print(f'Cross-validation: {cv.get(\"pass_fail\")}')
print(f'Error: {cv.get(\"error\")}')
"
```

---

## Reference Files

| File | Purpose |
|------|---------|
| `world_generator/generator.py` | Main world generator entry point |
| `world_generator/extractors.py` | Extracts data from rules.json |
| `world_generator/templates.py` | Generates Python world code |
| `world_generator/rule_codegen.py` | Converts rules to Python code |
| `rule_builder/ast_format.py` | Parses AST format rules |
| `scripts/test/test-world-generator.py` | Test script |
| `scripts/output/world-generator/test-results-canonical.json` | Canonical mode results |
| `scripts/output/world-generator/test-results-random.json` | Random mode results |

## See Also

- `CC/adding-game-support.md` - Adding new game support to the world generator
- `CC/implementing-new-rule-types.md` - Adding support for new rule types
