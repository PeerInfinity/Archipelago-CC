"""
WorldGen prompt generators for debugging world generator failures.

These prompts guide debugging of the four stages of world generator testing:
- Stage 1: World Generation (creating _worldgen Python files)
- Stage 2: Seed Generation (running Generate.py with _worldgen world)
- Stage 3: Spoiler Test (validating against own sphere log)
- Stage 4: Cross-Validation (validating against original sphere log)
"""

from ..worldgen_analysis import (
    categorize_world_generation_error,
    categorize_seed_generation_error,
)


def generate_worldgen_world_failure_prompt(game_name, template_file, error_msg, world_mapping, seed=1):
    """Generate a prompt for debugging a Stage 1: World Generation failure.

    These failures occur when the world generator fails to create the _worldgen
    Python world files from rules.json.
    """
    setup_doc = "CC/cloud-setup.md"
    debug_doc = "CC/debugging-worldgen-failures.md"

    # Get world directory from mapping
    world_dir = None
    if game_name in world_mapping:
        world_dir = world_mapping[game_name].get('world_directory', game_name.lower().replace(' ', ''))
    else:
        world_dir = game_name.lower().replace(' ', '')

    error_category, error_details = categorize_world_generation_error(error_msg)

    # Build error-specific guidance
    error_guidance = ""
    if error_category == 'comparison_type_error' and error_details:
        operator = error_details.get('operator', '?')
        left_type = error_details.get('left_type', '?')
        right_type = error_details.get('right_type', '?')
        error_guidance = f"""
## Error Analysis

This is a **comparison type error** - the operator `{operator}` was used with incompatible types: `{left_type}` and `{right_type}`.

This typically means:
1. A rule in rules.json has a comparison where one operand is a complex object (dict) instead of a simple value
2. The rule code generator (`world_generator/rule_codegen.py`) doesn't handle this operand type

**Investigation commands:**
```bash
# Find rules with comparison operators in the rules.json
python -c "
import json
with open('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)

def find_comparisons(obj, path=''):
    if isinstance(obj, dict):
        if obj.get('op') in ['<', '<=', '>', '>=']:
            print(f'{{path}}: {{obj}}')
        for k, v in obj.items():
            find_comparisons(v, f'{{path}}.{{k}}')
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            find_comparisons(v, f'{{path}}[{{i}}]')
find_comparisons(data)
"

# Check the rule code generator for comparison handling
grep -n "def.*comparison\\|'<='\\|'>='\\|generate.*compare" world_generator/rule_codegen.py
```
"""
    elif error_category == 'key_error':
        key = error_details.get('key', 'unknown') if error_details else 'unknown'
        error_guidance = f"""
## Error Analysis

This is a **KeyError** during world generation for key: `{key}`

This typically means:
1. The world generator's extractors expected data that wasn't in rules.json
2. A rule references something that doesn't exist

**Investigation commands:**
```bash
# Check what the extractor is looking for
grep -n "{key}" world_generator/extractors.py

# Check if the key exists in rules.json
python -c "
import json
with open('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)
print('{key}' in str(data))
"
```
"""
    elif error_category == 'syntax_error':
        error_guidance = f"""
## Error Analysis

This is a **SyntaxError** - the world generator produced invalid Python syntax.

**Investigation commands:**
```bash
# Run the world generator directly to see the full error
python -c "
from world_generator.generator import WorldGenerator
gen = WorldGenerator()
gen.generate_from_rules('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json', 'worlds/{world_dir}_worldgen')
"

# If a partial world was generated, check the syntax
python -m py_compile worlds/{world_dir}_worldgen/__init__.py
```
"""
    else:
        error_guidance = f"""
## Error Analysis

Error type: **{error_category}**

Review the error message and check the world generator code for issues.
"""

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read {debug_doc} - specifically **Stage 1: World Generation Failures**.

## Game Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **World directory**: `worlds/{world_dir}/`
- **WorldGen directory**: `worlds/{world_dir}_worldgen/` (failed to create)

## The Error

```
{error_msg}
```
{error_guidance}

## Test Commands

```bash
source .venv/bin/activate

# Run the world generator directly to see the full error
python -c "
from world_generator.generator import WorldGenerator
gen = WorldGenerator()
gen.generate_from_rules('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json', 'worlds/{world_dir}_worldgen')
"

# Or run through the test script
python scripts/test/test-world-generator.py --include-list "{template_file}" --phase generate-test-worlds --canonical-seed1
```

## Goal

Fix the world generator so that it can successfully create the `{game_name} WorldGen` world files.

## Reference Files

- `world_generator/generator.py` - Main entry point
- `world_generator/rule_codegen.py` - Converts rules to Python code
- `world_generator/extractors.py` - Extracts data from rules.json
- `world_generator/templates.py` - Generates Python world code
"""


def generate_worldgen_seed_failure_prompt(game_name, template_file, error_msg, world_mapping, seed=1):
    """Generate a prompt for debugging a Stage 2: Seed Generation failure.

    These failures occur when the _worldgen world files were created successfully,
    but running Generate.py with them fails.
    """
    setup_doc = "CC/cloud-setup.md"
    debug_doc = "CC/debugging-worldgen-failures.md"

    # Get world directory from mapping
    world_dir = None
    if game_name in world_mapping:
        world_dir = world_mapping[game_name].get('world_directory', game_name.lower().replace(' ', ''))
    else:
        world_dir = game_name.lower().replace(' ', '')

    error_category, error_details = categorize_seed_generation_error(error_msg)

    # Build error-specific guidance
    error_guidance = ""
    if error_category == 'name_error' and error_details:
        undefined_name = error_details.get('undefined_name', '')
        error_guidance = f"""
## Error Analysis

This is a **NameError** - the helper function `{undefined_name}` is not defined in the generated world.

This typically means:
1. The helper function exists in the original world's `Rules.py` but wasn't exported
2. The world generator didn't generate code for this helper

**Investigation commands:**
```bash
# Find the helper in the original world
grep -n "{undefined_name.replace('_worldgen', '').split('_', 1)[-1] if '_worldgen_' in undefined_name else undefined_name}" worlds/{world_dir}/Rules.py

# Check if it's in the exported helpers
python -c "
import json
with open('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)
helpers = data.get('helpers', {{}})
print('Exported helpers:', list(helpers.keys())[:20])
"

# Check the generated world for the function
grep -n "def.*{undefined_name.split('_')[-1] if '_' in undefined_name else undefined_name}" worlds/{world_dir}_worldgen/__init__.py
```
"""
    elif error_category == 'fill_error':
        error_guidance = f"""
## Error Analysis

This is a **FillError** - the item pool doesn't match the available locations.

This typically means:
1. Item pool counts are wrong in the generated world
2. Locked placements aren't being accounted for correctly
3. Event items are being incorrectly included in the pool

**Investigation commands:**
```bash
# Compare item pool sizes
echo "=== Original world ===" && grep -A 20 "ITEMPOOL_COUNTS" worlds/{world_dir}/__init__.py | head -25
echo "=== WorldGen world ===" && grep -A 20 "ITEMPOOL_COUNTS" worlds/{world_dir}_worldgen/__init__.py | head -25

# Check locked placements
grep -A 10 "LOCKED_PLACEMENTS" worlds/{world_dir}_worldgen/__init__.py | head -15

# Check location count
grep -c "'name':" worlds/{world_dir}_worldgen/__init__.py || echo "Check location definitions"
```
"""
    elif error_category == 'key_error':
        key = error_details.get('key', 'unknown') if error_details else 'unknown'
        error_guidance = f"""
## Error Analysis

This is a **KeyError** for key: `{key}`

This typically means:
1. A lookup table is missing an expected entry
2. There's a type mismatch (e.g., string vs int key)
3. The rules.json has unexpected data

**Investigation commands:**
```bash
# Search for the key in the generated world
grep -n "{key}" worlds/{world_dir}_worldgen/__init__.py

# Check the rules.json structure
python -c "
import json
with open('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)
# Print a summary of the structure
print('Top-level keys:', list(data.keys()))
if 'regions' in data:
    print('Region count:', len(data['regions'].get('1', {{}})))
"
```
"""
    else:
        error_guidance = f"""
## Error Analysis

Error type: **{error_category}**
Error message: `{error_msg}`

Review the error message and check the generated world code for issues.
"""

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read {debug_doc} - specifically **Stage 2: Seed Generation Failures**.

## Game Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **World directory**: `worlds/{world_dir}/`
- **WorldGen directory**: `worlds/{world_dir}_worldgen/`

## The Error

```
{error_msg}
```
{error_guidance}

## Test Commands

```bash
source .venv/bin/activate

# Regenerate the worldgen world (if needed)
python scripts/test/test-world-generator.py --include-list "{template_file}" --phase generate-test-worlds --canonical-seed1

# Regenerate templates
python scripts/test/test-world-generator.py --include-list "{template_file}" --phase regenerate-templates

# Try to generate a seed (this will show the full error)
python Generate.py --weights_file_path "Templates/{game_name} WorldGen.yaml" --multi 1 --seed {seed}
```

## Goal

Fix the world generator so that `{game_name} WorldGen` can successfully generate a seed.
"""


def generate_worldgen_spoiler_failure_prompt(game_name, template_file, world_mapping, seed=1):
    """Generate a prompt for debugging a Stage 3: Spoiler Test failure."""
    setup_doc = "CC/cloud-setup.md"
    debug_doc = "CC/debugging-worldgen-failures.md"

    # Get world directory from mapping
    world_dir = None
    if game_name in world_mapping:
        world_dir = world_mapping[game_name].get('world_directory', game_name.lower().replace(' ', ''))
    else:
        world_dir = game_name.lower().replace(' ', '')

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read {debug_doc} - specifically **Stage 3: Spoiler Test Failures**.

## Game Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **World directory**: `worlds/{world_dir}/`
- **WorldGen directory**: `worlds/{world_dir}_worldgen/`

## The Problem

The `{game_name} WorldGen` world generates a seed successfully, but the **spoiler test fails**.

This means the generated rules have internal inconsistencies - the worldgen world's sphere log doesn't validate against its own rules.

## Test Commands

```bash
source .venv/bin/activate

# Run the spoiler test and see the failure
npm test -- --mode=test-spoilers --game=presets/{world_dir}_worldgen/AP_14089154938208861744 --seed={seed}

# Analyze the failure
npm run test:analyze
cat playwright-analysis.txt
```

## Investigation Steps

1. **Compare sphere logs** to see where they diverge:
```bash
echo "=== Original sphere log (first 20 lines) ==="
head -20 frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl

echo "=== WorldGen sphere log (first 20 lines) ==="
head -20 frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl
```

2. **Check the rules.json** for the failing location:
```bash
# Extract a specific location's rule (replace LOCATION_NAME)
python -c "
import json
with open('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)
regions = data.get('regions', {{}}).get('1', {{}})
for region_name, region in regions.items():
    for loc in region.get('locations', []):
        # Print first few locations to understand the structure
        print(f'{{region_name}}: {{loc.get(\"name\")}}')
" | head -30
```

3. **Enable frontend debug logging**:
```bash
# Edit frontend/settings.json and set logLevel to "debug"
# Then re-run the test to see rule evaluation details
```

## Goal

Fix the world generator so that the spoiler test passes for `{game_name} WorldGen`.

The rules generated by the world generator must produce the same accessibility logic as the original world.
"""


def generate_worldgen_crossval_failure_prompt(game_name, template_file, world_mapping, seed=1):
    """Generate a prompt for debugging a Stage 4: Cross-Validation failure.

    Cross-validation failures occur when the worldgen world passes its own spoiler test
    but fails when validated against the original world's sphere log. This means the
    worldgen world has different accessibility logic than the original.
    """
    setup_doc = "CC/cloud-setup.md"
    debug_doc = "CC/debugging-worldgen-failures.md"

    # Get world directory from mapping
    world_dir = None
    if game_name in world_mapping:
        world_dir = world_mapping[game_name].get('world_directory', game_name.lower().replace(' ', ''))
    else:
        world_dir = game_name.lower().replace(' ', '')

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read {debug_doc} - specifically **Stage 4: Cross-Validation Failures**.

## Game Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **World directory**: `worlds/{world_dir}/`
- **WorldGen directory**: `worlds/{world_dir}_worldgen/`

## The Problem

The `{game_name} WorldGen` world:
- Generates a seed successfully
- Passes its own spoiler test (internal consistency)
- **Fails cross-validation** (original sphere log doesn't validate)

This means the worldgen rules produce **different accessibility logic** than the original world. Both worlds "work" internally, but they disagree about when locations become accessible.

## Debugging Steps

### 1. Compare sphere logs to find divergence

```bash
# View first 20 entries of each sphere log
echo "=== Original sphere log ==="
head -20 frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl

echo "=== WorldGen sphere log ==="
head -20 frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl
```

### 2. Find locations in different spheres

```bash
python -c "
import json

def load_sphere_log(path):
    locations = {{}}
    with open(path) as f:
        for line in f:
            entry = json.loads(line)
            locations[entry.get('location', '')] = entry.get('sphere', 0)
    return locations

original = load_sphere_log('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl')
worldgen = load_sphere_log('frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl')

print('Locations in different spheres:')
for loc in original:
    if loc in worldgen and original[loc] != worldgen[loc]:
        print(f'  {{loc}}: original sphere {{original[loc]}}, worldgen sphere {{worldgen[loc]}}')
"
```

### 3. Run manual cross-validation to see exact failure

```bash
# Backup worldgen sphere log
cp frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl \\
   frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl.bak

# Copy original sphere log to worldgen location
cp frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl \\
   frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/

# Run spoiler test
npm test -- --mode=test-spoilers --game=presets/{world_dir}_worldgen/AP_14089154938208861744 --seed={seed}
npm run test:analyze
cat playwright-analysis.txt

# Restore worldgen sphere log
mv frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl.bak \\
   frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl
```

### 4. Compare rules for divergent locations

Once you identify a location that's in different spheres, compare its rules:

```bash
python -c "
import json

def find_location_rule(rules_path, location_name):
    with open(rules_path) as f:
        data = json.load(f)
    regions = data.get('regions', {{}}).get('1', {{}})
    for region_name, region in regions.items():
        for loc in region.get('locations', []):
            if loc.get('name') == location_name:
                return {{'region': region_name, 'rule': loc.get('rule')}}
    return None

loc_name = 'LOCATION_NAME_HERE'  # Replace with actual location name
orig = find_location_rule('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json', loc_name)
wgen = find_location_rule('frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json', loc_name)

print('Original:', json.dumps(orig, indent=2))
print('WorldGen:', json.dumps(wgen, indent=2))
"
```

## Common Causes

1. **Helper function translation**: Helper logic translated differently between Python and worldgen
2. **Item group resolution**: Progressive items or item groups handled differently
3. **Region entry rules**: Entry requirements differ between original and worldgen
4. **Option-dependent rules**: Game options affecting rule evaluation differently

## Goal

Fix the world generator so that cross-validation passes - the worldgen rules must produce the **same accessibility order** as the original world.

## Test Command

```bash
source .venv/bin/activate
python scripts/test/test-world-generator.py --include-list "{template_file}" --canonical-seed1
```
"""
