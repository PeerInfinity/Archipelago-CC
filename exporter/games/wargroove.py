"""Wargroove game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class WargrooveGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Wargroove'
    """Export handler for Wargroove."""

    def __init__(self, world=None):
        """Initialize handler."""
        super().__init__()
        self.world = world
        self.player = world.player if world and hasattr(world, 'player') else 1
        self.region_to_locations = None
        self.current_region = None
        self.location_rules_cache = {}

    def set_context(self, context_name: str):
        """Set the current region context for exit processing."""
        # This is called before processing exits for a region
        # We can use this to track which region's exits we're processing
        self.current_region = context_name

    def handle_complex_exit_rule(self, exit_name: str, exit_rule) -> Optional[Dict[str, Any]]:
        """Handle complex exit rules for Wargroove."""
        # Build mapping of regions to their locations (lazy initialization)
        if self.region_to_locations is None:
            self._build_region_location_mapping()

        # The current region should have been set via set_context
        # For Wargroove, the exit rules use any(location.access_rule(state) for location in locations)
        # We need to look up the actual location access rules and combine them with 'or'

        if self.current_region and self.current_region in self.region_to_locations:
            location_names = self.region_to_locations[self.current_region]

            # Get the access rules for each location
            # We need to import safe_expand_rule from the exporter module
            import exporter.exporter as exp_module
            location_access_rules = []
            for loc_name in location_names:
                # Look up the location in the world
                if self.world:
                    try:
                        from BaseClasses import MultiWorld
                        multiworld = getattr(self.world, 'multiworld', None)
                        if multiworld and isinstance(multiworld, MultiWorld):
                            location = multiworld.get_location(loc_name, self.player)
                            if hasattr(location, 'access_rule') and location.access_rule:
                                # Analyze the location's access rule
                                loc_rule = exp_module.safe_expand_rule(
                                    self,
                                    location.access_rule,
                                    loc_name,
                                    target_type='Location',
                                    world=self.world
                                )
                                if loc_rule:
                                    location_access_rules.append(loc_rule)
                    except Exception as e:
                        logger.debug(f"Could not get location rule for {loc_name}: {e}")

            # If we got location rules, combine them with 'or'
            if location_access_rules:
                if len(location_access_rules) == 1:
                    return location_access_rules[0]
                else:
                    return {'type': 'or', 'conditions': location_access_rules}

            # Fallback to True if we couldn't get location rules
            return {'type': 'constant', 'value': True}

        return None  # Let normal analysis proceed

    def _build_region_location_mapping(self):
        """Build a mapping of region names to their location lists based on Rules.py."""
        # This mapping is based on the set_region_exit_rules calls in Rules.py
        self.region_to_locations = {
            'Humble Beginnings': ['Humble Beginnings: Victory'],
            'Best Friendssss': ['Best Friendssss: Victory'],
            'A Knight\'s Folly': ['A Knight\'s Folly: Victory'],
            'Denrunaway': ['Denrunaway: Victory'],
            'Dragon Freeway': ['Dragon Freeway: Victory'],
            'Deep Thicket': ['Deep Thicket: Victory'],
            'Corrupted Inlet': ['Corrupted Inlet: Victory'],
            'Mage Mayhem': ['Mage Mayhem: Victory'],
            'Endless Knight': ['Endless Knight: Victory'],
            'Ambushed in the Middle': ['Ambushed in the Middle: Victory (Blue)', 'Ambushed in the Middle: Victory (Green)'],
            'The Churning Sea': ['The Churning Sea: Victory'],
            'Frigid Archery': ['Frigid Archery: Victory'],
            'Archery Lessons': ['Archery Lessons: Victory'],
        }

    def expand_helper(self, helper_name: str):
        """Expand game-specific helper functions for Wargroove."""
        # Start with generic expansion
        # Will add game-specific helpers as we discover them during testing
        return super().expand_helper(helper_name)
