#!/usr/bin/env python3
"""
Generate markdown report from world generator second pass test results.

This script reads the test-results.json file from the second pass tests
and generates a markdown summary report showing which worlds are stable
(identical on re-generation) vs unstable (different on re-generation).

Usage:
    python scripts/docs/generate-world-generator-second-pass-report.py
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


def get_project_root() -> str:
    """Get the project root directory."""
    return str(Path(__file__).parent.parent.parent)


def load_results(results_file: str) -> Optional[Dict]:
    """Load test results from JSON file."""
    if not os.path.exists(results_file):
        return None
    with open(results_file, 'r') as f:
        return json.load(f)


def compute_summary_stats(results: Dict) -> Dict:
    """Compute summary statistics from results data."""
    template_results = results.get('results', {})

    stats = {
        'total_templates': 0,
        'identical_count': 0,
        'different_count': 0,
        'error_count': 0,
        'first_pass_missing': 0,
        'seed_gen_failed': 0,
        'world_gen_failed': 0,
    }

    for game_name, result in template_results.items():
        stats['total_templates'] += 1

        # Check for errors
        errors = result.get('errors', {})
        first_pass_errors = errors.get('first_pass', [])
        second_pass_errors = errors.get('second_pass', [])
        comparison_errors = errors.get('comparison', [])

        if first_pass_errors:
            stats['first_pass_missing'] += 1
            stats['error_count'] += 1
            continue

        # Check seed generation
        seed_gen = result.get('second_pass', {}).get('seed_generation', {})
        if not seed_gen.get('success'):
            stats['seed_gen_failed'] += 1
            stats['error_count'] += 1
            continue

        # Check world generation
        world_gen = result.get('second_pass', {}).get('world_generation', {})
        if not world_gen.get('success'):
            stats['world_gen_failed'] += 1
            stats['error_count'] += 1
            continue

        # Check comparison
        comparison = result.get('comparison', {})
        if comparison.get('identical'):
            stats['identical_count'] += 1
        elif comparison.get('success'):
            stats['different_count'] += 1
        else:
            stats['error_count'] += 1

    return stats


def generate_report(results: Dict) -> str:
    """Generate the markdown report."""
    meta = results.get('metadata', {})
    template_results = results.get('results', {})

    # Get timestamp
    timestamp = meta.get('timestamp', datetime.now().isoformat())
    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        timestamp_display = dt.strftime('%Y-%m-%d %H:%M:%S UTC')
    except:
        timestamp_display = timestamp

    seed = meta.get('seed', 'N/A')
    canonical = meta.get('canonical_seed1', False)
    mode_display = "Canonical (seed1 placement)" if canonical else "Random"

    # Compute stats
    stats = compute_summary_stats(results)

    lines = [
        "# World Generator Second Pass Test Results",
        "",
        f"**Generated:** {timestamp_display}",
        f"**Seed:** {seed}",
        f"**Mode:** {mode_display}",
        "",
        "This report tests the stability of the world generator by running it twice:",
        "",
        "1. **First Pass**: `original rules.json` -> world_generator -> `_worldgen` world",
        "2. **Second Pass**: Generate seed for `_worldgen` -> new `rules.json` -> world_generator -> `_worldgen2` world",
        "3. **Compare**: Are `_worldgen` and `_worldgen2` identical?",
        "",
        "If the world generator is stable/deterministic, the first and second pass should produce identical worlds.",
        "",
        "## Summary",
        "",
        "| Metric | Count |",
        "|--------|-------|",
        f"| Total Templates | {stats['total_templates']} |",
        f"| Identical (Stable) | {stats['identical_count']} |",
        f"| Different (Unstable) | {stats['different_count']} |",
        f"| Errors | {stats['error_count']} |",
        "",
    ]

    # Show error breakdown if there are errors
    if stats['error_count'] > 0:
        lines.extend([
            "### Error Breakdown",
            "",
            "| Error Type | Count |",
            "|------------|-------|",
            f"| First Pass Missing | {stats['first_pass_missing']} |",
            f"| Seed Generation Failed | {stats['seed_gen_failed']} |",
            f"| World Generation Failed | {stats['world_gen_failed']} |",
            "",
        ])

    # Detailed results table
    lines.extend([
        "## Detailed Results",
        "",
        "| Game | First Pass | Seed Gen | World Gen | Result | Details |",
        "|------|------------|----------|-----------|--------|---------|",
    ])

    # Sort by game name
    for game_name in sorted(template_results.keys()):
        result = template_results[game_name]

        # First pass status
        first_pass = result.get('first_pass', {})
        first_pass_status = '✅' if first_pass.get('exists') else '❌'

        # Seed generation status
        seed_gen = result.get('second_pass', {}).get('seed_generation', {})
        seed_gen_status = '✅' if seed_gen.get('success') else '❌'
        if not first_pass.get('exists'):
            seed_gen_status = '-'

        # World generation status
        world_gen = result.get('second_pass', {}).get('world_generation', {})
        world_gen_status = '✅' if world_gen.get('success') else '❌'
        if not seed_gen.get('success'):
            world_gen_status = '-'

        # Comparison result
        comparison = result.get('comparison', {})
        if comparison.get('identical'):
            result_status = '✅ Identical'
            details = f"{comparison.get('files_compared', 0)} files match"
        elif comparison.get('success'):
            result_status = '❌ Different'
            diff_count = len(comparison.get('differences', []))
            details = f"{diff_count} differences"
        elif not world_gen.get('success'):
            result_status = '-'
            details = 'World gen failed'
        else:
            result_status = '⚠️ Error'
            details = 'Comparison failed'

        # Check for specific errors
        errors = result.get('errors', {})
        if errors.get('first_pass'):
            result_status = '⚠️ Error'
            details = 'First pass missing'
        elif errors.get('second_pass'):
            result_status = '⚠️ Error'
            details = errors['second_pass'][0][:50] if errors['second_pass'] else 'Unknown'

        lines.append(
            f"| {game_name} | {first_pass_status} | {seed_gen_status} | {world_gen_status} | {result_status} | {details} |"
        )

    lines.append("")

    # Section for differences (if any)
    different_worlds = []
    for game_name, result in template_results.items():
        comparison = result.get('comparison', {})
        if comparison.get('success') and not comparison.get('identical'):
            different_worlds.append((game_name, comparison))

    if different_worlds:
        lines.extend([
            "## Unstable Worlds (Differences Found)",
            "",
            "The following worlds produced different output on the second pass:",
            "",
        ])

        for game_name, comparison in sorted(different_worlds, key=lambda x: x[0]):
            lines.append(f"### {game_name}")
            lines.append("")
            lines.append(f"**Files compared:** {comparison.get('files_compared', 0)}")
            lines.append(f"**Files matching:** {comparison.get('files_matching', 0)}")
            lines.append("")
            lines.append("**Differences:**")
            lines.append("")

            for diff in comparison.get('differences', [])[:10]:  # Show first 10
                diff_type = diff.get('type', 'unknown')
                filename = diff.get('file', 'unknown')

                if diff_type == 'content_mismatch':
                    lines.append(f"- `{filename}`: content differs")
                elif diff_type == 'missing_in_world2':
                    lines.append(f"- `{filename}`: missing in second pass")
                elif diff_type == 'missing_in_world1':
                    lines.append(f"- `{filename}`: only in second pass")
                else:
                    lines.append(f"- `{filename}`: {diff_type}")

            if len(comparison.get('differences', [])) > 10:
                remaining = len(comparison['differences']) - 10
                lines.append(f"- ... and {remaining} more differences")

            lines.append("")

    # Section for errors (if any)
    error_worlds = []
    for game_name, result in template_results.items():
        errors = result.get('errors', {})
        all_errors = (
            errors.get('first_pass', []) +
            errors.get('second_pass', []) +
            errors.get('comparison', [])
        )
        if all_errors:
            error_worlds.append((game_name, all_errors))

    if error_worlds:
        lines.extend([
            "## Errors",
            "",
            "The following worlds encountered errors during testing:",
            "",
        ])

        for game_name, errors in sorted(error_worlds, key=lambda x: x[0]):
            lines.append(f"### {game_name}")
            lines.append("")
            for error in errors:
                # Truncate long error messages
                if len(error) > 200:
                    error = error[:200] + "..."
                lines.append(f"- {error}")
            lines.append("")

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Generate markdown report from world generator second pass test results'
    )
    parser.add_argument(
        '--input-file', type=str,
        default=None,
        help='Input JSON file (default: auto-detect)'
    )
    parser.add_argument(
        '--output-file', type=str,
        default=None,
        help='Output markdown file (default: docs/json/developer/test-results/test-results-world-generator-second-pass.md)'
    )

    args = parser.parse_args()

    project_root = get_project_root()

    # Default paths
    if args.input_file:
        input_file = args.input_file
    else:
        input_file = os.path.join(
            project_root, 'scripts', 'output', 'world-generator-second-pass', 'test-results.json'
        )

    if args.output_file:
        output_file = args.output_file
    else:
        output_file = os.path.join(
            project_root, 'docs', 'json', 'developer', 'test-results',
            'test-results-world-generator-second-pass.md'
        )

    # Load results
    print(f"Loading results from: {input_file}")
    results = load_results(input_file)

    if not results:
        print(f"Error: Could not load results from {input_file}")
        return 1

    print(f"  Loaded {len(results.get('results', {}))} results")

    # Generate report
    print("Generating report...")
    report = generate_report(results)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write report
    with open(output_file, 'w') as f:
        f.write(report)

    print(f"Report written to: {output_file}")

    # Print summary
    stats = compute_summary_stats(results)
    print(f"\nSummary:")
    print(f"  Total templates: {stats['total_templates']}")
    print(f"  Identical (stable): {stats['identical_count']}")
    print(f"  Different (unstable): {stats['different_count']}")
    print(f"  Errors: {stats['error_count']}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
