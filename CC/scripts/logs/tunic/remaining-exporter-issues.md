# TUNIC - Remaining Exporter Issues

This file tracks exporter issues that still need to be fixed.

## Issues

### Issue 1: Frontend rule engine evaluation issue

**Status:** Under Investigation
**Priority:** High
**Test Failure:** Sphere 0.14 - Region "Overworld Holy Cross" not reachable
**Previous Issue:** Missing ability_unlocks data export - **FIXED** (see solved-exporter-issues.md)

**Current Problem:**
After fixing the ability_unlocks subscript resolution, the test still fails. The access rule for "Overworld -> Overworld Holy Cross" exit contains nested conditionals that may not be evaluating correctly in the frontend.

The rule structure:
```
if not 1:  # evaluates to False
  return True
else:
  if 0 and (0 == 0):  # evaluates to False
    return has "Gold Questagon" count 1
  else:
    return has "Pages 42-43 (Holy Cross)"
```

The player receives "Pages 42-43 (Holy Cross)" in sphere 0.14, which should make the inner `if_false` branch evaluate to true and grant access to the region.

**Possible Causes:**
1. Frontend item_check not working for items without count parameter
2. Nested conditional evaluation issue in ruleEngine.js
3. Item not properly added to inventory before region reachability check
4. Rule constants (0, 1) not being evaluated as truthy/falsy correctly

**Next Steps:**
1. Check if frontend evaluates constant 0 as falsy and constant 1 as truthy
2. Verify item_check works without explicit count parameter
3. Test if the exact rule structure evaluates correctly in isolation
4. May need to create TUNIC helper functions if the rule structure is too complex for generic evaluation
