"""
Main world generator - orchestrates the conversion process.

This module provides the WorldGenerator class which handles the complete
process of converting a JSON rules file into an Archipelago world package.
"""

import json
import logging
from pathlib import Path
from typing import List, Optional, Dict

from .extractors import extract_all, apply_name_substitutions, ExtractedData, sanitize_identifier
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
        apply_name_substitutions: bool = False,
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
            apply_name_substitutions: If True, apply name_substitutions from the rules file (default: False)
        """
        self.json_path = Path(json_path)
        self.game_name_override = game_name
        self.force = force
        self.canonical_seed = canonical_seed
        self.player_id = player_id
        self.apply_name_substitutions = apply_name_substitutions
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
        with open(self.json_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
            game_dir = json_data.get('game_directory', 'unknown_game')
            return Path('worlds') / str(game_dir)

    def load(self) -> ExtractedData:
        """Load and parse the JSON rules file."""
        logger.info(f"Loading JSON from {self.json_path}")

        with open(self.json_path, 'r', encoding='utf-8') as f:
            json_data = json.load(f)

        # Apply name substitutions if present (e.g. Metamath generic → meaningful names)
        if self.apply_name_substitutions:
            apply_name_substitutions(json_data, player_id=self.player_id)

        self.data = extract_all(json_data, player_id=self.player_id)

        # Apply game name override if specified
        if self.game_name_override:
            self._apply_game_name_override(self.game_name_override)

        # Sort placements by classification to ensure items with
        # classification_counts have their progression copies placed first
        self._sort_placements_by_classification()

        logger.info(f"Extracted: {len(self.data.items)} items, "
                   f"{len(self.data.locations)} locations, "
                   f"{len(self.data.regions)} regions")

        return self.data

    def _sort_placements_by_classification(self) -> None:
        """
        Sort canonical_placements and original_placements so that items with
        multiple copies have their progression copies listed first.

        This ensures that for items with classification_counts (e.g., progression: 1, useful: 1),
        the progression copy is created first when iterating through placements.

        Uses canonical_placement_advancements extracted from regions data (item.advancement field).
        """
        if self.data is None:
            return

        # Determine which placements dict to sort
        # (templates.py uses canonical_placements if available, otherwise original_placements)
        placements_to_sort = self.data.canonical_placements if self.data.canonical_placements else self.data.original_placements
        if not placements_to_sort:
            return

        classifications = self.data.canonical_placement_advancements
        if not classifications:
            logger.debug("No placement classifications available, skipping sort")
            return

        # Group placements by item name
        from collections import defaultdict
        item_locations: Dict[str, List[str]] = defaultdict(list)
        for loc_name, item_name in placements_to_sort.items():
            item_locations[item_name].append(loc_name)

        # Sort each item's locations so advancement=True comes first
        # This ensures progression copies are created before useful copies
        sorted_placements: Dict[str, str] = {}
        for item_name, locations in item_locations.items():
            # Sort by (not is_advancement) so True (0) comes before False (1)
            sorted_locs = sorted(
                locations,
                key=lambda loc: (0 if classifications.get(loc, False) else 1, loc)
            )
            for loc in sorted_locs:
                sorted_placements[loc] = item_name

        # Update the appropriate dict
        if self.data.canonical_placements:
            self.data.canonical_placements = sorted_placements
        else:
            self.data.original_placements = sorted_placements

        logger.info("Sorted placements by classification (progression first)")

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

        # Vendored rule_builder compatibility package (_ext/): static template
        # modules copied verbatim, plus a generated _game.py carrying the game
        # name the ext rule classes register under (vanilla AP's per-game
        # CustomRuleRegister mechanism). Generated code imports all
        # rule-builder names from ._ext, which falls back from the fork's
        # rule_builder to vanilla rule_builder.rules + these vendored modules.
        ext_template_dir = Path(__file__).parent / 'ext_template'
        for ext_file in ('__init__.py', 'extra_rules.py', 'world_mixin.py'):
            files[f'_ext/{ext_file}'] = (ext_template_dir / ext_file).read_text(encoding='utf-8')
        files['_ext/_game.py'] = (
            '"""Generated by world_generator.\n\n'
            'The game name the vendored _ext rule classes register under.\n'
            '"""\n'
            f'GAME_NAME = {json.dumps(self.data.metadata.game_name)}\n'
        )

        # Generate archipelago.json manifest for apworld packaging compatibility
        # Generated worlds run on vanilla AP 0.6.7+ (the first release shipping
        # rule_builder, which the vendored _ext package builds on). Don't pin
        # the manifest to the exporting fork's version — AP refuses to load
        # apworlds whose minimum exceeds the core version.
        # NOTE: no 'compatible_version' here — per the apworld spec (and
        # test_world_manifest), that's a container-level key that packing
        # tools inject when writing an .apworld zip.
        manifest = {
            "game": self.data.metadata.game_name,
            "authors": ["World Generator"],
            "minimum_ap_version": "0.6.7",
            "world_version": "1.0.0",
        }
        manifest_path = output_dir / 'archipelago.json'
        if not dry_run:
            manifest_path.write_text(json.dumps(manifest, indent=4), encoding='utf-8')
            logger.info(f"Wrote manifest to {manifest_path}")
        else:
            logger.info(f"Would write: {manifest_path}")

        # Export options for canonical seed generation
        # This allows worldgen worlds to reproduce the exact original seed when seed=1
        with open(self.json_path, 'r', encoding='utf-8') as f:
            source_json = json.load(f)

        # Extract options from world section
        source_world = source_json.get('world', {}).get(self.player_id, {})
        options_data = source_world.get('options', {})

        if options_data:
            options_path = output_dir / '_worldgen_options.json'
            if not dry_run:
                options_path.write_text(json.dumps(options_data, indent=2), encoding='utf-8')
                logger.info(f"Wrote worldgen options to {options_path}")

        # Preserve preset_sidecars (per-region playable payloads emitted
        # by the procgen pipeline) into a package-local JSON file. The
        # generated __init__.py reads it back at export time and
        # injects it into export_data so multiworld rules.json carries
        # the sidecar through to every player's frontend. See
        # docs/json/developer/procgen/architecture.md §"The Python
        # round-trip".
        sidecars_all = source_json.get('preset_sidecars', {})
        player_sidecars = sidecars_all.get(self.player_id, {})
        if player_sidecars:
            sidecars_path = output_dir / '_worldgen_sidecars.json'
            if not dry_run:
                sidecars_path.write_text(
                    json.dumps(player_sidecars, indent=2),
                    encoding='utf-8',
                )
                logger.info(f"Wrote worldgen sidecars to {sidecars_path}")
            else:
                logger.info(f"Would write: {sidecars_path}")

        # Preserve procgen_metadata (driver, sphere_plan, ...) the same
        # way. The export handler re-injects it into rules.json, so a
        # world re-derived from an exported preset keeps procgen
        # semantics — in particular honor_locked_placements, which keys
        # on this field (see extractors.extract_all).
        procgen_metadata = source_json.get('procgen_metadata')
        if procgen_metadata:
            metadata_path = output_dir / '_worldgen_procgen_metadata.json'
            if not dry_run:
                metadata_path.write_text(
                    json.dumps(procgen_metadata, indent=2),
                    encoding='utf-8',
                )
                logger.info(f"Wrote procgen metadata to {metadata_path}")
            else:
                logger.info(f"Would write: {metadata_path}")

        # Preserve loop_costs (per-region/per-location mana costs + the
        # xpEffect mode the loops module reads). Top-level field of a
        # loop-mode procgen rules.json. The export handler re-injects it,
        # so a world re-derived from an exported preset keeps loop mode —
        # the runtime loops module auto-enters loop mode whenever
        # loop_costs is present. Without this, the export drops it and a
        # round-tripped world silently loses loop mode.
        loop_costs = source_json.get('loop_costs')
        if loop_costs:
            loop_costs_path = output_dir / '_worldgen_loop_costs.json'
            if not dry_run:
                loop_costs_path.write_text(
                    json.dumps(loop_costs, indent=2),
                    encoding='utf-8',
                )
                logger.info(f"Wrote loop costs to {loop_costs_path}")
            else:
                logger.info(f"Would write: {loop_costs_path}")

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

        # Create docs directory (flat structure matching Archipelago conventions)
        docs_dir = output_dir / 'docs'
        docs_dir.mkdir(parents=True, exist_ok=True)

        # self.data is guaranteed non-None when this method is called from generate()
        assert self.data is not None

        # Create a doc file for each tutorial referenced in the metadata
        tutorial_files_created = set()
        for tutorial in self.data.metadata.web_tutorials:
            if tutorial.file_name and tutorial.file_name not in tutorial_files_created:
                tutorial_md = docs_dir / tutorial.file_name
                if not tutorial_md.exists() or self.force:
                    tutorial_content = f"# {tutorial.name}\n\n{tutorial.description}\n"
                    tutorial_md.write_text(tutorial_content, encoding='utf-8')
                tutorial_files_created.add(tutorial.file_name)

        # Create setup_en.md if no tutorials created it
        if 'setup_en.md' not in tutorial_files_created:
            setup_md = docs_dir / 'setup_en.md'
            if not setup_md.exists() or self.force:
                setup_content = f"# {self.data.metadata.game_name} Setup Guide\n\nGenerated world package.\n"
                setup_md.write_text(setup_content, encoding='utf-8')

        # Create game info file (en_GameName.md) for WebHost integration
        game_info_md = docs_dir / f'en_{self.data.metadata.game_name}.md'
        if not game_info_md.exists() or self.force:
            game_info_content = f"# {self.data.metadata.game_name}\n\nGenerated world package.\n"
            game_info_md.write_text(game_info_content, encoding='utf-8')

    def _write_file(self, file_path: Path, content: str) -> None:
        """Write content to a file."""
        if file_path.exists() and not self.force:
            logger.warning(f"Skipping existing file: {file_path}")
            return

        logger.info(f"Writing: {file_path}")
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content, encoding='utf-8')

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
