# Universal Tracker Modifications

This document describes the modifications made to the Universal Tracker compared to the original from [FarisTheAncient/Archipelago](https://github.com/FarisTheAncient/Archipelago) (tracker branch).

- **Original version:** v0.2.32
- **Modified version:** v0.2.32-modified
- **Location in this repository:** `worlds/tracker/`
- **Original copy for comparison:** `scripts/test/fixtures/tracker_original/` (dated snapshots: `tracker_original_v0.2.26/`, `_v0.2.27/`, `_v0.2.32/`)
- **Last compared:** 2026-06-26

> **Overlay re-base (2026-06-26).** UT was re-based onto clean upstream v0.2.32 in
> the spirit of the rule_builder overlay re-base. `TrackerCoreBase.py` is now
> **byte-pristine upstream v0.2.32** except for the class rename and a single,
> clearly-marked 3-line `seed_override` hook in `run_generator`. All fork behaviour
> lives in the overlay mixins (`pickle_mixin`, `worldgen_mixin`, `tracker_extensions`)
> and the extended `TrackerCore.py`. The extended `updateTracker` was rewritten to
> mirror upstream v0.2.32's new `TrackerLogLine`/`TrackerLogLineGroup` logging+sorting
> system (so it is now upstream's method plus a few `[fork]` hooks, not a diverged
> copy). Future UT merges should be near drop-in for `TrackerCoreBase.py`.

## Summary of Changes

The modifications extend Universal Tracker with:
1. **Pickle-based multiworld loading** for fast tracking without regeneration
2. **Worldgen world integration** for rule explain support
3. **Direct AST rule explanation** from JSON rules files
4. **UT comparison testing infrastructure** for automated verification
5. **Debug logging and sphere log output** for test analysis
6. **Multiworld fuzz testing** via `MultiworldHook` class
7. **ALttP entrance shuffle seed handling** for deterministic regeneration
8. **Fractional sphere logic** option for finer-grained sphere comparison

These changes integrate UT with the JSON Export system, allowing it to explain rules for any world that has exported rules, not just worlds with native Rule Builder support. The pickle mode provides the fastest tracking by loading a serialized multiworld directly.

### Reconciled with upstream v0.2.32

The fixes that were previously backported from v0.2.26 (the `glitches_state` field on
`CurrentTrackerState`, the "Nothing items" `location.item is not None` guard, and the
`glitches_state = state.copy()` ordering) are all **native in upstream v0.2.32**, so
they are no longer fork-specific — the fork's `__init__.py` and the re-based
`updateTracker` now match upstream on `CurrentTrackerState` and glitches handling.

v0.2.32 also introduced (now inherited from the pristine base, not fork code):
1. **`TrackerLogLine` / `TrackerLogLineGroup`** - data/rendering separation for the
   tracker tab, with configurable per-group `sorting_priorities` and `sorting_method`
2. **New `TrackerSettings`** - `save_entered_commands`, `sorting_priorities`, `sorting_method`
3. **Per-seed persistence** in `TrackerClient` - `load_seed_data`/`persist_seed_data`
   keyed on `seed:team:slot` (gated on the `save_entered_commands` setting)

---

## Architecture

The modified Universal Tracker uses a **mixin-based architecture** to separate our extensions from the upstream code, making it easier to merge upstream updates.

```
worlds/tracker/
├── __init__.py              # Exports (matches upstream)
├── TrackerCoreBase.py       # Original UT TrackerCore (close to upstream v0.2.26)
├── TrackerCore.py           # Extended TrackerCore (combines base + mixins)
├── pickle_mixin.py          # Pickle-based multiworld loading
├── worldgen_mixin.py        # Worldgen and AST explain methods
├── tracker_extensions.py    # Testing mode extensions
├── TrackerClient.py         # Client code (minor modifications)
└── fuzzer_hook.py           # Fuzzer hook for UT comparison testing
```

### Class Hierarchy

```python
class TrackerCore(PickleMixin, WorldgenMixin, TrackerTestingMixin, TrackerCoreBase):
    """Extended TrackerCore with pickle, worldgen, and testing support."""
```

### Tracking Mode Priority

TrackerCore supports four tracking modes, tried in order. See the [UT Tracking Modes Reference](../reference/ut-tracking-modes.md) for full details on each mode and its limitations.

**Legacy order (no config file):**
1. **Pickle** - Fastest, loads serialized multiworld with exact lambdas
2. **Worldgen** - Generates world from JSON rules
3. **Original Seeded** - Original UT YAML-based regeneration with the resolved seed number injected for determinism (reverse lookup covers seeds 1–100 only)
4. **Original (YAML)** - Original upstream UT behavior with a random internal seed

When `exporter/tracking-mode-config.json` is present, the order is driven by its `fallback_order` key and per-game `game_results`.

### Benefits

1. **Easy upstream merging**: Update `TrackerCoreBase.py` directly from upstream
2. **Clear separation**: Extensions are in separate mixin files
3. **Testability**: Can test base vs. extended separately
4. **Documentation**: Extensions are obviously separate from upstream code

---

## File-by-File Changes

### `TrackerCoreBase.py` (formerly TrackerCore.py)

**Lines:** 632 (pristine upstream v0.2.32 is 626)

This file is **byte-pristine upstream v0.2.32 TrackerCore** with exactly two edits:
- Class renamed `TrackerCore` → `TrackerCoreBase` for inheritance (the overlay seam)
- A single 3-line `[fork hook]` in `run_generator` that injects `self.seed_override`
  into `args.seed` for deterministic generation (used by `original_seeded` mode + fuzz)

Nothing else is fork-specific here — refresh by dropping in the new upstream file and
re-applying those two edits.

### `TrackerCore.py` (Extended Version)

**Lines:** ~536

This file extends TrackerCoreBase with our modifications via mixins. Its `updateTracker`
override mirrors upstream v0.2.32's `TrackerLogLine` logging structure (clear_page →
add_log_line → get_readable_locations/sort_log_lines/log_all_to_tab, `set_page(TrackerLogLine)`)
with `[fork]` hooks for: lenient `sphere_log_mode` invalid-item handling, the
`_filter_invalid_items`/`_should_include_location`/`_should_include_item_in_count`/
`_should_sweep_for_advancements` gates, and server-trusted item classification.

### `worldgen_mixin.py`

**Lines:** ~400

Contains worldgen world integration and AST explain support.

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

### `pickle_mixin.py`

**Lines:** ~286 (new file)

Contains pickle-based multiworld loading for fast tracking without regeneration.

#### New Instance Variables

```python
# Pickle mode support
self.pickle_multiworld: Optional[MultiWorld] = None
self.pickle_path: Optional[str] = None
self.pickle_metadata: Optional[dict] = None
self._tracking_from_pickle: bool = False
```

#### New Methods

| Method | Purpose |
|--------|---------|
| `_init_pickle_mixin()` | Initialize pickle mixin attributes |
| `_disconnect_pickle_mixin()` | Clear pickle mixin state on disconnect |
| `load_multiworld_from_pickle()` | Load multiworld from gzip-compressed dill pickle file |
| `initialize_tracking_from_pickle()` | Initialize tracking using the pickled multiworld |
| `auto_discover_pickle()` | Auto-discover pickle file based on game/seed name |

#### Key Feature: Fast Tracking

Pickle mode loads a pre-generated multiworld directly, preserving exact lambdas and closures:

```python
def load_multiworld_from_pickle(self, pickle_path: str) -> bool:
    """
    Load a multiworld from a gzip-compressed dill pickle file.

    Returns True if multiworld was loaded successfully.
    """
```

Benefits over worldgen mode:
- **Faster**: No world generation step needed
- **Exact rules**: Preserves original lambdas without AST conversion
- **Simpler**: No Rule Builder evaluation required

---

### `TrackerClient.py`

Adds testing infrastructure and debug logging capabilities. **Lines:** ~2086 (upstream
v0.2.32 is 1779). Reconciled via a 3-way merge (v0.2.27 fixture ancestor); picks up
upstream's per-seed persistence (`load_seed_data`/`persist_seed_data`), `get_help_text`,
`waiting_on_entrances`, the `update_defered_entrances(list[str])` signature, and the
glitches-state explain/path fallbacks. `explain()`/`get_logical_path()` use upstream's
more capable versions plus the fork's worldgen-explain fallback; the fork's
`sphere_log_mode` watcher tolerance and test-sync/debug-logging are preserved.

#### New Methods

| Method | Purpose |
|--------|---------|
| `_handle_ut_test_sync_bounce()` | Handle test synchronization protocol for UT comparison testing |
| `_send_ut_ready_bounce()` | Send UT ready signal via bounce protocol |
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

**Lines:** ~707 (upstream v0.2.32 is 105). Re-based via 3-way merge; the only net
upstream additions to `Hook.after_generate` are the default `GenOutcome.OptionError`
status and the `slot_data = json.loads(json.dumps(slot_data))` type round-trip.

Extended for comprehensive testing with explain stats collection, ALttP entrance shuffle handling, fractional sphere logic, and multiworld support.

#### New Features

- **Explain stats collection**: Collects statistics about which locations can be explained
- **Worldgen integration**: Auto-discovers and loads rules JSON for worldgen tracking
- **Run ID tracking**: Tracks run IDs for organizing explain stats output
- **ALttP entrance shuffle seed handling**: Pre-generates and fixes entrance shuffle seeds for deterministic regeneration
- **Fractional sphere logic**: Optional finer-grained sphere comparison within integer spheres
- **Multiworld testing**: `MultiworldHook` class for testing each player independently

#### New Variables (Hook class)

```python
EXPLAIN_STATS_DIR = "fuzz_output/explain_stats"
run_id: int = 0
explain_stats_collected: bool = False
use_fractional_spheres: bool = False  # Toggle for fractional sphere logic
```

#### New Methods (Hook class)

| Method | Purpose |
|--------|---------|
| `_collect_explain_stats()` | Collect explain support statistics for locations and entrances |
| `_write_explain_stats()` | Write explain stats to JSON file |
| `_pregenerate_alttp_entrance_shuffle_seed()` | Pre-generate numeric entrance_shuffle_seed before generation |
| `_fix_alttp_entrance_shuffle_seed()` | Rewrite ALttP YAML with actual er_seed after generation |
| `reclassify_outcome()` | Reclassify test outcomes (e.g., treat fill errors as OptionError) |

#### MultiworldHook Class

A new class for multiworld UT fuzz testing that tests each player in the multiworld independently:

```python
class MultiworldHook(BaseHook):
    player_files_path: str
    status: Optional[int] = None
    failed_players: Dict[int, str]  # player_id -> failure reason
    player_results: Dict[int, bool]  # player_id -> passed
```

| Method | Purpose |
|--------|---------|
| `before_generate()` | Initialize state before generation |
| `_test_player()` | Test a single player in the multiworld |
| `after_generate()` | Test all players after generation completes |
| `reclassify_outcome()` | Reclassify test outcomes |
| `get_failed_players()` | Return dict of failed player IDs to failure reasons |
| `get_player_results()` | Return dict of all player IDs to pass/fail status |

---

### `__init__.py`

**Lines:** ~252 (upstream v0.2.32 is 222)

Changes vs upstream v0.2.32:
- `UT_VERSION = "v0.2.32-modified"`
- Fork-only blocks preserved: `WebWorld`/`TrackerWorldWeb` web-disable, the
  `EnabledBool` setting + `enabled` field, and the `_is_enabled()` settings-cache fix
  (see below). The new upstream settings (`SaveEnteredCommands`, `SortingPriorties`,
  `SortingMethod` + their fields) were added.
- `CurrentTrackerState` now **matches upstream** (it carries `glitches_state` again —
  the earlier fork removal is reconciled, since the re-based `updateTracker` returns it).

#### `_is_enabled()` — settings cache poison fix (2026-05-09)

The launcher Component is registered conditionally on a host.yaml flag:

```python
if _is_enabled():
    components.append(Component("Universal Tracker", ...))
```

Previously, `_is_enabled()` called `get_settings().universal_tracker` to read the
flag. That triggers `Settings.__getattribute__`, which calls `settings._update_cache()`
to populate the world-settings name cache. Because `_is_enabled()` runs at
*module-load time* during `worlds/__init__.py`'s alphabetical world load,
`_update_cache()` iterates an `AutoWorldRegister` that contains only the worlds
loaded so far (alphabetically through `tracker`). The function then sets
`_world_settings_name_cache_updated = True` in its `finally` block — permanently
freezing the cache against an incomplete registry.

The downstream effect: every world loaded after `tracker` (`tunic`, `ut_pickle`,
`wargroove`, `yoshisisland`, `yugioh06`, `zillion`) was missing from the cache.
When `World.settings` was later accessed for any of them, `Settings.__getattribute__`
fell through and returned the raw `dict` from host.yaml instead of upcasting to the
world's `Group` subclass. `test/general/test_settings.py::TestSettings::test_settings_can_update`
SUBFAILed on `'UT Pickle Mode'` because `TrackerWorld.settings` was a `dict`,
not a `TrackerSettings(Group)`.

The fix reads the raw stored value via `get_settings().__dict__.get('universal_tracker')`,
which bypasses `Settings.__getattribute__` entirely (the `__dict__` slot lookup
short-circuits the upcast machinery) and leaves the cache un-built until something
that genuinely needs it runs. The same pattern was applied to
[`worlds/ut_pickle/__init__.py`](../../../../worlds/ut_pickle/__init__.py); see
[ut_pickle/diff-explanation.md](ut_pickle/diff-explanation.md) for the parallel
change.

---

## Integration with JSON Export System

The key integration points are:

### 1. Auto-Discovery of Pickle/JSON

When a seed name is set (from server connection), UT auto-discovers tracking files in order:

```python
# In TrackerCore
self.seed_name = "14089154938208861744"  # From RoomInfo
self.auto_discover_pickle()     # Tries frontend/presets/{game}/AP_{seed}/AP_{seed}.pkl.gz first
self.auto_discover_rules_json() # Falls back to AP_{seed}_rules.json
```

### 2. Pickle Loading (Fastest)

For fastest tracking, load the multiworld directly from pickle:

```python
tracker.load_multiworld_from_pickle("path/to/AP_seed.pkl.gz")
tracker.initialize_tracking_from_pickle()
# Tracking uses exact original rules - no conversion needed
```

### 3. Worldgen World Loading

For full rule explain support, a worldgen world can be loaded:

```python
tracker.load_worldgen_world("path/to/rules.json")
# Now explain_location_rule() uses Rule Builder's explain system
```

### 4. Direct AST Explain Fallback

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

### Loading from pickle (fastest)

```python
from worlds.tracker import TrackerCore

tracker = TrackerCore.TrackerCore(logger, False, False)
tracker.load_multiworld_from_pickle("frontend/presets/tunic/AP_123/AP_123.pkl.gz")
tracker.initialize_tracking_from_pickle()

# Tracking uses exact original rules
```

### Loading worldgen for explain support

```python
from worlds.tracker import TrackerCore

tracker = TrackerCore.TrackerCore(logger, False, False)
tracker.load_worldgen_world("frontend/presets/tunic/AP_123/AP_123_rules.json")

# Now can explain rules
explanation = tracker.explain_location_rule("Fortress - East Shortcut", state)
```

### Auto-discovering pickle/JSON

```python
tracker.seed_name = "14089154938208861744"
# Try pickle first (fastest), then JSON
if tracker.auto_discover_pickle():
    # Pickle loaded, fast tracking available
    pass
elif tracker.auto_discover_rules_json():
    # Rules JSON loaded, explain available
    pass
```

---

## Diff Statistics

Against pristine upstream v0.2.32:

| File | Upstream v0.2.32 | Fork | Notes |
|------|------------------|------|-------|
| `TrackerCoreBase.py` | 626 | 632 | pristine + class rename + seed_override hook |
| `TrackerCore.py` (extended) | — | 536 | fork-only overlay class |
| `pickle_mixin.py` | — | 291 | fork-only overlay |
| `worldgen_mixin.py` | — | 529 | fork-only overlay |
| `tracker_extensions.py` | — | 132 | fork-only overlay |
| `TrackerClient.py` | 1779 | 2086 | 3-way merge |
| `fuzzer_hook.py` | 105 | 707 | 3-way merge (+2 upstream lines) |
| `__init__.py` | 222 | 252 | fork blocks + new upstream settings |

---

## Fixes to Original Copy

As of v0.2.32 the original copy in `scripts/test/fixtures/tracker_original/` is
**byte-pristine upstream** — no fixes are applied. The repo runs Python 3.12, which
natively supports the nested same-quote f-strings (e.g.
`f"Go mode: [color={get_ut_color("in_logic")}]Yes[/color]"`) that previously required
a single-quote workaround for Python < 3.12.

---

## Related Documentation

- [Hybrid Mode](../../../../worlds/tracker/docs/hybrid-mode.md) — User guide for config-driven per-game mode selection
- [UT Tracking Modes Reference](../reference/ut-tracking-modes.md) — Technical details on each tracking mode
- [UT Fuzz Tests](../tests/test-fuzz.md) — How the modes are tested

## Related Files

- **Original repository:** https://github.com/FarisTheAncient/Archipelago (tracker branch)
- **Original copy for comparison:** `scripts/test/fixtures/tracker_original/`
- **World generator:** `world_generator/`
- **Pickle exporter:** `exporter/pickle_exporter.py`
