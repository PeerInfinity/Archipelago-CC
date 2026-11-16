# Region Map Panel

The Region Map shows the loaded world as a flat map: each region is drawn as its own picture, laid out in groups. It has no node-and-edge graph. For Seedling worlds, each cell is the level as the game draws it. For any other world, each cell is a labelled box.

**Opening it:** pick **Region Map** from the panel menu (*Analysis Panels*). It is not in any layout preset, so it appears only when you open it.

## What you see

- **Cells.** One cell per *whole level*. A Seedling level split into several sub-regions is drawn once, whole, and its sub-regions' locations all appear in it.
- **Groups.** Regions joined by ordinary doors and teleporters form a group, and the groups are separated by gaps. A group reached by going **down** stairs or a pit sits below the group it is reached from.
- **Location squares.** Each location is a square on its tile. Event locations are drawn as diamonds.

  | Colour | Meaning |
  |---|---|
  | Green | Accessible now |
  | Red | Not accessible yet |
  | Grey (dimmed) | Already checked |
  | Light grey | Reachability is not shown (the accessibility colours are turned off, or the region is undiscovered) |

  A square never gets smaller than the **minimum square size** setting, however far you zoom out.
- **Links.** Thin arrows link two *groups* where stairs or a pit lead from one to the other. Blue arrows go down, orange arrows go up. Neighbouring cells inside a group get no lines: being next to each other already says they connect.
- **Markers.** The region you are in has a white outline, and the regions on your current path have a thin blue one. A hovered cell gets a light outline and a clicked cell a yellow one.
- **Not on map.** A location the map cannot place on a tile is listed in a yellow line above the map. It is never dropped silently.

Hover over a cell to see its name and its counts (checked, accessible and inaccessible locations). Hover over a square to see the location's name and state.

## Moving around

- **Drag** to pan, and use the **mouse wheel** to zoom around the cursor.
- **Centre on start** goes to the start region. **Fit all** shows the whole map.
- **Follow player** keeps your current region in the middle of the view: the view glides there whenever you move. Panning or zooming by hand turns it off, and the checkbox shows that. Tick it again to turn it back on.

Clicking a cell selects it (a yellow outline) and nothing more. In this version, moving and checking locations are done from other panels.

## Discovery mode

With discovery mode on, regions you have not discovered are not drawn. A region you can already enter from a discovered one is drawn as a grey **fog** cell with a question mark, with no picture and no squares. Untick **Show undiscovered** to hide the fog cells too.

## Controls and settings

| Control | Setting | Default | What it does |
|---|---|---|---|
| Follow player | `followPlayer` | on | Keep the current region centred |
| Show undiscovered | `showUndiscovered` | on | Discovery mode: draw fog cells for regions you can reach next |
| Links | `showLinks` | on | Draw the arrows between groups |
| Cells | `cellSize` | sized by level | **Sized by level**: one tile scale for every level, so a small level looks small. **Uniform**: every level scaled to fill the same square |
| Grouping | `groupingRule` | R1 | How regions are grouped. **R1** groups everything joined by doors and teleporters |
| — | `minSquarePx` | 6 | The smallest a location square gets on screen, in pixels |

The settings are under **Region Map** in the Settings panel (`moduleSettings.regionMap.*`).
