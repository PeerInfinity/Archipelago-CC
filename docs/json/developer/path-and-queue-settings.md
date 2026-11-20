# Path and Queue Settings Ownership

This document clarifies which modules own which path and queue-related settings. Multiple modules interact with the player's path through the game world, and their settings serve distinct purposes.

## Settings by Category

### 1. Path Data Model (owned by `gameState`)

These settings affect how path entries are constructed and stored. They are the source of truth for path structure.

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `allowLoops` | boolean | `true` | Whether backward navigation creates loops or trims the path |
| `startRegions` | string[] | `['Menu']` | Starting regions; affects initial path and default trim target |
| `currentRegion` | string | `'Menu'` | Player's current position |
| `path` | array | (initial regionMove) | Ordered sequence of regionMove, locationCheck, and customAction entries |
| `regionInstanceCounts` | Map | (derived) | How many times each region appears in path |

**Access:** Use `gameState` public functions directly (e.g., `centralRegistry.getPublicFunction('gameState', 'setAllowLoops')`).

### 2. Queue Execution Behavior (owned by `loops/loopState`)

These settings control how the action queue is processed during loop execution. They do not affect path structure.

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `gameSpeed` | number | `10` | Action processing speed multiplier |
| `autoRestartQueue` | boolean | `false` | Restart queue automatically on completion |
| `isPaused` | boolean | `true` | Whether queue processing is paused |
| `repeatExploreStates` | Map | `{}` | Per-region flags for repeating explore actions |
| `instantMode` | boolean | `false` | Test mode: actions complete in one frame |
| `noManaDepletionReset` | boolean | `false` | Test mode: no loop reset on mana depletion |

**Persisted settings** (via `settingsManager`):
- `moduleSettings.loops.defaultSpeed`
- `moduleSettings.loops.autoRestart`
- `moduleSettings.loops.loopModeEnabled`

### 3. Queue Progress Tracking (owned by `loops/actionQueueManager`)

These are runtime tracking data, not user-configurable settings.

| Data | Type | Purpose |
|------|------|---------|
| `actionProgress` | Map (pathIndex -> 0-100) | Completion percentage per action |
| `actionCompleted` | Set of pathIndices | Which actions are finished |

### 4. UI Interaction Preferences (owned by `regionGraph`)

These control what happens when the user clicks on graph nodes. They are graph-specific interaction modes, not path settings.

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `clickActions` | object | `{ enabled: true, region: { 'path.route': { from: 'pathEnd' }, 'path.checkAll': false, 'regions.open': true }, location: { 'path.check': 'now' } }` | What a click runs, edited by the panel's "On click" strip (`regionView/clickActionsUI.js`). `enabled` is the master switch. `path.route` is `{ from: 'pathEnd' \| 'start' \| 'player' }` (extend the path, restart it from the start, move the player directly; always all the way) or `false`. `path.check` is `'now'` \| `'addToPath'` \| `false`. Other panels' ids (`regions.open`, …) are kept even when their panel is not loaded. Model: `frontend/modules/regionView/README.md` § Click actions |

`clickActions` replaced six of the old click keys (CA-S2): `addToPath` → `path.route.from = 'pathEnd'`; else `overwritePath` → `'start'`; else `movePlayerDirectly` → `'player'`; `showRegionInPanel` → `regions.open`; `checkAllLocationsInRegion` → `path.checkAll`; `addLocationsToPath` → `path.check: 'addToPath'`. The old "move one step" option (`movePlayerOneStep`) is removed and ignored. On first load with no stored `clickActions`, the panel migrates the old keys once and saves the result. Old keys already in a user's storage are left there, unread.

- **CA-S3** removed six of the old keys from the settings presets and has no reader for them: the Region Map now has its own `moduleSettings.regionMap.clickActions` (same shape, its own "On click" strip), whose first run copies the Region Graph's `clickActions` (§ the Region Map, `docs/json/developer/modules/regionMap.md`).
- `addLocationsToPath` is kept, in the schema and the presets: the Regions panel's location clicks (`regions/regionBlockBuilder.js`) read it until CA-S4. A save from the Region Graph's strip mirrors it (`addLocationsToPath` = `path.check === 'addToPath'`), so editing that strip still moves the Regions panel as the old checkbox did. No other old key is written. The Region Map's strip does not mirror it: the Map's location choice is its own.

### 5. Path Display Preferences (owned by `regions`)

These control how the path is rendered in the Regions panel. They do not modify the path itself.

| Setting | Type | Default | Purpose |
|---------|------|---------|---------|
| `showAll` | boolean | `false` | Show all regions (ignores path) |
| `showPaths` | boolean | `true` | Show full path vs. only the last region |

## Data Flow

```
gameState (path data model)
    │
    ├──► eventBus: gameState:pathUpdated
    │       │
    │       ├──► regionGraph (filters to regionMoves for visualization)
    │       │
    │       └──► regions (filters to regionMoves for panel display)
    │
    └──► loops/actionQueueManager (maps path to action objects + progress)
            │
            └──► loops/loopState (processes queue with execution settings)
```

## Shared Utilities

Path filtering logic (e.g., extracting only `regionMove` entries) is provided by `frontend/modules/shared/pathUtils.js` to avoid duplication across consumer modules.
