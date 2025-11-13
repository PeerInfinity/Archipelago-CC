# Remaining Exporter Issues for Jak and Daxter

This file tracks exporter issues that still need to be fixed.

## Issues

### Issue 1: Reachable Orbs not exported as items

**Status:** Active
**Priority:** High (blocks all orb trade locations)
**Affected Locations:** All orb trade locations (15 locations in sphere 3.15)
- RV: Bring 120 Orbs To The Oracle (1)
- RV: Bring 120 Orbs To The Oracle (2)
- RV: Bring 90 Orbs To The Gambler
- RV: Bring 90 Orbs To The Geologist
- RV: Bring 90 Orbs To The Warrior
- SV: Bring 120 Orbs To The Oracle (1)
- SV: Bring 120 Orbs To The Oracle (2)
- SV: Bring 90 Orbs To The Mayor
- SV: Bring 90 Orbs to Your Uncle
- VC: Bring 120 Orbs To The Oracle (1)
- VC: Bring 120 Orbs To The Oracle (2)
- VC: Bring 90 Orbs To The Miners (1)
- VC: Bring 90 Orbs To The Miners (2)
- VC: Bring 90 Orbs To The Miners (3)
- VC: Bring 90 Orbs To The Miners (4)

**Description:**
The exporter generates access rules that call the `can_reach_orbs` helper function (when orbsanity is off), which expects a "Reachable Orbs" item in the inventory. However, "Reachable Orbs" is not exported as an item in the rules.json file.

In the Python code, "Reachable Orbs" is a dynamically calculated value stored in `state.prog_items` that gets updated as new regions become accessible. The sphere log shows this working correctly - "Reachable Orbs" starts at 332 in sphere 0 and increases to 482 when Fisherman's Boat is obtained.

**Root Cause:**
"Reachable Orbs" is a calculated progressive item in Python that doesn't exist as a static item definition. The exporter needs to:
1. Export "Reachable Orbs" as an event item in the items list
2. Create event locations that grant "Reachable Orbs" when regions with orbs become accessible
3. OR modify the helper function to calculate reachable orbs dynamically in JavaScript

**Test Results:**
```
STATE MISMATCH found for: {"type":"state_update","sphere_number":"3.15","player_id":"1"}
> Locations accessible in LOG but NOT in STATE (or checked):
  RV: Bring 120 Orbs To The Oracle (1), RV: Bring 120 Orbs To The Oracle (2), ...
  ISSUE: Access rule evaluation failed (repeated 15 times)
```

**Next Steps:**
Need to investigate the best approach:
1. Check how other games handle dynamically calculated items
2. Examine if there's a mechanism to export event items for calculated values
3. Consider implementing JavaScript calculation of reachable orbs based on accessible regions
