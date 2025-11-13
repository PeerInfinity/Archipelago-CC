/**
 * Thread-agnostic Jak and Daxter: The Precursor Legacy game logic functions
 * These pure functions operate on a canonical state object and return results
 * without modifying the state
 */

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
    // Check if this item is provided by any progressive item
    for (const [progressiveBase, progression] of Object.entries(staticData.progressionMapping)) {
      const baseCount = snapshot.inventory[progressiveBase] || 0;
      if (baseCount > 0 && progression && progression.items) {
        // Check each upgrade in the progression
        for (const upgrade of progression.items) {
          if (baseCount >= upgrade.level) {
            // Check if this upgrade provides the item we're looking for
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
 * Check if player can reach enough orbs for trading
 * This is used when orbsanity is off (default). "Reachable Orbs" is a virtual
 * progressive item that gets calculated based on accessible orb regions.
 *
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data (regions is a Map)
 * @param {number} requiredOrbs - Number of orbs required
 * @returns {boolean} True if player has enough reachable orbs
 */
export function can_reach_orbs(snapshot, staticData, requiredOrbs) {
  try {
    if (!staticData || !staticData.regions) {
      console.warn('[can_reach_orbs] Missing staticData or regions');
      return false;
    }
    if (!snapshot.regionReachability) {
      console.warn('[can_reach_orbs] Missing regionReachability in snapshot');
      return false;
    }

    // Calculate reachable orbs by summing orb_count from all accessible regions
    let totalReachableOrbs = 0;

    // staticData.regions is a Map of region name -> region object
    // Iterate through all regions and sum orb counts for reachable ones
    for (const [regionName, region] of staticData.regions) {
      // Check if this region is reachable
      const reachability = snapshot.regionReachability[regionName];
      if (reachability === 'reachable') {
        if (region && typeof region.orb_count === 'number' && region.orb_count > 0) {
          totalReachableOrbs += region.orb_count;
        }
      }
    }

    return totalReachableOrbs >= requiredOrbs;
  } catch (error) {
    console.error('[can_reach_orbs] Error:', error);
    return false;
  }
}

// Helper function registry
export const helperFunctions = {
  has,
  count,
  can_reach_orbs,
};
