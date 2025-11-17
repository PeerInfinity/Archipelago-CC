# Zillion Exporter - Remaining Issues

## Issue 1: Exporter querying zilliandomizer returns too many accessible locations (CRITICAL)

**Status**: Blocked - Need to investigate zilliandomizer behavior
**Priority**: Critical
**Affects**: All locations

### Description

The exporter currently reads `location.zz_loc.req` fields and tries to convert them to access rules. However, this approach is fundamentally flawed because:

1. The Python world doesn't use simple Req-based rules
2. Instead, it uses `zilliandomizer.get_locations(ability)` which performs complex pathfinding and logic
3. The Req objects don't capture the full accessibility requirements (e.g., region connectivity, item placement logic)

### Evidence

Locations with incorrect access rules:
- **"H-8 top right-center"**: Exported as always accessible, but should require jump ability (Opa-Opa) according to sphere log (accessible at sphere 2.30)
- **"L-2 mid far right"**: Exported as always accessible, but should require gun ability (Zillion) according to sphere log (accessible at sphere 1.17)
- **"A-3 top left-center"**: Exported as requiring `(Zillion>=1 OR Champ) AND (Opa-Opa>=2 OR Apple)`, but should be accessible at start (sphere 0)
- **"B-1 mid far left"**: Exported as requiring `(Zillion>=1 OR Champ)`, but should be accessible at start (sphere 0)

Debug output shows these locations have `req` with all zero values:
```
DEBUG zero-req location: H-8 top right-center: ALL req fields = {'gun': 0, 'jump': 0, 'char': ('JJ', 'Apple', 'Champ'), 'hp': 0, 'door': 0, 'have_doors': set(), 'skill': 0, 'union': None, 'red': 0, 'floppy': 0}
DEBUG zero-req location: L-2 mid far right: ALL req fields = {'gun': 0, 'jump': 0, 'char': ('JJ', 'Apple', 'Champ'), 'hp': 0, 'door': 0, 'have_doors': set(), 'skill': 0, 'union': None, 'red': 0, 'floppy': 0}
```

But the zilliandomizer logic determines they're not accessible with no items.

### Root Cause

File: `exporter/games/zillion.py`, method `get_custom_location_access_rule()`

The Python world (worlds/zillion/__init__.py lines 212-222) uses:
```python
def access_rule_wrapped(zz_loc_local: ZzLocation, lc: ZillionLogicCache, cs: CollectionState) -> bool:
    accessible = lc.cs_to_zz_locs(cs)
    return zz_loc_local in accessible
```

This calls `zilliandomizer.get_locations()` which performs full logic evaluation including:
- Region pathfinding
- Ability calculations from items
- Complex item dependencies

### Attempted Solution

**Approach 1**: Query zilliandomizer directly (IMPLEMENTED but FAILS)

The exporter was rewritten to:
1. Sync item placements from Archipelago to zilliandomizer
2. Query `zilliandomizer.get_locations()` with different item combinations
3. Determine which items make each location accessible
4. Build access rules from that analysis

**Result**: This approach marks TOO MANY locations as accessible. When querying with no items (`get_locations([])`), the zilliandomizer returns 135+ locations as accessible, but according to the sphere log, only 12 should be accessible at sphere 0.

**Current Theory**: The issue may be related to:
- Item placement information affecting accessibility calculation in unexpected ways
- The zilliandomizer using region connectivity differently than expected
- The need to call `place_canister_gun_reqs()` before querying (which modifies requirements)

### Next Steps

Need to investigate:
1. Why does `zilliandomizer.get_locations([])` return so many locations?
2. Does item placement sync affect which locations are considered accessible?
3. Is there a different API we should be using to query requirements?
4. Should we extract requirements from the Python access_rule functions instead?

### Implementation Plan

1. Cache the world's `zz_system.randomizer` object in the exporter
2. For each location:
   a. Check if accessible with no items -> if yes, export `{"type": "constant", "value": true}`
   b. If not accessible with no items, try adding each item type and check accessibility
   c. Build an OR rule for items that grant access
   d. For items with counts (Zillion, Opa-Opa, etc.), binary search to find minimum count needed
3. Optimize by caching `get_locations()` results for each item combination

### Test Cases

After fix, these locations should have correct rules:
- "H-8 top right-center": Should require jump ability (Opa-Opa count >= X or Apple)
- "L-2 mid far right": Should require gun ability (Zillion count >= X or certain character)
- "A-3 top left-center": Should be accessible from start
- "B-1 mid far left": Should be accessible from start
