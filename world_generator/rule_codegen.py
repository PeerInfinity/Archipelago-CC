"""
Rule code generator - converts CC format rules to Python Rule Builder code.

This module transforms JSON rule definitions into Python source code
that uses the Rule Builder pattern.
"""

from typing import Any, Dict, List, Set, Tuple, Optional


class RuleCodeGenerator:
    """Generates Python Rule Builder code from CC format rules."""

    def __init__(self) -> None:
        self.required_imports: Set[str] = set()

    def reset(self) -> None:
        """Reset state for a new generation run."""
        self.required_imports = set()

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
            'location_check': self._convert_location_check,
            'can_reach_entrance': self._convert_can_reach_entrance,
            'state_method': self._convert_state_method,
            'not': self._convert_not,
            'helper': self._convert_helper,
            'compare': self._convert_compare,
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
        """
        if not args:
            return f'{class_name}()'

        # First arg should be a constant with the list
        first_arg = args[0]
        if first_arg.get('type') == 'constant':
            items = first_arg.get('value', [])
            if not items:
                return f'{class_name}()'
            # Unpack the items as separate arguments
            items_repr = ', '.join(repr(item) for item in items)
            return f'{class_name}({items_repr})'

        return f'{class_name}()'

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
        Convert compare rule to Has() if it matches the prog_items pattern.

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

        # Unknown compare pattern - return True_() as placeholder
        return 'True_()'

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
        Returns the item_name string if the pattern matches, None otherwise.
        """
        # Expected structure:
        # {"type": "subscript", "value": {...}, "index": {"type": "constant", "value": "item_name"}}
        if not isinstance(expr, dict) or expr.get('type') != 'subscript':
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
        """Convert not rule - Rule Builder doesn't have Not, use lambda fallback."""
        inner = rule.get('condition', rule.get('value', {}))
        inner_code = self._convert_rule(inner)

        # Note: Rule Builder doesn't have a Not class
        # Return True_() as a placeholder - NOT logic needs manual review
        # Don't use inline comments as they break when combined with & or |
        return 'True_()'

    def _convert_helper(self, rule: Dict[str, Any]) -> str:
        """Convert helper rule - these are custom functions."""
        # Helper functions are game-specific and can't be auto-generated
        # Return True_() as a placeholder - don't use inline comments
        # as they break when combined with & or | in expressions
        return 'True_()'


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
