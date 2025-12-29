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

# Import from prompt_lib package
from prompt_lib import (
    # data_loading
    load_world_mapping,
    load_prompt_exclusion_lists,
    get_test_results_path,
    load_test_results,
    extract_game_name_from_yaml,
    get_template_files,
    # game_info
    is_basic_game,
    has_custom_code,
    has_javascript_helpers,
    get_custom_code_info,
    # test_results
    get_first_failing_seed,
    is_multiworld_test_passing,
    get_multiworld_bisection_info,
    get_multiworld_failure_details,
    has_generation_errors_but_passes,
    # worldgen_analysis
    load_worldgen_test_results,
    get_worldgen_world_failures,
    get_worldgen_seed_failures,
    get_worldgen_spoiler_failures,
    get_worldgen_crossval_failures,
    categorize_world_generation_error,
    categorize_seed_generation_error,
    # prompt_generators.standard
    generate_helper_export_prompt,
    generate_exporter_simplify_prompt,
    generate_new_rule_types_prompt,
    generate_gen_errors_prompt,
    generate_basic_spoiler_debug_prompt,
    generate_multiworld_prompt,
    # prompt_generators.worldgen
    generate_worldgen_world_failure_prompt,
    generate_worldgen_seed_failure_prompt,
    generate_worldgen_spoiler_failure_prompt,
    generate_worldgen_crossval_failure_prompt,
)


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