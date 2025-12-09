# The Wind Waker - Solved Helper Issues

This file tracks helper function issues that have been resolved.

---

## Issue 1: Missing `can_access_*` Entrance Helper Functions (SOLVED)

**Date Solved:** 2025-12-09

**Problem:**
Multiple `can_access_*_entrance_*` helper functions were missing from the JavaScript implementation in `twwLogic.js`. These were being called from the rules.json but weren't implemented, causing the test to fail at Sphere 0.

**Original Symptoms:**
- Test failed at Sphere 0 with 4 missing helper functions:
  - `can_access_dungeon_entrance_on_dragon_roost_island`
  - `can_access_secret_cave_entrance_on_cliff_plateau_isles`
  - `can_access_fairy_fountain_entrance_on_northern_fairy_island`
  - `can_access_secret_cave_entrance_on_pawprint_isle`
- 4 regions not reachable (Dragon Roost Cavern, Cliff Plateau Isles Secret Cave, Northern Fairy Fountain, Pawprint Isle Chuchu Cave)

**Solution:**
Added all 45 `can_access_*` entrance helper functions to `twwLogic.js`, matching the Python implementations in `worlds/tww/Macros.py`:

### Dungeon Entrance Functions (6):
- `can_access_dungeon_entrance_on_dragon_roost_island` - Returns true
- `can_access_dungeon_entrance_in_forest_haven_sector` - Complex logic with Grappling Hook, Deku Leaf
- `can_access_dungeon_entrance_in_tower_of_the_gods_sector` - Requires 3 Pearls
- `can_access_dungeon_entrance_in_forsaken_fortress_sector` - Returns false
- `can_access_dungeon_entrance_on_headstone_island` - Requires Power Bracelets
- `can_access_dungeon_entrance_on_gale_isle` - Requires Iron Boots and Skull Hammer

### Miniboss Entrance Functions (5):
- `can_access_miniboss_entrance_in_forbidden_woods`
- `can_access_miniboss_entrance_in_tower_of_the_gods`
- `can_access_miniboss_entrance_in_earth_temple`
- `can_access_miniboss_entrance_in_wind_temple`
- `can_access_miniboss_entrance_in_hyrule_castle`

### Boss Entrance Functions (6):
- `can_access_boss_entrance_in_dragon_roost_cavern`
- `can_access_boss_entrance_in_forbidden_woods`
- `can_access_boss_entrance_in_tower_of_the_gods`
- `can_access_boss_entrance_in_forsaken_fortress`
- `can_access_boss_entrance_in_earth_temple`
- `can_access_boss_entrance_in_wind_temple`

### Secret Cave Entrance Functions (20):
- `can_access_secret_cave_entrance_on_outset_island`
- `can_access_secret_cave_entrance_on_dragon_roost_island`
- `can_access_secret_cave_entrance_on_fire_mountain`
- `can_access_secret_cave_entrance_on_ice_ring_isle`
- `can_access_secret_cave_entrance_on_private_oasis`
- `can_access_secret_cave_entrance_on_needle_rock_isle`
- `can_access_secret_cave_entrance_on_angular_isles`
- `can_access_secret_cave_entrance_on_boating_course`
- `can_access_secret_cave_entrance_on_stone_watcher_island`
- `can_access_secret_cave_entrance_on_overlook_island`
- `can_access_secret_cave_entrance_on_birds_peak_rock`
- `can_access_secret_cave_entrance_on_pawprint_isle`
- `can_access_secret_cave_entrance_on_pawprint_isle_side_isle`
- `can_access_secret_cave_entrance_on_diamond_steppe_island`
- `can_access_secret_cave_entrance_on_bomb_island`
- `can_access_secret_cave_entrance_on_rock_spire_isle`
- `can_access_secret_cave_entrance_on_shark_island`
- `can_access_secret_cave_entrance_on_cliff_plateau_isles`
- `can_access_secret_cave_entrance_on_horseshoe_island`
- `can_access_secret_cave_entrance_on_star_island`

### Inner Cave Entrance Functions (2):
- `can_access_inner_entrance_in_ice_ring_isle_secret_cave`
- `can_access_inner_entrance_in_cliff_plateau_isles_secret_cave`

### Fairy Fountain Entrance Functions (6):
- `can_access_fairy_fountain_entrance_on_outset_island`
- `can_access_fairy_fountain_entrance_on_thorned_fairy_island`
- `can_access_fairy_fountain_entrance_on_eastern_fairy_island`
- `can_access_fairy_fountain_entrance_on_western_fairy_island`
- `can_access_fairy_fountain_entrance_on_southern_fairy_island`
- `can_access_fairy_fountain_entrance_on_northern_fairy_island`

**Result:**
Test now progresses from Sphere 0 failure to Sphere 12.2 (step 48 out of 67), successfully validating 47 spheres of game logic.
