# Bunny Rule Analyzer Support

## Overview

This document outlines how to add native analyzer support for ALttP's bunny rules, replacing the current pre-computed workaround with full dynamic path analysis.

**Status**: Planning / Not Started
**Priority**: Low (current workaround is functional)
**Complexity**: High
**Date**: 2026-01-26

## Problem Statement

ALttP's bunny rules use dynamic BFS graph traversal at runtime to determine if a location can be reached without Moon Pearl. The resulting lambdas contain lists of opaque function objects that the current analyzer cannot process.

### Current Workaround

The `exporter/games/official/alttp.py` handler intercepts bunny rules and replaces them with pre-computed static rules:

| Location Type | Replacement Rule |
|---------------|------------------|
| Bunny-accessible locations | `True` |
| Mandatory superbunny paths (glitch modes) | `True` |
| Mirror superbunny locations (glitch modes) | `Has(Moon Pearl) OR Has(Magic Mirror)` |
| All other bunny territory | `Has(Moon Pearl)` |

This works for practical gameplay but loses the nuanced path-based logic of the original rules.

### Why Full Support Would Be Valuable

1. **Accuracy**: Some locations could be reached via specific paths without Moon Pearl
2. **Entrance shuffle**: Path availability changes with entrance randomization
3. **Glitch modes**: Complex superbunny paths have additional requirements
4. **Consistency**: Other rule patterns are fully analyzed; bunny rules are the exception

## Technical Analysis

### What the Analyzer Currently Sees

When analyzing `options_to_access_rule(possible_options)`:

```python
# The lambda
lambda state: any(rule(state) for rule in options)

# AST structure
GeneratorExp(
    elt=Call(func=Name(id='rule'), args=[Name(id='state')]),
    generators=[comprehension(
        target=Name(id='rule'),
        iter=Name(id='options')  # <-- This resolves to a list of functions
    )]
)
```

The analyzer resolves `options` from closure variables and gets:

```python
[<function at 0x...>, <function at 0x...>, <function at 0x...>]
```

These are opaque Python function objects that cannot be:
- Serialized to JSON
- Analyzed (no AST, just bytecode)
- Evaluated by the frontend

### The Nested Structure

The `options` list contains:

1. **Base option**: `lambda state: state.has('Moon Pearl', player)`
   - Analyzable via `inspect.getsource()`

2. **Path options**: Results of `path_to_access_rule(path, entrance)`
   ```python
   lambda state: state.can_reach(entrance.name, 'Entrance', entrance.player) and all(
       rule(state) for rule in path)
   ```
   - `entrance` is resolvable (has `.name` attribute)
   - `path` is a list of `entrance.access_rule` functions (recursive problem)

3. **Superbunny options** (glitch modes): Additional item requirements
   ```python
   lambda state: path_to_access_rule(new_path, entrance) and state.has('Magic Mirror', player)
   ```

### The Recursion Challenge

Each `path` element is an `entrance.access_rule`, which could be:
- A simple item check (analyzable)
- A combined rule from `add_rule()` (analyzable with unwrapping)
- Another bunny rule (recursive)
- Any other access rule

## Proposed Implementation

### Phase 1: Closure Function Analyzer

Add capability to analyze function objects found in closures.

**File: `exporter/analyzer/closure_function_analyzer.py`**

```python
"""Analyzer for function objects found in closure variables."""

import ast
import inspect
from typing import Any, Dict, List, Optional, Set

class ClosureFunctionAnalyzer:
    """Analyzes function objects to extract their rule logic.

    This handles functions that are stored in closure variables,
    where we have the function object but need to analyze its behavior.
    """

    def __init__(self, parent_analyzer, max_depth: int = 10):
        self.parent_analyzer = parent_analyzer
        self.max_depth = max_depth
        self._seen_functions: Set[int] = set()  # Cycle detection

    def analyze_function(self, func, depth: int = 0) -> Optional[Dict[str, Any]]:
        """Attempt to analyze a function object.

        Args:
            func: The function object to analyze
            depth: Current recursion depth

        Returns:
            Analyzed rule dict, or None if unanalyzable
        """
        if depth > self.max_depth:
            return None

        func_id = id(func)
        if func_id in self._seen_functions:
            return {'type': 'circular_reference'}
        self._seen_functions.add(func_id)

        try:
            # Method 1: Try to get source and parse AST
            result = self._analyze_via_source(func, depth)
            if result:
                return result

            # Method 2: Analyze by inspecting closure structure
            result = self._analyze_via_closure_pattern(func, depth)
            if result:
                return result

            return None
        finally:
            self._seen_functions.discard(func_id)

    def _analyze_via_source(self, func, depth: int) -> Optional[Dict[str, Any]]:
        """Try to analyze function via source code."""
        try:
            source = inspect.getsource(func)
            # Remove leading indentation
            source = textwrap.dedent(source)
            tree = ast.parse(source)

            # Find lambda or function body
            for node in ast.walk(tree):
                if isinstance(node, ast.Lambda):
                    # Create sub-analyzer with function's closure vars
                    closure_vars = self._extract_closure_vars(func)
                    sub_analyzer = RuleAnalyzer(
                        closure_vars=closure_vars,
                        rule_func=func,
                        player_context=self.parent_analyzer.player_context
                    )
                    return sub_analyzer.visit(node.body)
        except (OSError, TypeError):
            # Source not available for dynamically created functions
            pass
        return None

    def _analyze_via_closure_pattern(self, func, depth: int) -> Optional[Dict[str, Any]]:
        """Analyze by recognizing closure variable patterns."""
        if not hasattr(func, '__closure__') or not func.__closure__:
            return None

        closure_vars = self._extract_closure_vars(func)
        qualname = getattr(func, '__qualname__', '')

        # Pattern: options_to_access_rule result
        if 'options' in closure_vars and isinstance(closure_vars['options'], list):
            return self._analyze_options_pattern(closure_vars['options'], depth)

        # Pattern: path_to_access_rule result
        if 'path' in closure_vars and 'entrance' in closure_vars:
            return self._analyze_path_pattern(
                closure_vars['path'],
                closure_vars['entrance'],
                depth
            )

        # Pattern: Simple item check with 'player' captured
        if 'player' in closure_vars and len(closure_vars) <= 2:
            return self._analyze_simple_check(func, closure_vars)

        return None

    def _analyze_options_pattern(self, options: List, depth: int) -> Dict[str, Any]:
        """Analyze any(rule(state) for rule in options) pattern."""
        analyzed_options = []
        for option_func in options:
            if callable(option_func):
                result = self.analyze_function(option_func, depth + 1)
                if result:
                    analyzed_options.append(result)
                else:
                    # Unanalyzable option - return conservative rule
                    return {'type': 'item_check', 'item': 'Moon Pearl'}

        if len(analyzed_options) == 1:
            return analyzed_options[0]

        return {'type': 'or', 'conditions': analyzed_options}

    def _analyze_path_pattern(self, path: List, entrance, depth: int) -> Dict[str, Any]:
        """Analyze path_to_access_rule result."""
        # Build the can_reach part
        entrance_name = getattr(entrance, 'name', str(entrance))
        can_reach = {
            'type': 'state_method',
            'method': 'can_reach',
            'args': [
                {'type': 'constant', 'value': entrance_name},
                {'type': 'constant', 'value': 'Entrance'}
            ]
        }

        # Analyze each rule in path
        path_conditions = []
        for rule_func in path:
            if callable(rule_func):
                result = self.analyze_function(rule_func, depth + 1)
                if result:
                    path_conditions.append(result)
                else:
                    # Unanalyzable path rule - return conservative
                    return {'type': 'item_check', 'item': 'Moon Pearl'}

        # Combine: can_reach AND all(path)
        if not path_conditions:
            return can_reach

        all_conditions = [can_reach] + path_conditions
        return {'type': 'and', 'conditions': all_conditions}

    def _extract_closure_vars(self, func) -> Dict[str, Any]:
        """Extract closure variables from a function."""
        result = {}
        if hasattr(func, '__closure__') and func.__closure__:
            if hasattr(func, '__code__'):
                freevars = func.__code__.co_freevars
                for name, cell in zip(freevars, func.__closure__):
                    try:
                        result[name] = cell.cell_contents
                    except ValueError:
                        pass  # Empty cell
        return result
```

### Phase 2: Generator Expression Handler

Update the analyzer to handle `any()`/`all()` with function lists.

**File: `exporter/analyzer/ast_visitors/call_visitor.py`**

Add handling for generator expressions that iterate over closure function lists:

```python
def _handle_any_all_generator(self, node: ast.Call, func_name: str) -> Optional[Dict[str, Any]]:
    """Handle any()/all() with generator expressions over function lists.

    Patterns:
        any(rule(state) for rule in options)
        all(rule(state) for rule in path)
    """
    if not node.args or not isinstance(node.args[0], ast.GeneratorExp):
        return None

    gen = node.args[0]

    # Check if element is a function call: rule(state)
    if not isinstance(gen.elt, ast.Call):
        return None
    if not isinstance(gen.elt.func, ast.Name):
        return None

    iter_var_name = gen.elt.func.id  # 'rule'

    # Get the iterator
    if not gen.generators:
        return None
    comp = gen.generators[0]

    # Check that we're iterating over a closure variable
    if not isinstance(comp.iter, ast.Name):
        return None

    list_var_name = comp.iter.id  # 'options' or 'path'

    # Resolve the list from closure vars
    func_list = self.expression_resolver.resolve_variable(list_var_name)
    if not isinstance(func_list, list):
        return None

    # Check if all elements are callable
    if not all(callable(f) for f in func_list):
        return None

    # Use ClosureFunctionAnalyzer to analyze each function
    from .closure_function_analyzer import ClosureFunctionAnalyzer
    closure_analyzer = ClosureFunctionAnalyzer(self)

    analyzed_rules = []
    for func in func_list:
        result = closure_analyzer.analyze_function(func)
        if result:
            analyzed_rules.append(result)
        else:
            # Unanalyzable function - fall back to conservative rule
            logging.warning(f"Could not analyze function in {func_name}() generator")
            return None

    if not analyzed_rules:
        return {'type': 'constant', 'value': func_name == 'all'}  # all([]) = True, any([]) = False

    if len(analyzed_rules) == 1:
        return analyzed_rules[0]

    rule_type = 'or' if func_name == 'any' else 'and'
    return {'type': rule_type, 'conditions': analyzed_rules}
```

### Phase 3: Pattern Recognition for Bunny Rule Lambdas

Add specific pattern detection for `set_bunny_rules` lambda structures.

```python
class BunnyRulePatternMatcher:
    """Recognizes and analyzes bunny rule lambda patterns."""

    # Known patterns from set_bunny_rules
    PATTERNS = {
        'options_to_access_rule': {
            'closure_vars': ['options'],
            'structure': 'any(rule(state) for rule in options)'
        },
        'path_to_access_rule': {
            'closure_vars': ['path', 'entrance'],
            'structure': 'can_reach(entrance) and all(path)'
        },
        'moon_pearl_check': {
            'closure_vars': ['player'],
            'structure': "state.has('Moon Pearl', player)"
        },
        'mirror_check': {
            'closure_vars': ['player'],
            'structure': "state.has('Magic Mirror', player)"
        }
    }

    @classmethod
    def match_pattern(cls, func) -> Optional[str]:
        """Identify which bunny rule pattern a function matches."""
        if not callable(func):
            return None

        closure_vars = cls._get_closure_var_names(func)
        qualname = getattr(func, '__qualname__', '')

        # Check for set_bunny_rules origin
        if 'set_bunny_rules' not in qualname:
            return None

        # Match by closure variable signature
        if set(closure_vars) == {'options'}:
            return 'options_to_access_rule'
        if set(closure_vars) >= {'path', 'entrance'}:
            return 'path_to_access_rule'
        if closure_vars == ['player'] or set(closure_vars) == {'player'}:
            return 'simple_check'

        return None

    @staticmethod
    def _get_closure_var_names(func) -> List[str]:
        """Get the names of closure variables."""
        if hasattr(func, '__code__'):
            return list(func.__code__.co_freevars)
        return []
```

### Phase 4: Frontend Path Evaluation

The frontend would need to evaluate analyzed bunny rules. This requires:

**File: `frontend/modules/shared/stateInterface.js`**

```javascript
// Add support for path-based bunny rule evaluation

function evaluatePathRule(rule, state, slotData) {
    // rule structure:
    // {
    //   type: 'or',
    //   conditions: [
    //     { type: 'item_check', item: 'Moon Pearl' },
    //     {
    //       type: 'and',
    //       conditions: [
    //         { type: 'can_reach', target: 'Lake Hylia Island', target_type: 'Entrance' },
    //         { type: 'item_check', item: 'Flippers' }
    //       ]
    //     }
    //   ]
    // }

    switch (rule.type) {
        case 'or':
            return rule.conditions.some(c => evaluatePathRule(c, state, slotData));
        case 'and':
            return rule.conditions.every(c => evaluatePathRule(c, state, slotData));
        case 'item_check':
            return state.hasItem(rule.item);
        case 'can_reach':
            if (rule.target_type === 'Entrance') {
                return state.isEntranceReachable(rule.target);
            }
            return state.isRegionReachable(rule.target);
        default:
            return evaluateRule(rule, state, slotData);  // Delegate to existing
    }
}
```

### Phase 5: Integration and Testing

1. Add `ClosureFunctionAnalyzer` to analyzer module
2. Update `call_visitor.py` to use new handler for `any()`/`all()`
3. Add pattern matcher for bunny rules
4. Remove workaround code from `alttp.py` handler
5. Update frontend to handle new rule structures
6. Comprehensive testing with entrance shuffle seeds

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Cycle detection fails | Medium | High | Track seen function IDs, depth limit |
| Source unavailable for lambdas | High | Medium | Fall back to closure pattern matching |
| Performance degradation | Medium | Low | Cache analyzed functions |
| Incomplete pattern coverage | Medium | Medium | Conservative fallback to Moon Pearl |

### Compatibility Risks

| Risk | Description | Mitigation |
|------|-------------|------------|
| Rule structure changes | Analyzed rules may differ from workaround | Thorough regression testing |
| Frontend complexity | Path evaluation adds code | Clear separation of concerns |
| Entrance shuffle edge cases | Paths vary per seed | Test multiple shuffle configurations |

## Success Criteria

1. **Functional**: Bunny rules analyzed without special-case handler
2. **Accurate**: Path-based rules produce correct reachability
3. **Complete**: All bunny rule patterns recognized and analyzed
4. **Performant**: Analysis completes within acceptable time
5. **Tested**: Seeds 1-10 pass with various entrance shuffle settings

## Alternatives Considered

### Alternative 1: Enhanced Pre-computation

Instead of full analysis, enhance the pre-computed rules with more cases:

**Pros**: Simpler, no recursive analysis needed
**Cons**: Still loses path-specific logic, maintenance burden

### Alternative 2: Runtime Path Tracing in Frontend

Export the region graph and let the frontend do BFS:

**Pros**: Accurate path evaluation
**Cons**: Significant frontend complexity, performance concerns

### Alternative 3: Hybrid Approach

Analyze what we can, fall back to pre-computed for the rest:

**Pros**: Incremental improvement, graceful degradation
**Cons**: Two systems to maintain, inconsistent behavior

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Closure Function Analyzer | 2-3 days | None |
| Phase 2: Generator Expression Handler | 1-2 days | Phase 1 |
| Phase 3: Pattern Recognition | 1-2 days | Phases 1-2 |
| Phase 4: Frontend Path Evaluation | 2-3 days | Phases 1-3 |
| Phase 5: Integration and Testing | 2-3 days | Phases 1-4 |
| **Total** | **8-13 days** | |

## Recommendation

**Defer implementation** unless there is a specific need for path-accurate bunny rules.

The current workaround:
- Is functional and well-tested
- Captures the essential gameplay requirement (Moon Pearl for bunny territory)
- Is significantly simpler to maintain
- Has no known issues in practice

Full analyzer support would be a significant undertaking with marginal practical benefit. Consider implementing only if:
- Users report incorrect reachability in entrance shuffle
- Other games need similar dynamic path analysis
- The analyzer architecture is being refactored anyway

## References

- `worlds/alttp/Rules.py` lines 1653-1783: Original `set_bunny_rules()` implementation
- `exporter/games/official/alttp.py`: Current bunny rule workaround
- `exporter/analyzer/ast_visitors/call_visitor.py`: Existing generator expression handling
- `frontend/modules/shared/stateInterface.js`: Frontend rule evaluation
