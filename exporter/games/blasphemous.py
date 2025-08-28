"""Blasphemous game-specific exporter."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import re
import logging

logger = logging.getLogger(__name__)

class BlasphemousGameExportHandler(BaseGameExportHandler):
    """Blasphemous-specific rule expander."""
    
    def expand_helper(self, helper_name: str):
        """Expand Blasphemous-specific helper functions."""
        
        # Common Blasphemous helpers based on game mechanics
        blasphemous_helpers = {
            # Movement/traversal helpers
            'can_climb': {
                'type': 'item_check',
                'item': 'Wall Climb Ability'
            },
            'can_dive_laser': {
                'type': 'item_check', 
                'item': 'Dive Laser Ability'
            },
            'can_air_dash': {
                'type': 'item_check',
                'item': 'Air Dash Ability'
            },
            'can_wall_climb': {
                'type': 'item_check',
                'item': 'Wall Climb Ability'
            },
            'can_break_holes': {
                'type': 'item_check',
                'item': 'Break Holes Ability'
            },
            'can_survive_poison': {
                'type': 'item_check',
                'item': 'Poison Immunity'
            },
            'can_walk_on_root': {
                'type': 'item_check',
                'item': 'Root Walking Ability'
            },
            
            # Prayer/relic helpers
            'has_prayer': {
                'type': 'generic_helper',
                'description': 'Requires having prayer ability'
            },
            'has_relic': {
                'type': 'generic_helper', 
                'description': 'Requires having relic'
            },
            
            # Boss/area access helpers
            'can_reach_brotherhood': {
                'type': 'can_reach',
                'region': 'Brotherhood of the Silent Sorrow'
            },
            'can_reach_wasteland': {
                'type': 'can_reach',
                'region': 'Where Olive Trees Wither'
            },
            'can_reach_grievance': {
                'type': 'can_reach',
                'region': 'Grievance Ascends'
            },
            'can_reach_convent': {
                'type': 'can_reach',
                'region': 'Convent of Our Lady of the Charred Visage'
            },
            'can_reach_sleeping_canvases': {
                'type': 'can_reach',
                'region': 'Sleeping Canvases'
            },
            'can_reach_mother_of_mothers': {
                'type': 'can_reach', 
                'region': 'Mother of Mothers'
            },
        }
        
        # Return specific helper if found
        if helper_name in blasphemous_helpers:
            return blasphemous_helpers[helper_name]
            
        # Try pattern matching for dynamic helpers
        return self._expand_dynamic_helper(helper_name)
        
    def _expand_dynamic_helper(self, helper_name: str):
        """Expand helpers based on common Blasphemous patterns."""
        
        # Boss defeat patterns
        if helper_name.startswith('defeated_'):
            boss_name = helper_name.replace('defeated_', '').replace('_', ' ').title()
            return {
                'type': 'boss_check',
                'boss': boss_name,
                'description': f'Requires defeating {boss_name}'
            }
            
        # Area access patterns  
        if helper_name.startswith('can_reach_'):
            area_name = helper_name.replace('can_reach_', '').replace('_', ' ').title()
            return {
                'type': 'can_reach',
                'region': area_name,
                'description': f'Requires access to {area_name}'
            }
            
        # Item requirement patterns
        if helper_name.startswith('has_'):
            item_name = helper_name.replace('has_', '').replace('_', ' ').title()
            return {
                'type': 'item_check',
                'item': item_name,
                'description': f'Requires having {item_name}'
            }
            
        # Ability patterns
        if helper_name.startswith('can_'):
            ability = helper_name.replace('can_', '').replace('_', ' ')
            return {
                'type': 'capability',
                'capability': ability,
                'description': f'Requires ability to {ability}'
            }
            
        # Default to preserving unknown helpers
        return None
        
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand rule functions with Blasphemous-specific logic."""
        if not rule:
            return rule
            
        # Handle analyzed functions that might contain game-specific logic
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            return self._analyze_blasphemous_rule(rule)
            
        # Standard helper expansion
        if rule['type'] == 'helper':
            expanded = self.expand_helper(rule['name'])
            return expanded if expanded else rule
            
        # Recurse into compound rules
        if rule['type'] in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]
            
        return rule
        
    def _analyze_blasphemous_rule(self, rule):
        """Analyze Blasphemous-specific __analyzed_func__ rules."""
        
        # Try to extract information from original rule
        if 'original' in rule:
            original = rule['original']
            
            # Look for state method calls
            if original.get('type') == 'state_method':
                method = original.get('method', '')
                args = original.get('args', [])
                
                # Handle common state methods
                if method == 'has' and len(args) >= 1:
                    result = {
                        'type': 'item_check',
                        'item': args[0]
                    }
                    # Add count if present
                    if len(args) >= 3 and isinstance(args[2], int):
                        result['count'] = {'type': 'constant', 'value': args[2]}
                    return result
                    
                elif method == 'can_reach' and len(args) >= 1:
                    return {
                        'type': 'can_reach',
                        'region': args[0]
                    }
                    
        # Fallback to generic handling
        return {
            'type': 'generic_rule',
            'description': 'Blasphemous-specific rule that needs manual implementation'
        }