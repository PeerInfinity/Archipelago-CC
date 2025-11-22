# Solved Exporter Issues

## Issue 1: `any_of` iterator is undefined

**Symptom**: Test failed with timeout and many warnings:
```
[WARN] [ruleEngine] [evaluateRule] any_of iterator is not an array {rule: Object, iterable: undefined}
```

**Root Cause**: The SMZ3 exporter's `postprocess_rule` method wasn't recursively processing:
1. `ItemType.X` attribute accesses (used in iterator lists)
2. `any_of` rule structures
3. `list` type rules

**Solution**: Added to `exporter/games/smz3.py`:
1. Handler for `ItemType.X` patterns - converts to constants with attribute name as value
2. Recursive processing of `any_of` rules (element_rule and iterator_info)
3. Recursive processing of `list` rules

**Files Modified**:
- `exporter/games/smz3.py` - Added `ItemType` attribute handling and recursive processing for `any_of` and `list` rules

**Result**: No more "any_of iterator" errors. Test now progresses to event 78/120 before hitting a different timeout issue.

