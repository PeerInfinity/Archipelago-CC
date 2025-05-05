import {
  renderLogicTree,
  debounce,
  setColorblindMode,
  createRegionLink,
  createLocationLink,
  applyColorblindClass,
} from './commonUI.js';

// --- Module Info ---
export const moduleInfo = {
  name: 'CommonUI',
  description: 'Provides shared UI utility functions and components.',
};

// No registration, initialization, or post-initialization needed for this utility module.

// Re-export the imported functions and the locally defined one
export {
  renderLogicTree,
  debounce,
  setColorblindMode,
  createRegionLink,
  createLocationLink,
  applyColorblindClass,
  createStateSnapshotInterface,
};

/**
 * Creates a state snapshot interface object from raw snapshot data.
 * This interface provides methods expected by evaluateRule.
 * @param {object} snapshot - The raw snapshot object from StateManagerProxy.
 * @returns {object|null} An object implementing the StateSnapshotInterface, or null if snapshot is invalid.
 */
function createStateSnapshotInterface(snapshot) {
  if (!snapshot) {
    return null;
  }

  // Convert arrays back to Sets for efficient lookup in the interface methods
  const reachableRegionsSet = new Set(snapshot.reachableRegions || []);
  const checkedLocationsSet = new Set(snapshot.checkedLocations || []);
  const flagsSet = new Set(snapshot.flags || []);

  // TODO: Group data needs to be accessible. Where should it come from?
  // For now, assume group counts are not needed or handled elsewhere.
  const groupData = {}; // Placeholder

  return {
    hasItem: (itemName) =>
      snapshot.inventory && snapshot.inventory[itemName] > 0,
    countItem: (itemName) => snapshot.inventory?.[itemName] || 0,
    countGroup: (groupName) => {
      // Basic group count implementation (requires group definitions)
      const groupItems = groupData[groupName] || [];
      return groupItems.reduce(
        (sum, itemName) => sum + (snapshot.inventory?.[itemName] || 0),
        0
      );
    },
    hasFlag: (flagName) => flagsSet.has(flagName),
    getFlags: () => flagsSet,
    getGameMode: () => snapshot.mode,
    // getShops: () => snapshot.shops, // Assuming shops are not directly in snapshot yet
    // getDifficultyRequirements: () => snapshot.difficultyRequirements, // Assuming not directly in snapshot yet
    getSetting: (settingName) => snapshot.settings?.[settingName],
    getAllSettings: () => snapshot.settings,
    // Simplified reachability check based on precomputed sets
    isRegionReachable: (regionName) => reachableRegionsSet.has(regionName),
    isLocationChecked: (locName) => checkedLocationsSet.has(locName),
    // Placeholders or simplified access for other potential methods
    // executeHelper: (name, ...args) => { /* Logic if needed */ return false; },
    // executeStateManagerMethod: (name, ...args) => { /* Logic if needed */ return false; },
    getItemData: (itemName) => snapshot.itemData?.[itemName], // Assuming itemData might be added to snapshot
    getLocationData: (locName) =>
      snapshot.locations?.find((l) => l.name === locName),
    getRegionData: (regionName) => snapshot.regions?.[regionName],
    getAllLocations: () => snapshot.locations,
    getAllRegions: () => snapshot.regions,
    getPlayerSlot: () => snapshot.playerSlot,
  };
}

// Provide a default export object containing all functions for convenience,
// matching the previous structure consumers might expect.
export default {
  renderLogicTree,
  debounce,
  setColorblindMode,
  createRegionLink,
  createLocationLink,
  applyColorblindClass,
  createStateSnapshotInterface,
};
