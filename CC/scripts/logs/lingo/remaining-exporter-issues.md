# Remaining Exporter Issues

## Location access rule incorrectly exported as update_reachable_regions

**Status**: Needs investigation
**Priority**: Medium
**File**: Likely `exporter/analyzer.py` or rule analysis code

**Problem**:
The location "Second Room - LEVEL 2" has its access_rule exported as:
```json
{
  "type": "state_method",
  "method": "update_reachable_regions",
  "args": []
}
```

This is clearly incorrect - `update_reachable_regions` is a Python method name that should not be an access rule. The analyzer has captured a wrapper/helper method instead of the actual access rule.

**Impact**:
- The spoiler test fails at Sphere 1.3
- The location "Second Room - LEVEL 2" is not accessible in the JavaScript state (but should be according to the Python sphere log)
- The rule engine doesn't know how to evaluate a "state_method" of type "update_reachable_regions"

**Expected behavior**:
The location should have a proper access rule based on its panel requirements. Looking at the `access` field, it shows empty requirements, but the access_rule itself is malformed.

**Investigation needed**:
1. Check where the analyzer captures this method name
2. Determine what the actual access rule should be for "Second Room - LEVEL 2"
3. Fix the analyzer to properly capture the real access rule instead of the wrapper method

**Workaround**:
The location has an `access` field with empty requirements (no rooms, doors, colors, items), so it might work to use `_lingo_can_satisfy_requirements` with that access object instead of evaluating the broken access_rule.

