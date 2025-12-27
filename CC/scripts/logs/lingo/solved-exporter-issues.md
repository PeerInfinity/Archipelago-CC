# Solved Lingo Exporter Issues

*Last updated: 2025-12-27*

## Issue 1: Lingo-specific settings not being exported

**Date Fixed:** 2025-12-27

**Problem:**
The spoiler test failed at Sphere 0 because 183 regions were accessible from the start instead of the expected 36 regions. The `lingo_can_use_entrance` helper function was returning `true` for all doors because the required settings (`item_by_door`, `door_reqs`, etc.) were not present in the exported rules.json.

**Root Cause:**
The Lingo exporter (`exporter/games/lingo.py`) was overriding `get_settings_data()` to add Lingo-specific settings like:
- `item_by_door` - Which doors require which items
- `door_reqs` - Access requirements for doors
- `counting_panel_reqs` - Panel count requirements for LEVEL 2 location
- `mastery_reqs` - Access requirements for mastery achievements
- `PROGRESSIVE_ITEMS` and `PROGRESSIVE_DOORS_BY_ROOM` - Constants for progressive items

However, the main exporter (`exporter/exporter.py`) calls `get_world_data()` directly, not `get_settings_data()`. The base class's `get_settings_data()` is just a deprecated alias for `get_world_data()`, so the Lingo override was never called.

**Fix:**
Renamed `get_settings_data` to `get_world_data` in `exporter/games/lingo.py` (line 393) and updated the call to `super().get_world_data()`.

**Files Modified:**
- `exporter/games/lingo.py` - Renamed method from `get_settings_data` to `get_world_data`

**Verification:**
After the fix, the exported rules.json now contains:
- `item_by_door`: 1 room (Pilgrim Antechamber with Sun Painting)
- `door_reqs`: 95 rooms
- `counting_panel_reqs`: 141 keys
- `mastery_reqs`: 24 items
- `PROGRESSIVE_ITEMS` and `PROGRESSIVE_DOORS_BY_ROOM`

The spoiler test now passes with all 12 spheres matching the expected progression.
