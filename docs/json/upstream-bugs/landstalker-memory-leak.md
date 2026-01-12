# [Landstalker] Memory leak from cached_spheres class variable

**Status:** Fixed in fork (Jan 2026)
**Files:** `Main.py`, `exporter/games/base/world_data.py`

---

### Problem

`LandstalkerWorld.cached_spheres` (class variable) holds sphere references to MultiWorld, preventing garbage collection.

In the fork, the exporter was calling `fill_slot_data()` after `stage_modify_multidata` had already cleared the cache, repopulating it and causing the leak.

**Error:** `AssertionError: MultiWorld object was not de-allocated, it's referenced 67 times.`

---

### History

- d46e68cb - Initial Landstalker with `cached_spheres` as ClassVar
- c295926c (Nov 2024) - Fixed by using instance variable
- be550ff6 (Mar 2025) - Reverted to class variable while fixing shop prices
- Upstream has always called `stage_modify_multidata` via `call_stage` (since d743d10b, Oct 2023)
- Fork-specific issue: exporter called `fill_slot_data` after cleanup
- Fixed in fork by moving exporter before cleanup and using cached slot data

---

### Root Cause (Fork-Specific)

The old call order in the fork's Main.py:
1. `fill_slot_data()` called → populates `cached_spheres`
2. `modify_multidata` called → triggers `stage_modify_multidata` → clears cache
3. `export_game_rules()` called → called `fill_slot_data()` again → repopulated cache

Upstream doesn't have the exporter, so it doesn't have this problem.

---

### Fix

The fix respects Archipelago's intended lifecycle: **compute → use → cleanup**.

1. **Moved exporter before `modify_multidata`** in `Main.py`:
   - Exporter now runs while all computed data is still available
   - `stage_modify_multidata` clears caches afterward as intended

2. **Exporter uses cached slot data** in `exporter/games/base/world_data.py`:
   - Main.py caches `_cached_slot_data` after calling `fill_slot_data`
   - Exporter uses cached data instead of calling `fill_slot_data` again

3. **Clear handler cache after `create_playthrough`** in `Main.py`:
   - The sphere logger creates export handlers that hold world references
   - These must be cleared to allow garbage collection

---

### Verified

- Upstream (69e83071) never had this issue - `stage_modify_multidata` is called via `call_stage`
- Fork issue caused by exporter calling `fill_slot_data` after cleanup
- Fix verified: generation completes without memory leak assertion
