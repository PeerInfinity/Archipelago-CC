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

# Add parent directory to path to import from chart_generators and lib
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from chart_generators.utils import format_file_size, get_rules_json_size
from lib.test_utils import load_template_exclude_list


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load the UT fuzz test results from JSON file."""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading results file {results_file}: {e}")
        return {}


def load_world_mapping(project_root: str) -> Dict[str, Dict[str, Any]]:
    """
    Load the world mapping from JSON files.

    Loads both world-mapping.json (official/bundled worlds) and
    world-mapping-unofficial.json (apworlds) if they exist.
    Unofficial mapping takes precedence for any conflicts.

    Returns the full world mapping dict with all game info including
    world_directory, exporter_size, game_logic_size, etc.
    """
    mapping = {}

    # Load official world mapping
    official_file = os.path.join(project_root, 'scripts/data/world-mapping.json')
    try:
        with open(official_file, 'r') as f:
            mapping = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not load official world mapping file {official_file}: {e}")

    # Load unofficial world mapping (apworlds) and merge
    unofficial_file = os.path.join(project_root, 'scripts/data/world-mapping-unofficial.json')
    try:
        with open(unofficial_file, 'r') as f:
            unofficial_mapping = json.load(f)
            mapping.update(unofficial_mapping)
            print(f"Loaded {len(unofficial_mapping)} entries from unofficial world mapping")
    except FileNotFoundError:
        pass  # Unofficial mapping is optional
    except json.JSONDecodeError as e:
        print(f"Warning: Could not parse unofficial world mapping file {unofficial_file}: {e}")

    return mapping


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
            'template_file': template_filename,
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
                               world_mapping: Dict[str, Dict[str, Any]],
                               project_root: str = None,
                               world_source: str = "bundled",
                               excluded_games: Dict[str, str] = None) -> str:
    """
    Generate a markdown table for UT fuzz test data.

    Args:
        chart_data: List of test result data dicts
        metadata: Metadata from the test results
        world_mapping: Full world mapping dict with game info
        project_root: Project root path for looking up rules.json sizes
        world_source: Source of worlds (bundled or apworlds)
        excluded_games: Dict mapping game names to exclusion reasons (for apworlds)
    """
    # Determine seed info and UT version
    seed = metadata.get('seed', 'random')
    seed_display = f"Fixed (seed={seed})" if seed != 'random' else "Random"
    ut_version = metadata.get('ut_version', 'modified')

    # Map ut_version to display strings
    if ut_version == 'original':
        ut_version_display = "Original (FarisTheAncient)"
        title_suffix = " (Original UT)"
    elif ut_version == 'hybrid':
        ut_version_display = "Hybrid (modified with native UT preference)"
        title_suffix = " (Hybrid)"
    else:
        ut_version_display = "Modified (worldgen-based tracking)"
        title_suffix = ""

    # Title includes UT version if it's not the default modified
    md_content = f"# Universal Tracker Fuzz Test Results{title_suffix}\n\n"

    # Add navigation links
    md_content += "[<- Back to Test Results Summary](./test-results-summary.md)\n\n"

    # Add link to comparison docs
    if world_source == "apworlds":
        md_content += "[View Comparison (Original vs Modified)](./test-results-ut-fuzz-apworlds-comparison.md) | "
        md_content += "[View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-apworlds-hybrid-comparison.md)\n\n"
    else:
        md_content += "[View Comparison (Original vs Modified)](./test-results-ut-fuzz-comparison.md) | "
        md_content += "[View Comparison (Original vs Hybrid)](./test-results-ut-fuzz-hybrid-comparison.md)\n\n"

    if metadata:
        md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"
        md_content += f"**Universal Tracker Version:** {ut_version_display}\n\n"
        md_content += f"**Seed Mode:** {seed_display}\n\n"
        md_content += f"**Runs Per Game:** {metadata.get('runs_per_game', 'Unknown')}\n\n"
        md_content += f"**Parallel Jobs:** {metadata.get('jobs', 'Unknown')}\n\n"
        md_content += f"**Timeout Per Generation:** {metadata.get('timeout', 'Unknown')}s\n\n"

    # Track unexpected pass/fail game names for listing later
    unexpected_pass_games = []
    unexpected_fail_games = []  # Games with actual logic failures
    unexpected_fail_timeout_only_games = []  # Games that only failed due to timeouts

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

        # Add expected/unexpected pass/fail categorization (only for modified UT)
        if excluded_games and ut_version == 'modified':
            # Build set of excluded template names for matching
            excluded_templates = set(excluded_games.keys())

            expected_passes = 0
            unexpected_passes = 0
            expected_failures = 0
            unexpected_failures_logic = 0  # Actual logic failures
            unexpected_failures_timeout_only = 0  # Only timeouts, no logic failures

            for d in chart_data:
                game_name = d['game_name']
                template_file = d.get('template_file', '')
                is_excluded = template_file in excluded_templates
                is_passing = d['passed']
                has_logic_failures = d.get('failure', 0) > 0

                if is_excluded:
                    if is_passing:
                        unexpected_passes += 1
                        unexpected_pass_games.append(game_name)
                    else:
                        expected_failures += 1
                else:
                    if is_passing:
                        expected_passes += 1
                    else:
                        if has_logic_failures:
                            unexpected_failures_logic += 1
                            unexpected_fail_games.append(game_name)
                        else:
                            unexpected_failures_timeout_only += 1
                            unexpected_fail_timeout_only_games.append(game_name)

            md_content += "### Expected vs Unexpected Results\n\n"
            md_content += f"- **Expected Passes:** {expected_passes} (not excluded, passed)\n"
            md_content += f"- **Unexpected Passes:** {unexpected_passes} (excluded, but passed)\n"
            md_content += f"- **Expected Failures:** {expected_failures} (excluded, failed as expected)\n"
            md_content += f"- **Unexpected Failures (logic):** {unexpected_failures_logic} (not excluded, logic mismatch)\n"
            md_content += f"- **Unexpected Failures (timeout only):** {unexpected_failures_timeout_only} (not excluded, only timeouts)\n\n"

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

        # Add Generic Exporter/Logic Statistics section
        passed_with_generic_exporter = 0
        passed_with_generic_logic = 0
        passed_with_both_generic = 0
        total_exporter_size = 0
        total_logic_size = 0

        for data in chart_data:
            game_name = data['game_name']
            is_passing = data['passed']

            # Get exporter and logic info from world_mapping
            has_custom_exporter = False
            has_custom_logic = False
            exporter_size = 0
            logic_size = 0

            if game_name in world_mapping:
                exporter_size = world_mapping[game_name].get('exporter_size', 0)
                logic_size = world_mapping[game_name].get('game_logic_size', 0)
                has_custom_exporter = exporter_size > 0
                has_custom_logic = logic_size > 0
                total_exporter_size += exporter_size
                total_logic_size += logic_size

            if is_passing:
                if not has_custom_exporter:
                    passed_with_generic_exporter += 1
                if not has_custom_logic:
                    passed_with_generic_logic += 1
                if not has_custom_exporter and not has_custom_logic:
                    passed_with_both_generic += 1

        md_content += "### Generic Exporter/Logic Statistics\n\n"
        md_content += f"Of the {passed} games with 100% pass rate:\n\n"
        if passed > 0:
            md_content += f"- **Passing with Generic Exporter:** {passed_with_generic_exporter}/{passed} ({passed_with_generic_exporter/passed*100:.1f}%)\n"
            md_content += f"- **Passing with Generic Logic:** {passed_with_generic_logic}/{passed} ({passed_with_generic_logic/passed*100:.1f}%)\n"
            md_content += f"- **Passing with Both Generic:** {passed_with_both_generic}/{passed} ({passed_with_both_generic/passed*100:.1f}%)\n"
        else:
            md_content += f"- **Passing with Generic Exporter:** 0/0\n"
            md_content += f"- **Passing with Generic Logic:** 0/0\n"
            md_content += f"- **Passing with Both Generic:** 0/0\n"

        md_content += f"\n**Combined Custom Code Size:**\n\n"
        md_content += f"- **Total Exporter Code:** {total_exporter_size / 1024:.1f}KB\n"
        md_content += f"- **Total Game Logic Code:** {total_logic_size / 1024:.1f}KB\n"
        md_content += f"- **Combined Total:** {(total_exporter_size + total_logic_size) / 1024:.1f}KB\n\n"

    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Result | Total | Success | Failure | Timeout | Ignored | Success Rate | Exporter | GameLogic | Rules Size |\n"
    md_content += "|-----------|:------:|:-----:|:-------:|:-------:|:-------:|:-------:|:------------:|:--------:|:---------:|:----------:|\n"

    for data in chart_data:
        game_name = data['game_name']
        world_dir = data.get('world_directory')

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

        # Get exporter and game logic sizes from world mapping
        exporter_indicator = "N/A"
        logic_indicator = "N/A"
        if game_name in world_mapping:
            exporter_size = world_mapping[game_name].get('exporter_size', 0)
            game_logic_size = world_mapping[game_name].get('game_logic_size', 0)
            exporter_indicator = format_file_size(exporter_size)
            logic_indicator = format_file_size(game_logic_size)

        # Get rules.json size
        rules_size_indicator = "N/A"
        if project_root and world_dir:
            rules_size = get_rules_json_size(project_root, world_dir)
            if rules_size > 0:
                rules_size_indicator = f"{rules_size / 1024:.1f}KB"

        md_content += f"| {game_name} | {result_display} | {total} | {success} | {failure} | {timeout} | {ignored} | {rate_display} | {exporter_indicator} | {logic_indicator} | {rules_size_indicator} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - | - | - | - |\n"

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
    md_content += "- **Success Rate:** Percentage of successful runs\n"
    md_content += "- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script\n"
    md_content += "- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files\n"
    md_content += "- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)\n"
    md_content += "\n"

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

    # Add Excluded Templates section (only for modified UT)
    if excluded_games and ut_version == 'modified':
        if world_source == "apworlds":
            md_content += "\n## Excluded APWorlds\n\n"
            md_content += "These community APWorlds are excluded from UT fuzz testing due to incompatible rule patterns or APWorld bugs:\n\n"
            md_content += "| APWorld | Reason |\n"
            md_content += "|---------|--------|\n"
        else:
            md_content += "\n## Excluded Templates\n\n"
            md_content += "These templates are excluded from testing:\n\n"
            md_content += "| Template | Reason |\n"
            md_content += "|----------|--------|\n"
        for game, reason in sorted(excluded_games.items()):
            md_content += f"| {game} | {reason} |\n"

        # Add lists of unexpected passes and failures
        if unexpected_pass_games:
            md_content += "\n### Unexpected Passes\n\n"
            for game in sorted(unexpected_pass_games):
                md_content += f"- {game}\n"

        if unexpected_fail_games:
            md_content += "\n### Unexpected Failures (Logic Mismatch)\n\n"
            md_content += "These games have actual logic mismatches between UT and Python:\n\n"
            for game in sorted(unexpected_fail_games):
                md_content += f"- {game}\n"

        if unexpected_fail_timeout_only_games:
            md_content += "\n### Unexpected Failures (Timeout Only)\n\n"
            md_content += "These games failed only due to timeouts, not logic mismatches:\n\n"
            for game in sorted(unexpected_fail_timeout_only_games):
                md_content += f"- {game}\n"

    return md_content


def generate_comparison_markdown(original_data: List[Dict[str, Any]],
                                  modified_data: List[Dict[str, Any]],
                                  world_mapping: Dict[str, Dict[str, Any]],
                                  project_root: str = None,
                                  world_source: str = "bundled",
                                  compare_version: str = "modified") -> str:
    """
    Generate a markdown comparison between original and another UT fuzz test results.

    Args:
        original_data: Chart data from original UT tests
        modified_data: Chart data from the comparison UT tests (modified or hybrid)
        world_mapping: Full world mapping dict with game info
        project_root: Project root path for looking up rules.json sizes
        world_source: Source of worlds being tested (bundled or apworlds)
        compare_version: Version being compared to original ('modified' or 'hybrid')
    """
    # Build lookup dicts by game name
    original_by_game = {d['game_name']: d for d in original_data}
    modified_by_game = {d['game_name']: d for d in modified_data}

    # Determine display names based on compare_version
    if compare_version == 'hybrid':
        compare_display = "Hybrid"
        compare_description = "Hybrid Universal Tracker (modified with native UT preference)"
    else:
        compare_display = "Modified"
        compare_description = "Modified Universal Tracker (worldgen-based tracking)"

    # Get all unique game names
    all_games = sorted(set(original_by_game.keys()) | set(modified_by_game.keys()))

    # Categorize games
    passing_both = []
    passing_original_only = []
    passing_compare_only = []  # Renamed from passing_modified_only
    passing_neither = []

    for game in all_games:
        orig = original_by_game.get(game)
        mod = modified_by_game.get(game)

        orig_passed = orig['passed'] if orig else False
        mod_passed = mod['passed'] if mod else False

        if orig_passed and mod_passed:
            passing_both.append(game)
        elif orig_passed and not mod_passed:
            passing_original_only.append(game)
        elif not orig_passed and mod_passed:
            passing_compare_only.append(game)
        else:
            passing_neither.append(game)

    # Helper to get exporter/logic/rules info for a game
    def get_game_info(game_name: str) -> tuple:
        """Returns (exporter_indicator, logic_indicator, rules_size_indicator)"""
        exporter_indicator = "N/A"
        logic_indicator = "N/A"
        rules_size_indicator = "N/A"

        if game_name in world_mapping:
            exporter_size = world_mapping[game_name].get('exporter_size', 0)
            game_logic_size = world_mapping[game_name].get('game_logic_size', 0)
            exporter_indicator = format_file_size(exporter_size)
            logic_indicator = format_file_size(game_logic_size)

            world_dir = world_mapping[game_name].get('world_directory')
            if project_root and world_dir:
                rules_size = get_rules_json_size(project_root, world_dir)
                if rules_size > 0:
                    rules_size_indicator = f"{rules_size / 1024:.1f}KB"

        return exporter_indicator, logic_indicator, rules_size_indicator

    # Helper to check if a game has no custom exporter or game logic
    def has_no_custom_code(game_name: str) -> bool:
        """Returns True if the game uses generic exporter AND generic game logic."""
        if game_name not in world_mapping:
            return False
        exporter_size = world_mapping[game_name].get('exporter_size', 0)
        game_logic_size = world_mapping[game_name].get('game_logic_size', 0)
        return exporter_size == 0 and game_logic_size == 0

    # Calculate games passing compare version (both + compare only) with no custom code
    passing_compare = passing_both + passing_compare_only
    passing_compare_no_custom = [g for g in passing_compare if has_no_custom_code(g)]
    passing_compare_only_no_custom = [g for g in passing_compare_only if has_no_custom_code(g)]

    # Start building markdown
    title_suffix = " (APWorlds)" if world_source == "apworlds" else ""
    md_content = f"# Universal Tracker Fuzz Test Comparison: Original vs {compare_display}{title_suffix}\n\n"
    md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    md_content += "This report compares fuzz test results between the Original Universal Tracker "
    md_content += f"(FarisTheAncient) and the {compare_description}.\n\n"

    # Add navigation links
    md_content += "[<- Back to Test Results Summary](./test-results-summary.md)\n\n"

    # Add links to individual result docs
    md_content += "### Individual Test Results\n\n"
    if world_source == "apworlds":
        md_content += "- [Original UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-original.md)\n"
        md_content += f"- [{compare_display} UT Results (APWorlds)](./test-results-ut-fuzz-apworlds-{compare_version}.md)\n\n"
    else:
        md_content += "- [Original UT Results](./test-results-ut-fuzz-original.md)\n"
        md_content += f"- [{compare_display} UT Results](./test-results-ut-fuzz-{compare_version}.md)\n\n"

    # Summary statistics
    md_content += "## Summary\n\n"
    md_content += f"- **Total Games Tested:** {len(all_games)}\n"
    md_content += f"- **Passing Both:** {len(passing_both)} ({len(passing_both)/len(all_games)*100:.1f}%)\n"
    md_content += f"- **Passing Original Only:** {len(passing_original_only)} ({len(passing_original_only)/len(all_games)*100:.1f}%)\n"
    md_content += f"- **Passing {compare_display} Only:** {len(passing_compare_only)} ({len(passing_compare_only)/len(all_games)*100:.1f}%)\n"
    md_content += f"- **Passing Neither:** {len(passing_neither)} ({len(passing_neither)/len(all_games)*100:.1f}%)\n"
    # Only show custom code stats for bundled worlds (not apworlds)
    if world_source != "apworlds":
        md_content += f"- **Passing {compare_display} with no custom code:** {len(passing_compare_no_custom)} ({len(passing_compare_no_custom)/len(all_games)*100:.1f}%)\n"
        md_content += f"- **Passing {compare_display} Only with no custom code:** {len(passing_compare_only_no_custom)} ({len(passing_compare_only_no_custom)/len(all_games)*100:.1f}%)\n"
    md_content += "\n"

    # Main comparison table
    md_content += "## Full Comparison\n\n"
    md_content += f"| Game Name | Original Success Rate | {compare_display} Success Rate | Exporter | GameLogic | Rules Size |\n"
    md_content += "|-----------|:---------------------:|:---------------------:|:--------:|:---------:|:----------:|\n"

    for game in all_games:
        orig = original_by_game.get(game)
        mod = modified_by_game.get(game)

        # Format success rates
        if orig:
            orig_rate = orig['success_rate']
            if orig['passed']:
                orig_display = f"✅ {orig_rate:.1f}%"
            elif orig_rate >= 50:
                orig_display = f"⚠️ {orig_rate:.1f}%"
            else:
                orig_display = f"❌ {orig_rate:.1f}%"
        else:
            orig_display = "N/A"

        if mod:
            mod_rate = mod['success_rate']
            if mod['passed']:
                mod_display = f"✅ {mod_rate:.1f}%"
            elif mod_rate >= 50:
                mod_display = f"⚠️ {mod_rate:.1f}%"
            else:
                mod_display = f"❌ {mod_rate:.1f}%"
        else:
            mod_display = "N/A"

        exporter, logic, rules_size = get_game_info(game)
        md_content += f"| {game} | {orig_display} | {mod_display} | {exporter} | {logic} | {rules_size} |\n"

    # Games passing both
    if passing_both:
        md_content += f"\n## Games Passing Both ({len(passing_both)})\n\n"
        md_content += "These games have 100% success rate in both Universal Tracker versions.\n\n"
        md_content += "| Game Name | Exporter | GameLogic | Rules Size |\n"
        md_content += "|-----------|:--------:|:---------:|:----------:|\n"
        for game in passing_both:
            exporter, logic, rules_size = get_game_info(game)
            md_content += f"| {game} | {exporter} | {logic} | {rules_size} |\n"

    # Games passing original only
    if passing_original_only:
        md_content += f"\n## Games Passing Original Only ({len(passing_original_only)})\n\n"
        md_content += f"These games pass in the Original UT but fail in the {compare_display} UT.\n\n"
        md_content += "| Game Name | Exporter | GameLogic | Rules Size |\n"
        md_content += "|-----------|:--------:|:---------:|:----------:|\n"
        for game in passing_original_only:
            exporter, logic, rules_size = get_game_info(game)
            md_content += f"| {game} | {exporter} | {logic} | {rules_size} |\n"

    # Games passing compare version only
    if passing_compare_only:
        md_content += f"\n## Games Passing {compare_display} Only ({len(passing_compare_only)})\n\n"
        md_content += f"These games pass in the {compare_display} UT but fail in the Original UT.\n\n"
        md_content += "| Game Name | Exporter | GameLogic | Rules Size |\n"
        md_content += "|-----------|:--------:|:---------:|:----------:|\n"
        for game in passing_compare_only:
            exporter, logic, rules_size = get_game_info(game)
            md_content += f"| {game} | {exporter} | {logic} | {rules_size} |\n"

    # Games passing neither
    if passing_neither:
        md_content += f"\n## Games Passing Neither ({len(passing_neither)})\n\n"
        md_content += "These games fail in both Universal Tracker versions.\n\n"
        md_content += "| Game Name | Exporter | GameLogic | Rules Size |\n"
        md_content += "|-----------|:--------:|:---------:|:----------:|\n"
        for game in passing_neither:
            exporter, logic, rules_size = get_game_info(game)
            md_content += f"| {game} | {exporter} | {logic} | {rules_size} |\n"

    # Notes section
    md_content += "\n## Notes\n\n"
    md_content += "- **Original Success Rate:** Percentage of fuzz runs that passed in the Original Universal Tracker\n"
    md_content += f"- **{compare_display} Success Rate:** Percentage of fuzz runs that passed in the {compare_display} Universal Tracker\n"
    md_content += "- **Exporter:** ✅ Uses generic exporter, or shows file size of custom Python exporter script\n"
    md_content += "- **GameLogic:** ✅ Uses generic logic, or shows total size of custom JavaScript game logic files\n"
    md_content += "- **Rules Size:** File size of rules.json for seed 1 (N/A if not generated)\n"
    md_content += "- A game is considered \"passing\" if it has a 100% success rate (0 failures, 0 timeouts)\n"

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

    # Load exclude lists for different world sources
    # For bundled worlds: use main + worldgen exclude lists (UT fuzz uses worldgen to regenerate)
    excluded_list_bundled = load_template_exclude_list(project_root, include_reasons=True, test_type='all', skip_worldgen_variants=True)
    excluded_games_bundled = {item['name']: item['reason'] for item in excluded_list_bundled}
    # For apworlds: use UT fuzz apworld exclude list
    excluded_list_apworld = load_template_exclude_list(project_root, include_reasons=True, test_type='ut_fuzz_apworld')
    excluded_games_apworld = {item['name']: item['reason'] for item in excluded_list_apworld}

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

    # Track chart data for comparisons
    # Keys: 'bundled-original', 'bundled-modified', 'bundled-hybrid',
    #       'apworlds-original', 'apworlds-modified', 'apworlds-hybrid'
    chart_data_by_type = {}

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

        # Determine world_source and ut_version from filename or metadata
        basename = os.path.basename(results_path)
        parts = basename.replace('.json', '').split('-')

        if len(parts) == 6:  # test-results-{world_source}-{ut_version}-{seed_type}-seed
            world_source = parts[2]
            ut_version = parts[3]
        elif len(parts) == 5:  # test-results-{ut_version}-{seed_type}-seed
            world_source = 'bundled'
            ut_version = parts[2]
        else:
            world_source = metadata.get('world_source', 'bundled')
            ut_version = metadata.get('ut_version', 'modified')

        # Store chart data for comparison generation
        key = f"{world_source}-{ut_version}"
        chart_data_by_type[key] = chart_data

        # Generate markdown with appropriate exclude list based on world source
        excluded_games = excluded_games_apworld if world_source == "apworlds" else excluded_games_bundled
        md_content = generate_ut_fuzz_markdown(chart_data, metadata, world_mapping, project_root, world_source, excluded_games)

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

    # Generate comparison files if we have both original and another version for a world source
    for world_source in ['bundled', 'apworlds']:
        original_key = f"{world_source}-original"

        # Generate comparisons for both modified and hybrid versions
        for compare_version in ['modified', 'hybrid']:
            compare_key = f"{world_source}-{compare_version}"

            if original_key in chart_data_by_type and compare_key in chart_data_by_type:
                comparison_md = generate_comparison_markdown(
                    chart_data_by_type[original_key],
                    chart_data_by_type[compare_key],
                    world_mapping,
                    project_root,
                    world_source,
                    compare_version
                )

                # Determine output filename
                if world_source == 'bundled':
                    if compare_version == 'modified':
                        comparison_filename = 'test-results-ut-fuzz-comparison.md'
                    else:
                        comparison_filename = f'test-results-ut-fuzz-{compare_version}-comparison.md'
                else:
                    if compare_version == 'modified':
                        comparison_filename = f'test-results-ut-fuzz-{world_source}-comparison.md'
                    else:
                        comparison_filename = f'test-results-ut-fuzz-{world_source}-{compare_version}-comparison.md'

                comparison_path = os.path.join(output_dir, comparison_filename)
                with open(comparison_path, 'w') as f:
                    f.write(comparison_md)

                print(f"Comparison saved to: {comparison_path}")

    return 0


if __name__ == '__main__':
    exit(main())
