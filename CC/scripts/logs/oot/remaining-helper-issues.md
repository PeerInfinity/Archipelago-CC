# Remaining Helper Issues for Ocarina of Time

This file tracks outstanding issues with the OOT helper functions (`frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js`).

## Critical Issues

### Issue #1: Too many locations accessible at Sphere 0

**Status**: InProgress
**Priority**: P0 - Test failing

**Description**:
The spoiler test at Sphere 0 shows that the frontend STATE has many more locations accessible than expected. Over 1000 locations are accessible in STATE that should not be accessible yet according to the sphere log.

Example extra locations:
- "KF Bean Platform Green Rupee 1-7" and "KF Bean Platform Red Rupee" - Require adult bean plant
- "Showed Mido Sword & Shield" - Requires having both Kokiri Sword and Deku Shield
- Many adult-only locations despite starting as child
- Time-travel dependent locations
- Locations requiring specific tricks or items

**Root Cause**:
The helper functions in ootLogic.js are too permissive. Likely causes:
1. Unknown helpers returning false instead of preventing access
2. Item requirements not being checked correctly
3. Age requirements (child vs adult) not being enforced
4. Time-of-day requirements not being checked

**Next Steps**:
1. Examine a specific example location that should NOT be accessible
2. Trace through its access rule to find where the logic is failing
3. Fix the specific helper or logic issue
4. Re-test and iterate
