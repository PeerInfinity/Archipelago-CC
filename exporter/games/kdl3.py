"""Kirby's Dream Land 3 game-specific export handler."""

from typing import Dict, Any, List, Optional
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class KDL3GameExportHandler(BaseGameExportHandler):
    GAME_NAME = "Kirby's Dream Land 3"
    """Handle KDL3-specific rule expansions and f-string conversions."""
    
    def expand_helper(self, helper_name: str):
        """Return None to preserve helper nodes as-is."""
        return None
        
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand and convert KDL3 rules, including f-strings."""
        if not rule:
            return rule
            
        # Handle f_string conversion
        if rule.get('type') == 'f_string':
            return self._convert_f_string(rule)
            
        # Handle item_check with f_string item names
        if rule.get('type') == 'item_check' and isinstance(rule.get('item'), dict):
            if rule['item'].get('type') == 'f_string':
                rule['item'] = self._convert_f_string(rule['item'])
            
        # Recursively process nested rules
        if rule.get('type') in ['and', 'or']:
            if 'conditions' in rule:
                rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]
                
        # Process other nested structures
        for key in ['access_rule', 'rule', 'condition']:
            if key in rule and isinstance(rule[key], dict):
                rule[key] = self.expand_rule(rule[key])
                
        return rule
    
    def _convert_f_string(self, f_string_rule: Dict[str, Any]) -> Any:
        """Convert an f_string AST node to a simple concatenated string."""
        if f_string_rule.get('type') != 'f_string':
            return f_string_rule
            
        parts = f_string_rule.get('parts', [])
        result_parts = []
        
        for part in parts:
            if part.get('type') == 'constant':
                # Regular string literal part
                result_parts.append(part.get('value', ''))
            elif part.get('type') == 'formatted_value':
                # Expression inside f-string
                value_node = part.get('value', {})
                if value_node.get('type') == 'constant':
                    result_parts.append(str(value_node.get('value', '')))
                elif value_node.get('type') == 'name':
                    # This is a variable reference - for now just use the name
                    # In a more complete implementation, we'd resolve the variable
                    logger.warning(f"Variable reference in f-string: {value_node.get('name')}")
                    result_parts.append(f"{{{value_node.get('name')}}}")
                elif value_node.get('type') == 'binary_op':
                    # Handle binary operations like "3 - 1"
                    result = self._evaluate_binary_op(value_node)
                    result_parts.append(str(result))
                else:
                    # Other expression types - convert to string representation
                    logger.warning(f"Complex expression in f-string: {value_node}")
                    result_parts.append(str(value_node))
                    
        # Join all parts into a single string
        return ''.join(result_parts)
    
    def _evaluate_binary_op(self, node: Dict[str, Any]) -> Any:
        """Evaluate a binary operation node."""
        if node.get('type') != 'binary_op':
            return node
            
        left = node.get('left', {})
        right = node.get('right', {})
        op = node.get('op', '')
        
        # Get values
        left_val = left.get('value') if left.get('type') == 'constant' else left
        right_val = right.get('value') if right.get('type') == 'constant' else right
        
        # Perform operation
        if op == '-':
            return left_val - right_val
        elif op == '+':
            return left_val + right_val
        elif op == '*':
            return left_val * right_val
        elif op == '/':
            return left_val / right_val
        elif op == '//':
            return left_val // right_val
        elif op == '%':
            return left_val % right_val
        else:
            logger.warning(f"Unknown binary operator: {op}")
            return f"{left_val} {op} {right_val}"
    
    def process_regions(self, regions: Dict[str, Any]) -> Dict[str, Any]:
        """Process all regions and their locations/entrances/exits."""
        for player_id, player_regions in regions.items():
            for region_name, region_data in player_regions.items():
                # Process locations
                if 'locations' in region_data:
                    for location in region_data['locations']:
                        if 'access_rule' in location:
                            location['access_rule'] = self.expand_rule(location['access_rule'])
                            
                # Process entrances
                if 'entrances' in region_data:
                    for entrance in region_data['entrances']:
                        if 'access_rule' in entrance:
                            entrance['access_rule'] = self.expand_rule(entrance['access_rule'])
                            
                # Process exits
                if 'exits' in region_data:
                    for exit_data in region_data['exits']:
                        if 'access_rule' in exit_data:
                            exit_data['access_rule'] = self.expand_rule(exit_data['access_rule'])
                            
        return regions