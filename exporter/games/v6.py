"""VVVVVV game-specific export handler."""

from typing import Dict, Any, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

# VVVVVV area names in order (index + 1 = area number)
V6_AREAS = ["Laboratory", "The Tower", "Space Station 2", "Warp Zone"]


class V6GameExportHandler(GenericGameExportHandler):
    """Export handler for VVVVVV.

    This exporter is needed because the Python rules use lambdas with closures
    that capture loop variables. The post-processor replaces complex closure-based
    rules with simple inlined item_check rules.
    """

    # Store world data for post-processing
    _world_data: Dict[int, Dict[str, Any]] = {}

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extracts VVVVVV-specific settings including door_cost and area_cost_map."""
        # Get base settings from parent class
        settings_dict = super().get_world_data(world, multiworld, player)

        # Add VVVVVV-specific settings
        try:
            # Export door_cost option value
            if hasattr(world, 'options') and hasattr(world.options, 'door_cost'):
                door_cost_value = world.options.door_cost.value
                settings_dict['door_cost'] = door_cost_value
                logger.debug(f"Exported door_cost = {door_cost_value}")

                # Store for post-processing
                if not hasattr(self, '_world_data') or self._world_data is None:
                    self._world_data = {}
                if player not in self._world_data:
                    self._world_data[player] = {}
                self._world_data[player]['door_cost'] = door_cost_value

            # Export area_cost_map if it exists on the world
            if hasattr(world, 'area_cost_map'):
                # Convert to regular dict for JSON serialization
                area_cost_map = dict(world.area_cost_map)
                settings_dict['area_cost_map'] = area_cost_map
                logger.debug(f"Exported area_cost_map = {area_cost_map}")

                # Store for post-processing
                if not hasattr(self, '_world_data') or self._world_data is None:
                    self._world_data = {}
                if player not in self._world_data:
                    self._world_data[player] = {}
                self._world_data[player]['area_cost_map'] = area_cost_map
            else:
                logger.warning("area_cost_map not found on world instance")

        except Exception as e:
            logger.error(f"Error exporting VVVVVV settings: {e}")

        return settings_dict

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Post-process the exported data to fix region exit rules.

        The Python rules use lambdas with closures to check trinket ranges.
        This method replaces those complex rules with inlined item_check
        conditions based on the door_cost and area_cost_map settings.
        """
        if 'regions' not in data:
            return data

        for player_id_str, regions in data['regions'].items():
            player_id = int(player_id_str)

            # Get door_cost and area_cost_map for this player
            player_data = getattr(self, '_world_data', {}).get(player_id, {})
            door_cost = player_data.get('door_cost')
            area_cost_map = player_data.get('area_cost_map')

            if door_cost is None or area_cost_map is None:
                logger.warning(f"Missing door_cost or area_cost_map for player {player_id}, skipping region fix")
                continue

            # Fix the Menu region exits
            if 'Menu' in regions:
                menu_region = regions['Menu']
                exits = menu_region.get('exits', [])

                for exit_data in exits:
                    connected_region = exit_data.get('connected_region', '')

                    # Check if this is one of the area exits
                    if connected_region in V6_AREAS:
                        # Get the area index (1-based)
                        area_index = V6_AREAS.index(connected_region) + 1

                        # Calculate start and end for _has_trinket_range
                        # From Python: _has_trinket_range(state, player,
                        #     options.door_cost * (area_cost_map[i] - 1),
                        #     options.door_cost * area_cost_map[i])
                        area_cost = area_cost_map.get(area_index, area_cost_map.get(str(area_index), area_index))
                        start = door_cost * (area_cost - 1)
                        end = door_cost * area_cost

                        # Generate trinket names for the range
                        # _has_trinket_range checks trinkets from start to end-1 (exclusive)
                        # Trinket names are "Trinket 01", "Trinket 02", etc. (1-indexed, zero-padded)
                        trinket_names = [f"Trinket {str(i + 1).zfill(2)}" for i in range(start, end)]

                        # Replace with inline rule using 'and' of item_check conditions
                        exit_data['access_rule'] = {
                            'type': 'and',
                            'conditions': [{'type': 'item_check', 'item': name} for name in trinket_names]
                        }
                        logger.debug(f"Fixed exit rule for {connected_region}: requires {trinket_names}")

        return data
