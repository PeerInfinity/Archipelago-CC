"""VVVVVV game-specific export handler."""

from typing import Dict, Any, List
from .generic import GenericGameExportHandler


class V6GameExportHandler(GenericGameExportHandler):
    """Export handler for VVVVVV.

    Handles trinket range requirements that use lambdas with loop variable closures.
    Post-processes to inline the actual trinket requirements based on door_cost
    and AreaCostRando settings.

    The original rules use _has_trinket_range(state, player, start, end) with computed
    start/end values based on shuffled area_cost_map. Since these values are only known
    at generation time, we resolve them in post_process_data using the exported slot_data.
    """

    # Area names in order (index + 1 = area number in the game's internal mapping)
    AREA_NAMES: List[str] = ["Laboratory", "The Tower", "Space Station 2", "Warp Zone"]

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
                if connected_region not in self.AREA_NAMES:
                    continue

                # Calculate trinket range based on area cost settings
                area_index = self.AREA_NAMES.index(connected_region) + 1
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
