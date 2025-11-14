# The Witness - Remaining Exporter Issues

This document tracks remaining issues related to the exporter for The Witness.

## Status
Last updated: 2025-11-14

## Issues

### Issue 1: Unresolved variable names in all_of rules (Related to Issue 2)
**Location**: Rules exported for laser activation locations (worlds/witness/rules.py:_meets_item_requirements)
**Severity**: Critical
**Description**: The exporter is not resolving variable names like `fully_converted_rules` in `all_of` rule iterators. These appear in laser activation location access rules.

**Root cause**: The Witness world creates complex lambda functions like:
```python
fully_converted_rules = [convert_requirement_option(sublist, player) for sublist in optimized_rule_conversion]
return lambda state: any(
    all(condition(state) for condition in sub_requirement)
    for sub_requirement in fully_converted_rules
)
```

The variable `fully_converted_rules` is a local variable that the lambda closes over. When the AST analyzer examines the lambda body, it sees references to this variable but cannot resolve it because it's part of the closure, not accessible from static analysis.

**Exported structure**:
```json
{
  "type": "helper",
  "name": "any",
  "args": [{
    "type": "generator_expression",
    "element": {
      "type": "all_of",
      "element_rule": {"type": "helper", "name": "condition", "args": []},
      "iterator_info": {
        "iterator": {
          "type": "subscript",
          "value": {"type": "name", "name": "fully_converted_rules"},
          "index": {"type": "constant", "value": 0}
        }
      }
    }
  }]
}
```

**Impact**: The frontend cannot evaluate the iterator because `fully_converted_rules` is undefined. This causes "all_of iterator is not an array" warnings and prevents proper rule evaluation.

**Test failure**:
```
WARN [ruleEngine] [evaluateRule] all_of iterator is not an array {rule: Object, iterable: undefined}
```

**Fix options**:
1. Modify the analyzer to capture and resolve closure variables when analyzing lambdas
2. Create special handling in the Witness exporter to detect this pattern and convert it to simpler rule structures
3. Modify the Witness world to avoid using complex comprehensions with local variables in lambdas

**Status**: Not fixed yet - requires deeper investigation into closure variable resolution

### Issue 2: Python built-in "any" function not handled
**Location**: Rules for Keep Laser Activated and other locations
**Severity**: High
**Description**: The exporter exports Python's built-in `any()` function as a helper call, but this is not a game-specific helper - it's a Python built-in that should be converted to equivalent logic (likely an "or" rule over a list).

**Impact**: The frontend cannot evaluate rules that use "any" because it's not defined in the helper functions.

**Test failure**:
```
ERROR [testSpoilerUI] Helper function "any" NOT FOUND in snapshotInterface
```

**Fix**: The exporter should detect and convert Python built-ins like `any()` and `all()` to appropriate rule structures (or/and over iterator elements).

**Status**: Not fixed yet

### Issue 3: Complex state manipulation rules exported
**Location**: Access rules for "Desert Behind Elevator" and similar regions
**Severity**: High
**Description**: The exporter is exporting complex Python implementation details like `state.stale["Desert Outside".player]` and `state.update_reachable_regions()` as conditional rules. These are internal implementation details that should be simplified.

**Impact**: The frontend cannot evaluate these rules because they reference internal Python state management that doesn't exist in JavaScript.

**Test failure**:
```
ISSUE: Access rule evaluation failed
```

**Fix**: These complex rules need to be analyzed and simplified to their logical intent, or marked as always-true/always-false if they're purely for optimization.

**Status**: Not fixed yet
