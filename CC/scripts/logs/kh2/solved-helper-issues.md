# Solved Helper Issues

## Issue 1: Visit Locking Items - Ice Cream appears twice in Python but only once in JavaScript

**Test Failure:** Sphere 6.10 - Region "Levels Region (12 Visit Locking Items)" not reachable

**Root Cause:**
- In Python `worlds/kh2/Items.py:569-584`, the `visit_locking_dict["2VisitLocking"]` list contains "Ice Cream" twice (lines 579 and 582)
- In JavaScript `frontend/modules/shared/gameLogic/kh2/kh2Logic.js:18-32`, the `VISIT_LOCKING_ITEMS` array only contained "Ice Cream" once (line 28)
- This caused the JavaScript to undercount the total visit locking items by 1

**Impact:**
- Prevented access to "Level 44", "Level 46", "Level 48" at the correct sphere
- The region requiring 12 visit locking items was not accessible when it should have been

**Fix Applied:**
- Added "Ice Cream" a second time to the `VISIT_LOCKING_ITEMS` array in `kh2Logic.js` (line 32)
- Added comment explaining that Ice Cream appears twice in the Python list

**File Modified:**
- `frontend/modules/shared/gameLogic/kh2/kh2Logic.js`

## Issue 2: Missing helper functions for Cavern of Remembrance and Demyx fights

**Test Failure:** Sphere 7.2 - Multiple regions not reachable

**Missing Helper Functions:**
- `get_cor_first_fight_movement_rules`
- `get_cor_first_fight_rules`
- `get_cor_skip_first_rules`
- `get_demyx_rules`

**Unreachable Regions:**
- Cavern of Rememberance:Fight 1
- Cavern of Rememberance:Fight 2
- Hollow Bastion Demyx

**Fix Applied:**
- Implemented all four missing helper functions in `kh2Logic.js`
- Also implemented utility helper functions used by these:
  - `kh2_list_any_sum` - Count lists where player has any item
  - `kh2_dict_count` - Check if player has all required item counts
  - `kh2_dict_one_count` - Count how many items meet their required count
  - `kh2_has_all` - Check if player has all items from a list
  - `kh2_has_any` - Check if player has any item from a list
- Added `CorSkipToggle` to exported settings in `exporter/games/kh2.py`
- Regenerated rules.json to include the new setting

**Files Modified:**
- `frontend/modules/shared/gameLogic/kh2/kh2Logic.js`
- `exporter/games/kh2.py`

## Issue 3: Missing helper function get_cor_second_fight_movement_rules

**Test Failure:** Sphere 7.2 - Region "Cavern of Rememberance:Fight 2" not reachable

**Missing Helper Function:**
- `get_cor_second_fight_movement_rules`

**Fix Applied:**
- Implemented the `get_cor_second_fight_movement_rules` helper function in `kh2Logic.js`
- Based on Python implementation in `worlds/kh2/Rules.py:979-991`
- Handles easy/normal/hard fight logic variants

**File Modified:**
- `frontend/modules/shared/gameLogic/kh2/kh2Logic.js`

