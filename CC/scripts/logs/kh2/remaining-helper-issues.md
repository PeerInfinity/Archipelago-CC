# Kingdom Hearts 2 - Remaining Helper Issues

This file tracks issues with the KH2 helper functions (frontend/modules/shared/gameLogic/kh2/).

## Issues

### Missing Helper: get_terra_rules

**Status:** In Progress
**Severity:** High
**Sphere:** 11.20

**Description:**
The helper function `get_terra_rules` is not implemented in the JavaScript logic, preventing access to Terra (Lingering Will) region.

**Impact:**
- Region "Terra" is not reachable
- 4 locations cannot be accessed:
  - (Post TR:Hall of the Cornerstone) Lingering Will Bonus: Sora Slot 1
  - (Post TR:Hall of the Cornerstone) Lingering Will Manifest Illusion
  - (Post TR:Hall of the Cornerstone) Lingering Will Proof of Connection
  - Terra Event Location

**Next Steps:**
1. Find the Python implementation in worlds/kh2/
2. Implement the equivalent JavaScript helper in frontend/modules/shared/gameLogic/kh2/kh2Logic.js
