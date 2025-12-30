#!/usr/bin/env python3
"""
Script to generate charts from template test results showing test results
for all game templates. Supports spoiler tests (minimal and full) and multiclient tests.
Can generate individual charts for each test type and a combined summary chart.
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# Add parent scripts directory to path to import from lib
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.test_utils import load_template_exclude_list

# Import UT comparison functions from the dedicated script
from generate_ut_comparison_chart import (
    extract_ut_comparison_chart_data,
    generate_ut_comparison_markdown,
    load_world_mapping
)

# Import from the chart_generators package
from chart_generators import (
    load_full_world_mapping,
    load_test_results,
    extract_spoiler_chart_data,
    generate_spoiler_markdown,
    extract_multiclient_chart_data,
    generate_multiclient_markdown,
    extract_multiworld_chart_data,
    generate_multiworld_markdown,
    extract_multitemplate_chart_data,
    generate_multitemplate_markdown,
    extract_processing_times_data,
    generate_processing_times_markdown,
    generate_summary_chart,
)


def main():
    parser = argparse.ArgumentParser(description='Generate test results charts from template test results')
    parser.add_argument('--input-file', type=str, help='Input JSON file path (processes only this file)')
    parser.add_argument('--output-file', type=str, help='Output markdown file path')
    parser.add_argument('--test-type', type=str, choices=['minimal', 'full', 'multiclient', 'multiworld', 'multitemplate-minimal', 'multitemplate-full', 'ut-comparison'],
                       help='Test type when using --input-file')
    parser.add_argument('--include-timing', action='store_true', default=False,
                       help='Include test timing data in output (default: off)')

    args = parser.parse_args()

    # Script is at scripts/docs/generate-test-chart.py, go up 3 levels to reach project root
    project_root = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

    # Single file mode
    if args.input_file or args.output_file:
        if not args.input_file or not args.output_file or not args.test_type:
            print("Error: When using --input-file or --output-file, you must specify all three: --input-file, --output-file, and --test-type")
            return 1

        input_path = os.path.join(project_root, args.input_file)
        output_path = os.path.join(project_root, args.output_file)

        if not os.path.exists(input_path):
            print(f"Error: Input file not found: {input_path}")
            return 1

        results = load_test_results(input_path)
        if not results:
            return 1

        metadata = results.get('metadata', {})

        if args.test_type in ['minimal', 'full']:
            chart_data = extract_spoiler_chart_data(results)
            subtitle = "Spoiler Test - Advancement Items Only" if args.test_type == 'minimal' else "Spoiler Test - All Locations"
            md_content = generate_spoiler_markdown(chart_data, metadata, subtitle, include_timing=args.include_timing)
        elif args.test_type == 'multiclient':
            chart_data = extract_multiclient_chart_data(results)
            # Extract top-level metadata for multiclient
            top_level = {
                'timestamp': results.get('timestamp'),
                'test_type': results.get('test_type'),
                'test_mode': results.get('test_mode'),
                'seed': results.get('seed')
            }
            md_content = generate_multiclient_markdown(chart_data, metadata, top_level)
        elif args.test_type in ['multitemplate-minimal', 'multitemplate-full']:
            chart_data = extract_multitemplate_chart_data(results)
            subtitle = "Multi-Template Test - Advancement Items Only" if args.test_type == 'multitemplate-minimal' else "Multi-Template Test - All Locations"
            md_content = generate_multitemplate_markdown(chart_data, metadata, subtitle)
        elif args.test_type == 'ut-comparison':
            chart_data = extract_ut_comparison_chart_data(results)
            world_mapping = load_world_mapping(project_root)
            md_content = generate_ut_comparison_markdown(chart_data, metadata, world_mapping)
        else:  # multiworld
            full_world_mapping = load_full_world_mapping(project_root)
            chart_data = extract_multiworld_chart_data(results, full_world_mapping)
            # Extract top-level metadata for multiworld
            top_level = {
                'timestamp': results.get('timestamp'),
                'seed': results.get('seed')
            }
            md_content = generate_multiworld_markdown(chart_data, metadata, top_level)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(md_content)
        print(f"Chart saved to: {output_path}")
        return 0

    # Process all test types (original and WorldGen)

    # First, update the world mapping to ensure file sizes are current
    print("Updating world mapping...")
    world_mapping_script = os.path.join(project_root, 'scripts/build/build-world-mapping.py')
    result = subprocess.run([sys.executable, world_mapping_script], cwd=project_root, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Warning: Failed to update world mapping: {result.stderr}")
    else:
        print("World mapping updated successfully.")

    # Load world mapping for file size information (used by all markdown generators)
    full_world_mapping = load_full_world_mapping(project_root)

    # Initialize worldgen data variables (will be populated if files exist)
    minimal_wg_data = []
    full_wg_data = []
    mp_wg_data = []
    mw_wg_data = None

    # Load minimal spoiler test results (original and WorldGen)
    minimal_input = os.path.join(project_root, 'scripts/output/spoiler-minimal/test-results.json')
    minimal_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-spoilers-minimal.md')
    minimal_wg_input = os.path.join(project_root, 'scripts/output/spoiler-minimal-worldgen/test-results.json')
    minimal_wg_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-spoilers-minimal-worldgen.md')

    has_minimal = os.path.exists(minimal_input)
    has_minimal_wg = os.path.exists(minimal_wg_input)

    if has_minimal:
        minimal_results = load_test_results(minimal_input)
        minimal_data = extract_spoiler_chart_data(minimal_results)
        # Cross-link to WorldGen version if it exists
        wg_link = './test-results-spoilers-minimal-worldgen.md' if has_minimal_wg else None
        minimal_md = generate_spoiler_markdown(minimal_data, minimal_results.get('metadata', {}),
                                              "Spoiler Test - Advancement Items Only",
                                              is_worldgen=False, other_version_link=wg_link,
                                              world_mapping=full_world_mapping,
                                              include_timing=args.include_timing)
        os.makedirs(os.path.dirname(minimal_output), exist_ok=True)
        with open(minimal_output, 'w') as f:
            f.write(minimal_md)
    else:
        print(f"Warning: Minimal spoiler test results not found: {minimal_input}")
        minimal_data = []

    if has_minimal_wg:
        minimal_wg_results = load_test_results(minimal_wg_input)
        minimal_wg_data = extract_spoiler_chart_data(minimal_wg_results)
        # Cross-link to original version if it exists
        orig_link = './test-results-spoilers-minimal.md' if has_minimal else None
        minimal_wg_md = generate_spoiler_markdown(minimal_wg_data, minimal_wg_results.get('metadata', {}),
                                                  "Spoiler Test - Advancement Items Only (WorldGen)",
                                                  is_worldgen=True, other_version_link=orig_link,
                                                  world_mapping=full_world_mapping,
                                                  include_timing=args.include_timing)
        os.makedirs(os.path.dirname(minimal_wg_output), exist_ok=True)
        with open(minimal_wg_output, 'w') as f:
            f.write(minimal_wg_md)
    else:
        print(f"Info: WorldGen minimal spoiler test results not found: {minimal_wg_input}")

    # Load full spoiler test results (original and WorldGen)
    full_input = os.path.join(project_root, 'scripts/output/spoiler-full/test-results.json')
    full_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-spoilers-full.md')
    full_wg_input = os.path.join(project_root, 'scripts/output/spoiler-full-worldgen/test-results.json')
    full_wg_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-spoilers-full-worldgen.md')

    has_full = os.path.exists(full_input)
    has_full_wg = os.path.exists(full_wg_input)

    if has_full:
        full_results = load_test_results(full_input)
        full_data = extract_spoiler_chart_data(full_results)
        wg_link = './test-results-spoilers-full-worldgen.md' if has_full_wg else None
        full_md = generate_spoiler_markdown(full_data, full_results.get('metadata', {}),
                                           "Spoiler Test - All Locations",
                                           is_worldgen=False, other_version_link=wg_link,
                                           world_mapping=full_world_mapping,
                                           include_timing=args.include_timing)
        os.makedirs(os.path.dirname(full_output), exist_ok=True)
        with open(full_output, 'w') as f:
            f.write(full_md)
    else:
        print(f"Warning: Full spoiler test results not found: {full_input}")
        full_data = []

    if has_full_wg:
        full_wg_results = load_test_results(full_wg_input)
        full_wg_data = extract_spoiler_chart_data(full_wg_results)
        orig_link = './test-results-spoilers-full.md' if has_full else None
        full_wg_md = generate_spoiler_markdown(full_wg_data, full_wg_results.get('metadata', {}),
                                               "Spoiler Test - All Locations (WorldGen)",
                                               is_worldgen=True, other_version_link=orig_link,
                                               world_mapping=full_world_mapping,
                                               include_timing=args.include_timing)
        os.makedirs(os.path.dirname(full_wg_output), exist_ok=True)
        with open(full_wg_output, 'w') as f:
            f.write(full_wg_md)
    else:
        print(f"Info: WorldGen full spoiler test results not found: {full_wg_input}")

    # Load multiclient test results (original and WorldGen)
    mp_input = os.path.join(project_root, 'scripts/output/multiclient/test-results.json')
    mp_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-multiclient.md')
    mp_wg_input = os.path.join(project_root, 'scripts/output/multiclient-worldgen/test-results.json')
    mp_wg_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-multiclient-worldgen.md')

    has_mp = os.path.exists(mp_input)
    has_mp_wg = os.path.exists(mp_wg_input)

    if has_mp:
        mp_results = load_test_results(mp_input)
        mp_data = extract_multiclient_chart_data(mp_results)
        top_level_mp = {
            'timestamp': mp_results.get('timestamp'),
            'test_type': mp_results.get('test_type'),
            'test_mode': mp_results.get('test_mode'),
            'seed': mp_results.get('seed')
        }
        wg_link = './test-results-multiclient-worldgen.md' if has_mp_wg else None
        mp_md = generate_multiclient_markdown(mp_data, mp_results.get('metadata', {}), top_level_mp,
                                              is_worldgen=False, other_version_link=wg_link,
                                              world_mapping=full_world_mapping)
        os.makedirs(os.path.dirname(mp_output), exist_ok=True)
        with open(mp_output, 'w') as f:
            f.write(mp_md)
    else:
        print(f"Warning: Multiclient test results not found: {mp_input}")
        mp_data = []

    if has_mp_wg:
        mp_wg_results = load_test_results(mp_wg_input)
        mp_wg_data = extract_multiclient_chart_data(mp_wg_results)
        top_level_mp_wg = {
            'timestamp': mp_wg_results.get('timestamp'),
            'test_type': mp_wg_results.get('test_type'),
            'test_mode': mp_wg_results.get('test_mode'),
            'seed': mp_wg_results.get('seed')
        }
        orig_link = './test-results-multiclient.md' if has_mp else None
        mp_wg_md = generate_multiclient_markdown(mp_wg_data, mp_wg_results.get('metadata', {}), top_level_mp_wg,
                                                  is_worldgen=True, other_version_link=orig_link,
                                                  world_mapping=full_world_mapping)
        os.makedirs(os.path.dirname(mp_wg_output), exist_ok=True)
        with open(mp_wg_output, 'w') as f:
            f.write(mp_wg_md)
    else:
        print(f"Info: WorldGen multiclient test results not found: {mp_wg_input}")

    # Load multiworld test results (original and WorldGen)
    mw_input = os.path.join(project_root, 'scripts/output/multiworld/test-results.json')
    mw_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-multiworld.md')
    mw_wg_input = os.path.join(project_root, 'scripts/output/multiworld-worldgen/test-results.json')
    mw_wg_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-multiworld-worldgen.md')

    has_mw = os.path.exists(mw_input)
    has_mw_wg = os.path.exists(mw_wg_input)

    mw_data = None
    if has_mw:
        mw_results = load_test_results(mw_input)
        mw_data = extract_multiworld_chart_data(mw_results, full_world_mapping)
        top_level_mw = {
            'timestamp': mw_results.get('timestamp'),
            'seed': mw_results.get('seed')
        }
        wg_link = './test-results-multiworld-worldgen.md' if has_mw_wg else None
        mw_md = generate_multiworld_markdown(mw_data, mw_results.get('metadata', {}), top_level_mw,
                                             is_worldgen=False, other_version_link=wg_link)
        os.makedirs(os.path.dirname(mw_output), exist_ok=True)
        with open(mw_output, 'w') as f:
            f.write(mw_md)
    else:
        print(f"Warning: Multiworld test results not found: {mw_input}")

    if has_mw_wg:
        mw_wg_results = load_test_results(mw_wg_input)
        mw_wg_data = extract_multiworld_chart_data(mw_wg_results, full_world_mapping)
        top_level_mw_wg = {
            'timestamp': mw_wg_results.get('timestamp'),
            'seed': mw_wg_results.get('seed')
        }
        orig_link = './test-results-multiworld.md' if has_mw else None
        mw_wg_md = generate_multiworld_markdown(mw_wg_data, mw_wg_results.get('metadata', {}), top_level_mw_wg,
                                                 is_worldgen=True, other_version_link=orig_link)
        os.makedirs(os.path.dirname(mw_wg_output), exist_ok=True)
        with open(mw_wg_output, 'w') as f:
            f.write(mw_wg_md)
    else:
        print(f"Info: WorldGen multiworld test results not found: {mw_wg_input}")

    # Load multitemplate minimal test results
    mtmin_input = os.path.join(project_root, 'scripts/output/multitemplate-minimal/test-results.json')
    mtmin_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-multitemplate-minimal.md')

    mtmin_data = None
    if os.path.exists(mtmin_input):
        mtmin_results = load_test_results(mtmin_input)
        mtmin_data = extract_multitemplate_chart_data(mtmin_results)
        mtmin_md = generate_multitemplate_markdown(mtmin_data, mtmin_results.get('metadata', {}),
                                                   "Multi-Template Test - Advancement Items Only")
        os.makedirs(os.path.dirname(mtmin_output), exist_ok=True)
        with open(mtmin_output, 'w') as f:
            f.write(mtmin_md)
    else:
        print(f"Info: Multitemplate minimal test results not found: {mtmin_input}")

    # Load multitemplate full test results
    mtfull_input = os.path.join(project_root, 'scripts/output/multitemplate-full/test-results.json')
    mtfull_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-multitemplate-full.md')

    mtfull_data = None
    if os.path.exists(mtfull_input):
        mtfull_results = load_test_results(mtfull_input)
        mtfull_data = extract_multitemplate_chart_data(mtfull_results)
        mtfull_md = generate_multitemplate_markdown(mtfull_data, mtfull_results.get('metadata', {}),
                                                    "Multi-Template Test - All Locations")
        os.makedirs(os.path.dirname(mtfull_output), exist_ok=True)
        with open(mtfull_output, 'w') as f:
            f.write(mtfull_md)
    else:
        print(f"Info: Multitemplate full test results not found: {mtfull_input}")

    # Load UT comparison test results (both random and fixed seed)
    ut_random_input = os.path.join(project_root, 'scripts/output/ut-comparison/test-results-random-seed.json')
    ut_fixed_input = os.path.join(project_root, 'scripts/output/ut-comparison/test-results-fixed-seed.json')
    ut_output_dir = os.path.join(project_root, 'docs/json/developer/test-results')

    ut_random_data = None
    ut_fixed_data = None
    world_mapping = load_world_mapping(project_root)

    has_random = os.path.exists(ut_random_input)
    has_fixed = os.path.exists(ut_fixed_input)

    if has_random:
        ut_random_results = load_test_results(ut_random_input)
        ut_random_data = extract_ut_comparison_chart_data(ut_random_results)
        other_link = './test-results-ut-comparison-fixed-seed.md' if has_fixed else None
        ut_random_md = generate_ut_comparison_markdown(
            ut_random_data,
            ut_random_results.get('metadata', {}),
            world_mapping,
            seed_type="random",
            other_results_link=other_link
        )
        ut_random_output = os.path.join(ut_output_dir, 'test-results-ut-comparison-random-seed.md')
        os.makedirs(ut_output_dir, exist_ok=True)
        with open(ut_random_output, 'w') as f:
            f.write(ut_random_md)
    else:
        print(f"Info: UT comparison random seed results not found: {ut_random_input}")

    if has_fixed:
        ut_fixed_results = load_test_results(ut_fixed_input)
        ut_fixed_data = extract_ut_comparison_chart_data(ut_fixed_results)
        other_link = './test-results-ut-comparison-random-seed.md' if has_random else None
        ut_fixed_md = generate_ut_comparison_markdown(
            ut_fixed_data,
            ut_fixed_results.get('metadata', {}),
            world_mapping,
            seed_type="fixed",
            other_results_link=other_link
        )
        ut_fixed_output = os.path.join(ut_output_dir, 'test-results-ut-comparison-fixed-seed.md')
        os.makedirs(ut_output_dir, exist_ok=True)
        with open(ut_fixed_output, 'w') as f:
            f.write(ut_fixed_md)
    else:
        print(f"Info: UT comparison fixed seed results not found: {ut_fixed_input}")

    # For the summary, use fixed seed data if available, otherwise random
    ut_data = ut_fixed_data if ut_fixed_data else ut_random_data

    # Generate summary charts (original and WorldGen)
    if minimal_data or full_data or mp_data or mw_data or mtmin_data or mtfull_data or ut_data:
        # Load the exclude list with reasons for main tests
        excluded_games_main = load_template_exclude_list(project_root, include_reasons=True, test_type='main')

        # Get metadata for intermittent failures
        minimal_meta = minimal_results.get('metadata', {}) if 'minimal_results' in locals() else None
        full_meta = full_results.get('metadata', {}) if 'full_results' in locals() else None
        mp_meta = mp_results.get('metadata', {}) if 'mp_results' in locals() else None
        mw_meta = mw_results.get('metadata', {}) if 'mw_results' in locals() else None

        # Check if we have worldgen data for the summary
        has_wg_summary = minimal_wg_data or full_wg_data or mp_wg_data or mw_wg_data

        # Generate original summary with cross-link to worldgen if available
        summary_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-summary.md')
        wg_summary_link = './test-results-summary-worldgen.md' if has_wg_summary else None
        summary_md = generate_summary_chart(minimal_data, full_data, mp_data, mw_data, mtmin_data, mtfull_data, ut_data, excluded_games_main, minimal_meta, full_meta, multiclient_metadata=mp_meta, multiworld_metadata=mw_meta, has_ut_random=has_random, has_ut_fixed=has_fixed, world_mapping=full_world_mapping, is_worldgen=False, other_version_link=wg_summary_link, project_root=project_root)
        with open(summary_output, 'w') as f:
            f.write(summary_md)

    # Generate WorldGen summary chart if we have any worldgen data
    if minimal_wg_data or full_wg_data or mp_wg_data or mw_wg_data:
        # Load the exclude list with reasons for worldgen tests (includes main + worldgen exclusions)
        excluded_games_worldgen = load_template_exclude_list(project_root, include_reasons=True, test_type='all')

        # Get metadata for intermittent failures from worldgen results
        minimal_wg_meta = minimal_wg_results.get('metadata', {}) if 'minimal_wg_results' in locals() else None
        full_wg_meta = full_wg_results.get('metadata', {}) if 'full_wg_results' in locals() else None
        mp_wg_meta = mp_wg_results.get('metadata', {}) if 'mp_wg_results' in locals() else None
        mw_wg_meta = mw_wg_results.get('metadata', {}) if 'mw_wg_results' in locals() else None

        summary_wg_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-summary-worldgen.md')
        orig_summary_link = './test-results-summary.md'
        summary_wg_md = generate_summary_chart(minimal_wg_data, full_wg_data, mp_wg_data, mw_wg_data, None, None, None, excluded_games_worldgen, minimal_wg_meta, full_wg_meta, multiclient_metadata=mp_wg_meta, multiworld_metadata=mw_wg_meta, has_ut_random=False, has_ut_fixed=False, world_mapping=full_world_mapping, is_worldgen=True, other_version_link=orig_summary_link, project_root=project_root)
        with open(summary_wg_output, 'w') as f:
            f.write(summary_wg_md)

    # Generate processing times chart if we have any results
    if 'minimal_results' in locals() or 'full_results' in locals() or 'mp_results' in locals() or 'mw_results' in locals():
        processing_times_data = extract_processing_times_data(
            minimal_results if 'minimal_results' in locals() else {},
            full_results if 'full_results' in locals() else {},
            mp_results if 'mp_results' in locals() else {},
            mw_results if 'mw_results' in locals() else {}
        )
        processing_times_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-processing-times.md')
        processing_times_md = generate_processing_times_markdown(processing_times_data)
        with open(processing_times_output, 'w') as f:
            f.write(processing_times_md)
        print(f"Generated: {processing_times_output}")

    print("\n=== Chart Generation Complete ===")
    return 0


if __name__ == '__main__':
    exit(main())
