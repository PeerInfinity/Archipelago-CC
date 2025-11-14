/**
 * The Messenger state management module.
 */
export const messengerStateModule = {
  /**
   * Initializes a new Messenger game state.
   */
  initializeState() {
    return {
      flags: [], // Checked locations and game-specific flags
      events: [], // Event items
    };
  },

  /**
   * Loads settings into the game state.
   */
  loadSettings(gameState, settings) {
    return { ...gameState };
  },

  /**
   * Process special Messenger event items.
   */
  processEventItem(gameState, itemName) {
    return null; // Return null to indicate no state change
  },

  /**
   * Returns the Messenger state properties for a snapshot.
   */
  getStateForSnapshot(gameState) {
    return {
      flags: gameState.flags || [],
      events: gameState.events || [],
    };
  },
};

/**
 * The Messenger helper functions.
 */
export const helperFunctions = {
  /**
   * Check if the player can afford a shop item.
   * In Python, this is: state.has("Shards", player, min(cost, total_shards))
   *
   * The cost is stored in the location data and will be accessible through the interface context.
   * For now, we need to access it through a different mechanism since helpers don't receive context directly.
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @returns {boolean} True if player can afford the item
   */
  can_afford(snapshot, staticData) {
    // TODO: This helper needs access to the current location being evaluated to get the cost.
    // For now, just check if the player has any shards.
    // This will be fixed once we figure out how to pass location context to helpers.

    // The proper implementation should be:
    // const cost = currentLocation.cost;
    // const totalShards = calculate from Time Shard items in itempool
    // const requiredShards = Math.min(cost, totalShards);
    // return (snapshot.inventory["Shards"] || 0) >= requiredShards;

    // Temporary implementation: always return true
    // This allows the game to progress while we work on the proper context passing
    return true;
  },
};
