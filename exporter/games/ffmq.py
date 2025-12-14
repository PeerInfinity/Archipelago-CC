"""Final Fantasy Mystic Quest game-specific export handler."""

from .generic import GenericGameExportHandler
from typing import Any, Dict
import logging

logger = logging.getLogger(__name__)


class FFMQGameExportHandler(GenericGameExportHandler):
    """Export handler for Final Fantasy Mystic Quest.

    FFMQ uses item groups for weapon categories (Swords, Axes, Bombs, Claws).
    Rules reference these via patterns like `item_groups["Claw" + "s"]` which
    need to be resolved to actual item lists.
    """
    GAME_NAME = 'Final Fantasy Mystic Quest'

    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False

    def __init__(self, world=None):
        super().__init__(world=world)

        # FFMQ has item groups that are commonly referenced
        self.item_groups = {}
        if hasattr(world, 'item_name_groups'):
            self.item_groups = world.item_name_groups

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand rules and resolve FFMQ-specific patterns.

        Handles:
        - Binary ops for string concatenation (e.g., "Claw" + "s" = "Claws")
        - Subscript operations for item_groups access
        - Converting has_any/has_all with resolved item lists to conditions
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle binary operations like "Bomb" + "s" to build item group names
        if rule.get('type') == 'binary_op':
            left = rule.get('left', {})
            right = rule.get('right', {})
            op = rule.get('op')

            # First recursively expand left and right operands
            expanded_left = self.expand_rule(left, _depth + 1)
            expanded_right = self.expand_rule(right, _depth + 1)

            # Handle string concatenation ('+' operator)
            if op == '+':
                # If both sides are constants, concatenate them
                if (expanded_left.get('type') == 'constant' and
                    expanded_right.get('type') == 'constant'):
                    left_val = expanded_left.get('value')
                    right_val = expanded_right.get('value')

                    # String concatenation
                    if isinstance(left_val, str) and isinstance(right_val, str):
                        concatenated = left_val + right_val
                        return {
                            'type': 'constant',
                            'value': concatenated
                        }
                    # Numeric addition
                    elif isinstance(left_val, (int, float)) and isinstance(right_val, (int, float)):
                        return {
                            'type': 'constant',
                            'value': left_val + right_val
                        }

                # Handle special case of "w" variable (closure variable for "Weapon")
                if expanded_left.get('type') == 'name' and expanded_left.get('name') == 'w':
                    if expanded_right.get('type') == 'constant' and isinstance(expanded_right.get('value'), str):
                        group_suffix = expanded_right.get('value')
                        # Try different patterns
                        possible_groups = [
                            f"Weapon{group_suffix}",  # e.g., "Weapons"
                            f"w{group_suffix}",        # e.g., "ws"
                            group_suffix               # Just the suffix
                        ]
                        # Check which one exists in item_groups
                        for group_name in possible_groups:
                            if group_name in self.item_groups:
                                return {
                                    'type': 'constant',
                                    'value': group_name
                                }
                        # Default to Weapon + suffix pattern
                        return {
                            'type': 'constant',
                            'value': f"Weapon{group_suffix}"
                        }

            # Return binary_op with expanded operands if we couldn't fully resolve
            return {
                'type': 'binary_op',
                'left': expanded_left,
                'op': op,
                'right': expanded_right
            }

        # Handle subscript operations for item_groups access
        if rule.get('type') == 'subscript':
            value = rule.get('value', {})
            index = rule.get('index', {})

            if value.get('type') == 'name' and value.get('name') == 'item_groups':
                # Resolve the index (which might be a binary operation)
                resolved_index = self.expand_rule(index, _depth + 1)
                if resolved_index.get('type') == 'constant':
                    group_name = resolved_index.get('value')

                    # Get items in this group
                    if group_name in self.item_groups:
                        return {
                            'type': 'constant',
                            'value': list(self.item_groups[group_name])
                        }

        # Handle state methods that reference resolved item groups
        if rule.get('type') == 'state_method':
            method = rule.get('method')
            args = rule.get('args', [])

            # Resolve args recursively
            resolved_args = [self.expand_rule(arg, _depth + 1) for arg in args]

            if method == 'has_any' and len(resolved_args) == 1:
                # If the argument is a constant list of items
                if resolved_args[0].get('type') == 'constant':
                    items = resolved_args[0].get('value', [])
                    if isinstance(items, list) and items:
                        # Convert to an OR condition of item checks
                        return {
                            'type': 'or',
                            'conditions': [
                                {'type': 'item_check', 'item': item}
                                for item in items
                            ]
                        }

            if method == 'has_all' and len(resolved_args) == 1:
                # If the argument is an empty list, this is always true
                if resolved_args[0].get('type') == 'constant':
                    items = resolved_args[0].get('value', [])
                    if isinstance(items, list) and not items:
                        return {'type': 'constant', 'value': True}
                    elif isinstance(items, list):
                        # Convert to an AND condition of item checks
                        return {
                            'type': 'and',
                            'conditions': [
                                {'type': 'item_check', 'item': item}
                                for item in items
                            ]
                        }

            # Update the rule with resolved args if we couldn't fully expand
            rule['args'] = resolved_args

        # Handle helper expansions
        if rule.get('type') == 'helper':
            expanded = self.expand_helper(rule['name'], rule.get('args', []))
            if expanded:
                return self.expand_rule(expanded, _depth + 1)

        # Recursively expand nested conditions
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [
                self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])
            ]

        if rule.get('type') == 'not':
            rule['condition'] = self.expand_rule(rule.get('condition'), _depth + 1)

        return rule
