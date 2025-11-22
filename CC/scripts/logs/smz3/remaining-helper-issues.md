# SMZ3 Helper Function Issues - Remaining

## Issue: CanAcquire/CanAcquireAll cannot evaluate complex boss location rules

**Status**: In Progress

**Description**:
The `smz3_CanAcquire` and `smz3_CanAcquireAll` helper functions fail to evaluate boss location access rules that contain nested OR conditions. These functions try to manually evaluate simple rules but fall back to `snapshot.evaluateRule()` for complex rules, which is not available in the helper function context.

**Error Seen**:
```
[checkRegionCompletion] Cannot evaluate complex rule for Tower of Hera - Moldorm, snapshot.evaluateRule not available
```

**Locations Affected**:
- Pyramid Fairy - Left (requires CanAcquireAll for CrystalRed)
- Pyramid Fairy - Right (requires CanAcquireAll for CrystalRed)

**Root Cause**:
Boss locations like "Tower of Hera - Moldorm" have access rules with nested structures:
```json
{
  "type": "and",
  "conditions": [
    {"type": "item_check", "item": "BigKeyTH"},
    {
      "type": "or",
      "conditions": [
        {"type": "item_check", "item": "ProgressiveSword"},
        {"type": "item_check", "item": "Hammer"}
      ]
    }
  ]
}
```

The `checkRegionCompletion` function only handles simple AND rules where all conditions are item_checks. When it encounters a nested OR, it tries to use `snapshot.evaluateRule()`, which doesn't exist.

**Solution**:
Implement a manual rule evaluator in the helper functions that can handle:
1. item_check rules
2. AND rules (all conditions must be true)
3. OR rules (at least one condition must be true)
4. Nested combinations of the above

This will allow the helpers to evaluate boss location rules without needing `snapshot.evaluateRule()`.

**Files to Modify**:
- frontend/modules/shared/gameLogic/smz3/smz3Logic.js
