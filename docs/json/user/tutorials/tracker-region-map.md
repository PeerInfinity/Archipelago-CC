# Tracking: the Region Map

The **Region Map** draws a world as a map: one cell per level, laid out the way you walk between them, with each location as a square on its own tile. It is the map beside the **Region Graph**: the same reachability colours, the same clicks.

It uses *Seedling Playthrough*, the whole of the original *Seedling* as an Archipelago world, because its levels carry the game's own map. Only the world's rules are loaded; no game is started.

## Load the world

1. Load **Seedling Playthrough — the whole map as a world** (seed 1) — in the **Presets** panel, or by opening the page with `?game=seedling_playthrough&seed=1`. **Do it** loads it for you.

## The map

1. Open the **Region Map** tab (Quick Launch lists it, under *Analysis Panels*). Each cell is a level, drawn from the game's own map; the line under the controls says the layout came from the world (`layout: hook`), not a generic grid.
2. The squares are the locations, each on its own tile of its level: **green** you can reach now, **red** not yet, **grey** checked. A diamond is an event. Hover one for its name; every location has a square, so nothing is listed as *Not on map*.
3. Drag to pan. To zoom, scroll the mouse wheel, press **+** and **−** beside **Fit all**, or, on a phone or a touch screen, pinch with two fingers. Press **Fit all** for the whole map. Moving the view yourself turns **Follow player** off.
4. Press **+** to zoom in on the middle of the view, then **−** to zoom back out. Each press is a few notches of the wheel.
5. Levels you walk between, off one edge and into the next, sit side by side as a **group**, and a short **yellow** line in the gap between two squares joins neighbours you walk between (the *edge transition* in the legend; it has no arrowhead, since you can walk both ways). Arrows join the groups: blue goes **down**, orange goes **up**. A line starts and ends at the door it uses, ringed (the arrowhead marks the door it points to), or at the edge of the level's picture when the map has no door for it. A **warp** (a door or a teleporter) is a dashed green arrow, never a neighbour. The legend in the controls names them, and **Links** turns them all off.
6. Tick **Follow player** again: the view eases back onto the level the player is in (outlined white), and follows it as the player moves.

## Clicking the map

1. The **On click** strip at the top says what a click does. Here: *extend path · Regions — location: check*. Clicking a level extends the path to it and shows it in the Regions panel; clicking a location's square checks it.
2. Unfold it with **▸**. It lists every action for a level and for a location, and the panel actions too: **Centre the Region Graph on it**, and **Teleport there in Flash**, which moves the player in a running Seedling game. Both start off. This tutorial starts no game, so it leaves Teleport off. The Map's settings began as a copy of the Region Graph's; they are its own now, and changing one panel's does not change the other's. **⏸** turns every click action off.
3. Unfold **Go to** in the controls: it picks a level or a location by name and does exactly what clicking it on the map does. It is handy when a cell is small.
4. Choose the level **level_2**, as a click on it would: the path is extended to it, and the **Regions** panel opens showing the path, ending there.
5. Back on the **Region Map**, choose the location **Level 011 - Chest**: it is checked, as a click on its square would, and the square turns grey.
6. In the **On click** strip, tick **Centre the Region Graph on it**.
7. Choose the level **level_4**, then open the **Region Graph** tab: it is centred on that region. (A Graph that shares the Map's column centres when you bring its tab forward.)
8. Put the Map back as it was: untick **Centre the Region Graph on it**, fold the strip and **Go to**, and tick **Follow player** (choosing a level moved the view, which turned it off).

<!-- GENERATED from frontend/modules/tutorials/content/tracker/regionMap.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
