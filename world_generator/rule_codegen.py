"""
Rule code generator - converts AST format rules to Python Rule Builder code.

This module transforms JSON rule definitions into Python source code
that uses the Rule Builder pattern.
"""

import copy
from typing import Any, Dict, List, Set, Tuple, Optional


class RuleCodeGenerator:
    """Generates Python Rule Builder code from AST format rules."""

    def __init__(self, game_name: str = "", settings: Dict[str, Any] = None) -> None:
        self.required_imports: Set[str] = set()
        self.game_name = game_name
        self.settings = settings or {}  # Resolved settings for evaluating setting_value nodes
        # Sanitize game name for use in Python identifiers
        import re
        self.game_name_lower = re.sub(r'[^a-zA-Z0-9]', '', game_name).lower() if game_name else ""
        self.known_helpers: Set[str] = set()
        self.helper_bodies: Dict[str, Dict[str, Any]] = {}  # helper_name -> AST format body
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
            rule: Rule dict in AST format
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
        rb_rule = rule.get('rule', '')  # Rule Builder format uses 'rule' key

        # Handle Rule Builder format AST_setting_value - resolve to constant
        # This is critical for short-circuiting conditionals based on option values
        if rb_rule == 'AST_setting_value':
            args = rule.get('args', {})
            setting_name = args.get('setting', '')
            if setting_name in self.settings:
                value = self.settings[setting_name]
                return {'type': 'constant', 'value': value}
            return rule

        # Handle Rule Builder format Conditional - check for constant test
        if rb_rule == 'Conditional':
            args = rule.get('args', {})
            expanded_test = self._expand_helper_refs(args.get('test', {}), visited, depth)
            expanded_if_true = self._expand_helper_refs(args.get('if_true', {}), visited, depth)
            expanded_if_false = self._expand_helper_refs(args.get('if_false', {}), visited, depth)

            # If test resolved to a constant boolean, short-circuit to the appropriate branch
            if isinstance(expanded_test, dict) and expanded_test.get('type') == 'constant':
                test_value = expanded_test.get('value')
                if test_value is True or test_value == 'true':
                    return expanded_if_true
                elif test_value is False or test_value == 'false':
                    return expanded_if_false

            # Can't short-circuit - return expanded conditional
            return {
                'rule': 'Conditional',
                'args': {
                    'test': expanded_test,
                    'if_true': expanded_if_true,
                    'if_false': expanded_if_false
                }
            }

        # If this is a helper reference, expand it (only at top level to avoid overly complex rules)
        if rule_type == 'helper':
            helper_name = rule.get('name', '')
            if helper_name in visited:
                # Circular reference - return as-is to avoid infinite loop
                return rule
            # Only expand helpers at depth 0 (top level rules)
            # Nested helpers (depth > 0) are left as references for frontend lookup
            # Also don't expand helpers that have block bodies - they're too complex
            # and will be handled as Python helper functions instead
            helper_body = self.helper_bodies.get(helper_name)
            is_block_body = helper_body and helper_body.get('type') == 'block'
            if depth == 0 and helper_name in self.helper_bodies and not is_block_body:
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
                                # Convert default value to AST format constant
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

        # Note: placement_lookup rules are preserved as-is for runtime evaluation
        # via location_item_name() calls. We don't resolve them statically anymore.

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
        """Get the Python function name for a helper.

        Returns the helper name as-is, without any prefix. The helpers are
        defined in the world's Rules.py module, so they're already namespaced
        and don't need a game-specific prefix.
        """
        return helper_name

    def get_imports(self) -> List[str]:
        """Get the list of required Rule Builder imports."""
        # Always include base imports
        imports = ['True_', 'False_']

        # Add any imports we discovered during generation
        imports.extend(sorted(self.required_imports))

        return imports

    def generate(self, rule: Optional[Dict[str, Any]]) -> str:
        """
        Convert an AST format rule to Python Rule Builder expression.

        Args:
            rule: Rule dict in AST format, or None

        Returns:
            Python expression string using Rule Builder classes
        """
        if rule is None:
            self.required_imports.add('True_')
            return 'True_()'

        # Expand helper references and resolve setting_value references first.
        # This allows conditionals with setting-based tests to be short-circuited
        # when the setting evaluates to a constant boolean, avoiding generation
        # of unreachable branches that may contain unresolvable expressions
        # (like dynamic location lookups that only apply when a setting is false).
        expanded_rule = self._expand_helper_refs(rule)
        return self._convert_rule(expanded_rule)

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

        # Check for 'type' key (AST format) or 'rule' key (Rule Builder format)
        rule_type = rule.get('type', '') or ''

        # If no 'type', check for 'rule' key (Rule Builder format from exporter)
        if not rule_type:
            rb_rule = rule.get('rule', '')
            if rb_rule:
                # Map Rule Builder format rule names to converter types
                rb_to_type = {
                    'And': 'and',
                    'Or': 'or',
                    'Not': 'not',
                    'Has': 'item_check',
                    'HasAll': 'group_check',
                    'HasAny': 'group_check',
                    'HasAllCounts': 'group_check',
                    'HasGroup': 'group_check',
                    'HasGroupUnique': 'has_group_unique',
                    'HasFromList': 'has_from_list',
                    'HasFromListUnique': 'has_from_list_unique',
                    'Count': 'count_check',
                    'CountItem': 'count_item',
                    'CanReachRegion': 'can_reach',
                    'CanReachLocation': 'location_check',
                    'CanReachEntrance': 'entrance_check',
                    'True_': 'constant',
                    'False_': 'constant',
                    'Helper': 'helper',
                    'StateMethod': 'state_method',
                    'Compare': 'compare',
                    'Constant': 'constant',
                    'AST_all_of': 'ast_all_of',
                    'AST_any_of': 'ast_any_of',
                    'AST_prog_item_count': 'prog_item_count',  # State counter items like coins
                    'Arithmetic': 'binary_op',
                    'SettingValue': 'setting_value',  # Legacy
                    'OptionValue': 'option_value',
                    'WorldAttribute': 'world_attribute',
                    'Conditional': 'conditional',
                    'Name': 'name',  # Option/setting references
                    'CountItem': 'count_item',  # Item count for arithmetic/comparisons
                    'AST_min': 'min',  # Min operation from AST export
                    'List': 'list',  # Rule Builder format list for comparisons
                }
                rule_type = rb_to_type.get(rb_rule, '')

                # Convert Rule Builder format to Python code
                if rule_type:
                    return self._convert_rule_builder_format(rule, rb_rule, rule_type)

                # Check if this is a weighted_sum helper (used by Overcooked 2 and similar games)
                if rb_rule == 'weighted_sum' and rule.get('_original_ast_type') == 'helper':
                    return self._convert_weighted_sum(rule)

                # Check if this is a helper call from AST exporter format
                # AST exporter outputs helpers with rule=helper_name and _original_ast_type="helper"
                # Also check known_helpers for helpers without the _original_ast_type marker
                if rule.get('_original_ast_type') == 'helper' or rb_rule in self.known_helpers:
                    return self._convert_rule_builder_helper(rule, rb_rule)

                # Check if this is an AST_count_true rule (exported from AST format count_true)
                if rb_rule == 'AST_count_true':
                    args = rule.get('args', {})
                    return self._convert_count_true_from_args(args)

                # Check if this is an AST_comparison rule (comparison operators from AST format)
                if rb_rule == 'AST_comparison':
                    args = rule.get('args', {})
                    compare_rule = {
                        'type': 'compare',
                        'left': args.get('left', {}),
                        'op': args.get('op', ''),
                        'right': args.get('right', {})
                    }
                    return self._convert_compare(compare_rule)

                # Check if this is an AST_setting_value rule (setting references from AST format)
                if rb_rule == 'AST_setting_value':
                    args = rule.get('args', {})
                    setting_rule = {
                        'type': 'setting_value',
                        'setting': args.get('setting', '')
                    }
                    return self._convert_setting_value(setting_rule)

                # Check if this is an AST_location_rule_ref rule (location accessibility check from AST format)
                if rb_rule == 'AST_location_rule_ref':
                    args = rule.get('args', {})
                    location_rule = {
                        'type': 'location_rule_ref',
                        'location': args.get('location', '')
                    }
                    return self._convert_location_rule_ref(location_rule)

                # Check if this is an AST_region_check rule (region accessibility check from AST format)
                if rb_rule == 'AST_region_check':
                    args = rule.get('args', {})
                    region_rule = {
                        'type': 'can_reach',
                        'region': args.get('region', '')
                    }
                    return self._convert_can_reach_region(region_rule)

                # Check if this is an AST_placement_lookup rule (placement lookup from AST format)
                if rb_rule == 'AST_placement_lookup':
                    args = rule.get('args', {})
                    placement_rule = {
                        'type': 'placement_lookup',
                        'location': {'type': 'constant', 'value': args.get('location', '')}
                    }
                    return self._convert_placement_lookup(placement_rule)

                # Check if this is an AST_placement_search rule (check if item is at any of listed locations)
                if rb_rule == 'AST_placement_search':
                    args = rule.get('args', {})
                    item_name = args.get('item', '')
                    locations = args.get('locations', [])
                    # Build location pairs list for item_name_in_location_names
                    loc_pairs = []
                    for loc in locations:
                        if isinstance(loc, list) and loc:
                            loc_name = loc[0]
                            loc_player = loc[1] if len(loc) > 1 else 1
                            loc_pairs.append(f'({repr(loc_name)}, {loc_player})')
                        elif isinstance(loc, str):
                            loc_pairs.append(f'({repr(loc)}, player)')
                    # Generate call to item_name_in_location_names for runtime lookup
                    locs_str = f'[{", ".join(loc_pairs)}]'
                    return f'item_name_in_location_names(state, {repr(item_name)}, player, {locs_str})'

                # Check if this is an AST_function_call rule (option.to_bool() style calls)
                if rb_rule == 'AST_function_call':
                    return self._convert_ast_function_call(rule)

                # Check if this is an AST_capability rule (capability check converted from can_X helpers)
                # AST_capability with capability "defeat_enough_rbms" -> can_defeat_enough_rbms(state, player)
                if rb_rule == 'AST_capability':
                    args = rule.get('args', {})
                    capability = args.get('capability', '')
                    if capability:
                        helper_name = f'can_{capability}'
                        # Check if this helper exists in known_helpers
                        if helper_name in self.known_helpers:
                            self.required_imports.add('HelperCall')
                            func_name = self.get_function_name(helper_name)
                            # Generate a HelperCall for the helper function
                            return f'HelperCall({func_name})'
                    # Unknown capability - fall through to True_()

        # Dispatch based on rule type
        converters = {
            'constant': self._convert_constant,
            'item_check': self._convert_item_check,
            'count_check': self._convert_count_check,
            'group_check': self._convert_group_check,
            'and': self._convert_and,
            'or': self._convert_or,
            'can_reach': self._convert_can_reach_region,
            'region_check': self._convert_can_reach_region,
            'location_check': self._convert_location_check,
            'location_rule_ref': self._convert_location_rule_ref,
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
            'ast_all_of': self._convert_ast_all_of,
            'ast_any_of': self._convert_ast_any_of,
            'count_true': self._convert_count_true,
            'block': self._convert_ast_block,
        }

        converter = converters.get(rule_type)
        if converter:
            return converter(rule)

        # Check for AST_block in Rule Builder format
        rb_rule = rule.get('rule', '')
        if rb_rule == 'AST_block':
            return self._convert_ast_block(rule)

        # Unknown rule type - return True_() as placeholder
        # Don't use inline comments as they break multi-line expressions
        return 'True_()'

    def _convert_rule_builder_format(self, rule: Dict[str, Any], rb_rule: str, rule_type: str) -> str:
        """Convert Rule Builder format rules (with 'rule' key) to Python expressions."""
        args = rule.get('args', {})
        children = rule.get('children', [])

        if rb_rule == 'True_':
            return self._make_bool_constant(True)

        if rb_rule == 'False_':
            return self._make_bool_constant(False)

        if rb_rule == 'Has':
            item_name = args.get('item_name', '')
            count = args.get('count', 1)

            self.required_imports.add('Has')

            # If count is a complex expression (dict), pass it as a rule reference
            if isinstance(count, dict):
                # Convert the count expression to code
                # Use _convert_compare_operand to preserve numeric values
                count_expr = self._convert_compare_operand(count)
                return f'Has({repr(item_name)}, {count_expr})'

            # Preserve the exact count from the original rule, including count=0
            # This ensures round-trip fidelity when comparing exports
            # Always include count to preserve original rule structure
            return f'Has({repr(item_name)}, {count})'

        if rb_rule == 'And':
            if not children:
                return self._make_bool_constant(True)
            if len(children) == 1:
                return self._convert_rule(children[0])
            # Optimization: If all children are simple Has rules with count=1,
            # use HasAll instead of And(Has(...), Has(...), ...)
            # This matches the Rule Builder's _simplify_and behavior
            simple_has_items = []
            other_children = []
            for child in children:
                child_rule = child.get('rule', '')
                child_args = child.get('args', {})
                if child_rule == 'Has' and child_args.get('count', 1) == 1:
                    item_name = child_args.get('item_name', '')
                    if item_name:
                        simple_has_items.append(item_name)
                    else:
                        other_children.append(child)
                else:
                    other_children.append(child)

            # Convert other children
            child_exprs = [self._convert_rule(child) for child in other_children]

            # Add simple Has items as HasAll (if 2+) or Has (if 1)
            if len(simple_has_items) >= 2:
                self.required_imports.add('HasAll')
                items_str = ', '.join(repr(item) for item in simple_has_items)
                child_exprs.append(f'HasAll({items_str})')
            elif len(simple_has_items) == 1:
                self.required_imports.add('Has')
                child_exprs.append(f'Has({repr(simple_has_items[0])})')

            if len(child_exprs) == 1:
                return child_exprs[0]

            self.required_imports.add('And')
            return f'And({", ".join(child_exprs)})'

        if rb_rule == 'Or':
            if not children:
                return self._make_bool_constant(False)
            if len(children) == 1:
                return self._convert_rule(children[0])
            # Optimization: If all children are simple Has rules with count=1,
            # use HasAny instead of Or(Has(...), Has(...), ...)
            # This matches the Rule Builder's _simplify_or behavior
            simple_has_items = []
            other_children = []
            for child in children:
                child_rule = child.get('rule', '')
                child_args = child.get('args', {})
                if child_rule == 'Has' and child_args.get('count', 1) == 1:
                    item_name = child_args.get('item_name', '')
                    if item_name:
                        simple_has_items.append(item_name)
                    else:
                        other_children.append(child)
                else:
                    other_children.append(child)

            # Convert other children
            child_exprs = [self._convert_rule(child) for child in other_children]

            # Add simple Has items as HasAny (if 2+) or Has (if 1)
            if len(simple_has_items) >= 2:
                self.required_imports.add('HasAny')
                items_str = ', '.join(repr(item) for item in simple_has_items)
                child_exprs.append(f'HasAny({items_str})')
            elif len(simple_has_items) == 1:
                self.required_imports.add('Has')
                child_exprs.append(f'Has({repr(simple_has_items[0])})')

            if len(child_exprs) == 1:
                return child_exprs[0]

            self.required_imports.add('Or')
            return f'Or({", ".join(child_exprs)})'

        if rb_rule == 'Not':
            # Not can have child in children list or in args.condition
            if children:
                child_expr = self._convert_rule(children[0])
            elif 'condition' in args:
                # Handle Rule Builder format from AST exporter (args.condition)
                child_expr = self._convert_rule(args['condition'])
            else:
                child_expr = self._make_bool_constant(True)
            self.required_imports.add('Not')
            return f'Not({child_expr})'

        if rb_rule == 'Count':
            item_name = args.get('item_name', '')
            count = args.get('count', 1)
            self.required_imports.add('Compare')
            self.required_imports.add('CountItem')
            return f'Compare(CountItem({repr(item_name)}), ">=", {count})'

        if rb_rule == 'HasAll':
            items = args.get('items', [])
            if not items:
                return self._make_bool_constant(True)
            self.required_imports.add('HasAll')
            # HasAll expects variadic arguments, not a list
            items_str = ', '.join(repr(item) for item in items)
            return f'HasAll({items_str})'

        if rb_rule == 'HasAny':
            items = args.get('items', [])
            if not items:
                return self._make_bool_constant(False)
            self.required_imports.add('HasAny')
            # HasAny expects variadic arguments, not a list
            items_str = ', '.join(repr(item) for item in items)
            return f'HasAny({items_str})'

        if rb_rule == 'HasAllCounts':
            items = args.get('items', {})
            if not items:
                return self._make_bool_constant(True)
            self.required_imports.add('HasAllCounts')
            # HasAllCounts expects a dict of {item_name: count}
            return f'HasAllCounts({repr(items)})'

        if rb_rule == 'HasGroup':
            group = args.get('group', '')
            count_raw = args.get('count', 1)
            count = self._extract_constant_value(count_raw, 1)
            self.required_imports.add('HasGroup')
            if count == 1:
                return f'HasGroup({repr(group)})'
            else:
                return f'HasGroup({repr(group)}, {count})'

        if rb_rule == 'HasGroupUnique':
            group = args.get('group', '')
            count_raw = args.get('count', 1)
            count = self._extract_constant_value(count_raw, 1)
            self.required_imports.add('HasGroupUnique')
            if count == 1:
                return f'HasGroupUnique({repr(group)})'
            else:
                return f'HasGroupUnique({repr(group)}, {count})'

        if rb_rule == 'HasFromList':
            items = args.get('items', [])
            count = args.get('count', 1)
            if not items:
                return self._make_bool_constant(True)
            self.required_imports.add('HasFromList')
            # HasFromList expects (*item_names: str, count: int = 1)
            items_str = ', '.join(repr(item) for item in items)
            return f'HasFromList({items_str}, count={count})'

        if rb_rule == 'HasFromListUnique':
            items = args.get('items', [])
            count = args.get('count', 1)
            if not items:
                return self._make_bool_constant(True)
            self.required_imports.add('HasFromListUnique')
            # HasFromListUnique expects (*item_names: str, count: int = 1)
            items_str = ', '.join(repr(item) for item in items)
            return f'HasFromListUnique({items_str}, count={count})'

        if rb_rule == 'CanReachRegion':
            region = self._extract_constant_value(args.get('region_name', ''), '')
            self.required_imports.add('CanReachRegion')
            return f'CanReachRegion({repr(region)})'

        if rb_rule == 'CanReachLocation':
            location = self._extract_constant_value(args.get('location_name', ''), '')
            self.required_imports.add('CanReachLocation')
            return f'CanReachLocation({repr(location)})'

        if rb_rule == 'CanReachEntrance':
            entrance = self._extract_constant_value(args.get('entrance_name', ''), '')
            self.required_imports.add('CanReachEntrance')
            return f'CanReachEntrance({repr(entrance)})'

        if rb_rule == 'Helper':
            # Convert to the format expected by _convert_helper
            helper_rule = {
                'type': 'helper',
                'name': args.get('name', ''),
                'args': args.get('args', [])
            }
            return self._convert_helper(helper_rule)

        if rb_rule == 'StateMethod':
            # Convert to the format expected by _convert_state_method
            state_rule = {
                'method': args.get('method', ''),
                'args': args.get('args', [])
            }
            return self._convert_state_method(state_rule)

        if rb_rule == 'Compare':
            # Convert Rule Builder format Compare to AST format
            compare_rule = {
                'type': 'compare',
                'left': args.get('left', {}),
                'op': args.get('op', ''),
                'right': args.get('right', {})
            }
            return self._convert_compare(compare_rule)

        if rb_rule == 'Arithmetic':
            # Convert Rule Builder format Arithmetic to binary_op format
            binary_op_rule = {
                'type': 'binary_op',
                'left': args.get('left', {}),
                'op': args.get('op', '+'),
                'right': args.get('right', {})
            }
            return self._convert_binary_op(binary_op_rule)

        if rb_rule == 'SettingValue':
            # Convert Rule Builder format SettingValue (legacy)
            setting_rule = {
                'type': 'setting_value',
                'setting': args.get('setting', '')
            }
            return self._convert_setting_value(setting_rule)

        if rb_rule == 'OptionValue':
            # Convert Rule Builder format OptionValue
            option_rule = {
                'type': 'option_value',
                'option': args.get('option', '')
            }
            return self._expr_option_value(option_rule)

        if rb_rule == 'WorldAttribute':
            # Convert Rule Builder format WorldAttribute
            attr_rule = {
                'type': 'world_attribute',
                'attribute': args.get('attribute', '')
            }
            if 'index' in args:
                attr_rule['index'] = args['index']
            return self._expr_world_attribute(attr_rule)

        if rb_rule == 'Conditional':
            # Convert Rule Builder format Conditional
            conditional_rule = {
                'type': 'conditional',
                'test': args.get('test', {}),
                'if_true': args.get('if_true', {}),
                'if_false': args.get('if_false', {})
            }
            return self._convert_conditional(conditional_rule)

        if rb_rule == 'Constant':
            # Handle Constant rule
            # Values can be booleans (True/False) or integers (0/1) representing boolean conditions
            value = args.get('value')
            if value is True:
                self.required_imports.add('True_')
                return 'True_()'
            elif value is False:
                self.required_imports.add('False_')
                return 'False_()'
            elif isinstance(value, int):
                # Integer values represent boolean conditions (0 = false, non-zero = true)
                # This handles cases like settings that resolve to 0/1 instead of False/True
                if value:
                    self.required_imports.add('True_')
                    return 'True_()'
                else:
                    self.required_imports.add('False_')
                    return 'False_()'
            else:
                return repr(value)

        if rb_rule == 'AST_all_of':
            # Delegate to the dedicated converter
            return self._convert_ast_all_of(rule)

        if rb_rule == 'AST_any_of':
            # Delegate to the dedicated converter
            return self._convert_ast_any_of(rule)

        # Handle AST_count_true rules (count N of M conditions as true)
        if rb_rule == 'AST_count_true':
            return self._convert_count_true_from_args(args)

        # Handle CountItem rule (item count for comparisons)
        if rb_rule == 'CountItem':
            item_name = args.get('item_name', '')
            return self._make_count_item(item_name)

        # Handle AST_min rule (min operation from AST export)
        if rb_rule == 'AST_min':
            # The args are nested under args.args
            min_args = args.get('args', [])
            if len(min_args) >= 2:
                self.required_imports.add('MinValue')
                left_code = self._convert_arithmetic_operand(min_args[0])
                right_code = self._convert_arithmetic_operand(min_args[1])
                return f'MinValue({left_code}, {right_code})'
            return 'MinValue(0, 0)'

        # Handle AST_max rule (max operation from AST export)
        if rb_rule == 'AST_max':
            # The args are nested under args.args
            max_args = args.get('args', [])
            if len(max_args) >= 2:
                self.required_imports.add('MaxValue')
                # Chain multiple args: MaxValue(MaxValue(a, b), c)
                result = self._convert_arithmetic_operand(max_args[0])
                for arg in max_args[1:]:
                    arg_code = self._convert_arithmetic_operand(arg)
                    result = f'MaxValue({result}, {arg_code})'
                return result
            elif len(max_args) == 1:
                return self._convert_arithmetic_operand(max_args[0])
            return '0'

        # Handle AST_prog_item_count rule (for state counter items like coins)
        # This converts {"rule": "AST_prog_item_count", "args": {"key": " coins"}}
        # to CountItem(" coins") for use in Compare expressions
        if rb_rule == 'AST_prog_item_count':
            key = args.get('key', '')
            return self._make_count_item(key)

        # Handle AST_count_item rule (from AST format, counts items for arithmetic)
        if rb_rule == 'AST_count_item':
            item_name = args.get('item', '')
            return self._make_count_item(item_name)

        if rb_rule == 'AST_block':
            # Convert AST block to evaluated result
            return self._convert_ast_block(rule)

        if rb_rule == 'List':
            # Convert Rule Builder format List to Python list literal
            # Structure: {"rule": "List", "args": {"value": [...]}}
            value_list = args.get('value', [])
            converted_items = []
            for item in value_list:
                if isinstance(item, dict):
                    # Check for Rule Builder format Constant
                    if item.get('rule') == 'Constant':
                        converted_items.append(repr(item.get('args', {}).get('value')))
                    elif item.get('type') == 'constant':
                        converted_items.append(repr(item.get('value')))
                    else:
                        # Other rule types - convert recursively
                        converted_items.append(self._convert_rule(item))
                else:
                    # Raw value
                    converted_items.append(repr(item))
            return f'[{", ".join(converted_items)}]'

        if rb_rule == 'Name':
            # Convert Name rule to constant based on settings
            # The name is in args.name for Rule Builder format
            name = args.get('name', '')
            return self._resolve_setting_to_bool(name, default=False)

        # Unknown Rule Builder rule - return True_() as placeholder
        self.required_imports.add('True_')
        return 'True_()'

    def _convert_name(self, rule: Dict[str, Any]) -> str:
        """Convert a name reference to a constant.

        Names typically reference game settings/options. Since worldgen worlds
        don't have the original game options, we resolve them to constants.
        If the name matches a known setting, use its value. Otherwise default
        to False_() since most setting references are optional feature flags
        that should be disabled for vanilla worldgen.
        """
        name = rule.get('name', '')
        return self._resolve_setting_to_bool(name, default=False)

    def _convert_constant(self, rule: Dict[str, Any]) -> str:
        """Convert constant rule - preserves type (bool, int, float, etc.)."""
        value = rule.get('value', True)
        # Preserve numeric values for use in arithmetic/comparison contexts
        if isinstance(value, bool):
            return self._make_bool_constant(value)
        elif isinstance(value, int):
            # Integer 0 and 1 are often boolean toggle values from options
            # These need to be converted to False_()/True_() when used in boolean contexts
            # (e.g., inside Not(), And(), Or())
            # Other integers are preserved for arithmetic operations
            if value == 0:
                return self._make_bool_constant(False)
            elif value == 1:
                return self._make_bool_constant(True)
            else:
                return repr(value)
        elif isinstance(value, float):
            return repr(value)
        else:
            # For other types (strings, etc.), use boolean interpretation
            return self._make_bool_constant(bool(value))

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

    def _extract_constant(self, value: Any, default: Any = None) -> Any:
        """Extract constant value from complex expressions.

        Handles constants, binary operations (like 'Axe' + 's' -> 'Axes'),
        and subscript operations (like item_groups["Axes"]).
        """
        if isinstance(value, dict):
            if value.get('type') == 'constant':
                return value.get('value', default)
            if value.get('type') == 'value':
                return value.get('value', default)
            if value.get('type') == 'set':
                elements = value.get('elements', [])
                return [self._extract_constant(elem, None) for elem in elements if self._extract_constant(elem, None) is not None]

            # Handle binary operations on constants (e.g., 'Axe' + 's' -> 'Axes')
            if value.get('type') in ('binary_op', 'binop'):
                left = self._extract_constant(value.get('left', {}), None)
                right = self._extract_constant(value.get('right', {}), None)
                op = value.get('op', '+')
                op_map = {'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/', 'FloorDiv': '//'}
                op = op_map.get(op, op)
                if left is not None and right is not None:
                    try:
                        if op == '+':
                            return left + right
                        elif op == '-':
                            return left - right
                        elif op == '*':
                            return left * right
                        elif op == '/':
                            return left / right
                        elif op == '//':
                            return left // right
                    except TypeError:
                        pass
                return default

            # Handle subscript (e.g., item_groups["Axes"])
            if value.get('type') == 'subscript':
                base_value = self._extract_constant(value.get('value', {}), None)
                index = self._extract_constant(value.get('index', {}), None)
                if base_value is not None and index is not None:
                    try:
                        return base_value[index]
                    except (IndexError, KeyError, TypeError):
                        pass
                return default

            return default
        return value if value is not None else default

    # =========================================================================
    # Helper methods to reduce code duplication
    # =========================================================================

    def _escape_string(self, s: str, quote_char: str = '"') -> str:
        """Escape a string for use in generated Python code.

        Args:
            s: The string to escape
            quote_char: The quote character to escape (" or ')

        Returns:
            The escaped string (without surrounding quotes)
        """
        escaped = s.replace('\\', '\\\\')
        if quote_char == '"':
            return escaped.replace('"', '\\"')
        else:
            return escaped.replace("'", "\\'")

    def _make_count_item(self, item_name: str) -> str:
        """Generate CountItem expression for the given item name.

        Args:
            item_name: The item name to count

        Returns:
            A CountItem("item_name") expression string
        """
        self.required_imports.add('CountItem')
        item_escaped = self._escape_string(item_name)
        return f'CountItem("{item_escaped}")'

    def _make_bool_constant(self, value: bool) -> str:
        """Generate a True_() or False_() expression.

        Args:
            value: The boolean value

        Returns:
            'True_()' or 'False_()' expression string
        """
        if value:
            self.required_imports.add('True_')
            return 'True_()'
        else:
            self.required_imports.add('False_')
            return 'False_()'

    def _resolve_setting_to_bool(self, name: str, default: bool = False) -> str:
        """Resolve a setting/option name to a boolean constant.

        Looks up the name in self.settings and returns True_() or False_()
        based on the value. If the name is not found, returns the default.

        Args:
            name: The setting/option name to look up
            default: Default value if setting not found

        Returns:
            'True_()' or 'False_()' expression string
        """
        if name in self.settings:
            value = self.settings[name]
            return self._make_bool_constant(bool(value))
        return self._make_bool_constant(default)

    # =========================================================================
    # End helper methods
    # =========================================================================

    def _convert_item_check(self, rule: Dict[str, Any]) -> str:
        """Convert item_check to Has()."""
        self.required_imports.add('Has')

        item_raw = rule.get('item', '')
        item = self._extract_constant_value(item_raw, '')
        count_raw = rule.get('count', 1)
        count = self._extract_constant_value(count_raw, 1)

        item_escaped = self._escape_string(item)

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

        item_escaped = self._escape_string(item)

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

        group_escaped = self._escape_string(group)

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

    def _convert_count_true(self, rule: Dict[str, Any]) -> str:
        """Convert count_true rule (AST format with 'type' key).

        count_true checks if at least 'count' of the 'conditions' evaluate to true.
        Structure: {"type": "count_true", "count": N, "conditions": [...]}
        """
        count = rule.get('count', 0)
        conditions = rule.get('conditions', [])
        return self._convert_count_true_logic(count, conditions)

    def _convert_count_true_from_args(self, args: Dict[str, Any]) -> str:
        """Convert AST_count_true rule (Rule Builder format with 'rule' key).

        AST_count_true is exported from AST format by the converter.
        Structure: {"rule": "AST_count_true", "args": {"count": N, "conditions": [...]}}
        """
        count = args.get('count', 0)
        conditions = args.get('conditions', [])
        return self._convert_count_true_logic(count, conditions)

    def _convert_count_true_logic(self, count: int, conditions: List[Dict[str, Any]]) -> str:
        """Core logic for converting count_true rules.

        Converts "at least count of conditions must be true" to Rule Builder code.

        Optimizations:
        - count == 0: Always true (True_())
        - count == 1: Any condition must be true (Or of all conditions)
        - count == len(conditions): All must be true (And of all conditions)
        - count > len(conditions): Never possible (False_())
        - General case: Generate combinations using Or/And

        For the general case with many conditions, we generate Python code that
        counts conditions. If all conditions are simple item_checks, we use a
        more efficient list comprehension.
        """
        n = len(conditions)

        # Edge cases
        if count <= 0:
            self.required_imports.add('True_')
            return 'True_()'

        if n == 0 or count > n:
            self.required_imports.add('False_')
            return 'False_()'

        # count == 1: Any one condition is enough (Or)
        if count == 1:
            if n == 1:
                return self._convert_rule(conditions[0])
            converted = [self._convert_rule(c) for c in conditions]
            return ' | '.join(f'({c})' for c in converted)

        # count == n: All conditions must be true (And)
        if count == n:
            if n == 1:
                return self._convert_rule(conditions[0])
            converted = [self._convert_rule(c) for c in conditions]
            return ' & '.join(f'({c})' for c in converted)

        # General case: count > 1 and count < n
        # Check if all conditions are simple item_checks - if so, use HasFromList
        all_item_checks = all(
            isinstance(c, dict) and c.get('type') == 'item_check'
            for c in conditions
        )

        if all_item_checks:
            # Extract item names
            items = [c.get('item', '') for c in conditions]
            items_str = ', '.join(repr(item) for item in items)
            self.required_imports.add('HasFromList')
            return f'HasFromList({items_str}, count={count})'

        # For mixed conditions, we need to generate combinations
        # To avoid combinatorial explosion, we'll generate a more compact representation
        # using a custom approach: And(Or(combinations), Or(combinations), ...)
        #
        # For "at least 2 of N", we need all pairs that could work.
        # But this gets complex, so for now, fall back to Or of all And combinations
        # Limited to small counts to avoid explosion
        if count <= 3 and n <= 10:
            from itertools import combinations
            combos = list(combinations(range(n), count))
            if len(combos) <= 50:  # Reasonable limit
                combo_exprs = []
                for combo in combos:
                    combo_conditions = [conditions[i] for i in combo]
                    converted = [self._convert_rule(c) for c in combo_conditions]
                    and_expr = ' & '.join(f'({c})' for c in converted)
                    combo_exprs.append(f'({and_expr})')
                return ' | '.join(combo_exprs)

        # Fallback for complex cases: generate True_() with a warning
        # This is conservative - locations will be accessible earlier than they should be
        # TODO: Implement lambda-based counting for complex cases
        self.required_imports.add('True_')
        return 'True_()'

    def _convert_can_reach_region(self, rule: Dict[str, Any]) -> str:
        """Convert can_reach to CanReachRegion()."""
        self.required_imports.add('CanReachRegion')

        region_raw = rule.get('region', '')
        region = self._extract_constant_value(region_raw, '')
        region_escaped = self._escape_string(region)

        return f'CanReachRegion("{region_escaped}")'

    def _convert_location_check(self, rule: Dict[str, Any]) -> str:
        """Convert location_check to CanReachLocation()."""
        self.required_imports.add('CanReachLocation')

        location_raw = rule.get('location', '')
        location = self._extract_constant_value(location_raw, '')
        location_escaped = self._escape_string(location)

        return f'CanReachLocation("{location_escaped}")'

    def _convert_location_rule_ref(self, rule: Dict[str, Any]) -> str:
        """Convert location_rule_ref to CanReachLocation().

        location_rule_ref checks if a location's access rule is satisfied,
        which is equivalent to CanReachLocation (checking if the location is accessible).
        """
        self.required_imports.add('CanReachLocation')

        location_raw = rule.get('location', '')
        location = self._extract_constant_value(location_raw, '')
        location_escaped = self._escape_string(location)

        return f'CanReachLocation("{location_escaped}")'

    def _convert_can_reach_entrance(self, rule: Dict[str, Any]) -> str:
        """Convert can_reach_entrance to CanReachEntrance()."""
        self.required_imports.add('CanReachEntrance')

        entrance_raw = rule.get('entrance', '')
        entrance = self._extract_constant_value(entrance_raw, '')
        entrance_escaped = self._escape_string(entrance)

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
                    target_escaped = self._escape_string(target)
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
                    location_escaped = self._escape_string(location)
                    return f'CanReachLocation("{location_escaped}")'
            return 'True_()'

        # Handle basic has state method
        if method == 'has':
            if args:
                item = self._extract_constant_value(args[0], '') if args else ''
                count = self._extract_constant_value(args[1], 1) if len(args) > 1 else 1
                if item:
                    self.required_imports.add('Has')
                    item_escaped = self._escape_string(item)
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

        # Handle 'set' type with 'elements' array (AST format)
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

        # Handle 'subscript' type (e.g., item_groups["Axes"])
        # This extracts the value using _extract_constant which handles
        # subscript with binary_op index (like item_groups["Axe" + "s"])
        if first_arg.get('type') == 'subscript':
            items = self._extract_constant(first_arg, [])
            if isinstance(items, list) and items:
                items_repr = ', '.join(repr(item) for item in items)
                return f'{class_name}({items_repr})'
            # If extraction failed or returned empty, fall through to True_()

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

        # For 'in' and 'not in' operators, check if operands are valid
        # If either operand is True_() or False_() (unresolvable), the comparison is invalid
        # (e.g., "enemy_health in ['easy', 'default']" can't be evaluated without game options)
        # Default to True_() for 'in' (assume option check passes) and False_() for 'not in'
        if op in ('in', 'not in'):
            if left_code in ('True_()', 'False_()') or right_code in ('True_()', 'False_()'):
                # Can't perform membership test with boolean values
                # Return sensible default based on operator
                if op == 'in':
                    self.required_imports.add('True_')
                    return 'True_()'
                else:  # 'not in'
                    self.required_imports.add('False_')
                    return 'False_()'

        return f'Compare({left_code}, "{op}", {right_code})'

    def _get_list_constant_value(self, operand: Any) -> Optional[tuple]:
        """
        Extract a tuple/list constant value from an operand for static comparison.
        Returns a tuple if the operand can be resolved, None otherwise.

        Placement lookups return (item_name, player) tuples to match Tuple rules.
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
            return tuple(result)

        if op_type == 'tuple':
            # Extract values from tuple type
            elements = operand.get('elements', [])
            result = []
            for item in elements:
                if isinstance(item, dict) and item.get('type') == 'constant':
                    result.append(item.get('value'))
                else:
                    # Non-constant item in tuple - can't statically evaluate
                    return None
            return tuple(result)

        if op_type == 'placement_lookup':
            # Don't resolve placement_lookup statically - we want runtime lookup
            # via location_item_name() calls
            return None

        # Handle Rule Builder format
        rb_rule = operand.get('rule', '')

        if rb_rule == 'AST_placement_lookup':
            # Don't resolve placement_lookup statically - we want runtime lookup
            # via location_item_name() calls
            return None

        # Handle Rule Builder format Tuple (e.g., {"rule": "Tuple", "args": {"value": [...]}})
        if rb_rule == 'Tuple':
            args = operand.get('args', {})
            value_list = args.get('value', args.get('elements', []))
            result = []
            for item in value_list:
                if isinstance(item, dict):
                    # Check for Rule Builder format Constant
                    if item.get('rule') == 'Constant':
                        result.append(item.get('args', {}).get('value'))
                    elif item.get('type') == 'constant':
                        result.append(item.get('value'))
                    else:
                        # Non-constant item in tuple - can't statically evaluate
                        return None
                else:
                    result.append(item)
            return tuple(result)

        # Handle Rule Builder format List (e.g., {"rule": "List", "args": {"value": [...]}})
        if rb_rule == 'List':
            args = operand.get('args', {})
            value_list = args.get('value', [])
            result = []
            for item in value_list:
                if isinstance(item, dict):
                    # Check for Rule Builder format Constant
                    if item.get('rule') == 'Constant':
                        result.append(item.get('args', {}).get('value'))
                    elif item.get('type') == 'constant':
                        result.append(item.get('value'))
                    else:
                        # Non-constant item in list - can't statically evaluate
                        return None
                else:
                    result.append(item)
            return tuple(result)

        return None

    def _convert_compare_operand(self, operand: Any) -> str:
        """Convert a compare operand to Python code.

        Note: Raw lists are converted to tuples because placement_lookup
        comparisons use location_item_name() which returns tuples.
        """
        if not isinstance(operand, dict):
            # Convert lists to tuples for proper comparison with location_item_name()
            if isinstance(operand, list):
                return repr(tuple(operand))
            return repr(operand)

        op_type = operand.get('type', '')

        if op_type == 'constant':
            return repr(operand.get('value'))

        # Handle Rule Builder format Constant (e.g., {"rule": "Constant", "args": {"value": 6}})
        # These are numeric constants used in comparisons (e.g., quest_points > 6)
        # and must be preserved as numbers, not converted to booleans
        rb_rule = operand.get('rule', '')
        if rb_rule == 'Constant':
            value = operand.get('args', {}).get('value')
            return repr(value)

        if op_type == 'count_item':
            # Handle count_item type from rules.json export
            item_name = operand.get('item', '')
            return self._make_count_item(item_name)

        if op_type == 'state_method':
            method = operand.get('method', '')
            args = operand.get('args', [])

            # Handle count method specially
            if method == 'count':
                if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                    item_name = args[0].get('value', '')
                    return self._make_count_item(item_name)

        if op_type == 'binary_op':
            return self._convert_binary_op(operand)

        if op_type == 'min':
            return self._convert_min(operand)

        # Check for Rule Builder format (has 'rule' key instead of 'type')
        rb_rule = operand.get('rule', '')
        rb_args = operand.get('args', {})

        if rb_rule == 'CountItem':
            item_name = rb_args.get('item_name', '')
            return self._make_count_item(item_name)

        if rb_rule == 'AST_count_item':
            # Handle AST_count_item from CC converter (e.g., {"rule": "AST_count_item", "args": {"item": "..."}})
            item_name = rb_args.get('item', '')
            return self._make_count_item(item_name)

        if rb_rule == 'AST_min':
            # Handle AST_min with nested args
            min_args = rb_args.get('args', [])
            if len(min_args) >= 2:
                self.required_imports.add('MinValue')
                left_code = self._convert_arithmetic_operand(min_args[0])
                right_code = self._convert_arithmetic_operand(min_args[1])
                return f'MinValue({left_code}, {right_code})'
            return 'MinValue(0, 0)'

        if rb_rule == 'AST_max':
            # Handle AST_max with nested args
            max_args = rb_args.get('args', [])
            if len(max_args) >= 2:
                self.required_imports.add('MaxValue')
                # Chain multiple args: MaxValue(MaxValue(a, b), c)
                result = self._convert_arithmetic_operand(max_args[0])
                for arg in max_args[1:]:
                    arg_code = self._convert_arithmetic_operand(arg)
                    result = f'MaxValue({result}, {arg_code})'
                return result
            elif len(max_args) == 1:
                return self._convert_arithmetic_operand(max_args[0])
            return '0'

        if rb_rule == 'SettingValue':
            # Handle SettingValue in Compare operand - preserve numeric value
            # Unlike _convert_setting_value which converts to boolean rules,
            # Compare operands need the actual numeric value for arithmetic comparisons
            setting = rb_args.get('setting', '')
            if setting in self.settings:
                value = self.settings[setting]
                # For numeric settings in Compare context, return the raw value
                if isinstance(value, (int, float)):
                    return repr(value)
                # For boolean-like settings, convert to True_/False_
                if isinstance(value, bool):
                    self.required_imports.add('True_' if value else 'False_')
                    return 'True_()' if value else 'False_()'
                if isinstance(value, str):
                    if value.lower() == 'true':
                        self.required_imports.add('True_')
                        return 'True_()'
                    elif value.lower() == 'false':
                        self.required_imports.add('False_')
                        return 'False_()'
                # Other values (strings, etc.) - return as string literal
                return repr(value)
            # Unknown setting - return 0 as safe fallback
            return '0'

        if rb_rule == 'OptionValue':
            # Handle OptionValue in Compare operand - preserve numeric value
            option = rb_args.get('option', '')
            if option in self.settings:
                value = self.settings[option]
                if isinstance(value, (int, float)):
                    return repr(value)
                if isinstance(value, bool):
                    self.required_imports.add('True_' if value else 'False_')
                    return 'True_()' if value else 'False_()'
                return repr(value)
            return '0'

        if rb_rule == 'WorldAttribute':
            # Handle WorldAttribute in Compare operand - preserve value
            attribute = rb_args.get('attribute', '')
            if attribute in self.world_attributes:
                value = self.world_attributes[attribute]
                if isinstance(value, (int, float)):
                    return repr(value)
                if isinstance(value, bool):
                    self.required_imports.add('True_' if value else 'False_')
                    return 'True_()' if value else 'False_()'
                return repr(value)
            return '0'

        if rb_rule == 'Arithmetic':
            # Handle Rule Builder format Arithmetic in Compare operand
            binary_op_rule = {
                'type': 'binary_op',
                'left': rb_args.get('left', {}),
                'op': rb_args.get('op', '+'),
                'right': rb_args.get('right', {})
            }
            return self._convert_binary_op(binary_op_rule)

        # Handle Tuple operand (e.g., for 'in' operator: value in ('a', 'b', 'c'))
        if rb_rule == 'Tuple':
            args = operand.get('args', {})
            value_list = args.get('value', args.get('elements', []))
            items = []
            for item in value_list:
                if isinstance(item, dict):
                    if item.get('rule') == 'Constant':
                        items.append(repr(item.get('args', {}).get('value')))
                    elif item.get('type') == 'constant':
                        items.append(repr(item.get('value')))
                    else:
                        # Recursively convert complex items
                        items.append(self._convert_compare_operand(item))
                else:
                    items.append(repr(item))
            return f"({', '.join(items)})"

        # Handle List operand - convert to tuple for consistency with location_item_name()
        # which returns tuples. This ensures comparisons work correctly.
        if rb_rule == 'List':
            args = operand.get('args', {})
            value_list = args.get('value', args.get('elements', []))
            items = []
            for item in value_list:
                if isinstance(item, dict):
                    if item.get('rule') == 'Constant':
                        items.append(repr(item.get('args', {}).get('value')))
                    elif item.get('type') == 'constant':
                        items.append(repr(item.get('value')))
                    else:
                        items.append(self._convert_compare_operand(item))
                else:
                    items.append(repr(item))
            # Use tuple format to match location_item_name() return type
            return f"({', '.join(items)},)" if len(items) == 1 else f"({', '.join(items)})"

        # Handle integer-returning helpers used as Compare operands
        # These are helpers that count items and return an integer (e.g., weapon_armor_upgrade_count)
        # They are blacklisted from normal helper export but need to be converted to CountItem
        if operand.get('_original_ast_type') == 'helper':
            # Get the helper's first argument which is typically the item name
            args = operand.get('args', [])
            if args and isinstance(args[0], dict):
                arg = args[0]
                # Extract item name from Constant or constant format
                if arg.get('rule') == 'Constant':
                    item_name = arg.get('args', {}).get('value', '')
                elif arg.get('type') == 'constant':
                    item_name = arg.get('value', '')
                else:
                    item_name = ''

                if item_name:
                    # Convert helper call to CountItem for the item
                    return self._make_count_item(item_name)

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

        # Handle Rule Builder format Constant (e.g., {"rule": "Constant", "args": {"value": 6}})
        # These are numeric constants used in arithmetic and must be preserved as numbers
        rb_rule = operand.get('rule', '')
        if rb_rule == 'Constant':
            value = operand.get('args', {}).get('value')
            return repr(value)

        # Handle Rule Builder format AST_count_item (e.g., {"rule": "AST_count_item", "args": {"item": "Star"}})
        if rb_rule == 'AST_count_item':
            item_name = operand.get('args', {}).get('item', '')
            return self._make_count_item(item_name)

        # Handle Rule Builder format Arithmetic in arithmetic operand
        if rb_rule == 'Arithmetic':
            rb_args = operand.get('args', {})
            binary_op_rule = {
                'type': 'binary_op',
                'left': rb_args.get('left', {}),
                'op': rb_args.get('op', '+'),
                'right': rb_args.get('right', {})
            }
            return self._convert_binary_op(binary_op_rule)

        # Handle Rule Builder format SettingValue in arithmetic operand
        if rb_rule == 'SettingValue':
            rb_args = operand.get('args', {})
            setting = rb_args.get('setting', '')
            if setting in self.settings:
                value = self.settings[setting]
                # For numeric settings in arithmetic context, return the raw value
                if isinstance(value, (int, float)):
                    return repr(value)
            # Unknown or non-numeric setting - return 0 as safe fallback
            return '0'

        # Handle Rule Builder format OptionValue in arithmetic operand
        if rb_rule == 'OptionValue':
            rb_args = operand.get('args', {})
            option = rb_args.get('option', '')
            if option in self.settings:
                value = self.settings[option]
                if isinstance(value, (int, float)):
                    return repr(value)
            return '0'

        # Handle Rule Builder format WorldAttribute in arithmetic operand
        if rb_rule == 'WorldAttribute':
            rb_args = operand.get('args', {})
            attribute = rb_args.get('attribute', '')
            if attribute in self.world_attributes:
                value = self.world_attributes[attribute]
                if isinstance(value, (int, float)):
                    return repr(value)
            return '0'

        if op_type == 'count_item':
            # Handle count_item type from rules.json export
            item_name = operand.get('item', '')
            return self._make_count_item(item_name)

        if op_type == 'state_method':
            method = operand.get('method', '')
            args = operand.get('args', [])

            if method == 'count':
                if args and isinstance(args[0], dict) and args[0].get('type') == 'constant':
                    item_name = args[0].get('value', '')
                    return self._make_count_item(item_name)

        if op_type == 'binary_op':
            return self._convert_binary_op(operand)

        if op_type == 'min':
            return self._convert_min(operand)

        # Handle Rule Builder format rules with 'rule' key (for arithmetic operands)
        rb_rule = operand.get('rule', '')
        rb_args = operand.get('args', {})

        if rb_rule == 'AST_min':
            # Handle AST_min with nested args
            min_args = rb_args.get('args', [])
            if len(min_args) >= 2:
                self.required_imports.add('MinValue')
                left_code = self._convert_arithmetic_operand(min_args[0])
                right_code = self._convert_arithmetic_operand(min_args[1])
                return f'MinValue({left_code}, {right_code})'
            return 'MinValue(0, 0)'

        if rb_rule == 'AST_max':
            # Handle AST_max with nested args
            max_args = rb_args.get('args', [])
            if len(max_args) >= 2:
                self.required_imports.add('MaxValue')
                # Chain multiple args: MaxValue(MaxValue(a, b), c)
                result = self._convert_arithmetic_operand(max_args[0])
                for arg in max_args[1:]:
                    arg_code = self._convert_arithmetic_operand(arg)
                    result = f'MaxValue({result}, {arg_code})'
                return result
            elif len(max_args) == 1:
                return self._convert_arithmetic_operand(max_args[0])
            return '0'

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
            # Handle integer values - return as-is for use in count/arithmetic contexts
            # In cases where they're used in boolean contexts (like Not()), the caller
            # is responsible for appropriate handling via Compare(value, ">", 0)
            elif isinstance(value, int):
                return repr(value)
            else:
                return repr(value)

        # Setting not found - return False as safe default
        self.required_imports.add('False_')
        return 'False_()'

    def _expr_world_attribute(self, expr: Dict[str, Any]) -> str:
        """Generate code to access a world attribute at runtime.

        World attributes are properties on the world object that are set
        during game generation. Examples include logic settings like
        'logic_obscure_1' in The Wind Waker.

        Always generates: state.multiworld.worlds[player].<name>
        This pattern is recognized by the exporter's pattern detection.
        """
        attribute = expr.get('attribute', '')
        base_path = f'state.multiworld.worlds[player].{attribute}'

        # Handle indexed access (e.g., required_medallions[0])
        if 'index' in expr:
            index = expr['index']
            if isinstance(index, int):
                return f'{base_path}[{index}]'
            elif isinstance(index, str):
                return f'{base_path}[{repr(index)}]'

        return base_path

    def _expr_option_value(self, expr: Dict[str, Any]) -> str:
        """Generate code to access an option at runtime.

        Options are accessed via the world's options attribute at runtime.
        This generates: state.multiworld.worlds[player].options.<name>
        This pattern is recognized by the exporter's _is_world_options_pattern().
        """
        option = expr.get('option', '')
        base_path = f'state.multiworld.worlds[player].options.{option}'

        # Handle indexed access (not common for options, but supported)
        if 'index' in expr:
            index = expr['index']
            if isinstance(index, int):
                return f'{base_path}[{index}]'
            elif isinstance(index, str):
                return f'{base_path}[{repr(index)}]'

        return base_path

    def _convert_ast_block(self, rule: Dict[str, Any]) -> str:
        """Convert an AST_block rule to Python Rule Builder expression.

        AST_block represents Python code blocks with statements. Common patterns include:
        - is_auto_scroll checks: assigns level_id, checks Cancel Auto Scroll, returns comparison
        - has_level_progression checks: counts items with x2 multipliers

        For worldgen worlds, we need to evaluate these blocks at generation time since
        they often reference game options that won't exist at runtime.

        Strategy:
        1. Look for return statements and try to evaluate them
        2. If the block references a missing setting_value, default to False
        3. For unknown patterns, default to False (conservative - makes locations accessible)
        """
        args = rule.get('args', {})
        statements = args.get('statements', [])

        # Try to find and evaluate the block
        return self._evaluate_ast_block_statements(statements)

    def _evaluate_ast_block_statements(self, statements: List[Dict[str, Any]]) -> str:
        """Evaluate a list of AST statements and return the result.

        For blocks that reference missing settings (like sprite_data, auto_scroll_levels),
        we default to True_() (accessible) since:
        - Most setting checks are "is feature X enabled" type checks
        - Defaulting to True means locations are accessible when we can't evaluate
        - This matches the original game behavior with default settings
        """
        # Check if this block contains state_method calls that need runtime evaluation
        if self._contains_state_method(statements):
            result = self._generate_runtime_ast_block(statements)
            if result is not None:
                return result

        # Track variable assignments for substitution
        local_vars: Dict[str, Any] = {}
        # Track if block references missing settings
        has_missing_settings = False

        for stmt in statements:
            stmt_type = stmt.get('type', '')

            if stmt_type == 'assign':
                # Track variable assignment
                name = stmt.get('name', '')
                value = stmt.get('value', {})
                value_type = value.get('type', '')

                if value_type == 'constant':
                    local_vars[name] = value.get('value')
                elif value_type == 'setting_value':
                    # Look up setting value from resolved settings
                    setting_name = value.get('setting', '')
                    if setting_name in self.settings:
                        local_vars[name] = self.settings[setting_name]
                    else:
                        has_missing_settings = True
                        local_vars[name] = 0
                elif value_type == 'subscript':
                    # Evaluate subscript (e.g., [200, 400, 600][swim_rule % 3])
                    subscript_value = value.get('value', {})
                    subscript_index = value.get('index', {})

                    # Get the array/value
                    arr = None
                    if subscript_value.get('type') == 'constant':
                        arr = subscript_value.get('value')

                    # Get the index
                    idx = self._try_evaluate_expr(subscript_index, local_vars)

                    # Handle binary_op index (e.g., swim_rule % 3)
                    if idx is None and subscript_index.get('type') == 'binary_op':
                        left = self._try_evaluate_expr(subscript_index.get('left', {}), local_vars)
                        right = self._try_evaluate_expr(subscript_index.get('right', {}), local_vars)
                        op = subscript_index.get('op', '')
                        if left is not None and right is not None:
                            try:
                                if op == '%':
                                    idx = left % right
                                elif op == '+':
                                    idx = left + right
                                elif op == '-':
                                    idx = left - right
                                elif op == '*':
                                    idx = left * right
                                elif op == '//':
                                    idx = left // right
                            except (TypeError, ZeroDivisionError):
                                pass

                    if arr is not None and idx is not None:
                        try:
                            if isinstance(arr, (list, tuple)):
                                local_vars[name] = arr[int(idx)]
                            elif isinstance(arr, dict):
                                local_vars[name] = arr[idx]
                        except (IndexError, KeyError, TypeError):
                            local_vars[name] = 0
                    else:
                        local_vars[name] = 0
                else:
                    # Complex assignment - check if it references missing settings
                    if self._references_missing_setting(value):
                        has_missing_settings = True
                        # For variables like 'sharks' that count from sprite_data,
                        # assume 0 (no blocking elements)
                        local_vars[name] = 0

            elif stmt_type == 'if_statement':
                # Try to evaluate if statements that return early
                test = stmt.get('test', {})
                body = stmt.get('body', [])

                # Check for patterns like: if has_item or not variable
                # If variable is 0 (our default), "not variable" is True
                if self._can_evaluate_if_test(test, local_vars):
                    test_result = self._evaluate_if_test(test, local_vars)
                    if test_result:
                        # If test is true, evaluate the body
                        for body_stmt in body:
                            if body_stmt.get('type') == 'return':
                                return self._evaluate_ast_return_value(body_stmt.get('value', {}), local_vars)

            elif stmt_type == 'return':
                # Evaluate the return value
                result = self._evaluate_ast_return_value(stmt.get('value', {}), local_vars)
                # If the result is False and we have missing settings,
                # that might be incorrect - but keep it for now
                return result

        # No return statement found or couldn't evaluate
        # Default to True (accessible) when we can't determine
        self.required_imports.add('True_')
        return 'True_()'

    def _references_missing_setting(self, value: Dict[str, Any]) -> bool:
        """Check if an expression references a missing setting."""
        if not isinstance(value, dict):
            return False

        if value.get('type') == 'setting_value':
            setting_name = value.get('setting', '')
            return setting_name not in self.settings

        # Check nested structures
        for v in value.values():
            if isinstance(v, dict) and self._references_missing_setting(v):
                return True
            elif isinstance(v, list):
                for item in v:
                    if isinstance(item, dict) and self._references_missing_setting(item):
                        return True
        return False

    def _can_evaluate_if_test(self, test: Dict[str, Any], local_vars: Dict[str, Any]) -> bool:
        """Check if we can evaluate an if statement test."""
        test_type = test.get('type', '')

        if test_type == 'or':
            # Can evaluate if any condition can be evaluated to True
            conditions = test.get('conditions', [])
            for cond in conditions:
                if cond.get('type') == 'not':
                    inner = cond.get('condition', {})
                    if inner.get('type') == 'name' and inner.get('name') in local_vars:
                        return True
                elif cond.get('type') == 'item_check':
                    return True
            return False

        if test_type == 'not':
            inner = test.get('condition', {})
            if inner.get('type') == 'name' and inner.get('name') in local_vars:
                return True

        # Handle compare type (e.g., swim_rule > 2)
        if test_type == 'compare':
            left = test.get('left', {})
            right = test.get('right', {})
            # Can evaluate if both operands can be resolved
            left_val = self._try_evaluate_expr(left, local_vars)
            right_val = self._try_evaluate_expr(right, local_vars)
            if left_val is not None and right_val is not None:
                return True

        return False

    def _evaluate_if_test(self, test: Dict[str, Any], local_vars: Dict[str, Any]) -> bool:
        """Evaluate an if statement test."""
        test_type = test.get('type', '')

        if test_type == 'or':
            conditions = test.get('conditions', [])
            for cond in conditions:
                if cond.get('type') == 'not':
                    inner = cond.get('condition', {})
                    if inner.get('type') == 'name':
                        var_name = inner.get('name')
                        var_val = local_vars.get(var_name, 0)
                        if not var_val:  # not 0 = True
                            return True
                # For item_check conditions, assume player doesn't have items
                # This makes us continue to check other paths
            return False

        if test_type == 'not':
            inner = test.get('condition', {})
            if inner.get('type') == 'name':
                var_name = inner.get('name')
                var_val = local_vars.get(var_name, 0)
                return not var_val

        # Handle compare type (e.g., swim_rule > 2)
        if test_type == 'compare':
            left = test.get('left', {})
            right = test.get('right', {})
            op = test.get('op', '')
            left_val = self._try_evaluate_expr(left, local_vars)
            right_val = self._try_evaluate_expr(right, local_vars)
            if left_val is not None and right_val is not None:
                return self._evaluate_comparison(left_val, op, right_val)

        return False

    def _evaluate_ast_return_value(self, value: Dict[str, Any], local_vars: Dict[str, Any]) -> str:
        """Evaluate an AST return value expression."""
        value_type = value.get('type', '')

        if value_type == 'constant':
            const_val = value.get('value')
            if isinstance(const_val, bool):
                self.required_imports.add('True_' if const_val else 'False_')
                return 'True_()' if const_val else 'False_()'
            return repr(const_val)

        # Handle variable references - look up in local_vars
        if value_type == 'name':
            var_name = value.get('name', '')
            if var_name in local_vars:
                var_val = local_vars[var_name]
                if isinstance(var_val, bool):
                    self.required_imports.add('True_' if var_val else 'False_')
                    return 'True_()' if var_val else 'False_()'
                elif isinstance(var_val, (int, float)):
                    return repr(var_val)
            # Variable not found - return 0 as safe numeric default
            return '0'

        if value_type == 'compare':
            # Comparison like: auto_scroll_levels[level_id] > 0
            left = value.get('left', {})
            op = value.get('op', '')
            right = value.get('right', {})

            # Check if this is a setting_value subscript comparison
            if left.get('type') == 'subscript':
                subscript_value = left.get('value', {})

                # Check for setting_value (like auto_scroll_levels)
                if subscript_value.get('type') == 'setting_value':
                    setting_name = subscript_value.get('setting', '')

                    # If the setting exists, try to evaluate
                    if setting_name in self.settings:
                        setting_data = self.settings[setting_name]
                        # Get the index
                        index = left.get('index', {})
                        index_val = None
                        if index.get('type') == 'constant':
                            index_val = index.get('value')
                        elif index.get('type') == 'name':
                            index_val = local_vars.get(index.get('name'))

                        if index_val is not None and isinstance(setting_data, (dict, list)):
                            try:
                                actual_value = setting_data[index_val] if isinstance(setting_data, dict) else setting_data[int(index_val)]
                                right_val = right.get('value', 0) if right.get('type') == 'constant' else 0

                                # Evaluate the comparison
                                result = self._evaluate_comparison(actual_value, op, right_val)
                                self.required_imports.add('True_' if result else 'False_')
                                return 'True_()' if result else 'False_()'
                            except (KeyError, IndexError, TypeError):
                                pass

                    # Setting not found or can't evaluate - default to False
                    # For auto_scroll checks, False means no auto-scroll, which is the most accessible case
                    self.required_imports.add('False_')
                    return 'False_()'

            # Try to evaluate other comparisons
            left_val = self._try_evaluate_expr(left, local_vars)
            right_val = self._try_evaluate_expr(right, local_vars)

            if left_val is not None and right_val is not None:
                result = self._evaluate_comparison(left_val, op, right_val)
                self.required_imports.add('True_' if result else 'False_')
                return 'True_()' if result else 'False_()'

        # Can't evaluate - default to False (conservative for accessibility)
        self.required_imports.add('False_')
        return 'False_()'

    def _try_evaluate_expr(self, expr: Dict[str, Any], local_vars: Dict[str, Any]) -> Any:
        """Try to evaluate an expression to a constant value."""
        expr_type = expr.get('type', '')

        if expr_type == 'constant':
            return expr.get('value')

        if expr_type == 'name':
            return local_vars.get(expr.get('name'))

        return None

    def _evaluate_comparison(self, left: Any, op: str, right: Any) -> bool:
        """Evaluate a comparison operation."""
        try:
            if op == '>':
                return left > right
            elif op == '<':
                return left < right
            elif op == '>=':
                return left >= right
            elif op == '<=':
                return left <= right
            elif op == '==' or op == 'eq':
                return left == right
            elif op == '!=' or op == 'ne':
                return left != right
        except TypeError:
            pass
        return False

    def _contains_state_method(self, statements: List[Dict[str, Any]]) -> bool:
        """Check if any statement contains runtime-dependent checks like item_check or state_method."""
        # Types that require runtime evaluation (player state)
        runtime_types = {'state_method', 'item_check', 'count_check', 'group_check'}

        def check_value(value: Any) -> bool:
            if not isinstance(value, dict):
                return False
            if value.get('type') in runtime_types:
                return True
            # Check nested structures
            for v in value.values():
                if isinstance(v, dict) and check_value(v):
                    return True
                elif isinstance(v, list):
                    for item in v:
                        if isinstance(item, dict) and check_value(item):
                            return True
            return False

        for stmt in statements:
            stmt_type = stmt.get('type', '')
            if stmt_type == 'for_range':
                # Check count expression and body
                if check_value(stmt.get('count', {})):
                    return True
                for body_stmt in stmt.get('body', []):
                    if check_value(body_stmt):
                        return True
            elif stmt_type == 'assign':
                if check_value(stmt.get('value', {})):
                    return True
            elif stmt_type == 'return':
                if check_value(stmt.get('value', {})):
                    return True
        return False

    def _generate_runtime_ast_block(self, statements: List[Dict[str, Any]],
                                       initial_vars: Dict[str, str] = None,
                                       is_nested: bool = False) -> Optional[str]:
        """Generate a Rule Builder expression for AST blocks with runtime-dependent state_method calls.

        This handles patterns like shapez belt speed calculation:
        - multiplier = 1.0
        - for _ in range(count("Rising Belt Upgrade")): multiplier *= 2
        - multiplier += count("Gigantic Belt Upgrade") * 10
        - multiplier += count("Big Belt Upgrade")
        - multiplier += count("Small Belt Upgrade") * 0.1
        - return multiplier >= 1.6

        This is converted to:
        Compare(
            Arithmetic(Arithmetic(2, "**", CountItem("Rising Belt Upgrade")), "+", ...),
            ">=",
            1.6
        )

        Args:
            statements: List of statement dicts in AST format
            initial_vars: Optional dict of variable names to their current expression values
                         (for processing nested blocks that need access to outer scope)
            is_nested: If True, this is a nested block within an expression. In this case,
                      we should NOT accumulate conditions from "if condition: return False" patterns,
                      as those only make sense at the top level for accessibility rules.
        """
        # Track symbolic expressions for variables
        # Each variable maps to a string representing its Rule Builder expression
        var_expressions: Dict[str, str] = dict(initial_vars) if initial_vars else {}

        for stmt in statements:
            stmt_type = stmt.get('type', '')

            if stmt_type == 'assign':
                name = stmt.get('name', '')
                value = stmt.get('value', {})
                op = stmt.get('op', None)  # None for =, "*=" for *=, "+=" for +=

                if op is None:
                    # Simple assignment: var = expr
                    expr = self._expr_to_rule_builder(value, var_expressions)
                    if expr is None:
                        return None
                    var_expressions[name] = expr
                elif op == '+=':
                    # Augmented addition: var += expr
                    if name not in var_expressions:
                        return None
                    right_expr = self._expr_to_rule_builder(value, var_expressions)
                    if right_expr is None:
                        return None
                    self.required_imports.add('Arithmetic')
                    var_expressions[name] = f'Arithmetic({var_expressions[name]}, "+", {right_expr})'
                elif op == '*=':
                    # Augmented multiplication: var *= expr
                    if name not in var_expressions:
                        return None
                    right_expr = self._expr_to_rule_builder(value, var_expressions)
                    if right_expr is None:
                        return None
                    self.required_imports.add('Arithmetic')
                    var_expressions[name] = f'Arithmetic({var_expressions[name]}, "*", {right_expr})'
                else:
                    # Unsupported operator
                    return None

            elif stmt_type == 'for_range':
                # Handle: for _ in range(count): body
                # Special case: for _ in range(count("Item")): var *= constant
                # This is equivalent to: var = var * (constant ** count("Item"))
                count_expr = stmt.get('count', {})
                body = stmt.get('body', [])
                loop_var = stmt.get('var', '_')

                # We only handle simple bodies with a single *= assignment
                if len(body) != 1:
                    return None
                body_stmt = body[0]
                if body_stmt.get('type') != 'assign' or body_stmt.get('op') != '*=':
                    return None

                var_name = body_stmt.get('name', '')
                mult_value = body_stmt.get('value', {})

                if mult_value.get('type') != 'constant':
                    return None

                multiplier = mult_value.get('value')
                if var_name not in var_expressions:
                    return None

                # Convert: var *= multiplier (n times) to: var = (multiplier ** n) * initial_value
                # But we need the base value before the for loop
                # Since for_range multiplies n times, the result is: initial * (multiplier ** n)
                # If initial is a constant (like 1.0), this simplifies to: multiplier ** n

                count_rule = self._expr_to_rule_builder(count_expr, var_expressions)
                if count_rule is None:
                    return None

                # Check if current var value is a simple constant we can handle
                current_expr = var_expressions[var_name]
                try:
                    initial_val = float(current_expr)
                except (ValueError, TypeError):
                    # Current expression is not a simple constant
                    # Generate: initial_expr * (multiplier ** count)
                    self.required_imports.add('Arithmetic')
                    var_expressions[var_name] = f'Arithmetic({current_expr}, "*", Arithmetic({multiplier}, "**", {count_rule}))'
                    continue

                # Initial value is a constant
                if initial_val == 1.0:
                    # 1.0 * (multiplier ** n) = multiplier ** n
                    self.required_imports.add('Arithmetic')
                    var_expressions[var_name] = f'Arithmetic({multiplier}, "**", {count_rule})'
                else:
                    # initial * (multiplier ** n)
                    self.required_imports.add('Arithmetic')
                    var_expressions[var_name] = f'Arithmetic({initial_val}, "*", Arithmetic({multiplier}, "**", {count_rule}))'

            elif stmt_type == 'if_statement':
                # Handle if_statement with early returns
                # We need to check if the condition can be evaluated at codegen time
                # If the condition involves only constants and known variables, evaluate it
                # If it involves item_checks, generate a conditional rule
                test = stmt.get('test', {})
                body = stmt.get('body', [])
                orelse = stmt.get('orelse', [])

                # Try to evaluate the test as a constant
                test_result = self._try_evaluate_if_test_constant(test, var_expressions)

                if test_result is True:
                    # Test is always true, process the body
                    for body_stmt in body:
                        if body_stmt.get('type') == 'return':
                            return self._expr_to_rule_builder(body_stmt.get('value', {}), var_expressions)
                    # Continue to process remaining statements if no return in body
                elif test_result is False:
                    # Test is always false, skip the body and process orelse
                    for orelse_stmt in orelse:
                        if orelse_stmt.get('type') == 'return':
                            return self._expr_to_rule_builder(orelse_stmt.get('value', {}), var_expressions)
                    # Continue to process remaining statements
                else:
                    # Test contains runtime-dependent parts, we need to generate conditional logic
                    # Check if body contains a return False
                    body_returns_false = (
                        len(body) == 1 and
                        body[0].get('type') == 'return' and
                        body[0].get('value', {}).get('type') == 'constant' and
                        body[0].get('value', {}).get('value') is False
                    )

                    if body_returns_false and not is_nested:
                        # Pattern: if condition: return False
                        # This means: not condition is required for accessibility
                        # Note: only accumulate conditions at top level, not in nested blocks
                        test_expr = self._expr_to_rule_builder(test, var_expressions)
                        if test_expr is not None:
                            # We'll need to incorporate this check later
                            # For now, store it as a required condition (negated)
                            self.required_imports.add('Not')
                            if 'required_conditions' not in var_expressions:
                                var_expressions['required_conditions'] = []
                            # Add the negated condition to requirements
                            var_expressions.setdefault('_conditions', []).append(f'Not({test_expr})')

            elif stmt_type == 'return':
                value = stmt.get('value', {})
                # Use the general expression converter
                result_expr = self._expr_to_rule_builder(value, var_expressions)
                if result_expr is not None:
                    # If we accumulated conditions, combine them with the result
                    # but only at top level (not in nested blocks)
                    conditions = var_expressions.get('_conditions', [])
                    if conditions and not is_nested:
                        # Combine all conditions with And, filtering True/False values
                        all_conditions = conditions + [result_expr]
                        # Filter out True values and short-circuit on False
                        filtered = []
                        for c in all_conditions:
                            if c == 'False' or c == 'False_()':
                                self.required_imports.add('False_')
                                return 'False_()'
                            if c == 'True' or c == 'True_()':
                                continue
                            filtered.append(c)
                        if not filtered:
                            self.required_imports.add('True_')
                            return 'True_()'
                        if len(filtered) == 1:
                            return filtered[0]
                        return ' & '.join(f'({c})' for c in filtered)
                    return result_expr
                return None

        # No return statement found
        return None

    def _try_evaluate_if_test_constant(self, test: Dict[str, Any], var_expressions: Dict[str, str]) -> Optional[bool]:
        """Try to evaluate an if test as a constant boolean.

        Returns True if test is always true, False if always false, None if it depends on runtime state.
        """
        test_type = test.get('type', '')

        if test_type == 'constant':
            return bool(test.get('value'))

        if test_type == 'name':
            name = test.get('name', '')
            if name in var_expressions:
                # Try to evaluate the variable's value as a constant
                try:
                    val = eval(var_expressions[name])
                    return bool(val)
                except:
                    pass
            return None

        if test_type == 'and':
            conditions = test.get('conditions', [])
            all_true = True
            for cond in conditions:
                result = self._try_evaluate_if_test_constant(cond, var_expressions)
                if result is False:
                    return False  # Short-circuit: any False means and is False
                if result is None:
                    all_true = False  # Can't determine this condition
            return True if all_true else None

        if test_type == 'or':
            conditions = test.get('conditions', [])
            all_false = True
            for cond in conditions:
                result = self._try_evaluate_if_test_constant(cond, var_expressions)
                if result is True:
                    return True  # Short-circuit: any True means or is True
                if result is None:
                    all_false = False  # Can't determine this condition
            return False if all_false else None

        if test_type == 'not':
            inner = self._try_evaluate_if_test_constant(test.get('condition', {}), var_expressions)
            if inner is None:
                return None
            return not inner

        if test_type == 'compare':
            left = self._try_eval_constant(test.get('left', {}), var_expressions)
            right = self._try_eval_constant(test.get('right', {}), var_expressions)
            op = test.get('op', '')
            if left is None or right is None:
                return None
            try:
                if op == '==':
                    return left == right
                elif op == '!=':
                    return left != right
                elif op == '<':
                    return left < right
                elif op == '<=':
                    return left <= right
                elif op == '>':
                    return left > right
                elif op == '>=':
                    return left >= right
            except:
                pass
            return None

        # Types that depend on runtime state
        if test_type in ('item_check', 'state_method', 'count_check', 'group_check'):
            return None

        return None

    def _try_eval_constant(self, expr: Dict[str, Any], var_expressions: Dict[str, str]) -> Optional[Any]:
        """Try to evaluate an expression to a Python value at codegen time.

        Returns the evaluated value, or None if the expression contains runtime dependencies.
        This is used for compile-time evaluation of constant expressions like math.sqrt(x**2 + z**2).
        """
        if not isinstance(expr, dict):
            return expr

        expr_type = expr.get('type', '')

        if expr_type == 'constant':
            return expr.get('value')

        if expr_type == 'name':
            name = expr.get('name', '')
            if name in var_expressions:
                try:
                    return eval(var_expressions[name])
                except:
                    pass
            # Also check settings for name lookups (for setting names like 'swim_rule')
            if name in self.settings:
                return self.settings[name]
            return None

        if expr_type == 'binary_op':
            left = self._try_eval_constant(expr.get('left', {}), var_expressions)
            right = self._try_eval_constant(expr.get('right', {}), var_expressions)
            if left is None or right is None:
                return None
            op = expr.get('op', '')
            try:
                if op == '+':
                    return left + right
                elif op == '-':
                    return left - right
                elif op == '*':
                    return left * right
                elif op == '/':
                    return left / right
                elif op == '//':
                    return left // right
                elif op == '%':
                    return left % right
                elif op == '**':
                    return left ** right
            except:
                pass
            return None

        if expr_type == 'negate':
            operand = self._try_eval_constant(expr.get('operand', {}), var_expressions)
            if operand is not None:
                return -operand
            return None

        if expr_type == 'subscript':
            value = self._try_eval_constant(expr.get('value', {}), var_expressions)
            index = self._try_eval_constant(expr.get('index', {}), var_expressions)
            if value is not None and index is not None:
                try:
                    return value[index]
                except:
                    pass
            return None

        if expr_type == 'setting_value':
            setting_name = expr.get('setting', '')
            if setting_name in self.settings:
                return self.settings[setting_name]
            return 0

        # For item_check, state_method, etc. - these are runtime dependent
        return None

    def _expr_to_rule_builder(self, expr: Dict[str, Any], var_expressions: Dict[str, str]) -> Optional[str]:
        """Convert an AST expression to a Rule Builder expression string.

        Returns None if the expression cannot be converted.
        """
        if not isinstance(expr, dict):
            return repr(expr)

        expr_type = expr.get('type', '')

        if expr_type == 'constant':
            value = expr.get('value')
            return repr(value)

        if expr_type == 'name':
            name = expr.get('name', '')
            if name in var_expressions:
                return var_expressions[name]
            return None

        if expr_type == 'state_method':
            method = expr.get('method', '')
            args = expr.get('args', [])

            if method == 'count' and len(args) == 1:
                item_arg = args[0]
                if item_arg.get('type') == 'constant':
                    item_name = item_arg.get('value', '')
                    self.required_imports.add('CountItem')
                    return f'CountItem("{item_name}")'
            # Unsupported state_method
            return None

        if expr_type == 'binary_op':
            left = expr.get('left', {})
            op = expr.get('op', '')
            right = expr.get('right', {})

            left_expr = self._expr_to_rule_builder(left, var_expressions)
            right_expr = self._expr_to_rule_builder(right, var_expressions)

            if left_expr is None or right_expr is None:
                return None

            self.required_imports.add('Arithmetic')
            return f'Arithmetic({left_expr}, "{op}", {right_expr})'

        # Handle item_check - convert to Has()
        if expr_type == 'item_check':
            item = expr.get('item', '')
            count = expr.get('count')
            item_escaped = self._escape_string(item, '"')
            self.required_imports.add('Has')

            if count is not None:
                # Handle count which could be a dict (expression) or a value
                if isinstance(count, dict):
                    count_expr = self._expr_to_rule_builder(count, var_expressions)
                    if count_expr is None:
                        return None
                    return f'Has("{item_escaped}", {count_expr})'
                else:
                    return f'Has("{item_escaped}", {count})'
            else:
                return f'Has("{item_escaped}")'

        # Handle conditional - convert to Conditional()
        if expr_type == 'conditional':
            test = expr.get('test', {})
            if_true = expr.get('if_true', {})
            if_false = expr.get('if_false', {})

            test_expr = self._expr_to_rule_builder(test, var_expressions)
            true_expr = self._expr_to_rule_builder(if_true, var_expressions)
            false_expr = self._expr_to_rule_builder(if_false, var_expressions)

            if test_expr is None or true_expr is None or false_expr is None:
                return None

            self.required_imports.add('Conditional')
            return f'Conditional(test={test_expr}, if_true={true_expr}, if_false={false_expr})'

        # Handle max - convert to MaxValue()
        if expr_type == 'max':
            args = expr.get('args', [])
            if not args:
                return '0'

            arg_exprs = []
            for arg in args:
                arg_expr = self._expr_to_rule_builder(arg, var_expressions)
                if arg_expr is None:
                    return None
                arg_exprs.append(arg_expr)

            # Build nested MaxValue calls for multiple args
            self.required_imports.add('MaxValue')
            if len(arg_exprs) == 1:
                return arg_exprs[0]
            elif len(arg_exprs) == 2:
                return f'MaxValue({arg_exprs[0]}, {arg_exprs[1]})'
            else:
                # Nest MaxValue calls: MaxValue(MaxValue(a, b), c)
                result = f'MaxValue({arg_exprs[0]}, {arg_exprs[1]})'
                for i in range(2, len(arg_exprs)):
                    result = f'MaxValue({result}, {arg_exprs[i]})'
                return result

        # Handle compare - convert to Compare()
        if expr_type == 'compare':
            left = expr.get('left', {})
            op = expr.get('op', '')
            right = expr.get('right', {})

            left_expr = self._expr_to_rule_builder(left, var_expressions)
            right_expr = self._expr_to_rule_builder(right, var_expressions)

            if left_expr is None or right_expr is None:
                return None

            self.required_imports.add('Compare')
            return f'Compare({left_expr}, "{op}", {right_expr})'

        # Handle and - convert to And() or & operator
        if expr_type == 'and':
            conditions = expr.get('conditions', [])
            if not conditions:
                self.required_imports.add('True_')
                return 'True_()'

            cond_exprs = []
            for cond in conditions:
                cond_expr = self._expr_to_rule_builder(cond, var_expressions)
                if cond_expr is None:
                    return None
                # Short-circuit on False (False & X = False)
                if cond_expr == 'False' or cond_expr == 'False_()':
                    self.required_imports.add('False_')
                    return 'False_()'
                # Skip True conditions (True & X = X)
                if cond_expr == 'True' or cond_expr == 'True_()':
                    continue
                cond_exprs.append(cond_expr)

            if not cond_exprs:
                # All conditions were True
                self.required_imports.add('True_')
                return 'True_()'

            if len(cond_exprs) == 1:
                return cond_exprs[0]

            # Use & operator for combining
            return ' & '.join(f'({c})' for c in cond_exprs)

        # Handle or - convert to Or() or | operator
        if expr_type == 'or':
            conditions = expr.get('conditions', [])
            if not conditions:
                self.required_imports.add('False_')
                return 'False_()'

            cond_exprs = []
            for cond in conditions:
                cond_expr = self._expr_to_rule_builder(cond, var_expressions)
                if cond_expr is None:
                    return None
                # Short-circuit on True (True | X = True)
                if cond_expr == 'True' or cond_expr == 'True_()':
                    self.required_imports.add('True_')
                    return 'True_()'
                # Skip False conditions (False | X = X)
                if cond_expr == 'False' or cond_expr == 'False_()':
                    continue
                cond_exprs.append(cond_expr)

            if not cond_exprs:
                # All conditions were False
                self.required_imports.add('False_')
                return 'False_()'

            if len(cond_exprs) == 1:
                return cond_exprs[0]

            # Use | operator for combining
            return ' | '.join(f'({c})' for c in cond_exprs)

        # Handle not - convert to Not()
        if expr_type == 'not':
            condition = expr.get('condition', {})
            cond_expr = self._expr_to_rule_builder(condition, var_expressions)
            if cond_expr is None:
                return None

            # Simplify Not(True) → False and Not(False) → True
            if cond_expr == 'True' or cond_expr == 'True_()':
                self.required_imports.add('False_')
                return 'False_()'
            if cond_expr == 'False' or cond_expr == 'False_()':
                self.required_imports.add('True_')
                return 'True_()'

            self.required_imports.add('Not')
            return f'Not({cond_expr})'

        # Handle negate - convert to negative number
        if expr_type == 'negate':
            operand = expr.get('operand', {})
            operand_expr = self._expr_to_rule_builder(operand, var_expressions)
            if operand_expr is None:
                return None

            # If operand is a simple number, just negate it
            try:
                val = float(operand_expr)
                return repr(-val)
            except (ValueError, TypeError):
                # Need to use arithmetic
                self.required_imports.add('Arithmetic')
                return f'Arithmetic(0, "-", {operand_expr})'

        # Handle block - evaluate statements and return result
        if expr_type == 'block':
            statements = expr.get('statements', [])
            # Process the block recursively, passing current scope for variable access
            # Mark as nested so we don't accumulate conditions (only make sense at top level)
            return self._generate_runtime_ast_block(statements, var_expressions.copy(), is_nested=True)

        # Handle function_call - specifically for dict.get() and math.sqrt patterns
        if expr_type == 'function_call':
            function = expr.get('function', {})
            args = expr.get('args', [])

            # Check for attribute access pattern like constant_dict.get(key, default)
            if function.get('type') == 'attribute':
                attr = function.get('attr', '')
                obj = function.get('object', {})

                if attr == 'get' and obj.get('type') == 'constant' and len(args) >= 1:
                    constant_dict = obj.get('value', {})
                    # Get the key
                    key_arg = args[0]
                    if key_arg.get('type') == 'constant':
                        key = key_arg.get('value')
                        # Get the default value (if provided)
                        default = None
                        if len(args) >= 2 and args[1].get('type') == 'constant':
                            default = args[1].get('value')
                        # Lookup the value
                        if isinstance(constant_dict, dict):
                            result = constant_dict.get(key, default)
                            return repr(result)

                # Handle math.sqrt pattern
                if attr == 'sqrt' and obj.get('type') == 'name' and obj.get('name') == 'math' and len(args) == 1:
                    # Try to evaluate the argument as a constant
                    val = self._try_eval_constant(args[0], var_expressions)
                    if val is not None:
                        import math
                        result = math.sqrt(val)
                        return repr(result)
            return None

        # Handle subscript - dict/array element access
        if expr_type == 'subscript':
            value = expr.get('value', {})
            index = expr.get('index', {})

            # First try to evaluate both as constants
            val = self._try_eval_constant(value, var_expressions)
            idx = self._try_eval_constant(index, var_expressions)

            if val is not None and idx is not None:
                try:
                    if isinstance(val, (dict, list)):
                        result = val[idx]
                        return repr(result)
                except:
                    pass

            # If constant evaluation failed, try to convert to Rule Builder expressions
            value_expr = self._expr_to_rule_builder(value, var_expressions)
            index_expr = self._expr_to_rule_builder(index, var_expressions)

            if value_expr is None or index_expr is None:
                return None

            # Try to evaluate if both produce evaluable strings
            try:
                val = eval(value_expr)
                idx = eval(index_expr)
                if isinstance(val, (dict, list)):
                    result = val[idx]
                    return repr(result)
            except:
                pass

            # Can't evaluate, return as expression
            return f'{value_expr}[{index_expr}]'

        # Handle setting_value - lookup game option values
        if expr_type == 'setting_value':
            setting_name = expr.get('setting', '')
            if setting_name in self.settings:
                return repr(self.settings[setting_name])
            # Default to 0 if setting not found
            return '0'

        # Handle helper - helper function calls
        if expr_type == 'helper':
            name = expr.get('name', '')
            args = expr.get('args', [])

            # First try to evaluate the helper with constant args
            arg_vals = []
            all_constants = True
            for arg in args:
                val = self._try_eval_constant(arg, var_expressions)
                if val is not None:
                    arg_vals.append(val)
                else:
                    all_constants = False
                    break

            # Try to evaluate if this is a known helper with all constant args
            # For is_radiated helper with coordinates
            if all_constants and name == 'is_radiated' and len(arg_vals) == 3:
                try:
                    x = float(arg_vals[0])
                    y = float(arg_vals[1])
                    z = float(arg_vals[2])
                    # Calculate is_radiated: aurora_dist < 950
                    import math
                    aurora_dist = math.sqrt((x - 1038.0) ** 2 + y ** 2 + (z - -163.1) ** 2)
                    return repr(aurora_dist < 950)
                except:
                    pass

            # For other helpers or non-constant args, generate a HelperCall
            arg_exprs = []
            for arg in args:
                arg_expr = self._expr_to_rule_builder(arg, var_expressions)
                if arg_expr is None:
                    return None
                arg_exprs.append(arg_expr)

            self.required_imports.add('HelperCall')
            helper_func_name = self.get_function_name(name)
            args_str = ', '.join(arg_exprs)
            return f'HelperCall("{helper_func_name}", [{args_str}])'

        # Unsupported expression type
        return None

    def _convert_ast_all_of(self, rule: Dict[str, Any]) -> str:
        """Convert an AST_all_of rule to Python Rule Builder expression.

        AST_all_of represents Python's all(...) comprehension expressions like:
            all(state.has(technology.name, player) for technology in required_technologies[ingredient])

        The exported format includes:
        - element_rule: The rule to apply to each element (e.g., item_check)
        - iterator_info: Details about what to iterate over
          - iterator: A subscript with a constant dict and index
          - target: The variable name used in the comprehension

        For Factorio, this is used to check that the player has all required
        technologies for a given ingredient.
        """
        args = rule.get('args', {})
        element_rule = args.get('element_rule', {})
        iterator_info = args.get('iterator_info', {})

        # Get the iterator which should be a subscript into a constant dict
        iterator = iterator_info.get('iterator', {})

        if iterator.get('type') == 'subscript':
            value_dict = iterator.get('value', {})
            index_node = iterator.get('index', {})

            # Check if value is a constant dict (the required_technologies mapping)
            if value_dict.get('type') == 'constant' and isinstance(value_dict.get('value'), dict):
                tech_dict = value_dict.get('value')

                # Get the index (ingredient name)
                if index_node.get('type') == 'constant':
                    ingredient = index_node.get('value', '')

                    # Look up the required technologies for this ingredient
                    required_techs = tech_dict.get(ingredient, [])

                    if not required_techs:
                        # No technologies required - always accessible
                        self.required_imports.add('True_')
                        return 'True_()'

                    # Generate HasAll check for required technologies
                    if len(required_techs) == 1:
                        tech = required_techs[0]
                        tech_escaped = self._escape_string(tech, "'")
                        self.required_imports.add('Has')
                        return f"Has('{tech_escaped}')"
                    else:
                        # Multiple technologies - use And with Has for each
                        has_checks = []
                        for tech in required_techs:
                            tech_escaped = self._escape_string(tech, "'")
                            has_checks.append(f"Has('{tech_escaped}')")
                        self.required_imports.add('Has')
                        self.required_imports.add('And')
                        return f'And({", ".join(has_checks)})'

        # Handle constant iterator type (a direct list of items to check)
        # This occurs when the comprehension iterates over a static list like:
        #   all(state.has(tech.name, player) for tech in ["tech1", "tech2", ...])
        elif iterator.get('type') == 'constant' and isinstance(iterator.get('value'), list):
            required_items = iterator.get('value', [])

            if not required_items:
                # Empty list - all() of nothing is True
                self.required_imports.add('True_')
                return 'True_()'

            # Generate HasAll check for required items
            if len(required_items) == 1:
                item = required_items[0]
                item_escaped = self._escape_string(str(item), "'")
                self.required_imports.add('Has')
                return f"Has('{item_escaped}')"
            else:
                # Multiple items - use And with Has for each
                has_checks = []
                for item in required_items:
                    item_escaped = self._escape_string(str(item), "'")
                    has_checks.append(f"Has('{item_escaped}')")
                self.required_imports.add('Has')
                self.required_imports.add('And')
                return f'And({", ".join(has_checks)})'

        # Couldn't resolve statically - fall back to True_()
        # This shouldn't happen for properly exported Factorio rules
        self.required_imports.add('True_')
        return 'True_()'

    def _convert_ast_any_of(self, rule: Dict[str, Any]) -> str:
        """Convert an AST_any_of rule to Python Rule Builder expression.

        AST_any_of represents Python's any(...) comprehension expressions.
        Similar to AST_all_of but uses Or instead of And.
        """
        args = rule.get('args', {})
        iterator_info = args.get('iterator_info', {})

        # Get the iterator which should be a subscript into a constant dict
        iterator = iterator_info.get('iterator', {})

        if iterator.get('type') == 'subscript':
            value_dict = iterator.get('value', {})
            index_node = iterator.get('index', {})

            # Check if value is a constant dict
            if value_dict.get('type') == 'constant' and isinstance(value_dict.get('value'), dict):
                item_dict = value_dict.get('value')

                # Get the index (key name)
                if index_node.get('type') == 'constant':
                    key = index_node.get('value', '')

                    # Look up the items for this key
                    items = item_dict.get(key, [])

                    if not items:
                        # No items - always false for any()
                        self.required_imports.add('False_')
                        return 'False_()'

                    # Generate Or check for items
                    if len(items) == 1:
                        item = items[0]
                        item_escaped = self._escape_string(item, "'")
                        self.required_imports.add('Has')
                        return f"Has('{item_escaped}')"
                    else:
                        # Multiple items - use Or with Has for each
                        has_checks = []
                        for item in items:
                            item_escaped = self._escape_string(item, "'")
                            has_checks.append(f"Has('{item_escaped}')")
                        self.required_imports.add('Has')
                        self.required_imports.add('Or')
                        return f'Or({", ".join(has_checks)})'

        # Handle constant iterator type (a direct list of items to check)
        # This occurs when the comprehension iterates over a static list like:
        #   any(state.has(item.name, player) for item in ["item1", "item2", ...])
        elif iterator.get('type') == 'constant' and isinstance(iterator.get('value'), list):
            items = iterator.get('value', [])

            if not items:
                # Empty list - any() of nothing is False
                self.required_imports.add('False_')
                return 'False_()'

            # Generate Or check for items
            if len(items) == 1:
                item = items[0]
                item_escaped = self._escape_string(str(item), "'")
                self.required_imports.add('Has')
                return f"Has('{item_escaped}')"
            else:
                # Multiple items - use Or with Has for each
                has_checks = []
                for item in items:
                    item_escaped = self._escape_string(str(item), "'")
                    has_checks.append(f"Has('{item_escaped}')")
                self.required_imports.add('Has')
                self.required_imports.add('Or')
                return f'Or({", ".join(has_checks)})'

        # Couldn't resolve statically - fall back to False_()
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

        item_escaped = self._escape_string(item_name)

        if count == 1:
            return f'Has("{item_escaped}")'
        else:
            return f'Has("{item_escaped}", {count})'

    def _extract_prog_items_item_name(self, expr: Any) -> Optional[str]:
        """
        Extract the item name from a prog_items subscript expression.

        Pattern: state.prog_items[player][item_name]
        Also handles AST export format: {"type": "prog_item_count", "key": " coins"}
        Returns the item_name string if the pattern matches, None otherwise.
        """
        if not isinstance(expr, dict):
            return None

        # Handle AST export format: {"type": "prog_item_count", "key": " coins"}
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
                elif isinstance(arg, dict) and arg.get('rule') == 'Constant':
                    # Rule Builder format constant
                    arg_strs.append(repr(arg.get('args', {}).get('value')))
                elif isinstance(arg, dict) and arg.get('type') == 'setting_value':
                    # Resolve setting_value args to their actual values
                    setting = arg.get('setting', '')
                    if setting in self.settings:
                        arg_strs.append(repr(self.settings[setting]))
                    else:
                        arg_strs.append('None')
                elif isinstance(arg, dict) and arg.get('rule') == 'AST_setting_value':
                    # Rule Builder format setting value (from CC converter)
                    setting = arg.get('args', {}).get('setting', '')
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
        # Returning True makes locations more accessible, which is appropriate for worldgen
        # since unknown helpers are typically progression checks that evaluate to true
        # under default/normal game settings
        self.required_imports.add('True_')
        return 'True_()'

    def _convert_weighted_sum(self, rule: Dict[str, Any]) -> str:
        """Convert weighted_sum helper to WeightedSum rule.

        weighted_sum checks if the sum of (item_count * weight) for a list of items
        meets or exceeds a threshold. Used by Overcooked 2 for star-based progression.

        Format expected:
        {
            "rule": "weighted_sum",
            "_original_ast_type": "helper",
            "args": [
                {"rule": "Constant", "args": {"value": 1.0}},  # threshold
                {"rule": "Constant", "args": {"value": [["Item1", 0.4], ["Item2", 0.3], ...]}}  # items
            ]
        }
        """
        args = rule.get('args', [])

        # Extract threshold (first arg)
        threshold = 1.0
        if len(args) >= 1:
            arg0 = args[0]
            if isinstance(arg0, dict):
                if arg0.get('rule') == 'Constant':
                    threshold = arg0.get('args', {}).get('value', 1.0)
                elif arg0.get('type') == 'constant':
                    threshold = arg0.get('value', 1.0)

        # Extract items with weights (second arg)
        items = []
        if len(args) >= 2:
            arg1 = args[1]
            if isinstance(arg1, dict):
                if arg1.get('rule') == 'Constant':
                    raw_items = arg1.get('args', {}).get('value', [])
                elif arg1.get('type') == 'constant':
                    raw_items = arg1.get('value', [])
                else:
                    raw_items = []

                # Convert raw items to list of tuples
                if isinstance(raw_items, list):
                    for item in raw_items:
                        if isinstance(item, (list, tuple)) and len(item) >= 2:
                            items.append((item[0], item[1]))

        # Generate WeightedSum rule
        self.required_imports.add('WeightedSum')

        # Build the items list as Python code
        items_str = ', '.join(f'({repr(name)}, {weight})' for name, weight in items)

        return f'WeightedSum(threshold={threshold}, items=[{items_str}])'

    def _convert_rule_builder_helper(self, rule: Dict[str, Any], helper_name: str) -> str:
        """Convert Rule Builder format helper rule to HelperCall().

        This handles helpers that come from the exporter in Rule Builder format
        with a 'rule' key containing the helper name (e.g., {'rule': 'ultra', 'args': [], ...})
        instead of AST format with 'type': 'helper'.
        """
        args = rule.get('args', [])

        # If we know about this helper, generate a proper HelperCall
        if helper_name in self.known_helpers:
            self.required_imports.add('HelperCall')
            func_name = self.get_function_name(helper_name)

            # Convert arguments to Python code
            arg_strs = []
            for arg in args:
                if isinstance(arg, dict):
                    # Handle Rule Builder format args (SettingValue, Constant, etc.)
                    arg_rule = arg.get('rule', '')
                    if arg_rule == 'SettingValue':
                        # Resolve setting_value args to their actual values (legacy)
                        setting = arg.get('args', {}).get('setting', '')
                        if setting in self.settings:
                            arg_strs.append(repr(self.settings[setting]))
                        else:
                            arg_strs.append('None')
                    elif arg_rule == 'OptionValue':
                        # Resolve option_value args to their actual values
                        option = arg.get('args', {}).get('option', '')
                        if option in self.settings:
                            arg_strs.append(repr(self.settings[option]))
                        else:
                            arg_strs.append('None')
                    elif arg_rule == 'WorldAttribute':
                        # Resolve world_attribute args to their actual values
                        attribute = arg.get('args', {}).get('attribute', '')
                        if attribute in self.world_attributes:
                            arg_strs.append(repr(self.world_attributes[attribute]))
                        else:
                            arg_strs.append('None')
                    elif arg_rule == 'AST_setting_value':
                        # Rule Builder format setting value from CC converter
                        setting = arg.get('args', {}).get('setting', '')
                        if setting in self.settings:
                            arg_strs.append(repr(self.settings[setting]))
                        else:
                            arg_strs.append('None')
                    elif arg_rule == 'Constant':
                        # Handle Rule Builder format Constant: {'rule': 'Constant', 'args': {'value': ...}}
                        value = arg.get('args', {}).get('value')
                        arg_strs.append(repr(value))
                    elif arg.get('type') == 'constant':
                        # Handle AST format constant: {'type': 'constant', 'value': ...}
                        arg_strs.append(repr(arg.get('value')))
                    elif arg.get('type') == 'setting_value':
                        setting = arg.get('setting', '')
                        if setting in self.settings:
                            arg_strs.append(repr(self.settings[setting]))
                        else:
                            arg_strs.append('None')
                    elif arg.get('type') == 'option_value':
                        option = arg.get('option', '')
                        if option in self.settings:
                            arg_strs.append(repr(self.settings[option]))
                        else:
                            arg_strs.append('None')
                    elif arg.get('type') == 'world_attribute':
                        attribute = arg.get('attribute', '')
                        if attribute in self.world_attributes:
                            arg_strs.append(repr(self.world_attributes[attribute]))
                        else:
                            arg_strs.append('None')
                    elif arg_rule == 'False_':
                        # Handle Rule Builder format boolean False: {'rule': 'False_'}
                        arg_strs.append('False')
                    elif arg_rule == 'True_':
                        # Handle Rule Builder format boolean True: {'rule': 'True_'}
                        arg_strs.append('True')
                    elif arg.get('_original_ast_type') == 'helper' or arg_rule in self.known_helpers:
                        # Nested helper call - check if we know about it
                        nested_helper = arg_rule
                        if nested_helper in self.known_helpers:
                            # Check helper body - if it returns constant True/False, inline it
                            helper_body = self.helper_bodies.get(nested_helper, {})
                            if isinstance(helper_body, dict) and helper_body.get('type') == 'constant':
                                const_val = helper_body.get('value')
                                arg_strs.append(repr(const_val))
                            else:
                                # Complex helper - evaluate to True as approximation
                                # (Most SM canXXX/knowsXXX helpers are simplified to True)
                                arg_strs.append('True')
                        else:
                            # Unknown nested helper - assume True (optimistic approximation)
                            arg_strs.append('True')
                    else:
                        # For complex args, try to convert
                        arg_strs.append('None')
                else:
                    arg_strs.append(repr(arg))

            # Build HelperCall with helper_func reference
            parts = [f'helper_func={func_name}', f'helper_name="{helper_name}"']

            if arg_strs:
                parts.append(f'args=({", ".join(arg_strs)},)')

            return f'HelperCall({", ".join(parts)})'

        # Unknown helper - return True_() as placeholder
        # Returning True makes locations more accessible, which is appropriate for worldgen
        # since unknown helpers are typically progression checks that evaluate to true
        # under default/normal game settings
        # (This matches the behavior of _convert_helper for consistency)
        self.required_imports.add('True_')
        return 'True_()'

    def _convert_placement_lookup(self, rule: Dict[str, Any]) -> str:
        """Convert placement_lookup to a location_item_name() call.

        Placement lookups check what item is at a specific location.
        We generate a call to location_item_name(state, location, player) which
        preserves the original pattern and allows proper re-export.
        """
        location_rule = rule.get('location', {})

        # Get the location name expression
        if isinstance(location_rule, dict) and location_rule.get('type') == 'constant':
            location_name = location_rule.get('value', '')
            # Generate call to location_item_name for runtime lookup
            return f'location_item_name(state, {repr(location_name)}, player)'

        # For non-constant locations, generate the expression
        return 'None'

    def _convert_ast_function_call(self, rule: Dict[str, Any]) -> str:
        """Convert AST_function_call to resolved constant.

        This handles function calls like options.open_pyramid.to_bool()
        by extracting the option name and resolving it from settings.
        """
        args = rule.get('args', {})
        function = args.get('function', {})

        # Try to extract the option name from the function expression
        # Structure: world.worlds[1].options.<option_name>.to_bool()
        option_name = self._extract_option_name_from_function(function)

        if option_name:
            # Check if we have this setting
            if option_name in self.settings:
                value = self.settings[option_name]
                # Convert to boolean
                if isinstance(value, bool):
                    return self._make_bool_constant(value)
                elif isinstance(value, (int, float)):
                    return self._make_bool_constant(bool(value))
                elif isinstance(value, str):
                    # Common string values that mean "enabled"
                    return self._make_bool_constant(value.lower() in ('true', 'on', 'yes', '1'))
                else:
                    return self._make_bool_constant(False)

        # Unknown function call - default to True (accessible)
        # This is for things like boss.can_defeat() which should be True
        # if you can reach the location (progression will handle item requirements)
        return self._make_bool_constant(True)

    def _extract_option_name_from_function(self, function: Dict[str, Any]) -> Optional[str]:
        """Extract option name from a function call structure.

        Handles patterns like:
        - world.worlds[1].options.<option_name>.to_bool()
        - self.options.<option_name>.to_bool()
        - options.<option_name>
        """
        if not isinstance(function, dict):
            return None

        func_type = function.get('type', '')

        # Handle attribute access: obj.attr
        if func_type == 'attribute':
            obj = function.get('object', {})
            attr = function.get('attr', '')

            # If attr is 'to_bool', look at the object for the option name
            if attr == 'to_bool':
                return self._extract_option_name_from_function(obj)

            # If the object is 'options' or ends with '.options', the attr is the option name
            obj_name = self._get_attribute_chain_name(obj)
            if obj_name and (obj_name == 'options' or obj_name.endswith('.options')):
                return attr

            # Otherwise, keep traversing
            return attr

        return None

    def _get_attribute_chain_name(self, expr: Dict[str, Any]) -> Optional[str]:
        """Get the full attribute chain name from an expression."""
        if not isinstance(expr, dict):
            return None

        expr_type = expr.get('type', '')

        if expr_type == 'name':
            return expr.get('name', '')

        if expr_type == 'attribute':
            obj_name = self._get_attribute_chain_name(expr.get('object', {}))
            attr = expr.get('attr', '')
            if obj_name:
                return f"{obj_name}.{attr}"
            return attr

        if expr_type == 'subscript':
            # Skip subscripts like [1] - just return the value part
            return self._get_attribute_chain_name(expr.get('value', {}))

        return None

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


def ast_rule_to_python(rule: Optional[Dict[str, Any]]) -> Tuple[str, List[str]]:
    """
    Convert an AST format rule to Python Rule Builder expression.

    Args:
        rule: Rule dict in AST format

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
    # Check for type='constant' format (older format)
    if rule.get('type') == 'constant' and rule.get('value') is True:
        return True
    # Check for rule='True_' format (Rule Builder format)
    if rule.get('rule') == 'True_':
        return True
    return False


class HelperCodeGenerator:
    """
    Generates Python helper functions from AST format rule definitions.

    This class converts helper function bodies (which are rule definitions)
    into actual Python code that can be executed at runtime.

    Unlike RuleCodeGenerator (which generates Rule Builder expressions),
    this generates raw Python code with lambda-compatible expressions.
    """

    def __init__(
        self,
        game_name: str,
        resolved_values: Optional[Dict[str, Any]] = None,
        option_definitions: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        Initialize the helper code generator.

        Args:
            game_name: The game name (used for generating function names)
            resolved_values: Optional dict of resolved option/attribute values (for fallback)
            option_definitions: Optional dict defining which names are options (vs world attributes)
        """
        self.game_name = game_name
        self.settings = resolved_values or {}  # Values for fallback when dynamic access not possible
        self.option_definitions = option_definitions or {}  # To distinguish options from world attributes
        # Sanitize game name for use in Python identifiers
        import re
        self.game_name_lower = re.sub(r'[^a-zA-Z0-9]', '', game_name).lower()
        self.known_helpers: Set[str] = set()  # Track which helpers exist for validation
        self.helper_data: Dict[str, Any] = {}  # Full helper data including param_mappings
        self.uses_math: bool = False  # Track if math functions are used
        self.uses_placement_lookup: bool = False  # Track if placement_lookup is used
        self.placements: Dict[str, str] = {}  # location_name -> item_name
        # Track NamedTuple types encountered during code generation
        # Maps tuple of field names to a generated class name
        self.namedtuple_types: Dict[tuple, str] = {}
        # Maps original NamedTuple type name to the tuple of fields
        self.namedtuple_names: Dict[str, tuple] = {}
        # Context for current location/entrance being processed
        # Used to substitute 'location' or 'entrance' variable references
        self._current_location: Optional[str] = None
        self._current_entrance: Optional[str] = None

    def set_known_helpers(self, helper_names: Set[str]) -> None:
        """Set the list of known helper names for this game."""
        self.known_helpers = helper_names

    def set_helper_data(self, helper_data: Dict[str, Any]) -> None:
        """Set the full helper data including param_mappings.

        Args:
            helper_data: Dict mapping helper names to their data, including:
                - params: List of parameter names
                - param_mappings: Dict mapping param names to setting/attribute names
                - body: The helper body
                - defaults: Default parameter values
        """
        self.helper_data = helper_data or {}

    def set_placements(self, placements: Dict[str, str]) -> None:
        """Set the placement data for resolving placement_lookup rules."""
        self.placements = placements or {}

    def set_context(self, location: Optional[str] = None, entrance: Optional[str] = None) -> None:
        """Set the current context for variable substitution.

        When generating rules for a specific location or entrance, set the context
        so that references to 'location' or 'entrance' variables can be substituted
        with the appropriate state.multiworld.get_*() lookup.
        """
        self._current_location = location
        self._current_entrance = entrance

    def _get_namedtuple_class_name(self, fields: tuple) -> str:
        """
        Get or create a class name for a NamedTuple with the given fields.

        Returns a unique class name like '_AreaStats_nt' for this game.
        """
        if fields in self.namedtuple_types:
            return self.namedtuple_types[fields]

        # Generate a class name based on the number of NamedTuple types we've seen
        index = len(self.namedtuple_types)
        class_name = f"_{self.game_name_lower}_NTuple{index}"
        self.namedtuple_types[fields] = class_name
        return class_name

    def generate_namedtuple_classes(self) -> str:
        """
        Generate NamedTuple class definitions for all tracked NamedTuple types.

        Returns Python code defining all NamedTuple classes, to be placed
        at the top of the helper functions section.
        """
        if not self.namedtuple_types:
            return ""

        lines = ["from typing import NamedTuple, Any, List", ""]

        for fields, class_name in self.namedtuple_types.items():
            # Generate a simple NamedTuple class
            lines.append(f"class {class_name}(NamedTuple):")
            for field in fields:
                # Use Any type annotation since we don't know the actual types
                lines.append(f"    {field}: Any")
            lines.append("")

        return "\n".join(lines)

    def prescan_for_namedtuples(self, rule: Dict[str, Any]) -> None:
        """
        Pre-scan a rule tree to discover NamedTuple types.

        This should be called before generate code so that NamedTuple
        constructor calls can be properly resolved.
        """
        if not isinstance(rule, dict):
            return

        # Check if this is NamedTuple metadata
        if '_namedtuple_fields' in rule and '_namedtuple_values' in rule:
            fields = tuple(rule['_namedtuple_fields'])
            type_name = rule.get('_namedtuple_type', '')
            # Register the type
            self._get_namedtuple_class_name(fields)
            if type_name:
                self.namedtuple_names[type_name] = fields
            # Also scan the values for nested NamedTuples
            for v in rule['_namedtuple_values']:
                if isinstance(v, dict):
                    self.prescan_for_namedtuples(v)
            return

        # Recursively scan all dict values
        for key, value in rule.items():
            if isinstance(value, dict):
                self.prescan_for_namedtuples(value)
            elif isinstance(value, list):
                for item in value:
                    if isinstance(item, dict):
                        self.prescan_for_namedtuples(item)

    def get_function_name(self, helper_name: str) -> str:
        """
        Get the Python function name for a helper.

        Returns the helper name as-is, without any prefix. The helpers are
        defined in the world's Rules.py module, so they're already namespaced
        and don't need a game-specific prefix.
        """
        return helper_name

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
            # Handle variadic parameters (*args, **kwargs) - no default value allowed
            if param.startswith('*'):
                sig_params.append(param)
            elif param in defaults:
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
        elif stmt_type == 'tuple_assign':
            return self._generate_tuple_assign(stmt)
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

    def _generate_tuple_assign(self, stmt: Dict[str, Any]) -> str:
        """Generate Python tuple unpacking assignment statement (e.g., a, b = func())."""
        targets = stmt.get('targets', [])
        value = self._generate_expression(stmt.get('value', {'type': 'constant', 'value': None}))

        if not targets:
            return f"_ = {value}"

        target_str = ', '.join(targets)
        return f"{target_str} = {value}"

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
            elif isinstance(expr, list):
                # Convert lists to tuples for compatibility with location_item_name()
                # which returns tuples. Python requires matching types for == comparison.
                items = [self._generate_expression(e) for e in expr]
                if len(items) == 1:
                    return f"({items[0]},)"
                return f"({', '.join(items)})"
            return str(expr)

        expr_type = expr.get('type', '')

        # Dispatch based on expression type
        handlers = {
            'constant': self._expr_constant,
            'value': self._expr_constant,  # alias
            'name': self._expr_name,
            'param_ref': self._expr_name,  # alias for helper parameter references
            'variable': self._expr_name,  # alias
            'item_check': self._expr_item_check,
            'item_check_count': self._expr_item_check_count,  # for SM helpers
            'item_check_with_mapping': self._expr_item_check_with_mapping,  # for SM item name mapping
            'count_check': self._expr_count_check,
            'group_check': self._expr_group_check,
            'and': self._expr_and,
            'or': self._expr_or,
            'all_of': self._expr_all_of,  # alias for AND with conditions list
            'any_of': self._expr_any_of,  # alias for OR with conditions list
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
            'region_check': self._expr_can_reach,  # alias for can_reach
            'can_reach_entrance': self._expr_can_reach_entrance,
            'location_check': self._expr_location_check,
            'count_item': self._expr_count_item,
            'group_count': self._expr_group_count,
            'setting_value': self._expr_setting_value,  # Legacy
            'option_value': self._expr_option_value,
            'world_attribute': self._expr_world_attribute,
            'prog_item_count': self._expr_prog_item_count,
            'sum_of': self._expr_sum_of,
            'sum': self._expr_sum,
            'min': self._expr_min,
            'max': self._expr_max,
            'block': self._expr_block,
            'placement_lookup': self._expr_placement_lookup,
            'f_string': self._expr_f_string,
            'formatted_value': self._expr_formatted_value,
            'generator_expression': self._expr_generator_expression,
            'region_reference': self._expr_region_reference,
            'region_attribute': self._expr_region_attribute,
            'map': self._expr_map,
            'lambda': self._expr_lambda,
        }

        handler = handlers.get(expr_type)
        if handler:
            return handler(expr)

        # Handle 'rule' key format (Rule Builder format from exporter)
        rule_type = expr.get('rule', '')
        if rule_type:
            # Handle AST_region_check
            if rule_type == 'AST_region_check':
                args = expr.get('args', {})
                region = args.get('region', '')
                if isinstance(region, str):
                    return f'state.can_reach({repr(region)}, "Region", player)'
                elif isinstance(region, dict) and region.get('type') == 'constant':
                    region_name = region.get('value', '')
                    return f'state.can_reach({repr(region_name)}, "Region", player)'
                # Fallback for complex region expressions
                region_expr = self._generate_expression(region)
                return f'state.can_reach({region_expr}, "Region", player)'

            # Handle And/Or rules
            if rule_type in ('And', 'and'):
                children = expr.get('children', [])
                if not children:
                    return 'True'
                parts = [self._generate_expression(c) for c in children]
                return '(' + ' and '.join(f'({p})' for p in parts) + ')'

            if rule_type in ('Or', 'or'):
                children = expr.get('children', [])
                if not children:
                    return 'False'
                parts = [self._generate_expression(c) for c in children]
                return '(' + ' or '.join(f'({p})' for p in parts) + ')'

            # Handle Compare rules (Rule Builder format)
            if rule_type == 'Compare':
                args = expr.get('args', {})
                left = args.get('left')
                op = args.get('op', '==')
                right = args.get('right')
                # Always use _generate_expression to properly handle lists -> tuples
                left_expr = self._generate_expression(left)
                right_expr = self._generate_expression(right)
                return f'({left_expr} {op} {right_expr})'

            # Handle Constant rules (Rule Builder format)
            if rule_type == 'Constant':
                args = expr.get('args', {})
                value = args.get('value')
                if value is None:
                    return 'None'
                if isinstance(value, bool):
                    return 'True' if value else 'False'
                return repr(value)

            # Handle Has rules (Rule Builder format)
            if rule_type == 'Has':
                args = expr.get('args', {})
                item_name = args.get('item_name', '')
                count = args.get('count', 1)
                if count == 1:
                    return f"state.has({repr(item_name)}, player)"
                return f"state.has({repr(item_name)}, player, {count})"

            # Handle HasAll rules (Rule Builder format)
            if rule_type == 'HasAll':
                args = expr.get('args', {})
                items = args.get('items', [])
                # Use list literal to match original ALTTP style
                return f"state.has_all({items!r}, player)"

            # Handle HasAny rules (Rule Builder format)
            if rule_type == 'HasAny':
                args = expr.get('args', {})
                items = args.get('items', [])
                # Use list literal to match original ALTTP style
                return f"state.has_any({items!r}, player)"

            # Handle Not rules (Rule Builder format)
            if rule_type == 'Not':
                args = expr.get('args', {})
                condition = args.get('condition', {})
                condition_expr = self._generate_expression(condition)
                return f"not ({condition_expr})"

            # Handle True_/False_ rules
            if rule_type == 'True_':
                return 'True'
            if rule_type == 'False_':
                return 'False'

            # Handle OptionValue rules (Rule Builder format) - preserve as runtime check
            # This is critical for boss defeat rules that depend on game options like 'swordless'
            if rule_type == 'OptionValue':
                args = expr.get('args', {})
                option = args.get('option', '')
                return f'state.multiworld.worlds[player].options.{option}'

            # Handle SettingValue rules (Rule Builder format - legacy)
            if rule_type == 'SettingValue':
                args = expr.get('args', {})
                setting = args.get('setting', '')
                return self._expr_setting_value({'setting': setting})

            # Handle Tuple rules (Rule Builder format)
            if rule_type == 'Tuple':
                args = expr.get('args', {})
                # Support both 'value' (current format) and 'elements' (legacy)
                elements = args.get('value', args.get('elements', []))
                items = [self._generate_expression(e) for e in elements]
                if len(items) == 1:
                    return f"({items[0]},)"
                return f"({', '.join(items)})"

            # Handle List rules (Rule Builder format) - generate as tuple for
            # compatibility with location_item_name() which returns tuples
            if rule_type == 'List':
                args = expr.get('args', {})
                # Support both 'value' and 'elements' keys
                elements = args.get('value', args.get('elements', []))
                items = [self._generate_expression(e) for e in elements]
                if len(items) == 1:
                    return f"({items[0]},)"
                return f"({', '.join(items)})"

            # Handle Conditional rules (Rule Builder format)
            if rule_type == 'Conditional':
                args = expr.get('args', {})
                test = args.get('test')
                if_true = args.get('if_true')
                if_false = args.get('if_false')
                test_expr = self._generate_expression(test) if isinstance(test, dict) else repr(test)
                true_expr = self._generate_expression(if_true) if isinstance(if_true, dict) else repr(if_true)
                false_expr = self._generate_expression(if_false) if isinstance(if_false, dict) else repr(if_false)
                return f'(({true_expr}) if ({test_expr}) else ({false_expr}))'

            # Handle List rules (Rule Builder format for list comparisons)
            # Generate as tuple for compatibility with location_item_name()
            if rule_type == 'List':
                args = expr.get('args', {})
                value = args.get('value', [])
                elements = [self._generate_expression(v) if isinstance(v, dict) else repr(v) for v in value]
                if len(elements) == 1:
                    return f'({elements[0]},)'
                return f'({", ".join(elements)})'

            # Handle Python built-in functions that may have _original_ast_type marker
            # These should NOT be treated as helpers that take state/player args
            builtin_funcs = ('any', 'all', 'len', 'sum', 'min', 'max', 'sorted', 'list',
                           'set', 'tuple', 'iter', 'next', 'bool', 'int', 'str', 'float')
            if rule_type in builtin_funcs:
                args = expr.get('args', [])
                if args and isinstance(args, list):
                    arg_exprs = [self._generate_expression(a) for a in args]
                    return f'{rule_type}({", ".join(arg_exprs)})'
                return f'{rule_type}()'

            # Handle helper calls with _original_ast_type marker
            if expr.get('_original_ast_type') == 'helper' or rule_type in self.known_helpers:
                helper_name = rule_type
                func_name = self.get_function_name(helper_name)
                # Check for args - this can be a list of arguments to pass to the helper
                args = expr.get('args', [])
                if args and isinstance(args, list):
                    arg_exprs = [self._generate_expression(a) for a in args]
                    return f'{func_name}(state, player, {", ".join(arg_exprs)})'
                return f'{func_name}(state, player)'

            # Handle AST_placement_search (check if item is at any of listed locations)
            if rule_type == 'AST_placement_search':
                args = expr.get('args', {})
                item_name = args.get('item', '')
                locations = args.get('locations', [])
                # Build location pairs list for item_name_in_location_names
                self.uses_placement_lookup = True  # Also need this import
                loc_pairs = []
                for loc in locations:
                    if isinstance(loc, list) and loc:
                        loc_name = loc[0]
                        loc_player = loc[1] if len(loc) > 1 else 1
                        loc_pairs.append(f'({repr(loc_name)}, {loc_player})')
                    elif isinstance(loc, str):
                        loc_pairs.append(f'({repr(loc)}, player)')
                # Generate call to item_name_in_location_names for runtime lookup
                locs_str = f'[{", ".join(loc_pairs)}]'
                return f'item_name_in_location_names(state, {repr(item_name)}, player, {locs_str})'

            # Handle AST_setting_value (Rule Builder format for setting_value)
            if rule_type == 'AST_setting_value':
                args = expr.get('args', {})
                setting = args.get('setting', '')
                index = args.get('index')
                # Build a setting_value dict and use the existing handler
                setting_expr = {'setting': setting}
                if index is not None:
                    setting_expr['index'] = index
                return self._expr_setting_value(setting_expr)

            # Handle OptionValue (Rule Builder format for option_value)
            if rule_type == 'OptionValue':
                args = expr.get('args', {})
                option = args.get('option', '')
                index = args.get('index')
                # Build an option_value dict and use the existing handler
                option_expr = {'option': option}
                if index is not None:
                    option_expr['index'] = index
                return self._expr_option_value(option_expr)

            # Handle WorldAttribute (Rule Builder format for world_attribute)
            if rule_type == 'WorldAttribute':
                args = expr.get('args', {})
                attribute = args.get('attribute', '')
                index = args.get('index')
                # Build a world_attribute dict and use the existing handler
                attr_expr = {'attribute': attribute}
                if index is not None:
                    attr_expr['index'] = index
                return self._expr_world_attribute(attr_expr)

            # Handle AST_placement_lookup (Rule Builder format for placement_lookup)
            if rule_type == 'AST_placement_lookup':
                args = expr.get('args', {})
                location = args.get('location', '')
                # Generate call to location_item_name for runtime lookup
                self.uses_placement_lookup = True
                return f'location_item_name(state, {repr(location)}, player)'

            # Handle AST_function_call - try to simplify or preserve structure
            if rule_type == 'AST_function_call':
                # This represents complex function call patterns
                args = expr.get('args', {})
                function = args.get('function', {})
                # Try to generate the function call expression
                if isinstance(function, dict):
                    func_expr = self._generate_expression(function)
                    call_args = args.get('call_args', [])
                    arg_exprs = [self._generate_expression(a) for a in call_args]

                    # Special case: can_defeat() needs state as first argument
                    # The original ALTTP Boss.can_defeat(state) takes state as parameter
                    if func_expr.endswith('.can_defeat') and not arg_exprs:
                        arg_exprs = ['state']

                    # Special case: can_reach() on Region objects needs state as first argument
                    # Region.can_reach(state) takes state as parameter
                    if func_expr.endswith('.can_reach') and not arg_exprs:
                        arg_exprs = ['state']

                    # Special case: .to_bool() calls on options
                    # Original ALTTP code uses option.to_bool() but Archipelago options don't have this method.
                    # Convert to checking the option's truthiness by wrapping in bool().
                    if func_expr.endswith('.to_bool') and not arg_exprs:
                        # Remove '.to_bool' from the end and wrap in bool()
                        obj_expr = func_expr[:-8]  # len('.to_bool') == 8
                        return f'bool({obj_expr})'

                    return f'{func_expr}({", ".join(arg_exprs)})'
                return 'True'

            # Handle AST_capability (converts to helper function call)
            # Original: {"rule": "AST_capability", "args": {"capability": "defeat_enough_rbms", ...}}
            # Converts to: can_defeat_enough_rbms(state, player, ...)
            if rule_type == 'AST_capability':
                args = expr.get('args', {})
                capability = args.get('capability', '')
                if capability:
                    helper_name = f'can_{capability}'
                    func_name = self.get_function_name(helper_name)

                    # Get helper data including param_mappings
                    helper_info = self.helper_data.get(helper_name, {})
                    params = helper_info.get('params', [])
                    param_mappings = helper_info.get('param_mappings', {})

                    # Build argument list based on param_mappings
                    arg_exprs = []
                    for param in params:
                        if param in param_mappings:
                            setting_name = param_mappings[param]
                            # Check if it's an option or a world attribute
                            if setting_name in self.option_definitions:
                                # Option: access via state.multiworld.worlds[player].options.<name>.value
                                arg_exprs.append(f'state.multiworld.worlds[player].options.{setting_name}.value')
                            else:
                                # World attribute: access via state.multiworld.worlds[player].<name>
                                arg_exprs.append(f'state.multiworld.worlds[player].{setting_name}')
                        else:
                            # No mapping, use None as default
                            arg_exprs.append('None')

                    if arg_exprs:
                        return f'{func_name}(state, player, {", ".join(arg_exprs)})'
                    return f'{func_name}(state, player)'
                return 'True'

        # Unknown type - return True as placeholder
        # Returning True makes locations more accessible, which is appropriate for worldgen
        # since unknown types are typically progression checks that evaluate to true
        # under default/normal game settings
        return 'True'

    def _expr_setting_value(self, expr: Dict[str, Any]) -> str:
        """Generate code to access an option or world attribute at runtime.

        Instead of resolving to constants at generation time, generate code that
        accesses the value at runtime. This allows the exporter to recognize the
        pattern and convert it back to a setting_value rule.

        For options (defined in option_definitions):
            state.multiworld.worlds[player].options.<name>
        For world attributes (not in option_definitions):
            state.multiworld.worlds[player].<name>

        These patterns are recognized by the exporter's _is_world_options_pattern().
        """
        setting = expr.get('setting', '')

        # Check if this is an option or a world attribute
        is_option = setting in self.option_definitions

        # Build the base path
        if is_option:
            base_path = f'state.multiworld.worlds[player].options.{setting}'
        else:
            base_path = f'state.multiworld.worlds[player].{setting}'

        # Handle indexed access (e.g., required_medallions[0])
        if 'index' in expr:
            index = expr['index']
            if isinstance(index, int):
                return f'{base_path}[{index}]'
            elif isinstance(index, str):
                return f'{base_path}[{repr(index)}]'

        return base_path

    def _expr_option_value(self, expr: Dict[str, Any]) -> str:
        """Generate code to access an option or world attribute at runtime.

        If the name is a known option (in option_definitions), generates:
            state.multiworld.worlds[player].options.<name>

        Otherwise, treats it as a world attribute and generates:
            state.multiworld.worlds[player].<name>

        This handles cases where the exporter marks world attributes as option_value
        (e.g., pyramid_keys_unlock in Timespinner).
        """
        option = expr.get('option', '')

        # Check if this is actually a known option or a world attribute
        # Some games export world attributes with option_value type incorrectly
        if option in self.option_definitions:
            base_path = f'state.multiworld.worlds[player].options.{option}'
        else:
            # Not a known option - treat as world attribute
            base_path = f'state.multiworld.worlds[player].{option}'

        # Handle indexed access (not common for options, but supported)
        if 'index' in expr:
            index = expr['index']
            if isinstance(index, int):
                return f'{base_path}[{index}]'
            elif isinstance(index, str):
                return f'{base_path}[{repr(index)}]'

        return base_path

    def _expr_world_attribute(self, expr: Dict[str, Any]) -> str:
        """Generate code to access a world attribute at runtime.

        Always generates: state.multiworld.worlds[player].<name>
        This pattern is recognized by the exporter's pattern detection.
        """
        attribute = expr.get('attribute', '')
        base_path = f'state.multiworld.worlds[player].{attribute}'

        # Handle indexed access (e.g., required_medallions[0])
        if 'index' in expr:
            index = expr['index']
            if isinstance(index, int):
                return f'{base_path}[{index}]'
            elif isinstance(index, str):
                return f'{base_path}[{repr(index)}]'

        return base_path

    def _expr_placement_lookup(self, expr: Dict[str, Any]) -> str:
        """Generate code to look up what item is placed at a location.

        Generates a call to location_item_name(state, location, player) which is
        the standard Archipelago function for checking placements at runtime.
        This preserves the original code pattern and allows proper re-export.

        The return format is (item_name, player) tuple or None if not placed.
        """
        # Flag that we need to import location_item_name
        self.uses_placement_lookup = True

        location_rule = expr.get('location', {})

        # Generate the location name expression
        if isinstance(location_rule, dict):
            if location_rule.get('type') == 'constant':
                location_name = location_rule.get('value', '')
                location_expr = repr(location_name)
            else:
                location_expr = self._generate_expression(location_rule)
        elif isinstance(location_rule, str):
            location_expr = repr(location_rule)
        else:
            location_expr = repr(str(location_rule))

        # Generate call to location_item_name(state, location, player)
        # This is the standard Archipelago function from worlds.generic.Rules
        return f'location_item_name(state, {location_expr}, player)'

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
            # Check if list items are AST nodes (have 'type' key) - process as expressions
            items = []
            for v in value:
                if isinstance(v, dict) and 'type' in v:
                    items.append(self._generate_expression(v))
                else:
                    items.append(self._generate_expression({'type': 'constant', 'value': v}))
            return f"[{', '.join(items)}]"
        if isinstance(value, dict):
            # Check for NamedTuple metadata - this is a serialized NamedTuple
            if '_namedtuple_fields' in value and '_namedtuple_values' in value:
                fields = tuple(value['_namedtuple_fields'])
                values = value['_namedtuple_values']
                type_name = value.get('_namedtuple_type', '')
                # Get or create a class name for this NamedTuple type
                class_name = self._get_namedtuple_class_name(fields)
                # Register the original type name -> fields mapping for constructor calls
                if type_name:
                    self.namedtuple_names[type_name] = fields
                # Generate constructor call: ClassName(val1, val2, ...)
                val_reprs = []
                for v in values:
                    val_reprs.append(self._generate_expression({'type': 'constant', 'value': v}))
                return f"{class_name}({', '.join(val_reprs)})"

            # Handle dict constants - preserve string keys from JSON
            # JSON always uses string keys, and the worldgen data structures (from JSON)
            # also use string keys, so we keep them as strings for consistency.
            items = []
            for k, v in value.items():
                key_repr = repr(k)
                # Check if dict value is an AST node (has 'type' key) - process as expression
                if isinstance(v, dict) and 'type' in v:
                    val_repr = self._generate_expression(v)
                else:
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
        # Substitute 'location' with a lookup when we have context
        if name == 'location' and self._current_location:
            escaped = self._current_location.replace('\\', '\\\\').replace('"', '\\"')
            return f'state.multiworld.get_location("{escaped}", player)'
        # Substitute 'entrance' with a lookup when we have context
        if name == 'entrance' and self._current_entrance:
            escaped = self._current_entrance.replace('\\', '\\\\').replace('"', '\\"')
            return f'state.multiworld.get_entrance("{escaped}", player)'
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
                # Complex expression (e.g., helper call or attribute lookup)
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

    def _expr_all_of(self, expr: Dict[str, Any]) -> str:
        """Generate all() expression for AND of conditions.

        Handles two formats:
        1. Simple conditions list: {"type": "all_of", "conditions": [...]}
        2. Comprehension style: {"type": "all_of", "element_rule": {...}, "iterator_info": {...}}

        Used by SM helpers like wand() that need to AND variadic arguments,
        and by helpers that use all() comprehensions.
        """
        # Check for comprehension style (iterator_info present)
        iterator_info = expr.get('iterator_info')
        if iterator_info:
            target = iterator_info.get('target', {})
            iterator = iterator_info.get('iterator', {})
            condition = iterator_info.get('condition')
            element_rule = expr.get('element_rule', {'type': 'constant', 'value': True})

            # Generate target variable names
            target_expr = self._generate_expression(target)

            # Generate iterator expression
            iterator_expr = self._generate_expression(iterator)

            # Generate element rule expression
            element_expr = self._generate_expression(element_rule)

            # Generate condition expression if present
            if condition:
                condition_expr = self._generate_expression(condition)
                return f"all({element_expr} for {target_expr} in {iterator_expr} if {condition_expr})"

            return f"all({element_expr} for {target_expr} in {iterator_expr})"

        # Simple conditions list format
        conditions = expr.get('conditions', [])
        if not conditions:
            return 'True'
        if isinstance(conditions, dict):
            # conditions is a param_ref - use all() on the parameter
            param_name = conditions.get('name', 'args')
            return f'all({param_name})'
        if len(conditions) == 1:
            return self._generate_expression(conditions[0])
        parts = [f"({self._generate_expression(c)})" for c in conditions]
        return ' and '.join(parts)

    def _expr_any_of(self, expr: Dict[str, Any]) -> str:
        """Generate any() expression for OR of conditions.

        Handles two formats:
        1. Simple conditions list: {"type": "any_of", "conditions": [...]}
        2. Comprehension style: {"type": "any_of", "element_rule": {...}, "iterator_info": {...}}
        """
        # Check for comprehension style (iterator_info present)
        iterator_info = expr.get('iterator_info')
        if iterator_info:
            target = iterator_info.get('target', {})
            iterator = iterator_info.get('iterator', {})
            condition = iterator_info.get('condition')
            element_rule = expr.get('element_rule', {'type': 'constant', 'value': True})

            # Generate target variable names
            target_expr = self._generate_expression(target)

            # Generate iterator expression
            iterator_expr = self._generate_expression(iterator)

            # Generate element rule expression
            element_expr = self._generate_expression(element_rule)

            # Generate condition expression if present
            if condition:
                condition_expr = self._generate_expression(condition)
                return f"any({element_expr} for {target_expr} in {iterator_expr} if {condition_expr})"

            return f"any({element_expr} for {target_expr} in {iterator_expr})"

        # Simple conditions list format
        conditions = expr.get('conditions', [])
        if not conditions:
            return 'False'
        if isinstance(conditions, dict):
            # conditions is a param_ref - use any() on the parameter
            param_name = conditions.get('name', 'args')
            return f'any({param_name})'
        if len(conditions) == 1:
            return self._generate_expression(conditions[0])
        parts = [f"({self._generate_expression(c)})" for c in conditions]
        return ' or '.join(parts)

    def _expr_item_check_with_mapping(self, expr: Dict[str, Any]) -> str:
        """Generate state.has() call with item name mapping for SM.

        SM uses VARIA item names ('Morph', 'Super') which need to be
        mapped to Archipelago item names ('Morph Ball', 'Super Missile').
        """
        item_raw = expr.get('item', '')
        count = expr.get('count', 1)
        mapping = expr.get('item_name_mapping', {})

        # Handle item parameter reference
        if isinstance(item_raw, dict) and item_raw.get('type') == 'param_ref':
            param_name = item_raw.get('name', 'item')
            # Generate code that uses the mapping dict (dict stored as module-level constant)
            mapping_str = repr(mapping)
            return f'state.has({mapping_str}.get({param_name}, {param_name}), player)'

        # For constant items, resolve the mapping at generation time
        if isinstance(item_raw, dict) and item_raw.get('type') == 'constant':
            varia_name = item_raw.get('value', '')
            ap_name = mapping.get(varia_name, varia_name)
            return f'state.has({repr(ap_name)}, player)'

        # For string items, also resolve
        if isinstance(item_raw, str):
            ap_name = mapping.get(item_raw, item_raw)
            return f'state.has({repr(ap_name)}, player)'

        # Fallback
        return 'False'

    def _expr_item_check_count(self, expr: Dict[str, Any]) -> str:
        """Generate state.has() count check for SM helpers.

        Handles item count comparisons like 'has at least 3 Energy Tanks'.
        """
        item_raw = expr.get('item', '')
        count_raw = expr.get('count', 1)
        compare_op = expr.get('compare', '>=')

        # Handle item - could be constant or variable
        if isinstance(item_raw, dict):
            if item_raw.get('type') == 'param_ref':
                item = item_raw.get('name', '_item')
            elif item_raw.get('type') == 'constant':
                item = repr(item_raw.get('value', ''))
            else:
                item = self._generate_expression(item_raw)
        else:
            item = repr(item_raw) if isinstance(item_raw, str) else str(item_raw)

        # Handle count - could be constant or variable
        if isinstance(count_raw, dict):
            if count_raw.get('type') == 'param_ref':
                count = count_raw.get('name', '_count')
            elif count_raw.get('type') == 'constant':
                count = str(count_raw.get('value', 1))
            else:
                count = self._generate_expression(count_raw)
        else:
            count = str(count_raw)

        return f'state.has({item}, player, {count})'

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
        if name in ('any', 'all', 'len', 'sum', 'min', 'max', 'sorted', 'list', 'set', 'tuple', 'iter', 'next', 'bool', 'int', 'str', 'float'):
            arg_exprs = [self._generate_expression(a) for a in args]
            return f"{name}({', '.join(arg_exprs)})"

        # Math functions - require math import
        if name in ('sqrt', 'floor', 'ceil', 'pow', 'abs'):
            self.uses_math = True  # Flag that we need math import
            arg_exprs = [self._generate_expression(a) for a in args]
            if name == 'abs':
                return f"abs({', '.join(arg_exprs)})"
            return f"math.{name}({', '.join(arg_exprs)})"

        # total_received - count total received items from a list
        # Format: total_received(count, [item1, item2, ...])
        if name == 'total_received':
            if len(args) >= 2:
                count_expr = self._generate_expression(args[0])
                items_arg = args[1]
                # Handle list of items
                if isinstance(items_arg, dict) and items_arg.get('type') == 'constant':
                    items = items_arg.get('value', [])
                    if isinstance(items, list):
                        # Generate: sum(state.count(item, player) for item in [...]) >= count
                        items_repr = ', '.join(repr(item) for item in items)
                        return f"(sum(state.count(item, player) for item in [{items_repr}]) >= {count_expr})"
                # Fallback for non-constant lists
                items_expr = self._generate_expression(items_arg)
                return f"(sum(state.count(item, player) for item in {items_expr}) >= {count_expr})"
            # Not enough args - return False
            return 'False'

        # Check if this is a NamedTuple constructor call
        # If we've seen a NamedTuple with this type name, use the generated class
        if name in self.namedtuple_names:
            fields = self.namedtuple_names[name]
            class_name = self._get_namedtuple_class_name(fields)
            arg_exprs = [self._generate_expression(a) for a in args]
            return f"{class_name}({', '.join(arg_exprs)})"

        # Unknown helper - return True as placeholder
        # Returning True makes locations more accessible, which is appropriate for worldgen
        # since unknown helpers are typically progression checks that evaluate to true
        # under default/normal game settings
        return 'True'

    def _get_arg_expr(self, arg: Any, default: Any = None) -> str:
        """Get argument expression - handles both constants and variable references.

        For variable references (name type), returns the variable name.
        For constants, returns repr() of the value.
        For other expression types (binary_op, state_method, etc.), generates the expression.
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
            # Handle other expression types (binary_op, state_method, helper, etc.)
            if arg_type:
                return self._generate_expression(arg)
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
                # First try to get a constant value
                items = self._extract_constant(args[0], None)
                if items is not None:
                    # It's a constant list, use repr - use list to match original ALTTP style
                    items_repr = repr(list(items)) if items else '[]'
                else:
                    # It's a dynamic expression (parameter reference, helper call, etc.)
                    items_repr = self._generate_expression(args[0])
                return f'state.has_all({items_repr}, player)'

        elif method == 'has_any':
            if len(args) >= 1:
                # has_any expects a tuple/list of item names
                # First try to get a constant value
                items = self._extract_constant(args[0], None)
                if items is not None:
                    # It's a constant list, use repr - use list to match original ALTTP style
                    items_repr = repr(list(items)) if items else '[]'
                else:
                    # It's a dynamic expression (parameter reference, helper call, etc.)
                    items_repr = self._generate_expression(args[0])
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
        value_expr = expr.get('value', expr.get('object', {}))
        index_expr = expr.get('index', {})

        # Special case: world.worlds[N] pattern
        # In original ALTTP code, 'world' is the multiworld and world.worlds[N] accesses player N's world.
        # Convert to state.multiworld.worlds[player] (using player variable, not hardcoded index).
        if isinstance(value_expr, dict) and value_expr.get('type') == 'attribute':
            obj = value_expr.get('object', {})
            attr = value_expr.get('attr', '')
            if isinstance(obj, dict) and obj.get('type') == 'name' and obj.get('name') == 'world' and attr == 'worlds':
                # This is world.worlds[N] - convert to state.multiworld.worlds[player]
                return 'state.multiworld.worlds[player]'

        value = self._generate_expression(value_expr)
        index = self._generate_expression(index_expr)
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

        # Special case: when accessing world.xxx where xxx is a known world attribute
        # (e.g., world.era_required_non_progressive_items), inline the constant value.
        # This handles game-specific computed attributes that were exported in the rules.json
        # and are accessed by helper functions. Instead of trying to access via
        # state.multiworld.worlds[player] (which is a SimpleNamespace), we inline the data.
        if isinstance(obj_expr, dict) and obj_expr.get('type') == 'name' and obj_expr.get('name') == 'world':
            if attr in self.settings:
                value = self.settings[attr]
                # Use _expr_constant to convert the value to Python code
                return self._expr_constant({'type': 'constant', 'value': value})

        # Special case: when accessing world.xxx.yyy where xxx is a known world attribute
        # that contains a dict/object (e.g., world.difficulty_requirements.progressive_bottle_limit).
        # Instead of generating invalid code like {dict}.yyy, we look up the nested value directly.
        if isinstance(obj_expr, dict) and obj_expr.get('type') == 'attribute':
            inner_obj = obj_expr.get('object', {})
            inner_attr = obj_expr.get('attr', '')
            if isinstance(inner_obj, dict) and inner_obj.get('type') == 'name' and inner_obj.get('name') == 'world':
                if inner_attr in self.settings:
                    inner_value = self.settings[inner_attr]
                    if isinstance(inner_value, dict) and attr in inner_value:
                        # Access the nested attribute directly
                        nested_value = inner_value[attr]
                        return self._expr_constant({'type': 'constant', 'value': nested_value})

        # Special case: when accessing self.world.xxx where xxx is a known setting
        # (e.g., self.world.required_epitaph_pieces_name). In original world code,
        # 'self' refers to a rules class and self.world is the World instance.
        # Resolve these to literal values from settings, same as world.xxx.
        if isinstance(obj_expr, dict) and obj_expr.get('type') == 'attribute':
            inner_obj = obj_expr.get('object', {})
            inner_attr = obj_expr.get('attr', '')
            if (isinstance(inner_obj, dict) and inner_obj.get('type') == 'name' and
                    inner_obj.get('name') == 'self' and inner_attr == 'world'):
                if attr in self.settings:
                    value = self.settings[attr]
                    return self._expr_constant({'type': 'constant', 'value': value})

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

            # Special handling for calling .count() on a generator expression
            # Generator objects don't have .count(), need to wrap in tuple()
            if (isinstance(obj, dict) and obj.get('type') == 'generator_expression' and
                    func.get('attr') == 'count'):
                gen_code = self._generate_expression(obj)
                arg_exprs = [self._generate_expression(a) for a in args]
                return f"tuple({gen_code}).count({', '.join(arg_exprs)})"

        func_code = self._generate_expression(func)
        arg_exprs = [self._generate_expression(a) for a in args]

        # Special handling for state.multiworld.get_location - needs player argument
        # The exported helper body may be missing the player argument
        if func_code == 'state.multiworld.get_location' and len(arg_exprs) == 1:
            arg_exprs.append('player')

        # Special handling for state.multiworld.get_entrance - needs player argument
        # The exported helper body may be missing the player argument
        if func_code == 'state.multiworld.get_entrance' and len(arg_exprs) == 1:
            arg_exprs.append('player')

        # Special handling for .can_reach() method calls - needs state argument
        # Location and Region objects have can_reach(state) but exported code may call it without args
        if (isinstance(func, dict) and func.get('type') == 'attribute' and
                func.get('attr') == 'can_reach' and len(arg_exprs) == 0):
            arg_exprs.append('state')

        # Special handling for .to_bool() calls on options
        # Original ALTTP code uses option.to_bool() but Archipelago options don't have this method.
        # Convert to checking the option's truthiness by wrapping in bool().
        if (isinstance(func, dict) and func.get('type') == 'attribute' and
                func.get('attr') == 'to_bool' and len(arg_exprs) == 0):
            obj_code = self._generate_expression(func.get('object', {}))
            return f"bool({obj_code})"

        return f"{func_code}({', '.join(arg_exprs)})"

    def _expr_method_call(self, expr: Dict[str, Any]) -> str:
        """Generate method call expression."""
        obj = self._generate_expression(expr.get('object', {}))
        method = expr.get('method', '')
        args = expr.get('args', [])

        arg_exprs = [self._generate_expression(a) for a in args]

        return f"{obj}.{method}({', '.join(arg_exprs)})"

    def _expr_list(self, expr: Dict[str, Any]) -> str:
        """Generate tuple literal from list.

        We use tuples instead of lists because location_item_name() returns
        tuples, and Python's == comparison requires matching types.
        """
        values = expr.get('value', expr.get('elements', []))
        items = [self._generate_expression(v) for v in values]
        # Use tuple format to match location_item_name() return type
        if len(items) == 1:
            return f"({items[0]},)"
        return f"({', '.join(items)})"

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

    def _expr_region_reference(self, expr: Dict[str, Any]) -> str:
        """Generate code to get a region object reference.

        Used when rules reference a region object (e.g., for calling .can_reach() on it).
        Returns: state.multiworld.get_region('region_name', player)
        """
        region = expr.get('region', '')
        return f"state.multiworld.get_region({repr(region)}, player)"

    def _expr_region_attribute(self, expr: Dict[str, Any]) -> str:
        """Generate code to access an attribute on a region parameter.

        Used for rules that reference region properties like is_light_world, is_dark_world.

        AST format: {"type": "region_attribute", "region": {"type": "name", "name": "region"}, "attr": "is_light_world"}
        Returns: region.is_light_world
        """
        region_expr = expr.get('region', {})
        attr = expr.get('attr', '')

        # Generate the region expression (usually just 'region')
        region_code = self._generate_expression(region_expr)

        return f"{region_code}.{attr}"

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

        AST export format: {"type": "prog_item_count", "key": " coins"}
        This accesses state.prog_items[player][key] which counts accumulated items.
        """
        key = expr.get('key', '')
        key_escaped = self._escape_string(key, "'")
        return f"state.prog_items[player].get('{key_escaped}', 0)"

    def _expr_sum_of(self, expr: Dict[str, Any]) -> str:
        """Generate sum() expression from sum_of AST format.

        AST export format: {
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

    def _expr_sum(self, expr: Dict[str, Any]) -> str:
        """Generate sum() expression from sum format.

        This handles the simplified sum format used by exporter helpers:
        {
            "type": "sum",
            "iterable": {
                "type": "list",
                "value": [
                    {"type": "item_check", "item": "Valor Form"},
                    {"type": "item_check", "item": "Wisdom Form"},
                    ...
                ]
            }
        }

        Each element in the list is a boolean check (item_check, etc.) that
        evaluates to True/False. Python treats True as 1 and False as 0 in
        arithmetic, so sum([True, False, True]) = 2.
        """
        iterable = expr.get('iterable', {})

        # If it's a list, convert each element and sum them
        if iterable.get('type') == 'list':
            items = iterable.get('value', [])
            if not items:
                return '0'  # Empty sum is 0

            # Convert each item in the list
            item_exprs = [self._generate_expression(item) for item in items]

            # Build sum() call
            return f"sum([{', '.join(item_exprs)}])"

        # For other iterable types, try to generate expression
        iterable_expr = self._generate_expression(iterable)
        return f"sum({iterable_expr})"

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

            # Handle binary operations on constants (e.g., 'Axe' + 's' -> 'Axes')
            if value.get('type') in ('binary_op', 'binop'):
                left = self._extract_constant(value.get('left', {}), None)
                right = self._extract_constant(value.get('right', {}), None)
                op = value.get('op', '+')
                # Map operator names to actual operators
                op_map = {'Add': '+', 'Sub': '-', 'Mult': '*', 'Div': '/', 'FloorDiv': '//'}
                op = op_map.get(op, op)
                if left is not None and right is not None:
                    try:
                        if op == '+':
                            return left + right
                        elif op == '-':
                            return left - right
                        elif op == '*':
                            return left * right
                        elif op == '/':
                            return left / right
                        elif op == '//':
                            return left // right
                    except TypeError:
                        pass
                return default

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
                    # If the expression starts with '{', it's likely a dict literal
                    # which needs to be wrapped in parentheses to avoid confusing
                    # the f-string parser (e.g., {1: 'Grass Land'}[level] becomes
                    # ({1: 'Grass Land'})[level] to avoid being parsed as format spec)
                    if inner_expr.startswith('{'):
                        inner_expr = '(' + inner_expr + ')'
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

    def _expr_generator_expression(self, expr: Dict[str, Any]) -> str:
        """Generate a Python list comprehension.

        Note: The exporter treats both list comprehensions and generator expressions
        as 'generator_expression' type. We generate list comprehensions by default
        because they produce lists that support methods like .copy(), .append(), etc.
        Generator expressions produce iterators which don't support these operations.

        List comprehensions are used for things like:
        [x for x in iterable if condition]
        """
        element = self._generate_expression(expr.get('element', {}))
        comprehension = expr.get('comprehension', {})

        # Get the loop variable (target)
        target = comprehension.get('target', {})
        if isinstance(target, dict) and target.get('type') == 'name':
            target_name = target.get('name', '_')
        else:
            target_name = self._generate_expression(target)

        # Get the iterator
        iterator = self._generate_expression(comprehension.get('iterator', {}))

        # Build the list comprehension (use [] not () to produce a list)
        result = f"[{element} for {target_name} in {iterator}]"

        # Handle optional if condition
        condition = comprehension.get('condition')
        if condition:
            cond_expr = self._generate_expression(condition)
            result = f"[{element} for {target_name} in {iterator} if {cond_expr}]"

        return result

    def _expr_map(self, expr: Dict[str, Any]) -> str:
        """Generate a Python map() call.

        Structure: {"type": "map", "function": <lambda_expr>, "iterable": <expr>}

        This is used for expressions like:
            map(lambda x: weapons_to_name[x], reqs)

        Which maps elements of an iterable through a function.
        """
        function = expr.get('function', {})
        iterable = expr.get('iterable', {})

        func_expr = self._generate_expression(function)
        iter_expr = self._generate_expression(iterable)

        return f"map({func_expr}, {iter_expr})"

    def _expr_lambda(self, expr: Dict[str, Any]) -> str:
        """Generate a Python lambda expression.

        Structure: {"type": "lambda", "params": ["x", ...], "body": <expr>}

        This is used for expressions like:
            lambda x: weapons_to_name[x]
        """
        params = expr.get('params', [])
        body = expr.get('body', {})

        params_str = ', '.join(params)
        body_expr = self._generate_expression(body)

        return f"lambda {params_str}: {body_expr}"
