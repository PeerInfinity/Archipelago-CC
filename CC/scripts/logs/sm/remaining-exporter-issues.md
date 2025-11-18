# Remaining Exporter Issues

## Issue 1: VARIA Logic Function Calls Not Evaluating Correctly (CRITICAL)

**Status**: Active
**Test Run**: 2025-11-18T04:57:04

**Problem**: Location access rules containing VARIA logic function calls (sm.wor, sm.canFly, sm.haveItem, etc.) are not evaluating correctly, leading to incorrect accessibility.

**Symptoms** (Sphere 0):
- Locations in LOG but NOT in STATE:
  - Energy Tank, Brinstar Ceiling

- Locations in STATE but NOT in LOG:
  - Energy Tank, Terminator
  - Missile (Crateria gauntlet right)
  - Missile (Crateria gauntlet left)
  - Power Bomb (blue Brinstar)

**Root Cause**: Access rules contain function_call nodes referencing VARIA randomizer logic functions (sm.wor, sm.canFly, sm.haveItem, etc.) from Python that don't exist in JavaScript.

**Attempted Fixes**:
1. ✅ Simplified evalSMBool(SMBool(true), ...) patterns (80 cases)
2. ✅ Added state.smbm initialization with maxDiff
3. ❌ Still failing - VARIA logic functions need JS implementations

**Recommended Solution**: Implement VARIA logic stubs in JavaScript
- Create sm/variaLogic.js with function implementations
- Start with commonly used functions (wor, wand, haveItem, canFly, etc.)
- Use Python VARIA randomizer source as reference

**Time Estimate**: 4-8 hours

