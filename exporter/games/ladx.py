"""Links Awakening DX game-specific export handler.

This exporter handles LADXR-specific data structures:
- LADXR condition objects (AND, OR, COUNT, FOUND, COUNTS)
- LADXR item name mapping to Archipelago item names
- LADXR entrance objects with condition attributes

Most of this code is truly game-specific and cannot be factored out to the base exporter.
"""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
from worlds.ladx.Items import ladxr_item_to_la_item_name
import logging
import re

logger = logging.getLogger(__name__)

class LADXGameExportHandler(GenericGameExportHandler):
    """Export handler for Links Awakening DX."""

    USE_RESOLVED_ITEMS = True

    def handle_complex_entrance_rule(self, entrance_name: str, access_rule_method):
        """
        Extract the actual condition from LADX entrance objects (for entrances).

        This delegates to handle_complex_exit_rule since LinksAwakeningEntrance
        objects are added to both region.exits and region.entrances (via connect()).
        Both need the same special handling to avoid analyzing the access_rule method
        which uses GameStateAdapater - a class that can't be analyzed as a function.
        """
        return self.handle_complex_exit_rule(entrance_name, access_rule_method)

    def handle_complex_exit_rule(self, exit_name: str, access_rule_method):
        """
        Extract the actual condition from LADX entrance objects.

        LADX entrances store the actual condition in entrance.condition attribute,
        not in the access_rule method. We extract it directly here to avoid
        the isinstance pattern that the analyzer can't handle.
        """
        # access_rule_method is a bound method, so we can get the instance
        if hasattr(access_rule_method, '__self__'):
            entrance = access_rule_method.__self__

            # Check if this is a LinksAwakeningEntrance with a condition attribute
            if hasattr(entrance, 'condition'):
                condition = entrance.condition

                # Case 1: None = always accessible
                if condition is None:
                    logger.debug(f"LADX exit '{exit_name}' has no condition, always accessible")
                    return {'type': 'constant', 'value': True}

                # Case 2: String = item or event name
                elif isinstance(condition, str):
                    logger.debug(f"LADX exit '{exit_name}' requires item/event: {condition}")
                    return {
                        'type': 'item_check',
                        'item': condition
                    }

                # Case 3: LADXR condition object (AND/OR) - convert to rules
                else:
                    logger.debug(f"LADX exit '{exit_name}' has LADXR condition object, converting to rules")
                    converted_rule = self._convert_ladxr_condition_to_rule(condition)
                    if converted_rule:
                        return converted_rule
                    # If conversion failed, return None to use normal analysis
                    logger.warning(f"LADX exit '{exit_name}' LADXR condition conversion failed, using normal analysis")
                    return None

        # If we can't extract the condition, return None to use normal analysis
        return None

    def _convert_ladxr_condition_to_rule(self, condition) -> Optional[Dict[str, Any]]:
        """
        Convert a LADXR condition object (AND/OR/COUNT/FOUND/COUNTS) to a rule structure.

        LADXR uses classes with private attributes accessed via Python's name mangling.
        """
        class_name = condition.__class__.__name__

        # Handle AND/OR conditions (have __items and __children)
        if class_name in ('AND', 'OR'):
            items = getattr(condition, f'_{class_name}__items', [])
            children = getattr(condition, f'_{class_name}__children', [])

            conditions = [self._parse_ladxr_item(item) for item in items]
            for child in children:
                child_rule = self._convert_ladxr_condition_to_rule(child)
                if child_rule:
                    conditions.append(child_rule)

            if len(conditions) == 1:
                return conditions[0]
            elif len(conditions) > 1:
                return {'type': class_name.lower(), 'conditions': conditions}
            return None

        # Handle COUNT/FOUND conditions (single item with amount)
        if class_name in ('COUNT', 'FOUND'):
            item = getattr(condition, f'_{class_name}__item', None)
            amount = getattr(condition, f'_{class_name}__amount', 1)

            if item is None:
                logger.warning(f"{class_name} condition missing item attribute")
                return None

            mapped_item = self._map_ladxr_item_name(item)
            logger.debug(f"LADX {class_name} condition: {item} (mapped to {mapped_item}) >= {amount}")
            return {
                'type': 'item_check',
                'item': mapped_item,
                'count': {'type': 'constant', 'value': amount}
            }

        # Handle COUNTS condition (multiple items with combined amount)
        if class_name == 'COUNTS':
            items = getattr(condition, '_COUNTS__items', [])
            amount = getattr(condition, '_COUNTS__amount', 1)

            if not items:
                logger.warning("COUNTS condition missing items attribute")
                return None

            mapped_items = [self._map_ladxr_item_name(item) for item in items]
            logger.debug(f"LADX COUNTS condition: {items} (mapped to {mapped_items}) >= {amount}")
            return {
                'type': 'counts',
                'items': mapped_items,
                'count': {'type': 'constant', 'value': amount}
            }

        logger.warning(f"Unknown LADXR condition type: {class_name}")
        return None

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

    def _map_ladxr_item_name(self, item_str: str) -> str:
        """Map LADXR internal item names to Archipelago item names.

        Uses the canonical mapping from worlds/ladx/Items.py which maps
        LADXR IDs (e.g., 'POWER_BRACELET') to Archipelago names (e.g., 'Progressive Power Bracelet').

        Special case: 'RUPEES' is an accumulator target, not an actual item.
        """
        # Special case for RUPEES accumulator target
        if item_str == 'RUPEES':
            return 'RUPEES'
        # Use the canonical mapping from the world
        return ladxr_item_to_la_item_name.get(item_str, item_str)

    def _parse_ladxr_item(self, item_str: str) -> Dict[str, Any]:
        """Parse a single LADXR item string into an item_check rule."""
        mapped_name = self._map_ladxr_item_name(item_str)
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

        # Map LADXR item names to Archipelago names in item_check rules
        if rule_type == 'item_check' and 'item' in rule:
            item_name = rule['item']
            if isinstance(item_name, str):
                mapped_name = self._map_ladxr_item_name(item_name)
                if mapped_name != item_name:
                    logger.debug(f"Mapped item name: {item_name} -> {mapped_name}")
                    rule['item'] = mapped_name

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

    def get_game_info(self, world):
        """Export LADX game info including RUPEES accumulator rules."""
        game_info = super().get_game_info(world)

        # Define accumulator rules for rupee items
        # This allows the frontend to compute total RUPEES from collected rupee items
        # matching the Python behavior in worlds/ladx/__init__.py collect() method
        # Pattern matches items like "20 Rupees", "50 Rupees", etc.
        # and accumulates their numeric value into the "RUPEES" target
        game_info['accumulator_rules'] = [
            {
                'pattern': r'^(\d+) Rupees$',    # Regex to match rupee items
                'extract_value': True,           # Extract numeric value from group 1
                'target': 'RUPEES',              # Target accumulator name
                'discriminator': None            # No dynamic target selection
            }
        ]

        # Initialize RUPEES accumulator - use world's value if set, otherwise 0
        # WorldGen worlds may precollect RUPEES for rule evaluation
        if hasattr(world, 'prog_items_init') and world.prog_items_init:
            game_info['prog_items_init'] = dict(world.prog_items_init)
        else:
            game_info['prog_items_init'] = {
                'RUPEES': 0
            }

        return game_info
