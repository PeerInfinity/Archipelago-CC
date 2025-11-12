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

  // If door is a RoomAndDoor object (array in JSON: [room, door_name])
  // we need to check if that door can be opened
  // For now, return true as a placeholder
  // TODO: Implement proper door checking logic
  console.warn(`[lingo_can_use_entrance] Door parameter not null/undefined: ${JSON.stringify(door)}, returning true as placeholder`);
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
