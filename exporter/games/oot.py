"""Ocarina of Time game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging
import re

logger = logging.getLogger(__name__)

class OOTGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Ocarina of Time'

    def __init__(self):
        super().__init__()
        self.rule_string_map = {}  # Maps rule_target_name -> rule_string
        self.world = None

    def build_rule_string_map(self, world):
        """Build a mapping of location/entrance names to their rule strings."""
        self.world = world
        self.rule_string_map = {}

        # Collect rule strings from all locations
        for region in world.get_regions():
            for location in region.locations:
                if hasattr(location, 'rule_string') and location.rule_string:
                    self.rule_string_map[location.name] = location.rule_string

            # Collect rule strings from all exits/entrances
            for exit in region.exits:
                if hasattr(exit, 'rule_string') and exit.rule_string:
                    self.rule_string_map[exit.name] = exit.rule_string

        logger.info(f"OOT: Built rule string map with {len(self.rule_string_map)} entries")

    def override_rule_analysis(self, rule_func, rule_target_name: str = None) -> Optional[Dict[str, Any]]:
        """Override rule analysis to use OOT's rule strings instead of analyzing lambdas."""
        if not rule_target_name:
            return None

        # Look up the rule string for this location/entrance
        rule_string = self.rule_string_map.get(rule_target_name)
        if not rule_string:
            logger.debug(f"OOT: No rule string found for {rule_target_name}")
            return None

        # Remove comments and strip
        rule_string = rule_string.split('#', 1)[0].strip()

        logger.debug(f"OOT: Parsing rule string for {rule_target_name}: {rule_string[:100]}")

        try:
            # Parse the rule string into a JSON-compatible format
            return self.parse_oot_rule_string(rule_string)
        except Exception as e:
            logger.error(f"OOT: Failed to parse rule string for {rule_target_name}: {e}")
            logger.debug(f"OOT: Rule string was: {rule_string}")
            return None

    def parse_oot_rule_string(self, rule_string: str) -> Dict[str, Any]:
        """
        Parse OOT's custom rule DSL into JSON format.

        Examples:
        - "True" -> {"type": "constant", "value": True}
        - "is_adult" -> {"type": "helper", "name": "is_adult"}
        - "is_adult and Hover_Boots" -> {"type": "and", "conditions": [...]}
        """
        # Handle simple constants
        if rule_string == "True":
            return {"type": "constant", "value": True}
        if rule_string == "False":
            return {"type": "constant", "value": False}

        # For now, return a placeholder helper that includes the original rule string
        # This will allow us to see what rules are being used and implement them progressively
        return {
            "type": "helper",
            "name": "parse_oot_rule",
            "args": [
                {"type": "constant", "value": rule_string}
            ]
        }

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Expand OOT-specific rules, handling special closure variables."""
        if not rule:
            return rule

        # Handle the special 'rule' and 'old_rule' helpers from add_rule/exclusion_rules
        # These are closure variables from worlds/generic/Rules.py that can't be analyzed
        # When they appear as helpers with no args, we need to handle them specially
        if rule.get('type') == 'helper' and rule.get('name') in ['rule', 'old_rule']:
            # These are typically from add_rule() which combines rules
            # When old_rule is the default (empty) rule, it returns True
            # Since we can't analyze them, we'll treat them as always-true
            logger.debug(f"Replacing unanalyzable helper '{rule['name']}' with constant True")
            return {'type': 'constant', 'value': True}

        # Handle 'and' conditions that contain rule/old_rule
        if rule.get('type') == 'and':
            conditions = rule.get('conditions', [])
            # Expand each condition first
            expanded_conditions = [self.expand_rule(cond) for cond in conditions]
            # Filter out constant True values (they don't affect AND logic)
            filtered_conditions = [
                cond for cond in expanded_conditions
                if not (cond.get('type') == 'constant' and cond.get('value') is True)
            ]
            # If all conditions were removed, return True
            if not filtered_conditions:
                return {'type': 'constant', 'value': True}
            # If only one condition remains, return it directly
            if len(filtered_conditions) == 1:
                return filtered_conditions[0]
            # Otherwise return the simplified AND
            return {'type': 'and', 'conditions': filtered_conditions}

        # Handle 'or' conditions
        if rule.get('type') == 'or':
            conditions = rule.get('conditions', [])
            expanded_conditions = [self.expand_rule(cond) for cond in conditions]
            # If any condition is constant False, remove it (doesn't affect OR logic)
            filtered_conditions = [
                cond for cond in expanded_conditions
                if not (cond.get('type') == 'constant' and cond.get('value') is False)
            ]
            if not filtered_conditions:
                return {'type': 'constant', 'value': False}
            if len(filtered_conditions) == 1:
                return filtered_conditions[0]
            return {'type': 'or', 'conditions': filtered_conditions}

        # Handle 'not' conditions
        if rule.get('type') == 'not':
            if 'condition' in rule:
                rule['condition'] = self.expand_rule(rule['condition'])
            if 'conditions' in rule:
                rule['conditions'] = [self.expand_rule(cond) for cond in rule['conditions']]

        # Handle function_call nodes - recursively expand the function and args
        if rule.get('type') == 'function_call':
            if 'function' in rule:
                rule['function'] = self.expand_rule(rule['function'])
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]

        return super().expand_rule(rule)
