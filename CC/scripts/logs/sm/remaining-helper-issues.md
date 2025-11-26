# Super Metroid Helper Function Issues - Remaining

## Seed 10: Lower Norfair / Ridley Zone Access
- **Seed affected**: Seed 10 (AP_55941320597534372051), Sphere 6.1
- **Test result**: FAIL at sphere 6.1
- **Symptoms**: Regions accessible in LOG but NOT in STATE:
  - Energy Tank, Ridley
  - Power Bomb (Power Bombs of shame)
  - Ridley, Ridley Zone, RidleyRoomIn, RidleyRoomOut
  - Screw Attack, Screw Attack Bottom
  - Single Chamber Top Right
  - Three Muskateers Room Left
  - Wasteland
  - Firefleas, Firefleas Top
- **Analysis**:
  - At sphere 6.1, player receives "Varia Suit" from "Energy Tank, Crocomire"
  - Varia Suit should provide full heat protection via `heatProof()` function
  - The path to Ridley Zone is: LN Entrance -> Firefleas -> Ridley Zone
  - Exit rules require `canHellRun("LowerNorfair", 1.0, 8)`
  - LowerNorfair preset is `null` (requires suits/heat protection)
  - With Varia Suit, `heatProof()` should return `{bool: true}` and `canHellRun` should pass
- **Suspected cause**: Item recognition or state update timing issue
  - Possible: Varia Suit not being properly detected when checking `haveItem('Varia')`
  - Possible: Region reachability not being recalculated after item is added
  - Possible: Type-based item lookup not working for "Varia Suit" -> "Varia"
- **Debug steps**:
  1. Add logging to `haveItem('Varia')` to verify it returns true after Varia Suit is added
  2. Add logging to `heatProof()` to verify it returns `{bool: true}` with Varia Suit
  3. Check if region reachability is being properly recalculated
- **Files to investigate**:
  - `frontend/modules/shared/gameLogic/sm/smLogic.js`: haveItem, heatProof, canHellRun
  - `frontend/modules/stateManager/`: How regions are recalculated after state changes
- **Priority**: Medium (seed 5 passes, seed 10 fails at later sphere)
