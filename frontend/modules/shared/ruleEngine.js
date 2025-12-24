import { DEFAULT_PLAYER_ID } from './playerIdUtils.js';

/**
 * Rule Engine - Thread-Agnostic Rule Evaluation
 *
 * This module provides the core rule evaluation engine that works identically in both
 * the web worker thread (StateManager) and the main thread (UI components). It evaluates
 * Archipelago JSON rule objects against game state snapshots.
 *
 * **THREAD-AGNOSTIC DESIGN**:
 * This file is designed to run in BOTH thread contexts without modification:
 * - **Worker Thread**: Used by StateManager for live state computation
 * - **Main Thread**: Used by UI components for cached snapshot evaluation
 *
 * The key to thread-agnostic design:
 * - No direct StateManager dependencies - uses context injection
 * - Thread-aware logging (detects window object)
 * - Pure computation - no DOM or Worker APIs
 * - All state access through SnapshotInterface context object
 *
 * **DATA FLOW - WORKER THREAD PATH**:
 *
 * User Action (e.g., location click on main thread):
 *   Input: User clicks location in UI
 *   ↓
 * StateManagerProxy (main thread):
 *   Processing: Posts 'checkLocation' command to worker
 *   ↓
 * StateManagerWorker (worker thread):
 *   Processing: Receives message, calls StateManager.checkLocation()
 *   ↓
 * StateManager.checkLocation():
 *   Processing:
 *     ├─> Needs to verify location is accessible
 *     ├─> Creates SnapshotInterface via _createSelfSnapshotInterface()
 *     │     └─> Calls createStateSnapshotInterface(snapshot, staticData)
 *     ├─> Calls evaluateRule(location.access_rule, snapshotInterface)
 *     │
 *   Output: Worker evaluates rule, updates state, returns snapshot
 *   ↓
 * evaluateRule() [THIS FILE] (worker thread):
 *   Input:
 *     ├─> rule: { type: 'helper', name: 'has', args: ['Progressive Sword'] }
 *     ├─> context: SnapshotInterface with executeHelper(), hasItem(), etc.
 *     └─> depth: 0 (recursion counter)
 *
 *   Processing:
 *     ├─> Detects rule type 'helper'
 *     ├─> Evaluates args recursively (line 234)
 *     ├─> Calls context.executeHelper('has', 'Progressive Sword')
 *     │     └─> SnapshotInterface delegates to ruleEvaluator.executeHelper()
 *     │           └─> Gets snapshot + staticData from StateManager
 *     │                 └─> Calls helperFunctions.has(snapshot, staticData, 'Progressive Sword')
 *     │                       └─> Game-specific helper from alttpLogic.js
 *     │                             └─> Returns boolean result
 *     │
 *   Output: boolean (true/false) or undefined
 *   ↓
 * StateManager:
 *   Processing: Uses result to update reachability
 *   Output: Posts updated snapshot to main thread
 *   ↓
 * Main Thread UI:
 *   Processing: Receives snapshot, re-renders
 *
 * **DATA FLOW - MAIN THREAD PATH**:
 *
 * UI Render (LocationUI.updateLocationDisplay):
 *   Input: Need to render location accessibility
 *   ↓
 * LocationUI:
 *   Processing:
 *     ├─> Calls stateManager.getLatestStateSnapshot() (from proxy)
 *     │     └─> Returns CACHED snapshot (no worker call)
 *     ├─> Calls stateManager.getStaticData() (from proxy)
 *     │     └─> Returns CACHED static data (no worker call)
 *     ├─> Creates SnapshotInterface on main thread
 *     │     └─> const snapshotInterface = createStateSnapshotInterface(snapshot, staticData)
 *     │           └─> Same function used in worker!
 *     │
 *   Output: SnapshotInterface ready for evaluation
 *   ↓
 * evaluateRule() [THIS FILE] (main thread):
 *   Input:
 *     ├─> rule: { type: 'helper', name: 'has', args: ['Progressive Sword'] }
 *     ├─> context: SnapshotInterface (created on main thread from cached data)
 *     └─> depth: 0
 *
 *   Processing:
 *     ├─> Detects rule type 'helper'
 *     ├─> Evaluates args recursively
 *     ├─> Calls context.executeHelper('has', 'Progressive Sword')
 *     │     └─> SnapshotInterface delegates to getHelperFunctions()
 *     │           └─> Gets game logic from gameLogicRegistry
 *     │                 └─> Calls helperFunctions.has(snapshot, staticData, 'Progressive Sword')
 *     │                       └─> SAME game-specific helper as worker!
 *     │                             └─> Returns boolean result
 *     │
 *   Output: boolean (true/false) or undefined
 *   ↓
 * LocationUI:
 *   Processing:
 *     ├─> Uses result to set CSS class (reachable/unreachable)
 *     └─> Renders DOM element with appropriate styling
 *
 * **KEY DIFFERENCE BETWEEN PATHS**:
 *
 * Worker Thread:
 *   ├─> Live StateManager instance
 *   ├─> Fresh computation of reachability
 *   ├─> Updates global state
 *   └─> Posts snapshot to main thread
 *
 * Main Thread:
 *   ├─> Cached snapshot from proxy
 *   ├─> No recomputation (uses existing values)
 *   ├─> Read-only evaluation
 *   └─> Immediate DOM updates
 *
 * **SUPPORTED RULE TYPES**:
 * - helper: Calls game-specific helper functions
 * - state_method: Calls StateManager methods (can_reach, etc.)
 * - item_check: Checks if player has item
 * - count_check: Checks item quantity
 * - group_check: Checks item group count (returns boolean)
 * - group_count: Returns item group count (returns number)
 * - location_check: Checks if location is accessible
 * - locations_checked: Checks total locations checked
 * - total_items_count: Checks total items collected
 * - can_reach: Checks region reachability
 * - capability: Checks if player has a specific capability (calls can_* helper)
 * - and/or/not: Boolean logic operators
 * - compare: Comparison operators (>, <, ==, !=, in, etc.)
 * - attribute: Property access on objects
 * - function_call: Call functions with arguments
 * - subscript: Array/object indexing
 * - conditional: Ternary operator (if_true/if_false)
 * - binary_op: Arithmetic operators (+, -, *, /, //)
 * - value/constant: Literal values
 * - name: Variable name resolution
 *
 * **ARCHITECTURE NOTES**:
 * - Context injection via SnapshotInterface - no global state
 * - Recursive evaluation with depth limiting (max 100)
 * - Thread-aware logging (lines 12-23)
 * - Special handling for Python constructs (any/all, boss defeat, multiworld)
 * - Progressive item mapping support
 * - Dungeon and boss rule support
 *
 * @module shared/ruleEngine
 * @see stateInterface.js - Creates SnapshotInterface context objects
 * @see gameLogicRegistry.js - Selects game-specific helper functions
 * @see stateManager/core/ruleEvaluator.js - Worker thread helper execution
 */

// frontend/modules/shared/ruleEngine.js

/**
 * Resolves helper function parameters from arguments, slot_data, or settings.
 * This is the shared logic used by both stateInterface.js and ruleEvaluator.js
 * when evaluating helper definitions exported from Python to rules.json.
 *
 * Parameter resolution order:
 * 1. Use provided argument if available
 * 2. Try exact parameter name match in slot_data
 * 3. Try exact parameter name match in settings
 * 4. Try mapped name from helperDefinition.param_mappings (exported from Python)
 *
 * @param {Object} helperDefinition - The helper definition from rules.json
 * @param {Array} args - Arguments passed to the helper call
 * @param {Object} staticData - Static game data containing settings and slot_data
 * @param {string} playerIdStr - Player ID as string for lookup
 * @returns {Object} The resolved helper scope with parameter values
 */
export function resolveHelperScope(helperDefinition, args, staticData, playerIdStr) {
  const helperScope = {};

  if (!helperDefinition.params || !Array.isArray(helperDefinition.params)) {
    return helperScope;
  }

  const playerSettings = staticData?.settings?.[playerIdStr] || {};
  const playerSlotData = staticData?.game_info?.[playerIdStr]?.slot_data || {};
  const playerOptions = playerSettings.options || playerSettings;
  // Get param_mappings from the helper definition (exported from Python game handler)
  const paramMappings = helperDefinition.param_mappings || {};

  helperDefinition.params.forEach((paramName, index) => {
    if (index < args.length) {
      // Use provided argument
      helperScope[paramName] = args[index];
    } else {
      // Try to resolve from slot_data or settings
      if (playerSlotData[paramName] !== undefined) {
        helperScope[paramName] = playerSlotData[paramName];
      } else if (playerOptions[paramName] !== undefined) {
        helperScope[paramName] = playerOptions[paramName];
      } else {
        // Try mapped parameter name from helper definition
        const mappedName = paramMappings[paramName];
        if (mappedName) {
          if (playerSlotData[mappedName] !== undefined) {
            helperScope[paramName] = playerSlotData[mappedName];
          } else if (playerOptions[mappedName] !== undefined) {
            helperScope[paramName] = playerOptions[mappedName];
          }
        }
      }
    }
  });

  return helperScope;
}

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('ruleEngine', message, ...data);
  } else {
    // In worker context, only log ERROR and WARN levels to keep console clean
    if (level === 'error' || level === 'warn') {
      const consoleMethod =
        console[level === 'info' ? 'log' : level] || console.log;
      consoleMethod(`[ruleEngine] ${message}`, ...data);
    }
  }
}

class RuleTrace {
  constructor(rule, depth) {
    this.type = rule?.type || 'unknown';
    this.rule = rule;
    this.depth = depth;
    this.children = [];
    this.result = null;
    this.startTime = new Date().toISOString();
    this.endTime = null;
  }

  addChild(child) {
    this.children.push(child);
  }

  complete(result) {
    this.result = result;
    this.endTime = new Date().toISOString();
    return this;
  }

  toJSON() {
    return {
      type: this.type,
      rule: this.rule,
      depth: this.depth,
      result: this.result,
      startTime: this.startTime,
      endTime: this.endTime,
      children: this.children,
    };
  }
}

/**
 * Recursively checks if a rule object contains defeat methods in its chain
 * @param {Object} ruleObj - The rule object to check
 * @param {StateSnapshotInterface} stateSnapshotInterface - Provides state access methods
 * @returns {boolean} - True if a defeat method was found in the chain
 */
function hasDefeatMethod(ruleObj, stateSnapshotInterface) {
  if (!ruleObj || typeof ruleObj !== 'object') return false;

  // Check if this is an attribute access to can_defeat or defeat_rule
  if (
    ruleObj.type === 'attribute' &&
    (ruleObj.attr === 'can_defeat' || ruleObj.attr === 'defeat_rule')
  ) {
    return true;
  }

  // Recursively check object property for attribute chains
  if (ruleObj.object) {
    // Pass the interface down
    return hasDefeatMethod(ruleObj.object, stateSnapshotInterface);
  }

  // Check function property for function calls
  if (ruleObj.function) {
    // Pass the interface down
    return hasDefeatMethod(ruleObj.function, stateSnapshotInterface);
  }

  return false;
}

function safeLog(message, level = 'debug') {
  // Check if we're in a worker context (no window object)
  const isWorkerContext = typeof window === 'undefined';

  // Use the new logger service if available
  if (!isWorkerContext && window.logger) {
    window.logger[level]('ruleEngine', message);
  } else if (
    !isWorkerContext &&
    window.consoleManager &&
    typeof window.consoleManager[level] === 'function'
  ) {
    window.consoleManager[level](message);
  } else {
    console[level] ? console[level](message) : log('info', message);
  }
}

/**
 * Specifically checks if a rule is a boss defeat check using targeted pattern matching
 * @param {Object} rule - The rule object to check
 * @param {StateSnapshotInterface} stateSnapshotInterface - Provides state access methods
 * @returns {boolean} - True if this is a boss defeat check
 */
function isBossDefeatCheck(rule, stateSnapshotInterface) {
  // Direct check for simple cases
  if (
    rule.type === 'attribute' &&
    (rule.attr === 'can_defeat' || rule.attr === 'defeat_rule')
  ) {
    return true;
  }

  // Check for the specific nested structure we're seeing in Desert Palace - Prize
  if (
    rule.type === 'function_call' &&
    rule.function &&
    rule.function.type === 'attribute'
  ) {
    // Check if the attribute is 'can_defeat'
    if (
      rule.function.attr === 'can_defeat' ||
      rule.function.attr === 'defeat_rule'
    ) {
      return true;
    }

    // Check deeper in the chain if we have a boss or dungeon reference
    let current = rule.function.object;
    while (current) {
      if (current.type === 'attribute') {
        // If we see boss or dungeon in the chain, consider it a boss defeat check
        if (current.attr === 'boss' || current.attr === 'dungeon') {
          return true;
        }
        current = current.object;
      } else {
        break;
      }
    }
  }

  return false;
}

/**
 * Creates a new context with bound iterator variables for all_of/any_of comprehensions.
 * Supports both simple names and tuple unpacking (for dict.items() patterns).
 * @param {object} context - The original context
 * @param {object} iterator_info - Iterator information with target and iterator
 * @param {any} value - The value to bind to the iterator variable
 * @returns {object} - A new context with the variable binding
 */
function createBoundContext(context, iterator_info, value) {
  if (!iterator_info || !iterator_info.target) {
    // No variable to bind, return original context
    return context;
  }

  const boundVariables = {};
  const target = iterator_info.target;

  // Handle tuple unpacking (e.g., for key, value in dict.items())
  if (target.type === 'tuple' && target.elements && Array.isArray(target.elements)) {
    // Value should be an array [key, value] for dict items
    if (Array.isArray(value)) {
      target.elements.forEach((element, index) => {
        if (element.type === 'name' && element.name) {
          boundVariables[element.name] = value[index];
        }
      });
    }
  }
  // Handle list type (alternative format for tuple unpacking)
  else if (target.type === 'list' && Array.isArray(target.value) && Array.isArray(value)) {
    for (let i = 0; i < target.value.length && i < value.length; i++) {
      const targetElem = target.value[i];
      if (targetElem && targetElem.type === 'name' && targetElem.name) {
        boundVariables[targetElem.name] = value[i];
      }
    }
  }
  // Handle simple name binding
  else if (target.type === 'name' && target.name) {
    boundVariables[target.name] = value;
  }
  // Fallback for direct name property (legacy format)
  else if (target.name) {
    boundVariables[target.name] = value;
  }

  // If no variables were bound, return original context
  if (Object.keys(boundVariables).length === 0) {
    return context;
  }

  // Create a wrapper context that intercepts resolveName calls
  return {
    ...context,
    resolveName: function(name) {
      // Check if this is one of the bound variables
      if (name in boundVariables) {
        return boundVariables[name];
      }
      // Otherwise delegate to the original context
      if (context && typeof context.resolveName === 'function') {
        return context.resolveName(name);
      }
      return undefined;
    }
  };
}

/**
 * Evaluates a rule against the provided state context (either StateManager or main thread snapshot).\n * @param {any} rule - The rule object (or primitive) to evaluate.\n * @param {object} context - Either the StateManager instance (or its interface) in the worker,\n *                           or the snapshot interface on the main thread.\n * @param {number} [depth=0] - Current recursion depth for debugging.\n * @returns {boolean|any} - The result of the rule evaluation.\n */
export const evaluateRule = (rule, context, depth = 0, localScope = null) => {
  // Prevent infinite recursion by limiting depth
  if (depth > 100) {
    log('error', '[evaluateRule] Maximum recursion depth exceeded', {
      depth,
      rule: rule?.type,
      method: rule?.method
    });
    return false; // Return false for locations that would cause stack overflow
  }

  // Ensure rule is an object
  if (typeof rule !== 'object' || rule === null) {
    // Handle primitive types directly if they sneak in (e.g., simple string/number requirement)
    // Though ideally, rules should always be structured objects.
    return rule; // Return the primitive value itself
  }

  // Handle arrays directly - they're literal values, not rules
  // This happens when Compare rules have raw arrays for placement lookups like ["Item", 1]
  if (Array.isArray(rule)) {
    return rule;
  }

  // Check if context is provided and is a valid snapshot interface
  const isValidContext = context && context._isSnapshotInterface === true;
  if (!isValidContext) {
    log(
      'warn',
      '[evaluateRule] Missing or invalid context (snapshotInterface). Evaluation may fail or be inaccurate.',
      { rule: rule, contextProvided: !!context }
    );
    return undefined;
  }

  // Detect Rule Builder format: has 'rule' key but no 'type' key
  // Rule Builder format: {"rule": "Has", "options": [], "args": {"item_name": "Sword"}}
  // AST format: {"type": "item_check", "item": "Sword"}
  if (rule.rule && !rule.type) {
    let rbResult = evaluateRuleBuilderRule(rule, context, depth, localScope);

    // Handle SMBool objects from SM helpers at depth 0
    // Convert to boolean based on maxDiff check
    if (depth === 0 && rbResult && typeof rbResult === 'object' && 'bool' in rbResult && 'difficulty' in rbResult) {
      let maxDiff = 50; // Default to hardcore for Super Metroid
      if (typeof context?.getPlayerId === 'function' && typeof context?.resolveName === 'function') {
        const playerId = context.getPlayerId();
        const state = context.resolveName('state');
        if (state?.smbm?.[playerId]?.maxDiff !== undefined) {
          maxDiff = state.smbm[playerId].maxDiff;
        }
      }
      rbResult = rbResult.bool === true && rbResult.difficulty <= maxDiff;
    }

    return rbResult;
  }

  // Handle plain object literals (dicts) that are not rules
  // These are literal values passed as arguments to helpers (e.g., location data dicts)
  // They have neither 'type' (AST format) nor 'rule' (Rule Builder format) properties
  if (!rule.type && !rule.rule) {
    return rule;
  }

  let result;
  let ruleType = rule?.type;

  try {
    switch (ruleType) {
      case 'helper': {
        // First, check if there's a helper definition in the rules.json
        // This allows the exporter to provide helper logic that the frontend
        // can evaluate directly without needing game-specific JavaScript code
        if (typeof context?.getStaticData === 'function') {
          const staticData = context.getStaticData();
          const playerId = context.playerId || context.getPlayerId?.() || context.getPlayerSlot?.() || DEFAULT_PLAYER_ID;
          // Convert playerId to string for JSON key lookup (JSON keys are always strings)
          const playerIdKey = String(playerId);
          const helperDefinition = staticData?.helpers?.[playerIdKey]?.[rule.name];

          if (helperDefinition) {
            // Found a helper definition in rules.json - evaluate it recursively
            // Helper definitions may have params and body, or just be a rule directly
            const params = helperDefinition.params || [];
            const defaults = helperDefinition.defaults || {};
            const body = helperDefinition.body || helperDefinition;
            const args = rule.args || [];

            // Create localScope mapping parameter names to evaluated argument values
            let helperLocalScope = localScope ? { ...localScope } : {};

            // First, apply default values for all parameters that have defaults
            for (const paramName of params) {
              if (paramName in defaults) {
                helperLocalScope[paramName] = defaults[paramName];
              }
            }

            // Then, override with actual argument values
            for (let i = 0; i < params.length && i < args.length; i++) {
              helperLocalScope[params[i]] = evaluateRule(args[i], context, depth + 1, localScope);
            }

            result = evaluateRule(body, context, depth + 1, helperLocalScope);

            // Unwrap return marker if present (from block with return statement)
            if (result && typeof result === 'object' && result.__isReturn) {
              result = result.value;
            }
            // If definition evaluation succeeded (not undefined), use that result
            // Otherwise, fall through to try JavaScript helpers as a fallback
            if (result !== undefined) {
              break;
            }
            log('debug', `[evaluateRule] Helper definition for '${rule.name}' returned undefined, trying JavaScript fallback`);
          }
        } else {
          // No static data available for helper lookup
        }

        // Check for inline body in the rule itself (used by worldgen worlds)
        // The body field contains the helper's rule definition inline
        if (rule.body) {
          const params = rule.params || []; // Parameter names from helper definition
          const args = rule.args || [];
          let helperLocalScope = localScope ? { ...localScope } : {};

          // Map arguments to parameter names if available, otherwise use positional naming
          for (let i = 0; i < args.length; i++) {
            const argValue = evaluateRule(args[i], context, depth + 1, localScope);
            if (params[i]) {
              // Use the actual parameter name from the helper definition
              helperLocalScope[params[i]] = argValue;
            } else {
              // Fallback to positional naming
              helperLocalScope[`arg${i}`] = argValue;
            }
          }

          result = evaluateRule(rule.body, context, depth + 1, helperLocalScope);

          // Unwrap return marker if present
          if (result && typeof result === 'object' && result.__isReturn) {
            result = result.value;
          }
          if (result !== undefined) {
            break;
          }
          log('debug', `[evaluateRule] Inline body for '${rule.name}' returned undefined, trying fallbacks`);
        }

        // Handle Python built-in functions
        if (rule.name === 'any') {
          // Python's any() returns True if any element is truthy
          // args[0] should be a generator expression or list
          if (!rule.args || rule.args.length === 0) {
            result = false;
            break;
          }

          const firstArg = rule.args[0];
          if (firstArg && firstArg.type === 'generator_expression') {
            // Evaluate the generator expression element - it should return true if any condition passes
            // For now, treat it like an OR of all possible evaluations
            result = evaluateRule(firstArg, context, depth + 1);
          } else {
            // Evaluate all args and return true if any is truthy
            const evalArgs = rule.args.map(arg => evaluateRule(arg, context, depth + 1));
            result = evalArgs.some(val => val === true);
          }
          break;
        }

        if (rule.name === 'all') {
          // Python's all() returns True if all elements are truthy
          if (!rule.args || rule.args.length === 0) {
            result = true;
            break;
          }

          const firstArg = rule.args[0];
          if (firstArg && firstArg.type === 'generator_expression') {
            result = evaluateRule(firstArg, context, depth + 1);
          } else {
            const evalArgs = rule.args.map(arg => evaluateRule(arg, context, depth + 1));
            result = evalArgs.every(val => val === true);
          }
          break;
        }

        if (rule.name === 'min') {
          // Python's min() returns the minimum of the arguments
          if (!rule.args || rule.args.length === 0) {
            result = undefined;
            break;
          }
          const evalArgs = rule.args.map(arg => evaluateRule(arg, context, depth + 1, localScope));
          if (evalArgs.some(val => val === undefined)) {
            result = undefined;
          } else {
            result = Math.min(...evalArgs);
          }
          break;
        }

        if (rule.name === 'max') {
          // Python's max() returns the maximum of the arguments
          if (!rule.args || rule.args.length === 0) {
            result = undefined;
            break;
          }
          const evalArgs = rule.args.map(arg => evaluateRule(arg, context, depth + 1, localScope));
          if (evalArgs.some(val => val === undefined)) {
            result = undefined;
          } else {
            result = Math.max(...evalArgs);
          }
          break;
        }

        if (rule.name === 'set') {
          // Python's set() converts an iterable to a set (deduplicates)
          // For our purposes, just return the evaluated argument as an array with unique values
          if (!rule.args || rule.args.length === 0) {
            result = [];
            break;
          }
          const setArg = evaluateRule(rule.args[0], context, depth + 1, localScope);
          // If result is an array, deduplicate it (like Python set)
          if (Array.isArray(setArg)) {
            result = [...new Set(setArg)];
          } else {
            // If not an array, just return it as-is
            result = setArg;
          }
          break;
        }

        // Handle can_buy and can_buy_unlimited using shop_items data
        // TODO: This is ALttP-specific logic that should be moved to a game-specific module.
        // Find a more generic solution (e.g., game-specific helper registry or exported helper definitions).
        if (rule.name === 'can_buy' || rule.name === 'can_buy_unlimited') {
          const itemName = rule.args?.[0] ? evaluateRule(rule.args[0], context, depth + 1, localScope) : undefined;
          if (itemName === undefined) {
            result = undefined;
            break;
          }
          // Get shop_items from settings
          const shopItems = context.getSetting?.('shop_items');
          if (!shopItems || !shopItems[itemName]) {
            log('debug', `[evaluateRule] ${rule.name}: item '${itemName}' not found in shop_items`);
            result = false;
            break;
          }
          // Get the regions where this item can be bought
          const regionsKey = rule.name === 'can_buy_unlimited' ? 'unlimited' : 'limited';
          const regions = shopItems[itemName][regionsKey] || [];
          if (regions.length === 0) {
            result = false;
            break;
          }
          // Check if ANY of the regions are reachable
          if (typeof context.isRegionReachable !== 'function') {
            log('warn', `[evaluateRule] ${rule.name}: context.isRegionReachable not available`);
            result = undefined;
            break;
          }
          result = regions.some(regionName => context.isRegionReachable(regionName));
          break;
        }

        // Handle built-in Python functions
        if (rule.name === 'set') {
          // Python's set() function - convert iterable to set
          // In JS context, we just return the array as-is since has_all/has_any work with arrays
          const value = rule.args?.[0] ? evaluateRule(rule.args[0], context, depth + 1, localScope) : undefined;
          if (Array.isArray(value)) {
            result = value;
          } else if (value && typeof value === 'object') {
            // Handle object (like dict keys) - convert to array
            result = Object.keys(value);
          } else {
            result = value;
          }
          break;
        }

        if (rule.name === 'list') {
          // Python's list() function - convert iterable to list
          const value = rule.args?.[0] ? evaluateRule(rule.args[0], context, depth + 1, localScope) : undefined;
          if (Array.isArray(value)) {
            result = value;
          } else if (value && typeof value === 'object') {
            result = Object.values(value);
          } else if (typeof value === 'string') {
            result = value.split('');
          } else {
            result = value ? [value] : [];
          }
          break;
        }

        if (rule.name === 'int') {
          // Python's int() function - truncate a float to an integer
          const value = rule.args?.[0] ? evaluateRule(rule.args[0], context, depth + 1, localScope) : undefined;
          if (typeof value === 'number') {
            result = Math.trunc(value);
          } else {
            result = undefined;
          }
          break;
        }

        if (rule.name === 'sqrt') {
          // Python's math.sqrt() function - square root
          const value = rule.args?.[0] ? evaluateRule(rule.args[0], context, depth + 1, localScope) : undefined;
          if (typeof value === 'number' && value >= 0) {
            result = Math.sqrt(value);
          } else {
            result = undefined;
          }
          break;
        }

        if (rule.name === 'len') {
          // Python's len() function - get length of a sequence or collection
          const value = rule.args?.[0] ? evaluateRule(rule.args[0], context, depth + 1, localScope) : undefined;
          if (Array.isArray(value)) {
            result = value.length;
          } else if (typeof value === 'string') {
            result = value.length;
          } else if (value && typeof value === 'object') {
            // For objects (dict-like), return number of keys
            result = Object.keys(value).length;
          } else if (value === null || value === undefined) {
            result = undefined;
          } else {
            log('warn', '[evaluateRule] len() called on non-sequence type', { value, rule });
            result = undefined;
          }
          break;
        }

        if (rule.name === 'bool') {
          // Python's bool() function - convert value to boolean
          const value = rule.args?.[0] ? evaluateRule(rule.args[0], context, depth + 1, localScope) : undefined;
          if (value === undefined) {
            result = undefined;
          } else {
            // Python bool() rules: false for 0, None, empty collections, empty string
            // true for everything else
            result = Boolean(value);
          }
          break;
        }

        if (rule.name === 'iter') {
          // Python's iter() function - create an iterator from an iterable
          // We wrap the result in an iterator object that tracks position
          if (!rule.args || rule.args.length === 0) {
            result = { __isIterator: true, items: [], position: 0 };
            break;
          }

          const iterArg = rule.args[0];
          let items;
          if (iterArg && iterArg.type === 'generator_expression') {
            // Evaluate generator expression to get all values as an array
            items = evaluateRule(iterArg, context, depth + 1, localScope);
            // Generator expression should return an array
            if (!Array.isArray(items)) {
              items = items !== undefined ? [items] : [];
            }
          } else {
            // Evaluate the argument - should be an iterable (array)
            const value = evaluateRule(iterArg, context, depth + 1, localScope);
            if (Array.isArray(value)) {
              items = value;
            } else if (value && typeof value === 'object') {
              // Convert object keys to array (like Python's iter(dict) returns keys)
              items = Object.keys(value);
            } else if (typeof value === 'string') {
              items = value.split('');
            } else {
              items = [];
            }
          }
          // Return an iterator object that tracks position
          result = { __isIterator: true, items: items, position: 0 };
          break;
        }

        if (rule.name === 'next') {
          // Python's next() function - get next item from iterator
          // next(iterator) or next(iterator, default)
          // Iterator is an object with { __isIterator, items, position }
          if (!rule.args || rule.args.length === 0) {
            result = undefined;
            break;
          }

          const iteratorArg = evaluateRule(rule.args[0], context, depth + 1, localScope);
          const defaultValue = rule.args.length > 1
            ? evaluateRule(rule.args[1], context, depth + 1, localScope)
            : undefined;

          // Handle iterator object
          if (iteratorArg && iteratorArg.__isIterator) {
            if (iteratorArg.position < iteratorArg.items.length) {
              result = iteratorArg.items[iteratorArg.position];
              iteratorArg.position++; // Advance the iterator
            } else {
              result = defaultValue;
            }
          } else if (Array.isArray(iteratorArg)) {
            // Legacy: treat plain array as iterator (returns first, doesn't advance)
            if (iteratorArg.length > 0) {
              result = iteratorArg[0];
            } else {
              result = defaultValue;
            }
          } else {
            result = defaultValue;
          }
          break;
        }

        // Regular helper function handling
        const args = rule.args
          ? rule.args.map((arg) => evaluateRule(arg, context, depth + 1))
          : [];

        // SM helpers like wor, wand can handle undefined args by treating them as false
        // Don't fail early for these helpers - let them evaluate what they can
        // Also include SMZ3 helpers that receive Config arguments which may be undefined
        const helpersAllowingUndefinedArgs = new Set([
          'wor', 'wand', 'evalSMBool', 'SMBool',
          'smz3_CanAccessMiseryMirePortal'
        ]);
        const allowUndefinedArgs = helpersAllowingUndefinedArgs.has(rule.name);

        if (!allowUndefinedArgs && args.some((arg) => arg === undefined)) {
          result = undefined;
        } else if (isValidContext) {
          if (typeof context.executeHelper === 'function') {
            result = context.executeHelper(rule.name, ...args);

            // Handle SMBool objects from SM helpers
            // For SM helpers that return SMBool objects {bool, difficulty}:
            // - At depth 0 (top-level): check difficulty against maxDiff and convert to boolean
            // - At depth > 0: preserve the SMBool object so parent helpers (wand, wor) can
            //   work with difficulty values correctly
            if (result && typeof result === 'object' && 'bool' in result && 'difficulty' in result) {
              if (depth === 0) {
                // Top-level: check difficulty against maxDiff
                let maxDiff = 50; // Default to hardcore for Super Metroid
                if (typeof context.getPlayerId === 'function' && typeof context.resolveName === 'function') {
                  const playerId = context.getPlayerId();
                  const state = context.resolveName('state');
                  if (state?.smbm?.[playerId]?.maxDiff !== undefined) {
                    maxDiff = state.smbm[playerId].maxDiff;
                  }
                }
                result = result.bool === true && result.difficulty <= maxDiff;
              }
              // At depth > 0: leave result as SMBool object so parent helpers can use difficulty
            }
          } else {
            log(
              'warn',
              `[evaluateRule SnapshotIF] context.executeHelper is not a function for helper \'${rule.name}\'. Assuming undefined.`
            );
            result = undefined;
          }
        }
        break;
      }

      case 'generic_helper': {
        // Handle generic helper functions that couldn't be converted to specific rule types
        // Try to call the game-specific helper function, fall back to true if not available
        const args = rule.args
          ? rule.args.map((arg) => evaluateRule(arg, context, depth + 1))
          : [];
        if (args.some((arg) => arg === undefined)) {
          result = undefined;
        } else if (isValidContext) {
          if (typeof context.executeHelper === 'function') {
            result = context.executeHelper(rule.name, ...args);

            // Same SMBool handling as regular helpers - preserve at depth > 0
            if (result && typeof result === 'object' && 'bool' in result && 'difficulty' in result) {
              if (depth === 0) {
                let maxDiff = 50;
                if (typeof context.getPlayerId === 'function' && typeof context.resolveName === 'function') {
                  const playerId = context.getPlayerId();
                  const state = context.resolveName('state');
                  if (state?.smbm?.[playerId]?.maxDiff !== undefined) {
                    maxDiff = state.smbm[playerId].maxDiff;
                  }
                }
                result = result.bool === true && result.difficulty <= maxDiff;
              }
              // At depth > 0: leave result as SMBool object
            }
          } else {
            log(
              'warn',
              `[evaluateRule] context.executeHelper is not a function for generic helper '${rule.name}'. Falling back to true.`
            );
            result = true;
          }
        } else {
          log(
            'warn',
            `[evaluateRule] Generic helper '${rule.name}' called without valid context - falling back to true`,
            { rule }
          );
          result = true;
        }
        break;
      }

      case 'state_method': {
        const args = rule.args
          ? rule.args.map((arg) => evaluateRule(arg, context, depth + 1, localScope))
          : [];

        if (args.some((arg) => arg === undefined)) {
          result = undefined;
        } else if (isValidContext) {
          // Special handling for count method - use countItem to get the number
          if (rule.method === 'count' && args.length >= 1 && typeof context.countItem === 'function') {
            result = context.countItem(args[0]) || 0;
          } else if (typeof context.executeStateManagerMethod === 'function') {
            result = context.executeStateManagerMethod(rule.method, ...args);
          } else {
            log(
              'warn',
              `[evaluateRule SnapshotIF] context.executeStateManagerMethod not a function for \'${rule.method}\'. Assuming undefined.`
            );
            result = undefined;
          }
        } else {
          result = undefined;
        }
        break;
      }
      case 'and': {
        result = true; // Assume true initially
        let hasUndefined = false;
        let hasSMBool = false;
        let totalDifficulty = 0;
        for (const condition of rule.conditions || []) {
          let conditionResult = evaluateRule(condition, context, depth + 1, localScope);

          // Unwrap __isReturn markers from block rules
          // This is needed because blocks with return statements produce markers
          // that need to be unwrapped before checking truthiness
          if (conditionResult && typeof conditionResult === 'object' && conditionResult.__isReturn) {
            conditionResult = conditionResult.value;
          }

          // Handle SMBool objects from Super Metroid
          // Track difficulty to properly check against maxDiff at depth 0
          let boolValue = conditionResult;
          if (conditionResult && typeof conditionResult === 'object' && 'bool' in conditionResult) {
            // SMBool object - extract the boolean value and accumulate difficulty
            boolValue = conditionResult.bool === true;
            hasSMBool = true;
            totalDifficulty += conditionResult.difficulty || 0;
          }

          // Check for falsiness (but not undefined, which is handled separately)
          if (!boolValue && boolValue !== undefined) {
            result = false;
            hasUndefined = false; // Definitively false
            break;
          }
          if (boolValue === undefined) {
            hasUndefined = true; // Potential undefined result
          }
        }
        // Only set to undefined if not definitively false and encountered an undefined condition
        if (result === true && hasUndefined) {
          result = undefined;
        }
        // If any condition was an SMBool, return an SMBool with accumulated difficulty
        // This allows proper difficulty checking at depth 0
        if (result === true && hasSMBool) {
          result = { bool: true, difficulty: totalDifficulty };
        }
        break;
      }

      case 'or': {
        result = false; // Assume false initially
        let hasUndefined = false;
        let hasSMBool = false;
        let minDifficulty = Infinity;
        for (const condition of rule.conditions || []) {
          let conditionResult = evaluateRule(condition, context, depth + 1, localScope);

          // Unwrap __isReturn markers from block rules
          // This is needed because blocks with return statements produce markers
          // that need to be unwrapped before checking truthiness
          if (conditionResult && typeof conditionResult === 'object' && conditionResult.__isReturn) {
            conditionResult = conditionResult.value;
          }

          // Handle SMBool objects from Super Metroid
          // Track minimum difficulty among passing conditions for proper maxDiff check
          let boolValue = conditionResult;
          let difficulty = 0;
          if (conditionResult && typeof conditionResult === 'object' && 'bool' in conditionResult) {
            // SMBool object - extract the boolean value and difficulty
            boolValue = conditionResult.bool === true;
            difficulty = conditionResult.difficulty || 0;
            hasSMBool = true;
          }

          // Check for truthiness (but not undefined, which is handled separately)
          if (boolValue && boolValue !== undefined) {
            result = true;
            // For OR, we want the minimum difficulty among passing conditions
            if (difficulty < minDifficulty) {
              minDifficulty = difficulty;
            }
            // Don't break early - continue to find the lowest difficulty option
            hasUndefined = false; // Definitively true (at least one path)
          }
          if (conditionResult === undefined) {
            hasUndefined = true; // Potential undefined result
          }
        }
        // Only set to undefined if not definitively true and encountered an undefined condition
        if (result === false && hasUndefined) {
          result = undefined;
        }
        // If any condition was an SMBool and result is true, return SMBool with min difficulty
        if (result === true && hasSMBool) {
          result = { bool: true, difficulty: minDifficulty === Infinity ? 0 : minDifficulty };
        }
        break;
      }

      case 'conditional': {
        // Conditional expression (ternary) - evaluates test and returns if_true or if_false branch
        // Pattern: test ? if_true : if_false
        const testResult = evaluateRule(rule.test, context, depth + 1, localScope);

        // If test result is undefined, we can't determine which branch to take
        if (testResult === undefined) {
          result = undefined;
        } else if (testResult) {
          // Test is truthy - evaluate if_true branch
          result = evaluateRule(rule.if_true, context, depth + 1, localScope);
        } else {
          // Test is falsy - evaluate if_false branch
          result = evaluateRule(rule.if_false, context, depth + 1, localScope);
        }
        break;
      }

      case 'count_true': {
        // Count how many conditions evaluate to true
        // Returns true if at least rule.count conditions are true
        const requiredCount = rule.count || 0;
        const conditions = rule.conditions || [];

        if (requiredCount === 0) {
          // No conditions required, always true
          result = true;
          break;
        }

        if (conditions.length === 0) {
          // No conditions to evaluate
          result = requiredCount === 0;
          break;
        }

        let trueCount = 0;
        let undefinedCount = 0;

        for (const condition of conditions) {
          const conditionResult = evaluateRule(condition, context, depth + 1, localScope);
          if (conditionResult === true) {
            trueCount++;
          } else if (conditionResult === undefined) {
            undefinedCount++;
          }
          // Short-circuit if we already have enough true conditions
          if (trueCount >= requiredCount) {
            result = true;
            break;
          }
        }

        // If we didn't short-circuit with true, determine the result
        if (result !== true) {
          if (trueCount >= requiredCount) {
            // We have enough true conditions
            result = true;
          } else if (trueCount + undefinedCount >= requiredCount) {
            // We might have enough if some undefineds are true
            result = undefined;
          } else {
            // Impossible to reach required count even if all undefineds were true
            result = false;
          }
        }
        break;
      }

      case 'not': {
        // Handle both 'operand' and 'condition' field names for compatibility
        const conditionToNegate = rule.operand || rule.condition;
        if (!conditionToNegate) {
          log(
            'warn',
            '[evaluateRule Not] Missing operand/condition in not rule:',
            rule
          );
          result = undefined;
        } else {
          const operandResult = evaluateRule(
            conditionToNegate,
            context,
            depth + 1,
            localScope
          );
          // Negation of undefined is undefined
          result = operandResult === undefined ? undefined : !operandResult;
        }
        break;
      }

      case 'value': // Handles literal values encoded as nodes
      case 'constant': {
        // Keep constant for backward compatibility
        result = rule.value;
        break;
      }

      case 'world_reference': {
        // SMZ3 exports self.world as world_reference - return null as a safe placeholder
        // These are typically passed to helpers that don't actually use them in JavaScript
        result = null;
        break;
      }

      case 'tuple': {
        // Handle tuple types (used for door arguments in Lingo and similar games)
        // Evaluate each element and return as an array
        if (!rule.elements || !Array.isArray(rule.elements)) {
          result = [];
          break;
        }
        const elements = rule.elements.map((elem) => evaluateRule(elem, context, depth + 1));
        // If any element is undefined, the tuple is undefined
        if (elements.some((elem) => elem === undefined)) {
          result = undefined;
        } else {
          result = elements;
        }
        break;
      }

      case 'attribute': {
        // Check if object is already a plain value (not a rule to evaluate)
        // This happens when evaluateRuleBuilderRule passes an already-evaluated object
        // Plain objects have no 'type' (AST format) or 'rule' (Rule Builder format) key
        let baseObject;
        if (rule.object && typeof rule.object === 'object' &&
            !rule.object.type && !rule.object.rule && !Array.isArray(rule.object)) {
          // Object is already evaluated, use directly
          baseObject = rule.object;
        } else {
          baseObject = evaluateRule(rule.object, context, depth + 1, localScope);
        }

        // Special case: if baseObject is undefined and the object was "self",
        // try to resolve from game settings (self in Python rules = world/rules class instance with options)
        if (baseObject === undefined && rule.object && rule.object.type === 'name' && rule.object.name === 'self') {
          // Try to get the setting value from context
          if (context.getStaticData || context.staticData) {
            const staticData = context.getStaticData ? context.getStaticData() : context.staticData;
            const playerId = context.playerId || context.getPlayerId?.() || context.getPlayerSlot?.() || DEFAULT_PLAYER_ID;

            // Special case: if accessing self.options, return the settings object so nested attributes work
            if (rule.attr === 'options' && staticData?.settings && staticData.settings[playerId]) {
              return staticData.settings[playerId];
            }

            // Check if the setting exists
            if (staticData?.settings && staticData.settings[playerId]) {
              const settingValue = staticData.settings[playerId][rule.attr];
              if (settingValue !== undefined) {
                return settingValue;
              }
            }
          }

          return undefined;
        }

        // Special case: if baseObject is undefined and the object was "options",
        // try to resolve from game settings
        if (baseObject === undefined && rule.object && rule.object.type === 'name' && rule.object.name === 'options') {
          // Try to get the setting value from context
          if (context.getStaticData) {
            const staticData = context.getStaticData();
            const playerId = context.playerId || context.getPlayerId?.() || context.getPlayerSlot?.() || DEFAULT_PLAYER_ID;

            // Check if the setting exists
            if (staticData.settings && staticData.settings[playerId]) {
              const settingValue = staticData.settings[playerId][rule.attr];
              if (settingValue !== undefined) {
                return settingValue;
              }
            }
          }

          // Default values for common KH1 options
          if (rule.attr === 'keyblades_unlock_chests') {
            return false; // Default value
          }
          if (rule.attr === 'advanced_logic') {
            return false; // Default value
          }

          return undefined;
        }

        // Special case: if baseObject is undefined and the object was "settings",
        // return the setting value from the player's settings object
        // This allows exported helpers to reference settings.door_reqs, settings.item_by_door, etc.
        if (baseObject === undefined && rule.object && rule.object.type === 'name' && rule.object.name === 'settings') {
          if (context.getStaticData) {
            const staticData = context.getStaticData();
            const playerId = context.playerId || context.getPlayerId?.() || context.getPlayerSlot?.() || DEFAULT_PLAYER_ID;

            if (staticData?.settings && staticData.settings[playerId]) {
              const settingValue = staticData.settings[playerId][rule.attr];
              if (settingValue !== undefined) {
                return settingValue;
              }
            }
          }
          return undefined;
        }

        if (baseObject && typeof baseObject === 'object') {
          // Special handling for region reference objects
          // When we access .can_reach on a region reference, return a special marker
          // that the function_call handler will recognize
          if (baseObject.__regionRef && rule.attr === 'can_reach') {
            // Return a marker that indicates this is a region reachability check
            return { __regionCanReach: true, regionName: baseObject.regionName };
          }

          // Special handling for parent_region attribute on location objects
          if (rule.attr === 'parent_region' && baseObject.parent_region_name) {
            // Dynamically resolve the parent region from the context
            if (context.getStaticData && context.getStaticData().regions) {
              const regions = context.getStaticData().regions;

              // Regions is always a Map
              const region = regions.get(baseObject.parent_region_name);
              if (region) {
                return region;
              }
            }
            return undefined;
          }

          // Special handling for boss attribute - redirect to bosses["None"] if bosses exists
          if (rule.attr === 'boss') {
            const hasBoss = baseObject.boss !== undefined;
            const hasBosses = baseObject.bosses !== undefined;

            if (!hasBoss && hasBosses) {
              // Use the new bosses format - default to "None" entry
              const boss = baseObject.bosses["None"] || Object.values(baseObject.bosses)[0];
              return boss;
            }
          }

          // Special handling for dungeon attribute - resolve string to actual dungeon object
          if (rule.attr === 'dungeon') {
            const hasDungeon = baseObject.dungeon !== undefined;

            if (hasDungeon) {
              const dungeonValue = baseObject.dungeon;

              if (typeof dungeonValue === 'string') {
                // Look up the actual dungeon object from staticData
                const dungeonName = dungeonValue;
                const dungeons = context.dungeons || context.getAllDungeons?.() || context.getStaticData?.().dungeons;

                if (dungeons) {
                  // Dungeons is always a Map
                  const dungeon = dungeons.get(dungeonName);
                  if (dungeon) {
                    return dungeon;
                  }
                }
                // If we couldn't resolve, return the string (fallback)
                return dungeonName;
              }
              // Already an object, return as-is
              return dungeonValue;
            }
          }

          // First try direct property access
          let attrValue = baseObject[rule.attr];

          // If not found and baseObject is an array, try Python-to-JavaScript method mapping
          // Python list methods have different names in JavaScript
          if (attrValue === undefined && Array.isArray(baseObject)) {
            const pythonToJsArrayMethods = {
              'index': 'indexOf',      // list.index(x) -> array.indexOf(x)
              'append': 'push',         // list.append(x) -> array.push(x)
              'remove': 'splice',       // list.remove(x) needs custom handling, but map for now
              'count': null,            // Needs custom implementation
              '__contains__': 'includes', // 'x in list' -> array.includes(x)
            };
            const jsMethodName = pythonToJsArrayMethods[rule.attr];
            if (jsMethodName) {
              attrValue = baseObject[jsMethodName];
            }
          }

          // If not found, try resolveAttribute for mapping/transformation
          if (
            attrValue === undefined &&
            typeof context.resolveAttribute === 'function'
          ) {
            attrValue = context.resolveAttribute(baseObject, rule.attr);
          }

          // If the attribute value is itself a rule object that needs evaluation
          // Rule objects should have string type properties, not numeric ones (which are used by data objects)
          if (
            attrValue &&
            typeof attrValue === 'object' &&
            attrValue.type &&
            typeof attrValue.type === 'string'
          ) {
            return evaluateRule(attrValue, context, depth + 1);
          }

          if (typeof attrValue === 'function') {
            return attrValue.bind(baseObject);
          }

          return attrValue;
        } else {
          // Special case: Python Option objects use .value to get the actual value
          // In JSON rules, settings are already resolved to their raw values, so accessing .value
          // on a primitive (number, string, boolean) should just return the primitive itself
          // This handles patterns like: setting_value("some_option").value -> already resolved to 15
          if (rule.attr === 'value' && baseObject !== undefined && baseObject !== null) {
            return baseObject;
          }

          // Special case: Allow resolveAttribute to handle string baseObjects
          // This is needed for cases like region.dungeon.boss where:
          // - region.dungeon returns a string dungeon name "Tower of Hera"
          // - We then need to resolve .boss on that string by looking up the dungeon object
          if (typeof baseObject === 'string' && typeof context.resolveAttribute === 'function') {
            const resolvedValue = context.resolveAttribute(baseObject, rule.attr);
            if (resolvedValue !== undefined) {
              return resolvedValue;
            }
          }

          return undefined;
        }
      }

      case 'function_call': {
        // Special handling for state method calls like state.CanAcquireAtLeast()
        // In the exported rules, these appear as: {type: 'function_call', function: {type: 'attribute', object: {type: 'constant', value: true}, attr: 'MethodName'}}
        // The constant 'true' is a placeholder for the state/world object
        if (rule.function?.type === 'attribute' &&
            rule.function.object?.type === 'constant' &&
            rule.function.object.value === true) {

          const methodName = rule.function.attr;
          const args = (rule.args || []).map(
            (arg) => evaluateRule(arg, context, depth + 1, localScope)
          );

          // If any argument evaluation results in undefined, return undefined
          if (args.some((arg) => arg === undefined)) {
            result = undefined;
            break;
          }

          // For SMZ3, prepend 'smz3_' to the method name to get the helper function name
          // This handles methods like CanAcquireAtLeast, CanAcquireAll, etc.
          const helperName = `smz3_${methodName}`;

          // Call the helper function through context.executeHelper
          if (context.executeHelper) {
            try {
              result = context.executeHelper(helperName, ...args);
              break;
            } catch (error) {
              logError(
                LOG_LEVEL.ERROR,
                `[ruleEngine] [evaluateRule] Failed to execute state method helper '${helperName}':`,
                error
              );
              result = undefined;
              break;
            }
          } else {
            logError(
              LOG_LEVEL.ERROR,
              `[ruleEngine] [evaluateRule] No executeHelper method in context for state method '${helperName}'`
            );
            result = undefined;
            break;
          }
        }

        // Special handling for math module functions (math.sqrt, math.pow, etc.)
        // Python's math module functions need to be mapped to JavaScript Math equivalents
        if (
          rule.function?.type === 'attribute' &&
          rule.function.object?.type === 'name' &&
          rule.function.object.name === 'math'
        ) {
          const mathFunc = rule.function.attr;
          const args = (rule.args || []).map(arg => evaluateRule(arg, context, depth + 1, localScope));

          switch (mathFunc) {
            case 'sqrt':
              if (typeof args[0] === 'number' && args[0] >= 0) {
                result = Math.sqrt(args[0]);
              } else {
                result = undefined;
              }
              break;
            case 'pow':
              if (typeof args[0] === 'number' && typeof args[1] === 'number') {
                result = Math.pow(args[0], args[1]);
              } else {
                result = undefined;
              }
              break;
            case 'floor':
              if (typeof args[0] === 'number') {
                result = Math.floor(args[0]);
              } else {
                result = undefined;
              }
              break;
            case 'ceil':
              if (typeof args[0] === 'number') {
                result = Math.ceil(args[0]);
              } else {
                result = undefined;
              }
              break;
            case 'abs':
              if (typeof args[0] === 'number') {
                result = Math.abs(args[0]);
              } else {
                result = undefined;
              }
              break;
            default:
              log('warn', `[evaluateRule] Unknown math function: math.${mathFunc}`);
              result = undefined;
          }
          break;
        }

        // Special handling for state.multiworld.get_location() calls
        // These are used in location access rules to reference the location's parent_region
        if (rule.function?.type === 'attribute' &&
            rule.function.attr === 'get_location' &&
            rule.function.object?.type === 'attribute' &&
            rule.function.object.attr === 'multiworld') {
          
          const args = rule.args ? rule.args.map(arg => evaluateRule(arg, context, depth + 1, localScope)) : [];
          const locationName = args[0];
          
          // If we're evaluating a rule for the same location, return the current location
          // This avoids circular references when a location's access rule references itself
          if (context.currentLocation && context.currentLocation.name === locationName) {
            // Return an object that has the parent_region property properly set
            return {
              name: context.currentLocation.name,
              parent_region: context.currentLocation.parent_region || 
                           (context.currentLocation.region ? 
                             context.getStaticData?.().regions?.[context.currentLocation.region] : 
                             undefined),
              parent_region_name: context.currentLocation.region
            };
          }
          
          // Otherwise, try to get the location from static data
          if (context.getStaticData) {
            const staticData = context.getStaticData();
            // Search all regions for this location
            // Regions is always a Map
            for (const [regionName, regionData] of staticData.regions.entries()) {
              if (regionData.locations) {
                const location = regionData.locations.find(loc => loc.name === locationName);
                if (location) {
                  return {
                    name: location.name,
                    parent_region: regionData,
                    parent_region_name: regionName
                  };
                }
              }
            }
          }

          return undefined;
        }
        
        // Special handling for state.multiworld.get_entrance() calls
        // These are used in exit access rules to reference the exit's parent_region
        if (rule.function?.type === 'attribute' && 
            rule.function.attr === 'get_entrance' &&
            rule.function.object?.type === 'attribute' &&
            rule.function.object.attr === 'multiworld') {
          
          const args = rule.args ? rule.args.map(arg => evaluateRule(arg, context, depth + 1, localScope)) : [];
          const exitName = args[0];
          
          // When evaluating an exit rule, the context has parent_region set
          // If this is a self-reference to the current exit, return the appropriate object
          if (context.currentExit && context.currentExit === exitName) {
            // For the current exit being evaluated, return an object with parent_region
            return {
              name: exitName,
              parent_region: context.parent_region
            };
          }
          
          // Otherwise, try to find the exit in static data
          if (context.getStaticData) {
            const staticData = context.getStaticData();
            // Search all regions for this exit
            // Regions is always a Map
            for (const [regionName, regionData] of staticData.regions.entries()) {
              if (regionData.exits) {
                const exit = regionData.exits.find(ex => ex.name === exitName);
                if (exit) {
                  return {
                    name: exit.name,
                    parent_region: regionData,
                    parent_region_name: regionName
                  };
                }
              }
            }
          }

          return undefined;
        }
        
        // Special handling for boss.can_defeat function calls
        // These need to be redirected to use the boss's defeat_rule data
        if (
          rule.function?.type === 'attribute' &&
          rule.function.attr === 'can_defeat'
        ) {
          // Check if this is a boss.can_defeat call by walking up the chain
          let current = rule.function.object;
          let isDungeomBossDefeat = false;

          // Look for patterns:
          // 1. location.parent_region.dungeon.boss.can_defeat
          // 2. location.parent_region.dungeon.bosses["index"].can_defeat (subscript pattern)

          // First check if immediate parent is a subscript accessing bosses
          if (current && current.type === 'subscript') {
            // Check if the subscript is accessing a bosses attribute
            let subscriptValue = current.value;
            while (subscriptValue && subscriptValue.type === 'attribute') {
              if (subscriptValue.attr === 'bosses' || subscriptValue.attr === 'boss') {
                isDungeomBossDefeat = true;
                break;
              }
              subscriptValue = subscriptValue.object;
            }
          }

          // Also check the standard attribute chain
          while (current && current.type === 'attribute') {
            if (current.attr === 'boss' || current.attr === 'bosses') {
              isDungeomBossDefeat = true;
              break;
            }
            current = current.object;
          }

          if (isDungeomBossDefeat) {
            // Evaluate the boss object (everything before .can_defeat)
            const bossObject = evaluateRule(
              rule.function.object,
              context,
              depth + 1,
              localScope
            );

            if (bossObject && bossObject.defeat_rule) {
              result = evaluateRule(bossObject.defeat_rule, context, depth + 1, localScope);
              break;
            } else {
              result = undefined;
              break;
            }
          }
        }

        // Special handling for variable.can_reach() calls where variable is a region reference
        // This handles patterns like: cave.can_reach(state) where cave was assigned from get_region
        if (
          rule.function?.type === 'attribute' &&
          rule.function.attr === 'can_reach' &&
          rule.function.object?.type === 'name'
        ) {
          const varName = rule.function.object.name;
          // Try to resolve the variable from local scope or context
          let regionRef = localScope?.[varName];

          if (regionRef && regionRef.__regionRef) {
            // This is a region reference - check if the region is reachable
            const regionName = regionRef.regionName;
            if (typeof context.isRegionReachable === 'function') {
              result = context.isRegionReachable(regionName);
              break;
            } else {
              log('warn', `[evaluateRule] Cannot check region reachability for '${regionName}' - context.isRegionReachable not available`);
              result = undefined;
              break;
            }
          }
          // If not a region reference, fall through to other handlers
        }

        // Special handling for self.method_name() calls (e.g., self.explore_score())
        // These should be treated as helper function calls
        if (
          rule.function?.type === 'attribute' &&
          rule.function.object?.type === 'name' &&
          rule.function.object.name === 'self'
        ) {
          const helperName = rule.function.attr;
          const args = (rule.args || []).map(
            (arg) => evaluateRule(arg, context, depth + 1, localScope)
          );

          // If any argument evaluation results in undefined, return undefined
          if (args.some((arg) => arg === undefined)) {
            result = undefined;
            break;
          }

          // Call the helper function through context.executeHelper
          if (context.executeHelper) {
            try {
              result = context.executeHelper(helperName, ...args);
              break;
            } catch (error) {
              logError(
                LOG_LEVEL.ERROR,
                `[ruleEngine] [evaluateRule] Failed to execute helper '${helperName}':`,
                error
              );
              result = undefined;
              break;
            }
          } else {
            logError(
              LOG_LEVEL.ERROR,
              `[ruleEngine] [evaluateRule] No executeHelper method in context for helper '${helperName}'`
            );
            result = undefined;
            break;
          }
        }

        // Special handling for dict.get(key, default) pattern
        // Python dicts have a .get() method, but JavaScript plain objects don't
        // This converts obj.get(key, default) to obj[key] ?? default
        if (
          rule.function?.type === 'attribute' &&
          rule.function.attr === 'get' &&
          rule.function.object
        ) {
          const obj = evaluateRule(rule.function.object, context, depth + 1, localScope);
          if (obj && typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Map)) {
            // This is a plain object - handle .get() as property access with default
            const args = (rule.args || []).map(arg => evaluateRule(arg, context, depth + 1, localScope));
            const key = args[0];
            const defaultValue = args.length > 1 ? args[1] : undefined;

            if (key !== undefined && Object.prototype.hasOwnProperty.call(obj, key)) {
              result = obj[key];
            } else {
              result = defaultValue;
            }
            break;
          }
        }

        // Special handling for dict.items(), dict.keys(), dict.values() patterns
        // Python dicts have these methods, JavaScript objects don't
        if (
          rule.function?.type === 'attribute' &&
          ['items', 'keys', 'values'].includes(rule.function.attr) &&
          rule.function.object
        ) {
          const obj = evaluateRule(rule.function.object, context, depth + 1, localScope);
          if (obj && typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Map)) {
            // This is a plain object - handle Python dict methods
            switch (rule.function.attr) {
              case 'items':
                // dict.items() returns list of [key, value] tuples
                result = Object.entries(obj);
                break;
              case 'keys':
                // dict.keys() returns list of keys
                result = Object.keys(obj);
                break;
              case 'values':
                // dict.values() returns list of values
                result = Object.values(obj);
                break;
            }
            break;
          }
        }

        // Special handling for Python array/list methods like .count()
        // These are exported as function_call with attribute, e.g., arr.count(value)
        if (
          rule.function?.type === 'attribute' &&
          rule.function.attr === 'count' &&
          rule.function.object
        ) {
          const obj = evaluateRule(rule.function.object, context, depth + 1, localScope);
          if (Array.isArray(obj)) {
            const args = (rule.args || []).map(arg => evaluateRule(arg, context, depth + 1, localScope));
            const searchValue = args[0];
            // Python list.count(value) returns the number of occurrences
            result = obj.filter(x => x === searchValue).length;
            break;
          }
        }

        // Special handling for Python string methods (capitalize, upper, lower, strip, etc.)
        // These are exported as function_call with attribute, e.g., color.capitalize()
        if (
          rule.function?.type === 'attribute' &&
          rule.function.object
        ) {
          const strMethodName = rule.function.attr;
          const pythonStringMethods = ['capitalize', 'upper', 'lower', 'strip', 'lstrip', 'rstrip',
                                       'startswith', 'endswith', 'replace', 'split', 'join'];

          if (pythonStringMethods.includes(strMethodName)) {
            const obj = evaluateRule(rule.function.object, context, depth + 1, localScope);

            if (typeof obj === 'string') {
              const args = (rule.args || []).map(arg => evaluateRule(arg, context, depth + 1, localScope));

              switch (strMethodName) {
                case 'capitalize':
                  // Python's capitalize: first char uppercase, rest lowercase
                  result = obj.length > 0 ? obj.charAt(0).toUpperCase() + obj.slice(1).toLowerCase() : '';
                  break;
                case 'upper':
                  result = obj.toUpperCase();
                  break;
                case 'lower':
                  result = obj.toLowerCase();
                  break;
                case 'strip':
                  result = obj.trim();
                  break;
                case 'lstrip':
                  result = obj.trimStart();
                  break;
                case 'rstrip':
                  result = obj.trimEnd();
                  break;
                case 'startswith':
                  result = obj.startsWith(args[0]);
                  break;
                case 'endswith':
                  result = obj.endsWith(args[0]);
                  break;
                case 'replace':
                  result = obj.replace(args[0], args[1] || '');
                  break;
                case 'split':
                  result = args[0] ? obj.split(args[0]) : obj.split('');
                  break;
                case 'join':
                  // In Python, separator.join(iterable) - obj is the separator
                  result = Array.isArray(args[0]) ? args[0].join(obj) : String(args[0]);
                  break;
                default:
                  result = undefined;
              }
              break;
            }
          }
        }

        const func = evaluateRule(rule.function, context, depth + 1, localScope);

        if (typeof func === 'undefined') {
          result = undefined;
          break;
        }

        // Special case: If func is a __regionCanReach marker from attribute access on region reference
        // This handles patterns like: cave.can_reach() where cave is a region_reference
        if (func && typeof func === 'object' && func.__regionCanReach) {
          const regionName = func.regionName;
          if (typeof context.isRegionReachable === 'function') {
            result = context.isRegionReachable(regionName);
          } else {
            log('warn', `[evaluateRule] Cannot check region reachability for '${regionName}' - context.isRegionReachable not available`);
            result = undefined;
          }
          break;
        }

        // Special case: If func is a rule object (not a JavaScript function),
        // evaluate it directly. This handles cases like boss.defeat_rule where
        // defeat_rule is a rule object that needs evaluation, not a function call.
        if (
          func &&
          typeof func === 'object' &&
          func.type &&
          typeof func.type === 'string'
        ) {
          // Evaluate the rule object directly
          result = evaluateRule(func, context, depth + 1, localScope);
          break;
        }

        // Special case: If func is a boolean, it means rule.function was a rule object
        // that was already evaluated. In this case, the boolean is the result.
        // This happens when the exporter creates function_call structures where
        // the function field contains a complete rule (e.g., an 'and' rule) instead
        // of a function reference.
        if (typeof func === 'boolean') {
          result = func;
          break;
        }

        // Special case: Dynamic function dispatch
        // If func is a string, it's a helper function name from a dictionary lookup
        // This handles patterns like: ability_map[copy_abilities[enemy]](state, player)
        // where the subscript evaluates to a helper function name like "can_reach_burning"
        if (typeof func === 'string') {
          const helperName = func;
          const callArgs = (rule.args || []).map(
            (arg) => evaluateRule(arg, context, depth + 1, localScope)
          );

          // If any argument evaluation results in undefined, return undefined
          if (callArgs.some((arg) => arg === undefined)) {
            result = undefined;
            break;
          }

          // First, check for a JSON helper definition in rules.json
          if (typeof context?.getStaticData === 'function') {
            const staticData = context.getStaticData();
            const playerId = context.playerId || context.getPlayerId?.() || context.getPlayerSlot?.() || DEFAULT_PLAYER_ID;
            const playerIdKey = String(playerId);
            const helperDefinition = staticData?.helpers?.[playerIdKey]?.[helperName];

            if (helperDefinition) {
              // Found a helper definition - evaluate it recursively
              const params = helperDefinition.params || [];
              const defaults = helperDefinition.defaults || {};
              const body = helperDefinition.body || helperDefinition;

              // Create localScope with parameter bindings
              let helperLocalScope = localScope ? { ...localScope } : {};

              // Apply default values first
              for (const paramName of params) {
                if (paramName in defaults) {
                  helperLocalScope[paramName] = defaults[paramName];
                }
              }

              // Override with actual argument values
              for (let i = 0; i < params.length && i < callArgs.length; i++) {
                helperLocalScope[params[i]] = callArgs[i];
              }

              result = evaluateRule(body, context, depth + 1, helperLocalScope);

              // Unwrap return marker if present
              if (result && typeof result === 'object' && result.__isReturn) {
                result = result.value;
              }

              if (result !== undefined) {
                log('debug', `[evaluateRule] Dynamic helper (JSON) '${helperName}' returned: ${result}`);
                break;
              }
            }
          }

          // Fallback: Call the helper function through context.executeHelper (JavaScript helpers)
          if (context.executeHelper) {
            try {
              result = context.executeHelper(helperName, ...callArgs);
              log('debug', `[evaluateRule] Dynamic helper (JS) '${helperName}' returned: ${result}`);
            } catch (error) {
              log('error', `[evaluateRule] Failed to execute dynamic helper '${helperName}':`, error);
              result = undefined;
            }
          } else {
            log('warn', `[evaluateRule] No executeHelper method in context for dynamic helper '${helperName}'`);
            result = undefined;
          }
          break;
        }

        const args = (rule.args || []).map(
          (arg) => evaluateRule(arg, context, depth + 1, localScope) // Evaluate args recursively
        );

        // If any argument evaluation results in undefined, the function call result is undefined
        if (args.some((arg) => arg === undefined)) {
          result = undefined;
          break;
        }

        if (typeof func === 'function') {
          try {
            let thisContext = null;
            // Determine the context ('this') for the function call
            if (rule.function?.type === 'attribute' && rule.function.object) {
              // If the function was an attribute access (e.g., obj.method()),
              // 'this' should be the object it was accessed on.
              thisContext = evaluateRule(
                rule.function.object,
                context,
                depth + 1
              );
            } else {
              // Otherwise, default to the main context (snapshotInterface)
              thisContext = context;
            }

            // Handle cases where thisContext might still be null/undefined after evaluation
            if (thisContext === null || typeof thisContext === 'undefined') {
              log(
                'warn',
                "[evaluateRule FunctionCall] Resolved 'this' context is null/undefined. Using main context.",
                rule.function
              );
              thisContext = context;
            }

            result = func.apply(thisContext, args);
            // Check if the function itself returned undefined
            if (result === undefined) {
              // log('warn', `[evaluateRule FunctionCall] Function ${rule.function?.attr || rule.function?.name || '?'} returned undefined.`);
            }
          } catch (e) {
            let funcName = 'unknown';
            if (rule.function?.type === 'attribute') {
              funcName = rule.function.attr;
            } else if (rule.function?.type === 'value') {
              funcName = rule.function.value;
            } else if (rule.function?.type === 'name') {
              funcName = rule.function.name;
            }
            log(
              'error',
              `[evaluateRule] Error executing function call '${funcName}':`,
              e,
              {
                rule,
                contextType: isValidContext ? 'snapshotIF' : 'worker',
              }
            );
            result = undefined; // Error during execution means undefined outcome
          }
        } else {
          log('warn', `[evaluateRule] Resolved identifier is not a function:`, {
            identifier: rule.function,
            resolvedValue: func,
          });
          result = undefined; // Not a function, result undefined
        }
        break;
      }

      case 'subscript': {
        // Pass localScope to resolve parameter references like buildings[index]
        const list = evaluateRule(rule.value, context, depth + 1, localScope);
        const index = evaluateRule(rule.index, context, depth + 1, localScope);

        if (list === undefined || index === undefined) {
          result = undefined; // If array/object or index is unknown, result is unknown
        } else if (list && typeof list === 'object') {
          result = list[index]; // Access property/index
          // If list[index] itself is undefined (property doesn't exist), result remains undefined.

          // If the result is itself a rule object (has a 'type' property), evaluate it recursively.
          // This handles patterns like dict[setting_value] where dict values are rules.
          // Example: {"easy": <rule1>, "normal": <rule2>}[fight_logic] should evaluate the selected rule.
          if (result && typeof result === 'object' && result.type && typeof result.type === 'string') {
            log('debug', `[evaluateRule] Subscript result is a rule object (type: ${result.type}), evaluating recursively`);
            result = evaluateRule(result, context, depth + 1, localScope);
          }
        } else {
          log(
            'warn',
            '[evaluateRule] Subscript applied to non-object/non-map or null value.',
            { rule, list }
          );
          result = undefined;
        }
        break;
      }

      case 'slice': {
        // Python slice operation: list[start:stop:step]
        // Returns a subset of the list/array
        const sliceValue = evaluateRule(rule.value, context, depth + 1, localScope);

        if (sliceValue === undefined) {
          result = undefined;
          break;
        }

        if (!Array.isArray(sliceValue) && typeof sliceValue !== 'string') {
          log('warn', '[evaluateRule] Slice applied to non-array/non-string value', { rule, sliceValue });
          result = undefined;
          break;
        }

        // Evaluate slice bounds (any can be null/undefined for open-ended slices)
        const lower = rule.lower !== null && rule.lower !== undefined
          ? evaluateRule(rule.lower, context, depth + 1, localScope)
          : undefined;
        const upper = rule.upper !== null && rule.upper !== undefined
          ? evaluateRule(rule.upper, context, depth + 1, localScope)
          : undefined;
        const step = rule.step !== null && rule.step !== undefined
          ? evaluateRule(rule.step, context, depth + 1, localScope)
          : undefined;

        // Python-style slicing
        const len = sliceValue.length;

        // Handle negative indices (Python allows negative indices)
        let start = lower !== undefined ? (lower < 0 ? Math.max(0, len + lower) : lower) : 0;
        let stop = upper !== undefined ? (upper < 0 ? Math.max(0, len + upper) : upper) : len;
        const stepVal = step !== undefined ? step : 1;

        // Clamp values
        start = Math.max(0, Math.min(len, start));
        stop = Math.max(0, Math.min(len, stop));

        if (stepVal === 0) {
          log('warn', '[evaluateRule] Slice step cannot be 0');
          result = undefined;
          break;
        }

        // Perform the slice
        if (stepVal === 1) {
          // Simple slice with step 1
          result = Array.isArray(sliceValue) ? sliceValue.slice(start, stop) : sliceValue.slice(start, stop);
        } else if (stepVal > 0) {
          // Forward slice with step > 1
          result = [];
          for (let i = start; i < stop; i += stepVal) {
            result.push(sliceValue[i]);
          }
        } else {
          // Negative step (reverse)
          // For negative step, Python swaps start/stop semantics
          const actualStart = lower !== undefined ? lower : len - 1;
          const actualStop = upper !== undefined ? upper : -len - 1;
          result = [];
          for (let i = actualStart; i > actualStop; i += stepVal) {
            if (i >= 0 && i < len) {
              result.push(sliceValue[i]);
            }
          }
        }
        break;
      }

      case 'compare': {
        // Special handling for item_check in comparisons
        // When item_check (without a count field) is used as an operand in a comparison,
        // we need the item COUNT, not a boolean. This handles cases like KeyPD >= 4.
        let left = rule.left;
        let right = rule.right;

        // If left is an item_check without a count field, get the item count directly
        if (left && left.type === 'item_check' && left.count === undefined) {
          const itemName = evaluateRule(left.item, context, depth + 1, localScope);
          if (itemName === undefined) {
            left = undefined;
          } else if (typeof context.countItem === 'function') {
            left = context.countItem(itemName) || 0;
          } else {
            log('warn', '[evaluateRule] context.countItem not available for item_check in compare');
            left = undefined;
          }
        } else {
          left = evaluateRule(left, context, depth + 1, localScope);
        }

        // If right is an item_check without a count field, get the item count directly
        if (right && right.type === 'item_check' && right.count === undefined) {
          const itemName = evaluateRule(right.item, context, depth + 1, localScope);
          if (itemName === undefined) {
            right = undefined;
          } else if (typeof context.countItem === 'function') {
            right = context.countItem(itemName) || 0;
          } else {
            log('warn', '[evaluateRule] context.countItem not available for item_check in compare');
            right = undefined;
          }
        } else {
          right = evaluateRule(right, context, depth + 1, localScope);
        }

        const op = rule.op;

        // If either operand is undefined, the comparison result is undefined
        if (left === undefined || right === undefined) {
          result = undefined;
          break;
        }

        switch (op) {
          case '>':
            result = left > right;
            break;
          case '<':
            result = left < right;
            break;
          case '>=':
            result = left >= right;
            break;
          case '<=':
            result = left <= right;
            break;
          case '==':
            if (Array.isArray(left) && Array.isArray(right)) {
              result =
                left.length === right.length &&
                left.every((val, index) => val == right[index]);
            } else {
              result = left == right;
            }
            break;
          case '!=':
            if (Array.isArray(left) && Array.isArray(right)) {
              result =
                left.length !== right.length ||
                left.some((val, index) => val != right[index]);
            } else {
              result = left != right;
            }
            break;
          case 'in':
            if (Array.isArray(right)) {
              // Handle array comparison with deep equality for nested arrays
              if (Array.isArray(left)) {
                result = right.some(item => {
                  if (Array.isArray(item)) {
                    // Deep array comparison
                    return item.length === left.length &&
                           item.every((val, index) => val === left[index]);
                  } else {
                    return item === left;
                  }
                });
              } else {
                result = right.includes(left);
              }
            } else if (typeof right === 'string') {
              result = right.includes(left);
            } else if (right instanceof Set) {
              // Handle Set
              result = right.has(left);
            } else if (typeof right === 'object' && right !== null) {
              // Handle object (dictionary) membership check
              result = left in right;
            } else {
              log(
                'warn',
                '[evaluateRule] "in" operator used with invalid right side type:',
                { left, right }
              );
              result = false; // Define behavior: false if right side isn't iterable
            }
            break;
          case 'not in':
            // Same logic as 'in' but negated
            if (Array.isArray(right)) {
              // Handle array comparison with deep equality for nested arrays
              if (Array.isArray(left)) {
                result = !right.some(item => {
                  if (Array.isArray(item)) {
                    // Deep array comparison
                    return item.length === left.length &&
                           item.every((val, index) => val === left[index]);
                  } else {
                    return item === left;
                  }
                });
              } else {
                result = !right.includes(left);
              }
            } else if (typeof right === 'string') {
              result = !right.includes(left);
            } else if (right instanceof Set) {
              // Handle Set
              result = !right.has(left);
            } else if (typeof right === 'object' && right !== null) {
              // Handle object (dictionary) membership check
              result = !(left in right);
            } else {
              log(
                'warn',
                '[evaluateRule] "not in" operator used with invalid right side type:',
                { left, right }
              );
              result = true; // Define behavior: true if right side isn't iterable (consistent with 'not in' semantics)
            }
            break;
          case 'is':
            // Python 'is' operator - checks identity (same object)
            // In JavaScript, use === for strict equality which is closest
            result = left === right;
            break;
          case 'is not':
            // Python 'is not' operator - checks non-identity
            result = left !== right;
            break;
          default:
            log(
              'warn',
              `[evaluateRule] Unsupported comparison operator: ${op}`
            );
            result = undefined; // Operator unknown -> result unknown
        }
        break;
      }

      case 'total_items_count': {
        // Check if player has collected at least N items total across all item types
        const requiredCount = evaluateRule(rule.count, context, depth + 1);
        if (requiredCount === undefined) {
          result = undefined;
        } else if (typeof context.getTotalItemCount === 'function') {
          const totalCount = context.getTotalItemCount();
          result = totalCount >= requiredCount;
        } else if (context.snapshot && context.snapshot.inventory) {
          // Fallback: count items directly from snapshot inventory
          let totalCount = 0;
          for (const itemName in context.snapshot.inventory) {
            totalCount += context.snapshot.inventory[itemName] || 0;
          }
          result = totalCount >= requiredCount;
        } else {
          log('warn', '[evaluateRule] No way to get total item count for total_items_count rule.');
          result = undefined;
        }
        break;
      }
      
      case 'locations_checked': {
        // Check if player has checked at least N locations
        const requiredCount = evaluateRule(rule.count, context, depth + 1);
        if (requiredCount === undefined) {
          result = undefined;
        } else if (typeof context.getCheckedLocationsCount === 'function') {
          const checkedCount = context.getCheckedLocationsCount();
          result = checkedCount >= requiredCount;
        } else {
          log('warn', '[evaluateRule] context.getCheckedLocationsCount is not a function for locations_checked.');
          result = undefined;
        }
        break;
      }

      case 'item_check': {
        const itemName = evaluateRule(rule.item, context, depth + 1, localScope);
        if (itemName === undefined) {
          result = undefined;
        } else if (rule.count !== undefined) {
          // If there's a count field, use count-based checking
          let requiredCount = evaluateRule(rule.count, context, depth + 1, localScope);
          // Unwrap return marker if block was used as expression
          if (requiredCount && typeof requiredCount === 'object' && requiredCount.__isReturn) {
            requiredCount = requiredCount.value;
          }
          if (requiredCount === undefined) {
            result = undefined;
          } else if (typeof context.countItem === 'function') {
            const currentCount = context.countItem(itemName);
            if (currentCount === undefined) {
              result = undefined;
            } else {
              result = currentCount >= requiredCount;
            }
          } else {
            log('warn', '[evaluateRule SnapshotIF] context.countItem is not a function for item_check with count.');
            result = undefined;
          }
        } else if (typeof context.hasItem === 'function') {
          result = context.hasItem(itemName); // hasItem should return true/false/undefined
        } else {
          log(
            'warn',
            '[evaluateRule SnapshotIF] context.hasItem is not a function for item_check.'
          );
          result = undefined;
        }
        break;
      }

      case 'location_check': {
        // Check if a location is accessible (can be reached)
        // This matches the Python behavior where _can_get checks if a location CAN be reached
        const locationName = evaluateRule(rule.location, context, depth + 1);
        if (locationName === undefined) {
          result = undefined;
        } else if (typeof context.isLocationAccessible === 'function') {
          result = context.isLocationAccessible(locationName);
          if (result === undefined) {
            log('warn', `[evaluateRule] Location ${locationName} accessibility could not be determined`);
          }
        } else {
          log('warn', '[evaluateRule] context.isLocationAccessible is not a function for location_check.');
          result = undefined;
        }
        break;
      }

      case 'location_rule_ref': {
        // Evaluate another location's access rule directly
        // Used for export-time resolution of helpers that reference location rules
        // Format: { type: 'location_rule_ref', location: 'Act Completion (Down with the Mafia!)' }
        const locationName = typeof rule.location === 'string'
          ? rule.location
          : evaluateRule(rule.location, context, depth + 1, localScope);

        if (typeof locationName !== 'string') {
          log('warn', '[evaluateRule] location_rule_ref: location did not evaluate to string', { rule, locationName });
          result = undefined;
          break;
        }

        if (typeof context.getStaticData !== 'function') {
          log('warn', '[evaluateRule] location_rule_ref: context.getStaticData not available');
          result = undefined;
          break;
        }

        const staticData = context.getStaticData();
        const regionsData = staticData?.regions;

        if (!regionsData) {
          log('warn', '[evaluateRule] location_rule_ref: no regions data in staticData');
          result = undefined;
          break;
        }

        // Search all regions for this location
        let locationData = null;
        if (regionsData instanceof Map) {
          for (const [regionName, regionData] of regionsData.entries()) {
            if (regionData.locations) {
              const loc = regionData.locations.find(l => l.name === locationName);
              if (loc) {
                locationData = loc;
                break;
              }
            }
          }
        } else {
          // Plain object
          for (const regionData of Object.values(regionsData)) {
            if (regionData.locations) {
              const loc = regionData.locations.find(l => l.name === locationName);
              if (loc) {
                locationData = loc;
                break;
              }
            }
          }
        }

        if (!locationData) {
          log('debug', `[evaluateRule] location_rule_ref: location '${locationName}' not found`);
          result = undefined;
          break;
        }

        // Evaluate the location's access rule
        if (locationData.access_rule) {
          result = evaluateRule(locationData.access_rule, context, depth + 1, localScope);
        } else {
          // No access rule means the location has no item requirements (always accessible from region)
          result = true;
        }
        break;
      }

      case 'region_check': {
        // Check if a region is accessible (can be reached)
        const regionName = evaluateRule(rule.region, context, depth + 1);
        if (regionName === undefined) {
          result = undefined;
        } else if (typeof context.isRegionAccessible === 'function') {
          result = context.isRegionAccessible(regionName);
          if (result === undefined) {
            log('warn', `[evaluateRule] Region ${regionName} accessibility could not be determined`);
          }
        } else {
          log('warn', '[evaluateRule] context.isRegionAccessible is not a function for region_check.');
          result = undefined;
        }
        break;
      }

      case 'count_check': {
        const itemName = evaluateRule(rule.item, context, depth + 1);
        // Default count to 1 if not specified
        const requiredCount =
          rule.count !== undefined
            ? evaluateRule(rule.count, context, depth + 1)
            : 1;

        if (itemName === undefined || requiredCount === undefined) {
          result = undefined;
        } else if (typeof context.countItem === 'function') {
          const currentCount = context.countItem(itemName);
          // countItem itself might return undefined if it can't determine the count
          result =
            currentCount === undefined
              ? undefined
              : (currentCount || 0) >= requiredCount;
        } else {
          log(
            'warn',
            '[evaluateRule SnapshotIF] context.countItem is not a function for count_check.'
          );
          result = undefined;
        }
        break;
      }

      case 'group_check': {
        const groupName = evaluateRule(rule.group, context, depth + 1, localScope);
        // Default count to 1 if not specified
        const requiredCount =
          rule.count !== undefined
            ? evaluateRule(rule.count, context, depth + 1, localScope)
            : 1;

        if (groupName === undefined || requiredCount === undefined) {
          result = undefined;
        } else if (typeof context.countGroup === 'function') {
          const currentCount = context.countGroup(groupName);
          // countGroup might return undefined
          result =
            currentCount === undefined
              ? undefined
              : (currentCount || 0) >= requiredCount;
        } else {
          log(
            'warn',
            '[evaluateRule SnapshotIF] context.countGroup is not a function for group_check.'
          );
          result = undefined;
        }
        break;
      }

      case 'group_count': {
        // Returns the count of items in a group (unlike group_check which returns a boolean)
        const groupName = evaluateRule(rule.group, context, depth + 1, localScope);

        if (groupName === undefined) {
          result = undefined;
        } else if (typeof context.countGroup === 'function') {
          const currentCount = context.countGroup(groupName);
          result = currentCount === undefined ? 0 : currentCount;
        } else {
          log(
            'warn',
            '[evaluateRule SnapshotIF] context.countGroup is not a function for group_count.'
          );
          result = undefined;
        }
        break;
      }

      case 'counts': {
        // COUNTS: check if total count of any items in list >= required amount
        // Used by LADX for instrument count requirements (e.g., need 3 of 8 instruments)
        const countItems = rule.items || [];
        const requiredCount = evaluateRule(rule.count, context, depth + 1, localScope);

        if (requiredCount === undefined) {
          result = undefined;
          break;
        }

        let totalItemCount = 0;
        let hasUndefined = false;

        for (const item of countItems) {
          // Items can be strings or rule structures
          const itemName = typeof item === 'string' ? item : evaluateRule(item, context, depth + 1, localScope);
          if (itemName === undefined) {
            hasUndefined = true;
            break;
          }
          const itemCount = typeof context.countItem === 'function'
            ? (context.countItem(itemName) ?? 0)
            : 0;
          totalItemCount += itemCount;
        }

        if (hasUndefined) {
          result = undefined;
        } else {
          result = totalItemCount >= requiredCount;
        }
        break;
      }

      case 'prog_item_count': {
        // Return the count of a progression item from state.prog_items[player][key]
        // This handles DLCQuest and other games that use accumulator items
        // (e.g., " coins", " coins freemium", "rep", "RUPEES")
        const progKey = rule.key;
        if (progKey === undefined) {
          log('warn', '[evaluateRule] prog_item_count: missing key');
          result = undefined;
        } else if (typeof context.countProgItem === 'function') {
          // Use dedicated function if available
          result = context.countProgItem(progKey) ?? 0;
        } else {
          // Fallback: check prog_items directly from snapshot
          const snapshot = context.snapshot || context;
          const playerId = context.playerId || context.getPlayerId?.() || 1;

          // Try multiple key formats for player ID
          const progItems = snapshot?.prog_items;
          const count =
            progItems?.[playerId]?.[progKey] ??
            progItems?.[String(playerId)]?.[progKey] ??
            progItems?.[parseInt(playerId)]?.[progKey] ??
            0;
          result = count;
        }
        break;
      }

      case 'player_id': {
        // Return the current player ID
        // This is used for self.player references in class-based rule helpers (like KH2)
        if (typeof context.getPlayerId === 'function') {
          result = context.getPlayerId();
        } else if (context.playerId !== undefined) {
          result = context.playerId;
        } else if (typeof context.getPlayerSlot === 'function') {
          result = context.getPlayerSlot();
        } else {
          log('debug', '[evaluateRule] player_id: No player ID available in context, defaulting to 1');
          result = 1; // Default to player 1 for single-player scenarios
        }
        break;
      }

      case 'setting_value': {
        // Retrieve a setting value (e.g. for self.world.options.difficulty)
        // Supports dot notation for nested access (e.g. "difficulty_requirements.progressive_bottle_limit")
        // Note: Choice options in Python use 0 for "off"/"none" states, which are exported
        // as strings like 'off', 'none', 'false'. These should be treated as falsy in JS.
        let settingName = rule.setting;
        if (typeof settingName === 'string') {
          let rawValue;
          // Handle dot notation for nested property access
          if (settingName.includes('.')) {
            const parts = settingName.split('.');
            rawValue = context.getSetting(parts[0]);
            // Traverse the path for nested properties
            for (let i = 1; i < parts.length && rawValue !== undefined; i++) {
              rawValue = rawValue?.[parts[i]];
            }
          } else {
            rawValue = context.getSetting(settingName);
          }
          // If an index is provided, subscript the array value
          if (rule.index !== undefined && rawValue !== undefined) {
            if (Array.isArray(rawValue)) {
              result = rawValue[rule.index];
            } else {
              log('warn', '[evaluateRule] setting_value has index but value is not an array', {
                rule,
                rawValue,
              });
              result = undefined;
            }
          } else {
            // Normalize certain string values to be falsy
            // This handles Choice options where 0='off'/'none' etc.
            // The normalization of 'off'/'none' strings is now handled in stateInterface.getSetting
            result = rawValue;
          }
        } else {
          log('warn', '[evaluateRule] Invalid setting name for setting_value', {
            rule,
            settingName,
          });
          result = undefined;
        }
        break;
      }

      case 'f_string': {
        // Evaluate f-string formatting (e.g., "Automated {ingredient}")
        if (!rule.parts || !Array.isArray(rule.parts)) {
          log('warn', '[evaluateRule] f_string rule missing parts array', { rule });
          result = undefined;
          break;
        }

        // Build the string by evaluating each part
        let resultStr = '';
        let hasError = false;
        for (const part of rule.parts) {
          if (part.type === 'constant') {
            resultStr += part.value;
          } else if (part.type === 'formatted_value') {
            // Evaluate the value and convert to string
            const value = evaluateRule(part.value, context, depth + 1);
            if (value === undefined) {
              log('warn', '[evaluateRule] f_string formatted_value evaluated to undefined', { part });
              hasError = true;
              break;
            }
            resultStr += String(value);
          } else {
            log('warn', '[evaluateRule] Unknown f_string part type', { part });
            hasError = true;
            break;
          }
        }

        // If we successfully built the string, return it; otherwise undefined
        result = hasError ? undefined : resultStr;
        break;
      }

      case 'setting_check': {
        let settingName = evaluateRule(rule.setting, context, depth + 1);
        let expectedValue = evaluateRule(rule.value, context, depth + 1);

        if (settingName === undefined || expectedValue === undefined) {
          result = undefined;
        } else if (typeof settingName === 'string') {
          const actualValue = context.getSetting(settingName);
          // If getSetting returns undefined (setting doesn't exist/value is undefined), comparison result is undefined
          result =
            actualValue === undefined
              ? undefined
              : actualValue === expectedValue;
        } else {
          log('warn', '[evaluateRule] Invalid setting name for setting_check', {
            rule,
            settingName,
          });
          result = undefined;
        }
        break;
      }

      case 'name': {
        // First check local scope (for imperative rule evaluation)
        if (localScope !== null && rule.name in localScope) {
          result = localScope[rule.name];
          break;
        }

        // Resolve name using the context's resolveName method if available
        if (context && typeof context.resolveName === 'function') {
          result = context.resolveName(rule.name);
        }

        // If not resolved, try to get from settings
        // This is needed for helper definitions that reference settings like 'floating'
        if (result === undefined && typeof context?.getStaticData === 'function') {
          const staticData = context.getStaticData();
          const playerId = context.playerId || context.getPlayerId?.() || context.getPlayerSlot?.() || DEFAULT_PLAYER_ID;
          const settingValue = staticData?.settings?.[playerId]?.[rule.name];
          if (settingValue !== undefined) {
            result = settingValue;
            log('debug', `[evaluateRule] Resolved name '${rule.name}' from settings: ${typeof result === 'object' ? 'object' : result}`);
          }
        }

        // Note: Unresolved names are expected in some cases (e.g., Python-side variables
        // like 'location' that can't be resolved in the frontend). This is not necessarily
        // an error - the containing rule may still evaluate correctly through other means.
        // Only log at debug level to avoid noisy warnings.
        if (result === undefined) {
          log(
            'debug',
            `[evaluateRule] Could not resolve name: ${rule.name}`
          );
        }
        break;
      }

      case 'conditional': {
        if (!rule.test || !rule.if_true) {
          log(
            'warn',
            '[evaluateRule Conditional] Malformed conditional rule:',
            rule
          );
          result = undefined;
        } else {
          const testResult = evaluateRule(rule.test, context, depth + 1, localScope);
          if (testResult === undefined) {
            result = undefined; // If test is unknown, outcome is unknown
          } else if (testResult) {
            result = evaluateRule(rule.if_true, context, depth + 1, localScope);
          } else {
            // Handle null if_false as false (location not accessible)
            result =
              rule.if_false === null
                ? false
                : evaluateRule(rule.if_false, context, depth + 1, localScope);
          }
        }
        break;
      }

      case 'binary_op': {
        let left = evaluateRule(rule.left, context, depth + 1, localScope);
        let right = evaluateRule(rule.right, context, depth + 1, localScope);
        const op = rule.op;

        // Unwrap return markers from block expressions used as operands
        if (left && typeof left === 'object' && left.__isReturn) {
          left = left.value;
        }
        if (right && typeof right === 'object' && right.__isReturn) {
          right = right.value;
        }

        if (left === undefined || right === undefined) {
          result = undefined;
          break;
        }

        switch (op) {
          case '+':
            result = left + right;
            break;
          case '-':
            result = left - right;
            break;
          case '*':
            // Handle Python-style list repetition: [item] * count = [item, item, ...]
            if (Array.isArray(left) && typeof right === 'number') {
              result = [];
              for (let i = 0; i < right; i++) {
                result.push(...left);
              }
            } else {
              result = left * right;
            }
            break;
          case '/':
            result = right !== 0 ? left / right : undefined;
            break;
          case '//':
            // Python floor division operator
            result = right !== 0 ? Math.floor(left / right) : undefined;
            break;
          case '==':
            result = left == right;
            break;
          case '!=':
            result = left != right;
            break;
          case '<':
            result = left < right;
            break;
          case '>':
            result = left > right;
            break;
          case '<=':
            result = left <= right;
            break;
          case '>=':
            result = left >= right;
            break;
          case 'AND':
          case 'and':
            result = left && right;
            break;
          case 'OR':
          case 'or':
            result = left || right;
            break;
          case '**':
            // Python power operator
            result = Math.pow(left, right);
            break;
          case '%':
            // Python modulo operator
            result = right !== 0 ? left % right : undefined;
            break;
          case '&':
            // Python bitwise AND operator (also used for boolean AND in some contexts)
            // For booleans: True & False = False, True & True = True
            // For integers: performs bitwise AND
            if (typeof left === 'boolean' && typeof right === 'boolean') {
              result = left && right;
            } else if (typeof left === 'number' && typeof right === 'number') {
              result = left & right;
            } else {
              // Mixed types: convert to boolean
              result = Boolean(left) && Boolean(right);
            }
            break;
          case '|':
            // Python bitwise OR operator (also used for boolean OR in some contexts)
            // For booleans: True | False = True, False | False = False
            // For integers: performs bitwise OR
            if (typeof left === 'boolean' && typeof right === 'boolean') {
              result = left || right;
            } else if (typeof left === 'number' && typeof right === 'number') {
              result = left | right;
            } else {
              // Mixed types: convert to boolean
              result = Boolean(left) || Boolean(right);
            }
            break;
          case '^':
            // Python bitwise XOR operator
            if (typeof left === 'number' && typeof right === 'number') {
              result = left ^ right;
            } else {
              // For booleans: XOR (exactly one true)
              result = Boolean(left) !== Boolean(right);
            }
            break;
          default:
            log('warn', `[evaluateRule] Unknown binary_op operator: ${op}`, {
              rule,
            });
            result = undefined;
        }
        break;
      }

      case 'min': {
        // Return the minimum of evaluated arguments or iterable
        // Supports both: min(a, b, c) via args, and min(iterable) via iterable
        if (rule.iterable) {
          // Iterable form: min(generator) or min(list)
          const minIterable = evaluateRule(rule.iterable, context, depth + 1, localScope);
          if (minIterable === undefined) {
            result = undefined;
          } else if (Array.isArray(minIterable)) {
            if (minIterable.length === 0) {
              // Empty iterable - return undefined (Python would raise ValueError)
              log('debug', '[evaluateRule] min called on empty iterable', { rule });
              result = undefined;
            } else if (minIterable.some((v) => v === undefined)) {
              result = undefined;
            } else {
              result = Math.min(...minIterable);
            }
          } else if (typeof minIterable === 'number') {
            // Single number - just return it
            result = minIterable;
          } else {
            log('warn', '[evaluateRule] min iterable is not an array or number', { minIterable, rule });
            result = undefined;
          }
          break;
        }
        // Explicit args form: min(a, b, c)
        if (!rule.args || rule.args.length === 0) {
          log('warn', '[evaluateRule] min rule has no arguments or iterable', { rule });
          result = undefined;
          break;
        }
        const minArgs = rule.args.map((arg) =>
          evaluateRule(arg, context, depth + 1, localScope)
        );
        if (minArgs.some((arg) => arg === undefined)) {
          result = undefined;
          break;
        }
        result = Math.min(...minArgs);
        break;
      }

      case 'max': {
        // Return the maximum of evaluated arguments or iterable
        // Supports both: max(a, b, c) via args, and max(iterable) via iterable
        if (rule.iterable) {
          // Iterable form: max(generator) or max(list)
          const maxIterable = evaluateRule(rule.iterable, context, depth + 1, localScope);
          if (maxIterable === undefined) {
            result = undefined;
          } else if (Array.isArray(maxIterable)) {
            if (maxIterable.length === 0) {
              // Empty iterable - return undefined (Python would raise ValueError)
              log('debug', '[evaluateRule] max called on empty iterable', { rule });
              result = undefined;
            } else if (maxIterable.some((v) => v === undefined)) {
              result = undefined;
            } else {
              result = Math.max(...maxIterable);
            }
          } else if (typeof maxIterable === 'number') {
            // Single number - just return it
            result = maxIterable;
          } else {
            log('warn', '[evaluateRule] max iterable is not an array or number', { maxIterable, rule });
            result = undefined;
          }
          break;
        }
        // Explicit args form: max(a, b, c)
        if (!rule.args || rule.args.length === 0) {
          log('warn', '[evaluateRule] max rule has no arguments or iterable', { rule });
          result = undefined;
          break;
        }
        const maxArgs = rule.args.map((arg) =>
          evaluateRule(arg, context, depth + 1, localScope)
        );
        if (maxArgs.some((arg) => arg === undefined)) {
          result = undefined;
          break;
        }
        result = Math.max(...maxArgs);
        break;
      }

      case 'sum': {
        // Sum the values in an iterable
        // Rule structure: { type: 'sum', iterable: <rule>, start?: <rule> }
        if (!rule.iterable) {
          log('warn', '[evaluateRule] sum rule has no iterable', { rule });
          result = 0;
          break;
        }
        const sumIterable = evaluateRule(rule.iterable, context, depth + 1, localScope);
        const startValue = rule.start !== undefined
          ? evaluateRule(rule.start, context, depth + 1, localScope)
          : 0;

        if (sumIterable === undefined) {
          result = undefined;
          break;
        }
        if (startValue === undefined) {
          result = undefined;
          break;
        }
        if (Array.isArray(sumIterable)) {
          // Check if any element is undefined
          if (sumIterable.some((v) => v === undefined)) {
            result = undefined;
            break;
          }
          // Sum all numeric values
          result = sumIterable.reduce((acc, val) => {
            if (typeof val === 'number') {
              return acc + val;
            } else if (typeof val === 'boolean') {
              // Python sum() treats True as 1, False as 0
              return acc + (val ? 1 : 0);
            }
            return acc;
          }, startValue);
        } else if (typeof sumIterable === 'number') {
          // Single number - just return it plus start
          result = sumIterable + startValue;
        } else {
          log('warn', '[evaluateRule] sum iterable is not an array or number', { sumIterable, rule });
          result = undefined;
        }
        break;
      }

      case 'map': {
        // Apply a function (lambda) to each element of an iterable
        // Rule structure: { type: 'map', function: <lambda>, iterable: <rule> }
        if (!rule.function || !rule.iterable) {
          log('warn', '[evaluateRule] map rule missing function or iterable', { rule });
          result = undefined;
          break;
        }

        const mapIterable = evaluateRule(rule.iterable, context, depth + 1, localScope);

        if (mapIterable === undefined) {
          result = undefined;
          break;
        }

        if (!Array.isArray(mapIterable)) {
          log('warn', '[evaluateRule] map iterable is not an array', { mapIterable, rule });
          result = undefined;
          break;
        }

        // Apply the function to each element
        const mapFunc = rule.function;
        const mappedResults = [];

        for (const item of mapIterable) {
          // Create a new scope with the lambda parameter bound to the current item
          const lambdaScope = localScope ? { ...localScope } : {};

          if (mapFunc.type === 'lambda' && mapFunc.params && mapFunc.params.length > 0) {
            // Bind the first parameter to the item
            lambdaScope[mapFunc.params[0]] = item;
            // Evaluate the lambda body with the bound parameter
            const mappedValue = evaluateRule(mapFunc.body, context, depth + 1, lambdaScope);
            mappedResults.push(mappedValue);
          } else {
            // If it's not a proper lambda, try to evaluate it directly
            log('warn', '[evaluateRule] map function is not a lambda with params', { mapFunc });
            mappedResults.push(undefined);
          }
        }

        // If any mapped result is undefined, the whole map result is undefined
        if (mappedResults.some((v) => v === undefined)) {
          result = undefined;
        } else {
          result = mappedResults;
        }
        break;
      }

      case 'lambda': {
        // Lambda expressions - these are typically evaluated in context (e.g., by map)
        // If we encounter a lambda directly, it's likely being used as a value
        // Return a representation that can be used by other constructs
        log('debug', '[evaluateRule] Lambda encountered directly - returning function representation');
        result = rule; // Return the rule itself as a function representation
        break;
      }

      case 'list': {
        if (!Array.isArray(rule.value)) {
          log(
            'warn',
            '[evaluateRule] List rule does not have an array value:',
            rule
          );
          result = undefined;
          break;
        }
        const evaluatedList = rule.value.map((itemRule) =>
          evaluateRule(itemRule, context, depth + 1)
        );
        // If any item evaluation is undefined, the list as a whole might be considered undefined for some operations
        // For now, return the list potentially containing undefined
        result = evaluatedList.some((item) => item === undefined)
          ? undefined
          : evaluatedList;
        break;
      }

      case 'set': {
        // Set literal - evaluate elements and return as array (JS doesn't have set literals)
        // The 'set' type indicates this came from a Python set, but for evaluation purposes
        // it behaves like a list/array (used in has_any, iteration, etc.)
        if (!Array.isArray(rule.elements)) {
          log(
            'warn',
            '[evaluateRule] Set rule does not have an elements array:',
            rule
          );
          result = undefined;
          break;
        }
        const evaluatedSet = rule.elements.map((itemRule) =>
          evaluateRule(itemRule, context, depth + 1)
        );
        // Remove duplicates (set semantics)
        const uniqueSet = [...new Set(evaluatedSet)];
        result = evaluatedSet.some((item) => item === undefined)
          ? undefined
          : uniqueSet;
        break;
      }

      case 'all_of': {
        // all_of evaluates an element_rule against all items from an iterator
        if (!rule.element_rule) {
          log('warn', '[evaluateRule] all_of rule missing element_rule', { rule });
          result = undefined;
          break;
        }

        // Extract iterator information
        // NOTE: Pass localScope so that helper parameters can be resolved
        let iterable;
        if (rule.iterator_info && rule.iterator_info.iterator) {
          // Get the iterator from the iterator_info
          iterable = evaluateRule(rule.iterator_info.iterator, context, depth + 1, localScope);
        } else if (rule.iterable) {
          // Fallback for direct iterable field
          iterable = evaluateRule(rule.iterable, context, depth + 1, localScope);
        } else {
          log('warn', '[evaluateRule] all_of rule missing iterator information', { rule });
          result = undefined;
          break;
        }

        if (!Array.isArray(iterable)) {
          log('warn', '[evaluateRule] all_of iterator is not an array', { rule, iterable });
          result = false;
          break;
        }

        result = true;
        for (const item of iterable) {
          // Create a new context with the iterator variable bound
          const boundContext = createBoundContext(context, rule.iterator_info, item);

          const itemResult = evaluateRule(rule.element_rule, boundContext, depth + 1);
          if (itemResult === false) {
            result = false;
            break;
          }
          if (itemResult === undefined) {
            result = undefined;
            break;
          }
        }
        break;
      }

      case 'any_of': {
        // any_of evaluates an element_rule against items from an iterator
        // Returns true if ANY item satisfies the element_rule (OR logic)
        if (!rule.element_rule) {
          log('warn', '[evaluateRule] any_of rule missing element_rule', { rule });
          result = undefined;
          break;
        }

        // Extract iterator information
        // NOTE: Pass localScope so that helper parameters (like 'item' in can_buy) can be resolved
        let iterable;
        if (rule.iterator_info && rule.iterator_info.iterator) {
          // Get the iterator from the iterator_info
          iterable = evaluateRule(rule.iterator_info.iterator, context, depth + 1, localScope);
        } else if (rule.iterable) {
          // Fallback for direct iterable field
          iterable = evaluateRule(rule.iterable, context, depth + 1, localScope);
        } else {
          log('warn', '[evaluateRule] any_of rule missing iterator information', { rule });
          result = undefined;
          break;
        }

        if (!Array.isArray(iterable)) {
          log('warn', '[evaluateRule] any_of iterator is not an array', { rule, iterable });
          result = false;
          break;
        }

        // If the iterable is empty, any_of should return false
        if (iterable.length === 0) {
          result = false;
          break;
        }

        result = false;
        let hasUndefined = false;
        for (const item of iterable) {
          // Create a new context with the iterator variable bound
          const boundContext = createBoundContext(context, rule.iterator_info, item);

          const itemResult = evaluateRule(rule.element_rule, boundContext, depth + 1);
          if (itemResult === true) {
            result = true;
            break;
          }
          if (itemResult === undefined) {
            hasUndefined = true;
          }
        }
        // If no item returned true but some returned undefined, result is undefined
        if (result === false && hasUndefined) {
          result = undefined;
        }
        break;
      }

      case 'sum_of': {
        // sum_of evaluates an element_rule against items from an iterator and sums the results
        // This is used for patterns like: sum([state.count(item, player) for item in items])
        // Also supports conditional comprehensions: sum([1 for item in items if condition])
        if (!rule.element_rule) {
          log('warn', '[evaluateRule] sum_of rule missing element_rule', { rule });
          result = undefined;
          break;
        }

        // Extract iterator information
        let iterable;
        if (rule.iterator_info && rule.iterator_info.iterator) {
          iterable = evaluateRule(rule.iterator_info.iterator, context, depth + 1, localScope);
        } else if (rule.iterable) {
          iterable = evaluateRule(rule.iterable, context, depth + 1, localScope);
        } else {
          log('warn', '[evaluateRule] sum_of rule missing iterator information', { rule });
          result = undefined;
          break;
        }

        // Handle both arrays and objects (dictionaries)
        // In Python, iterating over a dict yields its keys
        if (!Array.isArray(iterable)) {
          if (iterable && typeof iterable === 'object') {
            // Convert object keys to array for iteration (like Python's dict iteration)
            iterable = Object.keys(iterable);
            log('debug', '[evaluateRule] sum_of: converted object to keys array', { keys: iterable });
          } else {
            log('warn', '[evaluateRule] sum_of iterator is not an array or object', { rule, iterable });
            result = 0;
            break;
          }
        }

        // If the iterable is empty, sum_of should return 0
        if (iterable.length === 0) {
          result = 0;
          break;
        }

        // Check if there's a condition (if clause in comprehension)
        const hasCondition = rule.iterator_info && rule.iterator_info.condition;

        result = 0;
        let sumHasUndefined = false;
        for (const item of iterable) {
          // Create a new context with the iterator variable bound
          const boundContext = createBoundContext(context, rule.iterator_info, item);

          // If there's a condition, evaluate it first
          if (hasCondition) {
            const conditionResult = evaluateRule(rule.iterator_info.condition, boundContext, depth + 1);
            if (conditionResult === undefined) {
              sumHasUndefined = true;
              continue;
            }
            // Skip this item if condition is false
            if (!conditionResult) {
              continue;
            }
          }

          const itemResult = evaluateRule(rule.element_rule, boundContext, depth + 1);
          if (itemResult === undefined) {
            sumHasUndefined = true;
          } else if (typeof itemResult === 'number') {
            result += itemResult;
          } else {
            // Non-numeric result - treat as 0 or log warning
            log('debug', '[evaluateRule] sum_of element returned non-numeric value', { item, itemResult });
          }
        }
        // If any item returned undefined, result should be undefined
        if (sumHasUndefined) {
          result = undefined;
        }
        break;
      }

      case 'generator_expression': {
        // generator_expression represents a Python generator expression
        // It has an element, a comprehension target/iterator, and optional conditions
        // Example: (1 for item_list in list_of_items if condition)
        if (!rule.element) {
          log('warn', '[evaluateRule] generator_expression rule missing element', { rule });
          result = undefined;
          break;
        }

        // Check if we have comprehension details for proper iteration
        if (rule.comprehension && rule.comprehension.iterator) {
          const comp = rule.comprehension;
          const targetName = comp.target?.name;
          const iteratorRule = comp.iterator;
          // Handle both singular 'condition' and plural 'conditions'
          let conditions = comp.conditions || [];
          if (!Array.isArray(conditions) && comp.condition) {
            conditions = [comp.condition];
          }

          // Evaluate the iterator (should be an array from localScope or context)
          const iteratorValue = evaluateRule(iteratorRule, context, depth + 1, localScope);

          if (!Array.isArray(iteratorValue)) {
            log('debug', '[evaluateRule] generator_expression iterator is not an array', { iteratorValue, rule });
            result = [];
            break;
          }

          // Build result array by iterating and filtering
          const generatedValues = [];
          for (const item of iteratorValue) {
            // Create new localScope with the target variable bound
            const iterationScope = localScope ? { ...localScope } : {};
            if (targetName) {
              iterationScope[targetName] = item;
            }

            // Check all conditions
            let conditionsPassed = true;
            for (const condRule of conditions) {
              const condResult = evaluateRule(condRule, context, depth + 1, iterationScope);
              if (condResult !== true) {
                conditionsPassed = false;
                break;
              }
            }

            // If conditions pass, evaluate and yield the element
            if (conditionsPassed) {
              const elementValue = evaluateRule(rule.element, context, depth + 1, iterationScope);
              generatedValues.push(elementValue);
            }
          }

          result = generatedValues;
        } else {
          // Fallback: just evaluate the element directly (legacy behavior)
          result = evaluateRule(rule.element, context, depth + 1, localScope);
        }
        break;
      }

      case 'can_reach': {
        // Check if a region is reachable
        const regionName = evaluateRule(rule.region, context, depth + 1);
        if (regionName === undefined) {
          result = undefined;
        } else if (typeof context.isRegionReachable === 'function') {
          result = context.isRegionReachable(regionName);
          if (result === undefined) {
            log('debug', `[evaluateRule] Region ${regionName} reachability could not be determined`);
          }
        } else {
          log('warn', '[evaluateRule] context.isRegionReachable is not a function for can_reach.');
          result = undefined;
        }
        break;
      }

      case 'can_reach_entrance': {
        // Check if an entrance is reachable
        // An entrance is reachable if we can reach its source region AND satisfy its access rule
        const entranceName = rule.entrance;
        if (!entranceName) {
          log('warn', '[evaluateRule] can_reach_entrance rule missing entrance name');
          result = undefined;
          break;
        }

        // Find the entrance in the regions data
        let entrance = null;
        let sourceRegion = null;

        if (typeof context.getStaticData === 'function') {
          const staticData = context.getStaticData();
          const regionsData = staticData?.regions;

          if (regionsData && regionsData instanceof Map) {
            // staticData.regions is a Map of region name -> region data
            // Search for the entrance in all regions
            for (const [regionName, regionData] of regionsData.entries()) {
              const exits = regionData.exits || [];
              const foundExit = exits.find(exit => exit.name === entranceName);
              if (foundExit) {
                entrance = foundExit;
                sourceRegion = regionName;
                break;
              }
            }
          }
        }

        if (!entrance || !sourceRegion) {
          log('warn', `[evaluateRule] Entrance "${entranceName}" not found in regions data`);
          result = undefined;
          break;
        }

        // Check if source region is reachable
        if (typeof context.isRegionReachable !== 'function') {
          log('warn', '[evaluateRule] context.isRegionReachable is not a function for can_reach_entrance.');
          result = undefined;
          break;
        }

        const sourceReachable = context.isRegionReachable(sourceRegion);
        if (!sourceReachable) {
          result = false;
          break;
        }

        // Evaluate the entrance's access rule
        if (entrance.access_rule) {
          result = evaluateRule(entrance.access_rule, context, depth + 1);
        } else {
          // No access rule means the entrance is accessible if the region is reachable
          result = true;
        }
        break;
      }

      case 'region_reference': {
        // Returns a region reference object that can be used to access region attributes
        // or passed to helpers that take a region parameter
        // Format: { type: 'region_reference', region: 'Region Name' }
        const regionName = rule.region;
        if (!regionName) {
          log('warn', '[evaluateRule] region_reference rule missing region name', { rule });
          result = undefined;
          break;
        }
        // Return an object with the region name that can be used later
        // to look up region attributes or check reachability
        result = { __regionRef: true, regionName };
        break;
      }

      case 'region_attribute': {
        // Access an attribute of a region (e.g., region.is_light_world)
        // Used by helpers like is_not_bunny that take a region parameter
        // Format: { type: 'region_attribute', region: {...}, attr: 'is_light_world' }
        const regionExpr = evaluateRule(rule.region, context, depth + 1, localScope);
        const attrName = rule.attr;

        if (regionExpr === undefined) {
          log('debug', '[evaluateRule] region_attribute: region evaluated to undefined', { rule });
          result = undefined;
          break;
        }

        if (!attrName) {
          log('warn', '[evaluateRule] region_attribute rule missing attr', { rule });
          result = undefined;
          break;
        }

        // Get the region name from the expression
        let regionName;
        if (typeof regionExpr === 'string') {
          regionName = regionExpr;
        } else if (regionExpr?.__regionRef) {
          regionName = regionExpr.regionName;
        } else {
          log('warn', '[evaluateRule] region_attribute: cannot determine region name', { regionExpr, rule });
          result = undefined;
          break;
        }

        // Look up the region in static data
        if (typeof context.getStaticData !== 'function') {
          log('warn', '[evaluateRule] region_attribute: context.getStaticData not available');
          result = undefined;
          break;
        }

        const staticData = context.getStaticData();
        const regionsData = staticData?.regions;

        if (!regionsData) {
          log('warn', '[evaluateRule] region_attribute: no regions data in staticData');
          result = undefined;
          break;
        }

        // Regions can be a Map or plain object
        let regionData;
        if (regionsData instanceof Map) {
          regionData = regionsData.get(regionName);
        } else {
          regionData = regionsData[regionName];
        }

        if (!regionData) {
          log('debug', `[evaluateRule] region_attribute: region '${regionName}' not found`);
          result = undefined;
          break;
        }

        // Get the attribute value
        result = regionData[attrName];
        if (result === undefined) {
          log('debug', `[evaluateRule] region_attribute: attribute '${attrName}' not found on region '${regionName}'`);
        }
        break;
      }

      case 'placement_lookup': {
        // Look up what item is placed at a specific location
        // Used by location_item_name helper to check item placements
        // Format: { type: 'placement_lookup', location: {...} }
        // Returns: [itemName, player] tuple or null if not found
        const locationName = evaluateRule(rule.location, context, depth + 1, localScope);

        if (typeof locationName !== 'string') {
          log('warn', '[evaluateRule] placement_lookup: location did not evaluate to string', { rule, locationName });
          result = null;
          break;
        }

        if (typeof context.getStaticData !== 'function') {
          log('warn', '[evaluateRule] placement_lookup: context.getStaticData not available');
          result = null;
          break;
        }

        const staticData = context.getStaticData();

        // Try locationItems Map first (this is the primary source)
        if (staticData?.locationItems) {
          const itemData = staticData.locationItems instanceof Map
            ? staticData.locationItems.get(locationName)
            : staticData.locationItems[locationName];

          if (itemData && itemData.name) {
            // Return as [itemName, player] tuple like Python's location_item_name
            result = [itemData.name, itemData.player || 1];
            break;
          }
        }

        // Fallback: search through regions for location data
        const regionsData = staticData?.regions;
        if (regionsData) {
          const regions = regionsData instanceof Map
            ? Array.from(regionsData.values())
            : Object.values(regionsData);

          for (const region of regions) {
            if (region?.locations) {
              const loc = region.locations.find(l => l.name === locationName);
              if (loc?.item?.name) {
                result = [loc.item.name, loc.item.player || 1];
                break;
              }
            }
          }
          if (result) break;
        }

        // Location not found or no item placed
        log('debug', `[evaluateRule] placement_lookup: no item found at location '${locationName}'`);
        result = null;
        break;
      }

      case 'placement_search': {
        // Search for an item across multiple locations
        // Used by item_name_in_location_names to check if an item is at any of the given locations
        // Format: { type: 'placement_search', item: {...}, player: {...}, locations: [...] }
        // Returns: true if item is found at any location, false otherwise
        const searchItem = evaluateRule(rule.item, context, depth + 1, localScope);
        const searchPlayer = evaluateRule(rule.player, context, depth + 1, localScope);
        const locations = evaluateRule(rule.locations, context, depth + 1, localScope);

        if (typeof searchItem !== 'string') {
          log('warn', '[evaluateRule] placement_search: item did not evaluate to string', { rule, searchItem });
          result = false;
          break;
        }

        if (!Array.isArray(locations)) {
          log('warn', '[evaluateRule] placement_search: locations is not an array', { rule, locations });
          result = false;
          break;
        }

        if (typeof context.getStaticData !== 'function') {
          log('warn', '[evaluateRule] placement_search: context.getStaticData not available');
          result = false;
          break;
        }

        const staticData = context.getStaticData();
        result = false;

        // Search through locations
        for (const locPair of locations) {
          if (!Array.isArray(locPair) || locPair.length < 2) continue;
          const [locName, locPlayer] = locPair;
          if (typeof locName !== 'string') continue;

          // Look up item at this location
          let itemData = null;
          if (staticData?.locationItems) {
            itemData = staticData.locationItems instanceof Map
              ? staticData.locationItems.get(locName)
              : staticData.locationItems[locName];
          }

          // Fallback: search regions
          if (!itemData?.name && staticData?.regions) {
            const regions = staticData.regions instanceof Map
              ? Array.from(staticData.regions.values())
              : Object.values(staticData.regions);

            for (const region of regions) {
              if (region?.locations) {
                const loc = region.locations.find(l => l.name === locName);
                if (loc?.item?.name) {
                  itemData = { name: loc.item.name, player: loc.item.player || 1 };
                  break;
                }
              }
            }
          }

          // Check if this is the item we're looking for
          if (itemData?.name === searchItem && itemData?.player === locPlayer) {
            result = true;
            break;
          }
        }
        break;
      }

      case 'capability': {
        // Handle capability rules - inferred rules that check if player has a certain capability
        // The capability name (e.g., "gain_lp_every_turn") corresponds to a helper function
        // with "can_" prefix (e.g., "can_gain_lp_every_turn")
        const capabilityName = rule.capability;
        if (!capabilityName) {
          log('warn', '[evaluateRule] Capability rule missing capability name', { rule });
          result = undefined;
          break;
        }

        // Convert capability name to helper function name
        // e.g., "gain_lp_every_turn" -> "can_gain_lp_every_turn"
        const helperName = `can_${capabilityName}`;

        if (!isValidContext || typeof context.executeHelper !== 'function') {
          log('warn', `[evaluateRule] Cannot execute capability helper '${helperName}' - invalid context`);
          result = undefined;
          break;
        }

        // Execute the helper function (capabilities typically don't have arguments)
        result = context.executeHelper(helperName);
        break;
      }

      // ========================================
      // Imperative rule types for complex helpers
      // ========================================

      case 'comparison':
      case 'compare': {
        // Handle comparison operations: ==, !=, <, <=, >, >=
        // Note: 'compare' is the type from Python analyzer, 'comparison' is the canonical name
        let left = evaluateRule(rule.left, context, depth + 1, localScope);
        let right = evaluateRule(rule.right, context, depth + 1, localScope);

        // Unwrap return markers from block expressions used as operands
        if (left && typeof left === 'object' && left.__isReturn) {
          left = left.value;
        }
        if (right && typeof right === 'object' && right.__isReturn) {
          right = right.value;
        }

        if (left === undefined || right === undefined) {
          result = undefined;
          break;
        }

        switch (rule.op) {
          case '==': result = left === right; break;
          case '!=': result = left !== right; break;
          case '<': result = left < right; break;
          case '<=': result = left <= right; break;
          case '>': result = left > right; break;
          case '>=': result = left >= right; break;
          default:
            log('warn', `[evaluateRule] Unknown comparison operator: ${rule.op}`);
            result = undefined;
        }
        break;
      }

      case 'binop':
      case 'binary_op': {
        // Handle binary arithmetic operations: +, -, *, /, //, %
        // Note: 'binary_op' is the type from Python analyzer, 'binop' is the canonical name
        let left = evaluateRule(rule.left, context, depth + 1, localScope);
        let right = evaluateRule(rule.right, context, depth + 1, localScope);

        // Unwrap return markers from block expressions used as operands
        if (left && typeof left === 'object' && left.__isReturn) {
          left = left.value;
        }
        if (right && typeof right === 'object' && right.__isReturn) {
          right = right.value;
        }

        if (left === undefined || right === undefined) {
          result = undefined;
          break;
        }

        switch (rule.op) {
          case '+': result = left + right; break;
          case '-': result = left - right; break;
          case '*': result = left * right; break;
          case '/': result = left / right; break;
          case '//': result = Math.floor(left / right); break;
          case '%': result = left % right; break;
          default:
            log('warn', `[evaluateRule] Unknown binary operator: ${rule.op}`);
            result = undefined;
        }
        break;
      }

      case 'min': {
        // Return the minimum of evaluated arguments or iterable (block scope version)
        if (rule.iterable) {
          const minIterableBlock = evaluateRule(rule.iterable, context, depth + 1, localScope);
          if (minIterableBlock === undefined) {
            result = undefined;
          } else if (Array.isArray(minIterableBlock)) {
            if (minIterableBlock.length === 0) {
              result = undefined;
            } else if (minIterableBlock.some((v) => v === undefined)) {
              result = undefined;
            } else {
              result = Math.min(...minIterableBlock);
            }
          } else if (typeof minIterableBlock === 'number') {
            result = minIterableBlock;
          } else {
            result = undefined;
          }
          break;
        }
        if (!rule.args || rule.args.length === 0) {
          result = undefined;
          break;
        }
        const minArgsBlock = rule.args.map((arg) =>
          evaluateRule(arg, context, depth + 1, localScope)
        );
        if (minArgsBlock.some((arg) => arg === undefined)) {
          result = undefined;
          break;
        }
        result = Math.min(...minArgsBlock);
        break;
      }

      case 'max': {
        // Return the maximum of evaluated arguments or iterable (block scope version)
        if (rule.iterable) {
          const maxIterableBlock = evaluateRule(rule.iterable, context, depth + 1, localScope);
          if (maxIterableBlock === undefined) {
            result = undefined;
          } else if (Array.isArray(maxIterableBlock)) {
            if (maxIterableBlock.length === 0) {
              result = undefined;
            } else if (maxIterableBlock.some((v) => v === undefined)) {
              result = undefined;
            } else {
              result = Math.max(...maxIterableBlock);
            }
          } else if (typeof maxIterableBlock === 'number') {
            result = maxIterableBlock;
          } else {
            result = undefined;
          }
          break;
        }
        if (!rule.args || rule.args.length === 0) {
          result = undefined;
          break;
        }
        const maxArgsBlock = rule.args.map((arg) =>
          evaluateRule(arg, context, depth + 1, localScope)
        );
        if (maxArgsBlock.some((arg) => arg === undefined)) {
          result = undefined;
          break;
        }
        result = Math.max(...maxArgsBlock);
        break;
      }

      case 'sum': {
        // Sum the values in an iterable (block scope version)
        // Rule structure: { type: 'sum', iterable: <rule>, start?: <rule> }
        if (!rule.iterable) {
          log('warn', '[evaluateRule] sum rule has no iterable', { rule });
          result = 0;
          break;
        }
        const sumIterableBlock = evaluateRule(rule.iterable, context, depth + 1, localScope);
        const startValueBlock = rule.start !== undefined
          ? evaluateRule(rule.start, context, depth + 1, localScope)
          : 0;

        if (sumIterableBlock === undefined) {
          result = undefined;
          break;
        }
        if (startValueBlock === undefined) {
          result = undefined;
          break;
        }
        if (Array.isArray(sumIterableBlock)) {
          if (sumIterableBlock.some((v) => v === undefined)) {
            result = undefined;
            break;
          }
          result = sumIterableBlock.reduce((acc, val) => {
            if (typeof val === 'number') {
              return acc + val;
            } else if (typeof val === 'boolean') {
              return acc + (val ? 1 : 0);
            }
            return acc;
          }, startValueBlock);
        } else if (typeof sumIterableBlock === 'number') {
          result = sumIterableBlock + startValueBlock;
        } else {
          log('warn', '[evaluateRule] sum iterable is not an array or number', { sumIterableBlock, rule });
          result = undefined;
        }
        break;
      }

      case 'negate': {
        // Unary minus operation: -value
        // Generated by Python exporter for non-constant negation
        const operand = evaluateRule(rule.operand, context, depth + 1, localScope);
        if (operand === undefined) {
          result = undefined;
        } else if (typeof operand === 'number') {
          result = -operand;
        } else {
          log('warn', '[evaluateRule] negate operand is not a number:', { operand, rule });
          result = undefined;
        }
        break;
      }

      case 'count_item': {
        // Get item count as a number (for use in arithmetic)
        // Unlike count_check which returns boolean, this returns the actual count
        const itemName = typeof rule.item === 'string'
          ? rule.item
          : evaluateRule(rule.item, context, depth + 1, localScope);

        if (itemName === undefined) {
          result = 0;
          break;
        }

        if (typeof context?.countItem === 'function') {
          result = context.countItem(itemName) || 0;
        } else {
          log('warn', '[evaluateRule] context.countItem not available for count_item');
          result = 0;
        }
        break;
      }

      case 'block': {
        // Execute a sequence of statements
        // Returns the value of a 'return' statement if encountered,
        // otherwise returns the value of the last statement
        if (!Array.isArray(rule.statements)) {
          result = undefined;
          break;
        }

        // Use parent scope directly for Python-like scoping semantics
        // In Python, blocks don't create a new scope - variables assigned
        // in a block are visible in the enclosing function scope.
        // This is needed for worldgen rules where blocks assign variables
        // that are referenced later in the same function.
        const isTopLevelBlock = localScope === null;
        const blockScope = isTopLevelBlock ? {} : localScope;

        for (let i = 0; i < rule.statements.length; i++) {
          const stmt = rule.statements[i];
          const stmtResult = evaluateRule(stmt, context, depth + 1, blockScope);

          // Check for early return (marked with __isReturn)
          if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isReturn) {
            result = stmtResult; // Propagate the return marker up
            break;
          }
          result = stmtResult;
        }

        // If this is a top-level block, unwrap the return value
        // Nested blocks keep the marker so outer blocks can propagate
        if (isTopLevelBlock && result && typeof result === 'object' && result.__isReturn) {
          result = result.value;
        }
        break;
      }

      case 'assign': {
        // Assign a value to a local variable
        // Supports simple assignment and compound operators (+=, -=, *=, /=)
        // Accepts both 'var' (from analyzer) and 'name' (legacy) for variable name
        const varName = rule.var || rule.name;
        if (!varName) {
          result = undefined;
          break;
        }

        // Ensure we have a scope to work with
        if (localScope === null) {
          log('warn', '[evaluateRule] assign used without local scope');
          result = undefined;
          break;
        }

        let value = evaluateRule(rule.value, context, depth + 1, localScope);

        // Unwrap return marker if block was used as expression
        if (value && typeof value === 'object' && value.__isReturn) {
          value = value.value;
        }

        if (rule.op && rule.op !== '=') {
          // Compound assignment
          const currentVal = localScope[varName] || 0;
          switch (rule.op) {
            case '+=': localScope[varName] = currentVal + value; break;
            case '-=': localScope[varName] = currentVal - value; break;
            case '*=': localScope[varName] = currentVal * value; break;
            case '/=': localScope[varName] = currentVal / value; break;
            default:
              log('warn', `[evaluateRule] Unknown assignment operator: ${rule.op}`);
              localScope[varName] = value;
          }
        } else {
          // Simple assignment
          localScope[varName] = value;
        }
        result = localScope[varName];
        break;
      }

      case 'return': {
        // Early return from a block
        // Uses a marker object to propagate the return value up
        const returnValue = evaluateRule(rule.value, context, depth + 1, localScope);
        result = { __isReturn: true, value: returnValue };
        break;
      }

      case 'for_range': {
        // Execute a loop body a specified number of times
        // Supports two formats:
        // 1. count-based: { count: N } - iterates 0 to N-1
        // 2. range-based: { start: S, end: E } - iterates S to E-1 (Python range style)
        let startVal = 0;
        let endVal;

        if (rule.start !== undefined && rule.end !== undefined) {
          // Range-based format (from Python analyzer)
          startVal = typeof rule.start === 'number'
            ? rule.start
            : evaluateRule(rule.start, context, depth + 1, localScope);
          endVal = typeof rule.end === 'number'
            ? rule.end
            : evaluateRule(rule.end, context, depth + 1, localScope);
        } else {
          // Count-based format (legacy)
          const count = typeof rule.count === 'number'
            ? rule.count
            : evaluateRule(rule.count, context, depth + 1, localScope);
          endVal = count;
        }

        if (typeof startVal !== 'number' || typeof endVal !== 'number' ||
            !Number.isFinite(startVal) || !Number.isFinite(endVal)) {
          result = undefined;
          break;
        }

        // Ensure we have a scope
        if (localScope === null) {
          log('warn', '[evaluateRule] for_range used without local scope');
          result = undefined;
          break;
        }

        // Limit iterations to prevent infinite loops
        const iterations = endVal - startVal;
        const maxIterations = Math.min(iterations, 1000);
        if (iterations > 1000) {
          log('warn', `[evaluateRule] for_range iterations ${iterations} limited to 1000`);
        }

        let breakLoop = false;
        for (let i = startVal; i < startVal + maxIterations && !breakLoop; i++) {
          // Set loop variable if specified (and not '_')
          if (rule.var && rule.var !== '_') {
            localScope[rule.var] = i;
          }

          // Execute body statements
          if (Array.isArray(rule.body)) {
            for (const stmt of rule.body) {
              const stmtResult = evaluateRule(stmt, context, depth + 1, localScope);

              // Check for early return
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isReturn) {
                result = stmtResult;
                breakLoop = true;
                break;
              }
              // Check for break
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isBreak) {
                breakLoop = true;
                break;
              }
              // Check for continue
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isContinue) {
                break; // break inner loop, continue outer loop
              }
            }
          }
        }

        // for loops don't return a value unless there was an early return
        if (!(result && typeof result === 'object' && result.__isReturn)) {
          result = undefined;
        }
        break;
      }

      case 'for_iter': {
        // Execute a loop body for each item in an iterable
        const iterable = evaluateRule(rule.iterable, context, depth + 1, localScope);

        if (!Array.isArray(iterable)) {
          log('warn', `[evaluateRule] for_iter: iterable is not an array: ${typeof iterable}`);
          result = undefined;
          break;
        }

        // Ensure we have a scope
        if (localScope === null) {
          log('warn', '[evaluateRule] for_iter used without local scope');
          result = undefined;
          break;
        }

        // Limit iterations to prevent infinite loops
        const maxIterations = Math.min(iterable.length, 1000);
        if (iterable.length > 1000) {
          log('warn', `[evaluateRule] for_iter iterable length ${iterable.length} limited to 1000`);
        }

        let breakIterLoop = false;
        for (let i = 0; i < maxIterations && !breakIterLoop; i++) {
          const item = iterable[i];

          // Set loop variable(s) - support both single var and tuple unpacking (vars)
          if (rule.vars && Array.isArray(rule.vars)) {
            // Tuple unpacking: item should be an array [val1, val2, ...]
            // This handles patterns like: for key, value in dict.items()
            if (Array.isArray(item)) {
              rule.vars.forEach((varName, idx) => {
                if (varName !== '_') {
                  localScope[varName] = item[idx];
                }
              });
            } else {
              // If item is not an array but we expected tuple unpacking, log warning
              log('warn', `[evaluateRule] for_iter: expected array item for tuple unpacking, got ${typeof item}`);
            }
          } else if (rule.var && rule.var !== '_') {
            localScope[rule.var] = item;
          }

          // Execute body statements
          if (Array.isArray(rule.body)) {
            for (const stmt of rule.body) {
              const stmtResult = evaluateRule(stmt, context, depth + 1, localScope);

              // Check for early return
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isReturn) {
                result = stmtResult;
                breakIterLoop = true;
                break;
              }
              // Check for break
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isBreak) {
                breakIterLoop = true;
                break;
              }
              // Check for continue
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isContinue) {
                break; // break inner loop, continue outer loop
              }
            }
          }
        }

        // for loops don't return a value unless there was an early return
        if (!(result && typeof result === 'object' && result.__isReturn)) {
          result = undefined;
        }
        break;
      }

      case 'while_loop': {
        // Execute a loop body while condition is true
        // Similar to for_iter but with a condition check instead of iteration

        // Ensure we have a scope
        if (localScope === null) {
          log('warn', '[evaluateRule] while_loop used without local scope');
          result = undefined;
          break;
        }

        // Limit iterations to prevent infinite loops
        const maxWhileIterations = 1000;
        let whileIterCount = 0;
        let breakWhileLoop = false;

        while (!breakWhileLoop && whileIterCount < maxWhileIterations) {
          // Evaluate condition each iteration
          const conditionResult = evaluateRule(rule.condition, context, depth + 1, localScope);

          // If condition is false or undefined, exit loop
          if (!conditionResult) {
            break;
          }

          whileIterCount++;

          // Execute body statements
          if (Array.isArray(rule.body)) {
            for (const stmt of rule.body) {
              const stmtResult = evaluateRule(stmt, context, depth + 1, localScope);

              // Check for early return
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isReturn) {
                result = stmtResult;
                breakWhileLoop = true;
                break;
              }
              // Check for break
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isBreak) {
                breakWhileLoop = true;
                break;
              }
              // Check for continue
              if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isContinue) {
                break; // break inner loop, continue outer while loop
              }
            }
          }
        }

        if (whileIterCount >= maxWhileIterations) {
          log('warn', `[evaluateRule] while_loop exceeded max iterations (${maxWhileIterations})`);
        }

        // Handle orelse clause (Python's else on while loop - runs if loop completes normally)
        if (!breakWhileLoop && Array.isArray(rule.orelse)) {
          for (const stmt of rule.orelse) {
            const stmtResult = evaluateRule(stmt, context, depth + 1, localScope);
            if (stmtResult && typeof stmtResult === 'object' && stmtResult.__isReturn) {
              result = stmtResult;
              break;
            }
          }
        }

        // while loops don't return a value unless there was an early return
        if (!(result && typeof result === 'object' && result.__isReturn)) {
          result = undefined;
        }
        break;
      }

      case 'break': {
        // Signal to break out of the enclosing loop
        result = { __isBreak: true };
        break;
      }

      case 'continue': {
        // Signal to continue to next iteration of the enclosing loop
        result = { __isContinue: true };
        break;
      }

      case 'if_statement': {
        // Execute body or orelse statements based on test condition
        let testResult = evaluateRule(rule.test, context, depth + 1, localScope);

        // Unwrap return marker if block was used as test expression
        if (testResult && typeof testResult === 'object' && testResult.__isReturn) {
          testResult = testResult.value;
        }

        if (testResult === undefined) {
          result = undefined;
          break;
        }

        const statementsToExecute = testResult ? rule.body : rule.orelse;

        if (Array.isArray(statementsToExecute)) {
          for (const stmt of statementsToExecute) {
            const stmtResult = evaluateRule(stmt, context, depth + 1, localScope);

            // Propagate control flow signals
            if (stmtResult && typeof stmtResult === 'object') {
              if (stmtResult.__isReturn || stmtResult.__isBreak || stmtResult.__isContinue) {
                result = stmtResult;
                break;
              }
            }
          }
        }

        // if_statement doesn't return a value unless there was a control flow signal
        if (!(result && typeof result === 'object' &&
              (result.__isReturn || result.__isBreak || result.__isContinue))) {
          result = undefined;
        }
        break;
      }

      case 'index':
      case 'subscript': {
        // Array/list indexing: obj[index]
        // Note: 'subscript' is the type from Python analyzer, 'index' is the canonical name
        // subscript uses 'value' for object, index uses 'object'
        const obj = evaluateRule(rule.object || rule.value, context, depth + 1, localScope);
        const idx = evaluateRule(rule.index, context, depth + 1, localScope);

        if (obj === undefined || idx === undefined) {
          result = undefined;
        } else if (Array.isArray(obj)) {
          result = obj[idx];
        } else if (typeof obj === 'object' && obj !== null) {
          result = obj[idx];
        } else if (typeof obj === 'string') {
          result = obj[idx];
        } else {
          result = undefined;
        }
        break;
      }

      case 'method_call': {
        // Method call on an object: obj.method(args)
        const obj = evaluateRule(rule.object, context, depth + 1, localScope);
        const args = (rule.args || []).map(arg =>
          evaluateRule(arg, context, depth + 1, localScope)
        );

        if (obj === undefined) {
          result = undefined;
          break;
        }

        // Handle common array/list methods
        if (Array.isArray(obj)) {
          switch (rule.method) {
            case 'index':
              // list.index(value) - returns index of first occurrence
              result = obj.indexOf(args[0]);
              break;
            case 'count':
              // list.count(value) - count occurrences
              result = obj.filter(x => x === args[0]).length;
              break;
            case '__contains__':
              // value in list
              result = obj.includes(args[0]);
              break;
            default:
              log('warn', `[evaluateRule] Unknown array method: ${rule.method}`);
              result = undefined;
          }
        } else if (typeof obj === 'string') {
          switch (rule.method) {
            case 'index':
              result = obj.indexOf(args[0]);
              break;
            case '__contains__':
              result = obj.includes(args[0]);
              break;
            case 'capitalize':
              // Python's capitalize: first char uppercase, rest lowercase
              result = obj.length > 0 ? obj.charAt(0).toUpperCase() + obj.slice(1).toLowerCase() : '';
              break;
            case 'upper':
              result = obj.toUpperCase();
              break;
            case 'lower':
              result = obj.toLowerCase();
              break;
            case 'strip':
              result = obj.trim();
              break;
            case 'startswith':
              result = obj.startsWith(args[0]);
              break;
            case 'endswith':
              result = obj.endsWith(args[0]);
              break;
            default:
              log('warn', `[evaluateRule] Unknown string method: ${rule.method}`);
              result = undefined;
          }
        } else if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
          // Handle dict/object methods
          switch (rule.method) {
            case 'items':
              // dict.items() - returns array of [key, value] pairs
              result = Object.entries(obj);
              break;
            case 'keys':
              // dict.keys() - returns array of keys
              result = Object.keys(obj);
              break;
            case 'values':
              // dict.values() - returns array of values
              result = Object.values(obj);
              break;
            case 'get':
              // dict.get(key, default) - get value with optional default
              result = obj.hasOwnProperty(args[0]) ? obj[args[0]] : (args[1] !== undefined ? args[1] : null);
              break;
            case '__contains__':
              // key in dict
              result = Object.prototype.hasOwnProperty.call(obj, args[0]);
              break;
            default:
              log('warn', `[evaluateRule] Unknown dict method: ${rule.method}`);
              result = undefined;
          }
        } else {
          log('warn', `[evaluateRule] method_call on unsupported type: ${typeof obj}`);
          result = undefined;
        }
        break;
      }

      default: {
        log('warn', `[evaluateRule] Unknown rule type: ${ruleType}`, { rule });
        result = undefined;
        break;
      }
    }
  } catch (error) {
    log('error', '[evaluateRule] Error during evaluation:', {
      ruleType,
      rule,
      error,
      contextType: typeof context,
      isSnapshot: isValidContext,
    });
    result = undefined;
  }

  // At depth 0 (top-level rule), unwrap return markers from block rules
  // Block rules with return statements produce {__isReturn: true, value: X}
  // which needs to be unwrapped to get the actual value
  // Note: This MUST only happen at depth 0 to preserve nested block return behavior
  if (depth === 0 && result && typeof result === 'object' && result.__isReturn) {
    result = result.value;
  }

  // At depth 0 (top-level rule), convert SMBool to boolean with difficulty check
  // This ensures difficulty is properly checked against maxDiff for SM games
  // when the top-level rule is 'and', 'or', or any rule type returning SMBool
  if (depth === 0 && result && typeof result === 'object' && 'bool' in result && 'difficulty' in result) {
    let maxDiff = 50; // Default to hardcore for Super Metroid
    if (typeof context?.getPlayerId === 'function' && typeof context?.resolveName === 'function') {
      const playerId = context.getPlayerId();
      const state = context.resolveName('state');
      if (state?.smbm?.[playerId]?.maxDiff !== undefined) {
        maxDiff = state.smbm[playerId].maxDiff;
      }
    }
    result = result.bool === true && result.difficulty <= maxDiff;
  }

  return result;
};

/**
 * Evaluate a rule in Rule Builder format.
 *
 * Rule Builder format uses {"rule": "RuleName", "options": [], "args": {...}} or
 * {"rule": "And/Or", "options": [], "children": [...]} for composite rules.
 *
 * This provides native support for Rule Builder rules without converting to AST format.
 *
 * @param {Object} rule - Rule in Rule Builder format
 * @param {Object} context - The snapshot interface for evaluation
 * @param {number} depth - Current recursion depth
 * @param {Object|null} localScope - Local scope for parameter resolution
 * @returns {*} The evaluation result (typically boolean)
 */
function evaluateRuleBuilderRule(rule, context, depth, localScope) {
  const ruleName = rule.rule;
  const args = rule.args || {};
  const children = rule.children || [];
  const child = rule.child;

  // Log at debug level
  if (depth < 3) {
    log('debug', `[evaluateRuleBuilderRule] Evaluating ${ruleName}`, { args, childCount: children.length });
  }

  switch (ruleName) {
    // Boolean literals
    case 'True_':
      return true;

    case 'False_':
      return false;

    // Constant value (from converted AST format)
    case 'Constant':
      return args.value;

    // List value (from converted AST format)
    case 'List': {
      const listValue = args.value || [];
      // Evaluate each element in the list
      return listValue.map(item => evaluateRule(item, context, depth + 1, localScope));
    }

    // CountCheck (from converted AST format) - check if player has at least N of an item
    case 'CountCheck': {
      const itemName = args.item;
      let count = args.count;
      // Evaluate count if it's a rule object
      if (count && typeof count === 'object' && (count.type || count.rule)) {
        count = evaluateRule(count, context, depth + 1, localScope);
      }
      count = count ?? 1;
      return evaluateRule({ type: 'count_check', item: itemName, count }, context, depth + 1, localScope);
    }

    // AST_placement_lookup (from converted AST format) - look up what item is at a location
    case 'AST_placement_lookup': {
      let locationName = args.location;
      // Evaluate location if it's a rule object
      if (locationName && typeof locationName === 'object' && (locationName.type || locationName.rule)) {
        locationName = evaluateRule(locationName, context, depth + 1, localScope);
      } else if (locationName && typeof locationName === 'object' && locationName.type === 'constant') {
        locationName = locationName.value;
      }
      // Get the item placed at this location
      if (typeof context?.getLocationItem === 'function') {
        const item = context.getLocationItem(locationName);
        if (item) {
          // Return [item_name, player] tuple for comparison
          return [item.name || item.item, item.player || 1];
        }
      }
      return undefined;
    }

    // AST_placement_search (from converted AST format) - search for an item at specific locations
    // Returns true if the item is found at any of the locations, false otherwise
    case 'AST_placement_search': {
      // Evaluate item name
      let searchItem = args.item;
      if (searchItem && typeof searchItem === 'object' && (searchItem.type || searchItem.rule)) {
        searchItem = evaluateRule(searchItem, context, depth + 1, localScope);
      }

      // Evaluate player
      let searchPlayer = args.player;
      if (searchPlayer && typeof searchPlayer === 'object' && (searchPlayer.type || searchPlayer.rule)) {
        searchPlayer = evaluateRule(searchPlayer, context, depth + 1, localScope);
      }
      searchPlayer = searchPlayer ?? 1;

      // Evaluate locations list
      let locations = args.locations;
      if (locations && typeof locations === 'object') {
        if (locations.type === 'constant') {
          locations = locations.value;
        } else if (locations.type === 'list' && Array.isArray(locations.value)) {
          // Recursively evaluate list items
          locations = locations.value.map(item => {
            if (item && typeof item === 'object' && (item.type || item.rule)) {
              return evaluateRule(item, context, depth + 1, localScope);
            }
            return item;
          });
        } else if (locations.type || locations.rule) {
          locations = evaluateRule(locations, context, depth + 1, localScope);
        }
      }

      if (!Array.isArray(locations) || !searchItem) {
        return undefined;
      }

      // Search each location for the item
      for (const locEntry of locations) {
        let locName, locPlayer;
        if (Array.isArray(locEntry)) {
          [locName, locPlayer] = locEntry;
        } else if (locEntry && typeof locEntry === 'object') {
          locName = locEntry.location || locEntry.name;
          locPlayer = locEntry.player ?? 1;
        } else {
          continue;
        }

        locPlayer = locPlayer ?? 1;

        // Get the item at this location
        if (typeof context?.getLocationItem === 'function') {
          const foundItem = context.getLocationItem(locName);
          if (foundItem) {
            const itemName = foundItem.name || foundItem.item;
            const itemPlayer = foundItem.player || 1;
            // Check if this matches what we're searching for
            if (itemName === searchItem && itemPlayer === searchPlayer) {
              return true;
            }
          }
        }
      }

      return false;
    }

    // AST_function_call (from converted AST format) - evaluate a function call like boss.can_defeat()
    case 'AST_function_call': {
      // Convert Rule Builder format to legacy function_call format
      // Structure: { rule: 'AST_function_call', args: { function: {...}, args: [...], _original_ast_type: 'function_call' } }
      const funcExpr = args.function;
      const funcArgs = args.args || [];

      // Build the legacy format and evaluate it
      return evaluateRule({
        type: 'function_call',
        function: funcExpr,
        args: funcArgs
      }, context, depth + 1, localScope);
    }

    // Item check: Has(item_name, count)
    case 'Has': {
      const itemName = args.item_name;
      const count = args.count ?? 1;
      if (!itemName) {
        log('warn', '[evaluateRuleBuilderRule] Has rule missing item_name');
        return undefined;
      }
      // Delegate to AST format evaluation
      return evaluateRule({ type: 'item_check', item: itemName, count }, context, depth + 1, localScope);
    }

    // HasAll: all items required (AND of Has checks)
    case 'HasAll': {
      // Support both "items" (from Resolved._get_args_dict) and "item_names" (from Rule.to_dict)
      const items = args.items || args.item_names || children.map(c => c.args?.item_name).filter(Boolean);
      if (!items || items.length === 0) {
        return true; // Empty AND is true
      }
      for (const item of items) {
        const result = evaluateRule({ type: 'item_check', item, count: 1 }, context, depth + 1, localScope);
        if (result === false) return false;
        if (result === undefined) return undefined;
      }
      return true;
    }

    // HasAny: any item required (OR of Has checks)
    case 'HasAny': {
      // Support both "items" (from Resolved._get_args_dict) and "item_names" (from Rule.to_dict)
      const items = args.items || args.item_names || children.map(c => c.args?.item_name).filter(Boolean);
      if (!items || items.length === 0) {
        return false; // Empty OR is false
      }
      let hasUndefined = false;
      for (const item of items) {
        const result = evaluateRule({ type: 'item_check', item, count: 1 }, context, depth + 1, localScope);
        if (result === true) return true;
        if (result === undefined) hasUndefined = true;
      }
      return hasUndefined ? undefined : false;
    }

    // HasAllCounts: all items with specific counts
    case 'HasAllCounts': {
      // Support both Rule Builder format (items) and legacy format (item_counts)
      const itemCounts = args.items || args.item_counts || {};
      for (const [item, count] of Object.entries(itemCounts)) {
        const result = evaluateRule({ type: 'item_check', item, count }, context, depth + 1, localScope);
        if (result === false) return false;
        if (result === undefined) return undefined;
      }
      return true;
    }

    // HasAnyCount: any item with specific count
    case 'HasAnyCount': {
      // Support both Rule Builder format (items) and legacy format (item_counts)
      const itemCounts = args.items || args.item_counts || {};
      let hasUndefined = false;
      for (const [item, count] of Object.entries(itemCounts)) {
        const result = evaluateRule({ type: 'item_check', item, count }, context, depth + 1, localScope);
        if (result === true) return true;
        if (result === undefined) hasUndefined = true;
      }
      return hasUndefined ? undefined : false;
    }

    // HasFromList: N items from a list (sums total item counts)
    // Python: found += player_prog_items[item_name] for each item
    case 'HasFromList': {
      // Support both "items" (from Resolved._get_args_dict) and "item_names" (from Rule.to_dict)
      const items = args.items || args.item_names || [];
      const count = args.count ?? 1;
      let found = 0;
      // Sum the count of each item (not just presence)
      for (const item of items) {
        if (typeof context.countItem === 'function') {
          found += context.countItem(item) || 0;
        } else {
          // Fallback: check presence only
          const result = evaluateRule({ type: 'item_check', item, count: 1 }, context, depth + 1, localScope);
          if (result === true) found++;
        }
        if (found >= count) return true;
      }
      return found >= count;
    }

    // HasFromListUnique: N unique items from a list
    case 'HasFromListUnique': {
      // Support both "items" (from Resolved._get_args_dict) and "item_names" (from Rule.to_dict)
      const items = args.items || args.item_names || [];
      const count = args.count ?? 1;
      let found = 0;
      let hasUndefined = false;
      for (const item of items) {
        const result = evaluateRule({ type: 'item_check', item, count: 1 }, context, depth + 1, localScope);
        if (result === true) {
          found++;
          if (found >= count) return true;
        } else if (result === undefined) {
          hasUndefined = true;
        }
      }
      if (hasUndefined && found < count) return undefined;
      return found >= count;
    }

    // HasGroup: items from an item group
    case 'HasGroup': {
      // Support both "group" (from Resolved._get_args_dict) and "item_name_group" (from Rule.to_dict)
      const groupName = args.group || args.item_name_group;
      const count = args.count ?? 1;
      return evaluateRule({ type: 'group_check', group: groupName, count }, context, depth + 1, localScope);
    }

    // HasGroupUnique: unique items from an item group
    case 'HasGroupUnique': {
      // Support both "group" (from Resolved._get_args_dict) and "item_name_group" (from Rule.to_dict)
      const groupName = args.group || args.item_name_group;
      const count = args.count ?? 1;
      // For unique, we use the same group_check - the semantics are handled by the group logic
      return evaluateRule({ type: 'group_check', group: groupName, count }, context, depth + 1, localScope);
    }

    // Composite rules: And
    case 'And': {
      if (children.length === 0) return true;
      let hasUndefined = false;
      let hasSMBool = false;
      let totalDifficulty = 0;
      for (const childRule of children) {
        let result = evaluateRule(childRule, context, depth + 1, localScope);
        // Handle SMBool objects from SM helpers - extract bool property and accumulate difficulty
        let boolValue = result;
        if (result && typeof result === 'object' && 'bool' in result) {
          boolValue = result.bool;
          hasSMBool = true;
          totalDifficulty += result.difficulty || 0;
        }
        // Check for falsy values (false, 0, "", null) but not undefined
        // Use !boolValue to catch all falsy values including 0, not just === false
        if (!boolValue && boolValue !== undefined) return false;
        if (boolValue === undefined) hasUndefined = true;
      }
      if (hasUndefined) return undefined;
      // If any child was SMBool, return SMBool with accumulated difficulty
      if (hasSMBool) {
        return { bool: true, difficulty: totalDifficulty };
      }
      return true;
    }

    // Composite rules: Or
    case 'Or': {
      if (children.length === 0) return false;
      let hasUndefined = false;
      let hasSMBool = false;
      let minDifficulty = Infinity;
      for (const childRule of children) {
        let result = evaluateRule(childRule, context, depth + 1, localScope);
        // Handle SMBool objects from SM helpers - extract bool property and track min difficulty
        let boolValue = result;
        if (result && typeof result === 'object' && 'bool' in result) {
          boolValue = result.bool;
          hasSMBool = true;
          // Track min difficulty for truthy SMBool results
          if (boolValue && (result.difficulty || 0) < minDifficulty) {
            minDifficulty = result.difficulty || 0;
          }
        }
        // Check for truthy values (not just === true) but exclude undefined
        if (boolValue && boolValue !== undefined) {
          // For Or, return immediately with the min difficulty seen so far
          if (hasSMBool) {
            return { bool: true, difficulty: minDifficulty };
          }
          return true;
        }
        if (boolValue === undefined) hasUndefined = true;
      }
      return hasUndefined ? undefined : false;
    }

    // Conditional: ternary rule (test ? if_true : if_false)
    // Rule Builder: {"rule": "Conditional", "args": {"test": {...}, "if_true": {...}, "if_false": {...}}}
    case 'Conditional': {
      const testRule = args.test;
      const ifTrueRule = args.if_true;
      const ifFalseRule = args.if_false;

      if (!testRule) {
        log('warn', '[evaluateRuleBuilderRule] Conditional rule missing test');
        return undefined;
      }

      const testResult = evaluateRule(testRule, context, depth + 1, localScope);

      if (testResult === undefined) {
        // If test is unknown, outcome is unknown
        return undefined;
      } else if (testResult) {
        // Test is truthy - evaluate if_true branch
        return ifTrueRule
          ? evaluateRule(ifTrueRule, context, depth + 1, localScope)
          : true;
      } else {
        // Test is falsy - evaluate if_false branch
        return ifFalseRule
          ? evaluateRule(ifFalseRule, context, depth + 1, localScope)
          : false;
      }
    }

    // Wrapper rules: Not (inverts child)
    case 'Not': {
      // Support both 'child' key and 'args.condition' (from converted AST format)
      const notChild = child || args.condition;
      if (!notChild) {
        log('warn', '[evaluateRuleBuilderRule] Not rule missing child/condition');
        return undefined;
      }
      const result = evaluateRule(notChild, context, depth + 1, localScope);
      if (result === undefined) return undefined;
      return !result;
    }

    // Setting value lookup (from converted AST format)
    case 'AST_setting_value': {
      const settingName = args.setting;
      if (typeof context?.getSetting === 'function') {
        return context.getSetting(settingName);
      }
      return undefined;
    }

    // Location rule reference (from converted AST format) - evaluate another location's access rule
    case 'AST_location_rule_ref': {
      const locationName = args.location;
      // Check if the location is accessible
      if (typeof context?.isLocationAccessible === 'function') {
        const result = context.isLocationAccessible(locationName);
        return result === 'reachable' || result === true;
      }
      return undefined;
    }

    // Reachability rules
    case 'CanReachRegion': {
      const regionName = args.region_name;
      return evaluateRule({ type: 'can_reach', region: regionName }, context, depth + 1, localScope);
    }

    case 'CanReachLocation': {
      const locationName = args.location_name;
      return evaluateRule({ type: 'location_check', location: locationName }, context, depth + 1, localScope);
    }

    case 'CanReachEntrance': {
      const entranceName = args.entrance_name;
      return evaluateRule({ type: 'can_reach_entrance', entrance: entranceName }, context, depth + 1, localScope);
    }

    // Wrapper rule with filter (option-based filtering)
    case 'Filtered': {
      // For now, just evaluate the child - option filtering is typically world-level
      if (!child) {
        log('warn', '[evaluateRuleBuilderRule] Filtered rule missing child');
        return undefined;
      }
      return evaluateRule(child, context, depth + 1, localScope);
    }

    // HelperCall: Rule Builder rule that wraps a helper function
    // The body_data contains the AST format rule to evaluate
    case 'HelperCall': {
      const bodyData = args.body_data;
      if (bodyData) {
        // Check if body_data has params wrapper: {params: [...], body: {...}}
        if (bodyData.params && bodyData.body) {
          const params = bodyData.params;
          const helperArgs = args.args || [];
          const defaults = bodyData.defaults || {};
          let helperLocalScope = localScope ? { ...localScope } : {};

          // Bind arguments to parameter names, using defaults for missing params
          for (let i = 0; i < params.length; i++) {
            const paramName = params[i];
            let argValue;

            if (i < helperArgs.length) {
              argValue = helperArgs[i];
              // Only evaluate as a rule if it's an object with 'type' or 'rule' key
              // Plain values (primitives, arrays, plain objects) should be used directly
              if (argValue && typeof argValue === 'object' && !Array.isArray(argValue) && (argValue.type || argValue.rule)) {
                argValue = evaluateRule(argValue, context, depth + 1, localScope);
              }
            } else if (defaults[paramName] !== undefined) {
              // Use default value from body_data.defaults
              argValue = defaults[paramName];
            } else {
              // No default provided - use 1 as common default for quantity-like params
              // This matches Python's common default patterns (quantity=1, count=1)
              argValue = 1;
            }

            helperLocalScope[paramName] = argValue;
          }

          let result = evaluateRule(bodyData.body, context, depth + 1, helperLocalScope);
          // Unwrap return marker if present
          if (result && typeof result === 'object' && result.__isReturn) {
            result = result.value;
          }
          return result;
        }
        // No params wrapper - evaluate body_data directly
        return evaluateRule(bodyData, context, depth + 1, localScope);
      }
      // No body_data - try evaluating as a CC helper with the helper name
      const helperName = args.helper_name;
      if (helperName) {
        const helperArgs = args.args || [];
        return evaluateRule({ type: 'helper', name: helperName, args: helperArgs }, context, depth + 1, localScope);
      }
      log('warn', '[evaluateRuleBuilderRule] HelperCall missing both body_data and helper_name');
      return undefined;
    }

    // Compare: comparison between two values
    // Rule Builder: {"rule": "Compare", "args": {"left": ..., "op": ">=", "right": ...}}
    case 'Compare': {
      const left = args.left;
      const op = args.op || '==';
      const right = args.right;

      // Recursively evaluate left and right operands
      const leftValue = evaluateRule(left, context, depth + 1, localScope);
      const rightValue = evaluateRule(right, context, depth + 1, localScope);

      // If either operand is undefined, we can't compare
      if (leftValue === undefined || rightValue === undefined) {
        return undefined;
      }

      // Perform the comparison
      switch (op) {
        case '==':
        case 'eq':
          // Handle array comparison by value (JS === compares by reference)
          if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
            return leftValue.length === rightValue.length &&
                   leftValue.every((val, index) => val === rightValue[index]);
          }
          return leftValue === rightValue;
        case '!=':
        case 'ne':
          // Handle array comparison by value
          if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
            return leftValue.length !== rightValue.length ||
                   leftValue.some((val, index) => val !== rightValue[index]);
          }
          return leftValue !== rightValue;
        case '<':
        case 'lt':
          return leftValue < rightValue;
        case '<=':
        case 'le':
          return leftValue <= rightValue;
        case '>':
        case 'gt':
          return leftValue > rightValue;
        case '>=':
        case 'ge':
          return leftValue >= rightValue;
        case 'in':
          // Check if leftValue is in rightValue (array)
          if (Array.isArray(rightValue)) {
            // Handle array comparison with deep equality for nested arrays
            if (Array.isArray(leftValue)) {
              return rightValue.some(item => {
                if (Array.isArray(item)) {
                  // Deep array comparison
                  return item.length === leftValue.length &&
                         item.every((val, index) => val === leftValue[index]);
                }
                return item === leftValue;
              });
            }
            return rightValue.includes(leftValue);
          }
          if (typeof rightValue === 'string') {
            return rightValue.includes(leftValue);
          }
          return false;
        case 'not in':
          // Negate the 'in' check
          if (Array.isArray(rightValue)) {
            if (Array.isArray(leftValue)) {
              return !rightValue.some(item => {
                if (Array.isArray(item)) {
                  return item.length === leftValue.length &&
                         item.every((val, index) => val === leftValue[index]);
                }
                return item === leftValue;
              });
            }
            return !rightValue.includes(leftValue);
          }
          if (typeof rightValue === 'string') {
            return !rightValue.includes(leftValue);
          }
          return true;
        default:
          log('warn', `[evaluateRuleBuilderRule] Unknown Compare operator '${op}'`);
          return undefined;
      }
    }

    // Arithmetic: arithmetic operation between two values
    // Rule Builder: {"rule": "Arithmetic", "args": {"left": ..., "op": "+", "right": ...}}
    case 'Arithmetic': {
      const left = args.left;
      const op = args.op || '+';
      const right = args.right;

      // Recursively evaluate operands
      const leftValue = evaluateRule(left, context, depth + 1, localScope);
      const rightValue = evaluateRule(right, context, depth + 1, localScope);

      // If either operand is undefined, we can't compute
      if (leftValue === undefined || rightValue === undefined) {
        return undefined;
      }

      // Perform the arithmetic operation
      switch (op) {
        case '+':
          return leftValue + rightValue;
        case '-':
          return leftValue - rightValue;
        case '*':
          return leftValue * rightValue;
        case '/':
          return rightValue !== 0 ? leftValue / rightValue : undefined;
        case '//':
          return rightValue !== 0 ? Math.floor(leftValue / rightValue) : undefined;
        case '%':
          return rightValue !== 0 ? leftValue % rightValue : undefined;
        case '**':
          return Math.pow(leftValue, rightValue);
        default:
          log('warn', `[evaluateRuleBuilderRule] Unknown Arithmetic operator '${op}'`);
          return undefined;
      }
    }

    // MinValue: returns the minimum of two values (used to cap item contributions)
    // Rule Builder: {"rule": "MinValue", "args": {"left": ..., "right": ...}}
    case 'MinValue': {
      const left = args.left;
      const right = args.right;

      // Recursively evaluate operands
      const leftValue = evaluateRule(left, context, depth + 1, localScope);
      const rightValue = evaluateRule(right, context, depth + 1, localScope);

      // If either operand is undefined, we can't compute
      if (leftValue === undefined || rightValue === undefined) {
        return undefined;
      }

      return Math.min(leftValue, rightValue);
    }

    // Count/CountItem: get the count of an item (used as operand in Compare/Arithmetic)
    // Rule Builder: {"rule": "Count", "args": {"item_name": "Key"}}
    // Rule Builder: {"rule": "CountItem", "args": {"item_name": "Key"}}
    case 'Count':
    case 'CountItem': {
      const itemName = args.item_name;
      if (!itemName) {
        log('warn', '[evaluateRuleBuilderRule] Count rule missing item_name');
        return 0;
      }
      // Use countItem if available, otherwise fall back to has check
      if (typeof context?.countItem === 'function') {
        return context.countItem(itemName) || 0;
      }
      // Fallback: return 1 if has, 0 if not
      const hasItem = evaluateRule({ type: 'item_check', item: itemName, count: 1 }, context, depth + 1, localScope);
      return hasItem ? 1 : 0;
    }

    // CountGroup: get the count of items in a group
    // Rule Builder: {"rule": "CountGroup", "args": {"group": "Keys"}}
    case 'CountGroup': {
      const groupName = args.group;
      if (!groupName) {
        log('warn', '[evaluateRuleBuilderRule] CountGroup rule missing group');
        return 0;
      }
      if (typeof context?.countGroup === 'function') {
        return context.countGroup(groupName) || 0;
      }
      // Fallback: delegate to AST evaluator
      return evaluateRule({ type: 'state_method', method: 'count_group', args: [{ type: 'constant', value: groupName }] }, context, depth + 1, localScope);
    }

    // CountGroupUnique: get the count of unique items in a group
    // Rule Builder: {"rule": "CountGroupUnique", "args": {"group": "Keys"}}
    case 'CountGroupUnique': {
      const groupName = args.group;
      if (!groupName) {
        log('warn', '[evaluateRuleBuilderRule] CountGroupUnique rule missing group');
        return 0;
      }
      if (typeof context?.countGroupUnique === 'function') {
        return context.countGroupUnique(groupName) || 0;
      }
      // Fallback: delegate to AST evaluator
      return evaluateRule({ type: 'state_method', method: 'count_group_unique', args: [{ type: 'constant', value: groupName }] }, context, depth + 1, localScope);
    }

    // SettingValue: get a game setting value
    // Rule Builder: {"rule": "SettingValue", "args": {"setting": "difficulty"}}
    case 'SettingValue': {
      const settingName = args.setting;
      if (!settingName) {
        log('warn', '[evaluateRuleBuilderRule] SettingValue rule missing setting');
        return undefined;
      }
      // Try to get setting from context
      if (context.getStaticData || context.staticData) {
        const staticData = context.getStaticData ? context.getStaticData() : context.staticData;
        const playerId = context.playerId || context.getPlayerId?.() || context.getPlayerSlot?.() || DEFAULT_PLAYER_ID;
        if (staticData?.settings && staticData.settings[playerId]) {
          const playerSettings = staticData.settings[playerId];

          // Check direct setting first
          let settingValue = playerSettings[settingName];

          // If not found, check in options sub-object
          if (settingValue === undefined && playerSettings.options) {
            settingValue = playerSettings.options[settingName];
          }

          if (settingValue !== undefined) {
            // Convert string booleans to actual booleans
            if (settingValue === 'true') return true;
            if (settingValue === 'false') return false;
            return settingValue;
          }
        }
      }
      log('debug', `[evaluateRuleBuilderRule] SettingValue: setting '${settingName}' not found`);
      return undefined;
    }

    // ItemCheck: complex item check (fallback from converter when item couldn't be resolved)
    // Rule Builder: {"rule": "ItemCheck", "args": {"item": {...}, "count": ...}}
    case 'ItemCheck': {
      const item = args.item;
      const count = args.count ?? 1;
      // Try to resolve item to a string
      let itemName;
      if (typeof item === 'string') {
        itemName = item;
      } else if (item && typeof item === 'object') {
        // Try to evaluate item expression
        const resolvedItem = evaluateRule(item, context, depth + 1, localScope);
        if (typeof resolvedItem === 'string') {
          itemName = resolvedItem;
        }
      }
      if (!itemName) {
        log('warn', '[evaluateRuleBuilderRule] ItemCheck could not resolve item', { item });
        return false;
      }
      // Resolve count if it's a complex expression
      let countValue = count;
      if (typeof count === 'object') {
        countValue = evaluateRule(count, context, depth + 1, localScope);
      }
      // Delegate to AST evaluator
      return evaluateRule({ type: 'item_check', item: itemName, count: countValue ?? 1 }, context, depth + 1, localScope);
    }

    // StateMethod: complex state method call (fallback from converter)
    // Rule Builder: {"rule": "StateMethod", "args": {"method": "...", "args": [...]}}
    case 'StateMethod': {
      const method = args.method;
      const methodArgs = args.args || [];
      if (!method) {
        log('warn', '[evaluateRuleBuilderRule] StateMethod missing method');
        return false;
      }
      // Pass args directly to AST evaluator - it will evaluate them
      return evaluateRule({ type: 'state_method', method, args: methodArgs }, context, depth + 1, localScope);
    }

    // Attribute: complex attribute access (fallback from converter)
    // Rule Builder: {"rule": "Attribute", "args": {"object": {...}, "attr": "..."}}
    case 'Attribute': {
      const obj = args.object;
      const attr = args.attr;
      if (!attr) {
        log('warn', '[evaluateRuleBuilderRule] Attribute missing attr');
        return undefined;
      }
      // Convert object if it's Rule Builder format
      let convertedObj = obj;
      if (obj && typeof obj === 'object' && obj.rule) {
        convertedObj = evaluateRule(obj, context, depth + 1, localScope);
      }
      // Delegate to AST evaluator
      return evaluateRule({ type: 'attribute', object: convertedObj, attr }, context, depth + 1, localScope);
    }

    // Name: variable/name reference (fallback from converter)
    // Rule Builder: {"rule": "Name", "args": {"name": "..."}}
    case 'Name': {
      const name = args.name;
      if (!name) {
        log('warn', '[evaluateRuleBuilderRule] Name missing name');
        return undefined;
      }
      // Delegate to AST evaluator
      return evaluateRule({ type: 'name', name }, context, depth + 1, localScope);
    }

    // Tuple: tuple expression (fallback from converter)
    // Rule Builder: {"rule": "Tuple", "args": {"value": [...]}}
    case 'Tuple': {
      const value = args.value || [];
      // Evaluate each element
      return value.map(item => {
        if (item && typeof item === 'object') {
          return evaluateRule(item, context, depth + 1, localScope);
        }
        return item;
      });
    }

    // Unknown rule type - try to find as a custom helper or delegate to AST evaluator
    default: {
      log('debug', `[evaluateRuleBuilderRule] Unknown Rule Builder type '${ruleName}', checking options`);

      // Check for _original_ast_type to determine if this should be delegated to AST evaluator
      const originalAstType = args?._original_ast_type;
      if (originalAstType && originalAstType !== 'helper') {
        // This was converted from an AST rule that we should try to evaluate as AST
        log('debug', `[evaluateRuleBuilderRule] Delegating to AST evaluator for type '${originalAstType}'`);

        // Build AST rule from the args
        const astRule = { type: originalAstType };

        // Copy non-metadata args to AST rule
        if (args) {
          for (const [key, value] of Object.entries(args)) {
            if (!key.startsWith('_')) {
              astRule[key] = value;
            }
          }
        }

        return evaluateRule(astRule, context, depth + 1, localScope);
      }

      // Handle as helper (converted from AST helper or unknown Rule Builder type)
      // New format: {rule: "helper_name", args: [...], _original_ast_type: "helper"}
      // Old format: {rule: "helper_name", args: {args: [...], _original_ast_type: "helper"}}
      let helperArgs;
      if (Array.isArray(args)) {
        // New flattened format - args is directly an array
        helperArgs = args;
      } else if (args._original_ast_type === 'helper' && Array.isArray(args.args)) {
        // Old nested format - args.args contains the helper arguments
        helperArgs = args.args;
      } else {
        // For simpler Rule Builder rules, use all arg values (excluding metadata keys)
        helperArgs = Object.entries(args)
          .filter(([key]) => !key.startsWith('_'))
          .map(([, value]) => value);
      }
      // Try evaluating as an AST helper
      return evaluateRule({ type: 'helper', name: ruleName, args: helperArgs }, context, depth + 1, localScope);
    }
  }
}

// Debugging helper function for visualizing rule structures in console
export function debugRule(rule, indent = 0) {
  const prefix = ' '.repeat(indent);

  if (!rule) {
    log('info', `${prefix}null or undefined rule`);
    return;
  }

  log('info', `${prefix}Type: ${rule.type}`);

  switch (rule.type) {
    case 'constant':
      log('info', `${prefix}Value: ${rule.value}`);
      break;

    case 'name':
      log('info', `${prefix}Name: ${rule.name}`);
      break;

    case 'attribute':
      log('info', `${prefix}Attribute: ${rule.attr}`);
      log('info', `${prefix}Object:`);
      debugRule(rule.object, indent + 2);
      break;

    case 'subscript':
      log('info', `${prefix}Subscript:`);
      log('info', `${prefix}  Value:`);
      debugRule(rule.value, indent + 4);
      log('info', `${prefix}  Index:`);
      debugRule(rule.index, indent + 4);
      break;

    case 'function_call':
      log('info', `${prefix}Function Call:`);
      log('info', `${prefix}  Function:`);
      debugRule(rule.function, indent + 4);
      log('info', `${prefix}  Args:`);
      (rule.args || []).forEach((arg, i) => {
        log('info', `${prefix}    Arg ${i + 1}:`);
        debugRule(arg, indent + 6);
      });
      break;

    case 'location_check':
      if (typeof rule.location === 'string') {
        log('info', `${prefix}Location: ${rule.location}`);
      } else {
        log('info', `${prefix}Location (complex):`);
        debugRule(rule.location, indent + 2);
      }
      break;

    case 'region_check':
      if (typeof rule.region === 'string') {
        log('info', `${prefix}Region: ${rule.region}`);
      } else {
        log('info', `${prefix}Region (complex):`);
        debugRule(rule.region, indent + 2);
      }
      break;

    case 'locations_checked':
      if (typeof rule.count === 'number') {
        log('info', `${prefix}Required locations checked: ${rule.count}`);
      } else if (rule.count) {
        log('info', `${prefix}Required locations checked (complex):`);
        debugRule(rule.count, indent + 2);
      }
      break;

    case 'item_check':
      if (typeof rule.item === 'string') {
        log('info', `${prefix}Item: ${rule.item}`);
      } else {
        log('info', `${prefix}Item (complex):`);
        debugRule(rule.item, indent + 2);
      }
      break;

    case 'count_check':
      if (typeof rule.item === 'string') {
        log('info', `${prefix}Item: ${rule.item}`);
      } else {
        log('info', `${prefix}Item (complex):`);
        debugRule(rule.item, indent + 2);
      }

      if (typeof rule.count === 'number') {
        log('info', `${prefix}Count: ${rule.count}`);
      } else if (rule.count) {
        log('info', `${prefix}Count (complex):`);
        debugRule(rule.count, indent + 2);
      }
      break;

    case 'group_check':
      if (typeof rule.group === 'string') {
        log('info', `${prefix}Group: ${rule.group}`);
      } else {
        log('info', `${prefix}Group (complex):`);
        debugRule(rule.group, indent + 2);
      }

      log('info', `${prefix}Count: ${rule.count || 1}`);
      break;

    case 'helper':
      log('info', `${prefix}Helper: ${rule.name}`);
      if (rule.args && rule.args.length > 0) {
        log('info', `${prefix}Args:`);
        rule.args.forEach((arg, i) => {
          if (typeof arg === 'string' || typeof arg === 'number') {
            log('info', `${prefix}  Arg ${i + 1}: ${arg}`);
          } else {
            log('info', `${prefix}  Arg ${i + 1} (complex):`);
            debugRule(arg, indent + 4);
          }
        });
      }
      break;

    case 'generic_helper':
      log('info', `${prefix}Generic Helper: ${rule.name}`);
      if (rule.description) {
        log('info', `${prefix}Description: ${rule.description}`);
      }
      if (rule.args && rule.args.length > 0) {
        log('info', `${prefix}Args:`);
        rule.args.forEach((arg, i) => {
          if (typeof arg === 'string' || typeof arg === 'number') {
            log('info', `${prefix}  Arg ${i + 1}: ${arg}`);
          } else {
            log('info', `${prefix}  Arg ${i + 1} (complex):`);
            debugRule(arg, indent + 4);
          }
        });
      }
      break;

    case 'and':
    case 'or':
      log(
        'info',
        `${prefix}${rule.type.toUpperCase()} with ${
          rule.conditions.length
        } conditions:`
      );
      rule.conditions.forEach((cond, i) => {
        log('info', `${prefix}  Condition ${i + 1}:`);
        debugRule(cond, indent + 4);
      });
      break;

    case 'count_true':
      log(
        'info',
        `${prefix}COUNT_TRUE (at least ${rule.count} of ${
          rule.conditions.length
        } conditions):`
      );
      rule.conditions.forEach((cond, i) => {
        log('info', `${prefix}  Condition ${i + 1}:`);
        debugRule(cond, indent + 4);
      });
      break;

    case 'state_method':
      log('info', `${prefix}Method: ${rule.method}`);
      if (rule.args && rule.args.length > 0) {
        log('info', `${prefix}Args:`);
        rule.args.forEach((arg, i) => {
          if (typeof arg === 'string' || typeof arg === 'number') {
            log('info', `${prefix}  Arg ${i + 1}: ${arg}`);
          } else {
            log('info', `${prefix}  Arg ${i + 1} (complex):`);
            debugRule(arg, indent + 4);
          }
        });
      }
      break;

    case 'comparison':
      log('info', `${prefix}Comparison: ${rule.op}`);
      log('info', `${prefix}Left:`);
      if (typeof rule.left === 'object' && rule.left.type) {
        debugRule(rule.left, indent + 2);
      } else {
        log('info', `${prefix}  ${rule.left}`);
      }

      log('info', `${prefix}Right:`);
      if (typeof rule.right === 'object' && rule.right.type) {
        debugRule(rule.right, indent + 2);
      } else {
        log('info', `${prefix}  ${rule.right}`);
      }
      break;

    default:
      log('info', `${prefix}${JSON.stringify(rule, null, 2)}`);
  }
}

/**
 * Helper to extract function path from a Python AST function node
 * @param {Object} funcNode - Function node from the AST
 * @returns {string} - Extracted function path
 */
export function extractFunctionPath(funcNode) {
  if (!funcNode) return '(unknown)';

  if (funcNode.type === 'attribute') {
    // Handle attribute access (e.g., foo.bar)
    const objectPath = extractFunctionPath(funcNode.object);
    return `${objectPath}.${funcNode.attr}`;
  } else if (funcNode.type === 'name') {
    // Handle direct name (e.g., function_name)
    return funcNode.name;
  } else if (funcNode.type === 'subscript') {
    // Handle subscript access (e.g., foo[bar])
    return `${extractFunctionPath(funcNode.value)}[...]`;
  } else {
    // Other node types
    return `(${funcNode.type})`;
  }
}

/**
 * Log a Python AST structure with better formatting
 * @param {Object} rule - The AST node to visualize
 */
export function debugPythonAST(rule) {
  if (!rule) {
    log('info', 'null or undefined rule');
    return;
  }

  console.group(`Python AST Node: ${rule.type}`);

  switch (rule.type) {
    case 'function_call':
      log('info', `Function: ${extractFunctionPath(rule.function)}`);
      log('info', 'Arguments:');
      (rule.args || []).forEach((arg, i) => {
        console.group(`Arg ${i + 1}:`);
        debugPythonAST(arg);
        console.groupEnd();
      });
      break;

    case 'attribute':
      log('info', `Attribute: ${rule.attr}`);
      log('info', 'Object:');
      debugPythonAST(rule.object);
      break;

    case 'subscript':
      log('info', 'Value:');
      debugPythonAST(rule.value);
      log('info', 'Index:');
      debugPythonAST(rule.index);
      break;

    case 'name':
      log('info', `Name: ${rule.name}`);
      break;

    case 'constant':
      log('info', `Constant: ${rule.value}`);
      break;

    default:
      log('info', `${JSON.stringify(rule, null, 2)}`);
  }

  console.groupEnd();
}

function extractFunctionChain(node) {
  const chain = [];
  let current = node;

  while (current) {
    if (current.type === 'attribute') {
      chain.unshift(current.attr);
      current = current.object;
    } else if (current.type === 'name') {
      chain.unshift(current.name);
      break;
    } else {
      chain.unshift(`[${current.type}]`);
      break;
    }
  }

  return chain.join('.');
}
