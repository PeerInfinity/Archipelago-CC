# Seedling: in a multiworld

Here Seedling Playthrough is a slot of a multiworld you generate and host yourself, on your own computer; the app is its client.

Seedling rooms play in the **wasm** build of the original game (the default). The **Settings** panel's Flash runtime setting (`moduleSettings.flashPanel.runtime`) can switch them to the **JS** runtime, where the Playback Bot already walks them; this tutorial stays on wasm.

## Generate, host, connect

The next steps happen in a terminal, in your Archipelago folder (a source checkout of Archipelago, or this project's repository). With the installed Archipelago Launcher, *Generate* and *Host* are the same two tools. The tutorial waits for you: press **Next** after each.

1. The Seedling Playthrough world ships with this project, as `worlds/seedling_playthrough/`: work in a checkout of this repository (with its Python requirements installed), not in an installed Archipelago.

   ```
   git clone https://github.com/PeerInfinity/Archipelago-CC.git && cd Archipelago-CC
   ```
2. Write a player file for one slot, **Tutorial**, playing "Seedling Playthrough", in a folder of its own.

   ```
   mkdir -p TutorialPlayers && printf 'name: Tutorial\ngame: Seedling Playthrough\nSeedling Playthrough: {}\n' > TutorialPlayers/Tutorial.yaml
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

## Play your slot

1. Open the **Flash Panel** tab and wait for the game page: the panel's status reads *click ▶ Start in the game* (the first time, the browser fetches the game's runtime).
2. Press **▶ Start** in the game. The panel's status moves on to *configured*, and it loads the world's Seedling rooms into the game.

The checks you make arrive at the server, and the items other slots send you arrive in the game.

<!-- GENERATED from frontend/modules/tutorials/content/seedling/seedling.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
