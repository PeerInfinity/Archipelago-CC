# Procgen: editing a bounce region

A generated region is not final: the pipeline's step 3 lists every region it built, and **Edit ▸** opens one in its substrate's editor. For a bounce zone that is the **Bounce Region Editor** — its platforms, pickups and portals on a canvas, and the access rules they imply, re-derived as you edit.

## A world with bounce zones

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. Open the **Preset** drop-down at the top of the **Procgen Pipeline** and choose **Maze + bounce (sphere growth)**. A preset fills in the whole setup: the mode, the scenario pool and the parameters.
3. Press **Run all**. The pipeline runs its steps in order; when it has a world, the **Load into frontend** button appears.
4. Make sure the **Sphere pipeline** section is unfolded — if its heading shows ▶, click it.

## Edit a bounce zone

1. In the **Sphere pipeline** section's region list, find a region whose substrate reads **Bounce Demo** and press its **Edit ▸**. The **Bounce Region Editor** opens with that zone.
2. Pick a platform — click it on the canvas, or choose it in the sidebar's **pick** drop-down (here **b1**, the second from the bottom). The sidebar shows its fields — **x**, **y** and **type** — and **Derived access rules** lists what reaching each exit needs.

Change a field — move the platform, change its type — and watch the rules update; **↶ Undo** takes an edit back.

1. Press **Save**: the edited zone goes back into the pipeline's world.

## Recompile and play

1. Back in the **Procgen Pipeline**, press **Run 4 Compile**: the world's rules are written again, with your zone in them.
2. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.
3. Open the **Playback Bot** tab. It says "Sphere log loaded" — it has the world's solution path, sphere by sphere.
4. Press **▶** (Play), then open the **Maze Room** tab to watch the bot walk the world, collect each sphere's items and finish.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

The editor also opens on its own — its *Load fixture…* list has hand-made levels — and **Export level JSON** saves a level to a file.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/bounceRegionEditor.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
