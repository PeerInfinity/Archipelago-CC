# Solved Exporter Issues for Zillion

## Issue 1: Initial implementation incorrectly used simple req object reading

**Status**: Solved

**Description**:
The original exporter implementation only read the `zz_loc.req` object fields (gun, jump, floppy, red) and converted them to access rules. When a location had no requirements beyond baseline (gun=1, jump=1), it was marked as `constant: true`, making it accessible from the start.

This approach failed to capture the complex internal logic of the zilliandomizer library, which considers:
- Region connectivity and traversal requirements
- Obstacles and enemies that must be overcome
- The overall game state and progression

**Solution**:
Implemented a new approach that actually calls the zilliandomizer's `get_locations()` method with different item combinations to determine what's really needed:
1. Test if location is accessible with baseline (gun=1, jump=1)
2. If not, test with progressively stronger combinations to find the minimum requirements
3. Test for gun, jump, floppy, and red requirements separately
4. Build the access rule from the detected requirements

**Impact**:
- Fixed over 6+ locations that previously had incorrect access rules
- Locations like "C-3 mid far right" now correctly require a Zillion item instead of being accessible from start
- Reduced test failures from 40+ locations to 34 locations

**Code Location**:
`exporter/games/zillion.py` - `get_custom_location_access_rule()` method

**Remaining Work**:
- 34 locations still need fixes (see remaining-exporter-issues.md)
- These require addressing the "items already placed" issue during export
