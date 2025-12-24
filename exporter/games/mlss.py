"""Mario & Luigi Superstar Saga game-specific export handler."""

from .generic import GenericGameExportHandler


class MLSSGameExportHandler(GenericGameExportHandler):
    """Export handler for Mario & Luigi Superstar Saga."""

    HELPER_MODULES = ['worlds.mlss.StateLogic']
