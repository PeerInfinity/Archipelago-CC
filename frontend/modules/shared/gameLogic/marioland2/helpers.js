/**
 * Super Mario Land 2 Helper Functions
 *
 * These helpers implement game-specific logic for Super Mario Land 2
 * that can't be expressed purely through the rule system.
 */

/**
 * Check if a level has auto-scroll enabled.
 *
 * @param {Object} state - The current game state
 * @param {number} player - The player ID
 * @param {string} level - The level name
 * @returns {boolean} True if level has auto-scroll and no cancel items
 */
export function is_auto_scroll(state, player, level) {
    // Check if player has cancel auto scroll items
    if (state.has_any(["Cancel Auto Scroll", `Cancel Auto Scroll - ${level}`], player)) {
        return false;
    }

    // For now, assume auto-scroll is disabled (default safe behavior)
    // In a full implementation, we would check state.multiworld.worlds[player].auto_scroll_levels
    // but that data structure isn't available in the frontend
    return false;
}

/**
 * Check if player can traverse pipes to the right.
 */
export function has_pipe_right(state, player) {
    return state.has_any(["Pipe Traversal - Right", "Pipe Traversal"], player);
}

/**
 * Check if player can traverse pipes to the left.
 */
export function has_pipe_left(state, player) {
    return state.has_any(["Pipe Traversal - Left", "Pipe Traversal"], player);
}

/**
 * Check if player can traverse pipes downward.
 */
export function has_pipe_down(state, player) {
    return state.has_any(["Pipe Traversal - Down", "Pipe Traversal"], player);
}

/**
 * Check if player can traverse pipes upward.
 */
export function has_pipe_up(state, player) {
    return state.has_any(["Pipe Traversal - Up", "Pipe Traversal"], player);
}

/**
 * Check if player has enough level progression items.
 * Handles both regular and x2 variants.
 *
 * @param {Object} state - The current game state
 * @param {string} item - The progression item name
 * @param {number} player - The player ID
 * @param {number} count - Required count (default 1)
 * @returns {boolean} True if player has enough progression
 */
export function has_level_progression(state, item, player, count = 1) {
    const regular = state.count(item, player);
    const double = state.count(`${item} x2`, player);
    return (regular + (double * 2)) >= count;
}

/**
 * Check if Pumpkin Zone 1 midway bell is accessible.
 */
export function pumpkin_zone_1_midway_bell(state, player) {
    return (
        (has_pipe_down(state, player) && !is_auto_scroll(state, player, "Pumpkin Zone 1")) ||
        state.has("Pumpkin Zone 1 Midway Bell", player)
    );
}

/**
 * Check if Pumpkin Zone 1 normal exit is accessible.
 */
export function pumpkin_zone_1_normal_exit(state, player) {
    return pumpkin_zone_1_midway_bell(state, player);
}

/**
 * Check if player is not blocked by sharks in Turtle Zone 1.
 *
 * This is a simplified version that assumes worst-case (2 sharks).
 * The Python version checks sprite randomization data which isn't available in frontend.
 */
export function not_blocked_by_sharks(state, player) {
    // Carrot allows flying over sharks
    if (state.has("Carrot", player)) {
        return true;
    }

    // Assume worst case: 2 sharks present
    // Need both Mushroom and Fire Flower to pass 2 sharks
    return state.has_all(["Mushroom", "Fire Flower"], player);
}

/**
 * Check if Turtle Zone 1 normal exit is accessible.
 */
export function turtle_zone_1_normal_exit(state, player) {
    return not_blocked_by_sharks(state, player);
}

/**
 * Check if Mario Zone 1 normal exit is accessible.
 */
export function mario_zone_1_normal_exit(state, player) {
    // If no auto-scroll, exit is accessible
    if (!is_auto_scroll(state, player, "Mario Zone 1")) {
        return true;
    }
    // If auto-scroll is enabled, need power-ups to reach exit
    return state.has_any(["Mushroom", "Fire Flower"], player);
}

/**
 * Check if Mario Zone 1 midway bell is accessible.
 */
export function mario_zone_1_midway_bell(state, player) {
    return (
        !is_auto_scroll(state, player, "Mario Zone 1") ||
        state.has("Mario Zone 1 Midway Bell", player)
    );
}

/**
 * Check if Macro Zone 1 normal exit is accessible.
 */
export function macro_zone_1_normal_exit(state, player) {
    return has_pipe_down(state, player) || state.has("Macro Zone 1 Midway Bell", player);
}

/**
 * Check if Macro Zone 1 midway bell is accessible.
 */
export function macro_zone_1_midway_bell(state, player) {
    return has_pipe_down(state, player) || state.has("Macro Zone 1 Midway Bell", player);
}
