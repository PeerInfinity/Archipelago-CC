"""Dark Souls III game-specific exporter.

Transforms _can_get and _can_go_to helper calls into standard rule types
(location_check and can_reach) that the frontend can evaluate natively.
"""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class DarkSouls3GameExportHandler(GenericGameExportHandler):
    """Dark Souls III-specific export handler."""

    def postprocess_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Transform _can_get and _can_go_to helper calls into standard rule types.

        Dark Souls III uses wrapper methods that map to standard state methods:
        - _can_get(location) -> can_reach_location -> location_check
        - _can_go_to(region) -> can_reach_entrance -> can_reach
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # Transform helper type rules
        if rule.get('type') == 'helper':
            name = rule.get('name')
            args = rule.get('args', [])

            # _can_get(location) -> location_check
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

            # _can_go_to(region) -> can_reach
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

        # Recursively process nested rules
        if rule.get('type') in ['and', 'or']:
            rule['conditions'] = [self.postprocess_rule(cond) for cond in rule.get('conditions', [])]
        elif rule.get('type') == 'not':
            rule['condition'] = self.postprocess_rule(rule.get('condition'))

        return rule
