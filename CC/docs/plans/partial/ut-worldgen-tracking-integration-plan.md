# Universal Tracker WorldGen Tracking Integration Plan

## Status: Implemented

This document outlines the plan to integrate worldgen worlds into Universal Tracker for **location tracking**, not just rule explanation. The implementation is complete for simple games; complex games like ALTTP may have additional issues.

## Overview

Universal Tracker can now use dynamically-generated worldgen worlds for tracking. When a rules.json file is available, UT:
1. Runs the world generator to create fresh Python files from that rules.json
2. Reloads the module to pick up the new code
3. Uses the resulting worldgen world for tracking

This eliminates the need for YAML files or `re_gen_passthrough` support.

## Implementation Summary

### Chosen Approach: Option A (Extended)

We chose **Option A** (extend JSONWorldBuilder) with an important addition: **dynamic regeneration**. Instead of using pre-existing worldgen world classes, we regenerate the Python files from each seed's rules.json to ensure exact rule matching.

### Key Components

**1. JSONWorldBuilder.build_world()** (`world_generator/json_world_builder.py`)
- Now runs full generation steps: `generate_early`, `create_regions`, `create_items`, `set_rules`, `generate_basic`, `pre_fill`
- Sets up `CollectionState` BEFORE generation (some worlds access it during generation)
- Loads options from JSON data when available (falls back to defaults)
- Copies world attributes from JSON via `_copy_world_attributes_from_json()` for seed-specific values
- Sets `generation_is_fake = True` so worlds know they're in tracking context
- Produces a fully-functional world suitable for tracking

**2. TrackerCore.generate_and_load_worldgen_world()** (`worlds/tracker/TrackerCore.py`)
- Regenerates Python files from rules.json using WorldGenerator
- Uses seed-specific directories (e.g., `adventure_worldgen_12345`) for parallel-safe operation
- Unregisters existing worldgen class and reloads the module
- Ensures the worldgen world matches the specific seed being tracked

**3. TrackerCore.initialize_tracking_from_worldgen()** (`worlds/tracker/TrackerCore.py`)
- Sets `self.multiworld = self.worldgen_multiworld`
- Sets `self.player_id = 1`
- Sets `self._tracking_from_worldgen = True` for debugging

**4. TrackerCore.initalize_tracker_core()** (`worlds/tracker/TrackerCore.py`)
- Tries worldgen-based tracking first when `rules_json_path` is available
- Falls back to existing YAML-based or `re_gen_passthrough` flows

### Flow Diagram

```
Seed Generation
     │
     ▼
Exporter creates rules.json
     │
     ▼
Tracker connects to server
     │
     ▼
auto_discover_rules_json() finds rules.json
     │
     ▼
generate_and_load_worldgen_world()
     │
     ├─► Run world_generator on rules.json
     │
     ├─► Reload Python module
     │
     └─► build_world() with generation steps
            │
            ▼
     initialize_tracking_from_worldgen()
            │
            ▼
     updateTracker() uses worldgen multiworld
```

## Implementation Details

### Options Loading from JSON

Options are now loaded from the JSON rules file when building the world:

```python
json_options = {}
if self._json_data:
    world_data = self._json_data.get('world', {}).get('1', {})
    json_options = world_data.get('options', {})

for name, option in world_type.options_dataclass.type_hints.items():
    if name in json_options:
        setattr(args, name, {1: option.from_any(json_options[name])})
    else:
        setattr(args, name, {1: option.from_any(option.default)})
```

### World Attribute Copying

After world generation, runtime world attributes (like `auto_scroll_levels`, `sprite_data`) are copied from the JSON onto the world instance via `_copy_world_attributes_from_json()`. This ensures seed-specific computed values match the original seed.

### Critical Timing: CollectionState

The `CollectionState` must be created BEFORE running generation steps:

```python
# CORRECT - state before generation
self.multiworld.set_options(args)
self.multiworld.state = CollectionState(self.multiworld)  # Before!
for step in gen_steps:
    AutoWorld.call_all(self.multiworld, step)

# WRONG - causes "'MultiWorld' object has no attribute 'state'"
self.multiworld.set_options(args)
for step in gen_steps:
    AutoWorld.call_all(self.multiworld, step)
self.multiworld.state = CollectionState(self.multiworld)  # Too late!
```

### Module Reload for Fresh Rules

When regenerating a worldgen world, we must:
1. Unregister the old world class from `AutoWorldRegister.world_types`
2. Reload the module with `importlib.reload()`
3. The new class will auto-register on import

```python
if full_module_name in sys.modules:
    if worldgen_game_name in AutoWorld.AutoWorldRegister.world_types:
        del AutoWorld.AutoWorldRegister.world_types[worldgen_game_name]
    importlib.reload(sys.modules[full_module_name])
else:
    importlib.import_module(full_module_name)
```

### List-Type Location Addresses

Some games (like ALTTP) have list-type location addresses that can't be hashed. The fuzzer hook filters these out:

```python
remaining_locations = [location.address for location in mw.worlds[1].get_locations()
                       if location.address is not None and not isinstance(location.address, list)]
```

## Files Modified

| File | Changes |
|------|---------|
| `world_generator/json_world_builder.py` | Run generation steps in `build_world()`, CollectionState timing fix, options loading from JSON, world attribute copying via `_copy_world_attributes_from_json()` |
| `worlds/tracker/TrackerCore.py` | Add `initialize_tracking_from_worldgen()`, modify `generate_and_load_worldgen_world()` to always regenerate with seed-specific directories, integrate into `initalize_tracker_core()` |
| `worlds/tracker/fuzzer_hook.py` | Set `seed_name`, call `auto_discover_rules_json()`, filter list addresses, add `--fractional-spheres` mode, add explain stats collection, add `MultiworldHook` for multiworld testing |
| `world_generator/templates.py` | Fix f-string escaping bug in `_load_canonical_options` template |
| `exporter/exporter.py` | Add `cleanup_multiworld` parameter (default False) |
| `host.yaml` | Enable `save_rules_json: true` for testing |

## Testing Results

### Passing: Simple Games
- **Adventure**: 5/5 fuzzer runs pass with worldgen tracking

### Failing: Complex Games
- **ALTTP**: Logic mismatches between worldgen and original world
  - Likely due to complex option interactions
  - Some locations/regions may be handled differently
  - Needs further investigation

## Known Limitations

1. **Complex Games**: Games like ALTTP with many option-dependent rules or complex world attributes may not track correctly. Some games have runtime-computed values that aren't fully captured in the JSON export.

2. **Performance**: Regenerating Python files and reloading modules adds overhead compared to using pre-existing worldgen classes.

3. **List Addresses**: Games with list-type location addresses are partially supported (those locations are skipped in fuzzer validation).

4. **World Attributes**: While options are now loaded from JSON, some games have runtime-computed world attributes (e.g., `auto_scroll_levels`, `sprite_data`) that are set during generation. These are copied from JSON when available, but complex nested structures may not transfer perfectly.

## Open Questions (Remaining)

1. **Precollected items**: How should starting items be handled in worldgen tracking? (Currently cleared from multiworld.precollected_items to avoid double-counting since they're added via set_items_received().)

2. **Entrance randomization**: How does ER interact with worldgen worlds?

3. **Complex world attributes**: Some games compute world attributes during generation (e.g., shop inventories). How should these be handled when they can't be serialized to JSON?

## Success Criteria

| Criterion | Status |
|-----------|--------|
| UT can track using worldgen world | ✅ Working |
| No YAML file required | ✅ Working |
| Sphere calculations match | ⚠️ Simple games only |
| Fuzzer tests pass | ⚠️ Simple games only |
| Backward compatibility | ✅ Maintained |

## Future Improvements

1. **Caching**: Cache regenerated worldgen worlds by rules.json hash to avoid redundant regeneration.

2. **Complex Game Support**: Investigate and fix ALTTP and other complex games.

3. **Error Handling**: Better error messages when worldgen tracking fails, with specific guidance on fallback.

4. **World Attribute Serialization**: Improve JSON export to capture more runtime-computed world attributes for complex games.

## Related Documents

- `worlds/tracker/docs/apworld-integration.md` - Current UT integration guide
- `worlds/tracker/docs/re-gen-passthrough.md` - Current slot_data mechanism
- `docs/json/developer/guides/world-generator.md` - WorldGen documentation
