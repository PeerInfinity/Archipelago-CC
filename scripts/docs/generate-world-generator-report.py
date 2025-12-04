#!/usr/bin/env python3
"""
Generate markdown report from world generator test results.

This script reads the test-results.json file from the world generator tests
and generates a markdown summary report.

Usage:
    python scripts/docs/generate-world-generator-report.py
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List


def get_project_root() -> str:
    """Get the project root directory."""
    return str(Path(__file__).parent.parent.parent)


def load_results(results_file: str) -> Dict:
    """Load test results from JSON file."""
    if not os.path.exists(results_file):
        return None
    with open(results_file, 'r') as f:
        return json.load(f)


def get_status_emoji(success: bool, pass_fail: str = None) -> str:
    """Get status emoji for display."""
    if pass_fail == 'pass':
        return ':white_check_mark:'
    elif pass_fail == 'fail':
        return ':x:'
    elif success:
        return ':white_check_mark:'
    else:
        return ':x:'


def get_status_text(result: Dict, key: str) -> str:
    """Get status text for a result field."""
    if key not in result:
        return 'N/A'

    data = result[key]
    if isinstance(data, dict):
        if 'note' in data:
            return data['note']
        if 'pass_fail' in data:
            return data['pass_fail'].upper()
        if 'success' in data:
            return 'OK' if data['success'] else 'FAIL'
        if 'error' in data and data['error']:
            return 'ERROR'
    return 'N/A'


def generate_summary_table(results: Dict) -> str:
    """Generate the summary statistics table."""
    meta = results.get('metadata', {})

    lines = [
        "## Summary",
        "",
        "| Metric | Count |",
        "|--------|-------|",
        f"| Total Templates | {meta.get('total_templates', 0)} |",
        f"| Successful Original Generations | {meta.get('successful_generations', 0)} |",
        f"| Failed Original Generations | {meta.get('failed_generations', 0)} |",
        f"| Successful Test World Generations | {meta.get('successful_test_worlds', 0)} |",
        f"| Failed Test World Generations | {meta.get('failed_test_worlds', 0)} |",
        f"| Cross-Validation Passed | {meta.get('cross_validation_passed', 0)} |",
        f"| Cross-Validation Failed | {meta.get('cross_validation_failed', 0)} |",
        "",
    ]

    return '\n'.join(lines)


def generate_results_table(results: Dict) -> str:
    """Generate the detailed results table."""
    template_results = results.get('results', [])

    if not template_results:
        return "No test results available.\n"

    lines = [
        "## Detailed Results",
        "",
        "| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |",
        "|------|--------------|---------------|-----------|----------|--------------|------------------|",
    ]

    for result in sorted(template_results, key=lambda x: x.get('game_name', '')):
        game_name = result.get('game_name', 'Unknown')

        # Original generation
        orig_gen = result.get('original', {}).get('generation', {})
        orig_gen_status = ':white_check_mark:' if orig_gen.get('success') else ':x:'

        # Original spoiler test
        orig_test = result.get('original', {}).get('spoiler_test', {})
        orig_test_status = get_status_emoji(False, orig_test.get('pass_fail'))
        if orig_test.get('note'):
            orig_test_status = 'Skipped'

        # World generation
        world_gen = result.get('test_world', {}).get('world_generation', {})
        world_gen_status = ':white_check_mark:' if world_gen.get('success') else ':x:'
        if not orig_gen.get('success'):
            world_gen_status = '-'

        # Test world seed generation
        test_gen = result.get('test_world', {}).get('seed_generation', {})
        test_gen_status = ':white_check_mark:' if test_gen.get('success') else ':x:'
        if not world_gen.get('success'):
            test_gen_status = '-'

        # Test world spoiler test
        test_spoiler = result.get('test_world', {}).get('spoiler_test', {})
        test_spoiler_status = get_status_emoji(False, test_spoiler.get('pass_fail'))
        if test_spoiler.get('note'):
            test_spoiler_status = 'Skipped'
        if not test_gen.get('success'):
            test_spoiler_status = '-'

        # Cross-validation
        cross_val = result.get('test_world', {}).get('cross_validation', {})
        cross_val_status = get_status_emoji(False, cross_val.get('pass_fail'))
        if cross_val.get('note'):
            cross_val_status = 'Skipped'
        if cross_val.get('error'):
            cross_val_status = 'Error'
        if not test_gen.get('success'):
            cross_val_status = '-'

        lines.append(
            f"| {game_name} | {orig_gen_status} | {orig_test_status} | {world_gen_status} | "
            f"{test_gen_status} | {test_spoiler_status} | {cross_val_status} |"
        )

    lines.append("")
    return '\n'.join(lines)


def generate_failures_section(results: Dict) -> str:
    """Generate section listing all failures with details."""
    template_results = results.get('results', [])

    failures = []
    for result in template_results:
        errors = result.get('errors', [])
        if errors:
            failures.append({
                'game_name': result.get('game_name', 'Unknown'),
                'errors': errors
            })

    if not failures:
        return "## Failures\n\nNo failures recorded.\n"

    lines = [
        "## Failures",
        "",
        f"**{len(failures)} games had errors:**",
        "",
    ]

    for failure in sorted(failures, key=lambda x: x['game_name']):
        lines.append(f"### {failure['game_name']}")
        lines.append("")
        for error in failure['errors']:
            # Truncate long error messages
            if len(error) > 200:
                error = error[:200] + "..."
            lines.append(f"- {error}")
        lines.append("")

    return '\n'.join(lines)


def generate_report(results: Dict) -> str:
    """Generate the full markdown report."""
    meta = results.get('metadata', {})
    timestamp = meta.get('timestamp', datetime.now().isoformat())

    # Parse timestamp for display
    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        timestamp_display = dt.strftime('%Y-%m-%d %H:%M:%S UTC')
    except:
        timestamp_display = timestamp

    lines = [
        "# World Generator Test Results",
        "",
        f"**Generated:** {timestamp_display}",
        f"**Seed:** {meta.get('seed', 'N/A')}",
        "",
        "This report shows the results of round-trip testing the world generator.",
        "Each game's rules.json is converted to a `_test` world, and the generated",
        "world is validated to produce equivalent game logic.",
        "",
        "## Legend",
        "",
        "- :white_check_mark: - Success/Pass",
        "- :x: - Failure",
        "- `-` - Not applicable (previous step failed)",
        "- `Skipped` - Test was skipped",
        "- `Error` - An error occurred",
        "",
        "### Columns",
        "",
        "- **Original Gen**: Original world seed generation",
        "- **Original Test**: Spoiler test on original world",
        "- **World Gen**: World generator created _test world from rules.json",
        "- **Test Gen**: _test world seed generation",
        "- **Test Spoiler**: Spoiler test on _test world",
        "- **Cross-Validation**: Original sphere log validates against _test world",
        "",
    ]

    lines.append(generate_summary_table(results))
    lines.append(generate_results_table(results))
    lines.append(generate_failures_section(results))

    return '\n'.join(lines)


def main():
    project_root = get_project_root()

    # Input file
    results_file = os.path.join(
        project_root, 'scripts', 'output', 'world-generator', 'test-results.json'
    )

    # Output file
    output_file = os.path.join(
        project_root, 'docs', 'json', 'developer', 'test-results',
        'test-results-world-generator.md'
    )

    print(f"Loading results from: {results_file}")
    results = load_results(results_file)

    if not results:
        print(f"Error: Results file not found: {results_file}")
        return 1

    print(f"Generating report...")
    report = generate_report(results)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write report
    with open(output_file, 'w') as f:
        f.write(report)

    print(f"Report written to: {output_file}")

    # Print summary
    meta = results.get('metadata', {})
    print(f"\nSummary:")
    print(f"  Total templates: {meta.get('total_templates', 0)}")
    print(f"  Successful test worlds: {meta.get('successful_test_worlds', 0)}")
    print(f"  Cross-validation passed: {meta.get('cross_validation_passed', 0)}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
