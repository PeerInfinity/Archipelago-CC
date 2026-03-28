# Metamath Setup Guide

## Prerequisites

### Required Software
- **Archipelago** 0.6.4 or later
- **Python** 3.8 or later
- **JSON Export Tools** — MetaMath is played entirely through the JSON Tools web client, which requires a `rules.json` file produced during seed generation. Install the tools using the [JSON Tools Installer apworld](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/json_tools_installer.apworld) (recommended) or by [cloning the repository](../../../docs/json/user/overview.md). See the [JSON Tools Installer README](../../json_tools_installer/README.md) for full setup instructions.
- **metamath-py** library (automatically installed)

### Optional Downloads
- **Metamath Database** (`set.mm`, ~50MB) - Can be auto-downloaded or manually placed

## Installation Steps

### 1. Install JSON Export Tools

MetaMath has no standalone game client — it is played through the JSON Tools web client. Before installing MetaMath itself, you need the JSON Export Tools suite so that seed generation produces the `rules.json` file the client needs.

The easiest method is the [JSON Tools Installer apworld](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/json_tools_installer.apworld):

1. Download the file and place it in your Archipelago `custom_worlds/` directory
2. Restart the Archipelago Launcher
3. Open **JSON Tools Installer** from the Launcher and click Install

The installer's **Demo Worlds** component includes MetaMath, so both JSON Tools and the MetaMath world can be installed in one step.

See the [JSON Tools overview](../../../docs/json/user/overview.md) for alternative setup methods.

### 2. Install the Metamath World (if not using the installer)

If you installed via the JSON Tools Installer with Demo Worlds enabled, MetaMath is already installed and you can skip this step.

Otherwise, download the [MetaMath apworld](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/metamath.apworld) and place it in your Archipelago `custom_worlds/` directory, then restart the Launcher.

You can also place the `metamath` folder directly in your Archipelago `worlds` directory:

```
Archipelago/
├── worlds/
│   ├── metamath/           # <- Place here
│   │   ├── __init__.py
│   │   ├── Items.py
│   │   ├── Locations.py
│   │   ├── Options.py
│   │   ├── Rules.py
│   │   ├── requirements.txt
│   │   └── docs/
│   └── ...other worlds...
```

### 3. Install Dependencies

The required Python libraries will be installed automatically when you first generate a game. If you want to install them manually:

```bash
pip install metamath-py numpy
```

### 4. Metamath Database Setup

The Metamath database (`set.mm`) is needed to parse theorem proofs. You have three options:

#### Option A: Automatic Download (Recommended)
Enable `auto_download_database: true` in your YAML config. The database will be downloaded automatically on first use.

#### Option B: Manual Download
1. Download from: https://us.metamath.org/metamath/set.mm
2. Create directory: `Archipelago/metamath_data/`
3. Place `set.mm` in that directory

#### Option C: Disable Download
Set `auto_download_database: false` to use only hardcoded proofs (limited theorems available).

## Creating Your Configuration

### 1. Basic YAML Template

Create a file `Players/YourName.yaml`:

```yaml
name: YourName
description: My Metamath Adventure
game: Metamath
requires:
  version: 0.6.4

Metamath:
  # Core Settings
  vanilla_placement: false  # Set true to keep items in original locations
  randomize_items: true  # Enable item randomization
  theorem: 2p2e4  # Which theorem to prove
  randomize_starting_statements: true  # Random starting statements
  starting_statements: 0  # Percentage to start with (0-50)

  # Database Settings
  auto_download_database: true
```

### 2. Choose Your Theorem

You can specify theorems in three ways:

```yaml
# Method 1: Direct theorem name
theorem: 2p2e4

# Method 2: URL to metamath.org
theorem: https://us.metamath.org/mpeuni/2p2e4.html

# Method 3: Weighted random selection (using relative weights)
theorem:
  2p2e4: 50  # Weight 50 (50% probability when total=100)
  1p1e2: 30  # Weight 30 (30% probability when total=100)
  3p3e6: 20  # Weight 20 (20% probability when total=100)
```

### 3. Adjust Difficulty

Control the challenge level:

```yaml
# Easier settings
randomize_starting_statements: false  # Sequential starting statements
starting_statements: 30  # Start with 30% of proof unlocked

# Harder settings
randomize_starting_statements: true   # Random starting statements
starting_statements: 0  # Start with nothing unlocked
```

## Generating Your Game

With JSON Export Tools installed, seed generation automatically produces a `rules.json` file alongside the normal `.archipelago` output. This is what the JSON Tools web client uses to track your game.

### Using the Archipelago Launcher

1. Open the Archipelago Launcher
2. Click "Generate"
3. Select your YAML file
4. Choose output location
5. Click "Generate!"

### Using Command Line

```bash
python Generate.py --weights_file_path "Players/YourName.yaml"
```

### Playing Your Game

1. Start the Archipelago server with the generated `.archipelago` file
2. Open the JSON Tools web client (see the [Quick Start Guide](../../../docs/json/user/quick-start.md))
3. Load the generated preset — the Proof Queue and Proof Graph panels appear automatically

## Troubleshooting

### Common Issues

**"No module named 'metamath-py'"**
- Run: `pip install metamath-py`

**"Could not find set.mm database"**
- Enable `auto_download_database: true` in your YAML
- Or manually download set.mm as described above

**"Theorem not found in database"**
- Check spelling of theorem name
- Verify theorem exists at https://us.metamath.org/
- The system will fall back to 2p2e4 if theorem is not found

**"Not enough locations for progression items"**
- This is a bug that should be fixed now
- Report if it still occurs with theorem name

### Database Loading Time

The first generation with a new theorem takes 5-10 seconds to parse the database. This is normal. Subsequent generations may be faster due to caching.

## Verifying Installation

Test with a simple generation:

```yaml
# test.yaml
name: TestPlayer
game: Metamath

Metamath:
  theorem: 1p1e2  # Simple 2-step proof
  auto_download_database: true
```

If generation succeeds and creates an output file, installation is complete!

## Next Steps

- Read the [Gameplay Guide](gameplay.md) to understand how to play
- Check the [Settings Guide](settings.md) for all configuration options
- Explore available theorems at [metamath.org](https://us.metamath.org/)