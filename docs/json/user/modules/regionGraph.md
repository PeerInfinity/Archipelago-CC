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

Worlds without sub-regions (most Archipelago worlds) look the same either way. Changing it redraws the graph, keeping the regions where they were. The setting is `moduleSettings.regionGraph.subRegionView` (`separate`, `nested` or `merged`); a later option will add one more way to group sub-regions.

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

## Where its state and actions live

The Region Graph draws; it no longer decides. Whether a region is reachable, how many of its locations are checked or accessible, and whether discovery mode hides it or shows it as `???` all come from the shared region view model (`frontend/modules/regionView/regionViewModel.js`). What a click does is a list of registered click actions (`frontend/modules/regionView/clickActions.js`), shown and edited by the shared **On click** strip (`frontend/modules/regionView/clickActionsUI.js`); the actions themselves move the player, edit the path or check locations through the shared region actions (`frontend/modules/regionView/regionActions.js`). The Region Map panel uses the same files. See `frontend/modules/regionView/README.md`.
