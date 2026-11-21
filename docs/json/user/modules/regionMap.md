# Region Map Panel

The Region Map shows the loaded world as a flat map: each region is drawn as its own picture, laid out in groups. It has no node-and-edge graph. For Seedling worlds, each cell is the level as the game draws it. For any other world, each cell is a labelled box.

**Opening it:** pick **Region Map** from the panel menu (*Analysis Panels*). It is not in any layout preset, so it appears only when you open it.

## What you see

- **Cells.** One cell per *whole level*. A Seedling level split into several sub-regions is drawn once, whole, and its sub-regions' locations all appear in it.
- **Groups.** Regions joined by **edge transitions** (walk off one side of a level and you are in the next one) form a group, and the groups are separated by gaps. A doorway or a teleporter (a **warp**) does not join two groups, but a group you can only reach through one sits beside the group it is reached from. A group reached by going **down** stairs or a pit sits below the group it is reached from, and a group you can only go down *from* sits just above the first group it leads to.
- **Location squares.** Each location is a square on its tile. Event locations are drawn as diamonds.

  | Colour | Meaning |
  |---|---|
  | Green | Accessible now |
  | Red | Not accessible yet |
  | Grey (dimmed) | Already checked |
  | Light grey | Reachability is not shown (the accessibility colours are turned off, or the region is undiscovered) |

  A square never gets smaller than the **minimum square size** setting, however far you zoom out.
- **Links.** Thin arrows link two *groups*. Blue arrows go down stairs or a pit, orange arrows go up, and green dashed arrows are warps (doorways and teleporters). The legend in the toolbar names each colour. Neighbouring cells inside a group get no lines: being next to each other already says they connect.
- **Markers.** The region you are in has a white outline, and the regions on your current path have a thin blue one. A hovered cell gets a light outline and a clicked cell a yellow one.
- **Not on map.** A location the map cannot place on a tile is listed in a yellow line above the map. It is never dropped silently.

Hover over a cell to see its name and its counts (checked, accessible and inaccessible locations). Hover over a square to see the location's name and state.

## Moving around

- **Drag** to pan, and use the **mouse wheel** to zoom around the cursor.
- **Centre on start** goes to the start region. **Fit all** shows the whole map.
- **Follow player** keeps your current region in the middle of the view: the view glides there whenever you move. Panning or zooming by hand turns it off, and the checkbox shows that. Tick it again to turn it back on.

## Clicking

- **Click a cell** to select it (a yellow outline) and run the **On click** strip's *Region* actions on its region. By default that extends your path to the region, which moves you there, and opens it in the Regions panel.
- **Click a location square** to run the strip's *Location* actions on it. By default that checks the location. A location you cannot reach yet is refused, exactly as it is in the Region Graph.

A dragged pan never counts as a click. In loop mode, a Region Map click plans your path the way a Region Graph click does. With discovery mode on, a location you have not discovered shows as `???` when you hover over it.

## The "On click" strip

What a click does is set in the **On click** strip, the row at the very top of the panel, above the toolbar. It is the same strip as the [Region Graph's](regionGraph.md#the-on-click-strip), with the same actions:

- **Folded**, it is one line saying what a click does — for example *On click: extend path · Regions — location: check* — with the **⏸** switch beside it. **⏸** turns every click action off at once (a click then only selects the cell); **▶** turns them back on. The line then reads *On click: ⏸ paused*.
- **Unfolded** (press **▸**), it lists the **Region** actions (route to the region, check all its accessible locations, open it in the Regions panel, discover it, teleport there in Flash, centre the Region Graph on it) and the **Location** actions (check it now, or add the check to the path; teleport to it in Flash; scroll the Regions panel to it). Each is described under the [Region Graph's strip](regionGraph.md#the-on-click-strip); the Region Map offers to centre the *Region Graph*, never itself.

The Region Map keeps its own settings (`moduleSettings.regionMap.clickActions`), separate from the Region Graph's: changing one strip never changes the other. The first time the Region Map opens, it starts from a copy of the Region Graph's current setup, except for the actions other panels add (discover, teleport in Flash, centre, scroll the Regions panel): those start **off** on the Region Map. So a Region Map click teleports in Flash only once you tick **Teleport there in Flash** in its strip.

## Discovery mode

With discovery mode on, regions you have not discovered are not drawn. A region you can already enter from a discovered one is drawn as a grey **fog** cell with a question mark, with no picture and no squares. Untick **Show undiscovered** to hide the fog cells too.

## Controls and settings

| Control | Setting | Default | What it does |
|---|---|---|---|
| Follow player | `followPlayer` | on | Keep the current region centred |
| Show undiscovered | `showUndiscovered` | on | Discovery mode: draw fog cells for regions you can reach next |
| Links | `showLinks` | on | Draw the arrows between groups |
| Cells | `cellSize` | sized by level | **Sized by level**: one tile scale for every level, so a small level looks small. **Uniform**: every level scaled to fill the same square |
| Grouping | `groupingRule` | R1 | How regions are grouped. **R1** groups everything joined by edge transitions |
| — | `minSquarePx` | 6 | The smallest a location square gets on screen, in pixels |
| On click strip | `clickActions` | a copy of the Region Graph's, on first open | What a click on a cell or a location square runs (above) |

The settings are under **Region Map** in the Settings panel (`moduleSettings.regionMap.*`).
