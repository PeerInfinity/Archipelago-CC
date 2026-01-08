# [Landstalker] Memory leak from cached_spheres class variable

**Status:** Regression in upstream
**File:** `worlds/landstalker/__init__.py`

---

### Problem

`LandstalkerWorld.cached_spheres` (class variable) holds sphere references to MultiWorld, preventing garbage collection. `stage_modify_multidata` should clear it but is never called (Main.py uses `call_all`, not `call_stage`).

**Error:** `AssertionError: MultiWorld object was not de-allocated, it's referenced 67 times.`

---

### History

Fixed in c295926c (Nov 2024) by using instance variable. Reintroduced in be550ff6 (Mar 2025) while fixing shop prices.

---

### Code

```python
cached_spheres: List[Set[Location]] = []  # Class variable

def fill_slot_data(self) -> dict:
    if not LandstalkerWorld.cached_spheres:
        LandstalkerWorld.cached_spheres = list(self.multiworld.get_spheres())

@classmethod
def stage_modify_multidata(cls, multiworld, *_):
    LandstalkerWorld.cached_spheres = []  # Never called
```

**Fix:** Restore instance variable approach from c295926c, or call `stage_modify_multidata` via `call_stage`.

---

### Verified

Confirmed on upstream main (db56e26d). Test shows 67 references when populated; clearing resolves leak.
