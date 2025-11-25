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

### Issue 2: smz3_CanAccessMiseryMirePortal returning undefined (2025-11-25)

**Problem:** Dark World Mire region was showing as accessible in the sphere log but not in the JavaScript state. The exit rule for Dark World Mire uses `smz3_CanAccessMiseryMirePortal` which was returning `undefined`.

**Root cause:** The helper was being called with a `Config` argument that evaluated to `undefined`. The rule engine has a check that returns `undefined` when any helper argument is undefined, unless the helper is in the allowed list.

**Fix:** Added `smz3_CanAccessMiseryMirePortal` to the `helpersAllowingUndefinedArgs` set in `ruleEngine.js` so it can be called even when its Config argument is undefined.

**Files changed:** `frontend/modules/shared/ruleEngine.js`

### Issue 3: smz3_CanAccessMaridiaPortal missing Agahnim path (2025-11-25)

**Problem:** Energy Tank, Botwoon was failing because the location wasn't accessible. The access rule requires either `smz3_CanAccessMaridiaPortal` or `smz3_CanDefeatBotwoon` (which also uses `smz3_CanAccessMaridiaPortal`).

**Root cause:** The JavaScript implementation of `smz3_CanAccessMaridiaPortal` was missing one of the three paths from the Python logic. It had the Hammer/CanLiftLight and CanLiftHeavy paths, but was missing the `CanAcquire(Agahnim)` path.

**Python logic:**
```python
return self.MoonPearl and self.Flippers and self.Gravity and self.Morph and \
    (world.CanAcquire(self, RewardType.Agahnim) or self.Hammer and self.CanLiftLight() or self.CanLiftHeavy())
```

**Fix:** Added the Agahnim acquisition check to `smz3_CanAccessMaridiaPortal` using `smz3_CanAcquire(snapshot, staticData, 1)` where 1 is the reward type for Agahnim (Castle Tower).

**Files changed:** `frontend/modules/shared/gameLogic/smz3/smz3Logic.js`
