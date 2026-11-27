# Mystery: a case in a multiworld

A mystery case is an Archipelago world in this project's repository (`worlds/mystery_custom_house_fire`): each question of the case is a location, and each paper is an item. The game itself is a page of its own, shown in the **Mystery Game** panel.

Hosting is the same for every game: a player file, `Generate.py`, a local `MultiServer.py`, and the app's **Console** connects to it. Each location you check is sent to the server.

## Open the game's panels

1. Open the **Mystery Game** tab (Quick Launch lists it, under *Non-procgen Games*). With no mystery world loaded it says so and shows nothing yet.

## Host it and connect

The next steps happen in a terminal, in your Archipelago folder (a source checkout of Archipelago, or this project's repository). With the installed Archipelago Launcher, *Generate* and *Host* are the same two tools. The tutorial waits for you: press **Next** after each.

1. Work in a checkout of this project's repository: its `worlds/mystery_custom_house_fire` is the case's world, so there is nothing to install.

   ```
   git clone --recurse-submodules https://github.com/PeerInfinity/Archipelago-CC.git && cd Archipelago-CC
   ```
2. Write a player file for one slot, **Tutorial**, playing "Mystery - The Fire at the Custom House", in a folder of its own.

   ```
   mkdir -p TutorialPlayers && printf 'name: Tutorial\ngame: Mystery - The Fire at the Custom House\nMystery - The Fire at the Custom House: {}\n' > TutorialPlayers/Tutorial.yaml
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

## Play

The game waits for the connection before it starts, and keeps one save for each multiworld slot. Connected, it shows the papers you hold; the rest are out in the multiworld.

1. Go back to the **Mystery Game** tab. The case of the connected world opens in it.
2. Read the first paper and work on the timeline until a question is solved. Its check is sent to the server, and the **Console** reports it.
3. A solved question sends an item to somebody: here, with one slot, to you. When it is a paper of the case, the game announces it and lists it with your papers.

## Next

Add more player files to `TutorialPlayers/` — any games — and The mystery case's items are shuffled among them.

<!-- GENERATED from frontend/modules/tutorials/content/games/multiworld.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
