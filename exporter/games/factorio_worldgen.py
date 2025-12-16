"""Factorio WorldGen game-specific export handler.

This handler extends the Factorio handler to inherit its settings, including
USE_RESOLVED_ITEMS = True which is required for the frontend to properly
track resolved technology items during spoiler testing.
"""

from .factorio import FactorioGameExportHandler
import logging

logger = logging.getLogger(__name__)


class FactorioWorldGenGameExportHandler(FactorioGameExportHandler):
    """Export handler for Factorio WorldGen.

    Inherits all Factorio-specific handling including:
    - USE_RESOLVED_ITEMS = True for tracking resolved technology names
    - Technology name simplification in rules
    - Progression item mapping

    The Factorio WorldGen world uses the same rule_builder based rules
    and technology system as the original Factorio world.
    """
    pass
