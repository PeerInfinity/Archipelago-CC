# Zillion Exporter Progress Summary

## Current Status (Seed 1)
- **Sphere 0**: 10 false negatives (locations should be accessible but aren't)
- **Improvement**: Reduced from 40 false positives to 10 false negatives
- **Root Cause**: Mismatch between zilliandomizer's `get_locations()` and Archipelago's sphere calculation

## Key Changes
1. Added caching of location accessibility requirements in `_cache_location_accessibility()`
2. Cache stores: gun, jump, floppy, red, hp, skill, and baseline flag
3. Exporter checks baseline flag to avoid marking non-baseline locations as always accessible
4. Non-baseline locations with all baseline req values now require Zillion item (conservative approach)

## Technical Details
- Zilliandomizer's `get_locations(Req(gun=1, jump=1))` returns 8 baseline locations
- Python sphere log shows 12 locations in Sphere 0
- The 10 missing locations (4 + 6 overlap) have baseline req values but aren't in `get_locations()` result
- This suggests region traversal logic differences between zilliandomizer and Archipelago

## Missing Locations in Sphere 0
- A-3 top left-center
- A-4 bottom far left, bottom right, mid center, top left  
- A-6 bottom far right, mid far right
- B-1 mid far left, mid right, top right-center

## Next Steps
1. Investigate why `get_locations()` doesn't return all Sphere 0 locations
2. Consider using Archipelago's CollectionState to determine baseline accessibility
3. Test with multiple seeds to ensure generalizability
4. Refine requirement detection for non-baseline locations
