"""
Multitemplate test chart data extraction and markdown generation.
"""

from datetime import datetime
from typing import Dict, Any, List, Tuple


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

        md_content += f"## {game_name}\n\n"
        md_content += f"**Results:** {passed}/{total} passed ({passed/total*100:.1f}%)\n\n"

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
    md_content += "**Pass Criteria:** Generation errors = 0, Max spheres > 0, Spoiler test completed successfully\n\n"
    md_content += "**Invalid Configurations:** Templates marked as Invalid have settings that cannot be satisfied by the game's logic (FillError). These represent impossible configurations, not bugs.\n"

    return md_content
