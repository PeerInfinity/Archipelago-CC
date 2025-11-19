# Super Metroid - Remaining Exporter Issues

This file tracks issues that need to be fixed in the exporter (exporter/games/sm.py).

## Issues

### Issue 1: Incorrect simplification of evalSMBool calls

**Status**: Identified
**Severity**: Critical
**Affected Locations**: Multiple locations including:
- Energy Tank, Terminator (incorrectly always accessible)
- Missile (Crateria gauntlet right) (incorrectly always accessible)
- Missile (Crateria gauntlet left) (incorrectly always accessible)
- Power Bomb (blue Brinstar) (incorrectly always accessible)
- Energy Tank, Brinstar Ceiling (incorrectly NOT accessible)

**Description**:
The exporter is incorrectly handling `evalSMBool` calls in two different ways:

1. **Over-simplification**: Some `evalSMBool(SMBool(True), ...)` calls are being simplified to constant `true`, making locations always accessible when they should require specific items. For example:
   - "Energy Tank, Terminator" has access_rule = `and(true, true)` but should only be accessible after getting Bomb (Sphere 1.2)
   - Gauntlet missiles have access_rule = `and(true, true)` but should only be accessible after getting Reserve Tank (Sphere 2.1)

2. **Incomplete VARIA logic export**: Some locations like "Energy Tank, Brinstar Ceiling" have access rules that reference VARIA logic functions (sm.wor, sm.canFly, sm.haveItem, etc.) which cannot be evaluated in JavaScript because:
   - The `sm` object doesn't exist in the JavaScript context
   - These are complex Python closures that reference the SMBoolManager
   - The function calls fail to evaluate, making the location inaccessible when it should be accessible in Sphere 0

**Root Cause**:
The exporter's `expand_rule` method in sm.py checks for `SMBool(True)` patterns and simplifies them to constant True, but:
- It doesn't account for the difficulty rating of the SMBool
- It doesn't properly evaluate what the VARIA logic functions would return
- The simplification happens too aggressively without checking if the SMBool has additional conditions

**Expected Behavior**:
According to the sphere log for seed 1:
- Sphere 0: Only "Energy Tank, Brinstar Ceiling" and "Morphing Ball" should be accessible
- Sphere 1.2: "Energy Tank, Terminator" becomes accessible (requires Bomb)
- Sphere 2.1: Gauntlet missiles become accessible (requires Reserve Tank)

**Current Behavior**:
- Sphere 0: "Energy Tank, Terminator", gauntlet missiles, and "Power Bomb (blue Brinstar)" are accessible (incorrect)
- Sphere 0: "Energy Tank, Brinstar Ceiling" is NOT accessible (incorrect)

**Test Output**:
```
Locations accessible in LOG but NOT in STATE: Energy Tank, Brinstar Ceiling
Locations accessible in STATE but NOT in LOG: Energy Tank, Terminator, Missile (Crateria gauntlet right), Missile (Crateria gauntlet left), Power Bomb (blue Brinstar)
```

**Progress Made**:
1. Changed exporter to skip accessFrom comprehensions in AND rules, using only the Available rule
2. This fixed "Morphing Ball" - it's now correctly accessible in Sphere 0
3. Remaining issues:
   - "Energy Tank, Brinstar Ceiling" has complex VARIA logic (sm.wor, sm.canFly, etc.) that can't be evaluated
   - Locations with `Available = SMBool(True)` are always accessible, even when their regions shouldn't be reachable

**Root Cause Analysis**:
The Super Metroid world uses a two-layer accessibility system:
1. **AccessFrom**: Which regions can reach this location's region (complex comprehension)
2. **Available**: What items/tricks are needed at the location itself (VARIA logic)

The normal Archipelago pattern is:
1. **Entrance rules**: Which regions connect to which
2. **Location rules**: What items are needed at each location

The exporter is trying to combine these, but:
- AccessFrom comprehensions hit recursion limits and can't be properly analyzed
- Available rules use VARIA logic (sm.wor, sm.wand, sm.haveItem, etc.) which needs JavaScript implementation

**Next Steps**:
1. Implement basic VARIA logic helpers in the frontend (wor, wand, haveItem, etc.)
2. Stop simplifying evalSMBool(SMBool(True), ...) to constant True
3. Make evalSMBool actually evaluate the SMBool's difficulty against maxDiff
4. Test with the complex VARIA logic rules
