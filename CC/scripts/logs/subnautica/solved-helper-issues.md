# Solved Helper Issues for Subnautica

## Issue 1: Incorrect Helper Function Signature
**Problem**: Helper functions were using `state.has()` as if `state` was an interface object with methods, resulting in "state.has is not a function" errors.

**Solution**: Rewrote all helper functions to use the correct signature `(snapshot, staticData, ...args)` where:
- `snapshot` contains inventory, flags, events, regionReachability
- `staticData` contains items, regions, locations, settings
- Helpers check inventory directly using `snapshot.inventory[itemName]`

**Files Modified**:
- `frontend/modules/shared/gameLogic/subnautica/helpers.js` - Rewrote all helpers with correct signature

**Commit**: Initial commit

## Issue 2: Missing Game Logic Registration
**Problem**: Helper functions were not being found because Subnautica was not registered in the game logic registry.

**Solution**: Added Subnautica to the GAME_REGISTRY in gameLogicRegistry.js with:
- Import of subnauticaLogic module
- Registry entry with SubnauticaWorld class and helper functions

**Files Modified**:
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` - Added Subnautica registration

**Commit**: Initial commit

## Issue 3: Depth Calculation Default Settings
**Problem**: The frontend was using incorrect default settings for swim_rule, defaulting to `consider_items: true` instead of `false`, which made deep locations accessible too early.

**Solution**: Fixed the default swim_rule settings to match Python Option class defaults:
- Default is option_easy (0): `base_depth: 200, consider_items: false`
- This prevents item bonuses from being applied unless explicitly enabled in settings

**Files Modified**:
- `frontend/modules/shared/gameLogic/subnautica/helpers.js` - Fixed get_max_swim_depth default

**Commit**: Second commit

## Issue 4: Location Dependency (room.can_reach())
**Problem**: The "Repair Aurora Drive" location used a closure variable `room` that referenced another location ("Aurora Drive Room - Upgrade Console"). The rule `room.can_reach(state)` couldn't be resolved by the frontend.

**Solution**: Updated the Subnautica exporter to detect this pattern and expand it to use the same access rule as the prerequisite location. Since both locations are in the same area with the same requirements (propulsion cannon, same position), we copy the access rule.

**Files Modified**:
- `exporter/games/subnautica.py` - Added pattern detection and rule expansion
- `frontend/modules/shared/gameLogic/subnautica/helpers.js` - Added can_reach_location helper (for future use)
- `frontend/modules/shared/gameLogic/subnautica/subnauticaLogic.js` - Registered can_reach_location helper

**Commit**: Second commit
