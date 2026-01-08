"""
JSON World Builder - Create world instances from JSON export data.

This module provides functionality to instantiate Archipelago worlds from
JSON rules files by using the corresponding _worldgen world that was
generated from the same JSON.

Usage:
    from world_generator.json_world_builder import JSONWorldBuilder

    builder = JSONWorldBuilder('path/to/rules.json')
    builder.load()
    world = builder.build_world()

    # Or use the convenience function
    from world_generator.json_world_builder import create_world_from_json
    world, multiworld, state = create_world_from_json('path/to/rules.json')
"""

from __future__ import annotations

import json
import logging
from argparse import Namespace
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from BaseClasses import CollectionState, MultiWorld
    from worlds.AutoWorld import World

from .extractors import ExtractedData, extract_all

logger = logging.getLogger(__name__)


class JSONWorldBuilder:
    """
    Builds world instances from JSON export data.

    Uses the corresponding _worldgen world which was generated from the same
    JSON rules file, ensuring exact structural match and native Rule Builder
    explain support.

    Attributes:
        json_path: Path to the JSON rules file
        data: Extracted data from the JSON file
        world: The instantiated world instance
        multiworld: The MultiWorld containing the world
        schema_version: Schema version from the JSON file
    """

    def __init__(self, json_path: str | Path):
        """
        Initialize the builder with a path to a JSON rules file.

        Args:
            json_path: Path to the JSON rules file
        """
        self.json_path = Path(json_path)
        self.data: Optional[ExtractedData] = None
        self.world: Optional["World"] = None
        self.multiworld: Optional["MultiWorld"] = None
        self.schema_version: Optional[int] = None
        self._json_data: Optional[dict[str, Any]] = None

    def load(self) -> ExtractedData:
        """
        Load and parse the JSON export file.

        Returns:
            ExtractedData containing all extracted information

        Raises:
            FileNotFoundError: If the JSON file doesn't exist
            json.JSONDecodeError: If the file isn't valid JSON
        """
        logger.debug(f"Loading JSON from {self.json_path}")

        with open(self.json_path) as f:
            self._json_data = json.load(f)

        self.schema_version = self._json_data.get('schema_version')
        self.data = extract_all(self._json_data)

        logger.info(
            f"Loaded JSON for game '{self.data.metadata.game_name}' "
            f"(schema version {self.schema_version})"
        )
        return self.data

    def build_world(self, worldgen_game_name: Optional[str] = None) -> "World":
        """
        Create a fully-functional world instance from the corresponding _worldgen world.

        The worldgen world was generated from the same JSON rules file,
        so its structure matches exactly and it has native Rule Builder
        support with full explain functionality.

        This method runs the full generation steps (create_regions, create_items,
        set_rules, etc.) to produce a world suitable for tracking, not just
        introspection.

        Args:
            worldgen_game_name: Name of the worldgen world to use. If None,
                derives from JSON metadata (e.g., "TUNIC" -> "TUNIC WorldGen")

        Returns:
            Instantiated World with regions, locations, items, and rules set up

        Raises:
            ValueError: If the worldgen world isn't registered
            RuntimeError: If load() hasn't been called
        """
        # Import here to avoid circular imports at module load time
        from BaseClasses import CollectionState, MultiWorld
        from worlds import AutoWorld, AutoWorldRegister

        if self.data is None:
            self.load()

        # Derive worldgen name if not provided
        if worldgen_game_name is None:
            base_name = self.data.metadata.game_name
            worldgen_game_name = f"{base_name} WorldGen"

        logger.debug(f"Building world for '{worldgen_game_name}'")

        # Check if the world type is registered
        if worldgen_game_name not in AutoWorldRegister.world_types:
            available = sorted(AutoWorldRegister.world_types.keys())
            raise ValueError(
                f"World '{worldgen_game_name}' is not registered. "
                f"Available worlds: {available[:10]}..."
            )

        # Create MultiWorld with single player
        self.multiworld = MultiWorld(1)
        self.multiworld.game[1] = worldgen_game_name
        self.multiworld.player_name = {1: "Player"}
        self.multiworld.set_seed(seed=1)  # Deterministic
        self.multiworld.generation_is_fake = True  # Mark as tracker-generated

        # Set up options with defaults
        world_type = AutoWorldRegister.world_types[worldgen_game_name]
        args = Namespace()
        for name, option in world_type.options_dataclass.type_hints.items():
            setattr(args, name, {1: option.from_any(option.default)})

        # This instantiates the world
        self.multiworld.set_options(args)

        # Set up collection state BEFORE generation (some worlds access it during generation)
        self.multiworld.state = CollectionState(self.multiworld)

        # Run generation steps to create regions, items, and rules
        gen_steps = [
            "generate_early",
            "create_regions",
            "create_items",
            "set_rules",
            "generate_basic",
        ]
        for step in gen_steps:
            if hasattr(AutoWorld.World, step):
                AutoWorld.call_all(self.multiworld, step)

        self.world = self.multiworld.worlds[1]

        logger.info(f"Built world instance for '{worldgen_game_name}'")
        return self.world

    def get_world(self) -> Optional["World"]:
        """Get the instantiated world, or None if not yet built."""
        return self.world

    def get_multiworld(self) -> Optional["MultiWorld"]:
        """Get the MultiWorld container, or None if not yet built."""
        return self.multiworld

    def get_state(self) -> Optional["CollectionState"]:
        """Get the collection state for the world, or None if not yet built."""
        if self.multiworld:
            return self.multiworld.state
        return None

    def get_data(self) -> Optional[ExtractedData]:
        """Get the extracted data, or None if not yet loaded."""
        return self.data

    def supports_explain(self) -> bool:
        """
        Check if this export supports explain functionality.

        Returns:
            True if schema version is 3 or higher
        """
        return self.schema_version is not None and self.schema_version >= 3


def create_world_from_json(
    json_path: str | Path,
    worldgen_game_name: Optional[str] = None,
) -> tuple["World", "MultiWorld", "CollectionState"]:
    """
    Convenience function to create a world instance from JSON.

    Args:
        json_path: Path to the JSON rules file
        worldgen_game_name: Optional override for worldgen world name.
            If None, derives from JSON metadata (e.g., "TUNIC" -> "TUNIC WorldGen")

    Returns:
        Tuple of (world, multiworld, state)

    Raises:
        FileNotFoundError: If the JSON file doesn't exist
        ValueError: If the worldgen world isn't registered

    Example:
        >>> world, mw, state = create_world_from_json('rules.json')
        >>> location = world.get_location('Some Location')
        >>> explanation = location.access_rule.explain_json(state)
    """
    builder = JSONWorldBuilder(json_path)
    builder.load()
    world = builder.build_world(worldgen_game_name)
    return world, builder.multiworld, builder.multiworld.state
