"""Game-specific rule helper functions."""

import os
import sys
import importlib
import inspect
import logging
from pathlib import Path
from typing import Dict, Type, Optional, Tuple
from .base import BaseGameExportHandler
from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)

# Module-level cache for handler instances
_handler_cache: Dict[Tuple[str, Optional[int]], BaseGameExportHandler] = {}

# Cache for world mapping (lazy loaded)
_world_mapping_cache: Optional[Dict[str, Dict]] = None

# Automatically discover and register all game handlers
GAME_HANDLERS: Dict[str, Type[BaseGameExportHandler]] = {}


def _get_world_mapping() -> Dict[str, Dict]:
    """
    Get the world mapping, building it lazily on first access.

    Returns a dict mapping game names to world info including:
    - world_directory: the directory name in worlds/
    - exporter_path: path to custom exporter if it exists
    """
    global _world_mapping_cache

    if _world_mapping_cache is not None:
        return _world_mapping_cache

    # Find project root (go up from exporter/games to project root)
    current_dir = Path(__file__).parent
    project_root = current_dir.parent.parent

    try:
        # Import the module using importlib.util (handles hyphenated filenames)
        import importlib.util
        script_path = project_root / 'scripts' / 'build' / 'build-world-mapping.py'

        if script_path.exists():
            spec = importlib.util.spec_from_file_location("build_world_mapping", script_path)
            build_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(build_module)

            worlds_dir = project_root / 'worlds'
            _world_mapping_cache = build_module.build_world_mapping(str(worlds_dir))
        else:
            logger.warning(f"build-world-mapping.py not found at {script_path}")
            _world_mapping_cache = {}
    except Exception as e:
        logger.warning(f"Error building world mapping: {e}")
        _world_mapping_cache = {}

    return _world_mapping_cache


def _build_exporter_to_game_mapping() -> Dict[str, str]:
    """
    Build a reverse mapping from exporter module name to game name.

    Returns dict like: {'ahit': 'A Hat in Time', 'messenger': 'The Messenger', ...}
    """
    world_mapping = _get_world_mapping()

    exporter_to_game = {}
    for game_name, info in world_mapping.items():
        if info.get('has_custom_exporter') and info.get('world_directory'):
            # Map world_directory (which is the module name) to game name
            exporter_to_game[info['world_directory']] = game_name

    return exporter_to_game


def _discover_handlers():
    """
    Automatically discover all game export handlers in this directory.

    Scans all Python files in the exporter/games directory and looks for classes
    that inherit from BaseGameExportHandler. Game names are determined by:
    1. The GAME_NAME class attribute (if present)
    2. Looking up the module name in the world mapping (fallback)

    Returns:
        Dict mapping game names to handler classes
    """
    handlers = {'Generic': GenericGameExportHandler}

    current_dir = os.path.dirname(__file__)

    # Build reverse mapping from module name to game name
    exporter_to_game = _build_exporter_to_game_mapping()

    # Iterate through all .py files in this directory
    for filename in os.listdir(current_dir):
        if not filename.endswith('.py') or filename.startswith('_'):
            continue
        if filename in ['base.py', 'generic.py']:  # Skip base classes
            continue

        module_name = filename[:-3]  # Remove .py extension

        try:
            # Import the module
            module = importlib.import_module(f'.{module_name}', package='exporter.games')

            # Find all classes that inherit from BaseGameExportHandler
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, BaseGameExportHandler) and
                    obj is not BaseGameExportHandler and
                    obj is not GenericGameExportHandler):

                    # Determine game name: prefer GAME_NAME attribute, fall back to mapping
                    if hasattr(obj, 'GAME_NAME') and obj.GAME_NAME:
                        game_name = obj.GAME_NAME
                    elif module_name in exporter_to_game:
                        game_name = exporter_to_game[module_name]
                        logger.debug(f"Inferred game name '{game_name}' for {name} from world mapping")
                    else:
                        logger.warning(
                            f"Handler class {name} in {filename} has no GAME_NAME and "
                            f"module '{module_name}' not found in world mapping"
                        )
                        continue

                    handlers[game_name] = obj
                    logger.debug(f"Registered handler for '{game_name}': {name}")

        except Exception as e:
            # Log but don't fail - allows for graceful degradation
            logger.warning(
                f"Failed to load game handler from {filename}: {e}"
            )

    return handlers

# Populate handlers on module import
GAME_HANDLERS = _discover_handlers()

def get_game_export_handler(game_name: str, world=None) -> BaseGameExportHandler:
    """
    Get the appropriate helper expander for the game.

    Handlers are cached per (game_name, world_id) to avoid repeated instantiation.

    Args:
        game_name: Name of the game
        world: Optional world instance (some handlers require this)

    Returns:
        Handler instance for the specified game
    """
    # Use world ID as cache key (objects aren't hashable, but their IDs are)
    cache_key = (game_name, id(world) if world else None)

    if cache_key not in _handler_cache:
        handler_class = GAME_HANDLERS.get(game_name)

        # If no exact match, try matching test worlds to their base game handlers
        # e.g., "DLCQuest Test" -> "DLCQuest" handler
        if handler_class is None and game_name.endswith(' Test'):
            base_game_name = game_name[:-5]  # Remove " Test" suffix
            handler_class = GAME_HANDLERS.get(base_game_name)
            if handler_class:
                logger.debug(f"Using '{base_game_name}' handler for test world '{game_name}'")

        # Fall back to generic handler
        if handler_class is None:
            handler_class = GenericGameExportHandler

        # Try to instantiate with world parameter first, fall back to no params
        try:
            handler = handler_class(world)
        except TypeError:
            # Handler doesn't accept world parameter
            handler = handler_class()

        # Call initialization methods if they exist (e.g., build_rule_string_map for OOT)
        if hasattr(handler, 'build_rule_string_map') and world is not None:
            try:
                handler.build_rule_string_map(world)
            except Exception as e:
                logger.warning(f"Failed to build rule string map for {game_name}: {e}")

        _handler_cache[cache_key] = handler

    return _handler_cache[cache_key]

def clear_handler_cache():
    """Clear the handler cache. Call this between generations if needed."""
    _handler_cache.clear()

def clear_world_mapping_cache():
    """Clear the world mapping cache. Call this if worlds have changed."""
    global _world_mapping_cache
    _world_mapping_cache = None
