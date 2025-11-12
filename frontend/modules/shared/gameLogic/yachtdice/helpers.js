/**
 * Yacht Dice game-specific helper functions
 *
 * This implements the scoring simulation logic for Yacht Dice to determine
 * if a player can reach a specific score based on their collected items.
 */

/**
 * Calculate the maximum achievable score based on current state
 *
 * This is the JavaScript implementation of the dice_simulation_state_change function
 * from worlds/yachtdice/Rules.py
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data (includes frags_per_dice, frags_per_roll, allowed_categories, difficulty)
 * @param {number} fragsPerDice - Number of fragments needed per dice (from args[0])
 * @param {number} fragsPerRoll - Number of fragments needed per roll (from args[1])
 * @param {Array<string>} allowedCategories - List of allowed category names (from args[2])
 * @param {number} difficulty - Game difficulty level 1-4 (from args[3])
 * @returns {number} The maximum achievable score
 */
export function dice_simulation_state_change(snapshot, staticData, fragsPerDice, fragsPerRoll, allowedCategories, difficulty) {
    // Check if we have a cached result
    if (snapshot.__yachtDiceMaxScore !== undefined) {
        return snapshot.__yachtDiceMaxScore;
    }

    // Extract progression from current state
    const progression = extractProgression(snapshot, fragsPerDice, fragsPerRoll, allowedCategories);
    const {categories, numDice, numRolls, fixedMult, stepMult, extraPoints} = progression;

    // Calculate the simulated score
    const simulatedScore = diceSimulationStrings(
        categories, numDice, numRolls, fixedMult, stepMult, difficulty
    );

    const maxScore = simulatedScore + extraPoints;

    // Cache the result
    snapshot.__yachtDiceMaxScore = maxScore;

    return maxScore;
}

/**
 * Extract progression items from the current state
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {number} fragsPerDice - Fragments per dice
 * @param {number} fragsPerRoll - Fragments per roll
 * @param {Array<string>} allowedCategories - Allowed categories
 * @returns {Object} Progression data
 */
function extractProgression(snapshot, fragsPerDice, fragsPerRoll, allowedCategories) {
    const items = snapshot?.items || {};

    // Count dice and rolls (including fragments)
    const diceFrags = (items["Dice Fragment"] || 0);
    const rollFrags = (items["Roll Fragment"] || 0);
    const numDice = (items["Dice"] || 0) + Math.floor(diceFrags / fragsPerDice);
    const numRolls = (items["Roll"] || 0) + Math.floor(rollFrags / fragsPerRoll);

    // Count multipliers
    const numFixedMults = items["Fixed Score Multiplier"] || 0;
    const numStepMults = items["Step Score Multiplier"] || 0;

    // Extract categories with their quantities
    const categories = [];
    for (const categoryName of allowedCategories) {
        const count = items[categoryName] || 0;
        if (count > 0) {
            categories.push({
                name: categoryName,
                quantity: count
            });
        }
    }

    // Count extra points
    let extraPoints = 0;
    extraPoints += (items["1 Point"] || 0) * 1;
    extraPoints += (items["10 Points"] || 0) * 10;
    extraPoints += (items["100 Points"] || 0) * 100;

    return {
        categories,
        numDice,
        numRolls,
        fixedMult: numFixedMults * 0.1,
        stepMult: numStepMults * 0.01,
        extraPoints
    };
}

/**
 * Simulate dice rolling to calculate expected score
 *
 * This is a simplified version of the Python implementation.
 * For now, it uses a basic estimation until we can port the full yacht_weights data.
 *
 * @param {Array<Object>} categories - Categories with their quantities
 * @param {number} numDice - Number of dice
 * @param {number} numRolls - Number of rolls
 * @param {number} fixedMult - Fixed multiplier bonus
 * @param {number} stepMult - Step multiplier bonus
 * @param {number} difficulty - Difficulty level
 * @returns {number} Estimated score
 */
function diceSimulationStrings(categories, numDice, numRolls, fixedMult, stepMult, difficulty) {
    // TEMPORARY: Basic estimation formula
    // This needs to be replaced with the full probability-based simulation
    // once we export the yacht_weights data

    if (numDice <= 0 || numRolls <= 0) {
        return 0;
    }

    // Sort categories by estimated mean score (simplified)
    categories.sort((a, b) => {
        const scoreA = estimateMeanScore(a.name, numDice, numRolls);
        const scoreB = estimateMeanScore(b.name, numDice, numRolls);
        return scoreA - scoreB;
    });

    // Calculate total score with multipliers
    let totalScore = 0;
    const diffDivide = [0, 9, 7, 3, 2][difficulty];

    for (let j = 0; j < categories.length; j++) {
        const category = categories[j];
        const baseScore = estimateMeanScore(category.name, numDice, numRolls);

        // Apply category quantity multiplier
        const catMult = Math.pow(2, category.quantity - 1);

        // Apply step multiplier based on position
        const maxTries = Math.floor(j / diffDivide);
        let bestMultiplier = 1;
        for (let ii = Math.max(0, j - maxTries); ii <= j; ii++) {
            const mult = (1 + fixedMult + stepMult * ii) * catMult;
            if (mult > bestMultiplier) {
                bestMultiplier = mult;
            }
        }

        totalScore += baseScore * bestMultiplier;
    }

    // Ensure minimum score of 5
    return Math.max(5, Math.floor(totalScore));
}

/**
 * Estimate mean score for a category (simplified version)
 * This is a rough approximation until we have the full yacht_weights data
 *
 * @param {string} categoryName - Name of the category
 * @param {number} numDice - Number of dice
 * @param {number} numRolls - Number of rolls
 * @returns {number} Estimated mean score
 */
function estimateMeanScore(categoryName, numDice, numRolls) {
    // Limit dice and rolls to maximum of 8
    numDice = Math.min(8, numDice);
    numRolls = Math.min(8, numRolls);

    // Very basic estimation based on category type and dice/rolls
    // This is TEMPORARY and should be replaced with yacht_weights lookup

    const baseFactor = Math.pow(numDice, 0.8) * Math.pow(numRolls, 0.5);

    // Different categories have different expected values
    if (categoryName.includes("Choice")) {
        return baseFactor * 8;
    } else if (categoryName.includes("Ones") || categoryName.includes("Twos")) {
        return baseFactor * 2;
    } else if (categoryName.includes("Threes") || categoryName.includes("Fours")) {
        return baseFactor * 3;
    } else if (categoryName.includes("Fives") || categoryName.includes("Sixes")) {
        return baseFactor * 4;
    } else if (categoryName.includes("Straight")) {
        return baseFactor * 5;
    } else if (categoryName.includes("Full House") || categoryName.includes("Yacht")) {
        return baseFactor * 6;
    } else if (categoryName.includes("Kind")) {
        return baseFactor * 4;
    } else {
        return baseFactor * 3;
    }
}

export default {
    dice_simulation_state_change
};
