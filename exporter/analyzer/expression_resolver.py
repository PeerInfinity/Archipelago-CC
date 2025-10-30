"""
Resolve expressions to concrete values during analysis.

This module handles the resolution of variables, attributes, subscripts,
and binary operations to their concrete values when possible.
"""

import logging
from typing import Any, Dict, Optional, Callable


class ExpressionResolver:
    """
    Handles resolution of variables, attributes, subscripts, etc.

    This class resolves expression references to their actual values by
    looking them up in closure variables, function defaults, or module globals.
    """

    def __init__(self, closure_vars: Dict[str, Any], rule_func: Optional[Callable],
                 player_context: Optional[int]):
        """
        Initialize the expression resolver.

        Args:
            closure_vars: Dictionary of variables available in the function's closure
            rule_func: The rule function being analyzed (for accessing defaults and globals)
            player_context: The player number context for this analysis
        """
        self.closure_vars = closure_vars
        self.rule_func = rule_func
        self.player_context = player_context

    def resolve_variable(self, var_name: str) -> Any:
        """
        Resolve variable name using function defaults, closure variables, or module globals.

        Args:
            var_name: The variable name to resolve

        Returns:
            The resolved value, or None if not found
        """
        # First check closure variables
        if var_name in self.closure_vars:
            return self.closure_vars[var_name]

        # Then check function defaults if available
        if self.rule_func and hasattr(self.rule_func, '__defaults__') and self.rule_func.__defaults__:
            # Get parameter names from function code
            if hasattr(self.rule_func, '__code__'):
                arg_names = self.rule_func.__code__.co_varnames[:self.rule_func.__code__.co_argcount]
                defaults = self.rule_func.__defaults__

                # Map default values to parameter names (defaults apply to last N parameters)
                if len(defaults) > 0:
                    default_start = len(arg_names) - len(defaults)
                    for i, default_value in enumerate(defaults):
                        param_name = arg_names[default_start + i]
                        if param_name == var_name:
                            logging.debug(f"Resolved variable '{var_name}' to default value: {default_value}")
                            return default_value

        # Finally check function globals (module-level imports like HatType)
        if self.rule_func and hasattr(self.rule_func, '__globals__'):
            if var_name in self.rule_func.__globals__:
                value = self.rule_func.__globals__[var_name]
                logging.debug(f"Resolved variable '{var_name}' to global value: {value}")
                return value

        logging.debug(f"Could not resolve variable '{var_name}'")
        return None

    def resolve_expression(self, expr_result: Dict) -> Any:
        """
        Resolve a complex expression to its value.
        Handles subscripts, attributes, and simple names.

        Args:
            expr_result: The result dict from visiting an expression node

        Returns:
            The resolved value, or None if it cannot be resolved
        """
        if not isinstance(expr_result, dict):
            return None

        expr_type = expr_result.get('type')

        # Handle constant values
        if expr_type == 'constant':
            return expr_result.get('value')

        # Handle simple variable names
        if expr_type == 'name':
            return self.resolve_variable(expr_result.get('name'))

        # Handle subscript expressions like world.chapter_timepiece_costs[ChapterIndex.BIRDS]
        if expr_type == 'subscript':
            # First resolve the object being subscripted
            obj_value = self.resolve_expression(expr_result.get('value'))
            # Then resolve the index
            index_value = self.resolve_expression(expr_result.get('index'))

            if obj_value is not None and index_value is not None:
                try:
                    # Try to subscript the object with the index
                    resolved = obj_value[index_value]
                    logging.debug(f"Resolved subscript to value: {resolved}")
                    return resolved
                except (KeyError, IndexError, TypeError) as e:
                    logging.debug(f"Could not resolve subscript: {e}")
                    return None
            return None

        # Handle attribute access like world.player or ChapterIndex.BIRDS
        if expr_type == 'attribute':
            obj_result = expr_result.get('object')
            attr_name = expr_result.get('attr')

            if obj_result and attr_name:
                # Resolve the object first
                obj_value = self.resolve_expression(obj_result)

                if obj_value is not None:
                    try:
                        # Try to get the attribute
                        resolved = getattr(obj_value, attr_name)
                        logging.debug(f"Resolved attribute {attr_name} to value: {resolved}")
                        return resolved
                    except AttributeError as e:
                        logging.debug(f"Could not resolve attribute {attr_name}: {e}")
                        return None
            return None

        # Handle binary operations like i+1, j*2, etc.
        if expr_type == 'binary_op':
            left_value = self.resolve_expression(expr_result.get('left'))
            right_value = self.resolve_expression(expr_result.get('right'))
            op = expr_result.get('op')

            if left_value is not None and right_value is not None and op:
                try:
                    # Perform the binary operation
                    if op == '+':
                        return left_value + right_value
                    elif op == '-':
                        return left_value - right_value
                    elif op == '*':
                        return left_value * right_value
                    elif op == '/':
                        return left_value / right_value
                    elif op == '//':
                        return left_value // right_value
                    elif op == '%':
                        return left_value % right_value
                    elif op == '**':
                        return left_value ** right_value
                    else:
                        logging.debug(f"Unsupported binary operation: {op}")
                        return None
                except Exception as e:
                    logging.debug(f"Could not perform binary operation {op}: {e}")
                    return None
            return None

        logging.debug(f"Could not resolve expression of type '{expr_type}'")
        return None

    def _get_current_player_number(self) -> Optional[int]:
        """
        Get the current player number for this rule analysis context.
        Returns 1 as default if no context is available.

        Returns:
            The player number, or 1 as default
        """
        if self.player_context is not None:
            return self.player_context
        # For now, return 1 as the default player number
        return 1
