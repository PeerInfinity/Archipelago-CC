"""
WorldGen prompt generators for debugging world generator failures.

These prompts guide debugging of the five stages of world generator testing:
- Stage 1: World Generation (creating _worldgen Python files)
- Stage 2: Seed Generation (running Generate.py with _worldgen world)
- Stage 3: Spoiler Test (validating against own sphere log)
- Stage 4: Cross-Validation (validating against original sphere log)
- Stage 5: Rules Comparison (comparing original and worldgen rules.json)
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


def generate_worldgen_rules_comp_failure_prompt(game_name, template_file, differences_count, world_mapping, seed=1):
    """Generate a prompt for debugging a Stage 5: Rules Comparison failure.

    Rules comparison failures occur when the _worldgen world generates rules.json
    that differ from the original world's rules.json export. These differences
    indicate the world generator is not perfectly round-tripping the rule data.
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

Then, please read {debug_doc} - specifically **Stage 5: Rules Comparison Failures**.

## Game Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **World directory**: `worlds/{world_dir}/`
- **WorldGen directory**: `worlds/{world_dir}_worldgen/`

## The Problem

The `{game_name} WorldGen` world:
- Generated world files successfully
- Generated a seed successfully
- **Rules comparison failed** with {differences_count} difference(s)

This means the rules.json exported from the worldgen world differs from the original world's rules.json export (after normalizing WorldGen name differences and ignoring canonical placements).

## Debugging Steps

### 1. Run the rules comparison to see exact differences

```bash
source .venv/bin/activate

# Compare the rules.json files (with ignore-canonical to filter expected differences)
python scripts/test/compare_rules_json.py --ignore-canonical \\
    frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json \\
    frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json
```

### 2. Analyze the difference

The comparison output will show:
- The JSON path where the difference occurs (e.g., `world.1.options.some_option`)
- The original value
- The worldgen value

Common difference patterns:
- **Option definitions**: Options exported differently
- **Item properties**: Items have different classifications
- **Rule structure**: Rules encoded differently
- **Metadata**: Game metadata fields differ

### 3. Trace the difference to the source

Once you identify the differing field, find where it's exported:

```bash
# Find where the field is exported in the original world
grep -rn "FIELD_NAME" exporter/exporter.py

# Find where the field is generated in worldgen
grep -rn "FIELD_NAME" world_generator/
```

### 4. Check if the difference is expected

Some differences are acceptable and should be added to the ignore list in `scripts/test/compare_rules_json.py`:
- Fields that are WorldGen-specific (like `randomize_items`)
- Fields that use generated values (like `world_classes`)
- Metadata that varies between exports

If the difference is expected, update `is_canonical_difference()` in `compare_rules_json.py`.

## Common Causes of Rules Comparison Failures

1. **World class names**: The original world has a different class name than what WorldGen generates
   - Original: `ChocolateChipCookiesWorld`
   - WorldGen: `BakingAdventureWorld` (derived from display name)
   - **Fix**: Add `world_classes` to the ignored differences

2. **Option definitions**: WorldGen adds options (like `randomize_items`) not in original
   - **Fix**: Add to ignored differences or don't export in worldgen

3. **Item group definitions**: Item groups serialized differently
   - **Fix**: Ensure consistent serialization

4. **Helper function exports**: Helper definitions differ
   - **Fix**: Ensure world generator exports helpers identically

## Files to Investigate

- `exporter/exporter.py` - Original rules.json export logic
- `world_generator/extractors.py` - How data is read from rules.json
- `world_generator/templates.py` - How worldgen world code is generated
- `scripts/test/compare_rules_json.py` - Comparison logic and ignore list

## Test Commands

```bash
source .venv/bin/activate

# Full test including rules comparison
python scripts/test/test-world-generator.py --include-list "{template_file}" --canonical-seed1 --skip-cleanup

# Just regenerate and compare rules
python scripts/test/test-world-generator.py --include-list "{template_file}" --phase generate-test-worlds --canonical-seed1
python scripts/test/test-world-generator.py --phase regenerate-templates
python Generate.py --weights_file_path "Templates/{game_name} WorldGen.yaml" --multi 1 --seed {seed}

# Then compare
python scripts/test/compare_rules_json.py --ignore-canonical \\
    frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json \\
    frontend/presets/{world_dir}_worldgen/AP_14089154938208861744/AP_14089154938208861744_rules.json
```

## Goal

Either:
1. Fix the world generator to produce identical rules.json output, OR
2. Add the difference to the ignore list if it's expected/acceptable
"""


def generate_ut_fuzz_failure_prompt(game_name, template_file, world_dir, ut_fuzz_info, world_mapping, seed=1):
    """Generate a prompt for debugging UT fuzz failures on games that pass canonical worldgen.

    These failures occur when:
    - The game passes all canonical worldgen tests (seed=1 with default options)
    - But UT fuzz testing reveals logic mismatches under random option configurations

    This indicates that:
    - The core rules export/import is working correctly
    - But certain option combinations cause rule evaluation differences between
      the original Python world and the worldgen-based tracker
    """
    setup_doc = "CC/cloud-setup.md"
    fuzz_doc = "CC/docs/fuzzer-testing.md"

    # Extract stats
    total = ut_fuzz_info.get('total', 0)
    success = ut_fuzz_info.get('success', 0)
    failure = ut_fuzz_info.get('failure', 0)
    timeout = ut_fuzz_info.get('timeout', 0)
    success_rate = ut_fuzz_info.get('success_rate', 0)
    error_types = ut_fuzz_info.get('error_types', [])
    error_runs = ut_fuzz_info.get('error_runs', {})

    # Format error runs for display
    error_runs_text = ""
    for error_type, runs in error_runs.items():
        run_list = ', '.join(str(r) for r in runs[:10])
        if len(runs) > 10:
            run_list += f', ... ({len(runs)} total)'
        error_runs_text += f"  - {error_type or 'Logic mismatch'}: runs [{run_list}]\n"

    # Build error type guidance
    error_guidance = ""
    if 'None' in error_types:
        error_guidance = """
## Error Analysis: Logic Mismatch

The most common UT fuzz failure type is **logic mismatch** (error type: `None`).
This means the Universal Tracker and the server disagree about which locations are accessible.

**Common causes:**
1. **Option-dependent rules**: Rules that behave differently based on game options
2. **Dynamic state**: Rules involving inventory counts or item combinations
3. **Progressive items**: Progressive item tiers evaluated differently
4. **Item groups**: Group membership evaluated inconsistently
5. **Helper function logic**: Helper functions with option-dependent branches

**Investigation approach:**
1. Find which options combination causes the failure
2. Compare rule evaluation in UT vs server for a specific location
3. Check if the rule or helper needs option-aware adjustments
"""
    else:
        error_guidance = f"""
## Error Analysis: Exception Errors

The UT fuzz test encountered Python exceptions: {', '.join(error_types)}

This typically means:
1. Missing helper functions under certain option configurations
2. Type errors in rule evaluation
3. Key errors when looking up option-dependent data
"""

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read {fuzz_doc} for background on UT fuzzer testing.

## Game Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **World directory**: `worlds/{world_dir}/`

## The Problem

This game **passes canonical worldgen testing** (all 5 stages with seed=1 and default options),
but **fails UT fuzz testing** which tests random option configurations.

### UT Fuzz Test Results

- **Total runs**: {total}
- **Success**: {success} ({success_rate:.1f}%)
- **Failures**: {failure}
- **Timeouts**: {timeout}

**Failing runs by error type:**
{error_runs_text}
{error_guidance}

## Investigation Steps

### 1. Reproduce a failing configuration

Pick a specific failing run number from the error list above and reproduce it:

```bash
source .venv/bin/activate

# Run the fuzzer with a specific seed to reproduce a failure
# The run number becomes the seed for the random option generator
python fuzz.py -r 1 -j 1 -g {world_dir} -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed <RUN_NUMBER>
```

For example, to reproduce run 2:
```bash
python fuzz.py -r 1 -j 1 -g {world_dir} -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed 2
```

### 2. Check the failure log

Look at the generated log file for the failed run:

```bash
cat fuzz_output/error/{world_dir}/0/0.log
```

The log shows:
- The YAML options used for this run
- Which locations disagree between UT and server
- "Locations X were in server logic but not expected in UT" (or vice versa)

### 3. Check the YAML configuration

```bash
cat fuzz_output/error/{world_dir}/0/0.yaml
```

This shows the exact option values that caused the failure.

### 4. Compare rule evaluation

Once you identify a disagreeing location, check how its rule is evaluated:

```bash
# Find the location's rule in the original rules.json
python -c "
import json
with open('frontend/presets/{world_dir}/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)

loc_name = 'LOCATION_NAME_HERE'  # Replace with actual location
regions = data.get('regions', {{}}).get('1', {{}})
for region_name, region in regions.items():
    for loc in region.get('locations', []):
        if loc.get('name') == loc_name:
            print(f'Region: {{region_name}}')
            print(f'Rule: {{json.dumps(loc.get(\"rule\"), indent=2)}}')
            break
"
```

### 5. Check option-dependent helpers

If the rule uses helper functions, check if they have option-dependent behavior:

```bash
# Search for option checks in helpers
grep -n "options\\|self\\.multiworld" worlds/{world_dir}/Rules.py | head -30
```

## Common Fixes

### Option-dependent rules not exported

If a rule behaves differently based on options, ensure the exporter handles all cases.
Check `exporter/games/official/` or `exporter/games/unofficial/` for game-specific exporters.

### Helper function with unhandled options

If a helper has option branches, you may need to:
1. Export the helper with option parameters
2. Ensure the helper is correctly evaluated in the tracker

### Progressive item handling

If progressive items are involved, check:
```bash
grep -n "Progressive" worlds/{world_dir}/Rules.py
grep -n "progressive" frontend/presets/{world_dir}/AP_*/AP_*_rules.json | head -10
```

## Test Commands

```bash
source .venv/bin/activate

# Single fuzzer run (specific seed to reproduce)
python fuzz.py -r 1 -j 1 -g {world_dir} -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed <RUN_NUMBER>

# Multiple runs to check success rate
python fuzz.py -r 10 -j 4 -g {world_dir} -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Full test via the test runner
python scripts/test/test-all-ut-fuzz.py --runs 10 --include-list "{template_file}"
```

## Goal

Fix the rule export/evaluation so that UT fuzz testing passes (or has a significantly higher success rate).

The rules must produce the **same accessibility determinations** regardless of which option combinations are used.

## Reference Files

- `worlds/{world_dir}/Rules.py` - Original rule definitions
- `worlds/{world_dir}/Options.py` - Game options that affect rules
- `exporter/exporter.py` - Rules export logic
- `exporter/games/official/` or `exporter/games/unofficial/` - Game-specific exporters (check for {world_dir}.py)
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer hook implementation
"""


def generate_ut_fuzz_apworld_failure_prompt(
    game_name,
    template_file,
    world_dir,
    ut_fuzz_info,
    download_url=None,
    error_category='unknown',
    error_details=None,
):
    """Generate a prompt for debugging UT fuzz failures on community apworlds.

    These failures occur when community-built .apworld files fail the Universal
    Tracker fuzz test. Unlike bundled worlds, apworlds require downloading and
    installation before investigation.

    Args:
        game_name: Display name of the game
        template_file: Template YAML filename
        world_dir: World directory name
        ut_fuzz_info: Dict with total, success, failure, timeout, error_types, error_runs
        download_url: URL to download the .apworld file (optional)
        error_category: Categorized error type (logic_mismatch, exceptions, etc.)
        error_details: Additional error details dict
    """
    setup_doc = "CC/cloud-setup.md"
    fuzz_doc = "CC/docs/fuzzer-testing.md"

    # Extract stats
    total = ut_fuzz_info.get('total', 0)
    success = ut_fuzz_info.get('success', 0)
    failure = ut_fuzz_info.get('failure', 0)
    timeout = ut_fuzz_info.get('timeout', 0)
    ignored = ut_fuzz_info.get('ignored', 0)
    success_rate = ut_fuzz_info.get('success_rate', 0)
    error_types = ut_fuzz_info.get('error_types', [])
    error_runs = ut_fuzz_info.get('error_runs', {})

    # Format error runs for display
    error_runs_text = ""
    for error_type, runs in error_runs.items():
        run_list = ', '.join(str(r) for r in runs[:10])
        if len(runs) > 10:
            run_list += f', ... ({len(runs)} total)'
        error_runs_text += f"  - {error_type or 'Logic mismatch'}: runs [{run_list}]\n"

    # Build download instructions
    if download_url:
        download_instructions = f"""### 1. Download and install the apworld

```bash
# Download the apworld file
curl -L -o custom_worlds/{world_dir}.apworld "{download_url}"

# Verify the download
ls -la custom_worlds/{world_dir}.apworld
```

If curl fails or the URL is outdated, you can manually download from silasary's APWorld index:
- Visit: https://archipelago-apworlds.github.io/
- Search for: {game_name}
- Download the .apworld file to `custom_worlds/`
"""
    else:
        download_instructions = f"""### 1. Download and install the apworld

The download URL is not available in the test results. Download manually from silasary's APWorld index:

```bash
# 1. Visit: https://archipelago-apworlds.github.io/
# 2. Search for: {game_name}
# 3. Download the .apworld file

# 4. Move/copy to custom_worlds directory:
mv ~/Downloads/{world_dir}.apworld custom_worlds/

# 5. Verify the download
ls -la custom_worlds/{world_dir}.apworld
```
"""

    # Build error type guidance
    error_guidance = ""
    if error_category == 'logic_mismatch':
        error_guidance = """
## Error Analysis: Logic Mismatch

The most common UT fuzz failure type is **logic mismatch** (error type: `None`).
This means the Universal Tracker and the server disagree about which locations are accessible.

**For apworlds, common causes include:**
1. **Incompatible Archipelago version**: The apworld was built for a different AP version
2. **Option-dependent rules**: Rules that behave differently based on game options
3. **Helper function logic**: Helper functions with unhandled edge cases
4. **Item group definitions**: Item groups not properly recognized
5. **Progressive item handling**: Progressive items evaluated differently

**Investigation approach:**
1. First verify the apworld loads without errors
2. Find which options combination causes the failure
3. Compare rule evaluation in UT vs server for a specific location
"""
    elif error_category == 'logic_mismatch_with_errors':
        exception_types = error_details.get('exception_types', []) if error_details else []
        error_guidance = f"""
## Error Analysis: Logic Mismatch with Exceptions

This apworld has both **logic mismatches** AND **Python exceptions**: {', '.join(exception_types)}

The exceptions may be causing or masking the logic mismatches. Prioritize fixing the exceptions first.

**Investigation approach:**
1. Reproduce the exception to get the full traceback
2. Check if the apworld's Rules.py has errors
3. Look for missing helper functions or type errors
"""
    elif error_category == 'exceptions':
        exception_types = error_details.get('types', []) if error_details else error_types
        error_guidance = f"""
## Error Analysis: Python Exceptions

The UT fuzz test encountered Python exceptions: {', '.join(exception_types)}

**For apworlds, this typically means:**
1. **Import errors**: Missing dependencies or incompatible modules
2. **Missing helper functions**: Helpers not exported or not defined
3. **Type errors**: Unexpected data types in rule evaluation
4. **Key errors**: Missing entries in lookup tables

**Investigation approach:**
1. First check if the apworld loads at all
2. Run a simple seed generation to verify basic functionality
3. Then reproduce the failing configuration
"""
    else:
        error_guidance = """
## Error Analysis: Unknown Error Type

The failure type could not be categorized. Review the failing runs carefully.
"""

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read {fuzz_doc} for background on UT fuzzer testing.

## APWorld Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **World directory**: `{world_dir}/` (from custom_worlds/{world_dir}.apworld)
- **Download URL**: {download_url or 'Not available - see manual download instructions'}

## The Problem

This is a **community apworld** (not a bundled world) that fails the Universal Tracker fuzz test.
APWorlds are community-built game integrations that may have compatibility issues or logic errors.

### UT Fuzz Test Results

- **Total runs**: {total}
- **Success**: {success} ({success_rate:.1f}%)
- **Failures**: {failure}
- **Timeouts**: {timeout}
- **Ignored**: {ignored}

**Failing runs by error type:**
{error_runs_text}

## Setup Instructions

{download_instructions}

### 2. Regenerate templates to include the apworld

```bash
source .venv/bin/activate

# Generate template for this apworld
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

# Verify the template was created
ls -la Players/Templates/*{game_name}* 2>/dev/null || ls Players/Templates/ | grep -i "{world_dir}"
```

### 3. Verify the apworld loads correctly

```bash
# Check if the world loads
python -c "from worlds import AutoWorldRegister; print('{game_name}' in [w.game for w in AutoWorldRegister.world_types.values()])"

# Try a basic seed generation
python Generate.py --weights_file_path "Templates/{template_file}" --multi 1 --seed 1
```
{error_guidance}

## Investigation Steps

### 4. Reproduce a failing configuration

Pick a specific failing run number from the error list above and reproduce it:

```bash
source .venv/bin/activate

# Run the fuzzer with a specific seed to reproduce a failure
python fuzz.py -r 1 -j 1 -g {world_dir} -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed <RUN_NUMBER>
```

### 5. Check the failure log

```bash
cat fuzz_output/error/{world_dir}/0/0.log
```

The log shows:
- The YAML options used for this run
- Which locations disagree between UT and server
- Full tracebacks for any exceptions

### 6. Check the YAML configuration

```bash
cat fuzz_output/error/{world_dir}/0/0.yaml
```

This shows the exact option values that caused the failure.

## APWorld-Specific Considerations

Unlike bundled worlds, apworlds:
1. **May target a different AP version** - Check the apworld's metadata for version requirements
2. **May have unreviewed code** - The Rules.py and other files haven't been vetted for UT compatibility
3. **May lack exporter support** - Check `exporter/games/unofficial/` for a {world_dir}.py exporter
4. **May use custom logic patterns** - Not all world patterns are supported by the tracker

### Check apworld metadata

```bash
# Extract and view apworld info
python -c "
import zipfile
import json
apworld = 'custom_worlds/{world_dir}.apworld'
with zipfile.ZipFile(apworld, 'r') as z:
    # List contents
    print('Files:', z.namelist()[:20])
    # Try to read __init__.py for metadata
    for name in z.namelist():
        if name.endswith('__init__.py'):
            print(f'\\n=== {{name}} (first 50 lines) ===')
            content = z.read(name).decode('utf-8')
            for i, line in enumerate(content.split('\\n')[:50]):
                print(line)
            break
"
```

## Test Commands

```bash
source .venv/bin/activate

# Single fuzzer run (specific seed to reproduce)
python fuzz.py -r 1 -j 1 -g {world_dir} -n 1 --hook worlds.tracker.fuzzer_hook:Hook --seed <RUN_NUMBER>

# Multiple runs to check success rate
python fuzz.py -r 10 -j 4 -g {world_dir} -n 1 --hook worlds.tracker.fuzzer_hook:Hook

# Full test via the test runner
python scripts/test/test-all-ut-fuzz.py --runs 10 --include-list "{template_file}" --custom-worlds-only
```

## Goal

Investigate the apworld failure and determine:
1. Is this a fundamental compatibility issue with the apworld?
2. Can it be fixed by modifying the exporter/tracker?
3. Does the apworld need updates from its maintainer?

Document your findings so we can either:
- Fix the issue in our codebase
- Report the issue to the apworld maintainer
- Add the apworld to a known-incompatible list

## Reference Files

- `custom_worlds/{world_dir}.apworld` - The apworld package (ZIP file)
- `exporter/exporter.py` - Rules export logic
- `exporter/games/unofficial/` - Unofficial game exporters (check for {world_dir}.py)
- `worlds/tracker/fuzzer_hook.py` - UT fuzzer hook implementation
- `scripts/data/apworld-combined-data.json` - APWorld metadata
"""
