"""The Witness game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class WitnessGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'The Witness'

    def _is_region_reachability_pattern(self, rule: Optional[Dict[str, Any]]) -> bool:
        """
        Check if a rule matches the region.can_reach pattern:
        if state.stale[player]:
            state.update_reachable_regions(player)
        return self in state.reachable_regions[player]

        This pattern is exported as:
        {
          "type": "conditional",
          "test": {
            "type": "subscript",
            "value": {"type": "attribute", "object": {"type": "name", "name": "state"}, "attr": "stale"},
            "index": {"type": "constant", "value": player_id}
          },
          "if_true": {
            "type": "state_method",
            "method": "update_reachable_regions",
            "args": []
          },
          "if_false": {
            "type": "compare",
            "left": {"type": "name", "name": "self"},
            "op": "in",
            "right": {
              "type": "subscript",
              "value": {"type": "attribute", "object": {"type": "name", "name": "state"}, "attr": "reachable_regions"},
              "index": {"type": "constant", "value": player_id}
            }
          }
        }
        """
        if not rule or not isinstance(rule, dict):
            return False

        # Check if it's a conditional
        if rule.get('type') != 'conditional':
            return False

        # Check if test is checking state.stale[player]
        test = rule.get('test', {})
        if test.get('type') != 'subscript':
            return False
        test_value = test.get('value', {})
        if (test_value.get('type') != 'attribute' or
            test_value.get('attr') != 'stale' or
            test_value.get('object', {}).get('type') != 'name' or
            test_value.get('object', {}).get('name') != 'state'):
            return False

        # Check if if_true calls update_reachable_regions
        if_true = rule.get('if_true', {})
        if (if_true.get('type') != 'state_method' or
            if_true.get('method') != 'update_reachable_regions'):
            return False

        # Check if if_false checks self in state.reachable_regions[player]
        if_false = rule.get('if_false', {})
        if if_false.get('type') != 'compare' or if_false.get('op') != 'in':
            return False
        left = if_false.get('left', {})
        if left.get('type') != 'name' or left.get('name') != 'self':
            return False
        right = if_false.get('right', {})
        if right.get('type') != 'subscript':
            return False
        right_value = right.get('value', {})
        if (right_value.get('type') != 'attribute' or
            right_value.get('attr') != 'reachable_regions' or
            right_value.get('object', {}).get('type') != 'name' or
            right_value.get('object', {}).get('name') != 'state'):
            return False

        return True

    def _simplify_region_reachability_pattern(self, rule: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Recursively simplify the region reachability pattern to a constant true rule.

        The pattern checks if a region is reachable, which is redundant for locations
        (they're only checked when their region is reachable) and for exits (region
        reachability is handled by the state manager).

        This method recursively processes compound rules (and, or) to simplify
        nested region reachability patterns.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Check if this is the pattern itself
        if self._is_region_reachability_pattern(rule):
            logger.debug(f"Simplifying region reachability pattern to constant true")
            return {'type': 'constant', 'value': True}

        # Recursively process compound rules
        rule_type = rule.get('type')

        if rule_type in ('and', 'or'):
            # Recursively simplify all conditions
            conditions = rule.get('conditions', [])
            simplified_conditions = [
                self._simplify_region_reachability_pattern(cond)
                for cond in conditions
            ]

            # Filter out constant True values from 'and' rules
            if rule_type == 'and':
                simplified_conditions = [
                    cond for cond in simplified_conditions
                    if cond.get('type') != 'constant' or cond.get('value') is not True
                ]
                # If all conditions were True, return True
                if not simplified_conditions:
                    return {'type': 'constant', 'value': True}
                # If only one condition remains, return it directly
                if len(simplified_conditions) == 1:
                    return simplified_conditions[0]

            # Filter out constant False values from 'or' rules
            elif rule_type == 'or':
                simplified_conditions = [
                    cond for cond in simplified_conditions
                    if cond.get('type') != 'constant' or cond.get('value') is not False
                ]
                # Check if any condition is True (entire OR is True)
                if any(cond.get('type') == 'constant' and cond.get('value') is True
                       for cond in simplified_conditions):
                    return {'type': 'constant', 'value': True}
                # If all conditions were False, return False
                if not simplified_conditions:
                    return {'type': 'constant', 'value': False}
                # If only one condition remains, return it directly
                if len(simplified_conditions) == 1:
                    return simplified_conditions[0]

            return {**rule, 'conditions': simplified_conditions}

        elif rule_type == 'not':
            # Recursively simplify the condition
            condition = rule.get('condition')
            simplified = self._simplify_region_reachability_pattern(condition)
            # If the simplified condition is a constant, negate it
            if simplified and simplified.get('type') == 'constant':
                return {'type': 'constant', 'value': not simplified.get('value')}
            return {**rule, 'condition': simplified}

        # For other rule types, return as-is
        return rule

    def postprocess_rule(self, rule: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Post-process location access rules to simplify region reachability patterns.

        TEMPORARY WORKAROUND: Simplifying all region checks to true for now.
        TODO: Properly convert region.can_reach patterns to can_reach rules with
        the correct region name. This requires analyzer-level changes to track
        which region object a bound method is attached to.
        """
        return self._simplify_region_reachability_pattern(rule)

    def handle_complex_exit_rule(self, exit_name: str, rule_func) -> Optional[Dict[str, Any]]:
        """
        Handle complex exit rules by analyzing them and then post-processing.
        This allows us to simplify region reachability patterns in exit access rules.
        """
        from ..analyzer import analyze_rule

        # Analyze the rule
        analysis_result = analyze_rule(rule_func=rule_func, game_handler=self)

        # Post-process to simplify region reachability patterns
        if analysis_result and analysis_result.get('type') != 'error':
            return self._simplify_region_reachability_pattern(analysis_result)

        return analysis_result
