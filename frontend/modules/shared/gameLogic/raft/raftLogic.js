/**
 * Raft state management module.
 */
export const raftStateModule = {
  initializeState() {
    return {
      flags: [],
      events: [],
    };
  },

  loadSettings(gameState, settings) {
    return { ...gameState };
  },

  processEventItem(gameState, itemName) {
    return null;
  },

  getStateForSnapshot(gameState) {
    return {
      flags: gameState.flags || [],
      events: gameState.events || [],
    };
  },
};

/**
 * Helper functions for Raft game logic.
 *
 * Most helpers are now exported from Python and evaluated by the rule engine.
 * Only helpers that access game options and their dependencies need JavaScript implementations.
 */
export const helperFunctions = {
  /**
   * Check if the player has an item (handles progressive items)
   */
  has(snapshot, staticData, itemName) {
    // First check if the item is directly in the inventory
    if (snapshot?.inventory && snapshot.inventory[itemName] > 0) {
      return true;
    }

    // Check if this item is part of a progressive item chain
    const progressionMapping = staticData?.progressionMapping;
    if (progressionMapping) {
      // Look through all progressive items to see if any contain this item
      for (const [progressiveName, progressionData] of Object.entries(progressionMapping)) {
        if (progressionData?.items) {
          // Find this item in the progression chain
          const itemEntry = progressionData.items.find(item => item.name === itemName);
          if (itemEntry) {
            // This item is part of a progressive chain
            // Check if the player has enough of the progressive item to reach this level
            const progressiveCount = snapshot?.inventory?.[progressiveName] || 0;
            if (progressiveCount >= itemEntry.level) {
              return true;
            }
          }
        }
      }
    }

    return false;
  },

  /**
   * Count how many of an item the player has
   */
  count(snapshot, staticData, itemName) {
    return snapshot?.inventory?.[itemName] || 0;
  },

  // Option-based helpers - these access game options so they cannot be exported from Python
  raft_paddleboard_mode_enabled(snapshot, staticData) {
    return staticData?.settings?.options?.paddleboard_mode === true ||
           staticData?.settings?.options?.paddleboard_mode === 1;
  },

  raft_big_islands_available(snapshot, staticData) {
    const bigIslandEarlyCrafting = staticData?.settings?.options?.big_island_early_crafting === true ||
                                    staticData?.settings?.options?.big_island_early_crafting === 1;
    return bigIslandEarlyCrafting ||
           helperFunctions.raft_can_access_radio_tower(snapshot, staticData);
  },

  // Smelting and crafting helpers - needed for option-dependent helpers
  raft_can_smelt_items(snapshot, staticData) {
    return helperFunctions.has(snapshot, staticData, "Smelter");
  },

  raft_can_craft_bolt(snapshot, staticData) {
    return helperFunctions.raft_can_smelt_items(snapshot, staticData) &&
           helperFunctions.has(snapshot, staticData, "Bolt");
  },

  raft_can_craft_hinge(snapshot, staticData) {
    return helperFunctions.raft_can_smelt_items(snapshot, staticData) &&
           helperFunctions.has(snapshot, staticData, "Hinge");
  },

  raft_can_craft_battery(snapshot, staticData) {
    return helperFunctions.raft_can_smelt_items(snapshot, staticData) &&
           helperFunctions.has(snapshot, staticData, "Battery");
  },

  raft_can_craft_circuitBoard(snapshot, staticData) {
    return helperFunctions.raft_can_smelt_items(snapshot, staticData) &&
           helperFunctions.has(snapshot, staticData, "Circuit board");
  },

  raft_can_craft_reciever(snapshot, staticData) {
    return helperFunctions.raft_can_craft_circuitBoard(snapshot, staticData) &&
           helperFunctions.raft_can_craft_hinge(snapshot, staticData) &&
           helperFunctions.has(snapshot, staticData, "Receiver");
  },

  raft_can_craft_antenna(snapshot, staticData) {
    return helperFunctions.raft_can_craft_circuitBoard(snapshot, staticData) &&
           helperFunctions.raft_can_craft_bolt(snapshot, staticData) &&
           helperFunctions.has(snapshot, staticData, "Antenna");
  },

  raft_can_craft_engine(snapshot, staticData) {
    return helperFunctions.raft_can_smelt_items(snapshot, staticData) &&
           helperFunctions.raft_can_craft_circuitBoard(snapshot, staticData) &&
           helperFunctions.has(snapshot, staticData, "Engine");
  },

  raft_can_craft_steeringWheel(snapshot, staticData) {
    return helperFunctions.raft_can_smelt_items(snapshot, staticData) &&
           helperFunctions.raft_can_craft_bolt(snapshot, staticData) &&
           helperFunctions.raft_can_craft_hinge(snapshot, staticData) &&
           helperFunctions.has(snapshot, staticData, "Steering Wheel");
  },

  // Navigation and driving - needed for option-dependent helpers
  raft_can_navigate(snapshot, staticData) {
    return helperFunctions.raft_can_craft_battery(snapshot, staticData) &&
           helperFunctions.raft_can_craft_reciever(snapshot, staticData) &&
           helperFunctions.raft_can_craft_antenna(snapshot, staticData);
  },

  raft_can_drive(snapshot, staticData) {
    return (helperFunctions.raft_can_craft_engine(snapshot, staticData) &&
            helperFunctions.raft_can_craft_steeringWheel(snapshot, staticData)) ||
           helperFunctions.raft_paddleboard_mode_enabled(snapshot, staticData);
  },

  // Region access - needed for raft_big_islands_available
  raft_can_access_radio_tower(snapshot, staticData) {
    return helperFunctions.raft_can_navigate(snapshot, staticData);
  },
};
