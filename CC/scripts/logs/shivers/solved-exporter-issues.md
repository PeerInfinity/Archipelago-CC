# Solved Exporter Issues for Shivers

This document tracks resolved exporter issues for the Shivers game.

## Issues

### Issue 1: World Options References Not Resolved (FIXED)

**Location:** Jukebox (and potentially others)

**Error Message:**
```
Name "world" NOT FOUND in context
ISSUE: Access rule evaluation failed
Locations accessible in LOG but NOT in STATE: Jukebox
```

**Description:**
The access rule for the Jukebox location contains references to `world.options.puzzle_hints_required.value`. These world option references were being exported as-is in the rules.json, but the JavaScript context doesn't have access to a "world" variable.

**Root Cause:**
In Rules.py line 230-235:
```python
world.get_location("Jukebox").access_rule = lambda state: (
    state.can_reach_region("Clock Tower", player) and (
        state.can_reach_region("Anansi", player)
        if world.options.puzzle_hints_required.value else True
    )
)
```

The exporter was capturing the lambda but not resolving the `world.options` reference.

**Solution:**
Enhanced the `resolve_attribute_nodes_in_rule` function in exporter/exporter.py to recursively resolve nested attribute chains like `world.options.puzzle_hints_required.value` to their actual values at export time.

**Fix Location:** exporter/exporter.py lines 27-144

**Test Result:** Test now passes sphere 2.3 (Jukebox location) and progresses to sphere 3.15.
