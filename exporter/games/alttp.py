"""A Link to the Past game-specific export handler.

This exporter handles ALttP-specific patterns:
- Bunny rules: Complex dynamic rules that check if locations are accessible
  in bunny form (Dark World without Moon Pearl). These rules use lambdas
  that can't be serialized, so we simplify them to Moon Pearl requirements.
- Shop price rules: Rules that check if the player has enough resources
  to purchase items from shops.
"""

from typing import Dict, Any, Optional, List, Set
from .generic import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)


# Locations that are accessible in bunny form (from set_bunny_rules in ALttP Rules.py)
# These locations don't require Moon Pearl even in Dark World regions
BUNNY_ACCESSIBLE_LOCATIONS = {
    "Link's Uncle", "Sahasrahla", "Sick Kid", "Lost Woods Hideout", "Lumberjack Tree",
    "Checkerboard Cave", "Potion Shop", "Spectacle Rock Cave", "Pyramid",
    "Hype Cave - Generous Guy", "Peg Cave", "Bumper Cave Ledge", "Dark Blacksmith Ruins",
    "Spectacle Rock", "Bombos Tablet", "Ether Tablet", "Purple Chest", "Blacksmith",
    "Missing Smith", "Master Sword Pedestal", "Bottle Merchant", "Sunken Treasure",
    "Desert Ledge"
}



class ALttPGameExportHandler(GenericGameExportHandler):
    """Export handler for A Link to the Past."""

    # Pattern to detect serialized bunny rule lambdas
    BUNNY_RULE_PATTERN = re.compile(r'<function set_bunny_rules\.')

    def __init__(self, world=None):
        """Initialize with optional world reference."""
        super().__init__(world)
        self._current_location_context = None
        self._bunny_accessible_locations = self._compute_bunny_accessible_locations(world)

    def _compute_bunny_accessible_locations(self, world) -> Set[str]:
        """Compute the set of bunny-accessible locations based on world options.

        The bunny-accessible list is the set of locations that never require Moon Pearl.
        These are locations that can be accessed in bunny form regardless of game mode
        or glitch settings.

        Note: ALttP has complex path-dependent bunny rules for glitch modes that can't
        be easily replicated. The original rules check entrance paths and add options
        for superbunny or mirror accessibility. We simplify to the basic set of always-
        accessible locations to avoid logic mismatches.
        """
        # Return the static set - glitch modes have complex path-dependent rules
        # that can't be simplified to a location list
        return set(BUNNY_ACCESSIBLE_LOCATIONS)

    def set_location_context(self, location_name: str) -> None:
        """Set the current location context for rule analysis."""
        self._current_location_context = location_name

    def override_rule_analysis(self, rule_func, rule_target_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Intercept bunny rules before standard analysis.

        Bunny rules are complex lambdas created by set_bunny_rules() that can't be
        properly analyzed because they contain nested lambdas and dynamic path lookups.
        We detect these by checking the function's qualified name and replace them
        with simpler rules.
        """
        if rule_func is None:
            return None

        # Check if this is a bunny rule lambda by its qualified name
        func_qualname = getattr(rule_func, '__qualname__', '')
        if 'set_bunny_rules' in func_qualname:
            location_name = rule_target_name or self._current_location_context or ''
            logger.debug(f"ALttP: Intercepting bunny rule for '{location_name}'")
            return self._get_bunny_replacement_rule(location_name)

        # Not a bunny rule - let standard analysis handle it
        return None

    def post_process_location_data(self, location_data: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """Post-process location data to handle bunny rule lambdas.

        When bunny rules are serialized, they appear as strings like:
        "<function set_bunny_rules.<locals>.get_rule_to_add.<locals>.<lambda>>"

        We convert these to simpler rules:
        - If the location is bunny-accessible, the bunny rule part is always True
        - Otherwise, require Moon Pearl

        Note: Most bunny rules are now intercepted earlier by override_rule_analysis,
        but this handles any that slip through in serialized form.
        """
        if 'access_rule' in location_data and location_data['access_rule']:
            location_data['access_rule'] = self._process_bunny_rules(
                location_data['access_rule'], location_name
            )
        return location_data

    def _process_bunny_rules(self, rule: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """Recursively process a rule tree to replace bunny rule lambdas."""
        if not isinstance(rule, dict):
            return rule


        # Check if this is a constant with a list of bunny rule lambdas
        # This handles the AST_any_of iterator case
        if rule.get('type') == 'constant':
            value = rule.get('value')
            if isinstance(value, list) and any(
                isinstance(v, str) and self.BUNNY_RULE_PATTERN.search(v)
                for v in value
            ):
                # Replace entire constant with bunny replacement rule
                return self._get_bunny_replacement_rule(location_name)

        # Check if this is an item_check with a bunny rule lambda string
        if rule.get('type') == 'item_check':
            item = rule.get('item', '')
            if isinstance(item, str) and self.BUNNY_RULE_PATTERN.search(item):
                return self._get_bunny_replacement_rule(location_name)

        # Check Rule Builder format Has with bunny rule lambda
        if rule.get('rule') == 'Has':
            args = rule.get('args', {})
            item_name = args.get('item_name', '')
            if isinstance(item_name, str) and self.BUNNY_RULE_PATTERN.search(item_name):
                return self._get_bunny_replacement_rule(location_name)

        # Check for AST_any_of with bunny rules in iterator
        if rule.get('rule') == 'AST_any_of' or rule.get('type') == 'any_of':
            args = rule.get('args', {})
            iterator_info = args.get('iterator_info', rule.get('iterator_info', {}))
            iterator = iterator_info.get('iterator', {})
            if iterator.get('type') == 'constant':
                value = iterator.get('value', [])
                if isinstance(value, list) and any(
                    isinstance(v, str) and self.BUNNY_RULE_PATTERN.search(v)
                    for v in value
                ):
                    # This entire any_of is a bunny rule - replace it
                    return self._get_bunny_replacement_rule(location_name)
            # Also check nested element_rule
            element_rule = args.get('element_rule', rule.get('element_rule', {}))
            if element_rule:
                processed_element = self._process_bunny_rules(element_rule, location_name)
                if processed_element != element_rule:
                    # If we replaced something in element_rule, check if it's now a simple rule
                    if processed_element.get('type') in ('constant', 'item_check'):
                        return processed_element
                    if 'args' in rule:
                        args = {**args, 'element_rule': processed_element}
                        return {**rule, 'args': args}
                    else:
                        return {**rule, 'element_rule': processed_element}

        # Check for Or/And with bunny rules in children
        if rule.get('type') in ('or', 'and'):
            conditions = rule.get('conditions', [])
            processed = [self._process_bunny_rules(c, location_name) for c in conditions]
            # If all conditions simplified to True, return True
            if all(c.get('type') == 'constant' and c.get('value') == True for c in processed):
                return {'type': 'constant', 'value': True}
            return {**rule, 'conditions': processed}

        # Check Rule Builder format Or/And
        if rule.get('rule') in ('Or', 'And'):
            children = rule.get('children', [])
            processed = [self._process_bunny_rules(c, location_name) for c in children]
            # If all children simplified to True_, return True_
            if all(c.get('rule') == 'True_' or (c.get('type') == 'constant' and c.get('value') == True)
                   for c in processed):
                return {'rule': 'True_'}
            return {**rule, 'children': processed}

        # Check args dict for nested rules (different from args list)
        if 'args' in rule and isinstance(rule['args'], dict):
            processed_args = {}
            for key, value in rule['args'].items():
                if isinstance(value, dict):
                    processed_args[key] = self._process_bunny_rules(value, location_name)
                else:
                    processed_args[key] = value
            return {**rule, 'args': processed_args}

        # Check args list for nested rules
        if 'args' in rule and isinstance(rule['args'], list):
            processed_args = [self._process_bunny_rules(a, location_name) if isinstance(a, dict) else a
                            for a in rule['args']]
            return {**rule, 'args': processed_args}

        return rule

    def _get_bunny_replacement_rule(self, location_name: str, region_name: str = None) -> Dict[str, Any]:
        """Get the replacement rule for a bunny rule lambda.

        Returns a bunny_accessibility_check rule that evaluates at runtime based on:
        - Current game mode (inverted or not)
        - Glitch mode settings
        - Path availability from link regions

        For locations that are always bunny-accessible (like outdoors locations that
        don't require any actions), returns True directly.
        """
        if location_name in self._bunny_accessible_locations:
            logger.debug(f"ALttP: Location '{location_name}' is always bunny-accessible")
            return {'type': 'constant', 'value': True}
        else:
            logger.debug(f"ALttP: Location '{location_name}' requires Moon Pearl (simplified bunny rule)")
            # For non-bunny-accessible locations in bunny regions, require Moon Pearl
            # This is a simplification - the original uses path-dependent checks
            return {
                'rule': 'Has',
                'args': {'item_name': 'Moon Pearl'}
            }

    def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process entire export data to handle bunny rules in entrances/exits.

        The post_process_location_data hook handles locations, but entrances/exits
        need to be processed here since there's no per-entrance hook.
        """
        # Process regions to handle entrance/exit rules
        regions = data.get('regions', {})
        for player_id, player_regions in regions.items():
            for region_name, region_data in player_regions.items():
                # Process exits
                for exit_data in region_data.get('exits', []):
                    exit_name = exit_data.get('name', region_name)
                    if 'access_rule' in exit_data and exit_data['access_rule']:
                        exit_data['access_rule'] = self._process_bunny_rules(
                            exit_data['access_rule'], exit_name
                        )
                # Process entrances
                for entrance_data in region_data.get('entrances', []):
                    entrance_name = entrance_data.get('name', region_name)
                    if 'access_rule' in entrance_data and entrance_data['access_rule']:
                        entrance_data['access_rule'] = self._process_bunny_rules(
                            entrance_data['access_rule'], entrance_name
                        )
        return data
