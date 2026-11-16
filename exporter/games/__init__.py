"""Game-specific rule helper functions.

This package organizes game export handlers into three categories:
- base/: Base classes (BaseGameExportHandler) and generic handler (GenericGameExportHandler)
- official/: Handlers for games included in the official Archipelago distribution
- unofficial/: Handlers for community-created .apworld packages
"""

import os
import importlib
import inspect
import pkgutil
import logging
from typing import Dict, Type, Optional, Tuple
from .base import BaseGameExportHandler, GenericGameExportHandler

logger = logging.getLogger(__name__)

# Module-level cache for handler instances
_handler_cache: Dict[Tuple[Optional[str], Optional[int]], BaseGameExportHandler] = {}

# Handlers registered by module name (matches world directory)
# e.g., 'alttp' -> ALttPGameExportHandler
GAME_HANDLERS: Dict[str, Type[BaseGameExportHandler]] = {}

# Handler subdirectories to scan for automatic discovery
HANDLER_DIRECTORIES = ['official', 'unofficial']


def _get_world_directory(world) -> Optional[str]:
    """
    Extract the world directory name from a world object.

    The world's module path is like 'worlds.alttp' or 'worlds.alttp.SubModule',
    so we extract the second component which is the world directory.

    For worldgen worlds (e.g., 'mmbn3_worldgen'), we strip the '_worldgen' suffix
    to use the parent game's handler (e.g., 'mmbn3'), since worldgen worlds need
    the same helper definitions and export logic as their parent games.

    Args:
        world: A world instance

    Returns:
        The world directory name (e.g., 'alttp'), or None if it can't be determined
    """
    if world is None:
        return None

    try:
        module_path = type(world).__module__
        parts = module_path.split('.')
        if len(parts) >= 2 and parts[0] == 'worlds':
            world_dir = parts[1]
            # For worldgen worlds, check if a specific worldgen handler exists first.
            # If so, use the worldgen handler; otherwise fall back to parent game's handler.
            if world_dir.endswith('_worldgen'):
                # Check if a specific worldgen handler module exists in any handler directory
                # (by import spec, not by file path: a zipped copy has no files on disk)
                for subdir in HANDLER_DIRECTORIES:
                    if _handler_module_exists(f'{__name__}.{subdir}', world_dir):
                        # Use the worldgen-specific handler
                        return world_dir
                # Fall back to parent game's handler
                world_dir = world_dir[:-9]  # Remove '_worldgen' (9 chars)
            return world_dir
    except Exception as e:
        logger.debug(f"Could not extract world directory: {e}")

    return None


def _handler_module_names(package_name: str) -> list:
    """The handler module names of a handler package: its non-package modules whose
    names do not start with ``_``, sorted.

    Listed by ``pkgutil.iter_modules`` over the package's ``__path__``, so the same set is
    found in a folder and inside a zipped ``.apworld`` (zipimport), where ``os.listdir``
    sees nothing. Sorted so discovery order (and so which of two same-named handlers
    wins) does not depend on the filesystem's listing order.
    """
    try:
        package = importlib.import_module(package_name)
    except Exception as e:
        logger.warning(f"Could not import handler package {package_name}: {e}")
        return []
    return sorted(
        info.name for info in pkgutil.iter_modules(getattr(package, '__path__', []))
        if not info.ispkg and not info.name.startswith('_')
    )


def _handler_module_exists(package_name: str, module_name: str) -> bool:
    """Whether ``package_name.module_name`` is a handler module (folder or zip)."""
    return module_name in _handler_module_names(package_name)


def _discover_handlers_in_directory(directory_path: str, package_name: str) -> Dict[str, Type[BaseGameExportHandler]]:
    """
    Discover all game export handlers in a handler package.

    Args:
        directory_path: The package's directory (kept for callers; the modules are listed
            from the imported package, so a zipped copy is found too)
        package_name: Python package name for imports (e.g., 'exporter.games.official')

    Returns:
        Dict mapping module names to handler classes
    """
    handlers = {}

    for module_name in _handler_module_names(package_name):

        try:
            # Import the module
            module = importlib.import_module(f'.{module_name}', package=package_name)

            # Find all classes that inherit from BaseGameExportHandler
            for name, obj in inspect.getmembers(module, inspect.isclass):
                if (issubclass(obj, BaseGameExportHandler) and
                    obj is not BaseGameExportHandler and
                    obj is not GenericGameExportHandler):

                    # Register by module name (which matches world directory)
                    handlers[module_name] = obj
                    logger.debug(f"Registered handler '{module_name}': {name} from {package_name}")
                    break  # Only one handler per module

        except Exception as e:
            # Log but don't fail - allows for graceful degradation
            logger.warning(
                f"Failed to load game handler from {package_name}.{module_name}: {e}"
            )

    return handlers


def _discover_handlers() -> Dict[str, Type[BaseGameExportHandler]]:
    """
    Automatically discover all game export handlers in all handler directories.

    Scans the official/ and unofficial/ subdirectories for Python files containing
    classes that inherit from BaseGameExportHandler. Handlers are registered by their
    module name (filename without .py), which matches the world directory name.

    For example:
    - exporter/games/official/alttp.py -> registered as 'alttp'
    - exporter/games/unofficial/toem_rule_builder.py -> registered as 'toem_rule_builder'

    If a handler exists in multiple directories, the first one found takes precedence
    (official before unofficial).

    Returns:
        Dict mapping module names to handler classes
    """
    handlers = {}
    current_dir = os.path.dirname(__file__)

    for subdir in HANDLER_DIRECTORIES:
        subdir_path = os.path.join(current_dir, subdir)
        package_name = f'{__name__}.{subdir}'

        subdir_handlers = _discover_handlers_in_directory(subdir_path, package_name)

        # Only add handlers that aren't already registered (first takes precedence)
        for name, handler_class in subdir_handlers.items():
            if name not in handlers:
                handlers[name] = handler_class
            else:
                logger.debug(f"Handler '{name}' already registered, skipping from {package_name}")

    if handlers:
        logger.info(f"Discovered {len(handlers)} game export handlers")
    else:
        # Every game would fall back to the generic handler and export degraded rules
        # (design-upstream-addon.md, defect 1): never silent.
        logger.warning(
            "Discovered 0 game export handlers: every game falls back to the generic handler "
            f"(searched {', '.join(f'{__name__}.{d}' for d in HANDLER_DIRECTORIES)})"
        )
    return handlers


# Populate handlers on module import
GAME_HANDLERS = _discover_handlers()


def get_game_export_handler(game_name: Optional[str] = None, world=None, world_directory: Optional[str] = None) -> BaseGameExportHandler:
    """
    Get the appropriate export handler for the game.

    Handlers are looked up by world directory. The world directory can be:
    1. Extracted from the world object (preferred)
    2. Passed explicitly via world_directory parameter (for cleanup when world is unavailable)

    The game_name parameter is kept for backward compatibility but is not used for lookup.

    Handlers are cached per (world_directory, world_id) to avoid repeated instantiation.

    Args:
        game_name: Name of the game (kept for backward compatibility, not used for lookup)
        world: World instance (preferred for handler lookup)
        world_directory: Explicit world directory (used when world is unavailable)

    Returns:
        Handler instance for the specified game
    """
    # Get world directory: prefer from world object, fall back to explicit parameter
    world_dir = _get_world_directory(world) or world_directory

    # Use world directory and world ID as cache key
    cache_key = (world_dir, id(world) if world else None)

    if cache_key not in _handler_cache:
        handler_class = None

        # Look up handler by world directory
        if world_dir:
            handler_class = GAME_HANDLERS.get(world_dir)
            if handler_class:
                logger.debug(f"Found handler for world directory '{world_dir}'")

        # Fall back to generic handler
        if handler_class is None:
            handler_class = GenericGameExportHandler
            if world_dir:
                logger.debug(f"No custom handler for '{world_dir}', using generic")

        # Try to instantiate with world parameter first, fall back to no params
        try:
            handler = handler_class(world)
        except TypeError:
            # Handler doesn't accept world parameter
            handler = handler_class()

        # Call initialization methods if they exist (e.g., build_rule_string_map for OOT)
        if hasattr(handler, 'build_rule_string_map') and world is not None:
            try:
                handler.build_rule_string_map(world)  # type: ignore[attr-defined]
            except Exception as e:
                logger.warning(f"Failed to build rule string map for {world_dir}: {e}")

        _handler_cache[cache_key] = handler

    return _handler_cache[cache_key]


def clear_handler_cache():
    """Clear the handler cache. Call this between generations if needed."""
    _handler_cache.clear()
