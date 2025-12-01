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


def extract_ut_comparison_chart_data(results: Dict[str, Any]) -> List[Tuple[str, str, int, int, Optional[str], bool]]:
    """
    Extract UT comparison test chart data from results.

    Returns list of tuples: (game_name, pass_fail, total_spheres, spheres_matched,
                             first_mismatch_sphere, has_re_gen_passthrough)

    The results JSON format is expected to be:
    {
      "metadata": {...},
      "results": {
        "Adventure.yaml": {
          "ut_comparison": {
            "passed": true,
            "first_mismatch_sphere": null,
            "total_spheres": 10,
            "spheres_matched": 10,
            "mismatch_details": {...}  // Only present if failed
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
        spheres_matched = ut_comparison.get('spheres_matched', 0)
        first_mismatch_sphere = ut_comparison.get('first_mismatch_sphere')

        pass_fail = 'Passed' if passed else 'Failed'

        chart_data.append((
            game_name, pass_fail, total_spheres, spheres_matched,
            first_mismatch_sphere, has_re_gen_passthrough
        ))

    chart_data.sort(key=lambda x: x[0])
    return chart_data


def generate_ut_comparison_markdown(chart_data: List[Tuple[str, str, int, int, Optional[str], bool]],
                                     metadata: Dict[str, Any]) -> str:
    """Generate a markdown table for UT comparison test data."""
    md_content = "# Universal Tracker Comparison Test Results\n\n"

    # Add link to summary document
    md_content += "[<- Back to Test Results Summary](./test-results-summary.md)\n\n"

    if metadata:
        md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"**Source Data Created:** {metadata.get('created', 'Unknown')}\n\n"
        md_content += f"**Source Data Last Updated:** {metadata.get('last_updated', 'Unknown')}\n\n"

    if chart_data:
        total_games = len(chart_data)
        passed = sum(1 for _, pf, *_ in chart_data if pf.lower() == 'passed')
        failed = total_games - passed
        with_passthrough = sum(1 for *_, has_pt in chart_data if has_pt)

        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {total_games}\n"
        md_content += f"- **Passed:** {passed} ({passed/total_games*100:.1f}%)\n"
        md_content += f"- **Failed:** {failed} ({failed/total_games*100:.1f}%)\n"
        md_content += f"- **With re_gen_passthrough:** {with_passthrough} ({with_passthrough/total_games*100:.1f}%)\n\n"

    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Test Result | Total Spheres | Spheres Matched | First Mismatch | re_gen_passthrough |\n"
    md_content += "|-----------|-------------|---------------|-----------------|----------------|--------------------|\n"

    for (game_name, pass_fail, total_spheres, spheres_matched,
         first_mismatch_sphere, has_re_gen_passthrough) in chart_data:

        if pass_fail.lower() == 'passed':
            result_display = "PASS"
        else:
            result_display = "FAIL"

        first_mismatch_display = first_mismatch_sphere if first_mismatch_sphere else "-"
        passthrough_display = "Yes" if has_re_gen_passthrough else "No"

        md_content += f"| {game_name} | {result_display} | {total_spheres} | {spheres_matched} | {first_mismatch_display} | {passthrough_display} |\n"

    if not chart_data:
        md_content += "| No data available | - | - | - | - | - |\n"

    md_content += "\n## Notes\n\n"
    md_content += "- **Test Result:** PASS if UT matches Python sphere log exactly, FAIL otherwise\n"
    md_content += "- **Total Spheres:** Total number of logical spheres in the game\n"
    md_content += "- **Spheres Matched:** Number of spheres where UT matched Python sphere log\n"
    md_content += "- **First Mismatch:** The sphere index where the first mismatch occurred\n"
    md_content += "- **re_gen_passthrough:** Whether the game implements `re_gen_passthrough` for UT support\n\n"
    md_content += "Games with `re_gen_passthrough` support pass slot data to UT for accurate regeneration.\n"
    md_content += "Games without this support may have significant mismatches due to randomization differences.\n"

    return md_content


def main():
    parser = argparse.ArgumentParser(description='Generate UT comparison test results chart')
    parser.add_argument('--input-file', type=str, help='Input JSON file path')
    parser.add_argument('--output-file', type=str, help='Output markdown file path')

    args = parser.parse_args()

    # Script is at scripts/docs/generate-ut-comparison-chart.py, go up 2 levels to reach project root
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
