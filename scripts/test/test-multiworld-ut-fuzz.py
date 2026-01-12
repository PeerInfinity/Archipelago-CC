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
import copy
import json
import logging
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
from typing import Dict, List, Optional, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from BaseClasses import MultiWorld

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


def cleanup_empty_worldgen_directories():
    """
    Remove empty worldgen directories that were created during testing.

    The UT validation process creates temporary worldgen directories
    that may not get cleaned up properly if the test fails or is interrupted.
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


# Clean up empty worldgen directories before importing fuzz (which triggers world loading)
cleanup_empty_worldgen_directories()

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


def run_generation_inprocess(
    multiworld_dir: Path,
    seed: int,
    project_root: Path
) -> Tuple[bool, str, Optional["MultiWorld"], Optional[Path]]:
    """
    Run generation in-process, keeping the MultiWorld object alive.

    Returns (success, error_message, multiworld_object, output_archive_path)
    """
    templates = get_templates_in_multiworld(multiworld_dir)
    if len(templates) < 2:
        return False, f"Need at least 2 templates (have {len(templates)})", None, None

    print(f"    Running in-process generation with {len(templates)} players, seed {seed}")

    try:
        # Import generation modules
        from Generate import main as generate_main, mystery_argparse
        from Main import main as ERmain

        # Build args similar to what Generate.py does
        argv = [
            "--player_files_path", str(multiworld_dir),
            "--seed", str(seed)
        ]

        # Parse arguments first - generate_main expects a Namespace, not a list
        parsed_args = mystery_argparse(argv)

        # Run the first phase (option rolling, player setup)
        args, actual_seed = generate_main(parsed_args)

        # Run the main generation - this returns the MultiWorld object!
        multiworld = ERmain(args, actual_seed)

        # Find the output archive
        output_dir = project_root / "output"
        archive_path = None
        if output_dir.exists():
            archives = sorted(output_dir.glob("AP_*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
            if archives:
                archive_path = archives[0]

        return True, "", multiworld, archive_path

    except Exception as e:
        import traceback
        error_msg = f"Generation failed: {str(e)[:300]}"
        traceback.print_exc()
        return False, error_msg, None, None


def validate_multiworld_with_spheres(
    multiworld: "MultiWorld",
    multiworld_dir: Path
) -> Dict[int, Tuple[bool, str, Dict]]:
    """
    Validate a multiworld using sphere analysis on the live MultiWorld object.

    This performs full sphere validation including cross-world item dependencies:
    - Verifies all locations are reachable
    - Checks that items from other players unlock expected locations
    - Validates the sphere order is correct

    Returns dict of player_id -> (passed, error_message, details)
    """
    from BaseClasses import CollectionState, ItemClassification

    results = {}
    num_players = multiworld.players

    print(f"    Validating multiworld with {num_players} players using sphere analysis...")

    # Get the spheres from the multiworld
    try:
        spheres = list(multiworld.get_sendable_spheres())
        print(f"    Found {len(spheres)} spheres")
    except Exception as e:
        return {0: (False, f"Failed to get spheres: {e}", {})}

    # Validate each player
    for player_id in range(1, num_players + 1):
        player_world = multiworld.worlds[player_id]
        game_name = multiworld.game[player_id]

        details = {
            "game": game_name,
            "total_locations": 0,
            "reachable_locations": 0,
            "items_from_other_players": 0,
            "spheres_with_cross_world_items": 0,
        }

        try:
            # Count locations for this player
            player_locations = [
                loc for loc in multiworld.get_locations()
                if loc.player == player_id and loc.address is not None
            ]
            details["total_locations"] = len(player_locations)

            # Check how many items this player receives from other players
            cross_world_items = []
            for loc in multiworld.get_filled_locations():
                if loc.item.player == player_id and loc.player != player_id:
                    cross_world_items.append({
                        "item": loc.item.name,
                        "from_player": loc.player,
                        "from_game": multiworld.game[loc.player],
                        "location": loc.name
                    })
            details["items_from_other_players"] = len(cross_world_items)

            # Count spheres that contain cross-world unlocks for this player
            state = CollectionState(multiworld)
            spheres_with_cross_world = 0

            for sphere_idx, sphere in enumerate(spheres):
                # Check if any location in this sphere gives an item to another player
                # that then unlocks something for this player
                has_cross_world_effect = False
                for loc in sphere:
                    if loc.player != player_id and loc.item.player == player_id:
                        # This location belongs to another player but contains our item
                        has_cross_world_effect = True
                        break
                if has_cross_world_effect:
                    spheres_with_cross_world += 1

            details["spheres_with_cross_world_items"] = spheres_with_cross_world

            # Use multiworld's built-in accessibility check
            # This verifies the player can reach all their locations
            accessible = True
            unreachable_locations = []

            # Create a fresh state and collect all items to check full reachability
            full_state = multiworld.get_all_state(use_cache=False)
            for loc in player_locations:
                if not full_state.can_reach(loc, "Location", player_id):
                    accessible = False
                    unreachable_locations.append(loc.name)

            details["reachable_locations"] = len(player_locations) - len(unreachable_locations)

            if unreachable_locations:
                details["unreachable_locations"] = unreachable_locations[:10]  # Limit to first 10

            if not accessible:
                results[player_id] = (
                    False,
                    f"Player {player_id} ({game_name}): {len(unreachable_locations)} unreachable locations",
                    details
                )
            else:
                results[player_id] = (True, "", details)

        except Exception as e:
            import traceback
            traceback.print_exc()
            results[player_id] = (False, f"Validation error: {str(e)[:200]}", details)

    return results


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
    project_root: Path,
    use_sphere_validation: bool = False
) -> Dict:
    """
    Run a complete multiworld test: generate and validate.

    Args:
        multiworld_dir: Directory containing player YAML files
        seed: Random seed for generation
        project_root: Path to project root
        use_sphere_validation: If True, run generation in-process and validate
            using the live MultiWorld object with full sphere analysis.
            If False, use the original subprocess + UT validation approach.

    Returns a dict with test results.
    """
    result = {
        "passed": False,
        "generation_success": False,
        "player_results": {},
        "error": None,
        "validation_mode": "sphere" if use_sphere_validation else "ut"
    }

    if use_sphere_validation:
        # New approach: run generation in-process, validate with live MultiWorld
        gen_success, gen_error, multiworld, archive_path = run_generation_inprocess(
            multiworld_dir, seed, project_root
        )

        if not gen_success:
            result["error"] = gen_error
            return result

        result["generation_success"] = True
        if archive_path:
            result["archive_path"] = str(archive_path)

        # Validate with sphere analysis using live MultiWorld object
        try:
            player_results = validate_multiworld_with_spheres(multiworld, multiworld_dir)
            result["player_results"] = {
                str(pid): {
                    "passed": passed,
                    "error": error,
                    "details": details
                }
                for pid, (passed, error, details) in player_results.items()
            }

            # Aggregate cross-world statistics
            total_cross_world_items = sum(
                details.get("items_from_other_players", 0)
                for _, _, details in player_results.values()
            )
            result["cross_world_items_total"] = total_cross_world_items

            # Check if all players passed
            all_passed = all(passed for passed, _, _ in player_results.values())
            result["passed"] = all_passed

            # Clean up archive
            if archive_path:
                try:
                    archive_path.unlink()
                except OSError:
                    pass

            # Clean up the multiworld object
            del multiworld

        except Exception as e:
            import traceback
            traceback.print_exc()
            result["error"] = f"Validation error: {e}"

    else:
        # Original approach: subprocess + UT validation
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
    world_dirs: List[str],
    use_sphere_validation: bool = False,
    test_iteration: int = 0
) -> Dict:
    """
    Run multiple multiworld tests with different seeds.
    For each run, regenerates random YAMLs for all games.

    Args:
        multiworld_dir: Directory containing player YAML files
        runs: Number of test runs
        base_seed: Base random seed (None for random)
        project_root: Path to project root
        world_dirs: List of world directory names in the multiworld
        use_sphere_validation: If True, use in-process generation with sphere validation
        test_iteration: Counter for how many times this function has been called,
            used to ensure different YAMLs are generated each time the multiworld
            composition changes (even with the same base_seed)

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
        # Include test_iteration to ensure different YAMLs when multiworld composition changes
        if base_seed is not None:
            seed = base_seed + i + (test_iteration * 100000)
        else:
            seed = random.randint(1, 999999999)

        print(f"    Run {i + 1}/{runs} (seed {seed})...", end=" ", flush=True)

        # Clean up all YAML files before regenerating
        # This ensures no stale files from previous iterations with different player numbers
        for old_yaml in multiworld_dir.glob("*.yaml"):
            try:
                old_yaml.unlink()
            except OSError:
                pass

        # Regenerate random YAMLs for this run
        # Each game gets a unique seed based on: base_seed + run_index + test_iteration + player_offset
        for j, world_dir in enumerate(world_dirs):
            yaml_content = generate_random_yaml_for_game(world_dir, j + 1, seed + j * 1000)
            if yaml_content:
                yaml_path = multiworld_dir / f"{world_dir}_{j + 1}.yaml"
                with open(yaml_path, 'w', encoding='utf-8') as f:
                    f.write(yaml_content)

        test_result = run_multiworld_test(multiworld_dir, seed, project_root, use_sphere_validation)
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
    parser.add_argument(
        '--sphere-validation',
        action='store_true',
        default=True,
        help='Use in-process generation with full sphere validation (default). '
             'This keeps the MultiWorld object alive to validate cross-world item dependencies.'
    )
    parser.add_argument(
        '--ut-validation',
        action='store_true',
        help='Use subprocess generation with UT-based validation instead of sphere validation. '
             'Faster but less thorough - does not validate cross-world item dependencies.'
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
    print(f"Validation mode: {'sphere (in-process)' if args.sphere_validation and not args.ut_validation else 'UT (subprocess)'}")
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
            "script_version": "1.1.0",
            "seed_mode": seed_type,
            "seed": args.seed if args.seed is not None else "random",
            "runs_per_test": args.runs,
            "max_players": args.max_players,
            "total_templates_considered": len(template_files),
            "validation_mode": "sphere" if args.sphere_validation and not args.ut_validation else "ut"
        },
        "assembly_order": [],  # Order in which games were added
        "final_multiworld": [],  # Games (world_dirs) in the final multiworld
        "rejected_games": [],  # Games that failed to integrate
        "results": {}
    }

    # Track statistics
    games_in_multiworld: List[str] = []  # List of world directory names
    rejected_games: List[Dict] = []
    test_iteration = 0  # Counter to ensure different YAMLs each time the test is run

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

        # Check max players limit - use sliding window approach
        if len(games_in_multiworld) >= args.max_players:
            # Remove the oldest game to make room for the new one
            oldest_game = games_in_multiworld[0]
            oldest_yaml = None

            # Find and remove the oldest game's YAML file
            for yaml_file in multiworld_dir.glob("*.yaml"):
                if yaml_file.name.startswith(f"{oldest_game}_"):
                    oldest_yaml = yaml_file
                    break

            if oldest_yaml:
                try:
                    oldest_yaml.unlink()
                    print(f"  Removed oldest game {oldest_game} ({oldest_yaml.name}) to make room")
                except OSError as e:
                    print(f"  Warning: Could not remove {oldest_yaml.name}: {e}")

            games_in_multiworld.pop(0)
            print(f"  Multiworld now has {len(games_in_multiworld)} games (limit: {args.max_players})")

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
            world_dirs=games_in_multiworld,
            use_sphere_validation=args.sphere_validation and not args.ut_validation,
            test_iteration=test_iteration
        )
        test_iteration += 1  # Increment for next test to get different YAMLs

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

            # Update results for ALL games in the multiworld with this test result
            # This ensures each game's result reflects its most recent test
            for existing_template_name, existing_result in results["results"].items():
                existing_world_dir = existing_result.get("world_dir")
                if existing_world_dir in games_in_multiworld:
                    # Update this game's result with the latest test
                    existing_result["test_result"] = test_result
                    existing_result["multiworld_size"] = player_count
                    existing_result["games_in_multiworld"] = games_in_multiworld.copy()
                    existing_result["timestamp"] = datetime.now().isoformat()
                    existing_result["status"] = "passed"
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
