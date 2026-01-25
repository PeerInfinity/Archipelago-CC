# JSON Tools Installer APWorld

An APWorld package that provides tools for installing, updating, and managing JSON Tools for Archipelago.

## Overview

This installer allows vanilla Archipelago users to easily install the JSON Tools suite (exporter, rule builder, world generator, frontend) without needing to clone or manage the full development repository.

## Features

- **Download Tools**: Fetch JSON Tools from GitHub (stable or development versions)
- **Automatic Patching**: Patch core Archipelago files with backup/restore capability
- **Version Detection**: Automatically detect AP version and offer compatible patches
- **GUI Integration**: Kivy-based GUIs integrated into Archipelago Launcher
- **CLI Support**: Full command-line interface for scripted/headless usage
- **Monkey Patching**: Runtime patching fallback for unsupported AP versions

## Installation

### Option 1: Install as APWorld

1. Download `json_tools_installer.apworld` from the [`apworlds/`](../../apworlds/) directory in this repository
2. Place in your Archipelago `worlds/` directory (or use the APWorld installer)
3. Restart Archipelago

### Option 2: From Source

If you have the Archipelago-CC repository:
```bash
python scripts/build/pack_json_tools_installer.py
```
The APWorld will be created in `apworlds/json_tools_installer.apworld`.

## Usage

### Via Archipelago Launcher

After installation, new components appear in the Launcher:

- **JSON Tools Installer**: Main installation/update GUI
- **JSON Tools Status**: Check installation status and version info
- **JSON Tools Scripts**: Run utility scripts

### Via Command Line

```bash
# Install stable version with default components
python -m worlds.json_tools_installer install

# Install development version with all components
python -m worlds.json_tools_installer install --version dev --all

# Install specific components
python -m worlds.json_tools_installer install --frontend --presets

# Check installation status
python -m worlds.json_tools_installer status

# Check status with full configuration details
python -m worlds.json_tools_installer status --verbose --config

# Uninstall
python -m worlds.json_tools_installer install --uninstall

# Revert patches only (keep tools)
python -m worlds.json_tools_installer install --revert-patches
```

### Direct CLI Module

```bash
# Alternative: run the install CLI directly
python -m worlds.json_tools_installer.cli.install [options]
python -m worlds.json_tools_installer.cli.status [options]
```

## Components

The installer can install these components:

| Component | Description | Default |
|-----------|-------------|---------|
| `exporter` | Export game logic to JSON format | Yes |
| `rule_builder` | Build access rules from JSON definitions | Yes |
| `world_generator` | Generate world packages from JSON rules | Yes |
| `frontend` | Web UI for viewing game logic (excludes presets) | Yes |
| `presets` | Pre-generated game data (~75MB, requires frontend) | No |
| `docs` | JSON Tools documentation | Yes |
| `scripts` | Utility scripts for testing and setup | Yes |
| `main_patches` | Patched core files for JSON export support | Yes |
| `romless_patches` | Patched world files for generation without ROMs | Yes |
| `demo_worlds` | Example worlds (bakingadventure, codingadventure, etc.) | Yes |
| `tracker` | PopTracker integration world for auto-tracking | No |
| `testing` | Test config files (package.json, playwright, vitest) | No |
| `worldgen_worlds` | Auto-generated world packages from JSON rules (~15MB) | No |

## Version Sources

- **Stable**: `PeerInfinity/Archipelago` @ `JSONExport` branch
- **Development**: `PeerInfinity/Archipelago-CC` @ `main` branch

Configure custom sources:
```bash
python -m worlds.json_tools_installer config --stable-repo owner/repo --stable-branch branch
python -m worlds.json_tools_installer config --dev-repo owner/repo --dev-branch branch
```

## Patching Methods

The installer supports three patching modes:

### 1. Monkey Patching (Default)
Runtime patching that hooks into Archipelago's core functions without modifying any files. This is the safest option and works across AP versions:
```bash
# Default - no flag needed
python -m worlds.json_tools_installer install
```

### 2. File-Based Patching
Replaces core Archipelago files with patched versions. Original files are backed up and can be restored. Requires confirmation before applying:
```bash
python -m worlds.json_tools_installer install --file-patch

# Skip confirmation prompt
python -m worlds.json_tools_installer install --file-patch --yes
```

**Files modified by file-based patching:**
- `Main.py` - Entry point for seed generation
- `BaseClasses.py` - Core Archipelago classes
- `settings.py` - Settings management

### 3. No Patching
Skip all patching. JSON export will not work without manual setup:
```bash
python -m worlds.json_tools_installer install --no-patch
```

### GUI Patch Options
In the installer GUI, you'll see three checkboxes under "Apply patches after download:":
- **Monkey patch** (checked by default) - Runtime hooks
- **Main patches** - File-based patching (mutually exclusive with monkey patch)
- **ROM-less patches** - Additional patches for testing without ROM files

## Backup and Restore

The installer automatically backs up original files before patching:
- Backups are stored in `json_tools_backups/`
- Original file hashes are recorded in the configuration
- Use `--revert-patches` to restore originals

## Configuration

Configuration is stored in `json_tools_config.json`:

```json
{
  "sources": {
    "stable": {
      "repo": "PeerInfinity/Archipelago",
      "branch": "JSONExport"
    },
    "dev": {
      "repo": "PeerInfinity/Archipelago-CC",
      "branch": "main"
    }
  },
  "installation": {
    "version": "stable",
    "components": ["exporter", "rule_builder", "world_generator", "frontend", "docs", "scripts"],
    "installed_at": "2025-01-04T12:00:00",
    "commit_hash": "abc123..."
  },
  "patches": {
    "method": "monkey",
    "backups": [],
    "applied_at": null,
    "romless_applied": false
  }
}
```

## Supported AP Versions

| AP Version | Support Level | Method |
|------------|---------------|--------|
| 0.6.5 | Full | File patches |
| 0.6.x | Full | File patches |
| 0.5.x | Experimental | Monkey patches |
| < 0.5.0 | Unsupported | N/A |

## Troubleshooting

### "Cannot reach GitHub"
Check your internet connection. The installer needs to download files from GitHub.

### "No bundled patches for version X"
Your AP version doesn't have pre-made patches. This is fine - monkey patching (the default) works across all versions. If you specifically need file-based patches:
- Use the default monkey patching (no flags needed)
- Or check if patches are available for your version in `json_tools_patches/`

### "File already patched"
Use `--revert-patches` first, then reinstall:
```bash
python -m worlds.json_tools_installer install --revert-patches
python -m worlds.json_tools_installer install
```

### Reverting to Original Files
```bash
python -m worlds.json_tools_installer install --revert-patches
```

## Development

### Building the APWorld

```bash
python scripts/build/pack_json_tools_installer.py
```

### Testing Imports

```python
from worlds.json_tools_installer import JSONToolsInstallerWorld
from worlds.json_tools_installer.config import load_config, save_config
from worlds.json_tools_installer.installer import detect_ap_version, download_archive
from worlds.json_tools_installer.monkey_patches import install_hooks
```

### Project Structure

```
worlds/json_tools_installer/
├── __init__.py           # Hidden world stub
├── __main__.py           # CLI entry point
├── archipelago.json      # APWorld manifest
├── config.py             # Configuration management
├── components.py         # Launcher components
├── requirements.txt      # Python dependencies for this module
├── README.md             # This file
├── installer/
│   ├── __init__.py
│   ├── version_detector.py  # AP version detection
│   ├── downloader.py        # GitHub download
│   ├── extractor.py         # Archive extraction
│   ├── patcher.py           # Main file patching
│   └── romless_patcher.py   # ROM-less world patching
├── cli/
│   ├── __init__.py
│   ├── install.py        # Install CLI
│   └── status.py         # Status CLI
├── gui/
│   ├── __init__.py
│   ├── installer_gui.py  # Install/update GUI
│   ├── status_gui.py     # Status GUI
│   └── scripts_gui.py    # Scripts GUI
└── monkey_patches/
    ├── __init__.py
    └── hooks.py          # Runtime patching hooks

# Patches are downloaded to (not bundled in the module):
json_tools_patches/
└── 0.6.5/
    ├── main/             # Main patches (Main.py, BaseClasses.py, settings.py)
    └── romless/          # ROM-less world patches
```

## License

This project is part of Archipelago and follows its licensing terms.
