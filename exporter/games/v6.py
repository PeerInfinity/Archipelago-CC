"""VVVVVV game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler

# Area names in order (index + 1 = area number)
V6_AREAS = ["Laboratory", "The Tower", "Space Station 2", "Warp Zone"]


class V6GameExportHandler(GenericGameExportHandler):
    """Export handler for VVVVVV.

    Handles trinket range requirements that use lambdas with loop variable closures.
    Post-processes to inline the actual trinket requirements based on door_cost
    and AreaCostRando settings.
    """

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Replace closure-based trinket range rules with inlined item checks."""
        if 'regions' not in data:
            return data

        for player_id_str, regions in data['regions'].items():
            world_data = data.get('world', {}).get(player_id_str, {})
            door_cost = world_data.get('options', {}).get('door_cost')
            area_cost_map = world_data.get('slot_data', {}).get('AreaCostRando')

            if door_cost is None or area_cost_map is None:
                continue

            menu_region = regions.get('Menu', {})
            for exit_data in menu_region.get('exits', []):
                connected_region = exit_data.get('connected_region', '')
                if connected_region not in V6_AREAS:
                    continue

                # Calculate trinket range based on area cost settings
                area_index = V6_AREAS.index(connected_region) + 1
                area_cost = area_cost_map.get(area_index, area_cost_map.get(str(area_index), area_index))
                start = door_cost * (area_cost - 1)
                end = door_cost * area_cost

                # Generate "Trinket 01", "Trinket 02", etc. for the required range
                trinket_names = [f"Trinket {str(i + 1).zfill(2)}" for i in range(start, end)]
                exit_data['access_rule'] = {
                    'type': 'and',
                    'conditions': [{'type': 'item_check', 'item': name} for name in trinket_names]
                }

        return data
