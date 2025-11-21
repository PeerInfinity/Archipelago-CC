# SMZ3 Solved General Issues

## Issues Resolved

### 1. item_check in compare expressions returns boolean instead of count (FIXED)

**Issue**: When `item_check` was used as an operand in a `compare` rule without a `count` field, it returned a boolean (true/false) instead of the item count. This broke comparisons like `KeyPD >= 4`.

**Solution**: Modified the `compare` case in ruleEngine.js to detect when an operand is an `item_check` without a count field and extract the item count directly using `context.countItem()` instead of the boolean result from `context.hasItem()`.

**File**: `frontend/modules/shared/ruleEngine.js:1071-1114`

**Result**: Palace of Darkness locations at sphere 7.7 now correctly evaluate their key requirements.

### 2. GetLocation().ItemIs() pattern not handled (FIXED)

**Issue**: The `GetLocation("location").ItemIs(itemType)` pattern was not supported. This pattern checks if a specific item is placed at a location, which is used for self-referential checks (e.g., don't count a key you're about to pick up toward the requirement to access it).

**Solution**:
1. Added `smz3_GetLocation()` helper function in smz3Logic.js that returns an object with an `ItemIs()` method
2. Modified the exporter to convert the pattern to a proper function_call structure that can be evaluated at runtime
3. The helper looks up the location in staticData and checks the placed item

**Files**:
- `frontend/modules/shared/gameLogic/smz3/smz3Logic.js:387-414`
- `exporter/games/smz3.py:540-590`

**Result**: Palace of Darkness - Harmless Hellway (which has a KeyPD placed on it) now correctly evaluates its access requirements.

### 3. Missing Super Metroid area-specific helpers (FIXED)

**Issue**: Three helper functions for Super Metroid areas were not implemented, blocking progression at sphere 7.8.

**Solution**: Implemented three helper functions based on TotalSMZ3 Python code:

1. **smz3_CanAccessCrocomire**: Returns `hasItem('Super')` for non-keysanity mode. This allows access to Crocomire boss area in Upper Norfair.

2. **smz3_CanUnlockShip**: Returns `hasItem('CardWreckedShipBoss') && CanPassBombPassages()`. This unlocks the Wrecked Ship after defeating Phantoon.

3. **smz3_CanEnterAndLeaveGauntlet**: Implements Normal logic requiring CardCrateriaL1, Morph, ability to fly or speed boost, and ability to escape (IBJ, 2+ Power Bombs, or Screw Attack). This allows full traversal of the Gauntlet area.

**File**: `frontend/modules/shared/gameLogic/smz3/smz3Logic.js:219-264`

**Result**: All 15 locations at sphere 7.8 now correctly evaluate (6 Crocomire, 3 Gauntlet, 6 Wrecked Ship). Test progresses to sphere 8.16.
