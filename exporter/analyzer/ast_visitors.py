"""
AST visitor methods for different node types.

This module contains all the visit_* methods that handle different
AST node types during rule analysis. It's designed as a mixin to be
used with the RuleAnalyzer class.
"""

import ast
import logging
from typing import Any, Dict, Optional, List

from .utils import make_json_serializable, is_simple_value


class ASTVisitorMixin:
    """
    Mixin containing all visit_* methods for AST nodes.

    This class is designed to be mixed into RuleAnalyzer and provides
    all the visitor methods for handling different AST node types.

    Required attributes from parent class:
        - closure_vars: Dict of closure variables
        - seen_funcs: Dict of seen functions (recursion tracking)
        - game_handler: Game-specific handler
        - rule_func: The rule function being analyzed
        - player_context: Player number context
        - debug_log: List for debug messages
        - error_log: List for error messages
        - expression_resolver: ExpressionResolver instance
        - binary_op_processor: BinaryOpProcessor instance
    """

    def _register_helper_usage(self, helper_name: str, helper_func: Any = None) -> None:
        """
        Register that a helper function is used, for automatic discovery.

        This calls the game handler's register_helper_usage method if available,
        allowing the exporter to automatically discover and export helper definitions.

        Args:
            helper_name: The name of the helper function being used
            helper_func: Optional - the actual function object (for auto-detecting module)
        """
        if (hasattr(self, 'game_handler') and
            self.game_handler is not None and
            hasattr(self.game_handler, 'register_helper_usage')):
            self.game_handler.register_helper_usage(helper_name, helper_func)
            logging.debug(f"Registered helper usage: {helper_name}")

    def visit_Module(self, node):
        try:
            logging.debug(f"\n--- Starting Module Analysis ---")
            logging.debug(f"Module body length: {len(node.body)}")

            # Detailed module body inspection
            for i, body_node in enumerate(node.body):
                logging.debug(f"Module body node {i}: {type(body_node).__name__}")

            # Visit first node in module body if exists and return its result
            if node.body:
                return self.visit(node.body[0])
            logging.warning(f"visit_Module: Empty module body, returning None")
            return None # Return None if no body
        except Exception as e:
            logging.error("Error in visit_Module", e)
            return None

    def visit_FunctionDef(self, node):
        try:
            logging.debug(f"\n--- Analyzing Function Definition: {node.name} ---")
            logging.debug(f"Function args: {[arg.arg for arg in node.args.args]}")

            # Detailed function body inspection
            for i, body_node in enumerate(node.body):
                logging.debug(f"Function body node {i}: {type(body_node).__name__}")

            # Skip docstrings - they are Expr nodes containing a Constant string as the first statement
            body_to_analyze = list(node.body)
            if (body_to_analyze and
                isinstance(body_to_analyze[0], ast.Expr) and
                isinstance(body_to_analyze[0].value, ast.Constant) and
                isinstance(body_to_analyze[0].value.value, str)):
                # First statement is a docstring, skip it
                logging.debug("Skipping docstring in function body")
                body_to_analyze = body_to_analyze[1:]

            if not body_to_analyze:
                logging.warning(f"visit_FunctionDef: Empty function body for '{node.name}', returning None")
                return None

            # Check if this is a simple single-return function (the common case)
            # Only use block mode if there are multiple statements or complex control flow
            needs_block_mode = self._needs_block_mode(body_to_analyze)

            if needs_block_mode:
                logging.debug(f"visit_FunctionDef: Using block mode for '{node.name}'")
                # Analyze all statements and produce a block
                statements = []
                for stmt in body_to_analyze:
                    stmt_result = self.visit_statement(stmt)
                    if stmt_result is not None:
                        statements.append(stmt_result)

                if len(statements) == 1:
                    # Single statement - don't wrap in block
                    return statements[0]
                elif statements:
                    return {
                        'type': 'block',
                        'statements': statements
                    }
                return None

            # Original simple mode: Skip variable assignments and look for control flow or return
            while body_to_analyze and isinstance(body_to_analyze[0], (ast.Assign, ast.AnnAssign)):
                logging.debug(f"Skipping variable assignment: {type(body_to_analyze[0]).__name__}")
                body_to_analyze = body_to_analyze[1:]

            # Visit the first meaningful body node if exists and return its result
            # Looks for control flow (If, Return, etc.) after skipping assignments
            if body_to_analyze:
                # Special case: If statement without else, and more statements follow
                if isinstance(body_to_analyze[0], ast.If) and not body_to_analyze[0].orelse and len(body_to_analyze) > 1:
                    logging.debug(f"visit_FunctionDef: If statement without else, analyzing remaining {len(body_to_analyze) - 1} statements as implicit else")
                    # Create a synthetic If node with the remaining statements as the else block
                    if_node = body_to_analyze[0]
                    remaining_stmts = body_to_analyze[1:]

                    # Create a synthetic if-node that includes the remaining statements as the else block
                    synthetic_if = ast.If(
                        test=if_node.test,
                        body=if_node.body,
                        orelse=remaining_stmts,
                        lineno=if_node.lineno if hasattr(if_node, 'lineno') else 0,
                        col_offset=if_node.col_offset if hasattr(if_node, 'col_offset') else 0
                    )

                    # Visit this synthetic if-statement, which will use visit_If and its multistatement handling
                    return self.visit_If(synthetic_if)
                else:
                    return self.visit(body_to_analyze[0])
            logging.warning(f"visit_FunctionDef: Empty function body for '{node.name}', returning None")
            return None # Return None if no body
        except Exception as e:
            logging.error(f"Error analyzing function {node.name}: {e}")
            return None

    def _needs_block_mode(self, body_nodes):
        """
        Determine if a function body needs block mode (multi-statement) analysis.
        Returns True if the body contains:
        - For loops (including inside If statements)
        - Multiple assignments followed by a return (including returns inside If statements)
        - AugAssign statements (including inside If statements)
        """
        # Check for for loops recursively - they can be inside If statements' body or orelse
        def has_for_recursive(nodes):
            for node in nodes:
                if isinstance(node, ast.For):
                    return True
                if isinstance(node, ast.If):
                    if has_for_recursive(node.body):
                        return True
                    if has_for_recursive(node.orelse):
                        return True
            return False

        # Check for augmented assignments recursively
        def has_augassign_recursive(nodes):
            for node in nodes:
                if isinstance(node, ast.AugAssign):
                    return True
                if isinstance(node, ast.If):
                    if has_augassign_recursive(node.body):
                        return True
                    if has_augassign_recursive(node.orelse):
                        return True
                if isinstance(node, ast.For):
                    if has_augassign_recursive(node.body):
                        return True
            return False

        has_for = has_for_recursive(body_nodes)
        has_augassign = has_augassign_recursive(body_nodes)

        # Count assignments at the top level
        assign_count = sum(1 for n in body_nodes if isinstance(n, (ast.Assign, ast.AnnAssign)))

        # Check for return statements - both at top level and inside If statements
        def has_return_recursive(nodes):
            for node in nodes:
                if isinstance(node, ast.Return):
                    return True
                if isinstance(node, ast.If):
                    if has_return_recursive(node.body):
                        return True
                    if has_return_recursive(node.orelse):
                        return True
            return False

        has_return = has_return_recursive(body_nodes)

        # Use block mode if we have for loops, augmented assignments,
        # or any assignments before a return (need to capture variable bindings)
        if has_for or has_augassign:
            return True
        if assign_count > 0 and has_return:
            return True
        return False

    def visit_Lambda(self, node):
        try:
            logging.debug("\n--- Analyzing Lambda ---")
            param_names = [arg.arg for arg in node.args.args]
            logging.debug(f"Lambda args: {param_names}")
            logging.debug(f"Lambda body type: {type(node.body).__name__}")

            # Visit the lambda body
            body_result = self.visit(node.body)

            # Determine if this is a "rule lambda" (access rule) or a "data lambda" (for map, etc.)
            # Rule lambdas have 'state' as the first parameter and should return just the body
            # Data lambdas (used in map(), filter(), etc.) should return the full lambda structure
            # Note: Super Metroid uses 'sm' (SMSolver) instead of 'state' for its rule lambdas
            is_rule_lambda = (
                not param_names or  # No params - simple rule
                (param_names and param_names[0] in ('state', 'self', 'sm'))
            )

            if is_rule_lambda:
                # Rule lambda - return just the body (the actual rule)
                return body_result
            else:
                # Data lambda (e.g., lambda x: transform(x)) - return full structure
                return {
                    'type': 'lambda',
                    'params': param_names,
                    'body': body_result
                }
        except Exception as e:
            logging.error("Error in visit_Lambda", e)
            return None

    def visit_Return(self, node):
        try:
            logging.debug("\n--- Analyzing Return ---")
            logging.debug(f"Return value type: {type(node.value).__name__}")

            if isinstance(node.value, ast.BoolOp):
                logging.debug(f"BoolOp type: {type(node.value.op).__name__}")
                logging.debug(f"BoolOp values count: {len(node.value.values)}")

            # Visit the return value and return its result
            return self.visit(node.value)
        except Exception as e:
            logging.error("Error in visit_Return", e)
            return None

    def visit_Break(self, node):
        """Handle break statements - used to exit loops early."""
        logging.debug("\n--- Analyzing Break ---")
        return {'type': 'break'}

    def visit_Continue(self, node):
        """Handle continue statements - skip to next iteration."""
        logging.debug("\n--- Analyzing Continue ---")
        return {'type': 'continue'}

    def visit_Call(self, node):
        """
        Visit a function call node.

        This method keeps ALL arguments during analysis (including state and player).
        Filtering of state/player happens later when creating final result structures.
        """
        logging.debug(f"\nvisit_Call called:")
        logging.debug(f"Function: {ast.dump(node.func)}")
        logging.debug(f"Args: {[ast.dump(arg) for arg in node.args]}")

        # *** Special handling for state.multiworld.get_region() pattern ***
        # Check this early before visiting function node to avoid unnecessary processing
        region_name = self._is_multiworld_get_region_call(node)
        if region_name:
            logging.debug(f"Detected state.multiworld.get_region pattern, region: {region_name}")
            return {'type': 'region_reference', 'region': region_name}

        # Visit the function node to obtain its details.
        func_info = self.visit(node.func) # Get returned result
        logging.debug(f"Function info after visit: {func_info}")

        # Process ALL arguments and keep track of AST nodes for filtering
        args = []  # Analyzed argument results
        args_with_nodes = []  # Pairs of (ast_node, result) for filtering
        for i, arg_node in enumerate(node.args):
            arg_result = self.visit(arg_node) # Get returned result for each arg
            if arg_result is None:
                 logging.error(f"Failed to analyze argument {i} in call: {ast.dump(arg_node)}")
                 # More permissive - continue even if arg analysis fails
                 continue
            args.append(arg_result)
            args_with_nodes.append((arg_node, arg_result))

        logging.debug(f"Collected all args: {args}")

        # --- Determine the type of call ---

        # 1. Helper function call (identified by name)
        if func_info and func_info.get('type') == 'name':
            func_name = func_info['name']
            logging.debug(f"Checking helper: {func_name}")

            # Filter arguments for game handler and result creation
            filtered_args = self._filter_special_args(args_with_nodes)

            # Resolve variable references in arguments (e.g., lambda defaults)
            # Skip this when preserve_parameter_names is True - we want to keep params as name references
            if not getattr(self, 'preserve_parameter_names', False):
                resolved_args = []
                for arg in filtered_args:
                    if arg and arg.get('type') == 'name':
                        # Skip 'world' - it should have been filtered already but double-check
                        if arg['name'] == 'world':
                            logging.debug(f"Skipping resolution of 'world' argument")
                            continue

                        # Try to resolve the variable
                        resolved_value = self.expression_resolver.resolve_variable(arg['name'])
                        if resolved_value is not None and is_simple_value(resolved_value):
                            # Only create constant for simple values
                            # Handle enum values - extract the numeric value
                            if hasattr(resolved_value, 'value'):
                                final_value = resolved_value.value
                            else:
                                final_value = resolved_value
                            # Ensure the final value is JSON-serializable
                            final_value = make_json_serializable(final_value)
                            logging.debug(f"Resolved argument variable '{arg['name']}' to {final_value}")
                            resolved_args.append({'type': 'constant', 'value': final_value})
                        # Handle Region objects - extract the .name attribute
                        elif resolved_value is not None and hasattr(resolved_value, 'name') and hasattr(resolved_value, 'entrances'):
                            region_name = resolved_value.name
                            logging.debug(f"Resolved argument variable '{arg['name']}' (Region object) to region name: {region_name}")
                            resolved_args.append({'type': 'constant', 'value': region_name})
                        else:
                            # Keep unresolved or complex objects as name references
                            resolved_args.append(arg)
                    elif arg and arg.get('type') == 'attribute':
                        # Try to resolve attribute expressions like HatType.BREWING
                        resolved_value = self.expression_resolver.resolve_expression(arg)
                        if resolved_value is not None and is_simple_value(resolved_value):
                            # Only create constant for simple values
                            # Handle enum values - extract the numeric value
                            if hasattr(resolved_value, 'value'):
                                final_value = resolved_value.value
                            else:
                                final_value = resolved_value
                            # Ensure the final value is JSON-serializable
                            final_value = make_json_serializable(final_value)
                            logging.debug(f"Resolved argument attribute to {final_value}")
                            resolved_args.append({'type': 'constant', 'value': final_value})
                        else:
                            # Keep unresolved or complex objects as attribute references
                            resolved_args.append(arg)
                    else:
                        resolved_args.append(arg)

                filtered_args = resolved_args

            # Check for game-specific special function calls
            if self.game_handler and hasattr(self.game_handler, 'handle_special_function_call'):
                special_result = self.game_handler.handle_special_function_call(func_name, filtered_args)
                if special_result:
                    logging.debug(f"Game handler processed special function {func_name}: {special_result}")
                    return special_result

            # Check if the function name resolves to a callable via function defaults (e.g., loc_rule, coin_rule)
            if func_name not in self.closure_vars:
                resolved_func = self.expression_resolver.resolve_variable(func_name)
                if resolved_func is not None and callable(resolved_func):
                    logging.debug(f"Identified call to function from lambda default parameter: {func_name} -> {resolved_func}")

                    # Check if game handler wants to preserve this as a helper
                    should_preserve = False
                    actual_func_name = None
                    if self.game_handler and hasattr(self.game_handler, 'should_preserve_as_helper'):
                        # Get the actual function name from the resolved function
                        actual_func_name = getattr(resolved_func, '__name__', None)
                        if actual_func_name and self.game_handler.should_preserve_as_helper(actual_func_name):
                            logging.debug(f"Game handler requests preserving {actual_func_name} as helper, skipping recursive analysis")
                            should_preserve = True
                            # Replace func_name with the actual function name for helper call creation
                            func_name = actual_func_name
                            func_info = {'type': 'name', 'name': func_name}

                    # Recursive analysis logic for lambda default parameters (only if not preserving as helper)
                    if not should_preserve:
                        try:
                            # Helper function to check if a function contains for loops over dynamic data
                            def has_dynamic_for_loops_resolved(func):
                                """Check if a function's body contains for loops over non-constant iterables."""
                                try:
                                    import inspect
                                    source = inspect.getsource(func)
                                    tree = ast.parse(source)
                                    for n in ast.walk(tree):
                                        if isinstance(n, ast.For):
                                            # Check if iterator is a method call like .keys(), .values(), .items()
                                            if isinstance(n.iter, ast.Call):
                                                if isinstance(n.iter.func, ast.Attribute):
                                                    method_name = n.iter.func.attr
                                                    if method_name in ('keys', 'values', 'items'):
                                                        return True
                                            # Check if iterator is a name (variable)
                                            elif isinstance(n.iter, ast.Name):
                                                return True
                                    return False
                                except Exception:
                                    return False

                            # Check if function has dynamic for loops - if so, preserve as helper
                            resolved_func_name = getattr(resolved_func, '__name__', func_name)
                            if has_dynamic_for_loops_resolved(resolved_func):
                                logging.debug(f"Function {resolved_func_name} has dynamic for loops, preserving as helper")
                                if hasattr(self.game_handler, 'register_helper_usage'):
                                    self.game_handler.register_helper_usage(resolved_func_name, resolved_func)
                                return {
                                    'type': 'helper',
                                    'name': resolved_func_name,
                                    'args': filtered_args
                                }

                            # Check if 'state' is passed as an argument using original AST nodes
                            has_state_arg = any(isinstance(arg, ast.Name) and arg.id == 'state' for arg in node.args)
                            # Attempt recursion if state arg is present
                            if has_state_arg:
                                # Import analyze_rule locally to avoid forward reference issues
                                from .analysis import analyze_rule
                                logging.debug(f"Recursively analyzing lambda default function: {func_name} -> {resolved_func}")

                                # Build parameter mapping for function inlining
                                param_mapping = self._build_parameter_mapping(resolved_func, args_with_nodes)

                                # Merge parameter mapping into closure vars
                                enhanced_closure_vars = self.closure_vars.copy()
                                enhanced_closure_vars.update(param_mapping)

                                # Pass the seen_funcs dictionary (it's mutable state)
                                recursive_result = analyze_rule(rule_func=resolved_func,
                                                              closure_vars=enhanced_closure_vars,
                                                              seen_funcs=self.seen_funcs,
                                                              game_handler=self.game_handler,
                                                              player_context=self.player_context)
                                if recursive_result.get('type') != 'error':
                                    # Check if the result is too large to inline
                                    # If so, discard the analyzed result and treat like manual preservation
                                    # But only if we have a real function name (not <lambda>)
                                    auto_preserve = getattr(self.game_handler, 'AUTO_PRESERVE_LARGE_HELPERS', False) if self.game_handler else False
                                    threshold = getattr(self.game_handler, 'HELPER_INLINE_THRESHOLD', 0) if self.game_handler else 0
                                    # Don't preserve lambdas - they have no useful name for export
                                    if auto_preserve and actual_func_name and actual_func_name != '<lambda>':
                                        from exporter.games.base import BaseGameExportHandler
                                        size = BaseGameExportHandler.count_rule_nodes(recursive_result)
                                        if size > threshold:
                                            logging.debug(f"Helper {actual_func_name} has {size} nodes (threshold {threshold}), preserving as helper")
                                            # Register the helper for export
                                            if hasattr(self.game_handler, 'register_helper_usage'):
                                                self.game_handler.register_helper_usage(actual_func_name, resolved_func)
                                            if hasattr(self.game_handler, 'register_auto_preserved_helper'):
                                                self.game_handler.register_auto_preserved_helper(actual_func_name)
                                            # Only cache the analyzed result if the function has no extra parameters
                                            # (besides state, player, world). If it takes parameters, the cached
                                            # result would have specific argument values baked in, which is wrong.
                                            if hasattr(self.game_handler, 'cache_analyzed_helper') and hasattr(resolved_func, '__code__'):
                                                all_params = resolved_func.__code__.co_varnames[:resolved_func.__code__.co_argcount]
                                                extra_params = [p for p in all_params if p not in ('state', 'player', 'world')]
                                                if not extra_params:
                                                    # No extra params - safe to cache the fully-resolved definition
                                                    self.game_handler.cache_analyzed_helper(actual_func_name, recursive_result)
                                                    logging.debug(f"Cached definition for parameterless helper {actual_func_name}")
                                                else:
                                                    logging.debug(f"Not caching {actual_func_name} - has params {extra_params}")
                                            # Return a helper call with original args (like manual preservation)
                                            return {
                                                'type': 'helper',
                                                'name': actual_func_name,
                                                'args': filtered_args
                                            }
                                    logging.debug(f"Recursive analysis successful for {func_name}. Result: {recursive_result}")
                                    return recursive_result
                                else:
                                    logging.debug(f"Recursive analysis for {func_name} returned type 'error'. Falling back to helper node. Error details: {recursive_result.get('error_log')}")
                        except Exception as e:
                            logging.error(f"Error during recursive analysis of lambda default {func_name}: {e}")
                        # If recursion wasn't attempted or failed, fall through to default helper representation

            # Check if the function name is in closure vars
            if func_name in self.closure_vars:
                 logging.debug(f"Identified call to known closure variable: {func_name}")

                 # Get the actual function from the closure to check its name
                 actual_func = self.closure_vars[func_name]
                 closure_func_name = getattr(actual_func, '__name__', func_name)

                 # Check if game handler wants to explicitly preserve this as a helper
                 # (without recursive analysis - the JS implementation handles it)
                 if self.game_handler and hasattr(self.game_handler, 'should_preserve_as_helper'):
                     if closure_func_name and self.game_handler.should_preserve_as_helper(closure_func_name):
                         logging.debug(f"Game handler requests preserving closure {closure_func_name} as helper, skipping recursive analysis")
                         return {
                             'type': 'helper',
                             'name': closure_func_name,
                             'args': filtered_args
                         }

                 # --- Recursive analysis logic (enhanced for multiline lambdas) ---
                 try:
                     # Helper function to check if a function contains for loops over dynamic data
                     def has_dynamic_for_loops(func):
                         """Check if a function's body contains for loops over non-constant iterables."""
                         try:
                             import inspect
                             source = inspect.getsource(func)
                             tree = ast.parse(source)
                             for node in ast.walk(tree):
                                 if isinstance(node, ast.For):
                                     # Check if iterator is a method call like .keys(), .values(), .items()
                                     if isinstance(node.iter, ast.Call):
                                         if isinstance(node.iter.func, ast.Attribute):
                                             method_name = node.iter.func.attr
                                             if method_name in ('keys', 'values', 'items'):
                                                 logging.debug(f"Function has for loop over .{method_name}()")
                                                 return True
                                     # Check if iterator is a name (variable) that's not a constant
                                     elif isinstance(node.iter, ast.Name):
                                         # Could be iterating over a variable - likely dynamic
                                         logging.debug(f"Function has for loop over variable: {node.iter.id}")
                                         return True
                             return False
                         except Exception:
                             return False

                     # Helper function to check if an AST node references 'state'
                     def references_state(node):
                         """Check if an AST node references the name 'state' anywhere."""
                         if isinstance(node, ast.Name) and node.id == 'state':
                             return True
                         # Check in attribute access: state.smbm
                         if isinstance(node, ast.Attribute):
                             return references_state(node.value)
                         # Check in subscript: state.smbm[player]
                         if isinstance(node, ast.Subscript):
                             return references_state(node.value)
                         # Check in other composite nodes
                         for child in ast.walk(node):
                             if isinstance(child, ast.Name) and child.id == 'state':
                                 return True
                         return False

                     # Check if function has dynamic for loops - if so, preserve as helper
                     if has_dynamic_for_loops(actual_func):
                         logging.debug(f"Function {closure_func_name} has dynamic for loops, preserving as helper")
                         if hasattr(self.game_handler, 'register_helper_usage'):
                             self.game_handler.register_helper_usage(closure_func_name, actual_func)
                         return {
                             'type': 'helper',
                             'name': closure_func_name,
                             'args': filtered_args
                         }

                     # Check if 'state' is passed as an argument (directly or indirectly)
                     has_state_arg = any(references_state(arg) for arg in node.args)
                     # Attempt recursion if state arg is present
                     if has_state_arg:
                          # Import analyze_rule locally to avoid forward reference issues
                          from .analysis import analyze_rule
                          # actual_func and closure_func_name already set above
                          logging.debug(f"Recursively analyzing closure function: {func_name} -> {actual_func}")

                          # Build parameter mapping for function inlining
                          param_mapping = self._build_parameter_mapping(actual_func, args_with_nodes)

                          # Merge parameter mapping into closure vars
                          enhanced_closure_vars = self.closure_vars.copy()
                          enhanced_closure_vars.update(param_mapping)

                          # Pass the seen_funcs dictionary (it's mutable state)
                          recursive_result = analyze_rule(rule_func=actual_func,
                                                          closure_vars=enhanced_closure_vars,
                                                          seen_funcs=self.seen_funcs, # Pass the dict
                                                          game_handler=self.game_handler,
                                                          player_context=self.player_context)
                          if recursive_result.get('type') != 'error':
                              # Check if the result is too large to inline
                              # If so, discard the analyzed result and treat like manual preservation
                              # But only if we have a real function name (not <lambda>)
                              auto_preserve = getattr(self.game_handler, 'AUTO_PRESERVE_LARGE_HELPERS', False) if self.game_handler else False
                              threshold = getattr(self.game_handler, 'HELPER_INLINE_THRESHOLD', 0) if self.game_handler else 0
                              # closure_func_name already set above
                              # Don't preserve lambdas - they have no useful name for export
                              if auto_preserve and closure_func_name and closure_func_name != '<lambda>':
                                  from exporter.games.base import BaseGameExportHandler
                                  size = BaseGameExportHandler.count_rule_nodes(recursive_result)
                                  if size > threshold:
                                      logging.debug(f"Helper {closure_func_name} has {size} nodes (threshold {threshold}), preserving as helper")
                                      # Register the helper for export
                                      if hasattr(self.game_handler, 'register_helper_usage'):
                                          self.game_handler.register_helper_usage(closure_func_name, actual_func)
                                      if hasattr(self.game_handler, 'register_auto_preserved_helper'):
                                          self.game_handler.register_auto_preserved_helper(closure_func_name)
                                      # Only cache the analyzed result if the function has no extra parameters
                                      # (besides state, player, world). If it takes parameters, the cached
                                      # result would have specific argument values baked in, which is wrong.
                                      if hasattr(self.game_handler, 'cache_analyzed_helper') and hasattr(actual_func, '__code__'):
                                          all_params = actual_func.__code__.co_varnames[:actual_func.__code__.co_argcount]
                                          extra_params = [p for p in all_params if p not in ('state', 'player', 'world')]
                                          if not extra_params:
                                              # No extra params - safe to cache the fully-resolved definition
                                              self.game_handler.cache_analyzed_helper(closure_func_name, recursive_result)
                                              logging.debug(f"Cached definition for parameterless helper {closure_func_name}")
                                          else:
                                              logging.debug(f"Not caching {closure_func_name} - has params {extra_params}")
                                      # Return a helper call with original args (like manual preservation)
                                      return {
                                          'type': 'helper',
                                          'name': closure_func_name,
                                          'args': filtered_args
                                      }
                              logging.debug(f"Recursive analysis successful for {func_name}. Result: {recursive_result}")
                              return recursive_result # Return the detailed analysis result
                          else:
                              logging.debug(f"Recursive analysis for {func_name} returned type 'error'. Falling back to helper node. Error details: {recursive_result.get('error_log')}")
                 except Exception as e:
                      logging.error(f"Error during recursive analysis of closure var {func_name}: {e}")
                 # --- END Recursive analysis logic ---
                 # If recursion wasn't attempted or failed, fall through to default helper representation

            # *** Special handling for all(GeneratorExp) ***
            if func_name == 'all' and len(filtered_args) == 1 and filtered_args[0].get('type') == 'generator_expression':
                logging.debug(f"Detected all(GeneratorExp) pattern.")
                gen_exp = filtered_args[0] # The result from visit_GeneratorExp

                # Try to resolve the iterator if it's a name reference
                iterator_info = gen_exp['comprehension']

                # Check if the iterator has already been resolved to an 'and' or 'or' rule
                # This happens when visit_Subscript has already analyzed a list of callables
                iterator_type = iterator_info.get('iterator', {}).get('type')
                if iterator_type in ('and', 'or'):
                    logging.debug(f"all(GeneratorExp): Iterator already resolved to '{iterator_type}' rule, returning it directly")
                    # The iterator has already been fully analyzed, just return it
                    return iterator_info['iterator']

                if iterator_type == 'name':
                    iterator_name = iterator_info['iterator']['name']
                    logging.debug(f"all(GeneratorExp): Attempting to resolve iterator '{iterator_name}'")

                    resolved_value = self.expression_resolver.resolve_variable(iterator_name)

                    # Convert frozensets/sets/tuples to lists for uniform handling
                    if resolved_value is not None:
                        if isinstance(resolved_value, (frozenset, set, tuple)):
                            resolved_value = list(resolved_value)
                            logging.debug(f"all(GeneratorExp): Converted {type(resolved_value).__name__} to list")

                    if resolved_value is not None and isinstance(resolved_value, list):
                        logging.debug(f"all(GeneratorExp): Resolved '{iterator_name}' to list with {len(resolved_value)} items")

                        # Check if items are callables (old behavior)
                        if all(callable(item) for item in resolved_value):
                            from .analysis import analyze_rule
                            analyzed_items = []
                            for item_func in resolved_value:
                                try:
                                    item_result = analyze_rule(rule_func=item_func, closure_vars=self.closure_vars.copy(),
                                                              seen_funcs=self.seen_funcs, game_handler=self.game_handler,
                                                              player_context=self.player_context)
                                    if item_result and item_result.get('type') != 'error':
                                        analyzed_items.append(item_result)
                                    else:
                                        logging.debug(f"Could not analyze item in {iterator_name} list, falling back to unresolved")
                                        analyzed_items = None
                                        break
                                except Exception as e:
                                    logging.debug(f"Error analyzing item in {iterator_name}: {e}")
                                    analyzed_items = None
                                    break

                            if analyzed_items:
                                # Successfully analyzed all items - return an 'and' of all items
                                logging.debug(f"all(GeneratorExp): Successfully analyzed {len(analyzed_items)} items, returning 'and' rule")
                                if len(analyzed_items) == 1:
                                    return analyzed_items[0]
                                else:
                                    return {'type': 'and', 'conditions': analyzed_items}

                        # NEW: Handle simple values (strings, numbers, etc.) - expand the comprehension
                        else:
                            logging.debug(f"all(GeneratorExp): Iterator contains non-callable values, expanding comprehension")
                            target_name = iterator_info.get('target', {}).get('name')
                            if not target_name:
                                logging.warning(f"all(GeneratorExp): Could not extract target variable name from comprehension")
                            else:
                                element_rule = gen_exp['element']
                                expanded_conditions = []

                                for value in resolved_value:
                                    # Substitute the target variable with the current value in the element rule
                                    substituted_rule = self._substitute_variable_in_rule(element_rule, target_name, value)
                                    if substituted_rule:
                                        expanded_conditions.append(substituted_rule)
                                    else:
                                        logging.warning(f"all(GeneratorExp): Failed to substitute {target_name}={value} in element rule")
                                        expanded_conditions = None
                                        break

                                if expanded_conditions:
                                    logging.debug(f"all(GeneratorExp): Successfully expanded to {len(expanded_conditions)} conditions")
                                    if len(expanded_conditions) == 0:
                                        # Empty iterator - all() of empty is True
                                        return {'type': 'constant', 'value': True}
                                    elif len(expanded_conditions) == 1:
                                        return expanded_conditions[0]
                                    else:
                                        return {'type': 'and', 'conditions': expanded_conditions}

                # Represent this as a specific 'all_of' rule type
                # For nested generator expressions, recursively convert inner generators to all_of
                element_rule = gen_exp['element']
                if element_rule.get('type') == 'generator_expression':
                    # Recursively convert nested generator_expression to all_of
                    element_rule = self._convert_generator_exp_to_all_of(element_rule)
                    logging.debug(f"all(GeneratorExp): Converted nested generator_expression to all_of")

                result = {
                    'type': 'all_of',
                    'element_rule': element_rule,
                    'iterator_info': iterator_info
                }
                logging.debug(f"Created 'all_of' result: {result}")
                return result
            # *** END ADDED ***

            # *** Special handling for any(GeneratorExp) ***
            if func_name == 'any' and len(filtered_args) == 1 and filtered_args[0].get('type') == 'generator_expression':
                logging.debug(f"Detected any(GeneratorExp) pattern.")
                gen_exp = filtered_args[0] # The result from visit_GeneratorExp

                # Try to resolve the iterator if it's a name reference
                iterator_info = gen_exp['comprehension']

                # Check if the iterator has already been resolved to an 'and' or 'or' rule
                # This happens when visit_Subscript has already analyzed a list of callables
                iterator_type = iterator_info.get('iterator', {}).get('type')
                if iterator_type in ('and', 'or'):
                    logging.debug(f"any(GeneratorExp): Iterator already resolved to '{iterator_type}' rule, returning it directly (converting 'and' to 'or' if needed)")
                    # The iterator has already been fully analyzed
                    # For any(), we need an 'or' of all conditions
                    iterator_rule = iterator_info['iterator']
                    if iterator_rule.get('type') == 'and':
                        # Convert 'and' to 'or' for any()
                        return {'type': 'or', 'conditions': iterator_rule.get('conditions', [])}
                    else:
                        return iterator_rule

                if iterator_type == 'name':
                    iterator_name = iterator_info['iterator']['name']
                    logging.debug(f"any(GeneratorExp): Attempting to resolve iterator '{iterator_name}'")

                    resolved_value = self.expression_resolver.resolve_variable(iterator_name)

                    # Convert frozensets/sets/tuples to lists for uniform handling
                    if resolved_value is not None:
                        if isinstance(resolved_value, (frozenset, set, tuple)):
                            resolved_value = list(resolved_value)
                            logging.debug(f"any(GeneratorExp): Converted {type(resolved_value).__name__} to list")

                    if resolved_value is not None and isinstance(resolved_value, list):
                        logging.debug(f"any(GeneratorExp): Resolved '{iterator_name}' to list with {len(resolved_value)} items")

                        # Check if items are callables (old behavior)
                        if all(callable(item) for item in resolved_value):
                            from .analysis import analyze_rule
                            analyzed_items = []
                            for item_func in resolved_value:
                                try:
                                    item_result = analyze_rule(rule_func=item_func, closure_vars=self.closure_vars.copy(),
                                                              seen_funcs=self.seen_funcs, game_handler=self.game_handler,
                                                              player_context=self.player_context)
                                    if item_result and item_result.get('type') != 'error':
                                        analyzed_items.append(item_result)
                                    else:
                                        logging.debug(f"Could not analyze item in {iterator_name} list, falling back to unresolved")
                                        analyzed_items = None
                                        break
                                except Exception as e:
                                    logging.debug(f"Error analyzing item in {iterator_name}: {e}")
                                    analyzed_items = None
                                    break

                            if analyzed_items:
                                # Successfully analyzed all items - return an 'or' of all items (different from 'all')
                                logging.debug(f"any(GeneratorExp): Successfully analyzed {len(analyzed_items)} items, returning 'or' rule")
                                if len(analyzed_items) == 1:
                                    return analyzed_items[0]
                                else:
                                    return {'type': 'or', 'conditions': analyzed_items}

                        # NEW: Handle nested comprehensions - list of lists of callables
                        # This pattern appears in The Witness: any(all(condition(state) for condition in sub_req) for sub_req in fully_converted_rules)
                        # where fully_converted_rules is a list of lists of lambda functions
                        elif all(isinstance(item, (list, tuple)) for item in resolved_value):
                            # Check if each inner list contains callables
                            if all(all(callable(inner_item) for inner_item in item) for item in resolved_value):
                                logging.debug(f"any(GeneratorExp): Detected list of lists of callables, analyzing nested pattern")
                                from .analysis import analyze_rule
                                outer_conditions = []
                                analysis_failed = False

                                for inner_list in resolved_value:
                                    # Analyze each callable in the inner list
                                    inner_conditions = []
                                    for item_func in inner_list:
                                        try:
                                            item_result = analyze_rule(
                                                rule_func=item_func,
                                                closure_vars=self.closure_vars.copy(),
                                                seen_funcs=self.seen_funcs,
                                                game_handler=self.game_handler,
                                                player_context=self.player_context
                                            )
                                            if item_result and item_result.get('type') != 'error':
                                                inner_conditions.append(item_result)
                                            else:
                                                logging.debug(f"Could not analyze item in nested list, falling back to unresolved")
                                                analysis_failed = True
                                                break
                                        except Exception as e:
                                            logging.debug(f"Error analyzing item in nested list: {e}")
                                            analysis_failed = True
                                            break

                                    if analysis_failed:
                                        break

                                    # Combine inner conditions with 'and' (since inner is all())
                                    if len(inner_conditions) == 0:
                                        # Empty inner list - all() of empty is True
                                        inner_result = {'type': 'constant', 'value': True}
                                    elif len(inner_conditions) == 1:
                                        inner_result = inner_conditions[0]
                                    else:
                                        inner_result = {'type': 'and', 'conditions': inner_conditions}

                                    outer_conditions.append(inner_result)

                                if not analysis_failed and outer_conditions:
                                    # Combine outer conditions with 'or' (since outer is any())
                                    logging.debug(f"any(GeneratorExp): Successfully analyzed nested pattern, {len(outer_conditions)} outer conditions")
                                    if len(outer_conditions) == 0:
                                        return {'type': 'constant', 'value': False}
                                    elif len(outer_conditions) == 1:
                                        return outer_conditions[0]
                                    else:
                                        return {'type': 'or', 'conditions': outer_conditions}

                        # Handle simple values (strings, numbers, etc.) - expand the comprehension
                        else:
                            logging.debug(f"any(GeneratorExp): Iterator contains non-callable values, expanding comprehension")
                            target_name = iterator_info.get('target', {}).get('name')
                            if not target_name:
                                logging.warning(f"any(GeneratorExp): Could not extract target variable name from comprehension")
                            else:
                                element_rule = gen_exp['element']
                                expanded_conditions = []

                                for value in resolved_value:
                                    # Substitute the target variable with the current value in the element rule
                                    substituted_rule = self._substitute_variable_in_rule(element_rule, target_name, value)
                                    if substituted_rule:
                                        expanded_conditions.append(substituted_rule)
                                    else:
                                        logging.warning(f"any(GeneratorExp): Failed to substitute {target_name}={value} in element rule")
                                        expanded_conditions = None
                                        break

                                if expanded_conditions:
                                    logging.debug(f"any(GeneratorExp): Successfully expanded to {len(expanded_conditions)} conditions")
                                    if len(expanded_conditions) == 0:
                                        # Empty iterator - any() of empty is False
                                        return {'type': 'constant', 'value': False}
                                    elif len(expanded_conditions) == 1:
                                        return expanded_conditions[0]
                                    else:
                                        return {'type': 'or', 'conditions': expanded_conditions}

                # If we couldn't resolve, represent this as a specific 'any_of' rule type
                # For nested generator expressions, recursively convert inner generators to any_of
                element_rule = gen_exp['element']
                if element_rule.get('type') == 'generator_expression':
                    # Recursively convert nested generator_expression to any_of
                    element_rule = self._convert_generator_exp_to_any_of(element_rule)
                    logging.debug(f"any(GeneratorExp): Converted nested generator_expression to any_of")

                result = {
                    'type': 'any_of',
                    'element_rule': element_rule,
                    'iterator_info': iterator_info
                }
                logging.debug(f"Created 'any_of' result: {result}")
                return result
            # *** END any() HANDLING ***

            # *** Special handling for sum(GeneratorExp) or sum(ListComp) ***
            if func_name == 'sum' and len(filtered_args) >= 1:
                first_arg = filtered_args[0]
                # Handle both generator expressions and list types (which may contain expanded comprehension results)
                if first_arg.get('type') == 'generator_expression':
                    logging.debug(f"Detected sum(GeneratorExp) pattern.")
                    gen_exp = first_arg

                    # Try to resolve the iterator if it's a name reference
                    iterator_info = gen_exp['comprehension']
                    iterator_type = iterator_info.get('iterator', {}).get('type')

                    # Try to expand the comprehension if we can resolve the iterator
                    if iterator_type == 'name':
                        iterator_name = iterator_info['iterator']['name']
                        logging.debug(f"sum(GeneratorExp): Attempting to resolve iterator '{iterator_name}'")

                        resolved_value = self.expression_resolver.resolve_variable(iterator_name)

                        # Convert frozensets/sets/tuples to lists for uniform handling
                        if resolved_value is not None:
                            if isinstance(resolved_value, (frozenset, set, tuple)):
                                resolved_value = list(resolved_value)
                                logging.debug(f"sum(GeneratorExp): Converted {type(resolved_value).__name__} to list")

                        if resolved_value is not None and isinstance(resolved_value, list):
                            logging.debug(f"sum(GeneratorExp): Resolved '{iterator_name}' to list with {len(resolved_value)} items")

                            # Handle simple values - expand the comprehension
                            target_name = iterator_info.get('target', {}).get('name')
                            if target_name:
                                element_rule = gen_exp['element']
                                expanded_elements = []

                                for value in resolved_value:
                                    # Substitute the target variable with the current value in the element rule
                                    substituted_rule = self._substitute_variable_in_rule(element_rule, target_name, value)
                                    if substituted_rule:
                                        expanded_elements.append(substituted_rule)
                                    else:
                                        logging.warning(f"sum(GeneratorExp): Failed to substitute {target_name}={value} in element rule")
                                        expanded_elements = None
                                        break

                                if expanded_elements is not None:
                                    logging.debug(f"sum(GeneratorExp): Successfully expanded to {len(expanded_elements)} elements")
                                    if len(expanded_elements) == 0:
                                        # Empty iterator - sum() of empty is 0
                                        return {'type': 'constant', 'value': 0}
                                    elif len(expanded_elements) == 1:
                                        return expanded_elements[0]
                                    else:
                                        # Build a nested binary_op tree for addition
                                        result = expanded_elements[0]
                                        for elem in expanded_elements[1:]:
                                            result = {
                                                'type': 'binary_op',
                                                'left': result,
                                                'op': '+',
                                                'right': elem
                                            }
                                        return result

                    # If we couldn't expand, create a sum_of rule for runtime evaluation
                    element_rule = gen_exp['element']
                    result = {
                        'type': 'sum_of',
                        'element_rule': element_rule,
                        'iterator_info': iterator_info
                    }
                    logging.debug(f"Created 'sum_of' result: {result}")
                    return result

                # Handle sum() with a list argument (e.g., sum([1 for x in items if condition]))
                elif first_arg.get('type') == 'list':
                    list_elements = first_arg.get('value', [])
                    if list_elements:
                        logging.debug(f"Detected sum(list) with {len(list_elements)} elements")
                        # Build a nested binary_op tree for addition
                        result = list_elements[0]
                        for elem in list_elements[1:]:
                            result = {
                                'type': 'binary_op',
                                'left': result,
                                'op': '+',
                                'right': elem
                            }
                        return result
                    else:
                        return {'type': 'constant', 'value': 0}
            # *** END sum() HANDLING ***

            # *** Special handling for zip() function ***
            if func_name == 'zip':
                logging.debug(f"Detected zip() function call with {len(filtered_args)} args")
                processed_result = self.binary_op_processor.try_preprocess_zip(filtered_args)
                if processed_result is not None:
                    logging.debug(f"Pre-processed zip() to: {processed_result}")
                    return processed_result
                # If can't pre-process, fall through to regular helper handling

            # *** Special handling for len() function ***
            if func_name == 'len' and len(filtered_args) == 1:
                logging.debug(f"Detected len() function call")
                processed_result = self.binary_op_processor.try_preprocess_len(filtered_args[0])
                if processed_result is not None:
                    logging.debug(f"Pre-processed len() to: {processed_result}")
                    return processed_result
                # If can't pre-process, fall through to regular helper handling

            # *** Special handling for min() function ***
            # min(a, b, c) - multiple arguments
            # min(iterable) - single iterable argument
            if func_name == 'min' and len(filtered_args) >= 1:
                logging.debug(f"Detected min() function call with {len(filtered_args)} args")
                if len(filtered_args) == 1:
                    # Single argument - treat as iterable
                    result = {
                        'type': 'min',
                        'iterable': filtered_args[0]
                    }
                else:
                    # Multiple arguments - explicit values
                    result = {
                        'type': 'min',
                        'args': filtered_args
                    }
                logging.debug(f"Created min result: {result}")
                return result

            # *** Special handling for max() function ***
            # max(a, b, c) - multiple arguments
            # max(iterable) - single iterable argument
            if func_name == 'max' and len(filtered_args) >= 1:
                logging.debug(f"Detected max() function call with {len(filtered_args)} args")
                if len(filtered_args) == 1:
                    # Single argument - treat as iterable
                    result = {
                        'type': 'max',
                        'iterable': filtered_args[0]
                    }
                else:
                    # Multiple arguments - explicit values
                    result = {
                        'type': 'max',
                        'args': filtered_args
                    }
                logging.debug(f"Created max result: {result}")
                return result

            # *** Special handling for sum() function ***
            # sum() typically takes an iterable as its first argument
            # sum([1, 2, 3]) or sum(generator_expr) or sum([...], start_value)
            if func_name == 'sum' and len(filtered_args) >= 1:
                logging.debug(f"Detected sum() function call with {len(filtered_args)} args")
                result = {
                    'type': 'sum',
                    'iterable': filtered_args[0]
                }
                # Optional start value (second argument)
                if len(filtered_args) >= 2:
                    result['start'] = filtered_args[1]
                logging.debug(f"Created sum result: {result}")
                return result

            # *** Special handling for map() function ***
            # map(func, iterable) applies func to each element of iterable
            if func_name == 'map' and len(filtered_args) >= 2:
                logging.debug(f"Detected map() function call with {len(filtered_args)} args")
                func_arg = filtered_args[0]
                iterable_arg = filtered_args[1]
                result = {
                    'type': 'map',
                    'function': func_arg,
                    'iterable': iterable_arg
                }
                logging.debug(f"Created map result: {result}")
                return result

            # Create helper result with filtered args (no state/player in JSON)
            result = {
                'type': 'helper',
                'name': func_name,
                'args': filtered_args
            }
            logging.debug(f"Created helper result: {result}")
            # Register for automatic discovery
            self._register_helper_usage(func_name)
            return result # Return helper result

        # 2. State method call (e.g., state.has)
        elif (func_info and func_info.get('type') == 'attribute' and
              func_info['object'].get('type') == 'name' and func_info['object'].get('name') == 'state'):
                method = func_info['attr']
                logging.debug(f"Processing state method: {method}")

                # Filter out state/player for final result
                filtered_args = self._filter_special_args(args_with_nodes)

                # Resolve variable references in arguments (e.g., lambda defaults)
                # This is needed for methods like has_from_list that use lambda with defaults
                resolved_args = []
                for arg in filtered_args:
                    if arg and arg.get('type') == 'name':
                        # Try to resolve the variable
                        resolved_value = self.expression_resolver.resolve_variable(arg['name'])
                        if resolved_value is not None and is_simple_value(resolved_value):
                            # Only create constant for simple values
                            # Handle enum values - extract the numeric value
                            if hasattr(resolved_value, 'value'):
                                final_value = resolved_value.value
                            else:
                                final_value = resolved_value
                            # Ensure the final value is JSON-serializable
                            final_value = make_json_serializable(final_value)
                            logging.debug(f"Resolved state method argument variable '{arg['name']}' to {final_value}")
                            resolved_args.append({'type': 'constant', 'value': final_value})
                        # Handle Region objects - extract the .name attribute
                        elif resolved_value is not None and hasattr(resolved_value, 'name') and hasattr(resolved_value, 'entrances'):
                            region_name = resolved_value.name
                            logging.debug(f"Resolved state method argument variable '{arg['name']}' (Region object) to region name: {region_name}")
                            resolved_args.append({'type': 'constant', 'value': region_name})
                        else:
                            # Keep unresolved or complex objects as name references
                            resolved_args.append(arg)
                    elif arg and arg.get('type') == 'binary_op':
                        # Try to resolve binary operations like i+1
                        resolved_value = self.expression_resolver.resolve_expression(arg)
                        if resolved_value is not None and is_simple_value(resolved_value):
                            # Only create constant for simple values
                            # Ensure the resolved value is JSON-serializable
                            resolved_value = make_json_serializable(resolved_value)
                            logging.debug(f"Resolved state method binary_op '{arg}' to {resolved_value}")
                            resolved_args.append({'type': 'constant', 'value': resolved_value})
                        else:
                            # Keep unresolved expression as-is
                            resolved_args.append(arg)
                    elif arg and arg.get('type') == 'attribute':
                        # Try to resolve attribute expressions like HatType.BREWING
                        resolved_value = self.expression_resolver.resolve_expression(arg)
                        if resolved_value is not None and is_simple_value(resolved_value):
                            # Only create constant for simple values
                            # Handle enum values - extract the numeric value
                            if hasattr(resolved_value, 'value'):
                                final_value = resolved_value.value
                            else:
                                final_value = resolved_value
                            # Ensure the final value is JSON-serializable
                            final_value = make_json_serializable(final_value)
                            logging.debug(f"Resolved state method argument attribute to {final_value}")
                            resolved_args.append({'type': 'constant', 'value': final_value})
                        else:
                            # Keep unresolved or complex objects as attribute references
                            resolved_args.append(arg)
                    elif arg and arg.get('type') == 'list':
                        # Recursively resolve list elements (e.g., [iname.double, iname.roc_wing])
                        list_elements = arg.get('value', [])
                        resolved_list = []
                        all_resolved = True

                        for element in list_elements:
                            if element and element.get('type') == 'attribute':
                                # Try to resolve the attribute
                                resolved_value = self.expression_resolver.resolve_expression(element)
                                if resolved_value is not None and is_simple_value(resolved_value):
                                    # Only add to list if it's a simple value
                                    # Handle enum values
                                    if hasattr(resolved_value, 'value'):
                                        final_value = resolved_value.value
                                    else:
                                        final_value = resolved_value
                                    # Ensure the value is JSON-serializable
                                    final_value = make_json_serializable(final_value)
                                    resolved_list.append(final_value)
                                else:
                                    # Could not resolve or complex object
                                    all_resolved = False
                                    break
                            elif element and element.get('type') == 'constant':
                                # Already a constant, just extract the value
                                resolved_list.append(element.get('value'))
                            elif element and element.get('type') == 'name':
                                # Try to resolve the name
                                resolved_value = self.expression_resolver.resolve_variable(element.get('name'))
                                if resolved_value is not None and is_simple_value(resolved_value):
                                    # Only add to list if it's a simple value
                                    if hasattr(resolved_value, 'value'):
                                        final_value = resolved_value.value
                                    else:
                                        final_value = resolved_value
                                    final_value = make_json_serializable(final_value)
                                    resolved_list.append(final_value)
                                else:
                                    # Could not resolve or complex object
                                    all_resolved = False
                                    break
                            else:
                                # Unknown element type
                                all_resolved = False
                                break

                        if all_resolved and len(resolved_list) == len(list_elements):
                            # Successfully resolved all elements
                            logging.debug(f"Resolved state method list argument to {resolved_list}")
                            resolved_args.append({'type': 'constant', 'value': resolved_list})
                        else:
                            # Could not resolve all elements, keep the list structure
                            logging.debug(f"Could not fully resolve list argument, keeping as-is")
                            resolved_args.append(arg)
                    else:
                        resolved_args.append(arg)

                filtered_args = resolved_args

                # For has_all, has_any, and has_all_counts, sort arguments for consistency
                # These methods are order-independent, so we can safely sort
                if method in ['has_all', 'has_any', 'has_all_counts'] and len(filtered_args) >= 1:
                    first_arg = filtered_args[0]
                    if first_arg and first_arg.get('type') == 'constant':
                        value = first_arg.get('value')
                        if isinstance(value, list) and all(isinstance(item, str) for item in value):
                            # Sort string lists for consistent ordering
                            sorted_value = sorted(value)
                            filtered_args[0] = {'type': 'constant', 'value': sorted_value}
                            logging.debug(f"Sorted {method} argument list: {sorted_value}")
                        elif isinstance(value, dict):
                            # Sort dictionary keys for consistent ordering
                            sorted_dict = {k: value[k] for k in sorted(value.keys())}
                            filtered_args[0] = {'type': 'constant', 'value': sorted_dict}
                            logging.debug(f"Sorted {method} argument dict keys: {list(sorted_dict.keys())}")

                # Simplify handling based on method name
                if method == 'has' and len(filtered_args) >= 1:
                    logging.debug(f"Processing state.has with {len(filtered_args)} filtered args: {filtered_args}")

                    # Try to resolve the item name expression to get the actual string value
                    first_arg = filtered_args[0]
                    item_value = first_arg
                    if isinstance(first_arg, dict):
                        # First, check if it's already a constant - unwrap it immediately
                        if first_arg.get('type') == 'constant':
                            if isinstance(first_arg.get('value'), str):
                                # Constant string - extract the value
                                item_value = first_arg.get('value')
                                logging.debug(f"Unwrapped constant item name: {first_arg} -> {item_value}")
                            else:
                                # Constant but not a string - keep as-is for further evaluation
                                item_value = first_arg
                                logging.debug(f"Non-string constant in item_check: {first_arg}")
                        else:
                            # Try to resolve the expression (e.g., ItemName.MasterForm -> "Master Form")
                            resolved_item = self.expression_resolver.resolve_expression(first_arg)
                            if resolved_item is not None and isinstance(resolved_item, str):
                                # Successfully resolved to a string value - use the string directly
                                logging.debug(f"Resolved item name: {first_arg} -> {resolved_item}")
                                item_value = resolved_item
                            else:
                                # Could not resolve to a constant value, keep as-is (rule object)
                                logging.debug(f"Could not resolve item name: {first_arg}")
                                item_value = first_arg

                    result = {'type': 'item_check', 'item': item_value}
                    # Check for count parameter (now in position 1 after filtering)
                    if len(filtered_args) >= 2:
                        second_arg = filtered_args[1]
                        if isinstance(second_arg, dict):
                            # Try to resolve the expression to a concrete value
                            resolved_value = self.expression_resolver.resolve_expression(second_arg)
                            if resolved_value is not None and isinstance(resolved_value, int):
                                # Successfully resolved to an integer value
                                logging.debug(f"Resolved count parameter: {second_arg} -> {resolved_value}")
                                result['count'] = {'type': 'constant', 'value': resolved_value}
                            elif second_arg.get('type') == 'constant' and isinstance(second_arg.get('value'), int):
                                # Already a constant, use as-is
                                logging.debug(f"Found constant count parameter: {second_arg}")
                                result['count'] = second_arg
                            else:
                                # Could not resolve to a constant value, keep as-is
                                logging.debug(f"Found unresolved count parameter: {second_arg}")
                                result['count'] = second_arg
                elif method == 'has_group' and len(filtered_args) >= 1:
                    # Unwrap group name if it's a constant
                    group_arg = filtered_args[0]
                    if isinstance(group_arg, dict) and group_arg.get('type') == 'constant' and isinstance(group_arg.get('value'), str):
                        group_value = group_arg.get('value')
                    elif isinstance(group_arg, str):
                        group_value = group_arg
                    else:
                        group_value = group_arg
                    result = {'type': 'group_check', 'group': group_value}
                    # Check for count parameter (now in position 1 after filtering)
                    if len(filtered_args) >= 2:
                        second_arg = filtered_args[1]
                        if isinstance(second_arg, dict):
                            # Try to resolve the expression to a concrete value
                            resolved_value = self.expression_resolver.resolve_expression(second_arg)
                            if resolved_value is not None and isinstance(resolved_value, int):
                                # Successfully resolved to an integer value
                                logging.debug(f"Resolved group count parameter: {second_arg} -> {resolved_value}")
                                result['count'] = {'type': 'constant', 'value': resolved_value}
                            elif second_arg.get('type') == 'constant' and isinstance(second_arg.get('value'), int):
                                # Already a constant, use as-is
                                logging.debug(f"Found constant group count parameter: {second_arg}")
                                result['count'] = second_arg
                            else:
                                # Could not resolve to a constant value, keep as-is
                                logging.debug(f"Found unresolved group count parameter: {second_arg}")
                                result['count'] = second_arg
                elif method == 'count_group' and len(filtered_args) >= 1:
                    # state.count_group(group_name, player) -> returns the count of items in a group
                    # Unwrap group name if it's a constant
                    group_arg = filtered_args[0]
                    if isinstance(group_arg, dict) and group_arg.get('type') == 'constant' and isinstance(group_arg.get('value'), str):
                        group_value = group_arg.get('value')
                    elif isinstance(group_arg, str):
                        group_value = group_arg
                    else:
                        group_value = group_arg
                    # Create a group_count rule that returns the count (not a boolean check)
                    result = {'type': 'group_count', 'group': group_value}
                    logging.debug(f"Converted count_group to group_count: {result}")
                elif method == 'has_any' and len(filtered_args) >= 1 and isinstance(filtered_args[0], list):
                    # Unwrap each item if it's a constant
                    items = []
                    for item in filtered_args[0]:
                        if isinstance(item, dict) and item.get('type') == 'constant' and isinstance(item.get('value'), str):
                            items.append(item.get('value'))
                        elif isinstance(item, str):
                            items.append(item)
                        else:
                            items.append(item)
                    result = {'type': 'or', 'conditions': [{'type': 'item_check', 'item': item} for item in items]}
                elif method == '_lttp_has_key' and len(filtered_args) >= 1:
                    # Unwrap item name if it's a constant
                    item_arg = filtered_args[0]
                    if isinstance(item_arg, dict) and item_arg.get('type') == 'constant' and isinstance(item_arg.get('value'), str):
                        item_value = item_arg.get('value')
                    elif isinstance(item_arg, str):
                        item_value = item_arg
                    else:
                        item_value = item_arg
                    # Count is now in position 1 after player is filtered
                    count = filtered_args[1] if len(filtered_args) >= 2 else {'type': 'constant', 'value': 1}
                    result = {'type': 'count_check', 'item': item_value, 'count': count}
                # Add other state methods like can_reach if needed
                # elif method == 'can_reach': ...
                else:
                    # Default for unhandled state methods
                    result = {'type': 'state_method', 'method': method, 'args': filtered_args}

                logging.debug(f"State method result: {result}")
                return result # Return state method result

        # 2.5. Attribute-based method calls (self.method, logic.method)
        elif func_info and func_info.get('type') == 'attribute':
            obj_name = func_info['object'].get('name') if func_info['object'].get('type') == 'name' else None
            method_name = func_info['attr']

            # Handle self.method calls (e.g., self.has_boss_strength)
            if obj_name == 'self':
                logging.debug(f"Processing self method call: {method_name}")

                # Filter out state/player arguments
                filtered_args = self._filter_special_args(args_with_nodes)

                # Create helper result with the captured arguments
                # DO NOT recursively analyze - we want to capture the call AS IS with its arguments
                result = {
                    'type': 'helper',
                    'name': method_name,
                    'args': filtered_args
                }
                logging.debug(f"Created helper result for self method: {result}")
                # Register for automatic discovery
                self._register_helper_usage(method_name)
                return result

            # Handle logic.method calls (e.g., logic.oaks_aide, logic.can_surf)
            elif obj_name == 'logic':
                logging.debug(f"Processing logic method call: {method_name}")

                # Filter out state/world/player arguments
                filtered_args = self._filter_special_args(args_with_nodes)

                # Resolve variable references in arguments (e.g., world.options.value expressions)
                resolved_args = []
                for arg in filtered_args:
                    if arg and arg.get('type') == 'binary_op':
                        # Try to resolve binary operations like world.options.oaks_aide_rt_11.value + 5
                        resolved_value = self.expression_resolver.resolve_expression(arg)
                        if resolved_value is not None and is_simple_value(resolved_value):
                            # Ensure the resolved value is JSON-serializable
                            resolved_value = make_json_serializable(resolved_value)
                            logging.debug(f"Resolved logic method binary_op to {resolved_value}")
                            resolved_args.append({'type': 'constant', 'value': resolved_value})
                        else:
                            # Keep unresolved expression as-is
                            resolved_args.append(arg)
                    elif arg and arg.get('type') == 'attribute':
                        # Try to resolve attribute expressions like world.options.some_option.value
                        resolved_value = self.expression_resolver.resolve_expression(arg)
                        if resolved_value is not None and is_simple_value(resolved_value):
                            # Handle enum values - extract the numeric value
                            if hasattr(resolved_value, 'value'):
                                final_value = resolved_value.value
                            else:
                                final_value = resolved_value
                            # Ensure the final value is JSON-serializable
                            final_value = make_json_serializable(final_value)
                            logging.debug(f"Resolved logic method argument attribute to {final_value}")
                            resolved_args.append({'type': 'constant', 'value': final_value})
                        else:
                            # Keep unresolved or complex objects as attribute references
                            resolved_args.append(arg)
                    elif arg and arg.get('type') == 'name':
                        # Try to resolve the variable (but skip 'world' which should already be filtered)
                        if arg['name'] == 'world':
                            logging.debug(f"Skipping resolution of 'world' argument in logic call")
                            continue
                        resolved_value = self.expression_resolver.resolve_variable(arg['name'])
                        if resolved_value is not None and is_simple_value(resolved_value):
                            # Handle enum values - extract the numeric value
                            if hasattr(resolved_value, 'value'):
                                final_value = resolved_value.value
                            else:
                                final_value = resolved_value
                            # Ensure the final value is JSON-serializable
                            final_value = make_json_serializable(final_value)
                            logging.debug(f"Resolved logic method argument variable '{arg['name']}' to {final_value}")
                            resolved_args.append({'type': 'constant', 'value': final_value})
                        else:
                            # Keep unresolved or complex objects as name references
                            resolved_args.append(arg)
                    else:
                        resolved_args.append(arg)

                filtered_args = resolved_args

                # Create helper result
                result = {
                    'type': 'helper',
                    'name': method_name,
                    'args': filtered_args
                }
                logging.debug(f"Created helper result for logic method: {result}")
                # Register for automatic discovery
                self._register_helper_usage(method_name)
                return result

            # Handle Location and Region object method calls (e.g., loc.can_reach(state) or region.can_reach(state))
            elif obj_name and method_name == 'can_reach':
                logging.debug(f"Processing potential Location/Region method call: {obj_name}.{method_name}")

                # Try to resolve the object from closure_vars
                resolved_obj = self.expression_resolver.resolve_variable(obj_name)

                # Check if we successfully resolved an object with a 'name' attribute
                if resolved_obj is not None and hasattr(resolved_obj, 'name') and isinstance(resolved_obj.name, str):
                    # Determine if it's a Region (has 'entrances') or Location (no 'entrances')
                    has_entrances = hasattr(resolved_obj, 'entrances')
                    obj_type = 'Region' if has_entrances else 'Location'
                    obj_name_value = resolved_obj.name

                    logging.debug(f"Resolved {obj_name} to {obj_type} object with name: {obj_name_value}")

                    # Convert [location|region].can_reach(state) to state.can_reach(name, type, player)
                    # Note: player argument will be provided by the state manager
                    result = {
                        'type': 'state_method',
                        'method': 'can_reach',
                        'args': [
                            {'type': 'constant', 'value': obj_name_value},
                            {'type': 'constant', 'value': obj_type}
                        ]
                    }
                    logging.debug(f"Converted {obj_type}.can_reach to state_method: {result}")
                    return result
                else:
                    logging.debug(f"Could not resolve {obj_name} for can_reach call, falling through to other handlers")

            # Handle list method calls (e.g., buildings.index("Stacker"))
            # When the object is a constant list, evaluate the method at analysis time
            elif func_info['object'].get('type') == 'constant' and isinstance(func_info['object'].get('value'), list):
                list_value = func_info['object']['value']
                logging.debug(f"Processing list method call: list.{method_name} on {list_value}")

                if method_name == 'index' and len(args) >= 1:
                    # Evaluate list.index(value) at analysis time
                    search_arg = args[0]
                    if search_arg.get('type') == 'constant':
                        search_value = search_arg['value']
                        try:
                            index_result = list_value.index(search_value)
                            logging.debug(f"Evaluated list.index({search_value}) = {index_result}")
                            return {'type': 'constant', 'value': index_result}
                        except ValueError:
                            logging.debug(f"list.index({search_value}) raised ValueError - value not in list")
                            # Return -1 for not found (Python raises ValueError, but -1 is more useful)
                            return {'type': 'constant', 'value': -1}
                    else:
                        logging.debug(f"list.index argument is not a constant, keeping as method_call")

                # For other list methods or when we can't evaluate, create a method_call structure
                result = {
                    'type': 'method_call',
                    'object': func_info['object'],
                    'method': method_name,
                    'args': args
                }
                logging.debug(f"Created method_call result: {result}")
                return result

            # Handle module-based helper calls (e.g., StateLogic.canDig, Rules.method)
            # These are calls to functions from imported modules that should be treated as helpers
            else:
                # Check if this is a module name that contains helper functions
                # Common patterns: StateLogic, Rules, Logic (capitalized module names)
                if obj_name and (obj_name.endswith('Logic') or obj_name == 'Rules'):
                    logging.debug(f"Processing module-based helper call: {obj_name}.{method_name}")

                    # Filter out state/world/player arguments
                    filtered_args = self._filter_special_args(args_with_nodes)

                    # Resolve variable references in arguments
                    resolved_args = []
                    for arg in filtered_args:
                        if arg and arg.get('type') == 'name':
                            if arg['name'] == 'world':
                                logging.debug(f"Skipping resolution of 'world' argument in module call")
                                continue
                            resolved_value = self.expression_resolver.resolve_variable(arg['name'])
                            if resolved_value is not None and is_simple_value(resolved_value):
                                if hasattr(resolved_value, 'value'):
                                    final_value = resolved_value.value
                                else:
                                    final_value = resolved_value
                                final_value = make_json_serializable(final_value)
                                logging.debug(f"Resolved module helper argument variable '{arg['name']}' to {final_value}")
                                resolved_args.append({'type': 'constant', 'value': final_value})
                            # Handle Region objects - extract the .name attribute
                            elif resolved_value is not None and hasattr(resolved_value, 'name') and hasattr(resolved_value, 'entrances'):
                                region_name = resolved_value.name
                                logging.debug(f"Resolved module helper argument variable '{arg['name']}' (Region object) to region name: {region_name}")
                                resolved_args.append({'type': 'constant', 'value': region_name})
                            else:
                                resolved_args.append(arg)
                        elif arg and arg.get('type') == 'attribute':
                            resolved_value = self.expression_resolver.resolve_expression(arg)
                            if resolved_value is not None and is_simple_value(resolved_value):
                                if hasattr(resolved_value, 'value'):
                                    final_value = resolved_value.value
                                else:
                                    final_value = resolved_value
                                final_value = make_json_serializable(final_value)
                                logging.debug(f"Resolved module helper argument attribute to {final_value}")
                                resolved_args.append({'type': 'constant', 'value': final_value})
                            else:
                                resolved_args.append(arg)
                        else:
                            resolved_args.append(arg)

                    filtered_args = resolved_args

                    # Create helper result
                    result = {
                        'type': 'helper',
                        'name': method_name,
                        'args': filtered_args
                    }
                    logging.debug(f"Created helper result for module method: {result}")
                    # Register for automatic discovery
                    self._register_helper_usage(method_name)
                    return result

        # 3. Fallback for other types of calls (e.g., calling result of another function)
        logging.debug(f"Fallback function call type. func_info = {func_info}")
        filtered_args = self._filter_special_args(args_with_nodes)
        result = {
            'type': 'function_call',
            'function': func_info,
            'args': filtered_args
        }
        logging.debug(f"Fallback call result: {result}")
        return result # Return generic function call result

    def _is_world_player_subscript(self, node):
        """
        Check if node is the pattern: state.multiworld.worlds[player]
        Also matches self.multiworld.worlds[player] for class-based helpers (e.g., RaftLogic).
        Returns True if matched, False otherwise.

        AST structure:
        Subscript
          value=Attribute(attr='worlds')
            value=Attribute(attr='multiworld')
              value=Name(id='state', 'world', or 'self')
          slice=Name(id='player')
        """
        if not isinstance(node, ast.Subscript):
            return False
        if not isinstance(node.slice, ast.Name) or node.slice.id != 'player':
            return False

        # Check .worlds
        worlds_attr = node.value
        if not isinstance(worlds_attr, ast.Attribute) or worlds_attr.attr != 'worlds':
            return False

        # Check .multiworld
        multiworld_attr = worlds_attr.value
        if not isinstance(multiworld_attr, ast.Attribute) or multiworld_attr.attr != 'multiworld':
            return False

        # Check state (or world, or self for class-based helpers like RaftLogic)
        state_name = multiworld_attr.value
        if not isinstance(state_name, ast.Name) or state_name.id not in ('state', 'world', 'self'):
            return False

        return True

    def _is_world_options_pattern(self, node):
        """
        Detect patterns accessing world settings/attributes:
        - state.multiworld.worlds[player].options.<setting>
        - state.multiworld.worlds[player].<attr>
        - state.multiworld.worlds[player].<attr1>.<attr2> (nested like difficulty_requirements.progressive_bottle_limit)
        - self.world.options.<setting> (class-based helpers like KH2)
        - world.options.<setting> (world as function parameter, like Paint helpers)
        - self.multiworld.worlds[player].options.<setting> (class-based helpers like RaftLogic)

        Returns the setting path as a dot-separated string if matched, None otherwise.

        IMPORTANT: Does NOT match patterns ending with .value (e.g., self.world.options.X.value)
        Those should be resolved by closure_vars to get the actual integer value.
        """
        if not isinstance(node, ast.Attribute):
            return None

        # Collect attribute chain from bottom up
        attrs = [node.attr]
        current = node.value

        # Walk up the attribute chain until we hit the worlds[player] subscript or self.world
        while isinstance(current, ast.Attribute):
            attrs.append(current.attr)
            current = current.value

        # Reverse to get top-down order
        attrs.reverse()

        # Check if we've reached the world player subscript (state.multiworld.worlds[player])
        if self._is_world_player_subscript(current):
            # Handle different patterns:
            # - ['options', 'setting_name'] -> 'setting_name'
            # - ['attr_name'] -> 'attr_name'
            # - ['difficulty_requirements', 'progressive_bottle_limit'] -> 'difficulty_requirements.progressive_bottle_limit'
            if attrs[0] == 'options' and len(attrs) >= 2:
                # Remove 'options' prefix for .options.<setting> pattern
                return '.'.join(attrs[1:])
            else:
                # Direct attribute or nested attribute
                return '.'.join(attrs)

        # Check for self.world.options.<setting> pattern
        # This handles class-based helpers like KH2's level_locking_unlock
        # AST: self.world.options.Promise_Charm
        # attrs would be: ['world', 'options', 'Promise_Charm']
        # current would be: Name(id='self')
        #
        # IMPORTANT: Do NOT match if the pattern ends with '.value'
        # e.g., self.world.options.LuckyEmblemsRequired.value should NOT match
        # because the .value accessor should be resolved via closure_vars to get
        # the actual integer value, not create a setting_value lookup.
        if isinstance(current, ast.Name) and current.id == 'self':
            # Check for self.world.options.<setting> pattern
            if len(attrs) >= 3 and attrs[0] == 'world' and attrs[1] == 'options':
                # Do NOT match if pattern ends with .value - let closure_vars resolve it
                if attrs[-1] == 'value':
                    return None
                # Return the setting name (everything after 'options')
                return '.'.join(attrs[2:])

        # Check for world.options.<setting> pattern (world as function parameter)
        # This handles helpers like Paint's calculate_paint_percent_available
        # which take 'world' as a parameter and access world.options.<setting>
        # AST: world.options.canvas_size_increment
        # attrs would be: ['options', 'canvas_size_increment']
        # current would be: Name(id='world')
        if isinstance(current, ast.Name) and current.id == 'world':
            if len(attrs) >= 2 and attrs[0] == 'options':
                # Do NOT match if pattern ends with .value - let closure_vars resolve it
                if attrs[-1] == 'value':
                    return None
                # Return the setting name (everything after 'options')
                return '.'.join(attrs[1:])

        return None

    def _is_world_attribute_subscript_pattern(self, node):
        """
        Detect the pattern: state.multiworld.worlds[player].<attr>[index]
        Returns (attr_name, index) tuple if matched, (None, None) otherwise.

        This handles patterns like:
        - state.multiworld.worlds[player].required_medallions[0]
        - state.multiworld.worlds[player].some_array[1]

        AST structure:
        Subscript(slice=Constant(N))
          value=Attribute(attr='<attr_name>')
            value=Subscript
              value=Attribute(attr='worlds')
                value=Attribute(attr='multiworld')
                  value=Name(id='state')
              slice=Name(id='player')
        """
        if not isinstance(node, ast.Subscript):
            return None, None

        # Get the index
        index_val = None
        if isinstance(node.slice, ast.Constant):
            index_val = node.slice.value
        elif isinstance(node.slice, ast.Num):  # Python 3.7 compatibility
            index_val = node.slice.n
        else:
            return None, None

        # Check that the value being subscripted is an attribute
        if not isinstance(node.value, ast.Attribute):
            return None, None

        attr_name = node.value.attr

        # Check [player] subscript on worlds
        subscript = node.value.value
        if not isinstance(subscript, ast.Subscript):
            return None, None
        if not isinstance(subscript.slice, ast.Name) or subscript.slice.id != 'player':
            return None, None

        # Check .worlds
        worlds_attr = subscript.value
        if not isinstance(worlds_attr, ast.Attribute) or worlds_attr.attr != 'worlds':
            return None, None

        # Check .multiworld
        multiworld_attr = worlds_attr.value
        if not isinstance(multiworld_attr, ast.Attribute) or multiworld_attr.attr != 'multiworld':
            return None, None

        # Check state (or world)
        state_name = multiworld_attr.value
        if not isinstance(state_name, ast.Name) or state_name.id not in ('state', 'world'):
            return None, None

        return attr_name, index_val

    def _is_prog_items_pattern(self, node):
        """
        Detect the pattern: state.prog_items[player][key]
        Returns the key (e.g., " coins") if matched, None otherwise.

        This handles DLCQuest and other games that use accumulator items
        stored in state.prog_items.

        AST structure:
        Subscript(slice=Constant(" coins"))  <- outer node
          value=Subscript(slice=Name("player"))
            value=Attribute(attr='prog_items')
              value=Name(id='state')
        """
        if not isinstance(node, ast.Subscript):
            return None

        # Get the key from the outer subscript slice
        key = None
        if isinstance(node.slice, ast.Constant):
            key = node.slice.value
        elif isinstance(node.slice, ast.Str):  # Python 3.7 compatibility
            key = node.slice.s
        else:
            return None

        # Check inner subscript: [player]
        inner_subscript = node.value
        if not isinstance(inner_subscript, ast.Subscript):
            return None
        if not isinstance(inner_subscript.slice, ast.Name) or inner_subscript.slice.id != 'player':
            return None

        # Check attribute: .prog_items
        prog_items_attr = inner_subscript.value
        if not isinstance(prog_items_attr, ast.Attribute) or prog_items_attr.attr != 'prog_items':
            return None

        # Check name: state
        state_name = prog_items_attr.value
        if not isinstance(state_name, ast.Name) or state_name.id != 'state':
            return None

        return key

    def _is_multiworld_get_region_call(self, node):
        """
        Detect the pattern: state.multiworld.get_region('Region Name', player)
        Returns the region name if matched, None otherwise.

        AST structure:
        Call
          func=Attribute(attr='get_region')
            value=Attribute(attr='multiworld')
              value=Name(id='state')
          args=[Constant('Region Name'), Name(id='player')]
        """
        if not isinstance(node, ast.Call):
            return None

        # Check func is an attribute access
        func = node.func
        if not isinstance(func, ast.Attribute) or func.attr != 'get_region':
            return None

        # Check the object is state.multiworld
        multiworld_attr = func.value
        if not isinstance(multiworld_attr, ast.Attribute) or multiworld_attr.attr != 'multiworld':
            return None

        # Check it's accessing 'state' or 'world'
        state_name = multiworld_attr.value
        if not isinstance(state_name, ast.Name) or state_name.id not in ('state', 'world'):
            return None

        # Get the region name from the first argument
        if len(node.args) < 1:
            return None

        first_arg = node.args[0]
        if isinstance(first_arg, ast.Constant):
            return first_arg.value
        elif isinstance(first_arg, ast.Str):  # Python 3.7 compatibility
            return first_arg.s

        return None

    def _is_region_parameter_attribute(self, node, region_param_names=None):
        """
        Detect access to region parameter attributes like region.is_light_world.

        This is used when a helper function takes a region as a parameter
        and accesses its attributes within the function body.

        Args:
            node: The AST Attribute node
            region_param_names: Set of parameter names that are known to be regions
                              (e.g., {'region', 'cave'})

        Returns:
            Tuple of (param_name, attr_name) if matched, (None, None) otherwise.
        """
        if not isinstance(node, ast.Attribute):
            return None, None

        attr_name = node.attr

        # Only handle known region attributes
        if attr_name not in ('is_light_world', 'is_dark_world', 'name'):
            return None, None

        # Check if the object is a Name node (variable reference)
        if not isinstance(node.value, ast.Name):
            return None, None

        param_name = node.value.id

        # If we have a list of known region parameters, check against it
        if region_param_names is not None:
            if param_name not in region_param_names:
                return None, None
        else:
            # Default known region parameter names
            if param_name not in ('region', 'cave', 'r', 'reg'):
                return None, None

        return param_name, attr_name

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
                        setting_name = setting_mapping[attr_name]
                        logging.debug(f"visit_Attribute: Detected self.{attr_name}, converting to setting_value '{setting_name}'")
                        return {'type': 'setting_value', 'setting': setting_name}

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
                            list_value = list(resolved_attr) if isinstance(resolved_attr, tuple) else resolved_attr
                            logging.debug(f"visit_Attribute: Direct resolution of {var_name}.{attr_name} to list: {list_value}")
                            return {'type': 'constant', 'value': list_value}
                        elif isinstance(resolved_attr, dict):
                            # Handle dict values - keep as dict for subscript access
                            # The frontend's subscript handler can index into plain objects
                            # For iteration (for_iter), the frontend will iterate over keys
                            logging.debug(f"visit_Attribute: Direct resolution of {var_name}.{attr_name} (dict) keeping as dict with {len(resolved_attr)} entries")
                            return {'type': 'constant', 'value': resolved_attr}
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
            obj_result = self.visit(node.value) # Get returned result

            if obj_result:
                 # Try to resolve the attribute access to a constant value
                 attr_structure = {'type': 'attribute', 'object': obj_result, 'attr': attr_name}
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
                            from .analysis import analyze_rule
                            # Analyze the function to get its rule structure
                            analyzed_result = analyze_rule(
                                rule_func=subscript_result,
                                closure_vars=self.closure_vars,
                                seen_funcs=self.seen_funcs,
                                game_handler=self.game_handler,
                                player_context=self.player_context
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
                                from .analysis import analyze_rule
                                analyzed_items = []
                                for idx, item_func in enumerate(subscript_result):
                                    try:
                                        item_result = analyze_rule(
                                            rule_func=item_func,
                                            closure_vars=self.closure_vars.copy(),
                                            seen_funcs=self.seen_funcs,
                                            game_handler=self.game_handler,
                                            player_context=self.player_context
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

    def visit_UnaryOp(self, node: ast.UnaryOp):
        """ Handle unary operations (e.g., not). """
        try:
            op_name = type(node.op).__name__.lower()
            logging.debug(f"\n--- visit_UnaryOp: op={op_name} ---")

            operand_result = self.visit(node.operand)
            if operand_result is None:
                logging.error(f"Failed to analyze operand for UnaryOp: {ast.dump(node.operand)}")
                return None

            # Try to resolve the operand if it's an attribute expression
            if operand_result.get('type') == 'attribute':
                resolved_value = self.expression_resolver.resolve_expression(operand_result)
                if resolved_value is not None and is_simple_value(resolved_value):
                    # Handle enum values - extract the numeric/boolean value
                    if hasattr(resolved_value, 'value'):
                        final_value = resolved_value.value
                    else:
                        final_value = resolved_value
                    # Ensure the final value is JSON-serializable
                    final_value = make_json_serializable(final_value)
                    logging.debug(f"Resolved UnaryOp operand attribute to constant: {final_value}")
                    operand_result = {'type': 'constant', 'value': final_value}

            # Handle specific unary operators
            if isinstance(node.op, ast.Not):
                # If operand is a constant, evaluate the not operation now
                if operand_result.get('type') == 'constant':
                    constant_value = operand_result['value']
                    result_value = not constant_value
                    logging.debug(f"Evaluated not {constant_value} = {result_value}")
                    return {'type': 'constant', 'value': result_value}
                else:
                    return {'type': 'not', 'condition': operand_result}
            elif isinstance(node.op, ast.USub):
                # Unary minus (e.g., -1, -x)
                if operand_result.get('type') == 'constant':
                    constant_value = operand_result['value']
                    if isinstance(constant_value, (int, float)):
                        result_value = -constant_value
                        logging.debug(f"Evaluated -{constant_value} = {result_value}")
                        return {'type': 'constant', 'value': result_value}
                # For non-constant operands, return a negation structure
                return {'type': 'negate', 'operand': operand_result}
            elif isinstance(node.op, ast.UAdd):
                # Unary plus (e.g., +1, +x) - essentially a no-op for constants
                if operand_result.get('type') == 'constant':
                    constant_value = operand_result['value']
                    if isinstance(constant_value, (int, float)):
                        logging.debug(f"Evaluated +{constant_value} = {constant_value}")
                        return {'type': 'constant', 'value': constant_value}
                # For non-constant operands, just return the operand as-is
                return operand_result
            else:
                logging.error(f"Unhandled unary operator: {op_name}")
                return None # Or a generic representation

        except Exception as e:
            logging.error("Error in visit_UnaryOp", e)
            return None

    def visit_Compare(self, node: ast.Compare):
        """ Handle comparison operations (e.g., ==, !=, in, not in, is, is not). """
        try:
            logging.debug(f"\n--- visit_Compare ---")
            if len(node.ops) != 1 or len(node.comparators) != 1:
                # For now, only support simple comparisons like `a op b`
                logging.error(f"Unsupported chained comparison: {ast.dump(node)}")
                return None

            left_result = self.visit(node.left)
            op_name = type(node.ops[0]).__name__.lower() # e.g., 'eq', 'in', 'is'
            right_result = self.visit(node.comparators[0])

            if left_result is None or right_result is None:
                logging.error(f"Failed to analyze left or right side of comparison: {ast.dump(node)}")
                return None

            # Map AST operator names to a simpler representation if desired
            op_map = {
                'eq': '==', 'noteq': '!=',
                'lt': '<', 'lte': '<=',
                'gt': '>', 'gte': '>=',
                'is': 'is', 'isnot': 'is not',
                'in': 'in', 'notin': 'not in'
            }
            op_symbol = op_map.get(op_name, op_name) # Use original name if not in map

            # Try constant folding - if both sides are constants, evaluate at export time
            folded_result = self._try_fold_comparison(left_result, op_symbol, right_result)
            if folded_result is not None:
                return folded_result

            return {
                'type': 'compare',
                'left': left_result,
                'op': op_symbol,
                'right': right_result
            }

        except Exception as e:
            logging.error("Error in visit_Compare", e)
            return None

    def _try_fold_comparison(self, left_result, op_symbol, right_result):
        """
        Try to fold a comparison at export time if both sides are constants.

        This handles cases like `early_useful == OPTIONS.buildings_3` where both
        values are known closure variables that can be resolved at export time.

        Args:
            left_result: The left operand result dict
            op_symbol: The comparison operator ('==', '!=', '<', '>', etc.)
            right_result: The right operand result dict

        Returns:
            A constant result dict if folding succeeded, None otherwise
        """
        try:
            # Check if both sides are constants
            if not (left_result and left_result.get('type') == 'constant' and
                    right_result and right_result.get('type') == 'constant'):
                return None

            left_val = left_result.get('value')
            right_val = right_result.get('value')

            # Evaluate the comparison based on the operator
            result = None
            if op_symbol == '==':
                result = left_val == right_val
            elif op_symbol == '!=':
                result = left_val != right_val
            elif op_symbol == '<':
                result = left_val < right_val
            elif op_symbol == '<=':
                result = left_val <= right_val
            elif op_symbol == '>':
                result = left_val > right_val
            elif op_symbol == '>=':
                result = left_val >= right_val
            elif op_symbol == 'in':
                # For 'in' operator, right side should be a collection
                if isinstance(right_val, (list, tuple, set, str)):
                    result = left_val in right_val
            elif op_symbol == 'not in':
                if isinstance(right_val, (list, tuple, set, str)):
                    result = left_val not in right_val
            elif op_symbol == 'is':
                result = left_val is right_val
            elif op_symbol == 'is not':
                result = left_val is not right_val

            if result is not None:
                logging.debug(f"Folded comparison: {left_val!r} {op_symbol} {right_val!r} = {result}")
                return {'type': 'constant', 'value': result}

            return None

        except (TypeError, ValueError) as e:
            # Comparison not possible (e.g., comparing incompatible types)
            logging.debug(f"Could not fold comparison: {e}")
            return None
        except Exception as e:
            logging.warning(f"Error during comparison folding: {e}")
            return None

    def visit_Tuple(self, node: ast.Tuple):
        """ Handle tuple literals. """
        try:
            logging.debug(f"\n--- visit_Tuple ---")
            elements = []
            for elt_node in node.elts:
                elt_result = self.visit(elt_node)
                if elt_result is None:
                    logging.error(f"Failed to analyze element in Tuple: {ast.dump(elt_node)}")
                    return None
                elements.append(elt_result)
            
            # Represent as a list in the output JSON
            return {'type': 'list', 'value': elements}
        except Exception as e:
            logging.error("Error in visit_Tuple", e)
            return None

    def visit_List(self, node: ast.List):
        """ Handle list literals. """
        try:
            logging.debug(f"\n--- visit_List ---")
            elements = []
            for elt_node in node.elts:
                elt_result = self.visit(elt_node)
                if elt_result is None:
                    logging.error(f"Failed to analyze element in List: {ast.dump(elt_node)}")
                    return None
                elements.append(elt_result)
            
            # Represent as a list in the output JSON
            return {'type': 'list', 'value': elements}
        except Exception as e:
            logging.error("Error in visit_List", e)
            return None

    def visit_Set(self, node: ast.Set):
        """ Handle set literals like {item1, item2} or {single_item}.

        Returns a 'set_literal' type that the rule engine can handle for
        mutation operations like .add() and eventual use in has_any().
        """
        try:
            logging.debug(f"\n--- visit_Set ---")
            elements = []
            for elt_node in node.elts:
                elt_result = self.visit(elt_node)
                if elt_result is None:
                    logging.error(f"Failed to analyze element in Set: {ast.dump(elt_node)}")
                    return None
                elements.append(elt_result)

            # Sort elements for consistent ordering (sets are unordered in Python)
            # Check if all elements are constants and sort them if so
            if all(e.get('type') == 'constant' for e in elements):
                elements.sort(key=lambda e: (str(type(e.get('value')).__name__), str(e.get('value'))))

            # Represent as a set type in the output JSON
            # This is used for set literals like {item1, item2} and helps track
            # that this originated from a Python set (e.g., for has_any checks)
            return {'type': 'set', 'elements': elements}
        except Exception as e:
            logging.error("Error in visit_Set", e)
            return None

    def visit_Dict(self, node: ast.Dict):
        """ Handle dictionary literals. """
        try:
            logging.debug(f"\n--- visit_Dict ---")
            dict_data = {}
            for key_node, value_node in zip(node.keys, node.values):
                # Handle None key (dict unpacking like **kwargs) - skip for now
                if key_node is None:
                    logging.warning("Skipping dict unpacking in visit_Dict")
                    continue

                key_result = self.visit(key_node)
                if key_result is None:
                    logging.error(f"Failed to analyze key in Dict: {ast.dump(key_node)}")
                    return None

                value_result = self.visit(value_node)
                if value_result is None:
                    logging.error(f"Failed to analyze value in Dict: {ast.dump(value_node)}")
                    return None

                # Extract the key value if it's a constant
                if key_result.get('type') == 'constant':
                    key = key_result['value']
                else:
                    # For non-constant keys, use the string representation
                    key = str(key_result)

                # For constant values, extract the value; otherwise keep the structure
                if value_result.get('type') == 'constant':
                    dict_data[key] = value_result['value']
                else:
                    dict_data[key] = value_result

            # Return dict as a constant with dict value for JSON serialization
            return {'type': 'constant', 'value': dict_data}
        except Exception as e:
            logging.error(f"Error in visit_Dict: {e}")
            return None

    def visit_GeneratorExp(self, node: ast.GeneratorExp):
        """ Handle generator expressions, including nested comprehensions.

        For nested comprehensions like:
            f(x, y) for x in A for y in B[x]

        This is semantically equivalent to:
            (f(x, y) for y in B[x]) for x in A

        We transform this into nested generator_expression structures where
        the inner generators become the element of outer generators.
        """
        try:
            logging.debug(f"\n--- visit_GeneratorExp --- (generators: {len(node.generators)})")

            # Analyze the element expression
            elt_result = self.visit(node.elt)
            if elt_result is None:
                logging.error(f"Failed to analyze element expression in GeneratorExp: {ast.dump(node.elt)}")
                return None

            # Handle single generator (simple case)
            if len(node.generators) == 1:
                comprehension_result = self.visit(node.generators[0])
                if comprehension_result is None:
                    logging.error(f"Failed to analyze comprehension in GeneratorExp")
                    return None

                return {
                    'type': 'generator_expression',
                    'element': elt_result,
                    'comprehension': comprehension_result
                }

            # Handle multiple generators (nested comprehensions)
            # Process from innermost (last) to outermost (first)
            # e.g., for "f(x,y) for x in A for y in B[x]":
            #   - Start with innermost: element=f(x,y), comprehension=for y in B[x]
            #   - Wrap with outer: element=inner_gen_exp, comprehension=for x in A
            logging.debug(f"Processing nested comprehension with {len(node.generators)} generators")

            # Analyze all comprehension generators first
            comprehension_results = []
            for i, gen in enumerate(node.generators):
                comp_result = self.visit(gen)
                if comp_result is None:
                    logging.error(f"Failed to analyze comprehension {i} in nested GeneratorExp")
                    return None
                comprehension_results.append(comp_result)
                logging.debug(f"  Generator {i}: target={comp_result.get('target')}, iterator type={comp_result.get('iterator', {}).get('type')}")

            # Build nested structure from inside out
            # Start with the innermost generator and the original element
            current_element = elt_result

            # Process generators in reverse order (innermost first)
            for i in range(len(comprehension_results) - 1, -1, -1):
                current_element = {
                    'type': 'generator_expression',
                    'element': current_element,
                    'comprehension': comprehension_results[i]
                }
                logging.debug(f"  Built nested level {len(comprehension_results) - i}: comprehension target={comprehension_results[i].get('target')}")

            # The outermost wrapper is our final result
            # But we need to unwrap one level since the loop creates one extra wrapper
            # Actually, let me reconsider - we want the structure to be:
            # gen_exp(element=gen_exp(element=f(x,y), comp=for y in B[x]), comp=for x in A)

            # The current_element after the loop IS the correctly nested structure
            logging.debug(f"Nested GeneratorExp complete: {len(node.generators)} levels")
            return current_element

        except Exception as e:
            logging.error(f"Error in visit_GeneratorExp: {e}")
            return None

    def visit_ListComp(self, node: ast.ListComp):
        """ Handle list comprehensions like [expr for x in items].

        List comprehensions are treated similarly to generator expressions
        for the purposes of analysis and can be used with sum(), all(), any(), etc.
        """
        try:
            logging.debug(f"\n--- visit_ListComp --- (generators: {len(node.generators)})")

            # Analyze the element expression
            elt_result = self.visit(node.elt)
            if elt_result is None:
                logging.error(f"Failed to analyze element expression in ListComp: {ast.dump(node.elt)}")
                return None

            # Handle single generator (simple case)
            if len(node.generators) == 1:
                comprehension_result = self.visit(node.generators[0])
                if comprehension_result is None:
                    logging.error(f"Failed to analyze comprehension in ListComp")
                    return None

                # Return as generator_expression type - for sum()/all()/any() handling,
                # list comprehensions and generator expressions are semantically equivalent
                return {
                    'type': 'generator_expression',
                    'element': elt_result,
                    'comprehension': comprehension_result
                }

            # Handle multiple generators (nested comprehensions)
            logging.debug(f"Processing nested list comprehension with {len(node.generators)} generators")

            # Analyze all comprehension generators first
            comprehension_results = []
            for i, gen in enumerate(node.generators):
                comp_result = self.visit(gen)
                if comp_result is None:
                    logging.error(f"Failed to analyze comprehension {i} in nested ListComp")
                    return None
                comprehension_results.append(comp_result)
                logging.debug(f"  Generator {i}: target={comp_result.get('target')}, iterator type={comp_result.get('iterator', {}).get('type')}")

            # Build nested structure from inside out
            current_element = elt_result

            # Process generators in reverse order (innermost first)
            for i in range(len(comprehension_results) - 1, -1, -1):
                current_element = {
                    'type': 'generator_expression',
                    'element': current_element,
                    'comprehension': comprehension_results[i]
                }

            logging.debug(f"Nested ListComp complete: {len(node.generators)} levels")
            return current_element

        except Exception as e:
            logging.error(f"Error in visit_ListComp: {e}")
            return None

    def visit_comprehension(self, node: ast.comprehension):
        """ Handle the 'for target in iter [if condition]' part of comprehensions/generators. """
        try:
            logging.debug(f"\n--- visit_comprehension ---")
            target_result = self.visit(node.target)
            iter_result = self.visit(node.iter)

            if target_result is None or iter_result is None:
                 logging.error(f"Failed to analyze target or iterator in comprehension")
                 return None

            # Handle if conditions (e.g., for x in y if z)
            conditions = []
            if node.ifs:
                for if_node in node.ifs:
                    condition_result = self.visit(if_node)
                    if condition_result is None:
                        logging.error(f"Failed to analyze if condition in comprehension: {ast.dump(if_node)}")
                        return None
                    conditions.append(condition_result)
                logging.debug(f"visit_comprehension: Found {len(conditions)} if condition(s)")

            # Return details needed to understand the iteration
            result = {
                'type': 'comprehension_details',
                'target': target_result,
                'iterator': iter_result
            }
            if conditions:
                # If there's a single condition, use it directly; otherwise combine with 'and'
                if len(conditions) == 1:
                    result['condition'] = conditions[0]
                else:
                    result['condition'] = {'type': 'and', 'conditions': conditions}
            return result
        except Exception as e:
            logging.error("Error in visit_comprehension", e)
            return None

    def generic_visit(self, node):
        """Override to add detailed logging for unexpected node types."""
        try:
            logging.debug(f"\n--- Generic Visit: {type(node).__name__} ---")
            logging.debug(f"Node details: {vars(node)}")
            super().generic_visit(node)
        except Exception as e:
            logging.error(f"Error in generic_visit for {type(node).__name__}: {e}")

    def visit_Assign(self, node: ast.Assign):
        """ Handle assignment statements. If the value is a lambda/rule, analyze it. """
        logging.debug(f"\n--- visit_Assign --- Targets: {len(node.targets)}, Value Type: {type(node.value).__name__}")
        # We are primarily interested in the value being assigned, as that often holds the rule lambda.
        # Visit the value node and return its result.
        value_result = self.visit(node.value)
        logging.debug(f"visit_Assign: Result from visiting value = {value_result}")
        return value_result # Return the result of analyzing the assigned value

    def visit_If(self, node: ast.If):
        """ Handle standard if statements. """
        try:
            logging.debug(f"\n--- visit_If ---")
            test_result = self.visit(node.test)

            # Check if we should process multiple statements in if-bodies
            should_process_multistatement = False
            if self.game_handler and hasattr(self.game_handler, 'should_process_multistatement_if_bodies'):
                should_process_multistatement = self.game_handler.should_process_multistatement_if_bodies()
                logging.debug(f"visit_If: should_process_multistatement_if_bodies = {should_process_multistatement}")

            # Process the if-body
            body_result = None
            if node.body:
                if should_process_multistatement and len(node.body) > 1:
                    # Multiple statements in the if-body: analyze them and combine them
                    logging.debug(f"visit_If: Processing {len(node.body)} statements in if-body")
                    body_results = []
                    for i, stmt in enumerate(node.body):
                        stmt_result = self.visit(stmt)
                        if stmt_result is not None:
                            # Simplify: if stmt_result is a conditional with if_true=true and if_false=null/false,
                            # extract just the test condition
                            if stmt_result.get('type') == 'conditional':
                                if_true = stmt_result.get('if_true')
                                if_false = stmt_result.get('if_false')

                                # Pattern: if condition: return True (no else) -> just use condition
                                if (if_true and if_true.get('type') == 'constant' and if_true.get('value') is True and
                                    (if_false is None or (if_false.get('type') == 'constant' and if_false.get('value') is False))):
                                    logging.debug(f"visit_If: Simplifying conditional {i}: extracting test condition")
                                    body_results.append(stmt_result.get('test'))
                                else:
                                    # Keep the full conditional
                                    body_results.append(stmt_result)
                            elif isinstance(stmt, ast.Return) and stmt.value:
                                # Direct return statement
                                inner_result = self.visit(stmt.value)
                                if inner_result and inner_result.get('type') != 'constant':
                                    body_results.append(inner_result)

                    # Combine multiple conditions with OR logic
                    # If any condition is true, the whole body evaluates to true
                    if len(body_results) == 0:
                        body_result = {'type': 'constant', 'value': True}
                    elif len(body_results) == 1:
                        body_result = body_results[0]
                    else:
                        body_result = {'type': 'or', 'conditions': body_results}
                else:
                    # Single statement or multistatement processing disabled
                    body_result = self.visit(node.body[0])
            else:
                 logging.warning("visit_If: 'if' block is empty.")

            orelse_result = None
            if node.orelse:
                if should_process_multistatement and len(node.orelse) > 1:
                    # Multiple statements in the else-block
                    logging.debug(f"visit_If: Processing {len(node.orelse)} statements in else-block")
                    orelse_results = []
                    for stmt in node.orelse:
                        stmt_result = self.visit(stmt)
                        if stmt_result is not None:
                            if isinstance(stmt, ast.Return) and stmt.value:
                                inner_result = self.visit(stmt.value)
                                if inner_result and inner_result.get('type') != 'constant':
                                    orelse_results.append(inner_result)
                            elif stmt_result.get('type') == 'conditional':
                                orelse_results.append(stmt_result)

                    if len(orelse_results) == 0:
                        orelse_result = {'type': 'constant', 'value': True}
                    elif len(orelse_results) == 1:
                        orelse_result = orelse_results[0]
                    else:
                        orelse_result = {'type': 'or', 'conditions': orelse_results}
                else:
                    # Special case: If statement without else in orelse, and more statements follow
                    # This handles if-elif-else chains where elif/else are separate statements
                    if (isinstance(node.orelse[0], ast.If) and
                        not node.orelse[0].orelse and
                        len(node.orelse) > 1):
                        logging.debug(f"visit_If: If statement without else in orelse, analyzing remaining {len(node.orelse) - 1} statements as implicit else")
                        # Create a synthetic If node with the remaining statements as the else block
                        if_node = node.orelse[0]
                        remaining_stmts = node.orelse[1:]

                        # Create a synthetic if-node that includes the remaining statements as the else block
                        synthetic_if = ast.If(
                            test=if_node.test,
                            body=if_node.body,
                            orelse=remaining_stmts,
                            lineno=if_node.lineno if hasattr(if_node, 'lineno') else 0,
                            col_offset=if_node.col_offset if hasattr(if_node, 'col_offset') else 0
                        )

                        # Visit this synthetic if-statement
                        orelse_result = self.visit_If(synthetic_if)
                    else:
                        orelse_result = self.visit(node.orelse[0])
            else:
                 # Handle cases with no 'else' - could return None or a specific structure
                 logging.debug("visit_If: No 'else' block found.")
                 # Depending on how 'no else' should be represented, adjust here.
                 # For now, represent missing else as None.

            if test_result is None or body_result is None: # Orelse can be None legitimately
                 logging.error(f"Failed to analyze test or body of If statement: {ast.dump(node)}")
                 # If body_result failed but orelse exists and succeeded, we might still want partial info?
                 # For simplicity, fail if test or body fails.
                 return None

            # Optimize: If test is a constant, statically evaluate the conditional
            if test_result.get('type') == 'constant':
                test_value = test_result.get('value')
                logging.debug(f"visit_If: Test is constant with value: {test_value}")
                # In Python, truthiness: 0, False, None, "", [], {} are falsy
                is_truthy = bool(test_value) if test_value is not None else False
                if is_truthy:
                    logging.debug("visit_If: Test is truthy, returning if_true branch")
                    return body_result
                else:
                    logging.debug("visit_If: Test is falsy, returning if_false branch")
                    return orelse_result  # Could be None if no else block

            # Use a structure similar to IfExp (ternary) for consistency
            return {
                'type': 'conditional', # Reusing 'conditional' type
                'test': test_result,
                'if_true': body_result,
                'if_false': orelse_result # This will be None if no else block
            }
        except Exception as e:
            logging.error("Error in visit_If", e)
            return None

    def visit_IfExp(self, node: ast.IfExp):
        """ Handle conditional ternary expressions (body if test else orelse). """
        try:
            logging.debug(f"\n--- visit_IfExp ---")
            test_result = self.visit(node.test)
            body_result = self.visit(node.body)
            orelse_result = self.visit(node.orelse)

            if test_result is None or body_result is None or orelse_result is None:
                logging.error(f"Failed to analyze one or more parts of IfExp: {ast.dump(node)}")
                return None

            # Optimize: If test is a constant, statically evaluate the conditional
            if test_result.get('type') == 'constant':
                test_value = test_result.get('value')
                logging.debug(f"visit_IfExp: Test is constant with value: {test_value}")
                # In Python, truthiness: 0, False, None, "", [], {} are falsy
                is_truthy = bool(test_value) if test_value is not None else False
                if is_truthy:
                    logging.debug("visit_IfExp: Test is truthy, returning if_true branch")
                    return body_result
                else:
                    logging.debug("visit_IfExp: Test is falsy, returning if_false branch")
                    return orelse_result

            return {
                'type': 'conditional',
                'test': test_result,
                'if_true': body_result,
                'if_false': orelse_result
            }
        except Exception as e:
            logging.error("Error in visit_IfExp", e)
            return None

    def visit_BinOp(self, node: ast.BinOp):
        """ Handle binary operations (e.g., +, -, *, /). """
        try:
            logging.debug(f"\n--- visit_BinOp ---")
            left_result = self.visit(node.left)
            op_name = type(node.op).__name__ # E.g., 'Add', 'Mult'
            right_result = self.visit(node.right)

            if left_result is None or right_result is None:
                logging.error(f"Failed to analyze left or right side of BinOp: {ast.dump(node)}")
                return None

            # Map AST operator names to symbols
            op_map = {
                'Add': '+', 'Sub': '-', 
                'Mult': '*', 'Div': '/', 'FloorDiv': '//', 'Mod': '%',
                'Pow': '**',
                'LShift': '<<', 'RShift': '>>',
                'BitOr': '|', 'BitXor': '^', 'BitAnd': '&'
            }
            op_symbol = op_map.get(op_name, op_name) # Use class name if no symbol

            # Try to pre-process certain binary operations during export
            processed_result = self.binary_op_processor.try_preprocess_binary_op(left_result, op_symbol, right_result)
            if processed_result is not None:
                logging.debug(f"Pre-processed binary operation to: {processed_result}")
                return processed_result

            return {
                'type': 'binary_op',
                'left': left_result,
                'op': op_symbol,
                'right': right_result
            }
        except Exception as e:
            logging.error("Error in visit_BinOp", e)
            return None

    def visit_For(self, node: ast.For):
        """
        Handle for loops.
        Produces a for_range rule type for range() iterations,
        or a for_iter rule type for iterating over arbitrary iterables.
        """
        try:
            logging.debug(f"\n--- visit_For ---")
            logging.debug(f"Target: {ast.dump(node.target)}")
            logging.debug(f"Iter: {ast.dump(node.iter)}")

            # Get the loop variable name(s)
            # Support both simple names and tuple unpacking (e.g., for k, v in dict.items())
            var_name = "_"
            var_names = None  # Will be set if tuple unpacking is used
            if isinstance(node.target, ast.Name):
                var_name = node.target.id
            elif isinstance(node.target, ast.Tuple):
                # Tuple unpacking: extract all variable names
                var_names = []
                for elt in node.target.elts:
                    if isinstance(elt, ast.Name):
                        var_names.append(elt.id)
                    else:
                        # Nested tuple or other complex pattern - use placeholder
                        var_names.append("_")
                logging.debug(f"visit_For: Tuple unpacking with vars: {var_names}")

            # Analyze the loop body
            body_results = []
            for stmt in node.body:
                stmt_result = self.visit_statement(stmt)
                if stmt_result is not None:
                    body_results.append(stmt_result)

            # Check if this is a range() call
            if (isinstance(node.iter, ast.Call) and
                    isinstance(node.iter.func, ast.Name) and
                    node.iter.func.id == 'range'):
                # Get the count argument for range()
                if not node.iter.args:
                    logging.error("visit_For: range() called without arguments")
                    return None

                count_arg = node.iter.args[0]
                count_result = self.visit(count_arg)
                if count_result is None:
                    logging.error(f"visit_For: Failed to analyze range count: {ast.dump(count_arg)}")
                    return None

                result = {
                    'type': 'for_range',
                    'count': count_result,
                    'body': body_results
                }
                # Use 'vars' for tuple unpacking, 'var' for simple variable
                if var_names is not None:
                    result['vars'] = var_names
                else:
                    result['var'] = var_name
                return result
            else:
                # Handle iteration over arbitrary iterables (for_iter)
                iterable_result = self.visit(node.iter)
                if iterable_result is None:
                    logging.error(f"visit_For: Failed to analyze iterable: {ast.dump(node.iter)}")
                    return None

                logging.debug(f"visit_For: Creating for_iter with iterable: {iterable_result}")
                result = {
                    'type': 'for_iter',
                    'iterable': iterable_result,
                    'body': body_results
                }
                # Use 'vars' for tuple unpacking, 'var' for simple variable
                if var_names is not None:
                    result['vars'] = var_names
                else:
                    result['var'] = var_name
                return result
        except Exception as e:
            logging.error(f"Error in visit_For: {e}")
            return None

    def visit_While(self, node: ast.While):
        """
        Handle while loops.
        Produces a while_loop rule type with condition and body.
        """
        try:
            logging.debug(f"\n--- visit_While ---")
            logging.debug(f"Test: {ast.dump(node.test)}")

            # Analyze the condition
            condition_result = self.visit(node.test)
            if condition_result is None:
                logging.error(f"visit_While: Failed to analyze condition: {ast.dump(node.test)}")
                return None

            # Analyze the loop body
            body_results = []
            for stmt in node.body:
                stmt_result = self.visit_statement(stmt)
                if stmt_result is not None:
                    body_results.append(stmt_result)

            # Handle else clause if present (rarely used)
            orelse_results = []
            if node.orelse:
                for stmt in node.orelse:
                    stmt_result = self.visit_statement(stmt)
                    if stmt_result is not None:
                        orelse_results.append(stmt_result)

            result = {
                'type': 'while_loop',
                'condition': condition_result,
                'body': body_results
            }

            if orelse_results:
                result['orelse'] = orelse_results

            logging.debug(f"visit_While: Created while_loop rule: {result}")
            return result
        except Exception as e:
            logging.error(f"Error in visit_While: {e}")
            return None

    def visit_AugAssign(self, node: ast.AugAssign):
        """
        Handle augmented assignment statements (+=, -=, *=, /=).
        Produces an assign rule type with an op field.
        """
        try:
            logging.debug(f"\n--- visit_AugAssign ---")
            logging.debug(f"Target: {ast.dump(node.target)}")
            logging.debug(f"Op: {type(node.op).__name__}")
            logging.debug(f"Value: {ast.dump(node.value)}")

            if not isinstance(node.target, ast.Name):
                logging.warning(f"visit_AugAssign: Only simple name targets supported, got: {ast.dump(node.target)}")
                return None

            var_name = node.target.id

            # Map AST operators to symbols
            op_map = {
                'Add': '+=', 'Sub': '-=',
                'Mult': '*=', 'Div': '/=',
                'FloorDiv': '//=', 'Mod': '%='
            }
            op_name = type(node.op).__name__
            op_symbol = op_map.get(op_name, '+=')

            value_result = self.visit(node.value)
            if value_result is None:
                logging.error(f"visit_AugAssign: Failed to analyze value: {ast.dump(node.value)}")
                return None

            return {
                'type': 'assign',
                'name': var_name,
                'op': op_symbol,
                'value': value_result
            }
        except Exception as e:
            logging.error(f"Error in visit_AugAssign: {e}")
            return None

    def visit_statement(self, node):
        """
        Handle a statement node and return its rule representation.
        This is used for multi-statement function bodies.
        """
        try:
            logging.debug(f"\n--- visit_statement: {type(node).__name__} ---")

            if isinstance(node, ast.Return):
                # Return statement - wrap the value in a return type
                value_result = self.visit(node.value) if node.value else {'type': 'constant', 'value': None}
                return {
                    'type': 'return',
                    'value': value_result
                }
            elif isinstance(node, ast.Assign):
                # Simple assignment
                if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                    var_name = node.targets[0].id
                    value_result = self.visit(node.value)
                    if value_result is not None:
                        return {
                            'type': 'assign',
                            'name': var_name,
                            'value': value_result
                        }
                return None
            elif isinstance(node, ast.AugAssign):
                return self.visit_AugAssign(node)
            elif isinstance(node, ast.For):
                return self.visit_For(node)
            elif isinstance(node, ast.While):
                return self.visit_While(node)
            elif isinstance(node, ast.If):
                # Check if this is an if/elif/else that assigns to a single variable
                assign_result = self._try_convert_if_to_assign(node)
                if assign_result is not None:
                    return assign_result
                # Use statement-based if handling for imperative contexts
                return self._visit_If_statement(node)
            elif isinstance(node, ast.Expr):
                # Expression statement - just evaluate it
                return self.visit(node.value)
            elif isinstance(node, ast.Break):
                # Break statement - used to exit loops early
                return {'type': 'break'}
            elif isinstance(node, ast.Continue):
                # Continue statement - skip to next iteration
                return {'type': 'continue'}
            elif isinstance(node, ast.Pass):
                # Pass statement - explicit no-op, safe to ignore
                return None
            elif isinstance(node, ast.AnnAssign):
                # Annotated assignment (e.g., x: int = 5)
                if isinstance(node.target, ast.Name):
                    var_name = node.target.id
                    if node.value is not None:
                        value_result = self.visit(node.value)
                        if value_result is not None:
                            return {
                                'type': 'assign',
                                'name': var_name,
                                'value': value_result
                            }
                # If no value or failed to analyze, just ignore (type annotation only)
                return None
            else:
                logging.warning(f"visit_statement: Unsupported statement type: {type(node).__name__}")
                return None
        except Exception as e:
            logging.error(f"Error in visit_statement: {e}")
            return None

    def _visit_If_statement(self, node: ast.If) -> Optional[Dict[str, Any]]:
        """
        Handle If statements in imperative/statement context.
        Produces an if_statement rule type that can contain break/continue/return.
        """
        try:
            logging.debug(f"\n--- _visit_If_statement ---")
            test_result = self.visit(node.test)
            if test_result is None:
                logging.error(f"_visit_If_statement: Failed to analyze test: {ast.dump(node.test)}")
                return None

            # Analyze the if-body as statements
            body_results = []
            for stmt in node.body:
                stmt_result = self.visit_statement(stmt)
                if stmt_result is not None:
                    body_results.append(stmt_result)

            # Analyze the else-body as statements (if present)
            orelse_results = []
            if node.orelse:
                for stmt in node.orelse:
                    stmt_result = self.visit_statement(stmt)
                    if stmt_result is not None:
                        orelse_results.append(stmt_result)

            result = {
                'type': 'if_statement',
                'test': test_result,
                'body': body_results
            }

            if orelse_results:
                result['orelse'] = orelse_results

            return result
        except Exception as e:
            logging.error(f"Error in _visit_If_statement: {e}")
            return None

    def _try_convert_if_to_assign(self, node: ast.If) -> Optional[Dict[str, Any]]:
        """
        Try to convert an If statement that assigns to a single variable in all branches
        into an assign statement with a conditional value.

        Pattern: if cond: var = val1; elif cond2: var = val2; ...
        Also handles nested: if cond: if cond2: var = val1; ...

        Converts to: {"type": "assign", "name": "var", "value": {"type": "conditional", ...}}

        Returns None if the pattern doesn't match.
        """
        def get_assign_target(body):
            """Get the variable name if the body is a single assignment, None otherwise."""
            if len(body) == 1 and isinstance(body[0], ast.Assign):
                if len(body[0].targets) == 1 and isinstance(body[0].targets[0], ast.Name):
                    return body[0].targets[0].id
            return None

        def get_nested_assign_target(body):
            """Get the variable name, handling both direct assignments and nested If assignments."""
            # First try direct assignment
            target = get_assign_target(body)
            if target is not None:
                return target
            # Check if body is a single If statement that assigns to a variable
            if len(body) == 1 and isinstance(body[0], ast.If):
                return get_nested_assign_target(body[0].body)
            return None

        def get_assign_value_ast(body):
            """Get the assignment value AST node if the body is a single assignment."""
            if len(body) == 1 and isinstance(body[0], ast.Assign):
                return body[0].value
            return None

        def build_conditional_value(if_node, expected_var):
            """
            Recursively build a conditional rule for the value of an if/elif/else chain.
            Returns (conditional_rule, success) where success indicates all branches match.
            """
            # Check if body directly assigns to expected_var
            body_var = get_assign_target(if_node.body)

            # Visit the test condition
            test_result = self.visit(if_node.test)
            if test_result is None:
                return None, False

            if body_var == expected_var:
                # Direct assignment in body
                body_value_ast = get_assign_value_ast(if_node.body)
                if_true_result = self.visit(body_value_ast)
                if if_true_result is None:
                    return None, False
            elif len(if_node.body) == 1 and isinstance(if_node.body[0], ast.If):
                # Nested If statement - recursively process it
                nested_if = if_node.body[0]
                nested_var = get_nested_assign_target(nested_if.body)
                if nested_var != expected_var:
                    return None, False
                if_true_result, success = build_conditional_value(nested_if, expected_var)
                if not success:
                    return None, False
            else:
                return None, False

            # Handle orelse (else or elif)
            if_false_result = None
            if if_node.orelse:
                if len(if_node.orelse) == 1 and isinstance(if_node.orelse[0], ast.If):
                    # This is an elif - recursively process
                    if_false_result, success = build_conditional_value(if_node.orelse[0], expected_var)
                    if not success:
                        return None, False
                elif len(if_node.orelse) == 1 and isinstance(if_node.orelse[0], ast.Assign):
                    # This is a simple else assignment
                    else_var = get_assign_target(if_node.orelse)
                    if else_var != expected_var:
                        return None, False
                    else_value_ast = get_assign_value_ast(if_node.orelse)
                    if_false_result = self.visit(else_value_ast)
                    if if_false_result is None:
                        return None, False
                else:
                    # Complex else branch - don't convert
                    return None, False
            else:
                # No else branch - use the variable's current value
                if_false_result = {'type': 'name', 'name': expected_var}

            return {
                'type': 'conditional',
                'test': test_result,
                'if_true': if_true_result,
                'if_false': if_false_result
            }, True

        # Check if the if-body assigns to a variable (directly or via nested if)
        target_var = get_nested_assign_target(node.body)
        if target_var is None:
            return None

        # Try to build the conditional value
        conditional_value, success = build_conditional_value(node, target_var)
        if not success:
            return None

        logging.debug(f"_try_convert_if_to_assign: Converted if-assign chain for variable '{target_var}'")
        return {
            'type': 'assign',
            'name': target_var,
            'value': conditional_value
        }

    def _convert_generator_exp_to_all_of(self, gen_exp: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert a generator_expression to an all_of rule structure.

        This is used to handle nested comprehensions like:
            all(f(x, y) for x in A for y in B[x])

        Which becomes nested all_of structures:
            all_of(element=all_of(element=f(x,y), iterator=B[x]), iterator=A)

        Args:
            gen_exp: A generator_expression rule structure

        Returns:
            An all_of rule structure
        """
        if gen_exp.get('type') != 'generator_expression':
            logging.warning(f"_convert_generator_exp_to_all_of: Expected generator_expression, got {gen_exp.get('type')}")
            return gen_exp

        element_rule = gen_exp.get('element')
        comprehension = gen_exp.get('comprehension')

        # Recursively convert nested generator_expressions
        if element_rule and element_rule.get('type') == 'generator_expression':
            element_rule = self._convert_generator_exp_to_all_of(element_rule)
            logging.debug(f"_convert_generator_exp_to_all_of: Recursively converted nested generator_expression")

        result = {
            'type': 'all_of',
            'element_rule': element_rule,
            'iterator_info': comprehension
        }
        logging.debug(f"_convert_generator_exp_to_all_of: Created all_of with iterator target={comprehension.get('target')}")
        return result

    def _convert_generator_exp_to_any_of(self, gen_exp: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert a generator_expression to an any_of rule structure.

        This is used to handle nested comprehensions like:
            any(f(x, y) for x in A for y in B[x])

        Which becomes nested any_of structures:
            any_of(element=any_of(element=f(x,y), iterator=B[x]), iterator=A)

        Args:
            gen_exp: A generator_expression rule structure

        Returns:
            An any_of rule structure
        """
        if gen_exp.get('type') != 'generator_expression':
            logging.warning(f"_convert_generator_exp_to_any_of: Expected generator_expression, got {gen_exp.get('type')}")
            return gen_exp

        element_rule = gen_exp.get('element')
        comprehension = gen_exp.get('comprehension')

        # Recursively convert nested generator_expressions
        if element_rule and element_rule.get('type') == 'generator_expression':
            element_rule = self._convert_generator_exp_to_any_of(element_rule)
            logging.debug(f"_convert_generator_exp_to_any_of: Recursively converted nested generator_expression")

        result = {
            'type': 'any_of',
            'element_rule': element_rule,
            'iterator_info': comprehension
        }
        logging.debug(f"_convert_generator_exp_to_any_of: Created any_of with iterator target={comprehension.get('target')}")
        return result

    def _substitute_variable_in_rule(self, rule: Dict[str, Any], var_name: str, value: Any) -> Optional[Dict[str, Any]]:
        """
        Recursively substitute a variable name with a concrete value in a rule structure.

        This is used to expand comprehensions where we have a target variable (e.g., 'ingredient')
        that needs to be replaced with concrete values from an iterator.

        Args:
            rule: The rule structure to substitute in
            var_name: The variable name to replace
            value: The value to substitute

        Returns:
            A new rule structure with the variable substituted, or None if substitution fails
        """
        import copy

        if not rule or not isinstance(rule, dict):
            return rule

        # Deep copy to avoid modifying the original
        result = copy.deepcopy(rule)

        def substitute_recursive(node):
            """Recursively walk and substitute in the rule structure."""
            if not isinstance(node, dict):
                return node

            node_type = node.get('type')

            # Handle 'name' type - this is where we substitute
            if node_type == 'name' and node.get('name') == var_name:
                # Replace the name reference with a constant value
                return {'type': 'constant', 'value': value}

            # Handle f_string that might reference the variable
            if node_type == 'f_string':
                # Need to process the parts
                if 'parts' in node:
                    new_parts = []
                    for part in node['parts']:
                        if isinstance(part, dict):
                            if part.get('type') == 'formatted_value':
                                # Check if the formatted value references our variable
                                val = part.get('value', {})
                                if val.get('type') == 'name' and val.get('name') == var_name:
                                    # Replace the formatted value with a constant
                                    new_parts.append({'type': 'constant', 'value': str(value)})
                                else:
                                    # Recursively substitute in the formatted value
                                    new_parts.append({**part, 'value': substitute_recursive(val)})
                            else:
                                new_parts.append(substitute_recursive(part))
                        else:
                            new_parts.append(part)

                    # Reconstruct the f_string
                    # If all parts are now constants, we can simplify to a single constant
                    if all(p.get('type') == 'constant' for p in new_parts):
                        combined_value = ''.join(str(p['value']) for p in new_parts)
                        return {'type': 'constant', 'value': combined_value}
                    else:
                        return {**node, 'parts': new_parts}

            # Recursively process nested structures
            for key, val in node.items():
                if isinstance(val, dict):
                    node[key] = substitute_recursive(val)
                elif isinstance(val, list):
                    node[key] = [substitute_recursive(item) if isinstance(item, dict) else item for item in val]

            return node

        return substitute_recursive(result)

