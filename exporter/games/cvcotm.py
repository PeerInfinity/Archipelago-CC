"""Castlevania - Circle of the Moon specific exporter."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class CvCotMGameExportHandler(BaseGameExportHandler):
    """Expander for Castlevania - Circle of the Moon specific functions."""
    
    def __init__(self):
        super().__init__()
        self.game_name = "Castlevania - Circle of the Moon"
        
    def expand_helper(self, helper_name: str):
        """Expand CvCotM-specific helper functions."""
        # For now, preserve helper nodes as-is
        return None
        
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand rule functions."""
        if not rule:
            return rule
            
        # Standard processing from base class
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'])
            return expanded if expanded else rule
            
        if rule.get('type') in ['and', 'or']:
            if 'conditions' in rule:
                rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]
            
        return rule
    
    def postprocess_regions(self, multiworld, player: int):
        """Add Menu region if it doesn't exist."""
        try:
            # Get all regions for this player
            player_regions = [r for r in multiworld.get_regions() if r.player == player]
            
            # Check if Menu region exists
            menu_region = None
            for region in player_regions:
                if region.name == 'Menu':
                    menu_region = region
                    break
            
            # If Menu doesn't exist, we need to create it
            if not menu_region:
                logger.info(f"Creating Menu region for CvCotM player {player}")
                # Import the Region class from BaseClasses
                from BaseClasses import Region, Entrance
                
                # Create Menu region
                menu = Region('Menu', player, multiworld)
                multiworld.regions.append(menu)
                
                # Find the starting region (Catacomb)
                catacomb = None
                for region in player_regions:
                    if region.name == 'Catacomb':
                        catacomb = region
                        break
                
                if catacomb:
                    # Create an entrance from Menu to Catacomb
                    menu_to_catacomb = Entrance(player, 'Start Game', menu)
                    menu_to_catacomb.connect(catacomb)
                    menu.exits.append(menu_to_catacomb)
                    catacomb.entrances.append(menu_to_catacomb)
                    logger.info(f"Connected Menu to Catacomb for player {player}")
                else:
                    logger.warning(f"Could not find Catacomb region for player {player}")
                    
        except Exception as e:
            logger.error(f"Error in postprocess_regions for CvCotM: {e}")
    
    def post_process_regions(self, regions_data: Dict[str, Any]) -> Dict[str, Any]:
        """Fix region data structure for CvCotM."""
        # Check if regions are incorrectly nested under player ID
        if '1' in regions_data and isinstance(regions_data['1'], dict):
            # The regions are under player ID '1', extract them
            player_regions = regions_data['1']
            
            # Create properly formatted regions dict
            formatted_regions = {}
            
            # Add Menu region if it doesn't exist
            if 'Menu' not in player_regions:
                formatted_regions['Menu'] = {
                    'name': 'Menu',
                    'type': 'Region',
                    'player': 1,
                    'entrances': [],
                    'exits': [
                        {
                            'name': 'Start Game',
                            'connected_region': 'Catacomb',
                            'access_rule': {
                                'type': 'constant',
                                'value': True
                            },
                            'reverse': None,
                            'randomization_type': 1,
                            'direction': None,
                            'type': 'Exit'
                        }
                    ],
                    'locations': [],
                    'time_passes': True,
                    'provides_chest_count': True,
                    'region_rules': []
                }
                
                # Add entrance to Catacomb from Menu
                if 'Catacomb' in player_regions:
                    catacomb = player_regions['Catacomb']
                    if isinstance(catacomb, dict):
                        if 'entrances' not in catacomb or not catacomb['entrances']:
                            catacomb['entrances'] = []
                        # Check if entrance from Menu already exists
                        has_menu_entrance = any(e.get('parent_region') == 'Menu' for e in catacomb['entrances'] if isinstance(e, dict))
                        if not has_menu_entrance:
                            catacomb['entrances'].append({
                                'name': 'Start Game',
                                'parent_region': 'Menu',
                                'connected_region': 'Catacomb',
                                'reverse': None,
                                'assumed': False,
                                'randomization_type': 1,
                                'direction': None,
                                'type': 'Entrance'
                            })
            
            for region_name, region_data in player_regions.items():
                if isinstance(region_data, dict):
                    # Ensure region has required fields
                    if 'name' not in region_data:
                        region_data['name'] = region_name
                    if 'type' not in region_data:
                        region_data['type'] = 'Region'
                    if 'player' not in region_data:
                        region_data['player'] = 1
                    if 'entrances' not in region_data:
                        region_data['entrances'] = []
                    if 'exits' not in region_data:
                        region_data['exits'] = []
                    if 'locations' not in region_data:
                        region_data['locations'] = []
                    if 'time_passes' not in region_data:
                        region_data['time_passes'] = True
                    if 'provides_chest_count' not in region_data:
                        region_data['provides_chest_count'] = True
                    if 'region_rules' not in region_data:
                        region_data['region_rules'] = []
                    
                    formatted_regions[region_name] = region_data
            
            # Return regions nested under player '1' (expected format)
            return {'1': formatted_regions}
        
        # If data is already in correct format, return as-is
        return regions_data
    
    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process the exported data to fix any issues."""
        # Fix region data if needed
        if 'regions' in data:
            data['regions'] = self.post_process_regions(data['regions'])
        
        return data