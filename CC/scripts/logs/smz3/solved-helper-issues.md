# SMZ3 Solved Helper Issues

## Summary
SMZ3 helper functions that have been implemented and verified

## Implemented Helpers

### ALTTP Helpers
- ✅ `smz3_CanLiftLight()` - Check for Power Glove (ProgressiveGlove >= 1)
- ✅ `smz3_CanLiftHeavy()` - Check for Titans Mitts (ProgressiveGlove >= 2)
- ✅ `smz3_CanLightTorches()` - Firerod OR Lamp
- ✅ `smz3_CanMeltFreezors()` - Firerod OR (Bombos AND Sword)
- ✅ `smz3_CanExtendMagic(bars)` - Half Magic and/or Bottle calculations
- ✅ `smz3_CanKillManyEnemies()` - Various combat options
- ✅ `smz3_CanBeatBoss()` - Generic boss defeat requirements

### Super Metroid Helpers
- ✅ `smz3_CanIbj()` - Infinite bomb jump (Morph + Bombs)
- ✅ `smz3_CanFly()` - Space Jump OR IBJ
- ✅ `smz3_CanUsePowerBombs()` - Morph + Power Bomb
- ✅ `smz3_CanPassBombPassages()` - Morph + (Bombs OR Power Bomb)
- ✅ `smz3_CanDestroyBombWalls()` - CanPassBombPassages OR Screw Attack
- ✅ `smz3_CanSpringBallJump()` - Morph + Spring Ball
- ✅ `smz3_CanHellRun()` - Varia OR HasEnergyReserves(5)
- ✅ `smz3_HasEnergyReserves(amount)` - ETank + ReserveTank count check
- ✅ `smz3_CanOpenRedDoors()` - Missile OR Super

### Portal Access Helpers
- ✅ `smz3_CanAccessDeathMountainPortal()` - (CanDestroyBombWalls OR SpeedBooster) AND Super AND Morph
- ✅ `smz3_CanAccessDarkWorldPortal()` - Complex Maridia requirements
- ✅ `smz3_CanAccessMiseryMirePortal()` - Complex Norfair requirements
- ✅ `smz3_CanAccessNorfairUpperPortal()` - Flute OR (CanLiftLight AND Lamp)
- ✅ `smz3_CanAccessNorfairLowerPortal()` - Flute AND CanLiftHeavy
- ✅ `smz3_CanAccessMaridiaPortal()` - Simplified portal access logic

### Region-Specific Helpers
- ✅ `smz3_CanExit()` - Norfair Lower East exit logic (Morph + various routes)

### Dungeon/Reward Helpers
- ✅ `smz3_CanAcquire(rewardType)` - Check if player can acquire a specific reward (pendant/crystal/boss token)
  - Searches reward_regions for matching reward
  - Checks boss location accessibility
  - Implements CanComplete logic for Castle Tower and Wrecked Ship
  - **Status**: Implemented with comprehensive logging
  - **Note**: May need refinement based on test results
