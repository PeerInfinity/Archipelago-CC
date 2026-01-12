# Reproducing the Landstalker Memory Leak

> **Note:** This bug has been fixed in upstream Archipelago (as of Jan 2026). These reproduction steps now only work in this fork (Archipelago-CC) or older versions of upstream.

## Prerequisites

- Python 3.12+
- Git

## Steps (Archipelago-CC fork)

The simplest way to reproduce the bug in this fork:

```bash
source .venv/bin/activate
python Generate.py --weights_file_path "Templates/Landstalker - The Treasures of King Nole.yaml" --multi 1
```

### Expected output

```
AssertionError: MultiWorld object was not de-allocated, it's referenced 67 times. This would be a memory leak.
```

## Manual reproduction test

To manually test the memory leak mechanism:

```bash
python -c "
import gc
import weakref
import sys

from worlds.landstalker import LandstalkerWorld
from test.general import setup_solo_multiworld

multiworld = setup_solo_multiworld(LandstalkerWorld)

# Simulate what fill_slot_data does during output generation
LandstalkerWorld.cached_spheres = list(multiworld.get_spheres())

print(f'cached_spheres length: {len(LandstalkerWorld.cached_spheres)}')

weak = weakref.ref(multiworld)
del multiworld
gc.collect()

if weak():
    print(f'MEMORY LEAK: MultiWorld still referenced {sys.getrefcount(weak())} times')
else:
    print('No memory leak')
"
```

### Expected output

```
cached_spheres length: 3
MEMORY LEAK: MultiWorld still referenced 67 times
```

## Notes

- The memory leak assertion in `Generate.py` only triggers when `__debug__` is True (default)
- In this fork, the leak occurs because `stage_modify_multidata` is never called
- Upstream fixed this by calling `stage_modify_multidata` via `call_stage` during `generate_output`
- Clearing `LandstalkerWorld.cached_spheres = []` resolves the leak
