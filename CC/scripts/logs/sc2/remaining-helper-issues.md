# SC2 Remaining Helper Issues

## Summary
This document tracks remaining issues with the Starcraft 2 helper functions (`frontend/modules/shared/gameLogic/sc2/helpers.js`).

Last updated: 2025-11-17

## Issues

### Issue 2: Enemy Within Mission Not Accessible at Sphere 14.38

**Status:** Investigating

**Description:**
Test failed at sphere 14.38. The following locations should be accessible but are not:
- Beat Enemy Within
- Enemy Within: First Niadra Evolution
- Enemy Within: Infest Giant Ursadon
- Enemy Within: Second Niadra Evolution
- Enemy Within: Stasis Quadrant
- Enemy Within: Third Niadra Evolution
- Enemy Within: Victory
- Enemy Within: Warp Drive

**Error Message:**
```
Locations accessible in LOG but NOT in STATE (or checked): Beat Enemy Within,
Enemy Within: First Niadra Evolution, Enemy Within: Infest Giant Ursadon,
Enemy Within: Second Niadra Evolution, Enemy Within: Stasis Quadrant,
Enemy Within: Third Niadra Evolution, Enemy Within: Victory, Enemy Within: Warp Drive
ISSUE: Access rule evaluation failed
```

**Next Steps:**
1. Check the access rule for "Beat Enemy Within" location in the rules.json
2. Identify which helper function is being called
3. Determine what item/requirement unlocks this mission
