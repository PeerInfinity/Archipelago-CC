/**
 * Mario & Luigi Superstar Saga Game Logic Module
 *
 * Provides game-specific logic for Mario & Luigi Superstar Saga.
 * Implements helpers from worlds/mlss/StateLogic.py
 */

import {
    hammers,
    superHammer,
    super_ as superHelper,
    ultra,
    canDig,
    canMini,
    canDash,
    canCrash,
    fruits,
    pieces,
    neon,
    spangle,
    rose,
    brooch,
    thunder,
    fire,
    dressBeanstar,
    membership,
    winkle,
    beanFruit,
    surfable,
    postJokes,
    teehee,
    castleTown,
    fungitown,
    piranha_shop,
    fungitown_shop,
    star_shop,
    birdo_shop,
    fungitown_birdo_shop,
    soul
} from './helpers.js';

/**
 * Mario & Luigi Superstar Saga Helper Functions
 */
export const helperFunctions = {
    hammers,
    // 'super' is a reserved word in JavaScript, so we provide it under the alias 'super'
    // The rule engine will call helperFunctions['super'] which will work
    'super': superHelper,
    ultra,
    canDig,
    canMini,
    canDash,
    canCrash,
    fruits,
    pieces,
    neon,
    spangle,
    rose,
    brooch,
    thunder,
    fire,
    dressBeanstar,
    membership,
    winkle,
    beanFruit,
    surfable,
    postJokes,
    teehee,
    castleTown,
    fungitown,
    piranha_shop,
    fungitown_shop,
    star_shop,
    birdo_shop,
    fungitown_birdo_shop,
    soul
};

/**
 * State methods for Mario & Luigi Superstar Saga.
 * These handle special state checks.
 */
export const stateMethods = {};

/**
 * Initialize Mario & Luigi Superstar Saga game logic.
 *
 * @param {Object} context - The game logic context
 * @returns {Object} MLSS-specific logic handlers
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
