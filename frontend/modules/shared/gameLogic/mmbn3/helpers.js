/**
 * MegaMan Battle Network 3 game-specific helper functions
 */

/**
 * Check if the player has an item
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to check
 * @returns {boolean} True if player has the item
 */
export function has(snapshot, staticData, itemName) {
    const hasItem = !!(snapshot?.inventory && snapshot.inventory[itemName] > 0);

    // Debug logging for "Recov30 *" specifically
    if (itemName === "Recov30 *") {
        console.log(`[mmbn3 has()] Checking for "${itemName}"`);
        console.log(`[mmbn3 has()] Inventory exists: ${!!snapshot?.inventory}`);
        if (snapshot?.inventory) {
            const invKeys = Object.keys(snapshot.inventory);
            console.log(`[mmbn3 has()] Inventory has ${invKeys.length} keys`);
            console.log(`[mmbn3 has()] First 10 keys:`, invKeys.slice(0, 10));
            console.log(`[mmbn3 has()] Last 10 keys:`, invKeys.slice(-10));
            console.log(`[mmbn3 has()] Inventory constructor:`, snapshot.inventory.constructor.name);
            console.log(`[mmbn3 has()] Checking if "Recov30 *" in inventory:`, itemName in snapshot.inventory);
            console.log(`[mmbn3 has()] hasOwnProperty check:`, snapshot.inventory.hasOwnProperty(itemName));
        }
        console.log(`[mmbn3 has()] Item count: ${snapshot?.inventory?.[itemName]}`);
        console.log(`[mmbn3 has()] Result: ${hasItem}`);
    }

    return hasItem;
}

/**
 * Count how many of an item the player has
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {string} itemName - Name of the item to count
 * @returns {number} Count of the item
 */
export function count(snapshot, staticData, itemName) {
    return snapshot?.inventory?.[itemName] || 0;
}

/**
 * Calculate an exploration score based on which regions are accessible
 * This is used to gate certain locations (like Numberman Codes) based on game progression
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {number} The exploration score
 */
export function explore_score(snapshot, staticData) {
    let score = 0;

    // Helper function to check if a region is reachable
    const canReachRegion = (regionName) => {
        const status = snapshot?.regionReachability?.[regionName];
        return status === 'reachable' || status === 'checked';
    };

    // If you can reach WWW Island, you can access everything
    if (canReachRegion('WWW Island')) {
        return 999;
    }

    // Add scores for each accessible region
    if (canReachRegion('SciLab Overworld')) {
        score += 3;
    }
    if (canReachRegion('SciLab Cyberworld')) {
        score += 1;
    }
    if (canReachRegion('Yoka Overworld')) {
        score += 2;
    }
    if (canReachRegion('Yoka Cyberworld')) {
        score += 1;
    }
    if (canReachRegion('Beach Overworld')) {
        score += 3;
    }
    if (canReachRegion('Beach Cyberworld')) {
        score += 1;
    }
    if (canReachRegion('Undernet')) {
        score += 2;
    }
    if (canReachRegion('Deep Undernet')) {
        score += 1;
    }
    if (canReachRegion('Secret Area')) {
        score += 1;
    }

    return score;
}

export default {
    has,
    count,
    explore_score
};
