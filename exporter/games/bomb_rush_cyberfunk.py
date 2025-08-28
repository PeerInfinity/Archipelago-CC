"""Bomb Rush Cyberfunk helper expander."""

from typing import Dict, Any, List
from .base import BaseGameExportHandler
import re
import logging

logger = logging.getLogger(__name__)

class BombRushCyberfunkGameExportHandler(BaseGameExportHandler):
    """Bomb Rush Cyberfunk expander that handles game-specific rules."""
    
    def expand_helper(self, helper_name: str, args: List[Any] = None):
        """Expand Bomb Rush Cyberfunk specific helper functions."""
        if args is None:
            args = []
            
        # TODO: Add game-specific helper expansions as they are identified
        # This will be populated based on test failures
        
        return None  # Preserve helper nodes as-is for now
        
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand rule functions with Bomb Rush Cyberfunk-specific analysis."""
        if not rule:
            return rule
            
        # Special handling for __analyzed_func__ - try to extract meaningful information
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            # Try to extract more detailed information from original rule if available
            if 'original' in rule:
                return self._analyze_original_rule(rule['original'])
                
            # Attempt to infer rule type from any available information
            return self._infer_rule_type(rule)
            
        # Standard processing from base class
        return super().expand_rule(rule)
    
    def _analyze_original_rule(self, original_rule):
        """Analyze the original rule structure before it became __analyzed_func__."""
        # Look for state method calls in the original rule
        if original_rule.get('type') == 'state_method':
            method = original_rule.get('method', '')
            args = original_rule.get('args', [])
            
            # Handle 'has' method for item requirements
            if method == 'has' and len(args) >= 1:
                base_rule = {
                    'type': 'item_check',
                    'item': args[0]
                }
                # Handle count requirements
                if len(args) >= 3:
                    base_rule['count'] = {'type': 'constant', 'value': args[2]}
                return base_rule
                
            # Handle other known state methods
            if method in ['can_reach', 'has_group', 'has_any']:
                return {
                    'type': 'game_specific_check',
                    'method': method,
                    'args': args,
                    'description': f"Requires {method}({', '.join(str(a) for a in args)})"
                }
        
        return {
            'type': 'generic_rule',
            'description': 'Bomb Rush Cyberfunk-specific rule',
            'details': 'This rule could not be fully analyzed due to game-specific implementation'
        }
    
    def _infer_rule_type(self, rule):
        """Attempt to infer rule type based on context clues."""
        args = rule.get('args', [])
        rule_str = str(rule)
        
        # Item check patterns
        if 'has(' in rule_str.lower() or 'state.has' in rule_str.lower():
            item_match = re.search(r"has\(['\"](.*?)['\"]\s*,", rule_str)
            if item_match:
                return {
                    'type': 'item_check',
                    'item': item_match.group(1),
                    'inferred': True
                }
        
        # Location access patterns
        if 'can_reach' in rule_str.lower():
            return {
                'type': 'can_reach',
                'inferred': True,
                'description': 'Requires reaching a specific location'
            }
        
        return {
            'type': 'generic_rule',
            'description': 'Bomb Rush Cyberfunk-specific rule',
            'details': 'This rule could not be fully analyzed but may involve item requirements'
        }
    
    def get_item_data(self, world) -> Dict[str, Dict[str, Any]]:
        """Return Bomb Rush Cyberfunk item definitions with classification flags."""
        from worlds.bomb_rush_cyberfunk.Items import item_table, BRCType
        from BaseClasses import ItemClassification
        
        item_data = {}
        
        for item_dict in item_table:
            name = item_dict["name"]
            item_type = item_dict["type"]
            
            # Get classification from the world instance
            classification = world.get_item_classification(item_type)
            
            # Convert classification to string
            classification_str = "filler"
            if classification == ItemClassification.progression:
                classification_str = "progression"
            elif classification == ItemClassification.progression_skip_balancing:
                classification_str = "progression_skip_balancing"
            elif classification == ItemClassification.useful:
                classification_str = "useful"
            
            # Map BRCType to readable category
            category_mapping = {
                BRCType.Music: "music",
                BRCType.GraffitiM: "graffiti_m",
                BRCType.GraffitiL: "graffiti_l", 
                BRCType.GraffitiXL: "graffiti_xl",
                BRCType.Skateboard: "skateboard",
                BRCType.InlineSkates: "inline_skates", 
                BRCType.BMX: "bmx",
                BRCType.Character: "character",
                BRCType.Outfit: "outfit",
                BRCType.REP: "rep",
                BRCType.Camera: "camera"
            }
            
            item_data[name] = {
                "classification": classification_str,
                "category": category_mapping.get(item_type, "unknown"),
                "type_value": item_type.value
            }
        
        return item_data
    
    def get_game_info(self, world) -> Dict[str, Any]:
        """Get information about Bomb Rush Cyberfunk's rule formats and structure."""
        return {
            "name": "Bomb Rush Cyberfunk",
            "rule_format": {
                "version": "1.0"
            }
        }