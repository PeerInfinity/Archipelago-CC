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

/**
 * DLCQuest helper functions.
 * Note: DLCQuest uses special coin items with a leading space (e.g., " coins")
 * to track total coins. These are handled automatically by the state manager.
 */
export const helperFunctions = {
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
    const result = !!(snapshot?.inventory && snapshot.inventory[itemName] > 0);
    // DEBUG for Movement Pack
    if (itemName === 'Movement Pack') {
      console.log('[DEBUG-HAS] Checking Movement Pack:', {
        itemName,
        inventory: snapshot?.inventory,
        hasItem: snapshot?.inventory?.[itemName],
        result
      });
    }
    return result;
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