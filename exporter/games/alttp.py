"""A Link to the Past game-specific export handler.

This exporter handles ALttP-specific patterns:
- Bunny rules: Complex dynamic rules that check if locations are accessible
  in bunny form (Dark World without Moon Pearl). These rules use lambdas
  that can't be serialized, so we simplify them to Moon Pearl requirements.
- Shop price rules: Rules that check if the player has enough resources
  to purchase items from shops.
"""

from typing import Dict, Any, Optional, List
from .generic import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)


# Locations that are accessible in bunny form (from set_bunny_rules in ALttP Rules.py)
# These locations don't require Moon Pearl even in Dark World regions
BUNNY_ACCESSIBLE_LOCATIONS = [
    "Link's Uncle", "Sahasrahla", "Sick Kid", "Lost Woods Hideout", "Lumberjack Tree",
    "Checkerboard Cave", "Potion Shop", "Spectacle Rock Cave", "Pyramid",
    "Hype Cave - Generous Guy", "Peg Cave", "Bumper Cave Ledge", "Dark Blacksmith Ruins",
    "Spectacle Rock", "Bombos Tablet", "Ether Tablet", "Purple Chest", "Blacksmith",
    "Missing Smith", "Master Sword Pedestal", "Bottle Merchant", "Sunken Treasure",
    "Desert Ledge"
]


class ALttPGameExportHandler(GenericGameExportHandler):
    """Export handler for A Link to the Past."""

    # Pattern to detect serialized bunny rule lambdas
    BUNNY_RULE_PATTERN = re.compile(r'<function set_bunny_rules\.')

    def post_process_location_rule(self, location_name: str, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process location rules to handle bunny rule lambdas.

        When bunny rules are serialized, they appear as strings like:
        "<function set_bunny_rules.<locals>.get_rule_to_add.<locals>.<lambda>>"

        We convert these to simpler rules:
        - If the location is bunny-accessible, the bunny rule part is always True
        - Otherwise, require Moon Pearl
        """
        processed_rule = self._process_bunny_rules(rule, location_name)
        return processed_rule

    def _process_bunny_rules(self, rule: Dict[str, Any], location_name: str) -> Dict[str, Any]:
        """Recursively process a rule tree to replace bunny rule lambdas."""
        if not isinstance(rule, dict):
            return rule

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

        # Check for Or/And with bunny rules in children
        if rule.get('type') in ('or', 'and'):
            conditions = rule.get('conditions', [])
            processed = [self._process_bunny_rules(c, location_name) for c in conditions]
            return {**rule, 'conditions': processed}

        # Check Rule Builder format Or/And
        if rule.get('rule') in ('Or', 'And'):
            children = rule.get('children', [])
            processed = [self._process_bunny_rules(c, location_name) for c in children]
            return {**rule, 'children': processed}

        # Check args list for nested rules
        if 'args' in rule and isinstance(rule['args'], list):
            processed_args = [self._process_bunny_rules(a, location_name) if isinstance(a, dict) else a
                            for a in rule['args']]
            return {**rule, 'args': processed_args}

        return rule

    def _get_bunny_replacement_rule(self, location_name: str) -> Dict[str, Any]:
        """Get the replacement rule for a bunny rule lambda.

        If the location is in the bunny-accessible list, return True.
        Otherwise, require Moon Pearl.
        """
        if location_name in BUNNY_ACCESSIBLE_LOCATIONS:
            logger.debug(f"ALttP: Location '{location_name}' is bunny-accessible, replacing bunny rule with True")
            return {'type': 'constant', 'value': True}
        else:
            logger.debug(f"ALttP: Location '{location_name}' requires Moon Pearl, replacing bunny rule")
            return {'type': 'item_check', 'item': 'Moon Pearl'}

    def post_process_entrance_rule(self, entrance_name: str, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Post-process entrance rules to handle bunny rule lambdas.

        Entrances with bunny rules are simplified to require Moon Pearl.
        """
        return self._process_bunny_rules(rule, entrance_name)
