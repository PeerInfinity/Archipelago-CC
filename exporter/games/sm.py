"""Super Metroid game-specific export handler."""

from typing import Dict, Any
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

class SMGameExportHandler(GenericGameExportHandler):
    """Export handler for Super Metroid.

    Super Metroid uses a custom SMBoolManager system for its logic.
    The rules are wrapped in self.evalSMBool() calls with helper functions.

    This exporter transforms the Python-specific patterns into JavaScript-friendly
    helper calls that the frontend can execute.
    """
    GAME_NAME = 'Super Metroid'

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand and transform Super Metroid rules.

        Transforms self.evalSMBool() function calls into direct helper calls
        that the JavaScript frontend can execute.
        """
        if not rule:
            return rule

        rule_type = rule.get('type')

        # Transform function_call nodes where function is an attribute access on 'self'
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                attr = function.get('attr')

                # Transform self.evalSMBool(...) into a helper call
                if obj.get('type') == 'name' and obj.get('name') == 'self' and attr == 'evalSMBool':
                    # Get the original arguments
                    args = rule.get('args', [])
                    # Transform into a helper call - evalSMBool will accept the same args
                    return {
                        'type': 'helper',
                        'name': 'evalSMBool',
                        'args': [self.expand_rule(arg) for arg in args]
                    }

        # Recursively process nested structures
        if rule_type == 'and' or rule_type == 'or':
            rule['conditions'] = [self.expand_rule(cond) for cond in rule.get('conditions', [])]

        if rule_type == 'not':
            if 'condition' in rule:
                rule['condition'] = self.expand_rule(rule['condition'])

        # Process helper arguments
        if rule_type == 'helper':
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]

        # Process function_call arguments (for other function calls)
        if rule_type == 'function_call':
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]

        # Process generator expressions
        if rule_type == 'generator_expression':
            if 'element' in rule:
                rule['element'] = self.expand_rule(rule['element'])

        # Process binary operations
        if rule_type == 'binary_op' or rule_type == 'compare':
            if 'left' in rule:
                rule['left'] = self.expand_rule(rule['left'])
            if 'right' in rule:
                rule['right'] = self.expand_rule(rule['right'])

        # Process conditionals
        if rule_type == 'conditional':
            if 'test' in rule:
                rule['test'] = self.expand_rule(rule['test'])
            if 'if_true' in rule and rule['if_true'] is not None:
                rule['if_true'] = self.expand_rule(rule['if_true'])
            if 'if_false' in rule and rule['if_false'] is not None:
                rule['if_false'] = self.expand_rule(rule['if_false'])

        return rule
