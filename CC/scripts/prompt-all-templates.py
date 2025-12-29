#!/usr/bin/env python3
"""
Script to iterate through template files and run prompt.py for games that aren't fully passing tests.
Checks test results and processes failing games automatically.
"""

import argparse
import json
import os
import subprocess
import sys
import yaml
from pathlib import Path

# Add parent scripts directory to path to import shared modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'scripts')))

from lib.test_utils import read_host_yaml_config, load_template_exclude_list
from lib.test_results import is_test_passing, load_existing_results


def load_world_mapping(project_root):
    """Load the world mapping JSON file."""
    mapping_file = Path(project_root) / 'scripts' / 'data' / 'world-mapping.json'
    if not mapping_file.exists():
        return {}
    try:
        with open(mapping_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading world mapping: {e}", file=sys.stderr)
        return {}


def load_prompt_exclusion_lists(project_root):
    """Load the prompt exclusion lists from template-exclude-list.json.

    Returns a dict with two sets:
    - 'requires_javascript_helpers': Games that require JavaScript helpers
      (excluded from new-rule-types prompts)
    - 'exporter_fully_simplified': Games whose exporters are fully simplified
      (excluded from helper-export and exporter-simplify prompts)
    """
    exclude_file = Path(project_root) / 'scripts' / 'data' / 'template-exclude-list.json'
    result = {
        'requires_javascript_helpers': set(),
        'exporter_fully_simplified': set()
    }

    if not exclude_file.exists():
        return result

    try:
        with open(exclude_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Load requires_javascript_helpers_list
        for item in data.get('requires_javascript_helpers_list', []):
            if isinstance(item, dict) and 'name' in item:
                result['requires_javascript_helpers'].add(item['name'])
            elif isinstance(item, str):
                result['requires_javascript_helpers'].add(item)

        # Load exporter_fully_simplified_list
        for item in data.get('exporter_fully_simplified_list', []):
            if isinstance(item, dict) and 'name' in item:
                result['exporter_fully_simplified'].add(item['name'])
            elif isinstance(item, str):
                result['exporter_fully_simplified'].add(item)

        return result
    except Exception as e:
        print(f"Error loading prompt exclusion lists: {e}", file=sys.stderr)
        return result


def get_test_results_path(project_root, use_full_spoilers=False, use_minimal_spoilers=False, use_multiclient=False, use_multiworld=False):
    """Determine the correct test results path based on host.yaml configuration or command-line flags."""
    # If --multiworld is set, use the multiworld results path
    if use_multiworld:
        return Path(project_root) / 'scripts/output/multiworld/test-results.json'

    # If --multiclient is set, use the multiclient results path
    if use_multiclient:
        return Path(project_root) / 'scripts/output/multiclient/test-results.json'

    # If --full-spoilers is set, always use the full spoilers path
    if use_full_spoilers:
        return Path(project_root) / 'scripts/output/spoiler-full/test-results.json'

    # If --minimal-spoilers is set, always use the minimal spoilers path
    if use_minimal_spoilers:
        return Path(project_root) / 'scripts/output/spoiler-minimal/test-results.json'

    # Otherwise, read host.yaml to check extend_sphere_log_to_all_locations setting
    host_config = read_host_yaml_config(project_root)
    extend_sphere_log = host_config.get('general_options', {}).get('extend_sphere_log_to_all_locations', True)

    # Use appropriate output directory based on configuration
    if extend_sphere_log:
        return Path(project_root) / 'scripts/output/spoiler-full/test-results.json'
    else:
        return Path(project_root) / 'scripts/output/spoiler-minimal/test-results.json'


def load_test_results(project_root, use_full_spoilers=False, use_minimal_spoilers=False, use_multiclient=False, use_multiworld=False):
    """Load the template test results JSON file."""
    results_file = get_test_results_path(project_root, use_full_spoilers, use_minimal_spoilers, use_multiclient, use_multiworld)
    if not results_file.exists():
        return {}

    # Use shared load_existing_results function and return just the results section
    data = load_existing_results(str(results_file))
    return data.get('results', {})


def run_template_test(template_file, seed=1):
    """Run the template test for a specific template file."""
    print(f"Running template test for: {template_file}")
    try:
        result = subprocess.run(
            ['python', 'scripts/test/test-all-templates.py', '--include-list', template_file, '--seed', str(seed)],
            capture_output=True, text=True, check=False
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Error running template test: {e}", file=sys.stderr)
        return False


def extract_game_name_from_yaml(template_path):
    """Extract the game name from a template YAML file."""
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        # Look for 'game' field directly in the YAML
        if 'game' in data:
            return data['game']

        # Look for the game name in player data structure
        for key, value in data.items():
            if isinstance(value, dict) and 'game' in value:
                return value['game']

        # Fallback: try to infer from filename (remove .yaml extension if present)
        template_filename_stem = template_path.stem
        if template_filename_stem.endswith('.yaml'):
            template_filename_stem = template_filename_stem[:-5]
        return template_filename_stem.replace(' Template', '')

    except Exception as e:
        print(f"Error reading template {template_path}: {e}", file=sys.stderr)
        return None


def get_first_failing_seed(template_file, test_results):
    """Get the first failing seed number from test results.
    Returns the first_failure_seed if available, None otherwise."""
    if template_file not in test_results:
        return None

    result = test_results[template_file]

    if not isinstance(result, dict):
        return None

    # Return first_failure_seed if it exists and is non-null
    return result.get('first_failure_seed')


def get_template_files(template_dir, skip_list=None):
    """Get all template files from the template directory."""
    template_path = Path(template_dir)
    if not template_path.exists():
        print(f"Template directory not found: {template_dir}", file=sys.stderr)
        return []
    
    # Get all .yaml files
    template_files = list(template_path.glob('*.yaml'))
    template_files.extend(template_path.glob('*.yml'))
    
    # Filter out files in skip list
    if skip_list:
        template_files = [f for f in template_files if f.name not in skip_list]
    
    # Sort for consistent ordering
    template_files.sort()
    
    return [f.name for f in template_files]


def run_prompt_for_game(game_name, use_text_mode=False, use_prompt_mode=False, seed=1, quiet_mode=False, use_cloud_docs=False, use_full_spoilers=False):
    """Run the prompt script for a specific game."""
    if not quiet_mode:
        print(f"Running prompt script for game: {game_name}")
    try:
        cmd = ['python', 'CC/scripts/prompt.py', game_name, '--seed', str(seed)]
        if use_text_mode:
            cmd.append('--text')
        if use_prompt_mode:
            cmd.append('--prompt')
        if use_cloud_docs:
            cmd.append('--CC')
        if use_full_spoilers:
            cmd.append('--full-spoilers')

        result = subprocess.run(cmd, check=False)
        return result.returncode == 0
    except Exception as e:
        if not quiet_mode:
            print(f"Error running prompt script: {e}", file=sys.stderr)
        return False


def get_prompt_for_game(game_name, seed=1, use_cloud_docs=False, use_full_spoilers=False):
    """Get the prompt text for a specific game without running it."""
    try:
        cmd = ['python', 'CC/scripts/prompt.py', game_name, '--seed', str(seed), '--prompt']
        if use_cloud_docs:
            cmd.append('--CC')
        if use_full_spoilers:
            cmd.append('--full-spoilers')
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode == 0:
            return result.stdout
        else:
            print(f"Error getting prompt for {game_name}: {result.stderr}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Error getting prompt for {game_name}: {e}", file=sys.stderr)
        return None


def is_multiworld_test_passing(template_file, test_results):
    """Check if a multiworld test is passing for a template.

    Returns True if:
    - The test passed (multiworld_test.success is True)

    Returns False if:
    - The test failed (multiworld_test.success is False)
    - The template is not in the results
    """
    if template_file not in test_results:
        return False

    result = test_results[template_file]
    if not isinstance(result, dict):
        return False

    multiworld_test = result.get('multiworld_test', {})
    return multiworld_test.get('success', False)


def get_multiworld_bisection_info(template_file, test_results):
    """Get bisection results for a failing multiworld test.

    Returns a dict with:
        - has_bisection: bool (True if bisection results exist)
        - failing_pairs: list of template filenames that fail when paired
        - tested_pairs: list of dicts with pair test details
        - templates_in_multiworld: dict mapping player numbers to template names
    """
    if template_file not in test_results:
        return {'has_bisection': False, 'failing_pairs': [], 'tested_pairs': [], 'templates_in_multiworld': {}}

    result = test_results[template_file]
    if not isinstance(result, dict):
        return {'has_bisection': False, 'failing_pairs': [], 'tested_pairs': [], 'templates_in_multiworld': {}}

    bisection_results = result.get('bisection_results', {})
    multiworld_test = result.get('multiworld_test', {})

    return {
        'has_bisection': bisection_results.get('triggered', False),
        'failing_pairs': bisection_results.get('failing_pairs', []),
        'tested_pairs': bisection_results.get('tested_pairs', []),
        'templates_in_multiworld': multiworld_test.get('templates_in_multiworld', {})
    }


def get_multiworld_failure_details(template_file, test_results):
    """Get details about why a multiworld test failed.

    Returns a dict with:
        - player_number: which player number this template was tested as
        - player_results: results for each player tested
        - first_failure_player: which player failed first (if any)
        - generation_success: whether generation succeeded
        - intermittent_failures: list of intermittent failures (tests that failed initially but passed on retry)
    """
    if template_file not in test_results:
        return None

    result = test_results[template_file]
    if not isinstance(result, dict):
        return None

    multiworld_test = result.get('multiworld_test', {})
    generation = result.get('generation', {})

    return {
        'player_number': multiworld_test.get('player_number'),
        'player_results': multiworld_test.get('player_results', {}),
        'first_failure_player': multiworld_test.get('first_failure_player'),
        'generation_success': generation.get('success', False),
        'templates_in_multiworld': multiworld_test.get('templates_in_multiworld', {}),
        'intermittent_failures': multiworld_test.get('intermittent_failures', [])
    }


def is_basic_game(game_name, world_mapping):
    """Check if a game is 'basic' - no custom exporter or JavaScript helpers.

    Returns True if the game has neither a custom exporter nor custom game logic.
    """
    if game_name not in world_mapping:
        # If not in mapping, assume it's basic (uses generic infrastructure)
        return True

    game_info = world_mapping[game_name]
    has_custom_exporter = game_info.get('has_custom_exporter', False)
    has_custom_game_logic = game_info.get('has_custom_game_logic', False)

    return not has_custom_exporter and not has_custom_game_logic


def has_custom_code(game_name, world_mapping):
    """Check if a game has custom exporter or JavaScript helpers.

    Returns True if the game has either a custom exporter or custom game logic.
    """
    if game_name not in world_mapping:
        return False

    game_info = world_mapping[game_name]
    has_custom_exporter = game_info.get('has_custom_exporter', False)
    has_custom_game_logic = game_info.get('has_custom_game_logic', False)

    return has_custom_exporter or has_custom_game_logic


def has_javascript_helpers(game_name, world_mapping):
    """Check if a game has custom JavaScript helpers.

    Returns True if the game has custom game logic (JavaScript helpers).
    """
    if game_name not in world_mapping:
        return False

    game_info = world_mapping[game_name]
    return game_info.get('has_custom_game_logic', False)


def get_custom_code_info(game_name, world_mapping):
    """Get information about custom code for a game.

    Returns a dict with has_exporter, has_helpers, exporter_path, helpers_path.
    """
    if game_name not in world_mapping:
        return {
            'has_exporter': False,
            'has_helpers': False,
            'exporter_path': None,
            'helpers_path': None,
            'world_directory': None
        }

    game_info = world_mapping[game_name]
    return {
        'has_exporter': game_info.get('has_custom_exporter', False),
        'has_helpers': game_info.get('has_custom_game_logic', False),
        'exporter_path': game_info.get('exporter_path'),
        'helpers_path': game_info.get('game_logic_path'),
        'world_directory': game_info.get('world_directory')
    }


def has_generation_errors_but_passes(template_file, test_results):
    """Check if a template passes spoiler tests but has generation errors.

    Returns a tuple of (has_errors, error_count) where:
    - has_errors: True if the game passes but has generation errors
    - error_count: Number of generation errors (0 if no errors or test fails)
    """
    if template_file not in test_results:
        return (False, 0)

    result = test_results[template_file]
    if not isinstance(result, dict):
        return (False, 0)

    # Check if spoiler test passed
    spoiler_test = result.get('spoiler_test', {})
    if spoiler_test.get('pass_fail') != 'passed':
        return (False, 0)

    # Check for generation errors
    generation = result.get('generation', {})
    error_count = generation.get('error_count', 0)

    if error_count > 0:
        return (True, error_count)

    return (False, 0)


def run_all_promptfiles(project_root):
    """Run all prompt-generating modes and output to separate files.

    Creates CC/scripts/prompts/ directory and generates a separate prompt file for each mode.
    """
    prompts_dir = Path(project_root) / 'CC' / 'scripts' / 'prompts'
    prompts_dir.mkdir(exist_ok=True)

    # Define all the modes to run with their output filenames
    modes = [
        (['--minimal-spoilers', '--CC'], 'minimal-spoilers.txt'),
        (['--full-spoilers', '--CC'], 'full-spoilers.txt'),
        (['--multiclient', '--CC'], 'multiclient.txt'),
        (['--multiworld', '--CC'], 'multiworld.txt'),
        (['--basic-spoiler-debug', '--CC'], 'basic-spoiler-debug.txt'),
        (['--helper-export', '--CC'], 'helper-export.txt'),
        (['--exporter-simplify', '--CC'], 'exporter-simplify.txt'),
        (['--new-rule-types', '--CC'], 'new-rule-types.txt'),
        (['--gen-errors', '--CC'], 'gen-errors.txt'),
        (['--worldgen-world-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-world-failures.txt'),
        (['--worldgen-seed-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-seed-failures.txt'),
        (['--worldgen-spoiler-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-spoiler-failures.txt'),
        (['--worldgen-crossval-failures', '--worldgen-test-mode', 'canonical'], 'worldgen-crossval-failures.txt'),
    ]

    script_path = Path(__file__).resolve()
    results = []

    for mode_args, output_filename in modes:
        output_file = prompts_dir / output_filename
        print(f"Running mode: {' '.join(mode_args)}...")

        # Run the script with --promptfile and capture the output
        cmd = ['python', str(script_path), '--promptfile'] + mode_args
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)

        if result.returncode != 0:
            print(f"  Warning: Mode {mode_args} returned non-zero exit code")
            if result.stderr:
                print(f"  stderr: {result.stderr[:200]}")

        # The script writes to CC/scripts/prompts.txt, so move it to the mode-specific file
        default_output = Path(project_root) / 'CC' / 'scripts' / 'prompts.txt'
        if default_output.exists():
            # Read the content and count prompts
            with open(default_output, 'r') as f:
                content = f.read()

            # Count prompts by counting separator blocks (or 1 if no separators)
            if content.strip():
                prompt_count = content.count('=' * 80) + 1
                # Write to mode-specific file
                with open(output_file, 'w') as f:
                    f.write(content)
                results.append((output_filename, prompt_count))
                print(f"  Created {output_file} with {prompt_count} prompts")
            else:
                results.append((output_filename, 0))
                print(f"  No prompts generated for this mode")

            # Remove the default file
            default_output.unlink()
        else:
            results.append((output_filename, 0))
            print(f"  No prompts generated for this mode")

    # Print summary
    print(f"\n{'='*60}")
    print("Summary:")
    print(f"{'='*60}")
    total_prompts = 0
    for filename, count in results:
        if count > 0:
            print(f"  {filename}: {count} prompts")
            total_prompts += count
        else:
            print(f"  {filename}: (empty)")
    print(f"\nTotal: {total_prompts} prompts across {len([r for r in results if r[1] > 0])} files")
    print(f"Output directory: {prompts_dir}")

    return 0


def generate_helper_export_prompt(template_file, game_name, custom_code_info, seed=1, use_cloud_docs=False):
    """Generate a prompt for converting a game to use helper export.

    This prompt refers to CC/helper-export-guide.md for games that have
    custom exporters or JavaScript helpers that could potentially be removed.
    """
    doc_path = "CC/helper-export-guide.md"
    setup_doc = "CC/cloud-setup.md"

    # Build description of what custom code exists
    custom_parts = []
    if custom_code_info['has_exporter']:
        custom_parts.append(f"- Custom exporter: `{custom_code_info['exporter_path']}`")
    if custom_code_info['has_helpers']:
        custom_parts.append(f"- JavaScript helpers: `{custom_code_info['helpers_path']}`")
    custom_code_desc = "\n".join(custom_parts)

    world_dir = custom_code_info.get('world_directory', '<game>')

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read
{doc_path}

The game we are working on is **{game_name}** (template: `{template_file}`).

This game currently has custom code:
{custom_code_desc}

## Goal

The goal is to eliminate the custom code by exporting helper function definitions to `rules.json`, allowing the frontend to evaluate them directly without JavaScript implementations.

## Test Command

To test the current state:

```bash
source .venv/bin/activate
python scripts/test/test-all-templates.py --include-list "{template_file}" --minimal-spoilers
```

## Steps

1. **Review the current implementation**
   - Check the custom exporter (if any) for helper configurations
   - Check the JavaScript helpers (if any) to understand what logic exists

2. **Enable automatic helper export** (if not already enabled)
   - Set `AUTO_EXPORT_DISCOVERED_HELPERS = True` in the exporter

3. **Test and iterate**
   - Regenerate and run tests
   - Add complex helpers to `HELPERS_TO_EXPORT_BLACKLIST` if needed
   - Repeat until tests pass

4. **Remove JavaScript helpers**
   - Once tests pass with exported helpers, remove the JavaScript implementations
   - Keep only blacklisted helpers and their dependencies

5. **Remove custom exporter** (if possible)
   - If no custom logic remains, delete the exporter file entirely

## Reference Files

- Python world: `worlds/{world_dir}/`
- Rules file: `worlds/{world_dir}/Rules.py`
"""


def generate_exporter_simplify_prompt(template_file, game_name, custom_code_info, seed=1, use_cloud_docs=False):
    """Generate a prompt for simplifying a game's custom exporter.

    This prompt guides simplification of custom exporters by leveraging
    base class auto-discovery features and removing redundant code,
    following the pattern established by the ALTTP exporter simplification.
    """
    setup_doc = "CC/cloud-setup.md"
    exporter_path = custom_code_info.get('exporter_path', 'exporter/games/<game>.py')
    world_dir = custom_code_info.get('world_directory', '<game>')

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

## Game Information

- **Game**: {game_name}
- **Template**: `{template_file}`
- **Custom exporter**: `{exporter_path}`
- **World directory**: `worlds/{world_dir}/`

## Goal

Simplify the custom exporter by leveraging base class auto-discovery features and removing redundant code. The goal is to reduce the exporter to only the code that is truly game-specific.

## Reference: ALTTP Simplification

The ALTTP exporter (`exporter/games/alttp.py`) was recently simplified from ~500 lines to ~60 lines. Review the current state of that file as a reference for the target simplicity.

Key simplification patterns applied:

1. **Factor out commonly useful code into the base exporter** - If you find code that could benefit other games, move it to `exporter/games/base.py`:
   - Generic function handlers (e.g., `location_item_name`, `item_name_in_location_names`)
   - Common AST patterns (e.g., Location object detection in closures)
   - Reusable data extraction logic (e.g., world attribute discovery)
   - The goal is to leave only truly game-specific code in the custom exporter

2. **Remove redundant method overrides** - Methods that just call `super()` or return minimal data can be removed:
   - `get_world_data()` - base class handles options export
   - `get_game_info()` - base class exports richer metadata
   - `cleanup_settings()` - often dead code after other fixes

3. **Enable auto-discovery flags** instead of manual WORLD_ATTRIBUTES:
   - `AUTO_DISCOVER_WORLD_ATTRIBUTES = True` - auto-discovers world instance attributes
   - `AUTO_DISCOVER_REGION_ATTRIBUTES = True` - auto-discovers region attributes
   - `AUTO_DISCOVER_LOCATION_ATTRIBUTES = False` - often False, only enable if needed

4. **Remove game-specific replace_name overrides** - Location objects in closures are now automatically detected and replaced with 'location' keyword by the base AST visitor

5. **Remove game-specific handle_special_function_call overrides** - Generic functions like `location_item_name` and `item_name_in_location_names` are now handled by the base class

6. **Remove unused imports** - After removing code, clean up any imports that are no longer needed

7. **Remove redundant flag declarations** - If the base class default is appropriate, don't redeclare:
   - `AUTO_EXPORT_DISCOVERED_HELPERS = True` (now default)
   - `AUTO_PRESERVE_LARGE_HELPERS = True` (now default)

## Investigation Commands

```bash
source .venv/bin/activate

# View current exporter size
wc -l {exporter_path}

# View ALTTP exporter for reference
cat exporter/games/alttp.py

# Check what flags the exporter sets
grep -n "AUTO_" {exporter_path}

# Check for method overrides that might be removable
grep -n "def get_world_data\\|def get_game_info\\|def cleanup_settings\\|def replace_name\\|def handle_special_function_call" {exporter_path}

# Check for manual WORLD_ATTRIBUTES that could be auto-discovered
grep -n "WORLD_ATTRIBUTES" {exporter_path}
```

## Test Commands

After each simplification, verify tests still pass:

```bash
python scripts/test/test-all-templates.py --include-list "{template_file}" --minimal-spoilers
```

## Steps

1. **Review the current exporter** - Understand what custom logic exists
2. **Compare to ALTTP exporter** - Identify patterns that could be applied
3. **Identify commonly useful code** - Look for logic that could benefit other games
4. **Factor out to base exporter** - Move generic handlers to `exporter/games/base.py`
5. **Enable auto-discovery flags** - Replace manual WORLD_ATTRIBUTES with auto-discovery
6. **Remove redundant methods** - Delete methods that just delegate to super()
7. **Remove game-specific overrides** - Check if replace_name/handle_special_function_call are still needed
8. **Clean up imports** - Remove imports for removed code
9. **Test after each change** - Verify tests still pass

## Important Notes

- Make incremental changes and test after each one
- Some games genuinely need custom logic - don't remove code that's actually required
- The goal is simplification, not breaking functionality
- Document any game-specific quirks that must remain
- When factoring out code to the base exporter, ensure it's generic enough to work for all games
"""


def generate_new_rule_types_prompt(game_name):
    """Generate a prompt for investigating new rule types needed by a game's helpers.

    This prompt refers to CC/implementing-new-rule-types.md for games that have
    JavaScript helpers requiring new rule type support.
    """
    return f"""First, please read CC/cloud-setup.md and complete the environment setup if you haven't already.

Then, please read CC/implementing-new-rule-types.md

Then please investigate what needs to be done next to continue adding support for the rule types required by the helper functions in {game_name}.
"""


def load_worldgen_test_results(project_root, test_mode='canonical'):
    """Load the world generator test results JSON file.

    Args:
        project_root: Path to the project root
        test_mode: 'canonical' or 'random'

    Returns:
        Dict with 'metadata' and 'results' keys, or empty dict if not found
    """
    results_file = Path(project_root) / 'scripts' / 'output' / 'world-generator' / f'test-results-{test_mode}.json'
    if not results_file.exists():
        return {}

    try:
        with open(results_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading worldgen test results: {e}", file=sys.stderr)
        return {}


def get_worldgen_world_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 1: World Generation.

    World generation failures occur when the world generator fails to create
    the _worldgen Python world files from rules.json.

    Returns list of dicts with game_name, template, error, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        world_gen = test_world.get('world_generation', {})

        # Check if world generation itself failed
        if not world_gen.get('success', True):
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'error': world_gen.get('error', 'Unknown error'),
                'world_dir': world_gen.get('world_dir'),
            })

    return failures


def get_worldgen_seed_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 2: Seed Generation.

    Seed generation failures occur when the _worldgen world files were created
    successfully, but running Generate.py with them fails.

    Returns list of dicts with game_name, template, error, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        seed_gen = test_world.get('seed_generation', {})

        # Check if world generation succeeded but seed generation failed
        world_gen_success = test_world.get('world_generation', {}).get('success', False)
        seed_gen_success = seed_gen.get('success', False)

        if world_gen_success and not seed_gen_success:
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'error': seed_gen.get('error', 'Unknown error'),
                'test_template_name': test_world.get('test_template_name'),
                'world_dir': test_world.get('world_dir'),
            })

    return failures


def get_worldgen_spoiler_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 3: Spoiler Test.

    Spoiler test failures occur when the _worldgen world generates a seed
    successfully, but the spoiler test fails against its own rules.

    Returns list of dicts with game_name, template, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        seed_gen = test_world.get('seed_generation', {})
        spoiler_test = test_world.get('spoiler_test', {})

        # Check if seed generation succeeded but spoiler test failed
        seed_gen_success = seed_gen.get('success', False)
        spoiler_pass = spoiler_test.get('pass_fail') == 'pass'

        if seed_gen_success and not spoiler_pass:
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'test_template_name': test_world.get('test_template_name'),
                'world_dir': test_world.get('world_dir'),
                'spoiler_error': spoiler_test.get('error'),
            })

    return failures


def get_worldgen_crossval_failures(project_root, test_mode='canonical'):
    """Get list of games that failed at Stage 4: Cross-Validation.

    Cross-validation failures occur when the _worldgen world passes its own
    spoiler test, but fails when validated against the original world's sphere log.
    This indicates the worldgen world has different accessibility logic than the original.

    Returns list of dicts with game_name, template, and other details.
    """
    data = load_worldgen_test_results(project_root, test_mode)
    results = data.get('results', {})
    failures = []

    for game_name, result in results.items():
        test_world = result.get('test_world', {})
        seed_gen = test_world.get('seed_generation', {})
        spoiler_test = test_world.get('spoiler_test', {})
        cross_validation = test_world.get('cross_validation', {})

        # Check if seed generation and spoiler test succeeded but cross-validation failed
        seed_gen_success = seed_gen.get('success', False)
        spoiler_pass = spoiler_test.get('pass_fail') == 'pass'
        crossval_fail = cross_validation.get('pass_fail') == 'fail'

        if seed_gen_success and spoiler_pass and crossval_fail:
            failures.append({
                'game_name': game_name,
                'template': result.get('template', f'{game_name}.yaml'),
                'test_template_name': test_world.get('test_template_name'),
                'world_dir': test_world.get('world_dir'),
                'crossval_error': cross_validation.get('error'),
            })

    return failures


def categorize_world_generation_error(error_msg):
    """Categorize a Stage 1 (world generation) error message.

    These are errors that occur when creating the _worldgen Python files,
    not when running Generate.py with them.

    Returns a tuple of (category, details).
    """
    if not error_msg:
        return ('unknown', None)

    import re

    # Check for comparison operator type errors (common issue)
    if "not supported between instances of" in error_msg:
        match = re.search(r"'([^']+)' not supported between instances of '([^']+)' and '([^']+)'", error_msg)
        if match:
            return ('comparison_type_error', {
                'operator': match.group(1),
                'left_type': match.group(2),
                'right_type': match.group(3)
            })
        return ('comparison_type_error', {'message': error_msg})

    if 'KeyError' in error_msg:
        match = re.search(r"KeyError: (.+)", error_msg)
        key = match.group(1) if match else None
        return ('key_error', {'key': key})

    if 'TypeError' in error_msg:
        return ('type_error', {'message': error_msg})

    if 'SyntaxError' in error_msg:
        return ('syntax_error', {'message': error_msg})

    if 'AttributeError' in error_msg:
        return ('attribute_error', {'message': error_msg})

    return ('other', {'message': error_msg})


def categorize_seed_generation_error(error_msg):
    """Categorize a Stage 2 (seed generation) error message.

    These are errors that occur when running Generate.py with the _worldgen world,
    after the world files have been created successfully.

    Returns a tuple of (category, details).
    """
    if not error_msg:
        return ('unknown', None)

    import re

    if 'NameError' in error_msg:
        # Extract the undefined name
        match = re.search(r"name '([^']+)' is not defined", error_msg)
        undefined_name = match.group(1) if match else None
        return ('name_error', {'undefined_name': undefined_name})

    if 'FillError' in error_msg:
        return ('fill_error', None)

    if 'KeyError' in error_msg:
        match = re.search(r"KeyError: (.+)", error_msg)
        key = match.group(1) if match else None
        return ('key_error', {'key': key})

    if 'TypeError' in error_msg:
        return ('type_error', {'message': error_msg})

    if 'AttributeError' in error_msg:
        return ('attribute_error', {'message': error_msg})

    return ('other', {'message': error_msg})


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


def generate_gen_errors_prompt(template_file, game_name, gen_error_count, seed=1, use_cloud_docs=False):
    """Generate a prompt for investigating generation errors in a game that passes spoiler tests.

    This is for games where the spoiler test passes but generation produced errors,
    which may indicate issues with rule export or world generation.
    """
    setup_doc = "CC/cloud-setup.md"

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

The game we are investigating is **{game_name}** (template: `{template_file}`).

## Issue

This game **passes** the spoiler test but has **{gen_error_count} generation error(s)**. This discrepancy suggests there may be issues with:
- Rule export that produces errors but doesn't prevent test completion
- World generation warnings being logged as errors
- Non-critical errors that don't affect gameplay logic

## Test Commands

To reproduce and investigate:

```bash
source .venv/bin/activate

# Run generation and watch for errors
python Generate.py --weights_file_path "Templates/{template_file}" --multi 1 --seed {seed}

# Run the spoiler test to confirm it passes
npm test -- --mode=test-spoilers --game={game_name.lower().replace(' ', '')} --seed={seed}
```

## Investigation Steps

1. **Run generation and capture output**
   - Look for ERROR lines in the generation output
   - Note what types of errors are occurring

2. **Check the generated rules file**
   - Location: `frontend/presets/<game>/AP_14089154938208861744/AP_14089154938208861744_rules.json`
   - Look for any anomalies or missing data

3. **Review the exporter code** (if custom exporter exists)
   - Check `exporter/games/<game>.py` for error handling
   - Look for places where errors might be logged but not raised

4. **Determine if errors are critical**
   - If errors don't affect gameplay, consider suppressing or downgrading to warnings
   - If errors indicate real issues, fix the underlying cause

## Goal

Either:
- Fix the generation errors so they no longer occur, OR
- Determine the errors are non-critical and adjust logging level appropriately
"""


def generate_basic_spoiler_debug_prompt(template_file, game_name, seed=1, use_cloud_docs=False, custom_code_info=None):
    """Generate a debugging prompt for games without JavaScript helpers.

    This prompt refers to CC/basic-spoiler-debugging.md for games that don't have
    JavaScript helpers. This includes both basic games (no custom code) and
    exporter-only games (has custom exporter but no JS helpers).
    """
    doc_path = "CC/basic-spoiler-debugging.md"
    setup_doc = "CC/cloud-setup.md"

    # Determine if this game has a custom exporter
    has_exporter = custom_code_info and custom_code_info.get('has_exporter', False)
    exporter_path = custom_code_info.get('exporter_path') if custom_code_info else None

    # Build the game description based on whether it has a custom exporter
    if has_exporter:
        game_description = f"""This game has a custom exporter (`{exporter_path}`) but no JavaScript helpers.

If helper functions are missing or not being exported correctly, check the exporter configuration."""
    else:
        game_description = """This game uses only the generic export infrastructure - it has no custom exporter (`exporter/games/<game>.py`) and no JavaScript helpers (`frontend/modules/shared/gameLogic/<game>/`)."""

    # Build the debugging focus message
    if has_exporter:
        debug_focus = f"""Focus on:
- Whether the exporter (`{exporter_path}`) is correctly configured
- Whether helpers need to be added to `HELPERS_TO_EXPORT_WHITELIST`
- Whether the generic infrastructure is handling this game's rules correctly"""
    else:
        debug_focus = """Since this is a basic game, focus on whether the generic infrastructure is handling this game's rules correctly."""

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read
{doc_path}

The game we are debugging is **{game_name}** (template: `{template_file}`).

{game_description}

## Test Command

To run the spoiler test for this game:

```bash
source .venv/bin/activate
python scripts/test/test-all-templates.py --include-list "{template_file}" --minimal-spoilers
```

Or to run generation and testing separately:

```bash
python Generate.py --weights_file_path "Templates/{template_file}" --multi 1 --seed {seed}
npm test -- --mode=test-spoilers --game=<gamename> --seed={seed}
```

## Debugging Steps

1. Run the test and analyze the failure
2. Follow the debugging workflow in {doc_path}
3. Identify whether the issue is in:
   - Rule export (`exporter/analyzer.py`)
   - Rule evaluation (`frontend/modules/shared/ruleEngine.js`)
   - Missing helper that needs to be exported or implemented

{debug_focus}
"""


def generate_multiworld_prompt(template_file, game_name, bisection_info, failure_details, seed=1):
    """Generate a debugging prompt for a failing multiworld test.

    Focuses on specific failing pairs from bisection results when available.
    Also reports intermittent failures if any were detected.
    """
    prompt_parts = []

    prompt_parts.append("""First, please read CC/cloud-setup.md and complete the environment setup if you haven't already.

Then, please read
CC/game-debugging-multiworld-CC.md
""")

    prompt_parts.append(f"The game we are debugging is **{game_name}** (template: `{template_file}`).\n")

    # Check for intermittent failures
    intermittent_failures = failure_details.get('intermittent_failures', []) if failure_details else []
    if intermittent_failures:
        prompt_parts.append(f"\n## Intermittent Failures Detected\n")
        prompt_parts.append(f"This test had **{len(intermittent_failures)} intermittent failure(s)** - tests that failed initially but passed on retry:\n\n")
        for failure in intermittent_failures:
            player_num = failure.get('player_number', '?')
            attempt = failure.get('attempt', '?')
            sphere_reached = failure.get('sphere_reached', '?')
            total_spheres = failure.get('total_spheres', '?')
            prompt_parts.append(f"- Player {player_num}: Failed on attempt {attempt} at sphere {sphere_reached}/{total_spheres}, then passed on retry\n")
        prompt_parts.append("\nIntermittent failures suggest timing issues, race conditions, or non-deterministic behavior in the rule evaluation.\n")

    # Check if we have bisection results with failing pairs
    if bisection_info['has_bisection'] and bisection_info['failing_pairs']:
        failing_pairs = bisection_info['failing_pairs']
        prompt_parts.append(f"\n## Bisection Results\n")
        prompt_parts.append(f"Bisection testing found {len(failing_pairs)} specific template pair(s) that cause failures:\n")

        for partner in failing_pairs:
            prompt_parts.append(f"- `{template_file}` + `{partner}`\n")

        # Focus on the first failing pair for debugging
        first_failing_partner = failing_pairs[0]
        prompt_parts.append(f"\n## Recommended Debugging Focus\n")
        prompt_parts.append(f"Start by debugging the pair: **{template_file}** + **{first_failing_partner}**\n")

        # Find details for this specific pair
        failing_player_num = None
        failing_template = None
        sphere_reached = 0
        total_spheres = 0
        for pair in bisection_info['tested_pairs']:
            if pair.get('partner_template') == first_failing_partner:
                player_results = pair.get('player_results', {})
                for player_key, player_result in player_results.items():
                    if not player_result.get('passed', True):
                        failing_player_num = player_result.get('player_number')
                        failing_template = player_result.get('template')
                        sphere_reached = player_result.get('sphere_reached', 0)
                        total_spheres = player_result.get('total_spheres', 0)
                        prompt_parts.append(f"\n**Player {failing_player_num}** (`{failing_template}`) failed at sphere {sphere_reached}/{total_spheres}\n")
                break

        # Determine player order (alphabetical)
        sorted_templates = sorted([template_file, first_failing_partner])
        player1_template = sorted_templates[0]
        player2_template = sorted_templates[1]

        prompt_parts.append(f"""
Since {len(failing_pairs)} different partner games cause failures with {game_name}, the issue is likely in the **{game_name}** game logic itself, not in the partner games.

## Setup Commands

To set up this specific failing pair for debugging:

```bash
# Clear multiworld directory
rm -f Players/presets/Multiworld/*.yaml

# Copy the failing pair
cp "Players/Templates/{template_file}" Players/presets/Multiworld/
cp "Players/Templates/{first_failing_partner}" Players/presets/Multiworld/

# Generate multiworld data
python Generate.py --player_files_path Players/presets/Multiworld --seed {seed}
```

After generation, the files will be in `frontend/presets/multiworld/AP_14089154938208861744/` (for seed 1).

In multiworld mode, templates are assigned to players alphabetically:
- Player 1: `{player1_template}`
- Player 2: `{player2_template}`

## Debugging Steps

1. **Run the spoiler test for the failing player** to see where it stops:
```bash
npm test --mode=test-spoilers --game=multiworld --seed={seed} --player={failing_player_num if failing_player_num else 2}
npm run test:analyze
cat playwright-analysis.txt
```

2. **Examine the sphere log** to understand progression:
```bash
# View the sphere log for the failing player
cat frontend/presets/multiworld/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl | grep '"player": {failing_player_num if failing_player_num else 2}' | head -20
```

3. **Check the rules file** for the failing player's game:
```bash
# View player-specific rules
cat frontend/presets/multiworld/AP_14089154938208861744/AP_14089154938208861744_rules.json | python -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d['players']['{failing_player_num if failing_player_num else 2}'], indent=2))" | head -100
```

4. **Compare with single-player behavior**: The issue may be related to how items from other players are handled, or how the game logic processes "foreign" items.
""")

    elif bisection_info['has_bisection'] and not bisection_info['failing_pairs']:
        # Bisection ran but found no failing pairs
        prompt_parts.append(f"\n## Bisection Results\n")
        prompt_parts.append("Bisection testing was triggered but found NO specific failing pairs.\n")
        if intermittent_failures:
            prompt_parts.append("This is consistent with the intermittent failures detected above - the failure is not consistently reproducible with any specific pair.\n")
        else:
            prompt_parts.append("Since the default test uses 2 retries, intermittent failures are usually caught. This likely indicates an issue that only occurs with more than 2 templates in the multiworld.\n")

        prompt_parts.append(f"""
## Test Command

To re-run the multiworld test:

```bash
python scripts/test/test-all-templates.py --multiworld --multiworld-bisect-failures --include-list "{template_file}"
```
""")

    else:
        # No bisection results - just provide general debugging info
        if failure_details:
            prompt_parts.append(f"\n## Failure Details\n")

            if not failure_details['generation_success']:
                prompt_parts.append("Generation failed for this multiworld.\n")
            else:
                player_results = failure_details.get('player_results', {})
                for player_key, player_result in player_results.items():
                    if not player_result.get('passed', True):
                        prompt_parts.append(f"Player {player_result.get('player_number')} failed:")
                        prompt_parts.append(f"  - Sphere reached: {player_result.get('sphere_reached', 0)}/{player_result.get('total_spheres', 0)}\n")

            templates_in_multiworld = failure_details.get('templates_in_multiworld', {})
            if templates_in_multiworld:
                prompt_parts.append("\nTemplates in multiworld:\n")
                for player_key, tmpl in sorted(templates_in_multiworld.items()):
                    prompt_parts.append(f"  - {player_key}: {tmpl}\n")

        prompt_parts.append(f"""
## Test Command

To run the multiworld test with bisection (to find specific failing pairs):

```bash
python scripts/test/test-all-templates.py --multiworld --multiworld-bisect-failures --include-list "{template_file}"
```
""")

    return ''.join(prompt_parts)


def main():
    parser = argparse.ArgumentParser(description='Run prompt.py for all failing template tests')
    parser.add_argument('--start-from', help='Template file to start from')
    parser.add_argument('--template-dir', default='Players/Templates',
                       help='Directory containing template files (default: Players/Templates)')
    parser.add_argument('-t', '--text', action='store_true',
                       help='Use --text option when calling prompt.py (outputs command instead of running it)')
    parser.add_argument('-p', '--prompt', action='store_true',
                       help='Use --prompt option when calling prompt.py (outputs just the prompt contents)')
    parser.add_argument('--loud', action='store_true',
                       help='Enable verbose output even when -t or -p is set (for testing)')
    parser.add_argument('--max-files', type=int,
                       help='Stop after processing this many files')
    parser.add_argument('--skip-list',
                       type=str,
                       nargs='*',
                       default=None,
                       help='List of template files to skip (default: auto-detected based on mode)')
    parser.add_argument('-s', '--seed', type=int, default=1,
                       help='Seed number to use for generation (default: 1)')
    parser.add_argument('--max-loops', type=int, default=1,
                       help='Maximum number of complete cycles through all templates (default: 1)')
    parser.add_argument('--promptfile', action='store_true',
                       help='Write all prompts to prompts.txt instead of running them')
    parser.add_argument('--CC', action='store_true',
                       help='Use cloud-specific documentation when generating prompts')
    parser.add_argument('--full-spoilers', action='store_true',
                       help='Pass --full-spoilers to prompt.py to include full spoilers mode instructions')
    parser.add_argument('--minimal-spoilers', action='store_true',
                       help='Read test results from scripts/output/spoiler-minimal/test-results.json')
    parser.add_argument('--multiclient', action='store_true',
                       help='Check multiclient test results and generate prompts for failing multiclient tests')
    parser.add_argument('--multiworld', action='store_true',
                       help='Check multiworld test results and generate prompts for failing multiworld tests (uses bisection results)')
    parser.add_argument('--basic-spoiler-debug', action='store_true',
                       help='Generate prompts for games without JavaScript helpers failing minimal spoiler tests')
    parser.add_argument('--helper-export', action='store_true',
                       help='Generate prompts for games with custom exporter/helpers to convert them to use helper export')
    parser.add_argument('--exporter-simplify', action='store_true',
                       help='Generate prompts for simplifying custom exporters by leveraging base class features')
    parser.add_argument('--new-rule-types', action='store_true',
                       help='Generate prompts for games with JavaScript helpers to investigate implementing new rule types')
    parser.add_argument('--gen-errors', action='store_true',
                       help='Generate prompts for games that pass spoiler tests but have generation errors')
    parser.add_argument('--worldgen-world-failures', action='store_true',
                       help='Generate prompts for WorldGen Stage 1 failures (world generator fails to create _worldgen files)')
    parser.add_argument('--worldgen-seed-failures', action='store_true',
                       help='Generate prompts for WorldGen Stage 2 failures (seed generation fails with _worldgen world)')
    parser.add_argument('--worldgen-spoiler-failures', action='store_true',
                       help='Generate prompts for WorldGen Stage 3 failures (spoiler test fails)')
    parser.add_argument('--worldgen-crossval-failures', action='store_true',
                       help='Generate prompts for WorldGen Stage 4 failures (cross-validation fails)')
    parser.add_argument('--worldgen-test-mode', type=str, choices=['canonical', 'random'], default='canonical',
                       help='Which world generator test results to use (default: canonical)')
    parser.add_argument('--all-promptfiles', action='store_true',
                       help='Run all prompt-generating modes and output to separate files in CC/scripts/prompts/')
    parser.add_argument('--exclude-pattern', type=str,
                       help='Exclude template files matching this pattern (e.g., "WorldGen" to exclude WorldGen templates)')
    parser.add_argument('--include-pattern', type=str,
                       help='Only include template files matching this pattern (e.g., "WorldGen" to only test WorldGen templates)')
    parser.add_argument('--include-worldgen', action='store_true',
                       help='Include WorldGen templates (they are excluded by default)')
    parser.add_argument('--only-worldgen', action='store_true',
                       help='Only include WorldGen templates (shorthand for --include-pattern "WorldGen")')

    args = parser.parse_args()

    # Validate mutually exclusive options
    if args.full_spoilers and args.minimal_spoilers:
        print("Error: --full-spoilers and --minimal-spoilers are mutually exclusive")
        sys.exit(1)

    if args.multiclient and (args.full_spoilers or args.minimal_spoilers):
        print("Error: --multiclient cannot be combined with --full-spoilers or --minimal-spoilers")
        sys.exit(1)

    if args.multiworld and (args.full_spoilers or args.minimal_spoilers):
        print("Error: --multiworld cannot be combined with --full-spoilers or --minimal-spoilers")
        sys.exit(1)

    if args.multiworld and args.multiclient:
        print("Error: --multiworld and --multiclient are mutually exclusive")
        sys.exit(1)

    if args.basic_spoiler_debug and (args.multiclient or args.multiworld):
        print("Error: --basic-spoiler-debug cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if args.basic_spoiler_debug and args.full_spoilers:
        print("Error: --basic-spoiler-debug uses minimal spoilers by default, cannot combine with --full-spoilers")
        sys.exit(1)

    if args.helper_export and (args.multiclient or args.multiworld):
        print("Error: --helper-export cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if args.helper_export and args.basic_spoiler_debug:
        print("Error: --helper-export and --basic-spoiler-debug are mutually exclusive")
        sys.exit(1)

    if args.exporter_simplify and (args.multiclient or args.multiworld):
        print("Error: --exporter-simplify cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if args.exporter_simplify and args.basic_spoiler_debug:
        print("Error: --exporter-simplify and --basic-spoiler-debug are mutually exclusive")
        sys.exit(1)

    if args.exporter_simplify and args.helper_export:
        print("Error: --exporter-simplify and --helper-export are mutually exclusive")
        sys.exit(1)

    if args.new_rule_types and (args.multiclient or args.multiworld):
        print("Error: --new-rule-types cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if args.new_rule_types and args.basic_spoiler_debug:
        print("Error: --new-rule-types and --basic-spoiler-debug are mutually exclusive")
        sys.exit(1)

    if args.new_rule_types and args.helper_export:
        print("Error: --new-rule-types and --helper-export are mutually exclusive")
        sys.exit(1)

    if args.new_rule_types and args.exporter_simplify:
        print("Error: --new-rule-types and --exporter-simplify are mutually exclusive")
        sys.exit(1)

    if args.gen_errors and (args.multiclient or args.multiworld):
        print("Error: --gen-errors cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if args.gen_errors and args.basic_spoiler_debug:
        print("Error: --gen-errors and --basic-spoiler-debug are mutually exclusive")
        sys.exit(1)

    if args.gen_errors and args.helper_export:
        print("Error: --gen-errors and --helper-export are mutually exclusive")
        sys.exit(1)

    if args.gen_errors and args.new_rule_types:
        print("Error: --gen-errors and --new-rule-types are mutually exclusive")
        sys.exit(1)

    if args.gen_errors and args.exporter_simplify:
        print("Error: --gen-errors and --exporter-simplify are mutually exclusive")
        sys.exit(1)

    worldgen_modes = [args.worldgen_world_failures, args.worldgen_seed_failures, args.worldgen_spoiler_failures, args.worldgen_crossval_failures]
    if sum(worldgen_modes) > 1:
        print("Error: --worldgen-world-failures, --worldgen-seed-failures, --worldgen-spoiler-failures, and --worldgen-crossval-failures are mutually exclusive")
        sys.exit(1)

    if any(worldgen_modes) and (args.multiclient or args.multiworld):
        print("Error: --worldgen-* modes cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if any(worldgen_modes) and (args.basic_spoiler_debug or args.helper_export or args.exporter_simplify or args.new_rule_types or args.gen_errors):
        print("Error: --worldgen-* modes cannot be combined with other debugging modes")
        sys.exit(1)

    if args.include_pattern and args.exclude_pattern:
        print("Error: --include-pattern and --exclude-pattern are mutually exclusive")
        sys.exit(1)

    if args.include_worldgen and args.only_worldgen:
        print("Error: --include-worldgen and --only-worldgen are mutually exclusive")
        sys.exit(1)

    if args.include_worldgen and args.exclude_pattern:
        print("Error: --include-worldgen and --exclude-pattern are mutually exclusive")
        sys.exit(1)

    if args.only_worldgen and args.exclude_pattern:
        print("Error: --only-worldgen and --exclude-pattern are mutually exclusive")
        sys.exit(1)

    # Apply WorldGen filtering (exclude by default unless --include-worldgen or --only-worldgen)
    if args.only_worldgen:
        args.include_pattern = "WorldGen"
    elif not args.include_worldgen and not args.include_pattern:
        # Exclude WorldGen by default (unless an include pattern is specified)
        if not args.exclude_pattern:
            args.exclude_pattern = "WorldGen"

    # Determine project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

    # Load appropriate exclude list based on mode if not explicitly provided
    if args.skip_list is None:
        # Determine the appropriate test_type based on mode
        if args.worldgen_world_failures or args.worldgen_seed_failures or args.worldgen_spoiler_failures or args.worldgen_crossval_failures or args.only_worldgen or args.include_pattern == "WorldGen":
            exclude_test_type = 'worldgen'
        else:
            # For spoiler/multiclient/multiworld tests, use 'main' (permanent + main test exclusions)
            exclude_test_type = 'main'
        args.skip_list = load_template_exclude_list(project_root, test_type=exclude_test_type)

    # Handle --all-promptfiles mode: run all prompt-generating modes with separate output files
    if args.all_promptfiles:
        return run_all_promptfiles(project_root)

    # Load world mapping (needed for filtering by custom code status)
    # Used by: --basic-spoiler-debug, --helper-export, normal mode, and worldgen modes
    world_mapping = load_world_mapping(project_root)

    # Load prompt exclusion lists (for filtering specific prompt types)
    prompt_exclusions = load_prompt_exclusion_lists(project_root)

    # Handle worldgen modes - these iterate through failures, not templates
    if args.worldgen_world_failures or args.worldgen_seed_failures or args.worldgen_spoiler_failures or args.worldgen_crossval_failures:
        quiet_mode = (args.text or args.prompt or args.promptfile) and not args.loud
        collected_prompts = [] if args.promptfile else None

        if args.worldgen_world_failures:
            failures = get_worldgen_world_failures(project_root, args.worldgen_test_mode)
            if not quiet_mode:
                print(f"Found {len(failures)} WorldGen Stage 1 (World Generation) failures ({args.worldgen_test_mode} mode)")

            for i, failure in enumerate(sorted(failures, key=lambda x: x['game_name'])):
                game_name = failure['game_name']
                template_file = failure['template']
                error_msg = failure['error']

                if not quiet_mode:
                    print(f"\n{'='*60}")
                    print(f"[{i+1}/{len(failures)}] {game_name}")
                    print(f"Error: {error_msg[:80]}...")
                    print('='*60)

                prompt = generate_worldgen_world_failure_prompt(
                    game_name, template_file, error_msg, world_mapping, args.seed
                )

                if args.promptfile:
                    collected_prompts.append(prompt)
                else:
                    print(prompt)
                    if args.text or args.prompt:
                        return 0

                if args.max_files and (i + 1) >= args.max_files:
                    if not quiet_mode:
                        print(f"\n Reached maximum file limit ({args.max_files}), stopping...")
                    break

        elif args.worldgen_seed_failures:
            failures = get_worldgen_seed_failures(project_root, args.worldgen_test_mode)
            if not quiet_mode:
                print(f"Found {len(failures)} WorldGen Stage 2 (Seed Generation) failures ({args.worldgen_test_mode} mode)")

            for i, failure in enumerate(sorted(failures, key=lambda x: x['game_name'])):
                game_name = failure['game_name']
                template_file = failure['template']
                error_msg = failure['error']

                if not quiet_mode:
                    print(f"\n{'='*60}")
                    print(f"[{i+1}/{len(failures)}] {game_name}")
                    print(f"Error: {error_msg[:80]}...")
                    print('='*60)

                prompt = generate_worldgen_seed_failure_prompt(
                    game_name, template_file, error_msg, world_mapping, args.seed
                )

                if args.promptfile:
                    collected_prompts.append(prompt)
                else:
                    print(prompt)
                    if args.text or args.prompt:
                        return 0

                if args.max_files and (i + 1) >= args.max_files:
                    if not quiet_mode:
                        print(f"\n Reached maximum file limit ({args.max_files}), stopping...")
                    break

        elif args.worldgen_spoiler_failures:
            failures = get_worldgen_spoiler_failures(project_root, args.worldgen_test_mode)
            if not quiet_mode:
                print(f"Found {len(failures)} WorldGen Stage 3 (Spoiler Test) failures ({args.worldgen_test_mode} mode)")

            for i, failure in enumerate(sorted(failures, key=lambda x: x['game_name'])):
                game_name = failure['game_name']
                template_file = failure['template']

                if not quiet_mode:
                    print(f"\n{'='*60}")
                    print(f"[{i+1}/{len(failures)}] {game_name}")
                    print('='*60)

                prompt = generate_worldgen_spoiler_failure_prompt(
                    game_name, template_file, world_mapping, args.seed
                )

                if args.promptfile:
                    collected_prompts.append(prompt)
                else:
                    print(prompt)
                    if args.text or args.prompt:
                        return 0

                if args.max_files and (i + 1) >= args.max_files:
                    if not quiet_mode:
                        print(f"\n Reached maximum file limit ({args.max_files}), stopping...")
                    break

        elif args.worldgen_crossval_failures:
            failures = get_worldgen_crossval_failures(project_root, args.worldgen_test_mode)
            if not quiet_mode:
                print(f"Found {len(failures)} WorldGen Stage 4 (Cross-Validation) failures ({args.worldgen_test_mode} mode)")

            for i, failure in enumerate(sorted(failures, key=lambda x: x['game_name'])):
                game_name = failure['game_name']
                template_file = failure['template']

                if not quiet_mode:
                    print(f"\n{'='*60}")
                    print(f"[{i+1}/{len(failures)}] {game_name}")
                    print('='*60)

                prompt = generate_worldgen_crossval_failure_prompt(
                    game_name, template_file, world_mapping, args.seed
                )

                if args.promptfile:
                    collected_prompts.append(prompt)
                else:
                    print(prompt)
                    if args.text or args.prompt:
                        return 0

                if args.max_files and (i + 1) >= args.max_files:
                    if not quiet_mode:
                        print(f"\n Reached maximum file limit ({args.max_files}), stopping...")
                    break

        # Write collected prompts to file if in --promptfile mode
        if args.promptfile and collected_prompts:
            output_file = Path(project_root) / 'CC' / 'scripts' / 'prompts.txt'
            with open(output_file, 'w') as f:
                for i, prompt in enumerate(collected_prompts):
                    f.write(prompt)
                    if i < len(collected_prompts) - 1:
                        f.write("\n\n\n\n\n")
                        f.write("=" * 80)
                        f.write("\n\n\n\n\n")
            print(f"Created {output_file} with {len(collected_prompts)} prompts")

        return 0
    if not world_mapping:
        print("Warning: Could not load world mapping, will not filter by custom code status", file=sys.stderr)

    # Determine if we're in quiet mode (just outputting prompt or command text)
    # --loud flag overrides quiet mode for testing
    quiet_mode = (args.text or args.prompt or args.promptfile) and not args.loud

    # Initialize prompts collection for --promptfile mode
    collected_prompts = [] if args.promptfile else None

    # Get all template files
    template_files = get_template_files(args.template_dir, args.skip_list)
    if not template_files:
        if not quiet_mode:
            print("No template files found!", file=sys.stderr)
        return 1

    # Apply --include-pattern filtering if specified
    if args.include_pattern:
        before_pattern_filter = len(template_files)
        template_files = [f for f in template_files if args.include_pattern in f]
        pattern_excluded = before_pattern_filter - len(template_files)
        if pattern_excluded > 0 and not quiet_mode:
            print(f"Pattern filter: included {len(template_files)} templates matching '{args.include_pattern}' (excluded {pattern_excluded})")
        if not template_files:
            print(f"Error: No template files found after pattern filtering (no files match '{args.include_pattern}')")
            return 1

    # Apply --exclude-pattern filtering if specified
    if args.exclude_pattern:
        before_pattern_filter = len(template_files)
        template_files = [f for f in template_files if args.exclude_pattern not in f]
        pattern_excluded = before_pattern_filter - len(template_files)
        if pattern_excluded > 0 and not quiet_mode:
            print(f"Pattern filter: excluded {pattern_excluded} templates matching '{args.exclude_pattern}' ({len(template_files)} remaining)")
        if not template_files:
            print(f"Error: No template files found after pattern filtering (all files match '{args.exclude_pattern}')")
            return 1

    if not quiet_mode:
        print(f"Found {len(template_files)} template files")
        if args.skip_list:
            print(f"Skipping: {', '.join(args.skip_list)}")

    # Find starting index
    start_index = 0
    if args.start_from:
        try:
            start_index = template_files.index(args.start_from)
            if not quiet_mode:
                print(f"Starting from: {args.start_from}")
        except ValueError:
            if not quiet_mode:
                print(f"Warning: Template file '{args.start_from}' not found, starting from beginning")
    
    # Process templates in a loop (restart from beginning when reaching end)
    current_index = start_index
    processed_count = 0
    files_processed = 0
    
    while True:
        template_file = template_files[current_index]
        template_path = Path(args.template_dir) / template_file

        if not quiet_mode:
            print(f"\n{'='*60}")
            print(f"Processing: {template_file} ({current_index + 1}/{len(template_files)})")
            print(f"{'='*60}")

        # For --helper-export mode, we don't check test results - we look for games with custom code
        if args.helper_export:
            # Extract game name from template YAML
            game_name_from_yaml = extract_game_name_from_yaml(template_path)
            if not game_name_from_yaml:
                if not quiet_mode:
                    print(f"Could not extract game name from {template_file}, skipping...")
            else:
                if not quiet_mode:
                    print(f"Game name: {game_name_from_yaml}")

                # Skip games without JavaScript helpers
                if not has_javascript_helpers(game_name_from_yaml, world_mapping):
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - no JavaScript helpers")
                    current_index = (current_index + 1) % len(template_files)
                    processed_count += 1
                    if processed_count % len(template_files) == 0:
                        cycle_num = processed_count // len(template_files)
                        if cycle_num >= args.max_loops:
                            break
                    continue

                # Skip games that require JavaScript helpers (cannot be removed)
                if template_file in prompt_exclusions['requires_javascript_helpers']:
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - requires JavaScript helpers")
                    current_index = (current_index + 1) % len(template_files)
                    processed_count += 1
                    if processed_count % len(template_files) == 0:
                        cycle_num = processed_count // len(template_files)
                        if cycle_num >= args.max_loops:
                            break
                    continue

                custom_code_info = get_custom_code_info(game_name_from_yaml, world_mapping)

                # Handle --promptfile mode
                if args.promptfile:
                    helper_prompt = generate_helper_export_prompt(
                        template_file, game_name_from_yaml, custom_code_info, args.seed, args.CC
                    )
                    collected_prompts.append(helper_prompt)
                else:
                    # Output the prompt directly
                    helper_prompt = generate_helper_export_prompt(
                        template_file, game_name_from_yaml, custom_code_info, args.seed, args.CC
                    )
                    print(helper_prompt)

                    # Exit immediately if -t or -p was specified
                    if args.text or args.prompt:
                        return 0

                files_processed += 1

            # Check if we've reached the max files limit
            if args.max_files and files_processed >= args.max_files:
                if not quiet_mode:
                    print(f"\n✅ Reached maximum file limit ({args.max_files}), stopping...")
                break

            # Move to next template
            current_index = (current_index + 1) % len(template_files)
            processed_count += 1

            # If we've completed a full cycle, show progress
            if processed_count % len(template_files) == 0:
                cycle_num = processed_count // len(template_files)
                print(f"\n🔄 Completed cycle {cycle_num}")

                # Check if we've reached the max loops limit
                if cycle_num >= args.max_loops:
                    print(f"✅ Reached maximum loop limit ({args.max_loops}), stopping...")
                    break

            continue  # Skip the normal test-based processing below

        # For --exporter-simplify mode, we look for games with custom exporters (but not JavaScript helpers)
        if args.exporter_simplify:
            # Extract game name from template YAML
            game_name_from_yaml = extract_game_name_from_yaml(template_path)
            if not game_name_from_yaml:
                if not quiet_mode:
                    print(f"Could not extract game name from {template_file}, skipping...")
            else:
                if not quiet_mode:
                    print(f"Game name: {game_name_from_yaml}")

                custom_code_info = get_custom_code_info(game_name_from_yaml, world_mapping)

                # Skip games without custom exporters
                if not custom_code_info['has_exporter']:
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - no custom exporter")
                    current_index = (current_index + 1) % len(template_files)
                    processed_count += 1
                    if processed_count % len(template_files) == 0:
                        cycle_num = processed_count // len(template_files)
                        if cycle_num >= args.max_loops:
                            break
                    continue

                # Skip games whose exporters are fully simplified
                if template_file in prompt_exclusions['exporter_fully_simplified']:
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - exporter is fully simplified")
                    current_index = (current_index + 1) % len(template_files)
                    processed_count += 1
                    if processed_count % len(template_files) == 0:
                        cycle_num = processed_count // len(template_files)
                        if cycle_num >= args.max_loops:
                            break
                    continue

                # Handle --promptfile mode
                if args.promptfile:
                    simplify_prompt = generate_exporter_simplify_prompt(
                        template_file, game_name_from_yaml, custom_code_info, args.seed, args.CC
                    )
                    collected_prompts.append(simplify_prompt)
                else:
                    # Output the prompt directly
                    simplify_prompt = generate_exporter_simplify_prompt(
                        template_file, game_name_from_yaml, custom_code_info, args.seed, args.CC
                    )
                    print(simplify_prompt)

                    # Exit immediately if -t or -p was specified
                    if args.text or args.prompt:
                        return 0

                files_processed += 1

            # Check if we've reached the max files limit
            if args.max_files and files_processed >= args.max_files:
                if not quiet_mode:
                    print(f"\n Reached maximum file limit ({args.max_files}), stopping...")
                break

            # Move to next template
            current_index = (current_index + 1) % len(template_files)
            processed_count += 1

            # If we've completed a full cycle, show progress
            if processed_count % len(template_files) == 0:
                cycle_num = processed_count // len(template_files)
                print(f"\n Completed cycle {cycle_num}")

                # Check if we've reached the max loops limit
                if cycle_num >= args.max_loops:
                    print(f" Reached maximum loop limit ({args.max_loops}), stopping...")
                    break

            continue  # Skip the normal test-based processing below

        # For --new-rule-types mode, we don't check test results - we look for games with JavaScript helpers
        if args.new_rule_types:
            # Extract game name from template YAML
            game_name_from_yaml = extract_game_name_from_yaml(template_path)
            if not game_name_from_yaml:
                if not quiet_mode:
                    print(f"Could not extract game name from {template_file}, skipping...")
            else:
                if not quiet_mode:
                    print(f"Game name: {game_name_from_yaml}")

                # Skip games without JavaScript helpers
                if not has_javascript_helpers(game_name_from_yaml, world_mapping):
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - no JavaScript helpers")
                    current_index = (current_index + 1) % len(template_files)
                    processed_count += 1
                    if processed_count % len(template_files) == 0:
                        cycle_num = processed_count // len(template_files)
                        if cycle_num >= args.max_loops:
                            break
                    continue

                # Skip games that require JavaScript helpers (cannot be removed)
                if template_file in prompt_exclusions['requires_javascript_helpers']:
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - requires JavaScript helpers")
                    current_index = (current_index + 1) % len(template_files)
                    processed_count += 1
                    if processed_count % len(template_files) == 0:
                        cycle_num = processed_count // len(template_files)
                        if cycle_num >= args.max_loops:
                            break
                    continue

                # Handle --promptfile mode
                if args.promptfile:
                    new_rule_types_prompt = generate_new_rule_types_prompt(game_name_from_yaml)
                    collected_prompts.append(new_rule_types_prompt)
                else:
                    # Output the prompt directly
                    new_rule_types_prompt = generate_new_rule_types_prompt(game_name_from_yaml)
                    print(new_rule_types_prompt)

                    # Exit immediately if -t or -p was specified
                    if args.text or args.prompt:
                        return 0

                files_processed += 1

            # Check if we've reached the max files limit
            if args.max_files and files_processed >= args.max_files:
                if not quiet_mode:
                    print(f"\n✅ Reached maximum file limit ({args.max_files}), stopping...")
                break

            # Move to next template
            current_index = (current_index + 1) % len(template_files)
            processed_count += 1

            # If we've completed a full cycle, show progress
            if processed_count % len(template_files) == 0:
                cycle_num = processed_count // len(template_files)
                print(f"\n🔄 Completed cycle {cycle_num}")

                # Check if we've reached the max loops limit
                if cycle_num >= args.max_loops:
                    print(f"✅ Reached maximum loop limit ({args.max_loops}), stopping...")
                    break

            continue  # Skip the normal test-based processing below

        # For --gen-errors mode, we look for games that pass but have generation errors
        if args.gen_errors:
            # Load test results (use minimal spoilers by default for gen-errors)
            use_minimal = args.minimal_spoilers or (not args.full_spoilers)
            test_results = load_test_results(project_root, args.full_spoilers, use_minimal, False, False)

            # Check if this template has generation errors but passes
            has_errors, error_count = has_generation_errors_but_passes(template_file, test_results)

            if not has_errors:
                if not quiet_mode:
                    print(f"✅ {template_file} has no generation errors (or test doesn't pass), skipping...")
                current_index = (current_index + 1) % len(template_files)
                processed_count += 1
                if processed_count % len(template_files) == 0:
                    cycle_num = processed_count // len(template_files)
                    if cycle_num >= args.max_loops:
                        break
                continue

            if not quiet_mode:
                print(f"⚠️ {template_file} passes but has {error_count} generation error(s), processing...")

            # Extract game name from template YAML
            game_name_from_yaml = extract_game_name_from_yaml(template_path)
            if not game_name_from_yaml:
                if not quiet_mode:
                    print(f"Could not extract game name from {template_file}, skipping...")
            else:
                if not quiet_mode:
                    print(f"Game name: {game_name_from_yaml}")

                # Handle --promptfile mode
                if args.promptfile:
                    gen_errors_prompt = generate_gen_errors_prompt(
                        template_file, game_name_from_yaml, error_count, args.seed, args.CC
                    )
                    collected_prompts.append(gen_errors_prompt)
                else:
                    # Output the prompt directly
                    gen_errors_prompt = generate_gen_errors_prompt(
                        template_file, game_name_from_yaml, error_count, args.seed, args.CC
                    )
                    print(gen_errors_prompt)

                    # Exit immediately if -t or -p was specified
                    if args.text or args.prompt:
                        return 0

                files_processed += 1

            # Check if we've reached the max files limit
            if args.max_files and files_processed >= args.max_files:
                if not quiet_mode:
                    print(f"\n✅ Reached maximum file limit ({args.max_files}), stopping...")
                break

            # Move to next template
            current_index = (current_index + 1) % len(template_files)
            processed_count += 1

            # If we've completed a full cycle, show progress
            if processed_count % len(template_files) == 0:
                cycle_num = processed_count // len(template_files)
                print(f"\n🔄 Completed cycle {cycle_num}")

                # Check if we've reached the max loops limit
                if cycle_num >= args.max_loops:
                    print(f"✅ Reached maximum loop limit ({args.max_loops}), stopping...")
                    break

            continue  # Skip the normal test-based processing below

        # Load current test results
        # --basic-spoiler-debug implies minimal spoilers
        use_minimal = args.minimal_spoilers or args.basic_spoiler_debug
        test_results = load_test_results(project_root, args.full_spoilers, use_minimal, args.multiclient, args.multiworld)

        # Check if we need to run the test (skip for multiclient/multiworld/basic-spoiler-debug mode - tests must already exist)
        if template_file not in test_results and not args.multiclient and not args.multiworld and not args.basic_spoiler_debug:
            if not quiet_mode:
                print("No test results found, running initial test...")
            run_template_test(template_file, args.seed)
            test_results = load_test_results(project_root, args.full_spoilers, args.minimal_spoilers, args.multiclient, args.multiworld)

        # Check if test is passing (use appropriate check for multiworld mode)
        if args.multiworld:
            test_passing = is_multiworld_test_passing(template_file, test_results)
        else:
            test_passing = is_test_passing(template_file, test_results, multiclient=args.multiclient)

        if test_passing:
            if not quiet_mode:
                print(f"✅ {template_file} is already passing, skipping...")
        else:
            if not quiet_mode:
                print(f"❌ {template_file} is failing, processing...")

            # Extract game name from template YAML
            game_name_from_yaml = extract_game_name_from_yaml(template_path)
            if not game_name_from_yaml:
                if not quiet_mode:
                    print(f"Could not extract game name from {template_file}, skipping...")
            else:
                if not quiet_mode:
                    print(f"Game name: {game_name_from_yaml}")

                # For --basic-spoiler-debug, skip games that have JavaScript helpers
                # (games with custom exporters but no JS helpers ARE included)
                if args.basic_spoiler_debug and has_javascript_helpers(game_name_from_yaml, world_mapping):
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - has JavaScript helpers")
                    # Move to next template without incrementing files_processed
                    current_index = (current_index + 1) % len(template_files)
                    processed_count += 1
                    if processed_count % len(template_files) == 0:
                        cycle_num = processed_count // len(template_files)
                        if cycle_num >= args.max_loops:
                            break
                    continue

                # For normal mode (not multiclient/multiworld/basic-spoiler-debug), skip games without JS helpers
                # Games without JS helpers should use --basic-spoiler-debug mode instead
                if not args.basic_spoiler_debug and not args.multiclient and not args.multiworld and world_mapping:
                    if not has_javascript_helpers(game_name_from_yaml, world_mapping):
                        if not quiet_mode:
                            print(f"Skipping {game_name_from_yaml} - no JavaScript helpers (use --basic-spoiler-debug)")
                        # Move to next template without incrementing files_processed
                        current_index = (current_index + 1) % len(template_files)
                        processed_count += 1
                        if processed_count % len(template_files) == 0:
                            cycle_num = processed_count // len(template_files)
                            if cycle_num >= args.max_loops:
                                break
                        continue

                # Check if seed 1 passes but another seed fails
                failing_seed = get_first_failing_seed(template_file, test_results)
                seed_to_use = failing_seed if failing_seed is not None else args.seed

                if failing_seed is not None and not quiet_mode:
                    print(f"Seed 1 passed, but seed {failing_seed} failed. Using seed {failing_seed} for prompt.")

                # Get custom code info for games without JS helpers (used by basic-spoiler-debug)
                custom_code_info = get_custom_code_info(game_name_from_yaml, world_mapping) if args.basic_spoiler_debug else None

                # Handle --promptfile mode
                if args.promptfile:
                    if args.basic_spoiler_debug:
                        # Generate basic spoiler debug prompt
                        basic_prompt = generate_basic_spoiler_debug_prompt(
                            template_file, game_name_from_yaml, seed_to_use, args.CC, custom_code_info
                        )
                        collected_prompts.append(basic_prompt)
                    elif args.multiworld:
                        # Generate multiworld-specific prompt using bisection results
                        bisection_info = get_multiworld_bisection_info(template_file, test_results)
                        failure_details = get_multiworld_failure_details(template_file, test_results)
                        multiworld_prompt = generate_multiworld_prompt(
                            template_file, game_name_from_yaml, bisection_info, failure_details, seed_to_use
                        )
                        collected_prompts.append(multiworld_prompt)
                    elif args.multiclient:
                        # Generate multiclient-specific prompt
                        multiclient_prompt = f"""First, please read CC/cloud-setup.md and complete the environment setup if you haven't already.

Then, please read
CC/game-debugging-multiclient-CC.md

The next game we want to work on is {game_name_from_yaml}.

The command to run the test is

python scripts/test/test-all-templates.py --include-list "{template_file}" --multiclient --single-client
"""
                        collected_prompts.append(multiclient_prompt)
                    else:
                        try:
                            cmd = ['python', 'CC/scripts/prompt.py', game_name_from_yaml, '--seed', str(seed_to_use), '-p']
                            if args.CC:
                                cmd.append('--CC')
                            if args.full_spoilers:
                                cmd.append('--full-spoilers')
                            result = subprocess.run(cmd, capture_output=True, text=True, check=False)
                            if result.returncode == 0:
                                collected_prompts.append(result.stdout)
                            else:
                                if not quiet_mode:
                                    print(f"Error getting prompt for {game_name_from_yaml}: {result.stderr}", file=sys.stderr)
                        except Exception as e:
                            if not quiet_mode:
                                print(f"Error getting prompt for {game_name_from_yaml}: {e}", file=sys.stderr)
                else:
                    # Handle non-promptfile modes
                    if args.basic_spoiler_debug:
                        # For basic-spoiler-debug mode with -p or -t, generate and output the prompt directly
                        basic_prompt = generate_basic_spoiler_debug_prompt(
                            template_file, game_name_from_yaml, seed_to_use, args.CC, custom_code_info
                        )
                        print(basic_prompt)

                        # Exit immediately if -t or -p was specified
                        if args.text or args.prompt:
                            return 0
                    elif args.multiworld:
                        # For multiworld mode with -p or -t, generate and output the prompt directly
                        bisection_info = get_multiworld_bisection_info(template_file, test_results)
                        failure_details = get_multiworld_failure_details(template_file, test_results)
                        multiworld_prompt = generate_multiworld_prompt(
                            template_file, game_name_from_yaml, bisection_info, failure_details, seed_to_use
                        )
                        print(multiworld_prompt)

                        # Exit immediately if -t or -p was specified
                        if args.text or args.prompt:
                            return 0
                    else:
                        # Run prompt script for normal spoiler/multiclient modes
                        run_prompt_for_game(game_name_from_yaml, args.text, args.prompt, seed_to_use, quiet_mode, args.CC, args.full_spoilers)

                        # Exit immediately if -t or -p was specified (regardless of --loud)
                        if args.text or args.prompt:
                            return 0

                        # Run test again to check if it's now passing
                        print("Re-running test to check if issues were resolved...")
                        run_template_test(template_file, args.seed)

                # Increment files processed counter
                files_processed += 1
        
        # Check if we've reached the max files limit
        if args.max_files and files_processed >= args.max_files:
            if not quiet_mode:
                print(f"\n✅ Reached maximum file limit ({args.max_files}), stopping...")
            break
        
        # Move to next template
        current_index = (current_index + 1) % len(template_files)
        processed_count += 1
        
        # If we've completed a full cycle, show progress
        if processed_count % len(template_files) == 0:
            cycle_num = processed_count // len(template_files)
            print(f"\n🔄 Completed cycle {cycle_num}")

            # Check if we've reached the max loops limit
            if cycle_num >= args.max_loops:
                print(f"✅ Reached maximum loop limit ({args.max_loops}), stopping...")
                break

            print("Starting new cycle from the beginning...")

        # Optional: Add a small delay to avoid overwhelming the system (skip in promptfile mode)
        if not args.promptfile:
            import time
            time.sleep(1)

    # Write collected prompts to file if in --promptfile mode
    if args.promptfile and collected_prompts:
        output_file = Path(project_root) / 'CC' / 'scripts' / 'prompts.txt'
        with open(output_file, 'w') as f:
            for i, prompt in enumerate(collected_prompts):
                f.write(prompt)
                # Add 10 empty lines with equals signs in the middle (but not after the last one)
                if i < len(collected_prompts) - 1:
                    f.write("\n\n\n\n\n")
                    f.write("=" * 80)
                    f.write("\n\n\n\n\n")

        print(f"Created {output_file} with {len(collected_prompts)} prompts")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user", file=sys.stderr)
        sys.exit(130)