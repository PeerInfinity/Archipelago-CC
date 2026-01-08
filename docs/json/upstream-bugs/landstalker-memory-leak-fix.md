# Fixing the Landstalker Memory Leak

## Overview

The fix converts `cached_spheres` from a class variable to an instance variable, preventing references from persisting after generation completes.

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

After applying the fix, run the memory leak test:

```bash
python -c "
import gc
import weakref
import sys

from worlds.landstalker import LandstalkerWorld
from test.general import setup_solo_multiworld

multiworld = setup_solo_multiworld(LandstalkerWorld)
for player in multiworld.player_ids:
    multiworld.worlds[player].cached_spheres = list(multiworld.get_spheres())

weak = weakref.ref(multiworld)
del multiworld
gc.collect()

if weak():
    print(f'MEMORY LEAK: MultiWorld still referenced {sys.getrefcount(weak())} times')
else:
    print('No memory leak - fix successful')
"
```

Expected output: `No memory leak - fix successful`
