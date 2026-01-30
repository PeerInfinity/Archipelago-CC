# Solved General Issues - Starcraft 2

This document tracks resolved general issues for SC2.

## Resolved Issues

### Issue #1: resolveName calling helpers with default args instead of rule args
**Date Resolved**: 2026-01-30
**Symptom**: `terran_competent_comp(upgradeLevel=2)` rules were evaluating with `upgradeLevel=1` (the default), causing locations to appear accessible earlier than they should be.

**Root Cause**: In `statePersistence.js`, the `resolveName` function had an optimization that called helper functions directly if `function.length <= 2`. However, JavaScript's `function.length` doesn't count parameters with default values. So `terran_competent_comp(snapshot, staticData, upgradeLevel = 1)` has `length === 2` and was being called directly with the default `upgradeLevel=1` instead of passing to the rule engine to supply the actual argument.

**Fix**:
1. Added `helpersWithOptionalArgs` Set in `frontend/modules/shared/gameLogic/sc2/sc2Logic.js` listing helpers that have optional parameters
2. Updated `statePersistence.js` to check this Set before calling helpers directly
3. Updated `gameLogicRegistry.js` to include `helpersWithOptionalArgs` in the SC2 config and return it from `getGameLogic()`

**Files Modified**:
- `frontend/modules/shared/gameLogic/sc2/sc2Logic.js` (added `helpersWithOptionalArgs` Set)
- `frontend/modules/stateManager/core/statePersistence.js` (check Set before direct helper call)
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` (include in SC2 config and `getGameLogic()` return)

**Helpers affected**:
- `terran_competent_comp`
- `zerg_competent_comp`
- `protoss_competent_comp`
- `terran_beats_protoss_deathball`
- `terran_defense_rating`
- `zerg_defense_rating`
- `protoss_defense_rating`
- `soa_defense_rating`
