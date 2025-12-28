"""DLCQuest-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class DLCQuestGameExportHandler(GenericGameExportHandler):
    """Handle DLCQuest-specific rule expansions and coin item export."""

    # DLCQuest uses coin-based access rules that check state.prog_items accumulators.
    # The standard location checking flow doesn't properly update inventory during
    # spoiler tests, so we use add_sphere_items_upfront mode which adds items
    # at the start of each sphere before accessibility checks.
    ADD_SPHERE_ITEMS_UPFRONT = True

    # Use resolved_items which includes accumulated coin counts
    USE_RESOLVED_ITEMS = True

    def get_game_info(self, world):
        """Export DLCQuest game info including accumulator rules."""
        game_info = super().get_game_info(world)

        # Define accumulator rules for coin items
        # Pattern matches items like "4 coins", "46 coins", etc.
        # and accumulates their values into " coins" or " coins freemium"
        game_info['accumulator_rules'] = [
            {
                'pattern': r'^(\d+) coins?$',   # Regex to match coin items
                'extract_value': True,           # Extract numeric value from group 1
                'target': ' coins',              # Target accumulator name
                'discriminator': None            # No dynamic target selection
            }
        ]

        # Initialize accumulator targets
        # For TEST worlds (with precollected coins in starting_items), set prog_items_init to total
        # For ORIGINAL worlds, set prog_items_init to 0 - coins accumulate as items are collected

        # Check if this is a test world with precollected coins (indicated by world.prog_items_init)
        if hasattr(world, 'prog_items_init') and world.prog_items_init:
            game_info['prog_items_init'] = dict(world.prog_items_init)
            # Ensure freemium is also present
            if ' coins freemium' not in game_info['prog_items_init']:
                game_info['prog_items_init'][' coins freemium'] = 0
            logger.info(f"Using world's prog_items_init: {game_info['prog_items_init']}")
        else:
            # Original world - coins start at 0 and accumulate via accumulator_rules
            game_info['prog_items_init'] = {
                ' coins': 0,
                ' coins freemium': 0
            }
            logger.info("Original world: prog_items_init set to 0 (coins accumulate during play)")

        return game_info

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process exported data to add coin items with event=False."""

        def make_coin_item(name: str, max_count: int = 1) -> Dict[str, Any]:
            """Create a coin item definition. Coin items are NOT events."""
            return {
                'name': name, 'id': None, 'groups': ['coins'],
                'advancement': True, 'useful': False, 'trap': False,
                'event': False, 'type': 'coins', 'max_count': max_count
            }

        coin_items: Dict[str, Dict[str, Dict[str, Any]]] = {}

        # Add accumulator items (" coins", " coins freemium") for each player
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
                    # Add coin bundles (skip accumulators already added above)
                    if ('coins' in item_name and
                        item_name not in coin_items.get(player_id, {}) and
                        item_name not in [' coins', ' coins freemium']):
                        coin_items.setdefault(player_id, {})[item_name] = make_coin_item(item_name)

        # Merge coin items into data['items'], overriding base exporter's event=True
        if coin_items:
            data.setdefault('items', {})
            for player_id, player_coin_items in coin_items.items():
                data['items'].setdefault(player_id, {}).update(player_coin_items)

        return data