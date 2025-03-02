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
- Right: Location/region tracking

### Inventory Panel

- Items are organized by category
- Click items to add them to your inventory
- SHIFT+click to remove items
- Multiple clicks track item count
- Items automatically update available locations

### View Modes

The interface offers three view modes:

#### Locations View

- Grid of all game locations
- Color-coded by accessibility status
- Clickable to check and collect items
- Sortable and filterable

#### Regions View

- List of game regions with exits and entrances
- Path discovery to visualize routes to regions
- Exit rule visualization to identify blocking conditions
- Interactive navigation between regions

#### Test Cases View

- Available test cases for validation
- Run individual or all tests
- See test results and summaries

### Location Panel Features

Controls:

- Sort: Change location display order
- Show Checked: Toggle completed locations
- Show Reachable: Toggle available locations
- Show Unreachable: Toggle locked locations
- Show Highlights: Toggle highlighting newly available locations
- Column adjustments: Change display grid

Location cards show:

- Location name (clickable for details)
- Region name (clickable for navigation)
- Status (Available/Locked/Checked)
- Access rules (expandable)

### Region Panel Features

Controls:

- Show All Regions: Toggle between visited chain and all regions
- Expand/Collapse All: Toggle region block expansion

Region blocks show:

- Region name and properties
- Exits with accessibility status
- Locations within the region
- Path discovery via "Show Paths" button
- Exit rule visualization via "Show Exit Rules"
- Compiled list of blocking conditions

### Console Integration

The classic Archipidle console remains available for:

- Server connection
- Command input
- Game progress tracking

## Features

### Automatic Event Collection

When a location containing an event item becomes accessible, the system automatically collects it, which may in turn make other locations accessible.

### Interactive Navigation

Click on region or location names throughout the interface to navigate directly to them, allowing easy exploration of the game world.

### Path Discovery

The "Show Paths" button in region view displays possible paths from starting regions to the target region, with visualization of blocking conditions.

### Progressive Item Handling

The system properly tracks progressive items like swords and gloves, understanding their relationships and requirements.

### Accessibility Analysis

The "Compile List" feature provides a consolidated view of all items and conditions preventing access to a region.

## Tips & Tricks

- Use SHIFT+click to remove items from your inventory
- Click region names to navigate directly to that region
- Use "Show Paths" in region view to find routes to a location
- Use "Compile List" to quickly identify required items
- The "Test Cases" view can help verify behavior for specific locations

## Common Questions

Q: Do I need both files (.archipelago and rules.json)?
A: Yes, they serve different purposes. Load both to get full functionality.

Q: Can I use this without connecting to a server?
A: Yes! The location tracking works offline. Server connection adds multiplayer features.

Q: How does the "Show Paths" feature work?
A: It finds routes from start regions to the target region, showing which exits are blocking progress.

Q: What does the "Compile List" button do?
A: It analyzes all failing exit rules and produces a consolidated list of items or conditions needed to access the region.

## Coming Soon

The following features are planned for future updates:

- Integration with the Archipidle console timer
- Server connection and multiplayer features
- Queueing system for state updates
- Additional helper functions
- Shop data integration
- Event items for bosses
- Options to disable automatic event collection

## Need Help?

- Check the Archipelago Discord
- Report issues on GitHub
- Contribute improvements
- Share feedback!
