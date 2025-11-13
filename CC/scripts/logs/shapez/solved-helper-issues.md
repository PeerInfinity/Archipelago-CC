# Shapez Solved Helper Issues

## Issue 1: Missing basic helper functions - PARTIALLY FIXED

**Status:** Partially Fixed
**Priority:** High
**Type:** Helper Functions
**Date Fixed:** 2025-11-13

### Description
Most shapez helper functions were not implemented in the frontend, causing test failures at sphere 0.6.

### Solution
Created `frontend/modules/shared/gameLogic/shapez/` directory with:
- `shapezLogic.js` - Game logic registration module
- `helpers.js` - All helper function implementations

### Helper Functions Implemented
- `can_cut_half` - Check for Cutter item
- `can_rotate_90` - Check for rotation capability
- `can_rotate_180` - Check for 180° rotation capability
- `can_stack` - Check for Stacker item
- `can_paint` - Check for painting capability
- `can_mix_colors` - Check for Color Mixer
- `has_tunnel` - Check for tunnel buildings
- `has_balancer` - Check for balancer or compact merger/splitter combo
- `can_use_quad_painter` - Check for quad painter with wires and switch/signal
- `can_make_stitched_shape` - Complex shape creation logic
- `can_build_mam` - MAM building requirements
- `can_make_east_windmill` - Windmill shape creation
- `can_make_half_half_shape` - Half-half shape creation
- `can_make_half_shape` - Half shape creation
- `has_x_belt_multiplier` - Belt speed multiplier calculation
- `has_logic_list_building` - Building logic progression check

### Files Modified
- Created: `frontend/modules/shared/gameLogic/shapez/shapezLogic.js`
- Created: `frontend/modules/shared/gameLogic/shapez/helpers.js`
- Modified: `frontend/modules/shared/gameLogic/gameLogicRegistry.js` - Added shapez to registry

### Result
Test now progresses from sphere 0.6 to sphere 4.9 before encountering issues.

### Remaining Issues
The test fails at sphere 4.9 with regions "Levels with X buildings" and "Upgrades with X buildings" not being reachable. Investigation showed this is a state manager issue, not a helper function issue. See `remaining-helper-issues.md` for details.

## Issue 2: OPTIONS constants not resolved - FIXED

**Status:** Fixed
**Priority:** High
**Type:** Frontend Name Resolution
**Date Fixed:** 2025-11-13

### Description
The access rules for "Levels with X buildings" and "Upgrades with X buildings" regions contained comparisons like `"3_buildings" == OPTIONS.buildings_3`, but OPTIONS was not defined in the frontend context, causing attribute resolution to fail.

### Solution
Added OPTIONS name resolution to `frontend/modules/shared/stateInterface.js` (lines 329-351):
- Added case for 'OPTIONS' in resolveName function
- Returns object with all OPTIONS constants from worlds/shapez/data/strings.py
- Game-specific check ensures it only applies to shapez

### OPTIONS Constants Supported
All constants from worlds/shapez/data/strings.py OPTIONS class:
- Logic options: vanilla, stretched, quick, random_steps, hardcore, dopamine, etc.
- Early useful: sphere_1, buildings_3, buildings_5

### Files Modified
- Modified: `frontend/modules/shared/stateInterface.js` - Added OPTIONS case to resolveName

### Verification
- OPTIONS.buildings_3 now resolves to "3_buildings"
- OPTIONS.buildings_5 now resolves to "5_buildings"
- Comparison rules evaluate correctly: `"3_buildings" == OPTIONS.buildings_3` = true
- Helper functions receive correct includeuseful parameter values

### Result
Access rule comparisons now evaluate correctly, allowing helper functions to receive the proper parameters.
