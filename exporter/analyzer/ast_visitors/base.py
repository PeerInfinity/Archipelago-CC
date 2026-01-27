"""
Base mixin with core infrastructure for AST visitors.

This module contains helper registration methods and common utilities
used by all AST visitor mixins.
"""

import ast
import logging
from typing import Any, Dict, List, Optional


class BaseVisitorMixin:
    """
    Base mixin containing core infrastructure for AST visitors.

    This class provides helper registration methods used across
    all visitor methods.

    Required attributes from parent class:
        - closure_vars: Dict of closure variables
        - game_handler: Game-specific handler
    """

    def _register_helper_usage(self, helper_name: str, helper_func: Any = None,
                                args_with_nodes: List[Any] = None) -> None:
        """
        Register that a helper function is used, for automatic discovery.

        This calls the game handler's register_helper_usage method if available,
        allowing the exporter to automatically discover and export helper definitions.

        Also detects and registers param_mappings from call-site AST patterns when
        args_with_nodes is provided.

        Args:
            helper_name: The name of the helper function being used
            helper_func: Optional - the actual function object (for auto-detecting module)
            args_with_nodes: Optional - list of (arg_node, arg_result) tuples for param_mapping detection
        """
        if (hasattr(self, 'game_handler') and
            self.game_handler is not None and
            hasattr(self.game_handler, 'register_helper_usage')):
            self.game_handler.register_helper_usage(helper_name, helper_func)
            logging.debug(f"Registered helper usage: {helper_name}")

            # Detect and register param_mappings from call-site patterns
            if args_with_nodes and helper_func is not None:
                self._detect_and_register_param_mappings(helper_name, helper_func, args_with_nodes)

    def _detect_and_register_param_mappings(self, helper_name: str, helper_func: Any,
                                             args_with_nodes: List[Any]) -> None:
        """
        Detect param_mappings from call-site AST patterns and register them.

        This analyzes how a helper is called (e.g., with world.options.X.value or world.Y)
        and automatically determines the mapping from helper parameter names to slot_data keys.

        Args:
            helper_name: The name of the helper function
            helper_func: The actual function object
            args_with_nodes: List of (arg_node, arg_result) tuples
        """
        if not (hasattr(self, 'game_handler') and
                self.game_handler is not None and
                hasattr(self.game_handler, 'register_discovered_param_mapping')):
            return

        # Use the detection method from rule_analyzer
        param_mappings = self._detect_param_mappings_from_call_site(helper_name, helper_func, args_with_nodes)

        if param_mappings:
            self.game_handler.register_discovered_param_mapping(helper_name, param_mappings)

    def _make_helper_rule(self, name: str, args: List[Any], kwargs: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Create a helper rule, omitting empty args/kwargs to reduce JSON size.

        Args:
            name: The helper function name
            args: The positional arguments to pass to the helper
            kwargs: The keyword arguments to pass to the helper (optional)

        Returns:
            A helper rule dict with 'type', 'name', and optionally 'args' and 'kwargs'
        """
        result: Dict[str, Any] = {'type': 'helper', 'name': name}
        if args:
            result['args'] = args
        if kwargs:
            result['kwargs'] = kwargs
        return result
