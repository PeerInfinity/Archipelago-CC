"""TUNIC game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class TUNICGameExportHandler(GenericGameExportHandler):
    """Export handler for TUNIC.

    Exports ability_unlocks for runtime resolution and redirects Shop N regions to Shop.
    """
    GAME_NAME = 'TUNIC'
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract TUNIC settings including ability_unlocks."""
        settings = super().get_settings_data(world, multiworld, player)

        # Export ability_unlocks for runtime subscript resolution
        if hasattr(world, 'ability_unlocks'):
            settings['ability_unlocks'] = world.ability_unlocks
            logger.info(f"Exported ability_unlocks: {world.ability_unlocks}")

        return settings

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process TUNIC export data.

        Redirects exits pointing to 'Shop N' intermediate regions to point
        directly to 'Shop'. In TUNIC, all shops are the same shop, but there are
        intermediate 'Shop N' regions that connect one-way to 'Shop'. Since these
        intermediate regions only have an unconditional exit to 'Shop', we can
        simplify by having exits go directly to 'Shop'.
        """
        import re

        # Pattern to match "Shop N" where N is a number
        shop_n_pattern = re.compile(r'^Shop \d+$')

        # Process each player's regions
        for player_id, player_regions in data.get('regions', {}).items():
            for region_name, region_data in player_regions.items():
                for exit_data in region_data.get('exits', []):
                    connected_region = exit_data.get('connected_region', '')
                    if shop_n_pattern.match(connected_region):
                        logger.debug(f"Redirecting exit from '{region_name}' -> '{connected_region}' to 'Shop'")
                        exit_data['connected_region'] = 'Shop'
                        # Also update the name to reflect the change
                        if 'name' in exit_data:
                            exit_data['name'] = exit_data['name'].replace(connected_region, 'Shop')

        return data
