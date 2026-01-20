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
| `core` | Exporter, rule_builder, world_generator modules | Yes |
| `scripts` | Utility scripts (setup, test, build) | Yes |
| `frontend` | Web-based frontend for presets | No |
| `presets` | Preset configurations (requires frontend) | No |
| `docs` | Documentation files | No |

## Version Sources

- **Stable**: `PeerInfinity/Archipelago` @ `JSONExport` branch
- **Development**: `PeerInfinity/Archipelago-CC` @ `main` branch

Configure custom sources:
```bash
python -m worlds.json_tools_installer config --stable-repo owner/repo --stable-branch branch
python -m worlds.json_tools_installer config --dev-repo owner/repo --dev-branch branch
```

## Patching Methods

The installer supports three patching approaches:

### 1. Archive Patches (Default)
Extracts patched files from the downloaded archive. Best for matching versions.

### 2. Bundled Patches
Uses pre-made patches bundled with the installer for specific AP versions:
```bash
python -m worlds.json_tools_installer install --use-bundled-patches
```

### 3. Monkey Patching
Runtime patching without modifying files. Used as fallback for unsupported versions:
```bash
python -m worlds.json_tools_installer install --monkey-patch
```

## Backup and Restore

The installer automatically backs up original files before patching:
- Backups are stored in `json_tools_backups/`
- Original file hashes are recorded in the configuration
- Use `--revert-patches` to restore originals

## Configuration

Configuration is stored in `json_tools_config.json`:

```json
{
  "stable_source": {
    "repo": "PeerInfinity/Archipelago",
    "branch": "JSONExport"
  },
  "dev_source": {
    "repo": "PeerInfinity/Archipelago-CC",
    "branch": "main"
  },
  "installation": {
    "version": "stable",
    "components": ["core", "scripts"],
    "installed_at": "2025-01-04T12:00:00",
    "commit_hash": "abc123..."
  },
  "patches": {
    "method": "file",
    "backups": [...]
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
Your AP version doesn't have pre-made patches. Try:
- Use `--monkey-patch` for runtime patching
- Download from archive instead of using bundled patches

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
├── installer/
│   ├── version_detector.py  # AP version detection
│   ├── downloader.py        # GitHub download
│   ├── extractor.py         # Archive extraction
│   ├── patcher.py           # File patching
│   └── patches/             # Bundled patch files
│       └── 0.6.5/
├── cli/
│   ├── install.py        # Install CLI
│   └── status.py         # Status CLI
├── gui/
│   ├── installer_gui.py  # Install/update GUI
│   ├── status_gui.py     # Status GUI
│   └── scripts_gui.py    # Scripts GUI
└── monkey_patches/
    ├── __init__.py
    └── hooks.py          # Runtime patching hooks
```

## License

This project is part of Archipelago and follows its licensing terms.
