### Module: `Presets`

- **ID:** `presets`
- **Purpose:** Provides a UI to load predefined game configurations (`rules.json` files) from the server, or to load a custom `rules.json` file from the user's local machine. It acts as a primary entry point for getting game logic into the application.

---

#### Key Files

- `frontend/modules/presets/index.js`: The module entry point for registration.
- `frontend/modules/presets/presetUI.js`: The UI class that renders the panel and handles the file loading logic.
- `frontend/presets/preset_files.json`: The index file that this module reads to discover all available predefined presets.

#### Responsibilities

- **Discover Presets:** On initialization, it fetches and parses `preset_files.json` to build a list of available games and their corresponding preset seeds.
- **Render Preset List:** Displays the available presets, organized by game. It has special UI handling for multi-world presets to allow the user to select a specific player's ruleset.
- **Load Predefined Presets:** When a user selects a preset, it constructs the file path, fetches the appropriate `rules.json` from the `presets/` directory on the server, and publishes its content.
- **Load Custom Files:** Provides a **"Load JSON File"** button that opens a file dialog, allowing a user to select a `rules.json` file from their local computer.
- **Publish Loaded Data:** After loading a rules file (either from a preset or a custom file), its primary job is to publish the parsed JSON data on the `files:jsonLoaded` event. This decouples it from the `StateManager`, allowing a central handler in `init.js` to process the loaded data.

#### Events Published

- `files:jsonLoaded`: This is the module's most important event. It is published with the content of the newly loaded `rules.json` file and the selected player ID.
- `ui:notification`: Publishes user-friendly success or error messages (e.g., "Preset loaded successfully," "Error parsing JSON file").
- `rules:loaded`: A general-purpose event to signal that a ruleset is now active, which can be used by other components for simple triggers.

#### Events Subscribed To

- `app:readyForUiDataLoad`: Listens for this event to trigger its initial fetch of `preset_files.json`.

#### Public Functions (`centralRegistry`)

This module does not register any public functions.

#### Dependencies & Interactions

- **`init.js`**: The `Presets` module relies on `init.js` to listen for the `files:jsonLoaded` event. When `init.js` receives this event, it is responsible for commanding the `StateManager` to load the new rules. This creates an indirect but crucial interaction.
- **StateManager**: Does not interact with the `StateManager` directly. The data it publishes is consumed by the `StateManager` via the `init.js` handler. This makes the `Presets` module a data provider for the state system.
- **Server File Structure**: Depends on a correctly configured `frontend/presets/` directory on the web server, containing a `preset_files.json` index and subdirectories for each game's preset files.
