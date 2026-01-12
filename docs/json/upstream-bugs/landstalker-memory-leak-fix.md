# Fixing the Landstalker Memory Leak

> **Note:** This was a **fork-specific bug**, not an upstream bug. Upstream has always properly called `stage_modify_multidata` via `call_stage` (since d743d10b, Oct 2023).

## Overview

The fork's exporter was calling `fill_slot_data()` after `stage_modify_multidata` had already cleared the cache, repopulating it and causing the memory leak.

## The Fix

The fix respects Archipelago's intended lifecycle: **compute → use → cleanup**.

### 1. Move exporter before `modify_multidata` (Main.py)

The exporter call was moved inside `write_multidata`, before the `modify_multidata` call:

```python
# Export rules data BEFORE modify_multidata clears world caches
# (some worlds like Landstalker use class variables in fill_slot_data
# that are cleared by stage_modify_multidata)
settings = get_settings()
if settings.general_options.save_rules_json:
    from exporter import clear_rule_cache
    from exporter.games import clear_handler_cache
    export_game_rules(...)
    clear_rule_cache()
    clear_handler_cache()

# TODO: change to `"version": version_tuple` after getting better serialization
AutoWorld.call_all(multiworld, "modify_multidata", multidata)
```

### 2. Use cached slot data (exporter/games/base/world_data.py)

Main.py now caches `slot_data` on the world object after calling `fill_slot_data`:

```python
slot_data[slot] = multiworld.worlds[slot].fill_slot_data()
# Cache slot_data on the world for the exporter to use
# This avoids calling fill_slot_data twice
multiworld.worlds[slot]._cached_slot_data = slot_data[slot]
```

The exporter uses this cached data instead of calling `fill_slot_data` again:

```python
# Export slot_data if available (cached by Main.py before exporter is called)
# This avoids calling fill_slot_data twice, which can cause memory leaks
# for worlds that populate class variables (like Landstalker's cached_spheres)
if hasattr(world, '_cached_slot_data') and world._cached_slot_data:
    world_data['slot_data'] = world._cached_slot_data
```

### 3. Clear handler cache after `create_playthrough` (Main.py)

The sphere logger (`create_playthrough_with_logging`) creates export handlers that hold references to world objects. These must be cleared after playthrough calculation:

```python
if args.spoiler > 1:
    logger.info('Calculating playthrough.')
    multiworld.spoiler.create_playthrough(create_paths=args.spoiler > 2)
    # Clear handler cache - create_playthrough_with_logging may have created
    # handlers that hold world references
    try:
        from exporter.games import clear_handler_cache
        clear_handler_cache()
    except ImportError:
        pass
```

## Why This Works

The new call order:
1. `fill_slot_data()` called → populates `cached_spheres`
2. `export_game_rules()` called → uses cached `_cached_slot_data`
3. `modify_multidata` called → `stage_modify_multidata` clears `cached_spheres`
4. `create_playthrough` called → sphere logger creates handlers
5. Handler cache cleared → releases world references
6. No lingering references → garbage collection succeeds

## Alternative: Instance Variable Approach

An alternative fix would convert `cached_spheres` to an instance variable in upstream Landstalker. This would be a more robust solution but requires upstream changes. See the detailed steps below if this approach is ever needed.

### Changes to `worlds/landstalker/__init__.py`

1. Change class variable to instance variable declaration
2. Initialize in `__init__`
3. Update `fill_slot_data` to use `self.cached_spheres`
4. Update `adjust_shop_prices` to use `self.cached_spheres`
5. Update `stage_modify_multidata` to iterate over world instances

## Verification

After applying the fix, run the generation command:

```bash
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/Landstalker - The Treasures of King Nole.yaml" --multi 1
```

The command should complete without the `AssertionError: MultiWorld object was not de-allocated` error.

Expected output ends with:
```
Done. Enjoy. Total Time: ...
```

(No assertion error means the fix is working.)
