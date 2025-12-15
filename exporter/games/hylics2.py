"""Hylics 2 export handler."""

from .generic import GenericGameExportHandler


class Hylics2GameExportHandler(GenericGameExportHandler):
    """Export handler for Hylics 2.

    Inherits all behavior from GenericGameExportHandler.
    """

    AUTO_EXPORT_DISCOVERED_HELPERS = True
    AUTO_PRESERVE_LARGE_HELPERS = False
