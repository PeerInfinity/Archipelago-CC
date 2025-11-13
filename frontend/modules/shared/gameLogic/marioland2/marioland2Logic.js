/**
 * Super Mario Land 2 Game Logic Module
 *
 * Provides game-specific logic for Super Mario Land 2 including helper functions
 * for pipe traversal, auto-scroll detection, and zone-specific rules.
 */

import {
    is_auto_scroll,
    has_pipe_right,
    has_pipe_left,
    has_pipe_down,
    has_pipe_up,
    has_level_progression,
    pumpkin_zone_1_midway_bell,
    pumpkin_zone_1_normal_exit,
    not_blocked_by_sharks,
    turtle_zone_1_normal_exit,
    mario_zone_1_normal_exit,
    mario_zone_1_midway_bell,
    macro_zone_1_normal_exit,
    macro_zone_1_midway_bell
} from './helpers.js';

/**
 * Super Mario Land 2 Helper Functions
 * These can be called from rules using the helper type.
 */
export const helperFunctions = {
    is_auto_scroll,
    has_pipe_right,
    has_pipe_left,
    has_pipe_down,
    has_pipe_up,
    has_level_progression,
    pumpkin_zone_1_midway_bell,
    pumpkin_zone_1_normal_exit,
    not_blocked_by_sharks,
    turtle_zone_1_normal_exit,
    mario_zone_1_normal_exit,
    mario_zone_1_midway_bell,
    macro_zone_1_normal_exit,
    macro_zone_1_midway_bell
};

/**
 * Initialize Super Mario Land 2 game logic.
 *
 * @param {Object} context - The game logic context
 * @returns {Object} Super Mario Land 2-specific logic handlers
 */
export function initializeGameLogic(context) {
    return {
        helpers: helperFunctions
    };
}

// Export for game logic registry
export default {
    initializeGameLogic,
    helperFunctions
};
