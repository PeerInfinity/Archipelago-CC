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
- At sphere 5.8, player has all required items
- smz3_CanAcquire logs show it correctly evaluates to true: `Manually evaluated boss location (Swamp Palace - Arrghus): true`
- However, Sahasrahla is still not showing as accessible in STATE

**Progress**:
- Implemented CanComplete logic for Castle Tower (Agahnim) in smz3_CanAcquire
- Added manual evaluation of simple AND+item_check rules to avoid recursive evaluateRule issues
- Test now progresses to Sphere 5.8 (was failing at Sphere 0)

**Next Steps**:
- Investigate why the access rule evaluation fails despite smz3_CanAcquire returning true
- Check if there's an issue with helper function registration or invocation
- Examine the rule engine's handling of helper calls during location accessibility checks

