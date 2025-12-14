/**
 * Wargroove Game Logic Module
 *
 * NOTE: Wargroove's state methods (_wargroove_has_item, _wargroove_has_item_and_region)
 * are now expanded inline during export to rules.json. They are converted to:
 * - _wargroove_has_item -> item_check
 * - _wargroove_has_region -> can_reach
 * - _wargroove_has_item_and_region -> and(item_check, can_reach)
 *
 * No JavaScript fallback implementations are needed.
 */

/**
 * State methods for Wargroove.
 * Empty - all state methods are now handled by rules.json export expansion.
 */
export const stateMethods = {};

/**
 * Helper functions for Wargroove.
 * Empty - no game-specific helpers needed.
 */
export const helperFunctions = {};

/**
 * Initialize Wargroove game logic.
 *
 * @param {Object} context - The game logic context
 * @returns {Object} Wargroove-specific logic handlers
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
