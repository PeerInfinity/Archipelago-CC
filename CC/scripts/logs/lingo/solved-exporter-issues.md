# Solved Exporter Issues for Lingo

## Issue 1: world.player_logic references not replaced with settings
**Date solved**: 2025-11-16
**Problem**: Entrance rules contained references to `world.player_logic.item_by_door` and `world.player_logic.door_reqs` which are runtime Python objects that don't exist in JavaScript.
**Solution**: Added `_replace_world_references()` method to exporter that recursively replaces:
- `world.player_logic.X` with `settings.X`
- Bare `PROGRESSIVE_ITEMS` with `settings.PROGRESSIVE_ITEMS`
- Bare `PROGRESSIVE_DOORS_BY_ROOM` with `settings.PROGRESSIVE_DOORS_BY_ROOM`
**File**: exporter/games/lingo.py:238-293

## Issue 2: "None is None" conditionals not simplified
**Date solved**: 2025-11-16
**Problem**: After variable replacement, entrance rules had patterns like `if None is None: return True` which weren't being simplified, leaving complex nested conditionals.
**Solution**: Enhanced `_simplify_entrance_rule()` to detect both `door is None` and `None is None` patterns and simplify them to just `True` when door_name is None.
**File**: exporter/games/lingo.py:310-353

