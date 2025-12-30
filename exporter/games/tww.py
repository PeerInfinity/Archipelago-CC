"""The Wind Waker game-specific export handler.

Most LogicMixin state methods are auto-detected from the source code patterns:
- _tww_in_swordless_mode -> setting_value for logic_in_swordless_mode
- _tww_outside_swordless_mode -> not(setting_value for logic_in_swordless_mode)
- etc.

Only complex methods that can't be auto-detected need manual overrides below.
"""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class TWWGameExportHandler(GenericGameExportHandler):
    # Manual overrides for state methods that can't be auto-detected.
    # Most TWW LogicMixin methods follow standard patterns and are auto-detected.
    # Only specify overrides here for:
    # 1. Complex methods with runtime logic (like _tww_can_defeat_all_required_bosses)
    # 2. Methods where auto-detection gets it wrong
    # 3. Methods that need special handling
    STATE_METHOD_REPLACEMENTS: Dict[str, Dict[str, Any]] = {
        # Complex method that validates required bosses at runtime.
        # For export purposes, we treat this as always true since the
        # validation happens during generation.
        '_tww_can_defeat_all_required_bosses': {'type': 'constant', 'value': True},
    }
