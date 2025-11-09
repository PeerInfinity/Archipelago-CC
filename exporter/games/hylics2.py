"""Hylics 2 export handler."""

from typing import Dict, Any
from .base import BaseGameExportHandler
import logging

logger = logging.getLogger(__name__)

class Hylics2GameExportHandler(BaseGameExportHandler):
    GAME_NAME = 'Hylics 2'
    """Export handler for Hylics 2."""
    
    def expand_helper(self, helper_name: str):
        """
        Expand Hylics 2 helper functions.
        Returns None to preserve helper nodes as-is in the rules.json.
        The frontend will handle these helper functions.
        """
        # We preserve helper functions as-is for the frontend to handle
        return None
        
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand rule functions."""
        if not rule:
            return rule
            
        # Standard processing from base class
        if rule['type'] == 'helper':
            expanded = self.expand_helper(rule['name'])
            return expanded if expanded else rule
            
        if rule['type'] in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]
            
        return rule