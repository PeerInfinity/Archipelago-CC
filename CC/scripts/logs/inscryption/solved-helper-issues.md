# Solved Helper Issues for Inscryption

This file tracks resolved issues with the Inscryption helper functions.

## Solved Issues

### Issue 1: Incorrect logic in has_act2_bridge_requirements (FIXED)

**Problem:**
The `has_act2_bridge_requirements` helper function was using AND logic instead of OR logic. It only checked for `has_camera_and_meat`, but according to the Python implementation in `worlds/inscryption/Rules.py:124-125`, it should check for EITHER camera+meat OR all epitaph pieces.

**Location:** `frontend/modules/shared/gameLogic/inscryption/inscryptionLogic.js:160-163`

**Python Implementation:**
```python
def has_act2_bridge_requirements(self, state: CollectionState) -> bool:
    return self.has_camera_and_meat(state) or self.has_all_epitaph_pieces(state)
```

**Original JavaScript (Incorrect):**
```javascript
has_act2_bridge_requirements(state, playerId) {
  // Bridge typically requires having camera and meat
  return helperFunctions.has_camera_and_meat(state, playerId);
}
```

**Fixed JavaScript:**
```javascript
has_act2_bridge_requirements(state, playerId) {
  // Bridge requires camera+meat OR all epitaph pieces
  return helperFunctions.has_camera_and_meat(state, playerId) ||
         helperFunctions.has_all_epitaph_pieces(state, playerId);
}
```

**Impact:**
This fix allows locations requiring bridge access (like "Act 2 - Battle Lonely Wizard", "Act 2 - Boss Magnificus", etc.) to become accessible when the player has collected all 9 epitaph pieces, even without having the Camera Replica and Pile Of Meat.

**Test Results:**
- Before fix: Failed at Sphere 2.6 with 9 inaccessible locations
- After fix: All 31 spheres passed successfully

**Failing locations before fix:**
- Act 2 - Ancient Obol
- Act 2 - Battle Goobert
- Act 2 - Battle Lonely Wizard
- Act 2 - Battle Pike Mage
- Act 2 - Boss Magnificus
- Act 2 - Mycologists Holo Key
- Act 2 - Tentacle
- Act 2 - Tower Chest 2
- Act 2 - Tower Chest 3
