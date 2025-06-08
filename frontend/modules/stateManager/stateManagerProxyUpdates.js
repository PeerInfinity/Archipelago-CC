/**
 * Updates to stateManagerProxy for the canonical state refactoring
 * This file contains the modified createStateSnapshotInterface function
 * that will check feature flags and use agnostic helpers when enabled
 */

import { helperFunctions as alttpLogic } from './logic/games/alttp/alttpLogic.js';

/**
 * Enhanced executeHelper that checks feature flags and uses agnostic helpers
 * @param {Object} snapshot - The state snapshot
 * @param {Object} staticData - Static game data
 * @param {Object} snapshotHelpersInstance - Legacy helper instance
 * @param {string} helperName - Name of the helper function to execute
 * @param {...any} args - Arguments for the helper
 * @returns {any} Result of the helper function
 */
export function executeHelperWithFeatureFlags(
  snapshot,
  staticData,
  snapshotHelpersInstance,
  helperName,
  ...args
) {
  // Check if we should use agnostic helpers
  const useAgnosticHelpers = 
    snapshot?.settings?.featureFlags?.useAgnosticHelpers || 
    (typeof window !== 'undefined' && 
     window.settings?.featureFlags?.useAgnosticHelpers);
  
  if (useAgnosticHelpers && snapshot?.game === 'A Link to the Past') {
    // Use the new thread-agnostic helpers
    if (alttpLogic[helperName]) {
      // Call the agnostic helper with state as first parameter
      return alttpLogic[helperName](snapshot, 'world', args[0], staticData);
    }
  }
  
  // Fall back to legacy helpers
  if (
    snapshotHelpersInstance &&
    typeof snapshotHelpersInstance[helperName] === 'function'
  ) {
    return snapshotHelpersInstance[helperName](...args);
  }
  
  return undefined;
}

/**
 * Enhanced has/count functions that check feature flags
 */
export function hasItemWithFeatureFlags(snapshot, staticData, itemName) {
  const useAgnosticHelpers = 
    snapshot?.settings?.featureFlags?.useAgnosticHelpers || 
    (typeof window !== 'undefined' && 
     window.settings?.featureFlags?.useAgnosticHelpers);
  
  if (useAgnosticHelpers && snapshot?.game === 'A Link to the Past') {
    return alttpLogic.has(snapshot, itemName, staticData);
  }
  
  // Legacy implementation
  return !!(snapshot?.inventory && snapshot.inventory[itemName] > 0);
}

export function countItemWithFeatureFlags(snapshot, staticData, itemName) {
  const useAgnosticHelpers = 
    snapshot?.settings?.featureFlags?.useAgnosticHelpers || 
    (typeof window !== 'undefined' && 
     window.settings?.featureFlags?.useAgnosticHelpers);
  
  if (useAgnosticHelpers && snapshot?.game === 'A Link to the Past') {
    return alttpLogic.count(snapshot, itemName, staticData);
  }
  
  // Legacy implementation
  return snapshot?.inventory?.[itemName] || 0;
}

/**
 * Modified section for createStateSnapshotInterface
 * This shows the changes needed to integrate feature flag checking
 * 
 * In the actual implementation, we would modify these sections of
 * createStateSnapshotInterface in stateManagerProxy.js:
 * 
 * 1. Replace hasItem implementation around line 1638
 * 2. Replace countItem implementation around line 1640
 * 3. Replace executeHelper implementation around line 1820
 */
export const createStateSnapshotInterfaceModifications = {
  // Around line 1638, replace:
  // hasItem: (itemName) => !!(snapshot?.inventory && snapshot.inventory[itemName] > 0),
  // With:
  hasItem: (itemName) => hasItemWithFeatureFlags(snapshot, staticData, itemName),
  
  // Around line 1640, replace:
  // countItem: (itemName) => snapshot?.inventory?.[itemName] || 0,
  // With:
  countItem: (itemName) => countItemWithFeatureFlags(snapshot, staticData, itemName),
  
  // Around line 1820, replace the executeHelper function body with:
  executeHelper: (helperName, ...args) => {
    return executeHelperWithFeatureFlags(
      snapshot,
      staticData,
      snapshotHelpersInstance,
      helperName,
      ...args
    );
  }
};