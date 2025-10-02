"""Faxanadu-specific rule expansion logic."""

from typing import Dict, Any
from .base import BaseGameExportHandler

class FaxanaduGameExportHandler(BaseGameExportHandler):
    """Handler for Faxanadu-specific rules and helpers."""
    
    def __init__(self, world=None):
        super().__init__()
        self.world = world
    
    def expand_helper(self, helper_name: str) -> Dict[str, Any]:
        """
        Expand Faxanadu-specific helper functions.
        """
        if helper_name == "can_buy_in_eolis":
            # Sword or Deluge so we can farm for gold, or Ring of Elf so we can get 1500 from the King.
            return {
                "type": "or",
                "conditions": [
                    {"type": "item_check", "item": "Progressive Sword"},
                    {"type": "item_check", "item": "Deluge"},
                    {"type": "item_check", "item": "Ring of Elf"}
                ]
            }
        
        if helper_name == "has_any_magic":
            # Any of the magic spells
            return {
                "type": "or",
                "conditions": [
                    {"type": "item_check", "item": "Deluge"},
                    {"type": "item_check", "item": "Thunder"},
                    {"type": "item_check", "item": "Fire"},
                    {"type": "item_check", "item": "Death"},
                    {"type": "item_check", "item": "Tilte"}
                ]
            }
        
        return None
    
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand rule functions."""
        if not rule:
            return rule
        
        # Handle helper expansion
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule.get('name'))
            if expanded:
                return expanded
        
        # Handle state_method rules
        if rule.get('type') == 'state_method':
            method = rule.get('method')
            args = rule.get('args', [])
            
            # Handle has_all method
            if method == 'has_all':
                if args and isinstance(args[0], dict) and args[0].get('type') == 'list':
                    items_list = args[0].get('value', [])
                    item_names = []
                    for item in items_list:
                        if isinstance(item, dict) and item.get('type') == 'constant':
                            item_names.append(item.get('value'))
                    
                    if item_names:
                        # Convert to AND condition with item checks
                        return {
                            'type': 'and',
                            'conditions': [
                                {'type': 'item_check', 'item': item_name}
                                for item_name in item_names
                            ]
                        }
            
            # Handle has_any method  
            elif method == 'has_any':
                if args and isinstance(args[0], dict) and args[0].get('type') == 'list':
                    items_list = args[0].get('value', [])
                    item_names = []
                    for item in items_list:
                        if isinstance(item, dict) and item.get('type') == 'constant':
                            item_names.append(item.get('value'))
                    
                    if item_names:
                        # Convert to OR condition with item checks
                        return {
                            'type': 'or',
                            'conditions': [
                                {'type': 'item_check', 'item': item_name}
                                for item_name in item_names
                            ]
                        }
            
            # Handle has method with count
            elif method == 'has':
                if len(args) >= 1:
                    item_name = None
                    count = 1  # Default count
                    
                    # Extract item name
                    if isinstance(args[0], dict) and args[0].get('type') == 'constant':
                        item_name = args[0].get('value')
                    
                    # Extract count if present
                    if len(args) >= 2:
                        if isinstance(args[1], dict) and args[1].get('type') == 'constant':
                            count = args[1].get('value')
                    
                    if item_name:
                        result = {'type': 'item_check', 'item': item_name}
                        if count > 1:
                            result['count'] = {'type': 'constant', 'value': count}
                        return result
            
            # Handle has_all_counts method
            elif method == 'has_all_counts':
                if args and isinstance(args[0], dict) and args[0].get('type') == 'dict':
                    items_dict = args[0].get('value', {})
                    conditions = []
                    for item_data in items_dict:
                        if item_data.get('key', {}).get('type') == 'constant' and \
                           item_data.get('value', {}).get('type') == 'constant':
                            item_name = item_data['key']['value']
                            count = item_data['value']['value']
                            condition = {'type': 'item_check', 'item': item_name}
                            if count > 1:
                                condition['count'] = {'type': 'constant', 'value': count}
                            conditions.append(condition)
                    
                    if conditions:
                        return {
                            'type': 'and',
                            'conditions': conditions
                        }
        
        # Recursively process conditions
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule.get('conditions', [])]
        
        return rule