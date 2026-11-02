# Procgen: Cloudberry Kingdom in Loop mode

*Loop mode* turns a world into an incremental game: every action costs mana, and when the mana runs out the loop restarts — keeping what you have learned. In a **Cloudberry Kingdom** level the cost is time: each second of play costs the region's rate in mana, counted by the game's own clock, so a paused game or a hidden tab costs nothing.

This tutorial generates the three-level Cloudberry demo with loop mode on. The levels are made by the game page itself, so the first **Run all** waits for the game to load (about 26 MB).

## Generate the demo in loop mode

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. Open the **Preset** drop-down at the top of the **Procgen Pipeline** and choose **Cloudberry demo (sphere growth)**. A preset fills in the whole setup: the mode, the scenario pool and the parameters.
3. Make sure the **Parameters** section is unfolded — if its heading shows ▶, click it.
4. In **Parameters**, tick **Enable loop mode**.

With loop mode on, the world carries its loop costs: what each region costs per second of play.

1. Press **Run all**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.
2. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Watch it played

1. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
2. Press **▶** (Play), then open the **Cloudberry Kingdom** tab to watch the bot play each level to its check coin, then out by the end door, collect each sphere's items and finish.
3. Open the **Loops** tab. The world brought its costs, so loop mode is on — the button in its controls reads **Exit Loop Mode**. Each Cloudberry level is a block; its cost is the seconds the bot played it.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/cloudberry.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
