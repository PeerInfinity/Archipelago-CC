"""
Expression visitor mixin for AST visitors.

This module contains visitor methods for expression-level AST nodes
like attributes, names, constants, subscripts, and boolean operations.
"""

import ast
import logging
from typing import Any, Dict, Optional

from ..utils import is_simple_value


class ExpressionVisitorMixin:
    """
    Mixin containing visitor methods for expression nodes.

    Required attributes from parent class:
        - closure_vars: Dict of closure variables
        - game_handler: Game-specific handler
        - rule_func: The rule function being analyzed
        - expression_resolver: ExpressionResolver instance
        - seen_funcs: Dict of seen functions (recursion tracking)
        - player_context: Player number context
    """

    def visit_Attribute(self, node):
        try:
            attr_name = node.attr
            logging.debug(f"visit_Attribute: Trying to access .{attr_name} on object of type {type(node.value).__name__}")

            # Special handling for self.world.options.<setting>.value pattern
            # This resolves option values to constants at export time instead of runtime lookup
            # e.g., self.world.options.LuckyEmblemsRequired.value → 35
            if attr_name == 'value' and 'self' in self.closure_vars:
                self_obj = self.closure_vars['self']
                try:
                    # Collect full attribute chain to see if it matches self.world.options.X.value
                    chain = ['value']
                    current = node.value
                    while isinstance(current, ast.Attribute):
                        chain.insert(0, current.attr)
                        current = current.value
                    if isinstance(current, ast.Name) and current.id == 'self':
                        # We have self.X.Y.Z.value pattern
                        # Try to resolve the full chain via closure_vars
                        resolved = self_obj
                        for attr in chain:
                            resolved = getattr(resolved, attr, None)
                            if resolved is None:
                                break
                        if resolved is not None and isinstance(resolved, (int, float, str, bool)):
                            logging.debug(f"visit_Attribute: Resolved self.{'.' .join(chain)} to constant: {resolved}")
                            return {'type': 'constant', 'value': resolved}
                except (AttributeError, TypeError) as e:
                    logging.debug(f"visit_Attribute: Failed to resolve self.*.value pattern: {e}")
                    pass

            # Check for state.multiworld.worlds[player].options.<setting> pattern
            # Convert to setting_value rule type for frontend evaluation
            setting_name = self._is_world_options_pattern(node)
            if setting_name:
                logging.debug(f"visit_Attribute: Detected world options pattern, setting: {setting_name}")
                return {'type': 'setting_value', 'setting': setting_name}

            # Check for region parameter attribute access (e.g., region.is_light_world)
            # This handles helpers like is_not_bunny that take a region parameter
            param_name, region_attr = self._is_region_parameter_attribute(node)
            if param_name and region_attr:
                logging.debug(f"visit_Attribute: Detected region parameter attribute: {param_name}.{region_attr}")
                return {
                    'type': 'region_attribute',
                    'region': {'type': 'name', 'name': param_name},
                    'attr': region_attr
                }

            # Handle self.player - convert to player_id reference
            # This is used in class-based rule helpers like KH2's KH2Rules
            if isinstance(node.value, ast.Name) and node.value.id == 'self' and attr_name == 'player':
                logging.debug("visit_Attribute: Detected self.player, converting to player_id")
                return {'type': 'player_id'}

            # Handle self.<attr> patterns that map to settings
            # This is used for patterns like self.fight_logic which is set from world.options.FightLogic
            if isinstance(node.value, ast.Name) and node.value.id == 'self':
                # Check if the game handler has a mapping for this attribute to a setting
                if hasattr(self, 'game_handler') and self.game_handler is not None:
                    setting_mapping = getattr(self.game_handler, 'SELF_ATTR_TO_SETTING', {})
                    if attr_name in setting_mapping:
                        mapping_value = setting_mapping[attr_name]
                        # Handle both simple string format and dict format with use_current_key
                        if isinstance(mapping_value, dict):
                            setting_name = mapping_value.get('setting', attr_name)
                            use_current_key = mapping_value.get('use_current_key', False)
                        else:
                            setting_name = mapping_value
                            use_current_key = False
                        logging.debug(f"visit_Attribute: Detected self.{attr_name}, converting to setting_value '{setting_name}' (use_current_key={use_current_key})")
                        result = {'type': 'setting_value', 'setting': setting_name}
                        if use_current_key:
                            result['use_current_key'] = True
                        return result

            # OPTIMIZATION: If the object is a simple Name node in closure_vars, try to resolve
            # the attribute directly BEFORE visiting the object. This handles NamedTuples and
            # other complex objects that would lose their attribute access capability when serialized.
            if isinstance(node.value, ast.Name):
                var_name = node.value.id
                if var_name in self.closure_vars:
                    obj_value = self.closure_vars[var_name]
                    try:
                        resolved_attr = getattr(obj_value, attr_name)
                        # If the attribute resolves to a simple value, return it directly
                        if isinstance(resolved_attr, (int, float, str, bool)):
                            logging.debug(f"visit_Attribute: Direct resolution of {var_name}.{attr_name} to constant: {resolved_attr}")
                            return {'type': 'constant', 'value': resolved_attr}
                        elif resolved_attr is None:
                            logging.debug(f"visit_Attribute: Direct resolution of {var_name}.{attr_name} to None")
                            return {'type': 'constant', 'value': None}
                        elif isinstance(resolved_attr, (list, tuple)):
                            # Handle list/tuple values - convert to list for JSON serialization
                            # IMPORTANT: Only return as constant if all values are JSON-serializable
                            list_value = list(resolved_attr) if isinstance(resolved_attr, tuple) else resolved_attr
                            if is_simple_value(list_value):
                                logging.debug(f"visit_Attribute: Direct resolution of {var_name}.{attr_name} to list: {list_value}")
                                return {'type': 'constant', 'value': list_value}
                            else:
                                logging.debug(f"visit_Attribute: {var_name}.{attr_name} list contains non-serializable values, skipping constant conversion")
                        elif isinstance(resolved_attr, dict):
                            # Handle dict values - keep as dict for subscript access
                            # The frontend's subscript handler can index into plain objects
                            # For iteration (for_iter), the frontend will iterate over keys
                            # IMPORTANT: Only return as constant if all values are JSON-serializable
                            # Dicts like multiworld.worlds contain World objects that aren't serializable
                            if is_simple_value(resolved_attr):
                                logging.debug(f"visit_Attribute: Direct resolution of {var_name}.{attr_name} (dict) keeping as dict with {len(resolved_attr)} entries")
                                return {'type': 'constant', 'value': resolved_attr}
                            else:
                                logging.debug(f"visit_Attribute: {var_name}.{attr_name} dict contains non-serializable values, skipping constant conversion")
                        elif isinstance(resolved_attr, (set, frozenset)):
                            # Handle set/frozenset values - convert to list for JSON serialization
                            list_value = list(resolved_attr)
                            logging.debug(f"visit_Attribute: Direct resolution of {var_name}.{attr_name} (set) to list: {list_value}")
                            return {'type': 'constant', 'value': list_value}
                    except AttributeError:
                        # If attribute doesn't exist, fall through to normal processing
                        logging.debug(f"visit_Attribute: Could not directly resolve {var_name}.{attr_name}")
                        pass

            logging.debug(f"visit_Attribute: Visiting object {type(node.value).__name__}")

            # Special handling: if accessing an attribute on state.multiworld.worlds[player],
            # convert the object to just 'world' so the frontend can resolve it from game_info.
            # This handles patterns like state.multiworld.worlds[player].hat_yarn_costs
            # which the frontend expects as world.hat_yarn_costs
            if self._is_world_player_subscript(node.value):
                logging.debug(f"visit_Attribute: Detected state.multiworld.worlds[player].{attr_name}, converting to world.{attr_name}")
                obj_result = {'type': 'name', 'name': 'world'}
            else:
                obj_result = self.visit(node.value) # Get returned result

            if obj_result:
                 # Build the attribute access structure
                 attr_structure = {'type': 'attribute', 'object': obj_result, 'attr': attr_name}

                 # Don't resolve world attributes to constants - let the frontend resolve them
                 # from the exported world data. This ensures consistent output regardless of
                 # whether world is available during analysis (which can vary based on order).
                 # Check for both direct (world.attr) and nested (world.x.y) attribute chains.
                 if self._is_world_attribute_chain(obj_result):
                     logging.debug(f"visit_Attribute: Preserving world attribute chain .{attr_name} as reference (not resolving to constant)")
                     return attr_structure

                 # Try to resolve the attribute access to a constant value
                 resolved_value = self.expression_resolver.resolve_expression(attr_structure)

                 # If resolved to a simple value, return it as a constant
                 if resolved_value is not None and isinstance(resolved_value, (int, float, str, bool)):
                     logging.debug(f"visit_Attribute: Resolved {attr_name} to constant value: {resolved_value}")
                     return {'type': 'constant', 'value': resolved_value}

                 # Otherwise return the attribute access structure
                 logging.debug(f"visit_Attribute: Returning attribute structure {attr_structure}")
                 return attr_structure
            else:
                 # Handle case where object visit failed
                 logging.error(f"visit_Attribute: Failed to get result for object in {ast.dump(node)}")
                 return None # Return None on error

        except Exception as e:
            logging.error(f"Error in visit_Attribute for {ast.dump(node)}: {e}")
            return None

    def visit_Name(self, node):
        try:
            name = node.id
            logging.debug(f"visit_Name: Name = {name}")
            # Specifically log 'self'
            if name == 'self':
                logging.debug("visit_Name: Detected 'self'")

            # Check if this name is in closure vars and should be resolved to a constant
            if name in self.closure_vars:
                value = self.closure_vars[name]
                # Handle None values
                if value is None:
                    logging.debug(f"visit_Name: Resolved '{name}' from closure to None")
                    return {'type': 'constant', 'value': None}
                # Handle rule dicts (helper, item_check, state_method, etc.)
                # These come from parameter mapping when arguments are analyzed rules
                elif isinstance(value, dict) and value.get('type') in (
                    'helper', 'item_check', 'state_method', 'can_reach', 'location_check',
                    'and', 'or', 'not', 'conditional', 'compare', 'has_all', 'has_any',
                    'constant', 'name', 'attribute', 'subscript', 'setting_value'
                ):
                    logging.debug(f"visit_Name: Resolved '{name}' from closure to rule dict of type '{value.get('type')}'")
                    return value  # Return the rule dict directly
                # Handle simple values (numbers, strings, bools)
                elif isinstance(value, (int, float, str, bool)):
                    logging.debug(f"visit_Name: Resolved '{name}' from closure to constant value: {value}")
                    return {'type': 'constant', 'value': value}
                # Handle NamedTuples - keep them as name references so attribute access still works
                # The attributes will be resolved later in visit_Attribute
                # IMPORTANT: This check MUST come BEFORE the tuple check since NamedTuples are tuples
                elif hasattr(value, '_fields'):
                    logging.debug(f"visit_Name: Found NamedTuple '{name}' in closure, keeping as name reference for attribute access")
                    # Don't convert to list here - let attribute access resolve the fields
                    pass
                # Handle list/tuple values - resolve to constant for method calls like .index()
                elif isinstance(value, (list, tuple)):
                    # Convert to list for JSON serialization
                    list_value = list(value) if isinstance(value, tuple) else value
                    logging.debug(f"visit_Name: Resolved '{name}' from closure to constant list: {list_value}")
                    return {'type': 'constant', 'value': list_value}
                # Handle dict values - resolve to constant for subscript access and .items() iteration
                elif isinstance(value, dict):
                    # Convert dict to JSON-serializable format
                    # Keys must be strings for JSON, so convert int keys to strings
                    json_dict = {str(k) if isinstance(k, int) else k: v for k, v in value.items()}
                    logging.debug(f"visit_Name: Resolved '{name}' from closure to constant dict: {json_dict}")
                    return {'type': 'constant', 'value': json_dict}
                # Handle enum values by extracting their .value attribute
                elif hasattr(value, 'value') and isinstance(value.value, (int, float, str, bool)):
                    logging.debug(f"visit_Name: Resolved '{name}' from closure to enum constant value: {value.value}")
                    return {'type': 'constant', 'value': value.value}
                # Handle Region objects - DON'T convert to string yet
                # Keep them as name references so attribute access can still work
                # We specifically check for 'entrances' attribute which Region objects have
                # but Location objects don't, to avoid breaking Location.can_reach() patterns
                elif hasattr(value, 'name') and hasattr(value, 'entrances') and isinstance(value.name, str):
                    logging.debug(f"visit_Name: Found Region object '{name}' in closure, keeping as name reference for attribute access")
                    # Don't convert to string here - let attribute access or other operations handle it
                    pass
                # Handle Location objects - DON'T convert to 'location' keyword
                # Location objects have 'name' and 'parent_region' but NOT 'entrances'
                # Keep the original variable name so that downstream handlers (like can_reach)
                # can resolve the actual location object and extract its name.
                # For patterns like loc.can_reach(state), the can_reach handler will resolve
                # 'loc' from closure_vars to get the actual location name.
                # For patterns like location.parent_region.dungeon.boss where the variable
                # is literally named 'location', the original name is preserved.
                elif hasattr(value, 'name') and hasattr(value, 'parent_region') and not hasattr(value, 'entrances'):
                    logging.debug(f"visit_Name: Found Location object '{name}' in closure with location name '{value.name}', keeping as name reference")
                    # Don't convert to 'location' keyword - let can_reach handler resolve it
                    pass

            # Also check function defaults and module globals
            # When preserve_parameter_names is True, skip resolution for actual function parameters
            # but still resolve module-level constants (like WORLDS, KEYBLADES, LOGIC_MINIMAL)
            is_function_parameter = False
            if getattr(self, 'preserve_parameter_names', False) and self.rule_func and hasattr(self.rule_func, '__code__'):
                param_names = self.rule_func.__code__.co_varnames[:self.rule_func.__code__.co_argcount]
                is_function_parameter = name in param_names

            if name not in self.closure_vars and not is_function_parameter:
                resolved_value = self.expression_resolver.resolve_variable(name)
                if resolved_value is not None:
                    # Handle simple values
                    if isinstance(resolved_value, (int, float, str, bool)):
                        logging.debug(f"visit_Name: Resolved '{name}' from function defaults/globals to constant value: {resolved_value}")
                        return {'type': 'constant', 'value': resolved_value}
                    # Handle list/tuple values - resolve to constant for iteration and subscript
                    elif isinstance(resolved_value, (list, tuple)):
                        list_value = list(resolved_value) if isinstance(resolved_value, tuple) else resolved_value
                        logging.debug(f"visit_Name: Resolved '{name}' from globals to constant list: {list_value}")
                        return {'type': 'constant', 'value': list_value}
                    # Handle dict values - resolve to constant for subscript access and .items() iteration
                    elif isinstance(resolved_value, dict):
                        # Convert dict to JSON-serializable format
                        json_dict = {str(k) if isinstance(k, int) else k: v for k, v in resolved_value.items()}
                        logging.debug(f"visit_Name: Resolved '{name}' from globals to constant dict: {json_dict}")
                        return {'type': 'constant', 'value': json_dict}
                    # Handle enum values by extracting their .value attribute
                    elif hasattr(resolved_value, 'value') and isinstance(resolved_value.value, (int, float, str, bool)):
                        logging.debug(f"visit_Name: Resolved '{name}' from function defaults to enum constant value: {resolved_value.value}")
                        return {'type': 'constant', 'value': resolved_value.value}
                    # Handle Region objects - DON'T convert to string yet
                    # Check for 'entrances' to distinguish Region from Location objects
                    elif hasattr(resolved_value, 'name') and hasattr(resolved_value, 'entrances') and isinstance(resolved_value.name, str):
                        logging.debug(f"visit_Name: Found Region object '{name}' in function defaults, keeping as name reference for attribute access")
                        # Don't convert to string here - let attribute access or other operations handle it
                        pass
                    # Handle NamedTuples from function defaults - keep as name references for attribute access
                    elif hasattr(resolved_value, '_fields'):
                        logging.debug(f"visit_Name: Found NamedTuple '{name}' in function defaults, keeping as name reference for attribute access")
                        # Don't convert to list here - let attribute access resolve the fields
                        pass

            # Replace closure-captured location variable with 'location'
            # This handles patterns like: add_rule(ep_boss, lambda state: ... ep_boss.parent_region ...)
            # where the lambda captures the location variable from the enclosing scope
            # Detection: if we're analyzing a Location access rule, and the closure variable
            # is a Location object with the same name as the rule target, replace with 'location'
            if (hasattr(self, 'target_type') and self.target_type == 'Location' and
                hasattr(self, 'rule_target_name') and self.rule_target_name and
                name in self.closure_vars):
                closure_value = self.closure_vars.get(name)
                # Check if it's a Location object with matching name
                if (closure_value is not None and
                    hasattr(closure_value, 'name') and
                    getattr(closure_value, 'name', None) == self.rule_target_name):
                    logging.debug(f"visit_Name: Replaced closure-captured location variable '{name}' with 'location' (matched target '{self.rule_target_name}')")
                    name = 'location'

            # Use game handler to replace names if available
            if self.game_handler and hasattr(self.game_handler, 'replace_name'):
                original_name = name
                name = self.game_handler.replace_name(name)
                if name != original_name:
                    logging.debug(f"visit_Name: Game handler replaced '{original_name}' with '{name}'")

            result = {'type': 'name', 'name': name}
            logging.debug(f"visit_Name: Set result to {result}")
            return result # Return the result
        except Exception as e:
            logging.error(f"Error in visit_Name for {node.id}: {e}")
            return None # Return None on error

    def visit_Expr(self, node: ast.Expr):
        """ Handle expression statements, checking for top-level set_rule/add_item_rule calls. """
        logging.debug(f"\n--- visit_Expr --- Node Value Type: {type(node.value).__name__}")
        # Check if the expression's value is a call to set_rule or add_rule
        if isinstance(node.value, ast.Call):
            call_node = node.value
            func_name = None
            # Determine the function name being called
            if isinstance(call_node.func, ast.Name):
                func_name = call_node.func.id
            elif isinstance(call_node.func, ast.Attribute):
                func_name = call_node.func.attr

            # If it's a rule-setting function with at least 2 arguments...
            if func_name in ['set_rule', 'add_rule', 'add_item_rule'] and len(call_node.args) >= 2:
                logging.debug(f"visit_Expr: Detected top-level '{func_name}' call. Visiting rule argument directly.")
                # Visit the second argument (the rule function/lambda) and return its result
                rule_result = self.visit(call_node.args[1])

                logging.debug(f"visit_Expr: Finished visiting rule argument for '{func_name}'. Returning result: {rule_result}")
                return rule_result

        # If not a top-level rule-setting call, visit the expression value normally and return its result
        logging.debug("visit_Expr: Not a top-level rule call, visiting value.")
        return self.visit(node.value)

    def visit_Constant(self, node):
        logging.debug("\nvisit_Constant called")
        logging.debug(f"Constant node: {ast.dump(node)}")
        result = {
            'type': 'constant',
            'value': node.value
        }
        logging.debug(f"Constant result: {result}")
        return result # Return the result

    def visit_JoinedStr(self, node):
        """Handle f-string nodes (JoinedStr)"""
        logging.debug("\nvisit_JoinedStr called")
        logging.debug(f"JoinedStr node: {ast.dump(node)}")

        # Check if all parts are constants or simple names
        # If so, we might be able to construct the full string
        all_parts_simple = True
        parts = []

        for value in node.values:
            if isinstance(value, ast.Constant):
                parts.append({'type': 'constant', 'value': str(value.value)})
            elif isinstance(value, ast.FormattedValue):
                # Visit the formatted value to get its content
                formatted_result = self.visit(value)
                parts.append(formatted_result)
                if formatted_result.get('type') not in ['constant', 'name', 'formatted_value']:
                    all_parts_simple = False
            else:
                parts.append({'type': 'unknown'})
                all_parts_simple = False

        result = {
            'type': 'f_string',
            'parts': parts,
            'all_simple': all_parts_simple
        }

        # If all parts are simple, try to construct a placeholder string
        if all_parts_simple:
            value_parts = []
            for part in parts:
                if part.get('type') == 'constant':
                    value_parts.append(str(part.get('value', '')))
                elif part.get('type') == 'formatted_value':
                    inner = part.get('value', {})
                    if inner.get('type') == 'name':
                        # Keep the name as a placeholder for now
                        value_parts.append(f"{{{inner.get('name', '...')}}}")
                    elif inner.get('type') == 'constant':
                        value_parts.append(str(inner.get('value', '')))
                    else:
                        value_parts.append("{...}")
                else:
                    value_parts.append("{...}")
            result['value'] = ''.join(value_parts)

        logging.debug(f"JoinedStr result: {result}")
        return result

    def visit_FormattedValue(self, node):
        """Handle formatted value nodes within f-strings"""
        logging.debug("\nvisit_FormattedValue called")
        logging.debug(f"FormattedValue node: {ast.dump(node)}")

        # Visit the value expression to get its details
        value_result = self.visit(node.value) if node.value else None

        result = {
            'type': 'formatted_value',
            'value': value_result
        }
        logging.debug(f"FormattedValue result: {result}")
        return result

    def visit_Subscript(self, node):
        """
        Handle subscript expressions like foo[bar].
        Attempts to resolve the subscript if both value and index are resolvable.
        """
        logging.debug(f"\nvisit_Subscript called:")
        logging.debug(f"Value: {ast.dump(node.value)}")
        logging.debug(f"Slice: {ast.dump(node.slice)}")

        # Check for state.multiworld.worlds[player].<attr>[index] pattern
        # Convert to setting_value rule type for frontend evaluation
        attr_name, index_val = self._is_world_attribute_subscript_pattern(node)
        if attr_name is not None and index_val is not None:
            logging.debug(f"visit_Subscript: Detected world attribute subscript pattern: {attr_name}[{index_val}]")
            return {'type': 'setting_value', 'setting': attr_name, 'index': index_val}

        # Check for state.prog_items[player][key] pattern
        # Convert to prog_item_count rule type for frontend evaluation
        # This handles DLCQuest and other games that use accumulator items
        prog_items_key = self._is_prog_items_pattern(node)
        if prog_items_key is not None:
            logging.debug(f"visit_Subscript: Detected prog_items pattern: state.prog_items[player][{prog_items_key!r}]")
            return {'type': 'prog_item_count', 'key': prog_items_key}

        # OPTIMIZATION: Try direct resolution for attribute subscripts like world.dict[key]
        # This avoids the dict-to-keys conversion that happens in visit_Attribute
        # which would break subscript access (e.g., world.chapter_timepiece_costs[ChapterIndex.MAFIA])
        if isinstance(node.value, ast.Attribute) and isinstance(node.value.value, ast.Name):
            var_name = node.value.value.id
            attr_name = node.value.attr
            if var_name in self.closure_vars:
                try:
                    # Get the container directly from closure
                    obj_value = self.closure_vars[var_name]
                    container = getattr(obj_value, attr_name, None)
                    if container is not None and isinstance(container, dict):
                        # Try to resolve the index
                        index_result = self.visit(node.slice)
                        resolved_index = None
                        if index_result and index_result.get('type') == 'constant':
                            resolved_index = index_result['value']
                        elif index_result and index_result.get('type') == 'name':
                            resolved_index = self.expression_resolver.resolve_variable(index_result['name'])
                        elif index_result and index_result.get('type') == 'attribute':
                            resolved_index = self.expression_resolver.resolve_expression(index_result)

                        if resolved_index is not None:
                            try:
                                subscript_result = container[resolved_index]
                                logging.debug(f"visit_Subscript: Direct resolution {var_name}.{attr_name}[{resolved_index}] = {subscript_result}")
                                if isinstance(subscript_result, (int, float, str, bool, type(None))):
                                    return {'type': 'constant', 'value': subscript_result}
                                elif hasattr(subscript_result, 'value') and isinstance(subscript_result.value, (int, float, str, bool)):
                                    return {'type': 'constant', 'value': subscript_result.value}
                            except (KeyError, IndexError, TypeError) as e:
                                logging.debug(f"visit_Subscript: Direct resolution failed: {e}")
                except Exception as e:
                    logging.debug(f"visit_Subscript: Error in direct resolution optimization: {e}")

        # Check if this is a slice expression (e.g., list[1:5])
        if isinstance(node.slice, ast.Slice):
            logging.debug(f"visit_Subscript: Detected slice expression")
            value_info = self.visit(node.value)
            if value_info is None:
                logging.error(f"Error visiting value in slice subscript: {ast.dump(node)}")
                return None

            # Process slice components (lower, upper, step)
            lower_info = self.visit(node.slice.lower) if node.slice.lower else None
            upper_info = self.visit(node.slice.upper) if node.slice.upper else None
            step_info = self.visit(node.slice.step) if node.slice.step else None

            # Try to resolve at export time if all components are constants
            resolved_value = None
            resolved_lower = None
            resolved_upper = None
            resolved_step = None

            if value_info.get('type') == 'name':
                resolved_value = self.expression_resolver.resolve_variable(value_info['name'])
            elif value_info.get('type') == 'constant':
                resolved_value = value_info['value']
            elif value_info.get('type') == 'attribute':
                resolved_value = self.expression_resolver.resolve_expression(value_info)

            if lower_info and lower_info.get('type') == 'constant':
                resolved_lower = lower_info['value']
            if upper_info and upper_info.get('type') == 'constant':
                resolved_upper = upper_info['value']
            if step_info and step_info.get('type') == 'constant':
                resolved_step = step_info['value']

            # If we can resolve the value at export time, perform the slice
            if resolved_value is not None and isinstance(resolved_value, (list, tuple, str)):
                try:
                    slice_obj = slice(resolved_lower, resolved_upper, resolved_step)
                    sliced_result = resolved_value[slice_obj]
                    logging.debug(f"visit_Subscript: Resolved slice to constant: {sliced_result}")
                    # Return as constant list/tuple
                    if isinstance(sliced_result, (list, tuple)):
                        return {'type': 'constant', 'value': list(sliced_result)}
                    else:
                        return {'type': 'constant', 'value': sliced_result}
                except Exception as e:
                    logging.debug(f"visit_Subscript: Could not resolve slice at export time: {e}")

            # Return unresolved slice for frontend evaluation
            return {
                'type': 'slice',
                'value': value_info,
                'lower': lower_info,
                'upper': upper_info,
                'step': step_info
            }

        # First visit the value (the object being subscripted)
        value_info = self.visit(node.value) # Get returned result

        # Then visit the slice (the index)
        index_info = self.visit(node.slice) # Get returned result

        # Check if sub-visits were successful
        if value_info is None or index_info is None:
            logging.error(f"Error visiting value or index in subscript: {ast.dump(node)}")
            return None

        # Try to resolve the subscript operation if both parts are resolvable
        try:
            # Try to resolve the value (the container)
            resolved_container = None
            if value_info.get('type') == 'name':
                resolved_container = self.expression_resolver.resolve_variable(value_info['name'])
                if resolved_container is not None:
                    logging.debug(f"Resolved subscript container '{value_info['name']}' to {type(resolved_container).__name__}")
            elif value_info.get('type') == 'constant':
                resolved_container = value_info['value']

            # Try to resolve the index
            resolved_index = None
            if index_info.get('type') == 'constant':
                resolved_index = index_info['value']
            elif index_info.get('type') == 'name':
                resolved_index = self.expression_resolver.resolve_variable(index_info['name'])
                if resolved_index is not None:
                    logging.debug(f"Resolved subscript index '{index_info['name']}' to {resolved_index}")

            # If both container and index are resolved, perform the subscript operation
            if resolved_container is not None and resolved_index is not None:
                try:
                    # Try to perform the subscript operation
                    if isinstance(resolved_container, (dict, list, tuple)):
                        subscript_result = resolved_container[resolved_index]
                        logging.debug(f"Successfully resolved subscript operation: {type(resolved_container).__name__}[{resolved_index}] = {subscript_result}")

                        # Return as a constant if it's a simple value
                        if isinstance(subscript_result, (int, float, str, bool, type(None))):
                            return {'type': 'constant', 'value': subscript_result}
                        # Handle enum values
                        elif hasattr(subscript_result, 'value') and isinstance(subscript_result.value, (int, float, str, bool)):
                            return {'type': 'constant', 'value': subscript_result.value}
                        # Handle callable results (functions from closure)
                        elif callable(subscript_result):
                            logging.debug(f"Subscript result is callable (type: {type(subscript_result).__name__}), analyzing it as a rule function")
                            # Import analyze_rule to avoid circular dependency
                            from ..analysis import analyze_rule
                            # Analyze the function to get its rule structure
                            analyzed_result = analyze_rule(
                                rule_func=subscript_result,
                                closure_vars=self.closure_vars,
                                seen_funcs=self.seen_funcs,
                                game_handler=self.game_handler,
                                player_context=self.player_context,
                                rule_target_name=getattr(self, 'rule_target_name', None),
                                target_type=getattr(self, 'target_type', None)
                            )
                            if analyzed_result and analyzed_result.get('type') != 'error':
                                logging.debug(f"Successfully analyzed callable subscript result: {analyzed_result.get('type')}")
                                return analyzed_result
                            else:
                                logging.warning(f"Failed to analyze callable subscript result or got error: {analyzed_result}")
                        # Handle lists (which may contain callables or other values)
                        elif isinstance(subscript_result, (list, tuple)):
                            logging.debug(f"Subscript result is a list/tuple with {len(subscript_result)} items, checking if items are analyzable")
                            # Check if all items are callables
                            if all(callable(item) for item in subscript_result):
                                logging.debug(f"All items in subscript result list are callable, analyzing them")
                                # Import analyze_rule to avoid circular dependency
                                from ..analysis import analyze_rule
                                analyzed_items = []
                                for idx, item_func in enumerate(subscript_result):
                                    try:
                                        item_result = analyze_rule(
                                            rule_func=item_func,
                                            closure_vars=self.closure_vars.copy(),
                                            seen_funcs=self.seen_funcs,
                                            game_handler=self.game_handler,
                                            player_context=self.player_context,
                                            rule_target_name=getattr(self, 'rule_target_name', None),
                                            target_type=getattr(self, 'target_type', None)
                                        )
                                        if item_result and item_result.get('type') != 'error':
                                            analyzed_items.append(item_result)
                                        else:
                                            logging.debug(f"Could not analyze item {idx} in subscript list result, falling back to unresolved")
                                            analyzed_items = None
                                            break
                                    except Exception as e:
                                        logging.debug(f"Error analyzing item {idx} in subscript list result: {e}")
                                        analyzed_items = None
                                        break

                                if analyzed_items:
                                    # Successfully analyzed all items - return an 'and' of all items
                                    logging.debug(f"Successfully analyzed {len(analyzed_items)} callable items from subscript list, returning 'and' rule")
                                    if len(analyzed_items) == 0:
                                        # Empty list - all() of empty is True
                                        return {'type': 'constant', 'value': True}
                                    elif len(analyzed_items) == 1:
                                        return analyzed_items[0]
                                    else:
                                        return {'type': 'and', 'conditions': analyzed_items}
                            else:
                                # List contains non-callables, keep it as a constant
                                logging.debug(f"Subscript result list contains non-callable items, returning as constant")
                                return {'type': 'constant', 'value': subscript_result}
                        else:
                            logging.debug(f"Subscript result is not a simple value (type: {type(subscript_result).__name__}), cannot convert to constant")
                except (KeyError, IndexError, TypeError) as e:
                    logging.debug(f"Could not perform subscript operation: {e}")
        except Exception as e:
            logging.debug(f"Error attempting to resolve subscript: {e}")

        # If we couldn't resolve, create an unresolved subscript node
        result = {
            'type': 'subscript',
            'value': value_info,
            'index': index_info
        }

        logging.debug(f"Subscript result (unresolved): {result}")
        return result # Return the result

    def visit_BoolOp(self, node):
        """Handle boolean operations (AND/OR) between conditions"""
        try:
            logging.debug("\nvisit_BoolOp called:")
            logging.debug(f"Operator: {type(node.op).__name__}")
            logging.debug(f"Values: {[ast.dump(val) for val in node.values]}")

            # Process each value in the boolean operation
            conditions = []
            for value in node.values:
                condition_result = self.visit(value) # Get returned result
                if condition_result:
                    conditions.append(condition_result)
                else:
                    logging.error(f"Failed to analyze condition in BoolOp: {ast.dump(value)}")
                    return None # Fail the whole operation if one part fails

            # Create appropriate rule structure based on operator type
            op_type = 'and' if isinstance(node.op, ast.And) else 'or' if isinstance(node.op, ast.Or) else None
            if not op_type:
                logging.debug(f"Unknown boolean operator: {type(node.op).__name__}")
                return None

            result = {
                'type': op_type,
                'conditions': conditions
            }
            logging.debug(f"Boolean operation result: {result}")
            return result # Return the result

        except Exception as e:
            logging.error(f"Error in visit_BoolOp: {e}")
            return None
