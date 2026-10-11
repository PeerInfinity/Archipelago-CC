# Procgen: Sphere growth, with Maze

**Sphere growth** is the pipeline's default mode: it plans the item progression first — which items unlock which, sphere by sphere — and then grows a world to match. This tutorial builds a world from mazes alone, so you can see the plan become rooms.

## Set up

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. Open the **Preset** drop-down at the top of the **Procgen Pipeline** and choose **Maze demo (sphere growth)**. A preset fills in the whole setup: the mode, the scenario pool and the parameters.

The preset plans four keys and the Victory item over five spheres, with two empty "filler" regions and some revisits. The **Mode** section now shows *Sphere growth*, and the **Scenario Pool** has only *Maze*.

## Generate and load

1. Press **Run all**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.

Watch the step chips: **1 Plan** decides the spheres, **2a Allocate**, **2b Topology** and **2c Items** lay them out, **3 Build regions** draws each maze, and **4 Compile** writes the world's rules.

1. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## Watch it played

1. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
2. Press **▶** (Play), then open the **Maze Room** tab to watch the bot walk the world, collect each sphere's items and finish.

The bot's log follows the plan: each sphere's keys, then the doors they open, then Victory.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

The other modes build worlds differently: *Shuffled spiral*, *Grid growth* and *Top-down* each have a tutorial like this one. *Procgen: settings and the Playback Bot* goes through the knobs.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/sphereGrowth.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
