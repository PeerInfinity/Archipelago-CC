# Remaining Helper Issues for Starcraft 2

## Issue 1: engine_of_destruction_requirement not implemented

**Status**: In Progress
**Severity**: High - Test fails at Sphere 16.1
**Test Failure**:
- Sphere 16.1 fails with 9 locations not accessible:
  - Beat Engine of Destruction
  - Engine of Destruction: Loki
  - Engine of Destruction: North Devourer
  - Engine of Destruction: Northeast Base
  - Engine of Destruction: Northwest Base
  - Engine of Destruction: Southeast Base
  - Engine of Destruction: Southeast Devourer
  - Engine of Destruction: Victory
  - Engine of Destruction: West Base

**Root Cause**:
The `engine_of_destruction_requirement` helper function is stubbed out and always returns `false`.

**Expected Behavior**:
Need to analyze sphere log to determine what items make these locations accessible.

**Fix Required**:
Implement `engine_of_destruction_requirement` in `frontend/modules/shared/gameLogic/sc2/helpers.js`.
