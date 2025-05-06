import { GameHelpers } from '../../helpers/index.js';

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
    if (context && typeof context.getSnapshot === 'function') {
      console.log(
        '[ALTTPHelpers] Initializing with StateManager instance (Worker context).'
      );
      this.manager = context;
    } else if (context && typeof context.hasItem === 'function') {
      console.log(
        '[ALTTPHelpers] Initializing with StateSnapshotInterface (Main thread context).'
      );
      this.snapshot = context;
    } else {
      console.error(
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
    return this.manager
      ? this.manager.isRegionReachable(regionName)
      : this.snapshot.isRegionReachable(regionName);
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
      return this.snapshot.isLocationAccessible(locationName); // Assuming snapshot can take name
    }
    return false; // No valid context
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
    const regionData =
      typeof region === 'string' ? this._getRegionData(region) : region;
    if (!regionData) return true; // Default true if region data missing?

    const isInverted = this._getGameMode() === 'inverted';
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

    if (this._hasFlag('retro_bow') || this._getSetting('retro_bow')) {
      return hasBow && this.can_buy('Single Arrow');
    }
    return hasBow && this.can_hold_arrows(count);
  }

  has_triforce_pieces() {
    const requiredCount = this._getSetting('triforce_goal_pieces');
    if (requiredCount === undefined || requiredCount === null) return false;

    const triforceCount = this._countItem('Triforce Piece');
    const powerStarCount = this._countItem('Power Star');
    return triforceCount + powerStarCount >= requiredCount;
  }

  has_crystals(count) {
    const requiredCount = count === undefined ? 7 : count;
    return this._countGroup('Crystals') >= requiredCount;
  }

  can_lift_rocks() {
    return this._hasItem('Power Glove') || this._hasItem('Titans Mitts');
  }

  can_lift_heavy_rocks() {
    return this._hasItem('Titans Mitts');
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

  can_get_good_bee() {
    const caveAccessible = this._isRegionReachable('Good Bee Cave');
    return (
      this._countGroup('Bottles') > 0 &&
      this._hasItem('Bug Catching Net') &&
      (this._hasItem('Pegasus Boots') ||
        (this.has_sword() && this._hasItem('Quake'))) &&
      caveAccessible &&
      this.is_not_bunny({ is_light_world: true, is_dark_world: false })
    );
  }

  can_retrieve_tablet() {
    const hasBookOfMudora = this._hasItem('Book of Mudora');
    if (!hasBookOfMudora) return false;

    const hasSword = this.has_beam_sword();
    const isSwordlessMode = this._hasFlag('swordless');
    const hasHammer = this._hasItem('Hammer');
    return hasSword || (isSwordlessMode && hasHammer);
  }

  has_sword() {
    return (
      this._hasItem('Fighter Sword') ||
      this._hasItem('Master Sword') ||
      this._hasItem('Tempered Sword') ||
      this._hasItem('Golden Sword')
    );
  }

  has_beam_sword() {
    return (
      this._hasItem('Master Sword') ||
      this._hasItem('Tempered Sword') ||
      this._hasItem('Golden Sword')
    );
  }

  has_melee_weapon() {
    return this.has_sword() || this._hasItem('Hammer');
  }

  has_fire_source() {
    return this._hasItem('Fire Rod') || this._hasItem('Lamp');
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
    if (!this.manager || !this.manager.locations) {
      console.warn(
        '[ALTTPHelpers] item_name_in_location_names: StateManager or locations not available.'
      );
      return false;
    }

    if (typeof itemName !== 'string' || !Array.isArray(locationNames)) {
      console.warn(
        '[ALTTPHelpers] item_name_in_location_names: Invalid arguments.',
        { itemName, locationNames }
      );
      return false;
    }

    const targetLocations = this.manager.locations.filter((loc) =>
      locationNames.includes(loc.name)
    );

    for (const location of targetLocations) {
      if (location.item === itemName) {
        return true;
      }
    }

    return false;
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
    console.warn(
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
    if (player !== this._getPlayerSlot()) {
      return false;
    }
    try {
      if (type === 'Region') {
        return this._isRegionReachable(target);
      } else if (type === 'Location') {
        // Need location object for manager context, name for snapshot context
        if (this.manager) {
          const location = this.manager.locations?.find(
            (l) => l.name === target
          );
          return location ? this._isLocationAccessible(location) : false;
        } else {
          return this._isLocationAccessible(target); // Assumes snapshot handles name
        }
      } else if (type === 'Entrance') {
        console.warn(
          '[ALTTPHelpers.can_reach] Entrance checking needs context-aware implementation.'
        );
        // Placeholder:
        return false;
      }
    } catch (e) {
      console.error(
        `[ALTTPHelpers.can_reach] Error during check for ${target} (${type}):`,
        e
      );
      return false;
    }
    return false;
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
    console.warn(
      '[ALTTPHelpers] GanonDefeatRule not fully refactored for snapshot interface.'
    );
    const requiredCrystals = this._getSetting('crystals_needed_for_gt') ?? 7;
    const requiredTriforce = this._getSetting('triforce_goal_pieces') ?? 0;

    if (!this.has_crystals(requiredCrystals)) return false;
    if (requiredTriforce > 0 && !this.has_triforce_pieces()) return false;

    const vulnerableSetting = this._getSetting('ganon_vulnerable');
    if (vulnerableSetting === 'silver') {
      return this.can_shoot_arrows() && this._hasItem('Silver Bow');
    }
    // TODO: Add other conditions
    return this.has_sword() || this._hasItem('Hammer');
  }

  has_any(items, playerId) {
    if (!Array.isArray(items)) {
      console.warn('has_any called with non-array items:', items);
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

  // ... len, zip, getattr, range, all, any, to_bool ...

  shop_price_rules(locationOrName) {
    console.warn(
      '[ALTTPHelpers] shop_price_rules needs context-aware implementation.'
    );
    return true; // Placeholder
  }

  _findLocationByName(locationName) {
    if (this.manager) {
      return this.manager.locations?.find((l) => l.name === locationName);
    } else {
      console.warn(
        '[ALTTPHelpers] _findLocationByName not available in snapshot context.'
      );
      return null;
    }
  }

  enhanceLocationsWithShopData() {
    console.log(
      '[ALTTPHelpers] enhanceLocationsWithShopData called (now uses context)'
    );

    // When running in worker, access manager directly.
    // When running in main thread (snapshot), this data isn't available in snapshot, so skip.
    if (!this.manager) {
      console.log(
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
      console.warn(
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
    // console.warn(
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
      console.log(
        '[ALTTPHelpers] location_item_name: Using snapshot.getAllLocations...'
      );
      const locations = this.manager.getAllLocations();
      console.log(
        '[ALTTPHelpers] location_item_name: getAllLocations returned:',
        locations ? locations.length + ' locations' : 'null/undefined'
      );
      const location = locations?.find((loc) => loc.name === locationName);
      console.log(
        '[ALTTPHelpers] location_item_name: Found location:',
        location?.name
      );
      return location?.item?.name ?? null;
    }
    // If we reach here, neither manager nor snapshot context provided the location data.
    // console.warn('[ALTTPHelpers] location_item_name could not find location data in current context.');
    return null;
  }

  executeHelper(name, ...args) {
    if (typeof this[name] === 'function') {
      try {
        return this[name].apply(this, args);
      } catch (error) {
        console.error(`Error executing helper ${name}:`, error);
        return false;
      }
    } else {
      console.warn(`[ALTTPHelpers] Unknown helper function: ${name}`);
      return false;
    }
  }
}
