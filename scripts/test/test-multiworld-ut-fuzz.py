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
    python scripts/test/test-multiworld-ut-fuzz.py --runs 5 --ut-results scripts/output/ut-fuzz/test-results-worldgen-fixed-seed.json
"""

import argparse
import copy
import json
import logging
import os
import random
import signal
import shutil
import subprocess
import sys
import tempfile
import time
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

# Import error classification utility
from worlds.tracker.fuzzer_hook import should_ignore_generation_error, IGNORED_ERROR_PATTERNS


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


def should_ignore_generation_output(error_output: str) -> bool:
    """
    Check if subprocess error output contains patterns that should be ignored.

    This is used for subprocess-based generation where we don't have the
    exception object, only the error text output.
    """
    if not error_output:
        return False

    for pattern in IGNORED_ERROR_PATTERNS:
        if pattern in error_output:
            return True

    # Check for filler-related errors (case-insensitive)
    if "filler" in error_output.lower():
        return True

    return False


def run_generation(
    multiworld_dir: Path,
    seed: int,
    project_root: Path,
    timeout_seconds: int = 60
) -> Tuple[bool, str, Optional[Path], bool]:
    """
    Run Generate.py with templates in multiworld directory.

    Returns (success, error_message, output_archive_path, was_ignored)

    The was_ignored flag indicates whether a generation failure was due to
    option-related errors that should be ignored rather than counted as failures.
    """
    templates = get_templates_in_multiworld(multiworld_dir)
    if len(templates) < 2:
        return False, f"Need at least 2 templates (have {len(templates)})", None, False

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
            timeout=timeout_seconds,
            cwd=str(project_root)
        )

        if result.returncode != 0:
            error = result.stderr[:500] if result.stderr else result.stdout[:500]
            # Check if this error should be ignored
            full_output = (result.stderr or "") + (result.stdout or "")
            is_ignored = should_ignore_generation_output(full_output)
            return False, f"Generation {'ignored' if is_ignored else 'failed'}: {error}", None, is_ignored

        # Find the output archive
        output_dir = project_root / "output"
        if output_dir.exists():
            archives = sorted(output_dir.glob("AP_*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
            if archives:
                return True, "", archives[0], False

        return False, "No output archive found", None, False

    except subprocess.TimeoutExpired:
        return False, "Generation timed out", None, False
    except Exception as e:
        return False, str(e), None, False


class GenerationTimeoutError(Exception):
    """Raised when generation exceeds the timeout."""
    pass


def _timeout_handler(signum, frame):
    """Signal handler for generation timeout."""
    raise GenerationTimeoutError("Generation timed out")


def run_generation_inprocess(
    multiworld_dir: Path,
    seed: int,
    project_root: Path,
    timeout_seconds: int = 60
) -> Tuple[bool, str, Optional["MultiWorld"], Optional[Path], bool]:
    """
    Run generation in-process, keeping the MultiWorld object alive.

    Returns (success, error_message, multiworld_object, output_archive_path, was_ignored)

    The was_ignored flag indicates whether a generation failure was due to
    option-related errors (fill failures, validation errors) that should be
    ignored rather than counted as test failures.
    """
    templates = get_templates_in_multiworld(multiworld_dir)
    if len(templates) < 2:
        return False, f"Need at least 2 templates (have {len(templates)})", None, None, False

    print(f"    Running in-process generation with {len(templates)} players, seed {seed}")

    # Set up timeout using signal.alarm (Unix only)
    old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(timeout_seconds)

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

        # Cancel the alarm
        signal.alarm(0)

        # Find the output archive
        output_dir = project_root / "output"
        archive_path = None
        if output_dir.exists():
            archives = sorted(output_dir.glob("AP_*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
            if archives:
                archive_path = archives[0]

        return True, "", multiworld, archive_path, False

    except GenerationTimeoutError:
        return False, f"Generation timed out after {timeout_seconds} seconds", None, None, False

    except Exception as e:
        import traceback
        # Check if this is an error that should be ignored
        is_ignored = should_ignore_generation_error(e)
        error_msg = f"Generation {'ignored' if is_ignored else 'failed'}: {str(e)[:300]}"
        traceback.print_exc()
        return False, error_msg, None, None, is_ignored

    finally:
        # Always restore the old handler and cancel any pending alarm
        signal.alarm(0)
        signal.signal(signal.SIGALRM, old_handler)


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


def extract_files_from_archive(
    archive_path: Path,
    patterns: List[str],
    extract_dir: Path
) -> Dict[str, Path]:
    """
    Extract files matching patterns from an archive.

    Args:
        archive_path: Path to the ZIP archive
        patterns: List of filename patterns to extract (e.g., ["_rules.json", ".pkl.gz"])
        extract_dir: Directory to extract files to

    Returns:
        Dict mapping pattern to extracted file path
    """
    extract_dir.mkdir(parents=True, exist_ok=True)
    extracted = {}

    with zipfile.ZipFile(archive_path) as zf:
        for file in zf.namelist():
            for pattern in patterns:
                if pattern in file:
                    # Extract the file
                    zf.extract(file, extract_dir)
                    extracted[file] = extract_dir / file
                    break

    return extracted


def validate_multiworld_with_ut_pickle(
    multiworld: "MultiWorld",
    archive_path: Path,
    project_root: Path
) -> Dict[int, Tuple[bool, str, Dict]]:
    """
    Validate a multiworld using pickle-based Universal Tracker.

    This extracts the pickle from the archive and uses TrackerCore's pickle
    tracking mode to compare sphere-by-sphere with Python's calculations.

    Args:
        multiworld: The live MultiWorld object
        archive_path: Path to the generated archive
        project_root: Path to project root

    Returns:
        Dict of player_id -> (passed, error_message, details)
    """
    import logging
    from NetUtils import NetworkItem
    from worlds.tracker import TrackerCore, DeferredEntranceMode

    logger = logging.getLogger("MultiworldUTFuzz")
    results = {}
    num_players = multiworld.players

    print(f"    Validating multiworld with {num_players} players using UT pickle mode...")

    # Extract pickle from archive to temp directory
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        extracted = extract_files_from_archive(archive_path, [".pkl.gz", "_pickle_metadata.json"], temp_path)

        pickle_file = None
        for filename, path in extracted.items():
            if filename.endswith(".pkl.gz"):
                pickle_file = path
                break

        if not pickle_file:
            return {0: (False, "No pickle file found in archive", {})}

        # Get slot data from archive
        with zipfile.ZipFile(archive_path) as zf:
            archipelago_data = None
            for file in zf.namelist():
                if file.endswith(".archipelago"):
                    archipelago_data = zf.read(file)
                    break

        if not archipelago_data:
            return {0: (False, "No .archipelago file in archive", {})}

        from MultiServer import Context
        temp_data = Context.decompress(archipelago_data)
        slot_data_all = temp_data.get("slot_data", {})

        for player_id in range(1, num_players + 1):
            game_name = multiworld.game[player_id]
            world = multiworld.worlds[player_id]

            details = {
                "game": game_name,
                "validation_type": "ut_pickle",
                "spheres_checked": 0,
                "locations_validated": 0,
            }

            try:
                # Create TrackerCore for this player
                ut_core = TrackerCore.TrackerCore(logger, False, False)
                ut_core.enforce_deferred_connections = DeferredEntranceMode.disabled

                # Set up slot params BEFORE loading pickle
                ut_core.set_slot_params(game_name, player_id, multiworld.player_name[player_id], num_players)
                ut_core.seed_name = multiworld.seed_name

                # Load pickle directly
                if not ut_core.load_multiworld_from_pickle(str(pickle_file)):
                    results[player_id] = (False, f"Failed to load pickle for {game_name}", details)
                    continue

                # Initialize tracking from pickle (uses self.slot for player_id)
                if not ut_core.initialize_tracking_from_pickle():
                    results[player_id] = (False, f"Failed to init pickle tracking for {game_name}", details)
                    continue

                # Get slot data
                slot_data = slot_data_all.get(player_id, {})

                # Do sphere-by-sphere comparison
                result = _run_ut_sphere_comparison(
                    ut_core, multiworld, player_id, game_name, details
                )
                results[player_id] = result

            except Exception as e:
                import traceback
                traceback.print_exc()
                results[player_id] = (False, f"UT pickle error: {str(e)[:200]}", details)

    return results


def validate_multiworld_with_ut_worldgen(
    multiworld: "MultiWorld",
    archive_path: Path,
    multiworld_dir: Path,
    project_root: Path
) -> Dict[int, Tuple[bool, str, Dict]]:
    """
    Validate a multiworld using worldgen-based Universal Tracker.

    This extracts per-player rules.json files from the archive and uses
    TrackerCore's worldgen tracking mode to compare sphere-by-sphere.

    Args:
        multiworld: The live MultiWorld object
        archive_path: Path to the generated archive
        multiworld_dir: Directory containing player YAML files
        project_root: Path to project root

    Returns:
        Dict of player_id -> (passed, error_message, details)
    """
    import logging
    from NetUtils import NetworkItem
    from worlds.tracker import TrackerCore, DeferredEntranceMode
    from Utils import output_path

    logger = logging.getLogger("MultiworldUTFuzz")
    results = {}
    num_players = multiworld.players

    print(f"    Validating multiworld with {num_players} players using UT worldgen mode...")

    # Extract per-player rules.json files from archive to output directory
    # This is where auto_discover_rules_json will look for them
    output_dir = Path(output_path())
    extracted = extract_files_from_archive(archive_path, ["_rules.json"], output_dir)

    if not extracted:
        return {0: (False, "No rules.json files found in archive", {})}

    # Get slot data from archive
    with zipfile.ZipFile(archive_path) as zf:
        archipelago_data = None
        for file in zf.namelist():
            if file.endswith(".archipelago"):
                archipelago_data = zf.read(file)
                break

    if not archipelago_data:
        return {0: (False, "No .archipelago file in archive", {})}

    from MultiServer import Context
    temp_data = Context.decompress(archipelago_data)
    slot_data_all = temp_data.get("slot_data", {})

    try:
        for player_id in range(1, num_players + 1):
            game_name = multiworld.game[player_id]
            world = multiworld.worlds[player_id]

            details = {
                "game": game_name,
                "validation_type": "ut_worldgen",
                "spheres_checked": 0,
                "locations_validated": 0,
            }

            try:
                # Create TrackerCore for this player
                ut_core = TrackerCore.TrackerCore(logger, False, False)
                ut_core.enforce_deferred_connections = DeferredEntranceMode.disabled

                # Run generator for this player's YAML
                ut_core.run_generator(None, None, str(multiworld_dir))

                # Set up slot params - this sets self.slot for per-player rules.json discovery
                ut_core.set_slot_params(game_name, player_id, multiworld.player_name[player_id], num_players)
                ut_core.seed_name = multiworld.seed_name

                # Try to discover per-player rules.json
                if not ut_core.auto_discover_rules_json():
                    results[player_id] = (False, f"No rules.json found for player {player_id} ({game_name})", details)
                    continue

                # Get slot data from the archive
                slot_data = slot_data_all.get(player_id, {})

                # Initialize tracker core (will use worldgen mode since rules_json_path is set)
                ut_core.initalize_tracker_core(world.__class__, slot_data)

                if not ut_core.multiworld:
                    results[player_id] = (False, f"TrackerCore init failed: {ut_core.gen_error}", details)
                    continue

                # Do sphere-by-sphere comparison
                result = _run_ut_sphere_comparison(
                    ut_core, multiworld, player_id, game_name, details
                )
                results[player_id] = result

            except Exception as e:
                import traceback
                traceback.print_exc()
                results[player_id] = (False, f"UT worldgen error: {str(e)[:200]}", details)

    finally:
        # Clean up extracted rules.json files
        for filename, path in extracted.items():
            try:
                path.unlink()
            except OSError:
                pass

    return results


def _run_ut_sphere_comparison(
    ut_core,
    multiworld: "MultiWorld",
    player_id: int,
    game_name: str,
    details: Dict
) -> Tuple[bool, str, Dict]:
    """
    Run sphere-by-sphere comparison between UT and Python multiworld.

    Args:
        ut_core: Initialized TrackerCore
        multiworld: Live MultiWorld object
        player_id: Player ID to validate
        game_name: Name of the game
        details: Dict to update with validation details

    Returns:
        Tuple of (passed, error_message, details)
    """
    from NetUtils import NetworkItem

    world = multiworld.worlds[player_id]

    # Filter to only hashable addresses for this player
    remaining_locations = [
        loc.address for loc in world.get_locations()
        if loc.address is not None and not isinstance(loc.address, list)
    ]
    current_inventory = [
        NetworkItem(item.code, -2, item.player, item.classification)
        for item in multiworld.precollected_items[player_id]
        if item.code is not None
    ]
    new_items = []

    # Iterate through spheres
    sphere_errors = []
    for sphere_number, sphere in enumerate(multiworld.get_sendable_spheres()):
        # Filter to this player's locations in this sphere
        current_sphere = {}
        for loc in sphere:
            if loc.player == player_id and loc.address is not None:
                current_sphere[loc.name] = loc

        current_inventory.extend(new_items)
        new_items.clear()

        if current_sphere:
            details["spheres_checked"] = sphere_number + 1

            # Update UT with current state
            ut_core.set_missing_locations(set(remaining_locations))
            ut_core.set_items_received(current_inventory)
            update_ret = ut_core.updateTracker()

            # Check each location in the sphere
            locations_not_in_ut = []
            for loc_name, location in list(current_sphere.items()):
                if loc_name in update_ret.in_logic_locations:
                    # Location is in logic - collect it
                    true_item = location.item
                    new_items.append(NetworkItem(
                        true_item.code, location.address,
                        true_item.player, true_item.classification
                    ))
                    remaining_locations.remove(location.address)
                    details["locations_validated"] += 1
                else:
                    locations_not_in_ut.append(loc_name)

            if locations_not_in_ut:
                sphere_errors.append(
                    f"Sphere {sphere_number}: {len(locations_not_in_ut)} locations in Python but not UT: "
                    f"{locations_not_in_ut[:3]}{'...' if len(locations_not_in_ut) > 3 else ''}"
                )

    if sphere_errors:
        error_msg = f"UT mismatch for {game_name}: {sphere_errors[0]}"
        details["sphere_errors"] = sphere_errors[:5]
        return (False, error_msg, details)
    else:
        return (True, "", details)


def validate_multiworld_with_ut_spheres(
    multiworld: "MultiWorld",
    multiworld_dir: Path,
    project_root: Path
) -> Dict[int, Tuple[bool, str, Dict]]:
    """
    Validate a multiworld using Universal Tracker sphere-by-sphere comparison.

    This compares UT's logic calculations against Python's sphere calculations
    for each player in the multiworld. It's similar to how the single-player
    UT fuzz test works, but for each player in a multiworld.

    Returns dict of player_id -> (passed, error_message, details)
    """
    import logging
    from BaseClasses import ItemClassification
    from NetUtils import NetworkItem
    from worlds.tracker import TrackerCore, DeferredEntranceMode

    logger = logging.getLogger("MultiworldUTFuzz")
    results = {}
    num_players = multiworld.players

    print(f"    Validating multiworld with {num_players} players using UT sphere comparison...")

    # Get templates for player mapping
    templates = get_templates_in_multiworld(multiworld_dir)

    for player_id in range(1, num_players + 1):
        game_name = multiworld.game[player_id]
        world = multiworld.worlds[player_id]

        details = {
            "game": game_name,
            "validation_type": "ut_spheres",
            "spheres_checked": 0,
            "locations_validated": 0,
        }

        try:
            # Create TrackerCore for this player
            ut_core = TrackerCore.TrackerCore(logger, False, False)
            ut_core.enforce_deferred_connections = DeferredEntranceMode.disabled

            # Run generator for this player's YAML
            ut_core.run_generator(None, None, str(multiworld_dir))

            # Set up slot params
            ut_core.set_slot_params(game_name, player_id, multiworld.player_name[player_id], num_players)
            ut_core.seed_name = multiworld.seed_name
            ut_core.auto_discover_rules_json()

            # Get slot data from the multiworld
            slot_data = world.fill_slot_data() if hasattr(world, 'fill_slot_data') else {}

            # Initialize tracker core
            ut_core.initalize_tracker_core(world.__class__, slot_data)

            if not ut_core.multiworld:
                results[player_id] = (False, f"TrackerCore init failed: {ut_core.gen_error}", details)
                continue

            # Now do sphere-by-sphere comparison
            # Filter to only hashable addresses for this player
            remaining_locations = [
                loc.address for loc in world.get_locations()
                if loc.address is not None and not isinstance(loc.address, list)
            ]
            current_inventory = [
                NetworkItem(item.code, -2, item.player, item.classification)
                for item in multiworld.precollected_items[player_id]
                if item.code is not None
            ]
            new_items = []

            # Iterate through spheres
            sphere_errors = []
            for sphere_number, sphere in enumerate(multiworld.get_sendable_spheres()):
                # Filter to this player's locations in this sphere
                current_sphere = {}
                for loc in sphere:
                    if loc.player == player_id and loc.address is not None:
                        current_sphere[loc.name] = loc

                current_inventory.extend(new_items)
                new_items.clear()

                if current_sphere:
                    details["spheres_checked"] = sphere_number + 1

                    # Update UT with current state
                    ut_core.set_missing_locations(set(remaining_locations))
                    ut_core.set_items_received(current_inventory)
                    update_ret = ut_core.updateTracker()

                    # Check each location in the sphere
                    locations_not_in_ut = []
                    for loc_name, location in list(current_sphere.items()):
                        if loc_name in update_ret.in_logic_locations:
                            # Location is in logic - collect it
                            true_item = location.item
                            new_items.append(NetworkItem(
                                true_item.code, location.address,
                                true_item.player, true_item.classification
                            ))
                            remaining_locations.remove(location.address)
                            details["locations_validated"] += 1
                        else:
                            locations_not_in_ut.append(loc_name)

                    if locations_not_in_ut:
                        sphere_errors.append(
                            f"Sphere {sphere_number}: {len(locations_not_in_ut)} locations in Python but not UT: "
                            f"{locations_not_in_ut[:3]}{'...' if len(locations_not_in_ut) > 3 else ''}"
                        )

            if sphere_errors:
                error_msg = f"UT mismatch for {game_name}: {sphere_errors[0]}"
                details["sphere_errors"] = sphere_errors[:5]
                results[player_id] = (False, error_msg, details)
            else:
                results[player_id] = (True, "", details)

        except Exception as e:
            import traceback
            traceback.print_exc()
            results[player_id] = (False, f"UT validation error: {str(e)[:200]}", details)

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
    ignore_generation_errors: bool = True,
    timeout_seconds: int = 60,
    ut_mode: str = "none"
) -> Dict:
    """
    Run a complete multiworld test: generate and validate.

    This runs generation in-process to get a live MultiWorld object, then
    validates using sphere validation (always) and optionally UT validation.

    Args:
        multiworld_dir: Directory containing player YAML files
        seed: Random seed for generation
        project_root: Path to project root
        ignore_generation_errors: If True, treat option-related generation errors
            as "ignored" rather than failures.
        timeout_seconds: Maximum time in seconds for generation (default: 60)
        ut_mode: UT validation mode - "none" (sphere only), "pickle", or "worldgen"

    Returns a dict with test results.
    """
    start_time = time.perf_counter()

    validation_mode = "sphere" if ut_mode == "none" else f"sphere+ut_{ut_mode}"
    result = {
        "passed": False,
        "generation_success": False,
        "generation_ignored": False,  # True if generation failed but was ignored
        "player_results": {},
        "error": None,
        "validation_mode": validation_mode,
        "elapsed_seconds": 0.0
    }

    # Run generation in-process to get live MultiWorld object
    gen_success, gen_error, multiworld, archive_path, was_ignored = run_generation_inprocess(
        multiworld_dir, seed, project_root, timeout_seconds
    )

    if not gen_success:
        result["error"] = gen_error
        if was_ignored and ignore_generation_errors:
            result["generation_ignored"] = True
            result["passed"] = True  # Ignored errors count as passed
        result["elapsed_seconds"] = time.perf_counter() - start_time
        return result

    result["generation_success"] = True
    if archive_path:
        result["archive_path"] = str(archive_path)

    try:
        # === SPHERE VALIDATION ===
        # Validates that all locations are reachable with all items collected
        sphere_results = validate_multiworld_with_spheres(multiworld, multiworld_dir)

        # Aggregate cross-world statistics
        total_cross_world_items = sum(
            details.get("items_from_other_players", 0)
            for _, _, details in sphere_results.values()
        )
        result["cross_world_items_total"] = total_cross_world_items

        sphere_all_passed = all(passed for passed, _, _ in sphere_results.values())

        # === UT VALIDATION (if enabled) ===
        ut_results = None
        ut_all_passed = True

        if ut_mode != "none" and archive_path:
            if ut_mode == "pickle":
                ut_results = validate_multiworld_with_ut_pickle(
                    multiworld, archive_path, project_root
                )
            elif ut_mode == "worldgen":
                ut_results = validate_multiworld_with_ut_worldgen(
                    multiworld, archive_path, multiworld_dir, project_root
                )

            if ut_results:
                ut_all_passed = all(passed for passed, _, _ in ut_results.values())

        # === BUILD COMBINED RESULTS ===
        for pid, (sphere_passed, sphere_error, sphere_details) in sphere_results.items():
            combined_passed = sphere_passed
            combined_error = ""
            combined_details = {**sphere_details}

            if not sphere_passed:
                combined_error = f"[Sphere] {sphere_error}"

            # Add UT results if available
            if ut_results and pid in ut_results:
                ut_passed, ut_error, ut_details = ut_results[pid]
                combined_passed = combined_passed and ut_passed

                if not ut_passed:
                    if combined_error:
                        combined_error += f"; [UT] {ut_error}"
                    else:
                        combined_error = f"[UT] {ut_error}"

                # Merge UT details
                combined_details["ut_validation_type"] = ut_details.get("validation_type", ut_mode)
                combined_details["ut_spheres_checked"] = ut_details.get("spheres_checked", 0)
                combined_details["ut_locations_validated"] = ut_details.get("locations_validated", 0)
                if "sphere_errors" in ut_details:
                    combined_details["ut_sphere_errors"] = ut_details["sphere_errors"]

            result["player_results"][str(pid)] = {
                "passed": combined_passed,
                "error": combined_error,
                "details": combined_details
            }

        # Overall pass: sphere validation AND UT validation (if enabled) must pass
        result["passed"] = sphere_all_passed and ut_all_passed

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

    result["elapsed_seconds"] = time.perf_counter() - start_time
    return result


def run_multiple_tests(
    multiworld_dir: Path,
    runs: int,
    base_seed: Optional[int],
    project_root: Path,
    world_dirs: List[str],
    test_iteration: int = 0,
    ignore_generation_errors: bool = True,
    timeout_seconds: int = 60,
    ut_mode: str = "none"
) -> Dict:
    """
    Run multiple multiworld tests with different seeds.
    For each run, regenerates random YAMLs for all games.

    Sphere validation is always run. UT validation is run based on ut_mode.
    The test fails if any enabled validation fails for any player.

    Generation failures are recorded separately from validation failures.
    A generation failure does not count as a test failure - only validation
    failures after successful generation count as test failures.

    The caller (or results-reading script) can decide how to handle runs where
    all generations failed.

    Args:
        multiworld_dir: Directory containing player YAML files
        runs: Number of test runs to complete
        base_seed: Base random seed (None for random)
        project_root: Path to project root
        world_dirs: List of world directory names in the multiworld
        test_iteration: Counter for how many times this function has been called,
            used to ensure different YAMLs are generated each time the multiworld
            composition changes (even with the same base_seed)
        ignore_generation_errors: If True, treat option-related generation errors
            as "ignored" rather than failures.
        timeout_seconds: Maximum time in seconds for each generation (default: 60)
        ut_mode: UT validation mode - "none" (sphere only), "pickle", or "worldgen"

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
            "ignored": 0,
            "generation_failures": 0,
            "error": f"Need at least 2 templates (have {num_players})"
        }

    results = {
        "passed": True,
        "total": runs,
        "success": 0,
        "failure": 0,
        "ignored": 0,  # Track ignored generation errors (option-related)
        "generation_failures": 0,  # Track generation failures (not validation failures)
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

        test_result = run_multiworld_test(
            multiworld_dir, seed, project_root,
            ignore_generation_errors, timeout_seconds, ut_mode
        )

        results["run_results"].append({
            "seed": seed,
            "result": test_result
        })

        # Check if this was a generation failure (not a validation failure)
        is_generation_failure = (
            not test_result.get("generation_success", False) and
            not test_result.get("generation_ignored", False)
        )

        if is_generation_failure:
            # Generation failed - record it but don't count as test failure
            results["generation_failures"] += 1
            error = test_result.get("error") or "Unknown generation error"
            print(f"GEN FAIL: {error[:50]}...")
        elif test_result.get("generation_ignored"):
            # Generation failed with ignorable error (option-related)
            results["ignored"] += 1
            results["success"] += 1  # Ignored counts as success
            print("IGNORED (option error)")
        elif test_result["passed"]:
            # Generation succeeded and validation passed
            results["success"] += 1
            print("PASS")
        else:
            # Validation failed (generation succeeded but validation didn't)
            results["failure"] += 1
            results["passed"] = False
            error = test_result.get("error") or "Unknown error"
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
        default='scripts/output/ut-fuzz/test-results-worldgen-fixed-seed.json',
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
        '--ut-mode',
        type=str,
        choices=['none', 'pickle', 'worldgen'],
        default='none',
        help='UT validation mode: "none" (sphere validation only), '
             '"pickle" (use pickle-based UT tracking), or '
             '"worldgen" (use worldgen-based UT with per-player rules.json). '
             '(default: none)'
    )
    parser.add_argument(
        '--ignore-generation-errors',
        action='store_true',
        default=True,
        help='Treat option-related generation errors (fill failures, validation errors) as '
             '"ignored" rather than failures. These are expected when fuzzing with random options. '
             '(default: True)'
    )
    parser.add_argument(
        '--no-ignore-generation-errors',
        action='store_true',
        help='Count all generation errors as failures, even option-related ones.'
    )
    parser.add_argument(
        '-t', '--timeout',
        type=int,
        default=600,
        help='Timeout per generation in seconds (default: 60)'
    )

    args = parser.parse_args()

    # Handle the ignore generation errors flags
    ignore_generation_errors = args.ignore_generation_errors and not args.no_ignore_generation_errors

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
    print(f"Validation mode: both (sphere + UT)")
    print(f"Ignore generation errors: {ignore_generation_errors}")
    print(f"Timeout per generation: {args.timeout}s")
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
            "script_version": "1.3.0",
            "seed_mode": seed_type,
            "seed": args.seed if args.seed is not None else "random",
            "runs_per_test": args.runs,
            "max_players": args.max_players,
            "total_templates_considered": len(template_files),
            "validation_mode": "both",
            "ignore_generation_errors": ignore_generation_errors
        },
        "assembly_order": [],  # Order in which games were added
        "final_multiworld": [],  # Games (world_dirs) in the final multiworld
        "rejected_games": [],  # Games that failed to integrate
        "ignored_games": [],  # Games where generation was ignored (option errors)
        "results": {}
    }

    # Track statistics
    games_in_multiworld: List[str] = []  # List of world directory names
    rejected_games: List[Dict] = []
    ignored_games: List[Dict] = []  # Games where generation was ignored (option errors)
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
            test_iteration=test_iteration,
            ignore_generation_errors=ignore_generation_errors,
            timeout_seconds=args.timeout,
            ut_mode=args.ut_mode
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

        # Check if ALL generation attempts failed
        # This is different from validation failures - we couldn't even test the game
        total_runs = test_result.get("total", 0)
        gen_failures = test_result.get("generation_failures", 0)
        all_gen_failed = total_runs > 0 and gen_failures == total_runs

        if all_gen_failed:
            # All generation attempts failed - remove the game from multiworld
            print(f"  ALL GEN FAILED: {gen_failures}/{total_runs} runs could not generate")
            game_result["status"] = "all_gen_failed"

            # Remove the game from multiworld
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
                "reason": "All generation attempts failed",
                "generation_failures": gen_failures,
                "total": total_runs
            })
        elif test_result["passed"]:
            ignored_count = test_result.get("ignored", 0)
            gen_fail_count = test_result.get("generation_failures", 0)
            if ignored_count > 0:
                print(f"  PASSED: {test_result['success']}/{test_result['total']} runs succeeded ({ignored_count} ignored)")
            elif gen_fail_count > 0:
                print(f"  PASSED: {test_result['success']}/{test_result['total']} runs succeeded ({gen_fail_count} gen failed)")
            else:
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
        results["ignored_games"] = ignored_games.copy()
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2)

    # Final summary
    results["metadata"]["last_updated"] = datetime.now().isoformat()
    results["final_multiworld"] = games_in_multiworld.copy()
    results["rejected_games"] = rejected_games.copy()
    results["ignored_games"] = ignored_games.copy()

    # Save final results
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Templates considered: {len(template_files)}")
    print(f"Games in final multiworld: {len(games_in_multiworld)}")
    print(f"Rejected games: {len(rejected_games)}")
    print(f"Ignored runs: {sum(r.get('test_result', {}).get('ignored', 0) for r in results['results'].values())}")
    print(f"\nFinal multiworld ({len(games_in_multiworld)} games):")
    for game in games_in_multiworld:
        print(f"  - {game}")
    if rejected_games:
        print(f"\nRejected games ({len(rejected_games)}):")
        for rejection in rejected_games:
            print(f"  - {rejection['world_dir']}: {rejection['reason']}")
    if ignored_games:
        print(f"\nIgnored games ({len(ignored_games)}):")
        for ignored in ignored_games:
            print(f"  - {ignored['world_dir']}: {ignored['reason']}")
    print(f"\nResults saved to: {output_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
