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


def run_ut_comparison_test(yaml_file: Path, seed: str, port: int, output_dir: Path) -> Dict:
    """
    Run UT comparison test for a single template.

    Returns a dict with:
        - passed: bool
        - total_spheres: int
        - spheres_matched: int
        - first_mismatch_sphere: str or None
        - mismatch_details: dict or None
        - error: str or None
    """
    result = {
        "passed": False,
        "total_spheres": 0,
        "spheres_matched": 0,
        "first_mismatch_sphere": None,
        "mismatch_details": None,
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

            # Get first mismatch info if there is one
            if not result["passed"]:
                spheres = comparison.get("spheres", [])
                for sphere in spheres:
                    if sphere.get("status") != "match":
                        result["first_mismatch_sphere"] = str(sphere.get("sphere_index", "unknown"))
                        result["mismatch_details"] = sphere
                        break
        else:
            # Include subprocess output to show why comparison file wasn't created
            error_details = []
            error_details.append("Comparison result file not found")
            if proc.returncode != 0:
                error_details.append(f"Exit code: {proc.returncode}")
            if proc.stderr:
                # Truncate stderr if too long
                stderr = proc.stderr.strip()
                if len(stderr) > 500:
                    stderr = stderr[:500] + "..."
                error_details.append(f"stderr: {stderr}")
            if proc.stdout and not proc.stderr:
                # Only show stdout if no stderr (stdout may contain normal logging)
                stdout = proc.stdout.strip()
                if len(stdout) > 500:
                    stdout = stdout[-500:]  # Show last 500 chars of stdout
                error_details.append(f"stdout (last): {stdout}")
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

        print(f"[{i}/{len(template_files)}] Testing {game_name}...")

        # Create per-test temp directory
        test_temp_dir = temp_dir / template_name.replace('.yaml', '')
        test_temp_dir.mkdir(parents=True, exist_ok=True)

        # Run the test
        test_result = run_ut_comparison_test(yaml_file, args.seed, args.port, test_temp_dir)

        # Check for re_gen_passthrough support
        has_re_gen_passthrough = check_re_gen_passthrough_support(game_name)

        # Store result
        results["results"][template_name] = {
            "ut_comparison": {
                "passed": test_result["passed"],
                "total_spheres": test_result["total_spheres"],
                "spheres_matched": test_result["spheres_matched"],
                "first_mismatch_sphere": test_result["first_mismatch_sphere"],
                "mismatch_details": test_result["mismatch_details"]
            },
            "world_info": {
                "game_name_from_yaml": game_name,
                "has_re_gen_passthrough": has_re_gen_passthrough
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

        print(f"  {status}: {test_result['spheres_matched']}/{test_result['total_spheres']} spheres matched")
        if test_result["error"]:
            # Show more of the error for debugging
            error_msg = test_result['error']
            if len(error_msg) > 500:
                print(f"  Error: {error_msg[:500]}...")
            else:
                print(f"  Error: {error_msg}")
        print()

        # Save intermediate results after each test
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
        sys.executable, str(PROJECT_ROOT / "scripts/docs/generate-ut-comparison-chart.py")
    ]
    try:
        subprocess.run(chart_cmd, cwd=str(PROJECT_ROOT), check=True)
        print("Chart generated successfully")
    except subprocess.CalledProcessError as e:
        print(f"Failed to generate chart: {e}")

    return 0 if error_count == 0 and failed_count == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
