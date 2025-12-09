/**
 * Shivers Game Logic Module
 *
 * Helper functions are no longer needed - all Shivers rules are now
 * inlined in rules.json using standard state_method calls (has_all, etc.)
 */

/**
 * Shivers Helper Functions
 * Empty - helpers are inlined in rules.json during export.
 */
export const helperFunctions = {};

/**
 * Initialize Shivers game logic.
 *
 * @param {Object} context - The game logic context
 * @returns {Object} Shivers-specific logic handlers
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
