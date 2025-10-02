"""Castlevania 64 (CV64) game-specific export handler."""

from typing import Dict, Any
from .base import BaseGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)

class Cv64GameExportHandler(BaseGameExportHandler):
    """Export handler for Castlevania 64."""
    
    def __init__(self, world):
        super().__init__()  # Base class doesn't take arguments
        self.world = world
        # Import iname to resolve item references
        from worlds.cv64.data import iname
        self.iname = iname
        # Get world properties for warp calculations
        self.s1s_per_warp = getattr(world, 's1s_per_warp', 1)
    
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand CV64-specific rules."""
        if not rule:
            return rule
            
        # Handle state_method with has_all that contains iname references
        if rule.get('type') == 'state_method' and rule.get('method') == 'has_all':
            args = rule.get('args', [])
            if args and isinstance(args[0], dict) and args[0].get('type') == 'list':
                items_list = args[0].get('value', [])
                resolved_items = []
                for item in items_list:
                    if isinstance(item, dict) and item.get('type') == 'attribute':
                        obj = item.get('object', {})
                        if obj.get('type') == 'name' and obj.get('name') == 'iname':
                            attr_name = item.get('attr')
                            if hasattr(self.iname, attr_name):
                                resolved_items.append(getattr(self.iname, attr_name))
                            else:
                                logger.warning(f"Unknown iname attribute: {attr_name}")
                                resolved_items.append(attr_name)
                        else:
                            resolved_items.append(item)
                    else:
                        resolved_items.append(item)
                
                # Convert to an AND condition with item checks
                if resolved_items:
                    return {
                        'type': 'and',
                        'conditions': [
                            {'type': 'item_check', 'item': item_name}
                            for item_name in resolved_items
                        ]
                    }
            
        # Handle item references with iname attributes
        if rule.get('type') == 'item_check':
            item_ref = rule.get('item')
            if isinstance(item_ref, dict) and item_ref.get('type') == 'attribute':
                obj = item_ref.get('object', {})
                if obj.get('type') == 'name' and obj.get('name') == 'iname':
                    # Resolve the iname attribute to the actual item name
                    attr_name = item_ref.get('attr')
                    if hasattr(self.iname, attr_name):
                        rule['item'] = getattr(self.iname, attr_name)
                    else:
                        logger.warning(f"Unknown iname attribute: {attr_name}")
                        rule['item'] = attr_name
        
        # Handle count references with variables
        if 'count' in rule and isinstance(rule['count'], dict):
            if rule['count'].get('type') == 'binary_op':
                # Try to resolve binary operations for warp access rules
                left = rule['count'].get('left', {})
                right = rule['count'].get('right', {})
                op = rule['count'].get('op')
                
                # Resolve self.s1s_per_warp reference
                if (left.get('type') == 'attribute' and 
                    left.get('object', {}).get('type') == 'name' and
                    left.get('object', {}).get('name') == 'self' and
                    left.get('attr') == 's1s_per_warp'):
                    left_val = self.s1s_per_warp
                    
                    # For warp_num, we keep it as a variable for the frontend to handle
                    if right.get('type') == 'name' and right.get('name') == 'warp_num':
                        # Keep the structure but with resolved s1s_per_warp
                        rule['count'] = {
                            'type': 'binary_op',
                            'left': {'type': 'constant', 'value': left_val},
                            'op': op,
                            'right': right
                        }
                else:
                    # Keep binary operations as-is if we can't resolve them
                    pass
            elif rule['count'].get('type') == 'name':
                # Simple variable reference - try to resolve
                var_name = rule['count'].get('name')
                # For warp_num, we'll let the frontend handle it
                if var_name != 'warp_num':
                    logger.debug(f"Unresolved count variable: {var_name}")
        
        # Recursively process nested rules
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule.get('conditions', [])]
        
        return rule
    
    def expand_helper(self, helper_name: str, args=None):
        """Expand CV64-specific helper functions."""
        if helper_name == "Dracula" or helper_name == "can_enter_dracs_chamber":
            # Get the Dracula's condition from the world
            from worlds.cv64.options import DraculasCondition
            drac_condition = getattr(self.world, 'drac_condition', 0)
            required_s2s = getattr(self.world, 'required_s2s', 0)
            
            # Determine what item is needed based on the condition
            if drac_condition == DraculasCondition.option_crystal:
                return {'type': 'item_check', 'item': 'Crystal'}
            elif drac_condition == DraculasCondition.option_bosses:
                return {'type': 'item_check', 'item': 'Trophy', 
                        'count': {'type': 'constant', 'value': required_s2s}}
            elif drac_condition == DraculasCondition.option_specials:
                return {'type': 'item_check', 'item': 'Special2',
                        'count': {'type': 'constant', 'value': required_s2s}}
            else:
                # No condition - always accessible
                return {'type': 'constant', 'value': True}
        
        return None
    
    def postprocess_entrance_rule(self, rule: Dict[str, Any], entrance_name: str) -> Dict[str, Any]:
        """Post-process entrance rules to resolve warp-specific values and handle Dracula's door."""
        if not rule:
            return rule
        
        # Special handling for Dracula's door which has a null constant rule
        if entrance_name == "Dracula's door" and rule.get('type') == 'constant' and rule.get('value') is None:
            # Expand the Dracula helper directly
            return self.expand_helper("Dracula")
        
        # Check if this is a warp entrance
        warp_match = re.match(r'Warp (\d+)', entrance_name)
        if warp_match and rule.get('type') == 'item_check':
            warp_num = int(warp_match.group(1))
            
            # Check if this has a count with warp_num variable
            count = rule.get('count')
            if isinstance(count, dict) and count.get('type') == 'binary_op':
                left = count.get('left', {})
                right = count.get('right', {})
                op = count.get('op')
                
                # If left is constant (s1s_per_warp) and right is warp_num variable
                if (left.get('type') == 'constant' and 
                    right.get('type') == 'name' and right.get('name') == 'warp_num'):
                    
                    # Calculate the final value
                    if op == '*':
                        final_count = left.get('value', 1) * warp_num
                    else:
                        logger.warning(f"Unexpected operator {op} in warp rule")
                        final_count = warp_num
                    
                    # Replace with constant value
                    rule['count'] = {'type': 'constant', 'value': final_count}
        
        return rule