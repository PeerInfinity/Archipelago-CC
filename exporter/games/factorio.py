"""Factorio game-specific export handler."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class FactorioGameExportHandler(BaseGameExportHandler):
    GAME_NAME = 'Factorio'
    """Export handler for Factorio."""
    
    def __init__(self, world=None):
        """Initialize with world reference to access location data."""
        super().__init__()
        self.world = world
        
    def expand_helper(self, helper_name: str):
        """Expand Factorio-specific helper functions."""
        return None  # Will implement specific helpers as we discover them

    def get_game_info(self, world) -> Dict[str, Any]:
        """Get Factorio game information including required variables."""
        from worlds.factorio.Technologies import required_technologies

        # Convert required_technologies to a serializable format
        required_tech_dict = {}
        for ingredient, techs in required_technologies.items():
            required_tech_dict[ingredient] = [tech.name for tech in techs]

        return {
            "name": world.game,
            "rule_format": {
                "version": "1.0"
            },
            "variables": {
                "required_technologies": required_tech_dict
            }
        }

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand rule functions with Factorio-specific logic."""
        if not rule:
            return rule
            
        # Standard processing from base class
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'])
            return expanded if expanded else rule
            
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule.get('conditions', [])]
            
        return rule
    
    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return Factorio-specific item data."""
        from BaseClasses import ItemClassification
        
        item_data = {}
        
        # Get items from world.item_name_to_id
        if hasattr(world, 'item_name_to_id'):
            for item_name, item_id in world.item_name_to_id.items():
                # Try to get classification
                is_advancement = False
                is_useful = False
                is_trap = False
                
                try:
                    # Check item pool for classification
                    if hasattr(world, 'multiworld'):
                        for item in world.multiworld.itempool:
                            if item.player == world.player and item.name == item_name:
                                is_advancement = item.classification == ItemClassification.progression
                                is_useful = item.classification == ItemClassification.useful
                                is_trap = item.classification == ItemClassification.trap
                                break
                        
                        # Check placed items in locations
                        if not (is_advancement or is_useful or is_trap):
                            for location in world.multiworld.get_locations(world.player):
                                if (location.item and location.item.player == world.player and 
                                    location.item.name == item_name and location.item.code is not None):
                                    is_advancement = location.item.classification == ItemClassification.progression
                                    is_useful = location.item.classification == ItemClassification.useful
                                    is_trap = location.item.classification == ItemClassification.trap
                                    break
                except Exception as e:
                    logger.debug(f"Could not determine classification for {item_name}: {e}")
                
                # Get groups if available
                groups = []
                if hasattr(world, 'item_name_groups'):
                    groups = [
                        group_name for group_name, items in world.item_name_groups.items()
                        if item_name in items
                    ]
                
                item_data[item_name] = {
                    'name': item_name,
                    'id': item_id,
                    'groups': sorted(groups),
                    'advancement': is_advancement,
                    'useful': is_useful,
                    'trap': is_trap,
                    'event': False,
                    'type': None,
                    'max_count': 1
                }
        
        # Handle event items
        if hasattr(world, 'multiworld'):
            for location in world.multiworld.get_locations(world.player):
                if location.item and location.item.player == world.player:
                    item_name = location.item.name
                    # Check if this is an event item (no code/ID) that we haven't seen
                    if (location.item.code is None and 
                        item_name not in item_data and
                        hasattr(location.item, 'classification')):
                        
                        item_data[item_name] = {
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
        
        return item_data