# SMZ3 Helper Function Issues - Remaining

## Issue: Ganon's Tower region not reachable in sphere 12.4

**Status**: Investigating

**Description**:
After fixing the Sword alias issue, the test now progresses to sphere 12.4 where Ganon's Tower region fails to become reachable.

**Error Seen**:
```
REGION MISMATCH found for: {"type":"state_update","sphere_number":"12.4","player_id":1}
> Regions accessible in LOG but NOT in STATE: Ganon's Tower
    ISSUE: Region Ganon's Tower is not reachable
```

**Root Cause Analysis**:
The entrance rule for "Menu->Ganon's Tower" contains `function_call` rules with `CanAcquireAtLeast` method calls:
1. `CanAcquireAtLeast(7, 24)` - Check if player can complete at least 7 crystal dungeons (24 = AnyCrystal)
2. `CanAcquireAtLeast((4 * 7) / 7, 480)` - Check if player can complete at least 4 boss token regions (480 = AnyBossToken)

The second call uses `binary_op` rules for arithmetic ((4 * 7) / 7 = 4).

**Work Completed**:
1. ✅ Implemented `smz3_CanAcquireAtLeast` helper function in smz3Logic.js (lines 778-811)
2. ✅ Added `function_call` case to `evaluateSimpleRule()` in smz3Logic.js (lines 1024-1060)
3. ✅ Added `binary_op` case to `evaluateSimpleRule()` for arithmetic operations (lines 856-877)
4. ✅ Added `smz3_CanAcquireAtLeast` to helper dispatch table (line 923)
5. ✅ Added special handling in ruleEngine.js for state method calls (lines 764-808)

**Current Issue**:
The test still fails at sphere 12.4 with the same error. The helper functions may not be getting called correctly, or the logic may be incorrect.

**Next Steps**:
1. Add debug logging to trace when CanAcquireAtLeast is called
2. Verify reward_regions data is loaded correctly in staticData.settings
3. Check if the player actually has enough crystal dungeons completed at sphere 12.4
4. Verify checkRegionCompletion logic works for all crystal regions
5. Test the helper function manually with known data

**Files Modified**:
- frontend/modules/shared/gameLogic/smz3/smz3Logic.js (added CanAcquireAtLeast, function_call, binary_op support)
- frontend/modules/shared/ruleEngine.js (added state method call handling for function_call rules)

**Reward Type Reference** (from worlds/smz3/TotalSMZ3/Region.py):
```python
RewardType:
    Null = 0
    Agahnim = 1
    PendantGreen = 2
    PendantNonGreen = 4
    CrystalBlue = 8
    CrystalRed = 16
    AnyPendant = 6 (2 | 4)
    AnyCrystal = 24 (8 | 16)
    BossTokenKraid = 32
    BossTokenPhantoon = 64
    BossTokenDraygon = 128
    BossTokenRidley = 256
    AnyBossToken = 480 (32 | 64 | 128 | 256)
```
