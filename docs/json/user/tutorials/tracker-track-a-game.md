# Track a game

The app is also a tracker for an ordinary Archipelago game: it knows the game's logic, so it can show which locations you can reach with the items you have — and, connected to the multiworld's server, it follows your game as you play.

This tutorial uses an exported seed of *A Link to the Past*; every step works the same with your own game's logic.

## Your game's logic

1. Generate your multiworld with this project's Archipelago (a checkout of this repository, or the `JSONExport` branch of Archipelago). Besides the usual multiworld `.zip`, it exports each game's logic as `AP_<seed>_rules.json` (in this repository, under `frontend/presets/<game>/AP_<seed>/`).

   ```
   python Generate.py
   ```
2. Open the **Presets** tab and press **Load File**, then choose that `_rules.json`. No game of your own yet? The seed buttons load games exported the same way — **Do it** presses **1** beside *A Link to the Past*, the game the rest of this tutorial uses.

## Items

1. Open the **Inventory** tab and tick **Show unowned items** (if it is not ticked already): the items you do not have yet appear, greyed out. (This tutorial uses the plain list, so it unticks **Show categories** if it is ticked.)
2. Click **Progressive Glove**: you have it now — the first one is the Power Glove, which lifts light rocks, so new places open up. (Shift-click takes one away.)

Connected to a server, the items you receive arrive here by themselves.

## Locations

1. Open the **Locations** tab: a card for every location, coloured by whether you can reach it with what you have.
2. Type **Blind** in the search box: the five chests of Blind's Hideout.
3. Click **Blind's Hideout - Left** to mark it checked. A checked card is hidden unless **Show checked** is ticked.
4. Clear the search box.

## Exits and regions

1. Open the **Exits** tab and search for **Death Mountain Entrance Rock**: with the glove, the rock is liftable, so the exit is *traversable*.
2. Clear the search box.
3. Open the **Regions** tab: the regions along your path from where the game begins, each with its exits and locations and the rule that guards each one.
4. To look further, click **Controls**, tick **Show All Regions**, and type **Light World** in the search box.
5. Click the **Light World** header to unfold it: its exits and locations, coloured by whether you can reach them.
6. Clear the search box, untick **Show All Regions**, and fold **Controls** again.

## Connect to your game's server

Tracking by hand works with no server at all. To follow a live game, connect to the multiworld's server — here a LOCAL one, started from the `.zip` you generated.

1. Start a local server on your multiworld. It listens on port 38281; leave it running.

   ```
   python MultiServer.py output/AP_<seed>.zip
   ```
2. Open the **Console** tab, check the **Server Address** says `ws://localhost:38281`, and press **Connect**. When it asks for your slot name, type the name in your player file. The status turns to *Connected*: the items you receive and the locations you check now arrive by themselves.

## Next

Each of the tracker's other panels has a short tutorial of its own: the Path Analyzer, the Region Graph, Dungeons, Helpers, the Spoiler Checklist, the Timer and the Editor.

The **Presets** tab holds exported seeds of dozens of games to explore the same way.

<!-- GENERATED from frontend/modules/tutorials/content/tracker/trackAGame.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
