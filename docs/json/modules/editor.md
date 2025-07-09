### Module: `Editor`

- **ID:** `editor`
- **Purpose:** Provides a simple, read-only UI panel for developers and advanced users to inspect key JSON data objects currently active in the application.

---

#### Key Files

- `frontend/modules/editor/index.js`: Module entry point and registration.
- `frontend/modules/editor/editorUI.js`: The UI class for the panel, which primarily manages a `<textarea>` element.

#### Responsibilities

- **Data Display:** The primary responsibility is to display the content of various internal JSON data structures in a formatted, human-readable way.
- **Source Switching:** Provides a dropdown menu to switch between different data sources:
  - **Active Rules JSON:** Shows the complete `rules.json` object that is currently loaded into the `StateManager` worker. This is useful for debugging game logic and rule evaluation.
  - **Loaded Mode Data:** Shows the aggregated configuration object (`G_combinedModeData`) for the current application mode, which includes `rulesConfig`, `moduleConfig`, `layoutConfig`, and `userSettings`.
- **Data Source Provenance:** When displaying the "Loaded Mode Data", the editor prepends a comment block detailing the origin of each configuration part (e.g., loaded from `localStorage` or a specific file path). This is crucial for debugging configuration issues.
- **Live Updates:** Listens for application events and automatically updates its content when new data is loaded.

#### Events Published

This module does not publish any events.

#### Events Subscribed To

The `EditorUI` listens for events to know when to update its content sources.

- `stateManager:rawJsonDataLoaded`: Fired when the `StateManager` receives a new `rules.json` object. This updates the "Active Rules JSON" view.
- `app:fullModeDataLoadedFromStorage`: Fired by `init.js` after the application has fully loaded and assembled the combined data for the active mode. This updates the "Loaded Mode Data" view.

#### Public Functions (`centralRegistry`)

This module does not register any public functions.

#### Dependencies & Interactions

- **StateManager**: Listens for the `rawJsonDataLoaded` event to get the active ruleset.
- **`init.js`**: Listens for the `fullModeDataLoadedFromStorage` event to get the combined mode configuration object (`G_combinedModeData`).
- **JSON Module**: The "Loaded Mode Data" view is a direct reflection of the data that the `JSON` module can save and load, making the `Editor` a useful tool for verifying the contents of a saved mode.

#### Alternative Implementations

The project contains scaffolding for two alternative, more advanced editor implementations that are not currently active:

- **`editor-vanilla-jsoneditor`:** Uses the `vanilla-jsoneditor` library to provide a tree-view and other advanced editing features. It was disabled due to performance issues.
- **`editor-codemirror`:** An unfinished module intended to use the CodeMirror library to provide a text editor with syntax highlighting for JSON.
