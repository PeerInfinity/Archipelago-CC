"""A Hat in Time game-specific exporter handler."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class AHitGameExportHandler(BaseGameExportHandler):
    """A Hat in Time specific rule expander with game-specific helper functions."""
    
    def expand_helper(self, helper_name: str):
        """Expand A Hat in Time specific helper functions."""
        
        # A Hat in Time helper function mappings
        helper_mappings = {
            # Movement and traversal abilities
            'can_walk': {
                'type': 'item_check',
                'item': 'Walk',
                'description': 'Requires basic walking ability'
            },
            'can_jump': {
                'type': 'item_check', 
                'item': 'Jump',
                'description': 'Requires jumping ability'
            },
            'can_dive': {
                'type': 'item_check',
                'item': 'Dive',
                'description': 'Requires diving ability'
            },
            'can_double_jump': {
                'type': 'item_check',
                'item': 'Double Jump',
                'description': 'Requires double jump ability'
            },
            'can_wall_jump': {
                'type': 'item_check',
                'item': 'Wall Jump',
                'description': 'Requires wall jump ability'
            },
            'can_umbrella': {
                'type': 'item_check',
                'item': 'Umbrella',
                'description': 'Requires umbrella ability'
            },
            'can_hookshot': {
                'type': 'item_check',
                'item': 'Hookshot',
                'description': 'Requires hookshot ability'
            },
            'can_sprint': {
                'type': 'item_check',
                'item': 'Sprint Hat',
                'description': 'Requires Sprint Hat'
            },
            'can_brewing': {
                'type': 'item_check',
                'item': 'Brewing Hat',
                'description': 'Requires Brewing Hat'
            },
            'can_ice': {
                'type': 'item_check',
                'item': 'Ice Hat',
                'description': 'Requires Ice Hat'
            },
            'can_dweller': {
                'type': 'item_check',
                'item': 'Dweller Mask',
                'description': 'Requires Dweller Mask'
            },
            'can_time_stop': {
                'type': 'item_check',
                'item': 'Time Stop Hat',
                'description': 'Requires Time Stop Hat'
            },
            
            # Badge requirements
            'has_badge': {
                'type': 'generic_helper',
                'name': 'has_badge',
                'description': 'Requires specific badge'
            },
            'has_hookshot_badge': {
                'type': 'item_check',
                'item': 'Hookshot Badge',
                'description': 'Requires Hookshot Badge'
            },
            'has_camera_badge': {
                'type': 'item_check',
                'item': 'Camera Badge',
                'description': 'Requires Camera Badge'
            },
            'has_mumble_badge': {
                'type': 'item_check',
                'item': 'Mumble Badge',
                'description': 'Requires Mumble Badge'
            },
            
            # World access checks
            'can_access_mafia_town': {
                'type': 'region_access',
                'region': 'Mafia Town',
                'description': 'Requires access to Mafia Town'
            },
            'can_access_battle_of_the_birds': {
                'type': 'region_access',
                'region': 'Battle of the Birds',
                'description': 'Requires access to Battle of the Birds'
            },
            'can_access_subcon_forest': {
                'type': 'region_access',
                'region': 'Subcon Forest',
                'description': 'Requires access to Subcon Forest'
            },
            'can_access_alpine_skyline': {
                'type': 'region_access',
                'region': 'Alpine Skyline',
                'description': 'Requires access to Alpine Skyline'
            },
            'can_access_time_rifts': {
                'type': 'region_access',
                'region': 'Time Rifts',
                'description': 'Requires access to Time Rifts'
            },
            
            # Act and chapter completion
            'completed_act': {
                'type': 'generic_helper',
                'name': 'completed_act',
                'description': 'Requires completing specific act'
            },
            'completed_chapter': {
                'type': 'generic_helper',
                'name': 'completed_chapter',
                'description': 'Requires completing specific chapter'
            },
            'has_contract': {
                'type': 'generic_helper',
                'name': 'has_contract',
                'description': 'Requires specific contract'
            },
            
            # Yarn and time piece requirements
            'has_yarn': {
                'type': 'item_check',
                'item': 'Yarn',
                'description': 'Requires yarn for hat crafting'
            },
            'has_time_pieces': {
                'type': 'generic_helper',
                'name': 'has_time_pieces',
                'description': 'Requires specific number of time pieces'
            },
            
            # Death Wish specific
            'death_wish_enabled': {
                'type': 'generic_helper',
                'name': 'death_wish_enabled',
                'description': 'Requires Death Wish DLC enabled'
            },
            'can_access_death_wish': {
                'type': 'region_access',
                'region': 'Death Wish',
                'description': 'Requires access to Death Wish'
            },
            
            # Painting and act completion logic
            'has_paintings': {
                'type': 'generic_helper',
                'name': 'has_paintings',
                'description': 'Checks if player has enough painting unlocks'
            },
            'can_clear_required_act': {
                'type': 'generic_helper', 
                'name': 'can_clear_required_act',
                'description': 'Checks if a specific act can be completed'
            },
            'painting_logic': {
                'type': 'generic_helper',
                'name': 'painting_logic', 
                'description': 'Checks if painting shuffle is enabled'
            },
            'get_difficulty': {
                'type': 'generic_helper',
                'name': 'get_difficulty',
                'description': 'Gets the current difficulty setting'
            },
            
            # Special movement checks
            'can_ground_pound': {
                'type': 'item_check',
                'item': 'Ground Pound',
                'description': 'Requires ground pound ability'
            },
            'can_crawl': {
                'type': 'item_check',
                'item': 'Crawl',
                'description': 'Requires crawling ability'
            },
            'can_climb': {
                'type': 'item_check',
                'item': 'Climb',
                'description': 'Requires climbing ability'
            }
        }
        
        # Return expanded helper if found, otherwise None to preserve as-is
        return helper_mappings.get(helper_name)
    
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand A Hat in Time specific rules with enhanced processing."""
        if not rule:
            return rule
            
        # Handle helper functions
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'])
            if expanded:
                return expanded
            # If no specific mapping, preserve the helper node
            return rule
            
        # Handle logical operators recursively
        if rule['type'] in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]
            
        return rule