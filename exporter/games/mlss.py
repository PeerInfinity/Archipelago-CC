"""Mario & Luigi Superstar Saga game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class MLSSGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Mario & Luigi Superstar Saga'
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False

    # Module paths containing helper functions
    HELPER_MODULES = ['worlds.mlss.StateLogic']

    # Shop helpers that should be expanded to can_reach rules
    # These helpers simply call state.can_reach() for a specific region
    SHOP_HELPER_REGIONS = {
        'piranha_shop': 'Shop Mom Piranha Flag',
        'fungitown_shop': 'Shop Enter Fungitown Flag',
        'star_shop': 'Shop Beanstar Complete Flag',
        'birdo_shop': 'Shop Birdo Flag',
        'fungitown_birdo_shop': 'Fungitown Shop Birdo Flag',
    }

    def _fix_setting_value_access(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fix setting_value.value pattern.

        In Python, multiworld.goal[player].value accesses the .value attribute of an Option.
        But setting_value already returns the raw value, so accessing .value is incorrect.
        """
        if rule is None or not isinstance(rule, dict):
            return rule

        # Fix: Accessing .value on a setting_value should just return the setting_value
        if (rule.get('type') == 'attribute' and
            rule.get('attr') == 'value' and
            isinstance(rule.get('object'), dict) and
            rule['object'].get('type') == 'setting_value'):
            return rule['object']

        # Recursively fix nested rules
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self._fix_setting_value_access(c) for c in rule.get('conditions', [])]
        if rule.get('type') == 'not':
            rule['condition'] = self._fix_setting_value_access(rule.get('condition'))
        if rule.get('type') == 'helper' and rule.get('args'):
            rule['args'] = [self._fix_setting_value_access(arg) for arg in rule['args']]
        if rule.get('type') == 'attribute':
            rule['object'] = self._fix_setting_value_access(rule.get('object'))

        return rule

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """
        Expand rules with MLSS-specific fixes.

        Handles:
        - Simplifying setting_value.value to just setting_value
          (since setting_value already returns the raw value, not an Option object)
        """
        if rule is None or not isinstance(rule, dict):
            return rule

        # First fix the setting_value.value pattern anywhere in the rule tree
        rule = self._fix_setting_value_access(rule)

        # Call parent to continue processing
        return super().expand_rule(rule, _depth)

    def expand_helper(self, helper_name: str) -> Dict[str, Any]:
        """
        Expand helper functions into basic rule conditions.

        Shop helpers that just call state.can_reach() are expanded to can_reach rules.
        """
        # Check if this is a shop helper that should be expanded to can_reach
        if helper_name in self.SHOP_HELPER_REGIONS:
            region_name = self.SHOP_HELPER_REGIONS[helper_name]
            return {'type': 'can_reach', 'region': region_name}

        # Fall back to parent class behavior
        return super().expand_helper(helper_name)
