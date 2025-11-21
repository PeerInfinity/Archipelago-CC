# Remaining Exporter Issues for Zillion

## Issue 1: Complex accessibility logic requires sophisticated algorithm

**Status**: In Progress (Multiple approaches attempted)

**Current Test Results**: 113 locations incorrectly marked as accessible in Sphere 0 (worse than previous 40)

**Description**:
The Zillion exporter needs to determine location accessibility requirements by interfacing with the zilliandomizer library. The library uses complex internal logic that considers:
- Region traversal and connectivity
- Obstacles and enemy encounters
- Item placement state
- Combinations of items (e.g., needs gun=2 AND jump=2, not just gun=2 OR jump=2)

**Attempted Solutions**:

### Attempt 1: Simple req object reading
- Read `zz_loc.req.gun`, `zz_loc.req.jump`, etc. directly
- Convert to access rules if values > baseline
- **Result**: 40+ locations incorrectly accessible
- **Issue**: Doesn't capture complex traversal logic

### Attempt 2: Testing with get_locations() during export
- Call `zz_randomizer.get_locations(Req(...))` with different item combinations
- Determine requirements by testing what makes location accessible
- **Result**: 34 locations marked as "never accessible"
- **Issue**: Items already placed when exporter runs

### Attempt 3: Clearing items during testing
- Save and clear all items before testing
- Test accessibility, then restore items
- **Result**: Breaks zilliandomizer internal state

### Attempt 4: Caching during create_regions (Current)
- Cache accessibility before items are placed in `_cache_location_accessibility()`
- Test each location with various item combinations
- **Result**: 113 locations incorrectly accessible
- **Issue**: Testing in isolation (gun=X with jump=3, floppy=126, red=1) doesn't find minimum requirements correctly

**The Core Problem**:
To find minimum requirements, we need to test **combinations**:
- If location accessible with gun=2, jump=3, floppy=126, red=1
- Is it also accessible with gun=2, jump=1, floppy=0, red=0?
- Or does it need gun=2 AND jump=2?

Current algorithm tests each requirement independently with max other values, which incorrectly marks many locations as baseline accessible.

**Code Locations**:
- `exporter/games/zillion.py` - Export handler with cache reading
- `worlds/zillion/__init__.py` - Added `_cache_location_accessibility()` method and cache storage

**Potential Next Steps**:
1. **Implement proper combination testing**: Test various combinations to find true minimum
2. **Use smarter search algorithm**: Binary search on the requirement space
3. **Accept limitations**: Use heuristic approach (req object + region-based rules)
4. **Research zilliandomizer API**: Check if there's a direct way to query minimum requirements
5. **Generate lookup table**: Create accessibility matrix offline and embed with game

**Alternative Approaches**:
- Generate complete accessibility data once, store with game distribution
- Use simpler heuristic: locations in certain regions always need certain items
- Only export gun/jump requirements, ignore full traversal complexity
- Add region-based access rules in addition to location rules
