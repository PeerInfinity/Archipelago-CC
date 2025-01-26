# Archipidle-json User Guide

Archipidle-json extends the Archipidle client with location tracking based on game rules. It helps you track your progress and find available locations in your Archipelago game.

## Getting Started

### Quick Start
1. Visit [Archipidle-json](https://peerinfinity.github.io/archipelago/)
2. Try out the interface with the default ruleset
3. When ready to play, load your game's rules.json file

### Loading Your Game
When you generate a game through Archipelago, two files are created:
- Your .archipelago file (game data)
- A rules.json file (location access rules)

To use Archipidle-json:
1. Click "Load JSON" in the top right
2. Select your rules.json file
3. The interface will update with your game's locations

## Interface Overview

### Layout
- Left: Inventory management
- Center: Archipidle console
- Right: Location tracking

### Inventory Panel
- Items are organized by category
- Click items to add them to your inventory
- Multiple clicks track item count
- Items automatically update available locations

### Location Panel
Controls:
- Sort: Change location display order
- Show Checked: Toggle completed locations
- Show Reachable: Toggle available locations
- Show Unreachable: Toggle locked locations
- Show Highlights: Toggle hilighting newly available locations

Location cards show:
- Location name
- Region
- Status (Available/Locked/Checked)
- Required items (click for details)
(details not yet finalized)

### Console Integration
The classic Archipidle console remains available for:
- Server connection
- Command input
- Game progress tracking

All inventory and location changes sync with console state.
(not fully implemented yet)

## Common Questions

Q: Do I need both files (.archipelago and rules.json)?
A: Yes, they serve different purposes. Load both to get full functionality.

Q: Can I use this without connecting to a server?
A: Yes! The location tracking works offline. Server connection adds multiplayer features.

Q: How do I remove items?
A: Currently through console commands. Quick removal coming soon.

## Need Help?

- Check the Archipelago Discord
- Report issues on GitHub
- Contribute improvements
- Share feedback!