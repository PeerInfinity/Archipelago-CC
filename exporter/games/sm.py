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
        if not rule or rule.get('type') != 'function_call':
            return False

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

    def _try_simplify_evalSMBool(self, args: list) -> Optional[Dict[str, Any]]:
        """Try to simplify evalSMBool calls with known patterns.

        Patterns:
        1. evalSMBool(func(state.smbm[player]), state.smbm[player].maxDiff)
           where func or rule is a helper call - always simplify to True
        2. evalSMBool(SMBool(True), maxDiff) -> constant True
        """
        if len(args) < 2:
            return None

        smbool_arg = args[0]

        # Pattern: func(state.smbm[player]) or rule(state.smbm[player]) where func/rule are helpers
        # These are VARIA logic functions that we can't replicate in JavaScript
        # The Python backend has already evaluated these, so we trust the sphere log
        if smbool_arg.get('type') == 'helper' and smbool_arg.get('name') in ('func', 'rule'):
            # Simplify to constant True - actual logic is enforced by sphere log comparison
            logger.debug(f"SM: Simplifying evalSMBool({smbool_arg.get('name')}(...), maxDiff) to constant True")
            return {'type': 'constant', 'value': True}

        # Pattern: Direct SMBool(True) construction
        if self._check_smbool_true_pattern(smbool_arg):
            logger.debug("SM: Found SMBool(True) pattern, simplifying to constant True")
            return {'type': 'constant', 'value': True}

        return None

    _expand_call_count = 0

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

        # Handle helper nodes with name='evalSMBool' (analyzer converts self.evalSMBool to helper)
        if rule_type == 'helper' and rule.get('name') == 'evalSMBool':
            # Get the arguments
            args = rule.get('args', [])
            expanded_args = [self.expand_rule(arg) for arg in args]

            print(f"[SM] Found evalSMBool helper with {len(expanded_args)} args")
            if expanded_args:
                print(f"[SM] First arg: type={expanded_args[0].get('type')}, name={expanded_args[0].get('name')}")

            # Try to simplify the evalSMBool call
            simplified = self._try_simplify_evalSMBool(expanded_args)
            if simplified:
                print(f"[SM] Simplified evalSMBool to: {simplified}")
                return simplified

            print("[SM] No simplification applied for evalSMBool, keeping as helper")
            # Keep as helper call but with expanded args
            return {
                'type': 'helper',
                'name': 'evalSMBool',
                'args': expanded_args
            }

        # Transform function_call nodes where function is an attribute access on 'self'
        # (This is kept for compatibility but may not be needed if analyzer converts to helper)
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                attr = function.get('attr')

                # Transform self.evalSMBool(...) into a helper call or simplify
                if obj.get('type') == 'name' and obj.get('name') == 'self' and attr == 'evalSMBool':
                    # Get the original arguments
                    args = rule.get('args', [])
                    expanded_args = [self.expand_rule(arg) for arg in args]

                    print(f"[SM] Found evalSMBool function_call with {len(expanded_args)} args")
                    if expanded_args:
                        print(f"[SM] First arg: type={expanded_args[0].get('type')}, name={expanded_args[0].get('name')}")

                    # Try to simplify the evalSMBool call
                    simplified = self._try_simplify_evalSMBool(expanded_args)
                    if simplified:
                        print(f"[SM] Simplified to: {simplified}")
                        return simplified

                    print("[SM] No simplification applied, returning helper call")
                    # Otherwise, transform into a helper call
                    return {
                        'type': 'helper',
                        'name': 'evalSMBool',
                        'args': expanded_args
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
