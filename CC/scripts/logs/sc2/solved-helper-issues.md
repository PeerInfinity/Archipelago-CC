# Solved SC2 Helper Issues

## Issue 1: `zerg_common_unit` helper not implemented

**Status:** ✅ SOLVED

**Symptom:**
- Test failed at Sphere 4.2
- Locations not accessible: Lab Rat: Victory, Lab Rat: East Zergling Group, Lab Rat: Gas Turrets, Lab Rat: South Zergling Group, Lab Rat: West Zergling Group, Beat Lab Rat
- All these locations have access rules calling `zerg_common_unit` helper

**Root Cause:**
The `zerg_common_unit` helper was a stub returning `false` instead of checking for basic Zerg units.

**Solution:**
Implemented `zerg_common_unit` helper in `frontend/modules/shared/gameLogic/sc2/helpers.js`:

```javascript
zerg_common_unit: (snapshot, staticData) => {
    const advancedTactics = isAdvancedTactics(staticData);

    // Basic zerg units (standard logic)
    const basicUnits = ['Zergling', 'Swarm Queen', 'Roach', 'Hydralisk'];

    if (has_any(snapshot, basicUnits)) {
        return true;
    }

    // Advanced tactics also includes Infestor and Aberration
    if (advancedTactics) {
        return has_any(snapshot, ['Infestor', 'Aberration']);
    }

    return false;
},
```

**Files Modified:**
- `frontend/modules/shared/gameLogic/sc2/helpers.js`

**Test Results:**
After fix, test progressed from Sphere 4.2 to Sphere 5.2, confirming the helper works correctly.
