### Module: `JSON Operations`

- **ID:** `json`
- **Purpose:** Provides a centralized UI for managing the application's complete configuration state. It allows users to save, load, and manage different "modes," where a mode is a collection of all configuration files and runtime data.

---

#### Key Files

- `frontend/modules/json/index.js`: Module entry point and registration.
- `frontend/modules/json/jsonUI.js`: The UI class that renders the panel and handles the save/load logic.
- `frontend/modes.json`: A core configuration file that defines the default file paths for different application modes (e.g., `default`, `test`, `adventure`).

#### Responsibilities

- **Aggregate Configuration:** Gathers all current application configuration and state into a single, comprehensive JSON object. This includes:
  - `rulesConfig`: The currently loaded `rules.json`.
  - `moduleConfig`: The module manifest from `modules.json`.
  - `layoutConfig`: The current Golden Layout state.
  - `userSettings`: The current application settings from `settings.json`.
  - **Module-Specific Data:** Any data registered by other modules (e.g., the test list from the `Tests` module, or runtime inventory from the `StateManager`).
- **Save to File:** Allows the user to download the aggregated configuration object as a single `.json` file. The user can select which parts of the configuration to include.
- **Load from File:** Allows the user to upload a previously saved combined JSON file. This will apply the configurations and data from the file to the current session. Non-reloading data (like `stateManagerRuntime`) is applied live.
- **Manage LocalStorage Modes:**
  - **Save:** Saves the aggregated configuration to the browser's `localStorage` under a user-provided mode name.
  - **Load:** Displays a list of all modes saved in `localStorage` and allows the user to set one as active for the next session (requires a page reload).
  - **Delete:** Allows the user to remove saved modes from `localStorage`.
- **Display `modes.json`:** Shows a read-only list of the modes predefined in `frontend/modes.json`, with a button to reload the application into that specific mode via a URL parameter (`?mode=...`).
- **Module Data Integration:** Provides a mechanism (`centralRegistry.registerJsonDataHandler`) for other modules to register their own data to be included in the save/load process.

#### Events Published

- `ui:notification`: Publishes success or error messages to the user.
- It can indirectly trigger nearly every application event by loading a new configuration that causes `init.js` to re-initialize the application on the next load.

#### Events Subscribed To

- `app:activeModeDetermined`: Listens for the initial mode determined by `init.js` to update its display.
- `app:modesJsonLoaded`: Listens for the `modes.json` file to be loaded so it can display the list of predefined modes.

#### Public Functions (`centralRegistry`)

This module does not register any public functions.

#### Dependencies & Interactions

- **`init.js`**: The `JSON` module's functionality is deeply tied to the loading logic in `init.js`. `init.js` is responsible for reading the "last active mode" from `localStorage` (which `JsonUI` sets) and loading the corresponding data at startup.
- **`centralRegistry`**: It reads the list of registered JSON data handlers from the registry to dynamically create checkboxes for module-specific data and to call the correct save/load functions for them.
- **All Modules:** It can interact with almost any module that registers a JSON data handler, allowing for a complete application state snapshot.
- **`settingsManager`**: It gets the current `userSettings` from the `settingsManager` when saving.
- **Golden Layout**: It calls `goldenLayoutInstance.toJSON()` to get the current live layout state when saving.
