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
| ~~Generate New Maze command from parent~~ | ✅ Implemented as `amazingIdle:newMaze` eventBus event |
| ~~`?mode=mazegame` auto-launch~~ | ✅ Replaced with `?iframe=mazegame` (loads game into iframe panel) and `?metagame=mazegame` (loads maze game metagame config) |
| ~~Exit unlock detection (biome 8+)~~ | ✅ Implemented as `amazingIdle:exitUnlocked` eventBus event via MutationObserver on `#mazeCompletionRequirementsMazeKeysCheckMark` style attribute |
| ~~Alternative save import (no-reload)~~ | ✅ Tested: game's built-in import UI works without reload. See Task 4.2 results below. |
| ~~Save data size at high biomes~~ | ✅ Tested: save is ~3KB at all biomes. Even with all 44 upgrades and 40 stats maxed, only grows to ~3.6KB. Not a concern. |

## Key Technical Findings

### Game Save System

The game saves to localStorage under key `a-mazing-idle` (not `a-mazing-idle-game-save` as the docs suggest - verify this).

**Save format** - JSON with these top-level properties:
```
saveGameVersion, points, upgrades, stats, offline, experiment, toggles
```

**Save timing:**
- Auto-save every 20 seconds (`SAVE_GAME_INTERVAL = 20000`)
- Manual save via Settings modal or `#manualSaveGameButton` (synchronous flush to localStorage)

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

### Workarounds Despite Browserify Closure

Although `globalGame` is unreachable, the wrapper runs in the same page as the bundle, so several indirect techniques are available beyond localStorage + reload:

**1. Clicking DOM buttons programmatically**
jQuery event handlers are bound to DOM elements, not internal references. Programmatic `.click()` dispatches real events that jQuery handlers catch:
```javascript
document.querySelector('#experimentNewMaze').click(); // trigger new maze at biome 1+
```
This works for any game button — "Unlock New Biome", settings toggles, upgrade purchases, etc. This solves the "trigger new maze" problem (Task 2.3) trivially.

**2. Simulating keyboard input**
The game listens for key events on `document`/`window` for WASD/arrow movement. Native `dispatchEvent` does NOT work (jQuery doesn't respond to programmatic `KeyboardEvent` dispatches). However, jQuery's own `.trigger()` method might work since it goes through jQuery's internal event system:
```javascript
// Does NOT work:
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
// Might work (untested):
$(document).trigger($.Event('keydown', { keyCode: 39 })); // right arrow
```
If `.trigger()` works, it provides programmatic player movement control.

**3. Pre-bundle script injection**
Since we control `index-iframe.html`, we can run scripts *before* the game bundle loads to intercept globals:
- **Intercept `setInterval`** — capture the 20-second save timer callback, gaining control over save timing or a reference to the save function
- **Proxy `localStorage`** — get real-time notifications on every read/write, not just intercept at injection time:
  ```javascript
  const origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
      if (key === 'a-mazing-idle') {
          postMessage({ type: 'SAVE_UPDATED', data: value });
      }
      return origSetItem(key, value);
  };
  ```
- **Patch constructors** — if any game constructor passes through a reachable global (jQuery, etc.), it could be intercepted

Pre-bundle injection could potentially eliminate the need for page reloads on save import, by intercepting the save timer and injecting state at the right moment.

**4. Reading DOM state as a real-time data source**
Beyond MutationObserver for completion, the DOM exposes readable game state:
- `#points` text content for current score
- Upgrade button states (enabled/disabled, costs)
- Biome indicator
- Any visible game state

This provides a read-only API to game state without needing the game object.

**5. Overriding prototype methods (pre-bundle)**
If the game uses standard built-ins in identifiable ways, those can be intercepted before the bundle loads. For example, the game stores stats in a `Map` — overriding `Map.prototype.set` before the bundle executes could intercept stat updates (like `TOTAL_MAZES_COMPLETED`) in real time without waiting for auto-save. Fragile if the game's internals change, but viable for specific targeted hooks.

**Summary:** The Browserify wall is not as total as it first appears. The DOM is both an observation layer and a full input surface. Button clicking and keyboard simulation provide output control, pre-bundle injection provides interception, and DOM reading provides state observation.

### Pre-Bundle Hook Analysis (implemented and verified)

Since we control `index-iframe.html`, a `<script>` tag between the jQuery CDN scripts and `bundle-0.2.0.js` patches globals before the game initializes. Implemented in `index-iframe.html`.

**Script loading order:**
1. jQuery (CDN) — loaded first
2. swarm-numberformat, decimal.js (CDN)
3. **Pre-bundle hooks** — patches `setInterval`, `Map.prototype.set`, `Storage.prototype.setItem`, `$.fn.css`
4. `bundle-0.2.0.js` — creates game, registers timers, binds jQuery events
5. `mazeGameClient.js` (ES module, deferred) — connects to Archipelago

**Implemented hooks and results:**

| Hook | Global | Status | What it captures |
|------|--------|--------|------------------|
| `setInterval` intercept | `window.__saveTimerCallback`, `window.__saveTimerId` | ✅ Working | Save timer callback + ID. Can trigger saves, clear/replace timer. |
| `Map.prototype.set` intercept | `window.__statsMap` | ✅ Working (read/write) | Live `StatsManager.statsMap` (40 entries). Direct read/write to all stats, persists through saves. |
| `Map.prototype.set` intercept | `amazingIdle:statsUpdated` event | ✅ Working | Custom event fires on every stat mutation (real-time completion detection). |
| `localStorage.setItem` proxy | `amazingIdle:saveWritten` event | ✅ Working | Custom event fires on every game save. |
| `$.fn.css` intercept | `window.__mazeData` | ✅ Working (read-only) | Complete maze wall structure, tile visit state, player position, exit tile location. |
| `$.fn.css` intercept | `amazingIdle:mazeRendered` event | ✅ Working | Fires after each maze render with grid size, tile count, exit tile coords. |
| `$.fn.css` intercept | `amazingIdle:playerMoved` event | ✅ Working | Fires when a tile gets a background color for the first time (player/bot arrived). |

**Maze data capture — key technical details:**
The game renders tiles via individual jQuery `.css('border-top', '2.5px solid #ea80fc')` calls (2-arg, hyphenated). Solid walls use a single shorthand call; open passages use split `-width` and `-style` calls. The hook maps CSS property names to wall indices (0=UP, 1=RIGHT, 2=DOWN, 3=LEFT).

Border tiles (the ring at x=-1, y=-1, x=sizeX, y=sizeY) receive empty-string border values → null walls. Interior tile size is determined post-render by finding max x,y with non-null walls. Exit tile detected as the interior edge tile with an 'open' wall facing outside the grid.

Player/bot colors vary by biome (`ColorManager`), so tracking is color-agnostic: any non-empty/non-transparent `background-color` marks a tile as visited. `__mazeData.toArray()` converts the grid to a `[y][x]` 2D array matching the game's internal format.

Verified: ASCII maze rendering from `__mazeData` matches the visual maze pixel-for-pixel.

**Stats Map capture — key technical detail:**
The game creates stats Maps in three steps during initialization:
1. `STATS_TO_UI_ID_MAP` — module-level Map, stat key → DOM element ID (string values)
2. `StatsManager.statsMap` — constructor creates empty Map, `initStatsMap()` sets all values to 0
3. `Serializable.deserializeProperty()` — during `reloadFromLocalStorage()`, creates a NEW Map from saved data and **replaces** the Map from step 2

The hook always captures the latest numeric Map, so it gets the final deserialized Map from step 3 — which IS `StatsManager.statsMap` used for game logic and save serialization. Verified: writing to `__statsMap` and triggering manual save correctly persists to localStorage.

**Upgrade Map — NOT capturable via this method:**
`UpgradeManager.upgradeMap` stores `Map<UpgradeKey, Upgrade>` where values are Upgrade objects (not numbers). Deserialization updates `upgradeLevel` on existing objects in-place rather than replacing the Map. The Map we initially captured via `key === 'BIOME'` was actually a config Map (upgrade unlock-order), not the live game state.

**Verified closure variables in existing jQuery handlers:**
- Keydown handler (document): uses closure variable `game` — references `game.maze`, `game.powerUps`, `game.ui`
- Button click handlers: use `_this2.game.save.saveGameToLocalStorage()`, `_this2.game.toggles.*`, etc.
- 202 total jQuery handlers found, many referencing `.game.`
- These closures are NOT accessible retroactively — the Game object itself remains in the Browserify closure

**What the stats Map write access unlocks:**
- Direct stat manipulation without reload (TOTAL_MAZES_COMPLETED, TOTAL_POINTS_EARNED, etc.)
- Real-time completion detection via `amazingIdle:statsUpdated` event (no manual save needed)
- Stat correction/reset without full save import

**What the maze data hook unlocks:**
- Full maze wall structure on every new maze (grid of wall types per side)
- Exit tile location (interior edge tile with open exterior wall)
- Real-time visited tile tracking (color-agnostic, works across biomes)
- Player/bot movement events (`amazingIdle:playerMoved`)
- `toArray()` method for `[y][x]` 2D array access
- ASCII maze rendering, pathfinding, and maze analysis from captured data

**What still requires localStorage + reload or import UI:**
- Upgrade level changes (Upgrade objects not directly accessible)
- Point balance changes (Points manager not captured)
- Biome changes (via upgrade level on BIOME upgrade)

### Maze Tile Write Access Analysis

**Problem:** The `$.fn.css` hook provides full read access to the maze wall structure, but the underlying `MazeCell` objects (with their `walls` arrays) live inside the Browserify closure and we never get a reference to them. Writing to the DOM is cosmetic only — the game doesn't read the DOM.

**Approaches investigated:**

| Approach | Feasibility | Notes |
|----------|------------|-------|
| Hook `Array.prototype` for wall access | ❌ Not viable | Game reads walls by direct index (`walls[0]`), not interceptable on plain arrays |
| Extract `game` from `__saveTimerCallback` closure | ❌ Not viable | JS provides no way to access closure variables from outside |
| Extract `game` from jQuery handler closures (`$._data()`) | ❌ Not viable | Can get handler functions but not their closure scope |
| `Object.defineProperty` on `MazeCell` prototype | ❌ Not viable | Prototype defined inside bundle, not reachable |
| Hook `Function.prototype.call/apply` | ❌ Not viable | Direct method calls don't go through these; would be extremely noisy |
| jQuery `.trigger()` for player movement | ⚠️ Untested | `$(document).trigger($.Event('keydown', {keyCode: 38}))` might work where native `dispatchEvent` doesn't, since it goes through jQuery's event system directly |
| `Math.random` hook (pre-bundle) | ✅ Viable | Replace with seeded PRNG to get predictable/controllable maze layouts. Controls generation, not existing mazes |
| Modified bundle (local copy) | ✅ Viable (breaks pure wrapper) | Add `window.game = globalGame` to bundle. Gives full read/write to everything. Requires hosting bundle locally instead of CDN |

**Conclusion:** True write access to maze tile data (modifying walls, item positions) requires either a modified bundle or a fundamentally different approach. The pure wrapper can only observe the maze and act through button clicks (`#experimentNewMaze`) and potentially jQuery `.trigger()` for movement. For current integration needs, read-only maze data plus the existing button-click and import-UI write paths are sufficient.

### TypeScript Source Analysis (from older version — verified against live bundle)

TypeScript source for an older version of the game is available at `~/tests/test4/A-Mazing-Idle/src/`. Since the live game runs a Browserified bundle, we can't inspect it directly, but the source reveals the internal architecture. **Most details below have been verified against the live version** — differences are noted inline.

#### Game Architecture (no internal event system)

The game has **no pub-sub or event emitter** — all communication is via direct method calls between managers. This means jQuery DOM bindings are the *only* event surface available to the wrapper.

**Game object structure** — all managers are public properties:
```
game.maze       - MazeManager (generation, player movement)
game.points     - Points (currency)
game.save       - SaveManager (localStorage I/O)
game.upgrades   - UpgradeManager (Map<UpgradeKey, Upgrade>)
game.stats      - StatsManager (Map<StatsKey, number>)
game.players    - PlayerManager (Map<number, Player>)
game.rngBot     - RNGBotManager (bot AI, timers)
game.ui         - UserInterface (DOM rendering, jQuery events)
game.items      - MazeItemManager (spawn, pickup)
game.powerUps   - PowerUpManager
game.offline    - OfflineManager
```

**Initialization sequence** (in `index.ts`):
1. `$(document).ready()` → `new Game(IS_DEV_MODE_DISABLE_UI, IS_DEV_MODE_ENABLED)`
2. `game.reloadFromLocalStorage()` → deserializes save, calculates offline rewards
3. `game.startGame()` → `maze.deleteMaze()` → `maze.newMaze()` → `ui.printMazeV2()`

#### jQuery Event Bindings (verified)

From `UserInterface.initEvents()` — these are the DOM buttons with click handlers. All verified present in live version except `#deleteSaveGame` (removed, see notes).

| Element ID | Action | Verified |
|-----------|--------|----------|
| `#manualSaveGameButton` | Save to localStorage (synchronous flush) | ✅ Used by `triggerManualSave()` to get fresh data before localStorage reads |
| `#newGame` | Hard reset ("New Game") | ✅ |
| `#copySaveJson` | Export save JSON to clipboard | ✅ |
| `#importSaveOpenModalButton` | Open import modal | ✅ |
| `#importSaveModalButton` | Import save from `#importSaveTextArea` | ✅ Used for no-reload import (see Task 4.2) |
| `#statsButton` | Open stats modal | ✅ |
| `#helpButton` | Open help modal | ✅ |
| `#settingsButton` | Open settings modal | ✅ |
| `#openControlsModalButton` | Open controls modal | ✅ |
| `#changeLogButton` | Open change log | ✅ (new, not in older source) |
| `#clearAllStats` | Reset all stats | ✅ (new, not in older source) |
| `#experimentNewMaze` | Generate new maze | ✅ Used by `amazingIdle:newMaze` |

**Removed from live version:** `#deleteSaveGame` — no longer exists. `#newGame` handles full reset.

#### Keyboard Bindings (verified — jQuery present, programmatic dispatch does not work)

Bound on `$(document).keydown` in `index.ts`. jQuery is confirmed loaded in the live version. Note: programmatic `KeyboardEvent` dispatch does NOT trigger these handlers (see Task 2.1 notes).

| Key | Code | Action |
|-----|------|--------|
| Up/W | 38/87 | `movePlayer(DIRECTION_UP)` |
| Down/S | 40/83 | `movePlayer(DIRECTION_DOWN)` |
| Left/A | 37/65 | `movePlayer(DIRECTION_LEFT)` |
| Right/D | 39/68 | `movePlayer(DIRECTION_RIGHT)` |
| Q | 81 | `maze.teleportBotBackToPlayer()` |
| E | 69 | `maze.teleportPlayerBackToBot()` |
| 1 | 49 | `powerUps.activatePowerUp(SPEED_UP)` |
| 2 | 50 | `powerUps.activatePowerUp(POINTS_MULTIPLIER)` |
| Esc | 27 | `ui.closeAllModals()` |

#### setInterval/setTimeout Calls (interceptable pre-bundle)

| Timer | Interval | Purpose |
|-------|----------|---------|
| `SaveManager` | `setInterval(save, 20000)` | Auto-save every 20s |
| `RNGBotManager` | `setInterval(moveLoop, interval)` | Bot auto-movement |
| `RNGBotManager` | `setTimeout(enableAutoMove, 3000)` | Re-enable after maze completion |
| `PowerUp` | `setTimeout(deactivate, duration)` | Powerup active timer |
| `PowerUp` | `setInterval(updateUi, 100)` | Powerup UI refresh |

#### Full Save Format (from TypeScript types)

```json
{
  "points": { "points": number },
  "upgrades": {
    "upgradeMap": {
      "POINTS_PER_VISIT": level,
      "MAZE_SIZE_UPGRADE": level,
      "BOT_MOVEMENT_SPEED": level,
      ...
    }
  },
  "stats": {
    "statsMap": "~~[[\"TOTAL_POINTS_EARNED\",N],[\"TOTAL_TILES_VISITED\",N],[\"TOTAL_MAZES_COMPLETED\",N],...]"
  },
  "offline": {
    "saveTimeStamp": milliseconds,
    "offlinePointsPerSecond": number
  }
}
```

Note: The live save also includes `saveGameVersion`, `experiment`, and `toggles` top-level keys not present in this older source — these were likely added in newer versions.

#### Maze Generation Chain (from source)

1. `Game.startGame()` → `maze.deleteMaze()` → removes old `<td>`/`<tr>` from DOM
2. `maze.newMaze()` → reads biome → selects grid type (SQUARE, RECTANGLE, PLUS_SIGN, DIAMOND) and algorithm
3. `new PrimsMaze(game, size, gridType)` → runs Prim's algorithm in constructor
4. `generateMazeSmartPathingArr()` → BFS for exit distances (used by bot AI)
5. `items.generateMazeItems()` → spawns FRUIT, BRAIN, BLACK_HOLE, etc.
6. `ui.printMazeV2()` → renders to `#maze > tbody` via jQuery `.append()`

#### Key DOM Element IDs (verified)

All element IDs below confirmed present in the live version.

**Core:** `#maze` (table), `#points` (display), `#saveToastModal` (notification)

**Modals:** `#settingsModal`, `#statsModal`, `#helpModal`, `#importSaveModal`, `#controlsModal`, `#offlineModal`

**Import save:** `#importSaveTextArea` (input), `#importSaveErrorLabel` (validation)

**Stats display:** `#statsTotalMazesCompleted`, `#statsTotalPointsEarned`, `#statsTotalTilesVisited`, `#averagePointsEarnedPerSecond`, and many more

**Tile IDs:** Dynamic, format `"${x}_${y}"` with underscores (e.g., `"0_0"`, `"5_3"`). **Changed from older source** which used hyphens (`"x-y"`). Includes border tiles at `-1` coordinates (e.g., `"-1_-1"`).

**Upgrade buttons:** Pattern `"${uiId}Button"`, `"${uiId}Text"`, `"${uiId}Tooltip"`

#### DOM Read/Write Capabilities (verified)

The DOM is a **one-way rendering surface** — the game holds all state in the Browserify closure and renders to the DOM. Writing to the DOM changes only the display, not the game state.

**Readable from DOM (and pre-bundle hooks):**

| Source | What you get | Notes |
|--------|-------------|-------|
| `window.__mazeData.grid` | Complete maze wall structure | Via `$.fn.css` hook. Each tile has `walls: [up,right,down,left]` with values `'wall'`, `'open'`, `'destructible'`, or `null` |
| `window.__mazeData.exitTile` | Exit tile `{x, y, side}` | Interior edge tile with open wall facing outside |
| `window.__mazeData.toArray()` | 2D array `[y][x]` of tiles | Matches game's internal grid format |
| `window.__statsMap` | Live stats Map (40 entries) | Via `Map.prototype.set` hook. Read/write, persists through saves |
| `#points` | `textContent` = `"Points: 773"` | Current point display |
| `#maze td` cells | Tile state via inline `style` attribute | See tile encoding below |
| `#statsTotalMazesCompleted` etc. | Stat values as text | Only update when stats modal is opened by game code |
| `#mazeCompletionRequirementsPanel` | `display` = `none` (biome <8) or `block` (biome 8+) | Checkmark style tracks exit unlock |

**Tile encoding (inline `style` attribute on `#maze td`):**

| Property | Values | Meaning |
|----------|--------|---------|
| `background-color` | `none`/transparent | Unvisited tile |
| | Varies by biome (e.g., `#03dac6` teal at biome 0) | Player position |
| | Varies by biome (e.g., pink at biome 0) | Bot position / visited tile |
| `border-style` per side | `solid` | Wall present |
| | `hidden` | Open passage |
| | `dotted` | Destructible wall |
| `border-*-color` | `#ea80fc` (pink) | All wall borders use this color |
| Child `<img>` elements | Present at biome 8+ | Keys, items (fruit, brain, etc.) |

**CSS call patterns (discovered via `$.fn.css` hook):**
- Game uses individual 2-arg hyphenated jQuery calls: `.css('border-top', value)`
- Solid walls: single shorthand call `'2.5px solid #ea80fc'`
- Open passages: two calls — `.css('border-bottom-width', '2.5px')` + `.css('border-bottom-style', 'hidden')`
- Border ring tiles (x=-1, y=-1, x=sizeX, y=sizeY): empty string values for all borders
- Player/bot colors vary by biome via `ColorManager` — detection must be color-agnostic

The full maze structure is captured in real-time by the `$.fn.css` hook into `window.__mazeData`. The exit tile is detectable as the interior edge tile with an `'open'` wall facing outside the grid (no special DOM marker exists for it).

**Writable (functional — triggers game logic via button clicks):**

| Action | How |
|--------|-----|
| Flush save to localStorage | `#manualSaveGameButton.click()` |
| Generate new maze | `#experimentNewMaze.click()` |
| No-reload save import | Set `#importSaveTextArea.value`, click `#importSaveModalButton` |
| Hard reset | `#newGame.click()` (destructive) |

**Not writable (DOM changes are cosmetic only):**

Changing tile `backgroundColor`, `border-style`, or `#points` `textContent` via JavaScript does NOT affect the game's internal state. The game does not read the DOM — it only writes to it.

#### Source File Map

| File | Purpose |
|------|---------|
| `src/index.ts` | Entry point — jQuery init, keyboard binding |
| `src/managers/Game.ts` | Main game class, orchestrates all managers |
| `src/managers/SaveManager.ts` | localStorage I/O, auto-save timer |
| `src/managers/UserInterface.ts` | jQuery event binding, modal display, DOM rendering |
| `src/managers/MazeManager.ts` | Maze state, player movement logic |
| `src/managers/MazeUtils.ts` | Factory — grid types, algorithm selection |
| `src/maze/PrimsMaze.ts` | Prim's algorithm implementation |
| `src/mazeGrid/*.ts` | Grid shape implementations |
| `src/managers/RNGBotManager.ts` | Bot AI, movement timers |
| `src/managers/UpgradeManager.ts` | Upgrade map, costs, unlock logic |
| `src/managers/StatsManager.ts` | Cumulative stat tracking (Map-based) |
| `src/managers/PointsManager.ts` | Currency tracking |
| `src/managers/MazeItemManager.ts` | Item spawning, pickup |
| `src/managers/PowerUpManager.ts` | Powerup map and timers |
| `src/managers/OfflineManager.ts` | Offline reward calculation |

### localStorage Key (Confirmed)

The save key is `a-mazing-idle` (NOT `a-mazing-idle-game-save` as README suggests). Save format nests points as `{ points: { points: N } }`.

### JavaScript Point Injection and Biome Setting (Tested)

Can fast-track progression without playing. **Setting the biome directly does not require having enough points** — just set `upgrades.upgradeMap.BIOME` to the desired value:
```javascript
const save = JSON.parse(localStorage.getItem('a-mazing-idle'));
save.upgrades.upgradeMap.BIOME = 8; // set biome directly, no points needed
localStorage.setItem('a-mazing-idle', JSON.stringify(save));
location.reload(); // game reads new save on load
```
This is also available via the `amazingIdle:setBiome` eventBus event from the parent.

Point injection is still useful for testing purchases/upgrades:
```javascript
save.points.points = 50000;
```

---

## Implementation Plan

### Phase 1: Game State Save/Load Through Iframe

**Goal:** Be able to save and restore the full game state through the iframe wrapper, including advancing to biome 1+ where more features are available.

#### Task 1.1: Investigate Game Object Accessibility ✅ DONE
- `globalGame` is NOT accessible from `window` scope (Browserify closure)
- `window.require` is undefined
- Cannot call save/load methods directly
- Must use localStorage manipulation + page reload approach

#### Task 1.2: Implement Save Export via Wrapper ✅ DONE
- Implemented via `amazingIdle:exportSave` eventBus event
- Parent publishes `amazingIdle:exportSave` → adapter forwards to iframe → `mazeGameClient.js` reads localStorage → publishes `amazingIdle:saveExported` with `{ saveJson, timestamp }`
- Save data is ~3KB JSON string (biome 0 save)
- Dynamic publisher registration in iframeAdapter handles the response event automatically

#### Task 1.3: Implement Save Import via Wrapper ✅ DONE
- Implemented via `amazingIdle:importSave` eventBus event
- Parent publishes `amazingIdle:importSave` with `{ saveJson }` → adapter forwards to iframe → `mazeGameClient.js` blocks game saves, writes to localStorage, reloads
- **Tested end-to-end:** Successfully imported modified save (biome 2, 5000 points) from biome 0 state. Game loaded correctly with all injected state, Points showed 5001 (injected + earned).
- After reload, the IframeClient re-initializes and re-establishes connection automatically
- **Critical detail:** Must block `localStorage.setItem` BEFORE writing the custom save, otherwise the running game's `beforeunload` handler overwrites it during reload.
- **Alternative approach:** ✅ **Tested in Task 4.2.** Game's built-in import UI works without reload, maintains connection, and is faster. Recommended over reload-based import. Side effect: triggers DOM rebuild, but manual save + stat check (see Task 2.2) correctly filters this as a non-completion.

#### Task 1.4: Create Test Save Files — REMOVED
- No longer needed. Can fast-track to any biome instantly via no-reload import (set `upgrades.upgradeMap.BIOME` directly) or `amazingIdle:setBiome` eventBus event.

### Phase 2: Maze Event Detection and New Maze Generation

**Goal:** Reliably detect maze completion (not just exit unlock) and trigger new mazes.

#### Task 2.1: Exit Unlock Detection (biome 8+) ✅ TESTED

**Detection method:** MutationObserver on `#mazeCompletionRequirementsMazeKeysCheckMark` style attribute.

**State transitions observed at biome 8 (1 key required):**
| State | `keysCheckMark` display | `keysXMark` display | `keysCount` text |
|-------|------------------------|--------------------|--------------------|
| New maze (locked) | `none` | `flex` | "0 / 1" |
| Key found (unlocked) | `flex` | `none` | "1 / 1" |
| New maze generated | `none` | `flex` | "0 / 1" (reset) |

**Full lifecycle at biome 8:**
1. New maze generated → checkmark `none`, X mark `flex`, count "0 / 1"
2. Player picks up key → count updates to "1 / 1", checkmark `flex`, X mark `none` → **exit unlocked**
3. Player reaches exit → maze completed (DOM rebuild detected by `amazingIdle:mazeCompleted`), then resets to step 1

**Implementation: `amazingIdle:exitUnlocked` event** (in `mazeGameClient.js` `setupExitUnlockDetection()`):
- Watches `#mazeCompletionRequirementsMazeKeysCheckMark` with `MutationObserver({ attributes: true, attributeFilter: ['style'] })`
- When `style.display` changes from `none` to `flex` → publishes `amazingIdle:exitUnlocked` with `{ timestamp }`
- Tracks `wasUnlocked` state to only fire on transition (not on repeated `flex` sets)
- At biome < 8, gracefully skips (no completion requirements panel)
- Verified end-to-end: iframe observer → postMessage → iframeAdapter → parent eventBus
- Re-trigger works: `none → flex` (fires) → `flex → none` (reset) → `none → flex` (fires again)

**Note on programmatic keyboard input:** Dispatching `KeyboardEvent` via `document.dispatchEvent()` does NOT move the player — the game likely uses jQuery's `$(document).keydown()` which doesn't respond to programmatic dispatches. Manual play or bot automation is required.

**Tile percentage panel** (`#mazeCompletionRequirementsTilePercentagePanel`): Not present at biome 8. Would appear at biome 14+ where tile % requirement kicks in. Same MutationObserver approach should work.

**No dedicated exit tile DOM element:** The exit tile is a regular `.mazeCell` without special locked/unlocked styling. The completion requirements panel is the only reliable detection method.

#### Task 2.2: Actual Maze Completion Detection ✅ TESTED

The real completion happens when the player reaches the exit. Three detection methods were tested on the live game (https://imgreghenry.github.io/A-Mazing-Idle/):

| Method | How it works | Timing | Reliability |
|--------|-------------|--------|-------------|
| **DOM_REBUILD** | MutationObserver on `#maze` for `childList` changes | **Instant** (~0ms) | High - exactly 63 child changes per completion (5x5 maze), fires at exact moment |
| **Points jump** | Monitor `#points` text for jumps >10 pts | **~130-210ms** after rebuild | Medium - needs threshold tuning, could false-positive from purchases. **Decided against:** DOM_REBUILD is more reliable and instant. |
| **STATS_CHANGE** | Intercept `localStorage.setItem`, parse `TOTAL_MAZES_COMPLETED` from serialized Map (`~~[[...]]` format) | **Delayed** (up to 20s, fires on auto-save) | High - definitive count, but delayed |

**Stats format note:** Stats are stored as a serialized Map string in `save.stats.statsMap`, e.g., `"~~[[\"TOTAL_MAZES_COMPLETED\",3],...]"`. Must parse with `JSON.parse(str.replace('~~',''))` then `new Map(arr)`.

**Recommended approach:** DOM_REBUILD as trigger, then manual save + STATS_CHANGE as confirmation (definitive).

**Final implementation (manual save + stat check):**
The game has a `#manualSaveGameButton` that synchronously flushes in-memory state to localStorage when clicked. By clicking this after a DOM rebuild and reading `TOTAL_MAZES_COMPLETED`, we get definitive completion detection without the 20s auto-save delay:
```javascript
// After DOM rebuild detected and debounce settles:
triggerManualSave();  // click #manualSaveGameButton to flush in-memory state
const currentCount = readTotalMazesCompleted();  // parse stats from localStorage
if (currentCount > lastMazeCount) {
    // Real completion — TOTAL_MAZES_COMPLETED incremented
    lastMazeCount = currentCount;
    publishEvent('amazingIdle:mazeCompleted', { totalMazesCompleted: currentCount, ... });
} else {
    // False positive — import or newMaze rebuild, not a real completion
    console.log('DOM rebuild (not a completion)');
}
```
This eliminates false positives from imports, newMaze, and any other DOM rebuild that doesn't increment the stat.

#### Task 2.3: Test New Maze Trigger ✅ DONE
- `#experimentNewMaze` button exists and is `display: inline-block` at **all biomes** (including biome 0)
- Programmatic `.click()` works from outside the Browserify closure
- Triggers full maze rebuild: MutationObserver detects 48 DOM changes, `amazingIdle:mazeCompleted` fires
- Implemented as `amazingIdle:newMaze` eventBus event in `mazeGameClient.js` — subscribes to event, clicks `#experimentNewMaze`
- No page reload needed — instant maze generation
- "Generate New Maze" button in Maze Game Data panel wired to this event

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
  - Set biome → `amazingIdle:setBiome` with `{ biome: number }` (modifies `upgrades.upgradeMap.BIOME`, reloads)
  - New maze → `amazingIdle:newMaze` (clicks `#experimentNewMaze`, no reload)
  - Inject points → `amazingIdle:injectPoints` with `{ points: number }` (modifies `points.points`, reloads)

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

#### Task 4.1: Test Full Lifecycle ✅ DONE
- ✅ Load game via Iframe Manager — working (select "A-Mazing-Idle" from Known Pages, click Load Iframe)
- ✅ IframeClient handshake — IFRAME_READY → ADAPTER_READY → IFRAME_APP_READY all complete
- ✅ Heartbeat — running at 30s intervals
- ✅ Manual maze completion — detected: "Maze completed (#1, 48 DOM changes)" published to eventBus
- ✅ Export save state via `amazingIdle:exportSave` — returns ~3KB JSON, parsed correctly by Maze Game Data panel
- ✅ Import save state via `amazingIdle:importSave` — biome 2 + 5000 points injected successfully, game reloads and reconnects
- ✅ Set biome via `amazingIdle:setBiome` — biome changed from 2→0 and back, verified via Refresh
- ✅ New maze via `amazingIdle:newMaze` — triggers `#experimentNewMaze` click, completion detected instantly
- ✅ Maze Game Data panel: Game State Summary correctly parses biome, points, mazes, bot upgrades from save data

#### Task 4.2: Alternative Save Import (No-Reload) ✅ TESTED

**Method:** Use the game's built-in import UI: `#importSaveOpenModalButton` → `#importSaveTextArea` → `#importSaveModalButton`

**Flow:**
1. `doc.querySelector('#importSaveOpenModalButton').click()` — opens import modal
2. `doc.querySelector('#importSaveTextArea').value = modifiedSaveJson` — set save data
3. `doc.querySelector('#importSaveModalButton').click()` — triggers import
4. `doc.querySelector('#importSaveModal').style.display = 'none'` — close modal

**Results:**
- Game updates in-place without page reload ✅
- Points display updates instantly ✅
- Biome changes apply immediately (maze regenerates to new biome size/style) ✅
- IframeClient connection maintained throughout (no re-handshake needed) ✅
- localStorage auto-save catches up within 20s ✅
- Rapid back-to-back imports work (tested biome 8→3→5→1) ✅

**Side effect — false maze completion events:**
The game's import function rebuilds the entire DOM, triggering the `amazingIdle:mazeCompleted` MutationObserver.

| Source | DOM changes |
|--------|------------|
| Real new maze (biome 0, 5×5) | ~48 |
| Real new maze (biome 1) | ~63 |
| Import (biome 8→3) | 168 |
| Import (biome 3→5) | 169 |
| Import (biome 5→1) | 189 |

Import mutations are 2-4× larger than real completions, but this threshold is unreliable for larger biomes. **Solved:** Manual save + `TOTAL_MAZES_COMPLETED` stat check (see Task 2.2) eliminates false positives entirely — imports don't increment the stat, so the observer correctly ignores them without needing flag-based suppression.

**Advantage over reload-based import:**
- No connection drop/re-handshake
- Faster (~instant vs ~3s reload + reconnect)
- No loss of MutationObserver state (completion count, exit unlock tracking)

#### Task 4.3: Create a Proper Test Parent — REMOVED
- No longer needed. The full integration test URL provides all testing capability:
  `http://localhost:8000/frontend/?panel=mazeGameDataPanel,iframePanel&iframe=mazegame`
  Includes: eventBus, connection status, save management, and completion logging.

---

## Open Questions

1. ~~**localStorage key:**~~ ✅ **Answered.** Key is `a-mazing-idle`. Points stored as `{ points: { points: N } }`.

2. ~~**Global game object:**~~ ✅ **Answered.** NOT accessible. Browserify closure prevents access. Can use localStorage + reload, or the game's built-in import UI for no-reload updates (see Task 4.2).

3. ~~**Save data size:**~~ ✅ **Answered.** Save is ~3KB at all biomes (0 through 100). Structure has fixed keys: 44 upgrades, 40 stats, plus points/offline/toggles/experiment. Even with all values maxed to large numbers, save only grows to ~3.6KB. postMessage overhead is negligible. Not a concern.

4. ~~**Biome progression requirements:**~~ ✅ **Answered.** Completion requirements start at biome 8 (1 key). Biome costs: 200, 400, 1K, 2K, 4K, 6K, 10K, 15K = 38,400 total to reach biome 8. Can set biome directly via `upgrades.upgradeMap.BIOME` without needing points.

5. **Multiple instances:** Does the game support multiple instances with separate saves? (Relevant if the adapter needs to manage multiple game sessions.) — Open

6. ~~**Game modifications:**~~ ✅ **Resolved.** Wrapper-only approach (Option A) has proven sufficient for all phases. No game bundle modifications needed. Manual save button click + stat reading solved the last reliability issue (stale data and false completions).

7. ~~**Maze completion detection:**~~ ✅ **Answered.** DOM_REBUILD (MutationObserver on `#maze` childList) is instant and reliable. Points jump and STATS_CHANGE also work as confirmation. See Task 2.2.

## Architecture Decision: Wrapper vs. Modified Game — RESOLVED

**Option A: Pure Wrapper** ✅ Selected and proven through all 4 phases.
- Original game untouched, easy to update game version
- DOM button clicking (`triggerManualSave()`, `#experimentNewMaze`) bridges the gap between wrapper and game internals
- `TOTAL_MAZES_COMPLETED` stat check provides definitive completion detection without needing game object access

**Option B: Light Game Modification** — Not needed.
- The wrapper approach handles all current requirements: save/load, completion detection, state injection, and new maze generation.

## Complete EventBus Event Mapping

| Event | Direction | Payload | Effect |
|-------|-----------|---------|--------|
| `amazingIdle:exportSave` | Parent → Iframe | `{}` | Triggers manual save, reads localStorage, publishes `saveExported` |
| `amazingIdle:saveExported` | Iframe → Parent | `{ saveJson, timestamp }` | Parent receives full save JSON |
| `amazingIdle:importSave` | Parent → Iframe | `{ saveJson }` | Iframe blocks game saves, writes to localStorage, reloads |
| `amazingIdle:setBiome` | Parent → Iframe | `{ biome: number }` | Triggers manual save, sets `upgrades.upgradeMap.BIOME`, reloads |
| `amazingIdle:injectPoints` | Parent → Iframe | `{ points: number }` | Triggers manual save, sets `points.points`, reloads |
| `amazingIdle:newMaze` | Parent → Iframe | `{}` | Clicks `#experimentNewMaze`, triggers new maze instantly |
| `amazingIdle:mazeCompleted` | Iframe → Parent | `{ completionCount, totalMazesCompleted, mutationCount, timestamp }` | Fired only on real completion (verified via `TOTAL_MAZES_COMPLETED` stat) |

## Bug Fixes Found During Testing

1. **Maze Game Data panel biome parsing** — Was reading `save.upgrades[key]` (iterating top-level keys like `upgradeMap`) instead of `save.upgrades.upgradeMap.BIOME`. Fixed to read correct nested path.
2. **Bot upgrades parsing** — Same issue: was reading `save.upgrades` keys instead of `save.upgrades.upgradeMap` keys for bot/auto upgrade counting.

## References

- **Archipelago integration module:** `frontend/modules/a-mazing-idle-remote/`
  - `index-iframe.html` - Game HTML with `<base href>` and connection status
  - `mazeGameClient.js` - IframeClient integration (completion detection, save/load, eventBus)
- **TypeScript source (older version):** `~/tests/test4/A-Mazing-Idle/src/` — internal architecture reference, needs verification against live bundle
- Game files (original test setup): `tests/test4/A-Mazing-Idle-New/`
- Archipelago iframe adapter: `frontend/modules/iframeAdapter/`
- IframeClient: `frontend/modules/iframe-base/iframeClient.js`
- Reference iframe app: `frontend/modules/textAdventure-remote/`
- Iframe Manager UI: `frontend/modules/iframeManagerPanel/`
- Game save key constant: search for `SAVE_GAME_LOCAL_STORE_KEY` in bundle
- Original iframe integration plan: `tests/test4/A-Mazing-Idle-New/iframe-integration-plan.md`
