# Super Metroid - Remaining Helper Issues

## Issue 1: RomPatches and traverse() helpers not evaluating correctly in frontend

**Status:** Identified - Not yet addressed
**Priority:** Medium
**Sphere:** 0.1 (fractional sphere after Morph Ball collection)
**Locations affected:** Missile (blue Brinstar bottom), Missile (blue Brinstar middle), and potentially others

### Problem Description

Some locations have complex `Available` rules that reference helper functions which are not being evaluated correctly by the frontend state engine.

**Example location:** Missile (blue Brinstar middle)
- AccessFrom: `lambda sm: SMBool(True)` (simple, no requirements)
- Available: `lambda sm: sm.wand(sm.wor(RomPatches.has(...), sm.haveItem('Morph')), sm.wor(RomPatches.has(...), sm.traverse(...)))`

In the Python world (during spoiler log generation), these locations become accessible at Sphere 0.1 (after collecting Morph Ball). The RomPatches checks and traverse() calls evaluate to True.

In the frontend (JavaScript state evaluation), these same access rules evaluate to False, causing the locations to not be accessible.

### Evidence

From sphere log (Sphere 0.1):
```json
{
  "type": "state_update",
  "sphere_index": "0.1",
  "player_data": {
    "1": {
      "new_inventory_details": {"base_items": {"Morph Ball": 1}},
      "new_accessible_locations": ["Missile (blue Brinstar bottom)", "Missile (blue Brinstar middle)"]
    }
  }
}
```

From spoiler test failure:
```
STATE MISMATCH found for: {"type":"state_update","sphere_number":"0.1","player_id":1}
> Locations accessible in LOG but NOT in STATE (or checked): Missile (blue Brinstar bottom), Missile (blue Brinstar middle)
    ISSUE: Access rule evaluation failed
```

### Root Cause Analysis

The access rules are being exported correctly from the exporter. The issue is that the frontend JavaScript helper evaluation does not have proper context for:
1. **RomPatches.has()** - Frontend may not have access to the RomPatches state
2. **sm.traverse()** - Frontend may not implement the traverse helper correctly

### Potential Solutions

1. **Implement RomPatches context in frontend**
   - Ensure RomPatches state is available in the frontend state engine
   - Implement proper evaluation of RomPatches.has() checks

2. **Implement traverse() helper in frontend**
   - Add proper region connectivity checking for traverse() calls
   - Ensure it evaluates based on current accessible regions

3. **Pre-evaluate these helpers during export**
   - Detect RomPatches and traverse() patterns
   - Convert them to simpler rules that the frontend can evaluate
   - May require world-specific knowledge

4. **Export RomPatches state with rules**
   - Include RomPatches configuration in the rules.json
   - Let frontend read and apply patches appropriately

### Impact

This issue affects sphere progression validation in the spoiler tests. It does not appear to affect actual gameplay, as these are spoiler log validation failures rather than game logic failures.

**Locations known to be affected:**
- Missile (blue Brinstar bottom)
- Missile (blue Brinstar middle)
- Potentially other locations with RomPatches or traverse() requirements

### Related Code

- Frontend helper evaluation (JavaScript)
- `exporter/games/sm.py:expand_rule()` (exports these helpers)
- `worlds/sm/variaRandomizer/graph/vanilla/graph_locations.py` (source definitions)
- Frontend state engine (evaluates access rules)

### Next Steps

1. Investigate frontend helper implementation for RomPatches and traverse()
2. Determine if this is a missing feature or a bug
3. Implement proper helper evaluation or pre-evaluation during export
