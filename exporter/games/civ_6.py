"""Civilization VI export handler."""

from .generic import GenericGameExportHandler


class Civ6GameExportHandler(GenericGameExportHandler):
    """Minimal handler for Civilization VI - enables automatic helper export."""
    GAME_NAME = 'Civilization VI'
    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False
