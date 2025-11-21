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
