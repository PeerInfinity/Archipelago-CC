# Region Graph Panel

The Region Graph provides an interactive visual map of the game world using a node-and-edge graph. Regions appear as nodes, exits as directional edges, and the display updates in real time as your accessibility changes.

## Graph Display

- **Region nodes** — Rectangular nodes showing the region name. Hub regions (with many connections) are drawn larger.
- **Location nodes** — Smaller nodes around their parent region, visible at higher zoom levels.
- **Player marker** — A blue dot showing your current position.
- **Edges** — Directional arrows between regions. Bidirectional exits show arrows on both ends.

### Color Coding

| Color | Meaning |
|-------|---------|
| **Green border** | Region or exit is accessible |
| **Dark green fill** | All locations in this region are accessible |
| **Gold fill** | Mix of accessible and inaccessible locations |
| **Red fill** | All locations inaccessible |
| **Black fill, green border** | All locations checked (completed) |
| **Gray** | Inaccessible region or exit |
| **Purple border** | Region is in the current path |
| **Yellow border** | Current region (player location) |

### Zoom-Based Detail

The graph adjusts detail based on zoom level. Zooming in progressively reveals:
1. Region names
2. Location counts (checked/accessible/inaccessible out of total)
3. Edge labels
4. Location nodes
5. Location labels

## The "On click" strip

What a click on the graph does is set in the **On click** strip at the top right of the panel, separate from the Controls.

- **Folded**, it is one line saying what a click does — for example *On click: extend path · Regions — location: check* — with the **⏸** switch beside it. **⏸** turns every click action off at once (a click then only selects the node); **▶** turns them back on. The line then reads *On click: ⏸ paused*.
- **Unfolded** (press **▸**), it lists the actions in two groups:
  - **Region** (a click on a region node):
    - **Route to the region** — *Extend the path from its end*, *Restart the path from the start*, *Move the player there*, or *off*. A route always goes all the way to the region.
    - **Check all accessible locations there**.
    - **Open it in the Regions panel** — opens the [Regions](regions.md) panel at the region. It is there while the Regions panel's module is loaded.
    - **Discover the region** — in [Discovery mode](discoveryPanel.md), discovers a clicked undiscovered region. It does something only while Discovery mode is on and **Click Discovers Region** is ticked (loop mode turns that off). On by default here.
    - **Teleport there in Flash** — the [Flash panel](flashPanel.md) teleports the player to the clicked region. It is there while the Flash panel runs a game that can teleport. Its first value is what the Flash panel's **TP on UI click** box was at that moment (normally unticked, so off); after that this option decides, not the box.
    - **Centre the Region Map on it** — the [Region Map](regionMap.md) eases its view onto the clicked region. Off by default.
  - **Location** (a click on a location node):
    - **Check the location** — *Check it now*, *Add the check to the path* (the route above takes you to its region first), or *off*. The [Regions](regions.md) panel's own location clicks follow this choice too.
    - **Teleport to it in Flash** — as above, for a location. Same first value.
    - **Scroll the Regions panel to it** — opens the Regions panel at the location and highlights it. Off by default.
- Other panels can add actions of their own to these lists. An action whose panel is not loaded keeps its setting and shows greyed out as *(not loaded)*.
- Actions run in this order: discover and teleport first, then the route, then the checks, then the rest.

The default is: extend the path to a clicked region and open it in the Regions panel (and, in Discovery mode, discover it); check a clicked location. The settings are kept per panel (`moduleSettings.regionGraph.clickActions`). The first time the panel opens, it carries over what the old **On Region Node Click** checkboxes were set to. The old *Move player one step towards region* option is gone: a click goes all the way.

## Controls

Click the +/- toggle at the top to expand the control panel:

### Main Controls
- **Reset View** — Zoom to fit all nodes
- **Re-layout** — Recalculate node positions using the layout algorithm
- **Export Positions** — Download current node positions as a JSON file

### Go to (instead of clicking a node)
A folded section under the main controls. Type or choose a **Region** or a **Location** by name: it does exactly what clicking that node does (the **On click** strip's actions apply), and centres the view on it. The lists hold the regions the graph shows and every location in them, drawn as a node right now or not. Useful when a node is hard to find or click, or from the keyboard.

### Sub-regions
Some worlds split one region into several **sub-regions** (a Seedling level is cut into rooms, `level_7__r0c3`, `level_7__r1c0`, …). **Draw as** chooses how the graph shows them:
- **Separate nodes** (the default) — every sub-region is its own node, as the graph always drew it.
- **Nested in region boxes** — each region split into two or more sub-regions gets a dashed box labelled with the region's name (`level_7`), with its sub-regions drawn inside. Exits still connect the exact sub-regions. A region with a single sub-region has no box. The box's border and tint follow its sub-regions together: green when any of them is accessible, gray when none is, and the fill sums their locations (dark green, gold, red, or black when all are checked) — the same rule the [Region Map](regionMap.md) uses for a whole region. A box is not a region: clicking it does nothing (click a sub-region inside it), it is not in the **Go to** list, and it is never part of a path.
- **Merged into one node per region** — each region split into two or more sub-regions is drawn as ONE node (a double border marks it), labelled with the region's name and its sub-regions' location counts summed. Its colour follows the same rule as a box's. Hover it to list its sub-regions. Exits between two of its own sub-regions are not drawn; an exit to another region ends on the merged node, and several exits between the same two nodes are drawn as one edge — hover that edge to see each exit, from which sub-region to which, with ✓ (passable now) or ✗. The edge is green when ANY of its exits is passable. Clicking a merged node runs the **On click** Region actions on one of its sub-regions: the one the [Region Map](regionMap.md) picks when you click that region (the region itself if it is one of its sub-regions, else the first). **Go to** still lists every sub-region by name and takes you to its merged node. A path drawn through sub-regions is drawn through the merged nodes; moving between two sub-regions of the same region draws no edge. The player marker sits on the merged node of the sub-region the player is in. With location nodes shown, a merged node carries all its sub-regions' locations in one ring. Its layout is kept separately: arranging the merged graph never moves the nodes of the **Separate nodes** graph, and switching back shows that layout as you left it.
- **Collapsible (click + to open)** — starts exactly like **Merged**: every region split into sub-regions is one node, with the same colours, hover, edges and click. Each of those nodes also has a small round **+** badge on its top-right corner. Click (or tap) the **+** to open that one region into its box, as in **Nested**: its sub-regions appear around where the merged node was, with their own exits, while every other region stays merged. The open box has a **−** badge on its corner; click it to close the region back into one node, placed at the centre of its sub-regions. Opening or closing does not re-arrange the rest of the graph or move the view. A badge only opens and closes: it never runs your **On click** actions. Clicking the node itself still runs them, exactly as in **Merged**; an open box, as in **Nested**, does nothing, and its sub-regions run their own. The badges show at the zoom levels where region names show, and are hidden when you zoom out further (zoom in to use them). Which regions are open is remembered per world for the session (switching **Draw as** to another option and back keeps them), and every region starts closed when the page is reloaded. Opening or closing never changes the **Separate nodes** or **Merged** layouts.

Worlds without sub-regions (most Archipelago worlds) look the same in every option. Changing it redraws the graph, keeping the regions where they were. The setting is `moduleSettings.regionGraph.subRegionView` (`separate`, `nested`, `merged` or `collapsible`).

**Node look** (beside **Draw as**) chooses how each node is drawn:
- **Graph nodes** (the default) — the graph's own coloured nodes, as above.
- **Region Map cells** — each node is drawn as that region's cell on the [Region Map](regionMap.md): the level's picture (on worlds with level art, such as Seedling; a plain dark cell on worlds without, such as A Link to the Past), its location squares coloured by state (green accessible, red not yet, grey checked, light grey unknown), and its name in the top-left corner once the cell is wide enough. It is the Region Map's own drawing, so the two panels always look alike. The nodes stay where the graph's layout put them; each becomes a rectangle shaped like its level. The border keeps the graph's colours (green when accessible, yellow for the player's region, purple on the path, red when selected), and the edges, the player marker and the location nodes are drawn on top. Click a location square to run the **On click** Location actions on that location, as on the Region Map; click anywhere else on the node to run the Region actions, as usual. A region with no Region Map cell (Seedling's `Menu`) keeps its graph node.

  **Region Map cells** works with **Draw as: Merged into one node per region** only, the view that draws one node per region as the Region Map does. With any other **Draw as** the nodes are drawn as **Graph nodes**, and the **Node look** box is greyed out with a note saying so; your choice is kept and comes back when you switch to **Merged**. Changing **Node look** does not redraw or re-arrange the graph. The setting is `moduleSettings.regionGraph.nodeLook` (`graph` or `map`).

The force-directed layouts (**Force-Directed**, COSE) arrange the boxes around their sub-regions. The layouts that do not know about boxes (breadth-first, circle, grid, concentric, the procgen grid, a preset) place the sub-regions as usual and draw each box around wherever its sub-regions landed, so a box can be large or overlap another; use **Re-layout** with a force-directed layout for a tidy picture.

### Location Visibility
- **Always show/hide locations** — Override zoom-based location visibility
- **Max location nodes** — Limit the number of location nodes rendered (0 = unlimited)
- **Keep region sets complete** — Allow exceeding the limit to avoid splitting a region's locations
- **Only show locations in view** — Only render location nodes within the current viewport
- **Viewport stabilize delay** — Debounce delay before refreshing viewport-filtered locations

### Discovery Mode
When discovery mode is active, a checkbox appears to show or hide undiscovered regions and exits.

## Interactions

| Action | Effect |
|--------|--------|
| **Click region node** | Selects it and runs the **On click** strip's Region actions |
| **Click location node** | Runs the strip's Location actions (by default, checks the location) |
| **Drag a region node** | Reposition it manually (positions persist until re-layout) |
| **Scroll/pinch** | Zoom in and out |
| **Click and drag background** | Pan the view |

## Layout

The graph uses the COSE (Compound Spring Embedder) layout algorithm to automatically position nodes. You can manually drag nodes to adjust positions after the layout runs. Use **Re-layout** to recalculate positions, or **Export Positions** to save your arrangement.

### Direction-aware layout

The **Direction-aware** layout places each neighbouring region on the side of the exit that leads to it, the way a map would: if a level's door to another level is on its east edge, that neighbour goes to its right. Where the door sits along the edge matters too, so a level with two doors on its east edge, one near the top and one near the bottom, puts the first neighbour up-and-right and the second down-and-right. This is a preference, not a rule: when two neighbours want the same spot, or the exits disagree, each node is placed as close to where its exit points as the others allow, and no two nodes overlap.

Run it from **Controls → Direction-aware layout → Run Direction-aware layout**, or choose **Direction-aware (exit sides)** in the Layout Editor's **Layout Preset** list. It works with every **Draw as** choice and both **Node look**s (with **Region Map cells**, the nodes are kept apart at their rectangle size). In **Merged**, a region's node points the way its sub-regions' exits point. The same graph and settings always give the same arrangement.

Only worlds whose regions carry door positions (generated and Seedling worlds, maze levels) have exit directions. In a world without them (for example A Link to the Past) the layout is a plain spring layout.

| Setting | Range | Default | What it does |
|---|---|---|---|
| **Strength** | 0 – 1 | 0.7 | How strongly each neighbour is pulled to its exit's side. 0 ignores the exit directions (a plain spring layout); 1 is as map-like as the graph allows. |
| **Spacing (px)** | 0 – 300 | 40 | The gap aimed for between two neighbouring nodes' borders. Larger spreads the graph out. |
| **Exits used** | Border doors only, All doors | Border doors only | Which exits give a direction. **Border doors only** uses the doors on a level's edge (the walk-off-the-edge kind). **All doors** adds the doors inside a level (staircases, teleporters), which often lead somewhere unrelated to where they sit. |

Changing a setting while the Direction-aware layout is the one shown re-runs it straight away; otherwise the new value is used the next time you run it. The settings are `moduleSettings.regionGraph.directionStrength`, `directionSpacing` and `directionExits`. Like every layout, it moves the nodes of the view you are in only (each **Draw as** choice keeps its own positions), and opening or closing a group in **Collapsible** keeps the positions as they are.

#### Dungeon grouping

**Dungeon grouping** (in the same section) keeps each dungeon's levels together, apart from the other dungeons. A dungeon is one of the Region Map's groups: levels you walk between by their edges belong together, and a doorway, staircase or teleporter into another group does not join the two. In **Separate** and **Nested**, a level's sub-regions belong to that level's dungeon. Nodes the Region Map does not place (the Menu) belong to no dungeon.

| Value | What you see |
|---|---|
| **Off (as before)** (the default) | The Direction-aware layout exactly as above. Nodes from different dungeons can sit side by side. |
| **Soft pull together** | One layout, with each node also pulled towards its own dungeon and pushed away from nearby nodes of other dungeons. Dungeons mostly read as clusters, but some exit directions bend to make room. **Dungeon pull** (0 – 1, default 0.5) sets how strongly; 0 is the same as Off. |
| **Two-step layout** | Each dungeon is laid out on its own first, then the dungeons are placed as solid blocks, with a gap, each pulled towards the dungeons it links to and to the side its doors point to. Blocks never overlap, so no node lands inside another dungeon's area. |
| **Two-step + boxes** | The same arrangement, plus a faint dashed box round each dungeon of two or more nodes, labelled with the dungeon's name (its first level, the one you enter it by). The box is only a drawing: it cannot be clicked, picked or pathed to, and it is not saved with the positions. It stays until another layout runs or the graph is redrawn. |

In a world with no dungeons that link to each other (for example A Link to the Past, or a single maze), every value gives the same arrangement as **Off**. The settings are `moduleSettings.regionGraph.dungeonGrouping` (`none`, `soft`, `twoStep`, `twoStepBoxes`) and `moduleSettings.regionGraph.dungeonGroupStrength`; a change re-runs the layout when it is the one shown, like the other Direction-aware settings.

## Where its state and actions live

The Region Graph draws; it no longer decides. Whether a region is reachable, how many of its locations are checked or accessible, and whether discovery mode hides it or shows it as `???` all come from the shared region view model (`frontend/modules/regionView/regionViewModel.js`). What a click does is a list of registered click actions (`frontend/modules/regionView/clickActions.js`), shown and edited by the shared **On click** strip (`frontend/modules/regionView/clickActionsUI.js`); the actions themselves move the player, edit the path or check locations through the shared region actions (`frontend/modules/regionView/regionActions.js`). The Region Map panel uses the same files. See `frontend/modules/regionView/README.md`.
