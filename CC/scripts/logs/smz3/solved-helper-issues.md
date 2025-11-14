# Solved Helper Issues

## Issue 1: smz3_can_enter_region was a stub - replaced with actual region entry logic ✓

**Description**: The generic `smz3_can_enter_region` helper was returning true for all regions, causing 32 regions to be incorrectly accessible.

**Solution**: Instead of using a generic helper, modified the exporter to extract each region's specific `CanEnter()` method logic and export it as the entrance rule. Added `_handle_entrance_rule()` method to SMZ3 exporter that:
1. Extracts the region object from entrance rule function defaults
2. Analyzes the region's CanEnter method
3. Exports the actual logic with items.AttributeName → item_check conversions

**Files Modified**:
- `exporter/games/smz3.py` - Added `_handle_entrance_rule()` method

**Result**: All 40 Menu exits now have proper entrance logic instead of generic helper. Test progressed from failing at Sphere 0 to Sphere 0.3.

**Example**: Castle Tower entrance now correctly requires:
- `smz3_CanKillManyEnemies()` AND (`Cape` OR `MasterSword`)

