"""Bumper Stickers game-specific exporter handler."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class BumpStikGameExportHandler(BaseGameExportHandler):
    """Bumper Stickers specific rule expander with game-specific helper functions."""
    
    def expand_helper(self, helper_name: str, args: List[Any] = None):
        """Expand Bumper Stickers specific helper functions."""
        if args is None:
            args = []
        
        # Bumper Stickers helper function mappings
        helper_mappings = {
            # Generic helpers that might be needed for Bumper Stickers
            'can_access_level': {
                'type': 'generic_helper',
                'name': 'can_access_level',
                'description': 'Requires access to specific level'
            },
            'has_enough_bumpers': {
                'type': 'generic_helper',
                'name': 'has_enough_bumpers',
                'description': 'Requires specific number of bumpers'
            },
            'can_score_points': {
                'type': 'generic_helper',
                'name': 'can_score_points',
                'description': 'Requires ability to score points'
            },
        }
        
        # Return expanded helper if found, otherwise None to preserve as-is
        return helper_mappings.get(helper_name)
    
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand Bumper Stickers specific rules."""
        if not rule:
            return rule
            
        # Handle helper functions
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'], rule.get('args', []))
            if expanded:
                return expanded
            # If no specific mapping, preserve the helper node
            return rule
            
        # Handle logical operators recursively
        if rule['type'] in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]
            
        return rule
    
    def get_game_info(self, world) -> Dict[str, Any]:
        """Get Bumper Stickers specific game information."""
        try:
            game_info = {
                "name": "Bumper Stickers",
                "rule_format": {
                    "version": "1.0"
                }
            }
            return game_info
        except Exception as e:
            logger.error(f"Error getting Bumper Stickers game info: {e}")
            return {
                "name": "Bumper Stickers", 
                "rule_format": {"version": "1.0"}
            }