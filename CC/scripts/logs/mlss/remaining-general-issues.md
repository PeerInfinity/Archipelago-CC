# MLSS Remaining General Issues

This document tracks remaining general issues for Mario & Luigi Superstar Saga.

## Issues

### Issue 1: PostJokes region not becoming reachable at Sphere 6.5

**Error:** Test fails at Sphere 6.5 with "Region PostJokes is not reachable"
**Sphere:** 6.5 - Player receives "Peach's Extra Dress"
**Expected:** Regions PostJokes, Shop Birdo Flag, Bowser's Castle, etc. should become reachable
**Actual:** These regions remain unreachable even though the diagnostic shows the access rules evaluate to true

**Analysis:**
- The diagnostic code in `analysisReporter.js` evaluates the exit's access rule and it returns TRUE
- However, the StateManager's BFS traversal is not marking the region as reachable
- This suggests a potential issue with:
  1. The BFS iteration not re-evaluating after indirect connections become available
  2. A difference between how the diagnostic evaluates rules vs the state manager
  3. The `postJokes` helper working in the diagnostic but failing during BFS

**Items available at Sphere 6.5:**
- All 3 Hammers (ultra)
- Green Goblet, Red Goblet (canDig, canMini)
- Red Pearl Bean, Firebrand (canDash)
- Green Pearl Bean, Thunderhand (canCrash)
- All 3 Chuckola Fruits (fruits)
- All 4 Beanstar Pieces (pieces)
- Beanbean Brooch (brooch)
- Peasley's Rose (rose)
- Peach's Extra Dress, Fake Beanstar (dressBeanstar)
- Membership Card (membership)

With goal=0 (vanilla), `postJokes` should return TRUE with all these items.

**Status:** Under investigation

**Files Modified:**
- `exporter/games/mlss.py` - Exporter with shop helper expansion and setting_value.value fix
- `frontend/modules/shared/gameLogic/mlss/helpers.js` - All helper functions
- `frontend/modules/shared/gameLogic/mlss/mlssLogic.js` - Module exports
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` - Registry entry
