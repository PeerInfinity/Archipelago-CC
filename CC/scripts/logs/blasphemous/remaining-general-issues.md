# Remaining General Issues for Blasphemous

This file tracks general issues that still need to be fixed.

## Issues

### CRITICAL: add_sphere_items_upfront not working in Sphere 0

**Status**: Partially Fixed - Code updated but test still failing
**Priority**: CRITICAL
**Type**: Frontend State Manager Bug + Possible Helper Function Issues

**Description**:
The Blasphemous game uses special settings:
- `use_resolved_items: true` - Use resolved_items from sphere log instead of base_items
- `add_sphere_items_upfront: true` - Add items from sphere log to inventory before checking accessibility

In Sphere 0, the Python backend starts with these items in `resolved_items`:
- "Dash Ability": 1
- "Wall Climb Ability": 1

However, the frontend state manager is NOT adding these items to the inventory at the start, causing:
- **0 regions accessible** (should be 500+)
- **0 locations accessible** (should be 78)
- Complete failure to progress through the game

**Expected Behavior**:
When `add_sphere_items_upfront: true`, the state manager should:
1. Load the sphere log
2. For each sphere (starting with sphere 0), add items from `resolved_items` to the inventory BEFORE evaluating accessibility
3. Then check which regions and locations become accessible

**Actual Behavior**:
The state manager is not adding the starting items from sphere 0's `resolved_items` to the inventory, so no regions are reachable from Menu.

**Test Results**:
- Sphere 0 mismatch: 78 locations accessible in LOG but NOT in STATE
- Sphere 0 mismatch: 500+ regions accessible in LOG but NOT in STATE
- Test fails immediately at sphere 0

**Location**:
Frontend state manager code that handles `add_sphere_items_upfront` setting

**Fix Applied**:
Fixed bug in `frontend/modules/testSpoilers/eventProcessor.js:168, 243, 606` where settings were accessed incorrectly:
- Changed `staticData?.settings?.add_sphere_items_upfront` to `staticData?.settings?.[String(this.playerId)]?.add_sphere_items_upfront`
- Changed `staticData?.settings?.use_resolved_items` to `staticData?.settings?.[String(this.playerId)]?.use_resolved_items`
- Settings in rules.json are keyed by player ID ("1"), not directly on settings object
- Player ID needs to be converted to string for proper object key access

**Status After Fix**:
Test still failing at sphere 0 with same symptoms. Additional investigation needed:
1. Test logs don't show "Adding items from sphere log" message - code may not be reached
2. "Access rule evaluation failed" errors appearing in test output
3. May be related to Blasphemous helper functions or access rule evaluation
4. Need to investigate why the fix didn't resolve the issue

**Next Steps**:
1. Add detailed logging to trace execution flow
2. Investigate Blasphemous helper functions for bugs
3. Check if access rules are correctly defined
4. Verify sphere log format is being parsed correctly
