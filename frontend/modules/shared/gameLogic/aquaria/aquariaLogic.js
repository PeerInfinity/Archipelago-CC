/**
 * Thread-agnostic Aquaria game logic functions
 * These pure functions operate on a canonical state object and return results
 * without modifying the state
 */

/**
 * Check if player has an item
 * @param {Object} state - Canonical state object
 * @param {string} itemName - Name of the item to check
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has the item
 */
export function has(state, itemName, staticData) {
  // First check if it's in flags (events, checked locations, etc.)
  if (state.flags && state.flags.includes(itemName)) {
    return true;
  }

  // Also check state.events
  if (state.events && state.events.includes(itemName)) {
    return true;
  }

  // Check inventory
  if (!state.inventory) return false;

  // Direct item check
  if ((state.inventory[itemName] || 0) > 0) {
    return true;
  }

  return false;
}

/**
 * Count how many of an item the player has
 * @param {Object} state - Canonical state object
 * @param {string} itemName - Name of the item to count
 * @param {Object} staticData - Static game data
 * @returns {number} Number of items
 */
export function count(state, itemName, staticData) {
  if (!state.inventory) return 0;
  return state.inventory[itemName] || 0;
}

/**
 * Check if player has the Nature Form
 * Corresponds to _has_nature_form in worlds/aquaria/Regions.py
 * @param {Object} state - Canonical state object
 * @param {Object} world - World/settings object (not used)
 * @param {any} itemName - Not used for this helper
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Nature Form
 */
export function _has_nature_form(state, world, itemName, staticData) {
  return has(state, 'Nature Form', staticData);
}

/**
 * Check if player has the Fish Form
 * Corresponds to _has_fish_form in worlds/aquaria/Regions.py
 * @param {Object} state - Canonical state object
 * @param {Object} world - World/settings object (not used)
 * @param {any} itemName - Not used for this helper
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Fish Form
 */
export function _has_fish_form(state, world, itemName, staticData) {
  return has(state, 'Fish Form', staticData);
}

/**
 * Check if player has hot soup (either version)
 * Corresponds to _has_hot_soup in worlds/aquaria/Regions.py
 */
export function _has_hot_soup(state, world, itemName, staticData) {
  return has(state, 'Hot Soup', staticData) || has(state, 'Hot Soup x2', staticData);
}

/**
 * Check if player has cleared Body Tongue
 * Corresponds to _has_tongue_cleared in worlds/aquaria/Regions.py
 */
export function _has_tongue_cleared(state, world, itemName, staticData) {
  return has(state, 'Body Tongue cleared', staticData);
}

/**
 * Check if player has sun crystal and bind song
 * Corresponds to _has_sun_crystal in worlds/aquaria/Regions.py
 */
export function _has_sun_crystal(state, world, itemName, staticData) {
  return has(state, 'Has sun crystal', staticData) && _has_bind_song(state, world, itemName, staticData);
}

/**
 * Check if player has Li
 * Corresponds to _has_li in worlds/aquaria/Regions.py
 */
export function _has_li(state, world, itemName, staticData) {
  return has(state, 'Li and Li Song', staticData);
}

/**
 * Check if player has any damaging item
 * Corresponds to _has_damaging_item in worlds/aquaria/Regions.py
 */
export function _has_damaging_item(state, world, itemName, staticData) {
  const damaging_items = [
    'Energy Form', 'Nature Form', 'Beast Form',
    'Li and Li Song', 'Baby Nautilus', 'Baby Piranha', 'Baby Blaster'
  ];
  return damaging_items.some(item => has(state, item, staticData));
}

/**
 * Check if player has energy attack items (for bosses)
 * Corresponds to _has_energy_attack_item in worlds/aquaria/Regions.py
 */
export function _has_energy_attack_item(state, world, itemName, staticData) {
  return _has_energy_form(state, world, itemName, staticData) ||
         _has_dual_form(state, world, itemName, staticData);
}

/**
 * Check if player has Shield Song
 * Corresponds to _has_shield_song in worlds/aquaria/Regions.py
 */
export function _has_shield_song(state, world, itemName, staticData) {
  return has(state, 'Shield Song', staticData);
}

/**
 * Check if player has Bind Song
 * Corresponds to _has_bind_song in worlds/aquaria/Regions.py
 */
export function _has_bind_song(state, world, itemName, staticData) {
  return has(state, 'Bind Song', staticData);
}

/**
 * Check if player has Energy Form
 * Corresponds to _has_energy_form in worlds/aquaria/Regions.py
 */
export function _has_energy_form(state, world, itemName, staticData) {
  return has(state, 'Energy Form', staticData);
}

/**
 * Check if player has Beast Form
 * Corresponds to _has_beast_form in worlds/aquaria/Regions.py
 */
export function _has_beast_form(state, world, itemName, staticData) {
  return has(state, 'Beast Form', staticData);
}

/**
 * Check if player has Beast Form and Hot Soup
 * Corresponds to _has_beast_and_soup_form in worlds/aquaria/Regions.py
 */
export function _has_beast_and_soup_form(state, world, itemName, staticData) {
  return _has_beast_form(state, world, itemName, staticData) &&
         _has_hot_soup(state, world, itemName, staticData);
}

/**
 * Check if player has Beast Form or Arnassi Armor
 * Corresponds to _has_beast_form_or_arnassi_armor in worlds/aquaria/Regions.py
 */
export function _has_beast_form_or_arnassi_armor(state, world, itemName, staticData) {
  return _has_beast_form(state, world, itemName, staticData) ||
         has(state, 'Arnassi Armor', staticData);
}

/**
 * Check if player has Sun Form
 * Corresponds to _has_sun_form in worlds/aquaria/Regions.py
 */
export function _has_sun_form(state, world, itemName, staticData) {
  return has(state, 'Sun Form', staticData);
}

/**
 * Check if player has light (Baby Dumbo or Sun Form)
 * Corresponds to _has_light in worlds/aquaria/Regions.py
 */
export function _has_light(state, world, itemName, staticData) {
  return has(state, 'Baby Dumbo', staticData) ||
         _has_sun_form(state, world, itemName, staticData);
}

/**
 * Check if player has Dual Form
 * Corresponds to _has_dual_form in worlds/aquaria/Regions.py
 */
export function _has_dual_form(state, world, itemName, staticData) {
  return _has_li(state, world, itemName, staticData) &&
         has(state, 'Dual Form', staticData);
}

/**
 * Check if player has Spirit Form
 * Corresponds to _has_spirit_form in worlds/aquaria/Regions.py
 */
export function _has_spirit_form(state, world, itemName, staticData) {
  return has(state, 'Spirit Form', staticData);
}

/**
 * Check if player has beaten all big bosses
 * Corresponds to _has_big_bosses in worlds/aquaria/Regions.py
 */
export function _has_big_bosses(state, world, itemName, staticData) {
  const big_bosses = [
    'Fallen God beated', 'Mithalan God beated', 'Drunian God beated',
    'Lumerean God beated', 'The Golem beated'
  ];
  return big_bosses.every(boss => has(state, boss, staticData));
}

/**
 * Check if player has beaten all mini bosses
 * Corresponds to _has_mini_bosses in worlds/aquaria/Regions.py
 */
export function _has_mini_bosses(state, world, itemName, staticData) {
  const mini_bosses = [
    'Nautilus Prime beated', 'Blaster Peg Prime beated', 'Mergog beated',
    'Mithalan priests beated', 'Octopus Prime beated',
    'Crabbius Maximus beated', 'Mantis Shrimp Prime beated',
    'King Jellyfish God Prime beated'
  ];
  return mini_bosses.every(boss => has(state, boss, staticData));
}

/**
 * Check if player has obtained all secrets
 * Corresponds to _has_secrets in worlds/aquaria/Regions.py
 */
export function _has_secrets(state, world, itemName, staticData) {
  const secrets = [
    'First secret obtained', 'Second secret obtained', 'Third secret obtained'
  ];
  return secrets.every(secret => has(state, secret, staticData));
}

// Helper function registry
export const helperFunctions = {
  // Core inventory functions
  has,
  count,

  // Aquaria specific helpers
  _has_nature_form,
  _has_fish_form,
  _has_hot_soup,
  _has_tongue_cleared,
  _has_sun_crystal,
  _has_li,
  _has_damaging_item,
  _has_energy_attack_item,
  _has_shield_song,
  _has_bind_song,
  _has_energy_form,
  _has_beast_form,
  _has_beast_and_soup_form,
  _has_beast_form_or_arnassi_armor,
  _has_sun_form,
  _has_light,
  _has_dual_form,
  _has_spirit_form,
  _has_big_bosses,
  _has_mini_bosses,
  _has_secrets,
};
