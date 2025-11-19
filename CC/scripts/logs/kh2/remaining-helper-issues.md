# Kingdom Hearts 2 - Remaining Helper Issues

This document tracks remaining issues with the Kingdom Hearts 2 helper functions (frontend/modules/shared/gameLogic/kh2/kh2Logic.js).

## Status

Last updated: 2025-11-19

Current test status: FAILING at Sphere 12.3
- Test fails because "Data Xemnas" region is not reachable when it should be

---

## Active Issues

### Issue: Data Xaldin region not accessible at Sphere 13.5

**Priority**: High
**Category**: Missing Helper Function
**Status**: Not Started

**Description**:
The helper function `get_data_xaldin_rules` is not found in the kh2Logic.js file, causing Data Xaldin region to not be accessible.

**Evidence**:
- Region affected: Data Xaldin
- Test output: `Helper function "get_data_xaldin_rules" NOT FOUND in snapshotInterface`
- Failing at sphere 13.5

**Proposed Solution**:
Implement the `get_data_xaldin_rules` helper function in kh2Logic.js based on the Python implementation in worlds/kh2/Rules.py.

---

### Issue: Data Xemnas region not accessible at Sphere 12.3

**Priority**: High
**Category**: Helper Logic
**Status**: SOLVED (2025-11-19)

**Description**:
The spoiler test fails at sphere 12.3 because the "Data Xemnas" region is not reachable in the JavaScript state manager, even though the sphere log shows it should be accessible at this point.

**Evidence**:
- Region affected: Data Xemnas
- Locations affected: "(Post TWTNW3: The Altar of Naught) Data Xemnas", "Data Xemnas Event Location"
- Sphere log shows these should be accessible at sphere 12.3
- Frontend state manager does not make them accessible

**Test Output**:
```
BROWSER LOG (error): STATE MISMATCH found for: {"type":"state_update","sphere_number":"12.3","player_id":"1"}
BROWSER LOG (error):  > Locations accessible in LOG but NOT in STATE (or checked): (Post TWTNW3: The Altar of Naught) Data Xemnas, Data Xemnas Event Location
BROWSER LOG (error):     ISSUE: Region Data Xemnas is not reachable
BROWSER LOG (error): REGION MISMATCH found for: {"type":"state_update","sphere_number":"12.3","player_id":"1"}
BROWSER LOG (error):  > Regions accessible in LOG but NOT in STATE: Data Xemnas
```

**Analysis**:
1. The Data Xemnas region has an exit from "Xemnas" region with access rule using helper `get_data_xemnas_rules`
2. The helper function is implemented in kh2Logic.js:2462
3. For normal difficulty (FightLogic = 1), it requires:
   - Combo Master: 1
   - Slapshot: 1
   - Reflect Element: 3
   - Slide Dash: 1
   - Flash Step: 1
   - Finishing Plus: 1
   - Guard: 1
   - Limit Form: 1
   - 2 ground finishers (from [Guard Break, Explosion, Finishing Leap])
   - Can reach "Limit level 5" location

4. According to sphere log:
   - Sphere 6.5: Player gets 1st Reflect Element
   - Sphere 8.15: Player gets 2nd Reflect Element
   - Sphere 10.9: Player gets Limit Form and "Limit level 5" becomes accessible
   - Sphere 12.3: Player gets 3rd Reflect Element (total 3) and Data Xemnas should become accessible

5. Possible issues to investigate:
   - Is `kh2_dict_count` working correctly for Reflect Element count of 3?
   - Is `kh2_list_count_sum` working correctly for ground finishers?
   - Is `kh2_can_reach` correctly identifying that "Limit level 5" is accessible?
   - Are all other required items present in the inventory by sphere 12.3?

**Proposed Solution**:
Need to debug further to identify which specific requirement is failing. Steps:
1. Add detailed logging to `get_data_xemnas_rules` to see which requirements pass/fail
2. Check if all required items are in the snapshot inventory
3. Verify that `kh2_can_reach('Limit level 5', ...)` returns true
4. Check if the helper functions (`kh2_dict_count`, `kh2_list_count_sum`) are working correctly

**Related Issues**:
- None identified yet

---

## Issue Template

When adding a new issue, use this format:

### Issue: [Brief Description]

**Priority**: [High/Medium/Low]
**Category**: [Helper Logic/Helper Implementation/State Check/Other]
**Status**: [Not Started/In Progress/Blocked]

**Description**:
[Detailed description of the issue]

**Evidence**:
- Helper function affected: [Name]
- Test output or error message
- Expected behavior vs actual behavior

**Analysis**:
[Root cause analysis if known]

**Proposed Solution**:
[How to fix it]

**Related Issues**:
[Links to related issues if any]

---
