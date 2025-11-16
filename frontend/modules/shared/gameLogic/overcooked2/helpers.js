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
 * @param {Object} staticData - Static game data (includes level_logic in game_info)
 * @param {Object} level - Level object (or level_id)
 * @param {number} stars - Number of stars to check for (1, 2, or 3)
 * @returns {boolean} True if player can earn the stars
 */
export function has_requirements_for_level_star(snapshot, staticData, level, stars, context) {
    if (!snapshot || !staticData) {
        return false;
    }

    // Extract level_id from level parameter
    let levelId;
    if (typeof level === 'object' && level !== null) {
        levelId = level.level_id;
    } else if (typeof level === 'number') {
        levelId = level;
    } else if (level === undefined && context && context.location) {
        // Try to extract level_id from location name
        // Location names are like "1-1 (1-Star)", "2-3 Completed", etc.
        const locationName = context.location.name;
        const match = locationName.match(/^(\d+-\d+)/);
        if (match) {
            const levelName = match[1];
            // Convert level name to level_id
            // Level names are like "1-1", "2-3", "K-1", etc.
            // Level IDs are sequential: 1-1=1, 1-2=2, ..., 1-6=6, 2-1=7, ..., 6-6=36, K-1=37, ..., K-8=44
            const parts = levelName.split('-');
            if (parts.length === 2) {
                const world = parseInt(parts[0]);
                const level = parseInt(parts[1]);
                if (!isNaN(world) && !isNaN(level) && world >= 1 && world <= 6 && level >= 1 && level <= 6) {
                    levelId = (world - 1) * 6 + level;
                } else if (parts[0] === 'K') {
                    // Kevin levels: K-1=37, K-2=38, ..., K-8=44
                    levelId = 36 + level;
                }
            }
        }
        if (!levelId) {
            console.warn('[Overcooked2] has_requirements_for_level_star: could not extract level_id from location', locationName);
            return false;
        }
    } else {
        console.warn('[Overcooked2] has_requirements_for_level_star: invalid level parameter', level);
        return false;
    }

    // Get level logic from game_info
    const playerId = staticData?.playerId || '1';
    const levelLogic = staticData?.game_info?.[playerId]?.level_logic;
    if (!levelLogic) {
        // No logic defined at all - assume accessible
        return true;
    }

    // Get level-specific requirements or fallback to global "*"
    let levelRequirements = levelLogic[levelId];

    // If level-specific requirements are all empty, use global "*" requirements
    if (!levelRequirements || !Array.isArray(levelRequirements)) {
        levelRequirements = levelLogic["*"];
    }

    if (!levelRequirements || !Array.isArray(levelRequirements)) {
        // No requirements defined - assume accessible
        return true;
    }

    // Get the requirements for this star count (stars is 1, 2, or 3)
    // Array index is stars - 1 (0-indexed)
    const starIndex = stars - 1;
    if (starIndex < 0 || starIndex >= levelRequirements.length) {
        // Invalid star count - assume accessible
        return true;
    }

    const starRequirement = levelRequirements[starIndex];
    if (!Array.isArray(starRequirement) || starRequirement.length < 2) {
        // Invalid structure - assume accessible
        return true;
    }

    // Extract exclusive and additive requirements
    // starRequirement is [exclusive, additive]
    const exclusive = starRequirement[0];
    const additive = starRequirement[1];

    // Check exclusive requirements (must have ALL of these items)
    // exclusive can be:
    // - empty object {} (no requirements)
    // - array of item names
    if (Array.isArray(exclusive) && exclusive.length > 0) {
        // Double-check snapshot.items exists (defensive programming)
        if (!snapshot || !snapshot.items) {
            return false;
        }
        for (const itemName of exclusive) {
            if (!snapshot.items[itemName]) {
                return false;
            }
        }
    }

    // Check additive requirements (sum of weights must be >= 1.0)
    // additive can be:
    // - empty object {} (no requirements)
    // - array of [itemName, weight] pairs
    if (Array.isArray(additive) && additive.length > 0) {
        // Double-check snapshot.items exists (defensive programming)
        if (!snapshot || !snapshot.items) {
            return false;
        }
        let totalWeight = 0;
        for (const pair of additive) {
            if (Array.isArray(pair) && pair.length >= 2) {
                const itemName = pair[0];
                const weight = pair[1];
                if (snapshot.items[itemName]) {
                    totalWeight += weight;
                }
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
