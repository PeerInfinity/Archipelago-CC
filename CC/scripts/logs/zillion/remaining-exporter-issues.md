# Remaining Exporter Issues for Zillion

## Issue 1: 34 locations marked as accessible from start when they require items

**Status**: Significant Progress Made - From 113 failures to 34 failures

**Current Test Results**: 34 locations incorrectly marked as accessible in Sphere 0

**Description**:
After extensive investigation and multiple algorithm improvements, 34 locations are still incorrectly marked as `constant: true` (accessible from start) when they actually require items.

**Affected Locations** (34 total):
E-4 mid center, E-5 top far right, F-8 bottom center, G-4 mid center, G-5 top far right, G-6 bottom far left, G-7 mid center, H-6 bottom far left, H-7 top far left, I-5 mid far right, I-6 mid right-center, E-2 bottom left-center, J-2 bottom right-center, J-3 mid far left, J-4 bottom left-center, J-5 top left, J-5 mid left-center, K-2 bottom right, K-2 mid far left, K-2 mid left, L-2 top left-center, L-2 mid far right, L-7 mid left, M-3 bottom right-center, M-5 top left-center, M-6 bottom right-center, N-2 top center, N-2 bottom right, N-2 top left, N-2 bottom left, N-4 mid left, N-7 bottom far left, O-3 mid right, O-5 mid far left

**Example Mismatches**:
- E-4 mid center: Should require Zillion (accessible in Sphere 1.6), marked as constant: true
- E-5 top far right: Should require Zillion (accessible in Sphere 1.6), marked as constant: true
- J-2 bottom right-center: Should require Opa-Opa (accessible in Sphere 2.9), marked as constant: true

**Progress Made**:

### Algorithm Evolution:
1. **Simple req reading**: 40+ failures
2. **Testing during export (items placed)**: 34 failures (locations marked as "never accessible")
3. **Caching with max values**: 113 failures (major regression)
4. **Caching with req-based combinations**: 34 failures (current)

### Current Implementation:
Located in `worlds/zillion/__init__.py`:
- `_cache_location_accessibility()` method (lines 172-241)
- Called during `create_regions()` after `place_canister_gun_reqs()`
- Tests accessibility with zilliandomizer's `get_locations()` method
- Starts with baseline (gun=1, jump=1)
- For non-baseline locations, tests combinations starting from req object values
- Tests gun × jump × floppy × red combinations to find minimum

**Root Cause Hypothesis**:
The 34 remaining locations are being found in the `baseline_accessible` set during caching, even though the sphere log shows they shouldn't be accessible until later. Possible reasons:

1. **Timing Issue**: Caching might happen at a slightly different point in initialization than sphere calculation
2. **Special Cases**: These locations might have special handling (like RESCUE items modifying requirements)
3. **Door Logic**: The door system might affect accessibility in ways not captured by simple testing
4. **Region State**: Some region connections might be evaluated differently during caching vs. actual play

**Insights from zilliandomizer Source**:
- `get_locations()` uses BFS through regions checking both location AND connection requirements
- Special case: locations with RESCUE items get gun requirement set to 0 (line 221-223 of randomizer.py)
- Door logic modifies `have.have_doors` dynamically during traversal
- Requirements are combinatorial: `have >= loc.req` uses complex __ge__ operator

**Next Steps for Future Work**:
1. Add debug logging during caching to see which locations are in baseline_accessible and why
2. Compare zilliandomizer state during caching vs. during sphere calculation
3. Check if RESCUE items are placed before or after caching
4. Investigate if door state differs between caching and sphere calculation
5. Consider caching at a different point in the initialization sequence
6. Research if zilliandomizer has a "dry run" mode that doesn't modify state

**Alternative Approaches**:
- Pre-generate accessibility table offline for all seeds and distribute it
- Accept 95% accuracy and document known limitations
- Add region-based heuristics (e.g., "locations in regions X, Y, Z always need gun=2")
- Contribute to zilliandomizer to add an API for querying minimum requirements

**Code Locations**:
- `worlds/zillion/__init__.py`: Lines 138-142 (cache declaration), 172-241 (caching method)
- `exporter/games/zillion.py`: Reads from cache and converts to JSON rules
- zilliandomizer source: `.venv/lib/python3.11/site-packages/zilliandomizer/randomizer.py`
