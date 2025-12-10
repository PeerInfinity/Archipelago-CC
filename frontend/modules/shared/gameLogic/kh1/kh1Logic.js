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
     * @param {boolean} keyblades_unlock_chests - Whether keyblades are needed
     * @returns {boolean}
     */
    has_x_worlds(snapshot, staticData, num_of_worlds, keyblades_unlock_chests) {
        num_of_worlds = num_of_worlds || 0;
        keyblades_unlock_chests = keyblades_unlock_chests ?? false;

        // Get hundred_acre_wood setting from staticData if available
        const playerId = snapshot?.player?.id || snapshot?.player?.slot || snapshot?.player || staticData?.playerId || DEFAULT_PLAYER_ID;
        const settings = staticData?.settings?.[playerId] || {};
        const hundred_acre_wood = settings.hundred_acre_wood !== 0 && settings.hundred_acre_wood !== false;

        let worlds_acquired = 0.0;
        for (let i = 0; i < WORLDS.length; i++) {
            const worldName = WORLDS[i];
            const hasWorld = (snapshot?.inventory?.[worldName] || 0) > 0;
            const hasKeyblade = (snapshot?.inventory?.[KEYBLADES[i]] || 0) > 0;

            // Special handling for Traverse Town (always counts 0.5, don't need world item)
            if (worldName === "Traverse Town") {
                worlds_acquired += 0.5;
                if (!keyblades_unlock_chests || hasKeyblade) {
                    worlds_acquired += 0.5;
                }
            }
            // Special handling for 100 Acre Wood (only counts if setting enabled and has Fire)
            else if (worldName === "100 Acre Wood" && hundred_acre_wood) {
                const hasFire = (snapshot?.inventory?.["Progressive Fire"] || 0) > 0;
                if (hasFire) {
                    worlds_acquired += 0.5;
                    if (!keyblades_unlock_chests || hasKeyblade) {
                        worlds_acquired += 0.5;
                    }
                }
            }
            // Standard world handling
            else if (hasWorld) {
                worlds_acquired += 0.5;
                if (!keyblades_unlock_chests || hasKeyblade) {
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
     * @param {boolean} keyblades_unlock_chests - Whether keyblades are needed
     * @returns {boolean}
     */
    has_emblems(snapshot, staticData, keyblades_unlock_chests) {
        keyblades_unlock_chests = keyblades_unlock_chests ?? false;

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
        return this.has_x_worlds(snapshot, staticData, 6, keyblades_unlock_chests);
    },

    /**
     * Checks if the player has defensive tools
     * BLACKLISTED: Called without args but definition expects logic_difficulty param
     * @param {Object} snapshot - The current game state
     * @param {Object} staticData - Static game data
     * @returns {boolean}
     */
    has_defensive_tools(snapshot, staticData) {
        // Must have all of: Progressive Cure 2+, Leaf Bracer 1+, Dodge Roll 1+
        const hasCure2 = (snapshot?.inventory?.["Progressive Cure"] || 0) >= 2;
        const hasLeafBracer = (snapshot?.inventory?.["Leaf Bracer"] || 0) >= 1;
        const hasDodgeRoll = (snapshot?.inventory?.["Dodge Roll"] || 0) >= 1;

        // Must have at least one of: Second Chance 1+, MP Rage 1+, Progressive Aero 2+
        const hasSecondChance = (snapshot?.inventory?.["Second Chance"] || 0) >= 1;
        const hasMPRage = (snapshot?.inventory?.["MP Rage"] || 0) >= 1;
        const hasAero2 = (snapshot?.inventory?.["Progressive Aero"] || 0) >= 2;

        return hasCure2 && hasLeafBracer && hasDodgeRoll && (hasSecondChance || hasMPRage || hasAero2);
    }
};

export default kh1Logic;
