# Remaining Helper Issues for Raft

## Issue 1: Progressive item resolution in Sphere 0.2

**Status**: Active
**Severity**: Critical
**Type**: Helper/Progressive Item Bug

### Description
The spoiler test is still failing at Sphere 0.2, where the player receives `progressive-metals` (which should resolve to "Smelter"). The following 9 locations are not being recognized as accessible even though they should be:

- Advanced grill
- Advanced purifier
- Battery
- Bolt
- Circuit board
- Drinking glass
- Empty bottle
- Flippers
- Hinge

### Current State
- ✅ Progression mapping is correctly exported in rules.json
- ✅ `has()` helper updated to check progressive items
- ❌ Locations still not recognized as accessible

### Sphere Log Data
In Sphere 0.2:
- Player receives: `{"progressive-metals": 1}`
- Should resolve to: `{"Smelter": 1}`
- These locations should become accessible because they require `raft_can_smelt_items()` which checks for "Smelter"

### Possible Causes
1. The progressive item resolution might not be working correctly in the snapshot/inventory
2. The `has()` helper might not be called with the correct staticData context
3. There might be an issue with how the progression_mapping is structured or accessed

### Next Steps
1. Debug the snapshot/inventory state to verify what items are present
2. Add logging to the `has()` helper to see if it's correctly resolving progressive items
3. Verify that staticData.progression_mapping is correctly passed to helpers
4. Check if the progression_mapping needs to be at a different level in staticData
