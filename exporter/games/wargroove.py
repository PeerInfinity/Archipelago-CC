"""Wargroove game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)


class WargrooveGameExportHandler(GenericGameExportHandler):
    """Export handler for Wargroove.

    This handler is required to process Wargroove's complex exit rules.
    Wargroove uses set_region_exit_rules() which creates lambdas that iterate
    over location access rules - these need special handling to extract
    and analyze the underlying rules.
    """
    GAME_NAME = 'Wargroove'

    # Enable automatic export of discovered helpers
    AUTO_EXPORT_DISCOVERED_HELPERS = True

    def __init__(self, world=None):
        """Initialize handler."""
        super().__init__()
        self.world = world
        self.player = world.player if world and hasattr(world, 'player') else 1
        self.current_region = None

    def set_context(self, context_name: str):
        """Set the current region context for exit processing."""
        self.current_region = context_name

    def handle_complex_exit_rule(self, exit_name: str, exit_rule) -> Optional[Dict[str, Any]]:
        """Handle complex exit rules for Wargroove.

        Wargroove uses set_region_exit_rules() which creates lambdas like:
        lambda state: any(location.access_rule(state) for location in locations)

        We extract the locations from the lambda's closure and analyze their rules.
        """
        if not hasattr(exit_rule, '__closure__') or not exit_rule.__closure__:
            return None

        # Look for the 'locations' variable in the closure
        locations = None
        for cell in exit_rule.__closure__:
            try:
                cell_contents = cell.cell_contents
                # Check if this is a list of location objects
                if isinstance(cell_contents, list) and len(cell_contents) > 0:
                    # Check if the first item looks like a location (has access_rule)
                    if hasattr(cell_contents[0], 'access_rule'):
                        locations = cell_contents
                        break
            except (AttributeError, ValueError):
                continue

        if not locations:
            return None

        # Analyze each location's access rule
        from exporter.analyzer import analyze_rule
        location_access_rules = []

        for location in locations:
            if not hasattr(location, 'access_rule') or not location.access_rule:
                continue

            loc_name = getattr(location, 'name', 'Unknown')
            try:
                analyzed_rule = analyze_rule(
                    rule_func=location.access_rule,
                    game_handler=self,
                    player_context=self.player
                )

                if analyzed_rule and analyzed_rule.get('type') != 'error':
                    expanded_rule = self.expand_rule(analyzed_rule)
                    location_access_rules.append(expanded_rule if expanded_rule else analyzed_rule)
            except Exception as e:
                logger.warning(f"Could not analyze location rule for {loc_name}: {e}")

        # Combine rules with 'or'
        if location_access_rules:
            if len(location_access_rules) == 1:
                return location_access_rules[0]
            return {'type': 'or', 'conditions': location_access_rules}

        logger.warning(f"Found locations for exit {exit_name} from region {self.current_region} - no rules could be analyzed")
        return None
