# Sonic the Hedgehog 1 UT Fuzz Failure Investigation

## Summary

The Sonic the Hedgehog 1 apworld was failing the Universal Tracker fuzz test with a ~10% failure rate. The failure type was "logic mismatch" (error type: None), where the UT thought locations were accessible when the server disagreed.

**Status: FIXED** - Both bugs have been resolved. The game now passes 100% of fuzz tests.

## Root Causes

There were two bugs in `world_generator/rule_codegen.py`:

### Bug 1: count_true with count > 3 fell back to True_()

**Location:** `_convert_count_true_logic()`, lines 2400-2416

When converting `count_true` rules with non-item_check conditions (like `location_check`), the codegen had a limitation:

```python
if count <= 3 and n <= 10:
    # Generate combinations using Or/And
    ...
# Fallback for complex cases: generate True_() with a warning
self.required_imports.add('True_')
return 'True_()'
```

If `count > 3`, the codegen fell back to `True_()`, which means the rule **always passed**.

**Fix:** Removed the `count <= 3` limit and now calculate actual combination count using `math.comb(n, count)`. If combinations <= 120, generate them properly.

### Bug 2: HasFromList counted total items instead of unique types

**Location:** `_convert_count_true_logic()`, lines 2386-2391

For count_true rules with item_check conditions (like emerald checks), the codegen used `HasFromList` which counts **total items**. But the semantic should be "at least N different item types", not "at least N total items".

Example: If you have 9000 Red Emeralds, `HasFromList(emeralds, count=5)` would pass because 9000 >= 5, even though you only have 1 unique emerald type.

**Fix:** Changed `HasFromList` to `HasFromListUnique` which counts unique item types.

## Original Failure Pattern

Failures showed this error:
```
Locations Final Zone Boss were expected to be in logic but weren't
```

This happened when:
1. `final_zone_last` was non-zero (requiring goals before Final Zone)
2. `specials_goal` was > 3 (triggering the count_true fallback to True_())
3. Or emerald_goal wasn't met but HasFromList passed due to duplicate items

## Fixes Applied

### Fix 1: Handle count > 3 in count_true
```python
# Before
if count <= 3 and n <= 10:
    ...
return 'True_()'  # Fallback

# After
from math import comb
num_combos = comb(n, count)
if num_combos <= 120:  # Covers 5-of-6, 4-of-7, 6-of-8, etc.
    # Generate proper combinations
    ...
```

### Fix 2: Use HasFromListUnique for item checks
```python
# Before
self.required_imports.add('HasFromList')
return f'HasFromList({items_str}, count={count})'

# After
self.required_imports.add('HasFromListUnique')
return f'HasFromListUnique({items_str}, count={count})'
```

## Test Results

After fixes:
```
Success: 200
Failures: 0
Timeouts: 0
Ignored: 0
```

## Files Modified

- `world_generator/rule_codegen.py` - Both fixes applied here

## Conclusion

Both bugs were in our codebase (world_generator), not in the Sonic 1 apworld. The fixes properly handle:
1. count_true rules with count > 3 by generating proper combinations
2. Item count checks by using unique item counting instead of total items
