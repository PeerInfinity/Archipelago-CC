#!/usr/bin/env python3
"""
Script to combine multiple test-results.json files from parallel test runs.

This script is designed to merge results from parallel CI runs where each run
tests the same templates with different seeds. It combines the results into a
single test-results.json file.

Usage:
    python scripts/test/combine-test-results.py \
        --input-files scripts/output/spoiler-minimal/test-results-seed-*.json \
        --output-file scripts/output/spoiler-minimal/test-results.json
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import glob


def load_results_file(file_path: str) -> Dict[str, Any]:
    """Load a test results JSON file."""
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except (IOError, json.JSONDecodeError) as e:
        print(f"Error loading {file_path}: {e}")
        return None


def combine_results(input_files: List[str]) -> Dict[str, Any]:
    """
    Combine multiple test results files into a single structure.

    The strategy is:
    - For each template, check if results are consistent across seeds
    - If all seeds pass, report as passing with seed range
    - If any seed fails, report the first failing seed
    - Track consecutive passes before first failure
    """
    all_results = []

    # Load all input files
    for file_path in input_files:
        data = load_results_file(file_path)
        if data:
            all_results.append(data)
        else:
            print(f"Warning: Skipping {file_path} due to load error")

    if not all_results:
        print("Error: No valid input files to combine")
        sys.exit(1)

    print(f"Loaded {len(all_results)} test result files")

    # Extract all templates and organize by template name and seed
    template_results = {}  # template_name -> list of (seed, result_data)

    for result_data in all_results:
        for template_name, template_result in result_data.get('results', {}).items():
            if template_name not in template_results:
                template_results[template_name] = []

            seed = template_result.get('seed', '1')
            template_results[template_name].append((seed, template_result))

    # Sort each template's results by seed number
    for template_name in template_results:
        template_results[template_name].sort(key=lambda x: int(x[0]))

    # Combine results for each template
    combined_results = {}

    for template_name, seed_results in template_results.items():
        if len(seed_results) == 1:
            # Single seed - just use that result as-is
            seed, result = seed_results[0]
            combined_results[template_name] = result
        else:
            # Multiple seeds - need to combine
            seeds = [int(seed) for seed, _ in seed_results]
            min_seed = min(seeds)
            max_seed = max(seeds)

            # Check if all seeds passed
            all_passed = True
            first_failure_seed = None
            consecutive_passes = 0
            seeds_passed = 0
            seeds_failed = 0

            for seed, result in seed_results:
                # Check if this seed passed
                seed_passed = False
                if 'spoiler_test' in result:
                    seed_passed = result['spoiler_test'].get('pass_fail') == 'passed'
                elif 'multiplayer_test' in result:
                    seed_passed = result['multiplayer_test'].get('success', False)
                elif 'multiworld_test' in result:
                    seed_passed = result['multiworld_test'].get('success', False)
                else:
                    # Check generation success
                    seed_passed = result.get('generation', {}).get('success', False)

                if seed_passed:
                    seeds_passed += 1
                    if all_passed:
                        consecutive_passes += 1
                else:
                    seeds_failed += 1
                    if all_passed:
                        all_passed = False
                        first_failure_seed = int(seed)

            # Use the result from the first seed as the base
            base_result = seed_results[0][1].copy()

            # Update with seed range information
            base_result['seed_range'] = f"{min_seed}-{max_seed}" if min_seed != max_seed else str(min_seed)
            base_result['seeds_tested'] = len(seed_results)
            base_result['seeds_passed'] = seeds_passed
            base_result['seeds_failed'] = seeds_failed
            base_result['consecutive_passes_before_failure'] = consecutive_passes

            if first_failure_seed:
                base_result['first_failure_seed'] = first_failure_seed

            combined_results[template_name] = base_result

    # Create combined output structure
    combined = {
        'metadata': {
            'created': datetime.now().isoformat(),
            'last_updated': datetime.now().isoformat(),
            'script_version': '1.0.0',
            'combined_from': len(all_results),
            'combination_note': 'Results combined from parallel seed tests'
        },
        'results': combined_results
    }

    return combined


def main():
    parser = argparse.ArgumentParser(
        description='Combine multiple test-results.json files from parallel runs'
    )
    parser.add_argument(
        '--input-files',
        type=str,
        nargs='+',
        required=True,
        help='List of input test-results files to combine (supports glob patterns)'
    )
    parser.add_argument(
        '--output-file',
        type=str,
        required=True,
        help='Output file path for combined results'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Show what would be combined without writing output'
    )

    args = parser.parse_args()

    # Expand glob patterns in input files
    expanded_files = []
    for pattern in args.input_files:
        matches = glob.glob(pattern)
        if matches:
            expanded_files.extend(matches)
        else:
            # If no matches, treat as literal filename (might exist or might error later)
            expanded_files.append(pattern)

    # Remove duplicates while preserving order
    input_files = list(dict.fromkeys(expanded_files))

    if not input_files:
        print("Error: No input files specified")
        sys.exit(1)

    print(f"Combining {len(input_files)} test result files:")
    for f in input_files:
        print(f"  - {f}")
    print()

    # Combine the results
    combined = combine_results(input_files)

    # Show summary
    print("\n=== Combination Summary ===")
    print(f"Templates combined: {len(combined['results'])}")

    for template_name, result in combined['results'].items():
        if 'seed_range' in result:
            seeds_passed = result.get('seeds_passed', 0)
            seeds_failed = result.get('seeds_failed', 0)
            seed_range = result.get('seed_range')

            if seeds_failed == 0:
                print(f"  ✅ {template_name}: All {seeds_passed} seeds passed (range: {seed_range})")
            else:
                first_failure = result.get('first_failure_seed')
                consecutive = result.get('consecutive_passes_before_failure', 0)
                if first_failure:
                    print(f"  ❌ {template_name}: {consecutive} consecutive passes, first failure at seed {first_failure}")
                else:
                    print(f"  ❌ {template_name}: {seeds_passed} passed, {seeds_failed} failed")
        else:
            # Single seed result
            seed = result.get('seed', '1')
            if 'spoiler_test' in result:
                passed = result['spoiler_test'].get('pass_fail') == 'passed'
            elif 'multiplayer_test' in result:
                passed = result['multiplayer_test'].get('success', False)
            elif 'multiworld_test' in result:
                passed = result['multiworld_test'].get('success', False)
            else:
                passed = result.get('generation', {}).get('success', False)

            status = "✅" if passed else "❌"
            print(f"  {status} {template_name}: Single seed {seed}")

    # Write output file
    if args.dry_run:
        print(f"\n[DRY RUN] Would write combined results to: {args.output_file}")
    else:
        output_path = Path(args.output_file)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, 'w') as f:
            json.dump(combined, f, indent=2, sort_keys=True)

        print(f"\n✅ Combined results written to: {args.output_file}")
        print(f"   File size: {output_path.stat().st_size} bytes")


if __name__ == '__main__':
    main()
