/**
 * Thread-agnostic Super Metroid game logic functions
 *
 * Super Metroid uses a custom SMBoolManager system for its logic,
 * which evaluates rules based on both boolean values AND difficulty ratings.
 * The Python backend has already done all the complex logic evaluation,
 * so the frontend primarily needs to provide stub implementations that
 * allow the rules to be processed.
 *
 * For now, we provide simplified implementations that trust the Python
 * backend's calculations encoded in the sphere log.
 */

/**
 * Check if player has an item
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to check
 * @returns {boolean} True if player has the item
 */
export function has(snapshot, staticData, itemName) {
  if (!snapshot.inventory) return false;
  return (snapshot.inventory[itemName] || 0) > 0;
}

/**
 * Count how many of an item the player has
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to count
 * @returns {number} Number of items
 */
export function count(snapshot, staticData, itemName) {
  if (!snapshot.inventory) return 0;
  return snapshot.inventory[itemName] || 0;
}

/**
 * Python's any() builtin - check if any element in an iterable is true
 * This is used in location rules to check if any access point is reachable
 * @param {Array} iterable - Array of boolean values
 * @returns {boolean} True if any element is truthy
 */
export function any(snapshot, staticData, iterable) {
  if (!Array.isArray(iterable)) return false;
  return iterable.some(x => x);
}

/**
 * Constructor for SMBool objects
 * In Python, SMBool(value, difficulty) creates an object with boolean and difficulty.
 * For simplified cases where the value is a constant, we just return that constant.
 *
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {*} value - The boolean value or SMBool result
 * @param {number} difficulty - Difficulty rating (optional)
 * @returns {*} The value or an SMBool-like object
 */
export function SMBool(snapshot, staticData, value, difficulty = 0) {
  // For constant boolean values, just return them directly
  if (typeof value === 'boolean') {
    return value;
  }
  // Otherwise, return an SMBool-like object
  return { bool: value, difficulty: difficulty || 0 };
}

/**
 * Evaluate an SMBool against maximum difficulty
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {*} smbool - The SMBool object or boolean value
 * @param {number} maxDiff - Maximum difficulty allowed
 * @returns {boolean} True if smbool passes the difficulty check
 */
export function evalSMBool(snapshot, staticData, smbool, maxDiff) {
  // If smbool is a plain boolean, return it
  if (typeof smbool === 'boolean') {
    return smbool;
  }

  // If smbool is an SMBool object, check difficulty
  if (smbool && typeof smbool === 'object' && 'bool' in smbool && 'difficulty' in smbool) {
    return smbool.bool === true && smbool.difficulty <= maxDiff;
  }

  // Default: assume it's truthy
  return Boolean(smbool);
}

/**
 * VARIA wor - OR with difficulty
 * Returns True with the minimum difficulty of all True arguments
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {...*} args - SMBool objects or boolean values
 * @returns {Object} SMBool object
 */
export function wor(snapshot, staticData, ...args) {
  let minDifficulty = Infinity;
  let anyTrue = false;

  for (const arg of args) {
    const smbool = normalizeSMBool(arg);
    if (smbool.bool === true) {
      anyTrue = true;
      if (smbool.difficulty < minDifficulty) {
        minDifficulty = smbool.difficulty;
      }
    }
  }

  if (anyTrue) {
    return { bool: true, difficulty: minDifficulty };
  } else {
    return { bool: false, difficulty: 0 };
  }
}

/**
 * VARIA wand - AND with difficulty
 * Returns True with the sum of difficulties if all arguments are True
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {...*} args - SMBool objects or boolean values
 * @returns {Object} SMBool object
 */
export function wand(snapshot, staticData, ...args) {
  let totalDifficulty = 0;

  for (const arg of args) {
    const smbool = normalizeSMBool(arg);
    if (smbool.bool !== true) {
      return { bool: false, difficulty: 0 };
    }
    totalDifficulty += smbool.difficulty;
  }

  return { bool: true, difficulty: totalDifficulty };
}

/**
 * Check if player has a specific item
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item
 * @returns {Object} SMBool object
 */
export function haveItem(snapshot, staticData, itemName) {
  const hasIt = has(snapshot, staticData, itemName);
  return { bool: hasIt, difficulty: 0 };
}

/**
 * Normalize a value to an SMBool object
 * @param {*} value - Boolean, SMBool object, or other value
 * @returns {Object} SMBool object with bool and difficulty properties
 */
function normalizeSMBool(value) {
  if (typeof value === 'boolean') {
    return { bool: value, difficulty: 0 };
  }
  if (value && typeof value === 'object' && 'bool' in value) {
    return {
      bool: value.bool,
      difficulty: value.difficulty || 0
    };
  }
  // Treat truthy values as True with 0 difficulty
  return { bool: Boolean(value), difficulty: 0 };
}

/**
 * VARIA ability checks - for now these are stubs that return False
 * These would need game knowledge to implement properly
 */
export function canFly(snapshot, staticData) {
  // Can fly with Space Jump or similar
  // For now, return False (requires implementation)
  return { bool: false, difficulty: 0 };
}

export function knowsCeilingDBoost(snapshot, staticData) {
  // Knowledge-based trick: ceiling damage boost
  // This is a technique that doesn't require items, only knowledge
  // Based on sphere log, this should be True from the start
  return { bool: true, difficulty: 0 };
}

export function canUsePowerBombs(snapshot, staticData) {
  // Can use power bombs if player has Power Bomb item
  const hasPowerBomb = has(snapshot, staticData, 'Power Bomb');
  return { bool: hasPowerBomb, difficulty: 0 };
}

export function canSimpleShortCharge(snapshot, staticData) {
  // Speed booster short charge trick
  // For now, return False (requires implementation)
  return { bool: false, difficulty: 0 };
}

/**
 * Helper function registry
 * Export all helper functions that can be called from rules
 */
export const helperFunctions = {
  has,
  count,
  any,
  SMBool,
  evalSMBool,
  // VARIA logic functions
  wor,
  wand,
  haveItem,
  canFly,
  knowsCeilingDBoost,
  canUsePowerBombs,
  canSimpleShortCharge
};

/**
 * SM-specific state module
 * Initializes state with smbm object that contains maxDiff
 */
export const smStateModule = {
  /**
   * Initializes a new Super Metroid game state with smbm support
   */
  initializeState() {
    return {
      flags: [],
      events: [],
      // Initialize smbm for each player
      // The index is the player ID (1-based)
      smbm: {
        // Default maxDiff for player 1
        // This represents the maximum difficulty the player is willing to accept
        // Higher values mean more difficult tricks are allowed
        1: {
          maxDiff: 999 // Allow all difficulties (trusting Python backend calculations)
        }
      }
    };
  },

  /**
   * Loads settings into the game state
   */
  loadSettings(gameState, settings) {
    return { ...gameState };
  },

  /**
   * Adds an item to inventory (called when a location is collected)
   */
  addItem(gameState, itemName) {
    return gameState; // Generic handling by StateManager
  },

  /**
   * Removes an item from inventory
   */
  removeItem(gameState, itemName) {
    return gameState; // Generic handling by StateManager
  },

  /**
   * Extracts state for snapshot
   * Returns all game-specific state fields including smbm
   */
  getStateForSnapshot(gameState) {
    return {
      flags: gameState.flags || [],
      events: gameState.events || [],
      smbm: gameState.smbm || {
        1: { maxDiff: 999 }
      }
    };
  }
};
