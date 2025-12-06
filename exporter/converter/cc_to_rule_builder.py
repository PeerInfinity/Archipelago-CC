"""
Converter from Archipelago-CC format to Rule Builder format (PR #5048).

Archipelago-CC Format (A):
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


class CCToRuleBuilder:
    """
    Converter from Archipelago-CC format to Rule Builder format.

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

    # Mapping of CC types to converter methods
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
        }

    def convert(self, rule: Dict[str, Any]) -> ConversionResult:
        """
        Convert an Archipelago-CC format rule to Rule Builder format.

        Args:
            rule: Rule in Archipelago-CC format

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
            rule: Rule in Archipelago-CC format

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
        """Create a custom rule that preserves CC format data for round-trip."""
        result = self._make_rule(rule_name, args)
        result['_converted_from_cc'] = True
        return result

    # -------------------------------------------------------------------------
    # Constant Converters
    # -------------------------------------------------------------------------

    def _convert_constant(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert constant rule.

        CC: {"type": "constant", "value": true}
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

        CC: {"type": "item_check", "item": "Sword", "count": 2}
        RB: {"rule": "Has", "options": [], "args": {"item_name": "Sword", "count": 2}}
        """
        item = rule.get('item', '')
        count = rule.get('count', 1)

        # Handle item as dict (nested rule) vs string
        if isinstance(item, dict):
            # Complex item reference - preserve
            return self._make_custom_rule('ItemCheck', {
                'item': item,
                'count': count,
                '_original_cc_type': 'item_check'
            })

        args = {'item_name': item}
        if count != 1:
            args['count'] = count

        return self._make_rule('Has', args)

    def _convert_count_check(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert count_check rule.

        CC: {"type": "count_check", "item": "Arrow", "count": 10}
        RB: {"rule": "Has", "options": [], "args": {"item_name": "Arrow", "count": 10}}
        """
        item = rule.get('item', '')
        count = rule.get('count', 1)

        # Handle complex item/count
        if isinstance(item, dict) or isinstance(count, dict):
            return self._make_custom_rule('CountCheck', {
                'item': item,
                'count': count,
                '_original_cc_type': 'count_check'
            })

        return self._make_rule('Has', {'item_name': item, 'count': count})

    def _convert_group_check(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert group_check rule.

        CC: {"type": "group_check", "group": "Keys", "count": 3}
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

        if method == 'has_all':
            items = get_arg_value(0, [])
            if isinstance(items, list):
                return self._make_rule('HasAll', {'items': items})

        elif method == 'has_any':
            items = get_arg_value(0, [])
            if isinstance(items, list):
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

        # Unknown state method - preserve as custom rule
        self.warnings.append(f"Unknown state method '{method}' preserved as custom rule")
        return self._make_custom_rule('StateMethod', {
            'method': method,
            'args': args,
            '_original_cc_type': 'state_method'
        })

    # -------------------------------------------------------------------------
    # Composite Rule Converters
    # -------------------------------------------------------------------------

    def _convert_and(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert and rule.

        CC: {"type": "and", "conditions": [...]}
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

        CC: {"type": "or", "conditions": [...]}
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

        CC: {"type": "not", "condition": {...}}
        RB: No direct equivalent - preserve as custom rule
        """
        condition = rule.get('condition', {})
        converted_condition = self._convert_rule(condition)

        self.warnings.append("'not' rule has no direct Rule Builder equivalent, preserved as custom rule")
        return self._make_custom_rule('Not', {
            'condition': converted_condition,
            '_original_cc_type': 'not'
        })

    # -------------------------------------------------------------------------
    # Reachability Converters
    # -------------------------------------------------------------------------

    def _convert_can_reach(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert can_reach rule.

        CC: {"type": "can_reach", "region": "Castle"}
        RB: {"rule": "CanReachRegion", "options": [], "args": {"region_name": "Castle"}}
        """
        region = rule.get('region', '')
        return self._make_rule('CanReachRegion', {'region_name': region})

    def _convert_location_check(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert location_check rule.

        CC: {"type": "location_check", "location": "Chest1"}
        RB: {"rule": "CanReachLocation", "options": [], "args": {"location_name": "Chest1"}}
        """
        location = rule.get('location', '')
        return self._make_rule('CanReachLocation', {'location_name': location})

    def _convert_can_reach_entrance(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert can_reach_entrance rule.

        CC: {"type": "can_reach_entrance", "entrance": "Door1"}
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

        CC: {"type": "conditional", "test": {...}, "if_true": {...}, "if_false": {...}}
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
            '_original_cc_type': 'conditional'
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
        restore it. Otherwise, preserve as custom rule.
        """
        helper_name = rule.get('name', 'Unknown')
        args = rule.get('args', [])

        # Check for round-trip metadata
        if rule.get('_converted_from_rule_builder'):
            return self._restore_from_round_trip(rule)

        # Preserve as custom rule
        self.warnings.append(f"Helper '{helper_name}' preserved as custom rule")
        return self._make_custom_rule(helper_name, {
            'args': [self._convert_rule(arg) if isinstance(arg, dict) else arg for arg in args],
            '_original_cc_type': 'helper'
        })

    # -------------------------------------------------------------------------
    # Expression Converters (Limited Support)
    # -------------------------------------------------------------------------

    def _convert_compare(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert compare rule.

        CC: {"type": "compare", "left": {...}, "op": ">=", "right": {...}}
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
            '_original_cc_type': 'compare'
        })

    def _convert_binary_op(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert binary_op rule.

        CC: {"type": "binary_op", "left": {...}, "op": "+", "right": {...}}
        RB: No direct equivalent - preserve as custom rule
        """
        left = rule.get('left', {})
        op = rule.get('op', '+')
        right = rule.get('right', {})

        self.warnings.append("Binary operation preserved as custom rule")
        return self._make_custom_rule('BinaryOp', {
            'left': self._convert_rule(left) if isinstance(left, dict) else left,
            'op': op,
            'right': self._convert_rule(right) if isinstance(right, dict) else right,
            '_original_cc_type': 'binary_op'
        })

    def _convert_attribute(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Convert attribute access rule."""
        return self._make_custom_rule('Attribute', {
            'object': rule.get('object'),
            'attr': rule.get('attr'),
            '_original_cc_type': 'attribute'
        })

    def _convert_name(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Convert name reference rule."""
        return self._make_custom_rule('Name', {
            'name': rule.get('name'),
            '_original_cc_type': 'name'
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
            '_original_cc_type': 'list'
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
            '_original_cc_type': 'tuple'
        })

    # -------------------------------------------------------------------------
    # Unknown Type Handler
    # -------------------------------------------------------------------------

    def _convert_unknown(self, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Handle unknown CC types by preserving them as custom rules."""
        rule_type = rule.get('type', 'unknown')
        self.warnings.append(f"Unknown CC type '{rule_type}' preserved as custom rule")

        # Preserve all fields except 'type'
        args = {k: v for k, v in rule.items() if k != 'type'}
        args['_original_cc_type'] = rule_type

        return self._make_custom_rule(f'CC_{rule_type}', args)


# -------------------------------------------------------------------------
# Convenience Functions
# -------------------------------------------------------------------------

def convert_cc_to_rule_builder(rule: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Convert a single rule from Archipelago-CC format to Rule Builder format.

    Args:
        rule: Rule in Archipelago-CC format

    Returns:
        Tuple of (converted_rule, warnings)
    """
    converter = CCToRuleBuilder()
    result = converter.convert(rule)
    return result.rule, result.warnings + result.errors


def convert_rules_file_to_rule_builder(data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Convert an entire rules file from Archipelago-CC format to Rule Builder format.

    This handles the full file structure including regions, locations, etc.

    Args:
        data: Full rules file data in Archipelago-CC format

    Returns:
        Tuple of (converted_data, all_warnings)
    """
    converter = CCToRuleBuilder()
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
