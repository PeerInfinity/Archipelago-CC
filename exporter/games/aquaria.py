"""Aquaria game-specific helper expander."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class AquariaGameExportHandler(BaseGameExportHandler):
    """Aquaria-specific expander for handling game-specific rules."""
    
    def expand_helper(self, helper_name: str, args: List[Any] = None) -> Dict[str, Any]:
        """Expand Aquaria-specific helper functions."""
        if args is None:
            args = []
            
        # Handle common Aquaria helper functions
        if helper_name == "has_light":
            return {'type': 'item_check', 'item': 'Sun Form'}
        elif helper_name == "has_bind":
            return {'type': 'item_check', 'item': 'Bind Song'}
        elif helper_name == "_has_bind_song":
            return {'type': 'item_check', 'item': 'Bind Song'}
        elif helper_name == "has_energy_form":
            return {'type': 'item_check', 'item': 'Energy Form'}
        elif helper_name == "has_beast_form":
            return {'type': 'item_check', 'item': 'Beast Form'}
        elif helper_name == "has_nature_form":
            return {'type': 'item_check', 'item': 'Nature Form'}
        elif helper_name == "has_sun_form":
            return {'type': 'item_check', 'item': 'Sun Form'}
        elif helper_name == "has_li":
            return {'type': 'item_check', 'item': 'Li and Li Song'}
        elif helper_name == "has_fish_form":
            return {'type': 'item_check', 'item': 'Fish Form'}
        elif helper_name == "has_spirit_form":
            return {'type': 'item_check', 'item': 'Spirit Form'}
        elif helper_name == "has_dual_form":
            return {'type': 'item_check', 'item': 'Dual Form'}
        
        # Return None for unknown helpers - will be preserved as-is
        return None
        
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand Aquaria rule functions."""
        if not rule:
            return rule
            
        # Handle special cases specific to Aquaria
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            # Try to extract more detailed information from original rule if available
            if 'original' in rule:
                return self._analyze_aquaria_rule(rule['original'])
                
        # Use parent class for standard processing
        return super().expand_rule(rule)
    
    def _analyze_aquaria_rule(self, original_rule):
        """Analyze original Aquaria rule structure."""
        if original_rule.get('type') == 'state_method':
            method = original_rule.get('method', '')
            args = original_rule.get('args', [])
            
            # Handle 'has' method for item requirements
            if method == 'has' and len(args) >= 1:
                item_name = args[0]
                count = args[1] if len(args) > 1 else 1
                
                result = {'type': 'item_check', 'item': item_name}
                if count > 1:
                    result['count'] = {'type': 'constant', 'value': count}
                return result
                
            # Handle other Aquaria-specific methods
            if method in ['can_reach', 'has_group', 'has_any']:
                return {
                    'type': 'game_specific_check',
                    'method': method,
                    'args': args,
                    'description': f"Requires {method}({', '.join(str(a) for a in args)})"
                }
        
        return {
            'type': 'generic_rule',
            'description': 'Aquaria-specific rule',
            'details': 'This rule could not be fully analyzed'
        }