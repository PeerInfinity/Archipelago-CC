/**
 * Kirby's Dream Land 3 Helper Functions
 *
 * These helpers handle complex runtime logic that cannot be easily
 * expressed in rules.json. They use copy_abilities mapping to determine
 * what abilities are available from various enemies.
 */

/**
 * Check if player has a specific item
 * @param {Object} snapshot - Game state snapshot
 * @param {string} itemName - Item name to check
 * @returns {boolean} True if player has the item
 */
function has(snapshot, itemName) {
    const inventory = snapshot?.inventory || {};
    return (inventory[itemName] || 0) > 0;
}

/**
 * Check if player can reach Coo (owl animal friend)
 * Requires both Coo item and Coo Spawn
 */
function canReachCoo(snapshot) {
    return has(snapshot, 'Coo') && has(snapshot, 'Coo Spawn');
}

/**
 * Check if player can reach Kine (fish animal friend)
 * Requires both Kine item and Kine Spawn
 */
function canReachKine(snapshot) {
    return has(snapshot, 'Kine') && has(snapshot, 'Kine Spawn');
}

/**
 * Check if player can reach a specific copy ability
 * @param {Object} snapshot - Game state snapshot
 * @param {string} abilityName - Name like "Burning Ability", "Stone Ability", etc.
 * @returns {boolean} True if player has the ability
 */
function canReachAbility(snapshot, abilityName) {
    // Map ability names to their item names
    const abilityToItem = {
        'Burning Ability': 'Burning',
        'Stone Ability': 'Stone',
        'Ice Ability': 'Ice',
        'Needle Ability': 'Needle',
        'Clean Ability': 'Clean',
        'Parasol Ability': 'Parasol',
        'Spark Ability': 'Spark',
        'Cutter Ability': 'Cutter',
        'No Ability': null
    };

    const itemName = abilityToItem[abilityName];
    if (itemName === null) {
        // "No Ability" - always accessible
        return true;
    }
    if (!itemName) {
        // Unknown ability - conservatively return false
        return false;
    }
    return has(snapshot, itemName);
}

/**
 * The restrictive ability pairs for R.O.B. assembly
 * Each pair is: [list of acceptable abilities, list of bukiset enemies]
 */
const ENEMY_RESTRICTIVE = [
    [['Parasol Ability', 'Cutter Ability'], ['Bukiset (Parasol)', 'Bukiset (Cutter)']],
    [['Spark Ability', 'Clean Ability'], ['Bukiset (Spark)', 'Bukiset (Clean)']],
    [['Ice Ability', 'Needle Ability'], ['Bukiset (Ice)', 'Bukiset (Needle)']],
    [['Stone Ability', 'Burning Ability'], ['Bukiset (Stone)', 'Bukiset (Burning)']]
];

/**
 * Check if player can assemble R.O.B.
 *
 * Requirements:
 * 1. Can reach Coo AND Kine (animal friends)
 * 2. For each of 4 Bukiset ability pairs, at least one Bukiset must have
 *    an ability the player can access
 * 3. Can reach Parasol AND Stone abilities
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {Object} copyAbilities - Mapping of enemy names to their copy abilities
 * @returns {boolean} True if player can assemble R.O.B.
 */
export function can_assemble_rob(snapshot, staticData, copyAbilities) {
    // Check animal requirements
    if (!canReachCoo(snapshot) || !canReachKine(snapshot)) {
        return false;
    }

    // Check each ability pair
    for (const [abilities, bukisets] of ENEMY_RESTRICTIVE) {
        // Find bukisets that have abilities in the acceptable list
        const matchingBukisets = bukisets.filter(enemy => {
            const enemyAbility = copyAbilities?.[enemy];
            return abilities.includes(enemyAbility);
        });

        // Check if we can reach at least one of the matching abilities
        let canReach = false;
        for (const enemy of matchingBukisets) {
            const ability = copyAbilities?.[enemy];
            if (ability && canReachAbility(snapshot, ability)) {
                canReach = true;
                break;
            }
        }

        if (!canReach) {
            return false;
        }
    }

    // Final requirements: Parasol and Stone abilities
    return canReachAbility(snapshot, 'Parasol Ability') &&
           canReachAbility(snapshot, 'Stone Ability');
}

/**
 * Enemies required for fixing angel wings
 */
const ANGEL_WING_ENEMIES = [
    'Sparky', 'Blocky', 'Jumper Shoot', 'Yuki',
    'Sir Kibble', 'Haboki', 'Boboo', 'Captain Stitch'
];

/**
 * Check if player can fix angel wings.
 *
 * Requires the player to have ALL abilities from the 8 specified enemies.
 *
 * @param {Object} snapshot - Game state snapshot
 * @param {Object} staticData - Static game data
 * @param {Object} copyAbilities - Mapping of enemy names to their copy abilities
 * @returns {boolean} True if player can fix angel wings
 */
export function can_fix_angel_wings(snapshot, staticData, copyAbilities) {
    for (const enemy of ANGEL_WING_ENEMIES) {
        const ability = copyAbilities?.[enemy];
        if (!ability) {
            // Unknown enemy - conservatively return false
            return false;
        }
        if (!canReachAbility(snapshot, ability)) {
            return false;
        }
    }
    return true;
}
