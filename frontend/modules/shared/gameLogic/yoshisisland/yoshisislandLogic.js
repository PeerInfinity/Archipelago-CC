/**
 * Yoshi's Island game logic functions
 * Translates Python YoshiLogic class methods to JavaScript
 */

/**
 * Get the game logic difficulty level from settings
 * @param {Object} staticData - Static game data
 * @returns {string} 'Easy', 'Normal', or 'Hard'
 */
function getGameLogic(staticData) {
  const settings = staticData?.settings?.[1];
  const stageLogic = settings?.StageLogic ?? 0;

  if (stageLogic === 0) { // option_strict
    return 'Easy';
  } else if (stageLogic === 1) { // option_loose
    return 'Normal';
  } else { // option_expert
    return 'Hard';
  }
}

/**
 * Check if middle rings are available from the start
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
function getMidringStart(staticData) {
  const settings = staticData?.settings?.[1];
  const shuffleMidrings = settings?.ShuffleMiddleRings ?? false;
  return !shuffleMidrings; // midring_start = not shuffle_midrings
}

/**
 * Check if clouds are always visible
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
function getCloudsAlwaysVisible(staticData) {
  const settings = staticData?.settings?.[1];
  const hiddenObjectVis = settings?.HiddenObjectVisibility ?? 1;
  return hiddenObjectVis >= 2; // option_clouds_only = 2
}

/**
 * Check if consumable logic is enabled
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
function getConsumableLogic(staticData) {
  const settings = staticData?.settings?.[1];
  const itemLogic = settings?.ItemLogic ?? false;
  return !itemLogic; // consumable_logic = not item_logic
}

/**
 * Get the Bowser door mode
 * @param {Object} staticData - Static game data
 * @returns {number}
 */
function getBowserDoor(staticData) {
  const settings = staticData?.settings?.[1];
  let bowserDoor = settings?.BowserDoorMode ?? 0;
  // Python logic: if bowser_door == 4, set it to 3
  if (bowserDoor === 4) {
    bowserDoor = 3;
  }
  return bowserDoor;
}

/**
 * Get Luigi pieces required
 * @param {Object} staticData - Static game data
 * @returns {number}
 */
function getLuigiPieces(staticData) {
  const settings = staticData?.settings?.[1];
  return settings?.LuigiPiecesRequired ?? 25;
}

/**
 * Check if player has item (helper for internal use)
 * @param {Object} snapshot - Canonical state snapshot
 * @param {string} itemName - Name of the item
 * @returns {boolean}
 */
function hasItem(snapshot, itemName) {
  if (!snapshot?.inventory) return false;
  return (snapshot.inventory[itemName] || 0) > 0;
}

/**
 * Count items (helper for internal use)
 * @param {Object} snapshot - Canonical state snapshot
 * @param {string} itemName - Name of the item
 * @returns {number}
 */
function countItem(snapshot, itemName) {
  if (!snapshot?.inventory) return 0;
  return snapshot.inventory[itemName] || 0;
}

/**
 * Check if player has middle ring access
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function has_midring(snapshot, staticData) {
  const midringStart = getMidringStart(staticData);
  return midringStart || hasItem(snapshot, 'Middle Ring');
}

/**
 * Check if player has reconstituted Luigi
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function reconstitute_luigi(snapshot, staticData) {
  const luigiPieces = getLuigiPieces(staticData);
  return countItem(snapshot, 'Piece of Luigi') >= luigiPieces;
}

/**
 * Check if player has bandit bonus items
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function bandit_bonus(snapshot, staticData) {
  return hasItem(snapshot, 'Bandit Consumables') || hasItem(snapshot, 'Bandit Watermelons');
}

/**
 * Check if player has item bonus
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function item_bonus(snapshot, staticData) {
  return hasItem(snapshot, 'Bonus Consumables');
}

/**
 * Check if player has combat item consumables
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function combat_item(snapshot, staticData) {
  const consumableLogic = getConsumableLogic(staticData);
  if (!consumableLogic) {
    return false;
  }

  const gameLogic = getGameLogic(staticData);
  if (gameLogic === 'Easy') {
    return item_bonus(snapshot, staticData);
  } else {
    return bandit_bonus(snapshot, staticData) || item_bonus(snapshot, staticData);
  }
}

/**
 * Check if player has melon consumables
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function melon_item(snapshot, staticData) {
  const consumableLogic = getConsumableLogic(staticData);
  if (!consumableLogic) {
    return false;
  }

  const gameLogic = getGameLogic(staticData);
  if (gameLogic === 'Easy') {
    return item_bonus(snapshot, staticData);
  } else {
    return hasItem(snapshot, 'Bandit Watermelons') || item_bonus(snapshot, staticData);
  }
}

/**
 * Check default visibility
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function default_vis(snapshot, staticData) {
  return getCloudsAlwaysVisible(staticData);
}

/**
 * Check if player can see clouds
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function cansee_clouds(snapshot, staticData) {
  const gameLogic = getGameLogic(staticData);
  if (gameLogic !== 'Easy') {
    return true;
  } else {
    return default_vis(snapshot, staticData) ||
           hasItem(snapshot, 'Secret Lens') ||
           combat_item(snapshot, staticData);
  }
}

/**
 * Check Bowser door 1 requirements
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function bowserdoor_1(snapshot, staticData) {
  const gameLogic = getGameLogic(staticData);
  if (gameLogic === 'Easy') {
    return hasItem(snapshot, 'Egg Plant') &&
           hasItem(snapshot, '! Switch') &&
           countItem(snapshot, 'Egg Capacity Upgrade') >= 2;
  } else if (gameLogic === 'Normal') {
    return hasItem(snapshot, 'Egg Plant') &&
           countItem(snapshot, 'Egg Capacity Upgrade') >= 1;
  } else {
    return hasItem(snapshot, 'Egg Plant');
  }
}

/**
 * Check Bowser door 2 requirements
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function bowserdoor_2(snapshot, staticData) {
  const gameLogic = getGameLogic(staticData);
  if (gameLogic === 'Easy') {
    return ((countItem(snapshot, 'Egg Capacity Upgrade') >= 3 && hasItem(snapshot, 'Egg Plant')) ||
            combat_item(snapshot, staticData)) &&
           hasItem(snapshot, 'Key');
  } else if (gameLogic === 'Normal') {
    return ((countItem(snapshot, 'Egg Capacity Upgrade') >= 2 && hasItem(snapshot, 'Egg Plant')) ||
            combat_item(snapshot, staticData)) &&
           hasItem(snapshot, 'Key');
  } else {
    return ((countItem(snapshot, 'Egg Capacity Upgrade') >= 1 && hasItem(snapshot, 'Egg Plant')) ||
            combat_item(snapshot, staticData)) &&
           hasItem(snapshot, 'Key');
  }
}

/**
 * Check Bowser door 3 requirements
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function bowserdoor_3(snapshot, staticData) {
  return true; // Always accessible
}

/**
 * Check Bowser door 4 requirements
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean}
 */
export function bowserdoor_4(snapshot, staticData) {
  return true; // Always accessible
}

// Helper functions object for registration
export const helperFunctions = {
  has_midring,
  reconstitute_luigi,
  bandit_bonus,
  item_bonus,
  combat_item,
  melon_item,
  default_vis,
  cansee_clouds,
  bowserdoor_1,
  bowserdoor_2,
  bowserdoor_3,
  bowserdoor_4,
};
