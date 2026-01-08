# Reproducing the Landstalker Memory Leak

## Prerequisites

- Python 3.12+
- Git

## Steps

### 1. Clone Archipelago

```bash
git clone https://github.com/ArchipelagoMW/Archipelago.git
cd Archipelago
```

### 2. Set up environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python ModuleUpdate.py -y
```

### 3. Generate Landstalker template

```bash
mkdir -p Players/Templates
python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"
cp "Players/Templates/Landstalker - The Treasures of King Nole.yaml" Players/Landstalker.yaml
```

### 4. Run the memory leak test

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
- The leak occurs because `stage_modify_multidata` is never called - Main.py uses `call_all()` instead of `call_stage()`
- Clearing `LandstalkerWorld.cached_spheres = []` resolves the leak
