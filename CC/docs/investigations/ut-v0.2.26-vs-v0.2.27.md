# Universal Tracker v0.2.26 vs v0.2.27

**Date:** 2026-04-05  
**v0.2.27 released:** 2026-04-05  
**Fixtures:** `scripts/test/fixtures/tracker_original_v0.2.26/`, `scripts/test/fixtures/tracker_original_v0.2.27/`

## Summary

v0.2.27 was released the same day we built ut_pickle from v0.2.26. The changes are primarily in the map tab UI (location/entrance rendering with per-location sizes) and minor cleanup. None of the changes affect the core tracking logic that pickle mode depends on.

## Changes by file

### `__init__.py` — Version bump only

The only change is `UT_VERSION = "v0.2.26"` → `"v0.2.27"`.

No changes to `TrackerSettings`, `TrackerWorld`, `CurrentTrackerState`, `DeferredEntranceMode`, or `UTMapTabData`.

### `TrackerCore.py` — Minor error handling and display order

3 changes, all minor:

1. **Moved `self.clear_page()` earlier** — from after item processing to before. This means the tracker tab is cleared before items are processed rather than after, preventing a brief flash of stale data.

2. **Error message wording** — `"Item id"` → `"Item name"` in the error message when an item can't be created (since the variable is `item_name`, not an ID).

3. **Error color** — The first occurrence now uses `[color=...error...]` markup for the error message, referencing a new `"error"` color.

None of these affect `updateTracker()`'s logic calculations (reachability, sphere comparison). The pickle fuzz test results would be identical.

### `TrackerClient.py` — Map tab size support and cleanup (bulk of changes)

184 changed lines across 30 hunks. The changes fall into three categories:

#### 1. `gui_enabled` import moved (2 lines)

`gui_enabled` moved from `CommonClient` to `Utils`. A guard was added at the top of `get_ut_color()` to return a default color when GUI is disabled, preventing import errors in headless/CI mode.

#### 2. Map coordinate dictionaries now include size (major change, ~80 lines)

All coordinate dictionary comprehensions in `load_pack()` changed from:
```python
(x, y): [section_list]
```
to:
```python
(x, y): ([section_list], map_loc.get("size"))
```

This adds per-location icon sizing from the PopTracker pack data. The corresponding `load_coords()` method in `VisualTracker` was updated to unpack the `(sections, size)` tuples and use `size` (or a default of 65) when creating map location widgets.

Previously, location icon sizes were hardcoded in the `.kv` file. Now they can vary per-location based on the pack's `map_locations` data.

Related changes:
- `Tracker.kv` removed `size: (app.loc_size, app.loc_size)` from `ApLocationDeferred`, `ApLocationMixed`, and `ApLocationSplit` (since size is now set programmatically)
- `map_page_coords_func` call now passes `self.ui.loc_size` as the default size

#### 3. `get_logical_path` rebuilt to use rule builder (significant, ~20 lines)

The `/get_logical_path` command was previously just logging path entries with `logger.info(v)`. Now it:
- Resolves each entrance name to an entrance object via `current_world.get_entrance(v)`
- Checks for a world-specific `explain_path()` method first
- Falls back to `entrance.access_rule.explain_json(state)` for rule builder support
- Also explains the final location's access rule if applicable
- Uses colored JSON output (`"type":"color","color":"blue"` for entrances, `"color":"green"` for locations)

#### 4. Whitespace cleanup (~40 lines)

Trailing whitespace removed from many lines. Trailing spaces on `StringProperty("")` declarations cleaned up. No functional changes.

#### 5. Quote style in f-strings (3 lines)

`get_ut_color('in_logic')` → `get_ut_color("in_logic")` in the go-mode label f-strings. No functional change.

### `Tracker.kv` — New error color and size removal

3 changes:
1. Added `error: "FF0000"` color to `UTTextColor`
2. Removed `size: (app.loc_size, app.loc_size)` from `ApLocationDeferred`, `ApLocationMixed`, `ApLocationSplit` (size now set programmatically in TrackerClient)

### `TrackerKivy.py` — No changes

### `fuzzer_hook.py` — No changes

### `archipelago.json` — No changes

## Impact on ut_pickle

**None of the changes affect pickle mode functionality.** The core tracking logic (`TrackerCore.updateTracker()`, `initalize_tracker_core()`, `run_generator()`) is unchanged except for cosmetic error messages.

The ut_pickle additions (7 lines in TrackerClient for seed_name capture and pickle discovery, the TrackerCore wrapper, and the new pickle files) would apply cleanly to v0.2.27 since they don't touch any of the changed areas:
- The pickle discovery code is in `on_package()` around line 1287, which is untouched in v0.2.27
- The `TrackerCore` wrapper inherits from the original, so it picks up the minor error message changes automatically
- The map tab changes are entirely in the GUI rendering path, not the logic path

**Recommendation:** Update ut_pickle to v0.2.27 at the next convenient opportunity. The update is mechanical — replace the verbatim copies (`TrackerCoreOriginal.py`, `TrackerClient.py`, `Tracker.kv`) with the v0.2.27 versions, and re-apply the 7-line pickle discovery patch to TrackerClient.py.
