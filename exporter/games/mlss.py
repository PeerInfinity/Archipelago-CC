"""Mario & Luigi Superstar Saga game-specific export handler."""

from .generic import GenericGameExportHandler


class MLSSGameExportHandler(GenericGameExportHandler):
    """Export handler for Mario & Luigi Superstar Saga."""
    # No configuration needed - helper modules are auto-discovered from world directory
    pass
