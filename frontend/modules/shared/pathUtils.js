/**
 * Shared path utility functions.
 *
 * Used by modules that consume gameState path data to derive
 * filtered views (e.g. region-move-only paths for visualization).
 */

/**
 * Filter a gameState path to only include regionMove entries.
 * @param {Array} path - Path array from gameState
 * @returns {Array} Filtered array containing only regionMove entries
 */
export function getRegionMovesFromPath(path) {
  if (!path || !Array.isArray(path)) return [];
  return path.filter(entry => entry.type === 'regionMove');
}
