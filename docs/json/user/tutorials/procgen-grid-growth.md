# Procgen: Grid growth, with Maze

**Grid growth** is the pipeline's first mode, kept as the legacy grower: it grows regions cell by cell on a grid, drawing from the scenario pool, until the pool or the frontier runs out. How many regions you get is emergent.

## Set up

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. In the **Mode** section, choose **Grid growth**.
3. Make sure the **Scenario Pool** section is unfolded — if its heading shows ▶, click it.
4. Under **Substrates (click to add)**, click **Maze**. It moves to the selected list on the right, with a count of 1.
5. Set its count to **4**.

Grid growth can allocate substrates by *quotas* (fixed counts, the default) or a *mix* (weighted random per region) — the **Substrate allocation** switch above the list. With only Maze chosen, both give a maze world.

## Generate and load

1. Press **Generate**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.
2. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Watch it played

1. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
2. Press **▶** (Play), then open the **Maze Room** tab to watch the bot walk the world, collect each sphere's items and finish.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

Grid growth runs in one go — it has no step chips. The *Sphere growth* mode replaced it as the default because it plans the progression first.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/gridGrowth.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
