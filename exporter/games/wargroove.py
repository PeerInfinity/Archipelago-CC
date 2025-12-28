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
        self.current_region = None

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

        # Handle state_method calls to Wargroove's LogicMixin helpers
        if rule.get('type') == 'state_method':
            method = rule.get('method')
            args = rule.get('args', [])

            # _wargroove_has_item(player, item) -> item_check
            if method == '_wargroove_has_item' and args:
                item = args[0]
                item_name = item.get('value') if isinstance(item, dict) else item
                return {'type': 'item_check', 'item': item_name}

            # _wargroove_has_region(player, region) -> can_reach
            if method == '_wargroove_has_region' and args:
                region = args[0]
                region_name = region.get('value') if isinstance(region, dict) else region
                return {'type': 'can_reach', 'region': region_name}

            # _wargroove_has_item_and_region(player, item, region) -> and(item_check, can_reach)
            if method == '_wargroove_has_item_and_region' and len(args) >= 2:
                item = args[0]
                region = args[1]
                item_name = item.get('value') if isinstance(item, dict) else item
                region_name = region.get('value') if isinstance(region, dict) else region
                return {
                    'type': 'and',
                    'conditions': [
                        {'type': 'item_check', 'item': item_name},
                        {'type': 'can_reach', 'region': region_name}
                    ]
                }

        # Delegate compound types and other rules to parent
        return super().expand_rule(rule, _depth)
