# Kingdom Hearts 2 - Remaining Helper Issues

This file tracks issues with the KH2 helper functions (frontend/modules/shared/gameLogic/kh2/).

## Issues

### Data Xemnas Region Accessibility

**Status:** In Progress
**Severity:** Medium
**Sphere:** 12.3

**Description:**
The Data Xemnas region is not being marked as accessible by the JavaScript logic, even though all requirements appear to be met. The helper function `get_data_xemnas_rules` is implemented, but the region access check is failing.

**Investigation:**
At sphere 12.3, the cumulative inventory includes:
- Combo Master: 1 ✓
- Slapshot: 1 ✓
- Reflect Element: 3 ✓
- Slide Dash: 1 ✓
- Flash Step: 1 ✓
- Finishing Plus: 3 ✓
- Guard: 1 ✓
- Limit Form: 1 ✓
- Guard Break: 1 ✓
- Explosion: 1 ✓
- Finishing Leap: 1 ✓
- "Limit level 5" location is accessible (since sphere 10.9)

All requirements for normal difficulty are met, but the region is not being marked as accessible in the JavaScript state.

**Possible Causes:**
1. The kh2_can_reach function may not be checking locations correctly
2. There may be a timing issue with when locations vs regions are evaluated
3. The cumulative inventory tracking in the JavaScript state may differ from Python

**Next Steps:**
1. Debug the kh2_can_reach implementation
2. Verify that accessibleLocations and checkedLocations are being tracked correctly
3. Add debug logging to see what the actual state values are when the helper is called
