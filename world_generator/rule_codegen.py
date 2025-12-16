"""
Rule code generator - converts CC format rules to Python Rule Builder code.

This module transforms JSON rule definitions into Python source code
that uses the Rule Builder pattern.
"""

from typing import Any, Dict, List, Set, Tuple, Optional


class RuleCodeGenerator:
    """Generates Python Rule Builder code from CC format rules."""

    def __init__(self, game_name: str = "", settings: Dict[str, Any] = None) -> None:
        self.required_imports: Set[str] = set()
        self.game_name = game_name
        self.settings = settings or {}  # Resolved settings for evaluating setting_value nodes
        # Sanitize game name for use in Python identifiers
        import re
        self.game_name_lower = re.sub(r'[^a-zA-Z0-9]', '', game_name).lower() if game_name else ""
        self.known_helpers: Set[str] = set()
        self.helper_bodies: Dict[str, Dict[str, Any]] = {}  # helper_name -> CC format body

    def reset(self) -> None:
        """Reset state for a new generation run."""
        self.required_imports = set()

    def set_helpers(self, helper_names: Set[str], helper_bodies: Dict[str, Dict[str, Any]] = None,
                     helper_params: Dict[str, List[str]] = None) -> None:
        """Set known helpers and optionally their bodies and params for explain support."""
        self.known_helpers = helper_names
        self.helper_bodies = helper_bodies or {}
        self.helper_params = helper_params or {}  # helper_name -> list of param names

    def _expand_helper_refs(self, rule: Dict[str, Any], visited: Set[str] = None) -> Dict[str, Any]:
        """
        Recursively expand helper references in a rule body.

        This ensures body_data is self-contained and doesn't reference other helpers,
        which allows the frontend to evaluate rules without needing helper lookups.

        Args:
            rule: Rule dict in CC format
            visited: Set of helper names already visited (for cycle detection)

        Returns:
            Rule dict with helper references expanded to their bodies
        """
        if visited is None:
            visited = set()

        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type', '')

        # If this is a helper reference, expand it
        if rule_type == 'helper':
            helper_name = rule.get('name', '')
            if helper_name in visited:
                # Circular reference - return as-is to avoid infinite loop
                return rule
            if helper_name in self.helper_bodies:
                # Expand the helper body, marking this helper as visited
                new_visited = visited | {helper_name}
                return self._expand_helper_refs(self.helper_bodies[helper_name], new_visited)
            # Unknown helper - return as-is
            return rule

        # For other rule types, recursively expand any nested rules
        result = dict(rule)
        for key, value in rule.items():
            if isinstance(value, dict):
                result[key] = self._expand_helper_refs(value, visited)
            elif isinstance(value, list):
                result[key] = [
                    self._expand_helper_refs(item, visited) if isinstance(item, dict) else item
                    for item in value
                ]
        return result

    def get_function_name(self, helper_name: str) -> str:
        """Get the Python function name for a helper."""
        prefix = f"_{self.game_name_lower}_"
        if helper_name.startswith(prefix):
            return helper_name
        if helper_name.startswith('_'):
            return helper_name
        return f"{prefix}{helper_name}"

    def get_imports(self) -> List[str]:
        """Get the list of required Rule Builder imports."""
        # Always include base imports
        imports = ['True_', 'False_']

        # Add any imports we discovered during generation
        imports.extend(sorted(self.required_imports))

        return imports

    def generate(self, rule: Optional[Dict[str, Any]]) -> str:
        """
        Convert a CC format rule to Python Rule Builder expression.

        Args:
            rule: Rule dict in CC format, or None

        Returns:
            Python expression string using Rule Builder classes
        """
        if rule is None:
            self.required_imports.add('True_')
            return 'True_()'

        return self._convert_rule(rule)

    def _convert_rule(self, rule: Dict[str, Any]) -> str:
        """Internal recursive rule converter."""
        if not isinstance(rule, dict):
            # Primitive value
            if rule is True:
                return 'True_()'
            elif rule is False:
                return 'False_()'
            else:
                return repr(rule)

        rule_type = rule.get('type', '')

        # Dispatch based on rule type
        converters = {
            'constant': self._convert_constant,
            'item_check': self._convert_item_check,
            'group_check': self._convert_group_check,
            'and': self._convert_and,
            'or': self._convert_or,
            'can_reach': self._convert_can_reach_region,
            'region_check': self._convert_can_reach_region,
            'location_check': self._convert_location_check,
            'can_reach_entrance': self._convert_can_reach_entrance,
            'state_method': self._convert_state_method,
            'not': self._convert_not,
            'helper': self._convert_helper,
            'compare': self._convert_compare,
            'comparison': self._convert_compare,
            'conditional': self._convert_conditional,
        }

        converter = converters.get(rule_type)
        if converter:
            return converter(rule)

        # Unknown rule type - return True_() as placeholder
        # Don't use inline comments as they break multi-line expressions
        return 'True_()'

    def _convert_constant(self, rule: Dict[str, Any]) -> str:
        """Convert constant true/false rule."""
        value = rule.get('value', True)
        if value:
            self.required_imports.add('True_')
            return 'True_()'
        else:
            self.required_imports.add('False_')
            return 'False_()'

    def _extract_constant_value(self, value: Any, default: Any = None) -> Any:
        """
        Extract a constant value from either a raw value or a constant rule dict.

        Args:
            value: Either a raw value (int, str, etc.) or a dict like {"type": "constant", "value": X}
            default: Default value if extraction fails

        Returns:
            The extracted constant value
        """
        if isinstance(value, dict):
            if value.get('type') == 'constant':
                return value.get('value', default)
            return default
        return value if value is not None else default

    def _convert_item_check(self, rule: Dict[str, Any]) -> str:
        """Convert item_check to Has()."""
        self.required_imports.add('Has')

        item_raw = rule.get('item', '')
        item = self._extract_constant_value(item_raw, '')
        count_raw = rule.get('count', 1)
        count = self._extract_constant_value(count_raw, 1)

        # Escape item name for Python string
        item_escaped = item.replace('\\', '\\\\').replace('"', '\\"')

        if count == 1:
            return f'Has("{item_escaped}")'
        else:
            return f'Has("{item_escaped}", {count})'

    def _convert_group_check(self, rule: Dict[str, Any]) -> str:
        """Convert group_check to HasGroup()."""
        self.required_imports.add('HasGroup')

        group_raw = rule.get('group', '')
        group = self._extract_constant_value(group_raw, '')
        count_raw = rule.get('count', 1)
        count = self._extract_constant_value(count_raw, 1)

        group_escaped = group.replace('\\', '\\\\').replace('"', '\\"')

        if count == 1:
            return f'HasGroup("{group_escaped}")'
        else:
            return f'HasGroup("{group_escaped}", {count})'

    def _convert_and(self, rule: Dict[str, Any]) -> str:
        """Convert and rule to & expression."""
        conditions = rule.get('conditions', [])

        if not conditions:
            self.required_imports.add('True_')
            return 'True_()'

        if len(conditions) == 1:
            return self._convert_rule(conditions[0])

        # Convert each condition and join with &
        converted = [self._convert_rule(c) for c in conditions]

        # Wrap each in parens for safety, then join
        return ' & '.join(f'({c})' for c in converted)

    def _convert_or(self, rule: Dict[str, Any]) -> str:
        """Convert or rule to | expression."""
        conditions = rule.get('conditions', [])

        if not conditions:
            self.required_imports.add('False_')
            return 'False_()'

        if len(conditions) == 1:
            return self._convert_rule(conditions[0])

        # Convert each condition and join with |
        converted = [self._convert_rule(c) for c in conditions]

        # Wrap each in parens for safety, then join
        return ' | '.join(f'({c})' for c in converted)

    def _convert_can_reach_region(self, rule: Dict[str, Any]) -> str:
        """Convert can_reach to CanReachRegion()."""
        self.required_imports.add('CanReachRegion')

        region_raw = rule.get('region', '')
        region = self._extract_constant_value(region_raw, '')
        region_escaped = region.replace('\\', '\\\\').replace('"', '\\"')

        return f'CanReachRegion("{region_escaped}")'

    def _convert_location_check(self, rule: Dict[str, Any]) -> str:
        """Convert location_check to CanReachLocation()."""
        self.required_imports.add('CanReachLocation')

        location_raw = rule.get('location', '')
        location = self._extract_constant_value(location_raw, '')
        location_escaped = location.replace('\\', '\\\\').replace('"', '\\"')

        return f'CanReachLocation("{location_escaped}")'

    def _convert_can_reach_entrance(self, rule: Dict[str, Any]) -> str:
        """Convert can_reach_entrance to CanReachEntrance()."""
        self.required_imports.add('CanReachEntrance')

        entrance_raw = rule.get('entrance', '')
        entrance = self._extract_constant_value(entrance_raw, '')
        entrance_escaped = entrance.replace('\\', '\\\\').replace('"', '\\"')

        return f'CanReachEntrance("{entrance_escaped}")'

    def _convert_state_method(self, rule: Dict[str, Any]) -> str:
        """Convert state_method calls to appropriate Rule Builder classes."""
        method = rule.get('method', '')
        args = rule.get('args', [])

        # Handle can_reach state method - check second arg for type (Region or Location)
        if method in ('can_reach', 'can_reach_region'):
            if args and isinstance(args[0], dict):
                target = self._extract_constant_value(args[0], '')
                # Check if second argument specifies "Location" type
                reach_type = self._extract_constant_value(args[1], 'Region') if len(args) > 1 else 'Region'
                if target:
                    target_escaped = target.replace('\\', '\\\\').replace('"', '\\"')
                    if reach_type == 'Location':
                        self.required_imports.add('CanReachLocation')
                        return f'CanReachLocation("{target_escaped}")'
                    else:
                        self.required_imports.add('CanReachRegion')
                        return f'CanReachRegion("{target_escaped}")'
            return 'True_()'

        # Handle can_reach_location state method
        if method == 'can_reach_location':
            if args and isinstance(args[0], dict):
                location = self._extract_constant_value(args[0], '')
                if location:
                    self.required_imports.add('CanReachLocation')
                    location_escaped = location.replace('\\', '\\\\').replace('"', '\\"')
                    return f'CanReachLocation("{location_escaped}")'
            return 'True_()'

        # Handle basic has state method
        if method == 'has':
            if args:
                item = self._extract_constant_value(args[0], '') if args else ''
                count = self._extract_constant_value(args[1], 1) if len(args) > 1 else 1
                if item:
                    self.required_imports.add('Has')
                    item_escaped = item.replace('\\', '\\\\').replace('"', '\\"')
                    if count == 1:
                        return f'Has("{item_escaped}")'
                    return f'Has("{item_escaped}", {count})'
            return 'True_()'

        method_map = {
            'has_all': ('HasAll', self._extract_item_list),
            'has_any': ('HasAny', self._extract_item_list),
            'has_all_counts': ('HasAllCounts', self._extract_item_dict),
            'has_from_list': ('HasFromList', self._extract_item_list_with_count),
            'has_from_list_unique': ('HasFromListUnique', self._extract_item_list_with_count),
            'has_group_unique': ('HasGroupUnique', self._extract_group_with_count),
        }

        if method in method_map:
            class_name, extractor = method_map[method]
            self.required_imports.add(class_name)
            return extractor(class_name, args)

        # Unknown state method - return True_() as placeholder
        return 'True_()'

    def _extract_item_list(self, class_name: str, args: List[Dict[str, Any]]) -> str:
        """Extract item list for HasAll/HasAny.

        Note: HasAll/HasAny expect unpacked arguments (*item_names), not a list.
        Empty HasAny should return True_ (vacuously satisfied - any of nothing).
        Empty HasAll should return True_ (trivially satisfied - all of nothing).
        """
        if not args:
            # Empty item checks are trivially satisfied
            self.required_imports.add('True_')
            return 'True_()'

        # First arg should be a constant with the list
        first_arg = args[0]
        if first_arg.get('type') == 'constant':
            items = first_arg.get('value', [])
            if not items:
                # Empty item checks are trivially satisfied
                self.required_imports.add('True_')
                return 'True_()'
            # Unpack the items as separate arguments
            items_repr = ', '.join(repr(item) for item in items)
            return f'{class_name}({items_repr})'

        # Unknown format - return True_ as safe fallback
        self.required_imports.add('True_')
        return 'True_()'

    def _extract_item_dict(self, class_name: str, args: List[Dict[str, Any]]) -> str:
        """Extract item dict for HasAllCounts."""
        if not args:
            return f'{class_name}({{}})'

        first_arg = args[0]
        if first_arg.get('type') == 'constant':
            items = first_arg.get('value', {})
            items_repr = repr(items)
            return f'{class_name}({items_repr})'

        return f'{class_name}({{}})'

    def _extract_item_list_with_count(self, class_name: str, args: List[Dict[str, Any]]) -> str:
        """Extract item list and count for HasFromList.

        HasFromList expects (*item_names: str, count: int = 1), so we need
        to expand items as positional args and use count= keyword arg.
        """
        items = []
        count = 1

        if len(args) >= 1 and args[0].get('type') == 'constant':
            items = args[0].get('value', [])
        if len(args) >= 2 and args[1].get('type') == 'constant':
            count = args[1].get('value', 1)

        # Expand items as positional args, use count= as keyword arg
        items_str = ', '.join(repr(item) for item in items)
        return f'{class_name}({items_str}, count={count})'

    def _extract_group_with_count(self, class_name: str, args: List[Dict[str, Any]]) -> str:
        """Extract group and count for HasGroupUnique."""
        group = ''
        count = 1

        if len(args) >= 1 and args[0].get('type') == 'constant':
            group = args[0].get('value', '')
        if len(args) >= 2 and args[1].get('type') == 'constant':
            count = args[1].get('value', 1)

        return f'{class_name}("{group}", {count})'

    def _convert_compare(self, rule: Dict[str, Any]) -> str:
        """
        Convert compare rule to Has() if it matches the prog_items pattern,
        otherwise to Compare().

        Pattern: state.prog_items[player][item_name] OP count
        Converts to: Has(item_name, count)
        """
        left = rule.get('left', {})
        op = rule.get('op', '')
        right = rule.get('right', {})

        # Try to recognize the pattern: state.prog_items[player][item_name] >= count
        result = self._try_convert_prog_items_compare(left, op, right)
        if result is not None:
            return result

        # Use Compare class for all other patterns
        # binary_op operands are now handled by _convert_compare_operand -> _convert_binary_op
        self.required_imports.add('Compare')
        left_code = self._convert_compare_operand(left)
        right_code = self._convert_compare_operand(right)

        return f'Compare({left_code}, "{op}", {right_code})'

    def _convert_compare_operand(self, operand: Any) -> str:
        """Convert a compare operand to Python code."""
        if not isinstance(operand, dict):
            return repr(operand)

        op_type = operand.get('type', '')

        if op_type == 'constant':
            return repr(operand.get('value'))

        if op_type == 'state_method':
            method = operand.get('method', '')
            args = operand.get('args', [])

            # Handle count method specially
            if method == 'count':
                if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                    item_name = args[0].get('value', '')
                    self.required_imports.add('CountItem')
                    item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                    return f'CountItem("{item_escaped}")'

        if op_type == 'binary_op':
            return self._convert_binary_op(operand)

        # For other types, try to convert as a rule
        return self._convert_rule(operand)

    def _convert_binary_op(self, operand: Dict[str, Any]) -> str:
        """Convert a binary_op to Arithmetic rule."""
        self.required_imports.add('Arithmetic')

        left = operand.get('left', {})
        op = operand.get('op', '+')
        right = operand.get('right', {})

        # Normalize operator names from Python AST
        op_map = {
            'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/',
            'FloorDiv': '//', 'Mod': '%', 'Pow': '**',
        }
        op = op_map.get(op, op)

        left_code = self._convert_arithmetic_operand(left)
        right_code = self._convert_arithmetic_operand(right)

        return f'Arithmetic({left_code}, "{op}", {right_code})'

    def _convert_arithmetic_operand(self, operand: Any) -> str:
        """Convert an arithmetic operand to Python code."""
        if not isinstance(operand, dict):
            return repr(operand)

        op_type = operand.get('type', '')

        if op_type == 'constant':
            return repr(operand.get('value'))

        if op_type == 'state_method':
            method = operand.get('method', '')
            args = operand.get('args', [])

            if method == 'count':
                if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                    item_name = args[0].get('value', '')
                    self.required_imports.add('CountItem')
                    item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
                    return f'CountItem("{item_escaped}")'

        if op_type == 'binary_op':
            return self._convert_binary_op(operand)

        # Fall back to converting as a rule
        return self._convert_rule(operand)

    def _try_convert_prog_items_compare(
        self, left: Any, op: str, right: Any
    ) -> Optional[str]:
        """
        Try to convert a prog_items comparison to Has().

        Returns None if the pattern doesn't match.
        """
        # Check if right side is a constant (the count)
        if not isinstance(right, dict) or right.get('type') != 'constant':
            return None
        count = right.get('value', 0)

        # Extract item name from the left side
        item_name = self._extract_prog_items_item_name(left)
        if item_name is None:
            return None

        # Convert based on operator
        if op == '>=':
            pass  # count stays as is
        elif op == '>':
            count = count + 1  # > n means >= n+1
        elif op == '==' and count > 0:
            pass  # approximate as "has at least count"
        else:
            return None

        self.required_imports.add('Has')

        # Escape item name for Python string
        item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')

        if count == 1:
            return f'Has("{item_escaped}")'
        else:
            return f'Has("{item_escaped}", {count})'

    def _extract_prog_items_item_name(self, expr: Any) -> Optional[str]:
        """
        Extract the item name from a prog_items subscript expression.

        Pattern: state.prog_items[player][item_name]
        Also handles CC export format: {"type": "prog_item_count", "key": " coins"}
        Returns the item_name string if the pattern matches, None otherwise.
        """
        if not isinstance(expr, dict):
            return None

        # Handle CC export format: {"type": "prog_item_count", "key": " coins"}
        if expr.get('type') == 'prog_item_count':
            return expr.get('key')

        # Expected structure for subscript pattern:
        # {"type": "subscript", "value": {...}, "index": {"type": "constant", "value": "item_name"}}
        if expr.get('type') != 'subscript':
            return None

        # Get the item name from the outer subscript index
        index = expr.get('index', {})
        if not isinstance(index, dict) or index.get('type') != 'constant':
            return None
        item_name = index.get('value')

        # Check that the inner expression is state.prog_items[player]
        inner = expr.get('value', {})
        if not isinstance(inner, dict) or inner.get('type') != 'subscript':
            return None

        # Check the innermost expression is state.prog_items
        innermost = inner.get('value', {})
        if not isinstance(innermost, dict) or innermost.get('type') != 'attribute':
            return None

        if innermost.get('attr') != 'prog_items':
            return None

        obj = innermost.get('object', {})
        if not isinstance(obj, dict) or obj.get('type') != 'name' or obj.get('name') != 'state':
            return None

        return item_name

    def _convert_not(self, rule: Dict[str, Any]) -> str:
        """Convert not rule to Not()."""
        self.required_imports.add('Not')

        # Handle both 'condition' and 'operand' keys
        inner = rule.get('condition', rule.get('operand', rule.get('value', {})))
        inner_code = self._convert_rule(inner)

        return f'Not({inner_code})'

    def _convert_helper(self, rule: Dict[str, Any]) -> str:
        """Convert helper rule to HelperCall()."""
        helper_name = rule.get('name', '')
        args = rule.get('args', [])

        # If we know about this helper, generate a proper HelperCall
        if helper_name in self.known_helpers:
            self.required_imports.add('HelperCall')
            func_name = self.get_function_name(helper_name)

            # Convert arguments to Python code
            arg_strs = []
            for arg in args:
                if isinstance(arg, dict) and arg.get('type') == 'constant':
                    arg_strs.append(repr(arg.get('value')))
                elif isinstance(arg, dict) and arg.get('type') == 'setting_value':
                    # Resolve setting_value args to their actual values
                    setting = arg.get('setting', '')
                    if setting in self.settings:
                        arg_strs.append(repr(self.settings[setting]))
                    else:
                        arg_strs.append('None')
                elif isinstance(arg, dict) and arg.get('type') == 'attribute':
                    # Handle attribute access on setting_value (e.g., world.options.goal.value)
                    obj = arg.get('object', {})
                    if obj.get('type') == 'setting_value' and arg.get('attr') == 'value':
                        setting = obj.get('setting', '')
                        if setting in self.settings:
                            arg_strs.append(repr(self.settings[setting]))
                        else:
                            arg_strs.append('None')
                    else:
                        arg_strs.append('None')
                else:
                    # For complex args, try to convert
                    arg_strs.append(repr(arg) if not isinstance(arg, dict) else 'None')

            # Build HelperCall with helper_func reference and body_data for explain
            parts = [f'helper_func={func_name}', f'helper_name="{helper_name}"']

            if arg_strs:
                parts.append(f'args=({", ".join(arg_strs)},)')

            # Include body_data if available for explain support
            # Expand nested helper references so body_data is self-contained
            if helper_name in self.helper_bodies:
                body = self.helper_bodies[helper_name]
                # Expand any nested helper references to their bodies
                expanded_body = self._expand_helper_refs(body)

                # Include params if available so frontend can map args to param names
                if helper_name in self.helper_params and self.helper_params[helper_name]:
                    # Wrap body with params info for proper argument binding
                    body_with_params = {
                        'params': self.helper_params[helper_name],
                        'body': expanded_body
                    }
                    parts.append(f'body_data={repr(body_with_params)}')
                else:
                    # No params - just use the body directly
                    parts.append(f'body_data={repr(expanded_body)}')

            return f'HelperCall({", ".join(parts)})'

        # Unknown helper - return True_() as placeholder
        self.required_imports.add('True_')
        return 'True_()'

    def _convert_conditional(self, rule: Dict[str, Any]) -> str:
        """Convert conditional rule to Conditional()."""
        self.required_imports.add('Conditional')

        test = rule.get('test', {})
        if_true = rule.get('if_true', {})
        if_false = rule.get('if_false')

        # Handle None or missing if_false - default to True (always pass)
        if if_false is None:
            if_false = {'type': 'constant', 'value': True}

        # Check if if_false is just True (option-filtered rules)
        if_false_is_true = (
            isinstance(if_false, dict) and
            if_false.get('type') == 'constant' and
            if_false.get('value') is True
        )

        if if_false_is_true:
            # Option-filtered rule - just return the if_true branch
            return self._convert_rule(if_true)

        test_code = self._convert_rule(test)
        if_true_code = self._convert_rule(if_true)
        if_false_code = self._convert_rule(if_false)

        return f'Conditional(test={test_code}, if_true={if_true_code}, if_false={if_false_code})'


def cc_rule_to_python(rule: Optional[Dict[str, Any]]) -> Tuple[str, List[str]]:
    """
    Convert a CC format rule to Python Rule Builder expression.

    Args:
        rule: Rule dict in CC format

    Returns:
        Tuple of (python_expression, required_imports)
    """
    generator = RuleCodeGenerator()
    expression = generator.generate(rule)
    imports = generator.get_imports()

    return expression, imports


def is_trivial_rule(rule: Optional[Dict[str, Any]]) -> bool:
    """Check if a rule is trivial (constant true)."""
    if rule is None:
        return True
    if not isinstance(rule, dict):
        return rule is True
    if rule.get('type') == 'constant' and rule.get('value') is True:
        return True
    return False


class HelperCodeGenerator:
    """
    Generates Python helper functions from CC format rule definitions.

    This class converts helper function bodies (which are rule definitions)
    into actual Python code that can be executed at runtime.

    Unlike RuleCodeGenerator (which generates Rule Builder expressions),
    this generates raw Python code with lambda-compatible expressions.
    """

    def __init__(self, game_name: str, settings: Optional[Dict[str, Any]] = None) -> None:
        """
        Initialize the helper code generator.

        Args:
            game_name: The game name (used for generating function names)
            settings: Optional dict of resolved setting values for evaluating setting_value nodes
        """
        self.game_name = game_name
        self.settings = settings or {}
        # Sanitize game name for use in Python identifiers
        import re
        self.game_name_lower = re.sub(r'[^a-zA-Z0-9]', '', game_name).lower()
        self.known_helpers: Set[str] = set()  # Track which helpers exist for validation

    def set_known_helpers(self, helper_names: Set[str]) -> None:
        """Set the list of known helper names for this game."""
        self.known_helpers = helper_names

    def get_function_name(self, helper_name: str) -> str:
        """
        Get the Python function name for a helper.

        If the helper already has the game prefix (e.g., '_undertale_has_plot'),
        we use it as-is. Otherwise, we add the prefix.
        """
        prefix = f"_{self.game_name_lower}_"
        if helper_name.startswith(prefix):
            return helper_name
        if helper_name.startswith('_'):
            # Already has some underscore prefix, use as-is
            return helper_name
        return f"{prefix}{helper_name}"

    def generate_helper_function(
        self,
        helper_name: str,
        params: List[str],
        body: Dict[str, Any],
        defaults: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Generate a Python helper function from a rule body.

        Args:
            helper_name: Name of the helper function
            params: List of parameter names (excluding state/player)
            body: The rule body to convert
            defaults: Default values for parameters

        Returns:
            Complete Python function definition as a string
        """
        defaults = defaults or {}

        # Build function signature
        func_name = self.get_function_name(helper_name)
        sig_params = ['state: "CollectionState"', 'player: int']

        for param in params:
            if param in defaults:
                default_val = defaults[param]
                if isinstance(default_val, bool):
                    sig_params.append(f'{param}: bool = {default_val}')
                elif isinstance(default_val, (int, float)):
                    sig_params.append(f'{param} = {default_val}')
                elif isinstance(default_val, str):
                    sig_params.append(f'{param}: str = {repr(default_val)}')
                else:
                    sig_params.append(f'{param} = {repr(default_val)}')
            else:
                sig_params.append(param)

        signature = f"def {func_name}({', '.join(sig_params)}) -> bool:"

        # Generate function body
        body_code = self._generate_body(body)

        # Combine signature and body
        return f"{signature}\n{self._indent(body_code)}"

    def get_helper_call(self, helper_name: str, args: List[Dict[str, Any]]) -> str:
        """
        Generate a call to a helper function.

        Args:
            helper_name: Name of the helper to call
            args: List of argument rule definitions

        Returns:
            Python code for the function call
        """
        func_name = self.get_function_name(helper_name)

        # Generate argument expressions
        arg_exprs = ['state', 'player']
        for arg in args:
            arg_exprs.append(self._generate_expression(arg))

        return f"{func_name}({', '.join(arg_exprs)})"

    def _indent(self, code: str, level: int = 1) -> str:
        """Indent code by the specified number of levels (4 spaces each)."""
        indent = '    ' * level
        lines = code.split('\n')
        return '\n'.join(indent + line if line.strip() else line for line in lines)

    def _generate_body(self, rule: Dict[str, Any]) -> str:
        """
        Generate Python code for a rule body (may be expression or block).

        Returns code suitable for a function body (includes return if needed).
        """
        if not isinstance(rule, dict):
            return f"return {repr(rule)}"

        rule_type = rule.get('type', '')

        # Handle block (multi-statement body)
        if rule_type == 'block':
            return self._generate_block(rule)

        # For single expressions, wrap in return
        expr = self._generate_expression(rule)
        return f"return {expr}"

    def _generate_block(self, rule: Dict[str, Any]) -> str:
        """Generate Python code for a block of statements."""
        statements = rule.get('statements', [])
        if not statements:
            return "pass"

        lines = []
        for stmt in statements:
            stmt_code = self._generate_statement(stmt)
            lines.append(stmt_code)

        return '\n'.join(lines)

    def _generate_statement(self, stmt: Dict[str, Any]) -> str:
        """Generate Python code for a single statement."""
        if not isinstance(stmt, dict):
            return str(stmt)

        stmt_type = stmt.get('type', '')

        if stmt_type == 'assign':
            return self._generate_assign(stmt)
        elif stmt_type == 'return':
            return self._generate_return(stmt)
        elif stmt_type == 'for_range':
            return self._generate_for_range(stmt)
        elif stmt_type == 'for_iter':
            return self._generate_for_iter(stmt)
        elif stmt_type == 'if_statement':
            return self._generate_if_statement(stmt)
        elif stmt_type == 'while_loop':
            return self._generate_while_loop(stmt)
        elif stmt_type == 'break':
            return 'break'
        elif stmt_type == 'continue':
            return 'continue'
        else:
            # Treat as expression statement
            return self._generate_expression(stmt)

    def _generate_assign(self, stmt: Dict[str, Any]) -> str:
        """Generate Python assignment statement."""
        name = stmt.get('name', '_')
        value = self._generate_expression(stmt.get('value', {'type': 'constant', 'value': None}))
        op = stmt.get('op', '=')

        # Handle augmented assignment (+=, -=, *=, etc.)
        if op != '=':
            return f"{name} {op} {value}"
        return f"{name} = {value}"

    def _generate_return(self, stmt: Dict[str, Any]) -> str:
        """Generate Python return statement."""
        value = stmt.get('value')
        if value is None:
            return "return"
        return f"return {self._generate_expression(value)}"

    def _generate_for_range(self, stmt: Dict[str, Any]) -> str:
        """Generate Python for loop over range."""
        var = stmt.get('var', '_')
        count = self._generate_expression(stmt.get('count', {'type': 'constant', 'value': 0}))
        body = stmt.get('body', [])

        body_lines = []
        for s in body:
            body_lines.append(self._generate_statement(s))

        body_code = '\n'.join(body_lines) if body_lines else 'pass'

        return f"for {var} in range({count}):\n{self._indent(body_code)}"

    def _generate_for_iter(self, stmt: Dict[str, Any]) -> str:
        """Generate Python for loop over iterable."""
        var = stmt.get('var', '_')
        iterable = self._generate_expression(stmt.get('iterable', {'type': 'constant', 'value': []}))
        body = stmt.get('body', [])

        # Handle tuple unpacking in var
        if isinstance(var, dict) and var.get('type') == 'tuple':
            elements = var.get('elements', [])
            var_names = [self._generate_expression(e) for e in elements]
            var = ', '.join(var_names)

        body_lines = []
        for s in body:
            body_lines.append(self._generate_statement(s))

        body_code = '\n'.join(body_lines) if body_lines else 'pass'

        return f"for {var} in {iterable}:\n{self._indent(body_code)}"

    def _generate_if_statement(self, stmt: Dict[str, Any]) -> str:
        """Generate Python if statement."""
        test = self._generate_expression(stmt.get('test', {'type': 'constant', 'value': True}))
        body = stmt.get('body', [])
        orelse = stmt.get('orelse', [])

        body_lines = [self._generate_statement(s) for s in body]
        body_code = '\n'.join(body_lines) if body_lines else 'pass'

        result = f"if {test}:\n{self._indent(body_code)}"

        if orelse:
            orelse_lines = [self._generate_statement(s) for s in orelse]
            orelse_code = '\n'.join(orelse_lines) if orelse_lines else 'pass'
            result += f"\nelse:\n{self._indent(orelse_code)}"

        return result

    def _generate_while_loop(self, stmt: Dict[str, Any]) -> str:
        """Generate Python while loop."""
        condition = self._generate_expression(stmt.get('condition', {'type': 'constant', 'value': True}))
        body = stmt.get('body', [])
        orelse = stmt.get('orelse', [])

        body_lines = [self._generate_statement(s) for s in body]
        body_code = '\n'.join(body_lines) if body_lines else 'pass'

        result = f"while {condition}:\n{self._indent(body_code)}"

        if orelse:
            orelse_lines = [self._generate_statement(s) for s in orelse]
            orelse_code = '\n'.join(orelse_lines)
            result += f"\nelse:\n{self._indent(orelse_code)}"

        return result

    def _generate_expression(self, expr: Any) -> str:
        """Generate Python expression from a rule."""
        # Handle None
        if expr is None:
            return 'None'

        # Handle primitives
        if not isinstance(expr, dict):
            if isinstance(expr, bool):
                return 'True' if expr else 'False'
            elif isinstance(expr, str):
                return repr(expr)
            return str(expr)

        expr_type = expr.get('type', '')

        # Dispatch based on expression type
        handlers = {
            'constant': self._expr_constant,
            'value': self._expr_constant,  # alias
            'name': self._expr_name,
            'item_check': self._expr_item_check,
            'count_check': self._expr_count_check,
            'group_check': self._expr_group_check,
            'and': self._expr_and,
            'or': self._expr_or,
            'not': self._expr_not,
            'compare': self._expr_compare,
            'comparison': self._expr_compare,  # alias
            'binary_op': self._expr_binary_op,
            'binop': self._expr_binary_op,  # alias
            'conditional': self._expr_conditional,
            'helper': self._expr_helper,
            'state_method': self._expr_state_method,
            'subscript': self._expr_subscript,
            'index': self._expr_subscript,  # alias
            'attribute': self._expr_attribute,
            'function_call': self._expr_function_call,
            'method_call': self._expr_method_call,
            'list': self._expr_list,
            'tuple': self._expr_tuple,
            'set': self._expr_set,
            'negate': self._expr_negate,
            'can_reach': self._expr_can_reach,
            'can_reach_entrance': self._expr_can_reach_entrance,
            'location_check': self._expr_location_check,
            'count_item': self._expr_count_item,
            'group_count': self._expr_group_count,
            'setting_value': self._expr_setting_value,
            'prog_item_count': self._expr_prog_item_count,
        }

        handler = handlers.get(expr_type)
        if handler:
            return handler(expr)

        # Unknown type - return True as placeholder
        return 'True'

    def _expr_setting_value(self, expr: Dict[str, Any]) -> str:
        """Resolve a setting value to its actual value from the seed's settings."""
        setting = expr.get('setting', '')
        # Look up the setting value in the resolved settings from rules.json
        # If the setting was captured during export, use its value
        if setting in self.settings:
            value = self.settings[setting]
            if isinstance(value, bool):
                return 'True' if value else 'False'
            elif isinstance(value, str):
                return repr(value)
            else:
                return str(value)
        # If not found in settings, default to False for safety
        # This prevents inaccessible regions from being created with always-True rules
        return 'False'

    def _expr_constant(self, expr: Dict[str, Any]) -> str:
        """Generate constant expression."""
        value = expr.get('value')
        if value is None:
            return 'None'
        if isinstance(value, bool):
            return 'True' if value else 'False'
        if isinstance(value, str):
            return repr(value)
        if isinstance(value, list):
            items = [self._generate_expression({'type': 'constant', 'value': v}) for v in value]
            return f"[{', '.join(items)}]"
        if isinstance(value, dict):
            # Handle dict constants - convert string keys that look like integers
            items = []
            for k, v in value.items():
                # Try to convert string keys that look like integers
                try:
                    key_repr = str(int(k))
                except (ValueError, TypeError):
                    key_repr = repr(k)
                val_repr = self._generate_expression({'type': 'constant', 'value': v})
                items.append(f"{key_repr}: {val_repr}")
            return "{" + ", ".join(items) + "}"
        return str(value)

    def _expr_name(self, expr: Dict[str, Any]) -> str:
        """Generate variable name reference."""
        name = expr.get('name', '_')
        # In helper functions, 'world' isn't available directly - access via state
        if name == 'world':
            return 'state.multiworld.worlds[player]'
        return name

    def _expr_item_check(self, expr: Dict[str, Any]) -> str:
        """Generate state.has() call."""
        item_raw = expr.get('item', '')
        count_raw = expr.get('count', 1)

        # Handle item - could be a constant string or a variable/expression
        if isinstance(item_raw, dict):
            if item_raw.get('type') == 'constant':
                item_expr = repr(item_raw.get('value', ''))
            else:
                # Variable reference or complex expression (e.g., dict[hat])
                item_expr = self._generate_expression(item_raw)
        elif isinstance(item_raw, str):
            item_expr = repr(item_raw)
        else:
            item_expr = repr(str(item_raw))

        # Handle count - could be a constant or a complex expression
        if isinstance(count_raw, dict):
            if count_raw.get('type') == 'constant':
                count_expr = str(count_raw.get('value', 1))
            else:
                # Complex expression (e.g., get_hat_cost(hat))
                count_expr = self._generate_expression(count_raw)
        elif isinstance(count_raw, (int, float)):
            count_expr = str(int(count_raw))
        else:
            count_expr = '1'

        if count_expr == '1':
            return f'state.has({item_expr}, player)'
        return f'state.has({item_expr}, player, {count_expr})'

    def _expr_count_check(self, expr: Dict[str, Any]) -> str:
        """Generate state.has() with count check."""
        item_raw = expr.get('item', '')
        count_raw = expr.get('count', 1)

        # Handle item - could be a constant string or a variable/expression
        if isinstance(item_raw, dict):
            if item_raw.get('type') == 'constant':
                item_expr = repr(item_raw.get('value', ''))
            else:
                item_expr = self._generate_expression(item_raw)
        elif isinstance(item_raw, str):
            item_expr = repr(item_raw)
        else:
            item_expr = repr(str(item_raw))

        # Handle count - could be a constant or a complex expression
        if isinstance(count_raw, dict):
            if count_raw.get('type') == 'constant':
                count_expr = str(count_raw.get('value', 1))
            else:
                count_expr = self._generate_expression(count_raw)
        elif isinstance(count_raw, (int, float)):
            count_expr = str(int(count_raw))
        else:
            count_expr = '1'

        return f'state.has({item_expr}, player, {count_expr})'

    def _expr_group_check(self, expr: Dict[str, Any]) -> str:
        """Generate state.has_group() call."""
        group_raw = expr.get('group', '')
        count_raw = expr.get('count', 1)

        # Handle group - could be a constant string or a variable reference
        if isinstance(group_raw, dict):
            if group_raw.get('type') == 'constant':
                group_expr = repr(group_raw.get('value', ''))
            else:
                # Variable reference or other expression - generate the expression
                group_expr = self._generate_expression(group_raw)
        elif isinstance(group_raw, str):
            group_expr = repr(group_raw)
        else:
            group_expr = repr(str(group_raw))

        # Handle count - could be a constant or a complex expression
        if isinstance(count_raw, dict):
            if count_raw.get('type') == 'constant':
                count_expr = str(count_raw.get('value', 1))
            else:
                # Complex expression (e.g., len(world.item_name_groups[relic]))
                count_expr = self._generate_expression(count_raw)
        elif isinstance(count_raw, (int, float)):
            count_expr = str(int(count_raw))
        else:
            count_expr = '1'

        if count_expr == '1':
            return f'state.has_group({group_expr}, player)'
        return f'state.has_group({group_expr}, player, {count_expr})'

    def _expr_and(self, expr: Dict[str, Any]) -> str:
        """Generate and expression."""
        conditions = expr.get('conditions', [])
        if not conditions:
            return 'True'
        if len(conditions) == 1:
            return self._generate_expression(conditions[0])

        parts = [f"({self._generate_expression(c)})" for c in conditions]
        return ' and '.join(parts)

    def _expr_or(self, expr: Dict[str, Any]) -> str:
        """Generate or expression."""
        conditions = expr.get('conditions', [])
        if not conditions:
            return 'False'
        if len(conditions) == 1:
            return self._generate_expression(conditions[0])

        parts = [f"({self._generate_expression(c)})" for c in conditions]
        return ' or '.join(parts)

    def _expr_not(self, expr: Dict[str, Any]) -> str:
        """Generate not expression."""
        inner = expr.get('condition', expr.get('operand', expr.get('value', {})))
        return f"not ({self._generate_expression(inner)})"

    def _expr_compare(self, expr: Dict[str, Any]) -> str:
        """Generate comparison expression."""
        left = self._generate_expression(expr.get('left', {}))
        op = expr.get('op', '==')
        right = self._generate_expression(expr.get('right', {}))

        # Handle 'in' and 'not in' operators
        if op == 'in':
            return f"({left} in {right})"
        elif op == 'not in':
            return f"({left} not in {right})"

        return f"({left} {op} {right})"

    def _expr_binary_op(self, expr: Dict[str, Any]) -> str:
        """Generate binary operation expression."""
        left = self._generate_expression(expr.get('left', {}))
        op = expr.get('op', '+')
        right = self._generate_expression(expr.get('right', {}))

        # Map Python operators
        op_map = {
            'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/',
            'FloorDiv': '//', 'Mod': '%', 'Pow': '**',
            'BitAnd': '&', 'BitOr': '|', 'BitXor': '^',
            'And': 'and', 'Or': 'or',
        }
        op = op_map.get(op, op)

        return f"({left} {op} {right})"

    def _expr_conditional(self, expr: Dict[str, Any]) -> str:
        """Generate conditional (ternary) expression."""
        test = self._generate_expression(expr.get('test', {}))
        if_true = self._generate_expression(expr.get('if_true', {}))
        if_false = expr.get('if_false')

        if if_false is None:
            # No else branch - return None if condition false
            return f"({if_true} if {test} else None)"

        if_false_code = self._generate_expression(if_false)
        return f"({if_true} if {test} else {if_false_code})"

    def _expr_helper(self, expr: Dict[str, Any]) -> str:
        """Generate helper function call."""
        name = expr.get('name', '')
        args = expr.get('args', [])

        # Check if this helper exists
        if name in self.known_helpers:
            return self.get_helper_call(name, args)

        # Built-in Python functions
        if name in ('any', 'all', 'len', 'sum', 'min', 'max', 'sorted', 'list', 'iter', 'next', 'bool', 'int', 'str', 'float'):
            arg_exprs = [self._generate_expression(a) for a in args]
            return f"{name}({', '.join(arg_exprs)})"

        # Unknown helper - return True as safe fallback
        # This handles helpers that were blacklisted during export (too complex to export)
        # Returning True makes the location always accessible, which is safer than crashing
        return 'True'

    def _expr_state_method(self, expr: Dict[str, Any]) -> str:
        """Generate state method call."""
        method = expr.get('method', '')
        args = expr.get('args', [])

        # Map methods to their Python equivalents
        if method == 'has':
            if len(args) >= 1:
                item = self._extract_constant(args[0], '')
                count = self._extract_constant(args[1], 1) if len(args) > 1 else 1
                if count == 1:
                    return f'state.has({repr(item)}, player)'
                return f'state.has({repr(item)}, player, {count})'

        elif method == 'has_all':
            if len(args) >= 1:
                items = self._extract_constant(args[0], [])
                items_repr = repr(tuple(items)) if items else '()'
                return f'state.has_all({items_repr}, player)'

        elif method == 'has_any':
            if len(args) >= 1:
                items = self._extract_constant(args[0], [])
                items_repr = repr(tuple(items)) if items else '()'
                return f'state.has_any({items_repr}, player)'

        elif method == 'count':
            if len(args) >= 1:
                item = self._extract_constant(args[0], '')
                return f'state.count({repr(item)}, player)'

        elif method == 'count_group':
            if len(args) >= 1:
                group = self._extract_constant(args[0], '')
                return f'state.count_group({repr(group)}, player)'

        elif method == 'has_group':
            if len(args) >= 1:
                group = self._extract_constant(args[0], '')
                count = self._extract_constant(args[1], 1) if len(args) > 1 else 1
                if count == 1:
                    return f'state.has_group({repr(group)}, player)'
                return f'state.has_group({repr(group)}, player, {count})'

        elif method == 'can_reach':
            if len(args) >= 1:
                region = self._extract_constant(args[0], '')
                return f'state.can_reach({repr(region)}, "Region", player)'

        elif method == 'can_reach_location':
            if len(args) >= 1:
                location = self._extract_constant(args[0], '')
                return f'state.can_reach_location({repr(location)}, player)'

        # Generic fallback
        arg_exprs = [self._generate_expression(a) for a in args]
        return f'state.{method}({", ".join(arg_exprs)}, player)'

    def _expr_subscript(self, expr: Dict[str, Any]) -> str:
        """Generate subscript/index expression."""
        value = self._generate_expression(expr.get('value', expr.get('object', {})))
        index = self._generate_expression(expr.get('index', {}))
        return f"{value}[{index}]"

    def _expr_attribute(self, expr: Dict[str, Any]) -> str:
        """Generate attribute access expression."""
        obj_expr = expr.get('object', {})
        attr = expr.get('attr', '')

        # Special case: when accessing .value on a setting_value, the setting_value
        # is already resolved to its actual value, so just return it directly.
        # This handles cases like world.options.goal.value where we captured the
        # setting as setting_value and now just need the numeric/boolean value.
        if isinstance(obj_expr, dict) and obj_expr.get('type') == 'setting_value' and attr == 'value':
            return self._generate_expression(obj_expr)

        obj = self._generate_expression(obj_expr)
        return f"{obj}.{attr}"

    def _expr_function_call(self, expr: Dict[str, Any]) -> str:
        """Generate function call expression."""
        func = expr.get('function', {})
        args = expr.get('args', [])

        func_code = self._generate_expression(func)
        arg_exprs = [self._generate_expression(a) for a in args]

        # Special handling for state.multiworld.get_location - needs player argument
        # The exported helper body may be missing the player argument
        if func_code == 'state.multiworld.get_location' and len(arg_exprs) == 1:
            arg_exprs.append('player')

        return f"{func_code}({', '.join(arg_exprs)})"

    def _expr_method_call(self, expr: Dict[str, Any]) -> str:
        """Generate method call expression."""
        obj = self._generate_expression(expr.get('object', {}))
        method = expr.get('method', '')
        args = expr.get('args', [])

        arg_exprs = [self._generate_expression(a) for a in args]

        return f"{obj}.{method}({', '.join(arg_exprs)})"

    def _expr_list(self, expr: Dict[str, Any]) -> str:
        """Generate list literal."""
        values = expr.get('value', expr.get('elements', []))
        items = [self._generate_expression(v) for v in values]
        return f"[{', '.join(items)}]"

    def _expr_tuple(self, expr: Dict[str, Any]) -> str:
        """Generate tuple literal."""
        elements = expr.get('elements', [])
        items = [self._generate_expression(e) for e in elements]
        if len(items) == 1:
            return f"({items[0]},)"
        return f"({', '.join(items)})"

    def _expr_set(self, expr: Dict[str, Any]) -> str:
        """Generate set literal."""
        elements = expr.get('elements', [])
        items = [self._generate_expression(e) for e in elements]
        if not items:
            return 'set()'
        return f"{{{', '.join(items)}}}"

    def _expr_negate(self, expr: Dict[str, Any]) -> str:
        """Generate unary negation."""
        operand = self._generate_expression(expr.get('operand', {}))
        return f"-({operand})"

    def _expr_can_reach(self, expr: Dict[str, Any]) -> str:
        """Generate state.can_reach() for region."""
        region_raw = expr.get('region', '')
        # Handle region - could be a constant string or a variable/expression
        if isinstance(region_raw, dict):
            if region_raw.get('type') == 'constant':
                region_expr = repr(region_raw.get('value', ''))
            else:
                region_expr = self._generate_expression(region_raw)
        elif isinstance(region_raw, str):
            region_expr = repr(region_raw)
        else:
            region_expr = repr(str(region_raw))
        return f'state.can_reach({region_expr}, "Region", player)'

    def _expr_can_reach_entrance(self, expr: Dict[str, Any]) -> str:
        """Generate state.can_reach() for entrance."""
        entrance_raw = expr.get('entrance', '')
        # Handle entrance - could be a constant string or a variable/expression
        if isinstance(entrance_raw, dict):
            if entrance_raw.get('type') == 'constant':
                entrance_expr = repr(entrance_raw.get('value', ''))
            else:
                entrance_expr = self._generate_expression(entrance_raw)
        elif isinstance(entrance_raw, str):
            entrance_expr = repr(entrance_raw)
        else:
            entrance_expr = repr(str(entrance_raw))
        return f'state.can_reach({entrance_expr}, "Entrance", player)'

    def _expr_location_check(self, expr: Dict[str, Any]) -> str:
        """Generate location accessibility check."""
        location_raw = expr.get('location', '')
        # Handle location - could be a constant string or a variable/expression
        if isinstance(location_raw, dict):
            if location_raw.get('type') == 'constant':
                location_expr = repr(location_raw.get('value', ''))
            else:
                location_expr = self._generate_expression(location_raw)
        elif isinstance(location_raw, str):
            location_expr = repr(location_raw)
        else:
            location_expr = repr(str(location_raw))
        return f'state.can_reach_location({location_expr}, player)'

    def _expr_count_item(self, expr: Dict[str, Any]) -> str:
        """Generate state.count() for item."""
        item_raw = expr.get('item', '')
        item = self._extract_constant(item_raw, '')
        return f'state.count({repr(item)}, player)'

    def _expr_group_count(self, expr: Dict[str, Any]) -> str:
        """Generate state.count_group() for group."""
        group_raw = expr.get('group', '')
        group = self._extract_constant(group_raw, '')
        return f'state.count_group({repr(group)}, player)'

    def _expr_prog_item_count(self, expr: Dict[str, Any]) -> str:
        """Generate state.prog_items access for counter items like coins.

        CC export format: {"type": "prog_item_count", "key": " coins"}
        This accesses state.prog_items[player][key] which counts accumulated items.
        """
        key = expr.get('key', '')
        key_escaped = key.replace('\\', '\\\\').replace("'", "\\'")
        return f"state.prog_items[player].get('{key_escaped}', 0)"

    def _extract_constant(self, value: Any, default: Any = None) -> Any:
        """Extract constant value from a potential constant wrapper."""
        if isinstance(value, dict):
            if value.get('type') == 'constant':
                return value.get('value', default)
            if value.get('type') == 'value':
                return value.get('value', default)
            if value.get('type') == 'set':
                # Extract all elements from the set
                elements = value.get('elements', [])
                return [self._extract_constant(elem, None) for elem in elements if self._extract_constant(elem, None) is not None]
            return default
        return value if value is not None else default
