# Procgen: a mixed world

Each region of a generated world is drawn by a *substrate* — a kind of game that knows how to make a room, put items in it, and gate its exits. One world can mix them: the logic underneath does not care whether a key sits at the end of a maze, a text adventure's room or a platform.

Seedling rooms play in the **wasm** build of the original game (the default). The **Settings** panel's Flash runtime setting (`moduleSettings.flashPanel.runtime`) can switch them to the **JS** runtime, where the Playback Bot already walks them; this tutorial stays on wasm.

## Fill the scenario pool

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. In the **Mode** section, choose **Shuffled spiral**.
3. Make sure the **Scenario Pool** section is unfolded — if its heading shows ▶, click it.
4. Under **Substrates (click to add)**, click **Maze**. It moves to the selected list on the right, with a count of 1.
5. Set its count to **2**.
6. Under **Substrates (click to add)**, click **Text Adventure**. It moves to the selected list on the right, with a count of 1.
7. Under **Substrates (click to add)**, click **Bounce Demo**. It moves to the selected list on the right, with a count of 1.
8. Under **Substrates (click to add)**, click **Noiz2sa**. It moves to the selected list on the right, with a count of 1.
9. Under **Substrates (click to add)**, click **Seedling (generated room)**. It moves to the selected list on the right, with a count of 1.

Hover a substrate's name to see its card: what it can hold and how its exits are gated.

## Generate and load

1. Press **Generate**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.
2. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Where each kind of region plays

1. The **Text Adventure** tab plays text-adventure regions: rooms described in words, exits and items you click.
2. The **Bounce Demo** tab plays bounce zones: a platformer whose jumps are the progression.
3. The **Noiz2sa** tab plays Noiz2sa regions: a bullet-hell shooter, where each region is a run of the game's scenes — choose an exit, then survive the run to leave by it.
4. The **Flash Panel** plays the generated Seedling room in the original game.
5. Open the **Flash Panel** tab and wait for the game page: the panel's status reads *click ▶ Start in the game* (the first time, the browser fetches the game's runtime).
6. Press **▶ Start** in the game. The panel's status moves on to *configured*, and it loads the world's Seedling rooms into the game.

Mazes play in the **Maze Room**, as before. When the player walks into a region, the app brings its panel forward.

## Watch it played

1. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
2. Press **▶** (Play), then open the **Maze Room** tab to watch the bot walk the world, collect each sphere's items and finish.

The bot drives each region with that substrate's own controller — walking the maze, choosing the text adventure's exits, jumping the platforms.

## What each substrate can do

1. Open the **Substrate Registry** tab: every substrate the app has, one per row.
2. Press **Matrix**: a column per capability (sphere growth, items, gated exits, the bot…), a check where the substrate has it.

**Detail** shows one substrate at a time; the filter box narrows the rows.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

The same pool in Loop mode: *Procgen: everything, in Loop mode*.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/mixedWorld.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
