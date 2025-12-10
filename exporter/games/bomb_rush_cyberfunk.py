"""Bomb Rush Cyberfunk helper expander."""

from typing import Dict, Any, Set
from .generic import GenericGameExportHandler


class BombRushCyberfunkGameExportHandler(GenericGameExportHandler):
    """Export handler for Bomb Rush Cyberfunk."""
    GAME_NAME = 'Bomb Rush Cyberfunk'

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    # Helpers too complex for automatic export (contain loops, use globals(), etc.)
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = {
        # Main graffiti spot counting - uses build_access_cache and sums from spot functions
        'graffiti_spots',
        # Access cache builder - uses globals() and iteration
        'build_access_cache',
        # Spot counting functions - all have for loops iterating over dicts
        'spots_s_glitchless',
        'spots_s_glitched',
        'spots_m_glitchless',
        'spots_m_glitched',
        'spots_l_glitchless',
        'spots_l_glitched',
        'spots_xl_glitchless',
        'spots_xl_glitched',
    }

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return progression mapping for REP items.

        In Bomb Rush Cyberfunk, REP items like "8 REP", "16 REP", etc. contribute
        their numeric value to a virtual "rep" counter in state.prog_items.
        """
        return {
            "rep": {
                "type": "additive",
                "items": {
                    "8 REP": 8,
                    "16 REP": 16,
                    "24 REP": 24,
                    "32 REP": 32,
                    "48 REP": 48
                }
            }
        }
