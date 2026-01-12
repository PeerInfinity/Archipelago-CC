# Fixing the Landstalker Memory Leak

> **Note:** This was a **fork-specific bug**, not an upstream bug. Upstream has always properly called `stage_modify_multidata` via `call_stage` (since d743d10b, Oct 2023).

## Overview

The fork's exporter calls `fill_slot_data()` after `stage_modify_multidata` has already cleared the cache, repopulating it and causing the memory leak.

## The Actual Fix (Applied)

Added cleanup in `exporter/games/base/world_data.py` after calling `fill_slot_data` for Landstalker:

```python
# Clear Landstalker's cached_spheres to prevent memory leak
# fill_slot_data populates this class variable with MultiWorld references
# that would otherwise prevent garbage collection
if world.game == "Landstalker - The Treasures of King Nole":
    try:
        from worlds.landstalker import LandstalkerWorld
        LandstalkerWorld.cached_spheres = []
    except ImportError:
        pass
```

## Alternative Fix: Instance Variable Approach

The changes below describe an alternative approach that converts `cached_spheres` to an instance variable, which would be a more robust solution that doesn't rely on cleanup after `fill_slot_data`.

## Changes to `worlds/landstalker/__init__.py`

### 1. Change the class variable declaration (around line 41)

**Before:**
```python
cached_spheres: List[Set[Location]] = []
```

**After:**
```python
cached_spheres: List[Set[Location]]
```

### 2. Initialize instance variable in `__init__` (around line 48)

**Before:**
```python
def __init__(self, multiworld, player):
    super().__init__(multiworld, player)
    self.regions_table: Dict[str, LandstalkerRegion] = {}
    self.dark_dungeon_id = "None"
    self.dark_region_ids = []
    self.teleport_tree_pairs = []
    self.jewel_items = []
```

**After:**
```python
def __init__(self, multiworld, player):
    super().__init__(multiworld, player)
    self.regions_table: Dict[str, LandstalkerRegion] = {}
    self.dark_dungeon_id = "None"
    self.dark_region_ids = []
    self.teleport_tree_pairs = []
    self.jewel_items = []
    self.cached_spheres = []
```

### 3. Update `fill_slot_data` to use instance variable (around line 51)

**Before:**
```python
def fill_slot_data(self) -> dict:
    if not LandstalkerWorld.cached_spheres:
        LandstalkerWorld.cached_spheres = list(self.multiworld.get_spheres())
```

**After:**
```python
def fill_slot_data(self) -> dict:
    if not self.cached_spheres:
        self.cached_spheres = list(self.multiworld.get_spheres())
```

### 4. Update `adjust_shop_prices` to use instance variable (around line 250)

**Before:**
```python
spheres = LandstalkerWorld.cached_spheres
```

**After:**
```python
spheres = self.cached_spheres
```

### 5. Update `stage_modify_multidata` to clear instance variables (around line 237)

**Before:**
```python
@classmethod
def stage_modify_multidata(cls, multiworld: MultiWorld, *_):
    LandstalkerWorld.cached_spheres = []
```

**After:**
```python
@classmethod
def stage_modify_multidata(cls, multiworld: MultiWorld, *_):
    for world in multiworld.get_game_worlds(cls.game):
        world.cached_spheres = []
```

## Verification

After applying the fix, run the generation command:

```bash
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/Landstalker - The Treasures of King Nole.yaml" --multi 1
```

The command should complete without the `AssertionError: MultiWorld object was not de-allocated` error.

Expected output ends with:
```
Done. Enjoy. Total Time: ...
```

(No assertion error means the fix is working.)
