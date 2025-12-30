# JSON Tools APWorld Packaging Plan

## Overview

This document outlines the plan to package the JSON export/import tools from this repository into a distributable `.apworld` file that can be installed into an unmodified Archipelago installation.

**Goal:** Allow users to install JSON Tools into a vanilla Archipelago and gain access to:
- Rule exporter (export game logic to JSON)
- World generator (generate worlds from JSON rules)
- Frontend web UI (visual logic viewer/editor)
- Rule Builder system (declarative rule definitions)

## Components to Package

### 1. Rule Builder (`rule_builder/`)
**Status:** Self-contained, no patches required

| File | Size | Purpose |
|------|------|---------|
| `__init__.py` | ~3KB | Module exports |
| `rules.py` | ~40KB | Core rule classes |
| `ast_format.py` | ~5KB | AST format parsing |
| `ast_explain.py` | ~3KB | Rule explanation |

**Dependencies:** None (uses only standard library + Archipelago base)

### 2. Exporter (`exporter/`)
**Status:** Requires core file patches

| Subdirectory | Files | Purpose |
|--------------|-------|---------|
| Root | 5 | Main exporter, sphere logger |
| `analyzer/` | 15 | Rule analysis and AST processing |
| `converter/` | 12 | Format conversion utilities |
| `games/` | 40+ | Game-specific export handlers |

**Dependencies:**
- `rule_builder`
- Patches to `Main.py`, `BaseClasses.py`, `settings.py`

### 3. World Generator (`world_generator/`)
**Status:** Self-contained after rule_builder

| File | Purpose |
|------|---------|
| `__init__.py` | Module exports |
| `generator.py` | Main generation logic |
| `extractors.py` | JSON data extraction |
| `rule_codegen.py` | Python code generation |
| `templates.py` | File templates |
| `cli.py` | Command-line interface |
| `constants.py` | Shared constants |

**Dependencies:** `rule_builder`

### 4. Frontend (`frontend/`)
**Status:** Static files, can be served via HTTP

| Directory | Contents |
|-----------|----------|
| Root | HTML entry point, config files |
| `app/` | Core application JS |
| `modules/` | Feature modules |
| `libs/` | Third-party libraries |

**Note:** Frontend is large (~400 files). Consider:
- Bundling in apworld (increases size)
- Separate download with auto-install
- Hosting externally with local cache

---

## Core File Patches Required

### Main.py Changes

```python
# Line ~19: Add import
from exporter import export_game_rules

# Line ~36: Add temp_dir tracking
multiworld.temp_dir_for_sphere_log = args.outputpath

# Line ~206: Add vanilla placement hook (optional, ALTTP-specific)
# Line ~247: Skip accessibility for vanilla placement (optional)

# Line ~390: Add sphere log temp_dir
if hasattr(multiworld, 'spoiler'):
    multiworld.temp_dir_for_sphere_log = temp_dir

# Line ~401: Add JSON export call
settings = get_settings()
if settings.general_options.save_rules_json:
    export_game_rules(multiworld, temp_dir, outfilebase, ...)
```

### BaseClasses.py Changes

```python
# In Spoiler.create_playthrough() - Line ~1691
# Add sphere logging hook
try:
    from settings import get_settings
    settings = get_settings()
    if settings.general_options.save_sphere_log:
        from exporter.sphere_logger import create_playthrough_with_logging
        return create_playthrough_with_logging(self, create_paths)
except (ImportError, AttributeError):
    pass  # Fall through to original
```

### settings.py Changes

```python
# Line ~109: Add global variable
skip_required_files = False

# Line ~89-122: Add skip_required_files handling in Group class

# Line ~525-538: Add new GeneralOptions
skip_required_files: bool = False
save_rules_json: bool = False
skip_preset_copy_if_rules_identical: bool = False
save_sphere_log: bool = False
verbose_sphere_log: bool = False
extend_sphere_log_to_all_locations: bool = False
log_fractional_sphere_details: bool = True
log_integer_sphere_details: bool = False
update_frontend_presets: bool = False

# Line ~916: Update global after settings load
global skip_required_files
skip_required_files = res.general_options.skip_required_files
```

---

## Patching Strategies

### Strategy A: File-Based Patching (Recommended for Production)

**Pros:**
- Clean, reversible
- User can review changes before applying
- Works offline

**Cons:**
- Must maintain patches per AP version
- Requires exact file match

**Implementation:**
```python
# json_tools/patcher.py
import hashlib
from pathlib import Path

SUPPORTED_VERSIONS = {
    "0.6.5-rc1": {
        "Main.py": "sha256_hash_here",
        "BaseClasses.py": "sha256_hash_here",
        "settings.py": "sha256_hash_here",
    }
}

def detect_version():
    """Detect AP version by file hashes."""
    ...

def apply_patches(version: str, dry_run: bool = False):
    """Apply patches for the given version."""
    ...

def revert_patches():
    """Restore original files from backup."""
    ...
```

### Strategy B: Monkey Patching (Recommended for Development)

**Pros:**
- No file modifications
- Works across minor version differences
- Instant enable/disable

**Cons:**
- Fragile if internal APIs change
- May conflict with other modifications
- Harder to debug

**Implementation:**
```python
# json_tools/__init__.py
def _install_hooks():
    """Install runtime hooks into Archipelago core."""
    import Main
    import BaseClasses

    # Wrap Main.main
    _original_main = Main.main
    def _hooked_main(*args, **kwargs):
        result = _original_main(*args, **kwargs)
        # Post-generation export hook
        ...
        return result
    Main.main = _hooked_main

    # Wrap Spoiler.create_playthrough
    _original_playthrough = BaseClasses.Spoiler.create_playthrough
    def _hooked_playthrough(self, create_paths=True):
        # Check if sphere logging enabled
        ...
        return _original_playthrough(self, create_paths)
    BaseClasses.Spoiler.create_playthrough = _hooked_playthrough

# Install hooks when apworld loads
_install_hooks()
```

### Strategy C: Hybrid Approach (Recommended)

1. Use monkey patching by default for compatibility
2. Offer file patching as opt-in for better reliability
3. Provide launcher component to manage patches

---

## APWorld Structure

```
json_tools/
├── __init__.py              # Main entry, hook installation
├── archipelago.json         # APWorld manifest
├── components.py            # Launcher components
├── patcher/
│   ├── __init__.py
│   ├── detector.py          # Version detection
│   ├── applier.py           # Patch application
│   └── patches/
│       ├── 0.6.5-rc1/
│       │   ├── Main.py.patch
│       │   ├── BaseClasses.py.patch
│       │   └── settings.py.patch
│       └── 0.6.6/
│           └── ...
├── hooks.py                 # Monkey patching implementation
├── settings_ext.py          # Extended settings definitions
├── rule_builder/            # Complete rule_builder module
│   ├── __init__.py
│   ├── rules.py
│   ├── ast_format.py
│   └── ast_explain.py
├── exporter/                # Complete exporter module
│   ├── __init__.py
│   ├── exporter.py
│   ├── sphere_logger.py
│   ├── analyzer/
│   ├── converter/
│   └── games/
├── world_generator/         # Complete world_generator module
│   ├── __init__.py
│   ├── generator.py
│   ├── extractors.py
│   ├── rule_codegen.py
│   ├── templates.py
│   └── cli.py
└── frontend/                # Static frontend files (optional)
    ├── index.html
    ├── app/
    ├── modules/
    └── libs/
```

---

## Launcher Components

```python
# json_tools/components.py
from worlds.LauncherComponents import Component, components, Type, launch

def launch_setup_wizard(*args):
    """Launch the JSON Tools setup wizard."""
    from .patcher import run_setup_wizard
    launch(run_setup_wizard, name="JSON Tools Setup", args=args)

def launch_frontend_server(*args):
    """Start HTTP server for frontend UI."""
    from .server import start_frontend_server
    launch(start_frontend_server, name="JSON Tools Frontend", args=args)

def launch_world_generator(*args):
    """Launch world generator CLI."""
    from .world_generator.cli import main as wg_main
    launch(wg_main, name="World Generator", args=args)

def launch_rule_viewer(*args):
    """Launch rule viewer/debugger."""
    from .viewer import launch_viewer
    launch(launch_viewer, name="Rule Viewer", args=args)

# Register components
components.extend([
    Component(
        "JSON Tools Setup",
        func=launch_setup_wizard,
        component_type=Type.TOOL,
        description="Configure JSON Tools and apply patches"
    ),
    Component(
        "JSON Tools Frontend",
        func=launch_frontend_server,
        component_type=Type.TOOL,
        description="Start web UI for viewing game logic"
    ),
    Component(
        "World Generator",
        func=launch_world_generator,
        component_type=Type.TOOL,
        cli=True,
        description="Generate worlds from JSON rules"
    ),
])
```

---

## Manifest File

```json
{
    "game": "JSON Tools",
    "compatible_version": 7,
    "version": "1.0.0",
    "minimum_ap_version": "0.6.5",
    "maximum_ap_version": null,
    "world_version": "1.0.0"
}
```

**Note:** Since JSON Tools is not actually a game world (it has no items/locations), we may need to create a minimal stub world or investigate if AP allows tool-only apworlds.

---

## Packaging Script Design

```python
#!/usr/bin/env python3
"""
Package JSON Tools into an APWorld file.

Usage:
    python scripts/build/pack_json_tools.py [options]

Options:
    --include-frontend    Include frontend files in apworld
    --output PATH         Output path (default: apworlds/json_tools.apworld)
    --version VERSION     Version string (default: from git or 1.0.0)
"""

import argparse
import json
import zipfile
from pathlib import Path

# Modules to include
MODULES = [
    "rule_builder",
    "exporter",
    "world_generator",
]

# Files to exclude
EXCLUDE_PATTERNS = [
    "__pycache__",
    "*.pyc",
    ".DS_Store",
    "test_*.py",
    "*_test.py",
]

def create_apworld(
    output_path: Path,
    include_frontend: bool = False,
    version: str = "1.0.0"
):
    """Create the JSON Tools apworld."""
    ...
```

---

## Implementation Phases

### Phase 1: Basic Packaging Script
- [ ] Create `scripts/build/pack_json_tools.py`
- [ ] Package rule_builder, exporter, world_generator
- [ ] Generate archipelago.json manifest
- [ ] Create minimal stub world (if required)
- [ ] Test loading in vanilla Archipelago

### Phase 2: Monkey Patching Hooks
- [ ] Implement `hooks.py` with runtime patching
- [ ] Add settings extension mechanism
- [ ] Test export functionality without file patches
- [ ] Handle edge cases (settings not loaded, etc.)

### Phase 3: Launcher Components
- [ ] Implement setup wizard component
- [ ] Implement frontend server component
- [ ] Implement world generator component
- [ ] Add icons for launcher

### Phase 4: File-Based Patching (Optional)
- [ ] Create patch generation script
- [ ] Implement version detection
- [ ] Implement patch application/reversion
- [ ] Create backup mechanism

### Phase 5: Frontend Integration
- [ ] Decide on frontend distribution strategy
- [ ] Implement auto-download if external
- [ ] Or bundle with compression optimization
- [ ] Add frontend server with auto-launch

---

## Resolved Questions

### 1. Stub World Requirement
**Q:** Does Archipelago require apworlds to define a game with items/locations?

**A:** Yes, but we can use the same pattern as Universal Tracker (`worlds/tracker/`):
```python
class JSONToolsWorld(World):
    game = "JSON Tools"
    hidden = True  # Don't show in game list
    item_name_to_id = {}
    location_name_to_id = {}
```
This satisfies AutoWorldRegister while keeping the "game" hidden from users.

### 2. Frontend Distribution
**Q:** Bundle in apworld (~5MB compressed) or separate download?

**A:** Bundle frontend WITHOUT the presets directory:
- `frontend/` without presets: ~11MB uncompressed, ~3-5MB compressed
- `frontend/presets/`: 75MB - exclude from apworld
- Presets can be regenerated by running the exporter
- Exporter should detect if frontend is available and disable preset output if not

### 3. Settings UI
**Q:** Can we add settings to the Options Creator without patching?

**A:** Requires experimentation. Universal Tracker adds settings via `TrackerSettings(Group)` - this may work for JSON Tools settings too.

### 4. Version Compatibility
**Q:** How to handle AP version updates that break patches?

**A:** Use standard apworld update approach - users download new version of JSON Tools apworld when updating Archipelago. No special tooling needed.

### 5. World File Patches
**Q:** Are the 11 world `__init__.py` patches for `skip_required_files` needed?

**A:** No. These are only required to run generation without ROM files. Most users have ROMs and don't need this feature. Can be added later as an optional enhancement.

---

## Related Files

- Repository changes: `docs/json/developer/diffs/repository-changes.md`
- Core file diffs: `docs/json/developer/diffs/core-files.diff`
- Existing pack script: `scripts/build/pack_apworld.py`
- Launcher components: `worlds/LauncherComponents.py`
- APWorld loading: `worlds/__init__.py`

---

**Last Updated:** 2025-12-30
