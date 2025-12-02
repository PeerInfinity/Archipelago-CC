#!/usr/bin/env python3
"""
Batch UT Comparison Test Runner

Runs UT comparison tests for all template files and aggregates results into
a JSON file compatible with the test results chart generator.

This script:
1. Iterates through YAML template files
2. Runs test-ut-comparison.py for each template
3. Collects results into scripts/output/ut-comparison/test-results.json

Usage:
    # Test all templates
    python scripts/test/test-all-ut-comparison.py

    # Test specific templates
    python scripts/test/test-all-ut-comparison.py --include-list Adventure.yaml "A Link to the Past.yaml"

    # Skip certain templates
    python scripts/test/test-all-ut-comparison.py --skip-list "Problematic Game.yaml"
"""

import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# Add parent scripts directory to path to import from lib
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.test_utils import (
    extract_game_name_from_template,
    load_template_exclude_list,
    get_world_directory_name_from_game_name
)

# Project root
PROJECT_ROOT = Path(__file__).parent.parent.parent


def check_re_gen_passthrough_support(game_name: str) -> bool:
    """
    Check if a game's world has re_gen_passthrough support.

    This checks if the world's __init__.py contains 're_gen_passthrough',
    which indicates it supports Universal Tracker's regeneration mechanism.
    """
    try:
        world_dir = get_world_directory_name_from_game_name(game_name)
        if not world_dir:
            return False

        world_init = PROJECT_ROOT / "worlds" / world_dir / "__init__.py"
        if not world_init.exists():
            return False

        content = world_init.read_text()
        return "re_gen_passthrough" in content
    except Exception:
        return False


def get_template_files(templates_dir: Path, skip_list: List[str], include_list: Optional[List[str]] = None) -> List[Path]:
    """Get list of template files to test."""
    yaml_files = sorted(templates_dir.glob("*.yaml"))

    if include_list:
        # Filter to only included files
        yaml_files = [f for f in yaml_files if f.name in include_list]
    else:
        # Filter out skipped files
        yaml_files = [f for f in yaml_files if f.name not in skip_list]

    return yaml_files


def parse_sphere_index(sphere_index: str) -> tuple:
    """
    Parse a sphere index string like "1.2" into a tuple for comparison.
    Returns (major, minor) where both are integers.
    """
    if not sphere_index:
        return (-1, -1)
    parts = sphere_index.split('.')
    try:
        major = int(parts[0])
        minor = int(parts[1]) if len(parts) > 1 else 0
        return (major, minor)
    except (ValueError, IndexError):
        return (-1, -1)


def run_ut_comparison_test(yaml_file: Path, seed: str, port: int, output_dir: Path) -> Dict:
    """
    Run UT comparison test for a single template.

    Returns a dict with:
        - passed: bool
        - total_spheres: int
        - spheres_matched: int
        - spheres_mismatched: int
        - first_mismatch_sphere: str or None (sphere index where first mismatch occurred)
        - last_matched_sphere: str or None (sphere index of last successful match)
        - last_sphere_before_first_mismatch: str or None (sphere index just before first mismatch)
        - last_sphere_index: str or None (the final sphere index in the game)
        - error: str or None
    """
    result = {
        "passed": False,
        "total_spheres": 0,
        "spheres_matched": 0,
        "spheres_mismatched": 0,
        "first_mismatch_sphere": None,
        "last_matched_sphere": None,
        "last_sphere_before_first_mismatch": None,
        "last_sphere_index": None,
        "error": None
    }

    # Run the UT comparison test
    cmd = [
        sys.executable, str(PROJECT_ROOT / "scripts/test/test-ut-comparison.py"),
        "--yaml-file", str(yaml_file),
        "--seed", seed,
        "--port", str(port),
        "--output-dir", str(output_dir),
        "--auto-ignore-events"
    ]

    print(f"  Running: {' '.join(cmd[:6])}...")  # Show truncated command

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout per test
            cwd=str(PROJECT_ROOT)
        )

        # Check for comparison result file
        comparison_file = output_dir / "comparison_result.json"
        if comparison_file.exists():
            with open(comparison_file) as f:
                comparison = json.load(f)

            result["passed"] = comparison.get("all_match", False)
            summary = comparison.get("summary", {})
            result["total_spheres"] = summary.get("python_entries", 0)
            result["spheres_matched"] = summary.get("matched_entries", 0)
            result["spheres_mismatched"] = summary.get("mismatched_entries", 0)

            # Extract sphere indices and find first mismatch / last match
            spheres = comparison.get("spheres", [])

            last_matched = None
            last_sphere_before_mismatch = None
            last_sphere_index = None
            found_first_mismatch = False
            for sphere in spheres:
                sphere_index = sphere.get("sphere_index")
                last_sphere_index = sphere_index  # Track the last sphere we see
                if sphere.get("status") == "match":
                    last_matched = sphere_index
                    if not found_first_mismatch:
                        last_sphere_before_mismatch = sphere_index
                elif not found_first_mismatch:
                    result["first_mismatch_sphere"] = sphere_index
                    found_first_mismatch = True

            result["last_matched_sphere"] = last_matched
            result["last_sphere_before_first_mismatch"] = last_sphere_before_mismatch
            result["last_sphere_index"] = last_sphere_index
        else:
            # Include subprocess output to show why comparison file wasn't created
            error_details = []
            error_details.append("Comparison result file not found")
            if proc.returncode != 0:
                error_details.append(f"Exit code: {proc.returncode}")
            if proc.stderr:
                # Show last part of stderr (most relevant for errors)
                stderr = proc.stderr.strip()
                if len(stderr) > 1500:
                    stderr = "..." + stderr[-1500:]
                error_details.append(f"stderr: {stderr}")
            if proc.stdout:
                # Show last part of stdout (may contain error details)
                stdout = proc.stdout.strip()
                if len(stdout) > 1500:
                    stdout = "..." + stdout[-1500:]
                error_details.append(f"stdout: {stdout}")
            result["error"] = " | ".join(error_details)

    except subprocess.TimeoutExpired:
        result["error"] = "Test timed out after 10 minutes"
    except Exception as e:
        result["error"] = str(e)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Run UT comparison tests for all templates",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        '--templates-dir',
        type=str,
        default='Players/Templates',
        help='Path to template directory (default: Players/Templates)'
    )
    parser.add_argument(
        '--output-file',
        type=str,
        default='scripts/output/ut-comparison/test-results.json',
        help='Output JSON file path'
    )
    parser.add_argument(
        '--skip-list',
        type=str,
        nargs='*',
        help='List of template files to skip'
    )
    parser.add_argument(
        '--include-list',
        type=str,
        nargs='*',
        help='Only test these templates (overrides skip-list)'
    )
    parser.add_argument(
        '--seed',
        type=str,
        default='1',
        help='Seed to use for generation (default: 1)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=38291,
        help='Server port (default: 38291)'
    )
    parser.add_argument(
        '--temp-dir',
        type=str,
        default='/tmp/ut-comparison-batch',
        help='Temp directory for test outputs'
    )
    parser.add_argument(
        '--every-nth',
        type=int,
        default=1,
        help='Only test every Nth template (for parallel splitting)'
    )
    parser.add_argument(
        '--skip-first',
        type=int,
        default=0,
        help='Skip the first N templates before applying every-nth filter'
    )
    parser.add_argument(
        '--runs-per-template',
        type=int,
        default=1,
        help='Number of test runs per template for consistency checking (default: 1)'
    )

    args = parser.parse_args()

    # Get templates directory
    templates_dir = PROJECT_ROOT / args.templates_dir
    if not templates_dir.exists():
        print(f"Error: Templates directory not found: {templates_dir}")
        return 1

    # Get skip list
    skip_list = args.skip_list if args.skip_list else load_template_exclude_list()

    # Get template files
    template_files = get_template_files(templates_dir, skip_list, args.include_list)
    if not template_files:
        print("No template files found to test")
        return 1

    # Apply every-nth and skip-first filters for parallel splitting
    if args.skip_first > 0 or args.every_nth > 1:
        original_count = len(template_files)
        template_files = template_files[args.skip_first::args.every_nth]
        print(f"Split filtering: skip-first={args.skip_first}, every-nth={args.every_nth}")
        print(f"Reduced from {original_count} to {len(template_files)} templates")

    if not template_files:
        print("No template files remaining after split filtering")
        return 0  # Not an error, just no work for this split

    print(f"Found {len(template_files)} templates to test")
    print(f"Skip list: {skip_list}")
    print()

    # Create output directory
    output_path = PROJECT_ROOT / args.output_file
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Create temp directory
    temp_dir = Path(args.temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Initialize results structure
    results = {
        "metadata": {
            "created": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat(),
            "script_version": "1.0.0",
            "seed": args.seed,
            "runs_per_template": args.runs_per_template,
            "total_templates": len(template_files)
        },
        "results": {}
    }

    # Track statistics
    passed_count = 0
    failed_count = 0
    error_count = 0

    runs_per_template = args.runs_per_template

    # Run tests for each template
    for i, yaml_file in enumerate(template_files, 1):
        template_name = yaml_file.name
        game_name = extract_game_name_from_template(str(yaml_file)) or template_name.replace('.yaml', '')

        print(f"[{i}/{len(template_files)}] Testing {game_name} ({runs_per_template} run{'s' if runs_per_template > 1 else ''})...")

        # Create per-test temp directory
        test_temp_dir = temp_dir / template_name.replace('.yaml', '')
        test_temp_dir.mkdir(parents=True, exist_ok=True)

        # Run multiple tests and collect results
        run_results = []
        for run_num in range(1, runs_per_template + 1):
            if runs_per_template > 1:
                print(f"    Run {run_num}/{runs_per_template}...", end=" ", flush=True)

            test_result = run_ut_comparison_test(yaml_file, args.seed, args.port, test_temp_dir)
            run_results.append(test_result)

            if runs_per_template > 1:
                if test_result["error"]:
                    print(f"ERROR")
                elif test_result["passed"]:
                    print(f"PASS ({test_result['spheres_matched']}/{test_result['total_spheres']})")
                else:
                    first_mismatch = test_result.get("first_mismatch_sphere", "none")
                    print(f"FAIL (first mismatch: {first_mismatch})")

        # Aggregate results across runs
        any_passed = any(r["passed"] for r in run_results)
        all_passed = all(r["passed"] for r in run_results)
        any_error = any(r["error"] for r in run_results)

        # Get total spheres and last sphere index (should be same across runs)
        total_spheres = run_results[0]["total_spheres"] if run_results else 0
        last_sphere_index = run_results[0].get("last_sphere_index") if run_results else None

        # Find lowest and highest mismatch counts across runs
        mismatch_counts = [r.get("spheres_mismatched", 0) for r in run_results]
        lowest_mismatch_count = min(mismatch_counts) if mismatch_counts else 0
        highest_mismatch_count = max(mismatch_counts) if mismatch_counts else 0

        # Find lowest and highest sphere reached before first mismatch
        spheres_before_mismatch = [r.get("last_sphere_before_first_mismatch") for r in run_results
                                   if r.get("last_sphere_before_first_mismatch")]
        if spheres_before_mismatch:
            # Sort by parsing sphere index (e.g., "1.2" -> (1, 2))
            sorted_spheres = sorted(spheres_before_mismatch, key=parse_sphere_index)
            lowest_sphere_before_mismatch = sorted_spheres[0] if sorted_spheres else None
            highest_sphere_before_mismatch = sorted_spheres[-1] if sorted_spheres else None
        else:
            lowest_sphere_before_mismatch = None
            highest_sphere_before_mismatch = None

        # Check if results are consistent (all runs had same mismatch count)
        unique_mismatch_counts = set(mismatch_counts)
        results_consistent = len(unique_mismatch_counts) == 1

        # Check for re_gen_passthrough support
        has_re_gen_passthrough = check_re_gen_passthrough_support(game_name)

        # Store aggregated result
        results["results"][template_name] = {
            "ut_comparison": {
                "passed": all_passed,  # Only pass if ALL runs passed
                "any_passed": any_passed,
                "total_spheres": total_spheres,
                "last_sphere_index": last_sphere_index,
                "lowest_mismatch_count": lowest_mismatch_count,
                "highest_mismatch_count": highest_mismatch_count,
                "lowest_sphere_before_mismatch": lowest_sphere_before_mismatch,
                "highest_sphere_before_mismatch": highest_sphere_before_mismatch,
                "results_consistent": results_consistent,
                "num_runs": runs_per_template,
                "run_details": [
                    {
                        "passed": r["passed"],
                        "spheres_matched": r["spheres_matched"],
                        "spheres_mismatched": r.get("spheres_mismatched", 0),
                        "last_sphere_before_first_mismatch": r.get("last_sphere_before_first_mismatch"),
                        "first_mismatch_sphere": r.get("first_mismatch_sphere"),
                        "error": r.get("error")
                    }
                    for r in run_results
                ]
            },
            "world_info": {
                "game_name_from_yaml": game_name,
                "has_re_gen_passthrough": has_re_gen_passthrough
            },
            "timestamp": datetime.now().isoformat()
        }

        # Collect any errors
        errors = [r["error"] for r in run_results if r["error"]]
        if errors:
            results["results"][template_name]["errors"] = errors

        # Update statistics (count as failed if ANY run failed)
        if any_error:
            error_count += 1
            status = "ERROR"
        elif all_passed:
            passed_count += 1
            status = "PASS"
        else:
            failed_count += 1
            status = "FAIL"

        # Print summary
        if runs_per_template == 1:
            mismatches = run_results[0].get("spheres_mismatched", 0) if run_results else 0
            before_mismatch = run_results[0].get("last_sphere_before_first_mismatch", "none") if run_results else "none"
            print(f"  {status}: mismatches={mismatches}, last_good={before_mismatch}, total={total_spheres}")
        else:
            consistency = "consistent" if results_consistent else "INCONSISTENT"
            print(f"  {status}: mismatches={lowest_mismatch_count}-{highest_mismatch_count}, last_good={lowest_sphere_before_mismatch}-{highest_sphere_before_mismatch}, total={total_spheres} ({consistency})")

        if errors:
            for error_msg in errors[:1]:  # Show first error only
                if len(error_msg) > 500:
                    print(f"  Error: {error_msg[:500]}...")
                else:
                    print(f"  Error: {error_msg}")
        print()

        # Save intermediate results after each template
        results["metadata"]["last_updated"] = datetime.now().isoformat()
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)

    # Final summary
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total templates: {len(template_files)}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {failed_count}")
    print(f"Errors: {error_count}")
    print(f"Results saved to: {output_path}")

    # Generate the markdown chart
    print("\nGenerating test results chart...")
    chart_cmd = [
        sys.executable, str(PROJECT_ROOT / "scripts/docs/generate_ut_comparison_chart.py")
    ]
    try:
        subprocess.run(chart_cmd, cwd=str(PROJECT_ROOT), check=True)
        print("Chart generated successfully")
    except subprocess.CalledProcessError as e:
        print(f"Failed to generate chart: {e}")

    return 0 if error_count == 0 and failed_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
