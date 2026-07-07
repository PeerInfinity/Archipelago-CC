# Metamath Setup Guide

## Prerequisites

> **⚠️ MetaMath works best when running Archipelago from source (Python).** The
> easiest way to get a working source setup is the
> [Archipelago-CC](https://github.com/PeerInfinity/Archipelago-CC) repository,
> which already includes MetaMath and the JSON Tools frontend — see
> [Running From Source](../../../docs/running%20from%20source.md).
>
> The compiled `.exe` release also works: the JSON Tools Installer (which
> MetaMath needs anyway) installs the `metamath-py` dependency automatically —
> see [Install Dependencies](#3-install-dependencies). (Verified on the
> Windows `.exe`; the Linux `AppImage` uses the same layout but is untested.)

### Required Software
- **Archipelago** — from source (recommended), or the compiled `.exe` release with the manual dependency step described below
- **Python** 3.11.9 or newer, but less than 3.14 — not the Windows Store version
- **git** — required by Archipelago's module installer to fetch some dependencies
- **JSON Export Tools** — MetaMath is played entirely through the JSON Tools web client, which requires a `rules.json` file produced during seed generation. Install the tools using the [JSON Tools Installer apworld](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/json_tools_installer.apworld) (recommended) or by [cloning the repository](../../../docs/json/user/overview.md). See the [JSON Tools Installer README](../../json_tools_installer/README.md) for full setup instructions.
- **metamath-py** library — installed automatically **only** when the `metamath` folder is placed in your source checkout's `worlds/` directory; otherwise install it manually (see [Install Dependencies](#3-install-dependencies))

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

> **Compiled `.exe` note:** the Demo Worlds component currently has no effect on
> compiled installs (it extracts to a directory those installs never load) — use
> the MetaMath apworld in `custom_worlds/` as described in the next step instead.
> The core JSON Tools components (exporter, dependencies) install correctly on
> compiled installs.

See the [JSON Tools overview](../../../docs/json/user/overview.md) for alternative setup methods.

### 2. Install the Metamath World (if not using the installer)

If you installed via the JSON Tools Installer with Demo Worlds enabled, MetaMath is already installed and you can skip this step.

Otherwise, download the [MetaMath apworld](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/metamath.apworld) and place it in your Archipelago `custom_worlds/` directory, then restart the Launcher.

You can also place the `metamath` folder directly in your Archipelago `worlds` directory. **This is the recommended option for source users**, because Archipelago's module installer will then install the `metamath-py` dependency automatically (an apworld in `custom_worlds/` does not — see [Install Dependencies](#3-install-dependencies)):

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

MetaMath requires the `metamath-py` Python package. How it gets installed depends on where you put the world:

- **`metamath` folder in `worlds/`** (recommended for source users): Archipelago's
  module installer picks up `worlds/metamath/requirements.txt` automatically the next
  time you run `ModuleUpdate.py`, the Launcher, or `Generate.py` — press Enter when it
  prompts to install missing modules.
- **apworld in `custom_worlds/`**: the automatic installer does **not** scan apworlds,
  so the dependency is **never** installed for you. You must install it manually from
  your Archipelago source folder:

  ```bash
  python -m pip install metamath-py
  ```

- **Compiled `.exe` release**: run the **JSON Tools Installer** from the Launcher
  (with the MetaMath apworld already in `custom_worlds/`). Its install step scans
  every apworld in `custom_worlds/` for a `requirements.txt` and installs the
  missing packages — including `metamath-py` — into the release's `lib/` folder
  using the bundled pip. Restart the Launcher afterwards so the MetaMath world
  loads with its dependency present.

  If you'd rather not use the installer, the package can also be placed by hand —
  `metamath-py` is pure Python with no dependencies of its own:

  1. Download the `.whl` file from [PyPI](https://pypi.org/project/metamath-py/#files)
  2. A `.whl` is a zip archive — rename it to `.zip` (or open it directly) and extract it
  3. Copy the extracted `metamathpy` folder into your Archipelago install's `lib/`
     folder (e.g. `C:\ProgramData\Archipelago\lib\metamathpy`)

  `lib/` is the only folder on the compiled release's Python module path, which is
  why the package must go there rather than next to the apworld.

> If MetaMath is missing from the Launcher's "Generate Template Options" output, the
> Options Creator, or the `Players/Templates` folder, a missing `metamath-py` is
> almost always the cause. See [Troubleshooting](#troubleshooting).

### 4. Metamath Database Setup

The Metamath database (`set.mm`) is needed to parse theorem proofs. You have three options:

#### Option A: Automatic Download (Recommended)
Enable `auto_download_database: true` in your YAML config. The database will be downloaded automatically on first use and saved to `Archipelago/metamath_data/set.mm`, where later generations find it again.

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

### Where your files are saved

The `rules.json` is copied into a `frontend/presets/` subfolder — **but which subfolder depends on how you generated the seed.** This trips people up, so check the right place:

| Your seed | `rules.json` is saved to |
|---|---|
| Single game, randomized placement | `frontend/presets/metamath/AP_<seed>/` |
| Single game, **vanilla item placement** | `frontend/presets/metamath_vanilla/AP_<seed>/` |
| **Multiworld** (MetaMath + other games) | `frontend/presets/multiworld/AP_<seed>/` |

In the **multiworld** folder you'll find a combined `AP_<seed>_rules.json` plus one per player (`AP_<seed>_P<n>_rules.json`). Use the file for your MetaMath player — open it and check the `game_name` field near the top — or just load the combined file.

> Note: the `rules.json` is **not** included inside the generated `.zip` archive (so the archive can still be hosted on archipelago.gg). It lives only in `frontend/presets/`.

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

1. Open the JSON Tools web client (see the [Quick Start Guide](../../../docs/json/user/quick-start.md))
2. Load your preset — in the **Presets** panel click **Load File** and choose the `rules.json` from the folder above (or, when hosting the frontend locally, pick it directly from the Presets panel). It should report success and show **Metamath** near the top.
3. The Proof Queue and Proof Graph panels populate with your chosen theorem.
4. **To connect to a server** (required for a multiworld, or any time you want a text client): open the **Console** tab, select the server address, and click **Connect** — and **leave the Console tab open**; closing it disconnects you. A single-player, non-multiworld game does **not** need a server.

## Troubleshooting

### Common Issues

**MetaMath is missing from "Generate Template Options", the Options Creator, or the `Players/Templates` folder**
- This means the MetaMath world failed to load. World load failures are **silent** —
  Archipelago logs the error and skips the world — so every *other* game gets a
  template and MetaMath simply doesn't appear.
- The usual cause is a missing `metamath-py` dependency:
  - **Using the compiled `.exe`?** Run the JSON Tools Installer (it installs
    apworld dependencies automatically), or place the `metamathpy` package into
    the install's `lib/` folder by hand (see
    [Install Dependencies](#3-install-dependencies)). Then restart the Launcher.
  - **Running from source?** Install the dependency with
    `python -m pip install metamath-py`, or place the `metamath` folder in
    `worlds/` so it installs automatically. Then restart the Launcher.

**`ModuleNotFoundError: No module named 'metamathpy'`**
- The `metamath-py` package is not installed. From source, run
  `python -m pip install metamath-py`; on the compiled `.exe`, run the JSON
  Tools Installer or extract the package into `lib/` as described in
  [Install Dependencies](#3-install-dependencies).

**"I generated a seed but `rules.json` isn't in `frontend/presets/metamath/`"**
- It was generated — it's just in a different subfolder. **Vanilla item placement** saves to
  `frontend/presets/metamath_vanilla/`, and a **multiworld** (2+ games) saves to
  `frontend/presets/multiworld/`. See [Where your files are saved](#where-your-files-are-saved).
- It is intentionally **not** placed inside the output `.zip` archive.

**"Could not load multidata. File may be corrupted or incompatible." when hosting on archipelago.gg**
- This was caused by older generations bundling `rules.json` / sphere-log files inside the
  `.zip`, which the stock server can't parse. It is fixed in current Archipelago-CC — re-download
  and regenerate if you still hit it.

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