# Remaining Exporter Issues for Zillion

## Issue 1: 34 locations still accessible in Sphere 0 when they shouldn't be

**Status**: Partially Fixed (reduced from 40+ to 34)

**Description**:
The exporter now uses zilliandomizer's `get_locations()` method to test accessibility with different item combinations. This successfully fixed many locations (C-3, D-2, D-5, D-6, C-5, E-6 locations now have correct requirements).

However, 34 locations are still incorrectly marked as accessible. These locations return `access_rule: None` because they are "never accessible" according to `get_locations()` tests, even with maximum items (gun=3, jump=3, floppy=126, red=1).

**Root Cause**:
The zilliandomizer's `get_locations()` method considers items that are ALREADY PLACED in locations during testing. During export (which happens in `generate_output`), items have already been placed. This causes the accessibility tests to fail for locations that contain important progression items, making them appear "never accessible" when in reality they just can't access their own item.

**Affected Locations** (34 total):
E-4 mid center, E-5 top far right, F-8 bottom center, G-4 mid center, G-5 top far right, G-6 bottom far left, G-7 mid center, H-6 bottom far left, H-7 top far left, H-8 top right-center, I-5 mid far right, I-6 mid right-center, E-2 bottom left-center, J-2 bottom right-center, J-3 mid far left, J-4 bottom left-center, J-5 top left, J-5 mid left-center, K-2 bottom right, K-2 mid far left, K-2 mid left, L-2 top left-center, L-2 mid far right, L-7 mid left, M-3 bottom right-center, M-5 top left-center, M-6 bottom right-center, N-2 top center, N-2 bottom right, N-2 top left, N-2 bottom left, N-4 mid left, N-7 bottom far left, O-3 mid right, O-5 mid far left

**Technical Details**:
- The exporter tests accessibility by calling `zz_randomizer.get_locations(Req(...))` with different item combinations
- During testing, the randomizer has items already placed (this happens in `finalize_item_locations()` before `generate_output()`)
- For locations containing progression items, `get_locations()` returns them as inaccessible because the item inside hasn't been "collected" yet
- Example: "B-1 mid far left" has req.gun=1 (baseline) but shows as "never accessible" because it contains an important item

**Potential Solutions**:
1. **Save and restore item placements**: Temporarily clear items before testing, then restore them
2. **Export earlier**: Run the exporter before items are placed (would require architecture changes)
3. **Use req object as fallback**: For "never accessible" locations, trust the req object values directly
4. **Cache accessibility during region creation**: Store accessibility information before items are placed

**Next Steps**:
- Implement solution #3 as a quick fix (use req object for never-accessible locations)
- Consider implementing solution #1 for complete accuracy
