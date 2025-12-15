"""DLCQuest-specific export handler."""

from typing import Dict, Any
from .base import BaseGameExportHandler
from BaseClasses import ItemClassification
import logging

logger = logging.getLogger(__name__)

class DLCQuestGameExportHandler(BaseGameExportHandler):
    """Handle DLCQuest-specific rule expansions and coin item export."""

    def __init__(self, world=None):
        super().__init__(world=world)
        self.coin_items = {}  # Track coin items we find

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export DLCQuest settings with add_sphere_items_upfront enabled.

        DLCQuest uses coin-based access rules that check state.prog_items accumulators.
        The standard location checking flow doesn't properly update inventory during
        spoiler tests, so we use add_sphere_items_upfront mode which adds items
        at the start of each sphere before accessibility checks.
        """
        settings = super().get_settings_data(world, multiworld, player)
        settings['add_sphere_items_upfront'] = True
        settings['use_resolved_items'] = True  # Use resolved_items which includes accumulated coin counts
        return settings

    def get_game_info(self, world):
        """Export DLCQuest game info including accumulator rules."""
        import re
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

    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """
        Return DLCQuest-specific item table data including dynamically created event items.

        DLCQuest creates event items at runtime that are not in any static item_table.
        These need to be discovered by scanning placed items.
        """
        dlcquest_items_data = {}

        # Handle dynamically created event items that are placed at locations
        if hasattr(world, 'multiworld'):
            multiworld = world.multiworld
            player = world.player

            for location in multiworld.get_locations(player):
                if location.item and location.item.player == player:
                    item_name = location.item.name
                    # Check if this is an event item (no code/ID)
                    if (location.item.code is None and
                        item_name not in dlcquest_items_data and
                        hasattr(location.item, 'classification')):

                        # Coin items are NOT events - they need manual collection
                        # Only mark non-coin items as events
                        is_coin_item = 'coins' in item_name.lower()

                        if is_coin_item:
                            # Coin items - NOT events, need manual collection
                            dlcquest_items_data[item_name] = {
                                'name': item_name,
                                'id': None,
                                'groups': ['coins'],
                                'advancement': location.item.classification == ItemClassification.progression,
                                'useful': location.item.classification == ItemClassification.useful,
                                'trap': location.item.classification == ItemClassification.trap,
                                'event': False,
                                'type': 'coins',
                                'max_count': 1
                            }
                        else:
                            # Non-coin event items - mark as events for auto-collection
                            dlcquest_items_data[item_name] = {
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

        return dlcquest_items_data

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process exported data to add coin items."""
        # Always add the special " coins" accumulator items for DLCQuest
        # These are used to track total coins collected
        for player_id in data.get('regions', {}).keys():
            if player_id not in self.coin_items:
                self.coin_items[player_id] = {}
            
            # Add the special accumulator items
            self.coin_items[player_id][' coins'] = {
                'name': ' coins',
                'id': None,  # These don't have IDs
                'groups': ['coins'],
                'advancement': True,  # Important for prog_items
                'useful': False,
                'trap': False,
                'event': False,
                'type': 'coins',
                'max_count': 999999  # Can accumulate
            }
            
            # Also add " coins freemium" if Live Freemium or Die campaign is included
            # (We'll add it always for simplicity)
            self.coin_items[player_id][' coins freemium'] = {
                'name': ' coins freemium',
                'id': None,  # These don't have IDs
                'groups': ['coins'],
                'advancement': True,  # Important for prog_items
                'useful': False,
                'trap': False,
                'event': False,
                'type': 'coins',
                'max_count': 999999  # Can accumulate
            }
        
        # Extract coin items from locations
        for player_id, regions in data.get('regions', {}).items():
            for region_name, region_data in regions.items():
                for location in region_data.get('locations', []):
                    item = location.get('item', {})
                    item_name = item.get('name', '')
                    
                    # Check if this is a coin bundle item like "4 coins"
                    if ('coins' in item_name and 
                        item_name not in self.coin_items.get(player_id, {}) and
                        item_name not in [' coins', ' coins freemium']):  # Skip accumulators
                        # Track this coin item
                        if player_id not in self.coin_items:
                            self.coin_items[player_id] = {}
                        
                        # Individual coin bundle items like "4 coins"
                        # NOTE: Do NOT mark as events - these should be manually collected
                        # Setting event=False prevents auto-collection
                        self.coin_items[player_id][item_name] = {
                            'name': item_name,
                            'id': None,
                            'groups': ['coins'],
                            'advancement': True,  # Important for prog_items
                            'useful': False,
                            'trap': False,
                            'event': False,  # NOT an event - must be manually collected
                            'type': 'coins',
                            'max_count': 1
                        }
        
        # Add coin items to the items dictionary
        if self.coin_items:
            if 'items' not in data:
                data['items'] = {}
            
            for player_id, coin_items in self.coin_items.items():
                if player_id not in data['items']:
                    data['items'][player_id] = {}
                
                # Add/override each coin item
                # Note: We override here to ensure event=False for coin items
                # (base exporter may have set event=True for items with code=None)
                for item_name, item_data in coin_items.items():
                    data['items'][player_id][item_name] = item_data
                    logger.info(f"Set coin item '{item_name}' in items dictionary for player {player_id} (event=False)")

        return data