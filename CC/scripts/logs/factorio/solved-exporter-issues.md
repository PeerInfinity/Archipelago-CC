# Solved Exporter Issues for Factorio

This file tracks issues that have been solved in the exporter (exporter/games/factorio.py).

## Issue 1: List Comprehension Expansion - SOLVED

**Status**: ✅ FIXED in commit bb65044

**Description**:
Locations with `all(generator_expression)` patterns where the iterator contains simple values (strings, frozensets) were not being expanded, resulting in unresolved `all_of` rules with `iterator_info`.

**Solution**:
Enhanced the analyzer in `exporter/analyzer/ast_visitors.py` to:
1. Detect non-callable iterators in comprehensions
2. Convert frozensets/sets/tuples to lists
3. Expand the comprehension by substituting each value into the element rule
4. Return an 'and' of all expanded conditions

Added `_substitute_variable_in_rule()` helper method to recursively substitute variables in rule structures, including f_strings.

**Impact**:
Fixed 31+ Factorio locations that were previously failing. Test now progresses from sphere 0.0 to sphere 0.1 successfully.

**Files Changed**:
- `exporter/analyzer/ast_visitors.py`: Added comprehension expansion logic (lines 244-309, 1134-1207)
