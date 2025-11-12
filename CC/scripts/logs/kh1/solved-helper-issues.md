# Kingdom Hearts - Solved Helper Issues

## Issue 1: Helper function signatures and implementation incorrect ✓

**Status**: SOLVED
**Priority**: High
**File**: frontend/modules/shared/gameLogic/kh1/kh1Logic.js

**Description**:
All helper functions in kh1Logic.js had incorrect function signatures and implementation. They were using an incorrect pattern with `state` object and trying to call methods like `state.hasItem()` which don't exist.

**Root Cause**:
The helper functions need to follow the pattern `(snapshot, staticData, ...args)` and access items directly via `snapshot.inventory[itemName]`, not through method calls.

**Affected Functions**:
- All helper functions in the file
- Added missing `has()` and `count()` generic helper functions

**Solution Applied**:
1. Completely rewrote all helper functions to use the correct signature `(snapshot, staticData, ...args)`
2. Changed from using `state.hasItem()` and `state.getItemCount()` to directly accessing `snapshot.inventory[itemName]`
3. Added generic `has()` and `count()` helper functions required by the framework
4. Exported functions as `kh1Logic` object

**Example Error (Before Fix)**:
```
[ruleEngine] [evaluateRule] Error during evaluation: {ruleType: helper, rule: Object, error: TypeError: state.hasItem is not a function
    at Object.has_x_worlds ...
```

**Date Solved**: 2025-11-12

## Issue 2: Missing helper functions ✓

**Status**: SOLVED
**Priority**: High
**File**: frontend/modules/shared/gameLogic/kh1/kh1Logic.js

**Description**:
Several helper functions were missing from kh1Logic.js that are required by the access rules.

**Missing Functions**:
- `has_from_list_unique` - Checks if player has N unique items from a list
- `ceil` - Mathematical ceiling function
- `has_oogie_manor` - Checks if player can access Oogie's Manor
- `has_all_magic_lvx` - Checks if player has all magic types at level X
- `has_final_rest_door` - Checks if player meets Final Rest door requirements

**Solution Applied**:
Added all missing helper functions with correct signatures and logic matching the Python implementations.

**Date Solved**: 2025-11-12

## Issue 3: Location variable extraction for puppies_required ✓

**Status**: SOLVED
**Priority**: High
**Files**:
- frontend/modules/shared/stateInterface.js
- frontend/modules/textAdventure-remote/shared/stateInterface.js
- frontend/modules/stateManager/core/statePersistence.js

**Description**:
The exporter inlines the `has_puppies` function but preserves the parameter name `puppies_required` as a variable reference instead of substituting the constant value. This causes locations like "Return 10 Puppies" to fail because `puppies_required` is undefined.

**Root Cause**:
The exporter recursively expands function calls and preserves parameter names from the function signature, but doesn't substitute the actual argument values.

**Solution Applied**:
Added game-specific location variable extraction logic in all three `resolveName` functions. For Kingdom Hearts, it extracts numeric values from location names matching "Return X Puppies" and resolves `puppies_required` to X.

**Date Solved**: 2025-11-12

## Issue 4: Default value for advanced_logic option ✓

**Status**: SOLVED
**Priority**: Medium
**Files**:
- frontend/modules/shared/ruleEngine.js
- frontend/modules/textAdventure-remote/shared/ruleEngine.js

**Description**:
The `options.advanced_logic` setting was resolving to `undefined` instead of `false` when not explicitly set in the settings file, causing helper functions to incorrectly evaluate.

**Solution Applied**:
Added default value `false` for `advanced_logic` in the attribute resolution code, similar to the existing default for `keyblades_unlock_chests`.

**Date Solved**: 2025-11-12
