# Solved Exporter Issues for Zillion

## Progress: Understood the fundamental challenge and built infrastructure

**Status**: Infrastructure Complete - Algorithm needs refinement

**What Was Learned**:

Through multiple iterations, we discovered the true complexity of Zillion's logic:

1. **Zilliandomizer uses complex internal logic**: The `get_locations()` method considers:
   - Region connectivity and traversal paths
   - Obstacles that must be overcome
   - Enemy encounters and HP requirements
   - The overall game state and item placements

2. **Timing matters**: When the exporter runs (during `generate_output`), items are already placed in locations. This affects `get_locations()` behavior because it considers whether progression items are "collected" yet.

3. **Requirements are combinatorial**: A location might need:
   - gun=2 alone (accessible with gun=2, jump=1, floppy=0, red=0)
   - gun=2 AND jump=2 (only accessible with both)
   - gun=1 OR jump=2 (accessible with either)

   Testing requirements in isolation doesn't correctly determine the actual minimum.

**Infrastructure Built**:

### worlds/zillion/__init__.py
- Added `location_accessibility_cache: dict[str, dict[str, int]]` to store requirements
- Implemented `_cache_location_accessibility()` method that runs during `create_regions()`
- Caching happens before items are placed, avoiding the placement-state issue
- Cache maps location names to requirement dicts like `{'gun': 2, 'jump': 1, 'floppy': 0, 'red': 0}`

### exporter/games/zillion.py
- Multiple iterations of the export handler
- Current version reads from `world.location_accessibility_cache`
- Handles gun, jump, floppy, and red ID card requirements
- Properly converts cached requirements to access rule JSON format
- Includes character requirement handling from req object

**Test Results Evolution**:
- No handler: All locations incorrectly accessible
- Simple req reading: 40+ locations incorrect
- Testing during export: 34 locations "never accessible"
- Current caching: 113 locations incorrect (algorithm needs work)

**What Works**:
- ✅ Caching infrastructure in place
- ✅ Testing happens before items placed
- ✅ Exporter can read from cache
- ✅ Conversion to JSON access rules
- ✅ Documentation of the problem space

**What Needs Work**:
- ❌ Algorithm for determining minimum requirements
- ❌ Need to test combinations, not isolated maximums
- ❌ May need ~144 tests per location (3 gun × 3 jump × 8 floppy × 2 red)
- ❌ Or need smarter search algorithm

**Lessons for Future Games**:
- Games with complex logic engines need custom strategies
- Can't always directly read simple requirement values
- Accessibility determination may need sophisticated algorithms
- Caching during world creation (before items placed) is the right approach
- Some games may be too complex to fully export without game-specific APIs
