#!/usr/bin/env python3
"""
Script to generate charts from Universal Tracker fuzzer test results.

This script reads UT fuzz test results from JSON files and generates
markdown reports showing the fuzz test status for each game template.

The UT fuzz test validates that Universal Tracker's accessibility
calculations match the Python-generated sphere log across many random
option configurations.
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load the UT fuzz test results from JSON file."""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading results file {results_file}: {e}")
        return {}


def load_world_mapping(project_root: str) -> Dict[str, str]:
    """
    Load the world mapping from JSON file.

    Returns a dict mapping game names to world directory names.
    """
    mapping_file = os.path.join(project_root, 'scripts/data/world-mapping.json')
    try:
        with open(mapping_file, 'r') as f:
            data = json.load(f)
            return {game_name: info['world_directory']
                    for game_name, info in data.items()
                    if 'world_directory' in info}
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not load world mapping file {mapping_file}: {e}")
        return {}


def extract_ut_fuzz_chart_data(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract UT fuzz test chart data from results.

    Returns list of dicts with:
        - game_name: str
        - world_directory: str
        - passed: bool
        - total: int
        - success: int
        - failure: int
        - timeout: int
        - ignored: int
        - success_rate: float
        - errors: dict
        - explain_stats: dict (optional) with explain support statistics
    """
    chart_data = []

    if 'results' not in results:
        return chart_data

    for template_filename, template_data in results['results'].items():
        world_info = template_data.get('world_info', {})
        game_name = world_info.get('game_name')
        world_directory = world_info.get('world_directory')

        if not game_name:
            game_name = template_filename.replace('.yaml', '').replace('_', ' ').title()

        ut_fuzz = template_data.get('ut_fuzz', {})
        passed = ut_fuzz.get('passed', False)
        total = ut_fuzz.get('total', 0)
        success = ut_fuzz.get('success', 0)
        failure = ut_fuzz.get('failure', 0)
        timeout = ut_fuzz.get('timeout', 0)
        ignored = ut_fuzz.get('ignored', 0)
        errors = ut_fuzz.get('errors', {})

        success_rate = (success / total * 100) if total > 0 else 0

        # Extract explain stats if available
        explain_stats = template_data.get('explain_stats')

        chart_data.append({
            'game_name': game_name,
            'world_directory': world_directory,
            'passed': passed,
            'total': total,
            'success': success,
            'failure': failure,
            'timeout': timeout,
            'ignored': ignored,
            'success_rate': success_rate,
            'errors': errors,
            'explain_stats': explain_stats
        })

    chart_data.sort(key=lambda x: x['game_name'])
    return chart_data


def generate_ut_fuzz_markdown(chart_data: List[Dict[str, Any]],
                               metadata: Dict[str, Any],
                               world_mapping: Dict[str, str]) -> str:
    """
    Generate a markdown table for UT fuzz test data.

    Args:
        chart_data: List of test result data dicts
        metadata: Metadata from the test results
        world_mapping: Mapping of game names to world directories
    """
    # Determine seed info and UT version
    seed = metadata.get('seed', 'random')
    seed_display = f"Fixed (seed={seed})" if seed != 'random' else "Random"
    ut_version = metadata.get('ut_version', 'modified')
    ut_version_display = "Original (FarisTheAncient)" if ut_version == 'original' else "Modified (this repository)"

    # Title includes UT version if it's original
    if ut_version == 'original':
        md_content = "# Universal Tracker Fuzz Test Results (Original UT)\n\n"
    else:
        md_content = "# Universal Tracker Fuzz Test Results\n\n"

    # Add navigation links
    md_content += "[<- Back to Test Results Summary](./test-results-summary.md)\n\n"

    if metadata:
        md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"
        md_content += f"**Universal Tracker Version:** {ut_version_display}\n\n"
        md_content += f"**Seed Mode:** {seed_display}\n\n"
        md_content += f"**Runs Per Game:** {metadata.get('runs_per_game', 'Unknown')}\n\n"
        md_content += f"**Parallel Jobs:** {metadata.get('jobs', 'Unknown')}\n\n"
        md_content += f"**Timeout Per Generation:** {metadata.get('timeout', 'Unknown')}s\n\n"

    if chart_data:
        total_games = len(chart_data)
        passed = sum(1 for d in chart_data if d['passed'])
        failed = total_games - passed

        total_runs = sum(d['total'] for d in chart_data)
        total_success = sum(d['success'] for d in chart_data)
        total_failure = sum(d['failure'] for d in chart_data)
        total_timeout = sum(d['timeout'] for d in chart_data)
        total_ignored = sum(d['ignored'] for d in chart_data)

        overall_success_rate = (total_success / total_runs * 100) if total_runs > 0 else 0

        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {total_games}\n"
        md_content += f"- **Games with 100% Pass Rate:** {passed} ({passed/total_games*100:.1f}%)\n"
        md_content += f"- **Games with Failures:** {failed} ({failed/total_games*100:.1f}%)\n"
        md_content += f"- **Total Fuzz Runs:** {total_runs}\n"
        md_content += f"- **Successful Runs:** {total_success} ({overall_success_rate:.1f}%)\n"
        md_content += f"- **Failed Runs:** {total_failure}\n"
        md_content += f"- **Timed Out Runs:** {total_timeout}\n"
        md_content += f"- **Ignored Runs:** {total_ignored}\n\n"

        # Add explain stats summary if available
        games_with_explain_stats = [d for d in chart_data if d.get('explain_stats')]
        if games_with_explain_stats:
            total_locs_with_explain = sum(d['explain_stats'].get('locations_with_explain', 0) for d in games_with_explain_stats)
            total_locs_without_explain = sum(d['explain_stats'].get('locations_without_explain', 0) for d in games_with_explain_stats)
            total_locs_default = sum(d['explain_stats'].get('locations_default_rule', 0) for d in games_with_explain_stats)
            total_custom_locs = total_locs_with_explain + total_locs_without_explain

            games_full_explain = sum(1 for d in games_with_explain_stats if d['explain_stats'].get('explain_coverage_percent', 0) == 100)
            games_no_explain = sum(1 for d in games_with_explain_stats if d['explain_stats'].get('locations_with_explain', 0) == 0 and d['explain_stats'].get('locations_without_explain', 0) > 0)

            overall_explain_coverage = (total_locs_with_explain / total_custom_locs * 100) if total_custom_locs > 0 else 100

            md_content += "### Explain Support Summary\n\n"
            md_content += f"- **Games with Explain Stats:** {len(games_with_explain_stats)}\n"
            md_content += f"- **Games with 100% Explain Coverage:** {games_full_explain}\n"
            md_content += f"- **Games with No Explain Support:** {games_no_explain}\n"
            md_content += f"- **Locations with Explain Support:** {total_locs_with_explain:,}\n"
            md_content += f"- **Locations without Explain Support:** {total_locs_without_explain:,}\n"
            md_content += f"- **Locations with Default Rule:** {total_locs_default:,}\n"
            md_content += f"- **Overall Explain Coverage:** {overall_explain_coverage:.1f}%\n\n"

    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate |\n"
    md_content += "|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|\n"

    for data in chart_data:
        game_name = data['game_name']
        world_dir = data.get('world_directory') or world_mapping.get(game_name)

        # Create link to game in frontend
        if world_dir:
            game_link = f"[{game_name}](https://peerinfinity.github.io/Archipelago-CC/?mode=test-spoilers-headed&game={world_dir})"
        else:
            game_link = game_name

        passed = data['passed']
        total = data['total']
        success = data['success']
        failure = data['failure']
        timeout = data['timeout']
        ignored = data['ignored']
        success_rate = data['success_rate']

        # Test result: green checkmark or red X
        result_display = "✅" if passed else "❌"

        # Success rate with color coding
        if success_rate == 100:
            rate_display = f"**{success_rate:.1f}%**"
        elif success_rate >= 90:
            rate_display = f"{success_rate:.1f}%"
        elif success_rate >= 50:
            rate_display = f"⚠️ {success_rate:.1f}%"
        else:
            rate_display = f"❌ {success_rate:.1f}%"

        md_content += f"| {game_link} | {result_display} | {total} | {success} | {failure} | {timeout} | {ignored} | {rate_display} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - |\n"

    # Add error details section if there are any failures
    games_with_errors = [d for d in chart_data if d['failure'] > 0 or d.get('errors')]
    if games_with_errors:
        md_content += "\n## Error Details\n\n"
        for data in games_with_errors:
            game_name = data['game_name']
            errors = data.get('errors', {})
            if errors:
                md_content += f"### {game_name}\n\n"
                for error_type, occurrences in errors.items():
                    if isinstance(occurrences, list):
                        md_content += f"- **{error_type}**: {len(occurrences)} occurrence(s)\n"
                    else:
                        md_content += f"- **{error_type}**: {occurrences}\n"
                md_content += "\n"

    # Add explain support section if data is available
    games_with_explain_stats = [d for d in chart_data if d.get('explain_stats')]
    if games_with_explain_stats:
        md_content += "\n## Explain Support Details\n\n"
        md_content += "This section shows which games have rules that support the `explain_json()` method, "
        md_content += "which provides human-readable explanations of access rule logic.\n\n"
        md_content += "| Game Name | Total Locs | With Explain | Without Explain | Default Rule | Coverage |\n"
        md_content += "|-----------|:----------:|:------------:|:---------------:|:------------:|:--------:|\n"

        # Sort by explain coverage (ascending to highlight games needing work)
        sorted_explain_data = sorted(games_with_explain_stats,
                                     key=lambda x: x['explain_stats'].get('explain_coverage_percent', 100))

        for data in sorted_explain_data:
            game_name = data['game_name']
            stats = data['explain_stats']
            total_locs = stats.get('total_locations', 0)
            with_explain = stats.get('locations_with_explain', 0)
            without_explain = stats.get('locations_without_explain', 0)
            default_rule = stats.get('locations_default_rule', 0)
            coverage = stats.get('explain_coverage_percent', 100)

            # Format coverage with indicator
            if coverage == 100:
                coverage_display = f"✅ {coverage:.0f}%"
            elif coverage >= 50:
                coverage_display = f"⚠️ {coverage:.0f}%"
            elif coverage > 0:
                coverage_display = f"🔶 {coverage:.0f}%"
            else:
                coverage_display = f"❌ {coverage:.0f}%"

            md_content += f"| {game_name} | {total_locs} | {with_explain} | {without_explain} | {default_rule} | {coverage_display} |\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Result:** ✅ if all fuzz runs passed (0 failures, 0 timeouts), ❌ otherwise\n"
    md_content += "- **Total:** Number of fuzz runs attempted for this game\n"
    md_content += "- **Success:** Number of runs where UT matched Python sphere log\n"
    md_content += "- **Failure:** Number of runs where UT mismatched or encountered errors\n"
    md_content += "- **Timeout:** Number of runs that exceeded the time limit\n"
    md_content += "- **Ignored:** Number of runs skipped due to option errors\n"
    md_content += "- **Success Rate:** Percentage of successful runs\n\n"

    if games_with_explain_stats:
        md_content += "### Explain Support Columns\n\n"
        md_content += "- **Total Locs:** Total number of locations with addresses (excludes events)\n"
        md_content += "- **With Explain:** Locations with rules that have `explain_json()` support\n"
        md_content += "- **Without Explain:** Locations with custom rules but no explain support (lambdas/functions)\n"
        md_content += "- **Default Rule:** Locations with no access rule set (always accessible)\n"
        md_content += "- **Coverage:** Percentage of custom-rule locations that have explain support\n\n"

    md_content += "### About This Test\n\n"
    md_content += "The UT fuzzer tests Universal Tracker compatibility by:\n"
    md_content += "1. Generating random game configurations (YAML options)\n"
    md_content += "2. Creating an Archipelago seed with those options\n"
    md_content += "3. Exporting the seed to JSON rules\n"
    md_content += "4. Regenerating the world using the world generator\n"
    md_content += "5. Comparing UT's accessibility calculations to the Python sphere log\n\n"
    md_content += "Failures indicate that for certain option combinations, UT's logic "
    md_content += "differs from Python's logic. This helps identify edge cases that need fixing.\n"

    return md_content


def find_result_files(results_dir: str) -> List[str]:
    """
    Find all UT fuzz result files in the results directory.

    Looks for files matching patterns:
    - test-results-{world_source}-{ut_version}-{seed_type}-seed.json (new with world_source)
    - test-results-{ut_version}-{seed_type}-seed.json (bundled worlds format)
    - test-results-{seed_type}-seed.json (old format, for backward compatibility)
    """
    import glob

    result_files = []

    # Match all test-results-*-seed.json files
    pattern = os.path.join(results_dir, 'test-results-*-seed.json')
    for f in glob.glob(pattern):
        basename = os.path.basename(f)
        # Skip split files (used during workflow, not final results)
        if '-split-' in basename:
            continue
        result_files.append(f)

    return sorted(result_files)


def get_output_filename(results_path: str) -> str:
    """
    Generate output markdown filename based on results file.

    Examples:
    - test-results-apworlds-modified-fixed-seed.json -> test-results-ut-fuzz-apworlds-modified.md
    - test-results-modified-fixed-seed.json -> test-results-ut-fuzz-modified.md
    - test-results-original-fixed-seed.json -> test-results-ut-fuzz-original.md
    - test-results-fixed-seed.json -> test-results-ut-fuzz.md (old format)
    """
    basename = os.path.basename(results_path)
    parts = basename.replace('.json', '').split('-')

    # Format with world_source: test-results-{world_source}-{ut_version}-{seed_type}-seed
    if len(parts) == 6:  # ['test', 'results', 'apworlds', 'modified', 'fixed', 'seed']
        world_source = parts[2]
        ut_version = parts[3]
        return f'test-results-ut-fuzz-{world_source}-{ut_version}.md'
    # Bundled format: test-results-{ut_version}-{seed_type}-seed
    elif len(parts) == 5:  # ['test', 'results', 'modified', 'fixed', 'seed']
        ut_version = parts[2]
        return f'test-results-ut-fuzz-{ut_version}.md'
    else:
        # Old format or unexpected format
        return 'test-results-ut-fuzz.md'


def main():
    parser = argparse.ArgumentParser(description='Generate UT fuzz test results chart')
    parser.add_argument('--results', type=str,
                        help='Path to test results JSON (if not specified, processes all found files)')
    parser.add_argument('--output', type=str,
                        help='Output markdown file path')

    args = parser.parse_args()

    # Script is at scripts/docs/generate_ut_fuzz_chart.py, go up 2 levels to reach project root
    project_root = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

    # Load world mapping for creating game links
    world_mapping = load_world_mapping(project_root)

    # Output directory
    output_dir = os.path.join(project_root, 'docs/json/developer/test-results')
    os.makedirs(output_dir, exist_ok=True)

    # Find result files
    results_dir = os.path.join(project_root, 'scripts/output/ut-fuzz')

    if args.results:
        # Single file mode
        results_path = os.path.join(project_root, args.results) if not os.path.isabs(args.results) else args.results
        result_files = [results_path]
    else:
        # Find all result files
        result_files = find_result_files(results_dir)

    if not result_files:
        print(f"Error: No result files found in {results_dir}")
        return 1

    # Process each result file
    for results_path in result_files:
        if not os.path.exists(results_path):
            print(f"Warning: Results file not found: {results_path}")
            continue

        results = load_test_results(results_path)
        if not results:
            print(f"Warning: Failed to load results from {results_path}")
            continue

        metadata = results.get('metadata', {})
        chart_data = extract_ut_fuzz_chart_data(results)

        # Generate markdown
        md_content = generate_ut_fuzz_markdown(chart_data, metadata, world_mapping)

        # Determine output path
        if args.output and len(result_files) == 1:
            output_path = os.path.join(project_root, args.output) if not os.path.isabs(args.output) else args.output
        else:
            output_filename = get_output_filename(results_path)
            output_path = os.path.join(output_dir, output_filename)

        # Write output
        with open(output_path, 'w') as f:
            f.write(md_content)

        print(f"Chart saved to: {output_path} (from {os.path.basename(results_path)})")

    return 0


if __name__ == '__main__':
    exit(main())
