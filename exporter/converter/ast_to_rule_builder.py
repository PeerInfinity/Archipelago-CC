"""
Converter from AST format to Rule Builder format (PR #5048).

AST Format (A):
    {
        "type": "item_check",
        "item": "Sword",
        "count": 1
    }

Rule Builder Format (B):
    {
        "rule": "Has",
        "options": [],
        "args": {"item_name": "Sword", "count": 1}
    }

This converter supports round-trip conversion, preserving metadata from
previous B → A conversions to enable lossless round-trips.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class ConversionResult:
    """Result of a rule conversion operation."""
    rule: Dict[str, Any]
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)

    @property
    def success(self) -> bool:
        return len(self.errors) == 0


class ASTToRuleBuilder:
    """
    Converter from AST format to Rule Builder format.

    Handles conversion of:
    - Constants (true/false)
    - Item checks (item_check, count_check, group_check)
    - State methods (has_all, has_any, etc.)
    - Composite rules (and, or, not)
    - Reachability checks (can_reach, location_check, can_reach_entrance)
    - Conditionals (conditional → Filtered with options)
    - Helpers (preserved with metadata for round-trip)

    Round-trip support:
    - Detects `_converted_from_rule_builder` metadata
    - Uses `_original_args` to restore original Rule Builder format
    """

    # Mapping of AST types to converter methods
    TYPE_CONVERTERS = {}

    def __init__(self):
        self.warnings: List[str] = []
        self.errors: List[str] = []
        self._init_converters()

    def _init_converters(self):
        """Initialize the type converter mapping."""
        self.TYPE_CONVERTERS = {
            # Constants
            'constant': self._convert_constant,

            # Item rules
            'item_check': self._convert_item_check,
            'count_check': self._convert_count_check,
            'group_check': self._convert_group_check,

            # State methods
            'state_method': self._convert_state_method,

            # Composite rules
            'and': self._convert_and,
            'or': self._convert_or,
            'not': self._convert_not,

            # Reachability
            'can_reach': self._convert_can_reach,
            'location_check': self._convert_location_check,
            'can_reach_entrance': self._convert_can_reach_entrance,

            # Conditionals (option filters)
            'conditional': self._convert_conditional,

            # Helpers (game-specific or custom)
            'helper': self._convert_helper,

            # Complex expressions (limited support)
            'compare': self._convert_compare,
            'binary_op': self._convert_binary_op,

            # Preserved types
            'attribute': self._convert_attribute,
            'name': self._convert_name,
            'list': self._convert_list,
            'tuple': self._convert_tuple,

            # ALTTP-specific types
            'placement_search': self._convert_placement_search,
            'placement_lookup': self._convert_placement_lookup,
        }

    def convert(self, rule: Dict[str, Any]) -> ConversionResult:
        """
        Convert an AST format rule to Rule Builder format.

        Args:
            rule: Rule in AST format

        Returns:
            ConversionResult with converted rule and any warnings/errors
        """
        self.warnings = []
        self.errors = []

        try:
            converted = self._convert_rule(rule)
            return ConversionResult(
                rule=converted,
                warnings=self.warnings.copy(),
                errors=self.errors.copy()
            )
        except Exception as e:
            self.errors.append(f"Conversion failed: {str(e)}")
            return ConversionResult(
                rule=self._make_custom_rule('ConversionError', {'error': str(e), 'original': rule}),
                warnings=self.warnings.copy(),
                errors=self.errors.copy()
            )

    def _convert_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Internal method to convert a single rule.

        Args:
            rule: Rule in AST format

        Returns:
            Rule in Rule Builder format
        """
        if not isinstance(rule, dict):
            # Handle primitive values as constants
            return self._make_rule('True_' if rule else 'False_', {}) if isinstance(rule, bool) else \
                   self._make_custom_rule('Constant', {'value': rule})

        # Check for round-trip metadata first
        if rule.get('_converted_from_rule_builder'):
            return self._restore_from_round_trip(rule)

        # Check if already in Rule Builder format
        if 'rule' in rule and 'options' in rule:
            return rule

        rule_type = rule.get('type')
        if not rule_type:
            self.warnings.append(f"Rule missing 'type' field: {rule}")
            return self._make_custom_rule('Unknown', {'original': rule})

        # Look up converter
        converter = self.TYPE_CONVERTERS.get(rule_type)
        if converter:
            return converter(rule)

        # Unknown type - preserve as custom rule
        return self._convert_unknown(rule)

    def _restore_from_round_trip(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Restore original Rule Builder format from round-trip metadata.

        This enables lossless B → A → B conversion.
        """
        rule_name = rule.get('name', 'Unknown')
        original_args = rule.get('_original_args', {})

        # Reconstruct the original Rule Builder format
        result = {
            'rule': rule_name,
            'options': [],
            'args': original_args
        }

        # Check if there were children (for composite rules)
        if 'args' in rule:
            for arg in rule['args']:
                if isinstance(arg, dict) and arg.get('type') == 'list':
                    # This might be children from a composite rule
                    children = arg.get('value', [])
                    if children and all(isinstance(c, dict) for c in children):
                        result['children'] = [self._convert_rule(c) for c in children]
                        if 'args' in result:
                            del result['args']
                        break

        return result

    def _make_rule(self, rule_name: str, args: Dict[str, Any], options: List[Dict] = None) -> Dict[str, Any]:
        """Create a Rule Builder format rule."""
        return {
            'rule': rule_name,
            'options': options or [],
            'args': args
        }

    def _make_composite_rule(self, rule_name: str, children: List[Dict], options: List[Dict] = None) -> Dict[str, Any]:
        """Create a composite Rule Builder format rule (And/Or)."""
        return {
            'rule': rule_name,
            'options': options or [],
            'children': children
        }

    def _make_custom_rule(self, rule_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Create a custom rule that preserves AST format data for round-trip."""
        result = self._make_rule(rule_name, args)
        result['_converted_from_cc'] = True
        return result

    def _extract_constant_value(self, value: Any) -> Tuple[Any, bool]:
        """
        Extract the value from a constant wrapper if present.

        Args:
            value: Either a primitive value or a dict with {type: "constant", value: X}

        Returns:
            Tuple of (extracted_value, was_constant)
            - If value is {type: "constant", value: X}, returns (X, True)
            - Otherwise returns (value, False)
        """
        if isinstance(value, dict) and value.get('type') == 'constant':
            return value.get('value'), True
        return value, False

    def _try_extract_constant(self, value: Any) -> Any:
        """
        Try to extract a constant value, returning the original if not a constant.

        Convenience wrapper around _extract_constant_value.
        """
        extracted, _ = self._extract_constant_value(value)
        return extracted

    # -------------------------------------------------------------------------
    # Constant Converters
    # -------------------------------------------------------------------------

    def _convert_constant(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert constant rule.

        AST: {"type": "constant", "value": true}
        RB: {"rule": "True_", "options": [], "args": {}}
        """
        value = rule.get('value')

        if value is True:
            return self._make_rule('True_', {})
        elif value is False:
            return self._make_rule('False_', {})
        else:
            # Non-boolean constant - preserve as custom rule
            return self._make_custom_rule('Constant', {'value': value})

    # -------------------------------------------------------------------------
    # Item Rule Converters
    # -------------------------------------------------------------------------

    def _convert_item_check(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert item_check rule.

        AST: {"type": "item_check", "item": "Sword", "count": 2}
        RB: {"rule": "Has", "options": [], "args": {"item_name": "Sword", "count": 2}}

        Also handles wrapped constants:
        AST: {"type": "item_check", "item": {"type": "constant", "value": "Sword"}}
        RB: {"rule": "Has", "options": [], "args": {"item_name": "Sword"}}
        """
        item = rule.get('item', '')
        count = rule.get('count', 1)

        # Try to extract constant values
        item_value, item_was_constant = self._extract_constant_value(item)
        count_value, count_was_constant = self._extract_constant_value(count)

        # If item resolved to a simple value, use standard Has rule
        if isinstance(item_value, str):
            args = {'item_name': item_value}
            if isinstance(count_value, (int, float)) and count_value != 1:
                args['count'] = count_value
            elif isinstance(count, dict) and not count_was_constant:
                # Count is a complex expression - preserve it
                args['count'] = self._convert_rule(count)
            return self._make_rule('Has', args)

        # Complex item reference that couldn't be resolved - preserve as custom rule
        if isinstance(item, dict):
            return self._make_custom_rule('ItemCheck', {
                'item': self._convert_rule(item),
                'count': self._convert_rule(count) if isinstance(count, dict) else count,
                '_original_ast_type': 'item_check'
            })

        # Simple string item
        args = {'item_name': item}
        if count != 1:
            args['count'] = count

        return self._make_rule('Has', args)

    def _convert_count_check(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert count_check rule.

        AST: {"type": "count_check", "item": "Arrow", "count": 10}
        RB: {"rule": "Has", "options": [], "args": {"item_name": "Arrow", "count": 10}}

        Also handles wrapped constants:
        AST: {"type": "count_check", "item": {"type": "constant", "value": "Arrow"}, "count": {"type": "constant", "value": 10}}
        RB: {"rule": "Has", "options": [], "args": {"item_name": "Arrow", "count": 10}}
        """
        item = rule.get('item', '')
        count = rule.get('count', 1)

        # Try to extract constant values
        item_value, item_was_constant = self._extract_constant_value(item)
        count_value, count_was_constant = self._extract_constant_value(count)

        # If both resolved to simple values, use standard Has rule
        if isinstance(item_value, str) and isinstance(count_value, (int, float)):
            return self._make_rule('Has', {'item_name': item_value, 'count': count_value})

        # If item resolved but count is complex
        if isinstance(item_value, str):
            return self._make_rule('Has', {
                'item_name': item_value,
                'count': self._convert_rule(count) if isinstance(count, dict) else count
            })

        # Complex item/count that couldn't be fully resolved - preserve as custom rule
        if isinstance(item, dict) or isinstance(count, dict):
            return self._make_custom_rule('CountCheck', {
                'item': self._convert_rule(item) if isinstance(item, dict) else item,
                'count': self._convert_rule(count) if isinstance(count, dict) else count,
                '_original_ast_type': 'count_check'
            })

        return self._make_rule('Has', {'item_name': item, 'count': count})

    def _convert_group_check(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert group_check rule.

        AST: {"type": "group_check", "group": "Keys", "count": 3}
        RB: {"rule": "HasGroup", "options": [], "args": {"group": "Keys", "count": 3}}
        """
        group = rule.get('group', '')
        count = rule.get('count', 1)

        args = {'group': group}
        if count != 1:
            args['count'] = count

        return self._make_rule('HasGroup', args)

    # -------------------------------------------------------------------------
    # State Method Converters
    # -------------------------------------------------------------------------

    def _convert_state_method(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert state_method rules.

        Handles: has_all, has_any, has_all_counts, has_from_list, has_group_unique, etc.
        """
        method = rule.get('method', '')
        args = rule.get('args', [])

        # Extract the first argument's value if it's a constant
        def get_arg_value(index: int, default=None):
            if index < len(args):
                arg = args[index]
                if isinstance(arg, dict) and arg.get('type') == 'constant':
                    return arg.get('value', default)
                return arg
            return default

        # Helper to extract item list from a set or list argument
        def get_items_from_arg(arg, default=None):
            if isinstance(arg, list):
                return arg
            if isinstance(arg, dict):
                if arg.get('type') == 'set':
                    # Extract item values from set elements
                    elements = arg.get('elements', [])
                    return [
                        el.get('value') if isinstance(el, dict) and el.get('type') == 'constant' else el
                        for el in elements
                    ]
                if arg.get('type') == 'list':
                    # Extract item values from list value
                    values = arg.get('value', [])
                    return [
                        v.get('value') if isinstance(v, dict) and v.get('type') == 'constant' else v
                        for v in values
                    ]
            return default

        if method == 'has_all':
            items = get_items_from_arg(get_arg_value(0, []), [])
            if isinstance(items, list) and len(items) > 0:
                return self._make_rule('HasAll', {'items': items})

        elif method == 'has_any':
            items = get_items_from_arg(get_arg_value(0, []), [])
            if isinstance(items, list) and len(items) > 0:
                return self._make_rule('HasAny', {'items': items})

        elif method == 'has_all_counts':
            items = get_arg_value(0, {})
            if isinstance(items, dict):
                return self._make_rule('HasAllCounts', {'items': items})

        elif method == 'has_from_list':
            items = get_arg_value(0, [])
            count = get_arg_value(1, 1)
            return self._make_rule('HasFromList', {'items': items, 'count': count})

        elif method == 'has_from_list_unique':
            items = get_arg_value(0, [])
            count = get_arg_value(1, 1)
            return self._make_rule('HasFromListUnique', {'items': items, 'count': count})

        elif method == 'has_group_unique':
            group = get_arg_value(0, '')
            count = get_arg_value(1, 1)
            return self._make_rule('HasGroupUnique', {'group': group, 'count': count})

        elif method == 'has':
            # Simple has call
            item = get_arg_value(0, '')
            count = get_arg_value(1, 1)
            args_dict = {'item_name': item}
            if count != 1:
                args_dict['count'] = count
            return self._make_rule('Has', args_dict)

        elif method == 'can_reach':
            # can_reach state method
            name = get_arg_value(0, '')
            reach_type = get_arg_value(1, 'Region')
            if reach_type == 'Location':
                return self._make_rule('CanReachLocation', {'location_name': name})
            else:
                return self._make_rule('CanReachRegion', {'region_name': name})

        elif method == 'can_reach_region':
            # can_reach_region state method (direct region name)
            name = get_arg_value(0, '')
            if isinstance(name, str):
                return self._make_rule('CanReachRegion', {'region_name': name})
            # Fall through to custom rule if name is complex

        elif method == 'can_reach_location':
            # can_reach_location state method (direct location name)
            name = get_arg_value(0, '')
            if isinstance(name, str):
                return self._make_rule('CanReachLocation', {'location_name': name})
            # Fall through to custom rule if name is complex

        elif method == 'can_reach_entrance':
            # can_reach_entrance state method
            name = get_arg_value(0, '')
            if isinstance(name, str):
                return self._make_rule('CanReachEntrance', {'entrance_name': name})
            # Fall through to custom rule if name is complex

        elif method == 'count':
            # count state method - returns item count
            item = get_arg_value(0, '')
            if isinstance(item, str):
                return self._make_rule('CountItem', {'item_name': item})
            # Fall through to custom rule if item is complex

        elif method == 'count_group':
            # count_group state method - returns group count
            group = get_arg_value(0, '')
            if isinstance(group, str):
                return self._make_rule('CountGroup', {'group': group})
            # Fall through to custom rule if group is complex

        elif method == 'count_group_unique':
            # count_group_unique state method - returns unique group count
            group = get_arg_value(0, '')
            if isinstance(group, str):
                return self._make_rule('CountGroupUnique', {'group': group})
            # Fall through to custom rule if group is complex

        # Unknown state method - preserve as custom rule
        self.warnings.append(f"Unknown state method '{method}' preserved as custom rule")
        return self._make_custom_rule('StateMethod', {
            'method': method,
            'args': args,
            '_original_ast_type': 'state_method'
        })

    # -------------------------------------------------------------------------
    # Composite Rule Converters
    # -------------------------------------------------------------------------

    def _convert_and(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert and rule.

        AST: {"type": "and", "conditions": [...]}
        RB: {"rule": "And", "options": [], "children": [...]}
        """
        conditions = rule.get('conditions', [])

        if not conditions:
            return self._make_rule('True_', {})

        converted_children = [self._convert_rule(cond) for cond in conditions]

        if len(converted_children) == 1:
            return converted_children[0]

        return self._make_composite_rule('And', converted_children)

    def _convert_or(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert or rule.

        AST: {"type": "or", "conditions": [...]}
        RB: {"rule": "Or", "options": [], "children": [...]}
        """
        conditions = rule.get('conditions', [])

        if not conditions:
            return self._make_rule('False_', {})

        converted_children = [self._convert_rule(cond) for cond in conditions]

        if len(converted_children) == 1:
            return converted_children[0]

        return self._make_composite_rule('Or', converted_children)

    def _convert_not(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert not rule.

        AST: {"type": "not", "condition": {...}}
        RB: No direct equivalent - preserve as custom rule
        """
        condition = rule.get('condition', {})
        converted_condition = self._convert_rule(condition)

        self.warnings.append("'not' rule has no direct Rule Builder equivalent, preserved as custom rule")
        return self._make_custom_rule('Not', {
            'condition': converted_condition,
            '_original_ast_type': 'not'
        })

    # -------------------------------------------------------------------------
    # Reachability Converters
    # -------------------------------------------------------------------------

    def _convert_can_reach(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert can_reach rule.

        AST: {"type": "can_reach", "region": "Castle"}
        RB: {"rule": "CanReachRegion", "options": [], "args": {"region_name": "Castle"}}
        """
        region = rule.get('region', '')
        return self._make_rule('CanReachRegion', {'region_name': region})

    def _convert_location_check(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert location_check rule.

        AST: {"type": "location_check", "location": "Chest1"}
        RB: {"rule": "CanReachLocation", "options": [], "args": {"location_name": "Chest1"}}
        """
        location = rule.get('location', '')
        return self._make_rule('CanReachLocation', {'location_name': location})

    def _convert_can_reach_entrance(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert can_reach_entrance rule.

        AST: {"type": "can_reach_entrance", "entrance": "Door1"}
        RB: {"rule": "CanReachEntrance", "options": [], "args": {"entrance_name": "Door1"}}
        """
        entrance = rule.get('entrance', '')
        return self._make_rule('CanReachEntrance', {'entrance_name': entrance})

    # -------------------------------------------------------------------------
    # Conditional Converters (Option Filters)
    # -------------------------------------------------------------------------

    def _convert_conditional(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert conditional rule (typically from option filter).

        AST: {"type": "conditional", "test": {...}, "if_true": {...}, "if_false": {...}}
        RB: Rule with options array (if test is an option comparison)
        """
        test = rule.get('test', {})
        if_true = rule.get('if_true', {})
        if_false = rule.get('if_false', {})

        # Try to extract option filter from test
        options = self._extract_options_from_test(test)

        if options:
            # Check if if_false is just True (typical for option-filtered rules)
            if_false_is_true = (
                isinstance(if_false, dict) and
                if_false.get('type') == 'constant' and
                if_false.get('value') is True
            )

            if if_false_is_true:
                # This is a simple option-filtered rule
                converted_inner = self._convert_rule(if_true)
                converted_inner['options'] = options
                return converted_inner

        # Complex conditional - preserve as custom rule
        self.warnings.append("Complex conditional preserved as custom rule")
        return self._make_custom_rule('Conditional', {
            'test': self._convert_rule(test) if isinstance(test, dict) else test,
            'if_true': self._convert_rule(if_true) if isinstance(if_true, dict) else if_true,
            'if_false': self._convert_rule(if_false) if isinstance(if_false, dict) else if_false,
            '_original_ast_type': 'conditional'
        })

    def _extract_options_from_test(self, test: Dict[str, Any]) -> Optional[List[Dict]]:
        """
        Try to extract option filters from a test condition.

        Looks for patterns like:
        {"type": "compare", "left": {"type": "attribute", "object": {"name": "options"}, "attr": "X"}, ...}
        """
        if not isinstance(test, dict):
            return None

        test_type = test.get('type')

        if test_type == 'compare':
            option = self._extract_single_option(test)
            if option:
                return [option]

        elif test_type == 'and':
            # Multiple option conditions
            options = []
            conditions = test.get('conditions', [])
            for cond in conditions:
                option = self._extract_single_option(cond)
                if option:
                    options.append(option)
                else:
                    # Not all conditions are option comparisons
                    return None
            return options if options else None

        return None

    def _extract_single_option(self, compare: Dict[str, Any]) -> Optional[Dict]:
        """Extract a single option filter from a compare rule."""
        if compare.get('type') != 'compare':
            return None

        left = compare.get('left', {})
        op = compare.get('op', '==')
        right = compare.get('right', {})

        # Check if left is options.X attribute access
        if (left.get('type') == 'attribute' and
            isinstance(left.get('object'), dict) and
            left['object'].get('type') == 'name' and
            left['object'].get('name') == 'options'):

            option_name = left.get('attr', '')

            # Get value from right
            value = right.get('value') if right.get('type') == 'constant' else right

            # Map operator back
            op_map = {
                '==': 'eq',
                '!=': 'ne',
                '>': 'gt',
                '<': 'lt',
                '>=': 'ge',
                '<=': 'le',
                'in': 'contains',
            }

            return {
                'option': option_name,
                'op': op_map.get(op, 'eq'),
                'value': value
            }

        return None

    # -------------------------------------------------------------------------
    # Helper Converters
    # -------------------------------------------------------------------------

    def _convert_helper(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert helper rule.

        If the helper was originally converted from Rule Builder format,
        restore it. Otherwise, convert to Rule Builder format with flattened args.

        Output format:
            {
                "rule": "helper_name",
                "options": [],
                "args": [arg1, arg2, ...],  # Flattened list, not nested
                "_original_ast_type": "helper",
                "_converted_from_cc": true
            }
        """
        helper_name = rule.get('name', 'Unknown')
        args = rule.get('args', [])

        # Check for round-trip metadata
        if rule.get('_converted_from_rule_builder'):
            return self._restore_from_round_trip(rule)

        # Convert args (they may be nested rule dicts)
        converted_args = [
            self._convert_rule(arg) if isinstance(arg, dict) else arg
            for arg in args
        ]

        # Build flattened structure - args is a list at top level, not nested in a dict
        return {
            'rule': helper_name,
            'options': [],
            'args': converted_args,
            '_original_ast_type': 'helper',
            '_converted_from_cc': True
        }

    # -------------------------------------------------------------------------
    # Expression Converters (Limited Support)
    # -------------------------------------------------------------------------

    def _convert_compare(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert compare rule.

        AST: {"type": "compare", "left": {...}, "op": ">=", "right": {...}}
        RB: No direct equivalent - preserve as custom rule
        """
        left = rule.get('left', {})
        op = rule.get('op', '==')
        right = rule.get('right', {})

        self.warnings.append("Compare expression preserved as custom rule")
        return self._make_custom_rule('Compare', {
            'left': self._convert_rule(left) if isinstance(left, dict) else left,
            'op': op,
            'right': self._convert_rule(right) if isinstance(right, dict) else right,
            '_original_ast_type': 'compare'
        })

    def _convert_binary_op(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert binary_op rule to Arithmetic.

        AST: {"type": "binary_op", "left": {...}, "op": "+", "right": {...}}
        RB: {"rule": "Arithmetic", "args": {"left": ..., "op": "+", "right": ...}}
        """
        left = rule.get('left', {})
        op = rule.get('op', '+')
        right = rule.get('right', {})

        # Normalize operator names from Python AST
        op_map = {
            'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/',
            'FloorDiv': '//', 'Mod': '%', 'Pow': '**',
        }
        op = op_map.get(op, op)

        return self._make_rule('Arithmetic', {
            'left': self._convert_rule(left) if isinstance(left, dict) else left,
            'op': op,
            'right': self._convert_rule(right) if isinstance(right, dict) else right,
        })

    def _convert_attribute(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert attribute access rule.

        Handles common patterns:
        - setting_value.value → SettingValue(setting_name)
        - options.X → SettingValue(X)
        - self.options.X → SettingValue(X)
        """
        obj = rule.get('object', {})
        attr = rule.get('attr', '')

        # Pattern 1: setting_value.value → SettingValue
        # {"type": "attribute", "object": {"type": "setting_value", "setting": "X"}, "attr": "value"}
        if isinstance(obj, dict) and obj.get('type') == 'setting_value' and attr == 'value':
            setting_name = obj.get('setting', '')
            return self._make_rule('SettingValue', {'setting': setting_name})

        # Pattern 2: options.X → SettingValue
        # {"type": "attribute", "object": {"type": "name", "name": "options"}, "attr": "X"}
        if isinstance(obj, dict) and obj.get('type') == 'name' and obj.get('name') == 'options':
            return self._make_rule('SettingValue', {'setting': attr})

        # Pattern 3: self.options.X → SettingValue (nested attribute)
        # Need to handle {"type": "attribute", "object": {"type": "attribute", "object": {"type": "name", "name": "self"}, "attr": "options"}, "attr": "X"}
        if isinstance(obj, dict) and obj.get('type') == 'attribute':
            inner_obj = obj.get('object', {})
            inner_attr = obj.get('attr', '')
            if (isinstance(inner_obj, dict) and inner_obj.get('type') == 'name' and
                inner_obj.get('name') == 'self' and inner_attr == 'options'):
                return self._make_rule('SettingValue', {'setting': attr})

        # Default: preserve as custom Attribute rule
        return self._make_custom_rule('Attribute', {
            'object': self._convert_rule(obj) if isinstance(obj, dict) else obj,
            'attr': attr,
            '_original_ast_type': 'attribute'
        })

    def _convert_name(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Convert name reference rule."""
        return self._make_custom_rule('Name', {
            'name': rule.get('name'),
            '_original_ast_type': 'name'
        })

    def _convert_list(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Convert list rule."""
        value = rule.get('value', [])
        converted_value = [
            self._convert_rule(item) if isinstance(item, dict) else item
            for item in value
        ]
        return self._make_custom_rule('List', {
            'value': converted_value,
            '_original_ast_type': 'list'
        })

    def _convert_tuple(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Convert tuple rule."""
        value = rule.get('value', [])
        converted_value = [
            self._convert_rule(item) if isinstance(item, dict) else item
            for item in value
        ]
        return self._make_custom_rule('Tuple', {
            'value': converted_value,
            '_original_ast_type': 'tuple'
        })

    # -------------------------------------------------------------------------
    # Placement Converters (ALTTP-specific)
    # -------------------------------------------------------------------------

    def _flatten_locations(self, locations: Any) -> List[List[Any]]:
        """
        Flatten location list to simple [[name, player], ...] format.

        Handles various input formats:
        - {"type": "constant", "value": [[loc1, 1], [loc2, 1]]}
        - {"type": "list", "value": [{"type": "list", "value": [...]}]}
        - Direct list: [[loc1, 1], [loc2, 1]]
        """
        if not locations:
            return []

        # Already a simple list
        if isinstance(locations, list):
            result = []
            for item in locations:
                if isinstance(item, list) and len(item) >= 2:
                    # Already [name, player] format
                    result.append(item)
                elif isinstance(item, dict):
                    # Nested structure - extract values
                    flattened = self._flatten_single_location(item)
                    if flattened:
                        result.append(flattened)
            return result

        if not isinstance(locations, dict):
            return []

        loc_type = locations.get('type')
        value = locations.get('value')

        if loc_type == 'constant' and isinstance(value, list):
            # Pre-evaluated constant - value is already [[name, player], ...]
            return value

        if loc_type == 'list' and isinstance(value, list):
            # Nested list structure - recursively flatten
            result = []
            for item in value:
                if isinstance(item, dict):
                    if item.get('type') == 'list':
                        # Inner list - extract [name, player]
                        inner = item.get('value', [])
                        flattened = self._flatten_inner_list(inner)
                        if flattened:
                            result.append(flattened)
                    elif item.get('type') == 'constant':
                        # Constant value
                        inner_val = item.get('value')
                        if isinstance(inner_val, list):
                            result.append(inner_val)
                elif isinstance(item, list):
                    result.append(item)
            return result

        return []

    def _flatten_inner_list(self, inner: List[Any]) -> Optional[List[Any]]:
        """Flatten an inner list [name_obj, player_obj] to [name, player]."""
        if len(inner) < 2:
            return None

        name = inner[0]
        player = inner[1]

        # Extract name
        if isinstance(name, dict) and name.get('type') == 'constant':
            name = name.get('value')

        # Extract player
        if isinstance(player, dict) and player.get('type') == 'constant':
            player = player.get('value')

        return [name, player]

    def _flatten_single_location(self, item: Dict[str, Any]) -> Optional[List[Any]]:
        """Flatten a single location entry."""
        if item.get('type') == 'list':
            return self._flatten_inner_list(item.get('value', []))
        elif item.get('type') == 'constant':
            val = item.get('value')
            if isinstance(val, list) and len(val) >= 2:
                return val
        return None

    def _convert_placement_search(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert placement_search rule.

        AST: {"type": "placement_search", "item": {...}, "player": {...}, "locations": {...}}
        RB: {"rule": "AST_placement_search", "args": {"item": "X", "player": 1, "locations": [[loc, player], ...]}}
        """
        item = rule.get('item', '')
        player = rule.get('player', {'type': 'constant', 'value': 1})
        locations = rule.get('locations', [])

        # Extract item value if constant
        if isinstance(item, dict) and item.get('type') == 'constant':
            item = item.get('value')

        # Extract player value if constant
        if isinstance(player, dict) and player.get('type') == 'constant':
            player = player.get('value')

        # Flatten locations to simple format
        flattened_locations = self._flatten_locations(locations)

        return {
            'rule': 'AST_placement_search',
            'options': [],
            'args': {
                'item': item,
                'player': player,
                'locations': flattened_locations,
                '_original_ast_type': 'placement_search'
            },
            '_converted_from_cc': True
        }

    def _convert_placement_lookup(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert placement_lookup rule.

        AST: {"type": "placement_lookup", "location": "LocationName"}
        RB: {"rule": "AST_placement_lookup", "args": {"location": "LocationName"}}
        """
        location = rule.get('location', '')

        # Extract location value if constant
        if isinstance(location, dict) and location.get('type') == 'constant':
            location = location.get('value')

        return {
            'rule': 'AST_placement_lookup',
            'options': [],
            'args': {
                'location': location,
                '_original_ast_type': 'placement_lookup'
            },
            '_converted_from_cc': True
        }

    # -------------------------------------------------------------------------
    # Unknown Type Handler
    # -------------------------------------------------------------------------

    def _convert_unknown(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Handle unknown AST types by preserving them as custom rules."""
        rule_type = rule.get('type', 'unknown')
        self.warnings.append(f"Unknown AST type '{rule_type}' preserved as custom rule")

        # Preserve all fields except 'type'
        args = {k: v for k, v in rule.items() if k != 'type'}
        args['_original_ast_type'] = rule_type

        return self._make_custom_rule(f'AST_{rule_type}', args)


# -------------------------------------------------------------------------
# Convenience Functions
# -------------------------------------------------------------------------

def convert_ast_to_rule_builder(rule: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Convert a single rule from AST format to Rule Builder format.

    Args:
        rule: Rule in AST format

    Returns:
        Tuple of (converted_rule, warnings)
    """
    converter = ASTToRuleBuilder()
    result = converter.convert(rule)
    return result.rule, result.warnings + result.errors


def convert_rules_file_to_rule_builder(data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Convert an entire rules file from AST format to Rule Builder format.

    This handles the full file structure including regions, locations, etc.

    Args:
        data: Full rules file data in AST format

    Returns:
        Tuple of (converted_data, all_warnings)
    """
    converter = ASTToRuleBuilder()
    all_warnings = []

    def convert_access_rule(rule):
        """Convert an access_rule field if it exists."""
        if rule is None:
            return None
        result = converter.convert(rule)
        all_warnings.extend(result.warnings)
        all_warnings.extend(result.errors)
        return result.rule

    # Deep copy the data structure
    import copy
    converted_data = copy.deepcopy(data)

    # Convert rules in regions
    if 'regions' in converted_data:
        for player_id, regions in converted_data['regions'].items():
            for region_name, region_data in regions.items():
                # Convert exit rules
                if 'exits' in region_data:
                    for exit_data in region_data['exits']:
                        if 'access_rule' in exit_data and exit_data['access_rule']:
                            exit_data['access_rule'] = convert_access_rule(exit_data['access_rule'])

                # Convert entrance rules
                if 'entrances' in region_data:
                    for entrance_data in region_data['entrances']:
                        if 'access_rule' in entrance_data and entrance_data['access_rule']:
                            entrance_data['access_rule'] = convert_access_rule(entrance_data['access_rule'])

                # Convert location rules
                if 'locations' in region_data:
                    for location_data in region_data['locations']:
                        if 'access_rule' in location_data and location_data['access_rule']:
                            location_data['access_rule'] = convert_access_rule(location_data['access_rule'])
                        if 'item_rule' in location_data and location_data['item_rule']:
                            location_data['item_rule'] = convert_access_rule(location_data['item_rule'])

    # Convert dungeon rules if present
    if 'dungeons' in converted_data:
        for player_id, dungeons in converted_data['dungeons'].items():
            for dungeon_name, dungeon_data in dungeons.items():
                if 'medallion_check' in dungeon_data and dungeon_data['medallion_check']:
                    dungeon_data['medallion_check'] = convert_access_rule(dungeon_data['medallion_check'])

                if 'bosses' in dungeon_data:
                    for boss_key, boss_data in dungeon_data['bosses'].items():
                        if 'defeat_rule' in boss_data and boss_data['defeat_rule']:
                            boss_data['defeat_rule'] = convert_access_rule(boss_data['defeat_rule'])

    return converted_data, all_warnings
