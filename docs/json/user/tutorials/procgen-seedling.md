# Procgen: Seedling rooms

*Seedling* is a Flash game this project runs in the browser, recompiled from its SWF. Its rooms can be regions of a generated world: either real rooms from the game (the *region atlas*) or new rooms generated in its style, with the game's own physics deciding what is reachable.

Seedling rooms play in the **wasm** build of the original game (the default). The **Settings** panel's Flash runtime setting (`moduleSettings.flashPanel.runtime`) can switch them to the **JS** runtime, where the Playback Bot already walks them; this tutorial stays on wasm.

## A world with generated Seedling rooms

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. Open the **Preset** drop-down at the top of the **Procgen Pipeline** and choose **Generated Seedling rooms in a maze spiral**. A preset fills in the whole setup: the mode, the scenario pool and the parameters.

Two mazes and two generated Seedling rooms, laid out by Shuffled spiral. Each Seedling room has its goal, one door into the other room and one into a maze. The **Parameters** section shows the room generator's knobs too.

1. Press **Generate**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.
2. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Play it

The Seedling regions play in the **Flash Panel**, in the original game.

1. Open the **Flash Panel** tab and wait for the game page: the panel's status reads *click ▶ Start in the game* (the first time, the browser fetches the game's runtime).
2. Press **▶ Start** in the game. The panel's status moves on to *configured*, and it loads the world's Seedling rooms into the game.
3. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
4. Press **▶** (Play), then open the **Maze Room** tab to watch the bot walk the world, collect each sphere's items and finish.

## The Procgen Lab

1. Open the **Procgen Lab — Seedling** tab: the Seedling room generator's own page, inside the app. Its status line says when it is connected.
2. Press **TAKE — the page's level**: the room the lab is showing comes into the box below, as data. **SEND — load this payload** does the reverse — load a room you paste into the box.

**open standalone ↗** opens the same lab page in a tab of its own; its links lead to the procgen demo catalogue and the glossary. The **Procgen Lab — maze** tab does the same for maze rooms.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

The pipeline's Preset list has more Seedling worlds: a real atlas room as a sphere leaf, a room whose chest is a check, a room gated by water. The *Seedling* track goes further — the whole original game, recompiled and randomized.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/seedling.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
