#!/usr/bin/env python3
"""
Script to generate a chart from template-test-results.json showing test results
for all game templates.
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Tuple


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load the template test results from JSON file."""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading results file {results_file}: {e}")
        return {}


def extract_chart_data(results: Dict[str, Any]) -> List[Tuple[str, str, int, float, float]]:
    """
    Extract chart data from results.
    Returns list of tuples: (game_name, pass_fail, gen_error_count, sphere_reached, max_spheres)
    """
    chart_data = []
    
    if 'results' not in results:
        return chart_data
    
    for template_name, template_data in results['results'].items():
        # Extract game name (convert from template filename to readable name)
        game_name = template_data.get('game_name', template_name.replace('.yaml', ''))
        game_name = game_name.replace('_', ' ').title()
        
        # Extract original pass/fail result
        original_pass_fail = template_data.get('spoiler_test', {}).get('pass_fail', 'unknown')
        
        # Extract generation error count
        gen_error_count = template_data.get('generation', {}).get('error_count', 0)
        
        # Extract sphere reached (where the test stopped or failed)
        sphere_reached = template_data.get('spoiler_test', {}).get('sphere_reached', 0)
        
        # Extract max spheres (total spheres available)
        max_spheres = template_data.get('spoiler_test', {}).get('total_spheres', 0)
        
        # Apply stricter pass criteria: must have 0 generation errors AND max_spheres > 0
        if original_pass_fail.lower() == 'passed' and gen_error_count == 0 and max_spheres > 0:
            pass_fail = 'Passed'
        elif original_pass_fail.lower() == 'failed':
            pass_fail = 'Failed'
        else:
            # Mark as failed if it doesn't meet strict criteria, even if spoiler test "passed"
            pass_fail = 'Failed'
        
        chart_data.append((game_name, pass_fail, gen_error_count, sphere_reached, max_spheres))
    
    # Sort by game name for consistent ordering
    chart_data.sort(key=lambda x: x[0])
    
    return chart_data


def generate_markdown_chart(chart_data: List[Tuple[str, str, int, float, float]], 
                           metadata: Dict[str, Any]) -> str:
    """Generate a markdown table with the chart data."""
    
    # Header
    md_content = "# Archipelago Template Test Results Chart\n\n"
    
    # Add metadata
    if metadata:
        created = metadata.get('created', 'Unknown')
        last_updated = metadata.get('last_updated', 'Unknown')
        script_version = metadata.get('script_version', 'Unknown')
        
        md_content += f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        md_content += f"**Source Data Created:** {created}\n\n"
        md_content += f"**Source Data Last Updated:** {last_updated}\n\n"
        md_content += f"**Script Version:** {script_version}\n\n"
    
    # Summary statistics
    if chart_data:
        total_games = len(chart_data)
        passed = sum(1 for _, pass_fail, _, _, _ in chart_data if pass_fail.lower() == 'passed')
        failed = sum(1 for _, pass_fail, _, _, _ in chart_data if pass_fail.lower() == 'failed')
        unknown = total_games - passed - failed
        
        md_content += "## Summary\n\n"
        md_content += f"- **Total Games:** {total_games}\n"
        md_content += f"- **Passed:** {passed} ({passed/total_games*100:.1f}%)\n"
        md_content += f"- **Failed:** {failed} ({failed/total_games*100:.1f}%)\n"
        if unknown > 0:
            md_content += f"- **Unknown/Error:** {unknown} ({unknown/total_games*100:.1f}%)\n"
        md_content += "\n"
    
    # Table header
    md_content += "## Test Results\n\n"
    md_content += "| Game Name | Test Result | Gen Errors | Sphere Reached | Max Spheres | Progress |\n"
    md_content += "|-----------|-------------|------------|----------------|-------------|----------|\n"
    
    # Table rows
    for game_name, pass_fail, gen_error_count, sphere_reached, max_spheres in chart_data:
        # Create a progress indicator
        if max_spheres > 0:
            progress_pct = (sphere_reached / max_spheres) * 100
            if progress_pct >= 100:
                progress = "✅ 100%"
            elif progress_pct >= 75:
                progress = f"🟡 {progress_pct:.1f}%"
            elif progress_pct >= 50:
                progress = f"🟠 {progress_pct:.1f}%"
            else:
                progress = f"🔴 {progress_pct:.1f}%"
        else:
            progress = "❓ N/A"
        
        # Add status emoji to test result
        if pass_fail.lower() == 'passed':
            result_display = "✅ Passed"
        elif pass_fail.lower() == 'failed':
            result_display = "❌ Failed"
        else:
            result_display = f"❓ {pass_fail}"
        
        # Format sphere values (show as integers if they're whole numbers)
        sphere_reached_str = f"{sphere_reached:g}"  # g format removes trailing zeros
        max_spheres_str = f"{max_spheres:g}"
        
        md_content += f"| {game_name} | {result_display} | {gen_error_count} | {sphere_reached_str} | {max_spheres_str} | {progress} |\n"
    
    if not chart_data:
        md_content += "| No data available | - | - | - | - | - |\n"
    
    # Footer notes
    md_content += "\n## Notes\n\n"
    md_content += "- **Gen Errors:** Number of errors during world generation\n"
    md_content += "- **Sphere Reached:** The logical sphere the test reached before completion/failure\n"
    md_content += "- **Max Spheres:** Total logical spheres available in the game\n"
    md_content += "- **Progress:** Percentage of logical spheres completed\n"
    md_content += "\n"
    md_content += "**Pass Criteria:** A test is marked as ✅ Passed only if:\n"
    md_content += "- Generation errors = 0 (no errors during world generation)\n"
    md_content += "- Max spheres > 0 (game has logical progression spheres)\n"
    md_content += "- Spoiler test completed successfully\n"
    md_content += "\n"
    md_content += "Progress indicators:\n"
    md_content += "- ✅ 100% - Completed all spheres\n"
    md_content += "- 🟡 75%+ - Most spheres completed\n"
    md_content += "- 🟠 50%+ - Half spheres completed\n"
    md_content += "- 🔴 <50% - Less than half completed\n"
    md_content += "- ❓ N/A - No sphere data available\n"
    
    return md_content


def main():
    parser = argparse.ArgumentParser(description='Generate test results chart from template-test-results.json')
    parser.add_argument(
        '--input-file',
        type=str,
        default='scripts/output/template-test-results.json',
        help='Input JSON file path (default: scripts/output/template-test-results.json)'
    )
    parser.add_argument(
        '--output-file',
        type=str,
        default='docs/json/developer/guides/test-results.md',
        help='Output markdown file path (default: docs/json/developer/guides/test-results.md)'
    )
    
    args = parser.parse_args()
    
    # Determine project root and resolve paths
    project_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
    input_path = os.path.join(project_root, args.input_file)
    output_path = os.path.join(project_root, args.output_file)
    
    # Check if input file exists
    if not os.path.exists(input_path):
        print(f"Error: Input file not found: {input_path}")
        print("Please run test-all-templates.py first to generate the results file.")
        return 1
    
    # Load test results
    print(f"Loading test results from: {input_path}")
    results = load_test_results(input_path)
    
    if not results:
        print("No results found or failed to load results file.")
        return 1
    
    # Extract chart data
    chart_data = extract_chart_data(results)
    metadata = results.get('metadata', {})
    
    # Generate markdown chart
    print(f"Generating chart with {len(chart_data)} games...")
    md_content = generate_markdown_chart(chart_data, metadata)
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # Write to file
    try:
        with open(output_path, 'w') as f:
            f.write(md_content)
        print(f"Chart saved to: {output_path}")
    except IOError as e:
        print(f"Error writing output file: {e}")
        return 1
    
    return 0


if __name__ == '__main__':
    exit(main())