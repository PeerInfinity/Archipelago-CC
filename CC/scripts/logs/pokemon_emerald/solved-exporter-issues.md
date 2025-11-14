# Pokemon Emerald - Solved Exporter Issues

## Issue 1: Exporter not returning item data ✓ SOLVED

**Status:** Fixed
**Priority:** High
**Category:** Exporter
**Date Resolved:** 2025-11-14

**Description:**
The Pokemon Emerald exporter was extending `BaseGameExportHandler` instead of `GenericGameExportHandler`, which meant it didn't inherit the automatic item data discovery functionality. This caused the generation to show the warning:
```
Handler for Pokemon Emerald returned no item data. Item export might be incomplete.
```

**Location:** `exporter/games/pokemon_emerald.py`

**Symptoms:**
- Warning message during generation: "Handler for Pokemon Emerald returned no item data. Item export might be incomplete."
- Missing item definitions in the exported rules.json
- Potential issues with rule evaluation in the frontend

**Root Cause:**
```python
class PokemonEmeraldGameExportHandler(BaseGameExportHandler):
```

**Solution Applied:**
Changed the parent class from `BaseGameExportHandler` to `GenericGameExportHandler`:
```python
from .generic import GenericGameExportHandler
...
class PokemonEmeraldGameExportHandler(GenericGameExportHandler):
```

**Verification:**
- Regenerated rules.json with seed 1
- Warning no longer appears in generation output
- Item data is now properly exported

**Files Modified:**
- `exporter/games/pokemon_emerald.py` - Changed parent class and import statement

---

## Issue 2: hm_rules dictionary access not converted to helper calls ✓ SOLVED

**Status:** Fixed
**Priority:** High
**Category:** Exporter
**Date Resolved:** 2025-11-14

**Description:**
The exporter was generating complex `function_call` rules with `subscript` access to the `hm_rules` dictionary (e.g., `hm_rules["HM03 Surf"]()`). These complex rule structures were not being evaluated correctly by the JavaScript RuleEngine, causing regions that should be accessible to remain inaccessible.

**Location:** `exporter/games/pokemon_emerald.py`

**Symptoms:**
- Test failed at sphere 8.11 (step 244)
- Regions like `REGION_BATTLE_FRONTIER_OUTSIDE_EAST/ABOVE_WATERFALL` and `REGION_ARTISAN_CAVE_1F/MAIN` were not accessible
- Access rules contained complex nested structures:
  ```json
  {
    "type": "function_call",
    "function": {
      "type": "subscript",
      "value": {"type": "name", "name": "hm_rules"},
      "index": {"type": "constant", "value": "HM03 Surf"}
    },
    "args": []
  }
  ```

**Root Cause:**
The Python code uses a dictionary `hm_rules` that maps HM names to lambda functions. The exporter was converting these to complex `function_call` rules instead of recognizing them as standard HM ability checks that should use helper functions.

**Solution Applied:**
1. Added HM_TO_HELPER mapping dictionary to convert HM names to helper function names
2. Implemented custom `expand_rule()` method to detect the `hm_rules["HM_NAME"]()` pattern
3. Converted these patterns to simple helper calls like `can_surf`, `can_cut`, etc.

**Code Added:**
```python
# Mapping of HM names to helper function names
HM_TO_HELPER = {
    "HM01 Cut": "can_cut",
    "HM02 Fly": "can_fly",
    "HM03 Surf": "can_surf",
    "HM04 Strength": "can_strength",
    "HM05 Flash": "can_flash",
    "HM06 Rock Smash": "can_rock_smash",
    "HM07 Waterfall": "can_waterfall",
    "HM08 Dive": "can_dive",
}

def expand_rule(self, rule: Dict[str, Any]) -> Dict[str, Any]:
    # Detects and converts hm_rules["HM_NAME"]() to helper calls
    ...
```

**Verification:**
- Regenerated rules.json with seed 1
- Access rule now shows:
  ```json
  {
    "type": "helper",
    "name": "can_surf",
    "args": []
  }
  ```
- Spoiler test passes completely (901/901 events)

**Files Modified:**
- `exporter/games/pokemon_emerald.py` - Added HM_TO_HELPER mapping and expand_rule method
