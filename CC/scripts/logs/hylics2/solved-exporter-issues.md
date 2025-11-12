# Hylics 2 - Solved Exporter Issues

## Solved Issues

### Issue 1: Wrong preset directory name

**Status:** ✅ SOLVED

**Description:**
The exporter was using "hylics_2" as the preset directory name, but it should use "hylics2" (matching the world directory name). This caused the frontend test to fail to find the preset.

**Location:** `exporter/exporter.py:100` - `get_world_directory_name()` function

**Root Cause:** The regex patterns didn't match the `game: str = "Hylics 2"` pattern used in worlds/hylics2/__init__.py. It only matched:
- `game: ClassVar[str] = "Game Name"`
- `game = "Game Name"`

So it fell back to the default conversion: `"Hylics 2".lower().replace(' ', '_')` → `"hylics_2"`

**Solution:** Added regex patterns to match `game: str = "Game Name"`:
```python
# Pattern for: game: str = "Game Name" (with type annotation)
pattern = r'game:\s*str\s*=\s*"([^"]*)"'
match = re.search(pattern, content)

if match:
    found_game_name = match.group(1)
    if found_game_name == game_name:
        return world_dir_name
```

**Files Changed:**
- `exporter/exporter.py` (lines 152-168)

**Verification:** Generation now correctly reports "using 'hylics2' preset folder" instead of "using 'hylics_2' preset folder"

---

### Issue 2: Item data not being exported

**Status:** ✅ SOLVED

**Description:**
During generation, the following warning appeared:
```
Handler for Hylics 2 returned no item data. Item export might be incomplete.
```

**Location:** `exporter/games/hylics2.py`

**Root Cause:** The Hylics 2 handler was extending `BaseGameExportHandler` instead of `GenericGameExportHandler`. The `BaseGameExportHandler.get_item_data()` returns an empty dict by default, while `GenericGameExportHandler.get_item_data()` automatically discovers items from `world.item_name_to_id`.

**Solution:** Changed the base class from `BaseGameExportHandler` to `GenericGameExportHandler`:
```python
from .generic import GenericGameExportHandler

class Hylics2GameExportHandler(GenericGameExportHandler):
    GAME_NAME = 'Hylics 2'
```

The `GenericGameExportHandler` provides:
- Automatic item data discovery from `world.item_name_to_id`
- Intelligent rule analysis with pattern matching
- Recognition of common helper patterns
- expand_helper() that preserves helper nodes for frontend handling

**Files Changed:**
- `exporter/games/hylics2.py` (complete rewrite to use GenericGameExportHandler)

**Verification:** Generation no longer shows the "Handler for Hylics 2 returned no item data" warning

---

## Test Results

After fixing both issues:
- ✅ Generation uses correct directory: `frontend/presets/hylics2/`
- ✅ Item data is exported correctly
- ✅ All 24 sphere tests pass
- ✅ No errors or warnings during generation
- ✅ Frontend test finds correct preset and loads successfully

**Test Command:**
```bash
npm test -- --mode=test-spoilers --game=hylics2 --seed=1
```

**Test Output:**
```
"passed": true
"totalEvents": 24
"processedEvents": 24
"errorCount": 0
"sphereCount": 24
```

All spheres (0, 0.1, 0.2, 0.3, 1.1, 2.1, 2.2, 2.3, ..., 12.1) passed successfully!
