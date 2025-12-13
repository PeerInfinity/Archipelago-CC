"""Subnautica game-specific export handler."""

from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class SubnauticaGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Subnautica'

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    def expand_rule(self, rule, _depth: int = 0):
        """Handle special location dependency patterns.

        The "Repair Aurora Drive" location depends on "Aurora Drive Room - Upgrade Console"
        being reachable. This is implemented in Python as:
            room = subnautica_world.get_location("Aurora Drive Room - Upgrade Console")
            set_rule(location, lambda state: room.can_reach(state))

        We convert this to a can_access_location helper call with the location data.
        """
        if not rule:
            return rule

        # Handle location.can_reach() pattern (e.g., room.can_reach())
        if rule.get('type') == 'function_call':
            func = rule.get('function', {})
            if (func.get('type') == 'attribute' and
                func.get('attr') == 'can_reach' and
                func.get('object', {}).get('type') == 'name'):
                var_name = func['object'].get('name')
                if var_name == 'room':
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
