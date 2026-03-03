# A-Mazing-Idle Iframe Integration Plan

## Overview

Integrate the A-Mazing-Idle game (v0.2.0) with the Archipelago frontend via the existing iframe adapter system. The game currently has a basic iframe wrapper with postMessage communication. The goal is to bring it up to full integration with the Archipelago frontend's iframeAdapter, including game state save/load through the adapter.

## Current State

### What Exists

**A-Mazing-Idle files** (at `tests/test4/A-Mazing-Idle-New/`):
- `index.html` - Main game page with `<base href>` pointing to live site; loads all game resources (bundle, CSS, images) from `https://imgreghenry.github.io/A-Mazing-Idle/` while keeping wrapper local
- `iframe-wrapper/mazeGameIframeWrapper.js` - Custom wrapper (~470 lines) using its own postMessage protocol
- `iframe-wrapper/config.js` - Message type constants (ES module, not actually imported by wrapper)
- `test/parent-test.html` - Test parent page with control panel and message log
- `backup-pre-live-site/` - Backup of files before live site integration

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
| Archipelago IframeClient connection + handshake | Working |
| Maze completion detection via MutationObserver | Working |
| Save export/import via eventBus | Working |
| Game listed in Iframe Manager known pages | Working |

### What Doesn't Work Yet

| Feature | Issue |
|---------|-------|
| Generate New Maze command from parent | No eventBus trigger implemented yet; could subscribe to a `amazingIdle:newMaze` event |
| `?mode=mazegame` auto-launch | Deferred; `?mode=` is used by mode manager, not for app launching |
| Exit unlock detection (biome 8+) | Not wired up to eventBus; useful for future game-to-Archipelago mapping |

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

### Completion Panel Visibility and Exit Unlock vs Maze Completion

**Critical distinction:** The "Completion Requirements" panel does NOT detect maze completion. It tracks whether the **exit unlock conditions** have been met (e.g., keys found, tiles visited %). Actual maze completion happens when the player reaches the exit tile AFTER these requirements are met.

**Two separate events:**
1. **Exit unlocked** - All requirements met (keys found, tile % visited). The finish line icon changes and exit becomes passable.
2. **Maze completed** - Player walks to the exit tile after requirements are met. This triggers a new maze, stats update, and point bonus.

**Panel visibility by biome:**
- Biomes 0-7: `#mazeCompletionRequirementsPanel` has `display: none` (no requirements at all — exit is always unlocked)
- Biome 8+: Panel becomes visible when `minMazeKeysFound > 0` or `minTilePercentageVisited > 0`

**Biome requirement progression** (from source code analysis):
| Biome | Keys Required | Tile % Required | Maze Shape |
|-------|--------------|-----------------|------------|
| 0-7   | 0            | 0               | Square/Plus/Diamond |
| 8     | 1            | 0               | Honeycomb |
| 9     | 1            | 0               | Honeycomb |
| 10-11 | 2            | 0               | Letter H |
| 12-13 | 2            | 0               | Staircase |
| 14+   | 3            | 70%             | Staircase |

**Checkmark DOM behavior at biome 8:**
- Panel: `display: block` (visible)
- Keys X mark: `display: flex` → `none` when keys found
- Keys checkmark: `display: none` → `flex` when keys found
- Tiles panel: `display: none` (no tile requirement at biome 8)

**Implication for completion detection:** Watching the checkmarks only tells us the exit is unlocked, not that the maze was completed. We need a separate mechanism for actual maze completion detection.

### Game Object Accessibility (Tested)

`globalGame` is **NOT** accessible from `window` scope. The Browserify closure keeps it private. `window.require` is also undefined. This means:
- Cannot call game methods directly (save/load, maze generation)
- Must use localStorage manipulation + page reload for save/load
- Must use DOM observation or localStorage interception for event detection

### localStorage Key (Confirmed)

The save key is `a-mazing-idle` (NOT `a-mazing-idle-game-save` as README suggests). Save format nests points as `{ points: { points: N } }`.

### JavaScript Point Injection (Tested)

Can fast-track progression without playing:
```javascript
const save = JSON.parse(localStorage.getItem('a-mazing-idle'));
save.points.points = 50000;
localStorage.setItem('a-mazing-idle', JSON.stringify(save));
location.reload(); // game reads new save on load
```
Then click "Unlock New Biome" repeatedly to advance biomes.

---

## Implementation Plan

### Phase 1: Game State Save/Load Through Iframe

**Goal:** Be able to save and restore the full game state through the iframe wrapper, including advancing to biome 1+ where more features are available.

#### Task 1.1: Investigate Game Object Accessibility ✅ DONE
- `globalGame` is NOT accessible from `window` scope (Browserify closure)
- `window.require` is undefined
- Cannot call save/load methods directly
- Must use localStorage manipulation + page reload approach

#### Task 1.2: Implement Save Export via Wrapper
- Add a `SAVE_GAME` command to the wrapper that:
  - Reads localStorage key `a-mazing-idle`
  - Sends the save JSON to the parent via postMessage
- Add an event that fires when the game auto-saves (already partially implemented via `monitorLocalStorage()`)

#### Task 1.3: Implement Save Import via Wrapper ✅ APPROACH TESTED
- Add a `LOAD_SAVE` command to the wrapper that:
  - Receives a save JSON blob from the parent
  - **Blocks the game's auto-save** by overriding `localStorage.setItem` with a no-op
  - Writes the new save using the original `setItem` reference
  - Reloads the page (`location.reload()`)
  - On reload, the game reads the injected save from localStorage
- **Tested on live game:** Successfully injected a biome 2 save with bot upgrades from a fresh game. The game loaded correctly with all injected state.
- **Critical detail:** Must block `localStorage.setItem` BEFORE writing the custom save, otherwise the running game's `beforeunload` handler overwrites it during reload.
- **Sequence:**
  ```javascript
  // 1. Block game's saves
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function() {}; // no-op
  // 2. Write custom save via original
  origSetItem('a-mazing-idle', JSON.stringify(customSave));
  // 3. Reload - game reads our save, can't overwrite on unload
  location.reload();
  ```
- After reload, the wrapper re-initializes and re-sends IFRAME_READY

#### Task 1.4: Create Test Save Files
- ✅ Can fast-track to any biome via JS point injection + clicking Unlock
- Currently at biome 8 (first biome with completion requirements)
- TODO: Export the biome 8 save data as a test fixture
- TODO: Also create a biome 0 fixture for baseline testing

### Phase 2: Maze Event Detection and New Maze Generation

**Goal:** Reliably detect maze completion (not just exit unlock) and trigger new mazes.

#### Task 2.1: Exit Unlock Detection (biome 8+)
- **Status: Partially tested.** MutationObserver on checkmark elements works for detecting when exit requirements are met.
- At biome 8+, watch `#mazeCompletionRequirementsMazeKeysCheckMark` change from `display: none` to `display: flex`
- This tells us the exit is unlocked, but NOT that the maze is completed
- Useful as an intermediate event ("exit unlocked" → player can now reach exit)

#### Task 2.2: Actual Maze Completion Detection ✅ TESTED

The real completion happens when the player reaches the exit. Three detection methods were tested on the live game (https://imgreghenry.github.io/A-Mazing-Idle/):

| Method | How it works | Timing | Reliability |
|--------|-------------|--------|-------------|
| **DOM_REBUILD** | MutationObserver on `#maze` for `childList` changes | **Instant** (~0ms) | High - exactly 63 child changes per completion (5x5 maze), fires at exact moment |
| **Points jump** | Monitor `#points` text for jumps >10 pts | **~130-210ms** after rebuild | Medium - needs threshold tuning, could false-positive from purchases |
| **STATS_CHANGE** | Intercept `localStorage.setItem`, parse `TOTAL_MAZES_COMPLETED` from serialized Map (`~~[[...]]` format) | **Delayed** (up to 20s, fires on auto-save) | High - definitive count, but delayed |

**Stats format note:** Stats are stored as a serialized Map string in `save.stats.statsMap`, e.g., `"~~[[\"TOTAL_MAZES_COMPLETED\",3],...]"`. Must parse with `JSON.parse(str.replace('~~',''))` then `new Map(arr)`.

**Recommended approach:** DOM_REBUILD as primary (instant detection), STATS_CHANGE as confirmation (reliable count).

**Implementation in wrapper:**
```javascript
// Primary: instant detection via DOM rebuild
new MutationObserver((mutations) => {
    const childChanges = mutations.filter(m => m.type === 'childList');
    if (childChanges.length > 0) {
        // Maze was completed and rebuilt
        postMessage({ type: 'MAZE_COMPLETED', ... });
    }
}).observe(document.querySelector('#maze'), { childList: true, subtree: true });
```

#### Task 2.3: Test New Maze Trigger
- `#experimentNewMaze` button exists and is `display: inline-block` at biome 1+
- **Note:** This button is in the Experiments panel which is hidden until the EXPERIMENTS_PANEL_UPGRADE is purchased
- Need to test: does clicking this button work even when panel is hidden?
- Alternative: the Q key was previously a fallback — test if it works at biome 8+
- Since `globalGame` is inaccessible, cannot call game methods directly

#### Task 2.4: Understand Full Maze Lifecycle ✅ MAPPED

Observed sequence of events during maze play:
1. **New maze generated** → DOM rebuilt (detectable: MutationObserver childList on `#maze`, exactly 63 changes for 5x5)
2. **Player/bot explores** → tiles change backgroundColor, points increment by ~1-3 per tile
3. **Requirements met (biome 8+)** → checkmark display changes from `none` to `flex` (detectable: MutationObserver on checkmark elements)
4. **Player reaches exit** → maze completed instantly:
   - Points jump by ~30 (completion bonus)
   - DOM rebuilt immediately (new maze generated)
   - `TOTAL_MAZES_COMPLETED` incremented in stats (visible on next auto-save)
5. Steps 1-4 repeat

**Key observations:**
- Steps 4 and 1 are effectively simultaneous — completion triggers immediate new maze generation
- The DOM_REBUILD observer fires for both the "old maze torn down" and "new maze built" as a single batch
- At biomes 0-7, there are no exit requirements, so step 3 is skipped (exit always unlocked)
- Bot automation requires at least one manual maze completion to activate (observed on live game)
- Bot AUTO_MOVE unlocks at biome 2, but is slow/dumb without PRIORITIZE_UNVISITED (biome 3+)
- Tab must be visible for the game loop to run (background tabs are throttled by Chrome)

### Phase 3: Integrate with Archipelago iframeAdapter Protocol

**Goal:** Replace the custom wrapper protocol with the Archipelago iframeAdapter protocol so the game works as a proper iframe module in the frontend.

#### Task 3.1: Create a Maze Game IframeClient ✅ DONE
- Created `frontend/modules/a-mazing-idle-remote/mazeGameClient.js` as ES module
- Imports `IframeClient` from `../iframe-base/iframeClient.js`
- Connects to Archipelago adapter via `client.connect()`
- Sets up MutationObserver on `#maze` for completion detection (debounced)
- Subscribes to `amazingIdle:exportSave` and `amazingIdle:importSave` events
- Publishes `amazingIdle:mazeCompleted` on maze completion

#### Task 3.2: Map Maze Events to Archipelago Events ✅ DONE
- Event mapping implemented:
  - Maze completed → `amazingIdle:mazeCompleted` (published to eventBus with completionCount, mutationCount, timestamp)
  - Save export → `amazingIdle:exportSave` (request) / `amazingIdle:saveExported` (response with saveJson)
  - Save import → `amazingIdle:importSave` (blocks game saves, writes via original setItem, reloads)

#### Task 3.3: Register as Known Page in Iframe Manager ✅ DONE
- Added "A-Mazing-Idle" to `knownPages` in `iframeManagerPanel/iframeManagerUI.js`
- Game loads from same-origin HTML (`./modules/a-mazing-idle-remote/index-iframe.html`) with `<base href>` resolving game resources from the live GitHub site
- No separate game server needed — game bundle/CSS/images load from `https://imgreghenry.github.io/A-Mazing-Idle/`

#### Task 3.4: Handle Cross-Origin Considerations ✅ DONE (architecture changed)
- **Architecture change:** Instead of loading from `localhost:8002`, the game HTML is hosted as a local module at `frontend/modules/a-mazing-idle-remote/index-iframe.html`
- `<base href="https://imgreghenry.github.io/A-Mazing-Idle/">` resolves all game resources (bundle, CSS, images) from the live site
- Same-origin with the Archipelago frontend (`localhost:8000`), so no CORS issues
- localStorage saves are under the `localhost:8000` origin

**Gotcha:** `<base href>` redirects ALL URL resolution including absolute paths starting with `/`. The integration script must use a dynamic `import()` with `location.origin` to bypass this:
```javascript
const clientUrl = new URL('/frontend/modules/.../mazeGameClient.js', location.origin).href;
import(clientUrl);
```

### Phase 4: Full Integration Testing

**Goal:** End-to-end flow working through the Archipelago frontend.

#### Task 4.1: Test Full Lifecycle ✅ PARTIALLY DONE
- ✅ Load game via Iframe Manager — working (select "A-Mazing-Idle" from Known Pages, click Load Iframe)
- ✅ IframeClient handshake — IFRAME_READY → ADAPTER_READY → IFRAME_APP_READY all complete
- ✅ Heartbeat — running at 30s intervals
- ✅ Manual maze completion — detected: "Maze completed (#1, 48 DOM changes)" published to eventBus
- TODO: Inject saved game state (biome 1+) through the `amazingIdle:importSave` event
- TODO: Trigger new maze from parent
- TODO: Export save state via `amazingIdle:exportSave`

#### Task 4.2: Create a Proper Test Parent (Optional)
- Adapt `test/parent-test.html` to use the Archipelago `iframeAdapterCore` directly
- This creates a lightweight test harness that doesn't need the full Archipelago frontend

---

## Open Questions

1. ~~**localStorage key:**~~ ✅ **Answered.** Key is `a-mazing-idle`. Points stored as `{ points: { points: N } }`.

2. ~~**Global game object:**~~ ✅ **Answered.** NOT accessible. Browserify closure prevents access. Must use localStorage + reload.

3. **Save data size:** How large is a typical save JSON? If it's very large, postMessage overhead could matter for frequent state sync.

4. ~~**Biome progression requirements:**~~ ✅ **Answered.** Completion requirements start at biome 8 (1 key). Biome costs: 200, 400, 1K, 2K, 4K, 6K, 10K, 15K = 38,400 total to reach biome 8. Can fast-track via JS point injection.

5. **Multiple instances:** Does the game support multiple instances with separate saves? (Relevant if the adapter needs to manage multiple game sessions.)

6. **Game modifications:** Are we strictly limited to the wrapper pattern (no game bundle modifications)? Or is light modification acceptable for better integration?

7. ~~**Maze completion detection:**~~ ✅ **Answered.** DOM_REBUILD (MutationObserver on `#maze` childList) is instant and reliable. Points jump and STATS_CHANGE also work as confirmation. See Task 2.2.

## Architecture Decision: Wrapper vs. Modified Game

**Option A: Pure Wrapper (current approach)**
- Pros: Original game untouched, easy to update game version
- Cons: Limited to DOM observation and localStorage interception, timing issues with save/load

**Option B: Light Game Modification**
- Pros: Can expose game API directly, reliable save/load, proper event hooks
- Cons: Need to maintain modifications across game updates

**Recommendation:** Start with Option A (wrapper) for Phase 1-2. If the wrapper approach proves too fragile for save/load, consider Option B with minimal, well-documented modifications to the beautified bundle.

## References

- **Archipelago integration module:** `frontend/modules/a-mazing-idle-remote/`
  - `index-iframe.html` - Game HTML with `<base href>` and connection status
  - `mazeGameClient.js` - IframeClient integration (completion detection, save/load, eventBus)
- Game files (original test setup): `tests/test4/A-Mazing-Idle-New/`
- Archipelago iframe adapter: `frontend/modules/iframeAdapter/`
- IframeClient: `frontend/modules/iframe-base/iframeClient.js`
- Reference iframe app: `frontend/modules/textAdventure-remote/`
- Iframe Manager UI: `frontend/modules/iframeManagerPanel/`
- Game save key constant: search for `SAVE_GAME_LOCAL_STORE_KEY` in bundle
- Original iframe integration plan: `tests/test4/A-Mazing-Idle-New/iframe-integration-plan.md`
