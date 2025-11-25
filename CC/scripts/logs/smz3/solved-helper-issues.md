# SMZ3 Solved Helper Issues

This document tracks helper function issues that have been resolved for the SMZ3 game.

## Resolved Issues

### Issue 1: Missing smz3_CanNotWasteKeysBeforeAccessible helper (2025-11-25)

**Problem:** Ice Palace - Spike Room was failing because the `smz3_CanNotWasteKeysBeforeAccessible` helper function was only stubbed in the `evaluateSimpleRule` fallback, not properly implemented as an exported function.

**Root cause:** The Python rule uses `CanNotWasteKeysBeforeAccessible` to check if keys can be used without getting locked out of obtaining the big key. The JavaScript helper was returning true via a console warning but wasn't properly exported or connected to the rule engine.

**Python logic:**
```python
def CanNotWasteKeysBeforeAccessible(self, items, locations):
    return self.world.ForwardSearch or not items.BigKeyIP or any(l.ItemIs(ItemType.BigKeyIP, self.world) for l in locations)
```

Since Archipelago always uses `ForwardSearch=True`, this function always returns true.

**Fix:** Added proper implementation of `smz3_CanNotWasteKeysBeforeAccessible` as an exported function in `smz3Logic.js` that returns true (matching the Archipelago ForwardSearch behavior). Also updated the `evaluateSimpleRule` switch statement to call this function.

**Files changed:** `frontend/modules/shared/gameLogic/smz3/smz3Logic.js`
