/**
 * Thread-agnostic Yu-Gi-Oh! 2006 game logic functions
 * These pure functions operate on a canonical state object and return results
 * without modifying the state
 */

// Core booster pack items (from worlds/yugioh06/logic.py)
const CORE_BOOSTER = [
  "LEGEND OF B.E.W.D.",
  "METAL RAIDERS",
  "PHARAOH'S SERVANT",
  "PHARAONIC GUARDIAN",
  "SPELL RULER",
  "LABYRINTH OF NIGHTMARE",
  "LEGACY OF DARKNESS",
  "MAGICIAN'S FORCE",
  "DARK CRISIS",
  "INVASION OF CHAOS",
  "ANCIENT SANCTUARY",
  "SOUL OF THE DUELIST",
  "RISE OF DESTINY",
  "FLAMING ETERNITY",
  "THE LOST MILLENIUM",
  "CYBERNETIC REVOLUTION",
  "ELEMENTAL ENERGY",
  "SHADOW OF INFINITY",
];

/**
 * Check if player has an item
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to check
 * @returns {boolean} True if player has the item
 */
export function has(snapshot, staticData, itemName) {
  // Check flags (events, checked locations, etc.)
  if (snapshot.flags && snapshot.flags.includes(itemName)) {
    return true;
  }

  // Check events
  if (snapshot.events && snapshot.events.includes(itemName)) {
    return true;
  }

  // Check inventory
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
 * Check if player has at least 'amount' different items from a list
 * Equivalent to Python's state.has_from_list(list, player, amount)
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {Array<string>} itemList - List of item names to check
 * @param {number} amount - Minimum number of different items required
 * @returns {boolean} True if player has at least 'amount' items from the list
 */
export function has_from_list(snapshot, staticData, itemList, amount) {
  let foundCount = 0;

  for (const itemName of itemList) {
    if (has(snapshot, staticData, itemName)) {
      foundCount++;
      if (foundCount >= amount) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check difficulty requirement based on core booster packs owned
 * Equivalent to Python's yugioh06_difficulty(state, player, amount)
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @param {number} amount - Minimum number of core booster packs required
 * @returns {boolean} True if player has at least 'amount' core booster packs
 */
export function yugioh06_difficulty(snapshot, staticData, amount) {
  return has_from_list(snapshot, staticData, CORE_BOOSTER, amount);
}

// Helper function registry
export const helperFunctions = {
  // Core inventory functions
  has,
  count,
  has_from_list,

  // Yu-Gi-Oh! 2006 specific helpers
  yugioh06_difficulty,
};
