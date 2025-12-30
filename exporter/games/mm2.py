"""Mega Man 2 game-specific export handler."""

from .generic import GenericGameExportHandler


class MM2GameExportHandler(GenericGameExportHandler):
    """Export handler for Mega Man 2.

    Inherits all default behavior from GenericGameExportHandler.
    Uses HELPER_PARAM_MAPPINGS to map helper function parameters to slot_data keys.
    """

    # Parameter name mappings for helpers whose parameter names don't match slot_data keys.
    # The can_defeat_enough_rbms helper uses 'required' and 'boss_requirements' as params,
    # but the frontend needs to know these map to 'wily_5_requirement' option and
    # 'wily_5_weapons' world attribute in slot_data.
    HELPER_PARAM_MAPPINGS = {
        'can_defeat_enough_rbms': {
            'required': 'wily_5_requirement',
            'boss_requirements': 'wily_5_weapons',
        },
    }
