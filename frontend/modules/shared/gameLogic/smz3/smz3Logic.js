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

/**
 * Helper function to check if player has an item.
 * @param {Object} snapshot - State snapshot
 * @param {string} itemName - Name of the item
 * @returns {boolean} True if player has the item
 */
function hasItem(snapshot, itemName) {
  if (!snapshot.inventory) return false;
  return (snapshot.inventory[itemName] || 0) > 0;
}

/**
 * Helper function to get item count.
 * @param {Object} snapshot - State snapshot
 * @param {string} itemName - Name of the item
 * @returns {number} Count of the item
 */
function getItemCount(snapshot, itemName) {
  if (!snapshot.inventory) return 0;
  return snapshot.inventory[itemName] || 0;
}

// ====================
// ALTTP Helper Functions
// ====================

/**
 * Check if player can lift light objects (requires Power Glove).
 * Python: def CanLiftLight(self): return self.Glove
 * Note: Uses ProgressiveGlove >= 1
 */
export function smz3_CanLiftLight(snapshot, staticData) {
  return hasItem(snapshot, 'ProgressiveGlove');
}

/**
 * Check if player can lift heavy objects (requires Titans Mitts).
 * Python: def CanLiftHeavy(self): return self.Mitt
 * Note: Uses ProgressiveGlove >= 2
 */
export function smz3_CanLiftHeavy(snapshot, staticData) {
  return getItemCount(snapshot, 'ProgressiveGlove') >= 2;
}

/**
 * Check if player can light torches (Lamp or Fire Rod).
 * Python: def CanLightTorches(self): return self.Firerod or self.Lamp
 */
export function smz3_CanLightTorches(snapshot, staticData) {
  return hasItem(snapshot, 'Firerod') || hasItem(snapshot, 'Lamp');
}

/**
 * Check if player can melt Freezors (Fire Rod or Bombos + Sword).
 * Python: def CanMeltFreezors(self): return self.Firerod or self.Bombos and self.Sword
 */
export function smz3_CanMeltFreezors(snapshot, staticData) {
  return hasItem(snapshot, 'Firerod') ||
         (hasItem(snapshot, 'Bombos') && hasItem(snapshot, 'ProgressiveSword'));
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
  const halfMagicMultiplier = hasItem(snapshot, 'HalfMagic') ? 2 : 1;
  const bottleMultiplier = hasItem(snapshot, 'Bottle') ? 2 : 1;
  return halfMagicMultiplier * bottleMultiplier >= bars;
}

/**
 * Check if player can kill many enemies (various weapons).
 * Python: def CanKillManyEnemies(self):
 *     return self.Sword or self.Hammer or self.Bow or self.Firerod or \
 *            self.Somaria or self.Byrna and self.CanExtendMagic()
 */
export function smz3_CanKillManyEnemies(snapshot, staticData) {
  return hasItem(snapshot, 'ProgressiveSword') ||
         hasItem(snapshot, 'Hammer') ||
         hasItem(snapshot, 'Bow') ||
         hasItem(snapshot, 'Firerod') ||
         hasItem(snapshot, 'Somaria') ||
         (hasItem(snapshot, 'Byrna') && smz3_CanExtendMagic(snapshot, staticData, 2));
}

// ====================
// Super Metroid Helper Functions
// ====================

/**
 * Check if player can infinite bomb jump (Morph Ball + Bombs).
 * Python: def CanIbj(self): return self.Morph and self.Bombs
 */
export function smz3_CanIbj(snapshot, staticData) {
  return hasItem(snapshot, 'Morph') && hasItem(snapshot, 'Bombs');
}

/**
 * Check if player can fly (Space Jump or IBJ).
 * Python: def CanFly(self): return self.SpaceJump or self.CanIbj()
 */
export function smz3_CanFly(snapshot, staticData) {
  return hasItem(snapshot, 'SpaceJump') || smz3_CanIbj(snapshot, staticData);
}

/**
 * Check if player can use Power Bombs (Morph Ball + Power Bomb).
 * Python: def CanUsePowerBombs(self): return self.Morph and self.PowerBomb
 */
export function smz3_CanUsePowerBombs(snapshot, staticData) {
  return hasItem(snapshot, 'Morph') && hasItem(snapshot, 'PowerBomb');
}

/**
 * Check if player can pass bomb passages (Morph Ball + (Bombs or Power Bomb)).
 * Python: def CanPassBombPassages(self): return self.Morph and (self.Bombs or self.PowerBomb)
 */
export function smz3_CanPassBombPassages(snapshot, staticData) {
  return hasItem(snapshot, 'Morph') &&
         (hasItem(snapshot, 'Bombs') || hasItem(snapshot, 'PowerBomb'));
}

/**
 * Check if player can destroy bomb walls (CanPassBombPassages or Screw Attack).
 * Python: def CanDestroyBombWalls(self): return self.CanPassBombPassages() or self.ScrewAttack
 */
export function smz3_CanDestroyBombWalls(snapshot, staticData) {
  return smz3_CanPassBombPassages(snapshot, staticData) || hasItem(snapshot, 'ScrewAttack');
}

/**
 * Check if player can spring ball jump (Morph Ball + Spring Ball).
 * Python: def CanSpringBallJump(self): return self.Morph and self.SpringBall
 */
export function smz3_CanSpringBallJump(snapshot, staticData) {
  return hasItem(snapshot, 'Morph') && hasItem(snapshot, 'SpringBall');
}

/**
 * Check if player can survive heat (Varia Suit or 5+ Energy Reserves).
 * Python: def CanHellRun(self): return self.Varia or self.HasEnergyReserves(5)
 */
export function smz3_CanHellRun(snapshot, staticData) {
  return hasItem(snapshot, 'Varia') || smz3_HasEnergyReserves(snapshot, staticData, 5);
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
  const eTanks = getItemCount(snapshot, 'ETank');
  const reserveTanks = getItemCount(snapshot, 'ReserveTank');
  return (eTanks + reserveTanks) >= amount;
}

/**
 * Check if player can open red doors (Missile or Super Missile).
 * Python: def CanOpenRedDoors(self): return self.Missile or self.Super
 */
export function smz3_CanOpenRedDoors(snapshot, staticData) {
  return hasItem(snapshot, 'Missile') || hasItem(snapshot, 'Super');
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
  return (smz3_CanDestroyBombWalls(snapshot, staticData) || hasItem(snapshot, 'SpeedBooster')) &&
         hasItem(snapshot, 'Super') &&
         hasItem(snapshot, 'Morph');
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
  return hasItem(snapshot, 'CardMaridiaL1') &&
         hasItem(snapshot, 'CardMaridiaL2') &&
         smz3_CanUsePowerBombs(snapshot, staticData) &&
         hasItem(snapshot, 'Super') &&
         hasItem(snapshot, 'Gravity') &&
         hasItem(snapshot, 'SpeedBooster');
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
  return (hasItem(snapshot, 'CardNorfairL2') ||
          (hasItem(snapshot, 'SpeedBooster') && hasItem(snapshot, 'Wave'))) &&
         hasItem(snapshot, 'Varia') &&
         hasItem(snapshot, 'Super') &&
         hasItem(snapshot, 'Gravity') &&
         hasItem(snapshot, 'SpaceJump') &&
         smz3_CanUsePowerBombs(snapshot, staticData);
}

/**
 * Check if player can access Norfair Upper portal.
 * Python: def CanAccessNorfairUpperPortal(self):
 *     return self.Flute or self.CanLiftLight() and self.Lamp
 */
export function smz3_CanAccessNorfairUpperPortal(snapshot, staticData) {
  return hasItem(snapshot, 'Flute') ||
         (smz3_CanLiftLight(snapshot, staticData) && hasItem(snapshot, 'Lamp'));
}

/**
 * Check if player can access Norfair Lower portal.
 * Python: def CanAccessNorfairLowerPortal(self):
 *     return self.Flute and self.CanLiftHeavy()
 */
export function smz3_CanAccessNorfairLowerPortal(snapshot, staticData) {
  return hasItem(snapshot, 'Flute') && smz3_CanLiftHeavy(snapshot, staticData);
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
  return hasItem(snapshot, 'MoonPearl') &&
         hasItem(snapshot, 'Flippers') &&
         hasItem(snapshot, 'Gravity') &&
         hasItem(snapshot, 'Morph') &&
         (hasItem(snapshot, 'Hammer') && smz3_CanLiftLight(snapshot, staticData) ||
          smz3_CanLiftHeavy(snapshot, staticData));
}
