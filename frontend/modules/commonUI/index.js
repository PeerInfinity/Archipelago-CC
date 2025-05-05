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
 * Creates an interface object that allows rule evaluation against a static snapshot.
 * This is used on the main thread (e.g., in UI components) to evaluate rules
 * based on the latest cached state from the worker, without needing direct
 * access to the full StateManager instance.
 *
 * @param {object} snapshot - The plain JavaScript snapshot object received from the worker.
 * @param {object} staticData - The static game data (items, locations, groups, regions etc.).
 * @returns {object} An object implementing the StateSnapshotInterface methods.
 */
function createStateSnapshotInterface(snapshot, staticData) {
  if (!snapshot || !staticData) {
    console.warn(
      '[createStateSnapshotInterface] Snapshot or staticData missing, returning dummy interface.'
    );
    // Return a dummy interface that always evaluates to false/0/unknown
    return {
      hasItem: () => false,
      countItem: () => 0,
      countGroup: () => 0,
      hasFlag: () => false,
      getReachabilityStatus: () => 'unknown',
      getSetting: () => undefined,
      executeHelper: () => false, // Add stub
      executeStateManagerMethod: () => false, // Add stub
      // Add any other methods expected by evaluateRule, defaulting to safe values
    };
  }

  // Helper to get group definitions
  const getGroupDef = (groupName) => staticData.groups?.[groupName];

  return {
    hasItem: (itemName) => {
      const count = snapshot.inventory?.[itemName] ?? 0;
      return count > 0;
    },

    countItem: (itemName) => {
      return snapshot.inventory?.[itemName] ?? 0;
    },

    countGroup: (groupName) => {
      const groupDef = getGroupDef(groupName);
      if (!groupDef || !groupDef.items || !snapshot.inventory) {
        // console.warn(`[SnapshotInterface] Group definition or inventory missing for group '${groupName}'`);
        return 0;
      }
      return groupDef.items.reduce((total, itemName) => {
        return total + (snapshot.inventory[itemName] ?? 0);
      }, 0);
    },

    hasFlag: (flagName) => {
      // Check flags array/set first
      if (Array.isArray(snapshot.flags)) {
        return snapshot.flags.includes(flagName);
      } else if (snapshot.flags instanceof Set) {
        // Note: Sets likely won't survive JSON serialization from worker
        return snapshot.flags.has(flagName);
      }
      // Check checkedLocations as a fallback if flags aren't used for this
      if (
        Array.isArray(snapshot.checkedLocations) &&
        snapshot.checkedLocations.includes(flagName)
      ) {
        // console.debug(`[SnapshotInterface] hasFlag found '${flagName}' in checkedLocations`);
        return true;
      }
      return false;
    },

    getReachabilityStatus: (name /* location or region name */) => {
      return snapshot.reachability?.[name] ?? 'unknown'; // Default to unknown
    },

    getSetting: (settingName) => {
      // Settings might be nested, handle basic access
      return snapshot.settings?.[settingName];
    },

    // Add stubs or basic implementations for other methods potentially
    // used by evaluateRule if they only rely on snapshot data.
    // Helpers and state methods CANNOT be executed here as they require full context.
    executeHelper: (helperName, args) => {
      console.warn(
        `[SnapshotInterface] Attempted to execute complex helper '${helperName}' on main thread. Not supported. Assuming false.`
      );
      return false;
    },
    executeStateManagerMethod: (methodName, args) => {
      console.warn(
        `[SnapshotInterface] Attempted to execute StateManager method '${methodName}' on main thread. Not supported. Assuming false.`
      );
      return false;
    },
    // Potentially add getters for static data if needed directly by rules?
    // getItemData: (itemName) => staticData?.items?.[itemName],
    // getLocationData: (locName) => staticData?.locations?.[locName],
    // getRegionData: (regionName) => staticData?.regions?.[regionName],
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
