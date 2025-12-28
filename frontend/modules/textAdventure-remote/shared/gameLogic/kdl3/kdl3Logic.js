/**
 * Kirby's Dream Land 3 helper functions for rule evaluation.
 *
 * This module provides JavaScript implementations of complex helper functions
 * that cannot be automatically exported from Python due to their use of
 * loops, iterators, and dynamic function dispatch.
 */

import { helperFunctions as genericHelpers } from '../generic/genericLogic.js';

/**
 * The restrictive enemy/ability pairs for Sand Canyon 6 (R.O.B. assembly).
 * This matches enemy_abilities.enemy_restrictive[1:5] from Python.
 * Each entry is [allowedAbilities, bukisetEnemies].
 */
const ENEMY_RESTRICTIVE_ROB = [
  [["Parasol Ability", "Cutter Ability"], ["Bukiset (Parasol)", "Bukiset (Cutter)"]],
  [["Spark Ability", "Clean Ability"], ["Bukiset (Spark)", "Bukiset (Clean)"]],
  [["Ice Ability", "Needle Ability"], ["Bukiset (Ice)", "Bukiset (Needle)"]],
  [["Stone Ability", "Burning Ability"], ["Bukiset (Stone)", "Bukiset (Burning)"]],
];

/**
 * Enemies required for fixing angel wings (Iceberg 6 - Angel location).
 */
const ANGEL_WINGS_ENEMIES = [
  "Sparky", "Blocky", "Jumper Shoot", "Yuki",
  "Sir Kibble", "Haboki", "Boboo", "Captain Stitch"
];

/**
 * Map from ability names to their item requirements.
 * Each ability requires both the base item and the ability item.
 */
const ABILITY_REQUIREMENTS = {
  "No Ability": null,  // Always reachable
  "Burning Ability": ["Burning", "Burning Ability"],
  "Stone Ability": ["Stone", "Stone Ability"],
  "Ice Ability": ["Ice", "Ice Ability"],
  "Needle Ability": ["Needle", "Needle Ability"],
  "Clean Ability": ["Clean", "Clean Ability"],
  "Parasol Ability": ["Parasol", "Parasol Ability"],
  "Spark Ability": ["Spark", "Spark Ability"],
  "Cutter Ability": ["Cutter", "Cutter Ability"],
};

/**
 * Animal friend requirements - each needs both the animal and spawn items.
 */
const ANIMAL_REQUIREMENTS = {
  "Rick": ["Rick", "Rick Spawn"],
  "Kine": ["Kine", "Kine Spawn"],
  "Coo": ["Coo", "Coo Spawn"],
  "Nago": ["Nago", "Nago Spawn"],
  "ChuChu": ["ChuChu", "ChuChu Spawn"],
  "Pitch": ["Pitch", "Pitch Spawn"],
};

/**
 * Map from level numbers to level names.
 * Used for can_reach_boss to construct stage completion item names.
 */
const LEVEL_NAMES_INVERSE = {
  1: "Grass Land",
  2: "Ripple Field",
  3: "Sand Canyon",
  4: "Cloudy Park",
  5: "Iceberg",
};

/**
 * Helper to check if player has an item.
 */
function hasItem(snapshot, itemName) {
  // Check inventory
  if (snapshot?.inventory?.[itemName] > 0) {
    return true;
  }
  // Check flags
  if (snapshot?.flags?.includes(itemName)) {
    return true;
  }
  // Check events
  if (snapshot?.events?.includes(itemName)) {
    return true;
  }
  return false;
}

/**
 * Helper to count how many of an item the player has.
 * @param {Object} snapshot - Game state snapshot
 * @param {string} itemName - Name of the item to count
 * @returns {number} Count of the item
 */
function countItem(snapshot, itemName) {
  // Check inventory for actual count
  const invCount = snapshot?.inventory?.[itemName] || 0;
  if (invCount > 0) {
    return invCount;
  }
  // For flags and events, they're binary (0 or 1)
  if (snapshot?.flags?.includes(itemName)) {
    return 1;
  }
  if (snapshot?.events?.includes(itemName)) {
    return 1;
  }
  return 0;
}

/**
 * Check if player can reach a specific ability.
 * Requires both the base ability item and the ability itself.
 * @param {Object} snapshot - Game state snapshot
 * @param {string} abilityName - Name of the ability (e.g., "Burning Ability")
 * @returns {boolean} True if ability is reachable
 */
function canReachAbility(snapshot, abilityName) {
  // "No Ability" is always reachable
  if (abilityName === "No Ability") {
    return true;
  }

  const requirements = ABILITY_REQUIREMENTS[abilityName];
  if (!requirements) {
    // Unknown ability - assume not reachable
    return false;
  }

  // Check both items required for this ability
  const [baseItem, abilityItem] = requirements;
  return hasItem(snapshot, baseItem) && hasItem(snapshot, abilityItem);
}

/**
 * Check if player can reach a specific animal friend.
 * Requires both the animal item and its spawn item.
 * @param {Object} snapshot - Game state snapshot
 * @param {string} animalName - Name of the animal (e.g., "Rick")
 * @returns {boolean} True if animal is reachable
 */
function canReachAnimal(snapshot, animalName) {
  const requirements = ANIMAL_REQUIREMENTS[animalName];
  if (!requirements) {
    return false;
  }
  const [animalItem, spawnItem] = requirements;
  return hasItem(snapshot, animalItem) && hasItem(snapshot, spawnItem);
}

/**
 * Get copy_abilities mapping from settings or argument.
 * @param {Object} staticData - Static game data
 * @param {string|number} playerId - Player ID
 * @param {Object} [copyAbilitiesArg] - Optional copy_abilities passed as argument
 * @returns {Object} Map from enemy name to ability name
 */
function getCopyAbilities(staticData, playerId, copyAbilitiesArg) {
  // If passed as argument, use that
  if (copyAbilitiesArg && typeof copyAbilitiesArg === 'object') {
    return copyAbilitiesArg;
  }
  // Otherwise get from settings
  const playerIdKey = String(playerId || '1');
  return staticData?.world?.[playerIdKey]?.copy_abilities || {};
}

/**
 * Check if player can assemble R.O.B. in Sand Canyon 6.
 *
 * Requirements:
 * 1. Must have Coo and Kine animal friends
 * 2. For each of 4 Bukiset pairs, at least one Bukiset must:
 *    - Have an ability in the allowed abilities list (via copy_abilities mapping)
 *    - And that ability must be reachable
 * 3. Must have Parasol and Stone abilities
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data (contains settings with copy_abilities)
 * @param {Object} [copyAbilitiesArg] - copy_abilities passed from rule args
 * @returns {boolean} True if R.O.B. can be assembled
 */
function can_assemble_rob(snapshot, staticData, copyAbilitiesArg) {
  // Check animal requirements: need both Coo and Kine
  if (!canReachAnimal(snapshot, "Coo") || !canReachAnimal(snapshot, "Kine")) {
    return false;
  }

  // Get copy_abilities from argument or settings
  const playerId = snapshot?.player?.id || snapshot?.player?.slot || '1';
  const copyAbilities = getCopyAbilities(staticData, playerId, copyAbilitiesArg);

  // Check each restrictive pair
  for (const [allowedAbilities, bukisets] of ENEMY_RESTRICTIVE_ROB) {
    // Find bukisets that have an ability in the allowed list
    // and check if we can reach at least one of those abilities
    let canReachAny = false;

    for (const bukiset of bukisets) {
      const enemyAbility = copyAbilities[bukiset];
      // Check if this bukiset's ability is in the allowed list
      if (allowedAbilities.includes(enemyAbility)) {
        // Check if we can reach this ability
        if (canReachAbility(snapshot, enemyAbility)) {
          canReachAny = true;
          break;  // Found one that works
        }
      }
    }

    // If none of the bukisets in this pair have a reachable allowed ability, fail
    if (!canReachAny) {
      return false;
    }
  }

  // Finally, check the known needed abilities: Parasol and Stone
  return canReachAbility(snapshot, "Parasol Ability") &&
         canReachAbility(snapshot, "Stone Ability");
}

/**
 * Check if player can fix the angel wings in Iceberg 6.
 *
 * Requires the ability to reach ALL abilities from specific enemies:
 * Sparky, Blocky, Jumper Shoot, Yuki, Sir Kibble, Haboki, Boboo, Captain Stitch
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data (contains settings with copy_abilities)
 * @param {Object} [copyAbilitiesArg] - copy_abilities passed from rule args
 * @returns {boolean} True if angel wings can be fixed
 */
function can_fix_angel_wings(snapshot, staticData, copyAbilitiesArg) {
  // Get copy_abilities from argument or settings
  const playerId = snapshot?.player?.id || snapshot?.player?.slot || '1';
  const copyAbilities = getCopyAbilities(staticData, playerId, copyAbilitiesArg);

  // Must be able to reach ALL abilities from the required enemies
  for (const enemy of ANGEL_WINGS_ENEMIES) {
    const enemyAbility = copyAbilities[enemy];
    if (!canReachAbility(snapshot, enemyAbility)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if player can reach the boss of a specific level.
 *
 * When open_world is enabled:
 * - Must have at least ow_boss_requirement instances of "{LevelName} - Stage Completion"
 *
 * When open_world is disabled:
 * - Must be able to reach the 6th stage location (player_levels[level][5])
 *
 * Python source: worlds/kdl3/rules.py:14-19
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {number} level - Level number (1-5)
 * @param {boolean|string|number} openWorld - Whether open world mode is enabled
 * @param {number} owBossReq - Number of stage completions required to reach boss
 * @param {Object} playerLevels - Dictionary mapping level numbers to location ID arrays
 * @returns {boolean} True if boss can be reached
 */
function can_reach_boss(snapshot, staticData, level, openWorld, owBossReq, playerLevels) {
  // Handle various truthy values for open_world setting
  const isOpenWorld = openWorld === true || openWorld === "true" || openWorld === 1 || openWorld === "1";

  if (isOpenWorld) {
    // In open world mode, check if player has enough stage completions
    const levelName = LEVEL_NAMES_INVERSE[level];
    if (!levelName) {
      console.warn(`[can_reach_boss] Unknown level: ${level}`);
      return false;
    }

    const stageCompletionItem = `${levelName} - Stage Completion`;

    // Count how many stage completions we have
    const completionCount = countItem(snapshot, stageCompletionItem);

    // Need at least ow_boss_requirement completions
    return completionCount >= (owBossReq || 0);
  } else {
    // In non-open world mode, need to reach the 6th stage location
    // The location at player_levels[level][5] represents stage 6
    const levelKey = String(level);
    const levelLocations = playerLevels?.[level] || playerLevels?.[levelKey];

    if (!levelLocations || !Array.isArray(levelLocations) || levelLocations.length < 6) {
      console.warn(`[can_reach_boss] Invalid playerLevels for level ${level}`);
      return false;
    }

    // Get the 6th stage location ID
    const stage6LocationId = levelLocations[5];

    // Look up the location name from the ID and check if it's reachable
    const playerId = snapshot?.player?.id || snapshot?.player?.slot || staticData?.playerId || '1';
    const playerIdStr = String(playerId);
    const regions = staticData?.regions?.[playerIdStr];

    if (regions) {
      for (const regionName in regions) {
        const region = regions[regionName];
        if (region?.locations) {
          for (const loc of region.locations) {
            if (loc.id === stage6LocationId) {
              // Found the location - check if it's in the checked/accessible locations
              const locationName = loc.name;
              // Check if we've already checked this location or if it's accessible
              return snapshot?.flags?.includes(locationName) ||
                     snapshot?.accessibleLocations?.includes?.(locationName) ||
                     snapshot?.reachableLocations?.includes?.(locationName) ||
                     false;
            }
          }
        }
      }
    }

    // Couldn't find the location - return false as a safety default
    return false;
  }
}

/**
 * Exported helper functions for KDL3.
 * Extends generic helpers with KDL3-specific complex helpers.
 */
export const helperFunctions = {
  // Include all generic helpers (has, count, etc.)
  ...genericHelpers,

  // KDL3-specific complex helpers
  can_assemble_rob,
  can_fix_angel_wings,
  can_reach_boss,

  // Expose ability/animal reach functions in case they're needed directly
  can_reach_burning(snapshot, staticData) {
    return canReachAbility(snapshot, "Burning Ability");
  },
  can_reach_stone(snapshot, staticData) {
    return canReachAbility(snapshot, "Stone Ability");
  },
  can_reach_ice(snapshot, staticData) {
    return canReachAbility(snapshot, "Ice Ability");
  },
  can_reach_needle(snapshot, staticData) {
    return canReachAbility(snapshot, "Needle Ability");
  },
  can_reach_clean(snapshot, staticData) {
    return canReachAbility(snapshot, "Clean Ability");
  },
  can_reach_parasol(snapshot, staticData) {
    return canReachAbility(snapshot, "Parasol Ability");
  },
  can_reach_spark(snapshot, staticData) {
    return canReachAbility(snapshot, "Spark Ability");
  },
  can_reach_cutter(snapshot, staticData) {
    return canReachAbility(snapshot, "Cutter Ability");
  },
  can_reach_rick(snapshot, staticData) {
    return canReachAnimal(snapshot, "Rick");
  },
  can_reach_kine(snapshot, staticData) {
    return canReachAnimal(snapshot, "Kine");
  },
  can_reach_coo(snapshot, staticData) {
    return canReachAnimal(snapshot, "Coo");
  },
  can_reach_nago(snapshot, staticData) {
    return canReachAnimal(snapshot, "Nago");
  },
  can_reach_chuchu(snapshot, staticData) {
    return canReachAnimal(snapshot, "ChuChu");
  },
  can_reach_pitch(snapshot, staticData) {
    return canReachAnimal(snapshot, "Pitch");
  },
};
