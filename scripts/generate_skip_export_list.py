#!/usr/bin/env python3
"""
Generate skip-export-games.json from UT fuzz test results.

This script reads the UT fuzz test results and identifies games that:
- Pass the Original Universal Tracker (100% success rate)
- Fail the Modified Universal Tracker (< 100% success rate)

These games should skip rule export and use the original UT instead.

Usage:
    python scripts/generate_skip_export_list.py

Output:
    exporter/skip-export-games.json
"""

import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Any, Set


def load_test_results(results_file: str) -> Dict[str, Any]:
    """Load UT fuzz test results from JSON file."""
    try:
        with open(results_file, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"Error loading results file {results_file}: {e}")
        return {}


def extract_passing_games(results: Dict[str, Any]) -> Set[str]:
    """Extract game names that have 100% pass rate from test results."""
    passing = set()

    if 'results' not in results:
        return passing

    for template_filename, template_data in results['results'].items():
        ut_fuzz = template_data.get('ut_fuzz', {})
        if ut_fuzz.get('passed', False):
            world_info = template_data.get('world_info', {})
            game_name = world_info.get('game_name')
            if game_name:
                passing.add(game_name)

    return passing


def find_original_only_games(original_results: Dict[str, Any],
                              modified_results: Dict[str, Any]) -> List[str]:
    """Find games that pass Original UT but fail Modified UT."""
    original_passing = extract_passing_games(original_results)
    modified_passing = extract_passing_games(modified_results)

    # Games that pass original but not modified
    original_only = original_passing - modified_passing

    return sorted(original_only)


def main():
    # Determine project root
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)

    # Input paths for test results
    results_dir = os.path.join(project_root, 'scripts/output/ut-fuzz')

    # Define result file pairs to process
    result_pairs = [
        {
            'original': os.path.join(results_dir, 'test-results-original-fixed-seed.json'),
            'modified': os.path.join(results_dir, 'test-results-modified-fixed-seed.json'),
            'category': 'bundled'
        },
        {
            'original': os.path.join(results_dir, 'test-results-apworlds-original-fixed-seed.json'),
            'modified': os.path.join(results_dir, 'test-results-apworlds-modified-fixed-seed.json'),
            'category': 'apworlds'
        }
    ]

    # Collect games by category
    games_by_category = {}
    source_files = []

    for pair in result_pairs:
        original_path = pair['original']
        modified_path = pair['modified']
        category = pair['category']

        if not os.path.exists(original_path):
            print(f"Warning: Original results not found: {original_path}")
            continue

        if not os.path.exists(modified_path):
            print(f"Warning: Modified results not found: {modified_path}")
            continue

        print(f"Processing {category} results...")
        original_results = load_test_results(original_path)
        modified_results = load_test_results(modified_path)

        if not original_results or not modified_results:
            print(f"  Skipping due to load errors")
            continue

        original_only = find_original_only_games(original_results, modified_results)
        games_by_category[category] = original_only
        source_files.append(os.path.basename(original_path))
        source_files.append(os.path.basename(modified_path))

        print(f"  Found {len(original_only)} games passing Original only")
        for game in original_only:
            print(f"    - {game}")

    if not games_by_category:
        print("Error: No results could be processed")
        return 1

    # Build output data
    output_data = {
        "generated": datetime.now().isoformat(),
        "description": "Games that pass Original UT but fail Modified UT. These should skip rule export.",
        "source_files": source_files,
        "games": games_by_category
    }

    # Output path
    output_path = os.path.join(project_root, 'exporter/skip-export-games.json')

    # Write output
    with open(output_path, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"\nGenerated: {output_path}")

    # Summary
    total_games = sum(len(games) for games in games_by_category.values())
    print(f"Total games in skip list: {total_games}")

    return 0


if __name__ == '__main__':
    sys.exit(main())
