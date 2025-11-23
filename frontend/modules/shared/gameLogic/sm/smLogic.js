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
  const result = (snapshot.inventory[itemName] || 0) > 0;

  if (typeof console !== 'undefined' && console.log && itemName === 'Morph Ball') {
    const keys = Object.keys(snapshot.inventory);
    console.log(`[has] Morph Ball check: count=${snapshot.inventory[itemName]}, result=${result}, totalItems=${keys.length}`);
    console.log(`[has] Sample inventory keys: ${keys.slice(0, 10).join(', ')}`);
    console.log(`[has] Morphing Ball? ${snapshot.inventory['Morphing Ball']}`);
  }

  return result;
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
  // Debug logging
  if (typeof console !== 'undefined' && console.log) {
    console.log('[evalSMBool] Called with:', {
      smbool,
      maxDiff,
      hasSmbm: !!snapshot?.smbm,
      smbm: snapshot?.smbm
    });
  }

  // If smbool is a plain boolean, return it
  if (typeof smbool === 'boolean') {
    return smbool;
  }

  // If smbool is an SMBool object, check difficulty
  if (smbool && typeof smbool === 'object' && 'bool' in smbool && 'difficulty' in smbool) {
    const result = smbool.bool === true && smbool.difficulty <= maxDiff;
    if (typeof console !== 'undefined' && console.log) {
      console.log('[evalSMBool] SMBool check:', {
        bool: smbool.bool,
        difficulty: smbool.difficulty,
        maxDiff,
        comparison: smbool.difficulty <= maxDiff,
        result
      });
    }
    return result;
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

  if (typeof console !== 'undefined' && console.log && itemName === 'Morph') {
    console.log('[haveItem] Checking for Morph:', {
      itemName,
      hasDirectMatch: hasIt,
      hasStaticData: !!staticData,
      hasItems: !!staticData?.items,
      itemsIsMap: staticData?.items instanceof Map,
      itemsKeys: staticData?.items ? (staticData.items instanceof Map ? Array.from(staticData.items.keys()).slice(0,5) : Object.keys(staticData.items).slice(0,5)) : []
    });
  }

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

    if (itemName === 'Morph' && typeof console !== 'undefined' && console.log) {
      console.log('[haveItem] Player items:', {
        isMap: playerItems instanceof Map,
        itemCount: playerItems ? (playerItems instanceof Map ? playerItems.size : Object.keys(playerItems).length) : 0
      });
    }

    if (playerItems) {
      // playerItems might also be a Map or object
      const itemEntries = playerItems instanceof Map ? playerItems.entries() : Object.entries(playerItems);

      for (const [fullItemName, itemData] of itemEntries) {
        if (itemData && itemData.type === itemName) {
          if (itemName === 'Morph' && typeof console !== 'undefined' && console.log) {
            console.log('[haveItem] Found item with matching type:', {
              fullItemName,
              type: itemData.type,
              checkingInventory: true
            });
          }
          // Found an item with matching type, check if we have it
          hasIt = has(snapshot, staticData, fullItemName);
          if (itemName === 'Morph' && typeof console !== 'undefined' && console.log) {
            console.log('[haveItem] Inventory check result:', hasIt);
          }
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

export function knowsGravityJump(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

export function knowsMtEverestGravJump(snapshot, staticData) {
  return { bool: true, difficulty: 0 };
}

// Room-specific helpers - Conservative implementations
export function canAccessKraidsLair(snapshot, staticData) {
  // Needs Super Missiles + vertical movement (HiJump or fly)
  return wand(snapshot, staticData,
    haveItem(snapshot, staticData, 'Super'),
    wor(snapshot, staticData,
      haveItem(snapshot, staticData, 'HiJump'),
      canFly(snapshot, staticData)));
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

export function energyReserveCountOkHardRoom(snapshot, staticData, roomName) {
  // Hard rooms need energy reserves - conservative: require Varia or Gravity
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Varia'),
    haveItem(snapshot, staticData, 'Gravity'));
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
  // Red Tower climbing - needs vertical movement
  return wor(snapshot, staticData,
    canFly(snapshot, staticData),
    haveItem(snapshot, staticData, 'HiJump'),
    haveItem(snapshot, staticData, 'Ice'));
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
  // Dachora room - needs Speed Booster
  return haveItem(snapshot, staticData, 'SpeedBooster');
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
  // Hell run to Speed Booster - needs heat resistance
  return heatProof(snapshot, staticData);
}

export function canHellRunBackFromGrappleEscape(snapshot, staticData) {
  // Hell run from Grapple - needs heat resistance + Grapple
  return wand(snapshot, staticData,
    heatProof(snapshot, staticData),
    haveItem(snapshot, staticData, 'Grapple'));
}

export function canHellRunBackFromSpeedBoosterMissile(snapshot, staticData) {
  // Hell run from Speed Booster missile - needs heat resistance
  return heatProof(snapshot, staticData);
}

export function canExitPreciousRoom(snapshot, staticData) {
  // Exit Precious Room (Maridia) - needs Gravity or special movement
  return wor(snapshot, staticData,
    haveItem(snapshot, staticData, 'Gravity'),
    canFly(snapshot, staticData));
}

export function canExitWaveBeam(snapshot, staticData) {
  // Exit Wave Beam room - needs Morph + bombs or similar
  return canPassBombPassages(snapshot, staticData);
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
  // Continuous wall jump technique
  return { bool: true, difficulty: 0 };
}

export function knowsDiagonalBombJump(snapshot, staticData) {
  // Diagonal bomb jump technique
  return { bool: true, difficulty: 0 };
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
  canPassSpongeBath
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
  // Simplified - needs hellRun implementation
  return wor(snapshot, staticData,
    wand(snapshot, staticData,
      traverse(snapshot, staticData, 'SingleChamberRight'),
      canHellRun(snapshot, staticData, 'MainUpperNorfair', 1.0)
    ),
    wand(snapshot, staticData,
      wor(snapshot, staticData,
        haveItem(snapshot, staticData, 'HiJump'),
        canSimpleShortCharge(snapshot, staticData),
        canFly(snapshot, staticData),
        knowsDoubleChamberWallJump(snapshot, staticData)
      ),
      canHellRun(snapshot, staticData, 'MainUpperNorfair', 0.8)
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
