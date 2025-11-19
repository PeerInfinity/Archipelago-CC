# SMZ3 Remaining General Issues

## Summary
General issues with SMZ3 implementation that need to be fixed.

## Issues

### 1. Sahasrahla Location Not Accessible in STATE (Sphere 5.8)
**Status**: Active
**Severity**: High
**Description**: The "Sahasrahla" location is accessible in Python LOG but NOT in JavaScript STATE during Sphere 5.8. The error message says "Access rule evaluation failed".

**Test Output**:
```
Locations accessible in LOG but NOT in STATE (or checked): Sahasrahla
ISSUE: Access rule evaluation failed
```

**Details**:
- Access rule for Sahasrahla: `smz3_CanAcquire(2)` (requires PendantGreen from Swamp Palace)
- Swamp Palace boss (Arrghus) requires: KeySP, Hammer, Hookshot
- At sphere 5.8, player collects KeySP and should have Hammer=1, Hookshot=1 from earlier

**Progress**:
- Implemented CanComplete logic for Castle Tower (Agahnim) in smz3_CanAcquire
- Added manual evaluation of simple AND+item_check rules to avoid recursive evaluateRule issues
- Test now progresses to Sphere 5.8 (was failing at Sphere 0)
- Added extensive logging to debug the issue

**Root Cause Found**:
The snapshot passed to `smz3_CanAcquire` has an inventory where **all items are set to 0**, even though the player has collected items. When checking if Swamp Palace boss is defeatable, the function checks for KeySP, Hammer, and Hookshot, but all show count=0 in the snapshot.

**Evidence**:
```
[smz3_CanAcquire] snapshot.inventory keys: 151
[smz3_CanAcquire] Sample inventory - Hammer: 0 Hookshot: 0 KeySP: 0
[smz3_CanAcquire] Checking items for Swamp Palace - Arrghus:
  [{"item":"KeySP","required":true,"has":false,"count":0},
   {"item":"Hammer","required":true,"has":false,"count":0},
   {"item":"Hookshot","required":true,"has":false,"count":0}]
```

**Expected**: By sphere 5.8, player should have Hammer=1, Hookshot=1, and collects KeySP=1

**Next Steps**:
- This is a **SYSTEMIC ISSUE** with snapshot creation for helper functions
- The snapshot should reflect the current game state inventory, not an empty inventory
- Need to investigate how snapshots are created when evaluating helper functions in the rule engine
- This likely requires a fix in the core rule engine or state snapshot creation code, not in SMZ3-specific logic

