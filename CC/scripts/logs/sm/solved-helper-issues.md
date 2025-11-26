# Super Metroid Helper Function Issues - Solved

## 2025-11-26: knowsMtEverestGravJump / knowsTediousMountEverest
- **Problem**: These functions always returned `{bool: true}` instead of checking exported knows settings
- **Seed affected**: Seed 4, Sphere 3.2
- **Symptoms**: Regions accessible in STATE but NOT in LOG (Red Fish Room Left, Red Fish Room Bottom, Caterpillar Room Top Right)
- **Root cause**: Hardcoded return value didn't respect VARIA preset settings where MtEverestGravJump is disabled
- **Fix**: Updated both functions to check `staticData.settings[playerId].knows` for the enabled/difficulty values
- **File**: `frontend/modules/shared/gameLogic/sm/smLogic.js`

## 2025-11-26: canHellRun threshold rounding
- **Problem**: Used `Math.ceil()` instead of `Math.round()` for threshold calculation
- **Seed affected**: Seed 4, Sphere 3.11
- **Symptoms**: Regions accessible in LOG but NOT in STATE (Cathedral, Missile (lava room))
- **Root cause**: Python uses `normalizeRounding()` which is `int(round(n))`, not ceiling
- **Fix**: Changed `Math.ceil(threshold / effectiveMult)` to `Math.round(threshold / effectiveMult)`
- **File**: `frontend/modules/shared/gameLogic/sm/smLogic.js`

## 2025-11-26: canDefeatBotwoon too restrictive
- **Problem**: Required Charge + (Wave OR Plasma), but Python allows Charge alone
- **Seed affected**: Seed 5, Sphere 6.1
- **Symptoms**: Botwoon location not accessible when it should be
- **Root cause**: Python's `canInflictEnoughDamages(6000)` returns true if `chargeDamage > 0` (Charge beam does 20*3=60 damage per shot)
- **Fix**: Changed requirement to just `haveItem('Charge')` OR enough ammo
- **File**: `frontend/modules/shared/gameLogic/sm/smLogic.js`

## 2025-11-26: divideByDmgReduction helper (new)
- **Problem**: Rules contained `energyReserveCountOk(X / sm.getDmgReduction()[0])` which couldn't be evaluated
- **Seed affected**: Seed 10, Sphere 5.1 (Energy Tank, Crocomire)
- **Symptoms**: Access rule evaluation failed for location
- **Root cause**: Frontend couldn't evaluate complex `sm.getDmgReduction()[0]` expression
- **Fix**: Added `divideByDmgReduction(value)` helper function and exporter transformation
- **Files**:
  - `exporter/games/sm.py`: Added `_is_getDmgReduction_reference()` and binary_op transformation
  - `frontend/modules/shared/gameLogic/sm/smLogic.js`: Added `divideByDmgReduction()` helper
