/**
 * Super Mario Land 2 Helper Functions
 *
 * Only helpers that access runtime data or have complex logic that
 * cannot be expressed in rules.json are implemented here.
 * All other helpers are inlined directly into the rules.
 */

/**
 * Check if player has any of the specified items
 * @param {Object} snapshot - Game state snapshot
 * @param {Array<string>} items - Array of item names to check
 * @returns {boolean} True if player has at least one item
 */
function hasAny(snapshot, items) {
    const inventory = snapshot?.inventory || {};
    for (const itemName of items) {
        const count = inventory[itemName] || 0;
        if (count > 0) {
            return true;
        }
    }
    return false;
}

/**
 * Check if player has a specific item
 * @param {Object} snapshot - Game state snapshot
 * @param {string} itemName - Item name to check
 * @returns {boolean} True if player has the item
 */
function has(snapshot, itemName) {
    const inventory = snapshot?.inventory || {};
    return (inventory[itemName] || 0) > 0;
}

/**
 * Get count of a specific item
 * @param {Object} snapshot - Game state snapshot
 * @param {string} itemName - Item name to count
 * @returns {number} Count of the item
 */
function count(snapshot, itemName) {
    const inventory = snapshot?.inventory || {};
    return inventory[itemName] || 0;
}

/**
 * Check if a level has auto-scroll enabled.
 *
 * This helper accesses runtime auto_scroll_levels data that isn't
 * available in rules.json. The frontend assumes auto-scroll is
 * disabled (returns false) since we can't access the actual data.
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} level - The level name
 * @returns {boolean} True if level has auto-scroll and no cancel items
 */
export function is_auto_scroll(snapshot, staticData, level) {
    // Check if player has cancel auto scroll items
    if (hasAny(snapshot, ["Cancel Auto Scroll", `Cancel Auto Scroll - ${level}`])) {
        return false;
    }

    // Auto-scroll data is runtime-dependent and not available in the frontend.
    // Return false (assume no auto-scroll) for conservative sphere log matching.
    return false;
}

/**
 * Check if player is not blocked by sharks in Turtle Zone 1.
 *
 * This helper accesses runtime sprite_data that isn't available
 * in rules.json. The frontend assumes no sharks (returns true).
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can pass sharks
 */
export function not_blocked_by_sharks(snapshot, staticData) {
    // Carrot allows flying over sharks
    if (has(snapshot, "Carrot")) {
        return true;
    }

    // Sprite data is runtime-dependent and not available in the frontend.
    // Return true (assume no sharks) for conservative sphere log matching.
    return true;
}

/**
 * Check if player has enough level progression items.
 * Handles both regular and x2 variants.
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} item - The progression item name
 * @param {number} requiredCount - Required count (default 1)
 * @returns {boolean} True if player has enough progression
 */
export function has_level_progression(snapshot, staticData, item, requiredCount = 1) {
    const regular = count(snapshot, item);
    const double = count(snapshot, `${item} x2`);
    return (regular + (double * 2)) >= requiredCount;
}
