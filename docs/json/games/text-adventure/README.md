# Text Adventure

**[Live demo](https://peerinfinity.github.io/Archipelago-CC/?mode=textadventure)**

A classic text-based interface for navigating any Archipelago world. Type commands or click interactive links to explore regions, search locations, and collect items.

## Quick Start

Open the live demo link above, or add `?mode=textadventure` to any JSON Tools URL. The default mode loads the Adventure game (seed 1) with discovery mode enabled and custom flavor text auto-loaded.

## How to Play

The text adventure presents the Archipelago tracker as an interactive fiction experience. You see descriptions of your current region, available exits, and locations you can search.

### Commands

| Command | Description |
|---------|-------------|
| `look` | Describe the current region |
| `move <exit>` | Move to a connected region |
| `check <location>` | Check a location for items |
| `inventory` | Show collected items |
| `help` | List available commands |

Commands are case-insensitive and support partial matching (exact matches take priority).

### Interactive Links

Locations and exits are displayed as clickable links:
- **Green** — accessible (you can reach it)
- **Red** — inaccessible (missing requirements)

Clicking a green link executes the corresponding move or check command. You can also click regions in the Region Graph panel to navigate.

### Discovery Mode

The text adventure mode enables discovery mode by default. Only previously discovered locations and exits appear in region descriptions. Regions are discovered when you enter them, and locations and exits within are automatically revealed.

### Custom Flavor Text

A dropdown menu lets you load game-specific description files that add narrative flavor text to regions and locations, transforming the generic tracker into a themed text adventure. In the default text adventure mode, the Adventure custom data is auto-loaded.

### Layout

The default text adventure layout has three columns:
- **Left** — Inventory, JSON, Modules
- **Center** — Region Graph, Console, Presets, Editor, Game State
- **Right** — Text Adventure, Options

The Region Graph shows your world as an interactive map with path highlighting as you move between regions. The Game State panel shows your current region and full path history.

## Compatibility

Text Adventure mode works with any Archipelago game that has been exported to JSON. The interface adapts to whatever regions, locations, and exits the game defines. Custom flavor text files can be created for any game.

## Configuration

The text adventure mode configures the following settings:

| Setting | Value | Description |
|---------|-------|-------------|
| Discovery mode | Enabled | Only discovered regions/locations visible |
| Region discovery trigger | On enter | Regions discovered when player enters |
| Auto-discover locations | Yes | Locations revealed when region entered |
| Auto-discover exits | Yes | Exits revealed when region entered |
| Auto-load custom data | _(unset)_ | Adventure flavor text is auto-detected from the game name; no explicit setting needed |
| Show region in panel | No | Clicking graph navigates instead of showing region panel |

## Further Reading

- [User guide](../../user/modules/textAdventure.md)
- [Technical reference](../../developer/procgen/text-adventure.md)
