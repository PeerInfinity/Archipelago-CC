"""Ocarina of Time game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class OOTGameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Ocarina of Time'

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
