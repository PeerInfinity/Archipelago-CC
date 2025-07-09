### Module: `Dungeons`

- **ID:** `dungeons`
- **Purpose:** Displays a list of all dungeons in the game, showing their contents and logical status. This panel provides a focused view for players to track their progress through the major keyed areas of a world.

---

#### Key Files

- `frontend/modules/dungeons/index.js`: The module's entry point for registration.
- `frontend/modules/dungeons/dungeonUI.js`: The UI class that renders the panel, including the collapsible dungeon blocks.

#### Responsibilities

- **Render Dungeon List:** Fetches the list of all dungeons for the current game from the `StateManager`'s static data.
- **Display Dungeon Details:** Renders each dungeon as a collapsible block. When expanded, it shows:
  - A list of all the **regions** that make up the dungeon.
  - The name of the dungeon's **boss**.
  - The logic tree for the **defeat rule** of the boss.
  - The logic tree for any **medallion requirement** to enter the dungeon.
- **Show Live Status:** The panel is fully reactive to the player's inventory. As the player collects items, the defeat and medallion rule trees will update to show their current pass/fail status.
- **Interactive Navigation:** The region names listed within a dungeon block are clickable links (provided by `commonUI`). Clicking a region name will navigate the user to that specific region in the "Regions" panel.

#### Events Published

- `ui:navigateToRegion`: Published indirectly when a user clicks on a region name link within a dungeon block.

#### Events Subscribed To

- `app:readyForUiDataLoad`: To trigger its initial UI setup.
- `stateManager:ready`: To perform its first full render once the `StateManager` has loaded the initial game data and snapshot.
- `stateManager:snapshotUpdated`: Listens for all state changes to re-evaluate and re-render the status of all displayed rules.
- `stateManager:rulesLoaded`: To get the new static list of dungeons when a new game is loaded.
- `ui:navigateToDungeon`: Listens for requests from other panels to scroll to and highlight a specific dungeon.
- `settings:changed`: To update its display based on settings like `colorblindMode`.

#### Public Functions (`centralRegistry`)

This module does not register any public functions.

#### Dependencies & Interactions

- **StateManager**: The `Dungeons` module gets its static dungeon definitions (including boss and medallion rules) from the `StateManager`'s `staticDataCache`. It uses the `StateSnapshotInterface` to evaluate the rules for display.
- **CommonUI**: It uses `commonUI.renderLogicTree` to visualize the medallion and boss defeat rules, and `commonUI.createRegionLink` for navigation links.
- **Regions Module & Locations Module**: The `Dungeons` module provides valuable context. A user can see which regions make up a dungeon and then click a link to navigate to the `Regions` panel to see the exits and locations within that part of the dungeon.
