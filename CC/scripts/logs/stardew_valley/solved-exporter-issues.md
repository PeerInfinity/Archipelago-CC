# Solved Exporter Issues - Stardew Valley

### Issue 1: Virtual progression items being cleared - SOLVED ✓
- **Original Sphere**: 0.11
- **Original Error**: Location "Read Jack Be Nimble, Jack Be Thick" accessible in LOG but NOT in STATE
- **Root Cause**: The `clearEventItems()` function was clearing "Received Progression Item" and "Received Progression Percent" because they were marked as event items. This was resetting the progression tracking during spoiler tests.
- **Solution**: Modified `clearEventItems()` in `frontend/modules/stateManager/core/statePersistence.js` to preserve virtual progression tracking items by adding them to a whitelist.
- **Files Modified**:
  - `frontend/modules/stateManager/core/statePersistence.js` - Added virtualItemsToPreserve list
  - `frontend/modules/shared/gameLogic/stardew_valley/stardewValleyLogic.js` - Added debug logging
- **Test Results**: Test now passes sphere 0.11 and progresses to sphere 2.1
