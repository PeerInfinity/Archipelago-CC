# SMZ3 Helper Function Issues - Solved

## Issue: CanAcquire/CanAcquireAll cannot evaluate complex boss location rules

**Status**: SOLVED

**Description**:
The `smz3_CanAcquire` and `smz3_CanAcquireAll` helper functions failed to evaluate boss location access rules that contained nested OR conditions and comparison operations. These functions tried to manually evaluate simple rules but fell back to `snapshot.evaluateRule()` for complex rules, which is not available in the helper function context.

**Locations Affected**:
- Pyramid Fairy - Left (requires CanAcquireAll for CrystalRed) - FIXED
- Pyramid Fairy - Right (requires CanAcquireAll for CrystalRed) - FIXED

**Root Cause**:
Boss locations have access rules with nested structures and comparison operations:
1. Nested OR rules inside AND rules (e.g., BigKeyTH AND (ProgressiveSword OR Hammer))
2. Comparison rules (e.g., KeyPD >= 6)

**Solution Implemented**:
Implemented `evaluateSimpleRule()` function in smz3Logic.js that can recursively evaluate:
1. `item_check` rules - check if player has an item
2. `and` rules - all conditions must be true
3. `or` rules - at least one condition must be true
4. `not` rules - negation of a condition
5. `region_check` rules - check if region is reachable
6. `compare` rules - numerical comparisons (>=, <=, >, <, ==, !=)
7. `helper` rules - call other SMZ3 helper functions
8. `constant` rules - return the constant value

The evaluator handles nested rule structures and can call helper functions recursively without needing `snapshot.evaluateRule()`.

**Changes Made**:
- Added `evaluateSimpleRule()` function with support for all common rule types
- Updated `checkRegionCompletion()` to use `evaluateSimpleRule()` instead of manual evaluation
- Updated `smz3_CanAcquire()` to use `evaluateSimpleRule()` instead of manual evaluation
- Added all SMZ3 exported helpers to the helper dispatch table in `evaluateSimpleRule()`
- Added support for boss-specific helpers (CanBeatArmos, CanBeatMoldorm) as aliases for CanBeatBoss

**Test Results**:
- Pyramid Fairy locations now properly become accessible in sphere 8.19 ✓
- Test progressed from sphere 8.19 to sphere 9.10 (significant progress) ✓
- No more "Cannot evaluate complex rule" warnings for boss locations ✓

**Files Modified**:
- frontend/modules/shared/gameLogic/smz3/smz3Logic.js (lines 805-960)

## Issue: Generic item alias "Sword" not mapped to ProgressiveSword

**Status**: SOLVED

**Description**:
The access rules for some locations (Master Sword Pedestal, Skull Woods - Mothula) required the generic item name "Sword" but the player had "ProgressiveSword". The has() function in alttpLogic.js didn't recognize "Sword" as an alias for "any level of ProgressiveSword".

**Locations Affected**:
- Master Sword Pedestal - FIXED
- Skull Woods - Mothula (required Sword + Firerod + KeySW >= 3) - FIXED

**Root Cause**:
Access rules used the generic name "Sword" to mean "any sword level", but the JavaScript logic only checked for exact item matches or progressive item progressions, not generic aliases.

**Solution Implemented**:
Added special handling in alttpLogic.js has() function to map "Sword" to ProgressiveSword:
```javascript
// Special handling for generic item aliases that mean "any level"
// "Sword" means "any sword level" (ProgressiveSword > 0)
if (itemName === 'Sword') {
  return (snapshot.inventory['ProgressiveSword'] || 0) > 0;
}
```

**Test Results**:
- Master Sword Pedestal and Skull Woods - Mothula now properly become accessible in sphere 9.10 ✓
- Test progressed from sphere 9.10 to 12.4 (significant progress) ✓

**Files Modified**:
- frontend/modules/shared/gameLogic/alttp/alttpLogic.js (lines 109-113)

## Issue: Ganon's Tower region not reachable in sphere 12.4

**Status**: SOLVED

**Description**:
After fixing the Sword alias issue, the test progressed to sphere 12.4 where Ganon's Tower region failed to become reachable. The entrance requires:
- MoonPearl ✓
- Dark World Death Mountain East region ✓
- `CanAcquireAtLeast(7, 24)` - at least 7 crystal dungeons completable
- `CanAcquireAtLeast(4, 480)` - at least 4 boss token regions completable

**Root Causes**:
1. **Missing conditional rule type**: Missile (Draygon) boss location used `conditional` rule type which wasn't implemented in `evaluateSimpleRule()`, causing Maridia Inner (boss token region) to incorrectly return false
2. **Incorrect region completion check**: `checkRegionCompletion()` was re-evaluating access rules instead of checking precomputed accessibility, causing inconsistent results during reachability calculation

**Solution Implemented**:
1. **Added conditional rule type support** in `evaluateSimpleRule()`:
   ```javascript
   case 'conditional':
     const testResult = evaluateSimpleRule(rule.test, snapshot, staticData);
     if (testResult) {
       return rule.if_true ? evaluateSimpleRule(rule.if_true, snapshot, staticData) : true;
     } else {
       return rule.if_false ? evaluateSimpleRule(rule.if_false, snapshot, staticData) : false;
     }
   ```

2. **Improved checkRegionCompletion()** to use locationAccessibility:
   ```javascript
   // Check precomputed accessibility first (avoids circular dependencies)
   if (snapshot.locationAccessibility) {
     const isAccessible = snapshot.locationAccessibility[bossLocationName] === true;
     return isAccessible;
   }
   // Fallback to evaluateSimpleRule if not available
   ```

**Test Results**:
- `CanAcquireAtLeast(7, 24)` now correctly returns true (7 of 7 crystal regions) ✓
- `CanAcquireAtLeast(4, 480)` now correctly returns true (4 of 4 boss token regions) ✓
- Ganon's Tower entrance rule satisfied ✓
- Test progressed from sphere 12.4 to 13.3 (major progress) ✓

**Crystal Regions Checked** (all 7 accessible):
1. Tower of Hera (CrystalRed)
2. Palace of Darkness (CrystalRed)
3. Desert Palace (CrystalBlue)
4. Turtle Rock (CrystalBlue)
5. Norfair Lower East (CrystalBlue)
6. Ice Palace (CrystalBlue)
7. Wrecked Ship (CrystalBlue)

**Boss Token Regions Checked** (all 4 accessible):
1. Brinstar Kraid (BossTokenKraid)
2. Maridia Inner (BossTokenPhantoon) - Fixed by conditional support
3. Thieves' Town (BossTokenRidley)
4. Misery Mire (BossTokenDraygon)

**Files Modified**:
- frontend/modules/shared/gameLogic/smz3/smz3Logic.js (conditional rule type, checkRegionCompletion improvements)
