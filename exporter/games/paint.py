"""Paint game-specific export handler."""

from typing import Dict, Any, Optional, Set
from .generic import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)


class PaintGameExportHandler(GenericGameExportHandler):
    """Export handler for Paint game.

    Paint uses a custom location access rule system based on paint percentage calculations.
    Each location has an access rule that compares paint percentage to a threshold derived
    from the location name (e.g., "Similarity: 1.0%").

    For WorldGen worlds, rule overrides are skipped since they have their own generated rules.
    """

    # Export Paint-specific option values needed by calculate_paint_percent_available helper
    EXPORTED_OPTIONS = ['canvas_size_increment', 'logic_percent']

    # Blacklist paint_percent_available - it has caching logic with state mutation
    # that doesn't translate to the pure function model
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = {'paint_percent_available'}

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Override rule analysis for Paint location access rules.

        Paint locations use "Similarity: X.XX%" naming. This method parses the threshold
        from the location name and creates a rule comparing calculate_paint_percent_available.
        """
        # Skip for worldgen worlds - they have their own rules
        if self._is_worldgen_world():
            return None

        if not (rule_target_name and rule_target_name.startswith("Similarity: ")):
            return None

        # Extract the percentage from the location name (format: "Similarity: X.XX%")
        match = re.match(r"Similarity: ([\d.]+)%", rule_target_name)
        if not match:
            logger.warning(f"Paint: Could not extract threshold from location name: {rule_target_name}")
            return None

        threshold_percent = float(match.group(1))

        # Register the helper for auto-export
        try:
            from worlds.paint.rules import calculate_paint_percent_available
            self.register_helper_usage('calculate_paint_percent_available', calculate_paint_percent_available)
        except ImportError:
            self.register_helper_usage('calculate_paint_percent_available')

        return {
            'type': 'compare',
            'left': {'type': 'helper', 'name': 'calculate_paint_percent_available', 'args': []},
            'op': '>=',
            'right': {'type': 'constant', 'value': threshold_percent}
        }

    def postprocess_regions(self, multiworld, player):
        """Set unique access_rule lambdas on each location to ensure proper cache keys."""
        if self._is_worldgen_world():
            return

        try:
            from worlds.paint.rules import calculate_paint_percent_available
        except ImportError:
            logger.error("Paint: Could not import calculate_paint_percent_available")
            return

        location_count = 0
        for region in multiworld.get_regions(player):
            for location in region.locations:
                if location.name and location.name.startswith("Similarity: "):
                    match = re.match(r"Similarity: ([\d.]+)%", location.name)
                    if match:
                        threshold = float(match.group(1))
                        # Capture player and threshold in lambda defaults for unique cache keys
                        location.access_rule = lambda state, p=player, t=threshold: \
                            calculate_paint_percent_available(state, state.multiworld.worlds[p], p) >= t
                        location_count += 1

        logger.info(f"Paint: Set unique access rules on {location_count} locations")
