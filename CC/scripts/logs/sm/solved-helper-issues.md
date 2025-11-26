# Super Metroid - Solved Helper Issues

This file tracks helper function issues that have been resolved for Super Metroid.

## Solved Issues

### 1. getDmgReduction destructuring bug in canPassLavaPit
- **Date Solved:** 2025-11-26
- **Problem:** In `canPassLavaPit` function, the `getDmgReduction` return value was not properly destructured:
  ```javascript
  // BUG: getDmgReduction returns [dmgRed, items] array
  const dmgReduction = getDmgReduction(snapshot, staticData);
  let nTanks4Dive = Math.ceil(8 / dmgReduction);  // Dividing by array = NaN!
  ```
- **Solution:** Properly destructure the array return value:
  ```javascript
  const [dmgReduction] = getDmgReduction(snapshot, staticData);
  let nTanks4Dive = Math.ceil(8 / dmgReduction);
  ```
- **File Changed:** `frontend/modules/shared/gameLogic/sm/smLogic.js` (line 1205-1206)

### 2. getDmgReduction using `has` instead of `haveItem`
- **Date Solved:** 2025-11-26
- **Problem:** The `getDmgReduction` function used `has(snapshot, staticData, 'Varia')` and `has(snapshot, staticData, 'Gravity')`, but `has` only does direct name lookup in inventory. The inventory uses Archipelago names like "Varia Suit", not VARIA type names like "Varia".
  ```javascript
  // BUG: has() doesn't support type-based lookups
  const hasVaria = has(snapshot, staticData, 'Varia');  // Always false!
  const hasGravity = has(snapshot, staticData, 'Gravity');  // Always false!
  ```
- **Solution:** Use `haveItem` which supports type-based lookups:
  ```javascript
  // Use haveItem which supports VARIA type lookups (e.g., 'Varia' -> 'Varia Suit')
  const hasVaria = haveItem(snapshot, staticData, 'Varia').bool;
  const hasGravity = haveItem(snapshot, staticData, 'Gravity').bool;
  ```
- **File Changed:** `frontend/modules/shared/gameLogic/sm/smLogic.js` (line 1112-1114)

### Combined Effect
These two bugs together caused Lower Norfair regions to be unreachable:
1. `getDmgReduction` always returned `[1.0, []]` because `hasVaria` was always false
2. `canPassLavaPit` calculated `nTanks4Dive = NaN` due to array division
3. `energyReserveCountOk(NaN)` always returned false
4. All Lower Norfair access was blocked

After fixes:
1. `getDmgReduction` correctly detects Varia Suit ownership
2. `canPassLavaPit` correctly calculates energy tank requirements
3. Lower Norfair is accessible with the correct items
