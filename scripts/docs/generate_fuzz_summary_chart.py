#!/usr/bin/env python3
"""
Script to generate a summary chart combining all fuzz test results.

This script reads fuzz test results from multiple sources and generates
a unified summary markdown showing pass/fail status across:
- UT Fuzz Original
- UT Fuzz Modified
- UT Fuzz Hybrid
- Spoiler Fuzz
"""

import argparse
import glob
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Add parent directory to path to import from chart_generators and lib
sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, str(Path(__file__).parent.parent))
from chart_generators.utils import format_file_size, get_rules_json_size


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load test results from JSON file."""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not load {results_file}: {e}")
        return {}


def load_world_mapping(project_root: str) -> Dict[str, Dict[str, Any]]:
    """Load the world mapping from JSON files."""
    mapping = {}

    # Load official world mapping
    official_file = os.path.join(project_root, 'scripts/data/world-mapping.json')
    try:
        with open(official_file, 'r') as f:
            mapping = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not load official world mapping: {e}")

    # Load unofficial world mapping (apworlds) and merge
    unofficial_file = os.path.join(project_root, 'scripts/data/world-mapping-unofficial.json')
    try:
        with open(unofficial_file, 'r') as f:
            unofficial_mapping = json.load(f)
            mapping.update(unofficial_mapping)
    except FileNotFoundError:
        pass
    except json.JSONDecodeError as e:
        print(f"Warning: Could not parse unofficial world mapping: {e}")

    return mapping


def extract_ut_fuzz_results(results: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Extract game results from UT fuzz test data.

    Returns dict mapping game_name -> {passed, success_rate, total, success, failure, timeout}
    """
    game_results = {}

    if 'results' not in results:
        return game_results

    for template_filename, template_data in results['results'].items():
        world_info = template_data.get('world_info', {})
        game_name = world_info.get('game_name')

        if not game_name:
            game_name = template_filename.replace('.yaml', '').replace('_', ' ').title()

        ut_fuzz = template_data.get('ut_fuzz', {})
        passed = ut_fuzz.get('passed', False)
        total = ut_fuzz.get('total', 0)
        success = ut_fuzz.get('success', 0)
        failure = ut_fuzz.get('failure', 0)
        timeout = ut_fuzz.get('timeout', 0)

        success_rate = (success / total * 100) if total > 0 else 0

        game_results[game_name] = {
            'passed': passed,
            'success_rate': success_rate,
            'total': total,
            'success': success,
            'failure': failure,
            'timeout': timeout
        }

    return game_results


def extract_spoiler_fuzz_results(results: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Extract game results from spoiler fuzz test data.

    Returns dict mapping game_name -> {passed, success_rate, total, success, generation_failure, test_failure, timeout}
    """
    game_results = {}

    if 'results' not in results:
        return game_results

    for template_filename, template_data in results['results'].items():
        world_info = template_data.get('world_info', {})
        game_name = world_info.get('game_name')

        if not game_name:
            game_name = template_filename.replace('.yaml', '').replace('_', ' ').title()

        spoiler_fuzz = template_data.get('spoiler_fuzz', {})
        passed = spoiler_fuzz.get('passed', False)
        total = spoiler_fuzz.get('total', 0)
        success = spoiler_fuzz.get('success', 0)
        generation_failure = spoiler_fuzz.get('generation_failure', 0)
        test_failure = spoiler_fuzz.get('test_failure', 0)
        timeout = spoiler_fuzz.get('timeout', 0)

        success_rate = (success / total * 100) if total > 0 else 0

        game_results[game_name] = {
            'passed': passed,
            'success_rate': success_rate,
            'total': total,
            'success': success,
            'generation_failure': generation_failure,
            'test_failure': test_failure,
            'timeout': timeout
        }

    return game_results


def format_result_cell(result: Optional[Dict[str, Any]]) -> str:
    """Format a result as a table cell."""
    if result is None:
        return "—"

    if result['passed']:
        return "✅"
    else:
        rate = result['success_rate']
        if rate >= 90:
            return f"⚠️ {rate:.0f}%"
        elif rate >= 50:
            return f"🔶 {rate:.0f}%"
        else:
            return f"❌ {rate:.0f}%"


def generate_fuzz_summary_markdown(
    ut_original: Dict[str, Dict[str, Any]],
    ut_modified: Dict[str, Dict[str, Any]],
    ut_hybrid: Dict[str, Dict[str, Any]],
    spoiler_fuzz: Dict[str, Dict[str, Any]],
    world_mapping: Dict[str, Dict[str, Any]],
    project_root: str,
    world_source: str = "bundled"
) -> str:
    """Generate the fuzz summary markdown content."""

    # Get all unique game names across all test types
    all_games = sorted(set(
        list(ut_original.keys()) +
        list(ut_modified.keys()) +
        list(ut_hybrid.keys()) +
        list(spoiler_fuzz.keys())
    ))

    # Title
    title_suffix = " (APWorlds)" if world_source == "apworlds" else ""
    md_content = f"# Fuzz Test Results Summary{title_suffix}\n\n"

    md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

    # Navigation links
    md_content += "[<- Back to Main Test Results Summary](./test-results-summary.md)\n\n"

    if world_source == "apworlds":
        md_content += "[View Bundled Worlds Fuzz Results](./test-results-fuzz-summary.md)\n\n"
    else:
        md_content += "[View APWorlds Fuzz Results](./test-results-fuzz-summary-apworlds.md)\n\n"

    # Description
    md_content += "This summary combines results from fuzz tests that validate game configurations "
    md_content += "across randomized option combinations:\n\n"

    # Links to individual test docs
    if world_source == "apworlds":
        md_content += "- **UT Fuzz Original:** Universal Tracker (original) fuzz tests - [View Details](./test-results-ut-fuzz-apworlds-original.md)\n"
        md_content += "- **UT Fuzz Modified:** Universal Tracker (modified) fuzz tests - [View Details](./test-results-ut-fuzz-apworlds-modified.md)\n"
        md_content += "- **UT Fuzz Hybrid:** Universal Tracker (hybrid) fuzz tests - [View Details](./test-results-ut-fuzz-apworlds-hybrid.md)\n"
        md_content += "- **Spoiler Fuzz:** Frontend spoiler playthrough fuzz tests - [View Details](./test-results-spoiler-fuzz-apworlds.md)\n\n"
    else:
        md_content += "- **UT Fuzz Original:** Universal Tracker (original) fuzz tests - [View Details](./test-results-ut-fuzz-original.md)\n"
        md_content += "- **UT Fuzz Modified:** Universal Tracker (modified) fuzz tests - [View Details](./test-results-ut-fuzz-modified.md)\n"
        md_content += "- **UT Fuzz Hybrid:** Universal Tracker (hybrid) fuzz tests - [View Details](./test-results-ut-fuzz-hybrid.md)\n"
        md_content += "- **Spoiler Fuzz:** Frontend spoiler playthrough fuzz tests - [View Details](./test-results-spoiler-fuzz.md)\n\n"

    # Summary statistics
    md_content += "## Summary Statistics\n\n"

    # Count passes for each test type
    ut_original_passed = sum(1 for g in ut_original.values() if g['passed'])
    ut_modified_passed = sum(1 for g in ut_modified.values() if g['passed'])
    ut_hybrid_passed = sum(1 for g in ut_hybrid.values() if g['passed'])
    spoiler_passed = sum(1 for g in spoiler_fuzz.values() if g['passed'])

    ut_original_total = len(ut_original)
    ut_modified_total = len(ut_modified)
    ut_hybrid_total = len(ut_hybrid)
    spoiler_total = len(spoiler_fuzz)

    md_content += "### Individual Test Results\n\n"
    if ut_original_total > 0:
        md_content += f"- **UT Fuzz Original:** {ut_original_passed}/{ut_original_total} passed ({ut_original_passed/ut_original_total*100:.1f}%)\n"
    else:
        md_content += "- **UT Fuzz Original:** No results available\n"

    if ut_modified_total > 0:
        md_content += f"- **UT Fuzz Modified:** {ut_modified_passed}/{ut_modified_total} passed ({ut_modified_passed/ut_modified_total*100:.1f}%)\n"
    else:
        md_content += "- **UT Fuzz Modified:** No results available\n"

    if ut_hybrid_total > 0:
        md_content += f"- **UT Fuzz Hybrid:** {ut_hybrid_passed}/{ut_hybrid_total} passed ({ut_hybrid_passed/ut_hybrid_total*100:.1f}%)\n"
    else:
        md_content += "- **UT Fuzz Hybrid:** No results available\n"

    if spoiler_total > 0:
        md_content += f"- **Spoiler Fuzz:** {spoiler_passed}/{spoiler_total} passed ({spoiler_passed/spoiler_total*100:.1f}%)\n"
    else:
        md_content += "- **Spoiler Fuzz:** No results available\n"

    md_content += "\n"

    # Combined results
    md_content += "### Combined Results\n\n"

    # Count games passing different numbers of tests
    passing_counts = {4: 0, 3: 0, 2: 0, 1: 0, 0: 0}
    for game in all_games:
        passes = 0
        if game in ut_original and ut_original[game]['passed']:
            passes += 1
        if game in ut_modified and ut_modified[game]['passed']:
            passes += 1
        if game in ut_hybrid and ut_hybrid[game]['passed']:
            passes += 1
        if game in spoiler_fuzz and spoiler_fuzz[game]['passed']:
            passes += 1
        passing_counts[passes] += 1

    total_games = len(all_games)
    if total_games > 0:
        md_content += f"- **Games passing all 4 fuzz tests:** {passing_counts[4]}/{total_games} ({passing_counts[4]/total_games*100:.1f}%)\n"
        md_content += f"- **Games passing 3 fuzz tests:** {passing_counts[3]}/{total_games} ({passing_counts[3]/total_games*100:.1f}%)\n"
        md_content += f"- **Games passing 2 fuzz tests:** {passing_counts[2]}/{total_games} ({passing_counts[2]/total_games*100:.1f}%)\n"
        md_content += f"- **Games passing 1 fuzz test:** {passing_counts[1]}/{total_games} ({passing_counts[1]/total_games*100:.1f}%)\n"
        md_content += f"- **Games passing 0 fuzz tests:** {passing_counts[0]}/{total_games} ({passing_counts[0]/total_games*100:.1f}%)\n"

    md_content += "\n"

    # Main results table
    md_content += "## Test Results\n\n"

    # Build header with links
    if world_source == "apworlds":
        md_content += "| Game Name | [UT Original](./test-results-ut-fuzz-apworlds-original.md) | [UT Modified](./test-results-ut-fuzz-apworlds-modified.md) | [UT Hybrid](./test-results-ut-fuzz-apworlds-hybrid.md) | [Spoiler Fuzz](./test-results-spoiler-fuzz-apworlds.md) | Rules Size |\n"
    else:
        md_content += "| Game Name | [UT Original](./test-results-ut-fuzz-original.md) | [UT Modified](./test-results-ut-fuzz-modified.md) | [UT Hybrid](./test-results-ut-fuzz-hybrid.md) | [Spoiler Fuzz](./test-results-spoiler-fuzz.md) | Rules Size |\n"

    md_content += "|-----------|:------------:|:------------:|:----------:|:-------------:|:----------:|\n"

    for game in all_games:
        ut_orig_result = ut_original.get(game)
        ut_mod_result = ut_modified.get(game)
        ut_hyb_result = ut_hybrid.get(game)
        spoiler_result = spoiler_fuzz.get(game)

        ut_orig_cell = format_result_cell(ut_orig_result)
        ut_mod_cell = format_result_cell(ut_mod_result)
        ut_hyb_cell = format_result_cell(ut_hyb_result)
        spoiler_cell = format_result_cell(spoiler_result)

        # Get rules size
        rules_size_indicator = "N/A"
        if game in world_mapping:
            world_dir = world_mapping[game].get('world_directory')
            if project_root and world_dir:
                rules_size = get_rules_json_size(project_root, world_dir)
                if rules_size > 0:
                    rules_size_indicator = f"{rules_size / 1024:.1f}KB"

        md_content += f"| {game} | {ut_orig_cell} | {ut_mod_cell} | {ut_hyb_cell} | {spoiler_cell} | {rules_size_indicator} |\n"

    if not all_games:
        md_content += "| No data available | — | — | — | — | — |\n"

    # Notes section
    md_content += "\n## Notes\n\n"
    md_content += "- **✅:** All fuzz runs passed (100% success rate)\n"
    md_content += "- **⚠️ X%:** Most runs passed (90-99% success rate)\n"
    md_content += "- **🔶 X%:** Some runs passed (50-89% success rate)\n"
    md_content += "- **❌ X%:** Most runs failed (<50% success rate)\n"
    md_content += "- **—:** No test results available for this game\n"
    md_content += "- **Rules Size:** File size of rules.json for seed 1\n\n"

    md_content += "### About Fuzz Tests\n\n"
    md_content += "Fuzz tests validate game configurations by generating random YAML option combinations "
    md_content += "and running various tests:\n\n"
    md_content += "- **UT Fuzz:** Tests Universal Tracker's accessibility calculations against Python's sphere log\n"
    md_content += "- **Spoiler Fuzz:** Tests frontend spoiler playthrough with randomized configurations\n"

    return md_content


def main():
    parser = argparse.ArgumentParser(description='Generate fuzz test summary chart')
    parser.add_argument('--output', type=str, help='Output markdown file path')
    parser.add_argument('--world-source', type=str, choices=['bundled', 'apworlds'],
                        default='bundled', help='World source to generate summary for')

    args = parser.parse_args()

    # Get project root
    project_root = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

    # Load world mapping
    world_mapping = load_world_mapping(project_root)

    # Output directory
    output_dir = os.path.join(project_root, 'docs/json/developer/test-results')
    os.makedirs(output_dir, exist_ok=True)

    # Process both bundled and apworlds if no specific source requested
    sources_to_process = [args.world_source] if args.world_source else ['bundled', 'apworlds']

    for world_source in sources_to_process:
        # Determine file paths based on world source
        ut_fuzz_dir = os.path.join(project_root, 'scripts/output/ut-fuzz')
        spoiler_fuzz_dir = os.path.join(project_root, 'scripts/output/spoiler-fuzz')

        if world_source == 'apworlds':
            ut_original_file = os.path.join(ut_fuzz_dir, 'test-results-apworlds-original-fixed-seed.json')
            ut_modified_file = os.path.join(ut_fuzz_dir, 'test-results-apworlds-modified-fixed-seed.json')
            ut_hybrid_file = os.path.join(ut_fuzz_dir, 'test-results-apworlds-hybrid-fixed-seed.json')
            spoiler_fuzz_file = os.path.join(spoiler_fuzz_dir, 'test-results-apworlds-fixed-seed.json')
            output_filename = 'test-results-fuzz-summary-apworlds.md'
        else:
            ut_original_file = os.path.join(ut_fuzz_dir, 'test-results-original-fixed-seed.json')
            ut_modified_file = os.path.join(ut_fuzz_dir, 'test-results-modified-fixed-seed.json')
            ut_hybrid_file = os.path.join(ut_fuzz_dir, 'test-results-hybrid-fixed-seed.json')
            spoiler_fuzz_file = os.path.join(spoiler_fuzz_dir, 'test-results-fixed-seed.json')
            output_filename = 'test-results-fuzz-summary.md'

        # Load results
        ut_original_data = load_test_results(ut_original_file)
        ut_modified_data = load_test_results(ut_modified_file)
        ut_hybrid_data = load_test_results(ut_hybrid_file)
        spoiler_fuzz_data = load_test_results(spoiler_fuzz_file)

        # Extract game-level results
        ut_original = extract_ut_fuzz_results(ut_original_data)
        ut_modified = extract_ut_fuzz_results(ut_modified_data)
        ut_hybrid = extract_ut_fuzz_results(ut_hybrid_data)
        spoiler_fuzz = extract_spoiler_fuzz_results(spoiler_fuzz_data)

        # Check if we have any data
        if not any([ut_original, ut_modified, ut_hybrid, spoiler_fuzz]):
            print(f"No fuzz test results found for {world_source}")
            continue

        # Generate markdown
        md_content = generate_fuzz_summary_markdown(
            ut_original, ut_modified, ut_hybrid, spoiler_fuzz,
            world_mapping, project_root, world_source
        )

        # Determine output path
        if args.output and len(sources_to_process) == 1:
            output_path = os.path.join(project_root, args.output) if not os.path.isabs(args.output) else args.output
        else:
            output_path = os.path.join(output_dir, output_filename)

        # Write output
        with open(output_path, 'w') as f:
            f.write(md_content)

        print(f"Fuzz summary saved to: {output_path}")

    return 0


if __name__ == '__main__':
    exit(main())
