"""
Command-line interface utilities for prompt-all-templates.py.
"""

import argparse
import sys


def create_argument_parser():
    """Create and return the argument parser for prompt-all-templates.py."""
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
    parser.add_argument('--worldgen-rules-comp-failures', action='store_true',
                       help='Generate prompts for WorldGen Stage 5 failures (rules.json comparison fails)')
    parser.add_argument('--worldgen-test-mode', type=str, choices=['canonical', 'random'], default='canonical',
                       help='Which world generator test results to use (default: canonical)')
    parser.add_argument('--ut-fuzz-failures', action='store_true',
                       help='Generate prompts for games that pass canonical worldgen but fail UT fuzz testing')
    parser.add_argument('--ut-version', type=str, choices=['original', 'modified'], default='modified',
                       help='Which UT version results to use for --ut-fuzz-failures (default: modified)')
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
    return parser


def validate_arguments(args):
    """Validate the parsed arguments for mutual exclusivity and other constraints.

    Returns True if validation passes, exits with error if validation fails.
    """
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

    worldgen_modes = [args.worldgen_world_failures, args.worldgen_seed_failures, args.worldgen_spoiler_failures, args.worldgen_crossval_failures, args.worldgen_rules_comp_failures]
    if sum(worldgen_modes) > 1:
        print("Error: --worldgen-world-failures, --worldgen-seed-failures, --worldgen-spoiler-failures, --worldgen-crossval-failures, and --worldgen-rules-comp-failures are mutually exclusive")
        sys.exit(1)

    if any(worldgen_modes) and (args.multiclient or args.multiworld):
        print("Error: --worldgen-* modes cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if any(worldgen_modes) and (args.basic_spoiler_debug or args.helper_export or args.exporter_simplify or args.new_rule_types or args.gen_errors):
        print("Error: --worldgen-* modes cannot be combined with other debugging modes")
        sys.exit(1)

    if args.ut_fuzz_failures and (args.multiclient or args.multiworld):
        print("Error: --ut-fuzz-failures cannot be combined with --multiclient or --multiworld")
        sys.exit(1)

    if args.ut_fuzz_failures and any(worldgen_modes):
        print("Error: --ut-fuzz-failures cannot be combined with --worldgen-* modes")
        sys.exit(1)

    if args.ut_fuzz_failures and (args.basic_spoiler_debug or args.helper_export or args.exporter_simplify or args.new_rule_types or args.gen_errors):
        print("Error: --ut-fuzz-failures cannot be combined with other debugging modes")
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

    return True


def apply_worldgen_filtering(args):
    """Apply WorldGen template filtering based on arguments.

    Modifies args in place to set include_pattern or exclude_pattern.
    """
    # Apply WorldGen filtering (exclude by default unless --include-worldgen or --only-worldgen)
    if args.only_worldgen:
        args.include_pattern = "WorldGen"
    elif not args.include_worldgen and not args.include_pattern:
        # Exclude WorldGen by default (unless an include pattern is specified)
        if not args.exclude_pattern:
            args.exclude_pattern = "WorldGen"


def write_collected_prompts(collected_prompts, output_file):
    """Write collected prompts to a file with separators between them.

    Args:
        collected_prompts: List of prompt strings to write.
        output_file: Path to the output file.
    """
    with open(output_file, 'w') as f:
        for i, prompt in enumerate(collected_prompts):
            f.write(prompt)
            # Add separator between prompts (but not after the last one)
            if i < len(collected_prompts) - 1:
                f.write("\n\n\n\n\n")
                f.write("=" * 80)
                f.write("\n\n\n\n\n")
    print(f"Created {output_file} with {len(collected_prompts)} prompts")
