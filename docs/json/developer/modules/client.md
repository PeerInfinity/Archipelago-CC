### Module: `Client`

-   **ID:** `client`
-   **Purpose:** Manages the WebSocket connection to the Archipelago server, processes incoming messages, sends client commands, and provides the primary UI for server interaction.

---

#### Key Files

-   `frontend/modules/client/index.js`: Module entry point, registration, and dispatcher handler setup.
-   `frontend/modules/client/ui/mainContentUI.js`: The UI class for the main console and connection panel.
-   `frontend/modules/client/core/apClient.js`: Handles the low-level WebSocket connection, including connection, disconnection, and reconnection logic (it replaced the former `connection.js`).
-   `frontend/modules/client/core/messageHandler.js`: Processes all incoming messages from the server (e.g., `Connected`, `ReceivedItems`, `PrintJSON`) and updates the application state accordingly.
-   `frontend/modules/client/utils/idMapping.js`: Provides utility functions to map server-side numeric IDs for items and locations to their human-readable names using the data package.

#### Responsibilities

-   Establishes and maintains a WebSocket connection to an Archipelago server.
-   Handles the authentication handshake (`Connect` command).
-   Requests and processes the room's `DataPackage` for ID-to-name mappings. `GetDataPackage` names the room's games plus `Archipelago` (`dataPackageRequestFor`): an upstream 0.6.8+ server answers only the games named, and a bare request gets nothing.
-   On connect, scouts every one of the slot's locations (`LocationScouts` with `create_as_hint: 0`, so no hints are created) and records what the server says each one holds.
-   Listens for and processes all incoming server messages.
-   Updates the `StateManager` (via commands to its proxy) with state changes received from the server, such as received items or locations checked by other players.
-   Sends commands to the server, such as location checks (`LocationChecks`), chat messages (`Say`), and status updates.
-   Provides the main UI panel for server connection, console output, and command input.
-   Acts as a primary "host" for the `Timer` module's UI, providing a placeholder for the progress bar and control buttons.

#### Which rules a room uses

For a game whose rules can be built from server data (Metamath, DepGraph, APCalc), the client builds them after login. For any other game the order is (`client/core/messageHandler.js`):

1. **The exact-seed preset**: a committed preset made from this room's seed, loaded as it is.
2. **The rules the server sends.** A world built by world_generator sends its own rules document in slot_data (`worldgen_rules`, an envelope `{format, player, doc}`; `world_generator/README.md`). The client checks it against the room (game, location and item IDs) and lays the server's placements and slot_data over it (`client/core/localRulesOverlay.js`).
3. **A local document** of a generated world: the loaded rules or a committed preset of the game at another seed, overlaid the same way.
4. **Wait.** With none of these, the client stays logged in but holds the Connected and runtime-state packets (no checks are sent), prints what it needs, publishes `client:rulesNeeded`, and continues once a document of that game loads.

Because slot_data only arrives with `Connected`, a game with no exact-seed preset and no builder always connects first and decides after login. A server document is refused by name and the client falls back to a local document when its `format` is not the client's `WORLDGEN_RULES_FORMAT` (an older or newer generator), when it carries a retired rules.json shape, when it fails the ID check, or when it fails to load. A world whose document was over its `rules_in_slot_data_max_kb` sends `worldgen_rules_omitted` instead, and the console says so.

#### The room's spoiler data

A world that uses the Spoiler Export Hook (`worlds/spoiler_export_hook/`, option `spoiler_data_in_slot_data`) sends its slot's sphere order in slot_data as `spoiler_data`: format 1, `steps` of `[walk label, own location or null, item received or null]`, plus `[sender player, sender location]` as a 4th element with `own_slot_with_senders`, and, with the world's `spoiler_data_include_regions`, `regions: {start, steps: [[row index, [region names]]]}` (the regions first reachable at the start and after that row). Each value is the AP id where the DataPackage gives that exact name back, otherwise the name. On `Connected`, `client/core/spoilerData.js` expands it with the DataPackage into an incremental sphere log and publishes it as `client:roomSpoilerData`. The expanded lines are those of the exporter's per-player sphere log (`json_tools.sphere_log_per_player`) for the same seed: a sender appears as the sending world's own entry on that line (`player_data[sender]`, empty deltas, `sphere_locations: [its location]`), and regions fill `new_accessible_regions`; `client/core/spoilerData.logFormat.test.js` compares the two line for line. Readers that look only at the current player's entry (sphereState, the cost planner, JTA balance and cost generator) ignore the senders' entries. **A file for the room's seed beats the room:** an exact-seed preset's `.jsonl` (or an embedded log) is kept, and replaces the room's log if it finishes loading later; a file for another seed loses to the room (the rule is in [sphereState](./sphereState.md)). The room's log fills the gap on the server-document, local-overlay and builder paths, which have no file log. `spoiler_data_omitted` gives one console line saying why (for example, the generator had no Spoiler Export Hook); with neither key nothing is said. A format the client does not read (`SPOILER_DATA_FORMATS`), another slot's record, or a game missing from the DataPackage gives a warning and no log. The overlay never copies `spoiler_data` or `spoiler_data_omitted` into the world's slot_data (`slotDataWithoutRules`). Fixtures: `client/core/fixtures/spoilerData/make_fixtures.py` regenerates them from the real helper. How a world sends the record: [Spoiler Export Hook developer notes](../guides/spoiler-export-hook.md).

The overlay also writes the room's item into each procgen pickup's sidecar entry (`playable_payload.items[].id`, and `locations[].item` for the Seedling generated rooms). A maze draws and collects a pickup only when its id is set, and a server-sent document carries none.

#### Events Published

While most of its actions result in calls to the `StateManager` (which then publishes state changes), the `Client` module's core components publish key network status events on the `eventBus`:

-   `game:connected`: Published when the connection and authentication handshake is successfully completed.
-   `game:roomInfo`: Published when server room information is received.
-   `game:locationsScouted`: Published when the server answers the connect-time scout. The payload is `{ locations }`, one entry per location: `{ locationId, locationName, itemId, itemName, player, playerName, game, flags, progression, useful, trap }`. `player`, `playerName` and `game` describe the slot that receives the item. `itemName` comes from that slot's game in the DataPackage, and is `null` if the DataPackage doesn't have it.
-   `network:connectionRefused`: Published when the server refuses the connection attempt.
-   `client:locationCheckRefused`: Published when the connected logic gate refuses a check (see `user:locationCheck` below). The payload is `{ locationName, reason, originator }`. The Locations panel clears the card's pending state on it.
-   `client:roomSpoilerData`: Published on `Connected` when the room's slot_data carries a `spoiler_data` record this client reads. The payload is `{ source, text, entries }`: `source` is `room:<seed>:P<slot>`, `text` the expanded incremental sphere log (JSONL). `sphereState` subscribes.

#### Events Subscribed To

-   **`eventDispatcher`**:
    -   `user:locationCheck`: Acts as the highest-priority handler for location check requests when connected to a server. It gets the server ID for the location and sends the check command. If not connected, it propagates the event for local handling.
        -   **The logic gate** (`core/checkGate.js`). Connected, a `user:locationCheck` is refused when the state manager's snapshot says the location is not reachable, the same answer its offline guard gives. Nothing is sent, the event is not passed on, `client:locationCheckRefused` `{ locationName, reason, originator }` is published (`reason` is `not_accessible`, or `reachability_unknown` when there is no answer: the gate fails closed), and the console shows a warning. **Exempt:** a pickup the game itself reported, whose payload carries `reportedByGame: true` (the substrate bridges, the Seedling glue, the Flash adapter, the text adventure's examine, apcalc, vibeCodingSim, jtaArchipelago), and every `system:locationCheck`. A new game publisher must set the flag, or its out-of-logic pickups are refused while connected. `originalDOMEvent` is not read: it cannot tell a click from a game report.
        -   **No false alarm.** A `RoomUpdate` that checks a location the frontend logic calls unreachable is force-checked to stay in sync. The `[INACCESSIBLE LOCATION DETECTED]` error (with its sphere-log downloads) is raised only for a genuine mismatch: not for a location this client sent on this connection, and not after the slot's goal (this client's `reportGoal`, or a `Goal`/`Release` PrintJSON for this slot), when the server's release checks the rest.
    -   `user:itemCheck`: Handles manual item checks by sending a `!getitem` command to the server when connected. If not connected, it propagates the event.
-   **`eventBus`**:
    -   The internal `messageHandler` listens to `connection:open`, `connection:close`, and `connection:message` events from the `connection` object to process server data.

#### Public Functions (`centralRegistry`)

Most interactions go through the `eventDispatcher`. Among the public functions:

-   `getScoutedLocations()`: the entries from the last `game:locationsScouted` on this connection, or `[]` before the server has answered. They are cleared when the connection opens or closes.

#### Dependencies & Interactions

-   **StateManager**: The `Client` module is a primary driver of state changes. It calls methods like `stateManagerProxySingleton.addItemToInventory()` when `ReceivedItems` packets arrive and `stateManagerProxySingleton.checkLocation()` for server-side location updates. It also reads static data from the `StateManager` to map location names to server IDs.
-   **EventDispatcher**: It is a key participant in the `user:locationCheck` and `user:itemCheck` event chains, acting as the authoritative handler when an online session is active.
-   **Checks line**: `mainContentUI` shows the "Checked: …, Reachable: …" line by mounting `commonUI/checksLine.js` (`mountChecksLine`), which keeps it current from `stateManager:snapshotUpdated`. The timer's controls are in the Playback Bot panel (its "any reachable location" mode).