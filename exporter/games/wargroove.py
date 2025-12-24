"""Wargroove game-specific export handler.

Wargroove uses LogicMixin methods (_wargroove_has_item, _wargroove_has_region,
_wargroove_has_item_and_region) that are expanded inline to their underlying
rule types during export.
"""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class WargrooveGameExportHandler(GenericGameExportHandler):
    """Export handler for Wargroove.

    Wargroove's LogicMixin methods are expanded inline during export:
    - _wargroove_has_item(player, item) -> item_check
    - _wargroove_has_region(player, region) -> can_reach
    - _wargroove_has_item_and_region(player, item, region) -> and(item_check, can_reach)
    """

    def __init__(self, world=None):
        """Initialize handler."""
        super().__init__(world=world)
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
        """Handle complex exit rules for Wargroove.

        Wargroove uses set_region_exit_rules() which creates lambdas like:
        lambda state: any(location.access_rule(state) for location in locations)

        We need to extract the locations from the lambda's closure and analyze their rules.
        """
        # Try to extract locations from the lambda's closure
        if hasattr(exit_rule, '__closure__') and exit_rule.__closure__:
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

            # If we found locations, analyze their access rules
            if locations:
                from exporter.analyzer import analyze_rule
                location_access_rules = []

                for location in locations:
                    if hasattr(location, 'access_rule') and location.access_rule:
                        loc_name = getattr(location, 'name', 'Unknown')
                        try:
                            # Get the raw access rule function
                            access_rule_func = location.access_rule

                            # Analyze it with the proper context
                            analyzed_rule = analyze_rule(
                                rule_func=access_rule_func,
                                game_handler=self,
                                player_context=self.player
                            )

                            if analyzed_rule and analyzed_rule.get('type') != 'error':
                                # Expand the rule using the game handler
                                expanded_rule = self.expand_rule(analyzed_rule)
                                if expanded_rule:
                                    location_access_rules.append(expanded_rule)
                                else:
                                    # If expansion failed, use the analyzed rule as-is
                                    location_access_rules.append(analyzed_rule)
                        except Exception as e:
                            logger.warning(f"Could not analyze location rule for {loc_name}: {e}")
                            # Try to continue with other locations

                # If we got location rules, combine them with 'or'
                if location_access_rules:
                    if len(location_access_rules) == 1:
                        return location_access_rules[0]
                    else:
                        return {'type': 'or', 'conditions': location_access_rules}
                else:
                    # If we found locations but couldn't analyze their rules, log a warning
                    logger.warning(f"Found locations for exit {exit_name} from region {self.current_region} - no rules could be analyzed")

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

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Expand Wargroove rules, inlining LogicMixin helper methods.

        Transforms state_method calls to Wargroove's LogicMixin methods into
        their underlying rule types:
        - _wargroove_has_item(player, item) -> item_check
        - _wargroove_has_region(player, region) -> can_reach
        - _wargroove_has_item_and_region(player, item, region) -> and(item_check, can_reach)
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Handle state_method calls to Wargroove's LogicMixin helpers
        if rule_type == 'state_method':
            method = rule.get('method')
            args = rule.get('args', [])

            # _wargroove_has_item(player, item) -> item_check
            if method == '_wargroove_has_item' and len(args) >= 1:
                item_arg = args[0]
                # Extract the item name from the constant
                if isinstance(item_arg, dict) and item_arg.get('type') == 'constant':
                    item_name = item_arg.get('value')
                else:
                    item_name = item_arg
                logger.debug(f"Expanding _wargroove_has_item to item_check: {item_name}")
                return {'type': 'item_check', 'item': item_name}

            # _wargroove_has_region(player, region) -> can_reach
            if method == '_wargroove_has_region' and len(args) >= 1:
                region_arg = args[0]
                # Extract the region name from the constant
                if isinstance(region_arg, dict) and region_arg.get('type') == 'constant':
                    region_name = region_arg.get('value')
                else:
                    region_name = region_arg
                logger.debug(f"Expanding _wargroove_has_region to can_reach: {region_name}")
                return {'type': 'can_reach', 'region': region_name}

            # _wargroove_has_item_and_region(player, item, region) -> and(item_check, can_reach)
            if method == '_wargroove_has_item_and_region' and len(args) >= 2:
                item_arg = args[0]
                region_arg = args[1]
                # Extract the item name
                if isinstance(item_arg, dict) and item_arg.get('type') == 'constant':
                    item_name = item_arg.get('value')
                else:
                    item_name = item_arg
                # Extract the region name
                if isinstance(region_arg, dict) and region_arg.get('type') == 'constant':
                    region_name = region_arg.get('value')
                else:
                    region_name = region_arg
                logger.debug(f"Expanding _wargroove_has_item_and_region: item={item_name}, region={region_name}")
                return {
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': item_name},
                        {'type': 'can_reach', 'region': region_name}
                    ]
                }

        # For compound types (and, or), recursively expand children
        if rule_type in ('and', 'or'):
            conditions = rule.get('conditions', [])
            expanded_conditions = [self.expand_rule(c, _depth + 1) for c in conditions]
            return {'type': rule_type, 'conditions': expanded_conditions}

        # For other types, delegate to parent
        return super().expand_rule(rule, _depth)
