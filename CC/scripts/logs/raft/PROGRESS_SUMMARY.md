# Raft Exporter Setup - Progress Summary

## Overview
Significant progress has been made on implementing Raft game support for the spoiler testing system. The exporter and helper functions are now functional, with Sphere 0 (initial state) passing all tests.

## ✅ Completed Tasks

### 1. Environment Setup
- Configured Python virtual environment
- Installed all required dependencies (Python, Node.js, Playwright)
- Generated template YAML files
- Configured host settings

### 2. Raft Exporter Implementation
**File**: `exporter/games/raft.py`

Created a comprehensive custom exporter that:
- Inherits from `GenericGameExportHandler`
- Implements `override_rule_analysis()` to resolve Raft's unique rule patterns
- Loads `locations.json` to map locations to regions and item requirements
- Loads `progressives.json` to build progression_mapping
- Generates custom helper function calls for item checks
- Properly handles region-based access rules

**Key Achievement**: Resolved complex dictionary lookup patterns that were causing unresolvable `function_call` structures in the exported rules.

### 3. Frontend Helper Functions
**File**: `frontend/modules/shared/gameLogic/raft/raftLogic.js`

Implemented 60+ helper functions including:
- **Item Check Helpers** (`raft_itemcheck_*`):
  - Basic materials (Plank, Plastic, Clay, etc.) - always accessible
  - Smelted items (MetalIngot, CopperIngot, VineGoo, Glass)
  - Crafted items (Bolt, Hinge, CircuitBoard, etc.)
  - Special items (Machete, Zipline tool)

- **Region Access Helpers**:
  - `raft_can_access_radio_tower()`
  - `raft_can_access_vasagatan()`
  - `raft_can_access_balboa_island()`
  - `raft_can_access_caravan_island()`
  - `raft_can_access_tangaroa()`
  - `raft_can_access_varuna_point()`
  - `raft_can_access_temperance()`
  - `raft_can_access_utopia()`

- **Crafting Helpers**:
  - Smelting (`raft_can_smelt_items()`)
  - Crafting specific items (bolt, hinge, battery, circuit board, etc.)
  - Tool crafting (shovel, machete, zipline tool, etc.)
  - Animal capture system

- **Navigation Helpers**:
  - `raft_can_navigate()` - requires receiver and antenna
  - `raft_can_drive()` - requires engine and steering wheel

- **Progressive Item Support**:
  - Updated `has()` helper to resolve progressive items
  - Checks progression_mapping to determine if player has reached required tier

### 4. Game Registration
- Added Raft to `gameLogicRegistry.js`
- Registered with proper aliases and world classes

### 5. Documentation
Created comprehensive issue tracking in `CC/scripts/logs/raft/`:
- `remaining-exporter-issues.md` - Currently empty
- `solved-exporter-issues.md` - Documents regionChecks resolution
- `remaining-helper-issues.md` - Documents progressive item issue
- `solved-helper-issues.md` - Documents helper implementation
- `remaining-general-issues.md` - Currently empty
- `solved-general-issues.md` - Currently empty

## 📊 Test Results

### Current Status
- **Sphere 0**: ✅ PASSING
  - All 13 initially accessible locations correctly recognized:
    - Birds nest, Bucket, Clay bowl, Collection net, Lantern
    - Large trophy board, Medium crop plot, Medium trophy board
    - Paint mill, Scarecrow, Small trophy board, Smelter, Stone arrow

- **Sphere 0.2**: ❌ FAILING
  - 9 locations not recognized as accessible when they should be
  - Progressive item resolution issue

## ❌ Remaining Issues

### Critical: Progressive Item Resolution in Sphere 0.2

**Problem**: When player receives `progressive-metals` (count: 1), which should resolve to "Smelter", the following locations are not recognized as accessible:
- Advanced grill
- Advanced purifier
- Battery
- Bolt
- Circuit board
- Drinking glass
- Empty bottle
- Flippers
- Hinge

**Root Cause**: The `has()` helper is correctly implemented to check progressive items, but there may be an issue with:
1. How the snapshot/inventory is structured when passed to helpers
2. Where `progression_mapping` is located in `staticData`
3. Whether the progressive resolution is happening at the right time

**Evidence**:
- Progression mapping IS correctly exported in rules.json
- `has()` helper IS updated to check progressive items
- The logic appears correct, but locations still aren't accessible

**Next Steps**:
1. Add console logging to `has()` helper to debug:
   - What's in snapshot.inventory
   - What's in staticData.progression_mapping
   - Whether progressive item lookup is working
2. Verify the exact structure of staticData being passed to helpers
3. Check if there's a timing issue with when progression_mapping is available
4. Consider if inventory resolution should happen earlier in the state management

## 📈 Progress Metrics
- **Exporter Issues**: 1 solved, 0 remaining
- **Helper Issues**: 1 solved, 1 remaining (critical)
- **General Issues**: 0 solved, 0 remaining
- **Test Progress**: Sphere 0 passing, failing at Sphere 0.2 (step 3 of 38)

## 🔧 Technical Notes

### Raft's Progressive Item System
Raft uses an extensive progressive item system defined in `progressives.json`:
- `progressive-metals`: Smelter → Metal detector → Electric Smelter
- `progressive-battery`: Battery → Battery charger → Advanced Battery → Wind turbine
- `progressive-engine`: Engine → Steering Wheel → Engine controls
- And 19 more progressive item chains

### Access Rule Patterns
The exporter successfully handles:
1. Simple region checks: `lambda state: True`
2. Region-specific helpers: `lambda state: state.raft_can_access_*`
3. Item requirement checks: Combines region + item checks in AND conditions
4. Complex nested conditions: e.g., Utopia access

## 📝 Files Modified
- `exporter/games/raft.py` (NEW)
- `frontend/modules/shared/gameLogic/raft/raftLogic.js` (NEW)
- `frontend/modules/shared/gameLogic/gameLogicRegistry.js` (MODIFIED)
- All documentation files in `CC/scripts/logs/raft/` (NEW)

## 🎯 Recommended Next Actions
1. Debug the progressive item resolution issue in Sphere 0.2
2. Once Sphere 0.2 passes, continue testing subsequent spheres
3. Fix any additional helper function issues that arise
4. Document all solutions in the tracking files
5. Run full test suite once all spheres pass
6. Consider creating PR when tests are fully passing
