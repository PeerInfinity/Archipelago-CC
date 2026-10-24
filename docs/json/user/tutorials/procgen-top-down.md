# Procgen: Top-down, with Maze

**Top-down** starts from a world that already exists — any game's rules.json — and *realises* it: every region becomes a generated room, and the source's access rules stay on the exits. This tutorial realises Atari 2600 *Adventure* as mazes.

## Set up

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. Load **Adventure** (seed 1) — in the **Presets** panel, or by opening the page with `?game=adventure&seed=1`. **Do it** loads it for you.
3. In the **Mode** section, choose **Top-down**.
4. Make sure the **Top-down source** section is unfolded — if its heading shows ▶, click it.

With **Use currently-loaded rules.json** ticked, the source is the world you just loaded — Adventure.

1. Make sure the **Scenario Pool** section is unfolded — if its heading shows ▶, click it.
2. Under **Substrates (click to add)**, click **Maze**. It moves to the selected list on the right, with a count of 1.

Top-down always uses a *mix*: each region's substrate is drawn by weight. Maze alone, at any weight, makes every region a maze.

## Generate and load

1. Press **Generate**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.

The step chips are **1 Layout** (the source's regions placed on a grid), **2 Realise** (each one drawn as a maze), **3 Finalize** and **4 Compile**.

1. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Watch it played

1. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
2. Press **▶** (Play), then open the **Maze Room** tab to watch the bot walk the world, collect each sphere's items and finish.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

Any loaded game can be a source — try a larger one from the **Presets** panel, or mix Maze with a text adventure.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/topDown.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
