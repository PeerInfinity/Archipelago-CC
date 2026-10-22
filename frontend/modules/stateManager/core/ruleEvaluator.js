/**
 * Rule Evaluator Module
 *
 * Handles helper function execution and state method execution.
 *
 * **Data Flow**:
 *
 * Helper Execution (executeHelper):
 *   Input: Helper function name and arguments
 *     ├─> name: string (helper function name)
 *     ├─> args: any[] (arguments to pass to helper)
 *
 *   Processing:
 *     ├─> Get current snapshot from StateManager
 *     ├─> Get static game data from StateManager
 *     ├─> Add evaluateRule method to snapshot for helper use
 *     ├─> Call helper function with (snapshot, staticData, ...args)
 *
 *   Output: Helper function result (boolean or any type); `undefined` (undetermined, warned once per
 *   name) when no helper of that name exists — the reachability loop reads it as not traversable
 *
 * State Method Execution (executeStateMethod):
 *   Input: Method name and arguments
 *     ├─> method: string (method name to execute)
 *     ├─> args: any[] (arguments to pass to method)
 *
 *   Processing:
 *     ├─> Check if method exists on StateManager instance
 *     ├─> Check for special cases (can_reach)
 *     ├─> Check modern helperFunctions system
 *     ├─> Check legacy helpers system (with/without underscore)
 *
 *   Output: Method result (typically boolean)
 *
 * **Recursion Protection**:
 * Both executeHelper and executeStateMethod set _inHelperExecution flag to prevent
 * infinite recursion when getSnapshot calls computeReachableRegions.
 *
 * **Dual Path Architecture**:
 * Worker Thread Path: Direct evaluation with full StateManager context
 * Main Thread Path: Proxy sends query to worker, worker evaluates, returns result
 *
 * Phase 6 of StateManager refactoring plan.
 *
 * @module stateManager/core/ruleEvaluator
 */

import { createUniversalLogger } from '../../../app/core/universalLogger.js';
import { PlayerIdUtils } from '../../shared/playerIdUtils.js';
import { evaluateRule, resolveHelperScope } from '../../shared/ruleEngine.js';

const moduleLogger = createUniversalLogger('ruleEvaluator');

function log(level, message, ...data) {
  moduleLogger[level](message, ...data);
}

/**
 * Execute a helper function using the thread-agnostic logic
 * @param {StateManager} manager - The StateManager instance
 * @param {string} name - The helper function name
 * @param {...any} args - Arguments to pass to the helper function
 * @returns {any} Result from the helper function, or `undefined` when no helper of that name exists
 */
export function executeHelper(manager, name, ...args) {
  // Recursion protection: prevent getSnapshot from calling isLocationAccessible during helper execution
  const wasInHelperExecution = manager._inHelperExecution;
  manager._inHelperExecution = true;

  try {
    const staticData = manager.getStaticGameData();
    const playerId = manager.playerId || '1';
    const playerIdStr = String(playerId);

    // Check rules.json helpers first (exported from Python world files)
    const helperDefinition = staticData?.helpers?.[playerIdStr]?.[name];

    if (helperDefinition && helperDefinition.body) {
      // Use shared utility to resolve parameter values from args, slot_data, or settings
      const helperScope = resolveHelperScope(helperDefinition, args, staticData, playerIdStr);

      // Create snapshot interface for rule evaluation
      const snapshotInterface = manager._createSelfSnapshotInterface();

      // Evaluate the helper body using the rule engine
      const result = evaluateRule(helperDefinition.body, snapshotInterface, 0, helperScope);

      // If definition evaluation succeeded (not undefined), use that result
      // Otherwise, fall through to try JavaScript helpers as a fallback
      // This handles cases where the exported Python helper relies on APIs not available in JS
      if (result !== undefined) {
        return result;
      }
      // Fall through to JavaScript helpers if definition returned undefined
    } else if (helperDefinition && helperDefinition.type) {
      // Handle rule-type helpers (e.g., {type: 'block', statements: [...]})
      // These helpers ARE rules themselves, not wrappers with {params, body}
      // Resolve any parameters in scope before evaluating
      const helperScope = resolveHelperScope(helperDefinition, args, staticData, playerIdStr);
      const snapshotInterface = manager._createSelfSnapshotInterface();
      const result = evaluateRule(helperDefinition, snapshotInterface, 0, helperScope);
      if (result !== undefined) {
        return result;
      }
      // Fall through to JavaScript helpers if evaluation returned undefined
    }

    // Fall back to JavaScript helper functions from game logic registry
    if (manager.helperFunctions && manager.helperFunctions[name]) {
      const snapshot = manager.getSnapshot();

      // Add evaluateRule method to snapshot for AHIT helpers
      snapshot.evaluateRule = function (rule) {
        // Create a minimal snapshot interface for rule evaluation
        const snapshotInterface = manager._createSelfSnapshotInterface();
        return manager.evaluateRuleFromEngine(rule, snapshotInterface);
      };

      // New helper signature: (snapshot, staticData, ...args)
      return manager.helperFunctions[name](snapshot, staticData, ...args);
    }
    // No helper of that name: undetermined (⚖ D3), never a silent false. An unknown Rule Builder
    // kind also lands here, coerced to a helper call by ruleBuilderEvaluator's default branch.
    const warned = manager._missingHelpersWarned || (manager._missingHelpersWarned = new Set());
    if (!warned.has(name)) {
      warned.add(name);
      log('warn', `No helper '${name}' (rules.json helpers or game logic): undetermined`);
    }
    return undefined;
  } finally {
    // Restore the previous state
    manager._inHelperExecution = wasInHelperExecution;
  }
}

/**
 * Helper method to execute a state method by name
 * @param {StateManager} manager - The StateManager instance
 * @param {string} method - The method name to execute
 * @param {...any} args - Arguments to pass to the method
 * @returns {any} Result from the state method
 */
export function executeStateMethod(manager, method, ...args) {
  // Recursion protection: prevent getSnapshot from calling computeReachableRegions during helper execution
  const wasInHelperExecution = manager._inHelperExecution;
  manager._inHelperExecution = true;

  try {
    // For consistency, we should check multiple places systematically

    // 1. Check if it's a direct method on stateManager
    if (typeof manager[method] === 'function') {
      return manager[method](...args);
    }

    // 2. Check special case for can_reach since it's commonly used
    if (method === 'can_reach' && args.length >= 1) {
      const targetName = args[0];
      let targetType = args[1];

      // If no type specified, auto-detect based on whether it's a location or region
      // This handles cases like Factorio's state.can_reach(loc) where loc is a Location object
      // that gets exported without a type argument
      if (!targetType) {
        const isLocation = manager.locations && manager.locations.has(targetName);
        targetType = isLocation ? 'Location' : 'Region';
      }

      // Normalize player ID, defaulting to current player if not specified
      const playerId = args[2] !== undefined ? PlayerIdUtils.normalize(args[2]) : manager.playerId;
      return manager.can_reach(targetName, targetType, playerId);
    }

    // 2b. Handle count method - returns count of a specific item
    if (method === 'count' && args.length >= 1) {
      const itemName = args[0];
      return manager.inventory[itemName] || 0;
    }

    // 2c. Handle count_group_unique - returns count of unique items from a group
    if (method === 'count_group_unique' && args.length >= 1) {
      const groupName = args[0];
      if (typeof groupName !== 'string') return 0;

      const staticData = manager.getStaticGameData();
      const playerItemGroups = staticData?.item_groups?.[manager.playerId] || staticData?.item_groups;

      let uniqueItemsFound = 0;

      if (Array.isArray(playerItemGroups)) {
        // ALTTP-style with group names as array
        const playerItemsData = staticData.itemsByPlayer && staticData.itemsByPlayer[manager.playerId];
        if (playerItemsData) {
          for (const itemName in playerItemsData) {
            if (playerItemsData[itemName]?.groups?.includes(groupName)) {
              const itemCount = manager.inventory[itemName] || 0;
              if (itemCount > 0) {
                uniqueItemsFound++;
              }
            }
          }
        }
      } else if (
        typeof playerItemGroups === 'object' &&
        playerItemGroups[groupName] &&
        Array.isArray(playerItemGroups[groupName])
      ) {
        // Item_groups is an object { groupName: [itemNames...] }
        for (const itemInGroup of playerItemGroups[groupName]) {
          const itemCount = manager.inventory[itemInGroup] || 0;
          if (itemCount > 0) {
            uniqueItemsFound++;
          }
        }
      } else if (staticData?.groups) {
        // Fallback to old groups structure if available
        const playerGroups = staticData.groups[manager.playerId] || staticData.groups;
        if (
          typeof playerGroups === 'object' &&
          playerGroups[groupName] &&
          Array.isArray(playerGroups[groupName])
        ) {
          for (const itemInGroup of playerGroups[groupName]) {
            const itemCount = manager.inventory[itemInGroup] || 0;
            if (itemCount > 0) {
              uniqueItemsFound++;
            }
          }
        }
      }

      return uniqueItemsFound;
    }

    // 2d. Handle has_from_list_unique - counts unique items from a list (ignores duplicates)
    // Used by Super Mario Land 2 for golden coin collection
    if (method === 'has_from_list_unique' && args.length >= 2) {
      const items = args[0];
      const count = args[1];
      if (!Array.isArray(items)) return false;
      if (typeof count !== 'number' || count < 0) return false;

      // Count unique items from the list (items with count > 0)
      let uniqueItemsFound = 0;
      for (const itemName of items) {
        const itemCount = manager.inventory[itemName] || 0;
        if (itemCount > 0) {
          uniqueItemsFound++;
        }
      }
      return uniqueItemsFound >= count;
    }

    // 2e. Handle count_from_list - returns the total count of items from a list (sums all quantities)
    // Used by SC2 for weapon/armor upgrade counting
    if (method === 'count_from_list' && args.length >= 1) {
      const items = args[0];
      if (!Array.isArray(items)) return 0;

      // Sum all item counts from the list
      let totalCount = 0;
      for (const itemName of items) {
        totalCount += (manager.inventory[itemName] || 0);
      }
      return totalCount;
    }

    // 3. Check for game-specific state methods (e.g., has_from_list_unique for Mario Land 2)
    if (manager.stateMethods && typeof manager.stateMethods[method] === 'function') {
      const snapshot = manager.getSnapshot();
      const staticData = manager.getStaticGameData();
      // Pass player ID as the last argument if not already provided
      // State methods like _tww_rematch_bosses_skipped need the player ID to look up settings
      const argsWithPlayer = args.length === 0 ? [manager.playerId] : args;
      return manager.stateMethods[method](snapshot, staticData, ...argsWithPlayer);
    }

    // 4. Look in modern helperFunctions system
    if (manager.helperFunctions) {
      // Try exact method name first
      if (typeof manager.helperFunctions[method] === 'function') {
        const snapshot = manager.getSnapshot();
        const staticData = manager.getStaticGameData();
        // Pass player ID as the last argument if not already provided
        // Helper functions called as state_methods need the player ID for multiworld support
        const argsWithPlayer = args.length === 0 ? [manager.playerId] : args;
        return manager.helperFunctions[method](snapshot, staticData, ...argsWithPlayer);
      }
    }

    // 4. Legacy helpers system (fallback)
    if (manager.helpers) {
      // Try exact method name first
      if (typeof manager.helpers[method] === 'function') {
        return manager.helpers[method](...args);
      }

      // If method starts with underscore and no match found, try without underscore
      if (
        method.startsWith('_') &&
        typeof manager.helpers[method.substring(1)] === 'function'
      ) {
        return manager.helpers[method.substring(1)](...args);
      }

      // If method doesn't start with underscore, try with underscore
      if (
        !method.startsWith('_') &&
        typeof manager.helpers['_' + method] === 'function'
      ) {
        return manager.helpers['_' + method](...args);
      }
    }

    // If no method found, log in debug mode
    if (manager.debugMode) {
      log('info', `Unknown state method: ${method}`, {
        args: args,
        stateManagerHas: typeof manager[method] === 'function',
        helpersHas: manager.helpers
          ? typeof manager.helpers[method] === 'function' ||
          (method.startsWith('_') &&
            typeof manager.helpers[method.substring(1)] === 'function') ||
          (!method.startsWith('_') &&
            typeof manager.helpers['_' + method] === 'function')
          : false,
        stateHas: false, // Legacy state system removed
      });
    }

    return undefined;
  } finally {
    // Restore the previous state
    manager._inHelperExecution = wasInHelperExecution;
  }
}
