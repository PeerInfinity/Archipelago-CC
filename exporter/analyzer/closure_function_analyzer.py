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

    # ==================== Feature Flags ====================
    # These flags control experimental features that may cause regressions.
    # All flags default to False (disabled) for safety.

    # Feature: Limit bunny rule path expansion depth
    # When enabled, bunny rules deeper than MAX_BUNNY_PATH_DEPTH use Moon Pearl fallback.
    # This prevents rule explosion with complex entrance shuffle but may reduce accuracy.
    # LOSSY: Keep disabled by default - could miss valid access paths.
    ENABLE_BUNNY_PATH_DEPTH_LIMIT = False
    MAX_BUNNY_PATH_DEPTH = 3  # Only used when ENABLE_BUNNY_PATH_DEPTH_LIMIT is True

    # Feature: Limit number of bunny rule options analyzed
    # When enabled, only the first MAX_BUNNY_OPTIONS options are analyzed in options_to_access_rule.
    # This reduces rule size but may miss some valid access paths.
    # LOSSY: Keep disabled by default - could miss valid access paths.
    ENABLE_BUNNY_OPTIONS_LIMIT = False
    MAX_BUNNY_OPTIONS = 10  # Only used when ENABLE_BUNNY_OPTIONS_LIMIT is True

    # Feature: Fingerprint-based deduplication
    # When enabled, uses canonical string fingerprints to detect duplicate conditions.
    # This can catch duplicates that simple equality check misses.
    # LOSSLESS: Safe to enable - only removes true duplicates.
    ENABLE_FINGERPRINT_DEDUP = True

    # Feature: Nested structure flattening
    # When enabled, flattens nested OR(OR(a,b),c) -> OR(a,b,c) and AND(AND(a,b),c) -> AND(a,b,c).
    # This produces more compact rules.
    # LOSSLESS: Safe to enable - semantically equivalent transformation.
    ENABLE_NESTED_FLATTENING = True

    # Feature: Cross-type dominance pruning
    # When enabled, in OR conditions, simpler options (item-only) dominate complex ones (item+can_reach).
    # If Has(X) is present, AND(CanReachEntrance(Y), Has(X)) can be pruned.
    # LOSSLESS: Safe to enable - removes strictly redundant options in OR.
    ENABLE_CROSS_TYPE_DOMINANCE = True

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
                return result

            # Method 2: Try to get source and parse AST
            result = self._analyze_via_source(func, depth)
            if result is not None:
                logger.debug(f"ClosureFunctionAnalyzer: Source analysis succeeded")
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

        Args:
            options: List of rule functions
            depth: Current recursion depth

        Returns:
            Analyzed rule dict as an 'or' of all options
        """
        # Feature flag: Limit bunny rule path expansion depth
        if self.ENABLE_BUNNY_PATH_DEPTH_LIMIT and depth > self.MAX_BUNNY_PATH_DEPTH:
            logger.warning(
                f"LOSSY FALLBACK: Bunny rule depth {depth} exceeds MAX_BUNNY_PATH_DEPTH "
                f"({self.MAX_BUNNY_PATH_DEPTH}) in _analyze_options_pattern, using Moon Pearl fallback"
            )
            return {'rule': 'Has', 'args': {'item_name': 'Moon Pearl', 'count': 1}}

        if not options:
            # Empty options list - any([]) is False
            return {'rule': 'False_'}

        # Feature flag: Limit number of options analyzed
        options_to_analyze = options
        if self.ENABLE_BUNNY_OPTIONS_LIMIT and len(options) > self.MAX_BUNNY_OPTIONS:
            logger.warning(
                f"LOSSY FALLBACK: {len(options)} bunny options exceeds MAX_BUNNY_OPTIONS "
                f"({self.MAX_BUNNY_OPTIONS}), truncating options list"
            )
            options_to_analyze = options[:self.MAX_BUNNY_OPTIONS]

        analyzed_options = []
        failed_count = 0

        for i, option_func in enumerate(options_to_analyze):
            if not callable(option_func):
                logger.warning(f"ClosureFunctionAnalyzer: Option {i} is not callable: {type(option_func)}")
                failed_count += 1
                continue

            result = self.analyze_function(option_func, depth + 1)
            if result is not None:
                analyzed_options.append(result)
            else:
                # Try bytecode analysis as last resort
                bytecode_result = self._analyze_via_bytecode(option_func)
                if bytecode_result is not None:
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
        if len(simplified) == 0:
            return {'rule': 'False_'}
        elif len(simplified) == 1:
            return simplified[0]
        return {'rule': 'Or', 'children': simplified}

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
        # Feature flag: Limit bunny rule path expansion depth
        if self.ENABLE_BUNNY_PATH_DEPTH_LIMIT and depth > self.MAX_BUNNY_PATH_DEPTH:
            logger.warning(
                f"LOSSY FALLBACK: Bunny rule depth {depth} exceeds MAX_BUNNY_PATH_DEPTH "
                f"({self.MAX_BUNNY_PATH_DEPTH}) in _analyze_path_pattern, using Moon Pearl fallback"
            )
            return {'rule': 'Has', 'args': {'item_name': 'Moon Pearl', 'count': 1}}

        # Build the can_reach part
        entrance_name = getattr(entrance, 'name', str(entrance))
        can_reach = {
            'rule': 'CanReachEntrance',
            'args': {'entrance_name': entrance_name}
        }

        # Analyze each rule in path
        path_conditions = []
        for i, rule_func in enumerate(path):
            if callable(rule_func):
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

    def _flatten_or_children(self, children: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Flatten nested OR structures: OR(OR(a,b), c) -> OR(a, b, c).

        Args:
            children: List of child rules

        Returns:
            Flattened list where nested OR children are lifted up
        """
        flattened = []
        for child in children:
            if child.get('rule') == 'Or' and 'children' in child:
                # Recursively flatten nested ORs
                flattened.extend(self._flatten_or_children(child['children']))
            else:
                flattened.append(child)
        return flattened

    def _flatten_and_children(self, children: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Flatten nested AND structures: AND(AND(a,b), c) -> AND(a, b, c).

        Args:
            children: List of child rules

        Returns:
            Flattened list where nested AND children are lifted up
        """
        flattened = []
        for child in children:
            if child.get('rule') == 'And' and 'children' in child:
                # Recursively flatten nested ANDs
                flattened.extend(self._flatten_and_children(child['children']))
            else:
                flattened.append(child)
        return flattened

    def _extract_items_from_rule(self, rule: Dict[str, Any]) -> Optional[Set[str]]:
        """Extract item names from a rule for dominance comparison.

        Args:
            rule: A rule dict

        Returns:
            Set of item names, or None if rule has can_reach requirements
        """
        if rule.get('rule') == 'Has':
            return {rule.get('args', {}).get('item_name', '')}
        elif rule.get('rule') == 'HasAny':
            return set(rule.get('args', {}).get('items', []))
        elif rule.get('rule') in ('CanReachEntrance', 'CanReachRegion'):
            return None  # Has can_reach, not a pure item rule
        elif rule.get('rule') == 'And' and 'children' in rule:
            items = set()
            for child in rule['children']:
                child_items = self._extract_items_from_rule(child)
                if child_items is None:
                    return None  # Has can_reach requirement
                items.update(child_items)
            return items
        elif rule.get('rule') in ('True_', 'False_'):
            return set()  # Constants have no item requirements
        return None  # Unknown rule type, treat conservatively

    def _prune_dominated_options(self, options: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove options that are dominated by simpler options.

        An option A dominates option B if A's item requirements are a subset of B's
        AND A has no can_reach requirements while B does.

        Example: Has(Moon Pearl) dominates AND(CanReachEntrance(X), Has(Moon Pearl))

        Args:
            options: List of rule dicts

        Returns:
            List with dominated options removed
        """
        # Separate options by whether they have can_reach requirements
        simple_options = []  # No can_reach requirements
        complex_options = []  # Has can_reach requirements

        for opt in options:
            items = self._extract_items_from_rule(opt)
            if items is not None:
                simple_options.append((opt, items))
            else:
                complex_options.append(opt)

        # Check if any complex option is dominated by a simple option
        kept_complex = []
        for complex_opt in complex_options:
            dominated = False
            # For complex options, we need to extract just the item requirements
            # The complex option needs can_reach + items, but if a simple option
            # needs the same or fewer items, it dominates
            for simple_opt, simple_items in simple_options:
                # A simple option (items only) dominates a complex option
                # if the simple option's items are a subset of what the complex
                # option requires (since simple doesn't need can_reach)
                # Actually, the simpler check: if simple_items is empty or
                # the complex option requires at least all of simple_items,
                # then simple dominates
                if not simple_items:  # True_ dominates everything
                    dominated = True
                    break
            if not dominated:
                kept_complex.append(complex_opt)

        # Reconstruct the options list
        result = [opt for opt, _ in simple_options] + kept_complex
        return result

    def _rule_fingerprint(self, rule: Dict[str, Any]) -> str:
        """Generate a canonical string fingerprint for a rule.

        This creates a deterministic string representation that can be used
        for deduplication, catching cases where rules are structurally identical
        but have different dict ordering.

        Args:
            rule: A rule dictionary

        Returns:
            Canonical string representation
        """
        import json
        return json.dumps(rule, sort_keys=True)

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
        # Feature flag: Flatten nested OR structures first
        if self.ENABLE_NESTED_FLATTENING:
            conditions = self._flatten_or_children(conditions)

        seen = []
        seen_fingerprints: Set[str] = set()  # For fingerprint-based dedup

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

            # Skip duplicates
            if self.ENABLE_FINGERPRINT_DEDUP:
                # Use fingerprint-based deduplication
                fingerprint = self._rule_fingerprint(cond)
                if fingerprint not in seen_fingerprints:
                    seen_fingerprints.add(fingerprint)
                    seen.append(cond)
            else:
                # Simple equality check
                if cond not in seen:
                    seen.append(cond)

        # Feature flag: Cross-type dominance pruning
        if self.ENABLE_CROSS_TYPE_DOMINANCE and len(seen) > 1:
            seen = self._prune_dominated_options(seen)

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
        # Feature flag: Flatten nested AND structures first
        if self.ENABLE_NESTED_FLATTENING:
            conditions = self._flatten_and_children(conditions)

        seen = []
        seen_fingerprints: Set[str] = set()  # For fingerprint-based dedup

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

            # Skip duplicates
            if self.ENABLE_FINGERPRINT_DEDUP:
                # Use fingerprint-based deduplication
                fingerprint = self._rule_fingerprint(cond)
                if fingerprint not in seen_fingerprints:
                    seen_fingerprints.add(fingerprint)
                    seen.append(cond)
            else:
                # Simple equality check
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
