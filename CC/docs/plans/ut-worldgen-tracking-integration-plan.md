# Universal Tracker WorldGen Tracking Integration Plan

## Overview

This document outlines the plan to integrate worldgen worlds into Universal Tracker for **location tracking**, not just rule explanation. Currently, UT uses worldgen worlds only for the `/explain` command. This plan extends that to use worldgen worlds for the core tracking functionality (`updateTracker()`).

## Problem Statement

### Current Architecture

Universal Tracker has two separate world management systems:

| System | Purpose | Used For |
|--------|---------|----------|
| `self.multiworld` | Tracking (location reachability) | `updateTracker()`, `get_reachable_locations()` |
| `self.worldgen_multiworld` | Rule explanation only | `/explain` command fallback |

### How Tracking Works Today

1. **YAML-based flow** (most games):
   - User must have YAML file in `Players/` directory
   - UT runs `Generate.py` internally via `run_generator()`
   - `TMain()` calls world generation steps (`create_regions`, `set_rules`, etc.)
   - `updateTracker()` uses resulting `self.multiworld`

2. **YAML-less flow** (games with `ut_can_gen_without_yaml`):
   - Uses `re_gen_passthrough` mechanism
   - World must implement `interpret_slot_data()`
   - Still regenerates world internally

### The Gap

`JSONWorldBuilder.build_world()` (json_world_builder.py:92-152):
- Creates MultiWorld and instantiates world class
- **Does NOT call generation steps**
- World has no regions, locations, or rules set up
- Only suitable for class-level introspection, not tracking

Compare to `TrackerCore.TMain()` (TrackerCore.py:619-656):
```python
for step in gen_steps:
    AutoWorld.call_all(multiworld, step)  # create_regions, create_items, set_rules, etc.
```

### Benefits of WorldGen Tracking

1. **No YAML required** - Users don't need to install YAML files
2. **No `re_gen_passthrough` required** - World authors don't need special UT support
3. **Exact logic match** - WorldGen worlds have the same rules as the original seed
4. **Universal support** - Works for any game with exported rules.json

## Design Goals

1. **Use worldgen worlds for tracking** when rules.json is available
2. **Maintain backward compatibility** with existing YAML-based and `re_gen_passthrough` flows
3. **Minimize code duplication** between explain and tracking paths
4. **Clear fallback hierarchy** - worldgen → re_gen_passthrough → YAML-based

## Design Options

### Option A: Extend JSONWorldBuilder

Modify `JSONWorldBuilder.build_world()` to run generation steps, making it produce a fully-functional world.

#### Changes Required

**1. json_world_builder.py - Add generation steps**

```python
def build_world(self, worldgen_game_name: Optional[str] = None,
                run_generation: bool = True) -> "World":
    """
    Create a world instance from the corresponding _worldgen world.

    Args:
        worldgen_game_name: Name of the worldgen world to use
        run_generation: If True, run create_regions/set_rules/etc.
    """
    # ... existing instantiation code ...

    if run_generation:
        from worlds import AutoWorld
        gen_steps = [
            "generate_early",
            "create_regions",
            "create_items",
            "set_rules",
            "generate_basic",
        ]
        for step in gen_steps:
            if hasattr(AutoWorld.World, step):
                AutoWorld.call_single(self.multiworld, step, 1)

    return self.world
```

**2. TrackerCore.py - Use worldgen_multiworld for tracking**

```python
def updateTracker(self) -> CurrentTrackerState:
    # Use worldgen multiworld if available and properly initialized
    tracking_multiworld = self.worldgen_multiworld if self._use_worldgen_tracking else self.multiworld

    if self.player_id is None or tracking_multiworld is None:
        # ... error handling ...
```

**3. TrackerCore.py - Add initialization path**

```python
def initialize_from_worldgen(self, rules_json_path: str) -> bool:
    """Initialize tracking using a worldgen world from rules.json."""
    try:
        self.worldgen_builder = JSONWorldBuilder(rules_json_path)
        self.worldgen_builder.load()
        self.worldgen_world = self.worldgen_builder.build_world(run_generation=True)
        self.worldgen_multiworld = self.worldgen_builder.multiworld
        self._use_worldgen_tracking = True
        self.multiworld = self.worldgen_multiworld  # Alias for compatibility
        self.player_id = 1
        return True
    except Exception as e:
        self.logger.error(f"Failed to initialize from worldgen: {e}")
        return False
```

#### Pros
- Simple conceptually - one builder does everything
- Reuses existing JSONWorldBuilder infrastructure
- Single source of truth for worldgen world creation

#### Cons
- Changes JSONWorldBuilder's behavior (may break existing explain-only usage)
- Need to handle `run_generation=False` for backward compatibility
- Generation steps may have side effects not suitable for all contexts

---

### Option B: Separate Tracking Initialization Path

Create a dedicated method in TrackerCore for worldgen-based tracking, keeping JSONWorldBuilder lightweight.

#### Changes Required

**1. TrackerCore.py - New dedicated method**

```python
def initialize_tracking_from_rules_json(self, rules_json_path: str) -> bool:
    """
    Initialize full tracking using a worldgen world from rules.json.

    This creates a fully-functional multiworld with regions, locations,
    and rules - suitable for updateTracker().

    Args:
        rules_json_path: Path to the rules.json file

    Returns:
        True if initialization succeeded, False otherwise
    """
    from world_generator.json_world_builder import JSONWorldBuilder
    from worlds import AutoWorld
    from BaseClasses import CollectionState

    try:
        # Load JSON and determine worldgen name
        builder = JSONWorldBuilder(rules_json_path)
        builder.load()

        base_name = builder.data.metadata.game_name
        worldgen_name = f"{base_name} WorldGen"

        # Check if worldgen world exists
        if worldgen_name not in AutoWorld.AutoWorldRegister.world_types:
            self.logger.warning(f"WorldGen world '{worldgen_name}' not found")
            return False

        # Create multiworld (similar to TMain but for worldgen)
        multiworld = MultiWorld(1)
        multiworld.game[1] = worldgen_name
        multiworld.player_name = {1: self.slot_name or "Player"}
        multiworld.set_seed(seed=1)  # Deterministic
        multiworld.generation_is_fake = True

        # Set up options
        world_type = AutoWorld.AutoWorldRegister.world_types[worldgen_name]
        args = Namespace()
        for name, option in world_type.options_dataclass.type_hints.items():
            setattr(args, name, {1: option.from_any(option.default)})
        multiworld.set_options(args)

        # Run generation steps
        gen_steps = [
            "generate_early",
            "create_regions",
            "create_items",
            "set_rules",
            "generate_basic",
        ]
        for step in gen_steps:
            if hasattr(AutoWorld.World, step):
                AutoWorld.call_all(multiworld, step)

        # Set up state
        multiworld.state = CollectionState(multiworld)

        # Store for tracking
        self.multiworld = multiworld
        self.player_id = 1
        self.worldgen_multiworld = multiworld
        self.worldgen_world = multiworld.worlds[1]
        self._tracking_from_worldgen = True

        self.logger.info(f"Initialized tracking from worldgen: {worldgen_name}")
        return True

    except Exception as e:
        self.logger.error(f"Failed to initialize tracking from rules.json: {e}")
        self.logger.exception("Details:")
        return False
```

**2. TrackerCore.py - Integrate into initalize_tracker_core**

```python
def initalize_tracker_core(self, connected_cls: type[AutoWorld.World], raw_slot_data):
    # Try worldgen-based tracking first if rules.json is available
    if self.rules_json_path and self.initialize_tracking_from_rules_json(self.rules_json_path):
        self.logger.info("Using worldgen-based tracking")
        return

    # Fall back to existing logic...
    if getattr(connected_cls, "disable_ut", False):
        # ... existing code ...
```

**3. TrackerCore.py - Auto-discovery integration**

Modify `auto_discover_rules_json()` to set a flag for tracking initialization:

```python
def auto_discover_rules_json(self) -> bool:
    # ... existing discovery code ...

    if found_rules_json:
        self.rules_json_path = found_path
        # Don't auto-initialize tracking here - wait for initalize_tracker_core
        return True
    return False
```

#### Pros
- Clear separation of concerns
- JSONWorldBuilder stays lightweight for explain-only use
- Explicit control over when full generation runs
- Easier to debug and test independently

#### Cons
- Some code duplication with TMain()
- Two paths to maintain for world creation
- Need to ensure both paths stay in sync

---

### Option C: Hybrid - Shared Generation Helper

Extract the generation logic into a shared helper used by both TMain and worldgen tracking.

#### Changes Required

**1. TrackerCore.py - Extract generation helper**

```python
def _run_world_generation(self, multiworld: MultiWorld, player_id: int) -> None:
    """Run world generation steps on a multiworld."""
    from worlds import AutoWorld

    gen_steps = [
        "generate_early",
        "create_regions",
        "create_items",
        "set_rules",
        "generate_basic",
    ]

    for step in gen_steps:
        if hasattr(AutoWorld.World, step):
            AutoWorld.call_all(multiworld, step)
            if step == "set_rules":
                exclusion_rules(multiworld, player_id,
                    multiworld.worlds[player_id].options.exclude_locations.value)
            if step == "generate_basic":
                break
```

**2. Refactor TMain to use helper**

```python
def TMain(self, args, seed=None):
    multiworld = MultiWorld(args.multi)
    # ... setup code ...

    self._run_world_generation(multiworld, 1)
    return multiworld
```

**3. Add worldgen tracking method using same helper**

```python
def initialize_tracking_from_rules_json(self, rules_json_path: str) -> bool:
    # ... setup multiworld for worldgen ...

    self._run_world_generation(multiworld, 1)

    # ... store results ...
```

#### Pros
- No code duplication for generation steps
- Single place to update generation logic
- Clean separation of setup vs. execution

#### Cons
- Requires refactoring existing TMain
- More moving parts

---

## Recommended Approach: Option B with elements of C

**Rationale:**
1. Option B provides clearest separation and easiest debugging
2. Extract shared generation helper (from Option C) to avoid duplication
3. Keep JSONWorldBuilder lightweight - it's also used outside TrackerCore
4. Explicit initialization path makes the flow clear

## Implementation Plan

### Phase 1: Foundation

1. **Extract generation helper** from TMain into `_run_world_generation()`
2. **Refactor TMain** to use the helper (no behavior change)
3. **Add tests** to verify TMain still works

### Phase 2: WorldGen Tracking

1. **Add `initialize_tracking_from_rules_json()`** method
2. **Add `rules_json_path` attribute** to TrackerCore
3. **Add `_tracking_from_worldgen` flag** for debugging/logging
4. **Integrate into `initalize_tracker_core()`** as first-choice path

### Phase 3: Auto-Discovery Integration

1. **Modify `auto_discover_rules_json()`** to store path for tracking
2. **Add fallback logic** - try worldgen first, then existing paths
3. **Update logging** to indicate which tracking mode is active

### Phase 4: Testing & Validation

1. **Run fuzzer** with worldgen tracking enabled
2. **Compare sphere logs** between worldgen and original worlds
3. **Test edge cases** - missing worldgen, invalid rules.json, etc.

## Key Files to Modify

| File | Changes |
|------|---------|
| `worlds/tracker/TrackerCore.py` | Add `initialize_tracking_from_rules_json()`, refactor TMain, integration |
| `world_generator/json_world_builder.py` | Optional: add `run_generation` parameter |
| `worlds/tracker/TrackerClient.py` | Update connection flow if needed |

## Open Questions

1. **Canonical placements**: WorldGen worlds support `--canonical-seed1` for deterministic item placement. Should tracking use this?

2. **Options handling**: WorldGen worlds use default options. Should we extract actual options from slot_data?

3. **Precollected items**: How do we handle starting items in worldgen tracking?

4. **Events**: Do worldgen worlds properly handle event items/locations?

5. **Entrance randomization**: How does this interact with worldgen worlds?

## Success Criteria

1. UT can track locations using worldgen world when rules.json exists
2. No YAML file required for tracking
3. Sphere calculations match between worldgen and original world
4. Fuzzer tests pass with worldgen tracking
5. Backward compatibility maintained for games without rules.json

## Related Documents

- `worlds/tracker/docs/apworld-integration.md` - Current UT integration guide
- `worlds/tracker/docs/re-gen-passthrough.md` - Current slot_data mechanism
- `docs/json/developer/guides/world-generator.md` - WorldGen documentation
