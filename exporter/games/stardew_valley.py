"""Stardew Valley game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class StardewValleyGameExportHandler(GenericGameExportHandler):
    """Export handler for Stardew Valley.

    Stardew Valley uses a complex logic system with helper methods
    from the StardewLogic class. This exporter attempts to properly
    serialize these helpers for the JavaScript frontend.
    """

    GAME_NAME = 'Stardew Valley'

    def __init__(self):
        super().__init__()
        # Add Stardew Valley-specific helper recognition patterns
        self.known_helpers = {
            # Skill-related helpers
            'can_earn_level',
            'can_earn_mastery',
            'has_level',

            # Tool-related helpers
            'has_tool',
            'can_reach_region',

            # Season/time-related helpers
            'has_season',

            # Item-related helpers
            'has_item',
            'has_relationship',

            # Quest-related helpers
            'can_complete_quest',

            # Bundle-related helpers
            'can_complete_bundle',
        }

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand Stardew Valley-specific rules."""
        if not rule:
            return rule

        # Check for Stardew Valley helper patterns
        if rule.get('type') == 'helper':
            helper_name = rule.get('name', '')

            # Log helpers for debugging
            logger.debug(f"Processing Stardew Valley helper: {helper_name}")

            # Return the helper as-is for now (frontend will handle it)
            return rule

        # Use default generic expansion for other rule types
        return super().expand_rule(rule)
