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
    - The test was skipped due to prerequisites not being met

    Returns False if:
    - The test failed (multiworld_test.success is False AND prerequisites passed)
    - The template is not in the results
    """
    if template_file not in test_results:
        return False

    result = test_results[template_file]
    if not isinstance(result, dict):
        return False

    # Check if prerequisites were met - if not, treat as "passing" (skip it)
    prereq = result.get('prerequisite_check', {})
    if not prereq.get('all_prerequisites_passed', True):
        return True  # Skipped due to prerequisites - don't generate prompt

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
        'templates_in_multiworld': multiworld_test.get('templates_in_multiworld', {})
    }


def generate_multiworld_prompt(template_file, game_name, bisection_info, failure_details, seed=1):
    """Generate a debugging prompt for a failing multiworld test.

    Focuses on specific failing pairs from bisection results when available.
    """
    prompt_parts = []

    prompt_parts.append("""First, please read CC/cloud-setup.md and complete the environment setup if you haven't already.

Then, please read
CC/game-debugging-multiworld-CC.md
""")

    prompt_parts.append(f"The game we are debugging is **{game_name}** (template: `{template_file}`).\n")

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
        # Bisection ran but found no failing pairs - might be an intermittent issue
        prompt_parts.append(f"\n## Bisection Results\n")
        prompt_parts.append("Bisection testing was triggered but found NO specific failing pairs.\n")
        prompt_parts.append("This might indicate an intermittent failure or an issue that only occurs with more than 2 templates.\n")

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
    parser.add_argument('--exclude-pattern', type=str,
                       help='Exclude template files matching this pattern (e.g., "WorldGen" to exclude WorldGen templates)')
    parser.add_argument('--include-pattern', type=str,
                       help='Only include template files matching this pattern (e.g., "WorldGen" to only test WorldGen templates)')

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

    if args.include_pattern and args.exclude_pattern:
        print("Error: --include-pattern and --exclude-pattern are mutually exclusive")
        sys.exit(1)

    # Determine project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

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

        # Load current test results
        test_results = load_test_results(project_root, args.full_spoilers, args.minimal_spoilers, args.multiclient, args.multiworld)

        # Check if we need to run the test (skip for multiclient/multiworld mode - tests must already exist)
        if template_file not in test_results and not args.multiclient and not args.multiworld:
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

                # Check if seed 1 passes but another seed fails
                failing_seed = get_first_failing_seed(template_file, test_results)
                seed_to_use = failing_seed if failing_seed is not None else args.seed

                if failing_seed is not None and not quiet_mode:
                    print(f"Seed 1 passed, but seed {failing_seed} failed. Using seed {failing_seed} for prompt.")

                # Handle --promptfile mode
                if args.promptfile:
                    if args.multiworld:
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
                    if args.multiworld:
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