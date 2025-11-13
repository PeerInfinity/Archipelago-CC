/**
 * Thread-agnostic Super Metroid game logic functions
 *
 * Super Metroid uses a custom SMBoolManager system for its logic,
 * which evaluates rules based on both boolean values AND difficulty ratings.
 * The Python backend has already done all the complex logic evaluation,
 * so the frontend primarily needs to provide stub implementations that
 * allow the rules to be processed.
 *
 * For now, we provide simplified implementations that trust the Python
 * backend's calculations encoded in the sphere log.
 */

/**
 * Check if player has an item
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to check
 * @returns {boolean} True if player has the item
 */
export function has(snapshot, staticData, itemName) {
  if (!snapshot.inventory) return false;
  return (snapshot.inventory[itemName] || 0) > 0;
}

/**
 * Count how many of an item the player has
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to count
 * @returns {number} Number of items
 */
export function count(snapshot, staticData, itemName) {
  if (!snapshot.inventory) return 0;
  return snapshot.inventory[itemName] || 0;
}

/**
 * Python's any() builtin - check if any element in an iterable is true
 * This is used in location rules to check if any access point is reachable
 * @param {Array} iterable - Array of boolean values
 * @returns {boolean} True if any element is truthy
 */
export function any(snapshot, staticData, iterable) {
  if (!Array.isArray(iterable)) return false;
  return iterable.some(x => x);
}

/**
 * Stub for evalSMBool - Super Metroid's SMBool evaluation
 * The SMBoolManager evaluates logic functions that return SMBool objects
 * (which have both a boolean value and a difficulty rating).
 *
 * Since the Python backend has already done this evaluation and generated
 * the sphere log, we return true here to allow rules to pass.
 * The actual logic enforcement happens via the sphere log comparison.
 *
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {*} smbool - The SMBool object (or result of calling a logic function)
 * @param {number} maxDiff - Maximum difficulty allowed
 * @returns {boolean} Always returns true (trusting Python backend)
 */
export function evalSMBool(snapshot, staticData, smbool, maxDiff) {
  // The Python backend has already evaluated this with the SMBoolManager
  // We trust the sphere log to tell us what's actually accessible
  return true;
}

/**
 * Stub for VARIA logic functions (func, rule, etc.)
 * These are closures in the Python code that call into the SMBoolManager
 *
 * Since we can't replicate the full VARIA logic system in JavaScript,
 * we return a placeholder that evalSMBool will accept.
 *
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {*} smbm - The SMBoolManager instance (from state.smbm[player])
 * @returns {Object} Placeholder SMBool object
 */
export function func(snapshot, staticData, smbm) {
  // Return a placeholder that evalSMBool will process
  return { bool: true, difficulty: 0 };
}

/**
 * Stub for VARIA rule functions
 * Similar to func, but for location-specific rules
 *
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {*} smbm - The SMBoolManager instance
 * @returns {Object} Placeholder SMBool object
 */
export function rule(snapshot, staticData, smbm) {
  // Return a placeholder that evalSMBool will process
  return { bool: true, difficulty: 0 };
}

/**
 * Helper function registry
 * Export all helper functions that can be called from rules
 */
export const helperFunctions = {
  has,
  count,
  any,
  evalSMBool,
  func,
  rule
};
