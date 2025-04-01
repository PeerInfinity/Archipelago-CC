# Archipelago Loops - User Guide

Archipelago Loops is an incremental game mode built into the JSON web client. Inspired by games like _Idle Loops_, _Increlution_, and _Stuck In Time_, it transforms playing through an Archipelago world into an automated, loop-based progression system.

## The Concept

You are caught in a time loop, fueled by a regenerating resource called **Mana**. Performing actions costs Mana. When your Mana runs out, the loop resets, sending you back to the start with your mana refilled, but crucially, **you retain your inventory, discovered knowledge, and region experience (XP)**.

Your goal is to strategically build an **Action Queue** within each loop. This queue automates exploring regions, checking locations for items, and moving between regions. With each loop, you leverage your persistent items (which increase Max Mana) and Region XP (which reduces Mana costs) to explore further, discover more, and ultimately achieve your Archipelago game goals.

## Core Mechanics

### 1. The Loop & Mana

- **Mana:** Your primary resource for performing actions. Starts at a base maximum (e.g., 100). Regenerates fully at the start of each loop.
- **Max Mana:** Increases permanently for each item you acquire (+10 Max Mana per item by default, including event items).
- **Loop Reset:** Occurs automatically when Mana hits zero. Can also be triggered manually via the "Restart" button in the Loop controls.
  - **Resets:** Current Mana refills to max, current action progress resets, the Action Queue restarts from the beginning.
  - **Persists:** Your full Inventory, all gained Region XP, and the discovered status of all Regions, Locations, and Exits.

### 2. The Action Queue

- Managed in the "Loops" tab (right panel). This is your main interaction point.
- Actions are added to the queue by clicking buttons within **Region Blocks**.
- The queue processes actions **sequentially**, one at a time.
- Actions are visually grouped within the Region Block where they occur.
- **Removing a "Move to Region" action automatically removes all subsequent actions in the queue that depended on reaching that destination region.** This prevents invalid queue states.

### 3. Actions

Actions are queued via buttons in the Region Blocks and consume Mana over time as they execute.

- **Explore Region:**
  - Gradually reveals _undiscovered_ Item Locations and Exits within the current Region.
  - Progress persists across loops (if you run out of mana mid-explore, you'll resume from that point next loop).
  - Costs Mana (Default: 50 Mana for a reveal).
  - Revealing an Exit also discovers the Region it leads to.
  - Exploring a fully revealed region grants **Region XP**.
  - **Repeat Explore Action:** A checkbox per region allows this action to be automatically re-queued upon completion, useful for gaining XP or waiting for discoveries.
- **Check Location:**
  - Attempts to access a _discovered_ Item Location.
  - Requires the standard Archipelago access rules for that location to be met by your current persistent inventory.
  - Costs Mana (Default: 100 Mana).
  - Success grants the item permanently (if any) and marks the location as checked.
- **Move to Region:**
  - Uses a _discovered_ Exit to travel to an adjacent Region.
  - Requires the standard Archipelago access rules for that exit to be met.
  - Costs Mana (Default: 10 Mana).
  - Adds the destination Region Block to the UI panel if it wasn't already present.
  - Queuing a move collapses the current region block in the UI.
  - Only one pending "Move" action can be queued per region block instance in the UI.

### 4. Region XP & Mana Costs

- Each Region has its own Experience (XP) level, gained by spending Mana on actions within that region.
- Gaining levels in a Region grants a **Mana Cost Discount** for all actions performed _in that Region_.
  - Default Formula: `FinalCost = BaseCost / (1 + Level * 0.05)` (Effectively 5% reduction per level, minimum cost of 5 Mana).
- Region XP persists across loops.
- XP progress, level, and the current discount are displayed in each Region Block header.

### 5. Discovery System

- Separate from Archipelago's concept of accessibility (rule checking). Tracks whether you have _encountered_ a Region, Location, or Exit within Loop Mode.
- Starts with only the "Menu" Region discovered.
- **Explore** actions discover Locations and Exits within the current region.
- Discovering an Exit also discovers the Region it leads to.
- Discovery status **persists across loops**.
- In Loop Mode, UI elements (Region Blocks, action buttons) corresponding to undiscovered things will be hidden or shown as "???".

### 6. Items & Persistence

- Inventory Items obtained (via Check Location actions or received from the multiworld server) are permanent and persist across loops.
- Items increase your Max Mana.
- Items are required to meet the access rules for checking locations and using exits, just like in standard Archipelago play.

### 7. Archipelago Integration

- The game world (Regions, Locations, Exits, Items, Access Rules) is defined by the loaded `rules.json` data.
- The standard Archipelago Console (center panel) remains functional for server commands, chat, etc.
- Works seamlessly with randomized Archipelago seeds.

## User Interface (Loop Mode Active)

### Main Layout

- Retains the standard JSON Web Client layout (Inventory Left, Console Center, Views Right).
- The **Loops** tab becomes the primary interaction panel.

### Loop Panel (Right Panel - Loops Tab)

- **Fixed Header Area:** (Stays at the top)
  - **Mana Bar:** Shows Current / Max Mana. Color changes indicate low mana.
  - **Current Action Display:** Shows the name, mana cost progress, and queue position (e.g., "Action 3 of 10") of the currently executing action. Shows "No action in progress" if idle.
- **Scrollable Area:**
  - Contains **Region Blocks** for regions currently relevant to the Action Queue (i.e., regions where actions are queued or regions that are destinations of queued moves).
  - Regions only appear here once they are discovered _and_ an action is queued within them or a move action targets them.
- **Region Blocks:**
  - **Header:** Region Name, Expand/Collapse Button.
  - **XP Display:** Shows Level, XP progress bar, XP values (Current/Needed), and Mana Cost Discount %.
  - **Discovery Stats:** Shows Exploration %, Locations Discovered (X/Y), Exits Discovered (X/Y).
  - **Actions Area:**
    - `Explore Region` / `Farm Region XP` button.
    - `Repeat Explore Action` checkbox.
  - **Locations Container:** Lists discovered locations in this region. Each has a `Queue Check` button (enabled if accessible). Checked locations show a checkmark. Undiscovered locations shown as "???".
  - **Exits Container:** Lists discovered exits from this region. Each shows the destination region (or "???" if undiscovered) and has a `Queue Move` button (enabled if accessible). Undiscovered exits shown as "???".
  - **Queued Actions Container:** Lists actions queued specifically for _this instance_ of the region block in the queue. Each shows:
    - Action Name.
    - Progress Bar & Text (Mana progress, Queue position).
    - Status (Pending, Active, Completed).
    - Remove ('X') button.

### Other Panels (Loop Mode Active)

- **Locations / Exits / Regions Tabs:** These views still function but primarily reflect the _discovered_ state. Elements corresponding to undiscovered regions/locations/exits might be hidden or shown as "???". Clicking elements generally has no effect; interaction happens via the Loop Panel.
  - A "Show Explored" checkbox becomes available in these views to filter visibility based on Loop Mode discovery.
- **Inventory Panel:** Items are visible and update Max Mana. Clicking items has no direct effect on the loop itself (inventory persists automatically). Shift+Click still works locally but is generally not needed.
- **Files Panel:** Disabled while Loop Mode is active.

### Loop Controls (In Right Panel Header when Loops tab is active)

- **Enter/Exit Loop Mode:** Toggles the loop gameplay on/off.
- **Pause/Resume:** Halts/continues Action Queue processing and Mana drain.
- **Restart:** Manually triggers a Loop Reset (refills Mana, restarts queue from beginning).
- **Speed Slider:** Adjusts the rate of Mana consumption and action progress (0.5x to 100x).
- **Auto-Restart Toggle:** Switches between "Pause when queue complete" and "Restart when queue complete".
- **Expand/Collapse All:** Expands or collapses all _currently visible_ Region Blocks in the Loop Panel.
- **(Bottom Bar):** Clear Queue, Save/Load Game, Export/Import State, Hard Reset.

## Getting Started Gameplay Flow

1.  Load your `rules.json` file into the JSON Web Client or use the preset data.
2.  Connect to your server if playing multiworld.
3.  Switch to the **Loops** tab in the right panel.
4.  Click **"Enter Loop Mode"**.
5.  You'll initially see only the **Menu** Region Block.
6.  Click **"Explore Region"** in the Menu block to add the first action to your queue. Observe Mana decreasing and the action progressing in the fixed header.
7.  As exploration reveals exits (e.g., to "Light World"), they will appear in the Menu block's Exits list.
8.  Click the **"Queue Move"** button for the "Light World" exit. This adds a move action to the queue and collapses the Menu block. A new "Light World" Region Block will appear once the move action starts processing.
9.  Expand the "Light World" block (if it's not already expanded). Click **"Explore Region"** to discover locations and exits within it.
10. If a location (e.g., "Link's House") is revealed and its rules are met by your inventory, click its **"Queue Check"** button.
11. Continue building your Action Queue across regions.
12. When Mana hits zero, the loop resets automatically. Your queue restarts, processing actions faster now due to gained Region XP (reducing Mana costs) and potentially higher Max Mana (from found items).
13. Refine your queue over subsequent loops to explore more efficiently and reach your game goals. Use the **"Repeat Explore Action"** checkbox strategically to farm XP or wait for discoveries.

## Tips

- Use **"Repeat Explore Action"** in early regions to gain levels and reduce Mana costs significantly.
- Removing a **Move** action cleans up dependent actions automatically, making queue adjustments easier.
- Prioritize finding items, as they permanently increase your Max Mana, allowing for longer loops.
