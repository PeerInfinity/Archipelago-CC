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
 * VARIA ability checks - implementing core Super Metroid logic
 */

// Basic item checks
export function canUseBombs(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    haveItem(snapshot, staticData, 'Bomb'));
}

export function canUsePowerBombs(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    haveItem(snapshot, staticData, 'Power Bomb'));
}

export function canUseSpringBall(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    haveItem(snapshot, staticData, 'SpringBall'));
}

// Passage checks
export function canPassBombPassages(snapshot, staticData) {
  return wor(snapshot, staticData,
    canUseBombs(snapshot, staticData),
    canUsePowerBombs(snapshot, staticData));
}

// Knowledge-based techniques (assume player has knowledge)
export function knowsCeilingDBoost(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsInfiniteBombJump(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsSimpleShortCharge(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsShortCharge(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsMockball(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsAlcatrazEscape(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsGreenGateGlitch(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsGravLessLevel3(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

// Advanced movement abilities
export function canInfiniteBombJump(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    haveItem(snapshot, staticData, 'Bomb'),
    knowsInfiniteBombJump(snapshot, staticData));
}

export function canFly(snapshot, staticData) {
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'SpaceJump'),
    canInfiniteBombJump(snapshot, staticData));
}

export function canSimpleShortCharge(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'SpeedBooster'),
    wor(snapshot, staticData,
      knowsSimpleShortCharge(snapshot, staticData),
      knowsShortCharge(snapshot, staticData)));
}

export function canMockball(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    knowsMockball(snapshot, staticData));
}

export function canSpringBallJump(snapshot, staticData) {
  return canUseSpringBall(snapshot, staticData);
}

export function canShortCharge(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'SpeedBooster'),
    knowsShortCharge(snapshot, staticData));
}

export function haveMissileOrSuper(snapshot, staticData) {
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Missile'),
    haveItem(snapshot, staticData, 'Super'));
}

export function canOpenEyeDoors(snapshot, staticData) {
  // Simplified: assume no ROM patches, just check for missiles/supers
  return haveMissileOrSuper(snapshot, staticData);
}

export function canJumpUnderwater(snapshot, staticData) {
  // Can jump underwater with Gravity Suit or HiJump
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    haveItem(snapshot, staticData, 'HiJump'));
}

// Complex helpers - conservative implementations
export function canHellRun(snapshot, staticData, ...args) {
  // Hell runs require significant energy reserves and heat resistance
  // Conservative: require Varia or Gravity suit
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Varia'),
    haveItem(snapshot, staticData, 'Gravity'));
}

export function canAccessSandPits(snapshot, staticData) {
  // Sand pits in Maridia require Gravity Suit or specific techniques
  return haveItem(snapshot, staticData, 'Gravity');
}

export function energyReserveCountOk(snapshot, staticData, ...args) {
  // Energy reserve check - conservative: assume player has enough
  // This should check energy tanks but would need complex calculations
  return { bool: true, difficulty: 0 };
}

export function canPassBowling(snapshot, staticData) {
  // Bowling alley passage - requires specific movement abilities
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    canSpringBallJump(snapshot, staticData));
}

export function enoughStuffGT(snapshot, staticData) {
  // Golden Torizo requirements - needs strong equipment
  // Conservative: require several major items
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Super'),
    haveItem(snapshot, staticData, 'Varia'));
}

// High priority helpers (3+ uses)
export function canDestroyBombWalls(snapshot, staticData) {
  // Can destroy bomb walls with Morph + (Bomb OR PowerBomb) OR ScrewAttack
  return wor(snapshot, staticData,
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Morph'),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Bomb'),
        haveItem(snapshot, staticData, 'Power Bomb'))),
    haveItem(snapshot, staticData, 'ScrewAttack'));
}

export function canDestroyBombWallsUnderwater(snapshot, staticData) {
  // Underwater bomb walls need Gravity OR just Morph + bombs
  return wor(snapshot, staticData,
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      canDestroyBombWalls(snapshot, staticData)),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Morph'),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Bomb'),
        haveItem(snapshot, staticData, 'Power Bomb'))));
}

export function itemCountOk(snapshot, staticData, itemName, requiredCount) {
  // Check if player has enough of a specific item
  const currentCount = count(snapshot, staticData, itemName);
  return {
    bool: currentCount >= requiredCount,
    difficulty: 0
  };
}

// Medium priority helpers (2 uses)
export function canOpenGreenDoors(snapshot, staticData) {
  // Green doors require Super Missiles
  return haveItem(snapshot, staticData, 'Super');
}

export function heatProof(snapshot, staticData) {
  // Heat immunity with Varia or Gravity suit (simplified - ignores ROM patches)
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Varia'),
    haveItem(snapshot, staticData, 'Gravity'));
}

export function canKillBeetoms(snapshot, staticData) {
  // Can kill Beetom enemies with missiles, power bombs, or screw attack
  return wor(snapshot, staticData,
    haveMissileOrSuper(snapshot, staticData),
    canUsePowerBombs(snapshot, staticData),
    haveItem(snapshot, staticData, 'ScrewAttack'));
}

export function canGreenGateGlitch(snapshot, staticData) {
  // Green gate glitch requires Super + knowledge
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Super'),
    knowsGreenGateGlitch(snapshot, staticData));
}

export function canFireChargedShots(snapshot, staticData) {
  // Can fire charged shots with Charge Beam
  return haveItem(snapshot, staticData, 'Charge');
}

// Traverse - complex door transition logic
export function traverse(snapshot, staticData, doorName) {
  // Traverse checks door transitions which depend on complex graph logic
  // For now, stub this as True (assume doors are passable)
  // TODO: Implement proper door transition logic
  return { bool: true, difficulty: 0 };
}

// Boss requirement helpers - Conservative implementations
// These calculate damage output vs boss HP in Python - we use simplified checks
export function enoughStuffsKraid(snapshot, staticData) {
  // Kraid boss - needs some offensive capability
  // Conservative: require at least missiles or charge beam
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Missile'),
    haveItem(snapshot, staticData, 'Charge'));
}

export function enoughStuffsPhantoon(snapshot, staticData) {
  // Phantoon boss - needs missiles or charge beam
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Missile'),
    haveItem(snapshot, staticData, 'Charge'));
}

export function enoughStuffsRidley(snapshot, staticData) {
  // Ridley boss - tougher, needs Morph or Screw Attack + good weapons
  return wand(snapshot, staticData,
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Morph'),
      haveItem(snapshot, staticData, 'ScrewAttack')),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Super'),
      haveItem(snapshot, staticData, 'Charge')));
}

export function enoughStuffCroc(snapshot, staticData) {
  // Crocomire - needs weapons, conservative approach
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Missile'),
    haveItem(snapshot, staticData, 'Super'),
    haveItem(snapshot, staticData, 'Charge'));
}

export function enoughStuffSporeSpawn(snapshot, staticData) {
  // Spore Spawn - relatively easy boss
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Missile'),
    haveItem(snapshot, staticData, 'Super'),
    haveItem(snapshot, staticData, 'Charge'));
}

export function enoughStuffTourian(snapshot, staticData) {
  // Mother Brain/Tourian - needs significant equipment
  // Conservative: require several key items
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Varia'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Super'),
      haveItem(snapshot, staticData, 'Charge')));
}

// Additional knowledge techniques
export function knowsFirefleasWalljump(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsGetAroundWallJump(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsIceEscape(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsXrayDboost(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsXrayIce(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsReverseGateGlitch(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsReverseGateGlitchHiJumpLess(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsCrocPBsDBoost(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsCrocPBsIce(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsMaridiaWallJumps(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsOldMBWithSpeed(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsRonPopeilScrew(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsSpringBallJumpFromWall(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsKillPlasmaPiratesWithSpark(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsKillPlasmaPiratesWithCharge(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

/**
 * Helper function registry
 * Export all helper functions that can be called from rules
 */
export const helperFunctions = {
  // Core functions
  has,
  count,
  any,
  SMBool,
  evalSMBool,
  // VARIA logic functions
  wor,
  wand,
  haveItem,
  // Basic item checks
  canUseBombs,
  canUsePowerBombs,
  canUseSpringBall,
  haveMissileOrSuper,
  itemCountOk,
  // Passage checks
  canPassBombPassages,
  canPassBowling,
  canDestroyBombWalls,
  canDestroyBombWallsUnderwater,
  // Door and room checks
  canOpenEyeDoors,
  canOpenGreenDoors,
  canFireChargedShots,
  traverse,
  // Knowledge techniques
  knowsCeilingDBoost,
  knowsInfiniteBombJump,
  knowsSimpleShortCharge,
  knowsShortCharge,
  knowsMockball,
  knowsAlcatrazEscape,
  knowsGreenGateGlitch,
  knowsGravLessLevel3,
  knowsFirefleasWalljump,
  knowsGetAroundWallJump,
  knowsIceEscape,
  knowsXrayDboost,
  knowsXrayIce,
  knowsReverseGateGlitch,
  knowsReverseGateGlitchHiJumpLess,
  knowsCrocPBsDBoost,
  knowsCrocPBsIce,
  knowsMaridiaWallJumps,
  knowsOldMBWithSpeed,
  knowsRonPopeilScrew,
  knowsSpringBallJumpFromWall,
  knowsKillPlasmaPiratesWithSpark,
  knowsKillPlasmaPiratesWithCharge,
  // Advanced movement
  canInfiniteBombJump,
  canFly,
  canSimpleShortCharge,
  canShortCharge,
  canMockball,
  canSpringBallJump,
  canJumpUnderwater,
  // Environmental hazards
  canHellRun,
  canAccessSandPits,
  heatProof,
  energyReserveCountOk,
  enoughStuffGT,
  // Combat
  canKillBeetoms,
  // Glitches
  canGreenGateGlitch,
  // Boss requirements
  enoughStuffsKraid,
  enoughStuffsPhantoon,
  enoughStuffsRidley,
  enoughStuffCroc,
  enoughStuffSporeSpawn,
  enoughStuffTourian
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
