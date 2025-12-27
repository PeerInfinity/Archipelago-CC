# Super Metroid - Solved Helper Issues

## Issue 1: smLogic.js looking for settings at wrong path (SOLVED)

### Problem
The smLogic.js helper functions were looking for settings at `staticData?.settings?.[playerId]` but the data was actually at `staticData?.world?.[playerId]`.

### Root Cause
The stateInterface's `getStaticData()` method returns a structure where:
- `world` key contains the world data (game, options, runtime attributes, SM settings)
- There is no `settings` key

The smLogic.js was incorrectly accessing `staticData?.settings?.[playerId]?.knows` instead of `staticData?.world?.[playerId]?.knows`.

### Solution
Updated all references in `frontend/modules/shared/gameLogic/sm/smLogic.js`:
- Changed `staticData?.settings?.[playerId]?.knows` to `staticData?.world?.[playerId]?.knows`
- Changed `staticData?.settings?.[playerId]?.romPatches` to `staticData?.world?.[playerId]?.romPatches`
- Changed `staticData?.settings?.[playerId]?.hellRuns` to `staticData?.world?.[playerId]?.hellRuns`
- Changed `staticData?.settings?.[playerId]` to `staticData?.world?.[playerId]` for playerSettings

### Affected Functions
- `knowsShortCharge`
- `knowsMockball`
- `canHellRun`
- `heatProof`
- `getDmgReduction`
- `energyReserveCountOkHardRoom`
- `canPassLNCathodeSJGate`
- Various other knows* functions

### Verification
After both fixes (exporter + helper path), the spoiler test passes for all 52 events including Sphere 2.1 which tests energy tank gauntlet access.
