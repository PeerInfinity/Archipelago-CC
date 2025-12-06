#!/usr/bin/env python3
"""
Generate markdown report from world generator test results.

This script reads the test-results.json file from the world generator tests
and generates a markdown summary report.

Usage:
    python scripts/docs/generate-world-generator-report.py
    python scripts/docs/generate-world-generator-report.py --test-mode both
    python scripts/docs/generate-world-generator-report.py --test-mode canonical
    python scripts/docs/generate-world-generator-report.py --test-mode random
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


def get_project_root() -> str:
    """Get the project root directory."""
    return str(Path(__file__).parent.parent.parent)


def load_results(results_file: str) -> Optional[Dict]:
    """Load test results from JSON file."""
    if not os.path.exists(results_file):
        return None
    with open(results_file, 'r') as f:
        return json.load(f)


def get_status_emoji(success: bool, pass_fail: str = None) -> str:
    """Get status emoji for display."""
    if pass_fail == 'pass':
        return '✅'
    elif pass_fail == 'fail':
        return '❌'
    elif success:
        return '✅'
    else:
        return '❌'


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


def compute_summary_stats(results: Dict) -> Dict:
    """Compute summary statistics from results data."""
    template_results = results.get('results', {})

    stats = {
        'total_templates': 0,
        'successful_generations': 0,
        'failed_generations': 0,
        'successful_test_worlds': 0,
        'failed_test_worlds': 0,
        'successful_test_seeds': 0,
        'failed_test_seeds': 0,
        'cross_validation_passed': 0,
        'cross_validation_failed': 0,
    }

    # Handle both dict and list formats
    if isinstance(template_results, dict):
        results_items = list(template_results.values())
    else:
        results_items = template_results

    stats['total_templates'] = len(results_items)

    for result in results_items:
        # Original generation
        orig_gen = result.get('original', {}).get('generation', {})
        if orig_gen.get('success'):
            stats['successful_generations'] += 1
        elif orig_gen:  # Only count as failed if there was an attempt
            stats['failed_generations'] += 1

        # Test world generation (rules.json -> test world)
        world_gen = result.get('test_world', {}).get('world_generation', {})
        if world_gen.get('success'):
            stats['successful_test_worlds'] += 1
        elif world_gen:
            stats['failed_test_worlds'] += 1

        # Test seed generation (test world -> seed)
        seed_gen = result.get('test_world', {}).get('seed_generation', {})
        if seed_gen.get('success'):
            stats['successful_test_seeds'] += 1
        elif seed_gen:
            stats['failed_test_seeds'] += 1

        # Cross-validation
        cross_val = result.get('test_world', {}).get('cross_validation', {})
        if cross_val.get('pass_fail') == 'pass':
            stats['cross_validation_passed'] += 1
        elif cross_val.get('pass_fail') == 'fail':
            stats['cross_validation_failed'] += 1

    return stats


def generate_summary_table(results: Dict, title: str = "Summary") -> str:
    """Generate the summary statistics table."""
    meta = results.get('metadata', {})

    # If metadata has counts, use them; otherwise compute from results
    if meta.get('total_templates', 0) > 0:
        stats = meta
    else:
        stats = compute_summary_stats(results)

    lines = [
        f"## {title}",
        "",
        "| Metric | Count |",
        "|--------|-------|",
        f"| Total Templates | {stats.get('total_templates', 0)} |",
        f"| Successful Original Generations | {stats.get('successful_generations', 0)} |",
        f"| Failed Original Generations | {stats.get('failed_generations', 0)} |",
        f"| Successful Test World Generations | {stats.get('successful_test_worlds', 0)} |",
        f"| Failed Test World Generations | {stats.get('failed_test_worlds', 0)} |",
        f"| Successful Test Seed Generations | {stats.get('successful_test_seeds', 0)} |",
        f"| Failed Test Seed Generations | {stats.get('failed_test_seeds', 0)} |",
        f"| Cross-Validation Passed | {stats.get('cross_validation_passed', 0)} |",
        f"| Cross-Validation Failed | {stats.get('cross_validation_failed', 0)} |",
        "",
    ]

    return '\n'.join(lines)


def generate_results_table(results: Dict, title: str = "Detailed Results") -> str:
    """Generate the detailed results table."""
    template_results = results.get('results', {})

    if not template_results:
        return "No test results available.\n"

    lines = [
        f"## {title}",
        "",
        "| Game | Original Gen | Original Test | World Gen | Test Gen | Test Spoiler | Cross-Validation |",
        "|------|--------------|---------------|-----------|----------|--------------|------------------|",
    ]

    # Handle both dict and list formats
    if isinstance(template_results, dict):
        # Dict format: key is game name, value is result
        sorted_items = sorted(template_results.items(), key=lambda x: x[0])
        sorted_results = [(key, value) for key, value in sorted_items]
    else:
        # List format: game_name is inside each result
        sorted_results = [(r.get('game_name', 'Unknown'), r) for r in sorted(template_results, key=lambda x: x.get('game_name', ''))]

    for game_name, result in sorted_results:

        # Original generation
        orig_gen = result.get('original', {}).get('generation', {})
        orig_gen_status = '✅' if orig_gen.get('success') else '❌'

        # Original spoiler test
        orig_test = result.get('original', {}).get('spoiler_test', {})
        orig_test_status = get_status_emoji(False, orig_test.get('pass_fail'))
        if orig_test.get('note'):
            orig_test_status = 'Skipped'

        # World generation
        world_gen = result.get('test_world', {}).get('world_generation', {})
        world_gen_status = '✅' if world_gen.get('success') else '❌'
        if not orig_gen.get('success'):
            world_gen_status = '-'

        # Test world seed generation
        test_gen = result.get('test_world', {}).get('seed_generation', {})
        test_gen_status = '✅' if test_gen.get('success') else '❌'
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


def normalize_errors(errors) -> Dict[str, List[str]]:
    """
    Normalize errors to dict format with 'generation' and 'testing' keys.

    Handles both old format (list) and new format (dict with phase keys).
    """
    if errors is None:
        return {'generation': [], 'testing': []}
    elif isinstance(errors, list):
        # Old format - treat all as generation errors
        return {'generation': errors, 'testing': []}
    elif isinstance(errors, dict):
        return {
            'generation': errors.get('generation', []),
            'testing': errors.get('testing', [])
        }
    else:
        return {'generation': [], 'testing': []}


def has_errors(errors) -> bool:
    """Check if there are any errors (handles both old and new formats)."""
    normalized = normalize_errors(errors)
    return bool(normalized['generation']) or bool(normalized['testing'])


def generate_failures_section(results: Dict, title: str = "Failures") -> str:
    """Generate section listing all failures with details."""
    template_results = results.get('results', {})

    # Handle both dict and list formats
    if isinstance(template_results, dict):
        # Dict format: key is game name, value is result
        results_items = [(key, value) for key, value in template_results.items()]
    else:
        # List format: game_name is inside each result
        results_items = [(r.get('game_name', 'Unknown'), r) for r in template_results]

    failures = []
    for game_name, result in results_items:
        errors = result.get('errors')
        if has_errors(errors):
            failures.append({
                'game_name': game_name,
                'errors': normalize_errors(errors)
            })

    if not failures:
        return f"## {title}\n\nNo failures recorded.\n"

    lines = [
        f"## {title}",
        "",
        f"**{len(failures)} games had errors:**",
        "",
    ]

    for failure in sorted(failures, key=lambda x: x['game_name']):
        lines.append(f"### {failure['game_name']}")
        lines.append("")

        errors = failure['errors']

        # Display generation errors
        if errors['generation']:
            lines.append("**Generation phase:**")
            for error in errors['generation']:
                # Truncate long error messages
                if len(error) > 200:
                    error = error[:200] + "..."
                lines.append(f"- {error}")
            lines.append("")

        # Display testing errors
        if errors['testing']:
            lines.append("**Testing phase:**")
            for error in errors['testing']:
                # Truncate long error messages
                if len(error) > 200:
                    error = error[:200] + "..."
                lines.append(f"- {error}")
            lines.append("")

    return '\n'.join(lines)


def get_seed_display(meta: Dict) -> str:
    """Get seed display string from metadata."""
    if 'seed' in meta:
        return str(meta['seed'])
    elif 'seeds' in meta:
        return ', '.join(str(s) for s in meta['seeds'])
    else:
        return 'N/A'


def get_timestamp_display(meta: Dict) -> str:
    """Get formatted timestamp from metadata."""
    timestamp = meta.get('timestamp', meta.get('created', datetime.now().isoformat()))

    try:
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S UTC')
    except:
        return timestamp


def generate_single_mode_report(results: Dict, mode_name: str = None) -> str:
    """Generate report for a single test mode."""
    meta = results.get('metadata', {})

    timestamp_display = get_timestamp_display(meta)
    seed_display = get_seed_display(meta)

    # Determine canonical_seed1 setting
    canonical = meta.get('canonical_seed1', False)
    mode_display = "Canonical (seed1 placement)" if canonical else "Random"
    if mode_name:
        mode_display = mode_name

    lines = [
        "# World Generator Test Results",
        "",
        f"**Generated:** {timestamp_display}",
        f"**Seed:** {seed_display}",
        f"**Mode:** {mode_display}",
        "",
        "This report shows the results of round-trip testing the world generator.",
        "Each game's rules.json is converted to a `_test` world, and the generated",
        "world is validated to produce equivalent game logic.",
        "",
        "## Legend",
        "",
        "- ✅ - Success/Pass",
        "- ❌ - Failure",
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


def generate_dual_mode_report(canonical_results: Dict, random_results: Dict) -> str:
    """Generate report comparing canonical and random test modes."""
    # Use canonical results for primary metadata (it runs first)
    canonical_meta = canonical_results.get('metadata', {})
    random_meta = random_results.get('metadata', {})

    timestamp_display = get_timestamp_display(canonical_meta)
    seed_display = get_seed_display(canonical_meta)

    lines = [
        "# World Generator Test Results",
        "",
        f"**Generated:** {timestamp_display}",
        f"**Seed:** {seed_display}",
        f"**Mode:** Both (Canonical and Random)",
        "",
        "This report shows the results of round-trip testing the world generator.",
        "Each game's rules.json is converted to a `_test` world, and the generated",
        "world is validated to produce equivalent game logic.",
        "",
        "Tests are run in two modes:",
        "- **Canonical**: Uses `--canonical-seed1` which places items in their original locations when seed is 1",
        "- **Random**: Standard randomized item placement",
        "",
        "## Legend",
        "",
        "- ✅ - Success/Pass",
        "- ❌ - Failure",
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
        "---",
        "",
        "# Canonical Mode Results",
        "",
        "Tests run with `--canonical-seed1` (items placed in original locations).",
        "",
    ]

    lines.append(generate_summary_table(canonical_results, "Canonical Summary"))
    lines.append(generate_results_table(canonical_results, "Canonical Detailed Results"))
    lines.append(generate_failures_section(canonical_results, "Canonical Failures"))

    lines.append("---")
    lines.append("")
    lines.append("# Random Mode Results")
    lines.append("")
    lines.append("Tests run with standard randomized item placement.")
    lines.append("")

    lines.append(generate_summary_table(random_results, "Random Summary"))
    lines.append(generate_results_table(random_results, "Random Detailed Results"))
    lines.append(generate_failures_section(random_results, "Random Failures"))

    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Generate markdown report from world generator test results'
    )
    parser.add_argument(
        '--test-mode',
        type=str,
        choices=['canonical', 'random', 'both'],
        default='both',
        help='Test mode: canonical, random, or both (default: both)'
    )

    args = parser.parse_args()

    project_root = get_project_root()
    output_dir = os.path.join(project_root, 'scripts', 'output', 'world-generator')

    # Output file
    output_file = os.path.join(
        project_root, 'docs', 'json', 'developer', 'test-results',
        'test-results-world-generator.md'
    )

    # Load results based on test mode
    canonical_results = None
    random_results = None

    if args.test_mode in ['canonical', 'both']:
        canonical_file = os.path.join(output_dir, 'test-results-canonical.json')
        print(f"Loading canonical results from: {canonical_file}")
        canonical_results = load_results(canonical_file)
        if canonical_results:
            print(f"  Loaded {len(canonical_results.get('results', {}))} results")
        else:
            print(f"  Warning: Could not load canonical results")

    if args.test_mode in ['random', 'both']:
        random_file = os.path.join(output_dir, 'test-results-random.json')
        print(f"Loading random results from: {random_file}")
        random_results = load_results(random_file)
        if random_results:
            print(f"  Loaded {len(random_results.get('results', {}))} results")
        else:
            print(f"  Warning: Could not load random results")

    # Also try legacy single file if mode-specific files not found
    if not canonical_results and not random_results:
        legacy_file = os.path.join(output_dir, 'test-results.json')
        print(f"Trying legacy results file: {legacy_file}")
        legacy_results = load_results(legacy_file)
        if legacy_results:
            # Determine mode from metadata
            meta = legacy_results.get('metadata', {})
            if meta.get('canonical_seed1', False):
                canonical_results = legacy_results
            else:
                random_results = legacy_results

    # Generate report
    print(f"Generating report...")

    if args.test_mode == 'both' and canonical_results and random_results:
        report = generate_dual_mode_report(canonical_results, random_results)
    elif args.test_mode == 'canonical' and canonical_results:
        report = generate_single_mode_report(canonical_results, "Canonical (seed1 placement)")
    elif args.test_mode == 'random' and random_results:
        report = generate_single_mode_report(random_results, "Random")
    elif canonical_results:
        report = generate_single_mode_report(canonical_results, "Canonical (seed1 placement)")
    elif random_results:
        report = generate_single_mode_report(random_results, "Random")
    else:
        print("Error: No results files found")
        return 1

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write report
    with open(output_file, 'w') as f:
        f.write(report)

    print(f"Report written to: {output_file}")

    # Print summary
    if canonical_results:
        stats = compute_summary_stats(canonical_results)
        print(f"\nCanonical Summary:")
        print(f"  Total templates: {stats.get('total_templates', 0)}")
        print(f"  Successful test seeds: {stats.get('successful_test_seeds', 0)}")
        print(f"  Cross-validation passed: {stats.get('cross_validation_passed', 0)}")

    if random_results:
        stats = compute_summary_stats(random_results)
        print(f"\nRandom Summary:")
        print(f"  Total templates: {stats.get('total_templates', 0)}")
        print(f"  Successful test seeds: {stats.get('successful_test_seeds', 0)}")
        print(f"  Cross-validation passed: {stats.get('cross_validation_passed', 0)}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
