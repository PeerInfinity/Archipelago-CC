# Super Metroid - Remaining Exporter Issues

## Issue 1: Cannot export accessFrom comprehensions

**Symptom:**
- Exporter skips `accessFrom` comprehensions due to recursion limits
- Only exports the `Available` part of location access rules
- This causes some locations to be marked as accessible when they shouldn't be

**Root Cause:**
Super Metroid uses complex `accessFrom` comprehensions that encode region-to-region connectivity in the VARIA randomizer logic. These comprehensions:
- Check all possible entry points to a location's region
- Evaluate whether each entry point is reachable with current items
- Use recursive any_of patterns that hit the analyzer's recursion limit

The exporter detects these patterns and skips them, only exporting the `Available` rule.

**Impact:**
For locations where `Available = SMBool(True)`:
- If `accessFrom` is trivial (always True from start), location correctly accessible
  - Example: "Morphing Ball" - accessible in Sphere 0
- If `accessFrom` has requirements, location incorrectly accessible
  - Example: "Energy Tank, Terminator" - should need Bombs, but marked as accessible

**Current Status:**
Partial workaround: Deeply nested `any_of` patterns export as `constant False`
But this doesn't cover all cases where `accessFrom` has requirements

**Possible Solutions:**
1. **Implement VARIA logic in frontend** - Full implementation of accessFrom evaluation
2. **Pre-compute at export time** - Evaluate accessFrom with empty state to detect trivial cases
3. **Python-side simplification** - Flatten accessFrom before export
4. **Hybrid approach** - Use region connectivity graph + location rules
