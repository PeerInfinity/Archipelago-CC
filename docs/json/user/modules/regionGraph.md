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
  - **Location** (a click on a location node):
    - **Check the location** — *Check it now*, *Add the check to the path* (the route above takes you to its region first), or *off*.
- Other panels can add actions of their own to these lists. An action whose panel is not loaded keeps its setting and shows greyed out as *(not loaded)*.

The default is: extend the path to a clicked region and open it in the Regions panel; check a clicked location. The settings are kept per panel (`moduleSettings.regionGraph.clickActions`). The first time the panel opens, it carries over what the old **On Region Node Click** checkboxes were set to. The old *Move player one step towards region* option is gone: a click goes all the way.

## Controls

Click the +/- toggle at the top to expand the control panel:

### Main Controls
- **Reset View** — Zoom to fit all nodes
- **Re-layout** — Recalculate node positions using the layout algorithm
- **Export Positions** — Download current node positions as a JSON file

### Go to (instead of clicking a node)
A folded section under the main controls. Type or choose a **Region** or a **Location** by name: it does exactly what clicking that node does (the **On click** strip's actions apply), and centres the view on it. The lists hold the regions the graph shows and every location in them, drawn as a node right now or not. Useful when a node is hard to find or click, or from the keyboard.

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
