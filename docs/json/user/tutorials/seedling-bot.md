# Seedling: watch the bot play

*Seedling Playthrough* is the whole map of the original game as an Archipelago world: its 113 levels are the regions, its chests and bosses the locations. The Playback Bot plays it from the world's solution, sphere by sphere, by driving the real game.

Seedling rooms play in the **wasm** build of the original game (the default). The **Settings** panel's Flash runtime setting (`moduleSettings.flashPanel.runtime`) can switch them to the **JS** runtime, where the Playback Bot already walks them; this tutorial stays on wasm.

## Play

1. Load **Seedling Playthrough — the whole map as a world** (seed 1) — in the **Presets** panel, or by opening the page with `?game=seedling_playthrough&seed=1`. **Do it** loads it for you.
2. Open the **Flash Panel** tab and wait for the game page: the panel's status reads *click ▶ Start in the game* (the first time, the browser fetches the game's runtime).
3. Press **▶ Start** in the game. The panel's status moves on to *configured*, and it loads the world's Seedling rooms into the game.
4. Open the **Playback Bot** tab. It says "Sphere log loaded" — the world's solution, sphere by sphere.
5. Press **▶** (Play) and open the **Flash Panel** tab: the bot walks the player to the first sphere's chests. Watch it make its first check.
6. Back in the **Playback Bot** tab, press **⏹** (Stop): the bot pauses where it is, and **▶** would resume it. The *Seedling: the bot through the whole game* tutorial lets it run to the end.

<!-- GENERATED from frontend/modules/tutorials/content/seedling/seedling.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
