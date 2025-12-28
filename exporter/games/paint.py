"""Paint game-specific export handler."""

from typing import Dict, Any, Optional, Set
from .generic import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)


class PaintGameExportHandler(GenericGameExportHandler):
    """Export handler for Paint game.

    Paint uses a custom location access rule system based on paint percentage calculations.
    The core logic is in the paint_percent_available helper function.

    Each location has an access rule that checks:
        paint_percent_available(state, world, player) >= threshold

    Where threshold is calculated from the location's address: (address % 198600) / 4

    NOTE: This handler is also used for Paint WorldGen worlds (due to _worldgen suffix stripping
    in get_game_export_handler). For worldgen worlds, we skip the rule overrides since they
    have their own rules that shouldn't be overwritten.
    """

    # Export Paint-specific option values at top level of settings
    EXPORTED_OPTIONS = ['canvas_size_increment', 'logic_percent']

    # Blacklist paint_percent_available - it has caching logic with state mutation
    # (state.paint_percent_stale) that doesn't translate to the pure function model.
    # Location rules will call calculate_paint_percent_available directly instead.
    HELPERS_TO_EXPORT_BLACKLIST: Set[str] = {
        'paint_percent_available'
    }

    def __init__(self, world=None):
        """Initialize handler and detect if this is a worldgen world."""
        super().__init__(world=world)
        # Check if this is a worldgen world by examining the module path
        self._is_worldgen = False
        if world:
            module_path = type(world).__module__
            if 'paint_worldgen' in module_path:
                self._is_worldgen = True
                logger.debug("Paint: Handler initialized for Paint WorldGen - skipping rule overrides")

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Override rule analysis for Paint location access rules.

        Paint locations have a custom access_rule method that compares paint percentage
        to a threshold derived from the location address.

        Example location: "Similarity: 1.0%" at address 198604
        Threshold: (198604 % 198600) / 4 = 4 / 4 = 1.0% ✓

        Args:
            rule_func: The access_rule function/method
            rule_target_name: The name of the location (e.g., "Similarity: 1.0%")

        Returns:
            A rule dict that compares calculate_paint_percent_available to the threshold
        """
        # Skip for worldgen worlds - they have their own rules
        if self._is_worldgen:
            return None

        # Check if this is a Paint location access rule
        if rule_target_name and rule_target_name.startswith("Similarity: "):
            # Extract the percentage from the location name
            # Format: "Similarity: X.XX%"
            match = re.match(r"Similarity: ([\d.]+)%", rule_target_name)
            if match:
                threshold_percent = float(match.group(1))

                # Register the helper for auto-export
                # Import the function to pass to register_helper_usage for module detection
                try:
                    from worlds.paint.rules import calculate_paint_percent_available
                    self.register_helper_usage('calculate_paint_percent_available', calculate_paint_percent_available)
                except ImportError:
                    self.register_helper_usage('calculate_paint_percent_available')

                # Create the rule structure
                # Use calculate_paint_percent_available directly (auto-exported helper)
                # instead of paint_percent_available (which has caching logic)
                return {
                    'type': 'compare',
                    'left': {
                        'type': 'helper',
                        'name': 'calculate_paint_percent_available',
                        'args': []
                    },
                    'op': '>=',
                    'right': {
                        'type': 'constant',
                        'value': threshold_percent
                    }
                }
            else:
                logger.warning(f"Paint: Could not extract threshold from location name: {rule_target_name}")

        # Not a Paint location or couldn't parse - let normal analysis proceed
        return None

    def postprocess_regions(self, multiworld, player):
        """Post-process Paint regions to set unique access_rule lambdas on each location.

        This is needed because all Paint locations use the same access_rule method (defined
        on the PaintLocation class), which causes the exporter's rule analysis cache to
        reuse the same cached result for all locations. By setting unique lambda functions
        on each location, we ensure each location gets its own cache key and proper analysis.

        NOTE: This is skipped for Paint WorldGen worlds (_worldgen suffix) since they
        have their own rules that shouldn't be overwritten.
        """
        # Skip for worldgen worlds - they have their own rules that shouldn't be overwritten
        if self._is_worldgen:
            logger.debug("Paint: Skipping postprocess_regions for Paint WorldGen")
            return

        logger.info("Paint: Post-processing regions to set unique access rules on locations")

        # Import the calculate_paint_percent_available function (not the caching wrapper)
        try:
            from worlds.paint.rules import calculate_paint_percent_available
        except ImportError:
            logger.error("Paint: Could not import calculate_paint_percent_available from worlds.paint.rules")
            return

        # Get the player's regions
        location_count = 0
        for region in multiworld.get_regions(player):
            for location in region.locations:
                # Check if this is a Paint Similarity location
                if location.name and location.name.startswith("Similarity: "):
                    # Extract the threshold from the location name
                    match = re.match(r"Similarity: ([\d.]+)%", location.name)
                    if match:
                        threshold_percent = float(match.group(1))

                        # Create a unique lambda for this location with the threshold captured
                        # This ensures each location has a different cache key in the exporter
                        # Note: we need to capture 'player' and 'threshold' in the lambda's defaults
                        # Use calculate_paint_percent_available directly (auto-exported)
                        location.access_rule = lambda state, p=player, t=threshold_percent: \
                            calculate_paint_percent_available(state, state.multiworld.worlds[p], p) >= t

                        location_count += 1

        logger.info(f"Paint: Finished post-processing {location_count} locations")
