/**
 * @module gameLogic/smz3/smz3Logic
 * @description Thread-agnostic SMZ3 game logic functions
 *
 * SMZ3 (Super Metroid & A Link to the Past Crossover) combines logic from both games.
 * The game uses the TotalSMZ3 library with custom Region.CanEnter() implementations.
 *
 * These pure functions operate on a canonical state snapshot and return results
 * without modifying the state. All helper functions follow the standardized signature:
 *
 * `(snapshot, staticData, ...args) => boolean | number | any`
 *
 * **DATA FLOW:**
 *
 * Input: Canonical state snapshot + static game data
 * - snapshot: { inventory, flags, events, player, regionReachability, evaluateRule }
 * - staticData: { settings, progressionMapping, regions, locations, items }
 *
 * Processing: Pure functional logic evaluation
 * - No state mutation
 * - Thread-safe execution
 * - Deterministic results
 *
 * Output: Boolean, number, or structured data based on function purpose
 */

// Import ALTTP helper functions for progressive item handling
import { has as alttpHas, count as alttpCount } from '../alttp/alttpLogic.js';

/**
 * Helper function to check if player has an item.
 * Uses ALTTP's has() function which handles progressive items via progressionMapping.
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static data with progressionMapping
 * @param {string} itemName - Name of the item
 * @returns {boolean} True if player has the item
 */
function hasItem(snapshot, staticData, itemName) {
  return alttpHas(snapshot, staticData, itemName);
}

/**
 * Helper function to get item count.
 * Uses ALTTP's count() function which handles progressive items via progressionMapping.
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static data with progressionMapping
 * @param {string} itemName - Name of the item
 * @returns {number} Count of the item
 */
function getItemCount(snapshot, staticData, itemName) {
  return alttpCount(snapshot, staticData, itemName);
}

// Export generic has/count functions for use by snapshot interface
export { hasItem as has, getItemCount as count };

// ====================
// ALTTP Helper Functions
// ====================

/**
 * Check if player can lift light objects (requires Power Glove).
 * Python: def CanLiftLight(self): return self.Glove
 * Note: Uses ProgressiveGlove >= 1
 */
export function smz3_CanLiftLight(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'ProgressiveGlove');
}

/**
 * Check if player can lift heavy objects (requires Titans Mitts).
 * Python: def CanLiftHeavy(self): return self.Mitt
 * Note: Uses ProgressiveGlove >= 2
 */
export function smz3_CanLiftHeavy(snapshot, staticData) {
  return getItemCount(snapshot, staticData, 'ProgressiveGlove') >= 2;
}

/**
 * Check if player can light torches (Lamp or Fire Rod).
 * Python: def CanLightTorches(self): return self.Firerod or self.Lamp
 */
export function smz3_CanLightTorches(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Firerod') || hasItem(snapshot, staticData, 'Lamp');
}

/**
 * Check if player can melt Freezors (Fire Rod or Bombos + Sword).
 * Python: def CanMeltFreezors(self): return self.Firerod or self.Bombos and self.Sword
 */
export function smz3_CanMeltFreezors(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Firerod') ||
         (hasItem(snapshot, staticData, 'Bombos') && hasItem(snapshot, staticData, 'ProgressiveSword'));
}

/**
 * Check if player can extend magic (Half Magic and/or Bottle).
 * Python: def CanExtendMagic(self, bars:int = 2): return (2 if self.HalfMagic else 1) * (2 if self.Bottle else 1) >= bars
 *
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static data
 * @param {number} bars - Number of bars required (default 2)
 */
export function smz3_CanExtendMagic(snapshot, staticData, bars = 2) {
  const halfMagicMultiplier = hasItem(snapshot, staticData, 'HalfMagic') ? 2 : 1;
  const bottleMultiplier = hasItem(snapshot, staticData, 'Bottle') ? 2 : 1;
  return halfMagicMultiplier * bottleMultiplier >= bars;
}

/**
 * Check if player can kill many enemies (various weapons).
 * Python: def CanKillManyEnemies(self):
 *     return self.Sword or self.Hammer or self.Bow or self.Firerod or \
 *            self.Somaria or self.Byrna and self.CanExtendMagic()
 */
export function smz3_CanKillManyEnemies(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'ProgressiveSword') ||
         hasItem(snapshot, staticData, 'Hammer') ||
         hasItem(snapshot, staticData, 'Bow') ||
         hasItem(snapshot, staticData, 'Firerod') ||
         hasItem(snapshot, staticData, 'Somaria') ||
         (hasItem(snapshot, staticData, 'Byrna') && smz3_CanExtendMagic(snapshot, staticData, 2));
}

/**
 * Check if player can beat dungeon bosses (has appropriate weapons).
 * This is a generic helper that covers requirements for all dungeon bosses.
 * Most bosses can be beaten with: Sword, Hammer, Bow, Firerod, Icerod, Byrna, or Somaria
 * Python (from DesertPalace): def CanBeatBoss(self, items: Progression):
 *     return items.Sword or items.Hammer or items.Bow or \
 *            items.Firerod or items.Icerod or \
 *            items.Byrna or items.Somaria
 */
export function smz3_CanBeatBoss(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'ProgressiveSword') ||
         hasItem(snapshot, staticData, 'Hammer') ||
         hasItem(snapshot, staticData, 'Bow') ||
         hasItem(snapshot, staticData, 'Firerod') ||
         hasItem(snapshot, staticData, 'Icerod') ||
         hasItem(snapshot, staticData, 'Byrna') ||
         hasItem(snapshot, staticData, 'Somaria');
}

// ====================
// Super Metroid Helper Functions
// ====================

/**
 * Check if player can infinite bomb jump (Morph Ball + Bombs).
 * Python: def CanIbj(self): return self.Morph and self.Bombs
 */
export function smz3_CanIbj(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Morph') && hasItem(snapshot, staticData, 'Bombs');
}

/**
 * Check if player can fly (Space Jump or IBJ).
 * Python: def CanFly(self): return self.SpaceJump or self.CanIbj()
 */
export function smz3_CanFly(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'SpaceJump') || smz3_CanIbj(snapshot, staticData);
}

/**
 * Check if player can use Power Bombs (Morph Ball + Power Bomb).
 * Python: def CanUsePowerBombs(self): return self.Morph and self.PowerBomb
 */
export function smz3_CanUsePowerBombs(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Morph') && hasItem(snapshot, staticData, 'PowerBomb');
}

/**
 * Check if player can pass bomb passages (Morph Ball + (Bombs or Power Bomb)).
 * Python: def CanPassBombPassages(self): return self.Morph and (self.Bombs or self.PowerBomb)
 */
export function smz3_CanPassBombPassages(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Morph') &&
         (hasItem(snapshot, staticData, 'Bombs') || hasItem(snapshot, staticData, 'PowerBomb'));
}

/**
 * Check if player can destroy bomb walls (CanPassBombPassages or Screw Attack).
 * Python: def CanDestroyBombWalls(self): return self.CanPassBombPassages() or self.ScrewAttack
 */
export function smz3_CanDestroyBombWalls(snapshot, staticData) {
  return smz3_CanPassBombPassages(snapshot, staticData) || hasItem(snapshot, staticData, 'ScrewAttack');
}

/**
 * Check if player can spring ball jump (Morph Ball + Spring Ball).
 * Python: def CanSpringBallJump(self): return self.Morph and self.SpringBall
 */
export function smz3_CanSpringBallJump(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Morph') && hasItem(snapshot, staticData, 'SpringBall');
}

/**
 * Check if player can survive heat (Varia Suit or 5+ Energy Reserves).
 * Python: def CanHellRun(self): return self.Varia or self.HasEnergyReserves(5)
 */
export function smz3_CanHellRun(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Varia') || smz3_HasEnergyReserves(snapshot, staticData, 5);
}

/**
 * Check if player has sufficient energy reserves (E-Tanks + Reserve Tanks).
 * Python: def HasEnergyReserves(self, amount: int): return (self.ETank + self.ReserveTank) >= amount
 *
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static data
 * @param {number} amount - Required number of tanks
 */
export function smz3_HasEnergyReserves(snapshot, staticData, amount) {
  const eTanks = getItemCount(snapshot, staticData, 'ETank');
  const reserveTanks = getItemCount(snapshot, staticData, 'ReserveTank');
  return (eTanks + reserveTanks) >= amount;
}

/**
 * Check if player can open red doors (Missile or Super Missile).
 * Python: def CanOpenRedDoors(self): return self.Missile or self.Super
 */
export function smz3_CanOpenRedDoors(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Missile') || hasItem(snapshot, staticData, 'Super');
}

/**
 * Check if player can access Crocomire area.
 * Python: def CanAccessCrocomire(self): return self.CardNorfairBoss if self.Config.Keysanity else self.Super
 *
 * Note: For non-keysanity mode (default), just requires Super Missile.
 * For keysanity mode, would require CardNorfairBoss instead.
 */
export function smz3_CanAccessCrocomire(snapshot, staticData) {
  // TODO: Check keysanity setting from staticData.settings if needed
  // For now, assuming non-keysanity mode (standard SMZ3)
  return hasItem(snapshot, staticData, 'Super');
}

/**
 * Check if player can unlock Wrecked Ship.
 * Python: def CanUnlockShip(self): return self.CardWreckedShipBoss and self.CanPassBombPassages()
 */
export function smz3_CanUnlockShip(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'CardWreckedShipBoss') && smz3_CanPassBombPassages(snapshot, staticData);
}

/**
 * Check if player can enter and leave the Gauntlet area.
 * Python (Normal): items.CardCrateriaL1 and items.Morph and (items.CanFly() or items.SpeedBooster) and
 *                  (items.CanIbj() or items.CanUsePowerBombs() and items.TwoPowerBombs or items.ScrewAttack)
 * Python (Hard): items.CardCrateriaL1 and (items.Morph and (items.Bombs or items.TwoPowerBombs) or
 *                items.ScrewAttack or items.SpeedBooster and items.CanUsePowerBombs() and items.HasEnergyReserves(2))
 *
 * Note: TwoPowerBombs means having at least 2 Power Bombs
 * Using Normal logic for now.
 */
export function smz3_CanEnterAndLeaveGauntlet(snapshot, staticData) {
  // Normal logic implementation
  const hasCardCrateriaL1 = hasItem(snapshot, staticData, 'CardCrateriaL1');
  const hasMorph = hasItem(snapshot, staticData, 'Morph');
  const canFlyOrSpeed = smz3_CanFly(snapshot, staticData) || hasItem(snapshot, staticData, 'SpeedBooster');

  // Check if player has at least 2 Power Bombs
  const hasTwoPowerBombs = getItemCount(snapshot, staticData, 'PowerBomb') >= 2;

  const canEscape = smz3_CanIbj(snapshot, staticData) ||
                    (smz3_CanUsePowerBombs(snapshot, staticData) && hasTwoPowerBombs) ||
                    hasItem(snapshot, staticData, 'ScrewAttack');

  return hasCardCrateriaL1 && hasMorph && canFlyOrSpeed && canEscape;
}

// ====================
// Portal Access Functions
// ====================

/**
 * Check if player can access Death Mountain portal.
 * Python: def CanAccessDeathMountainPortal(self):
 *     return (self.CanDestroyBombWalls() or self.SpeedBooster) and self.Super and self.Morph
 */
export function smz3_CanAccessDeathMountainPortal(snapshot, staticData) {
  return (smz3_CanDestroyBombWalls(snapshot, staticData) || hasItem(snapshot, staticData, 'SpeedBooster')) &&
         hasItem(snapshot, staticData, 'Super') &&
         hasItem(snapshot, staticData, 'Morph');
}

/**
 * Check if player can access Dark World portal.
 * Python: def CanAccessDarkWorldPortal(self, config: Config):
 *     if (config.SMLogic == SMLogic.Normal):
 *         return self.CardMaridiaL1 and self.CardMaridiaL2 and self.CanUsePowerBombs() and self.Super and self.Gravity and self.SpeedBooster
 *     else:
 *         return self.CardMaridiaL1 and self.CardMaridiaL2 and self.CanUsePowerBombs() and self.Super and \
 *             (self.Charge or self.Super and self.Missile) and \
 *             (self.Gravity or self.HiJump and self.Ice and self.Grapple) and \
 *             (self.Ice or self.Gravity and self.SpeedBooster)
 *
 * Note: Using simplified logic for now (Normal mode requirements)
 */
export function smz3_CanAccessDarkWorldPortal(snapshot, staticData) {
  // Simplified implementation (Normal logic)
  return hasItem(snapshot, staticData, 'CardMaridiaL1') &&
         hasItem(snapshot, staticData, 'CardMaridiaL2') &&
         smz3_CanUsePowerBombs(snapshot, staticData) &&
         hasItem(snapshot, staticData, 'Super') &&
         hasItem(snapshot, staticData, 'Gravity') &&
         hasItem(snapshot, staticData, 'SpeedBooster');
}

/**
 * Check if player can access Misery Mire portal.
 * Python: def CanAccessMiseryMirePortal(self, config: Config):
 *     if (config.SMLogic == SMLogic.Normal):
 *         return (self.CardNorfairL2 or (self.SpeedBooster and self.Wave)) and self.Varia and self.Super and self.Gravity and self.SpaceJump and self.CanUsePowerBombs()
 *     else:
 *         return (self.CardNorfairL2 or self.SpeedBooster) and self.Varia and self.Super and \
 *                (self.CanFly() or self.HiJump or self.SpeedBooster or self.CanSpringBallJump() or self.Ice) \
 *                and (self.Gravity or self.HiJump) and self.CanUsePowerBombs()
 *
 * Note: Using simplified logic for now (Normal mode requirements)
 */
export function smz3_CanAccessMiseryMirePortal(snapshot, staticData) {
  // Simplified implementation (Normal logic)
  return (hasItem(snapshot, staticData, 'CardNorfairL2') ||
          (hasItem(snapshot, staticData, 'SpeedBooster') && hasItem(snapshot, staticData, 'Wave'))) &&
         hasItem(snapshot, staticData, 'Varia') &&
         hasItem(snapshot, staticData, 'Super') &&
         hasItem(snapshot, staticData, 'Gravity') &&
         hasItem(snapshot, staticData, 'SpaceJump') &&
         smz3_CanUsePowerBombs(snapshot, staticData);
}

/**
 * Check if player can access Norfair Upper portal.
 * Python: def CanAccessNorfairUpperPortal(self):
 *     return self.Flute or self.CanLiftLight() and self.Lamp
 */
export function smz3_CanAccessNorfairUpperPortal(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Flute') ||
         (smz3_CanLiftLight(snapshot, staticData) && hasItem(snapshot, staticData, 'Lamp'));
}

/**
 * Check if player can access Norfair Lower portal.
 * Python: def CanAccessNorfairLowerPortal(self):
 *     return self.Flute and self.CanLiftHeavy()
 */
export function smz3_CanAccessNorfairLowerPortal(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'Flute') && smz3_CanLiftHeavy(snapshot, staticData);
}

/**
 * Check if player can access Maridia portal.
 * Python: def CanAccessMaridiaPortal(self, world):
 *     from .Region import RewardType
 *     if (world.Config.SMLogic == SMLogic.Normal):
 *         return self.MoonPearl and self.Flippers and \
 *                self.Gravity and self.Morph and \
 *                (world.CanAcquire(self, RewardType.Agahnim) or self.Hammer and self.CanLiftLight() or self.CanLiftHeavy())
 *     else:
 *         return self.MoonPearl and self.Flippers and \
 *                (self.CanSpringBallJump() or self.HiJump or self.Gravity) and self.Morph and \
 *                (world.CanAcquire(self, RewardType.Agahnim) or self.Hammer and self.CanLiftLight() or self.CanLiftHeavy())
 *
 * Note: Using simplified logic for now (Normal mode requirements, without Agahnim check)
 */
export function smz3_CanAccessMaridiaPortal(snapshot, staticData) {
  // Simplified implementation (Normal logic, without Agahnim event check for now)
  return hasItem(snapshot, staticData, 'MoonPearl') &&
         hasItem(snapshot, staticData, 'Flippers') &&
         hasItem(snapshot, staticData, 'Gravity') &&
         hasItem(snapshot, staticData, 'Morph') &&
         (hasItem(snapshot, staticData, 'Hammer') && smz3_CanLiftLight(snapshot, staticData) ||
          smz3_CanLiftHeavy(snapshot, staticData));
}

/**
 * Check if player can reach the Aqueduct area in Maridia.
 * Python (Normal): items.CardMaridiaL1 and (items.CanFly() or items.SpeedBooster or items.Grapple) \
 *                  or items.CardMaridiaL2 and items.CanAccessMaridiaPortal(self.world)
 * Python (Hard): items.CardMaridiaL1 and (items.Gravity or items.HiJump and (items.Ice or items.CanSpringBallJump()) and items.Grapple) \
 *                or items.CardMaridiaL2 and items.CanAccessMaridiaPortal(self.world)
 *
 * Using Normal logic for now.
 */
export function smz3_CanReachAqueduct(snapshot, staticData) {
  // Route 1: Through Maridia with L1 card and movement ability
  const route1 = hasItem(snapshot, staticData, 'CardMaridiaL1') &&
                 (smz3_CanFly(snapshot, staticData) ||
                  hasItem(snapshot, staticData, 'SpeedBooster') ||
                  hasItem(snapshot, staticData, 'Grapple'));

  // Route 2: Through Maridia portal with L2 card
  const route2 = hasItem(snapshot, staticData, 'CardMaridiaL2') &&
                 smz3_CanAccessMaridiaPortal(snapshot, staticData);

  return route1 || route2;
}

/**
 * Check if player can defeat Botwoon (mini-boss in Maridia).
 * Python (Normal): items.SpeedBooster or items.CanAccessMaridiaPortal(self.world)
 * Python (Hard): items.Ice or items.SpeedBooster and items.Gravity or items.CanAccessMaridiaPortal(self.world)
 *
 * Using Normal logic for now.
 */
export function smz3_CanDefeatBotwoon(snapshot, staticData) {
  return hasItem(snapshot, staticData, 'SpeedBooster') || smz3_CanAccessMaridiaPortal(snapshot, staticData);
}

/**
 * Check if player can defeat Draygon (boss in Maridia).
 * Python (Normal): (items.CardMaridiaL1 and items.CardMaridiaL2 and self.CanDefeatBotwoon(items) or
 *                   items.CanAccessMaridiaPortal(self.world)
 *                  ) and items.CardMaridiaBoss and items.Gravity and (items.SpeedBooster and items.HiJump or items.CanFly())
 * Python (Hard): (items.CardMaridiaL1 and items.CardMaridiaL2 and self.CanDefeatBotwoon(items) or
 *                 items.CanAccessMaridiaPortal(self.world)
 *                ) and items.CardMaridiaBoss and items.Gravity
 *
 * Using Normal logic for now.
 */
export function smz3_CanDefeatDraygon(snapshot, staticData) {
  // Can reach Draygon either through Maridia (defeating Botwoon) or via portal
  const canReachDraygon = (hasItem(snapshot, staticData, 'CardMaridiaL1') &&
                           hasItem(snapshot, staticData, 'CardMaridiaL2') &&
                           smz3_CanDefeatBotwoon(snapshot, staticData)) ||
                          smz3_CanAccessMaridiaPortal(snapshot, staticData);

  // Must have boss card, gravity, and movement capability
  const canDefeatDraygon = hasItem(snapshot, staticData, 'CardMaridiaBoss') &&
                           hasItem(snapshot, staticData, 'Gravity') &&
                           ((hasItem(snapshot, staticData, 'SpeedBooster') && hasItem(snapshot, staticData, 'HiJump')) ||
                            smz3_CanFly(snapshot, staticData));

  return canReachDraygon && canDefeatDraygon;
}

/**
 * Check if player can exit Norfair Lower East region.
 * This is specific to the Norfair Lower East region and determines if the player
 * can escape back to upper areas.
 *
 * Python (from TotalSMZ3/Regions/SuperMetroid/NorfairLower/East.py):
 * def CanExit(self, items:Progression):
 *     if self.Logic == SMLogic.Normal:
 *         # Bubble Mountain route
 *         return items.Morph and (items.CardNorfairL2 or (
 *             # Volcano Room and Blue Gate
 *             items.Gravity) and items.Wave and (
 *             # Spikey Acid Snakes and Croc Escape
 *             items.Grapple or items.SpaceJump))
 *     else:
 *         # Vanilla LN Escape (Hard mode has more options)
 *         return (items.Morph and (items.CardNorfairL2 or
 *                 (items.Missile or items.Super or items.Wave) and
 *                 (items.SpeedBooster or items.CanFly() or items.Grapple or items.HiJump and
 *                 (items.CanSpringBallJump() or items.Ice))) or
 *             # Reverse Amphitheater
 *             items.HasEnergyReserves(5))
 *
 * Note: Using Normal logic for now (simplified implementation)
 */
export function smz3_CanExit(snapshot, staticData) {
  // Normal mode logic for exiting Norfair Lower East
  const hasMorph = hasItem(snapshot, staticData, 'Morph');
  const hasCardNorfairL2 = hasItem(snapshot, staticData, 'CardNorfairL2');

  // Bubble Mountain route (simple exit with card)
  if (hasMorph && hasCardNorfairL2) {
    return true;
  }

  // Alternative route: Volcano Room and Blue Gate
  const hasGravity = hasItem(snapshot, staticData, 'Gravity');
  const hasWave = hasItem(snapshot, staticData, 'Wave');
  const hasGrapple = hasItem(snapshot, staticData, 'Grapple');
  const hasSpaceJump = hasItem(snapshot, staticData, 'SpaceJump');

  // Morph + Gravity + Wave + (Grapple OR SpaceJump)
  return hasMorph &&
         hasGravity &&
         hasWave &&
         (hasGrapple || hasSpaceJump);
}

// ====================
// Reward/Dungeon Completion Functions
// ====================

/**
 * Get a location object by name to check properties like what item is placed there.
 * Python: def GetLocation(location_name: str): return world.get_location(location_name)
 *
 * This returns an object with an ItemIs method that checks if a specific item type is placed at the location.
 *
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static data (contains locations)
 * @param {string} locationName - The name of the location to get
 * @returns {Object} An object with ItemIs method
 */
export function smz3_GetLocation(snapshot, staticData, locationName) {
  // Find the location in staticData
  let foundLocation = null;

  if (staticData.regions) {
    const regionsToSearch = staticData.regions instanceof Map ?
      Array.from(staticData.regions.values()) :
      Object.values(staticData.regions);

    for (const region of regionsToSearch) {
      if (region.locations) {
        foundLocation = region.locations.find(loc => loc.name === locationName);
        if (foundLocation) break;
      }
    }
  }

  // Return an object with ItemIs method
  return {
    ItemIs: (itemType, world) => {
      if (!foundLocation || !foundLocation.item) {
        return false;
      }
      // Check if the item at this location matches the requested type
      return foundLocation.item.name === itemType;
    }
  };
}

/**
 * Check if player can acquire a specific reward (pendant/crystal/boss token).
 * Python: def CanAcquire(self, items: Item.Progression, reward: Region.RewardType):
 *     return next(iter([region for region in self.Regions if isinstance(region, Region.IReward) and region.Reward == reward])).CanComplete(items)
 *
 * This function finds the dungeon/region that has the specified reward and checks if
 * that region can be completed (boss defeated).
 *
 * Reward types (bit flags):
 * - Agahnim = 1
 * - PendantGreen = 2
 * - PendantNonGreen = 4
 * - CrystalBlue = 8
 * - CrystalRed = 16
 * - BossTokenKraid = 32
 * - BossTokenPhantoon = 64
 * - BossTokenDraygon = 128
 * - BossTokenRidley = 256
 *
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static data (contains settings with reward_regions)
 * @param {number} rewardType - The reward type value to check for
 */
export function smz3_CanAcquire(snapshot, staticData, rewardType) {
  console.log('[smz3_CanAcquire] Called with rewardType:', rewardType);
  console.log('[smz3_CanAcquire] snapshot.player:', snapshot.player);
  console.log('[smz3_CanAcquire] snapshot.inventory keys:', snapshot.inventory ? Object.keys(snapshot.inventory).length : 'undefined');
  console.log('[smz3_CanAcquire] Sample inventory - Hammer:', snapshot.inventory?.['Hammer'], 'Hookshot:', snapshot.inventory?.['Hookshot'], 'KeySP:', snapshot.inventory?.['KeySP']);

  // Get player slot - snapshot.player can be either a number or an object with slot property
  const playerSlot = String(typeof snapshot.player === 'object' ? snapshot.player.slot : snapshot.player);
  console.log('[smz3_CanAcquire] playerSlot:', playerSlot);

  // Get the reward_regions mapping from settings
  const settings = staticData.settings?.[playerSlot] || {};
  const rewardRegions = settings.reward_regions || {};

  console.log('[smz3_CanAcquire] rewardRegions:', rewardRegions);

  // Boss location mapping: maps region name to boss location name
  // Note: Some regions (like Castle Tower) don't have a specific boss location
  // and use Can Complete based on other requirements
  const bossLocations = {
    'Castle Tower': null,  // No boss location - completion based on CanEnter + items
    'Eastern Palace': 'Eastern Palace - Armos Knights',
    'Desert Palace': 'Desert Palace - Lanmolas',
    'Tower of Hera': 'Tower of Hera - Moldorm',
    'Palace of Darkness': 'Palace of Darkness - Helmasaur King',
    'Swamp Palace': 'Swamp Palace - Arrghus',
    'Skull Woods': 'Skull Woods - Mothula',
    'Thieves\' Town': 'Thieves\' Town - Blind',
    'Ice Palace': 'Ice Palace - Kholdstare',
    'Misery Mire': 'Misery Mire - Vitreous',
    'Turtle Rock': 'Turtle Rock - Trinexx',
    'Brinstar Kraid': 'Energy Tank, Kraid',
    'Wrecked Ship': null,  // No specific Phantoon location - completion based on other requirements
    'Maridia Inner': 'Missile (Draygon)',
    'Norfair Lower East': 'Energy Tank, Ridley'
  };

  // Find the region that has the specified reward
  console.log(`[smz3_CanAcquire] Searching for reward type ${rewardType} in ${Object.keys(rewardRegions).length} regions`);

  for (const [regionName, rewardInfo] of Object.entries(rewardRegions)) {
    if (rewardInfo.reward_type === rewardType) {
      // Found the region with this reward
      console.log(`[smz3_CanAcquire] Found region '${regionName}' with reward type ${rewardType}`);
      const bossLocationName = bossLocations[regionName];

      if (!bossLocationName) {
        console.log(`[smz3_CanAcquire] Region ${regionName} has no boss location, checking CanComplete logic`);

        // Implement CanComplete logic for regions without boss locations
        if (regionName === 'Castle Tower') {
          // Castle Tower (Agahnim) CanComplete requirements:
          // CanEnter: CanKillManyEnemies() && (Cape || MasterSword)
          // And: Lamp && KeyCT >= 2 && Sword

          const canKillManyEnemies = smz3_CanKillManyEnemies(snapshot, staticData);
          const hasCapeOrMasterSword = hasItem(snapshot, staticData, 'Cape') || getItemCount(snapshot, staticData, 'ProgressiveSword') >= 2;
          const canEnter = canKillManyEnemies && hasCapeOrMasterSword;

          const hasLamp = hasItem(snapshot, staticData, 'Lamp');
          const hasEnoughKeys = getItemCount(snapshot, staticData, 'KeyCT') >= 2;
          const hasSword = hasItem(snapshot, staticData, 'ProgressiveSword');

          const canComplete = canEnter && hasLamp && hasEnoughKeys && hasSword;

          console.log(`[smz3_CanAcquire] Castle Tower CanComplete:`, {
            canKillManyEnemies,
            hasCapeOrMasterSword,
            canEnter,
            hasLamp,
            hasEnoughKeys,
            hasSword,
            canComplete
          });

          console.log(`[smz3_CanAcquire] Returning ${canComplete} for Castle Tower`);
          return canComplete;
        } else if (regionName === 'Wrecked Ship') {
          // Wrecked Ship CanComplete: CanEnter && CanUnlockShip
          // CanUnlockShip: CardWreckedShipBoss && CanPassBombPassages
          // For now, we'll implement a simplified version
          // TODO: Implement full CanEnter logic for Wrecked Ship
          const hasCard = hasItem(snapshot, staticData, 'CardWreckedShipBoss');
          const canPassBomb = smz3_CanPassBombPassages(snapshot, staticData);
          const canUnlockShip = hasCard && canPassBomb;

          // Simplified CanEnter check - requires Super at minimum
          const hasSuper = hasItem(snapshot, staticData, 'Super');

          const canComplete = hasSuper && canUnlockShip;

          console.log(`[smz3_CanAcquire] Wrecked Ship CanComplete:`, {
            hasCard,
            canPassBomb,
            canUnlockShip,
            hasSuper,
            canComplete
          });

          return canComplete;
        }

        console.warn(`[smz3_CanAcquire] Region ${regionName} has no boss location and no CanComplete implementation, returning false`);
        return false;
      }

      // Check if the boss location is accessible
      // Find the boss location first (doesn't require evaluateRule)
      if (!staticData.regions) {
        console.warn('[smz3_CanAcquire] No regions data in staticData');
        return false;
      }

      // Find the boss location by searching through all regions
      let bossLocation = null;
      const regionsToSearch = staticData.regions instanceof Map ?
        Array.from(staticData.regions.values()) :
        Object.values(staticData.regions);

      for (const region of regionsToSearch) {
        if (region.locations) {
          bossLocation = region.locations.find(loc => loc.name === bossLocationName);
          if (bossLocation) {
            console.log(`[smz3_CanAcquire] Found boss location: ${bossLocationName} in region: ${region.name}`);
            break;
          }
        }
      }

      if (!bossLocation) {
        console.warn(`[smz3_CanAcquire] Boss location not found: ${bossLocationName}`);
        return false;
      }

      // Check if the location is accessible
      if (bossLocation.access_rule) {
        // For simple rules (AND with item_check), evaluate manually to avoid recursive evaluateRule calls
        // which can cause issues with the snapshot interface
        const rule = bossLocation.access_rule;

        // Handle simple AND rules with item_check conditions
        if (rule.type === 'and' && rule.conditions) {
          const allItemChecks = rule.conditions.every(cond => cond.type === 'item_check');
          if (allItemChecks) {
            // Log what items are being checked and what the player has
            const itemChecks = rule.conditions.map(cond => ({
              item: cond.item,
              required: true,
              has: hasItem(snapshot, staticData, cond.item),
              count: getItemCount(snapshot, staticData, cond.item)
            }));
            console.log(`[smz3_CanAcquire] Checking items for ${bossLocationName}:`, JSON.stringify(itemChecks));

            // Manually check all items
            const result = rule.conditions.every(cond => hasItem(snapshot, staticData, cond.item));
            console.log(`[smz3_CanAcquire] Manually evaluated boss location (${bossLocationName}):`, result);
            console.log(`[smz3_CanAcquire] Returning ${result} for region '${regionName}'`);
            return result;
          }
        }

        // For other rule types, try using evaluateRule if available
        if (snapshot.evaluateRule) {
          try {
            const result = snapshot.evaluateRule(bossLocation.access_rule);
            console.log(`[smz3_CanAcquire] Evaluated boss location (${bossLocationName}) via evaluateRule:`, result);
            console.log(`[smz3_CanAcquire] Returning ${result} for region '${regionName}'`);
            return result;
          } catch (error) {
            console.error(`[smz3_CanAcquire] Error evaluating boss location (${bossLocationName}):`, error);
            console.log(`[smz3_CanAcquire] Returning false for region '${regionName}' due to error`);
            return false;
          }
        } else {
          // snapshot.evaluateRule not available and rule is complex
          console.warn(`[smz3_CanAcquire] Cannot evaluate complex rule for ${bossLocationName}, snapshot.evaluateRule not available`);
          return false;
        }
      } else {
        // No access rule means always accessible
        console.log(`[smz3_CanAcquire] No access rule for boss location, returning true for region '${regionName}'`);
        return true;
      }
    }
  }

  console.warn(`[smz3_CanAcquire] No region found with reward type: ${rewardType}`);
  return false;
}

/**
 * Check if player can acquire ALL rewards of a specific type(s).
 * Python: def CanAcquireAll(self, items, rewardsMask):
 *     return all(region.CanComplete(items) for region in self.rewardLookup[rewardsMask.value])
 *
 * The rewardType parameter is a bit mask that can include multiple reward types:
 * - PendantGreen = 2
 * - PendantNonGreen = 4
 * - Both Pendants = 6 (2 | 4)
 * - CrystalRed = 16
 * - etc.
 *
 * @param {Object} snapshot - State snapshot
 * @param {Object} staticData - Static data (contains settings with reward_regions)
 * @param {number} rewardType - The reward type mask to check for
 */
export function smz3_CanAcquireAll(snapshot, staticData, rewardType) {
  console.log('[smz3_CanAcquireAll] Called with rewardType:', rewardType);

  // Get player slot
  const playerSlot = String(typeof snapshot.player === 'object' ? snapshot.player.slot : snapshot.player);

  // Get the reward_regions mapping from settings
  const settings = staticData.settings?.[playerSlot] || {};
  const rewardRegions = settings.reward_regions || {};

  // Find all regions that have rewards matching ANY bit in the mask
  const matchingRegions = [];
  for (const [regionName, rewardInfo] of Object.entries(rewardRegions)) {
    // Check if this region's reward type matches any bit in the mask
    if ((rewardInfo.reward_type & rewardType) !== 0) {
      matchingRegions.push({ name: regionName, rewardType: rewardInfo.reward_type });
    }
  }

  console.log(`[smz3_CanAcquireAll] Found ${matchingRegions.length} regions matching mask ${rewardType}`);

  // If no regions match, return false (can't acquire what doesn't exist)
  if (matchingRegions.length === 0) {
    console.log('[smz3_CanAcquireAll] No matching regions, returning false');
    return false;
  }

  // Check if ALL matching regions can be completed
  // NOTE: We need to check each unique region, not call CanAcquire with the reward type,
  // because multiple regions may have the same reward type (e.g., two non-green pendants).
  for (const region of matchingRegions) {
    // Instead of calling CanAcquire (which finds the FIRST region with a reward type),
    // we need to check THIS specific region's boss location directly.
    const canCompleteRegion = checkRegionCompletion(snapshot, staticData, region.name);
    if (!canCompleteRegion) {
      console.log(`[smz3_CanAcquireAll] Cannot complete region '${region.name}', returning false`);
      return false;
    }
  }

  console.log(`[smz3_CanAcquireAll] All ${matchingRegions.length} regions can be completed, returning true`);
  return true;
}

/**
 * Internal helper to check if a specific region can be completed.
 * This is similar to CanAcquire but checks a specific region by name instead of finding by reward type.
 */
function checkRegionCompletion(snapshot, staticData, regionName) {
  console.log(`[checkRegionCompletion] Checking region '${regionName}'`);

  // Boss location mapping: maps region name to boss location name
  const bossLocations = {
    'Castle Tower': null,  // No boss location - completion based on CanEnter + items
    'Eastern Palace': 'Eastern Palace - Armos Knights',
    'Desert Palace': 'Desert Palace - Lanmolas',
    'Tower of Hera': 'Tower of Hera - Moldorm',
    'Palace of Darkness': 'Palace of Darkness - Helmasaur King',
    'Swamp Palace': 'Swamp Palace - Arrghus',
    'Skull Woods': 'Skull Woods - Mothula',
    'Thieves\' Town': 'Thieves\' Town - Blind',
    'Ice Palace': 'Ice Palace - Kholdstare',
    'Misery Mire': 'Misery Mire - Vitreous',
    'Turtle Rock': 'Turtle Rock - Trinexx',
    'Brinstar Kraid': 'Energy Tank, Kraid',
    'Wrecked Ship': null,  // No specific Phantoon location - completion based on other requirements
    'Maridia Inner': 'Missile (Draygon)',
    'Norfair Lower East': 'Energy Tank, Ridley'
  };

  const bossLocationName = bossLocations[regionName];

  if (!bossLocationName) {
    console.log(`[checkRegionCompletion] Region ${regionName} has no boss location, checking CanComplete logic`);

    // Implement CanComplete logic for regions without boss locations
    if (regionName === 'Castle Tower') {
      // Castle Tower (Agahnim) CanComplete requirements:
      // CanEnter: CanKillManyEnemies() && (Cape || MasterSword)
      // And: Lamp && KeyCT >= 2 && Sword

      const canKillManyEnemies = smz3_CanKillManyEnemies(snapshot, staticData);
      const hasCapeOrMasterSword = hasItem(snapshot, staticData, 'Cape') || getItemCount(snapshot, staticData, 'ProgressiveSword') >= 2;
      const canEnter = canKillManyEnemies && hasCapeOrMasterSword;

      const hasLamp = hasItem(snapshot, staticData, 'Lamp');
      const hasEnoughKeys = getItemCount(snapshot, staticData, 'KeyCT') >= 2;
      const hasSword = hasItem(snapshot, staticData, 'ProgressiveSword');

      const canComplete = canEnter && hasLamp && hasEnoughKeys && hasSword;

      console.log(`[checkRegionCompletion] Castle Tower CanComplete:`, {
        canKillManyEnemies,
        hasCapeOrMasterSword,
        canEnter,
        hasLamp,
        hasEnoughKeys,
        hasSword,
        canComplete
      });

      return canComplete;
    } else if (regionName === 'Wrecked Ship') {
      // Wrecked Ship CanComplete: CanEnter && CanUnlockShip
      // CanUnlockShip: CardWreckedShipBoss && CanPassBombPassages
      const hasCard = hasItem(snapshot, staticData, 'CardWreckedShipBoss');
      const canPassBomb = smz3_CanPassBombPassages(snapshot, staticData);
      const canUnlockShip = hasCard && canPassBomb;

      // Simplified CanEnter check - requires Super at minimum
      const hasSuper = hasItem(snapshot, staticData, 'Super');

      const canComplete = hasSuper && canUnlockShip;

      console.log(`[checkRegionCompletion] Wrecked Ship CanComplete:`, {
        hasCard,
        canPassBomb,
        canUnlockShip,
        hasSuper,
        canComplete
      });

      return canComplete;
    }

    console.warn(`[checkRegionCompletion] Region ${regionName} has no boss location and no CanComplete implementation, returning false`);
    return false;
  }

  // Find the boss location in staticData
  let bossLocation = null;
  const regionsToSearch = staticData.regions instanceof Map ?
    Array.from(staticData.regions.values()) :
    Object.values(staticData.regions);

  for (const region of regionsToSearch) {
    if (region.locations) {
      bossLocation = region.locations.find(loc => loc.name === bossLocationName);
      if (bossLocation) {
        console.log(`[checkRegionCompletion] Found boss location: ${bossLocationName} in region: ${region.name}`);
        break;
      }
    }
  }

  if (!bossLocation) {
    console.error(`[checkRegionCompletion] Could not find boss location: ${bossLocationName}`);
    return false;
  }

  // Check if the location is accessible
  if (bossLocation.access_rule) {
    // For simple rules (AND with item_check), evaluate manually to avoid recursive evaluateRule calls
    // which can cause issues with the snapshot interface
    const rule = bossLocation.access_rule;

    // Handle simple AND rules with item_check conditions
    if (rule.type === 'and' && rule.conditions) {
      const allItemChecks = rule.conditions.every(cond => cond.type === 'item_check');
      if (allItemChecks) {
        // Manually check all items
        const result = rule.conditions.every(cond => hasItem(snapshot, staticData, cond.item));
        console.log(`[checkRegionCompletion] Manually evaluated boss location (${bossLocationName}):`, result);
        return result;
      }
    }

    // For other rule types, try using evaluateRule if available
    if (snapshot.evaluateRule) {
      try {
        const result = snapshot.evaluateRule(bossLocation.access_rule);
        console.log(`[checkRegionCompletion] Evaluated boss location (${bossLocationName}) via evaluateRule:`, result);
        return result;
      } catch (error) {
        console.error(`[checkRegionCompletion] Error evaluating boss location (${bossLocationName}):`, error);
        return false;
      }
    } else {
      // snapshot.evaluateRule not available and rule is complex
      console.warn(`[checkRegionCompletion] Cannot evaluate complex rule for ${bossLocationName}, snapshot.evaluateRule not available`);
      return false;
    }
  } else {
    // No access rule means always accessible
    console.log(`[checkRegionCompletion] No access rule for boss location, returning true for region '${regionName}'`);
    return true;
  }
}
