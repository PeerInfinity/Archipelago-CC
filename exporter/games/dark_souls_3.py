"""Dark Souls III game-specific exporter.

This exporter transforms _can_get and _can_go_to helper calls into standard
location_check and can_reach rule types that the frontend can evaluate natively.
"""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class DarkSouls3GameExportHandler(GenericGameExportHandler):
    """Dark Souls III-specific export handler.

    The main purpose of this handler is to transform the game's helper methods
    (_can_get, _can_go_to) into standard rule types (location_check, can_reach)
    that the frontend rule engine understands.
    """

    def postprocess_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Transform _can_get and _can_go_to calls into standard rule types.

        Dark Souls III uses wrapper methods:
        - _can_get(state, location) -> state.can_reach_location()
        - _can_go_to(state, region) -> state.can_reach_entrance()

        This method transforms these into the standard location_check and can_reach
        rule types that the frontend can evaluate directly.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Handle helper type references to _can_get and _can_go_to
        if rule.get('type') == 'helper':
            name = rule.get('name')
            args = rule.get('args', [])

            # Handle _can_get(location) -> location_check
            if name == '_can_get' and args:
                location_arg = args[0]
                if isinstance(location_arg, dict) and location_arg.get('type') == 'constant':
                    return {
                        'type': 'location_check',
                        'location': {
                            'type': 'constant',
                            'value': location_arg.get('value')
                        }
                    }

            # Handle _can_go_to(region) -> can_reach
            elif name == '_can_go_to' and args:
                region_arg = args[0]
                if isinstance(region_arg, dict) and region_arg.get('type') == 'constant':
                    return {
                        'type': 'can_reach',
                        'region': {
                            'type': 'constant',
                            'value': region_arg.get('value')
                        }
                    }

        # Handle function calls to self._can_get and self._can_go_to
        if rule.get('type') == 'function_call':
            func = rule.get('function', {})
            if (func.get('type') == 'attribute' and
                func.get('object', {}).get('type') == 'name' and
                func.get('object', {}).get('name') == 'self'):

                attr = func.get('attr')
                args = rule.get('args', [])

                # Handle self._can_get(state, location)
                if attr == '_can_get' and args:
                    # The location is the last argument (skip state argument)
                    location_arg = args[-1] if len(args) > 1 else args[0]
                    if isinstance(location_arg, dict) and location_arg.get('type') == 'constant':
                        return {
                            'type': 'location_check',
                            'location': {
                                'type': 'constant',
                                'value': location_arg.get('value')
                            }
                        }

                # Handle self._can_go_to(state, region)
                elif attr == '_can_go_to' and args:
                    # The region is the last argument (skip state argument)
                    region_arg = args[-1] if len(args) > 1 else args[0]
                    if isinstance(region_arg, dict) and region_arg.get('type') == 'constant':
                        return {
                            'type': 'can_reach',
                            'region': {
                                'type': 'constant',
                                'value': region_arg.get('value')
                            }
                        }

        # Recursively process nested rules
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.postprocess_rule(cond) for cond in rule.get('conditions', [])]
        elif rule.get('type') == 'not':
            rule['condition'] = self.postprocess_rule(rule.get('condition'))

        return rule
