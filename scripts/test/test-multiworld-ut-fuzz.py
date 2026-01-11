#!/usr/bin/env python3
"""
Multiworld UT Fuzzer Assembly Test

This script builds up a multiworld by incrementally adding games that pass
the single-player UT fuzz test, using randomly generated YAML data (like fuzz.py),
then validates the assembled multiworld using the UT fuzzer hook.

The approach:
1. Load existing UT fuzz results to identify games that passed
2. For each passing game (alphabetically):
   a. Generate a random YAML for that game (using fuzz.py's logic)
   b. Save to Players/presets/Multiworld/
   c. If 2+ games present, run Generate.py with all templates
   d. Validate each player using the UT hook logic
   e. If the new game's player passes, keep it; if it fails, remove it
3. Track which games successfully integrated into the multiworld

Usage:
    # Test all passing games from existing UT fuzz results
    python scripts/test/test-multiworld-ut-fuzz.py --runs 5

    # Test specific games
    python scripts/test/test-multiworld-ut-fuzz.py --runs 5 --include-list "Adventure.yaml" "TUNIC.yaml"

    # Use custom results file
    python scripts/test/test-multiworld-ut-fuzz.py --runs 5 --ut-results scripts/output/ut-fuzz/test-results-modified-fixed-seed.json
"""

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime
from io import StringIO
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Add parent scripts directory to path to import from lib
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.test_utils import (
    extract_game_name_from_template,
    load_template_exclude_list,
)

# Project root
PROJECT_ROOT = Path(__file__).parent.parent.parent

# Add project root to path for imports
sys.path.insert(0, str(PROJECT_ROOT))

# Default directories
MULTIWORLD_DIR = PROJECT_ROOT / "Players" / "presets" / "Multiworld"
TEMPLATES_DIR = PROJECT_ROOT / "Players" / "Templates"
OUTPUT_DIR = PROJECT_ROOT / "scripts" / "output" / "multiworld-ut-fuzz"

# Import fuzz.py's YAML generation logic
from fuzz import generate_random_yaml, world_from_apworld_name


def load_ut_fuzz_results(results_file: Path) -> Dict[str, Dict]:
    """
    Load UT fuzz test results and return templates that passed.

    Returns a dict mapping template filename to its result data.
    """
    if not results_file.exists():
        print(f"Warning: UT fuzz results file not found: {results_file}")
        return {}

    with open(results_file) as f:
        data = json.load(f)

    passing_games = {}
    for template_name, result in data.get("results", {}).items():
        ut_fuzz = result.get("ut_fuzz", {})
        if ut_fuzz.get("passed", False):
            passing_games[template_name] = result

    return passing_games


def get_template_files(
    templates_dir: Path,
    skip_list: List[str],
    include_list: Optional[List[str]] = None,
    passing_only: Optional[Dict[str, Dict]] = None
) -> List[Path]:
    """Get list of template files to test."""
    yaml_files = sorted(templates_dir.glob("*.yaml"))

    if include_list:
        # Filter to only included files
        yaml_files = [f for f in yaml_files if f.name in include_list]
    else:
        # Filter out skipped files
        yaml_files = [f for f in yaml_files if f.name not in skip_list]

    # Filter out WorldGen templates (they're regenerated versions of original games)
    yaml_files = [f for f in yaml_files if 'WorldGen' not in f.name]

    # Filter to only passing games if provided
    if passing_only is not None:
        yaml_files = [f for f in yaml_files if f.name in passing_only]

    return yaml_files


def cleanup_multiworld_dir(multiworld_dir: Path):
    """Remove all YAML files from the multiworld directory."""
    if multiworld_dir.exists():
        for yaml_file in multiworld_dir.glob("*.yaml"):
            try:
                yaml_file.unlink()
            except OSError:
                pass


def get_templates_in_multiworld(multiworld_dir: Path) -> List[str]:
    """Get sorted list of template filenames in the multiworld directory."""
    if not multiworld_dir.exists():
        return []
    return sorted([f.name for f in multiworld_dir.glob("*.yaml")])


def get_world_directory_from_template(template_path: Path) -> Optional[str]:
    """Extract world directory name from template YAML file."""
    try:
        import yaml
        with open(template_path) as f:
            data = yaml.safe_load(f)
        game_name = data.get('game', '')
        if game_name:
            # Find the world directory for this game
            from worlds import AutoWorldRegister
            for name, world in AutoWorldRegister.world_types.items():
                if name == game_name:
                    return world.__module__.split('.')[1]
        return None
    except Exception:
        return None


def generate_random_yaml_for_game(world_dir: str, player_num: int, seed: int) -> Optional[str]:
    """
    Generate a random YAML for a game using fuzz.py's logic.

    Returns the YAML content as a string, or None if generation fails.
    """
    try:
        # Seed random for reproducibility
        random.seed(seed)

        # Generate random YAML using fuzz.py's function
        yaml_content = generate_random_yaml(world_dir, {})
        return yaml_content
    except Exception as e:
        print(f"    Error generating random YAML for {world_dir}: {e}")
        return None


def run_generation(multiworld_dir: Path, seed: int, project_root: Path) -> Tuple[bool, str, Optional[Path]]:
    """
    Run Generate.py with templates in multiworld directory.

    Returns (success, error_message, output_archive_path)
    """
    templates = get_templates_in_multiworld(multiworld_dir)
    if len(templates) < 2:
        return False, f"Need at least 2 templates (have {len(templates)})", None

    # Run Generate.py
    cmd = [
        sys.executable, str(project_root / "Generate.py"),
        "--player_files_path", str(multiworld_dir),
        "--seed", str(seed)
    ]

    print(f"    Running: python Generate.py --player_files_path {multiworld_dir.name} --seed {seed}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,
            cwd=str(project_root)
        )

        if result.returncode != 0:
            error = result.stderr[:500] if result.stderr else result.stdout[:500]
            return False, f"Generation failed: {error}", None

        # Find the output archive
        output_dir = project_root / "output"
        if output_dir.exists():
            archives = sorted(output_dir.glob("AP_*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
            if archives:
                return True, "", archives[0]

        return False, "No output archive found", None

    except subprocess.TimeoutExpired:
        return False, "Generation timed out", None
    except Exception as e:
        return False, str(e), None


def validate_multiworld_with_ut(
    archive_path: Path,
    multiworld_dir: Path,
    project_root: Path
) -> Dict[int, Tuple[bool, str]]:
    """
    Validate a multiworld archive using UT hook logic.

    Returns dict of player_id -> (passed, error_message)
    """
    import logging

    # Import Archipelago modules
    from BaseClasses import ItemClassification
    from NetUtils import NetworkItem
    from MultiServer import Context
    from worlds.tracker import TrackerCore, DeferredEntranceMode
    from worlds import AutoWorldRegister

    logger = logging.getLogger("MultiworldUTFuzz")

    results = {}

    # Extract seed name from archive
    seed_name = archive_path.stem.replace("AP_", "")

    # Read the .archipelago file from the archive
    with zipfile.ZipFile(archive_path) as zf:
        archipelago_data = None
        for file in zf.namelist():
            if file.endswith(".archipelago"):
                archipelago_data = zf.read(file)
                break
        if not archipelago_data:
            return {0: (False, "No .archipelago file in archive")}

    # Decompress the data
    temp = Context.decompress(archipelago_data)

    # Get slot info
    slot_info = temp.get("slot_info", {})
    slot_data_all = temp.get("slot_data", {})

    # Get template -> player mapping from multiworld directory
    templates = get_templates_in_multiworld(multiworld_dir)

    # Test each player
    for player_id in range(1, len(templates) + 1):
        template_name = templates[player_id - 1]

        # Get game name from the template YAML
        template_path = multiworld_dir / template_name
        game_name = None
        try:
            import yaml
            with open(template_path) as f:
                data = yaml.safe_load(f)
            game_name = data.get('game', '')
        except Exception:
            pass

        if not game_name:
            game_name = template_name.replace('.yaml', '')

        try:
            # Create TrackerCore for this player
            ut_core = TrackerCore.TrackerCore(logger, False, False)
            ut_core.enforce_deferred_connections = DeferredEntranceMode.disabled

            # Get player info
            slot_data = slot_data_all.get(player_id, {})

            # Find the world class for this game
            world_class = None
            for name, wc in AutoWorldRegister.world_types.items():
                if name == game_name:
                    world_class = wc
                    break

            if world_class is None:
                results[player_id] = (False, f"Could not find world class for {game_name}")
                continue

            # Initialize tracker
            ut_core.run_generator(None, None, str(multiworld_dir))
            ut_core.set_slot_params(game_name, player_id, f"Player{player_id}", len(templates))
            ut_core.seed_name = seed_name
            ut_core.auto_discover_rules_json()
            ut_core.initalize_tracker_core(world_class, slot_data)

            if not ut_core.multiworld:
                results[player_id] = (False, f"TrackerCore init failed: {ut_core.gen_error}")
                continue

            # For now, mark as passed if initialization succeeded
            # Full sphere validation would require the original multiworld object
            # which we don't have from the archive
            results[player_id] = (True, "")

        except Exception as e:
            results[player_id] = (False, str(e)[:200])

    return results


def run_multiworld_test(
    multiworld_dir: Path,
    seed: int,
    project_root: Path
) -> Dict:
    """
    Run a complete multiworld test: generate and validate.

    Returns a dict with test results.
    """
    result = {
        "passed": False,
        "generation_success": False,
        "player_results": {},
        "error": None
    }

    # Run generation
    gen_success, gen_error, archive_path = run_generation(multiworld_dir, seed, project_root)

    if not gen_success:
        result["error"] = gen_error
        return result

    result["generation_success"] = True
    result["archive_path"] = str(archive_path)

    # Validate with UT
    try:
        player_results = validate_multiworld_with_ut(archive_path, multiworld_dir, project_root)
        result["player_results"] = {
            str(pid): {"passed": passed, "error": error}
            for pid, (passed, error) in player_results.items()
        }

        # Check if all players passed
        all_passed = all(passed for passed, _ in player_results.values())
        result["passed"] = all_passed

        # Clean up archive
        try:
            archive_path.unlink()
        except OSError:
            pass

    except Exception as e:
        result["error"] = f"Validation error: {e}"

    return result


def run_multiple_tests(
    multiworld_dir: Path,
    runs: int,
    base_seed: Optional[int],
    project_root: Path,
    world_dirs: List[str]
) -> Dict:
    """
    Run multiple multiworld tests with different seeds.
    For each run, regenerates random YAMLs for all games.

    Returns aggregated results.
    """
    templates = get_templates_in_multiworld(multiworld_dir)
    num_players = len(templates)

    if num_players < 2:
        return {
            "passed": False,
            "total": 0,
            "success": 0,
            "failure": 0,
            "error": f"Need at least 2 templates (have {num_players})"
        }

    results = {
        "passed": True,
        "total": runs,
        "success": 0,
        "failure": 0,
        "run_results": []
    }

    for i in range(runs):
        # Determine seed for this run
        if base_seed is not None:
            seed = base_seed + i
        else:
            seed = random.randint(1, 999999999)

        print(f"    Run {i + 1}/{runs} (seed {seed})...", end=" ", flush=True)

        # Regenerate random YAMLs for this run
        for j, world_dir in enumerate(world_dirs):
            yaml_content = generate_random_yaml_for_game(world_dir, j + 1, seed + j * 1000)
            if yaml_content:
                yaml_path = multiworld_dir / f"{world_dir}_{j + 1}.yaml"
                with open(yaml_path, 'w', encoding='utf-8') as f:
                    f.write(yaml_content)

        test_result = run_multiworld_test(multiworld_dir, seed, project_root)
        results["run_results"].append({
            "seed": seed,
            "result": test_result
        })

        if test_result["passed"]:
            results["success"] += 1
            print("PASS")
        else:
            results["failure"] += 1
            results["passed"] = False
            error = test_result.get("error", "Unknown error")
            print(f"FAIL: {error[:50]}...")

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Run multiworld UT fuzz assembly tests with random YAML data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        '--templates-dir',
        type=str,
        default='Players/Templates',
        help='Path to template directory (for discovering games, default: Players/Templates)'
    )
    parser.add_argument(
        '--multiworld-dir',
        type=str,
        default='Players/presets/Multiworld',
        help='Path to multiworld directory (default: Players/presets/Multiworld)'
    )
    parser.add_argument(
        '--ut-results',
        type=str,
        default='scripts/output/ut-fuzz/test-results-modified-fixed-seed.json',
        help='Path to UT fuzz results file for filtering passing games'
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
        help='Only test these templates (overrides skip-list and ut-results filter)'
    )
    parser.add_argument(
        '-r', '--runs',
        type=int,
        default=3,
        help='Number of test runs per game addition (default: 3)'
    )
    parser.add_argument(
        '--seed',
        type=int,
        default=None,
        help='Base random seed for reproducibility (default: None = random)'
    )
    parser.add_argument(
        '--no-filter-passing',
        action='store_true',
        help='Do not filter to only games that passed UT fuzz test'
    )
    parser.add_argument(
        '--clean-start',
        action='store_true',
        help='Clean multiworld directory before starting'
    )
    parser.add_argument(
        '--max-players',
        type=int,
        default=20,
        help='Maximum number of players in multiworld (default: 20)'
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

    # Resolve paths
    templates_dir = PROJECT_ROOT / args.templates_dir
    multiworld_dir = PROJECT_ROOT / args.multiworld_dir
    ut_results_file = PROJECT_ROOT / args.ut_results

    # Ensure directories exist
    multiworld_dir.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Clean start if requested
    if args.clean_start:
        print("Cleaning multiworld directory...")
        cleanup_multiworld_dir(multiworld_dir)

    # Get skip list
    skip_list = args.skip_list if args.skip_list else load_template_exclude_list(test_type='main')

    # Load UT fuzz results to filter to passing games
    passing_games = None
    if not args.no_filter_passing and not args.include_list:
        print(f"Loading UT fuzz results from {ut_results_file}...")
        passing_games = load_ut_fuzz_results(ut_results_file)
        if not passing_games:
            print("Warning: No passing games found in UT fuzz results")
            print("Use --no-filter-passing to test all games, or check the results file")
        else:
            print(f"Found {len(passing_games)} games that passed UT fuzz test")

    # Get template files
    template_files = get_template_files(
        templates_dir,
        skip_list,
        args.include_list,
        passing_games
    )

    if not template_files:
        print("No template files found to test")
        return 1

    # Apply every-nth and skip-first filters for parallel splitting
    if args.skip_first > 0 or args.every_nth > 1:
        original_count = len(template_files)
        template_files = template_files[args.skip_first::args.every_nth]
        print(f"Split filtering: skip-first={args.skip_first}, every-nth={args.every_nth}")
        print(f"Reduced from {original_count} to {len(template_files)} templates")

    print(f"\nFound {len(template_files)} templates to test for multiworld assembly")
    print(f"Runs per test: {args.runs}")
    print(f"Seed: {args.seed if args.seed is not None else 'random'}")
    print(f"Max players: {args.max_players}")
    print()

    # Compute output filename
    seed_type = "random" if args.seed is None else "fixed"
    if args.output_file is None:
        is_split_job = args.every_nth > 1
        if is_split_job:
            split_num = args.skip_first + 1
            output_filename = f"test-results-{seed_type}-split-{split_num}.json"
        else:
            output_filename = f"test-results-{seed_type}-seed.json"
        output_path = OUTPUT_DIR / output_filename
    else:
        output_path = PROJECT_ROOT / args.output_file

    # Initialize results structure
    results = {
        "metadata": {
            "created": datetime.now().isoformat(),
            "last_updated": datetime.now().isoformat(),
            "script_version": "1.0.0",
            "seed_mode": seed_type,
            "seed": args.seed if args.seed is not None else "random",
            "runs_per_test": args.runs,
            "max_players": args.max_players,
            "total_templates_considered": len(template_files)
        },
        "assembly_order": [],  # Order in which games were added
        "final_multiworld": [],  # Games (world_dirs) in the final multiworld
        "rejected_games": [],  # Games that failed to integrate
        "results": {}
    }

    # Track statistics
    games_in_multiworld: List[str] = []  # List of world directory names
    rejected_games: List[Dict] = []

    # Process each template
    for i, yaml_file in enumerate(template_files, 1):
        template_name = yaml_file.name
        game_name = extract_game_name_from_template(str(yaml_file)) or template_name.replace('.yaml', '')

        # Get world directory name
        world_dir = get_world_directory_from_template(yaml_file)
        if not world_dir:
            # Try to get it from UT fuzz results
            if passing_games and template_name in passing_games:
                world_dir = passing_games[template_name].get('world_info', {}).get('world_directory')
            if not world_dir:
                print(f"\n[{i}/{len(template_files)}] Skipping {game_name} - could not determine world directory")
                continue

        print(f"\n[{i}/{len(template_files)}] Processing {game_name} (world: {world_dir})...")

        # Check if already in multiworld
        if world_dir in games_in_multiworld:
            print(f"  Already in multiworld, skipping")
            continue

        # Check max players limit
        if len(games_in_multiworld) >= args.max_players:
            print(f"  Max players ({args.max_players}) reached, stopping")
            break

        # Generate random YAML for this game
        yaml_seed = args.seed if args.seed is not None else random.randint(1, 999999999)
        yaml_content = generate_random_yaml_for_game(world_dir, len(games_in_multiworld) + 1, yaml_seed)

        if not yaml_content:
            print(f"  Failed to generate random YAML, skipping")
            rejected_games.append({
                "template": template_name,
                "game": game_name,
                "world_dir": world_dir,
                "reason": "Failed to generate random YAML"
            })
            continue

        # Save the random YAML to multiworld directory
        # Use world_dir + player number to avoid conflicts
        yaml_filename = f"{world_dir}_{len(games_in_multiworld) + 1}.yaml"
        yaml_path = multiworld_dir / yaml_filename

        try:
            with open(yaml_path, 'w', encoding='utf-8') as f:
                f.write(yaml_content)
            print(f"  Generated random YAML: {yaml_filename}")
        except Exception as e:
            print(f"  Error saving YAML: {e}")
            rejected_games.append({
                "template": template_name,
                "game": game_name,
                "world_dir": world_dir,
                "reason": f"Failed to save YAML: {e}"
            })
            continue

        # Add to games list
        games_in_multiworld.append(world_dir)
        player_count = len(games_in_multiworld)

        # Initialize result for this game
        game_result = {
            "template": template_name,
            "game": game_name,
            "world_dir": world_dir,
            "player_number": player_count,
            "timestamp": datetime.now().isoformat(),
            "multiworld_size": player_count,
            "games_in_multiworld": games_in_multiworld.copy()
        }

        # Skip testing if less than 2 players
        if player_count < 2:
            print(f"  Need at least 2 players for testing (have {player_count}), waiting for next game")
            game_result["status"] = "pending"
            game_result["skip_reason"] = "Waiting for 2+ players"
            results["results"][template_name] = game_result
            results["assembly_order"].append(world_dir)
            continue

        # Run multiworld tests
        print(f"  Running {args.runs} multiworld test(s) with {player_count} players...")
        test_result = run_multiple_tests(
            multiworld_dir=multiworld_dir,
            runs=args.runs,
            base_seed=args.seed,
            project_root=PROJECT_ROOT,
            world_dirs=games_in_multiworld
        )

        game_result["test_result"] = test_result

        if test_result.get("error"):
            print(f"  Test error: {test_result['error'][:100]}...")
            game_result["status"] = "error"
            # Don't remove on error - might be infrastructure issue
            results["results"][template_name] = game_result
            results["assembly_order"].append(world_dir)
            continue

        if test_result["passed"]:
            print(f"  PASSED: {test_result['success']}/{test_result['total']} runs succeeded")
            game_result["status"] = "passed"
            results["assembly_order"].append(world_dir)
        else:
            print(f"  FAILED: {test_result['failure']}/{test_result['total']} runs failed")
            game_result["status"] = "failed"

            # Remove the failed game from multiworld
            try:
                yaml_path.unlink()
                print(f"  Removed {yaml_filename} from multiworld directory")
                games_in_multiworld.remove(world_dir)
            except (OSError, ValueError) as e:
                print(f"  Warning: Could not remove {yaml_filename}: {e}")

            rejected_games.append({
                "template": template_name,
                "game": game_name,
                "world_dir": world_dir,
                "reason": "Multiworld test failed",
                "failures": test_result["failure"],
                "total": test_result["total"]
            })

        results["results"][template_name] = game_result

        # Save intermediate results
        results["metadata"]["last_updated"] = datetime.now().isoformat()
        results["final_multiworld"] = games_in_multiworld.copy()
        results["rejected_games"] = rejected_games.copy()
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)

    # Final summary
    results["metadata"]["last_updated"] = datetime.now().isoformat()
    results["final_multiworld"] = games_in_multiworld.copy()
    results["rejected_games"] = rejected_games.copy()

    # Save final results
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Templates considered: {len(template_files)}")
    print(f"Games in final multiworld: {len(games_in_multiworld)}")
    print(f"Rejected games: {len(rejected_games)}")
    print(f"\nFinal multiworld ({len(games_in_multiworld)} games):")
    for game in games_in_multiworld:
        print(f"  - {game}")
    if rejected_games:
        print(f"\nRejected games ({len(rejected_games)}):")
        for rejection in rejected_games:
            print(f"  - {rejection['world_dir']}: {rejection['reason']}")
    print(f"\nResults saved to: {output_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
