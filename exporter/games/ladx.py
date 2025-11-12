"""Links Awakening DX game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)

class LADXGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Links Awakening DX'
    """Export handler for Links Awakening DX."""

    def expand_helper(self, helper_name: str):
        """Expand game-specific helper functions for LADX."""
        # Start with generic expansion
        # Will add game-specific helpers as we discover them during testing
        return super().expand_helper(helper_name)

    def _parse_ladxr_condition_string(self, condition_str: str) -> Optional[Dict[str, Any]]:
        """
        Parse LADXR's special condition string format into rule structures.

        Formats:
        - "ITEM_NAME" -> simple item check
        - "and['ITEM1', 'ITEM2', ...]" -> and condition
        - "or['ITEM1', 'ITEM2', ...]" -> or condition
        """
        if not condition_str:
            return None

        # Check for and/or patterns
        and_match = re.match(r"and\[(.*)\]", condition_str)
        or_match = re.match(r"or\[(.*)\]", condition_str)

        if and_match:
            # Parse and condition
            items_str = and_match.group(1)
            items = [item.strip().strip("'\"") for item in items_str.split(',')]
            return {
                'type': 'and',
                'conditions': [
                    self._parse_ladxr_item(item) for item in items if item
                ]
            }
        elif or_match:
            # Parse or condition
            items_str = or_match.group(1)
            items = [item.strip().strip("'\"") for item in items_str.split(',')]
            return {
                'type': 'or',
                'conditions': [
                    self._parse_ladxr_item(item) for item in items if item
                ]
            }
        else:
            # Simple item name
            return self._parse_ladxr_item(condition_str)

    def _parse_ladxr_item(self, item_str: str) -> Dict[str, Any]:
        """Parse a single LADXR item string into an item_check rule."""
        # LADXR uses internal item names like POWER_BRACELET
        # We need to convert these to the Archipelago item names
        item_name_mapping = {
            'POWER_BRACELET': 'Progressive Power Bracelet',
            'SWORD': 'Progressive Sword',
            'SHIELD': 'Progressive Shield',
            'MAGIC_POWDER': 'Magic Powder',
            'MAGIC_ROD': 'Magic Rod',
            'OCARINA': 'Ocarina',
            'FEATHER': 'Roc\'s Feather',
            'HOOKSHOT': 'Hookshot',
            'PEGASUS_BOOTS': 'Pegasus Boots',
            'SHOVEL': 'Shovel',
            'BOMB': 'Bomb',
            'BOOMERANG': 'Boomerang',
            'BOW': 'Bow',
            'ROOSTER': 'Rooster',
            # Add more mappings as needed
        }

        # Try to map the item name
        mapped_name = item_name_mapping.get(item_str, item_str)

        return {
            'type': 'item_check',
            'item': mapped_name
        }

    def postprocess_entrance_rule(self, rule: Dict[str, Any], entrance_name: str = None) -> Dict[str, Any]:
        """
        Post-process entrance rules to handle LADX's isinstance pattern.

        LADX entrances use isinstance(self.condition, str) to check if the condition
        is a simple string vs a complex condition object. We need to simplify this
        for JavaScript by removing the isinstance check.
        """
        if not rule:
            return rule

        # Detect the isinstance pattern used in LADX entrance access_rule methods
        if (rule.get('type') == 'conditional' and
            rule.get('test', {}).get('type') == 'helper' and
            rule.get('test', {}).get('name') == 'isinstance'):

            args = rule.get('test', {}).get('args', [])
            if len(args) >= 2 and args[1].get('type') == 'name' and args[1].get('name') == 'str':
                # This is checking isinstance(something, str)
                first_arg = args[0]

                # Case 1: isinstance(self.condition, str) - can't resolve at export time
                if (first_arg.get('type') == 'attribute' and
                    first_arg.get('attr') == 'condition'):
                    logger.debug(f"LADX entrance '{entrance_name}' uses isinstance(self.condition, str), treating as always accessible")
                    return None

                # Case 2: isinstance(constant, str) - can evaluate at export time
                elif first_arg.get('type') == 'constant':
                    # The constant has been resolved, so isinstance check would be True
                    # The constant value might be in LADXR format (e.g., "and['ITEM1', 'ITEM2']")
                    # Parse it and return the resulting rule
                    constant_value = first_arg.get('value')
                    if isinstance(constant_value, str):
                        parsed_rule = self._parse_ladxr_condition_string(constant_value)
                        if parsed_rule:
                            logger.debug(f"LADX entrance '{entrance_name}' parsed LADXR condition: {constant_value}")
                            return parsed_rule

                    # If parsing failed or not a string, fall back to the if_true branch
                    if_true = rule.get('if_true')
                    logger.debug(f"LADX entrance '{entrance_name}' uses isinstance on constant, simplifying to if_true branch")
                    return self._postprocess_rule_recursive(if_true) if if_true else None

        # For other rule types, continue with standard recursive postprocessing
        return self._postprocess_rule_recursive(rule)

    def _postprocess_rule_recursive(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively postprocess nested rule structures."""
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Process nested conditions
        if rule_type in ['and', 'or'] and 'conditions' in rule:
            rule['conditions'] = [
                self._postprocess_rule_recursive(cond)
                for cond in rule['conditions']
            ]
        elif rule_type == 'not' and 'condition' in rule:
            rule['condition'] = self._postprocess_rule_recursive(rule['condition'])
        elif rule_type == 'conditional':
            if 'test' in rule:
                rule['test'] = self._postprocess_rule_recursive(rule['test'])
            if 'if_true' in rule:
                rule['if_true'] = self._postprocess_rule_recursive(rule['if_true'])
            if 'if_false' in rule:
                rule['if_false'] = self._postprocess_rule_recursive(rule['if_false'])

        return rule
