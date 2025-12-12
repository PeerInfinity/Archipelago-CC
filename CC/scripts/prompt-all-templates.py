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
        (['--new-rule-types', '--CC'], 'new-rule-types.txt'),
        (['--gen-errors', '--CC'], 'gen-errors.txt'),
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


def generate_new_rule_types_prompt(game_name):
    """Generate a prompt for investigating new rule types needed by a game's helpers.

    This prompt refers to CC/implementing-new-rule-types.md for games that have
    JavaScript helpers requiring new rule type support.
    """
    return f"""First, please read CC/cloud-setup.md and complete the environment setup if you haven't already.

Then, please read CC/implementing-new-rule-types.md

Then please investigate what needs to be done next to continue adding support for the rule types required by the helper functions in {game_name}.
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


def generate_basic_spoiler_debug_prompt(template_file, game_name, seed=1, use_cloud_docs=False):
    """Generate a debugging prompt for a basic game failing spoiler tests.

    This prompt refers to CC/basic-spoiler-debugging.md for games that don't have
    custom exporters or JavaScript helpers.
    """
    doc_path = "CC/basic-spoiler-debugging.md" if use_cloud_docs else "CC/basic-spoiler-debugging.md"
    setup_doc = "CC/cloud-setup.md" if use_cloud_docs else "CC/cloud-setup.md"

    return f"""First, please read {setup_doc} and complete the environment setup if you haven't already.

Then, please read
{doc_path}

The game we are debugging is **{game_name}** (template: `{template_file}`).

This game uses only the generic export infrastructure - it has no custom exporter (`exporter/games/<game>.py`) and no JavaScript helpers (`frontend/modules/shared/gameLogic/<game>/`).

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

Since this is a basic game, focus on whether the generic infrastructure is handling this game's rules correctly.
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
    # Load default exclude list
    default_exclude_list = load_template_exclude_list()

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
                       default=default_exclude_list,
                       help=f'List of template files to skip (default: {" ".join(default_exclude_list)})')
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
                       help='Generate prompts for basic games (no custom exporter/helpers) failing minimal spoiler tests')
    parser.add_argument('--helper-export', action='store_true',
                       help='Generate prompts for games with custom exporter/helpers to convert them to use helper export')
    parser.add_argument('--new-rule-types', action='store_true',
                       help='Generate prompts for games with JavaScript helpers to investigate implementing new rule types')
    parser.add_argument('--gen-errors', action='store_true',
                       help='Generate prompts for games that pass spoiler tests but have generation errors')
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

    if args.new_rule_types and (args.multiclient or args.multiworld):
        print("Error: --new-rule-types cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if args.new_rule_types and args.basic_spoiler_debug:
        print("Error: --new-rule-types and --basic-spoiler-debug are mutually exclusive")
        sys.exit(1)

    if args.new_rule_types and args.helper_export:
        print("Error: --new-rule-types and --helper-export are mutually exclusive")
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

    # Handle --all-promptfiles mode: run all prompt-generating modes with separate output files
    if args.all_promptfiles:
        return run_all_promptfiles(project_root)

    # Load world mapping (needed for filtering by custom code status)
    # Used by: --basic-spoiler-debug, --helper-export, and normal mode (to exclude basic games)
    world_mapping = load_world_mapping(project_root)
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

                # Skip games without custom code
                if not has_custom_code(game_name_from_yaml, world_mapping):
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - no custom exporter or helpers")
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

                # For --basic-spoiler-debug, skip games that have custom exporters or helpers
                if args.basic_spoiler_debug and not is_basic_game(game_name_from_yaml, world_mapping):
                    if not quiet_mode:
                        print(f"Skipping {game_name_from_yaml} - has custom exporter or helpers")
                    # Move to next template without incrementing files_processed
                    current_index = (current_index + 1) % len(template_files)
                    processed_count += 1
                    if processed_count % len(template_files) == 0:
                        cycle_num = processed_count // len(template_files)
                        if cycle_num >= args.max_loops:
                            break
                    continue

                # For normal mode (not multiclient/multiworld/basic-spoiler-debug), skip basic games
                # Basic games should use --basic-spoiler-debug mode instead
                if not args.basic_spoiler_debug and not args.multiclient and not args.multiworld and world_mapping:
                    if not has_custom_code(game_name_from_yaml, world_mapping):
                        if not quiet_mode:
                            print(f"Skipping {game_name_from_yaml} - no custom exporter or helpers (use --basic-spoiler-debug for basic games)")
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

                # Handle --promptfile mode
                if args.promptfile:
                    if args.basic_spoiler_debug:
                        # Generate basic spoiler debug prompt
                        basic_prompt = generate_basic_spoiler_debug_prompt(
                            template_file, game_name_from_yaml, seed_to_use, args.CC
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
                            template_file, game_name_from_yaml, seed_to_use, args.CC
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