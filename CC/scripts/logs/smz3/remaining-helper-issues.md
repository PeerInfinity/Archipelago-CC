# Remaining Helper Issues

## Issue 1: smz3_can_enter_region always returns true - causing 32 regions to be incorrectly accessible

**Description**: The `smz3_can_enter_region` helper function currently returns `true` for all regions, causing the test to mark 32 regions as accessible in Sphere 0 when they shouldn't be.

**Location**: `frontend/modules/shared/gameLogic/smz3/smz3Logic.js:44-48`

**Current Implementation**:
```javascript
export function smz3_can_enter_region(snapshot, staticData) {
  // Temporary implementation: allow all region entries
  // This unblocks initial testing while proper SMZ3 logic is implemented
  return true;
}
```

**Impact**: Test fails at Sphere 0 with mismatches:
- **Regions accessible in STATE but NOT in LOG**: Castle Tower, Desert Palace, Tower of Hera, Palace of Darkness, Swamp Palace, Skull Woods, Thieves' Town, Ice Palace, Misery Mire, Turtle Rock, Ganon's Tower, Light World Death Mountain West, Light World Death Mountain East, Dark World Death Mountain East, Dark World North West, Dark World North East, Dark World South, Dark World Mire, Crateria West, Crateria East, Brinstar Green, Brinstar Pink, Brinstar Red, Brinstar Kraid, Wrecked Ship, Maridia Outer, Maridia Inner, Norfair Upper West, Norfair Upper East, Norfair Upper Crocomire, Norfair Lower West, Norfair Lower East (32 total)
- **Locations accessible in STATE but NOT in LOG**: 49 locations incorrectly marked as accessible

**Priority**: HIGH - This is the main blocker for passing the spoiler test

**Next Steps**: Need to check the spheres log to understand what regions SHOULD be accessible in Sphere 0, then implement the correct logic for `smz3_can_enter_region`. The Python implementation uses `region.CanEnter(state.smz3state[player])` which has complex SMZ3-specific logic that needs to be ported to JavaScript.

