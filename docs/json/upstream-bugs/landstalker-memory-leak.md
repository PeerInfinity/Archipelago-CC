# [Landstalker] Memory leak from cached_spheres class variable

**Status:** Fixed in upstream (as of Jan 2026)
**File:** `worlds/landstalker/__init__.py`

---

### Problem

`LandstalkerWorld.cached_spheres` (class variable) holds sphere references to MultiWorld, preventing garbage collection. `stage_modify_multidata` should clear it but was never called (Main.py used `call_all`, not `call_stage`).

**Error:** `AssertionError: MultiWorld object was not de-allocated, it's referenced 67 times.`

---

### History

- Fixed in c295926c (Nov 2024) by using instance variable
- Reintroduced in be550ff6 (Mar 2025) while fixing shop prices
- Fixed again in upstream (verified Jan 2026) - `stage_modify_multidata` is now called via `call_stage` during `generate_output`

---

### Code

```python
cached_spheres: List[Set[Location]] = []  # Class variable

def fill_slot_data(self) -> dict:
    if not LandstalkerWorld.cached_spheres:
        LandstalkerWorld.cached_spheres = list(self.multiworld.get_spheres())

@classmethod
def stage_modify_multidata(cls, multiworld, *_):
    LandstalkerWorld.cached_spheres = []  # Now called via call_stage
```

**Fix:** Upstream now calls `stage_modify_multidata` via `call_stage` during the `generate_output` stage, which properly clears the cache.

---

### Verified

- Originally confirmed on upstream main (db56e26d) with 67 references
- Re-verified Jan 2026: upstream (69e83071) no longer has the leak - `stage_modify_multidata` is called and clears cache
- Bug still exists in Archipelago-CC fork (v0.6.5) which is behind upstream
