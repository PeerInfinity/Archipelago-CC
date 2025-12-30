"""Subnautica game-specific export handler."""

import copy
from .generic import GenericGameExportHandler


class SubnauticaGameExportHandler(GenericGameExportHandler):
    """Subnautica export handler with SwimRule property expansion.

    The SwimRule option class has computed properties:
    - base_depth: returns [200, 400, 600][value % 3]
    - consider_items: returns value > 2

    Since Choice options are exported as integers by default
    (EXPORT_CHOICE_OPTIONS_AS_NUMERIC = True), we need to expand
    these property accesses in helpers and rules to their computed
    equivalents so the frontend can evaluate them.

    Note: The room.can_reach() pattern for "Repair Aurora Drive" is now
    handled automatically by the analyzer's closure variable resolution
    (see call_visitor.py lines 1289-1316).
    """

    # Helpers that should always be exported (used in access rules)
    HELPERS_TO_EXPORT_WHITELIST = {'is_radiated'}

    # Preserve is_radiated as a helper call (don't let GenericGameExportHandler
    # expand it to a generic_helper based on naming patterns)
    HELPERS_TO_PRESERVE = {'is_radiated'}

    def expand_rule(self, rule, _depth: int = 0):
        """Expand SwimRule computed property accesses in rules.

        Expands swim_rule.base_depth and swim_rule.consider_items to their
        computed equivalents so the frontend can evaluate them with just the
        numeric swim_rule option value.
        """
        if not rule:
            return rule

        # Only deep copy at top level to avoid redundant copies during recursion
        # (needed because _expand_swim_rule_attrs modifies nodes in-place)
        if _depth == 0:
            rule = copy.deepcopy(rule)

        # Expand SwimRule attribute accesses
        self._expand_swim_rule_attrs(rule)

        # Call base class for standard processing (handles recursion, helper expansion, etc.)
        return super().expand_rule(rule, _depth)

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
