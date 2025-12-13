/**
 * Kirby's Dream Land 3 Game Logic Module
 *
 * Provides game-specific helpers for complex rules that cannot be
 * easily expressed in rules.json, particularly those involving
 * the copy_abilities mapping.
 */

import {
    can_assemble_rob,
    can_fix_angel_wings
} from './helpers.js';

/**
 * KDL3 Helper Functions
 * These handle complex runtime logic involving copy_abilities.
 */
export const helperFunctions = {
    can_assemble_rob,
    can_fix_angel_wings
};

/**
 * Initialize KDL3 game logic.
 *
 * @param {Object} context - The game logic context
 * @returns {Object} KDL3-specific logic handlers
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
