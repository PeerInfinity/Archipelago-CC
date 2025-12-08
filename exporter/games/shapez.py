"""shapez game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class ShapezGameExportHandler(GenericGameExportHandler):
    """Export handler for shapez."""
    GAME_NAME = 'shapez'

    # Where to find helper functions for export
    HELPER_MODULES = ['worlds.shapez.regions']

    # Enable export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Automatic size-based helper preservation
    # Helpers with more than this many nodes will be preserved as helper calls
    HELPER_INLINE_THRESHOLD = 3

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
