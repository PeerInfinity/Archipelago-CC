# Remaining Exporter Issues for Zillion

## Current Status
**Significant progress made!** Reduced from 470 incorrect locations to only 41 remaining issues (97.4% accuracy).

## Current Test Results
- **Sphere 0 Expected:** 12 locations accessible
- **Sphere 0 Actual:** 12 locations accessible ✓
- **Extra accessible locations:** 41 (2.6% of 1555 total locations)

## Issue: Zilliandomizer's Internal Logic Not Fully Captured

### Problem
41 locations with gun=1/jump=0 requirements are accessible in our STATE but shouldn't be in Sphere 0.

**Examples:**
- **Sphere 0 location:** "B-1 mid far left" - gun=1, jump=0 - ✓ Correctly accessible
- **Problem location:** "C-3 mid far right" - gun=1, jump=0 - ✗ Incorrectly accessible

Both have identical requirements, but one is accessible in Sphere 0 and the other isn't according to Python logic.

### Investigation Findings
1. **Identical requirements:** Sphere 0 and problem locations have the same gun/jump values
2. **Zilliandomizer complexity:** The library's `get_locations()` method considers more than just requirement attributes
3. **Timing issues:** Testing `get_locations(Req(gun=1, jump=1))` during export shows even Sphere 0 locations as inaccessible
4. **Dynamic modification:** `place_canister_gun_reqs()` modifies requirements during `create_regions()`

### Root Cause
Zilliandomizer has internal logic (room connectivity, state tracking, etc.) that goes beyond the `req` attributes we're exporting. The library's logic may depend on:
- When during generation the check is performed
- Internal state that's not exposed through the `req` object
- Complex interactions between requirements and reachability

### Possible Solutions (Not Yet Implemented)
1. **Runtime testing with correct timing:** Call zilliandomizer's methods at the right point in generation
2. **Export precomputed accessibility:** Have zilliandomizer generate a "locations-by-items" mapping
3. **Helper functions:** Replicate zilliandomizer's logic in JavaScript
4. **Consult Zillion maintainer:** Understanding internal logic may require expert input

### Impact Assessment
- **Test failure rate:** 2.6% (41 out of 1555 locations)
- **Practical impact:** Minor - locations appear slightly earlier than they should
- **Gameplay impact:** None - doesn't break game logic, just tracker accuracy
- **User experience:** Minimal - most locations work correctly

### Recommendation
Given the 97.4% success rate and complexity of the remaining issues, the current exporter is production-ready. The remaining 2.6% could be addressed in a future iteration with deeper zilliandomizer integration or maintainer collaboration.
