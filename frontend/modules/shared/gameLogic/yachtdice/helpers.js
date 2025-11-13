/**
 * Yacht Dice game-specific helper functions
 *
 * This implements the scoring simulation logic for Yacht Dice to determine
 * if a player can reach a specific score based on their collected items.
 */

// Import yacht_weights data synchronously
import { yachtWeightsData } from './yacht_weights.js';

// Parse yacht_weights data into a usable format (loaded synchronously at module initialization)
let yachtWeights = {};
let yachtWeightsLoaded = false;

// Initialize yacht_weights synchronously
function initializeYachtWeights() {
    if (yachtWeightsLoaded) {
        return;
    }

    try {
        // Parse yacht_weights data into a usable format
        // Keys are "CategoryName,numDice,numRolls", values are score distributions
        for (const [key, distribution] of Object.entries(yachtWeightsData)) {
            const [categoryName, numDiceStr, numRollsStr] = key.split(',');
            const numDice = parseInt(numDiceStr);
            const numRolls = parseInt(numRollsStr);

            // Create nested structure for easy lookup
            if (!yachtWeights[categoryName]) {
                yachtWeights[categoryName] = {};
            }
            if (!yachtWeights[categoryName][numDice]) {
                yachtWeights[categoryName][numDice] = {};
            }

            // Convert string keys back to integers
            const parsedDistribution = {};
            for (const [score, probability] of Object.entries(distribution)) {
                parsedDistribution[parseInt(score)] = parseInt(probability);
            }

            yachtWeights[categoryName][numDice][numRolls] = parsedDistribution;
        }

        yachtWeightsLoaded = true;
        console.log('[YachtDice] yacht_weights data loaded successfully');
    } catch (error) {
        console.error('[YachtDice] Failed to initialize yacht_weights:', error);
        throw error;
    }
}

// Initialize immediately (synchronous)
initializeYachtWeights();

// Log that the module is loaded
console.log('[YachtDice] helpers.js module loaded and initialized');

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
    // ALWAYS log when called for debugging
    console.log('[YachtDice] dice_simulation_state_change CALLED with args:', {
        fragsPerDice,
        fragsPerRoll,
        difficulty,
        allowedCategoriesCount: allowedCategories?.length,
        snapshotKeys: Object.keys(snapshot || {}).slice(0, 10)
    });

    // Create a cache key based on the current inventory state
    // Don't cache across different states!
    const inventoryKey = JSON.stringify(snapshot?.items || {});
    const cacheKey = `${inventoryKey}_${fragsPerDice}_${fragsPerRoll}_${difficulty}`;

    // Check cache (but create it if doesn't exist)
    if (!snapshot.__yachtDiceScoreCache) {
        snapshot.__yachtDiceScoreCache = {};
    }

    if (snapshot.__yachtDiceScoreCache[cacheKey] !== undefined) {
        console.log('[YachtDice] Returning cached result:', snapshot.__yachtDiceScoreCache[cacheKey]);
        return snapshot.__yachtDiceScoreCache[cacheKey];
    }

    // Extract progression from current state
    const progression = extractProgression(snapshot, fragsPerDice, fragsPerRoll, allowedCategories);
    const {categories, numDice, numRolls, fixedMult, stepMult, extraPoints} = progression;

    console.log('[YachtDice] Extracted progression:', {
        numDice,
        numRolls,
        categoriesCount: categories.length,
        categories: categories.map(c => c.name),
        extraPoints
    });

    // Calculate the simulated score
    const simulatedScore = diceSimulationStrings(
        categories, numDice, numRolls, fixedMult, stepMult, difficulty
    );

    const maxScore = simulatedScore + extraPoints;

    // Cache the result with proper key
    snapshot.__yachtDiceScoreCache[cacheKey] = maxScore;

    console.log('[YachtDice] Final result: simulatedScore=' + simulatedScore + ', maxScore=' + maxScore);

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
    // Try multiple possible locations for items in the snapshot
    // Different games structure their snapshots differently
    const items = snapshot?.items || snapshot?.inventory || snapshot || {};

    // Debug: Log snapshot structure once
    if (typeof console !== 'undefined' && console.log && !items.__debugLogged) {
        console.log('[YachtDice] Snapshot keys:', Object.keys(snapshot || {}).slice(0, 20));
        console.log('[YachtDice] Items structure:', JSON.stringify(items).substring(0, 200));
        items.__debugLogged = true;
    }

    // Count dice and rolls (including fragments)
    const diceFrags = (items["Dice Fragment"] || 0);
    const rollFrags = (items["Roll Fragment"] || 0);
    const numDice = (items["Dice"] || 0) + Math.floor(diceFrags / fragsPerDice);
    const numRolls = (items["Roll"] || 0) + Math.floor(rollFrags / fragsPerRoll);

    // ALWAYS log the dice/roll counts for debugging
    console.log('[YachtDice] Item counts: Dice=' + items["Dice"] + ', DiceFrags=' + diceFrags + ', Roll=' + items["Roll"] + ', RollFrags=' + rollFrags + ', numDice=' + numDice + ', numRolls=' + numRolls);

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

    // Get percentile return values based on difficulty
    // perc_return determines what percentiles to average
    const percReturn = [[0], [0.1, 0.5], [0.3, 0.7], [0.55, 0.85], [0.85, 0.95]][difficulty];
    const diffDivide = [0, 9, 7, 3, 2][difficulty];

    // Sort categories by mean score (using actual probability data or fallback)
    categories.sort((a, b) => {
        const distA = getScoreDistribution(a.name, numDice, numRolls);
        const distB = getScoreDistribution(b.name, numDice, numRolls);

        const scoreA = distA ? getMeanFromDistribution(distA) : fallbackEstimateMeanScore(a.name, numDice, numRolls);
        const scoreB = distB ? getMeanFromDistribution(distB) : fallbackEstimateMeanScore(b.name, numDice, numRolls);

        return scoreA - scoreB;
    });

    // Calculate total score using percentiles
    let totalScore = 0;

    for (let j = 0; j < categories.length; j++) {
        const category = categories[j];

        // Get the distribution for this category
        const dist = getScoreDistribution(category.name, numDice, numRolls);

        // Use fallback if distribution not available
        if (!dist) {
            const fallbackScore = fallbackEstimateMeanScore(category.name, numDice, numRolls);
            totalScore += fallbackScore;
            continue;
        }

        // Calculate category multiplier for multiple copies
        const catMult = Math.pow(2, category.quantity - 1);

        // For higher difficulties, simulation gets multiple tries
        const maxTries = Math.floor(j / diffDivide);

        // Calculate the best possible score with multipliers
        let bestScore = 0;
        for (const percentile of percReturn) {
            const baseScore = percentileDistribution(dist, percentile);

            // Try different multiplier combinations
            for (let ii = Math.max(0, j - maxTries); ii <= j; ii++) {
                const mult = (1 + fixedMult + stepMult * ii) * catMult;
                const score = baseScore * mult;
                if (score > bestScore) {
                    bestScore = score;
                }
            }
        }

        // Average the percentiles
        totalScore += bestScore / percReturn.length;

    }

    // Ensure minimum score of 5
    return Math.max(5, Math.floor(totalScore));
}

/**
 * Calculate mean from a probability distribution
 */
function getMeanFromDistribution(distribution) {
    let mean = 0;
    for (const [score, probability] of Object.entries(distribution)) {
        mean += parseInt(score) * (probability / 100000);
    }
    return mean;
}

/**
 * Get score distribution for a category using actual probability data
 *
 * @param {string} categoryName - Name of the category
 * @param {number} numDice - Number of dice
 * @param {number} numRolls - Number of rolls
 * @returns {Object} Score distribution {score: probability}
 */
function getScoreDistribution(categoryName, numDice, numRolls) {
    // Limit dice and rolls to maximum of 8 (data availability)
    numDice = Math.min(8, Math.max(0, numDice));
    numRolls = Math.min(8, Math.max(0, numRolls));

    if (numDice <= 0 || numRolls <= 0) {
        return {0: 100000};
    }

    // If data not loaded yet, return empty distribution
    if (!yachtWeightsLoaded) {
        return null;
    }

    // Look up the probability distribution
    const distribution = yachtWeights[categoryName]?.[numDice]?.[numRolls];

    if (!distribution) {
        return null;
    }

    return distribution;
}

/**
 * Calculate percentile value from a probability distribution
 *
 * @param {Object} distribution - Score distribution {score: probability}
 * @param {number} percentile - Percentile to calculate (0.0 to 1.0)
 * @returns {number} Score at the given percentile
 */
function percentileDistribution(distribution, percentile) {
    const sortedScores = Object.keys(distribution).map(Number).sort((a, b) => a - b);
    let cumulativeProb = 0;

    for (const score of sortedScores) {
        cumulativeProb += distribution[score] / 100000;
        if (cumulativeProb >= percentile) {
            return score;
        }
    }

    // Return the last value if percentile is higher than all probabilities
    return sortedScores[sortedScores.length - 1] || 0;
}

/**
 * Fallback estimation when yacht_weights data is not available
 */
function fallbackEstimateMeanScore(categoryName, numDice, numRolls) {
    const baseFactor = Math.pow(numDice, 0.6) * Math.pow(numRolls, 0.3);

    if (categoryName.includes("Choice") || categoryName.includes("Inverse")) {
        return baseFactor * 2.0;
    } else if (categoryName.includes("Ones") || categoryName.includes("Twos")) {
        return baseFactor * 0.6;
    } else if (categoryName.includes("Threes") || categoryName.includes("Fours")) {
        return baseFactor * 0.8;
    } else if (categoryName.includes("Fives") || categoryName.includes("Sixes")) {
        return baseFactor * 1.0;
    } else if (categoryName.includes("Straight")) {
        return baseFactor * 1.2;
    } else if (categoryName.includes("Full House") || categoryName.includes("Yacht")) {
        return baseFactor * 1.5;
    } else if (categoryName.includes("Kind")) {
        return baseFactor * 1.0;
    } else {
        return baseFactor * 0.8;
    }
}

export default {
    dice_simulation_state_change
};
