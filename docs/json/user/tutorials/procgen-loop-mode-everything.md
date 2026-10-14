# Procgen: everything, in Loop mode

The last procgen tutorial puts it all together: JtA zones, a generated Seedling room, mazes, a text adventure, a bounce zone, a Noiz2sa stage and *Idle Loops* — another idle game, which only runs in loop mode — in one world, every action spending the same mana.

Seedling rooms play in the **wasm** build of the original game (the default). The **Settings** panel's Flash runtime setting (`moduleSettings.flashPanel.runtime`) can switch them to the **JS** runtime, where the Playback Bot already walks them; this tutorial stays on wasm.

## Fill the pool, loop mode on

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. In the **Mode** section, choose **Shuffled spiral**.
3. Make sure the **Scenario Pool** section is unfolded — if its heading shows ▶, click it.
4. Under **Substrates (click to add)**, click **JtA**. It moves to the selected list on the right, with a count of 1.
5. Set its count to **2**.
6. Under **Substrates (click to add)**, click **Seedling (generated room)**. It moves to the selected list on the right, with a count of 1.
7. Under **Substrates (click to add)**, click **Maze**. It moves to the selected list on the right, with a count of 1.
8. Set its count to **2**.
9. Under **Substrates (click to add)**, click **Text Adventure**. It moves to the selected list on the right, with a count of 1.
10. Under **Substrates (click to add)**, click **Bounce Demo**. It moves to the selected list on the right, with a count of 1.
11. Under **Substrates (click to add)**, click **Noiz2sa**. It moves to the selected list on the right, with a count of 1.
12. Under **Substrates (click to add)**, click **Idle Loops**. It moves to the selected list on the right, with a count of 1.
13. Make sure the **Parameters** section is unfolded — if its heading shows ▶, click it.
14. In **Parameters**, tick **Enable loop mode**.
15. Press **Generate**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.
16. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Play it

1. Open the **Loops** tab: loop mode is on (**Exit Loop Mode** in its controls), and every region's block is there to queue.
2. The **Idle Loops** tab plays its region: the whole town of the idle game, spending the shared mana.
3. Open the **Flash Panel** tab and wait for the game page: the panel's status reads *click ▶ Start in the game* (the first time, the browser fetches the game's runtime).
4. Press **▶ Start** in the game. The panel's status moves on to *configured*, and it loads the world's Seedling rooms into the game.
5. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
6. Press **▶** (Play), then open the **Loops** tab to watch the bot queue and run each region, collect each sphere's items and finish.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

Take the world to a multiworld the same way as any other: *Procgen: from a generated world to a multiworld*.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/loopModeEverything.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
