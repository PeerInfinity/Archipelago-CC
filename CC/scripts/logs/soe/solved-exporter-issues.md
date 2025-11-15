# Secret of Evermore - Solved Exporter Issues

## Issue 1: "Done" location had null access_rule ✓ SOLVED

**Status:** Solved
**Priority:** High
**Type:** Exporter - Rule Conversion
**Fixed in:** exporter/games/soe.py

### Description
The "Done" location (victory event) had `access_rule: null` in the exported rules.json, making it accessible immediately at Sphere 0. This caused the spoiler test to fail because the location should only be accessible after defeating the final boss.

### Root Cause
The exporter's `_convert_logic_has_call()` method was checking for `pyevermizer.P_XXX` attribute references, but the analyzer had already resolved these to constant values (e.g., `pyevermizer.P_FINAL_BOSS` → `11`). The pattern matching failed, causing the rule to be discarded.

### Solution
Updated `_convert_logic_has_call()` in exporter/games/soe.py to handle both patterns:
1. Already-resolved constants: `{"type": "constant", "value": 11}`
2. Unresolved attribute references: `{"type": "attribute", "object": {"type": "name", "name": "pyevermizer"}, "attr": "P_XXX"}`

The fix also properly validates that the function being called is specifically `self.logic.has` by checking the full chain: `self` → `logic` → `has`.

### Changes Made
- Modified `_convert_logic_has_call()` to check if args[0] is a constant and extract the progress_id directly
- Added proper verification of the `self.logic.has` call chain
- Added support for extracting optional count parameter from args[1]
- Cleaned up debug logging throughout the exporter

### Verification
After the fix, the "Done" location correctly exports:
```json
{
  "type": "helper",
  "name": "has",
  "args": [
    {"type": "constant", "value": 11},
    {"type": "constant", "value": 1}
  ],
  "comment": "Requires 1x P_FINAL_BOSS"
}
```

### Files Modified
- `exporter/games/soe.py` - Lines 176-249 (updated `_convert_logic_has_call` and `postprocess_rule`)
