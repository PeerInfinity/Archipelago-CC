import { GameHelpers } from '../../helpers/index.js';

export class ALTTPHelpers extends GameHelpers {
  constructor(stateManagerInstance) {
    super();
    this.stateManager = stateManagerInstance;
  }

  // Following the same order as StateHelpers.py

  is_not_bunny(region) {
    if (this.stateManager.inventory.has('Moon Pearl')) {
      return true;
    }

    const isInverted = this.stateManager.state.gameMode === 'inverted';
    return isInverted ? region.is_dark_world : region.is_light_world;
  }

  can_bomb_clip(region) {
    return (
      this.can_use_bombs() &&
      this.is_not_bunny(region) &&
      this.stateManager.inventory.has('Pegasus Boots')
    );
  }

  can_buy_unlimited(item) {
    // This function checks if any accessible shop has an unlimited quantity of the item
    const shops = this.stateManager.state.shops || [];

    // Check all shops for unlimited items
    for (const shop of shops) {
      // Skip shops that can't be reached
      const shopRegion = shop.region_name;
      if (!shopRegion || !this.stateManager.isRegionReachable(shopRegion)) {
        continue;
      }

      // Check inventory for this item
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

    // Fallback to checking for the item availability in hardcoded shops
    if (item === 'Green Potion' || item === 'Blue Potion') {
      return this.stateManager.isRegionReachable('Potion Shop');
    }

    return false;
  }

  can_buy(item) {
    // This function checks if any accessible shop has the item in stock
    const shops = this.stateManager.state.shops || [];

    // Check all shops for the item
    for (const shop of shops) {
      // Skip shops that can't be reached
      const shopRegion = shop.region_name;
      if (!shopRegion || !this.stateManager.isRegionReachable(shopRegion)) {
        continue;
      }

      // Check inventory for this item
      if (shop.inventory) {
        for (const shopItem of shop.inventory) {
          if (shopItem.item === item && shopItem.max !== 0) {
            return true;
          }
        }
      }
    }

    // Fallback logic for specific items
    if (item === 'Single Arrow') {
      return this.stateManager.isRegionReachable('Kakariko Shop');
    }

    return false;
  }

  can_shoot_arrows(count = 0) {
    const hasBow =
      this.stateManager.inventory.has('Bow') ||
      this.stateManager.inventory.has('Silver Bow');

    if (!hasBow) return false;

    // Check retro bow flag or setting
    if (
      this.stateManager.state?.hasFlag('retro_bow') ||
      this.stateManager.state?.gameSettings?.retro_bow
    ) {
      return hasBow && this.can_buy('Single Arrow');
    }

    return hasBow && this.can_hold_arrows(count);
  }

  has_triforce_pieces() {
    // Get required count from state
    const requiredCount = this.stateManager.state.treasureHuntRequired;

    const triforceCount = this.stateManager.inventory.count('Triforce Piece');
    const powerStarCount = this.stateManager.inventory.count('Power Star');

    return triforceCount + powerStarCount >= requiredCount;
  }

  has_crystals(count) {
    // Default to 7 if count is undefined
    const requiredCount = count === undefined ? 7 : count;
    return this.stateManager.inventory.countGroup('Crystals') >= requiredCount;
  }

  can_lift_rocks() {
    if (!this.stateManager.inventory) {
      console.error('Inventory is undefined in can_lift_rocks!', {
        helperInstance: this,
        stackTrace: new Error().stack,
      });
      return false;
    }

    const result =
      this.stateManager.inventory.has('Power Glove') ||
      this.stateManager.inventory.has('Titans Mitts');

    return result;
  }

  can_lift_heavy_rocks() {
    const result = this.stateManager.inventory.has('Titans Mitts');

    return result;
  }

  bottle_count() {
    // Get the progressive bottle limit from state
    const bottleLimit =
      this.stateManager.state.difficultyRequirements.progressive_bottle_limit;
    return Math.min(
      bottleLimit,
      this.stateManager.inventory.countGroup('Bottles')
    );
  }

  has_hearts(count) {
    return this.heart_count() >= count;
  }

  heart_count() {
    // Get difficulty requirements from state
    const bossHeartLimit =
      this.stateManager.state.difficultyRequirements.boss_heart_container_limit;
    const heartPieceLimit =
      this.stateManager.state.difficultyRequirements.heart_piece_limit;

    const bossHearts = Math.min(
      this.stateManager.inventory.count('Boss Heart Container'),
      bossHeartLimit
    );

    const sanctuaryHearts = this.stateManager.inventory.count(
      'Sanctuary Heart Container'
    );

    const pieceHearts =
      Math.min(
        this.stateManager.inventory.count('Piece of Heart'),
        heartPieceLimit
      ) / 4;

    // Starting hearts (3)
    return bossHearts + sanctuaryHearts + pieceHearts + 3;
  }

  can_extend_magic(smallmagic = 16, fullrefill = false) {
    // Calculate base magic capacity
    let basemagic = 8;
    if (this.stateManager.inventory.has('Magic Upgrade (1/4)')) {
      basemagic = 32;
    } else if (this.stateManager.inventory.has('Magic Upgrade (1/2)')) {
      basemagic = 16;
    }

    // Add magic from potions if available
    if (
      this.can_buy_unlimited('Green Potion') ||
      this.can_buy_unlimited('Blue Potion')
    ) {
      const bottleCount = this.bottle_count();
      const functionality =
        this.stateManager.state.gameSettings.item_functionality || 'normal';

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
    if (this.stateManager.state.gameSettings.shuffle_capacity_upgrades) {
      if (quantity === 0) {
        return true;
      }

      let arrows = 30;

      if (this.stateManager.inventory.has('Arrow Upgrade (70)')) {
        arrows = 70;
      } else {
        // Add +5 upgrades
        arrows += this.stateManager.inventory.count('Arrow Upgrade (+5)') * 5;

        // Add +10 upgrades
        arrows += this.stateManager.inventory.count('Arrow Upgrade (+10)') * 10;

        // Arrow Upgrade (+5) beyond the 6th gives +10
        const extraUpgrades = Math.max(
          0,
          this.stateManager.inventory.count('Arrow Upgrade (+5)') - 6
        );
        arrows += extraUpgrades * 10;
      }

      return Math.min(70, arrows) >= quantity;
    }

    // Default case - non-shuffled capacity
    return (
      quantity <= 30 || this.stateManager.inventory.has('Capacity Upgrade Shop')
    );
  }

  can_use_bombs(count = 1) {
    const bombless = this.stateManager.state.hasFlag('bombless_start');
    let bombs = bombless ? 0 : 10;

    const plus5Count = this.stateManager.inventory.count('Bomb Upgrade (+5)');
    const plus10Count = this.stateManager.inventory.count('Bomb Upgrade (+10)');
    const plus50Count = this.stateManager.inventory.count('Bomb Upgrade (50)');

    bombs += plus5Count * 5;
    bombs += plus10Count * 10;
    bombs += plus50Count * 50;

    if (plus5Count > 6) {
      const bonusBombs = (plus5Count - 6) * 10;
      bombs += bonusBombs;
    }

    return bombs >= Math.min(count, 50);
  }

  can_bomb_or_bonk() {
    return (
      this.stateManager.inventory.has('Pegasus Boots') || this.can_use_bombs()
    );
  }

  can_activate_crystal_switch() {
    return (
      this.has_melee_weapon() ||
      this.can_use_bombs() ||
      this.can_shoot_arrows() ||
      this.stateManager.inventory.has('Hookshot') ||
      this.stateManager.inventory.has('Cane of Somaria') ||
      this.stateManager.inventory.has('Cane of Byrna') ||
      this.stateManager.inventory.has('Fire Rod') ||
      this.stateManager.inventory.has('Ice Rod') ||
      this.stateManager.inventory.has('Blue Boomerang') ||
      this.stateManager.inventory.has('Red Boomerang')
    );
  }

  can_kill_most_things(count = 5) {
    return (
      this.has_melee_weapon() ||
      this.stateManager.inventory.has('Cane of Somaria') ||
      (this.stateManager.inventory.has('Cane of Byrna') &&
        (count < 6 || this.can_extend_magic())) ||
      this.can_shoot_arrows() ||
      this.stateManager.inventory.has('Fire Rod') ||
      this.can_use_bombs(count * 4)
    );
  }

  can_get_good_bee() {
    // Check if the Good Bee Cave region is accessible
    const caveAccessible = this.stateManager.isRegionReachable('Good Bee Cave');

    return (
      this.stateManager.inventory.countGroup('Bottles') > 0 &&
      this.stateManager.inventory.has('Bug Catching Net') &&
      (this.stateManager.inventory.has('Pegasus Boots') ||
        (this.has_sword() && this.stateManager.inventory.has('Quake'))) &&
      caveAccessible &&
      this.is_not_bunny({ is_light_world: true, is_dark_world: false }) // Assuming Good Bee Cave is in light world
    );
  }

  can_retrieve_tablet() {
    const hasBookOfMudora = this.stateManager.inventory.has('Book of Mudora');

    if (!hasBookOfMudora) {
      return false;
    }

    // Check if we have beam sword OR (swordless mode AND hammer)
    const hasSword = this.has_beam_sword();
    const isSwordlessMode = this.stateManager.state.hasFlag('swordless');
    const hasHammer = this.stateManager.inventory.has('Hammer');

    return hasSword || (isSwordlessMode && hasHammer);
  }

  has_sword() {
    return (
      this.stateManager.inventory.has('Fighter Sword') ||
      this.stateManager.inventory.has('Master Sword') ||
      this.stateManager.inventory.has('Tempered Sword') ||
      this.stateManager.inventory.has('Golden Sword')
    );
  }

  has_beam_sword() {
    return (
      this.stateManager.inventory.has('Master Sword') ||
      this.stateManager.inventory.has('Tempered Sword') ||
      this.stateManager.inventory.has('Golden Sword')
    );
  }

  has_melee_weapon() {
    return this.has_sword() || this.stateManager.inventory.has('Hammer');
  }

  has_fire_source() {
    return (
      this.stateManager.inventory.has('Fire Rod') ||
      this.stateManager.inventory.has('Lamp')
    );
  }

  can_melt_things() {
    return (
      this.stateManager.inventory.has('Fire Rod') ||
      (this.stateManager.inventory.has('Bombos') &&
        (this.stateManager.state.hasFlag('swordless') || this.has_sword()))
    );
  }

  has_misery_mire_medallion() {
    // Get the specific medallion from state
    const medallion =
      this.stateManager.state.gameSettings.misery_mire_medallion ||
      this.stateManager.state.requiredMedallions[0] ||
      'Ether';
    return this.stateManager.inventory.has(medallion);
  }

  has_turtle_rock_medallion() {
    // Get the specific medallion from state
    const medallion =
      this.stateManager.state.gameSettings.turtle_rock_medallion ||
      this.stateManager.state.requiredMedallions[1] ||
      'Quake';
    return this.stateManager.inventory.has(medallion);
  }

  can_boots_clip_lw() {
    if (this.stateManager.state.gameMode === 'inverted') {
      return (
        this.stateManager.inventory.has('Pegasus Boots') &&
        this.stateManager.inventory.has('Moon Pearl')
      );
    }
    return this.stateManager.inventory.has('Pegasus Boots');
  }

  can_boots_clip_dw() {
    if (this.stateManager.state.gameMode !== 'inverted') {
      return (
        this.stateManager.inventory.has('Pegasus Boots') &&
        this.stateManager.inventory.has('Moon Pearl')
      );
    }
    return this.stateManager.inventory.has('Pegasus Boots');
  }

  can_get_glitched_speed_dw() {
    const hasRequiredItems = [
      this.stateManager.inventory.has('Pegasus Boots'),
      this.stateManager.inventory.has('Hookshot') || this.has_sword(),
    ];

    if (this.stateManager.state.gameMode !== 'inverted') {
      hasRequiredItems.push(this.stateManager.inventory.has('Moon Pearl'));
    }

    return hasRequiredItems.every(Boolean);
  }

  // And now the helpers from worlds/alttp/Rules.py

  item_name_in_location_names(item, arg2, arg3) {
    let player;
    let location_name_player_pairs;

    // Check if player argument (arg2) might have been omitted
    if (Array.isArray(arg2) && arg3 === undefined) {
      // Assume arg2 is the location pairs list, use stateManager's player slot
      location_name_player_pairs = arg2;
      player = this.stateManager.playerSlot; // Use playerSlot from stateManager
      //console.warn(
      //  `item_name_in_location_names potentially missing player arg, defaulting to stateManager.playerSlot (${player})`
      //);
    } else {
      // Assume standard arguments: item, player, location_pairs
      // Use arg2 as player if it's a number, otherwise default to stateManager's player slot
      player = typeof arg2 === 'number' ? arg2 : this.stateManager.playerSlot;
      location_name_player_pairs = arg3;
    }

    // Ensure location_name_player_pairs is an array
    if (!Array.isArray(location_name_player_pairs)) {
      console.warn(
        'item_name_in_location_names called with non-array pairs:',
        location_name_player_pairs
      );
      return false;
    }

    // Iterate through the pairs [locationName, locationPlayer]
    for (const pair of location_name_player_pairs) {
      // Ensure the pair is a valid array [string, number]
      if (
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        typeof pair[0] !== 'string'
      ) {
        console.warn('Invalid pair in item_name_in_location_names:', pair);
        continue; // Skip invalid pairs
      }

      const [locName, locPlayer] = pair; // locPlayer isn't actually used in the JS location_item_name yet, but keep structure for potential future use

      // Get the item [name, player] at the specified location
      const itemAtLocation = this.location_item_name(locName);

      // Check if the item exists and matches the target item name and player ID
      if (
        itemAtLocation &&
        itemAtLocation[0] === item &&
        itemAtLocation[1] === player
      ) {
        return true; // Found a match
      }
    }

    return false; // No match found
  }

  old_man() {
    // Placeholder.  Todo - copy the logic from Rules.py
    return this.stateManager.isLocationAccessible('Old Man');
  }

  basement_key_rule() {
    // Python: location_item_name(state, 'Sewers - Key Rat Key Drop', player) == ("Small Key (Hyrule Castle)", player)
    // Assuming player 1 (local player)
    const keyRatItem = this.location_item_name('Sewers - Key Rat Key Drop');
    const keyRatHasKey =
      keyRatItem &&
      keyRatItem[0] === 'Small Key (Hyrule Castle)' &&
      keyRatItem[1] === 1;

    if (keyRatHasKey) {
      // Python: state._lttp_has_key("Small Key (Hyrule Castle)", player, 2)
      return this._lttp_has_key('Small Key (Hyrule Castle)', 1, 2);
    } else {
      // Python: state._lttp_has_key("Small Key (Hyrule Castle)", player, 3)
      return this._lttp_has_key('Small Key (Hyrule Castle)', 1, 3);
    }
  }

  cross_peg_bridge() {
    // Python: state.has('Hammer', player) and state.has('Moon Pearl', player)
    // Assuming player 1 (local player)
    return (
      this.stateManager.inventory.has('Hammer') &&
      this.stateManager.inventory.has('Moon Pearl')
    );
  }

  // Placeholders for glitch rules

  set_owg_connection_rules() {
    // Placeholder.
    return false;
  }

  get_boots_clip_exits_lw() {
    // Placeholder.
    return false;
  }

  get_boots_clip_exits_dw() {
    // Placeholder.
    return false;
  }

  get_glitched_speed_drops_lw() {
    // Placeholder.
    return false;
  }

  get_glitched_speed_drops_dw() {
    // Placeholder.
    return false;
  }

  get_mirror_offset_spots_lw() {
    // Placeholder.
    return false;
  }

  get_mirror_offset_spots_dw() {
    // Placeholder.
    return false;
  }

  get_mirror_clip_spots_lw() {
    // Placeholder.
    return false;
  }

  get_mirror_clip_spots_dw() {
    // Placeholder.
    return false;
  }

  add_alternate_rule() {
    // Placeholder.
    return false;
  }

  get_entrance() {
    // Placeholder.
    return false;
  }

  // And now the state_methods:

  can_reach(region, type = 'Region', player = 1) {
    // The context-aware state manager handles position-specific constraints correctly
    if (type === 'Region') {
      return this.stateManager.isRegionReachable(region);
    } else if (type === 'Location') {
      // Find the location object
      const location = this.stateManager.locations.find(
        (loc) => loc.name === region
      );
      return location && this.stateManager.isLocationAccessible(location);
    }

    return false;
  }

  /*
    def can_reach(self,
                  spot: Union[Location, Entrance, Region, str],
                  resolution_hint: Optional[str] = None,
                  player: Optional[int] = None) -> bool:
        if isinstance(spot, str):
            assert isinstance(player, int), "can_reach: player is required if spot is str"
            # try to resolve a name
            if resolution_hint == 'Location':
                return self.can_reach_location(spot, player)
            elif resolution_hint == 'Entrance':
                return self.can_reach_entrance(spot, player)
            else:
                # default to Region
                return self.can_reach_region(spot, player)
        return spot.can_reach(self)

    def can_reach_location(self, spot: str, player: int) -> bool:
        return self.multiworld.get_location(spot, player).can_reach(self)

    def can_reach_entrance(self, spot: str, player: int) -> bool:
        return self.multiworld.get_entrance(spot, player).can_reach(self)

    def can_reach_region(self, spot: str, player: int) -> bool:
        return self.multiworld.get_region(spot, player).can_reach(self)

  */

  _lttp_has_key(key, playerParam, count = 1) {
    // Convert player parameter - can be a string "player" or a number
    const player = playerParam === 'player' ? 1 : parseInt(playerParam, 10);

    // Get count of the specific key in inventory
    const keyCount = this.stateManager.inventory.count(key);

    if (this.stateManager.debugMode) {
      console.log(
        `_lttp_has_key: ${key}, player=${player}, count=${count}, has=${keyCount}`
      );
    }

    // Return true if we have enough keys
    return keyCount >= count;
  }

  // Add non-underscore version for consistency
  lttp_has_key(key, playerParam, count = 1) {
    return this._lttp_has_key(key, playerParam, count);
  }

  GanonDefeatRule() {
    const isSwordless = this.stateManager.state.hasFlag('swordless');

    if (isSwordless) {
      return (
        this.stateManager.inventory.has('Hammer') &&
        this.has_fire_source() &&
        this.stateManager.inventory.has('Silver Bow') &&
        this.can_shoot_arrows()
      );
    }

    const canHurt = this.has_beam_sword();
    const common = canHurt && this.has_fire_source();

    // Check glitches setting - Assuming glitches_required is a string 'no_glitches' or other values
    // Accessing nested properties safely
    const glitchesRequired =
      this.stateManager.state.gameSettings?.glitches_required || 'no_glitches';

    if (glitchesRequired !== 'no_glitches') {
      return (
        common &&
        (this.stateManager.inventory.has('Tempered Sword') ||
          this.stateManager.inventory.has('Golden Sword') ||
          (this.stateManager.inventory.has('Silver Bow') &&
            this.can_shoot_arrows()) ||
          this.stateManager.inventory.has('Lamp') ||
          this.can_extend_magic(12)) // Assuming 12 magic cost for lighting torches
      );
    } else {
      return (
        common &&
        this.stateManager.inventory.has('Silver Bow') &&
        this.can_shoot_arrows()
      );
    }
  }

  has_any(items, playerId) {
    // Check if items is an array
    if (!Array.isArray(items)) {
      console.warn('has_any called with non-array items:', items);
      return false;
    }
    // Assuming player 1 (local player) if playerId is not a number
    const player = typeof playerId === 'number' ? playerId : 1;

    // Iterate through the item names
    for (const item of items) {
      if (typeof item !== 'string') {
        console.warn('Invalid item name in has_any:', item);
        continue; // Skip non-string items
      }
      // Check if the player has at least one of this item
      if (this.stateManager.inventory.count(item, player) > 0) {
        return true; // Found one
      }
    }

    return false; // None found
  }

  // Python-like helper functions

  /**
   * Implements Python's len() function
   * Works with arrays, strings, and objects
   * @param {*} obj - The object to get the length of
   * @returns {number} - The length of the object
   */
  len(obj) {
    if (obj == null) {
      return 0;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.length;
    }

    // Handle strings
    if (typeof obj === 'string') {
      return obj.length;
    }

    // Handle objects (count keys)
    if (typeof obj === 'object') {
      return Object.keys(obj).length;
    }

    // Default for unsupported types
    return 0;
  }

  /**
   * Implements Python's zip() function
   * Combines multiple arrays into an array of arrays where each sub-array
   * contains elements from the input arrays at matching indices
   * @param {...Array} arrays - Arrays to zip together
   * @returns {Array} - Zipped array
   */
  zip(...arrays) {
    if (!arrays || arrays.length === 0) {
      return [];
    }

    // Find the shortest array length
    const minLength = Math.min(
      ...arrays.map((arr) => (Array.isArray(arr) ? arr.length : 0))
    );

    // Create zipped array
    const result = [];
    for (let i = 0; i < minLength; i++) {
      result.push(arrays.map((arr) => arr[i]));
    }

    return result;
  }

  /**
   * Gets an attribute from an object safely
   * Useful for handling complex attribute chains
   * @param {Object} obj - The object to get the attribute from
   * @param {string} attr - The attribute name
   * @returns {*} - The attribute value or undefined
   */
  getattr(obj, attr) {
    if (obj == null || typeof obj !== 'object') {
      return undefined;
    }
    return obj[attr];
  }

  /**
   * Implements Python's range() function
   * @param {number} start - Start index (or stop if only one arg)
   * @param {number} [stop] - Stop index (exclusive)
   * @param {number} [step=1] - Step size
   * @returns {Array} - Array of numbers in the range
   */
  range(...args) {
    let start, stop, step;

    if (args.length === 1) {
      [stop] = args;
      start = 0;
      step = 1;
    } else if (args.length === 2) {
      [start, stop] = args;
      step = 1;
    } else {
      [start, stop, step] = args;
    }

    const result = [];
    if (step > 0) {
      for (let i = start; i < stop; i += step) {
        result.push(i);
      }
    } else if (step < 0) {
      for (let i = start; i > stop; i += step) {
        result.push(i);
      }
    }

    return result;
  }

  /**
   * Implements Python's all() function
   * @param {Array} iterable - Iterable to check
   * @returns {boolean} - True if all items are truthy, otherwise false
   */
  all(iterable) {
    if (!Array.isArray(iterable)) {
      return false;
    }
    return iterable.every(Boolean);
  }

  /**
   * Implements Python's any() function
   * @param {Array} iterable - Iterable to check
   * @returns {boolean} - True if any item is truthy, otherwise false
   */
  any(iterable) {
    if (!Array.isArray(iterable)) {
      return false;
    }
    return iterable.some(Boolean);
  }

  /**
   * Implements Python's bool() function
   * Converts values to their boolean representation
   * @param {*} value - The value to convert
   * @returns {boolean} - The boolean representation
   */
  to_bool(value) {
    // Handle falsy values similar to Python
    if (value === null || value === undefined) {
      return false;
    }

    // Handle numerical zero (like Python)
    if (typeof value === 'number' && value === 0) {
      return false;
    }

    // Handle empty strings (like Python)
    if (typeof value === 'string' && value === '') {
      return false;
    }

    // Handle empty arrays (like Python)
    if (Array.isArray(value) && value.length === 0) {
      return false;
    }

    // Handle empty objects (like Python)
    if (typeof value === 'object' && Object.keys(value).length === 0) {
      return false;
    }

    // Everything else is true
    return true;
  }

  /**
   * Implements the shop_price_rules function
   * Checks if a player can afford a shop item based on the price type
   * @param {Object|string} locationOrName - The location object or name
   * @returns {boolean} - Whether the player can afford the item
   */
  shop_price_rules(locationOrName) {
    // for now, just return true
    return true;

    // First, resolve the location
    let location;

    if (typeof locationOrName === 'string') {
      // Find location by name
      location = this._findLocationByName(locationOrName);
    } else if (typeof locationOrName === 'object') {
      location = locationOrName;
    } else {
      console.warn(
        'Invalid location argument to shop_price_rules:',
        locationOrName
      );
      return true; // Default to affordable
    }

    // If location not found or missing required data, assume affordable
    if (
      !location ||
      !location.shop_price_type ||
      location.shop_price === undefined
    ) {
      return true;
    }

    // Define shop price types matching Python enum
    const ShopPriceType = {
      Hearts: 'hearts',
      Bombs: 'bombs',
      Arrows: 'arrows',
    };

    // Check based on price type
    const priceType = location.shop_price_type.toLowerCase();
    const price = location.shop_price;

    if (priceType === ShopPriceType.Hearts) {
      return this.has_hearts(price / 8 + 1);
    } else if (priceType === ShopPriceType.Bombs) {
      return this.can_use_bombs(price);
    } else if (priceType === ShopPriceType.Arrows) {
      return this.can_hold_arrows(price);
    }

    // Default to affordable
    return true;
  }

  /**
   * Helper to find a location by name
   * @private
   */
  _findLocationByName(locationName) {
    if (!this.stateManager || !this.stateManager.locations) {
      return null;
    }

    return this.stateManager.locations.find((loc) => loc.name === locationName);
  }

  /**
   * Enhances location data with shop information if available
   * Call this when loading locations
   */
  enhanceLocationsWithShopData() {
    if (
      !this.stateManager ||
      !this.stateManager.locations ||
      !this.stateManager.regions
    ) {
      return;
    }

    // Process all locations
    for (const location of this.stateManager.locations) {
      // Skip locations without a region
      if (!location.region) continue;

      // Get the region data
      const regionData = this.stateManager.regions[location.region];
      if (!regionData || !regionData.shop) continue;

      // If the region has a shop, find the matching shop item
      const shopItems = regionData.shop.inventory || [];
      const matchingItem = shopItems.find(
        (item) =>
          item.location_name === location.name ||
          regionData.shop.location_name === location.name
      );

      if (matchingItem) {
        // Enhance the location with shop data
        location.shop_price = matchingItem.price;

        // Determine price type (most shops use rupees)
        // This is a simplification - real logic would need more context
        if (matchingItem.item.includes('Heart')) {
          location.shop_price_type = 'Hearts';
        } else if (matchingItem.item.includes('Bomb')) {
          location.shop_price_type = 'Bombs';
        } else if (matchingItem.item.includes('Arrow')) {
          location.shop_price_type = 'Arrows';
        } else {
          location.shop_price_type = 'Rupees';
        }
      }
    }
  }

  /**
   * Gets the item name and player ID for a given location name.
   * Mirrors the Python `location_item_name` function.
   * @param {string} locationName - The name of the location to check.
   * @returns {[string, number]|null} - An array [itemName, itemPlayer] or null if no item.
   */
  location_item_name(locationName) {
    const location = this._findLocationByName(locationName);

    if (location && location.item) {
      // Assuming location.item structure is { name: string, player: number }
      return [location.item.name, location.item.player];
    }

    return null; // No item found or location doesn't exist
  }

  /**
   * Override the executeHelper method to add special case handling for Python-like functions
   * @override
   */
  executeHelper(name, ...args) {
    // Handle special cases for Python builtins and our custom helpers
    if (name === 'to_bool') {
      return this.to_bool(...args);
    }
    if (name === 'shop_price_rules') {
      return this.shop_price_rules(...args);
    }
    if (name === 'len') {
      return this.len(...args);
    }
    if (name === 'zip') {
      return this.zip(...args);
    }
    if (name === 'range') {
      return this.range(...args);
    }
    if (name === 'all') {
      return this.all(...args);
    }
    if (name === 'any') {
      return this.any(...args);
    }
    if (name === 'getattr') {
      return this.getattr(...args);
    }
    if (name === 'location_item_name') {
      return this.location_item_name(...args);
    }

    // Use the parent class implementation for all other helpers
    return super.executeHelper(name, ...args);
  }
}
