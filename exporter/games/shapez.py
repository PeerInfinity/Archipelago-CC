"""shapez game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class ShapezGameExportHandler(GenericGameExportHandler):
    """Export handler for shapez."""
    GAME_NAME = 'shapez'

    # Module paths for automatic helper extraction
    # Helpers are automatically discovered during rule analysis when they're used
    HELPER_MODULES = ['worlds.shapez.regions']
    ITEM_NAME_MODULES = ['worlds.shapez.data.strings']

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Helpers that should NOT be exported as definitions (too complex, need JS implementation)
    # These will remain as helper calls that the frontend JavaScript must handle
    # Note: has_logic_list_building is now supported - list.index() is resolved at analysis time
    HELPERS_TO_EXPORT_BLACKLIST: set[str] = set()

    # Helpers that should be preserved as helper calls (not inlined/expanded by generic pattern matching)
    # These are exported as definitions to the frontend
    HELPERS_TO_PRESERVE: set[str] = {
        'can_cut_half',
        'can_rotate_90',
        'can_rotate_180',
        'can_stack',
        'can_paint',
        'can_mix_colors',
        'has_tunnel',
        'has_balancer',
        'can_use_quad_painter',
        'can_make_stitched_shape',
        'can_build_mam',
        'can_make_east_windmill',
        'can_make_half_half_shape',
        'can_make_half_shape',
    }

    def get_settings_data(self, world, multiworld, player) -> Dict[str, Any]:
        """
        Extract shapez-specific settings including the 'floating' parameter.

        The 'floating' (has_floating) setting is used by helper functions like
        can_make_stitched_shape and can_build_mam to determine if floating layers
        are allowed.
        """
        # Get base settings
        settings = super().get_settings_data(world, multiworld, player)

        # Add shapez-specific settings
        # 'floating' is computed from options in the world's __init__
        # We need to compute it the same way
        options = world.options
        has_floating = (options.allow_floating_layers.value or
                        not (options.randomize_level_requirements and
                             options.randomize_upgrade_requirements))
        settings['floating'] = has_floating

        return settings
