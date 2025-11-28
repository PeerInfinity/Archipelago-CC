# SMZ3 Solved Exporter Issues

*Last updated: 2025-11-28*

## Issue 1: Non-advancement items not counted in spoiler tests

### Problem

SMZ3's Python Progression class uses boolean flags for items like `PowerBomb` and `TwoPowerBombs`. The `TwoPowerBombs` flag is set to True when you've collected at least 2 PowerBomb items, regardless of whether those items are marked as "advancement" (progression) items.

The frontend spoiler test, by default, only counts advancement items during testing. This meant that filler PowerBomb pickups (marked as `advancement: false`) were not being added to the inventory, causing the PowerBomb count to be wrong.

Example from seed 3:
- Python expected: 6 PowerBombs by sphere 7.4
- JavaScript counted: 1 PowerBomb (only the advancement one)

This caused `smz3_CanEnterAndLeaveGauntlet()` to incorrectly evaluate as false because `TwoPowerBombs` (count >= 2) was false.

### Solution

Added `count_non_advancement_items = true` to the SMZ3 exporter's settings export in `exporter/games/smz3.py`.

This setting tells the spoiler test to count ALL items (including non-advancement/filler items) when updating the inventory, matching the Python behavior.

### Files Changed

- `exporter/games/smz3.py`: Added `settings['count_non_advancement_items'] = True` in `get_settings_data()`

### Test Results

All seeds 1-10 now pass the full spoiler test.
