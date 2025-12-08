#!/usr/bin/env python3
"""
Generate markdown report from world generator stability test results.

This script reads the test-results.json file from the stability tests
and generates a markdown summary report showing which worlds are stable
across multiple passes of re-generation.

Usage:
    python scripts/docs/generate-world-generator-stability-report.py
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
        'stable_count': 0,
        'unstable_count': 0,
        'error_count': 0,
        'pass1_vs_pass2_identical': 0,
        'pass1_vs_pass2_different': 0,
        'pass2_vs_pass3_identical': 0,
        'pass2_vs_pass3_different': 0,
    }

    for game_name, result in template_results.items():
        stats['total_templates'] += 1

        errors = result.get('errors', [])
        if errors:
            stats['error_count'] += 1
            continue

        comparisons = result.get('comparisons', {})

        # Check pass 1 vs 2
        comp_1_2 = comparisons.get('1_vs_2', {})
        if comp_1_2.get('identical'):
            stats['pass1_vs_pass2_identical'] += 1
        elif comp_1_2:
            stats['pass1_vs_pass2_different'] += 1

        # Check pass 2 vs 3
        comp_2_3 = comparisons.get('2_vs_3', {})
        if comp_2_3.get('identical'):
            stats['pass2_vs_pass3_identical'] += 1
        elif comp_2_3:
            stats['pass2_vs_pass3_different'] += 1

        # Overall stability - only count as unstable if Pass 2→3 or later differs
        # (Pass 1→2 differences are expected due to JSON export format changes)
        later_passes_identical = all(
            comp.get('identical', False)
            for key, comp in comparisons.items()
            if not key.startswith('1_vs_')
        )
        if later_passes_identical and comparisons:
            stats['stable_count'] += 1
        elif comparisons:
            stats['unstable_count'] += 1

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
    num_passes = meta.get('num_passes', 3)
    canonical = meta.get('canonical_seed1', False)
    mode_display = "Canonical (seed1 placement)" if canonical else "Random"

    # Compute stats
    stats = compute_summary_stats(results)

    lines = [
        "# World Generator Stability Test Results",
        "",
        f"**Generated:** {timestamp_display}",
        f"**Seed:** {seed}",
        f"**Passes:** {num_passes}",
        f"**Mode:** {mode_display}",
        "",
        "This report tests the stability of the world generator by running it multiple times:",
        "",
        "1. **Pass 1**: Existing `_worldgen` world (from first pass test)",
        "2. **Pass 2**: Generate seed for Pass 1 -> `rules.json` -> world_generator -> `_worldgen2`",
        "3. **Pass 3**: Generate seed for Pass 2 -> `rules.json` -> world_generator -> `_worldgen3`",
        "",
        "If the world generator is stable, Pass 2→3 and later should produce identical output.",
        "(Pass 1→2 differences are expected due to JSON export format normalization.)",
        "",
        "## Summary",
        "",
        "| Metric | Count |",
        "|--------|-------|",
        f"| Total Templates | {stats['total_templates']} |",
        f"| Stable (Pass 2+ identical) | {stats['stable_count']} |",
        f"| Unstable (Pass 2+ differs) | {stats['unstable_count']} |",
        f"| Errors | {stats['error_count']} |",
        "",
        "### Pass Comparison Breakdown",
        "",
        "| Comparison | Identical | Different |",
        "|------------|-----------|-----------|",
        f"| Pass 1 vs Pass 2 | {stats['pass1_vs_pass2_identical']} | {stats['pass1_vs_pass2_different']} |",
        f"| Pass 2 vs Pass 3 | {stats['pass2_vs_pass3_identical']} | {stats['pass2_vs_pass3_different']} |",
        "",
    ]

    # Detailed results table
    lines.extend([
        "## Detailed Results",
        "",
        "| Game | Pass 1→2 | Pass 2→3 | Status |",
        "|------|----------|----------|--------|",
    ])

    # Sort by game name
    for game_name in sorted(template_results.keys()):
        result = template_results[game_name]
        errors = result.get('errors', [])
        comparisons = result.get('comparisons', {})

        if errors:
            status = '⚠️ Error'
            pass_1_2 = '-'
            pass_2_3 = '-'
        else:
            comp_1_2 = comparisons.get('1_vs_2', {})
            comp_2_3 = comparisons.get('2_vs_3', {})

            if comp_1_2.get('identical'):
                pass_1_2 = '✅'
            elif comp_1_2:
                diff_count = len(comp_1_2.get('differences', []))
                pass_1_2 = f'❌ ({diff_count})'
            else:
                pass_1_2 = '-'

            if comp_2_3.get('identical'):
                pass_2_3 = '✅'
            elif comp_2_3:
                diff_count = len(comp_2_3.get('differences', []))
                pass_2_3 = f'❌ ({diff_count})'
            else:
                pass_2_3 = '-'

            # Only count as unstable if Pass 2→3 or later differs
            later_passes_identical = all(
                comp.get('identical', False)
                for key, comp in comparisons.items()
                if not key.startswith('1_vs_')
            ) if comparisons else False

            if later_passes_identical:
                status = '✅ Stable'
            else:
                status = '❌ Unstable'

        lines.append(f"| {game_name} | {pass_1_2} | {pass_2_3} | {status} |")

    lines.append("")

    # Section for unstable worlds (Pass 2+ differences only)
    unstable_worlds = []
    for game_name, result in template_results.items():
        comparisons = result.get('comparisons', {})
        for comp_key, comparison in comparisons.items():
            # Only include Pass 2+ comparisons (not 1_vs_*)
            if not comp_key.startswith('1_vs_') and comparison.get('identical') == False and comparison.get('differences'):
                unstable_worlds.append((game_name, comp_key, comparison))

    if unstable_worlds:
        lines.extend([
            "## Unstable Worlds (Pass 2+ Differences)",
            "",
            "The following worlds produced different output between Pass 2 and later:",
            "",
        ])

        current_game = None
        for game_name, comp_key, comparison in sorted(unstable_worlds, key=lambda x: (x[0], x[1])):
            if current_game != game_name:
                if current_game is not None:
                    lines.append("")
                lines.append(f"### {game_name}")
                lines.append("")
                current_game = game_name

            pass_a, pass_b = comp_key.split('_vs_')
            lines.append(f"**Pass {pass_a} vs Pass {pass_b}:**")
            lines.append("")

            for diff in comparison.get('differences', [])[:5]:
                diff_type = diff.get('type', 'unknown')
                filename = diff.get('file', 'unknown')

                if diff_type == 'content_mismatch':
                    lines.append(f"- `{filename}`: content differs")
                elif diff_type == 'missing_in_world2':
                    lines.append(f"- `{filename}`: missing in later pass")
                elif diff_type == 'missing_in_world1':
                    lines.append(f"- `{filename}`: only in later pass")
                else:
                    lines.append(f"- `{filename}`: {diff_type}")

            if len(comparison.get('differences', [])) > 5:
                remaining = len(comparison['differences']) - 5
                lines.append(f"- ... and {remaining} more differences")

            lines.append("")

    # Section for Pass 1→2 differences (informational, expected)
    pass1_differences = []
    for game_name, result in template_results.items():
        comparisons = result.get('comparisons', {})
        for comp_key, comparison in comparisons.items():
            # Only include 1_vs_* comparisons
            if comp_key.startswith('1_vs_') and comparison.get('identical') == False and comparison.get('differences'):
                pass1_differences.append((game_name, comp_key, comparison))

    if pass1_differences:
        lines.extend([
            "## Pass 1→2 Differences (Expected)",
            "",
            "These differences are expected due to JSON export format normalization:",
            "",
        ])

        current_game = None
        for game_name, comp_key, comparison in sorted(pass1_differences, key=lambda x: (x[0], x[1])):
            if current_game != game_name:
                if current_game is not None:
                    lines.append("")
                lines.append(f"### {game_name}")
                lines.append("")
                current_game = game_name

            pass_a, pass_b = comp_key.split('_vs_')
            lines.append(f"**Pass {pass_a} vs Pass {pass_b}:**")
            lines.append("")

            for diff in comparison.get('differences', [])[:5]:
                diff_type = diff.get('type', 'unknown')
                filename = diff.get('file', 'unknown')

                if diff_type == 'content_mismatch':
                    lines.append(f"- `{filename}`: content differs")
                elif diff_type == 'missing_in_world2':
                    lines.append(f"- `{filename}`: missing in later pass")
                elif diff_type == 'missing_in_world1':
                    lines.append(f"- `{filename}`: only in later pass")
                else:
                    lines.append(f"- `{filename}`: {diff_type}")

            if len(comparison.get('differences', [])) > 5:
                remaining = len(comparison['differences']) - 5
                lines.append(f"- ... and {remaining} more differences")

            lines.append("")

    # Section for errors
    error_worlds = []
    for game_name, result in template_results.items():
        errors = result.get('errors', [])
        if errors:
            error_worlds.append((game_name, errors))

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
        description='Generate markdown report from world generator stability test results'
    )
    parser.add_argument(
        '--input-file', type=str,
        default=None,
        help='Input JSON file (default: auto-detect)'
    )
    parser.add_argument(
        '--output-file', type=str,
        default=None,
        help='Output markdown file'
    )

    args = parser.parse_args()

    project_root = get_project_root()

    # Default paths
    if args.input_file:
        input_file = args.input_file
    else:
        input_file = os.path.join(
            project_root, 'scripts', 'output', 'world-generator-stability', 'test-results.json'
        )

    if args.output_file:
        output_file = args.output_file
    else:
        output_file = os.path.join(
            project_root, 'docs', 'json', 'developer', 'test-results',
            'test-results-world-generator-stability.md'
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
    print(f"  Stable: {stats['stable_count']}")
    print(f"  Unstable: {stats['unstable_count']}")
    print(f"  Errors: {stats['error_count']}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
