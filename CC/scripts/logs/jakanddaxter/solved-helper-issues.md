# Solved Helper Issues for Jak and Daxter

## Fixed: can_reach_orbs Helper Function

**Status:** Implemented (but blocked by exporter issue)
**Sphere where it was failing:** 3.15 (step 120)
**Date Fixed:** 2025-11-12

**Description:**
Implemented the `can_reach_orbs` helper function that checks if the player has enough "Reachable Orbs" to access orb trading locations.

**Implementation:**
- Created `frontend/modules/shared/gameLogic/jak_and_daxter__the_precursor_legacy/jak_and_daxter__the_precursor_legacyLogic.js`
- Added the helper function to gameLogicRegistry.js
- The function checks `snapshot.inventory['Reachable Orbs']` against the required amount

**Files Modified:**
- `frontend/modules/shared/gameLogic/jak_and_daxter__the_precursor_legacy/jak_and_daxter__the_precursor_legacyLogic.js` (created)
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` (added import and registry entry)

**Note:**
The helper function is correctly implemented, but there's an exporter issue where "Reachable Orbs" values are not being updated in the sphere log when new orb regions become accessible. This causes the test to still fail. See remaining-exporter-issues.md for details.
