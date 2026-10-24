# Flash Panel

The Flash Panel plays **Seedling** — the original Flash game, recompiled to run in the browser — as part of an Archipelago world. Opening a chest or picking up an item in the game checks that location, and the items the world gives you appear in the game. It plays the whole original game as the world *Seedling Playthrough*, and it plays the Seedling rooms of a world from the [Procgen Pipeline](procgenPipeline.md).

## Starting the game

1. Load a world that has Seedling in it — for example **Seedling Playthrough** (seed 1) in the [Presets](presets.md) panel, or the page with `?game=seedling_playthrough&seed=1`.
2. Open the **Flash Panel** tab. The status beside its title reads *loading config…*, then *loading wasm page…*, then *click ▶ Start in the game*. The first time, the browser has to fetch the game, which takes a moment.
3. Press **▶ Start** in the game. While the world's rooms load, the game is covered by a note such as *delivering N randomized room(s)…*; the status moves on to *configured* and then *ready*.

With a world that has no Seedling in it, the status reads *no game configured*.

## Playing

Click the game first: it hears the keyboard only while it has the focus. The controls are the original game's. When you click elsewhere the game lets go of any key you were holding, so the player does not keep walking.

- **Checks.** Opening a chest or picking up an item in the game checks the location it stands for. The world decides what you get for it, so the item the game would have given you is taken back, and the world's item arrives instead.
- **Items.** The items you hold in the app are the ones you hold in the game — the sword, the shield, keys and the rest. The [Inventory](inventory.md) panel is in charge: an item removed there is taken out of the game too.
- **Found items.** A box under the game appears with your first find and lists what you have found, and for whom: *N placement(s) found*, then *item → you @ location* (or another player's name, in a multiworld).
- **The log** at the bottom keeps every message in order: location checks in cyan, items in green, warnings in yellow, errors in red.

## Letting the bot play

The [Playback Bot](playbackBot.md) plays Seedling in this panel: open the Playback Bot tab, press **▶** (Play), and come back here to watch it walk the player to each chest. The Flash Panel has no bot controls of its own. Loading a Seedling region brings the Flash Panel to the front.

## For troubleshooting

The buttons under the game are for looking at how the panel and the game talk to each other; you do not need them to play.

- **Wire Check**, **Read State** and **Configure Bridge** write what the game reports into the log, or set the connection up again.
- **Teleport** (a level, x and y) and **Location** (a location) with **Go** move the player there at once. With **TP on UI click** ticked, clicking a location or a region elsewhere in the app teleports the player to it.

## Settings

In the Settings panel, under *flashPanel*, **Runtime** chooses which build of the game plays: *auto* (the default) plays the recompiled WebAssembly build. The tutorials stay on it. The other settings there tune the bot's planning, for developers.

## Learn more

- Tutorials: [watch the bot play](../tutorials/seedling-bot.md), [Seedling rooms](../tutorials/procgen-seedling.md) in a generated world, and [recompile the original game in your browser](../tutorials/seedling-recompile.md) with the [SWF Recompiler](swfRecompilerPanel.md).
- For developers: [the Flash Panel README](../../../../frontend/modules/flashPanel/README.md) and [Seedling in the pipeline](../../developer/procgen/flash.md).
