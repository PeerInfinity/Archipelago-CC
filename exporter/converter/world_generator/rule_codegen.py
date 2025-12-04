"""
Rule code generator - converts CC format rules to Python Rule Builder code.

This module transforms JSON rule definitions into Python source code
that uses the Rule Builder pattern.
"""

from typing import Any, Dict, List, Set, Tuple, Optional


class RuleCodeGenerator:
    """Generates Python Rule Builder code from CC format rules."""

    def __init__(self):
        self.required_imports: Set[str] = set()

    def reset(self):
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
        }

        converter = converters.get(rule_type)
        if converter:
            return converter(rule)

        # Unknown rule type - generate a comment
        return f'True_()  # TODO: Unknown rule type: {rule_type}'

    def _convert_constant(self, rule: Dict[str, Any]) -> str:
        """Convert constant true/false rule."""
        value = rule.get('value', True)
        if value:
            self.required_imports.add('True_')
            return 'True_()'
        else:
            self.required_imports.add('False_')
            return 'False_()'

    def _convert_item_check(self, rule: Dict[str, Any]) -> str:
        """Convert item_check to Has()."""
        self.required_imports.add('Has')

        item = rule.get('item', '')
        count = rule.get('count', 1)

        # Escape item name for Python string
        item_escaped = item.replace('\\', '\\\\').replace('"', '\\"')

        if count == 1:
            return f'Has("{item_escaped}")'
        else:
            return f'Has("{item_escaped}", {count})'

    def _convert_group_check(self, rule: Dict[str, Any]) -> str:
        """Convert group_check to HasGroup()."""
        self.required_imports.add('HasGroup')

        group = rule.get('group', '')
        count = rule.get('count', 1)

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

        region = rule.get('region', '')
        region_escaped = region.replace('\\', '\\\\').replace('"', '\\"')

        return f'CanReachRegion("{region_escaped}")'

    def _convert_location_check(self, rule: Dict[str, Any]) -> str:
        """Convert location_check to CanReachLocation()."""
        self.required_imports.add('CanReachLocation')

        location = rule.get('location', '')
        location_escaped = location.replace('\\', '\\\\').replace('"', '\\"')

        return f'CanReachLocation("{location_escaped}")'

    def _convert_can_reach_entrance(self, rule: Dict[str, Any]) -> str:
        """Convert can_reach_entrance to CanReachEntrance()."""
        self.required_imports.add('CanReachEntrance')

        entrance = rule.get('entrance', '')
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

        # Unknown state method - generate placeholder
        return f'True_()  # TODO: state_method {method}'

    def _extract_item_list(self, class_name: str, args: List[Dict]) -> str:
        """Extract item list for HasAll/HasAny."""
        if not args:
            return f'{class_name}([])'

        # First arg should be a constant with the list
        first_arg = args[0]
        if first_arg.get('type') == 'constant':
            items = first_arg.get('value', [])
            items_repr = repr(items)
            return f'{class_name}({items_repr})'

        return f'{class_name}([])  # TODO: complex args'

    def _extract_item_dict(self, class_name: str, args: List[Dict]) -> str:
        """Extract item dict for HasAllCounts."""
        if not args:
            return f'{class_name}({{}})'

        first_arg = args[0]
        if first_arg.get('type') == 'constant':
            items = first_arg.get('value', {})
            items_repr = repr(items)
            return f'{class_name}({items_repr})'

        return f'{class_name}({{}})  # TODO: complex args'

    def _extract_item_list_with_count(self, class_name: str, args: List[Dict]) -> str:
        """Extract item list and count for HasFromList."""
        items = []
        count = 1

        if len(args) >= 1 and args[0].get('type') == 'constant':
            items = args[0].get('value', [])
        if len(args) >= 2 and args[1].get('type') == 'constant':
            count = args[1].get('value', 1)

        return f'{class_name}({repr(items)}, {count})'

    def _extract_group_with_count(self, class_name: str, args: List[Dict]) -> str:
        """Extract group and count for HasGroupUnique."""
        group = ''
        count = 1

        if len(args) >= 1 and args[0].get('type') == 'constant':
            group = args[0].get('value', '')
        if len(args) >= 2 and args[1].get('type') == 'constant':
            count = args[1].get('value', 1)

        return f'{class_name}("{group}", {count})'

    def _convert_not(self, rule: Dict[str, Any]) -> str:
        """Convert not rule - Rule Builder doesn't have Not, use lambda fallback."""
        inner = rule.get('condition', rule.get('value', {}))
        inner_code = self._convert_rule(inner)

        # Note: Rule Builder doesn't have a Not class
        # We'll generate a comment suggesting manual review
        return f'True_()  # TODO: NOT({inner_code}) - needs manual implementation'

    def _convert_helper(self, rule: Dict[str, Any]) -> str:
        """Convert helper rule - these are custom functions."""
        name = rule.get('name', 'unknown')
        args = rule.get('args', [])

        # Helper functions need manual implementation
        args_str = ', '.join(repr(a.get('value', a)) if isinstance(a, dict) else repr(a) for a in args)
        return f'True_()  # TODO: helper {name}({args_str})'


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
