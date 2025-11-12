/**
 * MegaMan Battle Network 3 game-specific helper functions
 */

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
    explore_score
};
