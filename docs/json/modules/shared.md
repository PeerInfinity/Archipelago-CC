# Shared Module

**Module ID:** `shared`

**Purpose:** Provides thread-agnostic utilities used across the entire frontend. Designed to run identically in both web worker (StateManager) and main thread (UI) contexts.

## Key Files

- `frontend/modules/shared/ruleEngine.js` - Core rule evaluation engine
- `frontend/modules/shared/stateInterface.js` - Thread-agnostic context objects
- `frontend/modules/shared/pathfinder.js` - Region pathfinding
- `frontend/modules/shared/playerIdUtils.js` - Player ID normalization
- `frontend/modules/shared/bidirectionalDetector.js` - Exit pattern detection
- `frontend/modules/shared/profiler.js` - Performance profiling
- `frontend/modules/shared/loggerService.js` - Logging system
- `frontend/modules/shared/gameLogic/` - Game-specific logic modules

## Sub-Modules

### ruleEngine.js

Core rule evaluation engine for Archipelago JSON rules.

**Key Exports:**
```javascript
evaluateRule(rule, context, depth, localScope)  // Evaluate rule against snapshot
resolveHelperScope(helperDefinition, args, staticData, playerIdStr)  // Resolve helper params
debugRule(rule, indent)  // Debug rule tree
```

### stateInterface.js

Creates thread-agnostic context objects for rule evaluation.

**Key Export:**
```javascript
createStateSnapshotInterface(snapshot, staticData, contextVariables)
```

**Interface Methods:**
- `executeHelper(name, ...args)` - Call game-specific helpers
- `hasItem(itemName)` / `countItem(itemName)` - Item queries
- `isRegionReachable(regionName)` - Region accessibility
- `isLocationAccessible(locationName)` - Location accessibility
- `getStaticData()` - Access game data
- `resolveName(name)` - Python name resolution

### pathfinder.js

Find shortest accessible paths between regions.

**Key Export:**
```javascript
class PathFinder {
    findPath(sourceRegion, targetRegion)  // Returns path with steps
}
```

### playerIdUtils.js

Centralized player ID normalization for multiworld support.

**Key Exports:**
```javascript
DEFAULT_PLAYER_ID  // Constant '1'
PlayerIdUtils.normalize(id)  // Convert to string
PlayerIdUtils.toNumber(id)  // Convert to number
PlayerIdUtils.getPlayerData(dataObject, playerId)  // Access player data
PlayerIdUtils.equals(id1, id2)  // Equality check
```

### bidirectionalDetector.js

Analyzes region graph to detect bidirectional exit patterns.

**Key Export:**
```javascript
detectBidirectionalMode(regions, options)
// Returns: { mode, recommendation, statistics }
```

**Detection Modes:**
- `explicit_bidirectional` - Most pairs have explicit two-way exits
- `assume_all_bidirectional` - Assume all exits are bidirectional
- `mixed_with_trapped` - Some regions are "trapped"

### gameLogic/gameLogicRegistry.js

Thread-agnostic game detection and logic module selection.

**Key Export:**
```javascript
getGameLogic(gameName)  // Returns { logicModule, helperFunctions }
```

**Supported Games:**
- A Link to the Past (alttp)
- Super Metroid (sm)
- SM/Z3 Randomizer (smz3)
- Lingo
- StarCraft 2 (sc2)
- Pokemon Red/Blue
- Pokemon Emerald
- Stardew Valley
- Jak and Daxter
- Secret of Evermore
- Yacht Dice
- Yu-Gi-Oh! 2006
- Generic fallback

## Events

The shared module does not publish or subscribe to events. It provides pure utility functions.

## Thread Safety

All shared modules are designed to be thread-agnostic:
- No DOM dependencies
- No global state mutations
- Pure function implementations
- Safe for use in Web Workers

## Usage Example

```javascript
import { evaluateRule } from './shared/ruleEngine.js';
import { createStateSnapshotInterface } from './shared/stateInterface.js';
import { PathFinder } from './shared/pathfinder.js';

// Create interface from snapshot
const stateInterface = createStateSnapshotInterface(snapshot, staticData);

// Evaluate a rule
const result = evaluateRule(locationRule, stateInterface);

// Find path between regions
const pathfinder = new PathFinder(staticData, stateInterface);
const path = pathfinder.findPath('Menu', 'Boss Room');
```

## Dependencies

The shared module has minimal dependencies:
- **ruleEngine:** No external dependencies
- **stateInterface:** Depends on ruleEngine, gameLogicRegistry
- **pathfinder:** Depends on stateInterface, ruleEngine
- **Other utilities:** No dependencies (pure functions)
