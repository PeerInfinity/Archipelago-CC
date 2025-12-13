/**
 * Mario & Luigi Superstar Saga Helper Functions
 *
 * These helpers correspond to the functions in worlds/mlss/StateLogic.py
 * All helpers follow the standard signature: (snapshot, staticData, ...args)
 */

/**
 * Check if player has a specific item with optional count
 * @param {Object} snapshot - Game state snapshot
 * @param {string} itemName - Item name to check
 * @param {number} count - Required count (default 1)
 * @returns {boolean} True if player has the item(s)
 */
function has(snapshot, itemName, count = 1) {
    const inventory = snapshot?.inventory || {};
    return (inventory[itemName] || 0) >= count;
}

/**
 * Check if player has Hammers
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Hammers
 */
export function hammers(snapshot, staticData) {
    return has(snapshot, "Hammers");
}

/**
 * Check if player has super hammer (2 Hammers)
 * Note: Named 'superHammer' to avoid conflict with JavaScript reserved word 'super'
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has 2+ Hammers
 */
export function superHammer(snapshot, staticData) {
    return has(snapshot, "Hammers", 2);
}

// Alias for 'super' helper - note JavaScript 'super' is reserved
export { superHammer as super_ };

/**
 * Check if player has ultra hammer (3 Hammers)
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has 3+ Hammers
 */
export function ultra(snapshot, staticData) {
    return has(snapshot, "Hammers", 3);
}

/**
 * Check if player can dig (Green Goblet + Hammers)
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can dig
 */
export function canDig(snapshot, staticData) {
    return has(snapshot, "Green Goblet") && has(snapshot, "Hammers");
}

/**
 * Check if player can mini (Red Goblet + Hammers)
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can mini
 */
export function canMini(snapshot, staticData) {
    return has(snapshot, "Red Goblet") && has(snapshot, "Hammers");
}

/**
 * Check if player can dash (Red Pearl Bean + Firebrand)
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can dash
 */
export function canDash(snapshot, staticData) {
    return has(snapshot, "Red Pearl Bean") && has(snapshot, "Firebrand");
}

/**
 * Check if player can crash (Green Pearl Bean + Thunderhand)
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can crash
 */
export function canCrash(snapshot, staticData) {
    return has(snapshot, "Green Pearl Bean") && has(snapshot, "Thunderhand");
}

/**
 * Check if player has all three Chuckola Fruits
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has all fruits
 */
export function fruits(snapshot, staticData) {
    return has(snapshot, "Red Chuckola Fruit") &&
           has(snapshot, "Purple Chuckola Fruit") &&
           has(snapshot, "White Chuckola Fruit");
}

/**
 * Check if player has all four Beanstar Pieces
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has all pieces
 */
export function pieces(snapshot, staticData) {
    return has(snapshot, "Beanstar Piece 1") &&
           has(snapshot, "Beanstar Piece 2") &&
           has(snapshot, "Beanstar Piece 3") &&
           has(snapshot, "Beanstar Piece 4");
}

/**
 * Check if player has all seven Neon Eggs
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has all neon eggs
 */
export function neon(snapshot, staticData) {
    return has(snapshot, "Blue Neon Egg") &&
           has(snapshot, "Red Neon Egg") &&
           has(snapshot, "Green Neon Egg") &&
           has(snapshot, "Yellow Neon Egg") &&
           has(snapshot, "Purple Neon Egg") &&
           has(snapshot, "Orange Neon Egg") &&
           has(snapshot, "Azure Neon Egg");
}

/**
 * Check if player has Spangle
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Spangle
 */
export function spangle(snapshot, staticData) {
    return has(snapshot, "Spangle");
}

/**
 * Check if player has Peasley's Rose
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Peasley's Rose
 */
export function rose(snapshot, staticData) {
    return has(snapshot, "Peasley's Rose");
}

/**
 * Check if player has Beanbean Brooch
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Beanbean Brooch
 */
export function brooch(snapshot, staticData) {
    return has(snapshot, "Beanbean Brooch");
}

/**
 * Check if player has Thunderhand
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Thunderhand
 */
export function thunder(snapshot, staticData) {
    return has(snapshot, "Thunderhand");
}

/**
 * Check if player has Firebrand
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Firebrand
 */
export function fire(snapshot, staticData) {
    return has(snapshot, "Firebrand");
}

/**
 * Check if player has Peach's Extra Dress and Fake Beanstar
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has both items
 */
export function dressBeanstar(snapshot, staticData) {
    return has(snapshot, "Peach's Extra Dress") && has(snapshot, "Fake Beanstar");
}

/**
 * Check if player has Membership Card
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Membership Card
 */
export function membership(snapshot, staticData) {
    return has(snapshot, "Membership Card");
}

/**
 * Check if player has Winkle Card
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has Winkle Card
 */
export function winkle(snapshot, staticData) {
    return has(snapshot, "Winkle Card");
}

/**
 * Check if player has all seven Bean Fruits
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player has all bean fruits
 */
export function beanFruit(snapshot, staticData) {
    return has(snapshot, "Bean Fruit 1") &&
           has(snapshot, "Bean Fruit 2") &&
           has(snapshot, "Bean Fruit 3") &&
           has(snapshot, "Bean Fruit 4") &&
           has(snapshot, "Bean Fruit 5") &&
           has(snapshot, "Bean Fruit 6") &&
           has(snapshot, "Bean Fruit 7");
}

/**
 * Check if player can surf (complex logic)
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can surf
 */
export function surfable(snapshot, staticData) {
    return ultra(snapshot, staticData) && (
        (canDig(snapshot, staticData) && canMini(snapshot, staticData)) ||
        (membership(snapshot, staticData) && fire(snapshot, staticData))
    );
}

/**
 * Check if player meets post-jokes requirements
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {number|string} goal - Goal setting value (0 = vanilla, others = beanstar emblems)
 * @returns {boolean} True if requirements are met
 */
export function postJokes(snapshot, staticData, goal) {
    // Goal 0 is vanilla (without beanstar emblems)
    if (goal === 0 || goal === 'vanilla') {
        return surfable(snapshot, staticData) &&
               canDig(snapshot, staticData) &&
               dressBeanstar(snapshot, staticData) &&
               pieces(snapshot, staticData) &&
               fruits(snapshot, staticData) &&
               brooch(snapshot, staticData) &&
               rose(snapshot, staticData) &&
               canDash(snapshot, staticData);
    } else {
        // With beanstar emblems
        return surfable(snapshot, staticData) &&
               canDig(snapshot, staticData) &&
               canDash(snapshot, staticData);
    }
}

/**
 * Check if player can access Teehee Valley
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can access Teehee Valley
 */
export function teehee(snapshot, staticData) {
    return superHammer(snapshot, staticData) || canDash(snapshot, staticData);
}

/**
 * Check if player can access Castle Town
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can access Castle Town
 */
export function castleTown(snapshot, staticData) {
    return fruits(snapshot, staticData) && brooch(snapshot, staticData);
}

/**
 * Check if player can access Fungitown
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if player can access Fungitown
 */
export function fungitown(snapshot, staticData) {
    return castleTown(snapshot, staticData) &&
           thunder(snapshot, staticData) &&
           rose(snapshot, staticData) &&
           (superHammer(snapshot, staticData) || canDash(snapshot, staticData));
}

/**
 * Check if player can reach a region
 * @param {Object} snapshot - Game state snapshot
 * @param {string} regionName - Region to check
 * @returns {boolean} True if region is reachable
 */
function canReachRegion(snapshot, regionName) {
    const reachable = snapshot?.reachable_regions || snapshot?.reachableRegions || [];
    return reachable.includes(regionName);
}

/**
 * Check if Mom Piranha shop is accessible
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if shop is accessible
 */
export function piranha_shop(snapshot, staticData) {
    return canReachRegion(snapshot, "Shop Mom Piranha Flag");
}

/**
 * Check if Fungitown shop is accessible
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if shop is accessible
 */
export function fungitown_shop(snapshot, staticData) {
    return canReachRegion(snapshot, "Shop Enter Fungitown Flag");
}

/**
 * Check if Beanstar Complete shop is accessible
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if shop is accessible
 */
export function star_shop(snapshot, staticData) {
    return canReachRegion(snapshot, "Shop Beanstar Complete Flag");
}

/**
 * Check if Birdo shop is accessible
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if shop is accessible
 */
export function birdo_shop(snapshot, staticData) {
    return canReachRegion(snapshot, "Shop Birdo Flag");
}

/**
 * Check if Fungitown Birdo shop is accessible
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if shop is accessible
 */
export function fungitown_birdo_shop(snapshot, staticData) {
    return canReachRegion(snapshot, "Fungitown Shop Birdo Flag");
}

/**
 * Check if player has all requirements for soul
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @returns {boolean} True if all requirements are met
 */
export function soul(snapshot, staticData) {
    return ultra(snapshot, staticData) &&
           canMini(snapshot, staticData) &&
           canDig(snapshot, staticData) &&
           canDash(snapshot, staticData) &&
           canCrash(snapshot, staticData);
}
