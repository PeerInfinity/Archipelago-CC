/**
 * Secret of Evermore game logic functions
 *
 * SOE uses pyevermizer's progress system where items and rules provide
 * progress IDs. The main helper function `has` checks if the player has
 * collected enough items to reach a certain progress count.
 */

/**
 * Internal cache for progress counts to avoid recalculation
 * Reset this when state changes
 */
let progressCountCache = null;
let lastInventoryHash = null;

/**
 * Create a simple hash of inventory for cache invalidation
 */
function hashInventory(inventory) {
  if (!inventory) return '{}';
  return JSON.stringify(Object.entries(inventory).sort());
}

/**
 * Count how many units of a progress ID the player has
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data including items with provides
 * @param {number} progressId - Progress ID to count
 * @param {number} maxCount - Stop counting once this is reached (optimization)
 * @returns {number} Count of progress units
 */
function countProgress(snapshot, staticData, progressId, maxCount = 0) {
  if (!snapshot || !staticData) return 0;

  const inventory = snapshot.inventory || {};
  const items = staticData.items?.[1] || {};

  // Check if we need to rebuild the cache
  const currentHash = hashInventory(inventory);
  if (progressCountCache === null || lastInventoryHash !== currentHash) {
    progressCountCache = new Map();
    lastInventoryHash = currentHash;
  }

  // Check cache first
  const cacheKey = `${progressId}_${maxCount}`;
  if (progressCountCache.has(cacheKey)) {
    return progressCountCache.get(cacheKey);
  }

  let count = 0;

  // Count progress from items in inventory
  for (const [itemName, itemCount] of Object.entries(inventory)) {
    if (itemCount > 0) {
      const itemData = items[itemName];
      if (itemData && itemData.provides) {
        for (const provide of itemData.provides) {
          if (provide.progress_id === progressId) {
            count += itemCount * provide.count;
            if (maxCount > 0 && count >= maxCount) {
              progressCountCache.set(cacheKey, count);
              return count;
            }
          }
        }
      }
    }
  }

  // Count progress from logic rules
  const logicRules = items.__soe_logic_rules__;
  if (logicRules && logicRules.rules) {
    for (const rule of logicRules.rules) {
      // Check if all requirements are met
      let requirementsMet = true;
      for (const req of rule.requires) {
        // Recursively check if we have enough of the required progress
        const hasEnough = has(snapshot, staticData, req.progress_id, req.count);
        if (!hasEnough) {
          requirementsMet = false;
          break;
        }
      }

      // If requirements are met, add the provides to our count
      if (requirementsMet) {
        for (const provide of rule.provides) {
          if (provide.progress_id === progressId) {
            count += provide.count;
            if (maxCount > 0 && count >= maxCount) {
              progressCountCache.set(cacheKey, count);
              return count;
            }
          }
        }
      }
    }
  }

  progressCountCache.set(cacheKey, count);
  return count;
}

/**
 * Check if the player has reached a certain progress count
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {number} progressId - Progress ID to check
 * @param {number} requiredCount - Required count (default: 1)
 * @returns {boolean} True if player has enough progress
 */
export function has(snapshot, staticData, progressId, requiredCount = 1) {
  // Special handling for P_ALLOW_OOB (25) and P_ALLOW_SEQUENCE_BREAKS (26)
  // These are controlled by settings
  const settings = staticData?.settings?.[1];

  if (progressId === 25) { // P_ALLOW_OOB
    // Check if out_of_bounds is set to 'logic' (option value 2)
    return settings?.out_of_bounds === 2;
  }

  if (progressId === 26) { // P_ALLOW_SEQUENCE_BREAKS
    // Check if sequence_breaks is set to 'logic' (option value 2)
    return settings?.sequence_breaks === 2;
  }

  // For energy core fragments mode
  if (progressId === 9) { // P_ENERGY_CORE
    // Check if we're in fragments mode
    if (settings?.energy_core === 1) { // fragments mode
      // Use P_CORE_FRAGMENT (10) instead and required_fragments count
      const requiredFragments = settings?.required_fragments || 21;
      progressId = 10; // P_CORE_FRAGMENT
      requiredCount = requiredFragments;
    }
  }

  const count = countProgress(snapshot, staticData, progressId, requiredCount);
  return count >= requiredCount;
}

/**
 * Count how many of an item the player has
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to count
 * @returns {number} Count of the item
 */
export function count(snapshot, staticData, itemName) {
  if (!snapshot || !snapshot.inventory) return 0;
  return snapshot.inventory[itemName] || 0;
}

/**
 * Get the item placed at a specific location (for self-locking logic)
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data (contains locations with item data)
 * @param {string} locationName - Name of the location to check
 * @returns {Array|null} Array of [itemName, playerId] or null if no item
 */
export function location_item_name(snapshot, staticData, locationName) {
  const regions = staticData?.regions?.[1];
  if (!regions) return null;

  // Search through all regions for the location
  for (const region of Object.values(regions)) {
    if (!region.locations) continue;

    const location = region.locations.find(loc => loc?.name === locationName);
    if (location && location.item) {
      return [location.item.name, location.item.player];
    }
  }

  return null;
}

/**
 * Helper functions object for game logic registry
 */
export const helperFunctions = {
  has,
  count,
  location_item_name
};
