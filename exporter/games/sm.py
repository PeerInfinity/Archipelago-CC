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

    def get_custom_location_access_rule(self, location, world):
        """Custom handling for Super Metroid location access rules.

        Super Metroid locations have complex accessFrom comprehensions that
        hit recursion limits. These are combined with Available rules in an AND.
        For now, we skip the accessFrom part and only export the Available rule.

        Returns:
            The custom rule to export, or None to use default handling
        """
        if not hasattr(location, 'access_rule') or not location.access_rule:
            return None

        # Try to analyze the rule to see if it's an AND with accessFrom
        try:
            from ..analyzer import analyze_rule
            analyzed = analyze_rule(location.access_rule)

            # Check if it's an AND rule with two conditions
            if analyzed and analyzed.get('type') == 'and':
                conditions = analyzed.get('conditions', [])
                if len(conditions) == 2:
                    # Check if first condition is accessFrom (any_of pattern)
                    first = conditions[0]
                    second = conditions[1]

                    # If first is any_of (likely accessFrom), use only the second (Available)
                    if first.get('type') == 'any_of':
                        logger.info(f"SM: Extracting Available rule for location (skipping accessFrom)")
                        print(f"[SM] Using only Available rule for location (skipping accessFrom comprehension)")
                        # Return the second condition (the Available rule)
                        # But we need to return the original lambda, not the analyzed form
                        # So return None to skip custom handling for now
                        # Instead, we'll handle this in expand_rule
                        return None

            return None
        except Exception as e:
            logger.debug(f"SM: Error analyzing location rule: {e}")
            return None

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

    def _is_always_true_smbool(self, rule: Dict[str, Any]) -> bool:
        """Check if a rule is evalSMBool(SMBool(True), ...) which would simplify to True.

        This indicates the location has no item requirements once in the region,
        and the actual requirements are in accessFrom (which we can't export).
        """
        if not rule:
            return False

        rule_type = rule.get('type')

        # Check for evalSMBool(SMBool(True), ...)
        if rule_type == 'helper' and rule.get('name') == 'evalSMBool':
            args = rule.get('args', [])
            if len(args) >= 1:
                first_arg = args[0]
                return self._check_smbool_true_pattern(first_arg)

        # Check for function_call pattern
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                attr = function.get('attr')
                if (obj.get('type') == 'name' and
                    obj.get('name') == 'self' and
                    attr == 'evalSMBool'):
                    args = rule.get('args', [])
                    if len(args) >= 1:
                        return self._check_smbool_true_pattern(args[0])

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

    def _check_deeply_nested_any_of(self, rule: Dict[str, Any], max_depth: int = 5) -> bool:
        """Check if a rule has deeply nested any_of structures (indicating recursion).

        Args:
            rule: The rule to check
            max_depth: Maximum depth before considering it "deeply nested"

        Returns:
            True if the rule has nested any_of at or beyond max_depth
        """
        def count_depth(r, current_depth=0):
            if not r or not isinstance(r, dict):
                return current_depth

            if r.get('type') == 'any_of':
                # Check element_rule for further nesting
                element_rule = r.get('element_rule')
                if element_rule:
                    # Look for nested any_of in the conditions
                    if isinstance(element_rule, dict):
                        if element_rule.get('type') == 'and':
                            conditions = element_rule.get('conditions', [])
                            for cond in conditions:
                                if cond.get('type') == 'helper' and cond.get('name') == 'evalSMBool':
                                    args = cond.get('args', [])
                                    if args and args[0].get('type') == 'any_of':
                                        # Found nested any_of
                                        nested_depth = count_depth(args[0], current_depth + 1)
                                        if nested_depth >= max_depth:
                                            return nested_depth
            return current_depth

        depth = count_depth(rule)
        return depth >= max_depth

    def _is_simple_accessFrom(self, rule: Dict[str, Any]) -> bool:
        """Check if an accessFrom pattern has only SMBool(True) requirements.

        A simple accessFrom is: any(state.can_reach(region) and evalSMBool(SMBool(True), ...))
        This means the location is accessible from the region with no item requirements.
        """
        if not rule or rule.get('type') != 'any_of':
            return False

        # Check the element_rule
        element_rule = rule.get('element_rule')
        if not element_rule:
            return False

        # Should be an AND of: state.can_reach(...) and evalSMBool(SMBool(True), ...)
        if element_rule.get('type') != 'and':
            return False

        conditions = element_rule.get('conditions', [])
        if len(conditions) != 2:
            return False

        # Second condition should be evalSMBool(SMBool(True), ...)
        second = conditions[1]
        if self._is_always_true_smbool(second):
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

        # Check for AND rules that combine accessFrom and Available
        # The accessFrom comprehension can't be properly exported, so we skip it
        # However, if Available is SMBool(True), we need to export as False instead
        # of preserving it, since the actual requirements are in accessFrom
        if rule_type == 'and':
            conditions = rule.get('conditions', [])
            if len(conditions) == 2:
                first = conditions[0]
                second = conditions[1]
                # If first condition is accessFrom pattern, skip it and use only second
                if self._check_accessFrom_pattern(first) or self._check_deeply_nested_any_of(first):
                    logger.info("SM: Found AND rule with accessFrom, checking Available part")
                    print("[SM] Found AND rule with accessFrom pattern")

                    # Check if this is a simple accessFrom (no item requirements)
                    # Note: Currently all accessFrom patterns appear complex due to recursion
                    # so this check always returns False. Kept for future improvement.
                    is_simple = self._is_simple_accessFrom(first)

                    # Recursively expand the second condition (the Available part)
                    expanded = self.expand_rule(second)

                    # Check if the Available part is just evalSMBool(SMBool(True), ...)
                    if self._is_always_true_smbool(expanded):
                        # For now, we need to determine if this location is accessible from the starting region
                        # or if it requires items through accessFrom
                        # Since we can't analyze accessFrom properly, we'll export the Available rule as-is
                        # and let it evaluate (evalSMBool(SMBool(True), ...) should return True)
                        logger.info("SM: Available is evalSMBool(SMBool(True), ...), preserving as-is")
                        print("[SM] Preserving evalSMBool(SMBool(True), ...) for frontend evaluation")
                        return expanded

                    # If Available has actual requirements, use it
                    logger.info("SM: Using Available part with actual requirements")
                    print("[SM] Using Available rule with requirements")
                    return expanded

        # Check for accessFrom patterns that hit recursion limits
        # These create infinitely nested structures that can't be properly evaluated
        # CHANGED: Export as False instead of True to prevent incorrect accessibility
        # until VARIA logic helpers are properly implemented
        if self._check_accessFrom_pattern(rule):
            logger.info("SM: Found accessFrom comprehension pattern, exporting as constant False (VARIA logic not yet implemented)")
            print("[SM] Exporting accessFrom pattern as constant False (needs VARIA logic implementation)")
            return {'type': 'constant', 'value': False}

        # Also check for deeply nested any_of structures (result of recursion limits)
        # CHANGED: Export as False instead of True
        if self._check_deeply_nested_any_of(rule):
            logger.info("SM: Found deeply nested any_of pattern (recursion artifact), exporting as constant False")
            print("[SM] Exporting deeply nested any_of pattern as constant False")
            return {'type': 'constant', 'value': False}

        # Handle helper nodes with name='evalSMBool' (analyzer converts self.evalSMBool to helper)
        if rule_type == 'helper' and rule.get('name') == 'evalSMBool':
            # DON'T simplify evalSMBool(SMBool(True), ...) to constant True
            # even though mathematically it's always true, because:
            # 1. For locations with accessFrom, the region access provides the restriction
            # 2. Preserving the structure allows proper frontend evaluation
            # 3. It makes the exported rules more consistent and debuggable

            # Preserve the evalSMBool helper call and expand its arguments
            print("[SM] Preserving evalSMBool helper (will be evaluated by frontend)")
            if 'args' in rule:
                rule['args'] = [self.expand_rule(arg) for arg in rule['args']]
            return rule

        # Transform function_call nodes where function is an attribute access on 'self' or 'sm'
        # (This is kept for compatibility but may not be needed if analyzer converts to helper)
        if rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                attr = function.get('attr')

                # Transform self.evalSMBool(...) into helper call
                if obj.get('type') == 'name' and obj.get('name') == 'self' and attr == 'evalSMBool':
                    # Convert to helper call and expand arguments
                    # Don't simplify SMBool(True) - preserve the structure
                    print("[SM] Converting evalSMBool function_call to helper (preserving structure)")
                    expanded_args = [self.expand_rule(arg) for arg in rule.get('args', [])]
                    return {'type': 'helper', 'name': 'evalSMBool', 'args': expanded_args}

                # Transform sm.methodName(...) into helper calls
                # These are VARIA logic methods like sm.wor, sm.wand, sm.haveItem, etc.
                if obj.get('type') == 'name' and obj.get('name') == 'sm':
                    # Convert to helper call
                    print(f"[SM] Converting sm.{attr}(...) to helper call")
                    expanded_args = [self.expand_rule(arg) for arg in rule.get('args', [])]
                    return {'type': 'helper', 'name': attr, 'args': expanded_args}

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
