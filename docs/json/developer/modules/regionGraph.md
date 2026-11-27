# Region Graph Module

**Module ID:** `regionGraph`

**Purpose:** Provides an interactive visualization of the game world's region connectivity using Cytoscape.js. Displays regions as nodes and exits as edges, with real-time updates showing accessibility status, location counts, and player position.

## Key Files

- `frontend/modules/regionGraph/index.js` - Module entry point and registration
- `frontend/modules/regionGraph/regionGraphUI.js` - Main UI class managing the graph visualization
- `frontend/modules/regionGraph/graphDataManager.js` - Graph data structure and visual updates
- `frontend/modules/regionGraph/graphInteractionManager.js` - User interactions with graph nodes and edges
- `frontend/modules/regionGraph/navigationManager.js` - Player movement and pathfinding logic
- `frontend/modules/regionGraph/layoutControlsManager.js` - Control panel and layout editor management
- `frontend/modules/regionGraph/regionGraphLayoutEditor.js` - Graph layout editing functionality
- `frontend/modules/regionGraph/pathfinder.js` - Pathfinding algorithm implementation
- `frontend/modules/regionGraph/regionGraphOriginators.js` - The `source` / `originator` strings its dispatches carry
- `frontend/modules/regionGraph/nodeLook.js` - The `nodeLook` setting (`graph` | `map`; `map` takes effect only with `subRegionView` = `merged`) and its control's sync
- `frontend/modules/regionGraph/mapLookLayer.js` - `nodeLook` = `map`: draws each node as its Region Map cell (the Region Map's model, frames and `regionMap/regionMapCellDraw.js`) on one canvas under Cytoscape's; each map node gets a style bypass (a rectangle at its cell's aspect, body and label transparent); squares re-colour from `regionView/regionViewState.js`; `squareAtNode` lets a tap on a square run the location click
- `frontend/modules/regionGraph/layoutRun.js` - One layout run at a time: every panel layout starts through `startLayout` and a rebuild or new layout replaces a running one through `supersedeLayout`. A run SETTLES once, on its own `layoutstop` (after its last position change, animated or not): positions saved, location nodes and player re-seated, "Layout complete", `isLayoutRunning` cleared, the cy event `rg-layoutsettled`, `whenLayoutSettled(ui)` resolved. A superseded run never settles; `layoutRunOf(cy)` gives a reader holding only the cy (an in-app row) the same state
- `frontend/modules/regionGraph/directionLayout.js` - The Direction-aware layout, pure: the per-exit preferred direction (door tile ÷ level extent: the door's side, tilted by its place along the side), the per-edge preference (a merged node takes its members' exits), a deterministic vector-spring relaxation with a final overlap-free separation, the measures (overlaps, angle errors) and the three settings' schema entries (`directionStrength`, `directionSpacing`, `directionExits`); `layoutControlsManager.js` feeds it the graph as drawn (drawn sizes, the Region Map model from `mapLookLayer.js`'s `regionMapModel()`) and runs the result as a `preset` layout
- `frontend/modules/regionGraph/dungeonGroups.js` - The Direction-aware layout's Dungeon grouping, pure: the two settings' schema entries (`dungeonGrouping`: `none` | `soft` | `twoStep` | `twoStepBoxes`; `dungeonGroupStrength`), a node's dungeon from the Region Map model's `groupOf` (no second grouping), `groupedDirectionLayout` (`none` = the same `directionLayout` call; `soft` = its `dungeonPull` term; `twoStep` = each dungeon alone, then the dungeons as rigid blocks laid out by the same relaxation), and the measures (mixing, block overlaps, intruders). `dungeonBoxLayer.js` draws `twoStepBoxes`' boxes as a DOM overlay under the canvas, never a Cytoscape element

**Where state and actions live (region map step 2).** The renderer-agnostic answers are in `frontend/modules/regionView/`: `regionViewModel.js` (reachability, location states and counts, the interior and colour states, exit traversability, the one discovery hide/placeholder decision, the `displayRegionOf` fold) and `regionActions.js` (moves, the restart step, path edits, location checks, select/show publishes). `graphDataManager.js` turns those answers into Cytoscape classes and labels; `navigationManager.js` and `graphInteractionManager.js` supply the Region Graph's own handles (its `moduleDispatcher`, its event bus) and show the results (the status bar, the "No path" flash). The Region Graph does not use `regionView/regionViewState.js` for its own nodes; its trigger wiring in `regionGraphUI.js` is unchanged. The one exception is the `map` node look (`mapLookLayer.js`), which colours its squares from a view state of its own, created only while that look is on. Equivalence instrument: `scripts/dev/region-graph-class-snapshot.mjs`.

## Responsibilities

- **Graph Visualization:** Renders interactive graph using Cytoscape.js with dynamic loading of library files
- **Region Display:** Shows regions as nodes with customizable labels and location counts (checked/accessible/inaccessible/total)
- **Exit Visualization:** Displays region connections as directional edges with support for bidirectional exits
- **Accessibility Coloring:** Updates node and edge colors based on real-time reachability status
- **Location Nodes:** Dynamically creates location nodes positioned around region nodes with zoom-based visibility
- **Hub Detection:** Identifies and styles hub regions (high-degree nodes) for better layout
- **Player Positioning:** Tracks and displays player location as a marker node on the graph
- **Path Visualization:** Highlights the current player path with visual indicators
- **Discovery Mode Integration:** Hides undiscovered regions/locations/exits with "???" placeholders
- **Layout Management:** Supports COSE-based layout algorithm with reset, re-layout, and position saving
- **Control Panel:** Provides UI controls for location visibility, player movement, and settings

## Events Published

| Event | Description |
|-------|-------------|
| `ui:activatePanel` | Activates the Region Graph panel |
| `ui:navigateToRegion` | Navigates to a specific region in the panel |
| `user:regionMove` | User attempts to move player to a region |
| `user:locationCheck` | User checks a location |
| `regionView:regionClicked` / `regionView:locationClicked` | Every region / location click, `{ panelId: 'regionGraph', regionName, locationName? }`, before the click actions (CA-S4). A click on an overlay card's body publishes it too, once. They are the only click events the Graph publishes: CA-S5 retired `regionGraph:nodeSelected` |
| `ui:navigateToLocation` | The Regions panel's `regions.scrollTo` click action, on this bus |

## Events Subscribed To

| Event | Handler |
|-------|---------|
| `stateManager:snapshotUpdated` | Updates graph accessibility coloring when game state changes |
| `stateManager:rulesLoaded` | Loads graph data when new rules are loaded |
| `stateManager:ready` | Ensures graph is loaded once state manager is ready |
| `gameState:regionChanged` | Updates player location marker |
| `gameState:pathUpdated` | Updates path highlighting |
| `discovery:modeChanged` | Toggles discovery mode filtering |
| `discovery:settingsChanged` | Updates discovery display settings |
| `discovery:changed` | Updates graph visibility when discovery state changes |
| `app:readyForUiDataLoad` | Triggers initial Cytoscape library loading |

## Public Functions

This module does not register public functions in `centralRegistry`. It is primarily a UI panel component.

## Dependencies & Interactions

- **`stateManager`:** Uses `getStaticData()` for region/exit definitions, `getLatestStateSnapshot()` for current state
- **`settingsManager`:** Loads and saves display settings and location visibility
- **`eventBus`:** Primary communication mechanism with other modules
- **`discoveryStateSingleton`:** Queries discovery state for regions, locations, and exits
- **`gameState`:** Gets current player location and path data
- **`Cytoscape.js`:** External graph visualization library (dynamically loaded)
- **`ruleEngine`:** Evaluates location and exit access rules (through `regionView/regionViewModel.js`)
- **`regionView`:** The shared view model and actions (see Key Files)
- **`commonUI`:** Shared UI utilities

## Features

### Layout Management

The module supports multiple layout features:
- COSE-based automatic layout algorithm
- The Direction-aware layout (`directionLayout.js`): each neighbour placed towards its exit's door side, as a soft preference (vector springs), with Strength / Spacing / Exits used settings; deterministic (node ids sorted, no random, no clock) and overlap-free at the drawn size
- Dungeon grouping (`dungeonGroups.js`): keeps each Region Map group together in the Direction-aware layout, in four ways chosen by `dungeonGrouping`; inert (the same positions as `none`) when no drawn edge joins two groups
- Manual node dragging with position persistence
- Layout reset and re-layout functions
- "Layout complete" (and `isLayoutRunning = false`) means the nodes have stopped moving: `layoutRun.js` settles a run on its own `layoutstop`, never on another layout's, and nothing moves after it
- Export layout positions as JSON

### Discovery Mode

When discovery mode is enabled:
- Undiscovered regions show as "???"
- Undiscovered exits are hidden or shown as dashed lines
- Location counts only reflect discovered locations
- Regions become visible when entered by the player

### Location Display

Locations can be displayed as small nodes around their parent region:
- Visibility controlled by zoom level
- Color indicates accessibility status
- Click to check/uncheck locations
- Grouped in a ring pattern around the region node
