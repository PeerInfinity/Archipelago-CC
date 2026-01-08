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
- Now runs full generation steps: `generate_early`, `create_regions`, `create_items`, `set_rules`, `generate_basic`
- Sets up `CollectionState` BEFORE generation (some worlds access it during generation)
- Produces a fully-functional world suitable for tracking

**2. TrackerCore.generate_and_load_worldgen_world()** (`worlds/tracker/TrackerCore.py`)
- Regenerates Python files from rules.json using WorldGenerator
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
| `world_generator/json_world_builder.py` | Run generation steps in `build_world()`, CollectionState timing fix |
| `worlds/tracker/TrackerCore.py` | Add `initialize_tracking_from_worldgen()`, modify `generate_and_load_worldgen_world()` to always regenerate, integrate into `initalize_tracker_core()` |
| `worlds/tracker/fuzzer_hook.py` | Set `seed_name`, call `auto_discover_rules_json()`, filter list addresses |
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

1. **Options**: Worldgen worlds use default options, not the original seed's options. This can cause logic mismatches for games with option-dependent rules.

2. **Complex Games**: Games like ALTTP with many option-dependent rules may not track correctly until options handling is improved.

3. **Performance**: Regenerating Python files and reloading modules adds overhead compared to using pre-existing worldgen classes.

4. **List Addresses**: Games with list-type location addresses are partially supported (those locations are skipped in fuzzer validation).

## Open Questions (Remaining)

1. **Options from slot_data**: Should we extract actual options from slot_data and apply them to the worldgen world? This would improve accuracy for option-dependent rules.

2. **Precollected items**: How should starting items be handled in worldgen tracking?

3. **Entrance randomization**: How does ER interact with worldgen worlds?

## Success Criteria

| Criterion | Status |
|-----------|--------|
| UT can track using worldgen world | ✅ Working |
| No YAML file required | ✅ Working |
| Sphere calculations match | ⚠️ Simple games only |
| Fuzzer tests pass | ⚠️ Simple games only |
| Backward compatibility | ✅ Maintained |

## Future Improvements

1. **Options Extraction**: Parse options from slot_data and apply to worldgen world for better accuracy.

2. **Caching**: Cache regenerated worldgen worlds by rules.json hash to avoid redundant regeneration.

3. **Complex Game Support**: Investigate and fix ALTTP and other complex games.

4. **Error Handling**: Better error messages when worldgen tracking fails, with specific guidance on fallback.

## Related Documents

- `worlds/tracker/docs/apworld-integration.md` - Current UT integration guide
- `worlds/tracker/docs/re-gen-passthrough.md` - Current slot_data mechanism
- `docs/json/developer/guides/world-generator.md` - WorldGen documentation
