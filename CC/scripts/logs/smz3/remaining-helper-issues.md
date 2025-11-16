# Remaining Helper Issues

## Issue 1: Missing CanBeatBoss helper function

**Status**: Identified
**Sphere**: 4.3
**Location**: Tower of Hera - Moldorm

### Description
The helper function `CanBeatBoss` is referenced in location access rules but not implemented in the SMZ3 logic file.

### Evidence
```
Helper function "CanBeatBoss" NOT FOUND in snapshotInterface
ISSUE: Access rule evaluation failed
Location: Tower of Hera - Moldorm
```

### Fix Needed
Implement `smz3_CanBeatBoss` in `frontend/modules/shared/gameLogic/smz3/smz3Logic.js`.

Need to check the Python source code to understand what items/conditions are required to beat bosses in SMZ3.

