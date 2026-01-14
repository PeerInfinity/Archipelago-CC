# Universal Tracker Modifications

This document describes the modifications made to the Universal Tracker compared to the original from [FarisTheAncient/Archipelago](https://github.com/FarisTheAncient/Archipelago) (tracker branch).

- **Original version:** v0.2.24.1
- **Modified version:** v0.2.23 (based on earlier version with extensive additions)
- **Location in this repository:** `worlds/tracker/`
- **Last compared:** 2026-01-14

## Summary of Changes

The modifications extend Universal Tracker with:
1. **Worldgen world integration** for rule explain support
2. **Direct AST rule explanation** from JSON rules files
3. **UT comparison testing infrastructure** for automated verification
4. **Debug logging and sphere log output** for test analysis

These changes integrate UT with the JSON Export system, allowing it to explain rules for any world that has exported rules, not just worlds with native Rule Builder support.

---

## File-by-File Changes

### `TrackerCore.py`

**Lines:** 513 → 1059 (~546 lines added)

This file received the most significant modifications, adding worldgen and AST explain integration.

#### New Instance Variables

```python
# Worldgen world support
self.worldgen_builder: Optional["JSONWorldBuilder"] = None
self.worldgen_world: Optional[Any] = None
self.worldgen_multiworld: Optional[MultiWorld] = None
self._tracking_from_worldgen: bool = False

# Direct AST explain support
self.seed_name: Optional[str] = None
self.generation_seed: Optional[int] = None
self.rules_json_data: Optional[dict] = None
self.rules_json_path: Optional[str] = None

# Testing options
self.seed_override: int | None = None
self.sphere_log_mode: bool = False
self.auto_collect_events: bool = True
self.filter_event_items: bool = True
self.auto_generate_worldgen: bool = False
```

#### New Methods

| Method | Purpose |
|--------|---------|
| `load_worldgen_world()` | Load a worldgen world from JSON for rule explain support |
| `initialize_tracking_from_worldgen()` | Initialize tracking using worldgen world state |
| `generate_and_load_worldgen_world()` | Generate and load worldgen world in one step |
| `get_worldgen_world()` | Get the loaded worldgen world instance |
| `get_worldgen_location()` | Get a location from the worldgen world by name |
| `explain_location_rule()` | Explain why a location is accessible/inaccessible |
| `_explain_from_rules_json()` | Direct AST explain without worldgen world |
| `set_seed_name()` | Set seed name for rules JSON discovery |
| `_validate_rules_json()` | Validate rules JSON matches current game |
| `auto_discover_rules_json()` | Auto-discover rules JSON from seed name |
| `load_rules_json()` | Load rules JSON for direct AST explain |
| `set_debug_logger()` | Set callback for debug logging |
| `_log_debug()` | Log debug events |

#### Key Feature: Rule Explain

The `explain_location_rule()` method provides human-readable explanations of why a location is or isn't accessible:

```python
def explain_location_rule(self, location_name: str, state: CollectionState) -> Optional[list]:
    """
    Explain the access rule for a location.

    Returns a list of explanation strings, or None if explain is not available.
    Uses worldgen world if available, otherwise falls back to direct AST explain.
    """
```

---

### `TrackerClient.py`

**Lines:** 1613 → 1970 (~357 lines added)

Adds testing infrastructure and debug logging capabilities.

#### New Methods

| Method | Purpose |
|--------|---------|
| `_handle_ut_test_sync_bounce()` | Handle test synchronization protocol for UT comparison testing |
| `_log_sphere_state()` | Log current sphere state to sphere log file |
| `_close_sphere_log()` | Close sphere log file |
| `_open_debug_log()` | Open debug log file for detailed event logging |
| `_log_debug_message()` | Log debug event with timestamp and data |
| `_log_debug_full_state()` | Log full tracker state for debugging |
| `_close_debug_log()` | Close debug log file |

#### UT Test Sync Protocol

The test sync bounce handler enables automated UT comparison testing:

```python
def _handle_ut_test_sync_bounce(self, args: dict):
    """
    Handle UT_TEST_SYNC bounce messages for comparison testing.

    Protocol:
    1. Test driver sends UT_TEST_SYNC with sphere items
    2. UT processes items and updates state
    3. UT responds with current accessible locations
    4. Test driver compares with expected sphere log
    """
```

---

### `fuzzer_hook.py`

**Lines:** 98 → 453 (~355 lines added)

Extended for comprehensive testing with explain stats collection.

#### New Features

- **Explain stats collection**: Collects statistics about which locations can be explained
- **Worldgen integration**: Auto-discovers and loads rules JSON for worldgen tracking
- **Run ID tracking**: Tracks run IDs for organizing explain stats output

#### New Variables

```python
EXPLAIN_STATS_DIR = "fuzz_output/explain_stats"
run_id: int = 0
explain_stats_collected: bool = False
```

---

### `__init__.py`

**Lines:** 191 → 190 (1 line removed)

Minor changes:
- Version number set to v0.2.23 (based on older version before glitches_state was added)
- Removed `glitches_state` field from `CurrentTrackerState` namedtuple

```python
# Original
class CurrentTrackerState(NamedTuple):
    ...
    glitches_state: Optional[CollectionState]

# Modified - glitches_state removed
class CurrentTrackerState(NamedTuple):
    ...
    state: Optional[CollectionState]  # Last field, no glitches_state
```

---

## Integration with JSON Export System

The key integration points are:

### 1. Auto-Discovery of Rules JSON

When a seed name is set (from server connection), UT can auto-discover the corresponding rules JSON:

```python
# In TrackerCore
self.seed_name = "14089154938208861744"  # From RoomInfo
self.auto_discover_rules_json()  # Finds frontend/presets/{game}/AP_{seed}/AP_{seed}_rules.json
```

### 2. Worldgen World Loading

For full rule explain support, a worldgen world can be loaded:

```python
tracker.load_worldgen_world("path/to/rules.json")
# Now explain_location_rule() uses Rule Builder's explain system
```

### 3. Direct AST Explain Fallback

Even without a worldgen world, rules can be explained directly from JSON:

```python
tracker.load_rules_json("path/to/rules.json")
# explain_location_rule() parses AST from JSON
```

---

## Testing Infrastructure

### UT Comparison Testing

The modifications enable automated testing that compares UT's sphere calculations against the original game's sphere log:

1. **Sphere log output**: UT can output its sphere calculations to a JSONL file
2. **Debug logging**: Detailed event logging for debugging mismatches
3. **Test sync protocol**: Bounce-based protocol for test driver communication

### Fuzzer Integration

The extended `fuzzer_hook.py` enables:
- Running UT against fuzzed generations
- Collecting explain coverage statistics
- Identifying worlds with explain gaps

---

## Usage Examples

### Loading worldgen for explain support

```python
from worlds.tracker import TrackerCore

tracker = TrackerCore.TrackerCore(logger, False, False)
tracker.load_worldgen_world("frontend/presets/tunic/AP_123/AP_123_rules.json")

# Now can explain rules
explanation = tracker.explain_location_rule("Fortress - East Shortcut", state)
```

### Auto-discovering rules JSON

```python
tracker.seed_name = "14089154938208861744"
if tracker.auto_discover_rules_json():
    # Rules JSON loaded, explain available
    pass
```

---

## Diff Statistics

| File | Original Lines | Modified Lines | Lines Added |
|------|---------------|----------------|-------------|
| `TrackerCore.py` | 513 | 1059 | ~546 |
| `TrackerClient.py` | 1613 | 1970 | ~357 |
| `fuzzer_hook.py` | 98 | 453 | ~355 |
| `__init__.py` | 191 | 190 | -1 |
| **Total** | 2415 | 3672 | **~1257** |

---

## Related Files

- **Original repository:** https://github.com/FarisTheAncient/Archipelago (tracker branch)
- **Original copy for comparison:** `scripts/test/fixtures/tracker_original/`
- **UT comparison testing guide:** `docs/json/developer/guides/ut-comparison-testing.md`
- **World generator:** `world_generator/`
