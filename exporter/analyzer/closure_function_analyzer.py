"""Analyzer for function objects found in closure variables.

This module provides the ClosureFunctionAnalyzer class which handles functions
stored in closure variables during rule analysis. These functions cannot be
directly serialized to JSON but can be analyzed if we can access their source
or recognize their structure patterns.

Primary use case: ALttP bunny rules which use `options_to_access_rule` and
`path_to_access_rule` lambdas that contain lists of function objects.
"""

import ast
import inspect
import logging
import textwrap
from typing import Any, Dict, List, Optional, Set, Callable, TYPE_CHECKING

from .cache import closure_aware_cache, get_closure_aware_cache_key

if TYPE_CHECKING:
    from .rule_analyzer import RuleAnalyzer

logger = logging.getLogger(__name__)


class ClosureFunctionAnalyzer:
    """Analyzes function objects to extract their rule logic.

    This handles functions that are stored in closure variables,
    where we have the function object but need to analyze its behavior.

    The analyzer uses multiple strategies:
    1. Source code analysis via inspect.getsource() + AST parsing
    2. Closure pattern recognition based on variable signatures
    3. Conservative fallback rules when analysis fails
    """

    # Maximum recursion depth to prevent infinite loops
    MAX_DEPTH = 10

    # Maximum depth for bunny rule path expansion
    # Beyond this depth, use conservative approximation to prevent exponential growth
    # Set to 0 for unlimited depth (recommended with early termination optimization)
    # Testing with 20 runs each showed:
    #   depth=1, pruning ON:  75% pass rate
    #   depth=0, pruning ON:  80% pass rate
    #   depth=1, pruning OFF: 65% pass rate
    #   depth=0, pruning OFF: 85% pass rate (best)
    MAX_BUNNY_PATH_DEPTH = 0

    # Enable dominance pruning in bunny rule analysis.
    # When True, removes options that require a strict superset of another option's items.
    # Testing showed pruning can incorrectly remove valid paths with unlimited depth.
    # Set to True to enable if rule sizes become too large.
    ENABLE_DOMINANCE_PRUNING = False

    # Patterns recognized by closure variable names
    KNOWN_PATTERNS = {
        'options_to_access_rule': {'options'},
        'path_to_access_rule': {'path', 'entrance'},
        'moon_pearl_check': {'player'},
    }

    def __init__(self, parent_analyzer: 'RuleAnalyzer', max_depth: int = None):
        """Initialize the ClosureFunctionAnalyzer.

        Args:
            parent_analyzer: The RuleAnalyzer instance for recursive analysis
            max_depth: Maximum recursion depth (defaults to MAX_DEPTH)
        """
        self.parent_analyzer = parent_analyzer
        self.max_depth = max_depth if max_depth is not None else self.MAX_DEPTH
        self._seen_functions: Set[int] = set()  # Cycle detection by function id

    def analyze_function(self, func: Callable, depth: int = 0) -> Optional[Dict[str, Any]]:
        """Attempt to analyze a function object.

        Args:
            func: The function object to analyze
            depth: Current recursion depth

        Returns:
            Analyzed rule dict, or None if unanalyzable
        """
        if not callable(func):
            logger.debug(f"ClosureFunctionAnalyzer: Not a callable: {type(func)}")
            return None

        if depth > self.max_depth:
            logger.warning(f"ClosureFunctionAnalyzer: Max depth {self.max_depth} exceeded")
            return None

        # Check closure-aware cache first for semantically equivalent lambdas
        # This is critical for ALttP bunny rules where the same pattern appears many times
        closure_key = get_closure_aware_cache_key(func)
        if closure_key and closure_key in closure_aware_cache:
            logger.debug(f"ClosureFunctionAnalyzer: Cache hit for {closure_key[0]}:{closure_key[1]}")
            return closure_aware_cache[closure_key]

        func_id = id(func)
        if func_id in self._seen_functions:
            logger.debug(f"ClosureFunctionAnalyzer: Circular reference detected for func id {func_id}")
            return {'type': 'constant', 'value': True}  # Conservative: assume accessible
        self._seen_functions.add(func_id)

        try:
            # Get function qualified name for pattern detection
            func_qualname = getattr(func, '__qualname__', '')
            logger.debug(f"ClosureFunctionAnalyzer: Analyzing {func_qualname} at depth {depth}")

            # Method 1: Try to analyze by recognizing closure patterns
            # This is faster than source extraction and handles dynamic lambdas
            result = self._analyze_via_closure_pattern(func, depth)
            if result is not None:
                logger.debug(f"ClosureFunctionAnalyzer: Closure pattern analysis succeeded")
                # Cache the result
                if closure_key and result.get('type') != 'error':
                    closure_aware_cache[closure_key] = result
                return result

            # Method 2: Try to get source and parse AST
            result = self._analyze_via_source(func, depth)
            if result is not None:
                logger.debug(f"ClosureFunctionAnalyzer: Source analysis succeeded")
                # Cache the result
                if closure_key and result.get('type') != 'error':
                    closure_aware_cache[closure_key] = result
                return result

            logger.debug(f"ClosureFunctionAnalyzer: All analysis methods failed for {func_qualname}")
            return None
        finally:
            self._seen_functions.discard(func_id)

    def _analyze_via_source(self, func: Callable, depth: int) -> Optional[Dict[str, Any]]:
        """Try to analyze function via source code extraction.

        Args:
            func: The function to analyze
            depth: Current recursion depth

        Returns:
            Analyzed rule dict, or None if analysis failed
        """
        try:
            source = inspect.getsource(func)
            # Remove leading indentation
            source = textwrap.dedent(source)

            # Parse the source code
            tree = ast.parse(source)

            # Find lambda or function body
            for node in ast.walk(tree):
                if isinstance(node, ast.Lambda):
                    # Create sub-analyzer with function's closure vars
                    closure_vars = self._extract_closure_vars(func)

                    # Import here to avoid circular imports
                    from .rule_analyzer import RuleAnalyzer

                    sub_analyzer = RuleAnalyzer(
                        closure_vars=closure_vars,
                        rule_func=func,
                        player_context=self.parent_analyzer.player_context,
                        game_handler=self.parent_analyzer.game_handler,
                        seen_funcs=self.parent_analyzer.seen_funcs
                    )
                    result = sub_analyzer.visit(node.body)
                    if result and result.get('type') != 'error':
                        return result

        except (OSError, TypeError) as e:
            # Source not available for dynamically created functions
            logger.debug(f"ClosureFunctionAnalyzer: Source not available: {e}")
        except SyntaxError as e:
            logger.debug(f"ClosureFunctionAnalyzer: Syntax error in source: {e}")
        except Exception as e:
            logger.debug(f"ClosureFunctionAnalyzer: Source analysis error: {e}")

        return None

    def _analyze_via_closure_pattern(self, func: Callable, depth: int) -> Optional[Dict[str, Any]]:
        """Analyze by recognizing closure variable patterns.

        This method detects known function patterns based on their closure
        variable signatures and qualified names.

        Args:
            func: The function to analyze
            depth: Current recursion depth

        Returns:
            Analyzed rule dict, or None if pattern not recognized
        """
        if not hasattr(func, '__closure__') or not func.__closure__:
            # No closure - might be a simple function, try source analysis
            return None

        closure_vars = self._extract_closure_vars(func)
        if not closure_vars:
            return None

        qualname = getattr(func, '__qualname__', '')
        closure_var_names = set(closure_vars.keys())

        # Pattern: options_to_access_rule result
        # lambda state: any(rule(state) for rule in options)
        if 'options' in closure_vars and isinstance(closure_vars['options'], (list, tuple)):
            return self._analyze_options_pattern(closure_vars['options'], depth)

        # Pattern: path_to_access_rule result
        # lambda state: state.can_reach(entrance.name, 'Entrance', entrance.player)
        #               and all(rule(state) for rule in path)
        if 'path' in closure_vars and 'entrance' in closure_vars:
            return self._analyze_path_pattern(
                closure_vars['path'],
                closure_vars['entrance'],
                depth
            )

        # Pattern: add_rule combined lambda
        # lambda state: rule(state) and old_rule(state)
        # Created by worlds/generic/Rules.py add_rule() function
        if 'rule' in closure_vars and 'old_rule' in closure_vars:
            rule_func = closure_vars['rule']
            old_rule_func = closure_vars['old_rule']
            if callable(rule_func) and callable(old_rule_func):
                return self._analyze_add_rule_pattern(rule_func, old_rule_func, depth)

        # Pattern: Simple item check with 'player' captured
        # lambda state: state.has('Moon Pearl', player)
        if 'player' in closure_vars and len(closure_vars) <= 2:
            return self._analyze_simple_check_pattern(func, closure_vars)

        # Pattern: Superbunny mirror check (glitch modes)
        # lambda state: path_rule(state) and state.has('Magic Mirror', player)
        if 'player' in closure_vars:
            # Check if this looks like a superbunny pattern
            func_code = getattr(func, '__code__', None)
            if func_code:
                # Look for 'Magic Mirror' or 'has_sword' in constants
                consts = func_code.co_consts
                if 'Magic Mirror' in consts or 'Pegasus Boots' in consts:
                    logger.debug(f"ClosureFunctionAnalyzer: Detected superbunny pattern")
                    # This is a complex superbunny rule - use source analysis
                    return None  # Fall through to source analysis

        logger.debug(f"ClosureFunctionAnalyzer: Unrecognized closure pattern with vars: {closure_var_names}")
        return None

    def _analyze_options_pattern(self, options: List, depth: int) -> Optional[Dict[str, Any]]:
        """Analyze any(rule(state) for rule in options) pattern.

        This pattern is used by ALttP's options_to_access_rule() which returns
        a lambda that evaluates multiple possible access paths.

        Uses DFS with early termination: if we find a trivial path (just can_reach,
        no item requirements), we return immediately without analyzing remaining options.

        Args:
            options: List of rule functions
            depth: Current recursion depth

        Returns:
            Analyzed rule dict as an 'or' of all options
        """
        if not options:
            # Empty options list - any([]) is False
            return {'rule': 'False_'}

        # If we're too deep in bunny rule recursion, use conservative approximation
        # This prevents exponential growth in complex entrance shuffle scenarios
        # (skip check if MAX_BUNNY_PATH_DEPTH is 0, meaning unlimited)
        if self.MAX_BUNNY_PATH_DEPTH > 0 and depth > self.MAX_BUNNY_PATH_DEPTH:
            logger.debug(f"ClosureFunctionAnalyzer: Options depth {depth} exceeds MAX_BUNNY_PATH_DEPTH, using Moon Pearl fallback")
            # Return Moon Pearl check - the base case for all bunny rules
            return {'rule': 'Has', 'args': {'item_name': 'Moon Pearl', 'count': 1}}

        # Sort options by estimated complexity (shorter paths first)
        # This increases chances of finding a simple path early
        sorted_options = self._sort_options_by_complexity(options)

        analyzed_options = []
        failed_count = 0

        for i, option_func in enumerate(sorted_options):
            if not callable(option_func):
                logger.warning(f"ClosureFunctionAnalyzer: Option {i} is not callable: {type(option_func)}")
                failed_count += 1
                continue

            result = self.analyze_function(option_func, depth + 1)
            if result is not None:
                # Early termination: if we find a trivial path, return immediately
                # A trivial path is one that only requires entrance reachability, no items
                if self._is_trivial_path(result):
                    logger.debug(f"ClosureFunctionAnalyzer: Found trivial path at option {i}, early termination")
                    return result

                analyzed_options.append(result)
            else:
                # Try bytecode analysis as last resort
                bytecode_result = self._analyze_via_bytecode(option_func)
                if bytecode_result is not None:
                    if self._is_trivial_path(bytecode_result):
                        logger.debug(f"ClosureFunctionAnalyzer: Found trivial path via bytecode at option {i}")
                        return bytecode_result
                    analyzed_options.append(bytecode_result)
                else:
                    logger.debug(f"ClosureFunctionAnalyzer: Could not analyze option {i}")
                    failed_count += 1

        # If we analyzed at least some options, return what we got
        # Only fail completely if we couldn't analyze ANY option
        if len(analyzed_options) == 0:
            if failed_count > 0:
                # We had options but couldn't analyze any - use Moon Pearl fallback
                logger.debug(f"ClosureFunctionAnalyzer: All {failed_count} options failed, using Moon Pearl")
                return {'rule': 'Has', 'args': {'item_name': 'Moon Pearl'}}
            return {'rule': 'False_'}

        if len(analyzed_options) == 1:
            return analyzed_options[0]

        # Simplify: remove duplicates and True constants
        simplified = self._simplify_or_conditions(analyzed_options)

        # Apply dominance pruning: remove options that require a superset of items
        if self.ENABLE_DOMINANCE_PRUNING:
            simplified = self._prune_dominated_options(simplified)

        if len(simplified) == 0:
            return {'rule': 'False_'}
        elif len(simplified) == 1:
            return simplified[0]
        return {'rule': 'Or', 'children': simplified}

    def _sort_options_by_complexity(self, options: List) -> List:
        """Sort options by estimated complexity (simpler first).

        Estimates complexity by:
        1. Options with no closure (simple item checks) - lowest complexity
        2. Options with 'path' closure (path_to_access_rule) - sorted by path length
        3. Options with 'options' closure (nested bunny rules) - highest complexity

        Args:
            options: List of callable options

        Returns:
            Sorted list of options (simpler first)
        """
        def estimate_complexity(func):
            if not callable(func):
                return (3, 0)  # Non-callable last

            closure_vars = self._extract_closure_vars(func)
            var_names = set(closure_vars.keys())

            # Simple item check (just player captured)
            if var_names <= {'player'}:
                return (0, 0)

            # path_to_access_rule - complexity based on path length
            if 'path' in var_names and 'entrance' in var_names:
                path = closure_vars.get('path', [])
                path_len = len(path) if isinstance(path, (list, tuple)) else 0
                return (1, path_len)

            # Nested options_to_access_rule - highest complexity
            if 'options' in var_names:
                opts = closure_vars.get('options', [])
                opts_count = len(opts) if isinstance(opts, (list, tuple)) else 0
                return (2, opts_count)

            return (1, 0)  # Default medium complexity

        return sorted(options, key=estimate_complexity)

    def _is_trivial_path(self, result: Dict[str, Any]) -> bool:
        """Check if a result is a trivial path (no item requirements).

        A trivial path is one that only requires entrance/region reachability,
        with no item checks. This is the "best case" for bunny rules.

        Args:
            result: Analyzed rule dict

        Returns:
            True if this is a trivial path (no items needed)
        """
        if not result or not isinstance(result, dict):
            return False

        rule_type = result.get('rule') or result.get('type')

        # Direct can_reach is trivial
        if rule_type in ('CanReachEntrance', 'CanReachRegion'):
            return True

        # True_ is trivial
        if rule_type == 'True_':
            return True
        if rule_type == 'constant' and result.get('value') is True:
            return True

        # And of only can_reach checks is trivial
        if rule_type == 'And':
            children = result.get('children', [])
            return all(self._is_trivial_path(c) for c in children)
        if rule_type == 'and':
            conditions = result.get('conditions', [])
            return all(self._is_trivial_path(c) for c in conditions)

        return False

    def _extract_item_requirements(self, result: Dict[str, Any]) -> set:
        """Extract item requirements from an analyzed rule.

        Args:
            result: Analyzed rule dict

        Returns:
            Set of item names required by this rule
        """
        items = set()
        if not result or not isinstance(result, dict):
            return items

        rule_type = result.get('rule') or result.get('type')

        # Direct item check
        if rule_type == 'Has':
            item = result.get('args', {}).get('item_name')
            if item:
                items.add(item)
        elif rule_type == 'item_check':
            item = result.get('item')
            if item:
                items.add(item)

        # HasAny - all items are alternatives
        if rule_type == 'HasAny':
            for item in result.get('args', {}).get('items', []):
                items.add(item)

        # Recurse into children
        for key in ('children', 'conditions'):
            for child in result.get(key, []):
                items.update(self._extract_item_requirements(child))

        return items

    def _prune_dominated_options(self, options: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove options that are strictly dominated by others.

        An option A dominates option B if:
        1. A requires a strict subset of B's items, AND
        2. A doesn't rely on can_reach checks that B doesn't have

        For bunny rules, we're conservative - we only prune if both options have
        the same "type" of requirement (both item-only or both have can_reach).
        This prevents incorrectly pruning Moon Pearl (which is always available if
        you have the item) in favor of entrance-based options (which may not be accessible).

        Args:
            options: List of analyzed rule dicts

        Returns:
            List with dominated options removed
        """
        if len(options) <= 1:
            return options

        # Extract requirement info: (items, has_can_reach)
        def get_requirements_info(opt):
            items = self._extract_item_requirements(opt)
            has_can_reach = self._has_can_reach_check(opt)
            return items, has_can_reach

        option_info = [(opt, *get_requirements_info(opt)) for opt in options]

        # Remove dominated options
        non_dominated = []
        for opt, reqs, has_reach in option_info:
            is_dominated = False
            for other_opt, other_reqs, other_has_reach in option_info:
                if opt is other_opt:
                    continue

                # Only compare options of the same "type":
                # - Both have can_reach, or neither has can_reach
                # This prevents pruning Moon Pearl in favor of entrance-based options
                if has_reach != other_has_reach:
                    continue

                # Check if other strictly dominates this (other requires fewer items)
                if other_reqs < reqs:  # Strict subset
                    is_dominated = True
                    logger.debug(f"ClosureFunctionAnalyzer: Pruning dominated option (requires {reqs}, dominated by {other_reqs})")
                    break
            if not is_dominated:
                non_dominated.append(opt)

        return non_dominated if non_dominated else options  # Never return empty

    def _has_can_reach_check(self, result: Dict[str, Any]) -> bool:
        """Check if a rule contains a can_reach check.

        Args:
            result: Analyzed rule dict

        Returns:
            True if the rule contains CanReachEntrance or CanReachRegion
        """
        if not result or not isinstance(result, dict):
            return False

        rule_type = result.get('rule') or result.get('type')

        if rule_type in ('CanReachEntrance', 'CanReachRegion', 'can_reach'):
            return True

        # Recurse into children
        for key in ('children', 'conditions'):
            for child in result.get(key, []):
                if self._has_can_reach_check(child):
                    return True

        return False

    def _analyze_path_pattern(self, path: List, entrance, depth: int) -> Optional[Dict[str, Any]]:
        """Analyze path_to_access_rule result.

        This pattern represents:
        lambda state: state.can_reach(entrance.name, 'Entrance', entrance.player)
                      and all(rule(state) for rule in path)

        Args:
            path: List of rule functions representing path requirements
            entrance: Entrance object with name attribute
            depth: Current recursion depth

        Returns:
            Analyzed rule combining can_reach and path requirements
        """
        # Build the can_reach part
        entrance_name = getattr(entrance, 'name', str(entrance))
        can_reach = {
            'rule': 'CanReachEntrance',
            'args': {'entrance_name': entrance_name}
        }

        # If we're too deep in bunny rule recursion, use conservative approximation
        # This prevents exponential growth in complex entrance shuffle scenarios
        # (skip check if MAX_BUNNY_PATH_DEPTH is 0, meaning unlimited)
        if self.MAX_BUNNY_PATH_DEPTH > 0 and depth > self.MAX_BUNNY_PATH_DEPTH:
            logger.debug(f"ClosureFunctionAnalyzer: Depth {depth} exceeds MAX_BUNNY_PATH_DEPTH, using conservative approximation")
            # Return just the can_reach check - conservative but prevents explosion
            return can_reach

        # Analyze each rule in path
        path_conditions = []
        for i, rule_func in enumerate(path):
            if callable(rule_func):
                # Check if this is another bunny rule (nested options/path pattern)
                # If so, and we're at depth limit, skip it to prevent exponential growth
                # (skip check if MAX_BUNNY_PATH_DEPTH is 0, meaning unlimited)
                if self.MAX_BUNNY_PATH_DEPTH > 0 and depth >= self.MAX_BUNNY_PATH_DEPTH - 1:
                    closure_vars = self._extract_closure_vars(rule_func)
                    if closure_vars and ('options' in closure_vars or 'path' in closure_vars):
                        logger.debug(f"ClosureFunctionAnalyzer: Skipping nested bunny rule at depth {depth}")
                        # Skip nested bunny rules at depth limit
                        continue

                result = self.analyze_function(rule_func, depth + 1)
                if result is not None:
                    path_conditions.append(result)
                else:
                    # Try bytecode analysis
                    bytecode_result = self._analyze_via_bytecode(rule_func)
                    if bytecode_result is not None:
                        path_conditions.append(bytecode_result)
                    else:
                        logger.debug(f"ClosureFunctionAnalyzer: Could not analyze path rule {i}")
                        # Skip this rule rather than failing entirely
                        continue
            else:
                logger.warning(f"ClosureFunctionAnalyzer: Path rule {i} is not callable")
                continue

        # Combine: can_reach AND all(path)
        if not path_conditions:
            return can_reach

        all_conditions = [can_reach] + path_conditions

        # Simplify if possible
        simplified = self._simplify_and_conditions(all_conditions)
        if len(simplified) == 1:
            return simplified[0]
        return {'rule': 'And', 'children': simplified}

    def _analyze_add_rule_pattern(self, rule_func: Callable, old_rule_func: Callable,
                                   depth: int) -> Optional[Dict[str, Any]]:
        """Analyze add_rule combined lambda pattern.

        This pattern is created by worlds/generic/Rules.py add_rule() function:
        lambda state: rule(state) and old_rule(state)

        Args:
            rule_func: The new rule being added
            old_rule_func: The existing rule
            depth: Current recursion depth

        Returns:
            Analyzed rule combining both rules with AND
        """
        logger.debug(f"ClosureFunctionAnalyzer: Analyzing add_rule pattern at depth {depth}")

        # Analyze both rules
        rule_result = self.analyze_function(rule_func, depth + 1)
        old_rule_result = self.analyze_function(old_rule_func, depth + 1)

        # If new rule analysis failed, try bytecode
        if rule_result is None:
            rule_result = self._analyze_via_bytecode(rule_func)
        # If old rule analysis failed, try bytecode
        if old_rule_result is None:
            old_rule_result = self._analyze_via_bytecode(old_rule_func)

        # Handle cases where one or both failed
        if rule_result is None and old_rule_result is None:
            logger.debug(f"ClosureFunctionAnalyzer: Both add_rule components failed analysis")
            return None
        elif rule_result is None:
            # Only old_rule succeeded - return it (rule is implicitly True)
            logger.debug(f"ClosureFunctionAnalyzer: Only old_rule succeeded in add_rule")
            return old_rule_result
        elif old_rule_result is None:
            # Only rule succeeded - return it (old_rule is implicitly True)
            logger.debug(f"ClosureFunctionAnalyzer: Only rule succeeded in add_rule")
            return rule_result

        # Both succeeded - combine with AND
        conditions = [rule_result, old_rule_result]
        simplified = self._simplify_and_conditions(conditions)

        if len(simplified) == 0:
            return {'rule': 'True_'}
        elif len(simplified) == 1:
            return simplified[0]

        logger.debug(f"ClosureFunctionAnalyzer: add_rule pattern combined: {simplified}")
        return {'rule': 'And', 'children': simplified}

    def _analyze_via_bytecode(self, func: Callable) -> Optional[Dict[str, Any]]:
        """Analyze a function by examining its bytecode constants and names.

        This is a last-resort analysis that extracts information from the
        compiled bytecode when source code is not available.

        Args:
            func: The function to analyze

        Returns:
            Analyzed rule dict, or None if analysis failed
        """
        import dis

        func_code = getattr(func, '__code__', None)
        if not func_code:
            return None

        consts = func_code.co_consts
        names = func_code.co_names if hasattr(func_code, 'co_names') else ()
        freevars = func_code.co_freevars

        # Extract closure variables for additional context
        closure_vars = self._extract_closure_vars(func)

        # Analyze bytecode to detect OR vs AND patterns
        # Look for JUMP_IF_TRUE_OR_POP (OR short-circuit) vs JUMP_IF_FALSE_OR_POP (AND)
        is_or_pattern = False
        is_and_pattern = False
        try:
            bytecode = list(dis.get_instructions(func_code))
            for instr in bytecode:
                if instr.opname in ('JUMP_IF_TRUE_OR_POP', 'POP_JUMP_IF_TRUE'):
                    is_or_pattern = True
                elif instr.opname in ('JUMP_IF_FALSE_OR_POP', 'POP_JUMP_IF_FALSE', 'POP_JUMP_FORWARD_IF_FALSE'):
                    is_and_pattern = True
        except Exception:
            pass  # Fall back to heuristics if bytecode analysis fails

        # Known ALttP items that appear in bunny/access rules
        alttp_items = {
            'Moon Pearl', 'Magic Mirror', 'Pegasus Boots', 'Flippers',
            'Hammer', 'Fire Rod', 'Lamp', 'Hookshot', 'Bow', 'Cane of Somaria',
            'Cane of Byrna', 'Cape', 'Bottle', 'Bombos', 'Ether', 'Quake',
            'Book of Mudora', 'Shovel', 'Flute', 'Bug Catching Net',
        }

        # Check for combined patterns: (item AND has_sword) OR item
        # This is the Tower of Hera pattern used in glitch modes
        if 'has' in names and 'has_sword' in names and is_or_pattern and is_and_pattern:
            item_names = []
            for const in consts:
                if isinstance(const, str) and const and not const.startswith('<'):
                    if const not in ('Entrance', 'Region', 'Location'):
                        if const in alttp_items:
                            item_names.append(const)

            if len(item_names) >= 2:
                # Pattern: (first_item AND has_sword) OR second_item
                # The bytecode order is: item1 check -> AND jump -> has_sword -> OR jump -> item2
                # Convert has_sword to actual item checks
                has_sword_rule = {
                    'rule': 'HasAny',
                    'args': {'items': ['Fighter Sword', 'Master Sword', 'Tempered Sword', 'Golden Sword']}
                }
                first_item = {'rule': 'Has', 'args': {'item_name': item_names[0]}}
                second_item = {'rule': 'Has', 'args': {'item_name': item_names[1]}}

                and_part = {'rule': 'And', 'children': [first_item, has_sword_rule]}
                result = {'rule': 'Or', 'children': [and_part, second_item]}

                logger.debug(f"ClosureFunctionAnalyzer: Bytecode found (item AND has_sword) OR item pattern: {item_names}")
                return result

        # Check for state.has() pattern - collect ALL item names first
        if 'has' in names:
            item_names = []
            for const in consts:
                if isinstance(const, str) and const and not const.startswith('<'):
                    # Skip type strings
                    if const not in ('Entrance', 'Region', 'Location'):
                        if const in alttp_items:
                            item_names.append(const)

            if len(item_names) == 1:
                logger.debug(f"ClosureFunctionAnalyzer: Bytecode found has('{item_names[0]}')")
                return {'rule': 'Has', 'args': {'item_name': item_names[0]}}
            elif len(item_names) > 1:
                # Multiple items - use bytecode analysis to determine OR vs AND
                item_checks = [{'rule': 'Has', 'args': {'item_name': name}} for name in item_names]
                if is_or_pattern and not is_and_pattern:
                    logger.debug(f"ClosureFunctionAnalyzer: Bytecode found OR pattern with items: {item_names}")
                    return {'rule': 'Or', 'children': item_checks}
                elif is_and_pattern and not is_or_pattern:
                    logger.debug(f"ClosureFunctionAnalyzer: Bytecode found AND pattern with items: {item_names}")
                    return {'rule': 'And', 'children': item_checks}
                else:
                    # Both AND and OR detected but no has_sword - default to OR
                    logger.debug(f"ClosureFunctionAnalyzer: Bytecode found mixed pattern, defaulting to OR: {item_names}")
                    return {'rule': 'Or', 'children': item_checks}

        # Check for state.can_reach() pattern
        if 'can_reach' in names:
            # Find target name in constants or closure
            for const in consts:
                if isinstance(const, str) and const and const not in ('Entrance', 'Region', 'Location'):
                    target_type = 'Region'
                    if 'Entrance' in consts:
                        target_type = 'Entrance'
                    logger.debug(f"ClosureFunctionAnalyzer: Bytecode found can_reach('{const}', '{target_type}')")
                    return {
                        'rule': 'CanReachEntrance' if target_type == 'Entrance' else 'CanReachRegion',
                        'args': {'entrance_name' if target_type == 'Entrance' else 'region_name': const}
                    }

            # Check closure for entrance object
            if 'entrance' in closure_vars:
                entrance = closure_vars['entrance']
                entrance_name = getattr(entrance, 'name', str(entrance))
                logger.debug(f"ClosureFunctionAnalyzer: Bytecode found can_reach via closure entrance '{entrance_name}'")
                return {'rule': 'CanReachEntrance', 'args': {'entrance_name': entrance_name}}

        # Check for has_sword helper (used in superbunny rules)
        # Convert to actual item checks since frontend doesn't have has_sword handler
        if 'has_sword' in names:
            logger.debug(f"ClosureFunctionAnalyzer: Bytecode found has_sword(), converting to item checks")
            # has_sword checks for any of the four sword tiers
            return {
                'rule': 'HasAny',
                'args': {'items': ['Fighter Sword', 'Master Sword', 'Tempered Sword', 'Golden Sword']}
            }

        return None

    def _analyze_simple_check_pattern(self, func: Callable,
                                      closure_vars: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Analyze simple state.has() patterns by examining bytecode.

        Handles patterns like:
        - lambda state: state.has('Moon Pearl', player)
        - lambda state: state.has('Magic Mirror', player)
        - lambda state: state.has('Magic Mirror', player) and has_sword(state, player) or state.has('Moon Pearl', player)

        Args:
            func: The function to analyze
            closure_vars: Extracted closure variables

        Returns:
            Analyzed item_check rule, or None if pattern not matched
        """
        func_code = getattr(func, '__code__', None)
        if not func_code:
            return None

        consts = func_code.co_consts
        names = func_code.co_names if hasattr(func_code, 'co_names') else ()

        # Check if this calls 'has' method (state.has())
        if 'has' not in names:
            return None

        # If this pattern includes has_sword or multiple items with AND/OR,
        # delegate to _analyze_via_bytecode which handles complex patterns
        if 'has_sword' in names:
            logger.debug(f"ClosureFunctionAnalyzer: Complex pattern with has_sword, using bytecode analysis")
            return self._analyze_via_bytecode(func)

        # Extract item name from constants - it's the string argument to has()
        # Filter out None and code objects, look for item-like strings
        item_candidates = []
        for const in consts:
            if isinstance(const, str) and const and not const.startswith('<'):
                item_candidates.append(const)

        # If we have multiple items, also delegate to bytecode analysis
        # to properly detect OR vs AND patterns
        if len(item_candidates) > 1:
            logger.debug(f"ClosureFunctionAnalyzer: Multiple items found, using bytecode analysis")
            return self._analyze_via_bytecode(func)

        if len(item_candidates) == 1:
            item_name = item_candidates[0]
            logger.debug(f"ClosureFunctionAnalyzer: Detected has() check for '{item_name}'")
            return {'rule': 'Has', 'args': {'item_name': item_name}}

        return None

    def _extract_closure_vars(self, func: Callable) -> Dict[str, Any]:
        """Extract closure variables from a function.

        Args:
            func: The function to extract closure variables from

        Returns:
            Dictionary mapping variable names to their values
        """
        result = {}
        if not hasattr(func, '__closure__') or func.__closure__ is None:
            return result

        if not hasattr(func, '__code__'):
            return result

        freevars = func.__code__.co_freevars
        for name, cell in zip(freevars, func.__closure__):
            try:
                result[name] = cell.cell_contents
            except ValueError:
                # Empty cell
                pass

        return result

    def _simplify_or_conditions(self, conditions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Simplify a list of OR conditions.

        Removes:
        - Duplicate conditions
        - If any condition is True, the whole OR is True
        - False conditions (they don't affect OR)

        Args:
            conditions: List of rule dicts

        Returns:
            Simplified list of conditions
        """
        seen = []

        for cond in conditions:
            # True makes the whole OR true (both formats)
            if cond.get('type') == 'constant' and cond.get('value') is True:
                return [{'rule': 'True_'}]
            if cond.get('rule') == 'True_':
                return [{'rule': 'True_'}]

            # Skip False (doesn't affect OR) (both formats)
            if cond.get('type') == 'constant' and cond.get('value') is False:
                continue
            if cond.get('rule') == 'False_':
                continue

            # Skip duplicates (simple equality check)
            if cond not in seen:
                seen.append(cond)

        return seen

    def _simplify_and_conditions(self, conditions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Simplify a list of AND conditions.

        Removes:
        - Duplicate conditions
        - If any condition is False, the whole AND is False
        - True conditions (they don't affect AND)

        Args:
            conditions: List of rule dicts

        Returns:
            Simplified list of conditions
        """
        seen = []

        for cond in conditions:
            # False makes the whole AND false (both formats)
            if cond.get('type') == 'constant' and cond.get('value') is False:
                return [{'rule': 'False_'}]
            if cond.get('rule') == 'False_':
                return [{'rule': 'False_'}]

            # Skip True (doesn't affect AND) (both formats)
            if cond.get('type') == 'constant' and cond.get('value') is True:
                continue
            if cond.get('rule') == 'True_':
                continue

            # Skip duplicates (simple equality check)
            if cond not in seen:
                seen.append(cond)

        return seen if seen else [{'rule': 'True_'}]


class BunnyRulePatternMatcher:
    """Recognizes and identifies bunny rule lambda patterns.

    This class provides static methods for detecting whether a function
    is a bunny rule lambda from ALttP's set_bunny_rules() function.
    """

    @staticmethod
    def is_bunny_rule(func: Callable) -> bool:
        """Check if a function is a bunny rule lambda.

        Args:
            func: The function to check

        Returns:
            True if this appears to be a bunny rule lambda
        """
        if not callable(func):
            return False

        qualname = getattr(func, '__qualname__', '')
        return 'set_bunny_rules' in qualname

    @staticmethod
    def get_pattern_type(func: Callable) -> Optional[str]:
        """Identify which bunny rule pattern a function matches.

        Args:
            func: The function to analyze

        Returns:
            Pattern name string, or None if not a bunny rule
        """
        if not BunnyRulePatternMatcher.is_bunny_rule(func):
            return None

        closure_var_names = BunnyRulePatternMatcher._get_closure_var_names(func)

        # Match by closure variable signature
        if set(closure_var_names) == {'options'}:
            return 'options_to_access_rule'
        if {'path', 'entrance'} <= set(closure_var_names):
            return 'path_to_access_rule'
        if set(closure_var_names) == {'player'}:
            return 'simple_item_check'
        if 'player' in closure_var_names:
            return 'complex_check'

        return 'unknown'

    @staticmethod
    def _get_closure_var_names(func: Callable) -> List[str]:
        """Get the names of closure variables.

        Args:
            func: The function to inspect

        Returns:
            List of closure variable names
        """
        if hasattr(func, '__code__'):
            return list(func.__code__.co_freevars)
        return []
