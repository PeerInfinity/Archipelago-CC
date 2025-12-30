"""Bomb Rush Cyberfunk helper expander."""

from typing import Dict, Any, Set
from .generic import GenericGameExportHandler


class BombRushCyberfunkGameExportHandler(GenericGameExportHandler):
    """Export handler for Bomb Rush Cyberfunk.

    This exporter is already optimally simplified:
    - HELPERS_TO_EXPORT_BLACKLIST: Complex helpers that use loops/globals()
      and require JavaScript implementations in the frontend.
    - get_progression_mapping(): Required hook for REP additive progression.
      No declarative alternative exists for additive item mappings.
    """

    # Complex helpers that use loops/globals() and need JavaScript implementations
    # These are excluded from auto-export and automatically preserved as helper calls
    # JS implementations: frontend/modules/shared/gameLogic/bomb_rush_cyberfunk/
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = {
        'graffiti_spots',
        'build_access_cache',
        'spots_s_glitchless',
        'spots_s_glitched',
        'spots_m_glitchless',
        'spots_m_glitched',
        'spots_l_glitchless',
        'spots_l_glitched',
        'spots_xl_glitchless',
        'spots_xl_glitched',
    }

    # REP item values for additive progression mapping
    REP_VALUES = {
        "8 REP": 8,
        "16 REP": 16,
        "24 REP": 24,
        "32 REP": 32,
        "48 REP": 48,
    }

    def get_progression_mapping(self, world) -> Dict[str, Any]:
        """Return progression mapping for REP items.

        REP items contribute their numeric value to a virtual "rep" counter
        in state.prog_items, managed by the frontend's InventoryManager.
        """
        return {
            "rep": {
                "type": "additive",
                "items": self.REP_VALUES.copy()
            }
        }
