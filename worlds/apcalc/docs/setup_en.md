# APCalc Setup Guide

## Prerequisites

### Required Software
- **Archipelago** 0.6.4 or later
- **Python** 3.8 or later
- **JSON Export Tools** — APCalc is played through the JSON Tools web client, which requires a `rules.json` file produced during seed generation. Install the tools using the [JSON Tools Installer apworld](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/json_tools_installer.apworld) (recommended) or by [cloning the repository](../../../docs/json/user/overview.md). See the [JSON Tools Installer README](../../json_tools_installer/README.md) for full setup instructions.

No additional libraries are required — APCalc has no external dependencies.

## Installation Steps

### 1. Install JSON Export Tools

APCalc has no standalone game client — it is played through the JSON Tools web client. Before installing APCalc itself, you need the JSON Export Tools suite so that seed generation produces the `rules.json` file the client needs.

The easiest method is the [JSON Tools Installer apworld](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/json_tools_installer.apworld):

1. Download the file and place it in your Archipelago `custom_worlds/` directory
2. Restart the Archipelago Launcher
3. Open **JSON Tools Installer** from the Launcher and click Install

See the [JSON Tools overview](../../../docs/json/user/overview.md) for alternative setup methods.

### 2. Install the APCalc World

Place the `apcalc` folder in your Archipelago `worlds` directory:

```
Archipelago/
├── worlds/
│   ├── apcalc/
│   │   ├── __init__.py
│   │   ├── Items.py
│   │   ├── Locations.py
│   │   ├── Options.py
│   │   ├── generator/
│   │   │   ├── generator.py
│   │   │   └── export.py
│   │   └── docs/
│   └── ...other worlds...
```

## Creating Your Configuration

### Basic YAML Template

Create a file `Players/YourName.yaml`:

```yaml
name: YourName
description: My APCalc Game
game: APCalc
requires:
  version: 0.6.4

APCalc:
  num_spheres: 8
  ops_per_sphere: 1
  nums_per_sphere: 2
  trash_per_sphere: 1
  max_branches: 5
  randomize_items: true
```

### Configuration Options

#### Generation Settings

These control the size and shape of the procedurally generated puzzle:

| Option | Default | Range | Description |
|--------|---------|-------|-------------|
| `num_spheres` | 8 | 3-15 | Number of generation spheres (including sphere 0). More spheres = more locations and deeper puzzle chains. The first 4 spheres each introduce one operation (+, -, \*, /). |
| `ops_per_sphere` | 1 | 1-3 | Operation buttons awarded per sphere. |
| `nums_per_sphere` | 2 | 1-5 | Digit buttons awarded per sphere. More digits = longer multi-digit operands. |
| `trash_per_sphere` | 1 | 0-5 | Junk filler items per sphere (no gameplay effect). |
| `max_branches` | 5 | 2-10 | Maximum outgoing edges per node. Higher values create more interconnected puzzles. |

#### Randomization

| Option | Default | Description |
|--------|---------|-------------|
| `randomize_items` | true | When enabled, button items are shuffled into the multiworld item pool — you'll find APCalc buttons in other players' worlds and vice versa. When disabled, each location contains the button item the generator originally assigned to it, creating a standalone puzzle with a fixed solution. |

### Game Size Guide

The total number of locations is approximately `num_spheres * (ops_per_sphere + nums_per_sphere + trash_per_sphere)`, plus extra nodes from the final sphere.

| Style | Spheres | Approx. Locations |
|-------|---------|-------------------|
| Quick | 3-4 | 12-20 |
| Standard | 8 | 60-80 |
| Long | 12-15 | 100-150+ |

### Example Configurations

```yaml
# Quick solo puzzle (no randomization)
APCalc:
  num_spheres: 4
  randomize_items: false

# Standard multiworld game
APCalc:
  num_spheres: 8
  randomize_items: true

# Large, interconnected puzzle
APCalc:
  num_spheres: 12
  nums_per_sphere: 3
  max_branches: 8
```

## Generating Your Game

```bash
python Generate.py --weights_file_path "Players/YourName.yaml"
```

Every seed produces a different puzzle. The same seed with the same options always produces the same puzzle.

## Playing Your Game

1. Start the Archipelago server with the generated `.archipelago` file
2. Open the JSON Tools web client (see the [Quick Start Guide](../../../docs/json/user/quick-start.md))
3. Load the generated preset — the APCalc panel and Region Graph appear automatically

### How to Play

You start with a few digit buttons that let you reach the first layer of target numbers. As you collect more buttons from the multiworld, you can compute your way to deeper layers.

**Calculator basics:**
- Press a number then `=` to reach a layer-0 node from Start
- From any node, press an operation, enter a number, then `=` to compute and move deeper
- Each button press consumes one use of that button
- Press Clear to return to Start and restore all button presses

**The core puzzle:** budget your button presses across an entire path. You may have enough buttons to reach node A *or* node B, but not both in the same path — you'll need to Clear and choose.

**Progression:** operations unlock gradually — `+` first, then `-`, `*`, and `/` in later spheres. Each new operation opens up new regions of the graph.

For a detailed gameplay guide, see the [APCalc game documentation](../../../docs/json/games/apcalc/README.md).

## Verifying Installation

Test with a simple generation:

```yaml
# test.yaml
name: TestPlayer
game: APCalc

APCalc:
  num_spheres: 4
```

If generation succeeds and creates an output file, installation is complete.

## Further Reading

- [APCalc game documentation](../../../docs/json/games/apcalc/README.md) — gameplay mechanics, difficulty modes, interface guide
- [APCalc design document](../../../CC/docs/plans/apcalc-plan.md) — original design and rationale
- [V2 strategic redesign](../../../CC/docs/plans/apcalc-v2-design.md) — multi-path and multi-digit design
