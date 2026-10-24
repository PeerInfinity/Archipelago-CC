# Procgen: Shuffled spiral, with Maze

**Shuffled spiral** lays its regions out from a centre cell outwards, in shuffled zones, and then places the scenario's items so the world can be finished. You choose how many regions of each substrate it makes — here, mazes only.

## Set up

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. In the **Mode** section, choose **Shuffled spiral**.
3. Make sure the **Scenario Pool** section is unfolded — if its heading shows ▶, click it.
4. Under **Substrates (click to add)**, click **Maze**. It moves to the selected list on the right, with a count of 1.
5. Set its count to **4**.

In this mode the counts are *quotas*: the world gets exactly four maze regions. The scenario's items (a red key, a blue key and Victory, unless you change them) are spread over them.

## Generate and load

1. Press **Generate**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.

The step chips are **1 Arrange** (the spiral), **2 Content**, **3 Regions** (each maze drawn) and **4 Compile**.

1. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Watch it played

1. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
2. Press **▶** (Play), then open the **Maze Room** tab to watch the bot walk the world, collect each sphere's items and finish.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

Add a second substrate to the pool (a text adventure, a bounce zone) and generate again: the spiral mixes them, each region its own kind of game.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/shuffledSpiral.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
