/**
 * The Witness Game Logic Module
 *
 * Provides helper functions for The Witness-specific rule evaluation.
 */

/**
 * Check if a region is reachable
 * @param {Object} snapshot - The state snapshot
 * @param {Object} staticData - The static data
 * @param {string} regionName - The name of the region to check
 * @returns {boolean} True if the region is reachable
 */
function can_reach_region(snapshot, staticData, regionName) {
  // Access reachable regions directly (it's already player-specific in the snapshot)
  const reachableRegions = snapshot?.reachableRegions;

  if (!reachableRegions) {
    return false;
  }

  // Check if the region is in the reachable regions set
  // The reachableRegions is a Set of region names
  return reachableRegions.has(regionName);
}

/**
 * Export helper functions
 */
export const helperFunctions = {
  can_reach_region,
};
