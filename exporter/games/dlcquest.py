"""DLCQuest-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class DLCQuestGameExportHandler(GenericGameExportHandler):
    """Handle DLCQuest-specific rule expansions and coin item export."""

    # DLCQuest uses coin-based access rules that check state.prog_items accumulators.
    # These flags enable proper coin accumulation during spoiler tests.
    ADD_SPHERE_ITEMS_UPFRONT = True
    USE_RESOLVED_ITEMS = True

    # Accumulator rules - pattern matches "4 coins", "46 coins", etc.
    ACCUMULATOR_RULES = [{
        'pattern': r'^(\d+) coins?$',
        'extract_value': True,
        'target': ' coins',
        'discriminator': None
    }]

    # Initialize coin accumulators (start at 0, accumulate as items collected)
    PROG_ITEMS_INIT = {' coins': 0, ' coins freemium': 0}

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Add coin items with event=False (coins are real items, not events)."""

        def make_coin_item(name: str, max_count: int = 1) -> Dict[str, Any]:
            return {
                'name': name, 'id': None, 'groups': ['coins'],
                'advancement': True, 'useful': False, 'trap': False,
                'event': False, 'type': 'coins', 'max_count': max_count
            }

        coin_items: Dict[str, Dict[str, Dict[str, Any]]] = {}

        # Add accumulator items for each player
        for player_id in data.get('regions', {}).keys():
            coin_items[player_id] = {
                ' coins': make_coin_item(' coins', max_count=999999),
                ' coins freemium': make_coin_item(' coins freemium', max_count=999999)
            }

        # Extract coin bundle items (e.g. "4 coins") from locations
        for player_id, regions in data.get('regions', {}).items():
            for region_data in regions.values():
                for location in region_data.get('locations', []):
                    item_name = location.get('item', {}).get('name', '')
                    if 'coins' in item_name and item_name not in coin_items.get(player_id, {}):
                        coin_items.setdefault(player_id, {})[item_name] = make_coin_item(item_name)

        # Merge coin items, overriding base exporter's event=True for items with no code
        if coin_items:
            data.setdefault('items', {})
            for player_id, player_coin_items in coin_items.items():
                data['items'].setdefault(player_id, {}).update(player_coin_items)

        return data