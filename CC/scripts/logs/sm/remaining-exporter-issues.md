# Remaining Exporter Issues - Super Metroid

This file tracks exporter-related issues that still need to be fixed.

## Issues

### 1. any_of rules with undefined iterators (closure variable resolution)

**Issue:** Location access rules use `any_of` with iterators that reference closure variables (e.g., `accessFrom.items()`). These closure variables are not resolved during export, causing the iterator to evaluate to `undefined` in JavaScript.

**Example locations affected:**
- Energy Tank, Brinstar Ceiling
- Morphing Ball

**Error in test:**
```
[ruleEngine] [evaluateRule] any_of iterator is not an array {rule: Object, iterable: undefined}
```

**Root cause:** The Python code uses:
```python
any((state.can_reach(accessName, player=player) and self.evalSMBool(rule(state.smbm[player]), ...))
    for accessName, rule in accessFrom.items())
```

The `accessFrom` dictionary is a closure variable that needs to be resolved and exported as a constant.

**Possible solutions:**
1. Add closure variable resolution to the exporter to export `accessFrom.keys()` as a constant list
2. Simplify the entire any_of to an OR of can_reach calls for each known access point
3. Have the analyzer resolve closure dictionaries and export their values

**Status:** OPEN - Requires exporter enhancement to resolve closure variables
