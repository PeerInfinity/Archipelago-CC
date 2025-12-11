/**
 * Terraria Game Logic Module
 *
 * Provides game-specific logic for Terraria including helper functions
 * for NPC counts, tool power levels, and minion slots.
 *
 * Note: check_setting was removed because settings are now exported at top level
 * via COMPUTED_SETTINGS and resolved directly using 'name' type rules.
 */

import { has_n_from_list, has_minions } from './helpers.js';

/**
 * Terraria Helper Functions
 * These can be called from rules using the helper type.
 */
export const helperFunctions = {
    has_n_from_list,
    has_minions
};

/**
 * Initialize Terraria game logic.
 *
 * @param {Object} context - The game logic context
 * @returns {Object} Terraria-specific logic handlers
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
