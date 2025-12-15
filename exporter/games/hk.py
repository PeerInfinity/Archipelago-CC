"""Hollow Knight game-specific export handler."""

from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class HKExportHandler(GenericGameExportHandler):
    """Export handler for Hollow Knight.

    Most functionality is handled by GenericGameExportHandler.
    Only postprocess_regions is overridden to log a warning about HK's
    unique region structure.
    """

    def postprocess_regions(self, multiworld, player: int):
        """
        Log warning about Hollow Knight's unique region structure.

        HK creates all locations in Menu region. Proper redistribution would
        require modifying the region manager's internal state which is complex.
        """
        player_regions = [r for r in multiworld.regions if r.player == player]

        if len(player_regions) == 1 and player_regions[0].name == 'Menu':
            logger.warning(f"[HK] Only Menu region found for player {player}. "
                          f"All {len(player_regions[0].locations)} locations are in Menu.")
            logger.warning("[HK] Hollow Knight requires special region handling "
                          "that is not yet fully implemented.")