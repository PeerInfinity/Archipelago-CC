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
   * Handles progressive item resolution for Factorio
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data
   * @param {string} itemName - Name of the item/technology to check
   * @returns {boolean} True if player has the item
   */
  has(snapshot, staticData, itemName) {
    // Debug logging for Automated items
    const isAutomatedItem = itemName && itemName.startsWith('Automated');
    if (isAutomatedItem) {
      console.log(`[Factorio has()] Checking for item: "${itemName}"`);
      // Show only Automated items to avoid log truncation
      const automatedItems = {};
      if (snapshot?.inventory) {
        for (const [key, value] of Object.entries(snapshot.inventory)) {
          if (key.startsWith('Automated')) {
            automatedItems[key] = value;
          }
        }
      }
      console.log(`[Factorio has()] All Automated items in inventory:`, automatedItems);
      console.log(`[Factorio has()] Item "${itemName}" count:`, snapshot?.inventory?.[itemName]);
    }

    if (!snapshot?.inventory) {
      if (isAutomatedItem) {
        console.log(`[Factorio has()] No inventory in snapshot, returning false`);
      }
      return false;
    }

    // Direct check: does the inventory have this exact item?
    if (snapshot.inventory[itemName] > 0) {
      if (isAutomatedItem) {
        console.log(`[Factorio has()] Found item in inventory with count > 0, returning true`);
      }
      return true;
    }

    // Progressive item resolution: Check if this item is a resolved form of a progressive item
    // For Factorio, technologies like "logistic-science-pack" can be obtained through "progressive-science-pack"
    const playerSlot = snapshot?.player?.slot || staticData?.playerId || '1';
    const progressionMapping = staticData?.progression_mapping?.[playerSlot];

    if (progressionMapping) {
      // Check each progressive item in the mapping
      for (const [progressiveItemName, mapping] of Object.entries(progressionMapping)) {
        if (!mapping.items || !Array.isArray(mapping.items)) {
          continue;
        }

        // Check if the requested item is one of the resolved forms
        const matchingLevel = mapping.items.find(levelData => levelData.name === itemName);
        if (matchingLevel) {
          // Found it! Now check if the player has enough of the progressive item
          const progressiveCount = snapshot.inventory[progressiveItemName] || 0;
          if (progressiveCount >= matchingLevel.level) {
            return true;
          }
        }
      }
    }

    if (isAutomatedItem) {
      console.log(`[Factorio has()] Item not found in inventory or progressive mapping, returning false`);
    }
    return false;
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
