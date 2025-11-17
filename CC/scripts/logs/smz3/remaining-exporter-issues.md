# SMZ3 - Remaining Exporter Issues

This file tracks remaining issues in the SMZ3 exporter (exporter/games/smz3.py).

## Issue 1: loc.Available() pattern not being extracted

**Status**: In Progress

**Description**: Location access rules are not being properly converted by the exporter's `override_rule_analysis` method. The rules remain in their raw form with references to `loc.Available()` which don't exist in the JavaScript context.

**Example location**: Aginah's Cave, Blind's Hideout locations, etc. (all SMZ3 locations)

**Current behavior**: Access rules exported as:
```json
{
  "type": "function_call",
  "function": {
    "type": "attribute",
    "object": {"type": "name", "name": "loc"},
    "attr": "Available"
  },
  "args": [...]
}
```

**Expected behavior**: The exporter should extract the `loc` object from the lambda's default arguments and analyze its `canAccess` function, converting it to proper item_check, helper, and other rule types.

**Error message**: `Name "loc" NOT FOUND in context`

**Root cause**: The `override_rule_analysis` method in the SMZ3 exporter is not successfully extracting and analyzing the TotalSMZ3 Location objects. This could be because:
1. The `loc` object is not being found in the function's default arguments
2. The `canAccess` attribute doesn't exist or is named differently
3. The extracted logic isn't being properly analyzed

**Next steps**:
1. Add debug logging to understand why the extraction is failing
2. Check the actual structure of SMZ3 location rules in the Python code
3. Verify that the Location objects have the expected `canAccess` method
