# Super Metroid - Remaining General Issues

This document tracks other outstanding issues not specific to the exporter or helper functions.

## Status

One issue remains under investigation.

## Open Issues

### Issue: Lower Norfair region accessibility (seed 10)

**Status**: Under investigation

**Problem**: In seed 10, the spoiler test fails at sphere 6.1 because the frontend cannot reach Lower Norfair regions (Ridley Zone, RidleyRoomIn, RidleyRoomOut, etc.) even though the Python spoiler LOG says they should be accessible.

**Symptoms**:
- Locations accessible in LOG but NOT in STATE: Power Bomb (Power Bombs of shame), Ridley
- Regions accessible in LOG but NOT in STATE: Energy Tank, Ridley, Power Bomb (Power Bombs of shame), Ridley, Ridley Zone, RidleyRoomIn, RidleyRoomOut, Single Chamber Top Right, Three Muskateers Room Left, Wasteland

**Observed state at sphere 6.1**:
- Player has: Varia Suit, Power Bomb (x2), HiJump, 9 Energy Tanks, 1 Reserve Tank
- LavaDive technique enabled with difficulty 50
- maxDiff = 50 (hardcore)

**Path analysis**:
- Lava Dive Right is reachable (from sphere 4.2)
- Exit: Lava Dive Right -> LN Entrance (via canPassLavaPit)
- canPassLavaPit should pass with LavaDive technique:
  - diveTech = wor(wand(knowsLavaDive, HiJump), knowsLavaDiveNoHiJump) = true (difficulty 50)
  - energyReserveCountOk(2) = true (10 reserves >= 2 needed)
  - canUsePowerBombs = true
  - Total difficulty: 50 (from LavaDive)
  - With maxDiff = 50, this should pass

**Possible causes**:
1. The region reachability check may not be propagating SMBool difficulty correctly through the exit chain
2. The haveItem('Varia') lookup might not be working correctly in the frontend context
3. There may be an intermediate region or exit that's not passing its requirements

**Seeds tested**:
- Seed 1: PASS
- Seed 4: PASS
- Seed 5: PASS
- Seed 10: FAIL (this issue)

**Files to investigate**:
- `frontend/modules/shared/gameLogic/sm/smLogic.js` (canPassLavaPit, haveItem)
- Region reachability calculation in StateManager
- How exit rules are evaluated for SMBool difficulty
