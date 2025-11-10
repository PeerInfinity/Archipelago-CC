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

from test_utils import read_host_yaml_config
from test_results import is_test_passing, load_existing_results


def get_test_results_path(project_root):
    """Determine the correct test results path based on host.yaml configuration."""
    # Read host.yaml to check extend_sphere_log_to_all_locations setting
    host_config = read_host_yaml_config(project_root)
    extend_sphere_log = host_config.get('general_options', {}).get('extend_sphere_log_to_all_locations', True)

    # Use appropriate output directory based on configuration
    if extend_sphere_log:
        return Path(project_root) / 'scripts/output-spoiler-full/template-test-results.json'
    else:
        return Path(project_root) / 'scripts/output-spoiler-minimal/template-test-results.json'


def load_test_results(project_root):
    """Load the template test results JSON file."""
    results_file = get_test_results_path(project_root)
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
            ['python', 'scripts/test-all-templates.py', '--include-list', template_file, '--seed', str(seed)],
            capture_output=True, text=True, check=False
        )
        return result.returncode == 0
    except Exception as e:
        print(f"Error running template test: {e}", file=sys.stderr)
        return False


def extract_game_name_from_template(template_path):
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
        template_name = template_path.stem
        if template_name.endswith('.yaml'):
            template_name = template_name[:-5]
        return template_name.replace(' Template', '')
        
    except Exception as e:
        print(f"Error reading template {template_path}: {e}", file=sys.stderr)
        return None


def get_first_failing_seed(template_file, test_results):
    """Get the first failing seed number if seed 1 passes but another seed fails.
    Returns None if seed 1 fails or if all seeds pass."""
    if template_file not in test_results:
        return None

    result = test_results[template_file]

    if not isinstance(result, dict):
        return None

    # Check if there's a first_failure_seed field
    if 'first_failure_seed' in result and result['first_failure_seed'] is not None:
        # Check if seed 1 passed
        individual_results = result.get('individual_results', {})
        if '1' in individual_results:
            seed_1_result = individual_results['1']
            spoiler_test = seed_1_result.get('spoiler_test', {})
            if spoiler_test.get('pass_fail') == 'passed':
                # Seed 1 passed, but another seed failed
                return result['first_failure_seed']

    return None


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


def run_prompt_for_game(game_name, use_text_mode=False, use_prompt_mode=False, seed=1, quiet_mode=False):
    """Run the prompt script for a specific game."""
    if not quiet_mode:
        print(f"Running prompt script for game: {game_name}")
    try:
        cmd = ['python', 'CC/scripts/prompt.py', game_name, '--seed', str(seed)]
        if use_text_mode:
            cmd.append('--text')
        if use_prompt_mode:
            cmd.append('--prompt')

        result = subprocess.run(cmd, check=False)
        return result.returncode == 0
    except Exception as e:
        if not quiet_mode:
            print(f"Error running prompt script: {e}", file=sys.stderr)
        return False


def get_prompt_for_game(game_name, seed=1):
    """Get the prompt text for a specific game without running it."""
    try:
        cmd = ['python', 'CC/scripts/prompt.py', game_name, '--seed', str(seed), '--prompt']
        result = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if result.returncode == 0:
            return result.stdout
        else:
            print(f"Error getting prompt for {game_name}: {result.stderr}", file=sys.stderr)
            return None
    except Exception as e:
        print(f"Error getting prompt for {game_name}: {e}", file=sys.stderr)
        return None


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
                       default=['Archipelago.yaml', 'Universal Tracker.yaml', 'Final Fantasy.yaml', 'Sudoku.yaml'],
                       help='List of template files to skip (default: Archipelago.yaml Universal Tracker.yaml Final Fantasy.yaml Sudoku.yaml)')
    parser.add_argument('-s', '--seed', type=int, default=1,
                       help='Seed number to use for generation (default: 1)')
    parser.add_argument('--max-loops', type=int, default=1,
                       help='Maximum number of complete cycles through all templates (default: 1)')
    parser.add_argument('--promptfile', action='store_true',
                       help='Write all prompts to prompts.txt instead of running them')

    args = parser.parse_args()

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
        test_results = load_test_results(project_root)

        # Check if we need to run the test
        if template_file not in test_results:
            if not quiet_mode:
                print("No test results found, running initial test...")
            run_template_test(template_file, args.seed)
            test_results = load_test_results(project_root)

        # Check if test is passing
        if is_test_passing(template_file, test_results):
            if not quiet_mode:
                print(f"✅ {template_file} is already passing, skipping...")
        else:
            if not quiet_mode:
                print(f"❌ {template_file} is failing, processing...")

            # Extract game name from template
            game_name = extract_game_name_from_template(template_path)
            if not game_name:
                if not quiet_mode:
                    print(f"Could not extract game name from {template_file}, skipping...")
            else:
                if not quiet_mode:
                    print(f"Game name: {game_name}")

                # Check if seed 1 passes but another seed fails
                failing_seed = get_first_failing_seed(template_file, test_results)
                seed_to_use = failing_seed if failing_seed is not None else args.seed

                if failing_seed is not None and not quiet_mode:
                    print(f"Seed 1 passed, but seed {failing_seed} failed. Using seed {failing_seed} for prompt.")

                # Handle --promptfile mode
                if args.promptfile:
                    prompt_text = get_prompt_for_game(game_name, seed_to_use)
                    if prompt_text:
                        collected_prompts.append(prompt_text)
                else:
                    # Run prompt script
                    run_prompt_for_game(game_name, args.text, args.prompt, seed_to_use, quiet_mode)

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
                # Add three newlines between prompts (but not after the last one)
                if i < len(collected_prompts) - 1:
                    f.write("\n\n\n")

        print(f"Created {output_file} with {len(collected_prompts)} prompts")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nInterrupted by user", file=sys.stderr)
        sys.exit(130)