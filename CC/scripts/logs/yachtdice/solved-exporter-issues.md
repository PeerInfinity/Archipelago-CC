# Solved Exporter Issues for Yacht Dice

## Status
This file tracks resolved issues with the Yacht Dice exporter (exporter/games/yachtdice.py).

## Issues

### Issue 1: prog_items attribute access not supported (CRITICAL) - SOLVED
**Status:** ✅ Fixed
**Affected Locations:** All score locations (1 score, 2 score, 3 score, etc.)
**Test Result:** All 66 spheres now pass successfully

**Problem:**
The Python code uses `state.prog_items[player]["state_is_fresh"]` and `state.prog_items[player]["maximum_achievable_score"]` to cache calculated scores. The exporter was inlining the function body of `dice_simulation_state_change` and directly exporting these state attribute accesses, but:
1. JavaScript StateManager doesn't have a `prog_items` attribute
2. The rule engine couldn't evaluate `state.prog_items[player]["state_is_fresh"]`
3. This caused all score location access rules to fail

**Solution:**
Added `should_preserve_as_helper` method to YachtDiceGameExportHandler that tells the analyzer to preserve `dice_simulation_state_change` as a helper function call instead of inlining its implementation.

**Implementation:**
File: `exporter/games/yachtdice.py`
```python
def should_preserve_as_helper(self, func_name: str) -> bool:
    """
    Determine if a function should be preserved as a helper call rather than inlined.

    For Yacht Dice, dice_simulation_state_change must be preserved as a helper because:
    1. It uses state.prog_items which is not available in JavaScript
    2. It performs complex caching and simulation logic
    3. The JavaScript helper function needs to be called directly
    """
    if func_name == 'dice_simulation_state_change':
        logger.debug(f"Preserving {func_name} as helper function")
        return True
    return False
```

**Generated Rule (Before Fix):**
```json
{
  "type": "compare",
  "left": {
    "type": "conditional",
    "test": {
      "type": "compare",
      "left": {
        "type": "subscript",
        "value": {
          "type": "subscript",
          "value": {
            "type": "attribute",
            "object": {"type": "name", "name": "state"},
            "attr": "prog_items"
          },
          "index": {"type": "name", "name": "player"}
        },
        "index": {"type": "constant", "value": "state_is_fresh"}
      },
      "op": "==",
      "right": {"type": "constant", "value": 0}
    },
    "if_true": {"type": "constant", "value": 1},
    "if_false": {
      "type": "subscript",
      "value": {
        "type": "subscript",
        "value": {
          "type": "attribute",
          "object": {"type": "name", "name": "state"},
          "attr": "prog_items"
        },
        "index": {"type": "name", "name": "player"}
      },
      "index": {"type": "constant", "value": "maximum_achievable_score"}
    }
  },
  "op": ">=",
  "right": {"type": "constant", "value": 1}
}
```

**Generated Rule (After Fix):**
```json
{
  "type": "compare",
  "left": {
    "type": "helper",
    "name": "dice_simulation_state_change",
    "args": [
      {"type": "constant", "value": 4},  // frags_per_dice
      {"type": "constant", "value": 4},  // frags_per_roll
      {"type": "constant", "value": [...]},  // allowed_categories
      {"type": "constant", "value": 2}   // difficulty
    ]
  },
  "op": ">=",
  "right": {"type": "constant", "value": 1}
}
```

**Test Results:**
- Before: Failed at Sphere 0 with 5 locations inaccessible
- After: All 66 spheres pass (66/66 events processed successfully)

**Date Resolved:** 2025-11-14
