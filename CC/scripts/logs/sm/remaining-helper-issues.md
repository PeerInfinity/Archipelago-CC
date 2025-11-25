# Remaining Super Metroid Helper Issues

## Issue 1: Difficulty Summing at Sphere 6.1

**Status**: In Progress

**Description**:
At Sphere 6.1, after defeating Botwoon, the frontend incorrectly marks Post Botwoon and Draygon areas as accessible when they shouldn't be. The Python backend correctly keeps them inaccessible until Sphere 6.3 when Gravity Suit is obtained.

**Root Cause Analysis**:
The access rule for Post Botwoon requires:
- `canJumpUnderwater()` - returns SMBool(true, 50) with knowsGravLessLevel1 at difficulty 50
- `canPassBotwoonHallway()` - returns SMBool(true, 5) with knowsMochtroidClip at difficulty 5
- `haveItem("Botwoon")` - returns SMBool(true, 0)

The `wand` function should sum these difficulties: 50 + 5 + 0 = 55
With maxDiff = 50 (Hardcore), the rule should return FALSE (55 > 50).

**Suspected Issue**:
The difficulty check at depth 0 in the rule engine or reachability engine may not be working correctly when evaluating exit rules for regions. Need to verify that:
1. The `wand` helper is correctly summing difficulties
2. The rule engine is checking difficulty at depth 0
3. The `state.smbm[playerId].maxDiff` is being read correctly

**Files Involved**:
- `frontend/modules/shared/ruleEngine.js` - lines 434-448 (depth 0 difficulty check)
- `frontend/modules/stateManager/core/reachabilityEngine.js` - lines 386-394 (SMBool handling)
- `frontend/modules/shared/gameLogic/sm/smLogic.js` - wand function
