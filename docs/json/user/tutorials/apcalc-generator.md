# APCalc: generate a world

The **APCalc Generator** builds APCalc maps in the browser: how many spheres, how many operations and numbers each one adds, how branchy the map is. The result plays at once, saves as a rules.json, and — with the .apworld button — becomes a game Archipelago can host.

## Generate

1. Open the **Modules** tab and tick **APCalc**, **APCalc Generator**. Each one's panel opens as you tick it. (Opened from [APCalc's own mode](https://peerinfinity.github.io/Archipelago-CC/?mode=apcalc), the page has them on already, and you can skip this step.)
2. In the **APCalc Generator** tab, set **seed** to **7**. The other fields shape the map: spheres, operations and numbers per sphere, trash, branches.
3. Press **Generate**. The log ends with *Export complete.*, and the results show the map's size.
4. Press **Load in Frontend**: the new map is the loaded game, and the **APCalc** tab plays it.

**Download rules.json** saves the map as a file, to load again from the **JSON** panel.

## Package it as a .apworld

1. Press **⭳ .apworld**: the generator runs Archipelago's world generator in your browser on this map and saves it as a game for `custom_worlds/` — as the APWorld Editor does for procgen worlds. The first build loads Python (~10 MB); the log ends with *.apworld: downloaded apcalc.apworld*.

## Tidy up

1. To put the default layout back, untick **APCalc**, **APCalc Generator** in the **Modules** tab.

## Next

*APCalc: in a multiworld* hosts APCalc on a local server.

<!-- GENERATED from frontend/modules/tutorials/content/games/apcalc.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
