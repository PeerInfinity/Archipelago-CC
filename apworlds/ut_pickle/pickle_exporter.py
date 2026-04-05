"""
Pickle-based multiworld exporter for Universal Tracker.

Exports the multiworld object as a gzip-compressed dill pickle,
which preserves lambdas and functions used in access rules. This allows
the tracker to load the multiworld directly without needing to regenerate.
"""

import gzip
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional, TYPE_CHECKING

import dill

import Utils

if TYPE_CHECKING:
    from BaseClasses import MultiWorld

logger = logging.getLogger(__name__)

# File extension for pickle exports
PICKLE_EXTENSION = ".pkl.gz"

# Metadata file extension (JSON sidecar with info for discovery)
METADATA_EXTENSION = "_pickle_meta.json"


def export_multiworld_pickle(
    multiworld: "MultiWorld",
    output_dir: str,
    filename_base: str,
) -> Dict[str, str]:
    """
    Export the multiworld as a gzip-compressed dill pickle for tracker use.

    Args:
        multiworld: MultiWorld instance to export
        output_dir: Directory to write output files
        filename_base: Base name for output files (e.g., "AP_14089154938208861744")

    Returns:
        Dict containing paths to generated files
    """
    os.makedirs(output_dir, exist_ok=True)

    result_paths = {}

    pickle_filename = f"{filename_base}{PICKLE_EXTENSION}"
    metadata_filename = f"{filename_base}{METADATA_EXTENSION}"
    pickle_path = os.path.join(output_dir, pickle_filename)
    metadata_path = os.path.join(output_dir, metadata_filename)

    # Collect metadata for discovery
    metadata = _collect_metadata(multiworld)

    # Export the multiworld with dill and gzip compression
    logger.info(f"Exporting multiworld pickle to {pickle_path}")
    try:
        _export_pickle(multiworld, pickle_path)
        result_paths['pickle'] = pickle_path
        logger.info(f"Successfully exported multiworld pickle ({_get_file_size_str(pickle_path)})")
    except Exception as e:
        logger.error(f"Failed to export multiworld pickle: {e}")
        raise

    # Write metadata JSON
    try:
        with open(metadata_path, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        result_paths['metadata'] = metadata_path
        logger.debug(f"Wrote metadata to {metadata_path}")
    except Exception as e:
        logger.error(f"Failed to write metadata: {e}")

    return result_paths


def _export_pickle(multiworld: "MultiWorld", path: str) -> None:
    """Export the multiworld to a gzip-compressed dill pickle file."""
    # Prepare multiworld for pickling by replacing unpicklable objects
    _prepare_multiworld_for_pickle(multiworld)

    # Increase recursion limit for complex worlds (e.g., ALttP)
    original_limit = sys.getrecursionlimit()
    try:
        sys.setrecursionlimit(max(original_limit, 10000))
        with gzip.open(path, 'wb', compresslevel=6) as f:
            dill.dump(multiworld, f, protocol=dill.HIGHEST_PROTOCOL)
    finally:
        sys.setrecursionlimit(original_limit)


def _prepare_multiworld_for_pickle(multiworld: "MultiWorld") -> None:
    """
    Prepare a multiworld for pickling by replacing unpicklable objects.

    The main issue is ThreadBarrierProxy which wraps multiworld.random.
    """
    from BaseClasses import ThreadBarrierProxy

    if hasattr(multiworld, 'random') and isinstance(multiworld.random, ThreadBarrierProxy):
        multiworld.random = multiworld.random.obj
        logger.debug("Replaced ThreadBarrierProxy with underlying random.Random")

    if hasattr(multiworld, 'spoiler'):
        multiworld.spoiler = None
        logger.debug("Cleared spoiler object for pickling")


def _collect_metadata(multiworld: "MultiWorld") -> Dict[str, Any]:
    """Collect metadata about the multiworld for discovery and validation."""
    metadata = {
        'schema_version': 1,
        'archipelago_version': Utils.__version__,
        'generation_seed': multiworld.seed,
        'seed_name': multiworld.seed_name,
        'players': {},
    }

    for player_id in multiworld.player_ids:
        world = multiworld.worlds.get(player_id)
        if world:
            player_name = multiworld.player_name.get(player_id, f"Player{player_id}")
            metadata['players'][str(player_id)] = {
                'name': player_name,
                'game': world.game,
            }
            try:
                module_path = type(world).__module__
                parts = module_path.split('.')
                if len(parts) >= 2 and parts[0] == 'worlds':
                    metadata['players'][str(player_id)]['world_directory'] = parts[1]
            except Exception:
                pass

    return metadata


def _get_file_size_str(path: str) -> str:
    """Get a human-readable file size string."""
    size = os.path.getsize(path)
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def load_multiworld_pickle(path: str) -> "MultiWorld":
    """Load a multiworld from a gzip-compressed dill pickle file."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Pickle file not found: {path}")

    logger.info(f"Loading multiworld from pickle: {path}")

    with gzip.open(path, 'rb') as f:
        multiworld = dill.load(f)

    logger.info("Successfully loaded multiworld from pickle")
    return multiworld


def load_pickle_metadata(path: str) -> Optional[Dict[str, Any]]:
    """Load metadata from a pickle metadata JSON file."""
    if not os.path.exists(path):
        return None

    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)
