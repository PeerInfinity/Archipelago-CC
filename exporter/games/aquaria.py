"""Aquaria game-specific export handler."""

from typing import Dict, Any
from .base import BaseGameExportHandler
from BaseClasses import ItemClassification
import logging

logger = logging.getLogger(__name__)


class AquariaGameExportHandler(BaseGameExportHandler):
    """Aquaria-specific expander for handling game-specific rules."""

    GAME_NAME = 'Aquaria'

    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    def postprocess_regions(self, multiworld, player):
        """
        Fix missing regions that aren't added to multiworld.regions in Aquaria.
        
        Some regions in Aquaria are created but not added to multiworld.regions,
        causing them to be missing from the export. This function finds and adds them.
        """
        if not hasattr(multiworld, 'worlds') or player not in multiworld.worlds:
            return
            
        world = multiworld.worlds[player]
        if not hasattr(world, 'regions'):
            return
            
        # List of region attributes that should be added if they exist
        missing_region_attrs = [
            'first_secret',
            'energy_temple_idol',
            'energy_temple_after_boss',
            'energy_temple_4',
            'frozen_feil',  # Note: typo in Python source (feil instead of veil)
            'sunken_city_l_crates',  # Note: renamed to avoid duplicate with sunken_city_l
            'sunken_city_r_crates',
            # These 4 regions were previously added via Python code changes, but we're reverting those
            'home_water_behind_rocks',
            'openwater_tr_urns',
            'mithalas_city_urns',
            'mithalas_castle_urns'
        ]
        
        regions_added = []
        for attr_name in missing_region_attrs:
            if hasattr(world.regions, attr_name):
                region = getattr(world.regions, attr_name)
                if region and region not in multiworld.regions:
                    # Special case: sunken_city_l_crates has duplicate name with sunken_city_l
                    # Rename it to avoid collision
                    if attr_name == 'sunken_city_l_crates' and region.name == "Sunken City left area":
                        region.name = "Sunken City left area crates"

                    multiworld.regions.append(region)
                    regions_added.append(region.name)

        # Store the names of dynamically added regions for later marking
        self.dynamically_added_regions = set(regions_added)

        if regions_added:
            logger.info(f"Added {len(regions_added)} missing Aquaria regions to multiworld: {', '.join(regions_added)}")
    
    def get_region_attributes(self, region) -> Dict[str, Any]:
        """Add game-specific region attributes."""
        attributes = {}

        # Mark regions that were dynamically added after sphere calculation
        if hasattr(self, 'dynamically_added_regions') and region.name in self.dynamically_added_regions:
            attributes['dynamically_added'] = True

        return attributes

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """
        Return Aquaria-specific item table data including dynamically created event items.

        Aquaria creates event items at runtime for boss defeats and secrets that are not
        in the static item_table. These need to be discovered by scanning placed items.
        """
        aquaria_items_data = {}

        # Handle dynamically created event items that are placed at locations
        # In Aquaria, event items like "Drunian God beated", "Victory", etc. are created
        # at runtime via create_event() but not in any static item_table
        if hasattr(world, 'multiworld'):
            multiworld = world.multiworld
            player = world.player

            for location in multiworld.get_locations(player):
                if location.item and location.item.player == player:
                    item_name = location.item.name
                    # Check if this is an event item (no code/ID)
                    if (location.item.code is None and
                        item_name not in aquaria_items_data and
                        hasattr(location.item, 'classification')):

                        aquaria_items_data[item_name] = {
                            'name': item_name,
                            'id': None,
                            'groups': ['Event'],
                            'advancement': location.item.classification == ItemClassification.progression,
                            'useful': location.item.classification == ItemClassification.useful,
                            'trap': location.item.classification == ItemClassification.trap,
                            'event': True,
                            'type': 'Event',
                            'max_count': 1
                        }

        return aquaria_items_data