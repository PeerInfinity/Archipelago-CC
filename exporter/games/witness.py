"""The Witness game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class WitnessGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'The Witness'

    # Mapping of laser activation locations to the regions containing their panels
    LASER_ACTIVATION_TO_REGION = {
        'Bunker Laser Activated': 'Bunker Laser Platform',
        'Swamp Laser Activated': 'Swamp Laser Area',
        'Town Laser Activated': 'Town Tower Top',
        'Treehouse Laser Activated': 'Treehouse Laser Room',
        'Quarry Laser Activated': 'Outside Quarry',
        'Symmetry Island Laser Activated': 'Symmetry Island Upper',
        'Jungle Laser Activated': 'Jungle',
        'Monastery Laser Activated': 'Outside Monastery',
        'Shadows Laser Activated': 'Shadows Laser Room',
        'Desert Laser Activated': 'Desert Outside',
        # Keep has two panels (Hedges or Pressure Plates), both in Keep Tower
        'Keep Laser Activated': 'Keep Tower',
    }

    def __init__(self):
        super().__init__()
        self._current_location_name = None

    def set_context(self, location_name: str):
        """Store the current location name for context-aware processing."""
        self._current_location_name = location_name

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

    def _convert_region_reach_to_helper(self, rule: Optional[Dict[str, Any]], region_name: str = None) -> Optional[Dict[str, Any]]:
        """
        Convert region.can_reach patterns to can_reach helper calls.

        The pattern checks region reachability using a conditional that tests state.stale
        and state.reachable_regions. We convert this to a simpler can_reach helper call
        that takes the region name as a parameter.

        To extract the region name, we need to track which region object the method is
        bound to. For now, we look for the region name in the surrounding context or
        accept it as a parameter.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Check if this is a region reachability pattern
        if self._is_region_reachability_pattern(rule):
            # For now, we can't extract the region name from the pattern itself
            # because it's a bound method. We would need analyzer-level changes.
            # As a workaround, we return the pattern as-is and let the frontend
            # handle it, OR we could try to extract context from the calling location.

            # TODO: Implement proper region name extraction
            # For now, just log that we found the pattern
            logger.debug(f"Found region reachability pattern but cannot extract region name")
            return rule

        # Recursively process compound rules
        rule_type = rule.get('type')

        if rule_type in ('and', 'or'):
            conditions = rule.get('conditions', [])
            simplified_conditions = [
                self._convert_region_reach_to_helper(cond, region_name)
                for cond in conditions
            ]
            return {**rule, 'conditions': simplified_conditions}

        elif rule_type == 'not':
            condition = rule.get('condition')
            simplified = self._convert_region_reach_to_helper(condition, region_name)
            return {**rule, 'condition': simplified}

        return rule

    def postprocess_rule(self, rule: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """
        Post-process location access rules to handle region reachability patterns.

        For laser activation locations, convert region.can_reach patterns to
        can_reach_region helper calls with the specific region name.
        """
        # Check if this is a laser activation location
        if self._current_location_name and self._current_location_name in self.LASER_ACTIVATION_TO_REGION:
            # Check if the rule is a region reachability pattern
            if self._is_region_reachability_pattern(rule):
                region_name = self.LASER_ACTIVATION_TO_REGION[self._current_location_name]
                logger.info(f"Converting {self._current_location_name} to can_reach_region('{region_name}')")
                return {
                    'type': 'helper',
                    'name': 'can_reach_region',
                    'args': [{'type': 'constant', 'value': region_name}]
                }

        return rule

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
