# [Landstalker] Memory leak from cached_spheres class variable

**Status:** Fixed in fork (Jan 2026)
**File:** `exporter/games/base/world_data.py`

---

### Problem

`LandstalkerWorld.cached_spheres` (class variable) holds sphere references to MultiWorld, preventing garbage collection.

In the fork, the exporter calls `fill_slot_data()` after `stage_modify_multidata` has already cleared the cache, repopulating it and causing the leak.

**Error:** `AssertionError: MultiWorld object was not de-allocated, it's referenced 67 times.`

---

### History

- d46e68cb - Initial Landstalker with `cached_spheres` as ClassVar
- c295926c (Nov 2024) - Fixed by using instance variable
- be550ff6 (Mar 2025) - Reverted to class variable while fixing shop prices
- Upstream has always called `stage_modify_multidata` via `call_stage` (since d743d10b, Oct 2023)
- Fork-specific issue: exporter calls `fill_slot_data` after cleanup (Main.py:407 after Main.py:369)
- Fixed in fork by clearing cache in exporter after `fill_slot_data`

---

### Root Cause (Fork-Specific)

The call order in the fork's Main.py:
1. Line 296: `fill_slot_data()` called → populates `cached_spheres`
2. Line 369: `modify_multidata` called → triggers `stage_modify_multidata` → clears cache
3. Line 407: `export_game_rules()` called → calls `fill_slot_data()` again → repopulates cache

Upstream doesn't have the exporter, so it doesn't have this second call.

---

### Fix

Added cleanup in `exporter/games/base/world_data.py` after calling `fill_slot_data` for Landstalker:

```python
if world.game == "Landstalker - The Treasures of King Nole":
    try:
        from worlds.landstalker import LandstalkerWorld
        LandstalkerWorld.cached_spheres = []
    except ImportError:
        pass
```

---

### Verified

- Upstream (69e83071) never had this issue - `stage_modify_multidata` is called via `call_stage`
- Fork issue caused by exporter calling `fill_slot_data` after cleanup
- Fix verified: generation completes without memory leak assertion
