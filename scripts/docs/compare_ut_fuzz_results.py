#!/usr/bin/env python3
"""
Compare Universal Tracker fuzz test results between original and modified versions.

This script compares test results from the original Universal Tracker
(FarisTheAncient) with the modified version in this repository to identify
improvements and regressions.

Usage:
    python scripts/docs/compare_ut_fuzz_results.py
    python scripts/docs/compare_ut_fuzz_results.py --original path/to/original.json --modified path/to/modified.json
"""

import argparse
import json
import os
import sys
from typing import Dict, Any, List, Tuple


def load_results(filepath: str) -> Dict[str, Any]:
    """Load test results from JSON file."""
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading {filepath}: {e}")
        return {}


def extract_game_results(results: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """
    Extract per-game results from the results JSON.

    Returns dict mapping game_name -> {passed, success, failure, timeout, total, success_rate}
    """
    games = {}

    for template_name, template_data in results.get('results', {}).items():
        world_info = template_data.get('world_info', {})
        game_name = world_info.get('game_name', template_name.replace('.yaml', ''))

        ut_fuzz = template_data.get('ut_fuzz', {})
        total = ut_fuzz.get('total', 0)
        success = ut_fuzz.get('success', 0)
        failure = ut_fuzz.get('failure', 0)
        timeout = ut_fuzz.get('timeout', 0)
        passed = ut_fuzz.get('passed', False)

        success_rate = (success / total * 100) if total > 0 else 0

        games[game_name] = {
            'passed': passed,
            'success': success,
            'failure': failure,
            'timeout': timeout,
            'total': total,
            'success_rate': success_rate,
            'template': template_name
        }

    return games


def compare_results(original: Dict[str, Dict], modified: Dict[str, Dict]) -> Dict[str, List]:
    """
    Compare original and modified results.

    Returns dict with:
        - improved: Games that failed in original but pass in modified
        - regressed: Games that passed in original but fail in modified
        - both_pass: Games that pass in both
        - both_fail: Games that fail in both
        - only_original: Games only in original results
        - only_modified: Games only in modified results
    """
    comparison = {
        'improved': [],
        'regressed': [],
        'both_pass': [],
        'both_fail': [],
        'only_original': [],
        'only_modified': []
    }

    all_games = set(original.keys()) | set(modified.keys())

    for game in sorted(all_games):
        orig = original.get(game)
        mod = modified.get(game)

        if orig is None:
            comparison['only_modified'].append((game, mod))
        elif mod is None:
            comparison['only_original'].append((game, orig))
        else:
            orig_passed = orig['passed']
            mod_passed = mod['passed']

            if not orig_passed and mod_passed:
                comparison['improved'].append((game, orig, mod))
            elif orig_passed and not mod_passed:
                comparison['regressed'].append((game, orig, mod))
            elif orig_passed and mod_passed:
                comparison['both_pass'].append((game, orig, mod))
            else:
                comparison['both_fail'].append((game, orig, mod))

    return comparison


def print_comparison(comparison: Dict[str, List], original_meta: Dict, modified_meta: Dict):
    """Print a formatted comparison report."""

    print("=" * 80)
    print("UNIVERSAL TRACKER FUZZ TEST COMPARISON")
    print("=" * 80)
    print()

    # Metadata
    print("Original UT:")
    print(f"  Version: {original_meta.get('ut_version', 'unknown')}")
    print(f"  Seed: {original_meta.get('seed', 'unknown')}")
    print(f"  Runs per game: {original_meta.get('runs_per_game', 'unknown')}")
    print()

    print("Modified UT:")
    print(f"  Version: {modified_meta.get('ut_version', 'unknown')}")
    print(f"  Seed: {modified_meta.get('seed', 'unknown')}")
    print(f"  Runs per game: {modified_meta.get('runs_per_game', 'unknown')}")
    print()

    # Summary
    total_games = (len(comparison['improved']) + len(comparison['regressed']) +
                   len(comparison['both_pass']) + len(comparison['both_fail']))

    print("-" * 80)
    print("SUMMARY")
    print("-" * 80)
    print(f"Total games compared: {total_games}")
    print(f"  Improved (original fail -> modified pass): {len(comparison['improved'])}")
    print(f"  Regressed (original pass -> modified fail): {len(comparison['regressed'])}")
    print(f"  Both pass: {len(comparison['both_pass'])}")
    print(f"  Both fail: {len(comparison['both_fail'])}")
    if comparison['only_original']:
        print(f"  Only in original: {len(comparison['only_original'])}")
    if comparison['only_modified']:
        print(f"  Only in modified: {len(comparison['only_modified'])}")
    print()

    # Improved games
    if comparison['improved']:
        print("-" * 80)
        print(f"IMPROVED ({len(comparison['improved'])} games)")
        print("-" * 80)
        print(f"{'Game':<40} {'Original':<20} {'Modified':<20}")
        print(f"{'':<40} {'Success Rate':<20} {'Success Rate':<20}")
        print("-" * 80)
        for game, orig, mod in comparison['improved']:
            orig_rate = f"{orig['success']}/{orig['total']} ({orig['success_rate']:.1f}%)"
            mod_rate = f"{mod['success']}/{mod['total']} ({mod['success_rate']:.1f}%)"
            print(f"{game:<40} {orig_rate:<20} {mod_rate:<20}")
        print()

    # Regressed games
    if comparison['regressed']:
        print("-" * 80)
        print(f"REGRESSED ({len(comparison['regressed'])} games)")
        print("-" * 80)
        print(f"{'Game':<40} {'Original':<20} {'Modified':<20}")
        print(f"{'':<40} {'Success Rate':<20} {'Success Rate':<20}")
        print("-" * 80)
        for game, orig, mod in comparison['regressed']:
            orig_rate = f"{orig['success']}/{orig['total']} ({orig['success_rate']:.1f}%)"
            mod_rate = f"{mod['success']}/{mod['total']} ({mod['success_rate']:.1f}%)"
            print(f"{game:<40} {orig_rate:<20} {mod_rate:<20}")
        print()

    # Both fail (with improvement details)
    if comparison['both_fail']:
        print("-" * 80)
        print(f"BOTH FAIL ({len(comparison['both_fail'])} games)")
        print("-" * 80)
        print(f"{'Game':<40} {'Original':<20} {'Modified':<20} {'Change':<10}")
        print("-" * 80)

        for game, orig, mod in comparison['both_fail']:
            orig_rate = f"{orig['success']}/{orig['total']} ({orig['success_rate']:.1f}%)"
            mod_rate = f"{mod['success']}/{mod['total']} ({mod['success_rate']:.1f}%)"

            # Calculate change
            rate_diff = mod['success_rate'] - orig['success_rate']
            if rate_diff > 0:
                change = f"+{rate_diff:.1f}%"
            elif rate_diff < 0:
                change = f"{rate_diff:.1f}%"
            else:
                change = "="

            print(f"{game:<40} {orig_rate:<20} {mod_rate:<20} {change:<10}")
        print()

    # Both pass
    if comparison['both_pass']:
        print("-" * 80)
        print(f"BOTH PASS ({len(comparison['both_pass'])} games)")
        print("-" * 80)
        # Just list the games, no need for details
        for i, (game, _, _) in enumerate(comparison['both_pass']):
            print(f"  {game}")
            if i >= 20 and len(comparison['both_pass']) > 25:
                print(f"  ... and {len(comparison['both_pass']) - 21} more")
                break
        print()


def main():
    parser = argparse.ArgumentParser(
        description='Compare UT fuzz test results between original and modified versions'
    )
    parser.add_argument('--original', type=str,
                        help='Path to original UT results JSON')
    parser.add_argument('--modified', type=str,
                        help='Path to modified UT results JSON')
    parser.add_argument('--markdown', action='store_true',
                        help='Output in markdown format')

    args = parser.parse_args()

    # Find project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(os.path.dirname(script_dir))

    # Default paths
    results_dir = os.path.join(project_root, 'scripts/output/ut-fuzz')

    original_path = args.original
    if not original_path:
        original_path = os.path.join(results_dir, 'test-results-original-fixed-seed.json')
    elif not os.path.isabs(original_path):
        original_path = os.path.join(project_root, original_path)

    modified_path = args.modified
    if not modified_path:
        modified_path = os.path.join(results_dir, 'test-results-modified-fixed-seed.json')
    elif not os.path.isabs(modified_path):
        modified_path = os.path.join(project_root, modified_path)

    # Check files exist
    if not os.path.exists(original_path):
        print(f"Error: Original results file not found: {original_path}")
        return 1

    if not os.path.exists(modified_path):
        print(f"Error: Modified results file not found: {modified_path}")
        return 1

    # Load results
    original_data = load_results(original_path)
    modified_data = load_results(modified_path)

    if not original_data or not modified_data:
        return 1

    # Extract game results
    original_games = extract_game_results(original_data)
    modified_games = extract_game_results(modified_data)

    # Compare
    comparison = compare_results(original_games, modified_games)

    # Print report
    print_comparison(
        comparison,
        original_data.get('metadata', {}),
        modified_data.get('metadata', {})
    )

    return 0


if __name__ == '__main__':
    sys.exit(main())
