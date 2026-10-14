# Procgen: from a generated world to a multiworld

A world the pipeline generates is a real Archipelago game: the **APWorld Editor** can package it as a `.apworld`, which Archipelago's own generator and server load like any other game. This tutorial goes the whole way — generate, look, edit, package, host it locally, connect, and play.

You need a copy of Archipelago (or this project's repository) on your computer for the middle part; everything else is in the browser.

## Generate a world

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. Open the **Preset** drop-down at the top of the **Procgen Pipeline** and choose **Maze demo (sphere growth)**. A preset fills in the whole setup: the mode, the scenario pool and the parameters.
3. Press **Run all**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.

## Look at it in the APWorld Editor

1. Press **Open in APWorld Editor** (under the result). The world opens in the **APWorld Editor** tab: its regions, locations, items and rules, as tabs you can browse and edit.

Browse a little: the **Regions** tab lists the mazes the pipeline built, **Locations** the pickups in them, **Items** the keys and Victory. Every edit you make is checked as you make it, and **↶ Undo** takes it back.

1. Give the game a name of its own: type **Tutorial Maze** in the *apworld game name* box beside **⭳ .apworld**. (Blank keeps the world's own name.)
2. Press **⭳ .apworld**. The editor runs Archipelago's world generator in your browser (the first time, it downloads Python — a few seconds) and saves the `.apworld`. Its status line names the file.

## Host it on a local server and connect

The next steps happen in a terminal, in your Archipelago folder (a source checkout of Archipelago, or this project's repository). With the installed Archipelago Launcher, *Generate* and *Host* are the same two tools. The tutorial waits for you: press **Next** after each.

1. Copy the downloaded `tutorial_maze.apworld` into the `custom_worlds/` folder, so Archipelago can load the game "Tutorial Maze".

   ```
   cp ~/Downloads/tutorial_maze.apworld custom_worlds/
   ```
2. Write a player file for one slot, **Tutorial**, playing "Tutorial Maze", in a folder of its own.

   ```
   mkdir -p TutorialPlayers && printf 'name: Tutorial\ngame: Tutorial Maze\nTutorial Maze: {}\n' > TutorialPlayers/Tutorial.yaml
   ```
3. Generate the multiworld. It writes `output/AP_<seed>.zip`.

   ```
   python Generate.py --player_files_path TutorialPlayers
   ```
4. Start a local server on that file. It listens on port 38281; leave it running.

   ```
   python MultiServer.py output/AP_<seed>.zip
   ```
5. Open the **Console** tab, check the **Server Address** says `ws://localhost:38281`, and press **Connect**. When it asks for your slot name, type **Tutorial**. The status turns to *Connected*.

## Play it

Connected, the app is a client of the server: each location the bot checks is sent to it, and the items the server sends back arrive in your inventory.

1. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
2. Press **▶** (Play), then open the **Maze Room** tab to watch the bot walk the world, collect each sphere's items and finish.

The server's window logs each check; when Victory is found, the slot is finished.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

Stop the server with **Ctrl+C** in its terminal; delete `custom_worlds/tutorial_maze.apworld` and the `TutorialPlayers` folder when you no longer need them.

## Next

Put more than one player file in `TutorialPlayers/` — the same generated game twice, or with any other Archipelago game — and the items are shuffled between the worlds.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/toMultiworld.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
