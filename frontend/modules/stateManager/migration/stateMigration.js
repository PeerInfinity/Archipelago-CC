/**
 * State migration utilities for converting between legacy and canonical state formats
 */

/**
 * Migrates a legacy Map-based inventory to the canonical plain object format
 * @param {Map|Object} legacyInventory - The legacy inventory (Map or already an object)
 * @param {string[]} allItems - List of all possible items for this game
 * @returns {Object.<string, number>} Canonical inventory object with all items
 */
export function migrateInventoryToCanonical(legacyInventory, allItems) {
    const canonical = {};
    
    // Initialize all items with count 0
    for (const item of allItems) {
        canonical[item] = 0;
    }
    
    // Copy existing inventory values
    if (legacyInventory instanceof Map) {
        // From Map format
        for (const [item, count] of legacyInventory.entries()) {
            canonical[item] = count;
        }
    } else if (typeof legacyInventory === 'object' && legacyInventory !== null) {
        // Already an object, just ensure all items are present
        for (const item of allItems) {
            canonical[item] = legacyInventory[item] || 0;
        }
    }
    
    return canonical;
}

/**
 * Migrates a complete legacy state to canonical format
 * @param {Object} legacyState - The legacy state from StateManager
 * @param {Object} staticData - Static game data (items, regions, etc.)
 * @returns {Object} Canonical state object
 */
export function migrateStateToCanonical(legacyState, staticData) {
    // This will be implemented as we progress through the refactoring
    // For now, return a basic structure
    return {
        game: legacyState.game || legacyState.gameId,
        gameId: legacyState.gameId,
        debugMode: legacyState.debugMode || false,
        autoCollectEventsEnabled: legacyState.autoCollectEventsEnabled !== false,
        
        player: {
            slot: legacyState.player?.slot || 1,
            team: legacyState.player?.team || 0,
            name: legacyState.player?.name || 'Player1'
        },
        
        settings: legacyState.settings || {},
        
        inventory: legacyState.inventory || {},
        
        flags: Array.isArray(legacyState.flags) ? legacyState.flags : [],
        
        reachability: legacyState.reachability || {},
        
        dungeons: legacyState.dungeons || {},
        
        eventLocations: legacyState.eventLocations || {}
    };
}

/**
 * Validates that a state object conforms to the canonical format
 * @param {Object} state - The state object to validate
 * @returns {{valid: boolean, errors: string[]}} Validation result
 */
export function validateCanonicalState(state) {
    const errors = [];
    
    // Check required top-level properties
    const requiredProps = ['game', 'gameId', 'player', 'settings', 'inventory', 'flags', 'reachability'];
    for (const prop of requiredProps) {
        if (!(prop in state)) {
            errors.push(`Missing required property: ${prop}`);
        }
    }
    
    // Validate player object
    if (state.player) {
        if (typeof state.player.slot !== 'number') {
            errors.push('player.slot must be a number');
        }
        if (typeof state.player.name !== 'string') {
            errors.push('player.name must be a string');
        }
    }
    
    // Validate inventory is a plain object
    if (state.inventory && (typeof state.inventory !== 'object' || state.inventory instanceof Map)) {
        errors.push('inventory must be a plain object');
    }
    
    // Validate flags is an array
    if (state.flags && !Array.isArray(state.flags)) {
        errors.push('flags must be an array');
    }
    
    // Validate reachability is a plain object
    if (state.reachability && typeof state.reachability !== 'object') {
        errors.push('reachability must be a plain object');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Creates a deep copy of a state object to prevent accidental mutations
 * @param {Object} state - The state object to copy
 * @returns {Object} Deep copy of the state
 */
export function deepCopyState(state) {
    // Simple deep copy using JSON (works for serializable objects)
    // This is what we'll use for sending across worker boundary anyway
    return JSON.parse(JSON.stringify(state));
}