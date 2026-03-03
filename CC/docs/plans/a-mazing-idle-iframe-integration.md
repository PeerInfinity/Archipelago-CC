# A-Mazing-Idle Iframe Integration Plan

## Overview

Integrate the A-Mazing-Idle game (v0.2.0) with the Archipelago frontend via the existing iframe adapter system. The game currently has a basic iframe wrapper with postMessage communication. The goal is to bring it up to full integration with the Archipelago frontend's iframeAdapter, including game state save/load through the adapter.

## Current State

### What Exists

**A-Mazing-Idle files** (at `tests/test4/A-Mazing-Idle-New/`):
- `index.html` - Main game page, loads `bundle-0.2.0.js` (706KB minified)
- `iframe-wrapper/mazeGameIframeWrapper.js` - Custom wrapper (~470 lines) using its own postMessage protocol
- `iframe-wrapper/config.js` - Message type constants (ES module, not actually imported by wrapper)
- `test/parent-test.html` - Test parent page with control panel and message log

**Archipelago iframe adapter** (at `frontend/modules/`):
- `iframeAdapter/` - Parent-side adapter with full protocol (handshake, heartbeat, event bus bridging, state snapshots)
- `iframe-base/iframeClient.js` - Client library for iframes (handles connection, subscriptions, state caching)
- `textAdventure-remote/` - Reference implementation of a remote iframe app with `RemoteDependencies` wrappers
- `iframeManagerPanel/` - UI for loading iframe URLs into the frontend's Iframe Panel

### What Works (Tested)

| Feature | Status |
|---------|--------|
| Game loads standalone | Working |
| Game loads in iframe | Working |
| Custom wrapper handshake (IFRAME_READY/ADAPTER_READY) | Working |
| Request Game State via postMessage | Working |
| Player movement via keyboard in iframe | Working |
| localStorage auto-save (every 20s) | Working |

### What Doesn't Work Yet

| Feature | Issue |
|---------|-------|
| Maze completion detection | Completion panel is `display: none` at biome 0; needs biome 1+ |
| Generate New Maze command | No "New Maze" button exists at biome 0; Q-key fallback ineffective |
| Connection to Archipelago iframeAdapter | Custom wrapper uses its own protocol, not the Archipelago protocol |
| Game state save/load through adapter | Not implemented |

## Key Technical Findings

### Game Save System

The game saves to localStorage under key `a-mazing-idle` (not `a-mazing-idle-game-save` as the docs suggest - verify this).

**Save format** - JSON with these top-level properties:
```
saveGameVersion, points, upgrades, stats, offline, experiment, toggles
```

**Save timing:**
- Auto-save every 20 seconds (`SAVE_GAME_INTERVAL = 20000`)
- Manual save via Settings modal

**Key SaveManager methods:**
- `saveGameToLocalStorage()` - Creates and persists save
- `loadGameSaveFromLocalStorage()` / `reloadFromLocalStorage()` - Loads on startup
- `importGameSaveFromString(jsonString)` - Import from JSON string
- `createSaveJsonObject()` - Returns save as JSON object
- `copySaveToClipboard()` - Export to clipboard

**Global game object:**
- The game is created as `globalGame` in module 32 via jQuery ready
- Accessible through the Browserify module system exports
- May need investigation to determine if it's reachable from `window` scope

### Game Initialization Sequence

1. jQuery `$(document).ready()` fires
2. `new Game(IS_DEV_MODE_DISABLE_UI, IS_DEV_MODE_ENABLED)` created
3. `globalGame.reloadFromLocalStorage()` called - reads and deserializes save
4. Offline points calculated based on time since last save
5. Save timer enabled (20-second interval)

**Critical implication for state injection:** Save data must be in localStorage *before* step 3 runs. If injecting via the adapter, the safest approach is: inject into localStorage, then reload the page.

### Archipelago iframeAdapter Protocol

The Archipelago adapter uses a structured protocol with `createMessage()` / `validateMessage()`:
```javascript
{
    type: MessageTypes.IFRAME_READY,  // Required enum value
    iframeId: "unique-id",           // Required string
    timestamp: Date.now(),           // Required number
    data: { ... }                    // Optional payload
}
```

**Handshake:** IFRAME_READY → ADAPTER_READY (with logging config and capabilities)
**Event bridging:** Subscribe/unsubscribe to eventBus and dispatcher events
**State:** REQUEST_STATE_SNAPSHOT → STATE_SNAPSHOT (with pingWorker for fresh data)
**Health:** HEARTBEAT → HEARTBEAT_RESPONSE (30s interval, 60s timeout)

### Completion Panel Visibility

At biome 0, `#mazeCompletionRequirementsPanel` has `display: none`. The checkmark elements exist but their parent is hidden. The completion detection via MutationObserver only works when the panel becomes visible at higher biomes.

---

## Implementation Plan

### Phase 1: Game State Save/Load Through Iframe

**Goal:** Be able to save and restore the full game state through the iframe wrapper, including advancing to biome 1+ where more features are available.

#### Task 1.1: Investigate Game Object Accessibility
- Determine if `globalGame` or equivalent is accessible from `window` scope in the iframe
- Check if `require` or the Browserify module system exposes the game object
- Test accessing `globalGame.save.createSaveJsonObject()` from the console
- Test accessing `globalGame.save.importGameSaveFromString(json)` from the console

#### Task 1.2: Implement Save Export via Wrapper
- Add a `SAVE_GAME` command to the wrapper that:
  - Reads localStorage key `a-mazing-idle`
  - OR calls `globalGame.save.createSaveJsonObject()` if accessible
  - Sends the save JSON to the parent via postMessage
- Add an event that fires when the game auto-saves (already partially implemented via `monitorLocalStorage()`)

#### Task 1.3: Implement Save Import via Wrapper
- Add a `LOAD_SAVE` command to the wrapper that:
  - Receives a save JSON blob from the parent
  - Writes it to localStorage
  - Reloads the page (`location.reload()`) to trigger the game to read the new save
  - OR calls `globalGame.save.importGameSaveFromString(json)` if accessible (avoids reload)
- Handle the timing: if using reload, the wrapper re-initializes and re-sends IFRAME_READY

#### Task 1.4: Create a Biome 1+ Save File
- Play the game or use the Experiments panel to advance to biome 1+
- Export the save data
- Store as a test fixture for future development
- This enables testing of maze completion detection and new maze generation

### Phase 2: Fix Maze Completion Detection and New Maze Generation

**Goal:** Get the two core game events working reliably.

#### Task 2.1: Test at Higher Biomes
- Load a biome 1+ save via the Phase 1 mechanism
- Verify the completion panel becomes visible
- Verify MutationObserver detects checkmark visibility changes
- Verify the "New Maze" / experiment button works

#### Task 2.2: Add Alternative Completion Detection
- If the MutationObserver approach doesn't work reliably, add fallback methods:
  - Monitor points jump (maze completion awards a bonus)
  - Intercept localStorage save and compare `stats.statsTotalMazesCompleted` count
  - Watch for maze table DOM rebuild (new maze = new `<table>` rows)

#### Task 2.3: Improve New Maze Trigger
- At biome 1+, test clicking `#experimentNewMaze` button
- Verify the wrapper can find and click this button
- Add fallback: directly manipulate game object if accessible

### Phase 3: Integrate with Archipelago iframeAdapter Protocol

**Goal:** Replace the custom wrapper protocol with the Archipelago iframeAdapter protocol so the game works as a proper iframe module in the frontend.

#### Task 3.1: Create a Maze Game IframeClient
- Replace `MazeGameIframeWrapper` with a new entry point that:
  - Imports `IframeClient` from `iframe-base/iframeClient.js`
  - Connects to the Archipelago adapter via `client.connect()`
  - Subscribes to relevant eventBus events
  - Publishes maze events (completion, state changes)

#### Task 3.2: Map Maze Events to Archipelago Events
- Define how maze game events map to the Archipelago event system:
  - `MAZE_COMPLETED` → publish to eventBus (could map to location check)
  - `GAME_STATE` → state snapshot response
  - `NEW_MAZE` → triggered by eventBus subscription from parent
  - `SAVE_GAME` / `LOAD_SAVE` → custom events through eventBus

#### Task 3.3: Register as Known Page in Iframe Manager
- Add the maze game URL to `iframeManagerPanel` known pages
- Test loading via the Iframe Manager UI in the Archipelago frontend
- The game should load from its original URL (e.g., `http://localhost:8002/`), not a local copy

#### Task 3.4: Handle Cross-Origin Considerations
- The game runs on `localhost:8002`, the frontend on `localhost:8000`
- postMessage works cross-origin (already tested)
- The `IframeClient` uses `parentOrigin: '*'` - OK for development
- localStorage is per-origin, so the game's saves stay on :8002

### Phase 4: Full Integration Testing

**Goal:** End-to-end flow working through the Archipelago frontend.

#### Task 4.1: Test Full Lifecycle
- Load game via Iframe Manager in Archipelago frontend
- Inject a saved game state (biome 1+) through the adapter
- Play until maze completion
- Verify completion event reaches the Archipelago eventBus
- Trigger new maze from the parent
- Export save state back through the adapter

#### Task 4.2: Create a Proper Test Parent (Optional)
- Adapt `test/parent-test.html` to use the Archipelago `iframeAdapterCore` directly
- This creates a lightweight test harness that doesn't need the full Archipelago frontend

---

## Open Questions

1. **localStorage key:** Is it `a-mazing-idle` or `a-mazing-idle-game-save`? The README says one thing, the bundle may use another. Needs verification.

2. **Global game object:** Can we access the game's `globalGame` object from the wrapper script? If yes, we can call save/load methods directly without page reloads. If not, we're limited to localStorage manipulation + reload.

3. **Save data size:** How large is a typical save JSON? If it's very large, postMessage overhead could matter for frequent state sync.

4. **Biome progression requirements:** How many points/mazes does it take to reach biome 1 where completion detection works? Can we fast-track this via the Experiments panel?

5. **Multiple instances:** Does the game support multiple instances with separate saves? (Relevant if the adapter needs to manage multiple game sessions.)

6. **Game modifications:** Are we strictly limited to the wrapper pattern (no game bundle modifications)? Or is light modification acceptable for better integration?

## Architecture Decision: Wrapper vs. Modified Game

**Option A: Pure Wrapper (current approach)**
- Pros: Original game untouched, easy to update game version
- Cons: Limited to DOM observation and localStorage interception, timing issues with save/load

**Option B: Light Game Modification**
- Pros: Can expose game API directly, reliable save/load, proper event hooks
- Cons: Need to maintain modifications across game updates

**Recommendation:** Start with Option A (wrapper) for Phase 1-2. If the wrapper approach proves too fragile for save/load, consider Option B with minimal, well-documented modifications to the beautified bundle.

## References

- Game files: `tests/test4/A-Mazing-Idle-New/`
- Archipelago iframe adapter: `frontend/modules/iframeAdapter/`
- IframeClient: `frontend/modules/iframe-base/iframeClient.js`
- Reference iframe app: `frontend/modules/textAdventure-remote/`
- Iframe Manager UI: `frontend/modules/iframeManagerPanel/`
- Game save key constant: search for `SAVE_GAME_LOCAL_STORE_KEY` in bundle
- Original iframe integration plan: `tests/test4/A-Mazing-Idle-New/iframe-integration-plan.md`
