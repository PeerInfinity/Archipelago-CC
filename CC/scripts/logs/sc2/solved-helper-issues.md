# SC2 Solved Helper Issues

## Summary
This document tracks resolved issues with the Starcraft 2 helper functions (`frontend/modules/shared/gameLogic/sc2/helpers.js`).

Last updated: 2025-11-17

## Resolved Issues

### Issue 1: Templar's Charge Mission Not Accessible at Sphere 14.27

**Status:** SOLVED

**Description:**
Test failed at sphere 14.27. The `templars_charge_requirement` helper was stubbed out to return false.

**Solution:**
Implemented the helper to check for `protoss_fleet(snapshot, staticData)`:
```javascript
templars_charge_requirement: (snapshot, staticData) => {
    // Templar's Charge requires fleet units (air superiority)
    return protoss_fleet(snapshot, staticData);
},
```

**Analysis:**
Looking at the sphere log, the mission became accessible when the player obtained the "Destroyer" unit at sphere 14.27. Destroyer is a Protoss fleet unit (along with Carrier, Tempest, and Void Ray). The requirement checks if the player has any of these fleet units.

**File Modified:** `frontend/modules/shared/gameLogic/sc2/helpers.js:802`

**Commit:** (pending)
