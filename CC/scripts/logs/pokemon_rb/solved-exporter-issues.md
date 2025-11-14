# Pokemon Red and Blue - Solved Exporter Issues

*Last updated: 2025-11-14*

## Summary

**Fixed Issues:** 1

---

## Fixed Issues

### 1. Bytearray serialization in local_poke_data

**Priority:** CRITICAL
**Status:** FIXED
**Date Fixed:** 2025-11-14

**Description:**
The `local_poke_data` was being exported with bytearray objects that were being serialized as strings like `"bytearray(b'\\xe0...')"` instead of proper JSON arrays. This caused JavaScript to be unable to access the TM/HM compatibility data properly.

**Impact:**
- The `can_learn_hm()` helper function couldn't check if Pokemon could learn HM moves
- All HM-related helpers (can_surf, can_cut, can_fly, can_strength, can_flash) failed
- Blocked access to 48+ regions that require HM moves

**Root Cause:**
The exporter was directly copying `world.local_poke_data` without converting bytearrays to lists for JSON serialization.

**Fix:**
Modified `get_game_info()` and `preprocess_world_data()` methods in `exporter/games/pokemon_rb.py` to convert bytearrays to lists:

```python
# Convert bytearrays to lists for JSON serialization
local_poke_data = {}
for pokemon_name, pokemon_data in world.local_poke_data.items():
    pokemon_dict = {}
    for key, value in pokemon_data.items():
        if isinstance(value, bytearray):
            pokemon_dict[key] = list(value)
        else:
            pokemon_dict[key] = value
    local_poke_data[pokemon_name] = pokemon_dict
```

**Result:**
- TM/HM data now properly exported as arrays
- JavaScript can access individual bytes using array indexing
- Spoiler test progressed from failing at Sphere 5.9 to Sphere 6.18
