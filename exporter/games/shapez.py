"""shapez game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler


class ShapezGameExportHandler(GenericGameExportHandler):
    """Export handler for shapez."""
    GAME_NAME = 'shapez'

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
