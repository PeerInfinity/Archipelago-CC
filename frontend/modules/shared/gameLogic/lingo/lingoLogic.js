/**
 * Lingo game-specific logic functions
 * These pure functions operate on a canonical state object
 */

/**
 * Check if player can use an entrance
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data including rules
 * @param {string} room - Target room name
 * @param {*} door - Door parameter (RoomAndDoor object or null/undefined)
 * @returns {boolean} True if entrance can be used
 */
export function lingo_can_use_entrance(snapshot, staticData, room, door) {
  // If door is null or undefined, the entrance is always accessible
  // This matches the Python logic: if door is None: return True
  if (door === null || door === undefined) {
    return true;
  }

  // Door is a RoomAndDoor tuple: [room_name, door_name]
  // door[0] is the room (can be null)
  // door[1] is the door name
  if (!Array.isArray(door) || door.length < 2) {
    console.error(`[lingo_can_use_entrance] Invalid door format: ${JSON.stringify(door)}`);
    return false;
  }

  // Determine the effective room: use door[0] if not null, otherwise use room parameter
  const effectiveRoom = door[0] !== null ? door[0] : room;
  const doorName = door[1];

  // Build the door item name: "Room - Door"
  const doorItemName = `${effectiveRoom} - ${doorName}`;

  // Get player ID from snapshot (usually 1 for single-player)
  const playerId = snapshot?.playerId || '1';

  // Check if this door has an associated item in the game's item list
  const items = staticData?.items?.[playerId];
  const doorItemExists = items && (doorItemName in items);

  if (doorItemExists) {
    // This door requires an item - check if player has it
    const hasItem = !!(snapshot?.inventory && snapshot.inventory[doorItemName] > 0);
    return hasItem;
  }

  // Door doesn't have an associated item, so it must be accessible through
  // other means (e.g., solving panels, access requirements).
  // For doors without items, we assume they're always accessible.
  // TODO: Implement proper access requirements checking for doors without items
  return true;
}

/**
 * Check if player can access a location
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data including rules
 * @param {*} location - Location access requirements
 * @returns {boolean} True if location can be accessed
 */
export function lingo_can_use_location(snapshot, staticData, location) {
  // This is a placeholder implementation
  // The actual logic would need to evaluate AccessRequirements
  // For now, return true to allow progression
  // TODO: Implement proper location access checking
  return true;
}

/**
 * Check if player can satisfy access requirements
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data including rules
 * @param {Object} access - AccessRequirements object
 * @returns {boolean} True if all requirements are satisfied
 */
export function _lingo_can_satisfy_requirements(snapshot, staticData, access) {
  // Access should be an AccessRequirements object with these fields:
  // - rooms: array of room names that must be reachable
  // - doors: array of {room, door} objects that must be openable
  // - colors: array of color names required (if shuffle_colors)
  // - items: array of item names required
  // - progression: object mapping progressive item names to required counts
  // - the_master: boolean for mastery requirement
  // - postgame: boolean for postgame flag

  if (!access) {
    // No requirements means always accessible
    return true;
  }

  const playerId = snapshot?.playerId || '1';

  // Check room requirements - all required rooms must be reachable
  if (access.rooms && access.rooms.length > 0) {
    const reachableRegions = snapshot?.reachableRegions || new Set();
    for (const roomName of access.rooms) {
      if (!reachableRegions.has(roomName)) {
        return false;
      }
    }
  }

  // Check door requirements - all required doors must be openable
  if (access.doors && access.doors.length > 0) {
    for (const doorReq of access.doors) {
      // doorReq is {room, door}
      if (!_lingo_can_open_door(snapshot, staticData, doorReq.room, doorReq.door)) {
        return false;
      }
    }
  }

  // Check color requirements (only if shuffle_colors is enabled)
  // For now, we'll check if the setting is in staticData
  const settings = staticData?.settings?.[playerId] || {};
  const shuffleColors = settings.shuffle_colors;

  if (access.colors && access.colors.length > 0 && shuffleColors) {
    const inventory = snapshot?.inventory || {};
    for (const color of access.colors) {
      // Colors are capitalized in the item pool
      const colorItem = color.charAt(0).toUpperCase() + color.slice(1);
      if (!inventory[colorItem] || inventory[colorItem] < 1) {
        return false;
      }
    }
  }

  // Check item requirements - all required items must be in inventory
  if (access.items && access.items.length > 0) {
    const inventory = snapshot?.inventory || {};
    for (const itemName of access.items) {
      if (!inventory[itemName] || inventory[itemName] < 1) {
        return false;
      }
    }
  }

  // Check progressive item requirements - must have specific counts
  if (access.progression && Object.keys(access.progression).length > 0) {
    const inventory = snapshot?.inventory || {};
    for (const [itemName, requiredCount] of Object.entries(access.progression)) {
      const actualCount = inventory[itemName] || 0;
      if (actualCount < requiredCount) {
        return false;
      }
    }
  }

  // Check mastery requirement
  if (access.the_master) {
    // This would require checking lingo_can_use_mastery_location
    // For now, we'll skip this as it requires more complex logic
    // TODO: Implement mastery checking
    console.warn('[_lingo_can_satisfy_requirements] Mastery requirement not yet implemented');
  }

  // Check postgame requirement - if postgame is false and player has "Prevent Victory", deny access
  if (access.postgame === false) {
    const inventory = snapshot?.inventory || {};
    if (inventory['Prevent Victory'] && inventory['Prevent Victory'] > 0) {
      return false;
    }
  }

  return true;
}

/**
 * Helper function to check if a door can be opened
 * @param {Object} snapshot - Canonical state snapshot
 * @param {Object} staticData - Static game data including rules
 * @param {string} room - Room name
 * @param {string} door - Door name
 * @returns {boolean} True if the door can be opened
 */
function _lingo_can_open_door(snapshot, staticData, room, door) {
  // Build the door item name: "Room - Door"
  const doorItemName = `${room} - ${door}`;

  const playerId = snapshot?.playerId || '1';
  const items = staticData?.items?.[playerId];
  const doorItemExists = items && (doorItemName in items);

  if (doorItemExists) {
    // This door requires an item - check if player has it
    const inventory = snapshot?.inventory || {};
    const hasItem = !!(inventory[doorItemName] && inventory[doorItemName] > 0);

    // Check if it's a progressive item
    const itemData = items[doorItemName];
    if (itemData?.groups && itemData.groups.includes('Progressive')) {
      // For progressive items, we may need to check a specific count
      // This would require looking up the progression requirement
      // For now, just check if we have at least 1
      return hasItem;
    }

    return hasItem;
  }

  // Door doesn't have an associated item, so it must be accessible through
  // other means (e.g., access requirements).
  // For doors without items, we need to check door_reqs from player_logic
  // This data would need to be exported in settings or elsewhere
  // For now, assume accessible
  // TODO: Export and check door_reqs data
  return true;
}

/**
 * Generic helper functions module export
 */
export const helperFunctions = {
  lingo_can_use_entrance,
  lingo_can_use_location,
  _lingo_can_satisfy_requirements,
};
