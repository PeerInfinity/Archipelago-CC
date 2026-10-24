# JSON Panel

The JSON panel lets you save, load, and manage all of your app configuration and game state in one place. Use it to back up your progress, transfer a session to another device, or switch between different game setups.

## What You Can Save

Use the checkboxes to choose which items to include in save/load operations. **Check All** and **Uncheck All** are available for convenience.

| Item | What it contains |
|------|-----------------|
| **Rules Config** | The game's logic and location data (rules.json). Saving this lets you fully restore a game on another device or after clearing your browser. |
| **Module Config** | Which panels and modules are loaded (modules.json). |
| **Layout Config** | The arrangement of panels on screen. Layout changes can be applied live or take effect after reloading the page. |
| **User Settings** | Your application preferences (settings.json). |
| **Snapshot (Full State)** | Your complete game state: inventory, checked locations, and reachability data. This is the main thing to save when you want to continue a session later. Unchecked by default. |
| **Game State (Inv/Checks)** | A minimal version of the above containing only inventory and checked locations. Unchecked by default since Snapshot already covers everything it contains. |

Other modules may add their own entries to this list (for example, the Tests module adds its configuration).

Each item has an **Edit** button that sends that item's data to the Editor panel, where you can inspect, modify, and apply it back with the green **Apply** button.

## Saving and Loading

### Save/Load as a File

- **Save Combined to File** — Downloads the selected data as a `.json` file to your computer. Good for backups or sharing a session with someone else.
- **Load Combined from File** — Opens a `.json` file you previously saved and applies it. Game state, rules, and settings are applied immediately; layout changes are applied live. Settings in the file also **replace** the current mode's saved settings; the other sections are not saved in your browser until you use **Save to LocalStorage**.

### Export/Import via the Editor

- **Export to Text** — Sends the selected data to the [Editor](./editor.md) panel as JSON text, where you can inspect or edit it before applying.
- **Import from Text** — Reads JSON from the Editor panel and applies it. Paste your JSON into the Editor first, then click this button. As with loading a file, settings in it replace the current mode's saved settings, and the other sections are not saved until you use **Save to LocalStorage**.

### When a layout is applied live

Applying a Layout Config live (from a file or from the Editor) replaces the panel arrangement without closing any panel. Afterwards, a panel that has a tab in the new layout counts as open, and a panel whose tab the new layout dropped counts as closed. The [Modules](./modules.md) panel's checkboxes and the [Quick Launch](./quickLaunch.md) panel's open/closed dots follow the new layout. Opening a panel that is already in the layout brings its tab to the front; it does not add a second tab.

### Save to Browser (LocalStorage)

- **Save to LocalStorage** — Saves the selected data under a mode name in your browser and makes that mode the last active mode. This persists across sessions. With **Auto-load Mode** on (the default), opening the app with a plain address (no `?mode=`) loads it; `?mode=<name>` loads it at any time. Appears at the top of the panel with a green button. See [Saved Settings and Auto-load Mode](../tips-and-tricks.md#saved-settings-and-auto-load-mode).

### Reset Default Mode

- **Reset Default Mode** — Clears the saved default mode from your browser and reloads the app to its base state. Use this if the app becomes stuck or won't load correctly. Appears at the top of the panel with a red button.

## Managing Modes

A "mode" is a named configuration saved in your browser. You can have multiple modes for different games or setups.

- **Known Modes in LocalStorage** — Lists all modes you have saved in your browser. Click **Load** to make a mode the last active mode: with **Auto-load Mode** on (the default), the next time you open the app with a plain address (no `?mode=`) it opens in that mode. Click **Delete** to remove a mode permanently.
- **Known Modes in modes.json** — Lists predefined modes that came with the app. Click **Load** to switch to one (reloads the page).

The **Mode Name** field at the top of the panel sets the name used when saving to LocalStorage or in exported files.
