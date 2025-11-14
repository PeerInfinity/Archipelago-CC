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

  // Create context object and store in variable so helper functions can reference it
  const context = {
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
    is_adult: () => snapshot?.age === 'adult',
    is_child: () => snapshot?.age === 'child',
    is_starting_age: () => {
      const startingAge = settings?.starting_age || 'child';
      return snapshot?.age === startingAge;
    },

    // Time of day checks (placeholder - need to implement properly)
    at_night: () => true, // TODO: Implement time of day logic
    at_day: () => true,
    at_dampe: () => true,
    at_dampe_time: () => true, // Alias for at_dampe

    // Helper to get item count
    countItem: (itemName) => {
      const normalizedName = itemName.replace(/_/g, ' ');
      return snapshot?.inventory?.[normalizedName] || 0;
    },

    // Helper to check group
    hasGroup: (groupName) => {
      // Check if player has any item from this group
      const items = staticData?.items?.[1] || {};
      for (const [itemName, itemData] of Object.entries(items)) {
        if (itemData.groups && itemData.groups.includes(groupName)) {
          if ((snapshot?.inventory?.[itemName] || 0) > 0) {
            return true;
          }
        }
      }
      return false;
    },

    // Explosives helpers
    has_bombchus: () => {
      const buyBombchu = context.hasItem('Buy_Bombchu_5') || context.hasItem('Buy_Bombchu_10') ||
                         context.hasItem('Buy_Bombchu_20') || context.hasItem('Bombchu_Drop');
      const bombchusInLogic = settings?.bombchus_in_logic || false;
      const hasBombBag = context.hasItem('Bomb_Bag');
      return buyBombchu && (bombchusInLogic || hasBombBag);
    },
    has_explosives: () => {
      const bombchusInLogic = settings?.bombchus_in_logic || false;
      return context.hasItem('Bombs') || (bombchusInLogic && context.has_bombchus());
    },
    can_blast_or_smash: () => {
      return context.has_explosives() || (context.is_adult() && context.hasItem('Megaton_Hammer'));
    },

    // Combat and interaction helpers
    can_break_crate: () => {
      const canBonk = true; // Simplified - deadly_bonks logic not fully implemented
      return canBonk || context.can_blast_or_smash();
    },
    can_cut_shrubs: () => {
      return context.is_adult() || context.hasItem('Sticks') || context.hasItem('Kokiri_Sword') ||
             context.hasItem('Boomerang') || context.has_explosives();
    },
    can_dive: () => {
      return context.hasItem('Progressive_Scale');
    },

    // Bottle helper
    has_bottle: () => {
      return context.hasGroup('logic_bottles');
    },

    // Bean and bug helpers
    can_plant_bean: () => {
      const plantBeans = settings?.plant_beans || false;
      if (plantBeans) return true;
      // Check if child and has beans
      if (!context.is_child()) return false;
      return context.hasItem('Magic_Bean_Pack') || context.hasItem('Buy_Magic_Bean') ||
             context.countItem('Magic_Bean') >= 10;
    },
    can_plant_bugs: () => {
      return context.is_child() && (context.hasItem('Bugs') || context.hasItem('Buy_Bottle_Bug'));
    },

    // Grotto helpers
    can_open_bomb_grotto: () => {
      const logicGrottosWithoutAgony = settings?.logic_grottos_without_agony || false;
      return context.can_blast_or_smash() && (context.hasItem('Stone_of_Agony') || logicGrottosWithoutAgony);
    },
    can_open_storm_grotto: () => {
      const logicGrottosWithoutAgony = settings?.logic_grottos_without_agony || false;
      const canPlaySOS = context.hasItem('Ocarina') && context.hasItem('Song_of_Storms');
      return canPlaySOS && (context.hasItem('Stone_of_Agony') || logicGrottosWithoutAgony);
    },

    // Fairy summon helpers
    can_summon_gossip_fairy: () => {
      if (!context.hasItem('Ocarina')) return false;
      return context.hasItem('Zeldas_Lullaby') || context.hasItem('Eponas_Song') ||
             context.hasItem('Song_of_Time') || context.hasItem('Suns_Song');
    },
    can_summon_gossip_fairy_without_suns: () => {
      if (!context.hasItem('Ocarina')) return false;
      return context.hasItem('Zeldas_Lullaby') || context.hasItem('Eponas_Song') ||
             context.hasItem('Song_of_Time');
    },

    // Epona helper
    can_ride_epona: () => {
      if (!context.is_adult() || !context.hasItem('Epona')) return false;
      const canPlayEponasSong = context.hasItem('Ocarina') && context.hasItem('Eponas_Song');
      return canPlayEponasSong; // Simplified - skipping is_glitched and can_hover
    },

    // Bridge and LACS helpers (simplified - full logic is complex)
    can_build_rainbow_bridge: () => {
      const bridge = settings?.bridge || 'vanilla';
      if (bridge === 'open') return true;
      // Simplified - just check for open bridge
      // Full implementation would check medallions, stones, etc.
      return false;
    },
    can_trigger_lacs: () => {
      const lacsCondition = settings?.lacs_condition || 'vanilla';
      // Simplified - full implementation would check condition requirements
      return false;
    },
    can_finish_GerudoFortress: () => {
      const gerudoFortress = settings?.gerudo_fortress || 'normal';
      // Simplified - check if gerudo fortress is set to something other than normal/fast
      return gerudoFortress !== 'normal' && gerudoFortress !== 'fast';
    },

    // Setting checks
    shuffle_dungeon_entrances: () => {
      return settings?.shuffle_dungeon_entrances || false;
    },
    entrance_shuffle: () => {
      return settings?.entrance_shuffle || false;
    },
    dodongos_cavern_shortcuts: () => {
      const dungeonShortcuts = settings?.dungeon_shortcuts || [];
      return dungeonShortcuts.includes('Dodongos Cavern');
    },

    // Logic trick helpers (all default to false for safety)
    logic_visible_collisions: () => false,
    logic_kakariko_rooftop_gs: () => false,
    logic_man_on_roof: () => false,
    logic_mido_backflip: () => false,
    logic_dmt_climb_hovers: () => false,
    logic_adult_kokiri_gs: () => false,
    logic_lab_diving: () => false,
    logic_windmill_poh: () => false,
    logic_graveyard_poh: () => false,
    logic_zora_river_lower: () => false,
    logic_link_goron_dins: () => false,
  };

  return context;
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

  // Handle item count checks (e.g., "Progressive_Scale, 2" or "(Gold_Skulltula_Token, bridge_tokens)")
  const countMatch = ruleString.match(/^\(?([A-Z][a-zA-Z0-9_]*)\s*,\s*(\w+)\)?$/);
  if (countMatch) {
    const [, itemName, countStr] = countMatch;
    // countStr could be a number or a setting name
    let requiredCount;
    if (/^\d+$/.test(countStr)) {
      requiredCount = parseInt(countStr, 10);
    } else {
      // It's a setting reference
      requiredCount = context.settings[countStr] || 0;
    }
    return context.countItem(itemName) >= requiredCount;
  }

  // Handle simple item names (with underscores)
  // If it looks like an item name (starts with capital), check inventory
  if (/^[A-Z][a-zA-Z0-9_]*$/.test(ruleString)) {
    return context.hasItem(ruleString);
  }

  // Handle helper-like identifiers (lowercase with underscores, like can_plant_bean)
  // These are OOT-specific helpers that we may have implemented
  if (/^[a-z][a-z0-9_]*$/.test(ruleString)) {
    // Check if this helper exists in our context
    if (typeof context[ruleString] === 'function') {
      return context[ruleString]();
    }
    // Unknown helper - log and return false
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
