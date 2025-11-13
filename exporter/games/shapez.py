"""shapez game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class ShapezGameExportHandler(GenericGameExportHandler):
    """Export handler for shapez."""
    GAME_NAME = 'shapez'

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Override expand_rule to preserve helper functions as-is.

        shapez uses many helper functions (can_cut_half, can_stack, etc.)
        that should remain as helper calls rather than being expanded to
        capability rules or other inferred types.
        """
        if not rule:
            return rule

        # For helper rules, just return them as-is without expansion
        if rule.get('type') == 'helper':
            return rule

        # Handle __analyzed_func__ using parent logic
        if rule.get('type') == 'state_method' and rule.get('method') == '__analyzed_func__':
            if 'original' in rule:
                return self._analyze_original_rule(rule['original'])
            return self._infer_rule_type(rule)

        # Recursively expand conditions in and/or rules
        if rule['type'] in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]

        return rule
