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
 * Generic helper functions module export
 */
export const helperFunctions = {
  lingo_can_use_entrance,
  lingo_can_use_location,
};
