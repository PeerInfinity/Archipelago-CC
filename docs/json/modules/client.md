### Module: `Client`

- **ID:** `client`
- **Purpose:** Manages the WebSocket connection to the Archipelago server, processes incoming messages, and sends client commands.

---

#### Key Files

- `frontend/modules/client/index.js`: Module entry point, registration, and dispatcher handler setup.
- `frontend/modules/client/ui/mainContentUI.js`: The UI class for the main console and connection panel.
- `frontend/modules/client/core/connection.js`: Handles the low-level WebSocket connection, including connection, disconnection, and reconnection logic.
- `frontend/modules/client/core/messageHandler.js`: Processes all incoming messages from the server (e.g., `Connected`, `ReceivedItems`, `PrintJSON`) and updates the application state accordingly.
- `frontend/modules/client/utils/idMapping.js`: Provides utility functions to map server-side numeric IDs for items and locations to their human-readable names using the data package.

#### Responsibilities

- Establishes and maintains a WebSocket connection to an Archipelago server.
- Handles the authentication handshake (`Connect` command).
- Requests and processes the game's `DataPackage` for ID-to-name mappings.
- Listens for and processes all incoming server messages.
- Updates the `StateManager` (via commands to its proxy) with state changes received from the server, such as received items or locations checked by other players.
- Sends commands to the server, such as location checks, chat messages (`Say`), and status updates.
- Provides the main UI panel for server connection, console output, and command input.

#### Events Published

This module does not directly publish many global events on the `eventBus`, as most of its actions result in calls to the `StateManager`, which then publishes state changes. However, its sub-components (like `connection.js`) publish events to which `messageHandler.js` subscribes. The most relevant events it might publish for other modules are:

- `game:connected`: Published when the connection and authentication handshake is successfully completed.
- `game:roomInfo`: Published when server room information is received.
- `network:connectionRefused`: Published when the server refuses the connection attempt.

#### Events Subscribed To

- **`eventDispatcher`**:
  - `user:locationCheck`: Listens for location check requests. If connected to a server, it takes priority, gets the server ID for the location, and sends the check command. If not connected, it propagates the event for local handling.
- **`eventBus`**:
  - `connection:open`, `connection:close`, `connection:message`: The internal `messageHandler` listens to these events from the `connection` object to process server data.

#### Public Functions (`centralRegistry`)

This module does not register any public functions for other modules to call. Interactions are primarily handled through the `eventDispatcher`.

#### Dependencies & Interactions

- **StateManager**: The `Client` module is a primary consumer and mutator of state. It calls `stateManagerProxySingleton.addItemToInventory()` when `ReceivedItems` packets arrive and `stateManagerProxySingleton.checkLocation()` when location updates are received. It also reads static data from the `StateManager` to map location names to server IDs.
- **EventDispatcher**: It is a key participant in the `user:locationCheck` event chain, acting as the authoritative handler when an online session is active.
- **Timer Module**: The Client module's `MainContentUI` traditionally hosts the `TimerUI` component, providing the placeholder element for it.
