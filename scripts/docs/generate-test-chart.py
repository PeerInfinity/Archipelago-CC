#!/usr/bin/env python3
"""
Script to generate charts from template test results showing test results
for all game templates. Supports spoiler tests (minimal and full) and multiclient tests.
Can generate individual charts for each test type and a combined summary chart.
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

# Add parent scripts directory to path to import from lib
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.test_utils import load_template_exclude_list

# Import UT comparison functions from the dedicated script
from generate_ut_comparison_chart import (
    extract_ut_comparison_chart_data,
    generate_ut_comparison_markdown,
    load_world_mapping
)


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load the template test results from JSON file."""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading results file {results_file}: {e}")
        return {}


def extract_spoiler_chart_data(results: Dict[str, Any]) -> List[Tuple[str, str, int, float, float, bool, bool, Optional[bool], Optional[bool]]]:
    """
    Extract spoiler test chart data from results.
    Returns list of tuples: (game_name, pass_fail, gen_error_count, sphere_reached, max_spheres,
                             has_custom_exporter, has_custom_game_logic, rules_consistent, spoilers_consistent)

    Consistency values:
    - True: all seeds have identical files
    - False: at least one seed has different files
    - None: no consistency data available
    """
    chart_data = []

    if 'results' not in results:
        return chart_data

    for template_filename, template_data in results['results'].items():
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
                    # No individual results, use top-level data from template_data
                    first_result = template_data
            else:
                if first_failure_seed:
                    pass_fail = f"Failed seed {first_failure_seed}"
                    first_result = individual_results.get(str(first_failure_seed), template_data)
                else:
                    pass_fail = f"Failed"
                    # No individual results, use top-level data from template_data
                    first_result = template_data

            gen_error_count = first_result.get('generation', {}).get('error_count', 0)
            sphere_reached = first_result.get('spoiler_test', {}).get('sphere_reached', 0)
            max_spheres = first_result.get('spoiler_test', {}).get('total_spheres', 0)
            world_info = first_result.get('world_info', {})
            game_name = world_info.get('game_name_from_yaml') or template_filename.replace('.yaml', '')
            has_custom_exporter = world_info.get('has_custom_exporter', False)
            has_custom_game_logic = world_info.get('has_custom_game_logic', False)
        else:
            # Handle single seed results
            world_info = template_data.get('world_info', {})
            game_name = world_info.get('game_name_from_yaml')

            if not game_name:
                game_name = template_filename.replace('.yaml', '').replace('_', ' ').title()

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

        # Extract consistency data
        consistency_tests = template_data.get('consistency_tests', {})
        rules_consistent = None
        spoilers_consistent = None

        if consistency_tests:
            # Check if all seeds have rules_identical = True
            rules_values = [ct.get('rules_identical') for ct in consistency_tests.values() if 'rules_identical' in ct]
            spoilers_values = [ct.get('spoilers_identical') for ct in consistency_tests.values() if 'spoilers_identical' in ct]

            if rules_values:
                # If any value is False, overall is False; if all True, overall is True
                rules_consistent = all(v is True for v in rules_values) if rules_values else None

            if spoilers_values:
                # If any value is False, overall is False; if all True, overall is True
                spoilers_consistent = all(v is True for v in spoilers_values) if spoilers_values else None

        chart_data.append((game_name, pass_fail, gen_error_count, sphere_reached, max_spheres, has_custom_exporter, has_custom_game_logic, rules_consistent, spoilers_consistent))

    chart_data.sort(key=lambda x: x[0])
    return chart_data


def extract_multiclient_chart_data(results: Dict[str, Any]) -> List[Tuple[str, str, int, int, int, int, int, int, int, int, int, bool, int, int, bool, bool, bool]]:
    """
    Extract multiclient test chart data from results.
    Returns list of tuples: (game_name, pass_fail, gen_error_count,
                            client1_checked, client1_total, client1_manually_checkable, client1_manually_checkable_checked,
                            client1_event_locations, client1_event_locations_checked, client1_passed,
                            client2_received, client2_total, client2_passed,
                            has_custom_exporter, has_custom_game_logic)
    """
    chart_data = []

    if 'results' not in results:
        return chart_data

    results_data = results['results']
    if isinstance(results_data, dict):
        # New dict-based format - iterate over template filenames and data
        for template_filename, template_data in results_data.items():
            # Extract world info
            world_info = template_data.get('world_info', {})

            # Use game_name_from_yaml if available (matches spoiler test behavior)
            game_name = world_info.get('game_name_from_yaml')
            if not game_name:
                # Fallback to game_name_from_yaml field or template filename
                game_name = template_data.get('game_name_from_yaml', template_filename.replace('.yaml', ''))

            has_custom_exporter = world_info.get('has_custom_exporter', False)
            has_custom_game_logic = world_info.get('has_custom_game_logic', False)
            gen_error_count = template_data.get('generation', {}).get('error_count', 0)

            multiclient_test = template_data.get('multiclient_test', {})
            success = multiclient_test.get('success', False)

            # Extract new client-specific fields
            client1_checked = multiclient_test.get('client1_locations_checked', 0)
            client1_total = multiclient_test.get('client1_total_locations', 0)
            client1_manually_checkable = multiclient_test.get('client1_manually_checkable', 0)
            client1_manually_checkable_checked = multiclient_test.get('client1_manually_checkable_checked', 0)
            client1_event_locations = multiclient_test.get('client1_event_locations', 0)
            client1_event_locations_checked = multiclient_test.get('client1_event_locations_checked', 0)
            client1_passed = multiclient_test.get('client1_passed', False)

            client2_received = multiclient_test.get('client2_locations_received', 0)
            client2_total = multiclient_test.get('client2_total_locations', 0)
            client2_passed = multiclient_test.get('client2_passed', False)

            if success and gen_error_count == 0:
                pass_fail = 'Passed'
            else:
                pass_fail = 'Failed'

            chart_data.append((game_name, pass_fail, gen_error_count,
                             client1_checked, client1_total, client1_manually_checkable, client1_manually_checkable_checked,
                             client1_event_locations, client1_event_locations_checked, client1_passed,
                             client2_received, client2_total, client2_passed,
                             has_custom_exporter, has_custom_game_logic))
    else:
        # Old list-based format
        results_list = results_data
        for template_data in results_list:
            game_name = template_data.get('game_name_from_yaml', template_data.get('template_filename', 'Unknown').replace('.yaml', ''))
            world_info = template_data.get('world_info', {})
            has_custom_exporter = world_info.get('has_custom_exporter', False)
            has_custom_game_logic = world_info.get('has_custom_game_logic', False)
            gen_error_count = template_data.get('generation', {}).get('error_count', 0)

            multiclient_test = template_data.get('multiclient_test', {})
            success = multiclient_test.get('success', False)

            # Extract new client-specific fields (with fallback to legacy fields)
            client1_checked = multiclient_test.get('client1_locations_checked', 0)
            client1_total = multiclient_test.get('client1_total_locations', 0)
            client1_manually_checkable = multiclient_test.get('client1_manually_checkable', 0)
            client1_manually_checkable_checked = multiclient_test.get('client1_manually_checkable_checked', 0)
            client1_event_locations = multiclient_test.get('client1_event_locations', 0)
            client1_event_locations_checked = multiclient_test.get('client1_event_locations_checked', 0)
            client1_passed = multiclient_test.get('client1_passed', False)

            client2_received = multiclient_test.get('client2_locations_received',
                                                   multiclient_test.get('locations_checked', 0))
            client2_total = multiclient_test.get('client2_total_locations',
                                                multiclient_test.get('total_locations', 0))
            client2_passed = multiclient_test.get('client2_passed', False)

            if success and gen_error_count == 0:
                pass_fail = 'Passed'
            else:
                pass_fail = 'Failed'

            chart_data.append((game_name, pass_fail, gen_error_count,
                             client1_checked, client1_total, client1_manually_checkable, client1_manually_checkable_checked,
                             client1_event_locations, client1_event_locations_checked, client1_passed,
                             client2_received, client2_total, client2_passed,
                             has_custom_exporter, has_custom_game_logic))

    chart_data.sort(key=lambda x: x[0])
    return chart_data


def generate_spoiler_markdown(chart_data: List[Tuple[str, str, int, float, float, bool, bool, Optional[bool], Optional[bool]]],
                              metadata: Dict[str, Any], subtitle: str = "", is_worldgen: bool = False,
                              other_version_link: Optional[str] = None) -> str:
    """Generate a markdown table for spoiler test data."""
    md_content = "# Archipelago Template Test Results Chart\n\n"

    if subtitle:
        md_content += f"## {subtitle}\n\n"

    # Add link to summary document
    md_content += "[← Back to Test Results Summary](./test-results-summary.md)\n\n"

    # Add cross-link to other version (original <-> worldgen)
    if other_version_link:
        if is_worldgen:
            md_content += f"[View Original Template Results]({other_version_link})\n\n"
        else:
            md_content += f"[View WorldGen Template Results]({other_version_link})\n\n"

    if metadata:
        md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"

    if chart_data:
        total_games = len(chart_data)
        passed = sum(1 for _, pf, _, _, _, _, _, _, _ in chart_data if 'passed' in pf.lower())
        failed = sum(1 for _, pf, _, _, _, _, _, _, _ in chart_data if 'failed' in pf.lower())

        # Get intermittent failures counts
        intermittent_games_count = 0
        intermittent_total_count = 0
        if metadata and 'intermittent_tracking' in metadata:
            intermittent_failures = metadata['intermittent_tracking'].get('failures', [])
            # Count unique templates (games)
            unique_templates = set(failure.get('template') for failure in intermittent_failures)
            intermittent_games_count = len(unique_templates)
            # Count total intermittent failures
            intermittent_total_count = len(intermittent_failures)

        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {total_games}\n"
        md_content += f"- **Passed:** {passed} ({passed/total_games*100:.1f}%)\n"
        md_content += f"- **Failed:** {failed} ({failed/total_games*100:.1f}%)\n"
        md_content += f"- **Games with Intermittent Failures:** {intermittent_games_count}\n"
        md_content += f"- **Total Intermittent Failures:** {intermittent_total_count}\n\n"

    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Test Result | Gen Errors | Sphere Reached | Max Spheres | Progress | Base Exporter | Base GameLogic |\n"
    md_content += "|-----------|-------------|------------|----------------|-------------|----------|---------------|----------------|\n"

    for game_name, pass_fail, gen_error_count, sphere_reached, max_spheres, has_custom_exporter, has_custom_game_logic, rules_consistent, spoilers_consistent in chart_data:
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

        exporter_indicator = "⚫" if has_custom_exporter else "✅"
        game_logic_indicator = "⚫" if has_custom_game_logic else "✅"

        md_content += f"| {game_name} | {result_display} | {gen_error_count} | {sphere_reached:g} | {max_spheres:g} | {progress} | {exporter_indicator} | {game_logic_indicator} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - |\n"

    # Add Intermittent Failures section if there are any
    if metadata and 'intermittent_tracking' in metadata:
        intermittent_failures = metadata['intermittent_tracking'].get('failures', [])
        if intermittent_failures:
            # Sort by template name first, then by seed number
            sorted_failures = sorted(intermittent_failures, key=lambda f: (
                f.get('template', 'Unknown'),
                f.get('seed') if f.get('seed') is not None else float('inf')
            ))

            md_content += "\n## Intermittent Failures\n\n"
            md_content += "These seeds were previously failing but passed during a retest run:\n\n"
            md_content += "| Template | Seed | Timestamp | Notes |\n"
            md_content += "|----------|------|-----------|-------|\n"

            for failure in sorted_failures:
                template_name = failure.get('template', 'Unknown').replace('.yaml', '')
                seed = failure.get('seed', 'N/A')
                timestamp = failure.get('timestamp', 'Unknown')
                # Parse timestamp to make it more readable
                try:
                    from datetime import datetime as dt
                    ts_obj = dt.fromisoformat(timestamp)
                    timestamp_display = ts_obj.strftime('%Y-%m-%d %H:%M')
                except:
                    timestamp_display = timestamp

                # Show seed or "N/A" if not available
                seed_display = str(seed) if seed is not None else "N/A"

                notes = "Previously failed, now passing"
                md_content += f"| {template_name} | {seed_display} | {timestamp_display} | {notes} |\n"

            md_content += "\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Gen Errors:** Number of errors during world generation\n"
    md_content += "- **Sphere Reached:** The logical sphere the test reached before completion/failure\n"
    md_content += "- **Max Spheres:** Total logical spheres available in the game\n"
    md_content += "- **Progress:** Percentage of logical spheres completed\n"
    md_content += "- **Base Exporter:** ✅ Uses generic exporter, ⚫ Has custom Python exporter script\n"
    md_content += "- **Base GameLogic:** ✅ Uses generic logic, ⚫ Has custom JavaScript game logic\n\n"
    md_content += "**Pass Criteria:** Generation errors = 0, Max spheres > 0, Spoiler test completed successfully\n"

    return md_content


def generate_multiclient_markdown(chart_data: List[Tuple[str, str, int, int, int, int, int, int, int, bool, int, int, bool, bool, bool]],
                                 metadata: Dict[str, Any], top_level_metadata: Optional[Dict[str, Any]] = None,
                                 is_worldgen: bool = False, other_version_link: Optional[str] = None) -> str:
    """Generate a markdown table for multiclient test data."""
    md_content = "# Archipelago Template Test Results Chart\n\n"
    md_content += "## Multiclient Test\n\n"

    # Add link to summary document
    md_content += "[← Back to Test Results Summary](./test-results-summary.md)\n\n"

    # Add cross-link to other version (original <-> worldgen)
    if other_version_link:
        if is_worldgen:
            md_content += f"[View Original Template Results]({other_version_link})\n\n"
        else:
            md_content += f"[View WorldGen Template Results]({other_version_link})\n\n"

    # Add generated timestamp
    md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # Add top-level metadata if available (from multiclient test results)
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
    md_content += "| Game Name | Test Result | Gen Errors | C1 Status | C1 Total | C1 Non-event | C1 Event | C2 Status | C2 Locations | Base Exporter | Base GameLogic |\n"
    md_content += "|-----------|-------------|------------|-----------|----------|--------------|----------|-----------|--------------|---------------|----------------|\n"

    for (game_name, pass_fail, gen_error_count,
         client1_checked, client1_total, client1_manually_checkable, client1_manually_checkable_checked,
         client1_event_locations, client1_event_locations_checked, client1_passed,
         client2_received, client2_total, client2_passed,
         has_custom_exporter, has_custom_game_logic) in chart_data:

        result_display = "✅ Passed" if pass_fail.lower() == 'passed' else "❌ Failed"
        client1_status = "✅" if client1_passed else "❌"
        client2_status = "✅" if client2_passed else "❌"
        exporter_indicator = "⚫" if has_custom_exporter else "✅"
        game_logic_indicator = "⚫" if has_custom_game_logic else "✅"

        # Format location counts as "checked/total"
        c1_total_str = f"{client1_checked}/{client1_total}"
        c1_nonevent_str = f"{client1_manually_checkable_checked}/{client1_manually_checkable}"
        c1_event_str = f"{client1_event_locations_checked}/{client1_event_locations}"
        c2_locations_str = f"{client2_received}/{client2_total}"

        md_content += f"| {game_name} | {result_display} | {gen_error_count} | {client1_status} | {c1_total_str} | {c1_nonevent_str} | {c1_event_str} | {client2_status} | {c2_locations_str} | {exporter_indicator} | {game_logic_indicator} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - | - | - | - |\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Gen Errors:** Number of errors during world generation\n"
    md_content += "- **Client 1 (Send Test):** Tests sending location checks from Client 1\n"
    md_content += "  - **C1 Total:** Total locations checked / total locations (checked/total)\n"
    md_content += "  - **C1 Non-event:** Non-event locations checked / total non-event locations (manually-checkable)\n"
    md_content += "  - **C1 Event:** Event locations checked / total event locations (auto-checked)\n"
    md_content += "  - Client 1 passes if all manually-checkable locations are checked\n"
    md_content += "- **Client 2 (Receive Test):** Tests receiving location checks at Client 2\n"
    md_content += "  - **C2 Locations:** Locations received / total expected (received/total)\n"
    md_content += "  - Client 2 passes if all expected locations are received\n"
    md_content += "- **Base Exporter:** ✅ Uses generic exporter, ⚫ Has custom Python exporter script\n"
    md_content += "- **Base GameLogic:** ✅ Uses generic logic, ⚫ Has custom JavaScript game logic\n\n"
    md_content += "**Pass Criteria:** A test is marked as ✅ Passed only if:\n"
    md_content += "- Generation errors = 0 (no errors during world generation)\n"
    md_content += "- Client 1 passed (all manually-checkable locations sent)\n"
    md_content += "- Client 2 passed (all expected locations received)\n"
    md_content += "- Both clients completed successfully\n"

    return md_content


def extract_multiworld_chart_data(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract multiworld test chart data from results.
    Returns list of dicts with keys:
        game_name, pass_fail, player_number, total_players_tested,
        total_players_in_multiworld, players_passed, players_failed,
        all_prereqs_passed, has_custom_exporter, has_custom_game_logic,
        templates_in_multiworld, bisection_results, second_pass
    """
    chart_data = []

    if 'results' not in results:
        return chart_data

    for template_filename, template_data in results['results'].items():
        world_info = template_data.get('world_info', {})
        game_name = world_info.get('game_name_from_yaml') or template_filename.replace('.yaml', '')
        has_custom_exporter = world_info.get('has_custom_exporter', False)
        has_custom_game_logic = world_info.get('has_custom_game_logic', False)

        multiworld_test = template_data.get('multiworld_test', {})
        prerequisite_check = template_data.get('prerequisite_check', {})

        success = multiworld_test.get('success', False)
        player_number = multiworld_test.get('player_number', 0)
        total_players_tested = multiworld_test.get('total_players_tested', 0)
        total_players_in_multiworld = multiworld_test.get('total_players_in_multiworld', 0)
        players_passed = multiworld_test.get('players_passed', 0)
        players_failed = multiworld_test.get('players_failed', 0)
        all_prereqs_passed = prerequisite_check.get('all_prerequisites_passed', False)
        templates_in_multiworld = multiworld_test.get('templates_in_multiworld', {})
        bisection_results = template_data.get('bisection_results', None)

        # Extract second pass data if available
        second_pass = template_data.get('second_pass', None)

        if not all_prereqs_passed:
            pass_fail = 'Skipped (Prerequisites)'
        elif success:
            pass_fail = 'Passed'
        else:
            pass_fail = 'Failed'

        chart_data.append({
            'game_name': game_name,
            'template_filename': template_filename,
            'pass_fail': pass_fail,
            'player_number': player_number,
            'total_players_tested': total_players_tested,
            'total_players_in_multiworld': total_players_in_multiworld,
            'players_passed': players_passed,
            'players_failed': players_failed,
            'all_prereqs_passed': all_prereqs_passed,
            'has_custom_exporter': has_custom_exporter,
            'has_custom_game_logic': has_custom_game_logic,
            'templates_in_multiworld': templates_in_multiworld,
            'bisection_results': bisection_results,
            'second_pass': second_pass
        })

    chart_data.sort(key=lambda x: x['game_name'])
    return chart_data


def generate_multiworld_markdown(chart_data: List[Dict[str, Any]],
                                 metadata: Dict[str, Any], top_level_metadata: Optional[Dict[str, Any]] = None,
                                 is_worldgen: bool = False, other_version_link: Optional[str] = None) -> str:
    """Generate a markdown table for multiworld test data."""
    md_content = "# Archipelago Template Test Results Chart\n\n"
    md_content += "## Multiworld Test\n\n"

    # Add link to summary document
    md_content += "[← Back to Test Results Summary](./test-results-summary.md)\n\n"

    # Add cross-link to other version (original <-> worldgen)
    if other_version_link:
        if is_worldgen:
            md_content += f"[View Original Template Results]({other_version_link})\n\n"
        else:
            md_content += f"[View WorldGen Template Results]({other_version_link})\n\n"

    # Add generated timestamp
    md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # Add top-level metadata if available
    if top_level_metadata:
        if 'timestamp' in top_level_metadata and top_level_metadata['timestamp']:
            md_content += f"**Test Timestamp:** {top_level_metadata.get('timestamp')}\n\n"
        if 'seed' in top_level_metadata and top_level_metadata['seed']:
            md_content += f"**Seed:** {top_level_metadata.get('seed')}\n\n"
    elif metadata and ('created' in metadata or 'last_updated' in metadata):
        if 'created' in metadata:
            md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        if 'last_updated' in metadata:
            md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"

    # Check if any entries have second pass data
    has_second_pass_data = any(entry.get('second_pass') for entry in chart_data)

    if chart_data:
        total_games = len(chart_data)
        passed = sum(1 for d in chart_data if d['pass_fail'].lower() == 'passed')
        skipped = sum(1 for d in chart_data if 'skipped' in d['pass_fail'].lower() or 'prerequisites' in d['pass_fail'].lower())
        failed = total_games - passed - skipped

        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {total_games}\n"
        md_content += f"- **Passed:** {passed} ({passed/total_games*100:.1f}%)\n"
        md_content += f"- **Failed:** {failed} ({failed/total_games*100:.1f}%)\n"
        md_content += f"- **Skipped (Prerequisites):** {skipped} ({skipped/total_games*100:.1f}%)\n"

        # Add second pass summary if applicable
        if has_second_pass_data:
            second_pass_count = sum(1 for d in chart_data if d.get('second_pass'))
            second_pass_passed = sum(1 for d in chart_data if (d.get('second_pass') or {}).get('success', False))
            second_pass_failed = second_pass_count - second_pass_passed
            md_content += f"- **Second Pass Tested:** {second_pass_count}\n"
            md_content += f"- **Second Pass Passed:** {second_pass_passed}\n"
            md_content += f"- **Second Pass Failed:** {second_pass_failed}\n"

        md_content += "\n"

    md_content += "## Test Results\n\n"

    # Add Second Pass column if there's second pass data
    if has_second_pass_data:
        md_content += "| Game Name | First Pass | Second Pass | Player # | MW Size | Base Exporter | Base GameLogic |\n"
        md_content += "|-----------|------------|-------------|----------|---------|---------------|----------------|\n"
    else:
        md_content += "| Game Name | Test Result | Player # | Total Players | Players Passed | Players Failed | Base Exporter | Base GameLogic |\n"
        md_content += "|-----------|-------------|----------|---------------|----------------|----------------|---------------|----------------|\n"

    for entry in chart_data:
        game_name = entry['game_name']
        pass_fail = entry['pass_fail']
        player_number = entry['player_number']
        total_players_tested = entry['total_players_tested']
        total_players_in_multiworld = entry.get('total_players_in_multiworld', 0)
        players_passed = entry['players_passed']
        players_failed = entry['players_failed']
        has_custom_exporter = entry['has_custom_exporter']
        has_custom_game_logic = entry['has_custom_game_logic']
        second_pass = entry.get('second_pass')

        if pass_fail.lower() == 'passed':
            result_display = "✅ Passed"
        elif 'skipped' in pass_fail.lower() or 'prerequisites' in pass_fail.lower():
            result_display = "⚫ Skipped"
        else:
            result_display = "❌ Failed"

        exporter_indicator = "⚫" if has_custom_exporter else "✅"
        game_logic_indicator = "⚫" if has_custom_game_logic else "✅"

        player_display = str(player_number) if player_number > 0 else "N/A"

        if has_second_pass_data:
            # Use total_players_in_multiworld for MW size display
            mw_size = total_players_in_multiworld if total_players_in_multiworld > 0 else total_players_tested
            mw_size_display = str(mw_size) if mw_size > 0 else "N/A"

            # Second pass result
            if second_pass:
                if second_pass.get('success', False):
                    second_pass_display = "✅ Passed"
                else:
                    second_pass_display = "❌ Failed"
            else:
                # No second pass needed (tested with full multiworld)
                second_pass_display = "—"

            md_content += f"| {game_name} | {result_display} | {second_pass_display} | {player_display} | {mw_size_display} | {exporter_indicator} | {game_logic_indicator} |\n"
        else:
            total_display = str(total_players_tested) if total_players_tested > 0 else "N/A"
            passed_display = str(players_passed) if total_players_tested > 0 else "N/A"
            failed_display = str(players_failed) if total_players_tested > 0 else "N/A"

            md_content += f"| {game_name} | {result_display} | {player_display} | {total_display} | {passed_display} | {failed_display} | {exporter_indicator} | {game_logic_indicator} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - |\n"

    # Add Templates in Multiworld section for games that have this data
    entries_with_templates = [e for e in chart_data if e.get('templates_in_multiworld')]
    if entries_with_templates:
        md_content += "\n## Templates in Multiworld\n\n"
        md_content += "Shows which templates were in the multiworld when each game was tested:\n\n"

        for entry in entries_with_templates:
            game_name = entry['game_name']
            templates_in_multiworld = entry['templates_in_multiworld']
            pass_fail = entry['pass_fail']

            # Determine result icon
            if pass_fail.lower() == 'passed':
                result_icon = "✅"
            elif 'skipped' in pass_fail.lower() or 'prerequisites' in pass_fail.lower():
                result_icon = "⚫"
            else:
                result_icon = "❌"

            md_content += f"### {game_name} {result_icon}\n\n"
            md_content += "| Player # | Template |\n"
            md_content += "|----------|----------|\n"

            # Sort by player number
            for player_key in sorted(templates_in_multiworld.keys(), key=lambda x: int(x.split('_')[1])):
                player_num = player_key.split('_')[1]
                template_name = templates_in_multiworld[player_key]
                md_content += f"| {player_num} | {template_name} |\n"

            md_content += "\n"

    # Add Bisection Results section if any exist
    entries_with_bisection = [e for e in chart_data if e.get('bisection_results')]
    if entries_with_bisection:
        md_content += "\n## Bisection Results\n\n"
        md_content += "When a multiworld test fails, bisection tests each pair of templates to find which specific combination causes the failure.\n\n"

        for entry in entries_with_bisection:
            game_name = entry['game_name']
            template_filename = entry.get('template_filename', game_name)
            bisection = entry['bisection_results']

            md_content += f"### {game_name} ({template_filename})\n\n"

            tested_pairs = bisection.get('tested_pairs', [])
            failing_pairs = bisection.get('failing_pairs', [])

            if failing_pairs:
                md_content += f"**Failing pairs found:** {len(failing_pairs)}\n\n"
            else:
                md_content += "**No failing pairs found** (failure may be due to combination of 3+ templates)\n\n"

            if tested_pairs:
                md_content += "| Partner Template | Result | Generation | Player 1 | Player 2 |\n"
                md_content += "|------------------|--------|------------|----------|----------|\n"

                for pair in tested_pairs:
                    partner = pair.get('partner_template', 'Unknown')
                    success = pair.get('success', False)
                    gen_success = pair.get('generation_success', False)

                    result_icon = "✅" if success else "❌"
                    gen_icon = "✅" if gen_success else "❌"

                    player_results = pair.get('player_results', {})
                    p1_result = player_results.get('player_1', {})
                    p2_result = player_results.get('player_2', {})

                    p1_icon = "✅" if p1_result.get('passed', False) else ("❌" if p1_result else "—")
                    p2_icon = "✅" if p2_result.get('passed', False) else ("❌" if p2_result else "—")

                    md_content += f"| {partner} | {result_icon} | {gen_icon} | {p1_icon} | {p2_icon} |\n"

                md_content += "\n"

    # Add Second Pass Results section if any entries have second pass data
    entries_with_second_pass = [e for e in chart_data if e.get('second_pass')]
    if entries_with_second_pass:
        md_content += "\n## Second Pass Results\n\n"
        md_content += "Templates tested in the first pass with fewer than the maximum number of players were retested (second pass) with the full multiworld.\n\n"

        md_content += "| Game Name | First Pass MW Size | Second Pass MW Size | Second Pass Player # | Second Pass Result |\n"
        md_content += "|-----------|-------------------|---------------------|---------------------|--------------------|\n"

        for entry in entries_with_second_pass:
            game_name = entry['game_name']
            first_pass_mw_size = entry.get('total_players_in_multiworld', entry['total_players_tested'])
            second_pass = entry['second_pass']

            second_pass_mw_size = second_pass.get('total_players_in_multiworld', 0)
            second_pass_player_num = second_pass.get('player_number', 0)
            second_pass_success = second_pass.get('success', False)

            result_icon = "✅ Passed" if second_pass_success else "❌ Failed"

            md_content += f"| {game_name} | {first_pass_mw_size} | {second_pass_mw_size} | {second_pass_player_num} | {result_icon} |\n"

        md_content += "\n"

        # Add Second Pass Templates in Multiworld subsection
        md_content += "### Second Pass Templates in Multiworld\n\n"
        md_content += "Shows which templates were in the multiworld when each game was tested in the second pass:\n\n"

        for entry in entries_with_second_pass:
            game_name = entry['game_name']
            second_pass = entry['second_pass']
            second_pass_templates = second_pass.get('templates_in_multiworld', {})

            if second_pass_templates:
                second_pass_success = second_pass.get('success', False)
                result_icon = "✅" if second_pass_success else "❌"

                md_content += f"#### {game_name} {result_icon}\n\n"
                md_content += "| Player # | Template |\n"
                md_content += "|----------|----------|\n"

                # Sort by player number
                for player_key in sorted(second_pass_templates.keys(), key=lambda x: int(x.split('_')[1])):
                    player_num = player_key.split('_')[1]
                    template_name = second_pass_templates[player_key]
                    md_content += f"| {player_num} | {template_name} |\n"

                md_content += "\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Player #:** The player number assigned to this template in the multiworld\n"
    md_content += "- **Total Players / MW Size:** Number of players in the multiworld configuration when this template was tested\n"
    md_content += "- **Players Passed:** Number of players that passed the spoiler test\n"
    md_content += "- **Players Failed:** Number of players that failed the spoiler test\n"
    md_content += "- **Base Exporter:** ✅ Uses generic exporter, ⚫ Has custom Python exporter script\n"
    md_content += "- **Base GameLogic:** ✅ Uses generic logic, ⚫ Has custom JavaScript game logic\n\n"
    md_content += "**Pass Criteria:** All prerequisite tests (Spoiler Minimal, Spoiler Full, Multiclient) must pass, and all players in the multiworld must pass their spoiler tests\n\n"
    md_content += "**Skipped:** Templates that did not meet prerequisite requirements\n\n"

    if entries_with_second_pass:
        md_content += "**Second Pass:** Templates tested in the first pass with fewer than the maximum number of players are retested with the full multiworld. This ensures all templates are validated with the final multiworld configuration.\n"

    return md_content


def extract_multitemplate_chart_data(results: Dict[str, Any]) -> Dict[str, List[Tuple[str, str, int, float, float, bool, bool]]]:
    """
    Extract multitemplate test chart data from results.
    Returns dict of {game_name: [(template_name, pass_fail, gen_error_count, sphere_reached, max_spheres, has_custom_exporter, has_custom_game_logic), ...]}
    """
    chart_data = {}

    if 'results' not in results:
        return chart_data

    # In multitemplate mode, results are nested by game name → template filename
    for game_name, templates in results['results'].items():
        if not isinstance(templates, dict):
            continue

        game_templates = []
        for template_name, template_data in templates.items():
            # Skip if template_data is not a dictionary (malformed data from combine script)
            if not isinstance(template_data, dict):
                print(f"Warning: Skipping malformed template data for {game_name}/{template_name}")
                continue

            # Handle single seed results
            world_info = template_data.get('world_info', {})

            original_pass_fail = template_data.get('spoiler_test', {}).get('pass_fail', 'unknown')
            gen_error_count = template_data.get('generation', {}).get('error_count', 0)
            gen_error_type = template_data.get('generation', {}).get('error_type')
            sphere_reached = template_data.get('spoiler_test', {}).get('sphere_reached', 0)
            max_spheres = template_data.get('spoiler_test', {}).get('total_spheres', 0)
            has_custom_exporter = world_info.get('has_custom_exporter', False)
            has_custom_game_logic = world_info.get('has_custom_game_logic', False)

            # Determine pass/fail
            # Check for FillError first - mark as invalid configuration
            if gen_error_type == 'FillError':
                pass_fail = 'Invalid'
            elif gen_error_count > 0:
                pass_fail = 'Generation Failed'
            elif max_spheres == 0:
                pass_fail = 'No Spheres'
            elif original_pass_fail.lower() == 'passed':
                pass_fail = 'Passed'
            else:
                pass_fail = original_pass_fail.title()

            game_templates.append((template_name, pass_fail, gen_error_count, sphere_reached, max_spheres,
                                 has_custom_exporter, has_custom_game_logic))

        if game_templates:
            chart_data[game_name] = sorted(game_templates, key=lambda x: x[0])  # Sort by template name

    return chart_data


def generate_multitemplate_markdown(chart_data: Dict[str, List[Tuple[str, str, int, float, float, bool, bool]]],
                                   metadata: Dict[str, Any], subtitle: str) -> str:
    """Generate a markdown table for multitemplate test data."""
    md_content = "# Archipelago Multi-Template Test Results\n\n"
    md_content += f"## {subtitle}\n\n"

    # Add link to summary document
    md_content += "[← Back to Test Results Summary](./test-results-summary.md)\n\n"

    # Add generated timestamp
    md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # Add metadata if available
    if metadata and ('created' in metadata or 'last_updated' in metadata):
        if 'created' in metadata:
            md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        if 'last_updated' in metadata:
            md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"

    # Calculate statistics
    if chart_data:
        total_templates = sum(len(templates) for templates in chart_data.values())
        total_passed = sum(1 for templates in chart_data.values()
                          for _, pf, *_ in templates if pf.lower() == 'passed')
        total_invalid = sum(1 for templates in chart_data.values()
                           for _, pf, *_ in templates if pf.lower() == 'invalid')
        total_failed = total_templates - total_passed - total_invalid

        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {len(chart_data)}\n"
        md_content += f"- **Total Template Configurations:** {total_templates}\n"
        md_content += f"- **Passed Configurations:** {total_passed} ({total_passed/total_templates*100:.1f}%)\n"
        md_content += f"- **Failed Configurations:** {total_failed} ({total_failed/total_templates*100:.1f}%)\n"
        md_content += f"- **Invalid Configurations:** {total_invalid} ({total_invalid/total_templates*100:.1f}%)\n\n"

    # Generate tables for each game
    for game_name in sorted(chart_data.keys()):
        templates = chart_data[game_name]
        passed = sum(1 for _, pf, *_ in templates if pf.lower() == 'passed')
        total = len(templates)

        # Get exporter/logic info from first template (all templates for a game share these)
        _, _, _, _, _, has_custom_exporter, has_custom_game_logic = templates[0]
        exporter_indicator = "⚫ No" if has_custom_exporter else "✅ Yes"
        game_logic_indicator = "⚫ No" if has_custom_game_logic else "✅ Yes"

        md_content += f"## {game_name}\n\n"
        md_content += f"**Results:** {passed}/{total} passed ({passed/total*100:.1f}%)  \n"
        md_content += f"**Base Exporter:** {exporter_indicator} | **Base GameLogic:** {game_logic_indicator}\n\n"

        md_content += "| Template | Test Result | Gen Errors | Sphere Reached | Max Spheres | Progress |\n"
        md_content += "|----------|-------------|------------|----------------|-------------|----------|\n"

        for (template_name, pass_fail, gen_error_count, sphere_reached, max_spheres,
             has_custom_exporter, has_custom_game_logic) in templates:

            if max_spheres > 0:
                progress = f"{sphere_reached/max_spheres*100:.1f}%"
            else:
                progress = "N/A"

            # Format result display with appropriate emoji
            if pass_fail.lower() == 'passed':
                result_display = "✅ Passed"
            elif pass_fail.lower() == 'invalid':
                result_display = "⚫ Invalid"
            else:
                result_display = "❌ " + pass_fail

            md_content += f"| {template_name} | {result_display} | {gen_error_count} | {sphere_reached:g} | {max_spheres:g} | {progress} |\n"

        md_content += "\n"

    if not chart_data:
        md_content += "No multi-template test data available.\n\n"

    md_content += "## Notes\n\n"
    md_content += "### Test Result Meanings\n\n"
    md_content += "- ✅ **Passed:** Configuration works correctly and test completed successfully\n"
    md_content += "- ❌ **Failed:** Test ran but did not complete successfully\n"
    md_content += "- ⚫ **Invalid:** Configuration cannot be generated due to FillError (impossible item placement)\n\n"
    md_content += "### Column Descriptions\n\n"
    md_content += "- **Gen Errors:** Number of errors during world generation\n"
    md_content += "- **Sphere Reached:** The logical sphere the test reached before completion/failure\n"
    md_content += "- **Max Spheres:** Total logical spheres available in the game\n"
    md_content += "- **Progress:** Percentage of logical spheres completed\n\n"
    md_content += "### Game Information\n\n"
    md_content += "- **Base Exporter:** Whether the game uses generic exporter (✅ Yes) or has a custom Python exporter script (⚫ No)\n"
    md_content += "- **Base GameLogic:** Whether the game uses generic logic (✅ Yes) or has custom JavaScript game logic (⚫ No)\n\n"
    md_content += "**Pass Criteria:** Generation errors = 0, Max spheres > 0, Spoiler test completed successfully\n\n"
    md_content += "**Invalid Configurations:** Templates marked as Invalid have settings that cannot be satisfied by the game's logic (FillError). These represent impossible configurations, not bugs.\n"

    return md_content


def generate_summary_chart(minimal_data, full_data, multiclient_data, multiworld_data=None, multitemplate_minimal_data=None, multitemplate_full_data=None, ut_comparison_data=None, excluded_games=None, minimal_metadata=None, full_metadata=None, has_ut_random=False, has_ut_fixed=False) -> str:
    """Generate a combined summary chart with all test results."""
    md_content = "# Archipelago Template Test Results Summary\n\n"
    md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # Build test types list dynamically
    test_types = [
        ("Minimal Spoiler Test", "Tests with advancement items only", "./test-results-spoilers-minimal.md"),
        ("Full Spoiler Test", "Tests with all locations", "./test-results-spoilers-full.md"),
        ("Multiclient Test", "Tests in multiclient mode", "./test-results-multiclient.md"),
    ]
    if multiworld_data is not None:
        test_types.append(("Multiworld Test", "Tests in multiworld mode with multiple games", "./test-results-multiworld.md"))

    md_content += f"This summary combines results from {len(test_types)} types of tests:\n"
    for name, desc, link in test_types:
        md_content += f"- **{name}:** {desc} - [View Details]({link})\n"

    # Add additional test results links
    md_content += "\nAdditional test results:\n"
    md_content += "- **World Generator Test:** Tests world generation for all templates - [View Details](./test-results-world-generator.md)\n"

    md_content += "\n"

    # Create a unified game list with exporter/logic info
    # Note: UT comparison data is NOT included in statistics - it has its own separate report
    games_minimal = {name: result for name, result, *_ in minimal_data}
    games_full = {name: result for name, result, *_ in full_data}
    games_multiclient = {name: result for name, result, *_ in multiclient_data}
    # multiworld_data is now a list of dicts
    games_multiworld = {d['game_name']: d['pass_fail'] for d in multiworld_data} if multiworld_data else {}

    # Extract custom exporter/logic info and consistency data (from minimal_data as it has all games)
    games_exporter_logic = {}
    games_consistency = {}
    for name, result, gen_errors, sphere, max_sphere, has_exporter, has_logic, rules_consistent, spoilers_consistent in minimal_data:
        games_exporter_logic[name] = (has_exporter, has_logic)
        games_consistency[name] = (rules_consistent, spoilers_consistent)

    all_games = sorted(set(list(games_minimal.keys()) + list(games_full.keys()) + list(games_multiclient.keys()) + list(games_multiworld.keys())))

    # Calculate statistics first
    def calc_stats(data_dict):
        if not data_dict:
            return 0, 0, 0
        total = len(data_dict)
        passed = sum(1 for r in data_dict.values() if 'passed' in r.lower())
        return total, passed, passed/total*100 if total > 0 else 0

    min_total, min_passed, min_pct = calc_stats(games_minimal)
    full_total, full_passed, full_pct = calc_stats(games_full)
    mp_total, mp_passed, mp_pct = calc_stats(games_multiclient)

    # Calculate templates by number of tests passed
    # Note: UT comparison is NOT included in these statistics
    tests_passed_count = {}
    num_tests = 3  # Base: minimal, full, multiclient
    if multiworld_data is not None:
        num_tests += 1

    for game in all_games:
        passed_count = 0
        if game in games_minimal and 'passed' in games_minimal[game].lower():
            passed_count += 1
        if game in games_full and 'passed' in games_full[game].lower():
            passed_count += 1
        if game in games_multiclient and 'passed' in games_multiclient[game].lower():
            passed_count += 1
        if multiworld_data is not None and game in games_multiworld and 'passed' in games_multiworld[game].lower():
            passed_count += 1
        tests_passed_count[game] = passed_count

    # Count how many templates passed 0, 1, 2, 3, or 4 tests
    passed_all = sum(1 for count in tests_passed_count.values() if count == num_tests)
    passed_counts = {i: sum(1 for count in tests_passed_count.values() if count == i) for i in range(num_tests)}

    total_templates = len(all_games)

    # Add Summary Statistics section
    md_content += "## Summary Statistics\n\n"

    md_content += "### Individual Test Results\n\n"
    md_content += f"- **Minimal Test:** {min_passed}/{min_total} passed ({min_pct:.1f}%)\n"
    md_content += f"- **Full Test:** {full_passed}/{full_total} passed ({full_pct:.1f}%)\n"
    md_content += f"- **Multiclient Test:** {mp_passed}/{mp_total} passed ({mp_pct:.1f}%)\n"

    if multiworld_data is not None:
        mw_total, mw_passed, mw_pct = calc_stats(games_multiworld)
        md_content += f"- **Multiworld Test:** {mw_passed}/{mw_total} passed ({mw_pct:.1f}%)\n"

    # Add intermittent failures subsection
    md_content += "\n### Intermittent Failures\n\n"

    minimal_games_count = 0
    minimal_total_count = 0
    full_games_count = 0
    full_total_count = 0

    if minimal_metadata and 'intermittent_tracking' in minimal_metadata:
        failures = minimal_metadata['intermittent_tracking'].get('failures', [])
        # Count unique templates (games)
        unique_templates = set(failure.get('template') for failure in failures)
        minimal_games_count = len(unique_templates)
        # Count total failures
        minimal_total_count = len(failures)

    if full_metadata and 'intermittent_tracking' in full_metadata:
        failures = full_metadata['intermittent_tracking'].get('failures', [])
        # Count unique templates (games)
        unique_templates = set(failure.get('template') for failure in failures)
        full_games_count = len(unique_templates)
        # Count total failures
        full_total_count = len(failures)

    md_content += f"- **Minimal Spoilers Test:** {minimal_games_count} game(s), {minimal_total_count} total failure(s)\n"
    md_content += f"- **Full Spoilers Test:** {full_games_count} game(s), {full_total_count} total failure(s)\n"

    md_content += "\n### Combined Test Results\n\n"
    md_content += f"- **Templates passing all {num_tests} tests:** {passed_all}/{total_templates} ({passed_all/total_templates*100:.1f}%)\n"

    for i in range(num_tests - 1, -1, -1):
        if i > 0:
            md_content += f"- **Templates passing {i} test{'s' if i > 1 else ''}:** {passed_counts[i]}/{total_templates} ({passed_counts[i]/total_templates*100:.1f}%)\n"
        else:
            md_content += f"- **Templates passing 0 tests:** {passed_counts[0]}/{total_templates} ({passed_counts[0]/total_templates*100:.1f}%)\n"

    # Add Test Results table
    md_content += "\n## Test Results\n\n"
    if multiworld_data is not None:
        md_content += "| Game Name | [Minimal Test](./test-results-spoilers-minimal.md) | [Full Test](./test-results-spoilers-full.md) | [Multiclient Test](./test-results-multiclient.md) | [Multiworld Test](./test-results-multiworld.md) | Consistent Rules | Consistent Spoilers | Base Exporter | Base GameLogic |\n"
        md_content += "|-----------|--------------|-----------|------------------|-----------------|------------------|---------------------|---------------|----------------|\n"
    else:
        md_content += "| Game Name | [Minimal Test](./test-results-spoilers-minimal.md) | [Full Test](./test-results-spoilers-full.md) | [Multiclient Test](./test-results-multiclient.md) | Consistent Rules | Consistent Spoilers | Base Exporter | Base GameLogic |\n"
        md_content += "|-----------|--------------|-----------|------------------|------------------|---------------------|---------------|----------------|\n"

    for game in all_games:
        minimal_result = games_minimal.get(game, "N/A")
        full_result = games_full.get(game, "N/A")
        multiclient_result = games_multiclient.get(game, "N/A")
        multiworld_result = games_multiworld.get(game, "N/A") if multiworld_data is not None else None

        # Get exporter/logic info
        has_exporter, has_logic = games_exporter_logic.get(game, (False, False))
        exporter_indicator = "⚫" if has_exporter else "✅"
        logic_indicator = "⚫" if has_logic else "✅"

        # Get consistency info
        rules_consistent, spoilers_consistent = games_consistency.get(game, (None, None))

        # Format consistency indicators according to user requirements:
        # - None/no data: N/A
        # - False (any failures): gray dot
        # - True (all passed): checkmark
        def format_consistency(value):
            if value is None:
                return "❓ N/A"
            elif value is False:
                return "⚫"
            else:  # True
                return "✅"

        rules_indicator = format_consistency(rules_consistent)
        spoilers_indicator = format_consistency(spoilers_consistent)

        def format_result(result):
            if result == "N/A":
                return "❓ N/A"
            elif 'passed' in result.lower():
                return "✅ Passed"
            elif 'skipped' in result.lower():
                return "⚫ Skipped"
            else:
                return "❌ Failed"

        if multiworld_data is not None:
            md_content += f"| {game} | {format_result(minimal_result)} | {format_result(full_result)} | {format_result(multiclient_result)} | {format_result(multiworld_result)} | {rules_indicator} | {spoilers_indicator} | {exporter_indicator} | {logic_indicator} |\n"
        else:
            md_content += f"| {game} | {format_result(minimal_result)} | {format_result(full_result)} | {format_result(multiclient_result)} | {rules_indicator} | {spoilers_indicator} | {exporter_indicator} | {logic_indicator} |\n"

    # Add Multi-Template Results section if data exists
    if multitemplate_minimal_data or multitemplate_full_data:
        md_content += "\n## Multi-Template Test Results\n\n"
        md_content += "These tests check multiple template configurations for the same game.\n\n"

        # Collect all games with multitemplate data
        mt_games = set()
        if multitemplate_minimal_data:
            mt_games.update(multitemplate_minimal_data.keys())
        if multitemplate_full_data:
            mt_games.update(multitemplate_full_data.keys())

        md_content += "| Game Name | Minimal (Advancement Items Only) | Full (All Locations) |\n"
        md_content += "|-----------|----------------------------------|-------------------------------|\n"

        for game in sorted(mt_games):
            # Calculate stats for minimal
            mtmin_link = "❓ N/A"
            if multitemplate_minimal_data and game in multitemplate_minimal_data:
                templates = multitemplate_minimal_data[game]
                passed = sum(1 for _, pf, *_ in templates if pf.lower() == 'passed')
                total = len(templates)
                mtmin_link = f"[{passed}/{total} passed](./test-results-multitemplate-minimal.md#{game.lower().replace(' ', '-')})"

            # Calculate stats for full
            mtfull_link = "❓ N/A"
            if multitemplate_full_data and game in multitemplate_full_data:
                templates = multitemplate_full_data[game]
                passed = sum(1 for _, pf, *_ in templates if pf.lower() == 'passed')
                total = len(templates)
                mtfull_link = f"[{passed}/{total} passed](./test-results-multitemplate-full.md#{game.lower().replace(' ', '-')})"

            md_content += f"| {game} | {mtmin_link} | {mtfull_link} |\n"

    # Add Excluded Games section
    if excluded_games:
        md_content += "\n## Excluded Games\n\n"
        md_content += "The following games are excluded from automated testing:\n\n"

        # Check if excluded_games contains dicts (with reasons) or strings (without)
        if excluded_games and isinstance(excluded_games[0], dict):
            # New format with reasons
            md_content += "| Game | Reason |\n"
            md_content += "|------|--------|\n"
            for item in excluded_games:
                game_name = item['name'].replace('.yaml', '')
                reason = item.get('reason', 'Not specified')
                md_content += f"| {game_name} | {reason} |\n"
        else:
            # Old format (list of strings)
            for game in excluded_games:
                game_name = game.replace('.yaml', '')
                md_content += f"- {game_name}\n"
        md_content += "\n"

    # Add Notes section
    md_content += "## Notes\n\n"
    md_content += "### Column Descriptions\n\n"
    md_content += "- **[Minimal Test](./test-results-spoilers-minimal.md):** Spoiler test using advancement items only\n"
    md_content += "- **[Full Test](./test-results-spoilers-full.md):** Spoiler test using all locations\n"
    md_content += "- **[Multiclient Test](./test-results-multiclient.md):** Tests sending and receiving location checks between two clients\n"
    md_content += "- **[Multiworld Test](./test-results-multiworld.md):** Tests the game in a multiworld with multiple other games\n"
    md_content += "- **Consistent Rules:** ✅ if rules.json files are identical across all tested seeds, ⚫ if they differ, ❓ if not tested\n"
    md_content += "- **Consistent Spoilers:** ✅ if spoiler files are identical across all tested seeds, ⚫ if they differ, ❓ if not tested\n"
    md_content += "- **Base Exporter:** ✅ Uses generic exporter, ⚫ Has custom Python exporter script\n"
    md_content += "- **Base GameLogic:** ✅ Uses generic logic, ⚫ Has custom JavaScript game logic\n"

    return md_content


def main():
    parser = argparse.ArgumentParser(description='Generate test results charts from template test results')
    parser.add_argument('--input-file', type=str, help='Input JSON file path (processes only this file)')
    parser.add_argument('--output-file', type=str, help='Output markdown file path')
    parser.add_argument('--test-type', type=str, choices=['minimal', 'full', 'multiclient', 'multiworld', 'multitemplate-minimal', 'multitemplate-full', 'ut-comparison'],
                       help='Test type when using --input-file')

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
            md_content = generate_spoiler_markdown(chart_data, metadata, subtitle)
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
            chart_data = extract_multiworld_chart_data(results)
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
                                              is_worldgen=False, other_version_link=wg_link)
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
                                                  is_worldgen=True, other_version_link=orig_link)
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
                                           is_worldgen=False, other_version_link=wg_link)
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
                                               is_worldgen=True, other_version_link=orig_link)
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
                                              is_worldgen=False, other_version_link=wg_link)
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
                                                  is_worldgen=True, other_version_link=orig_link)
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
        mw_data = extract_multiworld_chart_data(mw_results)
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
        mw_wg_data = extract_multiworld_chart_data(mw_wg_results)
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

    # Generate summary chart
    if minimal_data or full_data or mp_data or mw_data or mtmin_data or mtfull_data or ut_data:
        # Load the exclude list with reasons
        excluded_games = load_template_exclude_list(project_root, include_reasons=True)

        # Get metadata for intermittent failures
        minimal_meta = minimal_results.get('metadata', {}) if 'minimal_results' in locals() else None
        full_meta = full_results.get('metadata', {}) if 'full_results' in locals() else None

        summary_output = os.path.join(project_root, 'docs/json/developer/test-results/test-results-summary.md')
        summary_md = generate_summary_chart(minimal_data, full_data, mp_data, mw_data, mtmin_data, mtfull_data, ut_data, excluded_games, minimal_meta, full_meta, has_ut_random=has_random, has_ut_fixed=has_fixed)
        with open(summary_output, 'w') as f:
            f.write(summary_md)

    print("\n=== Chart Generation Complete ===")
    return 0


if __name__ == '__main__':
    exit(main())
