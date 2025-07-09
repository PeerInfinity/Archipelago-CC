### Module: `Inventory`

- **ID:** `inventory`
- **Purpose:** Provides the primary user interface for viewing and manually interacting with the player's collection of items.

---

#### Key Files

- `frontend/modules/inventory/index.js`: The module's entry point for registration.
- `frontend/modules/inventory/inventoryUI.js`: The UI class that renders the inventory panel, including item groups and buttons.

#### Responsibilities

- **Display All Items:** Renders a comprehensive list of all possible items for the current game, organized into collapsible categories (e.g., "Swords", "Dungeon Items", "Events").
- **Track Item Counts:** Displays the current count of each item the player possesses using a badge on the item button.
- **User Interaction:** Allows the user to manually add or remove items from their inventory.
  - **Click:** Adds one to the item's count.
  - **Shift+Click:** Removes one from the item's count.
- **Dispatch Events:** When an item button is clicked, it does not modify the state directly. Instead, it publishes a `user:itemCheck` event to the `eventDispatcher`. This allows other modules (like `Client` or `StateManager`) to handle the action appropriately (e.g., send a `!getitem` command to the server or update the local state).
- **Live Updates:** Automatically updates the display (item counts, active status) whenever the game state changes.
- **Filtering and Sorting:** Provides UI controls to:
  - Hide unowned items to declutter the view.
  - Hide categories and show a single flat, alphabetized list.
  - Sort items alphabetically within their categories.

#### Events Published

This module does not publish its own unique events. Its primary role is to initiate an event on the dispatcher.

- **Dispatches to `eventDispatcher`**: `user:itemCheck` when an item button is clicked, containing the item name and whether SHIFT was pressed.

#### Events Subscribed To

- `app:readyForUiDataLoad`: Listens for this to perform initial setup.
- `stateManager:rulesLoaded`: When a new `rules.json` is loaded, the `InventoryUI` uses this event to get the complete list of items and groups for the new game, and then rebuilds its entire UI structure.
- `stateManager:snapshotUpdated`: Listens for any state change to re-render its display, ensuring item counts and active states are always accurate.
- `settings:changed`: Listens for settings changes to update its behavior (e.g., default sorting).

#### Public Functions (`centralRegistry`)

This module does not register any public functions.

#### Dependencies & Interactions

- **StateManager**: The `Inventory` module is a display layer for the inventory data held within the `StateManager`. It gets the static list of all items and groups from the `staticDataCache` and reads the current item counts from the `snapshot` to render its display.
- **EventDispatcher**: It is the initiator of the `user:itemCheck` command flow. This is the crucial decoupling step that allows the `Client` module to intercept the command when online, or the `StateManager` to handle it when offline.
