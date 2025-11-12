# Solved Exporter Issues for Landstalker

This file tracks resolved issues with the Landstalker exporter.

## Completed Fixes

### Fix 1: Simplified has_all(set(...)) Pattern

**Date**: 2025-11-12

**Issue**: Complex nested rule pattern from `state.has_all(set(required_items), player)` was not handled properly by the frontend.

**Original Pattern**:
```json
{
  "type": "state_method",
  "method": "has_all",
  "args": [{
    "type": "helper",
    "name": "set",
    "args": [{
      "type": "constant",
      "value": ["Safety Pass"]
    }]
  }]
}
```

**Solution**: Enhanced `LandstalkerGameExportHandler.expand_rule()` to detect and simplify this pattern:
- Single item: `{"type": "item_check", "item": "Safety Pass"}`
- Multiple items: AND of item_check nodes
- Empty set: `{"type": "constant", "value": true}`

**Impact**: Fixed major region accessibility issue - tests now pass 11 spheres instead of failing at sphere 0.1

**Files Modified**:
- `exporter/games/landstalker.py` - Added `_simplify_has_all()` method
