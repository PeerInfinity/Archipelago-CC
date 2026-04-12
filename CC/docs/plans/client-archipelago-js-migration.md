# Client Module Migration to archipelago.js

**Created:** 2026-04-12
**Status:** Pending
**Priority:** Medium

## Overview

Migrate `frontend/modules/client/` from its hand-rolled WebSocket + AP protocol implementation to use `archipelago.js` v2.1.0 as the transport and protocol layer. The public module API (eventBus events, registered public functions, dispatcher receivers) stays unchanged — this is an internal refactor.

Also drop the localStorage DataPackage cache entirely (it has been causing more trouble than it's worth) and rely on archipelago.js's in-memory cache per session.

## Motivation

- `flash-ap-api` recently upgraded to archipelago.js v2.1.0, confirming the library is current and viable for our use case.
- The client module currently reimplements the AP WebSocket protocol from scratch: raw WS handling, packet dispatch, reconnect, DataPackage fetch/cache. That's ~700–900 lines of duplicated protocol code that drifts from upstream AP over time.
- The v2 manager-based API (`client.items`, `client.room`, `client.messages`, `client.deathLink`, etc.) is a cleaner match for our event-driven architecture than our current `switch (command.cmd)` dispatch.
- The localStorage DataPackage cache has been a recurring source of bugs and should be removed regardless of this migration.
- Future protocol changes (new packet types, field additions) would be handled upstream instead of requiring local changes.

## Non-Goals

- No change to the module's public API. Callers (`timer`, `stateManager`, UI modules) must not need edits.
- No change to multiworld-aware item routing semantics (stateManager interplay in `_handleReceivedItems`).
- No change to offline/replay mode scaffolding in `locationManager.js`.
- No change to sphere log generation for regression tests.
- Not adopting archipelago.js's `DeathLink` or `Hints` managers in this pass (can be follow-ups).

## Preserved Files

These are kept as-is — they hold the domain-specific logic that archipelago.js doesn't cover:

| File | Lines | Why preserved |
|---|---|---|
| `core/locationManager.js` | 243 | Offline mode scaffolding, location reachability logic |
| `utils/idMapping.js` | 369 | Name ↔ ID mapping used by timer/stateManager. **localStorage caching removed.** |
| `utils/debugSphereLogger.js` | 234 | Regression test artifacts |
| `core/sharedState.js`, `core/storage.js`, `core/config.js` | — | Module-wide state, unrelated to protocol |

## Files Removed or Gutted

| File | Lines | Action |
|---|---|---|
| `core/connection.js` | 282 | **Delete.** Replaced by thin `apClient.js` wrapper around `new Client()` from archipelago.js. |
| `core/messageHandler.js` | 1351 | **Gut ~600 lines.** Remove `processMessage`, all `_handle*` packet handlers, `_subscribeToConnectionEvents`, `_checkIfDataPackageNeeded`, `_requestDataPackage`. Replace with manager-event subscribers that republish to existing eventBus event names. |
| `utils/idMapping.js` | — | **Remove localStorage caching.** Strip `loadMappingsFromStorage` and the `storage.getItem('dataPackage')` persistence. Keep in-memory maps; they'll be populated from archipelago.js's `package` manager on each login. |

## Vendoring archipelago.js

`frontend/` has no `package.json` at its root — it loads ES modules directly. Vendor archipelago.js v2.1.0 under `frontend/libs/archipelago.js/`, mirroring the existing `frontend/libs/codemirror6/` pattern.

- Obtain the browser-ESM build of archipelago.js v2.1.0.
- Place it at `frontend/libs/archipelago.js/archipelago.js` (or similar).
- Import via relative path from `frontend/modules/client/core/apClient.js`.

Verify before committing:
- The build exposes `Client`, manager classes, and raw `client.socket.send()` for Bounce packets.
- No Node-only dependencies slipped into the ESM build.

## Event Bridge Map

All existing eventBus events must continue to fire with the same payload shapes. The new `messageHandler.js` subscribes to archipelago.js manager events and republishes.

| archipelago.js v2 signal | Existing eventBus event | Legacy handler logic to port |
|---|---|---|
| `client.socket.on("connected")` | `connection:open` | trivial |
| `client.socket.on("disconnected")` | `connection:close` + reconnect loop | port 10×5s reconnect loop from `connection.js:190-218` |
| `client.on("connected")` (auth success) | `game:connected` + `game:roomInfo` | port slot/team/players storage, `serverLocationNameToId` Map build from `_handleConnected`, `_syncLocationsFromServer` call |
| `client.on("disconnected")` (auth refused) | `network:connectionRefused` | port `_handleConnectionRefused` |
| `client.items.on("itemsReceived")` | `game:itemsReceived` + `inventory:clear` on index=0 | port `_handleReceivedItems` body verbatim; inputs are resolved Item objects so `getItemNameFromServerId` lookup goes away |
| `client.room.on("locationsChecked")` | `locations:updated` | port `_handleRoomUpdate` location sync |
| `client.messages.on("message")` / `on("chat")` | `game:chatMessage`, `ui:printToConsole`, `ui:printFormattedToConsole` | port `_handlePrint` + `_handlePrintJSON` |
| `client.socket.on("bounced")` | `game:bounced` + `game:bouncedMessage` | port `_handleBounced` (READY_MESSAGE protocol) |
| DataPackage available (post-login) | `game:dataPackageReceived` | call `initializeMappingsFromDataPackage` with data from client's `package` manager |

## Outbound Method Replacements

| Old (`messageHandler.js`) | New |
|---|---|
| `sendLocationChecks` / `_internalSendLocationChecks` | `client.check(...ids)` |
| `sendMessage` | `client.messages.say(text)` |
| `sendBounce` | `client.socket.send({cmd:"Bounce",...})` (raw) |
| `sendStatusUpdate` | `client.updateStatus(status)` |
| `connection.send([{cmd:"Connect",...}])` in `_handleRoomInfo` | `await client.login(url, slotName, game, {password, items_handling:0b111, tags:["JSON Web Client"]})` |

## Public API — Unchanged

`index.js` keeps every `registerPublicFunction` signature. Internals swap; callers don't notice.

- `connect(serverAddress, playerName)`
- `sendChatMessage(message)`
- `waitForChatMessage(filterFn, timeoutMs)`
- `sendReadyMessage(clientId, options)`
- `waitForReadyMessage(expectedSender, timeoutMs)`
- `isConnected()`
- `isHandshakeComplete()`
- `getConnectionInfo()`
- `sendBatchLocationChecks(locationNames)`

Dispatcher receivers (`user:locationCheck`, `user:itemCheck`, `network:disconnectRequest`, `system:rehomeTimerUI`) are unchanged.

## Implementation Phases

### Phase 1 — Vendor archipelago.js and parallel spike (0.5 day)

- [ ] Vendor archipelago.js v2.1.0 browser-ESM build under `frontend/libs/archipelago.js/`.
- [ ] Create `frontend/modules/client/core/apClient.js` — a **parallel** adapter that imports `Client` and exposes a minimal connect/login, **without touching** `connection.js` or `messageHandler.js`.
- [ ] Wire a temporary manual trigger (e.g., a dev-only button or URL flag) that instantiates `apClient` and logs every manager event to the console.
- [ ] Prove end-to-end: login, DataPackage load, receive one `itemsReceived`, send one location check. Browser-only, no automated tests yet.

**Exit criterion:** archipelago.js connects to a real AP server and observes basic events without interfering with the existing client module.

### Phase 2 — Event bridge layer (1.5 days)

- [ ] In `apClient.js`, subscribe to each manager event from the bridge map above.
- [ ] For each event, republish to the existing `eventBus` event name with the same payload shape that the current handler produces. Cross-reference against `_handle*` methods in `messageHandler.js` to match payloads exactly.
- [ ] Port the reconnect loop (`connection.js:190-218`) into `apClient.js`. Decide: keep our custom loop and disable archipelago.js's built-in reconnect, or adopt theirs. **Default: keep ours** for behavioral parity.
- [ ] Behind a feature flag (e.g., `?useApClient=true` URL param), route `index.js`'s connect path through `apClient` instead of `connection`. Old code stays intact as fallback.
- [ ] Run `npm test -- --mode=test-spoilers --game=<game> --seed=1` for 2–3 games under the new path. Compare eventBus traces.

**Exit criterion:** with the feature flag on, the client module's observable behavior (eventBus events fired, sequence, payloads) matches the old path for a representative game.

### Phase 3 — Port multiworld item routing (1 day)

This is the riskiest part. `_handleReceivedItems` interacts with `stateManagerProxySingleton` for multiworld-aware game name resolution and item classification.

- [ ] Port the body of `_handleReceivedItems` (`messageHandler.js:431+`) into the `client.items.on("itemsReceived")` subscriber in `apClient.js`.
- [ ] Port `_handleConnected` logic (slot/team/players storage, `serverLocationNameToId` Map build, `_syncLocationsFromServer` call) into the `client.on("connected")` subscriber.
- [ ] Port `_handleRoomInfo` game-name resolution logic (stateManager preference over RoomInfo, fallback chain) into the login flow — game name must be resolved **before** `client.login()` is called.
- [ ] Verify `clientGameName`, `clientSlot`, `clientTeam`, `players`, `missingLocationIds`, `checkedLocationIds`, `serverLocationNameToId` fields are all still populated where downstream code reads them (grep callers).

**Exit criterion:** a multiworld spoiler test with ≥2 different games in the same seed produces correct item routing under the feature flag.

### Phase 4 — Remove localStorage DataPackage caching (0.5 day)

- [ ] In `utils/idMapping.js`, delete `loadMappingsFromStorage` and any `storage.getItem('dataPackage')` / `storage.setItem('dataPackage')` calls.
- [ ] Remove the `dataPackageVersion` field and `_checkIfDataPackageNeeded` logic (already being gutted in Phase 5, but this confirms no other caller relies on it).
- [ ] Populate `idMapping.js` in-memory maps from archipelago.js's `package` manager data after `client.on("connected")`.
- [ ] Grep the repo for any code that reads `'dataPackage'` or `'dataPackageVersion'` from storage outside the client module and remove or migrate.
- [ ] Verify first-connect-after-page-reload still works — DataPackage will be re-fetched every session, which is the accepted tradeoff.

**Exit criterion:** cold load → connect → DataPackage re-fetches fresh from server; no localStorage keys related to DataPackage remain.

### Phase 5 — Flip default and delete old code (0.5 day)

- [ ] Flip the feature flag default to the new path. Leave the flag in place for one iteration to allow rollback.
- [ ] Delete `core/connection.js`.
- [ ] Delete `processMessage`, `_handle*` methods, `_subscribeToConnectionEvents`, `_checkIfDataPackageNeeded`, `_requestDataPackage`, and `_internalSendLocationChecks` from `messageHandler.js`. The file shrinks from 1351 → ~600–700 lines and contains only: outbound send methods, state getters, and the new `apClient`-driven event subscribers.
- [ ] Grep for `connection.send`, `connection.socket`, `connection.isConnected` — remove any stragglers.
- [ ] Update `index.js` imports (`coreConnection` → `apClient`).
- [ ] Remove the feature flag.

**Exit criterion:** no references to `connection.js` remain; `messageHandler.js` no longer contains packet dispatch.

### Phase 6 — Regression testing (0.5 day)

- [ ] `npm test -- --mode=test-spoilers` across 5–10 representative games (small + large, single-world + multiworld).
- [ ] `npm test --mode=test-regression`.
- [ ] Manual browser test: autoconnect URL flow, disconnect, reconnect, chat, Bounce READY_MESSAGE round-trip.
- [ ] Manual browser test: cold load → connect (verify DataPackage re-fetches), hot reload → connect (verify DataPackage re-fetches again, no stale cache issues).

**Exit criterion:** all regression tests pass; manual flows work.

## Total Effort Estimate

**~4 days** of focused work.

**Net line change:** ~700–900 lines deleted, ~200–300 lines added. Rough net: **−500 to −700 lines**.

## Risks

### Risk 1 — Bounce protocol for READY_MESSAGE

The `sendReadyMessage` / `waitForReadyMessage` public functions use custom Bounce payloads with `type: 'READY_MESSAGE'`. archipelago.js v2 must still allow raw `Bounce` packets with arbitrary `data` payloads.

**Mitigation:** verify during Phase 1 spike that `client.socket.send({cmd:"Bounce", data:{...}})` works and `client.socket.on("bounced")` delivers the payload intact. If archipelago.js wraps/validates Bounce in a way that rejects our custom `type` field, we keep a thin raw-WebSocket pathway just for this use case.

### Risk 2 — Reconnect behavior divergence

archipelago.js may auto-reconnect with different backoff/limits than our hand-rolled 10×5s loop. Code that listens for `connection:reconnecting` events expects specific `attempt`/`maxAttempts` values.

**Mitigation:** disable archipelago.js's reconnect in Phase 2 and keep our loop in `apClient.js`. Revisit later if desired.

### Risk 3 — Offline/replay mode

`locationManager.js:200` references offline simulation. If that path ever instantiates a fake connection, it talks to `connection.js` directly.

**Mitigation:** Phase 1 task — grep for `connection.send`, `connection.socket`, `connection.isConnected` outside `client/core/`. Migrate any callers before Phase 5 deletion.

### Risk 4 — Event payload shape drift

archipelago.js manager events deliver resolved objects (Item, Location) rather than raw packet fields. The existing eventBus event payloads are built from raw packet fields. Shape mismatch would break downstream subscribers.

**Mitigation:** in Phase 2, diff the eventBus payloads under the feature flag against the old path. Use the existing eventBus logging/tracing infrastructure. Any subscriber that reads raw packet fields (e.g., `data.index`) must be preserved by reconstructing those fields in the bridge layer.

### Risk 5 — Game name resolution timing

`_handleRoomInfo` resolves the game name via a fallback chain: stateManager → RoomInfo.games → hardcoded default. With archipelago.js, game name must be known **before** `client.login()` is called. The old code had the luxury of receiving RoomInfo first, then deciding.

**Mitigation:** resolve the game name upfront from `stateManagerProxySingleton.getGameName()` before calling `client.login()`. If stateManager hasn't loaded yet, fall back to a placeholder and reconnect once it's ready (matches the existing `ensureReady` pattern in `postInitialize`). Verify the autoconnect URL flow still works.

## Progress Tracking

| Phase | Status | Notes |
|---|---|---|
| 1. Vendor + spike | ☐ Not started | |
| 2. Event bridge | ☐ Not started | |
| 3. Multiworld item routing | ☐ Not started | |
| 4. Remove localStorage DataPackage | ☐ Not started | |
| 5. Flip default + delete | ☐ Not started | |
| 6. Regression testing | ☐ Not started | |

## References

- `flash-ap-api` upgrade commit: `2ec66cd` (v1.0.0 → v2.1.0)
- `frontend/libs/codemirror6/` — vendoring pattern to mirror
- `frontend/modules/client/index.js` — public API surface to preserve
- `frontend/modules/client/core/connection.js:190-218` — reconnect loop to port
- `frontend/modules/client/core/messageHandler.js:431` — `_handleReceivedItems` (multiworld item routing)
- `frontend/modules/client/core/messageHandler.js:159` — `_handleRoomInfo` (game name resolution)
