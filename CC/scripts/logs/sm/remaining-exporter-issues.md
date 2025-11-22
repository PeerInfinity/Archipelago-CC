# Super Metroid - Remaining Exporter Issues

## Issue 1: Cannot properly export AccessFrom patterns due to analyzer recursion limits

**Status:** Investigated - Solution Attempt 1 Failed
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

### Root Cause Analysis

The core issue is that Super Metroid's `AccessFrom` pattern creates deeply nested comprehensions that trigger the analyzer's recursion limits. When this happens:

1. The analyzer creates corrupted nested `any_of` structures
2. Complex helper calls (like `canPassTerminatorBombWall()`) are lost in the corruption
3. The exporter cannot distinguish simple patterns (SMBool(True)) from complex patterns (actual item requirements)

### Failed Solution Attempt 1: Detect Complex Helpers

**Approach:** Use `_contains_complex_helpers()` to scan the accessFrom structure for VARIA logic methods

**Why it failed:**
- The recursion corruption hides complex helpers so deep in nested structures that they're undetectable
- Both simple and complex patterns look identical after corruption
- All patterns appear to have no complex helpers, leading to false positives

**Evidence:**
- 60 locations marked as "simple" (has_complex_helpers=False)
- 0 locations marked as "complex"
- But locations like "Energy Tank, Terminator" ARE complex (require canPassTerminatorBombWall)
- These were incorrectly exported as `access_rule: true`, causing spoiler test failures

### Alternative Approaches to Consider

1. **Use Python Source Introspection**
   - Parse the actual Python source code for AccessFrom definitions
   - Extract requirements directly from lambda expressions
   - Pro: Gets ground truth without analyzer corruption
   - Con: Requires Python AST parsing, fragile to code changes

2. **Export AccessFrom to Region Connections**
   - Instead of location access rules, put AccessFrom requirements in region connections
   - Each AccessFrom entry becomes a region connection with proper requirements
   - Pro: Matches the Super Metroid architecture better
   - Con: Requires significant exporter refactoring

3. **Pre-Process AccessFrom Before Analysis**
   - Detect AccessFrom patterns early and convert them to a different structure
   - Avoid the comprehension that triggers recursion limits
   - Pro: Prevents corruption at the source
   - Con: Requires understanding analyzer internals

4. **Conservative Fallback with Whitelist**
   - Maintain a whitelist of known-simple locations (like Morphing Ball)
   - Export whitelisted locations as `true`, all others as `false`
   - Pro: Safe and simple
   - Con: Requires manual maintenance, doesn't scale

5. **Hybrid: Analyze Region Graph**
   - Look at which regions the location is placed in
   - Check if those regions have complex access requirements
   - If Available is SMBool(True) AND all parent regions are simple, export as `true`
   - Pro: Uses region topology information
   - Con: Complex logic, may still miss cases

### Related Code

- `exporter/games/sm.py:_is_simple_accessFrom()` (lines ~218-250)
- `exporter/games/sm.py:_contains_complex_helpers()` (lines ~252-315)
- `exporter/games/sm.py:expand_rule()` (lines ~318-459)
- `worlds/sm/variaRandomizer/graph/vanilla/graph_locations.py` (Python source definitions)
