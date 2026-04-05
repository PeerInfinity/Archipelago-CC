# UT Pickle Mode: Diff Explanation

This document explains every difference between the original Universal Tracker (`scripts/test/fixtures/tracker_original/`) and UT Pickle Mode (`worlds/ut_pickle/`).

See [ut_pickle.diff](ut_pickle.diff) for the full unified diff.

## Files unchanged from original

These files are verbatim copies with no modifications:

- **`TrackerCoreOriginal.py`** — Copy of original `TrackerCore.py` (renamed to avoid conflict with the new wrapper)
- **`Tracker.kv`** — UI layout
- **`TrackerKivy.py`** — Kivy image loader
- **`icon.png`** — Application icon

## Modified files

### `__init__.py`

| Change | Purpose |
|--------|---------|
| Added `WebWorld` import and `TrackerWorldWeb` class | Required for compatibility with newer AP versions that expect `web` on World classes |
| `UT_VERSION` → `"v0.2.26-pickle"` | Distinguish from original UT |
| Added `EnabledBool` setting (`enabled: bool = False`) | Allows disabling ut_pickle so it doesn't interfere with the existing tracker. Disabled by default — user must manually enable. |
| Added `PickleModeBool` setting (`pickle_mode: bool = True`) | Toggle between pickle-based tracking and original YAML-based tracking |
| `game` → `"UT Pickle Mode"` | Prevents conflict with the original "Universal Tracker" world registration |
| `settings_key` → `"ut_pickle"` | Separate host.yaml section so settings don't conflict with original UT |
| Wrapped launcher component in `_is_enabled()` guard | When disabled, no launcher component is registered and no monkey patches are installed |
| Added monkey patch auto-install | Installs the `Main.main` wrapper that exports pickle files during generation |
| Icon key → `"ut_pickle_ico"` | Prevents collision with original UT's `"ut_ico"` icon key |

### `TrackerClient.py`

| Change | Lines | Purpose |
|--------|-------|---------|
| Added `self.seed_name = None` in `__init__` | +1 line | Instance variable to store seed name from server |
| Added `RoomInfo` handler | +2 lines | Captures `seed_name` from the server's RoomInfo packet, needed to locate the pickle file |
| Added pickle auto-discovery before `initalize_tracker_core` | +4 lines | Sets seed_name on TrackerCore and calls `auto_discover_pickle()` to find and load the pickle file before tracking initialization |

Total: **7 lines added**, 1 line changed (`if` → `elif`)

### `fuzzer_hook.py`

| Change | Purpose |
|--------|---------|
| Wrapped zipfile extraction in try/except | Allows running with `--skip-output` (no .zip file created). Falls back to empty slot_data. |
| Added `seed_name` and `auto_discover_pickle()` calls | Enables pickle-based tracking during fuzz tests |

## New files

### `TrackerCore.py` (~100 lines)

Thin wrapper that extends the original `TrackerCore` (via `TrackerCoreOriginal`) with `PickleMixin`. Overrides `initalize_tracker_core()` to try pickle mode first, then fall back to original YAML-based tracking. Also sets host settings defaults that are normally set by `run_generator()` (which pickle mode skips).

### `pickle_exporter.py` (~170 lines)

Exports the multiworld as a gzip-compressed dill pickle file. Handles:
- `ThreadBarrierProxy` replacement (unpicklable)
- Spoiler object cleanup
- Metadata JSON sidecar for discovery/validation
- Recursion limit increase for complex worlds (ALttP)

### `pickle_mixin.py` (~210 lines)

Mixin that adds pickle loading and auto-discovery to TrackerCore:
- `load_multiworld_from_pickle()` — loads from `.pkl.gz` file
- `initialize_tracking_from_pickle()` — sets up tracking from loaded pickle, clears precollected items, converts list-address locations to events
- `auto_discover_pickle()` — searches `output/` and user directories for matching pickle files

### `monkey_patches/hooks.py` (~80 lines)

Wraps `Main.main()` to export a pickle after seed generation completes. Only the `Main.main` wrapper is used (no `Spoiler.to_file` wrapper needed since pickle export doesn't require spoiler data).

### `monkey_patches/__init__.py` (~10 lines)

Module init exposing `install_hooks` and `auto_install`.

### `requirements.txt` (1 line)

`dill>=0.3.8` — required for pickling lambdas/closures in access rules.

### `archipelago.json`

Game name changed to `"UT Pickle Mode"` to match the world registration.
