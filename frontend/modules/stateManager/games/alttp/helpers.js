import { GameHelpers } from '../../helpers/index.js';

// Helper function for logging with fallback
function log(level, message, ...data) {
  if (typeof window !== 'undefined' && window.logger) {
    window.logger[level]('alttpHelpers', message, ...data);
  } else {
    // In worker context, only log ERROR and WARN levels to keep console clean
    if (level === 'error' || level === 'warn') {
      const consoleMethod =
        console[level === 'info' ? 'log' : level] || console.log;
      consoleMethod(`[alttpHelpers] ${message}`, ...data);
    }
  }
}

export class ALTTPHelpers extends GameHelpers {
  /**
   * Constructor for ALTTP specific helpers.
   * Accepts either a full StateManager instance (worker context)
   * or a stateSnapshotInterface object (main thread context).
   * @param {object} context - StateManager instance or stateSnapshotInterface.
   */
  constructor(context) {
    super();
    // --- ORIGINAL CONTEXT DETECTION ---
    this.manager = null;
    this.snapshot = null;

    // Prioritize the explicit marker for snapshot interface
    if (context && context._isSnapshotInterface === true) {
      log(
        'info',
        '[ALTTPHelpers Snapshot Constructor] Initializing with StateSnapshotInterface (marker found).'
      );
      this.snapshot = context;
    } else if (context && typeof context.getSnapshot === 'function') {
      // Worker context
      log(
        'info',
        '[ALTTPHelpers Worker Constructor] Initializing with StateManager instance (getSnapshot found).'
      );
      this.manager = context;
      // Log to check the state of manager.locations AT THE TIME OF CONSTRUCTOR CALL
      if (this.manager) {
        log(
          'info',
          '[ALTTPHelpers Worker Constructor] this.manager.locations type:',
          typeof this.manager.locations
        );
        log(
          'info',
          '[ALTTPHelpers Worker Constructor] this.manager.locations available:',
          !!this.manager.locations
        );
        if (this.manager.locations && Array.isArray(this.manager.locations)) {
          log(
            'info',
            '[ALTTPHelpers Worker Constructor] Number of locations initially on manager:',
            this.manager.locations.length
          );
        } else if (this.manager.locations) {
          log(
            'info',
            '[ALTTPHelpers Worker Constructor] this.manager.locations is not an array. Keys:',
            Object.keys(this.manager.locations).length
          );
        }
      } else {
        log(
          'error',
          '[ALTTPHelpers Worker Constructor] this.manager is unexpectedly null after assignment!'
        );
      }
    } else if (context && typeof context.hasItem === 'function') {
      log(
        'info',
        '[ALTTPHelpers] Initializing with StateSnapshotInterface (Main thread context).'
      );
      this.snapshot = context;
    } else {
      log(
        'error',
        '[ALTTPHelpers] Invalid context provided! Expected StateManager or StateSnapshotInterface.',
        context
      );
      throw new Error(
        'ALTTPHelpers requires a valid StateManager or StateSnapshotInterface.'
      );
    }
    // --- END ORIGINAL CONTEXT DETECTION ---

    // --- ADDED: Game-specific entities --- >
    this.entities = {
      old_man: {
        can_reach: () => {
          // Use internal helper which checks manager or snapshot
          return this._isLocationAccessible('Old Man');
        },
      },
    };
    // --- END ADDED --- >
  }

  // --- Internal Accessor Helpers ---
  _hasItem(itemName) {
    return this.manager
      ? this.manager.inventory.has(itemName)
      : this.snapshot.hasItem(itemName);
  }

  _countItem(itemName) {
    return this.manager
      ? this.manager.inventory.count(itemName)
      : this.snapshot.countItem(itemName);
  }

  _countGroup(groupName) {
    return this.manager
      ? this.manager.inventory.countGroup(groupName)
      : this.snapshot.countGroup(groupName);
  }

  _hasFlag(flagName) {
    return this.manager
      ? this.manager.state?.hasFlag(flagName)
      : this.snapshot.hasFlag(flagName);
  }

  _getSetting(settingName) {
    const defaultValue = undefined;
    if (this.manager) {
      return this.manager.settings
        ? this.manager.settings[settingName]
        : defaultValue;
    } else {
      return this.snapshot.getSetting
        ? this.snapshot.getSetting(settingName)
        : defaultValue;
    }
  }

  _getGameMode() {
    return this.manager ? this.manager.mode : this.snapshot.getGameMode();
  }

  _isRegionReachable(regionName) {
    if (this.manager) {
      return this.manager.isRegionReachable(regionName);
    }
    if (this.snapshot) {
      // This will now correctly return true, false, or undefined from the snapshot interface
      return this.snapshot.isRegionReachable(regionName);
    }
    return undefined; // Default to unknown if no context
  }

  // Internal helper for location accessibility, handling both contexts
  _isLocationAccessible(locationOrName) {
    if (this.manager) {
      // StateManager expects the location object
      const location =
        typeof locationOrName === 'string'
          ? this.manager.locations?.find((l) => l.name === locationOrName)
          : locationOrName;
      return location ? this.manager.isLocationAccessible(location) : false;
    } else if (this.snapshot) {
      // Snapshot interface expects the location name (or handles object? Check interface)
      const locationName =
        typeof locationOrName === 'object'
          ? locationOrName.name
          : locationOrName;
      // This will now correctly return true, false, or undefined from the snapshot interface
      return this.snapshot.isLocationAccessible(locationName);
    }
    return undefined; // No valid context
  }

  _getPlayerSlot() {
    return this.manager
      ? this.manager.playerSlot
      : this.snapshot.getPlayerSlot();
  }

  _getDifficultyRequirements() {
    return this.manager
      ? this.manager.state?.difficultyRequirements
      : this.snapshot.getDifficultyRequirements();
  }

  _getShops() {
    return this.manager ? this.manager.state?.shops : this.snapshot.getShops();
  }

  _getRegionData(regionName) {
    return this.manager
      ? this.manager.regions
        ? this.manager.regions[regionName]
        : undefined
      : this.snapshot.getRegionData(regionName);
  }

  // --- Original Helper Methods (Now use internal accessors) ---

  is_not_bunny(region) {
    if (this._hasItem('Moon Pearl')) {
      return true;
    }
    // In snapshot mode, _getRegionData might be less reliable or not present
    // depending on what's in staticData vs. what needs live computation.
    const regionData =
      typeof region === 'string' ? this._getRegionData(region) : region;

    if (!regionData) {
      if (this.snapshot) return undefined; // Cannot determine without region data
      return true; // Worker default might differ, but snapshot needs to be cautious
    }

    const gameMode = this._getGameMode();
    if (gameMode === undefined && this.snapshot) return undefined; // Critical info missing

    const isInverted = gameMode === 'inverted';
    return isInverted ? regionData.is_dark_world : regionData.is_light_world;
  }

  can_bomb_clip(region) {
    return (
      this.can_use_bombs() &&
      this.is_not_bunny(region) &&
      this._hasItem('Pegasus Boots')
    );
  }

  can_buy_unlimited(item) {
    const shops = this._getShops() || [];
    for (const shop of shops) {
      const shopRegion = shop.region_name;
      if (!shopRegion || !this._isRegionReachable(shopRegion)) {
        continue;
      }
      if (shop.inventory) {
        for (const shopItem of shop.inventory) {
          if (
            shopItem.item === item &&
            (shopItem.max === 0 || shopItem.max > 99)
          ) {
            return true;
          }
        }
      }
    }
    if (item === 'Green Potion' || item === 'Blue Potion') {
      return this._isRegionReachable('Potion Shop');
    }
    return false;
  }

  can_buy(item) {
    const shops = this._getShops() || [];
    for (const shop of shops) {
      const shopRegion = shop.region_name;
      if (!shopRegion || !this._isRegionReachable(shopRegion)) {
        continue;
      }
      if (shop.inventory) {
        for (const shopItem of shop.inventory) {
          if (shopItem.item === item && shopItem.max !== 0) {
            return true;
          }
        }
      }
    }
    if (item === 'Single Arrow') {
      return this._isRegionReachable('Kakariko Shop');
    }
    return false;
  }

  can_shoot_arrows(count = 0) {
    const hasBow = this._hasItem('Bow') || this._hasItem('Silver Bow');
    if (!hasBow) return false;

    const retroBowFlag = this._hasFlag('retro_bow');
    const retroBowSetting = this._getSetting('retro_bow');

    if (this.snapshot) {
      // If any critical info for retro_bow logic is missing from snapshot, return undefined
      if (retroBowFlag === undefined && retroBowSetting === undefined) {
        // If both are undefined, we can't determine retro bow status for sure
        // However, if one is defined, we can proceed with that known value.
        // This logic assumes that if 'retro_bow' setting is explicitly false, it overrides the flag.
        // And if flag is explicitly true, it might override a missing setting.
        // For maximum caution, if *either* is undefined and might be needed, we could return undefined.
        // Let's assume if *both* are undefined, then it's unknown.
        // If retroBowSetting is explicitly false, that takes precedence.
        if (retroBowSetting === false) {
          // Not retro bow, proceed to can_hold_arrows
        } else {
          // log('warn', '[ALTTPHelpers Snapshot] can_shoot_arrows: retro_bow status uncertain due to undefined flag/setting.');
          return undefined;
        }
      }
    }

    // Determine if retro bow mode is active
    let isRetroBowActive = false;
    if (retroBowSetting !== undefined) {
      isRetroBowActive = retroBowSetting; // Setting takes precedence
    } else if (retroBowFlag !== undefined) {
      isRetroBowActive = retroBowFlag;
    }

    if (isRetroBowActive) {
      const canBuyArrows = this.can_buy('Single Arrow');
      if (canBuyArrows === undefined && this.snapshot) return undefined;
      return hasBow && canBuyArrows;
    }

    const canHold = this.can_hold_arrows(count);
    if (canHold === undefined && this.snapshot) return undefined;
    return hasBow && canHold;
  }

  has_triforce_pieces() {
    const requiredCountSetting = this._getSetting('triforce_goal_pieces');

    if (this.snapshot) {
      if (requiredCountSetting === undefined) {
        // log('warn', '[ALTTPHelpers Snapshot] has_triforce_pieces: triforce_goal_pieces setting is undefined.');
        return undefined; // Cannot determine if setting is unknown
      }
      // If goal is 0, it typically means the goal is met or it's not a triforce hunt.
      // The rule should be true if the goal is 0 (no pieces required).
      if (requiredCountSetting === null || requiredCountSetting <= 0) {
        return true;
      }
      const currentCount = this._countItem('Triforce Piece');
      if (currentCount === undefined) {
        // log('warn', '[ALTTPHelpers Snapshot] has_triforce_pieces: _countItem(\\"Triforce Piece\\") returned undefined.');
        return undefined;
      }
      return currentCount >= requiredCountSetting;
    } else {
      // Worker logic
      if (
        requiredCountSetting === undefined ||
        requiredCountSetting === null ||
        requiredCountSetting <= 0
      ) {
        // In worker context, if the goal is 0 or not set, this specific path to victory isn't active via this rule.
        // Or, if it means 0 pieces are required, then the condition is true.
        // Let's align with snapshot: if 0 required, it's true.
        return true;
      }
      const currentCount = this.manager.inventory.count('Triforce Piece');
      return currentCount >= requiredCountSetting;
    }
  }

  has_crystals(count) {
    if (this.snapshot) {
      let requiredCrystals;
      // If 'count' is explicitly provided as a number, that's the requirement for this specific rule call.
      if (typeof count === 'number') {
        requiredCrystals = count;
      } else {
        // If no explicit count, attempt to infer from common settings.
        // This part is heuristic as rules might not always align with these specific settings.
        // A rule saying `has_crystals()` without a count might imply GT access.
        requiredCrystals = this._getSetting('crystals_needed_for_gt'); // Default to GT
        if (requiredCrystals === undefined) {
          // Fallback or further specific logic if 'crystals_needed_for_gt' isn't defined.
          // For Ganon's Tower itself (which usually requires all 7), a rule might pass count=7.
          // If a rule implies Ganon entry without a count, it's ambiguous without more context.
          // For now, if 'crystals_needed_for_gt' is undefined, we can't make a firm decision.
          // log('warn', '[ALTTPHelpers Snapshot] has_crystals: crystals_needed_for_gt setting is undefined, and no explicit count provided.');
          return undefined;
        }
      }

      if (requiredCrystals === undefined) {
        // This case implies 'count' was not a number and primary setting lookups also yielded undefined.
        // log('warn', '[ALTTPHelpers Snapshot] has_crystals: Could not determine required crystal count.');
        return undefined;
      }

      const currentCrystals = this._countGroup('Crystal');
      if (currentCrystals === undefined) {
        // log('warn', '[ALTTPHelpers Snapshot] has_crystals: _countGroup(\\"Crystal\\") returned undefined.');
        return undefined;
      }
      return currentCrystals >= requiredCrystals;
    } else {
      // Worker (original) logic
      const num_crystals = this.manager.inventory.countGroup('Crystal');
      let required = 7; // Default for things like Ganon's Tower if no count/setting specified by rule

      // If the rule passes a specific count, that count is the requirement for that rule instance.
      if (typeof count === 'number') {
        required = count;
      } else {
        // If no count passed, try to use game settings for GT or Ganon.
        // This depends on the context of the rule calling has_crystals().
        // Some rules imply GT (usually 7), some Ganon (usually also 7, or all dungeon crystals).
        // For simplicity, if count isn't given, rules often check against GT requirements.
        const gtCrystals = this._getSetting('crystals_needed_for_gt');
        if (typeof gtCrystals === 'number') {
          required = gtCrystals;
        }
        // A rule for Ganon might look like has_crystals(get_setting('crystals_needed_for_ganon'))
        // or simply has_crystals(7) if Ganon always needs 7.
        // The 'count' parameter is key if the rule is specific.
      }
      return num_crystals >= required;
    }
  }

  can_lift_rocks() {
    if (this.snapshot) {
      const hasPowerGlove = this._hasItem('Power Glove');
      // If Power Glove is definitively true, result is true
      if (hasPowerGlove === true) return true;

      const hasTitansMitts = this._hasItem('Titans Mitts');
      // If Titans Mitts is definitively true, result is true
      if (hasTitansMitts === true) return true;

      // If neither was definitively true, but at least one was undefined, the result is uncertain.
      if (hasPowerGlove === undefined || hasTitansMitts === undefined) {
        return undefined;
      }
      // Otherwise, both were definitively false.
      return false;
    } else {
      // Worker logic
      return (
        this.manager.inventory.has('Power Glove') ||
        this.manager.inventory.has('Titans Mitts')
      );
    }
  }

  can_lift_heavy_rocks() {
    if (this.snapshot) {
      // _hasItem will return true, false, or undefined if the snapshot.hasItem does.
      return this._hasItem('Titans Mitts');
    } else {
      // Worker logic
      return this.manager.inventory.has('Titans Mitts');
    }
  }

  bottle_count() {
    const difficultyRequirements = this._getDifficultyRequirements() || {};
    const bottleLimit = difficultyRequirements.progressive_bottle_limit ?? 4;
    return Math.min(bottleLimit, this._countGroup('Bottles'));
  }

  has_hearts(count) {
    return this.heart_count() >= count;
  }

  heart_count() {
    const difficultyRequirements = this._getDifficultyRequirements() || {};
    const bossHeartLimit =
      difficultyRequirements.boss_heart_container_limit ?? 10;
    const heartPieceLimit = difficultyRequirements.heart_piece_limit ?? 24;

    const bossHearts = Math.min(
      this._countItem('Boss Heart Container'),
      bossHeartLimit
    );
    const sanctuaryHearts = this._countItem('Sanctuary Heart Container');
    const pieceHearts = Math.floor(
      Math.min(this._countItem('Piece of Heart'), heartPieceLimit) / 4
    );

    return bossHearts + sanctuaryHearts + pieceHearts + 3;
  }

  can_extend_magic(smallmagic = 16, fullrefill = false) {
    let basemagic = 8;
    if (this._hasItem('Magic Upgrade (1/4)')) {
      basemagic = 32;
    } else if (this._hasItem('Magic Upgrade (1/2)')) {
      basemagic = 16;
    }

    if (
      this.can_buy_unlimited('Green Potion') ||
      this.can_buy_unlimited('Blue Potion')
    ) {
      const bottleCount = this.bottle_count();
      const functionality = this._getSetting('item_functionality') || 'normal';

      if (functionality === 'hard' && !fullrefill) {
        basemagic += Math.floor(basemagic * 0.5 * bottleCount);
      } else if (functionality === 'expert' && !fullrefill) {
        basemagic += Math.floor(basemagic * 0.25 * bottleCount);
      } else {
        basemagic += basemagic * bottleCount;
      }
    }
    return basemagic >= smallmagic;
  }

  can_hold_arrows(quantity = 0) {
    if (this._getSetting('shuffle_capacity_upgrades')) {
      if (quantity === 0) return true;
      let arrows = 30;
      if (this._hasItem('Arrow Upgrade (70)')) {
        arrows = 70;
      } else {
        arrows += this._countItem('Arrow Upgrade (+5)') * 5;
        arrows += this._countItem('Arrow Upgrade (+10)') * 10;
        const extraUpgrades = Math.max(
          0,
          this._countItem('Arrow Upgrade (+5)') - 6
        );
        arrows += extraUpgrades * 10;
      }
      return Math.min(70, arrows) >= quantity;
    }
    return quantity <= 30 || this._hasItem('Capacity Upgrade Shop');
  }

  can_use_bombs() {
    // Combined version
    if (this._getSetting('shuffle_capacity_upgrades')) {
      if (this._hasItem('Bomb Upgrade (70)')) return true;
      let bombs = 10;
      bombs += this._countItem('Bomb Upgrade (+5)') * 5;
      bombs += this._countItem('Bomb Upgrade (+10)') * 10;
      const extraUpgrades = Math.max(
        0,
        this._countItem('Bomb Upgrade (+5)') - 6
      );
      bombs += extraUpgrades * 10;
      return Math.min(50, bombs) > 0;
    } else {
      // Original logic if not shuffling capacity
      const bombless = this._hasFlag('bombless_start');
      if (bombless) return false; // Cannot use if bombless start and no upgrades

      // Check if bombs are buyable or if capacity upgrade exists
      return (
        this.can_buy('Single Bomb') || this._hasItem('Capacity Upgrade Shop')
      );
    }
  }

  can_bomb_or_bonk() {
    return this._hasItem('Pegasus Boots') || this.can_use_bombs(); // Use the unified can_use_bombs
  }

  can_activate_crystal_switch() {
    return (
      this.has_melee_weapon() ||
      this.can_use_bombs() ||
      this.can_shoot_arrows() ||
      this._hasItem('Hookshot') ||
      this._hasItem('Cane of Somaria') ||
      this._hasItem('Cane of Byrna') ||
      this._hasItem('Fire Rod') ||
      this._hasItem('Ice Rod') ||
      this._hasItem('Blue Boomerang') ||
      this._hasItem('Red Boomerang')
    );
  }

  can_kill_most_things(count = 5) {
    if (this.snapshot) {
      // Snapshot-aware logic
      let canKill = false;
      let potentialUnknown = false;

      const hasSwordResult = this.has_sword(); // Snapshot-aware
      if (hasSwordResult === undefined) potentialUnknown = true;
      if (hasSwordResult === true) canKill = true;

      if (!canKill && !potentialUnknown) {
        // Only proceed if not already true and no unknowns yet
        if (this._hasItem('Cane of Somaria')) canKill = true; // Direct item check
      }

      if (!canKill && !potentialUnknown) {
        if (this._hasItem('Cane of Byrna')) {
          // Direct item check
          if (count < 6) {
            canKill = true;
          } else {
            const canExtend = this.can_extend_magic(); // Snapshot-aware
            if (canExtend === undefined) potentialUnknown = true;
            else if (canExtend === true) canKill = true;
          }
        }
      }

      if (!canKill && !potentialUnknown) {
        const canShoot = this.can_shoot_arrows(); // Snapshot-aware
        if (canShoot === undefined) potentialUnknown = true;
        else if (canShoot === true) canKill = true;
      }

      if (!canKill && !potentialUnknown) {
        if (this._hasItem('Fire Rod')) canKill = true; // Direct item check
      }

      if (!canKill && !potentialUnknown) {
        const canBombs = this.can_use_bombs(); // Snapshot-aware
        if (canBombs === undefined) potentialUnknown = true;
        else if (canBombs === true) canKill = true;
      }

      if (canKill) return true;
      if (potentialUnknown) return undefined;
      return false;
    } else {
      // Worker Context (original logic)
      return (
        this.has_melee_weapon() ||
        this._hasItem('Cane of Somaria') ||
        (this._hasItem('Cane of Byrna') &&
          (count < 6 || this.can_extend_magic())) ||
        this.can_shoot_arrows() ||
        this._hasItem('Fire Rod') ||
        this.can_use_bombs() // Pass count? Needs clarification how count interacts with bomb usage
      );
    }
  }

  can_get_good_bee() {
    // log('warn',
    //   '[ALTTPHelpers] can_get_good_bee not fully refactored for snapshot interface yet.'
    // );
    return this._hasItem('Bug Catching Net') && this._hasItem('Bottle'); // Simplistic, may need more nuance for snapshot
  }

  can_retrieve_tablet() {
    // log('warn',
    //   '[ALTTPHelpers] can_retrieve_tablet not fully refactored for snapshot interface yet.'
    // );
    return (
      this.has_sword() >= 2 && // Master Sword or better
      this._hasItem('Book of Mudora')
    );
  }

  has_sword() {
    if (this.snapshot) {
      const fighter = this._hasItem('Fighter Sword');
      if (fighter === true) return true;
      const master = this._hasItem('Master Sword');
      if (master === true) return true;
      const tempered = this._hasItem('Tempered Sword');
      if (tempered === true) return true;
      const golden = this._hasItem('Golden Sword');
      if (golden === true) return true;

      if (
        fighter === undefined ||
        master === undefined ||
        tempered === undefined ||
        golden === undefined
      ) {
        return undefined;
      }
      return false;
    } else {
      // Worker logic
      return (
        this.manager.inventory.has('Fighter Sword') ||
        this.manager.inventory.has('Master Sword') ||
        this.manager.inventory.has('Tempered Sword') ||
        this.manager.inventory.has('Golden Sword')
      );
    }
  }

  has_beam_sword() {
    // log('warn',
    //   '[ALTTPHelpers] has_beam_sword not fully refactored for snapshot interface yet.'
    // );
    return (
      this._hasItem('Master Sword') ||
      this._hasItem('Tempered Sword') ||
      this._hasItem('Golden Sword')
    );
  }

  has_melee_weapon() {
    // This is a simple check, _hasItem handles context.
    return this._hasItem('Hammer') || this.has_sword();
  }

  has_fire_source() {
    if (this.snapshot) {
      const fireRod = this._hasItem('Fire Rod');
      if (fireRod === true) return true;
      const lamp = this._hasItem('Lamp');
      if (lamp === true) return true;

      if (fireRod === undefined || lamp === undefined) {
        return undefined;
      }
      return false;
    } else {
      // Worker logic
      return (
        this.manager.inventory.has('Fire Rod') ||
        this.manager.inventory.has('Lamp')
      );
    }
  }

  can_melt_things() {
    return (
      this._hasItem('Fire Rod') ||
      (this._hasItem('Bombos') &&
        (this._hasFlag('swordless') || this.has_sword()))
    );
  }

  has_misery_mire_medallion() {
    // TODO: Fix requiredMedallions access
    const gameSettings =
      (this._getSetting('misery_mire_medallion') ||
        this._getSetting('crystals_needed_for_gt')) ??
      7;
    const requiredMeds =
      this._getSetting('requiredMedallions') ||
      this._getSetting('crystals_needed_for_gt')?.[0] ||
      'Ether';
    const medallion =
      gameSettings?.misery_mire_medallion || requiredMeds?.[0] || 'Ether';
    return this._hasItem(medallion);
  }

  has_turtle_rock_medallion() {
    // TODO: Fix requiredMedallions access
    const gameSettings =
      (this._getSetting('turtle_rock_medallion') ||
        this._getSetting('crystals_needed_for_gt')) ??
      7;
    const requiredMeds =
      this._getSetting('requiredMedallions') ||
      this._getSetting('crystals_needed_for_gt')?.[1] ||
      'Quake';
    const medallion =
      gameSettings?.turtle_rock_medallion || requiredMeds?.[1] || 'Quake';
    return this._hasItem(medallion);
  }

  can_boots_clip_lw() {
    if (this._getGameMode() === 'inverted') {
      return this._hasItem('Pegasus Boots') && this._hasItem('Moon Pearl');
    }
    return this._hasItem('Pegasus Boots');
  }

  can_boots_clip_dw() {
    if (this._getGameMode() !== 'inverted') {
      return this._hasItem('Pegasus Boots') && this._hasItem('Moon Pearl');
    }
    return this._hasItem('Pegasus Boots');
  }

  can_get_glitched_speed_dw() {
    const hasRequiredItems = [
      this._hasItem('Pegasus Boots'),
      this._hasItem('Hookshot') || this.has_sword(),
    ];
    if (this._getGameMode() !== 'inverted') {
      hasRequiredItems.push(this._hasItem('Moon Pearl'));
    }
    return hasRequiredItems.every(Boolean);
  }

  item_name_in_location_names(itemName, locationNames) {
    if (typeof itemName !== 'string' || !Array.isArray(locationNames)) {
      log(
        'warn',
        '[ALTTPHelpers] item_name_in_location_names: Invalid arguments.',
        { itemName, locationNames }
      );
      return this.snapshot ? undefined : false; // Unknown for snapshot, false for worker
    }

    let allLocationsArray = null;

    if (this.snapshot) {
      // Ensure staticData and staticData.locations are available on the snapshot interface
      const staticLocations = this.snapshot.getStaticData
        ? this.snapshot.getStaticData()?.locations
        : this.snapshot.staticData?.locations;
      if (staticLocations) {
        allLocationsArray = Array.isArray(staticLocations)
          ? staticLocations
          : Object.values(staticLocations);
      } else {
        log(
          'warn',
          '[ALTTPHelpers Snapshot] item_name_in_location_names: staticData.locations not available on snapshot interface.'
        );
        return undefined; // Cannot proceed without location data
      }
    } else {
      // Worker context
      if (!this.manager || !this.manager.locations) {
        log(
          'warn',
          '[ALTTPHelpers Worker] item_name_in_location_names: StateManager or locations not available.'
        );
        return false; // Original worker behavior
      }
      // Assuming this.manager.locations is already an array of location objects
      allLocationsArray = this.manager.locations;
    }

    if (!allLocationsArray) {
      log(
        'warn',
        '[ALTTPHelpers] item_name_in_location_names: Failed to obtain locations array.'
      );
      return this.snapshot ? undefined : false;
    }

    const targetLocations = allLocationsArray.filter(
      (loc) =>
        loc && typeof loc.name === 'string' && locationNames.includes(loc.name)
    );

    for (const location of targetLocations) {
      let currentItemName = null;
      if (
        location.item &&
        typeof location.item === 'object' &&
        typeof location.item.name === 'string'
      ) {
        currentItemName = location.item.name;
      } else if (typeof location.item === 'string') {
        currentItemName = location.item;
      }

      if (currentItemName === itemName) {
        return true;
      }
    }
    return false; // If not found after checking all target locations
  }

  old_man() {
    // Use snapshot interface method if available, otherwise manager method
    if (this._isLocationAccessible) {
      return this._isLocationAccessible('Old Man');
    } else {
      // manager.isLocationAccessible needs context (location object)
      const location = this.manager.locations?.find(
        (l) => l.name === 'Old Man'
      );
      return location ? this._isLocationAccessible(location) : false;
    }
  }

  basement_key_rule() {
    log(
      'warn',
      '[ALTTPHelpers] basement_key_rule needs refactoring for snapshot/manager context.'
    );
    // Requires location_item_name which needs refactoring
    return false; // Placeholder
  }

  cross_peg_bridge() {
    return this._hasItem('Hammer') && this._hasItem('Moon Pearl');
  }

  // ... Glitch placeholders ...

  can_reach(target, type = 'Region', player = 1) {
    // This is a prime candidate for returning undefined in snapshot mode
    // as true reachability is a complex calculation.
    if (this.snapshot) {
      // Use the snapshot interface's limited reachability check
      if (type === 'Region') {
        return this.snapshot.isRegionReachable(target);
      }
      if (type === 'Location') {
        return this.snapshot.isLocationAccessible(target);
      }
      return undefined; // Unknown for other types or if methods don't exist
    }

    // Worker context (original logic)
    if (!this.manager || typeof this.manager.canReach !== 'function') {
      log(
        'error',
        '[ALTTPHelpers can_reach] StateManager or canReach method not available in worker context.'
      );
      return false; // Or throw error
    }
    return this.manager.canReach(target, type, player);
  }

  _lttp_has_key(key, playerParam, count = 1) {
    if (this._getPlayerSlot() !== playerParam) {
      return false;
    }
    return this._countItem(key) >= count;
  }

  lttp_has_key(key, playerParam, count = 1) {
    return this._lttp_has_key(key, playerParam, count);
  }

  GanonDefeatRule() {
    // log('warn',
    //   '[ALTTPHelpers] GanonDefeatRule not fully refactored for snapshot interface.'
    // );

    if (this.snapshot) {
      // Snapshot-specific logic for GanonDefeatRule
      const requiredCrystals = this._getSetting('crystals_needed_for_gt'); // Assuming GT crystals are Ganon's requirement
      const requiredTriforce = this._getSetting('triforce_goal_pieces');

      // If critical settings are undefined in snapshot, we can't evaluate
      if (requiredCrystals === undefined || requiredTriforce === undefined) {
        log(
          'warn',
          '[ALTTPHelpers GanonDefeatRule Snapshot] Critical settings (crystals_needed_for_gt or triforce_goal_pieces) undefined in snapshot.'
        );
        return undefined;
      }

      const hasCrystalsResult = this.has_crystals(requiredCrystals);
      if (hasCrystalsResult === undefined) return undefined; // Propagate unknown
      if (!hasCrystalsResult) return false;

      if (requiredTriforce > 0) {
        const hasTriforceResult = this.has_triforce_pieces();
        if (hasTriforceResult === undefined) return undefined; // Propagate unknown
        if (!hasTriforceResult) return false;
      }

      const vulnerableSetting = this._getSetting('ganon_vulnerable');
      if (vulnerableSetting === undefined) {
        log(
          'warn',
          '[ALTTPHelpers GanonDefeatRule Snapshot] ganon_vulnerable setting undefined in snapshot.'
        );
        return undefined;
      }

      if (vulnerableSetting === 'silver') {
        const canShoot = this.can_shoot_arrows();
        if (canShoot === undefined) return undefined;
        // Silver Bow is a direct item check, should be fine
        return canShoot && this._hasItem('Silver Bow');
      } else if (vulnerableSetting === 'silverless') {
        // Assume sword or hammer. These helpers should be snapshot-aware.
        const hasSwordResult = this.has_sword();
        if (hasSwordResult === undefined) return undefined;
        const hasHammerResult = this._hasItem('Hammer'); // Direct item check
        if (hasSwordResult || hasHammerResult) return true;
        // If neither, and they didn't return undefined, it means we don't have them.
        // However, can_kill_most_things might be an alternative for some settings.
        // For simplicity in snapshot, if sword/hammer fails, and vulnerableSetting isn't 'silver', return based on sword/hammer.
        // This might need refinement based on exact game logic for other ganon_vulnerable settings.
        return false;
      }
      // Other ganon_vulnerable settings might be more complex for snapshot
      // For now, if not 'silver' or 'silverless', and we are in snapshot, consider it unknown.
      log(
        'warn',
        `[ALTTPHelpers GanonDefeatRule Snapshot] Unhandled ganon_vulnerable setting '${vulnerableSetting}' in snapshot mode.`
      );
      return undefined;
    } else {
      // Worker context (original logic - can be more complex)
      const requiredCrystals = this._getSetting('crystals_needed_for_gt') ?? 7;
      const requiredTriforce = this._getSetting('triforce_goal_pieces') ?? 0;

      if (!this.has_crystals(requiredCrystals)) return false;
      if (requiredTriforce > 0 && !this.has_triforce_pieces()) return false;

      const vulnerableSetting = this._getSetting('ganon_vulnerable');
      if (vulnerableSetting === 'silver') {
        return this.can_shoot_arrows() && this._hasItem('Silver Bow');
      }
      // TODO: Add other conditions for worker context based on full StateManager access
      // This part might need to be more elaborate in the worker, e.g. checking can_kill_ganon() helper if it exists
      return this.has_sword() || this._hasItem('Hammer');
    }
  }

  has_any(items, playerId) {
    if (!Array.isArray(items)) {
      log('warn', 'has_any called with non-array items:', items);
      return false;
    }
    if (
      playerId !== undefined &&
      playerId !== null &&
      this._getPlayerSlot() !== playerId
    ) {
      return false;
    }
    return items.some((item) => this._hasItem(item));
  }

  // --- Utility helpers often found in Python-based rule engines ---
  len(arr) {
    if (this.snapshot) {
      if (arr === undefined) {
        // log('warn', '[ALTTPHelpers Snapshot] len() called with undefined array.');
        return undefined; // If the array itself is unknown, its length is unknown
      }
    }
    // In worker mode, or if arr is defined in snapshot mode:
    if (!Array.isArray(arr)) {
      // log('warn', '[ALTTPHelpers] len() called with non-array.', arr);
      // Depending on strictness, could return undefined for snapshot, or 0 / error for worker.
      return this.snapshot ? undefined : 0;
    }
    return arr.length;
  }

  // Placeholder for zip if needed, more complex to implement fully
  zip(...arrays) {
    // log('warn', '[ALTTPHelpers] zip() helper not fully implemented for snapshot.');
    if (this.snapshot) {
      if (arrays.some((arr) => arr === undefined)) return undefined;
      if (!arrays.every((arr) => Array.isArray(arr))) return undefined;
    }
    if (!arrays.every((arr) => Array.isArray(arr))) return []; // Worker: return empty for invalid input

    const shortest = arrays.reduce(
      (min, arr) => Math.min(min, arr.length),
      Infinity
    );
    const result = [];
    for (let i = 0; i < shortest; i++) {
      result.push(arrays.map((arr) => arr[i]));
    }
    return result;
  }

  // Placeholder for getattr if needed, complex due to object resolution
  getattr(obj, attr, defaultValue = undefined) {
    // log('warn', '[ALTTPHelpers] getattr() helper not fully implemented for snapshot.');
    if (this.snapshot) {
      if (obj === undefined) return undefined;
      // Very simplistic getattr for snapshot, doesn't handle nested paths
      // or special resolution like evaluateRule does for 'attribute' type.
      return obj[attr] !== undefined ? obj[attr] : defaultValue;
    }
    // Worker mode can be more robust if needed
    return obj && obj[attr] !== undefined ? obj[attr] : defaultValue;
  }

  shop_price_rules(locationOrName) {
    log(
      'warn',
      '[ALTTPHelpers] shop_price_rules needs context-aware implementation.'
    );
    return true; // Placeholder
  }

  _findLocationByName(locationName) {
    if (this.manager) {
      return this.manager.locations?.find((l) => l.name === locationName);
    } else {
      log(
        'warn',
        '[ALTTPHelpers] _findLocationByName not available in snapshot context.'
      );
      return null;
    }
  }

  enhanceLocationsWithShopData() {
    log(
      'info',
      '[ALTTPHelpers] enhanceLocationsWithShopData called (now uses context)'
    );

    // When running in worker, access manager directly.
    // When running in main thread (snapshot), this data isn't available in snapshot, so skip.
    if (!this.manager) {
      log(
        'info',
        '[ALTTPHelpers] Skipping enhanceLocationsWithShopData - no direct manager access (expected in main thread).'
      );
      return;
    }

    const stateManager = this.manager;
    if (
      !stateManager.locations ||
      !stateManager.state ||
      !stateManager.state.shops
    ) {
      log(
        'warn',
        '[ALTTPHelpers] Cannot enhance locations: missing locations or shop data on StateManager instance.'
      );
      return;
    }

    stateManager.locations.forEach((location) => {
      if (location.shop_item_name) {
        const shopData = stateManager.state.shops.find(
          (s) => s.region_name === location.region
        );
        if (shopData && shopData.inventory) {
          const shopItem = shopData.inventory.find(
            (si) => si.item === location.shop_item_name
          );
          if (shopItem) {
            // Add relevant shop details directly to the location object
            location.cost = shopItem.price || 0;
            location.max = shopItem.max || 0;
            location.player_id = shopItem.player_id ?? stateManager.playerSlot;
            location.shop_slot = shopItem.slot || null;
            location.shop_provided_item = shopItem.item || null;
          }
        }
      }
    });
  }

  location_item_name(locationName) {
    // log('warn',
    //   '[ALTTPHelpers] location_item_name needs context-aware implementation.'
    // );
    // TODO: Access location data via this.manager or this.snapshot
    // Example using manager:
    if (this.manager) {
      const location = this.manager.locations?.find(
        (loc) => loc.name === locationName
      );
      return location?.item?.name ?? null;
    } else if (
      this.manager &&
      typeof this.manager.getAllLocations === 'function'
    ) {
      // Use getAllLocations if available on the snapshot interface
      log(
        'info',
        '[ALTTPHelpers] location_item_name: Using snapshot.getAllLocations...'
      );
      const locations = this.manager.getAllLocations();
      log(
        'info',
        '[ALTTPHelpers] location_item_name: getAllLocations returned:',
        locations ? locations.length + ' locations' : 'null/undefined'
      );
      const location = locations?.find((loc) => loc.name === locationName);
      log(
        'info',
        '[ALTTPHelpers] location_item_name: Found location:',
        location?.name
      );
      return location?.item?.name ?? null;
    }
    // If we reach here, neither manager nor snapshot context provided the location data.
    // log('warn', '[ALTTPHelpers] location_item_name could not find location data in current context.');
    return null;
  }

  executeHelper(name, ...args) {
    if (typeof this[name] === 'function') {
      try {
        // The called helper (e.g., this.can_shoot_arrows()) will internally check
        // this.snapshot and return true/false or undefined.
        return this[name](...args);
      } catch (e) {
        log('error', `Error executing helper ${name}:`, e);
        // If a helper throws an error during snapshot evaluation, treat as unknown.
        if (this.snapshot) return undefined;
        throw e; // Re-throw in worker context
      }
    }
    log('warn', `Helper ${name} not found in ALTTPHelpers.`);
    return this.snapshot ? undefined : false; // Default to unknown for snapshot, false for worker
  }
}
