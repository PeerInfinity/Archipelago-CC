"""Super Metroid game-specific export handler."""

from typing import Dict, Any, Optional
from .generic import GenericGameExportHandler
import logging

logger = logging.getLogger(__name__)

print("[SM MODULE] Loading Super Metroid exporter handler")

class SMGameExportHandler(GenericGameExportHandler):
    """Export handler for Super Metroid.

    Super Metroid uses a custom SMBoolManager system for its logic.
    The rules are wrapped in self.evalSMBool() calls with helper functions.

    This exporter transforms the Python-specific patterns into JavaScript-friendly
    helper calls that the frontend can execute.
    """
    GAME_NAME = 'Super Metroid'

    def __init__(self, world=None):
        print(f"[SM] SMGameExportHandler initialized for {self.GAME_NAME}")
        super().__init__()  # Base class doesn't take arguments
        self.world = world

    def _check_smbool_true_pattern(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule represents SMBool(True) construction."""
        if not rule:
            return False

        rule_type = rule.get('type')

        # Check for function_call type (original pattern)
        if rule_type == 'function_call':
            func = rule.get('function', {})
            if func.get('type') != 'name' or func.get('name') != 'SMBool':
                return False

            args = rule.get('args', [])
            if not args:
                return False

            # Check if first arg is constant True
            first_arg = args[0]
            return (first_arg.get('type') == 'constant' and
                    first_arg.get('value') is True)

        # Check for helper type (analyzer converts to this)
        elif rule_type == 'helper':
            if rule.get('name') != 'SMBool':
                return False

            args = rule.get('args', [])
            if not args:
                return False

            # Check if first arg is constant True
            first_arg = args[0]
            return (first_arg.get('type') == 'constant' and
                    first_arg.get('value') is True)

        return False

    def _try_simplify_evalSMBool(self, args: list) -> Optional[Dict[str, Any]]:
        """Try to simplify evalSMBool calls if possible.

        Super Metroid uses VARIA logic system (sm.wor, sm.canFly, etc.) which
        is complex. We'll try to export the actual logic so the frontend can
        evaluate it properly.

        For now, we DON'T simplify - we let the actual rule structure pass through.
        """
        # Don't simplify - return None to indicate no simplification
        logger.debug("SM: NOT simplifying evalSMBool call - preserving actual logic")
        return None

    _expand_call_count = 0

    def _check_accessFrom_pattern(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule is the problematic accessFrom comprehension pattern.

        The pattern is: any_of with iterator_info that references accessFrom variable.
        These rules hit recursion limits and create corrupted rule structures.
        """
        if not rule or rule.get('type') != 'any_of':
            return False

        # Check for iterator_info
        iterator_info = rule.get('iterator_info', {})
        if not iterator_info:
            return False

        # Check if iterator references accessFrom
        iterator = iterator_info.get('iterator', {})
        if iterator.get('type') == 'function_call':
            func = iterator.get('function', {})
            if func.get('type') == 'attribute':
                obj = func.get('object', {})
                attr = func.get('attr')
                # Pattern: accessFrom.items()
                if (obj.get('type') == 'name' and
                    obj.get('name') == 'accessFrom' and
                    attr == 'items'):
                    return True

        return False

    def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively expand and transform Super Metroid rules.

        Transforms self.evalSMBool() function calls into direct helper calls
        that the JavaScript frontend can execute. Also simplifies common patterns.
        """
        # Debug: Print first few calls to understand what's coming in
        SMGameExportHandler._expand_call_count += 1
        if SMGameExportHandler._expand_call_count <= 5:
            print(f"[SM expand_rule #{SMGameExportHandler._expand_call_count}] Called with rule type: {rule.get('type') if rule else 'None'}")

        if not rule:
            return rule

        rule_type = rule.get('type')

        # Simplify accessFrom patterns that hit recursion limits
        if self._check_accessFrom_pattern(rule):
            logger.info("SM: Found accessFrom comprehension pattern, simplifying to constant True")
            print("[SM] Simplifying accessFrom pattern to constant True")
            return {'type': 'constant', 'value': True}

        # Handle helper nodes with name='evalSMBool' (analyzer converts self.evalSMBool to helper)
        if rule_type == 'helper' and rule.get('name') == 'evalSMBool':
            # Don't simplify - preserve the evalSMBool helper call
            # but expand its arguments
            print("[SM] Preserving evalSMBool helper (not simplifying)")
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]
            return rule

        # Transform function_call nodes where function is an attribute access on 'self'
        # (This is kept for compatibility but may not be needed if analyzer converts to helper)
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                attr = function.get('attr')

                # Transform self.evalSMBool(...) into helper call
                if obj.get('type') == 'name' and obj.get('name') == 'self' and attr == 'evalSMBool':
                    # Convert to helper call and expand arguments
                    print("[SM] Converting evalSMBool function_call to helper (not simplifying)")
                    expanded_args = [self.expand_rule(arg) for arg in rule.get('args', [])]
                    return {'type': 'helper', 'name': 'evalSMBool', 'args': expanded_args}

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

        # Process any_of and all_of (list comprehensions)
        if rule_type == 'any_of' or rule_type == 'all_of':
            if 'element_rule' in rule:
                rule['element_rule'] = self.expand_rule(rule['element_rule'])
            # Also expand iterator_info if present
            if 'iterator_info' in rule:
                iterator_info = rule['iterator_info']
                if 'iterator' in iterator_info:
                    iterator_info['iterator'] = self.expand_rule(iterator_info['iterator'])
                if 'target' in iterator_info:
                    iterator_info['target'] = self.expand_rule(iterator_info['target'])

        return rule
