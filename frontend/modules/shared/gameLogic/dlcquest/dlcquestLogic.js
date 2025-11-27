/**
 * DLCQuest state management module with coin tracking support.
 */
export const dlcquestStateModule = {
  /**
   * Initializes a new DLCQuest game state.
   */
  initializeState() {
    return {
      flags: [], // Checked locations and game-specific flags
      events: [], // Event items
      // DLCQuest doesn't need special state beyond the standard
    };
  },

  /**
   * Loads settings into the game state.
   */
  loadSettings(gameState, settings) {
    // DLCQuest doesn't need special settings handling
    return { ...gameState };
  },

  /**
   * Process special DLCQuest event items.
   */
  processEventItem(gameState, itemName) {
    // DLCQuest doesn't have special event processing
    // Coin items are handled as normal inventory items
    return null; // Return null to indicate no state change
  },

  /**
   * Returns the DLCQuest state properties for a snapshot.
   */
  getStateForSnapshot(gameState) {
    return {
      flags: gameState.flags || [],
      events: gameState.events || [],
    };
  },
};

// Helper function to get item count from inventory
function getItemCount(snapshot, itemName) {
  return snapshot?.inventory?.[itemName] || 0;
}

/**
 * Calculate total coins for DLC Quest campaign.
 * Similar to Bomb Rush Cyberfunk's rep() function.
 *
 * Checks multiple sources:
 * 1. Aggregated " coins" counter in inventory (from progressionMapping)
 * 2. prog_items structure (for spoiler tests)
 * 3. Manual aggregation of individual coin items (fallback)
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {number} required - Required coin amount
 * @returns {boolean} True if player has enough coins
 */
function coins(snapshot, staticData, required) {
  // First check the aggregated " coins" counter (from progressionMapping/accumulator_rules)
  const aggregatedCoins = getItemCount(snapshot, ' coins');
  if (aggregatedCoins >= required) {
    return true;
  }

  // Fallback: check prog_items structure (used by spoiler tests)
  // Try both string and numeric keys for player ID
  const progCoins = snapshot?.prog_items?.['1']?.[' coins'] ||
                    snapshot?.prog_items?.[1]?.[' coins'] || 0;
  if (progCoins >= required) {
    return true;
  }

  // Second fallback: manually aggregate coin items
  // DLCQuest coin items are named like "4 coins", "10 coins", "100 coins", etc.
  const coinItemPattern = /^(\d+) coins?$/;
  let totalCoins = 0;

  if (snapshot?.inventory) {
    for (const [itemName, count] of Object.entries(snapshot.inventory)) {
      const match = itemName.match(coinItemPattern);
      if (match) {
        const coinValue = parseInt(match[1], 10);
        totalCoins += coinValue * count;
      }
    }
  }

  return totalCoins >= required;
}

/**
 * Calculate total coins for Live Freemium or Die campaign.
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {number} required - Required coin amount
 * @returns {boolean} True if player has enough freemium coins
 */
function coinsFreemium(snapshot, staticData, required) {
  // First check the aggregated " coins freemium" counter
  const aggregatedCoins = getItemCount(snapshot, ' coins freemium');
  if (aggregatedCoins >= required) {
    return true;
  }

  // Fallback: check prog_items structure
  const progCoins = snapshot?.prog_items?.['1']?.[' coins freemium'] ||
                    snapshot?.prog_items?.[1]?.[' coins freemium'] || 0;
  if (progCoins >= required) {
    return true;
  }

  // Note: Freemium coins have a different item naming pattern
  // For now, just rely on the aggregated counters
  return false;
}

/**
 * DLCQuest helper functions.
 * Note: DLCQuest uses special coin items with a leading space (e.g., " coins")
 * to track total coins. These are handled automatically by the state manager.
 */
export const helperFunctions = {
  /**
   * Check if player has enough coins (DLC Quest campaign)
   */
  coins,

  /**
   * Check if player has enough coins (Live Freemium or Die campaign)
   */
  coinsFreemium,

  /**
   * Check if the player has an item (generic implementation)
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} itemName - Item name
   * @param {number} [count=1] - Required count
   * @returns {boolean} True if player has at least count of the item
   */
  can_access(snapshot, staticData, itemName, count = 1) {
    const inventory = snapshot.inventory || {};
    return (inventory[itemName] || 0) >= count;
  },

  /**
   * Generic has method for item checking
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} itemName - Item name
   * @returns {boolean} True if player has the item
   */
  has(snapshot, staticData, itemName) {
    return !!(snapshot?.inventory && snapshot.inventory[itemName] > 0);
  },

  /**
   * Count items in inventory
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} itemName - Item name
   * @returns {number} Item count
   */
  count(snapshot, staticData, itemName) {
    return getItemCount(snapshot, itemName);
  },

  /**
   * Check if player has visited/checked a location
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} flag - Flag name
   * @returns {boolean} True if flag is set
   */
  has_flag(snapshot, staticData, flag) {
    return snapshot.flags?.includes(flag) || false;
  },

  /**
   * Check if player has an event
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} event - Event name
   * @returns {boolean} True if event occurred
   */
  has_event(snapshot, staticData, event) {
    return snapshot.events?.includes(event) || false;
  }
};