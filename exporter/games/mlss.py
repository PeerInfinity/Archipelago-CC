"""Mario & Luigi Superstar Saga game-specific export handler."""

from .generic import GenericGameExportHandler


class MLSSGameExportHandler(GenericGameExportHandler):
    """Export handler for Mario & Luigi Superstar Saga."""

    # AUTO_EXPORT_DISCOVERED_HELPERS is True by default in GenericGameExportHandler
    AUTO_PRESERVE_LARGE_HELPERS = False
    HELPER_MODULES = ['worlds.mlss.StateLogic']
