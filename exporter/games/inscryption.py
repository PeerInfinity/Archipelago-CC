"""Inscryption game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class InscryptionGameExportHandler(GenericGameExportHandler):
    """Inscryption game handler with special handling for helper functions."""
    
    def __init__(self, world=None):
        """Initialize with world object to access game-specific data."""
        super().__init__()
        self.world = world
    
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Override to handle Inscryption-specific rules."""
        if not rule:
            return rule
            
        # List of Inscryption helper functions
        inscryption_helpers = {
            'has_act2_requirements',
            'has_act2_bridge_requirements',
            'has_act3_requirements', 
            'has_all_epitaph_pieces',
            'has_camera_and_meat',
            'has_gems_and_battery',
            'has_inspectometer_battery',
            'has_monocle',
            'has_transcendence_requirements'
        }
        
        # Handle item_check with attribute reference to self.world.required_epitaph_pieces_name
        if rule.get('type') == 'item_check':
            item = rule.get('item', {})
            # Check if item is self.world.required_epitaph_pieces_name
            if (item.get('type') == 'attribute' and
                item.get('attr') == 'required_epitaph_pieces_name' and
                item.get('object', {}).get('type') == 'attribute' and
                item['object'].get('attr') == 'world'):
                
                # Replace with constant value "Epitaph Piece"
                logger.debug("Converting self.world.required_epitaph_pieces_name to 'Epitaph Piece'")
                rule = rule.copy()
                rule['item'] = {
                    'type': 'constant',
                    'value': 'Epitaph Piece'
                }
                return rule
        
        # Handle function_call with self.method pattern
        if (rule.get('type') == 'function_call' and 
            rule.get('function') and 
            rule['function'].get('type') == 'attribute'):
            
            func = rule['function']
            # Check if it's self.method_name
            if (func.get('object', {}).get('type') == 'name' and 
                func['object'].get('name') == 'self' and
                func.get('attr') in inscryption_helpers):
                
                method_name = func['attr']
                args = rule.get('args', [])
                
                logger.debug(f"Converting Inscryption self.{method_name} to helper node")
                return {
                    'type': 'helper',
                    'name': method_name,
                    'args': args
                }
        
        # Otherwise use parent class handling
        return super().expand_rule(rule)