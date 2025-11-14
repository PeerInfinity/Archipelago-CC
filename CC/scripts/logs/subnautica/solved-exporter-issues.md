# Subnautica Exporter Issues (Solved)

This document tracks solved issues with the Subnautica exporter (`exporter/games/subnautica.py`).

## Solved Issues

### Issue 1: can_access_location helper being inlined with unresolved local variables

**Solved**: 2025-11-14 05:25 UTC

**Priority**: CRITICAL (was blocking all spoiler tests)

**Description**:
The `can_access_location` helper function was being inlined during rule analysis instead of being kept as a helper call. This caused local variables from inside the function (`need_laser_cutter`, `need_propulsion_cannon`, `need_radiation_suit`) to be exported as name references in the access rules. When the frontend tried to evaluate these rules, it failed with "Name 'need_laser_cutter' NOT FOUND in context" errors.

**Solution**:
Added the `should_preserve_as_helper()` method to the Subnautica exporter class. This method tells the analyzer to preserve helper functions as helper calls instead of inlining their bodies.

**Code changes**:
```python
def should_preserve_as_helper(self, func_name: str) -> bool:
    """Check if a function should be preserved as a helper call instead of being inlined.

    This prevents the analyzer from recursively analyzing and inlining the function body,
    which would cause local variables to be incorrectly exported as name references.
    """
    return func_name in self.known_helpers
```

**Result**:
- Access rules now correctly export as helper calls with location data as constant arguments
- All 75 spoiler test steps pass
- Generation time improved from 93 seconds to 0.39 seconds (no more failed analysis warnings)

**Example of fixed output**:
```json
{
  "type": "helper",
  "name": "can_access_location",
  "args": [
    {
      "type": "constant",
      "value": {
        "name": "Blood Kelp Trench Wreck - Outside Databox",
        "position": {"x": -1234.3, "y": -349.7, "z": -396.0},
        "need_laser_cutter": false,
        "need_propulsion_cannon": false
      }
    }
  ]
}
```

**Files modified**:
- `exporter/games/subnautica.py` - Added `should_preserve_as_helper()` method

**Test results**:
- Before: Test failed at step 1 with name resolution errors
- After: All 75 steps passed (100% success rate)
