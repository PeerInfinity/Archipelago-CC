# Solved Exporter Issues for Ocarina of Time

## Status: Tracking Solutions

Last Updated: 2025-11-20

## Completed Fixes

### Setup and Configuration

**Issue:** OOT not registered in preset_files.json
**Solution:** Added "oot" entry to `frontend/presets/preset_files.json` with correct flags:
- `has_custom_exporter: true`
- `has_custom_game_logic: false`

**Files Modified:**
- `frontend/presets/preset_files.json`

**Date Resolved:** 2025-11-20

---

### OOT Logic Module Already Exists

**Discovery:** Comprehensive OOT logic implementation already exists in the codebase

**What Exists:**
- ✅ Complete DSL parser for OOT rule strings (`parse_oot_rule` function)
- ✅ Extensive helper functions (has_shield, can_leave_forest, has_explosives, etc.)
- ✅ Item alias system matching Python LogicHelpers.json
- ✅ Age checks (is_adult, is_child, is_starting_age)
- ✅ Setting checks and logic trick helpers
- ✅ Function call handlers (can_play, can_use, here, at)
- ✅ Recursive descent parser for OOT DSL
- ✅ Proper operator handling (and, or, not)
- ✅ Item count checks, comparisons, and event checks

**Location:** `frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js`

**Registration:** Properly registered in `gameLogicRegistry.js` with world class 'OOTWorld'

**Date Discovered:** 2025-11-20

---

### Helper Function Alias Expansion

**Issue:** `has_shield` and `can_shield` helpers were not correctly implementing item alias expansion

**Python Definitions:**
- `has_shield`: `(is_adult and Hylian_Shield) or (is_child and Deku_Shield)`
- `can_shield`: `(is_adult and (Hylian_Shield or Mirror_Shield)) or (is_child and Deku_Shield)`

**Aliases:**
- `Deku_Shield` → `Buy_Deku_Shield or Deku_Shield_Drop`
- `Hylian_Shield` → `Buy_Hylian_Shield`

**Solution:** Updated helpers to explicitly expand aliases:
```javascript
has_shield: () => {
  if (context.is_adult()) {
    return context.hasItem('Buy_Hylian_Shield');
  }
  if (context.is_child()) {
    return context.hasItem('Buy_Deku_Shield') || context.hasItem('Deku_Shield_Drop');
  }
  return false;
}
```

**Files Modified:**
- `frontend/modules/shared/gameLogic/ocarina_of_time/ootLogic.js:327-353`

**Date Resolved:** 2025-11-20

**Note:** While the alias expansion is now correct, there's still a Sphere 0.8 timing mismatch that suggests the Python `here()` function has additional semantics beyond simple evaluation.

---

*More fixes will be documented here as issues are resolved.*
