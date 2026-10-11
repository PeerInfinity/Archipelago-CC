# Procgen: settings and the Playback Bot

The mode tutorials press **Run all** and **▶**. This one opens up both: the parameters that shape a world, the pipeline's steps one at a time, and the bot's other controls.

## Parameters

1. Open the **Procgen Pipeline** tab and press **Reset panel** (beside the Preset drop-down), so you start from a fresh setup.
2. Open the **Preset** drop-down at the top of the **Procgen Pipeline** and choose **Maze demo (sphere growth)**. A preset fills in the whole setup: the mode, the scenario pool and the parameters.
3. Make sure the **Parameters** section is unfolded — if its heading shows ▶, click it.
4. In **Parameters**, set **Seed** to **7**.

The seed picks one world among all the ones these settings allow; the same seed always gives the same world. Changing any setting flips the Preset drop-down back to *Custom* — your setup is your own now.

1. In **Parameters**, set **Spheres** to **3**.
2. In **Parameters**, set **Filler regions** to **1**.

*Spheres* is how many rounds of progression the plan has; *Filler regions* adds rooms with nothing in them. **Save Params** / **Load Params** keep a setup, and **Reset Defaults** puts just these parameters back.

## One step at a time

Beside **Run all** is a button for the NEXT step only. Each step's output shows below in the **Sphere pipeline** section, where it can be looked at, and some can be edited, before the next step runs.

1. Press **Run 1 Plan**: the plan — which items each sphere holds and how many regions it needs.
2. Press **Run 2a Allocate**: each region gets its substrate (here, always Maze).
3. Press **Run all (finish)** to run the remaining steps.

**◀ Previous sphere** drops the last sphere built, so it can be grown again; **Reset** clears the steps.

1. Press **Load into frontend**: the world you generated becomes the loaded game — the Maze Room, the Region Graph and the Playback Bot all switch to it.

## The Playback Bot

1. Open the **Playback Bot** tab: "Sphere log loaded".
2. Press **⏯** (Step): the bot takes one action and stops. Its status line says what it is doing.
3. Press **▶** (Play) and open the **Maze Room** to watch it walk the rest of the way. **⏹** stops it.

- **⏭** (Instant) plays the rest at once, without walking; **↺** (Reset) starts the run over.
- **Manual walk-to**: pick a region (and optionally a cell), press **Go**, and the bot walks the player there — handy for looking at one room. It is off while a sphere run is going.
- **Route clicks to bot**: with it on, a click on a location in the **Locations** or **Exits** panel sends the bot there instead of checking it at once.
- You can always walk yourself: click into the **Maze Room** and use the arrow keys.

## Tidy up

1. In the **Procgen Pipeline** tab, press **Reset panel** (beside the Preset drop-down): the whole setup goes back to a fresh panel's — Sphere growth, default parameters, no substrates chosen. Your saved presets are kept.

## Next

The mode tutorials (*Sphere growth*, *Shuffled spiral*, *Grid growth*, *Top-down*) each build a world a different way; the bot plays any of them.

<!-- GENERATED from frontend/modules/tutorials/content/procgen/settingsAndBot.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
