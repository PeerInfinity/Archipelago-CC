"""Jak and Daxter: The Precursor Legacy game-specific export handler."""

from .generic import GenericGameExportHandler
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class JakAndDaxterGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Jak and Daxter: The Precursor Legacy'

    def __init__(self, world=None):
        super().__init__()
        self.world = world
        self.item_id_to_name = {}
        # Build a mapping of item IDs to names
        # The item_table is a dict mapping item_id -> item_name
        from worlds.jakanddaxter.items import item_table
        self.item_id_to_name = dict(item_table)

    def _unwrap_constant(self, value: Any) -> Any:
        """Unwrap constant wrappers to get the actual value."""
        if isinstance(value, dict) and value.get('type') == 'constant':
            return value.get('value')
        return value

    def _resolve_subscript(self, subscript_rule: Dict[str, Any]) -> Any:
        """Resolve a subscript operation, particularly for item_table lookups."""
        if not isinstance(subscript_rule, dict) or subscript_rule.get('type') != 'subscript':
            return subscript_rule

        value = subscript_rule.get('value', {})
        index = subscript_rule.get('index', {})

        # Check if this is an item_table lookup
        if isinstance(value, dict) and value.get('type') == 'name' and value.get('name') == 'item_table':
            # Extract the item ID from the index
            item_id = self._unwrap_constant(index)
            if isinstance(item_id, int) and item_id in self.item_id_to_name:
                # Return the item name
                return self.item_id_to_name[item_id]
            else:
                logger.warning(f"Could not resolve item_table subscript for ID: {item_id}")
                return f"Unknown Item {item_id}"

        return subscript_rule

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand Jak and Daxter-specific rules, particularly capability rules."""
        if not rule or not isinstance(rule, dict):
            return rule

        # Unwrap constant values and resolve subscripts in item_check rules
        if rule.get('type') == 'item_check':
            if 'item' in rule:
                # First resolve any subscripts
                rule['item'] = self._resolve_subscript(rule['item'])
                # Then unwrap constants
                rule['item'] = self._unwrap_constant(rule['item'])
            if 'count' in rule:
                rule['count'] = self._unwrap_constant(rule['count'])
            # Continue processing the rule after unwrapping

        # Handle state_method calls that need to be converted
        if rule.get('type') == 'state_method':
            method = rule.get('method')
            args = rule.get('args', [])

            if method == 'has_any':
                # has_any(items, player) -> check if player has any of the items
                if len(args) >= 1:
                    items_arg = args[0]
                    items = self._unwrap_constant(items_arg)
                    if isinstance(items, list):
                        return {
                            'type': 'or',
                            'conditions': [
                                {'type': 'item_check', 'item': item}
                                for item in items
                            ]
                        }
                logger.warning(f"Could not expand state_method has_any with args: {args}")
            elif method == 'has_all':
                # has_all(items, player) -> check if player has all of the items
                if len(args) >= 1:
                    items_arg = args[0]
                    items = self._unwrap_constant(items_arg)
                    if isinstance(items, list):
                        return {
                            'type': 'and',
                            'conditions': [
                                {'type': 'item_check', 'item': item}
                                for item in items
                            ]
                        }
                logger.warning(f"Could not expand state_method has_all with args: {args}")

        # Handle capability rules by expanding them to item checks
        if rule.get('type') == 'capability':
            capability = rule.get('capability')
            if capability == 'fight':
                # can_fight checks for: Jump Dive, Jump Kick, Punch, or Kick
                return {
                    'type': 'or',
                    'conditions': [
                        {'type': 'item_check', 'item': 'Jump Dive'},
                        {'type': 'item_check', 'item': 'Jump Kick'},
                        {'type': 'item_check', 'item': 'Punch'},
                        {'type': 'item_check', 'item': 'Kick'}
                    ]
                }
            elif capability == 'free_scout_flies':
                # can_free_scout_flies checks for: Jump Dive OR (Crouch AND Crouch Uppercut)
                return {
                    'type': 'or',
                    'conditions': [
                        {'type': 'item_check', 'item': 'Jump Dive'},
                        {
                            'type': 'and',
                            'conditions': [
                                {'type': 'item_check', 'item': 'Crouch'},
                                {'type': 'item_check', 'item': 'Crouch Uppercut'}
                            ]
                        }
                    ]
                }
            else:
                logger.warning(f"Unknown Jak and Daxter capability: {capability}")
                # Return a more descriptive rule for unknown capabilities
                return {
                    'type': 'unknown_capability',
                    'capability': capability,
                    'description': f"Unknown capability: {capability}"
                }

        # Handle helper functions
        if rule.get('type') == 'helper':
            helper_name = rule.get('name', '')
            args = rule.get('args', [])

            if helper_name == 'can_fight':
                return {
                    'type': 'or',
                    'conditions': [
                        {'type': 'item_check', 'item': 'Jump Dive'},
                        {'type': 'item_check', 'item': 'Jump Kick'},
                        {'type': 'item_check', 'item': 'Punch'},
                        {'type': 'item_check', 'item': 'Kick'}
                    ]
                }
            elif helper_name == 'can_free_scout_flies':
                return {
                    'type': 'or',
                    'conditions': [
                        {'type': 'item_check', 'item': 'Jump Dive'},
                        {
                            'type': 'and',
                            'conditions': [
                                {'type': 'item_check', 'item': 'Crouch'},
                                {'type': 'item_check', 'item': 'Crouch Uppercut'}
                            ]
                        }
                    ]
                }

        # Handle nested rules recursively
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [
                self.expand_rule(cond) for cond in rule.get('conditions', [])
            ]

        if rule.get('type') == 'not':
            rule['condition'] = self.expand_rule(rule.get('condition'))

        if rule.get('type') == 'conditional':
            rule['test'] = self.expand_rule(rule.get('test'))
            rule['if_true'] = self.expand_rule(rule.get('if_true'))
            rule['if_false'] = self.expand_rule(rule.get('if_false'))

        return rule
