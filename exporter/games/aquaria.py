"""Aquaria game-specific export handler."""

from BaseClasses import Region
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class AquariaGameExportHandler(GenericGameExportHandler):
    """Aquaria-specific expander for handling game-specific rules.

    Uses GenericGameExportHandler for automatic item discovery and event
    item scanning. Only overrides region handling for Aquaria-specific needs.
    """


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
                # Skip if region is not a Region object (e.g., in worldgen worlds where
                # regions are stored as strings rather than Region objects)
                if not isinstance(region, Region):
                    continue
                if region and region not in multiworld.regions:
                    # Special case: sunken_city_l_crates has duplicate name with sunken_city_l
                    # Rename it to avoid collision
                    if attr_name == 'sunken_city_l_crates' and region.name == "Sunken City left area":
                        region.name = "Sunken City left area crates"

                    # Mark as dynamically added so base class auto-discovers it
                    region.dynamically_added = True
                    multiworld.regions.append(region)
                    regions_added.append(region.name)

        if regions_added:
            logger.info(f"Added {len(regions_added)} missing Aquaria regions to multiworld: {', '.join(regions_added)}")