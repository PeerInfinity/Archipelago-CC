/**
 * Super Mario Land 2 Game Logic Module
 *
 * Provides game-specific logic for Super Mario Land 2.
 * Most helpers are now inlined directly into rules.json.
 * Only helpers that access runtime data are implemented here.
 */

import {
    is_auto_scroll,
    not_blocked_by_sharks,
    has_level_progression
} from './helpers.js';

/**
 * Super Mario Land 2 Helper Functions
 * Only helpers that can't be inlined into rules.json are included.
 */
export const helperFunctions = {
    is_auto_scroll,
    not_blocked_by_sharks,
    has_level_progression
};

/**
 * State methods for Super Mario Land 2.
 * These handle special state checks like counting unique items from a list.
 */
export const stateMethods = {
    has_from_list_unique(snapshot, staticData, items, count) {
        let found = 0;
        for (const itemName of items) {
            if (snapshot?.inventory?.[itemName] > 0) {
                found++;
                if (found >= count) {
                    return true;
                }
            }
        }
        return false;
    }
};

/**
 * Initialize Super Mario Land 2 game logic.
 *
 * @param {Object} context - The game logic context
 * @returns {Object} Super Mario Land 2-specific logic handlers
 */
export function initializeGameLogic(context) {
    return {
        helpers: helperFunctions,
        stateMethods: stateMethods
    };
}

// Export for game logic registry
export default {
    initializeGameLogic,
    helperFunctions,
    stateMethods
};
