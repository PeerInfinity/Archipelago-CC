/**
 * A Hat in Time game logic functions
 * These functions are called from rules.json helper calls
 */

import { DEFAULT_PLAYER_ID } from '../../playerIdUtils.js';

/**
 * Check if player has an item, handling progressive items
 * @param {Object} snapshot - Canonical state snapshot
 * @param {string} itemName - Name of the item to check
 * @param {Object} staticData - Static game data including progressionMapping
 * @returns {boolean} True if player has the item
 */
export function has(snapshot, staticData, itemName) {
  // First check if it's in flags (events, checked locations, etc.)
  if (snapshot.flags && snapshot.flags.includes(itemName)) {
    return true;
  }

  // Also check state.events (promoted from state.state.events)
  if (snapshot.events && snapshot.events.includes(itemName)) {
    return true;
  }

  // Check inventory
  if (!snapshot.inventory) return false;

  // Direct item check
  if ((snapshot.inventory[itemName] || 0) > 0) {
    return true;
  }

  // Check progressive items
  if (staticData && staticData.progressionMapping) {
    for (const [progressiveBase, progression] of Object.entries(staticData.progressionMapping)) {
      const baseCount = snapshot.inventory[progressiveBase] || 0;
      if (baseCount > 0 && progression && progression.items) {
        for (const upgrade of progression.items) {
          if (baseCount >= upgrade.level) {
            if (upgrade.name === itemName ||
                (upgrade.provides && upgrade.provides.includes(itemName))) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Count how many of an item the player has
 * @param {Object} snapshot - Canonical state snapshot
 * @param {string} itemName - Name of the item to count
 * @param {Object} staticData - Static game data
 * @returns {number} Number of items
 */
export function count(snapshot, staticData, itemName) {
  if (!snapshot.inventory) return 0;
  return snapshot.inventory[itemName] || 0;
}

/**
 * Check if painting shuffle logic is enabled
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {any} itemName - Not used for this helper
 * @returns {boolean}
 */
export function painting_logic(snapshot, staticData, itemName) {
  const playerSlot = snapshot?.player?.id || snapshot?.player?.slot || staticData?.playerId || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.ShuffleSubconPaintings ?? false;
}

/**
 * Get the current difficulty setting
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {any} itemName - Not used for this helper
 * @returns {number} -1=Normal, 0=Moderate, 1=Hard, 2=Expert
 */
export function get_difficulty(snapshot, staticData, itemName) {
  const playerSlot = snapshot?.player?.id || snapshot?.player?.slot || staticData?.playerId || DEFAULT_PLAYER_ID;
  const settings = staticData?.settings?.[playerSlot];
  return settings?.LogicDifficulty ?? -1;
}

/**
 * Check if a required act can be completed
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} actEntrance - The entrance name for the act
 * @returns {boolean}
 */
export function can_clear_required_act(snapshot, staticData, actEntrance) {
  if (!actEntrance) {
    return false;
  }

  // Handle constant value wrapper
  if (typeof actEntrance === 'object' && actEntrance?.type === 'constant') {
    actEntrance = actEntrance.value;
  }

  if (!staticData || !staticData.regions) {
    return false;
  }

  // Find the connected region from the entrance
  let connectedRegion = null;
  for (const [regionName, region] of staticData.regions) {
    if (region.exits) {
      for (const exit of region.exits) {
        if (exit.name === actEntrance) {
          connectedRegion = exit.connected_region;
          break;
        }
      }
    }
    if (connectedRegion) break;
  }

  if (!connectedRegion) {
    return false;
  }

  // Find the Act Completion location
  const actCompletionName = `Act Completion (${connectedRegion})`;
  let actCompletionLocation = null;

  if (staticData && staticData.locations) {
    actCompletionLocation = staticData.locations.get(actCompletionName);
  }

  if (!actCompletionLocation && staticData && staticData.regions) {
    for (const [regionName, region] of staticData.regions) {
      if (region && region.locations) {
        const loc = region.locations.find(l => l.name === actCompletionName);
        if (loc) {
          actCompletionLocation = loc;
          break;
        }
      }
    }
  }

  // Check region reachability
  let regionReachable = false;
  if (snapshot.regionReachability && snapshot.regionReachability[connectedRegion] !== undefined) {
    regionReachable = snapshot.regionReachability[connectedRegion] === true ||
                      snapshot.regionReachability[connectedRegion] === 'reachable';
  }

  // Free Roam regions are always clearable if reachable
  if (connectedRegion.includes("Free Roam")) {
    return regionReachable;
  }

  // If Act Completion has constant true access rule, check for parent region reachability
  if (actCompletionLocation &&
      actCompletionLocation.access_rule &&
      actCompletionLocation.access_rule.type === 'constant' &&
      actCompletionLocation.access_rule.value === true) {
    if (staticData && staticData.regions) {
      for (const [parentRegionName, parentRegion] of staticData.regions.entries()) {
        if (parentRegion && parentRegion.exits) {
          for (const exit of parentRegion.exits) {
            if (exit.connected_region === connectedRegion) {
              if (exit.access_rule &&
                  exit.access_rule.type === 'constant' &&
                  exit.access_rule.value === true) {
                const parentReachable = snapshot.regionReachability &&
                  (snapshot.regionReachability[parentRegionName] === true ||
                   snapshot.regionReachability[parentRegionName] === 'reachable');
                if (parentReachable) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }

  if (!regionReachable) {
    return false;
  }

  if (!actCompletionLocation) {
    return false;
  }

  if (!actCompletionLocation.access_rule) {
    return true;
  }

  if (snapshot.evaluateRule) {
    const result = snapshot.evaluateRule(actCompletionLocation.access_rule);
    return result === true;
  }

  return false;
}

/**
 * Get the yarn cost for a specific hat based on craft order
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {number} hatType - The hat type to check cost for
 * @returns {number} Total yarn cost
 */
export function get_hat_cost(snapshot, staticData, hatType) {
  const playerSlot = snapshot?.player?.id || snapshot?.player?.slot || staticData?.playerId || DEFAULT_PLAYER_ID;
  if (!staticData || !staticData.game_info || !staticData.game_info[playerSlot] || !staticData.game_info[playerSlot].hat_info) {
    return 0;
  }

  const hatInfo = staticData.game_info[playerSlot].hat_info;
  const hatYarnCosts = hatInfo.hat_yarn_costs || {};
  const hatCraftOrder = hatInfo.hat_craft_order || [];

  let cost = 0;
  for (const h of hatCraftOrder) {
    cost += hatYarnCosts[String(h)] || 0;
    if (h === hatType) {
      break;
    }
  }

  return cost;
}

/**
 * Check if player can use a specific hat
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string|number} hatType - The hat type to check
 * @returns {boolean}
 */
export function can_use_hat(snapshot, staticData, hatType) {
  const hatEnumToItem = {
    0: 'Sprint Hat',
    1: 'Brewing Hat',
    2: 'Ice Hat',
    3: 'Dweller Mask',
    4: 'Time Stop Hat'
  };

  const hatNameToItem = {
    'Sprint': 'Sprint Hat',
    'Brewing': 'Brewing Hat',
    'Ice': 'Ice Hat',
    'Dweller': 'Dweller Mask',
    'Time Stop': 'Time Stop Hat'
  };

  let itemName;
  let hatTypeNum;
  if (typeof hatType === 'number') {
    hatTypeNum = hatType;
    itemName = hatEnumToItem[hatType];
  } else {
    itemName = hatNameToItem[hatType];
    for (const [num, name] of Object.entries(hatEnumToItem)) {
      if (name === itemName) {
        hatTypeNum = parseInt(num);
        break;
      }
    }
  }

  if (!itemName) {
    return false;
  }

  // Check if HatItems option is enabled
  const playerSlot = snapshot?.player?.id || snapshot?.player?.slot || staticData?.playerId || DEFAULT_PLAYER_ID;
  const hatItemsEnabled = staticData?.settings?.[playerSlot]?.HatItems;
  if (hatItemsEnabled) {
    return has(snapshot, staticData, itemName);
  }

  // HatItems is disabled, check Yarn count instead
  if (hatTypeNum !== undefined) {
    const hatInfo = staticData?.game_info?.[playerSlot]?.hat_info;
    if (hatInfo && hatInfo.hat_yarn_costs) {
      const hatYarnCost = hatInfo.hat_yarn_costs[String(hatTypeNum)];
      if (hatYarnCost !== undefined && hatYarnCost <= 0) {
        return true;
      }

      const requiredYarn = get_hat_cost(snapshot, staticData, hatTypeNum);
      const yarnCount = count(snapshot, staticData, 'Yarn');
      return yarnCount >= requiredYarn;
    }
  }

  return has(snapshot, staticData, itemName);
}

/**
 * Check if player has all items in a relic combo group
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} relicGroup - The relic group name
 * @returns {boolean}
 */
export function has_relic_combo(snapshot, staticData, relicGroup) {
  const playerSlot = snapshot?.player?.id || snapshot?.player?.slot || staticData?.playerId || DEFAULT_PLAYER_ID;
  const relicGroups = staticData?.game_info?.[playerSlot]?.relic_groups;
  if (!relicGroups || !relicGroups[relicGroup]) {
    return false;
  }

  const itemsInGroup = relicGroups[relicGroup];
  for (const itemName of itemsInGroup) {
    if (!has(snapshot, staticData, itemName)) {
      return false;
    }
  }

  return true;
}

// Helper function registry - only export functions actually called from rules
export const helperFunctions = {
  // Core utilities (used by other helpers)
  has,
  count,

  // Called directly from rules
  painting_logic,
  get_difficulty,
  can_clear_required_act,
  can_use_hat,
  has_relic_combo,

  // Dependencies of called helpers
  get_hat_cost,
};
