# JSON Tools Installer APWorld Plan

## Overview

This document outlines the plan for a simplified APWorld that provides an installer and management GUI for JSON Tools. Instead of packaging all tools inside the APWorld, this approach keeps the APWorld small and downloads tools on demand.

**Goal:** Provide vanilla Archipelago users with an easy way to install and manage JSON Tools (exporter, world_generator, rule_builder, frontend, scripts) without needing to manually clone repositories or apply patches.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     json_tools_installer.apworld                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │
│  │  Installer GUI  │  │   Status GUI    │  │   Script Launcher   │  │
│  │  (Kivy-based)   │  │  (Kivy-based)   │  │   (CLI wrappers)    │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │
│           │                    │                      │              │
│  ┌────────┴────────────────────┴──────────────────────┴──────────┐  │
│  │                     Core Installer Module                      │  │
│  │  - Download manager (GitHub zip archives)                      │  │
│  │  - File patcher (backup, apply, revert)                        │  │
│  │  - Version detector                                            │  │
│  │  - Configuration manager                                       │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Archipelago Installation                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Main.py    │  │ BaseClasses  │  │  settings.py │  (patched)    │
│  │   .backup    │  │    .backup   │  │    .backup   │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   exporter/  │  │ rule_builder/│  │world_generator│ (downloaded) │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐                                 │
│  │  frontend/   │  │   scripts/   │  (optional downloads)           │
│  └──────────────┘  └──────────────┘                                 │
└─────────────────────────────────────────────────────────────────────┘
```

## Download Sources

### Default Configuration

| Version | Repository | Branch | Use Case |
|---------|------------|--------|----------|
| Stable | `PeerInfinity/Archipelago` | `JSONExport` | Production use |
| Dev | `PeerInfinity/Archipelago-CC` | `main` | Testing new features |

### Download Mechanism

Use GitHub's archive API to download branch snapshots:
```
https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip
```

Example:
- Stable: `https://github.com/PeerInfinity/Archipelago/archive/refs/heads/JSONExport.zip`
- Dev: `https://github.com/PeerInfinity/Archipelago-CC/archive/refs/heads/main.zip`

### Files to Download

From the downloaded archive, extract and install:

| Directory/File | Required | Description |
|----------------|----------|-------------|
| `exporter/` | Yes | Rule export functionality |
| `rule_builder/` | Yes | Declarative rule system |
| `world_generator/` | Yes | JSON-to-world generator |
| `frontend/` | Optional | Web UI for viewing logic |
| `frontend/presets/` | Optional | Pre-generated game data |
| `scripts/` | Yes | Utility scripts |
| `docs/json/` | Optional | Documentation |

**Excluded from download:**
- `CC/` - Claude Code specific files
- `worlds/*_worldgen/` - Auto-generated worlds
- `.github/` - CI/CD workflows
- Test files and caches

## Core Files to Patch

These upstream Archipelago files need modification:

### Main.py
```python
# Line ~19: Add import
from exporter import export_game_rules

# Line ~36: Add temp_dir tracking
multiworld.temp_dir_for_sphere_log = args.outputpath

# Line ~390+: Add sphere log handling
# Line ~401+: Add JSON export call
```

### BaseClasses.py
```python
# In Spoiler.create_playthrough() - Line ~1691
# Add sphere logging hook
```

### settings.py
```python
# Add new GeneralOptions:
# - save_rules_json
# - save_sphere_log
# - verbose_sphere_log
# - update_frontend_presets
# etc.
```

## Patching Strategy

### Primary: File Replacement with Backup

1. **Detect AP version** by checking `Utils.__version__` or file hashes
2. **Backup originals** to `{filename}.backup` (or `{filename}.backup.1`, `.2` if multiple)
3. **Download patched versions** from the appropriate source
4. **Verify checksums** before replacing
5. **Replace files** in place

### Fallback: Monkey Patching (for unsupported versions)

For AP versions without pre-made patches:
```python
def apply_monkey_patches():
    """Runtime patches without modifying files."""
    import Main
    import BaseClasses

    # Wrap Main.main to add export hook
    _original_main = Main.main
    def _hooked_main(*args, **kwargs):
        result = _original_main(*args, **kwargs)
        # Post-generation export
        return result
    Main.main = _hooked_main
```

### Revert Capability

```python
def revert_patches():
    """Restore original files from backups."""
    for file in ['Main.py', 'BaseClasses.py', 'settings.py']:
        backup = Path(file + '.backup')
        if backup.exists():
            shutil.copy(backup, file)
            backup.unlink()
```

## APWorld Structure

```
json_tools_installer/
├── __init__.py              # APWorld entry point, hidden world stub
├── archipelago.json         # Manifest
├── components.py            # Launcher component definitions
├── config.py                # Configuration management
│
├── installer/
│   ├── __init__.py
│   ├── downloader.py        # GitHub download logic
│   ├── extractor.py         # Zip extraction and file placement
│   ├── patcher.py           # File patching and backup
│   ├── version_detector.py  # AP version detection
│   └── patches/             # Pre-made patched files by AP version
│       ├── 0.6.5/
│       │   ├── Main.py
│       │   ├── BaseClasses.py
│       │   └── settings.py
│       └── 0.6.6/
│           └── ...
│
├── gui/
│   ├── __init__.py
│   ├── installer_gui.py     # Main installer interface
│   ├── status_gui.py        # Status checker interface
│   └── widgets.py           # Shared Kivy widgets
│
├── cli/
│   ├── __init__.py
│   ├── install.py           # CLI installer
│   ├── status.py            # CLI status checker
│   └── scripts_runner.py    # Run downloaded scripts
│
└── monkey_patches/
    ├── __init__.py
    └── hooks.py             # Runtime patching for unsupported versions
```

## Launcher Components

### Component Definitions

```python
from worlds.LauncherComponents import Component, Type, components

components.extend([
    Component(
        "JSON Tools Installer",
        func=launch_installer_gui,
        component_type=Type.TOOL,
        icon="json_tools",
        description="Install or update JSON Tools from GitHub"
    ),
    Component(
        "JSON Tools Status",
        func=launch_status_gui,
        component_type=Type.TOOL,
        icon="json_tools",
        description="Check installation status and version info"
    ),
    Component(
        "JSON Tools Scripts",
        func=launch_scripts_menu,
        component_type=Type.TOOL,
        icon="json_tools",
        description="Run JSON Tools utility scripts"
    ),
])
```

## GUI Designs

### Installer GUI

```
┌─────────────────────────────────────────────────────────────┐
│              JSON Tools Installer                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Version:  ○ Stable (PeerInfinity/Archipelago)              │
│            ● Dev (PeerInfinity/Archipelago-CC)              │
│                                                              │
│  Components:                                                 │
│    ☑ Core Tools (exporter, rule_builder, world_generator)   │
│    ☑ Scripts                                                │
│    ☐ Frontend (Web UI)                                      │
│    ☐ Presets (pre-generated game data, ~75MB)               │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Status: Ready to install                                │ │
│  │ AP Version: 0.6.5 (supported)                          │ │
│  │ Current Install: None                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  [ Advanced Settings ]                                       │
│                                                              │
│           [ Install / Update ]     [ Uninstall ]            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Status GUI

```
┌─────────────────────────────────────────────────────────────┐
│              JSON Tools Status                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Installation Status                                         │
│  ─────────────────────────────────────────────────────────  │
│  Archipelago Version:    0.6.5                              │
│  JSON Tools Version:     1.2.0 (dev)                        │
│  Source:                 PeerInfinity/Archipelago-CC        │
│                                                              │
│  Components                                    Status        │
│  ─────────────────────────────────────────────────────────  │
│  Core Patches (Main.py, etc.)                 ✓ Applied     │
│  Exporter                                     ✓ Installed   │
│  Rule Builder                                 ✓ Installed   │
│  World Generator                              ✓ Installed   │
│  Scripts                                      ✓ Installed   │
│  Frontend                                     ✗ Not installed│
│  Presets                                      ✗ Not installed│
│                                                              │
│  Configuration                                               │
│  ─────────────────────────────────────────────────────────  │
│  save_rules_json:        Enabled                            │
│  save_sphere_log:        Enabled                            │
│                                                              │
│              [ Refresh ]     [ View Logs ]                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Scripts Menu

```
┌─────────────────────────────────────────────────────────────┐
│              JSON Tools Scripts                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Setup Scripts                                               │
│  ├─ [ Run ] setup_dev_environment.py                        │
│  ├─ [ Run ] update_host_settings.py                         │
│  └─ [ Run ] setup_ap_server.py                              │
│                                                              │
│  Test Scripts                                                │
│  ├─ [ Run ] test-all-templates.py                           │
│  └─ [ Run ] test_regression.py                              │
│                                                              │
│  Build Scripts                                               │
│  ├─ [ Run ] pack_apworld.py                                 │
│  └─ [ Run ] Generate.py (with options)                      │
│                                                              │
│  Data Scripts                                                │
│  ├─ [ Run ] combine_apworld_data.py                         │
│  └─ [ Run ] install_apworlds.py                             │
│                                                              │
│                          [ Open Scripts Folder ]            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## CLI Interface

### Installation

```bash
# Install stable version with all components
python -m json_tools_installer install --version stable --all

# Install dev version, core only
python -m json_tools_installer install --version dev

# Install with specific components
python -m json_tools_installer install --frontend --presets

# Update existing installation
python -m json_tools_installer update

# Uninstall (revert patches, remove files)
python -m json_tools_installer uninstall
```

### Status

```bash
# Check installation status
python -m json_tools_installer status

# Verbose status with file hashes
python -m json_tools_installer status --verbose
```

### Configuration

```bash
# Set custom source repository
python -m json_tools_installer config --stable-repo "user/repo" --stable-branch "branch"
python -m json_tools_installer config --dev-repo "user/repo" --dev-branch "branch"

# View current configuration
python -m json_tools_installer config --show
```

## Configuration File

Store installer configuration in `json_tools_config.yaml`:

```yaml
# JSON Tools Installer Configuration

sources:
  stable:
    repo: "PeerInfinity/Archipelago"
    branch: "JSONExport"
  dev:
    repo: "PeerInfinity/Archipelago-CC"
    branch: "main"

installation:
  version: "dev"  # or "stable"
  components:
    - core
    - scripts
    # - frontend
    # - presets

  installed_at: "2024-01-15T10:30:00Z"
  commit_hash: "abc123..."

patches:
  method: "file"  # or "monkey"
  backups:
    - path: "Main.py.backup"
      original_hash: "sha256:..."
    - path: "BaseClasses.py.backup"
      original_hash: "sha256:..."
```

## Version Detection

### Detecting AP Version

```python
def detect_ap_version() -> str:
    """Detect installed Archipelago version."""
    try:
        from Utils import __version__
        return __version__
    except ImportError:
        # Fallback: parse setup.py or version file
        ...
```

### Supported Versions

| AP Version | Patch Status | Notes |
|------------|--------------|-------|
| 0.6.5 | Full support | Pre-made patched files |
| 0.6.5-rc1 | Full support | Pre-made patched files |
| 0.6.4 | Monkey patch only | Runtime hooks |
| Other | Experimental | Attempt monkey patch with warning |

## Implementation Phases

### Phase 1: Core Installer
- [ ] Create APWorld structure with hidden world stub
- [ ] Implement download manager (GitHub zip archives)
- [ ] Implement file extractor (selective extraction)
- [ ] Implement version detector
- [ ] Create CLI interface for install/uninstall/status
- [ ] Test on vanilla Archipelago 0.6.5

### Phase 2: File Patching
- [ ] Create backup mechanism
- [ ] Store pre-made patched files for 0.6.5
- [ ] Implement file replacement with verification
- [ ] Implement revert functionality
- [ ] Add checksum verification

### Phase 3: Kivy GUI
- [ ] Create installer GUI
- [ ] Create status GUI
- [ ] Create scripts menu
- [ ] Register launcher components
- [ ] Add icons

### Phase 4: Monkey Patching Fallback
- [ ] Implement runtime hooks
- [ ] Add version compatibility checks
- [ ] Create warning system for unsupported versions
- [ ] Test on multiple AP versions

### Phase 5: Polish & Documentation
- [ ] Add update checking
- [ ] Create user documentation
- [ ] Add error handling and logging
- [ ] Create troubleshooting guide

## Testing Strategy

### Unit Tests
- Download manager: mock GitHub responses
- Extractor: test selective file extraction
- Patcher: test backup/restore cycle
- Version detector: test various AP versions

### Integration Tests
- Full install on vanilla AP 0.6.5
- Update from one version to another
- Uninstall and verify clean state
- Test each GUI component

### Manual Testing Checklist
- [ ] Install stable version on Windows
- [ ] Install dev version on Windows
- [ ] Install on macOS
- [ ] Install on Linux
- [ ] Update installation
- [ ] Uninstall completely
- [ ] Revert patches
- [ ] Run scripts through GUI
- [ ] Run scripts through CLI

## Dependencies

The installer APWorld should have minimal dependencies:
- Python standard library only for core functionality
- Kivy (already required by Archipelago) for GUI
- `requests` or `urllib` for downloads (stdlib preferred)
- `zipfile` for extraction (stdlib)
- `hashlib` for checksums (stdlib)

## Open Questions

1. **Icon**: Need to create/obtain an icon for launcher components
2. **Offline mode**: Should we support installing from a local zip file?
3. **Partial updates**: Should we support updating individual components?
4. **Settings sync**: How to handle host.yaml settings after install?

## Related Documents

- Previous full-packaging plan: `CC/docs/plans/json-tools-apworld-plan.md`
- Repository changes: `docs/json/developer/diffs/repository-changes.md`
- Core file diffs: `docs/json/developer/diffs/core-files.diff`

---

**Created:** 2025-01-04
**Status:** Draft - Awaiting Review
