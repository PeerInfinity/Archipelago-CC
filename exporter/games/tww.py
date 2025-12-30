"""The Wind Waker game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class TWWGameExportHandler(GenericGameExportHandler):
    # Mapping of _tww_* state methods to their rule replacements.
    # Most are simple setting lookups, some are negations, one is always true.
    # These are automatically applied by the base class during rule expansion.
    STATE_METHOD_REPLACEMENTS: Dict[str, Dict[str, Any]] = {
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
