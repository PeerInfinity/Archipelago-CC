"""
Main world generator - orchestrates the conversion process.

This module provides the WorldGenerator class which handles the complete
process of converting a JSON rules file into an Archipelago world package.
"""

import json
import os
import logging
from pathlib import Path
from typing import List, Optional, Dict

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
        canonical_seed: Optional[int] = None,
        player_id: str = '1',
    ):
        """
        Initialize the generator.

        Args:
            json_path: Path to the JSON rules file
            output_dir: Output directory for generated files. If None, derived from JSON.
            game_name: Override the game name (useful to avoid conflicts with existing worlds)
            force: If True, overwrite existing files
            canonical_seed: If set, generated world will place items in original locations when seed matches this value
            player_id: Player ID to extract from multiworld rules file (default: '1')
        """
        self.json_path = Path(json_path)
        self.game_name_override = game_name
        self.force = force
        self.canonical_seed = canonical_seed
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

        # Sort canonical_placements by sphere order to ensure items with
        # classification_counts have their progression copies placed first
        self._sort_canonical_placements_by_sphere()

        logger.info(f"Extracted: {len(self.data.items)} items, "
                   f"{len(self.data.locations)} locations, "
                   f"{len(self.data.regions)} regions")

        return self.data

    def _load_sphere_log(self) -> Optional[Dict[str, float]]:
        """
        Load sphere log and return location -> sphere_index mapping.

        Returns:
            Dict mapping location name to sphere index (float for sub-spheres like "1.4"),
            or None if sphere log not found.
        """
        # Look for sphere_log.jsonl in the same directory as rules.json
        sphere_log_path = self.json_path.parent / (self.json_path.stem.replace('_rules', '_sphere_log') + '.jsonl')

        if not sphere_log_path.exists():
            logger.debug(f"No sphere log found at {sphere_log_path}")
            return None

        logger.info(f"Loading sphere log from {sphere_log_path}")
        location_spheres: Dict[str, float] = {}

        try:
            with open(sphere_log_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue

                    entry = json.loads(line)

                    if entry.get('type') == 'state_update':
                        sphere_idx_str = entry.get('sphere_index', '0')
                        # Convert sphere index like "1.4" to float
                        try:
                            sphere_idx = float(sphere_idx_str)
                        except ValueError:
                            sphere_idx = 0.0

                        # Get locations that became accessible in this sphere
                        player_data = entry.get('player_data', {}).get(self.player_id, {})
                        new_locs = player_data.get('new_accessible_locations', [])

                        for loc_name in new_locs:
                            if loc_name not in location_spheres:
                                location_spheres[loc_name] = sphere_idx

            logger.info(f"Loaded sphere order for {len(location_spheres)} locations")
            return location_spheres

        except Exception as e:
            logger.warning(f"Failed to parse sphere log: {e}")
            return None

    def _sort_canonical_placements_by_sphere(self) -> None:
        """
        Sort canonical_placements and original_placements so that items with
        multiple copies have their locations ordered by sphere accessibility.

        This ensures that for items with classification_counts (e.g., progression: 1, useful: 1),
        the progression copy is placed at the earlier-accessible location.
        """
        if self.data is None:
            return

        # Determine which placements dict to sort
        # (templates.py uses canonical_placements if available, otherwise original_placements)
        placements_to_sort = self.data.canonical_placements if self.data.canonical_placements else self.data.original_placements
        if not placements_to_sort:
            return

        # Load sphere order from sphere_log
        sphere_order = self._load_sphere_log()
        if not sphere_order:
            # Fallback: try to infer order from starting items
            # Locations for starting items should come first
            starting_item_names = set(self.data.starting_items.keys())
            sorted_placements = {}

            # First, add locations whose rules require starting items
            for loc_name, item_name in placements_to_sort.items():
                # Check if location name starts with a starting item name
                # (e.g., "Breaking Dawn-0" starts with "Breaking Dawn")
                for starting_item in starting_item_names:
                    if loc_name.startswith(starting_item):
                        sorted_placements[loc_name] = item_name
                        break

            # Then add all other locations
            for loc_name, item_name in placements_to_sort.items():
                if loc_name not in sorted_placements:
                    sorted_placements[loc_name] = item_name

            # Update the appropriate dict
            if self.data.canonical_placements:
                self.data.canonical_placements = sorted_placements
            else:
                self.data.original_placements = sorted_placements
            return

        # Sort placements by sphere index
        def get_sphere_index(loc_name: str) -> float:
            return sphere_order.get(loc_name, float('inf'))

        sorted_items = sorted(
            placements_to_sort.items(),
            key=lambda x: get_sphere_index(x[0])
        )

        sorted_placements = dict(sorted_items)

        # Update the appropriate dict
        if self.data.canonical_placements:
            self.data.canonical_placements = sorted_placements
        else:
            self.data.original_placements = sorted_placements

        logger.info("Sorted placements by sphere order")

    def _apply_game_name_override(self, new_name: str) -> None:
        """Apply a game name override to the extracted metadata."""
        if self.data is None:
            raise RuntimeError("Cannot apply game name override before loading data")

        old_name = self.data.metadata.game_name

        # Update game name
        self.data.metadata.game_name = new_name

        # Only update world class name if there's no original from the exporter
        # This preserves the original class name (e.g., "ALTTPWorld") even when
        # the game is renamed (e.g., to "A Link to the Past WorldGen")
        if not self.data.metadata.original_world_class_name:
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
            '__init__.py': generate_init_py(self.data, canonical_seed=self.canonical_seed),
        }

        # Generate archipelago.json manifest for apworld packaging compatibility
        manifest = {
            "game": self.data.metadata.game_name,
            "authors": ["World Generator"],
            "minimum_ap_version": self.data.metadata.archipelago_version or "0.6.0",
            "world_version": "1.0.0",
            "version": 7,
            "compatible_version": 7
        }
        manifest_path = output_dir / 'archipelago.json'
        if not dry_run:
            manifest_path.write_text(json.dumps(manifest, indent=4))
            logger.info(f"Wrote manifest to {manifest_path}")
        else:
            logger.info(f"Would write: {manifest_path}")

        # Export options for canonical seed generation
        # This allows worldgen worlds to reproduce the exact original seed when seed=1
        with open(self.json_path, 'r') as f:
            source_json = json.load(f)

        # Extract options from world section
        source_world = source_json.get('world', {}).get(self.player_id, {})
        options_data = source_world.get('options', {})

        if options_data:
            options_path = output_dir / '_worldgen_options.json'
            if not dry_run:
                options_path.write_text(json.dumps(options_data, indent=2))
                logger.info(f"Wrote worldgen options to {options_path}")

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
