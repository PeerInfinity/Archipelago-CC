# MetaMath: in a multiworld

MetaMath is an Archipelago game like any other: its `.apworld` is released with this project, and its proofs can be shuffled with other games.

Hosting is the same for every game: a player file, `Generate.py`, a local `MultiServer.py`, and the app's **Console** connects to it. Each location you check is sent to the server.

## Open the game's panels

1. Open the **Modules** tab and tick **Proof Queue**, **Proof Graph**. Each one's panel opens as you tick it. (Opened from [MetaMath's own mode](https://peerinfinity.github.io/Archipelago-CC/?mode=metamath), the page has them on already, and you can skip this step.)

## Host it and connect

The next steps happen in a terminal, in your Archipelago folder (a source checkout of Archipelago, or this project's repository). With the installed Archipelago Launcher, *Generate* and *Host* are the same two tools. The tutorial waits for you: press **Next** after each.

1. Download [metamath.apworld](https://github.com/PeerInfinity/Archipelago-CC/raw/main/apworlds/metamath.apworld) and copy it into `custom_worlds/`.

   ```
   cp ~/Downloads/metamath.apworld custom_worlds/
   ```
2. Write a player file for one slot, **Tutorial**, playing "Metamath", in a folder of its own.

   ```
   mkdir -p TutorialPlayers && printf 'name: Tutorial\ngame: Metamath\nMetamath: {}\n' > TutorialPlayers/Tutorial.yaml
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

Connected, the Proof Queue plays the server's game: each step you prove is a check sent to it.

1. Open the **Proof Queue** tab: the steps, in order, each with the ones it depends on. A step joins the queue when it becomes available.
2. Set the difficulty to **Trivial**: no dependencies to type, so each step can be checked as soon as it is available.
3. Tick **Auto-check**: every available step is checked in turn, until the status reads *Proof complete!*

On **Easy** and above, each row asks for the step numbers of its dependencies, typed into its boxes; a row turns clickable when they are right. **Hard** adds a five-second wait after a wrong answer. **Check Next** checks the next ready step without Auto-check.

## Tidy up

1. To put the default layout back, untick **Proof Queue**, **Proof Graph** in the **Modules** tab.

## Next

Add more player files to `TutorialPlayers/` — any games — and MetaMath's items are shuffled among them.

<!-- GENERATED from frontend/modules/tutorials/content/games/multiworld.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
