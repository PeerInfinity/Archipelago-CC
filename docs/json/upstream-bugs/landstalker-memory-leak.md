# [Landstalker] Memory leak from cached_spheres class variable

**Status:** Unfixed in upstream
**Upstream Repository:** https://github.com/ArchipelagoMW/Archipelago
**Affected File:** `worlds/landstalker/__init__.py`
**Discovered:** 2026-01-08

---

### Explain what the problem encountered is.

The `LandstalkerWorld` class uses a class variable `cached_spheres` to cache sphere data for shop price calculations. This causes a memory leak that fails Archipelago's memory leak assertion at the end of seed generation.

**Root Cause:**
1. The `stage_modify_multidata` class method clears `cached_spheres = []` during generation
2. However, `fill_slot_data` is called **after** `stage_modify_multidata` during output generation
3. `fill_slot_data` repopulates `cached_spheres` with `list(self.multiworld.get_spheres())`
4. These sphere objects hold references to the MultiWorld object
5. At the end of generation, the memory leak check fails because MultiWorld cannot be garbage collected

**Error Message:**
```
AssertionError: MultiWorld object was not de-allocated, it's referenced 67 times. This would be a memory leak.
```

**Steps to Reproduce:**
1. Create a Landstalker template YAML
2. Run: `python Generate.py --weights_file_path "Templates/Landstalker - The Treasures of King Nole.yaml" --multi 1 --seed 1`
3. Generation completes successfully but exits with assertion error

---

### Provide any supporting information available.

**Problematic code in `worlds/landstalker/__init__.py`:**

```python
class LandstalkerWorld(World):
    # ...
    cached_spheres: List[Set[Location]] = []  # Class variable holds references

    def fill_slot_data(self) -> dict:
        if not LandstalkerWorld.cached_spheres:
            LandstalkerWorld.cached_spheres = list(self.multiworld.get_spheres())  # Repopulated after stage_modify_multidata
        # ...

    @classmethod
    def stage_modify_multidata(cls, multiworld: MultiWorld, *_):
        LandstalkerWorld.cached_spheres = []  # Cleared too early
```

**Suggested Fix:**

Change to compute spheres locally instead of using a class variable:

```python
def fill_slot_data(self) -> dict:
    # Compute spheres locally to avoid holding references to multiworld
    spheres = list(self.multiworld.get_spheres())

    # Generate hints.
    self.adjust_shop_prices(spheres)  # Pass as parameter
    # ...

def adjust_shop_prices(self, spheres):  # Accept spheres as parameter
    # ... use spheres parameter instead of class variable
```

This removes the class variable entirely and avoids the reference leak.

---

### List what troubleshooting has been attempted already

- Confirmed the issue exists in the latest upstream Archipelago repository (main branch)
- Verified the fix by modifying the local copy:
  - Removed `cached_spheres` class variable
  - Changed `fill_slot_data` to compute spheres locally
  - Modified `adjust_shop_prices` to accept spheres as a parameter
  - Removed the now-unnecessary `stage_modify_multidata` method
- After the fix, generation completes without the memory leak assertion error

---

### Tags

- Bug
- Memory Leak
- Landstalker
