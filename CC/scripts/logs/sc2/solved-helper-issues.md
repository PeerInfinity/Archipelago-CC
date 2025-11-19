# Solved SC2 Helper Issues

## Fixed Issue 1: terran_defense_rating() was incomplete

**Location:** `frontend/modules/shared/gameLogic/sc2/helpers.js:306-395`

**Problem Fixed:**
1. Added missing base defense ratings (Banshee: 1, updated Liberator to 4, added Widow Mine: 1)
2. Fixed Manned Bunker bonus from +2 to +3
3. Added Firebat+Bunker special case for zerg enemies (+2)
4. Added Viking with Shredder Rounds bonus (+2)
5. Added zerg-specific defense ratings (Perdition Turret: +2, Liberator: -2, Hive Mind Emulator: +3, Psi Disrupter: +3)
6. Added air-specific defense ratings (Missile Turret: +2)

## Fixed Issue 2: enemy_intelligence helper functions structure

**Location:** `frontend/modules/shared/gameLogic/sc2/helpers.js`

**Problem Fixed:**
1. Moved `enemy_intelligence_second_stage_requirement` and `enemy_intelligence_third_stage_requirement` from inline definitions to exported functions (lines 195-234)
2. Fixed third stage to call second stage instead of duplicating logic
3. Created exported `nova_dash` function (lines 296-298)
4. Updated third stage to call `nova_dash` instead of inlining the logic
5. Updated default export to reference these functions instead of inline definitions

**Impact:** No more JavaScript errors, helpers are properly structured and can call each other
