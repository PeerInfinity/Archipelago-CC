# The Witness - Solved Exporter Issues

## Issue 1: Unanalyzed Lambda Functions in all_of Comprehension Patterns

**Status:** Resolved
**Date Resolved:** 2025-12-02
**Severity:** High
**Location:** exporter/analyzer/ast_visitors.py

**Description:**
The analyzer was not properly handling nested lambda comprehension patterns from `_meets_item_requirements()` in `worlds/witness/rules.py`. When the rule was:
```python
return lambda state: any(
    all(condition(state) for condition in sub_requirement)
    for sub_requirement in fully_converted_rules
)
```

The analyzer exported the inner lambdas as string representations like:
```json
"iterator": {
  "type": "constant",
  "value": ["<function convert_requirement_option.<locals>.<lambda>>"]
}
```

**Root Cause:**
The `fully_converted_rules` list contains lambda functions from `convert_requirement_option()` that are stored in a closure. When the analyzer processed the outer lambda, it saw the inner lambdas as constants (closure variables) and serialized them as strings instead of recursively analyzing them.

**Solution:**
Added handling in `ast_visitors.py` (around line 472) to detect when the iterator resolves to a list of lists of callables and recursively analyze each inner callable using `analyze_rule()`. The fix:

1. Detects when the resolved value is a list of lists (nested comprehension pattern)
2. Checks if each inner list contains callables
3. Recursively analyzes each callable to extract the actual rule logic
4. Wraps the result appropriately (all_of for inner lists, any_of for outer)

**Files Changed:**
- `exporter/analyzer/ast_visitors.py` - Added nested callable detection and recursive analysis

**Verification:**
The rules.json now correctly exports the nested patterns, and the Test Spoilers panel initializes and runs successfully.
