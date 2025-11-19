# Remaining Exporter Issues for Zillion

## Issue 1: Location requirements stored in zz_loc.req do not match actual accessibility

**Status**: Under investigation

**Description**:
The exporter reads location access requirements from `location.zz_loc.req`, but these values don't match the actual accessibility determined by Archipelago's logic.

**Test Results**:
Spoiler test fails at Sphere 0 with 41 locations accessible in JavaScript but not in the Python sphere log.

**Example**:
- Location "C-3 mid far right" has `req.gun=1, req.jump=0`
- According to sphere log, this location becomes accessible in sphere 0.3 after getting 1 Zillion item
- The exporter interprets `req.gun=1` as "no Zillion items needed" (since starting gun level is 1)
- This causes the location to be marked as accessible from the start in the JSON export

**Root Cause**:
Zillion uses the `zilliandomizer` library for logic. The `req` attribute on locations appears to store different information than the actual access requirements used by Archipelago's `randomizer.get_locations()` function.

The actual Archipelago logic works by:
1. Calling `randomizer.get_locations(have_req)` with the player's current abilities
2. This returns a set of accessible zilliandomizer locations
3. Checking if each location is in that set

This dynamic approach can't be easily translated to static JSON rules by reading `req` attributes alone.

**Investigation Findings**:
- Default `Req()` has `gun=0, jump=0, floppy=0, red=0`
- Starting player state is `Req(gun=1, jump=1, floppy=0, red=0)`
- Region "C-3 " is accessible from sphere 0
- Location "C-3 mid far right" in that region has `req.gun=1, req.jump=0`
- But the location only becomes accessible in sphere 0.3 (after getting Zillion)
- This suggests the `req` values don't represent the full access logic

**Potential Solutions**:
1. **Query the randomizer with different inventory states** to deduce requirements
   - For each location, test with different combinations of items to determine the minimum needed
   - Convert the results to static JSON rules
   - Computationally expensive but accurate

2. **Find the actual source of requirements in zilliandomizer**
   - The `req` attribute might not be the final authority
   - `place_canister_gun_reqs()` is called but may not fully set all requirements
   - Need to examine zilliandomizer source code

3. **Export the zilliandomizer logic as-is**
   - Create a JavaScript implementation of the `get_locations()` algorithm
   - This would require porting the zilliandomizer logic to JavaScript
   - Most accurate but most complex

**Next Steps**:
- Examine zilliandomizer library source to understand how `get_locations()` works
- Determine if `place_canister_gun_reqs()` properly sets all requirements
- Consider implementing solution #1 (exhaustive querying) if source analysis doesn't reveal simpler approach
