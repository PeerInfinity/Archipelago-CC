#!/usr/bin/env python3
"""
Script to generate charts from Universal Tracker comparison test results.

This script reads UT comparison test results from JSON files and generates
markdown reports showing the comparison status for each game template.

The UT comparison test validates that Universal Tracker's accessibility
calculations match the Python-generated sphere log at each step.
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
            'has_re_gen_passthrough': has_re_gen_passthrough
        })

    chart_data.sort(key=lambda x: x['game_name'])
    return chart_data


def generate_ut_comparison_markdown(chart_data: List[Dict[str, Any]],
                                     metadata: Dict[str, Any]) -> str:
    """Generate a markdown table for UT comparison test data."""
    md_content = "# Universal Tracker Comparison Test Results\n\n"

    # Add link to summary document
    md_content += "[<- Back to Test Results Summary](./test-results-summary.md)\n\n"

    if metadata:
        md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"
        runs_per_template = metadata.get('runs_per_template', 1)
        if runs_per_template > 1:
            md_content += f"**Runs Per Template:** {runs_per_template}\n\n"

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
        md_content += f"- **Consistent Results:** {consistent} ({consistent/total_games*100:.1f}%)\n"
        md_content += f"- **With re_gen_passthrough:** {with_passthrough} ({with_passthrough/total_games*100:.1f}%)\n\n"

    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Result | Consistent | Spheres | Mismatches (min) | Mismatches (max) | Last Good (min) | Last Good (max) | re_gen |\n"
    md_content += "|-----------|:------:|:----------:|:-------:|:----------------:|:----------------:|:---------------:|:---------------:|:------:|\n"

    for data in chart_data:
        game_name = data['game_name']
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

        md_content += f"| {game_name} | {result_display} | {consistent_display} | {total_display} | {lowest_mismatch_display} | {highest_mismatch_display} | {lowest_before_display} | {highest_before_display} | {passthrough_display} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - | - | - | - |\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Result:** ✅ if UT matches Python sphere log exactly in ALL runs, ❌ otherwise\n"
    md_content += "- **Consistent:** ✅ if all test runs had the same mismatch count, ❌ if results varied\n"
    md_content += "- **Spheres:** The last sphere index in the game (shows sphere numbering from logs)\n"
    md_content += "- **Mismatches (min/max):** Lowest and highest number of mismatched spheres across all runs\n"
    md_content += "- **Last Good (min/max):** Lowest and highest sphere index reached before first mismatch across all runs\n"
    md_content += "- **re_gen:** ✅ if game implements `re_gen_passthrough` for UT support, ⚫ otherwise\n\n"
    md_content += "Games with `re_gen_passthrough` support pass slot data to UT for accurate regeneration.\n"
    md_content += "Games without this support may have significant mismatches due to randomization differences.\n"

    return md_content


def main():
    parser = argparse.ArgumentParser(description='Generate UT comparison test results chart')
    parser.add_argument('--input-file', type=str, help='Input JSON file path')
    parser.add_argument('--output-file', type=str, help='Output markdown file path')

    args = parser.parse_args()

    # Script is at scripts/docs/generate_ut_comparison_chart.py, go up 2 levels to reach project root
    project_root = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

    # Default paths
    if args.input_file:
        input_path = os.path.join(project_root, args.input_file) if not os.path.isabs(args.input_file) else args.input_file
    else:
        input_path = os.path.join(project_root, 'scripts/output/ut-comparison/test-results.json')

    if args.output_file:
        output_path = os.path.join(project_root, args.output_file) if not os.path.isabs(args.output_file) else args.output_file
    else:
        output_path = os.path.join(project_root, 'docs/json/developer/test-results/test-results-ut-comparison.md')

    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        return 1

    results = load_test_results(input_path)
    if not results:
        return 1

    metadata = results.get('metadata', {})
    chart_data = extract_ut_comparison_chart_data(results)

    md_content = generate_ut_comparison_markdown(chart_data, metadata)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        f.write(md_content)

    print(f"UT comparison chart saved to: {output_path}")
    return 0


if __name__ == '__main__':
    exit(main())
