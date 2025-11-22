# SMZ3 Helper Function Issues - Remaining

## Issue: Missing helper function smz3_CanBeatArmos at sphere 13.3

**Status**: Investigating

**Description**:
After fixing the Ganon's Tower reachability issue, the test now progresses to sphere 13.3 where a new error occurs: missing helper function `smz3_CanBeatArmos`.

**Error Seen**:
```
Helper function "smz3_CanBeatArmos" NOT FOUND in snapshotInterface
ISSUE: Access rule evaluation failed
```

**Next Steps**:
1. Check which locations require smz3_CanBeatArmos
2. Determine if this is a boss-specific helper that needs to be implemented
3. Look at similar boss helpers to understand the pattern
4. Implement smz3_CanBeatArmos if needed

**Files to Investigate**:
- frontend/modules/shared/gameLogic/smz3/smz3Logic.js
- frontend/presets/smz3/AP_14089154938208861744/AP_14089154938208861744_rules.json
