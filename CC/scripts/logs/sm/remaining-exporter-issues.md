# Super Metroid - Remaining Exporter Issues

## Issue 1: Over-conservative `accessFrom` + `SMBool(True)` handling

**Status:** Identified
**Priority:** High
**Sphere:** 0
**Locations affected:** Morphing Ball (and likely many others)

### Problem Description

The exporter is being overly conservative when handling location access rules that combine:
1. An `accessFrom` comprehension (which checks if the location is reachable from any connected region)
2. An `Available` rule of `evalSMBool(SMBool(True), ...)`

When this pattern is detected, the exporter exports the access rule as:
```json
{
  "type": "constant",
  "value": false
}
```

However, `evalSMBool(SMBool(True), ...)` means "no additional item requirements" - the location is accessible from the region with no items needed. If the `accessFrom` comprehension shows the region is reachable, then the location should be accessible as well.

### Current Behavior

File: `exporter/games/sm.py`
Lines: ~346-352

```python
# If Available has actual requirements, use it
# logger.info("SM: Using Available part with actual requirements")
# return expanded

# Check for accessFrom patterns that hit recursion limits
# These create infinitely nested structures that can't be properly evaluated
# CHANGED: Export as False instead of True to prevent incorrect accessibility
# until VARIA logic helpers are properly implemented
if self._check_accessFrom_pattern(rule):
    logger.info("SM: Found accessFrom comprehension pattern, exporting as constant False (VARIA logic not yet implemented)")
    print("[SM] Exporting accessFrom pattern as constant False (needs VARIA logic implementation)")
    return {'type': 'constant', 'value': False}
```

### Expected Behavior

When the `Available` part is `evalSMBool(SMBool(True), ...)` AND the `accessFrom` pattern is "simple" (i.e., returns `SMBool(True)` for all regions), the location should be exported as:
```json
{
  "type": "constant",
  "value": true
}
```

This is already partially implemented in lines 331-339:
```python
# Check if this is a simple accessFrom (just SMBool(True))
if self._is_simple_accessFrom(first):
    # Simple case: accessFrom returns SMBool(True) for all regions
    # This means the location is accessible from the region with no item requirements
    logger.info("SM: Simple accessFrom detected (SMBool(True)) - exporting as True")
    return {'type': 'constant', 'value': True}
```

But the `_is_simple_accessFrom` check is not detecting all simple cases.

### Evidence

From sphere log (Sphere 0):
```json
{"new_accessible_locations": ["Energy Tank, Brinstar Ceiling", "Morphing Ball"], ...}
```

From rules.json:
```json
{
  "name": "Morphing Ball",
  "id": 82026,
  "access_rule": {
    "type": "constant",
    "value": false
  }
}
```

### Proposed Fix

1. Improve the `_is_simple_accessFrom()` method to detect more cases where the `accessFrom` comprehension returns `SMBool(True)` for all regions
2. Alternatively, export the `accessFrom` pattern as `true` when the `Available` part is `SMBool(True)`, since this means "accessible from region with no items required"
3. Consider analyzing the actual regions in the `accessFrom` comprehension to determine if any are already accessible

### Related Code

- `exporter/games/sm.py:_is_simple_accessFrom()` (lines ~218-245)
- `exporter/games/sm.py:_check_accessFrom_pattern()` (lines ~154-181)
- `exporter/games/sm.py:expand_rule()` (lines ~302-459)
