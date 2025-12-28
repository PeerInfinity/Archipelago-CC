"""Mega Man 2 game-specific export handler."""

from .generic import GenericGameExportHandler


class MM2GameExportHandler(GenericGameExportHandler):
    """Export handler for Mega Man 2.

    Inherits all default behavior from GenericGameExportHandler.
    Uses CLOSURE_VAR_IMPORTS to inject module-level variables needed for helper function analysis.
    """

    # Module-level variables to inject into closure_vars for helper analysis.
    # These constants from rules.py are needed during analysis of can_defeat_enough_rbms.
    CLOSURE_VAR_IMPORTS = {
        'worlds.mm2.rules': ['robot_masters', 'weapons_to_name'],
    }

    # Parameter name mappings for helpers whose parameter names don't match slot_data keys.
    # Maps helper_name -> {param_name: slot_data_key}
    # The frontend uses these mappings to resolve parameter values from slot_data/settings.
    HELPER_PARAM_MAPPINGS = {
        'can_defeat_enough_rbms': {
            'required': 'wily_5_requirement',
            'boss_requirements': 'wily_5_weapons',
        },
    }
