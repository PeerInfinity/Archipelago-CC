/**
 * Links Awakening DX Game Logic Module
 *
 * Provides game-specific logic for LADX including helper functions
 * and custom state handling.
 */

import { calculateRupees, hasRupees, count } from './helpers.js';

/**
 * LADX Helper Functions
 * These can be called from rules using the helper type.
 */
export const helperFunctions = {
    calculateRupees,
    hasRupees,
    count  // Used by stateInterface.js countItem() for all item count checks
};

/**
 * Initialize LADX game logic.
 *
 * @param {Object} context - The game logic context
 * @returns {Object} LADX-specific logic handlers
 */
export function initializeGameLogic(context) {
    return {
        helpers: helperFunctions,

        /**
         * Override item count retrieval to handle RUPEES currency.
         * RUPEES is computed from collected rupee items, not stored directly.
         */
        getItemCount: function(state, itemName, player) {
            if (itemName === 'RUPEES') {
                return calculateRupees(state, player);
            }
            // For all other items, use default behavior
            return state.count(itemName, player);
        },

        /**
         * Check if player has an item, with special handling for RUPEES.
         */
        hasItem: function(state, itemName, player, count = 1) {
            if (itemName === 'RUPEES') {
                return hasRupees(state, player, count);
            }
            // For all other items, use default behavior
            return state.has(itemName, player, count);
        }
    };
}

// Export for game logic registry
export default {
    initializeGameLogic,
    helperFunctions
};
