#!/usr/bin/env python3
"""
Batch UT Fuzzer Test Runner

Runs the UT fuzzer for all template files and aggregates results into
a JSON file compatible with the test results chart generator.

This script:
1. Iterates through YAML template files
2. Runs fuzz.py with the UT hook for each game
3. Collects results into scripts/output/ut-fuzz/test-results.json

Usage:
    # Test all templates
    python scripts/test/test-all-ut-fuzz.py --runs 10

    # Test specific templates
    python scripts/test/test-all-ut-fuzz.py --runs 10 --include-list Adventure.yaml

    # Split for parallel execution (10 splits)
    python scripts/test/test-all-ut-fuzz.py --runs 10 --every-nth 10 --skip-first 0
"""

import argparse
import json
import os
import shutil
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

# Default fuzzer output directory
FUZZ_OUTPUT_DIR = PROJECT_ROOT / "fuzz_output"


def cleanup_empty_worldgen_dirs():
    """
    Remove empty temporary worldgen directories from worlds/.

    These are leftover directories from previous fuzz/worldgen runs that
    don't have an __init__.py file, causing warnings when worlds are loaded.
    They typically have names like 'adventure_worldgen_86998726363870010506'.
    """
    worlds_dir = PROJECT_ROOT / "worlds"
    if not worlds_dir.exists():
        return

    removed_count = 0
    for entry in worlds_dir.iterdir():
        if not entry.is_dir():
            continue

        # Look for directories matching the pattern: *_worldgen_<numbers>
        # or *_<numbers> that don't have an __init__.py
        name = entry.name
        if "_worldgen_" in name or (name.split("_")[-1].isdigit() and len(name.split("_")[-1]) > 10):
            init_file = entry / "__init__.py"
            if not init_file.exists():
                try:
                    shutil.rmtree(entry)
                    removed_count += 1
                except OSError:
                    pass  # Ignore errors during cleanup

    if removed_count > 0:
        print(f"Cleaned up {removed_count} empty worldgen directories")


def get_template_files(templates_dir: Path, skip_list: List[str], include_list: Optional[List[str]] = None) -> List[Path]:
    """Get list of template files to test."""
    yaml_files = sorted(templates_dir.glob("*.yaml"))

    if include_list:
        # Filter to only included files
        yaml_files = [f for f in yaml_files if f.name in include_list]
    else:
        # Filter out skipped files
        yaml_files = [f for f in yaml_files if f.name not in skip_list]

    # Filter out WorldGen and WorldGen 2 templates - they are regenerated versions
    # of original games and should behave identically, so testing them is redundant
    yaml_files = [f for f in yaml_files if 'WorldGen' not in f.name]

    return yaml_files


def run_fuzzer_test(
    world_dir: str,
    runs: int,
    jobs: int,
    timeout: int,
    seed: Optional[int]
) -> Dict:
    """
    Run fuzzer test for a single game.

    Args:
        world_dir: The world directory name (apworld name)
        runs: Number of fuzz runs
        jobs: Number of parallel jobs
        timeout: Timeout per generation in seconds
        seed: Random seed for reproducibility (None = random)

    Returns a dict with:
        - passed: bool (True if no failures)
        - total: int (total runs)
        - success: int
        - failure: int
        - timeout: int
        - ignored: int
        - error: str or None
        - errors: dict of error types
    """
    result = {
        "passed": False,
        "total": 0,
        "success": 0,
        "failure": 0,
        "timeout": 0,
        "ignored": 0,
        "error": None,
        "errors": {}
    }

    # Clean up any previous fuzz output
    if FUZZ_OUTPUT_DIR.exists():
        shutil.rmtree(FUZZ_OUTPUT_DIR)

    # Build fuzzer command
    cmd = [
        sys.executable, str(PROJECT_ROOT / "fuzz.py"),
        "-r", str(runs),
        "-j", str(jobs),
        "-g", world_dir,
        "-n", "1",
        "-t", str(timeout),
        "--hook", "worlds.tracker.fuzzer_hook:Hook"
    ]

    if seed is not None:
        cmd.extend(["--seed", str(seed)])

    print(f"  Running: {' '.join(cmd[:10])}...")

    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=runs * timeout + 300,  # Allow extra time for overhead
            cwd=str(PROJECT_ROOT)
        )

        # Check for report.json
        report_file = FUZZ_OUTPUT_DIR / "report.json"
        if report_file.exists():
            with open(report_file) as f:
                report = json.load(f)

            stats = report.get("stats", {})
            result["total"] = stats.get("total", 0)
            result["success"] = stats.get("success", 0)
            result["failure"] = stats.get("failure", 0)
            result["timeout"] = stats.get("timeout", 0)
            result["ignored"] = stats.get("ignored", 0)
            result["passed"] = (result["failure"] == 0 and result["timeout"] == 0)

            # Include error details
            errors = report.get("errors", {})
            if world_dir in errors:
                result["errors"] = errors[world_dir]
        else:
            # No report file - check for errors
            error_details = []
            error_details.append("Report file not found")
            if proc.returncode != 0:
                error_details.append(f"Exit code: {proc.returncode}")
            if proc.stderr:
                stderr = proc.stderr.strip()
                if len(stderr) > 1000:
                    stderr = "..." + stderr[-1000:]
                error_details.append(f"stderr: {stderr}")
            if proc.stdout:
                stdout = proc.stdout.strip()
                if len(stdout) > 1000:
                    stdout = "..." + stdout[-1000:]
                error_details.append(f"stdout: {stdout}")
            result["error"] = " | ".join(error_details)

    except subprocess.TimeoutExpired:
        result["error"] = f"Fuzzer timed out after {runs * timeout + 300} seconds"
    except Exception as e:
        result["error"] = str(e)

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Run UT fuzzer tests for all templates",
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
        default=None,
        help='Output JSON file path (auto-computed if not specified)'
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
        '-r', '--runs',
        type=int,
        default=10,
        help='Number of fuzz runs per game (default: 10)'
    )
    parser.add_argument(
        '-j', '--jobs',
        type=int,
        default=2,
        help='Number of parallel jobs (default: 2)'
    )
    parser.add_argument(
        '-t', '--timeout',
        type=int,
        default=15,
        help='Timeout per generation in seconds (default: 15)'
    )
    parser.add_argument(
        '--seed',
        type=int,
        default=None,
        help='Random seed for reproducibility (default: None = random)'
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
        '--ut-version',
        type=str,
        choices=['modified', 'original'],
        default='modified',
        help='Which version of Universal Tracker to test (default: modified)'
    )

    args = parser.parse_args()

    # Clean up empty worldgen directories before loading worlds
    cleanup_empty_worldgen_dirs()

    # Determine seed mode and UT version
    is_random_seed_mode = args.seed is None
    seed_type = "random" if is_random_seed_mode else "fixed"
    ut_version = args.ut_version  # 'modified' or 'original'

    # Compute output filename if not specified
    # Format: test-results-{ut_version}-{seed_type}-split-{N}.json
    # or: test-results-{ut_version}-{seed_type}-seed.json
    if args.output_file is None:
        is_split_job = args.every_nth > 1
        if is_split_job:
            split_num = args.skip_first + 1
            output_filename = f"test-results-{ut_version}-{seed_type}-split-{split_num}.json"
        else:
            output_filename = f"test-results-{ut_version}-{seed_type}-seed.json"
        args.output_file = f"scripts/output/ut-fuzz/{output_filename}"
        print(f"Auto-computed output file: {args.output_file}")

    # Get templates directory
    templates_dir = PROJECT_ROOT / args.templates_dir
    if not templates_dir.exists():
        print(f"Error: Templates directory not found: {templates_dir}")
        return 1

    # Get skip list (use main test exclusions)
    skip_list = args.skip_list if args.skip_list else load_template_exclude_list(test_type='main')

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
    print(f"Runs per game: {args.runs}, Jobs: {args.jobs}, Timeout: {args.timeout}s")
    print(f"Seed: {args.seed if args.seed is not None else 'random'}")
    print()

    # Create output directory
    output_path = PROJECT_ROOT / args.output_file
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Initialize results structure
    results = {
        "metadata": {
            "created": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat(),
            "script_version": "1.0.0",
            "ut_version": ut_version,
            "seed_mode": seed_type,
            "seed": args.seed if not is_random_seed_mode else "random",
            "runs_per_game": args.runs,
            "jobs": args.jobs,
            "timeout": args.timeout,
            "total_templates": len(template_files)
        },
        "results": {}
    }

    # Track statistics
    passed_count = 0
    failed_count = 0
    error_count = 0

    # Run tests for each template
    for i, yaml_file in enumerate(template_files, 1):
        template_name = yaml_file.name
        game_name = extract_game_name_from_template(str(yaml_file)) or template_name.replace('.yaml', '')

        # Get the world directory name
        world_dir = get_world_directory_name_from_game_name(game_name)
        if not world_dir:
            print(f"[{i}/{len(template_files)}] Skipping {game_name} - could not find world directory")
            continue

        print(f"[{i}/{len(template_files)}] Testing {game_name} (world: {world_dir})...")

        # Run the fuzzer
        test_result = run_fuzzer_test(
            world_dir=world_dir,
            runs=args.runs,
            jobs=args.jobs,
            timeout=args.timeout,
            seed=args.seed
        )

        # Store result
        results["results"][template_name] = {
            "ut_fuzz": {
                "passed": test_result["passed"],
                "total": test_result["total"],
                "success": test_result["success"],
                "failure": test_result["failure"],
                "timeout": test_result["timeout"],
                "ignored": test_result["ignored"],
                "errors": test_result["errors"]
            },
            "world_info": {
                "game_name": game_name,
                "world_directory": world_dir
            },
            "timestamp": datetime.now().isoformat()
        }

        if test_result["error"]:
            results["results"][template_name]["error"] = test_result["error"]

        # Update statistics
        if test_result["error"]:
            error_count += 1
            status = "ERROR"
        elif test_result["passed"]:
            passed_count += 1
            status = "PASS"
        else:
            failed_count += 1
            status = "FAIL"

        # Print summary
        print(f"  {status}: {test_result['success']}/{test_result['total']} success, "
              f"{test_result['failure']} failures, {test_result['timeout']} timeouts")

        if test_result["error"]:
            error_msg = test_result["error"]
            if len(error_msg) > 200:
                print(f"  Error: {error_msg[:200]}...")
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

    # Return error exit code only for infrastructure errors
    return 0 if error_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
