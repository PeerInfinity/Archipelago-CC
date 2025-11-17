# Remaining Helper Issues for Lingo

## 1. Room reachability checking causing missed regions

**Status:** Not Fixed
**Priority:** High
**Location:** `frontend/modules/shared/gameLogic/lingo/lingoLogic.js` - `_lingo_can_satisfy_requirements` function

**Description:**
The `_lingo_can_satisfy_requirements` function checks if required rooms are in `snapshot.reachableRegions`, but this causes issues when evaluating entrance accessibility. Many starting rooms that should be accessible aren't being reached.

**Current Test Status:**
- 35 regions accessible in LOG but NOT in STATE (should be accessible)
- 17 locations accessible in LOG but NOT in STATE
- 1 region accessible in STATE but NOT in LOG (Pilgrim Antechamber - shouldn't be accessible)

**Expected Behavior:**
Starting regions like "Hidden Room", "Hub Room", "Second Room" should be accessible in Sphere 0 (no items required).

**Door Requirements Example:**
The "Back Right Door" in "Starting Room" has door_reqs that only require being in "Starting Room":
```json
{
  "rooms": ["Starting Room"],
  "doors": [],
  "colors": [],
  "items": []
}
```

**Potential Issue:**
The circular dependency or timing issue where rooms need to be reachable to check if their doors are accessible, but the doors need to be accessible to make rooms reachable.

**Next Steps:**
- Investigate state manager's region processing order
- Check if reachableRegions is updated at the right time
- Consider whether room requirements should be checked differently for doors vs locations
