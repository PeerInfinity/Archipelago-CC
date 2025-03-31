# ArchipIDLE-JSON User Guide

ArchipIDLE-JSON extends the ArchipIDLE web client with features based on your game's exported rules (`rules.json`). It helps you track your progress, understand location accessibility, and explore the game world logically. It also includes an optional incremental game mode called ArchipIDLE Loops.

## Getting Started

### Quick Start

1.  Visit [ArchipIDLE-JSON](https://peerinfinity.github.io/Archipelago/).
2.  The client loads with a default ALttP ruleset. Explore the interface in **Locations** or **Regions** view (right panel).
3.  Click items in the **Inventory** panel (left) to see how accessibility changes.
4.  When ready to play your own game:
    *   Generate your game via Archipelago to get an `.archipelago` file and a `rules.json` file.
    *   In ArchipIDLE, click **"Load JSON"** (top right) and select your `rules.json`.
    *   Connect to your server using the **Server Address** input and the console (middle panel).

### Loading Your Game Data

-   **`rules.json`:** Contains all location/exit access rules, region connections, and item data. Loading this enables intelligent tracking features.
-   **`.archipelago` file:** Contains your specific world's data (item placements, etc.). While ArchipIDLE doesn't load this directly, connecting to the server syncs this information.

## Interface Overview

### Layout

-   **Left Panel:** Inventory Management.
-   **Center Panel:** Standard Archipelago Console (connect, chat, commands). Progress bar for location check timer.
-   **Right Panel:** Main interaction area with multiple views (Locations, Exits, Regions, Loops, Files).

### Inventory Panel (Left)

-   Items are grouped by category (can be toggled to a flat list).
-   **Click:** Add an item to your inventory. If connected to a server, this sends a `!getitem` command.
-   **SHIFT+Click:** Remove an item from your inventory (local only).
-   Item counts are displayed on buttons.
-   Adding/removing items automatically updates the accessibility status in the right panel views.
-   Controls: Hide unowned items, hide categories, sort alphabetically.

### Console & Progress (Center)

-   Standard Archipelago text console for server interaction.
-   Input commands (e.g., `/connect server:port`, `/help`, game-specific commands).
-   Progress bar shows the countdown timer for automatic location checks when the timer is running (`Begin!`/`Stop` button).
-   The `Checks Sent` text displays statistics about locations (Checked/Total, Reachable, Unreachable, Events Checked/Total).
-   `Begin!` button starts the timer to automatically check reachable locations at random intervals (configurable via `/set_delay` command).
-   `Quick Check` button immediately checks one reachable, unchecked location.

### Main Views (Right Panel Tabs)

#### Locations View

-   Displays a grid of all game locations.
-   Each location card shows:
    *   Name (Clickable to show details modal)
    *   Player #
    *   Region (Clickable link to navigate to the Region View)
    *   Accessibility Status (Color-coded: Green=Reachable, Red=Unreachable, Gray=Checked, Yellow/Orange=Partially Blocked)
    *   Access Rule (visual logic tree).
-   **Controls:** Sort (Original, Accessibility), Filter (Show Checked/Reachable/Unreachable/Explored [Loop Mode Only]), Adjust Columns.

#### Exits View

-   Similar grid view, but showing region exits/transitions.
-   Each exit card shows:
    *   Source Region → Exit Name → Destination Region
    *   Player #
    *   Accessibility Status (Traversable/Not Traversable)
    *   Access Rule (visual logic tree).
-   **Controls:** Similar sorting and filtering as Locations View.

#### Regions View

-   Displays regions as collapsible blocks.
-   Each block shows:
    *   Region Name & Properties (Light/Dark World).
    *   **Exits:** Lists exits with links to connected regions and Move buttons (inactive in this mode). Includes access rules.
    *   **Locations:** Lists locations within the region with check buttons (inactive in this mode). Includes access rules.
    *   **Analyze Paths:** Button to perform path analysis. Shows potential paths from start regions, highlighting blocking conditions and required items.
-   **Controls:** Show All Regions (ignores navigation chain), Expand/Collapse All.

#### Loops View

-   Activates the **ArchipIDLE Loops** incremental game mode.
-   See the [Loop Mode Guide](/docs/json/archipidle-loops.md) for details.

#### Files View

-   Load predefined **Test Cases** for verifying rule logic.
-   Load game **Presets** (e.g., vanilla item placements) for offline exploration or testing.

## Key Features (Standard Mode)

-   **Automatic Event Collection:** When a location containing an Event item (like Pendants, Crystals) becomes accessible based on rules and inventory, the client automatically adds the event item to your state. This can unlock further locations.
-   **Accessibility Analysis:** The logic trees displayed for locations and exits show exactly which conditions (items, helpers, state flags) are passing or failing based on your current inventory.
-   **Path Discovery:** In the Regions view, the "Analyze Paths" button performs a search from the starting region(s) to the target region. It displays possible paths and analyzes the rules for all exits along those paths, compiling a list of required items or conditions needed to make the path traversable.
-   **Progressive Items:** Tracks items like Swords, Gloves, Bows correctly, understanding that `Progressive Sword` grants `Fighter Sword`, then `Master Sword`, etc.
-   **Interactive Navigation:** Click on region names or location names throughout the UI to jump directly to their detailed view in the Regions or Locations tabs.

## Tips & Tricks

-   Use Shift+Click in the inventory to decrement item counts or remove single-count items.
-   Use the "Analyze Paths" feature in the Regions view to understand complex routing requirements.
-   Use the `/set_delay X Y` command in the console to change the min/max delay (in seconds) for the automatic location check timer. Use `/set_delay X` for a fixed delay.
-   Load a `rules.json` file even when playing offline to use the tracking features.

## Common Questions

**Q: Do I need both the `.archipelago` file and `rules.json`?**
A: Load `rules.json` into ArchipIDLE for tracking features. Connect to the server (which uses your `.archipelago` file) for multiworld play and item syncing.

**Q: Can I use this without connecting to a server?**
A: Yes! Load your `rules.json` to use the inventory tracking, location/region views, and path analysis features entirely offline. Loop Mode also works offline.

**Q: How does "Analyze Paths" work?**
A: It uses a search algorithm (BFS/DFS) to find sequences of connected regions from your starting point(s) to the target region. It then examines the access rules for every exit along those paths to determine which items or conditions are required to make the entire path accessible.

**Q: What are the different colors on location/exit cards?**
A:
    *   **Green:** Reachable/Traversable (Region is reachable AND access rule passes).
    *   **Red:** Unreachable/Blocked (Either region is unreachable OR access rule fails, OR both).
    *   **Gray:** Checked (Location has been checked).
    *   **Yellow/Orange:** Partially Blocked (e.g., Region is reachable but the location/exit rule fails, or vice-versa). Hover or click for details.

**Q: What is Loop Mode?**
A: It's an alternative, incremental game mode where you automate actions within time loops to progress through the game. See the [Loop Mode Guide](/docs/json/archipidle-loops.md).
