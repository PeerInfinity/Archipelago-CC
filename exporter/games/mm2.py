"""Mega Man 2 game-specific export handler."""

import logging
from typing import Any, Callable, Dict

from .generic import GenericGameExportHandler

logger = logging.getLogger(__name__)


class MM2GameExportHandler(GenericGameExportHandler):
    """Export handler for Mega Man 2.

    Inherits all default behavior from GenericGameExportHandler.
    Injects module-level variables needed for helper function analysis.
    """

    # AUTO_EXPORT_DISCOVERED_HELPERS is True by default in GenericGameExportHandler

    # No helpers blacklisted - can_defeat_enough_rbms is now supported with
    # tuple unpacking in for loops and map() function support
    HELPERS_TO_EXPORT_BLACKLIST = set()

    # Parameter name mappings for helpers whose parameter names don't match slot_data keys.
    # Maps helper_name -> {param_name: slot_data_key}
    # The frontend uses these mappings to resolve parameter values from slot_data/settings.
    HELPER_PARAM_MAPPINGS = {
        'can_defeat_enough_rbms': {
            'required': 'wily_5_requirement',
            'boss_requirements': 'wily_5_weapons',
        },
    }

    def prepare_closure_vars(self, rule_func: Callable, closure_vars: Dict[str, Any]) -> Dict[str, Any]:
        """Inject MM2 module-level data structures into closure_vars for helper analysis.

        This ensures that constants from rules.py (robot_masters, weapons_to_name)
        are available during rule analysis, even when they're not in the function's
        direct closure.
        """
        enhanced_closure = closure_vars.copy()

        try:
            # Import MM2 rules module data
            from worlds.mm2.rules import robot_masters, weapons_to_name

            # Inject module-level constants if not already present
            module_vars = {
                'robot_masters': robot_masters,
                'weapons_to_name': weapons_to_name,
            }

            for name, value in module_vars.items():
                if name not in enhanced_closure:
                    enhanced_closure[name] = value
                    logger.debug(f"Injected {name} into closure_vars for MM2 helper analysis")

        except ImportError as e:
            logger.warning(f"Could not import MM2 modules for closure injection: {e}")

        return enhanced_closure
