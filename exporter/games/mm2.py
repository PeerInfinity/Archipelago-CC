"""Mega Man 2 game-specific export handler."""

from .generic import GenericGameExportHandler


class MM2GameExportHandler(GenericGameExportHandler):
    """Export handler for Mega Man 2.

    Inherits all default behavior from GenericGameExportHandler.
    Only provides blacklist for complex helper that cannot be auto-exported.
    """
    GAME_NAME = 'Mega Man 2'
    # Enable automatic helper export
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Blacklist can_defeat_enough_rbms - it contains a for loop over
    # boss_requirements.items() that the analyzer cannot export
    HELPERS_TO_EXPORT_BLACKLIST = {'can_defeat_enough_rbms'}
