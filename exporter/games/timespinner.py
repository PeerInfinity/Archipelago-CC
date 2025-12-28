"""Timespinner game-specific export handler."""

from .generic import GenericGameExportHandler
from typing import Any, Dict


class TimespinnerGameExportHandler(GenericGameExportHandler):
    """Export handler for Timespinner.

    Exports helper function definitions from TimespinnerLogic class.
    All helpers are automatically exported and evaluated by the frontend.
    """

    # Module containing helper functions
    HELPER_MODULES = ['worlds.timespinner.LogicExtensions']

    # Map 'flooded' local variable to 'precalculated_weights' world attribute
    # This is used in helper functions where 'flooded' references precalculated_weights
    NAME_REMAPPING = {'flooded': 'precalculated_weights'}

    def _is_common_helper_pattern(self, helper_name: str) -> bool:
        """Override to prevent GenericGameExportHandler from expanding helpers.

        Timespinner has exported helper definitions from HELPER_MODULES that should
        be preserved as-is. The base class's pattern matching would incorrectly
        expand has_*, can_* patterns into simple item checks.
        """
        return False

    def get_world_data(self, world, multiworld, player) -> Dict[str, Any]:
        """Export Timespinner-specific settings including option flags and warp unlocks."""
        # Get base world data (this also loads _worldgen_settings.json for worldgen worlds)
        settings_dict = super().get_world_data(world, multiworld, player)

        # Export option flags needed by helper functions
        # Use flag_ prefix to match TimespinnerLogic attribute names (e.g., self.flag_specific_keycards)
        # For worldgen worlds, these flags are already loaded from _worldgen_settings.json by the base handler
        if hasattr(world, 'options'):
            options = world.options
            # Only set flags if the options exist (original Timespinner world)
            # Worldgen worlds have different options and get their flags from _worldgen_settings.json
            if hasattr(options, 'specific_keycards'):
                settings_dict['flag_specific_keycards'] = bool(getattr(options.specific_keycards, 'value', False))
            if hasattr(options, 'eye_spy'):
                settings_dict['flag_eye_spy'] = bool(getattr(options.eye_spy, 'value', False))
            if hasattr(options, 'unchained_keys'):
                settings_dict['flag_unchained_keys'] = bool(getattr(options.unchained_keys, 'value', False))
            if hasattr(options, 'prism_break'):
                settings_dict['flag_prism_break'] = bool(getattr(options.prism_break, 'value', False))

        # Export precalculated weights (warp gate unlocks)
        if hasattr(world, 'precalculated_weights'):
            weights = world.precalculated_weights
            settings_dict['pyramid_keys_unlock'] = getattr(weights, 'pyramid_keys_unlock', None)
            settings_dict['present_keys_unlock'] = getattr(weights, 'present_key_unlock', None)
            settings_dict['past_keys_unlock'] = getattr(weights, 'past_key_unlock', None)
            settings_dict['time_keys_unlock'] = getattr(weights, 'time_key_unlock', None)

        return settings_dict
