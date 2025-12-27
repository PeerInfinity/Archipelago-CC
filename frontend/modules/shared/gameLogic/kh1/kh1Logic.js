/**
 * Kingdom Hearts 1 game-specific logic
 *
 * Only includes blacklisted helpers that have loops or complex logic
 * that cannot be exported as definitions.
 */

import { DEFAULT_PLAYER_ID } from '../../playerIdUtils.js';

// Must match Python WORLDS and KEYBLADES arrays from worlds/kh1/Rules.py
const WORLDS = ["Destiny Islands", "Traverse Town", "Wonderland", "Olympus Coliseum", "Deep Jungle", "Agrabah", "Monstro", "Atlantica", "Halloween Town", "Neverland", "Hollow Bastion", "End of the World", "100 Acre Wood"];
const KEYBLADES = ["Oathkeeper", "Lionheart", "Lady Luck", "Olympia", "Jungle King", "Three Wishes", "Wishing Star", "Crabclaw", "Pumpkinhead", "Fairy Harp", "Divine Rose", "Oblivion", "Spellbinder"];

/**
 * Blacklisted helper functions for KH1
 * These have loops or complex logic that cannot be exported as definitions
 */
export const kh1Logic = {
    /**
     * Checks if the player has access to a certain number of worlds
     * Matches Python logic from worlds/kh1/Rules.py has_x_worlds function
     * BLACKLISTED: Has for loop over WORLDS array
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @param {number} num_of_worlds - Required number of worlds
     * @param {boolean|number} keyblades_unlock_chests - Whether keyblades are needed
     * @param {number} logic_difficulty - Logic difficulty setting (LOGIC_MINIMAL=15 means always return true)
     * @param {boolean|number} hundred_acre_wood - Whether 100 Acre Wood is enabled
     * @returns {boolean}
     */
    has_x_worlds(snapshot, staticData, num_of_worlds, keyblades_unlock_chests, logic_difficulty, hundred_acre_wood) {
        // LOGIC_MINIMAL = 15 in Python - if difficulty >= LOGIC_MINIMAL, always return true
        const LOGIC_MINIMAL = 15;

        num_of_worlds = num_of_worlds || 0;
        const hasKeybladesUnlockChests = keyblades_unlock_chests && keyblades_unlock_chests !== 0;
        const hasHundredAcreWood = hundred_acre_wood && hundred_acre_wood !== 0;
        logic_difficulty = logic_difficulty ?? 5;

        // If logic difficulty is LOGIC_MINIMAL or higher, always return true
        if (logic_difficulty >= LOGIC_MINIMAL) {
            return true;
        }

        let worlds_acquired = 0.0;
        for (let i = 0; i < WORLDS.length; i++) {
            const worldName = WORLDS[i];
            const hasWorld = (snapshot?.inventory?.[worldName] || 0) > 0;
            const hasKeyblade = (snapshot?.inventory?.[KEYBLADES[i]] || 0) > 0;

            // Special handling for Traverse Town (always counts 0.5, don't need world item)
            if (worldName === "Traverse Town") {
                worlds_acquired += 0.5;
                if (!hasKeybladesUnlockChests || hasKeyblade) {
                    worlds_acquired += 0.5;
                }
            }
            // Special handling for 100 Acre Wood (only counts if setting enabled and has Fire)
            else if (worldName === "100 Acre Wood" && hasHundredAcreWood) {
                const hasFire = (snapshot?.inventory?.["Progressive Fire"] || 0) > 0;
                if (hasFire) {
                    worlds_acquired += 0.5;
                    if (!hasKeybladesUnlockChests || hasKeyblade) {
                        worlds_acquired += 0.5;
                    }
                }
            }
            // Standard world handling
            else if (hasWorld) {
                worlds_acquired += 0.5;
                if (!hasKeybladesUnlockChests || hasKeyblade) {
                    worlds_acquired += 0.5;
                }
            }
        }
        return worlds_acquired >= num_of_worlds;
    },

    /**
     * Checks if the player has all emblem pieces
     * BLACKLISTED: Calls has_x_worlds which has loops
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @param {boolean|number} keyblades_unlock_chests - Whether keyblades are needed
     * @param {number} logic_difficulty - Logic difficulty setting
     * @param {boolean|number} hundred_acre_wood - Whether 100 Acre Wood is enabled
     * @returns {boolean}
     */
    has_emblems(snapshot, staticData, keyblades_unlock_chests, logic_difficulty, hundred_acre_wood) {
        const emblem_pieces = [
            "Emblem Piece (Flame)",
            "Emblem Piece (Chest)",
            "Emblem Piece (Statue)",
            "Emblem Piece (Fountain)",
            "Hollow Bastion"
        ];

        // Check if we have all emblem pieces
        for (const piece of emblem_pieces) {
            const hasPiece = snapshot?.inventory?.[piece] > 0;
            if (!hasPiece) {
                return false;
            }
        }

        // Also need 6 worlds (matching Python's has_emblems function)
        return this.has_x_worlds(snapshot, staticData, 6, keyblades_unlock_chests, logic_difficulty, hundred_acre_wood);
    },

    /**
     * Checks if the player has defensive tools
     * BLACKLISTED: Called without args but definition expects logic_difficulty param
     * Matches Python logic from worlds/kh1/Rules.py has_defensive_tools function
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @param {number} logic_difficulty - Logic difficulty setting
     * @returns {boolean}
     */
    has_defensive_tools(snapshot, staticData, logic_difficulty) {
        // LOGIC_MINIMAL = 15 in Python
        const LOGIC_MINIMAL = 15;
        logic_difficulty = logic_difficulty ?? 5;

        // If logic difficulty is LOGIC_MINIMAL or higher, always return true
        if (logic_difficulty >= LOGIC_MINIMAL) {
            return true;
        }

        // Must have all of: Progressive Cure 2+, Leaf Bracer 1+, Dodge Roll 1+
        const hasCure2 = (snapshot?.inventory?.["Progressive Cure"] || 0) >= 2;
        const hasLeafBracer = (snapshot?.inventory?.["Leaf Bracer"] || 0) >= 1;
        const hasDodgeRoll = (snapshot?.inventory?.["Dodge Roll"] || 0) >= 1;

        // Must have at least one of: Second Chance 1+, MP Rage 1+, Progressive Aero 2+
        const hasSecondChance = (snapshot?.inventory?.["Second Chance"] || 0) >= 1;
        const hasMPRage = (snapshot?.inventory?.["MP Rage"] || 0) >= 1;
        const hasAero2 = (snapshot?.inventory?.["Progressive Aero"] || 0) >= 2;

        return hasCure2 && hasLeafBracer && hasDodgeRoll && (hasSecondChance || hasMPRage || hasAero2);
    },

    /**
     * Checks if the player can open the final rest door
     * BLACKLISTED: Complex with multiple branches
     * Matches Python logic from worlds/kh1/Rules.py has_final_rest_door function
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @param {string} final_rest_door_requirement - Type of requirement ("lucky_emblems" or other)
     * @param {number} final_rest_door_required_lucky_emblems - Number of lucky emblems required
     * @returns {boolean}
     */
    has_final_rest_door(snapshot, staticData, final_rest_door_requirement, final_rest_door_required_lucky_emblems) {
        if (final_rest_door_requirement === "lucky_emblems") {
            const emblemCount = snapshot?.inventory?.["Lucky Emblem"] || 0;
            return emblemCount >= final_rest_door_required_lucky_emblems;
        } else {
            return (snapshot?.inventory?.["Final Door Key"] || 0) > 0;
        }
    },

    /**
     * Checks if the player can defeat Parasite Cage II in Monstro
     * BLACKLISTED: Complex with nested calls
     * Matches Python logic from worlds/kh1/Rules.py has_parasite_cage function
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @param {number} logic_difficulty - Current logic difficulty setting (LOGIC_BEGINNER=0)
     * @param {boolean} worlds - Result of has_x_worlds check (whether player has enough worlds)
     * @returns {boolean}
     */
    has_parasite_cage(snapshot, staticData, logic_difficulty, worlds) {
        // LOGIC_BEGINNER = 0 in Python
        const LOGIC_BEGINNER = 0;

        // Check if has Monstro
        const hasMonstro = (snapshot?.inventory?.["Monstro"] || 0) > 0;

        // Check if has High Jump or (difficulty > LOGIC_BEGINNER and has Progressive Glide)
        const hasHighJump = (snapshot?.inventory?.["High Jump"] || 0) > 0;
        const hasProgressiveGlide = (snapshot?.inventory?.["Progressive Glide"] || 0) > 0;
        const canMove = hasHighJump || (logic_difficulty > LOGIC_BEGINNER && hasProgressiveGlide);

        return hasMonstro && canMove && worlds;
    },

    /**
     * Checks if the player has enough puppies
     * BLACKLISTED: Has loops over puppy items
     * Matches Python logic from worlds/kh1/Rules.py has_puppies function
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @param {number} puppies_required - Number of puppies required
     * @param {number} puppy_value - Value of each puppy item
     * @returns {boolean}
     */
    has_puppies(snapshot, staticData, puppies_required, puppy_value) {
        // count("Puppy") * puppy_value >= puppies_required
        const puppyCount = snapshot?.inventory?.["Puppy"] || 0;
        return (puppyCount * puppy_value) >= puppies_required;
    },

    /**
     * Checks if the player has enough lucky emblems
     * BLACKLISTED: Simple but rarely used
     * Matches Python logic from worlds/kh1/Rules.py has_lucky_emblems function
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @param {number} required_amt - Number of lucky emblems required
     * @returns {boolean}
     */
    has_lucky_emblems(snapshot, staticData, required_amt) {
        const emblemCount = snapshot?.inventory?.["Lucky Emblem"] || 0;
        return emblemCount >= required_amt;
    },

    /**
     * Checks if the player has a specific key item
     * BLACKLISTED: Complex with multiple parameters
     * Matches Python logic from worlds/kh1/Rules.py has_key_item function
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @param {string} key_item - Name of the key item to check
     * @param {boolean|number} stacking_world_items - Whether stacking world items is enabled
     * @param {boolean|number} halloween_town_key_item_bundle - Whether Halloween Town key item bundle is enabled
     * @param {number} difficulty - Logic difficulty setting
     * @param {boolean|number} keyblades_unlock_chests - Whether keyblades unlock chests
     * @returns {boolean}
     */
    has_key_item(snapshot, staticData, key_item, stacking_world_items, halloween_town_key_item_bundle, difficulty, keyblades_unlock_chests) {
        // LOGIC_BEGINNER = 0 in Python
        const LOGIC_BEGINNER = 0;

        // Mapping from key items to world names (from worlds/kh1/Data.py WORLD_KEY_ITEMS)
        const WORLD_KEY_ITEMS = {
            "Footprints": "Wonderland",
            "Entry Pass": "Olympus Coliseum",
            "Slides": "Deep Jungle",
            "Crystal Trident": "Atlantica",
            "Forget-Me-Not": "Halloween Town",
            "Jack-In-The-Box": "Halloween Town",
            "Theon Vol. 6": "Hollow Bastion"
        };

        // Convert numeric flags to booleans
        const hasStackingWorldItems = stacking_world_items && stacking_world_items !== 0;
        const hasHalloweenBundle = halloween_town_key_item_bundle && halloween_town_key_item_bundle !== 0;
        const hasKeybladesUnlockChests = keyblades_unlock_chests && keyblades_unlock_chests !== 0;

        // Check if player has the key item directly
        const hasKeyItemDirectly = (snapshot?.inventory?.[key_item] || 0) > 0;

        // Check if player has the world item 2+ times (stacking world items option)
        const worldItem = WORLD_KEY_ITEMS[key_item];
        const hasWorldItem2 = worldItem && hasStackingWorldItems && (snapshot?.inventory?.[worldItem] || 0) >= 2;

        // Special case for Jack-In-The-Box with Halloween Town bundle
        const hasJackInTheBoxAlt = key_item === "Jack-In-The-Box" &&
            (snapshot?.inventory?.["Forget-Me-Not"] || 0) > 0 &&
            hasHalloweenBundle;

        // First part: has the key item in some way
        const hasItem = hasKeyItemDirectly || hasWorldItem2 || hasJackInTheBoxAlt;

        // Second part: Crystal Trident special case for keyblade locking
        const crystalTridentCheck = key_item !== "Crystal Trident" ||
            difficulty > LOGIC_BEGINNER ||
            !hasKeybladesUnlockChests ||
            (snapshot?.inventory?.["Crabclaw"] || 0) > 0;

        return hasItem && crystalTridentCheck;
    }
};

export default kh1Logic;
