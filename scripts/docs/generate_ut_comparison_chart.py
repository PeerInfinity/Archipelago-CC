#!/usr/bin/env python3
"""
Script to generate charts from Universal Tracker comparison test results.

This script reads UT comparison test results from JSON files and generates
markdown reports showing the comparison status for each game template.

The UT comparison test validates that Universal Tracker's accessibility
calculations match the Python-generated sphere log at each step.

This script processes both random seed and fixed seed test results,
generating separate markdown files for each with cross-links between them:
- test-results-ut-comparison-random-seed.md
- test-results-ut-comparison-fixed-seed.md
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load the UT comparison test results from JSON file."""
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
            # Extract just the game_name -> world_directory mapping
            return {game_name: info['world_directory']
                    for game_name, info in data.items()
                    if 'world_directory' in info}
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Warning: Could not load world mapping file {mapping_file}: {e}")
        return {}


def extract_ut_comparison_chart_data(results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Extract UT comparison test chart data from results.

    Returns list of dicts with:
        - game_name: str
        - passed: bool
        - results_consistent: bool
        - total_spheres: int
        - last_sphere_index: str or None
        - lowest_mismatch_count: int
        - highest_mismatch_count: int
        - lowest_sphere_before_mismatch: str or None
        - highest_sphere_before_mismatch: str or None
        - has_re_gen_passthrough: bool

    The results JSON format is expected to be:
    {
      "metadata": {...},
      "results": {
        "Adventure.yaml": {
          "ut_comparison": {
            "passed": true,
            "total_spheres": 10,
            "last_sphere_index": "6.1",
            "lowest_mismatch_count": 0,
            "highest_mismatch_count": 2,
            "lowest_sphere_before_mismatch": "1.1",
            "highest_sphere_before_mismatch": "1.2",
            "results_consistent": true,
            "num_runs": 3,
            "run_details": [...]
          },
          "world_info": {
            "game_name_from_yaml": "Adventure",
            "has_re_gen_passthrough": false
          },
          "timestamp": "2025-12-01T..."
        },
        ...
      }
    }
    """
    chart_data = []

    if 'results' not in results:
        return chart_data

    for template_filename, template_data in results['results'].items():
        world_info = template_data.get('world_info', {})
        game_name = world_info.get('game_name_from_yaml')

        if not game_name:
            game_name = template_filename.replace('.yaml', '').replace('_', ' ').title()

        has_re_gen_passthrough = world_info.get('has_re_gen_passthrough', False)

        ut_comparison = template_data.get('ut_comparison', {})
        passed = ut_comparison.get('passed', False)
        total_spheres = ut_comparison.get('total_spheres', 0)
        last_sphere_index = ut_comparison.get('last_sphere_index')
        lowest_mismatch_count = ut_comparison.get('lowest_mismatch_count', 0)
        highest_mismatch_count = ut_comparison.get('highest_mismatch_count', 0)
        lowest_sphere_before_mismatch = ut_comparison.get('lowest_sphere_before_mismatch')
        highest_sphere_before_mismatch = ut_comparison.get('highest_sphere_before_mismatch')
        results_consistent = ut_comparison.get('results_consistent', True)
        num_runs = ut_comparison.get('num_runs', 1)

        chart_data.append({
            'game_name': game_name,
            'passed': passed,
            'results_consistent': results_consistent,
            'total_spheres': total_spheres,
            'last_sphere_index': last_sphere_index,
            'lowest_mismatch_count': lowest_mismatch_count,
            'highest_mismatch_count': highest_mismatch_count,
            'lowest_sphere_before_mismatch': lowest_sphere_before_mismatch,
            'highest_sphere_before_mismatch': highest_sphere_before_mismatch,
            'has_re_gen_passthrough': has_re_gen_passthrough,
            'num_runs': num_runs
        })

    chart_data.sort(key=lambda x: x['game_name'])
    return chart_data


def generate_ut_comparison_markdown(chart_data: List[Dict[str, Any]],
                                     metadata: Dict[str, Any],
                                     world_mapping: Dict[str, str],
                                     seed_type: str = None,
                                     other_results_link: str = None) -> str:
    """
    Generate a markdown table for UT comparison test data.

    Args:
        chart_data: List of test result data dicts
        metadata: Metadata from the test results
        world_mapping: Mapping of game names to world directories
        seed_type: Either "random" or "fixed" to indicate which seed type this is
        other_results_link: Relative path to the other results file for cross-linking
    """
    # Determine title based on seed type
    if seed_type == "random":
        title_suffix = " (Random Seed)"
    elif seed_type == "fixed":
        title_suffix = " (Fixed Seed)"
    else:
        title_suffix = ""

    md_content = f"# Universal Tracker Comparison Test Results{title_suffix}\n\n"

    # Add navigation links
    md_content += "[<- Back to Test Results Summary](./test-results-summary.md) | "
    md_content += "[How This Test Works](../guides/ut-comparison-testing.md)\n\n"

    # Add cross-link to other results if available
    if other_results_link:
        if seed_type == "random":
            md_content += f"**See also:** [Fixed Seed Results]({other_results_link}) - Tests run with seed=1 for reproducibility\n\n"
        elif seed_type == "fixed":
            md_content += f"**See also:** [Random Seed Results]({other_results_link}) - Tests run with random seeds for variety\n\n"

    if metadata:
        md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"

        # Show seed information
        seed_mode = metadata.get('seed_mode', metadata.get('seed', 'Unknown'))
        if seed_type == "random":
            md_content += f"**Seed Mode:** Random (different seed for each test)\n\n"
        elif seed_type == "fixed":
            fixed_seed = metadata.get('seed', '1')
            md_content += f"**Seed Mode:** Fixed (seed={fixed_seed})\n\n"

        # Get runs_per_template from metadata, or fall back to num_runs from first result
        runs_per_template = metadata.get('runs_per_template')
        if runs_per_template is None and chart_data:
            # Fall back: check num_runs from the first result's ut_comparison data
            runs_per_template = chart_data[0].get('num_runs', 1)
        if runs_per_template is None:
            runs_per_template = 1
        md_content += f"**Test Runs Per Game:** {runs_per_template}\n\n"

    if chart_data:
        total_games = len(chart_data)
        passed = sum(1 for d in chart_data if d['passed'])
        failed = total_games - passed
        with_passthrough = sum(1 for d in chart_data if d['has_re_gen_passthrough'])
        consistent = sum(1 for d in chart_data if d['results_consistent'])

        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {total_games}\n"
        md_content += f"- **Passed:** {passed} ({passed/total_games*100:.1f}%)\n"
        md_content += f"- **Failed:** {failed} ({failed/total_games*100:.1f}%)\n"
        md_content += f"- **Consistent Across Runs:** {consistent} ({consistent/total_games*100:.1f}%) - UT produced same result each run\n"
        md_content += f"- **With re_gen_passthrough:** {with_passthrough} ({with_passthrough/total_games*100:.1f}%)\n\n"

    md_content += "## Test Results\n\n"
    md_content += "Click on a game name to load the JSON frontend and run the UT comparison spoiler test, "
    md_content += "which will stop at the sphere with the first conflict.\n\n"
    md_content += "| Game Name | Result | Consistent | Spheres | Mismatches (min) | Mismatches (max) | Last Good (min) | Last Good (max) | re_gen |\n"
    md_content += "|-----------|:------:|:----------:|:-------:|:----------------:|:----------------:|:---------------:|:---------------:|:------:|\n"

    for data in chart_data:
        game_name = data['game_name']
        # Get world directory for creating the link
        world_dir = world_mapping.get(game_name)
        if world_dir:
            game_link = f"[{game_name}](https://peerinfinity.github.io/Archipelago-CC/?mode=test-spoilers-headed&game={world_dir}&ut=true)"
        else:
            game_link = game_name  # No link if world directory not found
        passed = data['passed']
        results_consistent = data['results_consistent']
        total_spheres = data['total_spheres']
        last_sphere_index = data['last_sphere_index']
        lowest_mismatch_count = data['lowest_mismatch_count']
        highest_mismatch_count = data['highest_mismatch_count']
        lowest_sphere_before_mismatch = data['lowest_sphere_before_mismatch']
        highest_sphere_before_mismatch = data['highest_sphere_before_mismatch']
        has_re_gen_passthrough = data['has_re_gen_passthrough']

        # Test result: green checkmark or red X
        result_display = "✅" if passed else "❌"

        # Consistent results: green checkmark or red X
        consistent_display = "✅" if results_consistent else "❌"

        # Total spheres: show the last sphere index
        total_display = last_sphere_index if last_sphere_index else str(total_spheres)

        # Mismatch counts
        lowest_mismatch_display = str(lowest_mismatch_count)
        highest_mismatch_display = str(highest_mismatch_count)

        # Sphere before first mismatch (last good sphere)
        lowest_before_display = lowest_sphere_before_mismatch if lowest_sphere_before_mismatch else "-"
        highest_before_display = highest_sphere_before_mismatch if highest_sphere_before_mismatch else "-"

        # re_gen_passthrough: green checkmark or black dot
        passthrough_display = "✅" if has_re_gen_passthrough else "⚫"

        md_content += f"| {game_link} | {result_display} | {consistent_display} | {total_display} | {lowest_mismatch_display} | {highest_mismatch_display} | {lowest_before_display} | {highest_before_display} | {passthrough_display} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - | - |\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Result:** ✅ if UT matches Python sphere log exactly in ALL runs, ❌ otherwise\n"
    md_content += "- **Consistent:** ✅ if UT produced the same mismatch count across all test runs, ❌ if results varied between runs. "
    md_content += "Inconsistent results indicate UT's world regeneration differs between runs (not a determinism bug in generation).\n"
    md_content += "- **Spheres:** The last sphere index in the game (shows sphere numbering from logs)\n"
    md_content += "- **Mismatches (min/max):** Lowest and highest number of mismatched spheres across all runs\n"
    md_content += "- **Last Good (min/max):** Lowest and highest sphere index reached before first mismatch across all runs\n"
    md_content += "- **re_gen:** ✅ if game implements `re_gen_passthrough` for UT support, ⚫ otherwise\n\n"
    md_content += "### Understanding Results\n\n"
    md_content += "Games with `re_gen_passthrough` support pass slot data to UT for accurate world regeneration. "
    md_content += "For these games, any mismatch is a bug that should be reported.\n\n"
    md_content += "Games **without** `re_gen_passthrough` may have mismatches due to randomization differences when UT regenerates the world. "
    md_content += "This is expected behavior, not a bug. The fixed seed tests help isolate whether mismatches are due to "
    md_content += "randomization (inconsistent results) or logic differences (consistent failures).\n"

    return md_content


def main():
    parser = argparse.ArgumentParser(description='Generate UT comparison test results chart')
    parser.add_argument('--random-results', type=str,
                        help='Path to random seed test results JSON')
    parser.add_argument('--fixed-results', type=str,
                        help='Path to fixed seed test results JSON')

    args = parser.parse_args()

    # Script is at scripts/docs/generate_ut_comparison_chart.py, go up 2 levels to reach project root
    project_root = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

    # Load world mapping for creating game links
    world_mapping = load_world_mapping(project_root)

    # Default paths for results files
    random_results_path = args.random_results
    if random_results_path:
        random_results_path = os.path.join(project_root, random_results_path) if not os.path.isabs(random_results_path) else random_results_path
    else:
        random_results_path = os.path.join(project_root, 'scripts/output/ut-comparison/test-results-random-seed.json')

    fixed_results_path = args.fixed_results
    if fixed_results_path:
        fixed_results_path = os.path.join(project_root, fixed_results_path) if not os.path.isabs(fixed_results_path) else fixed_results_path
    else:
        fixed_results_path = os.path.join(project_root, 'scripts/output/ut-comparison/test-results-fixed-seed.json')

    # Output paths for markdown files
    output_dir = os.path.join(project_root, 'docs/json/developer/test-results')
    random_output_path = os.path.join(output_dir, 'test-results-ut-comparison-random-seed.md')
    fixed_output_path = os.path.join(output_dir, 'test-results-ut-comparison-fixed-seed.md')

    # Check which result files exist
    has_random = os.path.exists(random_results_path)
    has_fixed = os.path.exists(fixed_results_path)

    if not has_random and not has_fixed:
        print(f"Error: No result files found.")
        print(f"  Looked for random: {random_results_path}")
        print(f"  Looked for fixed: {fixed_results_path}")
        return 1

    os.makedirs(output_dir, exist_ok=True)
    files_generated = []

    # Process random seed results
    if has_random:
        random_results = load_test_results(random_results_path)
        if random_results:
            random_metadata = random_results.get('metadata', {})
            random_chart_data = extract_ut_comparison_chart_data(random_results)

            # Determine cross-link (only if fixed results also exist)
            other_link = './test-results-ut-comparison-fixed-seed.md' if has_fixed else None

            random_md = generate_ut_comparison_markdown(
                random_chart_data,
                random_metadata,
                world_mapping,
                seed_type="random",
                other_results_link=other_link
            )

            with open(random_output_path, 'w') as f:
                f.write(random_md)

            print(f"Random seed chart saved to: {random_output_path}")
            files_generated.append(random_output_path)
    else:
        print(f"Skipping random seed results (file not found: {random_results_path})")

    # Process fixed seed results
    if has_fixed:
        fixed_results = load_test_results(fixed_results_path)
        if fixed_results:
            fixed_metadata = fixed_results.get('metadata', {})
            fixed_chart_data = extract_ut_comparison_chart_data(fixed_results)

            # Determine cross-link (only if random results also exist)
            other_link = './test-results-ut-comparison-random-seed.md' if has_random else None

            fixed_md = generate_ut_comparison_markdown(
                fixed_chart_data,
                fixed_metadata,
                world_mapping,
                seed_type="fixed",
                other_results_link=other_link
            )

            with open(fixed_output_path, 'w') as f:
                f.write(fixed_md)

            print(f"Fixed seed chart saved to: {fixed_output_path}")
            files_generated.append(fixed_output_path)
    else:
        print(f"Skipping fixed seed results (file not found: {fixed_results_path})")

    if files_generated:
        print(f"\nGenerated {len(files_generated)} markdown file(s)")
        return 0
    else:
        print("No files were generated due to errors loading results")
        return 1


if __name__ == '__main__':
    exit(main())
