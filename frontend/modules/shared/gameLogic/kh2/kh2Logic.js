/**
 * Kingdom Hearts 2 helper functions for game-specific logic.
 */

// Auto form mappings
const AUTO_FORM_MAP = {
  'Final Form': 'Auto Final',
  'Master Form': 'Auto Master',
  'Limit Form': 'Auto Limit',
  'Wisdom Form': 'Auto Wisdom',
  'Valor Form': 'Auto Valor'
};

// List of all drive forms
const DRIVE_FORMS = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];

// List of visit locking items (2VisitLocking from worlds/kh2/Items.py:569-584)
const VISIT_LOCKING_ITEMS = [
  'Disney Castle Key',
  'Battlefields of War',
  'Sword of the Ancestor',
  "Beast's Claw",
  'Bone Fist',
  'Proud Fang',
  'Skill and Crossbones',
  'Scimitar',
  'Membership Card',
  'Ice Cream',
  'Way to the Dawn',
  'Identity Disk',
  "Namine Sketches"
];

export const helperFunctions = {
  /**
   * Check if player has unlocked a specific form level.
   * This is the main entry point for form level checks.
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {string} formName - Name of the form (e.g., "Master Form")
   * @param {number} levelRequired - Level requirement (0-based)
   * @param {boolean} fightLogic - Whether this is for fight logic (default: false)
   * @returns {boolean} True if player can access this form level
   */
  form_list_unlock(snapshot, staticData, formName, levelRequired = 0, fightLogic = false) {
    // Check if player has the form itself (or auto variant if AutoFormLogic is enabled)
    const hasForm = helperFunctions.has_form_access(snapshot, staticData, formName, fightLogic);

    if (!hasForm) {
      return false;
    }

    // Check if player has enough total forms for the level requirement
    return helperFunctions.get_form_level_requirement(snapshot, staticData, levelRequired);
  },

  /**
   * Check if player has access to a specific form (including auto form variants).
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {string} formName - Name of the form
   * @param {boolean} fightLogic - Whether this is for fight logic
   * @returns {boolean} True if player has access to the form
   */
  has_form_access(snapshot, staticData, formName, fightLogic = false) {
    // Player needs the form itself
    if (!snapshot?.inventory?.[formName]) {
      return false;
    }

    // If AutoFormLogic is disabled or this is for fight logic, just check the form itself
    const settings = staticData?.settings || {};
    const autoFormLogic = settings.AutoFormLogic ?? false;

    if (!autoFormLogic || fightLogic) {
      return true;
    }

    // AutoFormLogic is enabled - check for auto form variants
    // Special case: Master Form also requires Drive Converter
    if (formName === 'Master Form') {
      const hasDriveConverter = snapshot?.inventory?.['Drive Converter'] > 0;
      if (!hasDriveConverter) {
        return true; // No auto form available without Drive Converter
      }
    }

    // Check if player has Second Chance (required for auto forms)
    const hasSecondChance = snapshot?.inventory?.['Second Chance'] > 0;
    if (!hasSecondChance) {
      return true; // Can't use auto forms without Second Chance
    }

    // Player can use either the regular form or the auto form
    const autoFormName = AUTO_FORM_MAP[formName];
    if (autoFormName && snapshot?.inventory?.[autoFormName] > 0) {
      return true;
    }

    return true; // Has the regular form
  },

  /**
   * Check if player has enough total forms for a given level requirement.
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Minimum number of forms required
   * @returns {boolean} True if player has enough forms
   */
  get_form_level_requirement(snapshot, staticData, amount) {
    const settings = staticData?.settings || {};
    const finalFormLogic = settings.FinalFormLogic ?? 1; // Default: light_and_darkness

    let formsAvailable = 0;
    let formList = [...DRIVE_FORMS]; // Copy the array

    // Handle Final Form based on FinalFormLogic setting
    if (finalFormLogic !== 0) { // not "no_light_and_darkness"
      if (finalFormLogic === 1) { // "light_and_darkness"
        // Check if player has Light and Darkness and any form
        const hasLightDarkness = snapshot?.inventory?.['Light & Darkness'] > 0;
        const hasAnyForm = formList.some(form => snapshot?.inventory?.[form] > 0);

        if (hasLightDarkness && hasAnyForm) {
          formsAvailable += 1;
          // Remove Final Form from the list so it's not counted again
          formList = formList.filter(f => f !== 'Final Form');
        }
      } else { // finalFormLogic === 2, "just_a_form"
        // Remove Final Form from counting
        formList = formList.filter(f => f !== 'Final Form');

        // Check if player has any non-Final form
        const hasAnyOtherForm = formList.some(form => snapshot?.inventory?.[form] > 0);
        if (hasAnyOtherForm) {
          formsAvailable += 1;
        }
      }
    }

    // Count all forms the player has
    for (const form of formList) {
      if (snapshot?.inventory?.[form] > 0) {
        formsAvailable += 1;
      }
    }

    return formsAvailable >= amount;
  },

  /**
   * Check if Simulated Twilight Town is unlocked.
   * Based on worlds/kh2/Rules.py:58-59
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Namine Sketches
   * @returns {boolean} True if player has the required amount of Namine Sketches
   */
  stt_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Namine Sketches"] || 0;
    return count >= amount;
  },

  /**
   * Check if level locking is unlocked.
   * Based on worlds/kh2/Rules.py:85-88
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required total count of visit locking items
   * @returns {boolean} True if player has enough visit locking items or Promise Charm
   */
  level_locking_unlock(snapshot, staticData, amount) {
    const settings = staticData?.settings || {};

    // Check if Promise Charm option is enabled and player has Promise Charm
    // Note: The Promise_Charm setting is not currently exported in rules.json
    // For now, we'll check if the setting exists and if the player has the item
    if (settings.Promise_Charm && snapshot?.inventory?.['Promise Charm'] > 0) {
      return true;
    }

    // Count all visit locking items
    let totalCount = 0;
    for (const itemName of VISIT_LOCKING_ITEMS) {
      totalCount += snapshot?.inventory?.[itemName] || 0;
    }

    return totalCount >= amount;
  },

  /**
   * Check if Twilight Thorn region is accessible.
   * Based on worlds/kh2/Rules.py:1052-1053
   * This is a static method that always returns true.
   *
   * @returns {boolean} Always returns true
   */
  get_twilight_thorn_rules() {
    return true;
  },

  /**
   * Check if Axel 1 region is accessible.
   * Based on worlds/kh2/Rules.py:1056-1057
   * This is a static method that always returns true.
   *
   * @returns {boolean} Always returns true
   */
  get_axel_one_rules() {
    return true;
  },

  /**
   * Check if Axel 2 region is accessible.
   * Based on worlds/kh2/Rules.py:1060-1061
   * This is a static method that always returns true.
   *
   * @returns {boolean} Always returns true
   */
  get_axel_two_rules() {
    return true;
  },

  /**
   * Check if Halloween Town is unlocked.
   * Based on worlds/kh2/Rules.py:46-47
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Bone Fist
   * @returns {boolean} True if player has the required amount of Bone Fist
   */
  ht_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Bone Fist"] || 0;
    return count >= amount;
  },

  /**
   * Check if Twilight Town is unlocked.
   * Based on worlds/kh2/Rules.py:49-50
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Ice Cream
   * @returns {boolean} True if player has the required amount of Ice Cream
   */
  tt_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Ice Cream"] || 0;
    return count >= amount;
  },

  /**
   * Check if Port Royal is unlocked.
   * Based on worlds/kh2/Rules.py:52-53
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Skill and Crossbones
   * @returns {boolean} True if player has the required amount of Skill and Crossbones
   */
  pr_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Skill and Crossbones"] || 0;
    return count >= amount;
  },

  /**
   * Check if Space Paranoids is unlocked.
   * Based on worlds/kh2/Rules.py:55-56
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Identity Disk
   * @returns {boolean} True if player has the required amount of Identity Disk
   */
  sp_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Identity Disk"] || 0;
    return count >= amount;
  },

  /**
   * Check if Disney Castle is unlocked.
   * Based on worlds/kh2/Rules.py:61-62
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Disney Castle Key
   * @returns {boolean} True if player has the required amount of Disney Castle Key
   */
  dc_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Disney Castle Key"] || 0;
    return count >= amount;
  },

  /**
   * Check if Hollow Bastion is unlocked.
   * Based on worlds/kh2/Rules.py:64-65
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Membership Card
   * @returns {boolean} True if player has the required amount of Membership Card
   */
  hb_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Membership Card"] || 0;
    return count >= amount;
  },

  /**
   * Check if Pride Lands is unlocked.
   * Based on worlds/kh2/Rules.py:67-68
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Proud Fang
   * @returns {boolean} True if player has the required amount of Proud Fang
   */
  pl_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Proud Fang"] || 0;
    return count >= amount;
  },

  /**
   * Check if Agrabah is unlocked.
   * Based on worlds/kh2/Rules.py:70-71
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Scimitar
   * @returns {boolean} True if player has the required amount of Scimitar
   */
  ag_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Scimitar"] || 0;
    return count >= amount;
  },

  /**
   * Check if Beast's Castle is unlocked.
   * Based on worlds/kh2/Rules.py:73-74
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Beast's Claw
   * @returns {boolean} True if player has the required amount of Beast's Claw
   */
  bc_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Beast's Claw"] || 0;
    return count >= amount;
  },

  /**
   * Check if Atlantica 3 is unlocked.
   * Based on worlds/kh2/Rules.py:76-77
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player has 2 or more Magnet Element
   */
  at_three_unlocked(snapshot, staticData) {
    const count = snapshot?.inventory?.["Magnet Element"] || 0;
    return count >= 2;
  },

  /**
   * Check if Atlantica 4 is unlocked.
   * Based on worlds/kh2/Rules.py:79-80
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player has 3 or more Thunder Element
   */
  at_four_unlocked(snapshot, staticData) {
    const count = snapshot?.inventory?.["Thunder Element"] || 0;
    return count >= 3;
  },

  /**
   * Check if Hundred Acre Wood is unlocked.
   * Based on worlds/kh2/Rules.py:82-83
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Torn Page
   * @returns {boolean} True if player has the required amount of Torn Page
   */
  hundred_acre_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Torn Page"] || 0;
    return count >= amount;
  },

  /**
   * Check if Prison Keeper fight is accessible.
   * Based on worlds/kh2/Rules.py:849-858
   *
   * This is a simplified implementation that returns true (easy mode).
   * The full implementation would check fight_logic setting and require:
   * - easy: defensive tool + drive form + party limit (3 categories)
   * - normal: 2 of the above categories
   * - hard: 1 of the above categories
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True for simplified implementation
   */
  get_prison_keeper_rules(snapshot, staticData) {
    // TODO: Implement proper fight logic when fight_logic setting is available
    // For now, return true (easy mode / no requirements)
    return true;
  },

  /**
   * Check if Oogie Boogie fight is accessible.
   * Based on worlds/kh2/Rules.py:861-863
   * This is a static method that always returns true (fight is free).
   *
   * @returns {boolean} Always returns true
   */
  get_oogie_rules() {
    return true;
  },

  /**
   * Check if Beast fight is accessible.
   * Based on worlds/kh2/Rules.py:779-781
   * This is a static method that always returns true (fight is free).
   *
   * @returns {boolean} Always returns true
   */
  get_beast_rules() {
    return true;
  },

  /**
   * Check if Thresholder fight is accessible.
   * Based on worlds/kh2/Rules.py:767-776
   *
   * This is a simplified implementation that returns true (easy mode).
   * The full implementation would check fight_logic setting and require:
   * - easy: drive form + black magic + defensive tool (3 categories)
   * - normal: 2 of the above categories
   * - hard: defensive tool or drive form (1 category)
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True for simplified implementation
   */
  get_thresholder_rules(snapshot, staticData) {
    // TODO: Implement proper fight logic when fight_logic setting is available
    // For now, return true (easy mode / no requirements)
    return true;
  }
};
