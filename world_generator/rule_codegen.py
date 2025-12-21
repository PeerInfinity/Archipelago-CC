"""
Rule code generator - converts CC format rules to Python Rule Builder code.

This module transforms JSON rule definitions into Python source code
that uses the Rule Builder pattern.
"""

import copy
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
        self._inline_counter: int = 0  # Counter for generating unique variable prefixes

    def reset(self) -> None:
        """Reset state for a new generation run."""
        self.required_imports = set()
        self._inline_counter = 0

    def set_helpers(self, helper_names: Set[str], helper_bodies: Dict[str, Dict[str, Any]] = None,
                     helper_params: Dict[str, List[str]] = None,
                     helper_defaults: Dict[str, Dict[str, Any]] = None,
                     placements: Dict[str, str] = None) -> None:
        """Set known helpers and optionally their bodies, params, defaults, and placements for explain support."""
        self.known_helpers = helper_names
        self.helper_bodies = helper_bodies or {}
        self.helper_params = helper_params or {}  # helper_name -> list of param names
        self.helper_defaults = helper_defaults or {}  # helper_name -> dict of param_name -> default_value
        self.placements = placements or {}  # location_name -> item_name

    def _expand_helper_refs(self, rule: Dict[str, Any], visited: Set[str] = None, depth: int = 0) -> Dict[str, Any]:
        """
        Recursively expand helper references in a rule body.

        This ensures helper bodies are self-contained and don't reference other helpers
        or setting values, which allows the frontend to evaluate rules without needing
        helper or settings lookups.

        Note: Nested helpers (depth > 0) are NOT expanded to avoid creating overly complex
        rules. The frontend will look them up from the helpers dict instead.

        Args:
            rule: Rule dict in CC format
            visited: Set of helper names already visited (for cycle detection)
            depth: Current expansion depth. Only expand at depth 0 (top level).

        Returns:
            Rule dict with helper references and setting_value references expanded
        """
        if visited is None:
            visited = set()

        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type', '')

        # If this is a helper reference, expand it (only at top level to avoid overly complex rules)
        if rule_type == 'helper':
            helper_name = rule.get('name', '')
            if helper_name in visited:
                # Circular reference - return as-is to avoid infinite loop
                return rule
            # Only expand helpers at depth 0 (top level rules)
            # Nested helpers (depth > 0) are left as references for frontend lookup
            if depth == 0 and helper_name in self.helper_bodies:
                # Expand the helper body, marking this helper as visited
                new_visited = visited | {helper_name}
                # Use depth + 1 so nested helper references won't be expanded
                expanded_body = self._expand_helper_refs(self.helper_bodies[helper_name], new_visited, depth + 1)

                # Rename local variables to avoid collision with outer scope
                # This is critical when inlining nested helpers that use the same
                # variable names (e.g., both outer and inner helper use 'depth')
                self._inline_counter += 1
                prefix = f"_h{self._inline_counter}_"
                expanded_body = self._rename_local_variables(expanded_body, prefix)

                # If this helper has parameters, substitute parameter names with argument expressions
                if helper_name in self.helper_params:
                    params = self.helper_params[helper_name]
                    args = rule.get('args', [])
                    defaults = self.helper_defaults.get(helper_name, {})
                    if params:
                        # Create a mapping from parameter names to argument expressions
                        # Use provided args first, then fall back to defaults
                        param_to_arg = {}
                        for i, param in enumerate(params):
                            if i < len(args):
                                param_to_arg[param] = args[i]
                            elif param in defaults:
                                # Convert default value to CC format constant
                                param_to_arg[param] = {'type': 'constant', 'value': defaults[param]}
                        # Substitute parameter references in the expanded body
                        if param_to_arg:
                            expanded_body = self._substitute_names(expanded_body, param_to_arg)

                return expanded_body
            # Unknown helper - return as-is
            return rule

        # If this is a setting_value reference, resolve it to a constant
        # This is critical because worldgen worlds don't have the original game options
        if rule_type == 'setting_value':
            setting_name = rule.get('setting', '')
            if setting_name in self.settings:
                value = self.settings[setting_name]
                # Handle indexed access into list settings (e.g., required_medallions[0])
                if 'index' in rule and isinstance(value, list):
                    index = rule['index']
                    if 0 <= index < len(value):
                        value = value[index]
                return {'type': 'constant', 'value': value}
            # Unknown setting - return as-is (will evaluate to undefined in frontend)
            return rule

        # If this is an attribute access on a setting_value (e.g., world.options.goal.value),
        # resolve it to a constant
        if rule_type == 'attribute':
            obj = rule.get('object', {})
            attr = rule.get('attr', '')
            if isinstance(obj, dict) and obj.get('type') == 'setting_value' and attr == 'value':
                setting_name = obj.get('setting', '')
                if setting_name in self.settings:
                    return {'type': 'constant', 'value': self.settings[setting_name]}
            # Also handle self.xxx attribute access (e.g., self.flag_specific_keycards)
            # These are option-dependent flags from LogicExtensions classes
            if isinstance(obj, dict) and obj.get('type') == 'name' and obj.get('name') == 'self':
                if attr in self.settings:
                    return {'type': 'constant', 'value': self.settings[attr]}

        # If this is a placement_lookup, resolve it using the known placements
        # This is critical because worldgen presets don't have item data in locations
        if rule_type == 'placement_lookup':
            location_rule = rule.get('location', {})
            # Evaluate the location name if it's a constant
            if isinstance(location_rule, dict) and location_rule.get('type') == 'constant':
                location_name = location_rule.get('value', '')
                if location_name and location_name in self.placements:
                    item_name = self.placements[location_name]
                    # Return the placement as [item_name, player] tuple (player is always 1 for worldgen)
                    return {
                        'type': 'list',
                        'value': [
                            {'type': 'constant', 'value': item_name},
                            {'type': 'constant', 'value': 1}
                        ]
                    }
            # Location not found in placements - return null constant
            # This allows the conditional to properly branch to if_false
            return {'type': 'constant', 'value': None}

        # For conditional rules, try to statically evaluate the test after expansion
        # ONLY if the test is a placement_lookup comparison (to avoid JavaScript array comparison issues)
        # Be conservative - don't optimize away complex runtime logic
        if rule_type == 'conditional':
            expanded_test = self._expand_helper_refs(rule.get('test', {}), visited, depth)
            expanded_if_true = self._expand_helper_refs(rule.get('if_true', {}), visited, depth)
            expanded_if_false = self._expand_helper_refs(rule.get('if_false', {}), visited, depth)

            # First check if test is a constant boolean - simplify if so
            if isinstance(expanded_test, dict) and expanded_test.get('type') == 'constant':
                test_value = expanded_test.get('value')
                if test_value is True:
                    return expanded_if_true
                elif test_value is False:
                    return expanded_if_false

            # Only try static evaluation for placement_lookup comparisons
            # These need to be evaluated statically because JS can't compare arrays by value
            if self._is_placement_comparison(expanded_test):
                static_result = self._try_static_eval(expanded_test)
                if static_result is True:
                    return expanded_if_true
                elif static_result is False:
                    return expanded_if_false
            # Can't statically evaluate - return the expanded conditional
            return {
                'type': 'conditional',
                'test': expanded_test,
                'if_true': expanded_if_true,
                'if_false': expanded_if_false
            }

        # For other rule types, recursively expand any nested rules
        result = dict(rule)
        for key, value in rule.items():
            if isinstance(value, dict):
                result[key] = self._expand_helper_refs(value, visited, depth)
            elif isinstance(value, list):
                result[key] = [
                    self._expand_helper_refs(item, visited, depth) if isinstance(item, dict) else item
                    for item in value
                ]
        return result

    def _is_placement_comparison(self, rule: Dict[str, Any]) -> bool:
        """
        Check if a rule is a comparison involving placement data (list constants).

        Placement lookups get resolved to list constants like [item_name, player].
        These need static evaluation because JavaScript can't compare arrays by value.
        """
        if not isinstance(rule, dict):
            return False

        if rule.get('type') != 'compare':
            return False

        left = rule.get('left', {})
        right = rule.get('right', {})

        # Check if either side is a list constant (from resolved placement_lookup)
        def is_list_constant(r):
            return isinstance(r, dict) and r.get('type') == 'list'

        return is_list_constant(left) or is_list_constant(right)

    def _try_static_eval(self, rule: Dict[str, Any]) -> Optional[bool]:
        """
        Try to statically evaluate a rule to a boolean value.

        This is used to optimize conditionals at worldgen time when the test
        can be fully evaluated. Returns True, False, or None if can't evaluate.

        Args:
            rule: Rule dict to evaluate

        Returns:
            True, False, or None if the rule can't be statically evaluated
        """
        if not isinstance(rule, dict):
            return None

        rule_type = rule.get('type', '')

        if rule_type == 'constant':
            value = rule.get('value')
            if isinstance(value, bool):
                return value
            return None

        if rule_type == 'compare':
            left = self._try_static_value(rule.get('left', {}))
            right = self._try_static_value(rule.get('right', {}))
            op = rule.get('op', '==')

            if left is None or right is None:
                return None

            # Do deep comparison for lists/tuples
            if op == '==':
                return self._deep_equals(left, right)
            elif op == '!=':
                return not self._deep_equals(left, right)

            return None

        return None

    def _try_static_value(self, rule: Dict[str, Any]) -> Any:
        """
        Try to extract a static value from a rule.

        Returns the value or None if not statically evaluable.
        """
        if not isinstance(rule, dict):
            return None

        rule_type = rule.get('type', '')

        if rule_type == 'constant':
            return rule.get('value')

        if rule_type == 'list':
            values = []
            for item in rule.get('value', []):
                val = self._try_static_value(item)
                if val is None:
                    return None
                values.append(val)
            return values

        return None

    def _deep_equals(self, a: Any, b: Any) -> bool:
        """Deep equality comparison that works with lists."""
        if type(a) != type(b):
            return False
        if isinstance(a, list):
            if len(a) != len(b):
                return False
            return all(self._deep_equals(x, y) for x, y in zip(a, b))
        return a == b

    def _substitute_names(self, rule: Dict[str, Any], name_map: Dict[str, Any]) -> Dict[str, Any]:
        """
        Substitute name references in a rule with the corresponding expressions.

        This is used when inlining helper functions to replace parameter names
        with the actual argument expressions.

        Args:
            rule: Rule dict to process
            name_map: Mapping from name strings to their replacement expressions

        Returns:
            Rule dict with name references substituted
        """
        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type', '')

        # If this is a name reference and it's in our map, replace it
        if rule_type == 'name':
            name = rule.get('name', '')
            if name in name_map:
                # Return a deep copy of the replacement to avoid shared references
                return copy.deepcopy(name_map[name])
            return rule

        # For other rule types, recursively substitute in nested rules
        result = dict(rule)
        for key, value in rule.items():
            if isinstance(value, dict):
                result[key] = self._substitute_names(value, name_map)
            elif isinstance(value, list):
                result[key] = [
                    self._substitute_names(item, name_map) if isinstance(item, dict) else item
                    for item in value
                ]
        return result

    def _find_assigned_names(self, rule: Dict[str, Any]) -> Set[str]:
        """
        Find all variable names that are assigned in a rule.

        This is used when inlining helpers to identify local variables
        that need to be renamed to avoid collision with the outer scope.

        Args:
            rule: Rule dict to scan

        Returns:
            Set of variable names that are assigned
        """
        assigned = set()

        if not isinstance(rule, dict):
            return assigned

        rule_type = rule.get('type', '')

        # Check for assign statements
        if rule_type == 'assign':
            var_name = rule.get('var') or rule.get('name')
            if var_name:
                assigned.add(var_name)

        # Recursively scan nested rules
        for key, value in rule.items():
            if isinstance(value, dict):
                assigned.update(self._find_assigned_names(value))
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        assigned.update(self._find_assigned_names(item))

        return assigned

    def _rename_local_variables(self, rule: Dict[str, Any], prefix: str) -> Dict[str, Any]:
        """
        Rename all local variables in a rule to avoid collisions when inlining.

        This finds all assigned variable names and renames both the assignments
        and all references to those variables.

        Args:
            rule: Rule dict to process
            prefix: Unique prefix to add to variable names

        Returns:
            Rule dict with renamed variables
        """
        # Find all assigned variable names
        assigned_names = self._find_assigned_names(rule)

        if not assigned_names:
            return rule

        # Create rename map
        rename_map = {name: f"{prefix}{name}" for name in assigned_names}

        # Apply renaming to both assignments and references
        return self._apply_rename(rule, rename_map)

    def _apply_rename(self, rule: Dict[str, Any], rename_map: Dict[str, str]) -> Dict[str, Any]:
        """
        Apply variable renaming to a rule.

        Args:
            rule: Rule dict to process
            rename_map: Mapping from old names to new names

        Returns:
            Rule dict with renamed variables
        """
        if not isinstance(rule, dict):
            return rule

        rule_type = rule.get('type', '')
        result = dict(rule)

        # Handle assign statements - rename the target variable
        if rule_type == 'assign':
            var_name = result.get('var') or result.get('name')
            if var_name and var_name in rename_map:
                if 'var' in result:
                    result['var'] = rename_map[var_name]
                if 'name' in result:
                    result['name'] = rename_map[var_name]

        # Handle name references
        if rule_type == 'name':
            name = result.get('name', '')
            if name in rename_map:
                result['name'] = rename_map[name]

        # Recursively process nested rules
        for key, value in rule.items():
            if key in ('var', 'name') and rule_type in ('assign', 'name'):
                # Already handled above
                continue
            if isinstance(value, dict):
                result[key] = self._apply_rename(value, rename_map)
            elif isinstance(value, list):
                result[key] = [
                    self._apply_rename(item, rename_map) if isinstance(item, dict) else item
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
        """Internal recursive rule converter.

        Handles both AST format (uses 'type' key) and Rule Builder format (uses 'rule' key).
        """
        if not isinstance(rule, dict):
            # Primitive value
            if rule is True:
                return 'True_()'
            elif rule is False:
                return 'False_()'
            else:
                return repr(rule)

        # First try AST format (uses 'type' key)
        rule_type = rule.get('type', '')

        # Dispatch based on AST rule type
        ast_converters = {
            'constant': self._convert_constant,
            'item_check': self._convert_item_check,
            'count_check': self._convert_count_check,
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
            'name': self._convert_name,
            'placement_lookup': self._convert_placement_lookup,
            'list': self._convert_list,
            'binary_op': self._convert_binary_op,
            'sum': self._convert_sum,
            'setting_value': self._convert_setting_value,
        }

        converter = ast_converters.get(rule_type)
        if converter:
            return converter(rule)

        # Try Rule Builder format (uses 'rule' key)
        # This format is used by the rule_builder module's to_dict() serialization
        rule_name = rule.get('rule', '')

        # Map Rule Builder names to converters
        rule_builder_converters = {
            'True_': self._convert_rule_builder_true,
            'False_': self._convert_rule_builder_false,
            'Has': self._convert_rule_builder_has,
            'HasAll': self._convert_rule_builder_has_all,
            'HasAny': self._convert_rule_builder_has_any,
            'HasGroup': self._convert_rule_builder_has_group,
            'And': self._convert_rule_builder_and,
            'Or': self._convert_rule_builder_or,
            'Not': self._convert_rule_builder_not,
            'CanReach': self._convert_rule_builder_can_reach,
        }

        rb_converter = rule_builder_converters.get(rule_name)
        if rb_converter:
            return rb_converter(rule)

        # Unknown rule type - return True_() as placeholder
        # Don't use inline comments as they break multi-line expressions
        return 'True_()'

    # --- Rule Builder format converters ---

    def _convert_rule_builder_true(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder True_ to code."""
        self.required_imports.add('True_')
        return 'True_()'

    def _convert_rule_builder_false(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder False_ to code."""
        self.required_imports.add('False_')
        return 'False_()'

    def _convert_rule_builder_has(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder Has to code.

        Rule Builder format: {"rule": "Has", "options": [], "args": {"item_name": "Sword", "count": 1}}
        """
        args = rule.get('args', {})
        item_name = args.get('item_name', '')
        count = args.get('count', 1)

        if not item_name:
            self.required_imports.add('True_')
            return 'True_()'

        self.required_imports.add('Has')
        item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
        if count > 1:
            return f'Has("{item_escaped}", {count})'
        return f'Has("{item_escaped}")'

    def _convert_rule_builder_has_all(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder HasAll to code.

        Rule Builder format: {"rule": "HasAll", "options": [], "args": {"items": ["Sword", "Shield"]}}
        """
        args = rule.get('args', {})
        items = args.get('items', [])

        if not items:
            self.required_imports.add('True_')
            return 'True_()'

        self.required_imports.add('HasAll')
        items_escaped = [item.replace('\\', '\\\\').replace('"', '\\"') for item in items]
        items_str = ', '.join(f'"{item}"' for item in items_escaped)
        return f'HasAll([{items_str}])'

    def _convert_rule_builder_has_any(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder HasAny to code.

        Rule Builder format: {"rule": "HasAny", "options": [], "args": {"items": ["Sword", "Shield"]}}
        """
        args = rule.get('args', {})
        items = args.get('items', [])

        if not items:
            self.required_imports.add('False_')
            return 'False_()'

        self.required_imports.add('HasAny')
        items_escaped = [item.replace('\\', '\\\\').replace('"', '\\"') for item in items]
        items_str = ', '.join(f'"{item}"' for item in items_escaped)
        return f'HasAny([{items_str}])'

    def _convert_rule_builder_has_group(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder HasGroup to code.

        Rule Builder format: {"rule": "HasGroup", "options": [], "args": {"group_name": "Keys", "count": 1}}
        """
        args = rule.get('args', {})
        group_name = args.get('group_name', '')
        count = args.get('count', 1)

        if not group_name:
            self.required_imports.add('True_')
            return 'True_()'

        self.required_imports.add('HasGroup')
        group_escaped = group_name.replace('\\', '\\\\').replace('"', '\\"')
        if count > 1:
            return f'HasGroup("{group_escaped}", {count})'
        return f'HasGroup("{group_escaped}")'

    def _convert_rule_builder_and(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder And to code.

        Rule Builder format: {"rule": "And", "options": [], "children": [...]}
        """
        children = rule.get('children', [])

        if not children:
            self.required_imports.add('True_')
            return 'True_()'

        if len(children) == 1:
            return self._convert_rule(children[0])

        child_codes = [self._convert_rule(child) for child in children]
        self.required_imports.add('And')
        return f'And({", ".join(child_codes)})'

    def _convert_rule_builder_or(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder Or to code.

        Rule Builder format: {"rule": "Or", "options": [], "children": [...]}
        """
        children = rule.get('children', [])

        if not children:
            self.required_imports.add('False_')
            return 'False_()'

        if len(children) == 1:
            return self._convert_rule(children[0])

        child_codes = [self._convert_rule(child) for child in children]
        self.required_imports.add('Or')
        return f'Or({", ".join(child_codes)})'

    def _convert_rule_builder_not(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder Not to code.

        Rule Builder format: {"rule": "Not", "options": [], "child": {...}}
        """
        child = rule.get('child', {})

        if not child:
            self.required_imports.add('True_')
            return 'True_()'

        child_code = self._convert_rule(child)
        self.required_imports.add('Not')
        return f'Not({child_code})'

    def _convert_rule_builder_can_reach(self, rule: Dict[str, Any]) -> str:
        """Convert Rule Builder CanReach to code.

        Rule Builder format: {"rule": "CanReach", "options": [], "args": {"region_name": "Dungeon"}}
        """
        args = rule.get('args', {})
        region_name = args.get('region_name', '')

        if not region_name:
            self.required_imports.add('True_')
            return 'True_()'

        self.required_imports.add('CanReach')
        region_escaped = region_name.replace('\\', '\\\\').replace('"', '\\"')
        return f'CanReach("{region_escaped}")'

    def _convert_name(self, rule: Dict[str, Any]) -> str:
        """Convert a name reference to a constant.

        Names typically reference game settings/options. Since worldgen worlds
        don't have the original game options, we resolve them to constants.
        If the name matches a known setting, use its value. Otherwise default
        to False_() since most setting references are optional feature flags
        that should be disabled for vanilla worldgen.
        """
        name = rule.get('name', '')

        # Check if this name exists in our settings
        if name in self.settings:
            value = self.settings[name]
            if value:
                self.required_imports.add('True_')
                return 'True_()'
            else:
                self.required_imports.add('False_')
                return 'False_()'

        # Unknown name - default to False (disables optional features)
        # This is safe because:
        # - Not(False) = True, making locations accessible without the feature
        # - False in an AND makes that branch fail, falling back to alternatives
        self.required_imports.add('False_')
        return 'False_()'

    def _convert_constant(self, rule: Dict[str, Any]) -> str:
        """Convert constant true/false rule."""
        value = rule.get('value', True)
        if value:
            self.required_imports.add('True_')
            return 'True_()'
        else:
            self.required_imports.add('False_')
            return 'False_()'

    def _convert_list(self, rule: Dict[str, Any]) -> str:
        """Convert list rule to Python list literal.

        List rules are used for things like 'in' comparisons where we need
        to check if a value is in a list of expected values.
        """
        items = rule.get('value', [])
        converted_items = []
        for item in items:
            if isinstance(item, dict):
                item_type = item.get('type', '')
                if item_type == 'constant':
                    converted_items.append(repr(item.get('value')))
                elif item_type == 'list':
                    # Nested list - recursively convert
                    converted_items.append(self._convert_list(item))
                else:
                    # Other rule types - convert recursively
                    converted_items.append(self._convert_rule(item))
            else:
                # Raw value
                converted_items.append(repr(item))
        return f'[{", ".join(converted_items)}]'

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

    def _convert_count_check(self, rule: Dict[str, Any]) -> str:
        """Convert count_check to Has().

        count_check is similar to item_check but typically has a count > 1.
        Common in dungeon key checks like 'has 5 small keys'.
        """
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

        # Handle can_reach state method - check second arg for type (Region, Location, or Entrance)
        if method in ('can_reach', 'can_reach_region'):
            if args and isinstance(args[0], dict):
                target = self._extract_constant_value(args[0], '')
                # Check if second argument specifies "Location" or "Entrance" type
                reach_type = self._extract_constant_value(args[1], 'Region') if len(args) > 1 else 'Region'
                if target:
                    target_escaped = target.replace('\\', '\\\\').replace('"', '\\"')
                    if reach_type == 'Location':
                        self.required_imports.add('CanReachLocation')
                        return f'CanReachLocation("{target_escaped}")'
                    elif reach_type == 'Entrance':
                        self.required_imports.add('CanReachEntrance')
                        return f'CanReachEntrance("{target_escaped}")'
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

        first_arg = args[0]

        # Handle 'set' type with 'elements' array (CC format)
        # Example: {"type": "set", "elements": [{"type": "constant", "value": "Item1"}, ...]}
        if first_arg.get('type') == 'set':
            elements = first_arg.get('elements', [])
            items = []
            for elem in elements:
                if elem.get('type') == 'constant':
                    items.append(elem.get('value'))
            if not items:
                # Empty item checks are trivially satisfied
                self.required_imports.add('True_')
                return 'True_()'
            # Unpack the items as separate arguments
            items_repr = ', '.join(repr(item) for item in items)
            return f'{class_name}({items_repr})'

        # Handle 'constant' type with the list directly
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

        # Check if this is a comparison between list constants (resolved placement lookups)
        # JavaScript can't compare arrays by value, so we must statically evaluate these
        left_list_val = self._get_list_constant_value(left)
        right_list_val = self._get_list_constant_value(right)

        if left_list_val is not None and right_list_val is not None:
            # Both sides are list constants - statically evaluate
            if op in ('==', 'eq'):
                static_result = left_list_val == right_list_val
            elif op in ('!=', 'ne'):
                static_result = left_list_val != right_list_val
            else:
                # Unsupported comparison for lists - fall through to Compare
                static_result = None

            if static_result is not None:
                if static_result:
                    self.required_imports.add('True_')
                    return 'True_()'
                else:
                    self.required_imports.add('False_')
                    return 'False_()'

        # Use Compare class for all other patterns
        # binary_op operands are now handled by _convert_compare_operand -> _convert_binary_op
        self.required_imports.add('Compare')
        left_code = self._convert_compare_operand(left)
        right_code = self._convert_compare_operand(right)

        return f'Compare({left_code}, "{op}", {right_code})'

    def _get_list_constant_value(self, operand: Any) -> Optional[list]:
        """
        Extract a list constant value from an operand for static comparison.
        Returns None if the operand is not a resolvable list constant.
        """
        if not isinstance(operand, dict):
            return None

        op_type = operand.get('type', '')

        if op_type == 'list':
            # Extract values from list type
            value_list = operand.get('value', [])
            result = []
            for item in value_list:
                if isinstance(item, dict) and item.get('type') == 'constant':
                    result.append(item.get('value'))
                else:
                    # Non-constant item in list - can't statically evaluate
                    return None
            return result

        if op_type == 'placement_lookup':
            # Resolve placement lookup to list value
            location_rule = operand.get('location', {})
            if isinstance(location_rule, dict) and location_rule.get('type') == 'constant':
                location_name = location_rule.get('value', '')
                if location_name and location_name in self.placements:
                    item_name = self.placements[location_name]
                    return [item_name, 1]  # [item_name, player]
            return None  # Unknown location

        return None

    def _convert_compare_operand(self, operand: Any) -> str:
        """Convert a compare operand to Python code."""
        if not isinstance(operand, dict):
            return repr(operand)

        op_type = operand.get('type', '')

        if op_type == 'constant':
            return repr(operand.get('value'))

        if op_type == 'count_item':
            # Handle count_item type from rules.json export
            item_name = operand.get('item', '')
            self.required_imports.add('CountItem')
            item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
            return f'CountItem("{item_escaped}")'

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

        if op_type == 'min':
            return self._convert_min(operand)

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

        if op_type == 'count_item':
            # Handle count_item type from rules.json export
            item_name = operand.get('item', '')
            self.required_imports.add('CountItem')
            item_escaped = item_name.replace('\\', '\\\\').replace('"', '\\"')
            return f'CountItem("{item_escaped}")'

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

        if op_type == 'min':
            return self._convert_min(operand)

        # Fall back to converting as a rule
        return self._convert_rule(operand)

    def _convert_min(self, operand: Dict[str, Any]) -> str:
        """Convert a min() operation to MinValue rule."""
        self.required_imports.add('MinValue')

        args = operand.get('args', [])
        if len(args) < 2:
            # Not enough arguments, return as-is with default
            return 'MinValue(0, 0)'

        left = args[0]
        right = args[1]

        left_code = self._convert_arithmetic_operand(left)
        right_code = self._convert_arithmetic_operand(right)

        return f'MinValue({left_code}, {right_code})'

    def _convert_sum(self, rule: Dict[str, Any]) -> str:
        """Convert a sum rule to an Arithmetic addition chain.

        A sum rule adds up boolean checks (treated as 0 or 1) for items.
        Example: sum of [has(Valor Form), has(Wisdom Form), ...]
        becomes: Arithmetic(Arithmetic(..., "+", Has("Valor Form")), "+", Has("Wisdom Form"))
        """
        # Get the iterable to sum over
        iterable = rule.get('iterable', {})

        # If it's a list, convert each element and chain with Arithmetic
        if iterable.get('type') == 'list':
            items = iterable.get('value', [])
            if not items:
                return '0'  # Empty sum is 0

            # Convert each item in the list
            item_exprs = [self._convert_rule(item) for item in items]

            if len(item_exprs) == 1:
                # Single item - wrap in conditional to convert bool to int
                self.required_imports.add('Conditional')
                return f'Conditional(test={item_exprs[0]}, if_true=1, if_false=0)'

            # Multiple items - chain with Arithmetic additions
            # Each Has() evaluates to True/False which Python treats as 1/0 in arithmetic
            self.required_imports.add('Arithmetic')
            result = item_exprs[0]
            for expr in item_exprs[1:]:
                result = f'Arithmetic({result}, "+", {expr})'
            return result

        # For other iterable types, try to convert
        return self._convert_rule(iterable)

    def _convert_setting_value(self, rule: Dict[str, Any]) -> str:
        """Convert a setting_value reference to its resolved value.

        Settings are resolved at generation time since worldgen worlds
        don't have access to the original game options at runtime.
        """
        setting = rule.get('setting', '')

        # Look up the setting value in our resolved settings
        if setting in self.settings:
            value = self.settings[setting]
            # Handle boolean values
            if isinstance(value, bool):
                self.required_imports.add('True_' if value else 'False_')
                return 'True_()' if value else 'False_()'
            # Handle string 'true'/'false' which are boolean-like
            elif isinstance(value, str):
                if value.lower() == 'true':
                    self.required_imports.add('True_')
                    return 'True_()'
                elif value.lower() == 'false':
                    self.required_imports.add('False_')
                    return 'False_()'
                # For other strings (like 'normal', 'light_and_darkness'), return as string literal
                return repr(value)
            else:
                return repr(value)

        # Setting not found - return False as safe default
        self.required_imports.add('False_')
        return 'False_()'

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

            # Build HelperCall with helper_func reference
            # Note: body_data is NOT included here anymore - helper bodies are now
            # exported via get_helper_definitions() in the Rules.py module, and the
            # frontend looks them up from the helpers section instead of inlining
            # them at every call site.
            parts = [f'helper_func={func_name}', f'helper_name="{helper_name}"']

            if arg_strs:
                parts.append(f'args=({", ".join(arg_strs)},)')

            return f'HelperCall({", ".join(parts)})'

        # Unknown helper - return True_() as placeholder
        self.required_imports.add('True_')
        return 'True_()'

    def _convert_placement_lookup(self, rule: Dict[str, Any]) -> str:
        """Convert placement_lookup to resolved placement data.

        Placement lookups check what item is at a specific location.
        We resolve these at code generation time using the known placements.
        """
        location_rule = rule.get('location', {})

        # Get the location name
        if isinstance(location_rule, dict) and location_rule.get('type') == 'constant':
            location_name = location_rule.get('value', '')
            if location_name and location_name in self.placements:
                item_name = self.placements[location_name]
                # Return as a Python list [item_name, player] - player is always 1 for worldgen
                return f'[{repr(item_name)}, 1]'

        # Location not found - return None which will make comparisons fail correctly
        return 'None'

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
    """Check if a rule is trivial (constant true).

    Handles both AST format and Rule Builder format.
    """
    if rule is None:
        return True
    if not isinstance(rule, dict):
        return rule is True
    # AST format: {"type": "constant", "value": True}
    if rule.get('type') == 'constant' and rule.get('value') is True:
        return True
    # Rule Builder format: {"rule": "True_", ...}
    if rule.get('rule') == 'True_':
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
        self.uses_math: bool = False  # Track if math functions are used
        self.placements: Dict[str, str] = {}  # location_name -> item_name

    def set_known_helpers(self, helper_names: Set[str]) -> None:
        """Set the list of known helper names for this game."""
        self.known_helpers = helper_names

    def set_placements(self, placements: Dict[str, str]) -> None:
        """Set the placement data for resolving placement_lookup rules."""
        self.placements = placements or {}

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
                # No default provided - use None as default so callers can omit this arg
                # This is needed when helper body is hardcoded/expanded and doesn't use the param
                sig_params.append(f'{param} = None')

        # Determine return type based on body structure
        return_type = "bool"
        if isinstance(body, dict):
            body_type = body.get('type', '')
            if body_type in ('sum_of', 'count_item', 'binary_op', 'binop', 'negate'):
                return_type = "int"

        signature = f"def {func_name}({', '.join(sig_params)}) -> {return_type}:"

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

        # Handle 'vars' array format (used for tuple unpacking like "for item, rating in dict.items()")
        vars_array = stmt.get('vars')
        if vars_array and isinstance(vars_array, list):
            var = ', '.join(vars_array)
        # Handle tuple unpacking in var (if var is a dict with type 'tuple')
        elif isinstance(var, dict) and var.get('type') == 'tuple':
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
            'sum_of': self._expr_sum_of,
            'min': self._expr_min,
            'max': self._expr_max,
            'block': self._expr_block,
            'placement_lookup': self._expr_placement_lookup,
            'f_string': self._expr_f_string,
            'formatted_value': self._expr_formatted_value,
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
            # Handle indexed access into list settings (e.g., required_medallions[0])
            if 'index' in expr and isinstance(value, list):
                index = expr['index']
                if 0 <= index < len(value):
                    value = value[index]
            if isinstance(value, bool):
                return 'True' if value else 'False'
            elif isinstance(value, str):
                return repr(value)
            else:
                return str(value)
        # If not found in settings, default to False for safety
        # This prevents inaccessible regions from being created with always-True rules
        return 'False'

    def _expr_placement_lookup(self, expr: Dict[str, Any]) -> str:
        """Resolve a placement_lookup to the actual item at that location.

        Placement lookups check what item is at a specific location.
        We resolve these at code generation time using the known placements.
        """
        location_rule = expr.get('location', {})

        # Get the location name
        if isinstance(location_rule, dict) and location_rule.get('type') == 'constant':
            location_name = location_rule.get('value', '')
            if location_name and location_name in self.placements:
                item_name = self.placements[location_name]
                # Return as a Python list [item_name, player] - player is always 1 for worldgen
                return f'[{repr(item_name)}, 1]'

        # Location not found - return None which will make comparisons fail correctly
        return 'None'

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

    def _expr_min(self, expr: Dict[str, Any]) -> str:
        """Generate min() call."""
        args = expr.get('args', [])
        if not args:
            return '0'
        arg_exprs = [self._generate_expression(a) for a in args]
        return f"min({', '.join(arg_exprs)})"

    def _expr_max(self, expr: Dict[str, Any]) -> str:
        """Generate max() call."""
        args = expr.get('args', [])
        if not args:
            return '0'
        arg_exprs = [self._generate_expression(a) for a in args]
        return f"max({', '.join(arg_exprs)})"

    def _expr_block(self, expr: Dict[str, Any]) -> str:
        """Generate expression from a block of statements.

        Blocks contain multiple statements (assignments, if statements, returns)
        that would require complex partial evaluation to simplify properly.

        For safety in worldgen where we may not have all the context,
        we return True for block expressions. This keeps locations accessible
        by default, which is the safer behavior.
        """
        return 'True'

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

        # Math functions - require math import
        if name in ('sqrt', 'floor', 'ceil', 'pow', 'abs'):
            self.uses_math = True  # Flag that we need math import
            arg_exprs = [self._generate_expression(a) for a in args]
            if name == 'abs':
                return f"abs({', '.join(arg_exprs)})"
            return f"math.{name}({', '.join(arg_exprs)})"

        # Unknown helper - return True as safe fallback
        # This handles helpers that were blacklisted during export (too complex to export)
        # Returning True makes the location always accessible, which is safer than crashing
        return 'True'

    def _get_arg_expr(self, arg: Any, default: Any = None) -> str:
        """Get argument expression - handles both constants and variable references.

        For variable references (name type), returns the variable name.
        For constants, returns repr() of the value.
        """
        if isinstance(arg, dict):
            arg_type = arg.get('type', '')
            # Handle name type (variable reference)
            if arg_type == 'name':
                return arg.get('name', str(default))
            # Handle constant type
            if arg_type == 'constant':
                value = arg.get('value', default)
                return repr(value)
            if arg_type == 'value':
                value = arg.get('value', default)
                return repr(value)
        # Raw value
        return repr(arg) if arg is not None else repr(default)

    def _expr_state_method(self, expr: Dict[str, Any]) -> str:
        """Generate state method call."""
        method = expr.get('method', '')
        args = expr.get('args', [])

        # Map methods to their Python equivalents
        if method == 'has':
            if len(args) >= 1:
                item_expr = self._get_arg_expr(args[0], '')
                count = self._extract_constant(args[1], 1) if len(args) > 1 else 1
                if count == 1:
                    return f'state.has({item_expr}, player)'
                return f'state.has({item_expr}, player, {count})'

        elif method == 'has_all':
            if len(args) >= 1:
                # has_all expects a tuple/list of item names
                items = self._extract_constant(args[0], [])
                items_repr = repr(tuple(items)) if items else '()'
                return f'state.has_all({items_repr}, player)'

        elif method == 'has_any':
            if len(args) >= 1:
                # has_any expects a tuple/list of item names
                items = self._extract_constant(args[0], [])
                items_repr = repr(tuple(items)) if items else '()'
                return f'state.has_any({items_repr}, player)'

        elif method == 'count':
            if len(args) >= 1:
                item_expr = self._get_arg_expr(args[0], '')
                return f'state.count({item_expr}, player)'

        elif method == 'count_group':
            if len(args) >= 1:
                group_expr = self._get_arg_expr(args[0], '')
                return f'state.count_group({group_expr}, player)'

        elif method == 'has_group':
            if len(args) >= 1:
                group_expr = self._get_arg_expr(args[0], '')
                count = self._extract_constant(args[1], 1) if len(args) > 1 else 1
                if count == 1:
                    return f'state.has_group({group_expr}, player)'
                return f'state.has_group({group_expr}, player, {count})'

        elif method == 'has_group_unique':
            if len(args) >= 1:
                group_expr = self._get_arg_expr(args[0], '')
                count = self._extract_constant(args[1], 1) if len(args) > 1 else 1
                if count == 1:
                    return f'state.has_group_unique({group_expr}, player)'
                return f'state.has_group_unique({group_expr}, player, {count})'

        elif method == 'can_reach':
            if len(args) >= 1:
                # First try to get a constant value
                target = self._extract_constant(args[0], None)
                if target is not None:
                    # It's a constant, use repr
                    target_expr = repr(target)
                else:
                    # It's a dynamic expression (like entrance.connected_region)
                    target_expr = self._generate_expression(args[0])
                # Second arg specifies reach type: "Region" or "Location"
                reach_type = self._extract_constant(args[1], 'Region') if len(args) > 1 else 'Region'
                return f'state.can_reach({target_expr}, {repr(reach_type)}, player)'

        elif method == 'can_reach_location':
            if len(args) >= 1:
                # First try to get a constant value
                location = self._extract_constant(args[0], None)
                if location is not None:
                    location_expr = repr(location)
                else:
                    # It's a dynamic expression
                    location_expr = self._generate_expression(args[0])
                return f'state.can_reach_location({location_expr}, player)'

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

        # Special case: when accessing self.multiworld, convert to state.multiworld
        # In original world code, 'self' refers to the World instance which has a multiworld attribute.
        # In worldgen standalone functions, we access multiworld via state.multiworld instead.
        if isinstance(obj_expr, dict) and obj_expr.get('type') == 'name' and obj_expr.get('name') == 'self':
            if attr == 'multiworld':
                return 'state.multiworld'

        # Special case: when accessing self.xxx where xxx is a setting (e.g., self.game_logic, flag_specific_keycards),
        # resolve it to the setting's value. This handles option-dependent logic flags that were
        # captured from LogicExtensions classes (e.g., TimespinnerLogic). In helper functions
        # exported from original worlds, 'self' refers to a logic class that has options as attributes.
        # We resolve these to literal values from settings.
        if isinstance(obj_expr, dict) and obj_expr.get('type') == 'name' and obj_expr.get('name') == 'self':
            if attr in self.settings:
                value = self.settings[attr]
                if isinstance(value, bool):
                    return 'True' if value else 'False'
                elif isinstance(value, str):
                    return repr(value)
                else:
                    return str(value)

        obj = self._generate_expression(obj_expr)
        return f"{obj}.{attr}"

    def _expr_function_call(self, expr: Dict[str, Any]) -> str:
        """Generate function call expression."""
        func = expr.get('function', {})
        args = expr.get('args', [])

        # Check if this is a math module function call (e.g., math.sqrt)
        # and set uses_math flag if so
        if isinstance(func, dict) and func.get('type') == 'attribute':
            obj = func.get('object', {})
            if isinstance(obj, dict) and obj.get('type') == 'name' and obj.get('name') == 'math':
                self.uses_math = True

        func_code = self._generate_expression(func)
        arg_exprs = [self._generate_expression(a) for a in args]

        # Special handling for state.multiworld.get_location - needs player argument
        # The exported helper body may be missing the player argument
        if func_code == 'state.multiworld.get_location' and len(arg_exprs) == 1:
            arg_exprs.append('player')

        # Special handling for .can_reach() method calls - needs state argument
        # Location and Region objects have can_reach(state) but exported code may call it without args
        if (isinstance(func, dict) and func.get('type') == 'attribute' and
                func.get('attr') == 'can_reach' and len(arg_exprs) == 0):
            arg_exprs.append('state')

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

    def _expr_sum_of(self, expr: Dict[str, Any]) -> str:
        """Generate sum() expression from sum_of CC format.

        CC export format: {
            "type": "sum_of",
            "iterator_info": {
                "target": {...},  // tuple of variable names
                "iterator": {...},  // expression to iterate over
                "condition": {...}  // optional filter condition
            },
            "element_rule": {...}  // expression for each element
        }
        """
        iterator_info = expr.get('iterator_info', {})
        target = iterator_info.get('target', {})
        iterator = iterator_info.get('iterator', {})
        condition = iterator_info.get('condition')
        element_rule = expr.get('element_rule', {'type': 'constant', 'value': 0})

        # Generate target variable names
        target_expr = self._generate_expression(target)

        # Generate iterator expression
        iterator_expr = self._generate_expression(iterator)

        # Generate element rule expression
        element_expr = self._generate_expression(element_rule)

        # Generate condition expression if present
        if condition:
            condition_expr = self._generate_expression(condition)
            return f"sum({element_expr} for {target_expr} in {iterator_expr} if {condition_expr})"

        return f"sum({element_expr} for {target_expr} in {iterator_expr})"

    def _extract_constant(self, value: Any, default: Any = None) -> Any:
        """Extract constant value from a potential constant wrapper.

        Also handles self.<setting> attribute access and subscript operations
        on settings (e.g., self.boss_order[0]).
        """
        if isinstance(value, dict):
            if value.get('type') == 'constant':
                return value.get('value', default)
            if value.get('type') == 'value':
                return value.get('value', default)
            if value.get('type') == 'set':
                # Extract all elements from the set
                elements = value.get('elements', [])
                return [self._extract_constant(elem, None) for elem in elements if self._extract_constant(elem, None) is not None]

            # Handle subscript on settings (e.g., self.boss_order[0])
            if value.get('type') == 'subscript':
                base_value = self._extract_constant(value.get('value', {}), None)
                index = self._extract_constant(value.get('index', {}), None)
                if base_value is not None and index is not None:
                    try:
                        return base_value[index]
                    except (IndexError, KeyError, TypeError):
                        pass
                return default

            # Handle attribute access on self (e.g., self.boss_order)
            if value.get('type') == 'attribute':
                obj = value.get('object', {})
                attr = value.get('attr', '')
                if isinstance(obj, dict) and obj.get('type') == 'name' and obj.get('name') == 'self':
                    if attr in self.settings:
                        return self.settings[attr]
                return default

            return default
        return value if value is not None else default

    def _expr_f_string(self, expr: Dict[str, Any]) -> str:
        """Generate Python f-string expression.

        Handles f-string expressions like f"Act Completion ({entrance.connected_region.name})"
        """
        parts = expr.get('parts', [])
        if not parts:
            return "''"

        # Build the f-string content
        f_string_parts = []
        for part in parts:
            if isinstance(part, dict):
                part_type = part.get('type', '')
                if part_type == 'constant':
                    # Literal string part
                    value = part.get('value', '')
                    # Escape any braces in the literal part
                    value = str(value).replace('{', '{{').replace('}', '}}')
                    f_string_parts.append(value)
                elif part_type == 'formatted_value':
                    # Expression to be interpolated
                    inner_value = part.get('value', {})
                    inner_expr = self._generate_expression(inner_value)
                    f_string_parts.append('{' + inner_expr + '}')
                else:
                    # Fallback - treat as expression
                    inner_expr = self._generate_expression(part)
                    f_string_parts.append('{' + inner_expr + '}')
            else:
                # Simple string part
                str_part = str(part).replace('{', '{{').replace('}', '}}')
                f_string_parts.append(str_part)

        return 'f"' + ''.join(f_string_parts) + '"'

    def _expr_formatted_value(self, expr: Dict[str, Any]) -> str:
        """Generate expression for a formatted value in an f-string.

        This is used when a formatted_value appears standalone (rare).
        """
        value = expr.get('value', {})
        return self._generate_expression(value)
