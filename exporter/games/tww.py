"""The Wind Waker game-specific export handler."""

from typing import Dict, Any, Set, List
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class TWWGameExportHandler(GenericGameExportHandler):
    AUTO_PRESERVE_LARGE_HELPERS = True

    # Define where to find helper functions
    HELPER_MODULES = ['worlds.tww.Macros']

    # Note: Entrance access helpers (can_access_*) are now auto-discovered during
    # rule analysis and no longer need to be whitelisted explicitly.


    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Extract The Wind Waker settings including logic configuration values."""
        # Get base settings
        settings = super().get_settings_data(world, multiworld, player)

        # Add TWW-specific logic values that are used in state_method calls
        # These are calculated during world initialization and stored as world attributes
        logic_attrs = [
            'logic_in_swordless_mode',
            'logic_in_required_bosses_mode',
            'logic_obscure_1',
            'logic_obscure_2',
            'logic_obscure_3',
            'logic_precise_1',
            'logic_precise_2',
            'logic_precise_3',
            'logic_rematch_bosses_skipped',
            'logic_tuner_logic_enabled',
        ]

        for attr in logic_attrs:
            try:
                if hasattr(world, attr):
                    settings[attr] = bool(getattr(world, attr))
                else:
                    settings[attr] = False  # Default value
            except Exception as e:
                logger.error(f"Error extracting {attr}: {e}")
                settings[attr] = False

        return settings

    # Mapping of _tww_* state methods to their rule replacements
    # Most are simple setting lookups, some are negations, one is always true
    STATE_METHOD_REPLACEMENTS = {
        # Simple setting lookups: _tww_X -> setting_value for logic_X
        '_tww_in_swordless_mode': {'type': 'setting_value', 'setting': 'logic_in_swordless_mode'},
        '_tww_in_required_bosses_mode': {'type': 'setting_value', 'setting': 'logic_in_required_bosses_mode'},
        '_tww_obscure_1': {'type': 'setting_value', 'setting': 'logic_obscure_1'},
        '_tww_obscure_2': {'type': 'setting_value', 'setting': 'logic_obscure_2'},
        '_tww_obscure_3': {'type': 'setting_value', 'setting': 'logic_obscure_3'},
        '_tww_precise_1': {'type': 'setting_value', 'setting': 'logic_precise_1'},
        '_tww_precise_2': {'type': 'setting_value', 'setting': 'logic_precise_2'},
        '_tww_precise_3': {'type': 'setting_value', 'setting': 'logic_precise_3'},
        '_tww_rematch_bosses_skipped': {'type': 'setting_value', 'setting': 'logic_rematch_bosses_skipped'},
        '_tww_tuner_logic_enabled': {'type': 'setting_value', 'setting': 'logic_tuner_logic_enabled'},
        # Negations: _tww_outside_X -> NOT setting_value for logic_in_X
        '_tww_outside_swordless_mode': {
            'type': 'not',
            'operand': {'type': 'setting_value', 'setting': 'logic_in_swordless_mode'}
        },
        '_tww_outside_required_bosses_mode': {
            'type': 'not',
            'operand': {'type': 'setting_value', 'setting': 'logic_in_required_bosses_mode'}
        },
        # Complex method that always returns true at runtime (validated during generation)
        '_tww_can_defeat_all_required_bosses': {'type': 'constant', 'value': True},
    }

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand rules with TWW state method replacement.

        This replaces _tww_* state_method calls with setting_value lookups during
        the initial export pass, eliminating the need for JavaScript state methods.
        """
        if not rule or not isinstance(rule, dict):
            return rule

        # First apply base class expansion
        rule = super().expand_rule(rule, _depth)

        # Then replace TWW state methods
        return self._replace_tww_state_methods(rule)

    def _replace_tww_state_methods(self, rule: Any) -> Any:
        """
        Recursively replace _tww_* state_method calls with their equivalent rule structures.
        This allows removing the JavaScript state method implementations.
        """
        if not isinstance(rule, dict):
            return rule

        # Check if this is a state_method call we can replace
        if rule.get('type') == 'state_method':
            method_name = rule.get('method', '')
            if method_name in self.STATE_METHOD_REPLACEMENTS:
                logger.debug(f"Replacing state_method {method_name} with rule structure")
                return self.STATE_METHOD_REPLACEMENTS[method_name].copy()

        # Recursively process all values in the dict
        result = {}
        for key, value in rule.items():
            if isinstance(value, dict):
                result[key] = self._replace_tww_state_methods(value)
            elif isinstance(value, list):
                result[key] = [self._replace_tww_state_methods(item) for item in value]
            else:
                result[key] = value

        return result

    # NOTE: post_process_data removed - state method replacement now happens during
    # the initial export pass via expand_rule() -> _replace_tww_state_methods()
    # The fix in base.py ensures expand_rule is also called on cached helper definitions.
