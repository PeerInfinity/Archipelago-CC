"""ChecksFinder game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ChecksFinderGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'ChecksFinder'
    """ChecksFinder game handler with special handling for has_from_list."""
    
    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Override to handle ChecksFinder-specific rules."""
        if not rule:
            return rule
            
        # Special handling for has_from_list with 'items' parameter
        # In ChecksFinder, has_from_list(items, n) means "has collected at least n items total"
        if (rule.get('type') == 'state_method' and 
            rule.get('method') == 'has_from_list' and
            rule.get('args') and len(rule.get('args', [])) >= 1):
            
            first_arg = rule['args'][0]
            # Check if first argument is the unresolved 'items' variable
            if (isinstance(first_arg, dict) and 
                first_arg.get('type') == 'name' and 
                first_arg.get('name') == 'items'):
                
                # The second argument should be the count
                if len(rule.get('args', [])) >= 2:
                    count_arg = rule['args'][1]
                    # Transform to a total_items_count rule
                    logger.debug(f"Transforming ChecksFinder has_from_list(items, {count_arg}) to total_items_count")
                    return {
                        'type': 'total_items_count',
                        'count': count_arg
                    }
        
        # Otherwise use parent class handling
        return super().expand_rule(rule)