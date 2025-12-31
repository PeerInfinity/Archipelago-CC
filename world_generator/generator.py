"""
Main world generator - orchestrates the conversion process.

This module provides the WorldGenerator class which handles the complete
process of converting a JSON rules file into an Archipelago world package.
"""

import json
import os
import logging
from pathlib import Path
from typing import List, Optional

from .extractors import extract_all, ExtractedData, sanitize_identifier
from .templates import (
    generate_items_py,
    generate_locations_py,
    generate_regions_py,
    generate_rules_py,
    generate_options_py,
    generate_init_py,
)

logger = logging.getLogger(__name__)


class WorldGenerator:
    """
    Generates an Archipelago world package from a JSON rules file.

    Usage:
        generator = WorldGenerator('path/to/rules.json', 'worlds/mygame/')
        generator.generate()
    """

    def __init__(
        self,
        json_path: str,
        output_dir: Optional[str] = None,
        game_name: Optional[str] = None,
        force: bool = False,
        canonical_seed1: bool = False,
        player_id: str = '1',
    ):
        """
        Initialize the generator.

        Args:
            json_path: Path to the JSON rules file
            output_dir: Output directory for generated files. If None, derived from JSON.
            game_name: Override the game name (useful to avoid conflicts with existing worlds)
            force: If True, overwrite existing files
            canonical_seed1: If True, generated world will place items in original locations when seed=1
            player_id: Player ID to extract from multiworld rules file (default: '1')
        """
        self.json_path = Path(json_path)
        self.game_name_override = game_name
        self.force = force
        self.canonical_seed1 = canonical_seed1
        self.player_id = player_id
        self.data: Optional[ExtractedData] = None
        self._output_dir: Optional[Path] = Path(output_dir) if output_dir else None

    @property
    def output_dir(self) -> Path:
        """Get the output directory, deriving from JSON if not specified."""
        if self._output_dir:
            return self._output_dir

        if self.data:
            return Path('worlds') / self.data.metadata.game_directory

        # Fallback - extract from JSON without full parsing
        with open(self.json_path, 'r') as f:
            json_data = json.load(f)
            game_dir = json_data.get('game_directory', 'unknown_game')
            return Path('worlds') / str(game_dir)

    def load(self) -> ExtractedData:
        """Load and parse the JSON rules file."""
        logger.info(f"Loading JSON from {self.json_path}")

        with open(self.json_path, 'r') as f:
            json_data = json.load(f)

        self.data = extract_all(json_data, player_id=self.player_id)

        # Apply game name override if specified
        if self.game_name_override:
            self._apply_game_name_override(self.game_name_override)

        logger.info(f"Extracted: {len(self.data.items)} items, "
                   f"{len(self.data.locations)} locations, "
                   f"{len(self.data.regions)} regions")

        return self.data

    def _apply_game_name_override(self, new_name: str) -> None:
        """Apply a game name override to the extracted metadata."""
        if self.data is None:
            raise RuntimeError("Cannot apply game name override before loading data")

        old_name = self.data.metadata.game_name

        # Update game name
        self.data.metadata.game_name = new_name

        # Update world class name: "My Game WorldGen" -> "MyGameWorldGenWorld"
        class_base = sanitize_identifier(new_name)
        self.data.metadata.world_class_name = class_base + 'World'

        # Update game directory: "My Game WorldGen" -> "my_game_worldgen"
        # First remove non-alphanumeric chars except spaces and dashes, then convert to snake_case
        import re
        clean_name = re.sub(r"[^a-zA-Z0-9 -]", '', new_name)
        self.data.metadata.game_directory = clean_name.lower().replace(' ', '_').replace('-', '_')

        logger.info(f"Renamed game from '{old_name}' to '{new_name}'")

    def generate(self, dry_run: bool = False) -> None:
        """
        Generate all world files.

        Args:
            dry_run: If True, only show what would be generated without writing
        """
        if self.data is None:
            self.load()

        # After load(), self.data is guaranteed to be set
        assert self.data is not None

        output_dir = self.output_dir

        logger.info(f"Generating world in {output_dir}")

        if not dry_run:
            self._create_directory_structure(output_dir)

        # Generate each file
        files = {
            'Items.py': generate_items_py(self.data),
            'Locations.py': generate_locations_py(self.data),
            'Regions.py': generate_regions_py(self.data),
            'Rules.py': generate_rules_py(self.data),
            'Options.py': generate_options_py(self.data),
            '__init__.py': generate_init_py(self.data, canonical_seed1=self.canonical_seed1),
        }

        # Export settings and world_attributes for game-specific export handlers
        # This allows worldgen exports to reproduce the same settings as the source
        with open(self.json_path, 'r') as f:
            source_json = json.load(f)

        # Build the worldgen settings file with separate sections
        worldgen_data = {}

        # Extract settings (options and internal flags only)
        source_settings = source_json.get('world', {}).get(self.player_id, {})
        if source_settings:
            # Keep only actual settings, not world attributes
            # Remove option_definitions - it's redundant since the exporter extracts
            # option definitions from the worldgen world's Options.py at export time
            settings_keys = {
                'game', 'options', 'world_directory',
                'assume_bidirectional_exits', 'use_resolved_items',
                'use_auto_indirect_conditions', 'add_sphere_items_upfront',
            }
            filtered_settings = {k: v for k, v in source_settings.items() if k in settings_keys}
            if filtered_settings:
                worldgen_data['settings'] = filtered_settings

        # Extract world_attributes (new format) or from legacy settings
        source_world_attrs = source_json.get('world_attributes', {}).get(self.player_id, {})
        if source_world_attrs:
            worldgen_data['world_attributes'] = source_world_attrs
        elif source_settings:
            # Legacy format: extract world attributes from settings
            skip_keys = {
                'game', 'options', 'option_definitions', 'world_directory',
                'assume_bidirectional_exits', 'use_resolved_items',
                'use_auto_indirect_conditions', 'add_sphere_items_upfront',
            }
            legacy_world_attrs = {k: v for k, v in source_settings.items() if k not in skip_keys}
            if legacy_world_attrs:
                worldgen_data['world_attributes'] = legacy_world_attrs

        if worldgen_data:
            settings_path = output_dir / '_worldgen_settings.json'
            if not dry_run:
                settings_path.write_text(json.dumps(worldgen_data, indent=2))
                logger.info(f"Wrote settings to {settings_path}")

        for filename, content in files.items():
            file_path = output_dir / filename

            if dry_run:
                logger.info(f"Would write: {file_path}")
                print(f"\n{'='*60}")
                print(f"FILE: {filename}")
                print('='*60)
                print(content[:500] + ('...' if len(content) > 500 else ''))
            else:
                self._write_file(file_path, content)

        if not dry_run:
            logger.info(f"Successfully generated world in {output_dir}")
            print(f"\nGenerated world files in: {output_dir}")
            print("\nNext steps:")
            print("1. Review generated files and make any necessary adjustments")
            # self.data is guaranteed non-None here due to the assert above
            assert self.data is not None
            print("2. Test with: python -c \"from worlds.{} import *\"".format(
                self.data.metadata.game_directory))
            print("3. Generate template: python -c \"from Options import generate_yaml_templates; "
                  "generate_yaml_templates('Players/Templates')\"")
            print("4. Generate test seed: python Generate.py --seed 1")

    def _create_directory_structure(self, output_dir: Path) -> None:
        """Create the output directory structure."""
        if output_dir.exists() and not self.force:
            # Check if any files exist
            existing_files = list(output_dir.glob('*.py'))
            if existing_files:
                raise FileExistsError(
                    f"Output directory {output_dir} already contains Python files. "
                    f"Use --force to overwrite."
                )

        output_dir.mkdir(parents=True, exist_ok=True)

        # Create docs directory
        docs_dir = output_dir / 'docs' / 'en'
        docs_dir.mkdir(parents=True, exist_ok=True)

        # Create a basic setup.md
        setup_md = docs_dir / 'setup.md'
        if not setup_md.exists() or self.force:
            # self.data is guaranteed non-None when this method is called from generate()
            assert self.data is not None
            setup_content = f"""# {self.data.metadata.game_name} Setup Guide

## Required Software

- Archipelago client

## Installation

1. Download the game's .apworld file
2. Place it in your Archipelago/lib/worlds folder
3. Generate a multiworld with {self.data.metadata.game_name}

## Joining a Game

1. Open the Archipelago client
2. Connect to the server
3. Start playing!
"""
            setup_md.write_text(setup_content)

    def _write_file(self, file_path: Path, content: str) -> None:
        """Write content to a file."""
        if file_path.exists() and not self.force:
            logger.warning(f"Skipping existing file: {file_path}")
            return

        logger.info(f"Writing: {file_path}")
        file_path.write_text(content)

    def validate(self) -> List[str]:
        """
        Validate the extracted data for common issues.

        Returns:
            List of warning/error messages
        """
        if self.data is None:
            self.load()

        # After load(), self.data is guaranteed to be set
        assert self.data is not None

        issues: List[str] = []

        # Check for items
        if not self.data.items:
            issues.append("ERROR: No items found in JSON")

        # Check for locations
        if not self.data.locations:
            issues.append("ERROR: No locations found in JSON")

        # Check for regions
        if not self.data.regions:
            issues.append("ERROR: No regions found in JSON")

        # Check item/location balance
        regular_items = sum(1 for i in self.data.items.values() if not i.is_event)
        regular_locations = sum(1 for loc in self.data.locations.values() if not loc.is_event)

        if regular_items != regular_locations:
            issues.append(
                f"WARNING: Item/location mismatch: {regular_items} items vs "
                f"{regular_locations} locations"
            )

        # Check for missing regions in exits
        all_regions = set(self.data.regions.keys())
        for exit_name, exit_data in self.data.exits.items():
            if exit_data.target_region not in all_regions:
                issues.append(
                    f"ERROR: Exit '{exit_name}' targets unknown region "
                    f"'{exit_data.target_region}'"
                )

        # Check for victory condition
        has_victory = any(
            'victory' in loc.lower() or 'victory' in (self.data.original_placements.get(loc, '')).lower()
            for loc in self.data.locations
        )
        if not has_victory:
            issues.append("WARNING: No victory location/item detected")

        return issues
