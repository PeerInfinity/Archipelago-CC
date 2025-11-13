/**
 * Overcooked! 2 game-specific helper functions
 *
 * This implements the access logic for Overcooked! 2, including star counting
 * and level completion requirements.
 */

/**
 * Check if player has enough total stars (Star + Bonus Star)
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {number} requiredStars - Number of stars required
 * @returns {boolean} True if player has enough stars
 */
export function has_enough_stars(snapshot, staticData, requiredStars) {
    if (!snapshot || !snapshot.items) {
        return false;
    }

    // Count both Star and Bonus Star items
    const starCount = snapshot.items['Star'] || 0;
    const bonusStarCount = snapshot.items['Bonus Star'] || 0;
    const totalStars = starCount + bonusStarCount;

    return totalStars >= requiredStars;
}

/**
 * Check if player can earn a specific number of stars on a level
 *
 * This implements the has_requirements_for_level_star logic from worlds/overcooked2/Logic.py
 * It checks if the player has the required items to earn a specific star count on a level.
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data (includes level_logic)
 * @param {Object} level - Level object (or level_id)
 * @param {number} stars - Number of stars to check for (1, 2, or 3)
 * @returns {boolean} True if player can earn the stars
 */
export function has_requirements_for_level_star(snapshot, staticData, level, stars) {
    if (!snapshot || !staticData) {
        return false;
    }

    // Extract level_id from level parameter
    let levelId;
    if (typeof level === 'object' && level !== null) {
        levelId = level.level_id;
    } else if (typeof level === 'number') {
        levelId = level;
    } else {
        console.warn('[Overcooked2] has_requirements_for_level_star: invalid level parameter', level);
        return false;
    }

    // Get level logic from static data
    const levelLogic = staticData.level_logic;
    if (!levelLogic || !levelLogic[levelId]) {
        // No logic defined for this level - assume accessible
        return true;
    }

    const logic = levelLogic[levelId];

    // Check exclusive requirements (must have ALL of these items)
    if (logic.exclusive && logic.exclusive.length > 0) {
        for (const itemName of logic.exclusive) {
            if (!snapshot.items[itemName]) {
                return false;
            }
        }
    }

    // Check additive requirements (sum of weights must be >= 1.0)
    if (logic.additive && Object.keys(logic.additive).length > 0) {
        let totalWeight = 0;
        for (const [itemName, weight] of Object.entries(logic.additive)) {
            if (snapshot.items[itemName]) {
                totalWeight += weight;
            }
        }

        // Need at least weight of 1.0 to complete
        if (totalWeight < 1.0) {
            return false;
        }
    }

    // All requirements met
    return true;
}

/**
 * Check if player meets requirements for a level
 *
 * This is a simpler version that just checks the requirements without star-specific logic.
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {Object} level - Level object
 * @param {Object} requirements - Requirements object with exclusive and additive properties
 * @returns {boolean} True if player meets the requirements
 */
export function meets_requirements(snapshot, staticData, level, requirements) {
    if (!snapshot || !requirements) {
        return false;
    }

    // Check exclusive requirements (must have ALL of these items)
    if (requirements.exclusive && requirements.exclusive.length > 0) {
        for (const itemName of requirements.exclusive) {
            if (!snapshot.items[itemName]) {
                return false;
            }
        }
    }

    // Check additive requirements (sum of weights must be >= 1.0)
    if (requirements.additive && Object.keys(requirements.additive).length > 0) {
        let totalWeight = 0;
        for (const [itemName, weight] of Object.entries(requirements.additive)) {
            if (snapshot.items[itemName]) {
                totalWeight += weight;
            }
        }

        // Need at least weight of 1.0 to complete
        if (totalWeight < 1.0) {
            return false;
        }
    }

    // All requirements met
    return true;
}
