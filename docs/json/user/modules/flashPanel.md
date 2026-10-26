# Flash Panel

The Flash Panel plays **Seedling** — the original Flash game, recompiled to run in the browser — as part of an Archipelago world. Opening a chest or picking up an item in the game checks that location, and the items the world gives you appear in the game. It plays the whole original game as the world *Seedling Playthrough*, and it plays the Seedling rooms of a world from the [Procgen Pipeline](procgenPipeline.md).

## Starting the game

1. Load a world that has Seedling in it — for example **Seedling Playthrough** (seed 1) in the [Presets](presets.md) panel, or the page with `?game=seedling_playthrough&seed=1`.
2. Open the **Flash Panel** tab. The status beside its title (the game's name) reads *loading config…*, then *loading wasm page…*, then *click ▶ Start in the game*. The first time, the browser has to fetch the game, which takes a moment.
3. Press **▶ Start** in the game. While the world's rooms load, the game is covered by a note such as *delivering N randomized room(s)…*; the status moves on to *configured* and then *ready*.

With a world that has no Seedling in it, the status reads *no game configured*.

## The panel

From top to bottom:

- **The title and the status.** The title is the game's name.
- **The game.** On a narrow screen, such as a phone, the game is scaled down to fit the panel's width. It is never drawn larger than its own size.
- **The solver's progress line** (Seedling only). While the [Playback Bot](playbackBot.md)'s solver plans a room, this line shows its work so far against its budget, an estimate of the time left, and the best plan it has found. When the solve ends, the line shows the result.
- **Solver** (Seedling only), **Settings** and **Tools**: three sections that open and close when you click their titles. They all start closed. The panel remembers which ones you opened, in this browser.

## Playing

Click the game first: it hears the keyboard only while it has the focus. The controls are the original game's. When you click elsewhere the game lets go of any key you were holding, so the player does not keep walking.

- **Checks.** Opening a chest or picking up an item in the game checks the location it stands for. The world decides what you get for it, so the item the game would have given you is taken back, and the world's item arrives instead.
- **Items.** The items you hold in the app are the ones you hold in the game — the sword, the shield, keys and the rest. The [Inventory](inventory.md) panel is in charge: an item removed there is taken out of the game too.
- **Found items.** A box in the **Tools** section appears with your first find and lists what you have found, and for whom: *N placement(s) found*, then *item → you @ location* (or another player's name, in a multiworld).
- **The log**, at the bottom of the **Tools** section, keeps every message in order: location checks in cyan, items in green, warnings in yellow, errors in red.

## Letting the bot play

The [Playback Bot](playbackBot.md) plays Seedling in this panel: open the Playback Bot tab, press **▶** (Play), and come back here to watch it walk the player to each chest. The Flash Panel has no bot controls of its own. Loading a Seedling region brings the Flash Panel to the front.

## Solver

The **Solver** section shows everything the solver is doing while it plans a room: the goals and steps it tried and how often each worked, the tiles its search reached, and the work it spent. Closed, it still keeps up, so opening it during a solve or after one shows that solve. How often it updates is a setting (see below).

## Tools

The **Tools** section is for looking at how the panel and the game talk to each other; you do not need it to play.

- **Wire Check**, **Read State** and **Configure Bridge** write what the game reports into the log, or set the connection up again.
- **Teleport** (a level, x and y) and **Location** (a location) with **Go** move the player there at once.

## Settings

The **Settings** section holds the settings you are most likely to change. Each one is the same setting as in the Settings panel (under *flashPanel*), so a change in either place shows in both.

- **Runtime** chooses which version of the game plays. It lists only the versions this game has: *auto* (the default, which plays the recompiled WebAssembly version and says so), *wasm*, *flash* (the original Flash file, played by Ruffle) and, for Seedling, *js* (a JavaScript copy of the game). The tutorials stay on *auto*. Changing it restarts the game.
- **Graphics**, **Camera** and **Lights** (the *js* runtime only) change how the game is drawn, at once: rectangles or the original pictures, the whole room or the original game's view that follows the player, and the night lighting.
- **Game speed** (the *js* runtime only) plays the game at *1x* (the default, the original speed), *2x* or *4x*, fades included. It changes only how fast the game is shown: the game, the bot and the solver do exactly the same things, frame for frame. It takes effect at once.
- **Bot uses the solver** (Seedling) lets the Playback Bot plan each room with the solver, and **Progress refresh** sets how often the solver's progress is shown.
- **TP on UI click** (a game that can teleport): when it is ticked, clicking a location or a region elsewhere in the app teleports the player to it.

The other settings in the Settings panel tune the bot's planning, for developers.

## Learn more

- Tutorials: [watch the bot play](../tutorials/seedling-bot.md), [Seedling rooms](../tutorials/procgen-seedling.md) in a generated world, and [recompile the original game in your browser](../tutorials/seedling-recompile.md) with the [SWF Recompiler](swfRecompilerPanel.md).
- For developers: [the Flash Panel README](../../../../frontend/modules/flashPanel/README.md) and [Seedling in the pipeline](../../developer/procgen/flash.md).
