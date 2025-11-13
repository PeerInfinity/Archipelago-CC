/**
 * Ocarina of Time game logic functions
 * Thread-agnostic pure functions for OOT rule evaluation
 */

/**
 * OOT state management module
 */
export const ootStateModule = {
  /**
   * Initialize OOT game state
   */
  initializeState() {
    return {
      flags: [],
      events: [],
      age: null, // 'child' or 'adult'
    };
  },

  /**
   * Load settings into game state
   */
  loadSettings(gameState, settings) {
    // Initialize age based on starting_age setting
    const startingAge = settings?.starting_age || 'child';
    return {
      ...gameState,
      age: startingAge,
    };
  },

  /**
   * Process event items
   */
  processEventItem(gameState, itemName) {
    return null;
  },

  /**
   * Get state for snapshot
   */
  getStateForSnapshot(gameState) {
    return {
      flags: gameState.flags || [],
      events: gameState.events || [],
      age: gameState.age,
    };
  },
};

/**
 * Parse and evaluate OOT's custom rule DSL
 *
 * This is the critical helper that allows the frontend to evaluate OOT rules
 * that were exported as DSL strings.
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} ruleString - OOT DSL rule string
 * @returns {boolean} True if rule is satisfied
 */
function parse_oot_rule(snapshot, staticData, ruleString) {
  if (!ruleString || typeof ruleString !== 'string') {
    return true;
  }

  // Handle simple constants
  if (ruleString === 'True') return true;
  if (ruleString === 'False') return false;

  // For complex rules, we need to parse and evaluate the DSL
  // This is a simplified implementation - will expand as needed

  try {
    // Create evaluation context with helper functions
    const context = createEvaluationContext(snapshot, staticData);

    // Parse and evaluate the rule string
    return evaluateRuleString(ruleString, context);
  } catch (error) {
    console.warn(`[OOT] Failed to parse rule: ${ruleString}`, error);
    return false; // Fail safe - location not accessible if rule can't be parsed
  }
}

/**
 * Create evaluation context with all helper functions and data
 */
function createEvaluationContext(snapshot, staticData) {
  const settings = staticData?.settings?.[1] || {};

  return {
    snapshot,
    staticData,
    settings,

    // Item check function
    hasItem: (itemName) => {
      // Convert underscores to spaces for item names
      const normalizedName = itemName.replace(/_/g, ' ');
      return (snapshot?.inventory?.[normalizedName] || 0) > 0;
    },

    // Event check function
    hasEvent: (eventName) => {
      return (snapshot?.events || []).includes(eventName);
    },

    // Age checks
    is_adult: () => snapshot?.age === 'adult' || !snapshot?.age, // Default to adult if age not set
    is_child: () => snapshot?.age === 'child',
    is_starting_age: () => {
      const startingAge = settings?.starting_age || 'child';
      return snapshot?.age === startingAge || !snapshot?.age;
    },

    // Time of day checks (placeholder - need to implement properly)
    at_night: () => true, // TODO: Implement time of day logic
    at_day: () => true,
    at_dampe: () => true,
  };
}

/**
 * Evaluate an OOT rule string
 *
 * This implements a simple recursive descent parser for OOT's DSL
 *
 * @param {string} ruleString - Rule string to evaluate
 * @param {Object} context - Evaluation context
 * @returns {boolean} Evaluation result
 */
function evaluateRuleString(ruleString, context) {
  // Trim whitespace
  ruleString = ruleString.trim();

  // Handle constants
  if (ruleString === 'True') return true;
  if (ruleString === 'False') return false;

  // Handle OR operator (lowest precedence)
  if (ruleString.includes(' or ')) {
    const parts = splitByOperator(ruleString, ' or ');
    // Only recurse if we actually split the string
    if (parts.length > 1) {
      return parts.some(part => evaluateRuleString(part, context));
    }
    // If no split happened, continue to other checks
  }

  // Handle AND operator
  if (ruleString.includes(' and ')) {
    const parts = splitByOperator(ruleString, ' and ');
    // Only recurse if we actually split the string
    if (parts.length > 1) {
      return parts.every(part => evaluateRuleString(part, context));
    }
    // If no split happened, continue to other checks
  }

  // Handle NOT operator
  if (ruleString.startsWith('not ')) {
    const innerRule = ruleString.substring(4).trim();
    return !evaluateRuleString(innerRule, context);
  }

  // Handle parentheses
  if (ruleString.startsWith('(') && ruleString.endsWith(')')) {
    const inner = ruleString.substring(1, ruleString.length - 1);
    return evaluateRuleString(inner, context);
  }

  // Handle quoted event names
  if (ruleString.startsWith("'") && ruleString.endsWith("'")) {
    const eventName = ruleString.substring(1, ruleString.length - 1);
    return context.hasEvent(eventName);
  }

  // Handle function calls like can_play(Song_Name)
  const funcMatch = ruleString.match(/^(\w+)\(([^)]+)\)$/);
  if (funcMatch) {
    const [, funcName, argString] = funcMatch;
    return evaluateFunctionCall(funcName, argString, context);
  }

  // Handle age checks
  if (ruleString === 'is_adult') return context.is_adult();
  if (ruleString === 'is_child') return context.is_child();
  if (ruleString === 'is_starting_age') return context.is_starting_age();

  // Handle time of day
  if (ruleString === 'at_night') return context.at_night();
  if (ruleString === 'at_day') return context.at_day();
  if (ruleString === 'at_dampe') return context.at_dampe();

  // Handle setting checks (e.g., "open_forest == 'open'")
  if (ruleString.includes('==') || ruleString.includes('!=')) {
    return evaluateComparison(ruleString, context);
  }

  // Handle simple item names (with underscores)
  // If it looks like an item name (starts with capital), check inventory
  if (/^[A-Z][a-zA-Z0-9_]*$/.test(ruleString)) {
    return context.hasItem(ruleString);
  }

  // Handle helper-like identifiers (lowercase with underscores, like can_plant_bean)
  // These are OOT-specific helpers that we haven't implemented yet
  if (/^[a-z][a-z0-9_]*$/.test(ruleString)) {
    // For now, treat unknown helpers as always false (location not accessible)
    // This is safer than returning true
    console.warn(`[OOT] Unknown helper: ${ruleString}`);
    return false;
  }

  // Default: treat as a simple identifier and check if it's an item or setting
  const normalizedName = ruleString.replace(/_/g, ' ');
  if (context.snapshot?.inventory?.[normalizedName]) {
    return context.snapshot.inventory[normalizedName] > 0;
  }

  // Unknown rule - log and return false
  console.warn(`[OOT] Unknown rule pattern: ${ruleString}`);
  return false;
}

/**
 * Split a string by an operator, respecting parentheses and quotes
 */
function splitByOperator(str, operator) {
  const parts = [];
  let current = '';
  let parenDepth = 0;
  let inQuotes = false;
  let i = 0;

  while (i < str.length) {
    const char = str[i];

    // Track quote state
    if (char === "'" && (i === 0 || str[i-1] !== '\\')) {
      inQuotes = !inQuotes;
      current += char;
      i++;
      continue;
    }

    if (!inQuotes) {
      // Track parenthesis depth
      if (char === '(') parenDepth++;
      if (char === ')') parenDepth--;

      // Check if we're at the operator (only split at depth 0)
      if (parenDepth === 0 && str.substring(i, i + operator.length) === operator) {
        parts.push(current.trim());
        current = '';
        i += operator.length;
        continue;
      }
    }

    current += char;
    i++;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  // If no split occurred, return array with original string
  if (parts.length === 0) {
    return [str];
  }

  return parts;
}

/**
 * Evaluate a function call like can_play(Song_Name)
 */
function evaluateFunctionCall(funcName, argString, context) {
  const arg = argString.trim();

  switch (funcName) {
    case 'can_play':
      // Check if player has the song (convert underscores to spaces)
      const songName = arg.replace(/_/g, ' ');
      return context.hasItem(songName);

    case 'can_use':
      // Check if player can use an item
      const itemName = arg.replace(/_/g, ' ');
      return context.hasItem(itemName);

    case 'here':
      // Evaluate a helper in the current region context
      // For now, just recursively evaluate the argument
      return evaluateRuleString(arg, context);

    case 'at':
      // Check if at a specific location
      // This is context-dependent, for now return true
      return true;

    default:
      console.warn(`[OOT] Unknown function: ${funcName}`);
      return false;
  }
}

/**
 * Evaluate a comparison expression
 */
function evaluateComparison(ruleString, context) {
  const eqMatch = ruleString.match(/^(.+?)\s*==\s*(.+)$/);
  if (eqMatch) {
    const [, left, right] = eqMatch;
    const leftVal = getComparisonValue(left.trim(), context);
    const rightVal = getComparisonValue(right.trim(), context);
    return leftVal === rightVal;
  }

  const neqMatch = ruleString.match(/^(.+?)\s*!=\s*(.+)$/);
  if (neqMatch) {
    const [, left, right] = neqMatch;
    const leftVal = getComparisonValue(left.trim(), context);
    const rightVal = getComparisonValue(right.trim(), context);
    return leftVal !== rightVal;
  }

  return false;
}

/**
 * Get value for comparison
 */
function getComparisonValue(str, context) {
  // Handle quoted strings
  if (str.startsWith("'") && str.endsWith("'")) {
    return str.substring(1, str.length - 1);
  }

  // Handle numbers
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10);
  }

  // Handle booleans
  if (str === 'True') return true;
  if (str === 'False') return false;

  // Handle setting references
  if (context.settings && str in context.settings) {
    return context.settings[str];
  }

  // Return as string
  return str;
}

/**
 * Helper functions exported to the registry
 */
export const helperFunctions = {
  /**
   * Parse and evaluate OOT rule DSL
   */
  parse_oot_rule,

  /**
   * Standard has() helper for backward compatibility
   */
  has(snapshot, staticData, itemName) {
    const normalizedName = itemName.replace(/_/g, ' ');
    return (snapshot?.inventory?.[normalizedName] || 0) > 0;
  },

  /**
   * Standard count() helper
   */
  count(snapshot, staticData, itemName) {
    const normalizedName = itemName.replace(/_/g, ' ');
    return snapshot?.inventory?.[normalizedName] || 0;
  },
};
