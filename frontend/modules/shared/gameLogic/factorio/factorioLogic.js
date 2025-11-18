/**
 * Factorio game logic module
 */
export const factorioStateModule = {
  /**
   * Initializes a new, empty Factorio game state.
   */
  initializeState() {
    return {
      flags: [], // Checked locations and game-specific flags
      events: [], // Event items
      // Other factorio-specific state properties can be added here if needed
    };
  },

  /**
   * Loads settings into the game state.
   */
  loadSettings(gameState, settings) {
    return { ...gameState };
  },

  /**
   * Generic event processing - no special events for Factorio currently.
   */
  processEventItem(gameState, itemName) {
    return null; // Return null to indicate no state change
  },

  /**
   * Returns the Factorio state properties for a snapshot.
   */
  getStateForSnapshot(gameState) {
    return {
      flags: gameState.flags || [],
      events: gameState.events || [],
    };
  },
};

/**
 * Factorio helper functions for rule evaluation.
 */
export const helperFunctions = {
  /**
   * Check if the player has an item (including technologies)
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} itemName - Name of the item/technology to check
   * @returns {boolean} True if player has the item
   */
  has(snapshot, staticData, itemName) {
    // Check inventory for the item (works for both items and technologies)
    return !!(snapshot?.inventory && snapshot.inventory[itemName] > 0);
  },

  /**
   * Count how many of an item the player has
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} itemName - Name of the item/technology to count
   * @returns {number} Count of the item
   */
  count(snapshot, staticData, itemName) {
    return snapshot?.inventory?.[itemName] || 0;
  },

  /**
   * Get the item placed at a specific location
   * Used for self-locking item logic
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} locationName - Name of the location to check
   * @returns {Array|null} Array of [itemName, playerId] or null if no item
   */
  location_item_name(snapshot, staticData, locationName) {
    // Find the location in staticData
    const locations = staticData?.locations || [];

    // Handle both array and object formats
    let location;
    if (Array.isArray(locations)) {
      location = locations.find(loc => loc?.name === locationName);
    } else if (typeof locations === 'object') {
      location = locations[locationName];
    }

    if (!location || !location.item) {
      return null;
    }

    // Return tuple of [item_name, player_id]
    return [location.item.name, location.item.player];
  },
};
