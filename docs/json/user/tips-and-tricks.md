# Tips, Tricks, and FAQs

This guide provides a collection of useful tips, advanced interactions, and answers to frequently asked questions to help you get the most out of the JSON Web Client.

## Automation Buttons (`Begin` & `Quick Check`)

In the center **"Console & Status"** panel, you will find two buttons for automating location checks. These buttons work whether you are connected to an Archipelago server or playing offline with a loaded `rules.json` file.

- **`Quick Check` Button:** Immediately finds one accessible, unchecked location and checks it for you. This is useful for quickly clearing out a known check without having to find it in the list.

- **`Begin` Button:** Starts a timer that automatically triggers the `Quick Check` functionality at random intervals. Clicking the button again (it will say "Stop") will halt the timer.

## Console Commands

The console in the center panel accepts a few client-specific commands, even when you aren't connected to a server.

- `/set_delay [min] [max]`
  Sets the minimum and maximum delay (in seconds) for the `Begin` button's automatic timer. If you only provide one number (e.g., `/set_delay 10`), the delay will be fixed at that value.

- `/help`
  Displays a list of available local console commands.

## Advanced Item & Location Interactions

- **Removing Items (Shift+Click):** To remove an item from your inventory or decrease its count, hold the **SHIFT** key while clicking on it in the Inventory panel. This only affects your local tracker state and is useful for testing logic or correcting mistakes.

- **Clicking Locations:** In the standard tracking mode, clicking a location card in the "Locations" tab will perform an immediate check for that location. If you are connected to a server, this will send the check to the server.

- **Clicking Exits:** In the standard tracking mode, clicking an exit card in the "Exits" tab does nothing. Its purpose is purely informational.

- **Clickable Links:** Throughout the interface, region names are underlined. These are clickable links that will take you directly to that region's entry in the "Regions" view, allowing you to quickly analyze its connections.

## Customizing the UI

- **Rearranging Panels:** The entire interface is customizable. You can click and drag panel tabs to move them, drop them on top of each other to create stacks, or drag them to the edges of other panels to create new columns and rows.

- **Closing and Reopening Modules:** Clicking the X button in the top right of any panel will close that panel and disable its module.  To reopen the module and its panel, open the Modules panel, find the checkbox for the module that you want to reopen, and check it.  You might need to manually move the reopened panel to the location that you want it to be.

- **Additional Tabs:** If several panels are in the same stack of tabs, there might not be enough room for the UI to display the tabs for all of the panels.  If this happens, then there will be a down arrow in the top right of the panel, labeled "additional tabs".  Clicking on this arrow will show the tabs that were hidden because there wasn't enough room for them.

- **Reset settings:** If you want to reset all of the settings to the defaults, one way to do this is by clicking the "Reset Default Mode" button in the JSON panel.  Another way to reset the settings to the defaults is by adding "?mode=reset" to the page's URL.

## Saved Settings and Auto-load Mode

- **Every setting you change is saved in your browser straight away**, under the current mode (the `?mode=` in the address, or `default`). Only the setting you changed is written; everything you saved before stays as it was.
- **Auto-load Mode** (Options panel → *Mode Persistence*) is **on** by default. While it is on:
  - Opening the app with a plain address (no `?mode=`) reopens your **last active mode** with its saved settings. The last active mode is the one the JSON panel's *Save to LocalStorage* or *Known Modes → Load* last set, or the Editor's *Loaded Mode Data* apply; if none of those has happened, it is `default`.
  - Once a mode has saved settings, they are used **instead of** the shipped `settings.json`. A later change to that file does not reach you until you reset (below).
- **To turn Auto-load off:** open the app with a plain address, open the Options panel, and under *Mode Persistence* choose **No** for *Auto-load Mode*. That choice is saved like any other setting, so it stays off after a reload. With it off, a plain address starts from `settings.json`; your saved settings are kept (a setting you change meanwhile is added to them, nothing else is overwritten), and they come back when you choose **Yes** again, or straight away with `?mode=default`.
- An address that names a mode (`?mode=loops`) always loads that mode's saved settings, whether Auto-load is on or off.
- **Starting fresh:** `?reset=true` clears the saved data of the mode it opens (`?reset=true&mode=loops` for another mode) and forgets the last active mode; `?mode=reset` does the same for the `default` mode, as does the JSON panel's *Reset Default Mode*. The Options panel's *Reset to Defaults* replaces the current mode's saved settings with the defaults.
- **Running a test mode by hand:** the `test-*` modes (for example `?mode=test-regression`) keep saved settings too, and the tests change settings while they run. So the second time you open that address in the same browser, it starts from whatever the first run left behind. Open `?reset=true&mode=test-regression` instead to run it from a clean state. The automated test runs (`npm test`) open a fresh browser every time and are not affected.

## Frequently Asked Questions (FAQs)

**Q: Do I need both the `.archipelago` file and `rules.json`?**
A: Yes, for the full online experience. The Archipelago server uses the `.archipelago` file to run a networked game. This web client uses the `rules.json` file to understand the logic and accessibility rules of your game.

**Q: Can I use this without connecting to a server?**
A: Yes. Load your `rules.json` file, and the application works as a powerful offline tracker. You can manually add items to your inventory and use all the accessibility analysis and pathfinding tools.

**Q: How does "Analyze Paths" in the Regions view work?**
A: It uses a search algorithm to find all possible sequences of region connections from your starting point to the target region you are analyzing. It then examines the access rules for every exit along those paths and compiles a list of all the items or conditions you are missing to make the path fully accessible.

**Q: Which repository should I use?**
A: It depends on what you want to do:

- **Just want to use the tracker with your existing Archipelago installation?**
  Install the **[JSON Tools Installer APWorld](../../../worlds/json_tools_installer/README.md)**. Download [`json_tools_installer.apworld`](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/json_tools_installer.apworld) and place it in your Archipelago `worlds/` directory. After restarting Archipelago, new components appear in the Launcher for installing and managing the JSON Tools. The installer automatically configures your `host.yaml` with the necessary export settings - choose the "Minimal spoilers" preset during installation to enable JSON export. This adds JSON export to your existing installation without needing to clone anything - generate games normally and the `rules.json` files will be created automatically.

- **Want to run a local development setup from source?**
  Clone **[PeerInfinity/Archipelago](https://github.com/PeerInfinity/Archipelago)** (JSONExport branch). This is a clean snapshot that's periodically updated. Recommended for most users who need the full source code.

- **Want to contribute to this project's development?**
  Clone **[PeerInfinity/Archipelago-CC](https://github.com/PeerInfinity/Archipelago-CC)**. This is the active development repository with full commit history. Note: The history includes large files from development sessions, so clone size is larger.

- **Want to contribute features back to the main Archipelago project?**
  Fork **[ArchipelagoMW/Archipelago](https://github.com/ArchipelagoMW/Archipelago)** and copy the relevant directories. See [Repository Changes](../developer/diffs/repository-changes.md) for details on what to copy.
