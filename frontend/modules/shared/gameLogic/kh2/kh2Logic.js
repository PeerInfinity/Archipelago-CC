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
// Note: Ice Cream appears twice in the Python list, so we include it twice here
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
  'Ice Cream',  // Appears twice in Python list (Items.py:579 and 582)
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
   * Check if Land of Dragons is unlocked.
   * Based on worlds/kh2/Rules.py:37-38
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Sword of the Ancestor
   * @returns {boolean} True if player has the required amount of Sword of the Ancestor
   */
  lod_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Sword of the Ancestor"] || 0;
    return count >= amount;
  },

  /**
   * Check if Olympus Coliseum is unlocked.
   * Based on worlds/kh2/Rules.py:40-41
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Battlefields of War
   * @returns {boolean} True if player has the required amount of Battlefields of War
   */
  oc_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Battlefields of War"] || 0;
    return count >= amount;
  },

  /**
   * Check if The World That Never Was is unlocked.
   * Based on worlds/kh2/Rules.py:43-44
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {number} amount - Required count of Way to the Dawn
   * @returns {boolean} True if player has the required amount of Way to the Dawn
   */
  twtnw_unlocked(snapshot, staticData, amount) {
    const count = snapshot?.inventory?.["Way to the Dawn"] || 0;
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
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Prison Keeper fight
   */
  get_prison_keeper_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const defensiveTool = ['Reflect Element', 'Guard'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const partyLimit = ['Fantasia', 'Flare Force', 'Teamwork', 'Tornado Fusion'];

    let categoriesAvailable = 0;
    if (defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0)) categoriesAvailable++;
    if (formList.some(form => snapshot?.inventory?.[form] > 0)) categoriesAvailable++;
    if (partyLimit.some(limit => snapshot?.inventory?.[limit] > 0)) categoriesAvailable++;

    if (fightLogic === 0) return categoriesAvailable >= 3; // easy
    if (fightLogic === 1) return categoriesAvailable >= 2; // normal
    return categoriesAvailable >= 1; // hard
  },

  /**
   * Check if Shan Yu fight is accessible.
   * Based on worlds/kh2/Rules.py:726-735
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Shan Yu fight
   */
  get_shan_yu_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const gapCloser = ['Slide Dash', 'Flash Step'];
    const defensiveTool = ['Reflect Element', 'Guard'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];

    let categoriesAvailable = 0;
    if (gapCloser.some(item => snapshot?.inventory?.[item] > 0)) categoriesAvailable++;
    if (defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0)) categoriesAvailable++;
    if (formList.some(form => snapshot?.inventory?.[form] > 0)) categoriesAvailable++;

    if (fightLogic === 0) return categoriesAvailable >= 3; // easy
    if (fightLogic === 1) return categoriesAvailable >= 2; // normal
    // hard: defensive tool or drive form
    const hasDefensiveTool = defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0);
    const hasForm = formList.some(form => snapshot?.inventory?.[form] > 0);
    return hasDefensiveTool || hasForm;
  },

  /**
   * Check if Dark Thorn fight is accessible.
   * Based on worlds/kh2/Rules.py:784-793
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Dark Thorn fight
   */
  get_dark_thorn_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const gapCloser = ['Slide Dash', 'Flash Step'];
    const defensiveTool = ['Reflect Element', 'Guard'];

    if (fightLogic === 0) { // easy: all 3 categories
      let categoriesAvailable = 0;
      if (formList.some(form => snapshot?.inventory?.[form] > 0)) categoriesAvailable++;
      if (gapCloser.some(item => snapshot?.inventory?.[item] > 0)) categoriesAvailable++;
      if (defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0)) categoriesAvailable++;
      return categoriesAvailable >= 3;
    } else if (fightLogic === 1) { // normal: drive form AND defensive tool (no gap closer)
      let categoriesAvailable = 0;
      if (formList.some(form => snapshot?.inventory?.[form] > 0)) categoriesAvailable++;
      if (defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0)) categoriesAvailable++;
      return categoriesAvailable >= 2;
    } else { // hard: defensive tool only
      return defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0);
    }
  },

  /**
   * Check if Fire Lord fight is accessible.
   * Based on worlds/kh2/Rules.py:743-750
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Fire Lord fight
   */
  get_fire_lord_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const defensiveTool = ['Reflect Element', 'Guard'];
    const blackMagic = ['Fire Element', 'Blizzard Element', 'Thunder Element'];
    const partyLimit = ['Fantasia', 'Flare Force', 'Teamwork', 'Tornado Fusion'];

    let categoriesAvailable = 0;
    if (formList.some(form => snapshot?.inventory?.[form] > 0)) categoriesAvailable++;
    if (defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0)) categoriesAvailable++;
    if (blackMagic.some(magic => snapshot?.inventory?.[magic] > 0)) categoriesAvailable++;
    if (partyLimit.some(limit => snapshot?.inventory?.[limit] > 0)) categoriesAvailable++;

    if (fightLogic === 0) return categoriesAvailable >= 4; // easy
    if (fightLogic === 1) return categoriesAvailable >= 3; // normal
    return categoriesAvailable >= 2; // hard
  },

  /**
   * Check if Blizzard Lord fight is accessible.
   * Based on worlds/kh2/Rules.py:753-760
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Blizzard Lord fight
   */
  get_blizzard_lord_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const defensiveTool = ['Reflect Element', 'Guard'];
    const blackMagic = ['Fire Element', 'Blizzard Element', 'Thunder Element'];
    const partyLimit = ['Fantasia', 'Flare Force', 'Teamwork', 'Tornado Fusion'];

    let categoriesAvailable = 0;
    if (formList.some(form => snapshot?.inventory?.[form] > 0)) categoriesAvailable++;
    if (defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0)) categoriesAvailable++;
    if (blackMagic.some(magic => snapshot?.inventory?.[magic] > 0)) categoriesAvailable++;
    if (partyLimit.some(limit => snapshot?.inventory?.[limit] > 0)) categoriesAvailable++;

    if (fightLogic === 0) return categoriesAvailable >= 4; // easy
    if (fightLogic === 1) return categoriesAvailable >= 3; // normal
    return categoriesAvailable >= 2; // hard
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
   * Requires different item combinations based on fight_logic setting:
   * - easy (0): drive form + black magic + defensive tool (3 categories)
   * - normal (1): 2 of the above 3 categories
   * - hard (2): defensive tool or drive form (1 category)
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Thresholder fight
   */
  get_thresholder_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    // Define item categories (from worlds/kh2/Logic.py)
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const blackMagic = ['Fire Element', 'Blizzard Element', 'Thunder Element'];
    const defensiveTool = ['Reflect Element', 'Guard'];

    // Count how many categories the player has access to
    let categoriesAvailable = 0;

    // Check if player has any form
    if (formList.some(form => snapshot?.inventory?.[form] > 0)) {
      categoriesAvailable++;
    }

    // Check if player has any black magic
    if (blackMagic.some(magic => snapshot?.inventory?.[magic] > 0)) {
      categoriesAvailable++;
    }

    // Check if player has any defensive tool
    if (defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0)) {
      categoriesAvailable++;
    }

    // Apply fight logic based on setting
    if (fightLogic === 0) { // easy
      return categoriesAvailable >= 3;
    } else if (fightLogic === 1) { // normal (default)
      return categoriesAvailable >= 2;
    } else { // hard (2)
      // For hard mode, need defensive tool OR drive form (not black magic alone)
      const hasForm = formList.some(form => snapshot?.inventory?.[form] > 0);
      const hasDefensiveTool = defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0);
      return hasForm || hasDefensiveTool;
    }
  },

  /**
   * Check if Demyx fight is accessible.
   * Based on worlds/kh2/Rules.py:887-896
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Demyx fight
   */
  get_demyx_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const defensiveTool = ['Reflect Element', 'Guard'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const partyLimit = ['Fantasia', 'Flare Force', 'Teamwork', 'Tornado Fusion'];

    // Count categories using kh2_list_any_sum
    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [defensiveTool, formList, partyLimit],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 3; // easy
    if (fightLogic === 1) {
      // normal: defensive tool + drive form (2 categories)
      const hasDefensive = defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0);
      const hasForm = formList.some(form => snapshot?.inventory?.[form] > 0);
      return hasDefensive && hasForm;
    }
    // hard: defensive tool only
    return defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0);
  },

  /**
   * Check if Cavern of Remembrance first fight movement requirements are met.
   * Based on worlds/kh2/Rules.py:931-940
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player meets movement requirements
   */
  get_cor_first_fight_movement_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    if (fightLogic === 0) { // easy: quick run 3 or wisdom 5
      return (snapshot?.inventory?.['Quick Run'] >= 3) ||
        helperFunctions.form_list_unlock(snapshot, staticData, 'Wisdom Form', 3, true);
    } else if (fightLogic === 1) { // normal: (quick run 2 and aerial dodge 1) or wisdom 5
      return helperFunctions.kh2_dict_count({'Quick Run': 2, 'Aerial Dodge': 1}, snapshot) ||
        helperFunctions.form_list_unlock(snapshot, staticData, 'Wisdom Form', 3, true);
    } else { // hard: (quick run 1, aerial dodge 1) or (wisdom form and aerial dodge 1)
      return helperFunctions.kh2_has_all(snapshot, staticData, ['Aerial Dodge', 'Quick Run']) ||
        helperFunctions.kh2_has_all(snapshot, staticData, ['Aerial Dodge', 'Wisdom Form']);
    }
  },

  /**
   * Check if Cavern of Remembrance first fight requirements are met.
   * Based on worlds/kh2/Rules.py:942-951
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access first fight
   */
  get_cor_first_fight_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const notHardCorToolsDict = {
      'Reflect Element': 3,
      'Stitch': 1,
      'Chicken Little': 1,
      'Magnet Element': 2,
      'Explosion': 1,
      'Finishing Leap': 1,
      'Thunder Element': 2
    };

    const toolCount = helperFunctions.kh2_dict_one_count(notHardCorToolsDict, snapshot);

    if (fightLogic === 0) { // easy: 5 tools or 4 tools + final form 1
      return toolCount >= 5 ||
        (toolCount >= 4 && helperFunctions.form_list_unlock(snapshot, staticData, 'Final Form', 1, true));
    } else if (fightLogic === 1) { // normal: 3 tools or 2 tools + final form 1
      return toolCount >= 3 ||
        (toolCount >= 2 && helperFunctions.form_list_unlock(snapshot, staticData, 'Final Form', 1, true));
    } else { // hard: reflect + (stitch or chicken little) + final form
      return (snapshot?.inventory?.['Reflect Element'] > 0) &&
        helperFunctions.kh2_has_any(snapshot, staticData, ['Stitch', 'Chicken Little']) &&
        helperFunctions.form_list_unlock(snapshot, staticData, 'Final Form', 1, true);
    }
  },

  /**
   * Check if Cavern of Remembrance skip requirements are met.
   * Based on worlds/kh2/Rules.py:953-977
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can skip the first fight
   */
  get_cor_skip_first_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};

    // Check if CoR skip is enabled
    if (!settings.CorSkipToggle) {
      return false;
    }

    const fightLogic = settings.FightLogic ?? 1; // Default: normal
    const magic = ['Fire Element', 'Blizzard Element', 'Thunder Element', 'Reflect Element', 'Cure Element', 'Magnet Element'];

    // Void cross rules
    let voidCrossPass = false;
    if (fightLogic === 0) { // easy: aerial dodge 3, master form, fire
      voidCrossPass = (snapshot?.inventory?.['Aerial Dodge'] >= 3) &&
        helperFunctions.kh2_has_all(snapshot, staticData, ['Master Form', 'Fire Element']);
    } else if (fightLogic === 1) { // normal: aerial dodge 2, master form, fire
      voidCrossPass = (snapshot?.inventory?.['Aerial Dodge'] >= 2) &&
        helperFunctions.kh2_has_all(snapshot, staticData, ['Master Form', 'Fire Element']);
    } else { // hard: multiple options
      voidCrossPass = helperFunctions.kh2_dict_count({'Quick Run': 3, 'Aerial Dodge': 1}, snapshot) ||
        (helperFunctions.kh2_dict_count({'Quick Run': 2, 'Aerial Dodge': 2}, snapshot) &&
          helperFunctions.kh2_has_any(snapshot, staticData, magic)) ||
        ((snapshot?.inventory?.['Final Form'] > 0) &&
          (helperFunctions.kh2_has_any(snapshot, staticData, magic) || (snapshot?.inventory?.['Combo Master'] > 0))) ||
        ((snapshot?.inventory?.['Master Form'] > 0) &&
          helperFunctions.kh2_has_any(snapshot, staticData, ['Reflect Element', 'Fire Element', 'Combo Master']));
    }

    // Wall rise rules
    let wallRisePass = true;
    if (fightLogic === 2) { // hard only
      wallRisePass = (snapshot?.inventory?.['Aerial Dodge'] > 0) &&
        (helperFunctions.form_list_unlock(snapshot, staticData, 'Final Form', 1, true) ||
          (snapshot?.inventory?.['Glide'] >= 2));
    }

    return voidCrossPass && wallRisePass;
  },

  /**
   * Check if Cavern of Remembrance second fight movement requirements are met.
   * Based on worlds/kh2/Rules.py:979-991
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player meets movement requirements
   */
  get_cor_second_fight_movement_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal
    const magic = ['Fire Element', 'Blizzard Element', 'Thunder Element', 'Reflect Element', 'Cure Element', 'Magnet Element'];

    if (fightLogic === 0) { // easy: quick run 2, aerial dodge 3 or master form 5
      return helperFunctions.kh2_dict_count({'Quick Run': 2, 'Aerial Dodge': 3}, snapshot) ||
        helperFunctions.form_list_unlock(snapshot, staticData, 'Master Form', 3, true);
    } else if (fightLogic === 1) { // normal: quick run 2, aerial dodge 2 or master 5
      return helperFunctions.kh2_dict_count({'Quick Run': 2, 'Aerial Dodge': 2}, snapshot) ||
        helperFunctions.form_list_unlock(snapshot, staticData, 'Master Form', 3, true);
    } else { // hard: multiple options
      return (helperFunctions.kh2_has_all(snapshot, staticData, ['Glide', 'Aerial Dodge']) &&
        helperFunctions.kh2_has_any(snapshot, staticData, magic)) ||
        ((snapshot?.inventory?.['Master Form'] > 0) && helperFunctions.kh2_has_any(snapshot, staticData, magic)) ||
        ((snapshot?.inventory?.['Glide'] > 0) && (snapshot?.inventory?.['Aerial Dodge'] >= 2));
    }
  },

  /**
   * Check if Cerberus fight is accessible.
   * Based on worlds/kh2/Rules.py:672-680
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Cerberus fight
   */
  get_cerberus_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const defensiveTool = ['Reflect Element', 'Guard'];
    const blackMagic = ['Fire Element', 'Blizzard Element', 'Thunder Element'];

    if (fightLogic === 0 || fightLogic === 1) { // easy or normal: defensive tool + black magic
      return helperFunctions.kh2_list_any_sum([defensiveTool, blackMagic], snapshot) >= 2;
    }
    // hard: defensive tool only
    return helperFunctions.kh2_has_any(snapshot, staticData, defensiveTool);
  },

  /**
   * Check if Olympus Pete fight is accessible.
   * Based on worlds/kh2/Rules.py:723-732
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Olympus Pete fight
   */
  get_olympus_pete_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const gapCloser = ['Slide Dash', 'Flash Step'];
    const defensiveTool = ['Reflect Element', 'Guard'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];

    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [gapCloser, defensiveTool, formList],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 3; // easy
    if (fightLogic === 1) return categoriesAvailable >= 2; // normal
    return categoriesAvailable >= 1; // hard
  },

  /**
   * Check if Hydra fight is accessible.
   * Based on worlds/kh2/Rules.py:734-743
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Hydra fight
   */
  get_hydra_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const blackMagic = ['Fire Element', 'Blizzard Element', 'Thunder Element'];
    const defensiveTool = ['Reflect Element', 'Guard'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];

    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [blackMagic, defensiveTool, formList],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 3; // easy
    if (fightLogic === 1) return categoriesAvailable >= 2; // normal
    return categoriesAvailable >= 1; // hard
  },

  /**
   * Check if Hades fight is accessible.
   * Based on worlds/kh2/Rules.py:745-754
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Hades fight
   */
  get_hades_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const gapCloser = ['Slide Dash', 'Flash Step'];
    const summons = ['Chicken Little', 'Stitch', 'Genie', 'Peter Pan'];
    const defensiveTool = ['Reflect Element', 'Guard'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];

    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [gapCloser, summons, defensiveTool, formList],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 4; // easy
    if (fightLogic === 1) return categoriesAvailable >= 3; // normal
    return categoriesAvailable >= 2; // hard
  },

  /**
   * Check if Ansem Riku fight is accessible.
   * Based on worlds/kh2/Rules.py:516-525
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Ansem Riku fight
   */
  get_ansem_riku_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const gapCloser = ['Slide Dash', 'Flash Step'];
    const defensiveTool = ['Reflect Element', 'Guard'];
    const groundFinisher = ['Guard Break', 'Explosion', 'Finishing Leap'];

    if (fightLogic === 0) { // easy: 3 of 4 categories
      const categoriesAvailable = helperFunctions.kh2_list_any_sum(
        [gapCloser, defensiveTool, ['Limit Form'], groundFinisher],
        snapshot
      );
      return categoriesAvailable >= 3;
    } else if (fightLogic === 1) { // normal: 2 of 4 categories
      const categoriesAvailable = helperFunctions.kh2_list_any_sum(
        [gapCloser, defensiveTool, ['Limit Form'], groundFinisher],
        snapshot
      );
      return categoriesAvailable >= 2;
    } else { // hard: defensive tool or limit form
      return helperFunctions.kh2_has_any(snapshot, staticData, ['Reflect Element', 'Guard', 'Limit Form']);
    }
  },

  /**
   * Check if Final Form region is accessible.
   * Based on worlds/kh2/Rules.py:372-381
   *
   * Can reach one of: TT3, TWTNW post Roxas, BC2, LoD2, or PR2
   * Checks if player can reach any of the final leveling access locations.
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Final Form region
   */
  final_form_region_access(snapshot, staticData) {
    // These locations are defined in Logic.py:608-614 (final_leveling_access)
    // The Python code checks if any of these locations can be reached, which means:
    // 1. The parent region of the location is accessible
    // 2. The location's access rule passes
    //
    // To avoid circular dependencies (since checking location access would require
    // region access which requires this helper), we check the parent regions instead.
    // From the Python code: "The access rules of each of the locations in final_leveling_access
    // do not check for being able to reach other locations or other regions, so it is only
    // the parent region of each location that needs to be added as an indirect condition."
    //
    // Parent regions (from rules.json):
    const finalLevelingRegions = [
      'Roxas',                // Roxas Event Location
      'Grim Reaper 2',        // (PR2) Grim Reaper 2 Bonus: Sora Slot 1
      'Xaldin',               // (BC2) Xaldin Bonus: Sora Slot 1
      'Storm Rider',          // (LoD2) Storm Rider Bonus: Sora Slot 1
      'Twilight Town 3'       // (TT3) Underground Concourse Mythril Gem
    ];

    // Check if any of these parent regions are accessible
    const regionReachability = snapshot?.regionReachability || {};

    return finalLevelingRegions.some(region =>
      regionReachability[region] === 'reachable'
    );
  },

  /**
   * Check if Storm Rider fight is accessible.
   * Based on worlds/kh2/Rules.py:527-536
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Storm Rider fight
   */
  get_storm_rider_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const defensiveTool = ['Reflect Element', 'Guard'];
    const partyLimit = ['Fantasia', 'Flare Force', 'Teamwork', 'Tornado Fusion'];
    const aerialMove = ['Aerial Dive', 'Aerial Spiral', 'Horizontal Slash', 'Aerial Sweep', 'Aerial Finish'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];

    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [defensiveTool, partyLimit, aerialMove, formList],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 4; // easy
    if (fightLogic === 1) return categoriesAvailable >= 3; // normal
    return categoriesAvailable >= 2; // hard
  },

  /**
   * Check if Barbosa fight is accessible.
   * Based on worlds/kh2/Rules.py:get_barbosa_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Barbosa fight
   */
  get_barbosa_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const defensiveTool = ['Reflect Element', 'Guard'];
    const elementalMagic = ['Blizzard Element', 'Thunder Element'];

    if (fightLogic === 0) { // easy: 2+ Blizzard/Thunder AND defensive tool
      const magicCount = elementalMagic.reduce((sum, item) =>
        sum + (snapshot?.inventory?.[item] > 0 ? 1 : 0), 0);
      const hasDefensive = defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0);
      return magicCount >= 2 && hasDefensive;
    } else if (fightLogic === 1) { // normal: 2+ of (defensive tool, Blizzard, Thunder)
      const categoriesAvailable = helperFunctions.kh2_list_any_sum(
        [defensiveTool, elementalMagic],
        snapshot
      );
      return categoriesAvailable >= 2;
    } else { // hard: defensive tool only
      return defensiveTool.some(tool => snapshot?.inventory?.[tool] > 0);
    }
  },

  /**
   * Check if Scar fight is accessible.
   * Based on worlds/kh2/Rules.py:1018-1027
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Scar fight
   */
  get_scar_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    if (fightLogic === 0) { // easy: Reflect, Thunder, Fire
      return helperFunctions.kh2_has_all(snapshot, staticData, ['Reflect Element', 'Thunder Element', 'Fire Element']);
    } else if (fightLogic === 1) { // normal: Reflect, Fire
      return helperFunctions.kh2_has_all(snapshot, staticData, ['Reflect Element', 'Fire Element']);
    } else { // hard: Reflect only
      return snapshot?.inventory?.['Reflect Element'] > 0;
    }
  },

  /**
   * Check if Hostile Program fight is accessible.
   * Based on worlds/kh2/Rules.py:get_hostile_program_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Hostile Program fight
   */
  get_hostile_program_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const donaldLimit = ['Fantasia', 'Flare Force'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const summons = ['Chicken Little', 'Stitch', 'Genie', 'Peter Pan'];
    const reflectElement = ['Reflect Element'];

    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [donaldLimit, formList, summons, reflectElement],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 4; // easy
    if (fightLogic === 1) return categoriesAvailable >= 3; // normal
    return categoriesAvailable >= 2; // hard
  },

  /**
   * Check if Transport fight is accessible.
   * Based on worlds/kh2/Rules.py:get_transport_fight_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Transport fight
   */
  get_transport_fight_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const transportTools = {
      'Reflect Element': 3,
      'Stitch': 1,
      'Chicken Little': 1,
      'Magnet Element': 2,
      'Explosion': 1,
      'Finishing Leap': 1,
      'Thunder Element': 3,
      'Fantasia': 1,
      'Flare Force': 1,
      'Genie': 1
    };

    if (fightLogic === 0) { // easy: All requirements met
      return helperFunctions.kh2_dict_count(transportTools, snapshot);
    } else { // normal/hard: Count items that meet their requirements
      const metCount = helperFunctions.kh2_dict_one_count(transportTools, snapshot);
      if (fightLogic === 1) return metCount >= 7; // normal
      return metCount >= 5; // hard
    }
  },

  /**
   * Check if Transport movement requirements are met.
   * Based on worlds/kh2/Rules.py:get_transport_movement_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player meets Transport movement requirements
   */
  get_transport_movement_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const magic = ['Fire Element', 'Blizzard Element', 'Thunder Element',
                   'Reflect Element', 'Cure Element', 'Magnet Element'];

    if (fightLogic === 0) { // easy: High Jump 3, Aerial Dodge 3, Glide 3
      return helperFunctions.kh2_dict_count(
        {'High Jump': 3, 'Aerial Dodge': 3, 'Glide': 3},
        snapshot
      );
    } else if (fightLogic === 1) { // normal: High Jump 2, Aerial Dodge 2, Glide 3
      return helperFunctions.kh2_dict_count(
        {'High Jump': 2, 'Aerial Dodge': 2, 'Glide': 3},
        snapshot
      );
    } else { // hard: Multiple option combinations
      const option1 = helperFunctions.kh2_dict_count(
        {'High Jump': 2, 'Aerial Dodge': 1, 'Glide': 2}, snapshot
      ) && helperFunctions.kh2_has_any(snapshot, staticData, magic);

      const option2 = helperFunctions.kh2_dict_count(
        {'High Jump': 1, 'Aerial Dodge': 3, 'Glide': 2}, snapshot
      ) && helperFunctions.kh2_has_any(snapshot, staticData, magic);

      const option3 = helperFunctions.kh2_dict_count(
        {'High Jump': 1, 'Aerial Dodge': 1, 'Glide': 3}, snapshot
      );

      const option4 = helperFunctions.kh2_has_all(snapshot, staticData, ['Master Form', 'Aerial Dodge']) &&
                     helperFunctions.kh2_has_any(snapshot, staticData, magic);

      return option1 || option2 || option3 || option4;
    }
  },

  /**
   * Check if Old Pete fight is accessible.
   * Based on worlds/kh2/Rules.py:get_old_pete_rules
   * The fight is free with no requirements.
   *
   * @returns {boolean} Always returns true
   */
  get_old_pete_rules() {
    return true;
  },

  /**
   * Check if Future Pete fight is accessible.
   * Based on worlds/kh2/Rules.py:get_future_pete_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Future Pete fight
   */
  get_future_pete_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const defensiveTool = ['Reflect Element', 'Guard'];
    const gapCloser = ['Slide Dash', 'Flash Step'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];

    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [defensiveTool, gapCloser, formList],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 3; // easy
    if (fightLogic === 1) return categoriesAvailable >= 2; // normal
    return categoriesAvailable >= 1; // hard
  },

  /**
   * Check if Experiment fight is accessible.
   * Based on worlds/kh2/Rules.py:get_experiment_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Experiment fight
   */
  get_experiment_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const defensiveTool = ['Reflect Element', 'Guard'];
    const partyLimit = ['Fantasia', 'Flare Force', 'Teamwork', 'Tornado Fusion'];
    const summons = ['Chicken Little', 'Stitch', 'Genie', 'Peter Pan'];

    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [formList, defensiveTool, partyLimit, summons],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 4; // easy
    if (fightLogic === 1) return categoriesAvailable >= 3; // normal
    return categoriesAvailable >= 2; // hard
  },

  /**
   * Check if Groundshaker fight is accessible.
   * Based on worlds/kh2/Rules.py:get_groundshaker_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Groundshaker fight
   */
  get_groundshaker_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const airComboCount = snapshot?.inventory?.['Air Combo Plus'] || 0;
    const hasBerserkCharge = snapshot?.inventory?.['Berserk Charge'] > 0;
    const hasCure = snapshot?.inventory?.['Cure Element'] > 0;
    const hasReflect = snapshot?.inventory?.['Reflect Element'] > 0;

    if (fightLogic === 0) { // easy: Air Combo Plus (2) AND Berserk Charge AND Cure AND Reflect
      return airComboCount >= 2 &&
        helperFunctions.kh2_has_all(snapshot, staticData, ['Berserk Charge', 'Cure Element', 'Reflect Element']);
    } else if (fightLogic === 1) { // normal: Berserk Charge AND Reflect AND Cure
      return helperFunctions.kh2_has_all(snapshot, staticData, ['Berserk Charge', 'Reflect Element', 'Cure Element']);
    } else { // hard: (Berserk Charge OR Air Combo Plus (2)) AND Reflect
      return (hasBerserkCharge || airComboCount >= 2) && hasReflect;
    }
  },

  /**
   * Check if Xaldin fight is accessible.
   * Based on worlds/kh2/Rules.py:get_xaldin_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Xaldin fight
   */
  get_xaldin_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const aerialMove = ['Aerial Dive', 'Aerial Spiral', 'Horizontal Slash', 'Aerial Sweep', 'Aerial Finish'];
    const hasGuard = snapshot?.inventory?.['Guard'] > 0;
    const aerialMoveCount = helperFunctions.kh2_list_count_sum(aerialMove, snapshot);

    if (fightLogic === 0) { // easy: Guard AND (Valor/Master/Final) AND 2+ aerial moves
      const forms = ['Valor Form', 'Master Form', 'Final Form'];
      const hasGuardAndForms = helperFunctions.kh2_list_any_sum(
        [['Guard'], forms],
        snapshot
      ) >= 2;
      return hasGuardAndForms && aerialMoveCount >= 2;
    } else if (fightLogic === 1) { // normal: Guard AND 1+ aerial move
      const hasAerialMove = helperFunctions.kh2_list_any_sum([aerialMove], snapshot) >= 1;
      return hasGuard && hasAerialMove;
    } else { // hard: Guard only
      return hasGuard;
    }
  },

  /**
   * Check if MCP (Master Control Program) fight is accessible.
   * Based on worlds/kh2/Rules.py:get_mcp_rules
   * Same requirements as Hostile Program
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access MCP fight
   */
  get_mcp_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const donaldLimit = ['Fantasia', 'Flare Force'];
    const formList = ['Valor Form', 'Wisdom Form', 'Limit Form', 'Master Form', 'Final Form'];
    const summons = ['Chicken Little', 'Stitch', 'Genie', 'Peter Pan'];
    const reflectElement = ['Reflect Element'];

    const categoriesAvailable = helperFunctions.kh2_list_any_sum(
      [donaldLimit, formList, summons, reflectElement],
      snapshot
    );

    if (fightLogic === 0) return categoriesAvailable >= 4; // easy
    if (fightLogic === 1) return categoriesAvailable >= 3; // normal
    return categoriesAvailable >= 2; // hard
  },

  /**
   * Check if Titan Cup is accessible.
   * Based on worlds/kh2/Rules.py:get_titan_cup_rules
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @returns {boolean} True if player can access Titan Cup
   */
  get_titan_cup_rules(snapshot, staticData) {
    const settings = staticData?.settings || {};
    const fightLogic = settings.FightLogic ?? 1; // Default: normal

    const summons = ['Chicken Little', 'Stitch', 'Genie', 'Peter Pan'];
    const summonsCount = helperFunctions.kh2_list_count_sum(summons, snapshot);
    const reflectCount = snapshot?.inventory?.['Reflect Element'] || 0;

    // Check basic requirements based on fight logic
    let basicRequirements = false;
    if (fightLogic === 0) { // easy: 4 summons + Reflera (2)
      basicRequirements = summonsCount >= 4 && reflectCount >= 2;
    } else if (fightLogic === 1) { // normal: 3 summons + Reflera (2)
      basicRequirements = summonsCount >= 3 && reflectCount >= 2;
    } else { // hard: 2 summons + Reflera (2)
      basicRequirements = summonsCount >= 2 && reflectCount >= 2;
    }

    // Also requires Hades Event OR Hades Cup Trophy
    const hasHadesAccess = (snapshot?.inventory?.['Hades Event'] > 0) ||
                          (snapshot?.inventory?.['Hades Cup Trophy'] > 0);

    return basicRequirements && hasHadesAccess;
  },

  /**
   * Utility: Sum up the count of all items in a list.
   * Based on worlds/kh2/Rules.py:93-100
   *
   * @param {Array<string>} itemList - Array of item names
   * @param {Object} snapshot - Game state snapshot
   * @returns {number} Total count of all items in the list
   */
  kh2_list_count_sum(itemList, snapshot) {
    return itemList.reduce((sum, itemName) =>
      sum + (snapshot?.inventory?.[itemName] || 0), 0);
  },

  /**
   * Utility: Check if player has any item from a list of item lists.
   * Based on worlds/kh2/Rules.py:101-108
   *
   * @param {Array<Array<string>>} listOfItemLists - Array of item name arrays
   * @param {Object} snapshot - Game state snapshot
   * @returns {number} Count of lists where player has at least one item
   */
  kh2_list_any_sum(listOfItemLists, snapshot) {
    let count = 0;
    for (const itemList of listOfItemLists) {
      if (itemList.some(item => snapshot?.inventory?.[item] > 0)) {
        count++;
      }
    }
    return count;
  },

  /**
   * Utility: Check if player has all required item counts from a dictionary.
   * Based on worlds/kh2/Rules.py:110-117
   *
   * @param {Object} itemNameToCount - Dictionary mapping item names to required counts
   * @param {Object} snapshot - Game state snapshot
   * @returns {boolean} True if player has all required counts
   */
  kh2_dict_count(itemNameToCount, snapshot) {
    for (const [itemName, requiredCount] of Object.entries(itemNameToCount)) {
      if ((snapshot?.inventory?.[itemName] || 0) < requiredCount) {
        return false;
      }
    }
    return true;
  },

  /**
   * Utility: Count how many items in dictionary meet their required count.
   * Based on worlds/kh2/Rules.py:119-126
   *
   * @param {Object} itemNameToCount - Dictionary mapping item names to required counts
   * @param {Object} snapshot - Game state snapshot
   * @returns {number} Count of items that meet their required count
   */
  kh2_dict_one_count(itemNameToCount, snapshot) {
    let count = 0;
    for (const [itemName, requiredCount] of Object.entries(itemNameToCount)) {
      if ((snapshot?.inventory?.[itemName] || 0) >= requiredCount) {
        count++;
      }
    }
    return count;
  },

  /**
   * Utility: Check if player has all items from a list.
   * Based on worlds/kh2/Rules.py:151-153
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {Array<string>} items - Array of item names
   * @returns {boolean} True if player has at least one of all items
   */
  kh2_has_all(snapshot, staticData, items) {
    return items.every(item => snapshot?.inventory?.[item] > 0);
  },

  /**
   * Utility: Check if player has any item from a list.
   * Based on worlds/kh2/Rules.py:155-156
   *
   * @param {Object} snapshot - Game state snapshot
   * @param {Object} staticData - Static game data (contains settings)
   * @param {Array<string>} items - Array of item names
   * @returns {boolean} True if player has at least one item
   */
  kh2_has_any(snapshot, staticData, items) {
    return items.some(item => snapshot?.inventory?.[item] > 0);
  }
};
