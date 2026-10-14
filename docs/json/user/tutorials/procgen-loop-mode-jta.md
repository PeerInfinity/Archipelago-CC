# Procgen: Journey to Ascension in Loop mode

*Loop mode* turns a world into an incremental game: every action costs mana, and when the mana runs out the loop restarts — keeping what you have learned. *Journey to Ascension* (JtA) is an idle game whose zones make natural regions; this tutorial builds a world of them with loop mode on.

## Generate a JtA world in loop mode

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. In the **Mode** section, choose **Shuffled spiral**.
3. Make sure the **Scenario Pool** section is unfolded — if its heading shows ▶, click it.
4. Under **Substrates (click to add)**, click **JtA**. It moves to the selected list on the right, with a count of 1.
5. Set its count to **3**.
6. Make sure the **Parameters** section is unfolded — if its heading shows ▶, click it.
7. In **Parameters**, tick **Enable loop mode**.

With loop mode on, the world carries its loop costs: what each region costs in mana to explore and to cross.

1. Press **Generate**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.
2. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Watch it played

1. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
2. Press **▶** (Play), then open the **JtA** tab to watch the bot work through the zones, collect each sphere's items and finish.

## The loop panels

1. Open the **Loops** tab. The world brought its costs, so loop mode is on — the button in its controls reads **Exit Loop Mode**.

Each region is a block: **Explore Region** queues exploring it, and a click on an exit queues the move through it. **Start** runs the queue; the loop ends when the mana does.

1. The **Loop Stats** tab adds the queue up: the mana each action costs and what is left at the end.
2. The **Discovery** tab: in loop mode, regions, exits and locations start hidden and are discovered by exploring.
3. The **Game State** tab: current and maximum mana, the path walked this loop, and each region's experience.
4. The **Menu** tab: restart the run, or skip back to the menu.
5. The **JtA** tab plays the JtA zones themselves.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

*Procgen: everything, in Loop mode* mixes JtA with every other substrate, Idle Loops included, all spending the same mana.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/loopModeJta.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
