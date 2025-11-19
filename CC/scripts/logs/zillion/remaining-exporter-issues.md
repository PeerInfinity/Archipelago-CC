# Remaining Exporter Issues for Zillion

## Issue 1: Zillion Logic Too Complex for Export

### Status
**BLOCKED** - Requires architectural changes or alternative approach

### Description
The exporter is reading zilliandomizer `Req` objects and converting them to access rules, but the resulting rules are incorrect. Locations that should be accessible in Sphere 0 (without any items) are being assigned rules that require Zillion, Opa-Opa, or both.

### Evidence

**Sphere 0 locations (from spheres_log.jsonl):**
These 12 locations should be accessible immediately without any items:
- A-3 top left-center
- A-4 bottom far left
- A-4 bottom right
- A-4 mid center
- A-4 top left
- A-6 bottom far right
- A-6 mid far right
- A-8 bottom center
- B-1 mid far left
- B-1 mid right
- B-1 top right-center
- B-8 top right

**Exporter DEBUG output shows:**
- B-1 mid far left: gun=1, jump=0 (exporter creates rule requiring 1 Zillion)
- A-3 top left-center: gun=1, jump=1 (exporter creates rule requiring 1 Zillion AND 1 Opa-Opa)
- A-4 bottom far left: gun=1, jump=0 (exporter creates rule requiring 1 Zillion)

**Test failure:**
- Locations accessible in LOG but NOT in STATE: All 12 Sphere 0 locations
- Locations accessible in STATE but NOT in LOG: F-8 bottom center, G-5 top far left, etc.

### Root Cause Analysis

The `zz_loc.req` object on zilliandomizer locations does NOT represent the actual accessibility requirements for reaching/collecting from that location. It appears to represent something else (possibly requirements for breaking canisters, or base requirements before some transformation).

The exporter's `_convert_req_to_rule()` method at line 41 directly converts the `Req` object to an access rule, assuming it represents true accessibility. This is incorrect.

### Investigation Needed

1. **What does `req` actually represent?**
   - Is it the requirement to break the canister vs. reach it?
   - Is there a transformation that happens during world generation?
   - Does zilliandomizer have a different method for computing accessibility?

2. **How does Python backend determine accessibility?**
   - In `logic.py`, the method `cs_to_zz_locs()` calls `self._zz_r.get_locations(have_req)`
   - This uses zilliandomizer's own logic, not the `req` field directly
   - We need to understand what `get_locations()` does

3. **Possible solutions:**
   - Don't use `zz_loc.req` at all - use a different method
   - Use the actual CollectionState/logic testing to determine requirements
   - Find if there's a "transformed" or "effective" requirement object

### Files Involved
- `exporter/games/zillion.py` - lines 41-161
- `worlds/zillion/logic.py` - shows how Python backend determines accessibility
- `worlds/zillion/region.py` - shows ZillionLocation structure

### Attempted Solutions

1. **Direct Req Conversion** (FAILED)
   - Tried converting zz_loc.req objects directly to rules
   - Problem: Req objects are modified by place_canister_gun_reqs() and don't represent actual accessibility
   - Result: Completely incorrect rules (locations requiring items when they should be free)

2. **Static Analysis** (FAILED)
   - Tried letting default analyzer parse location.access_rule function
   - Problem: Analyzer can't parse zilliandomizer's complex internal logic
   - Result: All rules returned as null (no requirements extracted)

3. **Empirical Testing** (PARTIALLY FAILED)
   - Tried testing locations with different CollectionStates to determine requirements
   - Problem: Testing occurs after item placement, zilliandomizer sees placed items
   - Result: Over 100 locations could not be determined, fall back to null rules

### Root Cause Summary

Zillion uses the zilliandomizer library for ALL logic. The access rules are determined by:
- `location.access_rule` → calls `lc.cs_to_zz_locs(cs)` (logic.py:215)
- `cs_to_zz_locs` → calls `zz_r.get_locations(have_req)` (logic.py:90)
- `get_locations` → zilliandomizer C/Cython internal logic

This chain is too complex for static analysis and too stateful for empirical testing.

### Possible Solutions (Not Implemented)

1. **Pre-placement Hook**
   - Export rules BEFORE items are placed in the world
   - Would require changes to export pipeline
   - Complexity: High

2. **Zilliandomizer API Extension**
   - Add zilliandomizer method to export logic directly
   - Would require changes to zilliandomizer library
   - Complexity: Very High

3. **Manual Rule Database**
   - Create hand-crafted rule database for all Zillion locations
   - Maintenance burden, prone to errors
   - Complexity: Medium, but high maintenance

4. **Simplified Approximation**
   - Export simplified rules that approximate the logic
   - May not match Python backend exactly
   - Complexity: Medium

### Recommendation

Zillion should be marked as **not supported** for JSON export until one of the solutions above can be implemented. The complexity of zilliandomizer integration makes automatic rule extraction infeasible with current architecture.
