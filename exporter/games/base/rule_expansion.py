"""Rule expansion mixin for game export handlers.

This module handles the recursive expansion of rule trees,
including helper expansion, f-string resolution, and option access.
"""

import copy
import logging
from typing import Any, Dict, List, Optional

from exporter.constants import MAX_RULE_EXPANSION_DEPTH

logger = logging.getLogger(__name__)


class RuleExpansionMixin:
    """Mixin providing rule expansion methods."""

    # These attributes are expected to be defined on the main handler class
    # They are declared here for type checking purposes
    world: Any
    NAME_REMAPPING: Dict[str, str]
    SETTINGS_TO_CONVERT: set
    CONVERT_WORLD_METHODS_TO_HELPERS: bool
    HELPER_OBJECT_NAMES: set
    STATE_METHOD_REPLACEMENTS: Dict[str, Dict[str, Any]]

    def expand_rule(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively expand helper functions in a rule structure."""
        if _depth > MAX_RULE_EXPANSION_DEPTH:
            logging.error(f"Rule expansion exceeded maximum depth ({MAX_RULE_EXPANSION_DEPTH}). "
                         f"This likely indicates a circular helper reference. Rule type: {rule.get('type') if rule else 'None'}")
            return {'type': 'error', 'message': f'Max expansion depth ({MAX_RULE_EXPANSION_DEPTH}) exceeded'}

        if not rule or not isinstance(rule, dict):
            return rule

        # Handle helper type in AST format: {'type': 'helper', 'name': 'helper_name', 'args': [...]}
        if rule.get('type') == 'helper':
            helper_name = rule.get('name', '')
            helper_args = rule.get('args', [])

            # Hook: try pattern-based expansion first (for GenericGameExportHandler)
            pattern_result = self._expand_helper_by_pattern(helper_name, helper_args)
            if pattern_result is not None:
                return self.expand_rule(pattern_result, _depth + 1)

            # Standard helper expansion
            expanded = self.expand_helper(helper_name, helper_args)
            if expanded:
                return self.expand_rule(expanded, _depth + 1)

            # Helper not expanded - recursively expand args, but preserve the helper structure
            # This preserves helpers like can_buy_unlimited that are in HELPERS_TO_PRESERVE
            expanded_args = [
                self.expand_rule(arg, _depth + 1) if isinstance(arg, dict) else arg
                for arg in helper_args
            ]
            result = {'type': 'helper', 'name': helper_name, 'args': expanded_args}
            if 'kwargs' in rule:
                result['kwargs'] = rule['kwargs']
            return result

        # Handle helper type in RB format: {'rule': 'helper_name', '_original_ast_type': 'helper', 'args': [...]}
        if rule.get('_original_ast_type') == 'helper':
            helper_name = rule.get('rule', '')
            if helper_name:
                helper_args = rule.get('args', [])

                # Hook: try pattern-based expansion first (for GenericGameExportHandler)
                pattern_result = self._expand_helper_by_pattern(helper_name, helper_args)
                if pattern_result is not None:
                    return self.expand_rule(pattern_result, _depth + 1)

                # Standard helper expansion
                expanded = self.expand_helper(helper_name, helper_args)
                if expanded:
                    return self.expand_rule(expanded, _depth + 1)

        # Recursively expand children of compound rules
        return self._recursively_expand_rule_children(rule, _depth)

    def _recursively_expand_rule_children(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """
        Recursively expand children of compound rules (and, or, not, conditional).

        This utility method can be called by game-specific expand_rule implementations
        to handle standard recursion after doing game-specific transformations.

        Also handles:
        - f_string conversion using resolve_f_string
        - Name remapping using NAME_REMAPPING
        - Settings conversion using SETTINGS_TO_CONVERT
        - Recursive processing of item_check items

        Args:
            rule: The rule dictionary to process
            _depth: Current recursion depth (for cycle detection)

        Returns:
            The rule with children recursively expanded
        """
        if not rule or not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # Handle f_string conversion (AST format: type='f_string')
        if rule_type == 'f_string':
            resolved = self.resolve_f_string(rule)
            if resolved is not None:
                return {'type': 'constant', 'value': resolved}
            # Fallback: return original rule if we can't resolve
            return rule

        # Handle f_string conversion (RB format: rule='AST_f_string' with args containing f_string data)
        # RB format has args with 'parts', 'all_simple', 'value', '_original_ast_type': 'f_string'
        if rule.get('rule') == 'AST_f_string':
            args = rule.get('args', {})
            # If all_simple is true and value is already resolved, use it directly
            if args.get('all_simple') and 'value' in args:
                return {'type': 'constant', 'value': args['value']}
            # Otherwise try to resolve from parts
            if args.get('_original_ast_type') == 'f_string':
                resolved = self.resolve_f_string(args)
                if resolved is not None:
                    return {'type': 'constant', 'value': resolved}
            return rule

        # Handle name remapping and settings conversion
        if rule_type == 'name':
            name = rule.get('name', '')
            # First apply any name remapping
            if name in self.NAME_REMAPPING:
                name = self.NAME_REMAPPING[name]
                logger.debug(f"Remapped name '{rule.get('name')}' to '{name}'")

            # Convert known setting names to option_value type
            if name in self.SETTINGS_TO_CONVERT:
                logger.debug(f"Converting name '{name}' to option_value type")
                return {'type': 'option_value', 'option': name}

            # Otherwise just update the name and return
            rule['name'] = name
            return rule

        # Handle item_check with dict item names (e.g., f_string items)
        # AST format: type='item_check'
        if rule_type == 'item_check':
            if isinstance(rule.get('item'), dict):
                rule['item'] = self.expand_rule(rule['item'], _depth + 1)
            if isinstance(rule.get('count'), dict):
                rule['count'] = self.expand_rule(rule['count'], _depth + 1)

        # Handle item_check in RB format: rule='ItemCheck' with args containing item/count
        if rule.get('rule') == 'ItemCheck':
            args = rule.get('args', {})
            if isinstance(args.get('item'), dict):
                args['item'] = self.expand_rule(args['item'], _depth + 1)
            if isinstance(args.get('count'), dict):
                args['count'] = self.expand_rule(args['count'], _depth + 1)

        # Handle compound rules
        if rule_type in ['and', 'or']:
            rule['conditions'] = [self.expand_rule(cond, _depth + 1) for cond in rule.get('conditions', [])]
            # Apply lossless simplification after expansion
            rule = self._simplify_and_or(rule)

        elif rule_type == 'not':
            rule['condition'] = self.expand_rule(rule.get('condition'), _depth + 1)

        elif rule_type == 'conditional':
            rule['test'] = self.expand_rule(rule.get('test'), _depth + 1)
            rule['if_true'] = self.expand_rule(rule.get('if_true'), _depth + 1)
            rule['if_false'] = self.expand_rule(rule.get('if_false'), _depth + 1)

        # Handle compare operations (expand left/right recursively)
        elif rule_type == 'compare':
            if 'left' in rule:
                rule['left'] = self.expand_rule(rule['left'], _depth + 1)
            if 'right' in rule:
                rule['right'] = self.expand_rule(rule['right'], _depth + 1)

        # Handle state_method (expand args recursively)
        elif rule_type == 'state_method':
            method_name = rule.get('method', '')

            # Hook: handle __analyzed_func__ fallback (for GenericGameExportHandler)
            if method_name == '__analyzed_func__':
                analyzed_result = self._handle_analyzed_func(rule)
                if analyzed_result is not None:
                    return analyzed_result

            # Check for STATE_METHOD_REPLACEMENTS (declarative state method replacement)
            # Uses get_effective_state_method_replacements() which combines auto-detected
            # LogicMixin patterns with manual STATE_METHOD_REPLACEMENTS
            effective_replacements = self.get_effective_state_method_replacements()
            if method_name in effective_replacements:
                replacement = copy.deepcopy(effective_replacements[method_name])
                logger.debug(f"Replacing state_method {method_name} with rule structure")
                # Recursively expand the replacement in case it contains nested rules
                return self.expand_rule(replacement, _depth + 1)

            # Check for has_all(set([items])) pattern and simplify to item checks
            if method_name == 'has_all':
                simplified = self._simplify_has_all(rule)
                if simplified != rule:
                    return simplified

            # Try LogicMixin pattern expansion (hook for subclasses like GenericGameExportHandler)
            args = rule.get('args', [])
            pattern_result = self._expand_logic_mixin_patterns(method_name, args)
            if pattern_result is not None:
                return pattern_result

            if 'args' in rule:
                rule['args'] = [
                    self.expand_rule(arg, _depth + 1) if isinstance(arg, dict) else arg
                    for arg in rule.get('args', [])
                ]

        # Handle function_call - convert obj.method() to helper calls for configured objects
        # This allows games to define methods on the World class (or logic objects) that are used as rules
        elif rule_type == 'function_call':
            function = rule.get('function', {})
            if function.get('type') == 'attribute':
                obj = function.get('object', {})
                method_name = function.get('attr')

                # Pattern 1: Convert configured object method calls to helper functions
                if self.CONVERT_WORLD_METHODS_TO_HELPERS:
                    if obj.get('type') == 'name' and obj.get('name') in self.HELPER_OBJECT_NAMES:
                        # Preserve original args and expand them recursively
                        original_args = rule.get('args', [])
                        expanded_args = [
                            self.expand_rule(arg, _depth + 1) if isinstance(arg, dict) else arg
                            for arg in original_args
                        ]
                        logger.debug(f"Converting {obj.get('name')}.{method_name}() to helper function with {len(expanded_args)} args")

                        # Try to expand the helper immediately
                        expanded = self.expand_helper(method_name, expanded_args)
                        if expanded:
                            return self.expand_rule(expanded, _depth + 1)

                        # Return helper node with preserved args
                        return {
                            'type': 'helper',
                            'name': method_name,
                            'args': expanded_args
                        }

                # Pattern 2: state.multiworld.get_location(loc, player).can_reach(state) -> location_check
                if method_name == 'can_reach':
                    if (obj.get('type') == 'function_call' and
                        obj.get('function', {}).get('type') == 'attribute' and
                        obj.get('function', {}).get('attr') == 'get_location'):
                        get_loc_func = obj.get('function', {})
                        multiworld_obj = get_loc_func.get('object', {})
                        if (multiworld_obj.get('type') == 'attribute' and
                            multiworld_obj.get('attr') == 'multiworld' and
                            multiworld_obj.get('object', {}).get('type') == 'name' and
                            multiworld_obj.get('object', {}).get('name') == 'state'):
                            location_args = obj.get('args', [])
                            if location_args:
                                logger.debug(f"Converting get_location().can_reach() to location_check")
                                return {'type': 'location_check', 'location': location_args[0]}

        # Handle option access patterns and resolve to constant values
        # This handles patterns like:
        # - self.options.X -> constant value
        # - state.multiworld.worlds[player].options.X -> constant value
        elif rule_type == 'attribute':
            # First apply NAME_REMAPPING to the object if it's a name node
            # This handles patterns like flooded.something -> precalculated_weights.something
            obj = rule.get('object', {})
            if isinstance(obj, dict) and obj.get('type') == 'name':
                original_name = obj.get('name', '')
                if original_name in self.NAME_REMAPPING:
                    new_name = self.NAME_REMAPPING[original_name]
                    logger.debug(f"Remapped attribute object name '{original_name}' to '{new_name}'")
                    obj['name'] = new_name

            # Check for OPTION_PROPERTY_EXPANSIONS (e.g., swim_rule.base_depth -> computed rule)
            # This handles computed properties on option classes
            obj_name = obj.get('name') if obj.get('type') == 'name' else None
            attr_name = rule.get('attr')
            if obj_name and attr_name and hasattr(self, 'OPTION_PROPERTY_EXPANSIONS'):
                expansion_key = (obj_name, attr_name)
                if expansion_key in self.OPTION_PROPERTY_EXPANSIONS:
                    expansion = copy.deepcopy(self.OPTION_PROPERTY_EXPANSIONS[expansion_key])
                    logger.debug(f"Expanding {obj_name}.{attr_name} via OPTION_PROPERTY_EXPANSIONS")
                    return self.expand_rule(expansion, _depth + 1)

            # Check for helper object attribute access (e.g., logic.method_name without parentheses)
            # This handles cases where Python code accessed a method without calling it
            # NOTE: Excludes 'self' and 'world' since their attribute access is usually settings,
            # not helper methods. Only convert attribute access for game-specific logic objects.
            if obj_name and obj_name in self.HELPER_OBJECT_NAMES and obj_name not in {'self', 'world'}:
                logger.debug(f"Converting {obj_name}.{attr_name} attribute access to helper function")
                return {
                    'type': 'helper',
                    'name': attr_name,
                    'args': []
                }

            # Try to resolve as option access
            resolved = self._resolve_option_access(rule)
            if resolved is not None:
                return resolved

        # Handle block type (contains statements array)
        elif rule_type == 'block':
            if 'statements' in rule:
                rule['statements'] = [
                    self.expand_rule(stmt, _depth + 1) if isinstance(stmt, dict) else stmt
                    for stmt in rule.get('statements', [])
                ]

        # Handle assign type (contains value)
        elif rule_type == 'assign':
            if 'value' in rule and isinstance(rule['value'], dict):
                rule['value'] = self.expand_rule(rule['value'], _depth + 1)

        # Handle return type (contains value)
        elif rule_type == 'return':
            if 'value' in rule and isinstance(rule['value'], dict):
                rule['value'] = self.expand_rule(rule['value'], _depth + 1)

        # Handle if_statement type (contains test, body, orelse)
        elif rule_type == 'if_statement':
            if 'test' in rule and isinstance(rule['test'], dict):
                rule['test'] = self.expand_rule(rule['test'], _depth + 1)
            if 'body' in rule:
                rule['body'] = [
                    self.expand_rule(stmt, _depth + 1) if isinstance(stmt, dict) else stmt
                    for stmt in rule.get('body', [])
                ]
            if 'orelse' in rule:
                rule['orelse'] = [
                    self.expand_rule(stmt, _depth + 1) if isinstance(stmt, dict) else stmt
                    for stmt in rule.get('orelse', [])
                ]

        # Handle subscript type (contains value and slice)
        elif rule_type == 'subscript':
            if 'value' in rule and isinstance(rule['value'], dict):
                rule['value'] = self.expand_rule(rule['value'], _depth + 1)
            if 'slice' in rule and isinstance(rule['slice'], dict):
                rule['slice'] = self.expand_rule(rule['slice'], _depth + 1)

        # Handle list/set types (contain value array)
        elif rule_type in ['list', 'set']:
            if 'value' in rule and isinstance(rule['value'], list):
                rule['value'] = [
                    self.expand_rule(item, _depth + 1) if isinstance(item, dict) else item
                    for item in rule['value']
                ]

        # Handle sum_of/any_of/all_of types (contain iterable and optionally condition)
        elif rule_type in ['sum_of', 'any_of', 'all_of']:
            if 'iterable' in rule and isinstance(rule['iterable'], dict):
                rule['iterable'] = self.expand_rule(rule['iterable'], _depth + 1)
            if 'element_rule' in rule and isinstance(rule['element_rule'], dict):
                rule['element_rule'] = self.expand_rule(rule['element_rule'], _depth + 1)
            if 'condition' in rule and isinstance(rule['condition'], dict):
                rule['condition'] = self.expand_rule(rule['condition'], _depth + 1)

        # Handle sum type (contains iterable)
        elif rule_type == 'sum':
            if 'iterable' in rule and isinstance(rule['iterable'], dict):
                rule['iterable'] = self.expand_rule(rule['iterable'], _depth + 1)

        # Handle binary_op type (contains left and right)
        elif rule_type == 'binary_op':
            if 'left' in rule and isinstance(rule['left'], dict):
                rule['left'] = self.expand_rule(rule['left'], _depth + 1)
            if 'right' in rule and isinstance(rule['right'], dict):
                rule['right'] = self.expand_rule(rule['right'], _depth + 1)

        # Handle max/min types (contain args array that needs expansion)
        # This ensures self.options.xxx references inside max/min calls get resolved
        elif rule_type in ('max', 'min'):
            if 'args' in rule and isinstance(rule['args'], list):
                rule['args'] = [
                    self.expand_rule(arg, _depth + 1) if isinstance(arg, dict) else arg
                    for arg in rule['args']
                ]

        # Handle comparison type (alias for compare, contains left and right)
        elif rule_type == 'comparison':
            if 'left' in rule and isinstance(rule['left'], dict):
                rule['left'] = self.expand_rule(rule['left'], _depth + 1)
            if 'right' in rule and isinstance(rule['right'], dict):
                rule['right'] = self.expand_rule(rule['right'], _depth + 1)

        # Handle constant type where value is a dict containing rule structures
        # This handles cases where Python code defines dicts with rule objects as values
        elif rule_type == 'constant':
            value = rule.get('value')
            if isinstance(value, dict):
                # Recursively expand any rule structures in the dict values
                expanded_value = self._expand_dict_values(value, _depth + 1)
                rule['value'] = expanded_value
            elif isinstance(value, list):
                # Recursively expand any rule structures in the list
                rule['value'] = [
                    self._expand_dict_values(item, _depth + 1) if isinstance(item, dict) else item
                    for item in value
                ]

        return rule

    def _expand_dict_values(self, d: Dict[str, Any], _depth: int) -> Dict[str, Any]:
        """Recursively expand rule structures in a dict.

        This handles constant dicts that contain rule structures as values.
        """
        result = {}
        for key, value in d.items():
            if isinstance(value, dict):
                # Check if this is a rule structure (has 'type' key)
                if 'type' in value:
                    result[key] = self.expand_rule(value, _depth)
                else:
                    # Recurse into nested dicts
                    result[key] = self._expand_dict_values(value, _depth)
            elif isinstance(value, list):
                result[key] = [
                    self.expand_rule(item, _depth) if isinstance(item, dict) and 'type' in item
                    else (self._expand_dict_values(item, _depth) if isinstance(item, dict) else item)
                    for item in value
                ]
            else:
                result[key] = value
        return result

    def _resolve_option_access(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Resolve option access patterns to constant values.

        Handles patterns like:
        - self.options.X -> constant value
        - state.multiworld.worlds[player].options.X -> constant value

        Args:
            rule: An attribute type rule node

        Returns:
            A constant rule node if the option was resolved, None otherwise
        """
        if rule.get('type') != 'attribute':
            return None

        option_name = rule.get('attr')
        obj = rule.get('object', {})

        # Pattern 1: self.options.X or world.options.X
        if (obj.get('type') == 'attribute' and
            obj.get('attr') == 'options' and
            obj.get('object', {}).get('type') == 'name' and
            obj.get('object', {}).get('name') in ['self', 'world']):

            world = self.world
            if world and hasattr(world, 'options'):
                option_value = getattr(world.options, option_name, None)
                if option_value is not None:
                    value = getattr(option_value, 'value', option_value)
                    logger.debug(f"Resolved self.options.{option_name} to constant: {value}")
                    return {'type': 'constant', 'value': value}

        # Pattern 2: state.multiworld.worlds[player].options.X
        if (obj.get('type') == 'attribute' and
            obj.get('attr') == 'options' and
            obj.get('object', {}).get('type') == 'subscript'):

            world = self.world
            if world and hasattr(world, 'options'):
                option_value = getattr(world.options, option_name, None)
                if option_value is not None:
                    value = getattr(option_value, 'value', option_value)
                    logger.debug(f"Resolved state.multiworld.worlds[player].options.{option_name} to constant: {value}")
                    return {'type': 'constant', 'value': value}

        return None

    def expand_count_check(self, items: List[str], count: int = 1) -> Dict[str, Any]:
        """Create a count check rule for one or more items."""
        return {
            'type': 'or',
            'conditions': [
                {'type': 'count_check', 'item': item, 'count': count}
                for item in items
            ]
        }

    def resolve_f_string(self, f_string_rule: Dict[str, Any]) -> Optional[str]:
        """
        Resolve an f_string AST node to a simple string.

        This is a utility method for game-specific handlers that need to resolve
        f-strings in rules. Override _resolve_f_string_value for game-specific
        value resolution (e.g., subscript lookups).

        Args:
            f_string_rule: The f_string rule node with 'parts' array

        Returns:
            The resolved string, or None if resolution fails
        """
        if f_string_rule.get('type') != 'f_string':
            return None

        parts = f_string_rule.get('parts', [])
        if not parts:
            return ''

        result_parts = []
        for part in parts:
            if part.get('type') == 'constant':
                result_parts.append(str(part.get('value', '')))
            elif part.get('type') == 'formatted_value':
                value_node = part.get('value', {})
                resolved = self._resolve_f_string_value(value_node)
                if resolved is None:
                    logger.debug(f"Cannot resolve f_string formatted_value: {value_node}")
                    return None
                result_parts.append(str(resolved))
            else:
                logger.debug(f"Cannot resolve f_string part type: {part.get('type')}")
                return None

        return ''.join(result_parts)

    def _resolve_f_string_value(self, value_node: Dict[str, Any]) -> Optional[Any]:
        """
        Resolve a single value node within an f-string.

        Override this method in game-specific handlers to support additional
        value types (like subscript lookups, attribute access, etc.).

        Args:
            value_node: The value node from a formatted_value part

        Returns:
            The resolved value, or None if resolution fails
        """
        node_type = value_node.get('type')

        if node_type == 'constant':
            return value_node.get('value', '')
        elif node_type == 'binary_op':
            return self._evaluate_binary_op(value_node)
        elif node_type == 'name':
            # Variable reference - can't resolve without context
            logger.debug(f"Variable reference in f-string: {value_node.get('name')}")
            return None

        # Unknown type - subclasses can handle additional types
        return None

    def _evaluate_binary_op(self, node: Dict[str, Any]) -> Optional[Any]:
        """
        Evaluate a binary operation node.

        Supports +, -, *, /, //, % operators on constant values.

        Args:
            node: The binary_op node

        Returns:
            The result of the operation, or None if evaluation fails
        """
        if node.get('type') != 'binary_op':
            return None

        left = node.get('left', {})
        right = node.get('right', {})
        op = node.get('op', '')

        # Get values (recursively resolve if needed)
        if left.get('type') == 'constant':
            left_val = left.get('value')
        elif left.get('type') == 'binary_op':
            left_val = self._evaluate_binary_op(left)
            if left_val is None:
                return None
        else:
            return None

        if right.get('type') == 'constant':
            right_val = right.get('value')
        elif right.get('type') == 'binary_op':
            right_val = self._evaluate_binary_op(right)
            if right_val is None:
                return None
        else:
            return None

        # Perform operation
        try:
            if op == '-':
                return left_val - right_val
            elif op == '+':
                return left_val + right_val
            elif op == '*':
                return left_val * right_val
            elif op == '/':
                return left_val / right_val
            elif op == '//':
                return left_val // right_val
            elif op == '%':
                return left_val % right_val
            else:
                logger.debug(f"Unknown binary operator: {op}")
                return None
        except Exception as e:
            logger.debug(f"Error evaluating binary op: {e}")
            return None

    def _simplify_has_all(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Simplify state.has_all(set([items]), player) patterns to item checks.

        Converts patterns like:
          state.has_all(set(["Safety Pass"]), player)
        To:
          {"type": "item_check", "item": "Safety Pass"}

        Or for multiple items:
          state.has_all(set(["Item1", "Item2"]), player)
        To:
          {"type": "and", "conditions": [
            {"type": "item_check", "item": "Item1"},
            {"type": "item_check", "item": "Item2"}
          ]}

        This pattern appears in rules for games like Landstalker, KH2, and Messenger.

        Args:
            rule: The state_method rule with method='has_all'

        Returns:
            Simplified rule, or the original rule if simplification isn't possible
        """
        args = rule.get('args', [])

        if not args:
            logger.debug("has_all with no args, keeping as-is")
            return rule

        first_arg = args[0]

        # Check if first arg is a set() helper call
        if isinstance(first_arg, dict) and first_arg.get('type') == 'helper' and first_arg.get('name') == 'set':
            # Extract the items from set(items)
            set_args = first_arg.get('args', [])
            if set_args:
                items_arg = set_args[0]

                # Extract the actual list of item names
                items = self._extract_items_from_constant(items_arg)

                if items is not None:
                    # Convert to item checks
                    if len(items) == 0:
                        # Empty set, always true
                        return {"type": "constant", "value": True}
                    elif len(items) == 1:
                        # Single item, simple item_check
                        return {"type": "item_check", "item": items[0]}
                    else:
                        # Multiple items, AND them together
                        return {
                            "type": "and",
                            "conditions": [
                                {"type": "item_check", "item": item}
                                for item in items
                            ]
                        }

        # Couldn't simplify, return original
        return rule

    def _extract_items_from_constant(self, arg: Any) -> Optional[List[str]]:
        """Extract list of item names from a constant value argument.

        Handles patterns like:
          {"type": "constant", "value": ["Safety Pass"]}
          {"type": "constant", "value": ["Item1", "Item2"]}
          {"type": "constant", "value": []}  (empty list)

        Args:
            arg: The argument node from the AST

        Returns:
            List of item name strings, or None if not extractable
        """
        if isinstance(arg, dict) and arg.get('type') == 'constant':
            value = arg.get('value')
            if isinstance(value, list):
                # Filter to only string items (item names)
                # Return empty list for empty value, not None
                return [item for item in value if isinstance(item, str)]

        return None

    # These methods are expected to be provided by the main handler class
    def expand_helper(self, helper_name: str, args: List[Any] = None) -> Dict[str, Any]:
        """Expand a helper function into basic rule conditions.

        This is a stub that should be overridden by the main handler class.
        """
        return None

    def get_effective_state_method_replacements(self) -> Dict[str, Dict[str, Any]]:
        """Get effective STATE_METHOD_REPLACEMENTS combining auto-detected and manual.

        This is a stub that should be overridden by the main handler class.
        Returns STATE_METHOD_REPLACEMENTS by default for backwards compatibility.
        """
        return getattr(self, 'STATE_METHOD_REPLACEMENTS', {})

    def _expand_logic_mixin_patterns(self, method_name: str, args: List[Any]) -> Optional[Dict[str, Any]]:
        """Expand LogicMixin naming patterns to rule structures.

        This is a hook for pattern-based expansion of state methods that follow
        common naming conventions like `_game_has_item`, `_game_has_region`, etc.

        Override in subclasses (like GenericGameExportHandler) to provide
        intelligent pattern-based expansion.

        Args:
            method_name: The state method name (e.g., '_kh2_has_item')
            args: The method arguments

        Returns:
            A rule dictionary if the pattern was matched, None otherwise
        """
        return None

    def _handle_analyzed_func(self, rule: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle __analyzed_func__ state methods.

        This is a hook for handling rules that couldn't be fully analyzed
        and fell back to __analyzed_func__. Override in subclasses to provide
        intelligent fallback handling.

        Args:
            rule: The state_method rule with method='__analyzed_func__'

        Returns:
            A rule dictionary if handled, None to continue normal processing
        """
        return None

    def _expand_helper_by_pattern(self, helper_name: str, args: List[Any]) -> Optional[Dict[str, Any]]:
        """Expand helper functions by naming pattern.

        This is a hook for pattern-based expansion of helpers that follow
        common naming conventions like `has_*`, `can_*`, `defeat_*`, etc.

        Override in subclasses (like GenericGameExportHandler) to provide
        intelligent pattern-based expansion.

        Args:
            helper_name: The helper function name
            args: The helper arguments

        Returns:
            A rule dictionary if the pattern was matched, None otherwise
        """
        return None

    # ==================== Lossless Rule Simplification ====================
    #
    # These methods provide lossless simplification of AND/OR rule trees during
    # expansion. This prevents rule explosion by eliminating duplicates and
    # simplifying structure without changing semantics.

    def _rule_fingerprint(self, rule: Any) -> str:
        """Create a canonical string fingerprint of a rule for deduplication.

        This produces a consistent string representation that can be used
        to detect duplicate rules in AND/OR conditions.

        Args:
            rule: A rule dictionary or primitive value

        Returns:
            A canonical string representation for comparison
        """
        if rule is None:
            return "null"
        if isinstance(rule, bool):
            return f"bool:{rule}"
        if isinstance(rule, (int, float)):
            return f"num:{rule}"
        if isinstance(rule, str):
            return f"str:{rule}"
        if isinstance(rule, (list, tuple)):
            parts = [self._rule_fingerprint(item) for item in rule]
            return f"list:[{','.join(parts)}]"
        if not isinstance(rule, dict):
            return f"other:{type(rule).__name__}"

        rule_type = rule.get('type', rule.get('rule', ''))

        # Handle AND/OR - sort conditions for consistent ordering
        if rule_type in ('and', 'or'):
            conditions = rule.get('conditions', [])
            # Fingerprint each condition and sort for order-independence
            cond_fps = sorted(self._rule_fingerprint(c) for c in conditions)
            return f"{rule_type}:[{','.join(cond_fps)}]"

        # Handle item_check
        if rule_type == 'item_check':
            item = rule.get('item', '')
            count = rule.get('count', 1)
            return f"item:{item}:{count}"

        # Handle count_check
        if rule_type == 'count_check':
            item = rule.get('item', '')
            count = rule.get('count', 1)
            return f"count:{item}:{count}"

        # Handle location_check
        if rule_type == 'location_check':
            location = rule.get('location', '')
            return f"loc:{location}"

        # Handle region_check
        if rule_type == 'region_check':
            region = rule.get('region', '')
            return f"region:{region}"

        # Handle helper
        if rule_type == 'helper':
            name = rule.get('name', '')
            args = rule.get('args', [])
            args_fp = self._rule_fingerprint(args)
            return f"helper:{name}:{args_fp}"

        # Handle constant
        if rule_type == 'constant':
            value = rule.get('value')
            return f"const:{value}"

        # Handle not
        if rule_type == 'not':
            cond = rule.get('condition')
            return f"not:{self._rule_fingerprint(cond)}"

        # Handle conditional
        if rule_type == 'conditional':
            test = self._rule_fingerprint(rule.get('test'))
            if_true = self._rule_fingerprint(rule.get('if_true'))
            if_false = self._rule_fingerprint(rule.get('if_false'))
            return f"cond:{test}:{if_true}:{if_false}"

        # Handle state_method
        if rule_type == 'state_method':
            method = rule.get('method', '')
            args = rule.get('args', [])
            args_fp = self._rule_fingerprint(args)
            return f"state:{method}:{args_fp}"

        # Handle compare
        if rule_type in ('compare', 'comparison'):
            left = self._rule_fingerprint(rule.get('left'))
            op = rule.get('op', '==')
            right = self._rule_fingerprint(rule.get('right'))
            return f"cmp:{left}:{op}:{right}"

        # Handle any_of/all_of
        if rule_type in ('any_of', 'all_of'):
            element = self._rule_fingerprint(rule.get('element_rule'))
            iterable = self._rule_fingerprint(rule.get('iterable'))
            return f"{rule_type}:{element}:{iterable}"

        # Fallback: use sorted keys for consistent ordering
        import json
        try:
            return json.dumps(rule, sort_keys=True, default=str)
        except (TypeError, ValueError):
            return f"unknown:{id(rule)}"

    def _simplify_and_or(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Apply lossless simplifications to AND/OR rules.

        Simplifications applied:
        1. Flatten nested same-type: OR(OR(A,B), C) → OR(A,B,C)
        2. Deduplicate conditions: AND(A, A, B) → AND(A, B)
        3. Constant folding: AND(True, X) → X, OR(False, X) → X
        4. Identity: AND(X) → X, OR(X) → X
        5. Domination: AND(False, X) → False, OR(True, X) → True

        Args:
            rule: An AND or OR rule dictionary

        Returns:
            Simplified rule (may be the same if no simplification possible)
        """
        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')
        if rule_type not in ('and', 'or'):
            return rule

        conditions = rule.get('conditions', [])
        if not conditions:
            # Empty AND is True, empty OR is False
            return {'type': 'constant', 'value': (rule_type == 'and')}

        # Step 1: Flatten nested same-type
        flattened = []
        for cond in conditions:
            if isinstance(cond, dict) and cond.get('type') == rule_type:
                # Flatten: add nested conditions directly
                nested = cond.get('conditions', [])
                flattened.extend(nested)
            else:
                flattened.append(cond)
        conditions = flattened

        # Step 2: Constant folding and domination
        filtered = []
        for cond in conditions:
            if isinstance(cond, dict) and cond.get('type') == 'constant':
                value = cond.get('value')
                if rule_type == 'and':
                    if value is False:
                        # AND with False is False
                        return {'type': 'constant', 'value': False}
                    # AND with True - skip (identity element)
                    if value is True:
                        continue
                else:  # rule_type == 'or'
                    if value is True:
                        # OR with True is True
                        return {'type': 'constant', 'value': True}
                    # OR with False - skip (identity element)
                    if value is False:
                        continue
            filtered.append(cond)
        conditions = filtered

        # Step 3: Deduplicate using fingerprints
        seen = set()
        deduped = []
        for cond in conditions:
            fp = self._rule_fingerprint(cond)
            if fp not in seen:
                seen.add(fp)
                deduped.append(cond)
        conditions = deduped

        # Step 4: Identity - single condition
        if len(conditions) == 0:
            # All conditions were removed (all True for AND, all False for OR)
            return {'type': 'constant', 'value': (rule_type == 'and')}
        if len(conditions) == 1:
            return conditions[0]

        # Return simplified rule
        return {'type': rule_type, 'conditions': conditions}

    def simplify_rule_tree(self, rule: Dict[str, Any], _depth: int = 0) -> Dict[str, Any]:
        """Recursively simplify a rule tree.

        This applies lossless simplifications throughout the entire rule tree.
        Call this after expansion to reduce rule size without losing semantics.

        Args:
            rule: The rule tree to simplify
            _depth: Current recursion depth (for safety)

        Returns:
            Simplified rule tree
        """
        if _depth > 100:
            logger.warning("simplify_rule_tree exceeded max depth")
            return rule

        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type')

        # First, recursively simplify children
        if rule_type in ('and', 'or'):
            conditions = rule.get('conditions', [])
            simplified_conditions = [
                self.simplify_rule_tree(c, _depth + 1) for c in conditions
            ]
            rule = {'type': rule_type, 'conditions': simplified_conditions}
            # Then apply AND/OR simplifications
            return self._simplify_and_or(rule)

        if rule_type == 'not':
            cond = rule.get('condition')
            simplified_cond = self.simplify_rule_tree(cond, _depth + 1)
            # Double negation elimination
            if isinstance(simplified_cond, dict) and simplified_cond.get('type') == 'not':
                return simplified_cond.get('condition', simplified_cond)
            return {'type': 'not', 'condition': simplified_cond}

        if rule_type == 'conditional':
            test = self.simplify_rule_tree(rule.get('test'), _depth + 1)
            if_true = self.simplify_rule_tree(rule.get('if_true'), _depth + 1)
            if_false = self.simplify_rule_tree(rule.get('if_false'), _depth + 1)
            # Simplify constant test
            if isinstance(test, dict) and test.get('type') == 'constant':
                return if_true if test.get('value') else if_false
            return {'type': 'conditional', 'test': test, 'if_true': if_true, 'if_false': if_false}

        # For other types, just return as-is
        return rule
