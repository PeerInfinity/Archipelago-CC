"""shapez game-specific export handler."""

from .generic import GenericGameExportHandler


class ShapezGameExportHandler(GenericGameExportHandler):
    """Export handler for shapez."""
    GAME_NAME = 'shapez'

    # Helper modules are auto-detected from function __module__ attributes
    # No need to manually specify HELPER_MODULES

    # Enable export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Enable automatic size-based helper preservation
    AUTO_PRESERVE_LARGE_HELPERS = True

    # Helpers with more than this many nodes will be preserved as helper calls
    HELPER_INLINE_THRESHOLD = 0
