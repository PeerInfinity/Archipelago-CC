# Monkey Patching Technical Reference

This document explains how the JSON Tools Installer's monkey patching system works internally.

## Overview

Monkey patching is a runtime technique that modifies functions in memory without changing source files. The installer uses this to add JSON export functionality to vanilla Archipelago installations.

When enabled, the monkey patches:
1. Wrap core Archipelago functions with custom versions
2. Call the original functions to preserve normal behavior
3. Add export functionality after generation completes

## Architecture

### Files

| File | Purpose |
|------|---------|
| `monkey_patches/__init__.py` | Public API (`install_hooks`, `uninstall_hooks`) |
| `monkey_patches/hooks.py` | Hook implementations |
| `config.py` | Settings management with fallback logic |

### Hook Registry

The system maintains two global dictionaries:

```python
_installed_hooks = {}      # Maps hook_name -> wrapped function
_original_functions = {}   # Maps hook_name -> (module, attr, original_func)
```

This allows hooks to be installed, tracked, and cleanly uninstalled.

## Hooks

### 1. Export Hook (`export_rules`)

**Target:** `Main.main()`

**Purpose:** Export rules JSON and pickle files after seed generation completes.

**How it works:**

```python
import Main

original_main = Main.main

@functools.wraps(original_main)
def hooked_main(*args, **kwargs):
    # Call original generation
    result = original_main(*args, **kwargs)

    # result is the MultiWorld object
    if result is not None:
        _post_generation_export(result)

    return result

Main.main = hooked_main
```

The hook:
1. Calls the original `Main.main()` which performs seed generation
2. Captures the returned `MultiWorld` object
3. Calls `_post_generation_export()` to export rules and pickle
4. Returns the multiworld to preserve normal behavior

### 2. Sphere Logging Hook (`sphere_logging`)

**Target:** `BaseClasses.Spoiler.create_playthrough()`

**Purpose:** Log sphere information during playthrough creation for the frontend.

**How it works:**

```python
import BaseClasses

original_create_playthrough = BaseClasses.Spoiler.create_playthrough

@functools.wraps(original_create_playthrough)
def hooked_create_playthrough(self, create_paths: bool = True):
    if get_export_setting('save_sphere_log', False):
        return _create_playthrough_with_logging(self, create_paths, original_create_playthrough)
    return original_create_playthrough(self, create_paths)

BaseClasses.Spoiler.create_playthrough = hooked_create_playthrough
```

The hook:
1. Checks if sphere logging is enabled
2. If enabled, calls a wrapper that logs sphere data while creating the playthrough
3. If disabled, calls the original function directly

## Export Flow

When `_post_generation_export()` is called after generation:

```
Main.main() returns MultiWorld
       │
       ▼
_post_generation_export(multiworld)
       │
       ├─► Build filename from seed_name (e.g., "AP_14089154938208861744")
       │
       ├─► Get settings via get_export_setting() with fallbacks
       │
       ├─► Create temporary directory
       │
       ├─► Call export_game_rules()
       │   └─► Exporter decides internally whether to export based on settings
       │
       └─► Call export_multiworld_pickle()
           └─► Exporter decides internally whether to export based on settings
```

### Key Point: Exporters Handle Decisions

The export functions (`export_game_rules`, `export_multiworld_pickle`) contain their own logic for deciding whether to actually export. They check settings like:

- `save_rules_json` / `save_tracker_pickle` - Legacy enable flags
- `use_tracking_mode_config` - Whether to use per-game tracking mode config
- Game-specific settings from `tracking-mode-config.json`

The hooks simply call the exporters and let them decide. This mirrors how `Main.py` works in the fork.

## Settings Resolution

The `get_export_setting()` function provides a fallback chain for settings:

```
1. Check host.yaml (settings.general_options.{setting_name})
       │
       ▼ (if not found)
2. Check installer config (config.export_settings.{setting_name})
       │
       ▼ (if not found)
3. Return default value
```

This allows monkey patching to work on vanilla Archipelago where `host.yaml` may not have the fork's export settings. Users can either:
- Configure `host.yaml` with export settings (via `configure_export_settings()`)
- Or rely on the installer's own config as a fallback

### Settings Used by Hooks

| Setting | Purpose | Default |
|---------|---------|---------|
| `update_frontend_presets` | Copy exports to `frontend/presets/` | `False` |
| `skip_preset_copy_if_rules_identical` | Skip copy if files match | `False` |
| `rules_json_format` | Format for rules JSON | `"rule_builder"` |
| `clear_game_presets` | Clear existing game presets | `False` |
| `clear_all_presets` | Clear all presets | `False` |
| `save_sphere_log` | Enable sphere logging | `False` |
| `save_tracker_pickle` | Enable pickle export | `False` |

## Comparison: Monkey Patching vs Fork Integration

| Aspect | Monkey Patching | Fork (Main.py) |
|--------|-----------------|----------------|
| **When exports run** | After `Main.main()` returns | Inside `Main.main()`, before temp dir cleanup |
| **Temp directory** | Creates its own | Uses generation's temp dir |
| **Settings source** | host.yaml → installer config | host.yaml (settings.general_options) |
| **File modifications** | None | Main.py has export calls built-in |
| **Cache clearing** | Yes (clear_rule_cache, clear_handler_cache) | Yes |

### Timing Difference

In the fork, exports happen inside `Main.main()` before the temporary directory is cleaned up. The exports go to `temp_dir` and are then zipped into the output archive.

With monkey patching, exports happen after `Main.main()` returns, so the generation's temp directory is already gone. The hooks create their own temp directory and rely on `save_presets=True` to copy files to `frontend/presets/`.

## Installation and Auto-Install

### Manual Installation

```python
from worlds.json_tools_installer.monkey_patches import install_hooks

results = install_hooks(export_rules=True, sphere_logging=True)
# results = {"export_rules": True, "sphere_logging": True}
```

### Auto-Installation

When the installer APWorld loads, it can automatically install hooks:

```python
# In __init__.py
from .monkey_patches import auto_install
auto_install()
```

The `auto_install()` function checks the installer config:

```python
def auto_install():
    config = load_config()
    if config.patches.method == "monkey":
        install_hooks()
```

## Uninstalling Hooks

Hooks can be cleanly uninstalled by restoring the original functions:

```python
from worlds.json_tools_installer.monkey_patches import uninstall_hooks

results = uninstall_hooks()
# Restores Main.main and Spoiler.create_playthrough to originals
```

## Error Handling

The hooks are designed to fail gracefully:

1. **Import errors** - If `Main` or `BaseClasses` can't be imported, the hook installation fails but doesn't crash
2. **Export errors** - Exceptions during export are caught and logged as warnings
3. **Missing exporters** - If the exporter module isn't installed, a debug message is logged and export is skipped

```python
try:
    from exporter import export_game_rules
    export_game_rules(...)
except ImportError:
    logger.debug("Exporter module not found, skipping rules export")
except Exception as e:
    logger.warning(f"Rules export failed: {e}")
```

## Debugging

To see what's happening with monkey patching, enable debug logging:

```python
import logging
logging.getLogger("worlds.json_tools_installer.monkey_patches").setLevel(logging.DEBUG)
```

You'll see messages like:
- `Installed hook: export_rules`
- `Installed hook: sphere_logging`
- `Exporting rules via monkey patch hook`
- `Exporting pickle via monkey patch hook`

## Limitations

1. **Timing** - Exports happen after generation completes, so they can't be included in the output zip archive
2. **Settings** - Requires either configured host.yaml or installer config for settings
3. **Dependencies** - Requires the exporter module to be installed for actual export functionality
4. **Single wrap** - If another system also wraps `Main.main()`, behavior depends on wrap order
