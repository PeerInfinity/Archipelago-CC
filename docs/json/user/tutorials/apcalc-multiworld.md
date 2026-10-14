# APCalc: in a multiworld

APCalc is an Archipelago world in this project's repository (`worlds/apcalc`); no released `.apworld` yet — *APCalc: generate a world* will make one from any map.

Hosting is the same for every game: a player file, `Generate.py`, a local `MultiServer.py`, and the app's **Console** connects to it. Each location you check is sent to the server.

## Open the game's panels

1. Open the **Modules** tab and tick **APCalc**. Each one's panel opens as you tick it. (Opened from [APCalc's own mode](https://peerinfinity.github.io/Archipelago-CC/?mode=apcalc), the page has them on already, and you can skip this step.)

## Host it and connect

The next steps happen in a terminal, in your Archipelago folder (a source checkout of Archipelago, or this project's repository). With the installed Archipelago Launcher, *Generate* and *Host* are the same two tools. The tutorial waits for you: press **Next** after each.

1. Work in a checkout of this project's repository: its `worlds/apcalc` is the APCalc world, so there is nothing to install.

   ```
   git clone --recurse-submodules https://github.com/PeerInfinity/Archipelago-CC.git && cd Archipelago-CC
   ```
2. Write a player file for one slot, **Tutorial**, playing "APCalc", in a folder of its own.

   ```
   mkdir -p TutorialPlayers && printf 'name: Tutorial\ngame: APCalc\nAPCalc: {}\n' > TutorialPlayers/Tutorial.yaml
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

1. Open the **APCalc** tab and reach a number: it is checked on the server, and the Console reports it.

## Tidy up

1. To put the default layout back, untick **APCalc** in the **Modules** tab.

## Next

Add more player files to `TutorialPlayers/` — any games — and APCalc's items are shuffled among them.

<!-- GENERATED from frontend/modules/tutorials/content/games/multiworld.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
