"""Timespinner game-specific export handler."""

from .generic import GenericGameExportHandler


class TimespinnerGameExportHandler(GenericGameExportHandler):
    """Export handler for Timespinner.

    Game-specific handling:
    - Maps self.flag_* Logic class attributes to options (without flag_ prefix)
    - Exports precalculated_weights warp unlock values (handles keys/key naming difference)
    - Preserves helper definitions (prevents generic has_*/can_* pattern expansion)
    """

    # Map self.<attr> in TimespinnerLogic to setting names
    # flag_* prefix is stripped; warp unlocks are identity-mapped for WORLD_ATTRIBUTES
    SELF_ATTR_TO_SETTING = {
        'flag_specific_keycards': 'specific_keycards',
        'flag_eye_spy': 'eye_spy',
        'flag_unchained_keys': 'unchained_keys',
        'flag_prism_break': 'prism_break',
        'flag_find_the_flame': 'find_the_flame',
        'pyramid_keys_unlock': 'pyramid_keys_unlock',
        'present_keys_unlock': 'present_keys_unlock',
        'past_keys_unlock': 'past_keys_unlock',
        'time_keys_unlock': 'time_keys_unlock',
    }

    # Export warp unlocks at top level (logic uses 'keys', world uses 'key')
    WORLD_ATTRIBUTES = {
        'pyramid_keys_unlock': lambda w, m, p: getattr(getattr(w, 'precalculated_weights', None), 'pyramid_keys_unlock', None),
        'present_keys_unlock': lambda w, m, p: getattr(getattr(w, 'precalculated_weights', None), 'present_key_unlock', None),
        'past_keys_unlock': lambda w, m, p: getattr(getattr(w, 'precalculated_weights', None), 'past_key_unlock', None),
        'time_keys_unlock': lambda w, m, p: getattr(getattr(w, 'precalculated_weights', None), 'time_key_unlock', None),
    }

    def _is_common_helper_pattern(self, helper_name: str) -> bool:
        """Disable generic pattern expansion - helpers are exported as-is."""
        return False
