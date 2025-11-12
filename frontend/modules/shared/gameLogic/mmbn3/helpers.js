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

    // Get the reachable regions from the snapshot
    const reachableRegions = snapshot?.reachable_regions || new Set();

    // If you can reach WWW Island, you can access everything
    if (reachableRegions.has('WWW Island')) {
        return 999;
    }

    // Add scores for each accessible region
    if (reachableRegions.has('SciLab Overworld')) {
        score += 3;
    }
    if (reachableRegions.has('SciLab Cyberworld')) {
        score += 1;
    }
    if (reachableRegions.has('Yoka Overworld')) {
        score += 2;
    }
    if (reachableRegions.has('Yoka Cyberworld')) {
        score += 1;
    }
    if (reachableRegions.has('Beach Overworld')) {
        score += 3;
    }
    if (reachableRegions.has('Beach Cyberworld')) {
        score += 1;
    }
    if (reachableRegions.has('Undernet')) {
        score += 2;
    }
    if (reachableRegions.has('Deep Undernet')) {
        score += 1;
    }
    if (reachableRegions.has('Secret Area')) {
        score += 1;
    }

    return score;
}

export default {
    explore_score
};
