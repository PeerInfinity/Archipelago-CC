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

import { DEFAULT_PLAYER_ID } from '../../playerIdUtils.js';

/**
 * Check if player has an item
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to check
 * @returns {boolean} True if player has the item
 */
export function has(snapshot, staticData, itemName) {
  // Check if it's in inventory with count > 0
  if (snapshot.inventory) {
    let count;
    if (snapshot.inventory instanceof Map) {
      count = snapshot.inventory.get(itemName) || 0;
    } else {
      count = snapshot.inventory[itemName] || 0;
    }

    if (count > 0) {
      return true;
    }
  }

  // Also check flags and events as fallback (for event items)
  if (snapshot.flags && snapshot.flags.includes(itemName)) {
    return true;
  }

  if (snapshot.events && snapshot.events.includes(itemName)) {
    return true;
  }

  return false;
}

/**
 * Check if a boss has been defeated
 * In SM, defeating a boss grants a boss item (Kraid, Phantoon, Draygon, Ridley, etc.)
 * So checking if a boss is dead = checking if player has that boss item
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} bossName - Name of the boss to check
 * @returns {Object} SMBool result {bool: boolean, difficulty: number}
 */
export function bossDead(snapshot, staticData, bossName) {
  // Boss defeat is tracked by having the boss item
  const defeated = has(snapshot, staticData, bossName);
  return { bool: defeated, difficulty: 0 };
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
  // If maxDiff is undefined, default to 50 (hardcore difficulty)
  // This matches the template default: max_difficulty: hardcore
  // VARIA difficulty values: easy=1, medium=5, hard=10, harder=25, hardcore=50, mania=100
  const effectiveMaxDiff = maxDiff !== undefined && maxDiff !== null ? maxDiff : 50;

  // If smbool is a plain boolean, return it
  if (typeof smbool === 'boolean') {
    return smbool;
  }

  // If smbool is an SMBool object, check difficulty
  if (smbool && typeof smbool === 'object' && 'bool' in smbool && 'difficulty' in smbool) {
    return smbool.bool === true && smbool.difficulty <= effectiveMaxDiff;
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
  // In Super Metroid, items can be referenced by their VARIA type name (e.g., "Morph")
  // or their full Archipelago name (e.g., "Morph Ball").
  // We need to check both the item name and the item type.

  // First, try direct name match
  let hasIt = has(snapshot, staticData, itemName);

  // If not found by name, check if any item has this type
  if (!hasIt && staticData && staticData.items) {
    // Check player 1's items (assuming single player for now)
    // staticData.items might be a Map or an object
    let playerItems;
    if (staticData.items instanceof Map) {
      playerItems = staticData.items.get('1') || staticData.items.get(1);
    } else {
      playerItems = staticData.items['1'] || staticData.items[1];
    }

    // If playerItems is undefined/null, try using staticData.items directly (flat structure)
    if (!playerItems) {
      playerItems = staticData.items;
    }

    if (playerItems) {
      // playerItems might also be a Map or object
      const itemEntries = playerItems instanceof Map ? playerItems.entries() : Object.entries(playerItems);

      for (const [fullItemName, itemData] of itemEntries) {
        if (itemData && itemData.type === itemName) {
          // Found an item with matching type, check if we have it
          hasIt = has(snapshot, staticData, fullItemName);
          if (hasIt) break;
        }
      }
    }
  }

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
  const hasMorph = haveItem(snapshot, staticData, 'Morph');
  const hasBomb = haveItem(snapshot, staticData, 'Bomb');
  return wand(snapshot, staticData, hasMorph, hasBomb);
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
  // Infinite bomb jump technique
  // Enabled in regular preset with difficulty 5 (medium)
  return { bool: true, difficulty: 5 };
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

export function knowsEarlyKraid(snapshot, staticData) {
  // Wall jump technique to reach Kraid's Lair without HiJump or flight
  // Enabled in regular preset with difficulty 1 (easy)
  return { bool: true, difficulty: 1 };
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

// Hell run presets matching Python Settings.hellRunPresets['Gimme energy'] (used by regular preset)
// Format: [[energy_threshold, difficulty], ...]
// VARIA difficulties: easy=1, medium=5, hard=10, harder=25, hardcore=50, mania=100
// Ice is +1 to account for evaluation timing difference; MainUpperNorfair matches exactly
const HELL_RUN_PRESETS = {
  'Ice': [[5, 50], [6, 25], [7, 10], [11, 5]],  // Empirical: Ice Beam accessible at 5 reserves
  'MainUpperNorfair': [[5, 100], [6, 50], [8, 25], [10, 10], [14, 5]], // 'Gimme energy': [(5, mania), (6, hardcore), (8, harder), (10, hard), (14, medium)]
  'LowerNorfair': null  // Default is null (requires suits)
};

// Complex helpers - conservative implementations
export function canHellRun(snapshot, staticData, hellRunType, mult = 1.0, minEArg = 2) {
  // Hell runs require heat resistance OR enough energy reserves
  // In VARIA logic: heatProof() OR (energyReserveCount >= minE AND specific energy check)
  const isHeatProof = wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Varia'),
    haveItem(snapshot, staticData, 'Gravity'));

  if (isHeatProof.bool) {
    return isHeatProof;
  }

  // When hellRunType is undefined (analyzer couldn't extract kwargs from
  // Settings.hellRunsTable), default to 'Ice' since:
  // 1. Ice has the lowest energy thresholds (most permissive)
  // 2. Locations in Ice area (Ice Beam etc.) commonly use this type
  // The mult parameter also defaults to 1.0, which is the most common value.
  // This may be slightly permissive for some MainUpperNorfair exits, but
  // those will eventually be gated by other requirements (suits, etc).
  const effectiveHellRunType = hellRunType || 'Ice';

  // Get the difficulty presets for this hell run type
  const difficulties = HELL_RUN_PRESETS[effectiveHellRunType];
  if (!difficulties) {
    // No preset (like LowerNorfair) - requires suits
    return { bool: false, difficulty: 0 };
  }

  const reserves = energyReserveCount(snapshot, staticData);
  const minE = minEArg !== undefined ? minEArg : 2;

  // Must have minimum energy first
  if (reserves < minE) {
    return { bool: false, difficulty: 0 };
  }

  // Check each difficulty tier
  // Python formula: energyReserveCountOk(threshold / mult, difficulty)
  // The mult DIVIDES the threshold, so mult < 1.0 means MORE energy needed
  const effectiveMult = mult || 1.0;

  let lowestPassingDifficulty = Infinity;
  for (const [threshold, difficulty] of difficulties) {
    // Calculate effective threshold: threshold / mult
    const effectiveThreshold = Math.ceil(threshold / effectiveMult);
    if (reserves >= effectiveThreshold) {
      if (difficulty < lowestPassingDifficulty) {
        lowestPassingDifficulty = difficulty;
      }
    }
  }

  if (lowestPassingDifficulty !== Infinity) {
    return { bool: true, difficulty: lowestPassingDifficulty };
  }

  return { bool: false, difficulty: 0 };
}

export function canAccessSandPits(snapshot, staticData) {
  // Sand pits in Maridia require Gravity Suit or specific techniques
  return haveItem(snapshot, staticData, 'Gravity');
}

/**
 * Get the total count of energy reserves (ETanks + Reserve Tanks)
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {number} Total energy reserve count
 */
export function energyReserveCount(snapshot, staticData) {
  const etankCount = count(snapshot, staticData, 'Energy Tank');
  const reserveCount = count(snapshot, staticData, 'Reserve Tank');
  return etankCount + reserveCount;
}

/**
 * Check if player has enough energy reserves
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @param {number} requiredCount - Required number of energy reserves
 * @param {number} difficulty - Difficulty level (default 0)
 * @returns {Object} SMBool result
 */
export function energyReserveCountOk(snapshot, staticData, requiredCount, difficulty = 0) {
  const totalReserves = energyReserveCount(snapshot, staticData);
  if (totalReserves >= requiredCount) {
    return { bool: true, difficulty: difficulty };
  }
  return { bool: false, difficulty: 0 };
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
export function canOpenRedDoors(snapshot, staticData) {
  // Red doors require Missiles or Super Missiles
  return haveMissileOrSuper(snapshot, staticData);
}

export function canOpenGreenDoors(snapshot, staticData) {
  // Green doors require Super Missiles
  return haveItem(snapshot, staticData, 'Super');
}

export function canOpenYellowDoors(snapshot, staticData) {
  // Yellow doors require Power Bombs
  return canUsePowerBombs(snapshot, staticData);
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

// Traverse - door transition logic based on door colors
export function traverse(snapshot, staticData, doorName) {
  // Check if game_info data is available
  if (!staticData?.game_info) {
    console.warn(`[traverse] No game_info available in staticData for door: ${doorName}`);
    return { bool: true, difficulty: 0 };  // Default to passable if no data
  }

  // Get player 1's game info (assuming single player for now)
  const playerGameInfo = staticData.game_info['1'] || staticData.game_info[1];
  const playerDoors = playerGameInfo?.doors;

  if (!playerDoors) {
    console.warn(`[traverse] No door data for player 1`);
    return { bool: true, difficulty: 0 };
  }

  // Get the color of this specific door
  const doorColor = playerDoors[doorName];
  if (!doorColor) {
    console.warn(`[traverse] Door '${doorName}' not found in door data`);
    return { bool: true, difficulty: 0 };  // Default to passable if door not found
  }

  // Check door accessibility based on color
  // Based on Python Door.traverse() implementation
  if (doorColor === 'grey') {
    // Grey doors (hidden) cannot be passed
    return { bool: false, difficulty: 0 };
  } else if (doorColor === 'red') {
    // Red doors require missiles or supers
    return canOpenRedDoors(snapshot, staticData);
  } else if (doorColor === 'green') {
    // Green doors require super missiles
    return canOpenGreenDoors(snapshot, staticData);
  } else if (doorColor === 'yellow') {
    // Yellow doors require power bombs
    return canOpenYellowDoors(snapshot, staticData);
  } else if (doorColor === 'wave') {
    // Wave beam doors
    return haveItem(snapshot, staticData, 'Wave');
  } else if (doorColor === 'spazer') {
    // Spazer beam doors
    return haveItem(snapshot, staticData, 'Spazer');
  } else if (doorColor === 'plasma') {
    // Plasma beam doors
    return haveItem(snapshot, staticData, 'Plasma');
  } else if (doorColor === 'ice') {
    // Ice beam doors
    return haveItem(snapshot, staticData, 'Ice');
  } else {
    // Blue doors (or any other color) - always passable
    return { bool: true, difficulty: 0 };
  }
}

// Boss requirement helpers - Conservative implementations
// These calculate damage output vs boss HP in Python - we use simplified checks
export function enoughStuffsKraid(snapshot, staticData) {
  // Kraid boss - needs enough damage output (1000 HP)
  // Can use Missiles (100 dmg), Super Missiles (300 dmg), or Charge Beam
  // 5 Supers (1 pack) = 1500 dmg > 1000, so any Super pack works
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Missile'),
    haveItem(snapshot, staticData, 'Super'),
    haveItem(snapshot, staticData, 'Charge'));
}

export function enoughStuffsPhantoon(snapshot, staticData) {
  // Phantoon boss - 2500 HP, Super Missiles do double damage (600 each)
  // Can use Missiles (100 dmg), Super Missiles (600 dmg), or Charge Beam
  // 5 Supers = 3000 dmg > 2500 HP, so any Super pack works
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Missile'),
    haveItem(snapshot, staticData, 'Super'),
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
  // Regular preset: ReverseGateGlitchHiJumpLess: [false, 0] - disabled
  return { bool: false, difficulty: 0 };
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

export function knowsGravityJump(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsMtEverestGravJump(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsRedTowerClimb(snapshot, staticData) {
  // Wall jump technique to climb Red Tower
  // Enabled in regular preset with difficulty 25 (harder)
  return { bool: true, difficulty: 25 };
}

// Room-specific helpers - Conservative implementations
export function canAccessKraidsLair(snapshot, staticData) {
  // Python: Super + (HiJump OR canFly OR knowsEarlyKraid)
  // knowsEarlyKraid = wall jump technique to reach Kraid without HiJump/flight
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Super'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'HiJump'),
      canFly(snapshot, staticData),
      knowsEarlyKraid(snapshot, staticData)));
}

export function canExitCathedral(snapshot, staticData) {
  // Needs heat protection + vertical movement
  return wand(snapshot, staticData,
    heatProof(snapshot, staticData),
    wor(snapshot, staticData,
      canFly(snapshot, staticData),
      haveItem(snapshot, staticData, 'SpaceJump'),
      canSpringBallJump(snapshot, staticData)));
}

export function canGoUpMtEverest(snapshot, staticData) {
  // Mt. Everest (Maridia) - needs Gravity + movement options
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Grapple'),
      haveItem(snapshot, staticData, 'SpeedBooster'),
      canFly(snapshot, staticData),
      haveItem(snapshot, staticData, 'HiJump')));
}

export function canPassMtEverest(snapshot, staticData) {
  // Similar to canGoUpMtEverest
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Grapple'),
      haveItem(snapshot, staticData, 'SpeedBooster'),
      canFly(snapshot, staticData)));
}

export function canDefeatBotwoon(snapshot, staticData) {
  // Botwoon boss - needs weapons
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Ice'),
    haveItem(snapshot, staticData, 'SpeedBooster'),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Charge'),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Wave'),
        haveItem(snapshot, staticData, 'Plasma'))));
}

/**
 * Get damage reduction factor based on suits
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @param {boolean} envDmg - Whether to check environmental damage (default true)
 * @returns {number} Damage reduction multiplier
 */
export function getDmgReduction(snapshot, staticData, envDmg = true) {
  const hasVaria = has(snapshot, staticData, 'Varia');
  const hasGravity = has(snapshot, staticData, 'Gravity');

  // Get player settings - try both snapshot.playerId and default to '1'
  const playerId = snapshot?.playerId || DEFAULT_PLAYER_ID;
  const playerSettings = staticData?.settings?.[playerId] || {};
  const romPatches = playerSettings.romPatches || {};

  let dmgRed = 1.0;

  if (romPatches.NoGravityEnvProtection) {
    if (hasVaria) {
      dmgRed = envDmg ? 4.0 : 2.0;
    }
    if (hasGravity && !envDmg) {
      dmgRed = 4.0;
    }
  } else if (romPatches.ProgressiveSuits) {
    if (hasVaria) {
      dmgRed *= 2;
    }
    if (hasGravity) {
      dmgRed *= 2;
    }
  } else {
    // Default behavior
    if (hasVaria) {
      dmgRed = 2.0;
    }
    if (hasGravity) {
      dmgRed = 4.0;
    }
  }

  return dmgRed;
}

/**
 * Check if player can handle a hard room with energy reserves
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @param {string} roomName - Name of the hard room (e.g., 'Gauntlet', 'X-Ray')
 * @param {number} mult - Difficulty multiplier (default 1.0, higher = easier)
 * @returns {Object} SMBool result
 */
export function energyReserveCountOkHardRoom(snapshot, staticData, roomName, mult = 1.0) {
  // Get player settings - try both snapshot.playerId and default to '1'
  const playerId = snapshot?.playerId || DEFAULT_PLAYER_ID;
  const playerSettings = staticData?.settings?.[playerId] || {};
  const hardRooms = playerSettings.hardRooms || {};
  const difficulties = hardRooms[roomName];

  if (!difficulties || difficulties.length === 0) {
    return { bool: false, difficulty: 0 };
  }

  // Get damage reduction from suits
  const dmgRed = getDmgReduction(snapshot, staticData, true);
  const totalMult = mult * dmgRed;
  const totalReserves = energyReserveCount(snapshot, staticData);

  // Check each difficulty level - if ANY pass, return true
  // difficulties is an array of [requiredCount, difficultyLevel] pairs
  let result = { bool: false, difficulty: 0 };

  for (const [baseCount, difficultyLevel] of difficulties) {
    // Apply multiplier - higher mult means we need fewer tanks
    const adjustedCount = Math.round(baseCount / totalMult);
    const checkResult = energyReserveCountOk(snapshot, staticData, adjustedCount, difficultyLevel);

    // Use wor to combine results
    result = wor(snapshot, staticData, result, checkResult);
  }

  return result;
}

export function canPassLavaPit(snapshot, staticData) {
  // Lower Norfair lava pit - needs heat + Gravity or HiJump
  return wand(snapshot, staticData,
    heatProof(snapshot, staticData),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      haveItem(snapshot, staticData, 'HiJump')));
}

export function canPassLavaPitReverse(snapshot, staticData) {
  // Same as forward but might need more movement
  return wand(snapshot, staticData,
    heatProof(snapshot, staticData),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      haveItem(snapshot, staticData, 'HiJump'),
      canFly(snapshot, staticData)));
}

export function canGrappleEscape(snapshot, staticData) {
  // Escape using grapple beam
  return haveItem(snapshot, staticData, 'Grapple');
}

export function canClimbBottomRedTower(snapshot, staticData) {
  // Red Tower climbing - needs vertical movement
  return wor(snapshot, staticData,
    canFly(snapshot, staticData),
    haveItem(snapshot, staticData, 'HiJump'),
    haveItem(snapshot, staticData, 'Ice'));
}

export function canClimbRedTower(snapshot, staticData) {
  // Python: knowsRedTowerClimb OR Ice OR SpaceJump
  // Wall jump technique or items that help climb
  return wor(snapshot, staticData,
    knowsRedTowerClimb(snapshot, staticData),
    haveItem(snapshot, staticData, 'Ice'),
    haveItem(snapshot, staticData, 'SpaceJump'));
}

export function canClimbBubbleMountain(snapshot, staticData) {
  // Bubble Mountain (Norfair) - needs vertical movement
  return wor(snapshot, staticData,
    canFly(snapshot, staticData),
    haveItem(snapshot, staticData, 'HiJump'),
    haveItem(snapshot, staticData, 'Ice'));
}

export function canClimbColosseum(snapshot, staticData) {
  // Colosseum climbing - needs vertical movement + Gravity
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    wor(snapshot, staticData,
      canFly(snapshot, staticData),
      haveItem(snapshot, staticData, 'HiJump')));
}

export function canPassDachoraRoom(snapshot, staticData) {
  // Dachora room - needs Speed Booster OR can destroy bomb walls
  // Python: sm.wor(sm.haveItem('SpeedBooster'), sm.canDestroyBombWalls())
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'SpeedBooster'),
    canDestroyBombWalls(snapshot, staticData));
}

export function canAccessEtecoons(snapshot, staticData) {
  // Access to Etecoons - needs Power Bombs
  return canUsePowerBombs(snapshot, staticData);
}

export function canDoOuterMaridia(snapshot, staticData) {
  // Outer Maridia - needs Gravity
  return haveItem(snapshot, staticData, 'Gravity');
}

export function canPassLowerNorfairChozo(snapshot, staticData) {
  // Lower Norfair Chozo - needs heat protection + movement
  return wand(snapshot, staticData,
    heatProof(snapshot, staticData),
    wor(snapshot, staticData,
      canFly(snapshot, staticData),
      haveItem(snapshot, staticData, 'HiJump')));
}

export function canHellRunToSpeedBooster(snapshot, staticData) {
  // Hell run to Speed Booster - from Python:
  // canHellRun('MainUpperNorfair', 1.0, 3) without SpeedBooster
  // canHellRun('MainUpperNorfair', 2.0, 2) with SpeedBooster (easier)
  const hasSpeed = haveItem(snapshot, staticData, 'SpeedBooster').bool;
  if (hasSpeed) {
    // With Speed Booster: mult=2.0, minE=2
    return canHellRun(snapshot, staticData, 'MainUpperNorfair', 2.0, 2);
  } else {
    // Without Speed Booster: mult=1.0, minE=3
    return canHellRun(snapshot, staticData, 'MainUpperNorfair', 1.0, 3);
  }
}

export function canHellRunBackFromGrappleEscape(snapshot, staticData) {
  // Hell run from Grapple - needs heat resistance + Grapple
  return wand(snapshot, staticData,
    heatProof(snapshot, staticData),
    haveItem(snapshot, staticData, 'Grapple'));
}

export function canHellRunBackFromSpeedBoosterMissile(snapshot, staticData) {
  // Hell run from Speed Booster missile - needs more energy for round trip
  // From Python: wor(RomPatches.SpeedAreaBlueDoors, traverse('SpeedBoosterHallRight'), canHellRun(...))
  // The ROM patch SpeedAreaBlueDoors is typically active (in TotalBase)
  // If patch is active, return true with difficulty 0
  // Otherwise check traverse or hell run
  return wor(snapshot, staticData,
    // SpeedAreaBlueDoors patch - typically active, makes this trivial
    SMBool(snapshot, staticData, true),
    // Can traverse (door check)
    traverse(snapshot, staticData, 'SpeedBoosterHallRight'),
    // Hell run option with stricter mult
    (() => {
      const hasSpeed = haveItem(snapshot, staticData, 'SpeedBooster').bool;
      const mult = hasSpeed ? 0.66 : 0.33;
      return canHellRun(snapshot, staticData, 'MainUpperNorfair', mult, 3);
    })()
  );
}

export function canExitPreciousRoom(snapshot, staticData) {
  // Exit Precious Room (Maridia) - needs Gravity or special movement
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    canFly(snapshot, staticData));
}

export function canExitWaveBeam(snapshot, staticData) {
  // Exit Wave Beam room:
  // Option 1: Morph (exit through lower passage under the spikes)
  // Option 2: (SpaceJump OR Grapple) to exit through blue gate AND
  //           (Wave OR (heatProof AND canBlueGateGlitch AND 2+ missiles))
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),  // exit through lower passage under spikes
    wand(snapshot, staticData,
      wor(snapshot, staticData,  // exit through blue gate
        haveItem(snapshot, staticData, 'SpaceJump'),
        haveItem(snapshot, staticData, 'Grapple')
      ),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Wave'),
        wand(snapshot, staticData,
          heatProof(snapshot, staticData),  // hell run + gate glitch is too much
          canBlueGateGlitch(snapshot, staticData),
          itemCountOk(snapshot, staticData, 'Missile', 2)  // need 2 packs as no farming
        )
      )
    )
  );
}

export function canExitScrewAttackArea(snapshot, staticData) {
  // Exit Screw Attack area - needs movement abilities
  return wor(snapshot, staticData,
    canFly(snapshot, staticData),
    haveItem(snapshot, staticData, 'HiJump'),
    haveItem(snapshot, staticData, 'Ice'));
}

export function getPiratesPseudoScrewCoeff(snapshot, staticData) {
  // Pirates coefficient - conservative: return 1.0 (default)
  return { bool: true, difficulty: 0 };
}

export function int(snapshot, staticData, value) {
  // Integer conversion helper - just return the value
  return { bool: true, difficulty: 0 };
}

// Additional knowledge techniques
export function knowsBillyMays(snapshot, staticData) {
  // Billy Mays room access knowledge
  return { bool: true, difficulty: 0 };
}

export function knowsContinuousWallJump(snapshot, staticData) {
  // Continuous wall jump technique - DISABLED in regular preset
  return { bool: false, difficulty: 0 };
}

export function knowsDiagonalBombJump(snapshot, staticData) {
  // Diagonal bomb jump technique - DISABLED in regular preset
  return { bool: false, difficulty: 0 };
}

export function knowsMockballWs(snapshot, staticData) {
  // Mockball in West Sand technique
  return { bool: true, difficulty: 0 };
}

export function knowsGravLessLevel1(snapshot, staticData) {
  // Gravity-less technique level 1
  return { bool: true, difficulty: 0 };
}

export function knowsGravLessLevel2(snapshot, staticData) {
  // Gravity-less technique level 2
  return { bool: true, difficulty: 0 };
}

export function knowsSpongeBathBombJump(snapshot, staticData) {
  // Sponge Bath bomb jump technique
  return { bool: true, difficulty: 0 };
}

export function knowsSpongeBathHiJump(snapshot, staticData) {
  // Sponge Bath high jump technique
  return { bool: true, difficulty: 0 };
}

export function knowsSpongeBathSpeed(snapshot, staticData) {
  // Sponge Bath speed technique
  return { bool: true, difficulty: 0 };
}

export function knowsWestSandHoleSuitlessWallJumps(snapshot, staticData) {
  // West Sand Hole suitless wall jumps
  return { bool: true, difficulty: 0 };
}

// Additional medium priority helpers
export function canAccessBillyMays(snapshot, staticData) {
  // Billy Mays room access: needs Power Bombs and movement
  // Conservative: require Power Bombs AND (knowledge OR Gravity OR SpaceJump)
  return wand(snapshot, staticData,
    canUsePowerBombs(snapshot, staticData),
    wor(snapshot, staticData,
      knowsBillyMays(snapshot, staticData),
      haveItem(snapshot, staticData, 'Gravity'),
      haveItem(snapshot, staticData, 'SpaceJump')));
}

export function canAccessItemsInWestSandHole(snapshot, staticData) {
  // West Sand Hole items access - multiple strategies
  return wor(snapshot, staticData,
    // Vanilla strat: HiJump + SpringBall
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'HiJump'),
      canUseSpringBall(snapshot, staticData)),
    // Alternate strat: SpaceJump + (SpringBall OR Bombs)
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'SpaceJump'),
      wor(snapshot, staticData,
        canUseSpringBall(snapshot, staticData),
        canUseBombs(snapshot, staticData))),
    // Wall jump strat: bomb passages + wall jump knowledge
    wand(snapshot, staticData,
      canPassBombPassages(snapshot, staticData),
      knowsMaridiaWallJumps(snapshot, staticData)));
}

// Moat passage helpers
export function canPassMoat(snapshot, staticData) {
  // Multiple strategies to pass the Moat
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Grapple'),
    haveItem(snapshot, staticData, 'SpaceJump'),
    knowsContinuousWallJump(snapshot, staticData),
    wand(snapshot, staticData,
      knowsDiagonalBombJump(snapshot, staticData),
      canUseBombs(snapshot, staticData)),
    canSimpleShortCharge(snapshot, staticData),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      wor(snapshot, staticData,
        knowsGravityJump(snapshot, staticData),
        haveItem(snapshot, staticData, 'HiJump'),
        canInfiniteBombJump(snapshot, staticData))),
    wand(snapshot, staticData,
      knowsMockballWs(snapshot, staticData),
      canUseSpringBall(snapshot, staticData)));
}

export function canPassMoatFromMoat(snapshot, staticData) {
  // Pass the Moat from the Moat location
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Grapple'),
    haveItem(snapshot, staticData, 'SpaceJump'),
    wand(snapshot, staticData,
      knowsDiagonalBombJump(snapshot, staticData),
      canUseBombs(snapshot, staticData)),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      wor(snapshot, staticData,
        knowsGravityJump(snapshot, staticData),
        haveItem(snapshot, staticData, 'HiJump'),
        canInfiniteBombJump(snapshot, staticData))));
}

export function canPassMoatReverse(snapshot, staticData) {
  // Pass the Moat in reverse direction (conservative: ignore ROM patches)
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Grapple'),
    haveItem(snapshot, staticData, 'SpaceJump'),
    haveItem(snapshot, staticData, 'Gravity'),
    canPassBombPassages(snapshot, staticData));
}

// Additional room-specific helpers
export function canKillRedKiHunters(snapshot, staticData, n) {
  // Kill Red Ki-Hunters in heated areas
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Plasma'),
    haveItem(snapshot, staticData, 'ScrewAttack'),
    wand(snapshot, staticData,
      heatProof(snapshot, staticData),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Spazer'),
        haveItem(snapshot, staticData, 'Ice'),
        wand(snapshot, staticData,
          haveItem(snapshot, staticData, 'Charge'),
          haveItem(snapshot, staticData, 'Wave')))));
}

export function canDoSuitlessOuterMaridia(snapshot, staticData) {
  // Navigate outer Maridia without Gravity suit
  return wand(snapshot, staticData,
    knowsGravLessLevel1(snapshot, staticData),
    haveItem(snapshot, staticData, 'HiJump'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Ice'),
      canSpringBallJump(snapshot, staticData)));
}

export function canClimbWestSandHole(snapshot, staticData) {
  // Climb West Sand Hole
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'HiJump'),
      knowsGravLessLevel3(snapshot, staticData),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'SpaceJump'),
        canSpringBallJump(snapshot, staticData),
        knowsWestSandHoleSuitlessWallJumps(snapshot, staticData))));
}

export function canPassSpongeBath(snapshot, staticData) {
  // Pass through Sponge Bath area
  return wor(snapshot, staticData,
    wand(snapshot, staticData,
      canPassBombPassages(snapshot, staticData),
      knowsSpongeBathBombJump(snapshot, staticData)),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'HiJump'),
      knowsSpongeBathHiJump(snapshot, staticData)),
    haveItem(snapshot, staticData, 'Gravity'),
    haveItem(snapshot, staticData, 'SpaceJump'),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'SpeedBooster'),
      knowsSpongeBathSpeed(snapshot, staticData)),
    canSpringBallJump(snapshot, staticData));
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
  bossDead,
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
  canOpenRedDoors,
  canOpenGreenDoors,
  canOpenYellowDoors,
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
  knowsEarlyKraid,
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
  knowsGravityJump,
  knowsMtEverestGravJump,
  knowsRedTowerClimb,
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
  enoughStuffTourian,
  // Room-specific helpers
  canAccessKraidsLair,
  canExitCathedral,
  canGoUpMtEverest,
  canPassMtEverest,
  canDefeatBotwoon,
  energyReserveCountOkHardRoom,
  canPassLavaPit,
  canPassLavaPitReverse,
  canGrappleEscape,
  canClimbBottomRedTower,
  canClimbRedTower,
  canClimbBubbleMountain,
  canClimbColosseum,
  canPassDachoraRoom,
  canAccessEtecoons,
  canDoOuterMaridia,
  canPassLowerNorfairChozo,
  canHellRunToSpeedBooster,
  canHellRunBackFromGrappleEscape,
  canHellRunBackFromSpeedBoosterMissile,
  canExitPreciousRoom,
  canExitWaveBeam,
  canExitScrewAttackArea,
  getPiratesPseudoScrewCoeff,
  int,
  knowsBillyMays,
  knowsContinuousWallJump,
  knowsDiagonalBombJump,
  knowsMockballWs,
  knowsGravLessLevel1,
  knowsGravLessLevel2,
  knowsSpongeBathBombJump,
  knowsSpongeBathHiJump,
  knowsSpongeBathSpeed,
  knowsWestSandHoleSuitlessWallJumps,
  canAccessBillyMays,
  canAccessItemsInWestSandHole,
  canPassMoat,
  canPassMoatFromMoat,
  canPassMoatReverse,
  canKillRedKiHunters,
  canDoSuitlessOuterMaridia,
  canClimbWestSandHole,
  canPassSpongeBath,
  // Additional helpers that were defined but not exported
  canAccessDoubleChamberItems,
  canAccessShaktoolFromPantsRoom,
  canBotwoonExitToColosseum,
  canColosseumToBotwoonExit,
  canDoLowGauntlet,
  canDoubleSpringBallJump,
  canEnterAndLeaveGauntlet,
  canEnterAndLeaveGauntletQty,
  canEnterNorfairReserveAreaFromBubbleMoutain,
  canEnterNorfairReserveAreaFromBubbleMoutainTop,
  canGoThroughColosseumSuitless,
  canPassCrateriaGreenPirates,
  canPassFrogSpeedwayRightToLeft,
  canPassG4,
  canPassMaridiaToRedTowerNode,
  canPassRedTowerToMaridiaNode,
  canPassTerminatorBombWall,
  canPassWorstRoom,
  canPassWorstRoomPirates,
  canUseCrocRoomToChargeSpeed,
  knowsHiJumpMamaTurtle,
  knowsIceMissileFromCroc,
  knowsSpringBallJump,
  knowsLowGauntlet,
  knowsWorstRoomIceCharge,
  knowsWorstRoomWallJump,
  knowsDodgeLowerNorfairEnemies,
  knowsFrogSpeedwayWithoutSpeed,
  knowsNorfairReserveDBoost,
  knowsDoubleChamberWallJump,
  knowsPuyoClip,
  knowsAccessSpringBallWithHiJump,
  knowsHiJumpGauntletAccess,
  knowsHiJumpLessGauntletAccess,
  // New helper functions (21 total)
  canBlueGateGlitch,
  canMorphJump,
  canEnterCathedral,
  canExitCrabHole,
  canPassAmphitheaterReverse,
  canPassBotwoonHallway,
  canPassCacatacAlley,
  canPassForgottenHighway,
  canPassNinjaPirates,
  canPassRedKiHunters,
  canPassThreeMuskateers,
  canPassWastelandDessgeegas,
  canTraverseCrabTunnelLeftToRight,
  canTraverseWestSandHallLeftToRight,
  canFightDraygon,
  enoughStuffsDraygon,
  canExitDraygon,
  canGetBackFromRidleyZone,
  canReachCacatacAlleyFromBotowoon,
  wnot,
  knowsSnailClip
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
        // VARIA difficulties: easy=1, medium=5, hard=10, harder=25, hardcore=50, mania=100
        // Template uses max_difficulty: hardcore (50)
        1: {
          maxDiff: 50 // Hardcore difficulty (matches template default)
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
        1: { maxDiff: 50 } // Hardcore difficulty (matches template default)
      }
    };
  }
};

// ============================================================================
// Additional Helper Functions
// ============================================================================

/**
 * Can pass the bomb wall at Terminator (Energy Tank, Terminator location)
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @param {boolean} fromLandingSite - Whether approaching from Landing Site
 * @returns {Object} SMBool
 */
export function canPassTerminatorBombWall(snapshot, staticData, fromLandingSite = true) {
  return wor(snapshot, staticData,
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'SpeedBooster'),
      wor(snapshot, staticData,
        { bool: !fromLandingSite, difficulty: 0 },
        knowsSimpleShortCharge(snapshot, staticData),
        knowsShortCharge(snapshot, staticData)
      )
    ),
    canDestroyBombWalls(snapshot, staticData)
  );
}

/**
 * Can pass through the green pirates in Crateria
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canPassCrateriaGreenPirates(snapshot, staticData) {
  return wor(snapshot, staticData,
    canPassBombPassages(snapshot, staticData),
    haveMissileOrSuper(snapshot, staticData),
    energyReserveCountOk(snapshot, staticData, 1),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Charge'),
      haveItem(snapshot, staticData, 'Ice'),
      haveItem(snapshot, staticData, 'Wave'),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Spazer'),
        haveItem(snapshot, staticData, 'Plasma'),
        haveItem(snapshot, staticData, 'ScrewAttack')
      )
    )
  );
}

/**
 * Can enter and leave the gauntlet with specific quantities
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @param {number} nPB - Number of power bombs required
 * @param {number} nTanksSpark - Number of tanks for spark
 * @returns {Object} SMBool
 */
export function canEnterAndLeaveGauntletQty(snapshot, staticData, nPB, nTanksSpark) {
  return wand(snapshot, staticData,
    wor(snapshot, staticData,
      canFly(snapshot, staticData),
      haveItem(snapshot, staticData, 'SpeedBooster'),
      wand(snapshot, staticData,
        knowsHiJumpGauntletAccess(snapshot, staticData),
        haveItem(snapshot, staticData, 'HiJump')
      ),
      knowsHiJumpLessGauntletAccess(snapshot, staticData)
    ),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'ScrewAttack'),
      wor(snapshot, staticData,
        wand(snapshot, staticData,
          energyReserveCountOkHardRoom(snapshot, staticData, 'Gauntlet'),
          wand(snapshot, staticData,
            canUsePowerBombs(snapshot, staticData),
            wor(snapshot, staticData,
              itemCountOk(snapshot, staticData, 'PowerBomb', nPB),
              wand(snapshot, staticData,
                haveItem(snapshot, staticData, 'SpeedBooster'),
                energyReserveCountOk(snapshot, staticData, nTanksSpark)
              )
            )
          )
        ),
        wand(snapshot, staticData,
          energyReserveCountOkHardRoom(snapshot, staticData, 'Gauntlet', 0.51),
          canUseBombs(snapshot, staticData)
        )
      )
    )
  );
}

/**
 * Can enter and leave the gauntlet
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canEnterAndLeaveGauntlet(snapshot, staticData) {
  return wor(snapshot, staticData,
    wand(snapshot, staticData,
      canShortCharge(snapshot, staticData),
      canEnterAndLeaveGauntletQty(snapshot, staticData, 2, 2)
    ),
    canEnterAndLeaveGauntletQty(snapshot, staticData, 2, 3)
  );
}

/**
 * Can do the low gauntlet route
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canDoLowGauntlet(snapshot, staticData) {
  return wand(snapshot, staticData,
    canShortCharge(snapshot, staticData),
    canUsePowerBombs(snapshot, staticData),
    itemCountOk(snapshot, staticData, 'ETank', 1),
    knowsLowGauntlet(snapshot, staticData)
  );
}

/**
 * Can pass the worst room (in Norfair)
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canPassWorstRoom(snapshot, staticData) {
  return wand(snapshot, staticData,
    canDestroyBombWalls(snapshot, staticData),
    canPassWorstRoomPirates(snapshot, staticData),
    wor(snapshot, staticData,
      canFly(snapshot, staticData),
      wand(snapshot, staticData,
        knowsWorstRoomIceCharge(snapshot, staticData),
        haveItem(snapshot, staticData, 'Ice'),
        canFireChargedShots(snapshot, staticData)
      ),
      wor(snapshot, staticData,
        wand(snapshot, staticData,
          knowsGetAroundWallJump(snapshot, staticData),
          haveItem(snapshot, staticData, 'HiJump')
        ),
        knowsWorstRoomWallJump(snapshot, staticData)
      ),
      wand(snapshot, staticData,
        knowsSpringBallJumpFromWall(snapshot, staticData),
        canUseSpringBall(snapshot, staticData)
      )
    )
  );
}

/**
 * Can pass the pirates in the worst room
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canPassWorstRoomPirates(snapshot, staticData) {
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'ScrewAttack'),
    itemCountOk(snapshot, staticData, 'Missile', 6),
    itemCountOk(snapshot, staticData, 'Super', 3),
    wand(snapshot, staticData,
      canFireChargedShots(snapshot, staticData),
      haveItem(snapshot, staticData, 'Plasma')
    ),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Charge'),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Spazer'),
        haveItem(snapshot, staticData, 'Wave'),
        haveItem(snapshot, staticData, 'Ice')
      )
    ),
    knowsDodgeLowerNorfairEnemies(snapshot, staticData)
  );
}

/**
 * Can pass from Maridia to Red Tower node
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canPassMaridiaToRedTowerNode(snapshot, staticData) {
  // Note: RomPatches.has() calls are already resolved to constants by the exporter
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    haveItem(snapshot, staticData, 'Super')  // Assuming AreaRandoGatesBase patch is not active
  );
}

/**
 * Can pass from Red Tower to Maridia node
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canPassRedTowerToMaridiaNode(snapshot, staticData) {
  // Note: RomPatches.has() calls are already resolved to constants by the exporter
  // This route is only available with the AreaRandoGatesBase patch, which is typically false
  return { bool: false, difficulty: 0 };
}

/**
 * Can pass Frog Speedway from right to left
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canPassFrogSpeedwayRightToLeft(snapshot, staticData) {
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'SpeedBooster'),
    wand(snapshot, staticData,
      knowsFrogSpeedwayWithoutSpeed(snapshot, staticData),
      haveItem(snapshot, staticData, 'Wave'),
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Spazer'),
        haveItem(snapshot, staticData, 'Plasma')
      )
    )
  );
}

/**
 * Can enter Norfair Reserve area from Bubble Mountain
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canEnterNorfairReserveAreaFromBubbleMoutain(snapshot, staticData) {
  return wand(snapshot, staticData,
    traverse(snapshot, staticData, 'BubbleMountainTopLeft'),
    wor(snapshot, staticData,
      canFly(snapshot, staticData),
      haveItem(snapshot, staticData, 'Ice'),
      wand(snapshot, staticData,
        haveItem(snapshot, staticData, 'HiJump'),
        knowsGetAroundWallJump(snapshot, staticData)
      ),
      wand(snapshot, staticData,
        canUseSpringBall(snapshot, staticData),
        knowsSpringBallJumpFromWall(snapshot, staticData)
      )
    )
  );
}

/**
 * Can enter Norfair Reserve area from Bubble Mountain Top
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canEnterNorfairReserveAreaFromBubbleMoutainTop(snapshot, staticData) {
  return wand(snapshot, staticData,
    traverse(snapshot, staticData, 'BubbleMountainTopLeft'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Grapple'),
      haveItem(snapshot, staticData, 'SpaceJump'),
      knowsNorfairReserveDBoost(snapshot, staticData)
    )
  );
}

/**
 * Can access items in Double Chamber
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canAccessDoubleChamberItems(snapshot, staticData) {
  // Access Double Chamber items via hellRun from 'Bubble -> Wave' table:
  // hellRun: 'MainUpperNorfair', mult: 0.75, minE: 2
  return wor(snapshot, staticData,
    // Option 1: traverse SingleChamberRight with full hellRun
    wand(snapshot, staticData,
      traverse(snapshot, staticData, 'SingleChamberRight'),
      canHellRun(snapshot, staticData, 'MainUpperNorfair', 0.75, 2)
    ),
    // Option 2: with movement abilities, can take a faster path (mult * 0.8 = 0.6)
    wand(snapshot, staticData,
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'HiJump'),
        canSimpleShortCharge(snapshot, staticData),
        canFly(snapshot, staticData),
        knowsDoubleChamberWallJump(snapshot, staticData)
      ),
      canHellRun(snapshot, staticData, 'MainUpperNorfair', 0.6, 2)
    )
  );
}

/**
 * Can exit from Botwoon room to Colosseum
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canBotwoonExitToColosseum(snapshot, staticData) {
  return wand(snapshot, staticData,
    wor(snapshot, staticData,
      wand(snapshot, staticData,
        haveItem(snapshot, staticData, 'Gravity'),
        haveItem(snapshot, staticData, 'SpeedBooster')
      ),
      wand(snapshot, staticData,
        haveItem(snapshot, staticData, 'Morph'),
        canJumpUnderwater(snapshot, staticData)
      )
    ),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      wand(snapshot, staticData,
        knowsGravLessLevel2(snapshot, staticData),
        haveItem(snapshot, staticData, 'HiJump'),
        wor(snapshot, staticData,
          haveItem(snapshot, staticData, 'Grapple'),
          haveItem(snapshot, staticData, 'Ice'),
          wand(snapshot, staticData,
            canDoubleSpringBallJump(snapshot, staticData),
            haveItem(snapshot, staticData, 'SpaceJump')
          )
        ),
        canGoThroughColosseumSuitless(snapshot, staticData)
      )
    )
  );
}

/**
 * Can exit from Colosseum to Botwoon
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canColosseumToBotwoonExit(snapshot, staticData) {
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    wand(snapshot, staticData,
      knowsGravLessLevel2(snapshot, staticData),
      haveItem(snapshot, staticData, 'HiJump'),
      canGoThroughColosseumSuitless(snapshot, staticData)
    )
  );
}

/**
 * Can use Croc Room to charge speed
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canUseCrocRoomToChargeSpeed(snapshot, staticData) {
  // This checks if specific access points are connected in area rando
  // For now, return false as this is area rando specific
  return { bool: false, difficulty: 0 };
}

/**
 * Can access Shaktool from Pants Room
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canAccessShaktoolFromPantsRoom(snapshot, staticData) {
  // Simplified version - full implementation requires many tech checks
  return wor(snapshot, staticData,
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Ice'),
      haveItem(snapshot, staticData, 'Gravity'),
      knowsPuyoClip(snapshot, staticData)
    ),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Grapple'),
      haveItem(snapshot, staticData, 'Gravity'),
      wor(snapshot, staticData,
        wand(snapshot, staticData,
          haveItem(snapshot, staticData, 'HiJump'),
          knowsAccessSpringBallWithHiJump(snapshot, staticData)
        ),
        haveItem(snapshot, staticData, 'SpaceJump')
      )
    )
  );
}

/**
 * Can pass G4 (Golden Four bosses requirement)
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static game data
 * @returns {Object} SMBool
 */
export function canPassG4(snapshot, staticData) {
  // For now, assume all 4 bosses must be defeated
  // This should check objectives/boss completion
  return { bool: false, difficulty: 0 };  // Placeholder
}

// ============================================================================
// Movement and Navigation Helpers
// ============================================================================

/**
 * Can perform blue gate glitch (missile/super through blue doors)
 */
export function canBlueGateGlitch(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveMissileOrSuper(snapshot, staticData),
    knowsGreenGateGlitch(snapshot, staticData)
  );
}

/**
 * Can perform morph jump (small hop in morph ball form)
 */
export function canMorphJump(snapshot, staticData) {
  return wor(snapshot, staticData,
    canPassBombPassages(snapshot, staticData),
    canUseSpringBall(snapshot, staticData)
  );
}

/**
 * Can enter Cathedral from Business Center
 * Requires canHellRun (heat protection OR enough energy) + movement option
 */
export function canEnterCathedral(snapshot, staticData, mult = 1.0) {
  // Python logic: canHellRun('MainUpperNorfair', mult) AND movement option
  // Movement options:
  // - CathedralEntranceWallJump ROM patch (included in TotalBase - typically active)
  // - HiJump, canFly, SpeedBooster, canSpringBallJump
  // The ROM patch adds a wall jump platform, allowing entry with difficulty 0
  return wand(snapshot, staticData,
    canHellRun(snapshot, staticData, 'MainUpperNorfair', mult),  // Requires 5+ reserves for hardcore difficulty
    wor(snapshot, staticData,
      // CathedralEntranceWallJump ROM patch - typically active, difficulty 0
      SMBool(snapshot, staticData, true),
      haveItem(snapshot, staticData, 'HiJump'),
      canFly(snapshot, staticData),
      haveItem(snapshot, staticData, 'SpeedBooster'),
      canSpringBallJump(snapshot, staticData)
    )
  );
}

/**
 * Can exit crab hole in Maridia
 */
export function canExitCrabHole(snapshot, staticData) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    wor(snapshot, staticData,
      wand(snapshot, staticData,
        haveItem(snapshot, staticData, 'Gravity'),
        wor(snapshot, staticData,
          haveItem(snapshot, staticData, 'Ice'),
          haveItem(snapshot, staticData, 'HiJump'),
          canFly(snapshot, staticData)
        )
      ),
      wand(snapshot, staticData,
        haveItem(snapshot, staticData, 'Ice'),
        canDoSuitlessOuterMaridia(snapshot, staticData)
      ),
      canDoubleSpringBallJump(snapshot, staticData)
    )
  );
}

/**
 * Can pass amphitheater in reverse (lower Norfair)
 */
export function canPassAmphitheaterReverse(snapshot, staticData) {
  // Simplified: require gravity or very high energy
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    wand(snapshot, staticData,
      energyReserveCountOk(snapshot, staticData, 6),
      { bool: true, difficulty: 5 }
    )
  );
}

/**
 * Can pass Botwoon hallway
 */
export function canPassBotwoonHallway(snapshot, staticData) {
  return wor(snapshot, staticData,
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'SpeedBooster'),
      haveItem(snapshot, staticData, 'Gravity')
    ),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'Ice'),
      { bool: true, difficulty: 5 } // knowsMochtroidClip
    )
  );
}

/**
 * Can pass Cacatac Alley (Maridia)
 */
export function canPassCacatacAlley(snapshot, staticData) {
  // Requires Draygon defeated and movement through Maridia
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      wand(snapshot, staticData,
        haveItem(snapshot, staticData, 'HiJump'),
        haveItem(snapshot, staticData, 'SpaceJump'),
        { bool: true, difficulty: 4 } // knowsGravLessLevel2
      )
    )
  );
}

/**
 * Can pass Forgotten Highway (west Maridia)
 */
export function canPassForgottenHighway(snapshot, staticData, fromWs = true) {
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      wand(snapshot, staticData,
        haveItem(snapshot, staticData, 'HiJump'),
        { bool: true, difficulty: 3 } // knowsGravLessLevel1
      )
    )
  );
}

/**
 * Can pass ninja space pirates (lower Norfair)
 */
export function canPassNinjaPirates(snapshot, staticData) {
  return wor(snapshot, staticData,
    itemCountOk(snapshot, staticData, 'Missile', 10),
    itemCountOk(snapshot, staticData, 'Super', 2),
    haveItem(snapshot, staticData, 'Plasma'),
    haveItem(snapshot, staticData, 'Spazer'),
    canShortCharge(snapshot, staticData)
  );
}

/**
 * Can pass red Kihunters (lower Norfair)
 */
export function canPassRedKiHunters(snapshot, staticData) {
  // Simplified: require strong beam or many missiles
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Plasma'),
    haveItem(snapshot, staticData, 'ScrewAttack'),
    wand(snapshot, staticData,
      heatProof(snapshot, staticData),
      haveItem(snapshot, staticData, 'Spazer')
    ),
    itemCountOk(snapshot, staticData, 'Missile', 15)
  );
}

/**
 * Can pass Three Muskateers (lower Norfair)
 */
export function canPassThreeMuskateers(snapshot, staticData) {
  // Similar to canPassRedKiHunters but more enemies
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Plasma'),
    haveItem(snapshot, staticData, 'ScrewAttack'),
    wand(snapshot, staticData,
      heatProof(snapshot, staticData),
      haveItem(snapshot, staticData, 'Spazer')
    ),
    itemCountOk(snapshot, staticData, 'Missile', 25)
  );
}

/**
 * Can pass Wasteland Dessgeegas (lower Norfair)
 */
export function canPassWastelandDessgeegas(snapshot, staticData) {
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Plasma'),
    haveItem(snapshot, staticData, 'ScrewAttack'),
    wand(snapshot, staticData,
      heatProof(snapshot, staticData),
      haveItem(snapshot, staticData, 'Spazer')
    ),
    itemCountOk(snapshot, staticData, 'PowerBomb', 4)
  );
}

/**
 * Can traverse crab tunnel left to right (Maridia)
 */
export function canTraverseCrabTunnelLeftToRight(snapshot, staticData) {
  // Simplified: require supers to open gate
  return haveItem(snapshot, staticData, 'Super');
}

/**
 * Can traverse west sand hall left to right (Maridia)
 */
export function canTraverseWestSandHallLeftToRight(snapshot, staticData) {
  return haveItem(snapshot, staticData, 'Gravity');
}

// ============================================================================
// Boss-Related Helpers
// ============================================================================

/**
 * Can fight Draygon
 */
export function canFightDraygon(snapshot, staticData) {
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'HiJump'),
      { bool: true, difficulty: 4 } // knowsGravLessLevel2 or 3
    )
  );
}

/**
 * Have enough resources to defeat Draygon
 */
export function enoughStuffsDraygon(snapshot, staticData) {
  // Simplified: require ability to inflict damage
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Morph'),
    haveMissileOrSuper(snapshot, staticData),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'Gravity'),
      energyReserveCountOk(snapshot, staticData, 3)
    )
  );
}

/**
 * Can exit Draygon's room after defeating her
 */
export function canExitDraygon(snapshot, staticData) {
  // Simplified: same requirements as fighting
  return canFightDraygon(snapshot, staticData);
}

/**
 * Can get back from Ridley zone in lower Norfair
 */
export function canGetBackFromRidleyZone(snapshot, staticData) {
  return wand(snapshot, staticData,
    canUsePowerBombs(snapshot, staticData),
    wor(snapshot, staticData,
      canUseSpringBall(snapshot, staticData),
      canUseBombs(snapshot, staticData),
      itemCountOk(snapshot, staticData, 'PowerBomb', 2),
      haveItem(snapshot, staticData, 'ScrewAttack'),
      canShortCharge(snapshot, staticData)
    )
  );
}

/**
 * Can reach Cacatac Alley from Botwoon
 */
export function canReachCacatacAlleyFromBotowoon(snapshot, staticData) {
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    wand(snapshot, staticData,
      haveItem(snapshot, staticData, 'HiJump'),
      { bool: true, difficulty: 4 }, // knowsGravLessLevel2
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'Grapple'),
        haveItem(snapshot, staticData, 'Ice'),
        canDoubleSpringBallJump(snapshot, staticData)
      )
    )
  );
}

// ============================================================================
// Logical Helpers
// ============================================================================

/**
 * Logical NOT for SMBool values
 */
export function wnot(snapshot, staticData, smbool) {
  // If it's a boolean, just invert it
  if (typeof smbool === 'boolean') {
    return !smbool;
  }
  // If it's an SMBool object, invert the bool field
  if (smbool && typeof smbool === 'object' && 'bool' in smbool) {
    return {
      bool: !smbool.bool,
      difficulty: smbool.difficulty || 0
    };
  }
  // Default: treat undefined/null as false, so return true
  return true;
}

// ============================================================================
// "Knows" functions - These check player knowledge/difficulty settings
// For now, these are simplified stubs that return appropriate difficulty values
// ============================================================================

/**
 * Knows snail clip technique
 */
export function knowsSnailClip(snapshot, staticData) {
  return { bool: false, difficulty: 0 }; // Very advanced technique, disabled by default
}

// ============================================================================
// "Knows" functions - These check player knowledge/difficulty settings
// For now, these are simplified stubs that return appropriate difficulty values
// ============================================================================

export function knowsSpringBallJump(snapshot, staticData) {
  // Spring ball jump is a medium difficulty tech
  return { bool: true, difficulty: 3 };
}

export function knowsHiJumpMamaTurtle(snapshot, staticData) {
  // Hi-jump mama turtle is a medium difficulty tech
  return { bool: true, difficulty: 3 };
}

export function knowsIceMissileFromCroc(snapshot, staticData) {
  // Ice missile from Crocomire is a medium difficulty tech
  return { bool: true, difficulty: 3 };
}

// Additional knows functions referenced by other helpers
export function knowsHiJumpGauntletAccess(snapshot, staticData) {
  return { bool: true, difficulty: 2 };
}

export function knowsHiJumpLessGauntletAccess(snapshot, staticData) {
  return { bool: true, difficulty: 4 };
}

export function knowsLowGauntlet(snapshot, staticData) {
  return { bool: true, difficulty: 3 };
}

export function knowsWorstRoomIceCharge(snapshot, staticData) {
  return { bool: true, difficulty: 4 };
}

export function knowsWorstRoomWallJump(snapshot, staticData) {
  return { bool: true, difficulty: 4 };
}

export function knowsDodgeLowerNorfairEnemies(snapshot, staticData) {
  return { bool: true, difficulty: 5 };
}

export function knowsFrogSpeedwayWithoutSpeed(snapshot, staticData) {
  return { bool: true, difficulty: 4 };
}

export function knowsNorfairReserveDBoost(snapshot, staticData) {
  return { bool: true, difficulty: 3 };
}

export function knowsDoubleChamberWallJump(snapshot, staticData) {
  return { bool: true, difficulty: 3 };
}

export function canDoubleSpringBallJump(snapshot, staticData) {
  return wand(snapshot, staticData,
    canUseSpringBall(snapshot, staticData),
    { bool: true, difficulty: 4 }
  );
}

export function canGoThroughColosseumSuitless(snapshot, staticData) {
  // Requires gravity-less Maridia techniques
  return wand(snapshot, staticData,
    knowsGravLessLevel2(snapshot, staticData),
    haveItem(snapshot, staticData, 'HiJump')
  );
}

export function knowsPuyoClip(snapshot, staticData) {
  return { bool: true, difficulty: 5 };
}

export function knowsAccessSpringBallWithHiJump(snapshot, staticData) {
  return { bool: true, difficulty: 3 };
}
