# Diff Files from Upstream

This directory contains diff files showing changes made to this repository compared to the upstream Archipelago repository at commit `886cc68051f23d6049f8d846379b193aa0415e24` (November 29, 2025, version 0.6.5-rc1).

## Available Diff Files

### 1. `core-files.diff` (178 lines)
Changes to the main Archipelago core files:
- **BaseClasses.py** - Core data structures and sphere logging modifications
- **Main.py** - Main generation logic, vanilla placement trigger, JSON export, and workflow changes
- **settings.py** - Configuration settings for JSON export, sphere logging, and skip_required_files

These are the most significant changes that affect core Archipelago functionality.

### 2. `config-files.diff` (151 lines)
Changes to configuration and repository setup files:
- **.gitattributes** - Git attribute configurations (merge strategy for .gitignore and README.md)
- **.github/workflows/codeql-analysis.yml** - Code analysis workflow modifications (added permissions)
- **.gitignore** - Ignore patterns for project-specific files (extensive additions)
- **pytest.ini** - Test configuration (added warning filters)
- **requirements.txt** - Python dependency modifications (added astunparse, psutil)

These files configure the development environment and CI/CD pipeline.

### 3. `world-init-files.diff` (494 lines)
Changes to world implementation initialization files to support `skip_required_files` mode:
- **worlds/alttp/__init__.py** - A Link to the Past
- **worlds/apsudoku/__init__.py** - AP Sudoku
- **worlds/dkc3/__init__.py** - Donkey Kong Country 3
- **worlds/ff1/__init__.py** - Final Fantasy I
- **worlds/lufia2ac/__init__.py** - Lufia II Ancient Cave
- **worlds/mmbn3/__init__.py** - Mega Man Battle Network 3
- **worlds/oot/__init__.py** - Ocarina of Time
- **worlds/smw/__init__.py** - Super Mario World
- **worlds/soe/__init__.py** - Secret of Evermore
- **worlds/tloz/__init__.py** - The Legend of Zelda
- **worlds/yoshisisland/__init__.py** - Yoshi's Island

These modifications allow world generation to proceed without ROM files when `skip_required_files` is enabled, enabling JSON export for games without requiring their base ROMs.

## How to Use These Diffs

### Viewing Changes
```bash
# View a diff file
less docs/json/developer/diffs/core-files.diff

# Or with syntax highlighting
git diff --no-index /dev/null docs/json/developer/diffs/core-files.diff
```

### Applying Changes
To apply these changes to a fresh upstream checkout:
```bash
# From repository root
git apply docs/json/developer/diffs/core-files.diff
git apply docs/json/developer/diffs/config-files.diff
git apply docs/json/developer/diffs/world-init-files.diff
```

### Reviewing Specific Files
To see changes for a specific file:
```bash
# Example: View just BaseClasses.py changes
grep -A 999999 "diff --git a/BaseClasses.py" docs/json/developer/diffs/core-files.diff | \
  grep -B 999999 "^diff --git" | head -n -1
```

## Notes

- These diffs were last updated on 2026-01-14 against upstream commit `886cc68051f23d6049f8d846379b193aa0415e24`
- Total lines changed across all diffs: 823 lines (178 + 151 + 494)
- These diffs only include modifications to existing files that also exist in upstream
- New files and new directories are not included in these diffs
- For a complete list of all changes, see [repository-changes.md](./repository-changes.md)

## When to Use These Diffs

**Contributing to upstream Archipelago or maintaining your own clean fork:** Fork the [main ArchipelagoMW repository](https://github.com/ArchipelagoMW/Archipelago), copy the new directories from this repository, and apply these diffs.

**Contributing to this project (Archipelago-CC):** You don't need these diffs. Just clone or fork normally. The commit history contains large files which will increase clone size, but won't affect your work.

## Alternative: JSON Tools Installer APWorld

If you just want to **use** the JSON Tools with an existing Archipelago installation (rather than maintaining a fork), there's an easier option: the **JSON Tools Installer APWorld**.

### What It Does

The JSON Tools Installer is a packaged APWorld that automatically:
- Downloads the JSON Tools suite (exporter, rule builder, world generator, frontend)
- Patches your Archipelago core files with backup/restore capability
- Integrates with the Archipelago Launcher (adds GUI components)
- Detects your AP version and applies compatible patches

### Quick Start

1. Download [`json_tools_installer.apworld`](https://github.com/PeerInfinity/Archipelago-CC/blob/main/apworlds/json_tools_installer.apworld)
2. Place it in your Archipelago `worlds/` directory
3. Restart Archipelago
4. Use the new "JSON Tools Installer" component in the Launcher

Or via command line:
```bash
# Install stable version
python -m worlds.json_tools_installer install

# Install development version with all components
python -m worlds.json_tools_installer install --version dev --all

# Check status
python -m worlds.json_tools_installer status
```

### Components Available

| Component | Description | Default |
|-----------|-------------|---------|
| `core` | Exporter, rule_builder, world_generator modules | Yes |
| `scripts` | Utility scripts (setup, test, build) | Yes |
| `frontend` | Web-based frontend for presets | No |
| `presets` | Preset configurations (requires frontend) | No |
| `docs` | Documentation files | No |

### Version Sources

- **Stable**: `PeerInfinity/Archipelago` @ `JSONExport` branch
- **Development**: `PeerInfinity/Archipelago-CC` @ `main` branch

### When to Use the Installer vs Diffs

| Use Case | Recommended Approach |
|----------|---------------------|
| End user wanting JSON export features | JSON Tools Installer |
| Maintaining your own fork of Archipelago | Apply diffs manually |
| Contributing to upstream Archipelago | Apply diffs manually |
| Development/testing on vanilla AP | JSON Tools Installer |
| CI/CD pipelines | Either (installer supports CLI) |

For full documentation, see [worlds/json_tools_installer/README.md](../../../../worlds/json_tools_installer/README.md).

## Diff Generation Command

These diffs were created using:
```bash
git diff 886cc68051f23d6049f8d846379b193aa0415e24 HEAD -- [files...] > [output.diff]
```

## Related Documentation

- **[repository-changes.md](./repository-changes.md)** - Complete overview of all changes from upstream
- **[fuzzer-modifications.md](./fuzzer-modifications.md)** - Changes made to the Archipelago fuzzer
- **[universal-tracker-modifications.md](./universal-tracker-modifications.md)** - Changes made to Universal Tracker
- **[rule-builder-modifications.md](./rule-builder-modifications.md)** - Changes made to Rule Builder
- **[JSON Tools Installer](../../../../worlds/json_tools_installer/README.md)** - APWorld for automated installation on vanilla Archipelago
- **[Main README](../../../../README.md)** - Project overview and getting started guide
