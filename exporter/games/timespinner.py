"""Timespinner game-specific export handler."""

from .generic import GenericGameExportHandler


class TimespinnerGameExportHandler(GenericGameExportHandler):
    """Export handler for Timespinner.

    Exports helper function definitions from TimespinnerLogic class.
    All helpers are automatically exported and evaluated by the frontend.
    Helper modules are auto-discovered from the game's world directory.

    Settings are automatically exported by the base class:
    - Options (specific_keycards, eye_spy, etc.) -> options.<name>
    - World attributes (precalculated_weights) -> precalculated_weights.<attr>
    """

    # Map 'flooded' local variable to 'precalculated_weights' world attribute
    # This is used in helper functions where 'flooded' references precalculated_weights
    NAME_REMAPPING = {'flooded': 'precalculated_weights'}

    # Map self.<attr> patterns in TimespinnerLogic to their setting paths
    # The logic class stores option flags with flag_ prefix, but options are exported without prefix
    # getSetting() in the frontend checks both world.X and world.options.X, so no prefix needed
    # The *_keys_unlock attributes use plural but world uses singular 'key_unlock'
    SELF_ATTR_TO_SETTING = {
        # Option flags: self.flag_X -> X (looked up via getSetting which checks world.options)
        'flag_specific_keycards': 'specific_keycards',
        'flag_eye_spy': 'eye_spy',
        'flag_unchained_keys': 'unchained_keys',
        'flag_prism_break': 'prism_break',
        'flag_find_the_flame': 'find_the_flame',
        # Warp unlocks: exported to top level via WORLD_ATTRIBUTES
        'pyramid_keys_unlock': 'pyramid_keys_unlock',
        'present_keys_unlock': 'present_keys_unlock',
        'past_keys_unlock': 'past_keys_unlock',
        'time_keys_unlock': 'time_keys_unlock',
    }

    # Export warp unlock values at the top level of world data
    # Note: logic uses plural 'keys' but world uses singular 'key'
    WORLD_ATTRIBUTES = {
        'pyramid_keys_unlock': lambda w, m, p: getattr(getattr(w, 'precalculated_weights', None), 'pyramid_keys_unlock', None),
        'present_keys_unlock': lambda w, m, p: getattr(getattr(w, 'precalculated_weights', None), 'present_key_unlock', None),
        'past_keys_unlock': lambda w, m, p: getattr(getattr(w, 'precalculated_weights', None), 'past_key_unlock', None),
        'time_keys_unlock': lambda w, m, p: getattr(getattr(w, 'precalculated_weights', None), 'time_key_unlock', None),
    }

    def _is_common_helper_pattern(self, helper_name: str) -> bool:
        """Override to prevent GenericGameExportHandler from expanding helpers.

        Timespinner has exported helper definitions (auto-discovered from LogicExtensions)
        that should be preserved as-is. The base class's pattern matching would incorrectly
        expand has_*, can_* patterns into simple item checks.
        """
        return False
