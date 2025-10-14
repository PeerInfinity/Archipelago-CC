#!/usr/bin/env python3
"""
Script to generate charts from template test results showing test results
for all game templates. Supports spoiler tests (minimal and full) and multiplayer tests.
Can generate individual charts for each test type and a combined summary chart.
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load the template test results from JSON file."""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading results file {results_file}: {e}")
        return {}


def extract_spoiler_chart_data(results: Dict[str, Any]) -> List[Tuple[str, str, int, float, float, bool, bool]]:
    """
    Extract spoiler test chart data from results.
    Returns list of tuples: (game_name, pass_fail, gen_error_count, sphere_reached, max_spheres, has_custom_exporter, has_custom_game_logic)
    """
    chart_data = []

    if 'results' not in results:
        return chart_data

    for template_name, template_data in results['results'].items():
        # Check if this is seed range data
        if 'seed_range' in template_data:
            # Handle seed range results
            seeds_passed = template_data.get('seeds_passed', 0)
            seeds_failed = template_data.get('seeds_failed', 0)
            first_failure_seed = template_data.get('first_failure_seed')
            seed_range = template_data.get('seed_range', 'unknown')
            individual_results = template_data.get('individual_results', {})

            # Determine pass/fail and which seed's data to use
            if seeds_failed == 0 and seeds_passed > 0:
                pass_fail = f"Passed seeds {seed_range}"
                if individual_results:
                    first_seed_key = sorted(individual_results.keys(), key=lambda x: int(x) if x.isdigit() else 0)[0]
                    first_result = individual_results[first_seed_key]
                else:
                    first_result = {}
            else:
                if first_failure_seed:
                    pass_fail = f"Failed seed {first_failure_seed}"
                    first_result = individual_results.get(str(first_failure_seed), {})
                else:
                    pass_fail = f"Failed"
                    first_result = {}

            gen_error_count = first_result.get('generation', {}).get('error_count', 0)
            sphere_reached = first_result.get('spoiler_test', {}).get('sphere_reached', 0)
            max_spheres = first_result.get('spoiler_test', {}).get('total_spheres', 0)
            world_info = first_result.get('world_info', {})
            game_name = world_info.get('game_name_from_yaml') or template_name.replace('.yaml', '')
            has_custom_exporter = world_info.get('has_custom_exporter', False)
            has_custom_game_logic = world_info.get('has_custom_game_logic', False)
        else:
            # Handle single seed results
            world_info = template_data.get('world_info', {})
            game_name = world_info.get('game_name_from_yaml')

            if not game_name:
                game_name = template_name.replace('.yaml', '').replace('_', ' ').title()

            original_pass_fail = template_data.get('spoiler_test', {}).get('pass_fail', 'unknown')
            gen_error_count = template_data.get('generation', {}).get('error_count', 0)
            sphere_reached = template_data.get('spoiler_test', {}).get('sphere_reached', 0)
            max_spheres = template_data.get('spoiler_test', {}).get('total_spheres', 0)
            has_custom_exporter = world_info.get('has_custom_exporter', False)
            has_custom_game_logic = world_info.get('has_custom_game_logic', False)

            # Apply stricter pass criteria
            if original_pass_fail.lower() == 'passed' and gen_error_count == 0 and max_spheres > 0:
                pass_fail = 'Passed'
            else:
                pass_fail = 'Failed'

        chart_data.append((game_name, pass_fail, gen_error_count, sphere_reached, max_spheres, has_custom_exporter, has_custom_game_logic))

    chart_data.sort(key=lambda x: x[0])
    return chart_data


def extract_multiplayer_chart_data(results: Dict[str, Any]) -> List[Tuple[str, str, int, int, int, int, int, int, int, bool, bool, bool]]:
    """
    Extract multiplayer test chart data from results.
    Returns list of tuples: (game_name, pass_fail, gen_error_count,
                            client1_checked, client1_manually_checkable, client1_passed,
                            client2_received, client2_total, client2_passed,
                            has_custom_exporter, has_custom_game_logic)
    """
    chart_data = []

    if 'results' not in results:
        return chart_data

    results_data = results['results']
    if isinstance(results_data, dict):
        # New dict-based format - iterate over template names and data
        for template_name, template_data in results_data.items():
            # Extract world info
            world_info = template_data.get('world_info', {})

            # Use game_name_from_yaml if available (matches spoiler test behavior)
            game_name = world_info.get('game_name_from_yaml')
            if not game_name:
                # Fallback to game_name field or template name
                game_name = template_data.get('game_name', template_name.replace('.yaml', ''))

            has_custom_exporter = world_info.get('has_custom_exporter', False)
            has_custom_game_logic = world_info.get('has_custom_game_logic', False)
            gen_error_count = template_data.get('generation', {}).get('error_count', 0)

            multiplayer_test = template_data.get('multiplayer_test', {})
            success = multiplayer_test.get('success', False)

            # Extract new client-specific fields
            client1_checked = multiplayer_test.get('client1_locations_checked', 0)
            client1_manually_checkable = multiplayer_test.get('client1_manually_checkable', 0)
            client1_passed = multiplayer_test.get('client1_passed', False)

            client2_received = multiplayer_test.get('client2_locations_received', 0)
            client2_total = multiplayer_test.get('client2_total_locations', 0)
            client2_passed = multiplayer_test.get('client2_passed', False)

            if success and gen_error_count == 0:
                pass_fail = 'Passed'
            else:
                pass_fail = 'Failed'

            chart_data.append((game_name, pass_fail, gen_error_count,
                             client1_checked, client1_manually_checkable, client1_passed,
                             client2_received, client2_total, client2_passed,
                             has_custom_exporter, has_custom_game_logic))
    else:
        # Old list-based format
        results_list = results_data
        for template_data in results_list:
            game_name = template_data.get('game_name', template_data.get('template_name', 'Unknown').replace('.yaml', ''))
            world_info = template_data.get('world_info', {})
            has_custom_exporter = world_info.get('has_custom_exporter', False)
            has_custom_game_logic = world_info.get('has_custom_game_logic', False)
            gen_error_count = template_data.get('generation', {}).get('error_count', 0)

            multiplayer_test = template_data.get('multiplayer_test', {})
            success = multiplayer_test.get('success', False)

            # Extract new client-specific fields (with fallback to legacy fields)
            client1_checked = multiplayer_test.get('client1_locations_checked', 0)
            client1_manually_checkable = multiplayer_test.get('client1_manually_checkable', 0)
            client1_passed = multiplayer_test.get('client1_passed', False)

            client2_received = multiplayer_test.get('client2_locations_received',
                                                   multiplayer_test.get('locations_checked', 0))
            client2_total = multiplayer_test.get('client2_total_locations',
                                                multiplayer_test.get('total_locations', 0))
            client2_passed = multiplayer_test.get('client2_passed', False)

            if success and gen_error_count == 0:
                pass_fail = 'Passed'
            else:
                pass_fail = 'Failed'

            chart_data.append((game_name, pass_fail, gen_error_count,
                             client1_checked, client1_manually_checkable, client1_passed,
                             client2_received, client2_total, client2_passed,
                             has_custom_exporter, has_custom_game_logic))

    chart_data.sort(key=lambda x: x[0])
    return chart_data


def generate_spoiler_markdown(chart_data: List[Tuple[str, str, int, float, float, bool, bool]],
                              metadata: Dict[str, Any], subtitle: str = "") -> str:
    """Generate a markdown table for spoiler test data."""
    md_content = "# Archipelago Template Test Results Chart\n\n"

    if subtitle:
        md_content += f"## {subtitle}\n\n"

    if metadata:
        md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"

    if chart_data:
        total_games = len(chart_data)
        passed = sum(1 for _, pf, _, _, _, _, _ in chart_data if 'passed' in pf.lower())
        failed = sum(1 for _, pf, _, _, _, _, _ in chart_data if 'failed' in pf.lower())

        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {total_games}\n"
        md_content += f"- **Passed:** {passed} ({passed/total_games*100:.1f}%)\n"
        md_content += f"- **Failed:** {failed} ({failed/total_games*100:.1f}%)\n\n"

    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Test Result | Gen Errors | Sphere Reached | Max Spheres | Progress | Custom Exporter | Custom GameLogic |\n"
    md_content += "|-----------|-------------|------------|----------------|-------------|----------|-----------------|------------------|\n"

    for game_name, pass_fail, gen_error_count, sphere_reached, max_spheres, has_custom_exporter, has_custom_game_logic in chart_data:
        if 'passed' in pass_fail.lower():
            progress = "🟢 Complete"
        elif sphere_reached >= 1.0:
            progress_pct = (sphere_reached / max_spheres) * 100 if max_spheres > 0 else 0
            progress = f"🟡 {progress_pct:.1f}%"
        elif sphere_reached > 0:
            progress_pct = (sphere_reached / max_spheres) * 100 if max_spheres > 0 else 0
            progress = f"🟠 {progress_pct:.1f}%"
        else:
            progress = "🔴 0.0%"

        if 'passed seeds' in pass_fail.lower():
            result_display = f"✅ {pass_fail}"
        elif 'failed seed' in pass_fail.lower():
            result_display = f"❌ {pass_fail}"
        elif pass_fail.lower() == 'passed':
            result_display = "✅ Passed"
        else:
            result_display = "❌ Failed"

        exporter_indicator = "✅" if has_custom_exporter else "⚫"
        game_logic_indicator = "✅" if has_custom_game_logic else "⚫"

        md_content += f"| {game_name} | {result_display} | {gen_error_count} | {sphere_reached:g} | {max_spheres:g} | {progress} | {exporter_indicator} | {game_logic_indicator} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - |\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Gen Errors:** Number of errors during world generation\n"
    md_content += "- **Sphere Reached:** The logical sphere the test reached before completion/failure\n"
    md_content += "- **Max Spheres:** Total logical spheres available in the game\n"
    md_content += "- **Progress:** Percentage of logical spheres completed\n"
    md_content += "- **Custom Exporter:** ✅ Has custom Python exporter script, ⚫ Uses generic exporter\n"
    md_content += "- **Custom GameLogic:** ✅ Has custom JavaScript game logic, ⚫ Uses generic logic\n\n"
    md_content += "**Pass Criteria:** Generation errors = 0, Max spheres > 0, Spoiler test completed successfully\n"

    return md_content


def generate_multiplayer_markdown(chart_data: List[Tuple[str, str, int, int, int, bool, int, int, bool, bool, bool]],
                                 metadata: Dict[str, Any], top_level_metadata: Optional[Dict[str, Any]] = None) -> str:
    """Generate a markdown table for multiplayer test data."""
    md_content = "# Archipelago Template Test Results Chart\n\n"
    md_content += "## Multiplayer Test\n\n"

    # Add generated timestamp
    md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # Add top-level metadata if available (from multiplayer test results)
    if top_level_metadata:
        if 'timestamp' in top_level_metadata and top_level_metadata['timestamp']:
            md_content += f"**Test Timestamp:** {top_level_metadata.get('timestamp')}\n\n"
        if 'test_type' in top_level_metadata and top_level_metadata['test_type']:
            md_content += f"**Test Type:** {top_level_metadata.get('test_type')}\n\n"
        if 'test_mode' in top_level_metadata and top_level_metadata['test_mode']:
            md_content += f"**Test Mode:** {top_level_metadata.get('test_mode')}\n\n"
        if 'seed' in top_level_metadata and top_level_metadata['seed']:
            md_content += f"**Seed:** {top_level_metadata.get('seed')}\n\n"
    # Otherwise add source data metadata if available
    elif metadata and ('created' in metadata or 'last_updated' in metadata):
        if 'created' in metadata:
            md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        if 'last_updated' in metadata:
            md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"

    if chart_data:
        total_games = len(chart_data)
        passed = sum(1 for _, pf, *_ in chart_data if pf.lower() == 'passed')

        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {total_games}\n"
        md_content += f"- **Passed:** {passed} ({passed/total_games*100:.1f}%)\n"
        md_content += f"- **Failed:** {total_games - passed} ({(total_games-passed)/total_games*100:.1f}%)\n\n"

    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Test Result | Gen Errors | Client 1 Status | C1 Checked | C1 Checkable | Client 2 Status | C2 Received | C2 Total | Custom Exporter | Custom GameLogic |\n"
    md_content += "|-----------|-------------|------------|-----------------|------------|--------------|-----------------|-------------|----------|-----------------|------------------|\n"

    for (game_name, pass_fail, gen_error_count,
         client1_checked, client1_manually_checkable, client1_passed,
         client2_received, client2_total, client2_passed,
         has_custom_exporter, has_custom_game_logic) in chart_data:

        result_display = "✅ Passed" if pass_fail.lower() == 'passed' else "❌ Failed"
        client1_status = "✅" if client1_passed else "❌"
        client2_status = "✅" if client2_passed else "❌"
        exporter_indicator = "✅" if has_custom_exporter else "⚫"
        game_logic_indicator = "✅" if has_custom_game_logic else "⚫"

        md_content += f"| {game_name} | {result_display} | {gen_error_count} | {client1_status} | {client1_checked} | {client1_manually_checkable} | {client2_status} | {client2_received} | {client2_total} | {exporter_indicator} | {game_logic_indicator} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - | - | - | - |\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Gen Errors:** Number of errors during world generation\n"
    md_content += "- **Client 1 (Send Test):** Tests sending location checks from Client 1\n"
    md_content += "  - **C1 Checked:** Total locations checked by Client 1 (includes auto-checked events with id=0)\n"
    md_content += "  - **C1 Checkable:** Manually-checkable locations (excludes auto-checked events with id=0)\n"
    md_content += "  - Client 1 passes if all manually-checkable locations are checked\n"
    md_content += "- **Client 2 (Receive Test):** Tests receiving location checks at Client 2\n"
    md_content += "  - **C2 Received:** Number of location checks received by Client 2\n"
    md_content += "  - **C2 Total:** Total locations expected to be received (includes all events)\n"
    md_content += "  - Client 2 passes if all expected locations are received\n"
    md_content += "- **Custom Exporter:** ✅ Has custom Python exporter script, ⚫ Uses generic exporter\n"
    md_content += "- **Custom GameLogic:** ✅ Has custom JavaScript game logic, ⚫ Uses generic logic\n\n"
    md_content += "**Pass Criteria:** A test is marked as ✅ Passed only if:\n"
    md_content += "- Generation errors = 0 (no errors during world generation)\n"
    md_content += "- Client 1 passed (all manually-checkable locations sent)\n"
    md_content += "- Client 2 passed (all expected locations received)\n"
    md_content += "- Both clients completed successfully\n"

    return md_content


def generate_summary_chart(minimal_data, full_data, multiplayer_data) -> str:
    """Generate a combined summary chart with all three test results."""
    md_content = "# Archipelago Template Test Results Summary\n\n"
    md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    md_content += "This summary combines results from three types of tests:\n"
    md_content += "- **Minimal Spoiler Test:** Tests with advancement items only\n"
    md_content += "- **Full Spoiler Test:** Tests with all locations\n"
    md_content += "- **Multiplayer Test:** Tests in multiplayer mode\n\n"

    # Create a unified game list
    games_minimal = {name: result for name, result, *_ in minimal_data}
    games_full = {name: result for name, result, *_ in full_data}
    games_multiplayer = {name: result for name, result, *_ in multiplayer_data}

    all_games = sorted(set(list(games_minimal.keys()) + list(games_full.keys()) + list(games_multiplayer.keys())))

    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Minimal Test | Full Test | Multiplayer Test |\n"
    md_content += "|-----------|--------------|-----------|------------------|\n"

    for game in all_games:
        minimal_result = games_minimal.get(game, "N/A")
        full_result = games_full.get(game, "N/A")
        multiplayer_result = games_multiplayer.get(game, "N/A")

        def format_result(result):
            if result == "N/A":
                return "❓ N/A"
            elif 'passed' in result.lower():
                return "✅ Passed"
            else:
                return "❌ Failed"

        md_content += f"| {game} | {format_result(minimal_result)} | {format_result(full_result)} | {format_result(multiplayer_result)} |\n"

    md_content += "\n## Summary Statistics\n\n"

    def calc_stats(data_dict):
        if not data_dict:
            return 0, 0, 0
        total = len(data_dict)
        passed = sum(1 for r in data_dict.values() if 'passed' in r.lower())
        return total, passed, passed/total*100 if total > 0 else 0

    min_total, min_passed, min_pct = calc_stats(games_minimal)
    full_total, full_passed, full_pct = calc_stats(games_full)
    mp_total, mp_passed, mp_pct = calc_stats(games_multiplayer)

    md_content += f"- **Minimal Test:** {min_passed}/{min_total} passed ({min_pct:.1f}%)\n"
    md_content += f"- **Full Test:** {full_passed}/{full_total} passed ({full_pct:.1f}%)\n"
    md_content += f"- **Multiplayer Test:** {mp_passed}/{mp_total} passed ({mp_pct:.1f}%)\n"

    return md_content


def main():
    parser = argparse.ArgumentParser(description='Generate test results charts from template test results')
    parser.add_argument('--input-file', type=str, help='Input JSON file path (processes only this file)')
    parser.add_argument('--output-file', type=str, help='Output markdown file path')
    parser.add_argument('--test-type', type=str, choices=['minimal', 'full', 'multiplayer'],
                       help='Test type when using --input-file')

    args = parser.parse_args()

    project_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))

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
            md_content = generate_spoiler_markdown(chart_data, metadata, subtitle)
        else:  # multiplayer
            chart_data = extract_multiplayer_chart_data(results)
            # Extract top-level metadata for multiplayer
            top_level = {
                'timestamp': results.get('timestamp'),
                'test_type': results.get('test_type'),
                'test_mode': results.get('test_mode'),
                'seed': results.get('seed')
            }
            md_content = generate_multiplayer_markdown(chart_data, metadata, top_level)

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(md_content)
        print(f"Chart saved to: {output_path}")
        return 0

    # Process all three test types
    print("Processing all test types...")

    # Load minimal spoiler test results
    minimal_input = os.path.join(project_root, 'scripts/output-spoiler-minimal/template-test-results.json')
    minimal_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-spoilers-minimal.md')

    if os.path.exists(minimal_input):
        print(f"Processing minimal spoiler test results...")
        minimal_results = load_test_results(minimal_input)
        minimal_data = extract_spoiler_chart_data(minimal_results)
        minimal_md = generate_spoiler_markdown(minimal_data, minimal_results.get('metadata', {}),
                                              "Spoiler Test - Advancement Items Only")
        os.makedirs(os.path.dirname(minimal_output), exist_ok=True)
        with open(minimal_output, 'w') as f:
            f.write(minimal_md)
        print(f"✓ Minimal spoiler chart saved to: {minimal_output}")
    else:
        print(f"Warning: Minimal spoiler test results not found: {minimal_input}")
        minimal_data = []

    # Load full spoiler test results
    full_input = os.path.join(project_root, 'scripts/output-spoiler-full/template-test-results.json')
    full_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-spoilers-full.md')

    if os.path.exists(full_input):
        print(f"Processing full spoiler test results...")
        full_results = load_test_results(full_input)
        full_data = extract_spoiler_chart_data(full_results)
        full_md = generate_spoiler_markdown(full_data, full_results.get('metadata', {}),
                                           "Spoiler Test - All Locations")
        os.makedirs(os.path.dirname(full_output), exist_ok=True)
        with open(full_output, 'w') as f:
            f.write(full_md)
        print(f"✓ Full spoiler chart saved to: {full_output}")
    else:
        print(f"Warning: Full spoiler test results not found: {full_input}")
        full_data = []

    # Load multiplayer test results
    mp_input = os.path.join(project_root, 'scripts/output-multiplayer/test-results-multiplayer.json')
    mp_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-multiplayer.md')

    if os.path.exists(mp_input):
        print(f"Processing multiplayer test results...")
        mp_results = load_test_results(mp_input)
        mp_data = extract_multiplayer_chart_data(mp_results)
        # Extract top-level metadata for multiplayer
        top_level_mp = {
            'timestamp': mp_results.get('timestamp'),
            'test_type': mp_results.get('test_type'),
            'test_mode': mp_results.get('test_mode'),
            'seed': mp_results.get('seed')
        }
        mp_md = generate_multiplayer_markdown(mp_data, mp_results.get('metadata', {}), top_level_mp)
        os.makedirs(os.path.dirname(mp_output), exist_ok=True)
        with open(mp_output, 'w') as f:
            f.write(mp_md)
        print(f"✓ Multiplayer chart saved to: {mp_output}")
    else:
        print(f"Warning: Multiplayer test results not found: {mp_input}")
        mp_data = []

    # Generate summary chart
    if minimal_data or full_data or mp_data:
        print(f"Generating summary chart...")
        summary_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-summary.md')
        summary_md = generate_summary_chart(minimal_data, full_data, mp_data)
        with open(summary_output, 'w') as f:
            f.write(summary_md)
        print(f"✓ Summary chart saved to: {summary_output}")

    print("\n=== Chart Generation Complete ===")
    return 0


if __name__ == '__main__':
    exit(main())
