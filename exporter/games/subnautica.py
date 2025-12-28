"""Subnautica game-specific export handler."""

import copy
from typing import Dict, Any, List, Set
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class SubnauticaGameExportHandler(GenericGameExportHandler):
    """Subnautica export handler with SwimRule property expansion.

    The SwimRule option class has computed properties:
    - base_depth: returns [200, 400, 600][value % 3]
    - consider_items: returns value > 2

    Since Choice options are exported as integers by default
    (EXPORT_CHOICE_OPTIONS_AS_NUMERIC = True), we need to expand
    these property accesses in helpers and rules to their computed
    equivalents so the frontend can evaluate them.
    """

    # Module containing helper functions to export
    HELPER_MODULES: List[str] = ['worlds.subnautica.rules']

    # Helpers that should always be exported (used in access rules)
    HELPERS_TO_EXPORT_WHITELIST: Set[str] = {'is_radiated'}

    def _expand_helper_definition(self, helper_def: dict, helper_name: str) -> dict:
        """Expand SwimRule property accesses in helper definitions.

        The SwimRule option class has computed properties:
        - base_depth: returns [200, 400, 600][value % 3]
        - consider_items: returns value > 2

        Since we only export the integer value, we need to expand these
        property accesses to their computed equivalents.

        Note: This is different from expand_helper() which expands helper *calls*
        in rules. This method transforms helper *definitions* before export.
        """
        if not helper_def:
            return helper_def

        # Deep copy to avoid modifying the original
        helper_def = copy.deepcopy(helper_def)

        # Recursively expand SwimRule attribute accesses
        self._expand_swim_rule_attrs(helper_def)

        return helper_def

    def _expand_swim_rule_attrs(self, node: dict) -> None:
        """Recursively expand swim_rule.base_depth and swim_rule.consider_items."""
        if not isinstance(node, dict):
            return

        # Check if this is an attribute access on swim_rule
        if (node.get('type') == 'attribute' and
            node.get('object', {}).get('type') == 'name' and
            node.get('object', {}).get('name') == 'swim_rule'):

            attr = node.get('attr')

            if attr == 'base_depth':
                # Expand to: [200, 400, 600][swim_rule % 3]
                # Using subscript on a constant array with modulo index
                node.clear()
                node.update({
                    'type': 'subscript',
                    'value': {
                        'type': 'constant',
                        'value': [200, 400, 600]
                    },
                    'index': {
                        'type': 'binary_op',
                        'left': {
                            'type': 'name',
                            'name': 'swim_rule'
                        },
                        'op': '%',
                        'right': {
                            'type': 'constant',
                            'value': 3
                        }
                    }
                })
                return

            elif attr == 'consider_items':
                # Expand to: swim_rule > 2
                node.clear()
                node.update({
                    'type': 'compare',
                    'left': {
                        'type': 'name',
                        'name': 'swim_rule'
                    },
                    'op': '>',
                    'right': {
                        'type': 'constant',
                        'value': 2
                    }
                })
                return

        # Recursively process all dict values and list items
        for key, value in list(node.items()):
            if isinstance(value, dict):
                self._expand_swim_rule_attrs(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        self._expand_swim_rule_attrs(item)

    def expand_rule(self, rule, _depth: int = 0):
        """Handle special location dependency patterns and expand SwimRule attributes.

        The "Repair Aurora Drive" location depends on "Aurora Drive Room - Upgrade Console"
        being reachable. This is implemented in Python as:
            room = subnautica_world.get_location("Aurora Drive Room - Upgrade Console")
            set_rule(location, lambda state: room.can_reach(state))

        We convert this to a can_access_location helper call with the location data.

        Also expands swim_rule.base_depth and swim_rule.consider_items in all rules.
        """
        if not rule:
            return rule

        # Deep copy to avoid modifying the original when expanding attributes
        rule = copy.deepcopy(rule)

        # Expand SwimRule attribute accesses in this rule
        self._expand_swim_rule_attrs(rule)

        # Handle location.can_reach() pattern (e.g., room.can_reach())
        # Check both AST format (type: 'function_call') and Rule Builder format (rule: 'AST_function_call')
        rule_type = rule.get('type') or rule.get('rule')
        if rule_type in ('function_call', 'AST_function_call'):
            # Function info may be in rule directly (AST) or in rule['args'] (Rule Builder)
            func = rule.get('function') or rule.get('args', {}).get('function', {})
            if (func.get('type') == 'attribute' and
                func.get('attr') == 'can_reach' and
                func.get('object', {}).get('type') == 'name'):
                var_name = func['object'].get('name')
                # Handle both 'room' and 'location' variable names
                # The analyzer may use 'location' for closure variables
                if var_name in ('room', 'location'):
                    # Replace with the same access rule as "Aurora Drive Room - Upgrade Console"
                    return {
                        'type': 'helper',
                        'name': 'can_access_location',
                        'args': [{
                            'type': 'constant',
                            'value': {
                                'can_slip_through': False,
                                'name': 'Aurora Drive Room - Upgrade Console',
                                'need_laser_cutter': False,
                                'need_propulsion_cannon': True,
                                'position': {
                                    'x': 872.5,
                                    'y': 2.7,
                                    'z': -0.7
                                }
                            }
                        }]
                    }

        # Recursively process nested rules
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]

        return rule

    def get_helper_definitions(self, world) -> Dict[str, Any]:
        """Get helper definitions with SwimRule property expansion.

        Overrides the base implementation to apply SwimRule property expansion
        to all helper definitions before returning them.
        """
        # Get helper definitions from base class
        helpers = super().get_helper_definitions(world)

        # Apply SwimRule expansion to each helper definition
        expanded_helpers = {}
        for helper_name, helper_def in helpers.items():
            expanded_helpers[helper_name] = self._expand_helper_definition(helper_def, helper_name)

        return expanded_helpers
