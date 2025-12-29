"""The Legend of Zelda game-specific export handler."""

from .generic import GenericGameExportHandler


class TLoZGameExportHandler(GenericGameExportHandler):
    """Export handler for The Legend of Zelda.

    The Boss Status location pattern (lambda default parameters referencing
    Location objects) is handled by the generic AST visitor's can_reach
    Location object resolution.
    """
    pass
