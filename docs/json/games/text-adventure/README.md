# Text Adventure

A classic text-based interface for navigating any Archipelago world. Type commands or click interactive links to explore regions, search locations, and collect items.

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

Clicking a green link executes the corresponding move or check command.

### Discovery Mode

When discovery mode is active, only previously discovered locations and exits appear in region descriptions. Explore to reveal more of the world.

### Custom Flavor Text

A dropdown menu lets you load game-specific description files that add narrative flavor text to regions and locations, transforming the generic tracker into a themed text adventure.

## Compatibility

Text Adventure mode works with any Archipelago game that has been exported to JSON. The interface adapts to whatever regions, locations, and exits the game defines.

## Further Reading

- [User guide](../../user/modules/textAdventure.md)
- [Technical reference](../../developer/modules/textAdventure.md)
