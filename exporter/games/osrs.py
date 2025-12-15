"""Old School Runescape game-specific export handler.

Handles OSRS-specific rule patterns including:
- Quest points helper function conversion
- Other OSRS-specific expansions

Note: Region object resolution is handled automatically by the analyzer
(objects with .name attribute are converted to string constants).
"""

from typing import Dict, Any, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class OSRSGameExportHandler(GenericGameExportHandler):
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False

    # No blacklist - quest_points is handled via computed helper
    HELPERS_TO_EXPORT_BLACKLIST = set()

    def __init__(self):
        super().__init__()

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export OSRS-specific settings including QP location data."""
        settings = super().get_settings_data(world, multiworld, player)

        # Export quest point data as a mapping of item_name -> qp_value
        # This allows the computed quest_points helper to sum QP values
        qp_items = {}
        if hasattr(world, 'available_QP_locations'):
            for qp_event in world.available_QP_locations:
                # Extract QP value from item name (e.g., "1 QP (Cook's Assistant)" -> 1)
                try:
                    qp_value = int(qp_event[0])
                    qp_items[qp_event] = qp_value
                except (ValueError, IndexError):
                    logger.warning(f"Could not parse QP value from: {qp_event}")

        settings['qp_items'] = qp_items
        return settings

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """
        Get helper definitions including computed quest_points helper.

        The quest_points helper in Python iterates over available_QP_locations and
        sums QP values for items the player has. We define a computed helper that
        uses the exported qp_items data structure:

        Python: sum(int(qp_event[0]) for qp_event in available_QP_locations if state.has(qp_event, player))
        JSON:   sum_of(qp_value for [item, qp_value] in qp_items.items() if has(item))
        """
        helper_defs = super().get_helper_definitions(world)

        # Define computed helper for quest_points
        # Logic: iterate over qp_items, sum qp_value for each item the player has
        helper_defs['quest_points'] = {
            'params': [],
            'body': {
                'type': 'sum_of',
                'iterator_info': {
                    'target': {
                        'type': 'tuple',
                        'elements': [
                            {'type': 'name', 'name': 'item_name'},
                            {'type': 'name', 'name': 'qp_value'}
                        ]
                    },
                    'iterator': {
                        'type': 'method_call',
                        'object': {'type': 'setting_value', 'setting': 'qp_items'},
                        'method': 'items',
                        'args': []
                    }
                },
                'element_rule': {
                    'type': 'conditional',
                    'test': {
                        'type': 'item_check',
                        'item': {'type': 'name', 'name': 'item_name'}
                    },
                    'if_true': {'type': 'name', 'name': 'qp_value'},
                    'if_false': {'type': 'constant', 'value': 0}
                }
            }
        }

        return helper_defs

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """
        Recursively expand and resolve OSRS-specific rule patterns.

        Handles:
        1. Converting self.quest_points() and world.quest_points() method calls to helper functions
        2. Other OSRS-specific expansions as needed
        """
        if not rule:
            return rule

        rule_type = rule.get('type')

        # Handle function calls (e.g., self.quest_points() or world.quest_points())
        if rule_type == 'function_call':
            function = rule.get('function', {})

            # Check if this is a method call (e.g., self.quest_points or world.quest_points)
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                method_name = function.get('attr')

                # Check if object is 'self' or 'world' (both refer to the OSRS World instance)
                if obj.get('type') == 'name' and obj.get('name') in ['self', 'world']:
                    if method_name == 'quest_points':
                        # Convert to a helper function call
                        logger.debug(f"Converting {obj.get('name')}.quest_points() to helper function")
                        return {
                            'type': 'helper',
                            'name': 'quest_points',
                            'args': []
                        }

        # Handle 'and' and 'or' conditions recursively
        if rule_type in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]

        # Handle 'compare' operations recursively
        if rule_type == 'compare':
            if 'left' in rule:
                rule['left'] = self.expand_rule(rule['left'], _depth + 1)
            if 'right' in rule:
                rule['right'] = self.expand_rule(rule['right'], _depth + 1)

        # Handle state_method recursively (expand args)
        if rule_type == 'state_method':
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg, _depth + 1) if isinstance(arg, dict) else arg
                               for arg in rule.get('args', [])]

        # Let the parent class handle other cases
        return super().expand_rule(rule, _depth)


# Ensure this handler is registered in exporter/games/__init__.py
