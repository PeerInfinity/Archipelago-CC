# Tips, Tricks, and FAQs

This guide provides a collection of useful tips, advanced interactions, and answers to frequently asked questions to help you get the most out of the JSON Web Client.

## Automation Buttons (`Begin!` & `Quick Check`)

In the center **"Console & Status"** panel, you will find two buttons for automating location checks. These buttons work whether you are connected to an Archipelago server or playing offline with a loaded `rules.json` file.

- **`Quick Check` Button:** Immediately finds one accessible, unchecked location and checks it for you. This is useful for quickly clearing out a known check without having to find it in the list.

- **`Begin!` Button:** Starts a timer that automatically triggers the `Quick Check` functionality at random intervals. This is great for passively checking locations while you focus on other tasks. Clicking the button again (it will say "Stop") will halt the timer.

## Console Commands

The console in the center panel accepts a few client-specific commands, even when you aren't connected to a server.

- `/set_delay [min] [max]`
  Sets the minimum and maximum delay (in seconds) for the `Begin!` button's automatic timer. If you only provide one number (e.g., `/set_delay 10`), the delay will be fixed at that value.

- `/help`
  Displays a list of available local console commands.

## Advanced Item & Location Interactions

- **Removing Items (Shift+Click):** To remove an item from your inventory or decrease its count, hold the **SHIFT** key while clicking on it in the Inventory panel. This only affects your local tracker state and is useful for testing logic or correcting mistakes.

- **Clicking Locations:** In the standard tracking mode, clicking a location card in the "Locations" tab will perform an immediate check for that location. If you are connected to a server, this will send the check to the server.

- **Clicking Exits:** In the standard tracking mode, clicking an exit card in the "Exits" tab does nothing. Its purpose is purely informational.

- **Clickable Links:** Throughout the interface, region names are underlined. These are clickable links that will take you directly to that region's entry in the "Regions" view, allowing you to quickly analyze its connections.

## Customizing the UI

- **Rearranging Panels:** The entire interface is customizable. You can click and drag panel tabs to move them, drop them on top of each other to create stacks, or drag them to the edges of other panels to create new columns and rows. Your layout is saved automatically in your browser for your next session.

- **Hiding the Console:** The center "Console & Status" panel can be hidden to create more space. Click the "Hide Console" button in its top-right corner. A "Show Console" button will then appear in the top-right of the Inventory panel to bring it back. The console is hidden by default on smaller screens.

## Frequently Asked Questions (FAQs)

**Q: Do I need both the `.archipelago` file and `rules.json`?**
A: Yes, for the full online experience. Your game client (e.g., SNES emulator, PC game client) uses the `.archipelago` file to know what items are in your world. This web client uses the `rules.json` file to understand the logic and accessibility rules of your game.

**Q: Can I use this without connecting to a server?**
A: Absolutely. Load your `rules.json` file, and the application works as a powerful offline tracker. You can manually add items to your inventory and use all the accessibility analysis and pathfinding tools.

**Q: How does "Analyze Paths" in the Regions view work?**
A: It uses a search algorithm to find all possible sequences of region connections from your starting point to the target region you are analyzing. It then examines the access rules for every exit along those paths and compiles a list of all the items or conditions you are missing to make the path fully accessible.
